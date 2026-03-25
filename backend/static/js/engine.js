// ============================================================
// ENGINE Ã¢ÂÂ Structural Calculations + Materials Estimator
// ============================================================

const JOIST_SPANS = {
  50: { "2x6": { 12: 9.5, 16: 8.5, 24: 7 }, "2x8": { 12: 12.5, 16: 11.5, 24: 9.5 }, "2x10": { 12: 16, 16: 14.5, 24: 12 }, "2x12": { 12: 19.5, 16: 17.5, 24: 14.5 } },
  60: { "2x6": { 12: 8.5, 16: 7.5, 24: 6 }, "2x8": { 12: 11, 16: 10, 24: 8.5 }, "2x10": { 12: 14, 16: 12.5, 24: 10.5 }, "2x12": { 12: 17, 16: 15.5, 24: 12.5 } },
  75: { "2x6": { 12: 7.5, 16: 6.5, 24: 5.5 }, "2x8": { 12: 10, 16: 9, 24: 7.5 }, "2x10": { 12: 12.5, 16: 11, 24: 9.5 }, "2x12": { 12: 15, 16: 13.5, 24: 11 } },
  95: { "2x6": { 12: 6.5, 16: 5.5, 24: 4.5 }, "2x8": { 12: 8.5, 16: 7.5, 24: 6.5 }, "2x10": { 12: 11, 16: 9.5, 24: 8 }, "2x12": { 12: 13, 16: 11.5, 24: 9.5 } },
};

const FROST = { warm: 12, moderate: 24, cold: 36, severe: 48 };
const SNOW = { none: 0, light: 20, moderate: 40, heavy: 60 };

function getSpanTable(TL) {
  for (const tier of [50, 60, 75, 95]) { if (TL <= tier) return JOIST_SPANS[tier]; }
  return JOIST_SPANS[95];
}

