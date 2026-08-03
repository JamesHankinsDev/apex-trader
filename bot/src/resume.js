/* Clear a latched halt so the bot may trade again.

   Deliberately a separate, explicit command: the whole point of latching is
   that a supervisor restart cannot undo a halt on its own. */

import { readHalt, clearHalt, clearPeakEquity } from './utils/state.js';

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
if (latched.drawdown !== undefined) {
  console.log(`    drawdown ${(Number(latched.drawdown) * 100).toFixed(2)}% from $${Number(latched.peak).toFixed(2)}`);
}

clearHalt();

// A drawdown halt is measured against the high-water mark, so clearing the
// latch alone would re-halt on the very next tick — equity is still the same
// distance below the same peak. Accepting the halt IS accepting the current
// balance as the new baseline, so the peak is rebased with it. Other halt
// reasons leave it alone: that drawdown is real and the stop stays armed.
if (latched.reason === 'drawdown') {
  clearPeakEquity();
  console.log('\n  Peak equity reset — drawdown will be measured from here on.');
}

console.log('\n  ✓ Cleared. Restart the bot to resume trading.\n');
