import { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, Trash2, CheckCircle, Clock, AlertCircle, X } from 'lucide-react';

const SYMBOLS = [
  'NIFTY 50 (Index)', 'BANK NIFTY (Index)', 'RELIANCE', 'TCS', 'HDFCBANK',
  'INFY', 'ICICIBANK', 'SBIN', 'BAJFINANCE', 'BHARTIARTL', 'WIPRO', 'HCLTECH',
];

export default function Alerts({ wsRef }) {
  const [alerts, setAlerts]     = useState([]);
  const [symbol, setSymbol]     = useState('NIFTY 50 (Index)');
  const [condition, setCondition] = useState('above');
  const [price, setPrice]       = useState('');
  const [note, setNote]         = useState('');
  const [msg, setMsg]           = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) setAlerts(await res.json());
    } catch {}
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  // Listen for PRICE_ALERT WS events
  useEffect(() => {
    const ws = wsRef?.current;
    if (!ws) return;
    const handler = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      if (msg.type === 'PRICE_ALERT') loadAlerts();
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [wsRef, loadAlerts]);

  const createAlert = async () => {
    if (!price) return flash('error', 'Enter target price');
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, condition, price: parseFloat(price), note }),
      });
      if (!res.ok) { const d = await res.json(); return flash('error', d.error); }
      setPrice(''); setNote('');
      await loadAlerts();
      flash('success', `Alert set: ${symbol} ${condition} ₹${price}`);
    } catch { flash('error', 'Failed to create alert'); }
  };

  const deleteAlert = async (id) => {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const clearTriggered = async () => {
    await fetch('/api/alerts/triggered', { method: 'DELETE' });
    await loadAlerts();
  };

  const displayed = alerts.filter(a => {
    if (activeTab === 'active')    return !a.triggered;
    if (activeTab === 'triggered') return a.triggered;
    return true;
  });

  const triggeredCount = alerts.filter(a => a.triggered).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 ${msg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle size={14} />} {msg.text}
        </div>
      )}

      {/* Create alert */}
      <div className="bg-white rounded-[2rem] border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Plus size={16} className="text-indigo-600" />
          </div>
          <h3 className="font-black text-slate-800">Create Price Alert</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={condition}
            onChange={e => setCondition(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="above">Price Above</option>
            <option value="below">Price Below</option>
          </select>

          <input
            type="number"
            placeholder="Target Price (₹)"
            value={price}
            onChange={e => setPrice(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />

          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <button
          onClick={createAlert}
          className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all"
        >
          Set Alert
        </button>
      </div>

      {/* Alert list */}
      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {['all', 'active', 'triggered'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                  activeTab === tab ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab} {tab === 'triggered' && triggeredCount > 0 ? `(${triggeredCount})` : ''}
              </button>
            ))}
          </div>
          {triggeredCount > 0 && (
            <button onClick={clearTriggered} className="text-xs font-bold text-rose-400 hover:text-rose-600 transition-colors flex items-center gap-1">
              <X size={12} /> Clear triggered
            </button>
          )}
        </div>

        {displayed.length === 0 ? (
          <div className="py-16 text-center">
            <Bell size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-300 font-bold text-sm">No alerts</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {displayed.map(a => (
              <div key={a.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors ${a.triggered ? 'opacity-60' : ''}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${a.triggered ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  {a.triggered
                    ? <CheckCircle size={14} className="text-emerald-500" />
                    : <Clock size={14} className="text-amber-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800">
                    {a.symbol}
                    <span className={`ml-2 text-xs font-bold ${a.condition === 'above' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {a.condition === 'above' ? '▲ above' : '▼ below'} ₹{a.price.toLocaleString('en-IN')}
                    </span>
                  </p>
                  {a.note && <p className="text-xs text-slate-400 mt-0.5">{a.note}</p>}
                  <p className="text-[10px] text-slate-300 mt-0.5">
                    {a.triggered
                      ? `Triggered ${new Date(a.triggeredAt).toLocaleString('en-IN')}`
                      : `Set ${new Date(a.createdAt).toLocaleString('en-IN')}`
                    }
                  </p>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${a.triggered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {a.triggered ? 'TRIGGERED' : 'ACTIVE'}
                </span>
                <button onClick={() => deleteAlert(a.id)} className="text-slate-300 hover:text-rose-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
