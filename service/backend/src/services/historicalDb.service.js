'use strict';

// DuckDB historical candles store (P4-R03)
// Schema: candles(symbol, interval, ts, o, h, l, c, vol, oi)
// ts = epoch millis, interval = '1m' | '5m' | '1d'

const path = require('path');
const fs   = require('fs');

let duckdb = null;
try { duckdb = require('duckdb'); } catch { /* optional */ }

const DB_PATH = path.join(__dirname, '../../../data/historical.db');

class HistoricalDbService {
  constructor() {
    this._db          = null;
    this._conn        = null;
    this._ready       = false;
    this._initPromise = null;
  }

  async init() {
    if (this._ready) return;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._setup().catch(err => {
      console.error('[HistoricalDB] init failed:', err.message);
      this._initPromise = null;
    });
    return this._initPromise;
  }

  async _setup() {
    if (!duckdb) throw new Error('duckdb package not available');

    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await new Promise((resolve, reject) => {
      this._db = new duckdb.Database(DB_PATH, (err) => {
        if (err) reject(err); else resolve();
      });
    });

    this._conn = this._db.connect();

    await this._run(`
      CREATE TABLE IF NOT EXISTS candles (
        symbol   VARCHAR NOT NULL,
        interval VARCHAR NOT NULL,
        ts       BIGINT  NOT NULL,
        o        DOUBLE  NOT NULL,
        h        DOUBLE  NOT NULL,
        l        DOUBLE  NOT NULL,
        c        DOUBLE  NOT NULL,
        vol      BIGINT  DEFAULT 0,
        oi       BIGINT  DEFAULT 0,
        PRIMARY KEY (symbol, interval, ts)
      )
    `);

    this._ready = true;
    console.log('[HistoricalDB] ready →', DB_PATH);
  }

  _run(sql, ...args) {
    return new Promise((resolve, reject) => {
      this._conn.run(sql, ...args, (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }

  _all(sql, ...args) {
    return new Promise((resolve, reject) => {
      this._conn.all(sql, ...args, (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });
  }

  // Insert array of { ts, o, h, l, c, vol?, oi? } for (symbol, interval)
  // Skips duplicates silently.
  async insertCandles(symbol, interval, candles) {
    if (!this._ready || !candles || candles.length === 0) return 0;
    let inserted = 0;
    for (const c of candles) {
      try {
        await this._run(
          `INSERT INTO candles (symbol, interval, ts, o, h, l, c, vol, oi)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (symbol, interval, ts) DO NOTHING`,
          symbol, interval,
          c.ts, c.o, c.h, c.l, c.c,
          c.vol || 0, c.oi || 0
        );
        inserted++;
      } catch { /* skip constraint violation */ }
    }
    return inserted;
  }

  // Query candles in [fromTs, toTs] epoch millis range, ascending.
  async queryCandles(symbol, interval, fromTs, toTs, limit = 5000) {
    if (!this._ready) return [];
    return this._all(
      `SELECT ts, o, h, l, c, vol, oi
       FROM candles
       WHERE symbol = ? AND interval = ? AND ts >= ? AND ts <= ?
       ORDER BY ts ASC
       LIMIT ?`,
      symbol, interval, fromTs, toTs, limit
    );
  }

  // Latest ts stored for (symbol, interval), or null if none.
  async getLatestTimestamp(symbol, interval) {
    if (!this._ready) return null;
    const rows = await this._all(
      `SELECT MAX(ts) AS latest FROM candles WHERE symbol = ? AND interval = ?`,
      symbol, interval
    );
    const v = rows[0]?.latest;
    return v != null ? Number(v) : null;
  }

  // Count of candles stored for (symbol, interval).
  async getCandleCount(symbol, interval) {
    if (!this._ready) return 0;
    const rows = await this._all(
      `SELECT COUNT(*) AS cnt FROM candles WHERE symbol = ? AND interval = ?`,
      symbol, interval
    );
    const v = rows[0]?.cnt;
    return v != null ? Number(v) : 0;
  }

  // Summary for all (symbol, interval) combos stored.
  async getSummary() {
    if (!this._ready) return [];
    return this._all(
      `SELECT symbol, interval,
              COUNT(*)        AS candles,
              MIN(ts)         AS first_ts,
              MAX(ts)         AS last_ts
       FROM candles
       GROUP BY symbol, interval
       ORDER BY symbol, interval`
    );
  }

  isReady() { return this._ready; }
}

module.exports = new HistoricalDbService();
