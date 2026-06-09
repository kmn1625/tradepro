# TradePro — Feature Gap Analysis & Implementation Roadmap

> Generated: 2026-06-07  
> Based on: trade.txt feature spec vs current codebase audit  
> Broker: Kotak Neo (primary), AngelOne/Upstox (stubs)

---

## What Already Exists (Do NOT re-implement)

| Module | Status | Notes |
|--------|--------|-------|
| Auth (Kotak Neo OAuth) | ✅ Done | login, session, JWT |
| Watchlist | ✅ Done | add/remove/search symbols |
| Real-time market data | ✅ Done | WebSocket feed, LTP, bid/ask, depth |
| Order placement | ✅ Done | MKT, LIMIT, SL-M, SL-L, AMO, Cover, Bracket |
| Basket & Bulk orders | ✅ Done (backend) | UI exists but basic |
| Option chain + Greeks | ✅ Done | CE/PE, Delta/Gamma/Theta/Vega |
| Payoff graph | ✅ Done | Options P&L diagram |
| Algo trading engine | ✅ Done | condition eval, start/stop/pause, trade log |
| Backtesting engine | ✅ Done | DuckDB, metrics, equity curve |
| Paper trading | ✅ Done | virtual portfolio, P&L, slippage |
| Webhook signals | ✅ Done | TradingView + Chartink receivers |
| Strategy CRUD | ✅ Done | Firestore, UUID tokens |
| Candlestick chart | ✅ Done | lightweight-charts, OHLC |
| Technical indicators (backend) | ✅ Done | RSI, EMA, SMA, MACD, BB, VWAP |
| AI condition parser | ✅ Done | NL → condition JSON (Anthropic) |
| Historical data | ✅ Done | DuckDB ingest, query |
| Portfolio / Positions view | ✅ Done | MTM, exit position |
| Order history | ✅ Done | audit trail |

---

## Gap Analysis — What Is MISSING

### Phase 1 — MVP Completion (Estimated: 2–3 weeks)

These features are foundational. App is incomplete without them.

#### 1.1 Funds & Wallet Module
**MISSING entirely**

- [ ] Available balance display (fetch from broker API)
- [ ] Used margin breakdown
- [ ] Add funds flow (UPI/NEFT redirect or mock)
- [ ] Withdraw funds flow
- [ ] Fund ledger (transaction history)
- [ ] Payout request status

**Files to create:**
- `frontend/src/components/Funds.jsx`
- `backend/src/routes/funds.routes.js`
- `backend/src/controllers/funds.controller.js`

---

#### 1.2 Holdings Improvements
**Partially exists — needs additions**

- [ ] Realized P&L (closed trades) vs Unrealized P&L (open positions) — split display
- [ ] Day P&L column
- [ ] Corporate actions section (bonus, splits)
- [ ] Dividend history

**Files to modify:**
- `frontend/src/App.jsx` (Portfolio tab, holdings section)
- `backend/src/controllers/market.controller.js` (holdings endpoint)

---

#### 1.3 Notifications System
**MISSING entirely**

- [ ] In-app notification bell + dropdown
- [ ] Order executed notification
- [ ] Stop-loss hit notification
- [ ] Target achieved notification
- [ ] Margin shortfall warning
- [ ] Toast notifications for real-time events

**Files to create:**
- `frontend/src/components/NotificationCenter.jsx`
- `backend/src/services/notificationService.js`
- Wire into: WebSocket message handler + Firebase listeners

---

#### 1.4 User Profile Page
**MISSING**

- [ ] Display name, email, broker account ID
- [ ] Broker connection status
- [ ] Session info (token expiry)
- [ ] Logout button (exists but no profile page)

**Files to create:**
- `frontend/src/components/UserProfile.jsx`

---

#### 1.5 Chart — Indicator Overlays (Frontend)
**Backend calculates indicators; frontend chart doesn't show them**

- [ ] EMA overlay on candlestick chart
- [ ] SMA overlay
- [ ] Bollinger Bands overlay
- [ ] VWAP line
- [ ] RSI sub-panel below chart
- [ ] MACD sub-panel

**Files to modify:**
- `frontend/src/components/CandleChart.jsx`

---

### Phase 2 — Core Trading Features (Estimated: 3–4 weeks)

#### 2.1 Price Alerts
**MISSING entirely**

- [ ] Create alert: symbol + above/below + price
- [ ] Alert list (active/triggered)
- [ ] Delete alert
- [ ] Push notification when triggered (WebSocket → frontend)
- [ ] Indicator alerts (RSI cross level, EMA crossover)

**Files to create:**
- `frontend/src/components/Alerts.jsx`
- `backend/src/routes/alerts.routes.js`
- `backend/src/controllers/alerts.controller.js`
- `backend/src/services/alertEngine.service.js`

---

#### 2.2 GTT Orders (Good Till Triggered)
**MISSING entirely**

