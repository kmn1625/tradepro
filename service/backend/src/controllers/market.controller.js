// backend/src/controllers/market.controller.js
const marketDataService = require('../services/marketData.service');

class MarketController {
  /**
   * Get live market quotes
   * GET /api/market/quotes
   */
  async getQuotes(req, res) {
    try {
      const { symbols } = req.query;
      const symbolArray = symbols ? symbols.split(',') : undefined;
      
      const result = await marketDataService.getLiveQuotes(symbolArray);
      
      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get historical candlestick data
   * GET /api/market/history/:symbol
   */
  async getHistory(req, res) {
    try {
      const { symbol } = req.params;
      const { interval = '5m', limit = 100 } = req.query;
      
      const result = await marketDataService.getHistoricalData(
        symbol,
        interval,
        parseInt(limit)
      );
      
      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Calculate technical indicators
   * POST /api/market/indicators
   */
  async getIndicators(req, res) {
    try {
      const { symbol, indicator = 'RSI', interval = '5m', period = 14 } = req.body;
      
      // First get historical data
      const historyResult = await marketDataService.getHistoricalData(symbol, interval, 100);
      
      if (!historyResult.success) {
        return res.status(500).json({ error: historyResult.error });
      }

      // Calculate indicator
      const indicatorResult = marketDataService.calculateIndicator(
        historyResult.data,
        indicator,
        parseInt(period)
      );
      
      res.json(indicatorResult);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get multiple indicators at once
   * POST /api/market/indicators/multi
   */
  async getMultipleIndicators(req, res) {
    try {
      const { symbol, interval = '5m' } = req.body;
      
      // Get historical data
      const historyResult = await marketDataService.getHistoricalData(symbol, interval, 100);
      
      if (!historyResult.success) {
        return res.status(500).json({ error: historyResult.error });
      }

      // Calculate all major indicators
      const indicators = {
        rsi: marketDataService.calculateIndicator(historyResult.data, 'RSI', 14),
        macd: marketDataService.calculateIndicator(historyResult.data, 'MACD'),
        sma20: marketDataService.calculateIndicator(historyResult.data, 'SMA', 20),
        sma50: marketDataService.calculateIndicator(historyResult.data, 'SMA', 50),
        ema20: marketDataService.calculateIndicator(historyResult.data, 'EMA', 20),
      };
      
      res.json({
        symbol,
        interval,
        timestamp: new Date().toISOString(),
        indicators
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get trading signals based on indicators
   * POST /api/market/signals
   */
  async getSignals(req, res) {
    try {
      const { symbol, interval = '5m' } = req.body;
      
      // Get historical data
      const historyResult = await marketDataService.getHistoricalData(symbol, interval, 100);
      
      if (!historyResult.success) {
        return res.status(500).json({ error: historyResult.error });
      }

      // Calculate indicators
      const rsi = marketDataService.calculateIndicator(historyResult.data, 'RSI', 14);
      const macd = marketDataService.calculateIndicator(historyResult.data, 'MACD');
      const ema20 = marketDataService.calculateIndicator(historyResult.data, 'EMA', 20);
      const ema50 = marketDataService.calculateIndicator(historyResult.data, 'EMA', 50);

      // Generate signals
      const signals = [];
      let overallSignal = 'NEUTRAL';
      let confidence = 0;

      // RSI Signal
      if (rsi.signal === 'OVERSOLD') {
        signals.push({ indicator: 'RSI', signal: 'BUY', reason: 'RSI below 30 - Oversold' });
        confidence += 25;
      } else if (rsi.signal === 'OVERBOUGHT') {
        signals.push({ indicator: 'RSI', signal: 'SELL', reason: 'RSI above 70 - Overbought' });
        confidence += 25;
      }

      // MACD Signal
      if (macd.signal === 'BULLISH') {
        signals.push({ indicator: 'MACD', signal: 'BUY', reason: 'MACD bullish crossover' });
        confidence += 25;
      } else if (macd.signal === 'BEARISH') {
        signals.push({ indicator: 'MACD', signal: 'SELL', reason: 'MACD bearish crossover' });
        confidence += 25;
      }

      // EMA Crossover Signal
      if (ema20.current > ema50.current) {
        signals.push({ indicator: 'EMA', signal: 'BUY', reason: 'EMA20 above EMA50 - Uptrend' });
        confidence += 25;
      } else if (ema20.current < ema50.current) {
        signals.push({ indicator: 'EMA', signal: 'SELL', reason: 'EMA20 below EMA50 - Downtrend' });
        confidence += 25;
      }

      // Determine overall signal
      const buySignals = signals.filter(s => s.signal === 'BUY').length;
      const sellSignals = signals.filter(s => s.signal === 'SELL').length;

      if (buySignals > sellSignals && buySignals >= 2) {
        overallSignal = 'STRONG_BUY';
      } else if (buySignals > sellSignals) {
        overallSignal = 'BUY';
      } else if (sellSignals > buySignals && sellSignals >= 2) {
        overallSignal = 'STRONG_SELL';
      } else if (sellSignals > buySignals) {
        overallSignal = 'SELL';
      }

      res.json({
        symbol,
        interval,
        timestamp: new Date().toISOString(),
        overallSignal,
        confidence: Math.min(confidence, 100),
        signals,
        indicators: {
          rsi: rsi.current,
          macd: macd.current,
          ema20: ema20.current,
          ema50: ema50.current
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new MarketController();

// ===============================================
// backend/src/routes/market.routes.js
// ===============================================
const express = require('express');
const router = express.Router();
const marketController = require('../controllers/market.controller');

// Live quotes
router.get('/quotes', marketController.getQuotes);

// Historical data
router.get('/history/:symbol', marketController.getHistory);

// Single indicator
router.post('/indicators', marketController.getIndicators);

// Multiple indicators
router.post('/indicators/multi', marketController.getMultipleIndicators);

// Trading signals
router.post('/signals', marketController.getSignals);

module.exports = router;
