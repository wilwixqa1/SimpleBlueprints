// ============================================================
// DECK 3D — Three.js interactive preview
// ============================================================
const { useEffect: _d3UE, useRef: _d3UR } = React;

function Deck3D({ c, p }) {
  const ref = _d3UR(null); const frameRef = _d3UR(null);
  const orbit = _d3UR({ theta: -0.6, phi: 0.5, dist: 0, drag: false, lx: 0, ly: 0 });
  const { W, D, H, nP, pp, postSize, beamSize, joistSize, sp, fDiam } = c;

  _d3UE(() => {
    if (typeof THREE === 'undefined') return;
    const el = ref.current; if (!el) return;
    const cW = el.clientWidth || 500; const cH = el.clientHeight || 380;
    if (cW < 10) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf5f2eb); scene.fog = new THREE.Fog(0xf5f2eb, 60, 120);
    const cam = new THREE.PerspectiveCamera(45, cW / cH, 0.1, 200);
    orbit.current.dist = Math.max(W, D, H * 2) * 1.8;
    const ren = new THREE.WebGLRenderer({ antialias: true }); ren.setSize(cW, cH); ren.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
    el.innerHTML = ""; el.appendChild(ren.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xfff5e0, 0.8); sun.position.set(20, 30, 15); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
    scene.add(sun); const fill = new THREE.DirectionalLight(0xc0d0ff, 0.3); fill.position.set(-10, 15, -10); scene.add(fill);

    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0xb8c9a0, roughness: 1 }));
    gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; scene.add(gnd);
    const grid = new THREE.GridHelper(80, 80, 0xa0b088, 0xa8b890); grid.position.y = 0.01; scene.add(grid);

    const mats = {
      concrete: new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.9 }),
      post: new THREE.MeshStandardMaterial({ color: 0xc4a060, roughness: 0.7 }),
      beam: new THREE.MeshStandardMaterial({ color: 0xc4960a, roughness: 0.6 }),
      joist: new THREE.MeshStandardMaterial({ color: 0xd4b87a, roughness: 0.7 }),
      deck: new THREE.MeshStandardMaterial({ color: p.deckingType === "composite" ? 0x8B7355 : 0xc4a060, roughness: 0.6 }),
      rail: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.7 }),
      house: new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.8 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.7 }),
      win: new THREE.MeshStandardMaterial({ color: 0x90bcd4, roughness: 0.2 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.5 }),
      stairTread: new THREE.MeshStandardMaterial({ color: p.deckingType === "composite" ? 0x8B7355 : 0xc4a060, roughness: 0.65 }),
      stairRiser: new THREE.MeshStandardMaterial({ color: 0xd4b87a, roughness: 0.75 }),
      stringer: new THREE.MeshStandardMaterial({ color: 0xa08040, roughness: 0.75 }),
    };

    const cx = -W / 2, cz = -D / 2;
    var hasSt = p.hasStairs && c.stairs && H > 0.5;
    var stPl = hasSt ? window.getStairPlacement(p, c) : null;
    var exitSide = stPl ? (stPl.angle === 90 ? "right" : stPl.angle === 270 ? "left" : stPl.angle === 180 ? "back" : "front") : null;
    var stW = (p.stairWidth || 4);
    var frontGap = null, leftGap = null, rightGap = null;
    if (hasSt && stPl) {
      if (exitSide === "front") { var gc = cx + stPl.anchorX; frontGap = { min: gc - stW/2, max: gc + stW/2 }; }
      else if (exitSide === "right") { var gc = cz + stPl.anchorY; rightGap = { min: gc - stW/2, max: gc + stW/2 }; }
      else if (exitSide === "left") { var gc = cz + stPl.anchorY; leftGap = { min: gc - stW/2, max: gc + stW/2 }; }
    }

    // House
    const hW = p.houseWidth, hD = 14, hH = Math.max(H + 8, 12);
    const hX = cx + (W - hW) / 2, hZ = cz - hD;
    var hm = new THREE.Mesh(new THREE.BoxGeometry(hW, hH, hD), mats.house); hm.position.set(hX + hW/2, hH/2, hZ + hD/2); hm.castShadow = true; scene.add(hm);
    const ov = 1.5, rpk = 5;
    const rx1 = hX-ov, rx2 = hX+hW+ov, rxM = hX+hW/2, ry = hH, ryP = hH+rpk, rz1 = hZ-1, rz2 = hZ+hD+1;
    const rv = new Float32Array([rx1,ry,rz2,rx2,ry,rz2,rxM,ryP,rz2, rx2,ry,rz1,rx1,ry,rz1,rxM,ryP,rz1, rx1,ry,rz1,rx1,ry,rz2,rxM,ryP,rz2,rx1,ry,rz1,rxM,ryP,rz2,rxM,ryP,rz1, rx2,ry,rz2,rx2,ry,rz1,rxM,ryP,rz1,rx2,ry,rz2,rxM,ryP,rz1,rxM,ryP,rz2, rx1,ry,rz1,rx2,ry,rz1,rx2,ry,rz2,rx1,ry,rz1,rx2,ry,rz2,rx1,ry,rz2]);
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rv, 3)); rg.computeVertexNormals();
    scene.add(new THREE.Mesh(rg, mats.roof));
    for (let wx = 0.2; wx < 0.9; wx += 0.3) { scene.add(new THREE.Mesh(new THREE.PlaneGeometry(3,4), mats.win)).position.set(hX+hW*wx, H+5, hZ+hD+0.05); }
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(4,6.5), mats.win)).position.set(cx+W/2, H-6.5/2+6.7, cz+0.05);

    // Piers + Posts + Caps — filter out posts that conflict with stair opening
    const pR = (fDiam/12)/2, pD = postSize==="6x6" ? 5.5/12 : 3.5/12;
    var filteredPP = pp.filter(function(px) {
      var wx = cx + px; // world X of this post
      if (frontGap) {
        // Skip post if it's anywhere within the stair width (with 1ft margin)
        if (wx > frontGap.min - 0.5 && wx < frontGap.max + 0.5) return false;
      }
      if (leftGap) {
        var wz = cz + D - 1.5; // beam Z position
        if (wz > leftGap.min - 0.5 && wz < leftGap.max + 0.5 && wx < cx + stW + 1) return false;
      }
      if (rightGap) {
        var wz = cz + D - 1.5;
        if (wz > rightGap.min - 0.5 && wz < rightGap.max + 0.5 && wx > cx + W - stW - 1) return false;
      }
      return true;
    });
    filteredPP.forEach(function(px) {
      scene.add(new THREE.Mesh(new THREE.CylinderGeometry(pR,pR,0.5,16), mats.concrete)).position.set(cx+px, 0.25, cz+D-1.5);
      var po = new THREE.Mesh(new THREE.BoxGeometry(pD,H,pD), mats.post); po.position.set(cx+px, H/2, cz+D-1.5); po.castShadow=true; scene.add(po);
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(pD+0.2,0.15,pD+0.2), mats.metal)).position.set(cx+px, H, cz+D-1.5);
    });

    // Beam + Ledger — continuous (hidden under deck boards)
    const bH2 = 11.875/12, bW2 = beamSize.includes("3") ? 5.25/12 : 3.5/12;
    var bm = new THREE.Mesh(new THREE.BoxGeometry(W-2,bH2,bW2), mats.beam); bm.position.set(cx+W/2, H-bH2/2-0.1, cz+D-1.5); bm.castShadow=true; scene.add(bm);
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(W,9.25/12,1.5/12), mats.joist)).position.set(cx+W/2, H-0.4, cz+0.06);

    // Joists
    const jH2=9.25/12, jW2=1.5/12, jLen=D-1.5;
    for (let x=sp/12; x<W; x+=sp/12) { scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2,jH2,jLen), mats.joist)).position.set(cx+x, H-jH2/2-0.1, cz+jLen/2); }

    // Rim joists — with gap for stairs
    function addRimSeg(x,y,z,w,h,d) { scene.add(new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mats.joist)).position.set(x,y,z); }
    if (frontGap) {
      var lw=frontGap.min-cx, rw=(cx+W)-frontGap.max;
      if(lw>0.1) addRimSeg(cx+lw/2, H-jH2/2-0.1, cz+D, lw, jH2, jW2);
      if(rw>0.1) addRimSeg(frontGap.max+rw/2, H-jH2/2-0.1, cz+D, rw, jH2, jW2);
    } else { addRimSeg(cx+W/2, H-jH2/2-0.1, cz+D, W, jH2, jW2); }
    if (leftGap) {
      var s1=leftGap.min-cz, s2=(cz+D)-leftGap.max;
      if(s1>0.1) addRimSeg(cx, H-jH2/2-0.1, cz+s1/2, jW2, jH2, s1);
      if(s2>0.1) addRimSeg(cx, H-jH2/2-0.1, leftGap.max+s2/2, jW2, jH2, s2);
    } else { addRimSeg(cx, H-jH2/2-0.1, cz+D/2, jW2, jH2, D); }
    if (rightGap) {
      var s1=rightGap.min-cz, s2=(cz+D)-rightGap.max;
      if(s1>0.1) addRimSeg(cx+W, H-jH2/2-0.1, cz+s1/2, jW2, jH2, s1);
      if(s2>0.1) addRimSeg(cx+W, H-jH2/2-0.1, rightGap.max+s2/2, jW2, jH2, s2);
    } else { addRimSeg(cx+W, H-jH2/2-0.1, cz+D/2, jW2, jH2, D); }

    // Decking — full continuous surface (stairs descend from edge, no hole needed)
    const bdW=5.5/12, bdH=1/12;
    // Shared visual stair dimensions (used by stair rendering below)
    const V_TREAD_RUN = 10.5 / 12;  // tread depth (IRC fixed)
    const V_STR_W = 0.25;           // stringer visual width
    const V_STR_H = 0.9;            // stringer visual height
    const V_RAIL_W = 0.15;          // handrail post width
    for (let x=bdW/2; x<W; x+=bdW) {
      var b=new THREE.Mesh(new THREE.BoxGeometry(bdW-0.02, bdH, D+0.1), mats.deck);
      b.position.set(cx+x, H+bdH/2, cz+D/2); b.receiveShadow=true; scene.add(b);
    }

    // ── RAILING with gaps — beefed up for visibility ──
    const rH=3, trY=H+bdH+rH, brY=H+bdH+0.25;
    var railTopW = 0.18;  // top rail thickness
    var railBotW = 0.12;  // bottom rail thickness
    var balW = 0.07;      // baluster width
    var balSp = 0.5;      // baluster spacing (~6")
    var postW = 0.3;      // corner post width
    function addRail(x1,z1,x2,z2) {
      var dx2=x2-x1,dz2=z2-z1,len=Math.sqrt(dx2*dx2+dz2*dz2);
      if(len<0.05) return;
      var mx=(x1+x2)/2,mz=(z1+z2)/2,isX=Math.abs(dz2)<0.01;
      // Top rail
      scene.add(new THREE.Mesh(isX?new THREE.BoxGeometry(len,railTopW,railTopW):new THREE.BoxGeometry(railTopW,railTopW,len),mats.rail)).position.set(mx,trY,mz);
      // Bottom rail
      scene.add(new THREE.Mesh(isX?new THREE.BoxGeometry(len,railBotW,railBotW):new THREE.BoxGeometry(railBotW,railBotW,len),mats.rail)).position.set(mx,brY,mz);
      // Balusters
      var bG=new THREE.BoxGeometry(balW,rH-0.3,balW), n=Math.max(1,Math.floor(len/balSp));
      for(var i=0;i<=n;i++){var t=n>0?i/n:0.5; scene.add(new THREE.Mesh(bG,mats.rail)).position.set(x1+dx2*t, H+bdH+rH/2+0.1, z1+dz2*t);}
    }
    if(frontGap){
      if(frontGap.min-cx>0.1) addRail(cx,cz+D,frontGap.min,cz+D);
      if((cx+W)-frontGap.max>0.1) addRail(frontGap.max,cz+D,cx+W,cz+D);
    } else addRail(cx,cz+D,cx+W,cz+D);
    if(leftGap){
      if(leftGap.min-cz>0.1) addRail(cx,cz,cx,leftGap.min);
      if((cz+D)-leftGap.max>0.1) addRail(cx,leftGap.max,cx,cz+D);
    } else addRail(cx,cz,cx,cz+D);
    if(rightGap){
      if(rightGap.min-cz>0.1) addRail(cx+W,cz,cx+W,rightGap.min);
      if((cz+D)-rightGap.max>0.1) addRail(cx+W,rightGap.max,cx+W,cz+D);
    } else addRail(cx+W,cz,cx+W,cz+D);
    // Corner posts — bigger
    [[cx,cz],[cx+W,cz],[cx,cz+D],[cx+W,cz+D]].forEach(([x,z])=>{
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(postW,rH+0.3,postW),mats.rail)).position.set(x,H+bdH+rH/2,z);
    });

    // ================================================================
    // STAIRS 3D — Visual overhaul: exaggerated proportions, no rails
    // ================================================================
    if (hasSt && stPl) {
      var sg = window.computeStairGeometry({
        template: p.stairTemplate || "straight", height: H,
        stairWidth: p.stairWidth || 4, numStringers: p.numStringers || 3,
        runSplit: p.stairRunSplit ? p.stairRunSplit/100 : null,
        landingDepth: p.stairLandingDepth || null,
        stairGap: p.stairGap != null ? p.stairGap : 0.5
      });
      if (sg) {
        var stGrp = new THREE.Group();

        // Exaggerated dimensions for visual clarity at preview scale
        var riseFt = sg.riseIn / 12;        // actual rise per step in feet
        var treadFt = V_TREAD_RUN;          // tread run (10.5")
        var treadTh = 0.2;                  // tread thickness — 3x real for visibility
        var riserTh = 0.1;                  // riser board thickness
        var strW = V_STR_W;                 // stringer width — visible diagonal
        var strH = V_STR_H;                 // stringer height (depth of cut board)
        var noseOver = 0.08;                // tread overhang past riser

        // Stringer material — make it darker/more visible
        var matStr = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.7 });

        var cumR = 0;
        sg.runs.forEach(function(run, ri) {
          var topElev = H - cumR * riseFt;
          // Direction vectors
          var dsx = 0, dsz = 0;
          if (run.downDir === "+y") dsz = 1;
          else if (run.downDir === "-y") dsz = -1;
          else if (run.downDir === "+x") dsx = 1;
          else if (run.downDir === "-x") dsx = -1;
          var isHoriz = (run.treadAxis === "h");
          var span = isHoriz ? run.rect.w : run.rect.h;

          // Start position (top of this run, center of stair width)
          var sx, sz;
          if (dsz > 0) { sx = run.rect.x + run.rect.w / 2; sz = run.rect.y; }
          else if (dsz < 0) { sx = run.rect.x + run.rect.w / 2; sz = run.rect.y + run.rect.h; }
          else if (dsx > 0) { sx = run.rect.x; sz = run.rect.y + run.rect.h / 2; }
          else { sx = run.rect.x + run.rect.w; sz = run.rect.y + run.rect.h / 2; }

          // === TREADS — thick, visible boards ===
          for (var i = 0; i < run.treads; i++) {
            var tY = topElev - (i + 1) * riseFt;
            var tX = sx + dsx * treadFt * (i + 0.5);
            var tZ = sz + dsz * treadFt * (i + 0.5);
            // Tread with slight overhang
            var tw = isHoriz ? span + noseOver * 2 : treadFt + noseOver;
            var td = isHoriz ? treadFt + noseOver : span + noseOver * 2;
            var tm = new THREE.Mesh(new THREE.BoxGeometry(tw, treadTh, td), mats.stairTread);
            tm.position.set(tX, tY + treadTh / 2, tZ);
            tm.castShadow = true; tm.receiveShadow = true;
            stGrp.add(tm);
          }

          // === RISERS — vertical boards between treads ===
          for (var i = 0; i < run.risers; i++) {
            var rY = topElev - (i + 1) * riseFt;
            var rX = sx + dsx * treadFt * i;
            var rZ = sz + dsz * treadFt * i;
            // Offset riser to front face of tread position
            rX += dsx * (-treadFt * 0.0);
            rZ += dsz * (-treadFt * 0.0);
            var rw = isHoriz ? span : riserTh;
            var rd = isHoriz ? riserTh : span;
            var rm = new THREE.Mesh(new THREE.BoxGeometry(rw, riseFt * 0.92, rd), mats.stairRiser);
            rm.position.set(rX, rY + riseFt * 0.46, rZ);
            stGrp.add(rm);
          }

          // === STRINGERS — prominent diagonal boards on each side ===
          var hDist = run.treads * treadFt;
          var vDist = run.risers * riseFt;
          var sLen = Math.sqrt(hDist * hDist + vDist * vDist); // exact length, no overshoot
          var sAng = Math.atan2(vDist, hDist);
          var midY = topElev - vDist / 2;
          var midHX = sx + dsx * hDist / 2;
          var midHZ = sz + dsz * hDist / 2;

          // Place stringers at edges of stair width
          var strPositions = [];
          if (isHoriz) {
            strPositions.push(run.rect.x + strW / 2);
            strPositions.push(run.rect.x + run.rect.w - strW / 2);
          } else {
            strPositions.push(run.rect.y + strW / 2);
            strPositions.push(run.rect.y + run.rect.h - strW / 2);
          }

          strPositions.forEach(function(ePos) {
            var sg2 = isHoriz
              ? new THREE.BoxGeometry(strW, strH, sLen)
              : new THREE.BoxGeometry(sLen, strH, strW);
            var sm = new THREE.Mesh(sg2, matStr);
            if (isHoriz) {
              sm.position.set(ePos, midY, midHZ);
              sm.rotation.x = dsz > 0 ? sAng : -sAng;
            } else {
              sm.position.set(midHX, midY, ePos);
              sm.rotation.z = dsx > 0 ? -sAng : sAng;
            }
            sm.castShadow = true;
            stGrp.add(sm);

            // === STAIR HANDRAIL — angled top rail + posts ===
            var stRailH = 3.0;
            var railW = V_RAIL_W; // rail thickness (shared constant)
            var trLen = Math.sqrt(hDist * hDist + vDist * vDist);
            // Top rail — follows stringer angle, offset up by rail height
            var trG = isHoriz
              ? new THREE.BoxGeometry(railW, railW, trLen)
              : new THREE.BoxGeometry(trLen, railW, railW);
            var trM = new THREE.Mesh(trG, mats.rail);
            if (isHoriz) {
              trM.position.set(ePos, midY + stRailH, midHZ);
              trM.rotation.x = dsz > 0 ? sAng : -sAng;
            } else {
              trM.position.set(midHX, midY + stRailH, ePos);
              trM.rotation.z = dsx > 0 ? -sAng : sAng;
            }
            stGrp.add(trM);

            // Posts at top, middle, and bottom of run
            var postSpacing = Math.max(1, Math.floor(run.treads / 3));
            for (var pi = 0; pi <= run.treads; pi += postSpacing) {
              var stepIdx = Math.min(pi, run.treads - 1);
              var postBaseY = topElev - (stepIdx + 1) * riseFt + treadTh;
              var postX = isHoriz ? ePos : sx + dsx * treadFt * (stepIdx + 0.5);
              var postZ = isHoriz ? sz + dsz * treadFt * (stepIdx + 0.5) : ePos;
              var pm = new THREE.Mesh(
                new THREE.BoxGeometry(railW, stRailH, railW), mats.rail
              );
              pm.position.set(postX, postBaseY + stRailH / 2, postZ);
              stGrp.add(pm);
            }
          });

          cumR += run.risers;
        });

        // === LANDINGS — simple thick slab ===
        var lCumR = 0;
        sg.landings.forEach(function(landing, li) {
          lCumR += sg.runs[li].risers;
          var lElev = H - lCumR * riseFt;
          var lr = landing.rect;

          // Landing slab — thicker than treads for visual weight
          var platM = new THREE.Mesh(
            new THREE.BoxGeometry(lr.w, treadTh * 2, lr.h), mats.deck
          );
          platM.position.set(lr.x + lr.w / 2, lElev + treadTh, lr.y + lr.h / 2);
          platM.receiveShadow = true; platM.castShadow = true;
          stGrp.add(platM);

          // Landing support posts (only corners)
          var lpSz = postSize === "6x6" ? 5.5 / 12 : 3.5 / 12;
          var corners = [
            [lr.x + lpSz / 2, lr.y + lpSz / 2],
            [lr.x + lr.w - lpSz / 2, lr.y + lpSz / 2],
            [lr.x + lpSz / 2, lr.y + lr.h - lpSz / 2],
            [lr.x + lr.w - lpSz / 2, lr.y + lr.h - lpSz / 2]
          ];
          corners.forEach(function(pt) {
            var lpm = new THREE.Mesh(new THREE.BoxGeometry(lpSz, lElev, lpSz), mats.post);
            lpm.position.set(pt[0], lElev / 2, pt[1]);
            lpm.castShadow = true;
            stGrp.add(lpm);
            // Pier at base
            stGrp.add(new THREE.Mesh(
              new THREE.CylinderGeometry(pR, pR, 0.35, 12), mats.concrete
            )).position.set(pt[0], 0.175, pt[1]);
          });
        });

        // === GROUND PAD at bottom of stairs ===
        var bb = sg.bbox;
        var padMat = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.95 });
        var padM = new THREE.Mesh(
          new THREE.BoxGeometry(bb.w + 1, 0.25, bb.h + 1), padMat
        );
        padM.position.set((bb.minX + bb.maxX) / 2, 0.125, (bb.minY + bb.maxY) / 2);
        padM.receiveShadow = true;
        stGrp.add(padM);

        // Position and rotate the entire stair group
        stGrp.position.set(cx + stPl.anchorX, 0, cz + stPl.anchorY);
        stGrp.rotation.y = -(stPl.angle || 0) * Math.PI / 180;
        scene.add(stGrp);
      }
    }

    // Controls
    const cv=ren.domElement;
    const onD=e=>{orbit.current.drag=true;const t=e.touches?e.touches[0]:e;orbit.current.lx=t.clientX;orbit.current.ly=t.clientY;};
    const onM=e=>{if(!orbit.current.drag)return;const t=e.touches?e.touches[0]:e;orbit.current.theta-=(t.clientX-orbit.current.lx)*0.005;orbit.current.phi=Math.max(0.1,Math.min(1.4,orbit.current.phi-(t.clientY-orbit.current.ly)*0.005));orbit.current.lx=t.clientX;orbit.current.ly=t.clientY;};
    const onU=()=>{orbit.current.drag=false;};
    const onW=e=>{orbit.current.dist=Math.max(8,Math.min(80,orbit.current.dist+e.deltaY*0.03));};
    cv.addEventListener("mousedown",onD);cv.addEventListener("mousemove",onM);cv.addEventListener("mouseup",onU);cv.addEventListener("mouseleave",onU);cv.addEventListener("wheel",onW);
    cv.addEventListener("touchstart",onD,{passive:true});cv.addEventListener("touchmove",onM,{passive:true});cv.addEventListener("touchend",onU);
    const lookY=H/2+1;
    const anim=()=>{frameRef.current=requestAnimationFrame(anim);const o=orbit.current;cam.position.set(o.dist*Math.sin(o.phi)*Math.cos(o.theta),o.dist*Math.cos(o.phi)+lookY,o.dist*Math.sin(o.phi)*Math.sin(o.theta));cam.lookAt(0,lookY,0);ren.render(scene,cam);};
    anim();
    return ()=>{cancelAnimationFrame(frameRef.current);cv.removeEventListener("mousedown",onD);cv.removeEventListener("mousemove",onM);cv.removeEventListener("mouseup",onU);cv.removeEventListener("mouseleave",onU);cv.removeEventListener("wheel",onW);cv.removeEventListener("touchstart",onD);cv.removeEventListener("touchmove",onM);cv.removeEventListener("touchend",onU);ren.dispose();};
  }, [W,D,H,nP,pp,postSize,beamSize,sp,fDiam,p.deckingType,p.hasStairs,p.stairTemplate,p.stairWidth,p.numStringers,p.stairAnchorX,p.stairAnchorY,p.stairAngle,p.stairLocation,p.stairOffset,p.stairRunSplit,p.stairLandingDepth,p.stairGap,p.height]);

  return <div ref={ref} style={{ width: "100%", height: 380, borderRadius: 6, overflow: "hidden" }} />;
}

window.Deck3D = Deck3D;
