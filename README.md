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
│   │   │   ├── server.js     # read-only dashboard API
│   │   │   └── check-account.js
│   │   ├── data/             # market data adapters — empty
│   │   ├── logging/          # structured logging — empty
│   │   └── utils/
│   │       ├── env.js        # env loading + safety interlocks
│   │       └── state.js      # anchor persistence
│   ├── backtest/             # backtest harness — empty
│   └── tests/                # 162 tests
├── dashboard/                # Next.js 15 App Router
│   ├── app/
│   │   ├── page.js           # build-status shell
│   │   ├── live/page.js      # live bot monitor
│   │   ├── api/bot/          # server-side proxy (holds BOT_API_TOKEN)
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
npm run bot:probe            # measure exchange notional floors (paper only)
npm run bot:resume           # clear a latched halt
npm run dashboard            # http://localhost:3000
                             # http://localhost:3000/prototype/index.html  <- mobile UI (mock)
npm test                     # all workspace tests
```

`DRY_RUN` defaults to **true** even when unset or empty, so all of the above are safe. Set `DRY_RUN=false` to place real (paper) orders.

> ⚠️ **Never run `npm run dashboard:build` while `npm run dashboard` is live.** Both write to `dashboard/.next`, and the production build clobbers the dev server's chunk manifest — you get `Cannot find module './387.js'` at runtime. Recover with `rm -rf dashboard/.next` and restart the dev server.

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

### Rejections are never silent

Counting only successes made the worst failure mode invisible: a grid whose every order was refused reported `+0/-0` — identical to a healthy converged one. It ran six ticks looking perfectly fine while placing nothing.

Now rejections are counted, named, and escalated:

```
[   1] $64788.27  inv 0  ...  +0/-0  ⚠ 11 REJECTED (stall 1/3)
[   2] $64788.27  inv 0  ...  +0/-0  ⚠ 11 REJECTED (stall 2/3)
[runner] 3 consecutive ticks with every order rejected: cost basis must be >= minimal amount of order 10
[runner] halted: stalled
```

A tick counts as stalled when it wanted to place orders and every one was refused. `STALL_LIMIT` consecutive stalls halt the loop with `HALT.STALLED`, quoting the exchange's own reason. A single good tick resets the counter, so a transient rejection never accumulates toward a halt. `/live` raises a banner and the status pill turns amber the moment any rejection appears.

This is the safety net for the *next* undocumented exchange rule, not just this one.

### Idling is not the same as working

Out of band while **flat** costs nothing — the grid is waiting to re-anchor. Out of band while **holding** is capital locked in a position with no exit resting against it, and it is the state `on_flat` deliberately accepts as the price of never averaging into a fall.

The problem was that it looked identical to a healthy bot. Over the bundled datasets the grid spent **40–44% of a six-month run** idle-while-holding, with unbroken stretches of 44 and 58 days, while `/health` reported `ok` and the log said nothing but `IDLE`.

```
[ 412] $2801.58  inv 0.0154  realized +$13.50  day +$0.00/$-50.00  +0/-0  ⚠ IDLE HOLDING 0.0154 for 3.2d
```

`/health` gains `degraded`, `idleHolding` and `idleMs`, and `IDLE_ALERT_HOURS` (default 24) sets when `degraded` trips.

**It deliberately does not halt, and does not fail the probe.** An idle grid recovers by itself the moment price re-enters the band it still holds exit levels for. Halting would turn a temporary pause into a permanent one needing a human, and failing `/health` would have the platform restart a bot that is working as designed — a restart loop is worse than the thing being reported. Alert on `degraded`.

A failed tick is logged and retried rather than killing the process, so a transient 502 doesn't stop an unattended bot. Ctrl-C cancels resting orders before exiting: with the bot stopped nothing would place a counter-order against a fill, so leaving the book resting would let a buy fill with no exit behind it.

## Dashboard API

`npm run bot:loop` also serves a read-only API on `API_PORT` (default 4000), and the dashboard's `/live` page polls it every 2s.

| Route | Returns |
|---|---|
| `/health` | running, halted, dryRun, ticks, uptime, degraded, idleHolding, idleMs — **always open**, for platform probes |
| `/state` | full snapshot: account, market, grid, position, book, ladder, fills |
| `/grid` | config + ladder + desired book |
| `/position` | inventory, held levels, realized P&L |
| `/fills` | last 50 fills |

Three properties worth knowing:

**It never calls Alpaca.** Every route serves the Runner's in-memory snapshot, so the dashboard can poll hard without burning rate limit or racing a tick. The loop is the only thing that talks to the exchange.

**It is read-only.** Every route is GET; anything else returns 405. There is no endpoint that places, cancels, or modifies an order — a compromised dashboard cannot move money. A test asserts `/submit`, `/cancel`, `/liquidate` and `/halt` all 404.

**Binding fails safe.** Without `API_TOKEN` the server binds `127.0.0.1` only and *ignores* a request to bind elsewhere. Set a token to expose it.

The dashboard reaches it through `app/api/bot/[...path]/route.js`, a server-side proxy holding `BOT_API_TOKEN`. That's deliberately not a Next rewrite: a rewrite is a transparent proxy and can't attach a header, so it would either bypass auth or fail. The token is server-only and never reaches the browser.

## Backtesting

```bash
npm run bot:backtest                                    # default config
npm run bot:backtest -- --sweep                         # compare bands
npm run bot:backtest -- --months 6 --band 0.075 --levels 6
```

It drives the **real** `Runner`, and therefore the real engine, sizing, rebalance and stop logic, against a simulated exchange — one tick per bar. A reimplementation of the strategy would only test itself.

`backtest/broker.js` deliberately reproduces the exchange behaviours that broke us live, so a regression in any of those fixes fails the backtest too:

- fees taken **out of the delivered asset**, not charged in cash
- a notional floor that rejects small orders
- `buying_power` reported net of resting buys
- `qty_available` reported net of resting sells
- `client_order_id` uniqueness
- `last_equity` rolling at **day boundaries**, not pinned to the opening balance

That last one mattered more than it looks. Pinned, `equity − last_equity` is total P&L since the run began rather than the day's move, so the daily stop in simulation was a different rule from the one in production and no per-day logic could be tested at all.

**Stops default off in the backtest, and that's a measurement decision.** A halt is terminal — production latches it to disk and waits for `npm run bot:resume` — so one bad day ends a six-month run and the result reports "time until the first 5% day" rather than how the grid performed. Turn them on to evaluate the stops themselves:

```bash
npm run bot:backtest -- --drawdown 0.20            # arm the drawdown stop
npm run bot:backtest -- --daily 0.05 --stop 0.10   # arm the other two
```

The header always states which stops were active, so a run can't quietly look like it was protected when it wasn't.

**What it can and cannot prove.** It replays real *prices*, so it exercises grid logic over many cycles. It cannot discover new exchange *behaviours* — the broker only knows rules we have already learned. Every bug found live so far was an integration bug, not a logic one.

Fills assume no slippage past the limit, which is the optimistic end. Intrabar path is unknowable from OHLC, so bar direction decides whether buys or sells are touched first.

## Deploying

Step-by-step for Railway (bot) + Vercel (dashboard): **[DEPLOY.md](DEPLOY.md)**.

Three things there are easy to miss and each has teeth:

- **A volume at `bot/state`** — without it every redeploy wipes the anchor, the halt latch *and* the equity high-water mark, so a price stop is defeated by a deploy and the drawdown stop rebases on whatever the balance happens to be
- **`API_TOKEN`** — without it the API binds `127.0.0.1` and Vercel cannot reach it at all
- **One replica** — two both run `reconcile()` against the same account and double every order

Paper trading is enforced by the credentials themselves: `PK` keys return 401 against the live endpoint, so a misconfigured deploy cannot reach real money.

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

Equity, buying power, market price, and the exchange's `min_order_size` are all read from Alpaca at startup. `MAX_POSITION_USD` no longer exists — live buying power replaced it.

Three limits are checked against live numbers rather than static config:

| Check | Against |
|---|---|
| derived order size | the asset's `min_order_size` (a **quantity**) |
| cheapest order's cost basis | `MIN_ORDER_NOTIONAL` (a **dollar amount**) |
| worst-case notional | live buying power |

**The notional floor is the one that catches people.** Alpaca rejects crypto orders under a minimum cost basis and does *not* publish it in the assets endpoint — `min_order_size` is 0.000015565 BTC (about $1), and clearing it is not enough. A grid at 3.4x the quantity minimum had all 11 levels rejected with `cost basis must be >= minimal amount of order 10`. The binding case is the cheapest order, at the band's lower bound.

The $10 is **measured, not assumed**. `npm run bot:probe` provokes the rejection and reads the number out of Alpaca's own error text:

```
BTC/USD    floor $10.00   (probe was $0.50, min qty 0.000015565)
ETH/USD    floor $10.00   (probe was $0.50, min qty 0.000521991)
LTC/USD    floor $10.00   (probe was $0.50, min qty 0.022015424)
DOGE/USD   floor $10.00   (probe was $0.57, min qty 14.209429946)
```

Probe orders are sized at the asset minimum and priced 50% below market, so they are rejected by construction; if a symbol ever accepts one it cannot fill at that price and is cancelled immediately. The probe refuses to run outside paper mode and verifies nothing was left resting.

Floors are uniform today, but `MIN_ORDER_NOTIONAL_BTCUSD` overrides `MIN_ORDER_NOTIONAL` per symbol if that ever diverges.

With $100 equity at 80% allocation across a ±15% band, that caps you at **5 levels**. Twenty levels means $3 orders and every one bounces. The error names the number that works.

Buying power needs one more correction: a resting buy already has its cost deducted, so comparing the grid's total worst case against what's left double-counts the grid's own orders — place 3 of 5 levels and the next tick refuses level 4. `readLiveState()` adds our own reservations back. Orders you placed by hand are deliberately *not* added back; that capital really is spoken for.

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

### Three stops, all scaled to the portfolio

They catch different failures, and none is an absolute number you have to maintain.

| | Scales from | Limits | Default |
|---|---|---|---|
| `MAX_DAILY_LOSS_PCT` | live equity | how **fast** you lose | 5% |
| `MAX_DRAWDOWN_PCT` | the equity peak | how **much** you give back in total | 20% |
| `GRID_STOP_PCT` | the band | how **far** one position runs against you | off |

```
daily stop = equity     × MAX_DAILY_LOSS_PCT     -$5 at $100, -$500 at $10k
drawdown   = (peak − equity) / peak              vs MAX_DRAWDOWN_PCT
stop price = lowerBound × (1 − GRID_STOP_PCT)    moves whenever the band moves
```

Daily P&L comes from Alpaca's `last_equity` (prior session close), so it needs no local bookkeeping and survives restarts for free.

**Why a drawdown stop exists at all.** The daily stop resets every session, which makes it blind to a slow grind: −3% a day for ten days is a quarter of the account and never reaches a 5% daily limit. That isn't hypothetical — over the bundled 2026 BTC window the bot drew down 7.5% peak-to-trough with no single day worse than −3.1%, so the daily stop never fired once. The drawdown stop measures against the equity high-water mark instead, which is the only way to see it.

20% is calibrated to sit *above* every drawdown observed in normal operation (BTC peaked at 8.4%, ETH at 16.3%) so it doesn't interrupt a working grid. Tightening it to 15% halts the ETH 2024 run near the bottom and turns −7.45% into −13.73%, because the recovery never comes.

**It is tail insurance, not a return improver.** On every window in `backtest/data/`, firing a stop costs money — that's what a stop is. It earns its keep in the case the data does *not* contain: a decline that keeps going.

The high-water mark is persisted to `bot/state/peak.json`, because a peak held only in memory rebases on restart and a bot already 19% down would start measuring from the bottom. `npm run bot:resume` rebases it deliberately — clearing a drawdown halt *is* the decision to accept the current balance as the new baseline, and without that the latch would re-fire on the next tick.

**On breach they behave differently, on purpose.** The daily and drawdown stops cancel resting orders and halt but *keep the position* — halting is not the same as liquidating, and forcing an exit on a fast drawdown is usually the wrong reflex. The price stop does liquidate, with a market order, because its whole purpose is to bound a single position's loss.

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

**2. The prototype UI runs, but on mock data.** `npm run dashboard` then open **http://localhost:3000/prototype/index.html**.

The explicit `index.html` is required: Next serves `public/` at literal paths and does not resolve directory indexes, so bare `/prototype` 404s.

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
- [x] Alpaca client + account smoke test
- [x] Order placement + fill tracking
- [x] Run loop + daily and price stops
- [x] Dashboard API endpoints + live monitor page
- [x] 6-month backtest harness
- [ ] Port prototype components to ES modules, on real data
- [ ] Deploy (Railway + Vercel)
- [x] 6-month backtest harness
