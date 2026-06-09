import { useState } from 'react';
import { FileText, Download, TrendingUp, TrendingDown, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';

const TABS = [
  { id: 'pnl',            label: 'P&L Report'      },
  { id: 'capital-gains',  label: 'Capital Gains'   },
  { id: 'contract-note',  label: 'Contract Note'   },
];

function DownloadBtn({ label, icon: Icon, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 transition-all">
      <Icon size={13} /> {label}
    </button>
  );
}

function PnLTable({ trades, totals, loading }) {
  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!trades?.length) return <p className="text-center text-slate-400 py-12 text-sm">No trades found for selected period.</p>;
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total Trades', value: totals.count },
          { label: 'Realised P&L', value: `₹${Math.abs(totals.realised).toLocaleString('en-IN')}`, positive: totals.realised >= 0 },
          { label: 'Avg per Trade', value: `₹${Math.abs(Math.round(totals.realised / totals.count)).toLocaleString('en-IN')}`, positive: totals.realised >= 0 },
        ].map(c => (
          <div key={c.label} className="bg-slate-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase">{c.label}</p>
            <p className={`text-xl font-black mt-1 ${c.positive === true ? 'text-emerald-600' : c.positive === false ? 'text-rose-500' : 'text-slate-800'}`}>
              {c.value}
            </p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900 text-white">
              {['Symbol', 'Buy Date', 'Sell Date', 'Qty', 'Buy ₹', 'Sell ₹', 'P&L ₹', 'Type'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trades.map((t, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-800">{t.symbol}</td>
                <td className="px-4 py-3 text-slate-500">{t.buyDate}</td>
                <td className="px-4 py-3 text-slate-500">{t.sellDate}</td>
                <td className="px-4 py-3">{t.qty}</td>
                <td className="px-4 py-3">₹{t.buyPrice.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3">₹{t.sellPrice.toLocaleString('en-IN')}</td>
                <td className={`px-4 py-3 font-black ${t.pnl >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {t.pnl >= 0 ? '+' : ''}₹{t.pnl.toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${t.type === 'LTCG' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {t.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CapGainsTable({ data, loading }) {
  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return null;
  const { stcg, ltcg, stcgTax, ltcgTax, totalTax } = data;
  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <p className="text-xs font-black text-amber-600 uppercase tracking-widest mb-1">Short-Term (STCG)</p>
          <p className={`text-3xl font-black ${stcg >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {stcg >= 0 ? '+' : ''}₹{Math.abs(stcg).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-amber-600 mt-2">Tax @ 15% = ₹{stcgTax.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">Long-Term (LTCG)</p>
          <p className={`text-3xl font-black ${ltcg >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {ltcg >= 0 ? '+' : ''}₹{Math.abs(ltcg).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-blue-600 mt-2">Tax @ 10% (above ₹1L) = ₹{ltcgTax.toLocaleString('en-IN')}</p>
        </div>
      </div>
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Estimated Tax Liability</p>
          <p className="text-3xl font-black mt-1">₹{totalTax.toLocaleString('en-IN')}</p>
        </div>
        <p className="text-xs text-slate-400 max-w-[200px] text-right">Consult a CA for accurate ITR computation. Tax rates as per FY26 norms.</p>
      </div>
    </div>
  );
}

function ContractTable({ trades, loading }) {
  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!trades?.length) return <p className="text-center text-slate-400 py-12 text-sm">No contract notes found.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-900 text-white">
            {['Trade ID', 'Symbol', 'Side', 'Qty', 'Price ₹', 'Value ₹', 'Brok ₹', 'STT ₹', 'Time'].map(h => (
              <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {trades.map((t, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-slate-500">{t.id}</td>
              <td className="px-4 py-3 font-bold text-slate-800">{t.symbol}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${t.side === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{t.side}</span>
              </td>
              <td className="px-4 py-3">{t.qty}</td>
              <td className="px-4 py-3">₹{t.price.toLocaleString('en-IN')}</td>
              <td className="px-4 py-3">₹{t.value.toLocaleString('en-IN')}</td>
              <td className="px-4 py-3">₹{t.brokerage}</td>
              <td className="px-4 py-3">₹{t.stt}</td>
              <td className="px-4 py-3 text-slate-500">{t.ts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Reports({ orders = [] }) {
  const [activeTab, setActiveTab] = useState('pnl');
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [loading, setLoading]     = useState(false);
  const [reportData, setReportData] = useState({});
  const [msg, setMsg]             = useState(null);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 5000); };

  const endpoint = activeTab === 'pnl' ? '/api/reports/pnl'
    : activeTab === 'capital-gains' ? '/api/reports/capital-gains'
    : '/api/reports/contract-note';

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders, from: from || undefined, to: to || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setReportData(prev => ({ ...prev, [activeTab]: json }));
    } catch (e) {
      flash('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const download = async (format) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders, from: from || undefined, to: to || undefined, format }),
      });
      if (!res.ok) { flash('error', 'Download failed'); return; }
      const blob = await res.blob();
      const ext  = format === 'pdf' ? 'pdf' : 'csv';
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${activeTab}_report.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      flash('error', 'Download failed');
    }
  };

  const current = reportData[activeTab];

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 ${msg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle size={14} />} {msg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Reports</h2>
          <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-widest">P&L · Capital Gains · Contract Notes</p>
        </div>
        {orders.length === 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl font-bold">Demo data (no trades found)</span>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-black text-slate-500 uppercase mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-black text-slate-500 uppercase mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <button onClick={fetchData} disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50">
          {loading ? 'Loading…' : 'Generate Report'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <DownloadBtn label="CSV" icon={FileSpreadsheet} onClick={() => download('csv')} disabled={!current} />
          <DownloadBtn label="PDF" icon={FileText} onClick={() => download('pdf')} disabled={!current} />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex gap-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === t.id ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        {activeTab === 'pnl'           && <PnLTable trades={current?.trades} totals={current?.totals} loading={loading && !current} />}
        {activeTab === 'capital-gains' && <CapGainsTable data={current} loading={loading && !current} />}
        {activeTab === 'contract-note' && <ContractTable trades={current?.trades} loading={loading && !current} />}

        {!current && !loading && (
          <div className="text-center py-12">
            <FileText size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Click <strong>Generate Report</strong> to load data.</p>
          </div>
        )}
      </div>
    </div>
  );
}
