'use strict';

function buildEquityCurve(orders, initialCapital = 500000) {
  let capital = initialCapital;
  const curve = [{ date: 'Start', value: capital }];
  const sorted = [...orders].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  for (const o of sorted) {
    const val = (o.qty || 0) * (o.price || 0);
    if (o.side === 'BUY') capital -= val;
    else capital += val;
    curve.push({
      date: new Date(o.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      value: Math.round(capital),
    });
  }
  return curve;
}

function calcAllocation(positions) {
  const items = Object.entries(positions || {})
    .map(([symbol, pos]) => ({ symbol, value: (pos.qty || 0) * (pos.ltp || pos.avgPrice || 0) }))
    .filter(i => i.value > 0);
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return items.map(i => ({
    symbol: i.symbol,
    value: Math.round(i.value),
    pct: parseFloat((i.value / total * 100).toFixed(1)),
  }));
}

const SECTOR_MAP = {
  RELIANCE: 'Energy', ONGC: 'Energy', BPCL: 'Energy',
  TCS: 'IT', INFY: 'IT', WIPRO: 'IT', HCLTECH: 'IT', TECHM: 'IT',
  HDFCBANK: 'Finance', ICICIBANK: 'Finance', SBIN: 'Finance', AXISBANK: 'Finance', KOTAKBANK: 'Finance',
  TATASTEEL: 'Metals', HINDALCO: 'Metals', JSWSTEEL: 'Metals',
  MARUTI: 'Auto', TATAMOTORS: 'Auto', HEROMOTOCO: 'Auto',
  GOLD: 'Commodity', CRUDEOIL: 'Commodity', SILVER: 'Commodity',
  NIFTY: 'Index', BANKNIFTY: 'Index',
};

function calcSectorAllocation(positions) {
  const totals = {};
  for (const [symbol, pos] of Object.entries(positions || {})) {
    const value = (pos.qty || 0) * (pos.ltp || pos.avgPrice || 0);
    if (value <= 0) continue;
    const key = Object.keys(SECTOR_MAP).find(k => symbol.toUpperCase().includes(k));
    const sector = key ? SECTOR_MAP[key] : 'Other';
    totals[sector] = (totals[sector] || 0) + value;
  }
  const total = Object.values(totals).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(totals).map(([sector, value]) => ({
    sector,
    value: Math.round(value),
    pct: parseFloat((value / total * 100).toFixed(1)),
  }));
}

function calcCAGR(initialValue, finalValue, years) {
  if (!initialValue || !years) return 0;
  return parseFloat(((Math.pow(finalValue / initialValue, 1 / years) - 1) * 100).toFixed(2));
}

function calcSharpe(equityCurve, riskFreeAnnual = 7) {
  if (equityCurve.length < 3) return 0;
  const values = equityCurve.map(p => p.value);
  const returns = [];
  for (let i = 1; i < values.length; i++) {
    returns.push((values[i] - values[i - 1]) / values[i - 1] * 100);
  }
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - avg, 2), 0) / returns.length;
  const stddev = Math.sqrt(variance) || 1;
  const dailyRF = riskFreeAnnual / 252;
  return parseFloat(((avg - dailyRF) / stddev * Math.sqrt(252)).toFixed(2));
}

function calcMaxDrawdown(equityCurve) {
  let peak = -Infinity, maxDD = 0;
  for (const { value } of equityCurve) {
    if (value > peak) peak = value;
    const dd = peak > 0 ? (peak - value) / peak * 100 : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return parseFloat(maxDD.toFixed(2));
}

function calcPnL(orders) {
  let realised = 0;
  const buyMap = {};
  const sorted = [...orders].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  for (const o of sorted) {
    const sym = o.symbol;
    if (o.side === 'BUY') {
      (buyMap[sym] = buyMap[sym] || []).push({ qty: o.qty, price: o.price });
    } else if (o.side === 'SELL' && buyMap[sym]?.length) {
      let qty = o.qty;
      while (qty > 0 && buyMap[sym].length) {
        const buy = buyMap[sym][0];
        const matched = Math.min(qty, buy.qty);
        realised += matched * (o.price - buy.price);
        buy.qty -= matched;
        qty -= matched;
        if (buy.qty === 0) buyMap[sym].shift();
      }
    }
  }
  return { realised: Math.round(realised) };
}

function calcRiskScore(maxDrawdown, sharpe, allocation) {
  const ddRisk = Math.min(maxDrawdown / 5, 4);
  const sRisk = sharpe < 0 ? 3 : sharpe < 1 ? 2 : sharpe < 2 ? 1 : 0;
  const topPct = allocation.length ? Math.max(...allocation.map(a => a.pct)) : 0;
  const cRisk = topPct > 80 ? 3 : topPct > 60 ? 2 : topPct > 40 ? 1 : 0;
  return Math.min(Math.round(ddRisk + sRisk + cRisk), 10);
}

module.exports = {
  buildEquityCurve,
  calcAllocation,
  calcSectorAllocation,
  calcCAGR,
  calcSharpe,
  calcMaxDrawdown,
  calcPnL,
  calcRiskScore,
};
