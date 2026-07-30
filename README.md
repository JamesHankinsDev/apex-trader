# Apex Trader 2.0

Grid-based algorithmic crypto trading bot on [Alpaca](https://alpaca.markets/), with a Next.js dashboard.

> ⚠️ **Paper trading by default.** `TRADING_MODE=paper` forces every request to the paper endpoint regardless of `ALPACA_BASE_URL`. Switching to live requires deliberately changing that variable.

## Layout

```
apex-trader/
├── bot/                      # trading engine (Node, ESM)
│   ├── src/
│   │   ├── index.js          # entry point — currently a dry run
│   │   ├── grid/
│   │   │   ├── config.js     # strategy config: normalize + validate
│   │   │   └── engine.js     # level calc (done), placement/fills (TODO)
│   │   ├── api/              # dashboard API — empty
│   │   ├── data/             # market data adapters — empty
│   │   ├── logging/          # structured logging — empty
│   │   └── utils/env.js      # env loading + safety interlocks
│   ├── backtest/             # backtest harness — empty
│   └── tests/
├── dashboard/                # Next.js 15 App Router
│   └── app/
│       ├── page.js           # build-status shell
│       ├── layout.js
│       ├── globals.css       # design tokens
│       └── components/       # mobile prototype — NOT yet mounted (see below)
└── .github/workflows/test.yml
```

## Setup

```bash
npm run install-all          # npm workspaces — installs bot + dashboard

cp .env.example .env         # fill in Alpaca PAPER keys
cp bot/.env.example bot/.env # bot/.env takes precedence over root .env
```

Requires Node >= 20.

## Running

```bash
npm run bot                  # dry run: validates config, prints the grid
npm run dashboard            # http://localhost:3000
npm test                     # all workspace tests
```

## Grid strategy

A grid spans `GRID_LOWER_BOUND` to `GRID_UPPER_BOUND` across `GRID_LEVELS` price levels. Resting BUYs sit below the current price, resting SELLs above it. Each buy-then-sell round trip across one level gap is the profit unit.

| Spacing | Level formula | Use when |
|---|---|---|
| `arithmetic` | `lower + i·(upper−lower)/(n−1)` | narrow bands, stable price |
| `geometric` | `lower·(upper/lower)^(i/(n−1))` | crypto — constant % per round trip |

Risk limits are enforced at startup: `assertWithinRiskLimits()` refuses to run if the grid's worst-case notional (`orderSize × levels × upperBound`) exceeds `MAX_POSITION_USD`.

## Known gaps

**1. Grid engine is partially implemented.** `calculateLevels()`, `assignSides()`, and validation are done and tested. `GridEngine.reconcile()` and `GridEngine.onFill()` throw — they need a live Alpaca client. This is the next build step.

**2. The dashboard prototype is not mounted.** The 13 files in `dashboard/app/components/` came from a browser-based prototype. They cannot be imported by Next.js as-is:

- Each is an IIFE that attaches to `window.*` — no `import` or `export` anywhere.
- They read a global `React` rather than importing it.
- They depend on `window.ApexTraderDesignSystem_cd55a5`, **which does not exist in this repo.** Every reference reads it; nothing defines it. Its `Icon`, `Sparkline`, `Badge`, and `PriceChange` exports need to be sourced or rewritten.
- They style with inline styles + CSS custom properties, not Tailwind utilities. The tokens are declared in `app/globals.css`; `tailwind.config.js` mirrors them for new work.

Porting checklist, per file: unwrap the IIFE → add `import React from 'react'` → replace `window.X` reads with imports → add `'use client'` where hooks are used → `export` the component.

`ios-frame.jsx` is a standalone device-frame scaffold and is marked `@ds-adherence-ignore`; it can be ported last or dropped.

## Roadmap

- [x] Monorepo + build config
- [x] Grid level calculation + config validation
- [ ] Order placement + fill tracking
- [ ] Dashboard API endpoints
- [ ] 6-month backtest harness
- [ ] Port prototype components to ES modules
