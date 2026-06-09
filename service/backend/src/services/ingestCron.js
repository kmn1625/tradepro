'use strict';

// Daily historical data ingestion cron (P4-R05)
// Fires at 16:00 IST (10:30 UTC) on weekdays.
// Fetches yesterday's 1-min OHLCV from Angel One and upserts into DuckDB.

const angelOne      = require('./angelone.service');
const historicalDb  = require('./historicalDb.service');
const contractRegistry = require('./contractRegistry');

const TARGET_UTC_HOUR   = 10;
const TARGET_UTC_MINUTE = 30;

class IngestCron {
  constructor() {
    this._timer     = null;
    this._lastRun   = null;
    this._running   = false;
  }

  start() {
    if (this._timer) return;
    // Check every 60 seconds whether it's time to ingest
    this._timer = setInterval(() => this._tick(), 60_000);
    console.log('[IngestCron] started — daily ingest at 16:00 IST (10:30 UTC) on weekdays');
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  _tick() {
    const now = new Date();
    const utcH = now.getUTCHours();
    const utcM = now.getUTCMinutes();
    const isWeekday = contractRegistry.isTradingDay(now);

    if (!isWeekday) return;
    if (utcH !== TARGET_UTC_HOUR || utcM !== TARGET_UTC_MINUTE) return;

    // Run at most once per day
    const today = now.toISOString().slice(0, 10);
    if (this._lastRun === today) return;

    this._lastRun = today;
    this._ingest().catch(err => console.error('[IngestCron] ingest error:', err.message));
  }

  async _ingest() {
    if (this._running) return;
    this._running = true;
    console.log('[IngestCron] daily ingest started');

    try {
      await historicalDb.init();
      if (!historicalDb.isReady()) {
        console.warn('[IngestCron] DuckDB not ready — skipping');
        return;
      }
      if (!angelOne.isConfigured()) {
        console.warn('[IngestCron] Angel One not configured — skipping');
        return;
      }

      const { fromdate, todate } = contractRegistry.yesterdayRange();
      const contracts = contractRegistry.getIndexContracts();
      const angelInterval = contractRegistry.toAngelInterval('1m');

      for (const contract of contracts) {
        try {
          console.log(`[IngestCron] fetching ${contract.name} 1m ${fromdate} → ${todate}`);
          const candles = await angelOne.getCandleData(
            contract.exchange, contract.symboltoken, angelInterval, fromdate, todate
          );
          if (candles.length === 0) {
            console.log(`[IngestCron] ${contract.name}: no candles returned (holiday?)`);
            continue;
          }
          const inserted = await historicalDb.insertCandles(contract.name, '1m', candles);
          console.log(`[IngestCron] ${contract.name}: ${inserted}/${candles.length} candles inserted`);
        } catch (err) {
          console.error(`[IngestCron] ${contract.name} failed:`, err.message);
        }
      }
    } finally {
      this._running = false;
      console.log('[IngestCron] daily ingest complete');
    }
  }

  // Manual trigger for testing — ingest a specific date range.
  async ingestRange(indexName, fromdate, todate, interval = '1m') {
    await historicalDb.init();
    if (!historicalDb.isReady()) throw new Error('DuckDB not ready');
    if (!angelOne.isConfigured())  throw new Error('Angel One not configured');

    const contract = contractRegistry.getIndexToken(indexName);
    if (!contract) throw new Error(`Unknown index: ${indexName}`);

    const angelInterval = contractRegistry.toAngelInterval(interval);
    const candles = await angelOne.getCandleData(
      contract.exchange, contract.symboltoken, angelInterval, fromdate, todate
    );
    const inserted = await historicalDb.insertCandles(indexName, interval, candles);
    return { fetched: candles.length, inserted };
  }
}

module.exports = new IngestCron();
