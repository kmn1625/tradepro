'use strict';

// Strike resolver (P5-R02): ATM, ATM±N, by-premium selection.

const LOT_SIZES = {
  NIFTY:     65,
  BANKNIFTY: 30,
  FINNIFTY:  60,
};

const STRIKE_INTERVALS = {
  NIFTY:     50,
  BANKNIFTY: 100,
  FINNIFTY:  50,
};

// Default annualised IV per index (used when strategy doesn't specify iv)
const DEFAULT_IV = {
  NIFTY:     0.15,
  BANKNIFTY: 0.20,
  FINNIFTY:  0.18,
};

class StrikeResolver {
  // Round spot to nearest strike multiple.
  getATM(spot, underlying) {
    const interval = STRIKE_INTERVALS[underlying] || 50;
    return Math.round(spot / interval) * interval;
  }

  // offset = 0 → ATM, +1 → 1 strike OTM for calls, -1 → 1 strike ITM for calls.
  // For symmetric strategies: CE uses +offset, PE uses -offset.
  resolveStrike(spot, underlying, offset = 0) {
    const interval = STRIKE_INTERVALS[underlying] || 50;
    return this.getATM(spot, underlying) + offset * interval;
  }

  // Find strike where BS premium ≈ targetPremium (binary search over strike range).
  // type: 'CE' | 'PE',  bsFn: (S,K,T,sigma,r,type)=>price
  resolveByPremium(spot, underlying, type, targetPremium, dte, iv, bsFn) {
    const interval = STRIKE_INTERVALS[underlying] || 50;
    const atm = this.getATM(spot, underlying);
    let lo = atm - 20 * interval;
    let hi = atm + 20 * interval;

    for (let i = 0; i < 40; i++) {
      const mid = Math.round(((lo + hi) / 2) / interval) * interval;
      const price = bsFn(spot, mid, dte, iv, 0.065, type);
      if (price > targetPremium) {
        type === 'CE' ? (lo = mid) : (hi = mid);
      } else {
        type === 'CE' ? (hi = mid) : (lo = mid);
      }
      if (Math.abs(hi - lo) <= interval) break;
    }

    return Math.round(((lo + hi) / 2) / interval) * interval;
  }

  getLotSize(underlying)      { return LOT_SIZES[underlying] || 50;  }
  getStrikeInterval(underlying) { return STRIKE_INTERVALS[underlying] || 50; }
  getDefaultIV(underlying)    { return DEFAULT_IV[underlying] || 0.15; }
}

module.exports = new StrikeResolver();
