const router = require('express').Router();
const ctrl   = require('../controllers/riskGuard.controller');

router.get('/status',           ctrl.getStatus.bind(ctrl));
router.post('/configure',       ctrl.configure.bind(ctrl));
router.post('/trade',           ctrl.recordTrade.bind(ctrl));
router.post('/reset',           ctrl.resetDay.bind(ctrl));
router.get('/position/:symbol', ctrl.getPositionSettings.bind(ctrl));
router.post('/position/:symbol',ctrl.setPositionSettings.bind(ctrl));

module.exports = router;