- [ ] GTT order form (trigger price + order price)
- [ ] OCO variant (target + SL together)
- [ ] GTT order list (active/triggered/expired)
- [ ] Modify/cancel GTT
- [ ] "Lifetime" order support

**Files to create:**
- `frontend/src/components/GTTOrders.jsx`
- `backend/src/routes/gtt.routes.js`
- `backend/src/controllers/gtt.controller.js`
- `backend/src/services/gttEngine.service.js`

---

#### 2.3 Screener / Scanner
**Framework exists but not implemented**

- [ ] Top gainers/losers table (from live data)
- [ ] Volume shockers (unusual volume alert)
- [ ] Breakout stocks (price crossing key level)
- [ ] RSI scan (RSI < 30 or > 70)
- [ ] EMA crossover scan
- [ ] Gap up/down stocks

**Files to create:**
- `frontend/src/components/Screener.jsx`
- `backend/src/routes/screener.routes.js`
- `backend/src/controllers/screener.controller.js`
- `backend/src/services/screener.service.js`

---

#### 2.4 Options Strategies Builder
**Chain exists, strategies MISSING**

- [ ] Strategy selector: Straddle, Strangle, Iron Condor, Butterfly, Calendar Spread, Covered Call
- [ ] Auto-populate legs based on strategy type
- [ ] Combined payoff graph for multi-leg
- [ ] Execute strategy as basket order
- [ ] PCR (Put-Call Ratio) display
- [ ] OI (Open Interest) column on chain
- [ ] OI Change column

**Files to modify:**
- `frontend/src/components/OptionChain.jsx`
- `frontend/src/components/PayoffGraph.jsx`

---

#### 2.5 Chart Drawing Tools
**MISSING**

- [ ] Trend line (click-drag)
- [ ] Horizontal line (support/resistance)
- [ ] Rectangle selection
- [ ] Fibonacci retracement
- [ ] Persist drawings per symbol

**Files to modify:**
- `frontend/src/components/CandleChart.jsx`

---

#### 2.6 IPO Module
**MISSING**

- [ ] Current IPO listings with dates/price band
- [ ] Upcoming IPOs
- [ ] Apply IPO form (UPI mandate or mock)
- [ ] Allotment status

**Files to create:**
- `frontend/src/components/IPO.jsx`
- `backend/src/routes/ipo.routes.js`
- Use NSE/BSE public APIs or mock data

---

### Phase 3 — Analytics & Reports (Estimated: 2–3 weeks)

#### 3.1 Portfolio Analytics Dashboard
**MISSING (basic P&L exists, full analytics MISSING)**

- [ ] CAGR calculation
- [ ] XIRR calculation
- [ ] Portfolio allocation pie chart (sector/stock %)
- [ ] Sector exposure bar chart
- [ ] Sharpe ratio display
- [ ] Max drawdown chart
- [ ] Beta / Alpha vs Nifty
- [ ] Risk score summary

**Files to create:**
- `frontend/src/components/PortfolioAnalytics.jsx`
- `backend/src/routes/analytics.routes.js`
- `backend/src/controllers/analytics.controller.js`
- `backend/src/services/analytics.service.js`

---

#### 3.2 Reports Module
**MISSING entirely**

- [ ] P&L report (date range filter)
- [ ] Capital gains report (short-term/long-term)
- [ ] Tax report (for ITR filing)
- [ ] Contract note PDF
- [ ] Ledger report (all debits/credits)
- [ ] Download as PDF
- [ ] Download as Excel/CSV

**Files to create:**
- `frontend/src/components/Reports.jsx`
- `backend/src/routes/reports.routes.js`
- `backend/src/controllers/reports.controller.js`
- `backend/src/services/pdfGenerator.service.js` (use `pdfkit` or `puppeteer`)

---

#### 3.3 News Module
**MISSING (stub only)**

- [ ] Company news feed (symbol-specific)
- [ ] Earnings calendar (upcoming results)
- [ ] Economic calendar (RBI, CPI, GDP events)
- [ ] Corporate actions (bonus, splits, dividends)

**Files to create:**
- `frontend/src/components/News.jsx`
- `backend/src/routes/news.routes.js`
- Integrate: NSE announcements API or financial news API

---

#### 3.4 AI Enhancements
**Partial — needs expansion**

- [ ] AI stock summary (given symbol → brief analysis)
- [ ] AI portfolio analysis (diversification score, risk warnings)
- [ ] AI scanner (breakout prediction, trend detection)
- [ ] AI trade journal (analyze past trades, identify mistakes)

**Files to modify:**
- `backend/src/controllers/ai.controller.js`
- `backend/src/routes/ai.routes.js`
- `frontend/src/App.jsx` (analytics tab — MarketInsights component)

---

### Phase 4 — Advanced Trading (Estimated: 3–4 weeks)

#### 4.1 Futures Trading Module
**MISSING entirely**

- [ ] Futures contract listing (expiry selection)
- [ ] Lot size display
- [ ] Margin requirement per contract
- [ ] Futures-specific order ticket
- [ ] Rollover alert (days to expiry)

