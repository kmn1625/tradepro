import { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

function getDb() {
  const app = getApps().length ? getApp() : null;
  if (!app) return null;
  return getFirestore(app);
}

const sourceBadge = (source) => {
  if (source === 'tradingview') {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-700">
        TV
      </span>
    );
  }
  if (source === 'chartink') {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-700">
        CK
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-500">
      {source || '—'}
    </span>
  );
};

const actionBadge = (action) => {
  const classes = {
    BUY: 'bg-emerald-100 text-emerald-700',
    SELL: 'bg-rose-100 text-rose-700',
    EXIT: 'bg-orange-100 text-orange-700',
    ALERT: 'bg-slate-100 text-slate-500',
  };
  const cls = classes[action] || 'bg-slate-100 text-slate-500';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${cls}`}>
      {action || '—'}
    </span>
  );
};

const statusBadge = (status) => {
  const classes = {
    filled: 'text-emerald-600',
    received: 'text-slate-500',
    rejected: 'text-rose-500',
    error: 'text-rose-500',
  };
  const cls = classes[status] || 'text-slate-400';
  return (
    <span className={`text-xs font-bold uppercase ${cls}`}>
      {status || '—'}
    </span>
  );
};

const formatTime = (receivedAt) => {
  try {
    if (!receivedAt) return '—';
    const date = typeof receivedAt.toDate === 'function'
      ? receivedAt.toDate()
      : new Date(receivedAt);
    return date.toLocaleString('en-IN');
  } catch {
    return '—';
  }
};

const SignalLog = () => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getDb();
    if (!db) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'signal_log'), orderBy('receivedAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      setSignals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error('SignalLog snapshot error:', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-xl text-slate-800">Signal Log</h3>
          <span className="text-[10px] font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-500 uppercase">
            Live · Last 100
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-indigo-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-5 text-left">Source</th>
                  <th className="px-8 py-5 text-left">Symbol</th>
                  <th className="px-8 py-5 text-left">Action</th>
                  <th className="px-8 py-5 text-right">Qty</th>
                  <th className="px-8 py-5 text-right">Fill Price</th>
                  <th className="px-8 py-5 text-left">Status</th>
                  <th className="px-8 py-5 text-left">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {signals.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-8 py-20 text-center text-slate-300 font-bold italic">
                      No signals received yet. Send a TradingView or Chartink webhook to see signals here.
                    </td>
                  </tr>
                ) : signals.map((signal) => (
                  <tr key={signal.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-4">{sourceBadge(signal.source)}</td>
                    <td className="px-8 py-4 font-bold text-slate-800">{signal.symbol || '—'}</td>
                    <td className="px-8 py-4">{actionBadge(signal.action)}</td>
                    <td className="px-8 py-4 text-right font-mono text-slate-700">
                      {signal.quantity ?? '—'}
                    </td>
                    <td className="px-8 py-4 text-right font-mono text-slate-700">
                      {signal.fillPrice != null
                        ? `₹${Number(signal.fillPrice).toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-8 py-4">{statusBadge(signal.status)}</td>
                    <td className="px-8 py-4 text-xs text-slate-400 font-mono">
                      {formatTime(signal.receivedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignalLog;
