/* ============================================================================
 * tests/geometry/lotGeometry.test.js -- S84
 * Parameterized invariant tests for the site plan geometry (lotGeometry.js).
 *
 * Run: node tests/geometry/lotGeometry.test.js
 * Exit code 0 = all pass. Nonzero = failures (CI fails the push).
 *
 * WHY THIS EXISTS: the site plan subsystem was rebuilt in S70, S72, S73,
 * S78 and S79, each time "fixing one address while breaking another",
 * because pure math was being verified by clicking addresses in a browser.
 * These tests sweep every lot orientation synthetically so a geometry
 * regression is caught in seconds, not in session 5 of a rewrite.
 * ========================================================================== */
"use strict";
var G = require("../../backend/static/js/lotGeometry.js");

var passed = 0, failed = 0, warned = 0;
var errors = [], warnings = [];

function ok(name, cond, detail) {
  if (cond) { passed++; }
  else { failed++; errors.push("FAIL: " + name + (detail ? " -- " + detail : "")); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 0.01 : tol); }
function warn(name, detail) { warned++; warnings.push("WARN: " + name + " -- " + detail); }

/* ------------------------------------------------------- synthetic lots */
/* All defined with the STREET EDGE FIRST (index 0), counterclockwise-ish,
 * in "un-rotated geographic" feet, street initially at bottom.            */
var SHAPES = {
  rectangle:  [[0, 0], [80, 0], [80, 120], [0, 120]],
  trapezoid:  [[0, 0], [90, 0], [70, 130], [15, 130]],           // tapers toward rear
  tapered:    [[0, 0], [100, 0], [60, 140], [30, 140]],          // strong taper
  flag:       [[30, 0], [50, 0], [50, 60], [90, 60], [90, 150], [0, 150], [0, 60], [30, 60]], // flag lot, narrow pole to street
  concaveL:   [[0, 0], [100, 0], [100, 70], [55, 70], [55, 130], [0, 130]]  // L-shaped lot
};

function rotatePts(verts, deg, cx, cy) {
  var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return verts.map(function (v) {
    var dx = v[0] - cx, dy = v[1] - cy;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  });
}

/* ------------------------------------------------ 1. rotation invariants */
Object.keys(SHAPES).forEach(function (shapeName) {
  var base = SHAPES[shapeName];
  var baseLens = G.edgeLengths(base);
  var c = G.polygonCentroid(base);

  for (var deg = 0; deg < 360; deg += 5) {
    var tag = shapeName + "@" + deg;
    // Simulate Realie returning this lot at an arbitrary bearing:
    var geo = rotatePts(base, deg, c[0], c[1]);
    // street edge is still edge 0 by construction; use a synthetic address
    // point just outside the street edge midpoint to drive the ray-cast
    var mid = [(geo[0][0] + geo[1][0]) / 2, (geo[0][1] + geo[1][1]) / 2];
    var gc = G.polygonCentroid(geo);
    var addr = [gc[0] + (mid[0] - gc[0]) * 0.6, gc[1] + (mid[1] - gc[1]) * 0.6];

    var det = G.detectStreetEdge(geo, addr);

    var rot = G.computeStreetRotation(geo, det.streetIdx);
    var dv = rot.verts, T = rot.T;

    // I1: origin normalization -- all coords >= -epsilon
    var minX = Infinity, minY = Infinity, i;
    for (i = 0; i < dv.length; i++) {
      if (dv[i][0] < minX) minX = dv[i][0];
      if (dv[i][1] < minY) minY = dv[i][1];
    }
    if (T.rotated) {
      ok(tag + " I1 origin-normalized", minX > -1e-6 && minY > -1e-6,
        "min=(" + minX.toFixed(3) + "," + minY.toFixed(3) + ")");
    }

    // I2: edge lengths preserved under rotation
    var dLens = G.edgeLengths(dv);
    var lensOK = true;
    for (i = 0; i < baseLens.length; i++) {
      if (!approx(dLens[i], baseLens[i], 0.01)) { lensOK = false; break; }
    }
    ok(tag + " I2 edge-lengths preserved", lensOK);

    // I3: the DETECTED street edge ends up horizontal at the bottom
    var sIdx = det.streetIdx;
    var a = dv[sIdx], b = dv[(sIdx + 1) % dv.length];
    var edgeHoriz = approx(a[1], b[1], 0.5);
    var edgeMidY = (a[1] + b[1]) / 2;
    var cDraw = G.polygonCentroid(dv);
    ok(tag + " I3a street edge horizontal", edgeHoriz,
      "dy=" + Math.abs(a[1] - b[1]).toFixed(2) + " rotDeg=" + T.rotDeg.toFixed(1));
    ok(tag + " I3b street edge below centroid", edgeMidY <= cDraw[1] + 0.5,
      "edgeMidY=" + edgeMidY.toFixed(1) + " centY=" + cDraw[1].toFixed(1));

    // I4: round-trip -- invertTransform recovers the original geo verts
    var rtOK = true;
    for (i = 0; i < dv.length; i++) {
      var back = G.invertTransform(T, dv[i][0], dv[i][1]);
      if (!approx(back[0], geo[i][0], 0.01) || !approx(back[1], geo[i][1], 0.01)) { rtOK = false; break; }
    }
    ok(tag + " I4 round-trip", rtOK);

    // I5: applyTransform on original verts reproduces drawing verts
    var fwOK = true;
    for (i = 0; i < geo.length; i++) {
      var fw = G.applyTransform(T, geo[i][0], geo[i][1]);
      if (!approx(fw[0], dv[i][0], 0.01) || !approx(fw[1], dv[i][1], 0.01)) { fwOK = false; break; }
    }
    ok(tag + " I5 forward-transform", fwOK);
  }
});

