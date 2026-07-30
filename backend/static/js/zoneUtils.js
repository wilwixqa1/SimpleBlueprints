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

// S87: single source of truth for the zone cap (UI, reducer, AI action all read this)
window.MAX_ADD_ZONES = 3;
window.atZoneCap = function(p) { return ((p && p.zones) || []).filter(function(z){ return z.type === "add"; }).length >= window.MAX_ADD_ZONES; };

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
      label: "Deck A"
    };
  }

  // ---- S105: ONE naming rule. Mirrored by section_name() in zone_utils.py. ----
  //
  // WHY THIS EXISTS. "Zone" already means ZONING DISTRICT on a permit site plan.
  // Measured across all four approved PPRBD reference sets: the word appears
  // exactly once, as "ZONE: R1-6" on Meadowview's site plan. It is never used
  // for a part of a deck. The sets label deck parts DECK A / DECK B (9 hits),
  // so we do too. We were printing "ZONE 1" onto a sheet next to zoning
  // setbacks, which is not a preference problem, it is a wrong word.
  //
  // The rule was previously written inline in eight places across five files.
  // Every notch bug so far has been that same shape (S104 doc section 4.4), so
  // it lives here and everything calls it.
  //
  // LETTERS FOLLOW POSITION, NOT ID. Ids are never reused, so lettering by id
  // leaves "Deck A, Deck C" after a delete. A gap like that on a submitted
  // sheet reads as a missing section.
  //
  // CUTOUTS ARE NOT DECK PARTS. They are holes, they never consume a letter,
  // and "cutout" collides with nothing, so it stays.
  var AUTO_LABEL = /^(zone|cutout|main deck)(\s+\d+)?$/i;

  function isAutoLabel(s) {
    return !s || AUTO_LABEL.test(String(s).trim());
  }

  function sectionLetter(i) {
    // 0->A, 25->Z, 26->AA. MAX_ADD_ZONES=3 means we never pass D in practice.
    var s = "";
    i = i | 0;
    do { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0);
    return s;
  }

  // Display name for a zone id. Zone 0 is virtual and its label is synthesised
  // by getZone0(), never typed by a user, so it is always "Deck A".
  function sectionName(zoneId, p) {
    if (zoneId === 0 || zoneId === "0") return "Deck A";
    var zones = (p && p.zones) || [];
    var addIdx = 0, cutIdx = 0;
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i];
      var isCut = z.type === "cutout";
      if (isCut) { cutIdx++; } else { addIdx++; }
      if (z.id === zoneId) {
        if (!isAutoLabel(z.label)) return z.label;
        return isCut ? ("Cutout " + cutIdx) : ("Deck " + sectionLetter(addIdx));
      }
    }
    return "Deck " + sectionLetter(zoneId);
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
  // stairOpenings (P1.4a parity): optional list of [edgeY, x0, x1] world-space
  // spans where a front stair descends through an exposed horizontal edge (the
  // notch-back edge). Any horizontal edge at edgeY has that span removed so no
  // rail is drawn across the stairway. null/empty -> flat behavior unchanged.
  function getExposedEdges(p, stairOpenings) {
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

    // Phase 3 (P1.4a parity, generalised S103 push 5): remove railing across
    // stair openings. Mirrors the stair_openings phase of backend
    // get_exposed_edges, INCLUDING vertical edges.
    //
    // WILL'S RULE: if there are stairs, there is never a railing across them.
    // This used to skip every non-horizontal edge, so a left or right stair
    // (angle 90/270, which lands on a vertical edge) had a railing drawn
    // straight across it.
    //
    // Opening shapes accepted, matching the backend:
    //   [coord, a, b]            legacy 3-element, HORIZONTAL edge at y=coord
    //   ["h"|"v", coord, a, b]   explicit
    if (stairOpenings && stairOpenings.length) {
      var norm = stairOpenings.map(function(o) {
        return (o.length === 4) ? [o[0], o[1], o[2], o[3]] : ["h", o[0], o[1], o[2]];
      });
      var out = [];
      merged.forEach(function(e) {
        if (e.dir !== "h" && e.dir !== "v") { out.push(e); return; }
        var coord = (e.dir === "h") ? e.y1 : e.x1;
        var a = (e.dir === "h") ? Math.min(e.x1, e.x2) : Math.min(e.y1, e.y2);
        var b = (e.dir === "h") ? Math.max(e.x1, e.x2) : Math.max(e.y1, e.y2);
        var blockers = [];
        norm.forEach(function(o) {
          if (o[0] === e.dir && Math.abs(o[1] - coord) < 0.01) blockers.push([o[2], o[3]]);
        });
        if (!blockers.length) { out.push(e); return; }
        var dir = e.dir;
        _subtractSegments(a, b, blockers).forEach(function(seg) {
          if (seg[1] - seg[0] > 0.05) {
            if (dir === "h") {
              out.push({ x1: seg[0], y1: coord, x2: seg[1], y2: coord, dir: "h", pos: coord });
            } else {
              out.push({ x1: coord, y1: seg[0], x2: coord, y2: seg[1], dir: "v", pos: coord });
            }
          }
        });
      });
      merged = out;
    }

    return merged.map(function(e) {
      return { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, dir: e.dir };
    });
  }

  // JS port of zone_utils._subtract_segments: subtract [blockStart, blockEnd]
  // spans from range [start, end]. Returns array of [s, e] survivor segments.
  function _subtractSegments(start, end, blockers) {
    var bs = blockers.slice().sort(function(a, b) { return a[0] - b[0]; });
    var result = [];
    var cur = start;
    bs.forEach(function(b) {
      if (b[0] > cur + 0.01) result.push([cur, b[0]]);
      cur = Math.max(cur, b[1]);
    });
    if (cur < end - 0.01) result.push([cur, end]);
    return result;
  }

  // computeStairOpenings (P1.a): mirror of draw_plan's opening computation.
  // Returns [edgeY, x0, x1] world-space spans for front stairs on a notched
  // deck, or null when there's no front cutout (flat decks unaffected). The
  // main-deck front profile is supplied for zone 0 only, matching resolve_all_stairs.
  function computeStairOpenings(p) {
    // Mirror of backend stair_utils.build_front_stair_openings.
    //
    // S103 push 5 removed two gates that between them meant most stairs got a
    // railing drawn across them:
    //   1. `if (!cuts.length) return null` -- only NOTCHED decks got openings,
    //      so a plain rectangular deck with stairs was fenced off. That gate
    //      dates to S91 and survived seven sessions.
    //   2. `angle % 360 !== 0` -- front stairs only, so left/right stairs were
    //      fenced off on every deck shape.
    // Off-axis (rotated) stairs are still skipped: a bounding box would
    // over-cut, which is the S81e mistake.
    if (!window.getStairPlacementForZone) return null;
    var W = p.deckWidth || p.width || 16, D = p.deckDepth || p.depth || 12;
    var cuts = getCutoutRects(p);
    var prof = (cuts.length && window.frontEdgeProfile)
      ? window.frontEdgeProfile(W, D, cuts) : null;
    var openings = [];
    (p.deckStairs || []).forEach(function(st) {
      var zoneId = st.zoneId || 0;
      var zr = getZoneRect(zoneId, p);
      if (!zr) return;
      var fp = (zoneId === 0) ? prof : null;
      var pl = window.getStairPlacementForZone(st, zr, fp);
      var ang = ((Math.round(pl.angle || 0) % 360) + 360) % 360;
      var sw = st.width || 4;
      var wax = zr.x + pl.anchorX, way = zr.y + pl.anchorY;
      if (ang === 0 || ang === 180) {
        openings.push(["h", way, wax - sw / 2, wax + sw / 2]);
      } else if (ang === 90 || ang === 270) {
        openings.push(["v", wax, way - sw / 2, way + sw / 2]);
      }
    });
    return openings.length ? openings : null;
  }

  // stairFootprintRects (S100): world-space rects for EVERY part of a stair
  // (all runs + all landings), given a resolved stair geometry, its world
  // anchor and its rotation. Returns [{xMin,xMax,zMin,zMax,topEl,botEl}, ...]
  // where topEl/botEl are elevations RELATIVE TO THE DECK SURFACE (0 = deck
  // top, negative = below).
  //
  // WHY THIS EXISTS: consumers used to approximate a stair's deck-plane
  // footprint with runs[0] alone. For a STRAIGHT stair runs[0] IS the whole
  // stair, so that was correct -- and that is exactly why straight stairs
  // always rendered right. Every other template has landings and further
  // runs that were invisible to the footprint, so nothing was cut for them
  // and the stair clipped through solid deck (S97 P0-3D).
  //
  // The union of real rects is deliberately NOT the bbox: the bbox spans the
  // dead space between folded runs, which is what caused the spurious 4ft
  // hole S81e reverted. Union is strictly tighter than bbox and strictly
  // larger than runs[0].
  //
  // ELEVATION (S100 push 11): a part that has already descended below the
  // deck framing passes UNDER the deck and must NOT cut a hole -- e.g. the
  // foot of an L-stair, or the lower runs of a switchback/wrap. Callers
  // filter on topEl via stairPartsAtDeckLevel().
  function stairFootprintRects(sg, wax, waz, angle) {
    if (!sg) return [];
    var ang = Math.round(angle || 0) % 360;
    if (ang < 0) ang += 360;
    function toWorld(r) {
      if (ang === 0)   return { xMin: wax + r.x, xMax: wax + r.x + r.w, zMin: waz + r.y, zMax: waz + r.y + r.h };
      if (ang === 90)  return { xMin: wax + r.y, xMax: wax + r.y + r.h, zMin: waz - (r.x + r.w), zMax: waz - r.x };
      if (ang === 270) return { xMin: wax - (r.y + r.h), xMax: wax - r.y, zMin: waz + r.x, zMax: waz + r.x + r.w };
      return { xMin: wax - (r.x + r.w), xMax: wax - r.x, zMin: waz - (r.y + r.h), zMax: waz - r.y };
    }
    var riseFt = (sg.riseIn || 0) / 12;
    var out = [];
    var cum = 0;
    // Runs descend in declaration order; each landing sits at the elevation
    // reached by the runs preceding it.
    var landingEl = {};
    (sg.runs || []).forEach(function(it, i) {
      var top = -cum * riseFt;
      cum += (it.risers || 0);
      var bot = -cum * riseFt;
      var b = toWorld(it.rect);
      b.topEl = top; b.botEl = bot; b.part = 'run' + i;
      out.push(b);
      landingEl[i] = bot;
    });
    (sg.landings || []).forEach(function(it, i) {
      var el = (landingEl[i] != null) ? landingEl[i] : 0;
      var b = toWorld(it.rect);
      b.topEl = el; b.botEl = el; b.part = 'landing' + i;
      out.push(b);
    });
    return out;
  }

  // stairPartsNeedingOpening (S100 push 12): a stair part needs a hole in the
  // deck when a person USING it would not have headroom -- not merely when it
  // sits at deck level.
  //
  // Push 11 got this wrong in both directions. It kept only parts whose top
  // was at/above the framing, which (a) correctly dropped the foot of an
  // L-stair that truly passes underneath, but (b) also dropped the LANDING,
  // leaving decking over a platform people stand on. On a 4ft-high deck an
  // L-Left landing sits 2.75ft down: 33in of headroom where IRC R311.7.2
  // requires 80in. You cannot walk onto that landing.
  //
  // Rule: measure clear height from the top of the part to the underside of
  // the deck framing. If it is less than the required headroom, that part is
  // occupied space and the deck must open above it. Parts far enough below
  // (a run that has descended past headroom depth) pass under and need no cut.
  var STAIR_HEADROOM_FT = 80 / 12;  // IRC R311.7.2 -- 6ft-8in
  function stairPartsNeedingOpening(rects, frameDepthFt, headroomFt) {
    var fd = (frameDepthFt == null) ? 0.77 : frameDepthFt;
    var need = (headroomFt == null) ? STAIR_HEADROOM_FT : headroomFt;
    return (rects || []).filter(function(b) {
      if (b.topEl == null) return true;          // no elevation info -> conservative
      var clear = -b.topEl - fd;                 // top of part to underside of framing
      return clear < need - 0.01;
    });
  }

  // clipRectsTo (S100): keep only the portions of `rects` that fall inside
  // the given deck-plane bounds. Rects with no real overlap are dropped, so
  // an edge stair that sits entirely off the deck yields [] (no cut) --
  // preserving today's correct behavior for edge-anchored straight stairs.
  function clipRectsTo(rects, xMin, xMax, zMin, zMax, eps) {
    var e = (eps == null) ? 0.02 : eps;
    var out = [];
    (rects || []).forEach(function(b) {
      var x0 = Math.max(b.xMin, xMin), x1 = Math.min(b.xMax, xMax);
      var z0 = Math.max(b.zMin, zMin), z1 = Math.min(b.zMax, zMax);
      if (x1 - x0 > e && z1 - z0 > e) {
        out.push({ xMin: x0, xMax: x1, zMin: z0, zMax: z1,
          topEl: b.topEl, botEl: b.botEl, part: b.part });
      }
    });
    return out;
  }

  // unionSpan (S100): collapse clipped footprint rects to the axis-aligned
  // span the deck3d gap consumers expect.
  function unionSpan(rects) {
    if (!rects || !rects.length) return null;
    var xMin = Infinity, xMax = -Infinity, zMin = Infinity, zMax = -Infinity;
    rects.forEach(function(b) {
      xMin = Math.min(xMin, b.xMin); xMax = Math.max(xMax, b.xMax);
      zMin = Math.min(zMin, b.zMin); zMax = Math.max(zMax, b.zMax);
    });
    return { xMin: xMin, xMax: xMax, zMin: zMin, zMax: zMax };
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
        return { valid: false, msg: "Overlaps with " + sectionName(s.id, p) };
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
  // S107: callers pass either preview params (deckHeight) or raw app params
  // (height). Reading only deckHeight silently fell back to 4 for raw params,
  // so a flush section on a 5ft deck was treated as raised, and a raised
  // section on a 4ft deck could read as level. One rule, both keys.
  function mainDeckHeight(p) {
    if (!p) return 4;
    if (p.deckHeight != null) return p.deckHeight;
    if (p.height != null) return p.height;
    return 4;
  }

  function getEffectiveBeamType(zone, p) {
    if (!zone || zone.type === "cutout") return "dropped";
    var mainH = mainDeckHeight(p);
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
    var mainH = mainDeckHeight(p);
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
       'level'        deltaIn < 0.5  (within construction tolerance, no stair needed)
       'tripping'     0.5 <= deltaIn < 4    (R311.7.5.1 violation, no compliant single step)
       'single-step'  4 <= deltaIn < 7.75   (one riser, no handrail required)
       'multi-step'   7.75 <= deltaIn < 30  (multi-riser, no guard required)
       'guarded'      30 <= deltaIn < 147   (multi-riser + guard required, R312.1.1)
       'over-max'     deltaIn >= 147        (R311.7.3, intermediate landing required)
     S81d.5: renamed 'flush' -> 'level' to avoid collision with flush-vs-dropped
     beam type terminology used elsewhere in the codebase.
  */
  function classifyHeightDelta(deltaIn) {
    if (deltaIn == null || deltaIn < 0.5) return 'level';
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
    if (cls === 'level' || cls === 'tripping' || cls === 'over-max') {
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
    var mainH = mainDeckHeight(p);
    var anchor = getZoneById(p, anchorZoneId);
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
        var tz = getZoneById(p, landsId);
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
    var mainH = mainDeckHeight(p);
    var parentZone = getZoneById(p, stair.zoneId);
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

  /* ---------- S81d.5: Get valid stair destinations for a zone ----------
     Returns an array of destination options for stairs originating from
     the given zoneId. Always includes "ground" as an option. Adds one
     entry per adjacent lower zone (via getSharedEdges). The user clicks
     a destination button and the stair is created with the right
     _landsOnZoneId AND the right location pre-set to the shared edge.

     Each entry: { label, landsOnZoneId, location }
       label: human string for the button (e.g. "Deck A", "Ground")
       landsOnZoneId: null for ground, number for a zone landing
       location: "front" | "left" | "right" | "back" — pre-set to the
                 edge of the FROM zone that touches the destination
  */
  function getStairDestinations(zoneId, p) {
    var out = [];
    var fromRect = getZoneRect(zoneId, p);
    if (!fromRect) return [{ label: "Ground", landsOnZoneId: null, location: "front" }];
    var mainH = mainDeckHeight(p);
    var fromZone = getZoneById(p, zoneId);
    var fromH = (fromZone && fromZone.h != null) ? fromZone.h
                : (zoneId === 0 ? mainH : mainH);
    // Always offer ground
    out.push({ label: "Ground", landsOnZoneId: null, location: "front" });
    // Offer each adjacent lower zone
    var TOL = 0.01;
    var shared = getSharedEdges(p);
    var seen = {};
    for (var i = 0; i < shared.length; i++) {
      var e = shared[i];
      if (e.aId !== zoneId && e.bId !== zoneId) continue;
      var otherId = (e.aId === zoneId) ? e.bId : e.aId;
      var otherH  = (e.aId === zoneId) ? e.bH  : e.aH;
      // Only offer destinations that are LOWER (we're going down)
      if (fromH - otherH < 0.5 / 12) continue;
      // S81d.5: Tripping-range deltas (0.5"-4") are NOT filtered out.
      // Architects and informed users may need to place a stair in this range
      // for variance/exception cases. The S81b warning panel surfaces the
      // R311.7.5.1 violation per stair so the user sees the consequence.
      if (seen[otherId]) continue;
      seen[otherId] = true;
      // Determine which side of fromRect the shared edge is on
      var loc;
      if (e.axis === "horizontal") {
        if (Math.abs(e.y1 - (fromRect.y + fromRect.d)) < TOL) loc = "front";
        else if (Math.abs(e.y1 - fromRect.y) < TOL) loc = "back";
        else continue;
      } else {
        if (Math.abs(e.x1 - fromRect.x) < TOL) loc = "left";
        else if (Math.abs(e.x1 - (fromRect.x + fromRect.w)) < TOL) loc = "right";
        else continue;
      }
      // S105: was three inline lines duplicating the naming rule. sectionName()
      // already prefers a user-typed label over the derived one.
      out.push({ label: sectionName(otherId, p), landsOnZoneId: otherId, location: loc });
    }
    return out;
  }

  window.getEffectiveBeamType = getEffectiveBeamType;
  // ============================================================
  // RESOLVE ALL STAIRS (S94/P0) -- JS mirror of Python
  // stair_utils.resolve_stair_elevation() + resolve_all_stairs().
  // Single shared resolver so preview sheets (site plan today; a future
  // consolidation target for plan/3D/elevation, which currently inline
  // this logic) agree with the PDF pipeline. Keep in lockstep with the
  // Python: tests/test_frontend_parity.py compares the two directly.
  //
  // p is the zone-params shape (deckWidth/deckDepth + height or
  // deckHeight, zones[], deckStairs[] or legacy hasStairs fields).
  // Returns [{ stair, zoneRect, worldAnchorX, worldAnchorY, angle,
  //            exitSide, elevationInfo }]; anchors are deck-LOCAL feet.
  // ============================================================
  function resolveStairElevation(stair, p) {
    var mainH = (p.height != null) ? +p.height
              : (p.deckHeight != null) ? +p.deckHeight : 4;
    var zones = p.zones || [];
    var anchorId = (stair.zoneId != null) ? stair.zoneId : 0;
    var fromH;
    if (anchorId === 0) {
      fromH = mainH;
    } else {
      var az = zones.find(function(z) { return z.id === anchorId; });
      fromH = (az && az.h != null) ? +az.h : mainH;
    }
    var landsOn = (stair._landsOnZoneId != null) ? stair._landsOnZoneId : null;
    var toH, isTransitional;
    if (landsOn == null) {
      toH = 0; isTransitional = false;
    } else if (landsOn === 0) {
      toH = mainH; isTransitional = true;
    } else {
      var lz = zones.find(function(z) { return z.id === landsOn; });
      if (!lz) { toH = 0; isTransitional = false; }
      else { toH = (lz.h != null) ? +lz.h : mainH; isTransitional = true; }
    }
    return {
      fromH: fromH, toH: toH, totalRise: Math.abs(fromH - toH),
      landsOnZoneId: isTransitional ? landsOn : null,
      isTransitional: isTransitional, directionValid: fromH > toH
    };
  }

  function getStairExitSide(angle) {
    var a = ((Math.round(angle) % 360) + 360) % 360;
    if (a === 90) return "right";
    if (a === 180) return "back";
    if (a === 270) return "left";
    return "front";
  }

  function resolveAllStairs(p) {
    var W = +(p.deckWidth || p.width || 16);
    var D = +(p.deckDepth || p.depth || 12);
    var mainH = (p.height != null) ? +p.height
              : (p.deckHeight != null) ? +p.deckHeight : 4;
    var ds = p.deckStairs;

    // Backward-compat fallback: no deckStairs array -> legacy flat params.
    // Mirrors the Python fallback (grade-only by construction). Rise gate
    // matches compute_stair_info's height <= 0.5 -> None.
    if (!ds || !ds.length) {
      if (!p.hasStairs || mainH <= 0.5) return [];
      var pl = window.getStairPlacement(p, { W: W, D: D });
      return [{
        stair: { id: 0, zoneId: 0, location: p.stairLocation || "front",
                 width: p.stairWidth || 4, numStringers: p.numStringers || 3 },
        zoneRect: { x: 0, y: 0, w: W, d: D },
        worldAnchorX: pl.anchorX, worldAnchorY: pl.anchorY,
        angle: pl.angle, exitSide: getStairExitSide(pl.angle),
        elevationInfo: { fromH: mainH, toH: 0, totalRise: mainH,
                         landsOnZoneId: null, isTransitional: false,
                         directionValid: mainH > 0 }
      }];
    }

    // Zone rect lookup from ADDITIVE rects only (a stair anchored to a
    // cutout zone is orphaned and skipped -- matches the Python).
    var zoneRects = { 0: { x: 0, y: 0, w: W, d: D } };
    getAdditiveRects(p).forEach(function(ar) { zoneRects[ar.id] = ar.rect; });

    // P1.2: notch-aware front-edge profile of the MAIN deck (zone 0 only).
    var mainProfile = (window.frontEdgeProfile)
      ? window.frontEdgeProfile(W, D, getCutoutRects(p)) : null;

    var resolved = [];
    ds.forEach(function(stair) {
      var zoneId = (stair.zoneId != null) ? stair.zoneId : 0;
      var zr = zoneRects[zoneId];
      if (!zr) return; // orphaned stair
      var elev = resolveStairElevation(stair, p);
      if (elev.totalRise <= 0.5) return; // compute_stair_info -> None gate
      var fp = (zoneId === 0) ? mainProfile : null;
      var plz = window.getStairPlacementForZone(stair, zr, fp);
      resolved.push({
        stair: stair, zoneRect: zr,
        worldAnchorX: zr.x + plz.anchorX, worldAnchorY: zr.y + plz.anchorY,
        angle: plz.angle, exitSide: getStairExitSide(plz.angle),
        elevationInfo: elev
      });
    });
    return resolved;
  }

  window.resolveStairElevation = resolveStairElevation;
  window.getStairExitSide = getStairExitSide;
  window.resolveAllStairs = resolveAllStairs;
  window.getSharedEdges = getSharedEdges;
  window.classifyHeightDelta = classifyHeightDelta;
  window.suggestRiserPlan = suggestRiserPlan;
  window.inferStairLanding = inferStairLanding;
  window.getStairDestinations = getStairDestinations;
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
  window.computeStairOpenings = computeStairOpenings;
  window.stairFootprintRects = stairFootprintRects;
  window.stairPartsNeedingOpening = stairPartsNeedingOpening;
  window.STAIR_HEADROOM_FT = STAIR_HEADROOM_FT;
  window.clipRectsTo = clipRectsTo;
  window.unionSpan = unionSpan;
  // ==========================================================================
  // S102: STAIR-DERIVED OPENINGS (the "notch" case) -- JS mirror of
  // zone_utils.get_stair_opening_rects / get_opening_rects. Keep the two in
  // lockstep; test_frontend_parity cross-checks them.
  //
  // A CUTOUT (button in the plan view, user-placed, edge-limited) lands in
  // p.zones and always reached the framing. A NOTCH (stair DRAGGED into the
  // deck -- planView onStairDrag writes anchorX/anchorY and only snaps back to
  // an edge within 1.5ft) landed in p.deckStairs and reached NOTHING, so the
  // beam ran straight through the stairwell.
  //
  //   stair footprint overlaps the deck plane -> opening, framing must open
  //   stair footprint clears it               -> nothing (edge stairs unchanged)
  //
  // REFUSED, deliberately: fully-interior stairs (never touch a rim) need a
  // second header on the yard side with no reference detail; and off-axis
  // rotations, where an axis-aligned rect would over-cut (the S81e mistake).
  //
  // DO NOT fold this into getCutoutRects(). resolveAllStairs() calls that to
  // find the notch edge a stair snaps to -- routing openings back in recurses.
  // ==========================================================================
  var STAIR_OPEN_EPS = 0.02;
  var STAIR_MIN_OPEN_DEPTH = 0.25;

  function getStairOpeningRects(p) {
    var ds = p.deckStairs;
    if (!ds || !ds.length) return [];
    var W = +(p.deckWidth || p.width || 0);
    var D = +(p.deckDepth || p.depth || 0);
    if (!(W > 0) || !(D > 0)) return [];
    if (!window.resolveAllStairs || !window.computeStairGeometry) return [];

    var resolved;
    try { resolved = window.resolveAllStairs(p); } catch (e) { return []; }
    if (!resolved || !resolved.length) return [];

    // A stair snapped INTO an existing cutout is the same hole, not a second
    // one. Emitting both double-draws the header (golden caught this).
    var existing = getCutoutRects(p).map(function (c) { return c.rect; });
    function alreadyCut(r) {
      var ra = r.w * r.d;
      if (!(ra > 0)) return true;
      for (var i = 0; i < existing.length; i++) {
        var e = existing[i];
        var ox = Math.max(0, Math.min(r.x + r.w, e.x + e.w) - Math.max(r.x, e.x));
        var oy = Math.max(0, Math.min(r.y + r.d, e.y + e.d) - Math.max(r.y, e.y));
        if ((ox * oy) / ra >= 0.80) return true;
      }
      return false;
    }

    var out = [];
    resolved.forEach(function (rs) {
      var st = rs.stair || {};
      var zid = (st.zoneId != null) ? st.zoneId : 0;
      if (zid !== 0) return;                       // framing pipeline is zone-0 only
      var ang = Math.round(rs.angle || 0);
      if (((ang % 90) + 90) % 90 !== 0) return;    // off-axis: refused

      var elev = rs.elevationInfo || {};
      var sg = window.computeStairGeometry({
        template: st.template || "straight",
        height: elev.totalRise != null ? elev.totalRise : (+p.height || 0),
        stairWidth: st.width || 4,
        numStringers: st.numStringers || 3,
        runSplit: st.runSplit ? st.runSplit / 100 : null,
        landingDepth: st.landingDepth || null,
        stairGap: st.stairGap != null ? st.stairGap : 0.5
      });
      if (!sg) return;

      var boxes = stairFootprintRects(sg, rs.worldAnchorX, rs.worldAnchorY, ang);
      if (!boxes.length) return;
      // S106: clip PER PART and union only the survivors. Clipping the
      // whole-stair bbox let parts entirely outside the deck (an lLeft's
      // run 2 and landing) inflate the opening: a 4ft stair cut a 7.5ft hole
      // in the 3D decking with a beam post exposed inside the phantom span.
      // MUST stay mirrored with zone_utils.py _analyse_stair_openings;
      // guarded by tests/test_stair_beam_interaction.py.
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      var cx0 = Infinity, cx1 = -Infinity, cy0 = Infinity, cy1 = -Infinity;
      var survived = 0;
      boxes.forEach(function (b) {
        var sx0 = Math.max(0, b.xMin), sx1 = Math.min(W, b.xMax);
        var sy0 = Math.max(0, b.zMin), sy1 = Math.min(D, b.zMax);
        if ((sx1 - sx0) <= STAIR_OPEN_EPS) return;
        if ((sy1 - sy0) <= STAIR_MIN_OPEN_DEPTH) return;
        survived++;
        x0 = Math.min(x0, b.xMin); x1 = Math.max(x1, b.xMax);
        y0 = Math.min(y0, b.zMin); y1 = Math.max(y1, b.zMax);
        cx0 = Math.min(cx0, sx0); cx1 = Math.max(cx1, sx1);
        cy0 = Math.min(cy0, sy0); cy1 = Math.max(cy1, sy1);
      });
      if (!survived) return;                       // edge-anchored -> nothing

      var reachesRim = (y1 >= D - STAIR_OPEN_EPS) || (y0 <= STAIR_OPEN_EPS)
                    || (x1 >= W - STAIR_OPEN_EPS) || (x0 <= STAIR_OPEN_EPS);
      if (!reachesRim) return;                     // fully interior: refused

      var r = { x: +cx0.toFixed(4), y: +cy0.toFixed(4),
                w: +(cx1 - cx0).toFixed(4), d: +(cy1 - cy0).toFixed(4) };
      if (alreadyCut(r)) return;
      out.push({ id: "stair-" + st.id, source: "stair", stairId: st.id,
                 zone: null, rect: r });
    });
    return out;
  }

  // EVERY opening in the deck plane: user cutouts + stair-derived notches.
  // This is what the FRAMING pipeline consumes.
  function getOpeningRects(p) {
    return getCutoutRects(p).concat(getStairOpeningRects(p));
  }

  // ---- S105 B: legal deck dimensions, in ONE place. ----
  // These lived only in the Slider's JSX props, so anything that set a size by
  // another route (a drag) could produce a value the slider could never
  // produce. Same drift shape as the naming rule. Slider and drag both read
  // this now.
  // S106: attachOffset joins them. It was min={0} max={30} in two JSX
  // props in steps.js, which is the same invisible-rule shape as above, and
  // dragging a section's side edge has to move the offset to hold the
  // opposite edge still.
  var SIZE_BOUNDS = {
    width:        { min: 4, max: 50 },
    depth:        { min: 4, max: 24 },
    attachOffset: { min: 0, max: 30 },
    cutout: { min: 2 },
    step: 0.5
  };
  function clampSize(field, v, isCutout) {
    var b = SIZE_BOUNDS[field];
    if (!b) return v;
    // S106: the cutout floor is a floor on a cutout's SIZE. Before this it was
    // applied to whatever field was passed, so clampSize("attachOffset", 0,
    // true) would have returned 2 and shoved the section along its parent.
    var isSize = (field === "width" || field === "depth");
    var min = (isCutout && isSize) ? SIZE_BOUNDS.cutout.min : b.min;
    var st = SIZE_BOUNDS.step;
    v = Math.round(v / st) * st;                 // snap, same step as the slider
    return Math.max(min, Math.min(b.max, v));    // clamp, same bounds
  }

  /* ---- S106: resizing a section by dragging one of its edges ----
     Three of a section's four screen edges can move. The fourth is the seam
     where it meets its parent, and moving that would detach the section, so
     it gets no handle.

     Which screen edge does what depends on attachEdge, because getZoneRect
     swaps the axes for left/right attachments: w is always measured ALONG the
     parent's edge and d always runs AWAY from it.

       attachEdge   seam     d edge    w edges (near / far along the parent)
       right        left     right     top / bottom
       left         right    left      top / bottom
       front        top      bottom    left / right

     Cutouts get no map, so they get no handles. Their attachEdge values are
     corner names and their anchoring rules are different. */
  function sectionResizeEdges(attachEdge) {
    switch (attachEdge) {
      case "right": return { seam: "left",  far: "right",  nearAlong: "top",  farAlong: "bottom", axis: "y" };
      case "left":  return { seam: "right", far: "left",   nearAlong: "top",  farAlong: "bottom", axis: "y" };
      case "front": return { seam: "top",   far: "bottom", nearAlong: "left", farAlong: "right",  axis: "x" };
      default: return null;
    }
  }

  // Pure. Takes the pointer's ABSOLUTE position in deck feet rather than a
  // delta, so a drag cannot accumulate rounding drift and the clamps fall out
  // of the arithmetic instead of being bolted on.
  //
  // zone:       the section being resized, as it was at pointerdown
  // pr:         its PARENT's rect, {x, y, w, d}, deck feet
  // screenEdge: "left" | "right" | "top" | "bottom"
  // pt:         pointer, {x, y}, deck feet
  // returns     {w, d, attachOffset} or null if that edge does not move
  function resizeSection(zone, pr, screenEdge, pt) {
    if (!zone || !pr || !pt) return null;
    var map = sectionResizeEdges(zone.attachEdge);
    if (!map) return null;

    var isCut = zone.type === "cutout";
    var w0 = zone.w, d0 = zone.d, off0 = zone.attachOffset || 0;
    var out = { w: w0, d: d0, attachOffset: off0 };

    // The edge running away from the parent: pure depth, no offset change.
    if (screenEdge === map.far) {
      var raw;
      if (zone.attachEdge === "right")     raw = pt.x - (pr.x + pr.w);
      else if (zone.attachEdge === "left") raw = pr.x - pt.x;
      else                                 raw = pt.y - (pr.y + pr.d);
      out.d = clampSize("depth", raw, isCut);
      return out;
    }

    // The two edges running along the parent. Distance along the parent's
    // edge, measured from the same origin attachOffset uses.
    var along = (map.axis === "y") ? (pt.y - pr.y) : (pt.x - pr.x);

    // Far end: offset is the anchor and stays put, so only w changes.
    if (screenEdge === map.farAlong) {
      out.w = clampSize("width", along - off0, isCut);
      return out;
    }

    // Near end: this edge IS the offset. Move it and grow w by the same
    // amount so the far end does not budge. B is the far end and is the
    // invariant of this branch.
    if (screenEdge === map.nearAlong) {
      var B = off0 + w0;
      var minW = isCut ? SIZE_BOUNDS.cutout.min : SIZE_BOUNDS.width.min;
      // Bound the offset by BOTH its own range and the width it implies, so
      // one clamp cannot leave w and attachOffset disagreeing about B.
      var lo = Math.max(SIZE_BOUNDS.attachOffset.min, B - SIZE_BOUNDS.width.max);
      var hi = Math.min(SIZE_BOUNDS.attachOffset.max, B - minW);
      var off = clampSize("attachOffset", along, false);
      off = Math.max(lo, Math.min(hi, off));
      out.attachOffset = off;
      out.w = B - off;
      return out;
    }

    return null;  // the seam
  }

  // S108: stairs must survive shape changes. Stairs persist in two forms --
  // edge-relative (location + offset, from a snapped drop or the controls)
  // and absolute (anchorX/anchorY/angle in zone-local feet, from a manual
  // drop). Neither was revalidated when a deck or section changed size: the
  // zone-routing branch of u() skipped even the legacy flat offset clamp,
  // and absolute anchors were never touched anywhere, so growing the deck
  // left a "front edge" stair floating mid-deck, anchored to nothing.
  //
  // The rule, per stair, in the zone-local frame (= its zone's world rect
  // extents, exactly the frame the planView drag clamps to):
  //   * absolute + pinned to an edge under the OLD frame (coordinate at the
  //     boundary): it FOLLOWS that edge into the new frame, with the
  //     along-edge coordinate clamped so the stair's width stays on the deck
  //     (same bound the snap applies to offsets);
  //   * absolute + interior (a deliberate manual drop): clamped into the new
  //     rect, otherwise untouched;
  //   * location/offset: offset re-clamped to the new edge length, the same
  //     formula the drop snap and the legacy flat clamp use.
  // Anchors stay on the drag's 0.5 ft grid. Returns the SAME array when
  // nothing changed so callers can cheaply avoid state churn.
  //
  // prevP supplies the OLD frame for edge detection; pass null (falls back
  // to nextP) to just sanitize, e.g. when loading a saved project that
  // predates this rule.
  function revalidateStairs(nextP, prevP) {
    var stairs = nextP.deckStairs || [];
    if (!stairs.length) return stairs;
    var EPS = 0.05;
    function frame(p, zoneId) {
      if (!p) return null;
      var q = (p.deckWidth != null && p.deckDepth != null) ? p
            : Object.assign({}, p, { deckWidth: p.width, deckDepth: p.depth });
      return getZoneRect(zoneId, q);
    }
    function alongClamp(v, len, sw) {
      if (len <= sw) return len / 2;
      return Math.max(sw / 2, Math.min(len - sw / 2, v));
    }
    var changed = false;
    var out = stairs.map(function(s) {
      var nr = frame(nextP, s.zoneId || 0);
      if (!nr) return s;  // zone gone: removeZone owns stair removal
      var W = nr.w, D = nr.d, sw = s.width || 4;

      if (s.anchorX != null && s.anchorY != null) {
        var pr = frame(prevP, s.zoneId || 0) || nr;
        var ax = s.anchorX, ay = s.anchorY;
        var edge = null;
        if (ay >= pr.d - EPS) edge = "front";
        else if (ay <= EPS) edge = "back";
        else if (ax >= pr.w - EPS) edge = "right";
        else if (ax <= EPS) edge = "left";
        if (edge === "front") { ay = D; ax = alongClamp(ax, W, sw); }
        else if (edge === "back") { ay = 0; ax = alongClamp(ax, W, sw); }
        else if (edge === "right") { ax = W; ay = alongClamp(ay, D, sw); }
        else if (edge === "left") { ax = 0; ay = alongClamp(ay, D, sw); }
        ax = Math.max(0, Math.min(W, Math.round(ax * 2) / 2));
        ay = Math.max(0, Math.min(D, Math.round(ay * 2) / 2));
        if (ax === s.anchorX && ay === s.anchorY) return s;
        changed = true;
        return Object.assign({}, s, { anchorX: ax, anchorY: ay });
      }

      var edgeLen = (s.location === "left" || s.location === "right") ? D : W;
      var maxOff = Math.max(0, Math.floor((edgeLen - sw) / 2));
      var off = Math.max(-maxOff, Math.min(maxOff, s.offset || 0));
      if (off === (s.offset || 0)) return s;
      changed = true;
      return Object.assign({}, s, { offset: off });
    });
    return changed ? out : stairs;
  }
  window.SIZE_BOUNDS = SIZE_BOUNDS;
  window.clampSize = clampSize;
  window.sectionResizeEdges = sectionResizeEdges;
  window.resizeSection = resizeSection;
  window.revalidateStairs = revalidateStairs;
  window.sectionName = sectionName;
  window.isAutoLabel = isAutoLabel;
  window.sectionLetter = sectionLetter;
  window.getStairOpeningRects = getStairOpeningRects;
  window.getOpeningRects = getOpeningRects;
  window.getAddableEdges = getAddableEdges;
  window.validateZone = validateZone;
  window.addZoneDefaults = addZoneDefaults;
  window.buildZoneCalcParams = buildZoneCalcParams;

})();
