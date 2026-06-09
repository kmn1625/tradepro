import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Zap, Download } from 'lucide-react';
import * as greeks from 'greeks';
import OptionChain from './OptionChain';
import PayoffGraph from './PayoffGraph';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const UNDERLYINGS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'];
const LOT_SIZES   = { NIFTY: 65, BANKNIFTY: 30, FINNIFTY: 60 };
const RF_RATE     = 0.065; // 6.5% risk-free rate

// Returns nearest weekly expiry (Thursday 15:30 IST) as fraction of year from now
const getDTE = () => {
  const now  = new Date();
  const day  = now.getDay();
  const daysToThursday = day <= 4 ? (4 - day) : (4 - day + 7);
  const expiry = new Date(now);
  expiry.setDate(now.getDate() + (daysToThursday === 0 ? 7 : daysToThursday));
  expiry.setHours(15, 30, 0, 0);
  return Math.max((expiry - now) / (365 * 24 * 60 * 60 * 1000), 1 / 365);
};

// Black-Scholes option price — Abramowitz & Stegun normal CDF approximation.
// Used for scenario P&L (pre-expiry value under shifted spot/IV/DTE).
function bsPrice(S, K, T, sigma, r, type) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return 0;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const N = (x) => {
    const a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const t = 1 / (1 + p * Math.abs(x));
    const poly = ((((a[4] * t + a[3]) * t + a[2]) * t + a[1]) * t + a[0]) * t;
    return 0.5 * (1 + sign * (1 - poly * Math.exp(-x * x / 2)));
  };
  if (type === 'call') return Math.max(S * N(d1) - K * Math.exp(-r * T) * N(d2), 0);
  return Math.max(K * Math.exp(-r * T) * N(-d2) - S * N(-d1), 0);
}

const calcLegGreeks = (leg, spot, ivMult = 1, dte = null) => {
  const t   = dte !== null ? dte : getDTE();
  const iv  = Math.max((leg.iv || 15) / 100 * ivMult, 0.01);
  const dir = leg.side === 'BUY' ? 1 : -1;
  const cp  = leg.type === 'CE' ? 'call' : 'put';
  try {
    return {
      delta: dir * greeks.getDelta(spot, leg.strike, t, iv, RF_RATE, cp),
      theta: dir * greeks.getTheta(spot, leg.strike, t, iv, RF_RATE, cp),
      gamma: dir * greeks.getGamma(spot, leg.strike, t, iv, RF_RATE, cp),
      vega:  dir * greeks.getVega(spot, leg.strike, t, iv, RF_RATE, cp) * 0.01,
    };
  } catch {
    return { delta: 0, theta: 0, gamma: 0, vega: 0 };
  }
};

