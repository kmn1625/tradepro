import React, { useState, useEffect } from 'react';
import { Key, Plus, Copy, Check, Trash2, Power, RefreshCw, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Strategies() {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    strategyName: '',
    mode: 'paper',
    initialCapital: 1000000,
    slippage: 0.001,
  });

  const fetchStrategies = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/strategies`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setStrategies(data.strategies || []);
    } catch (err) {
      setError('Failed to load strategies: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStrategies(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.strategyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'HTTP ' + res.status);
      }
      const created = await res.json();
      setStrategies(prev => [created, ...prev]);
      setForm({ strategyName: '', mode: 'paper', initialCapital: 1000000, slippage: 0.001 });
    } catch (err) {
      setError('Failed to create strategy: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (token, isActive) => {
    try {
      const res = await fetch(`${API_BASE}/api/strategies/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const updated = await res.json();
      setStrategies(prev => prev.map(s => s.token === token ? updated : s));
    } catch (err) {
      setError('Failed to update strategy: ' + err.message);
    }
  };

  const deleteStrategy = async (token, name) => {
    if (!window.confirm(`Delete strategy "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/strategies/${token}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setStrategies(prev => prev.filter(s => s.token !== token));
    } catch (err) {
      setError('Failed to delete strategy: ' + err.message);
    }
  };

  const copyToken = async (token) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      setError('Clipboard access denied — copy the token manually');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Create form */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Key size={20} />
          </div>
          <div>
            <h2 className="font-black text-xl text-slate-800">New Strategy</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Generate webhook token</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Strategy Name
            </label>
            <input
              type="text"
              value={form.strategyName}
              onChange={e => setForm(f => ({ ...f, strategyName: e.target.value }))}
              placeholder="NIFTY Short Straddle"
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Mode
            </label>
            <select
              value={form.mode}
              onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="paper">Paper</option>
              <option value="live">Live</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Capital (₹)
            </label>
            <input
              type="number"
              value={form.initialCapital}
              onChange={e => setForm(f => ({ ...f, initialCapital: Number(e.target.value) }))}
              min={1000}
              step={10000}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {error && (
            <div className="md:col-span-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-4 py-3 rounded-xl">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
            </div>
          )}

          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={creating || !form.strategyName.trim()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create Strategy
            </button>
          </div>
        </form>
      </div>

      {/* Strategy list */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-xl text-slate-800">Your Strategies</h3>
            <p className="text-xs text-slate-400 mt-0.5">Copy a token → paste it as your TradingView webhook URL parameter</p>
          </div>
          <button
            onClick={fetchStrategies}
            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="animate-spin text-slate-300" size={32} />
          </div>
        ) : strategies.length === 0 ? (
          <div className="p-16 text-center">
            <Key size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-bold">No strategies yet.</p>
            <p className="text-slate-300 text-sm mt-1">
              Create one above. The generated token is your TradingView webhook token.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-5 text-left">Name</th>
                  <th className="px-8 py-5 text-left">Mode</th>
                  <th className="px-8 py-5 text-left">Capital</th>
                  <th className="px-8 py-5 text-left">Token</th>
                  <th className="px-8 py-5 text-center">Status</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {strategies.map(s => (
                  <tr key={s.token} className={`transition-colors ${s.isActive ? 'hover:bg-slate-50/50' : 'opacity-60 hover:bg-slate-50/30'}`}>
                    <td className="px-8 py-5 font-bold text-slate-800">{s.strategyName}</td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                        s.mode === 'live'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {s.mode === 'live' ? 'LIVE DISABLED' : (s.mode || 'paper').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-8 py-5 font-mono text-sm text-slate-600">
                      ₹{(s.initialCapital || 1000000).toLocaleString('en-IN')}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded truncate max-w-[140px]">
                          {s.token}
                        </code>
                        <button
                          onClick={() => copyToken(s.token)}
                          className="flex-shrink-0 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Copy token"
                        >
                          {copiedToken === s.token
                            ? <Check size={14} className="text-emerald-500" />
                            : <Copy size={14} />
                          }
                        </button>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                        s.isActive
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {s.isActive ? 'ACTIVE' : 'PAUSED'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleActive(s.token, s.isActive)}
                          className={`p-2 rounded-xl transition-colors ${
                            s.isActive
                              ? 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                              : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'
                          }`}
                          title={s.isActive ? 'Pause strategy' : 'Activate strategy'}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          onClick={() => deleteStrategy(s.token, s.strategyName)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Delete strategy"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Webhook usage hint */}
        {strategies.length > 0 && (
          <div className="px-8 py-5 bg-slate-50 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 font-mono">
              TradingView alert message format:{' '}
              <code className="bg-white border border-slate-200 px-2 py-0.5 rounded text-indigo-600">
                {`{"token":"<paste-token>","action":"BUY","symbol":"NIFTY50","quantity":"50"}`}
              </code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
