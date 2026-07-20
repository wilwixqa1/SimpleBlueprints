// ============================================================
// SBP MOCK SHEET RENDERER v3 -- faithful to the PRODUCTION PDF
// pipeline (backend/drawing): white ARCH-landscape page, dark ink
// #1a1f16, brand green #3d5a2e, right-side vertical title-block
// strip (Rutstein convention, see title_block.py). SVG facsimiles
// drawn live from design state; not the real reportlab output.
// ============================================================
(function () {
  var MONO = "IBM Plex Mono, monospace";
  var INK = "#1a1f16", GRN = "#3d5a2e", MUT = "#7a8068", RUL = "#ddd8cc", RED = "#c62828";

  // ---------- geometry helpers (shared; canvas.js reuses these) ----------
  function bounds(pts) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    return { minx: Math.min.apply(0, xs), maxx: Math.max.apply(0, xs), miny: Math.min.apply(0, ys), maxy: Math.max.apply(0, ys) };
  }
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
  function insetConvex(pts, offFor) {
    var n = pts.length, lines = [];
    var cx = 0, cy = 0;
    pts.forEach(function (p) { cx += p[0] / n; cy += p[1] / n; });
    for (var i = 0; i < n; i++) {
      var a = pts[i], b2 = pts[(i + 1) % n];
      var dx = b2[0] - a[0], dy = b2[1] - a[1], len = Math.hypot(dx, dy);
      var nx = -dy / len, ny = dx / len;
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
  function setbackPoly(lot, sb) {
    return insetConvex(lot, function (nx, ny) {
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
    var run = Math.max(3, Math.ceil((st.deck.h / 7.5)) * (10 / 12));
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
  // main deck outline with optional chamfers on the two OUTER corners
  // (lot coords, y-up; outer edge = y + d). corners: {FL: ft, FR: ft}
  function deckPolyPts(st) {
    var dr = deckRect(st);
    var c = st.corners || {};
    var fl = Math.max(0, Math.min(c.FL || 0, dr.w / 2, dr.d / 2));
    var fr = Math.max(0, Math.min(c.FR || 0, dr.w / 2, dr.d / 2));
    var pts = [[dr.x, dr.y], [dr.x + dr.w, dr.y]];
    if (fr > 0) { pts.push([dr.x + dr.w, dr.y + dr.d - fr], [dr.x + dr.w - fr, dr.y + dr.d]); }
    else pts.push([dr.x + dr.w, dr.y + dr.d]);
    if (fl > 0) { pts.push([dr.x + fl, dr.y + dr.d], [dr.x, dr.y + dr.d - fl]); }
    else pts.push([dr.x, dr.y + dr.d]);
    return pts;
  }

  // ---------- svg builders ----------
  function poly(pts, f, attrs) {
    return '<polygon points="' + pts.map(function (p) { return f.sx(p[0]).toFixed(1) + ',' + f.sy(p[1]).toFixed(1); }).join(' ') + '" ' + (attrs || '') + '/>';
  }
  function txt(x, y, s, size, fill, anchor, extra) {
    return '<text x="' + x + '" y="' + y + '" font-family="' + MONO + '" font-size="' + (size || 8) + '" fill="' + (fill || INK) + '"' +
      (anchor ? ' text-anchor="' + anchor + '"' : '') + (extra || '') + '>' + s + '</text>';
  }
  function dimH(x1, x2, y, label, color) {
    color = color || INK;
    return '<g stroke="' + color + '" stroke-width=".7" fill="none">' +
      '<path d="M' + x1 + ' ' + y + ' H' + x2 + ' M' + x1 + ' ' + (y - 3) + ' V' + (y + 3) + ' M' + x2 + ' ' + (y - 3) + ' V' + (y + 3) + '"/></g>' +
      txt((x1 + x2) / 2, y - 3, label, 7, color, 'middle');
  }
  function dimV(x, y1, y2, label, color) {
    color = color || INK;
    return '<g stroke="' + color + '" stroke-width=".7" fill="none"><path d="M' + x + ' ' + y1 + ' V' + y2 + ' M' + (x - 3) + ' ' + y1 + ' H' + (x + 3) + ' M' + (x - 3) + ' ' + y2 + ' H' + (x + 3) + '"/></g>' +
      '<text x="' + (x + 4) + '" y="' + ((y1 + y2) / 2 + 3) + '" font-family="' + MONO + '" font-size="7" fill="' + color + '">' + label + '</text>';
  }

  // Right-side vertical title block strip, faithful to title_block.py
  // Strip: x 342..394, y 8..252. Sections bottom->top per production dividers.
  function frame(inner, wm, capNo, capName, st) {
    st = st || {};
    var spec = window.SBPSpec ? window.SBPSpec.compute(st.deck ? st : demoState()) : null;
    var addr = (st.address || '4739 SWEETGRASS LN').toUpperCase();
    var a1 = addr.split(',')[0].slice(0, 15);
    var a2 = addr.split(',').slice(1).join(',').trim().slice(0, 15);
    var pageNo = (parseInt((capNo || 'A-0').split('-')[1], 10) || 0) + 1;
    var d = new Date();
    var today = ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2) + '/' + d.getFullYear();
    var W = st.deck ? st.deck.w : 16, D = st.deck ? st.deck.d : 12;

    var strip = '<g>' +
      '<rect x="342" y="8" width="52" height="244" fill="#ffffff" stroke="' + INK + '" stroke-width="1.4"/>' +
      // dividers (y-down from production fractions .14,.20,.38,.58,.88 of strip height)
      [217.8, 203.2, 159.3, 110.5, 37.3].map(function (dy) {
        return '<line x1="342" y1="' + dy + '" x2="394" y2="' + dy + '" stroke="' + INK + '" stroke-width=".7"/>';
      }).join('') +
      // SECTION: sheet number (bottom)
      txt(368, 226, 'SHEET:', 4.5, MUT, 'middle', ' font-weight="600"') +
      txt(368, 241, capNo, 14, INK, 'middle', ' font-weight="700"') +
      txt(368, 249.5, pageNo + ' OF 8', 4.5, MUT, 'middle') +
      // SECTION: date
      txt(345, 209, 'DATE:', 4.2, MUT, null, ' font-weight="600"') +
      txt(345, 215.5, today, 5, INK, null, ' font-weight="600"') +
      // SECTION: branding + specs
      txt(345, 165, 'DRAWINGS PROVIDED BY:', 3.4, MUT) +
      txt(345, 172.5, 'SIMPLEBLUEPRINTS', 5.4, GRN, null, ' font-weight="700"') +
      txt(345, 178.5, 'simpleblueprints.xyz', 4, MUT) +
      (spec ? txt(345, 187, W + "'-0\" x " + D + "'-0\"", 5, INK, null, ' font-weight="600"') +
              txt(345, 193.5, spec.rows[0].v, 3.9, MUT) +
              txt(345, 199, spec.rows[1].v + ' BEAM', 3.9, MUT) : '') +
      // SECTION: project description
      txt(345, 116, 'PROJECT DESCRIPTION:', 3.4, MUT) +
      txt(345, 124, 'PROPOSED DECK', 5, INK, null, ' font-weight="700"') +
      txt(345, 131, a1, 4.4, INK) +
      (a2 ? txt(345, 137.5, a2, 4.4, INK) : '') +
      (st.jurisdiction ? txt(345, 146, (st.jurisdiction.indexOf('Pikes') === 0 ? 'PPRBD' : 'LOCAL BLDG DEPT'), 4, MUT) : '') +
      // SECTION: sheet title rotated 90deg
      '<text x="368" y="74" font-family="' + MONO + '" font-size="9" font-weight="700" fill="' + INK + '" text-anchor="middle" transform="rotate(-90 368 74)">' + capName + '</text>' +
      // SECTION: revision header (top)
      txt(390, 12, '', 3, MUT) +
      '<text x="391" y="12" font-family="' + MONO + '" font-size="3.4" fill="' + MUT + '" text-anchor="end" transform="rotate(-90 391 12)">NO.   DESCRIPTION</text>' +
      '</g>';

    return '<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="400" height="260" fill="#ffffff"/>' +
      '<rect x="4" y="4" width="392" height="252" fill="none" stroke="' + INK + '" stroke-width="1.6"/>' +
      inner + strip +
      (wm ? '<text x="172" y="150" font-family="' + MONO + '" font-size="30" fill="' + MUT + '" fill-opacity=".16" text-anchor="middle" transform="rotate(-24 172 140)" letter-spacing="8">' + wm + '</text>' : '') +
      '</svg>';
  }

  // ---------- sheet renderers (content area x 8..338, y 8..252) ----------
  function shCover(st, wm) {
    var h = st.house, dr = deckRect(st);
    var pts3 = [];
    [[h.x, h.y, 0], [h.x + h.w, h.y, 0], [h.x + h.w, h.y + h.d, 0], [h.x, h.y + h.d, 0],
     [h.x, h.y, 11], [h.x + h.w, h.y, 11], [h.x + h.w, h.y + h.d, 11], [h.x, h.y + h.d, 11],
     [dr.x, dr.y, 0], [dr.x + dr.w, dr.y + dr.d, st.deck.h / 12 + 1]].forEach(function (p) { pts3.push(iso(p[0], p[1], p[2])); });
    var f = fitter(pts3, 30, 44, 280, 170, 8);
    function P(x, y, z) { var p = iso(x, y, z); return f.sx(p[0]).toFixed(1) + ',' + f.sy(p[1]).toFixed(1); }
    var hz = st.deck.h / 12, dz1 = hz, dz2 = hz + 0.6;
    var g = '<g stroke="' + INK + '" stroke-width="1" fill="none">';
    g += '<polygon points="' + [P(h.x, h.y + h.d, 0), P(h.x + h.w, h.y + h.d, 0), P(h.x + h.w, h.y + h.d, 11), P(h.x, h.y + h.d, 11)].join(' ') + '"/>';
    g += '<polygon points="' + [P(h.x + h.w, h.y + h.d, 0), P(h.x + h.w, h.y, 0), P(h.x + h.w, h.y, 11), P(h.x + h.w, h.y + h.d, 11)].join(' ') + '"/>';
    g += '<polygon points="' + [P(h.x, h.y + h.d, 11), P(h.x + h.w, h.y + h.d, 11), P(h.x + h.w, h.y, 11), P(h.x, h.y, 11)].join(' ') + '" fill="' + RUL + '" fill-opacity=".35"/>';
    for (var i = 0; i < 3; i++) {
      var px = dr.x + 1 + (dr.w - 2) * i / 2;
      var a = P(px, dr.y + dr.d - 1, 0).split(','), c = P(px, dr.y + dr.d - 1, dz1).split(',');
      g += '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + c[0] + '" y2="' + c[1] + '" stroke-width="1.6"/>';
    }
    g += '<polygon points="' + [P(dr.x, dr.y + dr.d, dz1), P(dr.x + dr.w, dr.y + dr.d, dz1), P(dr.x + dr.w, dr.y + dr.d, dz2), P(dr.x, dr.y + dr.d, dz2)].join(' ') + '" stroke="' + GRN + '"/>';
    g += '<polygon points="' + [P(dr.x, dr.y, dz2), P(dr.x + dr.w, dr.y, dz2), P(dr.x + dr.w, dr.y + dr.d, dz2), P(dr.x, dr.y + dr.d, dz2)].join(' ') + '" fill="' + GRN + '" fill-opacity=".1" stroke="' + GRN + '" stroke-width="1.4"/>';
    g += '</g>';
    var inner = txt(172, 26, 'PERMIT DRAWING SET', 10, INK, 'middle', ' font-weight="700" letter-spacing="4"') +
      '<line x1="80" y1="32" x2="264" y2="32" stroke="' + GRN + '" stroke-width="1.2"/>' + g +
      txt(172, 232, 'PROPOSED ' + st.deck.w + "' x " + st.deck.d + "' DECK", 8, INK, 'middle', ' font-weight="700"') +
      txt(172, 242, ((st.finish && st.finish.decking) || 'PT pine').toUpperCase() + ' DECKING \u00b7 ' + ((st.finish && st.finish.railing) || 'wood baluster').toUpperCase() + ' RAILING', 5.5, MUT, 'middle');
    return frame(inner, wm, 'A-0', 'COVER SHEET', st);
  }

  function shPlan(st, wm) {
    var dr = deckRect(st), all = [dr].concat(zoneRects(st));
    var pts = [];
    all.forEach(function (r) { pts.push([r.x, r.y], [r.x + r.w, r.y + r.d]); });
    stairRects(st).forEach(function (r) { pts.push([r.x, r.y], [r.x + r.w, r.y + r.d]); });
    pts.push([dr.x - 2, dr.y - 6]);
    var f = fitter(pts, 20, 26, 300, 180, 16);
    var g = '<g stroke="' + INK + '" fill="none">';
    g += '<line x1="' + (f.sx(dr.x) - 22) + '" y1="' + f.sy(dr.y) + '" x2="' + (f.sx(dr.x + dr.w) + 22) + '" y2="' + f.sy(dr.y) + '" stroke-width="2.2"/>';
    g += txt(f.sx(dr.x + dr.w / 2), f.sy(dr.y) + 9, 'EXISTING RESIDENCE \u2014 LEDGER ATTACHMENT', 6, MUT, 'middle');
    all.forEach(function (r, ri) {
      if (ri === 0) g += poly(deckPolyPts(st), f, 'stroke="' + INK + '" stroke-width="1.5" fill="none"');
      else g += '<rect x="' + f.sx(r.x) + '" y="' + f.sy(r.y + r.d) + '" width="' + (r.w * f.s) + '" height="' + (r.d * f.s) + '" stroke-width="1.5"/>';
      var n = Math.max(2, Math.floor(r.w / 1.333));
      for (var i = 1; i < n; i++) {
        var jx = f.sx(r.x + r.w * i / n);
        g += '<line x1="' + jx + '" y1="' + f.sy(r.y + r.d) + '" x2="' + jx + '" y2="' + f.sy(r.y) + '" stroke="' + RUL + '" stroke-width=".6"/>';
      }
    });
    stairRects(st).forEach(function (r) {
      g += '<rect x="' + f.sx(r.x) + '" y="' + f.sy(r.y + r.d) + '" width="' + (r.w * f.s) + '" height="' + (r.d * f.s) + '" stroke-width="1.1"/>';
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
      g += txt(f.sx(r.x + r.w / 2), f.sy(r.y + r.d / 2), 'DN', 6, INK, 'middle');
    });
    g += '</g>';
    g += dimH(f.sx(dr.x), f.sx(dr.x + dr.w), f.sy(dr.y + dr.d) - 8, st.deck.w + "'-0\"");
    g += dimV(f.sx(dr.x + dr.w) + 12, f.sy(dr.y + dr.d), f.sy(dr.y), st.deck.d + "'-0\"");
    var spec = window.SBPSpec ? window.SBPSpec.compute(st) : null;
    if (spec) {
      g += txt(22, 236, 'JOISTS: ' + spec.rows[0].v + '  (' + spec.rows[0].cite + ')', 6.5, GRN);
      g += txt(22, 245, 'DECKING: ' + ((st.finish && st.finish.decking) || 'PT PINE').toUpperCase() + ' \u00b7 GUARDS: ' + spec.rows[5].v.toUpperCase(), 6, INK);
    }
    return frame(g, wm, 'A-1', 'DECK PLAN', st);
  }

  function shFraming(st, wm) {
    var dr = deckRect(st);
    var f = fitter([[dr.x - 3, dr.y - 5], [dr.x + dr.w + 3, dr.y + dr.d + 3]], 20, 26, 300, 176, 16);
    var spec = SBPSpec.compute(st);
    var g = '<g stroke="' + INK + '" fill="none">';
    g += '<rect x="' + f.sx(dr.x) + '" y="' + f.sy(dr.y + dr.d) + '" width="' + (dr.w * f.s) + '" height="' + (dr.d * f.s) + '" stroke-width="1.1" stroke-dasharray="4 3"/>';
    var nj = Math.max(3, Math.floor(dr.w / 1.333));
    for (var ji = 1; ji < nj; ji++) {
      var jjx = f.sx(dr.x + dr.w * ji / nj);
      g += '<line x1="' + jjx + '" y1="' + f.sy(dr.y + dr.d) + '" x2="' + jjx + '" y2="' + f.sy(dr.y) + '" stroke="' + RUL + '" stroke-width=".5"/>';
    }
    var by = f.sy(dr.y + dr.d - 1);
    g += '<line x1="' + f.sx(dr.x - 1) + '" y1="' + by + '" x2="' + f.sx(dr.x + dr.w + 1) + '" y2="' + by + '" stroke-width="2.4"/>';
    for (var i = 0; i < spec.posts; i++) {
      var px = f.sx(dr.x + 1 + (dr.w - 2) * i / (spec.posts - 1));
      g += '<rect x="' + (px - 3) + '" y="' + (by - 3) + '" width="6" height="6" fill="' + INK + '"/>';
      g += '<circle cx="' + px + '" cy="' + by + '" r="8" stroke-width=".8" stroke-dasharray="2 2"/>';
    }
    g += '<line x1="' + f.sx(dr.x) + '" y1="' + f.sy(dr.y) + '" x2="' + f.sx(dr.x + dr.w) + '" y2="' + f.sy(dr.y) + '" stroke-width="2.4"/>';
    g += '</g>';
    g += txt(f.sx(dr.x + dr.w / 2), by - 7, 'BEAM: ' + spec.rows[1].v, 6.5, GRN, 'middle');
    g += txt(f.sx(dr.x + dr.w / 2), f.sy(dr.y) - 5, 'LEDGER: ' + spec.rows[4].v, 6, GRN, 'middle');
    g += txt(22, 236, 'POSTS: ' + spec.rows[2].v, 6.5, INK);
    g += txt(22, 245, 'FOOTINGS: ' + spec.rows[3].v + '  (' + spec.rows[3].cite + ')', 6.5, INK);
    return frame(g, wm, 'A-2', 'FRAMING PLAN', st);
  }

  function shElev(st, wm) {
    var d = st.deck, hft = d.h / 12;
    var f = fitter([[0, -0.5], [d.w + 8, hft + 4]], 20, 30, 300, 166, 12);
    var deckY = f.sy(hft), gY = f.sy(0);
    var spec = SBPSpec.compute(st);
    var g = '<g stroke="' + INK + '" fill="none">';
    g += '<line x1="16" y1="' + gY + '" x2="336" y2="' + gY + '" stroke-width="1.4"/>';
    for (var i = 20; i < 336; i += 13) g += '<line x1="' + i + '" y1="' + gY + '" x2="' + (i - 6) + '" y2="' + (gY + 6) + '" stroke-width=".5"/>';
    g += '<rect x="' + f.sx(2) + '" y="' + (deckY - 5) + '" width="' + (d.w * f.s) + '" height="5" fill="' + INK + '"/>';
    for (var p = 0; p < spec.posts; p++) {
      var px = f.sx(2 + 1 + (d.w - 2) * p / (spec.posts - 1));
      g += '<rect x="' + (px - 2.5) + '" y="' + deckY + '" width="5" height="' + (gY - deckY) + '" stroke-width="1"/>';
      g += '<rect x="' + (px - 6) + '" y="' + gY + '" width="12" height="12" stroke-width=".8" stroke-dasharray="3 2"/>';
    }
    if (d.h >= 30) {
      g += '<line x1="' + f.sx(2) + '" y1="' + (deckY - 5 - 3 * f.s) + '" x2="' + f.sx(2 + d.w) + '" y2="' + (deckY - 5 - 3 * f.s) + '" stroke-width="1.3"/>';
      for (var b = 0; b <= 14; b++) {
        var bx = f.sx(2 + d.w * b / 14);
        g += '<line x1="' + bx + '" y1="' + (deckY - 5) + '" x2="' + bx + '" y2="' + (deckY - 5 - 3 * f.s) + '" stroke-width=".5"/>';
      }
    }
    g += '</g>';
    g += dimV(f.sx(2 + d.w) + 12, deckY, gY, d.h + '" A.F.G.');
    g += txt(22, 240, 'FOOTINGS ' + spec.footingSpec.depth + '" BELOW GRADE (FROST) \u00b7 GUARDS: ' + spec.rows[5].v.toUpperCase() + ' (' + spec.rows[5].cite + ')', 6, GRN);
    return frame(g, wm, 'A-3', 'ELEVATIONS', st);
  }

  function shDetails(st, wm) {
    var g = '<g stroke="' + INK + '" fill="none">';
    g += '<circle cx="95" cy="115" r="60" stroke-width="1.1"/>';
    g += '<rect x="88" y="62" width="14" height="66" stroke-width="1.3"/>';
    g += '<rect x="77" y="128" width="36" height="9" stroke-width="1.1"/>';
    g += '<path d="M68 143 q27 13 54 0" stroke-width=".9"/>';
    g += '<line x1="55" y1="140" x2="135" y2="140" stroke-width="1.3"/>';
    g += txt(95, 192, '1 / POST + FOOTING', 6.5, INK, 'middle', ' font-weight="600"');
    g += '<circle cx="245" cy="115" r="60" stroke-width="1.1"/>';
    g += '<rect x="203" y="70" width="11" height="90" fill="' + RUL + '" stroke="' + INK + '" stroke-width=".9"/>';
    g += '<rect x="214" y="98" width="72" height="11" stroke-width="1.3"/>';
    for (var i = 0; i < 4; i++) g += '<circle cx="' + (226 + i * 16) + '" cy="103.5" r="2.2" fill="' + INK + '"/>';
    g += txt(245, 192, '2 / LEDGER ATTACHMENT', 6.5, INK, 'middle', ' font-weight="600"');
    g += '</g>';
    var spec = SBPSpec.compute(st);
    g += txt(95, 202, spec.rows[3].v, 6, GRN, 'middle');
    g += txt(245, 202, spec.rows[4].v, 6, GRN, 'middle');
    g += txt(170, 240, 'ALL HARDWARE HOT-DIP GALVANIZED OR STAINLESS \u00b7 SIMPSON OR EQUAL', 5.5, MUT, 'middle');
    return frame(g, wm, 'A-4', 'STRUCTURAL DETAILS', st);
  }

  function shNotes(st, wm) {
    var g = txt(22, 30, 'GENERAL NOTES', 8.5, INK, null, ' font-weight="700" letter-spacing="2"');
    g += '<line x1="22" y1="35" x2="150" y2="35" stroke="' + GRN + '" stroke-width="1"/>';
    var y = 48;
    var spec = SBPSpec.compute(st);
    var reals = [
      '1. ALL WORK PER 2021 IRC AND LOCAL AMENDMENTS.',
      '2. DESIGN SNOW LOAD: ' + (st.snow || 30) + ' PSF. FROST DEPTH: ' + (st.frost || 36) + ' IN.',
      '3. JOISTS ' + spec.rows[0].v + ' \u2014 ' + spec.rows[0].cite + '.',
      '4. BEAM ' + spec.rows[1].v + ' \u2014 ' + spec.rows[1].cite + '.',
      '5. GUARDS: ' + spec.rows[5].v + ' \u2014 ' + spec.rows[5].cite + '.',
      '6. DECKING: ' + ((st.finish && st.finish.decking) || 'PT PINE').toUpperCase() + '. RAILING: ' + ((st.finish && st.finish.railing) || 'WOOD BALUSTER').toUpperCase() + '.'
    ];
    reals.forEach(function (s) { g += txt(22, y, s, 6.2, INK); y += 12; });
    for (var i = 0; i < 9; i++) {
      var w = 160 + (i * 47) % 120;
      g += '<rect x="22" y="' + (y + 2) + '" width="' + w + '" height="3.5" fill="' + RUL + '"/>'; y += 11;
    }
    return frame(g, wm, 'A-5', 'GENERAL NOTES', st);
  }

  function shSite(st, wm) {
    var lot = st.lot, f = fitter(lot, 18, 22, 304, 186, 14);
    var g = '<g fill="none">';
    g += poly(lot, f, 'stroke="' + INK + '" stroke-width="1.7"');
    var sbp = setbackPoly(lot, st.setbacks);
    g += poly(sbp, f, 'stroke="' + INK + '" stroke-width=".7" stroke-dasharray="5 4"');
    var h = st.house;
    g += '<rect x="' + f.sx(h.x) + '" y="' + f.sy(h.y + h.d) + '" width="' + (h.w * f.s) + '" height="' + (h.d * f.s) + '" stroke="' + INK + '" stroke-width="1.3"/>';
    g += txt(f.sx(h.x + h.w / 2), f.sy(h.y + h.d / 2), 'RESIDENCE', 6, MUT, 'middle');
    var dr = deckRect(st);
    g += poly(deckPolyPts(st), f, 'stroke="' + GRN + '" stroke-width="1.7" fill="' + GRN + '" fill-opacity=".1"');
    zoneRects(st).forEach(function (r) {
      g += '<rect x="' + f.sx(r.x) + '" y="' + f.sy(r.y + r.d) + '" width="' + (r.w * f.s) + '" height="' + (r.d * f.s) + '" stroke="' + GRN + '" stroke-width="1.3" fill="' + GRN + '" fill-opacity=".08"/>';
    });
    g += txt(f.sx(dr.x + dr.w / 2), f.sy(dr.y + dr.d / 2), 'DECK', 6, GRN, 'middle', ' font-weight="700"');
    g += '</g>';
    g += txt(f.sx((lot[0][0] + lot[lot.length - 1][0]) / 2), f.sy(0) + 11, (st.street || 'STREET').toUpperCase(), 6, MUT, 'middle');
    g += txt(f.sx(dr.x + dr.w / 2), f.sy(0) + 2, st.setbacks.front + "' FRONT SETBACK", 5, GRN, 'middle');
    g += txt(f.sx(h.x) - 4, f.sy(h.y + h.d / 2), st.setbacks.side + "' SIDE", 5, GRN, 'end');
    g += txt(f.sx(dr.x + dr.w / 2), f.sy(dr.y + dr.d) - 4, st.setbacks.rear + "' REAR SETBACK", 5, GRN, 'middle');
    var _la = (st.parcel && st.parcel.lotArea) || st.lotArea || 9480;
    g += txt(22, 236, 'LOT AREA: ' + _la.toLocaleString() + ' SF \u00b7 ZONING: ' + (((st.parcel && st.parcel.zoning) || st.zoning || 'R1-6') + '').split(' ')[0], 6, INK);
    g += txt(22, 245, 'SCALE: 1" = 20\'-0"', 6, MUT);
    var na = (st.north || 0) * Math.PI / 180, nx = 316, ny = 40;
    g += '<g stroke="' + INK + '" fill="none" stroke-width=".9"><circle cx="' + nx + '" cy="' + ny + '" r="12"/>' +
      '<line x1="' + nx + '" y1="' + (ny + 8) + '" x2="' + (nx + Math.sin(na) * 16) + '" y2="' + (ny - Math.cos(na) * 8) + '"/></g>' +
      txt(nx, ny + 22, 'N', 6.5, INK, 'middle');
    return frame(g, wm, 'A-6', 'SITE PLAN', st);
  }

  function shChecklist(st, wm) {
    var g = txt(22, 30, 'PERMIT SUBMISSION CHECKLIST', 8.5, INK, null, ' font-weight="700" letter-spacing="2"');
    g += '<line x1="22" y1="35" x2="200" y2="35" stroke="' + GRN + '" stroke-width="1"/>';
    var items = ['SITE PLAN WITH SETBACK DIMENSIONS', 'DECK PLAN + FRAMING PLAN', 'ELEVATIONS WITH HEIGHT A.F.G.', 'FOOTING + LEDGER DETAILS', 'GENERAL NOTES / DESIGN LOADS', 'JURISDICTION ATTACHMENT FORM'];
    var y = 52;
    items.forEach(function (s) {
      g += '<rect x="22" y="' + (y - 7.5) + '" width="8.5" height="8.5" fill="none" stroke="' + INK + '" stroke-width=".9"/>' +
        '<path d="M23.5 ' + (y - 3.5) + ' l2.3 2.8 3.8-5.6" stroke="' + GRN + '" stroke-width="1.3" fill="none"/>' +
        txt(37, y, s, 6.3, INK);
      y += 19;
    });
    g += txt(22, y + 6, 'JURISDICTION: ' + (st.jurisdiction || 'YOUR LOCAL BUILDING DEPARTMENT').toUpperCase().slice(0, 48), 6, GRN);
    return frame(g, wm, 'A-7', 'CHECKLIST', st);
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

  function demoState() {
    return {
      address: '4739 Sweetgrass Ln, Colorado Springs, CO',
      street: 'Sweetgrass Lane',
      jurisdiction: 'Pikes Peak Regional Building Dept',
      lot: [[0, 0], [4, 68], [38, 112], [96, 96], [104, 22], [88, 0]],
      lotArea: 9480, zoning: 'R1-6',
      setbacks: { front: 25, side: 5, rear: 15 },
      house: { x: 26, y: 30, w: 44, d: 30 },
      north: 12,
      deck: { off: 14, w: 16, d: 12, h: 36 },
      zones: [], stairs: [{ edge: 'right' }], corners: { FL: 0, FR: 0 },
      snow: 30, frost: 36,
      finish: { decking: 'PT pine', railing: 'Wood baluster' }
    };
  }

  window.SBPSheets = {
    sheetList: function () { return SHEETS; },
    render: function (id, st, opts) {
      opts = opts || {};
      var s = SHEETS.filter(function (x) { return x.id === id; })[0];
      var wm = opts.thumb ? 'SAMPLE' : (opts.watermark === false ? null : 'PREVIEW');
      return s.fn(st, wm);
    },
    demoState: demoState,
    _geom: { deckPolyPts: deckPolyPts, fitter: fitter, setbackPoly: setbackPoly, pointInConvex: pointInConvex, deckRect: deckRect, zoneRects: zoneRects, stairRects: stairRects, iso: iso, bounds: bounds }
  };
})();
