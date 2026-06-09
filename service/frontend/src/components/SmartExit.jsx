import { useState, useEffect, useCallback } from 'react';
import { Shield, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${on ? 'bg-indigo-600' : 'bg-slate-200'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function SettingInput({ label, value, onChange, min, max, step, hint }) {
  return (
    <div>
      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1">{label}</label>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function SmartExit({ positions = {}, balance = 500000 }) {
  const [guardStatus,  setGuardStatus]  = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [saveLoading,  setSaveLoading]  = useState(false);
  const [msg,          setMsg]          = useState(null);

  const [maxLoss,    setMaxLoss]    = useState(10000);
  const [maxTrades,  setMaxTrades]  = useState(20);
  const [capProtect, setCapProtect] = useState(10);

  // Per-position smart exit settings (local UI state)
  const [posSettings, setPosSettings] = useState({});

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/risk/status');
      if (res.ok) {
        const data = await res.json();
        setGuardStatus(data);
        setMaxLoss(data.settings.maxLossPerDay);
        setMaxTrades(data.settings.maxTradesPerDay);
        setCapProtect(data.settings.capitalProtectionPct);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const saveSettings = async () => {
    setSaveLoading(true);
    try {
      const res = await fetch('/api/risk/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxLossPerDay: maxLoss, maxTradesPerDay: maxTrades, capitalProtectionPct: capProtect }),
      });
      if (!res.ok) throw new Error('Save failed');
      await fetchStatus();
      flash('ok', 'Risk settings saved');
    } catch (e) {
      flash('error', e.message);
    } finally { setSaveLoading(false); }
  };

  const resetDay = async () => {
    try {
      const res = await fetch('/api/risk/reset', { method: 'POST' });
      if (res.ok) { await fetchStatus(); flash('ok', 'Day counters reset'); }
    } catch {}
  };

  const updPos = (symbol, field, value) =>
    setPosSettings(prev => ({ ...prev, [symbol]: { ...(prev[symbol] || {}), [field]: value } }));

  const posEntries = Object.entries(positions).filter(([, v]) => v && v.qty > 0);
  const triggered  = guardStatus && !guardStatus.canTrade && guardStatus.state?.triggered;
  const canTrade   = guardStatus?.canTrade;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Smart Exit</h2>
          <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-widest">Risk guard · Target lock · Trailing stop</p>
        </div>
        <button onClick={fetchStatus} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 ${msg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle size={14} />} {msg.text}
        </div>
      )}

      {/* Risk Guard status hero */}
      <div className={`rounded-[2.5rem] p-8 ${triggered ? 'bg-rose-900' : 'bg-[#0f172a]'} text-white`}>
        <div className="flex items-center gap-3 mb-5">
          <Shield size={20} className={triggered ? 'text-rose-400' : canTrade ? 'text-emerald-400' : 'text-slate-400'} />
          <h3 className="font-black text-lg">Risk Guard</h3>
          <span className={`ml-auto text-[10px] font-black px-3 py-1 rounded-full uppercase ${triggered ? 'bg-rose-600' : canTrade ? 'bg-emerald-600' : 'bg-slate-600'}`}>
            {triggered ? 'Triggered' : canTrade ? 'Active' : 'Loading…'}
          </span>
        </div>

        {triggered && (
          <div className="bg-rose-800/40 border border-rose-700 rounded-xl p-3 mb-4 text-sm">
            <p className="text-rose-200 font-semibold">⚠ {guardStatus?.reason}</p>
            <p className="text-rose-300 text-xs mt-1">New trades are blocked.{' '}
              <button onClick={resetDay} className="underline hover:text-white">Reset day counters</button>
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Today's P&L",
              value: `${(guardStatus?.state?.dailyPnL || 0) >= 0 ? '+' : ''}₹${Math.abs(guardStatus?.state?.dailyPnL || 0).toLocaleString('en-IN')}`,
              color: (guardStatus?.state?.dailyPnL || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400',
            },
            {
              label: 'Trades Today',
              value: `${guardStatus?.state?.tradesCount || 0} / ${maxTrades}`,
              color: (guardStatus?.state?.tradesCount || 0) >= maxTrades ? 'text-amber-400' : 'text-white',
            },
            {
              label: 'Protected Capital',
              value: `₹${Math.round(balance * capProtect / 100).toLocaleString('en-IN')}`,
              color: 'text-indigo-300',
            },
          ].map(c => (
            <div key={c.label} className="bg-white/5 rounded-2xl p-4">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{c.label}</p>
              <p className={`text-xl font-black mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Risk settings */}
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6">
        <h3 className="font-black text-slate-700 text-sm uppercase tracking-widest mb-5">Risk Guard Settings</h3>
        <div className="grid md:grid-cols-3 gap-5">
          <SettingInput
            label="Max Loss Per Day (₹)" value={maxLoss} onChange={setMaxLoss}
            min={1000} step={1000}
            hint="Block trading when daily loss exceeds this amount" />
          <SettingInput
            label="Max Trades Per Day" value={maxTrades} onChange={setMaxTrades}
            min={1} step={1}
            hint="Block new orders after this many trades" />
          <SettingInput
            label="Capital Protection (%)" value={capProtect} onChange={setCapProtect}
            min={1} max={50} step={1}
            hint={`Protect ₹${Math.round(balance * capProtect / 100).toLocaleString('en-IN')} of your capital`} />
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={saveSettings} disabled={saveLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50">
            {saveLoading ? 'Saving…' : 'Save Risk Settings'}
          </button>
          <button onClick={resetDay}
            className="border border-slate-200 hover:bg-slate-50 text-slate-600 px-5 py-2.5 rounded-xl font-bold text-sm transition-all">
            Reset Day Counters
          </button>
        </div>
      </div>

      {/* Per-position smart exit */}
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6">
        <h3 className="font-black text-slate-700 text-sm uppercase tracking-widest mb-5">Position Smart Exit</h3>
        {posEntries.length === 0 ? (
          <div className="text-center py-10">
            <Shield size={36} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No open positions. Place trades to configure smart exit.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posEntries.map(([symbol, pos]) => {
              const ps = posSettings[symbol] || {};
              return (
                <div key={symbol} className="border border-slate-200 rounded-2xl p-5 hover:border-indigo-200 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div>
                      <p className="font-black text-slate-800">{symbol}</p>
                      <p className="text-xs text-slate-400">{pos.qty} qty · avg ₹{Number(pos.avgPrice || 0).toFixed(2)}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">Target Lock</span>
                      <Toggle on={!!ps.targetLock} onChange={v => updPos(symbol, 'targetLock', v)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Target (%)',    field: 'targetPct',   ph: 'e.g. 5',  dis: !ps.targetLock },
                      { label: 'Trailing SL (%)', field: 'trailingSLPct', ph: 'e.g. 2'  },
                      { label: 'Partial Exit (%)', field: 'partialPct', ph: 'e.g. 50' },
                      { label: 'Max Loss (%)',  field: 'maxLossPct',  ph: 'e.g. 3'  },
                    ].map(f => (
                      <div key={f.field}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">{f.label}</label>
                        <input type="number" min="0" max="100" step="0.5"
                          placeholder={f.ph} disabled={f.dis}
                          value={ps[f.field] || ''}
                          onChange={e => updPos(symbol, f.field, e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-40 disabled:bg-slate-50" />
                      </div>
                    ))}
                  </div>

                  {ps.targetLock && ps.targetPct && (
                    <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-700 font-semibold">
                      Auto-exit target: ₹{(Number(pos.avgPrice) * (1 + Number(ps.targetPct) / 100)).toFixed(2)}
                      {ps.trailingSLPct && ` · Trail SL ${ps.trailingSLPct}%`}
                      {ps.partialPct    && ` · Book ${ps.partialPct}% at target`}
                      {ps.maxLossPct    && ` · Hard SL at ₹${(Number(pos.avgPrice) * (1 - Number(ps.maxLossPct) / 100)).toFixed(2)}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
