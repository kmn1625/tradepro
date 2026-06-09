import { useState, useRef } from 'react';
import { Plus, Trash2, Zap, Save, FolderOpen, Upload, AlertCircle, CheckCircle, X } from 'lucide-react';

const ORDER_TYPES = ['MKT', 'LIMIT', 'SL-M', 'SL-L'];
const PRODUCTS    = ['MIS', 'CNC', 'NRML'];

// ─── Built-in strategy templates ─────────────────────────────────────────────
const TEMPLATES = {
  Straddle: (sym, exp, stk) => [
    { symbol: sym, expiry: exp, strike: stk, optType: 'CE', side: 'BUY',  lots: 1, orderType: 'MKT', product: 'NRML' },
    { symbol: sym, expiry: exp, strike: stk, optType: 'PE', side: 'BUY',  lots: 1, orderType: 'MKT', product: 'NRML' },
  ],
  Strangle: (sym, exp, stk) => {
    const s = Number(stk) || 22000;
    return [
      { symbol: sym, expiry: exp, strike: s + 500, optType: 'CE', side: 'BUY', lots: 1, orderType: 'MKT', product: 'NRML' },
      { symbol: sym, expiry: exp, strike: s - 500, optType: 'PE', side: 'BUY', lots: 1, orderType: 'MKT', product: 'NRML' },
    ];
  },
  'Iron Condor': (sym, exp, stk) => {
    const s = Number(stk) || 22000;
    return [
      { symbol: sym, expiry: exp, strike: s + 500,  optType: 'CE', side: 'SELL', lots: 1, orderType: 'MKT', product: 'NRML' },
      { symbol: sym, expiry: exp, strike: s + 1000, optType: 'CE', side: 'BUY',  lots: 1, orderType: 'MKT', product: 'NRML' },
      { symbol: sym, expiry: exp, strike: s - 500,  optType: 'PE', side: 'SELL', lots: 1, orderType: 'MKT', product: 'NRML' },
      { symbol: sym, expiry: exp, strike: s - 1000, optType: 'PE', side: 'BUY',  lots: 1, orderType: 'MKT', product: 'NRML' },
    ];
  },
  'Bull Call Spread': (sym, exp, stk) => {
    const s = Number(stk) || 22000;
    return [
      { symbol: sym, expiry: exp, strike: s,       optType: 'CE', side: 'BUY',  lots: 1, orderType: 'MKT', product: 'NRML' },
      { symbol: sym, expiry: exp, strike: s + 500, optType: 'CE', side: 'SELL', lots: 1, orderType: 'MKT', product: 'NRML' },
    ];
  },
  'Bear Put Spread': (sym, exp, stk) => {
    const s = Number(stk) || 22000;
    return [
      { symbol: sym, expiry: exp, strike: s,       optType: 'PE', side: 'BUY',  lots: 1, orderType: 'MKT', product: 'NRML' },
      { symbol: sym, expiry: exp, strike: s - 500, optType: 'PE', side: 'SELL', lots: 1, orderType: 'MKT', product: 'NRML' },
    ];
  },
  'Covered Call': (sym, exp, stk) => {
    const s = Number(stk) || 22000;
    return [
      { symbol: sym, expiry: '',  strike: '',      optType: '',   side: 'BUY',  lots: 1, orderType: 'MKT', product: 'CNC' },
      { symbol: sym, expiry: exp, strike: s + 500, optType: 'CE', side: 'SELL', lots: 1, orderType: 'MKT', product: 'NRML' },
    ];
  },
};

function newLeg() {
  return {
    _id: Date.now() + Math.random(),
    symbol: 'NIFTY', expiry: '', strike: '', optType: 'CE',
    side: 'BUY', lots: 1, orderType: 'MKT', product: 'MIS',
    price: '', triggerPrice: '',
  };
}

