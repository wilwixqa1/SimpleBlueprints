// ============================================================
// DECK 3D — Three.js interactive preview + capture3D for PDF cover
// Shared scene builder: buildDeckScene(scene, p, c, THREE)
// ============================================================
const { useEffect: _d3UE, useRef: _d3UR } = React;

// ============================================================
// buildDeckScene — shared scene population for Deck3D + capture3D
// Adds all deck geometry (house, structure, decking, railing, stairs)
// to the provided scene. Returns { exitSide } for camera positioning.
// ============================================================
window.buildDeckScene = function(scene, p, c, THREE) {
  var W = c.W, D = c.D, H = c.H, pp = c.pp, postSize = c.postSize,
      beamSize = c.beamSize, sp = c.sp, fDiam = c.fDiam;

  var mats = {
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
    stringer: new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.7 }),
  };

  var cx = -W / 2, cz = -D / 2;
  var isLedger = c.attachment === "ledger";
  var hasSt = p.hasStairs && c.stairs && H > 0.5;
  var stPl = hasSt ? window.getStairPlacement(p, c) : null;
  var exitSide = stPl ? (stPl.angle === 90 ? "right" : stPl.angle === 270 ? "left" : stPl.angle === 180 ? "back" : "front") : null;
  var stW = (p.stairWidth || 4);
  var frontGap = null, leftGap = null, rightGap = null;
  var sg = hasSt ? window.computeStairGeometry({
    template: p.stairTemplate || "straight", height: H,
    stairWidth: p.stairWidth || 4, numStringers: p.numStringers || 3,
    runSplit: p.stairRunSplit ? p.stairRunSplit / 100 : null,
    landingDepth: p.stairLandingDepth || null,
    stairGap: p.stairGap != null ? p.stairGap : 0.5
  }) : null;
  var stairClipD = 0;
  if (hasSt && stPl && sg && sg.runs.length > 0) {
    if (exitSide === "front") {
      stairClipD = Math.max(0, (cz + D) - (cz + stPl.anchorY));
      var gc = cx + stPl.anchorX;
      var sxMin = gc - stW / 2, sxMax = gc + stW / 2;
      if (sxMax > cx && sxMin < cx + W) {
        frontGap = { min: Math.max(sxMin, cx), max: Math.min(sxMax, cx + W),
          zMin: cz + stPl.anchorY, zMax: Math.min(cz + D, cz + stPl.anchorY + (sg.bbox ? sg.bbox.h : D)) };
      }
    } else if (exitSide === "right") {
      stairClipD = Math.max(0, (cx + W) - (cx + stPl.anchorX));
      var gc = cz + stPl.anchorY;
      var szMin = gc - stW / 2, szMax = gc + stW / 2;
      if (szMax > cz && szMin < cz + D) {
        rightGap = { min: Math.max(szMin, cz), max: Math.min(szMax, cz + D),
          xMin: cx + stPl.anchorX,
          xMax: Math.min(cx + W, cx + stPl.anchorX + (sg.bbox ? sg.bbox.h : W)) };
      }
    } else if (exitSide === "left") {
      stairClipD = Math.max(0, (cx + stPl.anchorX) - cx);
      var gc = cz + stPl.anchorY;
      var szMin = gc - stW / 2, szMax = gc + stW / 2;
      if (szMax > cz && szMin < cz + D) {
        leftGap = { min: Math.max(szMin, cz), max: Math.min(szMax, cz + D),
          xMin: Math.max(cx, cx + stPl.anchorX - (sg.bbox ? sg.bbox.h : W)),
          xMax: cx + stPl.anchorX };
      }
    }
  }
  // Edge-reach flags: only gap rim/railing/beam when stair footprint reaches deck edge
  var leftAtEdge = leftGap && leftGap.xMin <= cx + 0.1;
  var rightAtEdge = rightGap && rightGap.xMax >= cx + W - 0.1;

  // House
  var hW = p.houseWidth, hD = 14, hH = Math.max(H + 8, 12);
  var hX = cx + (W - hW) / 2, hZ = cz - hD;
  var hm = new THREE.Mesh(new THREE.BoxGeometry(hW, hH, hD), mats.house); hm.position.set(hX + hW / 2, hH / 2, hZ + hD / 2); hm.castShadow = true; scene.add(hm);
  var ov = 1.5, rpk = 5;
  var rx1 = hX - ov, rx2 = hX + hW + ov, rxM = hX + hW / 2, ry = hH, ryP = hH + rpk, rz1 = hZ - 1, rz2 = hZ + hD + 1;
  var rv = new Float32Array([rx1,ry,rz2,rx2,ry,rz2,rxM,ryP,rz2, rx2,ry,rz1,rx1,ry,rz1,rxM,ryP,rz1, rx1,ry,rz1,rx1,ry,rz2,rxM,ryP,rz2,rx1,ry,rz1,rxM,ryP,rz2,rxM,ryP,rz1, rx2,ry,rz2,rx2,ry,rz1,rxM,ryP,rz1,rx2,ry,rz2,rxM,ryP,rz1,rxM,ryP,rz2, rx1,ry,rz1,rx2,ry,rz1,rx2,ry,rz2,rx1,ry,rz1,rx2,ry,rz2,rx1,ry,rz2]);
  var rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rv, 3)); rg.computeVertexNormals();
  scene.add(new THREE.Mesh(rg, mats.roof));
  for (var wx = 0.2; wx < 0.9; wx += 0.3) { scene.add(new THREE.Mesh(new THREE.PlaneGeometry(3, 4), mats.win)).position.set(hX + hW * wx, H + 5, hZ + hD + 0.05); }
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(4, 6.5), mats.win)).position.set(cx + W / 2, H - 6.5 / 2 + 6.7, cz + 0.05);

  // Piers + Posts + Caps
  var pR = (fDiam / 12) / 2, pD = postSize === "6x6" ? 5.5 / 12 : 3.5 / 12;
  var filteredPP = pp.filter(function(px) {
    var wpx = cx + px;
    if (frontGap) {
      if (wpx > frontGap.min - 0.5 && wpx < frontGap.max + 0.5) return false;
    }
    if (leftGap) {
      var wz = cz + D - 1.5;
      if (wz > leftGap.min - 0.5 && wz < leftGap.max + 0.5 && wpx > leftGap.xMin - 0.5 && wpx < leftGap.xMax + 0.5) return false;
    }
    if (rightGap) {
      var wz = cz + D - 1.5;
      if (wz > rightGap.min - 0.5 && wz < rightGap.max + 0.5 && wpx > rightGap.xMin - 0.5 && wpx < rightGap.xMax + 0.5) return false;
    }
    return true;
  });
  filteredPP.forEach(function(px) {
    scene.add(new THREE.Mesh(new THREE.CylinderGeometry(pR, pR, 0.5, 16), mats.concrete)).position.set(cx + px, 0.25, cz + D - 1.5);
    var po = new THREE.Mesh(new THREE.BoxGeometry(pD, H, pD), mats.post); po.position.set(cx + px, H / 2, cz + D - 1.5); po.castShadow = true; scene.add(po);
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(pD + 0.2, 0.15, pD + 0.2), mats.metal)).position.set(cx + px, H, cz + D - 1.5);
  });

  // Beam + Ledger
  var bH2 = 11.875 / 12, bW2 = beamSize.includes("3") ? 5.25 / 12 : 3.5 / 12;
  if (frontGap && stairClipD > 1.5 && frontGap.zMax > cz + D - 2) {
    var bL = frontGap.min - (cx + 1);
    var bR = (cx + W - 1) - frontGap.max;
    if (bL > 0.1) { var bmL = new THREE.Mesh(new THREE.BoxGeometry(bL, bH2, bW2), mats.beam); bmL.position.set(cx + 1 + bL / 2, H - bH2 / 2 - 0.1, cz + D - 1.5); bmL.castShadow = true; scene.add(bmL); }
    if (bR > 0.1) { var bmR = new THREE.Mesh(new THREE.BoxGeometry(bR, bH2, bW2), mats.beam); bmR.position.set(frontGap.max + bR / 2, H - bH2 / 2 - 0.1, cz + D - 1.5); bmR.castShadow = true; scene.add(bmR); }
  } else {
    var bm = new THREE.Mesh(new THREE.BoxGeometry(W - 2, bH2, bW2), mats.beam); bm.position.set(cx + W / 2, H - bH2 / 2 - 0.1, cz + D - 1.5); bm.castShadow = true; scene.add(bm);
  }
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(W, 9.25 / 12, 1.5 / 12), mats.joist)).position.set(cx + W / 2, H - 0.4, cz + 0.06);

  // Joists
  var jH2 = 9.25 / 12, jW2 = 1.5 / 12, jLen = D - 1.5;
  for (var x = sp / 12; x < W; x += sp / 12) {
    var jx = cx + x;
    if (frontGap && stairClipD > 0.5 && jx > frontGap.min + 0.05 && jx < frontGap.max - 0.05) {
      var jSeg1 = frontGap.zMin - cz;
      if (jSeg1 > 0.2) {
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jSeg1), mats.joist)).position.set(jx, H - jH2 / 2 - 0.1, cz + jSeg1 / 2);
      }
      var jSeg2 = (cz + D - 1.5) - frontGap.zMax;
      if (jSeg2 > 0.2) {
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jSeg2), mats.joist)).position.set(jx, H - jH2 / 2 - 0.1, frontGap.zMax + jSeg2 / 2);
      }
      continue;
    }
    if (leftGap && jx > leftGap.xMin + 0.05 && jx < leftGap.xMax - 0.05) {
      var jSeg1 = leftGap.min - cz;
      if (jSeg1 > 0.2) {
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jSeg1), mats.joist)).position.set(jx, H - jH2 / 2 - 0.1, cz + jSeg1 / 2);
      }
      var jSeg2 = (cz + D - 1.5) - leftGap.max;
      if (jSeg2 > 0.2) {
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jSeg2), mats.joist)).position.set(jx, H - jH2 / 2 - 0.1, leftGap.max + jSeg2 / 2);
      }
      continue;
    }
    if (rightGap && jx > rightGap.xMin + 0.05 && jx < rightGap.xMax - 0.05) {
      var jSeg1 = rightGap.min - cz;
      if (jSeg1 > 0.2) {
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jSeg1), mats.joist)).position.set(jx, H - jH2 / 2 - 0.1, cz + jSeg1 / 2);
      }
      var jSeg2 = (cz + D - 1.5) - rightGap.max;
      if (jSeg2 > 0.2) {
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jSeg2), mats.joist)).position.set(jx, H - jH2 / 2 - 0.1, rightGap.max + jSeg2 / 2);
      }
      continue;
    }
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jLen), mats.joist)).position.set(jx, H - jH2 / 2 - 0.1, cz + jLen / 2);
  }

  // Rim joists — with gap for stairs
  function addRimSeg(x, y, z, w, h, d) { scene.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.joist)).position.set(x, y, z); }
  if (frontGap && frontGap.zMax >= cz + D - 0.1) {
    var lw = frontGap.min - cx, rw = (cx + W) - frontGap.max;
    if (lw > 0.1) addRimSeg(cx + lw / 2, H - jH2 / 2 - 0.1, cz + D, lw, jH2, jW2);
    if (rw > 0.1) addRimSeg(frontGap.max + rw / 2, H - jH2 / 2 - 0.1, cz + D, rw, jH2, jW2);
  } else { addRimSeg(cx + W / 2, H - jH2 / 2 - 0.1, cz + D, W, jH2, jW2); }
  if (leftAtEdge) {
    var s1 = leftGap.min - cz, s2 = (cz + D) - leftGap.max;
    if (s1 > 0.1) addRimSeg(cx, H - jH2 / 2 - 0.1, cz + s1 / 2, jW2, jH2, s1);
    if (s2 > 0.1) addRimSeg(cx, H - jH2 / 2 - 0.1, leftGap.max + s2 / 2, jW2, jH2, s2);
  } else { addRimSeg(cx, H - jH2 / 2 - 0.1, cz + D / 2, jW2, jH2, D); }
  if (rightAtEdge) {
    var s1 = rightGap.min - cz, s2 = (cz + D) - rightGap.max;
    if (s1 > 0.1) addRimSeg(cx + W, H - jH2 / 2 - 0.1, cz + s1 / 2, jW2, jH2, s1);
    if (s2 > 0.1) addRimSeg(cx + W, H - jH2 / 2 - 0.1, rightGap.max + s2 / 2, jW2, jH2, s2);
  } else { addRimSeg(cx + W, H - jH2 / 2 - 0.1, cz + D / 2, jW2, jH2, D); }

  // Decking
  var bdW = 5.5 / 12, bdH = 1 / 12;
  for (var x = bdW / 2; x < W; x += bdW) {
    var bx = cx + x;
    if (frontGap && stairClipD > 0.1 && bx > frontGap.min + 0.02 && bx < frontGap.max - 0.02) {
      var seg1Len = frontGap.zMin - cz;
      if (seg1Len > 0.2) {
        var b1 = new THREE.Mesh(new THREE.BoxGeometry(bdW - 0.02, bdH, seg1Len), mats.deck);
        b1.position.set(bx, H + bdH / 2, cz + seg1Len / 2); b1.receiveShadow = true; scene.add(b1);
      }
      var seg2Len = (cz + D) - frontGap.zMax;
      if (seg2Len > 0.2) {
        var b2 = new THREE.Mesh(new THREE.BoxGeometry(bdW - 0.02, bdH, seg2Len), mats.deck);
        b2.position.set(bx, H + bdH / 2, frontGap.zMax + seg2Len / 2); b2.receiveShadow = true; scene.add(b2);
      }
      continue;
    }
    if (leftGap && bx > leftGap.xMin + 0.02 && bx < leftGap.xMax - 0.02) {
      var seg1 = leftGap.min - cz;
      var seg2 = (cz + D) - leftGap.max;
      if (seg1 > 0.1) { var b1 = new THREE.Mesh(new THREE.BoxGeometry(bdW - 0.02, bdH, seg1), mats.deck); b1.position.set(bx, H + bdH / 2, cz + seg1 / 2); b1.receiveShadow = true; scene.add(b1); }
      if (seg2 > 0.1) { var b2 = new THREE.Mesh(new THREE.BoxGeometry(bdW - 0.02, bdH, seg2), mats.deck); b2.position.set(bx, H + bdH / 2, leftGap.max + seg2 / 2); b2.receiveShadow = true; scene.add(b2); }
      continue;
    }
    if (rightGap && bx > rightGap.xMin + 0.02 && bx < rightGap.xMax - 0.02) {
      var seg1 = rightGap.min - cz;
      var seg2 = (cz + D) - rightGap.max;
      if (seg1 > 0.1) { var b1 = new THREE.Mesh(new THREE.BoxGeometry(bdW - 0.02, bdH, seg1), mats.deck); b1.position.set(bx, H + bdH / 2, cz + seg1 / 2); b1.receiveShadow = true; scene.add(b1); }
      if (seg2 > 0.1) { var b2 = new THREE.Mesh(new THREE.BoxGeometry(bdW - 0.02, bdH, seg2), mats.deck); b2.position.set(bx, H + bdH / 2, rightGap.max + seg2 / 2); b2.receiveShadow = true; scene.add(b2); }
      continue;
    }
    var b = new THREE.Mesh(new THREE.BoxGeometry(bdW - 0.02, bdH, D + 0.1), mats.deck);
    b.position.set(bx, H + bdH / 2, cz + D / 2); b.receiveShadow = true; scene.add(b);
  }

  // ── RAILING ── rewritten S17 — explicit mesh creation, no chaining
  // No back rail for ledger-attached decks
  var rH = 3, trY = H + bdH + rH, brY = H + bdH + 0.25;
  var railTopW = 0.18, railBotW = 0.12, balW = 0.07, balSp = 0.5, postW = 0.3;
  var railZStart = isLedger ? cz + 0.3 : cz;

  // Helper: add a railing run between two points (top rail, bottom rail, balusters)
  function addRail(x1, z1, x2, z2) {
    var dx = x2 - x1, dz = z2 - z1;
    var len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.05) return;
    var mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    var isX = Math.abs(dz) < 0.01;
    // Top rail
    var topG = isX ? new THREE.BoxGeometry(len, railTopW, railTopW) : new THREE.BoxGeometry(railTopW, railTopW, len);
    var topM = new THREE.Mesh(topG, mats.rail);
    topM.position.set(mx, trY, mz);
    scene.add(topM);
    // Bottom rail
    var botG = isX ? new THREE.BoxGeometry(len, railBotW, railBotW) : new THREE.BoxGeometry(railBotW, railBotW, len);
    var botM = new THREE.Mesh(botG, mats.rail);
    botM.position.set(mx, brY, mz);
    scene.add(botM);
    // Balusters
    var balG = new THREE.BoxGeometry(balW, rH - 0.3, balW);
    var n = Math.max(1, Math.floor(len / balSp));
    for (var i = 0; i <= n; i++) {
      var t = n > 0 ? i / n : 0.5;
      var bm = new THREE.Mesh(balG, mats.rail);
      bm.position.set(x1 + dx * t, H + bdH + rH / 2 + 0.1, z1 + dz * t);
      scene.add(bm);
    }
  }

  // Helper: add a railing post at a point
  function addRailPost(px, pz) {
    var pm = new THREE.Mesh(new THREE.BoxGeometry(postW, rH + 0.3, postW), mats.rail);
    pm.position.set(px, H + bdH + rH / 2, pz);
    scene.add(pm);
  }

  // Front railing (with stair gap if front exit)
  if (frontGap && frontGap.zMax >= cz + D - 0.1) {
    if (frontGap.min - cx > 0.1) addRail(cx, cz + D, frontGap.min, cz + D);
    if ((cx + W) - frontGap.max > 0.1) addRail(frontGap.max, cz + D, cx + W, cz + D);
    addRailPost(frontGap.min, cz + D);
    addRailPost(frontGap.max, cz + D);
  } else {
    addRail(cx, cz + D, cx + W, cz + D);
  }

  // Left railing (with stair gap if left exit at edge)
  if (leftAtEdge) {
    if (leftGap.min - railZStart > 0.1) addRail(cx, railZStart, cx, leftGap.min);
    if ((cz + D) - leftGap.max > 0.1) addRail(cx, leftGap.max, cx, cz + D);
    addRailPost(cx, leftGap.min);
    addRailPost(cx, leftGap.max);
  } else {
    addRail(cx, railZStart, cx, cz + D);
  }

  // Right railing (with stair gap if right exit at edge)
  if (rightAtEdge) {
    if (rightGap.min - railZStart > 0.1) addRail(cx + W, railZStart, cx + W, rightGap.min);
    if ((cz + D) - rightGap.max > 0.1) addRail(cx + W, rightGap.max, cx + W, cz + D);
    addRailPost(cx + W, rightGap.min);
    addRailPost(cx + W, rightGap.max);
  } else {
    addRail(cx + W, railZStart, cx + W, cz + D);
  }

  // Corner posts — skip back corners (house wall side) for ledger attachment
  var cornerPosts = isLedger
    ? [[cx, cz + D], [cx + W, cz + D]]
    : [[cx, cz], [cx + W, cz], [cx, cz + D], [cx + W, cz + D]];
  cornerPosts.forEach(function(pt) { addRailPost(pt[0], pt[1]); });

  // Stairs 3D
  var V_TREAD_RUN = 10.5 / 12;
  var V_STR_W = 0.25;
  var V_STR_H = 0.9;
  var V_RAIL_W = 0.15;
  if (hasSt && stPl && sg) {
    var stGrp = new THREE.Group();
    var riseFt = sg.riseIn / 12;
    var treadFt = V_TREAD_RUN;
    var treadTh = 0.2;
    var riserTh = 0.1;
    var strW = V_STR_W;
    var strH = V_STR_H;
    var noseOver = 0.08;
    var matStr = mats.stringer;

    var cumR = 0;
    sg.runs.forEach(function(run, ri) {
      var topElev = H - cumR * riseFt;
      var dsx = 0, dsz = 0;
      if (run.downDir === "+y") dsz = 1;
      else if (run.downDir === "-y") dsz = -1;
      else if (run.downDir === "+x") dsx = 1;
      else if (run.downDir === "-x") dsx = -1;
      var isHoriz = (run.treadAxis === "h");
      var span = isHoriz ? run.rect.w : run.rect.h;

      var sx, sz;
      if (dsz > 0) { sx = run.rect.x + run.rect.w / 2; sz = run.rect.y; }
      else if (dsz < 0) { sx = run.rect.x + run.rect.w / 2; sz = run.rect.y + run.rect.h; }
      else if (dsx > 0) { sx = run.rect.x; sz = run.rect.y + run.rect.h / 2; }
      else { sx = run.rect.x + run.rect.w; sz = run.rect.y + run.rect.h / 2; }

      for (var i = 0; i < run.treads; i++) {
        var tY = topElev - (i + 1) * riseFt;
        var tX = sx + dsx * treadFt * (i + 0.5);
        var tZ = sz + dsz * treadFt * (i + 0.5);
        var tw = isHoriz ? span + noseOver * 2 : treadFt + noseOver;
        var td = isHoriz ? treadFt + noseOver : span + noseOver * 2;
        var tm = new THREE.Mesh(new THREE.BoxGeometry(tw, treadTh, td), mats.stairTread);
        tm.position.set(tX, tY + treadTh / 2, tZ);
        tm.castShadow = true; tm.receiveShadow = true;
        stGrp.add(tm);
      }

      for (var i = 0; i < run.risers; i++) {
        var rY2 = topElev - (i + 1) * riseFt;
        var rX = sx + dsx * treadFt * i;
        var rZ = sz + dsz * treadFt * i;
        rX += dsx * (-treadFt * 0.0);
        rZ += dsz * (-treadFt * 0.0);
        var rw = isHoriz ? span : riserTh;
        var rd = isHoriz ? riserTh : span;
        var rm = new THREE.Mesh(new THREE.BoxGeometry(rw, riseFt * 0.92, rd), mats.stairRiser);
        rm.position.set(rX, rY2 + riseFt * 0.46, rZ);
        stGrp.add(rm);
      }

      var hDist = run.treads * treadFt;
      var vDist = run.risers * riseFt;
      var sLen = Math.sqrt(hDist * hDist + vDist * vDist);
      var sAng = Math.atan2(vDist, hDist);
      var strYClip = strH / 2 * Math.cos(sAng) + 0.08;
      var midY = topElev - vDist / 2 - strYClip;
      var midHX = sx + dsx * hDist / 2;
      var midHZ = sz + dsz * hDist / 2;

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

        var stRailH = 3.0;
        var railW = V_RAIL_W;
        var trLen = Math.sqrt(hDist * hDist + vDist * vDist);
        if (ri === 0) trLen = trLen * 0.85;
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

    var lCumR = 0;
    sg.landings.forEach(function(landing, li) {
      lCumR += sg.runs[li].risers;
      var lElev = H - lCumR * riseFt;
      var lr = landing.rect;

      var platM = new THREE.Mesh(
        new THREE.BoxGeometry(lr.w, treadTh * 2, lr.h), mats.deck
      );
      platM.position.set(lr.x + lr.w / 2, lElev + treadTh, lr.y + lr.h / 2);
      platM.receiveShadow = true; platM.castShadow = true;
      stGrp.add(platM);

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
        stGrp.add(new THREE.Mesh(
          new THREE.CylinderGeometry(pR, pR, 0.35, 12), mats.concrete
        )).position.set(pt[0], 0.175, pt[1]);
      });
    });

    var bb = sg.bbox;
    var padMat = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.95 });
    var padM = new THREE.Mesh(
      new THREE.BoxGeometry(bb.w + 1, 0.25, bb.h + 1), padMat
    );
    padM.position.set((bb.minX + bb.maxX) / 2, 0.125, (bb.minY + bb.maxY) / 2);
    padM.receiveShadow = true;
    stGrp.add(padM);

    stGrp.position.set(cx + stPl.anchorX, 0, cz + stPl.anchorY);
    stGrp.rotation.y = (stPl.angle || 0) * Math.PI / 180;
    scene.add(stGrp);
  }

  return { exitSide: exitSide };
};


