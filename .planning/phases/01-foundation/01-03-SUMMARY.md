---
phase: 01-foundation
plan: "03"
subsystem: backend/signals
tags: [webhook, signals, firebase, tradingview, chartink, paper-trading]
dependency_graph:
  requires: [01-02]
  provides: [webhook-signal-ingestion, signal-log-firestore]
  affects: [server.js, virtualPortfolio.service.js]
tech_stack:
  added: [firebase-admin/12.x]
  patterns: [express-router, async-controller, graceful-degradation, in-memory-registry]
key_files:
  created:
    - service/backend/src/config/firebase.admin.js
    - service/backend/src/routes/signals.routes.js
    - service/backend/src/controllers/signals.controller.js
  modified:
    - service/backend/src/server.js
decisions:
  - "getFirestore() returns null when env vars absent; all Firestore writes guarded — server starts cleanly without credentials"
  - "Live mode returns HTTP 501 stub — no broker orders possible in Phase 1 (T-03-05 mitigated)"
  - "In-memory portfolio registry (Map<strategyId, VirtualPortfolio>) resets on restart — acceptable for forward-test mode"
  - "Chartink endpoint has no auth by design: Chartink cannot send custom headers; signals are logged only with no execution path"
  - "quantity NaN/missing defaults to 50 (T-03-06 tamper mitigation)"
metrics:
  duration: "3 minutes"
  completed: "2026-05-28T07:27:27Z"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 1 Plan 03: Webhook Signal Ingestion Pipeline Summary

Webhook signal ingestion pipeline wiring Firebase Admin (graceful-degraded), TradingView alert handler, and Chartink screener handler to VirtualPortfolio paper engine via `/api/signals`.

## What Was Built

### Task 1 — Firebase Admin config + signals routes + signals controller

**`service/backend/src/config/firebase.admin.js`**

Firebase Admin SDK initialized from env vars at module load time. When `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, or `FIREBASE_CLIENT_EMAIL` are absent, initialization is skipped and `getFirestore()` returns `null`. All callers guard against null — server starts cleanly in dev/CI with no credentials.

Required environment variables for production:
```
FIREBASE_PROJECT_ID=<your-project-id>
FIREBASE_PRIVATE_KEY=<private-key-from-service-account.json>   # \n-escaped
FIREBASE_PRIVATE_KEY_ID=<key-id>                               # optional
FIREBASE_CLIENT_EMAIL=<service-account-email>
FIREBASE_CLIENT_ID=<client-id>                                 # optional
```

**`service/backend/src/routes/signals.routes.js`**

Express router with two POST routes:
- `POST /tradingview` → `signalsController.receiveTradingView`
- `POST /chartink` → `signalsController.receiveChartink`

Mounted at `/api/signals` in server.js.

**`service/backend/src/controllers/signals.controller.js`**

- `receiveTradingView(req, res)`:
  - Validates required fields `token`, `action`, `symbol` → `400` if missing
  - Normalizes `action` to uppercase, validates against `['BUY', 'SELL', 'EXIT']` → `400` if invalid
  - Parses `quantity` with `parseInt(rawQty, 10) > 0` guard, defaults to 50
  - Looks up strategy in Firestore `signal_strategies/{token}` → `401` if not found/inactive
  - Live mode → `501` stub (T-03-05 mitigated)
  - Paper mode → `VirtualPortfolio.buy()/sell()` at `marketDataService.lastPrice[symbol]`
  - All signal outcomes (rejected/error/filled) written to `signal_log` Firestore collection

- `receiveChartink(req, res)`:
  - Validates `stocks` and `trigger_prices` CSV fields → `400` if missing
  - Parses comma-separated stocks and prices, validates equal-length arrays
  - Logs each symbol as `ALERT` to `signal_log` with no execution path
  - Returns `200` with `{ processed: N, signals: [...] }`

### Task 2 — Mount /api/signals in server.js

Added try/catch block mounting signals routes after market routes. Non-fatal — server continues without signal ingestion if route loading fails.

## Firestore Setup (Manual)

To use TradingView signals end-to-end, create strategy documents manually in the Firestore console:

**Collection:** `signal_strategies`
**Document ID:** `<your-webhook-token>` (use a UUID — this is the auth credential)
**Fields:**
```json
{
  "userId": "your-uid",
  "strategyName": "My Strategy",
  "instrument": "NIFTY 50",
  "action": "BUY",
  "quantity": 50,
  "lots": 1,
  "mode": "paper",
  "broker": "kotak",
  "isActive": true,
  "slippage": 0.001,
  "createdAt": "<Firestore Timestamp>"
}
```

Signals are automatically written to `signal_log` collection (auto-ID documents).

## Confirmed Endpoint URLs

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/signals/tradingview` | Token in body | TradingView webhook receiver |
| POST | `/api/signals/chartink` | None | Chartink screener webhook receiver |

## TradingView Payload

```json
{
  "token": "{{strategy.order.comment}}",
  "action": "BUY",
  "symbol": "NIFTY 50",
  "quantity": 50
}
```

## Chartink Payload (Chartink native format)

```
stocks=RELIANCE,INFY&trigger_prices=2450.50,1567.20&scan_name=RSI_Test&triggered_at=2026-05-28T07:00:00Z
```

## Deviations from Plan

None — plan executed exactly as written. `marketDataService.lastPrice` was already an object with default prices (confirmed in marketData.service.js line 12-17) — no addition required.

## Smoke Test Results

All 5 verification tests passed with server running on port 5000:

| Test | Request | Expected | Actual |
|------|---------|----------|--------|
| 1 | POST /tradingview with empty body | 400 Missing required fields | PASS |
| 2 | POST /tradingview with invalid token | 401 Invalid webhook token | PASS |
| 3 | POST /tradingview with action=HOLD | 400 Invalid action | PASS |
| 4 | POST /chartink two stocks | 200 processed:2 | PASS |
| 5 | POST /chartink single stock | 200 processed:1 | PASS |

Server startup with no Firebase credentials: clean start, warns once, routes load.

## Threat Flags

None — all STRIDE mitigations in the plan's threat register are implemented:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-03-01 Spoofing | Token lookup in Firestore; invalid token → 401 |
| T-03-02 Repudiation | All signals including rejected logged to signal_log |
| T-03-05 EoP live mode | Live mode returns 501; no broker call possible |
| T-03-06 Tampering qty | `parseInt(rawQty,10) > 0 ? ... : 50` default guard |

## Self-Check: PASSED

- service/backend/src/config/firebase.admin.js: FOUND
- service/backend/src/routes/signals.routes.js: FOUND
- service/backend/src/controllers/signals.controller.js: FOUND
- server.js contains /api/signals: CONFIRMED
- Commit 92a5915 (Task 1): FOUND
- Commit 0b6dd8b (Task 2): FOUND
