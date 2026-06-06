import React, { useState, useEffect, useRef, useMemo } from 'react';
import LivePrice from "./components/LivePrice";
import CandleChart from "./components/CandleChart";
import PaperTrading from "./components/PaperTrading";
import SignalLog from "./components/SignalLog";
import ClickTrade from "./components/ClickTrade";
import BacktestRunner from "./components/BacktestRunner";
import AlgoScripts from "./components/AlgoScripts";
import {
  TrendingUp,
  LayoutDashboard,
  Briefcase,
  History,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Zap,
  Loader2,
  PieChart,
  RefreshCw,
  Lock,
  Unlock,
  Activity,
  BookOpen,
  Layers,
  FlaskConical,
  Bot
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

// --- FIREBASE CONFIG FROM ENV ---
// Safe init — Firebase throws if projectId is undefined (env vars missing).
// Falls back to null so the rest of the app renders without orders/auth.
const appId = 'neotrade-dev';
let auth = null;
let db = null;

try {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:demo',
  };
  const firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
} catch (err) {
  console.warn('Firebase init failed — orders/auth disabled:', err.message);
}

// --- MOCK DATA ---
const INITIAL_WATCHLIST = [
  { symbol: 'NIFTY 50 (Index)', basePrice: 22453.20, price: 22453.20, type: 'INDEX' },
  { symbol: 'BANK NIFTY (Index)', basePrice: 47285.10, price: 47285.10, type: 'INDEX' },
  { symbol: 'GOLD (MCX)', basePrice: 62450.00, price: 62450.00, type: 'MCX' },
  { symbol: 'CRUDEOIL (MCX)', basePrice: 6450.00, price: 6450.00, type: 'MCX' },
];

