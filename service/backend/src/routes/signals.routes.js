'use strict';
const express = require('express');
const router = express.Router();
const signalsController = require('../controllers/signals.controller');

// POST /api/signals/tradingview
// Body (JSON): { token, action, symbol, quantity? }
// Auth: token is looked up in Firestore signal_strategies collection
router.post('/tradingview', (req, res) => signalsController.receiveTradingView(req, res));

// POST /api/signals/chartink
// Body (form / JSON): { stocks, trigger_prices, triggered_at?, scan_name? }
// No auth — Chartink does not send auth headers; signals are logged only (no execution)
router.post('/chartink', (req, res) => signalsController.receiveChartink(req, res));

// GET /api/signals/portfolio/:strategyId — return paper portfolio state
router.get('/portfolio/:strategyId', signalsController.getPortfolio.bind(signalsController));

module.exports = router;
