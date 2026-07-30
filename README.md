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
│   ├── app/
│   │   ├── page.js           # build-status shell
│   │   ├── layout.js
│   │   └── globals.css       # design tokens (mirrored from the design system)
│   └── public/prototype/     # vendored Claude Design build — runs as-is
│       ├── index.html        # React 18 UMD + Babel loader
│       ├── _ds/apex/         # design system bundle + token CSS
│       ├── app/              # the 13 prototype components
│       └── assets/
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
                             # http://localhost:3000/prototype  <- mobile UI (mock data)
npm test                     # all workspace tests
```

## Grid strategy

A grid spans a price band across `GRID_LEVELS` levels. Resting BUYs sit below the current price, resting SELLs above it. Each buy-then-sell round trip across one level gap is the profit unit.

| Spacing | Level formula | Use when |
|---|---|---|
| `arithmetic` | `lower + i·(upper−lower)/(n−1)` | narrow bands, stable price |
| `geometric` | `lower·(upper/lower)^(i/(n−1))` | crypto — constant % per round trip |

### Everything is derived from live state

Nothing about the band or the order size is hard-coded, so nothing goes stale as the account grows:

```
anchor      = market price at first run (persisted)
bounds      = anchor ± GRID_BAND_PCT
order size  = (equity × GRID_ALLOCATION_PCT) / (levels × upperBound)
daily stop  = equity × MAX_DAILY_LOSS_PCT
```

Equity, buying power, market price, and the exchange's `min_order_size` are all read from Alpaca at startup. Two limits are then checked against live numbers rather than static config: the derived order size must clear the exchange minimum, and worst-case notional must fit inside actual buying power.

`MAX_POSITION_USD` no longer exists — live buying power replaced it.

### ⚠️ Anchor mode is a strategy decision

`GRID_ANCHOR_MODE` controls whether the band can follow price, and the two behaviours are not interchangeable:

| Mode | Band | Consequence |
|---|---|---|
| `on_flat` *(default)* | re-centres, but only when flat | runs continuously while ranging; idles while holding out-of-band |
| `session` | fixed after first run | price can leave it → bot idles |
| `manual` | pinned to `GRID_ANCHOR_PRICE` | same, at a price you choose |
| `rolling` | re-centres on price, always | **never idles — averages down forever in a downtrend** |

The idling is the feature. It's what stops the grid buying all the way down a trend. `rolling` removes that brake: because the band chases price, `isOutOfBand()` never fires. That is the classic way grid bots blow up. If you use it, pair it with a tight `MAX_DAILY_LOSS_PCT` and an exit plan.

`on_flat` is the middle path and the default. It re-centres readily — but only once the previous band has been fully closed out, because held inventory still needs the exit levels that would disappear. In a ranging market it closes out, re-centres and repeats. If price gaps away while it's holding, it keeps the band and idles until that position closes. The cost is capital sitting idle; the benefit is that it never averages into a fall.

`on_flat` and `rolling` are *identical* when flat. They differ only while holding — there's a test asserting exactly that.

The anchor is persisted to `bot/state/anchor.json` (gitignored) so a restart doesn't silently re-centre a `session` grid.

### Compounding while running

`GRID_RESIZE_MODE` controls when newly-opened levels adopt a freshly derived size, so realized profit compounds without a restart:

| Mode | Re-sizes | Resting book |
|---|---|---|
| `on_flat` *(default)* | once inventory is fully closed | one size at a time |
| `on_fill` | after any fill past the threshold | mixed sizes |
| `session` | never mid-run | one size |

`GRID_RESIZE_THRESHOLD` (default 10%) suppresses churn — without it every cent of equity movement would cancel and replace the whole resting grid.

**The invariant that makes this safe:** a counter-order carries the *original fill's* quantity, never the current derived size. `counterOrderFor()` in `grid/rebalance.js` is the only sanctioned way to build one. Sizing a closing order from fresh numbers makes buy and sell quantities drift apart — too large and Alpaca rejects it for insufficient position (you cannot short crypto), too small and inventory silently accumulates.

Re-anchoring is separately gated by `canReanchor()`, which refuses while inventory is open: moving the band would strand held positions with no exit levels resting against them.

### Pinning absolute values

Set `GRID_LOWER_BOUND`, `GRID_UPPER_BOUND`, **and** `GRID_ORDER_SIZE` together to opt out of derivation entirely. The bot warns when you do, because those values won't scale and you'll be re-setting them by hand.

## Known gaps

**1. Nothing has traded yet.** `reconcile()` and `onFill()` are implemented and tested, but `DRY_RUN` defaults to **true** even when unset — the bot plans the book and reports it, and submits nothing. Set `DRY_RUN=false` to place real (paper) orders.

There is also no run loop yet: `npm run bot` reconciles once and exits. Continuous operation needs a poll loop around `reconcile()` plus a fill stream.

### What actually rests

The book is *not* "buys below, sells above" — that would place sells for inventory you don't own. What rests is:

- **BUY** at each level below price not already holding inventory
- **SELL** one level above each level that *is* holding inventory

So a cold start from flat rests **only buys**; sells appear as buys fill. `assignSides()` shows the warmed-up shape for display, `desiredOrders()` decides what to actually submit — they are deliberately different functions.

Orders are tagged with a `client_order_id` of the form `apex-BTCUSD-L7-sell-42`, so `reconcile()` only ever touches its own orders (anything you place by hand in the Alpaca UI is left alone) and `hydrate()` can rebuild inventory from exchange history after a restart.

**2. The prototype UI runs, but on mock data.** `npm run dashboard` then open **http://localhost:3000/prototype**.

This is the Claude Design build vendored verbatim — React 18 UMD + Babel-in-browser, components as `window` globals. It is deliberately *outside* the Next.js build (it lives in `public/`, which Next serves as static files). It does not use React 19, Tailwind, or any bundler.

Every number it shows is fake. `app/data.js` is a deterministic mock layer and `window.ApexLive` jitters prices with `Math.random()` on a timer. There are **no network calls in any prototype file** — it cannot show real positions, fills, or P&L.

Treat it as a visual reference, not a dashboard.

**3. The prototype is not ported to Next.js.** The components can't be imported as modules:

- Each is an IIFE attaching to `window.*` — no `import`/`export` anywhere.
- They read a global `React` rather than importing it.
- They style with inline styles + CSS custom properties, not Tailwind utilities.

`window.ApexTraderDesignSystem_cd55a5` is supplied by `_ds/apex/_ds_bundle.js`, which exports `Icon`, `ICON_NAMES`, `Badge`, `PriceChange`, `Sparkline`, `StatCard`, `Tag`, `Button`, `IconButton`, `Input`, `Select`, `Switch`, `Avatar`, `Card`, and `Tabs`.

Porting checklist, per file: unwrap the IIFE → `import React from 'react'` → replace `window.X` reads with imports → add `'use client'` where hooks are used → `export` the component. Ported files belong in `dashboard/app/components/` (currently empty by design), leaving the prototype intact as a reference.

`ios-frame.jsx` is a standalone device-frame scaffold marked `@ds-adherence-ignore`; port it last or drop it.

### Design tokens

`app/globals.css` mirrors the design system's tokens by hand; the canonical copies are `public/prototype/_ds/apex/tokens/*.css`. **Change a value in one, mirror it to the other.** Brand families are Sora and JetBrains Mono, loaded from Google Fonts — swap for self-hosted `.woff2` if you need offline builds.

Note `--inset-top` is a *box-shadow*, not a length: `inset 0 1px 0 rgba(255,255,255,0.05)`.

Upstream source: `claude.ai/design/p/0dc922ad-d90b-49a0-82c3-a20c7a389ff4`. A second design system (`pennant-design-system-e1dbf999…`) exists in that project but is unused here.

## Roadmap

- [x] Monorepo + build config
- [x] Grid level calculation + config validation
- [x] Design system vendored — prototype UI runs at `/prototype`
- [ ] Alpaca client + account smoke test (credentials still unverified)
- [ ] Order placement + fill tracking
- [ ] Dashboard API endpoints
- [ ] Port prototype components to ES modules, on real data
- [ ] 6-month backtest harness
