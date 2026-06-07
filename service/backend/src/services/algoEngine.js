'use strict';

const marketDataService = require('./marketData.service');
const { evaluate } = require('./conditionEvaluator');

// Map short names to marketData.service symbol keys
const SYMBOL_MAP = {
  NIFTY:     'NIFTY 50 (Index)',
  BANKNIFTY: 'BANK NIFTY (Index)',
  FINNIFTY:  'FINNIFTY (Index)',
};

// In-memory algo execution engine. Resets on restart — paper trading only.
// Receives ticks from kotakFeed, evaluates condition trees, fires virtual entries/exits.
class AlgoEngine {
  constructor() {
    // Map<token, AlgoState>
    this._strategies = new Map();
  }

  // Attach a condition to a strategy token (or create entry for new token)
  attach(token, { condition, symbol = 'NIFTY', interval = '5m' }) {
    const normalizedSym = SYMBOL_MAP[symbol] || symbol;
    this._strategies.set(token, {
      condition,
      symbol:   normalizedSym,
      interval,
      isActive: true,
      position: null,   // { entryPrice, entryTime }
      trades:   0,
      pnl:      0,
      logs:     [],
    });
    console.log(`[AlgoEngine] attached ${token.slice(0, 8)} on ${normalizedSym} (${interval})`);
  }

  detach(token) {
    this._strategies.delete(token);
    console.log(`[AlgoEngine] detached ${token.slice(0, 8)}`);
  }

  setActive(token, isActive) {
    const s = this._strategies.get(token);
    if (s) s.isActive = Boolean(isActive);
  }

  isAttached(token) {
    return this._strategies.has(token);
  }

  getStatus(token) {
    const s = this._strategies.get(token);
    if (!s) return null;
    return {
      token,
      symbol:   s.symbol,
      interval: s.interval,
      isActive: s.isActive,
      position: s.position,
      trades:   s.trades,
      pnl:      parseFloat(s.pnl.toFixed(2)),
      logs:     s.logs.slice(-20),
    };
  }

  listAll() {
    return Array.from(this._strategies.entries()).map(([token, s]) => ({
      token,
      symbol:   s.symbol,
      interval: s.interval,
      isActive: s.isActive,
      trades:   s.trades,
      pnl:      parseFloat(s.pnl.toFixed(2)),
      hasPosition: !!s.position,
    }));
  }

  // Called from kotakFeed on every price tick (both real Kotak and mock feed).
  onTick(symbol, price, time = Date.now()) {
    for (const [token, state] of this._strategies) {
      if (!state.isActive || state.symbol !== symbol) continue;

      const candles = marketDataService.getCandles(symbol, state.interval, 100);
      if (!candles || candles.length < 5) continue;

      const ctx = { currentPrice: price, time };

      try {
        if (!state.position) {
          // Evaluate entry condition
          if (evaluate(state.condition.entry, candles, ctx)) {
            state.position = { entryPrice: price, entryTime: time };
            const msg = `ENTRY ₹${price} @ ${new Date(time).toLocaleTimeString('en-IN')}`;
            state.logs.push(msg);
            if (state.logs.length > 50) state.logs.shift();
            console.log(`[AlgoEngine] ${token.slice(0, 8)} ${msg}`);
          }
        } else {
          // Evaluate exit condition
          ctx.entryPrice = state.position.entryPrice;
          if (evaluate(state.condition.exit, candles, ctx)) {
            const legPnl = price - state.position.entryPrice;
            state.pnl    += legPnl;
            state.trades += 1;
            const msg = `EXIT ₹${price} P&L ₹${legPnl.toFixed(2)} @ ${new Date(time).toLocaleTimeString('en-IN')}`;
            state.logs.push(msg);
            if (state.logs.length > 50) state.logs.shift();
            console.log(`[AlgoEngine] ${token.slice(0, 8)} ${msg}`);
            state.position = null;
          }
        }
      } catch (err) {
        console.warn(`[AlgoEngine] eval error for ${token.slice(0, 8)}:`, err.message);
      }
    }
  }
}

module.exports = new AlgoEngine();
