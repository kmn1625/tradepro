// backend/src/server.js

console.log("🚀 Starting NeoTrade backend...");

const http = require("http");
const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables FIRST
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const authRoutes = require("./routes/auth.routes");

app.use("/api/auth", authRoutes);


/* =========================
   Middleware
========================= */

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);

app.use(express.json());

/* =========================
   Health Check
========================= */

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "NeoTrade Backend is running!",
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   Routes
========================= */

try {
  const marketRoutes = require("./routes/market.routes");
  app.use("/api/market", marketRoutes);
  console.log("✅ Market routes loaded");
} catch (err) {
  console.error("❌ Failed to load market routes");
  console.error(err);
  process.exit(1);
}

/* =========================
   Error Handler
========================= */

app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

/* =========================
   HTTP + WebSocket Server
========================= */

// IMPORTANT: create HTTP server from express
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("🔌 WebSocket client connected");

  ws.send(
    JSON.stringify({
      type: "CONNECTED",
      message: "WebSocket connection established",
    })
  );

  ws.on("close", () => {
    console.log("❌ WebSocket client disconnected");
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});

/* =========================
   LIVE DATA BROADCAST
========================= */

// TEMP: mock live price (will replace with real market feed)
setInterval(() => {
  const livePrice = {
    type: "PRICE_UPDATE",
    symbol: "AAPL",
    price: (250 + Math.random() * 10).toFixed(2),
    time: new Date().toISOString(),
  };

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(livePrice));
    }
  });
}, 1000);

/* =========================
   Start Server
========================= */

server.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 NeoTrade Backend Server Started   ║
╠════════════════════════════════════════╣
║  Port: ${PORT}
║  Env: ${process.env.NODE_ENV || "development"}
║  Time: ${new Date().toLocaleTimeString()}
╚════════════════════════════════════════╝
`);
  console.log(`📡 API:     http://localhost:${PORT}/api`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  console.log(`🔌 WS:      ws://localhost:${PORT}\n`);
});

module.exports = app;

