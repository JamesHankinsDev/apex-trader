# APEX TRADER 🤖

A 24/7 automated crypto trading bot with a live dashboard.

**Stack:** Node.js backend (bot engine) + Next.js frontend (dashboard)

---

## Architecture

```
apex-trader/
├── backend/          ← Node.js bot (runs 24/7 on Railway/Render/VPS)
│   ├── src/
│   │   ├── index.js      ← Express API server
│   │   ├── bot.js        ← Core trading loop
│   │   ├── strategy.js   ← RSI + momentum + volume indicators
│   │   └── alpaca.js     ← Alpaca API client
│   └── .env.example
│
└── frontend/         ← Next.js dashboard (deploy to Vercel)
    ├── src/app/
    │   ├── page.js       ← Main dashboard
    │   └── globals.css
    └── .env.local.example
```

> ⚠️ **The frontend is just a monitor.** The bot runs in the backend 24/7 — even when your browser is closed.

---

## Local Development

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Alpaca API keys
npm run dev
# Backend runs on http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev
# Dashboard runs on http://localhost:3000
```

---

## Alpaca Setup

1. Sign up at **alpaca.markets** (free)
2. Go to **Paper Trading** (top nav) → Generate API Keys
3. Paste keys into `.env` (backend) or the dashboard UI

For **live trading**:
- Fund your account (minimum ~$10)
- Generate **Live Trading** API keys (different from paper keys)
- Set `ALPACA_MODE=live` in backend `.env`

---

## Deploy Backend (Railway — recommended, free tier available)

1. Push to GitHub
2. Go to **railway.app** → New Project → Deploy from GitHub
3. Select the `backend/` folder (or set root directory to `backend`)
4. Add environment variables in Railway dashboard:
   ```
   ALPACA_API_KEY=your_key
   ALPACA_SECRET_KEY=your_secret
   ALPACA_MODE=paper
   FRONTEND_URL=https://your-app.vercel.app
   PORT=3001
   ```
5. Railway gives you a URL like `https://apex-trader-backend.up.railway.app`

**Alternative:** Render.com (also free tier), or any $5/mo VPS (DigitalOcean, Fly.io)

---

## Deploy Frontend (Vercel)

1. Push to GitHub
2. Go to **vercel.com** → New Project → Import from GitHub
3. Set **Root Directory** to `frontend`
4. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
   ```
5. Deploy — Vercel gives you `https://your-app.vercel.app`

---

## Strategy

The bot uses a multi-factor signal scoring system (0-100):

| Signal | Buy Condition | Weight |
|--------|--------------|--------|
| RSI | Below threshold (default 35) | +25 pts |
| SMA Crossover | SMA5 > SMA20 | +10 pts |
| Volume Spike | >2x average | +15 pts |
| Momentum | >2% 10-bar momentum | +12 pts |
| ATR Volatility | >2% ATR | +5 pts |

**Entry:** Score ≥ 70, no existing position, sufficient cash  
**Exit:** Stop loss OR take profit hit

---

## Important Risk Disclaimer

- Crypto trading involves **substantial risk of loss**
- Past performance does not guarantee future results  
- Start with **paper trading** before using real money
- Only invest what you can afford to lose entirely
- $10 → $1000 in a month requires ~47 consecutive 10% wins

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/status` | Full bot state + signals + trades |
| POST | `/api/start` | Start bot (pass apiKey, secretKey, mode) |
| POST | `/api/stop` | Stop bot |
| PUT | `/api/config` | Update strategy params |
| POST | `/api/credentials` | Update API credentials |
