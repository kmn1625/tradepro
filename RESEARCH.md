# NeoTrade: AlgoTest.in Feature Research & Implementation Feasibility

**Researched:** 2026-05-28  
**Domain:** Indian Algo Trading Platform — Options Backtest, Signals, ClickTrade  
**Confidence:** HIGH (platform features), MEDIUM (implementation complexity estimates), HIGH (data source facts)  
**Scope:** Full AlgoTest.in feature reverse-engineering for NeoTrade (Node.js/React) implementation planning

---

## Executive Summary

AlgoTest.in is a no-code, options-first algo trading platform for Indian retail traders. It has three product pillars: **Algo Trading** (backtest + live execution + forward test), **Indicator Algo / Signals** (TradingView + Chartink webhook bridge + AI condition builder), and **ClickTrade** (manual options strategy builder + historical simulator).

The platform's moat is **7.5 years of 1-minute OHLC options data** (NSE F&O) and a purpose-built **multi-leg options backtest engine** that handles strike selection by ATM/delta/premium, Greeks tracking, expiry logic, slippage modeling, and performance metrics — all without code.

**For NeoTrade, the honest picture is:**
- The Signals bridge (TradingView/Chartink webhook receiver + broker execution) is **fully achievable** in 4-8 weeks.
- The ClickTrade strategy builder UI (visual option chain + payoff graph) is achievable in **6-10 weeks**.
- A basic index options backtest engine (Nifty/BankNifty only) is achievable in **3-5 months** IF you solve the historical data problem first.
- The historical data problem is **the single hardest constraint**: Kotak Neo API has NO historical data endpoint. You must source it externally, and quality 1-min options data costs money.
- Full parity with AlgoTest (7.5 years, 500 stock options, IV surface, Monte Carlo) is a **12-24 month project** for a solo developer — that is the honest assessment.

---

## Current NeoTrade State (from codebase review)

| Component | Status | Notes |
|-----------|--------|-------|
| Express + WebSocket backend | Working | Mock tick broadcast, OHLC aggregation |
| Kotak Auth (login + session) | Implemented | OTP-based, session.js |
| Market data feed | Mock only | Real Kotak stream TODO comment in server.js |
| Indicator calculations | Basic | RSI, MACD, SMA, EMA in marketData.service.js |
| lightweight-charts frontend | Working | Candlestick chart rendering |
| Firebase order persistence | Configured | firebase-admin in package.json |
| Historical data | Mock generated | _generateHistoricalMock() in service |

**Critical finding:** Kotak Neo API explicitly states "Historical data is unavailable at the moment. This feature is not allowed for this platform." — confirmed via official support page. This means any backtesting feature requires an external data source regardless of broker.

---

## Part 1: AlgoTest Feature Breakdown

### 1.1 Algo Trading — Backtest

**What it does:**  
Tests multi-leg options strategies against historical 1-minute OHLC data going back to January 2017 (7.5+ years). Users define a strategy via a visual builder — no code required.

**Strategy parameters configurable:**
- Underlying: NIFTY 50, BANK NIFTY, FINNIFTY, MIDCAPNIFTY, SENSEX, BANKEX, plus ~500 individual stock options
- Strategy type: Intraday vs. Positional
- Entry time / Exit time (time-based triggers)
- Leg configuration: Buy/Sell, CE/PE, strike selection method, quantity (lots)
- Strike selection: ATM, ATM+N, ATM-N, by delta (e.g. 0.15-0.20), by premium amount (e.g. ₹40-60), by distance from spot (₹200-300 points away), ITM/OTM by N strikes
- Expiry: Weekly or Monthly, nearest or specific
- Stop-loss: Percentage per leg (e.g. 35-50%), overall strategy SL, trailing SL (percentage-based)
- Target profit: % of collected premium or absolute P&L
- Re-entry: Allow or block re-entries; "No Entry After Time" rule
- Adjustment rules: Add leg, square off leg dynamically
- Margin estimate: Live margin requirement shown

**Data used:**
- 1-minute OHLC candles for all F&O instruments
- Options chain data (strike-wise: LTP, OI, Volume, IV, Greeks)
- Implied Volatility per strike per timestamp (required for Greek-based strike selection)

**Performance metrics output:**
- Total P&L, P&L per trade
- Win rate (% profitable trades)
- Maximum drawdown (largest peak-to-trough decline)
- Sharpe ratio (risk-adjusted returns)
- Consistency score (across sub-periods)
- Risk-to-reward ratio
- Trade log (entry time, exit time, strikes, P&L per leg)
- P&L curve chart
- Heatmap (P&L by day-of-week, time-of-day)

**Pricing:** 25 free backtests/week. Paid: 100 credits = 100 backtests. Unlimited 30-day pass = 1599 credits (~₹800-1600 depending on credit pack).

**Build complexity: 9/10**  
The engine itself is 6-8/10. The hard part is the data: you need 7+ years of 1-min OHLC for every active F&O contract, which means hundreds of thousands of rows per symbol. The options universe changes every week (new strikes are added, old ones expire). Storing, indexing, and querying this efficiently is the true challenge.

---

### 1.2 Algo Trading — Algo Trade (Live Execution)

