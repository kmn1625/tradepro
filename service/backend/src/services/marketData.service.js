// marketData.service.js
'use strict';

const NSE_SYMBOLS = [
  { symbol: 'NIFTY 50 (Index)',    type: 'INDEX', basePrice: 22453.20 },
  { symbol: 'BANK NIFTY (Index)', type: 'INDEX', basePrice: 47285.10 },
  { symbol: 'FINNIFTY (Index)',   type: 'INDEX', basePrice: 21800.00 },
  { symbol: 'SENSEX (Index)',     type: 'INDEX', basePrice: 73500.00 },
  { symbol: 'GOLD (MCX)',        type: 'MCX',   basePrice: 62450.00 },
  { symbol: 'CRUDEOIL (MCX)',    type: 'MCX',   basePrice: 6450.00  },
  { symbol: 'SILVER (MCX)',      type: 'MCX',   basePrice: 74500.00 },
  { symbol: 'RELIANCE',         type: 'NSE',   basePrice: 2875.00  },
  { symbol: 'TCS',              type: 'NSE',   basePrice: 3650.00  },
  { symbol: 'HDFCBANK',         type: 'NSE',   basePrice: 1620.00  },
  { symbol: 'ICICIBANK',        type: 'NSE',   basePrice: 1140.00  },
  { symbol: 'INFOSYS',          type: 'NSE',   basePrice: 1465.00  },
  { symbol: 'WIPRO',            type: 'NSE',   basePrice: 480.00   },
  { symbol: 'TATAMOTORS',       type: 'NSE',   basePrice: 800.00   },
  { symbol: 'TATASTEEL',        type: 'NSE',   basePrice: 162.00   },
  { symbol: 'BAJFINANCE',       type: 'NSE',   basePrice: 7200.00  },
  { symbol: 'BAJAJFINSV',      type: 'NSE',   basePrice: 1640.00  },
  { symbol: 'AXISBANK',         type: 'NSE',   basePrice: 1120.00  },
  { symbol: 'KOTAKBANK',        type: 'NSE',   basePrice: 1750.00  },
  { symbol: 'LT',               type: 'NSE',   basePrice: 3480.00  },
  { symbol: 'HCLTECH',          type: 'NSE',   basePrice: 1520.00  },
  { symbol: 'SUNPHARMA',        type: 'NSE',   basePrice: 1685.00  },
  { symbol: 'ADANIENT',         type: 'NSE',   basePrice: 2620.00  },
  { symbol: 'MARUTI',           type: 'NSE',   basePrice: 12400.00 },
  { symbol: 'ASIANPAINT',       type: 'NSE',   basePrice: 2870.00  },
  { symbol: 'HINDUNILVR',       type: 'NSE',   basePrice: 2400.00  },
  { symbol: 'ONGC',             type: 'NSE',   basePrice: 265.00   },
  { symbol: 'NTPC',             type: 'NSE',   basePrice: 355.00   },
  { symbol: 'POWERGRID',        type: 'NSE',   basePrice: 295.00   },
  { symbol: 'SBIN',             type: 'NSE',   basePrice: 810.00   },
  { symbol: 'COALINDIA',        type: 'NSE',   basePrice: 420.00   },
  { symbol: 'ITC',              type: 'NSE',   basePrice: 440.00   },
  { symbol: 'BHARTIARTL',       type: 'NSE',   basePrice: 1380.00  },
  { symbol: 'TITAN',            type: 'NSE',   basePrice: 3620.00  },
  { symbol: 'ULTRACEMCO',       type: 'NSE',   basePrice: 9800.00  },
  { symbol: 'NESTLEIND',        type: 'NSE',   basePrice: 2250.00  },
  { symbol: 'GRASIM',           type: 'NSE',   basePrice: 2680.00  },
  { symbol: 'CIPLA',            type: 'NSE',   basePrice: 1420.00  },
  { symbol: 'DRREDDY',          type: 'NSE',   basePrice: 6200.00  },
  { symbol: 'DIVISLAB',         type: 'NSE',   basePrice: 4900.00  },
  { symbol: 'TECHM',            type: 'NSE',   basePrice: 1340.00  },
  { symbol: 'HINDALCO',         type: 'NSE',   basePrice: 640.00   },
  { symbol: 'JSWSTEEL',         type: 'NSE',   basePrice: 860.00   },
  { symbol: 'M&M',              type: 'NSE',   basePrice: 2050.00  },
  { symbol: 'EICHERMOT',        type: 'NSE',   basePrice: 4600.00  },
  { symbol: 'BAJAJ-AUTO',       type: 'NSE',   basePrice: 9200.00  },
  { symbol: 'HEROMOTOCO',       type: 'NSE',   basePrice: 4900.00  },
  { symbol: 'INDUSINDBK',       type: 'NSE',   basePrice: 960.00   },
];

