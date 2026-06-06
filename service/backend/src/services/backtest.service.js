'use strict';

// Backtest engine — time-step loop over historical 1-min OHLC candles.
// Data source: Angel One SmartAPI (getCandleData) or local DuckDB/TimescaleDB store.
// Prerequisite: historical data pipeline must be set up first (Phase 4).

const { SUPPORTED_INDICATORS } = require('../config/conditionSchema');

class BacktestService {

  // Run backtest for a given strategy config against historical data.
  // strategyConfig shape:
  // {
  //   underlying: 'NIFTY' | 'BANKNIFTY',
  //   dateRange: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' },
  //   legs: [{ side: 'BUY'|'SELL', type: 'CE'|'PE', strikeOffset: 0, expiry: 'weekly', lots: 1 }],
  //   entry: <condition node>,
  //   exit:  <condition node>,
  //   sl:    { type: 'pct', value: 30 },
  //   target: { type: 'pct', value: 50 },
  // }
  async run(strategyConfig) {
    // TODO: implement — requires historical candle data in DB
    // Step 1: load candles for date range from Angel One or local DB
    // Step 2: for each trading day, walk minute-by-minute
    // Step 3: evaluate entry condition → open position
    // Step 4: evaluate exit/SL/target → close position
    // Step 5: aggregate metrics (P&L, sharpe, drawdown, win rate)
    throw new Error('Backtest engine not yet implemented — historical data pipeline required first (Phase 4)');
  }

  // Compute performance metrics from array of closed trades.
  // trades: [{ entryPrice, exitPrice, side, qty, entryTime, exitTime }, ...]
  computeMetrics(trades) {
    if (!trades || trades.length === 0) {
      return { totalPnl: 0, winRate: 0, maxDrawdown: 0, sharpe: 0, tradeCount: 0 };
    }

    const pnls = trades.map(t => {
      const dir = t.side === 'BUY' ? 1 : -1;
      return (t.exitPrice - t.entryPrice) * dir * t.qty;
    });

    const totalPnl = pnls.reduce((a, b) => a + b, 0);
    const wins = pnls.filter(p => p > 0).length;
    const winRate = (wins / pnls.length) * 100;

    // Equity curve for drawdown
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    for (const p of pnls) {
      equity += p;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Sharpe ratio (daily, risk-free = 6.5%)
    const mean = totalPnl / pnls.length;
    const variance = pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / pnls.length;
    const stdDev = Math.sqrt(variance);
    const rfDaily = 0.065 / 252;
    const sharpe = stdDev > 0 ? ((mean - rfDaily) / stdDev) * Math.sqrt(252) : 0;

    return {
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      winRate: parseFloat(winRate.toFixed(1)),
      maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
      sharpe: parseFloat(sharpe.toFixed(2)),
      tradeCount: trades.length,
    };
  }
}

module.exports = new BacktestService();
