// ============================================================
// PLAN VIEW SVG
// ============================================================
const { useState: _pvUS, useRef: _pvUR } = React;

function PlanView({ p, c, mode, u }) {
  const pad = 45; const sc = Math.min(420 / Math.max(c.W, 16), 18);
  const hw = p.houseWidth * sc;
  const sw = c.W * sc; const sd = c.D * sc; const bY = sd - 1.5 * sc;
  const svgW = Math.max(sw + pad * 2 + 40, hw + pad * 2 + 40); const svgH = sd + pad * 2 + 80;
  const houseCx = svgW / 2;
  const hx = houseCx - hw / 2;
  const deckOff = (p.deckOffset || 0) * sc;
  const dx = houseCx - sw / 2 + deckOff;
  const jLines = []; if (mode === "framing") { const s = c.sp / 12 * sc; for (let x = s; x < sw - 1; x += s) jLines.push(x); }

  const dragRef = _pvUR(null);
  const svgRef = _pvUR(null);
  const [stairSelected, setStairSelected] = _pvUS(false);
  const [rotPreview, setRotPreview] = _pvUS(null);
  const rotAngleRef = _pvUR(null);
  const stairGroupRef = _pvUR(null);

  const onPointerDown = (e, type) => {
    e.preventDefault(); e.stopPropagation();
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgScale = svgW / rect.width;
    dragRef.current = { type, startX: e.clientX, startY: e.clientY, svgScale,
      startVal: type === "deck" ? (p.deckOffset || 0) : (p.stairOffset || 0) };

    const onMove = (ev) => {
      if (!dragRef.current) return;
      const loc = _exitSide;
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
        const maxStairOff = loc === "front" ? (c.W - (p.stairWidth || 4)) / 2 :
                            (c.D - (p.stairWidth || 4)) / 2;
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
      const deltaXft = deltaXpx / sc;
      const deltaYft = deltaYpx / sc;
      let newAX = dragRef.current.startAnchorX + deltaXft;
      let newAY = dragRef.current.startAnchorY + deltaYft;
      newAX = Math.max(-0.5, Math.min(c.W + 0.5, newAX));
      newAY = Math.max(-0.5, Math.min(c.D + 0.5, newAY));
      const snap = window.snapStairToEdge(newAX, newAY, c.W, c.D, 1.0);
      const finalAX = Math.round(snap.anchorX * 2) / 2;
      const finalAY = Math.round(snap.anchorY * 2) / 2;
      const finalAngle = snap.snapped ? snap.angle : (dragRef.current.startAngle || 0);
      u("stairAnchorX", finalAX);
      u("stairAnchorY", finalAY);
      u("stairAngle", finalAngle);
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
      if (incr > 180) incr -= 360;
      if (incr < -180) incr += 360;
      cumRotation += incr;
      prevMouseDeg = curDeg;
      grp.setAttribute("transform", "rotate(" + cumRotation + " " + pivX + " " + pivY + ")");
      rotAngleRef.current = ((dragRef.current.startAngle + cumRotation) % 360 + 360) % 360;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const dr = dragRef.current;
      if (dr && dr.type === "rotate") {
        const raw = rotAngleRef.current != null ? rotAngleRef.current : dr.startAngle;
        const snaps = [0, 90, 180, 270];
        let best = 0, bestDist = 999;
        for (const s of snaps) { let d = Math.abs(raw - s); if (d > 180) d = 360 - d; if (d < bestDist) { bestDist = d; best = s; } }
        let snapDelta = best - raw;
        if (snapDelta > 180) snapDelta -= 360;
        if (snapDelta < -180) snapDelta += 360;
        const targetCum = cumRotation + snapDelta;
        const startCum = cumRotation;
        const duration = 150;
        const t0 = performance.now();
        const animate = (now) => {
          const elapsed = now - t0;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const cur = startCum + (targetCum - startCum) * eased;
          grp.setAttribute("transform", "rotate(" + cur + " " + pivX + " " + pivY + ")");
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            grp.removeAttribute("transform");
            u("stairAnchorX", dr.anchorX);
            u("stairAnchorY", dr.anchorY);
            u("stairAngle", best);
          }
        };
        requestAnimationFrame(animate);
      } else {
        grp.removeAttribute("transform");
      }
      rotAngleRef.current = null;
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const stairOffPx = (p.stairOffset || 0) * sc;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "auto" }}
      onClick={() => setStairSelected(false)}>
      <defs><filter id="rotShadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.15" /></filter></defs>
      {/* House */}
      <rect x={hx} y={pad - 50} width={hw} height={50} fill="#e8e6e0" stroke="#444" strokeWidth="1.2" rx="1" />
      <text x={houseCx} y={pad - 25} textAnchor="middle" style={{ fontSize: 8, fill: "#999", fontFamily: "monospace", fontWeight: 600, letterSpacing: "1px" }}>EXISTING HOUSE</text>

      {/* Deck */}
      <rect x={dx} y={pad} width={sw} height={sd} fill={mode === "framing" ? "#fcfaf5" : "#efe5d5"} stroke="#333" strokeWidth="2" rx="1" />

      {/* Deck drag handle */}
      {u && mode === "plan" && <g style={{ cursor: "ew-resize" }} onPointerDown={e => onPointerDown(e, "deck")}>
        <rect x={dx + sw / 2 - 15} y={pad - 3} width={30} height={6} rx={3} fill="#3d5a2e" opacity="0.7" />
        <text x={dx + sw / 2} y={pad + 1} textAnchor="middle" style={{ fontSize: 4, fill: "#fff", fontFamily: "monospace", fontWeight: 700, pointerEvents: "none" }}>◄ DRAG ►</text>
      </g>}

      {mode === "plan" && Array.from({ length: Math.ceil(sd / (5.5 / 12 * sc)) }, (_, i) => i * 5.5 / 12 * sc).filter(y => y <= sd).map((y, i) => (
        <line key={i} x1={dx} y1={pad + y} x2={dx + sw} y2={pad + y} stroke="#c9ad7a" strokeWidth="0.3" />
      ))}
      {c.attachment === "ledger" && <><line x1={dx} y1={pad} x2={dx + sw} y2={pad} stroke="#2e7d32" strokeWidth="3.5" />
        <text x={dx + sw / 2} y={pad - 5} textAnchor="middle" style={{ fontSize: 5, fill: "#2e7d32", fontWeight: 700, fontFamily: "monospace" }}>LEDGER</text></>}
      {mode === "framing" && <>
        {jLines.map((x, i) => <line key={i} x1={dx + x} y1={pad + 1} x2={dx + x} y2={pad + bY} stroke="#bbb" strokeWidth="0.4" />)}
        <line x1={dx + 1 * sc} y1={pad + bY} x2={dx + sw - 1 * sc} y2={pad + bY} stroke="#c4960a" strokeWidth="4" strokeLinecap="round" />
        <text x={dx + sw / 2} y={pad + bY - 6} textAnchor="middle" style={{ fontSize: 5.5, fill: "#9a7a00", fontWeight: 700, fontFamily: "monospace" }}>{c.beamSize.toUpperCase()}</text>
        <text x={dx + sw / 2} y={pad + sd / 2 - 4} textAnchor="middle" style={{ fontSize: 7, fill: "#888", fontFamily: "monospace" }}>{c.joistSize} @ {c.sp}" O.C.</text>
        {c.pp.map((px, i) => <g key={i}><circle cx={dx + px * sc} cy={pad + bY} r={4.5} fill="#c4a060" stroke="#444" strokeWidth="1" /><circle cx={dx + px * sc} cy={pad + bY} r={9} fill="none" stroke="#444" strokeWidth="0.4" strokeDasharray="2,2" /></g>)}
      </>}
      {mode === "plan" && <text x={dx + sw / 2} y={pad + sd / 2 + 3} textAnchor="middle" style={{ fontSize: 10, fill: "#666", fontFamily: "monospace", fontWeight: 700 }}>{c.area} S.F.</text>}
      {[[dx, pad, dx, pad + sd], [dx, pad + sd, dx + sw, pad + sd], [dx + sw, pad, dx + sw, pad + sd]].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#444" strokeWidth="3.5" />
      ))}

      {/* Multi-segment stairs */}
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
        els.push(<text key="stlbl" x={labelPt[0]} y={labelPt[1]} textAnchor="middle" style={{ fontSize: 5.5, fill: "#7a8068", fontFamily: "monospace", fontWeight: 600 }}>{names[stairGeom.template]} · {stairGeom.totalRisers} risers · {stairGeom.stairWidth}' wide · {stairGeom.runs.length} run{stairGeom.runs.length>1?"s":""}</text>);
        if (u && mode === "plan") {
          const bb = stairGeom.bbox;
          const bbRect = txRect({ x: bb.minX - 0.5, y: bb.minY - 0.5, w: bb.w + 1, h: bb.h + 1 });
          const hcx = bbRect.x + bbRect.w / 2;
          const hcy = bbRect.y + bbRect.h / 2;

          els.push(<rect key="dragZone" x={bbRect.x - 3} y={bbRect.y - 3} width={bbRect.w + 6} height={bbRect.h + 6}
            fill="transparent" stroke={stairSelected ? "#3d5a2e" : "none"}
            strokeWidth={stairSelected ? "1.2" : "0"} strokeDasharray={stairSelected ? "3,2" : "none"}
            rx="2" style={{ cursor: "move" }}
            onPointerDown={e => {
              e.stopPropagation();
              setStairSelected(true);
              onStairDragStart(e);
            }}
            onClick={e => e.stopPropagation()} />);

          if (stairSelected) {
            const curAngle = placement.angle;
            const dirLabels = { 0: "Front", 90: "Right", 180: "Back", 270: "Left" };
            const rHx = hcx;
            const stemLen = 10;
            const rHy = bbRect.y - stemLen - 7;
            const hr = 7;
            els.push(<line key="rotStem" x1={hcx} y1={bbRect.y - 1}
              x2={rHx} y2={rHy + hr} stroke="#bbb" strokeWidth="0.7" style={{ pointerEvents: "none" }} />);
            els.push(<g key="rotHandle" style={{ cursor: "grab" }}
              onPointerDown={e => { e.stopPropagation(); onRotateDragStart(e, hcx, hcy); }}>
              <circle cx={rHx} cy={rHy} r={hr} fill="white" stroke="#3d5a2e" strokeWidth="1.5"
                filter="url(#rotShadow)" />
              <path d={"M " + (rHx - 3) + " " + (rHy + 1) +
                " A 3.5 3.5 0 1 1 " + (rHx + 1) + " " + (rHy - 3)}
                fill="none" stroke="#3d5a2e" strokeWidth="1.5" strokeLinecap="round" />
              <polygon points={(rHx + 1) + "," + (rHy - 5) + " " + (rHx + 3.2) + "," + (rHy - 2.2) + " " + (rHx - 1) + "," + (rHy - 2.2)}
                fill="#3d5a2e" />
            </g>);
            els.push(<text key="rotDir" x={rHx} y={rHy - hr - 2} textAnchor="middle"
              style={{ fontSize: 4.5, fill: "#666", fontFamily: "monospace", fontWeight: 600, pointerEvents: "none" }}>{dirLabels[curAngle] || ""}</text>);
          }
        }
        return <g ref={stairGroupRef}>{els}</g>;
      })()}

      <line x1={pad} y1={pad + sd + 25} x2={pad + sw} y2={pad + sd + 25} stroke="#c62828" strokeWidth="0.6" />
      <line x1={pad} y1={pad + sd + 22} x2={pad} y2={pad + sd + 28} stroke="#c62828" strokeWidth="0.6" />
      <line x1={pad + sw} y1={pad + sd + 22} x2={pad + sw} y2={pad + sd + 28} stroke="#c62828" strokeWidth="0.6" />
      <text x={pad + sw / 2} y={pad + sd + 37} textAnchor="middle" style={{ fontSize: 9, fill: "#c62828", fontWeight: 800, fontFamily: "'DM Mono', monospace" }}>{c.W}'-0"</text>
      <line x1={pad + sw + 20} y1={pad} x2={pad + sw + 20} y2={pad + sd} stroke="#1565c0" strokeWidth="0.6" />
      <line x1={pad + sw + 17} y1={pad} x2={pad + sw + 23} y2={pad} stroke="#1565c0" strokeWidth="0.6" />
      <line x1={pad + sw + 17} y1={pad + sd} x2={pad + sw + 23} y2={pad + sd} stroke="#1565c0" strokeWidth="0.6" />
      <text x={pad + sw + 32} y={pad + sd / 2 + 3} textAnchor="middle" style={{ fontSize: 9, fill: "#1565c0", fontWeight: 800, fontFamily: "'DM Mono', monospace" }} transform={`rotate(90, ${pad + sw + 32}, ${pad + sd / 2})`}>{c.D}'-0"</text>
      <g transform={`translate(${svgW - 28}, 25)`}><line x1="0" y1="14" x2="0" y2="0" stroke="#444" strokeWidth="1.5" /><polygon points="-3.5,4 0,0 3.5,4" fill="#444" /><text x="0" y="-4" textAnchor="middle" style={{ fontSize: 7, fontWeight: 800, fill: "#444" }}>N</text></g>
    </svg>
  );
}

window.PlanView = PlanView;
