'use strict';
const express = require('express');
const router = express.Router();
const backtestController = require('../controllers/backtest.controller');

// POST /api/backtest/run
router.post('/run', (req, res) => backtestController.run(req, res));

// POST /api/backtest/metrics
router.post('/metrics', (req, res) => backtestController.metrics(req, res));

module.exports = router;
