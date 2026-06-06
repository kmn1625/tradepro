import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Displays live option chain (CE + PE) for a given symbol and expiry.
// Data from GET /api/options/chain?symbol=&expiry=
const OptionChain = ({ symbol = 'NIFTY', expiry, onLegSelect, onSpotLoad }) => {
  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchChain = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ symbol, ...(expiry ? { expiry } : {}) });
      const res = await fetch(`${API_BASE}/api/options/chain?${params}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setChain(data);
      if (data.spot) onSpotLoad?.(data.spot);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChain(); }, [symbol, expiry]);

  if (error) return (
    <div className="bg-white rounded-2xl border border-rose-100 p-6 text-rose-500 font-bold text-sm">{error}</div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
        <div>
          <span className="font-black text-slate-800">{symbol} Option Chain</span>
          {chain?.spot && (
            <span className="ml-3 text-xs font-mono font-bold text-indigo-600">Spot: ₹{chain.spot}</span>
          )}
        </div>
        <button onClick={fetchChain} disabled={loading} className="p-2 rounded-xl hover:bg-slate-100 transition-all disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-500' : 'text-slate-400'} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest">
            <tr>
              <th className="px-4 py-3 text-right text-emerald-600">OI (CE)</th>
              <th className="px-4 py-3 text-right text-emerald-600">IV (CE)</th>
              <th className="px-4 py-3 text-right text-emerald-600">LTP (CE)</th>
              <th className="px-4 py-3 text-center bg-indigo-50 font-black text-indigo-600">STRIKE</th>
              <th className="px-4 py-3 text-left text-rose-600">LTP (PE)</th>
              <th className="px-4 py-3 text-left text-rose-600">IV (PE)</th>
              <th className="px-4 py-3 text-left text-rose-600">OI (PE)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {!chain ? (
              <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-300 font-bold">Loading chain...</td></tr>
            ) : chain.strikes.map(row => {
              const isATM = Math.abs(row.strike - chain.spot) < 26;
              return (
                <tr key={row.strike} className={`hover:bg-slate-50 transition-colors ${isATM ? 'bg-indigo-50/40' : ''}`}>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-500">{(row.ce.oi / 1000).toFixed(0)}K</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-600">{row.ce.iv.toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => onLegSelect?.({ side: 'BUY', type: 'CE', strike: row.strike, ltp: row.ce.ltp })}
                      className="font-mono font-bold text-emerald-600 hover:underline"
                    >₹{row.ce.ltp.toFixed(1)}</button>
                  </td>
                  <td className={`px-4 py-2.5 text-center font-black ${isATM ? 'text-indigo-600' : 'text-slate-700'}`}>
                    {row.strike}
                  </td>
                  <td className="px-4 py-2.5 text-left">
                    <button
                      onClick={() => onLegSelect?.({ side: 'BUY', type: 'PE', strike: row.strike, ltp: row.pe.ltp })}
                      className="font-mono font-bold text-rose-600 hover:underline"
                    >₹{row.pe.ltp.toFixed(1)}</button>
                  </td>
                  <td className="px-4 py-2.5 text-left font-mono text-rose-600">{row.pe.iv.toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-left font-mono text-slate-500">{(row.pe.oi / 1000).toFixed(0)}K</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OptionChain;
