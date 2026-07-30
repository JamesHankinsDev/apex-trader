/* Apex Trader — Alpaca REST client.

   Thin wrapper over native fetch rather than the SDK: every request is visible,
   errors carry the API's own message, and there's no version drift to debug.
   The @alpacahq/alpaca-trade-api dependency is still there for websocket
   streaming when fill tracking needs it. */

export class AlpacaError extends Error {
  constructor(message, { status, endpoint, body } = {}) {
    super(message);
    this.name = 'AlpacaError';
    this.status = status;
    this.endpoint = endpoint;
    this.body = body;
  }
}

/**
 * @param {object} cfg  the `alpaca` block from loadAlpacaEnv()
 */
export function createClient(cfg) {
  const { keyId, secretKey, baseUrl, dataUrl } = cfg;

  const headers = {
    'APCA-API-KEY-ID': keyId,
    'APCA-API-SECRET-KEY': secretKey,
    accept: 'application/json',
  };

  async function request(path, { base = baseUrl, method = 'GET', body, query } = {}) {
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    let res;
    try {
      res = await fetch(url, {
        method,
        headers: body ? { ...headers, 'content-type': 'application/json' } : headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (cause) {
      // Network-level failure — DNS, TLS, offline.
      throw new AlpacaError(`Could not reach ${url.host}: ${cause.message}`, {
        endpoint: path,
      });
    }

    const text = await res.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      // Alpaca returns { code, message } on errors; surface it verbatim.
      const detail = parsed?.message ?? (typeof parsed === 'string' ? parsed : res.statusText);
      throw new AlpacaError(detail || `HTTP ${res.status}`, {
        status: res.status,
        endpoint: path,
        body: parsed,
      });
    }

    return parsed;
  }

  return {
    request,

    /** Account status, equity, buying power. */
    getAccount: () => request('/v2/account'),

    /** Open positions across all assets. */
    getPositions: () => request('/v2/positions'),

    /**
     * Orders. `status` is 'open' | 'closed' | 'all'.
     * @param {{status?: string, limit?: number, symbols?: string}} [opts]
     */
    getOrders: (opts = {}) =>
      request('/v2/orders', { query: { status: 'open', limit: 100, ...opts } }),

    /**
     * Submit a resting limit order.
     * GTC because grid levels are meant to sit until price reaches them.
     *
     * @param {object} o  { symbol, side, qty, limitPrice, clientOrderId }
     */
    submitOrder: ({ symbol, side, qty, limitPrice, clientOrderId }) =>
      request('/v2/orders', {
        method: 'POST',
        body: {
          symbol,
          side,
          qty: String(qty),
          type: 'limit',
          time_in_force: 'gtc',
          limit_price: String(limitPrice),
          ...(clientOrderId ? { client_order_id: clientOrderId } : {}),
        },
      }),

    cancelOrder: (id) => request(`/v2/orders/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    /** Market clock — crypto trades 24/7, but useful for equities parity. */
    getClock: () => request('/v2/clock'),

    /** Tradable asset metadata, e.g. getAsset('BTC/USD'). */
    getAsset: (symbol) => request(`/v2/assets/${encodeURIComponent(symbol)}`),

    /** Latest quote for a crypto pair, from the data endpoint. */
    getLatestCryptoQuote: (symbol) =>
      request('/v1beta3/crypto/us/latest/quotes', {
        base: dataUrl,
        query: { symbols: symbol },
      }),
  };
}

export default createClient;
