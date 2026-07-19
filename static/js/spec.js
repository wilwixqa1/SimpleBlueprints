// ============================================================
// SBP MOCK SPEC ENGINE -- plausible IRC-flavored sizing for the
// live spec card. Simplified for the UX mock; NOT the real engine.
// ============================================================
(function () {
  // joist: pick by span (deck depth), SPF #2 flavored
  function joist(depth) {
    if (depth <= 8)  return { size: '2x8',  oc: 16 };
    if (depth <= 10) return { size: '2x10', oc: 16 };
    if (depth <= 12) return { size: '2x10', oc: 12 };
    if (depth <= 14) return { size: '2x12', oc: 12 };
    return { size: '2x12', oc: 8 };
  }
  // beam: ply count + size by beam span between posts and joist span
  function beam(width, depth, snow) {
    var postMax = depth <= 10 ? 8 : 6;
    if (snow >= 50) postMax = Math.max(4, postMax - 2);
    var nPosts = Math.max(2, Math.ceil(width / postMax) + 1);
    var span = width / (nPosts - 1);
    var size = depth <= 10 ? '(2) 2x10' : '(3) 2x10';
    if (depth > 12 || snow >= 50) size = '(3) 2x12';
    return { size: size, posts: nPosts, span: span };
  }
  function footing(depth, snow, frost) {
    var trib = depth / 2 * 7; // rough tributary sqft
    var dia = trib * (snow >= 50 ? 1.9 : 1.35) > 28 ? 18 : (trib > 14 ? 14 : 12);
    return { dia: dia, depth: frost };
  }

  window.SBPSpec = {
    compute: function (st) {
      var d = st.deck, snow = st.snow || 30, frost = st.frost || 36;
      var j = joist(d.d), b = beam(d.w, d.d, snow), f = footing(d.d, snow, frost);
      var extraZoneArea = (st.zones || []).reduce(function (a, z) { return a + z.w * z.d; }, 0);
      return {
        rows: [
          { k: 'Joists', v: j.size + ' @ ' + j.oc + '" O.C.', cite: 'IRC R507.5' },
          { k: 'Beam', v: b.size, cite: 'IRC R507.5.1' },
          { k: 'Posts', v: b.posts + ' × 6x6, max span ' + b.span.toFixed(1) + '\'', cite: 'IRC R507.4' },
          { k: 'Footings', v: f.dia + '" DIA × ' + f.depth + '" deep', cite: 'IRC R507.3 / R403' },
          { k: 'Ledger', v: '2x' + (parseInt(j.size.slice(2)) || 10) + ', 1/2" lags @ 16"', cite: 'IRC R507.9' },
          { k: 'Guards', v: d.h >= 30 ? '36" required' : 'Not required (<30")', cite: 'IRC R312.1' },
        ],
        area: Math.round(d.w * d.d + extraZoneArea),
        posts: b.posts,
        joist: j, beamSpec: b, footingSpec: f
      };
    }
  };
})();
