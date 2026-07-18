/* ============================================================================
 * lotGeometry.js -- S84
 * Pure geometry for the site plan subsystem. NO React, NO window state,
 * NO closures over component state. Inputs in, outputs out.
 *
 * This is a faithful extraction of the S79 architecture from:
 *   - steps.js parcel callback   (street edge detection, polygon rotation)
 *   - steps.js footprint callback (point-in-poly, tightEdges, house placement)
 *   - sitePlanView.js            (leftEdgeAtY renderer scan)
 *
 * Rules encoded here (do not change without updating ARCHITECTURE.txt):
 *   - Rotation is derived from the street edge of the polygon (Realie data),
 *     never from external road bearings. "Good enough, never wrong."
 *   - Rotation skipped when street edge is already near-horizontal (<3 deg).
 *   - Dimensions are sacred, position is flexible: a house that does not fit
 *     is centered, never pushed to a lot edge.
 *   - houseAngle is always 0 under S79.
 *
 * Loaded in the browser via <script> (attaches to window.lotGeometry) and in
 * Node via require() for the test harness (tests/geometry/).
 *
 * OFFSET CONTRACT (S85 -- the divergence fix):
 *   houseOffsetSide is defined in RENDERER space: the renderer (and the PDF,
 *   draw_site_plan.py) draw the house left edge at
 *       leftEdgeAtY(houseDistFromStreet + houseDepth/2) + houseOffsetSide.
 *   positionHouse() still uses tightEdges() internally to decide WHERE the
 *   house should go (fit/centering, "never push to a lot edge"), but the
 *   offset it RETURNS is converted to the leftEdgeAtY(midY) reference at
 *   stash time, so intended position == rendered position by construction.
 *   (Pre-S85 it returned a tightEdges().left-relative offset, which diverged
 *   from the renderer by ~2.6 ft on tapered/flag lots -- 48 S84 warnings.)
 *   Renderer semantics are unchanged, so previously saved offsets render
 *   exactly as they always did.
 * ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.lotGeometry = factory();
  }
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------------------------------------------------------- basics */

  function polygonCentroid(verts) {
    var cx = 0, cy = 0, n = verts.length;
    for (var i = 0; i < n; i++) { cx += verts[i][0]; cy += verts[i][1]; }
    return [cx / n, cy / n];
  }

  function boundingBox(verts) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < verts.length; i++) {
      if (verts[i][0] < minX) minX = verts[i][0];
      if (verts[i][1] < minY) minY = verts[i][1];
      if (verts[i][0] > maxX) maxX = verts[i][0];
      if (verts[i][1] > maxY) maxY = verts[i][1];
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX, d: maxY - minY };
  }

  function edgeLengths(verts) {
    var out = [], n = verts.length;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var dx = verts[j][0] - verts[i][0], dy = verts[j][1] - verts[i][1];
      out.push(Math.sqrt(dx * dx + dy * dy));
    }
    return out;
  }

  /* Faithful transcription of _pointInPoly (steps.js footprint callback). */
  function pointInPolygon(px, py, polyVerts) {
    var inside = false;
    var n = polyVerts.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = polyVerts[i][0], yi = polyVerts[i][1];
      var xj = polyVerts[j][0], yj = polyVerts[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  /* ------------------------------------------------- street edge detection */
  /* Faithful transcription of the S70/S79 centroid->address ray-cast from
   * the parcel callback in steps.js, including the lowest-Y fallback.
   * addrPoint may be null/undefined -> fallback used.                       */
  function detectStreetEdge(verts, addrPoint) {
    var nv = verts.length;
    var c = polygonCentroid(verts);
    var lotCx3 = c[0], lotCy3 = c[1];
    var streetIdx = 0, rearIdx = 0;
    var method;

    var hasAddr = addrPoint && isFinite(addrPoint[0]) && isFinite(addrPoint[1]) &&
      !(Math.abs(addrPoint[0] - lotCx3) < 0.001 && Math.abs(addrPoint[1] - lotCy3) < 0.001);

    if (hasAddr) {
      method = "raycast";
      var rayDx = addrPoint[0] - lotCx3, rayDy = addrPoint[1] - lotCy3;
      var bestT = Infinity;
      var ei, ni, ex, ey, fx, fy, sx2, sy2, denom, t, u2;
      for (ei = 0; ei < nv; ei++) {
        ni = (ei + 1) % nv;
        ex = verts[ei][0]; ey = verts[ei][1];
        fx = verts[ni][0]; fy = verts[ni][1];
        sx2 = fx - ex; sy2 = fy - ey;
        denom = rayDx * sy2 - rayDy * sx2;
        if (Math.abs(denom) < 0.001) continue;
        t = ((ex - lotCx3) * sy2 - (ey - lotCy3) * sx2) / denom;
        u2 = ((ex - lotCx3) * rayDy - (ey - lotCy3) * rayDx) / denom;
        if (t > 0.01 && u2 >= 0 && u2 <= 1 && t < bestT) {
          bestT = t;
          streetIdx = ei;
        }
      }
      // Rear = edge hit by the reversed ray
      var bestT2 = Infinity;
      var revDx = -rayDx, revDy = -rayDy;
      for (ei = 0; ei < nv; ei++) {
        ni = (ei + 1) % nv;
        ex = verts[ei][0]; ey = verts[ei][1];
        fx = verts[ni][0]; fy = verts[ni][1];
        sx2 = fx - ex; sy2 = fy - ey;
        denom = revDx * sy2 - revDy * sx2;
        if (Math.abs(denom) < 0.001) continue;
        t = ((ex - lotCx3) * sy2 - (ey - lotCy3) * sx2) / denom;
        u2 = ((ex - lotCx3) * revDy - (ey - lotCy3) * revDx) / denom;
        if (t > 0.01 && u2 >= 0 && u2 <= 1 && t < bestT2) {
          bestT2 = t;
          rearIdx = ei;
        }
      }
    } else {
      method = "lowestY";
      var minAvgY = Infinity, maxAvgY = -Infinity;
      for (var ei2 = 0; ei2 < nv; ei2++) {
        var ni2 = (ei2 + 1) % nv;
        var avgY = (verts[ei2][1] + verts[ni2][1]) / 2;
        if (avgY < minAvgY) { minAvgY = avgY; streetIdx = ei2; }
        if (avgY > maxAvgY) { maxAvgY = avgY; rearIdx = ei2; }
      }
    }
    return { streetIdx: streetIdx, rearIdx: rearIdx, method: method };
  }

  /* ------------------------------------------------------ street rotation */
  /* Faithful transcription of the S79 polygon-edge rotation block.
   * Returns a transform object T and the rotated, origin-normalized verts.
   * When no rotation is needed (street edge near-horizontal at bottom),
   * rotated=false and verts are returned unchanged.                        */
  function computeStreetRotation(verts, streetIdx) {
    var nv = verts.length;
    var sv1 = verts[streetIdx], sv2 = verts[(streetIdx + 1) % nv];
    var streetEdgeDx = sv2[0] - sv1[0], streetEdgeDy = sv2[1] - sv1[1];
    var streetEdgeAngle = Math.atan2(streetEdgeDy, streetEdgeDx);
    var rotForHoriz = -streetEdgeAngle;

    var c = polygonCentroid(verts);
    var lotCxR = c[0], lotCyR = c[1];

    // Flip test: street edge midpoint must land BELOW centroid after rotation
    var cosTest = Math.cos(rotForHoriz), sinTest = Math.sin(rotForHoriz);
    var streetMidX = (sv1[0] + sv2[0]) / 2, streetMidY = (sv1[1] + sv2[1]) / 2;
    var rotStreetY = (streetMidX - lotCxR) * sinTest + (streetMidY - lotCyR) * cosTest;
    if (rotStreetY > 0) {
      rotForHoriz += Math.PI;
    }
    while (rotForHoriz < 0) rotForHoriz += 2 * Math.PI;
    while (rotForHoriz >= 2 * Math.PI) rotForHoriz -= 2 * Math.PI;
    var rotDeg = rotForHoriz * 180 / Math.PI;

    var T = {
      rotated: false, rotRad: 0, rotDeg: rotDeg,
      cos: 1, sin: 0, cx: lotCxR, cy: lotCyR, mx: 0, my: 0
    };

    if (!(rotDeg > 3 && rotDeg < 357)) {
      return { T: T, verts: verts };
    }

    T.rotated = true;
    T.rotRad = rotForHoriz;
    T.cos = Math.cos(rotForHoriz);
    T.sin = Math.sin(rotForHoriz);

    var rotVerts = [], i, rdx, rdy;
    for (i = 0; i < nv; i++) {
      rdx = verts[i][0] - T.cx; rdy = verts[i][1] - T.cy;
      rotVerts.push([T.cx + rdx * T.cos - rdy * T.sin, T.cy + rdx * T.sin + rdy * T.cos]);
    }
    var rMinX = Infinity, rMinY = Infinity;
    for (i = 0; i < rotVerts.length; i++) {
      if (rotVerts[i][0] < rMinX) rMinX = rotVerts[i][0];
      if (rotVerts[i][1] < rMinY) rMinY = rotVerts[i][1];
    }
    T.mx = rMinX; T.my = rMinY;
    for (i = 0; i < rotVerts.length; i++) {
      rotVerts[i][0] -= rMinX;
      rotVerts[i][1] -= rMinY;
    }
    return { T: T, verts: rotVerts };
  }

  /* Apply the transform T to any point in original (unrotated) lot space.
   * This is the _rFn72 function from steps.js.                             */
  function applyTransform(T, x, y) {
    if (!T.rotated) return [x, y];
    var dx = x - T.cx, dy = y - T.cy;
    return [T.cx + dx * T.cos - dy * T.sin - T.mx, T.cy + dx * T.sin + dy * T.cos - T.my];
  }

  /* Invert the transform: drawing space -> original lot space.
   * (New in S84; used by the round-trip invariant tests.)                  */
  function invertTransform(T, x, y) {
    if (!T.rotated) return [x, y];
    var px = x + T.mx, py = y + T.my;
    var dx = px - T.cx, dy = py - T.cy;
    // inverse rotation: cos(-a)=cos(a), sin(-a)=-sin(a)
    return [T.cx + dx * T.cos + dy * T.sin, T.cy - dx * T.sin + dy * T.cos];
  }

  /* ------------------------------------------------------- edge scanning */

  /* Faithful transcription of _tightEdges (steps.js): tightest horizontal
   * polygon span across three scan Ys (top/mid/bottom of the house).       */
  function tightEdges(polyV, yTop, yMid, yBot) {
    var bestL = 0, bestR = Infinity, bestSpan = Infinity;
    var ys = [yTop, yMid, yBot];
    for (var si = 0; si < ys.length; si++) {
      var sy = ys[si], slx = Infinity, srx = -Infinity;
      for (var ei = 0; ei < polyV.length; ei++) {
        var pa = polyV[ei], pb = polyV[(ei + 1) % polyV.length];
        var ylo = Math.min(pa[1], pb[1]), yhi = Math.max(pa[1], pb[1]);
        if (sy < ylo || sy > yhi || ylo === yhi) continue;
        var tt = (sy - pa[1]) / (pb[1] - pa[1]);
        var xx = pa[0] + tt * (pb[0] - pa[0]);
        if (xx < slx) slx = xx;
        if (xx > srx) srx = xx;
      }
      if (slx === Infinity) slx = 0;
      if (srx === -Infinity) continue;
      var span = srx - slx;
      if (span < bestSpan) { bestSpan = span; bestL = slx; bestR = srx; }
    }
    return { left: bestL, right: bestR, span: bestSpan };
  }

  /* Faithful transcription of leftEdgeAtY (sitePlanView.js): left boundary
   * X at a given Y. Returns 0 for degenerate input (rectangle fallback).   */
  function leftEdgeAtY(verts, yVal) {
    if (!verts || verts.length < 3) return 0;
    var minX = Infinity;
    var n = verts.length;
    for (var ei = 0; ei < n; ei++) {
      var a = verts[ei], b = verts[(ei + 1) % n];
      var yLo = Math.min(a[1], b[1]), yHi = Math.max(a[1], b[1]);
      if (yVal < yLo || yVal > yHi || yLo === yHi) continue;
      var t = (yVal - a[1]) / (b[1] - a[1]);
      var xAt = a[0] + t * (b[0] - a[0]);
      if (xAt < minX) minX = xAt;
    }
    return minX === Infinity ? 0 : minX;
  }

  /* -------------------------------------------------------- house placing */
  /* Faithful transcription of the S79 positioning ladder:
   *   1. building centroid (if inside polygon)
   *   2. address point (if provided)
   *   3. centered fallback
   * "Dimensions are sacred, position is flexible. Never push to lot edge."
   *
   * Inputs (all in DRAWING space, i.e. already rotated/normalized):
   *   verts       polygon vertices
   *   lotW, lotD  bounding box dims
   *   hw, hd      house width/depth
   *   centroid    [x,y] building centroid or null
   *   addrPoint   [x,y] address point or null
   * Output: { offset, dist, method }                                        */
  function positionHouse(opts) {
    var verts = opts.verts, lotW = opts.lotW, lotD = opts.lotD;
    var hw2 = opts.hw, hd2 = opts.hd;
    var newDist, newOffset;

    /* S85: convert a tightEdges-relative placement into the stored
     * renderer-space offset (see OFFSET CONTRACT in the header). */
    function toStored(offTight, teLeft, d) {
      var houseLeftX = teLeft + offTight;                 // intended left edge
      var le = leftEdgeAtY(verts, d + hd2 / 2);           // renderer reference
      return { offset: Math.round((houseLeftX - le) * 10) / 10, houseLeftX: houseLeftX };
    }

    function placeAt(px, py, methodName) {
      var d = Math.max(5, Math.round(py - hd2 / 2));
      // NOTE: address-point path in steps.js uses py directly (not py-hd/2);
      // callers pass preAdjusted=true to reproduce that.
      if (opts && opts._rawY) d = Math.max(5, Math.round(py));
      if (d + hd2 > lotD - 2) d = Math.max(5, lotD - hd2 - 2);
      var houseCY = d + hd2 / 2;
      var te = tightEdges(verts, d + 2, houseCY, d + hd2 - 2);
      var availSpan = te.right - te.left;
      var off = Math.max(2, Math.round(px - hw2 / 2 - te.left));
      var maxOffset = Math.max(2, Math.round(availSpan - hw2 - 2));
      var centered = false;
      if (off > maxOffset) {
        off = Math.max(2, Math.round((availSpan - hw2) / 2));
        centered = true;
      }
      if (off < 2) off = 2;
      var st = toStored(off, te.left, d);
      return { offset: st.offset, dist: d, houseLeftX: st.houseLeftX,
               method: methodName + (centered ? "+centeredX" : "") };
    }

    if (opts.centroid && verts && verts.length >= 3 &&
        pointInPolygon(opts.centroid[0], opts.centroid[1], verts)) {
      return placeAt(opts.centroid[0], opts.centroid[1], "centroid");
    }

    if (opts.addrPoint && verts && verts.length >= 3) {
      // steps.js address-point path uses pLotY directly as dist
      var save = opts._rawY; opts._rawY = true;
      var r = placeAt(opts.addrPoint[0], opts.addrPoint[1], "addressPoint");
      opts._rawY = save;
      return r;
    }

    // Last resort: center on lot (bbox space). S85: also convert to
    // renderer space so the fallback truly renders centered on tapered lots.
    newDist = Math.min(Math.round(lotD * 0.3), 35);
    var fbLeft = Math.max(5, Math.round((lotW - hw2) / 2));
    var fbLe = (verts && verts.length >= 3) ? leftEdgeAtY(verts, newDist + hd2 / 2) : 0;
    newOffset = Math.round((fbLeft - fbLe) * 10) / 10;
    return { offset: newOffset, dist: newDist, houseLeftX: fbLeft, method: "centeredFallback" };
  }

  /* Where the RENDERER will actually draw the house left edge, given the
   * stored state values. (sitePlanView.js semantics.)                      */
  function rendererHouseX(verts, houseDistFromStreet, houseDepth, houseOffsetSide) {
    var houseMidY = houseDistFromStreet + houseDepth / 2;
    return leftEdgeAtY(verts, houseMidY) + houseOffsetSide;
  }

  return {
    polygonCentroid: polygonCentroid,
    boundingBox: boundingBox,
    edgeLengths: edgeLengths,
    pointInPolygon: pointInPolygon,
    detectStreetEdge: detectStreetEdge,
    computeStreetRotation: computeStreetRotation,
    applyTransform: applyTransform,
    invertTransform: invertTransform,
    tightEdges: tightEdges,
    leftEdgeAtY: leftEdgeAtY,
    positionHouse: positionHouse,
    rendererHouseX: rendererHouseX
  };
}));
