'use strict';
const router = require('express').Router();
const ctrl = require('../controllers/reports.controller');

router.post('/pnl',           ctrl.pnlReport);
router.post('/capital-gains', ctrl.capitalGains);
router.post('/contract-note', ctrl.contractNote);

module.exports = router;
