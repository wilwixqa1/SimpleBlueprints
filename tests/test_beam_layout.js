// ============================================================
// S101 -- JS BEAM LAYOUT GUARD
//
// Locks the JS port of backend/drawing/beam_layout.py (computeBeamLayout,
// _legacyPosts, _postsForSegment). Before the port the frontend computed a
// flat legacy post row from width alone, so a notched deck showed 3 posts on
// screen where the PDF correctly showed 6, and a post could sit stranded over
// the cutout void.
//
// The CRITICAL invariant here is the flat-deck one: with no front cutout the
// layout must reproduce _legacyPosts EXACTLY. Plain decks are the overwhelming
// majority of the product's output and their permit set must not move.
//
// Python-side equivalence is asserted separately, and more strongly, by
// tests/test_frontend_parity.py, which runs both engines on the same configs
// and compares materials line-for-line.
//
// Run: node tests/test_beam_layout.js
// ============================================================
global.window = global;
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(ROOT, 'backend/static/js/stairGeometry.js'), 'utf8'));

// NOTE: `global.window = global` means stairGeometry.js's own top-level
// function declarations are already globals here, so binding them to consts of
// the SAME name is a redeclaration error. Use distinct local names.
const blCompute = window.computeBeamLayout;
const blLegacy = window._legacyPosts;
const blSegment = window._postsForSegment;

let failures = 0;
function check(cond, msg) {
  if (!cond) { console.log('  [FAIL] ' + msg); failures++; }
}
function eqArr(a, b) {
  return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
}

console.log('\nS101 JS beam layout');

// ---- 1. Flat deck reproduces the legacy row byte-for-byte ----
console.log('1. Flat deck == legacy positions (the no-regression invariant)');
[[20, 14, 3], [40, 12, 5], [10, 10, 2], [32, 16, 4], [13, 12, 3]].forEach(function (cfg) {
  const W = cfg[0], D = cfg[1], nP = cfg[2];
  const legacy = blLegacy(W, nP);
  const bl = blCompute(W, D, [], nP, 2.0, 1.5, 8.0);
  const got = bl.postXY.map(function (xy) { return xy[0]; });
  check(eqArr(got, legacy), 'flat ' + W + 'x' + D + ' nP=' + nP +
        ' expected ' + JSON.stringify(legacy) + ' got ' + JSON.stringify(got));
  check(bl.stepped === false, 'flat ' + W + 'x' + D + ' must not be stepped');
  check(bl.overLimit === false, 'flat ' + W + 'x' + D + ' must not be over limit');
  check(Math.abs(bl.segments[0].beamY - (D - 1.5)) < 1e-9,
        'flat ' + W + 'x' + D + ' beamY must be depth-1.5');
});

// A single post centers, matching the Python num_posts == 1 branch.
check(eqArr(blLegacy(20, 1), [10]), 'single post centers at width/2');

// ---- 2. Front cutout forces a real change ----
console.log('2. Front-reaching cutout changes the layout');
const cut = [{ rect: { x: 8, y: 10, w: 4, d: 4 } }];  // reaches front on D=14
const flat14 = blCompute(20, 14, [], 3, 2.0, 1.5, 8.0);
const notched = blCompute(20, 14, cut, 3, 2.0, 1.5, 8.0);
const flatX = flat14.postXY.map(function (p) { return p[0]; });
const notchX = notched.postXY.map(function (p) { return p[0]; });
check(!eqArr(flatX, notchX), 'a front cutout must change post positions');
check(notchX.length >= flatX.length,
      'notched deck should not have FEWER posts than flat (got ' +
      notchX.length + ' vs ' + flatX.length + ')');

// ---- 3. No post is stranded over the cutout void ----
// A post inside the cutout footprint must sit BEHIND it (beamY <= cutout y),
// never out at the original front edge where there is no deck above it.
console.log('3. No post stranded over the void');
notched.postXY.forEach(function (xy) {
  const x = xy[0], y = xy[1];
  const insideX = x > 8 - 1e-9 && x < 12 + 1e-9;
  if (insideX) {
    check(y <= 10 + 1e-9,
          'post at x=' + x + ' is inside the cutout span but sits at y=' + y +
          ' (front edge) -- stranded over the void');
  }
});

// ---- 4. A non-front-reaching cutout leaves the front edge alone ----
console.log('4. Interior cutout does not move the front beam');
const interior = [{ rect: { x: 8, y: 4, w: 4, d: 2 } }];  // y+d = 6, well short of 14
const interiorBL = blCompute(20, 14, interior, 3, 2.0, 1.5, 8.0);
check(eqArr(interiorBL.postXY.map(function (p) { return p[0]; }), blLegacy(20, 3)),
      'a cutout that does not reach the front edge must leave posts unchanged');
check(interiorBL.stepped === false, 'interior cutout must not step the beam');

// ---- 5. _postsForSegment: the S90 short-segment guard ----
// With the 2ft end inset the end posts sit (segW-4) apart, so a ~4ft segment
// would stack two posts at nearly the same x. Below MIN_POST_SEP it must
// collapse to ONE centered post.
console.log('5. Short-segment guard (S90 coincident-post bug)');
check(blSegment(0, 4, 8).length === 1, '4ft segment must yield 1 post');
check(Math.abs(blSegment(0, 4, 8)[0] - 2) < 1e-9, '4ft segment post centers at 2');
check(blSegment(0, 5, 8).length === 1, '5ft segment must yield 1 post');
check(blSegment(0, 6, 8).length === 2, '6ft segment must yield 2 distinct posts');
check(eqArr(blSegment(0, 6, 8), [2, 4]), '6ft segment posts at [2,4] (unchanged)');
blSegment(0, 20, 8).forEach(function (x, i, arr) {
  if (i > 0) check(arr[i] - arr[i - 1] > 1e-9, 'posts must be strictly increasing');
});

// ---- 6. max_beam_span is respected ----
console.log('6. Post spacing never exceeds max_beam_span');
[4, 6, 8, 10].forEach(function (maxSpan) {
  const posts = blSegment(0, 40, maxSpan);
  for (let i = 1; i < posts.length; i++) {
    check(posts[i] - posts[i - 1] <= maxSpan + 1e-6,
          'span ' + (posts[i] - posts[i - 1]).toFixed(2) +
          ' exceeds max ' + maxSpan);
  }
});

// ---- 7. Empty / degenerate input is safe ----
console.log('7. Degenerate input');
check(blCompute(20, 14, null, 3, 2.0, 1.5, 8.0).postXY.length === 3,
      'null cutRects must behave as flat');
check(blCompute(20, 14, undefined, 3, 2.0, 1.5, 8.0).stepped === false,
      'undefined cutRects must behave as flat');
const defaulted = blCompute(20, 14, [], 3, 2.0);
check(eqArr(defaulted.postXY.map(function (p) { return p[0]; }), blLegacy(20, 3)),
      'omitted setback/maxBeamSpan must fall back to the Python defaults');

console.log('');
if (failures === 0) {
  console.log('JS BEAM LAYOUT: all checks passed');
  process.exit(0);
} else {
  console.log('JS BEAM LAYOUT: ' + failures + ' check(s) FAILED');
  process.exit(1);
}
