/**
 * screener.service.js
 * Builds screener datasets from live market price map + mock universe.
 * Used by screener.controller.js — no external API needed, works on feed data.
 */

// Mock stock universe (extended with base prices)
const STOCK_UNIVERSE = [
  { symbol: 'RELIANCE', sector: 'Energy',        basePrice: 2890 },
  { symbol: 'TCS',      sector: 'IT',            basePrice: 3780 },
  { symbol: 'HDFCBANK', sector: 'Banking',       basePrice: 1670 },
  { symbol: 'INFY',     sector: 'IT',            basePrice: 1540 },
  { symbol: 'ICICIBANK',sector: 'Banking',       basePrice: 1120 },
  { symbol: 'HINDUNILVR',sector:'FMCG',          basePrice: 2430 },
  { symbol: 'ITC',      sector: 'FMCG',          basePrice: 470  },
  { symbol: 'SBIN',     sector: 'Banking',       basePrice: 830  },
  { symbol: 'BAJFINANCE',sector:'Finance',       basePrice: 6750 },
  { symbol: 'BHARTIARTL',sector:'Telecom',       basePrice: 1290 },
  { symbol: 'WIPRO',    sector: 'IT',            basePrice: 560  },
  { symbol: 'HCLTECH',  sector: 'IT',            basePrice: 1420 },
  { symbol: 'KOTAKBANK',sector: 'Banking',       basePrice: 1750 },
  { symbol: 'LT',       sector: 'Capital Goods', basePrice: 3590 },
  { symbol: 'AXISBANK', sector: 'Banking',       basePrice: 1090 },
  { symbol: 'ASIANPAINT',sector:'Paint',         basePrice: 2870 },
  { symbol: 'MARUTI',   sector: 'Auto',          basePrice: 12500},
  { symbol: 'SUNPHARMA',sector: 'Pharma',        basePrice: 1620 },
  { symbol: 'ULTRACEMCO',sector:'Cement',        basePrice: 10200},
  { symbol: 'TITAN',    sector: 'Consumer',      basePrice: 3340 },
  { symbol: 'NESTLEIND',sector: 'FMCG',          basePrice: 2410 },
  { symbol: 'POWERGRID',sector: 'Power',         basePrice: 320  },
  { symbol: 'NTPC',     sector: 'Power',         basePrice: 355  },
  { symbol: 'TATAMOTORS',sector:'Auto',          basePrice: 980  },
  { symbol: 'TATASTEEL',sector: 'Metals',        basePrice: 170  },
  { symbol: 'JSWSTEEL', sector: 'Metals',        basePrice: 920  },
  { symbol: 'COALINDIA',sector: 'Energy',        basePrice: 480  },
  { symbol: 'ONGC',     sector: 'Energy',        basePrice: 270  },
  { symbol: 'BPCL',     sector: 'Energy',        basePrice: 630  },
  { symbol: 'CIPLA',    sector: 'Pharma',        basePrice: 1480 },
];

// Live price map, updated by server.js
const livePrices = {};

function updatePrice(symbol, price, prevClose, volume) {
  livePrices[symbol.toUpperCase()] = { price, prevClose, volume, ts: Date.now() };
}

function _enrich() {
  return STOCK_UNIVERSE.map(s => {
    const live = livePrices[s.symbol] || {};
    const price     = live.price     || s.basePrice;
    const prevClose = live.prevClose || s.basePrice;
    const volume    = live.volume    || Math.floor(Math.random() * 5000000 + 500000);
    const change    = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;
    const avgVolume = s.basePrice * 1000; // rough avg volume proxy
    const volumeRatio = volume / avgVolume;
    return { ...s, price, prevClose, change, changePct, volume, volumeRatio };
  });
}

function getGainers(n = 10) {
  return _enrich()
    .filter(s => s.changePct > 0)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, n);
}

function getLosers(n = 10) {
  return _enrich()
    .filter(s => s.changePct < 0)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, n);
}

function getVolumeShockers(n = 10) {
  return _enrich()
    .filter(s => s.volumeRatio > 1.5)
    .sort((a, b) => b.volumeRatio - a.volumeRatio)
    .slice(0, n);
}

// Simulate RSI values (in prod: compute from candle history)
function getRsiScan({ min = 0, max = 100, n = 20 } = {}) {
  return _enrich()
    .map(s => {
      // deterministic mock RSI based on price momentum
      const momentum = Math.abs(s.changePct);
      const base = s.changePct > 0 ? 50 + momentum * 5 : 50 - momentum * 5;
      const rsi = Math.min(100, Math.max(0, base + (Math.sin(s.basePrice) * 10)));
      return { ...s, rsi: parseFloat(rsi.toFixed(1)) };
    })
    .filter(s => s.rsi >= min && s.rsi <= max)
    .sort((a, b) => b.rsi - a.rsi)
    .slice(0, n);
}

// Stocks near 52w high (simulated)
function getBreakouts(n = 10) {
  return _enrich()
    .map(s => {
      const weekHigh52 = s.basePrice * 1.18;
      const nearHigh = (s.price / weekHigh52) * 100;
      return { ...s, weekHigh52: parseFloat(weekHigh52.toFixed(2)), nearHighPct: parseFloat(nearHigh.toFixed(1)) };
    })
    .filter(s => s.nearHighPct >= 95)
    .sort((a, b) => b.nearHighPct - a.nearHighPct)
    .slice(0, n);
}

// Gap up/down: price vs prev close gap at open
function getGaps(n = 10) {
  return _enrich()
    .map(s => {
      // Mock: use current change as gap proxy
      return { ...s, gapPct: s.changePct };
    })
    .filter(s => Math.abs(s.gapPct) > 1)
    .sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct))
    .slice(0, n);
}

module.exports = { updatePrice, getGainers, getLosers, getVolumeShockers, getRsiScan, getBreakouts, getGaps };
