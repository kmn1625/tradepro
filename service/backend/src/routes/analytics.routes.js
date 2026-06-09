'use strict';
const router = require('express').Router();
const ctrl = require('../controllers/analytics.controller');

router.post('/summary', ctrl.summary);

module.exports = router;
