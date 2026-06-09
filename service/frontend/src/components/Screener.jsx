import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Volume2, Activity, Zap, ArrowUpRight, RefreshCw } from 'lucide-react';

const SCAN_TABS = [
  { id: 'gainers',    label: 'Top Gainers',      icon: TrendingUp,   color: 'text-emerald-600' },
  { id: 'losers',     label: 'Top Losers',        icon: TrendingDown, color: 'text-rose-600'    },
  { id: 'volume',     label: 'Volume Shockers',   icon: Volume2,      color: 'text-blue-600'    },
  { id: 'rsi-ob',     label: 'RSI Overbought',    icon: Activity,     color: 'text-amber-600'   },
  { id: 'rsi-os',     label: 'RSI Oversold',      icon: Activity,     color: 'text-indigo-600'  },
  { id: 'breakouts',  label: 'Near 52W High',     icon: Zap,          color: 'text-violet-600'  },
  { id: 'gaps',       label: 'Gap Up/Down',       icon: ArrowUpRight, color: 'text-orange-600'  },
];

const ENDPOINT_MAP = {
  'gainers':   '/api/screener/gainers',
  'losers':    '/api/screener/losers',
  'volume':    '/api/screener/volume-shockers',
  'rsi-ob':    '/api/screener/rsi?min=70&max=100&n=20',
  'rsi-os':    '/api/screener/rsi?min=0&max=30&n=20',
  'breakouts': '/api/screener/breakouts',
  'gaps':      '/api/screener/gaps',
};

function pctColor(v) {
  if (v > 0) return 'text-emerald-600';
  if (v < 0) return 'text-rose-600';
  return 'text-slate-500';
}

function pctBg(v) {
  if (v > 0) return 'bg-emerald-50 text-emerald-700';
  if (v < 0) return 'bg-rose-50 text-rose-700';
  return 'bg-slate-50 text-slate-500';
}

export default function Screener() {
  const [activeTab, setActiveTab] = useState('gainers');
  const [data, setData]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const load = useCallback(async (tab) => {
    setLoading(true);
    try {
      const res = await fetch(ENDPOINT_MAP[tab]);
      if (res.ok) {
        setData(await res.json());
        setLastUpdate(new Date());
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(activeTab); }, [activeTab, load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => load(activeTab), 30000);
    return () => clearInterval(t);
  }, [activeTab, load]);

  const tabMeta = SCAN_TABS.find(t => t.id === activeTab) || SCAN_TABS[0];
  const Icon = tabMeta.icon;

  const renderTable = () => {
    if (loading && !data.length) {
      return <div className="py-16 text-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>;
    }
    if (!data.length) {
      return <div className="py-16 text-center text-slate-300 font-bold text-sm">No results</div>;
    }

    const isVolume    = activeTab === 'volume';
    const isRsi       = activeTab === 'rsi-ob' || activeTab === 'rsi-os';
    const isBreakout  = activeTab === 'breakouts';

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <tr>
              <th className="px-5 py-3 text-left">#</th>
              <th className="px-5 py-3 text-left">Symbol</th>
              <th className="px-5 py-3 text-left">Sector</th>
              <th className="px-5 py-3 text-right">Price</th>
              <th className="px-5 py-3 text-right">Chg%</th>
              {isVolume   && <th className="px-5 py-3 text-right">Vol Ratio</th>}
              {isRsi      && <th className="px-5 py-3 text-right">RSI (14)</th>}
              {isBreakout && <th className="px-5 py-3 text-right">52W High</th>}
              {isBreakout && <th className="px-5 py-3 text-right">Near High %</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.map((row, i) => (
              <tr key={row.symbol} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3.5 text-xs font-mono text-slate-300">{i + 1}</td>
                <td className="px-5 py-3.5">
                  <span className="font-black text-slate-800">{row.symbol}</span>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-400">{row.sector}</td>
                <td className="px-5 py-3.5 text-right font-mono font-bold">
                  ₹{row.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${pctBg(row.changePct)}`}>
                    {row.changePct >= 0 ? '+' : ''}{row.changePct.toFixed(2)}%
                  </span>
                </td>
                {isVolume && (
                  <td className="px-5 py-3.5 text-right font-mono text-blue-600 font-bold">
                    {row.volumeRatio.toFixed(2)}×
                  </td>
                )}
                {isRsi && (
                  <td className="px-5 py-3.5 text-right">
                    <span className={`font-mono font-bold text-sm ${row.rsi >= 70 ? 'text-amber-600' : 'text-indigo-600'}`}>
                      {row.rsi}
                    </span>
                  </td>
                )}
                {isBreakout && (
                  <>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-500">
                      ₹{row.weekHigh52?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5">
                          <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, row.nearHighPct)}%` }} />
                        </div>
                        <span className="font-mono text-xs font-bold text-violet-600">{row.nearHighPct}%</span>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Tab bar */}
      <div className="bg-white rounded-[2rem] border border-slate-200 p-2 flex flex-wrap gap-1">
        {SCAN_TABS.map(tab => {
          const TabIcon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <TabIcon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Data table */}
      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={16} className={tabMeta.color} />
            <span className="font-black text-slate-800 text-sm">{tabMeta.label}</span>
            {loading && <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-[10px] text-slate-300 font-mono">
                {lastUpdate.toLocaleTimeString('en-IN')}
              </span>
            )}
            <button onClick={() => load(activeTab)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <RefreshCw size={12} className="text-slate-400" />
            </button>
          </div>
        </div>
        {renderTable()}
      </div>
    </div>
  );
}
