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
    return {
      id: -1, type: "add",
      w: w, d: 8, h: null,
      attachTo: parentId, attachEdge: edge,
      attachOffset: Math.max(0, Math.round((edgeLen - w) / 2)),
      corners: Object.assign({}, DEFAULT_CORNERS),
      joistDir: "perpendicular", stairs: null, label: "Zone"
    };
  }

  /* ---------- Build calc params for a zone ---------- */
  function buildZoneCalcParams(zone, p) {
    if (zone.type === "cutout") return null;
    var h = zone.h != null ? zone.h : (p.deckHeight || 4);
    return Object.assign({}, p, {
      deckWidth: zone.w, deckDepth: zone.d, deckHeight: h,
      joistDir: zone.joistDir || p.joistDir || "perpendicular",
      stairTemplate: zone.stairs ? zone.stairs.template : "None",
      stairLocation: zone.stairs ? zone.stairs.location : "none"
    });
  }

  /* ---------- Exports ---------- */
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
