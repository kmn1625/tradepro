// market.routes.js
const express = require('express');
const router = express.Router();
const marketController = require('../controllers/market.controller');

router.get('/ping', (req, res) => res.json({ status: 'OK', service: 'Market API', timestamp: new Date().toISOString() }));

router.get('/quotes', marketController.getQuotes.bind(marketController));
router.get('/history/:symbol', marketController.getHistory.bind(marketController));
router.post('/indicators', marketController.getIndicators.bind(marketController));
router.post('/indicators/multi', marketController.getMultipleIndicators.bind(marketController));
router.post('/signals', marketController.getSignals.bind(marketController));

module.exports = router;
