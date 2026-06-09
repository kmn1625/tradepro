// server.js
console.log("Starting NeoTrade backend...");

const http = require("http");
const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/* =========================
   Middleware
========================= */

app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));

app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
});
app.use('/api/', limiter);

/* =========================
   Routes
========================= */

const authRoutes = require("./routes/auth.routes");
app.use("/api/auth", authRoutes);

try {
  const marketRoutes = require("./routes/market.routes");
  app.use("/api/market", marketRoutes);
  console.log("Market routes loaded");
} catch (err) {
  console.error("Failed to load market routes:", err.message);
  process.exit(1);
}

try {
  const signalsRoutes = require('./routes/signals.routes');
  app.use('/api/signals', signalsRoutes);
  console.log('Signals routes loaded');
} catch (err) {
  console.error('Failed to load signals routes:', err.message);
}

try {
  const strategiesRoutes = require('./routes/strategies.routes');
  app.use('/api/strategies', strategiesRoutes);
  console.log('Strategies routes loaded');
} catch (err) {
  console.error('Failed to load strategies routes:', err.message);
}

try {
  const optionsRoutes = require('./routes/options.routes');
  app.use('/api/options', optionsRoutes);
  console.log('Options routes loaded');
} catch (err) {
  console.error('Failed to load options routes:', err.message);
}

try {
  const backtestRoutes = require('./routes/backtest.routes');
  app.use('/api/backtest', backtestRoutes);
  console.log('Backtest routes loaded');
} catch (err) {
  console.error('Failed to load backtest routes:', err.message);
}

try {
  const aiRoutes = require('./routes/ai.routes');
  app.use('/api/ai', aiRoutes);
  console.log('AI routes loaded');
} catch (err) {
  console.error('Failed to load AI routes:', err.message);
}

try {
  const algoRoutes = require('./routes/algo.routes');
  app.use('/api/algo', algoRoutes);
  console.log('Algo routes loaded');
} catch (err) {
  console.error('Failed to load algo routes:', err.message);
}

try {
  const historicalRoutes = require('./routes/historical.routes');
  app.use('/api/historical', historicalRoutes);
  console.log('Historical routes loaded');
} catch (err) {
  console.error('Failed to load historical routes:', err.message);
}

try {
  const alertsRoutes = require('./routes/alerts.routes');
  app.use('/api/alerts', alertsRoutes);
  console.log('Alerts routes loaded');
} catch (err) {
  console.error('Failed to load alerts routes:', err.message);
}

try {
  const screenerRoutes = require('./routes/screener.routes');
  app.use('/api/screener', screenerRoutes);
  console.log('Screener routes loaded');
} catch (err) {
  console.error('Failed to load screener routes:', err.message);
}

try {
  const ipoRoutes = require('./routes/ipo.routes');
  app.use('/api/ipo', ipoRoutes);
  console.log('IPO routes loaded');
} catch (err) {
  console.error('Failed to load IPO routes:', err.message);
}

try {
  const analyticsRoutes = require('./routes/analytics.routes');
  app.use('/api/analytics', analyticsRoutes);
  console.log('Analytics routes loaded');
} catch (err) {
  console.error('Failed to load analytics routes:', err.message);
}

try {
  const reportsRoutes = require('./routes/reports.routes');
  app.use('/api/reports', reportsRoutes);
  console.log('Reports routes loaded');
} catch (err) {
  console.error('Failed to load reports routes:', err.message);
}

try {
  const newsRoutes = require('./routes/news.routes');
  app.use('/api/news', newsRoutes);
  console.log('News routes loaded');
} catch (err) {
  console.error('Failed to load news routes:', err.message);
}

try {
  const futuresRoutes = require('./routes/futures.routes');
  app.use('/api/futures', futuresRoutes);
  console.log('Futures routes loaded');
} catch (err) {
  console.error('Failed to load futures routes:', err.message);
}

try {
  const riskRoutes = require('./routes/riskGuard.routes');
  app.use('/api/risk', riskRoutes);
  console.log('Risk guard routes loaded');
} catch (err) {
  console.error('Failed to load risk guard routes:', err.message);
}

try {
  const fundsRoutes = require('./routes/funds.routes');
  app.use('/api/funds', fundsRoutes);
  console.log('Funds routes loaded');
} catch (err) {
  console.error('Failed to load funds routes:', err.message);
}

/* =========================
   Health Check
========================= */

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "NeoTrade Backend is running",
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   Error Handler
========================= */

app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

/* =========================
   HTTP + WebSocket Server
========================= */

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const marketDataService = require("./services/marketData.service");
const alertEngine = require('./services/alertEngine.service');
const screenerSvc = require('./services/screener.service');

function broadcast(data) {
  const msg = typeof data === 'string' ? data : JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
  // Hook price engines on every price tick
  if (data && typeof data === 'object' && data.type === 'PRICE_UPDATE') {
    alertEngine.checkPrice(data.symbol, data.price);
    screenerSvc.updatePrice(data.symbol, data.price, data.prevClose, data.volume);
  }
}

// Init engines with broadcast so they can fire WS events
alertEngine.init(broadcast);

// Declare before wss.on('connection') closure captures it
const kotakFeedService = require('./services/kotakFeed.service');

wss.on("connection", (ws) => {
  console.log("WebSocket client connected");

  ws.send(JSON.stringify({ type: "CONNECTED", message: "WebSocket connection established" }));
  ws.send(JSON.stringify(kotakFeedService.getStatus()));

  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.type === 'SUBSCRIBE_SYMBOLS' && Array.isArray(msg.symbols)) {
      kotakFeedService.addSymbols(msg.symbols);
    } else if (msg.type === 'GET_DEPTH' && msg.symbol) {
      const depth = marketDataService.getMarketDepth(msg.symbol);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'DEPTH_UPDATE', ...depth }));
      }
    }
  });

  ws.on("close", () => console.log("WebSocket client disconnected"));
  ws.on("error", (err) => console.error("WebSocket error:", err));
});

/* =========================
   Start Server
========================= */

server.listen(PORT, "0.0.0.0", async () => {
  console.log(`NeoTrade Backend started on port ${PORT}`);
  console.log(`API:    http://localhost:${PORT}/api`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`WS:     ws://localhost:${PORT}`);
  kotakFeedService.startFeed(broadcast);

  // Historical DB init (non-blocking — DuckDB opens in background)
  try {
    const historicalDb = require('./services/historicalDb.service');
    historicalDb.init().catch(err => console.warn('[HistoricalDB] init warning:', err.message));
  } catch { /* optional */ }

  // Daily ingestion cron — runs at 16:00 IST on weekdays
  try {
    const ingestCron = require('./services/ingestCron');
    ingestCron.start();
  } catch { /* optional */ }
});

module.exports = app;
