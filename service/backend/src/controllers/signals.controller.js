'use strict';
const axios = require('axios');
const { getFirestore, admin } = require('../config/firebase.admin');
const { VirtualPortfolio } = require('../services/virtualPortfolio.service');
const marketDataService = require('../services/marketData.service');
const kotakSession = require('../brokers/kotak/session');
const kotakConfig  = require('../brokers/kotak/config');
const store        = require('../services/persistenceStore.service');

const PORTFOLIO_NS = 'paper_portfolios';
const SIGNAL_LOG_NS = 'signal_log_local';

// ---------------------------------------------------------------------------
// Persistent portfolio registry: strategyId -> VirtualPortfolio instance.
// State survives server restarts via file-backed store (M12).
// ---------------------------------------------------------------------------
const _portfolios = new Map();

function _getOrCreatePortfolio(strategyId, initialCapital = 1000000) {
  if (!_portfolios.has(strategyId)) {
    const saved = store.get(PORTFOLIO_NS, strategyId);
    const vp = new VirtualPortfolio(saved?.initialCapital || initialCapital);
    if (saved) {
      try {
        if (saved.availableCapital != null) vp.availableCapital  = saved.availableCapital;
        if (saved.positions)                vp._positions        = new Map(Object.entries(saved.positions));
        if (saved.trades)                   vp._trades           = saved.trades;
        if (saved.tradeCounter != null)     vp._tradeCounter     = saved.tradeCounter;
      } catch { /* restore failed — start fresh */ }
    }
    _portfolios.set(strategyId, vp);
  }
  return _portfolios.get(strategyId);
}

