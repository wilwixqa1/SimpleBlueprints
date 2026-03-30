// ============================================================
// ENGINE   Structural Calculations + Materials Estimator
// IRC 2021 Table R507.6 joist spans verified from source (S59).
// ============================================================

// IRC 2021 Table R507.6: DFL/Hem-Fir/SPF (No. 2, wet service, incising factor)
// Keyed by DESIGN LOAD (40 LL, 50/60/70 ground snow), NOT total load.
const JOIST_SPANS = {
  40: { "2x6": { 12: 9.5, 16: 8.33, 24: 6.83 }, "2x8": { 12: 12.5, 16: 11.08, 24: 9.08 }, "2x10": { 12: 15.67, 16: 13.58, 24: 11.08 }, "2x12": { 12: 18.0, 16: 15.75, 24: 12.83 } },
  50: { "2x6": { 12: 8.83, 16: 8.0, 24: 6.67 }, "2x8": { 12: 11.58, 16: 10.58, 24: 8.92 }, "2x10": { 12: 14.83, 16: 13.25, 24: 10.83 }, "2x12": { 12: 17.75, 16: 15.42, 24: 12.58 } },
  60: { "2x6": { 12: 8.33, 16: 7.5, 24: 6.17 }, "2x8": { 12: 10.92, 16: 9.92, 24: 8.25 }, "2x10": { 12: 13.92, 16: 12.33, 24: 10.0 }, "2x12": { 12: 16.5, 16: 14.25, 24: 11.67 } },
  70: { "2x6": { 12: 7.92, 16: 7.08, 24: 5.75 }, "2x8": { 12: 10.42, 16: 9.42, 24: 7.67 }, "2x10": { 12: 13.25, 16: 11.5, 24: 9.42 }, "2x12": { 12: 15.42, 16: 13.33, 24: 10.92 } },
};

const FROST = { warm: 12, moderate: 24, cold: 36, severe: 48 };
const SNOW = { none: 0, light: 20, moderate: 40, heavy: 60 };

function getSpanTable(designLoad) {
  // designLoad = max(40, snow) per IRC footnote a
  for (const tier of [40, 50, 60, 70]) { if (designLoad <= tier) return JOIST_SPANS[tier]; }
  return JOIST_SPANS[70];
}

