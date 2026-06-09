import { useEffect, useRef, useCallback, useState } from "react";
import { createChart, CrosshairMode, CandlestickSeries, LineSeries } from "lightweight-charts";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:5000";

// ── Indicator calculations (frontend, on loaded candle data) ─────────────────

function calcEMA(closes, period) {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = Array(period - 1).fill(null);
  result.push(ema);
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcSMA(closes, period) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    return closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
}

function calcRSI(closes, period = 14) {
  const result = Array(period).fill(null);
  if (closes.length < period + 1) return result;

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses += -d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  const rsiAt = (ag, al) => al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  result.push(rsiAt(avgGain, avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    result.push(rsiAt(avgGain, avgLoss));
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────

const INDICATOR_OPTIONS = [
  { id: 'ema20',  label: 'EMA 20',  color: '#f59e0b' },
  { id: 'ema50',  label: 'EMA 50',  color: '#8b5cf6' },
  { id: 'sma20',  label: 'SMA 20',  color: '#06b6d4' },
  { id: 'rsi',    label: 'RSI 14',  color: '#10b981' },
];

const LS_KEY = (symbol) => `candle_hlines_${symbol}`;

const INTERVALS = ['1m', '5m', '15m', '1h', '1d'];

const CandleChart = ({ symbol, interval: intervalProp = "5m", height = 320 }) => {
  const [interval, setInterval]             = useState(intervalProp);
  const [activeIndicators, setActiveIndicators] = useState(new Set(['ema20']));
  const [drawMode, setDrawMode]             = useState(false);  // horizontal line draw mode
  const [hlines, setHlines]                 = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY(symbol)) || '[]'); } catch { return []; }
  });
  const hlinesSeriesRef = useRef({});  // price → PriceLine handle

  const mainRef    = useRef(null);
  const rsiRef     = useRef(null);

  const mainChartRef    = useRef(null);
  const candleSeriesRef = useRef(null);
  const emaSeriesRefs   = useRef({});  // id → series
  const rsiChartRef     = useRef(null);
  const rsiSeriesRef    = useRef(null);

  const lastCandleRef = useRef(null);
  const candleDataRef = useRef([]);

  const toSec = (t) => (typeof t === "number" && t > 1e10 ? Math.floor(t / 1000) : t);

  const showRSI = activeIndicators.has('rsi');

  // ── Apply indicator overlays after candle data loads ──────────────────────
  const applyOverlays = useCallback((candles) => {
    if (!mainChartRef.current || !candles.length) return;
    const closes = candles.map(c => c.close);
    const times  = candles.map(c => c.time);

    const toSeries = (values) =>
      values
        .map((v, i) => v !== null ? { time: times[i], value: parseFloat(v.toFixed(2)) } : null)
        .filter(Boolean);

    // Remove old overlay series
    Object.values(emaSeriesRefs.current).forEach(s => {
      try { mainChartRef.current.removeSeries(s); } catch (_) {}
    });
    emaSeriesRefs.current = {};

    INDICATOR_OPTIONS.filter(o => o.id !== 'rsi').forEach(opt => {
      if (!activeIndicators.has(opt.id)) return;

      let values;
      if (opt.id === 'ema20') values = calcEMA(closes, 20);
      else if (opt.id === 'ema50') values = calcEMA(closes, 50);
      else if (opt.id === 'sma20') values = calcSMA(closes, 20);
      else return;

      const s = mainChartRef.current.addSeries(LineSeries, {
        color: opt.color,
        lineWidth: 1.5,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
      });
      s.setData(toSeries(values));
      emaSeriesRefs.current[opt.id] = s;
    });

    // RSI chart
    if (showRSI && rsiChartRef.current && rsiSeriesRef.current) {
      const rsiValues = calcRSI(closes, 14);
      rsiSeriesRef.current.setData(toSeries(rsiValues));
    }
  }, [activeIndicators, showRSI]);

  // ── Load candle history ───────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!candleSeriesRef.current) return;
    try {
      const res = await fetch(
        `/api/market/history/${encodeURIComponent(symbol)}?interval=${interval}&limit=200`
      );
      if (!res.ok) return;
      const candles = await res.json();
      if (!Array.isArray(candles) || !candles.length) return;

      const seen = new Set();
      const sorted = candles
        .map(c => ({
          time:  toSec(c.time),
          open:  parseFloat(c.open),
          high:  parseFloat(c.high),
          low:   parseFloat(c.low),
          close: parseFloat(c.close),
        }))
        .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
        .sort((a, b) => a.time - b.time);

      candleSeriesRef.current.setData(sorted);
      lastCandleRef.current = sorted[sorted.length - 1] || null;
      candleDataRef.current = sorted;
      mainChartRef.current?.timeScale().fitContent();
      applyOverlays(sorted);
    } catch (err) {
      console.error("CandleChart: history load failed", err);
    }
  }, [symbol, interval, applyOverlays]);

  // ── Create main chart ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mainRef.current) return;

    const chart = createChart(mainRef.current, {
      width:  mainRef.current.clientWidth,
      height,
      layout: { background: { color: "#0f172a" }, textColor: "#94a3b8" },
      grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1e293b" },
      timeScale: { borderColor: "#1e293b", timeVisible: true, secondsVisible: false },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor:        "#10b981",
      downColor:      "#f43f5e",
      borderUpColor:  "#10b981",
      borderDownColor:"#f43f5e",
      wickUpColor:    "#10b981",
      wickDownColor:  "#f43f5e",
    });

    mainChartRef.current    = chart;
    candleSeriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (mainRef.current) chart.applyOptions({ width: mainRef.current.clientWidth });
    });
    ro.observe(mainRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      mainChartRef.current    = null;
      candleSeriesRef.current = null;
      emaSeriesRefs.current   = {};
    };
  }, [height]);

  // ── Create RSI chart ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!showRSI || !rsiRef.current) return;

    const chart = createChart(rsiRef.current, {
      width:  rsiRef.current.clientWidth,
      height: 120,
      layout: { background: { color: "#0f172a" }, textColor: "#94a3b8" },
      grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1e293b", scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: "#1e293b", timeVisible: false, visible: false },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(LineSeries, {
      color: '#10b981',
      lineWidth: 1.5,
      priceLineVisible: false,
    });

    rsiChartRef.current  = chart;
    rsiSeriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (rsiRef.current) chart.applyOptions({ width: rsiRef.current.clientWidth });
    });
    ro.observe(rsiRef.current);

    // Apply existing data if available
    if (candleDataRef.current.length) applyOverlays(candleDataRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      rsiChartRef.current  = null;
      rsiSeriesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRSI]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Horizontal lines (persist per symbol) ────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    // Remove all old lines
    Object.values(hlinesSeriesRef.current).forEach(pl => {
      try { candleSeriesRef.current?.removePriceLine(pl); } catch (_) {}
    });
    hlinesSeriesRef.current = {};
    // Re-add from hlines state
    hlines.forEach(({ price, color, label }) => {
      try {
        const pl = candleSeriesRef.current.createPriceLine({
          price,
          color: color || '#6366f1',
          lineWidth: 1,
          lineStyle: 2, // dashed
          axisLabelVisible: true,
          title: label || '',
        });
        hlinesSeriesRef.current[price] = pl;
      } catch (_) {}
    });
    localStorage.setItem(LS_KEY(symbol), JSON.stringify(hlines));
  }, [hlines, symbol]);

  const addHLine = useCallback((price) => {
    const rounded = parseFloat(price.toFixed(2));
    setHlines(prev => {
      if (prev.find(l => Math.abs(l.price - rounded) < 0.1)) return prev;
      return [...prev, { price: rounded, color: '#6366f1', label: '' }];
    });
  }, []);

  const removeHLine = (price) => {
    setHlines(prev => prev.filter(l => Math.abs(l.price - price) >= 0.1));
  };

  // Re-apply overlays when activeIndicators change
  useEffect(() => {
    if (candleDataRef.current.length) applyOverlays(candleDataRef.current);
  }, [applyOverlays]);

  // ── Live WS feed ──────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "CANDLE_UPDATE" && msg.symbol === symbol && msg.interval === interval) {
          const candle = {
            time:  toSec(msg.time),
            open:  msg.open, high: msg.high, low: msg.low, close: msg.close,
          };
          if (candleSeriesRef.current) {
            candleSeriesRef.current.update(candle);
            lastCandleRef.current = candle;
            const idx = candleDataRef.current.findIndex(c => c.time === candle.time);
            if (idx >= 0) candleDataRef.current[idx] = candle;
            else candleDataRef.current.push(candle);
          }
        }

        if (msg.type === "PRICE_UPDATE") {
          const price = parseFloat(msg.price);
          const last  = lastCandleRef.current;
          if (last && candleSeriesRef.current) {
            const updated = {
              ...last,
              high:  Math.max(last.high,  price),
              low:   Math.min(last.low,   price),
              close: price,
            };
            candleSeriesRef.current.update(updated);
            lastCandleRef.current = updated;
          }
        }
      } catch (_) {}
    };

    return () => ws.close();
  }, [symbol, interval]);

  const toggleIndicator = (id) => {
    setActiveIndicators(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleChartClick = useCallback((e) => {
    if (!drawMode || !mainChartRef.current || !candleSeriesRef.current) return;
    // Convert y pixel to price via coordinateToPrice
    const rect = mainRef.current.getBoundingClientRect();
    const yPx  = e.clientY - rect.top;
    const price = mainChartRef.current.priceScale('right').coordinateToPrice(yPx);
    if (price !== null && price > 0) addHLine(price);
  }, [drawMode, addHLine]);

  return (
    <div className="w-full rounded-xl overflow-hidden bg-[#0f172a]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 flex-wrap gap-1">
        {/* Interval selector */}
        <div className="flex gap-1">
          {INTERVALS.map(iv => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={`px-2 py-1 rounded text-[10px] font-black transition-colors ${
                interval === iv ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-700'
              }`}
            >
              {iv.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {/* Indicator toggles */}
          {INDICATOR_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => toggleIndicator(opt.id)}
              className={`px-2 py-1 rounded text-[10px] font-black transition-colors ${
                activeIndicators.has(opt.id)
                  ? 'text-white'
                  : 'text-slate-600 hover:text-slate-400'
              }`}
              style={activeIndicators.has(opt.id) ? { backgroundColor: opt.color + '33', color: opt.color } : {}}
            >
              {opt.label}
            </button>
          ))}

          {/* Draw tool separator */}
          <span className="w-px h-4 bg-slate-700 mx-1" />

          {/* Horizontal line draw toggle */}
          <button
            onClick={() => setDrawMode(v => !v)}
            title="Draw horizontal line"
            className={`px-2 py-1 rounded text-[10px] font-black transition-colors ${
              drawMode ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            H-Line
          </button>

          {/* Clear lines */}
          {hlines.length > 0 && (
            <button
              onClick={() => setHlines([])}
              title="Clear all drawn lines"
              className="px-2 py-1 rounded text-[10px] font-black text-slate-700 hover:text-rose-400 transition-colors"
            >
              ✕{hlines.length}
            </button>
          )}
        </div>
      </div>

      {/* Main chart */}
      <div
        ref={mainRef}
        className="w-full"
        style={{ height, cursor: drawMode ? 'crosshair' : 'default' }}
        onClick={handleChartClick}
      />

      {/* RSI sub-panel */}
      {showRSI && (
        <div className="border-t border-slate-800">
          <div className="px-3 py-1 flex items-center gap-2">
            <span className="text-[10px] font-black text-emerald-500">RSI (14)</span>
            <span className="text-[10px] text-slate-600">— 30 / 70 levels</span>
          </div>
          <div ref={rsiRef} className="w-full" style={{ height: 120 }} />
        </div>
      )}
    </div>
  );
};

export default CandleChart;