// S40: Stair-aware post placement helpers
function getStairOpeningOnBeam(p, W, D) {
  if (!p.hasStairs || (p.height || 0) <= 0.5) return null;
  var stairW = p.stairWidth || 4;
  var anchorX;
  if (p.stairAnchorX != null && p.stairAngle != null) {
    // Free-placed mode: only front-exiting stairs (angle~0, near front edge) collide
    if (Math.abs(p.stairAngle % 360) > 5 && Math.abs(p.stairAngle % 360 - 360) > 5) return null;
    if (p.stairAnchorY != null && Math.abs(p.stairAnchorY - D) > 1) return null;
    anchorX = p.stairAnchorX;
  } else {
    if ((p.stairLocation || "front") !== "front") return null;
    anchorX = W / 2 + (p.stairOffset || 0);
  }
  var clearance = 0.25;
  return { left: +Math.max(0, anchorX - stairW / 2 - clearance).toFixed(2), right: +Math.min(W, anchorX + stairW / 2 + clearance).toFixed(2) };
}
function placePostsSmartly(W, nP, stairOpening) {
  var INSET = 2, leftEnd = INSET, rightEnd = W - INSET, MIN_GAP = 1.0;
  if (!stairOpening) {
    var pp = []; for (var i = 0; i < nP; i++) pp.push(+(leftEnd + i * (rightEnd - leftEnd) / (nP - 1)).toFixed(2));
    return { pp: pp, headerSpan: null, stairOpening: null };
  }
  var sL = stairOpening.left, sR = stairOpening.right;
  if (sR <= leftEnd || sL >= rightEnd) {
    var pp = []; for (var i = 0; i < nP; i++) pp.push(+(leftEnd + i * (rightEnd - leftEnd) / (nP - 1)).toFixed(2));
    return { pp: pp, headerSpan: null, stairOpening: stairOpening };
  }
  var openL = +Math.max(sL, leftEnd).toFixed(2), openR = +Math.min(sR, rightEnd).toFixed(2);
  if (openL - leftEnd < MIN_GAP) openL = leftEnd;
  if (rightEnd - openR < MIN_GAP) openR = rightEnd;
  var headerSpan = +(openR - openL).toFixed(2);
  var fixed = [leftEnd]; if (openL !== leftEnd) fixed.push(openL); if (openR !== rightEnd) fixed.push(openR); fixed.push(rightEnd);
  fixed = fixed.filter(function(v,i,a){return a.indexOf(v)===i}).sort(function(a,b){return a-b});
  var targetSpan = (rightEnd - leftEnd) / Math.max(nP - 1, 1);
  var maxSpan = Math.max(Math.min(targetSpan, 8), 4);
  var finalPosts = [];
  for (var seg = 0; seg < fixed.length - 1; seg++) {
    var segL = fixed[seg], segR = fixed[seg + 1], segLen = +(segR - segL).toFixed(2);
    if (finalPosts.length === 0 || Math.abs(finalPosts[finalPosts.length - 1] - segL) > 0.01) finalPosts.push(segL);
    if (Math.abs(segL - openL) < 0.01 && Math.abs(segR - openR) < 0.01) continue;
    if (segLen > maxSpan + 0.1) { var nSub = Math.ceil(segLen / maxSpan), subSp = segLen / nSub; for (var si = 1; si < nSub; si++) finalPosts.push(+(segL + si * subSp).toFixed(2)); }
  }
  var last = fixed[fixed.length - 1];
  if (finalPosts.length === 0 || Math.abs(finalPosts[finalPosts.length - 1] - last) > 0.01) finalPosts.push(last);
  return { pp: finalPosts, headerSpan: headerSpan, stairOpening: { left: openL, right: openR } };
}
function maxBeamSpanFromPosts(pp) {
  var max = 0; for (var i = 1; i < pp.length; i++) { var s = pp[i] - pp[i-1]; if (s > max) max = s; } return +max.toFixed(2);
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
  const LL = 40 + (SNOW[snowLoad] || 0);
  const DL = deckingType === "composite" ? 15 : 12;
  const TL = LL + DL;
  const jSpan = attachment === "ledger" ? D - 1.5 : D / 2 - 0.75;
  const table = getSpanTable(TL);

  // === JOISTS (overridable) ===
  let joistSize = "2x12";
  let joistAuto = true;
  for (const [sz, spans] of Object.entries(table)) { if ((spans[sp] || 0) >= jSpan) { joistSize = sz; break; } }
  const autoJoist = joistSize;
  if (p.overJoist) { joistSize = p.overJoist; joistAuto = false; }

  // === POSTS (S40: stair-aware placement) ===
  let nP = W <= 10 ? 2 : W <= 16 ? 3 : W <= 24 ? 3 : W <= 32 ? 4 : Math.max(4, Math.ceil(W / 10) + 1);
  const autoNP = nP;
  if (p.overPostCount) { nP = p.overPostCount; }

  // S40: Compute stair opening on beam line, place posts around it
  var stairOpening = getStairOpeningOnBeam(p, W, D);
  var postResult = placePostsSmartly(W, nP, stairOpening);
  var pp = postResult.pp;
  var requestedNP = nP; // what user or auto requested before stair adjustment
  nP = pp.length; // actual count after smart placement
  var headerSpan = postResult.headerSpan;
  var stairOpeningResolved = postResult.stairOpening;

  // S40: Beam span from actual max span between posts (not assumed even spacing)
  const bSpan = maxBeamSpanFromPosts(pp);

  // === BEAM (overridable) ===
  let beamSize = "2-ply 2x10";
  if (bSpan > 8 || D > 10) beamSize = "3-ply 2x10";
  if (bSpan > 10 || D > 12) beamSize = "3-ply 2x12";
  if (bSpan > 12) beamSize = "3-ply LVL 1.75x12";
  const autoBeam = beamSize;
  if (p.overBeam) { beamSize = p.overBeam; }

  // === POST SIZE (overridable) ===
  let postSize = "6x6";  // Billy Rule 8: 6x6 minimum per IRC R507.8
  const autoPostSize = postSize;
  if (p.overPostSize) { postSize = p.overPostSize; }

  // S34: Slope-adjusted post heights per position
  var slopePct = (p.slopePercent || 0) / 100;
  var slopeDir = p.slopeDirection || "front-to-back";
  var beamDepth = D - 1.5;
  var postHeights = [];
  for (var hi = 0; hi < nP; hi++) {
    var groundDrop = 0;
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
  if (jSpan > maxSpan) warnings.push(`Joist span (${jSpan.toFixed(1)}') exceeds IRC at ${TL} PSF. Engineering required.`);
  if (H > 10) warnings.push("Height >10'. Lateral bracing by engineer recommended.");
  if (area > 500) warnings.push("Area >500 SF. Check local permit requirements.");

  // Override warnings
  const joistRank = { "2x6": 0, "2x8": 1, "2x10": 2, "2x12": 3 };
  if (p.overJoist && (joistRank[p.overJoist] || 0) < (joistRank[autoJoist] || 0)) {
    warnings.push(`Ã¢Â¬Â Joist override (${p.overJoist}) is smaller than recommended (${autoJoist}). May not meet code.`);
  }
  const beamRank = { "2-ply 2x8": 0, "2-ply 2x10": 1, "2-ply 2x12": 2, "3-ply 2x10": 3, "3-ply 2x12": 4, "3-ply LVL 1.75x12": 5 };
  if (p.overBeam && (beamRank[p.overBeam] || 0) < (beamRank[autoBeam] || 0)) {
    warnings.push(`Ã¢Â¬Â Beam override (${p.overBeam}) is smaller than recommended (${autoBeam}). May not meet code.`);
  }
  if (p.overPostSize === "4x4" && autoPostSize === "6x6") {
    warnings.push(`Ã¢Â¬Â Post override (4x4) is smaller than recommended (6x6). May not meet code.`);
  }
  if (p.overFooting && p.overFooting < autoFDiam) {
    warnings.push(`Ã¢Â¬Â Footing override (${p.overFooting}") is smaller than recommended (${autoFDiam}"). May not meet code.`);
  }
  if (p.overPostCount && p.overPostCount < autoNP) {
    warnings.push(`Ã¢Â¬Â Fewer posts (${p.overPostCount}) than recommended (${autoNP}). May not meet code.`);
  }
  // S40: Warn if stair placement required more posts than requested
  if (headerSpan && nP > requestedNP) {
    warnings.push(`Post count adjusted from ${requestedNP} to ${nP} to clear stair opening. Header posts required at stair edges.`);
  }

  return { W, D, H, area, lotArea, LL, DL, TL, joistSize, sp, jSpan: +jSpan.toFixed(1), nJ, beamSize, bSpan: +bSpan.toFixed(1), postSize, nP, totalPosts, pp, postHeights, fDiam, fDepth, nF: totalPosts, ledgerSize: joistSize, railLen: +railLen.toFixed(1), midSpanBlocking, blockingCount, stairs, warnings, attachment, headerSpan, stairOpening: stairOpeningResolved,
    auto: { joist: autoJoist, beam: autoBeam, postSize: autoPostSize, postCount: autoNP, footing: autoFDiam }
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
    const joistCount = Math.ceil((p.width * 12) / 16) + 1;
    items.push({ cat: "Hardware", item: "Beam Joist Hangers (LUS)", qty: joistCount, cost: 4 });
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
  for (var i = 0; i < zones.length; i++) {
    var z = zones[i];
    var edge = z.attachEdge || "front";
    var zw = z.w || 8, zd = z.d || 6;
    if (z.type === "cutout") { cutArea += zw * zd; continue; }
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
    extraPosts += nPosts; extraFootings += nPosts;
    var label = z.label || ("Zone " + z.id);
    var jL = Math.ceil(jSpan);
    var fD = baseCalc.fDiam, fDp = baseCalc.fDepth;
    var bags = Math.ceil((Math.PI * Math.pow(fD / 24, 2) * (fDp / 12)) / 0.6) * nPosts;
    extraItems.push({ cat: "Foundation", item: "Concrete bags (" + label + ")", qty: bags, cost: 6.5 });
    extraItems.push({ cat: "Foundation", item: "Sonotube (" + label + ")", qty: nPosts, cost: fD > 18 ? 28 : 18 });
    extraItems.push({ cat: "Foundation", item: "Post Base (" + label + ")", qty: nPosts, cost: baseCalc.postSize === "6x6" ? 42 : 28 });
    extraItems.push({ cat: "Posts", item: baseCalc.postSize + " Posts (" + label + ")", qty: nPosts, cost: baseCalc.postSize === "6x6" ? 48 : 24 });
    extraItems.push({ cat: "Posts", item: "Post Caps (" + label + ")", qty: nPosts, cost: baseCalc.postSize === "6x6" ? 38 : 22 });
    var plies = parseInt(baseCalc.beamSize[0]); var isLVL = baseCalc.beamSize.includes("LVL");
    extraItems.push({ cat: "Beam", item: (isLVL ? "LVL" : "PT Beam") + " (" + label + ")", qty: Math.ceil(beamLen / 20) * plies, cost: isLVL ? 95 : 55 });
    extraItems.push({ cat: "Framing", item: baseCalc.joistSize + " Joists " + jL + "' (" + label + ")", qty: nJoists + 2, cost: jL <= 10 ? 22 : jL <= 12 ? 32 : 42 });
    extraItems.push({ cat: "Framing", item: "Rim Joists (" + label + ")", qty: 3, cost: 32 });
    var boardDim = Math.max(zw, zd); var boardLen = Math.ceil(Math.min(zw, zd) + 2);
    var bds = Math.ceil(boardDim / (5.5 / 12)) * 1.1;
    if (p.deckingType === "composite") {
      extraItems.push({ cat: "Decking", item: "Composite " + boardLen + "' (" + label + ")", qty: Math.ceil(bds), cost: boardLen <= 10 ? 28 : 38 });
    } else {
      extraItems.push({ cat: "Decking", item: "5/4x6 PT " + boardLen + "' (" + label + ")", qty: Math.ceil(bds), cost: boardLen <= 10 ? 12 : 18 });
    }
    extraItems.push({ cat: "Hardware", item: "Joist Hangers (" + label + ")", qty: nJoists * 2, cost: 6 });
  }
  var extraSub = 0;
  for (var j = 0; j < extraItems.length; j++) extraSub += extraItems[j].qty * extraItems[j].cost;
  return { totalArea: Math.round(baseCalc.area + addArea - cutArea), extraPosts: extraPosts, extraFootings: extraFootings, extraItems: extraItems, extraSub: extraSub, extraTotal: extraSub * 1.13 };
}
// Export to window
window.JOIST_SPANS = JOIST_SPANS;
window.FROST = FROST;
window.SNOW = SNOW;
window.calcStructure = calcStructure;
window.estMaterials = estMaterials;
window.calcAllZones = calcAllZones;
window.getStairOpeningOnBeam = getStairOpeningOnBeam;
window.placePostsSmartly = placePostsSmartly;
window.maxBeamSpanFromPosts = maxBeamSpanFromPosts;
