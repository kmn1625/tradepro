import { useState } from 'react';
import { Play, Square, Plus, Zap } from 'lucide-react';
import ConditionBuilder from './ConditionBuilder';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Algo Scripts — define, deploy, and monitor automated trading strategies.
// Each script = condition JSON + execution config (instrument, lots, mode).
// Execution: evaluates conditions against live WS feed → auto-order via Kotak API.
// TODO: backend algo runner service (evaluates condition tree against live marketData ticks)
const AlgoScripts = () => {
  const [scripts, setScripts]       = useState([]);
  const [creating, setCreating]     = useState(false);
  const [draft, setDraft]           = useState({ name: '', underlying: 'NIFTY', lots: 1, mode: 'PAPER', condition: null });

  const saveScript = () => {
    if (!draft.name) return;
    setScripts(prev => [...prev, {
      id:        Date.now(),
      ...draft,
      status:    'STOPPED',
      createdAt: new Date().toISOString(),
      trades:    0,
      pnl:       0,
    }]);
    setDraft({ name: '', underlying: 'NIFTY', lots: 1, mode: 'PAPER', condition: null });
    setCreating(false);
  };

  const toggleScript = (id) => {
    setScripts(prev => prev.map(s => {
      if (s.id !== id) return s;
      const next = s.status === 'RUNNING' ? 'STOPPED' : 'RUNNING';
      // TODO: POST /api/algo/start or /api/algo/stop with script config
      // Backend algo runner: subscribes to WS ticks, evaluates condition, places Kotak order
      return { ...s, status: next };
    }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800">Algo Scripts</h2>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
        >
          <Plus size={14} /> New Script
        </button>
      </div>

      {/* Active scripts list */}
      {scripts.length === 0 && !creating ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap size={28} className="text-indigo-400" />
          </div>
          <p className="font-bold text-slate-500 text-lg">No algo scripts yet</p>
          <p className="text-slate-300 text-sm mt-1">Create a script to automate your strategy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scripts.map(script => (
            <div key={script.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-6">
              <div className={`w-2 h-10 rounded-full ${script.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-200'}`} />
              <div className="flex-1">
                <p className="font-black text-slate-800">{script.name}</p>
                <p className="text-xs text-slate-400">{script.underlying} · {script.lots} lot{script.lots > 1 ? 's' : ''} · {script.mode}</p>
              </div>
              <div className="text-right text-sm">
                <span className="block text-slate-400 text-xs uppercase">Trades</span>
                <span className="font-black">{script.trades}</span>
              </div>
              <div className="text-right text-sm">
                <span className="block text-slate-400 text-xs uppercase">P&L</span>
                <span className={`font-black ${script.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ₹{script.pnl.toLocaleString('en-IN')}
                </span>
              </div>
              <button
                onClick={() => toggleScript(script.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  script.status === 'RUNNING'
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                }`}
              >
                {script.status === 'RUNNING' ? <><Square size={12} /> Stop</> : <><Play size={12} /> Start</>}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create new script panel */}
      {creating && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-indigo-50/50">
            <h3 className="font-black text-slate-800">New Algo Script</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Script Name</label>
                <input type="text" value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. NIFTY Straddle Sell"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Underlying</label>
                <select value={draft.underlying} onChange={e => setDraft(p => ({ ...p, underlying: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-sm">
                  {['NIFTY', 'BANKNIFTY', 'FINNIFTY'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Mode</label>
                <select value={draft.mode} onChange={e => setDraft(p => ({ ...p, mode: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-sm">
                  <option value="PAPER">Paper</option>
                  <option value="LIVE">Live</option>
                </select>
              </div>
            </div>

            <ConditionBuilder onChange={cond => setDraft(p => ({ ...p, condition: cond }))} />

            <div className="flex gap-3">
              <button onClick={saveScript} disabled={!draft.name}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 transition-all">
                Save Script
              </button>
              <button onClick={() => setCreating(false)}
                className="px-6 py-2.5 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlgoScripts;
