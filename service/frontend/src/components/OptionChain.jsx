import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STRATEGY_PRESETS = {
  straddle:    (spot) => [
    { side: 'BUY', type: 'CE', strike: spot, note: 'Long Straddle CE' },
    { side: 'BUY', type: 'PE', strike: spot, note: 'Long Straddle PE' },
  ],
  strangle:    (spot) => [
    { side: 'BUY', type: 'CE', strike: spot + 100, note: 'Long Strangle CE' },
    { side: 'BUY', type: 'PE', strike: spot - 100, note: 'Long Strangle PE' },
  ],
  iron_condor: (spot) => [
    { side: 'SELL', type: 'CE', strike: spot + 100, note: 'IC Sell CE' },
    { side: 'BUY',  type: 'CE', strike: spot + 200, note: 'IC Buy CE hedge' },
    { side: 'SELL', type: 'PE', strike: spot - 100, note: 'IC Sell PE' },
    { side: 'BUY',  type: 'PE', strike: spot - 200, note: 'IC Buy PE hedge' },
  ],
  bull_spread: (spot) => [
    { side: 'BUY',  type: 'CE', strike: spot,       note: 'Bull Call Spread BUY' },
    { side: 'SELL', type: 'CE', strike: spot + 100, note: 'Bull Call Spread SELL' },
  ],
  bear_spread: (spot) => [
    { side: 'BUY',  type: 'PE', strike: spot,       note: 'Bear Put Spread BUY' },
    { side: 'SELL', type: 'PE', strike: spot - 100, note: 'Bear Put Spread SELL' },
  ],
  covered_call: (spot) => [
    { side: 'SELL', type: 'CE', strike: spot + 100, note: 'Covered Call' },
  ],
};

