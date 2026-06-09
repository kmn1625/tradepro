'use strict';

// Backtest engine (P5-R01 through P5-R06)
// Time-step loop over 1-min OHLCV candles. Prices options via Black-Scholes.
// Falls back to mock GBM data when DuckDB has no candles for the requested range.

const historicalDb    = require('./historicalDb.service');
const strikeResolver  = require('./strikeResolver');
const expiryCalc      = require('./expiryCalc');
const { evaluate }    = require('./conditionEvaluator');
const instrumentMaster = require('./instrumentMaster.service');

// ─── Black-Scholes (Abramowitz & Stegun, max error ~1e-7) ────────────────────

function bsPrice(S, K, T, sigma, r, type = 'CE') {
  if (T <= 0) return type === 'CE' ? Math.max(0, S - K) : Math.max(0, K - S);
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const N  = (x) => {
    const a1=0.319381530, a2=-0.356563782, a3=1.781477937, a4=-1.821255978, a5=1.330274429;
    const k   = 1 / (1 + 0.2316419 * Math.abs(x));
    const poly = k*(a1+k*(a2+k*(a3+k*(a4+k*a5))));
    const cdf  = 1 - (Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI)) * poly;
    return x >= 0 ? cdf : 1 - cdf;
  };
  if (type === 'CE') return Math.max(0, S*N(d1) - K*Math.exp(-r*T)*N(d2));
  return Math.max(0, K*Math.exp(-r*T)*N(-d2) - S*N(-d1));
}

// ─── Mock data generator (GBM) ───────────────────────────────────────────────

function _randn() {
  let u;
  do { u = Math.random(); } while (u === 0);
  return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*Math.random());
}

function _generateMockCandles(underlying, fromDate, toDate) {
  const BASE  = { NIFTY: 24000, BANKNIFTY: 52000, FINNIFTY: 23000 };
  const VOLS  = { NIFTY: 0.15,  BANKNIFTY: 0.22,  FINNIFTY: 0.18  };
  let price   = BASE[underlying] || 20000;
  const sv    = VOLS[underlying] || 0.15;
  const dt    = 1 / (252 * 375);
  const mu    = (0.10 / (252 * 375)) - 0.5 * sv * sv * dt;
  const sigma = sv * Math.sqrt(dt);
  const result = [];

  for (let d = new Date(fromDate + 'T00:00:00Z'); d <= new Date(toDate + 'T23:59:59Z'); d.setUTCDate(d.getUTCDate()+1)) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3, 45); // 9:15 IST
    for (let m = 0; m < 375; m++) {
      const o = price;
      const c = o * Math.exp(mu + sigma * _randn());
      const r = Math.abs(c - o) + o * sigma * 0.5;
      result.push({
        ts:  base + m * 60_000,
        o:   +o.toFixed(2),
        h:   +(Math.max(o, c) + r * (0.1 + Math.random() * 0.3)).toFixed(2),
        l:   +(Math.min(o, c) - r * (0.1 + Math.random() * 0.3)).toFixed(2),
        c:   +c.toFixed(2),
        vol: (5000 + Math.random() * 50000) | 0,
      });
      price = c;
    }
  }
  return result;
}

// ─── Timestamp helpers (IST = UTC+5:30) ──────────────────────────────────────

const IST_OFFSET = 5.5 * 3_600_000;
const _istH    = ms => new Date(ms + IST_OFFSET).getUTCHours();
const _istM    = ms => new Date(ms + IST_OFFSET).getUTCMinutes();
const _istDate = ms => new Date(ms + IST_OFFSET).toISOString().slice(0, 10);

function _groupByDay(candles) {
  const m = new Map();
  for (const c of candles) {
    const d = _istDate(c.ts);
    if (!m.has(d)) m.set(d, []);
    m.get(d).push(c);
  }
  return m;
}

// ─── BacktestService ─────────────────────────────────────────────────────────

class BacktestService {

