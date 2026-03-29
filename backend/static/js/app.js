// ============================================================
// MAIN APP   Wizard Shell, State, Nav, Preview Panel
// ============================================================
const { useState, useMemo, useEffect, useRef } = React;

const DEF_CORNERS = { BL: { type: "square", size: 0 }, BR: { type: "square", size: 0 }, FL: { type: "square", size: 0 }, FR: { type: "square", size: 0 } };

// S36: Polygon lot helpers (rectangle fallback)
window.computeRectVertices = function(p) {
  var w = p.lotWidth || 80, d = p.lotDepth || 120;
  return [[0, 0], [w, 0], [w, d], [0, d]];
};
window.computeRectEdges = function(p) {
  var w = p.lotWidth || 80, d = p.lotDepth || 120;
  var street = p.streetName || "";
  return [
    { type: "street", label: street, length: w, setbackType: "front", neighborLabel: "" },
    { type: "property", label: "", length: d, setbackType: "side", neighborLabel: "" },
    { type: "property", label: "", length: w, setbackType: "rear", neighborLabel: "" },
    { type: "property", label: "", length: d, setbackType: "side", neighborLabel: "" }
  ];
};

// S38: Setback gap calculator (polygon-aware)
// Returns array of {edgeIdx, setbackType, required, gap, warn} for each edge with a setback.
// gap = min signed distance from deck bounding box corners to lot edge (inward positive).
window.computeSetbackGaps = function(p) {
  var verts = p.lotVertices || window.computeRectVertices(p);
  var edges = p.lotEdges || window.computeRectEdges(p);
  var n = verts.length;

  // Deck bounding box corners in lot coordinates
  var hx = p.houseOffsetSide || 20;
  var hy = p.houseDistFromStreet || p.setbackFront || 25;
  var hw = p.houseWidth || 40;
  var hd = p.houseDepth || 30;
  var dw = p.width || 20;
  var dd = p.depth || 12;
  var dOff = p.deckOffset || 0;
  var dx = hx + hw / 2 + dOff - dw / 2;
  var dy = hy + hd;
  var deckCorners = [
    [dx, dy], [dx + dw, dy], [dx + dw, dy + dd], [dx, dy + dd]
  ];

  // Lot centroid for inward normal direction
  var cx = 0, cy = 0;
  for (var i = 0; i < n; i++) { cx += verts[i][0]; cy += verts[i][1]; }
  cx /= n; cy /= n;

  var results = [];
  for (var ei = 0; ei < n; ei++) {
    var eInf = edges[ei] || {};
    var sbType = eInf.setbackType || "side";
    var required = 0;
    if (sbType === "front") required = p.setbackFront || 0;
    else if (sbType === "rear") required = p.setbackRear || 0;
    else if (sbType === "side") required = p.setbackSide || 0;
    if (required <= 0) continue;

    var v1 = verts[ei], v2 = verts[(ei + 1) % n];
    var edx = v2[0] - v1[0], edy = v2[1] - v1[1];
    var segLen = Math.sqrt(edx * edx + edy * edy);
    if (segLen < 0.01) continue;

    // Outward normal (away from centroid)
    var nx = -edy / segLen, ny = edx / segLen;
    var mx = (v1[0] + v2[0]) / 2, my = (v1[1] + v2[1]) / 2;
    if (nx * (cx - mx) + ny * (cy - my) > 0) { nx = -nx; ny = -ny; }
    // nx, ny now points outward. Signed distance: positive = inside lot

    var minDist = Infinity;
    for (var ci = 0; ci < 4; ci++) {
      var px = deckCorners[ci][0], py = deckCorners[ci][1];
      // Signed distance from point to line (positive = on centroid side = inside)
      var d = -( nx * (px - v1[0]) + ny * (py - v1[1]) );
      if (d < minDist) minDist = d;
    }

    var gap = +minDist.toFixed(1);
    results.push({
      edgeIdx: ei,
      setbackType: sbType,
      required: required,
      gap: gap,
      warn: gap < required
    });
  }
  return results;
};

// S37 Push 5: General polygon vertex solver
window.computePolygonVerts = function(edges, targetArea) {
  var n = edges.length;
  if (n < 3) return null;

  // Helper: trapezoid solver returning {verts, area} or null
  function solveTrap4(s, e, nr, w) {
    var D = nr - s;
    var a, h;
    if (Math.abs(D) < 0.01) { a = 0; h = e; }
    else {
      a = (e * e - w * w - D * D) / (2 * D);
      var hSq = w * w - a * a;
      if (hSq < 1) return null;
      h = Math.sqrt(hSq);
    }
    var v = [[0, 0], [s, 0], [a + nr, h], [a, h]];
    var area = Math.abs((v[0][0]*v[1][1]-v[1][0]*v[0][1]) + (v[1][0]*v[2][1]-v[2][0]*v[1][1]) + (v[2][0]*v[3][1]-v[3][0]*v[2][1]) + (v[3][0]*v[0][1]-v[0][0]*v[3][1])) / 2;
    return { verts: v, area: area };
  }

  // 4 edges: trapezoid solver with area-based template matching (S42)
  if (n === 4) {
    var A = edges[0].length || 1;
    var B = edges[1].length || 1;
    var C = edges[2].length || 1;
    var Dv = edges[3].length || 1;

    // Default: original ordering
    var original = solveTrap4(A, B, C, Dv);
    if (!original) return [[0, 0], [A, 0], [A, Math.max(B, Dv)], [0, Math.max(B, Dv)]];

    // If no targetArea, use original ordering
    if (!targetArea || targetArea <= 0) return original.verts;

    // Check if original already matches within 5%
    var origErr = Math.abs(original.area - targetArea) / targetArea;
    if (origErr <= 0.05) return original.verts;

    // Template matching: try all 6 permutations of non-street edges
    var others = [B, C, Dv];
    var perms = [
      [others[0], others[1], others[2]],
      [others[0], others[2], others[1]],
      [others[1], others[0], others[2]],
      [others[1], others[2], others[0]],
      [others[2], others[0], others[1]],
      [others[2], others[1], others[0]]
    ];
    var bestResult = original, bestErr = origErr;
    for (var pi = 0; pi < perms.length; pi++) {
      var r = solveTrap4(A, perms[pi][0], perms[pi][1], perms[pi][2]);
      if (!r) continue;
      var err = Math.abs(r.area - targetArea) / targetArea;
      if (err < bestErr) { bestErr = err; bestResult = r; }
    }

    // Only use reordered result if within 5%
    return (bestErr <= 0.05) ? bestResult.verts : original.verts;
  }

  // 5+ edges: equal exterior angle distribution with closure correction
  // Produces the most regular polygon possible for the given edge lengths
  var extAngle = 2 * Math.PI / n;
  var rawVerts = [[0, 0]];
  var heading = 0; // start heading east (along positive X)

  for (var i = 0; i < n - 1; i++) {
    var len = edges[i].length || 1;
    var prev = rawVerts[rawVerts.length - 1];
    rawVerts.push([
      prev[0] + len * Math.cos(heading),
      prev[1] + len * Math.sin(heading)
    ]);
    heading += extAngle;
  }

  // Compute where the last edge would end without correction
  var last = rawVerts[n - 1];
  var lastLen = edges[n - 1].length || 1;
  var endX = last[0] + lastLen * Math.cos(heading);
  var endY = last[1] + lastLen * Math.sin(heading);

  // Distribute closure error across all vertices (skip vertex 0 = origin)
  var errX = endX, errY = endY;
  for (var i = 1; i < n; i++) {
    var frac = i / n;
    rawVerts[i][0] -= errX * frac;
    rawVerts[i][1] -= errY * frac;
  }

  // Normalize: shift so min Y = 0 and min X = 0
  var minX = rawVerts[0][0], minY = rawVerts[0][1];
  for (var i = 1; i < n; i++) {
    if (rawVerts[i][0] < minX) minX = rawVerts[i][0];
    if (rawVerts[i][1] < minY) minY = rawVerts[i][1];
  }
  for (var i = 0; i < n; i++) {
    rawVerts[i][0] = +(rawVerts[i][0] - minX).toFixed(2);
    rawVerts[i][1] = +(rawVerts[i][1] - minY).toFixed(2);
  }

  return rawVerts;
};


