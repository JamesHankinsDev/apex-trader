// src/index.js - Express server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bot = require('./bot');
const experimentBot = require('./experiment-bot');
const experiment2Bot = require('./experiment2-bot');

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
      bot.config.apiKey, bot.config.secretKey, symbol, bot.streamHandle
    );
    if (!currentPrice) return res.status(500).json({ ok: false, msg: 'Could not fetch current price for ' + symbol });
    await bot.executeExit(symbol, currentPrice, 'MANUAL CLOSE');
  }

  res.json({ ok: true });
});

// ─── EXPERIMENT BOT ──────────────────────────────────────────
app.get('/api/experiment/status', (req, res) => {
  res.json(experimentBot.getStatus());
});

app.post('/api/experiment/start', async (req, res) => {
  const result = await experimentBot.start();
  res.json(result);
});

app.post('/api/experiment/stop', (req, res) => {
  res.json(experimentBot.stop());
});

app.post('/api/experiment/trade', async (req, res) => {
  const { symbol, side } = req.body;
  if (!symbol || !side) return res.status(400).json({ ok: false, msg: 'symbol and side required' });

  if (side === 'sell') {
    const pos = experimentBot.state?.positions?.[symbol];
    if (!pos) return res.status(400).json({ ok: false, msg: 'No open position for ' + symbol });
    const alpacaApi = require('./alpaca');
    const currentPrice = await alpacaApi.getLatestCryptoPrice(
      experimentBot.config.apiKey, experimentBot.config.secretKey, symbol, experimentBot.streamHandle
    );
    if (!currentPrice) return res.status(500).json({ ok: false, msg: 'Could not fetch current price' });
    await experimentBot.executeExit(symbol, currentPrice, 'MANUAL CLOSE');
  }
  res.json({ ok: true });
});

// ─── EXPERIMENT 2 BOT (Momentum Breakout) ───────────────────
app.get('/api/bot2/status', (req, res) => {
  res.json(experiment2Bot.getStatus());
});

app.post('/api/bot2/start', async (req, res) => {
  const result = await experiment2Bot.start();
  res.json(result);
});

app.post('/api/bot2/stop', (req, res) => {
  res.json(experiment2Bot.stop());
});

app.post('/api/bot2/trade', async (req, res) => {
  const { symbol, side } = req.body;
  if (!symbol || !side) return res.status(400).json({ ok: false, msg: 'symbol and side required' });

  if (side === 'sell') {
    const pos = experiment2Bot.state?.positions?.[symbol];
    if (!pos) return res.status(400).json({ ok: false, msg: 'No open position for ' + symbol });
    const alpacaApi = require('./alpaca');
    const currentPrice = await alpacaApi.getLatestCryptoPrice(
      experiment2Bot.config.apiKey, experiment2Bot.config.secretKey, symbol, experiment2Bot.streamHandle
    );
    if (!currentPrice) return res.status(500).json({ ok: false, msg: 'Could not fetch current price' });
    await experiment2Bot.executeExit(symbol, currentPrice, 'MANUAL CLOSE');
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

  // Auto-start experiment 1 bot if credentials are set
  if (process.env.EXPERIMENT_1_ALPACA_API_KEY && process.env.EXPERIMENT_1_ALPACA_SECRET_KEY) {
    console.log('🧪 Auto-starting experiment 1 bot...');
    experimentBot.start().then(r => console.log('   Experiment 1 start:', r.msg));
  }

  // Auto-start experiment 2 bot if credentials are set
  if (process.env.EXPERIMENT_2_ALPACA_API_KEY && process.env.EXPERIMENT_2_ALPACA_SECRET_KEY) {
    console.log('🧪 Auto-starting experiment 2 bot (Momentum Breakout)...');
    experiment2Bot.start().then(r => console.log('   Experiment 2 start:', r.msg));
  }
});
