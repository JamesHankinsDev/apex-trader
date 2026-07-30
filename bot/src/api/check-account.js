/* Apex Trader — credential smoke test.

   Read-only. Places no orders, cancels nothing, changes no settings.
   Confirms the keys authenticate, the endpoint is the one you expect, and
   the account can actually trade the configured crypto pair.

   Run: npm run bot:check */

import { loadAlpacaEnv, EnvError } from '../utils/env.js';
import { createClient, AlpacaError } from './alpaca.js';

const ok = (s) => `  ✓ ${s}`;
const bad = (s) => `  ✖ ${s}`;
const warn = (s) => `  ! ${s}`;

function usd(n) {
  return Number(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

/** Mask a key so it can be shown without leaking it. */
function mask(key) {
  return key.length <= 8 ? '••••' : `${key.slice(0, 4)}…${key.slice(-2)}`;
}

async function main() {
  const { alpaca, tradingMode } = loadAlpacaEnv();
  const client = createClient(alpaca);
  const symbol = process.env.GRID_SYMBOL ?? 'BTC/USD';

  console.log(`\n▲ Alpaca credential check  ·  mode=${tradingMode}`);
  console.log(`  endpoint  ${alpaca.baseUrl}`);
  console.log(`  key       ${mask(alpaca.keyId)}\n`);

  // 1 — authenticate
  const account = await client.getAccount();
  console.log(ok(`authenticated as account ${account.account_number}`));
  console.log(`      status         ${account.status}`);
  console.log(`      equity         ${usd(account.equity)}`);
  console.log(`      buying power   ${usd(account.buying_power)}`);
  console.log(`      cash           ${usd(account.cash)}`);

  if (account.trading_blocked) console.log(bad('trading is BLOCKED on this account'));
  if (account.account_blocked) console.log(bad('account is BLOCKED'));
  if (account.trade_suspended_by_user) console.log(warn('trading suspended by user'));
  if (!account.trading_blocked && !account.account_blocked) {
    console.log(ok('trading is enabled'));
  }

  // 2 — confirm the paper/live endpoint matches the key type.
  // Alpaca paper keys start with PK, live keys with AK.
  const looksPaper = alpaca.keyId.startsWith('PK');
  if (tradingMode === 'paper' && !looksPaper) {
    console.log(warn(`key does not start with "PK" but mode is paper — is this a live key?`));
  } else if (tradingMode === 'live' && looksPaper) {
    console.log(warn(`key starts with "PK" (paper) but TRADING_MODE=live`));
  } else {
    console.log(ok(`key type matches ${tradingMode} mode`));
  }

  // 3 — can we actually trade the configured pair?
  try {
    const asset = await client.getAsset(symbol);
    if (asset.tradable) console.log(ok(`${symbol} is tradable (${asset.class})`));
    else console.log(bad(`${symbol} exists but is NOT tradable on this account`));
    if (asset.min_order_size) {
      console.log(`      min order size ${asset.min_order_size}`);
    }
  } catch (err) {
    console.log(bad(`could not look up ${symbol}: ${err.message}`));
  }

  // 4 — market data entitlement is a separate permission from trading.
  try {
    const quotes = await client.getLatestCryptoQuote(symbol);
    const q = quotes?.quotes?.[symbol];
    if (q) {
      console.log(ok(`market data OK — ${symbol} bid ${usd(q.bp)} / ask ${usd(q.ap)}`));
    } else {
      console.log(warn(`market data returned no quote for ${symbol}`));
    }
  } catch (err) {
    console.log(bad(`market data unavailable: ${err.message}`));
  }

  // 5 — existing state the grid would have to reconcile against.
  const [positions, orders] = await Promise.all([
    client.getPositions(),
    client.getOrders({ status: 'open' }),
  ]);
  console.log(ok(`${positions.length} open position(s), ${orders.length} open order(s)`));
  for (const p of positions.slice(0, 5)) {
    console.log(`      ${p.symbol.padEnd(10)} ${p.qty} @ ${usd(p.avg_entry_price)}  P/L ${usd(p.unrealized_pl)}`);
  }
  if (orders.length) {
    console.log(warn('open orders exist — the grid will try to reconcile these'));
  }

  console.log('\n  Credentials verified. No orders were placed.\n');
}

main().catch((err) => {
  if (err instanceof EnvError) {
    console.error(`\n✖ ${err.name}: ${err.message}\n`);
    process.exit(1);
  }
  if (err instanceof AlpacaError) {
    console.error(`\n✖ Alpaca rejected the request (${err.status ?? 'no response'}) on ${err.endpoint}`);
    console.error(`  ${err.message}`);
    if (err.status === 401 || err.status === 403) {
      console.error('\n  Check that ALPACA_KEY_ID and ALPACA_SECRET_KEY are correct and');
      console.error('  that they match the endpoint (paper keys only work on paper-api).\n');
    } else {
      console.error('');
    }
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
