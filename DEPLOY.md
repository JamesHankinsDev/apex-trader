# Deploying Apex Trader

Bot on **Railway** (needs a process that stays up), dashboard on **Vercel** (a normal Next app). Alpaca keys never go near Vercel.

```
Railway ──────────────┐          ┌───────────── Vercel
  npm run bot:loop    │          │   Next dashboard
  ├─ run loop ────────┼─ Alpaca  │   ├─ /live
  └─ API on $PORT ◄───┼──────────┼── └─ /api/bot/*  (adds the token here)
     volume: bot/state│          │
```

> **Paper trading is enforced by your credentials, not by config.** Your keys start with `PK`; they return HTTP 401 against the live endpoint. `TRADING_MODE` also defaults to `paper` and overrides a live `ALPACA_BASE_URL`. Misconfiguring the deploy cannot reach real money.

---

## Before you start

Generate an API token locally — this is what lets Vercel talk to the bot:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Keep it somewhere; you'll paste it into both platforms. Have your Alpaca **paper** key ID and secret to hand.

---

## Part 1 — the bot, on Railway

### 1. Create the service

1. Push to GitHub if you haven't (`git push origin main`).
2. Railway → **New Project** → **Deploy from GitHub repo** → pick `apex-trader`.
3. It will detect Node and start building. Let it finish and fail — it won't know the start command yet.

### 2. Set the start command

**Settings → Deploy → Custom Start Command:**

```
npm run bot:loop
```

`npm start` also runs the loop, so a missing custom command is no longer fatal — but set it explicitly anyway, so what runs in production is visible in the dashboard rather than implied.

Leave the build command empty. Railway runs `npm ci` at the repo root, which installs both workspaces. That pulls Next.js onto the bot container unnecessarily (~200 MB) but is harmless — not worth fighting the monorepo for.

### 3. ⚠️ Add the volume — do this before the first real run

**Settings → Volumes → New Volume**, mount path:

```
/app/bot/state
```

Skip this and the container filesystem resets on every deploy, which wipes:

- `anchor.json` — the grid silently re-centres on whatever price it restarts at, **including while holding a position**, which is exactly what `on_flat` exists to prevent
- `halt.json` — **a price stop is defeated by a redeploy.** The bot liquidates, halts, redeploys flat, re-anchors on the crashed price, and buys back in
- `peak.json` — **the drawdown stop rebases on the bottom.** A bot already 19% down redeploys, takes the current balance as its new high-water mark, and the stop it was seconds away from hitting never fires

A latch or a high-water mark is only a real safety mechanism if it outlives the container.

Confirm Railway's app root is `/app` (Settings → shows the working directory). If it differs, adjust the mount path to `<root>/bot/state`.

### 4. Set environment variables

**Variables** tab. Everything else has a safe default.

| Variable | Value | Why |
|---|---|---|
| `ALPACA_KEY_ID` | your `PK…` key | |
| `ALPACA_SECRET_KEY` | your secret | |
| `TRADING_MODE` | `paper` | explicit beats implicit |
| `DRY_RUN` | `false` | **defaults to `true`** — without this it runs and places nothing |
| `API_TOKEN` | the token you generated | **without it the API binds `127.0.0.1` and Vercel cannot reach it** |
| `API_HOST` | `0.0.0.0` | |
| `DASHBOARD_ORIGIN` | your Vercel URL | after Part 2; `*` is acceptable while testing |
| `GRID_SYMBOL` | `BTC/USD` | |
| `GRID_LEVELS` | `6` | the `$10` notional floor caps it here at ~$100 equity |
| `GRID_BAND_PCT` | `0.04` | a 1.61% step. `0.10` is 4.10%, wider than BTC's median daily range — the grid stops filling |
| `GRID_ALLOCATION_PCT` | `0.80` | |
| `GRID_ANCHOR_MODE` | `on_flat` | |
| `GRID_STOP_PCT` | `0.15` | |
| `MAX_DAILY_LOSS_PCT` | `0.05` | |

Do **not** set `PORT` — Railway injects it, and the API reads it before `API_PORT`.

