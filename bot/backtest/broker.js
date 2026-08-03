/* Apex Trader — a simulated exchange with the same interface as the real one.

   It implements the Alpaca client surface so the REAL Runner and GridEngine
   can be driven against it unchanged. A reimplementation of the strategy would
   only test itself; this tests the code that actually trades.

   It deliberately reproduces the exchange behaviours that broke us live, so a
   regression in any of those fixes fails the backtest too:

     - fees are taken OUT OF THE DELIVERED ASSET, not charged in cash, so a
       filled buy of X BTC leaves less than X sellable
     - orders below a notional floor are rejected outright
     - buying_power is reported NET of resting buys
     - qty_available is reported NET of resting sells
     - a client_order_id may never be reused

   Fill model: a resting BUY fills when a bar trades at or below its limit; a
   SELL when a bar trades at or above. Fills are at the limit price — no
   slippage past it, which is the optimistic end for limit orders. Within one
   bar the direction is inferred from open vs close to decide whether buys or
   sells are touched first; true intrabar path is unknowable from OHLC. */

export class SimBroker {
  /**
   * @param {object} opts
   * @param {Array} opts.bars           OHLC series, ascending
   * @param {string} opts.symbol
   * @param {number} opts.startingCash
   * @param {number} [opts.feeRate]     taken from the delivered asset
   * @param {number} [opts.minNotional]
   * @param {number} [opts.minOrderSize]
   */
  constructor({
    bars,
    symbol = 'BTC/USD',
    startingCash = 100,
    feeRate = 0.0015,
    minNotional = 10,
    minOrderSize = 0.000015565,
  }) {
    this.bars = bars;
    this.symbol = symbol;
    this.slug = symbol.replace(/[^A-Za-z0-9]/g, '');
    this.feeRate = feeRate;
    this.minNotional = minNotional;
    this.minOrderSize = minOrderSize;

    this.cash = startingCash;
    this.startingEquity = startingCash;
    /**
     * Prior session's closing equity, which is what Alpaca's `last_equity`
     * means and what the daily loss stop measures against. This used to be
     * pinned to startingEquity, which quietly turned dailyPnl into TOTAL P&L
     * and made every per-day rule untestable — the backtest was measuring a
     * different stop from the one that runs in production.
     */
    this.lastEquity = startingCash;
    this.day = null;
    this.position = 0;
    /** Weighted average cost of the held base asset, for P&L reporting. */
    this.costBasis = 0;

    this.index = 0;
    this.orders = [];
    this.seenClientIds = new Set();
    this.nextId = 1;

    this.feesPaidQuote = 0;
    this.feesPaidBase = 0;
    this.filled = [];
    /** Equity sampled once per bar, for drawdown. */
    this.equityCurve = [];
    this.rejections = [];
  }

  get bar() {
    return this.bars[this.index];
  }

  get price() {
    return this.bar.c;
  }

  get open() {
    return this.orders.filter((o) => o.status === 'new');
  }

  equity() {
    return this.cash + this.position * this.price;
  }

  /** Cash committed by resting buys — Alpaca reports buying power net of this. */
  reservedCash() {
    return this.open
      .filter((o) => o.side === 'buy')
      .reduce((s, o) => s + Number(o.qty) * Number(o.limit_price), 0);
  }

  /** Base asset committed by resting sells. */
  reservedQty() {
    return this.open.filter((o) => o.side === 'sell').reduce((s, o) => s + Number(o.qty), 0);
  }

  // ---- Alpaca client surface ---------------------------------------------

  async getAccount() {
    return {
      equity: String(this.equity()),
      last_equity: String(this.lastEquity),
      cash: String(this.cash),
      buying_power: String(Math.max(0, this.cash - this.reservedCash())),
      long_market_value: String(this.position * this.price),
    };
  }

  async getPositions() {
    if (this.position <= 0) return [];
    return [{
      symbol: this.slug,
      qty: String(this.position),
      qty_available: String(Math.max(0, this.position - this.reservedQty())),
      avg_entry_price: String(this.position > 0 ? this.costBasis / this.position : 0),
      market_value: String(this.position * this.price),
      unrealized_pl: String(this.position * this.price - this.costBasis),
    }];
  }

  async getAsset() {
    return {
      symbol: this.symbol,
      class: 'crypto',
      tradable: true,
      min_order_size: String(this.minOrderSize),
    };
  }

  async getLatestCryptoQuote() {
    // A nominal spread around the close; the grid only uses the mid.
    const p = this.price;
    return { quotes: { [this.symbol]: { bp: p * 0.9997, ap: p * 1.0003 } } };
  }

