# NeoTrade — AlgoTest-Parity Roadmap

**Project:** NeoTrade — Indian options algo trading platform  
**Target:** Feature parity with algotest.in (incremental)  
**Stack:** Node.js/Express + React 19 + Vite + WebSocket + Kotak Neo API  
**Honest timeline:** 6-12 months to 80% parity (solo developer)

---

## Constraints (non-negotiable facts from research)

1. **Kotak Neo API has NO historical data endpoint** — confirmed by official support page.  
   All backtesting requires an external data source (Angel One SmartAPI free, or Zerodha ₹2000/mo).

2. **SEBI 2025 algo trading rules**: Personal use = fine. Offering as SaaS for other traders to run live algos = requires SEBI empanelment. Plan accordingly.

3. **No mature Node.js options backtest library exists.** Either write custom engine or use Python microservice (backtrader). Python is faster to ship.

4. **IV (implied volatility) for Greek-based strike selection** requires TrueData (₹999-1999/mo) or reverse-calculating from option prices (computationally expensive). Phase 5 deferred.

---

## Phase Overview

| Phase | Name | Duration | Cost | Status |
|-------|------|----------|------|--------|
| 1 | Foundation + Signals Bridge | 2-4 weeks | ₹0 | In Progress (4/8 plans done) |
| 2 | ClickTrade Strategy Builder | 6-10 weeks | ₹0 | After Phase 1 |
| 3 | Signals AI Condition Builder | 3-4 weeks | ~$10/mo OpenAI | After Phase 2 |
| 4 | Historical Data Pipeline | 6-8 weeks | ₹0 (Angel One free) | After Phase 3 |
| 5 | Backtest Engine (NIFTY/BN) | 8-12 weeks | ₹0-2000/mo | After Phase 4 |

---

## Phase 1: Foundation + Signals Bridge
**Goal:** Replace mock data with real Kotak feed. Add paper trading. Receive TradingView/Chartink webhooks and route to broker or virtual portfolio.

**Requirement IDs:** P1-R01 through P1-R08

| ID | Requirement |
|----|-------------|
| P1-R01 | Replace mock tick generator in server.js with real Kotak Neo WebSocket subscription |
| P1-R02 | Subscribe to live OHLC for NIFTY50, BANKNIFTY, FINNIFTY via Kotak feed |
| P1-R03 | POST /api/signals/tradingview — receive JSON alert, validate token, parse signal |
| P1-R04 | POST /api/signals/chartink — receive Chartink webhook POST payload |
| P1-R05 | Signal-to-strategy registry (webhook token → strategy config stored in Firestore) |
| P1-R06 | VirtualPortfolio class — track virtual positions, avg cost, unrealized P&L |
| P1-R07 | Forward test fill engine — fill at LTP with configurable slippage % |
| P1-R08 | Signal log UI + paper trading dashboard in frontend |

**Depends on:** None (first phase)

---

## Phase 2: ClickTrade Strategy Builder
**Goal:** Visual multi-leg options strategy builder with live Greeks, payoff graph, scenario analysis, and live execution.

**Requirement IDs:** P2-R01 through P2-R09

| ID | Requirement |
|----|-------------|
| P2-R01 | Fetch live option chain from Kotak API (all strikes for selected index + expiry) |
| P2-R02 | Leg builder UI — add/remove legs (Buy/Sell × CE/PE × Strike × Expiry × Lots) |
| P2-R03 | Black-Scholes Greeks per leg using `greeks` npm package |
| P2-R04 | Net portfolio Greeks display (net delta, theta, gamma, vega) |
| P2-R05 | Payoff graph (P&L vs underlying price at expiry) using Chart.js or Recharts |
| P2-R06 | Scenario analysis — sliders for spot move %, IV change %, days to expiry |
| P2-R07 | Live simultaneous execution — place all legs via Kotak API |
| P2-R08 | Monte Carlo analysis (10,000 GBM paths) — optional, weekend project |
| P2-R09 | Export strategy as JSON shareable link |