const OptionChain = ({ symbol = 'NIFTY', expiry, onLegSelect, onSpotLoad }) => {
  const [chain, setChain]           = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [basketLegs, setBasketLegs] = useState([]);
  const [strategy, setStrategy]     = useState('');
  const [showBuilder, setShowBuilder] = useState(false);

  const fetchChain = useCallback(async () => {
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
  }, [symbol, expiry, onSpotLoad]);

  useEffect(() => { fetchChain(); }, [fetchChain]);

  // PCR = total PE OI / total CE OI
  const pcr = chain?.strikes ? (() => {
    const totalCE = chain.strikes.reduce((s, r) => s + (r.ce.oi || 0), 0);
    const totalPE = chain.strikes.reduce((s, r) => s + (r.pe.oi || 0), 0);
    return totalCE > 0 ? (totalPE / totalCE).toFixed(2) : '—';
  })() : '—';

  const applyPreset = (presetKey) => {
    if (!chain?.spot || !STRATEGY_PRESETS[presetKey]) return;
    const roundedSpot = Math.round(chain.spot / 50) * 50;
    const legs = STRATEGY_PRESETS[presetKey](roundedSpot).map((l, i) => ({
      ...l,
      ltp: (() => {
        const row = chain.strikes.find(r => r.strike === l.strike);
        return row ? (l.type === 'CE' ? row.ce.ltp : row.pe.ltp) : 0;
      })(),
      qty: 50,
      id: Date.now() + i,
    }));
    setBasketLegs(legs);
    setShowBuilder(true);
  };

  const addLeg = (side, type, strike, ltp) => {
    const leg = { id: Date.now(), side, type, strike, ltp, qty: 50 };
    setBasketLegs(prev => [...prev, leg]);
    setShowBuilder(true);
  };

  const removeLeg = (id) => setBasketLegs(prev => prev.filter(l => l.id !== id));

  const executeBasket = async () => {
    if (!basketLegs.length) return;
    try {
      await fetch(`${API_BASE}/api/market/basket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legs: basketLegs }),
      });
      setBasketLegs([]);
      setShowBuilder(false);
    } catch {}
  };

  if (error) return (
    <div className="bg-white rounded-2xl border border-rose-100 p-6 text-rose-500 font-bold text-sm">{error}</div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <span className="font-black text-slate-800">{symbol} Option Chain</span>
            {chain?.spot && (
              <span className="ml-3 text-xs font-mono font-bold text-indigo-600">Spot: ₹{chain.spot}</span>
            )}
          </div>
          {chain && (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">PCR:</span>
                <span className={`font-black ${parseFloat(pcr) > 1 ? 'text-emerald-600' : 'text-rose-600'}`}>{pcr}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Strategy builder dropdown */}
          <select
            value={strategy}
            onChange={e => { setStrategy(e.target.value); if (e.target.value) applyPreset(e.target.value); }}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none bg-white text-slate-600"
          >
            <option value="">Strategy Builder</option>
            <option value="straddle">Long Straddle</option>
            <option value="strangle">Long Strangle</option>
            <option value="iron_condor">Iron Condor</option>
            <option value="bull_spread">Bull Call Spread</option>
            <option value="bear_spread">Bear Put Spread</option>
            <option value="covered_call">Covered Call</option>
          </select>
          <button onClick={fetchChain} disabled={loading}
            className="p-2 rounded-xl hover:bg-slate-100 transition-all disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-500' : 'text-slate-400'} />
          </button>
        </div>
      </div>

      {/* Chain table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest">
            <tr>
              <th className="px-3 py-3 text-right text-emerald-600">OI</th>
              <th className="px-3 py-3 text-right text-emerald-600">OI Chg</th>
              <th className="px-3 py-3 text-right text-emerald-600">IV</th>
              <th className="px-3 py-3 text-right text-emerald-600">LTP (CE)</th>
              <th className="px-3 py-3 text-center bg-indigo-50 font-black text-indigo-600">STRIKE</th>
              <th className="px-3 py-3 text-left text-rose-600">LTP (PE)</th>
              <th className="px-3 py-3 text-left text-rose-600">IV</th>
              <th className="px-3 py-3 text-left text-rose-600">OI Chg</th>
              <th className="px-3 py-3 text-left text-rose-600">OI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {!chain ? (
              <tr><td colSpan="9" className="px-4 py-12 text-center text-slate-300 font-bold">Loading chain...</td></tr>
            ) : chain.strikes.map(row => {
              const isATM = Math.abs(row.strike - chain.spot) < 26;
              const ceOiChg = row.ce.oiChange || 0;
              const peOiChg = row.pe.oiChange || 0;
              return (
                <tr key={row.strike} className={`hover:bg-slate-50 transition-colors ${isATM ? 'bg-indigo-50/40' : ''}`}>
                  {/* CE side */}
                  <td className="px-3 py-2 text-right font-mono text-slate-500">{(row.ce.oi / 1000).toFixed(0)}K</td>
                  <td className={`px-3 py-2 text-right font-mono text-[10px] ${ceOiChg >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {ceOiChg >= 0 ? '+' : ''}{(ceOiChg / 1000).toFixed(0)}K
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-600">{row.ce.iv.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => {
                        onLegSelect?.({ side: 'BUY', type: 'CE', strike: row.strike, ltp: row.ce.ltp });
                        addLeg('BUY', 'CE', row.strike, row.ce.ltp);
                      }}
                      className="font-mono font-bold text-emerald-600 hover:underline"
                    >₹{row.ce.ltp.toFixed(1)}</button>
                  </td>
                  {/* Strike */}
                  <td className={`px-3 py-2 text-center font-black ${isATM ? 'text-indigo-600' : 'text-slate-700'}`}>
                    {row.strike}
                    {isATM && <span className="ml-1 text-[8px] bg-indigo-200 text-indigo-700 px-1 rounded">ATM</span>}
                  </td>
                  {/* PE side */}
                  <td className="px-3 py-2 text-left">
                    <button
                      onClick={() => {
                        onLegSelect?.({ side: 'BUY', type: 'PE', strike: row.strike, ltp: row.pe.ltp });
                        addLeg('BUY', 'PE', row.strike, row.pe.ltp);
                      }}
                      className="font-mono font-bold text-rose-600 hover:underline"
                    >₹{row.pe.ltp.toFixed(1)}</button>
                  </td>
                  <td className="px-3 py-2 text-left font-mono text-rose-600">{row.pe.iv.toFixed(1)}%</td>
                  <td className={`px-3 py-2 text-left font-mono text-[10px] ${peOiChg >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {peOiChg >= 0 ? '+' : ''}{(peOiChg / 1000).toFixed(0)}K
                  </td>
                  <td className="px-3 py-2 text-left font-mono text-slate-500">{(row.pe.oi / 1000).toFixed(0)}K</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Strategy Builder panel */}
      {showBuilder && basketLegs.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Strategy Basket ({basketLegs.length} legs)</span>
            <div className="flex gap-2">
              <button onClick={executeBasket}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl text-xs font-black transition-all">
                Execute Basket
              </button>
              <button onClick={() => { setBasketLegs([]); setShowBuilder(false); setStrategy(''); }}
                className="text-slate-400 hover:text-rose-500 text-xs font-bold">
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {basketLegs.map(leg => (
              <div key={leg.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  leg.side === 'BUY' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                <span>{leg.side} {leg.type} {leg.strike}</span>
                <span className="font-mono">@₹{leg.ltp?.toFixed(1)}</span>
                <span className="text-slate-400">×{leg.qty}</span>
                <button onClick={() => removeLeg(leg.id)} className="hover:opacity-70">
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OptionChain;
