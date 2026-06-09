'use strict';

const svc = require('../services/analytics.service');

const MOCK_CURVE = [
  { date: 'Jan 1', value: 500000 },  { date: 'Jan 15', value: 512000 },
  { date: 'Feb 1', value: 498000 },  { date: 'Feb 15', value: 535000 },
  { date: 'Mar 1', value: 527000 },  { date: 'Mar 15', value: 558000 },
  { date: 'Apr 1', value: 542000 },  { date: 'Apr 15', value: 571000 },
  { date: 'May 1', value: 563000 },  { date: 'May 15', value: 589000 },
  { date: 'Jun 1', value: 575000 },  { date: 'Jun 8',  value: 612000 },
];

const MOCK_ALLOC = [
  { symbol: 'NIFTY 50',   value: 250000, pct: 40.8 },
  { symbol: 'BANK NIFTY', value: 150000, pct: 24.5 },
  { symbol: 'RELIANCE',   value: 80000,  pct: 13.1 },
  { symbol: 'TCS',        value: 75000,  pct: 12.3 },
  { symbol: 'GOLD MCX',   value: 56000,  pct: 9.3  },
];

const MOCK_SECTOR = [
  { sector: 'Index',     value: 400000, pct: 65.3 },
  { sector: 'IT',        value: 75000,  pct: 12.3 },
  { sector: 'Energy',    value: 80000,  pct: 13.1 },
  { sector: 'Commodity', value: 56000,  pct: 9.3  },
];

// POST /api/analytics/summary
// Body: { orders?: [...], positions?: {...}, initialCapital?: number }
exports.summary = (req, res) => {
  const { orders = [], positions = {}, initialCapital = 500000 } = req.body || {};
  const useMock = !orders.length && !Object.keys(positions).length;

  const curve      = useMock ? MOCK_CURVE : svc.buildEquityCurve(orders, initialCapital);
  const allocation = useMock ? MOCK_ALLOC : svc.calcAllocation(positions);
  const sectorAlloc = useMock ? MOCK_SECTOR : svc.calcSectorAllocation(positions);

  const first = curve[0]?.value || initialCapital;
  const last  = curve[curve.length - 1]?.value || initialCapital;
  const years = useMock ? 0.5 : Math.max(
    orders.length
      ? (Date.now() - new Date(orders[0]?.timestamp || Date.now())) / (365.25 * 24 * 3600 * 1000)
      : 0.5,
    0.01
  );

  const cagr     = useMock ? 14.3  : svc.calcCAGR(first, last, years);
  const sharpe   = useMock ? 1.42  : svc.calcSharpe(curve);
  const maxDD    = useMock ? 8.6   : svc.calcMaxDrawdown(curve);
  const { realised } = useMock ? { realised: 42000 } : svc.calcPnL(orders);
  const riskScore = useMock ? 4    : svc.calcRiskScore(maxDD, sharpe, allocation);

  res.json({
    cagr,
    sharpe,
    maxDrawdown: maxDD,
    realised,
    riskScore,
    equityCurve:     curve,
    allocation,
    sectorAllocation: sectorAlloc,
    beta:  useMock ? 0.82 : null,
    alpha: useMock ? 6.1  : null,
    mode:  useMock ? 'mock' : 'live',
  });
};