### 5. ⚠️ Pin to one instance

**Settings → Replicas → 1.**

Two replicas both run `reconcile()` against the same account: every level gets two orders and every fill two counter-orders.

Also check **Settings → Deploy → Restart Policy**. Prefer a policy that stops the old container before starting the new one. If they overlap during a rolling deploy you get double orders for that window.

### 6. Health check

**Settings → Deploy → Healthcheck Path:**

```
/health
```

It returns `200 {"ok":true}` while trading and **`503 {"ok":false,"halted":"…"}`** when halted, so a halt actually pages you rather than reading as healthy. `/health` is deliberately unauthenticated so the probe works without the token.

### 7. Deploy and verify

Redeploy, then from your laptop:

```bash
curl https://<your-app>.up.railway.app/health
# {"ok":true,"running":true,"halted":null,"dryRun":false,...}

curl -H "Authorization: Bearer <API_TOKEN>" \
     https://<your-app>.up.railway.app/state | head -c 400
```

In the Railway logs you should see tick lines converging:

```
[   1] $64802.10  inv 0.000000000  ...  +3/-0
[   2] $64802.10  inv 0.000000000  ...  +0/-0     <- converged
```

`+0/-0` from tick 2 onward is healthy. Repeated `+N/-N` is churn; `⚠ N REJECTED` means the exchange is refusing orders and it will halt after 3 consecutive.

---

## Part 2 — the dashboard, on Vercel

### 1. Import

Vercel → **Add New → Project** → same repo.

**Root Directory:** `dashboard`

Leave framework preset as Next.js and the build settings alone.

### 2. Environment variables

Both are **server-only** — no `NEXT_PUBLIC_` prefix, so they never reach the browser.

| Variable | Value |
|---|---|
| `BOT_API_URL` | `https://<your-app>.up.railway.app` |
| `BOT_API_TOKEN` | the same token as Railway's `API_TOKEN` |

The proxy at `app/api/bot/[...path]/route.js` attaches the token server-side. This is why it's a route handler and not a `next.config` rewrite — a rewrite can't add a header.

### 3. Deploy and verify

Open `https://<your-project>.vercel.app/live`. You should see the grid ladder, capital split, and tick counter.

If it says **"Bot is not reachable"**:

- Confirm `API_TOKEN` is set on Railway (without it the API is localhost-only)
- Confirm `BOT_API_TOKEN` matches exactly
- `curl` the Railway `/health` directly to isolate which side is broken

Then set `DASHBOARD_ORIGIN` on Railway to your Vercel URL and redeploy the bot.

---

## Part 3 — the mobile view

The mobile app is **routes in the same Next project** as the dashboard —
`app/m/*`, sharing the same server-side proxy and the same bot snapshot. There
is nothing to provision: no Railway change, no new environment variables, no
second deploy target. Pushing to `main` ships it.

| Route | What it is |
|---|---|
| `/m` | redirects to `/m/live` |
| `/m/live` | wired to the bot — equity, grid ladder, position, risk, fills |
| `/m/assets`, `/m/market`, `/m/bots`, `/m/stats` | empty states saying what is missing and why |

### 1. Deployment Protection — what it actually does here

Vercel → Project → Settings → Deployment Protection. The API reports this
project as:

```
ssoProtection:      enabled: true,  deploymentType: "all_except_custom_domains"
passwordProtection: enabled: false
trustedIps:         enabled: false
```

**Read that and you would expect a Vercel login wall on every `*.vercel.app`
URL. There isn't one.** All four aliases serve the app unauthenticated —
verified by fetching each one:

| URL | |
|---|---|
| `apex-trader-dashboard-eight.vercel.app` | 200 |
| `apex-trader-dashboard-jameshankinsdevs-projects.vercel.app` | 200 |
| `apex-trader-dashboard-git-main-…vercel.app` | 200 |
| `apex-trader-dashboard-i1zyqhnfe-…vercel.app` (raw deployment URL) | 200 |