const App = () => {
  const [activeTab, setActiveTab] = useState('terminal');
  const [user, setUser] = useState(null);
  const [marketData, setMarketData] = useState(
    INITIAL_WATCHLIST.map(s => ({ ...s, change: 0, pct: 0, trend: 'up' }))
  );
  const [balance, setBalance] = useState(500000);
  const [orders, setOrders] = useState([]);
  const [positions, setPositions] = useState({});
  const [strategyId, setStrategyId] = useState('');
  const [strategyInput, setStrategyInput] = useState('');

  // Auth
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error", err);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Sync Orders from Firestore
  useEffect(() => {
    if (!user || !db) return;
    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'orders'),
      orderBy('time', 'desc'),
      limit(200)
    );
    return onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(fetchedOrders);

      const pos = {};
      fetchedOrders.forEach(o => {
        if (o.status === 'SQUARED_OFF') return; // don't count close-out orders in position qty
        if (!pos[o.symbol]) pos[o.symbol] = { qty: 0, avgPrice: 0, totalCost: 0 };
        const qty = o.type === 'BUY' || o.type === 'CALL' ? 1 : -1;
        pos[o.symbol].qty += qty;
        pos[o.symbol].totalCost += qty * parseFloat(o.price);
      });
      // Compute avg entry price
      Object.values(pos).forEach(p => {
        p.avgPrice = p.qty !== 0 ? Math.abs(p.totalCost / p.qty) : 0;
      });
      setPositions(pos);
    });
  }, [user]);

  const [wsStatus, setWsStatus] = useState('CONNECTING');
  const wsRef = useRef(null);

  // Live Market Feed — real WebSocket from backend
  useEffect(() => {
    const WS_URL = (import.meta.env.VITE_WS_URL || 'ws://localhost:5000');
    let ws;
    let reconnectTimer;

    const connect = () => {
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setWsStatus('LIVE');

      ws.onmessage = (evt) => {
        let msg;
        try { msg = JSON.parse(evt.data); } catch { return; }
        if (msg.type === 'PRICE_UPDATE') {
          setMarketData(current => current.map(s => {
            if (s.symbol !== msg.symbol) return s;
            const change = msg.price - s.basePrice;
            const pct = (change / s.basePrice) * 100;
            return { ...s, price: msg.price, change, pct, trend: msg.price >= s.price ? 'up' : 'down' };
          }));
        }
      };

      ws.onclose = () => {
        setWsStatus('CONNECTING');
        reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const placeOrder = async (symbol, type, price, qty = 1, isFlip = false) => {
    if (!user || !db) return;
    if (isFlip) {
      const currentQty = positions[symbol]?.qty || 0;
      if (currentQty !== 0) {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), {
          symbol,
          type: currentQty > 0 ? 'SELL' : 'BUY',
          price: price.toFixed(2),
          time: Date.now(),
          status: 'SQUARED_OFF',
          qty: Math.abs(currentQty),
        });
      }
    }
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), {
      symbol,
      type,
      price: price.toFixed(2),
      time: Date.now(),
      status: 'EXECUTED',
      qty,
    });
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
            { id: 'terminal',  icon: LayoutDashboard, label: 'Execution Terminal' },
            { id: 'clicktrade',icon: Layers,          label: 'ClickTrade' },
            { id: 'algo',      icon: Bot,             label: 'Algo Scripts' },
            { id: 'backtest',  icon: FlaskConical,    label: 'Backtester' },
            { id: 'portfolio', icon: Briefcase,       label: 'Rule Positions' },
            { id: 'orders',    icon: History,         label: 'Order History' },
            { id: 'analytics', icon: PieChart,        label: 'Market Sentiment' },
            { id: 'paper',     icon: Activity,        label: 'Paper Trading' },
            { id: 'signals',   icon: BookOpen,        label: 'Signal Log' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${
                activeTab === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between overflow-hidden">
          <div className="flex items-center gap-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {marketData.map(s => (
              <div key={s.symbol} className="flex flex-col flex-shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">{s.symbol}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm">₹{s.price.toFixed(2)}</span>
                  <span className={`text-[10px] font-bold ${s.pct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {s.pct >= 0 ? '▲' : '▼'} {Math.abs(s.pct).toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 ml-4 flex-shrink-0">
            <div className="h-8 w-[1px] bg-slate-200" />
            <div className="text-right">
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Status</span>
              <div className={`text-xs font-bold flex items-center gap-1 ${wsStatus === 'LIVE' ? 'text-emerald-500' : 'text-amber-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'LIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} /> {wsStatus}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8fafc]">
          {activeTab === 'terminal' && (
            <Terminal marketData={marketData} onOrder={placeOrder} positions={positions} />
          )}
          {activeTab === 'clicktrade' && <ClickTrade />}
          {activeTab === 'algo' && <AlgoScripts />}
          {activeTab === 'backtest' && <BacktestRunner />}
          {activeTab === 'portfolio' && (
            <Portfolio orders={orders} balance={balance} marketData={marketData} positions={positions} />
          )}
          {activeTab === 'orders' && <OrderHistory orders={orders} />}
          {activeTab === 'analytics' && <MarketInsights />}
          {activeTab === 'paper' && (
            <div className="space-y-6">
              <div className="max-w-4xl mx-auto bg-white rounded-[2rem] border border-slate-200 p-6 flex items-center gap-4 shadow-sm">
                <input
                  type="text"
                  value={strategyInput}
                  onChange={e => setStrategyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && setStrategyId(strategyInput.trim())}
                  placeholder="Paste webhook strategy token…"
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  onClick={() => setStrategyId(strategyInput.trim())}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all"
                >
                  Connect
                </button>
              </div>
              <PaperTrading strategyId={strategyId || null} />
            </div>
          )}
          {activeTab === 'signals' && <SignalLog />}
        </div>
      </main>
    </div>
  );
};

const Terminal = ({ marketData, onOrder, positions }) => {
  const [selected, setSelected] = useState(marketData[0]);
  const [isLocked, setIsLocked] = useState(false);
  const [lastExitPrice, setLastExitPrice] = useState(null);

  // Keep selected in sync when marketData updates
  useEffect(() => {
    setSelected(prev => marketData.find(m => m.symbol === prev.symbol) || marketData[0]);
  }, [marketData]);

  const currentPos = positions[selected?.symbol]?.qty || 0;
  const entryPrice = positions[selected?.symbol]?.avgPrice || 0;
  const unrealizedPnl = currentPos !== 0 && selected
    ? (selected.price - entryPrice) * currentPos
    : 0;

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
                className={`p-5 border-b border-slate-50 cursor-pointer transition-all flex items-center justify-between ${
                  selected?.symbol === stock.symbol
                    ? 'bg-indigo-50/50 border-l-4 border-l-indigo-600'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <p className="font-bold text-slate-900">{stock.symbol}</p>
                  <p className="text-[10px] font-black text-slate-400">{stock.type}</p>
                </div>
                <div className="text-right font-mono">
                  <p className={`font-bold ${stock.pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {stock.price.toFixed(2)}
                  </p>
                  <p className={`text-[10px] ${stock.pct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {stock.pct >= 0 ? '+' : ''}{stock.pct.toFixed(2)}%
                  </p>
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
              { label: 'Re-entry Detection', status: lastExitPrice ? 'WATCHING' : 'OFF', rule: 'Rule 3/5' },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                <div>
                  <p className="text-xs font-bold text-white">{r.label}</p>
                  <p className="text-[10px] text-slate-500">{r.rule}</p>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                  r.status === 'LOCKED' || r.status === 'ACTIVE'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}>
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
                <h2 className="text-4xl font-black text-slate-900">{selected?.symbol}</h2>
                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded">WEEKLY EXPIRY</span>
              </div>
              <div className="text-slate-500 font-medium">
                LTP: <span className="font-mono text-indigo-600 font-bold">₹{selected?.price.toFixed(2)}</span>
              </div>
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
                className={`p-3 rounded-2xl border transition-all ${
                  isLocked
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                    : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                }`}
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
            <LivePrice />
            <CandleChart symbol={selected?.symbol} interval="5m" height={300} />
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
            <p className={`text-2xl font-black ${
              unrealizedPnl > 0 ? 'text-emerald-500' : unrealizedPnl < 0 ? 'text-rose-500' : 'text-slate-300'
            }`}>
              {unrealizedPnl >= 0 ? '+' : ''}₹{unrealizedPnl.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Portfolio = ({ orders, balance, marketData, positions }) => {
  const holdings = useMemo(() => {
    return Object.entries(positions)
      .filter(([, v]) => v.qty !== 0)
      .map(([symbol, v]) => ({ symbol, ...v }));
  }, [positions]);

  const totalInvested = useMemo(() =>
    holdings.reduce((sum, h) => sum + Math.abs(h.totalCost), 0),
    [holdings]
  );

  const reEntries = useMemo(() =>
    orders.filter(o => o.status === 'SQUARED_OFF').length,
    [orders]
  );

  const totalPnl = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const ltp = marketData.find(m => m.symbol === h.symbol)?.price || h.avgPrice;
      return sum + (ltp - h.avgPrice) * h.qty;
    }, 0);
  }, [holdings, marketData]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-600 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-200">
          <span className="block text-indigo-100 text-xs font-bold uppercase tracking-widest mb-2">Net Portfolio Value</span>
          <h3 className="text-4xl font-black">₹{balance.toLocaleString('en-IN')}</h3>
          <div className={`mt-4 flex items-center gap-2 text-indigo-200 text-sm font-bold`}>
            {totalPnl >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toFixed(2)} Today
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200">
          <span className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Total Invested</span>
          <h3 className="text-4xl font-black">₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200">
          <span className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Rule Re-entries</span>
          <h3 className="text-4xl font-black">{reEntries}</h3>
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
                <tr>
                  <td colSpan="5" className="px-8 py-16 text-center text-slate-300 font-bold italic">
                    No active trades in system.
                  </td>
                </tr>
              ) : holdings.map(({ symbol, qty, avgPrice }) => {
                const ltp = marketData.find(m => m.symbol === symbol)?.price || avgPrice;
                const pnl = (ltp - avgPrice) * qty;
                return (
                  <tr key={symbol} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-6 font-black text-slate-800">{symbol}</td>
                    <td className="px-8 py-6 text-center">
                      <span className="bg-slate-100 px-3 py-1 rounded-lg font-mono font-bold text-slate-600">{qty}</span>
                    </td>
                    <td className="px-8 py-6 text-right font-mono">₹{avgPrice.toFixed(2)}</td>
                    <td className="px-8 py-6 text-right font-mono font-bold">₹{ltp.toFixed(2)}</td>
                    <td className={`px-8 py-6 text-right font-black ${pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const OrderHistory = ({ orders }) => (
  <div className="max-w-6xl mx-auto bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
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
            <th className="px-8 py-4 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.length === 0 ? (
            <tr>
              <td colSpan="5" className="px-8 py-16 text-center text-slate-300 font-bold italic">
                No orders placed yet.
              </td>
            </tr>
          ) : orders.map(o => (
            <tr key={o.id} className="group hover:bg-slate-50/50 transition-all">
              <td className="px-8 py-4 text-slate-400 font-mono text-xs">
                {new Date(o.time).toLocaleTimeString('en-IN')}
              </td>
              <td className="px-8 py-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                  o.type === 'CALL' || o.type === 'BUY'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}>
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
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const analyze = async () => {
    if (!apiKey) {
      setInsight("Set VITE_GEMINI_API_KEY in .env.local to enable AI insights.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Briefly analyze Nifty 50 and Gold MCX sentiment for today. Re-entry or trend continuation? Max 150 words." }] }]
          })
        }
      );
      const data = await response.json();
      setInsight(data.candidates?.[0]?.content?.parts?.[0]?.text || "No data available.");
    } catch (e) {
      setInsight("Failed to fetch insights. Check API key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-[#0f172a] rounded-[2.5rem] p-12 text-center text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <TrendingUp size={400} className="absolute -bottom-20 -left-20" />
        </div>
        <h2 className="text-4xl font-black mb-4 relative z-10">Neo Intelligence</h2>
        <p className="text-slate-400 mb-8 max-w-lg mx-auto relative z-10">
          AI sentiment analysis for Nifty and MCX markets to validate re-entry rules.
        </p>
        <button
          onClick={analyze}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-2xl font-black shadow-2xl shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 relative z-10 flex items-center gap-2 mx-auto"
        >
          {loading ? <><Loader2 size={18} className="animate-spin" /> Synthesizing...</> : 'Generate Neo Insights'}
        </button>
      </div>

      {insight && (
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-indigo-600 font-black text-xs uppercase tracking-widest">
            <Zap size={16} /> Market Sentiment Report
          </div>
          <div className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{insight}</div>
        </div>
      )}
    </div>
  );
};

export default App;
