// ============================================================
// ELEVATION SVG — 4-view grid (S/N/E/W) with architectural labels,
// key plan inset, and smart view ordering for L-templates
// S24: Zone-aware South/North views — left/right zones extend width.
//      Each zone section drawn independently with own deckTop.
// ============================================================

// --- Zone elevation helper (mirrors backend _get_zone_south_north_sections) ---
function _getZoneSNContext(p, W, H) {
  const zones = p.zones || [];
  if (!zones.length) return { xOff: 0, bbW: W, sections: [] };

  let minX = 0, maxX = W;
  const sections = [];

  for (const z of zones) {
    if (z.type === 'cutout') continue;
    const edge = z.attachEdge;
    const zw = z.w || 8;
    if (edge === 'left') {
      minX = Math.min(minX, -zw);
      sections.push({ xDraw: -zw, w: zw, deckTop: H }); // future: z.height || H
    } else if (edge === 'right') {
      maxX = Math.max(maxX, W + zw);
      sections.push({ xDraw: W, w: zw, deckTop: H }); // future: z.height || H
    }
    // front zones: skip for now (only left/right affect S/N width)
  }

  const xOff = -minX;
  const bbW = maxX - minX;
  return { xOff, bbW, sections };
}

function ElevationView({ c, p }) {
  const { W, D, H, beamSize, postSize, nP, pp, fDiam, fDepth } = c;
  const hasSt = p.hasStairs && c.stairs;
  const st = hasSt ? c.stairs : null;
  const _pl = hasSt ? window.getStairPlacement(p, c) : { anchorX: 0, anchorY: 0, angle: 0 };
  const _exitSide = _pl.angle === 90 ? "right" : _pl.angle === 270 ? "left" : _pl.angle === 180 ? "back" : "front";

  // Architectural direction labels
  const archLabels = {
    south: "FRONT ELEVATION",
    north: "REAR ELEVATION",
    east: "RIGHT SIDE ELEVATION",
    west: "LEFT SIDE ELEVATION"
  };

  function stairViewType(exitSide, viewDir) {
    const M = {
      "front,south":["treads",null],"right,south":["profile",1],"left,south":["profile",-1],"back,south":["hidden",null],
      "front,north":["hidden",null],"right,north":["profile",-1],"left,north":["profile",1],"back,north":["treads",null],
      "front,east":["profile",1],"right,east":["treads",null],"left,east":["hidden",null],"back,east":["profile",-1],
      "front,west":["profile",-1],"right,west":["hidden",null],"left,west":["treads",null],"back,west":["profile",1],
    };
    return M[exitSide+","+viewDir] || ["hidden",null];
  }

  // Key plan inset — shows deck outline + arrow for viewing direction
  function KeyPlan({ viewDir, insetX, insetY, insetSize }) {
    const s = insetSize;
    const dw = s * 0.6, dd = s * 0.4;
    const dcx = insetX + (s - dw) / 2, dcy = insetY + (s - dd) / 2 + 2;
    const hw = dw * 0.7, hh = 6;
    const hcx = dcx + (dw - hw) / 2, hcy = dcy - hh;
    const arrowLen = s * 0.25;
    const arrowW = 3;
    let ax1, ay1, ax2, ay2;
    if (viewDir === "south") { ax1 = dcx + dw/2; ay1 = dcy + dd + 2; ax2 = ax1; ay2 = ay1 + arrowLen; }
    else if (viewDir === "north") { ax1 = dcx + dw/2; ay1 = dcy - 2; ax2 = ax1; ay2 = ay1 - arrowLen; }
    else if (viewDir === "east") { ax1 = dcx + dw + 2; ay1 = dcy + dd/2; ax2 = ax1 + arrowLen; ay2 = ay1; }
    else { ax1 = dcx - 2; ay1 = dcy + dd/2; ax2 = ax1 - arrowLen; ay2 = ay1; }

    let hlX1, hlY1, hlX2, hlY2;
    if (viewDir === "south") { hlX1 = dcx; hlY1 = dcy + dd; hlX2 = dcx + dw; hlY2 = dcy + dd; }
    else if (viewDir === "north") { hlX1 = dcx; hlY1 = dcy; hlX2 = dcx + dw; hlY2 = dcy; }
    else if (viewDir === "east") { hlX1 = dcx + dw; hlY1 = dcy; hlX2 = dcx + dw; hlY2 = dcy + dd; }
    else { hlX1 = dcx; hlY1 = dcy; hlX2 = dcx; hlY2 = dcy + dd; }

    return (
      <g opacity="0.5">
        <rect x={hcx} y={hcy} width={hw} height={hh} fill="#e8e6e0" stroke="#999" strokeWidth="0.3" />
        <text x={hcx + hw/2} y={hcy + hh/2 + 1.2} textAnchor="middle" style={{ fontSize: 2.5, fill: "#aaa", fontFamily: "monospace" }}>H</text>
        <rect x={dcx} y={dcy} width={dw} height={dd} fill="none" stroke="#666" strokeWidth="0.4" />
        <line x1={hlX1} y1={hlY1} x2={hlX2} y2={hlY2} stroke="#c62828" strokeWidth="1.2" />
        <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke="#c62828" strokeWidth="0.6" />
        {viewDir === "south" && <polygon points={`${ax2-arrowW/2},${ay2-2} ${ax2},${ay2} ${ax2+arrowW/2},${ay2-2}`} fill="#c62828" />}
        {viewDir === "north" && <polygon points={`${ax2-arrowW/2},${ay2+2} ${ax2},${ay2} ${ax2+arrowW/2},${ay2+2}`} fill="#c62828" />}
        {viewDir === "east" && <polygon points={`${ax2-2},${ay2-arrowW/2} ${ax2},${ay2} ${ax2-2},${ay2+arrowW/2}`} fill="#c62828" />}
        {viewDir === "west" && <polygon points={`${ax2+2},${ay2-arrowW/2} ${ax2},${ay2} ${ax2+2},${ay2+arrowW/2}`} fill="#c62828" />}
      </g>
    );
  }

  function MiniElev({ viewDir, showWidth }) {
    const label = archLabels[viewDir];
    const isRear = viewDir === "north";
    const isSide = viewDir === "east" || viewDir === "west";
    const isLedger = c.attachment === "ledger";

    // S24: Zone context for S/N views
    const zoneSN = showWidth ? _getZoneSNContext(p, W, H) : { xOff: 0, bbW: W, sections: [] };
    const spanFt = showWidth ? zoneSN.bbW : D;

    const pad = 25; const sX = Math.min(14, 200 / Math.max(spanFt + 6, 14));
    const sY = Math.min(12, 100 / Math.max(H + 5, 8));
    const dSW = spanFt * sX; const svgW = dSW + pad * 2 + 40; const svgH = (H + 5) * sY + pad + 45;
    const gnd = pad + (H + 3) * sY; const dY = gnd - H * sY;
    const dX = pad; const rTop = dY - 2.5 * sY; const bH = 0.8 * sY;

    // S24: Zone-0 drawing origin (shifted when left zones exist)
    const z0X = showWidth ? dX + zoneSN.xOff * sX : dX;
    const z0W = showWidth ? W * sX : dSW;

    const hW = showWidth ? Math.min(spanFt, 30) * sX : 10 * sX;
    // S24: House centers on zone-0, not bounding box
    const hX = showWidth ? z0X + (z0W - hW) / 2 : (viewDir === "east" ? dX - hW - 2 : dX + dSW + 2);
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
          cx = z0X + ax * sX; // S24: use z0X
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
          sx = z0X + ax * sX; // S24: use z0X
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

    // S24: Posts use z0X for S/N views
    const postEls = [];
    if (showWidth) {
      const positions = isRear ? pp.map(px => W - px) : pp;
      const alpha = isRear ? 0.35 : 1;
      const dash = isRear ? "4,2" : "none";
      positions.forEach((px, i) => {
        const sx = z0X + px * sX; // S24: use z0X
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

    // S24: Zone wing section elements for S/N views
    const zoneEls = [];
    if (showWidth && zoneSN.sections.length > 0) {
      zoneSN.sections.forEach((sec, zi) => {
        // Compute pixel position for this zone section
        let zSecX, zSecW;
        if (isRear) {
          // Mirror for north view
          const mirrorX = zoneSN.bbW - (sec.xDraw + zoneSN.xOff + sec.w);
          zSecX = dX + mirrorX * sX;
        } else {
          zSecX = dX + (sec.xDraw + zoneSN.xOff) * sX;
        }
        zSecW = sec.w * sX;
        const zDY = gnd - sec.deckTop * sY; // per-section deck top (future: height-per-zone)
        const zRTop = zDY - 2.5 * sY;
        const zAlpha = isRear ? 0.4 : 1;
        const zDash = isRear ? "4,2" : "none";
        const zBeamAlpha = isRear ? 0.25 : 0.8;
        const zRailAlpha = isRear ? 0.4 : 1;
        const zRailW = isRear ? 1 : 1.5;
        const prefix = "z" + zi + "_";

        // Posts (2 per zone section)
        [1.5, sec.w - 1.5].forEach((pOff, pi) => {
          const spx = zSecX + pOff * sX;
          zoneEls.push(<line key={prefix+"p"+pi} x1={spx} y1={zDY} x2={spx} y2={gnd-1} stroke="#c4a060" strokeWidth={postSize==="6x6"?2:1.5} strokeOpacity={zAlpha} strokeDasharray={zDash} />);
          if (!isRear) {
            zoneEls.push(<rect key={prefix+"pf"+pi} x={spx-3} y={gnd} width={6} height={2.5} fill="#c8c8c8" stroke="#444" strokeWidth="0.3" />);
          }
        });

        // Beam
        if (!isRear) {
          zoneEls.push(<rect key={prefix+"beam"} x={zSecX+0.5*sX} y={zDY+0.5} width={zSecW-1*sX} height={bH*0.6} fill="#c4960a" fillOpacity={zBeamAlpha} stroke="#444" strokeWidth="0.4" rx="0.3" />);
        } else {
          zoneEls.push(<rect key={prefix+"beam"} x={zSecX+0.5*sX} y={zDY+0.5} width={zSecW-1*sX} height={bH*0.6} fill="#c4960a" fillOpacity={0.25} stroke="#444" strokeWidth="0.3" />);
        }

        // Deck surface
        zoneEls.push(<line key={prefix+"deck"} x1={zSecX} y1={zDY} x2={zSecX+zSecW} y2={zDY} stroke="#6B5340" strokeWidth="1.8" />);

        // Railing
        zoneEls.push(<line key={prefix+"rtop"} x1={zSecX} y1={zRTop} x2={zSecX+zSecW} y2={zRTop} stroke="#333" strokeWidth={zRailW} strokeOpacity={zRailAlpha} />);
        zoneEls.push(<line key={prefix+"rbot"} x1={zSecX} y1={zDY-1.5} x2={zSecX+zSecW} y2={zDY-1.5} stroke="#333" strokeWidth="0.5" strokeOpacity={zRailAlpha * 0.8} />);
      });
    }

    // Key plan inset dimensions
    const kpSize = 28;
    const kpX = svgW - kpSize - 8;
    const kpY = 6;

    return (
      <div style={{ flex: "1 1 48%", minWidth: 200 }}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "auto", background: "#fcfcfa", borderRadius: 4, border: "1px solid #ddd8cc" }}>
          {/* Key plan inset */}
          <KeyPlan viewDir={viewDir} insetX={kpX} insetY={kpY} insetSize={kpSize} />

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

          {/* S24: Beam uses z0X/z0W for zone-0 */}
          {!isRear ? (
            p.beamType === "flush"
              ? <line x1={z0X+1*sX} y1={dY} x2={z0X+z0W-1*sX} y2={dY} stroke="#c4960a" strokeWidth="1" strokeDasharray="6,3" />
              : <rect x={z0X+1*sX} y={dY+0.5} width={z0W-2*sX} height={bH*0.6} fill="#c4960a" fillOpacity="0.8" stroke="#444" strokeWidth="0.4" rx="0.3" />
          ) : (
            <rect x={z0X+1*sX} y={dY+0.5} width={z0W-2*sX} height={bH*0.6} fill="#c4960a" fillOpacity="0.25" stroke="#444" strokeWidth="0.3" />
          )}

          {/* S24: Ledger uses z0X/z0W for zone-0 */}
          {isRear && isLedger && <>
            <line x1={z0X} y1={dY} x2={z0X+z0W} y2={dY} stroke="#2e7d32" strokeWidth="2" />
            <line x1={z0X} y1={dY+bH*0.7} x2={z0X+z0W} y2={dY+bH*0.7} stroke="#2e7d32" strokeWidth="1" strokeOpacity="0.5" />
            <text x={z0X+z0W/2} y={dY+bH*0.4} textAnchor="middle" style={{ fontSize: 3.5, fill: "#2e7d32", fontFamily: "monospace", fontWeight: 700 }}>LEDGER</text>
          </>}
          {isSide && isLedger && (() => {
            const lx = viewDir === "east" ? dX : dX + dSW;
            return <line x1={lx} y1={dY-bH*0.3} x2={lx} y2={dY+bH*0.5} stroke="#2e7d32" strokeWidth="2" />;
          })()}

          {/* S24: Deck surface uses z0X/z0W for zone-0 */}
          <line x1={z0X} y1={dY} x2={z0X+z0W} y2={dY} stroke="#6B5340" strokeWidth="1.8" />

          {/* S24: Railing uses z0X/z0W for zone-0 */}
          {!(isRear && isLedger) && <>
            <line x1={z0X} y1={rTop} x2={z0X+z0W} y2={rTop} stroke="#333" strokeWidth={isRear ? 1 : 1.5} strokeOpacity={isRear ? 0.4 : 1} />
            <line x1={z0X} y1={dY-1.5} x2={z0X+z0W} y2={dY-1.5} stroke="#333" strokeWidth="0.5" strokeOpacity={isRear ? 0.3 : 0.8} />
          </>}

          {/* S24: Zone wing sections */}
          {zoneEls}

          {stEls}

          {/* Height dimension — uses dX (bounding box left edge) */}
          <line x1={dX-8} y1={gnd} x2={dX-8} y2={dY} stroke="#1565c0" strokeWidth="0.4" />
          <line x1={dX-10} y1={gnd} x2={dX-6} y2={gnd} stroke="#1565c0" strokeWidth="0.4" />
          <line x1={dX-10} y1={dY} x2={dX-6} y2={dY} stroke="#1565c0" strokeWidth="0.4" />
          <text x={dX-12} y={(gnd+dY)/2+2} textAnchor="middle" transform={`rotate(-90,${dX-12},${(gnd+dY)/2})`} style={{ fontSize: 5.5, fill: "#1565c0", fontWeight: 700, fontFamily: "monospace" }}>{window.fmtFtIn(H)}</text>

          {/* Width dimension — uses dX/dSW (spans full bounding box) */}
          <line x1={dX} y1={rTop-6} x2={dX+dSW} y2={rTop-6} stroke="#c62828" strokeWidth="0.4" />
          <line x1={dX} y1={rTop-8} x2={dX} y2={rTop-4} stroke="#c62828" strokeWidth="0.4" />
          <line x1={dX+dSW} y1={rTop-8} x2={dX+dSW} y2={rTop-4} stroke="#c62828" strokeWidth="0.4" />
          <text x={dX+dSW/2} y={rTop-9} textAnchor="middle" style={{ fontSize: 5.5, fill: "#c62828", fontWeight: 700, fontFamily: "monospace" }}>{window.fmtFtIn(spanFt)}</text>

          {/* Architectural label + compass direction */}
          <text x={svgW/2} y={svgH-10} textAnchor="middle" style={{ fontSize: 5.5, fill: "#333", fontFamily: "monospace", fontWeight: 800, letterSpacing: 0.8 }}>{label}</text>
          <text x={svgW/2} y={svgH-3} textAnchor="middle" style={{ fontSize: 3.5, fill: "#999", fontFamily: "monospace", letterSpacing: 0.5 }}>({viewDir.toUpperCase()})</text>
        </svg>
      </div>
    );
  }

  // Smart view ordering: for L-templates, show relevant side view first
  const template = p.stairTemplate || "straight";
  let viewOrder;
  if (template === "lLeft") {
    viewOrder = [
      { dir: "west", showWidth: false },
      { dir: "south", showWidth: true },
      { dir: "east", showWidth: false },
      { dir: "north", showWidth: true },
    ];
  } else if (template === "lRight") {
    viewOrder = [
      { dir: "east", showWidth: false },
      { dir: "south", showWidth: true },
      { dir: "west", showWidth: false },
      { dir: "north", showWidth: true },
    ];
  } else {
    viewOrder = [
      { dir: "south", showWidth: true },
      { dir: "north", showWidth: true },
      { dir: "east", showWidth: false },
      { dir: "west", showWidth: false },
    ];
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {viewOrder.map(v => (
        <MiniElev key={v.dir} viewDir={v.dir} showWidth={v.showWidth} />
      ))}
    </div>
  );
}

window.ElevationView = ElevationView;
