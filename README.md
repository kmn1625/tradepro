# NeoTrade

NeoTrade is a React + Node trading workstation for Indian markets. Live Kotak broker/API execution is intentionally deferred for now; the current focus is paper trading, signals, ClickTrade analysis, historical data ingestion, and a future-ready backtest engine.

## Current Modules

- Execution terminal with watchlists, charts, market depth, positions, and order history.
- TradingView and Chartink webhook receivers.
- Strategy token management.
- Paper trading portfolio engine.
- Algo condition builder and paper algo engine.
- AI condition parser through Anthropic.
- ClickTrade option strategy builder with payoff graph, Greeks, and scenario analysis.
- Backtester with simulated pricing fallback and DuckDB historical-data support.
- Angel One historical index-candle ingestion scaffolding.

## Deferred

- Live Kotak broker execution for signal/algo strategies.
- Production-grade Kotak streaming integration.
- Real multi-leg live basket execution.

## Project Structure

```text
service/
  backend/   Express API, WebSocket feed, paper engine, historical DB
  frontend/  React/Vite trading UI
  data/      DuckDB historical database
```

## Backend Setup

```powershell
cd service/backend
npm install
Copy-Item .env.example .env
npm run dev
```

The backend runs on `http://localhost:5000` and exposes WebSocket updates on `ws://localhost:5000`.

For normal local development without broker credentials, the backend starts a mock market feed and paper-mode features remain usable.

## Frontend Setup

```powershell
cd service/frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Tests

Backend:

```powershell
cd service/backend
npm.cmd test -- --runInBand
```

Frontend:

```powershell
cd service/frontend
npm.cmd test
```

In restricted filesystem sandboxes, Vitest/esbuild may fail while traversing protected Windows parent directories. The frontend tests pass outside that sandbox restriction.

## Historical Data

Historical backfill uses Angel One SmartAPI credentials and stores candles in DuckDB.

```powershell
cd service/backend
node scripts/backfill.js --symbol NIFTY --from 2024-01-01 --to 2024-01-31
```

Current historical ingestion is index-spot focused. Option contract master lookup and option candle backfill are next-phase work.

## Implementation Roadmap

See [IMPLEMENTATION_TODO.md](IMPLEMENTATION_TODO.md) for the full one-by-one backlog.
