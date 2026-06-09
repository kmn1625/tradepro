'use strict';

// Integration tests: signals paper flow, backtest run, order lifecycle, persistence.
// These run against real service modules with no mocks (except network/broker calls).

const { VirtualPortfolio } = require('./virtualPortfolio.service');
const backtestService       = require('./backtest.service');
const persistenceStore      = require('./persistenceStore.service');
const path                  = require('path');
const fs                    = require('fs');

// ─── VirtualPortfolio + PersistenceStore round-trip ──────────────────────────

describe('PersistenceStore', () => {
  const NS = 'test_integration_ns';

  afterEach(() => {
    const fp = path.join(__dirname, '../../../data/store', `${NS}.json`);
    try { fs.unlinkSync(fp); } catch { /* ok */ }
  });

  test('set → get round-trips value', () => {
    persistenceStore.set(NS, 'k1', { foo: 42 });
    expect(persistenceStore.get(NS, 'k1')).toEqual({ foo: 42 });
  });

  test('missing key returns null', () => {
    expect(persistenceStore.get(NS, 'nonexistent')).toBeNull();
  });

  test('setAll / getAll round-trips full namespace', () => {
    persistenceStore.setAll(NS, { a: 1, b: 2 });
    expect(persistenceStore.getAll(NS)).toEqual({ a: 1, b: 2 });
  });

  test('delete removes key', () => {
    persistenceStore.set(NS, 'del', 'value');
    persistenceStore.delete(NS, 'del');
    expect(persistenceStore.get(NS, 'del')).toBeNull();
  });

  test('append builds log array', () => {
    persistenceStore.append(NS, { event: 'buy', symbol: 'RELIANCE' });
    persistenceStore.append(NS, { event: 'sell', symbol: 'RELIANCE' });
    const log = persistenceStore.readLog(NS);
    expect(log.length).toBe(2);
    expect(log[0].event).toBe('buy');
    expect(log[1].event).toBe('sell');
  });

  test('append trims to maxEntries', () => {
    for (let i = 0; i < 5; i++) persistenceStore.append(NS, { i }, 3);
    expect(persistenceStore.readLog(NS).length).toBe(3);
  });
});

// ─── Paper trading portfolio persistence ─────────────────────────────────────

describe('VirtualPortfolio persistence round-trip', () => {
  test('state serializes + restores across new instance', () => {
    const vp1 = new VirtualPortfolio(100000);
    vp1.buy('NIFTY', 50, 200, 0.001);

    const snapshot = {
      initialCapital:   vp1.initialCapital,
      availableCapital: vp1.availableCapital,
      positions:        Object.fromEntries(vp1._positions),
      trades:           vp1._trades,
      tradeCounter:     vp1._tradeCounter,
    };

    // Simulate restore
    const vp2 = new VirtualPortfolio(snapshot.initialCapital);
    vp2.availableCapital = snapshot.availableCapital;
    vp2._positions       = new Map(Object.entries(snapshot.positions));
    vp2._trades          = snapshot.trades;
    vp2._tradeCounter    = snapshot.tradeCounter;

    expect(vp2.availableCapital).toBe(vp1.availableCapital);
    expect(vp2._positions.get('NIFTY').qty).toBe(50);
    expect(vp2._trades.length).toBe(1);
  });
});

// ─── Backtest integration ─────────────────────────────────────────────────────

