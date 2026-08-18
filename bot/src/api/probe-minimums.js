/* Apex Trader — discover each symbol's notional floor empirically.

   Alpaca enforces a minimum cost basis per crypto order and does NOT publish
   it in the assets endpoint, so it cannot be read. It CAN be provoked: submit
   an order deliberately below any plausible floor and the rejection states the
   number outright ("cost basis must be >= minimal amount of order 10").

   Safety: the probe order is sized at the asset's own min_order_size and
   priced far below market, so it is rejected by construction and, if a symbol
   ever accepts it, cannot fill at that price and is cancelled immediately.
   Every probe verifies afterwards that nothing was left resting.

   Run: npm run bot:probe            (the configured GRID_SYMBOL)
        npm run bot:probe -- BTC/USD ETH/USD LTC/USD

   Paper accounts only — it refuses to run against live. */

import { fileURLToPath } from 'node:url';

import { loadAlpacaEnv, EnvError } from '../utils/env.js';
import { createClient, AlpacaError } from './alpaca.js';

/** Pull the floor out of Alpaca's own error text. */
export function parseNotionalFloor(message) {
  if (typeof message !== 'string') return null;
  const m = message.match(/minimal amount of order\s+([\d.]+)/i)
    ?? message.match(/cost basis must be >=\s*([\d.]+)/i);
  return m ? Number(m[1]) : null;
}

async function probeSymbol(client, symbol, logger = console) {
  const asset = await client.getAsset(symbol).catch(() => null);
  if (!asset) return { symbol, error: 'asset not found' };
  if (!asset.tradable) return { symbol, error: 'not tradable' };

  const minQty = Number(asset.min_order_size);

  // Price far below market so the order cannot fill even if accepted.
  let mark;
  try {
    const q = await client.getLatestCryptoQuote(symbol);
    const quote = q?.quotes?.[symbol];
    mark = Number(quote?.bp ?? quote?.ap);
  } catch {
    return { symbol, error: 'no quote' };
  }
  if (!Number.isFinite(mark) || mark <= 0) return { symbol, error: 'no usable quote' };

  const probePrice = Number((mark * 0.5).toFixed(2));
  const probeNotional = minQty * probePrice;

  let order = null;
  try {
    order = await client.submitOrder({
      symbol,
      side: 'buy',
      qty: minQty,
      limitPrice: probePrice,
      clientOrderId: `apexprobe-${Date.now().toString(36)}`,
    });
  } catch (err) {
    const floor = parseNotionalFloor(err.message);
    return {
      symbol,
      minQty,
      probeNotional,
      floor,
      source: floor != null ? 'rejection message' : 'unparsed',
      raw: err.message,
    };
  } finally {
    // Belt and braces: if it was somehow accepted, do not leave it resting.
    if (order?.id) {
      await client.cancelOrder(order.id).catch(() => {});
      logger.warn?.(`[probe] ${symbol} accepted a $${probeNotional.toFixed(2)} order — cancelled it.`);
    }
  }

  // Accepted => the floor is at or below what we just tried.
  return { symbol, minQty, probeNotional, floor: null, source: 'accepted', raw: `accepted at $${probeNotional.toFixed(2)}` };
}

async function main() {
  const { alpaca, tradingMode } = loadAlpacaEnv();

  if (tradingMode !== 'paper') {
    console.error('\n✖ probe refuses to run outside paper mode. Set TRADING_MODE=paper.\n');
    process.exit(1);
  }

  const client = createClient(alpaca);
  const symbols = process.argv.slice(2).filter((a) => a.includes('/'));
  const targets = symbols.length ? symbols : [process.env.GRID_SYMBOL ?? 'BTC/USD'];

  console.log(`\n▲ Probing notional floors  ·  ${tradingMode}  ·  ${targets.length} symbol(s)`);
  console.log('  Orders are priced 50% below market and sized at the asset minimum,');
  console.log('  so they are rejected by construction. Nothing is left resting.\n');

  const results = [];
  for (const symbol of targets) {
    const r = await probeSymbol(client, symbol);
    results.push(r);
    const label = symbol.padEnd(10);
    if (r.error) console.log(`  ${label} ✖ ${r.error}`);
    else if (r.floor != null) console.log(`  ${label} floor $${r.floor.toFixed(2)}   (probe was $${r.probeNotional.toFixed(2)}, min qty ${r.minQty})`);
    else console.log(`  ${label} ? ${r.raw}`);
  }

  // Confirm the account is exactly as we found it.
  const leftovers = (await client.getOrders({ status: 'open', limit: 500 }))
    .filter((o) => String(o.client_order_id ?? '').startsWith('apexprobe-'));
  console.log(`\n  probe orders left resting: ${leftovers.length}`);
  for (const o of leftovers) await client.cancelOrder(o.id).catch(() => {});

  const found = results.filter((r) => r.floor != null);
  if (found.length) {
    console.log('\n  Put this in bot/.env:');
    const uniform = new Set(found.map((r) => r.floor));
    if (uniform.size === 1) {
      console.log(`    MIN_ORDER_NOTIONAL=${[...uniform][0]}`);
    } else {
      console.log(`    MIN_ORDER_NOTIONAL=${Math.max(...found.map((r) => r.floor))}   # highest across probed symbols`);
      console.log('    # floors differ per symbol:');
      for (const r of found) console.log(`    #   ${r.symbol} = ${r.floor}`);
    }
  }
  console.log('');
}

/* Only probe when RUN as a script, never when imported.
 *
 * tests/stall.test.js imports parseNotionalFloor from this file, and an
 * unguarded main() meant that import ran the whole probe as a side effect:
 *
 *   - in CI, with no credentials, loadAlpacaEnv() threw and process.exit(1)
 *     took the test runner down with it. Every push has failed since the
 *     workflow was added.
 *   - locally, with credentials present, it was worse than a failure — it
 *     quietly SUBMITTED probe orders to the paper account on every `npm test`.
 *     They are rejected by construction and cancelled, but a test suite has no
 *     business talking to the exchange at all.
 */
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    if (err instanceof EnvError) {
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
}
