'use strict';

// M11/M12/M13: File-backed persistence store.
// Survives server restarts. Atomic writes via tmp-rename pattern.
// Usage: store.get('ns', 'key'), store.set('ns', 'key', val), store.getAll('ns')

const path = require('path');
const fs   = require('fs');

const DATA_DIR = path.join(__dirname, '../../../data/store');

class PersistenceStore {
  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _filePath(namespace) {
    return path.join(DATA_DIR, `${namespace}.json`);
  }

  _load(namespace) {
    const fp = this._filePath(namespace);
    try {
      if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch (err) {
      console.error(`[PersistenceStore] load ${namespace} failed:`, err.message);
    }
    return {};
  }

  _save(namespace, data) {
    const fp  = this._filePath(namespace);
    const tmp = fp + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, fp);
    } catch (err) {
      console.error(`[PersistenceStore] save ${namespace} failed:`, err.message);
    }
  }

  get(namespace, key) {
    return this._load(namespace)[key] ?? null;
  }

  set(namespace, key, value) {
    const data = this._load(namespace);
    data[key] = value;
    this._save(namespace, data);
  }

  delete(namespace, key) {
    const data = this._load(namespace);
    delete data[key];
    this._save(namespace, data);
  }

  getAll(namespace) {
    return this._load(namespace);
  }

  setAll(namespace, data) {
    this._save(namespace, data);
  }

  // Append a record to a namespace array (for log-style stores).
  // Trims to maxEntries to prevent unbounded growth.
  append(namespace, record, maxEntries = 10_000) {
    const fp = this._filePath(namespace);
    let arr = [];
    try {
      if (fs.existsSync(fp)) arr = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (!Array.isArray(arr)) arr = [];
    } catch { arr = []; }
    arr.push({ ...record, _savedAt: new Date().toISOString() });
    if (arr.length > maxEntries) arr = arr.slice(-maxEntries);
    const tmp = fp + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(arr, null, 2), 'utf8');
      fs.renameSync(tmp, fp);
    } catch (err) {
      console.error(`[PersistenceStore] append ${namespace} failed:`, err.message);
    }
  }

  readLog(namespace, lastN = 500) {
    const fp = this._filePath(namespace);
    try {
      if (!fs.existsSync(fp)) return [];
      const arr = JSON.parse(fs.readFileSync(fp, 'utf8'));
      return Array.isArray(arr) ? arr.slice(-lastN) : [];
    } catch { return []; }
  }
}

module.exports = new PersistenceStore();
