// src/index.js - Express server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bot = require('./bot');

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// ─── HEALTH CHECK ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── BOT STATUS ───────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json(bot.getStatus());
});

// ─── START BOT ────────────────────────────────────────────────
app.post('/api/start', async (req, res) => {
  const { apiKey, secretKey, mode } = req.body;

  if (apiKey && secretKey) {
    bot.setCredentials(apiKey, secretKey, mode);
  }

  const result = await bot.start();
  res.json(result);
});

// ─── STOP BOT ─────────────────────────────────────────────────
app.post('/api/stop', (req, res) => {
  const result = bot.stop();
  res.json(result);
});

// ─── UPDATE CONFIG ────────────────────────────────────────────
app.put('/api/config', (req, res) => {
  const { positionSize, stopLoss, takeProfit, rsiBuy, rsiSell, scanInterval, watchlist } = req.body;
  bot.updateConfig({ positionSize, stopLoss, takeProfit, rsiBuy, rsiSell, scanInterval, watchlist });
  res.json({ ok: true, config: bot.getStatus().config });
});

// ─── SET CREDENTIALS ──────────────────────────────────────────
app.post('/api/credentials', (req, res) => {
  const { apiKey, secretKey, mode } = req.body;
  if (!apiKey || !secretKey) {
    return res.status(400).json({ ok: false, msg: 'apiKey and secretKey required' });
  }
  const result = bot.setCredentials(apiKey, secretKey, mode);
  res.json(result);
});

// ─── MANUAL TRADE ─────────────────────────────────────────────
app.post('/api/trade', async (req, res) => {
  const { symbol, side } = req.body;
  if (!symbol || !side) return res.status(400).json({ ok: false, msg: 'symbol and side required' });

  if (side === 'sell') {
    const pos = bot.state?.positions?.[symbol];
    if (!pos) return res.status(400).json({ ok: false, msg: 'No open position for ' + symbol });
    // Fetch current market price instead of using stale entry price
    const alpaca = require('./alpaca');
    const currentPrice = await alpaca.getLatestCryptoPrice(
      bot.config.apiKey, bot.config.secretKey, symbol
    );
    if (!currentPrice) return res.status(500).json({ ok: false, msg: 'Could not fetch current price for ' + symbol });
    await bot.executeExit(symbol, currentPrice, 'MANUAL CLOSE');
  }

  res.json({ ok: true });
});

// ─── START SERVER ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 APEX TRADER backend running on port ${PORT}`);
  console.log(`   Mode: ${process.env.ALPACA_MODE || 'paper'}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Status: http://localhost:${PORT}/api/status\n`);

  // Auto-start if credentials are set in env
  if (process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY) {
    console.log('📡 Auto-starting bot from environment credentials...');
    bot.start().then(r => console.log('   Bot start:', r.msg));
  }
});