// IRC 2021 Tables R507.5(1)-(4): DFL/HF/SPF beam span tables (S60)
// Values in decimal feet, columns = effective joist span [6,8,10,12,14,16,18]
const BEAM_SPANS = {
  40: {
    "2-ply 2x6":  [6.08,5.25,4.75,4.33,3.92,3.58,3.25],
    "2-ply 2x8":  [8.17,7.08,6.33,5.75,5.17,4.67,4.33],
    "2-ply 2x10": [10.0,8.58,7.75,7.0,6.5,6.0,5.5],
    "2-ply 2x12": [11.58,10.0,8.92,8.17,7.58,7.08,6.67],
    "3-ply 2x6":  [7.67,6.67,6.0,5.5,5.08,4.75,4.5],
    "3-ply 2x8":  [10.25,8.83,7.92,7.25,6.67,6.25,5.92],
    "3-ply 2x10": [12.5,10.83,9.67,8.83,8.17,7.67,7.17],
    "3-ply 2x12": [14.5,12.58,11.25,10.25,9.5,8.92,8.42],
  },
  50: {
    "2-ply 2x6":  [6.0,5.17,4.58,4.17,3.83,3.42,3.17],
    "2-ply 2x8":  [8.0,6.92,6.17,5.67,5.0,4.58,4.17],
    "2-ply 2x10": [9.75,8.42,7.58,6.92,6.33,5.83,5.33],
    "2-ply 2x12": [11.33,9.83,8.75,8.0,7.42,6.92,6.5],
    "3-ply 2x6":  [7.5,6.5,5.75,5.25,4.92,4.58,4.33],
    "3-ply 2x8":  [10.0,8.67,7.75,7.08,6.5,6.08,5.67],
    "3-ply 2x10": [12.25,10.58,9.5,8.67,8.0,7.5,7.0],
    "3-ply 2x12": [14.25,12.33,11.0,10.08,9.33,8.75,8.25],
  },
  60: {
    "2-ply 2x6":  [5.5,4.75,4.25,3.83,3.42,3.08,2.83],
    "2-ply 2x8":  [7.42,6.42,5.75,5.0,4.58,4.08,3.75],
    "2-ply 2x10": [9.0,7.83,7.0,6.33,5.75,5.17,4.83],
    "2-ply 2x12": [10.5,9.08,8.08,7.42,6.92,6.33,5.83],
    "3-ply 2x6":  [6.92,6.0,5.33,4.92,4.5,4.17,3.83],
    "3-ply 2x8":  [9.25,8.0,7.17,6.5,6.08,5.5,5.0],
    "3-ply 2x10": [11.33,9.83,8.75,8.0,7.42,6.92,6.42],
    "3-ply 2x12": [13.17,11.42,10.17,9.33,8.58,8.08,7.58],
  },
  70: {
    "2-ply 2x6":  [5.17,4.5,4.0,3.42,3.08,2.83,2.58],
    "2-ply 2x8":  [6.92,6.0,5.25,4.58,4.08,3.67,3.42],
    "2-ply 2x10": [8.42,7.33,6.5,5.83,5.17,4.75,4.42],
    "2-ply 2x12": [9.83,8.5,7.58,6.92,6.33,5.75,5.33],
    "3-ply 2x6":  [6.5,5.58,5.0,4.58,4.17,3.75,3.42],
    "3-ply 2x8":  [8.67,7.5,6.67,6.08,5.5,5.0,4.58],
    "3-ply 2x10": [10.58,9.17,8.17,7.5,6.92,6.33,5.83],
    "3-ply 2x12": [12.33,10.67,9.58,8.75,8.08,7.58,7.08],
  },
};
const _BEAM_JOIST_COLS = [6,8,10,12,14,16,18];
const _BEAM_ORDER = [
  "2-ply 2x6","2-ply 2x8","2-ply 2x10","2-ply 2x12",
  "3-ply 2x6","3-ply 2x8","3-ply 2x10","3-ply 2x12",
];

function getBeamMaxSpan(beamSize, joistSpan, designLoad) {
  var tier = 70;
  for (var t of [40,50,60,70]) { if (designLoad <= t) { tier = t; break; } }
  var tbl = BEAM_SPANS[tier];
  var spans = tbl[beamSize];
  if (!spans) return 0;
  if (joistSpan <= _BEAM_JOIST_COLS[0]) return spans[0];
  if (joistSpan >= _BEAM_JOIST_COLS[_BEAM_JOIST_COLS.length-1]) return spans[spans.length-1];
  for (var i = 0; i < _BEAM_JOIST_COLS.length - 1; i++) {
    if (joistSpan >= _BEAM_JOIST_COLS[i] && joistSpan <= _BEAM_JOIST_COLS[i+1]) {
      var frac = (joistSpan - _BEAM_JOIST_COLS[i]) / (_BEAM_JOIST_COLS[i+1] - _BEAM_JOIST_COLS[i]);
      return +(spans[i] + frac * (spans[i+1] - spans[i])).toFixed(2);
    }
  }
  return spans[spans.length-1];
}

