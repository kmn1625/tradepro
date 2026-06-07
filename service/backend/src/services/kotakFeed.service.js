// kotakFeed.service.js
'use strict';

const WebSocket = require('ws');
const session = require('../brokers/kotak/session');
const marketDataService = require('./marketData.service');
const algoEngine = require('./algoEngine');

const INSTRUMENT_TOKENS = {
  'NIFTY 50 (Index)':   '26000',
  'BANK NIFTY (Index)': '26009',
  'FINNIFTY (Index)':   '26037',
};

class KotakFeedService {
  constructor() {
    this._ws = null;
    this._broadcastFn = null;
    this._reconnectTimer = null;
    this._connected = false;
    this._pingInterval = null;
    this._mockInterval = null;
    this._mockPrices = null;
    this._mockVolumes = null;
  }

  startFeed(broadcastFn) {
    this._broadcastFn = broadcastFn;
    if (session.isAuthenticated()) {
      this._connect();
    } else {
      console.warn('[KotakFeed] No Kotak session — starting mock price feed');
      this._startMockFeed();
    }
  }

  stopFeed() {
    if (this._mockInterval) { clearInterval(this._mockInterval); this._mockInterval = null; }
    if (this._pingInterval) { clearInterval(this._pingInterval); this._pingInterval = null; }
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    if (this._ws) { this._ws.terminate(); this._ws = null; }
    this._connected = false;
  }

  // Add symbols dynamically (called when user adds to watchlist)
  addSymbols(symbolsArr) {
    for (const s of symbolsArr) {
      if (!s || !s.symbol) continue;
      marketDataService.addSymbol(s.symbol, s.basePrice || 1000, s.type || 'NSE');
      if (this._mockPrices && this._mockPrices[s.symbol] === undefined) {
        this._mockPrices[s.symbol] = marketDataService.lastPrice[s.symbol];
        this._mockVolumes[s.symbol] = 0;
      }
    }
  }

  _startMockFeed() {
    this._mockPrices = {};
    this._mockVolumes = {};

    for (const [sym, price] of Object.entries(marketDataService.lastPrice)) {
      this._mockPrices[sym] = price;
      this._mockVolumes[sym] = marketDataService.dayStats[sym]?.volume || 0;
    }

    this._mockInterval = setInterval(() => {
      const now = Date.now();
      for (const symbol of Object.keys(this._mockPrices)) {
        const cur = this._mockPrices[symbol];
        const delta = cur * (Math.random() - 0.5) * 0.0016;
        this._mockPrices[symbol] = parseFloat((cur + delta).toFixed(2));
        const volInc = Math.floor(Math.random() * 1000) + 100;
        this._mockVolumes[symbol] = (this._mockVolumes[symbol] || 0) + volInc;

        marketDataService.processTick(symbol, this._mockPrices[symbol], now, volInc);
        algoEngine.onTick(symbol, this._mockPrices[symbol], now);

        const { bid, ask } = marketDataService.getBidAsk(symbol);
        const ds = marketDataService.dayStats[symbol] || {};

        this._broadcastFn({
          type: 'PRICE_UPDATE',
          symbol,
          price: this._mockPrices[symbol],
          bid,
          ask,
          volume: this._mockVolumes[symbol],
          open: ds.open || this._mockPrices[symbol],
          high: ds.high || this._mockPrices[symbol],
          low: ds.low || this._mockPrices[symbol],
          prevClose: ds.prevClose || this._mockPrices[symbol],
          weekHigh52: ds.weekHigh52 || this._mockPrices[symbol],
          weekLow52: ds.weekLow52 || this._mockPrices[symbol],
          circuitUpper: ds.circuitUpper || null,
          circuitLower: ds.circuitLower || null,
          time: now,
        });
      }
    }, 1000);
  }

  _connect() {
    if (!session.isAuthenticated()) {
      console.warn('[KotakFeed] Session not authenticated — feed not started.');
      return;
    }

    const { accessToken } = session.getSession();
    const WS_URL = 'wss://mlhsm.kotaksecurities.com';

    let ws;
    try {
      ws = new WebSocket(WS_URL, [], { headers: { Authorization: 'Bearer ' + accessToken } });
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
        if (this._ws && this._ws.readyState === WebSocket.OPEN) this._ws.ping();
      }, 25000);
    });

    ws.on('message', (data) => this._handleTick(data));

    ws.on('close', () => {
      console.log('[KotakFeed] Disconnected — reconnecting in 5s');
      this._connected = false;
      if (this._pingInterval) { clearInterval(this._pingInterval); this._pingInterval = null; }
      this._scheduleReconnect();
    });

    ws.on('error', (err) => {
      console.error('[KotakFeed] WS error: ' + err.message);
    });
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connect();
    }, 5000);
  }

  _subscribe() {
    const tokens = Object.values(INSTRUMENT_TOKENS);
    this._ws.send(JSON.stringify({ type: 'subscribe', tokens }));
  }

  _handleTick(rawData) {
    let tick;
    try { tick = JSON.parse(rawData.toString()); } catch { return; }
    if (!tick || !tick.token) return;

    const entry = Object.entries(INSTRUMENT_TOKENS).find(([, t]) => t === String(tick.token));
    if (!entry) return;
    const symbol = entry[0];

    const price = parseFloat(tick.ltp || tick.last_price || tick.ltP || 0);
    if (!price || price <= 0) return;

    const volInc = parseInt(tick.volume || tick.vol || 0, 10);
    const tickTime = Date.now();
    marketDataService.processTick(symbol, price, tickTime, volInc);
    algoEngine.onTick(symbol, price, tickTime);

    const { bid, ask } = marketDataService.getBidAsk(symbol);
    const ds = marketDataService.dayStats[symbol] || {};

    this._broadcastFn({
      type: 'PRICE_UPDATE',
      symbol,
      price,
      bid: tick.bid || bid,
      ask: tick.ask || ask,
      volume: ds.volume || 0,
      open: ds.open || price,
      high: ds.high || price,
      low: ds.low || price,
      prevClose: ds.prevClose || price,
      weekHigh52: ds.weekHigh52 || price,
      weekLow52: ds.weekLow52 || price,
      circuitUpper: ds.circuitUpper || null,
      circuitLower: ds.circuitLower || null,
      time: Date.now(),
    });

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
