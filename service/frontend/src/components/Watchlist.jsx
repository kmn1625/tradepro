import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Star, X, Plus, Search, GripVertical, Check } from 'lucide-react';
import OrderTicket from './OrderTicket';

const DEFAULT_WATCHLIST = {
  id: 'default',
  name: 'My Watchlist',
  symbols: [
    { symbol: 'NIFTY 50 (Index)',   type: 'INDEX', basePrice: 22453.20 },
    { symbol: 'BANK NIFTY (Index)', type: 'INDEX', basePrice: 47285.10 },
    { symbol: 'GOLD (MCX)',         type: 'MCX',   basePrice: 62450.00 },
    { symbol: 'CRUDEOIL (MCX)',     type: 'MCX',   basePrice: 6450.00  },
  ],
};

const STORAGE_KEY  = 'neotrade_watchlists';
const ACTIVE_KEY   = 'neotrade_active_wl';
const FAV_KEY      = 'neotrade_favorites';
const BACKEND_URL  = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:5000';

function loadWatchlists() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const lists = raw ? JSON.parse(raw) : null;
    return lists && lists.length > 0 ? lists : [DEFAULT_WATCHLIST];
  } catch { return [DEFAULT_WATCHLIST]; }
}

function saveWatchlists(lists) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lists)); } catch {}
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveFavorites(favSet) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...favSet])); } catch {}
}

function fmtVol(v) {
  if (!v) return '—';
  if (v >= 1e7) return (v / 1e7).toFixed(1) + 'Cr';
  if (v >= 1e5) return (v / 1e5).toFixed(1) + 'L';
  if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
  return String(v);
}