/* --------------------------------------- 2. house placement invariants */
Object.keys(SHAPES).forEach(function (shapeName) {
  var base = SHAPES[shapeName];
  var c = G.polygonCentroid(base);
  var hw = 40, hd = 28;

  for (var deg = 0; deg < 360; deg += 15) {
    var tag = shapeName + "@" + deg + " house";
    var geo = rotatePts(base, deg, c[0], c[1]);
    var mid = [(geo[0][0] + geo[1][0]) / 2, (geo[0][1] + geo[1][1]) / 2];
    var gc = G.polygonCentroid(geo);
    var addr = [gc[0] + (mid[0] - gc[0]) * 0.6, gc[1] + (mid[1] - gc[1]) * 0.6];

    var det = G.detectStreetEdge(geo, addr);
    var rot = G.computeStreetRotation(geo, det.streetIdx);
    var dv = rot.verts;
    var bb = G.boundingBox(dv);

    // building centroid: at the polygon centroid in drawing space
    var cd = G.polygonCentroid(dv);
    var placed = G.positionHouse({
      verts: dv, lotW: bb.maxX, lotD: bb.maxY,
      hw: hw, hd: hd, centroid: [cd[0], cd[1]], addrPoint: null
    });

    // H1: intended house left edge respects the tight span (S85 contract:
    // placed.offset is renderer-space, so bounds are checked on houseLeftX)
    var hcyPre = placed.dist + hd / 2;
    var te = G.tightEdges(dv, placed.dist + 2, hcyPre, placed.dist + hd - 2);
    ok(tag + " H1 houseLeftX >= tight left+2", placed.houseLeftX >= te.left + 2 - 0.01,
      "houseLeftX=" + placed.houseLeftX.toFixed(1) + " teLeft=" + te.left.toFixed(1));
    ok(tag + " H2 dist>=5", placed.dist >= 5, "dist=" + placed.dist);
    ok(tag + " H3 fits in bbox depth", placed.dist + hd <= bb.maxY + 0.5,
      "dist=" + placed.dist + " lotD=" + bb.maxY.toFixed(0));

    // H4: house center should be inside the polygon (soft for extreme shapes)
    var hx = G.rendererHouseX(dv, placed.dist, hd, placed.offset);
    var hcx = hx + hw / 2, hcy = placed.dist + hd / 2;
    if (!G.pointInPolygon(hcx, hcy, dv)) {
      warn(tag + " H4 house center outside polygon",
        "method=" + placed.method + " center=(" + hcx.toFixed(1) + "," + hcy.toFixed(1) + ")");
    } else { passed++; }

    // H5: CONSISTENCY -- intended position vs renderer position.
    // S85 contract: stored offset is renderer-space, so the renderer must
    // reproduce houseLeftX exactly (0.1 ft rounding slack). HARD check now,
    // not a warning: this is the bug the S85 fix eliminates.
    var divergence = Math.abs(placed.houseLeftX - hx);
    ok(tag + " H5 position==render", divergence <= 0.11,
      divergence.toFixed(2) + "ft (intendedX=" + placed.houseLeftX.toFixed(1) + " renderX=" + hx.toFixed(1) + ")");
  }
});

