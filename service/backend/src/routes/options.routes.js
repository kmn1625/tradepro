'use strict';
const express = require('express');
const router = express.Router();
const optionsController = require('../controllers/options.controller');

// GET /api/options/chain?symbol=NIFTY&expiry=2025-06-26
router.get('/chain', (req, res) => optionsController.getChain(req, res));

// GET /api/options/expiries?symbol=NIFTY
router.get('/expiries', (req, res) => optionsController.getExpiries(req, res));

module.exports = router;