describe('BacktestService.run() integration', () => {
  test('returns trades + metrics for single-day mock run', async () => {
    const result = await backtestService.run({
      underlying: 'NIFTY',
      dateRange:  { from: '2025-01-02', to: '2025-01-02' },
      legs: [
        { side: 'SELL', type: 'CE', strikeOffset: 0, lots: 1 },
        { side: 'SELL', type: 'PE', strikeOffset: 0, lots: 1 },
      ],
      sl:     { type: 'pct', value: 50 },
      target: { type: 'pct', value: 50 },
    });

    expect(result).toHaveProperty('trades');
    expect(result).toHaveProperty('equityCurve');
    expect(result).toHaveProperty('dataSource');
    expect(result).toHaveProperty('totalPnl');
    expect(result).toHaveProperty('winRate');
    expect(result).toHaveProperty('tradeCount');
    expect(Array.isArray(result.trades)).toBe(true);
  }, 60000);

  test('trailing SL config accepted without error', async () => {
    const result = await backtestService.run({
      underlying:  'BANKNIFTY',
      dateRange:   { from: '2025-01-02', to: '2025-01-02' },
      legs:        [{ side: 'SELL', type: 'CE', strikeOffset: 0, lots: 1 }],
      sl:          { type: 'pct', value: 40 },
      trailingSl:  { type: 'pct', value: 20 },
    });
    expect(result).toHaveProperty('trades');
  }, 60000);

  test('single-leg BUY backtest completes without error', async () => {
    const result = await backtestService.run({
      underlying: 'FINNIFTY',
      dateRange:  { from: '2025-01-06', to: '2025-01-06' },
      legs:       [{ side: 'BUY', type: 'CE', strikeOffset: 2, lots: 1 }],
    });
    expect(result.dataSource).toMatch(/^(mock-gbm|duckdb)/);
  }, 60000);

  test('heatmap contains byDow and byMonth', async () => {
    const result = await backtestService.run({
      underlying: 'NIFTY',
      dateRange:  { from: '2025-01-02', to: '2025-01-10' },
      legs:       [{ side: 'SELL', type: 'CE', strikeOffset: 0, lots: 1 }],
    });
    expect(result.heatmap).toHaveProperty('byDow');
    expect(result.heatmap).toHaveProperty('byMonth');
  }, 60000);
});

// ─── Paper trading signal flow ────────────────────────────────────────────────

describe('Paper trading signal flow', () => {
  test('buy then sell produces correct realized PnL', () => {
    const vp = new VirtualPortfolio(500000);
    const buy  = vp.buy ('RELIANCE', 10, 2800, 0.001);
    const sell = vp.sell('RELIANCE', 10, 2900, 0.001);

    expect(buy.fillPrice).toBeCloseTo(2800 * 1.001, 2);
    expect(sell.realizedPnl).toBeGreaterThan(0);
    expect(vp._positions.size).toBe(0);
  });

  test('oversell throws InsufficientPosition', () => {
    const vp = new VirtualPortfolio(500000);
    vp.buy('TCS', 5, 3500, 0.001);
    expect(() => vp.sell('TCS', 10, 3600, 0.001)).toThrow('Insufficient position');
  });

  test('buy beyond capital throws InsufficientCapital', () => {
    const vp = new VirtualPortfolio(10000);
    expect(() => vp.buy('HDFC', 100, 1500, 0.001)).toThrow('Insufficient capital');
  });

  test('portfolio summary reflects current positions', () => {
    const vp = new VirtualPortfolio(1000000);
    vp.buy('NIFTY', 5, 24000, 0.001);   // cost ~120k, within 1M capital
    const summary = vp.getSummary({ 'NIFTY': 24500 });
    expect(summary).toHaveProperty('positions');
    expect(summary).toHaveProperty('availableCapital');
  });
});

// ─── Order safety gate (unit) ─────────────────────────────────────────────────

describe('Market order confirmLive gate', () => {
  let mockReq, mockRes, statusCode, responseBody;

  beforeEach(() => {
    statusCode = null;
    responseBody = null;
    mockRes = {
      status: (code) => { statusCode = code; return mockRes; },
      json:   (body) => { responseBody = body; return mockRes; },
    };
  });

  test('placeOrder without confirmLive returns 428 when Kotak authenticated', async () => {
    // Mock session as authenticated
    const kotakSession = require('../brokers/kotak/session');
    const origAuth = kotakSession.isAuthenticated;
    kotakSession.isAuthenticated = () => true;
    kotakSession.getSession = () => ({ accessToken: 'test_token' });

    const ctrl = require('../controllers/market.controller');
    mockReq = { body: { symbol: 'NIFTY', side: 'SELL', type: 'CE', strike: 24000, lots: 1 } };

    await ctrl.placeOrder(mockReq, mockRes);

    expect(statusCode).toBe(428);
    expect(responseBody.status).toBe('confirmation_required');
    expect(responseBody.preview.tradingSymbol).toContain('NIFTY');

    kotakSession.isAuthenticated = origAuth;
  });
});