**Files to create:**
- `frontend/src/components/Futures.jsx`
- `backend/src/routes/futures.routes.js`
- `backend/src/controllers/futures.controller.js`

---

#### 4.2 Iceberg Orders
**MISSING (other order types exist)**

- [ ] Iceberg order type in order ticket
- [ ] Disclosed quantity input
- [ ] Slice count display

**Files to modify:**
- `frontend/src/components/OrderTicket.jsx`
- `backend/src/controllers/market.controller.js`

---

#### 4.3 Target Lock / Smart Exit UI
**Trailing SL in bracket order exists, standalone UI MISSING**

- [ ] Target Lock toggle per open position
- [ ] Partial profit booking (% of position)
- [ ] Trailing stop loss config per position
- [ ] Auto-exit on target UI
- [ ] Max loss per day setting
- [ ] Max trades per day setting
- [ ] Capital protection % setting

**Files to create:**
- `frontend/src/components/SmartExit.jsx`
- `backend/src/services/riskGuard.service.js`

---

#### 4.4 Basket Order Dedicated UI
**Backend exists, frontend is basic**

- [ ] Basket builder (add multiple legs)
- [ ] Save basket with name
- [ ] Load saved basket
- [ ] Execute full basket in one click
- [ ] Import basket from CSV
- [ ] Options strategy pre-built baskets

**Files to create:**
- `frontend/src/components/BasketOrder.jsx`

---

### Phase 5 — Platform & Compliance (Estimated: 4–5 weeks)

#### 5.1 Security Hardening
**JWT exists, rest MISSING**

- [ ] Rate limiting on all API endpoints (`express-rate-limit`)
- [ ] Helmet.js headers
- [ ] Input sanitization / validation (`joi` or `zod`)
- [ ] Session timeout + auto-logout
- [ ] CSRF protection
- [ ] HTTPS enforcement in production

**Files to modify:**
- `backend/src/server.js`
- Add middleware layer

---

#### 5.2 Admin Panel
**MISSING entirely**

- [ ] User list view
- [ ] Strategy monitoring (all active algos)
- [ ] System health dashboard (API status, WS connections)
- [ ] Error log viewer
- [ ] Audit logs (who placed what order, when)

**Files to create:**
- `frontend/src/components/AdminPanel.jsx`
- `backend/src/routes/admin.routes.js`
- Protect with admin role check

---

#### 5.3 Multi-Broker Support
**Stubs exist for AngelOne, Upstox**

- [ ] Finish AngelOne integration (`angelone.service.js`)
- [ ] Finish Upstox integration (`upstox.service.js`)
- [ ] Broker selector in settings
- [ ] Unified order interface across brokers

---

#### 5.4 Social / Leaderboard (Optional)
**MISSING**

- [ ] Performance leaderboard (paper trading)
- [ ] Share strategy performance
- [ ] Public watchlist sharing

---

#### 5.5 Learning Module (Optional)
**MISSING**

- [ ] Glossary page (trading terms)
- [ ] Strategy guides
- [ ] Indicator explanations

---

## Summary Table — Feature Count

| Phase | Features | Priority | Effort |
|-------|----------|----------|--------|
| Phase 1 — MVP Completion | Funds, Holdings+, Notifications, Profile, Chart Indicators | Critical | 2–3 weeks |
| Phase 2 — Core Trading | Alerts, GTT, Screener, Options Strategies, Drawing Tools, IPO | High | 3–4 weeks |
| Phase 3 — Analytics & Reports | Portfolio Analytics, Reports, News, AI+ | High | 2–3 weeks |
| Phase 4 — Advanced Trading | Futures, Iceberg, Smart Exit, Basket UI | Medium | 3–4 weeks |
| Phase 5 — Platform | Security, Admin, Multi-broker, Social, Learning | Medium-Low | 4–5 weeks |

**Total estimated: 14–19 weeks for full platform**

---

## Quick Wins (< 1 day each)

These can be done immediately without new pages:

1. **Rate limiting** — add `express-rate-limit` to `server.js` (30 min)
2. **Helmet.js** — add to `server.js` (15 min)
3. **OI column on option chain** — add column to `OptionChain.jsx` if data available (1 hr)
4. **PCR display** — calculate and show on option chain header (1 hr)
5. **Toast notifications** — add toast library to frontend, wire to order events (2 hr)
6. **Reorder button** — in Order History tab, add "Reorder" to repeat past order (2 hr)
7. **52-week high/low badge** — show on watchlist when price near 52w level (1 hr)

---

## Recommended Start Order (Phase 1)

1. **Notifications** — unblocks user awareness for all subsequent features
2. **Funds/Wallet** — users need to see balance before trading
3. **Chart indicator overlays** — backend already done, frontend wiring only
4. **Holdings P&L split** — quick data display fix
5. **User Profile** — simple display page

---

*Use this file as living checklist. Check off items as implemented. Each phase builds on previous.*
