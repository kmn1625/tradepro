import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, Shield, BarChart2, RefreshCw, AlertCircle } from 'lucide-react';

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981'];

const RISK_LABEL = ['', 'Very Low', 'Low', 'Low-Med', 'Medium', 'Medium', 'Med-High', 'High', 'High', 'Very High', 'Critical'];
const RISK_COLOR = [
  '', 'text-emerald-600', 'text-emerald-500', 'text-lime-500', 'text-yellow-500', 'text-yellow-600',
  'text-orange-500', 'text-orange-600', 'text-red-500', 'text-red-600', 'text-red-700',
];

function MetricCard({ label, value, sub, icon: Icon, positive }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        {Icon && <Icon size={16} className="text-slate-300" />}
      </div>
      <p className={`text-2xl font-black ${positive === true ? 'text-emerald-600' : positive === false ? 'text-rose-500' : 'text-slate-800'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const fmtINR = n => `₹${Math.abs(n).toLocaleString('en-IN')}${n < 0 ? ' (loss)' : ''}`;

export default function PortfolioAnalytics({ orders = [], positions = {}, balance = 500000 }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders, positions, initialCapital: balance }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orders, positions, balance]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="max-w-6xl mx-auto flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-700">
      <AlertCircle size={18} /> {error}
    </div>
  );

  if (!data) return null;

  const { cagr, sharpe, maxDrawdown, realised, riskScore, equityCurve, allocation, sectorAllocation, beta, alpha, mode } = data;

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Portfolio Analytics</h2>
          <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-widest">
            {mode === 'mock' ? 'Demo data — place trades to see real metrics' : 'Live portfolio metrics'}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="CAGR" value={`${cagr > 0 ? '+' : ''}${cagr}%`} sub="Annualised return" icon={TrendingUp} positive={cagr > 0} />
        <MetricCard label="Sharpe Ratio" value={sharpe} sub="Risk-adjusted return" icon={Activity} positive={sharpe > 1} />
        <MetricCard label="Max Drawdown" value={`${maxDrawdown}%`} sub="Peak-to-trough decline" icon={TrendingDown} positive={maxDrawdown < 10} />
        <MetricCard label="Realised P&L" value={fmtINR(realised)} sub="Closed trades" icon={BarChart2} positive={realised > 0} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Risk Score</p>
          <p className={`text-2xl font-black ${RISK_COLOR[riskScore] || 'text-slate-800'}`}>{riskScore}/10</p>
          <p className="text-xs text-slate-400 mt-0.5">{RISK_LABEL[riskScore]}</p>
        </div>
        {beta !== null && <MetricCard label="Beta" value={beta} sub="vs Nifty 50" icon={Shield} positive={beta < 1} />}
        {alpha !== null && <MetricCard label="Alpha" value={`${alpha > 0 ? '+' : ''}${alpha}%`} sub="Excess return" icon={TrendingUp} positive={alpha > 0} />}
      </div>

      {/* Equity Curve */}
      {equityCurve.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-black text-slate-700 text-sm mb-4 uppercase tracking-widest">Portfolio Value</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={equityCurve} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, 'Value']}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Allocation + Sector */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Allocation Pie */}
        {allocation.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-black text-slate-700 text-sm mb-4 uppercase tracking-widest">Holdings Allocation</h3>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={allocation} dataKey="pct" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {allocation.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, _, p) => [`${v}%`, p.payload.symbol]}
                    contentStyle={{ borderRadius: 10, fontSize: 11, border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {allocation.map((item, i) => (
                  <div key={item.symbol} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="font-semibold text-slate-700 truncate max-w-[100px]">{item.symbol}</span>
                    </div>
                    <span className="font-bold text-slate-500">{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sector Bar */}
        {sectorAllocation.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-black text-slate-700 text-sm mb-4 uppercase tracking-widest">Sector Exposure</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sectorAllocation} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="sector" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={v => `${v}%`} />
                <Tooltip formatter={v => [`${v}%`, 'Allocation']}
                  contentStyle={{ borderRadius: 10, fontSize: 11, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                  {sectorAllocation.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

    </div>
  );
}
