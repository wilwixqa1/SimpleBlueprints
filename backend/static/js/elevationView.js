// ============================================================
// ELEVATION SVG — 4-view grid (S/N/E/W)
// ============================================================

function ElevationView({ c, p }) {
  const { W, D, H, beamSize, postSize, nP, pp, fDiam, fDepth } = c;
  const hasSt = p.hasStairs && c.stairs;
  const st = hasSt ? c.stairs : null;
  const _pl = hasSt ? window.getStairPlacement(p, c) : { anchorX: 0, anchorY: 0, angle: 0 };
  const _exitSide = _pl.angle === 90 ? "right" : _pl.angle === 270 ? "left" : _pl.angle === 180 ? "back" : "front";

  function stairViewType(exitSide, viewDir) {
    const M = {
      "front,south":["treads",null],"right,south":["profile",1],"left,south":["profile",-1],"back,south":["hidden",null],
      "front,north":["hidden",null],"right,north":["profile",-1],"left,north":["profile",1],"back,north":["treads",null],
      "front,east":["profile",1],"right,east":["treads",null],"left,east":["hidden",null],"back,east":["profile",-1],
      "front,west":["profile",-1],"right,west":["hidden",null],"left,west":["treads",null],"back,west":["profile",1],
    };
    return M[exitSide+","+viewDir] || ["hidden",null];
  }

  function MiniElev({ viewDir, label, showWidth }) {
    const spanFt = showWidth ? W : D;
    const pad = 25; const sX = Math.min(14, 200 / Math.max(spanFt + 6, 14));
    const sY = Math.min(12, 100 / Math.max(H + 5, 8));
    const dSW = spanFt * sX; const svgW = dSW + pad * 2 + 40; const svgH = (H + 5) * sY + pad + 35;
    const gnd = pad + (H + 3) * sY; const dY = gnd - H * sY;
    const dX = pad; const rTop = dY - 2.5 * sY; const bH = 0.8 * sY;
    const isRear = viewDir === "north";
    const isSide = viewDir === "east" || viewDir === "west";

    const hW = showWidth ? Math.min(spanFt, 30) * sX : 10 * sX;
    const hX = showWidth ? dX + (dSW - hW) / 2 : (viewDir === "east" ? dX - hW - 2 : dX + dSW + 2);
    const hH = (H + 1 + 7) * sY; const hTop = gnd - hH; const roofPk = 3.5 * sY;

    const [svt, sdir] = hasSt ? stairViewType(_exitSide, viewDir) : ["hidden", null];
    const stEls = [];
    if (hasSt && svt !== "hidden") {
      const stW = st.width * sX;
      const risePerR = (gnd - dY) / st.nRisers;
      const treadPx = (st.tread / 12) * sX;
      if (svt === "treads") {
        let cx;
        if (showWidth) {
          const ax = isRear ? (W - _pl.anchorX) : _pl.anchorX;
          cx = dX + ax * sX;
        } else {
          const ay = viewDir === "west" ? (D - _pl.anchorY) : _pl.anchorY;
          cx = dX + ay * sX;
        }
        const sl = cx - stW/2, sr = cx + stW/2;
        stEls.push(<rect key="tb" x={sl} y={dY} width={stW} height={gnd-dY} fill="white" stroke="none" />);
        for (let i=0;i<=st.nRisers;i++) stEls.push(<line key={"tt"+i} x1={sl} y1={dY+i*risePerR} x2={sr} y2={dY+i*risePerR} stroke="#888" strokeWidth="0.4" />);
        stEls.push(<line key="tl" x1={sl} y1={dY} x2={sl} y2={gnd} stroke="#444" strokeWidth="0.7" />);
        stEls.push(<line key="tr" x1={sr} y1={dY} x2={sr} y2={gnd} stroke="#444" strokeWidth="0.7" />);
        stEls.push(<line key="tb2" x1={sl} y1={gnd} x2={sr} y2={gnd} stroke="#444" strokeWidth="0.5" />);
      } else if (svt === "profile") {
        let sx;
        if (showWidth) {
          const ax = isRear ? (W - _pl.anchorX) : _pl.anchorX;
          sx = dX + ax * sX;
        } else {
          const ay = viewDir === "west" ? (D - _pl.anchorY) : _pl.anchorY;
          sx = dX + ay * sX;
        }
        const dir = sdir;
        const pts = [];
        let rx = sx, ry = dY;
        pts.push(rx+","+ry);
        for (let i=0;i<st.nRisers;i++) {
          const ny = ry + risePerR;
          pts.push(rx+","+ny);
          if (i < st.nTreads) { rx += dir * treadPx; pts.push(rx+","+ny); }
          ry = ny;
        }
        stEls.push(<polyline key="prof" points={pts.join(" ")} fill="none" stroke="#444" strokeWidth="0.7" />);
        stEls.push(<line key="pdiag" x1={sx} y1={dY} x2={rx} y2={gnd} stroke="#888" strokeWidth="0.4" strokeDasharray="2,1.5" />);
      }
    }

    const postEls = [];
    if (showWidth) {
      const positions = isRear ? pp.map(px => W - px) : pp;
      const alpha = isRear ? 0.35 : 1;
      const dash = isRear ? "4,2" : "none";
      positions.forEach((px, i) => {
        const sx = dX + px * sX;
        postEls.push(<line key={"p"+i} x1={sx} y1={dY} x2={sx} y2={gnd-1} stroke="#c4a060" strokeWidth={postSize==="6x6"?2:1.5} strokeOpacity={alpha} strokeDasharray={dash} />);
        if (!isRear) {
          postEls.push(<rect key={"pf"+i} x={sx-3} y={gnd} width={6} height={2.5} fill="#c8c8c8" stroke="#444" strokeWidth="0.3" />);
        }
      });
    } else {
      const postX = viewDir === "west" ? dX + 1.5 * sX : dX + dSW - 1.5 * sX;
      postEls.push(<line key="sp" x1={postX} y1={dY} x2={postX} y2={gnd-1} stroke="#c4a060" strokeWidth={postSize==="6x6"?2:1.5} />);
      postEls.push(<rect key="spf" x={postX-3} y={gnd} width={6} height={2.5} fill="#c8c8c8" stroke="#444" strokeWidth="0.3" />);
    }

    return (
      <div style={{ flex: "1 1 48%", minWidth: 200 }}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "auto", background: "#fcfcfa", borderRadius: 4, border: "1px solid #ddd8cc" }}>
          {showWidth ? <>
            <rect x={hX} y={hTop} width={hW} height={hH} fill="#e8e6e0" stroke="#888" strokeWidth="0.5" />
            <polygon points={`${hX-2},${hTop} ${hX+hW/2},${hTop-roofPk} ${hX+hW+2},${hTop}`} fill="#888" stroke="#444" strokeWidth="0.8" />
            <text x={hX+hW/2} y={hTop-roofPk/3} textAnchor="middle" style={{ fontSize: 4, fill: "#aaa", fontFamily: "monospace" }}>HOUSE</text>
          </> : <>
            <rect x={hX} y={hTop} width={hW} height={hH} fill="#e8e6e0" stroke="#888" strokeWidth="0.5" />
            <polygon points={`${hX-1},${hTop} ${hX+hW/2},${hTop-roofPk} ${hX+hW+1},${hTop}`} fill="#888" stroke="#444" strokeWidth="0.8" />
            <text x={hX+hW/2} y={hTop-roofPk/3} textAnchor="middle" style={{ fontSize: 3.5, fill: "#aaa", fontFamily: "monospace" }}>HOUSE</text>
          </>}

          <line x1={pad-10} y1={gnd} x2={svgW-10} y2={gnd} stroke="#444" strokeWidth="0.7" />
          {Array.from({length:Math.ceil((svgW-20)/2.5)},(_,i)=><line key={i} x1={pad-10+i*2.5} y1={gnd} x2={pad-12+i*2.5} y2={gnd+1.5} stroke="#aaa" strokeWidth="0.2" />)}

          {postEls}

          {!isRear ? (
            p.beamType === "flush"
              ? <line x1={dX+1*sX} y1={dY} x2={dX+dSW-1*sX} y2={dY} stroke="#c4960a" strokeWidth="1" strokeDasharray="6,3" />
              : <rect x={dX+1*sX} y={dY+0.5} width={dSW-2*sX} height={bH*0.6} fill="#c4960a" fillOpacity="0.8" stroke="#444" strokeWidth="0.4" rx="0.3" />
          ) : (
            <rect x={dX+1*sX} y={dY+0.5} width={dSW-2*sX} height={bH*0.6} fill="#c4960a" fillOpacity="0.25" stroke="#444" strokeWidth="0.3" />
          )}

          {isRear && c.attachment === "ledger" && <>
            <line x1={dX} y1={dY} x2={dX+dSW} y2={dY} stroke="#2e7d32" strokeWidth="2" />
            <line x1={dX} y1={dY+bH*0.7} x2={dX+dSW} y2={dY+bH*0.7} stroke="#2e7d32" strokeWidth="1" strokeOpacity="0.5" />
            <text x={dX+dSW/2} y={dY+bH*0.4} textAnchor="middle" style={{ fontSize: 3.5, fill: "#2e7d32", fontFamily: "monospace", fontWeight: 700 }}>LEDGER</text>
          </>}
          {isSide && c.attachment === "ledger" && (() => {
            const lx = viewDir === "east" ? dX : dX + dSW;
            return <line x1={lx} y1={dY-bH*0.3} x2={lx} y2={dY+bH*0.5} stroke="#2e7d32" strokeWidth="2" />;
          })()}

          <line x1={dX} y1={dY} x2={dX+dSW} y2={dY} stroke="#6B5340" strokeWidth="1.8" />

          <line x1={dX} y1={rTop} x2={dX+dSW} y2={rTop} stroke="#333" strokeWidth={isRear ? 1 : 1.5} strokeOpacity={isRear ? 0.4 : 1} />
          <line x1={dX} y1={dY-1.5} x2={dX+dSW} y2={dY-1.5} stroke="#333" strokeWidth="0.5" strokeOpacity={isRear ? 0.3 : 0.8} />

          {stEls}

          <line x1={dX-8} y1={gnd} x2={dX-8} y2={dY} stroke="#1565c0" strokeWidth="0.4" />
          <line x1={dX-10} y1={gnd} x2={dX-6} y2={gnd} stroke="#1565c0" strokeWidth="0.4" />
          <line x1={dX-10} y1={dY} x2={dX-6} y2={dY} stroke="#1565c0" strokeWidth="0.4" />
          <text x={dX-12} y={(gnd+dY)/2+2} textAnchor="middle" transform={`rotate(-90,${dX-12},${(gnd+dY)/2})`} style={{ fontSize: 5.5, fill: "#1565c0", fontWeight: 700, fontFamily: "monospace" }}>{Math.floor(H)}'-{Math.round((H%1)*12)}"</text>

          <line x1={dX} y1={rTop-6} x2={dX+dSW} y2={rTop-6} stroke="#c62828" strokeWidth="0.4" />
          <line x1={dX} y1={rTop-8} x2={dX} y2={rTop-4} stroke="#c62828" strokeWidth="0.4" />
          <line x1={dX+dSW} y1={rTop-8} x2={dX+dSW} y2={rTop-4} stroke="#c62828" strokeWidth="0.4" />
          <text x={dX+dSW/2} y={rTop-9} textAnchor="middle" style={{ fontSize: 5.5, fill: "#c62828", fontWeight: 700, fontFamily: "monospace" }}>{spanFt}'-0"</text>

          <text x={svgW/2} y={svgH-4} textAnchor="middle" style={{ fontSize: 5, fill: "#555", fontFamily: "monospace", fontWeight: 800, letterSpacing: 0.8 }}>{label}</text>
        </svg>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      <MiniElev viewDir="south" label="SOUTH ELEVATION" showWidth={true} />
      <MiniElev viewDir="north" label="NORTH ELEVATION" showWidth={true} />
      <MiniElev viewDir="east" label="EAST ELEVATION" showWidth={false} />
      <MiniElev viewDir="west" label="WEST ELEVATION" showWidth={false} />
    </div>
  );
}

window.ElevationView = ElevationView;
