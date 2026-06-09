import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Info } from 'lucide-react';

const ICONS = {
  ORDER_EXECUTED: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  SL_HIT:         { icon: AlertTriangle, color: 'text-rose-500',   bg: 'bg-rose-50'   },
  TARGET_HIT:     { icon: TrendingUp,   color: 'text-emerald-500', bg: 'bg-emerald-50' },
  MARGIN_ALERT:   { icon: AlertTriangle, color: 'text-amber-500',  bg: 'bg-amber-50'  },
  PRICE_ALERT:    { icon: TrendingDown, color: 'text-indigo-500',  bg: 'bg-indigo-50' },
  INFO:           { icon: Info,         color: 'text-slate-500',   bg: 'bg-slate-50'  },
};

let _notifyExternal = null;

export function pushNotification(type, title, body) {
  if (_notifyExternal) _notifyExternal({ type, title, body });
}

let _idSeq = 0;

export default function NotificationCenter({ wsRef }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const panelRef = useRef(null);

  const addNotification = useCallback((type, title, body) => {
    const id = ++_idSeq;
    const n = { id, type, title, body, time: Date.now(), read: false };

    setNotifications(prev => [n, ...prev].slice(0, 100));

    setToasts(prev => [...prev, { ...n }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  useEffect(() => {
    _notifyExternal = (n) => addNotification(n.type, n.title, n.body);
    return () => { _notifyExternal = null; };
  }, [addNotification]);

  // Listen to WS for server-pushed notification events
  useEffect(() => {
    const ws = wsRef?.current;
    if (!ws) return;

    const handler = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }

      if (msg.type === 'ORDER_EXECUTED') {
        addNotification('ORDER_EXECUTED', 'Order Executed', `${msg.side || ''} ${msg.symbol} @ ₹${msg.price}`);
      } else if (msg.type === 'SL_HIT') {
        addNotification('SL_HIT', 'Stop Loss Hit', `${msg.symbol} SL triggered @ ₹${msg.price}`);
      } else if (msg.type === 'TARGET_HIT') {
        addNotification('TARGET_HIT', 'Target Achieved', `${msg.symbol} target hit @ ₹${msg.price}`);
      } else if (msg.type === 'MARGIN_ALERT') {
        addNotification('MARGIN_ALERT', 'Margin Shortfall', msg.message || 'Add funds to avoid square-off');
      }
    };

    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [wsRef, addNotification]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const dismiss = (id) => setNotifications(prev => prev.filter(n => n.id !== id));

  return (
    <>
      {/* Toast stack */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => {
          const cfg = ICONS[t.type] || ICONS.INFO;
          const Icon = cfg.icon;
          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 ${cfg.bg} border border-slate-200 rounded-2xl px-4 py-3 shadow-xl shadow-slate-200/50 pointer-events-auto max-w-xs animate-in slide-in-from-right-4 duration-200`}
            >
              <Icon size={18} className={`${cfg.color} mt-0.5 flex-shrink-0`} />
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-800">{t.title}</p>
                <p className="text-xs text-slate-500 leading-snug">{t.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bell button + panel */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => { setOpen(v => !v); if (!open) markAllRead(); }}
          className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <Bell size={20} className="text-slate-500" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/60 z-[200] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="font-black text-sm text-slate-800">Notifications</span>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button onClick={() => setNotifications([])} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors">
                    Clear all
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-slate-300 text-sm font-bold">No notifications</div>
              ) : notifications.map(n => {
                const cfg = ICONS[n.type] || ICONS.INFO;
                const Icon = cfg.icon;
                return (
                  <div key={n.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-indigo-50/30' : ''}`}>
                    <Icon size={16} className={`${cfg.color} mt-0.5 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-800">{n.title}</p>
                      <p className="text-xs text-slate-500">{n.body}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">{new Date(n.time).toLocaleTimeString('en-IN')}</p>
                    </div>
                    <button onClick={() => dismiss(n.id)} className="text-slate-300 hover:text-slate-500 flex-shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