function calcStructure(p) {
  const { width: W, depth: D, height: H, joistSpacing: sp, attachment, snowLoad, frostZone, deckingType } = p;
  const area = W * D;

  // S38: Lot area (single source of truth for all consumers)
  // Tries lotVertices, then lotEdges via computePolygonVerts, then rectangle fallback
  var _lotVerts = p.lotVertices;
  if (!_lotVerts && p.lotEdges && window.computePolygonVerts) {
    _lotVerts = window.computePolygonVerts(p.lotEdges);
  }
  var lotArea;
  if (_lotVerts && _lotVerts.length >= 3) {
    var _sa = 0;
    for (var _li = 0; _li < _lotVerts.length; _li++) {
      var _lj = (_li + 1) % _lotVerts.length;
      _sa += _lotVerts[_li][0] * _lotVerts[_lj][1];
      _sa -= _lotVerts[_lj][0] * _lotVerts[_li][1];
    }
    lotArea = Math.round(Math.abs(_sa) / 2);
  } else {
    lotArea = (p.lotWidth || 80) * (p.lotDepth || 120);
  }
  // IRC R507.6 footnote a: snow not concurrent with live load. Use whichever is greater.
  const LL = Math.max(40, SNOW[snowLoad] || 0);
  const DL = deckingType === "composite" ? 15 : 12;
  const TL = LL + DL;
  const jSpan = attachment === "ledger" ? D - 1.5 : D / 2 - 0.75;
  // IRC table keyed by design load (LL), not total load (TL)
  const table = getSpanTable(LL);

  // === JOISTS (overridable) ===
  let joistSize = "2x12";
  let joistAuto = true;
  for (const [sz, spans] of Object.entries(table)) { if ((spans[sp] || 0) >= jSpan) { joistSize = sz; break; } }
  const autoJoist = joistSize;
  if (p.overJoist) { joistSize = p.overJoist; joistAuto = false; }

  // === BEAM - IRC R507.5 table lookup (S60) ===
  // BEAM_SPANS, _BEAM_ORDER, getBeamMaxSpan now at module scope

  // Auto posts - beam-aware (S60)
  let nP = W <= 10 ? 2 : W <= 16 ? 3 : W <= 24 ? 3 : W <= 32 ? 4 : Math.max(4, Math.ceil(W / 10) + 1);
  if (!p.overPostCount) {
    for (var _try = 0; _try < 6; _try++) {
      var _trySpan = W / (nP - 1);
      var _found = false;
      for (var _bs of _BEAM_ORDER) {
        if (getBeamMaxSpan(_bs, jSpan, LL) >= _trySpan) { _found = true; break; }
      }
      if (_found) break;
      nP++;
    }
  }
  const autoNP = nP;
  if (p.overPostCount) { nP = p.overPostCount; }
  const bSpan = W / (nP - 1);

  // Auto beam from IRC R507.5
  let beamSize = "3-ply LVL 1.75x12";
  for (var _bs of _BEAM_ORDER) {
    if (getBeamMaxSpan(_bs, jSpan, LL) >= bSpan) { beamSize = _bs; break; }
  }
  const autoBeam = beamSize;
  if (p.overBeam) { beamSize = p.overBeam; }

  // === POST SIZE (overridable) ===
  let postSize = "6x6";  // Billy Rule 8: 6x6 minimum per IRC R507.8
  const autoPostSize = postSize;
  if (p.overPostSize) { postSize = p.overPostSize; }

  const pp = []; for (let i = 0; i < nP; i++) pp.push(+(2 + i * (W - 4) / (nP - 1)).toFixed(2));

  // S34: Slope-adjusted post heights per position
  // Reference: ground at house attachment (y=0, x=W/2). Slope causes ground to
  // drop (downhill) or rise (uphill) relative to reference. Post height adjusts accordingly.
  var slopePct = (p.slopePercent || 0) / 100;
  var slopeDir = p.slopeDirection || "front-to-back";
  var beamDepth = D - 1.5;
  var postHeights = [];
  for (var hi = 0; hi < nP; hi++) {
    var groundDrop = 0; // positive = ground is lower = post is taller
    if (slopeDir === "front-to-back") groundDrop = slopePct * beamDepth;
    else if (slopeDir === "back-to-front") groundDrop = -slopePct * beamDepth;
    else if (slopeDir === "left-to-right") groundDrop = slopePct * (pp[hi] - W / 2);
    else if (slopeDir === "right-to-left") groundDrop = -(slopePct * (pp[hi] - W / 2));
    postHeights.push(Math.max(0.5, +(H + groundDrop).toFixed(2)));
  }

  const trib = (W / Math.max(nP - 1, 1)) * D;
  const reqD = Math.sqrt(trib * TL / 1500 / Math.PI) * 2 * 12;

  // === FOOTINGS (overridable) ===
  let fDiam = [12, 16, 18, 21, 24, 30, 36, 42].find(s => s >= reqD) || 42;
  const autoFDiam = fDiam;
  if (p.overFooting) { fDiam = p.overFooting; }
  const fDepth = FROST[frostZone] || 30;
  const nJ = Math.ceil(W / (sp / 12)) + 1;
  let railLen = W + D * 2; if (attachment === "freestanding") railLen += W;
  if (p.hasStairs) railLen -= 3;

  // S61: Adjust railing length for chamfers
  var _mc = p.mainCorners;
  if (_mc) {
    ["BL","BR","FL","FR"].forEach(function(_ck) {
      var _cc = _mc[_ck];
      if (_cc && _cc.type === "chamfer" && _cc.size > 0) {
        var _cs = _cc.size;
        if (attachment === "ledger" && (_ck === "BL" || _ck === "BR")) {
          // Back corners on ledger: only lose depth-side edge portion, gain diagonal
          railLen += _cs * Math.sqrt(2) - _cs;
        } else {
          railLen += _cs * Math.sqrt(2) - 2 * _cs;
        }
      }
    });
  }

  // Guard rail system (IRC R312.1.1, R312.1.3)
  const guardRequired = H * 12 > 30;
  const autoGuardHeight = H > 8 ? 42 : 36;
  let guardHeight = autoGuardHeight;
  if (p.overGuardHeight) {
    guardHeight = guardRequired ? Math.max(p.overGuardHeight, 36) : p.overGuardHeight;
  }

  const totalPosts = attachment === "ledger" ? nP : nP * 2;
  let stairs = null;
  if (p.hasStairs && H > 0.5) {
    const stairW = p.stairWidth || 4;
    const nStringers = p.numStringers || 3;
    const nR = Math.ceil(H * 12 / 7.5); const aR = H * 12 / nR;
    const tR = (nR - 1) * 10.5;
    const stairGeom = window.computeStairGeometry({ template: p.stairTemplate || "straight", height: H, stairWidth: stairW, numStringers: nStringers, runSplit: p.stairRunSplit ? p.stairRunSplit/100 : null, landingDepth: p.stairLandingDepth || null, stairGap: p.stairGap != null ? p.stairGap : 0.5 });
    stairs = {
      nRisers: nR, nTreads: nR - 1, rise: +aR.toFixed(2), tread: 10.5,
      runFt: +(tR / 12).toFixed(1),
      stringerFt: +(Math.sqrt((H * 12) ** 2 + tR ** 2) / 12 + 1).toFixed(1),
      width: stairW, nStringers,
      hasLanding: stairGeom ? stairGeom.landings.length > 0 : !!p.hasLanding,
      location: p.stairLocation || "front",
      template: p.stairTemplate || "straight",
      stairGeom: stairGeom,
      totalLandingPosts: stairGeom ? stairGeom.totalLandingPosts : 0,
      totalStringers: stairGeom ? stairGeom.totalStringers : nStringers,
      numRuns: stairGeom ? stairGeom.runs.length : 1,
      numLandings: stairGeom ? stairGeom.landings.length : 0,
    };
  }
  const midSpanBlocking = jSpan > 7;
  const blockingCount = midSpanBlocking ? Math.ceil(W / (sp / 12)) - 1 : 0;
  const warnings = [];
  const maxSpan = (table["2x12"] || {})[sp] || 0;

  // S61: Engineering required flag for joist over-span
  var maxDepthForJoists = 0;
  if (maxSpan > 0) {
    maxDepthForJoists = attachment === "ledger" ? +(maxSpan + 1.5).toFixed(1) : +((maxSpan + 0.75) * 2).toFixed(1);
  }
  var joistOverSpan = maxSpan > 0 && jSpan > maxSpan;
  var engineeringRequired = joistOverSpan;

  if (joistOverSpan) {
    warnings.push(`Joist span (${jSpan.toFixed(1)}') exceeds IRC R507.6 max (${maxSpan.toFixed(1)}') for 2x12 @ ${sp}" O.C. at ${LL} PSF. Intermediate beam required. Engineering review needed.`);
  }

  // Beam span check against IRC R507.5 (S60)
  const beamMaxSpan = beamSize.includes("LVL") ? 999 : getBeamMaxSpan(beamSize, jSpan, LL);
  if (!beamSize.includes("LVL") && bSpan > beamMaxSpan) {
    warnings.push(`Beam span (${bSpan.toFixed(1)}') exceeds IRC max (${beamMaxSpan.toFixed(1)}') for ${beamSize}. Add posts or upgrade beam.`);
  }

  if (H > 10) warnings.push("Height >10'. Lateral bracing by engineer recommended.");
  if (area > 500) warnings.push("Area >500 SF. Check local permit requirements.");

  // Override warnings
  const joistRank = { "2x6": 0, "2x8": 1, "2x10": 2, "2x12": 3 };
  if (p.overJoist && (joistRank[p.overJoist] || 0) < (joistRank[autoJoist] || 0)) {
// warnings.push(`  Joist override (${p.overJoist}) is smaller than recommended (${autoJoist}). May not meet code.`);
  }
  const beamRank = { "2-ply 2x8": 0, "2-ply 2x10": 1, "2-ply 2x12": 2, "3-ply 2x10": 3, "3-ply 2x12": 4, "3-ply LVL 1.75x12": 5 };
  if (p.overBeam && (beamRank[p.overBeam] || 0) < (beamRank[autoBeam] || 0)) {
// warnings.push(`  Beam override (${p.overBeam}) is smaller than recommended (${autoBeam}). May not meet code.`);
  }
  if (p.overPostSize === "4x4" && autoPostSize === "6x6") {
// warnings.push(`  Post override (4x4) is smaller than recommended (6x6). May not meet code.`);
  }
  if (p.overFooting && p.overFooting < autoFDiam) {
// warnings.push(`  Footing override (${p.overFooting}") is smaller than recommended (${autoFDiam}"). May not meet code.`);
  }
  if (p.overPostCount && p.overPostCount < autoNP) {
// warnings.push(`  Fewer posts (${p.overPostCount}) than recommended (${autoNP}). May not meet code.`);
  }

  return { W, D, H, area, lotArea, LL, DL, TL, joistSize, sp, jSpan: +jSpan.toFixed(1), nJ, beamSize, bSpan: +bSpan.toFixed(1), beamMaxSpan: +beamMaxSpan.toFixed(1), postSize, nP, totalPosts, pp, postHeights, fDiam, fDepth, nF: totalPosts, ledgerSize: joistSize, railLen: +railLen.toFixed(1), guardRequired, guardHeight, midSpanBlocking, blockingCount, stairs, warnings, attachment,
    engineeringRequired, maxDepthForJoists,
    auto: { joist: autoJoist, beam: autoBeam, postSize: autoPostSize, postCount: autoNP, footing: autoFDiam, guardHeight: autoGuardHeight }
  };
}

