const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/screener.controller');

router.get('/gainers',        ctrl.gainers);
router.get('/losers',         ctrl.losers);
router.get('/volume-shockers',ctrl.volumeShockers);
router.get('/rsi',            ctrl.rsiScan);
router.get('/breakouts',      ctrl.breakouts);
router.get('/gaps',           ctrl.gaps);

module.exports = router;
