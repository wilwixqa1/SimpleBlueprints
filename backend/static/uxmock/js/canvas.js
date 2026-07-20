// ============================================================
// SBP MOCK CANVAS -- the single design surface.
// Act I: property confirm (draggable house). Act II: deck design
// (drag/resize deck, zones, stairs, live setbacks, plan/axon views).
// ============================================================
(function () {
  var G = null; // lazy: SBPSheets._geom
  var INK = '#14212e', CYAN = '#17456e', LINE = '#a8c4dd', RUL = '#d9d3c4', MUT = '#6d7466',
      OK = '#3d5a2e', WARN = '#a94433', MONO = 'IBM Plex Mono, monospace';

  var svg, st, onChange, mode = 'confirm'; // 'confirm' | 'design'
  var fit = null, drag = null;

  function init(svgEl, state, changed) {
    G = SBPSheets._geom;
    svg = svgEl; st = state; onChange = changed;
    svg.addEventListener('pointerdown', down);
    if (!window._sbpCanvasBound) {
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window._sbpCanvasBound = true;
    }
    render();
  }
  function setMode(m) { mode = m; render(); }
  function setState(s) { st = s; render(); }

  // svg point in viewBox coords
  function pt(e) {
    var r = svg.getBoundingClientRect();
    return { x: (e.clientX - r.left) * 900 / r.width, y: (e.clientY - r.top) * 620 / r.height };
  }
  function toFeet(p) {
    // invert fitter
    var b = fit._b, s = fit.s;
    return { x: (p.x - fit._ox) / s + b.minx, y: b.maxy - (p.y - fit._oy) / s };
  }

  function violations() {
    if (!st.lot) return [];
    var sbp = G.setbackPoly(st.lot, st.setbacks);
    var out = [];
    var dr = G.deckRect(st);
    dr.corners.forEach(function (c) { if (!G.pointInConvex(c, sbp)) out.push('deck'); });
    G.zoneRects(st).forEach(function (r) {
      [[r.x, r.y], [r.x + r.w, r.y + r.d]].forEach(function (c) { if (!G.pointInConvex(c, sbp)) out.push('zone'); });
    });
    return out;
  }
  window.SBPCanvas_violations = function () { return violations(); };

  // ---------- rendering ----------
  function render() {
    if (!svg || !st || !st.lot) { if (svg) svg.innerHTML = idle(); return; }
    if (mode === 'design' && st.view === 'axon') { svg.innerHTML = renderAxon(); return; }
    if (mode === 'design' && st.view !== 'site') { svg.innerHTML = renderDeck(); return; }
    svg.innerHTML = renderPlan();
  }
  function idle() {
    return '<g>' + gridBg() +
      '<text x="450" y="300" text-anchor="middle" font-family="' + MONO + '" font-size="14" fill="' + MUT + '">Looking up your property…</text></g>';
  }
  function gridBg() {
    var g = '<g stroke="' + RUL + '" stroke-width=".4" opacity=".5">';
    for (var x = 0; x <= 900; x += 45) g += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="620"/>';
    for (var y = 0; y <= 620; y += 45) g += '<line x1="0" y1="' + y + '" x2="900" y2="' + y + '"/>';
    return g + '</g>';
  }

  function makeFit() {
    var b = G.bounds(st.lot);
    var pad = 60, w = 900, h = 620;
    var s = Math.min((w - 2 * pad) / (b.maxx - b.minx), (h - 2 * pad) / (b.maxy - b.miny));
    var ox = (w - s * (b.maxx - b.minx)) / 2, oy = (h - s * (b.maxy - b.miny)) / 2;
    fit = {
      s: s, _b: b, _ox: ox, _oy: oy,
      sx: function (x) { return ox + (x - b.minx) * s; },
      sy: function (y) { return oy + (b.maxy - y) * s; }
    };
  }
  function P(pts, attrs) {
    return '<polygon points="' + pts.map(function (p) { return fit.sx(p[0]).toFixed(1) + ',' + fit.sy(p[1]).toFixed(1); }).join(' ') + '" ' + attrs + '/>';
  }
  function T(x, y, s, size, fill, anchor, extra) {
    return '<text x="' + x + '" y="' + y + '" font-family="' + MONO + '" font-size="' + size + '" fill="' + fill + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + (extra || '') + '>' + s + '</text>';
  }
  function R(x, y, w, d, attrs) { // feet rect, y-up
    return '<rect x="' + fit.sx(x) + '" y="' + fit.sy(y + d) + '" width="' + (w * fit.s) + '" height="' + (d * fit.s) + '" ' + attrs + '/>';
  }
  function dimHft(x1ft, x2ft, yft, label, above) {
    var y = fit.sy(yft) + (above ? -16 : 16);
    var x1 = fit.sx(x1ft), x2 = fit.sx(x2ft);
    return '<g stroke="' + CYAN + '" stroke-width="1" fill="none"><path d="M' + x1 + ' ' + y + ' H' + x2 + ' M' + x1 + ' ' + (y - 5) + ' V' + (y + 5) + ' M' + x2 + ' ' + (y - 5) + ' V' + (y + 5) + '"/></g>' +
      T((x1 + x2) / 2, y + (above ? -6 : 14), label, 12, CYAN, 'middle');
  }
  function dimVft(xft, y1ft, y2ft, label) {
    var x = fit.sx(xft) + 18;
    var y1 = fit.sy(y1ft), y2 = fit.sy(y2ft);
    return '<g stroke="' + CYAN + '" stroke-width="1" fill="none"><path d="M' + x + ' ' + y1 + ' V' + y2 + ' M' + (x - 5) + ' ' + y1 + ' H' + (x + 5) + ' M' + (x - 5) + ' ' + y2 + ' H' + (x + 5) + '"/></g>' +
      T(x + 7, (y1 + y2) / 2 + 4, label, 12, CYAN);
  }

  function renderPlan() {
    makeFit();
    var out = gridBg();
    var viol = violations();

    // lot
    out += P(st.lot, 'fill="#fffdf8" stroke="' + INK + '" stroke-width="2.5"');
    // setback polygon
    var sbp = G.setbackPoly(st.lot, st.setbacks);
    out += P(sbp, 'fill="none" stroke="' + (viol.length ? WARN : CYAN) + '" stroke-width="1.2" stroke-dasharray="8 6"');
    out += T(fit.sx(sbp[0][0]) + 6, fit.sy(sbp[0][1]) - 6, 'SETBACK LINE', 10, viol.length ? WARN : CYAN);

    // street label along bottom
    out += T(450, fit.sy(0) + 26, (st.street || 'STREET').toUpperCase() + ' — FRONT', 11, MUT, 'middle');

    // house
    var h = st.house;
    out += R(h.x, h.y, h.w, h.d, 'fill="#efece3" stroke="' + INK + '" stroke-width="2"' + (mode === 'confirm' ? ' style="cursor:move" data-drag="house"' : ''));
    out += T(fit.sx(h.x + h.w / 2), fit.sy(h.y + h.d / 2), 'EXISTING RESIDENCE', 11, MUT, 'middle');
    if (mode === 'confirm') {
      out += T(fit.sx(h.x + h.w / 2), fit.sy(h.y + h.d / 2) + 16, '(drag to correct position)', 9.5, MUT, 'middle');
      out += dimHft(h.x, h.x + h.w, h.y, h.w + "'-0\"", false);
      out += dimVft(h.x + h.w, h.y, h.y + h.d, h.d + "'");
    }

    if (mode === 'design') {
      var dr = G.deckRect(st);
      var bad = viol.indexOf('deck') >= 0;
      // ledger wall highlight
      out += '<line x1="' + fit.sx(h.x) + '" y1="' + fit.sy(h.y + h.d) + '" x2="' + fit.sx(h.x + h.w) + '" y2="' + fit.sy(h.y + h.d) + '" stroke="' + OK + '" stroke-width="4" opacity=".6"/>';
      // zones under deck
      G.zoneRects(st).forEach(function (r, i) {
        var zbad = viol.indexOf('zone') >= 0;
        out += R(r.x, r.y, r.w, r.d, 'fill="' + CYAN + '" fill-opacity=".08" stroke="' + (zbad ? WARN : CYAN) + '" stroke-width="2"');
        out += T(fit.sx(r.x + r.w / 2), fit.sy(r.y + r.d / 2), 'WING ' + (i + 1), 10, CYAN, 'middle');
      });
      // stairs
      G.stairRects(st).forEach(function (r) {
        out += R(r.x, r.y, r.w, r.d, 'fill="none" stroke="' + INK + '" stroke-width="1.6"');
        var steps = 5;
        for (var i = 1; i < steps; i++) {
          if (r.treadsAlong === 'y') {
            var ty = fit.sy(r.y + r.d * i / steps);
            out += '<line x1="' + fit.sx(r.x) + '" y1="' + ty + '" x2="' + fit.sx(r.x + r.w) + '" y2="' + ty + '" stroke="' + INK + '" stroke-width="1"/>';
          } else {
            var tx = fit.sx(r.x + r.w * i / steps);
            out += '<line x1="' + tx + '" y1="' + fit.sy(r.y + r.d) + '" x2="' + tx + '" y2="' + fit.sy(r.y) + '" stroke="' + INK + '" stroke-width="1"/>';
          }
        }
        out += T(fit.sx(r.x + r.w / 2), fit.sy(r.y + r.d / 2) + 4, 'DN', 10, INK, 'middle');
      });
      // deck (chamfer-aware outline)
      out += P(G.deckPolyPts(st), 'fill="' + OK + '" fill-opacity=".1" stroke="' + (bad ? WARN : OK) + '" stroke-width="3" style="cursor:move" data-drag="deck"');
      // deck boards suggestion lines
      var nB = Math.floor(dr.w / 2);
      for (var b = 1; b < nB; b++) {
        var bx = fit.sx(dr.x + dr.w * b / nB);
        out += '<line x1="' + bx + '" y1="' + fit.sy(dr.y + dr.d) + '" x2="' + bx + '" y2="' + fit.sy(dr.y) + '" stroke="' + CYAN + '" stroke-width=".5" opacity=".4"/>';
      }
      out += T(fit.sx(dr.x + dr.w / 2), fit.sy(dr.y + dr.d / 2), 'PROPOSED DECK', 11.5, bad ? WARN : CYAN, 'middle', ' font-weight="500"');
      // dims
      out += dimHft(dr.x, dr.x + dr.w, dr.y + dr.d, st.deck.w + "'-0\"", true);
      out += dimVft(dr.x + dr.w, dr.y, dr.y + dr.d, st.deck.d + "'-0\"");
      // handles: E (width), N (depth)
      out += handle(dr.x + dr.w, dr.y + dr.d / 2, 'e');
      out += handle(dr.x + dr.w / 2, dr.y + dr.d, 'n');
    }

    // north dial
    var na = (st.north || 0) * Math.PI / 180, nx = 840, ny = 70;
    out += '<g stroke="' + INK + '" fill="none" stroke-width="1.4"' + (mode === 'confirm' ? ' style="cursor:grab" data-drag="north"' : '') + '>' +
      '<circle cx="' + nx + '" cy="' + ny + '" r="26" fill="#fffdf8"/>' +
      '<line x1="' + (nx - Math.sin(na) * 18) + '" y1="' + (ny + Math.cos(na) * 18) + '" x2="' + (nx + Math.sin(na) * 22) + '" y2="' + (ny - Math.cos(na) * 22) + '"/>' +
      '<circle cx="' + (nx + Math.sin(na) * 22) + '" cy="' + (ny - Math.cos(na) * 22) + '" r="3" fill="' + INK + '"/></g>' +
      T(nx, ny + 44, 'N ' + Math.round(st.north || 0) + '°', 10, INK, 'middle');
    return out;
  }
  function handle(xft, yft, id) {
    var x = fit.sx(xft), y = fit.sy(yft);
    var cur = id === 'e' ? 'ew-resize' : 'ns-resize';
    return '<rect x="' + (x - 7) + '" y="' + (y - 7) + '" width="14" height="14" fill="#fffdf8" stroke="' + CYAN + '" stroke-width="2" style="cursor:' + cur + '" data-drag="h-' + id + '"/>';
  }

  // ---------- production-style deck close-up (default design surface) ----------
  var dfit = null; // deck-local fit: feet -> screen, y DOWN (away from house)
  function renderDeck() {
    var dr = G.deckRect(st);
    function loc(r) { return { x: r.x - dr.x, y: r.y - dr.y, w: r.w, d: r.d }; }
    var rects = [{ x: 0, y: 0, w: dr.w, d: dr.d }];
    G.zoneRects(st).forEach(function (r) { rects.push(loc(r)); });
    G.stairRects(st).forEach(function (r) { rects.push(loc(r)); });
    var minx = 0, maxx = dr.w, maxy = dr.d;
    rects.forEach(function (r) { minx = Math.min(minx, r.x); maxx = Math.max(maxx, r.x + r.w); maxy = Math.max(maxy, r.y + r.d); });
    minx -= 4; maxx += 5; // room for + buttons and dims
    var bandFt = 5, dimFt = 4;
    var s2 = Math.min(820 / (maxx - minx), 520 / (maxy + bandFt + dimFt));
    var ox = (900 - s2 * (maxx - minx)) / 2 - minx * s2, oy = 46 + bandFt * s2;
    dfit = { s: s2, sx: function (x) { return ox + x * s2; }, sy: function (y) { return oy + y * s2; } };
    var X = dfit.sx, Y = dfit.sy;
    var out = '';
    // house band
    out += '<rect x="' + (X(-6)) + '" y="' + (Y(-bandFt)) + '" width="' + ((dr.w + 12) * s2) + '" height="' + (bandFt * s2) + '" fill="#e8e4da" stroke="' + INK + '" stroke-width="1.4"/>';
    out += T((X(0) + X(dr.w)) / 2, Y(-bandFt / 2), 'EXISTING HOUSE', 12, MUT, 'middle', ' letter-spacing="2"');
    // ledger
    out += '<line x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(dr.w) + '" y2="' + Y(0) + '" stroke="' + OK + '" stroke-width="4"/>';
    out += T((X(0) + X(dr.w)) / 2, Y(0) - 5, 'LEDGER', 8.5, OK, 'middle');
    // deck body: chamfered polygon in local coords (chamfers on outer corners)
    var c = st.corners || {}, fl = Math.max(0, Math.min(c.FL || 0, dr.w / 2, dr.d / 2)), fr = Math.max(0, Math.min(c.FR || 0, dr.w / 2, dr.d / 2));
    var pts = [[0, 0], [dr.w, 0]];
    if (fr > 0) pts.push([dr.w, dr.d - fr], [dr.w - fr, dr.d]); else pts.push([dr.w, dr.d]);
    if (fl > 0) pts.push([fl, dr.d], [0, dr.d - fl]); else pts.push([0, dr.d]);
    var pathPts = pts.map(function (p2) { return X(p2[0]).toFixed(1) + ',' + Y(p2[1]).toFixed(1); }).join(' ');
    out += '<clipPath id="deckclip"><polygon points="' + pathPts + '"/></clipPath>';
    var viol = violations().length > 0;
    out += '<polygon points="' + pathPts + '" fill="#efe8d8" stroke="' + (viol ? WARN : INK) + '" stroke-width="2.4" style="cursor:default"/>';
    // board hatch (horizontal, like production)
    var gB = '<g clip-path="url(#deckclip)" stroke="' + RUL + '" stroke-width=".8">';
    for (var by = 0.5; by < dr.d; by += 0.5) gB += '<line x1="' + X(0) + '" y1="' + Y(by) + '" x2="' + X(dr.w) + '" y2="' + Y(by) + '"/>';
    out += gB + '</g>';
    // zones
    G.zoneRects(st).forEach(function (zr, i) {
      var r = loc(zr);
      out += '<rect x="' + X(r.x) + '" y="' + Y(r.y) + '" width="' + (r.w * s2) + '" height="' + (r.d * s2) + '" fill="#efe8d8" stroke="' + OK + '" stroke-width="2"/>';
      var gz = '<g stroke="' + RUL + '" stroke-width=".7">';
      for (var zy2 = r.y + 0.5; zy2 < r.y + r.d; zy2 += 0.5) gz += '<line x1="' + X(r.x) + '" y1="' + Y(zy2) + '" x2="' + X(r.x + r.w) + '" y2="' + Y(zy2) + '"/>';
      out += gz + '</g>';
      out += T(X(r.x + r.w / 2), Y(r.y + r.d / 2), 'ZONE ' + (i + 1), 10.5, OK, 'middle', ' font-weight="600"');
      out += T(X(r.x + r.w / 2), Y(r.y + r.d / 2) + 12, zr.w + "' × " + zr.d + "'", 9, MUT, 'middle');
    });
    // stairs (deck-edge draggable; zone stairs static)
    var sr = G.stairRects(st);
    (st.stairs || []).forEach(function (stair, i) {
      var r = loc(sr[i]);
      var drag = stair.zone == null ? ' style="cursor:move" data-drag="stair-' + i + '"' : '';
      out += '<rect x="' + X(r.x) + '" y="' + Y(r.y) + '" width="' + (r.w * s2) + '" height="' + (r.d * s2) + '" fill="#fffdf8" stroke="' + INK + '" stroke-width="1.6"' + drag + '/>';
      var steps = 5;
      for (var t2 = 1; t2 < steps; t2++) {
        if (sr[i].treadsAlong === 'y') {
          var ty = Y(r.y + r.d * t2 / steps);
          out += '<line x1="' + X(r.x) + '" y1="' + ty + '" x2="' + X(r.x + r.w) + '" y2="' + ty + '" stroke="' + INK + '" stroke-width="1" pointer-events="none"/>';
        } else {
          var tx = X(r.x + r.w * t2 / steps);
          out += '<line x1="' + tx + '" y1="' + Y(r.y) + '" x2="' + tx + '" y2="' + Y(r.y + r.d) + '" stroke="' + INK + '" stroke-width="1" pointer-events="none"/>';
        }
      }
      out += T(X(r.x + r.w / 2), Y(r.y + r.d / 2) + 4, 'DN', 10, INK, 'middle', ' pointer-events="none"');
    });
    // center area label
    var spec = SBPSpec.compute(st);
    out += T(X(dr.w / 2), Y(dr.d / 2), spec.area + ' S.F.', 15, INK, 'middle', ' font-weight="600"');
    if (viol) out += T(X(dr.w / 2), Y(dr.d / 2) + 18, 'CROSSES SETBACK — CHECK SITE VIEW', 10, WARN, 'middle');
    // red dimensions (production style)
    var RD = '#c62828';
    out += '<g stroke="' + RD + '" stroke-width="1" fill="none"><path d="M' + X(0) + ' ' + (Y(maxy) + 22) + ' H' + X(dr.w) + ' M' + X(0) + ' ' + (Y(maxy) + 17) + ' V' + (Y(maxy) + 27) + ' M' + X(dr.w) + ' ' + (Y(maxy) + 17) + ' V' + (Y(maxy) + 27) + '"/></g>';
    out += T((X(0) + X(dr.w)) / 2, Y(maxy) + 38, st.deck.w + "'", 13, RD, 'middle');
    out += '<g stroke="' + RD + '" stroke-width="1" fill="none"><path d="M' + (X(maxx) + 4) + ' ' + Y(0) + ' V' + Y(dr.d) + ' M' + (X(maxx) - 1) + ' ' + Y(0) + ' H' + (X(maxx) + 9) + ' M' + (X(maxx) - 1) + ' ' + Y(dr.d) + ' H' + (X(maxx) + 9) + '"/></g>';
    out += T(X(maxx) + 12, (Y(0) + Y(dr.d)) / 2 + 4, st.deck.d + "'", 13, RD);
    // resize handles (green squares like production)
    out += '<rect x="' + (X(dr.w) - 7) + '" y="' + (Y(dr.d / 2) - 7) + '" width="14" height="14" fill="#fffdf8" stroke="' + OK + '" stroke-width="2.2" style="cursor:ew-resize" data-drag="h-e"/>';
    out += '<rect x="' + (X(dr.w / 2) - 7) + '" y="' + (Y(dr.d) - 7) + '" width="14" height="14" fill="#fffdf8" stroke="' + OK + '" stroke-width="2.2" style="cursor:ns-resize" data-drag="h-n"/>';
    // + add-zone buttons on free edges
    function plus(xp, yp, edge) {
      return '<g style="cursor:pointer" data-drag="addzone-' + edge + '">' +
        '<circle cx="' + xp + '" cy="' + yp + '" r="11" fill="#fffdf8" stroke="' + OK + '" stroke-width="2"/>' +
        '<path d="M' + (xp - 5) + ' ' + yp + ' H' + (xp + 5) + ' M' + xp + ' ' + (yp - 5) + ' V' + (yp + 5) + '" stroke="' + OK + '" stroke-width="2" pointer-events="none"/></g>';
    }
    var haveL = (st.zones || []).some(function (z) { return z.edge === 'left'; });
    var haveR = (st.zones || []).some(function (z) { return z.edge === 'right'; });
    if ((st.zones || []).length < 3) {
      if (!haveL) out += plus(X(0) - 22, Y(dr.d * 0.6), 'left');
      if (!haveR) out += plus(X(dr.w) + 22, Y(dr.d * 0.6), 'right');
    }
    out += T(450, 606, '// DRAG GREEN HANDLES TO RESIZE · DRAG STAIRS ALONG THEIR EDGE · CLICK + TO ADD A ZONE', 10, MUT, 'middle');
    return out;
  }

  // ---------- axonometric ----------
  function renderAxon() {
    var h = st.house, dr = G.deckRect(st);
    var hz = st.deck.h / 12, top = 12;
    var pts = [];
    st.lot.forEach(function (p) { pts.push(G.iso(p[0], p[1], 0)); });
    pts.push(G.iso(h.x, h.y, top), G.iso(h.x + h.w, h.y + h.d, top));
    var b = G.bounds(pts);
    var pad = 70, s = Math.min((900 - 2 * pad) / (b.maxx - b.minx), (620 - 2 * pad) / (b.maxy - b.miny));
    var ox = (900 - s * (b.maxx - b.minx)) / 2, oy = (620 - s * (b.maxy - b.miny)) / 2;
    function PP(x, y, z) { var p = G.iso(x, y, z); return (ox + (p[0] - b.minx) * s).toFixed(1) + ',' + (oy + (b.maxy - p[1]) * s).toFixed(1); }
    var out = gridBg();
    function face(pts3, attrs) { return '<polygon points="' + pts3.map(function (p) { return PP(p[0], p[1], p[2]); }).join(' ') + '" ' + attrs + '/>'; }

    // lot slab
    out += face(st.lot.map(function (p) { return [p[0], p[1], 0]; }), 'fill="#f2efe6" stroke="' + INK + '" stroke-width="2"');
    // house block
    out += face([[h.x, h.y, 0], [h.x + h.w, h.y, 0], [h.x + h.w, h.y, top], [h.x, h.y, top]], 'fill="#e7e3d7" stroke="' + INK + '" stroke-width="1.4"');
    out += face([[h.x + h.w, h.y, 0], [h.x + h.w, h.y + h.d, 0], [h.x + h.w, h.y + h.d, top], [h.x + h.w, h.y, top]], 'fill="#ddd8c9" stroke="' + INK + '" stroke-width="1.4"');
    out += face([[h.x, h.y, top], [h.x + h.w, h.y, top], [h.x + h.w, h.y + h.d, top], [h.x, h.y + h.d, top]], 'fill="#efece3" stroke="' + INK + '" stroke-width="1.4"');

    // posts
    var spec = SBPSpec.compute(st);
    for (var i = 0; i < spec.posts; i++) {
      var px = dr.x + 1 + (dr.w - 2) * i / Math.max(1, spec.posts - 1);
      var a = PP(px, dr.y + dr.d - 1, 0).split(','), c = PP(px, dr.y + dr.d - 1, hz).split(',');
      out += '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + c[0] + '" y2="' + c[1] + '" stroke="' + INK + '" stroke-width="3"/>';
    }
    // deck slab
    var z1 = hz, z2 = hz + 0.7;
    var slabTop = [[dr.x, dr.y, z2], [dr.x + dr.w, dr.y, z2], [dr.x + dr.w, dr.y + dr.d, z2], [dr.x, dr.y + dr.d, z2]];
    out += face([[dr.x, dr.y + dr.d, z1], [dr.x + dr.w, dr.y + dr.d, z1], [dr.x + dr.w, dr.y + dr.d, z2], [dr.x, dr.y + dr.d, z2]], 'fill="#c8d8e8" stroke="' + CYAN + '" stroke-width="1.4"');
    out += face([[dr.x + dr.w, dr.y, z1], [dr.x + dr.w, dr.y + dr.d, z1], [dr.x + dr.w, dr.y + dr.d, z2], [dr.x + dr.w, dr.y, z2]], 'fill="#b7cade" stroke="' + CYAN + '" stroke-width="1.4"');
    out += face(slabTop, 'fill="#dbe7f2" stroke="' + CYAN + '" stroke-width="2"');
    // board lines on top
    var nB = Math.floor(dr.w / 2);
    for (var bd = 1; bd < nB; bd++) {
      var xx = dr.x + dr.w * bd / nB;
      var p1 = PP(xx, dr.y, z2).split(','), p2 = PP(xx, dr.y + dr.d, z2).split(',');
      out += '<line x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + p2[0] + '" y2="' + p2[1] + '" stroke="' + CYAN + '" stroke-width=".6" opacity=".5"/>';
    }
    // guards
    if (st.deck.h >= 30) {
      var gz = z2 + 3;
      [[dr.x, dr.y + dr.d], [dr.x + dr.w, dr.y + dr.d], [dr.x + dr.w, dr.y]].forEach(function (c, idx, arr) {
        if (idx === 0) return;
        var prev = arr[idx - 1];
        var q1 = PP(prev[0], prev[1], gz).split(','), q2 = PP(c[0], c[1], gz).split(',');
        out += '<line x1="' + q1[0] + '" y1="' + q1[1] + '" x2="' + q2[0] + '" y2="' + q2[1] + '" stroke="' + INK + '" stroke-width="1.6"/>';
      });
    }
    // stairs, chunky steps
    G.stairRects(st).forEach(function (r) {
      var steps = Math.max(3, Math.round(st.deck.h / 7.5));
      for (var sI = 0; sI < steps; sI++) {
        var zz = hz * (steps - sI) / steps;
        var frac0 = sI / steps, frac1 = (sI + 1) / steps;
        var sx0, sy0, sx1, sy1;
        if (r.treadsAlong === 'y') { sx0 = r.x; sx1 = r.x + r.w; sy0 = r.y + r.d * frac0; sy1 = r.y + r.d * frac1; }
        else { sy0 = r.y; sy1 = r.y + r.d; sx0 = r.x + r.w * frac0; sx1 = r.x + r.w * frac1; }
        out += face([[sx0, sy0, zz], [sx1, sy0, zz], [sx1, sy1, zz], [sx0, sy1, zz]], 'fill="#e3ecf4" stroke="' + CYAN + '" stroke-width=".9"');
      }
    });
    out += T(450, 596, 'AXONOMETRIC — DRAG SLIDERS OR SWITCH TO PLAN TO EDIT', 10.5, MUT, 'middle');
    return out;
  }

  // ---------- interaction ----------
  function down(e) {
    var t = e.target.getAttribute && e.target.getAttribute('data-drag');
    if (!t) return;
    if (t.indexOf('addzone-') === 0) { onChange && onChange(t); return; }
    e.preventDefault();
    var scale = (mode === 'design' && st.view !== 'site' && st.view !== 'axon' && dfit) ? dfit.s : (fit ? fit.s : null);
    if (!scale) return;
    var stairs0 = (st.stairs || []).map(function (x) { return { edge: x.edge, zone: x.zone, off: x.off }; });
    drag = { kind: t, startPx: pt(e), scale: scale, deck0: JSON.parse(JSON.stringify(st.deck)), house0: JSON.parse(JSON.stringify(st.house)), north0: st.north, stairs0: stairs0 };
  }
  function move(e) {
    if (!drag) return;
    var p = pt(e);
    var fx = (p.x - drag.startPx.x) / drag.scale;          // feet, screen-right positive
    var fyDown = (p.y - drag.startPx.y) / drag.scale;      // feet, screen-down positive
    var fyUp = -fyDown;                                    // lot-coords positive (away from street)
    var deckView = mode === 'design' && st.view !== 'site' && st.view !== 'axon';
    if (drag.kind === 'deck') {
      st.deck.off = clamp(Math.round(drag.deck0.off + fx), -6, st.house.w - st.deck.w + 6);
    } else if (drag.kind === 'h-e') {
      st.deck.w = clamp(Math.round(drag.deck0.w + fx), 6, 32);
    } else if (drag.kind === 'h-n') {
      st.deck.d = clamp(Math.round(drag.deck0.d + (deckView ? fyDown : fyUp)), 6, 20);
    } else if (drag.kind === 'house') {
      st.house.x = Math.round(drag.house0.x + fx);
      st.house.y = Math.round(drag.house0.y + fyUp);
    } else if (drag.kind === 'north') {
      st.north = Math.round((drag.north0 + fx * 4) % 360);
    } else if (drag.kind.indexOf('stair-') === 0) {
      var i = +drag.kind.slice(6);
      var stair = (st.stairs || [])[i];
      if (stair && stair.zone == null) {
        var base = drag.stairs0[i].off;
        if (base == null) base = stair.edge === 'front' ? (st.deck.w - 4) / 2 : (st.deck.d - 4) / 2;
        var delta = stair.edge === 'front' ? fx : fyDown;
        var span = stair.edge === 'front' ? st.deck.w - 4 : st.deck.d - 4;
        stair.off = clamp(Math.round(base + delta), 0, Math.max(0, span));
      }
    }
    render();
    onChange && onChange('drag');
  }
  function up() { if (drag) { drag = null; onChange && onChange('dragend'); } }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  window.SBPCanvas = { init: init, setMode: setMode, setState: setState, render: render };
})();
