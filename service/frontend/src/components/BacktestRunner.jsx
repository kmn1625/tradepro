import { useState, useMemo } from 'react';
import { Play, BarChart2, TrendingUp, Clock, Target, AlertTriangle, HelpCircle, Info, X } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const EXCHANGE_CONFIGS = {
  weekly:  { label: 'Weekly & Monthly Expiries', sublabel: 'NIFTY | SENSEX',       indices: ['NIFTY', 'SENSEX'] },
  monthly: { label: 'Monthly Only Expiry',       sublabel: 'MIDCPNIFTY | BANKNIFTY | FINNIFTY | BANKEX', indices: ['MIDCPNIFTY', 'BANKNIFTY', 'FINNIFTY', 'BANKEX'] },
  stocks:  { label: 'Stocks - Cash / F&O',       sublabel: 'ALL NIFTY 500 STOCKS', indices: ['NIFTY500'] },
  delta:   { label: 'Delta Exchange',            sublabel: 'BTCUSD | ETHUSD',      indices: ['BTCUSD', 'ETHUSD'], isNew: true, algoTrading: true },
};

const EXPIRY_OPTIONS   = ['Weekly', 'Monthly', 'Next Week', 'Next Month'];
const STRIKE_CRITERIA  = ['Strike Type', 'Premium Range', 'Delta Range'];
const STRIKE_TYPES     = ['ATM', 'ITM1', 'ITM2', 'ITM3', 'OTM1', 'OTM2', 'OTM3'];
const RE_ENTRY_MODES   = ['RE ASAP', 'Same Day', 'Next Day'];
const TRAILING_MODES   = ['Lock', 'Lock and Trail', 'Trail Only'];
const SL_TYPES         = ['Max Loss', '% of Premium', 'Points'];
const TARGET_TYPES     = ['Max Profit', '% of Premium', 'Points'];
const MOMENTUM_MODES   = ['Points (Pts)', '% Move', 'ATR'];

// ── Shared mini-components ──────────────────────────────────────────────────

const ToggleSwitch = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-blue-500' : 'bg-slate-300'}`}
    role="switch"
    aria-checked={checked}
  >
    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
  </button>
);