class MarketDataService {
  constructor() {
    this.candles = {};
    this.partialCandle = {};
    this.lastPrice = {};
    this._emaCache = new Map();
    this.dayStats = {};
    this._symbolMeta = {};
    this._initSymbols();
  }

  _initSymbols() {
    for (const s of NSE_SYMBOLS) {
      this._symbolMeta[s.symbol] = { type: s.type, basePrice: s.basePrice };
      this.lastPrice[s.symbol] = s.basePrice;
      this._initDayStats(s.symbol, s.basePrice, s.type);
    }
  }

  _initDayStats(symbol, price, type = 'NSE') {
    const circuitPct = type === 'INDEX' ? 0.05 : 0.20;
    this.dayStats[symbol] = {
      open: price,
      high: parseFloat((price * 1.005).toFixed(2)),
      low: parseFloat((price * 0.995).toFixed(2)),
      volume: Math.floor(Math.random() * 5000000) + 100000,
      prevClose: parseFloat((price * 0.998).toFixed(2)),
      weekHigh52: parseFloat((price * 1.18).toFixed(2)),
      weekLow52: parseFloat((price * 0.72).toFixed(2)),
      circuitUpper: parseFloat((price * (1 + circuitPct)).toFixed(2)),
      circuitLower: parseFloat((price * (1 - circuitPct)).toFixed(2)),
    };
  }

  addSymbol(symbol, basePrice, type = 'NSE') {
    if (this.lastPrice[symbol] !== undefined) return;
    const p = parseFloat(basePrice) || 1000;
    this._symbolMeta[symbol] = { type, basePrice: p };
    this.lastPrice[symbol] = p;
    this._initDayStats(symbol, p, type);
  }

  processTick(symbol, price, time = Date.now(), volIncrement = 0) {
    const minuteTs = Math.floor(time / 60000) * 60000;
    const fiveMinTs = Math.floor(time / 300000) * 300000;

    this.lastPrice[symbol] = price;

    if (!this.dayStats[symbol]) this._initDayStats(symbol, price);
    const ds = this.dayStats[symbol];
    if (price > ds.high) ds.high = price;
    if (price < ds.low) ds.low = price;
    ds.volume += volIncrement;
    if (price > ds.weekHigh52) ds.weekHigh52 = parseFloat(price.toFixed(2));
    if (price < ds.weekLow52) ds.weekLow52 = parseFloat(price.toFixed(2));

    for (const [interval, ts] of [['1m', minuteTs], ['5m', fiveMinTs]]) {
      if (!this.candles[symbol]) this.candles[symbol] = { '1m': [], '5m': [] };
      if (!this.partialCandle[symbol]) this.partialCandle[symbol] = {};

      const partial = this.partialCandle[symbol][interval];
      if (!partial || partial.time !== ts) {
        if (partial) {
          this.candles[symbol][interval].push({ ...partial });
          if (this.candles[symbol][interval].length > 500) this.candles[symbol][interval].shift();
        }
        this.partialCandle[symbol][interval] = { time: ts, open: price, high: price, low: price, close: price };
      } else {
        if (price > partial.high) partial.high = price;
        if (price < partial.low) partial.low = price;
        partial.close = price;
      }
    }
  }

  getBidAsk(symbol) {
    const price = this.lastPrice[symbol] || 0;
    if (!price) return { bid: 0, ask: 0 };
    const halfSpread = price * 0.00015;
    return {
      bid: parseFloat((price - halfSpread).toFixed(2)),
      ask: parseFloat((price + halfSpread).toFixed(2)),
    };
  }

  getMarketDepth(symbol) {
    const price = this.lastPrice[symbol] || 0;
    const halfSpread = price * 0.00015;
    const tick = price > 100 ? 0.05 : 0.01;
    const bids = [];
    const asks = [];
    for (let i = 1; i <= 5; i++) {
      bids.push({
        price: parseFloat((price - halfSpread - (i - 1) * tick).toFixed(2)),
        qty: Math.floor(Math.random() * 800) + 50,
        orders: Math.floor(Math.random() * 15) + 1,
      });
      asks.push({
        price: parseFloat((price + halfSpread + (i - 1) * tick).toFixed(2)),
        qty: Math.floor(Math.random() * 800) + 50,
        orders: Math.floor(Math.random() * 15) + 1,
      });
    }
    return { symbol, bids, asks, timestamp: new Date().toISOString() };
  }

  searchSymbols(query) {
    if (!query || query.length < 1) return [];
    const q = query.toUpperCase().trim();
    return NSE_SYMBOLS
      .filter(s => s.symbol.toUpperCase().includes(q))
      .slice(0, 20)
      .map(s => ({ ...s, price: this.lastPrice[s.symbol] || s.basePrice }));
  }