// ============================================================
// Deck3D — Interactive Three.js preview component
// Now delegates scene population to buildDeckScene()
// ============================================================
function Deck3D({ c, p }) {
  const ref = _d3UR(null); const frameRef = _d3UR(null);
  const orbit = _d3UR({ theta: -0.6, phi: 0.5, dist: 0, drag: false, lx: 0, ly: 0 });
  const { W, D, H } = c;

  _d3UE(() => {
    if (typeof THREE === 'undefined') return;
    const el = ref.current; if (!el) return;
    const cW = el.clientWidth || 500; const cH = el.clientHeight || 380;
    if (cW < 10) return;

    // Scene + renderer
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf5f2eb); scene.fog = new THREE.Fog(0xf5f2eb, 60, 120);
    const cam = new THREE.PerspectiveCamera(45, cW / cH, 0.1, 200);
    orbit.current.dist = Math.max(W, D, H * 2) * 1.8;
    const ren = new THREE.WebGLRenderer({ antialias: true }); ren.setSize(cW, cH); ren.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
    el.innerHTML = ""; el.appendChild(ren.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xfff5e0, 0.8); sun.position.set(20, 30, 15); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
    scene.add(sun); const fill = new THREE.DirectionalLight(0xc0d0ff, 0.3); fill.position.set(-10, 15, -10); scene.add(fill);

    // Ground + grid
    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0xb8c9a0, roughness: 1 }));
    gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; scene.add(gnd);
    const grid = new THREE.GridHelper(80, 80, 0xa0b088, 0xa8b890); grid.position.y = 0.01; scene.add(grid);

    // Deck scene — shared builder
    window.buildDeckScene(scene, p, c, THREE);

    // Orbit controls
    const cv = ren.domElement;
    const onD = e => { orbit.current.drag = true; const t = e.touches ? e.touches[0] : e; orbit.current.lx = t.clientX; orbit.current.ly = t.clientY; };
    const onM = e => { if (!orbit.current.drag) return; const t = e.touches ? e.touches[0] : e; orbit.current.theta -= (t.clientX - orbit.current.lx) * 0.005; orbit.current.phi = Math.max(0.1, Math.min(1.4, orbit.current.phi - (t.clientY - orbit.current.ly) * 0.005)); orbit.current.lx = t.clientX; orbit.current.ly = t.clientY; };
    const onU = () => { orbit.current.drag = false; };
    const onW = e => { orbit.current.dist = Math.max(8, Math.min(80, orbit.current.dist + e.deltaY * 0.03)); };
    cv.addEventListener("mousedown", onD); cv.addEventListener("mousemove", onM); cv.addEventListener("mouseup", onU); cv.addEventListener("mouseleave", onU); cv.addEventListener("wheel", onW);
    cv.addEventListener("touchstart", onD, { passive: true }); cv.addEventListener("touchmove", onM, { passive: true }); cv.addEventListener("touchend", onU);

    // Animation loop
    const lookY = H / 2 + 1;
    const anim = () => { frameRef.current = requestAnimationFrame(anim); const o = orbit.current; cam.position.set(o.dist * Math.sin(o.phi) * Math.cos(o.theta), o.dist * Math.cos(o.phi) + lookY, o.dist * Math.sin(o.phi) * Math.sin(o.theta)); cam.lookAt(0, lookY, 0); ren.render(scene, cam); };
    anim();

    // Cleanup
    return () => { cancelAnimationFrame(frameRef.current); cv.removeEventListener("mousedown", onD); cv.removeEventListener("mousemove", onM); cv.removeEventListener("mouseup", onU); cv.removeEventListener("mouseleave", onU); cv.removeEventListener("wheel", onW); cv.removeEventListener("touchstart", onD); cv.removeEventListener("touchmove", onM); cv.removeEventListener("touchend", onU); ren.dispose(); };
  }, [W, D, H, c.nP, c.pp, c.postSize, c.beamSize, c.sp, c.fDiam, p.deckingType, p.hasStairs, p.stairTemplate, p.stairWidth, p.numStringers, p.stairAnchorX, p.stairAnchorY, p.stairAngle, p.stairLocation, p.stairOffset, p.stairRunSplit, p.stairLandingDepth, p.stairGap, p.height]);

  return <div ref={ref} style={{ width: "100%", height: 380, borderRadius: 6, overflow: "hidden" }} />;
}