/* --------------------------------------------- 3. known-answer spot tests */
(function () {
  // Rectangle 80x120, street at bottom, no rotation needed
  var r = SHAPES.rectangle;
  var det = G.detectStreetEdge(r, [40, -10]);
  ok("KA1 rect street edge = 0", det.streetIdx === 0, "got " + det.streetIdx);
  ok("KA1b rect rear edge = 2", det.rearIdx === 2, "got " + det.rearIdx);

  var rot = G.computeStreetRotation(r, 0);
  ok("KA2 rect no rotation", rot.T.rotated === false, "rotDeg=" + rot.T.rotDeg.toFixed(1));

  ok("KA3 leftEdgeAtY rect = 0", approx(G.leftEdgeAtY(r, 60), 0));
  ok("KA4 pointInPolygon inside", G.pointInPolygon(40, 60, r) === true);
  ok("KA5 pointInPolygon outside", G.pointInPolygon(-5, 60, r) === false);

  // Rectangle rotated 90 degrees must come back street-at-bottom
  var c = G.polygonCentroid(r);
  var r90 = rotatePts(r, 90, c[0], c[1]);
  var det90 = G.detectStreetEdge(r90, (function () {
    var mid = [(r90[0][0] + r90[1][0]) / 2, (r90[0][1] + r90[1][1]) / 2];
    var gc = G.polygonCentroid(r90);
    return [gc[0] + (mid[0] - gc[0]) * 0.6, gc[1] + (mid[1] - gc[1]) * 0.6];
  })());
  var rot90 = G.computeStreetRotation(r90, det90.streetIdx);
  ok("KA6 rect@90 rotation applied", rot90.T.rotated === true);
  var bb90 = G.boundingBox(rot90.verts);
  ok("KA7 rect@90 bbox restored 80x120",
    approx(bb90.w, 80, 0.1) && approx(bb90.d, 120, 0.1),
    "bbox=" + bb90.w.toFixed(1) + "x" + bb90.d.toFixed(1));

  // tightEdges on the trapezoid should be narrower near the rear
  var teFront = G.tightEdges(SHAPES.trapezoid, 10, 15, 20);
  var teRear = G.tightEdges(SHAPES.trapezoid, 110, 115, 120);
  ok("KA8 trapezoid tighter at rear", teRear.span < teFront.span,
    "front=" + teFront.span.toFixed(1) + " rear=" + teRear.span.toFixed(1));
})();

/* ------------------------------------------------------------- reporting */
console.log("");
// ---- S100: explicit clamp-vs-center behavior (positionHouse.placeAt) ----
(function () {
  var lot = [[0, 0], [60, 0], [60, 120], [0, 120]]; // clean 60x120 rectangle
  function place(hw, cx) {
    return G.positionHouse({ verts: lot, lotW: 60, lotD: 120, hw: hw, hd: 25,
      centroid: [cx, 50], addrPoint: null });
  }
  // availSpan=60, house 30 -> maxOffset = 60-30-2 = 28
  // 1. Fits at measured X: centroid 20 -> off = 20-15-0 = 5, plain centroid
  var p1 = place(30, 20);
  ok("S100 C1 fits keeps measured X", p1.method === "centroid" && Math.abs(p1.houseLeftX - 5) <= 0.5,
    "method=" + p1.method + " leftX=" + p1.houseLeftX);
  // 2. Small overshoot: centroid 50 -> off = 35 > 28, over by 7 -> clamp to 28
  var p2 = place(30, 50);
  ok("S100 C2 small overshoot clamps", p2.method === "centroid+clampedX" && Math.abs(p2.houseLeftX - 28) <= 0.5,
    "method=" + p2.method + " leftX=" + p2.houseLeftX);
  // 3. Huge overshoot with centroid still inside the lot: house 40 wide,
  // centroid 55 -> off = 35, maxOffset = 18, over by 17 (>15) -> center (10)
  var p3 = place(40, 55);
  ok("S100 C3 huge overshoot centers", p3.method === "centroid+centeredX" && Math.abs(p3.houseLeftX - 10) <= 0.5,
    "method=" + p3.method + " leftX=" + p3.houseLeftX);
  // 4. House fills span (57 on 60): no meaningful X -> center
  var p4 = place(57, 50);
  ok("S100 C4 span-filling house centers", p4.method === "centroid+centeredX",
    "method=" + p4.method);
  // 5. Left overshoot unchanged: centroid 5 -> off = -10 -> clamps to 2, plain method
  var p5 = place(30, 5);
  ok("S100 C5 left overshoot clamps to margin", p5.method === "centroid" && Math.abs(p5.houseLeftX - 2) <= 0.5,
    "method=" + p5.method + " leftX=" + p5.houseLeftX);
})();

console.log("lotGeometry invariant tests");
console.log("  passed: " + passed + "   failed: " + failed + "   warnings: " + warned);
if (warnings.length) {
  console.log("");
  // Cap warning spam; the count is what matters for the divergence study
  warnings.slice(0, 12).forEach(function (w) { console.log("  " + w); });
  if (warnings.length > 12) console.log("  ... and " + (warnings.length - 12) + " more warnings");
}
if (errors.length) {
  console.log("");
  errors.slice(0, 25).forEach(function (e) { console.log("  " + e); });
  if (errors.length > 25) console.log("  ... and " + (errors.length - 25) + " more failures");
}
console.log("");
process.exit(failed > 0 ? 1 : 0);
