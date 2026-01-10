import { useEffect, useState } from "react";

const LivePrice = () => {
  const [price, setPrice] = useState(null);
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    const ws = new WebSocket("ws://13.60.97.164:5000");

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // ✅ Only handle price updates
      if (data.type === "PRICE_UPDATE") {
        setPrice(data);
      }
    };

    ws.onerror = (err) => {
      console.error("❌ WebSocket error", err);
      setStatus("error");
    };

    ws.onclose = () => {
      console.log("❌ WebSocket disconnected");
      setStatus("closed");
    };

    return () => ws.close();
  }, []);

  return (
    <div className="flex items-center gap-4 p-3 bg-slate-900 rounded-xl border border-slate-700">
      <span className="text-xs text-gray-400">
        WS: {status}
      </span>

      {price ? (
        <>
          <span className="text-lg font-semibold text-white">
            {price.symbol}
          </span>
          <span className="text-green-400 text-xl font-bold">
            ${price.price}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(price.time).toLocaleTimeString()}
          </span>
        </>
      ) : (
        <span className="text-gray-400">Waiting for price…</span>
      )}
    </div>
  );
};

export default LivePrice;