// ─── Strategy picker modal ────────────────────────────────────────────────────
function StrategyPicker({ onApply, onClose }) {
  const [sym, setSym] = useState('NIFTY');
  const [exp, setExp] = useState('');
  const [stk, setStk] = useState('22000');
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-slate-800">Options Strategy</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Symbol',     value: sym, set: setSym, ph: 'NIFTY' },
            { label: 'Expiry',     value: exp, set: setExp, ph: 'YYYY-MM-DD' },
            { label: 'ATM Strike', value: stk, set: setStk, ph: '22000' },
          ].map(f => (
            <div key={f.label}>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">{f.label}</label>
              <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(TEMPLATES).map(([name, fn]) => (
            <button key={name} onClick={() => onApply(fn(sym, exp, stk))}
              className="bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-xl p-3 text-left transition-all">
              <p className="font-black text-slate-800 text-xs">{name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{fn('', '', '22000').length} legs</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Leg table row ────────────────────────────────────────────────────────────
function LegRow({ leg, upd, rem }) {
  const needsPrice   = leg.orderType === 'LIMIT' || leg.orderType === 'SL-L';
  const needsTrigger = leg.orderType === 'SL-M'  || leg.orderType === 'SL-L';
  const inp = 'border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300';
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className="px-3 py-2">
        <input value={leg.symbol} onChange={e => upd('symbol', e.target.value.toUpperCase())}
          className={`${inp} w-24 uppercase`} />
      </td>
      <td className="px-3 py-2">
        <input value={leg.expiry} onChange={e => upd('expiry', e.target.value)}
          placeholder="YYYY-MM-DD" className={`${inp} w-28`} />
      </td>
      <td className="px-3 py-2">
        <input type="number" value={leg.strike} onChange={e => upd('strike', e.target.value)}
          placeholder="0" className={`${inp} w-20`} />
      </td>
      <td className="px-3 py-2">
        <div className="flex rounded-lg overflow-hidden border border-slate-200">
          {['CE', 'PE', '—'].map(o => {
            const v = o === '—' ? '' : o;
            return (
              <button key={o} onClick={() => upd('optType', v)}
                className={`px-2 py-1.5 text-[10px] font-black transition-colors ${
                  leg.optType === v
                    ? o === 'CE' ? 'bg-emerald-600 text-white' : o === 'PE' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-white'
                    : 'bg-white text-slate-400 hover:bg-slate-50'
                }`}>{o}</button>
            );
          })}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex rounded-lg overflow-hidden border border-slate-200">
          {['BUY', 'SELL'].map(s => (
            <button key={s} onClick={() => upd('side', s)}
              className={`px-2 py-1.5 text-[10px] font-black transition-colors ${
                leg.side === s ? (s === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'bg-white text-slate-400 hover:bg-slate-50'
              }`}>{s}</button>
          ))}
        </div>
      </td>
      <td className="px-3 py-2">
        <input type="number" min="1" value={leg.lots}
          onChange={e => upd('lots', Math.max(1, Number(e.target.value)))}
          className={`${inp} w-14 text-center`} />
      </td>
      <td className="px-3 py-2">
        <select value={leg.orderType} onChange={e => upd('orderType', e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none">
          {ORDER_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <select value={leg.product} onChange={e => upd('product', e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none">
          {PRODUCTS.map(p => <option key={p}>{p}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        {needsPrice && (
          <input type="number" step="0.05" placeholder="price" value={leg.price}
            onChange={e => upd('price', e.target.value)}
            className={`${inp} w-20`} />
        )}
      </td>
      <td className="px-3 py-2">
        {needsTrigger && (
          <input type="number" step="0.05" placeholder="trigger" value={leg.triggerPrice}
            onChange={e => upd('triggerPrice', e.target.value)}
            className={`${inp} w-20`} />
        )}
      </td>
      <td className="px-3 py-2">
        <button onClick={rem} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={13} /></button>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BasketOrder() {
  const [legs, setLegs]   = useState([newLeg()]);
  const [name, setName]   = useState('');
  const [load, setLoad]   = useState('');
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tp_baskets') || '{}'); } catch { return {}; }
  });
  const [showStrat, setShowStrat]   = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [executing, setExecuting]   = useState(false);
  const [result, setResult]         = useState(null);
  const csvRef = useRef();

  const addLeg = () => setLegs(l => [...l, newLeg()]);
  const remLeg = id => setLegs(l => l.filter(x => x._id !== id));
  const updLeg = (id, f, v) => setLegs(l => l.map(x => x._id === id ? { ...x, [f]: v } : x));

  const saveBasket = () => {
    if (!name.trim() || legs.length === 0) return;
    const key = name.trim();
    const updated = { ...saved, [key]: legs.map(({ _id, ...rest }) => rest) };
    setSaved(updated);
    localStorage.setItem('tp_baskets', JSON.stringify(updated));
    setName('');
    setResult({ ok: true, msg: `Basket "${key}" saved` });
    setTimeout(() => setResult(null), 3000);
  };

  const loadBasket = (key) => {
    const stored = saved[key];
    if (!stored) return;
    setLegs(stored.map(l => ({ ...l, _id: Date.now() + Math.random() })));
    setLoad('');
  };

  const deleteBasket = (key) => {
    const updated = { ...saved };
    delete updated[key];
    setSaved(updated);
    localStorage.setItem('tp_baskets', JSON.stringify(updated));
    setLoad('');
  };

  const applyStrategy = (stratLegs) => {
    setLegs(stratLegs.map(l => ({ ...l, _id: Date.now() + Math.random() })));
    setShowStrat(false);
  };

  const importCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = ev.target.result.split('\n').filter(l => l.trim());
      const rows = lines.slice(1).map(line => {
        const cols = line.split(',').map(s => s.trim().replace(/"/g, ''));
        const [symbol, expiry, strike, optType, side, lots, orderType, product, price, triggerPrice] = cols;
        if (!symbol) return null;
        return {
          _id: Date.now() + Math.random(),
          symbol: symbol.toUpperCase(),
          expiry: expiry || '',
          strike: strike || '',
          optType: (optType || 'CE').toUpperCase(),
          side: (side || 'BUY').toUpperCase(),
          lots: Math.max(1, Number(lots) || 1),
          orderType: (orderType || 'MKT').toUpperCase(),
          product: (product || 'MIS').toUpperCase(),
          price: price || '',
          triggerPrice: triggerPrice || '',
        };
      }).filter(Boolean);
      if (rows.length) setLegs(rows);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const csv = 'symbol,expiry,strike,optType,side,lots,orderType,product,price,triggerPrice\nNIFTY,2026-06-26,22000,CE,BUY,1,MKT,MIS,,\nNIFTY,2026-06-26,22000,PE,BUY,1,MKT,MIS,,\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'basket_template.csv';
    a.click();
  };

  const buildApiLegs = () => legs.map(({ _id, ...rest }) => ({
    ...rest,
    ...(rest.price        ? { price:        Number(rest.price) }        : {}),
    ...(rest.triggerPrice ? { triggerPrice: Number(rest.triggerPrice) } : {}),
  }));

  const execute = async () => {
    setExecuting(true);
    setResult(null);
    setConfirmState(null);
    try {
      const res = await fetch('/api/market/basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legs: buildApiLegs(), confirmLive: false }),
      });
      const data = await res.json();
      if (res.status === 428) { setConfirmState(data); return; }
      setResult({ ok: data.status !== 'failed', msg: data.status === 'filled' ? `${data.fills?.length} leg(s) filled` : `Partial — ${data.fills?.length} filled, ${data.failed?.length} failed` });
    } catch (e) {
      setResult({ ok: false, msg: e.message });
    } finally { setExecuting(false); }
  };

  const executeLive = async () => {
    setExecuting(true);
    setConfirmState(null);
    try {
      const res = await fetch('/api/market/basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legs: buildApiLegs(), confirmLive: true }),
      });
      const data = await res.json();
      setResult({ ok: data.status !== 'failed', msg: data.status === 'filled' ? `${data.fills?.length} LIVE leg(s) placed` : `Partial — ${data.fills?.length} ok, ${data.failed?.length} failed` });
    } catch (e) {
      setResult({ ok: false, msg: e.message });
    } finally { setExecuting(false); }
  };

  const savedKeys = Object.keys(saved);

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Basket Orders</h2>
          <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-widest">Multi-leg · Options strategies · CSV import</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowStrat(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-all">
            Options Strategy
          </button>
          <button onClick={addLeg}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all">
            <Plus size={12} /> Add Leg
          </button>
        </div>
      </div>

      {/* Save / Load / Import row */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-end gap-4">
        {/* Save */}
        <div className="flex items-end gap-2">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Save As</label>
            <input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveBasket()}
              placeholder="My Iron Condor"
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44" />
          </div>
          <button onClick={saveBasket} disabled={!name.trim() || legs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50">
            <Save size={12} /> Save
          </button>
        </div>

        {/* Load */}
        {savedKeys.length > 0 && (
          <div className="flex items-end gap-2">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Load Basket</label>
              <select value={load} onChange={e => setLoad(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44">
                <option value="">— select —</option>
                {savedKeys.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <button onClick={() => loadBasket(load)} disabled={!load}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50">
              <FolderOpen size={12} /> Load
            </button>
            {load && (
              <button onClick={() => deleteBasket(load)}
                className="px-3 py-2 border border-rose-200 hover:bg-rose-50 text-rose-500 rounded-xl text-xs font-bold transition-all">
                Delete
              </button>
            )}
          </div>
        )}

        {/* CSV import */}
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">CSV Import</label>
            <div className="flex gap-2">
              <button onClick={() => csvRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-xs transition-all">
                <Upload size={12} /> Import
              </button>
              <button onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-xs transition-all">
                Template
              </button>
            </div>
          </div>
          <input ref={csvRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />
        </div>
      </div>

      {/* Legs table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {legs.length === 0 ? (
          <div className="text-center py-14">
            <p className="text-slate-400 text-sm">No legs yet. Add legs or load an options strategy.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900 text-white">
                  {['Symbol', 'Expiry', 'Strike', 'Type', 'Side', 'Lots', 'Order', 'Product', 'Price', 'Trigger', ''].map((h, i) => (
                    <th key={i} className="px-3 py-3 text-left font-bold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {legs.map(leg => (
                  <LegRow key={leg._id} leg={leg}
                    upd={(f, v) => updLeg(leg._id, f, v)}
                    rem={() => remLeg(leg._id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm live gate */}
      {confirmState && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-3">
          <p className="font-black text-amber-800 text-sm">⚠ LIVE BASKET ORDER — {confirmState.preview?.length || legs.length} leg(s)</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {(confirmState.preview || []).map((p, i) => (
              <div key={i} className="font-mono text-xs text-amber-900 bg-amber-100 rounded px-2 py-1">
                {p.side} {p.tradingSymbol || p.symbol} × {p.quantity} [{p.orderType} / {p.product}]
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={executeLive} disabled={executing}
              className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50">
              {executing ? 'Placing…' : 'Confirm Live Basket'}
            </button>
            <button onClick={() => setConfirmState(null)} disabled={executing}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-black">
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={`rounded-xl p-4 text-sm font-bold flex items-center gap-2 ${result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {result.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {result.msg}
        </div>
      )}

      {/* Execute footer bar */}
      <div className="sticky bottom-4 bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-lg">
        <p className="text-sm text-slate-500 font-semibold">{legs.length} leg{legs.length !== 1 ? 's' : ''} in basket</p>
        <button onClick={execute} disabled={executing || legs.length === 0}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-7 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50 shadow-xl shadow-indigo-600/20">
          <Zap size={14} /> {executing ? 'Placing…' : `Execute ${legs.length} Leg${legs.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      {showStrat && <StrategyPicker onApply={applyStrategy} onClose={() => setShowStrat(false)} />}
    </div>
  );
}
