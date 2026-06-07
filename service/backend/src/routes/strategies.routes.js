'use strict';
const express = require('express');
const router = express.Router();
const strategiesController = require('../controllers/strategies.controller');

// POST /api/strategies — create strategy, returns generated token
router.post('/', (req, res) => strategiesController.createStrategy(req, res));

// GET /api/strategies — list all strategies
router.get('/', (req, res) => strategiesController.listStrategies(req, res));

// PATCH /api/strategies/:token — update fields (name, mode, capital, slippage, isActive)
router.patch('/:token', (req, res) => strategiesController.updateStrategy(req, res));

// DELETE /api/strategies/:token — remove strategy
router.delete('/:token', (req, res) => strategiesController.deleteStrategy(req, res));

module.exports = router;
