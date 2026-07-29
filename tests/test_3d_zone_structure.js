#!/usr/bin/env node
/* S107: the 3D scene must give every SECTION the structure the engine sizes.
 *
 * WHY THIS EXISTS
 * ---------------
 * The S106 lesson, applied to sections: the old zone block skipped posts and
 * beam entirely for flush sections (matching the old unbuildable
 * zero-structure model) and drew the beam on the FRONT edge even for
 * left/right sections -- the wrong edge for exactly Will's B/C design that
 * started S107. Nothing flagged either, because the 3D had no zone checks.
 *
 * This pins, per additive section:
 *   Z1  the scene contains exactly engine nPosts posts inside the section
 *   Z2  those posts sit ON the section's far (outer) edge line, not the
 *       front edge and not scattered on corners
 *   Z3  a beam mesh runs along that same far edge, oriented with it
 *   Z4  flush sections have structure at all (the S107 headline)
 *
 * Run: node tests/test_3d_zone_structure.js
 * (CI installs three + @babel/standalone first.)
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
global.React = { useEffect: () => {}, useRef: () => ({ current: null }),
                 useState: (v) => [v, () => {}], createElement: () => null };
global.window.SBP3D_THEME = "plain";

const js = (f) => {
  const src = fs.readFileSync(path.join(ROOT, "backend", "static", "js", f), "utf8");
  const code = f === "deck3d.js"
    ? Babel.transform(src, { presets: [["react", { runtime: "classic" }]] }).code
    : src;
  eval.call(global, code);
};
js("zoneUtils.js");
js("stairGeometry.js");
js("engine.js");
js("deck3d.js");

// Will's B/C shape: 22ft ledger deck, flush sections left and right, plus a
// dropped section on the front for the contrast case.
const P = {
  width: 22, depth: 12, height: 4, houseWidth: 45.5, houseDepth: 30,
  attachment: "ledger", joistSpacing: 16, deckingType: "composite",
  railType: "steel", framingType: "wood", beamType: "dropped",
  snowLoad: "moderate", frostZone: "cold", lotWidth: 80, lotDepth: 120,
  setbackFront: 25, setbackSide: 5, setbackRear: 20, houseOffsetSide: 20,
  nextZoneId: 4,
  zones: [
    { id: 1, type: "add", attachEdge: "left", attachOffset: 0, w: 8, d: 11.5,
      h: 4, attachTo: 0, label: "Zone 1", joistDir: "perpendicular",
      beamType: "flush", stairs: null },
    { id: 2, type: "add", attachEdge: "right", attachOffset: 0, w: 8, d: 12,
      h: 4, attachTo: 0, label: "Zone 2", joistDir: "perpendicular",
      beamType: "flush", stairs: null },
    { id: 3, type: "add", attachEdge: "front", attachOffset: 6, w: 10, d: 6,
      h: 4, attachTo: 0, label: "Zone 3", joistDir: "perpendicular",
      beamType: "dropped", stairs: null },
  ],
};

const c = window.calcStructure(P);
const zc = window.calcAllZones(P, c);
const scene = new THREE.Scene();
window.buildDeckScene(scene, P, c, THREE);
scene.updateMatrixWorld(true);

const side = { "6x6": 5.5 / 12, "4x4": 3.5 / 12 }[c.postSize] || 5.5 / 12;
const posts = [], beams = [];
scene.traverse((o) => {
  if (!o.isMesh || o.geometry.type !== "BoxGeometry") return;
  const g = o.geometry.parameters;
  if (Math.abs(g.width - side) < 0.02 && Math.abs(g.depth - side) < 0.02
      && g.height >= 1.0) {
    posts.push({ x: o.position.x, z: o.position.z });
  }
  // beam boxes: ~11.875in tall, narrow one way, long the other
  if (Math.abs(g.height - 11.875 / 12) < 0.02
      && Math.min(g.width, g.depth) < 0.6 && Math.max(g.width, g.depth) > 2) {
    beams.push({ x: o.position.x, z: o.position.z,
                 lenX: g.width, lenZ: g.depth });
  }
});

// With sections present, deck3d centers the scene on the composite bounding
// box, so the deck-local -> world offset is NOT simply (-W/2, -D/2). Solve
// it instead of assuming it: the main deck's posts are pinned 1:1 against
// engine beamLayout.postXY (test_3d_posts_parity), so matching the first
// layout post to its nearest scene post recovers (cx, cz) exactly.
const layout = c.beamLayout.postXY;
let cx = null, cz = null;
{
  const [lx, ly] = layout[0];
  let best = null, bd = 1e9;
  for (const p2 of posts) {
    // candidate offset from this pairing; accept it if EVERY layout post
    // then lands on a scene post
    const ox = p2.x - lx, oz = p2.z - ly;
    const all = layout.every(([qx, qy]) => posts.some((sp) =>
      Math.abs(sp.x - (qx + ox)) < 0.03 && Math.abs(sp.z - (qy + oz)) < 0.03));
    if (all) {
      const d2 = ox * ox + oz * oz;
      if (d2 < bd) { bd = d2; best = [ox, oz]; }
    }
  }
  if (!best) { console.log("FAIL  could not solve world offset from main-deck posts"); process.exit(1); }
  cx = best[0]; cz = best[1];
}
console.log(`  (world offset solved from main-deck posts: cx=${cx.toFixed(2)}, cz=${cz.toFixed(2)})`);
// getZoneRect reads preview-style keys (deckWidth/deckDepth); raw params
// silently fall back to a 16x12 default, shifting every right/front rect.
const rects = window.getAdditiveRects(
  Object.assign({}, P, { deckWidth: P.width, deckDepth: P.depth, deckHeight: P.height }));

let fails = 0;
function check(cond, msg) {
  console.log((cond ? "  ok   " : "  FAIL ") + msg);
  if (!cond) fails++;
}

const adds = zc.zoneCalcs.map((z, i) => ({ zi: z, zone: P.zones[i] }))
                         .filter((e) => e.zi);
for (const { zi, zone } of adds) {
  const ar = rects.find((r) => r.zone && r.zone.id === zone.id);
  const rx = cx + ar.rect.x, rz = cz + ar.rect.y;
  const rw = ar.rect.w, rd = ar.rect.d;
  const inZone = posts.filter((p) =>
    p.x > rx - 0.3 && p.x < rx + rw + 0.3 &&
    p.z > rz - 0.3 && p.z < rz + rd + 0.3);
  check(inZone.length === zi.nPosts,
        `${zone.label} (${zone.attachEdge}, ${zi.beamType}): scene has ` +
        `${inZone.length} posts, engine sized ${zi.nPosts}`);

  // far edge line per attach edge; flush hugs the rim, dropped is inset 0.75
  const inset = zi.beamType === "flush" ? 0.15 : 0.75;
  let onFar, farDesc, beamOK;
  if (zone.attachEdge === "left") {
    onFar = inZone.every((p) => Math.abs(p.x - (rx + inset)) < 0.05);
    farDesc = `x=${(rx + inset).toFixed(2)} (outer/left rim)`;
    beamOK = beams.some((b) => Math.abs(b.x - (rx + inset)) < 0.05
                            && b.lenZ > b.lenX && Math.abs(b.z - (rz + rd / 2)) < 1.0);
  } else if (zone.attachEdge === "right") {
    onFar = inZone.every((p) => Math.abs(p.x - (rx + rw - inset)) < 0.05);
    farDesc = `x=${(rx + rw - inset).toFixed(2)} (outer/right rim)`;
    beamOK = beams.some((b) => Math.abs(b.x - (rx + rw - inset)) < 0.05
                            && b.lenZ > b.lenX && Math.abs(b.z - (rz + rd / 2)) < 1.0);
  } else {
    onFar = inZone.every((p) => Math.abs(p.z - (rz + rd - inset)) < 0.05);
    farDesc = `z=${(rz + rd - inset).toFixed(2)} (outer/front rim)`;
    beamOK = beams.some((b) => Math.abs(b.z - (rz + rd - inset)) < 0.05
                            && b.lenX > b.lenZ && Math.abs(b.x - (rx + rw / 2)) < 1.0);
  }
  check(onFar, `${zone.label}: every post on the far edge line ${farDesc}`);
  check(beamOK, `${zone.label}: a beam runs along that far edge`);
}

// Z4 explicit: the flush sections are not empty of structure
const flushTotal = adds.filter((e) => e.zi.beamType === "flush")
                       .reduce((s, e) => s + e.zi.nPosts, 0);
check(flushTotal >= 4, `flush sections carry structure (${flushTotal} posts total)`);

console.log();
if (fails) { console.log(`FAILED: ${fails} assertion(s)`); process.exit(1); }
console.log("PASS  3D sections: engine-sized posts and a beam on the correct far edge, flush included");