  getCandles(symbol, interval = '5m', limit = 100) {
    const sym = this._normalizeSymbol(symbol);
    const sealed = (this.candles[sym]?.[interval] || []).slice(-limit);
    const partial = this.partialCandle[sym]?.[interval];
    const real = partial ? [...sealed, { ...partial }] : sealed;

    if (real.length >= limit) return real;

    const needed = limit - real.length;
    const firstRealTime = real.length > 0
      ? (real[0].time > 1e10 ? real[0].time : real[0].time * 1000)
      : Date.now();
    const intervalMs = interval === '1m' ? 60000 : 300000;
    const mock = this._generateHistoricalMock(sym, interval, needed, firstRealTime - intervalMs);

    const combined = [...mock, ...real];
    const seen = new Set();
    return combined.filter(c => {
      const t = c.time > 1e10 ? c.time : c.time * 1000;
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    }).sort((a, b) => {
      const at = a.time > 1e10 ? a.time : a.time * 1000;
      const bt = b.time > 1e10 ? b.time : b.time * 1000;
      return at - bt;
    });
  }

  async getLiveQuotes(symbols) {
    try {
      const syms = symbols || Object.keys(this.lastPrice);
      const data = syms.map(s => {
        const sym = this._normalizeSymbol(s);
        const price = this.lastPrice[sym] || 0;
        const ds = this.dayStats[sym] || {};
        const { bid, ask } = this.getBidAsk(sym);
        const prevClose = ds.prevClose || price;
        const change = parseFloat((price - prevClose).toFixed(2));
        const changePct = prevClose ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;
        return {
          symbol: sym,
          price,
          bid,
          ask,
          open: ds.open || price,
          high: ds.high || price,
          low: ds.low || price,
          volume: ds.volume || 0,
          prevClose,
          change,
          changePct,
          weekHigh52: ds.weekHigh52 || price,
          weekLow52: ds.weekLow52 || price,
          circuitUpper: ds.circuitUpper || null,
          circuitLower: ds.circuitLower || null,
          timestamp: new Date().toISOString(),
        };
      });
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getHistoricalData(symbol, interval = '5m', limit = 100) {
    try {
      const sym = this._normalizeSymbol(symbol);
      const data = this.getCandles(sym, interval, limit);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  calculateIndicator(candles, indicator, period = 14) {
    if (!candles || candles.length === 0) {
      return { indicator, current: null, signal: 'NEUTRAL' };
    }
    const closes = candles.map(c => c.close);
    switch (indicator.toUpperCase()) {
      case 'RSI':        return this._rsi(closes, period);
      case 'MACD':       return this._macd(closes);
      case 'SMA':        return this._sma(closes, period);
      case 'EMA':        return this._ema(closes, period);
      case 'BB':         return this._bb(closes, period || 20);
      case 'ATR':        return this._atr(candles, period);
      case 'VWAP':       return this._vwap(candles, period || 20);
      case 'SUPERTREND': return this._supertrend(candles, period || 7);
      default:           return { indicator, current: null, signal: 'NEUTRAL' };
    }
  }

  _normalizeSymbol(sym) {
    if (!sym) return 'NIFTY 50 (Index)';
    const s = sym.toUpperCase();
    const exact = Object.keys(this.lastPrice).find(k => k.toUpperCase() === s);
    if (exact) return exact;
    if (s.includes('BANK') && s.includes('NIFTY')) return 'BANK NIFTY (Index)';
    if (s.includes('NIFTY')) return 'NIFTY 50 (Index)';
    if (s.includes('GOLD')) return 'GOLD (MCX)';
    if (s.includes('CRUDE')) return 'CRUDEOIL (MCX)';
    return sym;
  }

  _generateHistoricalMock(symbol, interval, limit, endTimeMs = Date.now()) {
    const basePrice = this.lastPrice[symbol] || 22000;
    const intervalMs = interval === '1m' ? 60000 : 300000;
    const candles = [];
    let price = basePrice * 0.97;
    for (let i = limit; i >= 0; i--) {
      const tsMs = endTimeMs - i * intervalMs;
      const move = (Math.random() - 0.48) * basePrice * 0.002;
      const open = price;
      const close = price + move;
      const high = Math.max(open, close) + Math.random() * basePrice * 0.001;
      const low = Math.min(open, close) - Math.random() * basePrice * 0.001;
      candles.push({ time: tsMs, open, high, low, close });
      price = close;
    }
    return candles;
  }

  _sma(closes, period) {
    if (closes.length < period) return { current: null, signal: 'NEUTRAL' };
    const slice = closes.slice(-period);
    const current = slice.reduce((a, b) => a + b, 0) / period;
    return { indicator: 'SMA', period, current, signal: 'NEUTRAL' };
  }

  _ema(closes, period) {
    if (closes.length < period) return { current: null, signal: 'NEUTRAL' };
    const cacheKey = `${period}:${closes.length}:${closes[closes.length - 1]}`;
    if (this._emaCache.has(cacheKey)) return this._emaCache.get(cacheKey);
    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    const result = { indicator: 'EMA', period, current: ema, signal: 'NEUTRAL' };
    if (this._emaCache.size > 500) this._emaCache.clear();
    this._emaCache.set(cacheKey, result);
    return result;
  }

  _rsi(closes, period = 14) {
    if (closes.length < period + 1) return { current: 50, signal: 'NEUTRAL' };
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    const current = 100 - 100 / (1 + rs);
    const signal = current < 30 ? 'OVERSOLD' : current > 70 ? 'OVERBOUGHT' : 'NEUTRAL';
    return { indicator: 'RSI', period, current, signal };
  }

  _macd(closes) {
    const ema12 = this._ema(closes, 12).current;
    const ema26 = this._ema(closes, 26).current;
    if (ema12 === null || ema26 === null) return { current: null, signal: 'NEUTRAL' };
    const current = ema12 - ema26;
    const signal = current > 0 ? 'BULLISH' : 'BEARISH';
    return { indicator: 'MACD', current, ema12, ema26, signal };
  }

  _bb(closes, period = 20, stdDevMult = 2) {
    if (closes.length < period) return { indicator: 'BB', upper: null, middle: null, lower: null, current: null, signal: 'NEUTRAL' };
    const slice = closes.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    const upper  = parseFloat((mean + stdDevMult * sd).toFixed(2));
    const lower  = parseFloat((mean - stdDevMult * sd).toFixed(2));
    const current = closes[closes.length - 1];
    const signal = current > upper ? 'OVERBOUGHT' : current < lower ? 'OVERSOLD' : 'NEUTRAL';
    return { indicator: 'BB', period, upper, middle: parseFloat(mean.toFixed(2)), lower, current, signal };
  }

  _atr(candles, period = 14) {
    if (candles.length < period + 1) return { indicator: 'ATR', period, current: null, signal: 'NEUTRAL' };
    const trs = [];
    for (let i = 1; i < candles.length; i++) {
      const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
      trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    const current = parseFloat((trs.slice(-period).reduce((a, b) => a + b, 0) / period).toFixed(2));
    return { indicator: 'ATR', period, current, signal: 'NEUTRAL' };
  }

  // Approximate VWAP: SMA of typical price (H+L+C)/3 — true VWAP needs tick-level volume
  _vwap(candles, period = 20) {
    const slice = candles.slice(-Math.min(period, candles.length));
    if (!slice.length) return { indicator: 'VWAP', current: null, signal: 'NEUTRAL' };
    const typical = slice.map(c => (c.high + c.low + c.close) / 3);
    const current = parseFloat((typical.reduce((a, b) => a + b, 0) / typical.length).toFixed(2));
    const last = candles[candles.length - 1].close;
    return { indicator: 'VWAP', period, current, signal: last > current ? 'BULLISH' : 'BEARISH' };
  }

  _supertrend(candles, period = 7, multiplier = 3) {
    if (candles.length < period + 1) return { indicator: 'SUPERTREND', current: null, trend: null, signal: 'NEUTRAL' };
    const atrRes = this._atr(candles, period);
    if (!atrRes.current) return { indicator: 'SUPERTREND', current: null, trend: null, signal: 'NEUTRAL' };
    const atr = atrRes.current;

    // Stateful Supertrend: track band crossings over candle history
    let trend = 1; // 1 = bullish, -1 = bearish
    let prevUpperBand = 0, prevLowerBand = 0;

    for (let i = period; i < candles.length; i++) {
      const hl2 = (candles[i].high + candles[i].low) / 2;
      let upper = hl2 + multiplier * atr;
      let lower = hl2 - multiplier * atr;
      // Bands tighten toward price, never widen
      if (prevUpperBand) upper = (upper < prevUpperBand || candles[i - 1].close > prevUpperBand) ? upper : prevUpperBand;
      if (prevLowerBand) lower = (lower > prevLowerBand || candles[i - 1].close < prevLowerBand) ? lower : prevLowerBand;
      trend = trend === 1 ? (candles[i].close < lower ? -1 : 1) : (candles[i].close > upper ? 1 : -1);
      prevUpperBand = upper;
      prevLowerBand = lower;
    }

    const trendStr = trend === 1 ? 'BULLISH' : 'BEARISH';
    return {
      indicator: 'SUPERTREND', period, multiplier,
      upperBand: parseFloat(prevUpperBand.toFixed(2)),
      lowerBand: parseFloat(prevLowerBand.toFixed(2)),
      current: trend === 1 ? parseFloat(prevLowerBand.toFixed(2)) : parseFloat(prevUpperBand.toFixed(2)),
      trend: trendStr, signal: trendStr,
    };
  }
}

module.exports = new MarketDataService();