function _persistPortfolio(strategyId) {
  const vp = _portfolios.get(strategyId);
  if (!vp) return;
  store.set(PORTFOLIO_NS, strategyId, {
    initialCapital:   vp.initialCapital,
    availableCapital: vp.availableCapital,
    positions:        Object.fromEntries(vp._positions || new Map()),
    trades:           vp._trades || [],
    tradeCounter:     vp._tradeCounter || 0,
    savedAt:          new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Firestore helpers — all no-ops when db is null (no credentials configured)
// ---------------------------------------------------------------------------

/**
 * Fetch strategy config from Firestore signal_strategies/{token}.
 * Returns null if Firestore is unavailable, doc missing, or strategy inactive.
 *
 * @param {string} token - Webhook token (document ID)
 * @returns {Promise<object|null>}
 */
async function _lookupStrategy(token) {
  const db = getFirestore();
  if (!db) return null;
  try {
    const doc = await db.collection('signal_strategies').doc(token).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (!data.isActive) return null;
    return { id: doc.id, ...data };
  } catch (err) {
    console.error('[SignalsController] _lookupStrategy failed:', err.message);
    return null;
  }
}

/**
 * Persist a signal record to Firestore signal_log collection.
 * No-op (returns null) when Firestore is unavailable.
 *
 * @param {object} logEntry
 * @returns {Promise<string|null>} auto-generated doc ID or null
 */
async function _logSignal(logEntry) {
  // Always write to local file log (M13)
  store.append(SIGNAL_LOG_NS, logEntry);

  const db = getFirestore();
  if (!db) return null;
  try {
    const ref = await db.collection('signal_log').add({
      ...logEntry,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    console.error('[SignalsController] _logSignal failed:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Handler: POST /api/signals/tradingview
// ---------------------------------------------------------------------------

/**
 * Receives a TradingView webhook alert and routes it to:
 *  - VirtualPortfolio (paper mode) → returns fill result
 *  - Live broker (live mode)      → returns 501 stub (Phase 1)
 *
 * Required body fields: token, action, symbol
 * Optional body fields: quantity (default 50)
 */
async function receiveTradingView(req, res) {
  try {
    const { token, symbol, quantity: rawQty } = req.body;
    const rawAction = req.body.action;

    // --- Validation ---
    const missing = [];
    if (!token) missing.push('token');
    if (!rawAction) missing.push('action');
    if (!symbol) missing.push('symbol');
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['token', 'action', 'symbol'],
        missing,
        received: Object.keys(req.body),
      });
    }

    const action = rawAction.toUpperCase();
    if (!['BUY', 'SELL', 'EXIT'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid action. Must be BUY, SELL, or EXIT',
        received: rawAction,
      });
    }

    const quantity = parseInt(rawQty, 10) > 0 ? parseInt(rawQty, 10) : 50;

    // --- Strategy lookup (auth gate) ---
    // Dev bypass: when Firestore not configured, treat token as strategyId directly.
    // Allows paper trading without a Firebase project (enter any string as token).
    let strategy = await _lookupStrategy(token);
    if (!strategy) {
      const db = getFirestore();
      if (db) {
        // Firestore IS configured but token not found — reject properly
        await _logSignal({
          source: 'tradingview',
          token,
          strategyId: null,
          symbol,
          action,
          quantity,
          status: 'rejected',
          fillPrice: null,
          errorMessage: 'Token not found or strategy inactive',
          mode: 'unknown',
        });
        return res.status(401).json({ error: 'Invalid webhook token or strategy not active' });
      }
      // No Firestore — dev mode: use token as strategyId, default to paper
      strategy = { id: token, strategyName: token, mode: 'paper', initialCapital: 1000000, slippage: 0.001 };
    }

    // Current market price — informational for live, fill price for paper.
    const ltp = marketDataService.lastPrice[symbol] || 0;

    // --- Live mode: real Kotak equity order ---
    if (strategy.mode === 'live') {
      if (!kotakSession.isAuthenticated()) {
        await _logSignal({ source: 'tradingview', token, strategyId: strategy.id, symbol, action,
          quantity, status: 'rejected', fillPrice: null,
          errorMessage: 'Kotak not authenticated', mode: 'live' });
        return res.status(503).json({
          error: 'Kotak session not active — authenticate via /api/auth/kotak first',
          mode: 'live',
        });
      }

      const { accessToken } = kotakSession.getSession();
      const exchangeSeg = strategy.exchange_segment || 'nse_cm';
      const product     = strategy.product || 'MIS';
      const txnType     = (action === 'SELL' || action === 'EXIT') ? 'S' : 'B';

      try {
        const kotakRes = await axios.post(
          `${kotakConfig.BASE_URL}/rest/neo/v1/order`,
          { trading_symbol: symbol, exchange_segment: exchangeSeg,
            transaction_type: txnType, order_type: 'MKT',
            quantity: String(quantity), product, validity: 'DAY' },
          { headers: { Authorization: `Bearer ${accessToken}`,
              consumerKey: process.env.KOTAK_CONSUMER_KEY,
              'Content-Type': 'application/json' }, timeout: 8000 }
        );
        const orderId = kotakRes.data?.data?.orderId || kotakRes.data?.orderId || null;
        await _logSignal({ source: 'tradingview', token, strategyId: strategy.id, symbol, action,
          quantity, status: 'filled', fillPrice: ltp || null, errorMessage: null, mode: 'live' });
        return res.status(200).json({
          status: 'ok', source: 'tradingview', strategy: strategy.strategyName,
          symbol, action, quantity, mode: 'live', orderId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        await _logSignal({ source: 'tradingview', token, strategyId: strategy.id, symbol, action,
          quantity, status: 'error', fillPrice: null, errorMessage: err.message, mode: 'live' });
        return res.status(502).json({ error: 'Kotak order failed: ' + err.message, mode: 'live' });
      }
    }

    // --- Paper mode execution ---
    if (ltp <= 0) {
      return res.status(503).json({
        error: 'No live price available for ' + symbol + '. Is feed connected?',
        symbol,
      });
    }

    const portfolio = _getOrCreatePortfolio(strategy.id, strategy.initialCapital || 1000000);
    let fillResult;

    try {
      if (action === 'BUY') {
        fillResult = portfolio.buy(symbol, quantity, ltp, strategy.slippage || 0.001);
      } else if (action === 'SELL' || action === 'EXIT') {
        fillResult = portfolio.sell(symbol, quantity, ltp, strategy.slippage || 0.001);
      }
      _persistPortfolio(strategy.id);
    } catch (err) {
      await _logSignal({
        source: 'tradingview',
        token,
        strategyId: strategy.id,
        symbol,
        action,
        quantity,
        status: 'error',
        fillPrice: null,
        errorMessage: err.message,
        mode: 'paper',
      });
      return res.status(422).json({ error: err.message });
    }

    // --- Log success + respond ---
    await _logSignal({
      source: 'tradingview',
      token,
      strategyId: strategy.id,
      symbol,
      action,
      quantity,
      status: 'filled',
      fillPrice: fillResult ? fillResult.fillPrice : ltp,
      errorMessage: null,
      mode: 'paper',
    });

    return res.status(200).json({
      status: 'ok',
      source: 'tradingview',
      strategy: strategy.strategyName,
      symbol,
      action,
      fill: fillResult,
      portfolio: portfolio.getSummary(marketDataService.lastPrice),
    });
  } catch (err) {
    console.error('[SignalsController] receiveTradingView unhandled error:', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}

// ---------------------------------------------------------------------------
// Handler: POST /api/signals/chartink
// ---------------------------------------------------------------------------

/**
 * Receives a Chartink screener webhook.
 * Chartink sends a form-style payload with comma-separated stocks and trigger_prices.
 * No strategy lookup or order execution — signals are logged for review.
 *
 * Required body fields: stocks, trigger_prices
 * Optional body fields: triggered_at, scan_name
 */
async function receiveChartink(req, res) {
  try {
    const { stocks, trigger_prices, triggered_at, scan_name } = req.body;

    // --- Validation ---
    if (!stocks || !trigger_prices) {
      return res.status(400).json({
        error: 'Missing stocks or trigger_prices in Chartink payload',
        required: ['stocks', 'trigger_prices'],
        received: Object.keys(req.body || {}),
      });
    }

    const symbolList = stocks.split(',').map(s => s.trim()).filter(Boolean);
    const priceList = trigger_prices.split(',').map(p => parseFloat(p.trim()));

    if (symbolList.length !== priceList.length) {
      return res.status(400).json({
        error: 'stocks and trigger_prices arrays must be same length',
        stocksCount: symbolList.length,
        pricesCount: priceList.length,
      });
    }

    if (symbolList.length === 0) {
      return res.status(400).json({ error: 'No symbols found in stocks field' });
    }

    // --- Process each symbol ---
    const results = [];
    for (let i = 0; i < symbolList.length; i++) {
      const symbol = symbolList[i];
      const triggerPrice = isNaN(priceList[i]) ? 0 : priceList[i];

      results.push({
        symbol,
        triggerPrice,
        scan_name: scan_name || 'unknown',
        triggered_at: triggered_at || new Date().toISOString(),
        status: 'received',
      });

      await _logSignal({
        source: 'chartink',
        token: 'chartink_' + (scan_name || 'unknown'),
        strategyId: null,
        symbol,
        action: 'ALERT',
        quantity: 0,
        status: 'received',
        fillPrice: triggerPrice,
        errorMessage: null,
        mode: 'paper',
        scan_name: scan_name || null,
        triggered_at: triggered_at || null,
      });
    }

    return res.status(200).json({
      status: 'ok',
      source: 'chartink',
      processed: results.length,
      signals: results,
    });
  } catch (err) {
    console.error('[SignalsController] receiveChartink unhandled error:', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}

// ---------------------------------------------------------------------------
// Handler: GET /api/signals/portfolio/:strategyId
// ---------------------------------------------------------------------------

/**
 * Returns the paper portfolio summary for a given strategyId.
 * Returns 404 if no portfolio has been initialised for that strategyId yet.
 */
async function getPortfolio(req, res) {
  try {
    const { strategyId } = req.params;
    if (!strategyId) {
      return res.status(400).json({ error: 'strategyId param required' });
    }
    // Auto-create portfolio on first GET so users see the UI immediately.
    // No signal needed to bootstrap — they can send test webhooks after.
    const portfolio = _getOrCreatePortfolio(strategyId);
    const summary = portfolio.getSummary(marketDataService.lastPrice);
    return res.status(200).json({ strategyId, ...summary });
  } catch (err) {
    console.error('[SignalsController] getPortfolio error:', err.message);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}

module.exports = { receiveTradingView, receiveChartink, getPortfolio };