const ClickTrade = () => {
  const [underlying, setUnderlying]           = useState('NIFTY');
  const [expiry, setExpiry]                   = useState('');
  const [expiries, setExpiries]               = useState([]);
  const [legs, setLegs]                       = useState([]);
  const [spot, setSpot]                       = useState(22500);
  const [executing, setExecuting]             = useState(false);
  const [execResult, setExecResult]           = useState(null);
  const [confirmState, setConfirmState]       = useState(null); // {preview:[]} awaiting live confirm
  const [scenarioSpotPct, setScenarioSpotPct] = useState(0);
  const [scenarioIVPct, setScenarioIVPct]     = useState(0);
  const [scenarioDaysFwd, setScenarioDaysFwd] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/api/options/expiries?symbol=${underlying}`)
      .then(r => r.json())
      .then(data => {
        const list = data.expiries || [];
        setExpiries(list);
        setExpiry(list[0] || '');
      })
      .catch(() => {});
  }, [underlying]);

  const lotSize = LOT_SIZES[underlying] || 50;

  // Effective scenario values (derived from state, cheap to recompute each render)
  const scenarioSpot   = spot * (1 + scenarioSpotPct / 100);
  const scenarioIVMult = Math.max(1 + scenarioIVPct / 100, 0.01);
  const scenarioDTE    = Math.max(getDTE() - scenarioDaysFwd / 365, 1 / 365);

  const netPremium = legs.reduce((sum, l) => {
    return sum + (l.side === 'BUY' ? -1 : 1) * l.ltp * l.lots * lotSize;
  }, 0);

  // Pre-expiry scenario P&L using Black-Scholes repricing under shifted spot/IV/DTE
  const scenarioPnL = useMemo(() => {
    if (!legs.length) return null;
    const effSpot   = spot * (1 + scenarioSpotPct / 100);
    const effIVMult = Math.max(1 + scenarioIVPct / 100, 0.01);
    const effDTE    = Math.max(getDTE() - scenarioDaysFwd / 365, 1 / 365);
    return legs.reduce((sum, leg) => {
      const cpType = leg.type === 'CE' ? 'call' : 'put';
      const scIV   = Math.max((leg.iv || 15) / 100 * effIVMult, 0.01);
      const scenarioPrice = bsPrice(effSpot, leg.strike, effDTE, scIV, RF_RATE, cpType);
      const dir    = leg.side === 'BUY' ? 1 : -1;
      return sum + dir * (scenarioPrice - leg.ltp) * leg.lots * lotSize;
    }, 0);
  }, [legs, spot, scenarioSpotPct, scenarioIVPct, scenarioDaysFwd, lotSize]);

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

  const _sendBasket = async (confirmLive = false) => {
    const payload = {
      legs: legs.map(leg => ({
        symbol: underlying, side: leg.side, type: leg.type,
        strike: leg.strike, expiry, lots: leg.lots, ltp: leg.ltp,
      })),
      confirmLive,
      rollbackOnFail: true,
    };
    const res = await fetch(`${API_BASE}/api/market/basket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: res.status, data: await res.json() };
  };

  const executeAll = async () => {
    if (!legs.length) return;
    setExecuting(true);
    setExecResult(null);
    setConfirmState(null);
    try {
      const { status, data } = await _sendBasket(false);
      if (status === 428) {
        // Live safety gate — show preview and wait for user confirmation
        setConfirmState({ preview: data.preview || [] });
        return;
      }
      const ok = data.status === 'filled' || data.status === 'ok';
      setExecResult({
        status: ok ? 'ok' : 'error',
        message: ok
          ? `${data.fills?.length || legs.length} leg(s) placed — ${data.mode || 'simulated'}`
          : `${data.failed?.length || 0} leg(s) failed`,
      });
    } catch (err) {
      setExecResult({ status: 'error', message: err.message });
    } finally {
      setExecuting(false);
    }
  };

  const confirmLiveExecution = async () => {
    setExecuting(true);
    setConfirmState(null);
    try {
      const { data } = await _sendBasket(true);
      const ok = data.status === 'filled' || data.status === 'ok';
      setExecResult({
        status: ok ? 'ok' : 'error',
        message: ok
          ? `${data.fills?.length || legs.length} leg(s) LIVE — ${data.mode}`
          : `${data.failed?.length || 0} leg(s) failed (${data.fills?.length || 0} rolled back)`,
      });
    } catch (err) {
      setExecResult({ status: 'error', message: err.message });
    } finally {
      setExecuting(false);
    }
  };

  const exportStrategy = () => {
    const data = {
      underlying, expiry, spot,
      legs: legs.map(({ id, ...l }) => l),
      netPremium,
      exported: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `strategy-${underlying}-${expiry || 'draft'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header + underlying selector + expiry + export */}
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-black text-slate-800">ClickTrade Strategy Builder</h2>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {UNDERLYINGS.map(u => (
            <button
              key={u}
              onClick={() => setUnderlying(u)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                underlying === u ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >{u}</button>
          ))}
          {expiries.length > 0 && (
            <select
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              {expiries.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          )}
          {legs.length > 0 && (
            <button
              onClick={exportStrategy}
              className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-xl text-sm font-bold transition-all"
            >
              <Download size={13} /> Export
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Option chain */}
        <OptionChain symbol={underlying} expiry={expiry} onLegSelect={addLeg} onSpotLoad={setSpot} />

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

          {confirmState && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm">
              <p className="font-black text-amber-800 mb-2">⚠ LIVE ORDER CONFIRMATION</p>
              <p className="text-amber-700 text-xs mb-3">These REAL orders will be placed immediately and cannot be undone:</p>
              <div className="space-y-1 mb-4">
                {confirmState.preview.map((p, i) => (
                  <div key={i} className="font-mono text-xs text-amber-900 bg-amber-100 rounded px-2 py-1">
                    {p.side} {p.tradingSymbol} × {p.quantity} ({p.orderType})
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmLiveExecution}
                  disabled={executing}
                  className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50"
                >Confirm Live Orders</button>
                <button
                  onClick={() => setConfirmState(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-black transition-all"
                >Cancel</button>
              </div>
            </div>
          )}

          {execResult && (
            <div className={`rounded-2xl border p-4 text-sm font-bold ${
              execResult.status === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}>
              {execResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Scenario analysis — sliders for spot move %, IV change %, days forward */}
      {legs.length > 0 && (
        <ScenarioPanel
          spot={spot}
          scenarioSpotPct={scenarioSpotPct}   setScenarioSpotPct={setScenarioSpotPct}
          scenarioIVPct={scenarioIVPct}       setScenarioIVPct={setScenarioIVPct}
          scenarioDaysFwd={scenarioDaysFwd}   setScenarioDaysFwd={setScenarioDaysFwd}
          scenarioPnL={scenarioPnL}
          scenarioSpot={scenarioSpot}
        />
      )}

      {/* Greeks table — uses scenario spot/IV/DTE so sliders update it live */}
      {legs.length > 0 && (
        <GreeksTable
          legs={legs}
          spot={scenarioSpot}
          lotSize={lotSize}
          ivMult={scenarioIVMult}
          dte={scenarioDTE}
        />
      )}

      {/* Payoff graph — scenario spot shown as second reference line */}
      <PayoffGraph
        legs={legs}
        spot={spot}
        lotSize={lotSize}
        scenarioSpot={scenarioSpotPct !== 0 ? scenarioSpot : undefined}
      />
    </div>
  );
};

