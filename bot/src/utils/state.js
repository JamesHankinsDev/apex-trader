/* Apex Trader — tiny JSON state store.

   Holds things that must survive a restart: chiefly the grid anchor, so a
   `session` anchor isn't silently re-centred every time the process bounces.
   bot/state/ is gitignored — it is runtime data, not configuration. */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(__dirname, '../../state');

function pathFor(name) {
  return join(STATE_DIR, `${name}.json`);
}

/**
 * Read a state file. Returns `fallback` if it's missing or unreadable —
 * corrupt state should degrade to "fresh start", never crash the bot.
 */
export function readState(name, fallback = null) {
  const file = pathFor(name);
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.warn(`[state] ignoring unreadable ${name}.json: ${err.message}`);
    return fallback;
  }
}

/** Write a state file, creating bot/state/ on first use. */
export function writeState(name, value) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(pathFor(name), `${JSON.stringify(value, null, 2)}\n`);
  return value;
}

/** Anchor helpers — the one piece of state that exists so far. */
export function readAnchor(symbol) {
  const all = readState('anchor', {});
  const entry = all?.[symbol];
  return Number.isFinite(entry?.price) ? entry.price : undefined;
}

export function writeAnchor(symbol, price, meta = {}) {
  const all = readState('anchor', {}) ?? {};
  all[symbol] = { price, ...meta };
  return writeState('anchor', all);
}

export { STATE_DIR };
