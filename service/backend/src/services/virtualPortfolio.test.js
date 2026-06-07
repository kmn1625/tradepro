'use strict';

const { VirtualPortfolio } = require('./virtualPortfolio.service');

describe('VirtualPortfolio', () => {
  test('fresh portfolio has no positions', () => {
    const p = new VirtualPortfolio(100000);
    expect(p.getPositions()).toEqual([]);
  });

  describe('buy()', () => {
    test('fills at price * (1 + slippage)', () => {
      const p = new VirtualPortfolio(500000);
      const trade = p.buy('NIFTY 50', 10, 22000, 0.001);
      expect(trade.fillPrice).toBe(22022.00);
    });

    test('deducts exact cost from availableCapital', () => {
      const p = new VirtualPortfolio(500000);
      p.buy('NIFTY 50', 10, 22000, 0.001);
      expect(p.availableCapital).toBe(500000 - 22022 * 10);
    });

    test('throws Insufficient capital when cost exceeds balance', () => {
      const p = new VirtualPortfolio(500000);
      p.buy('NIFTY 50', 10, 22000, 0.001);
      expect(() => p.buy('NIFTY 50', 100000, 22000, 0)).toThrow('Insufficient capital');
    });
  });

  describe('sell()', () => {
    test('returns realizedPnl on sell', () => {
      const p = new VirtualPortfolio(500000);
      p.buy('NIFTY 50', 10, 22000, 0.001);
      const trade = p.sell('NIFTY 50', 10, 22100, 0.001);
      expect(trade.realizedPnl).toBeDefined();
    });

    test('clears position after full sell', () => {
      const p = new VirtualPortfolio(500000);
      p.buy('NIFTY 50', 10, 22000, 0.001);
      p.sell('NIFTY 50', 10, 22100, 0.001);
      expect(p.getPositions()).toHaveLength(0);
    });

    test('reduces qty on partial sell', () => {
      const p = new VirtualPortfolio(200000);
      p.buy('BANK NIFTY', 4, 47000, 0.001);
      p.sell('BANK NIFTY', 2, 47200, 0.001);
      const positions = p.getPositions();
      expect(positions).toHaveLength(1);
      expect(positions[0].qty).toBe(2);
    });

    test('throws Insufficient position on oversell', () => {
      const p = new VirtualPortfolio(500000);
      p.buy('NIFTY 50', 10, 22000, 0.001);
      p.sell('NIFTY 50', 10, 22100, 0.001);
      expect(() => p.sell('NIFTY 50', 1, 22000, 0)).toThrow('Insufficient position');
    });
  });

  describe('getPnL()', () => {
    test('returns positive unrealized when price rises above fill', () => {
      const p = new VirtualPortfolio(500000);
      p.buy('NIFTY 50', 10, 22000, 0.001);
      const pnl = p.getPnL({ 'NIFTY 50': 22100 });
      expect(pnl.unrealized).toBeGreaterThan(0);
    });

    test('returns realized, unrealized, total, capital fields', () => {
      const p = new VirtualPortfolio(500000);
      const pnl = p.getPnL({});
      expect(typeof pnl.realized).toBe('number');
      expect(typeof pnl.unrealized).toBe('number');
      expect(typeof pnl.total).toBe('number');
      expect(pnl.capital).toBe(500000);
    });
  });

  describe('getTrades()', () => {
    test('length grows per trade', () => {
      const p = new VirtualPortfolio(500000);
      p.buy('NIFTY 50', 10, 22000, 0.001);
      p.sell('NIFTY 50', 10, 22100, 0.001);
      expect(p.getTrades()).toHaveLength(2);
    });
  });
});
