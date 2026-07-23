// ============================================================
// S100 -- STAIR DECK-PLANE FOOTPRINT GUARD (P0-3D)
//
// Locks the fix for "stairs/railings clip through the deck, no hole" in the
// 3D view. Root cause was that the deck cut was derived from runs[0] only.
// For a STRAIGHT stair runs[0] is the whole stair, which is why straight
// stairs always looked right; every other template has landings and later
// runs that were never cut for.
//
// Run: node tests/test_stair_footprint.js
// ============================================================
global.window = global;
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(ROOT, 'backend/static/js/stairGeometry.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'backend/static/js/zoneUtils.js'), 'utf8'));

const stairFootprintRects = window.stairFootprintRects;
const clipRectsTo = window.clipRectsTo;
const unionSpan = window.unionSpan;

let failures = 0;
function check(cond, msg) {
  if (!cond) { console.log('  [FAIL] ' + msg); failures++; }
}
const area = rs => rs.reduce((s, b) => s + (b.xMax - b.xMin) * (b.zMax - b.zMin), 0);

const TEMPLATES = ['straight', 'wideLanding', 'lLeft', 'lRight', 'switchback', 'wrapAround'];
const DECKS = [[20, 14], [16, 12], [24, 16], [12, 10], [30, 20]];
const WIDTHS = [3, 4, 5];
const RISES = [2, 3, 5, 8, 10];

function geo(t, sw, h) {
  return computeStairGeometry({ template: t, height: h, stairWidth: sw, numStringers: 3, stairGap: 0.5 });
}

// ---- 1. STRAIGHT INVARIANT -------------------------------------------------
// The union footprint must equal the runs[0] footprint exactly for straight
// stairs, at every anchor and rotation. If this fails, the fix has changed
// behavior for the most common configuration and must not ship.
console.log('1. Straight-stair invariant (union === runs[0])');
let straightChecked = 0;
DECKS.forEach(([W, D]) => WIDTHS.forEach(sw => RISES.forEach(h => {
  [[W / 2, D, 0], [W, D / 2, 90], [0, D / 2, 270], [W / 2, D - 4, 0], [W / 2, D - 2, 0]]
    .forEach(([ax, az, ang]) => {
      const sg = geo('straight', sw, h);
      if (!sg) return;
      const all = stairFootprintRects(sg, ax, az, ang);
      const union = clipRectsTo(all, 0, W, 0, D);
      const run0 = clipRectsTo([all[0]], 0, W, 0, D);
      straightChecked++;
      check(JSON.stringify(union) === JSON.stringify(run0),
        `straight ${W}x${D} sw${sw} h${h} ang${ang}: union != runs[0]`);
    });
})));
console.log(`   ${straightChecked} configs checked`);

// ---- 2. EDGE STAIRS THAT SHOULD NOT CUT ------------------------------------
// straight / wideLanding / lLeft / lRight / switchback anchored ON the front
// edge extend away from the deck; they must produce NO cut.
console.log('2. Edge-anchored stairs that must not cut the deck');
['straight', 'wideLanding', 'lLeft', 'lRight', 'switchback'].forEach(t => {
  DECKS.forEach(([W, D]) => WIDTHS.forEach(sw => RISES.forEach(h => {
    const sg = geo(t, sw, h);
    if (!sg) return;
    const fp = clipRectsTo(stairFootprintRects(sg, W / 2, D, 0), 0, W, 0, D);
    check(area(fp) < 0.5, `${t} edge ${W}x${D} sw${sw} h${h}: unexpected cut ${area(fp).toFixed(1)} sf`);
  })));
});

// ---- 3. THE BUG: FOLDED / INTERIOR STAIRS MUST CUT -------------------------
// These are the configs that previously cut nothing and clipped through solid
// deck. Each must now produce a real cut.
console.log('3. Configs that previously clipped must now cut');
// wrapAround folds back over the deck at ANY anchor, including the edge.
DECKS.forEach(([W, D]) => WIDTHS.forEach(sw => RISES.forEach(h => {
  const sg = geo('wrapAround', sw, h);
  if (!sg) return;
  const fp = clipRectsTo(stairFootprintRects(sg, W / 2, D, 0), 0, W, 0, D);
  check(area(fp) > 5, `wrapAround edge ${W}x${D} sw${sw} h${h}: cut only ${area(fp).toFixed(1)} sf`);
})));
// Interior-anchored non-straight templates all overlap the deck.
['wideLanding', 'lLeft', 'lRight', 'switchback', 'wrapAround'].forEach(t => {
  DECKS.forEach(([W, D]) => {
    if (D < 10) return;
    WIDTHS.forEach(sw => {
      const sg = geo(t, sw, 5);
      if (!sg) return;
      const all = stairFootprintRects(sg, W / 2, D - 4, 0);
      const fp = clipRectsTo(all, 0, W, 0, D);
      const r0 = clipRectsTo([all[0]], 0, W, 0, D);
      check(area(fp) > area(r0) + 0.5,
        `${t} interior ${W}x${D} sw${sw}: footprint ${area(fp).toFixed(1)} not > runs[0] ${area(r0).toFixed(1)}`);
    });
  });
});

// ---- 4. UNION IS TIGHTER THAN BBOX (no S81e over-cut regression) -----------
// S81e reverted a full-bbox cut because the bbox spans dead air between
// folded runs and punched a spurious hole. Union must stay strictly tighter.
console.log('4. Union stays tighter than bbox (S81e regression guard)');
['switchback', 'wrapAround'].forEach(t => {
  DECKS.forEach(([W, D]) => WIDTHS.forEach(sw => RISES.forEach(h => {
    const sg = geo(t, sw, h);
    if (!sg) return;
    const ax = W / 2, az = D;
    const fp = clipRectsTo(stairFootprintRects(sg, ax, az, 0), 0, W, 0, D);
    const bb = sg.bbox;
    const bbClip = clipRectsTo(
      [{ xMin: ax + bb.minX, xMax: ax + bb.maxX, zMin: az + bb.minY, zMax: az + bb.maxY }], 0, W, 0, D);
    check(area(fp) <= area(bbClip) + 1e-6,
      `${t} ${W}x${D} sw${sw} h${h}: union ${area(fp).toFixed(1)} exceeds bbox ${area(bbClip).toFixed(1)}`);
  })));
});

// ---- 5. ROTATION CONSISTENCY ----------------------------------------------
// A stair rotated onto the left/right edge must cut the same AREA as the
// equivalent front-edge stair (geometry is rigid under rotation).
console.log('5. Rotation preserves footprint area');
TEMPLATES.forEach(t => {
  WIDTHS.forEach(sw => RISES.forEach(h => {
    const sg = geo(t, sw, h);
    if (!sg) return;
    const big = 400; // unclipped plane so rotation can't clip differently
    const a0 = area(clipRectsTo(stairFootprintRects(sg, 200, 200, 0), 0, big, 0, big));
    [90, 180, 270].forEach(ang => {
      const a = area(clipRectsTo(stairFootprintRects(sg, 200, 200, ang), 0, big, 0, big));
      check(Math.abs(a - a0) < 0.01, `${t} sw${sw} h${h} ang${ang}: area ${a.toFixed(2)} != ${a0.toFixed(2)}`);
    });
  }));
});

console.log('');
if (failures) { console.log(`STAIR FOOTPRINT: ${failures} FAILURES`); process.exit(1); }
console.log('STAIR FOOTPRINT: all checks passed');
