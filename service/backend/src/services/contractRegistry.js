'use strict';

// F&O contract universe registry (P4-R02)
// Tracks Angel One SmartAPI symbol tokens for index spot + nearest option strikes.
//
// Angel One index spot tokens (NSE exchange):
//   NIFTY 50      → "99926000"
//   NIFTY Bank    → "99926009"
//   NIFTY Fin Svc → "99926037"
//
// For F&O options, Angel One provides a full instrument master at:
//   https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json
// This registry handles index spot only (Phase 4).
// Options tokens require master CSV lookup (Phase 5+).

const INDEX_TOKENS = {
  NIFTY:     { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  BANKNIFTY: { exchange: 'NSE', symboltoken: '99926009', tradingsymbol: 'Nifty Bank' },
  FINNIFTY:  { exchange: 'NSE', symboltoken: '99926037', tradingsymbol: 'Nifty Fin Service' },
};

// Angel ONE 1-min interval constant
const INTERVAL_1MIN = 'ONE_MINUTE';
const INTERVAL_5MIN = 'FIVE_MINUTE';
const INTERVAL_1DAY = 'ONE_DAY';

// NSE market hours in IST
const MARKET_OPEN_H  = 9;
const MARKET_OPEN_M  = 15;
const MARKET_CLOSE_H = 15;
const MARKET_CLOSE_M = 30;

class ContractRegistry {
  // Returns all tracked index contracts.
  getIndexContracts() {
    return Object.entries(INDEX_TOKENS).map(([name, meta]) => ({
      name,
      ...meta,
    }));
  }

  // Returns exchange + symboltoken for a given index name.
  // name: 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY'
  getIndexToken(name) {
    const key = name.toUpperCase().replace('NIFTY50', 'NIFTY').replace('NIFTY_BANK', 'BANKNIFTY');
    return INDEX_TOKENS[key] || null;
  }

  // Map Angel One interval string from our internal interval code.
  // internal: '1m' | '5m' | '1d'
  toAngelInterval(internal) {
    const map = { '1m': INTERVAL_1MIN, '5m': INTERVAL_5MIN, '1d': INTERVAL_1DAY };
    return map[internal] || INTERVAL_1MIN;
  }

  // Chunk a date range [startMs, endMs] into 30-day windows for Angel One API.
  // Returns array of { fromdate, todate } strings in "YYYY-MM-DD HH:mm" format.
  chunkDateRange(startMs, endMs, chunkDays = 30) {
    const chunks = [];
    const msPerDay = 86_400_000;
    const msPerChunk = chunkDays * msPerDay;

    let cursor = startMs;
    while (cursor < endMs) {
      const chunkEnd = Math.min(cursor + msPerChunk - 1, endMs);
      chunks.push({
        fromdate: this._toAngelDate(cursor, 'open'),
        todate:   this._toAngelDate(chunkEnd, 'close'),
      });
      cursor = chunkEnd + 1;
    }
    return chunks;
  }

  // Format ms timestamp to Angel One's "YYYY-MM-DD HH:mm" string.
  _toAngelDate(ms, boundary = 'open') {
    const d = new Date(ms);
    const yyyy = d.getUTCFullYear();
    const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd   = String(d.getUTCDate()).padStart(2, '0');
    // Angel One expects IST times. Convert UTC → IST (+5:30)
    const istMs  = ms + 5.5 * 3_600_000;
    const istDate = new Date(istMs);
    const hh = boundary === 'open' ? '09' : '15';
    const mn = boundary === 'open' ? '15' : '30';
    const dateStr = `${istDate.getUTCFullYear()}-${String(istDate.getUTCMonth()+1).padStart(2,'0')}-${String(istDate.getUTCDate()).padStart(2,'0')}`;
    return `${dateStr} ${hh}:${mn}`;
  }

  // Check if a JS Date is a trading day (Mon-Fri; no holiday check for now).
  isTradingDay(date = new Date()) {
    const day = date.getDay(); // 0=Sun, 6=Sat
    return day !== 0 && day !== 6;
  }

  // Yesterday's date range for daily ingestion cron.
  yesterdayRange() {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const d = yesterday;
    const yyyy = d.getUTCFullYear();
    const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd   = String(d.getUTCDate()).padStart(2, '0');
    return {
      fromdate: `${yyyy}-${mm}-${dd} 09:15`,
      todate:   `${yyyy}-${mm}-${dd} 15:30`,
    };
  }
}

module.exports = new ContractRegistry();
