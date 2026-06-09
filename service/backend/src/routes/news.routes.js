'use strict';
const router = require('express').Router();
const ctrl = require('../controllers/news.controller');

router.get('/',                  ctrl.getNews);
router.get('/earnings',          ctrl.getEarnings);
router.get('/economic',          ctrl.getEconomic);
router.get('/corporate-actions', ctrl.getCorporateActions);

module.exports = router;
