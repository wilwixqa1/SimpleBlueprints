/* parity_probe.js (P1.a) -- emit the frontend geometry outputs for a given
 * config so the Python parity test (tests/test_frontend_parity.py) can assert
 * the JS preview and the backend PDF pipeline agree on a notched deck.
 *
 * Usage: node parity_probe.js '<params-json>'
 *   params-json uses deckWidth/deckDepth for zone 0, plus zones[] and deckStairs[].
 * Prints one JSON line: { profile, anchor, openings, edges }.
 */
const fs = require("fs");
const path = require("path");
global.window = {};
const base = path.join(__dirname, "..", "..", "backend", "static", "js");
eval(fs.readFileSync(path.join(base, "stairGeometry.js"), "utf8"));
eval(fs.readFileSync(path.join(base, "zoneUtils.js"), "utf8"));

const p = JSON.parse(process.argv[2]);
const W = p.deckWidth, D = p.deckDepth;
const cuts = window.getCutoutRects(p);
const profile = window.frontEdgeProfile(W, D, cuts);

// Anchor for the first zone-0 front stair, else a synthetic centered 4ft stair.
const st = (p.deckStairs || []).find(
  (s) => (s.zoneId || 0) === 0 && (s.location || "front") === "front"
) || { location: "front", offset: 0, width: 4 };
const anchor = window.getStairPlacementForZone(st, { x: 0, y: 0, w: W, d: D }, profile);

const openings = window.computeStairOpenings(p);
const edges = window.getExposedEdges(p, openings);

console.log(JSON.stringify({ profile, anchor, openings, edges }));
