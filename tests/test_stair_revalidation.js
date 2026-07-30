// S108: stairs must survive shape changes (the "stale stairs" bug, reported
// S106: drag a stair, resize the deck, the stair stays anchored to nothing).
//
// window.revalidateStairs(nextP, prevP) is the rule; app.js calls it from
// every dimension-change path (u() flat width/depth/stairWidth, u()'s
// zone-routing branch, updateZone w/d for the AI helper, and project load
// with prev=null). This suite pins the rule itself, headlessly.
//
// Frames: a stair's local frame is its zone's world rect extents (the same
// frame the planView drag clamps to). Side sections swap w/d into the rect
// (getZoneRect), so R7/R8 pin that the revalidation sees the RECT, not the
// raw zone fields.

"use strict";
const fs = require("fs");
global.window = global;
eval(fs.readFileSync("backend/static/js/zoneUtils.js", "utf8"));

let fails = 0;
function check(name, cond, detail) {
  console.log("  " + name.padEnd(66) + (cond ? "ok" : "FAIL " + JSON.stringify(detail)));
  if (!cond) fails++;
}

function P(over) {
  return Object.assign({
    width: 20, depth: 12, height: 4, zones: [], deckStairs: [],
  }, over);
}

const rv = window.revalidateStairs;

console.log("R1. offset stair: shrink re-clamps, growth leaves it alone");
{
  const s = { id: 1, zoneId: 0, location: "front", offset: 7, width: 4, anchorX: null, anchorY: null, angle: null };
  const prev = P({ deckStairs: [s] });                       // maxOff = (20-4)/2 = 8, offset 7 legal
  const next = P({ width: 12, deckStairs: [s] });            // maxOff = (12-4)/2 = 4
  const out = rv(next, prev);
  check("R1a shrink 20->12 clamps offset 7 -> 4", out[0].offset === 4, out[0]);
  const next2 = P({ width: 30, deckStairs: [s] });
  check("R1b grow 20->30 returns the SAME array (no churn)", rv(next2, prev) === next2.deckStairs);
}

console.log("R2. side-located offset stair clamps against DEPTH");
{
  const s = { id: 1, zoneId: 0, location: "right", offset: 5, width: 4, anchorX: null, anchorY: null, angle: null };
  const prev = P({ deckStairs: [s] });                       // depth 12: maxOff = 4 -- 5 was already stale
  const out = rv(P({ depth: 10, deckStairs: [s] }), prev);   // maxOff = 3
  check("R2a depth 12->10 clamps offset 5 -> 3", out[0].offset === 3, out[0]);
}

console.log("R3. absolute front-edge stair FOLLOWS the front edge");
{
  const s = { id: 1, zoneId: 0, location: "front", offset: 0, width: 4, anchorX: 10, anchorY: 12, angle: 0 };
  const prev = P({ deckStairs: [s] });
  const grow = rv(P({ depth: 16, deckStairs: [s] }), prev);
  check("R3a grow depth 12->16: anchorY follows to 16", grow[0].anchorY === 16, grow[0]);
  const shrink = rv(P({ depth: 8, deckStairs: [s] }), prev);
  check("R3b shrink depth 12->8: anchorY follows to 8", shrink[0].anchorY === 8, shrink[0]);
  check("R3c along-edge coordinate untouched when still legal", grow[0].anchorX === 10, grow[0]);
}

console.log("R4. absolute right-edge stair follows a WIDTH change");
{
  const s = { id: 1, zoneId: 0, location: "right", offset: 0, width: 4, anchorX: 20, anchorY: 6, angle: 90 };
  const prev = P({ deckStairs: [s] });
  const out = rv(P({ width: 14, deckStairs: [s] }), prev);
  check("R4a width 20->14: anchorX follows to 14", out[0].anchorX === 14, out[0]);
  check("R4b anchorY untouched", out[0].anchorY === 6, out[0]);
}

console.log("R5. edge-pinned along-coordinate keeps the stair on the deck");
{
  const s = { id: 1, zoneId: 0, location: "front", offset: 0, width: 4, anchorX: 18, anchorY: 12, angle: 0 };
  const prev = P({ deckStairs: [s] });
  const out = rv(P({ width: 10, deckStairs: [s] }), prev);   // stair half-width 2: along in [2, 8]
  check("R5a width 20->10: anchorX 18 pulled to 8 (= W - sw/2)", out[0].anchorX === 8, out[0]);
  const tiny = rv(P({ width: 3, deckStairs: [s] }), prev);   // edge shorter than the stair: centered
  check("R5b edge shorter than stair: centered at 1.5", tiny[0].anchorX === 1.5, tiny[0]);
}

