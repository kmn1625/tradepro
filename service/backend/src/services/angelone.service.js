'use strict';

// Angel One SmartAPI service — best free source for 2yr 1-min F&O historical data.
// Requires free Angel One demat account + SmartAPI registration at smartapi.angelbroking.com
//
// TODO: integrate — set ANGEL_API_KEY, ANGEL_CLIENT_ID, ANGEL_PASSWORD, ANGEL_TOTP_SECRET in .env
// Auth flow: POST /rest/auth/angelbroking/user/v1/loginByPassword → get jwtToken
// TOTP required: use otplib (already in package.json) to generate TOTP from ANGEL_TOTP_SECRET

class AngelOneService {
  constructor() {
    this._apiKey    = process.env.ANGEL_API_KEY    || null;
    this._clientId  = process.env.ANGEL_CLIENT_ID  || null;
    this._baseUrl   = 'https://apiconnect.angelbroking.com';
    this._jwtToken  = null;
    this._refreshToken = null;
  }

  isConfigured() {
    return !!(this._apiKey && this._clientId);
  }

  // POST /rest/auth/angelbroking/user/v1/loginByPassword
  // Body: { clientcode, password, totp }
  async login() {
    if (!this.isConfigured()) throw new Error('Angel One not configured — set ANGEL_API_KEY + ANGEL_CLIENT_ID in .env');
    // TODO: implement login + store jwtToken
    throw new Error('Angel One login: not yet integrated');
  }

  // GET /rest/secure/angelbroking/historical/v1/getCandleData
  // exchange: NSE | NFO, symboltoken: e.g. "99926000" (NIFTY 50)
  // interval: ONE_MINUTE | THREE_MINUTE | FIVE_MINUTE | TEN_MINUTE | FIFTEEN_MINUTE | THIRTY_MINUTE | ONE_HOUR | ONE_DAY
  // fromdate: "YYYY-MM-DD HH:mm", todate: "YYYY-MM-DD HH:mm"
  // Limit: 2 years back, max 30 days per request for 1-min data
  async getCandleData(exchange, symboltoken, interval, fromdate, todate) {
    if (!this._jwtToken) await this.login();
    // TODO: implement
    // POST /rest/secure/angelbroking/historical/v1/getCandleData
    // Returns: { data: [[timestamp, o, h, l, c, vol], ...] }
    throw new Error('Angel One candle data: not yet integrated');
  }

  // GET /rest/secure/angelbroking/market/v1/optionchain
  // name: NIFTY | BANKNIFTY | FINNIFTY, expiry: "DD-MMM-YYYY", strikePrice: 0 (all)
  async getOptionChain(name, expiry, strikePrice = 0) {
    if (!this._jwtToken) await this.login();
    // TODO: implement
    throw new Error('Angel One option chain: not yet integrated');
  }

  // GET LTP for symbol
  async getLTP(exchange, tradingsymbol, symboltoken) {
    if (!this._jwtToken) await this.login();
    // TODO: implement
    throw new Error('Angel One LTP: not yet integrated');
  }
}

module.exports = new AngelOneService();
