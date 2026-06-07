import { useState, useEffect, useRef } from 'react';
import { Play, Square, Plus, Zap, TrendingUp, Activity } from 'lucide-react';
import ConditionBuilder from './ConditionBuilder';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AlgoScripts = () => {
  const [scripts, setScripts]       = useState([]);
  const [creating, setCreating]     = useState(false);
  const [draft, setDraft]           = useState({ name: '', underlying: 'NIFTY', interval: '5m', mode: 'PAPER', condition: null });
  const [err, setErr]               = useState(null);
  const [saving, setSaving]         = useState(false);
  const pollRef                     = useRef(null);

  // Poll status for all RUNNING scripts every 5 seconds
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const running = scripts.filter(s => s.status === 'RUNNING' && s.token);
    if (!running.length) return;

    pollRef.current = setInterval(async () => {
      const updates = await Promise.all(
        running.map(s =>
          fetch(`${API_BASE}/api/algo/${s.token}/status`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      );
      setScripts(prev => prev.map(s => {
        const u = updates.find(u => u?.token === s.token);
        if (!u) return s;
        return { ...s, trades: u.trades, pnl: u.pnl, logs: u.logs, hasPosition: !!u.position };
      }));
    }, 5000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [scripts.map(s => `${s.token}:${s.status}`).join(',')]);

  const saveScript = async () => {
    if (!draft.name || !draft.condition) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/api/algo/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      draft.name,
          symbol:    draft.underlying,
          interval:  draft.interval,
          condition: draft.condition,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Start failed');
      setScripts(prev => [...prev, {
        id:        data.token,
        token:     data.token,
        name:      draft.name,
        underlying: draft.underlying,
        interval:  draft.interval,
        lots:      1,
        mode:      draft.mode,
        status:    'RUNNING',
        trades:    0,
        pnl:       0,
        logs:      [],
        hasPosition: false,
        condition: draft.condition,
      }]);
      setDraft({ name: '', underlying: 'NIFTY', interval: '5m', mode: 'PAPER', condition: null });
      setCreating(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleScript = async (id) => {
    const script = scripts.find(s => s.id === id);
    if (!script) return;

    if (script.status === 'RUNNING') {
      // Stop the script
      try {
        await fetch(`${API_BASE}/api/algo/stop/${script.token}`, { method: 'POST' });
      } catch { /* ignore network errors */ }
      setScripts(prev => prev.map(s => s.id === id ? { ...s, status: 'STOPPED' } : s));
    } else {
      // Restart: re-attach condition
      try {
        const res = await fetch(`${API_BASE}/api/algo/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:      script.name,
            symbol:    script.underlying,
            interval:  script.interval,
            condition: script.condition,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setScripts(prev => prev.map(s => s.id === id ? { ...s, token: data.token, status: 'RUNNING' } : s));
      } catch (e) {
        setErr(e.message);
      }
    }
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

      {err && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-4 py-3 rounded-xl flex justify-between items-center">
          {err}
          <button onClick={() => setErr(null)} className="underline ml-2">dismiss</button>
        </div>
      )}

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
            <div key={script.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 flex items-center gap-5">
                <div className={`w-2 h-10 rounded-full flex-shrink-0 ${
                  script.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-200'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800">{script.name}</p>
                  <p className="text-xs text-slate-400">
                    {script.underlying} · {script.interval} · {script.mode}
                    {script.hasPosition && <span className="ml-2 text-amber-500 font-bold">● IN POSITION</span>}
                  </p>
                </div>
                <div className="text-right text-sm flex-shrink-0">
                  <span className="block text-slate-400 text-xs uppercase">Trades</span>
                  <span className="font-black">{script.trades || 0}</span>
                </div>
                <div className="text-right text-sm flex-shrink-0">
                  <span className="block text-slate-400 text-xs uppercase">P&L</span>
                  <span className={`font-black ${(script.pnl || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    ₹{(script.pnl || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <button
                  onClick={() => toggleScript(script.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all flex-shrink-0 ${
                    script.status === 'RUNNING'
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                  }`}
                >
                  {script.status === 'RUNNING' ? <><Square size={12} /> Stop</> : <><Play size={12} /> Start</>}
                </button>
              </div>

              {/* Trade log */}
              {script.status === 'RUNNING' && script.logs?.length > 0 && (
                <div className="border-t border-slate-50 px-5 py-3 bg-slate-50/60">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Activity size={11} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trade Log</span>
                  </div>
                  <div className="space-y-0.5 max-h-24 overflow-y-auto">
                    {[...script.logs].reverse().map((log, i) => (
                      <p key={i} className={`text-xs font-mono ${
                        log.startsWith('ENTRY') ? 'text-indigo-600' : log.startsWith('EXIT') ? 'text-emerald-600' : 'text-slate-500'
                      }`}>{log}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create new script panel */}
      {creating && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-indigo-50/50 flex items-center gap-3">
            <TrendingUp size={18} className="text-indigo-500" />
            <h3 className="font-black text-slate-800">New Algo Script</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Script Name</label>
                <input type="text" value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. NIFTY RSI Mean Revert"
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
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Candle</label>
                <select value={draft.interval} onChange={e => setDraft(p => ({ ...p, interval: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-sm">
                  <option value="1m">1 min</option>
                  <option value="5m">5 min</option>
                </select>
              </div>
            </div>

            <ConditionBuilder onChange={cond => setDraft(p => ({ ...p, condition: cond }))} />

            {!draft.condition && (
              <p className="text-xs text-amber-600 font-bold">Define at least one entry + exit condition above before saving.</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={saveScript}
                disabled={!draft.name || !draft.condition || saving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 transition-all"
              >
                {saving ? 'Starting…' : <><Zap size={14} /> Deploy Script</>}
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
