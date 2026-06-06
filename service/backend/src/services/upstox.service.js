'use strict';

// Upstox API v2 service — live data + historical OHLC.
// Requires free Upstox demat account + developer.upstox.com app registration.
//
// TODO: integrate — set UPSTOX_CLIENT_ID, UPSTOX_CLIENT_SECRET, UPSTOX_REDIRECT_URI in .env
// OAuth2 flow: GET /v2/login/authorization → exchange code → store access_token

class UpstoxService {
  constructor() {
    this._accessToken = process.env.UPSTOX_ACCESS_TOKEN || null;
    this._baseUrl = 'https://api.upstox.com/v2';
  }

  isConfigured() {
    return !!this._accessToken;
  }

  // GET /historical-candle/{instrument_key}/{unit}/{interval}
  // instrument_key e.g. "NSE_INDEX|Nifty 50"
  // unit: 'minutes' | 'day' | 'week' | 'month'
  // interval: 1 | 5 | 15 | 30 | 60 (minutes)
  async getHistoricalCandles(instrumentKey, unit = 'minutes', interval = 5, fromDate, toDate) {
    if (!this._accessToken) throw new Error('Upstox not configured — set UPSTOX_ACCESS_TOKEN');
    // TODO: implement fetch
    // GET /v2/historical-candle/{instrumentKey}/{unit}/{interval}/{toDate}/{fromDate}
    // Returns: { data: { candles: [[ts, o, h, l, c, vol, oi], ...] } }
    throw new Error('Upstox historical candles: not yet integrated');
  }

  // WebSocket live market data — subscribe to instrument tokens
  // TODO: implement WebSocket subscription (wss://api.upstox.com/v2/feed/market-data-feed)
  startLiveFeed(instrumentKeys, onTick) {
    if (!this._accessToken) {
      console.warn('[Upstox] Not configured — live feed disabled');
      return;
    }
    throw new Error('Upstox live feed: not yet integrated');
  }

  // GET /market-quote/ltp — last traded price for given instrument keys
  async getLTP(instrumentKeys) {
    if (!this._accessToken) throw new Error('Upstox not configured');
    // TODO: implement
    // GET /v2/market-quote/ltp?instrument_key=NSE_INDEX|Nifty 50,...
    throw new Error('Upstox LTP: not yet integrated');
  }
}

module.exports = new UpstoxService();
