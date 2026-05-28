'use strict';

/**
 * VirtualPortfolio — paper trading engine.
 *
 * Fills buy orders at price * (1 + slippage) and sell orders at price * (1 - slippage).
 * Tracks positions using weighted-average cost basis (FIFO avg cost).
 * Maintains a full chronological trade log.
 */
class VirtualPortfolio {
  /**
   * @param {number} initialCapital - Starting paper capital (default: 10 lakh)
   */
  constructor(initialCapital = 1000000) {
    this.initialCapital = initialCapital;
    this.availableCapital = initialCapital;
    // positions: Map<symbol, { qty: number, totalCost: number }>
    // totalCost = sum of all fillPrice * qty bought (for weighted avg cost)
    this._positions = new Map();
    // trades: chronological log of all fills
    this._trades = [];
    this._tradeCounter = 0;
  }

  /**
   * Buy symbol at price with slippage applied upward.
   *
   * @param {string} symbol
   * @param {number} qty - Must be positive
   * @param {number} price - LTP / reference price
   * @param {number} slippage - Fraction (e.g. 0.001 = 0.1%). Default 0.001
   * @returns {object} Trade record
   */
  buy(symbol, qty, price, slippage = 0.001) {
    if (qty <= 0) throw new Error('qty must be positive');

    const fillPrice = parseFloat((price * (1 + slippage)).toFixed(2));
    const cost = fillPrice * qty;

    if (cost > this.availableCapital) {
      throw new Error(
        'Insufficient capital: need ' + cost.toFixed(2) +
        ', have ' + this.availableCapital.toFixed(2)
      );
    }

    this.availableCapital -= cost;

    if (!this._positions.has(symbol)) {
      this._positions.set(symbol, { qty: 0, totalCost: 0 });
    }
    const pos = this._positions.get(symbol);
    pos.qty += qty;
    pos.totalCost += cost;

    const trade = {
      id: ++this._tradeCounter,
      symbol,
      side: 'BUY',
      qty,
      fillPrice,
      slippage,
      cost,
      timestamp: Date.now(),
    };
    this._trades.push(trade);
    return trade;
  }

  /**
   * Sell symbol at price with slippage applied downward.
   *
   * @param {string} symbol
   * @param {number} qty - Must be positive and <= held qty
   * @param {number} price - LTP / reference price
   * @param {number} slippage - Fraction (e.g. 0.001 = 0.1%). Default 0.001
   * @returns {object} Trade record including realizedPnl
   */
  sell(symbol, qty, price, slippage = 0.001) {
    if (qty <= 0) throw new Error('qty must be positive');

    const pos = this._positions.get(symbol);
    if (!pos || pos.qty < qty) {
      throw new Error(
        'Insufficient position: held ' + (pos ? pos.qty : 0) +
        ', attempting to sell ' + qty
      );
    }

    const fillPrice = parseFloat((price * (1 - slippage)).toFixed(2));
    const avgCost = pos.totalCost / pos.qty;
    const realizedPnl = parseFloat(((fillPrice - avgCost) * qty).toFixed(2));
    const proceeds = fillPrice * qty;

    this.availableCapital += proceeds;

    pos.qty -= qty;
    pos.totalCost -= avgCost * qty;

    if (pos.qty === 0) {
      this._positions.delete(symbol);
    }

    const trade = {
      id: ++this._tradeCounter,
      symbol,
      side: 'SELL',
      qty,
      fillPrice,
      slippage,
      proceeds,
      realizedPnl,
      timestamp: Date.now(),
    };
    this._trades.push(trade);
    return trade;
  }

  /**
   * Returns open positions as an array (only symbols with qty > 0).
   *
   * @returns {{ symbol: string, qty: number, avgCost: number, totalCost: number }[]}
   */
  getPositions() {
    return Array.from(this._positions.entries()).map(([symbol, pos]) => ({
      symbol,
      qty: pos.qty,
      avgCost: parseFloat((pos.totalCost / pos.qty).toFixed(2)),
      totalCost: parseFloat(pos.totalCost.toFixed(2)),
    }));
  }

  /**
   * Compute realized and unrealized P&L given current market prices.
   *
   * @param {{ [symbol: string]: number }} currentPrices - Map of symbol -> LTP
   * @returns {{ realized: number, unrealized: number, total: number, capital: number, availableCapital: number }}
   */
  getPnL(currentPrices = {}) {
    let unrealized = 0;
    for (const [symbol, pos] of this._positions.entries()) {
      const ltp = currentPrices[symbol];
      if (ltp == null) continue; // skip symbols with no live price
      const avgCost = pos.totalCost / pos.qty;
      unrealized += (ltp - avgCost) * pos.qty;
    }
    unrealized = parseFloat(unrealized.toFixed(2));

    const realized = parseFloat(
      this._trades
        .filter(t => t.side === 'SELL')
        .reduce((sum, t) => sum + (t.realizedPnl || 0), 0)
        .toFixed(2)
    );

    return {
      realized,
      unrealized,
      total: parseFloat((realized + unrealized).toFixed(2)),
      capital: this.initialCapital,
      availableCapital: parseFloat(this.availableCapital.toFixed(2)),
    };
  }

  /**
   * Returns full chronological trade log (shallow copy).
   *
   * @returns {object[]}
   */
  getTrades() {
    return [...this._trades];
  }

  /**
   * Convenience method: P&L summary + open positions + trade count.
   *
   * @param {{ [symbol: string]: number }} currentPrices
   * @returns {object}
   */
  getSummary(currentPrices = {}) {
    return {
      ...this.getPnL(currentPrices),
      positions: this.getPositions(),
      tradeCount: this._trades.length,
    };
  }
}

module.exports = { VirtualPortfolio };
