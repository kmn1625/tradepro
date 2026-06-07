// market.controller.js
const axios = require('axios');
const marketDataService = require('../services/marketData.service');
const session = require('../brokers/kotak/session');
const kotakConfig = require('../brokers/kotak/config');

const LOT_SIZES = { NIFTY: 50, BANKNIFTY: 15, FINNIFTY: 40 };

// NSE F&O trading symbol: e.g. NIFTY26JUN2522500CE
function _buildTradingSymbol(symbol, expiry, strike, type) {
  if (!expiry) return `${symbol}${strike}${type}`;
  const d = new Date(expiry);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const dd  = String(d.getDate()).padStart(2, '0');
  const mmm = months[d.getMonth()];
  const yy  = String(d.getFullYear()).slice(-2);
  return `${symbol}${dd}${mmm}${yy}${strike}${type}`;
}

class MarketController {
  async getQuotes(req, res) {
    try {
      const { symbols } = req.query;
      const symbolArray = symbols ? symbols.split(',') : undefined;
      const result = await marketDataService.getLiveQuotes(symbolArray);
      if (result.success) res.json(result.data);
      else res.status(500).json({ error: result.error });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getHistory(req, res) {
    try {
      const { symbol } = req.params;
      const { interval = '5m', limit = 100 } = req.query;
      const result = await marketDataService.getHistoricalData(symbol, interval, parseInt(limit));
      if (result.success) res.json(result.data);
      else res.status(500).json({ error: result.error });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async searchSymbols(req, res) {
    try {
      const { q } = req.query;
      const results = marketDataService.searchSymbols(q || '');
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getDepth(req, res) {
    try {
      const { symbol } = req.params;
      const depth = marketDataService.getMarketDepth(decodeURIComponent(symbol));
      res.json(depth);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getIndicators(req, res) {
    try {
      const { symbol, indicator = 'RSI', interval = '5m', period = 14 } = req.body;
      const historyResult = await marketDataService.getHistoricalData(symbol, interval, 100);
      if (!historyResult.success) return res.status(500).json({ error: historyResult.error });
      const indicatorResult = marketDataService.calculateIndicator(historyResult.data, indicator, parseInt(period));
      res.json(indicatorResult);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMultipleIndicators(req, res) {
    try {
      const { symbol, interval = '5m' } = req.body;
      const historyResult = await marketDataService.getHistoricalData(symbol, interval, 100);
      if (!historyResult.success) return res.status(500).json({ error: historyResult.error });
      res.json({
        symbol,
        interval,
        timestamp: new Date().toISOString(),
        indicators: {
          rsi: marketDataService.calculateIndicator(historyResult.data, 'RSI', 14),
          macd: marketDataService.calculateIndicator(historyResult.data, 'MACD'),
          sma20: marketDataService.calculateIndicator(historyResult.data, 'SMA', 20),
          sma50: marketDataService.calculateIndicator(historyResult.data, 'SMA', 50),
          ema20: marketDataService.calculateIndicator(historyResult.data, 'EMA', 20),
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getSignals(req, res) {
    try {
      const { symbol, interval = '5m' } = req.body;
      const historyResult = await marketDataService.getHistoricalData(symbol, interval, 100);
      if (!historyResult.success) return res.status(500).json({ error: historyResult.error });

      const rsi = marketDataService.calculateIndicator(historyResult.data, 'RSI', 14);
      const macd = marketDataService.calculateIndicator(historyResult.data, 'MACD');
      const ema20 = marketDataService.calculateIndicator(historyResult.data, 'EMA', 20);
      const ema50 = marketDataService.calculateIndicator(historyResult.data, 'EMA', 50);

      const signals = [];
      let confidence = 0;

      if (rsi.signal === 'OVERSOLD') { signals.push({ indicator: 'RSI', signal: 'BUY', reason: 'RSI below 30 - Oversold' }); confidence += 25; }
      else if (rsi.signal === 'OVERBOUGHT') { signals.push({ indicator: 'RSI', signal: 'SELL', reason: 'RSI above 70 - Overbought' }); confidence += 25; }

      if (macd.signal === 'BULLISH') { signals.push({ indicator: 'MACD', signal: 'BUY', reason: 'MACD bullish crossover' }); confidence += 25; }
      else if (macd.signal === 'BEARISH') { signals.push({ indicator: 'MACD', signal: 'SELL', reason: 'MACD bearish crossover' }); confidence += 25; }

      if (ema20.current !== null && ema50.current !== null) {
        if (ema20.current > ema50.current) { signals.push({ indicator: 'EMA', signal: 'BUY', reason: 'EMA20 above EMA50 - Uptrend' }); confidence += 25; }
        else { signals.push({ indicator: 'EMA', signal: 'SELL', reason: 'EMA20 below EMA50 - Downtrend' }); confidence += 25; }
      }

      const buyCount = signals.filter(s => s.signal === 'BUY').length;
      const sellCount = signals.filter(s => s.signal === 'SELL').length;
      let overallSignal = 'NEUTRAL';
      if (buyCount > sellCount && buyCount >= 2) overallSignal = 'STRONG_BUY';
      else if (buyCount > sellCount) overallSignal = 'BUY';
      else if (sellCount > buyCount && sellCount >= 2) overallSignal = 'STRONG_SELL';
      else if (sellCount > buyCount) overallSignal = 'SELL';

      res.json({
        symbol, interval,
        timestamp: new Date().toISOString(),
        overallSignal,
        confidence: Math.min(confidence, 100),
        signals,
        indicators: { rsi: rsi.current, macd: macd.current, ema20: ema20.current, ema50: ema50.current },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/market/order
  // Body: { symbol, side, type, strike, expiry, lots, ltp }
  // Attempts Kotak Neo order when authenticated; falls back to paper simulation.
  async placeOrder(req, res) {
    const { symbol, side, type, strike, expiry, lots, ltp } = req.body;
    if (!symbol || !side || !type || !strike || !lots) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields: symbol, side, type, strike, lots' });
    }
    const quantity      = (LOT_SIZES[symbol] || 50) * Number(lots);
    const tradingSymbol = _buildTradingSymbol(symbol, expiry, strike, type);

    try {
      if (session.isAuthenticated()) {
        const { accessToken } = session.getSession();
        const kotakRes = await axios.post(
          `${kotakConfig.BASE_URL}/rest/neo/v1/order`,
          {
            trading_symbol:   tradingSymbol,
            exchange_segment: 'nse_fo',
            transaction_type: side === 'BUY' ? 'B' : 'S',
            order_type:       'MKT',
            quantity:         String(quantity),
            product:          'I',
            validity:         'DAY',
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              consumerKey:   process.env.KOTAK_CONSUMER_KEY,
              'Content-Type': 'application/json',
            },
            timeout: 8000,
          }
        );
        return res.json({
          status:        'ok',
          mode:          'live',
          tradingSymbol,
          orderId:       kotakRes.data?.data?.orderId || kotakRes.data?.orderId || null,
          timestamp:     new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('[market] Kotak order failed:', err.message);
    }

    // Paper simulation — authenticated session absent or Kotak call failed
    res.json({
      status:        'ok',
      mode:          'simulated',
      tradingSymbol,
      side,
      quantity,
      ltp:           Number(ltp) || 0,
      timestamp:     new Date().toISOString(),
    });
  }
}

module.exports = new MarketController();
