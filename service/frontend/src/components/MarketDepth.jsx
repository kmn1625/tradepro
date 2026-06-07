import React, { useEffect, useState, useRef } from 'react';

export default function MarketDepth({ symbol, wsRef }) {
  const [depth, setDepth] = useState(null);
  const listenerRef = useRef(null);

  useEffect(() => {
    if (!symbol || !wsRef?.current) return;

    const sendRequest = () => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'GET_DEPTH', symbol }));
      }
    };

    const handler = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      if (msg.type === 'DEPTH_UPDATE' && msg.symbol === symbol) setDepth(msg);
    };

    const ws = wsRef.current;
    ws.addEventListener('message', handler);
    listenerRef.current = handler;

    sendRequest();
    const timer = setInterval(sendRequest, 3000);

    return () => {
      ws.removeEventListener('message', handler);
      clearInterval(timer);
    };
  }, [symbol, wsRef]);

  if (!depth) {
    return <p className="text-center text-slate-400 text-xs py-4 animate-pulse">Loading depth…</p>;
  }

  const totalBidQty = depth.bids?.reduce((s, b) => s + b.qty, 0) || 1;
  const totalAskQty = depth.asks?.reduce((s, a) => s + a.qty, 0) || 1;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Bids */}
      <div>
        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
          <span>Qty</span><span>Bid</span>
        </div>
        {depth.bids?.map((b, i) => {
          const pct = (b.qty / totalBidQty) * 100;
          return (
            <div key={i} className="relative flex justify-between text-xs font-mono py-0.5 px-1 rounded overflow-hidden">
              <div
                className="absolute inset-y-0 right-0 bg-emerald-50"
                style={{ width: `${pct}%` }}
              />
              <span className="relative text-slate-500">{b.qty.toLocaleString()}</span>
              <span className="relative text-emerald-600 font-bold">{b.price.toFixed(2)}</span>
            </div>
          );
        })}
      </div>

      {/* Asks */}
      <div>
        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
          <span>Ask</span><span>Qty</span>
        </div>
        {depth.asks?.map((a, i) => {
          const pct = (a.qty / totalAskQty) * 100;
          return (
            <div key={i} className="relative flex justify-between text-xs font-mono py-0.5 px-1 rounded overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-rose-50"
                style={{ width: `${pct}%` }}
              />
              <span className="relative text-rose-600 font-bold">{a.price.toFixed(2)}</span>
              <span className="relative text-slate-500">{a.qty.toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      {/* Footer totals */}
      <div className="col-span-2 flex justify-between border-t border-slate-100 pt-2 mt-1">
        <div className="text-[10px] font-bold text-emerald-600">
          Total Bid: {totalBidQty.toLocaleString()}
        </div>
        <div className="text-[10px] font-bold text-rose-500">
          Total Ask: {totalAskQty.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
