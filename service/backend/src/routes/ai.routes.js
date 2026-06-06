'use strict';
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');

// POST /api/ai/condition — parse plain English → condition JSON
router.post('/condition', (req, res) => aiController.parseCondition(req, res));

// GET /api/ai/indicators — list supported indicators + operators
router.get('/indicators', (req, res) => aiController.getIndicators(req, res));

module.exports = router;