window.Deck3D = Deck3D;


// ============================================================
// capture3D — PDF cover image render using shared scene builder
// Exported as window.capture3D(p, c) → Promise<base64 string | null>
// ============================================================
window.capture3D = function(p, c) {
  return new Promise(function(resolve) {
    try {
      if (typeof THREE === 'undefined') { resolve(null); return; }
      var w = 800, h = 500;
      var W = c.W, D = c.D, H = c.H;

      // Offscreen renderer
      var scene = new THREE.Scene(); scene.background = new THREE.Color(0xf5f2eb);
      scene.fog = new THREE.Fog(0xf5f2eb, 60, 120);
      var cam = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
      var ren = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      ren.setSize(w, h); ren.setPixelRatio(1);
      ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      var sun = new THREE.DirectionalLight(0xfff5e0, 0.8); sun.position.set(20, 30, 15); sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
      scene.add(sun);
      var fill = new THREE.DirectionalLight(0xc0d0ff, 0.3); fill.position.set(-10, 15, -10); scene.add(fill);

      // Ground + grid
      var gnd = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0xb8c9a0, roughness: 1 }));
      gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; scene.add(gnd);
      var grid = new THREE.GridHelper(80, 80, 0xa0b088, 0xa8b890); grid.position.y = 0.01; scene.add(grid);

      // Deck scene — shared builder
      var result = window.buildDeckScene(scene, p, c, THREE);

      // Smart camera: angle depends on stair exit side so stairs are visible
      // theta=0.7 puts camera at front-right (positive X, positive Z) — proven good default
      var maxDim = Math.max(W, D, H * 2, p.houseWidth || 30);
      var dist = maxDim * 1.6;
      var phi = 0.55;
      var theta;
      switch (result.exitSide) {
        case "right": theta = 0.3;  break;  // shift right to see right-exit stairs
        case "left":  theta = 1.1;  break;  // shift left to see left-exit stairs
        case "back":  theta = 3.84; break;  // opposite side (0.7 + PI)
        default:      theta = 0.7;  break;  // front or no stairs — matches old capture3D
      }
      var lookY = H * 0.6;
      cam.position.set(
        dist * Math.sin(phi) * Math.cos(theta),
        dist * Math.cos(phi) + lookY,
        dist * Math.sin(phi) * Math.sin(theta)
      );
      cam.lookAt(0, lookY, 0);

      // Render + export
      ren.render(scene, cam);
      var dataUrl = ren.domElement.toDataURL("image/jpeg", 0.85);
      ren.dispose();
      resolve(dataUrl.split(",")[1]);
    } catch (e) { console.warn("3D capture failed:", e); resolve(null); }
  });
};