const fmt = (v, d = 2) => {
  if (isNaN(v) || !isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(d);
};
const fmtColor = v => isNaN(v) || !isFinite(v) ? 'text-slate-400' : v >= 0 ? 'text-emerald-600' : 'text-rose-600';

const ScenarioPanel = ({
  spot,
  scenarioSpotPct, setScenarioSpotPct,
  scenarioIVPct,   setScenarioIVPct,
  scenarioDaysFwd, setScenarioDaysFwd,
  scenarioPnL,     scenarioSpot,
}) => {
  const hasScenario = scenarioSpotPct !== 0 || scenarioIVPct !== 0 || scenarioDaysFwd !== 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="font-black text-slate-800 text-sm uppercase tracking-widest">Scenario Analysis</span>
        {hasScenario && (
          <button
            onClick={() => { setScenarioSpotPct(0); setScenarioIVPct(0); setScenarioDaysFwd(0); }}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-bold transition-colors"
          >Reset</button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Spot move slider */}
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
            <span>Spot Move</span>
            <span className={`font-mono ${scenarioSpotPct > 0 ? 'text-emerald-600' : scenarioSpotPct < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
              {scenarioSpotPct >= 0 ? '+' : ''}{scenarioSpotPct}% → ₹{Math.round(scenarioSpot).toLocaleString('en-IN')}
            </span>
          </div>
          <input
            type="range" min="-20" max="20" step="0.5" value={scenarioSpotPct}
            onChange={e => setScenarioSpotPct(Number(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-300 mt-0.5"><span>-20%</span><span>+20%</span></div>
        </div>

        {/* IV change slider */}
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
            <span>IV Change</span>
            <span className={`font-mono ${scenarioIVPct > 0 ? 'text-amber-600' : scenarioIVPct < 0 ? 'text-blue-600' : 'text-slate-500'}`}>
              {scenarioIVPct >= 0 ? '+' : ''}{scenarioIVPct}%
            </span>
          </div>
          <input
            type="range" min="-50" max="100" step="5" value={scenarioIVPct}
            onChange={e => setScenarioIVPct(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-300 mt-0.5"><span>-50%</span><span>+100%</span></div>
        </div>

        {/* Days forward slider */}
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
            <span>Days Forward</span>
            <span className="font-mono text-slate-700">{scenarioDaysFwd}d</span>
          </div>
          <input
            type="range" min="0" max="30" step="1" value={scenarioDaysFwd}
            onChange={e => setScenarioDaysFwd(Number(e.target.value))}
            className="w-full accent-slate-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-300 mt-0.5"><span>Today</span><span>30d</span></div>
        </div>
      </div>

      {scenarioPnL !== null && hasScenario && (
        <div className={`mt-4 rounded-xl px-4 py-3 flex items-center justify-between ${
          scenarioPnL >= 0
            ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
            : 'bg-rose-50 border border-rose-100 text-rose-700'
        }`}>
          <span className="text-xs font-black uppercase tracking-wide">Scenario P&L vs current</span>
          <span className="font-mono font-black text-base">
            {scenarioPnL >= 0 ? '+' : ''}₹{Math.round(scenarioPnL).toLocaleString('en-IN')}
          </span>
        </div>
      )}
    </div>
  );
};

const GreeksTable = ({ legs, spot, lotSize, ivMult = 1, dte = null }) => {
  const rows = useMemo(() => legs.map(leg => {
    const g = calcLegGreeks(leg, spot, ivMult, dte);
    const n = leg.lots * lotSize;
    return {
      label: `${leg.side} ${leg.type} ${leg.strike}`,
      delta: g.delta * n,
      theta: g.theta * n,
      gamma: g.gamma * n,
      vega:  g.vega  * n,
    };
  }), [legs, spot, lotSize, ivMult, dte]);

  const net = rows.reduce(
    (acc, r) => ({ delta: acc.delta + r.delta, theta: acc.theta + r.theta, gamma: acc.gamma + r.gamma, vega: acc.vega + r.vega }),
    { delta: 0, theta: 0, gamma: 0, vega: 0 }
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center gap-3">
        <span className="font-black text-slate-800 text-sm">Position Greeks</span>
        <span className="text-[10px] text-slate-400 font-mono">spot ₹{spot.toLocaleString('en-IN')} · nearest expiry · rf 6.5%</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest">
            <tr>
              <th className="px-5 py-3 text-left">Leg</th>
              <th className="px-5 py-3 text-right">Δ Delta</th>
              <th className="px-5 py-3 text-right">θ Theta/day</th>
              <th className="px-5 py-3 text-right">Γ Gamma</th>
              <th className="px-5 py-3 text-right">ν Vega/1%IV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono font-bold text-slate-700">{r.label}</td>
                <td className={`px-5 py-3 text-right font-mono font-bold ${fmtColor(r.delta)}`}>{fmt(r.delta, 4)}</td>
                <td className={`px-5 py-3 text-right font-mono font-bold ${fmtColor(r.theta)}`}>₹{fmt(r.theta, 0)}</td>
                <td className={`px-5 py-3 text-right font-mono font-bold ${fmtColor(r.gamma)}`}>{fmt(r.gamma, 6)}</td>
                <td className={`px-5 py-3 text-right font-mono font-bold ${fmtColor(r.vega)}`}>₹{fmt(r.vega, 2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-indigo-50 border-t-2 border-indigo-100">
              <td className="px-5 py-3 font-black text-indigo-700 text-xs uppercase">Net Position</td>
              <td className={`px-5 py-3 text-right font-black font-mono text-sm ${fmtColor(net.delta)}`}>{fmt(net.delta, 4)}</td>
              <td className={`px-5 py-3 text-right font-black font-mono text-sm ${fmtColor(net.theta)}`}>₹{fmt(net.theta, 0)}</td>
              <td className={`px-5 py-3 text-right font-black font-mono text-sm ${fmtColor(net.gamma)}`}>{fmt(net.gamma, 6)}</td>
              <td className={`px-5 py-3 text-right font-black font-mono text-sm ${fmtColor(net.vega)}`}>₹{fmt(net.vega, 2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default ClickTrade;
