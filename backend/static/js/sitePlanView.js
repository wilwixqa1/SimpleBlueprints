// ============================================================
// SITE PLAN VIEW â SVG preview for Step 3 (Site Plan)
// Shows lot boundary, house, deck, setbacks, dimensions
// Added S27
// ============================================================

window.SitePlanView = function SitePlanView({ p, c }) {
  var mono = window.SB.mono;

  // === LAYOUT ===
  var svgW = 540, svgH = 400, margin = 50;
  var lotW = p.lotWidth || 80, lotD = p.lotDepth || 120;

  // Auto-scale lot to fit SVG
  var scale = Math.min((svgW - margin * 2) / lotW, (svgH - margin * 2) / lotD);
  var lotPxW = lotW * scale, lotPxH = lotD * scale;
  var ox = (svgW - lotPxW) / 2;
  var oy = (svgH - lotPxH) / 2;

  // Lot coords (x from left, y from front/street) to SVG coords (street at bottom)
  var sx = function(lx) { return ox + lx * scale; };
  var sy = function(ly) { return oy + lotPxH - ly * scale; };
  var sw = function(w) { return w * scale; };
  var sh = function(h) { return h * scale; };

  // === HOUSE ===
  var hx = p.houseOffsetSide || 20;
  var hy = p.houseDistFromStreet || p.setbackFront || 25;
  var hw = p.houseWidth || 40;
  var hd = p.houseDepth || 30;

  // === DECK ===
  var deckCX = hx + hw / 2 + (p.deckOffset || 0);
  var dw = p.width || 20, dd = p.depth || 12;
  var dx = deckCX - dw / 2;
  var dy = hy + hd; // deck starts at rear of house

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

  // === DISTANCES (bounding box, S30) ===
  var rearGap = lotD - (bbLy + bbD);
  var leftGap = bbLx;
  var rightGap = lotW - (bbLx + bbW);
  var rearWarn = rearGap < sbR;
  var leftWarn = leftGap < sbS;
  var rightWarn = rightGap < sbS;

  // === SCALE BAR ===
  var sbFt = lotW > 150 ? 50 : lotW > 60 ? 20 : 10;
  var sbPx = sbFt * scale;

  // === DIMENSION ARROW HELPER ===
  // Draws a dimension line with text between two SVG points
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

  return React.createElement("svg", { viewBox: "0 0 " + svgW + " " + svgH, style: { width: "100%", height: "100%", minHeight: 320 } },

    // Background
    React.createElement("rect", { x: 0, y: 0, width: svgW, height: svgH, fill: "#fafaf5", rx: 4 }),

    // === SETBACK ZONE (buildable area) ===
    sbF + sbR + sbS > 0 ? React.createElement("rect", {
      x: sx(sbS), y: sy(lotD - sbR), width: sw(lotW - sbS * 2), height: sh(lotD - sbF - sbR),
      fill: "none", stroke: "#e53935", strokeWidth: 0.8, strokeDasharray: "6,4", opacity: 0.5
    }) : null,

    // === PROPERTY LINES ===
    React.createElement("rect", { x: ox, y: oy, width: lotPxW, height: lotPxH, fill: "none", stroke: "#333", strokeWidth: 2 }),

    // === HOUSE FOOTPRINT ===
    React.createElement("defs", null,
      React.createElement("pattern", { id: "spHatch", patternUnits: "userSpaceOnUse", width: 6, height: 6, patternTransform: "rotate(45)" },
        React.createElement("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "#ccc", strokeWidth: 0.5 })
      )
    ),
    React.createElement("rect", { x: sx(hx), y: sy(hy + hd), width: sw(hw), height: sh(hd), fill: "#e8e6e0", stroke: "#666", strokeWidth: 1.2 }),
    React.createElement("rect", { x: sx(hx), y: sy(hy + hd), width: sw(hw), height: sh(hd), fill: "url(#spHatch)" }),
    sh(hd) > 20 ? React.createElement("text", { x: sx(hx + hw / 2), y: sy(hy + hd / 2) + 3, textAnchor: "middle", style: { fontSize: 8, fill: "#666", fontFamily: mono, fontWeight: 600 } }, "EXISTING HOUSE") : null,
    sh(hd) > 30 ? React.createElement("text", { x: sx(hx + hw / 2), y: sy(hy + hd / 2) + 13, textAnchor: "middle", style: { fontSize: 7, fill: "#888", fontFamily: mono } }, hw + "' x " + hd + "'") : null,

    // === DECK FOOTPRINT (zone-aware, S30) ===
    React.createElement("g", null, deckEls),

    // === DIMENSION LINES: deck bounding box to property lines (S30) ===
    rearGap > 0 ? React.createElement(DimLine, { x1: sx(bbLx + bbW / 2), y1: sy(bbLy + bbD), x2: sx(bbLx + bbW / 2), y2: sy(lotD), label: rearGap.toFixed(1) + "'", color: rearWarn ? "#e53935" : "#1565c0" }) : null,
    leftGap > 0 && sw(leftGap) > 12 ? React.createElement(DimLine, { x1: sx(0), y1: sy(bbLy + bbD / 2), x2: sx(bbLx), y2: sy(bbLy + bbD / 2), label: leftGap.toFixed(1) + "'", color: leftWarn ? "#e53935" : "#1565c0", side: "above" }) : null,
    rightGap > 0 && sw(rightGap) > 12 ? React.createElement(DimLine, { x1: sx(bbLx + bbW), y1: sy(bbLy + bbD / 2), x2: sx(lotW), y2: sy(bbLy + bbD / 2), label: rightGap.toFixed(1) + "'", color: rightWarn ? "#e53935" : "#1565c0", side: "above" }) : null,

    // === SETBACK LABELS ===
    sbF > 0 ? React.createElement("text", { x: sx(lotW / 2), y: sy(sbF) + 12, textAnchor: "middle", style: { fontSize: 7, fill: "#e53935", fontFamily: mono, opacity: 0.7 } }, sbF + "' front setback") : null,
    sbR > 0 ? React.createElement("text", { x: sx(lotW / 2), y: sy(lotD - sbR) - 4, textAnchor: "middle", style: { fontSize: 7, fill: "#e53935", fontFamily: mono, opacity: 0.7 } }, sbR + "' rear setback") : null,

    // === LOT DIMENSIONS ===
    React.createElement("text", { x: sx(lotW / 2), y: oy + lotPxH + 16, textAnchor: "middle", style: { fontSize: 9, fill: "#333", fontFamily: mono, fontWeight: 700 } }, lotW + "'"),
    React.createElement("text", { x: ox - 14, y: oy + lotPxH / 2 + 3, textAnchor: "middle", style: { fontSize: 9, fill: "#333", fontFamily: mono, fontWeight: 700 }, transform: "rotate(-90," + (ox - 14) + "," + (oy + lotPxH / 2) + ")" }, lotD + "'"),

    // === STREET LABEL ===
    React.createElement("text", { x: sx(lotW / 2), y: oy + lotPxH + 30, textAnchor: "middle", style: { fontSize: 8, fill: "#999", fontFamily: mono, letterSpacing: 2 } }, p.streetName ? p.streetName.toUpperCase() : "STREET"),

    // === NORTH ARROW ===
    React.createElement("g", { transform: "translate(" + (svgW - 30) + "," + (oy + 20) + ")" },
      React.createElement("line", { x1: 0, y1: 20, x2: 0, y2: 0, stroke: "#333", strokeWidth: 1.2 }),
      React.createElement("polygon", { points: "-4,6 0,0 4,6", fill: "#333" }),
      React.createElement("text", { x: 0, y: -4, textAnchor: "middle", style: { fontSize: 8, fill: "#333", fontFamily: mono, fontWeight: 700 } }, "N")
    ),

    // === SCALE BAR ===
    React.createElement("g", { transform: "translate(" + ox + "," + (oy + lotPxH + 38) + ")" },
      React.createElement("line", { x1: 0, y1: 0, x2: sbPx, y2: 0, stroke: "#333", strokeWidth: 1 }),
      React.createElement("line", { x1: 0, y1: -3, x2: 0, y2: 3, stroke: "#333", strokeWidth: 1 }),
      React.createElement("line", { x1: sbPx, y1: -3, x2: sbPx, y2: 3, stroke: "#333", strokeWidth: 1 }),
      React.createElement("text", { x: sbPx / 2, y: 11, textAnchor: "middle", style: { fontSize: 7, fill: "#666", fontFamily: mono } }, sbFt + "'")
    )
  );
};