function estMaterials(p, c) {
  const items = [];
  const bags = Math.ceil((Math.PI * (c.fDiam / 24) ** 2 * (c.fDepth / 12)) / 0.6) * c.nF;
  items.push({ cat: "Foundation", item: "Concrete 80lb bags", qty: bags, cost: 6.5 });
  items.push({ cat: "Foundation", item: `Sonotube ${c.fDiam}"`, qty: c.nF, cost: c.fDiam > 18 ? 28 : 18 });
  items.push({ cat: "Foundation", item: "Post Base Hardware", qty: c.nF, cost: c.postSize === "6x6" ? 42 : 28 });
  items.push({ cat: "Posts", item: `${c.postSize} PT Posts`, qty: c.totalPosts, cost: c.postSize === "6x6" ? 48 : 24 });
  items.push({ cat: "Posts", item: "Post Cap Hardware", qty: c.totalPosts, cost: c.postSize === "6x6" ? 38 : 22 });
  const plies = parseInt(c.beamSize[0]); const isLVL = c.beamSize.includes("LVL");
  items.push({ cat: "Beam", item: isLVL ? "LVL 20'" : "PT Beam 20'", qty: Math.ceil(c.W / 20) * plies, cost: isLVL ? 95 : 55 });
  if (c.attachment === "ledger") {
    items.push({ cat: "Ledger", item: `${c.ledgerSize} PT Ledger`, qty: Math.ceil(c.W / 12), cost: 32 });
    items.push({ cat: "Ledger", item: "LedgerLok Screws (box)", qty: Math.ceil(c.W / (16 / 12) * 2 / 50), cost: 85 });
    items.push({ cat: "Ledger", item: "Flashing", qty: 1, cost: 55 });
    items.push({ cat: "Ledger", item: "Lateral Load Connectors (DTT2Z)", qty: 2, cost: 32 });
  }
  const jL = Math.ceil(c.D);
  items.push({ cat: "Framing", item: `${c.joistSize} Joists ${jL}'`, qty: c.nJ + 4, cost: jL <= 10 ? 22 : jL <= 12 ? 32 : 42 });
  items.push({ cat: "Framing", item: "Rim Joists", qty: Math.ceil(c.W / 12) + 2, cost: 32 });
  if (c.midSpanBlocking) {
    items.push({ cat: "Framing", item: c.joistSize + " Blocking (mid-span)", qty: c.blockingCount, cost: 8 });
  }
  items.push({ cat: "Hardware", item: "Joist Hangers", qty: c.nJ * 2, cost: 6 });
  items.push({ cat: "Hardware", item: "Hurricane Ties + Nails", qty: 1, cost: c.nJ * 2.75 + 50 });
  const bds = Math.ceil(c.W / (5.5 / 12)) * 1.1;
  if (p.deckingType === "composite") {
    items.push({ cat: "Decking", item: `Composite ${Math.ceil(c.D + 2)}'`, qty: Math.ceil(bds), cost: c.D <= 10 ? 28 : 38 });
    items.push({ cat: "Decking", item: "Hidden Fasteners", qty: 1, cost: 175 });
  } else {
    items.push({ cat: "Decking", item: `5/4x6 PT ${Math.ceil(c.D + 2)}'`, qty: Math.ceil(bds), cost: c.D <= 10 ? 12 : 18 });
    items.push({ cat: "Decking", item: "Deck Screws 5lb", qty: Math.ceil(c.W * c.D / 50), cost: 32 });
  }
  const rP = Math.ceil(c.railLen / 6) + 1;
  if (p.railType === "fortress") {
    items.push({ cat: "Railing", item: "Fortress Panels", qty: Math.ceil(c.railLen / 7), cost: 80 });
    items.push({ cat: "Railing", item: "Fortress Posts", qty: rP, cost: 45 });
    items.push({ cat: "Railing", item: "Top Rail + Brackets", qty: Math.ceil(c.railLen / 7), cost: 52 });
  } else {
    items.push({ cat: "Railing", item: "Wood Rail Kit (8')", qty: Math.ceil(c.railLen / 8), cost: 85 });
  }
  if (c.stairs) {
    const st = c.stairs;
    items.push({ cat: "Stairs", item: "2x12 Stair Stringers " + st.stringerFt + "'", qty: st.totalStringers, cost: st.stringerFt <= 8 ? 22 : st.stringerFt <= 12 ? 35 : 48 });
    items.push({ cat: "Stairs", item: "5/4x12 PT Treads", qty: st.nTreads * Math.ceil(st.width / 1), cost: 18 });
    items.push({ cat: "Stairs", item: "Stair Stringer Brackets", qty: st.totalStringers, cost: 8 });
    if (st.numLandings > 0) {
      items.push({ cat: "Stairs", item: "Landing Posts " + c.postSize, qty: st.totalLandingPosts, cost: c.postSize === "6x6" ? 48 : 24 });
      items.push({ cat: "Stairs", item: "Landing Post Bases", qty: st.totalLandingPosts, cost: c.postSize === "6x6" ? 42 : 28 });
      items.push({ cat: "Stairs", item: "Landing Footings " + c.fDiam + '"', qty: st.totalLandingPosts, cost: c.fDiam > 18 ? 28 : 18 });
      items.push({ cat: "Stairs", item: "Landing Framing Lumber", qty: st.numLandings * 4, cost: 22 });
      items.push({ cat: "Stairs", item: "Landing Decking", qty: st.numLandings * Math.ceil(st.width + 2), cost: p.deckingType === "composite" ? 28 : 12 });
    }
  }
  items.push({ cat: "Misc", item: "Joist Tape + Misc", qty: 1, cost: 120 });
  if (p.beamType === 'flush') {
    // Flush beam: joists hang into beam with hangers
    // Ledger: 1 beam line = nJ hangers. Freestanding: 2 beam lines = nJ * 2
    var _flushMult = c.attachment === 'freestanding' ? 2 : 1;
    items.push({ cat: "Hardware", item: "Beam Joist Hangers (LUS)", qty: c.nJ * _flushMult, cost: 4 });
  }
  const sub = items.reduce((s, i) => s + i.qty * i.cost, 0);
  return { items, sub, tax: sub * 0.08, cont: sub * 0.05, total: sub * 1.13 };
}


