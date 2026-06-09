import { useState, useEffect, useRef } from 'react';
import { Plus, Minus, Info, ChevronDown, HelpCircle, X } from 'lucide-react';

const EXCHANGE_CONFIGS = {
  weekly: {
    label: 'Weekly & Monthly Expiries',
    sublabel: 'NIFTY | SENSEX',
    indices: ['NIFTY', 'SENSEX'],
  },
  monthly: {
    label: 'Monthly Only Expiry',
    sublabel: 'MIDCPNIFTY | BANKNIFTY | FINNIFTY | BANKEX',
    indices: ['MIDCPNIFTY', 'BANKNIFTY', 'FINNIFTY', 'BANKEX'],
  },
  stocks: {
    label: 'Stocks - Cash / F&O',
    sublabel: 'ALL NIFTY 500 STOCKS',
    indices: ['NIFTY500'],
  },
  delta: {
    label: 'Delta Exchange',
    sublabel: 'BTCUSD | ETHUSD',
    indices: ['BTCUSD', 'ETHUSD'],
    isNew: true,
    algoTrading: true,
  },
};

const EXPIRY_OPTIONS = ['Weekly', 'Monthly', 'Next Week', 'Next Month'];
const STRIKE_CRITERIA = ['Strike Type', 'Premium Range', 'Delta Range'];
const STRIKE_TYPES = ['ATM', 'ITM1', 'ITM2', 'ITM3', 'OTM1', 'OTM2', 'OTM3'];

const defaultBuilder = () => ({
  segment: 'Options',
  expiry: 'Weekly',
  lots: 1,
  position: 'S',
  optionType: 'Call',
  strikeCriteria: 'Strike Type',
  strikeType: 'ATM',
});

const ExpandableInput = ({ label, currency, value, onChange }) => (
  <div>
    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">{label}</div>
    <div className="flex items-center border border-slate-300 rounded overflow-hidden">
      <span className="bg-slate-100 border-r border-slate-300 px-2 py-1.5 text-xs font-bold text-slate-500 select-none">
        {currency}
      </span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 px-2 py-1.5 text-xs font-mono text-slate-700 focus:outline-none w-0 min-w-0"
      />
    </div>
  </div>
);

