import { useEffect, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:5000";

const LivePrice = () => {
  const [price, setPrice] = useState(null);
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "PRICE_UPDATE") {
          setPrice(data);
        }
      } catch (_) {}
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("closed");

    return () => ws.close();
  }, []);

  const statusColor = status === "connected" ? "text-emerald-400" : status === "error" ? "text-rose-400" : "text-yellow-400";

  return (
    <div className="flex items-center gap-4 p-3 bg-slate-900 rounded-xl border border-slate-700">
      <span className={`text-xs font-bold uppercase ${statusColor}`}>
        WS: {status}
      </span>

      {price ? (
        <>
          <span className="text-sm font-bold text-slate-400">{price.symbol}</span>
          <span className="text-lg font-bold text-emerald-400 font-mono">
            ₹{parseFloat(price.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-xs text-slate-500">
            {new Date(price.time).toLocaleTimeString('en-IN')}
          </span>
        </>
      ) : (
        <span className="text-slate-500 text-sm">Waiting for price…</span>
      )}
    </div>
  );
};

export default LivePrice;
