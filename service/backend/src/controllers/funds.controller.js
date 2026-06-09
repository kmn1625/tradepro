'use strict';

const axios   = require('axios');
const session = require('../brokers/kotak/session');
const config  = require('../brokers/kotak/config');

function _headers(accessToken) {
  return {
    Authorization:  `Bearer ${accessToken}`,
    consumerKey:    process.env.KOTAK_CONSUMER_KEY,
    'Content-Type': 'application/json',
  };
}

class FundsController {
  // GET /api/funds/balance
  async getBalance(req, res) {
    if (!session.isAuthenticated()) {
      return res.json({ live: false, availableCash: 500000, usedMargin: 0, totalBalance: 500000, note: 'Mock — no broker session' });
    }
    const { accessToken } = session.getSession();
    try {
      const r = await axios.get(
        `${config.BASE_URL}/rest/neo/v1/account/funds`,
        { headers: _headers(accessToken), timeout: 6000 }
      );
      const d = r.data?.data || {};
      return res.json({
        live:          true,
        availableCash: parseFloat(d.net || d.available_cash || d.availablecash || 0),
        usedMargin:    parseFloat(d.used_margin || d.usedmargin || 0),
        totalBalance:  parseFloat(d.total || d.net || 0),
        raw:           d,
      });
    } catch (err) {
      return res.status(502).json({ error: 'Kotak funds fetch failed: ' + err.message });
    }
  }

  // GET /api/funds/ledger
  async getLedger(req, res) {
    if (!session.isAuthenticated()) {
      return res.json({ live: false, entries: [], note: 'Mock — no broker session' });
    }
    const { accessToken } = session.getSession();
    try {
      const r = await axios.get(
        `${config.BASE_URL}/rest/neo/v1/account/ledger`,
        { headers: _headers(accessToken), timeout: 6000 }
      );
      const entries = r.data?.data || [];
      return res.json({ live: true, entries, count: entries.length });
    } catch (err) {
      return res.status(502).json({ error: 'Kotak ledger fetch failed: ' + err.message });
    }
  }

  // POST /api/funds/add  — stub (Kotak doesn't support programmatic fund transfer)
  async addFunds(req, res) {
    return res.status(501).json({ error: 'Fund transfers must be done via broker portal directly' });
  }

  // POST /api/funds/withdraw — stub
  async withdrawFunds(req, res) {
    return res.status(501).json({ error: 'Fund withdrawals must be done via broker portal directly' });
  }
}

module.exports = new FundsController();
