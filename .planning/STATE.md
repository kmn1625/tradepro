# NeoTrade — Execution State

## Current Position

- **Phase:** 05-backtest-engine
- **Current Plan:** 05
- **Status:** Complete

## Progress

```
Phase 1: [##########] 5/5 plans complete — DONE
Phase 2: [########--] 8/9 plans complete (02-08 Monte Carlo = optional/deferred)
Phase 3: [##########] 6/6 plans complete — DONE
Phase 4: [##########] 6/6 plans complete — DONE
Phase 5: [##########] 8/8 plans complete — DONE
```

## Completed Plans

| Plan | Name | Commit(s) | Completed |
|------|------|-----------|-----------|
| 01-01 | Kotak Neo Live Feed | 0a73339, 1a0fcf5 | 2026-05-28 |
| 01-02 | VirtualPortfolio Paper Trading Engine | f525687, b366e2e | 2026-05-28 |
| 01-03 | Webhook Signal Ingestion Pipeline | 92a5915, 0b6dd8b | 2026-05-28 |
| 01-04 | Paper Trading UI + Signal Log | 85a4cdc, 7113251 | 2026-05-28 |
| 01-05 | Signal-to-Strategy Registry | — | 2026-06-06 |
| 02-01 | Option Chain API + Expiry Selector | — | 2026-06-07 |
| 02-02 | Leg Builder UI (pre-existing) | — | pre-built |
| 02-03 | Black-Scholes Greeks per Leg (pre-existing) | — | pre-built |
| 02-04 | Net Portfolio Greeks Display (pre-existing) | — | pre-built |
| 02-05 | Payoff Graph (pre-existing) | — | pre-built |

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
- strategyId wired as null in Phase 1 PaperTrading.jsx; Phase 2 will add selector UI
- Firebase singleton guard in SignalLog.jsx uses getApps()/getApp() — safe re-init pattern, returns null when unconfigured
- Live P&L column shows dash in PaperTrading positions table — LTP not available at fetch time; backend summary includes unrealized total

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01-foundation | 01 | 2m 3s | 2 | 2 |
| 01-foundation | 02 | 142s | 1 | 2 |
| 01-foundation | 03 | 3m | 2 | 4 |
| 01-foundation | 04 | 8m | 3 | 5 |

## Known Blockers

None.

## Last Session

- **Timestamp:** 2026-05-28T10:13:20Z
- **Stopped At:** Completed 01-04-PLAN.md
- **Resume File:** None
