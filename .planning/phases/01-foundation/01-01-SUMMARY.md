---
phase: 01-foundation
plan: 01
subsystem: market-data
tags: [websocket, kotak-neo, live-feed, ohlc]
dependency_graph:
  requires: []
  provides: [live-tick-feed, price-broadcast]
  affects: [server.js, marketData.service.js]
tech_stack:
  added: [ws (native WebSocket client for Kotak Neo streaming)]
  patterns: [singleton service, event-driven WebSocket, auto-reconnect]
key_files:
  created:
    - service/backend/src/services/kotakFeed.service.js
  modified:
    - service/backend/src/server.js
decisions:
  - Used raw `ws` package instead of kotak-neo-api (not in package.json)
  - wss://mlhsm.kotaksecurities.com as Kotak Neo streaming endpoint
  - Instrument tokens hardcoded: NIFTY50=26000, BANKNIFTY=26009, FINNIFTY=26037
  - try/catch around JSON.parse in _handleTick for DoS resilience (T-01-04)
  - price <= 0 guard prevents NaN/Infinity from reaching broadcast (T-01-01)
metrics:
  duration: "2m 3s"
  completed: "2026-05-28T07:21:36Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 1 Plan 01: Kotak Neo Live Feed Summary

Replace the mock `setInterval` tick generator in `server.js` with a real Kotak Neo WebSocket subscription that streams live prices for NIFTY50, BANKNIFTY, and FINNIFTY through the existing OHLC aggregator and broadcast system.

## What Was Built

### `service/backend/src/services/kotakFeed.service.js` (created)

`KotakFeedService` singleton class that:

- Connects to `wss://mlhsm.kotaksecurities.com` using the `ws` package with `Authorization: Bearer <accessToken>` header
- Subscribes to instrument tokens `['26000', '26009', '26037']` on `open`
- Parses each tick, resolves the symbol name, validates `price > 0`, then:
  - Calls `marketDataService.processTick(symbol, price, Date.now())`
  - Broadcasts `{ type: 'PRICE_UPDATE', symbol, price, time }` to all WS clients
  - Broadcasts `{ type: 'CANDLE_UPDATE', ... }` for the current partial candle at `1m` and `5m`
- Reconnects after 5 seconds on disconnect (T-01-02: prevents rapid reconnect storm)
- Pings every 25 seconds to keep connection alive
- Wraps `JSON.parse` in try/catch (T-01-04: malformed JSON guard)
- Logs a warning and returns without throwing when session is not authenticated

### `service/backend/src/server.js` (modified)

- Removed: `SYMBOLS` array, `lastPrice` object, `setInterval` mock tick loop (47 lines deleted)
- Added: `require('./services/kotakFeed.service')` and `kotakFeedService.startFeed(broadcast)` called inside `server.listen` callback

## Instrument Tokens

| Symbol     | Token |
|------------|-------|
| NIFTY 50   | 26000 |
| BANK NIFTY | 26009 |
| FINNIFTY   | 26037 |

## Kotak WS Endpoint

`wss://mlhsm.kotaksecurities.com`

Authorization via `Bearer` token in WS headers, sourced from `session.getSession().accessToken`.

## Broadcast Message Shapes (unchanged from mock)

```js
// Price tick
{ type: 'PRICE_UPDATE', symbol: 'NIFTY 50', price: 22453.20, time: 1748416800000 }

// Partial candle
{ type: 'CANDLE_UPDATE', symbol: 'NIFTY 50', interval: '1m',
  time: 1748416800000, open: 22450.00, high: 22460.00, low: 22445.00, close: 22453.20 }
```

## Deviations from Plan

### Auto-added: try/catch around JSON.parse

- **Found during:** Task 1 implementation, threat model review (T-01-04)
- **Issue:** Plan said "try/catch implied by guard pattern" but did not explicitly show it
- **Fix:** Added explicit try/catch in `_handleTick` around `JSON.parse(rawData.toString())`
- **Files modified:** `service/backend/src/services/kotakFeed.service.js`
- **Commit:** 0a73339

### Auto-added: guard in `_scheduleReconnect` to prevent duplicate timers

- **Found during:** Task 1 implementation
- **Issue:** Plan's close handler schedules reconnect, but if error fires before close, two timers could queue
- **Fix:** Added `if (this._reconnectTimer) return;` guard at start of `_scheduleReconnect()`
- **Files modified:** `service/backend/src/services/kotakFeed.service.js`
- **Commit:** 0a73339

### Auto-added: readyState check in ping interval

- **Found during:** Task 1 implementation
- **Issue:** Ping could be called on a closing socket between close event and timer clear
- **Fix:** Added `if (this._ws && this._ws.readyState === WebSocket.OPEN)` guard before `ping()`
- **Files modified:** `service/backend/src/services/kotakFeed.service.js`
- **Commit:** 0a73339

## Threat Surface Scan

No new trust boundaries introduced beyond those in the plan's threat model. All mitigations from the threat register are implemented:

| Threat ID | Status |
|-----------|--------|
| T-01-01   | Mitigated — `price <= 0` guard in `_handleTick` |
| T-01-02   | Mitigated — 5s reconnect timer; `stopFeed()` clears it |
| T-01-03   | Accepted — token sent only to Kotak endpoint over TLS |
| T-01-04   | Mitigated — try/catch around `JSON.parse` in `_handleTick` |

## Known Stubs

None. The feed does not use placeholder data. When unauthenticated, no ticks are emitted (intentional — operator must POST /api/auth/login first). Mock historical data in `marketDataService._generateHistoricalMock()` is pre-existing and out of scope for this plan.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `kotakFeed.service.js` exists | FOUND |
| `server.js` modified | FOUND |
| `01-01-SUMMARY.md` exists | FOUND |
| Commit `0a73339` (Task 1) | FOUND |
| Commit `1a0fcf5` (Task 2) | FOUND |
