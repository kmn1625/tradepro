'use strict';

const backtestService = require('./backtest.service');

describe('BacktestService.run()', () => {
  test('requires a date range', async () => {
    await expect(backtestService.run({})).rejects.toThrow('dateRange.from and dateRange.to required');
  });
});

describe('BacktestService.computeMetrics()', () => {
  test('empty array returns zeroed metrics', () => {
    expect(backtestService.computeMetrics([])).toEqual({
      totalPnl: 0, winRate: 0, maxDrawdown: 0, sharpe: 0, profitFactor: 0, tradeCount: 0,
    });
  });

  test('null returns zeroed metrics', () => {
    expect(backtestService.computeMetrics(null)).toEqual({
      totalPnl: 0, winRate: 0, maxDrawdown: 0, sharpe: 0, profitFactor: 0, tradeCount: 0,
    });
  });

  test('totalPnl sums wins and losses', () => {
    const trades = [
      { side: 'BUY', entryPrice: 100, exitPrice: 110, qty: 1 },
      { side: 'BUY', entryPrice: 100, exitPrice: 90,  qty: 1 },
    ];
    expect(backtestService.computeMetrics(trades).totalPnl).toBe(0);
  });

  test('winRate is percentage of profitable trades', () => {
    const trades = [
      { side: 'BUY', entryPrice: 100, exitPrice: 110, qty: 1 },
      { side: 'BUY', entryPrice: 100, exitPrice: 90,  qty: 1 },
      { side: 'BUY', entryPrice: 100, exitPrice: 105, qty: 1 },
      { side: 'BUY', entryPrice: 100, exitPrice: 80,  qty: 1 },
    ];
    const result = backtestService.computeMetrics(trades);
    expect(result.winRate).toBe(50.0);
    expect(result.tradeCount).toBe(4);
  });

  test('maxDrawdown is 0 for all-winning equity curve', () => {
    const trades = [
      { side: 'BUY', entryPrice: 100, exitPrice: 110, qty: 1 },
      { side: 'BUY', entryPrice: 100, exitPrice: 120, qty: 1 },
    ];
    expect(backtestService.computeMetrics(trades).maxDrawdown).toBe(0);
  });

  test('SELL trade profits when price drops (short logic)', () => {
    const trades = [
      { side: 'SELL', entryPrice: 100, exitPrice: 90, qty: 1 },
    ];
    const result = backtestService.computeMetrics(trades);
    expect(result.totalPnl).toBe(10);
    expect(result.winRate).toBe(100);
  });

  test('sharpe is 0 when all trades identical (stdDev = 0)', () => {
    const trades = [
      { side: 'BUY', entryPrice: 100, exitPrice: 110, qty: 1 },
      { side: 'BUY', entryPrice: 100, exitPrice: 110, qty: 1 },
    ];
    expect(backtestService.computeMetrics(trades).sharpe).toBe(0);
  });
});
