'use strict';

// Options controller — proxies option chain data from Kotak Neo or Angel One.
// Kotak: live chain (current day). Angel One: historical chain (when integrated).

const session = require('../brokers/kotak/session');

const optionsController = {

  // GET /api/options/chain?symbol=NIFTY&expiry=2025-06-26
  // Returns array of strikes: [{ strike, ce: { ltp, oi, iv }, pe: { ltp, oi, iv } }]
  async getChain(req, res) {
    const { symbol = 'NIFTY', expiry } = req.query;

    try {
      if (session.isAuthenticated()) {
        // TODO: implement Kotak Neo option chain fetch
        // Kotak API: GET /rest/neo/v1/option-chain?symbol={symbol}&expiry={expiry}
      }
      // Stub data — works whether or not Kotak is authenticated
      const SPOT_PRICES = { NIFTY: 22500, BANKNIFTY: 47300, FINNIFTY: 21800 };
      const spot = SPOT_PRICES[symbol] || 22500;
      const strikes = [];
      for (let offset = -10; offset <= 10; offset++) {
        const strike = spot + offset * 50;
        strikes.push({
          strike,
          ce: { ltp: Math.max(1, spot - strike + 100 + Math.random() * 20), oi: Math.round(Math.random() * 500000), iv: 12 + Math.random() * 3 },
          pe: { ltp: Math.max(1, strike - spot + 100 + Math.random() * 20), oi: Math.round(Math.random() * 500000), iv: 12 + Math.random() * 3 },
        });
      }
      res.json({ symbol, expiry: expiry || 'nearest', spot, strikes });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // GET /api/options/expiries?symbol=NIFTY
  // Returns list of active expiry dates
  async getExpiries(req, res) {
    const { symbol = 'NIFTY' } = req.query;
    // TODO: fetch from Kotak / Angel One
    // Stub: return next 4 weekly expiries
    const expiries = [];
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + (4 - d.getDay() + 7 * i) % 7 + (i === 0 && d.getDay() >= 4 ? 7 : 0));
      expiries.push(d.toISOString().slice(0, 10));
    }
    res.json({ symbol, expiries });
  },
};

module.exports = optionsController;
