'use strict';

const express = require('express');
const router  = express.Router();
const funds   = require('../controllers/funds.controller');

router.get('/balance',      (req, res) => funds.getBalance(req, res));
router.get('/ledger',       (req, res) => funds.getLedger(req, res));
router.post('/add',         (req, res) => funds.addFunds(req, res));
router.post('/withdraw',    (req, res) => funds.withdrawFunds(req, res));

module.exports = router;
