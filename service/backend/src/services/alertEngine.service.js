/**
 * alertEngine.service.js
 * In-memory price alert store. Checks prices on every PRICE_UPDATE broadcast.
 * Fires WS notification when condition met.
 */

let _broadcast = null;
let _alertIdSeq = 1;

// Map<id, alert>
const alerts = new Map();

// alert shape: { id, symbol, condition:'above'|'below', price, note, createdAt, triggered, triggeredAt }

function init(broadcastFn) {
  _broadcast = broadcastFn;
}

function createAlert({ symbol, condition, price, note = '' }) {
  if (!symbol || !condition || !price) throw new Error('symbol, condition, price required');
  if (!['above', 'below'].includes(condition)) throw new Error('condition must be above|below');
  const id = _alertIdSeq++;
  const alert = {
    id,
    symbol: symbol.toUpperCase(),
    condition,
    price: parseFloat(price),
    note,
    createdAt: Date.now(),
    triggered: false,
    triggeredAt: null,
  };
  alerts.set(id, alert);
  return alert;
}

function listAlerts() {
  return Array.from(alerts.values()).sort((a, b) => b.createdAt - a.createdAt);
}

function deleteAlert(id) {
  const exists = alerts.has(id);
  alerts.delete(id);
  return exists;
}

function clearTriggered() {
  for (const [id, a] of alerts) {
    if (a.triggered) alerts.delete(id);
  }
}

// Called by server.js on every PRICE_UPDATE message
function checkPrice(symbol, currentPrice) {
  if (!_broadcast) return;
  for (const [, alert] of alerts) {
    if (alert.triggered) continue;
    if (alert.symbol !== symbol.toUpperCase()) continue;

    const hit =
      (alert.condition === 'above' && currentPrice >= alert.price) ||
      (alert.condition === 'below' && currentPrice <= alert.price);

    if (hit) {
      alert.triggered = true;
      alert.triggeredAt = Date.now();
      _broadcast({
        type: 'PRICE_ALERT',
        alertId: alert.id,
        symbol: alert.symbol,
        condition: alert.condition,
        targetPrice: alert.price,
        currentPrice,
        note: alert.note,
        time: alert.triggeredAt,
      });
    }
  }
}

module.exports = { init, createAlert, listAlerts, deleteAlert, clearTriggered, checkPrice };
