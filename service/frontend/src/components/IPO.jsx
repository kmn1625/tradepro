import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle, ChevronRight, X } from 'lucide-react';

const STATUS_STYLES = {
  open:     { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'OPEN' },
  upcoming: { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'UPCOMING' },
  listed:   { bg: 'bg-slate-100',   text: 'text-slate-500',   label: 'LISTED' },
  allotment:{ bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'ALLOTMENT' },
};

export default function IPO() {
  const [ipos, setIpos]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selected, setSelected]   = useState(null);
  const [applications, setApplications] = useState([]);
  const [applyForm, setApplyForm] = useState({ ipoId: null, qty: '', upiId: '' });
  const [msg, setMsg]             = useState(null);

  const flash = (t, text) => { setMsg({ type: t, text }); setTimeout(() => setMsg(null), 5000); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ipoRes, appRes] = await Promise.all([
        fetch('/api/ipo'),
        fetch('/api/ipo/applications'),
      ]);
      if (ipoRes.ok) setIpos(await ipoRes.json());
      if (appRes.ok) setApplications(await appRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const displayed = ipos.filter(ipo => {
    if (activeTab === 'open')     return ipo.status === 'open';
    if (activeTab === 'upcoming') return ipo.status === 'upcoming';
    if (activeTab === 'listed')   return ipo.status === 'listed';
    return true;
  });

  const submitApplication = async () => {
    if (!applyForm.qty || !applyForm.upiId) return flash('error', 'Lot quantity and UPI ID required');
    try {
      const res = await fetch('/api/ipo/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipoId: applyForm.ipoId, qty: applyForm.qty, upiId: applyForm.upiId }),
      });
      const data = await res.json();
      if (!res.ok) return flash('error', data.error);
      flash('success', data.message);
      setApplyForm({ ipoId: null, qty: '', upiId: '' });
      await loadAll();
    } catch { flash('error', 'Application failed'); }
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 ${msg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle size={14} />} {msg.text}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total IPOs',  value: ipos.length,                           bg: 'bg-slate-900 text-white' },
          { label: 'Open Now',    value: ipos.filter(i => i.status==='open').length,     bg: 'bg-emerald-50 text-emerald-700' },
          { label: 'Upcoming',    value: ipos.filter(i => i.status==='upcoming').length, bg: 'bg-blue-50 text-blue-700' },
          { label: 'Applied',     value: applications.length,                    bg: 'bg-indigo-50 text-indigo-700' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-5`}>
            <p className="text-xs font-bold opacity-70 uppercase tracking-widest">{c.label}</p>
            <p className="text-3xl font-black mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex gap-1">
        {['all', 'open', 'upcoming', 'listed'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
              activeTab === tab ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* IPO list */}
      <div className="space-y-4">
        {displayed.map(ipo => {
          const st = STATUS_STYLES[ipo.status] || STATUS_STYLES.listed;
          const isPositive = ipo.listingGain !== null && ipo.listingGain > 0;
          const isNegative = ipo.listingGain !== null && ipo.listingGain < 0;
          const hasApplied = applications.some(a => a.ipoId === ipo.id);

          return (
            <div key={ipo.id} className="bg-white rounded-[2rem] border border-slate-200 p-6 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-black text-slate-800">{ipo.company}</h3>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                    {hasApplied && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">APPLIED</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span><span className="font-bold text-slate-700">Sector:</span> {ipo.sector}</span>
                    <span><span className="font-bold text-slate-700">Issue Size:</span> ₹{ipo.issueSize}</span>
                    {ipo.priceBand.max > 0 && (
                      <span><span className="font-bold text-slate-700">Price Band:</span> ₹{ipo.priceBand.min}–₹{ipo.priceBand.max}</span>
                    )}
                    {ipo.lotSize > 0 && (
                      <span><span className="font-bold text-slate-700">Lot Size:</span> {ipo.lotSize} shares</span>
                    )}
                    <span><span className="font-bold text-slate-700">Open:</span> {ipo.openDate}</span>
                    <span><span className="font-bold text-slate-700">Close:</span> {ipo.closeDate}</span>
                    {ipo.listingDate !== 'TBD' && (
                      <span><span className="font-bold text-slate-700">Listing:</span> {ipo.listingDate}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-3">
                    {ipo.subscriptionTimes !== null && (
                      <div className="text-xs">
                        <span className="text-slate-400">Subscribed:</span>
                        <span className="ml-1 font-black text-indigo-600">{ipo.subscriptionTimes}×</span>
                      </div>
                    )}
                    {ipo.gmp > 0 && (
                      <div className="text-xs">
                        <span className="text-slate-400">GMP:</span>
                        <span className="ml-1 font-black text-emerald-600">+₹{ipo.gmp}</span>
                      </div>
                    )}
                    {ipo.listingGain !== null && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-slate-400">Listing Gain:</span>
                        {isPositive
                          ? <span className="flex items-center gap-0.5 font-black text-emerald-600"><TrendingUp size={12} />+{ipo.listingGain}%</span>
                          : isNegative
                            ? <span className="flex items-center gap-0.5 font-black text-rose-600"><TrendingDown size={12} />{ipo.listingGain}%</span>
                            : <span className="font-bold text-slate-500">0%</span>
                        }
                      </div>
                    )}
                  </div>
                </div>

                {(ipo.status === 'open' || ipo.status === 'upcoming') && !hasApplied && (
                  <button
                    onClick={() => setApplyForm({ ipoId: ipo.id, qty: '', upiId: '' })}
                    className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Apply modal */}
      {applyForm.ipoId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[300] p-4" onClick={() => setApplyForm({ ipoId: null, qty: '', upiId: '' })}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-slate-800">Apply for IPO</h3>
              <button onClick={() => setApplyForm({ ipoId: null, qty: '', upiId: '' })} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {(() => {
              const ipo = ipos.find(i => i.id === applyForm.ipoId);
              if (!ipo) return null;
              const minAmt = ipo.lotSize * ipo.priceBand.max;
              const totalAmt = (parseInt(applyForm.qty) || 0) * ipo.priceBand.max;
              return (
                <>
                  <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                    <p className="font-black text-slate-800">{ipo.company}</p>
                    <p className="text-xs text-slate-400 mt-1">Price Band: ₹{ipo.priceBand.min}–₹{ipo.priceBand.max} | Lot: {ipo.lotSize} shares</p>
                    {minAmt > 0 && <p className="text-xs text-indigo-600 font-bold mt-1">Min Amount: ₹{minAmt.toLocaleString('en-IN')}</p>}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-600 uppercase mb-1.5">Number of Lots</label>
                      <input type="number" min="1" value={applyForm.qty}
                        onChange={e => setApplyForm(prev => ({ ...prev, qty: e.target.value }))}
                        placeholder="1"
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      {totalAmt > 0 && <p className="text-xs text-slate-400 mt-1">Total: ₹{totalAmt.toLocaleString('en-IN')}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-600 uppercase mb-1.5">UPI ID</label>
                      <input type="text" value={applyForm.upiId}
                        onChange={e => setApplyForm(prev => ({ ...prev, upiId: e.target.value }))}
                        placeholder="yourname@upi"
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                  </div>
                  <button onClick={submitApplication}
                    className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-black transition-all">
                    Submit Application
                  </button>
                  <p className="text-[10px] text-slate-300 text-center mt-3">
                    A UPI mandate request will be sent to your UPI app. Approve within 30 minutes.
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Applications */}
      {applications.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-black text-slate-800 text-sm">My Applications ({applications.length})</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {applications.map(app => (
              <div key={app.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1">
                  <p className="font-bold text-sm text-slate-800">{app.company}</p>
                  <p className="text-xs text-slate-400">
                    {app.qty} lots · ₹{app.amount.toLocaleString('en-IN')} · UPI: {app.upiId}
                  </p>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase">
                  {app.status.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