// S46: Multi-candidate polygon shape solver
// Given edge lengths + target area, generates all valid polygon shapes
// for the user to pick from. Self-intersection and area filters narrow
// candidates to 1-6 realistic options.
window.generateCandidateShapes = function(edges, targetArea) {
  if (!edges || edges.length < 3 || !targetArea || targetArea <= 0) return [];
  var n = edges.length;
  var areaTol = 0.10;

  function shoelaceArea(verts) {
    var a = 0, m = verts.length;
    for (var i = 0; i < m; i++) {
      var j = (i + 1) % m;
      a += verts[i][0] * verts[j][1] - verts[j][0] * verts[i][1];
    }
    return Math.abs(a / 2);
  }

  function circleIntersect(x1, y1, r1, x2, y2, r2) {
    var dx = x2 - x1, dy = y2 - y1;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > r1 + r2 + 0.01 || d < Math.abs(r1 - r2) - 0.01 || d < 0.001) return [];
    var a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    var hSq = r1 * r1 - a * a;
    if (hSq < 0) hSq = 0;
    var h = Math.sqrt(hSq);
    var mx = x1 + a * dx / d, my = y1 + a * dy / d;
    var px = -dy * h / d, py = dx * h / d;
    if (h < 0.01) return [[mx, my]];
    return [[mx + px, my + py], [mx - px, my - py]];
  }

  function segsIntersect(p1, p2, p3, p4) {
    var d1x = p2[0] - p1[0], d1y = p2[1] - p1[1];
    var d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
    var cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-10) return false;
    var t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / cross;
    var u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / cross;
    return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
  }

  function isSelfIntersecting(verts) {
    var m = verts.length;
    for (var i = 0; i < m; i++) {
      for (var j = i + 2; j < m; j++) {
        if (i === 0 && j === m - 1) continue;
        if (segsIntersect(verts[i], verts[(i+1)%m], verts[j], verts[(j+1)%m])) return true;
      }
    }
    return false;
  }

  function normalizeVerts(verts) {
    var minX = Infinity, minY = Infinity;
    for (var i = 0; i < verts.length; i++) {
      if (verts[i][0] < minX) minX = verts[i][0];
      if (verts[i][1] < minY) minY = verts[i][1];
    }
    return verts.map(function(v) {
      return [+(v[0] - minX).toFixed(2), +(v[1] - minY).toFixed(2)];
    });
  }

  function shapesMatch(v1, v2) {
    if (v1.length !== v2.length) return false;
    var tol = 3.0;
    for (var i = 0; i < v1.length; i++) {
      var dx = v1[i][0] - v2[i][0], dy = v1[i][1] - v2[i][1];
      if (Math.sqrt(dx * dx + dy * dy) > tol) return false;
    }
    return true;
  }

  function permutations(arr) {
    if (arr.length <= 1) return [arr.slice()];
    var result = [];
    for (var i = 0; i < arr.length; i++) {
      var rest = arr.slice(0, i).concat(arr.slice(i + 1));
      var perms = permutations(rest);
      for (var j = 0; j < perms.length; j++) {
        result.push([arr[i]].concat(perms[j]));
      }
    }
    return result;
  }

  function tryAdd(candidates, verts, edgesOrdered, tArea) {
    var area = shoelaceArea(verts);
    var areaErr = Math.abs(area - tArea) / tArea;
    if (areaErr >= areaTol) return;
    if (isSelfIntersecting(verts)) return;
    var maxY = 0;
    for (var i = 0; i < verts.length; i++) { if (verts[i][1] > maxY) maxY = verts[i][1]; }
    if (maxY < 1) return;
    var nv = normalizeVerts(verts);
    for (var ci = 0; ci < candidates.length; ci++) {
      if (shapesMatch(candidates[ci].vertices, nv)) return;
    }
    candidates.push({
      vertices: nv,
      edges: edgesOrdered,
      area: Math.round(area),
      areaError: areaErr
    });
  }

  // Find street edge
  var streetIdx = 0;
  for (var i = 0; i < n; i++) {
    if (edges[i].type === "street") { streetIdx = i; break; }
  }
  var streetEdge = edges[streetIdx];
  var streetLen = streetEdge.length;
  var otherEdges = [];
  for (var i = 0; i < n; i++) {
    if (i !== streetIdx) otherEdges.push(edges[i]);
  }

  if (n < 4 || n > 5) return []; // 4 and 5-sided lots supported

  var allPerms = permutations(otherEdges);
  var candidates = [];

  for (var pi = 0; pi < allPerms.length; pi++) {
    var s1 = allPerms[pi][0].length;
    var s2 = allPerms[pi][1].length;
    var s3 = allPerms[pi][2].length;
    var edgesOrdered = [streetEdge].concat(allPerms[pi]);
    var samples = 500;
    var prev = [{}, {}];

    for (var si = 1; si < samples; si++) {
      var alpha = (si / samples) * Math.PI;
      var cx = streetLen + s1 * Math.cos(alpha);
      var cy = s1 * Math.sin(alpha);
      var dPoints = circleIntersect(cx, cy, s2, 0, 0, s3);

      for (var di = 0; di < dPoints.length; di++) {
        var verts = [[0, 0], [streetLen, 0], [cx, cy], [dPoints[di][0], dPoints[di][1]]];
        var area = shoelaceArea(verts);
        var areaErr = Math.abs(area - targetArea) / targetArea;

        // Direct hit (handles exact matches like rectangles)
        if (areaErr < 0.005) {
          tryAdd(candidates, verts, edgesOrdered, targetArea);
        }

        // Zero-crossing detection (area sweeps through target)
        if (prev[di].area !== undefined) {
          if ((prev[di].area - targetArea) * (area - targetArea) < 0) {
            var lo = prev[di].alpha, hi = alpha;
            var loArea = prev[di].area;
            for (var bs = 0; bs < 40; bs++) {
              var mid = (lo + hi) / 2;
              var mcx = streetLen + s1 * Math.cos(mid);
              var mcy = s1 * Math.sin(mid);
              var mdPs = circleIntersect(mcx, mcy, s2, 0, 0, s3);
              if (mdPs.length <= di) { hi = mid; continue; }
              var mverts = [[0, 0], [streetLen, 0], [mcx, mcy], [mdPs[di][0], mdPs[di][1]]];
              var marea = shoelaceArea(mverts);
              if ((loArea - targetArea) * (marea - targetArea) < 0) {
                hi = mid;
              } else {
                lo = mid;
                loArea = marea;
              }
            }
            var fAlpha = (lo + hi) / 2;
            var fcx = streetLen + s1 * Math.cos(fAlpha);
            var fcy = s1 * Math.sin(fAlpha);
            var fdPs = circleIntersect(fcx, fcy, s2, 0, 0, s3);
            if (fdPs.length > di) {
              var fverts = [[0, 0], [streetLen, 0], [fcx, fcy], [fdPs[di][0], fdPs[di][1]]];
              tryAdd(candidates, fverts, edgesOrdered, targetArea);
            }
          }
        }
        prev[di] = { area: area, alpha: alpha };
      }
    }
  }

  
  // === 5-sided lot solver (S46) ===
  // 2D sweep: alpha for edge1 angle, beta for edge2 angle
  // Edge3-4 closure via circle intersection (same as 4-sided)
  if (n === 5) {
    var allPerms5 = permutations(otherEdges);
    var samples5 = 60;

    for (var pi5 = 0; pi5 < allPerms5.length; pi5++) {
      var e1 = allPerms5[pi5][0].length;
      var e2 = allPerms5[pi5][1].length;
      var e3 = allPerms5[pi5][2].length;
      var e4 = allPerms5[pi5][3].length;
      var edgesOrd5 = [streetEdge].concat(allPerms5[pi5]);

      for (var ai5 = 1; ai5 < samples5; ai5++) {
        var alpha5 = (ai5 / samples5) * Math.PI;
        var cx5 = streetLen + e1 * Math.cos(alpha5);
        var cy5 = e1 * Math.sin(alpha5);

        var prev5 = [{}, {}];

        for (var bi5 = 1; bi5 < samples5; bi5++) {
          var beta5 = (bi5 / samples5) * Math.PI;
          var dx5 = cx5 + e2 * Math.cos(alpha5 + beta5);
          var dy5 = cy5 + e2 * Math.sin(alpha5 + beta5);

          var ePs5 = circleIntersect(dx5, dy5, e3, 0, 0, e4);

          for (var di5 = 0; di5 < ePs5.length; di5++) {
            var verts5 = [[0, 0], [streetLen, 0], [cx5, cy5], [dx5, dy5], [ePs5[di5][0], ePs5[di5][1]]];
            var area5 = shoelaceArea(verts5);
            var areaErr5 = Math.abs(area5 - targetArea) / targetArea;

            if (areaErr5 < 0.005 && !isSelfIntersecting(verts5)) {
              tryAdd(candidates, verts5, edgesOrd5, targetArea);
            }

            var p5 = prev5[di5];
            if (p5 && p5.area !== undefined) {
              if ((p5.area - targetArea) * (area5 - targetArea) < 0) {
                var lo5 = p5.beta, hi5 = beta5;
                var loA5 = p5.area;
                for (var bs5 = 0; bs5 < 30; bs5++) {
                  var mid5 = (lo5 + hi5) / 2;
                  var mdx5 = cx5 + e2 * Math.cos(alpha5 + mid5);
                  var mdy5 = cy5 + e2 * Math.sin(alpha5 + mid5);
                  var mePs5 = circleIntersect(mdx5, mdy5, e3, 0, 0, e4);
                  if (mePs5.length <= di5) { hi5 = mid5; continue; }
                  var mv5 = [[0, 0], [streetLen, 0], [cx5, cy5], [mdx5, mdy5], [mePs5[di5][0], mePs5[di5][1]]];
                  var ma5 = shoelaceArea(mv5);
                  if ((loA5 - targetArea) * (ma5 - targetArea) < 0) { hi5 = mid5; }
                  else { lo5 = mid5; loA5 = ma5; }
                }
                var fb5 = (lo5 + hi5) / 2;
                var fdx5 = cx5 + e2 * Math.cos(alpha5 + fb5);
                var fdy5 = cy5 + e2 * Math.sin(alpha5 + fb5);
                var fePs5 = circleIntersect(fdx5, fdy5, e3, 0, 0, e4);
                if (fePs5.length > di5) {
                  var fv5 = [[0, 0], [streetLen, 0], [cx5, cy5], [fdx5, fdy5], [fePs5[di5][0], fePs5[di5][1]]];
                  tryAdd(candidates, fv5, edgesOrd5, targetArea);
                }
              }
            }
            prev5[di5] = { area: area5, beta: beta5 };
          }
        }
      }
    }
  }

