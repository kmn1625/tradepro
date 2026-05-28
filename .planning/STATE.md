# NeoTrade — Execution State

## Current Position

- **Phase:** 01-foundation
- **Current Plan:** 04
- **Status:** In Progress

## Progress

```
Phase 1: [####------] 4/8 plans complete (P1-R01, P1-R02, P1-R03, P1-R04, P1-R05, P1-R06, P1-R07 done)
```

## Completed Plans

| Plan | Name | Commit(s) | Completed |
|------|------|-----------|-----------|
| 01-01 | Kotak Neo Live Feed | 0a73339, 1a0fcf5 | 2026-05-28 |
| 01-02 | VirtualPortfolio Paper Trading Engine | f525687, b366e2e | 2026-05-28 |
| 01-03 | Webhook Signal Ingestion Pipeline | 92a5915, 0b6dd8b | 2026-05-28 |

## Decisions Made

- Use raw `ws` package for Kotak Neo WebSocket (kotak-neo-api not available)
- Kotak Neo streaming endpoint: wss://mlhsm.kotaksecurities.com
- Instrument tokens hardcoded: NIFTY50=26000, BANKNIFTY=26009, FINNIFTY=26037
- Feed starts after server.listen() to ensure broadcast() is ready
- Unauthenticated state: log warning, no throw — server always starts clean
- VirtualPortfolio uses weighted avg cost (totalCost/qty) not strict FIFO — simpler for paper trading
- Position Map entry deleted at qty==0 to keep getPositions() clean
- parseFloat/toFixed(2) at fill/PnL boundaries to avoid floating-point drift
- getFirestore() returns null when Firebase env vars absent — all Firestore writes are guarded no-ops
- Live mode returns HTTP 501 stub — no broker orders possible in Phase 1 (T-03-05)
- In-memory portfolio registry Map<strategyId, VirtualPortfolio> resets on restart — acceptable for forward-test mode
- Chartink endpoint has no auth by design (Chartink cannot send custom headers); signals logged only, no execution
- quantity NaN/missing defaults to 50 (T-03-06 tamper mitigation)

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01-foundation | 01 | 2m 3s | 2 | 2 |
| 01-foundation | 02 | 142s | 1 | 2 |
| 01-foundation | 03 | 3m | 2 | 4 |

## Known Blockers

None.

## Last Session

- **Timestamp:** 2026-05-28T07:27:27Z
- **Stopped At:** Completed 01-03-PLAN.md
- **Resume File:** None
