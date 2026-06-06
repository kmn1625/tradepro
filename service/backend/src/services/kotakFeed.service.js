// kotakFeed.service.js
// Kotak Neo WebSocket subscription manager.
// Streams live ticks for NIFTY 50, BANK NIFTY, and FINNIFTY into the OHLC aggregator.

'use strict';

const WebSocket = require('ws');
const session = require('../brokers/kotak/session');
const marketDataService = require('./marketData.service');

// Instrument tokens for NSE indices on Kotak Neo streaming API
const INSTRUMENT_TOKENS = {
  'NIFTY 50':   '26000',
  'BANK NIFTY': '26009',
  'FINNIFTY':   '26037',
};

class KotakFeedService {
  constructor() {
    this._ws = null;
    this._broadcastFn = null;
    this._reconnectTimer = null;
    this._connected = false;
    this._pingInterval = null;
    this._mockInterval = null;
  }

  // Public: start streaming live ticks.
  // broadcastFn receives { type, symbol, price, time } and { type, symbol, interval, ... } objects.
  startFeed(broadcastFn) {
    this._broadcastFn = broadcastFn;
    if (session.isAuthenticated()) {
      this._connect();
    } else {
      console.warn('[KotakFeed] No Kotak session — starting mock price feed');
      this._startMockFeed();
    }
  }

  // Public: stop streaming and clean up resources.
  stopFeed() {
    if (this._mockInterval) {
      clearInterval(this._mockInterval);
      this._mockInterval = null;
    }
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.terminate();
      this._ws = null;
    }
    this._connected = false;
  }

  // --- Private ---

  _startMockFeed() {
    // Simulates live price feed using random walk — used when Kotak session is not active.
    // Symbols must match INITIAL_WATCHLIST in frontend App.jsx.
    const mockPrices = {
      'NIFTY 50 (Index)':   22453.20,
      'BANK NIFTY (Index)': 47285.10,
      'GOLD (MCX)':         62450.00,
      'CRUDEOIL (MCX)':     6450.00,
    };
    this._mockInterval = setInterval(() => {
      const now = Date.now();
      for (const [symbol, basePrice] of Object.entries(mockPrices)) {
        // Random walk: ±0.08% per tick
        const delta = basePrice * (Math.random() - 0.5) * 0.0016;
        mockPrices[symbol] = parseFloat((mockPrices[symbol] + delta).toFixed(2));
        // Update marketDataService so lastPrice is available for paper trading fills
        marketDataService.processTick(symbol, mockPrices[symbol], now);
        this._broadcastFn({ type: 'PRICE_UPDATE', symbol, price: mockPrices[symbol], time: now });
      }
    }, 1000);
  }

  _connect() {
    if (!session.isAuthenticated()) {
      console.warn('[KotakFeed] Session not authenticated — feed not started. Call POST /api/auth/login first.');
      return;
    }

    const { accessToken } = session.getSession();

    const WS_URL = 'wss://mlhsm.kotaksecurities.com';

    let ws;
    try {
      ws = new WebSocket(WS_URL, [], {
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
      });
    } catch (err) {
      console.error('[KotakFeed] Failed to create WebSocket:', err.message);
      this._scheduleReconnect();
      return;
    }

    this._ws = ws;

    ws.on('open', () => {
      console.log('[KotakFeed] Connected');
      this._connected = true;
      this._subscribe();
      this._pingInterval = setInterval(() => {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
          this._ws.ping();
        }
      }, 25000);
    });

    ws.on('message', (data) => {
      this._handleTick(data);
    });

    ws.on('close', () => {
      console.log('[KotakFeed] Disconnected — reconnecting in 5s');
      this._connected = false;
      if (this._pingInterval) {
        clearInterval(this._pingInterval);
        this._pingInterval = null;
      }
      this._scheduleReconnect();
    });

    ws.on('error', (err) => {
      console.error('[KotakFeed] WS error: ' + err.message);
      // close event will follow; reconnect is handled there
    });
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return; // already scheduled
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connect();
    }, 5000);
  }

  _subscribe() {
    const tokens = Object.values(INSTRUMENT_TOKENS);
    const msg = JSON.stringify({
      type: 'subscribe',
      tokens: tokens,
    });
    this._ws.send(msg);
  }

  _handleTick(rawData) {
    let tick;
    try {
      tick = JSON.parse(rawData.toString());
    } catch (_) {
      // Malformed JSON — skip (T-01-04: guard against DoS via bad payloads)
      return;
    }

    // Skip ping-pong frames and any message without a token field
    if (!tick || !tick.token) return;

    // Resolve the symbol name from the instrument token
    const entry = Object.entries(INSTRUMENT_TOKENS).find(([, t]) => t === String(tick.token));
    if (!entry) return;
    const symbol = entry[0];

    // Extract last-traded price — Kotak Neo uses various field names across API versions
    const price = parseFloat(tick.ltp || tick.last_price || tick.ltP || 0);

    // Guard: do not propagate NaN, 0, or negative prices (T-01-01)
    if (!price || price <= 0) return;

    // Feed into the OHLC aggregator
    marketDataService.processTick(symbol, price, Date.now());

    // Broadcast raw tick to all WebSocket clients
    this._broadcastFn({ type: 'PRICE_UPDATE', symbol, price, time: Date.now() });

    // Broadcast partial candle for each tracked interval
    for (const interval of ['1m', '5m']) {
      const partial = marketDataService.partialCandle[symbol]?.[interval];
      if (partial) {
        this._broadcastFn({
          type: 'CANDLE_UPDATE',
          symbol,
          interval,
          time: partial.time,
          open: parseFloat(partial.open.toFixed(2)),
          high: parseFloat(partial.high.toFixed(2)),
          low: parseFloat(partial.low.toFixed(2)),
          close: parseFloat(partial.close.toFixed(2)),
        });
      }
    }
  }
}

module.exports = new KotakFeedService();
