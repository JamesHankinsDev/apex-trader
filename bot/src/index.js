/* Apex Trader — bot entry point.

   Reads live account state from Alpaca, derives the grid from ratios, and
   prints what it would rest. The live trading loop is still gated behind the
   unimplemented GridEngine.reconcile / onFill. */

import { loadEnv, EnvError } from './utils/env.js';
import { readAnchor, writeAnchor } from './utils/state.js';
import { createClient, AlpacaError } from './api/alpaca.js';
import {
  normalizeGridConfig,
  assertWithinBuyingPower,
  resolveRiskLimits,
  GridConfigError,
} from './grid/config.js';
import { deriveGridConfig, SizingError } from './grid/sizing.js';
import { GridEngine, isOutOfBand } from './grid/engine.js';

function fmt(n, digits = 2) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Mid price from a crypto quote, falling back to whichever side exists. */
function midFrom(quote) {
  const bid = Number(quote?.bp);
  const ask = Number(quote?.ap);
  if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) return (bid + ask) / 2;
  if (Number.isFinite(ask) && ask > 0) return ask;
  if (Number.isFinite(bid) && bid > 0) return bid;
  throw new AlpacaError('Quote contained no usable bid or ask.');
}

function printGrid(engine, cfg, price) {
  const plan = engine.plan(price);
  const shown = plan.length ? plan : engine.levels;

  for (const lvl of [...shown].reverse()) {
    const side = lvl.side ? lvl.side.toUpperCase().padEnd(4) : ' --  ';
    const marker = lvl.side === null ? '  <- price' : '';
    console.log(`   ${String(lvl.index).padStart(3)}  ${side}  $${fmt(lvl.price)}${marker}`);
  }
}

async function main() {
  const env = loadEnv();
  const client = createClient(env.alpaca);
  const { symbol } = env.grid;

  console.log(`\n▲ Apex Trader 2.0  ·  mode=${env.tradingMode}  ·  ${env.alpaca.baseUrl}`);

  // ---- live state --------------------------------------------------------
  const [account, quotes, asset] = await Promise.all([
    client.getAccount(),
    client.getLatestCryptoQuote(symbol),
    client.getAsset(symbol).catch(() => null),
  ]);

  const equity = Number(account.equity);
  const buyingPower = Number(account.buying_power);
  const price = midFrom(quotes?.quotes?.[symbol]);
  const minOrderSize = asset?.min_order_size ? Number(asset.min_order_size) : undefined;

  console.log(`  equity $${fmt(equity)}  ·  buying power $${fmt(buyingPower)}  ·  ${symbol} $${fmt(price)}\n`);

  // ---- derive the grid ---------------------------------------------------
  const pinned =
    env.grid.lowerBound !== undefined &&
    env.grid.upperBound !== undefined &&
    env.grid.orderSize !== undefined;

  let raw;
  if (pinned) {
    console.warn('  ! GRID_LOWER_BOUND / UPPER_BOUND / ORDER_SIZE are pinned —');
    console.warn('    this grid will NOT rescale as the account grows.\n');
    raw = env.grid;
  } else {
    raw = deriveGridConfig({
      ratios: { ...env.grid, ...env.ratios },
      equity,
      price,
      storedAnchor: readAnchor(symbol),
      minOrderSize,
      minOrderNotional: env.ratios.minOrderNotional,
      buyingPower,
    });
  }

  const cfg = normalizeGridConfig(raw);
  assertWithinBuyingPower(cfg, buyingPower);
  const risk = resolveRiskLimits(env.risk, equity);

  // ---- report ------------------------------------------------------------
  const d = raw.derivation;
  if (d) {
    console.log(`  anchor    $${fmt(d.anchor)}  (${d.anchorReason})`);
    console.log(`  band      ±${(d.bandPct * 100).toFixed(1)}%  ->  $${fmt(cfg.lowerBound)} – $${fmt(cfg.upperBound)}`);
    console.log(`  allocate  ${(d.allocationPct * 100).toFixed(0)}% of equity = $${fmt(d.deployable)}`);
  } else {
    console.log(`  band      $${fmt(cfg.lowerBound)} – $${fmt(cfg.upperBound)} (pinned)`);
  }

  console.log(`  size      ${cfg.orderSize.toFixed(8)} ${symbol.split('/')[0]}/level = $${fmt(cfg.orderSize * price)} each`);
  if (minOrderSize) {
    const headroom = cfg.orderSize / minOrderSize;
    console.log(`            exchange min ${minOrderSize} (${headroom.toFixed(1)}x headroom)`);
  }
  console.log(`  worst     $${fmt(cfg.maxNotional)} of $${fmt(buyingPower)} buying power`);
  console.log(`  stop      $${fmt(risk.maxDailyLossUsd)}/day via ${risk.source}`);
  console.log(`\n  ${cfg.levels} levels · ${cfg.spacing} spacing\n`);

  const engine = new GridEngine({ config: cfg, client, dryRun: env.runtime.dryRun });
  printGrid(engine, cfg, price);

  if (isOutOfBand(cfg, price)) {
    console.warn('\n  ⚠️  price is outside the band — the grid idles.');
  }

  // Persist the anchor so a restart doesn't silently re-centre the grid.
  if (d?.anchor !== undefined) {
    writeAnchor(symbol, d.anchor, { mode: env.ratios.anchorMode, price });
  }

  // ---- reconcile ---------------------------------------------------------
  await engine.hydrate();
  if (engine.openInventory > 0) {
    console.log(`\n  holding ${engine.openInventory} from ${engine.inventory.size} level(s)`);
  }

  const result = await engine.reconcile(price);

  console.log(`\n  ${env.runtime.dryRun ? 'WOULD submit' : 'submitted'} ${result.submitted.length} order(s)` +
    `, ${env.runtime.dryRun ? 'would cancel' : 'cancelled'} ${result.cancelled.length}` +
    (result.skipped ? `  (${result.skipped})` : ''));

  for (const o of result.submitted.slice(0, 8)) {
    const side = (o.side ?? '').toUpperCase().padEnd(4);
    console.log(`    ${side} ${o.qty ?? ''} @ $${fmt(Number(o.price ?? o.limitPrice ?? 0))}`);
  }
  if (result.submitted.length > 8) {
    console.log(`    … ${result.submitted.length - 8} more`);
  }

  if (env.runtime.dryRun) {
    console.log('\n  DRY_RUN is on — nothing was sent. Set DRY_RUN=false to place orders.\n');
  } else {
    console.log('');
  }
}

main().catch((err) => {
  if (err instanceof EnvError || err instanceof GridConfigError || err instanceof SizingError) {
    console.error(`\n✖ ${err.name}: ${err.message}\n`);
    process.exit(1);
  }
  if (err instanceof AlpacaError) {
    console.error(`\n✖ Alpaca (${err.status ?? 'no response'}) on ${err.endpoint}: ${err.message}\n`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
