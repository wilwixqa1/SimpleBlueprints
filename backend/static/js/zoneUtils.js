/* ===== zoneUtils.js =====
   Multi-zone position calculation, validation, and edge analysis.
   Supports additive zones AND subtractive cutouts.
   Loaded after engine.js, before planView.js.
   
   Exports on window.*:
     getZone0, getAllZones, getZoneById,
     getZoneRect, getAllZoneRects, getBoundingBox,
     getCompositeOutline, getExposedEdges, getAddableEdges,
     validateZone, addZoneDefaults, buildZoneCalcParams
*/

(function() {
  "use strict";

  /* ============================================================
     ZONE SCHEMA (reference)
     ============================================================
     {
       id:           Number,       // Unique, never reused (0 = main deck, virtual)
       type:         String,       // 'add' | 'cutout'
       w:            Number,       // Width (ft) along attachment edge
       d:            Number,       // Depth (ft) perpendicular to attachment edge
       h:            Number|null,  // Height override (null = inherit parent)
       attachTo:     Number,       // Parent zone ID
       attachEdge:   String,       // 'front'|'left'|'right' for add
                                   // 'front-left'|'front-right'|'back-left'|'back-right'|
                                   // 'front'|'left'|'right'|'back'|'interior' for cutout
       attachOffset: Number,       // Offset along edge (ft)
       interiorY:    Number,       // Y offset for interior cutouts only
       corners: {                  // Corner modifiers (Phase 2, schema only)
         FL: { type: 'square', size: 0 },
         FR: { type: 'square', size: 0 },
         BL: { type: 'square', size: 0 },
         BR: { type: 'square', size: 0 }
       },
       joistDir:     String,       // 'perpendicular'|'parallel'
       beamType:     String,       // 'dropped'|'flush' (flush = rim board as beam, no posts)
       stairs:       Object|null,
       label:        String
     }
  */

  var DEFAULT_CORNERS = {
    FL: { type: "square", size: 0 },
    FR: { type: "square", size: 0 },
    BL: { type: "square", size: 0 },
    BR: { type: "square", size: 0 }
  };

  /* ---------- Zone 0 virtual representation ---------- */
  function getZone0(p) {
    return {
      id: 0,
      type: "add",
      w: p.deckWidth || 16,
      d: p.deckDepth || 12,
      h: p.deckHeight || 4,
      attachTo: null,
      attachEdge: null,
      attachOffset: 0,
      corners: Object.assign({}, DEFAULT_CORNERS),
      joistDir: p.joistDir || "perpendicular",
      stairs: {
        template: p.stairTemplate,
        location: p.stairLocation,
        anchorX: p.stairAnchorX,
        anchorY: p.stairAnchorY,
        angle: p.stairAngle
      },
      label: "Main Deck"
    };
  }

  function getAllZones(p) {
    return [getZone0(p)].concat(p.zones || []);
  }

  function getZoneById(p, zoneId) {
    if (zoneId === 0) return getZone0(p);
    return (p.zones || []).find(function(z) { return z.id === zoneId; }) || null;
  }

  /* ---------- Absolute rectangle for one zone ---------- */
  function getZoneRect(zoneId, p) {
    if (zoneId === 0) {
      return { x: 0, y: 0, w: p.deckWidth || 16, d: p.deckDepth || 12 };
    }
    var zone = getZoneById(p, zoneId);
    if (!zone) return null;
    var pr = getZoneRect(zone.attachTo, p);
    if (!pr) return null;
    var off = zone.attachOffset || 0;

    if (zone.type === "cutout") return getCutoutRect(zone, pr);

    switch (zone.attachEdge) {
      case "front":
        return { x: pr.x + off, y: pr.y + pr.d, w: zone.w, d: zone.d };
      case "left":
        return { x: pr.x - zone.d, y: pr.y + off, w: zone.d, d: zone.w };
      case "right":
        return { x: pr.x + pr.w, y: pr.y + off, w: zone.d, d: zone.w };
      default: return null;
    }
  }

  function getCutoutRect(zone, parentRect) {
    var pr = parentRect;
    var cw = zone.w, cd = zone.d, off = zone.attachOffset || 0;

    switch (zone.attachEdge) {
      case "back-left":    return { x: pr.x,            y: pr.y,            w: cw, d: cd };
      case "back-right":   return { x: pr.x + pr.w - cw, y: pr.y,          w: cw, d: cd };
      case "front-left":   return { x: pr.x,            y: pr.y + pr.d - cd, w: cw, d: cd };
      case "front-right":  return { x: pr.x + pr.w - cw, y: pr.y + pr.d - cd, w: cw, d: cd };
      case "back":         return { x: pr.x + off,      y: pr.y,            w: cw, d: cd };
      case "front":        return { x: pr.x + off,      y: pr.y + pr.d - cd, w: cw, d: cd };
      case "left":         return { x: pr.x,            y: pr.y + off,      w: cd, d: cw };
      case "right":        return { x: pr.x + pr.w - cd, y: pr.y + off,    w: cd, d: cw };
      case "interior":
        return { x: pr.x + off, y: pr.y + (zone.interiorY || 0), w: cw, d: cd };
      default: return null;
    }
  }

  function getAllZoneRects(p) {
    return getAllZones(p).map(function(z) {
      return { id: z.id, zone: z, rect: getZoneRect(z.id, p) };
    }).filter(function(r) { return r.rect !== null; });
  }

  function getAdditiveRects(p) {
    return getAllZoneRects(p).filter(function(r) { return r.zone.type !== "cutout"; });
  }

  function getCutoutRects(p) {
    return getAllZoneRects(p).filter(function(r) { return r.zone.type === "cutout"; });
  }

  function getBoundingBox(p) {
    var rects = getAdditiveRects(p);
    if (rects.length === 0) return { x: 0, y: 0, w: 16, d: 12 };
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    rects.forEach(function(r) {
      minX = Math.min(minX, r.rect.x);
      minY = Math.min(minY, r.rect.y);
      maxX = Math.max(maxX, r.rect.x + r.rect.w);
      maxY = Math.max(maxY, r.rect.y + r.rect.d);
    });
    return { x: minX, y: minY, w: maxX - minX, d: maxY - minY };
  }

  /* ---------- Composite outline (union of adds minus cutouts) ----------
     Grid-based boolean: splits space at every zone boundary,
     marks cells as solid (in add, not in cut), merges into rectangles.
     Returns array of { x, y, w, d }.
  */
  function getCompositeOutline(p) {
    var adds = getAdditiveRects(p);
    var cuts = getCutoutRects(p);

    var xs = [], ys = [];
    adds.concat(cuts).forEach(function(r) {
      xs.push(r.rect.x, r.rect.x + r.rect.w);
      ys.push(r.rect.y, r.rect.y + r.rect.d);
    });
    xs = uniqueSorted(xs);
    ys = uniqueSorted(ys);
    if (xs.length < 2 || ys.length < 2) {
      return adds.map(function(r) { return r.rect; });
    }

    var nx = xs.length - 1, ny = ys.length - 1;
    var cells = [], visited = [];
    for (var yi = 0; yi < ny; yi++) {
      cells[yi] = [];
      visited[yi] = [];
      for (var xi = 0; xi < nx; xi++) {
        var cx = (xs[xi] + xs[xi + 1]) / 2;
        var cy = (ys[yi] + ys[yi + 1]) / 2;
        var inAdd = adds.some(function(r) {
          return cx > r.rect.x && cx < r.rect.x + r.rect.w &&
                 cy > r.rect.y && cy < r.rect.y + r.rect.d;
        });
        var inCut = cuts.some(function(r) {
          return cx > r.rect.x && cx < r.rect.x + r.rect.w &&
                 cy > r.rect.y && cy < r.rect.y + r.rect.d;
        });
        cells[yi][xi] = inAdd && !inCut;
        visited[yi][xi] = false;
      }
    }

    // Greedy rectangle merge
    var result = [];
    for (yi = 0; yi < ny; yi++) {
      for (xi = 0; xi < nx; xi++) {
        if (!cells[yi][xi] || visited[yi][xi]) continue;
        var xe = xi;
        while (xe < nx && cells[yi][xe] && !visited[yi][xe]) xe++;
        var ye = yi;
        var ok = true;
        while (ok && ye < ny) {
          for (var xc = xi; xc < xe; xc++) {
            if (!cells[ye][xc] || visited[ye][xc]) { ok = false; break; }
          }
          if (ok) ye++;
        }
        for (var ym = yi; ym < ye; ym++) {
          for (var xm = xi; xm < xe; xm++) visited[ym][xm] = true;
        }
        result.push({ x: xs[xi], y: ys[yi], w: xs[xe] - xs[xi], d: ys[ye] - ys[yi] });
      }
    }
    return result;
  }

  function uniqueSorted(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      var k = arr[i].toFixed(6);
      if (!seen[k]) { seen[k] = true; out.push(arr[i]); }
    }
    out.sort(function(a, b) { return a - b; });
    return out;
  }

  /* ---------- Exposed edges (from composite grid) ---------- */
  function getExposedEdges(p) {
    var adds = getAdditiveRects(p);
    var cuts = getCutoutRects(p);

    var xs = [], ys = [];
    adds.concat(cuts).forEach(function(r) {
      xs.push(r.rect.x, r.rect.x + r.rect.w);
      ys.push(r.rect.y, r.rect.y + r.rect.d);
    });
    xs = uniqueSorted(xs);
    ys = uniqueSorted(ys);
    if (xs.length < 2 || ys.length < 2) return [];

    var nx = xs.length - 1, ny = ys.length - 1;

    function isSolid(xi, yi) {
      if (xi < 0 || xi >= nx || yi < 0 || yi >= ny) return false;
      var cx = (xs[xi] + xs[xi + 1]) / 2;
      var cy = (ys[yi] + ys[yi + 1]) / 2;
      var inAdd = adds.some(function(r) {
        return cx > r.rect.x && cx < r.rect.x + r.rect.w &&
               cy > r.rect.y && cy < r.rect.y + r.rect.d;
      });
      var inCut = cuts.some(function(r) {
        return cx > r.rect.x && cx < r.rect.x + r.rect.w &&
               cy > r.rect.y && cy < r.rect.y + r.rect.d;
      });
      return inAdd && !inCut;
    }

    var raw = [];
    for (var yi = 0; yi < ny; yi++) {
      for (var xi = 0; xi < nx; xi++) {
        if (!isSolid(xi, yi)) continue;
        if (!isSolid(xi, yi - 1))
          raw.push({ x1: xs[xi], y1: ys[yi], x2: xs[xi+1], y2: ys[yi], dir: "h", pos: ys[yi] });
        if (!isSolid(xi, yi + 1))
          raw.push({ x1: xs[xi], y1: ys[yi+1], x2: xs[xi+1], y2: ys[yi+1], dir: "h", pos: ys[yi+1] });
        if (!isSolid(xi - 1, yi))
          raw.push({ x1: xs[xi], y1: ys[yi], x2: xs[xi], y2: ys[yi+1], dir: "v", pos: xs[xi] });
        if (!isSolid(xi + 1, yi))
          raw.push({ x1: xs[xi+1], y1: ys[yi], x2: xs[xi+1], y2: ys[yi+1], dir: "v", pos: xs[xi+1] });
      }
    }

    var merged = mergeSegments(raw);

    // Filter house wall
    var z0 = getZoneRect(0, p);
    merged = merged.filter(function(e) {
      if (e.dir === "h" && Math.abs(e.y1) < 0.01 &&
          e.x1 >= z0.x - 0.01 && e.x2 <= z0.x + z0.w + 0.01) return false;
      return true;
    });

    return merged.map(function(e) {
      return { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, dir: e.dir };
    });
  }

  function mergeSegments(edges) {
    var groups = {};
    edges.forEach(function(e) {
      var k = e.dir + ":" + e.pos.toFixed(4);
      if (!groups[k]) groups[k] = [];
      groups[k].push(e);
    });
    var merged = [];
    Object.keys(groups).forEach(function(k) {
      var segs = groups[k];
      if (segs[0].dir === "h") {
        segs.sort(function(a, b) { return a.x1 - b.x1; });
        var c = Object.assign({}, segs[0]);
        for (var i = 1; i < segs.length; i++) {
          if (segs[i].x1 <= c.x2 + 0.01) { c.x2 = Math.max(c.x2, segs[i].x2); }
          else { merged.push(c); c = Object.assign({}, segs[i]); }
        }
        merged.push(c);
      } else {
        segs.sort(function(a, b) { return a.y1 - b.y1; });
        var c2 = Object.assign({}, segs[0]);
        for (var j = 1; j < segs.length; j++) {
          if (segs[j].y1 <= c2.y2 + 0.01) { c2.y2 = Math.max(c2.y2, segs[j].y2); }
          else { merged.push(c2); c2 = Object.assign({}, segs[j]); }
        }
        merged.push(c2);
      }
    });
    return merged;
  }

  function getAddableEdges(p) {
    return getExposedEdges(p).filter(function(e) {
      // Horizontal edges at y>0 = front-ish, vertical edges = sides
      // Exclude house wall edges (already filtered)
      return true;
    });
  }

  /* ---------- Validation ---------- */
  function validateZone(zone, p) {
    var parentRect = getZoneRect(zone.attachTo, p);
    if (!parentRect) return { valid: false, msg: "Parent zone not found" };
    if (zone.w < 2) return { valid: false, msg: "Minimum width is 2 ft" };
    if (zone.d < 2) return { valid: false, msg: "Minimum depth is 2 ft" };

    if (zone.type === "cutout") {
      if (zone.w >= parentRect.w) return { valid: false, msg: "Cutout wider than parent" };
      if (zone.d >= parentRect.d) return { valid: false, msg: "Cutout deeper than parent" };
      var cr = getCutoutRect(zone, parentRect);
      if (!cr) return { valid: false, msg: "Invalid cutout position" };
      if (cr.x < parentRect.x - 0.01 || cr.y < parentRect.y - 0.01 ||
          cr.x + cr.w > parentRect.x + parentRect.w + 0.01 ||
          cr.y + cr.d > parentRect.y + parentRect.d + 0.01) {
        return { valid: false, msg: "Cutout outside parent bounds" };
      }
      return { valid: true };
    }

    var edgeLen = (zone.attachEdge === "front") ? parentRect.w : parentRect.d;
    if (zone.attachOffset < 0) return { valid: false, msg: "Offset cannot be negative" };
    if (zone.attachOffset + zone.w > edgeLen + 0.01) {
      return { valid: false, msg: "Extends past parent edge (" + edgeLen.toFixed(1) + " ft)" };
    }

    var siblings = (p.zones || []).filter(function(z) {
      return z.id !== zone.id && z.type === "add" &&
             z.attachTo === zone.attachTo && z.attachEdge === zone.attachEdge;
    });
    for (var i = 0; i < siblings.length; i++) {
      var s = siblings[i];
      if (zone.attachOffset < s.attachOffset + s.w - 0.01 &&
          zone.attachOffset + zone.w > s.attachOffset + 0.01) {
        return { valid: false, msg: "Overlaps with " + (s.label || "Zone " + s.id) };
      }
    }
    return { valid: true };
  }

  /* ---------- Defaults ---------- */
  function addZoneDefaults(parentId, edge, type, p) {
    var parentRect = getZoneRect(parentId, p);
    if (!parentRect) return null;

    if (type === "cutout") {
      return {
        id: -1, type: "cutout",
        w: Math.min(4, parentRect.w / 2),
        d: Math.min(4, parentRect.d / 2),
        h: null, attachTo: parentId, attachEdge: edge, attachOffset: 0,
        interiorY: 0,
        corners: Object.assign({}, DEFAULT_CORNERS),
        joistDir: "perpendicular", stairs: null, label: "Cutout"
      };
    }

    var edgeLen = (edge === "front") ? parentRect.w : parentRect.d;
    var w = Math.min(8, edgeLen);
    var d = 8;
    var area = w * d;
    return {
      id: -1, type: "add",
      w: w, d: d, h: null,
      attachTo: parentId, attachEdge: edge,
      attachOffset: Math.max(0, Math.round((edgeLen - w) / 2)),
      corners: Object.assign({}, DEFAULT_CORNERS),
      beamType: (area < 80 || d < 6) ? "flush" : "dropped",
      joistDir: "perpendicular", stairs: null, label: "Zone"
    };
  }

  /* ---------- Build calc params for a zone ---------- */
  function buildZoneCalcParams(zone, p) {
    if (zone.type === "cutout") return null;
    var mainH = p.deckHeight || 4;
    var h = zone.h != null ? zone.h : mainH;
    // S81: flush beam is only valid when zone shares the main deck height.
    // If the zone is at a different elevation, the rim board of the main deck
    // cannot physically carry its joists, so force dropped beam.
    var rawBeamType = zone.beamType || "dropped";
    var effectiveBeamType = (zone.h != null && Math.abs(zone.h - mainH) > 0.01)
      ? "dropped"
      : rawBeamType;
    return Object.assign({}, p, {
      deckWidth: zone.w, deckDepth: zone.d, deckHeight: h,
      joistDir: zone.joistDir || p.joistDir || "perpendicular",
      beamType: effectiveBeamType,
      stairTemplate: zone.stairs ? zone.stairs.template : "None",
      stairLocation: zone.stairs ? zone.stairs.location : "none"
    });
  }

  /* ---------- Exports ---------- */
  // S81: single source of truth for whether a zone's beam type is forced
  // to dropped because of a height mismatch with the main deck.
  function getEffectiveBeamType(zone, p) {
    if (!zone || zone.type === "cutout") return "dropped";
    var mainH = (p && p.deckHeight) || 4;
    var raw = zone.beamType || "dropped";
    if (zone.h != null && Math.abs(zone.h - mainH) > 0.01) return "dropped";
    return raw;
  }

  /* ---------- S81: Shared edges between zones ----------
     Returns an array of shared edge segments between every pair of additive
     rects (including main deck = id 0). Each segment is the overlap region
     where two rects share a common boundary line.
       { aId, bId, aH, bH, deltaIn, axis, x1, y1, x2, y2, length }
     axis: 'vertical' (constant x) | 'horizontal' (constant y)
     deltaIn: |aH - bH| in inches. aH and bH are in feet.
     Coordinates are deck-local (same space as getZoneRect).
  */
  function getSharedEdges(p) {
    var mainH = (p && p.deckHeight) || 4;
    var rects = getAdditiveRects(p);
    var resolved = rects.map(function(r) {
      var h;
      if (r.id === 0) h = mainH;
      else if (r.zone && r.zone.h != null) h = r.zone.h;
      else h = mainH;
      return { id: r.id, h: h, rect: r.rect };
    });
    var TOL = 0.01;
    var out = [];
    for (var i = 0; i < resolved.length; i++) {
      for (var j = i + 1; j < resolved.length; j++) {
        var a = resolved[i], b = resolved[j];
        var ar = a.rect, br = b.rect;
        var axMin = ar.x, axMax = ar.x + ar.w;
        var ayMin = ar.y, ayMax = ar.y + ar.d;
        var bxMin = br.x, bxMax = br.x + br.w;
        var byMin = br.y, byMax = br.y + br.d;
        var deltaFt = Math.abs(a.h - b.h);
        var deltaIn = +(deltaFt * 12).toFixed(2);
        // Vertical shared edge: a.right == b.left (or vice versa) with y-overlap
        var sharedX = null;
        if (Math.abs(axMax - bxMin) < TOL) sharedX = axMax;
        else if (Math.abs(bxMax - axMin) < TOL) sharedX = axMin;
        if (sharedX !== null) {
          var y1 = Math.max(ayMin, byMin);
          var y2 = Math.min(ayMax, byMax);
          if (y2 - y1 > TOL) {
            out.push({ aId: a.id, bId: b.id, aH: a.h, bH: b.h, deltaIn: deltaIn,
              axis: 'vertical', x1: sharedX, y1: y1, x2: sharedX, y2: y2,
              length: +(y2 - y1).toFixed(3) });
          }
        }
        // Horizontal shared edge: a.bottom == b.top (or vice versa) with x-overlap
        var sharedY = null;
        if (Math.abs(ayMax - byMin) < TOL) sharedY = ayMax;
        else if (Math.abs(byMax - ayMin) < TOL) sharedY = ayMin;
        if (sharedY !== null) {
          var x1 = Math.max(axMin, bxMin);
          var x2 = Math.min(axMax, bxMax);
          if (x2 - x1 > TOL) {
            out.push({ aId: a.id, bId: b.id, aH: a.h, bH: b.h, deltaIn: deltaIn,
              axis: 'horizontal', x1: x1, y1: sharedY, x2: x2, y2: sharedY,
              length: +(x2 - x1).toFixed(3) });
          }
        }
      }
    }
    return out;
  }

  /* ---------- S81: IRC classification of a height delta ----------
     Returns one of:
       'flush'        deltaIn < 0.5  (effectively same level)
       'tripping'     0.5 <= deltaIn < 4    (R311.7.5.1 violation, no compliant single step)
       'single-step'  4 <= deltaIn < 7.75   (one riser, no handrail required)
       'multi-step'   7.75 <= deltaIn < 30  (multi-riser, no guard required)
       'guarded'      30 <= deltaIn < 147   (multi-riser + guard required, R312.1.1)
       'over-max'     deltaIn >= 147        (R311.7.3, intermediate landing required)
  */
  function classifyHeightDelta(deltaIn) {
    if (deltaIn == null || deltaIn < 0.5) return 'flush';
    if (deltaIn < 4) return 'tripping';
    if (deltaIn < 7.75) return 'single-step';
    if (deltaIn < 30) return 'multi-step';
    if (deltaIn < 147) return 'guarded';
    return 'over-max';
  }

  /* ---------- S81: Suggested riser plan for a delta ----------
     Returns { nRisers, riserHeightIn, needsGuard, needsHandrail, needsLanding,
               classification, irc }
     riserHeightIn is uniform across the flight (R311.7.5.1).
  */
  function suggestRiserPlan(deltaIn) {
    var cls = classifyHeightDelta(deltaIn);
    if (cls === 'flush' || cls === 'tripping' || cls === 'over-max') {
      return { nRisers: 0, riserHeightIn: 0, needsGuard: cls === 'over-max' || (deltaIn >= 30),
        needsHandrail: false, needsLanding: cls === 'over-max', classification: cls, irc: cls === 'tripping' ? 'R311.7.5.1' : (cls === 'over-max' ? 'R311.7.3' : null) };
    }
    var nRisers = Math.max(1, Math.ceil(deltaIn / 7.75));
    var rh = +(deltaIn / nRisers).toFixed(3);
    return {
      nRisers: nRisers,
      riserHeightIn: rh,
      needsGuard: deltaIn >= 30,
      needsHandrail: nRisers >= 4,
      needsLanding: false,
      classification: cls,
      irc: null
    };
  }

  /* ---------- S81d: Infer stair landing target from placement ----------
     Given a stair (with .zoneId = anchor zone, .location = front|left|right),
     determine what's on the other side of that edge:
       - If another additive zone shares that edge, return its id (transitional stair)
       - Otherwise, return null (grade landing, existing behavior)

     The user never picks landingType. This helper derives it from where they
     placed the stair. Called by addStair / updateStair on location change.
     The "smallest valid rise" default is computed by pickBestStairLocation below.
  */
  function inferStairLanding(stair, p) {
    if (!stair) return null;
    var anchorId = stair.zoneId || 0;
    var anchorRect = getZoneRect(anchorId, p);
    if (!anchorRect) return null;
    var loc = stair.location || 'front';
    var TOL = 0.01;
    // Map location -> edge segment of anchor rect, in deck-local coords.
    // 'front' = +y edge (away from house), 'left' = -x, 'right' = +x.
    var edge;
    if (loc === 'front') {
      edge = { axis: 'horizontal', y: anchorRect.y + anchorRect.d,
               x1: anchorRect.x, x2: anchorRect.x + anchorRect.w };
    } else if (loc === 'left') {
      edge = { axis: 'vertical', x: anchorRect.x,
               y1: anchorRect.y, y2: anchorRect.y + anchorRect.d };
    } else if (loc === 'right') {
      edge = { axis: 'vertical', x: anchorRect.x + anchorRect.w,
               y1: anchorRect.y, y2: anchorRect.y + anchorRect.d };
    } else {
      return null; // unknown location, treat as grade
    }
    // Walk all additive zones; if one's rect shares this edge with overlap, return its id.
    var rects = getAdditiveRects(p);
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (r.id === anchorId) continue;
      var rr = r.rect;
      if (edge.axis === 'horizontal') {
        // Other zone's -y edge (rr.y) must equal edge.y (anchor's +y)
        if (Math.abs(rr.y - edge.y) > TOL) continue;
        var ox1 = Math.max(edge.x1, rr.x);
        var ox2 = Math.min(edge.x2, rr.x + rr.w);
        if (ox2 - ox1 > TOL) return r.id;
      } else {
        // vertical
        // Other zone's edge x (either rr.x or rr.x+rr.w) must equal edge.x
        var matchLeft = Math.abs(rr.x + rr.w - edge.x) < TOL;
        var matchRight = Math.abs(rr.x - edge.x) < TOL;
        if (!matchLeft && !matchRight) continue;
        var oy1 = Math.max(edge.y1, rr.y);
        var oy2 = Math.min(edge.y2, rr.y + rr.d);
        if (oy2 - oy1 > TOL) return r.id;
      }
    }
    return null; // grade
  }

  /* ---------- S81d: Pick best stair location for a new stair on a zone ----------
     Opinionated default: among front/left/right, pick the location with the
     smallest *valid* rise. Valid = rise > 0.5" (else no stair needed) and
     rise < 147" (else needs intermediate landing, R311.7.3, not yet supported).
     Ties broken by preferring 'front' > 'left' > 'right' (matches existing default).
     Returns { location, landsOnZoneId, riseIn } or null if no valid location.
  */
  function pickBestStairLocation(anchorZoneId, p) {
    var mainH = (p && p.deckHeight) || 4;
    var anchor = getZoneById(anchorZoneId, p);
    var fromH;
    if (anchorZoneId === 0) fromH = mainH;
    else if (anchor && anchor.h != null) fromH = anchor.h;
    else fromH = mainH;
    var locs = ['front', 'left', 'right'];
    var best = null;
    for (var i = 0; i < locs.length; i++) {
      var loc = locs[i];
      var fakeStair = { zoneId: anchorZoneId, location: loc };
      var landsId = inferStairLanding(fakeStair, p);
      var toH;
      if (landsId == null) toH = 0; // grade
      else {
        var tz = getZoneById(landsId, p);
        toH = (tz && tz.h != null) ? tz.h : mainH;
      }
      var riseIn = Math.abs(fromH - toH) * 12;
      if (riseIn < 0.5) continue; // no stair needed
      if (riseIn >= 147) continue; // R311.7.3, not yet supported
      if (best === null || riseIn < best.riseIn) {
        best = { location: loc, landsOnZoneId: landsId, riseIn: +riseIn.toFixed(2) };
      }
    }
    return best;
  }

  /* ---------- S81d: Infer where a stair lands based on its placement ----------
     A stair is anchored to its `zoneId` (the upper deck) on a specific edge
     (front/left/right). This helper looks at what is on the other side of that
     edge and returns the id of the lower zone the stair lands on, or null if
     the stair lands on grade.

     Inputs:
       stair: { zoneId, location }  -- only zoneId and location are read
       p:     full state object
     Returns: number (zone id of landing zone) or null (grade)

     Rules:
       - Walks getSharedEdges() to find any edge between stair.zoneId and
         another additive zone that touches the named side of the parent.
       - "front" means the edge at max-y of the parent rect.
       - "left" means the edge at min-x of the parent rect.
       - "right" means the edge at max-x of the parent rect.
       - Picks the candidate with the smallest height delta where the upper
         zone (stair.zoneId) is HIGHER than the candidate. A stair never lands
         on a higher surface.
       - If no qualifying shared edge exists, returns null (grade).
       - Tolerance-based to avoid float drift (matches getSharedEdges TOL).
  */
  function inferStairLanding(stair, p) {
    if (!stair || stair.zoneId == null) return null;
    var parentRect = getZoneRect(stair.zoneId, p);
    if (!parentRect) return null;
    var mainH = (p && p.deckHeight) || 4;
    var parentZone = getZoneById(stair.zoneId, p);
    var parentH = (parentZone && parentZone.h != null) ? parentZone.h
                  : (stair.zoneId === 0 ? mainH : mainH);
    var loc = stair.location || "front";
    var TOL = 0.01;
    // Determine the world-coord line of the parent edge the stair sits on.
    var edgeAxis, edgeCoord;
    if (loc === "front")      { edgeAxis = "horizontal"; edgeCoord = parentRect.y + parentRect.d; }
    else if (loc === "back")  { edgeAxis = "horizontal"; edgeCoord = parentRect.y; }
    else if (loc === "left")  { edgeAxis = "vertical";   edgeCoord = parentRect.x; }
    else if (loc === "right") { edgeAxis = "vertical";   edgeCoord = parentRect.x + parentRect.w; }
    else return null;
    var shared = getSharedEdges(p);
    var best = null;
    for (var i = 0; i < shared.length; i++) {
      var e = shared[i];
      if (e.aId !== stair.zoneId && e.bId !== stair.zoneId) continue;
      if (e.axis !== edgeAxis) continue;
      var lineCoord = edgeAxis === "horizontal" ? e.y1 : e.x1;
      if (Math.abs(lineCoord - edgeCoord) > TOL) continue;
      // Identify the other zone and confirm the stair zone is the higher side
      var otherId = (e.aId === stair.zoneId) ? e.bId : e.aId;
      var otherH  = (e.aId === stair.zoneId) ? e.bH  : e.aH;
      if (parentH - otherH < 0.5 / 12) continue; // not enough delta to need stair down
      if (!best || (parentH - otherH) < (best.delta)) {
        best = { id: otherId, delta: parentH - otherH };
      }
    }
    return best ? best.id : null;
  }

  window.getEffectiveBeamType = getEffectiveBeamType;
  window.getSharedEdges = getSharedEdges;
  window.classifyHeightDelta = classifyHeightDelta;
  window.suggestRiserPlan = suggestRiserPlan;
  window.inferStairLanding = inferStairLanding;
  window.inferStairLanding = inferStairLanding;
  window.pickBestStairLocation = pickBestStairLocation;
  window.getZone0 = getZone0;
  window.getAllZones = getAllZones;
  window.getZoneById = getZoneById;
  window.getZoneRect = getZoneRect;
  window.getAllZoneRects = getAllZoneRects;
  window.getAdditiveRects = getAdditiveRects;
  window.getCutoutRects = getCutoutRects;
  window.getBoundingBox = getBoundingBox;
  window.getCompositeOutline = getCompositeOutline;
  window.getExposedEdges = getExposedEdges;
  window.getAddableEdges = getAddableEdges;
  window.validateZone = validateZone;
  window.addZoneDefaults = addZoneDefaults;
  window.buildZoneCalcParams = buildZoneCalcParams;

})();