export default function Watchlist({ marketDataMap, onSymbolSelect, selectedSymbol, onWatchlistChange }) {
  const [watchlists, setWatchlists] = useState(loadWatchlists);
  const [activeId, setActiveId] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_KEY);
    const lists = loadWatchlists();
    return saved && lists.find(l => l.id === saved) ? saved : lists[0]?.id || 'default';
  });
  const [favorites, setFavorites] = useState(loadFavorites);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [quickOrder, setQuickOrder] = useState(null); // { symbol, ltp, initialSide }
  const searchTimer = useRef(null);
  const searchRef = useRef(null);

  const activeList = watchlists.find(w => w.id === activeId) || watchlists[0];

  useEffect(() => { saveWatchlists(watchlists); }, [watchlists]);
  useEffect(() => { try { localStorage.setItem(ACTIVE_KEY, activeId); } catch {} }, [activeId]);
  useEffect(() => { saveFavorites(favorites); }, [favorites]);
  useEffect(() => { onWatchlistChange?.(activeList?.symbols || []); }, [activeList]);

  // Debounced symbol search
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/market/search?q=${encodeURIComponent(search)}`);
        const data = await r.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false);
        setSearch('');
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addWatchlist = () => {
    const id = `wl_${Date.now()}`;
    const name = `Watchlist ${watchlists.length + 1}`;
    setWatchlists(prev => [...prev, { id, name, symbols: [] }]);
    setActiveId(id);
  };

  const removeWatchlist = (id) => {
    if (watchlists.length <= 1) return;
    setWatchlists(prev => {
      const next = prev.filter(w => w.id !== id);
      if (activeId === id) setActiveId(next[0]?.id);
      return next;
    });
  };

  const commitRename = () => {
    if (!editName.trim()) { setEditingId(null); return; }
    setWatchlists(prev => prev.map(w => w.id === editingId ? { ...w, name: editName.trim() } : w));
    setEditingId(null);
  };

  const addSymbol = (sym) => {
    if (!activeList) return;
    if (activeList.symbols.find(s => s.symbol === sym.symbol)) return;
    setWatchlists(prev => prev.map(w =>
      w.id === activeId
        ? { ...w, symbols: [...w.symbols, { symbol: sym.symbol, type: sym.type, basePrice: sym.basePrice }] }
        : w
    ));
    setSearch('');
    setShowSearch(false);
    setSearchResults([]);
  };

  const removeSymbol = (symbol) => {
    setWatchlists(prev => prev.map(w =>
      w.id === activeId ? { ...w, symbols: w.symbols.filter(s => s.symbol !== symbol) } : w
    ));
  };

  const toggleFavorite = (symbol) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol); else next.add(symbol);
      return next;
    });
  };

  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    setWatchlists(prev => prev.map(w => {
      if (w.id !== activeId) return w;
      const syms = [...w.symbols];
      const [moved] = syms.splice(dragIdx, 1);
      syms.splice(idx, 0, moved);
      return { ...w, symbols: syms };
    }));
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  const symbols = activeList?.symbols || [];

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
      {/* Watchlist tabs */}
      <div className="flex items-center border-b border-slate-100 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {watchlists.map(w => (
          <div
            key={w.id}
            className={`flex items-center gap-1 flex-shrink-0 px-3 py-3 border-b-2 cursor-pointer transition-all ${
              w.id === activeId ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
            onClick={() => setActiveId(w.id)}
          >
            {editingId === w.id ? (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                  className="w-24 text-xs border border-slate-300 rounded px-1 py-0.5 focus:outline-none"
                  autoFocus
                />
                <button onClick={commitRename} className="text-emerald-500"><Check size={12} /></button>
              </div>
            ) : (
              <>
                <span
                  className="text-xs font-bold whitespace-nowrap"
                  onDoubleClick={() => { setEditingId(w.id); setEditName(w.name); }}
                >
                  {w.name}
                </span>
                {watchlists.length > 1 && w.id === activeId && (
                  <button
                    onClick={e => { e.stopPropagation(); removeWatchlist(w.id); }}
                    className="text-slate-300 hover:text-rose-400 ml-1"
                  >
                    <X size={10} />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        <button onClick={addWatchlist} className="flex-shrink-0 px-3 py-3 text-slate-400 hover:text-indigo-600 transition-colors">
          <Plus size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-slate-100 relative" ref={searchRef}>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <Search size={14} className="text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            placeholder="Search stocks…"
            className="flex-1 text-xs bg-transparent focus:outline-none text-slate-700 placeholder-slate-400"
          />
          {search && (
            <button onClick={() => { setSearch(''); setSearchResults([]); setShowSearch(false); }}>
              <X size={12} className="text-slate-400" />
            </button>
          )}
        </div>

        {/* Search dropdown */}
        {showSearch && searchResults.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto">
            {searchResults.map(s => {
              const inList = activeList?.symbols.some(x => x.symbol === s.symbol);
              return (
                <button
                  key={s.symbol}
                  onClick={() => addSymbol(s)}
                  disabled={inList}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors ${inList ? 'opacity-40 cursor-default' : ''}`}
                >
                  <div>
                    <p className="text-xs font-bold text-slate-800">{s.symbol}</p>
                    <p className="text-[10px] text-slate-400">{s.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">₹{(s.basePrice || 0).toLocaleString('en-IN')}</span>
                    {inList ? <span className="text-[10px] text-slate-400">Added</span> : <Plus size={14} className="text-indigo-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick order modal */}
      {quickOrder && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setQuickOrder(null)}
        >
          <div onClick={e => e.stopPropagation()}>
            <OrderTicket
              symbol={quickOrder.symbol}
              ltp={quickOrder.ltp}
              initialSide={quickOrder.initialSide}
              showBulk={false}
              onClose={() => setQuickOrder(null)}
              onSuccess={() => setTimeout(() => setQuickOrder(null), 1500)}
            />
          </div>
        </div>
      )}

      {/* Symbol rows */}
      <div className="max-h-[420px] overflow-y-auto">
        {symbols.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">Search and add symbols above</div>
        ) : symbols.map((s, idx) => {
          const data = marketDataMap?.[s.symbol] || {};
          const price = data.price || s.basePrice || 0;
          const pct = data.pct ?? data.changePct ?? 0;
          const vol = data.volume;
          const isFav = favorites.has(s.symbol);
          const isSelected = selectedSymbol === s.symbol;
          const nearUpper = data.circuitUpper && price >= data.circuitUpper * 0.98;
          const nearLower = data.circuitLower && price <= data.circuitLower * 1.02;

          return (
            <div
              key={s.symbol}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => onSymbolSelect?.(s.symbol)}
              className={`group flex items-center gap-2 px-3 py-3 border-b border-slate-50 cursor-pointer transition-all select-none ${
                isSelected ? 'bg-indigo-50/50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50'
              } ${dragIdx === idx ? 'opacity-40' : ''} ${dragOverIdx === idx && dragIdx !== idx ? 'border-t-2 border-t-indigo-400' : ''}`}
            >
              <div className="text-slate-200 cursor-grab active:cursor-grabbing flex-shrink-0">
                <GripVertical size={14} />
              </div>

              <button
                onClick={e => { e.stopPropagation(); toggleFavorite(s.symbol); }}
                className={`flex-shrink-0 transition-colors ${isFav ? 'text-yellow-400' : 'text-slate-200 hover:text-yellow-300'}`}
              >
                <Star size={12} fill={isFav ? 'currentColor' : 'none'} />
              </button>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs text-slate-900 truncate">{s.symbol}</p>
                <p className="text-[10px] text-slate-400 flex items-center gap-1 flex-wrap">
                  <span>{s.type}</span>
                  {vol !== undefined && <span className="text-slate-300">• {fmtVol(vol)}</span>}
                  {nearUpper && <span className="text-rose-500 font-bold">• UPR FREEZE</span>}
                  {nearLower && <span className="text-emerald-600 font-bold">• LWR FREEZE</span>}
                </p>
              </div>

              {/* Quick BUY/SELL — visible on hover, replaces price on hover via group */}
              <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setQuickOrder({ symbol: s.symbol, ltp: price, initialSide: 'BUY' })}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black px-2 py-1 rounded-lg transition-colors"
                >B</button>
                <button
                  onClick={() => setQuickOrder({ symbol: s.symbol, ltp: price, initialSide: 'SELL' })}
                  className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black px-2 py-1 rounded-lg transition-colors"
                >S</button>
              </div>

              <div className="group-hover:hidden text-right flex-shrink-0">
                <p className={`text-xs font-mono font-bold ${pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className={`text-[10px] font-bold ${pct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                </p>
              </div>

              <button
                onClick={e => { e.stopPropagation(); removeSymbol(s.symbol); }}
                className="flex-shrink-0 text-slate-200 hover:text-rose-400 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
