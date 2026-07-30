/* Apex Trader — the run loop.

   One tick is: read live state, check the stops, adapt the grid, reconcile.

   Ordering inside a tick is deliberate. Stops are evaluated BEFORE any order
   is placed, so a breached limit can never be followed by fresh exposure in
   the same pass. reconcile() is the only thing that submits grid orders —
   fills are recorded for accounting via recordFill(), never re-submitted,
   or every fill would get two counter-orders. */

import * as liveState from './utils/state.js';
import {
  normalizeGridConfig,
  assertWithinBuyingPower,
  resolveRiskLimits,
  resolveStopPrice,
} from './grid/config.js';
import { deriveGridConfig } from './grid/sizing.js';
import { shouldResize, canReanchor } from './grid/rebalance.js';
import { GridEngine, isOutOfBand, parseClientOrderId } from './grid/engine.js';

export const HALT = Object.freeze({
  DAILY_LOSS: 'daily_loss',
  STOP_PRICE: 'stop_price',
  STALLED: 'stalled',
  MANUAL: 'manual',
});

/**
 * Consecutive ticks that want to place orders and get every one rejected,
 * before the loop halts. Counting only successes made "the exchange is
 * refusing everything" render as +0/-0 — identical to a healthy converged
 * grid. The bot sat there looking fine while placing nothing.
 */
