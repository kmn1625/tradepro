'use strict';

// M5: Angel One instrument master — download, cache, resolve F&O option tokens.
// Source: https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json
// Disk cache at data/scrip_master.json, refreshed every 6h.
// Key: "UNDERLYING|YYYY-MM-DD|STRIKE|TYPE" → {symboltoken, tradingsymbol, exchange, lotSize}

const axios = require('axios');
const path  = require('path');
const fs    = require('fs');

const MASTER_URL = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';
const CACHE_PATH = path.join(__dirname, '../../../data/scrip_master.json');
const CACHE_TTL  = 6 * 3_600_000;

class InstrumentMasterService {
  constructor() {
    this._index    = null;
    this._loadedAt = null;
  }

  _stale() {
    return !this._loadedAt || (Date.now() - this._loadedAt) > CACHE_TTL;
  }

  async _download() {
    console.log('[InstrumentMaster] downloading scrip master from Angel One...');
    const res = await axios.get(MASTER_URL, { timeout: 60_000, responseType: 'json' });
    const data = Array.isArray(res.data) ? res.data : [];
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data), 'utf8');
    console.log(`[InstrumentMaster] downloaded ${data.length} instruments`);
    return data;
  }

  async _ensure() {
    if (!this._stale() && this._index) return;

    let raw = null;
    if (fs.existsSync(CACHE_PATH)) {
      const age = Date.now() - fs.statSync(CACHE_PATH).mtimeMs;
      if (age < CACHE_TTL) {
        try { raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch { raw = null; }
        if (raw) console.log(`[InstrumentMaster] ${raw.length} instruments from disk cache`);
      }
    }
    if (!raw) raw = await this._download();

    this._buildIndex(raw);
    this._loadedAt = Date.now();
  }

  _parseExpiry(raw) {
    if (!raw) return null;
    // "DDMMMYYYY" e.g. "25JUN2025"
    const m1 = raw.match(/^(\d{2})([A-Z]{3})(\d{4})$/i);
    if (m1) {
      const MON = { JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
                    JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12' };
      const mn = MON[m1[2].toUpperCase()];
      if (mn) return `${m1[3]}-${mn}-${m1[1]}`;
    }
    // "DD/MM/YYYY"
    const m2 = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
    // Already "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return null;
  }

  _buildIndex(instruments) {
    const idx = new Map();
    for (const inst of instruments) {
      if (inst.exch_seg !== 'NFO') continue;
      if (inst.instrumenttype !== 'OPTIDX') continue;
      // optiontype absent in Angel One master — extract from last 2 chars of symbol
      const sym   = (inst.symbol || '').trim();
      const otype = inst.optiontype
        ? inst.optiontype.toUpperCase()
        : sym.slice(-2).toUpperCase();
      if (otype !== 'CE' && otype !== 'PE') continue;

      const expiry = this._parseExpiry(inst.expiry);
      if (!expiry) continue;

      // Angel One stores strike as integer * 100: "2250000" → 22500
      const strike     = Math.round(parseFloat(inst.strike || '0') / 100);
      const underlying = (inst.name || '').trim().toUpperCase();
      if (!underlying || !strike) continue;

      idx.set(`${underlying}|${expiry}|${strike}|${otype}`, {
        symboltoken:   inst.token,
        tradingsymbol: inst.symbol,
        exchange:      'NFO',
        lotSize:       parseInt(inst.lotsize, 10) || null,
      });
    }
    this._index = idx;
    console.log(`[InstrumentMaster] indexed ${idx.size} NFO index options`);
  }

  // Resolve Angel One token for an option contract.
  // Returns {symboltoken, tradingsymbol, exchange, lotSize} or null.
  async resolveOptionToken(underlying, expiryDate, strike, type) {
    await this._ensure();
    const key = `${underlying.toUpperCase()}|${expiryDate}|${Math.round(strike)}|${type.toUpperCase()}`;
    return this._index.get(key) || null;
  }

  // All expiry dates (YYYY-MM-DD) for an underlying, sorted ascending.
  async getExpiries(underlying) {
    await this._ensure();
    const up = underlying.toUpperCase();
    const set = new Set();
    for (const k of this._index.keys()) {
      const [u, e] = k.split('|');
      if (u === up) set.add(e);
    }
    return [...set].sort();
  }

  // All strikes for underlying + expiry + type, sorted ascending.
  async getStrikes(underlying, expiryDate, type) {
    await this._ensure();
    const prefix = `${underlying.toUpperCase()}|${expiryDate}|`;
    const t = type.toUpperCase();
    const out = [];
    for (const [k, v] of this._index) {
      if (!k.startsWith(prefix)) continue;
      const parts = k.split('|');
      if (parts[3] === t) out.push({ strike: parseInt(parts[2], 10), ...v });
    }
    return out.sort((a, b) => a.strike - b.strike);
  }

  // Force-refresh from network (call from daily cron or admin route).
  async refresh() {
    const raw = await this._download();
    this._buildIndex(raw);
    this._loadedAt = Date.now();
  }

  isLoaded() { return !!this._index; }
  size()     { return this._index ? this._index.size : 0; }
}

module.exports = new InstrumentMasterService();
