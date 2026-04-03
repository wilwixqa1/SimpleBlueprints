// ============================================================
// STAIR GEOMETRY ENGINE — Multi-segment stair templates
// All coords in feet. Origin (0,0) = stair exit on deck edge.
// +Y = away from house, +X = right (facing away from house)
// ============================================================
// STEP-A-PARAMETRIC-PATCHED
function computeStairGeometry(params) {
  var p;
  if (typeof params === "object" && params !== null && !Array.isArray(params)) {
    p = params;
  } else {
    p = { template: arguments[0], height: arguments[1], stairWidth: arguments[2], numStringers: arguments[3] };
  }
  var template = p.template || "straight";
  var height = p.height;
  var stairWidth = p.stairWidth;
  var numStringers = p.numStringers;
  var runSplit = (p.runSplit != null) ? p.runSplit : null;
  var landingDepthOvr = (p.landingDepth != null) ? p.landingDepth : null;
  var stairGap = (p.stairGap != null) ? p.stairGap : 0.5;
  if (height <= 0.5) return null;
  const sw = stairWidth || 4;
  const ns = numStringers || 3;
  const totalRiseIn = height * 12;
  const totalRisers = Math.ceil(totalRiseIn / 7.5);
  const riseIn = totalRiseIn / totalRisers;
  const treadIn = 10.5;
  const gap = stairGap;
  function splitRisers(nRuns) {
    if (nRuns === 1) return [totalRisers];
    if (nRuns === 2) {
      const ratio = (runSplit != null && !Array.isArray(runSplit)) ? runSplit : 0.55;
      const r1 = Math.ceil(totalRisers * ratio);
      return [r1, totalRisers - r1];
    }
    if (nRuns === 3) {
      const ratios = Array.isArray(runSplit) ? runSplit : [0.4, 0.3];
      const r1 = Math.ceil(totalRisers * ratios[0]);
      const r2 = Math.ceil(totalRisers * ratios[1]);
      return [r1, r2, totalRisers - r1 - r2];
    }
    return [totalRisers];
  }
  function getLandingDepth() {
    return landingDepthOvr != null ? landingDepthOvr : Math.max(sw, 4);
  }
  function makeRun(risers) {
    const treads = Math.max(risers - 1, 1);
    const runFt = +(treads * treadIn / 12).toFixed(1);
    return { risers, treads, runFt, nStringers: ns };
  }
  let runs = [], landings = [];
  if (template === "straight") {
    const run = makeRun(totalRisers);
    runs.push({ ...run, rect: { x: -sw/2, y: 0, w: sw, h: run.runFt }, treadAxis: "h", downDir: "+y" });
  }
  else if (template === "wideLanding") {
    const [r1n, r2n] = splitRisers(2);
    const run1 = makeRun(r1n), run2 = makeRun(r2n);
    const platW = sw + 2, platD = getLandingDepth();
    runs.push({ ...run1, rect: { x: -sw/2, y: 0, w: sw, h: run1.runFt }, treadAxis: "h", downDir: "+y" });
    const ly = run1.runFt;
    landings.push({ rect: { x: -platW/2, y: ly, w: platW, h: platD }, posts: [[-platW/2, ly], [platW/2, ly], [-platW/2, ly+platD], [platW/2, ly+platD]] });
    runs.push({ ...run2, rect: { x: -sw/2, y: ly+platD, w: sw, h: run2.runFt }, treadAxis: "h", downDir: "+y" });
  }
  else if (template === "lLeft") {
    const [r1n, r2n] = splitRisers(2);
    const run1 = makeRun(r1n), run2 = makeRun(r2n), lD = getLandingDepth();
    runs.push({ ...run1, rect: { x: -sw/2, y: 0, w: sw, h: run1.runFt }, treadAxis: "h", downDir: "+y" });
    const ly = run1.runFt, landW = sw + run2.runFt, lx = -sw/2 - run2.runFt;
    landings.push({ rect: { x: lx, y: ly, w: landW, h: lD }, posts: [[lx, ly], [lx+landW, ly], [lx, ly+lD], [lx+landW, ly+lD]] });
    runs.push({ ...run2, rect: { x: lx, y: ly + (lD-sw)/2, w: run2.runFt, h: sw }, treadAxis: "w", downDir: "-x" });
  }
  else if (template === "lRight") {
    const [r1n, r2n] = splitRisers(2);
    const run1 = makeRun(r1n), run2 = makeRun(r2n), lD = getLandingDepth();
    runs.push({ ...run1, rect: { x: -sw/2, y: 0, w: sw, h: run1.runFt }, treadAxis: "h", downDir: "+y" });
    const ly = run1.runFt, lx = -sw/2, landW = sw + run2.runFt;
    landings.push({ rect: { x: lx, y: ly, w: landW, h: lD }, posts: [[lx, ly], [lx+landW, ly], [lx, ly+lD], [lx+landW, ly+lD]] });
    runs.push({ ...run2, rect: { x: sw/2, y: ly + (lD-sw)/2, w: run2.runFt, h: sw }, treadAxis: "w", downDir: "+x" });
  }
  else if (template === "switchback") {
    const [r1n, r2n] = splitRisers(2);
    const run1 = makeRun(r1n), run2 = makeRun(r2n);
    const maxRun = Math.max(run1.runFt, run2.runFt), lD = getLandingDepth(), totalW = sw * 2 + gap;
    runs.push({ ...run1, rect: { x: gap/2, y: 0, w: sw, h: run1.runFt }, treadAxis: "h", downDir: "+y" });
    const ly = maxRun;
    landings.push({ rect: { x: -sw - gap/2, y: ly, w: totalW, h: lD }, posts: [[-sw-gap/2, ly], [sw+gap/2, ly], [-sw-gap/2, ly+lD], [sw+gap/2, ly+lD]] });
    runs.push({ ...run2, rect: { x: -sw - gap/2, y: ly - run2.runFt, w: sw, h: run2.runFt }, treadAxis: "h", downDir: "-y" });
  }
  else if (template === "wrapAround") {
    const [r1n, r2n, r3n] = splitRisers(3);
    const run1 = makeRun(r1n), run2 = makeRun(r2n), run3 = makeRun(r3n);
    const lD = getLandingDepth(), totalW = sw * 2 + gap;
    runs.push({ ...run1, rect: { x: gap/2, y: 0, w: sw, h: run1.runFt }, treadAxis: "h", downDir: "+y" });
    const l1y = run1.runFt;
    landings.push({ rect: { x: -sw-gap/2, y: l1y, w: totalW, h: lD }, posts: [[-sw-gap/2, l1y], [sw+gap/2, l1y], [-sw-gap/2, l1y+lD], [sw+gap/2, l1y+lD]] });
    runs.push({ ...run2, rect: { x: -sw-gap/2, y: l1y - run2.runFt, w: sw, h: run2.runFt }, treadAxis: "h", downDir: "-y" });
    const l2y = l1y - run2.runFt - lD, l2x = -sw - gap/2 - run3.runFt;
    landings.push({ rect: { x: l2x, y: l2y, w: sw + run3.runFt + gap/2, h: lD }, posts: [[l2x, l2y], [-gap/2, l2y], [l2x, l2y+lD], [-gap/2, l2y+lD]] });
    runs.push({ ...run3, rect: { x: l2x, y: l2y + (lD-sw)/2, w: run3.runFt, h: sw }, treadAxis: "w", downDir: "-x" });
  }
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  [...runs, ...landings].forEach(item => { const r = item.rect; minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); });
  return { template, runs, landings, totalRisers, riseIn, stairWidth: sw,
    bbox: { minX, minY, maxX, maxY, w: maxX-minX, h: maxY-minY },
    totalStringers: runs.reduce((s,r) => s + r.nStringers, 0),
    totalLandingPosts: landings.reduce((s,l) => s + l.posts.length, 0),
    params: p };
}

