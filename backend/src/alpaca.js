// src/alpaca.js - Alpaca API client + Coinbase/CoinGecko fallback for crypto data
// Includes a shared response cache to reduce API calls across all bots.
const axios = require("axios");

// ── SHARED RESPONSE CACHE ────────────────────────────────────
// All bots share this cache. When bot1 fetches BTC/USD bars, bot2 gets the
// cached result instead of making another API call.
const dataCache = new Map();
const BARS_CACHE_TTL = 25_000;   // 25s — shorter than any scan interval
const PRICE_CACHE_TTL = 10_000;  // 10s — fresh enough for display, avoids burst

function cacheGet(key, ttl) {
  const entry = dataCache.get(key);
  if (entry && Date.now() - entry.time < ttl) return entry.data;
  return undefined;
}

function cacheSet(key, data) {
  dataCache.set(key, { data, time: Date.now() });
  // Prune stale entries when cache gets large
  if (dataCache.size > 300) {
    const now = Date.now();
    for (const [k, v] of dataCache) {
      if (now - v.time > 60_000) dataCache.delete(k);
    }
  }
}

// Track in-flight requests to prevent duplicate concurrent fetches
const inFlight = new Map();

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

function formatBars(rawBars) {
  return rawBars.map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));
}

// Fetch OHLCV bars — cached per symbol+timeframe+limit (25s TTL)
async function getCryptoBars(
  apiKey,
  secretKey,
  symbol,
  timeframe = "1Min",
  limit = 30,
  lookbackMs = 2 * 60 * 60 * 1000,
) {
  const sym = symbol.includes("/") ? symbol : symbol.replace(/USD$/, "/USD");
  const cacheKey = `bars:${sym}:${timeframe}:${limit}`;

  const cached = cacheGet(cacheKey, BARS_CACHE_TTL);
  if (cached !== undefined) return cached;

  // Dedup concurrent requests for the same key
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const promise = (async () => {
    try {
      const start = new Date(Date.now() - lookbackMs).toISOString();
      const res = await axios.get(
        `https://data.alpaca.markets/v1beta3/crypto/us/bars`,
        {
          params: { symbols: sym, timeframe, limit, start },
          headers: getHeaders(apiKey, secretKey),
          timeout: 8000,
        },
      );
      const bars = formatBars(res.data?.bars?.[sym] || []);
      cacheSet(cacheKey, bars);
      return bars;
    } catch (err) {
      console.error(`Alpaca bars failed for ${symbol}:`, err.message);
      return [];
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
  return promise;
}

/**
 * Fetch bars for multiple symbols in ONE API call.
 * Results are cached per symbol so subsequent single-symbol getCryptoBars() calls
 * hit the cache. Returns a Map<symbol, bars[]>.
 */
async function getCryptoBarsMulti(
  apiKey,
  secretKey,
  symbols,
  timeframe = "1Min",
  limit = 30,
  lookbackMs = 2 * 60 * 60 * 1000,
) {
  const result = new Map();
  const uncached = [];

  // Check cache first — only fetch what's missing
  for (const symbol of symbols) {
    const sym = symbol.includes("/") ? symbol : symbol.replace(/USD$/, "/USD");
    const cacheKey = `bars:${sym}:${timeframe}:${limit}`;
    const cached = cacheGet(cacheKey, BARS_CACHE_TTL);
    if (cached !== undefined) {
      result.set(sym, cached);
    } else {
      uncached.push(sym);
    }
  }

  if (uncached.length === 0) return result;

  try {
    const start = new Date(Date.now() - lookbackMs).toISOString();
    // Alpaca v1beta3 multi-symbol endpoint: `limit` is total bars across ALL symbols per page,
    // not per-symbol. Scale by symbol count so each symbol gets the requested number of bars.
    const totalLimit = limit * uncached.length;
    const res = await axios.get(
      `https://data.alpaca.markets/v1beta3/crypto/us/bars`,
      {
        params: { symbols: uncached.join(','), timeframe, limit: totalLimit, start },
        headers: getHeaders(apiKey, secretKey),
        timeout: 10000,
      },
    );

    for (const sym of uncached) {
      const rawBars = res.data?.bars?.[sym] || [];
      // Take only the last `limit` bars per symbol (API may return more)
      const bars = formatBars(rawBars.slice(-limit));
      const cacheKey = `bars:${sym}:${timeframe}:${limit}`;
      cacheSet(cacheKey, bars);
      result.set(sym, bars);
    }
  } catch (err) {
    console.error(`Alpaca multi-bars failed:`, err.message);
    // Return empty arrays for uncached symbols
    for (const sym of uncached) result.set(sym, []);
  }

  return result;
}

// Get latest price — checks WebSocket stream cache first, then response cache, then REST
const cryptoStream = require('./crypto-stream');

async function getLatestCryptoPrice(apiKey, secretKey, symbol, streamHandle) {
  const sym = symbol.includes("/") ? symbol : symbol.replace(/USD$/, "/USD");

  // 1. Try WebSocket stream cache (real-time, < 60s old)
  if (streamHandle) {
    const streamed = cryptoStream.getPrice(streamHandle, symbol);
    if (streamed && streamed.age < 60000) {
      cacheSet(`price:${sym}`, streamed.price); // Update response cache too
      return streamed.price;
    }
  }

  // 2. Try response cache (avoids REST calls when multiple bots ask for same symbol)
  const priceCached = cacheGet(`price:${sym}`, PRICE_CACHE_TTL);
  if (priceCached !== undefined) return priceCached;

  // 3. Dedup concurrent REST requests
  const flightKey = `price:${sym}`;
  if (inFlight.has(flightKey)) return inFlight.get(flightKey);

  const promise = (async () => {
    try {
      const res = await axios.get(
        `https://data.alpaca.markets/v1beta3/crypto/us/latest/trades`,
        {
          params: { symbols: sym },
          headers: getHeaders(apiKey, secretKey),
          timeout: 5000,
        },
      );
      const price = res.data?.trades?.[sym]?.p || null;
      if (price) cacheSet(`price:${sym}`, price);
      return price;
    } catch (err) {
      console.error(`Alpaca price failed for ${symbol}:`, err.message);
      return null;
    } finally {
      inFlight.delete(flightKey);
    }
  })();

  inFlight.set(flightKey, promise);
  return promise;
}

/**
 * Fetch latest prices for multiple symbols in ONE API call.
 * Populates the response cache so subsequent single-symbol calls hit cache.
 * Returns a Map<symbol, price>.
 */
async function getLatestCryptoPricesMulti(apiKey, secretKey, symbols, streamHandle) {
  const result = new Map();
  const needRest = [];

  for (const symbol of symbols) {
    const sym = symbol.includes("/") ? symbol : symbol.replace(/USD$/, "/USD");

    // Try stream first
    if (streamHandle) {
      const streamed = cryptoStream.getPrice(streamHandle, symbol);
      if (streamed && streamed.age < 60000) {
        result.set(sym, streamed.price);
        cacheSet(`price:${sym}`, streamed.price);
        continue;
      }
    }

    // Try response cache
    const cached = cacheGet(`price:${sym}`, PRICE_CACHE_TTL);
    if (cached !== undefined) {
      result.set(sym, cached);
      continue;
    }

    needRest.push(sym);
  }

  if (needRest.length > 0) {
    try {
      const res = await axios.get(
        `https://data.alpaca.markets/v1beta3/crypto/us/latest/trades`,
        {
          params: { symbols: needRest.join(',') },
          headers: getHeaders(apiKey, secretKey),
          timeout: 5000,
        },
      );
      for (const sym of needRest) {
        const price = res.data?.trades?.[sym]?.p || null;
        result.set(sym, price);
        if (price) cacheSet(`price:${sym}`, price);
      }
    } catch (err) {
      console.error('Alpaca multi-price failed:', err.message);
      for (const sym of needRest) result.set(sym, null);
    }
  }

  return result;
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
  getLatestCryptoPricesMulti,
  getCryptoBars,
  getCryptoBarsMulti,
};
