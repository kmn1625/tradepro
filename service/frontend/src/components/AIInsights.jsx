import { useState } from 'react';
import { TrendingUp, Zap, Brain, BookOpen, Search, Loader2, AlertCircle } from 'lucide-react';

function InsightCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] p-6">
      <div className="flex items-center gap-2 mb-4 text-indigo-600 font-black text-xs uppercase tracking-widest">
        <Icon size={16} /> {title}
      </div>
      {children}
    </div>
  );
}

function ResultBlock({ text, loading, placeholder }) {
  if (loading) return (
    <div className="flex items-center gap-3 text-slate-400 text-sm py-4">
      <Loader2 size={16} className="animate-spin" /> Synthesizing…
    </div>
  );
  if (!text) return <p className="text-sm text-slate-300 italic">{placeholder}</p>;
  return <p className="text-slate-700 leading-relaxed text-sm whitespace-pre-wrap">{text}</p>;
}

// ─── Market Sentiment (Gemini) ────────────────────────────────────────────────

function MarketSentiment() {
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const analyze = async () => {
    if (!apiKey) { setInsight('Set VITE_GEMINI_API_KEY in .env.local to enable AI insights.'); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Briefly analyze Nifty 50 and Gold MCX sentiment for today. Re-entry or trend continuation? Max 150 words.' }] }],
          }),
        }
      );
      const data = await res.json();
      setInsight(data.candidates?.[0]?.content?.parts?.[0]?.text || 'No data available.');
    } catch {
      setInsight('Failed to fetch insights. Check API key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0f172a] rounded-[2.5rem] p-10 text-center text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
        <TrendingUp size={400} className="absolute -bottom-20 -left-20" />
      </div>
      <h2 className="text-3xl font-black mb-3 relative z-10">Neo Intelligence</h2>
      <p className="text-slate-400 mb-7 max-w-lg mx-auto text-sm relative z-10">
        AI sentiment analysis for Nifty and MCX markets to validate re-entry rules.
      </p>
      <button onClick={analyze} disabled={loading}
        className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-2xl font-black shadow-2xl shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 relative z-10 flex items-center gap-2 mx-auto text-sm">
        {loading ? <><Loader2 size={16} className="animate-spin" /> Synthesizing…</> : 'Generate Market Insights'}
      </button>
      {insight && (
        <div className="mt-6 bg-white/5 rounded-2xl p-6 text-left relative z-10">
          <div className="flex items-center gap-2 mb-3 text-indigo-400 font-black text-xs uppercase tracking-widest">
            <Zap size={14} /> Market Sentiment
          </div>
          <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{insight}</p>
        </div>
      )}
    </div>
  );
}

// ─── Stock Summary ────────────────────────────────────────────────────────────

function StockSummary() {
  const [symbol, setSymbol]   = useState('');
  const [result, setResult]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const fetch_ = async () => {
    if (!symbol.trim()) return;
    setLoading(true); setError(''); setResult('');
    try {
      const res = await fetch('/api/ai/stock-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.trim().toUpperCase() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult(json.summary);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <InsightCard title="AI Stock Summary" icon={Search}>
      <div className="flex gap-3 mb-4">
        <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && fetch_()}
          placeholder="NIFTY 50, TCS, RELIANCE…"
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <button onClick={fetch_} disabled={loading || !symbol.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50">
          Analyze
        </button>
      </div>
      {error && <p className="text-rose-500 text-xs mb-3 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
      <ResultBlock text={result} loading={loading} placeholder="Enter a symbol above to get an AI-generated brief analysis." />
    </InsightCard>
  );
}

// ─── Portfolio Analysis ───────────────────────────────────────────────────────

function PortfolioAI({ orders, positions }) {
  const [result, setResult]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const fetch_ = async () => {
    setLoading(true); setError(''); setResult('');
    try {
      const res = await fetch('/api/ai/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions, orders }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult(json.analysis);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <InsightCard title="AI Portfolio Analysis" icon={Brain}>
      <p className="text-xs text-slate-400 mb-4">
        {Object.keys(positions).length
          ? `Analyzing ${Object.keys(positions).length} open position(s)`
          : 'No open positions — demo analysis will be generated.'}
      </p>
      <button onClick={fetch_} disabled={loading}
        className="mb-4 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin" />Analyzing…</> : 'Analyse My Portfolio'}
      </button>
      {error && <p className="text-rose-500 text-xs mb-3 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
      <ResultBlock text={result} loading={loading} placeholder="Click Analyse to get diversification score, risk warnings, and rebalancing suggestions." />
    </InsightCard>
  );
}

// ─── Trade Journal ────────────────────────────────────────────────────────────

function TradeJournal({ orders }) {
  const [result, setResult]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const fetch_ = async () => {
    setLoading(true); setError(''); setResult('');
    try {
      const res = await fetch('/api/ai/trade-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult(json.journal);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <InsightCard title="AI Trade Journal" icon={BookOpen}>
      <p className="text-xs text-slate-400 mb-4">
        {orders.length
          ? `${orders.length} trade(s) in history — AI will identify patterns and mistakes.`
          : 'No trade history yet — place some trades first.'}
      </p>
      <button onClick={fetch_} disabled={loading}
        className="mb-4 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin" />Reviewing…</> : 'Review My Trades'}
      </button>
      {error && <p className="text-rose-500 text-xs mb-3 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
      <ResultBlock text={result} loading={loading} placeholder="AI will identify behavioral mistakes, positive patterns, and give actionable coaching tips." />
    </InsightCard>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIInsights({ orders = [], positions = {} }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <MarketSentiment />
      <StockSummary />
      <div className="grid md:grid-cols-2 gap-4">
        <PortfolioAI orders={orders} positions={positions} />
        <TradeJournal orders={orders} />
      </div>
    </div>
  );
}
