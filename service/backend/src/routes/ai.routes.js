'use strict';
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');

// POST /api/ai/condition — parse plain English → condition JSON
router.post('/condition',       (req, res) => aiController.parseCondition(req, res));

// GET /api/ai/indicators — list supported indicators + operators
router.get('/indicators',       (req, res) => aiController.getIndicators(req, res));

// POST /api/ai/stock-summary — brief AI analysis of a symbol
router.post('/stock-summary',   (req, res) => aiController.stockSummary(req, res));

// POST /api/ai/portfolio — portfolio diversification + risk warnings
router.post('/portfolio',       (req, res) => aiController.portfolioAnalysis(req, res));

// POST /api/ai/scanner — breakout + trend detection from market data
router.post('/scanner',         (req, res) => aiController.scanner(req, res));

// POST /api/ai/trade-journal — analyze trade history for mistakes + patterns
router.post('/trade-journal',   (req, res) => aiController.tradeJournal(req, res));

module.exports = router;
