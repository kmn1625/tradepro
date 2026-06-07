'use strict';

const crypto    = require('crypto');
const algoEngine = require('../services/algoEngine');
const { validate } = require('../config/conditionSchema');

const algoController = {

  // POST /api/algo/start
  // Body: { condition: { entry, exit }, symbol, interval, name }
  // Returns: { token, ... }
  start(req, res) {
    const { condition, symbol = 'NIFTY', interval = '5m', name = 'Unnamed' } = req.body || {};
    if (!condition?.entry || !condition?.exit) {
      return res.status(400).json({ error: 'condition.entry and condition.exit required' });
    }
    if (!validate(condition.entry) || !validate(condition.exit)) {
      return res.status(400).json({ error: 'Invalid condition schema — entry or exit node failed validation' });
    }

    const token = crypto.randomUUID();
    algoEngine.attach(token, { condition, symbol, interval });
    res.status(201).json({
      token,
      name,
      symbol,
      interval,
      status: 'RUNNING',
      message: 'Algo engine attached — evaluating conditions on each tick',
    });
  },

  // POST /api/algo/stop/:token
  stop(req, res) {
    const { token } = req.params;
    if (!algoEngine.isAttached(token)) {
      return res.status(404).json({ error: 'Algo not found', token });
    }
    algoEngine.detach(token);
    res.json({ token, status: 'STOPPED' });
  },

  // PATCH /api/algo/:token/pause  — toggle isActive without detaching
  togglePause(req, res) {
    const { token } = req.params;
    if (!algoEngine.isAttached(token)) {
      return res.status(404).json({ error: 'Algo not found', token });
    }
    const current = algoEngine.getStatus(token);
    algoEngine.setActive(token, !current.isActive);
    res.json({ token, isActive: !current.isActive });
  },

  // GET /api/algo/:token/status
  status(req, res) {
    const { token } = req.params;
    const s = algoEngine.getStatus(token);
    if (!s) return res.status(404).json({ error: 'Algo not found', token });
    res.json(s);
  },

  // GET /api/algo/list
  list(req, res) {
    res.json({ algos: algoEngine.listAll() });
  },
};

module.exports = algoController;
