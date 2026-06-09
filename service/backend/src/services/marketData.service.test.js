'use strict';

const svc = require('./marketData.service');

beforeEach(() => {
  svc.candles = {};
  svc.partialCandle = {};
  svc.lastPrice = {
    'NIFTY 50 (Index)': 22453.20,
    'BANK NIFTY (Index)': 47285.10,
    'GOLD (MCX)': 62450.00,
    'CRUDEOIL (MCX)': 6450.00,
  };
});

describe('_normalizeSymbol()', () => {
  test('maps NIFTY variant to "NIFTY 50 (Index)"', () => {
    expect(svc._normalizeSymbol('NIFTY')).toBe('NIFTY 50 (Index)');
    expect(svc._normalizeSymbol('nifty50')).toBe('NIFTY 50 (Index)');
  });

  test('maps BANK variant to "BANK NIFTY (Index)"', () => {
    expect(svc._normalizeSymbol('BANKNIFTY')).toBe('BANK NIFTY (Index)');
    expect(svc._normalizeSymbol('bank nifty')).toBe('BANK NIFTY (Index)');
  });

  test('null/undefined returns "NIFTY 50 (Index)"', () => {
    expect(svc._normalizeSymbol(null)).toBe('NIFTY 50 (Index)');
    expect(svc._normalizeSymbol(undefined)).toBe('NIFTY 50 (Index)');
  });

  test('GOLD maps to "GOLD (MCX)"', () => {
    expect(svc._normalizeSymbol('GOLD')).toBe('GOLD (MCX)');
  });
});

describe('processTick()', () => {
  test('creates partial candle for both 1m and 5m on first tick', () => {
    const now = Date.now();
    svc.processTick('NIFTY 50 (Index)', 22500, now);
    expect(svc.partialCandle['NIFTY 50 (Index)']['1m'].open).toBe(22500);
    expect(svc.partialCandle['NIFTY 50 (Index)']['5m'].open).toBe(22500);
  });

  test('updates high/low/close on ticks within same minute', () => {
    const ts = Math.floor(Date.now() / 60000) * 60000;
    svc.processTick('NIFTY 50 (Index)', 22500, ts + 1000);
    svc.processTick('NIFTY 50 (Index)', 22600, ts + 2000);
    svc.processTick('NIFTY 50 (Index)', 22400, ts + 3000);
    const c = svc.partialCandle['NIFTY 50 (Index)']['1m'];
    expect(c.high).toBe(22600);
    expect(c.low).toBe(22400);
    expect(c.close).toBe(22400);
  });

  test('seals candle when new minute starts', () => {
    const ts = Math.floor(Date.now() / 60000) * 60000;
    svc.processTick('NIFTY 50 (Index)', 22500, ts);
    svc.processTick('NIFTY 50 (Index)', 22600, ts + 60000);
    expect(svc.candles['NIFTY 50 (Index)']['1m']).toHaveLength(1);
    expect(svc.candles['NIFTY 50 (Index)']['1m'][0].close).toBe(22500);
  });

  test('updates lastPrice on each tick', () => {
    svc.processTick('NIFTY 50 (Index)', 23000, Date.now());
    expect(svc.lastPrice['NIFTY 50 (Index)']).toBe(23000);
  });
});

describe('calculateIndicator()', () => {
  const risingCandles = Array.from({ length: 30 }, (_, i) => ({ close: 100 + i }));
  const fallingCandles = Array.from({ length: 30 }, (_, i) => ({ close: 130 - i }));

  test('SMA returns correct period average', () => {
    const result = svc.calculateIndicator(risingCandles, 'SMA', 5);
    expect(result.indicator).toBe('SMA');
    expect(result.current).toBeCloseTo(127, 1);
  });

  test('RSI is OVERBOUGHT for consistently rising prices', () => {
    const result = svc.calculateIndicator(risingCandles, 'RSI', 14);
    expect(result.signal).toBe('OVERBOUGHT');
    expect(result.current).toBeGreaterThan(70);
  });

  test('RSI is OVERSOLD for consistently falling prices', () => {
    const result = svc.calculateIndicator(fallingCandles, 'RSI', 14);
    expect(result.signal).toBe('OVERSOLD');
    expect(result.current).toBeLessThan(30);
  });

  test('MACD returns ema12, ema26, signal for sufficient data', () => {
    const longCandles = Array.from({ length: 50 }, (_, i) => ({ close: 100 + i }));
    const result = svc.calculateIndicator(longCandles, 'MACD');
    expect(result.ema12).toBeDefined();
    expect(result.ema26).toBeDefined();
    expect(['BULLISH', 'BEARISH']).toContain(result.signal);
  });

  test('empty candles returns null current and NEUTRAL signal', () => {
    const result = svc.calculateIndicator([], 'SMA', 5);
    expect(result.current).toBeNull();
    expect(result.signal).toBe('NEUTRAL');
  });

  test('unknown indicator returns NEUTRAL', () => {
    expect(svc.calculateIndicator(risingCandles, 'UNKNOWN').signal).toBe('NEUTRAL');
  });
});

describe('getLiveQuotes()', () => {
  test('returns success + price data for known symbols', async () => {
    const result = await svc.getLiveQuotes(['NIFTY 50 (Index)']);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].symbol).toBe('NIFTY 50 (Index)');
    expect(typeof result.data[0].price).toBe('number');
  });

  test('returns all default symbols when called with null', async () => {
    const result = await svc.getLiveQuotes(null);
    expect(result.success).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
  });
});
