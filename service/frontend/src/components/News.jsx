import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, Globe, AlertCircle, RefreshCw } from 'lucide-react';

const TABS = [
  { id: 'news',              label: 'Market News'        },
  { id: 'earnings',          label: 'Earnings Calendar'  },
  { id: 'economic',          label: 'Economic Calendar'  },
  { id: 'corporate-actions', label: 'Corporate Actions'  },
];

const SENTIMENT_STYLE = {
  positive: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: TrendingUp  },
  negative: { bg: 'bg-rose-100',    text: 'text-rose-700',    icon: TrendingDown },
  neutral:  { bg: 'bg-slate-100',   text: 'text-slate-500',   icon: Minus       },
};

const IMPORTANCE_STYLE = {
  High:   { bg: 'bg-red-100',    text: 'text-red-700'    },
  Medium: { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  Low:    { bg: 'bg-slate-100',  text: 'text-slate-500'  },
};

const ACTION_STYLE = {
  'Bonus Issue':   { bg: 'bg-indigo-100', text: 'text-indigo-700'  },
  'Dividend':      { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'Stock Split':   { bg: 'bg-blue-100',   text: 'text-blue-700'    },
  'Rights Issue':  { bg: 'bg-amber-100',  text: 'text-amber-700'   },
};

function NewsItem({ item }) {
  const s = SENTIMENT_STYLE[item.sentiment] || SENTIMENT_STYLE.neutral;
  const Icon = s.icon;
  return (
    <div className="flex gap-4 py-4 border-b border-slate-100 last:border-0">
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${s.bg}`}>
        <Icon size={14} className={s.text} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{item.symbol}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-400">{item.category}</span>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{item.sentiment}</span>
        </div>
        <p className="font-semibold text-sm text-slate-800 leading-snug">{item.headline}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
          <span className="font-bold">{item.source}</span>
          <span>·</span>
          <span>{item.time}</span>
        </div>
      </div>
    </div>
  );
}

function EarningsRow({ item }) {
  const d = new Date(item.date);
  const isPast = d < new Date();
  return (
    <tr className="hover:bg-slate-50 border-b border-slate-100">
      <td className="px-4 py-3 text-xs text-slate-500 font-medium">
        {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
      </td>
      <td className="px-4 py-3 font-black text-slate-800 text-sm">{item.symbol}</td>
      <td className="px-4 py-3 text-sm text-slate-700">{item.event}</td>
      <td className="px-4 py-3 text-xs text-indigo-600 font-semibold">{item.estimate}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{item.time}</td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isPast ? 'bg-slate-100 text-slate-400' : 'bg-indigo-100 text-indigo-700'}`}>
          {isPast ? 'PAST' : 'UPCOMING'}
        </span>
      </td>
    </tr>
  );
}

function EconomicRow({ item }) {
  const imp = IMPORTANCE_STYLE[item.importance] || IMPORTANCE_STYLE.Low;
  return (
    <tr className="hover:bg-slate-50 border-b border-slate-100">
      <td className="px-4 py-3 text-xs text-slate-500 font-medium">
        {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
      </td>
      <td className="px-4 py-3 font-semibold text-slate-800 text-sm">{item.event}</td>
      <td className="px-4 py-3 text-xs text-emerald-600 font-bold">{item.forecast}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{item.previous}</td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${imp.bg} ${imp.text}`}>
          {item.importance}
        </span>
      </td>
    </tr>
  );
}

function CorporateRow({ item }) {
  const style = ACTION_STYLE[item.action] || { bg: 'bg-slate-100', text: 'text-slate-600' };
  return (
    <tr className="hover:bg-slate-50 border-b border-slate-100">
      <td className="px-4 py-3 text-xs text-slate-500 font-medium">
        {new Date(item.exDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
      </td>
      <td className="px-4 py-3 font-black text-slate-800">{item.symbol}</td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
          {item.action}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">{item.details}</td>
    </tr>
  );
}

export default function News() {
  const [activeTab, setActiveTab]  = useState('news');
  const [data, setData]            = useState({ news: [], earnings: [], economic: [], 'corporate-actions': [] });
  const [loading, setLoading]      = useState(false);
  const [error, setError]          = useState(null);
  const [searchSymbol, setSearchSymbol] = useState('');

  const load = useCallback(async (tab) => {
    setLoading(true);
    setError(null);
    try {
      const path = tab === 'news' ? `/api/news${searchSymbol ? `?symbol=${searchSymbol}` : ''}`
        : tab === 'earnings' ? '/api/news/earnings'
        : tab === 'economic' ? '/api/news/economic'
        : '/api/news/corporate-actions';
      const res = await fetch(path);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(prev => ({ ...prev, [tab]: json }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [searchSymbol]);

  useEffect(() => { load(activeTab); }, [activeTab, load]);

  const items = data[activeTab] || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">News & Calendar</h2>
          <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-widest">Market news · Earnings · Economic events · Corporate actions</p>
        </div>
        <button onClick={() => load(activeTab)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-white rounded-2xl border border-slate-200 p-1.5 flex gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === t.id ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {activeTab === 'news' && (
          <input
            value={searchSymbol}
            onChange={e => setSearchSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && load('news')}
            placeholder="Filter by symbol…"
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44"
          />
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Globe size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No data available.</p>
          </div>
        ) : activeTab === 'news' ? (
          <div className="px-6 py-2">
            {items.map(item => <NewsItem key={item.id} item={item} />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900 text-white text-xs">
                  {activeTab === 'earnings' && ['Date', 'Symbol', 'Event', 'Estimate', 'Time', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                  ))}
                  {activeTab === 'economic' && ['Date', 'Event', 'Forecast', 'Previous', 'Impact'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                  ))}
                  {activeTab === 'corporate-actions' && ['Ex-Date', 'Symbol', 'Action', 'Details'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeTab === 'earnings' && items.map((item, i) => <EarningsRow key={i} item={item} />)}
                {activeTab === 'economic' && items.map((item, i) => <EconomicRow key={i} item={item} />)}
                {activeTab === 'corporate-actions' && items.map((item, i) => <CorporateRow key={i} item={item} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