  async run(config) {
    const {
      underlying = 'NIFTY',
      dateRange,
      legs = [
        { side: 'SELL', type: 'CE', strikeOffset: 0, lots: 1 },
        { side: 'SELL', type: 'PE', strikeOffset: 0, lots: 1 },
      ],
      entry, exit,
      sl          = { type: 'pct', value: 30 },
      target      = { type: 'pct', value: 50 },
      trailingSl  = null,        // { type: 'pct', value: 25 } — trail from peak
      adjustments = [],          // [{ trigger:{type,value}, action:{type,leg?,legIndex?} }]
      iv,
    } = config;

    if (!dateRange?.from || !dateRange?.to) throw new Error('dateRange.from and dateRange.to required');

    const IV      = iv || strikeResolver.getDefaultIV(underlying);
    const lotSize = strikeResolver.getLotSize(underlying);
    const R       = 0.065;

    // Load candles
    await historicalDb.init();
    const fromMs = new Date(dateRange.from + 'T00:00:00Z').getTime();
    const toMs   = new Date(dateRange.to   + 'T23:59:59Z').getTime();
    let candles = [];
    if (historicalDb.isReady()) {
      const raw    = await historicalDb.queryCandles(underlying, '1m', fromMs, toMs, 300_000);
      candles = raw.map(c => ({ ts: Number(c.ts), o: c.o, h: c.h, l: c.l, c: c.c, vol: Number(c.vol) }));
    }
    const usedMock = candles.length === 0;
    if (usedMock) candles = _generateMockCandles(underlying, dateRange.from, dateRange.to);
    if (candles.length === 0) throw new Error('No candle data for date range');

    const dayMap     = _groupByDay(candles);
    const sortedDays = [...dayMap.keys()].sort();

    // Real option candle cache: tradingsymbol → [{ts, c}] sorted ascending
    const optionCandles  = new Map();
    let   anyRealOptions = false;

    // Return real option close price from cache if within 2 min, else Black-Scholes fallback.
    function _optPx(spot, type, strike, ts, dte, sym) {
      if (sym) {
        const arr = optionCandles.get(sym) || [];
        if (arr.length > 0) {
          let lo = 0, hi = arr.length - 1;
          while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid].ts < ts) lo = mid + 1; else hi = mid; }
          if (Math.abs(arr[lo].ts - ts) <= 120_000) return arr[lo].c;
        }
      }
      return bsPrice(spot, strike, dte, IV, R, type);
    }

    const trades      = [];
    const equityCurve = [];
    const dayPnlMap   = {};

    let position = null;
    let cumPnl   = 0;
    let tradeId  = 1;

    for (const day of sortedDays) {
      const dayCandlesAll = dayMap.get(day);
      const candleBuffer  = [];
      let dayRealized     = 0;

      for (const candle of dayCandlesAll) {
        const h    = _istH(candle.ts);
        const m    = _istM(candle.ts);
        const spot = candle.c;
        candleBuffer.push(candle);

        if (h < 9 || (h === 9 && m < 25)) continue; // warmup skip

        // ── ENTRY ──────────────────────────────────────────────────────────
        if (!position) {
          const inWindow = (h > 9 || (h === 9 && m >= 30)) && (h < 14 || (h === 14 && m <= 30));
          if (!inWindow) continue;

          let doEnter = false;
          if (entry) {
            try { doEnter = evaluate(entry, candleBuffer, { currentPrice: spot, time: candle.ts }); }
            catch { doEnter = false; }
          } else {
            doEnter = (h === 9 && m === 30); // default: open at 9:30
          }
          if (!doEnter) continue;

          const expiryDate = expiryCalc.getNearestWeeklyExpiry(day, underlying);
          const expiryStr  = expiryDate.toISOString().slice(0, 10);

          const posLegs = [];
          for (const leg of legs) {
            const off    = leg.strikeOffset ?? 0;
            const strike = strikeResolver.resolveStrike(spot, underlying, leg.type === 'PE' ? -off : off);
            const dte    = expiryCalc.getDTE(candle.ts, expiryDate);
            let tradingsymbol = null;
            try {
              const contract = await instrumentMaster.resolveOptionToken(underlying, expiryStr, strike, leg.type);
              if (contract) {
                tradingsymbol = contract.tradingsymbol;
                if (!optionCandles.has(tradingsymbol) && historicalDb.isReady()) {
                  const rows = await historicalDb.queryCandles(tradingsymbol, '1m', fromMs, toMs, 50_000);
                  optionCandles.set(tradingsymbol, rows.map(r => ({ ts: Number(r.ts), c: r.c })));
                  if (rows.length > 0) anyRealOptions = true;
                } else if (!optionCandles.has(tradingsymbol)) {
                  optionCandles.set(tradingsymbol, []);
                }
              }
            } catch { /* master unavailable — use BS */ }
            const prem = _optPx(spot, leg.type, strike, candle.ts, dte, tradingsymbol);
            posLegs.push({ side: leg.side, type: leg.type, strike, lots: leg.lots || 1,
              entryPremium: +prem.toFixed(2), currentPremium: +prem.toFixed(2), tradingsymbol });
          }

          const basisValue = posLegs.reduce((s, l) => s + l.entryPremium * l.lots * lotSize, 0) || 1;
          position = { id: tradeId++, entryTime: candle.ts, entrySpot: spot, expiryStr,
            legs: posLegs, basisValue, peakPnl: 0, _partialPnl: 0, _firedAdj: new Set() };
          continue;
        }

        // ── EXIT CHECK ─────────────────────────────────────────────────────
        const expiryDate = new Date(position.expiryStr + 'T00:00:00Z');
        for (const leg of position.legs) {
          const dte = expiryCalc.getDTE(candle.ts, expiryDate);
          leg.currentPremium = +_optPx(spot, leg.type, leg.strike, candle.ts, dte, leg.tradingsymbol).toFixed(2);
        }

        let unrealPnl = position.legs.reduce((s, l) =>
          s + (l.side === 'SELL' ? 1 : -1) * (l.entryPremium - l.currentPremium) * l.lots * lotSize, 0
        );

        // ── ADJUSTMENT RULES (M9) ───────────────────────────────────────────
        for (let ai = 0; ai < adjustments.length; ai++) {
          if (position._firedAdj.has(ai)) continue;
          const { trigger, action } = adjustments[ai];
          let triggered = false;
          if (trigger.type === 'pnl_pct') {
            triggered = (unrealPnl / position.basisValue * 100) <= trigger.value;
          } else if (trigger.type === 'spot_move_pct') {
            triggered = Math.abs((spot - position.entrySpot) / position.entrySpot * 100) >= Math.abs(trigger.value);
          }
          if (!triggered) continue;
          position._firedAdj.add(ai);

          if (action.type === 'add_leg' && action.leg) {
            const lc  = action.leg;
            const off = lc.strikeOffset ?? 0;
            const sk  = strikeResolver.resolveStrike(spot, underlying, lc.type === 'PE' ? -off : off);
            const dte = expiryCalc.getDTE(candle.ts, new Date(position.expiryStr + 'T00:00:00Z'));
            let tsym = null;
            try {
              const ct = await instrumentMaster.resolveOptionToken(underlying, position.expiryStr, sk, lc.type);
              if (ct) {
                tsym = ct.tradingsymbol;
                if (!optionCandles.has(tsym) && historicalDb.isReady()) {
                  const rows = await historicalDb.queryCandles(tsym, '1m', fromMs, toMs, 50_000);
                  optionCandles.set(tsym, rows.map(r => ({ ts: Number(r.ts), c: r.c })));
                  if (rows.length > 0) anyRealOptions = true;
                } else if (!optionCandles.has(tsym)) optionCandles.set(tsym, []);
              }
            } catch { /* use BS */ }
            const prem = _optPx(spot, lc.type, sk, candle.ts, dte, tsym);
            position.legs.push({ side: lc.side, type: lc.type, strike: sk,
              lots: lc.lots || 1, entryPremium: +prem.toFixed(2),
              currentPremium: +prem.toFixed(2), tradingsymbol: tsym });
            position.basisValue += prem * (lc.lots || 1) * lotSize;
          } else if (action.type === 'squareoff_leg') {
            const li  = action.legIndex ?? 0;
            const sqL = position.legs[li];
            if (sqL) {
              const legPnl = (sqL.side === 'SELL' ? 1 : -1) * (sqL.entryPremium - sqL.currentPremium) * sqL.lots * lotSize;
              position._partialPnl += legPnl;
              position.legs.splice(li, 1);
            }
          }
        }

        // Recompute after adjustments; close if all legs gone
        if (position.legs.length === 0) {
          const tradePnl = +position._partialPnl.toFixed(2);
          cumPnl += tradePnl; dayRealized += tradePnl;
          trades.push(_makeTrade(position, candle.ts, spot, lotSize, tradePnl, 'adjustment'));
          position = null; continue;
        }
        unrealPnl = position.legs.reduce((s, l) =>
          s + (l.side === 'SELL' ? 1 : -1) * (l.entryPremium - l.currentPremium) * l.lots * lotSize, 0
        );

        const slAmt  = -(position.basisValue * (sl?.value  || 30) / 100);
        const tgtAmt =   position.basisValue * (target?.value || 50) / 100;

        // Update trailing SL peak
        if (trailingSl && unrealPnl > position.peakPnl) position.peakPnl = unrealPnl;
        const trailAmt = (trailingSl && position.peakPnl > 0)
          ? position.peakPnl - (position.basisValue * trailingSl.value / 100)
          : -Infinity;

        let exitReason = null;
        if      (unrealPnl <= slAmt)                          exitReason = 'sl';
        else if (trailingSl && unrealPnl <= trailAmt)         exitReason = 'trailing_sl';
        else if (unrealPnl >= tgtAmt)                         exitReason = 'target';
        else if (expiryCalc.shouldForceClose(candle, position.expiryStr)) exitReason = 'expiry';
        else if (h > 15 || (h === 15 && m >= 25)) exitReason = 'time';
        else if (exit && candleBuffer.length >= 2) {
          try {
            if (evaluate(exit, candleBuffer, { currentPrice: spot, entryPrice: position.entrySpot, time: candle.ts }))
              exitReason = 'condition';
          } catch { /* ignore */ }
        }

        if (exitReason) {
          const tradePnl = +(unrealPnl + position._partialPnl).toFixed(2);
          cumPnl        += tradePnl;
          dayRealized   += tradePnl;
          trades.push(_makeTrade(position, candle.ts, spot, lotSize, tradePnl, exitReason));
          position = null;
        }
      }

      // EOD force-close
      if (position) {
        const last  = dayCandlesAll[dayCandlesAll.length - 1];
        const spot  = last.c;
        const expD  = new Date(position.expiryStr + 'T00:00:00Z');
        for (const leg of position.legs) {
          leg.currentPremium = +_optPx(spot, leg.type, leg.strike, last.ts, expiryCalc.getDTE(last.ts, expD), leg.tradingsymbol).toFixed(2);
        }
        const eodPnl = +(position.legs.reduce((s, l) =>
          s + (l.side === 'SELL' ? 1 : -1) * (l.entryPremium - l.currentPremium) * l.lots * lotSize, 0
        ) + position._partialPnl).toFixed(2);
        cumPnl      += eodPnl;
        dayRealized += eodPnl;
        trades.push(_makeTrade(position, last.ts, spot, lotSize, eodPnl, 'eod'));
        position = null;
      }

      dayPnlMap[day] = +dayRealized.toFixed(2);
      equityCurve.push({ date: day, dailyPnl: dayPnlMap[day], equity: +cumPnl.toFixed(2) });
    }

    const metrics = this.computeMetrics(trades);

    // Heatmap aggregation
    const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const byDow = {}, byMonth = {};
    for (const [day, pnl] of Object.entries(dayPnlMap)) {
      const dow = DOW[new Date(day + 'T00:00:00Z').getUTCDay()];
      const mon = day.slice(0, 7);
      byDow[dow]   = +((byDow[dow]   || 0) + pnl).toFixed(2);
      byMonth[mon] = +((byMonth[mon] || 0) + pnl).toFixed(2);
    }

    const dataSource = usedMock ? 'mock-gbm' : anyRealOptions ? 'duckdb-real' : 'duckdb-spot+bs';
    return { underlying, dateRange, dataSource, ...metrics, trades, equityCurve, heatmap: { byDow, byMonth } };
  }

  // P5-R06 performance metrics
  computeMetrics(trades) {
    if (!trades || trades.length === 0) {
      return { totalPnl: 0, winRate: 0, maxDrawdown: 0, sharpe: 0, profitFactor: 0, tradeCount: 0 };
    }

    const tradePnl = (t) => {
      if (Number.isFinite(t.totalPnl)) return Number(t.totalPnl);
      if (
        Number.isFinite(t.entryPrice) &&
        Number.isFinite(t.exitPrice) &&
        Number.isFinite(t.qty)
      ) {
        const dir = t.side === 'SELL' ? -1 : 1;
        return +((t.exitPrice - t.entryPrice) * t.qty * dir).toFixed(2);
      }
      return 0;
    };

    const pnls   = trades.map(tradePnl);
    const total  = pnls.reduce((a, b) => a + b, 0);
    const wins   = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);
    const pf     = losses.length === 0 ? null
      : +((wins.reduce((a,b)=>a+b,0)) / Math.abs(losses.reduce((a,b)=>a+b,0))).toFixed(2);

    let equity = 0, peak = 0, maxDD = 0;
    for (const p of pnls) {
      equity += p;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDD) maxDD = dd;
    }

    const mean = total / pnls.length;
    const std  = Math.sqrt(pnls.reduce((s, p) => s + (p-mean)**2, 0) / pnls.length);
    const sharpe = std > 0 ? +((mean - 0.065/252) / std * Math.sqrt(252)).toFixed(2) : 0;

    return {
      totalPnl:    +total.toFixed(2),
      winRate:     +((wins.length / pnls.length) * 100).toFixed(1),
      maxDrawdown: +(maxDD * 100).toFixed(2),
      sharpe,
      profitFactor: pf,
      tradeCount:  trades.length,
    };
  }
}

function _makeTrade(position, exitTime, exitSpot, lotSize, totalPnl, exitReason) {
  return {
    id:        position.id,
    entryTime: position.entryTime,
    exitTime,
    entrySpot: position.entrySpot,
    exitSpot,
    legs: position.legs.map(l => ({
      side:         l.side,
      type:         l.type,
      strike:       l.strike,
      lots:         l.lots,
      entryPremium: l.entryPremium,
      exitPremium:  l.currentPremium,
      pnl:          +((l.side === 'SELL' ? 1 : -1) * (l.entryPremium - l.currentPremium) * l.lots * lotSize).toFixed(2),
    })),
    totalPnl,
    exitReason,
  };
}

module.exports = new BacktestService();
