#!/usr/bin/env node
/* The 3D scene must contain EXACTLY the posts the engine computed.
 *
 * WHY THIS EXISTS (S106)
 * ----------------------
 * The 3D view had zero automated checks. Two shipped consequences, both
 * found by Will from screenshots, neither by the gate:
 *
 *   1. A freestanding deck rendered HALF its posts: deck3d re-derived one
 *      row of pp x-positions at a hardcoded z of D - 1.5, while the sheet
 *      (correctly, since S102) drew both beam lines and 14 posts. The
 *      engine computed beamLayout.postXY with both rows and then threw it
 *      away -- it was never in calcStructure's return.
 *
 *   2. A post rendered inside a stairwell at a z no drawing agreed with,
 *      because the re-derivation used a different beam line than the
 *      layout's stepped segments.
 *
 * The fix pattern is CONSUME, DON'T RE-DERIVE: engine.js now returns
 * beamLayout and deck3d renders postXY verbatim. This test pins that: it
 * builds the real scene with the real three.js in node, finds every 6x6
 * post mesh, and requires a 1:1 position match with beamLayout.postXY.
 * Count mismatches, position drift, or a renderer quietly re-deriving
 * again all go red.
 *
 * Run: node tests/test_3d_posts_parity.js
 * (CI installs three via `npm install --no-save three` first.)
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
function req(name, fallback) {
  try { return require(name); }
  catch (e) {
    try { return require(fallback); }
    catch (e2) { return null; }
  }
}
const THREE = req("three", "/home/claude/threetest/node_modules/three");
const Babel = req("@babel/standalone", "/home/claude/babelchk/node_modules/@babel/standalone");
if (!THREE || !Babel) {
  console.log("SKIP: needs `npm install --no-save three @babel/standalone`");
  process.exit(0);
}

global.window = global;
// deck3d destructures React hooks at module top for its component; the scene
// builder itself never calls them. Stub just enough to load the file.
global.React = { useEffect: () => {}, useRef: () => ({ current: null }),
                 useState: (v) => [v, () => {}] };
// The photo theme builds canvas textures via document.createElement. Node has
// no DOM; the plain theme skips every texture path.
global.window.SBP3D_THEME = "plain";

// deck3d.js carries JSX for its React component wrapper; transform it the
// same way the browser's babel-standalone does. createElement is stubbed:
// the scene builder under test never renders a component.
global.React.createElement = () => null;
const js = (f) => {
  const src = fs.readFileSync(path.join(ROOT, "backend", "static", "js", f), "utf8");
  const code = f === "deck3d.js"
    ? Babel.transform(src, {
        presets: [["react", { runtime: "classic" }]] }).code
    : src;
  eval.call(global, code);
};
js("zoneUtils.js");
js("stairGeometry.js");
js("engine.js");
js("deck3d.js");

const BASE = {
  width: 28, depth: 12, height: 4, houseWidth: 40, houseDepth: 30,
  attachment: "ledger", joistSpacing: 16, deckingType: "composite",
  railType: "steel", framingType: "wood", beamType: "dropped",
  snowLoad: "moderate", frostZone: "cold", lotWidth: 80, lotDepth: 120,
  setbackFront: 25, setbackSide: 5, setbackRear: 20, houseOffsetSide: 20,
};

const POST_SIDE = { "6x6": 5.5 / 12, "4x4": 3.5 / 12 };

function scenePosts(p) {
  const c = window.calcStructure(p);
  const scene = new THREE.Scene();
  window.buildDeckScene(scene, p, c, THREE);
  scene.updateMatrixWorld(true);
  const side = POST_SIDE[c.postSize] || POST_SIDE["6x6"];
  const posts = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.geometry.type !== "BoxGeometry") return;
    const g = o.geometry.parameters;
    // a main post: square section of the post size, at least 1ft tall
    if (Math.abs(g.width - side) < 0.02 && Math.abs(g.depth - side) < 0.02
        && g.height >= 1.0) {
      posts.push([+o.position.x.toFixed(2), +o.position.z.toFixed(2)]);
    }
  });
  return { c, posts };
}

// deck3d places zone-0 posts in world coords offset by the deck origin
// (z0wx = -W/2 + deckOffset, z0wz = -D/2 approx). Recover the offset from the
// calc dims the same way deck3d does.
function expectedWorld(c, p) {
  const W = c.W, D = c.D;
  const cx = -W / 2 + (p.deckOffset || 0), cz = -D / 2;
  return c.beamLayout.postXY.map(([x, y]) => [+(cx + x).toFixed(2), +(cz + y).toFixed(2)]);
}

let fails = 0;
function run(name, p, extraChecks) {
  const { c, posts } = scenePosts(p);
  const want = expectedWorld(c, p).sort();
  const got = posts.slice().sort();
  const ok = JSON.stringify(want) === JSON.stringify(got);
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}: scene has ${got.length} posts, engine computed ${want.length}`);
  if (!ok) {
    console.log("        engine:", JSON.stringify(want));
    console.log("        scene: ", JSON.stringify(got));
    fails++;
  }
  if (extraChecks) extraChecks(c, got);
}

run("ledger, no stair (4 posts, one row)", { ...BASE });

run("ledger, touching front stair (S106 Case A: still 4, none in stairwell)",
  { ...BASE, deckStairs: [{ id: 0, zoneId: 0, location: "front", offset: 0,
                            width: 4, numStringers: 3,
                            anchorX: 14, anchorY: 10.5, angle: 0 }] },
  (c, got) => {
    const inWell = got.filter(([x, z]) => x > -2 && x < 2 && z > 4.4);
    if (inWell.length) { console.log("  FAIL post in stairwell:", inWell); fails++; }
  });

run("freestanding (BOTH rows: 8 posts, the bug Will screenshotted)",
  { ...BASE, attachment: "freestanding" },
  (c) => {
    const rows = new Set(c.beamLayout.postXY.map(([, y]) => y));
    if (rows.size !== 2) { console.log("  FAIL expected 2 beam rows, got", [...rows]); fails++; }
    if (c.beamLayout.beamLines !== 2) { console.log("  FAIL beamLines != 2"); fails++; }
  });

run("freestanding with front stair", 
  { ...BASE, attachment: "freestanding",
    deckStairs: [{ id: 0, zoneId: 0, location: "front", offset: 0,
                   width: 4, numStringers: 3 }] });

console.log();
if (fails) { console.log(`FAILED (${fails})`); process.exit(1); }
console.log("PASS  the 3D renders exactly the posts the engine computed");
