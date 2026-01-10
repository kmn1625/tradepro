import React, { useState, useEffect, useRef, useMemo } from 'react';
import LivePrice from "./components/LivePrice";
import { 
  TrendingUp, 
  LayoutDashboard, 
  Briefcase, 
  History, 
  Settings, 
  Search, 
  ChevronUp, 
  ChevronDown, 
  Plus, 
  Minus, 
  ArrowUpRight, 
  ArrowDownRight,
  Wallet, 
  Zap, 
  Info, 
  Loader2, 
  PieChart, 
  RefreshCw, 
  Lock, 
  Unlock 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, limit, doc, setDoc } from 'firebase/firestore';

// --- INITIALIZATION ---
const apiKey = ""; 
const appId = typeof __app_id !== 'undefined' ? __app_id : 'neotrade-neo-rules';
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "demo", authDomain: "demo", projectId: "demo", storageBucket: "demo", messagingSenderId: "demo", appId: "demo" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- MOCK DATA ---
const INITIAL_WATCHLIST = [
  { symbol: 'NIFTY 50 (Index)', price: 22453.20, type: 'INDEX' },
  { symbol: 'BANK NIFTY (Index)', price: 47285.10, type: 'INDEX' },
  { symbol: 'GOLD (MCX)', price: 62450.00, type: 'MCX' },
  { symbol: 'CRUDEOIL (MCX)', price: 6450.00, type: 'MCX' },
];

