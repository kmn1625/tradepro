// market.routes.js
const express = require('express');
const router = express.Router();
const marketController = require('../controllers/market.controller');

router.get('/ping', (req, res) => res.json({ status: 'OK', service: 'Market API', timestamp: new Date().toISOString() }));

router.get('/quotes', marketController.getQuotes.bind(marketController));
router.get('/history/:symbol', marketController.getHistory.bind(marketController));
router.get('/search', marketController.searchSymbols.bind(marketController));
router.get('/depth/:symbol', marketController.getDepth.bind(marketController));
router.post('/indicators', marketController.getIndicators.bind(marketController));
router.post('/indicators/multi', marketController.getMultipleIndicators.bind(marketController));
router.post('/signals', marketController.getSignals.bind(marketController));

// POST /api/market/order — place options leg via Kotak Neo (or paper simulation)
router.post('/order', marketController.placeOrder.bind(marketController));

module.exports = router;
