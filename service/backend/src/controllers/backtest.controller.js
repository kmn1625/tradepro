'use strict';

const backtestService = require('../services/backtest.service');
const { validate } = require('../config/conditionSchema');

const backtestController = {

  // POST /api/backtest/run
  // Body: strategyConfig (see backtest.service.js for shape)
  async run(req, res) {
    const config = req.body;

    if (!config || !config.underlying || !config.dateRange) {
      return res.status(400).json({ error: 'Missing required fields: underlying, dateRange' });
    }

    if (config.entry && !validate(config.entry)) {
      return res.status(400).json({ error: 'Invalid entry condition schema' });
    }
    if (config.exit && !validate(config.exit)) {
      return res.status(400).json({ error: 'Invalid exit condition schema' });
    }

    try {
      const result = await backtestService.run(config);
      res.json(result);
    } catch (err) {
      // Distinguish "not yet built" from real errors
      if (err.message.includes('not yet implemented')) {
        return res.status(501).json({
          error: 'Backtest engine not yet available',
          detail: err.message,
          status: 'COMING_SOON',
        });
      }
      res.status(500).json({ error: err.message });
    }
  },

  // POST /api/backtest/metrics
  // Body: { trades: [...] } — compute metrics from pre-computed trade list
  metrics(req, res) {
    const { trades } = req.body;
    if (!Array.isArray(trades)) {
      return res.status(400).json({ error: 'trades must be an array' });
    }
    const result = backtestService.computeMetrics(trades);
    res.json(result);
  },
};

module.exports = backtestController;
