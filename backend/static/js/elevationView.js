// ============================================================
// ELEVATION SVG - 4-view grid (S/N/E/W) with architectural labels,
// key plan inset, and smart view ordering for L-templates
// S24: Zone-aware South/North views - left/right zones extend width.
//      Each zone section drawn independently with own deckTop.
// S35: Variable post heights from c.postHeights, underground footing
//      dotted lines, Simpson hardware callout labels.
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

  // S35: Post heights array (falls back to uniform H)
  const postHeights = c.postHeights || [];

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

  // Key plan inset - shows deck outline + arrow for viewing direction
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
    const dX = pad; const rTop = dY - ((c.guardHeight || 36) / 12) * sY; const bH = 0.8 * sY;

    // S33: Grade slope computation
    var slopePct = (p.slopePercent || 0) / 100;
    var slopeDir = p.slopeDirection || "front-to-back";
    var gradeSign = 0; // +1 = left side higher, -1 = right side higher
    if (showWidth) {
      if (slopeDir === "left-to-right") gradeSign = isRear ? -1 : 1;
      else if (slopeDir === "right-to-left") gradeSign = isRear ? 1 : -1;
    } else {
      if (slopeDir === "front-to-back") gradeSign = viewDir === "west" ? -1 : 1;
      else if (slopeDir === "back-to-front") gradeSign = viewDir === "west" ? 1 : -1;
    }
    var halfRisePx = gradeSign * slopePct * spanFt * sY / 2;
    var gradeLY = gnd - halfRisePx;
    var gradeRY = gnd + halfRisePx;
    var gradeLineX1 = pad - 10, gradeLineX2 = svgW - 10;
    function gradeYatX(gx) { return gradeLY + (gradeRY - gradeLY) * ((gx - gradeLineX1) / (gradeLineX2 - gradeLineX1)); }

    // S24: Zone-0 drawing origin (shifted when left zones exist)
    const z0X = showWidth ? dX + zoneSN.xOff * sX : dX;
    const z0W = showWidth ? W * sX : dSW;

    const hW = showWidth ? Math.min(spanFt, 30) * sX : 10 * sX;
    // S24: House centers on zone-0, not bounding box
    const hX = showWidth ? z0X + (z0W - hW) / 2 : (viewDir === "east" ? dX - hW - 2 : dX + dSW + 2);
    const hH = (H + 1 + 7) * sY; const hTop = gnd - hH; const roofPk = 3.5 * sY;

    // S39: Grade segments that skip house footprint (prevents earth fill bleeding through house)
    var houseL = hX, houseR = hX + hW;
    var gradeSegments = [];
    if (gradeLineX1 < houseL) gradeSegments.push([gradeLineX1, Math.min(houseL, gradeLineX2)]);
    if (houseR < gradeLineX2) gradeSegments.push([Math.max(houseR, gradeLineX1), gradeLineX2]);
    if (gradeSegments.length === 0) gradeSegments.push([gradeLineX1, gradeLineX2]);

    // S39: House foundation bottom follows grade (trapezoid, not flat rect)
    // In SVG Y-down: larger Y = visually lower. Math.max picks the lower point.
    var gradeAtHL = gradeYatX(houseL);
    var gradeAtHR = gradeYatX(houseR);
    var minFoundPx = 1.0 * sY; // minimum 1 foot visible foundation
    var foundBottomL = Math.max(gnd + minFoundPx, gradeAtHL);
    var foundBottomR = Math.max(gnd + minFoundPx, gradeAtHR);
    // First floor level: where siding starts, basement/crawlspace below
    var firstFloorY = gnd - (H + 1) * sY;

    // S65: Multi-stair elevation rendering
    const stEls = [];
    var _allStairs = p.deckStairs || [];
    if (!_allStairs.length && hasSt) {
      // Backward compat: build single stair from flat params
      _allStairs = [{ id: 0, zoneId: 0, location: p.stairLocation || "front", width: st.width || 4, numStringers: p.numStringers || 3, offset: p.stairOffset || 0, anchorX: null, anchorY: null, angle: null }];
    }
    var _nRisers = H > 0.5 ? Math.ceil(H * 12 / 7.5) : 0;
    var _nTreads = Math.max(_nRisers - 1, 1);
    var _treadIn = 10.5;
    _allStairs.forEach(function(_s, _si) {
      // Get zone rect
      var _zoneId = _s.zoneId || 0;
      var _zr;
      if (_zoneId === 0) {
        _zr = { x: 0, y: 0, w: W, d: D };
      } else if (window.getZoneRect) {
        var _zn = (p.zones || []).find(function(z) { return z.id === _zoneId; });
        _zr = _zn ? window.getZoneRect(_zn, W, D) : null;
      }
      if (!_zr || _nRisers === 0) return;

      // Get placement in zone-local coords
      var _placement = window.getStairPlacementForZone ? window.getStairPlacementForZone(_s, _zr) : null;
      if (!_placement) return;

      // World-space anchor
      var _wax = _zr.x + _placement.anchorX;
      var _way = _zr.y + _placement.anchorY;
      var _angle = _placement.angle;
      var _exitSideS = _angle === 90 ? "right" : _angle === 270 ? "left" : _angle === 180 ? "back" : "front";

      // For side views, only render zone-0 stairs
      if (!showWidth && _zoneId !== 0) return;

      var [_svt, _sdir] = stairViewType(_exitSideS, viewDir);
      if (_svt === "hidden") return;

      var _sw = (_s.width || 4) * sX;
      var _risePerR = (gnd - dY) / _nRisers;
      var _treadPx = (_treadIn / 12) * sX;

      if (_svt === "treads") {
        var _cx;
        if (showWidth) {
          var _ax = isRear ? (zoneSN.bbW - zoneSN.xOff - _wax) : (zoneSN.xOff + _wax);
          _cx = dX + _ax * sX;
        } else {
          var _ay = viewDir === "west" ? (D - _way) : _way;
          _cx = dX + _ay * sX;
        }
        var _sl = _cx - _sw/2, _sr = _cx + _sw/2;
        stEls.push(<rect key={"stb"+_si} x={_sl} y={dY} width={_sw} height={gnd-dY} fill="white" stroke="none" />);
        for (var _i=0;_i<=_nRisers;_i++) stEls.push(<line key={"stt"+_si+"_"+_i} x1={_sl} y1={dY+_i*_risePerR} x2={_sr} y2={dY+_i*_risePerR} stroke="#888" strokeWidth="0.4" />);
        stEls.push(<line key={"stl"+_si} x1={_sl} y1={dY} x2={_sl} y2={gnd} stroke="#444" strokeWidth="0.7" />);
        stEls.push(<line key={"str"+_si} x1={_sr} y1={dY} x2={_sr} y2={gnd} stroke="#444" strokeWidth="0.7" />);
        stEls.push(<line key={"stb2"+_si} x1={_sl} y1={gnd} x2={_sr} y2={gnd} stroke="#444" strokeWidth="0.5" />);
      } else if (_svt === "profile") {
        var _sx;
        if (showWidth) {
          var _ax2 = isRear ? (zoneSN.bbW - zoneSN.xOff - _wax) : (zoneSN.xOff + _wax);
          _sx = dX + _ax2 * sX;
        } else {
          var _ay2 = viewDir === "west" ? (D - _way) : _way;
          _sx = dX + _ay2 * sX;
        }
        var _dir = _sdir;
        var _pts = [];
        var _rx = _sx, _ry = dY;
        _pts.push(_rx+","+_ry);
        for (var _j=0;_j<_nRisers;_j++) {
          var _ny = _ry + _risePerR;
          _pts.push(_rx+","+_ny);
          if (_j < _nTreads) { _rx += _dir * _treadPx; _pts.push(_rx+","+_ny); }
          _ry = _ny;
        }
        stEls.push(<polyline key={"sprof"+_si} points={_pts.join(" ")} fill="none" stroke="#444" strokeWidth="0.7" />);
        stEls.push(<line key={"spdiag"+_si} x1={_sx} y1={dY} x2={_rx} y2={gnd} stroke="#888" strokeWidth="0.4" strokeDasharray="2,1.5" />);
      }
    });

    // S35: Underground footing helper (draws dotted pier below post)
    var footingDepthPx = (fDepth / 12) * sY; // fDepth is in inches
    var footingRadPx = (fDiam / 12 / 2) * sX;
    function drawUndergroundFooting(postX, postGndY) {
      var pierBottom = postGndY + footingDepthPx;
      var r = Math.max(footingRadPx * 0.6, 1.5);
      return <g key={"uf"+postX}>
        <line x1={postX - r} y1={postGndY + 2} x2={postX - r} y2={pierBottom} stroke="#999" strokeWidth="0.3" strokeDasharray="2,1.5" />
        <line x1={postX + r} y1={postGndY + 2} x2={postX + r} y2={pierBottom} stroke="#999" strokeWidth="0.3" strokeDasharray="2,1.5" />
        <line x1={postX - r - 1} y1={pierBottom} x2={postX + r + 1} y2={pierBottom} stroke="#999" strokeWidth="0.4" strokeDasharray="2,1.5" />
      </g>;
    }

    // S35: Posts with variable heights from postHeights array
    const postEls = [];
    if (showWidth) {
      const positions = isRear ? pp.map(function(px) { return W - px; }) : pp;
      const alpha = isRear ? 0.35 : 1;
      const dash = isRear ? "4,2" : "none";
      positions.forEach(function(px, i) {
        var sx = z0X + px * sX; // S24: use z0X
        // S35: Use per-post height from postHeights array
        var ph = postHeights[i] !== undefined ? postHeights[i] : H;
        var postGndY = dY + (H - ph) * sY; // ground level at this post in pixels
        // Only show variable ground when slope is active
        var effectiveGndY = slopePct > 0 ? postGndY : gnd - 1;
        postEls.push(<line key={"p"+i} x1={sx} y1={dY} x2={sx} y2={effectiveGndY} stroke="#c4a060" strokeWidth={postSize==="6x6"?2:1.5} strokeOpacity={alpha} strokeDasharray={dash} />);
        if (!isRear) {
          var footingY = slopePct > 0 ? postGndY : gnd;
          postEls.push(<rect key={"pf"+i} x={sx-3} y={footingY} width={6} height={2.5} fill="#c8c8c8" stroke="#444" strokeWidth="0.3" />);
          // S35: Underground footing dotted lines
          postEls.push(drawUndergroundFooting(sx, footingY + 2.5));
        }
      });
    } else {
      // S35: Side view uses first (west) or last (east) post height
      var sideIdx = viewDir === "west" ? 0 : (postHeights.length - 1);
      var sidePh = postHeights[sideIdx] !== undefined ? postHeights[sideIdx] : H;
      var sideGndY = slopePct > 0 ? (dY + (H - sidePh) * sY) : (gnd - 1);
      var sideFootingY = slopePct > 0 ? sideGndY : gnd;
      var postX = viewDir === "west" ? dX + 1.5 * sX : dX + dSW - 1.5 * sX;
      postEls.push(<line key="sp" x1={postX} y1={dY} x2={postX} y2={sideGndY} stroke="#c4a060" strokeWidth={postSize==="6x6"?2:1.5} />);
      postEls.push(<rect key="spf" x={postX-3} y={sideFootingY} width={6} height={2.5} fill="#c8c8c8" stroke="#444" strokeWidth="0.3" />);
      // S35: Underground footing
      postEls.push(drawUndergroundFooting(postX, sideFootingY + 2.5));
    }

    // S24: Zone wing section elements for S/N views
    const zoneEls = [];
    if (showWidth && zoneSN.sections.length > 0) {
      zoneSN.sections.forEach(function(sec, zi) {
        // Compute pixel position for this zone section
        var zSecX, zSecW;
        if (isRear) {
          // Mirror for north view
          var mirrorX = zoneSN.bbW - (sec.xDraw + zoneSN.xOff + sec.w);
          zSecX = dX + mirrorX * sX;
        } else {
          zSecX = dX + (sec.xDraw + zoneSN.xOff) * sX;
        }
        zSecW = sec.w * sX;
        var zDY = gnd - sec.deckTop * sY; // per-section deck top (future: height-per-zone)
        var zRTop = zDY - ((c.guardHeight || 36) / 12) * sY;
        var zAlpha = isRear ? 0.4 : 1;
        var zDash = isRear ? "4,2" : "none";
        var zBeamAlpha = isRear ? 0.25 : 0.8;
        var zRailAlpha = isRear ? 0.4 : 1;
        var zRailW = isRear ? 1 : 1.5;
        var prefix = "z" + zi + "_";

        // Posts: guard against narrow zones (<3 ft) where edge offsets would overlap
        (sec.w < 3 ? [sec.w / 2] : [1.5, sec.w - 1.5]).forEach(function(pOff, pi) {
          var spx = zSecX + pOff * sX;
          zoneEls.push(<line key={prefix+"p"+pi} x1={spx} y1={zDY} x2={spx} y2={gnd-1} stroke="#c4a060" strokeWidth={postSize==="6x6"?2:1.5} strokeOpacity={zAlpha} strokeDasharray={zDash} />);
          if (!isRear) {
            zoneEls.push(<rect key={prefix+"pf"+pi} x={spx-3} y={gnd} width={6} height={2.5} fill="#c8c8c8" stroke="#444" strokeWidth="0.3" />);
          }
        });

        // Beam
        if (!isRear) {
          zoneEls.push(<rect key={prefix+"beam"} x={zSecX+0.5*sX} y={zDY+0.5} width={zSecW-1*sX} height={bH*0.6} fill="#c4960a" fillOpacity={zBeamAlpha} stroke="#444" strokeWidth="0.4" rx="0.3" />);
        } else {
          zoneEls.push(<rect key={prefix+"beam"} x={zSecX+0.5*sX} y={zDY+0.5} width={zSecW-1*sX} height={bH*0.6} fill="#c4960a" fillOpacity="0.25" stroke="#444" strokeWidth="0.3" />);
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

    // S35: Hardware callout labels
    var hwEls = [];
    if (!isSide && !isRear) {
      // South view: show ABU66Z at first post, beam connector type
      var firstPx = z0X + (pp[0] || 1.5) * sX;
      hwEls.push(<text key="hw1" x={firstPx - 8} y={gnd + 8} textAnchor="end" style={{fontSize:3,fill:"#666",fontFamily:"monospace"}}>ABU66Z</text>);
      hwEls.push(<line key="hw1l" x1={firstPx - 7} y1={gnd + 7} x2={firstPx - 1} y2={gnd + 1} stroke="#999" strokeWidth="0.3" />);
      // Beam connector
      var beamLabel = p.beamType === "flush" ? "LUS210 (TYP)" : "H2.5A (TYP)";
      var bmLblX = z0X + z0W * 0.35;
      hwEls.push(<text key="hw2" x={bmLblX + 12} y={dY + bH + 5} textAnchor="start" style={{fontSize:3,fill:"#666",fontFamily:"monospace"}}>{beamLabel}</text>);
      hwEls.push(<line key="hw2l" x1={bmLblX + 11} y1={dY + bH + 4} x2={bmLblX + 2} y2={dY + bH * 0.5 + 1} stroke="#999" strokeWidth="0.3" />);
    }

    return (
      <div style={{ flex: "1 1 48%", minWidth: 200 }}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "auto", background: "#fcfcfa", borderRadius: 4, border: "1px solid #ddd8cc" }}>
          {/* S39: Brick/masonry hatch pattern (matches permit plan conventions) */}
          <defs>
            <pattern id="brickH" width={6} height={4} patternUnits="userSpaceOnUse">
              <rect width={6} height={4} fill="#e8e0d4" />
              <line x1={0} y1={2} x2={6} y2={2} stroke="#c0b8a8" strokeWidth="0.3" />
              <line x1={3} y1={0} x2={3} y2={2} stroke="#c0b8a8" strokeWidth="0.3" />
              <line x1={0} y1={2} x2={0} y2={4} stroke="#c0b8a8" strokeWidth="0.3" />
              <line x1={6} y1={2} x2={6} y2={4} stroke="#c0b8a8" strokeWidth="0.3" />
            </pattern>
          </defs>

          {/* === LAYER 1: Earth fill (BEHIND everything) === */}
          {(() => { var btm = Math.max(gradeLY, gradeRY) + 16; return <g>
            {gradeSegments.map(function(seg, si) {
              var sx1 = seg[0], sx2 = seg[1];
              var sy1 = gradeYatX(sx1), sy2 = gradeYatX(sx2);
              var pts = sx1+","+sy1+" "+sx2+","+sy2+" "+sx2+","+btm+" "+sx1+","+btm;
              return <polygon key={"ef"+si} points={pts} fill="url(#brickH)" />;
            })}
          </g>; })()}

          {/* === LAYER 2: Grade line + ticks (on top of earth) === */}
          {gradeSegments.map(function(seg, si) {
            return <line key={"gl"+si} x1={seg[0]} y1={gradeYatX(seg[0])} x2={seg[1]} y2={gradeYatX(seg[1])} stroke="#444" strokeWidth="0.8" />;
          })}
          {Array.from({length:Math.ceil((svgW-20)/2.5)},function(_,i){var hx=pad-10+i*2.5;if(hx>=houseL&&hx<=houseR)return null;var gy=gradeYatX(hx);return <line key={i} x1={hx} y1={gy} x2={hx-2} y2={gy+1.5} stroke="#888" strokeWidth="0.25" />;})}
          {slopePct > 0 && gradeSign !== 0 ? <text x={gradeLineX2-5} y={gradeRY-3} textAnchor="end" style={{fontSize:4,fill:"#666",fontFamily:"monospace",fontWeight:600}}>APPROX. {(slopePct*100).toFixed(1)}% GRADE</text> : <text x={gradeLineX2-5} y={gradeRY-3} textAnchor="end" style={{fontSize:3.5,fill:"#999",fontFamily:"monospace",fontStyle:"italic"}}>APPROX. GRADE</text>}

          {/* === LAYER 3: House (ON TOP of earth, foundation polygon follows grade) === */}
          {(() => {
            var els = [];
            var overhang = showWidth ? 2 : 1.5;
            var sidingH = firstFloorY - hTop; // always 7*sY = 7 feet of wall

            // 3a. Foundation polygon: trapezoid from gnd down to grade on each side
            var fPts = hX+","+gnd+" "+(hX+hW)+","+gnd+" "+(hX+hW)+","+foundBottomR+" "+hX+","+foundBottomL;
            els.push(<polygon key="hfound" points={fPts} fill="#c8c8c8" stroke="#888" strokeWidth="0.5" />);
            var fMaxBtm = Math.max(foundBottomL, foundBottomR);
            for (var fy = gnd + 2; fy < fMaxBtm - 0.5; fy += 2) {
              els.push(<line key={"hfl"+Math.round(fy*10)} x1={hX+0.3} y1={fy} x2={hX+hW-0.3} y2={fy} stroke="#aaa" strokeWidth="0.15" />);
            }

            // 3b. Basement/crawlspace zone: concrete (firstFloorY to gnd)
            els.push(<rect key="hbase" x={hX} y={firstFloorY} width={hW} height={gnd - firstFloorY} fill="#d4d0c8" stroke="#888" strokeWidth="0.5" />);
            for (var by = firstFloorY + 1.5; by < gnd; by += 1.5) {
              els.push(<line key={"hbl"+Math.round(by*10)} x1={hX+0.3} y1={by} x2={hX+hW-0.3} y2={by} stroke="#bbb" strokeWidth="0.15" />);
            }

            // 3c. Siding zone: wall with horizontal lap siding lines (hTop to firstFloorY)
            els.push(<rect key="hsiding" x={hX} y={hTop} width={hW} height={sidingH} fill="#e8e6e0" stroke="#888" strokeWidth="0.5" />);
            for (var sly = hTop + 0.7; sly < firstFloorY; sly += 0.7) {
              els.push(<line key={"hsl"+Math.round(sly*10)} x1={hX} y1={sly} x2={hX+hW} y2={sly} stroke="#d8d4cc" strokeWidth="0.12" />);
            }

            // 3d. Windows (only if wall zone tall enough)
            if (sidingH > 3) {
              var wFill = "#b0d4e8", wStroke = "#888";
              var wy = hTop + sidingH * 0.15;
              var wh = Math.min(sidingH * 0.5, 4 * sY);
              els.push(<rect key="hw1" x={hX + hW*0.08} y={wy} width={hW*0.14} height={wh} fill={wFill} stroke={wStroke} strokeWidth="0.4" />);
              els.push(<rect key="hw2" x={hX + hW*0.42} y={wy + wh*0.05} width={hW*0.10} height={wh*0.8} fill={wFill} stroke={wStroke} strokeWidth="0.4" />);
              els.push(<rect key="hw3" x={hX + hW*0.72} y={wy + wh*0.05} width={hW*0.10} height={wh*0.7} fill={wFill} stroke={wStroke} strokeWidth="0.4" />);
              // Window mullions
              els.push(<line key="hw1m" x1={hX + hW*0.08 + hW*0.07} y1={wy} x2={hX + hW*0.08 + hW*0.07} y2={wy+wh} stroke={wStroke} strokeWidth="0.2" />);
            }

            // 3e. Floor plate line between siding and basement
            els.push(<line key="hfloor" x1={hX} y1={firstFloorY} x2={hX+hW} y2={firstFloorY} stroke="#777" strokeWidth="0.6" />);

            // 3f. Roof with eave overhang
            els.push(<polygon key="hroof" points={`${hX-overhang},${hTop} ${hX+hW/2},${hTop-roofPk} ${hX+hW+overhang},${hTop}`} fill="#888" stroke="#444" strokeWidth="0.8" />);

            // 3g. Label
            els.push(<text key="hlabel" x={hX+hW/2} y={hTop + sidingH*0.4} textAnchor="middle" style={{fontSize: showWidth ? 4 : 3.5, fill:"#aaa", fontFamily:"monospace"}}>EXISTING HOUSE</text>);

            return els;
          })()}

          {/* Key plan inset */}
          <KeyPlan viewDir={viewDir} insetX={kpX} insetY={kpY} insetSize={kpSize} />

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

          {/* S35: Hardware callout labels */}
          {hwEls}

          {/* Height dimension - uses dX (bounding box left edge) */}
          <line x1={dX-8} y1={gnd} x2={dX-8} y2={dY} stroke="#1565c0" strokeWidth="0.4" />
          <line x1={dX-10} y1={gnd} x2={dX-6} y2={gnd} stroke="#1565c0" strokeWidth="0.4" />
          <line x1={dX-10} y1={dY} x2={dX-6} y2={dY} stroke="#1565c0" strokeWidth="0.4" />
          <text x={dX-12} y={(gnd+dY)/2+2} textAnchor="middle" transform={`rotate(-90,${dX-12},${(gnd+dY)/2})`} style={{ fontSize: 5.5, fill: "#1565c0", fontWeight: 700, fontFamily: "monospace" }}>{window.fmtFtIn(H)}</text>

          {/* Width dimension - uses dX/dSW (spans full bounding box) */}
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
      {viewOrder.map(function(v) { return (
        <MiniElev key={v.dir} viewDir={v.dir} showWidth={v.showWidth} />
      ); })}
    </div>
  );
}

window.ElevationView = ElevationView;
