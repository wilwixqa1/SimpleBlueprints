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

    // H1: sane bounds
    ok(tag + " H1 offset>=2", placed.offset >= 2, "offset=" + placed.offset);
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

    // H5: CONSISTENCY -- positioning space vs renderer space.
    // positionHouse measures offset from tightEdges().left; the renderer
    // draws at leftEdgeAtY(midY)+offset. Measure the divergence.
    var te = G.tightEdges(dv, placed.dist + 2, hcy, placed.dist + hd - 2);
    var intendedX = te.left + placed.offset;
    var divergence = Math.abs(intendedX - hx);
    if (divergence > 2) {
      warn(tag + " H5 position/render divergence",
        divergence.toFixed(1) + "ft (intendedX=" + intendedX.toFixed(1) + " renderX=" + hx.toFixed(1) + ")");
    } else { passed++; }
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
