---
phase: 01-foundation
plan: "04"
subsystem: frontend
tags: [react, firebase, paper-trading, signal-log, tailwind]
dependency_graph:
  requires: [01-01, 01-02, 01-03]
  provides: [paper-trading-ui, signal-log-ui, portfolio-api-endpoint]
  affects: [App.jsx, signals.controller.js, signals.routes.js]
tech_stack:
  added: []
  patterns: [react-hooks, firestore-onsnapshot, 30s-polling, firebase-singleton-guard]
key_files:
  created:
    - service/frontend/src/components/PaperTrading.jsx
    - service/frontend/src/components/SignalLog.jsx
  modified:
    - service/frontend/src/App.jsx
    - service/backend/src/controllers/signals.controller.js
    - service/backend/src/routes/signals.routes.js
decisions:
  - "strategyId wired as null in Phase 1; Phase 2 will add a selector UI so users pick their strategy from a dropdown"
  - "Firebase client SDK re-initialization in SignalLog.jsx uses getApps()/getApp() guard — safe because Firebase SDK is a singleton; calling getApp() returns the instance already initialized in App.jsx"
  - "Live P&L column in PaperTrading positions table shows dash with tooltip — current LTP not available at fetch time without WebSocket integration; updates on next signal fill"
metrics:
  duration: "8m"
  completed_date: "2026-05-28"
---

# Phase 1 Plan 04: Paper Trading UI + Signal Log Summary

Paper Trading dashboard and Signal Log tabs added to NeoTrade frontend, backed by GET /portfolio/:strategyId backend endpoint and Firestore real-time listener.

## What Was Built

### Task 1 — GET /portfolio/:strategyId (Backend)

Added `getPortfolio` async handler to `signals.controller.js`:
- Reads from the in-memory `_portfolios` Map by `strategyId`
- Returns `portfolio.getSummary(marketDataService.lastPrice)` merged with `strategyId`
- Returns HTTP 404 with a descriptive message for unknown strategyId (T-04-04 spoofing mitigation)
- Returns HTTP 400 if `strategyId` param is missing
- Registered as `router.get('/portfolio/:strategyId', ...)` in `signals.routes.js`

Verified: `node -e "... typeof c.getPortfolio"` → `function`.

### Task 2 — PaperTrading.jsx

- Props: `{ strategyId }` — null triggers "No strategy selected" empty state
- 30-second auto-refresh interval + manual Refresh button
- Three stat cards matching App.jsx Portfolio component pattern: Available Capital (indigo), Realized P&L (white), Total P&L (white)
- P&L values colored emerald (positive) / rose (negative)
- Open Positions table: Instrument, Qty, Avg Cost, Total Cost, Live P&L (dash — updates on next signal)
- 404 response triggers "No portfolio yet" state with retry button
- `const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'`

### Task 3 — SignalLog.jsx

- Firebase client SDK re-init guard: `getApps().length ? getApp() : null` — avoids double-init error
- `onSnapshot` on `signal_log` collection, orderBy `receivedAt` desc, limit 100
- Returns null `db` gracefully — renders empty table without crashing when Firebase is unconfigured
- Source badge: TV (indigo) for tradingview, CK (amber) for chartink
- Action badge: BUY (emerald), SELL (rose), EXIT (orange), ALERT (slate)
- Status text: filled (emerald), rejected/error (rose), received (slate)
- Time formatted via `receivedAt.toDate()` with null guard
- Loading state: centered `<Loader2 className="animate-spin" />`

### Task 4 — App.jsx

Three targeted changes:
1. Added imports: `PaperTrading`, `SignalLog`, `Activity`, `BookOpen`
2. Added nav items after 'analytics': `{ id: 'paper', icon: Activity, label: 'Paper Trading' }` and `{ id: 'signals', icon: BookOpen, label: 'Signal Log' }`
3. Added render conditions: `{activeTab === 'paper' && <PaperTrading strategyId={null} />}` and `{activeTab === 'signals' && <SignalLog />}`

Existing tabs (terminal, portfolio, orders, analytics) unchanged.

## Decisions Made

### strategyId wiring (Phase 1 null)
`strategyId={null}` is intentional. Phase 1 has no strategy selector UI — the "No strategy selected" state is the expected view. Phase 2 will add a Firestore-backed strategy picker so users can choose which strategy's portfolio to view.

### Firebase singleton pattern in SignalLog.jsx
SignalLog re-initializes Firebase using `getApps()`/`getApp()` rather than importing `db` from App.jsx (which is not exported). This is safe — Firebase client SDK enforces one app instance per name. The guard returns the same instance App.jsx created. If Firebase is unconfigured (no VITE_FIREBASE_* env vars), `getDb()` returns null and the component renders an empty table without an error.

### Live P&L column dash
The positions table shows "—" for Live P&L because the fetch response doesn't include current LTP. VirtualPortfolio.getSummary() receives `marketDataService.lastPrice` on the backend, but the frontend would need either WebSocket data or a second price fetch to render it. This is acceptable for Phase 1 — the total unrealized P&L is shown in the stat cards via the backend summary.

## Deviations from Plan

None — plan executed exactly as written.

## Build Verification

```
vite v7.3.1 building client environment for production...
1726 modules transformed.
built in 28.33s
```

No TypeScript/JSX errors. Chunk size warning is pre-existing (firebase + react bundle) and not introduced by this plan.

## Threat Model Coverage

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-04-04 | getPortfolio returns 404 for unknown strategyId — no data leakage |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 85a4cdc | feat(01-04): add GET /portfolio/:strategyId endpoint to signals controller and routes |
| 2 | 7113251 | feat(01-04): add PaperTrading and SignalLog components, update App.jsx nav |

## Self-Check: PASSED

- service/frontend/src/components/PaperTrading.jsx: FOUND
- service/frontend/src/components/SignalLog.jsx: FOUND
- App.jsx activeTab === 'paper': FOUND
- App.jsx activeTab === 'signals': FOUND
- getPortfolio export: verified (typeof === function)
- npm run build: PASSED (built in 28.33s)
- commit 85a4cdc: FOUND
- commit 7113251: FOUND
