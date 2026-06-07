import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts';

// Payoff graph — P&L at expiry vs underlying price.
// legs: [{ side: 'BUY'|'SELL', type: 'CE'|'PE', strike: number, ltp: number, lots: number }]
// spot: current underlying price (indigo reference line)
// scenarioSpot: optional — scenario shifted spot (amber dashed reference line)
// lotSize: 50 for NIFTY, 15 for BANKNIFTY
const PayoffGraph = ({ legs = [], spot = 22500, lotSize = 50, scenarioSpot }) => {
  const data = useMemo(() => {
    if (!legs.length) return [];
    const low  = spot * 0.85;
    const high = spot * 1.15;
    const step = (high - low) / 100;
    const points = [];

    const netPremium = legs.reduce((sum, leg) => {
      const dir = leg.side === 'BUY' ? -1 : 1;
      return sum + dir * leg.ltp * leg.lots * lotSize;
    }, 0);

    for (let x = low; x <= high; x += step) {
      let intrinsic = 0;
      for (const leg of legs) {
        const dir = leg.side === 'BUY' ? 1 : -1;
        const payoff = leg.type === 'CE'
          ? Math.max(x - leg.strike, 0)
          : Math.max(leg.strike - x, 0);
        intrinsic += dir * payoff * leg.lots * lotSize;
      }
      const pnl = intrinsic + netPremium;
      points.push({ price: Math.round(x), pnl: parseFloat(pnl.toFixed(0)) });
    }
    return points;
  }, [legs, spot, lotSize]);

  if (!legs.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-300 font-bold">
        Add legs to see payoff graph
      </div>
    );
  }

  const showScenario = scenarioSpot !== undefined && scenarioSpot !== null && Math.round(scenarioSpot) !== Math.round(spot);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Payoff at Expiry</h3>
        {showScenario && (
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-indigo-500" />Spot
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-amber-400 border-dashed border-t-2 border-amber-400" />Scenario
            </span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="price" tick={{ fontSize: 10, fill: '#94a3b8' }} tickCount={7} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
          <Tooltip
            formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'P&L']}
            labelFormatter={(v) => `Spot: ₹${v}`}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <ReferenceLine x={spot} stroke="#6366f1" strokeDasharray="4 4" label={{ value: 'Spot', fill: '#6366f1', fontSize: 10 }} />
          {showScenario && (
            <ReferenceLine
              x={Math.round(scenarioSpot)}
              stroke="#f59e0b"
              strokeDasharray="6 3"
              label={{ value: 'Scenario', fill: '#d97706', fontSize: 10 }}
            />
          )}
          <ReferenceLine y={0} stroke="#94a3b8" />
          <Line
            type="monotone" dataKey="pnl"
            stroke={data.some(d => d.pnl > 0) ? '#10b981' : '#f43f5e'}
            strokeWidth={2} dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PayoffGraph;
