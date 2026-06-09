'use strict';
const express = require('express');
const router  = express.Router();
const hc      = require('../controllers/historical.controller');

// GET /api/historical/summary   — storage stats per symbol/interval
router.get('/summary', (req, res) => hc.getSummary(req, res));

// POST /api/historical/ingest   — manual trigger for a date range
router.post('/ingest', (req, res) => hc.triggerIngest(req, res));

// GET /api/historical/:symbol   — query candles from DuckDB
router.get('/:symbol', (req, res) => hc.getCandles(req, res));

module.exports = router;
