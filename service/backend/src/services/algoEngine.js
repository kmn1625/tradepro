'use strict';

const marketDataService = require('./marketData.service');
const { evaluate }      = require('./conditionEvaluator');
const store             = require('./persistenceStore.service');

const NS = 'algo_state';

// Map short names to marketData.service symbol keys
const SYMBOL_MAP = {
  NIFTY:     'NIFTY 50 (Index)',
  BANKNIFTY: 'BANK NIFTY (Index)',
  FINNIFTY:  'FINNIFTY (Index)',
};

// Algo execution engine. State persists across restarts via file-backed store.
class AlgoEngine {
  constructor() {
    this._strategies = new Map();
    this._loadFromDisk();
  }

  _loadFromDisk() {
    try {
      const saved = store.getAll(NS);
      for (const [token, state] of Object.entries(saved)) {
        // Restore state but clear logs (stale after restart)
        this._strategies.set(token, { ...state, logs: [] });
      }
      if (this._strategies.size > 0)
        console.log(`[AlgoEngine] restored ${this._strategies.size} algo(s) from disk`);
    } catch (err) {
      console.warn('[AlgoEngine] disk restore failed:', err.message);
    }
  }

  _persist() {
    const snapshot = {};
    for (const [token, state] of this._strategies) {
      snapshot[token] = {
        condition: state.condition,
        symbol:    state.symbol,
        interval:  state.interval,
        isActive:  state.isActive,
        position:  state.position,
        trades:    state.trades,
        pnl:       state.pnl,
        logs:      state.logs.slice(-20),
      };
    }
    store.setAll(NS, snapshot);
  }

  // Attach a condition to a strategy token (or create entry for new token)
  attach(token, { condition, symbol = 'NIFTY', interval = '5m' }) {
    const normalizedSym = SYMBOL_MAP[symbol] || symbol;
    this._strategies.set(token, {
      condition,
      symbol:   normalizedSym,
      interval,
      isActive: true,
      position: null,
      trades:   0,
      pnl:      0,
      logs:     [],
    });
    this._persist();
    console.log(`[AlgoEngine] attached ${token.slice(0, 8)} on ${normalizedSym} (${interval})`);
  }

  detach(token) {
    this._strategies.delete(token);
    this._persist();
    console.log(`[AlgoEngine] detached ${token.slice(0, 8)}`);
  }

  setActive(token, isActive) {
    const s = this._strategies.get(token);
    if (s) { s.isActive = Boolean(isActive); this._persist(); }
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
            this._persist();
          }
        }
      } catch (err) {
        console.warn(`[AlgoEngine] eval error for ${token.slice(0, 8)}:`, err.message);
      }
    }
  }
}

module.exports = new AlgoEngine();
