'use strict';

// RED phase: These tests define the expected behavior of VirtualPortfolio.
// Run BEFORE implementation exists — they must fail.
const { VirtualPortfolio } = require('./virtualPortfolio.service');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL: ' + message);
    failed++;
  } else {
    console.log('PASS: ' + message);
    passed++;
  }
}

function assertThrows(fn, expectedSubstring, label) {
  try {
    fn();
    console.error('FAIL: ' + label + ' — expected an error but none was thrown');
    failed++;
  } catch (e) {
    if (e.message.includes(expectedSubstring)) {
      console.log('PASS: ' + label);
      passed++;
    } else {
      console.error('FAIL: ' + label + ' — wrong error: ' + e.message);
      failed++;
    }
  }
}

// Test 8: getPositions() returns [] for fresh portfolio
const fresh = new VirtualPortfolio(100000);
assert(Array.isArray(fresh.getPositions()) && fresh.getPositions().length === 0, 'Test 8: fresh portfolio has no positions');

// Test 1: buy fills at price * (1 + slippage) and deducts capital
// Use 500000 capital so 10 * 22022 = 220220 fits
const p = new VirtualPortfolio(500000);
const t1 = p.buy('NIFTY 50', 10, 22000, 0.001);
assert(t1.fillPrice === 22022.00, 'Test 1a: buy fillPrice = price * 1.001 = 22022.00, got: ' + t1.fillPrice);
assert(p.availableCapital < 500000, 'Test 1b: capital deducted after buy');
assert(p.availableCapital === 500000 - (22022 * 10), 'Test 1c: exact capital deduction, expected: ' + (500000 - 22022 * 10) + ', got: ' + p.availableCapital);

// Test 3: getPnL returns positive unrealized when price rises
const pnl = p.getPnL({ 'NIFTY 50': 22100 });
assert(pnl.unrealized > 0, 'Test 3: unrealized > 0 when LTP > avgCost, got: ' + pnl.unrealized);
assert(typeof pnl.realized === 'number', 'Test 3b: realized is a number');
assert(typeof pnl.total === 'number', 'Test 3c: total is a number');
assert(pnl.capital === 500000, 'Test 3d: capital = initialCapital');

// Test 2 & 4: sell reduces/clears qty; realizes P&L
const t2 = p.sell('NIFTY 50', 10, 22100, 0.001);
assert(t2.realizedPnl !== undefined, 'Test 4: realizedPnl defined on sell trade');
assert(p.getPositions().length === 0, 'Test 2: position cleared after full sell');

// Test 6: getTrades length grows per trade
assert(p.getTrades().length === 2, 'Test 6: getTrades().length === 2 after 1 buy + 1 sell');

// Test 5: Insufficient capital
assertThrows(
  () => p.buy('NIFTY 50', 100000, 22000, 0),
  'Insufficient capital',
  'Test 5: buy() throws Insufficient capital'
);

// Test 7: Insufficient position (oversell)
assertThrows(
  () => p.sell('NIFTY 50', 1, 22000, 0),
  'Insufficient position',
  'Test 7: sell() throws Insufficient position on oversell'
);

// Partial sell test
const p2 = new VirtualPortfolio(200000);
p2.buy('BANK NIFTY', 4, 47000, 0.001);
p2.sell('BANK NIFTY', 2, 47200, 0.001);
const positions2 = p2.getPositions();
assert(positions2.length === 1, 'Partial sell: position still exists');
assert(positions2[0].qty === 2, 'Partial sell: qty reduced to 2, got: ' + positions2[0].qty);

console.log('\n--- Results: ' + passed + ' passed, ' + failed + ' failed ---');
if (failed > 0) process.exit(1);