export const STALL_LIMIT = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Runner {
  /**
   * @param {object} opts
   * @param {object} opts.env      loaded env
   * @param {object} opts.client   Alpaca client
   * @param {object} [opts.logger]
   */
  constructor({ env, client, logger = console, state = liveState }) {
    this.env = env;
    this.client = client;
    this.logger = logger;
    /**
     * Anchor persistence. Injectable because the backtest drives this same
     * Runner: with the live module hard-wired, every backtest wrote its
     * simulated anchor into bot/state/anchor.json and clobbered the real one.
     */
    this.state = state;
    this.symbol = env.grid.symbol;
    this.dryRun = env.runtime.dryRun;

    this.engine = null;
    this.running = false;
    this.halted = null;
    this.ticks = 0;
    this.startedAt = Date.now();
    this.lastTick = null;
    this.lastError = null;
    /** Consecutive ticks where every attempted order was rejected. */
    this.stalls = 0;
    /** Rejections from the most recent tick, surfaced to the dashboard. */
    this.lastRejections = [];
    /** Order ids already accounted for, so fills are recorded once. */
    this.seenFills = new Set();
  }

  /**
   * Everything the dashboard needs, from memory. Deliberately does NOT call
   * Alpaca: the loop is the only thing that talks to the exchange, so the API
   * can be polled hard without burning rate limit or racing a tick.
   */
  snapshot() {
    const e = this.engine;
    const t = this.lastTick;

    return {
      status: {
        running: this.running,
        halted: this.halted,
        dryRun: this.dryRun,
        mode: this.env.tradingMode,
        symbol: this.symbol,
        ticks: this.ticks,
        uptimeMs: Date.now() - this.startedAt,
        lastTickAt: t?.at ?? null,
        lastError: this.lastError,
        stalls: this.stalls,
        stallLimit: STALL_LIMIT,
      },
      account: t
        ? { equity: t.equity, dailyPnl: t.dailyPnl, lossLimit: t.lossLimit }
        : null,
      market: t ? { price: t.price, idle: t.idle } : null,
      grid: e
        ? {
            lowerBound: e.config.lowerBound,
            upperBound: e.config.upperBound,
            levels: e.config.levels,
            spacing: e.config.spacing,
            orderSize: e.orderSize,
            anchorMode: this.env.ratios.anchorMode,
            stopPrice: t?.stopPrice ?? null,
          }
        : null,
      position: e
        ? {
            inventory: e.openInventory,
            heldLevels: [...e.inventory.entries()].map(([levelIndex, h]) => ({
              levelIndex,
              qty: h.qty,
              price: h.price,
            })),
            realizedPnl: e.realizedPnl,
            roundTrips: e.fills.filter((f) => f.realizedPnl !== undefined).length,
          }
        : null,
      book: e && t ? e.desiredOrders(t.price) : [],
      ladder: e
        ? e.levels.map((l) => ({
            index: l.index,
            price: l.price,
            held: e.inventory.has(l.index),
          }))
        : [],
      fills: e ? e.fills.slice(-50).reverse() : [],
      rejections: this.lastRejections,
    };
  }

  /** Mid price from a crypto quote. */
  static midFrom(quote) {
    const bid = Number(quote?.bp);
    const ask = Number(quote?.ap);
    if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) return (bid + ask) / 2;
    const one = Number.isFinite(ask) && ask > 0 ? ask : bid;
    if (!Number.isFinite(one) || one <= 0) throw new Error('Quote had no usable bid or ask.');
    return one;
  }

  /** Fetch everything a tick needs in one round of requests. */
  async readLiveState() {
    const [account, quotes, asset, open, positions] = await Promise.all([
      this.client.getAccount(),
      this.client.getLatestCryptoQuote(this.symbol),
      this.client.getAsset(this.symbol).catch(() => null),
      this.client.getOrders({ status: 'open', limit: 500 }).catch(() => []),
      this.client.getPositions().catch(() => []),
    ]);

    // Positions come back without the slash: BTC/USD -> BTCUSD.
    const slug = this.symbol.replace(/[^A-Za-z0-9]/g, '');
    const position = positions.find((p) => p.symbol === slug || p.symbol === this.symbol);

    // Same double-counting trap as buying power, one asset over: qty_available
    // EXCLUDES quantity reserved by our own resting sell. Using it directly
    // makes the grid oscillate — place the exit, next tick sees 0 available and
    // cancels it, tick after sees the balance again and re-places it, forever.
    // Add our own sell reservations back; a sell placed by hand is left out,
    // because that inventory really is committed elsewhere.
    let reservedQty = 0;
    for (const o of open) {
      if (o.symbol !== this.symbol) continue;
      if (!parseClientOrderId(o.client_order_id)) continue;
      if (o.side !== 'sell') continue;
      reservedQty += Number(o.qty);
    }

    const availableQty = position
      ? Number(position.qty_available ?? position.qty) + reservedQty
      : 0;

    // A resting buy already has its cost deducted from buying_power. Comparing
    // the grid's TOTAL worst case against what's left double-counts the grid's
    // own orders: place 3 of 5 levels and the next tick sees the remaining
    // capacity and refuses to place level 4. Add our own reservations back to
    // get true capacity. Orders placed by hand are deliberately NOT added back
    // — that capital really is spoken for.
    let reserved = 0;
    for (const o of open) {
      if (o.symbol !== this.symbol) continue;
      if (!parseClientOrderId(o.client_order_id)) continue;
      if (o.side !== 'buy') continue;
      reserved += Number(o.qty) * Number(o.limit_price);
    }

    return {
      account,
      equity: Number(account.equity),
      buyingPower: Number(account.buying_power) + reserved,
      rawBuyingPower: Number(account.buying_power),
      reserved,
      // Alpaca carries the prior session's closing equity, so daily P&L needs
      // no local bookkeeping and survives restarts for free.
      dailyPnl: Number(account.equity) - Number(account.last_equity),
      price: Runner.midFrom(quotes?.quotes?.[this.symbol]),
      minOrderSize: asset?.min_order_size ? Number(asset.min_order_size) : undefined,
      position,
      availableQty,
    };
  }

  /** Build (or rebuild) the grid from live state. */
  async buildEngine(live) {
    const openInventory = this.engine?.openInventory ?? 0;

    const raw = deriveGridConfig({
      ratios: { ...this.env.grid, ...this.env.ratios },
      equity: live.equity,
      price: live.price,
      storedAnchor: this.state.readAnchor(this.symbol),
      minOrderSize: live.minOrderSize,
      minOrderNotional: this.env.ratios.minOrderNotional,
      buyingPower: live.buyingPower + (this.engine?.heldCost ?? 0),
      openInventory,
    });

    const config = normalizeGridConfig(raw);
    // Cash already converted into inventory still counts as grid capital.
    assertWithinBuyingPower(config, live.buyingPower, this.engine?.heldCost ?? 0);

    const previous = this.engine;
    this.engine = new GridEngine({
      config,
      client: this.client,
      dryRun: this.dryRun,
      logger: this.logger,
    });

    // Carry accounting across a rebuild.
    if (previous) {
      this.engine.inventory = previous.inventory;
      this.engine.fills = previous.fills;
      this.engine.realizedPnl = previous.realizedPnl;
      this.engine.nonce = previous.nonce;
    }

    if (raw.derivation) {
      this.state.writeAnchor(this.symbol, raw.derivation.anchor, {
        mode: this.env.ratios.anchorMode,
        price: live.price,
      });
    }

    return { config, derivation: raw.derivation };
  }

  /** Pull in any fills since the last tick, for inventory and P&L. */
  async ingestFills() {
    const closed = await this.client.getOrders({ status: 'closed', limit: 100 });
    const fresh = [];

    for (const o of closed) {
      if (o.status !== 'filled') continue;
      if (o.symbol !== this.symbol) continue;
      if (!parseClientOrderId(o.client_order_id)) continue;
      if (this.seenFills.has(o.id)) continue;

      this.seenFills.add(o.id);
      this.engine.recordFill(o); // state only — reconcile() does the placing
      fresh.push(o);
    }

    return fresh;
  }

  /**
   * Cut stranded inventory at the stop price.
   * A market order: at this point filling matters more than the price.
   */
  async liquidate(reason, live) {
    const qty = this.engine.openInventory;
    if (qty <= 0) return null;

    this.logger.warn?.(`[runner] STOP — ${reason}. Liquidating ${qty} ${this.symbol}.`);

    if (this.dryRun) {
      this.logger.warn?.('[runner] dry run — no liquidation sent.');
      return { dryRun: true, qty };
    }

    // Cancel resting orders first so they cannot race the exit.
    await this.engine.shutdown();

    const order = await this.client.submitOrder({
      symbol: this.symbol,
      side: 'sell',
      qty,
      type: 'market',
    });

    // Book the loss against recorded entry prices.
    let cost = 0;
    for (const held of this.engine.inventory.values()) cost += held.qty * held.price;
    const proceeds = qty * live.price;
    this.engine.realizedPnl += proceeds - cost;
    this.engine.inventory.clear();

    return order;
  }

  /** Stop the loop. Cancels resting orders; does NOT liquidate. */
  async halt(reason) {
    this.halted = reason;
    this.running = false;
    this.logger.warn?.(`[runner] halted: ${reason}`);
    if (this.engine && !this.dryRun) await this.engine.shutdown();
  }

  /**
   * One pass. Returns a summary of what it did.
   */
  async tick() {
    this.ticks++;
    const live = await this.readLiveState();
    const risk = resolveRiskLimits(this.env.risk, live.equity);

    // 1 — daily loss. Checked before anything is placed.
    if (live.dailyPnl <= risk.maxDailyLossUsd) {
      await this.halt(HALT.DAILY_LOSS);
      this.lastTick = {
        ...(this.lastTick ?? {}),
        at: Date.now(),
        equity: live.equity,
        price: live.price,
        dailyPnl: live.dailyPnl,
        lossLimit: risk.maxDailyLossUsd,
      };
      return {
        halted: HALT.DAILY_LOSS,
        dailyPnl: live.dailyPnl,
        limit: risk.maxDailyLossUsd,
      };
    }

    if (!this.engine) {
      await this.buildEngine(live);
      await this.engine.hydrate();
      for (const o of await this.client.getOrders({ status: 'closed', limit: 100 })) {
        if (o.status === 'filled') this.seenFills.add(o.id);
      }
    } else {
      await this.ingestFills();
    }

    // 2 — price stop on held inventory.
    const stop = resolveStopPrice(this.engine.config, this.env.risk.stopPct);
    if (stop && this.engine.openInventory > 0 && live.price <= stop.stopPrice) {
      await this.liquidate(
        `price $${live.price.toFixed(2)} at or below stop $${stop.stopPrice.toFixed(2)}`,
        live,
      );
      await this.halt(HALT.STOP_PRICE);
      return { halted: HALT.STOP_PRICE, price: live.price, stopPrice: stop.stopPrice };
    }

    // 3 — compound into a larger size if equity has moved enough.
    const derived = deriveGridConfig({
      ratios: { ...this.env.grid, ...this.env.ratios },
      equity: live.equity,
      price: live.price,
      storedAnchor: this.state.readAnchor(this.symbol),
      minOrderSize: live.minOrderSize,
      minOrderNotional: this.env.ratios.minOrderNotional,
      buyingPower: live.buyingPower + this.engine.heldCost,
      openInventory: this.engine.openInventory,
    });

    const resize = shouldResize({
      mode: this.env.ratios.resizeMode,
      currentSize: this.engine.orderSize,
      derivedSize: derived.orderSize,
      threshold: this.env.ratios.resizeThreshold,
      openInventory: this.engine.openInventory,
    });
    if (resize.resize) {
      const change = this.engine.applyResize(derived.orderSize);
      this.logger.info?.(`[runner] resized ${change.previous.toFixed(9)} -> ${change.current.toFixed(9)} (${resize.reason})`);
    }

    // 4 — re-centre the band, but only when nothing is held.
    const wantsReanchor = derived.derivation?.anchorMoved === true;
    const gate = canReanchor({
      wantsReanchor,
      openInventory: this.engine.openInventory,
      openOrders: this.engine.inventory.size,
    });
    if (gate.reanchor) {
      this.logger.info?.(`[runner] re-anchoring: ${gate.reason}`);
      await this.buildEngine(live);
    }

    // 5 — bring the book in line.
    //
    // Exits are capped at the balance the exchange says we actually hold, not
    // at what we bought: the crypto fee is taken out of the delivered asset,
    // so bought > sellable and an uncapped counter-sell is always rejected.
    this.engine.availableQty = live.availableQty;
    const result = await this.engine.reconcile(live.price);
    this.lastRejections = result.rejected ?? [];

    // A tick that wanted to place orders and had every one refused is NOT a
    // converged grid, even though both submit zero. Track it explicitly.
    const stalled = this.lastRejections.length > 0 && result.submitted.length === 0;
    this.stalls = stalled ? this.stalls + 1 : 0;

    if (this.stalls >= STALL_LIMIT) {
      const reasons = [...new Set(this.lastRejections.map((r) => r.reason))];
      this.logger.warn?.(
        `[runner] ${this.stalls} consecutive ticks with every order rejected: ${reasons.join(' | ')}`,
      );
      await this.halt(HALT.STALLED);
      return {
        halted: HALT.STALLED,
        stalls: this.stalls,
        rejected: this.lastRejections.length,
        reasons,
      };
    }

    const summary = {
      tick: this.ticks,
      at: Date.now(),
      price: live.price,
      equity: live.equity,
      dailyPnl: live.dailyPnl,
      lossLimit: risk.maxDailyLossUsd,
      stopPrice: stop?.stopPrice,
      inventory: this.engine.openInventory,
      realizedPnl: this.engine.realizedPnl,
      idle: isOutOfBand(this.engine.config, live.price),
      submitted: result.submitted.length,
      cancelled: result.cancelled.length,
      rejected: this.lastRejections.length,
      desired: result.desired ?? 0,
      stalls: this.stalls,
    };

    this.lastTick = summary;
    this.lastError = null;
    return summary;
  }

  /** Loop until halted. One failed tick is logged and retried, not fatal. */
  async start({ maxTicks = Infinity } = {}) {
    this.running = true;
    const interval = this.env.runtime.pollIntervalMs;

    while (this.running && this.ticks < maxTicks) {
      try {
        const summary = await this.tick();
        if (summary.halted) break;
        this.logger.info?.(this.format(summary));
      } catch (err) {
        // A transient API error must not kill an unattended bot.
        this.lastError = { message: err.message, at: Date.now() };
        this.logger.warn?.(`[runner] tick ${this.ticks} failed: ${err.message}`);
      }
      if (!this.running) break;
      await sleep(interval);
    }

    return { ticks: this.ticks, halted: this.halted };
  }

  format(s) {
    const pnl = s.realizedPnl >= 0 ? `+$${s.realizedPnl.toFixed(2)}` : `-$${Math.abs(s.realizedPnl).toFixed(2)}`;
    const day = s.dailyPnl >= 0 ? `+$${s.dailyPnl.toFixed(2)}` : `-$${Math.abs(s.dailyPnl).toFixed(2)}`;
    return (
      `[${String(s.tick).padStart(4)}] $${s.price.toFixed(2)}  ` +
      `inv ${s.inventory}  realized ${pnl}  day ${day}/$${s.lossLimit.toFixed(2)}  ` +
      `+${s.submitted}/-${s.cancelled}` +
      (s.rejected ? `  ⚠ ${s.rejected} REJECTED (stall ${s.stalls}/${STALL_LIMIT})` : '') +
      (s.idle ? '  IDLE (out of band)' : '')
    );
  }
}

export default Runner;
