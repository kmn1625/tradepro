// market.controller.js
const marketDataService = require('../services/marketData.service');

class MarketController {
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

  async getHistory(req, res) {
    try {
      const { symbol } = req.params;
      const { interval = '5m', limit = 100 } = req.query;
      const result = await marketDataService.getHistoricalData(symbol, interval, parseInt(limit));
      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getIndicators(req, res) {
    try {
      const { symbol, indicator = 'RSI', interval = '5m', period = 14 } = req.body;
      const historyResult = await marketDataService.getHistoricalData(symbol, interval, 100);
      if (!historyResult.success) {
        return res.status(500).json({ error: historyResult.error });
      }
      const indicatorResult = marketDataService.calculateIndicator(
        historyResult.data, indicator, parseInt(period)
      );
      res.json(indicatorResult);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMultipleIndicators(req, res) {
    try {
      const { symbol, interval = '5m' } = req.body;
      const historyResult = await marketDataService.getHistoricalData(symbol, interval, 100);
      if (!historyResult.success) {
        return res.status(500).json({ error: historyResult.error });
      }
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
      if (!historyResult.success) {
        return res.status(500).json({ error: historyResult.error });
      }

      const rsi = marketDataService.calculateIndicator(historyResult.data, 'RSI', 14);
      const macd = marketDataService.calculateIndicator(historyResult.data, 'MACD');
      const ema20 = marketDataService.calculateIndicator(historyResult.data, 'EMA', 20);
      const ema50 = marketDataService.calculateIndicator(historyResult.data, 'EMA', 50);

      const signals = [];
      let confidence = 0;

      if (rsi.signal === 'OVERSOLD') {
        signals.push({ indicator: 'RSI', signal: 'BUY', reason: 'RSI below 30 - Oversold' });
        confidence += 25;
      } else if (rsi.signal === 'OVERBOUGHT') {
        signals.push({ indicator: 'RSI', signal: 'SELL', reason: 'RSI above 70 - Overbought' });
        confidence += 25;
      }
      if (macd.signal === 'BULLISH') {
        signals.push({ indicator: 'MACD', signal: 'BUY', reason: 'MACD bullish crossover' });
        confidence += 25;
      } else if (macd.signal === 'BEARISH') {
        signals.push({ indicator: 'MACD', signal: 'SELL', reason: 'MACD bearish crossover' });
        confidence += 25;
      }
      if (ema20.current !== null && ema50.current !== null) {
        if (ema20.current > ema50.current) {
          signals.push({ indicator: 'EMA', signal: 'BUY', reason: 'EMA20 above EMA50 - Uptrend' });
          confidence += 25;
        } else {
          signals.push({ indicator: 'EMA', signal: 'SELL', reason: 'EMA20 below EMA50 - Downtrend' });
          confidence += 25;
        }
      }

      const buyCount = signals.filter(s => s.signal === 'BUY').length;
      const sellCount = signals.filter(s => s.signal === 'SELL').length;
      let overallSignal = 'NEUTRAL';
      if (buyCount > sellCount && buyCount >= 2) overallSignal = 'STRONG_BUY';
      else if (buyCount > sellCount) overallSignal = 'BUY';
      else if (sellCount > buyCount && sellCount >= 2) overallSignal = 'STRONG_SELL';
      else if (sellCount > buyCount) overallSignal = 'SELL';

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
          ema50: ema50.current,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new MarketController();