candidates.sort(function(a, b) { return a.areaError - b.areaError; });
  return candidates.slice(0, n === 4 ? 6 : 8);
};

const App = function SimpleBlueprints() {
  const { br, mono, sans } = window.SB;
  const [page, setPage] = useState("home");
  const [step, setStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [view, setView] = useState("plan");
  const [planMode, setPlanMode] = useState("plan");
  const [zoneMode, setZoneMode] = useState("select"); // "select" | "add" | "cut" | "chamfer"
  const [p, setP] = useState({ width: 20, depth: 12, height: 4, houseWidth: 40, houseDepth: 30, attachment: "ledger", hasStairs: true, stairLocation: "front", stairWidth: 4, numStringers: 3, hasLanding: false, joistSpacing: 16, deckingType: "composite", railType: "fortress", snowLoad: "moderate", frostZone: "cold", lotWidth: 80, lotDepth: 120, setbackFront: 25, setbackSide: 5, setbackRear: 20, houseOffsetSide: 20, deckOffset: 0, stairOffset: 0, beamType: "dropped", stairTemplate: "straight", stairRunSplit: null, stairLandingDepth: null, stairLandingWidth: null, stairGap: 0.5, stairRotation: 0, stairAnchorX: null, stairAnchorY: null, stairAngle: null,
    houseDistFromStreet: null,
    streetName: "",
    // Polygon lot (S36)
    lotVertices: null, lotEdges: null, lotArea: null,
// Zone system   S19
    zones: [], activeZone: 0, nextZoneId: 1, mainCorners: { BL: { type: "square", size: 0 }, BR: { type: "square", size: 0 }, FL: { type: "square", size: 0 }, FR: { type: "square", size: 0 } },
// Site plan   S27 (defaults seeded from existing flat params)
    sitePlan: {
      lotShape: "rectangle", lotWidth: 80, lotDepth: 120,
      streetSide: "south", streetName: "",
      houseWidth: 40, houseDepth: 30, houseOffsetX: 20, houseOffsetY: 25,
      houseLabel: "Existing Residence", houseShape: "rectangle",
      setbackFront: 25, setbackRear: 20, setbackLeft: 5, setbackRight: 5,
      deckAttachSide: "rear", deckOffsetX: 0,
      elements: [],
      address: "", parcelId: "", northAngle: 0,
      lotCoverage: null, deckToPropertyLine: null
    }
  });

  // Zone-aware updater
  const u = (k, v) => setP(prev => {
    const next = { ...prev, [k]: v };

    // Route zone-specific keys to active zone when activeZone > 0
    if (next.activeZone > 0) {
      const zoneKeyMap = { width: "w", depth: "d", height: "h" };
      if (zoneKeyMap[k]) {
        next[k] = prev[k]; // restore original flat param
        next.zones = prev.zones.map(function(z) {
          if (z.id !== prev.activeZone) return z;
          return Object.assign({}, z, { [zoneKeyMap[k]]: v });
        });
        return next;
      }
    }

    if (k === "stairLocation") { next.stairOffset = 0; next.stairAnchorX = null; next.stairAnchorY = null; next.stairAngle = null; }
    if (k === "stairAngle" && v != null) {
      if (v === 0) next.stairLocation = "front";
      else if (v === 90) next.stairLocation = "right";
      else if (v === 270) next.stairLocation = "left";
      else if (v === 180) next.stairLocation = "back";
    }
    if (k === "houseWidth" || k === "width") {
      const maxOff = Math.floor(next.houseWidth / 2);
      next.deckOffset = Math.max(-maxOff, Math.min(maxOff, next.deckOffset || 0));
    }
    if (k === "width" && next.stairWidth > next.width) next.stairWidth = next.width;
    if (k === "deckingType") { next.joistSpacing = v === "composite" ? 12 : 16; }
    if (k === "stairWidth" || k === "width" || k === "depth") {
      const edge = next.stairLocation === "front" ? next.width : next.depth;
      const maxSO = Math.floor((edge - (next.stairWidth || 4)) / 2);
      next.stairOffset = Math.max(-maxSO, Math.min(maxSO, next.stairOffset || 0));
    }
    if (k === "lotWidth" || k === "houseWidth") {
      const maxHO = Math.max(5, next.lotWidth - next.houseWidth - 5);
      next.houseOffsetSide = Math.min(next.houseOffsetSide || 20, maxHO);
    }
    // S37: Clear custom polygon when lot dimension sliders change
    if ((k === "lotWidth" || k === "lotDepth") && prev.lotEdges) {
      next.lotEdges = null;
      next.lotVertices = null;
      next.lotArea = null;
    }
    // S29: clamp houseDistFromStreet when setbackFront changes
    if (k === "setbackFront" && next.houseDistFromStreet !== null && next.houseDistFromStreet < v) {
      next.houseDistFromStreet = v;
    }
    if (k === "houseDistFromStreet" && v !== null) {
      next.houseDistFromStreet = Math.max(next.setbackFront, v);
    }
    return next;
  });

// Zone management functions
  const addZone = (parentId, edge) => setP(prev => {
    var parentP = Object.assign({}, prev, { deckWidth: prev.width, deckDepth: prev.depth });
    var defaults = window.addZoneDefaults(parentId, edge, "add", parentP);
    if (!defaults) return prev;
    defaults.id = prev.nextZoneId;
    defaults.label = "Zone " + prev.nextZoneId;
    return {
      ...prev,
      zones: prev.zones.concat([defaults]),
      activeZone: prev.nextZoneId,
      nextZoneId: prev.nextZoneId + 1
    };
  });

  const addCutout = (parentId, edge) => setP(prev => {
    var parentP = Object.assign({}, prev, { deckWidth: prev.width, deckDepth: prev.depth });
    var defaults = window.addZoneDefaults(parentId, edge, "cutout", parentP);
    if (!defaults) return prev;
    defaults.id = prev.nextZoneId;
    defaults.label = "Cutout " + prev.nextZoneId;
    return {
      ...prev,
      zones: prev.zones.concat([defaults]),
      activeZone: prev.nextZoneId,
      nextZoneId: prev.nextZoneId + 1
    };
  });

  const removeZone = (zoneId) => setP(prev => {
    if (zoneId === 0) return prev;
    var toRemove = new Set([zoneId]);
    var changed = true;
    while (changed) {
      changed = false;
      prev.zones.forEach(function(z) {
        if (toRemove.has(z.attachTo) && !toRemove.has(z.id)) { toRemove.add(z.id); changed = true; }
      });
    }
    return {
      ...prev,
      zones: prev.zones.filter(function(z) { return !toRemove.has(z.id); }),
      activeZone: 0
    };
  });

  const updateZone = (zoneId, key, val) => setP(prev => {
    if (zoneId === 0) {
      // For zone 0, update flat params or mainCorners
      if (key === "corners") return { ...prev, mainCorners: val };
      return prev; // zone 0 uses flat params via u()
    }
    return {
      ...prev,
      zones: prev.zones.map(function(z) {
        if (z.id !== zoneId) return z;
        return Object.assign({}, z, { [key]: val });
      })
    };
  });

  const setCorner = (zoneId, corner, type, size) => {
    var upd = { type: type, size: type === "square" ? 0 : size };
    if (zoneId === 0) {
      setP(prev => ({ ...prev, mainCorners: Object.assign({}, prev.mainCorners, { [corner]: upd }) }));
    } else {
      setP(prev => ({
        ...prev,
        zones: prev.zones.map(function(z) {
          if (z.id !== zoneId) return z;
          return Object.assign({}, z, { corners: Object.assign({}, z.corners || DEF_CORNERS, { [corner]: upd }) });
        })
      }));
    }
  };

  const getCorners = (zoneId) => {
    if (zoneId === 0) return p.mainCorners || DEF_CORNERS;
    var z = p.zones.find(function(z) { return z.id === zoneId; });
    return (z && z.corners) || DEF_CORNERS;
  };

// Provide deckWidth/deckDepth aliases for zoneUtils
  // zoneUtils reads p.deckWidth/p.deckDepth, but our flat params use width/depth
  const pForZones = useMemo(() => Object.assign({}, p, { deckWidth: p.width, deckDepth: p.depth, deckHeight: p.height }), [p]);

  const c = useMemo(() => window.calcStructure(p), [p]);
  const cAdj = useMemo(function() {
    if (!p.zones || !p.zones.length || !window.getExposedEdges) return c;
    var pz = Object.assign({}, p, { deckWidth: p.width, deckDepth: p.depth, deckHeight: p.height });
    var edges = window.getExposedEdges(pz);
    var totalLen = edges.reduce(function(s, e) {
      return s + (e.dir === "h" ? Math.abs(e.x2 - e.x1) : Math.abs(e.y2 - e.y1));
    }, 0);
    if (p.hasStairs) totalLen -= (p.stairWidth || 4);
    return Object.assign({}, c, { railLen: +totalLen.toFixed(1) });
  }, [p, c]);
  const m = useMemo(() => window.estMaterials(p, cAdj), [p, cAdj]);
  const zc = useMemo(() => window.calcAllZones ? window.calcAllZones(p, c) : null, [p, c]);
  const [genStatus, setGenStatus] = useState("idle");
  const [info, setInfo] = useState({ owner: "", address: "", city: "", state: "", zip: "", lot: "", contractor: "" });
  const setI = (f, v) => setInfo(prev => ({ ...prev, [f]: v }));
  const [sitePlanMode, setSitePlanMode] = useState("generate");
  const [sitePlanFile, setSitePlanFile] = useState(null);
  const [sitePlanB64, setSitePlanB64] = useState(null);
  const [traceMode, setTraceMode] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(null);
  // S48: Reset preview when exiting compare mode
  useEffect(() => { if (!compareMode) { setPreviewIdx(null); window._previewShapeIndex = null; } }, [compareMode]);
  // S48: Expose preview callback for CompareShapes
  useEffect(() => { window._onPreviewShape = function(idx) { setPreviewIdx(idx); window._previewShapeIndex = idx; }; return () => { window._onPreviewShape = null; }; }, []);
  const [traceState, setTraceState] = useState({
    calPoints: [], calDist: "", ppf: null,
    vertices: [], edgeMeta: [], edgeLengths: [],
    imgW: 0, imgH: 0,
    selectedEdge: null, selectedVertex: null,
    pdfPage: 1, pdfPageCount: 1
  });
  const [genError, setGenError] = useState("");
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedback, setFeedback] = useState({ role: "", source: "", price: "", feedback: "", email: "" });
  const isProduction = typeof window !== 'undefined' && window.location.hostname.includes("simpleblueprints.xyz");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [materialsUrl, setMaterialsUrl] = useState(null);

  const API = "https://simpleblueprints-production.up.railway.app";

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.authenticated) setUser(d.user); setAuthLoading(false); })
      .catch(() => setAuthLoading(false));
  }, []);

  const generateBlueprint = async () => {
    setGenStatus("generating"); setGenError(""); setMaterialsUrl(null);
    try {
      const coverImage = await window.capture3D(p, c);
      const res = await fetch(`${API}/api/generate-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...p, projectInfo: info, coverImage, sitePlanMode, sitePlanFile: sitePlanB64 }),
      });
      if (res.status === 401) { setGenError("Please sign in first"); setGenStatus("error"); return; }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.download_url) {
        const _a = document.createElement("a"); _a.href = `${API}${data.download_url}?type=permit`; _a.target = "_blank"; document.body.appendChild(_a); _a.click(); document.body.removeChild(_a);
        if (data.materials_url) { setMaterialsUrl(`${API}${data.materials_url}?type=materials`); }
        setGenStatus("done");
      } else {
        throw new Error("No download URL returned");
      }
    } catch (e) {
      setGenError(e.message);
      setGenStatus("error");
    }
  };

  const submitFeedback = async () => {
    try {
      await fetch(`${API}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(feedback),
      });
      setFeedbackDone(true);
    } catch (e) { console.warn("Feedback error:", e); setFeedbackDone(true); }
  };

  const steps = [{ t: "Site Plan", i: "\uD83D\uDDFA\uFE0F" }, { t: "Size & Shape", i: "\uD83D\uDCD0" }, { t: "Structure", i: "\uD83C\uDFD7\uFE0F" }, { t: "Finishes", i: "\uD83E\uDEB5" }, { t: "Review", i: "\uD83D\uDCCB" }];

  const PlanView = window.PlanView;
  const ElevationView = window.ElevationView;
  const Deck3D = window.Deck3D;
  const HomePage = window.HomePage;
  const StepContent = window.StepContent;
  const SitePlanView = window.SitePlanView;
  const TraceView = window.TraceView;
  const SurveyPreview = window.SurveyPreview;
  const CompareShapes = window.CompareShapes;

  // S48: Compute temporary p for shape preview
  const previewP = useMemo(() => {
    if (previewIdx == null || !window._shapeCompareData) return null;
    var data = window._shapeCompareData;
    var cand = data.candidates[previewIdx];
    if (!cand) return null;
    var cv = cand.vertices;
    var cmaxX = 0, cmaxY = 0;
    cv.forEach(v => { if (v[0] > cmaxX) cmaxX = v[0]; if (v[1] > cmaxY) cmaxY = v[1]; });
    var overrides = {
      lotWidth: Math.max(30, Math.round(cmaxX)),
      lotDepth: Math.max(50, Math.round(cmaxY)),
      lotVertices: cv,
      lotEdges: cand.edges.map(e => ({
        type: e.type || "property", label: e.type === "street" ? (e.label || "") : "",
        length: e.length || 1, setbackType: e.setbackType || "side",
        neighborLabel: e.type === "street" ? "" : (e.neighborLabel || "")
      })),
      lotArea: cand.area
    };
    // S48: Include extracted house dimensions in preview
    var ext = data.extractResult;
    if (ext) {
      var _hw = ext.houseWidth || 40;
      var _hd = ext.houseDepth || 30;
      if (ext.houseWidth) overrides.houseWidth = _hw;
      if (ext.houseDepth) overrides.houseDepth = _hd;
      if (ext.setbackFront) overrides.setbackFront = ext.setbackFront;
      if (ext.setbackRear) overrides.setbackRear = ext.setbackRear;
      if (ext.setbackSide) overrides.setbackSide = ext.setbackSide;
      // S48: Percentage cross-check for position
      var bbW = overrides.lotWidth, bbD = overrides.lotDepth;
      var offSide = ext.houseOffsetSide || 20;
      var distStreet = ext.houseDistFromStreet || 25;
      if (ext.houseXPercent != null && ext.houseXPercent >= 0 && ext.houseXPercent <= 100) {
        var pctX = Math.round(bbW * (ext.houseXPercent / 100) - _hw / 2);
        pctX = Math.max(0, pctX);
        if (offSide > 0 && Math.abs(pctX - offSide) / Math.max(offSide, pctX) > 0.2) offSide = pctX;
      }
      if (ext.houseYPercent != null && ext.houseYPercent >= 0 && ext.houseYPercent <= 100) {
        var pctY = Math.round(bbD * (ext.houseYPercent / 100) - _hd / 2);
        pctY = Math.max(0, pctY);
        if (distStreet > 0 && Math.abs(pctY - distStreet) / Math.max(distStreet, pctY) > 0.2) distStreet = pctY;
      }
      overrides.houseOffsetSide = offSide;
      overrides.houseDistFromStreet = distStreet;
    }
    return Object.assign({}, p, overrides);
  }, [previewIdx, p]);

  // HOME
  if (page === "home") return <HomePage setPage={setPage} />;

  // WIZARD
  const views = [["plan", "Plan"], ["elevation", "Elevation"], ["3d", "3D View"]];
  return (
    <div style={{ minHeight: "100vh", background: br.cr }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 24px", borderBottom: `1px solid ${br.bd}`, background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setPage("home")}>
          <div style={{ width: 24, height: 24, background: br.gn, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>SB</span></div>
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: br.dk }}>simpleblueprints</span>
        </div>
        <div style={{ display: "flex", gap: 1 }}>
          {steps.map((s, i) => <button key={i} onClick={() => setStep(i)} style={{ padding: "7px 16px", fontSize: 10, cursor: "pointer", border: "none", fontFamily: mono, background: step === i ? br.gn : "transparent", color: step === i ? "#fff" : br.mu, borderRadius: i === 0 ? "5px 0 0 5px" : i === steps.length - 1 ? "0 5px 5px 0" : 0, fontWeight: step === i ? 700 : 400, letterSpacing: "0.5px" }}>{s.i} {s.t}</button>)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontFamily: mono, color: br.mu }}>{user.name || user.email}</span>
            {user.picture && <img src={user.picture} style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${br.bd}` }} referrerPolicy="no-referrer" />}
            <button onClick={() => fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }).then(() => setUser(null))} style={{ fontSize: 9, fontFamily: mono, color: br.mu, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>logout</button>
          </div> : <button onClick={() => { window.location.href = `${API}/auth/login`; }} style={{ padding: "5px 14px", background: br.gn, color: "#fff", border: "none", borderRadius: 5, fontSize: 10, fontFamily: mono, cursor: "pointer", fontWeight: 700 }}>Sign in</button>}
        </div>
      </nav>
      <div style={{ height: 3, background: br.wr }}><div style={{ height: "100%", background: br.gn, width: `${((step + 1) / steps.length) * 100}%`, transition: "width 0.3s" }} /></div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "12px", display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* LEFT: INPUTS */}
        <div style={{ flex: "1 1 320px", minWidth: 290 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 22, border: `1px solid ${br.bd}`, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 800, color: br.dk, fontFamily: sans, borderBottom: `2px solid ${br.gn}`, paddingBottom: 8 }}>{steps[step].i} {steps[step].t}</h2>

            <StepContent step={step} p={p} u={u} c={c} m={m} zc={zc} info={info} setI={setI}
              setStep={setStep}
              showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced}
              sitePlanMode={sitePlanMode} setSitePlanMode={setSitePlanMode}
              sitePlanFile={sitePlanFile} setSitePlanFile={setSitePlanFile} setSitePlanB64={setSitePlanB64}
              isProduction={isProduction} feedbackDone={feedbackDone} setFeedbackDone={setFeedbackDone}
              feedback={feedback} setFeedback={setFeedback} submitFeedback={submitFeedback}
              genStatus={genStatus} genError={genError} generateBlueprint={generateBlueprint}
              user={user} API={API} materialsUrl={materialsUrl}
              zoneMode={zoneMode} setZoneMode={setZoneMode}
              addZone={addZone} addCutout={addCutout} removeZone={removeZone} updateZone={updateZone}
              setCorner={setCorner} getCorners={getCorners} pForZones={pForZones}
              traceMode={traceMode} setTraceMode={setTraceMode}
              traceState={traceState} setTraceState={setTraceState}
              compareMode={compareMode} setCompareMode={setCompareMode}
              sitePlanB64={sitePlanB64} />

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button onClick={() => step > 0 ? setStep(step - 1) : setPage("home")} style={{ padding: "9px 18px", border: `1px solid ${br.bd}`, borderRadius: 6, background: "transparent", color: br.mu, cursor: "pointer", fontFamily: mono, fontSize: 11, fontWeight: 600 }}>{"\u2190"} {step > 0 ? "Back" : "Home"}</button>
              {step < steps.length - 1 && <button onClick={() => setStep(step + 1)} style={{ padding: "9px 18px", border: "none", borderRadius: 6, background: br.gn, color: "#fff", cursor: "pointer", fontFamily: mono, fontSize: 11, fontWeight: 700 }}>Next {"\u2192"}</button>}
            </div>
          </div>
        </div>

        {/* RIGHT: PREVIEW */}
        <div style={{ flex: "1 1 500px", minWidth: 280 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 18, border: `1px solid ${br.bd}`, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: br.dk, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase" }}>{step === 0 ? "Site Plan Preview" : "Preview"}</h3>
              {step !== 0 && <div style={{ display: "flex", gap: 1 }}>
                {views.map(([id, label], i) => <button key={id} onClick={() => setView(id)} style={{ padding: "5px 12px", fontSize: 10, cursor: "pointer", fontFamily: mono, border: view === id ? `1px solid ${br.gn}` : `1px solid ${br.bd}`, background: view === id ? br.gn : "transparent", color: view === id ? "#fff" : br.mu, borderRadius: i === 0 ? "4px 0 0 4px" : i === views.length - 1 ? "0 4px 4px 0" : 0, fontWeight: view === id ? 700 : 400 }}>{label}</button>)}
              </div>}
            </div>

            <div style={{ background: step === 0 ? br.cr : (view === "3d" ? "transparent" : br.cr), border: step === 0 || view !== "3d" ? `1px solid ${br.bd}` : "none", borderRadius: 6, padding: step === 0 ? 8 : (view === "3d" ? 0 : 12), minHeight: 320 }}>
              {/* S48: Compare mode - survey + shapes + preview */}
              {step === 0 && compareMode && sitePlanB64 && SurveyPreview && <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: br.dk, fontFamily: mono }}>Compare survey to proposed shapes</span>
                  <button onClick={() => { if (previewIdx != null) { setPreviewIdx(null); window._previewShapeIndex = null; } else { setCompareMode(false); } }} style={{ fontSize: 9, fontFamily: mono, color: br.mu, background: "none", border: "1px solid " + br.bd, borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}>{previewIdx != null ? "\u2190 All shapes" : "Back"}</button>
                </div>
                <div style={{ fontSize: 10, color: "#1e40af", fontFamily: mono, marginBottom: 10, lineHeight: 1.6, padding: "8px 12px", background: "#eff6ff", borderRadius: 6, border: "1px solid #bfdbfe" }}>{"\uD83D\uDCA1"} Use the <strong>page arrows</strong> to find your lot boundary. Then <strong>tap the shape</strong> that matches.</div>

                {/* S52: Stacked layout when no shape selected, two-column when selected */}
                {previewIdx == null ? <div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: br.mu, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4 }}>Your Survey</div>
                    <SurveyPreview b64={sitePlanB64} fileType={sitePlanFile && sitePlanFile.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image"} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: br.mu, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase" }}>Proposed Shapes</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 14px", background: "#fefce8", borderRadius: 6, border: "1px solid #fde68a", marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontFamily: mono, color: "#92400e" }}>None of these look right?</span>
                    <button onClick={() => { setCompareMode(false); setTraceState({ calPoints: [], calDist: "", ppf: null, vertices: [], edgeMeta: [], edgeLengths: [], imgW: 0, imgH: 0, selectedEdge: null, selectedVertex: null, pdfPage: 1, pdfPageCount: 1 }); setTraceMode(true); }} style={{ fontSize: 10, fontFamily: mono, color: "#fff", background: "#ca8a04", border: "none", cursor: "pointer", fontWeight: 700, padding: "5px 14px", borderRadius: 5 }}>Trace Manually</button>
                  </div>
                  <CompareShapes candidates={window._shapeCompareData ? window._shapeCompareData.candidates : []} previewIdx={previewIdx} />
                </div> : <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ flex: "1 1 55%" }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: br.mu, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4 }}>Your Survey</div>
                    <SurveyPreview b64={sitePlanB64} fileType={sitePlanFile && sitePlanFile.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image"} />
                    {previewP && SitePlanView && <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: br.mu, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4 }}>Site Plan Preview</div>
                      <div style={{ border: "1px solid " + br.bd, borderRadius: 6, padding: 4, background: "#fff" }}>
                        <SitePlanView p={previewP} c={c} u={() => {}} />
                      </div>
                    </div>}
                  </div>
                  <div style={{ flex: "1 1 45%", display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: br.mu, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4 }}>Proposed Shapes</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "#fefce8", borderRadius: 5, border: "1px solid #fde68a", marginBottom: 8 }}><span style={{ fontSize: 9, fontFamily: mono, color: "#92400e" }}>Not a match?</span><button onClick={() => { setCompareMode(false); setTraceState({ calPoints: [], calDist: "", ppf: null, vertices: [], edgeMeta: [], edgeLengths: [], imgW: 0, imgH: 0, selectedEdge: null, selectedVertex: null, pdfPage: 1, pdfPageCount: 1 }); setTraceMode(true); }} style={{ fontSize: 9, fontFamily: mono, color: "#ca8a04", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontWeight: 700, padding: 0 }}>Trace manually</button></div>
                    <div style={{ maxHeight: "60vh", overflowY: "auto", flex: 1 }}>
                      <CompareShapes candidates={window._shapeCompareData ? window._shapeCompareData.candidates : []} previewIdx={previewIdx} />
                    </div>
                    <button onClick={() => { if (window._selectShape) window._selectShape(previewIdx); }} style={{
                      width: "100%", padding: "12px", background: "#2e7d32", color: "#fff", border: "none",
                      borderRadius: 8, cursor: "pointer", fontSize: 12, fontFamily: mono, fontWeight: 700,
                      marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      position: "sticky", bottom: 0
                    }}>{"\u2705"} Confirm Option {previewIdx + 1}</button>
                  </div>
                </div>}
              </div>}
              {step === 0 && !traceMode && !compareMode && SitePlanView && <SitePlanView p={p} c={c} u={u} />}
              {step === 0 && traceMode && TraceView && <div>
                <div style={{ fontSize: 10, color: "#1e40af", fontFamily: mono, marginBottom: 10, lineHeight: 1.6, padding: "8px 12px", background: "#eff6ff", borderRadius: 6, border: "1px solid #bfdbfe" }}>{"\uD83D\uDCA1"} Use the <strong>page buttons</strong> to find your lot boundary. Then <strong>click each corner</strong> of your property, starting anywhere. Scroll to zoom in for precision.</div>
                <TraceView
                surveyB64={sitePlanB64}
                surveyFileType={sitePlanFile && sitePlanFile.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image"}
                ts={traceState} setTs={setTraceState}
              /></div>}
              {step !== 0 && view === "plan" && <>
                <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                  {[["plan", "Deck Plan"], ["framing", "Framing"]].map(([id, label]) => <button key={id} onClick={() => setPlanMode(id)} style={{ padding: "4px 10px", fontSize: 9, fontFamily: mono, cursor: "pointer", border: planMode === id ? `1px solid ${br.gn}` : `1px solid ${br.bd}`, background: planMode === id ? br.gn : "transparent", color: planMode === id ? "#fff" : br.mu, borderRadius: 4, fontWeight: planMode === id ? 700 : 400 }}>{label}</button>)}
                  <div style={{ flex: 1 }} />
                  {planMode === "plan" && [["select", "\u25C7"], ["add", "+"], ["cut", "\u2702"], ["chamfer", "\u25E3"]].map(([id, icon]) => <button key={id} onClick={() => setZoneMode(id)} style={{ padding: "4px 10px", fontSize: 9, fontFamily: mono, cursor: "pointer", border: zoneMode === id ? `1px solid ${id === "cut" ? "#dc2626" : id === "chamfer" ? "#7c3aed" : id === "add" ? "#16a34a" : br.gn}` : `1px solid ${br.bd}`, background: zoneMode === id ? (id === "cut" ? "#fef2f2" : id === "chamfer" ? "#faf5ff" : id === "add" ? "#f0fdf4" : "#edf5e8") : "transparent", color: zoneMode === id ? (id === "cut" ? "#dc2626" : id === "chamfer" ? "#7c3aed" : id === "add" ? "#16a34a" : br.gn) : br.mu, borderRadius: 4, fontWeight: zoneMode === id ? 700 : 400, minWidth: 28, textAlign: "center" }}>{icon}</button>)}
                </div>
                <PlanView p={p} c={c} mode={planMode} u={u}
                  zoneMode={zoneMode} pForZones={pForZones}
                  addZone={addZone} addCutout={addCutout}
                  getCorners={getCorners} setCorner={setCorner} />
                {planMode === "plan" && <div style={{ textAlign: "center", fontSize: 9, color: br.mu, fontFamily: mono, marginTop: 4, opacity: 0.7 }}>
// {zoneMode === "select" && <>Drag the <span style={{ color: "#3d5a2e", fontWeight: 700 }}>green</span> handle to slide the deck   Click <span style={{ color: "#c62828", fontWeight: 700 }}>stairs</span> to select, drag to move, grab <span style={{ color: "#3d5a2e", fontWeight: 700 }}>{"\u21BB"}</span> to rotate</>}
                  {zoneMode === "add" && <>Click <span style={{ color: "#16a34a", fontWeight: 700 }}>+</span> on any edge to add a deck zone</>}
                  {zoneMode === "cut" && <>Click <span style={{ color: "#dc2626", fontWeight: 700 }}>{"\u2702"}</span> on corners for house wraps, center for openings</>}
                  {zoneMode === "chamfer" && <>Click <span style={{ color: "#7c3aed", fontWeight: 700 }}>{"\u25E3"}</span> on corners to toggle 45{"\u00B0"} chamfers</>}
                </div>}
              </>}
              {step !== 0 && view === "elevation" && <ElevationView c={c} p={p} />}
              {step !== 0 && view === "3d" && <Deck3D c={c} p={p} />}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 12 }}>
              {[["Area", `${zc ? zc.totalArea : c.area} SF`, br.dk], ["Joists", c.joistSize, br.bl], ["Beam", c.beamSize.replace("3-ply ", "3\u00D7").replace("2-ply ", "2\u00D7"), br.ac], ["Posts", `${c.postSize}\u00D7${zc ? c.nP + zc.extraPosts : c.nP}`, "#8B6508"], ["Footings", `${c.fDiam}"\u00D8\u00D7${zc ? c.nF + zc.extraFootings : c.nF}`, "#777"], ["Est. Cost", `$${(zc ? m.total + zc.extraTotal : m.total).toFixed(0)}`, br.gn]].map(([l, v, cl]) => (
                <div key={l} style={{ padding: "8px 10px", background: br.cr, borderRadius: 6, border: `1px solid ${br.bd}`, textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: br.mu, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.5px" }}>{l}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: cl, fontFamily: mono, marginTop: 1 }}>{v}</div>
                </div>
              ))}
            </div>

            {step >= 2 && <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: br.mu, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>Materials</div>
              <div style={{ maxHeight: 200, overflowY: "auto", borderRadius: 6, border: `1px solid ${br.bd}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 10 }}>
                  <thead><tr style={{ background: br.wr }}><th style={{ textAlign: "left", padding: "5px 8px", color: br.mu, fontSize: 8 }}>ITEM</th><th style={{ textAlign: "center", padding: "5px 8px", color: br.mu, fontSize: 8 }}>QTY</th><th style={{ textAlign: "right", padding: "5px 8px", color: br.mu, fontSize: 8 }}>EXT</th></tr></thead>
                  <tbody>{(zc ? m.items.concat(zc.extraItems) : m.items).map((it, i) => <tr key={i} style={{ borderBottom: `1px solid ${br.wr}` }}><td style={{ padding: "4px 8px", color: br.tx }}>{it.item}</td><td style={{ padding: "4px 8px", textAlign: "center", color: br.bl, fontWeight: 700 }}>{it.qty}</td><td style={{ padding: "4px 8px", textAlign: "right", color: br.dk }}>${(it.qty * it.cost).toFixed(0)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
