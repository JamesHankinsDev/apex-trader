// src/alpaca.js - Alpaca API client + Coinbase/CoinGecko fallback for crypto data
const axios = require("axios");

function getBaseUrl(mode) {
  return mode === "live"
    ? "https://api.alpaca.markets"
    : "https://paper-api.alpaca.markets";
}

function getHeaders(apiKey, secretKey) {
  return {
    "APCA-API-KEY-ID": apiKey,
    "APCA-API-SECRET-KEY": secretKey,
    "Content-Type": "application/json",
  };
}

// ── ACCOUNT / ORDERS ────────────────────────────────────────

async function getAccount(apiKey, secretKey, mode) {
  const res = await axios.get(`${getBaseUrl(mode)}/v2/account`, {
    headers: getHeaders(apiKey, secretKey),
  });
  return res.data;
}

async function getPositions(apiKey, secretKey, mode) {
  const res = await axios.get(`${getBaseUrl(mode)}/v2/positions`, {
    headers: getHeaders(apiKey, secretKey),
  });
  return res.data;
}

async function placeOrder(
  apiKey,
  secretKey,
  mode,
  { symbol, side, notional, qty },
) {
  const body = {
    symbol: symbol.replace("/", ""),
    side,
    type: "market",
    time_in_force: "gtc",
  };
  if (side === "buy" && notional) {
    body.notional = notional.toFixed(2);
  } else if (qty) {
    body.qty = qty.toString();
  }
  const res = await axios.post(`${getBaseUrl(mode)}/v2/orders`, body, {
    headers: getHeaders(apiKey, secretKey),
  });
  return res.data;
}

async function getOrder(apiKey, secretKey, mode, orderId) {
  const res = await axios.get(`${getBaseUrl(mode)}/v2/orders/${orderId}`, {
    headers: getHeaders(apiKey, secretKey),
    timeout: 5000,
  });
  return res.data;
}

async function closePosition(apiKey, secretKey, mode, symbol) {
  const sym = symbol.replace("/", "");
  const res = await axios.delete(`${getBaseUrl(mode)}/v2/positions/${sym}`, {
    headers: getHeaders(apiKey, secretKey),
  });
  return res.data;
}

async function getPortfolioHistory(apiKey, secretKey, mode, params = {}) {
  const res = await axios.get(`${getBaseUrl(mode)}/v2/account/portfolio/history`, {
    headers: getHeaders(apiKey, secretKey),
    params: { period: '1A', timeframe: '1D', ...params },
    timeout: 8000,
  });
  return res.data;
}

// Get recent fill activities (to find actual entry timestamps)
async function getActivities(apiKey, secretKey, mode, activityType = 'FILL', limit = 100) {
  const res = await axios.get(`${getBaseUrl(mode)}/v2/account/activities/${activityType}`, {
    headers: getHeaders(apiKey, secretKey),
    params: { direction: 'desc', page_size: limit },
    timeout: 8000,
  });
  return res.data;
}

// ── MARKET DATA (Alpaca only) ────────────────────────────────

// Fetch OHLCV bars from Alpaca crypto data API
async function getCryptoBars(
  apiKey,
  secretKey,
  symbol,
  timeframe = "1Min",
  limit = 30,
  lookbackMs = 2 * 60 * 60 * 1000,
) {
  const sym = symbol.includes("/") ? symbol : symbol.replace(/USD$/, "/USD");
  try {
    // Force recent data by setting start param (avoids stale bar cache)
    const start = new Date(Date.now() - lookbackMs).toISOString();
    const res = await axios.get(
      `https://data.alpaca.markets/v1beta3/crypto/us/bars`,
      {
        params: { symbols: sym, timeframe, limit, start },
        headers: getHeaders(apiKey, secretKey),
        timeout: 8000,
      },
    );
    const bars = res.data?.bars?.[sym] || [];
    return bars.map((b) => ({
      t: b.t,
      o: b.o,
      h: b.h,
      l: b.l,
      c: b.c,
      v: b.v,
    }));
  } catch (err) {
    console.error(`Alpaca bars failed for ${symbol}:`, err.message);
    return [];
  }
}

// Get latest price — checks WebSocket stream cache first, falls back to REST
const cryptoStream = require('./crypto-stream');

async function getLatestCryptoPrice(apiKey, secretKey, symbol, streamHandle) {
  // Try stream cache first (< 60s old = fresh enough)
  if (streamHandle) {
    const cached = cryptoStream.getPrice(streamHandle, symbol);
    if (cached && cached.age < 60000) {
      return cached.price;
    }
  }

  // Fallback to REST
  const sym = symbol.includes("/") ? symbol : symbol.replace(/USD$/, "/USD");
  try {
    const res = await axios.get(
      `https://data.alpaca.markets/v1beta3/crypto/us/latest/trades`,
      {
        params: { symbols: sym },
        headers: getHeaders(apiKey, secretKey),
        timeout: 5000,
      },
    );
    const price = res.data?.trades?.[sym]?.p;
    return price || null;
  } catch (err) {
    console.error(`Alpaca price failed for ${symbol}:`, err.message);
    return null;
  }
}

module.exports = {
  getAccount,
  getPositions,
  getOrder,
  getPortfolioHistory,
  getActivities,
  placeOrder,
  closePosition,
  getLatestCryptoPrice,
  getCryptoBars,
};
