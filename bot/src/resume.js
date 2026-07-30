/* Clear a latched halt so the bot may trade again.

   Deliberately a separate, explicit command: the whole point of latching is
   that a supervisor restart cannot undo a halt on its own. */

import { readHalt, clearHalt } from './utils/state.js';

const latched = readHalt();

if (!latched) {
  console.log('\n  No halt latched — the bot is free to trade.\n');
  process.exit(0);
}

console.log(`\n  Latched halt:`);
console.log(`    reason  ${latched.reason}`);
console.log(`    at      ${latched.at}`);
if (latched.price) console.log(`    price   $${Number(latched.price).toFixed(2)}`);
if (latched.equity) console.log(`    equity  $${Number(latched.equity).toFixed(2)}`);

clearHalt();
console.log('\n  ✓ Cleared. Restart the bot to resume trading.\n');
