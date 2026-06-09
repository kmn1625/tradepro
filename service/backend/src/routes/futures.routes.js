const router = require('express').Router();
const ctrl   = require('../controllers/futures.controller');

router.get('/',            ctrl.getContracts.bind(ctrl));
router.get('/expiries',    ctrl.getExpiries.bind(ctrl));
router.get('/underlyings', ctrl.getUnderlyings.bind(ctrl));

module.exports = router;
