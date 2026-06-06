import { useState } from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import OptionChain from './OptionChain';
import PayoffGraph from './PayoffGraph';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const UNDERLYINGS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'];
const LOT_SIZES   = { NIFTY: 50, BANKNIFTY: 15, FINNIFTY: 40 };

// ClickTrade — visual multi-leg options strategy builder.
// Build legs from option chain clicks or manual input.
// Shows payoff graph + Greeks per leg + execute all legs.
const ClickTrade = () => {
  const [underlying, setUnderlying]   = useState('NIFTY');
  const [legs, setLegs]               = useState([]);
  const [executing, setExecuting]     = useState(false);
  const [execResult, setExecResult]   = useState(null);

  const lotSize = LOT_SIZES[underlying] || 50;

  const addLeg = (preset = {}) => {
    setLegs(prev => [...prev, {
      id:     Date.now(),
      side:   preset.side   || 'BUY',
      type:   preset.type   || 'CE',
      strike: preset.strike || 22500,
      ltp:    preset.ltp    || 0,
      lots:   1,
      iv:     preset.iv     || 0,
    }]);
  };

  const updateLeg = (id, field, value) => {
    setLegs(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const removeLeg = (id) => {
    setLegs(prev => prev.filter(l => l.id !== id));
  };

  const netPremium = legs.reduce((sum, l) => {
    return sum + (l.side === 'BUY' ? -1 : 1) * l.ltp * l.lots * lotSize;
  }, 0);

  const executeAll = async () => {
    if (!legs.length) return;
    setExecuting(true);
    setExecResult(null);
    try {
      // TODO: integrate Kotak order placement
      // Each leg → POST /api/market/order { symbol, side, type, strike, expiry, lots }
      // For now simulate
      await new Promise(r => setTimeout(r, 800));
      setExecResult({ status: 'ok', message: `${legs.length} leg(s) queued — broker integration pending` });
    } catch (err) {
      setExecResult({ status: 'error', message: err.message });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header + underlying selector */}
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-black text-slate-800">ClickTrade Strategy Builder</h2>
        <div className="flex gap-2 ml-auto">
          {UNDERLYINGS.map(u => (
            <button
              key={u}
              onClick={() => setUnderlying(u)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                underlying === u ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >{u}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Option chain */}
        <OptionChain symbol={underlying} onLegSelect={addLeg} />

        {/* Leg builder + controls */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="font-black text-slate-800">Strategy Legs</span>
              <button
                onClick={() => addLeg()}
                className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-2 rounded-xl text-sm font-bold transition-all"
              >
                <Plus size={14} /> Add Leg
              </button>
            </div>

            {legs.length === 0 ? (
              <div className="p-8 text-center text-slate-300 font-bold text-sm">
                Click a strike in the chain or press Add Leg
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {legs.map(leg => (
                  <div key={leg.id} className="p-4 flex items-center gap-3 text-sm">
                    <select value={leg.side} onChange={e => updateLeg(leg.id, 'side', e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-xs">
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                    <select value={leg.type} onChange={e => updateLeg(leg.id, 'type', e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-xs">
                      <option value="CE">CE</option>
                      <option value="PE">PE</option>
                    </select>
                    <input type="number" value={leg.strike} onChange={e => updateLeg(leg.id, 'strike', Number(e.target.value))}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 font-mono text-xs w-20" />
                    <span className="text-slate-400 text-xs">LTP</span>
                    <input type="number" value={leg.ltp} step="0.5" onChange={e => updateLeg(leg.id, 'ltp', Number(e.target.value))}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 font-mono text-xs w-20" />
                    <span className="text-slate-400 text-xs">Lots</span>
                    <input type="number" value={leg.lots} min="1" onChange={e => updateLeg(leg.id, 'lots', Math.max(1, Number(e.target.value)))}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 font-mono text-xs w-14" />
                    <button onClick={() => removeLeg(leg.id)} className="ml-auto text-slate-300 hover:text-rose-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {legs.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="text-sm font-bold">
                  <span className="text-slate-500 text-xs uppercase">Net Premium</span>
                  <span className={`ml-2 font-mono ${netPremium >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {netPremium >= 0 ? '+' : ''}₹{netPremium.toFixed(0)}
                  </span>
                </div>
                <button
                  onClick={executeAll}
                  disabled={executing}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                >
                  <Zap size={14} /> {executing ? 'Executing…' : 'Execute All Legs'}
                </button>
              </div>
            )}
          </div>

          {execResult && (
            <div className={`rounded-2xl border p-4 text-sm font-bold ${
              execResult.status === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}>
              {execResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Payoff graph */}
      <PayoffGraph legs={legs} lotSize={lotSize} />
    </div>
  );
};

export default ClickTrade;