  async getOrders({ status = 'open' } = {}) {
    if (status === 'open') return this.open.map((o) => ({ ...o }));
    if (status === 'closed') return this.orders.filter((o) => o.status !== 'new').map((o) => ({ ...o }));
    return this.orders.map((o) => ({ ...o }));
  }

  async submitOrder({ symbol, side, qty, limitPrice, clientOrderId, type = 'limit' }) {
    const quantity = Number(qty);
    const price = type === 'market' ? this.price : Number(limitPrice);

    if (clientOrderId && this.seenClientIds.has(clientOrderId)) {
      throw this.#reject('client_order_id must be unique', { side, qty: quantity, price });
    }
    if (quantity < this.minOrderSize) {
      throw this.#reject(
        `qty must be >= minimum order size ${this.minOrderSize}`,
        { side, qty: quantity, price },
      );
    }
    if (quantity * price < this.minNotional) {
      throw this.#reject(
        `cost basis must be >= minimal amount of order ${this.minNotional}`,
        { side, qty: quantity, price },
      );
    }
    if (side === 'buy' && quantity * price > this.cash - this.reservedCash() + 1e-9) {
      throw this.#reject('insufficient buying power', { side, qty: quantity, price });
    }
    if (side === 'sell' && quantity > this.position - this.reservedQty() + 1e-12) {
      throw this.#reject(
        `insufficient balance for ${this.symbol.split('/')[0]} ` +
        `(requested: ${quantity}, available: ${this.position - this.reservedQty()})`,
        { side, qty: quantity, price },
      );
    }

    if (clientOrderId) this.seenClientIds.add(clientOrderId);

    const order = {
      id: `sim-${this.nextId++}`,
      client_order_id: clientOrderId ?? `sim-auto-${this.nextId}`,
      symbol: this.symbol,
      side,
      qty: String(quantity),
      limit_price: String(price),
      type,
      status: 'new',
      submittedAt: this.bar.t,
    };
    this.orders.push(order);

    // A market order crosses immediately.
    if (type === 'market') this.#fill(order, this.price);

    return { ...order };
  }

  async cancelOrder(id) {
    const o = this.orders.find((x) => x.id === id);
    if (o && o.status === 'new') o.status = 'canceled';
    return {};
  }

  // ---- simulation --------------------------------------------------------

  /**
   * Advance one bar, filling any resting order the bar's range touches.
   * @returns {boolean} false when the series is exhausted
   */
  advance() {
    if (this.index >= this.bars.length - 1) return false;

    // Sample the prior session's close BEFORE this bar trades, so last_equity
    // means what Alpaca means by it rather than "equity mid-session".
    const priorClose = this.equity();
    this.index++;
    const b = this.bar;

    const day = String(b.t).slice(0, 10);
    if (this.day !== null && day !== this.day) this.lastEquity = priorClose;
    this.day = day;

    // OHLC hides the intrabar path. On a down bar assume the low came first,
    // so buys are touched before sells; on an up bar, the reverse.
    const downFirst = b.c < b.o;
    const resting = this.open.slice();
    const buys = resting.filter((o) => o.side === 'buy' && b.l <= Number(o.limit_price));
    const sells = resting.filter((o) => o.side === 'sell' && b.h >= Number(o.limit_price));

    for (const o of downFirst ? [...buys, ...sells] : [...sells, ...buys]) {
      if (o.status === 'new') this.#fill(o, Number(o.limit_price));
    }

    this.equityCurve.push({ t: b.t, equity: this.equity(), price: b.c });
    return true;
  }

  #fill(order, price) {
    const qty = Number(order.qty);

    if (order.side === 'buy') {
      const cost = qty * price;
      // The fee is taken out of the asset delivered, NOT charged in cash.
      const received = qty * (1 - this.feeRate);
      this.cash -= cost;
      this.position += received;
      this.costBasis += cost;
      this.feesPaidBase += qty - received;
    } else {
      const gross = qty * price;
      const net = gross * (1 - this.feeRate);
      // Release cost basis proportionally to what was sold.
      const share = this.position > 0 ? Math.min(1, qty / this.position) : 0;
      this.costBasis -= this.costBasis * share;
      this.position -= qty;
      this.cash += net;
      this.feesPaidQuote += gross - net;
    }

    order.status = 'filled';
    order.filled_qty = order.qty;
    order.filled_avg_price = String(price);
    order.filled_at = this.bar.t;
    this.filled.push({ ...order });
  }

  #reject(message, ctx) {
    this.rejections.push({ ...ctx, reason: message, at: this.bar?.t });
    return new Error(message);
  }
}

export default SimBroker;
