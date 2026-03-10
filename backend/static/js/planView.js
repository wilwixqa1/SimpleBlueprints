// ============================================================
// PLAN VIEW SVG — Multi-zone support (S19)
// ============================================================
const { useState: _pvUS, useRef: _pvUR, useMemo: _pvUM } = React;

function PlanView({ p, c, mode, u, zoneMode, pForZones, addZone, addCutout, getCorners, setCorner }) {
  const pad = 45;
  const sc = Math.min(420 / Math.max(c.W, 16), 18);
  const hw = p.houseWidth * sc;
  const sw = c.W * sc;
  const sd = c.D * sc;
  const bY = sd - 1.5 * sc;
  const svgW = Math.max(sw + pad * 2 + 40, hw + pad * 2 + 40);
  const svgH = sd + pad * 2 + 80;
  const houseCx = svgW / 2;
  const hx = houseCx - hw / 2;
  const deckOff = (p.deckOffset || 0) * sc;
  const dx = houseCx - sw / 2 + deckOff;
  const jLines = [];
  if (mode === "framing") {
    const s = c.sp / 12 * sc;
    for (let x = s; x < sw - 1; x += s) jLines.push(x);
  }

  // ── Zone computations ──
  var hasZones = p.zones && p.zones.length > 0;
  var composite = _pvUM(function() {
    if (!hasZones) return [{ x: 0, y: 0, w: c.W, d: c.D }];
    return window.getCompositeOutline(pForZones);
  }, [pForZones, hasZones, c.W, c.D]);
  var allRects = _pvUM(function() {
    if (!hasZones) return [{ id: 0, zone: { type: "add" }, rect: { x: 0, y: 0, w: c.W, d: c.D } }];
    return window.getAllZoneRects(pForZones);
  }, [pForZones, hasZones, c.W, c.D]);
  var exposedEdges = _pvUM(function() {
    if (!hasZones) return [];
    return window.getExposedEdges(pForZones);
  }, [pForZones, hasZones, c.W, c.D]);
  var addRects = allRects.filter(function(r) { return r.zone.type !== "cutout"; });
  var cutRects = allRects.filter(function(r) { return r.zone.type === "cutout"; });
  var totalArea = Math.round(addRects.reduce(function(s, a) { return s + a.rect.w * a.rect.d; }, 0) - cutRects.reduce(function(s, a) { return s + a.rect.w * a.rect.d; }, 0));

  const dragRef = _pvUR(null);
  const svgRef = _pvUR(null);
  const [stairSelected, setStairSelected] = _pvUS(false);
  const [rotPreview, setRotPreview] = _pvUS(null);
  const [hoverBtn, setHoverBtn] = _pvUS(null);
  const rotAngleRef = _pvUR(null);
  const stairGroupRef = _pvUR(null);

  // ── Existing drag handlers (unchanged) ──
  const onPointerDown = (e, type) => {
    e.preventDefault(); e.stopPropagation();
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgScale = svgW / rect.width;
    dragRef.current = { type, startX: e.clientX, startY: e.clientY, svgScale,
      startVal: type === "deck" ? (p.deckOffset || 0) : (p.stairOffset || 0) };
    const onMove = (ev) => {
      if (!dragRef.current) return;
      const loc = p.stairLocation;
      const isVertical = dragRef.current.type === "stair" && loc !== "front";
      const delta = isVertical
        ? (ev.clientY - dragRef.current.startY) * dragRef.current.svgScale
        : (ev.clientX - dragRef.current.startX) * dragRef.current.svgScale;
      const deltaFt = delta / sc;
      if (dragRef.current.type === "deck") {
        const maxOff = p.houseWidth / 2;
        const newVal = Math.round(Math.max(-maxOff, Math.min(maxOff, dragRef.current.startVal + deltaFt)));
        u("deckOffset", newVal);
      } else {
        const maxStairOff = loc === "front" ? (c.W - (p.stairWidth || 4)) / 2 : (c.D - (p.stairWidth || 4)) / 2;
        const newVal = Math.round(Math.max(-maxStairOff, Math.min(maxStairOff, dragRef.current.startVal + deltaFt)));
        u("stairOffset", newVal);
      }
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onStairDragStart = (e) => {
    e.preventDefault(); e.stopPropagation();
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgScale = svgW / rect.width;
    const pl = window.getStairPlacement(p, c);
    dragRef.current = { type: "stairAnchor", startX: e.clientX, startY: e.clientY, svgScale,
      startAnchorX: pl.anchorX, startAnchorY: pl.anchorY, startAngle: pl.angle };
    const onMove = (ev) => {
      if (!dragRef.current || dragRef.current.type !== "stairAnchor") return;
      const deltaXpx = (ev.clientX - dragRef.current.startX) * dragRef.current.svgScale;
      const deltaYpx = (ev.clientY - dragRef.current.startY) * dragRef.current.svgScale;
      let newAX = dragRef.current.startAnchorX + deltaXpx / sc;
      let newAY = dragRef.current.startAnchorY + deltaYpx / sc;
      newAX = Math.max(-0.5, Math.min(c.W + 0.5, newAX));
      newAY = Math.max(-0.5, Math.min(c.D + 0.5, newAY));
      const snap = window.snapStairToEdge(newAX, newAY, c.W, c.D, 1.0);
      u("stairAnchorX", Math.round(snap.anchorX * 2) / 2);
      u("stairAnchorY", Math.round(snap.anchorY * 2) / 2);
      u("stairAngle", snap.snapped ? snap.angle : (dragRef.current.startAngle || 0));
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onRotateDragStart = (e, centerX, centerY) => {
    e.preventDefault(); e.stopPropagation();
    const svg = svgRef.current; if (!svg) return;
    const grp = stairGroupRef.current; if (!grp) return;
    const rect = svg.getBoundingClientRect();
    const svgScaleR = svgW / rect.width;
    const pl = window.getStairPlacement(p, c);
    const pivX = dx + pl.anchorX * sc;
    const pivY = pad + pl.anchorY * sc;
    const getMouseDeg = (ev) => Math.atan2(
      (ev.clientY - rect.top) * svgScaleR - centerY,
      (ev.clientX - rect.left) * svgScaleR - centerX
    ) * 180 / Math.PI;
    let prevMouseDeg = getMouseDeg(e);
    let cumRotation = 0;
    dragRef.current = { type: "rotate", anchorX: pl.anchorX, anchorY: pl.anchorY, startAngle: pl.angle };
    const onMove = (ev) => {
      if (!dragRef.current || dragRef.current.type !== "rotate") return;
      const curDeg = getMouseDeg(ev);
      let incr = curDeg - prevMouseDeg;
      if (incr > 180) incr -= 360; if (incr < -180) incr += 360;
      cumRotation += incr; prevMouseDeg = curDeg;
      grp.setAttribute("transform", "rotate(" + cumRotation + " " + pivX + " " + pivY + ")");
      rotAngleRef.current = ((dragRef.current.startAngle + cumRotation) % 360 + 360) % 360;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
      const dr = dragRef.current;
      if (dr && dr.type === "rotate") {
        const raw = rotAngleRef.current != null ? rotAngleRef.current : dr.startAngle;
        const snaps = [0, 90, 180, 270];
        let best = 0, bestDist = 999;
        for (const s of snaps) { let d = Math.abs(raw - s); if (d > 180) d = 360 - d; if (d < bestDist) { bestDist = d; best = s; } }
        let snapDelta = best - raw; if (snapDelta > 180) snapDelta -= 360; if (snapDelta < -180) snapDelta += 360;
        const targetCum = cumRotation + snapDelta, startCum = cumRotation, duration = 150, t0 = performance.now();
        const animate = (now) => {
          const elapsed = now - t0, progress = Math.min(elapsed / duration, 1), eased = 1 - Math.pow(1 - progress, 3);
          grp.setAttribute("transform", "rotate(" + (startCum + (targetCum - startCum) * eased) + " " + pivX + " " + pivY + ")");
          if (progress < 1) requestAnimationFrame(animate);
          else { grp.removeAttribute("transform"); u("stairAnchorX", dr.anchorX); u("stairAnchorY", dr.anchorY); u("stairAngle", best); }
        };
        requestAnimationFrame(animate);
      } else { grp.removeAttribute("transform"); }
      rotAngleRef.current = null; dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  };

  // ── SVG coordinate helpers for zones ──
  function zx(fx) { return dx + fx * sc; }
  function zy(fy) { return pad + fy * sc; }

  // ── Compute add/cut/chamfer button positions ──
  var addBtns = _pvUM(function() {
    if (zoneMode !== "add" || mode !== "plan") return [];
    if (!hasZones) {
      // Default: 3 add buttons on zone 0 edges (front, left, right)
      return [
        { k: "a-0-front", zid: 0, edge: "front", bx: zx(c.W / 2), by: zy(c.D) + 18 },
        { k: "a-0-left", zid: 0, edge: "left", bx: zx(0) - 18, by: zy(c.D / 2) },
        { k: "a-0-right", zid: 0, edge: "right", bx: zx(c.W) + 18, by: zy(c.D / 2) },
      ];
    }
    return exposedEdges.map(function(e, i) {
      var mx = zx((e.x1 + e.x2) / 2), my = zy((e.y1 + e.y2) / 2);
      var bx2 = mx, by2 = my;
      if (e.dir === "h") by2 += 18; else bx2 += 18;
      // Determine edge name and parent zone
      var zid = 0, ename = "front";
      addRects.forEach(function(a) {
        var r = a.rect;
        if (e.dir === "h") {
          var mid = (e.x1 + e.x2) / 2;
          if (mid >= r.x - 0.01 && mid <= r.x + r.w + 0.01) {
            if (Math.abs(e.y1 - (r.y + r.d)) < 0.01) { zid = a.id; ename = "front"; }
          }
        } else {
          var mid2 = (e.y1 + e.y2) / 2;
          if (mid2 >= r.y - 0.01 && mid2 <= r.y + r.d + 0.01) {
            if (Math.abs(e.x1 - (r.x + r.w)) < 0.01) { zid = a.id; ename = "right"; }
            if (Math.abs(e.x1 - r.x) < 0.01) { zid = a.id; ename = "left"; }
          }
        }
      });
      return { k: "a-" + i, bx: bx2, by: by2, zid: zid, edge: ename };
    });
  }, [zoneMode, mode, hasZones, exposedEdges, addRects, c.W, c.D, dx, sc]);

  var cutBtns = _pvUM(function() {
    if (zoneMode !== "cut" || mode !== "plan") return [];
    var btns = [];
    addRects.forEach(function(a) {
      var r = a.rect;
      [{ e: "back-left", x: r.x, y: r.y }, { e: "back-right", x: r.x + r.w, y: r.y },
       { e: "front-left", x: r.x, y: r.y + r.d }, { e: "front-right", x: r.x + r.w, y: r.y + r.d },
       { e: "interior", x: r.x + r.w / 2, y: r.y + r.d / 2 }].forEach(function(cc) {
        btns.push({ k: "c-" + a.id + "-" + cc.e, zid: a.id, edge: cc.e, bx: zx(cc.x), by: zy(cc.y) });
      });
    });
    return btns;
  }, [zoneMode, mode, addRects, dx, sc]);

  var chamferBtns = _pvUM(function() {
    if (zoneMode !== "chamfer" || mode !== "plan") return [];
    var btns = [];
    addRects.forEach(function(a) {
      var r = a.rect;
      [{ corner: "BL", x: r.x, y: r.y }, { corner: "BR", x: r.x + r.w, y: r.y },
       { corner: "FL", x: r.x, y: r.y + r.d }, { corner: "FR", x: r.x + r.w, y: r.y + r.d }].forEach(function(cc) {
        var cur = getCorners(a.id)[cc.corner];
        btns.push({ k: "ch-" + a.id + "-" + cc.corner, zid: a.id, corner: cc.corner, bx: zx(cc.x), by: zy(cc.y), hasChamfer: cur && cur.type === "chamfer" && cur.size > 0 });
      });
    });
    return btns;
  }, [zoneMode, mode, addRects, getCorners, dx, sc]);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "auto" }}
      onClick={() => { setStairSelected(false); if (zoneMode === "select") u("activeZone", 0); }}>
      <defs>
        <filter id="rotShadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.15" /></filter>
        <pattern id="cutHatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#dc2626" strokeWidth="0.8" opacity="0.25" />
        </pattern>
        {/* Clip path for composite deck area */}
        <clipPath id="deckClip">
          {composite.map(function(r, i) {
            return <rect key={i} x={zx(r.x)} y={zy(r.y)} width={r.w * sc} height={r.d * sc} />;
          })}
        </clipPath>
      </defs>

      {/* House */}
      <rect x={hx} y={pad - 50} width={hw} height={50} fill="#e8e6e0" stroke="#444" strokeWidth="1.2" rx="1" />
      <text x={houseCx} y={pad - 25} textAnchor="middle" style={{ fontSize: 8, fill: "#999", fontFamily: "monospace", fontWeight: 600, letterSpacing: "1px" }}>EXISTING HOUSE</text>

      {/* ── Composite deck surface ── */}
      {composite.map(function(r, i) {
        return <rect key={"comp" + i} x={zx(r.x)} y={zy(r.y)} width={r.w * sc} height={r.d * sc}
          fill={mode === "framing" ? "#fcfaf5" : "#efe5d5"} stroke="none" />;
      })}

      {/* Deck outline per additive zone */}
      {addRects.map(function(a) {
        var r = a.rect;
        var isActive = a.id === p.activeZone;
        return <rect key={"zo" + a.id} x={zx(r.x)} y={zy(r.y)} width={r.w * sc} height={r.d * sc}
          fill={isActive ? "rgba(37,99,235,0.06)" : "none"} stroke={isActive ? "#2563eb" : "#333"} strokeWidth={isActive ? 2.5 : 2} rx="1"
          onClick={function(e) { e.stopPropagation(); u("activeZone", a.id); }}
          style={{ cursor: zoneMode === "select" ? "pointer" : "default" }} />;
      })}

      {/* Chamfer corner clips — draw bg-colored triangles over corners */}
      {addRects.map(function(a) {
        var r = a.rect, corners = getCorners(a.id);
        var x = zx(r.x), y = zy(r.y), w = r.w * sc, h = r.d * sc;
        var tris = [];
        var bl = (corners.BL && corners.BL.type === "chamfer" ? corners.BL.size : 0) * sc;
        var br2 = (corners.BR && corners.BR.type === "chamfer" ? corners.BR.size : 0) * sc;
        var fl = (corners.FL && corners.FL.type === "chamfer" ? corners.FL.size : 0) * sc;
        var fr = (corners.FR && corners.FR.type === "chamfer" ? corners.FR.size : 0) * sc;
        if (bl > 0) { tris.push(<polygon key={a.id + "-bl"} points={x + "," + y + " " + (x + bl) + "," + y + " " + x + "," + (y + bl)} fill="#faf8f3" />);
          tris.push(<line key={a.id + "-bld"} x1={x + bl} y1={y} x2={x} y2={y + bl} stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3,2" />); }
        if (br2 > 0) { tris.push(<polygon key={a.id + "-br"} points={(x + w) + "," + y + " " + (x + w - br2) + "," + y + " " + (x + w) + "," + (y + br2)} fill="#faf8f3" />);
          tris.push(<line key={a.id + "-brd"} x1={x + w - br2} y1={y} x2={x + w} y2={y + br2} stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3,2" />); }
        if (fl > 0) { tris.push(<polygon key={a.id + "-fl"} points={x + "," + (y + h) + " " + (x + fl) + "," + (y + h) + " " + x + "," + (y + h - fl)} fill="#faf8f3" />);
          tris.push(<line key={a.id + "-fld"} x1={x + fl} y1={y + h} x2={x} y2={y + h - fl} stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3,2" />); }
        if (fr > 0) { tris.push(<polygon key={a.id + "-fr"} points={(x + w) + "," + (y + h) + " " + (x + w - fr) + "," + (y + h) + " " + (x + w) + "," + (y + h - fr)} fill="#faf8f3" />);
          tris.push(<line key={a.id + "-frd"} x1={x + w - fr} y1={y + h} x2={x + w} y2={y + h - fr} stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3,2" />); }
        return tris.length > 0 ? <g key={"ch" + a.id}>{tris}</g> : null;
      })}

      {/* Cutout zones — hatched */}
      {cutRects.map(function(a) {
        var r = a.rect, isActive = a.id === p.activeZone;
        return <g key={"cut" + a.id} onClick={function(e) { e.stopPropagation(); u("activeZone", a.id); }} style={{ cursor: "pointer" }}>
          <rect x={zx(r.x)} y={zy(r.y)} width={r.w * sc} height={r.d * sc} fill="#faf8f3" />
          <rect x={zx(r.x)} y={zy(r.y)} width={r.w * sc} height={r.d * sc} fill="url(#cutHatch)" />
          <rect x={zx(r.x)} y={zy(r.y)} width={r.w * sc} height={r.d * sc}
            fill="none" stroke={isActive ? "#dc2626" : "#e88"} strokeWidth={isActive ? 2 : 1.2} strokeDasharray={isActive ? "none" : "3,2"} />
          <text x={zx(r.x) + r.w * sc / 2} y={zy(r.y) + r.d * sc / 2 + 2} textAnchor="middle"
            style={{ fontSize: 5, fill: "#dc2626", fontFamily: "monospace", fontWeight: 700 }}>{a.zone.label || "CUT"}</text>
        </g>;
      })}

      {/* Zone labels for zones 1+ */}
      {hasZones && addRects.filter(function(a) { return a.id > 0; }).map(function(a) {
        var r = a.rect, isActive = a.id === p.activeZone;
        return <text key={"zlbl" + a.id} x={zx(r.x) + 4} y={zy(r.y) + 10}
          style={{ fontSize: 5.5, fill: isActive ? "#2563eb" : "#888", fontFamily: "monospace", fontWeight: 700 }}>
          {a.zone.label || "Zone " + a.id}
        </text>;
      })}

      {/* Deck drag handle */}
      {u && mode === "plan" && zoneMode === "select" && <g style={{ cursor: "ew-resize" }} onPointerDown={e => onPointerDown(e, "deck")}>
        <rect x={dx + sw / 2 - 15} y={pad - 3} width={30} height={6} rx={3} fill="#3d5a2e" opacity="0.7" />
        <text x={dx + sw / 2} y={pad + 1} textAnchor="middle" style={{ fontSize: 4, fill: "#fff", fontFamily: "monospace", fontWeight: 700, pointerEvents: "none" }}>{"\u25C4"} DRAG {"\u25BA"}</text>
      </g>}

      {/* Decking lines (clipped to composite) */}
      {mode === "plan" && <g clipPath="url(#deckClip)">
        {Array.from({ length: Math.ceil(sd / (5.5 / 12 * sc)) }, (_, i) => i * 5.5 / 12 * sc).filter(y => y <= sd + 200).map((y, i) => (
          <line key={i} x1={dx - 100} y1={pad + y} x2={dx + sw + 200} y2={pad + y} stroke="#c9ad7a" strokeWidth="0.3" />
        ))}
      </g>}

      {/* Ledger */}
      {c.attachment === "ledger" && <><line x1={dx} y1={pad} x2={dx + sw} y2={pad} stroke="#2e7d32" strokeWidth="3.5" style={{ pointerEvents: "none" }} />
        <text x={dx + sw / 2} y={pad - 5} textAnchor="middle" style={{ fontSize: 5, fill: "#2e7d32", fontWeight: 700, fontFamily: "monospace", pointerEvents: "none" }}>LEDGER</text></>}

      {/* Framing (zone 0 only for now) */}
      {mode === "framing" && <>
        {jLines.map((x, i) => <line key={i} x1={dx + x} y1={pad + 1} x2={dx + x} y2={pad + bY} stroke="#bbb" strokeWidth="0.4" />)}
        <line x1={dx + 1 * sc} y1={pad + bY} x2={dx + sw - 1 * sc} y2={pad + bY} stroke="#c4960a" strokeWidth="4" strokeLinecap="round" />
        <text x={dx + sw / 2} y={pad + bY - 6} textAnchor="middle" style={{ fontSize: 5.5, fill: "#9a7a00", fontWeight: 700, fontFamily: "monospace" }}>{c.beamSize.toUpperCase()}</text>
        <text x={dx + sw / 2} y={pad + sd / 2 - 4} textAnchor="middle" style={{ fontSize: 7, fill: "#888", fontFamily: "monospace" }}>{c.joistSize} @ {c.sp}" O.C.</text>
        {c.pp.map((px, i) => <g key={i}><circle cx={dx + px * sc} cy={pad + bY} r={4.5} fill="#c4a060" stroke="#444" strokeWidth="1" /><circle cx={dx + px * sc} cy={pad + bY} r={9} fill="none" stroke="#444" strokeWidth="0.4" strokeDasharray="2,2" /></g>)}
      </>}

      {/* Area label */}
      {mode === "plan" && <text x={dx + sw / 2} y={pad + sd / 2 + 3} textAnchor="middle" style={{ fontSize: 10, fill: "#666", fontFamily: "monospace", fontWeight: 700 }}>{totalArea} S.F.</text>}

      {/* Rim joist outlines (zone 0 edges) */}
      {[[dx, pad, dx, pad + sd], [dx, pad + sd, dx + sw, pad + sd], [dx + sw, pad, dx + sw, pad + sd]].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#444" strokeWidth="3.5" />
      ))}

      {/* ── Stairs (unchanged) ── */}
      {p.hasStairs && c.stairs && (() => {
        const stairGeom = window.computeStairGeometry({ template: p.stairTemplate || "straight", height: p.height, stairWidth: p.stairWidth || 4, numStringers: p.numStringers || 3, runSplit: p.stairRunSplit ? p.stairRunSplit/100 : null, landingDepth: p.stairLandingDepth || null, stairGap: p.stairGap != null ? p.stairGap : 0.5 });
        if (!stairGeom) return null;
        const placement = window.getStairPlacement(p, c);
        const exitSide = placement.angle === 90 ? "right" : placement.angle === 270 ? "left" : placement.angle === 180 ? "back" : "front";
        const ox = dx + placement.anchorX * sc;
        const oy = pad + placement.anchorY * sc + (exitSide === "front" ? 1 : exitSide === "back" ? -1 : 0);
        function txRect(r) {
          if (exitSide === "front") return { x: ox + r.x*sc, y: oy + r.y*sc, w: r.w*sc, h: r.h*sc };
          if (exitSide === "back")  return { x: ox - (r.x+r.w)*sc, y: oy - (r.y+r.h)*sc, w: r.w*sc, h: r.h*sc };
          if (exitSide === "left")  return { x: ox - (r.y+r.h)*sc, y: oy + r.x*sc, w: r.h*sc, h: r.w*sc };
          return { x: ox + r.y*sc, y: oy + r.x*sc, w: r.h*sc, h: r.w*sc };
        }
        function txPt(px2, py2) {
          if (exitSide === "front") return [ox + px2*sc, oy + py2*sc];
          if (exitSide === "back")  return [ox - px2*sc, oy - py2*sc];
          if (exitSide === "left")  return [ox - py2*sc, oy + px2*sc];
          return [ox + py2*sc, oy + px2*sc];
        }
        function treadInfo(run) {
          const tr = txRect(run.rect);
          if (exitSide === "front" || exitSide === "back") return run.treadAxis === "h" ? { along: "y", span: "x", rect: tr } : { along: "x", span: "y", rect: tr };
          return run.treadAxis === "h" ? { along: "x", span: "y", rect: tr } : { along: "y", span: "x", rect: tr };
        }
        function transformDir(dd) {
          if (exitSide === "back") { if(dd==="+y")return"-y";if(dd==="-y")return"+y";if(dd==="+x")return"-x";if(dd==="-x")return"+x"; }
          if (exitSide === "left") { if(dd==="+y")return"-x";if(dd==="-y")return"+x";if(dd==="+x")return"+y";if(dd==="-x")return"-y"; }
          if (exitSide === "right") { if(dd==="+y")return"+x";if(dd==="-y")return"-x";if(dd==="+x")return"-y";if(dd==="-x")return"+y"; }
          return dd;
        }
        const els = [];
        stairGeom.runs.forEach((run, ri) => {
          const tr = txRect(run.rect);
          els.push(<rect key={"run"+ri} x={tr.x} y={tr.y} width={tr.w} height={tr.h} fill="#faf8f3" stroke="#444" strokeWidth="0.8" />);
          const ti = treadInfo(run);
          const n = run.treads;
          if (ti.along === "y") {
            const stp = tr.h / Math.max(n, 1);
            for (let i = 0; i <= n; i++) els.push(<line key={"t"+ri+"_"+i} x1={tr.x} y1={tr.y+i*stp} x2={tr.x+tr.w} y2={tr.y+i*stp} stroke="#aaa" strokeWidth="0.5" />);
            for (let si = 0; si < run.nStringers; si++) { const f = run.nStringers>1?si/(run.nStringers-1):0.5; els.push(<line key={"s"+ri+"_"+si} x1={tr.x+f*tr.w} y1={tr.y} x2={tr.x+f*tr.w} y2={tr.y+tr.h} stroke="#999" strokeWidth="0.3" strokeDasharray="2,2" />); }
          } else {
            const stp = tr.w / Math.max(n, 1);
            for (let i = 0; i <= n; i++) els.push(<line key={"t"+ri+"_"+i} x1={tr.x+i*stp} y1={tr.y} x2={tr.x+i*stp} y2={tr.y+tr.h} stroke="#aaa" strokeWidth="0.5" />);
            for (let si = 0; si < run.nStringers; si++) { const f = run.nStringers>1?si/(run.nStringers-1):0.5; els.push(<line key={"s"+ri+"_"+si} x1={tr.x} y1={tr.y+f*tr.h} x2={tr.x+tr.w} y2={tr.y+f*tr.h} stroke="#999" strokeWidth="0.3" strokeDasharray="2,2" />); }
          }
          const cx2=tr.x+tr.w/2, cy2=tr.y+tr.h/2;
          els.push(<text key={"dn"+ri} x={cx2} y={cy2-1} textAnchor="middle" style={{ fontSize: 5.5, fill: "#444", fontFamily: "monospace", fontWeight: 700 }}>DN</text>);
          const dd = transformDir(run.downDir), as2 = 3, ay2 = cy2 + 4;
          if (dd==="+y") els.push(<polygon key={"ar"+ri} points={(cx2-as2)+","+ay2+" "+cx2+","+(ay2+as2)+" "+(cx2+as2)+","+ay2} fill="#666" />);
          else if (dd==="-y") els.push(<polygon key={"ar"+ri} points={(cx2-as2)+","+ay2+" "+cx2+","+(ay2-as2)+" "+(cx2+as2)+","+ay2} fill="#666" />);
          else if (dd==="+x") els.push(<polygon key={"ar"+ri} points={(cx2+2)+","+(cy2-as2)+" "+(cx2+2+as2)+","+cy2+" "+(cx2+2)+","+(cy2+as2)} fill="#666" />);
          else if (dd==="-x") els.push(<polygon key={"ar"+ri} points={(cx2-2)+","+(cy2-as2)+" "+(cx2-2-as2)+","+cy2+" "+(cx2-2)+","+(cy2+as2)} fill="#666" />);
        });
        stairGeom.landings.forEach((landing, li) => {
          const tr = txRect(landing.rect);
          els.push(<rect key={"land"+li} x={tr.x} y={tr.y} width={tr.w} height={tr.h} fill="#e8e6d8" stroke="#444" strokeWidth="1" strokeDasharray="4,2" />);
          els.push(<text key={"ltxt"+li} x={tr.x+tr.w/2} y={tr.y+tr.h/2+2} textAnchor="middle" style={{ fontSize: 5, fill: "#666", fontFamily: "monospace", fontWeight: 600 }}>LANDING</text>);
          landing.posts.forEach((pt, pi) => {
            const [px2, py2] = txPt(pt[0], pt[1]);
            els.push(<circle key={"lp"+li+"_"+pi} cx={px2} cy={py2} r={2.5} fill="#c4a060" stroke="#444" strokeWidth="0.6" />);
            els.push(<circle key={"lpo"+li+"_"+pi} cx={px2} cy={py2} r={5.5} fill="none" stroke="#444" strokeWidth="0.3" strokeDasharray="1.5,1.5" />);
          });
        });
        const names = { straight:"Straight", lLeft:"L-Left", lRight:"L-Right", switchback:"Switchback", wrapAround:"Wrap-Around", wideLanding:"Platform" };
        const labelPt = txPt(0, stairGeom.bbox.maxY + 2);
        els.push(<text key="stlbl" x={labelPt[0]} y={labelPt[1]} textAnchor="middle" style={{ fontSize: 5.5, fill: "#7a8068", fontFamily: "monospace", fontWeight: 600 }}>{names[stairGeom.template]} {"\u00B7"} {stairGeom.totalRisers} risers {"\u00B7"} {stairGeom.stairWidth}' wide {"\u00B7"} {stairGeom.runs.length} run{stairGeom.runs.length>1?"s":""}</text>);
        if (u && mode === "plan" && zoneMode === "select") {
          const bb = stairGeom.bbox;
          const bbRect = txRect({ x: bb.minX - 0.5, y: bb.minY - 0.5, w: bb.w + 1, h: bb.h + 1 });
          const hcx = bbRect.x + bbRect.w / 2, hcy = bbRect.y + bbRect.h / 2;
          els.push(<rect key="dragZone" x={bbRect.x - 3} y={bbRect.y - 3} width={bbRect.w + 6} height={bbRect.h + 6}
            fill="transparent" stroke={stairSelected ? "#3d5a2e" : "none"}
            strokeWidth={stairSelected ? "1.2" : "0"} strokeDasharray={stairSelected ? "3,2" : "none"}
            rx="2" style={{ cursor: "move" }}
            onPointerDown={e => { e.stopPropagation(); setStairSelected(true); onStairDragStart(e); }}
            onClick={e => e.stopPropagation()} />);
          if (stairSelected) {
            const curAngle = placement.angle;
            const dirLabels = { 0: "Front", 90: "Right", 180: "Back", 270: "Left" };
            const rHx = hcx, stemLen = 10, rHy = bbRect.y - stemLen - 7, hr = 7;
            els.push(<line key="rotStem" x1={hcx} y1={bbRect.y - 1} x2={rHx} y2={rHy + hr} stroke="#bbb" strokeWidth="0.7" style={{ pointerEvents: "none" }} />);
            els.push(<g key="rotHandle" style={{ cursor: "grab" }} onPointerDown={e => { e.stopPropagation(); onRotateDragStart(e, hcx, hcy); }}>
              <circle cx={rHx} cy={rHy} r={hr} fill="white" stroke="#3d5a2e" strokeWidth="1.5" filter="url(#rotShadow)" />
              <path d={"M " + (rHx - 3) + " " + (rHy + 1) + " A 3.5 3.5 0 1 1 " + (rHx + 1) + " " + (rHy - 3)} fill="none" stroke="#3d5a2e" strokeWidth="1.5" strokeLinecap="round" />
              <polygon points={(rHx + 1) + "," + (rHy - 5) + " " + (rHx + 3.2) + "," + (rHy - 2.2) + " " + (rHx - 1) + "," + (rHy - 2.2)} fill="#3d5a2e" />
            </g>);
            els.push(<text key="rotDir" x={rHx} y={rHy - hr - 2} textAnchor="middle" style={{ fontSize: 4.5, fill: "#666", fontFamily: "monospace", fontWeight: 600, pointerEvents: "none" }}>{dirLabels[curAngle] || ""}</text>);
          }
        }
        return <g ref={stairGroupRef}>{els}</g>;
      })()}

      {/* ── Dimension lines ── */}
      <line x1={dx} y1={pad + sd + 25} x2={dx + sw} y2={pad + sd + 25} stroke="#c62828" strokeWidth="0.6" />
      <line x1={dx} y1={pad + sd + 22} x2={dx} y2={pad + sd + 28} stroke="#c62828" strokeWidth="0.6" />
      <line x1={dx + sw} y1={pad + sd + 22} x2={dx + sw} y2={pad + sd + 28} stroke="#c62828" strokeWidth="0.6" />
      <text x={dx + sw / 2} y={pad + sd + 37} textAnchor="middle" style={{ fontSize: 9, fill: "#c62828", fontWeight: 800, fontFamily: "'DM Mono', monospace" }}>{window.fmtFtIn(c.W)}</text>
      <line x1={dx + sw + 20} y1={pad} x2={dx + sw + 20} y2={pad + sd} stroke="#1565c0" strokeWidth="0.6" />
      <line x1={dx + sw + 17} y1={pad} x2={dx + sw + 23} y2={pad} stroke="#1565c0" strokeWidth="0.6" />
      <line x1={dx + sw + 17} y1={pad + sd} x2={dx + sw + 23} y2={pad + sd} stroke="#1565c0" strokeWidth="0.6" />
      <text x={dx + sw + 32} y={pad + sd / 2 + 3} textAnchor="middle" style={{ fontSize: 9, fill: "#1565c0", fontWeight: 800, fontFamily: "'DM Mono', monospace" }} transform={`rotate(90, ${dx + sw + 32}, ${pad + sd / 2})`}>{window.fmtFtIn(c.D)}</text>

      {/* ── Add zone buttons ── */}
      {addBtns.map(function(b) {
        var h = hoverBtn === b.k;
        return <g key={b.k} onMouseEnter={function() { setHoverBtn(b.k); }} onMouseLeave={function() { setHoverBtn(null); }}
          onClick={function(e) { e.stopPropagation(); addZone(b.zid, b.edge); }} style={{ cursor: "pointer" }}>
          <circle cx={b.bx} cy={b.by} r={h ? 10 : 7.5} fill={h ? "#16a34a" : "white"} stroke="#16a34a" strokeWidth="1.5" style={{ transition: "all 0.12s" }} />
          <text x={b.bx} y={b.by + 1} textAnchor="middle" dominantBaseline="central" fontSize={h ? 12 : 9} fontWeight="800" fill={h ? "white" : "#16a34a"} style={{ userSelect: "none" }}>+</text>
        </g>;
      })}

      {/* ── Cut buttons ── */}
      {cutBtns.map(function(b) {
        var h = hoverBtn === b.k, isCorner = b.edge.includes("-");
        return <g key={b.k} onMouseEnter={function() { setHoverBtn(b.k); }} onMouseLeave={function() { setHoverBtn(null); }}
          onClick={function(e) { e.stopPropagation(); addCutout(b.zid, b.edge); }} style={{ cursor: "pointer" }}>
          {isCorner
            ? <rect x={b.bx - (h ? 8 : 6)} y={b.by - (h ? 8 : 6)} width={h ? 16 : 12} height={h ? 16 : 12} rx="2"
                fill={h ? "#dc2626" : "white"} stroke="#dc2626" strokeWidth="1.5" style={{ transition: "all 0.12s" }} />
            : <circle cx={b.bx} cy={b.by} r={h ? 10 : 7.5} fill={h ? "#dc2626" : "white"} stroke="#dc2626" strokeWidth="1.5" style={{ transition: "all 0.12s" }} />}
          <text x={b.bx} y={b.by + 1} textAnchor="middle" dominantBaseline="central"
            fontSize={h ? 10 : 7} fontWeight="800" fill={h ? "white" : "#dc2626"} style={{ userSelect: "none" }}>{b.edge === "interior" ? "\u25A1" : "\u2702"}</text>
        </g>;
      })}

      {/* ── Chamfer buttons ── */}
      {chamferBtns.map(function(b) {
        var h = hoverBtn === b.k;
        return <g key={b.k} onMouseEnter={function() { setHoverBtn(b.k); }} onMouseLeave={function() { setHoverBtn(null); }}
          onClick={function(e) {
            e.stopPropagation(); u("activeZone", b.zid);
            if (b.hasChamfer) setCorner(b.zid, b.corner, "square", 0);
            else setCorner(b.zid, b.corner, "chamfer", 3);
          }} style={{ cursor: "pointer" }}>
          <polygon points={(b.bx) + "," + (b.by - (h ? 10 : 8)) + " " + (b.bx + (h ? 10 : 8)) + "," + b.by + " " + b.bx + "," + (b.by + (h ? 10 : 8)) + " " + (b.bx - (h ? 10 : 8)) + "," + b.by}
            fill={b.hasChamfer ? "#7c3aed" : (h ? "#f3e8ff" : "white")} stroke="#7c3aed" strokeWidth="1.5" style={{ transition: "all 0.12s" }} />
          <text x={b.bx} y={b.by + 1} textAnchor="middle" dominantBaseline="central"
            fontSize={7} fontWeight="800" fill={b.hasChamfer ? "white" : "#7c3aed"} style={{ userSelect: "none" }}>{b.hasChamfer ? "\u2713" : "\u25E3"}</text>
        </g>;
      })}

      {/* Compass */}
      <g transform={`translate(${svgW - 28}, 25)`}><line x1="0" y1="14" x2="0" y2="0" stroke="#444" strokeWidth="1.5" /><polygon points="-3.5,4 0,0 3.5,4" fill="#444" /><text x="0" y="-4" textAnchor="middle" style={{ fontSize: 7, fontWeight: 800, fill: "#444" }}>N</text></g>
    </svg>
  );
}

window.PlanView = PlanView;
