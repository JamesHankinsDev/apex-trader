// src/crypto-stream.js - Alpaca WebSocket streaming for real-time crypto prices
// Maintains a live price cache updated via trades stream.
// Multiple consumers (main bot, experiment bot) can share one connection per API key.

const WebSocket = require('ws');

const ALPACA_STREAM_URL = 'wss://stream.data.alpaca.markets/v1beta3/crypto/us';

class CryptoStream {
  constructor() {
    this.connections = new Map(); // key -> { ws, prices, symbols, reconnectTimer, pingTimer }
  }

  /**
   * Connect to Alpaca's crypto WebSocket and subscribe to trade updates.
   * Returns a handle that can be used to get prices and disconnect.
   */
  connect(apiKey, secretKey, symbols, onEvent) {
    const key = apiKey; // one connection per API key
    const existing = this.connections.get(key);
    if (existing?.ws?.readyState === WebSocket.OPEN) {
      // Already connected — merge in any new symbols
      const newSymbols = symbols.filter(s => !existing.symbols.has(s));
      if (newSymbols.length > 0) {
        newSymbols.forEach(s => existing.symbols.add(s));
        this._subscribe(existing.ws, newSymbols);
      }
      return key;
    }

    const state = {
      ws: null,
      prices: new Map(),    // symbol -> { price, timestamp }
      symbols: new Set(symbols),
      reconnectTimer: null,
      pingTimer: null,
      apiKey,
      secretKey,
      onEvent: onEvent || (() => {}),
      reconnectAttempts: 0,
    };
    this.connections.set(key, state);
    this._connect(key, state);
    return key;
  }

  _connect(key, state) {
    if (state.ws) {
      try { state.ws.close(); } catch {}
    }

    const ws = new WebSocket(ALPACA_STREAM_URL);
    state.ws = ws;

    ws.on('open', () => {
      state.reconnectAttempts = 0;
      // Authenticate
      ws.send(JSON.stringify({
        action: 'auth',
        key: state.apiKey,
        secret: state.secretKey,
      }));
    });

    ws.on('message', (raw) => {
      let msgs;
      try { msgs = JSON.parse(raw); } catch { return; }
      if (!Array.isArray(msgs)) msgs = [msgs];

      for (const msg of msgs) {
        // Authentication success
        if (msg.T === 'success' && msg.msg === 'authenticated') {
          state.onEvent('info', 'WebSocket authenticated — subscribing to trades');
          this._subscribe(ws, [...state.symbols]);

          // Start ping interval to keep connection alive
          if (state.pingTimer) clearInterval(state.pingTimer);
          state.pingTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.ping();
          }, 30000);
        }

        // Subscription confirmation
        if (msg.T === 'subscription') {
          const count = msg.trades?.length || 0;
          state.onEvent('info', `Streaming ${count} symbols`);
        }

        // Trade update — this is the real-time price
        if (msg.T === 't') {
          const symbol = msg.S; // e.g. "BTC/USD"
          const price = msg.p;
          const timestamp = msg.t;
          if (symbol && price > 0) {
            state.prices.set(symbol, { price, timestamp, receivedAt: Date.now() });
          }
        }

        // Error
        if (msg.T === 'error') {
          state.onEvent('warning', `Stream error: ${msg.msg} (code ${msg.code})`);
          // 406 = connection limit exceeded — stop reconnecting, fall back to REST
          if (msg.code === 406) {
            state.onEvent('info', 'Connection limit reached — falling back to REST polling');
            state.noReconnect = true;
            try { ws.close(); } catch {}
          }
        }
      }
    });

    ws.on('close', (code) => {
      if (state.pingTimer) { clearInterval(state.pingTimer); state.pingTimer = null; }

      // Don't reconnect if intentionally disconnected or connection limit hit
      if (!this.connections.has(key) || state.noReconnect) return;

      state.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, state.reconnectAttempts), 30000);
      state.onEvent('warning', `Stream disconnected (code ${code}), reconnecting in ${delay / 1000}s...`);
      state.reconnectTimer = setTimeout(() => this._connect(key, state), delay);
    });

    ws.on('error', (err) => {
      state.onEvent('danger', `Stream error: ${err.message}`);
    });
  }

  _subscribe(ws, symbols) {
    if (ws.readyState !== WebSocket.OPEN) return;
    // Alpaca expects symbols with slash for crypto: "BTC/USD"
    const syms = symbols.map(s => s.includes('/') ? s : s.replace(/USD$/, '/USD'));
    ws.send(JSON.stringify({
      action: 'subscribe',
      trades: syms,
    }));
  }

  /**
   * Get the latest streamed price for a symbol.
   * Returns { price, age } or null if no data.
   * Age is in milliseconds since the price was received.
   */
  getPrice(handle, symbol) {
    const state = this.connections.get(handle);
    if (!state) return null;
    const sym = symbol.includes('/') ? symbol : symbol.replace(/USD$/, '/USD');
    const entry = state.prices.get(sym);
    if (!entry) return null;
    return {
      price: entry.price,
      age: Date.now() - entry.receivedAt,
    };
  }

  /**
   * Get all current prices as a Map.
   */
  getAllPrices(handle) {
    const state = this.connections.get(handle);
    if (!state) return new Map();
    return state.prices;
  }

  /**
   * Check if the stream is connected and authenticated.
   */
  isConnected(handle) {
    const state = this.connections.get(handle);
    return state?.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect and clean up.
   */
  disconnect(handle) {
    const state = this.connections.get(handle);
    if (!state) return;
    if (state.pingTimer) clearInterval(state.pingTimer);
    if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
    if (state.ws) {
      try { state.ws.close(); } catch {}
    }
    this.connections.delete(handle);
  }
}

// Singleton — shared across both bots
module.exports = new CryptoStream();