function calcAllZones(p, baseCalc) {
  var zones = p.zones || [];
  if (!zones.length) return null;
  var W = p.width, D = p.depth;
  var addArea = 0, cutArea = 0;
  var extraPosts = 0, extraFootings = 0;
  var extraItems = [];
  var BS = 1.5;
  var LL = baseCalc.LL, TL = baseCalc.TL;
  var zoneCalcs = [];  // S60: per-zone structural info
  for (var i = 0; i < zones.length; i++) {
    var z = zones[i];
    var edge = z.attachEdge || "front";
    var zw = z.w || 8, zd = z.d || 6;
    if (z.type === "cutout") { cutArea += zw * zd; zoneCalcs.push(null); continue; }
    addArea += zw * zd;
    var sp = baseCalc.sp || 16;
    var beamLen, jSpan, nJoists, nPosts;
    if (edge === "right" || edge === "left") {
      beamLen = zd; jSpan = zw - BS;
      nJoists = Math.ceil(zd / (sp / 12)) + 1;
      nPosts = Math.max(2, Math.ceil(zd / 8) + 1);
    } else {
      beamLen = zw; jSpan = zd - BS;
      nJoists = Math.ceil(zw / (sp / 12)) + 1;
      nPosts = Math.max(2, Math.ceil(zw / 8) + 1);
    }

    // S60: Independent joist sizing for this zone
    var zTable = getSpanTable(LL);
    var zJoistSize = "2x12";
    for (var _zs in zTable) {
      if ((zTable[_zs][sp] || 0) >= jSpan) { zJoistSize = _zs; break; }
    }

    // S60: Independent beam sizing for this zone
    var zBeamSpan = beamLen / (nPosts - 1);
    var zBeamSize = "3-ply LVL 1.75x12";
    for (var _bi = 0; _bi < _BEAM_ORDER.length; _bi++) {
      if (getBeamMaxSpan(_BEAM_ORDER[_bi], jSpan, LL) >= zBeamSpan) {
        zBeamSize = _BEAM_ORDER[_bi]; break;
      }
    }

    // S60: Independent footing sizing for this zone
    var zTrib = (beamLen / Math.max(nPosts - 1, 1)) * (edge === "right" || edge === "left" ? zw : zd);
    var zReqD = Math.sqrt(zTrib * TL / 1500 / Math.PI) * 2 * 12;
    var zFDiam = [12, 16, 18, 21, 24, 30, 36, 42].find(function(s) { return s >= zReqD; }) || 42;

    extraPosts += nPosts; extraFootings += nPosts;
    var label = z.label || ("Zone " + z.id);
    var jL = Math.ceil(jSpan);
    var fDp = baseCalc.fDepth;
    var bags = Math.ceil((Math.PI * Math.pow(zFDiam / 24, 2) * (fDp / 12)) / 0.6) * nPosts;

    zoneCalcs.push({ joistSize: zJoistSize, beamSize: zBeamSize, beamSpan: +zBeamSpan.toFixed(1), jSpan: +jSpan.toFixed(1), fDiam: zFDiam, nPosts: nPosts });

    extraItems.push({ cat: "Foundation", item: "Concrete bags (" + label + ")", qty: bags, cost: 6.5 });
    extraItems.push({ cat: "Foundation", item: "Sonotube " + zFDiam + "\" (" + label + ")", qty: nPosts, cost: zFDiam > 18 ? 28 : 18 });
    extraItems.push({ cat: "Foundation", item: "Post Base (" + label + ")", qty: nPosts, cost: baseCalc.postSize === "6x6" ? 42 : 28 });
    extraItems.push({ cat: "Posts", item: baseCalc.postSize + " Posts (" + label + ")", qty: nPosts, cost: baseCalc.postSize === "6x6" ? 48 : 24 });
    extraItems.push({ cat: "Posts", item: "Post Caps (" + label + ")", qty: nPosts, cost: baseCalc.postSize === "6x6" ? 38 : 22 });
    var plies = parseInt(zBeamSize[0]); var isLVL = zBeamSize.includes("LVL");
    extraItems.push({ cat: "Beam", item: (isLVL ? "LVL" : "PT Beam") + " (" + label + ")", qty: Math.ceil(beamLen / 20) * plies, cost: isLVL ? 95 : 55 });
    extraItems.push({ cat: "Framing", item: zJoistSize + " Joists " + jL + "' (" + label + ")", qty: nJoists + 2, cost: jL <= 10 ? 22 : jL <= 12 ? 32 : 42 });
    extraItems.push({ cat: "Framing", item: "Rim Joists (" + label + ")", qty: 3, cost: 32 });
    var boardDim = Math.max(zw, zd); var boardLen = Math.ceil(Math.min(zw, zd) + 2);
    var bds = Math.ceil(boardDim / (5.5 / 12)) * 1.1;
    if (p.deckingType === "composite") {
      extraItems.push({ cat: "Decking", item: "Composite " + boardLen + "' (" + label + ")", qty: Math.ceil(bds), cost: boardLen <= 10 ? 28 : 38 });
    } else {
      extraItems.push({ cat: "Decking", item: "5/4x6 PT " + boardLen + "' (" + label + ")", qty: Math.ceil(bds), cost: boardLen <= 10 ? 12 : 18 });
    }
    extraItems.push({ cat: "Hardware", item: "Joist Hangers (" + label + ")", qty: nJoists * 2, cost: 6 });

    // S60: Zone railing (3 exposed sides)
    var zRailLen;
    if (edge === "right" || edge === "left") {
      zRailLen = 2 * zw + zd;
    } else {
      zRailLen = 2 * zd + zw;
    }
    if (p.railType === "fortress") {
      extraItems.push({ cat: "Railing", item: "Fortress Panels (" + label + ")", qty: Math.ceil(zRailLen / 7), cost: 80 });
      extraItems.push({ cat: "Railing", item: "Fortress Posts (" + label + ")", qty: Math.ceil(zRailLen / 6) + 1, cost: 45 });
    } else {
      extraItems.push({ cat: "Railing", item: "Wood Rail Kit (" + label + ")", qty: Math.ceil(zRailLen / 8), cost: 85 });
    }
  }
  var extraSub = 0;
  for (var j = 0; j < extraItems.length; j++) extraSub += extraItems[j].qty * extraItems[j].cost;

  // S60: Zone railing contribution
  // Each additive zone adds railing on its exposed sides (not the shared edge with main deck)
  var extraRailLen = 0;
  for (var ri = 0; ri < zones.length; ri++) {
    var rz = zones[ri];
    if (rz.type === "cutout") continue;
    var re = rz.attachEdge || "front";
    var rzw = rz.w || 8, rzd = rz.d || 6;
    if (re === "right" || re === "left") {
      // Attached along side edge: 2 new short edges (front+back of zone) + 1 far side edge
      // Main deck loses rz.d from its side railing (net: +2*rzw + rzd - rzd = +2*rzw)
      // But zone may be shorter than main deck side, so just add the 3 exposed sides
      extraRailLen += 2 * rzw + rzd;
    } else {
      // Attached along front/back: 2 new side edges + 1 far front/back edge
      extraRailLen += 2 * rzd + rzw;
    }
  }

  return { totalArea: Math.round(baseCalc.area + addArea - cutArea), extraPosts: extraPosts, extraFootings: extraFootings, extraItems: extraItems, extraSub: extraSub, extraTotal: extraSub * 1.13, zoneCalcs: zoneCalcs, extraRailLen: +extraRailLen.toFixed(1) };
}
// Export to window
window.JOIST_SPANS = JOIST_SPANS;
window.BEAM_SPANS = BEAM_SPANS;
window.getBeamMaxSpan = getBeamMaxSpan;
window.FROST = FROST;
window.SNOW = SNOW;
window.calcStructure = calcStructure;
window.estMaterials = estMaterials;
window.calcAllZones = calcAllZones;
