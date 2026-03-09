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

// Convert APEX symbol (BTC/USD) to Coinbase product ID (BTC-USD)
function toCoinbaseProduct(symbol) {
  return symbol.replace("/", "-");
}

// ── ACCOUNT / ORDERS (always Alpaca) ────────────────────────

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

// ── MARKET DATA (Alpaca primary, CoinGecko fallback) ─────────

// Fetch OHLCV bars from Alpaca crypto data API
async function getCryptoBars(
  apiKey,
  secretKey,
  symbol,
  timeframe = "1Min",
  limit = 30,
) {
  const sym = symbol.replace("/", "");

  // Try Alpaca data API first
  try {
    const res = await axios.get(
      `https://data.alpaca.markets/v1beta3/crypto/us/bars`,
      {
        params: { symbols: sym, timeframe, limit },
        headers: getHeaders(apiKey, secretKey),
        timeout: 8000,
      },
    );
    const bars = res.data?.bars?.[sym] || [];
    if (bars.length > 0) {
      return bars.map((b) => ({
        t: b.t,
        o: b.o,
        h: b.h,
        l: b.l,
        c: b.c,
        v: b.v,
      }));
    }
  } catch (err) {
    console.error(`Alpaca bars failed for ${symbol}:`, err.message);
  }

  // Fallback: Coinbase candles (public, no auth needed)
  try {
    const product = toCoinbaseProduct(symbol);
    // Coinbase granularity: 60=1min, 300=5min, 900=15min, 3600=1h, 86400=1d
    const granMap = { "1Min": 60, "5Min": 300, "15Min": 900, "30Min": 1800, "1Hour": 3600, "1Day": 86400 };
    const granularity = granMap[timeframe] || 60;

    const res = await axios.get(
      `https://api.exchange.coinbase.com/products/${product}/candles`,
      {
        params: { granularity, limit },
        headers: { "User-Agent": "ApexTrader/1.0" },
        timeout: 8000,
      },
    );

    // Coinbase returns [[time, low, high, open, close, volume], ...] newest first
    const candles = res.data || [];
    if (candles.length === 0) return [];

    return candles.reverse().map((c) => ({
      t: new Date(c[0] * 1000).toISOString(),
      o: c[3],
      h: c[2],
      l: c[1],
      c: c[4],
      v: c[5],
    }));
  } catch (err) {
    console.error(`Coinbase bars fallback failed for ${symbol}:`, err.message);
    return [];
  }
}

// Get latest price — Alpaca first, CoinGecko fallback
async function getLatestCryptoPrice(apiKey, secretKey, symbol) {
  const sym = symbol.replace("/", "");

  // Try Alpaca latest trade
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
    if (price) return price;
  } catch (err) {
    console.error(`Alpaca price failed for ${symbol}:`, err.message);
  }

  // Fallback: Coinbase ticker (public, no auth needed)
  try {
    const product = toCoinbaseProduct(symbol);
    const res = await axios.get(
      `https://api.exchange.coinbase.com/products/${product}/ticker`,
      {
        headers: { "User-Agent": "ApexTrader/1.0" },
        timeout: 5000,
      },
    );
    return parseFloat(res.data?.price) || null;
  } catch {
    return null;
  }
}

module.exports = {
  getAccount,
  getPositions,
  getOrder,
  placeOrder,
  closePosition,
  getLatestCryptoPrice,
  getCryptoBars,
};
