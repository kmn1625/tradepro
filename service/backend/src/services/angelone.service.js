'use strict';

// Angel One SmartAPI service (P4-R01)
// Free source for 2yr 1-min F&O historical data.
// Setup: create free Angel One account → register SmartAPI at smartapi.angelbroking.com
// .env: ANGEL_API_KEY, ANGEL_CLIENT_ID, ANGEL_PASSWORD, ANGEL_TOTP_SECRET

const axios  = require('axios');
const { authenticator } = require('otplib');

const BASE = 'https://apiconnect.angelbroking.com';

class AngelOneService {
  constructor() {
    this._apiKey      = process.env.ANGEL_API_KEY      || null;
    this._clientId    = process.env.ANGEL_CLIENT_ID    || null;
    this._password    = process.env.ANGEL_PASSWORD     || null;
    this._totpSecret  = process.env.ANGEL_TOTP_SECRET  || null;
    this._jwtToken    = null;
    this._refreshToken = null;
    this._loginAt     = null;
  }

  isConfigured() {
    return !!(this._apiKey && this._clientId && this._password && this._totpSecret);
  }

  _headers(withAuth = true) {
    const h = {
      'Content-Type':       'application/json',
      'Accept':             'application/json',
      'X-UserType':         'USER',
      'X-SourceID':         'WEB',
      'X-ClientLocalIP':    '127.0.0.1',
      'X-ClientPublicIP':   '127.0.0.1',
      'X-MACAddress':       '00:00:00:00:00:00',
      'X-PrivateKey':       this._apiKey,
    };
    if (withAuth && this._jwtToken) {
      h['Authorization'] = `Bearer ${this._jwtToken}`;
    }
    return h;
  }

  // JWT valid for ~24h. Re-login if older than 23h.
  _isTokenStale() {
    if (!this._loginAt) return true;
    return (Date.now() - this._loginAt) > 23 * 3_600_000;
  }

  async login() {
    if (!this.isConfigured()) {
      throw new Error('Angel One not configured — set ANGEL_API_KEY, ANGEL_CLIENT_ID, ANGEL_PASSWORD, ANGEL_TOTP_SECRET in .env');
    }
    const totp = authenticator.generate(this._totpSecret);
    const res = await axios.post(
      `${BASE}/rest/auth/angelbroking/user/v1/loginByPassword`,
      { clientcode: this._clientId, password: this._password, totp },
      { headers: this._headers(false) }
    );
    const data = res.data?.data;
    if (!data?.jwtToken) {
      throw new Error('Angel One login failed: ' + JSON.stringify(res.data));
    }
    this._jwtToken     = data.jwtToken;
    this._refreshToken = data.refreshToken;
    this._loginAt      = Date.now();
    console.log('[AngelOne] logged in, token valid ~24h');
  }

  async _ensureAuth() {
    if (!this._jwtToken || this._isTokenStale()) await this.login();
  }

  // Fetch historical 1-min OHLCV candles from Angel One.
  // exchange:    'NSE' | 'NFO'
  // symboltoken: Angel One numeric token string (e.g. "99926000" for NIFTY 50)
  // interval:    'ONE_MINUTE' | 'FIVE_MINUTE' | 'ONE_DAY' (see contractRegistry.js)
  // fromdate:    "YYYY-MM-DD HH:mm"  (IST, market hours)
  // todate:      "YYYY-MM-DD HH:mm"  (IST, max 30 days from fromdate for 1-min)
  //
  // Returns: [{ ts (epoch ms), o, h, l, c, vol }]
  async getCandleData(exchange, symboltoken, interval, fromdate, todate) {
    await this._ensureAuth();
    try {
      const res = await axios.post(
        `${BASE}/rest/secure/angelbroking/historical/v1/getCandleData`,
        { exchange, symboltoken, interval, fromdate, todate },
        { headers: this._headers() }
      );
      const raw = res.data?.data;
      if (!Array.isArray(raw) || raw.length === 0) return [];

      // Each row: [timestamp_str, open, high, low, close, volume]
      return raw.map(([ts, o, h, l, c, v]) => ({
        ts:  new Date(ts).getTime(),
        o:   parseFloat(o),
        h:   parseFloat(h),
        l:   parseFloat(l),
        c:   parseFloat(c),
        vol: parseInt(v, 10) || 0,
      })).filter(c => c.ts > 0 && c.c > 0);

    } catch (err) {
      if (err.response?.status === 401) {
        // Force re-login once on token expiry
        this._jwtToken = null;
        await this.login();
        return this.getCandleData(exchange, symboltoken, interval, fromdate, todate);
      }
      throw err;
    }
  }

  // Convenience: fetch for an index name ('NIFTY' | 'BANKNIFTY' | 'FINNIFTY').
  // Uses contractRegistry for token lookup and date chunking.
  async fetchIndexCandles(indexName, interval, fromdate, todate) {
    const registry = require('./contractRegistry');
    const token = registry.getIndexToken(indexName);
    if (!token) throw new Error(`Unknown index: ${indexName}`);
    return this.getCandleData(token.exchange, token.symboltoken, interval, fromdate, todate);
  }

  // LTP for a specific symbol.
  async getLTP(exchange, tradingsymbol, symboltoken) {
    await this._ensureAuth();
    const res = await axios.post(
      `${BASE}/rest/secure/angelbroking/order/v1/getLtpData`,
      { exchange, tradingsymbol, symboltoken },
      { headers: this._headers() }
    );
    return res.data?.data?.ltp ? parseFloat(res.data.data.ltp) : null;
  }
}

module.exports = new AngelOneService();
