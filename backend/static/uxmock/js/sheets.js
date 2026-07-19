// ============================================================
// SBP MOCK SHEET RENDERER
// Renders the 7-sheet permit set as SVG facsimiles from the live
// design state. Shared by the landing samples and Act III previews.
// Not the production PDF pipeline -- a faithful *preview* of it.
// ============================================================
(function () {
  var MONO = "IBM Plex Mono, monospace";
  var INK = "#14212e", CYAN = "#17456e", LINE = "#a8c4dd", RUL = "#d9d3c4", MUT = "#6d7466";

  // ---------- geometry helpers (shared; canvas.js reuses these) ----------
  function bounds(pts) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    return { minx: Math.min.apply(0, xs), maxx: Math.max.apply(0, xs), miny: Math.min.apply(0, ys), maxy: Math.max.apply(0, ys) };
  }
  // fit lot (feet, y-up) into a box (svg, y-down); returns {sx, sy} mappers + scale
  function fitter(pts, x0, y0, w, h, pad) {
    pad = pad == null ? 10 : pad;
    var b = bounds(pts);
    var s = Math.min((w - 2 * pad) / (b.maxx - b.minx), (h - 2 * pad) / (b.maxy - b.miny));
    var ox = x0 + (w - s * (b.maxx - b.minx)) / 2, oy = y0 + (h - s * (b.maxy - b.miny)) / 2;
    return {
      s: s,
      sx: function (x) { return ox + (x - b.minx) * s; },
      sy: function (y) { return oy + (b.maxy - y) * s; }
    };
  }
  // inset a convex polygon: per-edge inward offsets, intersect neighbors
  function insetConvex(pts, offFor) {
    var n = pts.length, lines = [];
    // polygon is clockwise in y-up coords => inward normal is LEFT of edge dir... compute via centroid test
    var cx = 0, cy = 0;
    pts.forEach(function (p) { cx += p[0] / n; cy += p[1] / n; });
    for (var i = 0; i < n; i++) {
      var a = pts[i], b2 = pts[(i + 1) % n];
      var dx = b2[0] - a[0], dy = b2[1] - a[1], len = Math.hypot(dx, dy);
      var nx = -dy / len, ny = dx / len; // one normal
      // flip toward centroid
      if ((cx - a[0]) * nx + (cy - a[1]) * ny < 0) { nx = -nx; ny = -ny; }
      var off = offFor(nx, ny, i);
      lines.push({ px: a[0] + nx * off, py: a[1] + ny * off, dx: dx, dy: dy });
    }
    var out = [];
    for (var j = 0; j < n; j++) {
      var L1 = lines[(j + n - 1) % n], L2 = lines[j];
      var det = L1.dx * (-L2.dy) - (-L2.dx) * L1.dy;
      if (Math.abs(det) < 1e-9) { out.push([L2.px, L2.py]); continue; }
      var t = ((L2.px - L1.px) * (-L2.dy) - (-L2.dx) * (L2.py - L1.py)) / det;
      out.push([L1.px + L1.dx * t, L1.py + L1.dy * t]);
    }
    return out;
  }
  // setback polygon from lot + setbacks (outward normal mostly -y => front, +y => rear, else side)
  function setbackPoly(lot, sb) {
    return insetConvex(lot, function (nx, ny) {
      // (nx,ny) here is INWARD; outward is negative
      var oy = -ny;
      if (oy < -0.55) return sb.front;
      if (oy > 0.55) return sb.rear;
      return sb.side;
    });
  }
  function pointInConvex(pt, poly) {
    var sign = 0;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var cr = (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]);
      if (Math.abs(cr) < 1e-9) continue;
      var s = cr > 0 ? 1 : -1;
      if (sign === 0) sign = s; else if (s !== sign) return false;
    }
    return true;
  }
  // deck rect corners in lot feet (y-up). Deck sits on house rear wall.
  function deckRect(st) {
    var h = st.house, d = st.deck;
    var x = h.x + d.off, y = h.y + h.d;
    return { x: x, y: y, w: d.w, d: d.d, corners: [[x, y], [x + d.w, y], [x + d.w, y + d.d], [x, y + d.d]] };
  }
  function zoneRects(st) {
    var dr = deckRect(st);
    return (st.zones || []).map(function (z) {
      if (z.edge === 'left') return { x: dr.x - z.w, y: dr.y + dr.d - z.d, w: z.w, d: z.d, edge: 'left' };
      if (z.edge === 'right') return { x: dr.x + dr.w, y: dr.y + dr.d - z.d, w: z.w, d: z.d, edge: 'right' };
      return { x: dr.x + dr.w / 2 - z.w / 2, y: dr.y + dr.d, w: z.w, d: z.d, edge: 'rear' };
    });
  }
  function stairRects(st) {
    var dr = deckRect(st);
    var zr = zoneRects(st);
    var run = Math.max(3, Math.ceil((st.deck.h / 7.5)) * (10 / 12)); // ft
    return (st.stairs || []).map(function (s) {
      if (s.zone != null && zr[s.zone]) {
        var r = zr[s.zone];
        if (r.edge === 'left') return { x: r.x - run, y: r.y + r.d / 2 - 2, w: run, d: 4, treadsAlong: 'x' };
        if (r.edge === 'right') return { x: r.x + r.w, y: r.y + r.d / 2 - 2, w: run, d: 4, treadsAlong: 'x' };
        return { x: r.x + r.w / 2 - 2, y: r.y + r.d, w: 4, d: run, treadsAlong: 'y' };
      }
      if (s.edge === 'left') return { x: dr.x - run, y: dr.y + dr.d / 2 - 2, w: run, d: 4, treadsAlong: 'x' };
      if (s.edge === 'right') return { x: dr.x + dr.w, y: dr.y + dr.d / 2 - 2, w: run, d: 4, treadsAlong: 'x' };
      return { x: dr.x + dr.w / 2 - 2, y: dr.y + dr.d, w: 4, d: run, treadsAlong: 'y' };
    });
  }

  function iso(x, y, z) { return [(x - y) * 0.866, (x + y) * 0.5 - z]; }

  // ---------- tiny svg builders ----------
  function poly(pts, f, attrs) {
    return '<polygon points="' + pts.map(function (p) { return f.sx(p[0]).toFixed(1) + ',' + f.sy(p[1]).toFixed(1); }).join(' ') + '" ' + (attrs || '') + '/>';
  }
  function txt(x, y, s, size, fill, anchor, extra) {
    return '<text x="' + x + '" y="' + y + '" font-family="' + MONO + '" font-size="' + (size || 8) + '" fill="' + (fill || INK) + '"' +
      (anchor ? ' text-anchor="' + anchor + '"' : '') + (extra || '') + '>' + s + '</text>';
  }
  function dimH(x1, x2, y, label, f, color) {
    color = color || CYAN;
    return '<g stroke="' + color + '" stroke-width=".7" fill="none">' +
      '<path d="M' + x1 + ' ' + y + ' H' + x2 + ' M' + x1 + ' ' + (y - 3) + ' V' + (y + 3) + ' M' + x2 + ' ' + (y - 3) + ' V' + (y + 3) + '"/></g>' +
      txt((x1 + x2) / 2, y - 3, label, 7.5, color, 'middle');
  }
  function frame(inner, wm, capNo, capName) {
    return '<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="400" height="260" fill="#fffdf8"/>' +
      '<rect x="6" y="6" width="388" height="248" fill="none" stroke="' + INK + '" stroke-width="1.4"/>' +
      '<rect x="10" y="10" width="380" height="240" fill="none" stroke="' + RUL + '" stroke-width=".5"/>' +
      inner +
      // mini title block
      '<g><rect x="252" y="228" width="142" height="26" fill="#fffdf8" stroke="' + INK + '" stroke-width="1"/>' +
      '<line x1="292" y1="228" x2="292" y2="254" stroke="' + RUL + '" stroke-width=".5"/>' +
      txt(272, 244, capNo, 11, INK, 'middle', ' font-weight="600"') +
      txt(298, 239, capName, 6.5, MUT) +
      txt(298, 248, 'SIMPLEBLUEPRINTS · IRC 2021', 5.5, MUT) + '</g>' +
      (wm ? '<text x="200" y="140" font-family="' + MONO + '" font-size="34" fill="' + CYAN + '" fill-opacity=".13" text-anchor="middle" transform="rotate(-24 200 130)" letter-spacing="8">' + wm + '</text>' : '') +
      '</svg>';
  }

  // ---------- sheet renderers ----------
  function shCover(st, wm) {
    // cyanotype axon hero
    var h = st.house, dr = deckRect(st);
    var pts3 = [];
    function push(x, y, z) { pts3.push(iso(x, y, z)); }
    // collect projected extents: house box + deck slab
    [[h.x, h.y, 0], [h.x + h.w, h.y, 0], [h.x + h.w, h.y + h.d, 0], [h.x, h.y + h.d, 0],
     [h.x, h.y, 11], [h.x + h.w, h.y, 11], [h.x + h.w, h.y + h.d, 11], [h.x, h.y + h.d, 11],
     [dr.x, dr.y, 0], [dr.x + dr.w, dr.y + dr.d, st.deck.h / 12 + 1]].forEach(function (p) { push(p[0], p[1], p[2]); });
    var f = fitter(pts3, 30, 34, 340, 180, 8);
    function P(x, y, z) { var p = iso(x, y, z); return f.sx(p[0]).toFixed(1) + ',' + f.sy(p[1]).toFixed(1); }
    var hz = st.deck.h / 12;
    var g = '<g stroke="' + LINE + '" stroke-width="1.1" fill="none">';
    // house block
    g += '<polygon points="' + [P(h.x, h.y + h.d, 0), P(h.x + h.w, h.y + h.d, 0), P(h.x + h.w, h.y + h.d, 11), P(h.x, h.y + h.d, 11)].join(' ') + '"/>';
    g += '<polygon points="' + [P(h.x + h.w, h.y + h.d, 0), P(h.x + h.w, h.y, 0), P(h.x + h.w, h.y, 11), P(h.x + h.w, h.y + h.d, 11)].join(' ') + '"/>';
    g += '<polygon points="' + [P(h.x, h.y + h.d, 11), P(h.x + h.w, h.y + h.d, 11), P(h.x + h.w, h.y, 11), P(h.x, h.y, 11)].join(' ') + '" fill="' + LINE + '" fill-opacity=".07"/>';
    // deck slab
    var dz1 = hz, dz2 = hz + 0.6;
    g += '<polygon points="' + [P(dr.x, dr.y, dz2), P(dr.x + dr.w, dr.y, dz2), P(dr.x + dr.w, dr.y + dr.d, dz2), P(dr.x, dr.y + dr.d, dz2)].join(' ') + '" fill="' + LINE + '" fill-opacity=".16" stroke-width="1.4"/>';
    g += '<polygon points="' + [P(dr.x, dr.y + dr.d, dz1), P(dr.x + dr.w, dr.y + dr.d, dz1), P(dr.x + dr.w, dr.y + dr.d, dz2), P(dr.x, dr.y + dr.d, dz2)].join(' ') + '"/>';
    // posts
    for (var i = 0; i < 3; i++) {
      var px = dr.x + 1 + (dr.w - 2) * i / 2;
      g += '<line x1="' + P(px, dr.y + dr.d - 1, 0).split(',')[0] + '" y1="' + P(px, dr.y + dr.d - 1, 0).split(',')[1] +
           '" x2="' + P(px, dr.y + dr.d - 1, dz1).split(',')[0] + '" y2="' + P(px, dr.y + dr.d - 1, dz1).split(',')[1] + '"/>';
    }
    g += '</g>';
    var inner = '<rect x="10" y="10" width="380" height="240" fill="#0e2f4d"/>' + g +
      '<text x="130" y="220" font-family="Barlow Condensed, sans-serif" font-size="13" font-weight="700" fill="#e9f1f8" text-anchor="middle" letter-spacing="2">PROPOSED DECK</text>' +
      '<text x="130" y="232" font-family="' + MONO + '" font-size="7" fill="' + LINE + '" text-anchor="middle">' + (st.address || 'YOUR ADDRESS').toUpperCase().slice(0, 34) + '</text>' +
      txt(200, 24, 'PERMIT DRAWING SET', 8, LINE, 'middle', ' letter-spacing="4"') +
      (st.finish ? txt(200, 218, (st.finish.decking || '').toUpperCase() + ' DECKING \u00b7 ' + (st.finish.railing || '').toUpperCase() + ' RAILING', 6.5, LINE, 'middle') : '');
    return frame(inner, wm, 'A-0', 'COVER SHEET');
  }

  function shPlan(st, wm) {
    var dr = deckRect(st), all = [dr].concat(zoneRects(st));
    var pts = [];
    all.forEach(function (r) { pts.push([r.x, r.y], [r.x + r.w, r.y + r.d]); });
    stairRects(st).forEach(function (r) { pts.push([r.x, r.y], [r.x + r.w, r.y + r.d]); });
    pts.push([dr.x - 2, dr.y - 6]);
    var f = fitter(pts, 24, 30, 350, 178, 14);
    var g = '<g stroke="' + INK + '" fill="none">';
    // house wall
    g += '<line x1="' + (f.sx(dr.x) - 26) + '" y1="' + f.sy(dr.y) + '" x2="' + (f.sx(dr.x + dr.w) + 26) + '" y2="' + f.sy(dr.y) + '" stroke-width="2.4"/>';
    g += txt(f.sx(dr.x + dr.w / 2), f.sy(dr.y) + 10, 'EXISTING RESIDENCE — LEDGER ATTACHMENT', 6.5, MUT, 'middle');
    all.forEach(function (r) {
      g += '<rect x="' + f.sx(r.x) + '" y="' + f.sy(r.y + r.d) + '" width="' + (r.w * f.s) + '" height="' + (r.d * f.s) + '" stroke-width="1.6"/>';
      // joist lines
      var n = Math.max(2, Math.floor(r.w / 1.333));
      for (var i = 1; i < n; i++) {
        var jx = f.sx(r.x + r.w * i / n);
        g += '<line x1="' + jx + '" y1="' + f.sy(r.y + r.d) + '" x2="' + jx + '" y2="' + f.sy(r.y) + '" stroke="' + RUL + '" stroke-width=".6"/>';
      }
    });
    stairRects(st).forEach(function (r) {
      g += '<rect x="' + f.sx(r.x) + '" y="' + f.sy(r.y + r.d) + '" width="' + (r.w * f.s) + '" height="' + (r.d * f.s) + '" stroke-width="1.2"/>';
      var steps = 5;
      for (var i = 1; i < steps; i++) {
        if (r.treadsAlong === 'y') {
          var ty = f.sy(r.y + r.d * i / steps);
          g += '<line x1="' + f.sx(r.x) + '" y1="' + ty + '" x2="' + f.sx(r.x + r.w) + '" y2="' + ty + '" stroke-width=".7"/>';
        } else {
          var tx = f.sx(r.x + r.w * i / steps);
          g += '<line x1="' + tx + '" y1="' + f.sy(r.y + r.d) + '" x2="' + tx + '" y2="' + f.sy(r.y) + '" stroke-width=".7"/>';
        }
      }
      g += txt(f.sx(r.x + r.w / 2), f.sy(r.y + r.d / 2), 'DN', 6.5, INK, 'middle');
    });
    g += '</g>';
    g += dimH(f.sx(dr.x), f.sx(dr.x + dr.w), f.sy(dr.y + dr.d) - 8, st.deck.w + "'-0\"", f);
    var dxr = f.sx(dr.x + dr.w) + 12;
    g += '<g stroke="' + CYAN + '" stroke-width=".7" fill="none"><path d="M' + dxr + ' ' + f.sy(dr.y + dr.d) + ' V' + f.sy(dr.y) + ' M' + (dxr - 3) + ' ' + f.sy(dr.y + dr.d) + ' H' + (dxr + 3) + ' M' + (dxr - 3) + ' ' + f.sy(dr.y) + ' H' + (dxr + 3) + '"/></g>' +
      txt(dxr + 4, (f.sy(dr.y + dr.d) + f.sy(dr.y)) / 2, st.deck.d + "'-0\"", 7, CYAN);
    var spec = window.SBPSpec ? window.SBPSpec.compute(st) : null;
    if (spec) {
      g += txt(30, 216, 'JOISTS: ' + spec.rows[0].v + '  (' + spec.rows[0].cite + ')', 7, CYAN);
      g += txt(30, 226, 'DECKING: ' + ((st.finish && st.finish.decking) || 'PT PINE').toUpperCase() + ' · GUARDS: ' + spec.rows[5].v.toUpperCase(), 6.5, INK);
    }
    return frame(g, wm, 'A-1', 'DECK PLAN');
  }

  function shFraming(st, wm) {
    var dr = deckRect(st);
    var f = fitter([[dr.x - 3, dr.y - 5], [dr.x + dr.w + 3, dr.y + dr.d + 3]], 24, 30, 350, 172, 14);
    var spec = SBPSpec.compute(st);
    var g = '<g stroke="' + INK + '" fill="none">';
    g += '<rect x="' + f.sx(dr.x) + '" y="' + f.sy(dr.y + dr.d) + '" width="' + (dr.w * f.s) + '" height="' + (dr.d * f.s) + '" stroke-width="1.2" stroke-dasharray="4 3"/>';
    var nj = Math.max(3, Math.floor(dr.w / 1.333));
    for (var ji = 1; ji < nj; ji++) {
      var jjx = f.sx(dr.x + dr.w * ji / nj);
      g += '<line x1="' + jjx + '" y1="' + f.sy(dr.y + dr.d) + '" x2="' + jjx + '" y2="' + f.sy(dr.y) + '" stroke="' + RUL + '" stroke-width=".5"/>';
    }
    // beam line near outer edge
    var by = f.sy(dr.y + dr.d - 1);
    g += '<line x1="' + f.sx(dr.x - 1) + '" y1="' + by + '" x2="' + f.sx(dr.x + dr.w + 1) + '" y2="' + by + '" stroke-width="2.6"/>';
    // posts + footings
    for (var i = 0; i < spec.posts; i++) {
      var px = f.sx(dr.x + 1 + (dr.w - 2) * i / (spec.posts - 1));
      g += '<rect x="' + (px - 3) + '" y="' + (by - 3) + '" width="6" height="6" fill="' + INK + '"/>';
      g += '<circle cx="' + px + '" cy="' + by + '" r="9" stroke-width=".8" stroke-dasharray="2 2"/>';
    }
    g += '<line x1="' + f.sx(dr.x) + '" y1="' + f.sy(dr.y) + '" x2="' + f.sx(dr.x + dr.w) + '" y2="' + f.sy(dr.y) + '" stroke-width="2.6"/>';
    g += '</g>';
    g += txt(f.sx(dr.x + dr.w / 2), by - 8, 'BEAM: ' + spec.rows[1].v, 7, CYAN, 'middle');
    g += txt(f.sx(dr.x + dr.w / 2), f.sy(dr.y) - 5, 'LEDGER: ' + spec.rows[4].v, 6.5, CYAN, 'middle');
    g += txt(30, 216, 'POSTS: ' + spec.rows[2].v, 7, INK);
    g += txt(30, 226, 'FOOTINGS: ' + spec.rows[3].v + '  (' + spec.rows[3].cite + ')', 7, INK);
    return frame(g, wm, 'A-2', 'FRAMING PLAN');
  }

  function shElev(st, wm) {
    var d = st.deck, hft = d.h / 12;
    var f = fitter([[0, -0.5], [d.w + 8, hft + 4]], 24, 34, 350, 168, 12);
    var deckY = f.sy(hft), gY = f.sy(0);
    var g = '<g stroke="' + INK + '" fill="none">';
    g += '<line x1="20" y1="' + gY + '" x2="380" y2="' + gY + '" stroke-width="1.6"/>'; // grade
    for (var i = 24; i < 380; i += 14) g += '<line x1="' + i + '" y1="' + gY + '" x2="' + (i - 6) + '" y2="' + (gY + 6) + '" stroke-width=".6"/>';
    g += '<rect x="' + f.sx(2) + '" y="' + (deckY - 5) + '" width="' + (d.w * f.s) + '" height="5" fill="' + INK + '"/>'; // deck band
    var spec = SBPSpec.compute(st);
    for (var p = 0; p < spec.posts; p++) {
      var px = f.sx(2 + 1 + (d.w - 2) * p / (spec.posts - 1));
      g += '<rect x="' + (px - 2.5) + '" y="' + deckY + '" width="5" height="' + (gY - deckY) + '" stroke-width="1.1"/>';
      g += '<rect x="' + (px - 6) + '" y="' + gY + '" width="12" height="12" stroke-width=".9" stroke-dasharray="3 2"/>';
    }
    if (d.h >= 30) { // guard
      g += '<line x1="' + f.sx(2) + '" y1="' + (deckY - 5 - 3 * f.s) + '" x2="' + f.sx(2 + d.w) + '" y2="' + (deckY - 5 - 3 * f.s) + '" stroke-width="1.4"/>';
      for (var b = 0; b <= 14; b++) {
        var bx = f.sx(2 + d.w * b / 14);
        g += '<line x1="' + bx + '" y1="' + (deckY - 5) + '" x2="' + bx + '" y2="' + (deckY - 5 - 3 * f.s) + '" stroke-width=".6"/>';
      }
    }
    g += '</g>';
    g += dimVLabel(f.sx(2 + d.w) + 14, deckY, gY, d.h + '" A.F.G.', CYAN);
    g += txt(30, 224, 'FOOTINGS ' + spec.footingSpec.depth + '" BELOW GRADE (FROST)', 7, CYAN);
    return frame(g, wm, 'A-3', 'ELEVATIONS');
  }
  function dimVLabel(x, y1, y2, label, color) {
    return '<g stroke="' + color + '" stroke-width=".7" fill="none"><path d="M' + x + ' ' + y1 + ' V' + y2 + ' M' + (x - 3) + ' ' + y1 + ' H' + (x + 3) + ' M' + (x - 3) + ' ' + y2 + ' H' + (x + 3) + '"/></g>' +
      '<text x="' + (x + 5) + '" y="' + ((y1 + y2) / 2) + '" font-family="' + MONO + '" font-size="7.5" fill="' + color + '">' + label + '</text>';
  }

  function shDetails(st, wm) {
    var g = '<g stroke="' + INK + '" fill="none">';
    // detail 1: post-footing
    g += '<circle cx="105" cy="120" r="66" stroke-width="1.2"/>';
    g += '<rect x="97" y="62" width="16" height="70" stroke-width="1.4"/>';
    g += '<rect x="85" y="132" width="40" height="10" stroke-width="1.2"/>';
    g += '<path d="M75 150 q30 14 60 0" stroke-width="1"/>';
    g += '<line x1="60" y1="146" x2="150" y2="146" stroke-width="1.4"/>';
    g += txt(105, 205, '1 / POST + FOOTING', 7, INK, 'middle');
    // detail 2: ledger
    g += '<circle cx="285" cy="120" r="66" stroke-width="1.2"/>';
    g += '<rect x="238" y="70" width="12" height="100" fill="' + RUL + '" stroke="' + INK + '" stroke-width="1"/>';
    g += '<rect x="250" y="100" width="80" height="12" stroke-width="1.4"/>';
    for (var i = 0; i < 4; i++) g += '<circle cx="' + (262 + i * 18) + '" cy="106" r="2.4" fill="' + INK + '"/>';
    g += txt(285, 205, '2 / LEDGER ATTACHMENT', 7, INK, 'middle');
    g += '</g>';
    var spec = SBPSpec.compute(st);
    g += txt(105, 216, spec.rows[3].v, 6.5, CYAN, 'middle');
    g += txt(285, 216, spec.rows[4].v, 6.5, CYAN, 'middle');
    return frame(g, wm, 'A-4', 'STRUCTURAL DETAILS');
  }

  function shNotes(st, wm) {
    var g = txt(28, 34, 'GENERAL NOTES', 9, INK, null, ' font-weight="600" letter-spacing="2"');
    var y = 50;
    var spec = SBPSpec.compute(st);
    var reals = [
      '1. ALL WORK PER 2021 IRC AND LOCAL AMENDMENTS.',
      '2. DESIGN SNOW LOAD: ' + (st.snow || 30) + ' PSF. FROST DEPTH: ' + (st.frost || 36) + ' IN.',
      '3. JOISTS ' + spec.rows[0].v + ' — ' + spec.rows[0].cite + '.',
      '4. BEAM ' + spec.rows[1].v + ' — ' + spec.rows[1].cite + '.',
      '5. GUARDS: ' + spec.rows[5].v + ' — ' + spec.rows[5].cite + '.'
    ];
    reals.forEach(function (s) { g += txt(28, y, s, 6.8, INK); y += 13; });
    // greeked continuation
    for (var i = 0; i < 9; i++) {
      var w = 180 + (i * 53) % 150;
      g += '<rect x="28" y="' + (y + 2) + '" width="' + w + '" height="4" fill="' + RUL + '"/>'; y += 12;
    }
    return frame(g, wm, 'A-5', 'GENERAL NOTES');
  }

  function shSite(st, wm) {
    var lot = st.lot, f = fitter(lot, 24, 26, 350, 182, 12);
    var g = '<g fill="none">';
    g += poly(lot, f, 'stroke="' + INK + '" stroke-width="1.8"');
    var sbp = setbackPoly(lot, st.setbacks);
    g += poly(sbp, f, 'stroke="' + CYAN + '" stroke-width=".8" stroke-dasharray="5 4"');
    var h = st.house;
    g += '<rect x="' + f.sx(h.x) + '" y="' + f.sy(h.y + h.d) + '" width="' + (h.w * f.s) + '" height="' + (h.d * f.s) + '" stroke="' + INK + '" stroke-width="1.4"/>';
    g += txt(f.sx(h.x + h.w / 2), f.sy(h.y + h.d / 2), 'RESIDENCE', 6.5, MUT, 'middle');
    var dr = deckRect(st);
    g += '<rect x="' + f.sx(dr.x) + '" y="' + f.sy(dr.y + dr.d) + '" width="' + (dr.w * f.s) + '" height="' + (dr.d * f.s) + '" stroke="' + CYAN + '" stroke-width="1.8" fill="' + CYAN + '" fill-opacity=".1"/>';
    zoneRects(st).forEach(function (r) {
      g += '<rect x="' + f.sx(r.x) + '" y="' + f.sy(r.y + r.d) + '" width="' + (r.w * f.s) + '" height="' + (r.d * f.s) + '" stroke="' + CYAN + '" stroke-width="1.4" fill="' + CYAN + '" fill-opacity=".08"/>';
    });
    g += txt(f.sx(dr.x + dr.w / 2), f.sy(dr.y + dr.d / 2), 'DECK', 6.5, CYAN, 'middle');
    g += '</g>';
    g += txt(f.sx((lot[0][0] + lot[lot.length - 1][0]) / 2), f.sy(0) + 12, (st.street || 'STREET').toUpperCase(), 6.5, MUT, 'middle');
    g += txt(f.sx(dr.x + dr.w / 2), f.sy(0) + 2, st.setbacks.front + "' FRONT SETBACK", 5.5, CYAN, 'middle');
    g += txt(f.sx(h.x) - 4, f.sy(h.y + h.d / 2), st.setbacks.side + "' SIDE", 5.5, CYAN, 'end');
    g += txt(f.sx(dr.x + dr.w / 2), f.sy(dr.y + dr.d) - 4, st.setbacks.rear + "' REAR SETBACK", 5.5, CYAN, 'middle');
    var _la = (st.parcel && st.parcel.lotArea) || st.lotArea || 9480;
    g += txt(28, 222, 'LOT AREA: ' + _la.toLocaleString() + ' SF \u00b7 ZONING: ' + (((st.parcel && st.parcel.zoning) || st.zoning || 'R1-6') + '').split(' ')[0], 6.5, INK);
    g += txt(28, 232, 'SCALE: 1" = 20\'-0"', 6.5, MUT);
    // north arrow
    var na = (st.north || 0) * Math.PI / 180;
    var nx = 366, ny = 44;
    g += '<g stroke="' + INK + '" fill="none" stroke-width="1"><circle cx="' + nx + '" cy="' + ny + '" r="13"/>' +
      '<line x1="' + nx + '" y1="' + (ny + 9) + '" x2="' + (nx + Math.sin(na) * 18) + '" y2="' + (ny - Math.cos(na) * 9) + '"/></g>' +
      txt(nx, ny + 26, 'N', 7, INK, 'middle');
    return frame(g, wm, 'A-6', 'SITE PLAN');
  }

  function shChecklist(st, wm) {
    var g = txt(28, 34, 'PERMIT SUBMISSION CHECKLIST', 9, INK, null, ' font-weight="600" letter-spacing="2"');
    var items = ['SITE PLAN WITH SETBACK DIMENSIONS', 'DECK PLAN + FRAMING PLAN', 'ELEVATIONS WITH HEIGHT A.F.G.', 'FOOTING + LEDGER DETAILS', 'GENERAL NOTES / DESIGN LOADS', 'JURISDICTION ATTACHMENT FORM'];
    var y = 56;
    items.forEach(function (s) {
      g += '<rect x="28" y="' + (y - 8) + '" width="9" height="9" fill="none" stroke="' + INK + '" stroke-width="1"/>' +
        '<path d="M29.5 ' + (y - 4) + ' l2.5 3 4-6" stroke="#3d5a2e" stroke-width="1.4" fill="none"/>' +
        txt(44, y, s, 7, INK);
      y += 21;
    });
    g += txt(28, y + 8, 'JURISDICTION: ' + (st.jurisdiction || 'YOUR LOCAL BUILDING DEPARTMENT').toUpperCase().slice(0, 52), 6.5, CYAN);
    return frame(g, wm, 'A-7', 'CHECKLIST');
  }

  var SHEETS = [
    { id: 'cover', no: 'A-0', name: 'COVER SHEET', fn: shCover },
    { id: 'plan', no: 'A-1', name: 'DECK PLAN', fn: shPlan },
    { id: 'framing', no: 'A-2', name: 'FRAMING PLAN', fn: shFraming },
    { id: 'elev', no: 'A-3', name: 'ELEVATIONS', fn: shElev },
    { id: 'details', no: 'A-4', name: 'STRUCTURAL DETAILS', fn: shDetails },
    { id: 'notes', no: 'A-5', name: 'GENERAL NOTES', fn: shNotes },
    { id: 'site', no: 'A-6', name: 'SITE PLAN', fn: shSite },
    { id: 'check', no: 'A-7', name: 'CHECKLIST', fn: shChecklist },
  ];

  window.SBPSheets = {
    sheetList: function () { return SHEETS; },
    render: function (id, st, opts) {
      opts = opts || {};
      var s = SHEETS.filter(function (x) { return x.id === id; })[0];
      var wm = opts.thumb ? 'SAMPLE' : (opts.watermark === false ? null : 'PREVIEW');
      return s.fn(st, wm);
    },
    demoState: function () {
      return {
        address: '4739 Sweetgrass Ln, Colorado Springs, CO',
        street: 'Sweetgrass Lane',
        jurisdiction: 'Pikes Peak Regional Building Dept',
        lot: [[0, 0], [4, 68], [38, 112], [96, 96], [104, 22], [88, 0]],
        setbacks: { front: 25, side: 5, rear: 15 },
        house: { x: 26, y: 30, w: 44, d: 30 },
        north: 12,
        deck: { off: 14, w: 16, d: 12, h: 36 },
        zones: [], stairs: [{ edge: 'right' }],
        snow: 30, frost: 36
      };
    },
    _geom: { fitter: fitter, setbackPoly: setbackPoly, pointInConvex: pointInConvex, deckRect: deckRect, zoneRects: zoneRects, stairRects: stairRects, iso: iso, bounds: bounds }
  };
})();
