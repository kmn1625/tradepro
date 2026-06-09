import { useState, useEffect, useRef } from 'react';
import { User, X, LogOut, Wifi, WifiOff, Shield, Clock } from 'lucide-react';

export default function UserProfile({ user, wsStatus, feedStatus, onLogout }) {
  const [open, setOpen]         = useState(false);
  const [brokerStatus, setBrokerStatus] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(d => setBrokerStatus(d))
      .catch(() => setBrokerStatus({ loggedIn: false }));
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : user?.uid
      ? user.uid.slice(0, 2).toUpperCase()
      : 'AN';

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center hover:bg-indigo-500 transition-colors"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/60 z-[200] overflow-hidden">
          {/* Header */}
          <div className="bg-[#0f172a] px-5 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-black text-sm">
                {initials}
              </div>
              <div>
                <p className="text-white text-sm font-black">
                  {user?.email || user?.uid?.slice(0, 12) || 'Anonymous'}
                </p>
                <p className="text-slate-400 text-[10px]">
                  {user?.isAnonymous ? 'Guest session' : 'Authenticated'}
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {/* Status rows */}
          <div className="px-4 py-4 space-y-3">
            {/* WebSocket */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                {wsStatus === 'LIVE' ? <Wifi size={14} className="text-emerald-500" /> : <WifiOff size={14} className="text-amber-400" />}
                WebSocket
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${wsStatus === 'LIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {wsStatus}
              </span>
            </div>

            {/* Feed mode */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Shield size={14} className="text-indigo-400" />
                Feed Mode
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${feedStatus?.mode === 'live' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {(feedStatus?.mode || 'unknown').toUpperCase()}
              </span>
            </div>

            {/* Broker auth */}
            {brokerStatus !== null && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <User size={14} className="text-slate-400" />
                  Kotak Neo
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${brokerStatus.loggedIn ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {brokerStatus.loggedIn ? 'CONNECTED' : 'NOT LINKED'}
                </span>
              </div>
            )}

            {/* UID */}
            {user?.uid && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Clock size={14} className="text-slate-400" />
                  Session ID
                </div>
                <span className="text-[10px] font-mono text-slate-400">{user.uid.slice(0, 8)}…</span>
              </div>
            )}
          </div>

          {/* Logout */}
          <div className="px-4 pb-4">
            <button
              onClick={() => { onLogout?.(); setOpen(false); }}
              className="w-full flex items-center justify-center gap-2 border border-rose-200 text-rose-500 hover:bg-rose-50 rounded-xl py-2.5 text-sm font-bold transition-colors"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
