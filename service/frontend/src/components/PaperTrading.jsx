import { useState, useEffect } from 'react';
import { RefreshCw, Wallet, TrendingUp, Activity } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PaperTrading = ({ strategyId }) => {
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const fetchPortfolio = async () => {
    if (!strategyId) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch(`${API_BASE}/api/signals/portfolio/${strategyId}`);
      if (res.status === 404) {
        setPortfolioData(null);
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setPortfolioData(data);
      setLastRefreshed(new Date());
    } catch (err) {
      setError('Failed to load portfolio: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
    const t = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(t);
  }, [strategyId]);

  if (!strategyId) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-[2rem] border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Activity size={32} className="text-indigo-400" />
          </div>
          <p className="text-slate-500 font-bold text-lg">No strategy selected.</p>
          <p className="text-slate-300 text-sm mt-2">
            Create a strategy in Firestore signal_strategies collection and paste the token here.
          </p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-[2rem] border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Wallet size={32} className="text-amber-400" />
          </div>
          <p className="text-slate-500 font-bold text-lg">No portfolio yet for strategy: {strategyId}</p>
          <p className="text-slate-300 text-sm mt-2">
            Send a TradingView or Chartink signal first to initialize it.
          </p>
          <button
            onClick={fetchPortfolio}
            className="mt-6 flex items-center gap-2 mx-auto bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-[2rem] border border-rose-100 p-8 shadow-sm">
          <p className="text-rose-500 font-bold">{error}</p>
          <button
            onClick={fetchPortfolio}
            className="mt-4 flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl font-bold transition-all"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!portfolioData) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-[2rem] border border-slate-200 p-12 text-center shadow-sm">
          <p className="text-slate-300 font-bold">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  const { availableCapital, capital, realized, unrealized, total, positions = [], tradeCount } = portfolioData;
  const pnlColor = (val) => val >= 0 ? 'text-emerald-500' : 'text-rose-500';
  const pnlPrefix = (val) => val >= 0 ? '+' : '';

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-600 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-200">
          <span className="block text-indigo-200 text-xs font-bold uppercase tracking-widest mb-2">Available Capital</span>
          <h3 className="text-4xl font-black">
            &#x20B9;{Number(availableCapital).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </h3>
          <div className="mt-4 text-indigo-200 text-sm font-bold">
            of &#x20B9;{Number(capital).toLocaleString('en-IN', { maximumFractionDigits: 0 })} total capital
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <span className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Realized P&amp;L</span>
          <h3 className={`text-4xl font-black ${pnlColor(realized)}`}>
            {pnlPrefix(realized)}&#x20B9;{Number(realized).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <div className="mt-4 text-slate-400 text-sm font-bold">
            {tradeCount} trade{tradeCount !== 1 ? 's' : ''} completed
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <span className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Total P&amp;L</span>
          <h3 className={`text-4xl font-black ${pnlColor(total)}`}>
            {pnlPrefix(total)}&#x20B9;{Number(total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <div className="mt-4 text-slate-400 text-sm font-bold">
            Unrealized: <span className={pnlColor(unrealized)}>
              {pnlPrefix(unrealized)}&#x20B9;{Number(unrealized).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Open positions table */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <TrendingUp size={20} className="text-indigo-500" />
            <h3 className="font-black text-xl text-slate-800">Open Positions</h3>
          </div>
          <span className="text-[10px] font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-500 uppercase">
            {positions.length} position{positions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-8 py-5 text-left">Instrument</th>
                <th className="px-8 py-5 text-center">Qty</th>
                <th className="px-8 py-5 text-right">Avg Cost</th>
                <th className="px-8 py-5 text-right">Total Cost</th>
                <th className="px-8 py-5 text-right">Live P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {positions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-16 text-center text-slate-300 font-bold italic">
                    No open positions
                  </td>
                </tr>
              ) : positions.map((pos) => (
                <tr key={pos.symbol} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-6 font-black text-slate-800">{pos.symbol}</td>
                  <td className="px-8 py-6 text-center">
                    <span className="bg-slate-100 px-3 py-1 rounded-lg font-mono font-bold text-slate-600">
                      {pos.qty}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right font-mono text-slate-700">
                    &#x20B9;{Number(pos.avgCost).toFixed(2)}
                  </td>
                  <td className="px-8 py-6 text-right font-mono text-slate-700">
                    &#x20B9;{Number(pos.totalCost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-8 py-6 text-right font-mono text-slate-400 text-sm">
                    <span title="Live P&L updates on next signal">—</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
          <span className="text-xs text-slate-400 font-medium">
            {lastRefreshed
              ? `Last refreshed: ${lastRefreshed.toLocaleTimeString('en-IN')}`
              : 'Not yet refreshed'}
          </span>
          <button
            onClick={fetchPortfolio}
            disabled={loading}
            className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold text-sm border border-slate-200 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaperTrading;
