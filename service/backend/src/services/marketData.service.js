// marketData.service.js
// Aggregates OHLC candles from live price ticks and provides historical mock data.
// When Kotak auth is live, swap generateMockTick() with real feed.

class MarketDataService {
  constructor() {
    // symbol -> { '1m': Candle[], '5m': Candle[] }
    this.candles = {};
    // symbol -> current partial candle being built
    this.partialCandle = {};
    // symbol -> last known price
    this.lastPrice = {
      'NIFTY 50': 22453.20,
      'BANK NIFTY': 47285.10,
      'GOLD': 62450.00,
      'CRUDEOIL': 6450.00,
    };
  }

  // Called by WebSocket broadcaster with each new tick { symbol, price, time }
  processTick(symbol, price, time = Date.now()) {
    const minuteTs = Math.floor(time / 60000) * 60000; // floor to minute
    const fiveMinTs = Math.floor(time / 300000) * 300000;

    this.lastPrice[symbol] = price;

    for (const [interval, ts] of [['1m', minuteTs], ['5m', fiveMinTs]]) {
      if (!this.candles[symbol]) this.candles[symbol] = { '1m': [], '5m': [] };
      if (!this.partialCandle[symbol]) this.partialCandle[symbol] = {};

      const partial = this.partialCandle[symbol][interval];

      if (!partial || partial.time !== ts) {
        // Seal previous candle
        if (partial) {
          this.candles[symbol][interval].push({ ...partial });
          // Keep last 500 candles max
          if (this.candles[symbol][interval].length > 500) {
            this.candles[symbol][interval].shift();
          }
        }
        // Start new candle
        this.partialCandle[symbol][interval] = {
          time: ts,
          open: price,
          high: price,
          low: price,
          close: price,
        };
      } else {
        partial.high = Math.max(partial.high, price);
        partial.low = Math.min(partial.low, price);
        partial.close = price;
      }
    }
  }

  // Returns sealed candles + current partial for charting.
  // Prepends mock history when real candles are fewer than limit.
  getCandles(symbol, interval = '5m', limit = 100) {
    const sym = this._normalizeSymbol(symbol);
    const sealed = (this.candles[sym]?.[interval] || []).slice(-limit);
    const partial = this.partialCandle[sym]?.[interval];
    const real = partial ? [...sealed, { ...partial }] : sealed;

    if (real.length >= limit) return real;

    // Pad with mock history before the first real candle
    const needed = limit - real.length;
    const firstRealTime = real.length > 0
      ? (real[0].time > 1e10 ? real[0].time : real[0].time * 1000)
      : Date.now();
    const intervalMs = interval === '1m' ? 60000 : 300000;
    const mock = this._generateHistoricalMock(sym, interval, needed, firstRealTime - intervalMs);

    // Convert mock times to ms to match real candles, then deduplicate
    const combined = [...mock, ...real];
    const seen = new Set();
    return combined.filter(c => {
      const t = c.time > 1e10 ? c.time : c.time * 1000;
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    }).sort((a, b) => {
      const at = a.time > 1e10 ? a.time : a.time * 1000;
      const bt = b.time > 1e10 ? b.time : b.time * 1000;
      return at - bt;
    });
  }

  async getLiveQuotes(symbols) {
    try {
      const syms = symbols || Object.keys(this.lastPrice);
      const data = syms.map(s => {
        const sym = this._normalizeSymbol(s);
        const price = this.lastPrice[sym] || 0;
        return { symbol: sym, price, timestamp: new Date().toISOString() };
      });
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getHistoricalData(symbol, interval = '5m', limit = 100) {
    try {
      const sym = this._normalizeSymbol(symbol);
      const data = this.getCandles(sym, interval, limit);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  calculateIndicator(candles, indicator, period = 14) {
    if (!candles || candles.length === 0) {
      return { indicator, current: null, signal: 'NEUTRAL' };
    }
    const closes = candles.map(c => c.close);

    switch (indicator.toUpperCase()) {
      case 'RSI': return this._rsi(closes, period);
      case 'MACD': return this._macd(closes);
      case 'SMA': return this._sma(closes, period);
      case 'EMA': return this._ema(closes, period);
      default: return { indicator, current: null, signal: 'NEUTRAL' };
    }
  }

  // --- Private helpers ---

  _normalizeSymbol(sym) {
    if (!sym) return 'NIFTY 50';
    const s = sym.toUpperCase();
    if (s.includes('BANK')) return 'BANK NIFTY';
    if (s.includes('NIFTY')) return 'NIFTY 50';
    if (s.includes('GOLD')) return 'GOLD';
    if (s.includes('CRUDE')) return 'CRUDEOIL';
    return sym;
  }

  _generateHistoricalMock(symbol, interval, limit, endTimeMs = Date.now()) {
    const basePrice = this.lastPrice[symbol] || 22000;
    const intervalMs = interval === '1m' ? 60000 : 300000;
    const candles = [];

    let price = basePrice * 0.97;
    for (let i = limit; i >= 0; i--) {
      const tsMs = endTimeMs - i * intervalMs;
      const move = (Math.random() - 0.48) * basePrice * 0.002;
      const open = price;
      const close = price + move;
      const high = Math.max(open, close) + Math.random() * basePrice * 0.001;
      const low = Math.min(open, close) - Math.random() * basePrice * 0.001;
      candles.push({ time: tsMs, open, high, low, close }); // ms — CandleChart converts
      price = close;
    }
    return candles;
  }

  _sma(closes, period) {
    if (closes.length < period) return { current: null, signal: 'NEUTRAL' };
    const slice = closes.slice(-period);
    const current = slice.reduce((a, b) => a + b, 0) / period;
    return { indicator: 'SMA', period, current, signal: 'NEUTRAL' };
  }

  _ema(closes, period) {
    if (closes.length < period) return { current: null, signal: 'NEUTRAL' };
    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    return { indicator: 'EMA', period, current: ema, signal: 'NEUTRAL' };
  }

  _rsi(closes, period = 14) {
    if (closes.length < period + 1) return { current: 50, signal: 'NEUTRAL' };
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    const current = 100 - 100 / (1 + rs);
    const signal = current < 30 ? 'OVERSOLD' : current > 70 ? 'OVERBOUGHT' : 'NEUTRAL';
    return { indicator: 'RSI', period, current, signal };
  }

  _macd(closes) {
    const ema12 = this._ema(closes, 12).current;
    const ema26 = this._ema(closes, 26).current;
    if (ema12 === null || ema26 === null) return { current: null, signal: 'NEUTRAL' };
    const current = ema12 - ema26;
    const signal = current > 0 ? 'BULLISH' : 'BEARISH';
    return { indicator: 'MACD', current, ema12, ema26, signal };
  }
}

module.exports = new MarketDataService();
