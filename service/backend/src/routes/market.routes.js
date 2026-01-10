// backend/src/routes/market.routes.js

const express = require("express");
const router = express.Router();

/**
 * @route   GET /api/market/ping
 * @desc    Market service health check
 */
router.get("/ping", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "Market API",
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route   GET /api/market/prices
 * @desc    Dummy market prices (placeholder)
 */
router.get("/prices", (req, res) => {
  res.status(200).json({
    symbol: "NIFTY",
    price: 22540.75,
    currency: "INR",
    source: "mock",
  });
});

module.exports = router;