**What it does:**  
Takes a strategy configured in the strategy builder and executes it automatically in a connected broker account during market hours. AlgoTest monitors entry/exit conditions in real-time and routes orders through the broker's API.

**Technical flow:**
1. Strategy conditions are evaluated against live LTP feed (real-time options prices via broker WebSocket or data feed)
2. When entry condition is met, orders are placed in the broker terminal (market/limit orders, configurable buffer)
3. Order slicing: large orders split to reduce market impact
4. Auto square-off at exit time if positions not closed
5. Trailing stop-loss: dynamic stop calculated as % of entry premium
6. Multi-leg simultaneous order placement (for strategies like straddles, order all legs at once)

**Broker integration:**
- AlgoTest supports 45-60+ Indian brokers via their respective REST/WebSocket APIs
- For NeoTrade: Kotak Neo API supports order placement, modification, cancellation at up to 10 orders/second

**Build complexity: 7/10**  
The execution engine itself (condition monitoring + order placement) is achievable. The hard parts are:
- Real-time options LTP feed for all active strikes (Kotak Neo API does support WebSocket quotes, but you need to subscribe to specific instruments)
- Handling partial fills, order rejection retries, network interruptions
- Order state reconciliation (what if an order was placed but confirmation was lost?)
- Regulatory compliance: SEBI 2025 rules require algo strategies to be registered/approved for live execution through an "empanelled" platform

**Regulatory note (CRITICAL):** SEBI's 2025 algo trading framework requires that retail algo strategies be executed through SEBI-registered, exchange-empanelled algo platforms. Kotak Neo API allows order placement but self-built algo execution for retail clients operates in a grey area. AlgoTest is compliant because they are an empanelled platform. NeoTrade as a personal tool is likely fine for personal use; offering it as a product to others requires SEBI empanelment.

---

### 1.3 Algo Trading — Forward Test

**What it does:**  
Paper trading using live market data, but without placing real orders. Strategies run identically to live execution, but order fills are simulated based on LTP (slightly delayed, 15-second delay per documentation).

**Technical architecture:**
- Same condition evaluation engine as live execution
- Instead of calling broker API, fills a virtual portfolio at LTP
- Tracks virtual P&L, positions, trade log in real-time
- "Virtual money" mode — no broker connection required
- 15-second delayed live data to prevent front-running

