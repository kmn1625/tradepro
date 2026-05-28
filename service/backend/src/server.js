// server.js
console.log("Starting NeoTrade backend...");

const http = require("http");
const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/* =========================
   Middleware
========================= */

app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));

app.use(express.json());

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

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on("connection", (ws) => {
  console.log("WebSocket client connected");

  ws.send(JSON.stringify({ type: "CONNECTED", message: "WebSocket connection established" }));

  ws.on("close", () => console.log("WebSocket client disconnected"));
  ws.on("error", (err) => console.error("WebSocket error:", err));
});

/* =========================
   LIVE FEED — Kotak Neo WebSocket
   Replaces mock tick generator. Real OHLC ticks from Kotak streaming API.
   Start feed after server is listening so broadcast() is ready.
========================= */

const kotakFeedService = require('./services/kotakFeed.service');

/* =========================
   Start Server
========================= */

server.listen(PORT, "0.0.0.0", () => {
  console.log(`NeoTrade Backend started on port ${PORT}`);
  console.log(`API:    http://localhost:${PORT}/api`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`WS:     ws://localhost:${PORT}`);
  kotakFeedService.startFeed(broadcast);
});

module.exports = app;
