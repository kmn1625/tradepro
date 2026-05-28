import { useEffect, useRef, useCallback } from "react";
import { createChart, CrosshairMode, CandlestickSeries } from "lightweight-charts";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:5000";

const CandleChart = ({ symbol, interval = "5m", height = 320 }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const lastCandleRef = useRef(null);

  const toSec = (t) => (typeof t === "number" && t > 1e10 ? Math.floor(t / 1000) : t);

  // Fetch historical candles from backend
  const loadHistory = useCallback(async () => {
    if (!seriesRef.current) return;
    try {
      const res = await fetch(
        `/api/market/history/${encodeURIComponent(symbol)}?interval=${interval}&limit=200`
      );
      if (!res.ok) return;
      const candles = await res.json();
      if (!Array.isArray(candles) || candles.length === 0) return;

      const seen = new Set();
      const sorted = candles
        .map((c) => ({
          time: toSec(c.time),
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
        }))
        .filter((c) => {
          if (seen.has(c.time)) return false;
          seen.add(c.time);
          return true;
        })
        .sort((a, b) => a.time - b.time);

      seriesRef.current.setData(sorted);
      lastCandleRef.current = sorted[sorted.length - 1] || null;
      chartRef.current?.timeScale().fitContent();
    } catch (err) {
      console.error("CandleChart: history load failed", err);
    }
  }, [symbol, interval]);

  // Create chart once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: { background: { color: "#0f172a" }, textColor: "#94a3b8" },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1e293b" },
      timeScale: { borderColor: "#1e293b", timeVisible: true, secondsVisible: false },
    });

    // v5 API: addSeries(SeriesType, options)
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  // Reload history when symbol/interval changes
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Live WS feed: CANDLE_UPDATE merges OHLC, PRICE_UPDATE updates close tick
  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (
          msg.type === "CANDLE_UPDATE" &&
          msg.symbol === symbol &&
          msg.interval === interval
        ) {
          const candle = {
            time: toSec(msg.time),
            open: msg.open,
            high: msg.high,
            low: msg.low,
            close: msg.close,
          };
          if (seriesRef.current) {
            seriesRef.current.update(candle);
            lastCandleRef.current = candle;
          }
        }

        if (msg.type === "PRICE_UPDATE") {
          const price = parseFloat(msg.price);
          const last = lastCandleRef.current;
          if (last && seriesRef.current) {
            const updated = {
              ...last,
              high: Math.max(last.high, price),
              low: Math.min(last.low, price),
              close: price,
            };
            seriesRef.current.update(updated);
            lastCandleRef.current = updated;
          }
        }
      } catch (_) {}
    };

    return () => ws.close();
  }, [symbol, interval]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden"
      style={{ height }}
    />
  );
};

export default CandleChart;