**Depends on:** Phase 1 (real price feed needed for live Greeks)

---

## Phase 3: Signals AI Condition Builder
**Goal:** Visual/NL indicator-based strategy builder that evaluates conditions against live OHLC and executes trades automatically.

**Requirement IDs:** P3-R01 through P3-R06

| ID | Requirement |
|----|-------------|
| P3-R01 | Condition JSON schema — tree structure for AND/OR/indicator nodes |
| P3-R02 | Condition evaluator — parse JSON tree, compute indicators from OHLC data |
| P3-R03 | Extend indicator library: add Bollinger Bands, ATR, VWAP, Supertrend |
| P3-R04 | Simple form-based condition UI (defer drag-drop canvas to later) |
| P3-R05 | LLM integration (OpenAI/Claude API) — natural language → condition JSON |
| P3-R06 | Strategy auto-execution: evaluate conditions on each tick, fire orders when met |

**Depends on:** Phase 1 (live OHLC feed, order execution)

---

## Phase 4: Historical Data Pipeline
**Goal:** Ingest and store 2+ years of 1-min F&O OHLC data via Angel One SmartAPI (free). Enable data-backed backtest.

**Requirement IDs:** P4-R01 through P4-R06

| ID | Requirement |
|----|-------------|
| P4-R01 | Angel One SmartAPI integration — authenticate, fetch historical 1-min candles |
| P4-R02 | F&O contract universe registry — track active option contracts by expiry |
| P4-R03 | DuckDB database setup — schema: candles(symbol, interval, ts, o, h, l, c, vol, oi) |
| P4-R04 | Historical backfill scripts — crawl 2 years of data for NIFTY + BANKNIFTY strikes |
| P4-R05 | Daily ingestion cron — add each new day's OHLC at market close |
| P4-R06 | REST API: GET /api/historical/:symbol?from=&to=&interval= — serve from DuckDB |

**Depends on:** None (can run in parallel with Phase 2/3, but backtest engine needs it)

---

## Phase 5: Backtest Engine (NIFTY + BANKNIFTY)
**Goal:** Multi-leg options backtest engine covering NIFTY and BANKNIFTY, ATM/offset-based strike selection, performance metrics output.

**Requirement IDs:** P5-R01 through P5-R08

| ID | Requirement |
|----|-------------|
| P5-R01 | Backtest engine core: time-step loop, strategy definition intake, position management |
| P5-R02 | Strike resolver: ATM, ATM+N, ATM-N, by premium range |
| P5-R03 | Multi-leg position management: open/close/track each leg independently |
| P5-R04 | SL/TP logic: per-leg % SL, overall strategy SL, trailing SL |
| P5-R05 | Weekly expiry rollover handler |
| P5-R06 | Performance metrics: Total P&L, Win Rate, Max Drawdown, Sharpe Ratio, Profit Factor |
| P5-R07 | Results UI: equity curve, trade log table, metrics summary |
| P5-R08 | Heatmap: P&L by day-of-week and by month |

**Depends on:** Phase 4 (historical data must exist)

---

## What AlgoTest Has That We Don't Plan Yet

| Feature | Reason Deferred |
|---------|----------------|
| 60+ broker integrations | V3+ feature; Kotak sufficient for v1 |
| 500-stock options universe | Data cost and storage prohibitive solo |
| 7.5-year historical data | Start with 2-3 years via free API |
| SEBI-empanelled SaaS deployment | Regulatory complexity; personal use first |
| Delta-based strike selection (requires IV) | Needs TrueData ₹999-1999/mo or IV calculation |
| Historical IV surface | Phase 5+ after basic backtest proven |
| Trade replay (.clicktrade files) | Nice-to-have, Phase 5+ |
| TradingView Signals AI (AlgoTest's proprietary model) | We use OpenAI/Claude API instead |
