import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw, X } from 'lucide-react';
import OrderTicket from './OrderTicket';

const UNDERLYINGS = ['All', 'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK'];
const SEGMENTS    = ['All', 'INDEX', 'STOCK'];
const EXPIRY_TYPES = [
  { id: 'All',  label: 'All Expiries' },
  { id: 'near', label: 'Near Month'   },
  { id: 'mid',  label: 'Mid Month'    },
  { id: 'far',  label: 'Far Month'    },
];

function Chip({ label, selected, onClick }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
        selected ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
      }`}>
      {label}
    </button>
  );
}

export default function Futures() {
  const [contracts,      setContracts]      = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [filterSymbol,   setFilterSymbol]   = useState('All');
  const [filterSegment,  setFilterSegment]  = useState('All');
  const [filterExpiry,   setFilterExpiry]   = useState('All');
  const [selected,       setSelected]       = useState(null);
  const [side,           setSide]           = useState('BUY');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (filterSymbol  !== 'All') p.set('symbol',  filterSymbol);
      if (filterSegment !== 'All') p.set('segment', filterSegment);
      const res = await fetch(`/api/futures?${p}`);
      if (!res.ok) throw new Error('Failed to load futures');
      let data = await res.json();
      if (filterExpiry !== 'All') data = data.filter(c => c.expiryType === filterExpiry);
      setContracts(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterSymbol, filterSegment, filterExpiry]);

  useEffect(() => { load(); }, [load]);

  const rollover = contracts.filter(c => c.rolloverAlert);

  const open = (c, s) => { setSide(s); setSelected(c); };

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Futures</h2>
          <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-widest">NSE F&O · Index & Stock futures</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Rollover alert */}
      {rollover.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-black text-sm">Rollover Alert — {rollover.length} contract{rollover.length > 1 ? 's' : ''} expiring soon</p>
            <p className="text-amber-700 text-xs mt-0.5">
              {rollover.map(c => `${c.tradingSymbol} (${c.daysToExpiry}d left)`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-14 flex-shrink-0">Symbol</span>
          {UNDERLYINGS.map(s => <Chip key={s} label={s} selected={filterSymbol === s} onClick={() => setFilterSymbol(s)} />)}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-14 flex-shrink-0">Segment</span>
          {SEGMENTS.map(s => <Chip key={s} label={s} selected={filterSegment === s} onClick={() => setFilterSegment(s)} />)}
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 flex-shrink-0">Expiry</span>
          {EXPIRY_TYPES.map(e => <Chip key={e.id} label={e.label} selected={filterExpiry === e.id} onClick={() => setFilterExpiry(e.id)} />)}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-14">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900 text-white">
                  {['Symbol', 'Expiry', 'DTE', 'LTP ₹', 'Change', 'Lot', 'Contract Value ₹', 'Margin ₹', 'OI', 'Volume', 'Trade'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((c, i) => (
                  <tr key={i} className={`transition-colors hover:bg-slate-50 ${c.rolloverAlert ? 'bg-amber-50/60' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-800">{c.tradingSymbol}</p>
                      <p className="text-[10px] text-slate-400">{c.name} · {c.segment}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono">{c.expiry}</td>
                    <td className="px-4 py-3">
                      <span className={`font-black ${c.daysToExpiry <= 5 ? 'text-amber-600' : 'text-slate-700'}`}>{c.daysToExpiry}d</span>
                      {c.rolloverAlert && (
                        <span className="ml-1 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black uppercase">Roll</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">₹{c.ltp.toLocaleString('en-IN')}</td>
                    <td className={`px-4 py-3 font-bold ${c.changePct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      <div className="flex items-center gap-1">
                        {c.changePct >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {c.changePct >= 0 ? '+' : ''}{c.changePct}%
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono">{c.lotSize}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">₹{c.contractValue.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">₹{c.margin.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-slate-500">{c.openInterest.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-slate-500">{c.volume.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => open(c, 'BUY')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black transition-colors">B</button>
                        <button onClick={() => open(c, 'SELL')}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-black transition-colors">S</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {contracts.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-12 text-slate-400">No contracts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order ticket modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <OrderTicket
            symbol={selected.tradingSymbol}
            ltp={selected.ltp}
            initialSide={side}
            onClose={() => setSelected(null)}
            showBulk={false}
          />
        </div>
      )}
    </div>
  );
}
