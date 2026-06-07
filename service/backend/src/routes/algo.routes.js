'use strict';
const express = require('express');
const router  = express.Router();
const algoController = require('../controllers/algo.controller');

// POST /api/algo/start — attach condition, start evaluating
router.post('/start', (req, res) => algoController.start(req, res));

// POST /api/algo/stop/:token — detach + stop
router.post('/stop/:token', (req, res) => algoController.stop(req, res));

// PATCH /api/algo/:token/pause — toggle isActive
router.patch('/:token/pause', (req, res) => algoController.togglePause(req, res));

// GET /api/algo/:token/status — trades, pnl, logs, position
router.get('/:token/status', (req, res) => algoController.status(req, res));

// GET /api/algo/list — all running algos
router.get('/list', (req, res) => algoController.list(req, res));

module.exports = router;
