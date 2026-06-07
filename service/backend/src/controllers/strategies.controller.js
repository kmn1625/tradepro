'use strict';
const crypto = require('crypto');
const { admin, getFirestore } = require('../config/firebase.admin');

const COLLECTION = 'signal_strategies';

// In-memory fallback when Firestore not configured. Resets on restart — acceptable for dev.
const _store = new Map();

// ---------------------------------------------------------------------------
// POST /api/strategies
// Body: { strategyName, mode?, initialCapital?, slippage? }
// ---------------------------------------------------------------------------
async function createStrategy(req, res) {
  const { strategyName, mode = 'paper', initialCapital = 1000000, slippage = 0.001 } = req.body || {};

  if (!strategyName || typeof strategyName !== 'string' || !strategyName.trim()) {
    return res.status(400).json({ error: 'strategyName is required' });
  }
  if (!['paper', 'live'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be paper or live' });
  }

  const token = crypto.randomUUID();
  const strategy = {
    strategyName: strategyName.trim(),
    mode,
    initialCapital: Number(initialCapital) > 0 ? Number(initialCapital) : 1000000,
    slippage: Number(slippage) >= 0 ? Number(slippage) : 0.001,
    isActive: true,
  };

  const db = getFirestore();
  if (db) {
    try {
      await db.collection(COLLECTION).doc(token).set({
        ...strategy,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error('[StrategiesController] createStrategy Firestore write failed:', err.message);
      return res.status(500).json({ error: 'Failed to persist strategy', message: err.message });
    }
  } else {
    _store.set(token, { ...strategy, createdAt: new Date().toISOString() });
  }

  return res.status(201).json({ token, ...strategy });
}

// ---------------------------------------------------------------------------
// GET /api/strategies
// ---------------------------------------------------------------------------
async function listStrategies(req, res) {
  const db = getFirestore();

  if (db) {
    try {
      const snap = await db.collection(COLLECTION).orderBy('createdAt', 'desc').get();
      const strategies = snap.docs.map(doc => ({ token: doc.id, ...doc.data() }));
      return res.status(200).json({ strategies });
    } catch (err) {
      console.error('[StrategiesController] listStrategies failed:', err.message);
      return res.status(500).json({ error: 'Failed to list strategies', message: err.message });
    }
  }

  const strategies = Array.from(_store.entries())
    .map(([token, data]) => ({ token, ...data }))
    .reverse();
  return res.status(200).json({ strategies });
}

// ---------------------------------------------------------------------------
// PATCH /api/strategies/:token
// Body: any subset of { strategyName, mode, initialCapital, slippage, isActive }
// ---------------------------------------------------------------------------
async function updateStrategy(req, res) {
  const { token } = req.params;
  const ALLOWED = ['strategyName', 'mode', 'initialCapital', 'slippage', 'isActive'];
  const updates = {};
  for (const key of ALLOWED) {
    if ((req.body || {})[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update', allowed: ALLOWED });
  }

  const db = getFirestore();
  if (db) {
    try {
      const ref = db.collection(COLLECTION).doc(token);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Strategy not found', token });
      await ref.update(updates);
      const updated = await ref.get();
      return res.status(200).json({ token, ...updated.data() });
    } catch (err) {
      console.error('[StrategiesController] updateStrategy failed:', err.message);
      return res.status(500).json({ error: 'Failed to update strategy', message: err.message });
    }
  }

  if (!_store.has(token)) return res.status(404).json({ error: 'Strategy not found', token });
  const merged = { ..._store.get(token), ...updates };
  _store.set(token, merged);
  return res.status(200).json({ token, ...merged });
}

// ---------------------------------------------------------------------------
// DELETE /api/strategies/:token
// ---------------------------------------------------------------------------
async function deleteStrategy(req, res) {
  const { token } = req.params;
  const db = getFirestore();

  if (db) {
    try {
      const ref = db.collection(COLLECTION).doc(token);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Strategy not found', token });
      await ref.delete();
      return res.status(200).json({ status: 'deleted', token });
    } catch (err) {
      console.error('[StrategiesController] deleteStrategy failed:', err.message);
      return res.status(500).json({ error: 'Failed to delete strategy', message: err.message });
    }
  }

  if (!_store.has(token)) return res.status(404).json({ error: 'Strategy not found', token });
  _store.delete(token);
  return res.status(200).json({ status: 'deleted', token });
}

module.exports = { createStrategy, listStrategies, updateStrategy, deleteStrategy };