So the setting is reported but not enforced on this plan. Nothing needs
changing to reach the app from a phone — but **do not trust the settings page
to tell you whether the dashboard is reachable.** Check it the way this table
was built:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<your-url>/m/live
```

`200` is open. `401` means protection has started being enforced, and the
fastest fix is to sign into Vercel once in mobile Safari — it persists, and
it is reversible in a way that turning the setting off is not.

### 2. This dashboard is public by choice

There is **no auth in front of the dashboard itself** — no middleware, nothing.
`BOT_API_TOKEN` protects the *bot*, not the page. If you turn Deployment
Protection off, anyone with the URL can read your equity, open position,
resting orders and fill history.

That was a deliberate call, on these grounds:

- The proxy at `app/api/bot/[...path]/route.js` is **GET-only**, and the bot
  API returns `405 This API is read-only.` for anything else (`server.js:109`).
  Worst case is disclosure, never control. Nobody can move your money with it.
- The proxy has an **allowlist** — `health`, `state`, `grid`, `position`,
  `fills`. Nothing else is reachable, whatever is added to the bot later.
- It is a paper account.

**Revisit this the moment either of those stops being true** — a real-money
`TRADING_MODE=live`, or a write path added to the API. At that point the
honest fix is Vercel Password Protection or an auth middleware, not a URL
nobody has guessed yet.

### 3. Install it

Open **https://apex-trader-dashboard-eight.vercel.app/m/live** in iOS Safari,
then Share → **Add to Home Screen**.

`app/manifest.js` sets `display: standalone` and `start_url: /m/live`, so it
opens chromeless on the live view rather than on the build-status page at `/`.
`app/apple-icon.png` is the home-screen icon; without it iOS uses a screenshot
of the page.

Note the manifest requires HTTPS to take effect, which Vercel gives you — over
plain `http://` on a LAN it is ignored and you get a bookmark instead.

### 4. Verify on the actual device

Browser DevTools cannot check the first two of these. They need a real phone:

- [ ] The bottom nav clears the home indicator and is not cut off. This depends
      on `viewport-fit=cover` in `app/m/layout.js` — without it iOS reports
      every `env(safe-area-inset-*)` as `0px` and the nav sits underneath.
- [ ] Pinch-zoom still works. It is deliberately not disabled; if a future
      change adds `maximumScale`/`userScalable: false` to stop rubber-banding,
      that is a WCAG 1.4.4 failure and `overscroll-behavior` is the right tool.
- [ ] The status chip reads **live**, not **dry run**. A dry-run chip in
      production means `DRY_RUN=false` did not take on Railway.
- [ ] The ladder shows a `SPOT` row between two levels, with `held` and
      `buy`/`sell` tags where you expect them.

---

## Operating it

```bash
npm run bot:resume     # clear a latched halt (run locally, or Railway shell)
npm run bot:check      # verify credentials
npm run bot:probe      # re-measure exchange minimums
npm run bot:report     # one-shot: print the grid without trading
```

**Never run two bots against one account.** Railway plus a local `npm run bot:loop` is the same failure as two replicas — both reconcile the same book. Stop the local one before deploying.

**When it halts** it stays up and serves `/health` as 503 rather than exiting — deliberately, because exiting would make the platform restart it and undo the halt. To resume:

1. Work out why. `/live` shows the reason; `halt.json` on the volume has the timestamp, price and equity.
2. Clear the latch: `npm run bot:resume`
3. Restart the service.

**Changing config** requires a restart — env and code are read once at process start. A restart cancels resting orders and re-places them, which is safe but resets the book.

**Changing `GRID_BAND_PCT` or `GRID_LEVELS` while holding a position** re-maps that position onto the nearest level by entry price. Its exit will move. Check `/live` after any band change.

---

## Known limits

- `hydrate()` fetches the last 500 orders. Past that, older history drops out and realized P&L will understate.
- `FEE_RATE` is a measured constant (0.15%), not observed per fill. A volume-tier change would drift the P&L figures.
- One symbol per process. Multiple pairs means multiple services, each with its own volume, sharing one account's buying power — nothing coordinates them.