// ============================================================
// STAIR PLACEMENT — parametric anchor + angle
// ============================================================
function getStairPlacement(p, c) {
  if (p.stairAnchorX != null && p.stairAnchorY != null && p.stairAngle != null) {
    return { anchorX: p.stairAnchorX, anchorY: p.stairAnchorY, angle: p.stairAngle };
  }
  const W = c.W, D = c.D;
  const off = p.stairOffset || 0;
  const loc = p.stairLocation || "front";
  if (loc === "front") return { anchorX: W / 2 + off, anchorY: D, angle: 0 };
  if (loc === "right") return { anchorX: W, anchorY: D / 2 + off, angle: 90 };
  if (loc === "left")  return { anchorX: 0, anchorY: D / 2 + off, angle: 270 };
  return { anchorX: W / 2, anchorY: D, angle: 0 };
}

function snapStairToEdge(ax, ay, W, D, threshold) {
  const th = threshold || 1.0;
  const edges = [
    { dist: Math.abs(ay - D), anchorX: ax, anchorY: D, angle: 0, edge: "front" },
    { dist: Math.abs(ax - W), anchorX: W, anchorY: ay, angle: 90, edge: "right" },
    { dist: Math.abs(ay),     anchorX: ax, anchorY: 0, angle: 180, edge: "back" },
    { dist: Math.abs(ax),     anchorX: 0, anchorY: ay, angle: 270, edge: "left" },
  ];
  edges.sort((a, b) => a.dist - b.dist);
  const nearest = edges[0];
  if (nearest.dist <= th) {
    return { anchorX: nearest.anchorX, anchorY: nearest.anchorY, angle: nearest.angle, snapped: true, edge: nearest.edge };
  }
  return { anchorX: ax, anchorY: ay, angle: null, snapped: false, edge: null };
}

// ============================================================
// STAIR PLACEMENT -- zone-aware (S64)
// stair = { location, offset, anchorX, anchorY, angle, width, ... }
// zoneRect = { x, y, w, d } from getZoneRect
// Returns { anchorX, anchorY, angle } in ZONE-LOCAL coords
// ============================================================
function getStairPlacementForZone(stair, zoneRect) {
  if (stair.anchorX != null && stair.anchorY != null && stair.angle != null) {
    return { anchorX: stair.anchorX, anchorY: stair.anchorY, angle: stair.angle };
  }
  var W = zoneRect.w, D = zoneRect.d;
  var off = stair.offset || 0;
  var loc = stair.location || "front";
  if (loc === "front") return { anchorX: W / 2 + off, anchorY: D, angle: 0 };
  if (loc === "right") return { anchorX: W, anchorY: D / 2 + off, angle: 90 };
  if (loc === "left")  return { anchorX: 0, anchorY: D / 2 + off, angle: 270 };
  return { anchorX: W / 2, anchorY: D, angle: 0 };
}

// Export to window
window.computeStairGeometry = computeStairGeometry;
window.getStairPlacement = getStairPlacement;
window.getStairPlacementForZone = getStairPlacementForZone;
window.snapStairToEdge = snapStairToEdge;
