'use strict';

const marketDataService = require('./marketData.service');

// Evaluates a single indicator leaf node.
// For crossover operators: compare indicator(candles) vs indicator(candles[:-1]).
function _evalIndicator(node, candles) {
  if (!candles || candles.length < 2) return false;
  const { indicator, operator, value, period, fast, slow } = node;
  const prev = candles.slice(0, -1);

  // EMA fast/slow crossover
  if (indicator === 'EMA' && fast && slow) {
    const cur = {
      fast: marketDataService.calculateIndicator(candles, 'EMA', fast).current,
      slow: marketDataService.calculateIndicator(candles, 'EMA', slow).current,
    };
    const prv = {
      fast: marketDataService.calculateIndicator(prev, 'EMA', fast).current,
      slow: marketDataService.calculateIndicator(prev, 'EMA', slow).current,
    };
    if (cur.fast === null || cur.slow === null || prv.fast === null || prv.slow === null) return false;
    if (operator === 'crossesAbove') return prv.fast <= prv.slow && cur.fast > cur.slow;
    if (operator === 'crossesBelow') return prv.fast >= prv.slow && cur.fast < cur.slow;
    if (operator === 'greaterThan')  return cur.fast > cur.slow;
    if (operator === 'lessThan')     return cur.fast < cur.slow;
    return false;
  }

  // BB: compare price against bands
  if (indicator === 'BB') {
    const bb  = marketDataService.calculateIndicator(candles, 'BB', period || 20);
    const bbP = marketDataService.calculateIndicator(prev, 'BB', period || 20);
    if (bb.current === null) return false;
    const threshold = value !== undefined ? value : bb.middle;
    if (operator === 'crossesAbove') return (bbP.current || 0) <= (bbP.upper || 0) && bb.current > bb.upper;
    if (operator === 'crossesBelow') return (bbP.current || 0) >= (bbP.lower || 0) && bb.current < bb.lower;
    if (operator === 'greaterThan')  return bb.current > threshold;
    if (operator === 'lessThan')     return bb.current < threshold;
    return false;
  }

  // SUPERTREND: trend direction crossings
  if (indicator === 'SUPERTREND') {
    const st  = marketDataService.calculateIndicator(candles, 'SUPERTREND', period || 7);
    const stP = marketDataService.calculateIndicator(prev, 'SUPERTREND', period || 7);
    if (!st.trend) return false;
    if (operator === 'crossesAbove') return stP.trend === 'BEARISH' && st.trend === 'BULLISH';
    if (operator === 'crossesBelow') return stP.trend === 'BULLISH' && st.trend === 'BEARISH';
    if (operator === 'greaterThan')  return st.trend === 'BULLISH';
    if (operator === 'lessThan')     return st.trend === 'BEARISH';
    return false;
  }

  // Standard numeric indicators: RSI, MACD, SMA, EMA(single), ATR, VWAP
  const cur = marketDataService.calculateIndicator(candles, indicator, period || 14).current;
  const prv = marketDataService.calculateIndicator(prev,   indicator, period || 14).current;
  if (cur === null || cur === undefined) return false;

  const threshold = value !== undefined ? value : 0;
  switch (operator) {
    case 'crossesAbove': return (prv || 0) <= threshold && cur > threshold;
    case 'crossesBelow': return (prv || 0) >= threshold && cur < threshold;
    case 'greaterThan':  return cur > threshold;
    case 'lessThan':     return cur < threshold;
    case 'equals':       return Math.abs(cur - threshold) < 0.01;
    default:             return false;
  }
}

function evaluateNode(node, candles, context) {
  if (!node) return false;

  if (node.AND) return node.AND.every(n => evaluateNode(n, candles, context));
  if (node.OR)  return node.OR.some(n  => evaluateNode(n, candles, context));

  if (node.type === 'time') {
    const now = new Date(context.time || Date.now());
    const [h, m] = (node.time || '15:15').split(':').map(Number);
    return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
  }

  if (node.type === 'sl') {
    const { entryPrice, currentPrice } = context;
    if (!entryPrice || !currentPrice) return false;
    const loss = (entryPrice - currentPrice) / entryPrice * 100;
    return loss >= (node.pct || 1.5);
  }

  if (node.type === 'target') {
    const { entryPrice, currentPrice } = context;
    if (!entryPrice || !currentPrice) return false;
    const gain = (currentPrice - entryPrice) / entryPrice * 100;
    return gain >= (node.pct || 2);
  }

  if (node.indicator) return _evalIndicator(node, candles);

  return false;
}

// Evaluate a condition tree (entry or exit) against a candle array.
// context: { currentPrice, entryPrice?, time? }
function evaluate(conditionTree, candles, context = {}) {
  if (!conditionTree || !candles || candles.length < 2) return false;
  return evaluateNode(conditionTree, candles, context);
}

module.exports = { evaluate, evaluateNode };
