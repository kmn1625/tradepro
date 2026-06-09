const screener = require('../services/screener.service');

exports.gainers       = (req, res) => res.json(screener.getGainers(parseInt(req.query.n) || 10));
exports.losers        = (req, res) => res.json(screener.getLosers(parseInt(req.query.n) || 10));
exports.volumeShockers= (req, res) => res.json(screener.getVolumeShockers(parseInt(req.query.n) || 10));
exports.rsiScan       = (req, res) => {
  const { min, max, n } = req.query;
  res.json(screener.getRsiScan({
    min: min !== undefined ? parseFloat(min) : 0,
    max: max !== undefined ? parseFloat(max) : 100,
    n:   n   !== undefined ? parseInt(n)     : 20,
  }));
};
exports.breakouts     = (req, res) => res.json(screener.getBreakouts(parseInt(req.query.n) || 10));
exports.gaps          = (req, res) => res.json(screener.getGaps(parseInt(req.query.n) || 10));