**Data required:**
- Real-time options LTP (with ~15s delay for paper trading, or use broker's delayed feed)
- Same instrument universe as live trading

**Build complexity: 6/10**  
This is the most accessible advanced feature to build. Once you have a live data feed, you replace the broker order call with a virtual portfolio update. The complexity is in:
- Maintaining virtual portfolio state (positions, average cost, unrealized P&L)
- Simulating realistic fills (do you fill at LTP? mid-price? with slippage?)
- Handling expiry (auto-settle options at 0 or intrinsic value on expiry day)

**NeoTrade feasibility: HIGH.** The existing WebSocket infrastructure already broadcasts live prices. Forward test is a virtual portfolio layer on top.

---

### 1.4 Indicator Algo — Signals AI

**What it does:**  
A built-in indicator-based strategy builder. Users drag-and-drop indicators (RSI, MACD, Bollinger Bands, etc.) and define entry/exit conditions using a condition canvas. Unique feature: an AI agent where you describe the strategy in plain English and it generates the condition logic.

**Technical components:**
1. **Condition builder UI**: Visual canvas with indicator nodes, comparison operators (>, <, crosses above, crosses below), logical operators (AND, OR)
2. **Indicator library**: Standard technical indicators computed on-the-fly from OHLC data
3. **Backtest integration**: Same engine as regular backtest, but the signal source is indicator conditions instead of time-based entry
4. **Forward test deployment**: Run the indicator strategy on live data
5. **AI natural language agent**: LLM-powered condition generator (GPT-4 class model presumably)

**Data required:**
- Historical OHLC for backtesting indicator signals
- Real-time OHLC for live signal generation

**Build complexity (without AI): 7/10**  
Building a visual condition builder (the drag-drop canvas) is a significant UI engineering task. The indicator computation is straightforward (ta-lib or hand-rolled). The condition evaluation engine (parse condition tree, evaluate against candle data) is a moderate backend task.

**Build complexity (with AI natural language): 8/10**  
Requires calling an LLM API (OpenAI/Anthropic) with a structured prompt that maps English descriptions to a condition schema. Achievable but requires careful prompt engineering and a well-defined condition JSON schema.

**NeoTrade note:** Your existing marketData.service.js already has RSI, MACD, SMA, EMA. The indicator engine exists. The condition builder UI is what's missing.

---

### 1.5 Indicator Algo — TradingView Signals

**What it does:**  
Bridges TradingView alerts to broker execution. When a TradingView indicator fires an alert, it sends a JSON payload via webhook to AlgoTest, which then executes the configured strategy.

**Technical flow (fully reverse-engineered):**
1. User creates a TradingView alert on an indicator (e.g., RSI crosses 30)
2. Alert trigger: "Once Per Bar Close" or "Once Per Minute"
3. Alert message: JSON block copied from AlgoTest (contains strategy ID, action, instrument metadata)
4. Alert notification: Webhook URL (AlgoTest's endpoint) receives HTTP POST with the JSON payload
5. AlgoTest validates the payload, matches to strategy, evaluates position state, places order via broker API

**Technical requirements for NeoTrade:**
- A public HTTPS webhook endpoint (Express route: POST /api/signals/tradingview)
- Strategy registry (which webhook token maps to which strategy + broker account)
- Payload parser (validate JSON, extract buy/sell signal, instrument, quantity)
- Execution router (call Kotak API to place order)
- Forward test mode (virtual fill instead of real order)

**External dependency:**
- User must have TradingView Essential plan (~$15/month) or higher to use webhook alerts
- No way around this — it is a TradingView limitation (webhooks require paid plans)
- Workaround exists: tv-hub.org converts email alerts to webhooks for free plan users (fragile, not recommended for live trading)

**Build complexity: 4/10** — This is one of the simplest features to build. It's a webhook receiver + order router. Two or three days of backend work.

---

### 1.6 Indicator Algo — Chartink Signals

**What it does:**  
Same concept as TradingView Signals but using Chartink's screener alerts as the signal source.

**What Chartink is:**  
Chartink.com is an Indian stock screener platform. Users create custom screeners (e.g., "RSI > 70 AND price > 20-day MA") and set alerts that fire when stocks match the criteria. Alerts can trigger every 1-3-5 minutes on premium plans and send HTTP POST requests to a webhook URL.

**Data Chartink sends in webhook:**
```json
{
  "stocks": "RELIANCE, INFY, TCS",
  "trigger_prices": "2450.50, 1567.20, 3890.00",
  "triggered_at": "2025-01-15 10:30:00",
  "scan_name": "RSI_Breakout"
}
```

**Technical flow for NeoTrade:**
1. Webhook endpoint receives Chartink POST payload
2. Parse stock symbols and trigger prices from payload
3. Map to configured strategy (which stock, what action, how many lots)
4. Execute or paper-trade

**External dependency:**
- User needs Chartink Premium (~₹780/month) for real-time alerts (every 1-3 minutes)
- Free Chartink only allows daily/end-of-day alerts — useless for intraday trading

**Build complexity: 4/10** — Nearly identical to TradingView webhook, different payload format.

---

### 1.7 ClickTrade — Strategy Builder

**What it does:**  
A visual options strategy builder focused on *constructing* multi-leg options positions for analysis and live execution. Different from the backtest strategy builder — this is for discretionary/semi-discretionary traders who build a position manually and then execute it.

**Features:**
- Option chain display for selected underlying (index or stock)
- Select legs: Buy/Sell, CE/PE, strike, expiry, quantity (lots)
- Real-time Greeks display per leg: Delta, Theta, Gamma, Vega, IV
- Aggregate portfolio Greeks (net delta, net theta, etc.)
- Payoff graph: P&L vs. underlying price at expiry
- Scenario analysis: Change IV offset, spot price, or date and see new payoff
- Monte Carlo analysis: 10,000 simulated price paths to expiry, shows distribution of outcomes
- Live execution: Place all legs simultaneously through connected broker
- Add leg / Square off leg: Dynamically adjust while live
- Trade replay: Replay past executed trades in the simulator
- Export/import .clicktrade files for sharing strategies

**Data required:**
- Live options chain (all strikes for selected underlying + expiry) with LTP, OI, IV, Greeks
- IV calculation requires spot price + option price + B-S model (real-time reverse solve)
- Historical data for scenario/Monte Carlo (uses historical IV for realistic simulations)

**Build complexity: 7/10 for core, 9/10 for Monte Carlo**  
- Option chain display: Achievable (fetch all strikes for selected instrument via Kotak API)
- Greeks calculation: B-S formula implementation — available as npm packages, moderate complexity
- Payoff graph: Straightforward mathematical calculation
- Scenario analysis: Moderately complex (re-run B-S with modified inputs)
- Monte Carlo: Significant statistical computing (10,000 GBM paths, 5-10 minutes of compute without optimization)

---

### 1.8 ClickTrade — Simulator

**What it does:**  
Loads historical option chain data for a specific date/time and lets you navigate through it as if you were trading that day. You can place virtual trades and watch P&L evolve bar-by-bar.

**Features:**
- Select underlying and date range for simulation
- Step through historical data (play, pause, fast-forward)
- Place virtual positions at historical prices
- See Greeks evolving in real-time (historical IV at each minute)
- Export simulation as .clicktrade replay file

**Data required:**
- Historical options chain data with per-minute LTP, OI, IV, Greeks for every strike
- This is the same data needed for the backtest engine — it is the most expensive/difficult component

**Build complexity: 8/10 (data acquisition) + 6/10 (UI) = effectively 9/10 overall**

---

## Part 2: Technical Data Requirements Deep-Dive

### 2.1 What "Options Historical Data" Actually Means

For backtesting options strategies the way AlgoTest does, you need:

```
For EVERY minute of EVERY trading day for EVERY active F&O contract:
  - Timestamp (yyyy-MM-dd HH:mm)
  - Symbol (e.g., NIFTY25JAN23500CE)
  - Open, High, Low, Close (option premium price in ₹)
  - Volume
  - Open Interest
  - Implied Volatility (optional but required for Greeks-based strike selection)
  - Underlying spot price at that minute
```

**Scale estimate:**
- NSE has ~170 F&O stocks + 6 indices
- Each expiry has ~200-400 strikes
- New weekly expiries added, old ones expire
- 375 trading minutes per day
- 250 trading days per year
- 7.5 years = ~1,875 trading days

Rough row count for just NIFTY + BANKNIFTY (2 indices × 300 strikes × 375 min × 1875 days):
≈ **420 million rows** for 2 indices alone

AlgoTest almost certainly uses a columnar database (ClickHouse, TimescaleDB, or DuckDB) and pre-computes strike offsets from ATM dynamically.

For stock options (500 stocks): scale up by 100x. This is petabyte-scale data for the full universe.

**Practical implication for NeoTrade:** Start with NIFTY + BANKNIFTY only. Manageable at ~5-10 GB for 7 years of 1-min data.

---

### 2.2 Where to Get Indian F&O Historical Data

| Source | Data Available | Cost | Quality | Notes |
|--------|---------------|------|---------|-------|
| **NSE India official** | EOD bhavcopy (daily OHLC + OI) | Free | HIGH | Minute-level NOT available from NSE directly. Download from nseindia.com/reports |
| **Angel One SmartAPI** | Historical OHLC, up to 8000 candles/request, 1-min resolution | FREE (with Angel account) | HIGH | Best free option. 1-min data for equity + F&O. Rate limits apply. No IV data. |
| **Upstox API** | Historical 1-min OHLC for equity + F&O, last 1 month at 1-min | FREE (with Upstox account) | HIGH | 1-min only available for recent ~1 month. Older data: 30-min. Insufficient for backtest. |
| **Zerodha Kite Connect** | 1-min OHLC, up to 10 years, equity + F&O | ₹2000/month (includes historical) | HIGH | Excellent data quality. ₹2000/month is very reasonable. NO IV data in OHLC feed. |
| **Kotak Neo API** | **NO historical data** | N/A | N/A | Confirmed: "Historical data is unavailable at the moment" |
| **Breeze API (ICICI)** | 3 years historical, 1-min OHLC, F&O | FREE (ICICI account) | HIGH | Good option for 3-year backtest window |
| **TrueData** | Full historical 1-min OHLC + IV + Greeks | ₹499-999/month (options decoder) | HIGHEST | The professional choice. Includes IV surface data, pre-computed Greeks. Used by algo platforms. |
| **Global Datafeeds (GFDL)** | NSE/BSE/MCX full tick data | ₹2000-10000+/month | HIGHEST | Enterprise-grade, overkill for solo dev |
| **Stolo.in** | 4-year 1-min F&O historical | Subscription | MEDIUM | Good secondary source |
| **NiftyTrader.in** | NSE option chain historical, CSV download | Free (basic), paid (bulk) | MEDIUM | Manual/CSV only, not API |

**Recommendation for NeoTrade (honest and practical):**

| Phase | Data Source | Cost | Coverage |
|-------|-------------|------|----------|
| Development / MVP | Angel One SmartAPI (free) | ₹0 | 1-min data, last ~2 years for F&O |
| Production backtest (3-6 months) | Zerodha Kite Connect | ₹2000/month | 10 years, 1-min OHLC, F&O |
| Full AlgoTest parity | TrueData | ₹999-1999/month | Historical IV + Greeks |

**Note on IV data:** Without historical IV, you cannot do delta-based strike selection in backtests. You either (a) pay for TrueData which includes IV, or (b) reverse-calculate IV from historical option prices using Black-Scholes (computationally expensive but feasible if you have the OHLC data).

---

### 2.3 Kotak Neo API — Current Capabilities for NeoTrade

| Capability | Available | Details |
|-----------|-----------|---------|
| Order placement | YES | Market, Limit, SL, SL-M orders |
| Order modification | YES | Modify pending orders |
| Order cancellation | YES | Cancel pending orders |
| Order history | YES | Today's orders |
| Portfolio / holdings | YES | Current positions and holdings |
| Live quotes (LTP) | YES | Real-time last traded price |
| Live OHLC (current day) | YES | Intraday OHLC |
| WebSocket live feed | YES | Subscribe to instruments for real-time ticks |
| **Historical OHLC** | **NO** | Officially not available |
| Options chain | PARTIAL | Current day only via live quotes |
| Rate limit | 10 orders/sec | Orders only; quote limits not documented |

This means: **For backtesting and the Simulator, you must use a different data source than Kotak.** This is actually fine — most algo platforms (including AlgoTest) source data independently from the execution broker.

---

## Part 3: Open-Source Alternatives & Build vs. Buy

### 3.1 Backtesting Engines

| Library | Language | Stars | Options Support | Indian Market | Verdict |
|---------|----------|-------|----------------|---------------|---------|
| **backtrader** | Python | 14k+ | YES (via plugins) | Community adapters exist | Best overall for options; Python only |
| **jesse** | Python | 5k+ | NO (crypto-focused) | NO | Not suitable |
| **backtestjs/framework** | TypeScript | ~200 | NO | NO | Too basic, crypto/stocks only |
| **fugle-backtest-node** | Node.js | ~100 | NO | NO | Too limited |
| **QuantConnect LEAN** | C# | 8k+ | YES (full) | Requires data adapter | Overkill for solo dev |
| **backtest-kit** | TypeScript | ~50 | NO | NO | Too new/unproven |

**Honest assessment:** There is no mature, production-ready options backtesting library in Node.js/JavaScript. The Python ecosystem (backtrader, jesse, vectorbt) is far more mature for this.

**Recommendation:** 
- Option A (pragmatic): Write a microservice in Python using backtrader for the backtest engine; call it from Node.js via REST or child_process. This is the fastest path to a working backtest engine.
- Option B (all-JS): Build a custom backtest engine in Node.js from scratch. Doable but 2-3x more effort than Option A since you're building infrastructure, not just integrating it.

---

### 3.2 Options Greeks / Black-Scholes Libraries

| Library | Language | Notes |
|---------|----------|-------|
| **black-scholes** (npm) | JavaScript | Simple B-S pricing, no Greeks |
| **financial.js** | JavaScript | Basic options pricing |
| **greeks** (npm) | JavaScript | Delta, Gamma, Theta, Vega, Rho for European options |
| **py_vollib** | Python | Full Greeks + IV calculation, battle-tested |
| **mibian** | Python | Black-Scholes + Greeks, pure Python |

**Recommendation:** For NeoTrade (Node.js), use the `greeks` npm package for live Greeks display. For backtest IV calculation (reverse-solving), implement Newton-Raphson IV solver in JavaScript or call a Python microservice.

```bash
npm install greeks  # [VERIFIED: npm registry]
```

---

### 3.3 Charting (you already have this)

Your stack has `lightweight-charts` (free MIT license from TradingView). This is the correct choice and already handles candlestick charts. For payoff graphs (ClickTrade strategy builder), use `Chart.js` or `Recharts` — both free, both React-compatible.

---

### 3.4 Free Alternatives to Each Paid Component

| AlgoTest Paid Component | What It Costs | Free/Cheap Alternative | Tradeoff |
|------------------------|--------------|----------------------|----------|
| 7.5-year historical options data | Baked into subscription | Angel One SmartAPI (free, 2yr) | Shorter backtest window |
| TradingView webhook alerts | User pays $15/month TV plan | Build TV email-to-webhook proxy | Fragile, delay risk |
| Chartink screener alerts | User pays ₹780/month Chartink | Build your own screener on OHLC data | More engineering work |
| Signals AI (LLM condition builder) | Baked in | OpenAI API (~$0.01-0.10 per request) | Tiny cost per use |
| Monte Carlo analysis | Baked in | Hand-roll GBM simulation in JS/Python | 2-3 day implementation |
| TrueData for IV surface | ₹999-1999/month | Reverse-calculate IV from option prices | Computation cost |

---

## Part 4: Feature-by-Feature Feasibility for NeoTrade

### Feasibility Scale
- **GREEN**: Achievable in stated timeframe by solo developer, no blockers
- **YELLOW**: Achievable but requires solving a hard dependency first  
- **RED**: Requires significant investment (time, money, or both) beyond typical solo scope

---

### 4.1 Signals Bridge (TradingView + Chartink Webhooks)

**Status: GREEN**  
**Difficulty: 4/10**  
**Time estimate: 1-2 weeks**

What to build:
1. `POST /api/signals/tradingview` — receive JSON alert, validate token, parse signal
2. `POST /api/signals/chartink` — receive Chartink webhook, parse stock list
3. Signal-to-strategy registry (MongoDB/Firebase: webhook_token → strategy config)
4. Order executor (call Kotak API or paper-trade)
5. Signal log UI (show recent signals received, status, execution result)

No expensive dependencies. Users pay their own TradingView/Chartink subscriptions. This is achievable immediately.

**What NeoTrade can do better than AlgoTest:** Add a third signal source — custom HTTP POST (any trading bot can signal NeoTrade). AlgoTest only supports TV and Chartink. You can support any arbitrary webhook.

---

### 4.2 Forward Test (Paper Trading)

**Status: GREEN**  
**Difficulty: 6/10**  
**Time estimate: 2-4 weeks**

What to build:
1. VirtualPortfolio class (positions, avg cost, unrealized P&L)
2. Strategy condition evaluator (check entry/exit conditions against live price)
3. Virtual fill engine (fill at LTP with configurable slippage %)
4. Expiry handler (auto-settle options at expiry)
5. Forward test dashboard (live P&L, open positions, trade log)

Your existing WebSocket + OHLC aggregator already provides the live price feed. The virtual portfolio layer is the new work.

**Realistic fill modeling:** Options have wide bid-ask spreads, especially during volatility. Simply filling at LTP overstates real returns. Add a slippage factor (0.1-0.5% for liquid options, 1-3% for illiquid) to make forward test more realistic.

---

### 4.3 ClickTrade Strategy Builder (Visual + Payoff Graph)

**Status: GREEN (core) / YELLOW (Monte Carlo)**  
**Difficulty: 7/10**  
**Time estimate: 6-10 weeks**

What to build:
1. Option chain display: Fetch live strikes for selected index/stock from Kotak API, display bid/ask/LTP/OI/IV in table format
2. Leg builder: Add/remove legs (Buy/Sell × CE/PE × Strike × Expiry × Lots)
3. Greeks display: Compute per-leg and net Greeks using B-S
4. Payoff graph: Plot P&L vs. underlying price from current-10% to current+10%
5. Scenario analysis: Sliders for spot move (%), IV change (%), days to expiry
6. Live execution: Button to place all legs via Kotak API simultaneously
7. Monte Carlo (optional, later): 10,000 GBM paths — weekend project

**Payoff graph math (straightforward):**
```javascript
// For each underlying price X in range:
const legValue = (legType === 'CE')
  ? Math.max(X - strike, 0) * direction  // intrinsic value at expiry
  : Math.max(strike - X, 0) * direction;
// Sum across all legs, subtract net premium paid/received
```

**Greeks (using `greeks` npm package):**
```javascript
const greeks = require('greeks');
const delta = greeks.getDelta(spotPrice, strike, timeToExpiry, riskFreeRate, iv, 'call');
const theta = greeks.getTheta(spotPrice, strike, timeToExpiry, riskFreeRate, iv, 'call');
```

---

### 4.4 Basic Backtest Engine (NIFTY + BANKNIFTY only)

**Status: YELLOW**  
**Difficulty: 9/10**  
**Time estimate: 3-5 months (after solving data)**

**The hard prerequisite: Historical data acquisition**

Before writing a single line of backtest code, you need to solve the data problem:

1. **Source:** Use Angel One SmartAPI (free) to download 2 years of 1-min OHLC for active NIFTY and BANKNIFTY option contracts
2. **Storage:** PostgreSQL with TimescaleDB extension (time-series optimized) or DuckDB (embedded, excellent for analytics)
3. **Schema:** `candles(symbol, interval, timestamp, open, high, low, close, volume, oi)`
4. **Index strategy:** Composite index on (symbol, timestamp) — critical for backtest query performance
5. **Scale:** ~2 years × 250 days × 375 min × ~400 active strikes per index × 2 indices = ~150 million rows. Manageable in DuckDB or TimescaleDB.

**The backtest engine (once data exists):**

Core loop:
```
for each trading day in date_range:
  for each minute in trading_session:
    resolve_strike(selection_method, atm_price, iv)  // ATM/delta/premium
    evaluate_entry_conditions(current_bar)
    if entry_triggered: open_position(legs)
    evaluate_exit_conditions(open_positions, current_bar)
    if exit_triggered: close_position(legs, close_price)
    update_daily_pnl()
aggregate_metrics(all_trades)  // Sharpe, max drawdown, win rate
```

**Key implementation challenges:**
- Strike resolution: At any given minute, which strike is "ATM"? Requires spot price at that minute (underlying, not option).
- Weekly expiry rollover: On expiry day, how do you handle positions that expire worthless vs. ITM settlement?
- Gap opens: Index opens significantly different from prior close — stop-losses may not execute at configured price (gap risk)
- IV-based strike selection: Requires historical IV data (extra cost/computation)

**Feasibility verdict:** With 3 months of focused effort and Angel One or Zerodha historical data (~₹0-2000/month), you can build a working NIFTY/BANKNIFTY backtest engine that covers the core 80% of what AlgoTest does. The remaining 20% (500 stock options, IV surface, 7.5 years, advanced heatmaps) is a much larger project.

---

### 4.5 Signals AI (Natural Language Strategy Builder)

**Status: GREEN (with LLM API)**  
**Difficulty: 6/10**  
**Time estimate: 3-4 weeks**

What to build:
1. Condition schema: JSON representation of a strategy condition tree
   ```json
   {
     "entry": { "AND": [
       { "indicator": "RSI", "period": 14, "operator": "crossesBelow", "value": 30 },
       { "indicator": "EMA", "fast": 9, "slow": 21, "operator": "crossesAbove" }
     ]},
     "exit": { "OR": [
       { "indicator": "RSI", "operator": "crossesAbove", "value": 70 },
       { "type": "time", "time": "15:15" }
     ]}
   }
   ```
2. Condition evaluator: Parse JSON tree, compute indicators from OHLC, evaluate boolean expression
3. Visual condition builder UI: Drag-drop nodes or simplified form builder
4. LLM integration: POST to OpenAI/Anthropic API with system prompt that maps English to condition JSON

**Cost:** OpenAI GPT-4o mini: ~$0.0002/1K tokens. A strategy description is ~200-500 tokens. Cost per request: <₹0.10. Negligible.

**NeoTrade already has:** RSI, MACD, EMA, SMA computed in marketData.service.js. You have the computation layer; you need the condition parser and UI.

---

### 4.6 Full Options Simulator (ClickTrade Simulator)

**Status: RED (for full feature parity)**  
**Difficulty: 9/10**  
**Time estimate: 4-6 months after backtest data is solved**

This requires historical options chain data with per-minute IV and Greeks for every strike. That is the same expensive data as the full backtest engine. Without that data, the simulator has nothing to play back.

**Minimal viable version (2-3 weeks, GREEN):** Build a forward-only simulator that runs on the current live feed — users can place virtual trades right now and watch P&L evolve. That's achievable immediately and is genuinely useful.

---

## Part 5: Performance Metrics — Implementation Reference

These are the standard metrics you need to calculate for any backtest output:

| Metric | Formula | Notes |
|--------|---------|-------|
| **Total P&L** | Sum of all trade P&Ls | Simple sum |
| **Win Rate** | Winning trades / Total trades | % |
| **Avg P&L per trade** | Total P&L / Trade count | ₹ |
| **Max Drawdown** | max(peak - trough) over equity curve | % |
| **Sharpe Ratio** | (avg_return - risk_free) / std_dev(returns) | Annualize: multiply by √252 |
| **Calmar Ratio** | Annual return / Max drawdown | >1.0 = acceptable |
| **Profit Factor** | Gross profit / Gross loss | >1.5 = decent |
| **Recovery Factor** | Net profit / Max drawdown | Higher is better |
| **Consecutive losses** | Longest losing streak | Stress indicator |

```javascript
// Sharpe ratio implementation
function sharpeRatio(dailyReturns, riskFreeRate = 0.065) {
  const excess = dailyReturns.map(r => r - riskFreeRate / 252);
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const variance = excess.reduce((a, b) => a + (b - mean) ** 2, 0) / excess.length;
  return (mean / Math.sqrt(variance)) * Math.sqrt(252);
}

// Max drawdown
function maxDrawdown(equityCurve) {
  let peak = equityCurve[0];
  let maxDD = 0;
  for (const equity of equityCurve) {
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD; // as decimal, multiply by 100 for %
}
```

---

## Part 6: Recommended Implementation Roadmap for NeoTrade

### Phase 1 — Foundation (Now, 2-4 weeks) — GREEN
**Goal:** Replace mock data with real data, add forward test

1. Replace mock tick generator with real Kotak Neo WebSocket subscription
2. Add forward test portfolio (virtual positions, P&L tracking)
3. Build TradingView + Chartink webhook receiver
4. Add basic order log UI (pending → executed → cancelled state machine)

**Cost:** ₹0 additional (Kotak API is already your broker)

---

### Phase 2 — ClickTrade Strategy Builder (4-10 weeks) — GREEN
**Goal:** Visual options strategy builder with payoff graph and live execution

1. Fetch live option chain from Kotak API
2. Build multi-leg leg builder UI (React)
3. Implement B-S Greeks (use `greeks` npm package)
4. Payoff graph component (Chart.js)
5. Scenario analysis sliders
6. Execute all legs simultaneously via Kotak API

**Cost:** ₹0 additional

---

### Phase 3 — Signals AI Condition Builder (3-4 weeks) — GREEN
**Goal:** Visual/natural-language indicator strategy builder

1. Define condition JSON schema
2. Build condition evaluator (tree walker)
3. Add more indicators (Bollinger Bands, ATR, VWAP, Supertrend)
4. Simple form-based condition UI (defer drag-drop to later)
5. OpenAI integration for natural language → condition JSON

**Cost:** ~$5-20/month OpenAI API depending on usage

---

### Phase 4 — Historical Data Pipeline (6-8 weeks) — YELLOW
**Goal:** Acquire and store 2+ years of 1-min F&O OHLC data

1. Open Angel One account (free API)
2. Write data ingestion scripts (crawl historical F&O contracts, store in TimescaleDB/DuckDB)
3. Build F&O contract universe registry (which strikes exist for which expiry)
4. Schedule daily ingestion job (add each new day's data)

**Cost:** Angel One account (free), server cost for database (~₹1000-2000/month for a VPS with 100GB storage)

---

### Phase 5 — Basic Backtest Engine (8-12 weeks after Phase 4) — YELLOW
**Goal:** NIFTY + BANKNIFTY multi-leg backtest

1. Backtest engine core (time-step loop, position management)
2. Strike resolver (ATM/offset-based; add delta-based later when IV data available)
3. P&L aggregator and performance metrics calculator
4. Results UI (equity curve, trade log, metrics table)
5. Heatmap visualizations (P&L by weekday, by month, by market condition)

**Cost:** No additional cost if using Angel One data already ingested in Phase 4

---

## Part 7: Honest Complexity Summary

| Feature | Difficulty | Time (solo dev) | Blocker | Affordable? |
|---------|-----------|-----------------|---------|-------------|
| TradingView webhook bridge | 4/10 | 1-2 weeks | None | YES |
| Chartink webhook bridge | 4/10 | 3-5 days | None | YES |
| Forward test / paper trading | 6/10 | 2-4 weeks | None | YES |
| ClickTrade strategy builder (basic) | 7/10 | 6-8 weeks | None | YES |
| Payoff graph + Greeks | 5/10 | 1-2 weeks | None | YES |
| Scenario analysis | 6/10 | 2-3 weeks | None | YES |
| Monte Carlo analysis | 7/10 | 2-4 weeks | None | YES |
| Signals AI (indicators + NL) | 6/10 | 3-4 weeks | OpenAI key | YES (tiny cost) |
| Historical data pipeline | 7/10 | 6-8 weeks | Angel/Zerodha account | YES (₹0-2000/month) |
| Basic index backtest engine | 9/10 | 3-5 months | Historical data first | YES (with Zerodha ₹2000/mo) |
| Full 500-stock backtest + IV | 10/10 | 12+ months | TrueData subscription | ₹2000-5000/month |
| 7.5-year options data (AlgoTest parity) | 10/10 | 18-24 months | Data procurement | ₹5000-20000/month |

---

## Part 8: What AlgoTest Does That You Should NOT Try to Replicate Yet

1. **60+ broker integrations**: AlgoTest has spent years integrating 60+ brokers. You have Kotak. That's enough for v1. Multi-broker is a V3+ feature.

2. **Full options universe (500 stocks)**: Stick to NIFTY, BANKNIFTY, FINNIFTY for MVP. The data cost and storage for 500 stock options is prohibitive solo.

3. **7.5-year historical data**: Start with 2-3 years via free/cheap APIs. Users care more about recent data anyway (market regime changed significantly after COVID).

4. **SEBI-empanelled live algo execution for others**: If NeoTrade is a personal tool, this is fine. If you intend to offer it as a SaaS product for other traders to run live algos, you need SEBI empanelment (complex regulatory process). **Do not skip this step if going commercial.**

5. **Trade replay with .clicktrade files**: Nice-to-have, not a blocker.

---

## Part 9: Third-Party Dependencies Summary

| Dependency | Purpose | Cost | Required? |
|-----------|---------|------|-----------|
| Angel One SmartAPI | Free historical F&O data | FREE (account) | YES for backtest |
| Zerodha Kite Connect | Better historical data (10yr) | ₹2000/month | OPTIONAL upgrade |
| TrueData | Historical IV + Greeks | ₹999-1999/month | For advanced backtest |
| OpenAI API | Natural language strategy builder | ~$5-20/month | For Signals AI |
| TradingView Essential | User-paid for TV webhook source | $15/month (user's cost) | User provides |
| Chartink Premium | User-paid for Chartink alerts | ₹780/month (user's cost) | User provides |
| Kotak Neo API | Already integrated | FREE | YES (execution) |
| greeks (npm) | B-S Greeks calculation | FREE (MIT) | For ClickTrade |
| TimescaleDB / DuckDB | Time-series OHLC storage | FREE (open source) | For backtest |

---

## Sources

### PRIMARY (HIGH confidence)
- [AlgoTest official homepage](https://algotest.in/) — platform overview
- [AlgoTest pricing breakdown docs](https://docs.algotest.in/getting-started/pricing-breakdown/) — pricing tiers
- [AlgoTest execution plans](https://docs.algotest.in/getting-started/pricing-breakdown/execution-plans-algotest/) — live/forward test pricing
- [AlgoTest TradingView signal connection docs](https://docs.algotest.in/signals/signal-connection/) — technical webhook flow
- [AlgoTest Chartink signal connection docs](https://docs.algotest.in/signals/signal-connection-chartink/) — Chartink webhook flow
- [AlgoTest ClickTrade strategy builder docs](https://docs.algotest.in/clicktrade/strategy-builder/creating-managing-strategies/basic-strategy-creation/) — strategy builder features
- [AlgoTest simulator docs](https://docs.algotest.in/clicktrade/simulator/) — simulator features
- [Kotak Neo support — historical data](https://www.kotakneo.com/support/how-do-i-get-historical-data/) — confirms NO historical data
- [Zerodha Kite Connect historical data](https://kite.trade/docs/connect/v3/historical/) — historical OHLC API details
- [Angel One SmartAPI docs](https://smartapi.angelbroking.com/docs) — free historical data
- [Upstox historical candle API](https://upstox.com/developer/api-documentation/get-historical-candle-data/) — free, limited history
- [TradingView pricing (webhook requirements)](https://www.tradingview.com/pricing/) — Essential plan required for webhooks
- [Chartink webhook support](https://chartink.com/articles/alerts/webhook-support-for-alerts/) — Chartink Premium required
- [TrueData pricing](https://www.truedata.in/price) — paid data plans
- [TraderUnited AlgoTest review](https://tradersunited.org/blog/algotest-review-trading-platform) — independent feature review

### SECONDARY (MEDIUM confidence)
- AlgoTest blog posts on backtest how-to — feature descriptions verified against docs
- NSE India F&O historical data bhavcopy — structure confirmed via nseindia.com
- Zerodha Z-Connect blog on free personal APIs — confirmed free tier details
- Multiple community forum posts on Kotak Neo historical data gap — consistent with official support page

### Project codebase (VERIFIED via Read tool)
- `d:/tradepro/service/backend/src/server.js` — mock tick feed, WebSocket architecture
- `d:/tradepro/service/backend/src/services/marketData.service.js` — existing indicator implementations
- `d:/tradepro/service/backend/package.json` — confirmed dependencies

---

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | Angel One SmartAPI provides 2+ years of 1-min F&O OHLC for free | Data window may be shorter; fallback to Zerodha at ₹2000/mo |
| A2 | Black-Scholes `greeks` npm package is accurate for NSE European-style options | Minor Greeks inaccuracy; NSE options are European-style, so B-S is appropriate |
| A3 | SEBI 2025 algo rules allow personal-use algo tools without empanelment | If SEBI tightens interpretation, live algo execution may be restricted |
| A4 | AlgoTest uses 1-min OHLC (confirmed in docs) not tick data | If tick data is used for precise entry simulation, 1-min OHLC backtests will show optimistic results |
| A5 | DuckDB or TimescaleDB can handle 150M rows for NIFTY+BANKNIFTY on affordable VPS | Performance testing needed; DuckDB benchmarks suggest this is feasible |
