// src/index.js - Express server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bot = require('./bot');
const experimentBot = require('./experiment-bot');
const experiment2Bot = require('./experiment2-bot');
const { isBtcGateOpen, getMarketRegime, getDetailedRegime } = require('./btcGate');
const { getChannelData } = require('./bearStrategy');
const { getPerformanceStats, getWeeklySnapshots } = require('./performance');
const { getScalpLogStatus } = require('./scalpLog');
const alpaca = require('./alpaca');

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(u => u.trim())
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// ─── HEALTH CHECK ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── SHARED MARKET DATA (computed once, shared across all status endpoints) ──
// Avoids 3x duplicate gate/regime/price calls when frontend polls all 3 bots.
let sharedMarketData = null;
let sharedMarketDataFetchedAt = 0;
const SHARED_MARKET_TTL = 4000; // 4s — frontend polls every 5s

async function getSharedMarketData() {
  if (sharedMarketData && Date.now() - sharedMarketDataFetchedAt < SHARED_MARKET_TTL) {
    return sharedMarketData;
  }

  // Pick the first available API key (market data is account-independent)
  const apiKey = bot.config.apiKey || process.env.ALPACA_API_KEY
    || experimentBot.config.apiKey || process.env.EXPERIMENT_1_ALPACA_API_KEY
    || experiment2Bot.config.apiKey || process.env.EXPERIMENT_2_ALPACA_API_KEY;
  const secretKey = bot.config.secretKey || process.env.ALPACA_SECRET_KEY
    || experimentBot.config.secretKey || process.env.EXPERIMENT_1_ALPACA_SECRET_KEY
    || experiment2Bot.config.secretKey || process.env.EXPERIMENT_2_ALPACA_SECRET_KEY;
  const streamHandle = bot.streamHandle || experimentBot.streamHandle || experiment2Bot.streamHandle;

  if (!apiKey || !secretKey) return null;

  try {
    const [gate, regime, liveBtc, detailedRegime] = await Promise.all([
      isBtcGateOpen(apiKey, secretKey, streamHandle),
      getMarketRegime(apiKey, secretKey, streamHandle),
      alpaca.getLatestCryptoPrice(apiKey, secretKey, 'BTC/USD', streamHandle),
      getDetailedRegime(apiKey, secretKey, streamHandle),
    ]);

    let bearChannel = null;
    let bearChannels = null;
    if (regime.regime === 'bear') {
      try {
        // Use union of all bots' bear watchlists for channel data
        const allBearCoins = new Set([
          ...(bot.config.bearWatchlist || bot.config.watchlist || []),
          ...(experimentBot.config.bearWatchlist || experimentBot.config.watchlist || []),
          ...(experiment2Bot.config.bearWatchlist || experiment2Bot.config.watchlist || []),
        ]);
        const watchlist = [...allBearCoins].length > 0 ? [...allBearCoins] : ['BTC/USD'];
        const channelResults = await Promise.all(
          watchlist.map(coin => getChannelData(coin, apiKey, secretKey).catch(() => ({ support: null, resist: null, width: null })))
        );
        bearChannels = {};
        watchlist.forEach((coin, i) => {
          const sym = coin.includes('/') ? coin : coin.replace(/USD$/, '/USD');
          bearChannels[sym] = channelResults[i];
        });
        // Keep bearChannel as the first coin's data for backward compat (BTC Gate bar)
        bearChannel = channelResults[0] || { support: null, resist: null, width: null };
      } catch {
        bearChannel = { support: null, resist: null, width: null };
      }
    }

    sharedMarketData = { gate, regime, liveBtc, bearChannel, bearChannels, detailedRegime };
    sharedMarketDataFetchedAt = Date.now();
    return sharedMarketData;
  } catch {
    return null;
  }
}

function attachMarketData(status, market) {
  if (!market) return;
  const { gate, regime, liveBtc, bearChannel, bearChannels, detailedRegime } = market;
  status.btcGate = gate;
  status.regime = {
    current: regime.regime,
    fearGreed: regime.fearGreed,
    extremeFear: regime.extremeFear,
    capitulation: regime.capitulation,
    btcPrice: liveBtc || regime.btcPrice,
    sma50: regime.sma50,
  };
  if (bearChannel) status.regime.bearChannel = bearChannel;
  if (bearChannels) status.regime.bearChannels = bearChannels;
  if (detailedRegime) status.regime.detailed = detailedRegime;
}

// ─── BOT STATUS ───────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  const status = bot.getStatus();
  try {
    attachMarketData(status, await getSharedMarketData());
  } catch {}
  res.json(status);
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
    const currentPrice = await alpaca.getLatestCryptoPrice(
      bot.config.apiKey, bot.config.secretKey, symbol, bot.streamHandle
    );
    if (!currentPrice) return res.status(500).json({ ok: false, msg: 'Could not fetch current price for ' + symbol });
    await bot.executeExit(symbol, currentPrice, 'MANUAL CLOSE');
  }

  res.json({ ok: true });
});

// ─── EXPERIMENT BOT ──────────────────────────────────────────
app.get('/api/experiment/status', async (req, res) => {
  const status = experimentBot.getStatus();
  try {
    attachMarketData(status, await getSharedMarketData());
  } catch {}
  res.json(status);
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
    const currentPrice = await alpaca.getLatestCryptoPrice(
      experimentBot.config.apiKey, experimentBot.config.secretKey, symbol, experimentBot.streamHandle
    );
    if (!currentPrice) return res.status(500).json({ ok: false, msg: 'Could not fetch current price' });
    await experimentBot.executeExit(symbol, currentPrice, 'MANUAL CLOSE');
  }
  res.json({ ok: true });
});

// ─── EXPERIMENT 2 BOT (Momentum Breakout) ───────────────────
app.get('/api/bot2/status', async (req, res) => {
  const status = experiment2Bot.getStatus();
  try {
    attachMarketData(status, await getSharedMarketData());
  } catch {}
  res.json(status);
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

// ─── LEADERBOARD ─────────────────────────────────────────────
app.get('/api/leaderboard', (req, res) => {
  const main = getPerformanceStats('main');
  const exp1 = getPerformanceStats('exp1');
  const exp2 = getPerformanceStats('exp2');

  // Determine leader: prefer Sharpe if available for all, otherwise totalReturnPct
  let leader = 'main';
  let leadMetric = 'totalReturn';

  if (main.sharpeRatio != null && exp1.sharpeRatio != null && exp2.sharpeRatio != null) {
    leadMetric = 'sharpe';
    if (exp1.sharpeRatio > main.sharpeRatio && exp1.sharpeRatio > exp2.sharpeRatio) leader = 'exp1';
    else if (exp2.sharpeRatio > main.sharpeRatio && exp2.sharpeRatio > exp1.sharpeRatio) leader = 'exp2';
  } else {
    if (exp1.totalReturnPct > main.totalReturnPct && exp1.totalReturnPct > exp2.totalReturnPct) leader = 'exp1';
    else if (exp2.totalReturnPct > main.totalReturnPct && exp2.totalReturnPct > exp1.totalReturnPct) leader = 'exp2';
  }

  res.json({
    updatedAt: new Date().toISOString(),
    bots: { main, exp1, exp2 },
    leader,
    leadMetric,
    weeklySnapshots: getWeeklySnapshots(),
  });
});

// ─── SCALP LOG ───────────────────────────────────────────────
app.get('/api/scalp-log', (req, res) => {
  res.json(getScalpLogStatus());
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
