import { useState } from 'react';
import { Play, BarChart2, TrendingUp, TrendingDown } from 'lucide-react';
import ConditionBuilder from './ConditionBuilder';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const UNDERLYINGS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'];

// Backtest runner — configure strategy, run against historical data, view metrics.
// Requires historical data pipeline (Phase 4 — Angel One SmartAPI integration).
const BacktestRunner = () => {
  const [underlying,  setUnderlying]  = useState('NIFTY');
  const [dateFrom,    setDateFrom]    = useState('2024-01-01');
  const [dateTo,      setDateTo]      = useState(new Date().toISOString().slice(0, 10));
  const [condition,   setCondition]   = useState(null);
  const [running,     setRunning]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState(null);

  const runBacktest = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/backtest/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          underlying,
          dateRange: { from: dateFrom, to: dateTo },
          entry: condition?.entry,
          exit:  condition?.exit,
          legs: [
            { side: 'SELL', type: 'CE', strikeOffset: 0, expiry: 'weekly', lots: 1 },
            { side: 'SELL', type: 'PE', strikeOffset: 0, expiry: 'weekly', lots: 1 },
          ],
        }),
      });
      const data = await res.json();
      if (data.status === 'COMING_SOON') {
        setError(data.detail || 'Backtest engine not yet available — historical data pipeline (Phase 4) required first.');
        return;
      }
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800">Strategy Backtester</h2>
        <span className="text-xs font-bold bg-amber-100 text-amber-600 px-3 py-1.5 rounded-full uppercase">
          Requires Historical Data (Phase 4)
        </span>
      </div>

      {/* Config row */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Underlying</label>
            <select value={underlying} onChange={e => setUnderlying(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-sm">
              {UNDERLYINGS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div className="flex items-end">
            <button
              onClick={runBacktest}
              disabled={running}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
            >
              <Play size={14} /> {running ? 'Running…' : 'Run Backtest'}
            </button>
          </div>
        </div>
      </div>

      {/* Condition builder */}
      <ConditionBuilder onChange={setCondition} />

      {/* Error */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-700 font-bold text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total P&L',   value: `₹${result.totalPnl?.toLocaleString('en-IN')}`, color: result.totalPnl >= 0 ? 'text-emerald-600' : 'text-rose-600' },
              { label: 'Win Rate',    value: `${result.winRate}%`,     color: 'text-indigo-600' },
              { label: 'Trades',      value: result.tradeCount,        color: 'text-slate-700' },
              { label: 'Max Drawdown',value: `${result.maxDrawdown}%`, color: 'text-rose-600' },
              { label: 'Sharpe',      value: result.sharpe?.toFixed(2),color: result.sharpe >= 1 ? 'text-emerald-600' : 'text-amber-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <span className="block text-[10px] font-black text-slate-400 uppercase mb-1">{label}</span>
                <span className={`text-2xl font-black ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BacktestRunner;
