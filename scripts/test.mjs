/**
 * Lightweight logic tests — no framework needed.
 * Run: node scripts/test.mjs
 */

let failed = 0;
function assert(desc, condition) {
  if (condition) {
    console.log(`  ✓ ${desc}`);
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

// ── countdown calc (mirrors useCountdown in requests/[id]/page.tsx) ──────────
function calc(iso) {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return null;
  const diff = ts - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return { d, h, m };
}

console.log('\ncountdown calc:');
const future = new Date(Date.now() + 5 * 86400000 + 3 * 3600000 + 42 * 60000).toISOString();
const r = calc(future);
assert('empty string → null',        calc('') === null);
assert('past date → null',           calc(new Date(Date.now() - 1000).toISOString()) === null);
assert('NaN input → null',           calc('not-a-date') === null);
assert('future: returns object',     r !== null);
assert('future: d correct (5)',      r?.d === 5);
assert('future: h correct (3)',      r?.h === 3);
assert('future: m within range',     r?.m >= 41 && r?.m <= 43);
assert('future: no NaN fields',      r && !isNaN(r.d) && !isNaN(r.h) && !isNaN(r.m));

// ── fmtUSD ───────────────────────────────────────────────────────────────────
function fmtUSD(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

console.log('\nfmtUSD:');
assert('0 cents → $0.00',       fmtUSD(0) === '$0.00');
assert('100 cents → $1.00',     fmtUSD(100) === '$1.00');
assert('12349 cents → $123.49', fmtUSD(12349) === '$123.49');

// ── balance subtract clamp ───────────────────────────────────────────────────
function clampedSubtract(balance, amount) {
  return Math.max(0, balance - amount);
}

console.log('\nbalance subtract:');
assert('normal subtract',          clampedSubtract(5000, 1000) === 4000);
assert('exact zero',               clampedSubtract(1000, 1000) === 0);
assert('overdraft clamps to 0',    clampedSubtract(500, 9999) === 0);

// ─────────────────────────────────────────────────────────────────────────────
if (failed > 0) {
  console.error(`\n${failed} test(s) failed.\n`);
  process.exit(1);
} else {
  console.log(`\nAll tests passed.\n`);
}
