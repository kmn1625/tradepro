import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import LivePrice from "./components/LivePrice";
import CandleChart from "./components/CandleChart";
import PaperTrading from "./components/PaperTrading";
import SignalLog from "./components/SignalLog";
import BacktestRunner from "./components/BacktestRunner";
import AlgoScripts from "./components/AlgoScripts";
import Strategies from "./components/Strategies";
import Watchlist from "./components/Watchlist";
import MarketDepth from "./components/MarketDepth";
import NotificationCenter from "./components/NotificationCenter";
import UserProfile from "./components/UserProfile";
import Alerts from "./components/Alerts";
import Screener from "./components/Screener";
import IPO from "./components/IPO";
import PortfolioAnalytics from "./components/PortfolioAnalytics";
import Reports from "./components/Reports";
import News from "./components/News";
import AIInsights from "./components/AIInsights";
import Futures from "./components/Futures";
import SmartExit from "./components/SmartExit";
import BasketOrder from "./components/BasketOrder";
import LiveTrade from "./components/LiveTrade";
import {
  TrendingUp,
  LayoutDashboard,
  Radio,
  Briefcase,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Zap,
  PieChart,
  RefreshCw,
  Lock,
  Unlock,
  Activity,
  BookOpen,
  FlaskConical,
  Bot,
  Key,
  ChevronDown,
  ChevronUp,
  Bell,
  Search,
  ListOrdered,
  Newspaper,
  BarChart3,
  FileBarChart,
  Brain,
  Package,
  ShieldCheck,
  AreaChart,
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
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

const App = () => {
  const [activeTab, setActiveTab] = useState('terminal');
  const [user, setUser] = useState(null);

  // Live market data as a map — updated by WS
  const [marketDataMap, setMarketDataMap] = useState({});

  // Active watchlist symbols — notified by Watchlist component
  const [watchlistSymbols, setWatchlistSymbols] = useState([
    { symbol: 'NIFTY 50 (Index)',   type: 'INDEX', basePrice: 22453.20 },
    { symbol: 'BANK NIFTY (Index)', type: 'INDEX', basePrice: 47285.10 },
    { symbol: 'GOLD (MCX)',         type: 'MCX',   basePrice: 62450.00 },
    { symbol: 'CRUDEOIL (MCX)',     type: 'MCX',   basePrice: 6450.00  },
  ]);

  const [balance, setBalance] = useState(500000);
  const [orders, setOrders] = useState([]);
  const [positions, setPositions] = useState({});
  const [wsStatus, setWsStatus] = useState('CONNECTING');
  const [feedStatus, setFeedStatus] = useState({ mode: 'unknown', liveEnabled: false });
  const [toast, setToast] = useState(null); // { msg, type: 'ok'|'err' }
  const toastTimer = useRef(null);
  const wsRef = useRef(null);

  // Derived: marketData array from active watchlist + live map
  const marketData = useMemo(() =>
    watchlistSymbols.map(s => {
      const live = marketDataMap[s.symbol] || {};
      return {
        ...s,
        price: live.price || s.basePrice || 0,
        pct: live.pct ?? 0,
        change: live.change ?? 0,
        trend: live.trend || 'up',
        bid: live.bid,
        ask: live.ask,
        volume: live.volume,
        open: live.open,
        high: live.high,
        low: live.low,
        prevClose: live.prevClose,
        weekHigh52: live.weekHigh52,
        weekLow52: live.weekLow52,
        circuitUpper: live.circuitUpper,
        circuitLower: live.circuitLower,
      };
    }),
    [watchlistSymbols, marketDataMap]
  );

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
      [...fetchedOrders].reverse().forEach(o => {
        if (!pos[o.symbol]) pos[o.symbol] = { qty: 0, avgPrice: 0, totalCost: 0 };
        if (o.status === 'SQUARED_OFF') {
          pos[o.symbol] = { qty: 0, avgPrice: 0, totalCost: 0 };
          return;
        }
        const dir = o.type === 'BUY' || o.type === 'CALL' ? 1 : -1;
        pos[o.symbol].qty += dir;
        pos[o.symbol].totalCost += dir * parseFloat(o.price);
      });
      Object.values(pos).forEach(p => {
        p.avgPrice = p.qty !== 0 ? Math.abs(p.totalCost / p.qty) : 0;
      });
      setPositions(pos);
    });
  }, [user]);

  // Live Market Feed
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

        if (msg.type === 'FEED_STATUS') {
          setFeedStatus({
            mode: msg.mode || 'unknown',
            liveEnabled: Boolean(msg.liveEnabled),
            connected: Boolean(msg.connected),
          });
          return;
        }

        if (msg.type === 'PRICE_UPDATE') {
          setMarketDataMap(prev => {
            const existing = prev[msg.symbol] || {};
            const basePrice = existing.basePrice || msg.open || msg.price;
            const prevClose = msg.prevClose || existing.prevClose || msg.price;
            const change = parseFloat((msg.price - prevClose).toFixed(2));
            const pct = prevClose ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;
            return {
              ...prev,
              [msg.symbol]: {
                ...existing,
                basePrice: existing.basePrice || basePrice,
                price: msg.price,
                bid: msg.bid,
                ask: msg.ask,
                volume: msg.volume,
                open: msg.open,
                high: msg.high,
                low: msg.low,
                prevClose,
                weekHigh52: msg.weekHigh52,
                weekLow52: msg.weekLow52,
                circuitUpper: msg.circuitUpper,
                circuitLower: msg.circuitLower,
                change,
                pct,
                trend: msg.price >= (existing.price || msg.price) ? 'up' : 'down',
              },
            };
          });
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

  // Notify backend of active watchlist symbols so it can generate mock data for new ones
  const handleWatchlistChange = useCallback((symbols) => {
    setWatchlistSymbols(symbols);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SUBSCRIBE_SYMBOLS', symbols }));
    }
  }, []);

  const showToast = (msg, type = 'ok') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // Local order store used when Firebase is unavailable (demo/offline mode)
  const applyOrderToLocal = (newOrders) => {
    setOrders(newOrders);
    const pos = {};
    [...newOrders].reverse().forEach(o => {
      if (!pos[o.symbol]) pos[o.symbol] = { qty: 0, avgPrice: 0, totalCost: 0 };
      if (o.status === 'SQUARED_OFF') {
        pos[o.symbol] = { qty: 0, avgPrice: 0, totalCost: 0 };
        return;
      }
      const dir = o.type === 'BUY' || o.type === 'CALL' ? 1 : -1;
      pos[o.symbol].qty += dir;
      pos[o.symbol].totalCost += dir * parseFloat(o.price);
    });
    Object.values(pos).forEach(p => {
      p.avgPrice = p.qty !== 0 ? Math.abs(p.totalCost / p.qty) : 0;
    });
    setPositions(pos);
  };

  // Fetch broker balance on mount + every 60s
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/funds/balance`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.availableCash !== undefined) setBalance(data.availableCash);
      } catch { /* keep default */ }
    };
    fetchBalance();
    const timer = setInterval(fetchBalance, 60000);
    return () => clearInterval(timer);
  }, []);

  // Send order to broker backend (Kotak live if authenticated, simulated otherwise)
  // optionType: 'CE'|'PE'|null — pass for options orders
  const _brokerOrder = async (symbol, side, price, qty, label, optionType = null, strike = null, expiry = null) => {
    try {
      const body = {
        symbol, side, lots: qty, ltp: price,
        orderType: 'MKT', product: 'MIS', confirmLive: true,
      };
      if (optionType) { body.type = optionType; body.strike = strike; body.expiry = expiry; }
      const res = await fetch(`${API_BASE}/api/market/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let data;
      try { data = await res.json(); } catch { data = { error: `HTTP ${res.status}` }; }
      if (!res.ok) {
        showToast(`Order failed: ${data.message || data.error || res.status}`, 'err');
        return null;
      }
      const isLive = data.mode === 'live';
      const tag = isLive ? '🟢 LIVE' : '⚪ SIMULATED';
      showToast(`${label} ${symbol} @ ₹${parseFloat(price).toFixed(2)} — ${tag}`);
      return data;
    } catch (err) {
      showToast(`Broker error: ${err.message}`, 'err');
      return null;
    }
  };

  const squareOffPosition = async (symbol, price) => {
    const pos = positions[symbol];
    if (!pos || pos.qty === 0) return;
    const side = pos.qty > 0 ? 'SELL' : 'BUY';

    // 1. Broker execution — abort if broker rejects
    const result = await _brokerOrder(symbol, side, price, Math.abs(pos.qty), 'SQUARE OFF');
    if (!result) return;

    // 2. Local order history
    const orderDoc = {
      symbol,
      type: side,
      price: parseFloat(price).toFixed(2),
      time: Date.now(),
      status: 'SQUARED_OFF',
      qty: Math.abs(pos.qty),
    };
    if (user && db) {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), orderDoc);
    } else {
      applyOrderToLocal([{ id: String(Date.now()), ...orderDoc }, ...orders]);
    }
  };

  // strike: ATM strike number (null for futures/equity/crypto)
  // expiry: ISO date string '2026-06-26' (null for futures/equity/crypto)
  const placeOrder = async (symbol, type, price, qty = 1, isFlip = false, strike = null, expiry = null) => {
    const offline = !user || !db;
    const newOrders = [];
    const side = (type === 'BUY' || type === 'CALL') ? 'BUY' : 'SELL';
    const optionType = type === 'CALL' ? 'CE' : type === 'PUT' ? 'PE' : null;

    // ── Flip: square off existing first ──
    if (isFlip) {
      const currentQty = positions[symbol]?.qty || 0;
      if (currentQty !== 0) {
        const flipSide = currentQty > 0 ? 'SELL' : 'BUY';
        const flipResult = await _brokerOrder(symbol, flipSide, price, Math.abs(currentQty), 'FLIP-EXIT');
        if (!flipResult) return;
        const flipDoc = {
          symbol,
          type: flipSide,
          price: price.toFixed(2),
          time: Date.now(),
          status: 'SQUARED_OFF',
          qty: Math.abs(currentQty),
        };
        if (!offline) {
          await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), flipDoc);
        } else {
          newOrders.push({ id: String(Date.now() - 1), ...flipDoc });
        }
      }
    }

    // ── New order: broker execution — abort if broker rejects ──
    const result = await _brokerOrder(symbol, side, price, qty, isFlip ? 'FLIP-ENTRY' : type, optionType, strike, expiry);
    if (!result) return;

    // ── Local order history ──
    const execDoc = {
      symbol, type,
      price: price.toFixed(2),
      time: Date.now(),
      status: 'EXECUTED',
      qty,
    };
    try {
      if (!offline) {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), execDoc);
      } else {
        newOrders.push({ id: String(Date.now()), ...execDoc });
        applyOrderToLocal([...newOrders, ...orders]);
      }
    } catch (err) {
      showToast(`History save failed: ${err.message}`, 'err');
    }
  };

  const feedModeLabel = {
    mock: 'MOCK FEED',
    live: 'LIVE FEED',
    'connecting-live': 'CONNECTING FEED',
    'reconnecting-live': 'RECONNECTING FEED',
    stopped: 'FEED STOPPED',
    unknown: 'FEED UNKNOWN',
  }[feedStatus.mode] || String(feedStatus.mode || 'FEED UNKNOWN').toUpperCase();

  const feedModeClass = feedStatus.mode === 'live'
    ? 'text-emerald-500'
    : feedStatus.mode === 'mock'
      ? 'text-amber-500'
      : 'text-slate-400';

  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-slate-900 font-sans">
      {/* Order toast notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3 transition-all ${
          toast.type === 'err'
            ? 'bg-rose-600 text-white'
            : 'bg-slate-900 text-white'
        }`}>
          <span className="text-base">{toast.type === 'err' ? '✗' : '✓'}</span>
          {toast.msg}
        </div>
      )}
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
            { id: 'livetrade',  icon: Radio,           label: 'Live Trade' },
            { id: 'terminal',   icon: LayoutDashboard, label: 'Execution Terminal' },
            { id: 'algo',       icon: Bot,             label: 'Algo Scripts' },
            { id: 'backtest',   icon: FlaskConical,    label: 'Backtester' },
            { id: 'portfolio',  icon: Briefcase,       label: 'Rule Positions' },
            { id: 'orders',     icon: History,         label: 'Order History' },
            { id: 'alerts',     icon: Bell,            label: 'Price Alerts' },
            { id: 'screener',   icon: Search,          label: 'Screener' },
            { id: 'ipo',                 icon: ListOrdered,  label: 'IPO' },
            { id: 'portfolio-analytics', icon: BarChart3,    label: 'Portfolio Analytics' },
            { id: 'reports',             icon: FileBarChart, label: 'Reports' },
            { id: 'news',                icon: Newspaper,    label: 'News & Calendar' },
            { id: 'analytics',           icon: Brain,        label: 'AI Insights' },
            { id: 'futures',    icon: AreaChart,       label: 'Futures' },
            { id: 'smart-exit', icon: ShieldCheck,     label: 'Smart Exit' },
            { id: 'basket',     icon: Package,         label: 'Basket Orders' },
            { id: 'strategies', icon: Key,             label: 'Strategies' },
            { id: 'paper',      icon: Activity,        label: 'Paper Trading' },
            { id: 'signals',    icon: BookOpen,        label: 'Signal Log' },
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
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between relative z-[100]">
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
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Socket</span>
              <div className={`text-xs font-bold flex items-center gap-1 ${wsStatus === 'LIVE' ? 'text-emerald-500' : 'text-amber-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'LIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} /> {wsStatus}
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Feed</span>
              <div className={`text-xs font-black ${feedModeClass}`}>{feedModeLabel}</div>
            </div>
            <NotificationCenter wsRef={wsRef} />
            <UserProfile
              user={user}
              wsStatus={wsStatus}
              feedStatus={feedStatus}
              onLogout={() => auth?.signOut?.()}
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8fafc]">
          {activeTab === 'livetrade' && (
            <LiveTrade
              onOrder={placeOrder}
              onSquareOff={squareOffPosition}
              onToast={showToast}
              positions={positions}
              marketDataMap={marketDataMap}
            />
          )}
          {activeTab === 'terminal' && (
            <Terminal
              marketData={marketData}
              marketDataMap={marketDataMap}
              onOrder={placeOrder}
              onSquareOff={squareOffPosition}
              onToast={showToast}
              positions={positions}
              wsRef={wsRef}
              onWatchlistChange={handleWatchlistChange}
            />
          )}

          {activeTab === 'algo' && <AlgoScripts />}
          {activeTab === 'backtest' && <BacktestRunner />}
          {activeTab === 'portfolio' && (
            <Portfolio orders={orders} balance={balance} marketData={marketData} positions={positions} onSquareOff={squareOffPosition} />
          )}
          {activeTab === 'orders' && <OrderHistory orders={orders} />}
          {activeTab === 'alerts' && <Alerts wsRef={wsRef} />}
          {activeTab === 'screener' && <Screener />}
          {activeTab === 'ipo' && <IPO />}
          {activeTab === 'portfolio-analytics' && (
            <PortfolioAnalytics orders={orders} positions={positions} balance={balance} />
          )}
          {activeTab === 'reports' && <Reports orders={orders} />}
          {activeTab === 'news' && <News />}
          {activeTab === 'analytics' && <AIInsights orders={orders} positions={positions} />}
          {activeTab === 'futures'    && <Futures />}
          {activeTab === 'smart-exit' && <SmartExit positions={positions} balance={balance} />}
          {activeTab === 'basket'     && <BasketOrder />}
          {activeTab === 'strategies' && <Strategies />}
          {activeTab === 'paper' && (
            <PaperTrading marketDataMap={marketDataMap} watchlistSymbols={watchlistSymbols} />
          )}
          {activeTab === 'signals' && <SignalLog />}
        </div>
      </main>
    </div>
  );
};

// ─── Terminal ────────────────────────────────────────────────────────────────

const Terminal = ({ marketData, marketDataMap, onOrder, onSquareOff, onToast, positions, wsRef, onWatchlistChange }) => {
  const [selectedSymbol, setSelectedSymbol] = useState(marketData[0]?.symbol || '');
  const [isLocked, setIsLocked] = useState(false);
  const [showDepth, setShowDepth] = useState(false);
  const [lastExitPrice, setLastExitPrice] = useState(null);
  const [beArmed, setBeArmed] = useState(false);
  const [lockFloor, setLockFloor] = useState(null);
  const eng = useRef({ hwPnl: 0, reentryDir: null, exiting: false, lockFloor: null });
  const prevPosRef = useRef(0);

  // Keep selectedSymbol valid when watchlist changes
  useEffect(() => {
    if (!marketData.find(m => m.symbol === selectedSymbol) && marketData[0]) {
      setSelectedSymbol(marketData[0].symbol);
    }
  }, [marketData, selectedSymbol]);

  const selected = marketData.find(m => m.symbol === selectedSymbol) || marketData[0] || {};
  const liveData = marketDataMap[selected.symbol] || {};

  const price      = selected.price || 0;
  const pct        = selected.pct || 0;
  const open       = liveData.open || selected.open || price;
  const dayHigh    = liveData.high || selected.high || price;
  const dayLow     = liveData.low || selected.low || price;
  const prevClose  = liveData.prevClose || price;
  const volume     = liveData.volume || selected.volume || 0;
  const bid        = liveData.bid || price;
  const ask        = liveData.ask || price;
  const wk52High   = liveData.weekHigh52 || price;
  const wk52Low    = liveData.weekLow52 || price;
  const circUpper  = liveData.circuitUpper;
  const circLower  = liveData.circuitLower;

  const wk52Range  = wk52High - wk52Low;
  const wk52Pos    = wk52Range > 0 ? Math.min(100, Math.max(0, ((price - wk52Low) / wk52Range) * 100)) : 50;

  const currentPos     = positions[selected?.symbol]?.qty || 0;
  const entryPrice     = positions[selected?.symbol]?.avgPrice || 0;
  const unrealizedPnl  = currentPos !== 0 ? (price - entryPrice) * currentPos : 0;

  // Reset rule engine when new trade entered (0 → nonzero)
  useEffect(() => {
    const prev = prevPosRef.current;
    prevPosRef.current = currentPos;
    if (prev === 0 && currentPos !== 0) {
      const e = eng.current;
      e.hwPnl = 0;
      e.lockFloor = null;
      setBeArmed(false);
      setLockFloor(null);
      setIsLocked(false);
      setLastExitPrice(null);
    }
  }, [currentPos]);

  // Rule engine — fires on every price tick
  useEffect(() => {
    if (!selected?.symbol) return;
    const e = eng.current;
    if (e.exiting) return;
    const sym = selected.symbol;

    // ── No position: reset + watch for re-entry ──
    if (currentPos === 0) {
      if (e.hwPnl !== 0) { e.hwPnl = 0; e.lockFloor = null; }
      if (lastExitPrice !== null && e.reentryDir) {
        if (Math.abs(price - lastExitPrice) <= 5) {
          const dir = e.reentryDir;
          e.reentryDir = null;
          setLastExitPrice(null);
          onOrder(sym, dir, price);
          onToast?.(`[RE-ENTRY] ${sym} ${dir} @ ₹${price.toFixed(2)}`);
        }
      }
      return;
    }

    const pnlPts = (price - entryPrice) * Math.sign(currentPos);
    if (pnlPts > e.hwPnl) e.hwPnl = pnlPts;

    // Arm break-even protection once +5 pts reached
    if (pnlPts > 5 && !beArmed) {
      setBeArmed(true);
    }

    const doAutoExit = (reason) => {
      e.exiting = true;
      e.reentryDir = currentPos > 0 ? 'CALL' : 'PUT';
      onToast?.(`[${reason}] AUTO-EXIT ${sym} @ ₹${price.toFixed(2)}`);
      onSquareOff?.(sym, price).then(() => {
        e.exiting = false;
        e.hwPnl = 0;
        e.lockFloor = null;
        setBeArmed(false);
        setLockFloor(null);
        setIsLocked(false);
        setLastExitPrice(price);
      }).catch(() => { e.exiting = false; });
    };

    // Rule 4: 10-pt ladder lock
    if (e.hwPnl >= 10) {
      const floor = Math.max(0, Math.floor(e.hwPnl / 10) * 10 - 10);
      if (floor !== e.lockFloor) {
        e.lockFloor = floor;
        setLockFloor(floor);
        setIsLocked(true);
      }
      if (pnlPts <= floor) { doAutoExit('10-PT LOCK'); return; }
    }

    // Rule 2: break-even protection (only before lock activates)
    if (beArmed && (e.lockFloor === null || e.lockFloor <= 0) && pnlPts <= 0) {
      doAutoExit('BREAK-EVEN');
    }
  }, [price, currentPos, entryPrice, lastExitPrice, beArmed, selected?.symbol]);

  function fmtVol(v) {
    if (!v) return '—';
    if (v >= 1e7) return (v / 1e7).toFixed(1) + ' Cr';
    if (v >= 1e5) return (v / 1e5).toFixed(1) + ' L';
    if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
    return String(v);
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 max-w-[1700px] mx-auto">
      {/* LEFT — Watchlist + Rule Monitor */}
      <div className="xl:col-span-4 space-y-6">
        <Watchlist
          marketDataMap={marketDataMap}
          onSymbolSelect={setSelectedSymbol}
          selectedSymbol={selectedSymbol}
          onWatchlistChange={onWatchlistChange}
        />

      </div>

      {/* RIGHT — Stock detail */}
      <div className="xl:col-span-8 space-y-6">
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
          {/* Header row */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-4xl font-black text-slate-900">{selected?.symbol || '—'}</h2>
                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded">WEEKLY EXPIRY</span>
                {circUpper && price >= circUpper * 0.98 && (
                  <span className="bg-rose-100 text-rose-600 text-[10px] font-black px-2 py-1 rounded animate-pulse">UPPER FREEZE</span>
                )}
                {circLower && price <= circLower * 1.02 && (
                  <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-1 rounded animate-pulse">LOWER FREEZE</span>
                )}
              </div>
              <div className="text-slate-500 font-medium">
                LTP: <span className="font-mono text-indigo-600 font-bold">₹{price.toFixed(2)}</span>
                <span className={`ml-3 text-sm font-bold ${pct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => onOrder(selected.symbol, 'FLIP', price, 1, true)}
                className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-black transition-all active:scale-95"
              >
                <RefreshCw size={18} /> FLIP
              </button>
              <button
                onClick={() => setIsLocked(!isLocked)}
                className={`p-3 rounded-2xl border transition-all ${isLocked ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
              >
                {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
              </button>
            </div>
          </div>

          {/* OHLC + Volume + Bid/Ask stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Open',     val: `₹${open.toFixed(2)}` },
              { label: 'High',     val: `₹${dayHigh.toFixed(2)}`,  color: 'text-emerald-600' },
              { label: 'Low',      val: `₹${dayLow.toFixed(2)}`,   color: 'text-rose-600' },
              { label: 'Prev Close', val: `₹${prevClose.toFixed(2)}` },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
                <p className={`text-sm font-mono font-bold ${s.color || 'text-slate-700'}`}>{s.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Volume</p>
              <p className="text-sm font-mono font-bold text-slate-700">{fmtVol(volume)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Bid</p>
              <p className="text-sm font-mono font-bold text-emerald-700">₹{bid.toFixed(2)}</p>
            </div>
            <div className="bg-rose-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Ask</p>
              <p className="text-sm font-mono font-bold text-rose-700">₹{ask.toFixed(2)}</p>
            </div>
          </div>

          {/* 52-week range */}
          <div className="mb-6">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-2">
              <span>52W Low: ₹{wk52Low.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              <span>52W High: ₹{wk52High.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="relative h-2 bg-slate-100 rounded-full">
              <div
                className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full"
                style={{ width: `${wk52Pos}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white shadow"
                style={{ left: `calc(${wk52Pos}% - 6px)` }}
              />
            </div>
            <div className="text-center mt-1 text-[10px] text-slate-400 font-bold">
              {wk52Pos.toFixed(0)}% from 52W Low
            </div>
          </div>

          {/* Circuit limits */}
          {(circUpper || circLower) && (
            <div className="flex gap-3 mb-6">
              {circUpper && (
                <div className="flex-1 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-center">
                  <p className="text-[10px] font-bold text-rose-400 uppercase mb-0.5">Upper Circuit</p>
                  <p className="text-sm font-mono font-bold text-rose-700">₹{circUpper.toFixed(2)}</p>
                </div>
              )}
              {circLower && (
                <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-center">
                  <p className="text-[10px] font-bold text-emerald-500 uppercase mb-0.5">Lower Circuit</p>
                  <p className="text-sm font-mono font-bold text-emerald-700">₹{circLower.toFixed(2)}</p>
                </div>
              )}
            </div>
          )}

          {/* Charts */}
          <div className="space-y-3">
            <LivePrice />
            <CandleChart symbol={selected?.symbol} interval="5m" height={300} />
          </div>

          {/* Market Depth toggle */}
          <div className="mt-6">
            <button
              onClick={() => setShowDepth(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-sm font-bold text-slate-700"
            >
              <span>Market Depth</span>
              {showDepth ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showDepth && (
              <div className="mt-3 px-2">
                <MarketDepth symbol={selected?.symbol} wsRef={wsRef} />
              </div>
            )}
          </div>
        </div>

        {/* Active Positions Panel */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Briefcase size={18} />
              </div>
              <span className="text-sm font-black text-slate-800">Open Positions</span>
            </div>
            <span className="text-[10px] font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-500 uppercase tracking-wide">Live MTM</span>
          </div>

          {Object.entries(positions).filter(([, v]) => v.qty !== 0).length > 0 ? (
            <>
              <div className="grid grid-cols-5 px-8 py-2 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <span>Symbol</span>
                <span className="text-center">Side / Qty</span>
                <span className="text-right">Avg Price</span>
                <span className="text-right">Unrealized P&L</span>
                <span className="text-right">Action</span>
              </div>
              <div className="divide-y divide-slate-50">
                {Object.entries(positions)
                  .filter(([, v]) => v.qty !== 0)
                  .map(([sym, v]) => {
                    const ltp = marketDataMap[sym]?.price || v.avgPrice;
                    const pnl = (ltp - v.avgPrice) * v.qty;
                    return (
                      <div key={sym} className="grid grid-cols-5 items-center px-8 py-4">
                        <span className="font-black text-slate-800">{sym}</span>
                        <div className="flex justify-center">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${v.qty > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {v.qty > 0 ? 'LONG' : 'SHORT'} {Math.abs(v.qty)}
                          </span>
                        </div>
                        <span className="text-right text-sm font-mono text-slate-500">₹{v.avgPrice.toFixed(2)}</span>
                        <span className={`text-right text-sm font-black ${pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                        </span>
                        <div className="flex justify-end">
                          <button
                            onClick={() => onSquareOff(sym, ltp)}
                            className="text-xs font-bold px-4 py-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 transition-all"
                          >
                            Exit
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="px-8 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wide">Total Unrealized P&L</span>
                {(() => {
                  const total = Object.entries(positions)
                    .filter(([, v]) => v.qty !== 0)
                    .reduce((sum, [sym, v]) => {
                      const ltp = marketDataMap[sym]?.price || v.avgPrice;
                      return sum + (ltp - v.avgPrice) * v.qty;
                    }, 0);
                  return (
                    <span className={`text-sm font-black ${total >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {total >= 0 ? '+' : ''}₹{total.toFixed(2)}
                    </span>
                  );
                })()}
              </div>
            </>
          ) : (
            <div className="px-8 py-10 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                <Briefcase size={28} />
              </div>
              <p className="text-sm font-bold text-slate-300 italic">No open positions</p>
              <p className="text-xs text-slate-400">Place an order in Live Trade to open a position</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Portfolio ────────────────────────────────────────────────────────────────

const Portfolio = ({ orders, balance, marketData, positions, onSquareOff }) => {
  const [squaringOff, setSquaringOff] = useState({});

  const holdings = useMemo(() =>
    Object.entries(positions)
      .filter(([, v]) => v.qty !== 0)
      .map(([symbol, v]) => ({ symbol, ...v })),
    [positions]
  );

  const handleSquareOff = async (symbol, price) => {
    setSquaringOff(prev => ({ ...prev, [symbol]: true }));
    try { await onSquareOff?.(symbol, price); }
    finally { setSquaringOff(prev => ({ ...prev, [symbol]: false })); }
  };

  const totalInvested = useMemo(() => holdings.reduce((sum, h) => sum + Math.abs(h.totalCost), 0), [holdings]);

  // Unrealized P&L: open positions vs LTP
  const unrealizedPnl = useMemo(() => holdings.reduce((sum, h) => {
    const ltp = marketData.find(m => m.symbol === h.symbol)?.price || h.avgPrice;
    return sum + (ltp - h.avgPrice) * h.qty;
  }, 0), [holdings, marketData]);

  // Realized P&L: reconstruct from squared-off order pairs
  const realizedPnl = useMemo(() => {
    const bySymbol = {};
    [...orders].reverse().forEach(o => {
      if (!bySymbol[o.symbol]) bySymbol[o.symbol] = { entries: [], realized: 0 };
      const st = bySymbol[o.symbol];
      if (o.status === 'SQUARED_OFF') {
        // closing trade: compute against last entry avg
        const avg = st.entries.length
          ? st.entries.reduce((s, e) => s + e.price * e.qty, 0) / st.entries.reduce((s, e) => s + e.qty, 0)
          : parseFloat(o.price);
        const dir = o.type === 'BUY' || o.type === 'CALL' ? 1 : -1;
        st.realized += (parseFloat(o.price) - avg) * dir * (o.qty || 1);
        st.entries = [];
      } else {
        st.entries.push({ price: parseFloat(o.price), qty: o.qty || 1 });
      }
    });
    return Object.values(bySymbol).reduce((s, v) => s + v.realized, 0);
  }, [orders]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-indigo-600 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-200">
          <span className="block text-indigo-100 text-xs font-bold uppercase tracking-widest mb-2">Net Portfolio Value</span>
          <h3 className="text-4xl font-black">₹{balance.toLocaleString('en-IN')}</h3>
          <div className="mt-4 flex items-center gap-2 text-indigo-200 text-sm font-bold">
            {unrealizedPnl >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            {unrealizedPnl >= 0 ? '+' : ''}₹{unrealizedPnl.toFixed(2)} Open MTM
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200">
          <span className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Unrealized P&amp;L</span>
          <h3 className={`text-4xl font-black ${unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {unrealizedPnl >= 0 ? '+' : ''}₹{unrealizedPnl.toFixed(2)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold">Open positions</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200">
          <span className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Realized P&amp;L</span>
          <h3 className={`text-4xl font-black ${realizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {realizedPnl >= 0 ? '+' : ''}₹{realizedPnl.toFixed(2)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold">Closed trades</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200">
          <span className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Total Invested</span>
          <h3 className="text-4xl font-black">₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
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
                <th className="px-8 py-5 text-right">Chg%</th>
                <th className="px-8 py-5 text-right">Unrealized P&amp;L</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {holdings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-8 py-16 text-center text-slate-300 font-bold italic">No active trades in system.</td>
                </tr>
              ) : holdings.map(({ symbol, qty, avgPrice }) => {
                const ltp    = marketData.find(m => m.symbol === symbol)?.price || avgPrice;
                const pnl    = (ltp - avgPrice) * qty;
                const chgPct = avgPrice ? ((ltp - avgPrice) / avgPrice * 100) : 0;
                const isSelling = squaringOff[symbol];
                return (
                  <tr key={symbol} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-6 font-black text-slate-800">{symbol}</td>
                    <td className="px-8 py-6 text-center">
                      <span className={`px-3 py-1 rounded-lg font-mono font-bold ${qty > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{qty > 0 ? '+' : ''}{qty}</span>
                    </td>
                    <td className="px-8 py-6 text-right font-mono">₹{avgPrice.toFixed(2)}</td>
                    <td className="px-8 py-6 text-right font-mono font-bold">₹{ltp.toFixed(2)}</td>
                    <td className={`px-8 py-6 text-right text-xs font-black ${chgPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%
                    </td>
                    <td className={`px-8 py-6 text-right font-black ${pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button
                        onClick={() => handleSquareOff(symbol, ltp)}
                        disabled={isSelling}
                        className="bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-black px-4 py-2 rounded-xl transition-all uppercase tracking-wide"
                      >
                        {isSelling ? 'Closing…' : 'Square Off'}
                      </button>
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

// ─── OrderHistory ─────────────────────────────────────────────────────────────

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
              <td colSpan="5" className="px-8 py-16 text-center text-slate-300 font-bold italic">No orders placed yet.</td>
            </tr>
          ) : orders.map(o => (
            <tr key={o.id} className="group hover:bg-slate-50/50 transition-all">
              <td className="px-8 py-4 text-slate-400 font-mono text-xs">{new Date(o.time).toLocaleTimeString('en-IN')}</td>
              <td className="px-8 py-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                  o.type === 'CALL' || o.type === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>{o.type}</span>
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

export default App;
