// ============================================================
// SITE PLAN VIEW - SVG preview for Step 3 (Site Plan)
// Shows lot boundary, house, deck, setbacks, dimensions
// Added S27, Zone-aware S30, Site elements S31, Stairs S31
// Selected element highlight S31, Drag-drop S32
// ============================================================

window.SitePlanView = function SitePlanView({ p, c, u }) {
  var mono = window.SB.mono;
  var _useRef = React.useRef;
  var _useState = React.useState;

  var svgRef = _useRef(null);
  var dragRef = _useRef(null); // { elId, offsetX, offsetY }
  var [isDragging, setIsDragging] = _useState(false);

  // === LAYOUT (S38: polygon-aware viewport) ===
  var svgW = 540, svgH = 400, margin = 50;
  var lotW = p.lotWidth || 80, lotD = p.lotDepth || 120;

  // Compute polygon verts early so we can size viewport to polygon bounds
  var verts = p.lotVertices || window.computeRectVertices(p);
  var viewW = lotW, viewD = lotD;
  if (p.lotVertices && verts.length > 2) {
    viewW = Math.max.apply(null, verts.map(function(v) { return v[0]; }));
    viewD = Math.max.apply(null, verts.map(function(v) { return v[1]; }));
  }

  var scale = Math.min((svgW - margin * 2) / viewW, (svgH - margin * 2) / viewD);
  var lotPxW = viewW * scale, lotPxH = viewD * scale;
  var ox = (svgW - lotPxW) / 2;
  var oy = (svgH - lotPxH) / 2;

  var sx = function(lx) { return ox + lx * scale; };
  var sy = function(ly) { return oy + lotPxH - ly * scale; };
  var sw = function(w) { return w * scale; };
  var sh = function(h) { return h * scale; };

  // === POLYGON LOT (S36, verts computed above for viewport) ===
  var lotEdgeData = p.lotEdges || window.computeRectEdges(p);
  var nVerts = verts.length;
  var lotPolyPoints = verts.map(function(v) { return sx(v[0]) + "," + sy(v[1]); }).join(" ");


  // Per-edge dimension labels
  var edgeLabels = [];
  (function() {
    var cxL = 0, cyL = 0;
    for (var vi = 0; vi < nVerts; vi++) { cxL += verts[vi][0]; cyL += verts[vi][1]; }
    cxL /= nVerts; cyL /= nVerts;
    for (var ei = 0; ei < nVerts; ei++) {
      var ev1 = verts[ei], ev2 = verts[(ei + 1) % nVerts];
      var eInf = lotEdgeData[ei] || {};
      var eLen = eInf.length || Math.sqrt((ev2[0] - ev1[0]) * (ev2[0] - ev1[0]) + (ev2[1] - ev1[1]) * (ev2[1] - ev1[1]));
      var esx1 = sx(ev1[0]), esy1 = sy(ev1[1]), esx2 = sx(ev2[0]), esy2 = sy(ev2[1]);
      var eMx = (esx1 + esx2) / 2, eMy = (esy1 + esy2) / 2;
      var svgA = Math.atan2(esy2 - esy1, esx2 - esx1) * 180 / Math.PI;
      while (svgA > 90) svgA -= 180;
      while (svgA < -90) svgA += 180;
      var eDx = esx2 - esx1, eDy = esy2 - esy1;
      var eNrm = Math.sqrt(eDx * eDx + eDy * eDy);
      if (eNrm < 1) continue;
      var eNx = -eDy / eNrm, eNy = eDx / eNrm;
      var scxP = sx(cxL), scyP = sy(cyL);
      if (eNx * (eMx - scxP) + eNy * (eMy - scyP) < 0) { eNx = -eNx; eNy = -eNy; }
      var oLx = eMx + eNx * 14, oLy = eMy + eNy * 14;
      var eLbl = eLen % 1 === 0 ? eLen.toFixed(0) + "'" : eLen.toFixed(1) + "'";
      edgeLabels.push(React.createElement("text", {
        key: "edl" + ei, x: oLx, y: oLy, textAnchor: "middle", dominantBaseline: "central",
        transform: "rotate(" + svgA.toFixed(1) + "," + oLx.toFixed(1) + "," + oLy.toFixed(1) + ")",
        style: { fontSize: 8, fill: "#333", fontFamily: mono, fontWeight: 700 }
      }, eLbl));
    }
  })();

  // === SETBACK POLYGON (S36) ===
  var setbackPolyPoints = "";
  var setbackLabels = [];
  (function() {
    var sbDists = [];
    var hasSB = false;
    for (var si = 0; si < nVerts; si++) {
      var eInfo = lotEdgeData[si] || {};
      var sbType = eInfo.setbackType || "side";
      var dist = 0;
      if (sbType === "front") dist = p.setbackFront || 0;
      else if (sbType === "rear") dist = p.setbackRear || 0;
      else if (sbType === "side") dist = p.setbackSide || 0;
      sbDists.push(dist);
      if (dist > 0) hasSB = true;
    }
    if (!hasSB) return;
    var cx = 0, cy = 0;
    for (var si = 0; si < nVerts; si++) { cx += verts[si][0]; cy += verts[si][1]; }
    cx /= nVerts; cy /= nVerts;
    var offsetLines = [];
    for (var si = 0; si < nVerts; si++) {
      var v1 = verts[si], v2 = verts[(si + 1) % nVerts];
      var edx = v2[0] - v1[0], edy = v2[1] - v1[1];
      var elen = Math.sqrt(edx * edx + edy * edy);
      if (elen < 0.01) { offsetLines.push(null); continue; }
      var nx = -edy / elen, ny = edx / elen;
      var mx = (v1[0] + v2[0]) / 2, my = (v1[1] + v2[1]) / 2;
      if (nx * (cx - mx) + ny * (cy - my) < 0) { nx = -nx; ny = -ny; }
      var d = sbDists[si];
      offsetLines.push({ x1: v1[0] + nx * d, y1: v1[1] + ny * d, x2: v2[0] + nx * d, y2: v2[1] + ny * d });
    }
    var sbVerts = [];
    for (var si = 0; si < nVerts; si++) {
      var L1 = offsetLines[si];
      var L2 = offsetLines[(si + 1) % nVerts];
      if (!L1 || !L2) { sbVerts.push(verts[(si + 1) % nVerts]); continue; }
      var x1 = L1.x1, y1 = L1.y1, x2 = L1.x2, y2 = L1.y2;
      var x3 = L2.x1, y3 = L2.y1, x4 = L2.x2, y4 = L2.y2;
      var denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(denom) < 0.001) { sbVerts.push([(x2 + x3) / 2, (y2 + y3) / 2]); continue; }
      var t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
      sbVerts.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)]);
    }
    setbackPolyPoints = sbVerts.map(function(v) { return sx(v[0]) + "," + sy(v[1]); }).join(" ");
    for (var si = 0; si < nVerts; si++) {
      if (sbDists[si] <= 0) continue;
      var eInfo = lotEdgeData[si] || {};
      var sbType = eInfo.setbackType || "side";
      var v1 = verts[si], v2 = verts[(si + 1) % nVerts];
      var emx = (v1[0] + v2[0]) / 2, emy = (v1[1] + v2[1]) / 2;
      var edx = v2[0] - v1[0], edy = v2[1] - v1[1];
      var elen = Math.sqrt(edx * edx + edy * edy);
      if (elen < 1) continue;
      var nx = -edy / elen, ny = edx / elen;
      if (nx * (cx - emx) + ny * (cy - emy) < 0) { nx = -nx; ny = -ny; }
      var lx = emx + nx * sbDists[si] * 0.5;
      var ly = emy + ny * sbDists[si] * 0.5;
      var slx = sx(lx), sly = sy(ly);
      var svgA = Math.atan2(sy(v2[1]) - sy(v1[1]), sx(v2[0]) - sx(v1[0])) * 180 / Math.PI;
      while (svgA > 90) svgA -= 180;
      while (svgA < -90) svgA += 180;
      setbackLabels.push(React.createElement("text", {
        key: "sbl" + si, x: slx, y: sly, textAnchor: "middle", dominantBaseline: "central",
        transform: "rotate(" + svgA.toFixed(1) + "," + slx.toFixed(1) + "," + sly.toFixed(1) + ")",
        style: { fontSize: 7, fill: "#e53935", fontFamily: mono, opacity: 0.7 }
      }, sbDists[si] + "' " + sbType + " setback"));
    }
  })();

  // === COORDINATE CONVERSION (S32: for drag-drop) ===
  function clientToLot(clientX, clientY) {
    var svg = svgRef.current;
    if (!svg) return null;
    var pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return null;
    var svgPt = pt.matrixTransform(ctm.inverse());
    return {
      x: (svgPt.x - ox) / scale,
      y: (oy + lotPxH - svgPt.y) / scale
    };
  }

  // === DRAG HANDLERS (S32) ===
  var elems = p.siteElements || [];

  function onElPointerDown(e, el) {
    if (!u) return;
    e.preventDefault();
    e.stopPropagation();
    var cX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    var cY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (cX == null) return;
    var lot = clientToLot(cX, cY);
    if (!lot) return;
    dragRef.current = {
      elId: el.id,
      offsetX: lot.x - el.x,
      offsetY: lot.y - el.y
    };
    setIsDragging(true);
    // Also select this element
    if (u) u("_selectedElId", el.id);
  }

  // S37 Push 6.5: House drag handler
  function onHousePointerDown(e) {
    if (!u) return;
    e.preventDefault();
    e.stopPropagation();
    var cX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    var cY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (cX == null) return;
    var lot = clientToLot(cX, cY);
    if (!lot) return;
    dragRef.current = {
      type: "house",
      offsetX: lot.x - hx,
      offsetY: lot.y - hy
    };
    setIsDragging(true);
  }

  function onSvgPointerMove(e) {
    if (!dragRef.current || !u) return;
    e.preventDefault();
    var cX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    var cY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (cX == null) return;
    var lot = clientToLot(cX, cY);
    if (!lot) return;
    var dr = dragRef.current;
    if (dr.type === "house") {
      var newHX = Math.round(Math.max(0, Math.min(viewW - hw, lot.x - dr.offsetX)));
      var newHY = Math.round(Math.max(0, Math.min(viewD - hd, lot.y - dr.offsetY)));
      if (newHX !== hx || newHY !== hy) {
        u("houseOffsetSide", newHX);
        u("houseDistFromStreet", newHY);
      }
    } else {
      var el = elems.find(function(e) { return e.id === dr.elId; });
      if (!el) return;
      var newX = Math.round(Math.max(0, Math.min(viewW - el.w, lot.x - dr.offsetX)));
      var newY = Math.round(Math.max(0, Math.min(viewD - el.d, lot.y - dr.offsetY)));
      if (newX !== el.x || newY !== el.y) {
        u("siteElements", elems.map(function(e) {
          if (e.id !== dr.elId) return e;
          return Object.assign({}, e, { x: newX, y: newY });
        }));
      }
    }
  }

  function onSvgPointerUp(e) {
    if (dragRef.current) {
      dragRef.current = null;
      setIsDragging(false);
    }
  }

  // === HOUSE ===
  var hx = p.houseOffsetSide || 20;
  var hy = p.houseDistFromStreet || p.setbackFront || 25;
  var hw = p.houseWidth || 40;
  var hd = p.houseDepth || 30;

  // === DECK ===
  var deckCX = hx + hw / 2 + (p.deckOffset || 0);
  var dw = p.width || 20, dd = p.depth || 12;
  var dx = deckCX - dw / 2;
  var dy = hy + hd;

  // === ZONE-AWARE DECK (S30) ===
  var pz = Object.assign({}, p, { deckWidth: dw, deckDepth: dd, deckHeight: p.height || 4 });
  var addRects = window.getAdditiveRects ? window.getAdditiveRects(pz) : [];
  var cutRects = window.getCutoutRects ? window.getCutoutRects(pz) : [];
  var bb = window.getBoundingBox ? window.getBoundingBox(pz) : { x: 0, y: 0, w: dw, d: dd };
  var hasZones = (p.zones || []).length > 0;
  var bbLx = dx + bb.x, bbLy = dy + bb.y, bbW = bb.w, bbD = bb.d;
  var totalArea = addRects.reduce(function(s, r) { return s + r.rect.w * r.rect.d; }, 0)
                - cutRects.reduce(function(s, r) { return s + r.rect.w * r.rect.d; }, 0);

  // === SETBACKS ===
  var sbF = p.setbackFront || 0;
  var sbR = p.setbackRear || 0;
  var sbS = p.setbackSide || 0;

  // === STAIR PROJECTION (S31) ===
  var stairEls = [];
  if (p.hasStairs && p.height > 0) {
    var riseIn = 7.5, treadIn = 10;
    var nRisers = Math.ceil((p.height || 4) * 12 / riseIn);
    var stairRun = (nRisers - 1) * treadIn / 12;
    var stW = p.stairWidth || 4;
    var stOff = p.stairOffset || 0;
    var loc = p.stairLocation || "front";
    var landD = p.hasLanding ? 4 : 0;
    var stX, stY, stDrawW, stDrawD;

    if (loc === "front") {
      stX = dx + dw / 2 + stOff - stW / 2;
      stY = dy + dd;
      stDrawW = stW;
      stDrawD = stairRun + landD;
    } else if (loc === "left") {
      stX = dx - stairRun - landD;
      stY = dy + dd / 2 + stOff - stW / 2;
      stDrawW = stairRun + landD;
      stDrawD = stW;
    } else {
      stX = dx + dw;
      stY = dy + dd / 2 + stOff - stW / 2;
      stDrawW = stairRun + landD;
      stDrawD = stW;
    }

    stairEls.push(React.createElement("rect", {
      key: "stair", x: sx(stX), y: sy(stY + stDrawD),
      width: sw(stDrawW), height: sh(stDrawD),
      fill: "#e8d5b7", fillOpacity: 0.5, stroke: "#8B7355", strokeWidth: 0.8, strokeDasharray: "3,2"
    }));

    var numLines = Math.min(8, nRisers - 1);
    if (loc === "front" && sh(stDrawD) > 10) {
      for (var ti = 1; ti <= numLines; ti++) {
        var tFrac = ti / (numLines + 1);
        var tY = stY + tFrac * stairRun;
        stairEls.push(React.createElement("line", {
          key: "tread" + ti,
          x1: sx(stX + 0.3), y1: sy(tY), x2: sx(stX + stW - 0.3), y2: sy(tY),
          stroke: "#8B7355", strokeWidth: 0.4, opacity: 0.5
        }));
      }
    } else if (loc === "left" && sw(stDrawW) > 10) {
      for (var ti = 1; ti <= numLines; ti++) {
        var tFrac = ti / (numLines + 1);
        var tX = stX + stDrawW - tFrac * stairRun;
        stairEls.push(React.createElement("line", {
          key: "tread" + ti,
          x1: sx(tX), y1: sy(stY + 0.3), x2: sx(tX), y2: sy(stY + stW - 0.3),
          stroke: "#8B7355", strokeWidth: 0.4, opacity: 0.5
        }));
      }
    } else if (loc === "right" && sw(stDrawW) > 10) {
      for (var ti = 1; ti <= numLines; ti++) {
        var tFrac = ti / (numLines + 1);
        var tX = stX + tFrac * stairRun;
        stairEls.push(React.createElement("line", {
          key: "tread" + ti,
          x1: sx(tX), y1: sy(stY + 0.3), x2: sx(tX), y2: sy(stY + stW - 0.3),
          stroke: "#8B7355", strokeWidth: 0.4, opacity: 0.5
        }));
      }
    }

    var labelX = stX + stDrawW / 2;
    var labelY = stY + stDrawD / 2;
    if (sh(stDrawD) > 10 && sw(stDrawW) > 14) {
      stairEls.push(React.createElement("text", {
        key: "stlbl", x: sx(labelX), y: sy(labelY) + 3, textAnchor: "middle",
        style: { fontSize: 6, fill: "#8B7355", fontFamily: mono, fontWeight: 700 }
      }, "STAIRS"));
    }

    if (p.hasLanding && landD > 0) {
      var lx, ly, lw, ld;
      if (loc === "front") {
        lx = stX; ly = stY + stairRun; lw = stW; ld = landD;
      } else if (loc === "left") {
        lx = stX; ly = stY; lw = landD; ld = stW;
      } else {
        lx = stX + stairRun; ly = stY; lw = landD; ld = stW;
      }
      stairEls.push(React.createElement("rect", {
        key: "landing", x: sx(lx), y: sy(ly + ld),
        width: sw(lw), height: sh(ld),
        fill: "#d5c4a1", fillOpacity: 0.4, stroke: "#8B7355", strokeWidth: 0.6, strokeDasharray: "2,2"
      }));
    }

    if (loc === "front" && sh(stDrawD) > 6) {
      stairEls.push(React.createElement("text", {
        key: "strun", x: sx(stX + stDrawW) + 4, y: sy(stY + stDrawD / 2) + 3, textAnchor: "start",
        style: { fontSize: 6, fill: "#8B7355", fontFamily: mono, fontWeight: 600 }
      }, stairRun.toFixed(1) + "'"));
    }
  }

  // === DISTANCES (bounding box, S30) ===
  var rearGap = viewD - (bbLy + bbD);
  var leftGap = bbLx;
  var rightGap = viewW - (bbLx + bbW);
  var rearWarn = rearGap < sbR;
  var leftWarn = leftGap < sbS;
  var rightWarn = rightGap < sbS;
  var _isLarge = Math.max(viewW, viewD) > 240;

  // === SCALE BAR ===
  var sbFt = viewW > 150 ? 50 : viewW > 60 ? 20 : 10;
  var sbPx = sbFt * scale;

  // === DIMENSION ARROW HELPER ===
  function DimLine(props) {
    var x1 = props.x1, y1 = props.y1, x2 = props.x2, y2 = props.y2;
    var label = props.label, color = props.color || "#1565c0", side = props.side || "mid";
    var isH = Math.abs(y2 - y1) < 2;
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    var tx = isH ? mx : (side === "left" ? Math.min(x1, x2) - 4 : x1 + 4);
    var ty = isH ? (side === "above" ? Math.min(y1, y2) - 4 : my + 3) : my + 3;
    var anchor = isH ? "middle" : (side === "left" ? "end" : "start");
    return React.createElement("g", null,
      React.createElement("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: color, strokeWidth: 0.7, strokeDasharray: "3,2" }),
      React.createElement("text", { x: tx, y: ty, textAnchor: anchor, style: { fontSize: 7, fill: color, fontFamily: mono, fontWeight: 700 } }, label)
    );
  }

  // === BUILD DECK ELEMENTS (S30) ===
  var deckEls = [];
  if (addRects.length > 0) {
    addRects.forEach(function(ar) {
      var r = ar.rect;
      deckEls.push(React.createElement("rect", { key: "a" + ar.id, x: sx(dx + r.x), y: sy(dy + r.y + r.d), width: sw(r.w), height: sh(r.d), fill: "#d4e6c3", stroke: "#3d5a2e", strokeWidth: 1.5 }));
    });
    cutRects.forEach(function(cr) {
      var r = cr.rect;
      deckEls.push(React.createElement("rect", { key: "c" + cr.id, x: sx(dx + r.x), y: sy(dy + r.y + r.d), width: sw(r.w), height: sh(r.d), fill: "#fafaf5", stroke: "#3d5a2e", strokeWidth: 1, strokeDasharray: "4,2" }));
    });
  } else {
    deckEls.push(React.createElement("rect", { key: "d0", x: sx(dx), y: sy(dy + dd), width: sw(dw), height: sh(dd), fill: "#d4e6c3", stroke: "#3d5a2e", strokeWidth: 1.5 }));
  }
  if (p.attachment === "ledger") {
    deckEls.push(React.createElement("line", { key: "ldg", x1: sx(dx), y1: sy(dy), x2: sx(dx + dw), y2: sy(dy), stroke: "#2e7d32", strokeWidth: 2.5 }));
  }
  if (sh(bbD) > 16) {
    deckEls.push(React.createElement("text", { key: "dlbl", x: sx(bbLx + bbW / 2), y: sy(bbLy + bbD / 2) + 3, textAnchor: "middle", style: { fontSize: 8, fill: "#3d5a2e", fontFamily: mono, fontWeight: 700 } }, "PROPOSED DECK"));
  }
  if (sh(bbD) > 28) {
    var dimLabel = hasZones ? totalArea.toFixed(0) + " S.F." : dw + "' x " + dd + "'";
    deckEls.push(React.createElement("text", { key: "ddim", x: sx(bbLx + bbW / 2), y: sy(bbLy + bbD / 2) + 13, textAnchor: "middle", style: { fontSize: 7, fill: "#5a7a4a", fontFamily: mono } }, dimLabel));
  }

  // === SITE ELEMENTS (S31 + S32 drag) ===
  var siteEls = [];
  var selId = p._selectedElId;
  var elFills = { driveway: "#d5d5d5", shed: "#d4c5a9", garage: "#e0d8cc", ac_unit: "#c0c0c0", patio: "#d7ccc8", walkway: "#e0e0e0" };
  var dragCursor = isDragging ? "grabbing" : (u ? "grab" : "default");

  elems.forEach(function(el, idx) {
    var ex = el.x, ey = el.y, ew = el.w, ed = el.d;
    var isSel = selId === el.id;
    var dragProps = u ? { onMouseDown: function(e) { onElPointerDown(e, el); }, onTouchStart: function(e) { onElPointerDown(e, el); }, style: { cursor: dragCursor } } : {};

    if (el.type === "tree") {
      var r = ew / 2;
      siteEls.push(React.createElement("circle", Object.assign({ key: "el" + idx, cx: sx(ex + r), cy: sy(ey + r), r: sw(r), fill: "#8bc34a", fillOpacity: 0.35, stroke: isSel ? "#2563eb" : "#558b2f", strokeWidth: isSel ? 2 : 0.8 }, dragProps)));
      siteEls.push(React.createElement("circle", { key: "eld" + idx, cx: sx(ex + r), cy: sy(ey + r), r: 1.5, fill: "#33691e", pointerEvents: "none" }));
      if (isSel) {
        siteEls.push(React.createElement("circle", { key: "elsel" + idx, cx: sx(ex + r), cy: sy(ey + r), r: sw(r) + 4, fill: "none", stroke: "#2563eb", strokeWidth: 1.5, strokeDasharray: "4,2", pointerEvents: "none" }));
      }
    } else if (el.type === "pool") {
      siteEls.push(React.createElement("rect", Object.assign({ key: "el" + idx, x: sx(ex), y: sy(ey + ed), width: sw(ew), height: sh(ed), fill: "#b3d9ff", fillOpacity: 0.45, stroke: isSel ? "#2563eb" : "#1976d2", strokeWidth: isSel ? 2 : 0.8, rx: sw(Math.min(2, ew / 4)) }, dragProps)));
      if (isSel) {
        siteEls.push(React.createElement("rect", { key: "elsel" + idx, x: sx(ex) - 3, y: sy(ey + ed) - 3, width: sw(ew) + 6, height: sh(ed) + 6, fill: "none", stroke: "#2563eb", strokeWidth: 1.5, strokeDasharray: "4,2", rx: 3, pointerEvents: "none" }));
      }
    } else if (el.type === "fence") {
      siteEls.push(React.createElement("rect", Object.assign({ key: "el" + idx, x: sx(ex), y: sy(ey + ed), width: Math.max(sw(ew), 1.5), height: Math.max(sh(ed), 1.5), fill: "#8d6e63", fillOpacity: 0.6, stroke: isSel ? "#2563eb" : "#5d4037", strokeWidth: isSel ? 2 : 0.8, strokeDasharray: isSel ? "none" : "3,1.5" }, dragProps)));
      if (isSel) {
        siteEls.push(React.createElement("rect", { key: "elsel" + idx, x: sx(ex) - 3, y: sy(ey + ed) - 3, width: Math.max(sw(ew), 1.5) + 6, height: Math.max(sh(ed), 1.5) + 6, fill: "none", stroke: "#2563eb", strokeWidth: 1.5, strokeDasharray: "4,2", rx: 2, pointerEvents: "none" }));
      }
    } else {
      siteEls.push(React.createElement("rect", Object.assign({ key: "el" + idx, x: sx(ex), y: sy(ey + ed), width: sw(ew), height: sh(ed), fill: elFills[el.type] || "#ddd", fillOpacity: 0.5, stroke: isSel ? "#2563eb" : "#888", strokeWidth: isSel ? 2 : 0.8 }, dragProps)));
      if (isSel) {
        siteEls.push(React.createElement("rect", { key: "elsel" + idx, x: sx(ex) - 3, y: sy(ey + ed) - 3, width: sw(ew) + 6, height: sh(ed) + 6, fill: "none", stroke: "#2563eb", strokeWidth: 1.5, strokeDasharray: "4,2", rx: 2, pointerEvents: "none" }));
      }
    }
    if ((el.type === "shed" || el.type === "garage") && !isSel) {
      siteEls.push(React.createElement("rect", { key: "elh" + idx, x: sx(ex), y: sy(ey + ed), width: sw(ew), height: sh(ed), fill: "url(#spHatch)", opacity: 0.4, pointerEvents: "none" }));
    }
    if (el.label && sh(ed) > 8 && sw(ew) > 12) {
      siteEls.push(React.createElement("text", { key: "elt" + idx, x: sx(ex + ew / 2), y: sy(ey + ed / 2) + 3, textAnchor: "middle", pointerEvents: "none", style: { fontSize: 6, fill: isSel ? "#2563eb" : "#555", fontFamily: mono, fontWeight: 600 } }, el.label));
    }
  });

  // === SVG EVENT PROPS (S32) ===
  var svgEvents = {};
  if (u) {
    svgEvents.onMouseMove = onSvgPointerMove;
    svgEvents.onMouseUp = onSvgPointerUp;
    svgEvents.onMouseLeave = onSvgPointerUp;
    svgEvents.onTouchMove = onSvgPointerMove;
    svgEvents.onTouchEnd = onSvgPointerUp;
    svgEvents.onTouchCancel = onSvgPointerUp;
  }

  return React.createElement("svg", Object.assign({
    ref: svgRef,
    viewBox: "0 0 " + svgW + " " + svgH,
    style: { width: "100%", height: "100%", minHeight: 320, touchAction: isDragging ? "none" : "auto" }
  }, svgEvents),

    React.createElement("rect", { x: 0, y: 0, width: svgW, height: svgH, fill: "#fafaf5", rx: 4 }),

    setbackPolyPoints ? React.createElement("polygon", {
      points: setbackPolyPoints,
      fill: "none", stroke: "#e53935", strokeWidth: 0.8, strokeDasharray: "6,4", opacity: 0.5
    }) : null,

    React.createElement("polygon", { points: lotPolyPoints, fill: "none", stroke: "#333", strokeWidth: 2 }),

    React.createElement("defs", null,
      React.createElement("pattern", { id: "spHatch", patternUnits: "userSpaceOnUse", width: 6, height: 6, patternTransform: "rotate(45)" },
        React.createElement("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "#ccc", strokeWidth: 0.5 })
      )
    ),
    React.createElement("rect", { x: sx(hx), y: sy(hy + hd), width: sw(hw), height: sh(hd), fill: "#e8e6e0", stroke: "#666", strokeWidth: 1.2, onMouseDown: function(e) { onHousePointerDown(e); }, onTouchStart: function(e) { onHousePointerDown(e); }, style: { cursor: isDragging ? "grabbing" : "grab" } }),
    React.createElement("rect", { x: sx(hx), y: sy(hy + hd), width: sw(hw), height: sh(hd), fill: "url(#spHatch)", pointerEvents: "none" }),
    sh(hd) > 20 ? React.createElement("text", { x: sx(hx + hw / 2), y: sy(hy + hd / 2) + 3, textAnchor: "middle", style: { fontSize: 8, fill: "#666", fontFamily: mono, fontWeight: 600 } }, "EXISTING HOUSE") : null,
    !_isLarge && sh(hd) > 30 ? React.createElement("text", { x: sx(hx + hw / 2), y: sy(hy + hd / 2) + 13, textAnchor: "middle", style: { fontSize: 7, fill: "#888", fontFamily: mono } }, hw + "' x " + hd + "'") : null,

    React.createElement("g", null, siteEls),

    React.createElement("g", null, deckEls),

    React.createElement("g", null, stairEls),

    !_isLarge && rearGap > 0 ? React.createElement(DimLine, { x1: sx(bbLx + bbW / 2), y1: sy(bbLy + bbD), x2: sx(bbLx + bbW / 2), y2: sy(lotD), label: rearGap.toFixed(1) + "'", color: rearWarn ? "#e53935" : "#1565c0" }) : null,
    !_isLarge && leftGap > 0 && sw(leftGap) > 12 ? React.createElement(DimLine, { x1: sx(0), y1: sy(bbLy + bbD / 2), x2: sx(bbLx), y2: sy(bbLy + bbD / 2), label: leftGap.toFixed(1) + "'", color: leftWarn ? "#e53935" : "#1565c0", side: "above" }) : null,
    !_isLarge && rightGap > 0 && sw(rightGap) > 12 ? React.createElement(DimLine, { x1: sx(bbLx + bbW), y1: sy(bbLy + bbD / 2), x2: sx(lotW), y2: sy(bbLy + bbD / 2), label: rightGap.toFixed(1) + "'", color: rightWarn ? "#e53935" : "#1565c0", side: "above" }) : null,

    React.createElement("g", null, setbackLabels),

    React.createElement("g", null, edgeLabels),

    // S37 Push 6: Neighbor labels + street edge styling
    (() => {
      var lotEdges = p.lotEdges || window.computeRectEdges(p);
      var els = [];
      var cx = 0, cy = 0;
      for (var vi = 0; vi < nVerts; vi++) { cx += verts[vi][0]; cy += verts[vi][1]; }
      cx /= nVerts; cy /= nVerts;
      for (var ei = 0; ei < nVerts; ei++) {
        var eInf = lotEdges[ei] || {};
        var v1 = verts[ei], v2 = verts[(ei + 1) % nVerts];
        var esx1 = sx(v1[0]), esy1 = sy(v1[1]), esx2 = sx(v2[0]), esy2 = sy(v2[1]);
        var eMx = (esx1 + esx2) / 2, eMy = (esy1 + esy2) / 2;
        // Street edge: thicker overlay line
        if (eInf.type === "street") {
          els.push(React.createElement("line", {
            key: "st" + ei, x1: esx1, y1: esy1, x2: esx2, y2: esy2,
            stroke: "#555", strokeWidth: 3.5, strokeLinecap: "round"
          }));
        }
        // Neighbor label (property edges with neighborLabel set)
        var nlbl = eInf.neighborLabel || "";
        if (nlbl) {
          var edx = esx2 - esx1, edy = esy2 - esy1;
          var enrm = Math.sqrt(edx * edx + edy * edy);
          if (enrm < 1) continue;
          var enx = -edy / enrm, eny = edx / enrm;
          var scxP = sx(cx), scyP = sy(cy);
          if (enx * (eMx - scxP) + eny * (eMy - scyP) < 0) { enx = -enx; eny = -eny; }
          var nlx = eMx + enx * 28, nly = eMy + eny * 28;
          var svgA = Math.atan2(esy2 - esy1, esx2 - esx1) * 180 / Math.PI;
          while (svgA > 90) svgA -= 180;
          while (svgA < -90) svgA += 180;
          els.push(React.createElement("text", {
            key: "nl" + ei, x: nlx, y: nly, textAnchor: "middle", dominantBaseline: "central",
            transform: "rotate(" + svgA.toFixed(1) + "," + nlx.toFixed(1) + "," + nly.toFixed(1) + ")",
            style: { fontSize: 7, fill: "#888", fontFamily: mono, fontWeight: 600, fontStyle: "italic" }
          }, nlbl.toUpperCase()));
        }
      }
      return React.createElement("g", null, els);
    })(),

    // S37 Push 6: Street name from lotEdges (first street-type edge, or fallback)
    (() => {
      var streetLabel = "";
      var lotEdges = p.lotEdges || window.computeRectEdges(p);
      for (var sei = 0; sei < lotEdges.length; sei++) {
        if (lotEdges[sei].type === "street" && lotEdges[sei].label) {
          streetLabel = lotEdges[sei].label; break;
        }
      }
      if (!streetLabel) streetLabel = p.streetName || "STREET";
      return React.createElement("text", { x: sx(viewW / 2), y: oy + lotPxH + 30, textAnchor: "middle", style: { fontSize: 8, fill: "#999", fontFamily: mono, letterSpacing: 2 } }, streetLabel.toUpperCase());
    })(),

    React.createElement("g", { transform: "translate(" + (ox + lotPxW + 14) + "," + (oy + 8) + ") rotate(" + (p.northAngle || 0) + ",0,10)" },
      React.createElement("line", { x1: 0, y1: 20, x2: 0, y2: 0, stroke: "#333", strokeWidth: 1.2 }),
      React.createElement("polygon", { points: "-4,6 0,0 4,6", fill: "#333" }),
      React.createElement("text", { x: 0, y: -4, textAnchor: "middle", style: { fontSize: 8, fill: "#333", fontFamily: mono, fontWeight: 700 } }, "N")
    ),

    // S33: Grade arrow (slope notation)
    (p.slopePercent || 0) > 0 ? React.createElement("g", {
      transform: "translate(" + (ox + lotPxW - 40) + "," + (oy + lotPxH - 20) + ")"
    },
      (() => {
        var dir = p.slopeDirection || "front-to-back";
        var dx2 = 0, dy2 = 0;
        if (dir === "front-to-back") { dx2 = 0; dy2 = -24; }
        else if (dir === "back-to-front") { dx2 = 0; dy2 = 24; }
        else if (dir === "left-to-right") { dx2 = 24; dy2 = 0; }
        else if (dir === "right-to-left") { dx2 = -24; dy2 = 0; }
        var len = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        var ux = dx2 / len, uy = dy2 / len;
        var tipX = dx2, tipY = dy2;
        var a1x = tipX - ux * 5 - uy * 3, a1y = tipY - uy * 5 + ux * 3;
        var a2x = tipX - ux * 5 + uy * 3, a2y = tipY - uy * 5 - ux * 3;
        return [
          React.createElement("line", { key: "gs", x1: 0, y1: 0, x2: dx2, y2: dy2, stroke: "#8B7355", strokeWidth: 1.5 }),
          React.createElement("polygon", { key: "ga", points: tipX + "," + tipY + " " + a1x + "," + a1y + " " + a2x + "," + a2y, fill: "#8B7355" }),
          React.createElement("text", { key: "gl", x: dx2 / 2 + (dy2 === 0 ? 0 : 10), y: dy2 / 2 + (dx2 === 0 ? 0 : -6), textAnchor: "middle", style: { fontSize: 7, fill: "#8B7355", fontFamily: mono, fontWeight: 700 } }, (p.slopePercent || 0) + "% DN"),
          React.createElement("text", { key: "gt", x: dx2 / 2 + (dy2 === 0 ? 0 : 10), y: dy2 / 2 + (dx2 === 0 ? 0 : -6) + 9, textAnchor: "middle", style: { fontSize: 6, fill: "#8B7355", fontFamily: mono, fontStyle: "italic" } }, "GRADE")
        ];
      })()
    ) : null,

    React.createElement("g", { transform: "translate(" + ox + "," + (oy + lotPxH + 38) + ")" },
      React.createElement("line", { x1: 0, y1: 0, x2: sbPx, y2: 0, stroke: "#333", strokeWidth: 1 }),
      React.createElement("line", { x1: 0, y1: -3, x2: 0, y2: 3, stroke: "#333", strokeWidth: 1 }),
      React.createElement("line", { x1: sbPx, y1: -3, x2: sbPx, y2: 3, stroke: "#333", strokeWidth: 1 }),
      React.createElement("text", { x: sbPx / 2, y: 11, textAnchor: "middle", style: { fontSize: 7, fill: "#666", fontFamily: mono } }, sbFt + "'")
    ),

    // Drag hint (S32)
    !isDragging ? React.createElement("text", {
      x: svgW / 2, y: svgH - 6, textAnchor: "middle",
      style: { fontSize: 7, fill: "#aaa", fontFamily: mono, fontStyle: "italic" }
    }, "Drag house or elements to reposition") : null
  );
};