const SegToggle = ({ options, value, onChange, small }) => (
  <div className="flex rounded overflow-hidden border border-slate-300">
    {options.map(opt => (
      <button
        key={opt}
        onClick={() => onChange(opt)}
        className={`${small ? 'px-2.5 py-1' : 'px-3 py-1.5'} text-xs font-semibold transition-all whitespace-nowrap ${
          value === opt ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >{opt}</button>
    ))}
  </div>
);

const StyledSelect = ({ value, onChange, options, disabled, className = '' }) => (
  <div className={`relative ${className}`}>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={`appearance-none border border-slate-300 rounded px-2 py-1.5 pr-6 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-full ${disabled ? 'opacity-50 cursor-not-allowed text-slate-400 bg-slate-100' : 'text-slate-700'}`}
    >
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
    <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </div>
);

const NumInput = ({ value, onChange, disabled, prefix, className = '' }) => (
  <div className={`flex items-center border border-slate-300 rounded overflow-hidden ${disabled ? 'opacity-50' : ''} ${className}`}>
    {prefix && <span className="bg-slate-100 border-r border-slate-300 px-2 py-1.5 text-xs font-bold text-slate-500 select-none">{prefix}</span>}
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      disabled={disabled}
      className={`px-2 py-1.5 text-xs font-mono text-slate-700 focus:outline-none w-full ${disabled ? 'bg-slate-100 cursor-not-allowed' : ''}`}
    />
  </div>
);

// ── Results sub-components ──────────────────────────────────────────────────

const MetricCard = ({ label, value, color = 'text-slate-800', sub }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
    <span className={`text-2xl font-black ${color}`}>{value}</span>
    {sub && <span className="block text-xs text-slate-400 mt-0.5">{sub}</span>}
  </div>
);

const EquityCurve = ({ data }) => {
  if (!data?.length) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Equity Curve</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={Math.floor(data.length / 6)} />
          <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9 }} width={52} />
          <Tooltip formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, 'Equity']} labelStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
          <Line type="monotone" dataKey="equity" stroke="#6366f1" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const HeatmapPanel = ({ heatmap }) => {
  if (!heatmap) return null;
  const { byDow, byMonth } = heatmap;
  const pnlColor = v => {
    if (v > 0) return `rgba(16,185,129,${Math.min(1, v / 30000) * 0.7 + 0.1})`;
    if (v < 0) return `rgba(239,68,68,${Math.min(1, Math.abs(v) / 30000) * 0.7 + 0.1})`;
    return '#f8fafc';
  };
  const dow     = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const months  = Object.keys(byMonth).sort();
  const dowData = dow.map(d => ({ name: d, pnl: byDow[d] || 0 }));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">P&L by Day of Week</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={dowData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9 }} width={42} />
            <Tooltip formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, 'P&L']} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {dowData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#10b981' : '#ef4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">P&L by Month</p>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))' }}>
          {months.map(mon => {
            const pnl = byMonth[mon] || 0;
            return (
              <div key={mon} className="rounded-lg p-1.5 text-center text-[9px] font-black leading-tight" style={{ backgroundColor: pnlColor(pnl) }}>
                <span className="block text-slate-600">{mon.slice(2)}</span>
                <span className={pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{pnl >= 0 ? '+' : ''}{(pnl / 1000).toFixed(1)}k</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const REASON_ICON  = { sl: <AlertTriangle size={10} />, target: <Target size={10} />, time: <Clock size={10} />, expiry: <BarChart2 size={10} />, condition: <TrendingUp size={10} />, eod: <Clock size={10} /> };
const REASON_COLOR = { sl: 'text-rose-600 bg-rose-50', target: 'text-emerald-600 bg-emerald-50', time: 'text-slate-500 bg-slate-50', expiry: 'text-amber-600 bg-amber-50', condition: 'text-indigo-600 bg-indigo-50', eod: 'text-slate-400 bg-slate-50' };

const TradeLog = ({ trades }) => {
  const [page, setPage] = useState(0);
  const PER   = 20;
  const pages = Math.ceil(trades.length / PER);
  const slice = trades.slice(page * PER, page * PER + PER);
  const fmt   = ms => new Date(ms + 5.5 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Trade Log</p>
        <span className="text-xs text-slate-400">{trades.length} trades</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px]">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Entry (IST)</th>
              <th className="px-4 py-2 text-left">Exit (IST)</th>
              <th className="px-4 py-2 text-right">Spot In</th>
              <th className="px-4 py-2 text-right">Spot Out</th>
              <th className="px-4 py-2 text-center">Exit</th>
              <th className="px-4 py-2 text-right">P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {slice.map(t => (
              <tr key={t.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-2 text-slate-400">{t.id}</td>
                <td className="px-4 py-2 font-mono text-slate-600">{fmt(t.entryTime)}</td>
                <td className="px-4 py-2 font-mono text-slate-600">{fmt(t.exitTime)}</td>
                <td className="px-4 py-2 text-right font-mono">{t.entrySpot?.toFixed(0)}</td>
                <td className="px-4 py-2 text-right font-mono">{t.exitSpot?.toFixed(0)}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${REASON_COLOR[t.exitReason] || 'bg-slate-50 text-slate-500'}`}>
                    {REASON_ICON[t.exitReason]} {t.exitReason}
                  </span>
                </td>
                <td className={`px-4 py-2 text-right font-black ${t.totalPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {t.totalPnl >= 0 ? '+' : ''}₹{t.totalPnl?.toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-2 justify-end">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 rounded text-xs font-bold disabled:opacity-30 hover:bg-slate-100">‹</button>
          <span className="text-xs text-slate-400">{page + 1} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1} className="px-2 py-1 rounded text-xs font-bold disabled:opacity-30 hover:bg-slate-100">›</button>
        </div>
      )}
    </div>
  );
};

// ── Strategy leg row ──────────────────────────────────────────────────────────

const StratLegRow = ({ leg, idx, onUpdate, onRemove }) => (
  <div className="border border-slate-200 rounded-lg p-3">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-bold text-slate-600">Leg {idx + 1}</span>
      <button onClick={onRemove} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={13} /></button>
    </div>
    <div className="flex items-end gap-4 flex-wrap">
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Segment</div>
        <SegToggle options={['Futures', 'Options']} value={leg.segment} onChange={v => onUpdate('segment', v)} small />
      </div>
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Total Lot</div>
        <input type="number" min="1" value={leg.lots} onChange={e => onUpdate('lots', Math.max(1, Number(e.target.value)))}
          className="border border-slate-300 rounded px-2 py-1.5 text-xs font-mono text-slate-700 w-20 focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Position</div>
        <SegToggle options={['Buy', 'Sell']} value={leg.position} onChange={v => onUpdate('position', v)} small />
      </div>
      {leg.segment === 'Options' && (
        <>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Option Type</div>
            <SegToggle options={['Call', 'Put']} value={leg.optionType} onChange={v => onUpdate('optionType', v)} small />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Expiry</div>
            <StyledSelect value={leg.expiry} onChange={v => onUpdate('expiry', v)} options={EXPIRY_OPTIONS} className="w-28" />
          </div>
          <div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase mb-1">Strike Criteria <HelpCircle size={10} className="text-slate-400" /></div>
            <StyledSelect value={leg.strikeCriteria} onChange={v => onUpdate('strikeCriteria', v)} options={STRIKE_CRITERIA} className="w-32" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Strike Type</div>
            <StyledSelect value={leg.strikeType} onChange={v => onUpdate('strikeType', v)} options={STRIKE_TYPES} className="w-24" />
          </div>
        </>
      )}
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const BacktestRunner = () => {
  // Exchange
  const [activeExchange, setActiveExchange] = useState('weekly');
  const [selectedIndex,  setSelectedIndex]  = useState('NIFTY');

  // Instrument
  const [underlyingFrom, setUnderlyingFrom] = useState('Cash');

  // Entry settings
  const [strategyType,    setStrategyType]    = useState('Intraday');
  const [entryTime,       setEntryTime]       = useState('09:35');
  const [exitTime,        setExitTime]        = useState('15:15');
  const [noReentry,       setNoReentry]       = useState(false);
  const [noReentryTime,   setNoReentryTime]   = useState('09:35');
  const [overallMom,      setOverallMom]      = useState(false);
  const [momMode,         setMomMode]         = useState('Points (Pts)');
  const [momValue,        setMomValue]        = useState(0);

  // Legwise
  const [squareOff,       setSquareOff]       = useState('Partial');
  const [trailBreakeven,  setTrailBreakeven]  = useState(false);
  const [trailLegs,       setTrailLegs]       = useState('All Legs');

  // Leg builder
  const [legCollapsed, setLegCollapsed] = useState(false);
  const [bSegment,     setBSegment]     = useState('Options');
  const [bLots,        setBLots]        = useState(1);
  const [bPosition,    setBPosition]    = useState('Buy');
  const [bOptionType,  setBOptionType]  = useState('Call');
  const [bExpiry,      setBExpiry]      = useState('Weekly');
  const [bStrikeCrit,  setBStrikeCrit]  = useState('Strike Type');
  const [bStrikeType,  setBStrikeType]  = useState('ATM');
  const [stratLegs,    setStratLegs]    = useState([]);

  // Overall strategy
  const [oSL,   setOSL]   = useState({ enabled: false, type: 'Max Loss',   value: 0, reentry: false, reentryMode: 'RE ASAP', reentryCount: 1 });
  const [oTgt,  setOTgt]  = useState({ enabled: false, type: 'Max Profit', value: 0, reentry: false, reentryMode: 'RE ASAP', reentryCount: 1 });
  const [oTrail, setOTrail] = useState({ enabled: false, mode: 'Lock', ifProfitReaches: 0, lockProfit: 1 });

  // Dates
  const [startDate, setStartDate] = useState('2025-06-08');
  const [endDate,   setEndDate]   = useState('2026-06-08');

  // Results
  const [running, setRunning] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  const handleExchangeChange = (key) => {
    setActiveExchange(key);
    setSelectedIndex(EXCHANGE_CONFIGS[key].indices[0] || '');
  };

  const addLeg = () => {
    setStratLegs(p => [...p, {
      id: Date.now(), segment: bSegment, lots: bLots,
      position: bPosition, optionType: bOptionType,
      expiry: bExpiry, strikeCriteria: bStrikeCrit, strikeType: bStrikeType,
    }]);
  };

  const updateLeg = (id, field, val) =>
    setStratLegs(p => p.map(l => l.id === id ? { ...l, [field]: val } : l));

  const removeLeg = (id) => setStratLegs(p => p.filter(l => l.id !== id));

  const runBacktest = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const mappedLegs = stratLegs.map(l => ({
        side:         l.position === 'Buy' ? 'BUY' : 'SELL',
        type:         l.optionType === 'Call' ? 'CE' : 'PE',
        strikeOffset: l.strikeType === 'ATM' ? 0 : l.strikeType.startsWith('ITM') ? -parseInt(l.strikeType.slice(3)) : parseInt(l.strikeType.slice(3)),
        lots:         l.lots,
      }));
      const payload = {
        underlying:  selectedIndex,
        dateRange:   { from: startDate, to: endDate },
        legs:        mappedLegs.length ? mappedLegs : [{ side: 'SELL', type: 'CE', strikeOffset: 0, lots: 1 }, { side: 'SELL', type: 'PE', strikeOffset: 0, lots: 1 }],
        sl:          oSL.enabled   ? { type: 'pct', value: oSL.value }   : null,
        target:      oTgt.enabled  ? { type: 'pct', value: oTgt.value }  : null,
        entryTime, exitTime, strategyType,
      };
      const res  = await fetch(`${API_BASE}/api/backtest/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.status === 'COMING_SOON') { setError(data.detail); return; }
      if (!res.ok) throw new Error(data.error || 'Backtest failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const cfg = EXCHANGE_CONFIGS[activeExchange];

  return (
    <div className="max-w-5xl mx-auto space-y-0">

      {/* ── Exchange tabs ── */}
      <div className="grid grid-cols-4 bg-white border border-slate-200 rounded-t-xl overflow-hidden">
        {Object.entries(EXCHANGE_CONFIGS).map(([key, c]) => (
          <button
            key={key}
            onClick={() => handleExchangeChange(key)}
            className={`p-3 text-left border-r border-slate-200 last:border-r-0 transition-all ${activeExchange === key ? 'bg-blue-50 border-b-2 border-b-blue-500' : 'bg-white hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className={`text-xs font-semibold leading-tight ${activeExchange === key ? 'text-blue-700' : 'text-slate-700'}`}>{c.label}</span>
              {c.isNew && <span className="bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded leading-none">New</span>}
            </div>
            <div className={`text-[11px] font-medium ${activeExchange === key ? 'text-blue-500' : 'text-slate-500'}`}>{c.sublabel}</div>
            {c.algoTrading && (
              <div className={`flex items-center gap-1 mt-0.5 text-[10px] ${activeExchange === key ? 'text-blue-400' : 'text-slate-400'}`}>
                Algo Trading <HelpCircle size={10} />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* ── Two-column: Instrument + Entry ── */}
      <div className="grid grid-cols-2 bg-white border-x border-b border-slate-200">
        {/* LEFT — Instrument settings */}
        <div className="p-5 border-r border-slate-200">
          <div className="text-sm font-bold text-slate-700 mb-4">Instrument settings</div>
          <div className="border border-slate-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-6">
              <span className="text-xs font-medium text-slate-600 w-24 text-right flex-shrink-0">Index</span>
              <div className="relative flex-1">
                <select
                  value={selectedIndex}
                  onChange={e => setSelectedIndex(e.target.value)}
                  className="appearance-none border border-slate-300 rounded px-3 py-1.5 pr-8 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
                >
                  {cfg.indices.map(i => <option key={i}>{i}</option>)}
                </select>
                <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1 w-24 justify-end flex-shrink-0">
                <span className="text-xs font-medium text-slate-600">Underlying from</span>
                <HelpCircle size={11} className="text-slate-400" />
              </div>
              <SegToggle options={['Cash', 'Futures']} value={underlyingFrom} onChange={setUnderlyingFrom} />
            </div>
          </div>

          {/* Legwise settings */}
          <div className="text-sm font-bold text-slate-700 mt-5 mb-4">Legwise settings</div>
          <div className="border border-slate-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1 w-24 justify-end flex-shrink-0">
                <span className="text-xs font-medium text-slate-600">Square Off</span>
                <HelpCircle size={11} className="text-slate-400" />
              </div>
              <SegToggle options={['Partial', 'Complete']} value={squareOff} onChange={setSquareOff} />
            </div>

            <div className="flex items-start gap-4">
              <input
                type="checkbox"
                checked={trailBreakeven}
                onChange={e => setTrailBreakeven(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs font-medium text-slate-600">Trail SL to Break-even price</span>
                <HelpCircle size={11} className="text-slate-400" />
              </div>
              {trailBreakeven && (
                <SegToggle options={['All Legs', 'SL Legs']} value={trailLegs} onChange={setTrailLegs} small />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Entry settings */}
        <div className="p-5">
          <div className="text-sm font-bold text-slate-700 mb-4">Entry settings</div>
          <div className="border border-slate-200 rounded-lg p-4 space-y-4">
            {/* Strategy type */}
            <div className="flex items-center gap-6">
              <span className="text-xs font-medium text-slate-600 w-28 flex-shrink-0">Strategy Type</span>
              <SegToggle options={['Intraday', 'BTST', 'Positional']} value={strategyType} onChange={setStrategyType} />
            </div>

            {/* Entry / Exit time */}
            <div className="flex items-center gap-6">
              <span className="text-xs font-medium text-slate-600 w-28 flex-shrink-0">Entry Time</span>
              <div className="flex items-center border border-slate-300 rounded px-2 py-1.5 gap-1 w-32">
                <input type="time" value={entryTime} onChange={e => setEntryTime(e.target.value)} className="text-xs font-mono text-slate-700 focus:outline-none flex-1 bg-transparent" />
              </div>
              <span className="text-xs font-medium text-slate-600">Exit Time</span>
              <div className="flex items-center border border-slate-300 rounded px-2 py-1.5 gap-1 w-32">
                <input type="time" value={exitTime} onChange={e => setExitTime(e.target.value)} className="text-xs font-mono text-slate-700 focus:outline-none flex-1 bg-transparent" />
              </div>
            </div>

            {/* No re-entry after */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-medium ${noReentry ? 'text-orange-600' : 'text-slate-600'}`}>No re-entry after</span>
                    <HelpCircle size={11} className="text-slate-400" />
                  </div>
                  <ToggleSwitch checked={noReentry} onChange={setNoReentry} />
                </div>
                <div className="flex items-center border border-slate-300 rounded px-2 py-1.5 gap-1 w-32">
                  <input
                    type="time"
                    value={noReentryTime}
                    onChange={e => setNoReentryTime(e.target.value)}
                    disabled={!noReentry}
                    className={`text-xs font-mono focus:outline-none flex-1 bg-transparent ${noReentry ? 'text-slate-700' : 'text-slate-400'}`}
                  />
                </div>
              </div>

              {/* Overall Momentum */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-medium ${overallMom ? 'text-orange-600' : 'text-slate-600'}`}>Overall Momentum</span>
                    <HelpCircle size={11} className="text-slate-400" />
                  </div>
                  <ToggleSwitch checked={overallMom} onChange={setOverallMom} />
                </div>
                <div className="flex items-center gap-2">
                  <StyledSelect
                    value={momMode}
                    onChange={setMomMode}
                    options={MOMENTUM_MODES}
                    disabled={!overallMom}
                    className="w-36"
                  />
                  <input
                    type="number"
                    value={momValue}
                    onChange={e => setMomValue(Number(e.target.value))}
                    disabled={!overallMom}
                    className={`border border-slate-300 rounded px-2 py-1.5 text-xs font-mono w-14 focus:outline-none ${!overallMom ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'text-slate-700'}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Leg Builder ── */}
      <div className="bg-white border-x border-b border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-700">Leg Builder</span>
            <HelpCircle size={13} className="text-slate-400 cursor-help" />
          </div>
          <button
            onClick={() => setLegCollapsed(v => !v)}
            className="text-blue-600 text-xs font-semibold hover:text-blue-800 transition-colors"
          >
            {legCollapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>

        {!legCollapsed && (
          <>
            <div className="flex items-end gap-4 flex-wrap mb-5">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Select segments</div>
                <SegToggle options={['Futures', 'Options']} value={bSegment} onChange={setBSegment} />
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Total Lot</div>
                <input
                  type="number" min="1" value={bLots}
                  onChange={e => setBLots(Math.max(1, Number(e.target.value)))}
                  className="border border-slate-300 rounded px-3 py-1.5 text-xs font-mono text-slate-700 w-20 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Position</div>
                <SegToggle options={['Buy', 'Sell']} value={bPosition} onChange={setBPosition} />
              </div>

              {bSegment === 'Options' && (
                <>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Option Type</div>
                    <SegToggle options={['Call', 'Put']} value={bOptionType} onChange={setBOptionType} />
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Expiry</div>
                    <StyledSelect value={bExpiry} onChange={setBExpiry} options={EXPIRY_OPTIONS} className="w-28" />
                  </div>

                  <div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Strike Criteria <HelpCircle size={10} className="text-slate-400" />
                    </div>
                    <StyledSelect value={bStrikeCrit} onChange={setBStrikeCrit} options={STRIKE_CRITERIA} className="w-32" />
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Strike Type</div>
                    <StyledSelect value={bStrikeType} onChange={setBStrikeType} options={STRIKE_TYPES} className="w-24" />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-center">
              <button
                onClick={addLeg}
                className="bg-blue-700 hover:bg-blue-800 text-white px-10 py-2.5 rounded text-sm font-bold transition-all shadow-sm"
              >
                Add Leg
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Strategy Legs ── */}
      {stratLegs.length > 0 && (
        <div className="bg-white border-x border-b border-slate-200 p-4">
          <div className="space-y-3">
            {stratLegs.map((leg, idx) => (
              <StratLegRow
                key={leg.id}
                leg={leg}
                idx={idx}
                onUpdate={(f, v) => updateLeg(leg.id, f, v)}
                onRemove={() => removeLeg(leg.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Overall strategy settings ── */}
      <div className="bg-white border-x border-b border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-bold text-slate-700">Overall strategy settings</span>
          <HelpCircle size={13} className="text-slate-400 cursor-help" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Card 1 — Overall Stop Loss */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ToggleSwitch checked={oSL.enabled} onChange={v => setOSL(p => ({ ...p, enabled: v }))} />
              <span className={`text-xs font-semibold ${oSL.enabled ? 'text-orange-600' : 'text-slate-600'}`}>Overall Stop Loss</span>
            </div>
            <div className="flex items-center gap-2">
              <StyledSelect value={oSL.type} onChange={v => setOSL(p => ({ ...p, type: v }))} options={SL_TYPES} disabled={!oSL.enabled} className="flex-1" />
              <NumInput value={oSL.value} onChange={v => setOSL(p => ({ ...p, value: v }))} disabled={!oSL.enabled} className="w-20" />
            </div>
            <div className="flex items-center gap-2">
              <ToggleSwitch checked={oSL.reentry} onChange={v => setOSL(p => ({ ...p, reentry: v }))} />
              <div className="flex items-center gap-1">
                <span className={`text-xs font-medium ${oSL.reentry ? 'text-orange-600' : 'text-slate-500'}`}>Overall Re-entry on SL</span>
                <HelpCircle size={10} className="text-slate-400" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StyledSelect value={oSL.reentryMode} onChange={v => setOSL(p => ({ ...p, reentryMode: v }))} options={RE_ENTRY_MODES} disabled={!oSL.reentry} className="flex-1" />
              <StyledSelect value={String(oSL.reentryCount)} onChange={v => setOSL(p => ({ ...p, reentryCount: Number(v) }))} options={['1', '2', '3', '5', '10']} disabled={!oSL.reentry} className="w-16" />
            </div>
          </div>

          {/* Card 2 — Overall Target */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ToggleSwitch checked={oTgt.enabled} onChange={v => setOTgt(p => ({ ...p, enabled: v }))} />
              <span className={`text-xs font-semibold ${oTgt.enabled ? 'text-orange-600' : 'text-slate-600'}`}>Overall Target</span>
            </div>
            <div className="flex items-center gap-2">
              <StyledSelect value={oTgt.type} onChange={v => setOTgt(p => ({ ...p, type: v }))} options={TARGET_TYPES} disabled={!oTgt.enabled} className="flex-1" />
              <NumInput value={oTgt.value} onChange={v => setOTgt(p => ({ ...p, value: v }))} disabled={!oTgt.enabled} className="w-20" />
            </div>
            <div className="flex items-center gap-2">
              <ToggleSwitch checked={oTgt.reentry} onChange={v => setOTgt(p => ({ ...p, reentry: v }))} />
              <div className="flex items-center gap-1">
                <span className={`text-xs font-medium ${oTgt.reentry ? 'text-orange-600' : 'text-slate-500'}`}>Overall Re-entry on Tgt</span>
                <HelpCircle size={10} className="text-slate-400" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StyledSelect value={oTgt.reentryMode} onChange={v => setOTgt(p => ({ ...p, reentryMode: v }))} options={RE_ENTRY_MODES} disabled={!oTgt.reentry} className="flex-1" />
              <StyledSelect value={String(oTgt.reentryCount)} onChange={v => setOTgt(p => ({ ...p, reentryCount: Number(v) }))} options={['1', '2', '3', '5', '10']} disabled={!oTgt.reentry} className="w-16" />
            </div>
          </div>

          {/* Card 3 — Trailing Options */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ToggleSwitch checked={oTrail.enabled} onChange={v => setOTrail(p => ({ ...p, enabled: v }))} />
              <span className={`text-xs font-semibold ${oTrail.enabled ? 'text-orange-600' : 'text-slate-600'}`}>Trailing Options</span>
            </div>
            <StyledSelect value={oTrail.mode} onChange={v => setOTrail(p => ({ ...p, mode: v }))} options={TRAILING_MODES} disabled={!oTrail.enabled} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-slate-500 mb-1">If profit reaches</div>
                <input
                  type="number"
                  value={oTrail.ifProfitReaches}
                  onChange={e => setOTrail(p => ({ ...p, ifProfitReaches: Number(e.target.value) }))}
                  className="border border-slate-300 rounded px-2 py-1.5 text-xs font-mono text-slate-700 w-full focus:outline-none"
                />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-1">Lock profit</div>
                <input
                  type="number"
                  value={oTrail.lockProfit}
                  onChange={e => setOTrail(p => ({ ...p, lockProfit: Number(e.target.value) }))}
                  className="border border-slate-300 rounded px-2 py-1.5 text-xs font-mono text-slate-700 w-full focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Backtest Duration ── */}
      <div className="bg-white border-x border-b border-slate-200 px-5 py-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-orange-600">Enter the duration of your backtest</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-medium">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-medium">End Date</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-orange-50 border-x border-b border-orange-200 rounded-b-xl px-5 py-3 flex items-center justify-end gap-2">
        <Info size={13} className="text-orange-500" />
        <span className="text-xs font-bold text-orange-600">Latest Backtest data is available for 07-Jun-26</span>
      </div>

      {/* ── Run button ── */}
      <div className="pt-4">
        <button
          onClick={runBacktest}
          disabled={running}
          className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-sm"
        >
          <Play size={16} />
          {running ? 'Running Backtest…' : 'Run Backtest'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-700 font-bold text-sm">
          {error}
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div className="space-y-4 pt-2">
          {result.dataSource === 'mock-gbm' && (
            <div className="text-xs font-bold bg-amber-100 text-amber-600 px-4 py-2 rounded-xl">
              Mock data — run backfill script for real data
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <MetricCard label="Total P&L"    value={`₹${result.totalPnl?.toLocaleString('en-IN')}`} color={result.totalPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
            <MetricCard label="Win Rate"     value={`${result.winRate}%`}    color="text-indigo-600" />
            <MetricCard label="Trades"       value={result.tradeCount}       color="text-slate-800" />
            <MetricCard label="Max Drawdown" value={`${result.maxDrawdown}%`} color="text-rose-600" />
            <MetricCard label="Sharpe"       value={result.sharpe?.toFixed(2)} color={result.sharpe >= 1 ? 'text-emerald-600' : result.sharpe >= 0 ? 'text-amber-600' : 'text-rose-600'} />
            <MetricCard label="Profit Factor" value={result.profitFactor === null ? '∞' : result.profitFactor?.toFixed(2)} color={result.profitFactor === null || result.profitFactor >= 1.5 ? 'text-emerald-600' : 'text-amber-600'} />
          </div>
          <EquityCurve data={result.equityCurve} />
          <HeatmapPanel heatmap={result.heatmap} />
          {result.trades?.length > 0 && <TradeLog trades={result.trades} />}
        </div>
      )}
    </div>
  );
};

export default BacktestRunner;
