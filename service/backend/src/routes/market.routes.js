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

// Order management (M1/M2/M3/M4) + basket (M18) + bulk
router.post  ('/order',         marketController.placeOrder.bind(marketController));
router.post  ('/basket',        marketController.placeBasketOrder.bind(marketController));
router.post  ('/bulk',          marketController.placeBulkOrder.bind(marketController));
router.get   ('/orders',        marketController.listOrders.bind(marketController));
router.get   ('/order/:orderId',marketController.getOrderStatus.bind(marketController));
router.delete('/order/:orderId',marketController.cancelOrder.bind(marketController));
router.patch ('/order/:orderId',marketController.modifyOrder.bind(marketController));

module.exports = router;
