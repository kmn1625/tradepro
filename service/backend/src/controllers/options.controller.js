'use strict';

const axios = require('axios');
const session = require('../brokers/kotak/session');
const config = require('../brokers/kotak/config');

function _kotakHeaders() {
  const { accessToken } = session.getSession();
  return {
    Authorization: `Bearer ${accessToken}`,
    consumerKey: process.env.KOTAK_CONSUMER_KEY,
    'Content-Type': 'application/json',
  };
}

// Kotak Neo option chain response: { data: { oc: [{strikeprice, CE:{ltp,oi,iv}, PE:{ltp,oi,iv}}], spotprice } }
function _parseKotakChain(raw, symbol, expiry) {
  try {
    const oc = raw?.data?.oc;
    const spot = parseFloat(raw?.data?.spotprice || raw?.data?.spotPrice || 0);
    if (Array.isArray(oc) && spot > 0) {
      const strikes = oc
        .map(row => ({
          strike: parseFloat(row.strikeprice || row.strikePrice || row.strike),
          ce: {
            ltp: parseFloat(row.CE?.ltp || row.CE?.lastPrice || 0),
            oi:  parseInt(row.CE?.oi  || row.CE?.openInterest || 0),
            iv:  parseFloat(row.CE?.iv || row.CE?.impliedVolatility || 0),
          },
          pe: {
            ltp: parseFloat(row.PE?.ltp || row.PE?.lastPrice || 0),
            oi:  parseInt(row.PE?.oi  || row.PE?.openInterest || 0),
            iv:  parseFloat(row.PE?.iv || row.PE?.impliedVolatility || 0),
          },
        }))
        .filter(s => s.strike > 0);
      return { symbol, expiry: expiry || 'nearest', spot, strikes };
    }
    return null;
  } catch {
    return null;
  }
}

function _stubChain(symbol, expiry) {
  const SPOT_PRICES = { NIFTY: 22500, BANKNIFTY: 47300, FINNIFTY: 21800 };
  const spot = SPOT_PRICES[symbol] || 22500;
  const step = symbol === 'BANKNIFTY' ? 100 : 50;
  const strikes = [];
  for (let offset = -10; offset <= 10; offset++) {
    const strike = spot + offset * step;
    strikes.push({
      strike,
      ce: { ltp: Math.max(1, spot - strike + 100 + Math.random() * 20), oi: Math.round(Math.random() * 500000), iv: 12 + Math.random() * 3 },
      pe: { ltp: Math.max(1, strike - spot + 100 + Math.random() * 20), oi: Math.round(Math.random() * 500000), iv: 12 + Math.random() * 3 },
    });
  }
  return { symbol, expiry: expiry || 'nearest', spot, strikes };
}

const optionsController = {

  // GET /api/options/chain?symbol=NIFTY&expiry=2025-06-26
  async getChain(req, res) {
    const { symbol = 'NIFTY', expiry } = req.query;
    try {
      if (session.isAuthenticated()) {
        const kotakRes = await axios.get(`${config.BASE_URL}/rest/neo/v1/option-chain`, {
          params: { symbol, ...(expiry ? { expiry } : {}) },
          headers: _kotakHeaders(),
          timeout: 8000,
        });
        const parsed = _parseKotakChain(kotakRes.data, symbol, expiry);
        if (parsed) return res.json(parsed);
        console.warn('[options] Kotak chain response unparseable — using stub');
      }
    } catch (err) {
      console.warn('[options] Kotak chain fetch failed:', err.message);
    }
    res.json(_stubChain(symbol, expiry));
  },

  // GET /api/options/expiries?symbol=NIFTY
  // Returns 4 upcoming weekly Thursday expiries (NSE weekly expiry day)
  async getExpiries(req, res) {
    const { symbol = 'NIFTY' } = req.query;
    const expiries = [];
    const d = new Date();
    // (4 - day + 7) % 7 = 0 when today IS Thursday (include today), else days until next Thursday
    const daysToThursday = (4 - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + daysToThursday);
    for (let i = 0; i < 4; i++) {
      expiries.push(new Date(d).toISOString().slice(0, 10));
      d.setDate(d.getDate() + 7);
    }
    res.json({ symbol, expiries });
  },
};

module.exports = optionsController;