console.log("R6. interior manual drop: clamped into the rect, never edge-pinned");
{
  const s = { id: 1, zoneId: 0, location: "front", offset: 0, width: 4, anchorX: 15, anchorY: 6, angle: 0 };
  const prev = P({ deckStairs: [s] });
  const grow = rv(P({ depth: 20, deckStairs: [s] }), prev);
  check("R6a grow: interior anchor untouched (same array)", grow === P({ depth: 20, deckStairs: [s] }).deckStairs || grow[0].anchorX === 15 && grow[0].anchorY === 6, grow[0]);
  const shrink = rv(P({ width: 12, depth: 5, deckStairs: [s] }), prev);
  check("R6b shrink: clamped to (12, 5)", shrink[0].anchorX === 12 && shrink[0].anchorY === 5, shrink[0]);
}

console.log("R7. back-edge drop (house side) stays pinned at 0");
{
  const s = { id: 1, zoneId: 0, location: "back", offset: 0, width: 4, anchorX: 10, anchorY: 0, angle: 180 };
  const prev = P({ deckStairs: [s] });
  const out = rv(P({ depth: 18, deckStairs: [s] }), prev);
  check("R7a depth change leaves back anchor at y=0", out[0].anchorY === 0, out[0]);
}

console.log("R8. section stairs use the ZONE's rect, side sections swap w/d");
{
  // Deck B on the RIGHT edge of Deck A: rect = { w: zone.d, d: zone.w }.
  const zone = { id: 1, type: "add", attachTo: 0, attachEdge: "right", attachOffset: 0, w: 10, d: 8 };
  // Stair on the section's outer (east) edge: local anchorX == rect.w == zone.d == 8.
  const s = { id: 1, zoneId: 1, location: "right", offset: 0, width: 4, anchorX: 8, anchorY: 5, angle: 90 };
  const prev = P({ zones: [zone], deckStairs: [s] });
  const zone2 = Object.assign({}, zone, { d: 12 });          // deepen the section
  const next = P({ zones: [zone2], deckStairs: [s] });
  const out = rv(next, prev);
  check("R8a section d 8->12: outer-edge anchor follows to 12", out[0].anchorX === 12, out[0]);
  // Offset stair on the same section: local edge length for location "right"
  // is rect.d == zone.w.
  const s2 = { id: 2, zoneId: 1, location: "right", offset: 3, width: 4, anchorX: null, anchorY: null, angle: null };
  const prev2 = P({ zones: [zone], deckStairs: [s2] });      // rect.d = 10, maxOff = 3: legal
  const zone3 = Object.assign({}, zone, { w: 6 });           // rect.d = 6, maxOff = 1
  const out2 = rv(P({ zones: [zone3], deckStairs: [s2] }), prev2);
  check("R8b section w 10->6: offset 3 -> 1", out2[0].offset === 1, out2[0]);
}

console.log("R9. mixed list: only the stale stair is replaced");
{
  const ok = { id: 1, zoneId: 0, location: "front", offset: 0, width: 4, anchorX: null, anchorY: null, angle: null };
  const stale = { id: 2, zoneId: 0, location: "front", offset: 0, width: 4, anchorX: 10, anchorY: 12, angle: 0 };
  const prev = P({ deckStairs: [ok, stale] });
  const out = rv(P({ depth: 16, deckStairs: [ok, stale] }), prev);
  check("R9a untouched stair keeps identity", out[0] === ok);
  check("R9b stale stair replaced with followed anchor", out[1] !== stale && out[1].anchorY === 16, out[1]);
}

console.log("R10. null prev (project load) sanitizes without edge-following");
{
  const s = { id: 1, zoneId: 0, location: "front", offset: 0, width: 4, anchorX: 25, anchorY: 30, angle: 0 };
  const loaded = P({ deckStairs: [s] });                     // 20x12 deck, anchor way outside
  const out = rv(loaded, null);
  // Beyond-the-front-edge counts as front-pinned, so the along coordinate
  // also pulls in to keep the stair's full width on the deck: (18, 12), not
  // the raw corner clamp (20, 12) which would hang the stair half off.
  check("R10a out-of-rect anchor lands fully on the deck at (18, 12)",
        out[0].anchorX === 18 && out[0].anchorY === 12, out[0]);
  const legal = { id: 1, zoneId: 0, location: "front", offset: 0, width: 4, anchorX: 10, anchorY: 6, angle: 0 };
  const loaded2 = P({ deckStairs: [legal] });
  check("R10b legal interior stair untouched (same array)", rv(loaded2, null) === loaded2.deckStairs);
}

console.log("R11. stair on a missing zone is left alone (removeZone owns it)");
{
  const s = { id: 1, zoneId: 9, location: "front", offset: 0, width: 4, anchorX: 3, anchorY: 3, angle: 0 };
  const prev = P({ deckStairs: [s] });
  const out = rv(P({ width: 10, deckStairs: [s] }), prev);
  check("R11a untouched", out[0] === s);
}

console.log();
if (fails) { console.log("STAIR REVALIDATION: " + fails + " FAILURE(S)"); process.exit(1); }
console.log("STAIR REVALIDATION: all checks passed");
