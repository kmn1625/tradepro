const riskGuard = require('../services/riskGuard.service');

class RiskGuardController {
  getStatus(req, res) {
    try { res.json(riskGuard.getStatus()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  }

  configure(req, res) {
    try {
      const { maxLossPerDay, maxTradesPerDay, capitalProtectionPct } = req.body;
      res.json(riskGuard.configure({ maxLossPerDay, maxTradesPerDay, capitalProtectionPct }));
    } catch (e) { res.status(500).json({ error: e.message }); }
  }

  recordTrade(req, res) {
    try {
      const { pnl = 0 } = req.body;
      res.json(riskGuard.recordTrade(Number(pnl)));
    } catch (e) { res.status(500).json({ error: e.message }); }
  }

  resetDay(req, res) {
    try { res.json(riskGuard.resetDay()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  }

  setPositionSettings(req, res) {
    try {
      res.json(riskGuard.setPositionSettings(req.params.symbol, req.body));
    } catch (e) { res.status(500).json({ error: e.message }); }
  }

  getPositionSettings(req, res) {
    try {
      const s = riskGuard.getPositionSettings(req.params.symbol);
      if (!s) return res.status(404).json({ error: 'No settings for symbol' });
      res.json(s);
    } catch (e) { res.status(500).json({ error: e.message }); }
  }
}

module.exports = new RiskGuardController();
