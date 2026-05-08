# Apex Trader

Backtest-first crypto trading engine with a Next.js dashboard.

**Stack:** TypeScript engine (CLI) + Next.js frontend, SQLite for state.

---

## Architecture

```
apex-trader/
├── src/                      ← TypeScript engine
│   ├── strategies/             smaTrend, rsiMeanRevert, breakoutMomentum,
│   │                           crashProtectedHold, regimeFilter
│   ├── live/liveRunner.ts      one tick of the live loop (cron-driven)
│   ├── scripts/                fetchBars, runBacktest, runMatrix,
│   │                           runOptimizer, runPortfolio, runLiveTick, ...
│   ├── alpaca.ts               Alpaca API client (data + trading)
│   ├── backtest.ts             single-strategy backtester
│   ├── portfolio.ts            multi-sleeve portfolio sim
│   ├── optimizer.ts            param search
│   ├── regime.ts               BTC regime classifier
│   └── db.ts                   SQLite reads/writes
│
├── frontend/                 ← Next.js dashboard
│   ├── app/                    /, /runs, /matrix, /portfolios, /how-it-works
│   └── lib/db.ts               read-only SQLite connection
│
└── data/
    └── apex.db                 SQLite — backtest runs, regimes, live trades
```

The frontend reads `data/apex.db` directly (read-only). The CLI scripts are the only writers.

---

## Local Setup

```bash
npm install                          # engine deps
cd frontend && npm install && cd ..  # dashboard deps
cp .env.example .env                 # add Alpaca keys

npm run fetch-bars                   # seed data/apex.db with historical bars
npm run backtest                     # run a backtest

cd frontend && npm run dev           # dashboard at http://localhost:3100
```

---

## Engine Scripts

| Script | What it does |
|---|---|
| `npm run fetch-bars` | Pull historical OHLCV bars from Alpaca into SQLite |
| `npm run fetch-regimes` | Classify BTC regimes (bull/bear/chop) over history |
| `npm run backtest` | Single-strategy backtest, results to SQLite |
| `npm run matrix` | Strategy x symbol x params matrix |
| `npm run optimize` | Param search for one strategy |
| `npm run optimize-matrix` | Optimizer over the full matrix |
| `npm run portfolio` | Multi-sleeve portfolio simulation |
| `npm run live-tick` | One tick of the live runner (call from cron) |

---

## Live Trading

`liveRunner.runTick()` is **one tick** — fetch latest bars, evaluate each sleeve's strategy, submit orders to Alpaca, log to SQLite. Scheduling is external (cron). For 1D-timeframe strategies, run once per day.

Safety:
- Paper mode by default. Live orders require both `ALPACA_LIVE_*` keys and `TRADING_ENABLED=true`.
- `runTick` is idempotent within a bar — running twice in the same period is a no-op.

---

## Alpaca Setup

1. Sign up at **alpaca.markets**.
2. Generate **paper** API keys for trading and **live** keys for data (Alpaca's crypto data API requires live keys even read-only).
3. Drop them into `.env`.
4. Leave `TRADING_ENABLED=false` until you've validated paper performance.

---

## Deploy (Railway)

`railway.toml` deploys the dashboard as a single Railway service:
- Build: installs root + frontend deps, runs `next build`.
- Start: `next start -p $PORT` from `frontend/`.

Required Railway env vars (paste from your `.env`):
```
ALPACA_API_KEY=
ALPACA_SECRET_KEY=
ALPACA_PAPER_API_KEY=
ALPACA_PAPER_SECRET_KEY=
TRADING_ENABLED=false
```

After first deploy, seed the database from a Railway shell:
```bash
npm run fetch-bars
npm run fetch-regimes
```

The SQLite file lives in `data/apex.db` — attach a Railway **volume** mounted at `/app/data` so the DB survives restarts.

For live trading, add a separate Railway service running `npm run live-tick` on a cron schedule, sharing the same volume.

---

## Risk

Crypto trading involves substantial risk of loss. Backtest results do not guarantee live performance. Start in paper mode and validate before enabling live trading.