const SectionToggleBtn = ({ label, expanded, onToggle }) => (
  <button
    onClick={onToggle}
    className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border transition-all ${
      expanded
        ? 'bg-blue-50 border-blue-300 text-blue-600'
        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
    }`}
  >
    {label}
    {expanded ? <Minus size={11} /> : <Plus size={11} />}
  </button>
);

const LegRow = ({ leg, isDelta, onUpdate, onRemove, label }) => {
  const [expanded, setExpanded] = useState({
    targetProfit: false,
    stopLoss: false,
    trailSL: false,
    simpleMomentum: false,
  });
  const [tgtProfit, setTgtProfit] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const currency = isDelta ? '$' : '₹';

  const toggle = (k) => setExpanded(p => ({ ...p, [k]: !p[k] }));

  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-600">{label}</span>
        <button onClick={onRemove} className="text-slate-300 hover:text-rose-500 transition-colors">
          <X size={13} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-3">
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Segment</div>
          <div className="flex rounded overflow-hidden border border-slate-300 w-fit">
            {['FUT', 'Options'].map(seg => (
              <button
                key={seg}
                onClick={() => onUpdate('segment', seg)}
                className={`px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  leg.segment === seg ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {seg}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Expiry</div>
          <div className="relative">
            <select
              value={leg.expiry}
              onChange={e => onUpdate('expiry', e.target.value)}
              className="appearance-none border border-slate-300 rounded px-2 py-1.5 pr-6 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
            >
              {EXPIRY_OPTIONS.map(e => <option key={e}>{e}</option>)}
            </select>
            <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Lots</div>
          <input
            type="number"
            min="1"
            value={leg.lots}
            onChange={e => onUpdate('lots', Math.max(1, Number(e.target.value)))}
            className="border border-slate-300 rounded px-2 py-1.5 text-xs font-mono text-slate-700 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Position</div>
          <div className="flex rounded overflow-hidden border border-slate-300 w-fit">
            {['B', 'S'].map(pos => (
              <button
                key={pos}
                onClick={() => onUpdate('position', pos)}
                className={`w-9 py-1.5 text-xs font-black transition-all ${
                  leg.position === pos ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
      </div>

      {leg.segment === 'Options' && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Option Type</div>
            <div className="flex rounded overflow-hidden border border-slate-300 w-fit">
              {['Call', 'Put'].map(t => (
                <button
                  key={t}
                  onClick={() => onUpdate('optionType', t)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-all ${
                    leg.optionType === t ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase mb-1">
              Strike Criteria <HelpCircle size={10} className="text-slate-400" />
            </div>
            <div className="relative">
              <select
                value={leg.strikeCriteria}
                onChange={e => onUpdate('strikeCriteria', e.target.value)}
                className="appearance-none border border-slate-300 rounded px-2 py-1.5 pr-6 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
              >
                {STRIKE_CRITERIA.map(c => <option key={c}>{c}</option>)}
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Strike Type</div>
            <div className="relative">
              <select
                value={leg.strikeType}
                onChange={e => onUpdate('strikeType', e.target.value)}
                className="appearance-none border border-slate-300 rounded px-2 py-1.5 pr-6 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
              >
                {STRIKE_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <SectionToggleBtn label="Tgt Profit" expanded={expanded.targetProfit} onToggle={() => toggle('targetProfit')} />
        <SectionToggleBtn label="Stop Loss" expanded={expanded.stopLoss} onToggle={() => toggle('stopLoss')} />
        <SectionToggleBtn label="Trail SL" expanded={expanded.trailSL} onToggle={() => toggle('trailSL')} />
        <SectionToggleBtn label="Simple Momentum" expanded={expanded.simpleMomentum} onToggle={() => toggle('simpleMomentum')} />
      </div>

      {expanded.targetProfit && (
        <div className="mt-2 p-3 bg-slate-50 rounded-lg grid grid-cols-2 gap-3">
          <ExpandableInput label="Target Profit" currency={currency} value={tgtProfit} onChange={setTgtProfit} />
        </div>
      )}
      {expanded.stopLoss && (
        <div className="mt-2 p-3 bg-slate-50 rounded-lg grid grid-cols-2 gap-3">
          <ExpandableInput label="Stop Loss" currency={currency} value={stopLoss} onChange={setStopLoss} />
        </div>
      )}
      {expanded.trailSL && (
        <div className="mt-2 p-3 bg-slate-50 rounded-lg grid grid-cols-3 gap-3">
          {['Lock at profit', 'Lock SL at', 'Trail by'].map(lbl => (
            <ExpandableInput key={lbl} label={lbl} currency={currency} value={0} onChange={() => {}} />
          ))}
        </div>
      )}
      {expanded.simpleMomentum && (
        <div className="mt-2 p-3 bg-slate-50 rounded-lg grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Entry Condition</div>
            <select className="border border-slate-300 rounded px-2 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              <option>Bullish</option>
              <option>Bearish</option>
            </select>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Candle Size (%)</div>
            <input type="number" defaultValue="0.5" step="0.1" className="border border-slate-300 rounded px-2 py-1.5 text-xs font-mono w-full focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>
      )}
    </div>
  );
};

const BASE_PT_PRICES = { NIFTY: 22453, SENSEX: 74000, MIDCPNIFTY: 13500, BANKNIFTY: 47285, FINNIFTY: 23800, BANKEX: 55000, NIFTY500: 22453, BTCUSD: 65000, ETHUSD: 3000 };

const PaperTrading = () => {
  const [activeExchange, setActiveExchange] = useState('delta');
  const [selectedIndex, setSelectedIndex]   = useState('BTCUSD');
  const [strategyType, setStrategyType]     = useState('Intraday');
  const [entryTime, setEntryTime]           = useState('18:35');
  const [exitTime, setExitTime]             = useState('17:20');

  const [builder, setBuilder] = useState(defaultBuilder());
  const [builderExpanded, setBuilderExpanded] = useState({
    targetProfit: false, stopLoss: false, trailSL: false, simpleMomentum: false,
  });
  const [builderTgtProfit, setBuilderTgtProfit] = useState(0);
  const [builderStopLoss, setBuilderStopLoss]   = useState(0);

  const [strategyLegs, setStrategyLegs] = useState([]);

  const [overallSLOpen, setOverallSLOpen]         = useState(false);
  const [overallTargetOpen, setOverallTargetOpen] = useState(false);
  const [overallSL, setOverallSL]                 = useState(0);
  const [overallTarget, setOverallTarget]         = useState(0);

  const [lockMode, setLockMode]   = useState('Lock and Trail');
  const [lockVals, setLockVals]   = useState({ ifProfitReaches: 0, lockProfit: 1, forEveryIncreaseOf: 0, trailProfitBy: 0 });
  const [trailToEntry, setTrailToEntry] = useState(true);

  const [timeRange, setTimeRange] = useState('1Y');

  // Paper trading state
  const [simPrices, setSimPrices] = useState(() => ({ ...BASE_PT_PRICES }));
  const [paperBalance, setPaperBalance] = useState(500000);
  const [paperPos, setPaperPos] = useState({});
  const [paperHistory, setPaperHistory] = useState([
    { id: 1, symbol: 'NIFTY', direction: 'BUY', entryPrice: 22400, exitPrice: 22450, lots: 1, pnl: 50, time: '09:35:00', status: 'CLOSED' },
    { id: 2, symbol: 'BANKNIFTY', direction: 'SELL', entryPrice: 47300, exitPrice: 47250, lots: 1, pnl: 50, time: '10:15:00', status: 'CLOSED' },
  ]);

  // Rule engine state
  const [beArmed, setBeArmed]             = useState(false);
  const [isLocked, setIsLocked]           = useState(false);
  const [lockFloor, setLockFloor]         = useState(null);
  const [lastExitPrice, setLastExitPrice] = useState(null);
  const [ruleLog, setRuleLog]             = useState(null);
  const [reentrySignal, setReentrySignal]   = useState(false);
  const [reentryEnabled, setReentryEnabled] = useState(false);
  const reentryDirRef = useRef(null);
  const eng      = useRef({ hwPnl: 0, exiting: false, lockFloor: null });
  const prevPosRef = useRef(0);

  // Simulated price ticker — updates every 1.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setSimPrices(prev => {
        const next = { ...prev };
        Object.keys(BASE_PT_PRICES).forEach(sym => {
          const drift = (Math.random() - 0.49) * next[sym] * 0.0006;
          next[sym] = parseFloat(Math.max(1, next[sym] + drift).toFixed(2));
        });
        return next;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const exchangeCfg = EXCHANGE_CONFIGS[activeExchange];
  const isDelta = activeExchange === 'delta';
  const currency = isDelta ? '$' : '₹';

  const currentPrice  = simPrices[selectedIndex] || BASE_PT_PRICES[selectedIndex] || 0;
  const openPaperPos  = paperPos[selectedIndex];
  const currentPos    = openPaperPos ? openPaperPos.lots * (openPaperPos.direction === 'BUY' ? 1 : -1) : 0;
  const entryPrice    = openPaperPos?.entryPrice || 0;
  const openPnl       = openPaperPos
    ? (openPaperPos.direction === 'BUY'
        ? currentPrice - openPaperPos.entryPrice
        : openPaperPos.entryPrice - currentPrice) * openPaperPos.lots
    : 0;
  const closedPnl = paperHistory
    .filter(t => t.status === 'CLOSED')
    .reduce((s, t) => s + (t.pnl || 0), 0);

  const paperExecute = (direction) => {
    if (openPaperPos) return;
    const price = simPrices[selectedIndex] || BASE_PT_PRICES[selectedIndex];
    const lots  = builder.lots;
    setPaperPos(prev => ({ ...prev, [selectedIndex]: { direction, entryPrice: price, lots } }));
    setPaperHistory(prev => [{
      id: Date.now(), symbol: selectedIndex, direction,
      entryPrice: price, exitPrice: null, lots,
      pnl: null, time: new Date().toLocaleTimeString(), status: 'OPEN',
    }, ...prev]);
  };

  const paperSquareOff = () => {
    if (!openPaperPos) return;
    const price = simPrices[selectedIndex];
    const pnl = parseFloat(((openPaperPos.direction === 'BUY'
      ? price - openPaperPos.entryPrice
      : openPaperPos.entryPrice - price) * openPaperPos.lots).toFixed(2));
    setPaperBalance(prev => parseFloat((prev + pnl).toFixed(2)));
    setPaperPos(prev => { const n = { ...prev }; delete n[selectedIndex]; return n; });
    setPaperHistory(prev => prev.map(t =>
      t.symbol === selectedIndex && t.status === 'OPEN'
        ? { ...t, exitPrice: price, pnl, status: 'CLOSED' }
        : t
    ));
  };

  // Auto-clear rule log after 4s
  useEffect(() => {
    if (!ruleLog) return;
    const t = setTimeout(() => setRuleLog(null), 4000);
    return () => clearTimeout(t);
  }, [ruleLog]);

  // Reset rule engine when new position opens
  useEffect(() => {
    const prev = prevPosRef.current;
    prevPosRef.current = currentPos;
    if (prev === 0 && currentPos !== 0) {
      const e = eng.current;
      e.hwPnl = 0; e.lockFloor = null;
      setBeArmed(false); setLockFloor(null); setIsLocked(false); setLastExitPrice(null);
    }
  }, [currentPos]);

  // Rule engine — fires on every simulated price tick
  useEffect(() => {
    const e = eng.current;
    if (e.exiting) return;

    if (currentPos === 0) {
      if (e.hwPnl !== 0) { e.hwPnl = 0; e.lockFloor = null; }
      if (lastExitPrice !== null) {
        const near = Math.abs(currentPrice - lastExitPrice) <= 5;
        setReentrySignal(near);
        if (near && reentryEnabled && reentryDirRef.current && !openPaperPos) {
          const dir  = reentryDirRef.current;
          const lots = 1;
          reentryDirRef.current = null;
          setLastExitPrice(null);
          setReentrySignal(false);
          const price = currentPrice;
          setPaperPos(prev => ({ ...prev, [selectedIndex]: { direction: dir, entryPrice: price, lots } }));
          setPaperHistory(prev => [{
            id: Date.now(), symbol: selectedIndex, direction: dir,
            entryPrice: price, exitPrice: null, lots,
            pnl: null, time: new Date().toLocaleTimeString(), status: 'OPEN',
          }, ...prev]);
          setRuleLog(`[AUTO RE-ENTRY] ${selectedIndex} ${dir} @ ${currency}${price.toFixed(2)}`);
        }
      }
      return;
    }
    setReentrySignal(false);

    const pnlPts = (currentPrice - entryPrice) * Math.sign(currentPos);
    if (pnlPts > e.hwPnl) e.hwPnl = pnlPts;
    if (pnlPts > 5 && !beArmed) setBeArmed(true);

    const doAutoExit = (reason) => {
      e.exiting = true;
      reentryDirRef.current = currentPos > 0 ? 'BUY' : 'SELL';
      const pnl = parseFloat(((currentPos > 0 ? currentPrice - entryPrice : entryPrice - currentPrice) * Math.abs(currentPos)).toFixed(2));
      setRuleLog(`[${reason}] AUTO-EXIT ${selectedIndex} @ ${currency}${currentPrice.toFixed(2)}`);
      setPaperBalance(prev => parseFloat((prev + pnl).toFixed(2)));
      setPaperPos(prev => { const n = { ...prev }; delete n[selectedIndex]; return n; });
      setPaperHistory(prev => prev.map(t =>
        t.symbol === selectedIndex && t.status === 'OPEN'
          ? { ...t, exitPrice: currentPrice, pnl, status: 'CLOSED' }
          : t
      ));
      e.exiting = false; e.hwPnl = 0; e.lockFloor = null;
      setBeArmed(false); setLockFloor(null); setIsLocked(false);
      setLastExitPrice(currentPrice);
    };

    if (e.hwPnl >= 10) {
      const floor = Math.max(0, Math.floor(e.hwPnl / 10) * 10 - 10);
      if (floor !== e.lockFloor) { e.lockFloor = floor; setLockFloor(floor); setIsLocked(true); }
      if (pnlPts <= floor) { doAutoExit('10-PT LOCK'); return; }
    }

    if (beArmed && (e.lockFloor === null || e.lockFloor <= 0) && pnlPts <= 0) {
      doAutoExit('BREAK-EVEN');
    }
  }, [currentPrice, currentPos, entryPrice, lastExitPrice, beArmed, selectedIndex, reentryEnabled, openPaperPos]);

  const handleExchangeChange = (key) => {
    setActiveExchange(key);
    setSelectedIndex(EXCHANGE_CONFIGS[key].indices[0] || '');
  };

  const updateBuilder = (field, value) => setBuilder(p => ({ ...p, [field]: value }));
  const toggleBuilderSection = (k) => setBuilderExpanded(p => ({ ...p, [k]: !p[k] }));

  const addLeg = () => {
    setStrategyLegs(p => [...p, { id: Date.now(), ...builder }]);
  };

  const updateLeg = (id, field, value) =>
    setStrategyLegs(p => p.map(l => l.id === id ? { ...l, [field]: value } : l));

  const removeLeg = (id) => setStrategyLegs(p => p.filter(l => l.id !== id));

  return (
    <div className="max-w-5xl mx-auto space-y-0">

      {/* ── Exchange selector ── */}
      <div className="grid grid-cols-4 bg-white border border-slate-200 rounded-t-xl overflow-hidden">
        {Object.entries(EXCHANGE_CONFIGS).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => handleExchangeChange(key)}
            className={`p-3 text-left border-r border-slate-200 last:border-r-0 transition-all ${
              activeExchange === key ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className={`text-xs font-semibold leading-tight ${activeExchange === key ? 'text-blue-600' : 'text-slate-700'}`}>
                {cfg.label}
              </span>
              {cfg.isNew && (
                <span className="bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded leading-none">New</span>
              )}
            </div>
            <div className={`text-[11px] font-medium ${activeExchange === key ? 'text-blue-500' : 'text-slate-500'}`}>
              {cfg.sublabel}
            </div>
            {cfg.algoTrading && (
              <div className={`flex items-center gap-1 mt-0.5 text-[10px] ${activeExchange === key ? 'text-blue-400' : 'text-slate-400'}`}>
                Algo Trading <HelpCircle size={10} />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* ── Index and Timings ── */}
      <div className="bg-white border-x border-b border-slate-200 p-4">
        <div className="text-sm font-bold text-slate-700 mb-3">Index and Timings</div>
        <div className="flex items-end gap-5 flex-wrap">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Index</div>
            <div className="relative">
              <select
                value={selectedIndex}
                onChange={e => setSelectedIndex(e.target.value)}
                className="appearance-none border border-slate-300 rounded px-3 py-1.5 pr-8 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              >
                {exchangeCfg.indices.map(idx => <option key={idx}>{idx}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Strategy Type</div>
            <div className="flex rounded overflow-hidden border border-slate-300">
              {['Intraday', 'Positional'].map(t => (
                <button
                  key={t}
                  onClick={() => setStrategyType(t)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-all ${
                    strategyType === t
                      ? t === 'Intraday' ? 'bg-blue-500 text-white' : 'bg-slate-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Entry Time</div>
            <input
              type="text"
              value={entryTime}
              onChange={e => setEntryTime(e.target.value)}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm font-mono text-slate-700 w-24 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Exit Time</div>
            <input
              type="text"
              value={exitTime}
              onChange={e => setExitTime(e.target.value)}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm font-mono text-slate-700 w-24 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {strategyType === 'Intraday' && (
          <div className="mt-3 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded px-3 py-2 text-xs text-orange-700">
            <Info size={13} className="text-orange-500 flex-shrink-0" />
            Intraday Signals will only be executed after your strategy entry time.
          </div>
        )}
      </div>

      {/* ── Leg Builder ── */}
      <div className="bg-white border-x border-b border-slate-200 p-4">
        <div className="border border-dashed border-blue-300 rounded-lg p-4 bg-blue-50/20">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-bold text-slate-700">Leg Builder</span>
            <HelpCircle size={13} className="text-slate-400 cursor-help" />
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Segment</div>
              <div className="flex rounded overflow-hidden border border-slate-300 w-fit">
                <button
                  onClick={() => updateBuilder('segment', 'FUT')}
                  className={`px-2.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                    builder.segment === 'FUT' ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >Perpetual FUT</button>
                <button
                  onClick={() => updateBuilder('segment', 'Options')}
                  className={`px-2.5 py-1.5 text-xs font-semibold transition-all ${
                    builder.segment === 'Options' ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >Options</button>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Expiry</div>
              <div className="relative">
                <select
                  value={builder.expiry}
                  onChange={e => updateBuilder('expiry', e.target.value)}
                  className="appearance-none border border-slate-300 rounded px-3 py-1.5 pr-7 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
                >
                  {EXPIRY_OPTIONS.map(e => <option key={e}>{e}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Lots</div>
              <input
                type="number"
                min="1"
                value={builder.lots}
                onChange={e => updateBuilder('lots', Math.max(1, Number(e.target.value)))}
                className="border border-slate-300 rounded px-3 py-1.5 text-xs font-mono text-slate-700 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Position</div>
              <div className="flex rounded overflow-hidden border border-slate-300 w-fit">
                {['B', 'S'].map(pos => (
                  <button
                    key={pos}
                    onClick={() => updateBuilder('position', pos)}
                    className={`w-10 py-1.5 text-xs font-black transition-all ${
                      builder.position === pos ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >{pos}</button>
                ))}
              </div>
            </div>
          </div>

          {builder.segment === 'Options' && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Option Type</div>
                <div className="flex rounded overflow-hidden border border-slate-300 w-fit">
                  {['Call', 'Put'].map(t => (
                    <button
                      key={t}
                      onClick={() => updateBuilder('optionType', t)}
                      className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                        builder.optionType === t ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >{t}</button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Strike Criteria <HelpCircle size={10} className="text-slate-400" />
                </div>
                <div className="relative">
                  <select
                    value={builder.strikeCriteria}
                    onChange={e => updateBuilder('strikeCriteria', e.target.value)}
                    className="appearance-none border border-slate-300 rounded px-3 py-1.5 pr-7 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
                  >
                    {STRIKE_CRITERIA.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Strike Type</div>
                <div className="relative">
                  <select
                    value={builder.strikeType}
                    onChange={e => updateBuilder('strikeType', e.target.value)}
                    className="appearance-none border border-slate-300 rounded px-3 py-1.5 pr-7 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
                  >
                    {STRIKE_TYPES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <SectionToggleBtn label="Target Profit" expanded={builderExpanded.targetProfit} onToggle={() => toggleBuilderSection('targetProfit')} />
              <SectionToggleBtn label="Stop Loss"     expanded={builderExpanded.stopLoss}     onToggle={() => toggleBuilderSection('stopLoss')} />
              <SectionToggleBtn label="Trail SL"      expanded={builderExpanded.trailSL}      onToggle={() => toggleBuilderSection('trailSL')} />
              <SectionToggleBtn label="Simple Momentum" expanded={builderExpanded.simpleMomentum} onToggle={() => toggleBuilderSection('simpleMomentum')} />
            </div>
            <button
              onClick={addLeg}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-xs font-bold transition-all shadow-sm"
            >
              Add Leg
            </button>
          </div>

          {builderExpanded.targetProfit && (
            <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg">
              <ExpandableInput label="Target Profit" currency={currency} value={builderTgtProfit} onChange={setBuilderTgtProfit} />
            </div>
          )}
          {builderExpanded.stopLoss && (
            <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg">
              <ExpandableInput label="Stop Loss" currency={currency} value={builderStopLoss} onChange={setBuilderStopLoss} />
            </div>
          )}
          {builderExpanded.trailSL && (
            <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg grid grid-cols-3 gap-3">
              {['Lock at profit', 'Lock SL at', 'Trail by'].map(lbl => (
                <ExpandableInput key={lbl} label={lbl} currency={currency} value={0} onChange={() => {}} />
              ))}
            </div>
          )}
          {builderExpanded.simpleMomentum && (
            <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Entry Condition</div>
                <select className="border border-slate-300 rounded px-2 py-1.5 text-xs bg-white w-full focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option>Bullish</option><option>Bearish</option>
                </select>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Candle Size (%)</div>
                <input type="number" defaultValue="0.5" step="0.1" className="border border-slate-300 rounded px-2 py-1.5 text-xs font-mono w-full focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Strategy Legs ── */}
      {strategyLegs.length > 0 && (
        <div className="bg-white border-x border-b border-slate-200 p-4">
          <div className="text-sm font-bold text-slate-700 mb-3">Strategy Legs</div>
          <div className="space-y-3">
            {strategyLegs.map((leg, idx) => (
              <LegRow
                key={leg.id}
                leg={leg}
                isDelta={isDelta}
                label={`Leg ${idx + 1}`}
                onUpdate={(field, val) => updateLeg(leg.id, field, val)}
                onRemove={() => removeLeg(leg.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Overall Strategy Settings ── */}
      <div className="bg-white border-x border-b border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-bold text-slate-700">Overall Strategy Settings</span>
          <HelpCircle size={13} className="text-slate-400 cursor-help" />
        </div>

        {isDelta && (
          <div className="mb-3 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded px-3 py-2 text-xs text-orange-700">
            <Info size={13} className="text-orange-500 flex-shrink-0 mt-0.5" />
            For Delta Exchange strategies, Overall Strategy settings are calculated in USD ($), i.e. 1 USD = 85 INR.
          </div>
        )}

        <div className="flex items-start gap-4 flex-wrap">
          <div>
            <SectionToggleBtn label="Overall SL" expanded={overallSLOpen} onToggle={() => setOverallSLOpen(v => !v)} />
            {overallSLOpen && (
              <div className="mt-2">
                <ExpandableInput label="" currency={currency} value={overallSL} onChange={setOverallSL} />
              </div>
            )}
          </div>
          <div>
            <SectionToggleBtn label="Overall Target" expanded={overallTargetOpen} onToggle={() => setOverallTargetOpen(v => !v)} />
            {overallTargetOpen && (
              <div className="mt-2">
                <ExpandableInput label="" currency={currency} value={overallTarget} onChange={setOverallTarget} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Lock Profit ── */}
      <div className="bg-white border-x border-b border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-bold text-slate-700">Lock Profit</span>
          <span className="text-slate-400 text-base leading-none cursor-pointer select-none">−</span>
        </div>

        <div className="flex rounded overflow-hidden border border-slate-300 w-fit mb-4">
          {['Lock', 'Lock and Trail'].map(mode => (
            <button
              key={mode}
              onClick={() => setLockMode(mode)}
              className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                lockMode === mode ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >{mode}</button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          {[
            { key: 'ifProfitReaches',    label: 'If profit reaches' },
            { key: 'lockProfit',         label: 'Lock profit' },
            { key: 'forEveryIncreaseOf', label: 'For every increase of' },
            { key: 'trailProfitBy',      label: 'Trail profit by' },
          ].map(({ key, label }) => (
            <ExpandableInput
              key={key}
              label={label}
              currency={currency}
              value={lockVals[key]}
              onChange={v => setLockVals(p => ({ ...p, [key]: v }))}
            />
          ))}
        </div>

        <div className="flex items-start gap-3">
          <button
            onClick={() => setTrailToEntry(v => !v)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-0.5 ${
              trailToEntry ? 'bg-blue-500' : 'bg-slate-300'
            }`}
            role="switch"
            aria-checked={trailToEntry}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200 ease-in-out ${
                trailToEntry ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <div>
            <p className="text-xs font-semibold text-slate-700">Trail stop loss to entry price</p>
            <p className="text-[11px] text-slate-400">Only for legs with 'Stop Loss' enabled</p>
          </div>
        </div>
      </div>

      {/* ── Paper Execute Order ── */}
      <div className="bg-white border-x border-b border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-700">Execute Paper Order</span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" /> SIMULATED
            </span>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Virtual Balance</div>
            <div className="font-mono font-black text-sm text-emerald-600">₹{paperBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-xs font-bold text-slate-600">{selectedIndex}</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="font-mono text-sm font-black text-slate-800">{currency}{currentPrice.toFixed(2)}</span>
          </div>
        </div>

        {openPaperPos && (
          <div className={`mb-3 flex items-center justify-between px-3 py-2 rounded border text-xs font-medium ${openPnl >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
            <span className="text-slate-600">
              {openPaperPos.direction} {openPaperPos.lots}L @ {currency}{openPaperPos.entryPrice.toFixed(2)}
            </span>
            <span className={`font-black ${openPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {openPnl >= 0 ? '+' : ''}{currency}{openPnl.toFixed(2)}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={() => paperExecute('BUY')}
            disabled={!!openPaperPos}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-white py-3 rounded-lg font-black text-sm transition-all"
          >▲ BUY / LONG</button>
          <button
            onClick={() => paperExecute('SELL')}
            disabled={!!openPaperPos}
            className="bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-white py-3 rounded-lg font-black text-sm transition-all"
          >▼ SELL / SHORT</button>
        </div>

        {openPaperPos && (
          <button
            onClick={paperSquareOff}
            className="w-full border-2 border-slate-400 hover:bg-slate-50 py-2 rounded text-xs font-black text-slate-700 transition-all"
          >Square Off — Close Position</button>
        )}
      </div>

      {/* ── Active Rule Monitor ── */}
      <div className="bg-[#0f1923] border-x border-b border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-amber-400 text-sm">⚡</span>
          <span className="text-xs font-black text-white tracking-widest uppercase">Active Rule Monitor</span>
          <span className="ml-auto text-[10px] text-slate-500 italic">PAPER MODE</span>
        </div>
        {ruleLog && (
          <div className="mb-3 px-3 py-2 bg-amber-500/20 border border-amber-500/40 rounded text-[11px] font-mono text-amber-300 animate-pulse">
            {ruleLog}
          </div>
        )}
        <div className="space-y-2">
          {[
            {
              label: 'Break-even Protection',
              status: beArmed ? 'ARMED' : currentPos !== 0 ? 'WATCHING' : 'STANDBY',
              sub: beArmed ? 'Auto-exit at entry price' : 'Arms at +5 pts • Rule 2',
              color: beArmed ? 'bg-amber-500 text-white' : currentPos !== 0 ? 'bg-emerald-700 text-emerald-200' : 'bg-slate-700 text-slate-400',
            },
            {
              label: '10-pt Profit Lock',
              status: isLocked ? `LOCKED +${lockFloor}pt` : currentPos !== 0 ? 'MONITORING' : 'STANDBY',
              sub: lockFloor !== null ? `Floor: +${lockFloor} pts — exit if hit` : 'Ladder +10/+20/+30… • Rule 4',
              color: isLocked ? 'bg-indigo-500 text-white' : currentPos !== 0 ? 'bg-emerald-700 text-emerald-200' : 'bg-slate-700 text-slate-400',
            },
            {
              label: 'Trend Continuation',
              status: currentPos !== 0 ? 'FOLLOWING' : 'IDLE',
              sub: currentPos !== 0 ? `Pos: ${currentPos > 0 ? 'LONG' : 'SHORT'} ${Math.abs(currentPos)} lots` : 'Rule 1',
              color: currentPos !== 0 ? 'bg-emerald-700 text-emerald-200' : 'bg-slate-700 text-slate-400',
            },
        ].map(({ label, status, sub, color }) => (
            <div key={label} className="flex items-center justify-between bg-[#1a2535] rounded-lg px-3 py-2.5">
              <div>
                <div className="text-xs font-bold text-white">{label}</div>
                <div className="text-[11px] text-slate-400">{sub}</div>
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded whitespace-nowrap ${color}`}>
                {status}
              </span>
            </div>
          ))}

          {/* Re-entry Detection — separate row with toggle */}
          <div className="flex items-center justify-between bg-[#1a2535] rounded-lg px-3 py-2.5">
            <div>
              <div className="text-xs font-bold text-white">Re-entry Detection</div>
              <div className="text-[11px] text-slate-400">
                {reentrySignal
                  ? reentryEnabled ? 'Auto-buying now…' : 'Signal fired — toggle ON to auto-buy'
                  : lastExitPrice
                    ? `Watching exit @ ${currency}${lastExitPrice.toFixed(2)} ±5pts`
                    : 'Rule 3/5'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black px-2 py-1 rounded whitespace-nowrap ${
                reentrySignal
                  ? reentryEnabled ? 'bg-emerald-500 text-white animate-pulse' : 'bg-amber-500 text-white animate-pulse'
                  : lastExitPrice ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {reentrySignal ? (reentryEnabled ? 'AUTO-BUYING' : '⚡ SIGNAL') : lastExitPrice ? `WATCHING ${currency}${lastExitPrice.toFixed(0)}` : 'OFF'}
              </span>
              <button
                onClick={() => setReentryEnabled(v => !v)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                  reentryEnabled ? 'bg-emerald-500' : 'bg-slate-600'
                }`}
                title={reentryEnabled ? 'Re-entry ON — click to disable' : 'Re-entry OFF — click to enable'}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200 ${
                  reentryEnabled ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Paper Trade History ── */}
      <div className="bg-white border-x border-b border-slate-200 rounded-b-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-slate-700">Paper Trade History</span>
          <span className={`text-xs font-black ${closedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            Session P&amp;L: {closedPnl >= 0 ? '+' : ''}{currency}{closedPnl.toFixed(2)}
          </span>
        </div>
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {paperHistory.length === 0 ? (
            <p className="text-center text-xs text-slate-300 py-6 italic">No paper trades yet — hit BUY or SELL above</p>
          ) : paperHistory.slice(0, 15).map(t => (
            <div key={t.id} className="flex items-center justify-between text-xs border border-slate-100 rounded-lg p-2.5 bg-slate-50">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded font-black text-[10px] ${t.direction === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {t.direction}
                </span>
                <span className="font-semibold text-slate-700">{t.symbol}</span>
                <span className="text-slate-400 font-mono">{t.lots}L @ {currency}{t.entryPrice.toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-2">
                {t.status === 'OPEN' ? (
                  <span className="text-blue-500 font-black text-[10px] animate-pulse">OPEN</span>
                ) : (
                  <span className={`font-black ${(t.pnl || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {(t.pnl || 0) >= 0 ? '+' : ''}{currency}{(t.pnl || 0).toFixed(2)}
                  </span>
                )}
                <span className="text-slate-300 text-[10px]">{t.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PaperTrading;
