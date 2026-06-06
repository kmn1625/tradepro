import { useState, useEffect } from 'react';
import { Sparkles, Plus, Trash2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Condition builder — visual form + AI natural language parser.
// Builds entry/exit condition JSON used by algo engine + backtest.
// AI parse: POST /api/ai/condition (requires ANTHROPIC_API_KEY in backend .env)
const ConditionBuilder = ({ onChange }) => {
  const [indicators, setIndicators] = useState([]);
  const [operators, setOperators]   = useState([]);
  const [entryLegs, setEntryLegs]   = useState([{ indicator: 'RSI', period: 14, operator: 'crossesBelow', value: 30 }]);
  const [exitLegs,  setExitLegs]    = useState([{ type: 'time', time: '15:15' }]);
  const [nlText, setNlText]         = useState('');
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/ai/indicators`)
      .then(r => r.json())
      .then(d => { setIndicators(d.indicators || []); setOperators(d.operators || []); })
      .catch(() => {});
  }, []);

  const condition = {
    entry: entryLegs.length === 1 ? entryLegs[0] : { AND: entryLegs },
    exit:  exitLegs.length  === 1 ? exitLegs[0]  : { OR:  exitLegs  },
  };

  useEffect(() => { onChange?.(condition); }, [entryLegs, exitLegs]);

  const addEntry = () => setEntryLegs(p => [...p, { indicator: 'EMA', fast: 9, slow: 21, operator: 'crossesAbove' }]);
  const addExit  = () => setExitLegs( p => [...p, { type: 'sl', pct: 1.5 }]);

  const parseWithAI = async () => {
    if (!nlText.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/condition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nlText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI parse failed');
      const c = data.condition;
      if (c?.entry) setEntryLegs(c.entry.AND || c.entry.OR || [c.entry]);
      if (c?.exit)  setExitLegs( c.exit.AND  || c.exit.OR  || [c.exit]);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI NL input */}
      <div className="bg-[#0f172a] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-yellow-400" />
          <span className="font-bold text-sm uppercase tracking-widest text-slate-400">AI Strategy Parser</span>
        </div>
        <textarea
          value={nlText}
          onChange={e => setNlText(e.target.value)}
          placeholder="Describe your strategy… e.g. 'Buy when RSI crosses below 30 and EMA 9 above EMA 21. Exit at 15:15 or 1.5% SL.'"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          rows={3}
        />
        {aiError && <p className="text-rose-400 text-xs mt-2">{aiError}</p>}
        <button
          onClick={parseWithAI}
          disabled={aiLoading || !nlText.trim()}
          className="mt-3 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
        >
          <Sparkles size={14} /> {aiLoading ? 'Parsing…' : 'Parse with AI'}
        </button>
      </div>

      {/* Entry conditions */}
      <ConditionSection
        title="Entry Conditions" logic="AND" legs={entryLegs}
        indicators={indicators} operators={operators}
        onAdd={addEntry} onRemove={id => setEntryLegs(p => p.filter((_, i) => i !== id))}
        onUpdate={(id, leg) => setEntryLegs(p => p.map((l, i) => i === id ? leg : l))}
      />

      {/* Exit conditions */}
      <ConditionSection
        title="Exit Conditions" logic="OR" legs={exitLegs}
        indicators={indicators} operators={operators}
        onAdd={addExit} onRemove={id => setExitLegs(p => p.filter((_, i) => i !== id))}
        onUpdate={(id, leg) => setExitLegs(p => p.map((l, i) => i === id ? leg : l))}
      />

      {/* JSON preview */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Condition JSON</span>
        <pre className="text-xs font-mono text-slate-600 overflow-x-auto">{JSON.stringify(condition, null, 2)}</pre>
      </div>
    </div>
  );
};

const ConditionSection = ({ title, logic, legs, indicators, operators, onAdd, onRemove, onUpdate }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="font-black text-slate-800">{title}</span>
        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{logic}</span>
      </div>
      <button onClick={onAdd} className="flex items-center gap-1 text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-xl text-xs font-bold transition-all">
        <Plus size={12} /> Add
      </button>
    </div>
    <div className="divide-y divide-slate-50">
      {legs.map((leg, i) => (
        <div key={i} className="p-4 flex items-center gap-3 flex-wrap text-xs">
          {leg.indicator ? (
            <>
              <select value={leg.indicator} onChange={e => onUpdate(i, { ...leg, indicator: e.target.value })}
                className="border border-slate-200 rounded-lg px-2 py-1.5 font-bold">
                {(indicators.length ? indicators : ['RSI','MACD','EMA','SMA']).map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
              {leg.indicator === 'EMA' || leg.indicator === 'SMA' ? (
                <>
                  <input type="number" value={leg.fast || 9} placeholder="Fast"
                    onChange={e => onUpdate(i, { ...leg, fast: Number(e.target.value) })}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 font-mono w-14" />
                  <input type="number" value={leg.slow || 21} placeholder="Slow"
                    onChange={e => onUpdate(i, { ...leg, slow: Number(e.target.value) })}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 font-mono w-14" />
                </>
              ) : (
                <input type="number" value={leg.period || 14} placeholder="Period"
                  onChange={e => onUpdate(i, { ...leg, period: Number(e.target.value) })}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 font-mono w-16" />
              )}
              <select value={leg.operator} onChange={e => onUpdate(i, { ...leg, operator: e.target.value })}
                className="border border-slate-200 rounded-lg px-2 py-1.5">
                {(operators.length ? operators : ['crossesAbove','crossesBelow','greaterThan','lessThan']).map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
              {!['crossesAbove','crossesBelow'].includes(leg.operator) && (
                <input type="number" value={leg.value || 30} onChange={e => onUpdate(i, { ...leg, value: Number(e.target.value) })}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 font-mono w-16" />
              )}
            </>
          ) : leg.type === 'time' ? (
            <>
              <span className="font-bold text-slate-600">Time Exit</span>
              <input type="time" value={leg.time || '15:15'} onChange={e => onUpdate(i, { ...leg, time: e.target.value })}
                className="border border-slate-200 rounded-lg px-2 py-1.5 font-mono" />
            </>
          ) : leg.type === 'sl' ? (
            <>
              <span className="font-bold text-rose-600">Stop Loss</span>
              <input type="number" value={leg.pct || 1.5} step="0.5" onChange={e => onUpdate(i, { ...leg, pct: Number(e.target.value) })}
                className="border border-slate-200 rounded-lg px-2 py-1.5 font-mono w-16" />
              <span className="text-slate-400">%</span>
            </>
          ) : leg.type === 'target' ? (
            <>
              <span className="font-bold text-emerald-600">Target</span>
              <input type="number" value={leg.pct || 2} step="0.5" onChange={e => onUpdate(i, { ...leg, pct: Number(e.target.value) })}
                className="border border-slate-200 rounded-lg px-2 py-1.5 font-mono w-16" />
              <span className="text-slate-400">%</span>
            </>
          ) : <span className="text-slate-400 italic">Unknown condition type</span>}
          <button onClick={() => onRemove(i)} className="ml-auto text-slate-300 hover:text-rose-500 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  </div>
);

export default ConditionBuilder;
