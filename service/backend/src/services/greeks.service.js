'use strict';

// M17: Option Greeks and implied volatility from Black-Scholes.
// Input units: T in years, σ as decimal (0.15 = 15%), r as decimal.
// Theta output: daily decay in rupees per lot.

// ─── Standard normal helpers ──────────────────────────────────────────────────

function _norm_pdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function _norm_cdf(x) {
  const a1 = 0.319381530, a2 = -0.356563782, a3 = 1.781477937,
        a4 = -1.821255978, a5 = 1.330274429;
  const k   = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly = k * (a1 + k * (a2 + k * (a3 + k * (a4 + k * a5))));
  const cdf  = 1 - (_norm_pdf(x)) * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

function _d1d2(S, K, T, sigma, r) {
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  return { d1, d2, sqrtT };
}

// ─── Price ────────────────────────────────────────────────────────────────────

function price(S, K, T, sigma, r, type = 'CE') {
  if (T <= 0) return type === 'CE' ? Math.max(0, S - K) : Math.max(0, K - S);
  const { d1, d2 } = _d1d2(S, K, T, sigma, r);
  const disc = K * Math.exp(-r * T);
  if (type === 'CE') return Math.max(0, S * _norm_cdf(d1) - disc * _norm_cdf(d2));
  return Math.max(0, disc * _norm_cdf(-d2) - S * _norm_cdf(-d1));
}

// ─── Greeks ──────────────────────────────────────────────────────────────────

function greeks(S, K, T, sigma, r, type = 'CE') {
  if (T <= 0 || sigma <= 0) {
    return { delta: type === 'CE' ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
             gamma: 0, theta: 0, vega: 0, rho: 0 };
  }

  const { d1, d2, sqrtT } = _d1d2(S, K, T, sigma, r);
  const nd1 = _norm_pdf(d1);
  const disc = K * Math.exp(-r * T);

  const gamma  = nd1 / (S * sigma * sqrtT);
  const vega   = S * nd1 * sqrtT / 100;      // per 1% IV move
  let delta, theta, rho;

  if (type === 'CE') {
    delta = _norm_cdf(d1);
    theta = (-S * nd1 * sigma / (2 * sqrtT) - r * disc * _norm_cdf(d2)) / 365;
    rho   =  disc * T * _norm_cdf(d2) / 100; // per 1% rate move
  } else {
    delta = _norm_cdf(d1) - 1;
    theta = (-S * nd1 * sigma / (2 * sqrtT) + r * disc * _norm_cdf(-d2)) / 365;
    rho   = -disc * T * _norm_cdf(-d2) / 100;
  }

  return {
    delta: +delta.toFixed(4),
    gamma: +gamma.toFixed(6),
    theta: +theta.toFixed(4),
    vega:  +vega.toFixed(4),
    rho:   +rho.toFixed(4),
  };
}

// ─── Implied Volatility ───────────────────────────────────────────────────────

// Newton-Raphson IV solver. Returns IV or null if no solution found.
function impliedVolatility(marketPrice, S, K, T, r, type = 'CE', maxIter = 100) {
  if (marketPrice <= 0 || T <= 0) return null;

  // Intrinsic check
  const intrinsic = type === 'CE' ? Math.max(0, S - K) : Math.max(0, K - S);
  if (marketPrice < intrinsic) return null;

  let sigma = 0.3; // initial guess 30% IV

  for (let i = 0; i < maxIter; i++) {
    const p    = price(S, K, T, sigma, r, type);
    const diff = p - marketPrice;
    if (Math.abs(diff) < 0.001) break;

    // vega = dPrice/dSigma
    const { d1, sqrtT } = _d1d2(S, K, T, sigma, r);
    const vg = S * _norm_pdf(d1) * sqrtT;
    if (vg < 1e-10) break;

    sigma = sigma - diff / vg;
    if (sigma <= 0) sigma = 0.001;
    if (sigma > 5)  sigma = 5;
  }

  return sigma > 0 && sigma < 5 ? +sigma.toFixed(6) : null;
}

// ─── Enrich option chain row ──────────────────────────────────────────────────

// Add Greeks + IV to a single chain row {strike, ce:{ltp,iv,oi}, pe:{ltp,iv,oi}}.
// T = DTE in years, r = risk-free rate.
function enrichRow(row, spot, T, r = 0.065) {
  const K = row.strike;

  for (const type of ['CE', 'PE']) {
    const leg    = type === 'CE' ? row.ce : row.pe;
    const ltp    = leg.ltp || 0;
    const rawIV  = leg.iv  || 0;

    // Prefer market IV if available; otherwise compute from LTP
    let sigma = rawIV > 0 ? rawIV / 100 : null;
    if (!sigma && ltp > 0) {
      sigma = impliedVolatility(ltp, spot, K, T, r, type);
    }
    if (!sigma) sigma = 0.15; // fallback 15%

    const g = greeks(spot, K, T, sigma, r, type);
    leg.iv     = +(sigma * 100).toFixed(2);  // store as percentage
    leg.delta  = g.delta;
    leg.gamma  = g.gamma;
    leg.theta  = g.theta;
    leg.vega   = g.vega;
  }

  return row;
}

module.exports = { price, greeks, impliedVolatility, enrichRow };
