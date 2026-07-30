# Apex Trader 2.0

Grid-based algorithmic crypto trading bot on [Alpaca](https://alpaca.markets/), with a Next.js dashboard.

> ⚠️ **Paper trading by default.** `TRADING_MODE=paper` forces every request to the paper endpoint regardless of `ALPACA_BASE_URL`. Switching to live requires deliberately changing that variable.

## Layout

```
apex-trader/
├── bot/                      # trading engine (Node, ESM)
│   ├── src/
│   │   ├── index.js          # one-shot: derive grid, report the book
│   │   ├── loop.js           # continuous run loop entry
│   │   ├── runner.js         # tick: stops -> fills -> resize -> reconcile
│   │   ├── grid/
│   │   │   ├── config.js     # normalize, validate, resolve stops
│   │   │   ├── sizing.js     # ratios -> concrete grid, anchor policy
│   │   │   ├── rebalance.js  # resize triggers + round-trip invariant
│   │   │   └── engine.js     # levels, desired book, reconcile, fills
│   │   ├── api/
│   │   │   ├── alpaca.js     # REST client over fetch
│   │   │   └── check-account.js
│   │   ├── data/             # market data adapters — empty
│   │   ├── logging/          # structured logging — empty
│   │   └── utils/
│   │       ├── env.js        # env loading + safety interlocks
│   │       └── state.js      # anchor persistence
│   ├── backtest/             # backtest harness — empty
│   └── tests/                # 75 tests
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
npm run bot:check            # read-only: verify Alpaca credentials
npm run bot                  # one pass: derive the grid, report what it would rest
npm run bot:loop             # continuous run loop (Ctrl-C to stop)
npm run dashboard            # http://localhost:3000
                             # http://localhost:3000/prototype  <- mobile UI (mock data)
npm test                     # all workspace tests
```

`DRY_RUN` defaults to **true** even when unset or empty, so all of the above are safe. Set `DRY_RUN=false` to place real (paper) orders.

### The run loop

Each tick: read live state → check stops → ingest fills → maybe resize → maybe re-anchor → reconcile.

```
[   1] $64818.69  inv 0  realized +$0.00  day +$0.00/$-5.00  +11/-0
                  │              │                  │         └─ submitted/cancelled
                  │              │                  └─ daily limit
                  │              └─ realized P&L this run
                  └─ open inventory
```

Ordering inside a tick is deliberate: **stops are evaluated before anything is placed**, so a breached limit can never be followed by fresh exposure in the same pass. `reconcile()` is the only thing that submits grid orders — fills are recorded via `recordFill()` for accounting and never re-submitted, otherwise every fill would get two counter-orders.

A failed tick is logged and retried rather than killing the process, so a transient 502 doesn't stop an unattended bot. Ctrl-C cancels resting orders before exiting: with the bot stopped nothing would place a counter-order against a fill, so leaving the book resting would let a buy fill with no exit behind it.

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

### Two stops, both scaled to the portfolio

They catch different failures, and neither is an absolute number you have to maintain.

| | Scales from | Limits | Default |
|---|---|---|---|
| `MAX_DAILY_LOSS_PCT` | live equity | how **fast** you lose | 5% |
| `GRID_STOP_PCT` | the band | how **far** one position runs against you | off |

```
daily stop = equity     × MAX_DAILY_LOSS_PCT     -$5 at $100, -$500 at $10k
stop price = lowerBound × (1 − GRID_STOP_PCT)    moves whenever the band moves
```

Daily P&L comes from Alpaca's `last_equity` (prior session close), so it needs no local bookkeeping and survives restarts for free.

**On breach they behave differently, on purpose.** The daily stop cancels resting orders and halts but *keeps the position* — halting is not the same as liquidating, and forcing an exit on a fast drawdown is usually the wrong reflex. The price stop does liquidate, with a market order, because its whole purpose is to bound a single position's loss.

`GRID_STOP_PCT` is opt-in and unset by default. Without it, inventory stranded below the band is held indefinitely and `on_flat` never re-anchors — the bot idles. Setting it converts that indefinite idle into a bounded, realized loss, after which the grid is flat and free to re-centre. That's a real trade-off: it crystallises losses that might have recovered.

`MAX_DAILY_LOSS_USD` remains available as a hard dollar floor; the tighter of the two wins.

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

**1. Nothing has traded yet.** `DRY_RUN` defaults to **true** even when unset — the bot plans the book and reports it, and submits nothing. Set `DRY_RUN=false` to place real (paper) orders.


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
- [x] Order placement + fill tracking
- [x] Run loop + daily and price stops
- [ ] Dashboard API endpoints
- [ ] Port prototype components to ES modules, on real data
- [ ] 6-month backtest harness