const App = () => {
  const [activeTab, setActiveTab] = useState('terminal');
  const [user, setUser] = useState(null);
  const [marketData, setMarketData] = useState(INITIAL_WATCHLIST.map(s => ({ ...s, change: 0, pct: 0, trend: 'up' })));
  const [balance, setBalance] = useState(500000); 
  const [orders, setOrders] = useState([]);
  const [positions, setPositions] = useState({});

  // Auth Setup
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth error", err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Sync Orders
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'orders');
    return onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.time - a.time);
      setOrders(fetchedOrders);
      
      // Calculate Positions
      const pos = {};
      fetchedOrders.forEach(o => {
        if (!pos[o.symbol]) pos[o.symbol] = 0;
        pos[o.symbol] += (o.type === 'BUY' || o.type === 'CALL' ? 1 : -1);
      });
      setPositions(pos);
    });
  }, [user]);

  // Live Market Feed
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketData(current => current.map(stock => {
        const move = (Math.random() - 0.5) * (stock.type === 'INDEX' ? 10 : 2);
        const newPrice = stock.price + move;
        return {
          ...stock,
          price: newPrice,
          change: (stock.change || 0) + move,
          pct: (((stock.change || 0) + move) / stock.price) * 100,
          trend: move > 0 ? 'up' : 'down'
        };
      }));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const placeOrder = async (symbol, type, price, qty = 1, isFlip = false) => {
    if (!user) return;
    
    if (isFlip) {
      const currentQty = positions[symbol] || 0;
      if (currentQty !== 0) {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), {
          symbol, type: currentQty > 0 ? 'SELL' : 'BUY', price: price.toFixed(2), time: Date.now(), status: 'SQUARED_OFF', qty: Math.abs(currentQty)
        });
      }
    }

    const newOrder = {
      symbol,
      type, 
      price: price.toFixed(2),
      time: Date.now(),
      status: 'EXECUTED',
      qty
    };
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), newOrder);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-slate-900 font-sans">
      <nav className="w-20 md:w-72 bg-[#0f172a] text-white flex flex-col py-6 border-r border-slate-800">
        <div className="flex items-center gap-3 px-6 mb-10">
          <div className="bg-indigo-500 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <TrendingUp size={24} className="text-white" />
          </div>
          <div className="hidden md:block">
            <h1 className="font-black text-xl leading-none">NeoTrade</h1>
            <span className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">Rules Engine v2</span>
          </div>
        </div>

        <div className="flex-1 space-y-2 px-3">
          {[
            { id: 'terminal', icon: LayoutDashboard, label: 'Execution Terminal' },
            { id: 'portfolio', icon: Briefcase, label: 'Rule Positions' },
            { id: 'orders', icon: History, label: 'Order History' },
            { id: 'analytics', icon: PieChart, label: 'Market Sentiment' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${
                activeTab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <item.icon size={20} />
              <span className="hidden md:block font-semibold">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mx-4 mb-4 p-4 bg-slate-900 rounded-2xl border border-slate-800 hidden md:block">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Margin Available</span>
            <Wallet size={14} className="text-indigo-400" />
          </div>
          <p className="text-xl font-black text-white">₹{balance.toLocaleString('en-IN')}</p>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between">
          <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide">
             {marketData.map(s => (
               <div key={s.symbol} className="flex flex-col">
                 <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">{s.symbol}</span>
                 <div className="flex items-center gap-2">
                   <span className="font-mono font-bold text-sm">₹{s.price.toFixed(2)}</span>
                   <span className={`text-[10px] font-bold ${s.pct > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                     {s.pct > 0 ? '▲' : '▼'} {Math.abs(s.pct).toFixed(2)}%
                   </span>
                 </div>
               </div>
             ))}
          </div>
          <div className="flex items-center gap-4 ml-4">
             <div className="h-8 w-[1px] bg-slate-200" />
             <div className="text-right">
               <span className="block text-[10px] font-bold text-slate-400 uppercase">Status</span>
               <div className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/> LIVE FEED
               </div>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8fafc]">
          {activeTab === 'terminal' && <Terminal marketData={marketData} onOrder={placeOrder} positions={positions} />}
          {activeTab === 'portfolio' && <Portfolio orders={orders} balance={balance} marketData={marketData} />}
          {activeTab === 'orders' && <OrderHistory orders={orders} />}
          {activeTab === 'analytics' && <MarketInsights />}
        </div>
      </main>
    </div>
  );
};

const Terminal = ({ marketData, onOrder, positions }) => {
  const [selected, setSelected] = useState(marketData[0]);
  const [isLocked, setIsLocked] = useState(false); 
  const [lastExitPrice, setLastExitPrice] = useState(null); 
  
  const currentPos = positions[selected.symbol] || 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 max-w-[1700px] mx-auto">
      <div className="xl:col-span-4 space-y-6">
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-black text-slate-800">Watchlist</h2>
            <Settings size={18} className="text-slate-400" />
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {marketData.map(stock => (
              <div 
                key={stock.symbol}
                onClick={() => setSelected(stock)}
                className={`p-5 border-b border-slate-50 cursor-pointer transition-all flex items-center justify-between ${selected.symbol === stock.symbol ? 'bg-indigo-50/50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50'}`}
              >
                <div>
                  <p className="font-bold text-slate-900">{stock.symbol}</p>
                  <p className="text-[10px] font-black text-slate-400">{stock.type}</p>
                </div>
                <div className="text-right font-mono">
                  <p className={`font-bold ${stock.pct > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{stock.price.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-400">{stock.pct.toFixed(2)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-[2rem] p-6 text-white">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <Zap size={14} className="text-yellow-400" /> Active Rule Monitor
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Break-even Protection', status: 'ACTIVE', rule: 'Rule 2' },
              { label: '10-pt Profit Lock', status: isLocked ? 'LOCKED' : 'MONITORING', rule: 'Rule 4' },
              { label: 'Trend Continuation', status: currentPos !== 0 ? 'FOLLOWING' : 'IDLE', rule: 'Rule 1' },
              { label: 'Re-entry Detection', status: lastExitPrice ? 'WATCHING' : 'OFF', rule: 'Rule 3/5' }
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                <div>
                  <p className="text-xs font-bold text-white">{r.label}</p>
                  <p className="text-[10px] text-slate-500">{r.rule}</p>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${r.status === 'LOCKED' || r.status === 'ACTIVE' ? 'bg-indigo-500' : 'bg-slate-700 text-slate-400'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="xl:col-span-8 space-y-6">
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-4xl font-black text-slate-900">{selected.symbol}</h2>
                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded">WEEKLY EXPIRY</span>
              </div>
              <div className="text-slate-500 font-medium">LTP: <span className="font-mono text-indigo-600 font-bold">₹{selected.price.toFixed(2)}</span></div>
            </div>
            
            <div className="flex gap-3">
               <button 
                 onClick={() => onOrder(selected.symbol, 'FLIP', selected.price, 1, true)}
                 className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-black transition-all active:scale-95"
               >
                 <RefreshCw size={18} /> FLIP DIRECTION
               </button>
               <button 
                onClick={() => setIsLocked(!isLocked)}
                className={`p-3 rounded-2xl border transition-all ${isLocked ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
               >
                 {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
               </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <button 
              onClick={() => onOrder(selected.symbol, 'CALL', selected.price)}
              className="group relative bg-emerald-500 hover:bg-emerald-600 p-6 rounded-[1.5rem] text-white transition-all shadow-xl shadow-emerald-500/10 overflow-hidden"
            >
               <div className="relative z-10 flex flex-col items-center gap-2">
                 <ArrowUpRight size={32} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                 <span className="font-black text-xl">BUY CALL</span>
                 <span className="text-[10px] font-bold opacity-70">TREND UPWARD</span>
               </div>
               <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={80} /></div>
            </button>
            <button 
              onClick={() => onOrder(selected.symbol, 'PUT', selected.price)}
              className="group relative bg-rose-500 hover:bg-rose-600 p-6 rounded-[1.5rem] text-white transition-all shadow-xl shadow-rose-500/10 overflow-hidden"
            >
               <div className="relative z-10 flex flex-col items-center gap-2">
                 <ArrowDownRight size={32} className="group-hover:translate-x-1 group-hover:translate-y-1 transition-transform" />
                 <span className="font-black text-xl">BUY PUT</span>
                 <span className="text-[10px] font-bold opacity-70">TREND DOWNWARD</span>
               </div>
               <div className="absolute top-0 right-0 p-4 opacity-10 rotate-180"><TrendingUp size={80} /></div>
            </button>
          </div>

          <div className="space-y-3">
  {/* Live price bar */}
  <LivePrice />

  {/* TradingView chart */}
  <div className="h-[300px] w-full bg-[#0f172a] rounded-2xl p-2 border border-slate-800">
    <TradingViewChart symbol={selected.symbol} />
  </div>
</div>

        </div>

        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
               <Briefcase size={24} />
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-tighter">Current Position Qty</span>
              <p className="text-2xl font-black text-slate-800">{currentPos} Lots</p>
            </div>
          </div>
          <div className="text-right">
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-tighter">Unrealized P&L</span>
            <p className={`text-2xl font-black ${currentPos === 0 ? 'text-slate-300' : 'text-emerald-500'}`}>
              ₹{currentPos === 0 ? '0.00' : '1,240.45'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Portfolio = ({ orders, balance, marketData }) => {
  const holdings = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      if(!map[o.symbol]) map[o.symbol] = { qty: 0, totalCost: 0 };
      const val = parseFloat(o.price);
      if(o.type === 'BUY' || o.type === 'CALL') {
        map[o.symbol].qty += 1;
        map[o.symbol].totalCost += val;
      } else {
        map[o.symbol].qty -= 1;
        map[o.symbol].totalCost -= val;
      }
    });
    return Object.entries(map).filter(([_, v]) => v.qty !== 0);
  }, [orders]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-600 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-200">
          <span className="block text-indigo-100 text-xs font-bold uppercase tracking-widest mb-2">Net Portfolio Value</span>
          <h3 className="text-4xl font-black">₹{balance.toLocaleString()}</h3>
          <div className="mt-4 flex items-center gap-2 text-indigo-200 text-sm font-bold">
            <ArrowUpRight size={16} /> +₹14,500.00 Today
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200">
          <span className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Total Invested</span>
          <h3 className="text-4xl font-black">₹42,000</h3>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200">
          <span className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Rule Re-entries</span>
          <h3 className="text-4xl font-black">12</h3>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-xl">Active Positions</h3>
          <span className="text-[10px] font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-500 uppercase">Live MTM</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-8 py-5 text-left">Instrument</th>
                <th className="px-8 py-5 text-center">Qty</th>
                <th className="px-8 py-5 text-right">Avg Price</th>
                <th className="px-8 py-5 text-right">LTP</th>
                <th className="px-8 py-5 text-right">Day P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {holdings.length === 0 ? (
                <tr><td colSpan="5" className="px-8 py-16 text-center text-slate-300 font-bold italic">No active trades in system.</td></tr>
              ) : holdings.map(([symbol, data]) => (
                <tr key={symbol} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-6 font-black text-slate-800">{symbol}</td>
                  <td className="px-8 py-6 text-center">
                    <span className="bg-slate-100 px-3 py-1 rounded-lg font-mono font-bold text-slate-600">{data.qty}</span>
                  </td>
                  <td className="px-8 py-6 text-right font-mono">₹{(data.totalCost / data.qty).toFixed(2)}</td>
                  <td className="px-8 py-6 text-right font-mono font-bold">₹{marketData.find(m => m.symbol === symbol)?.price.toFixed(2)}</td>
                  <td className="px-8 py-6 text-right text-emerald-500 font-black">+₹450.20</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const OrderHistory = ({ orders }) => (
  <div className="max-w-6xl mx-auto bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-8">
    <div className="p-8 border-b border-slate-100">
      <h3 className="font-black text-xl">Audit Trail & Order Book</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
          <tr>
            <th className="px-8 py-4 text-left">Timestamp</th>
            <th className="px-8 py-4 text-left">Type</th>
            <th className="px-8 py-4 text-left">Instrument</th>
            <th className="px-8 py-4 text-right">Price</th>
            <th className="px-8 py-4 text-right">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map(o => (
            <tr key={o.id} className="group hover:bg-slate-50/50 transition-all">
              <td className="px-8 py-4 text-slate-400 font-mono text-xs">{new Date(o.time).toLocaleTimeString()}</td>
              <td className="px-8 py-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${o.type === 'CALL' || o.type === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {o.type}
                </span>
              </td>
              <td className="px-8 py-4 font-bold text-slate-700">{o.symbol}</td>
              <td className="px-8 py-4 text-right font-mono font-bold">₹{o.price}</td>
              <td className="px-8 py-4 text-right">
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-500 transition-colors uppercase">
                  {o.status || 'MANUAL EXEC'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const MarketInsights = () => {
  const [insight, setInsight] = useState("");
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Briefly analyze the Nifty 50 and Gold MCX sentiment for today. Should I be looking for re-entry or trend continuation? Max 150 words." }] }]
        })
      });
      const data = await response.json();
      setInsight(data.candidates?.[0]?.content?.parts?.[0]?.text || "No data available.");
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-[#0f172a] rounded-[2.5rem] p-12 text-center text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <TrendingUp size={400} className="absolute -bottom-20 -left-20" />
        </div>
        <h2 className="text-4xl font-black mb-4 relative z-10">Neo Intelligence</h2>
        <p className="text-slate-400 mb-8 max-w-lg mx-auto relative z-10">Get instant AI sentiment analysis for Nifty and MCX markets to validate your re-entry rules.</p>
        <button 
          onClick={analyze}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-2xl font-black shadow-2xl shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 relative z-10"
        >
          {loading ? 'Synthesizing Market Data...' : 'Generate Neo Insights'}
        </button>
      </div>
      
      {insight && (
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-500">
           <div className="flex items-center gap-2 mb-4 text-indigo-600 font-black text-xs uppercase tracking-widest">
             <Zap size={16} /> Market Sentiment Report
           </div>
           <div className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{insight}</div>
        </div>
      )}
    </div>
  );
};

// ⬇️ ADD THIS NEW COMPONENT (keep everything else same)

const TradingViewChart = ({ symbol }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!window.TradingView) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = renderChart;
      document.body.appendChild(script);
    } else {
      renderChart();
    }

    function renderChart() {
      containerRef.current.innerHTML = "";
      new window.TradingView.widget({
        container_id: containerRef.current.id,
        symbol: symbol.includes("NIFTY")
          ? "NSE:NIFTY"
          : symbol.includes("BANK")
          ? "NSE:BANKNIFTY"
          : "NSE:RELIANCE",
        interval: "5",
        timezone: "Asia/Kolkata",
        theme: "dark",
        style: "1",
        locale: "en",
        autosize: true,
        allow_symbol_change: true,
        hide_top_toolbar: false,
        hide_legend: false,
      });
    }
  }, [symbol]);

  return (
    <div
      id="tv_chart_container"
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden"
    />
  );
};


export default App;
