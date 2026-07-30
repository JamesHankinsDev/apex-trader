/* Apex Trader — the run loop.

   One tick is: read live state, check the stops, adapt the grid, reconcile.

   Ordering inside a tick is deliberate. Stops are evaluated BEFORE any order
   is placed, so a breached limit can never be followed by fresh exposure in
   the same pass. reconcile() is the only thing that submits grid orders —
   fills are recorded for accounting via recordFill(), never re-submitted,
   or every fill would get two counter-orders. */

import { writeAnchor, readAnchor } from './utils/state.js';
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
  MANUAL: 'manual',
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Runner {
  /**
   * @param {object} opts
   * @param {object} opts.env      loaded env
   * @param {object} opts.client   Alpaca client
   * @param {object} [opts.logger]
   */
  constructor({ env, client, logger = console }) {
    this.env = env;
    this.client = client;
    this.logger = logger;
    this.symbol = env.grid.symbol;
    this.dryRun = env.runtime.dryRun;

    this.engine = null;
    this.running = false;
    this.halted = null;
    this.ticks = 0;
    /** Order ids already accounted for, so fills are recorded once. */
    this.seenFills = new Set();
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
    const [account, quotes, asset] = await Promise.all([
      this.client.getAccount(),
      this.client.getLatestCryptoQuote(this.symbol),
      this.client.getAsset(this.symbol).catch(() => null),
    ]);

    return {
      account,
      equity: Number(account.equity),
      buyingPower: Number(account.buying_power),
      // Alpaca carries the prior session's closing equity, so daily P&L needs
      // no local bookkeeping and survives restarts for free.
      dailyPnl: Number(account.equity) - Number(account.last_equity),
      price: Runner.midFrom(quotes?.quotes?.[this.symbol]),
      minOrderSize: asset?.min_order_size ? Number(asset.min_order_size) : undefined,
    };
  }

  /** Build (or rebuild) the grid from live state. */
  async buildEngine(live) {
    const openInventory = this.engine?.openInventory ?? 0;

    const raw = deriveGridConfig({
      ratios: { ...this.env.grid, ...this.env.ratios },
      equity: live.equity,
      price: live.price,
      storedAnchor: readAnchor(this.symbol),
      minOrderSize: live.minOrderSize,
      buyingPower: live.buyingPower,
      openInventory,
    });

    const config = normalizeGridConfig(raw);
    assertWithinBuyingPower(config, live.buyingPower);

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
      writeAnchor(this.symbol, raw.derivation.anchor, {
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
      storedAnchor: readAnchor(this.symbol),
      minOrderSize: live.minOrderSize,
      buyingPower: live.buyingPower,
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
    const result = await this.engine.reconcile(live.price);

    return {
      tick: this.ticks,
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
    };
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
      `+${s.submitted}/-${s.cancelled}${s.idle ? '  IDLE (out of band)' : ''}`
    );
  }
}

export default Runner;
