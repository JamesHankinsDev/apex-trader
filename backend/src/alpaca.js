// src/alpaca.js - Alpaca API client
const axios = require('axios');

function getBaseUrl(mode) {
  return mode === 'live'
    ? 'https://api.alpaca.markets'
    : 'https://paper-api.alpaca.markets';
}

function getDataUrl() {
  return 'https://data.alpaca.markets';
}

function getHeaders(apiKey, secretKey) {
  return {
    'APCA-API-KEY-ID': apiKey,
    'APCA-API-SECRET-KEY': secretKey,
    'Content-Type': 'application/json',
  };
}

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

async function placeOrder(apiKey, secretKey, mode, { symbol, side, notional, qty }) {
  const body = {
    symbol: symbol.replace('/', ''),
    side,
    type: 'market',
    time_in_force: 'gtc',
  };

  // Use notional (dollar amount) for buys, qty for sells
  if (side === 'buy' && notional) {
    body.notional = notional.toFixed(2);
  } else if (qty) {
    body.qty = qty.toString();
  }

  const res = await axios.post(`${getBaseUrl(mode)}/v2/orders`, body, {
    headers: getHeaders(apiKey, secretKey),
  });
  return res.data;
}

async function closePosition(apiKey, secretKey, mode, symbol) {
  const sym = symbol.replace('/', '');
  const res = await axios.delete(`${getBaseUrl(mode)}/v2/positions/${sym}`, {
    headers: getHeaders(apiKey, secretKey),
  });
  return res.data;
}

async function getLatestCryptoPrice(apiKey, secretKey, symbol) {
  const sym = symbol.replace('/', '');
  try {
    const res = await axios.get(
      `${getDataUrl()}/v1beta3/crypto/us/latest/trades?symbols=${sym}`,
      { headers: getHeaders(apiKey, secretKey) }
    );
    return res.data?.trades?.[sym]?.p || null;
  } catch {
    return null;
  }
}

async function getCryptoBars(apiKey, secretKey, symbol, timeframe = '1Min', limit = 30) {
  const sym = symbol.replace('/', '');
  try {
    const res = await axios.get(
      `${getDataUrl()}/v1beta3/crypto/us/bars?symbols=${sym}&timeframe=${timeframe}&limit=${limit}`,
      { headers: getHeaders(apiKey, secretKey) }
    );
    return res.data?.bars?.[sym] || [];
  } catch {
    return [];
  }
}

module.exports = {
  getAccount,
  getPositions,
  placeOrder,
  closePosition,
  getLatestCryptoPrice,
  getCryptoBars,
};
