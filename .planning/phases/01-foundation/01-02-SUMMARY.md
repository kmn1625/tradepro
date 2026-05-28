---
phase: 01-foundation
plan: "02"
subsystem: paper-trading-engine
tags: [virtualPortfolio, paper-trading, pnl, positions, fills]
dependency_graph:
  requires: []
  provides: [VirtualPortfolio class, paper trading fills, P&L engine]
  affects: [service/backend/src/controllers/signals.controller.js]
tech_stack:
  added: []
  patterns: [weighted-average cost basis, in-memory Map for positions, chronological trade log]
key_files:
  created:
    - service/backend/src/services/virtualPortfolio.service.js
    - service/backend/src/services/virtualPortfolio.test.js
  modified: []
decisions:
  - "Weighted avg cost (totalCost/qty) over strict FIFO — simpler for paper trading and matches plan spec"
  - "Position deleted from Map at qty==0 to keep getPositions() clean"
  - "parseFloat().toFixed(2) used at fill/pnl boundaries to avoid floating-point drift"
metrics:
  duration: "142s"
  completed: "2026-05-28"
  tasks_completed: 1
  files_created: 2
---

# Phase 1 Plan 02: VirtualPortfolio Paper Trading Engine Summary

Single-file paper trading engine with slippage-aware fills, weighted avg cost positions, realized/unrealized P&L, and a full trade log.

## What Was Built

`service/backend/src/services/virtualPortfolio.service.js` — the `VirtualPortfolio` class:

| Method | Signature | Description |
|--------|-----------|-------------|
| constructor | `(initialCapital = 1000000)` | Sets capital, creates empty positions Map and trades array |
| buy | `(symbol, qty, price, slippage = 0.001)` | Fills at `price * (1 + slippage)`, deducts cost from availableCapital |
| sell | `(symbol, qty, price, slippage = 0.001)` | Fills at `price * (1 - slippage)`, adds proceeds, records realizedPnl |
| getPositions | `()` | Array of `{ symbol, qty, avgCost, totalCost }` for open positions only |
| getPnL | `(currentPrices = {})` | Returns `{ realized, unrealized, total, capital, availableCapital }` |
| getTrades | `()` | Shallow copy of full chronological trade log |
| getSummary | `(currentPrices = {})` | getPnL + positions + tradeCount in one call |

## Edge Cases Handled

- **Zero-qty cleanup:** Position entry deleted from Map when `qty === 0` after sell; `getPositions()` always returns only live positions
- **Avg cost formula:** `totalCost / qty` (weighted average); on partial sell, `pos.totalCost -= avgCost * soldQty` preserves correct basis for remaining units
- **Capital guard:** `buy()` throws `Error('Insufficient capital: need X, have Y')` before any state mutation
- **Oversell guard:** `sell()` throws `Error('Insufficient position: held X, attempting to sell Y')` before any state mutation
- **Floating-point precision:** `parseFloat((value).toFixed(2))` at fill price and P&L computation boundaries
- **No live price:** `getPnL()` skips symbols not present in `currentPrices` (no crash on partial price map)

## TDD Execution

- **RED commit:** `f525687` — 15 behavioral tests written, all failing (module did not exist)
- **GREEN commit:** `b366e2e` — Implementation written; all 15 tests pass; plan inline assertions pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan inline test used capital too small for its own buy assertion**
- **Found during:** GREEN verification
- **Issue:** Plan's `<verify>` block used `new VirtualPortfolio(100000)` then `p.buy('NIFTY 50', 10, 22000, 0.001)` — cost is 220,220 which exceeds 100,000 capital, causing buy() to correctly throw "Insufficient capital" before the `fillPrice` assertion could run
- **Fix:** Used `new VirtualPortfolio(1000000)` (the default) for the inline test verification run; the implementation itself is correct and matches the plan spec exactly
- **Files modified:** None — implementation unchanged; inline test corrected in verification only
- **Commit:** N/A (verification script only, not committed)

## Self-Check: PASSED

- `service/backend/src/services/virtualPortfolio.service.js` — FOUND
- `service/backend/src/services/virtualPortfolio.test.js` — FOUND
- RED commit `f525687` — FOUND
- GREEN commit `b366e2e` — FOUND
- All inline assertions — PASSED ("ALL ASSERTIONS PASSED")

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This is a pure in-memory computation class with no external dependencies. Threat model mitigations T-02-01 and T-02-02 implemented as specified (qty > 0 guard and insufficient-position guard).

## Known Stubs

None — all methods return computed values from internal state; no placeholder or hardcoded empty returns.
