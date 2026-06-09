'use strict';

// Historical data REST API controller (P4-R06)
// Routes:
//   GET  /api/historical/:symbol     — query candles from DuckDB
//   GET  /api/historical/summary     — storage summary per symbol/interval
//   POST /api/historical/ingest      — manual ingest trigger (range-based)

const historicalDb     = require('../services/historicalDb.service');
const ingestCron       = require('../services/ingestCron');
const contractRegistry = require('../services/contractRegistry');

const historicalController = {

  // GET /api/historical/:symbol?from=&to=&interval=&limit=
  // from/to: ISO date string or epoch ms (defaults: last 7 days)
  // interval: 1m | 5m | 1d  (default: 1m)
  // limit: max rows returned (default 2000, max 10000)
  async getCandles(req, res) {
    const { symbol } = req.params;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });

    const interval = req.query.interval || '1m';
    const limit    = Math.min(parseInt(req.query.limit, 10) || 2000, 10_000);

    const nowMs   = Date.now();
    const fromMs  = req.query.from
      ? (isNaN(req.query.from) ? new Date(req.query.from).getTime() : parseInt(req.query.from, 10))
      : nowMs - 7 * 86_400_000;
    const toMs    = req.query.to
      ? (isNaN(req.query.to)   ? new Date(req.query.to).getTime()   : parseInt(req.query.to,   10))
      : nowMs;

    if (isNaN(fromMs) || isNaN(toMs)) {
      return res.status(400).json({ error: 'Invalid from/to date' });
    }

    try {
      await historicalDb.init();
      if (!historicalDb.isReady()) {
        return res.status(503).json({ error: 'Historical database not ready', hint: 'Run backfill first — see scripts/backfill.js' });
      }

      const rows = await historicalDb.queryCandles(symbol.toUpperCase(), interval, fromMs, toMs, limit);
      // DuckDB returns BIGINT columns as BigInt — convert for JSON serialization
      const out = rows.map(r => ({
        ts:  Number(r.ts),
        o:   r.o,
        h:   r.h,
        l:   r.l,
        c:   r.c,
        vol: Number(r.vol),
        oi:  Number(r.oi),
      }));
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // GET /api/historical/summary
  async getSummary(req, res) {
    try {
      await historicalDb.init();
      if (!historicalDb.isReady()) {
        return res.json({ ready: false, summary: [] });
      }
      const rawSummary = await historicalDb.getSummary();
      const summary = rawSummary.map(r => ({
        symbol:   r.symbol,
        interval: r.interval,
        candles:  Number(r.candles),
        first_ts: Number(r.first_ts),
        last_ts:  Number(r.last_ts),
      }));
      res.json({ ready: true, summary });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // POST /api/historical/ingest
  // Body: { symbol, from, to, interval }
  // Manually triggers an ingest for a specific date range.
  // Requires Angel One credentials configured in .env.
  async triggerIngest(req, res) {
    const { symbol, from, to, interval = '1m' } = req.body || {};
    if (!symbol || !from || !to) {
      return res.status(400).json({ error: 'symbol, from, to required (YYYY-MM-DD HH:mm format)' });
    }

    try {
      const result = await ingestCron.ingestRange(symbol, from, to, interval);
      res.json({ ok: true, ...result });
    } catch (err) {
      if (err.message.includes('not configured')) {
        return res.status(503).json({
          error: 'Angel One not configured',
          hint: 'Set ANGEL_API_KEY, ANGEL_CLIENT_ID, ANGEL_PASSWORD, ANGEL_TOTP_SECRET in .env',
        });
      }
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = historicalController;
