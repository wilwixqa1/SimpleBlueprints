// ============================================================
// DECK 3D — Three.js interactive preview + capture3D for PDF cover
// Shared scene builder: buildDeckScene(scene, p, c, THREE)
// S20: Multi-zone support — iterates additive zones, cutouts, exposed edges
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

  // ── S20: Build pForZones alias for zoneUtils compatibility ──
  var pForZones = Object.assign({}, p, {
    deckWidth: p.width || W, deckDepth: p.depth || D, deckHeight: p.height || H
  });
  var hasZones = pForZones.zones && pForZones.zones.length > 0;

  // ── S20: Get zone geometry from zoneUtils ──
  var addRects = hasZones ? window.getAdditiveRects(pForZones) : [{ id: 0, zone: { type: "add" }, rect: { x: 0, y: 0, w: W, d: D } }];
  var composite = hasZones ? window.getCompositeOutline(pForZones) : [{ x: 0, y: 0, w: W, d: D }];
  var exposedEdges = hasZones ? window.getExposedEdges(pForZones) : [];
  var bbox = hasZones ? window.getBoundingBox(pForZones) : { x: 0, y: 0, w: W, d: D };

  // ── S20: World offset — center bounding box at origin ──
  var cx = -bbox.w / 2 - bbox.x, cz = -bbox.d / 2 - bbox.y;

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

  var isLedger = c.attachment === "ledger";

  // ── Stair setup (zone 0 only) ──
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

  // Zone 0 world-space origin for stair gap calculations
  var z0wx = cx + 0, z0wz = cz + 0; // zone 0 rect is at (0,0)

  var stairClipD = 0;
  if (hasSt && stPl && sg && sg.runs.length > 0) {
    if (exitSide === "front") {
      stairClipD = Math.max(0, (z0wz + D) - (z0wz + stPl.anchorY));
      var gc = z0wx + stPl.anchorX;
      var sxMin = gc - stW / 2, sxMax = gc + stW / 2;
      if (sxMax > z0wx && sxMin < z0wx + W) {
        frontGap = { min: Math.max(sxMin, z0wx), max: Math.min(sxMax, z0wx + W),
          zMin: z0wz + stPl.anchorY, zMax: Math.min(z0wz + D, z0wz + stPl.anchorY + (sg.bbox ? sg.bbox.h : D)) };
      }
    } else if (exitSide === "right") {
      stairClipD = Math.max(0, (z0wx + W) - (z0wx + stPl.anchorX));
      var gc = z0wz + stPl.anchorY;
      var szMin = gc - stW / 2, szMax = gc + stW / 2;
      if (szMax > z0wz && szMin < z0wz + D) {
        rightGap = { min: Math.max(szMin, z0wz), max: Math.min(szMax, z0wz + D),
          xMin: z0wx + stPl.anchorX,
          xMax: Math.min(z0wx + W, z0wx + stPl.anchorX + (sg.bbox ? sg.bbox.h : W)) };
      }
    } else if (exitSide === "left") {
      stairClipD = Math.max(0, (z0wx + stPl.anchorX) - z0wx);
      var gc = z0wz + stPl.anchorY;
      var szMin = gc - stW / 2, szMax = gc + stW / 2;
      if (szMax > z0wz && szMin < z0wz + D) {
        leftGap = { min: Math.max(szMin, z0wz), max: Math.min(szMax, z0wz + D),
          xMin: Math.max(z0wx, z0wx + stPl.anchorX - (sg.bbox ? sg.bbox.h : W)),
          xMax: z0wx + stPl.anchorX };
      }
    }
  }
  var leftAtEdge = leftGap && leftGap.xMin <= z0wx + 0.1;
  var rightAtEdge = rightGap && rightGap.xMax >= z0wx + W - 0.1;

  // Helper: check if a world-space point is inside zone 0
  function inZone0(wx, wz) {
    return wx >= z0wx - 0.01 && wx <= z0wx + W + 0.01 && wz >= z0wz - 0.01 && wz <= z0wz + D + 0.01;
  }

  // ── House (anchored to zone 0) ──
  var hW = p.houseWidth, hD = 14, hH = Math.max(H + 8, 12);
  var dOff = p.deckOffset || 0;
  var hX = z0wx + (W - hW) / 2 - dOff, hZ = z0wz - hD;
  var hm = new THREE.Mesh(new THREE.BoxGeometry(hW, hH, hD), mats.house); hm.position.set(hX + hW / 2, hH / 2, hZ + hD / 2); hm.castShadow = true; scene.add(hm);
  var ov = 1.5, rpk = 5;
  var rx1 = hX - ov, rx2 = hX + hW + ov, rxM = hX + hW / 2, ry = hH, ryP = hH + rpk, rz1 = hZ - 1, rz2 = hZ + hD + 1;
  var rv = new Float32Array([rx1,ry,rz2,rx2,ry,rz2,rxM,ryP,rz2, rx2,ry,rz1,rx1,ry,rz1,rxM,ryP,rz1, rx1,ry,rz1,rx1,ry,rz2,rxM,ryP,rz2,rx1,ry,rz1,rxM,ryP,rz2,rxM,ryP,rz1, rx2,ry,rz2,rx2,ry,rz1,rxM,ryP,rz1,rx2,ry,rz2,rxM,ryP,rz1,rxM,ryP,rz2, rx1,ry,rz1,rx2,ry,rz1,rx2,ry,rz2,rx1,ry,rz1,rx2,ry,rz2,rx1,ry,rz2]);
  var rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rv, 3)); rg.computeVertexNormals();
  scene.add(new THREE.Mesh(rg, mats.roof));
  for (var wx = 0.2; wx < 0.9; wx += 0.3) { scene.add(new THREE.Mesh(new THREE.PlaneGeometry(3, 4), mats.win)).position.set(hX + hW * wx, H + 5, hZ + hD + 0.05); }
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(4, 6.5), mats.win)).position.set(hX + hW / 2, H - 6.5 / 2 + 6.7, z0wz + 0.05);

  // ── S20: Structure per zone (piers, posts, beams, joists) ──
  var pR = (fDiam / 12) / 2, pD = postSize === "6x6" ? 5.5 / 12 : 3.5 / 12;
  var bH2 = 11.875 / 12, bW2 = beamSize.includes("3") ? 5.25 / 12 : 3.5 / 12;
  var jH2 = 9.25 / 12, jW2 = 1.5 / 12;

  addRects.forEach(function(ar) {
    var zr = ar.rect;
    var zwx = cx + zr.x;  // zone world X
    var zwz = cz + zr.y;  // zone world Z
    var zW = zr.w;         // zone width
    var zD = zr.d;         // zone depth
    var isZ0 = ar.id === 0;
    var zH = H; // TODO Phase 3: per-zone height from zone.h

    // For zone 0, use the existing calc's post positions; for other zones, generate basic posts
    if (isZ0) {
      // ── Zone 0: Piers + Posts + Caps (existing logic with stair gap filtering) ──
      var filteredPP = pp.filter(function(px) {
        var wpx = z0wx + px;
        if (frontGap) {
          if (wpx > frontGap.min - 0.5 && wpx < frontGap.max + 0.5) return false;
        }
        if (leftGap) {
          var wz2 = z0wz + D - 1.5;
          if (wz2 > leftGap.min - 0.5 && wz2 < leftGap.max + 0.5 && wpx > leftGap.xMin - 0.5 && wpx < leftGap.xMax + 0.5) return false;
        }
        if (rightGap) {
          var wz2 = z0wz + D - 1.5;
          if (wz2 > rightGap.min - 0.5 && wz2 < rightGap.max + 0.5 && wpx > rightGap.xMin - 0.5 && wpx < rightGap.xMax + 0.5) return false;
        }
        return true;
      });
      filteredPP.forEach(function(px) {
        scene.add(new THREE.Mesh(new THREE.CylinderGeometry(pR, pR, 0.5, 16), mats.concrete)).position.set(z0wx + px, 0.25, z0wz + D - 1.5);
        var po = new THREE.Mesh(new THREE.BoxGeometry(pD, zH, pD), mats.post); po.position.set(z0wx + px, zH / 2, z0wz + D - 1.5); po.castShadow = true; scene.add(po);
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(pD + 0.2, 0.15, pD + 0.2), mats.metal)).position.set(z0wx + px, zH, z0wz + D - 1.5);
      });

      // ── Zone 0: Beam (with stair gap split) ──
      if (frontGap && stairClipD > 1.5 && frontGap.zMax > z0wz + D - 2) {
        var bL = frontGap.min - (z0wx + 1);
        var bR2 = (z0wx + W - 1) - frontGap.max;
        if (bL > 0.1) { var bmL = new THREE.Mesh(new THREE.BoxGeometry(bL, bH2, bW2), mats.beam); bmL.position.set(z0wx + 1 + bL / 2, zH - bH2 / 2 - 0.1, z0wz + D - 1.5); bmL.castShadow = true; scene.add(bmL); }
        if (bR2 > 0.1) { var bmR = new THREE.Mesh(new THREE.BoxGeometry(bR2, bH2, bW2), mats.beam); bmR.position.set(frontGap.max + bR2 / 2, zH - bH2 / 2 - 0.1, z0wz + D - 1.5); bmR.castShadow = true; scene.add(bmR); }
      } else {
        var bm = new THREE.Mesh(new THREE.BoxGeometry(W - 2, bH2, bW2), mats.beam); bm.position.set(z0wx + W / 2, zH - bH2 / 2 - 0.1, z0wz + D - 1.5); bm.castShadow = true; scene.add(bm);
      }

      // ── Zone 0: Ledger ──
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(W, 9.25 / 12, 1.5 / 12), mats.joist)).position.set(z0wx + W / 2, zH - 0.4, z0wz + 0.06);

      // ── Zone 0: Joists (with stair gap splits) ──
      var jLen = D - 1.5;
      for (var x = sp / 12; x < W; x += sp / 12) {
        var jx = z0wx + x;
        if (frontGap && stairClipD > 0.5 && jx > frontGap.min + 0.05 && jx < frontGap.max - 0.05) {
          var jSeg1 = frontGap.zMin - z0wz;
          if (jSeg1 > 0.2) { scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jSeg1), mats.joist)).position.set(jx, zH - jH2 / 2 - 0.1, z0wz + jSeg1 / 2); }
          var jSeg2 = (z0wz + D - 1.5) - frontGap.zMax;
          if (jSeg2 > 0.2) { scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jSeg2), mats.joist)).position.set(jx, zH - jH2 / 2 - 0.1, frontGap.zMax + jSeg2 / 2); }
          continue;
        }
        if (leftGap && jx > leftGap.xMin + 0.05 && jx < leftGap.xMax - 0.05) {
          var jSeg1 = leftGap.min - z0wz;
          if (jSeg1 > 0.2) { scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jSeg1), mats.joist)).position.set(jx, zH - jH2 / 2 - 0.1, z0wz + jSeg1 / 2); }
          var jSeg2 = (z0wz + D - 1.5) - leftGap.max;
          if (jSeg2 > 0.2) { scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jSeg2), mats.joist)).position.set(jx, zH - jH2 / 2 - 0.1, leftGap.max + jSeg2 / 2); }
          continue;
        }
        if (rightGap && jx > rightGap.xMin + 0.05 && jx < rightGap.xMax - 0.05) {
          var jSeg1 = rightGap.min - z0wz;
          if (jSeg1 > 0.2) { scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jSeg1), mats.joist)).position.set(jx, zH - jH2 / 2 - 0.1, z0wz + jSeg1 / 2); }
          var jSeg2 = (z0wz + D - 1.5) - rightGap.max;
          if (jSeg2 > 0.2) { scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jSeg2), mats.joist)).position.set(jx, zH - jH2 / 2 - 0.1, rightGap.max + jSeg2 / 2); }
          continue;
        }
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, jLen), mats.joist)).position.set(jx, zH - jH2 / 2 - 0.1, z0wz + jLen / 2);
      }

      // ── Zone 0: Rim joists (with stair gaps) ──
      function addRimSeg(x, y, z, w, h, d) { scene.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.joist)).position.set(x, y, z); }
      if (frontGap && frontGap.zMax >= z0wz + D - 0.1) {
        var lw = frontGap.min - z0wx, rw = (z0wx + W) - frontGap.max;
        if (lw > 0.1) addRimSeg(z0wx + lw / 2, zH - jH2 / 2 - 0.1, z0wz + D, lw, jH2, jW2);
        if (rw > 0.1) addRimSeg(frontGap.max + rw / 2, zH - jH2 / 2 - 0.1, z0wz + D, rw, jH2, jW2);
      } else { addRimSeg(z0wx + W / 2, zH - jH2 / 2 - 0.1, z0wz + D, W, jH2, jW2); }
      if (leftAtEdge) {
        var s1 = leftGap.min - z0wz, s2 = (z0wz + D) - leftGap.max;
        if (s1 > 0.1) addRimSeg(z0wx, zH - jH2 / 2 - 0.1, z0wz + s1 / 2, jW2, jH2, s1);
        if (s2 > 0.1) addRimSeg(z0wx, zH - jH2 / 2 - 0.1, leftGap.max + s2 / 2, jW2, jH2, s2);
      } else { addRimSeg(z0wx, zH - jH2 / 2 - 0.1, z0wz + D / 2, jW2, jH2, D); }
      if (rightAtEdge) {
        var s1 = rightGap.min - z0wz, s2 = (z0wz + D) - rightGap.max;
        if (s1 > 0.1) addRimSeg(z0wx + W, zH - jH2 / 2 - 0.1, z0wz + s1 / 2, jW2, jH2, s1);
        if (s2 > 0.1) addRimSeg(z0wx + W, zH - jH2 / 2 - 0.1, rightGap.max + s2 / 2, jW2, jH2, s2);
      } else { addRimSeg(z0wx + W, zH - jH2 / 2 - 0.1, z0wz + D / 2, jW2, jH2, D); }

    } else {
      // ── Zones 1+: Simplified structure (posts at corners, beam along far edge, joists) ──
      var zonePostInset = 0.75; // Inset posts from zone edges

      // Posts at 4 corners of zone
      var zCorners = [
        [zwx + zonePostInset, zwz + zonePostInset],
        [zwx + zW - zonePostInset, zwz + zonePostInset],
        [zwx + zonePostInset, zwz + zD - zonePostInset],
        [zwx + zW - zonePostInset, zwz + zD - zonePostInset]
      ];
      // Add intermediate posts if zone is wide (every ~6ft)
      var postSpacing = 6;
      for (var px2 = zonePostInset + postSpacing; px2 < zW - zonePostInset; px2 += postSpacing) {
        zCorners.push([zwx + px2, zwz + zD - zonePostInset]);
      }
      zCorners.forEach(function(pt) {
        scene.add(new THREE.Mesh(new THREE.CylinderGeometry(pR, pR, 0.5, 16), mats.concrete)).position.set(pt[0], 0.25, pt[1]);
        var po = new THREE.Mesh(new THREE.BoxGeometry(pD, zH, pD), mats.post); po.position.set(pt[0], zH / 2, pt[1]); po.castShadow = true; scene.add(po);
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(pD + 0.2, 0.15, pD + 0.2), mats.metal)).position.set(pt[0], zH, pt[1]);
      });

      // Beam along far edge (front edge of zone, furthest from house)
      var beamLen = zW - 2 * zonePostInset;
      if (beamLen > 0.1) {
        var bmZ = new THREE.Mesh(new THREE.BoxGeometry(beamLen, bH2, bW2), mats.beam);
        bmZ.position.set(zwx + zW / 2, zH - bH2 / 2 - 0.1, zwz + zD - zonePostInset);
        bmZ.castShadow = true; scene.add(bmZ);
      }

      // Joists spanning depth of zone
      var zJLen = zD - 1;
      for (var zx2 = sp / 12; zx2 < zW; zx2 += sp / 12) {
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, zJLen), mats.joist)).position.set(zwx + zx2, zH - jH2 / 2 - 0.1, zwz + zJLen / 2 + 0.5);
      }

      // Rim joists on 3 exposed sides (not the attachment edge which connects to parent)
      var zone = ar.zone;
      var attachEdge = zone.attachEdge;
      // Front rim (far from house, high Y)
      if (attachEdge !== "front") {
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(zW, jH2, jW2), mats.joist)).position.set(zwx + zW / 2, zH - jH2 / 2 - 0.1, zwz + zD);
      }
      // Back rim (near house, low Y) — usually the attachment edge for front-attached zones
      if (attachEdge !== "back") {
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(zW, jH2, jW2), mats.joist)).position.set(zwx + zW / 2, zH - jH2 / 2 - 0.1, zwz);
      }
      // Left rim
      if (attachEdge !== "left") {
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, zD), mats.joist)).position.set(zwx, zH - jH2 / 2 - 0.1, zwz + zD / 2);
      }
      // Right rim
      if (attachEdge !== "right") {
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, zD), mats.joist)).position.set(zwx + zW, zH - jH2 / 2 - 0.1, zwz + zD / 2);
      }
    }
  });

  // ── S20: Chamfer data for 3D board trimming ──
  var chamferZones = [];
  addRects.forEach(function(ar) {
    var zr = ar.rect;
    var corners = (ar.id === 0) ? (p.mainCorners || {}) : (ar.zone.corners || {});
    var hasChamfer = ["BL","BR","FL","FR"].some(function(k) {
      return corners[k] && corners[k].type === "chamfer" && corners[k].size > 0;
    });
    if (hasChamfer) {
      chamferZones.push({ wx: cx + zr.x, wz: cz + zr.y, w: zr.w, d: zr.d, corners: corners });
    }
  });

  function clipBoardForChamfers(boardWX, zStart, zEnd) {
    for (var ci = 0; ci < chamferZones.length; ci++) {
      var cz2 = chamferZones[ci];
      if (boardWX < cz2.wx - 0.01 || boardWX > cz2.wx + cz2.w + 0.01) continue;
      var lx2 = boardWX - cz2.wx;
      var bl = cz2.corners.BL && cz2.corners.BL.type === "chamfer" ? cz2.corners.BL.size : 0;
      if (bl > 0 && lx2 < bl) zStart = Math.max(zStart, cz2.wz + (bl - lx2));
      var br = cz2.corners.BR && cz2.corners.BR.type === "chamfer" ? cz2.corners.BR.size : 0;
      if (br > 0 && (cz2.w - lx2) < br) zStart = Math.max(zStart, cz2.wz + (br - (cz2.w - lx2)));
      var fl = cz2.corners.FL && cz2.corners.FL.type === "chamfer" ? cz2.corners.FL.size : 0;
      if (fl > 0 && lx2 < fl) zEnd = Math.min(zEnd, cz2.wz + cz2.d - (fl - lx2));
      var fr = cz2.corners.FR && cz2.corners.FR.type === "chamfer" ? cz2.corners.FR.size : 0;
      if (fr > 0 && (cz2.w - lx2) < fr) zEnd = Math.min(zEnd, cz2.wz + cz2.d - (fr - (cz2.w - lx2)));
    }
    return { zStart: zStart, zEnd: zEnd };
  }

  function addDeckBoard(bx2, zStart, zEnd) {
    var clip = clipBoardForChamfers(bx2, zStart, zEnd);
    var len = clip.zEnd - clip.zStart;
    if (len < 0.1) return;
    var b = new THREE.Mesh(new THREE.BoxGeometry(bdW - 0.02, bdH, len), mats.deck);
    b.position.set(bx2, H + bdH / 2, clip.zStart + len / 2);
    b.receiveShadow = true; scene.add(b);
  }

  // ── S20: Decking boards — iterate over composite outline rects ──
  var bdW = 5.5 / 12, bdH = 1 / 12;
  composite.forEach(function(cr) {
    var crwx = cx + cr.x;  // composite rect world X
    var crwz = cz + cr.y;  // composite rect world Z
    var crW = cr.w;
    var crD = cr.d;

    for (var lx = bdW / 2; lx < crW; lx += bdW) {
      var bx = crwx + lx;

      // Check if this board X falls within zone 0 and has a stair gap
      if (inZone0(bx, z0wz + D / 2)) {
        if (frontGap && stairClipD > 0.1 && bx > frontGap.min + 0.02 && bx < frontGap.max - 0.02) {
          addDeckBoard(bx, crwz, frontGap.zMin);
          addDeckBoard(bx, Math.max(crwz, frontGap.zMax), crwz + crD);
          continue;
        }
        if (leftGap && bx > leftGap.xMin + 0.02 && bx < leftGap.xMax - 0.02) {
          addDeckBoard(bx, crwz, leftGap.min);
          addDeckBoard(bx, Math.max(crwz, leftGap.max), crwz + crD);
          continue;
        }
        if (rightGap && bx > rightGap.xMin + 0.02 && bx < rightGap.xMax - 0.02) {
          addDeckBoard(bx, crwz, rightGap.min);
          addDeckBoard(bx, Math.max(crwz, rightGap.max), crwz + crD);
          continue;
        }
      }

      // No gap — full board for this composite rect
      addDeckBoard(bx, crwz, crwz + crD);
    }
  });

  // ── S20: Railing — from exposed edges (multi-zone) or hardcoded (single-zone) ──
  var rH = 3, trY = H + bdH + rH, brY = H + bdH + 0.25;
  var railTopW = 0.18, railBotW = 0.12, balW = 0.07, balSp = 0.5, postW = 0.3;
  var railZStart = isLedger ? cz + 0.3 : cz;

  function addRail(x1, z1, x2, z2) {
    var dx2 = x2 - x1, dz2 = z2 - z1;
    var len = Math.sqrt(dx2 * dx2 + dz2 * dz2);
    if (len < 0.05) return;
    var mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    var isX = Math.abs(dz2) < 0.01;
    var topG = isX ? new THREE.BoxGeometry(len, railTopW, railTopW) : new THREE.BoxGeometry(railTopW, railTopW, len);
    var topM = new THREE.Mesh(topG, mats.rail); topM.position.set(mx, trY, mz); scene.add(topM);
    var botG = isX ? new THREE.BoxGeometry(len, railBotW, railBotW) : new THREE.BoxGeometry(railBotW, railBotW, len);
    var botM = new THREE.Mesh(botG, mats.rail); botM.position.set(mx, brY, mz); scene.add(botM);
    var balG = new THREE.BoxGeometry(balW, rH - 0.3, balW);
    var n = Math.max(1, Math.floor(len / balSp));
    for (var i = 0; i <= n; i++) {
      var t = n > 0 ? i / n : 0.5;
      var bm = new THREE.Mesh(balG, mats.rail);
      bm.position.set(x1 + dx2 * t, H + bdH + rH / 2 + 0.1, z1 + dz2 * t);
      scene.add(bm);
    }
  }

  function addRailPost(px, pz) {
    var pm = new THREE.Mesh(new THREE.BoxGeometry(postW, rH + 0.3, postW), mats.rail);
    pm.position.set(px, H + bdH + rH / 2, pz);
    scene.add(pm);
  }

  if (hasZones) {
    // ── S20: Multi-zone railing from exposed edges ──
    exposedEdges.forEach(function(e) {
      var ex1 = cx + e.x1, ey1 = cz + e.y1, ex2 = cx + e.x2, ey2 = cz + e.y2;

      // Check if this edge overlaps a stair gap on zone 0
      if (e.dir === "h") {
        // Horizontal edge — check front gap
        if (frontGap && Math.abs(ey1 - (z0wz + D)) < 0.1) {
          // This edge is on zone 0's front — split around stair gap
          if (ex1 < frontGap.min - 0.05) addRail(ex1, ey1, Math.min(ex2, frontGap.min), ey1);
          if (ex2 > frontGap.max + 0.05) addRail(Math.max(ex1, frontGap.max), ey1, ex2, ey1);
          if (frontGap.min > ex1 + 0.1) addRailPost(frontGap.min, ey1);
          if (frontGap.max < ex2 - 0.1) addRailPost(frontGap.max, ey1);
          return;
        }
      } else {
        // Vertical edge — check left/right gap
        if (leftAtEdge && Math.abs(ex1 - z0wx) < 0.1) {
          if (ey1 < leftGap.min - 0.05) addRail(ex1, ey1, ex1, Math.min(ey2, leftGap.min));
          if (ey2 > leftGap.max + 0.05) addRail(ex1, Math.max(ey1, leftGap.max), ex1, ey2);
          if (leftGap.min > ey1 + 0.1) addRailPost(ex1, leftGap.min);
          if (leftGap.max < ey2 - 0.1) addRailPost(ex1, leftGap.max);
          return;
        }
        if (rightAtEdge && Math.abs(ex1 - (z0wx + W)) < 0.1) {
          if (ey1 < rightGap.min - 0.05) addRail(ex1, ey1, ex1, Math.min(ey2, rightGap.min));
          if (ey2 > rightGap.max + 0.05) addRail(ex1, Math.max(ey1, rightGap.max), ex1, ey2);
          if (rightGap.min > ey1 + 0.1) addRailPost(ex1, rightGap.min);
          if (rightGap.max < ey2 - 0.1) addRailPost(ex1, rightGap.max);
          return;
        }
      }

      // No stair gap on this edge — full railing
      addRail(ex1, ey1, ex2, ey2);
    });

    // Corner posts at composite outline corners
    var outlineCorners = {};
    exposedEdges.forEach(function(e) {
      var k1 = (cx + e.x1).toFixed(2) + "," + (cz + e.y1).toFixed(2);
      var k2 = (cx + e.x2).toFixed(2) + "," + (cz + e.y2).toFixed(2);
      outlineCorners[k1] = [cx + e.x1, cz + e.y1];
      outlineCorners[k2] = [cx + e.x2, cz + e.y2];
    });
    Object.keys(outlineCorners).forEach(function(k) {
      addRailPost(outlineCorners[k][0], outlineCorners[k][1]);
    });

  } else {
    // ── Single-zone: original hardcoded railing (unchanged) ──
    if (frontGap && frontGap.zMax >= z0wz + D - 0.1) {
      if (frontGap.min - z0wx > 0.1) addRail(z0wx, z0wz + D, frontGap.min, z0wz + D);
      if ((z0wx + W) - frontGap.max > 0.1) addRail(frontGap.max, z0wz + D, z0wx + W, z0wz + D);
      addRailPost(frontGap.min, z0wz + D);
      addRailPost(frontGap.max, z0wz + D);
    } else {
      addRail(z0wx, z0wz + D, z0wx + W, z0wz + D);
    }

    if (leftAtEdge) {
      if (leftGap.min - (isLedger ? z0wz + 0.3 : z0wz) > 0.1) addRail(z0wx, isLedger ? z0wz + 0.3 : z0wz, z0wx, leftGap.min);
      if ((z0wz + D) - leftGap.max > 0.1) addRail(z0wx, leftGap.max, z0wx, z0wz + D);
      addRailPost(z0wx, leftGap.min);
      addRailPost(z0wx, leftGap.max);
    } else {
      addRail(z0wx, isLedger ? z0wz + 0.3 : z0wz, z0wx, z0wz + D);
    }

    if (rightAtEdge) {
      if (rightGap.min - (isLedger ? z0wz + 0.3 : z0wz) > 0.1) addRail(z0wx + W, isLedger ? z0wz + 0.3 : z0wz, z0wx + W, rightGap.min);
      if ((z0wz + D) - rightGap.max > 0.1) addRail(z0wx + W, rightGap.max, z0wx + W, z0wz + D);
      addRailPost(z0wx + W, rightGap.min);
      addRailPost(z0wx + W, rightGap.max);
    } else {
      addRail(z0wx + W, isLedger ? z0wz + 0.3 : z0wz, z0wx + W, z0wz + D);
    }

    var cornerPosts = isLedger
      ? [[z0wx, z0wz + D], [z0wx + W, z0wz + D]]
      : [[z0wx, z0wz], [z0wx + W, z0wz], [z0wx, z0wz + D], [z0wx + W, z0wz + D]];
    cornerPosts.forEach(function(pt) { addRailPost(pt[0], pt[1]); });
  }

  // ── Stairs 3D (zone 0 only — unchanged) ──
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
        var railW2 = V_RAIL_W;
        var trLen = Math.sqrt(hDist * hDist + vDist * vDist);
        if (ri === 0) trLen = trLen * 0.85;
        var trG = isHoriz
          ? new THREE.BoxGeometry(railW2, railW2, trLen)
          : new THREE.BoxGeometry(trLen, railW2, railW2);
        var trM = new THREE.Mesh(trG, mats.rail);
        if (isHoriz) {
          trM.position.set(ePos, midY + stRailH, midHZ);
          trM.rotation.x = dsz > 0 ? sAng : -sAng;
        } else {
          trM.position.set(midHX, midY + stRailH, ePos);
          trM.rotation.z = dsx > 0 ? -sAng : sAng;
        }
        stGrp.add(trM);

        var postSpacing2 = Math.max(1, Math.floor(run.treads / 3));
        for (var pi = 0; pi <= run.treads; pi += postSpacing2) {
          var stepIdx = Math.min(pi, run.treads - 1);
          var postBaseY = topElev - (stepIdx + 1) * riseFt + treadTh;
          var postX = isHoriz ? ePos : sx + dsx * treadFt * (stepIdx + 0.5);
          var postZ = isHoriz ? sz + dsz * treadFt * (stepIdx + 0.5) : ePos;
          var pm = new THREE.Mesh(
            new THREE.BoxGeometry(railW2, stRailH, railW2), mats.rail
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
      var lSurf = lElev + treadTh;

      var platM = new THREE.Mesh(
        new THREE.BoxGeometry(lr.w, treadTh * 2, lr.h), mats.deck
      );
      platM.position.set(lr.x + lr.w / 2, lElev + treadTh, lr.y + lr.h / 2);
      platM.receiveShadow = true; platM.castShadow = true;
      stGrp.add(platM);

      var lpSz = postSize === "6x6" ? 5.5 / 12 : 3.5 / 12;
      var lCorners = [
        [lr.x + lpSz / 2, lr.y + lpSz / 2],
        [lr.x + lr.w - lpSz / 2, lr.y + lpSz / 2],
        [lr.x + lpSz / 2, lr.y + lr.h - lpSz / 2],
        [lr.x + lr.w - lpSz / 2, lr.y + lr.h - lpSz / 2]
      ];
      lCorners.forEach(function(pt) {
        var lpm = new THREE.Mesh(new THREE.BoxGeometry(lpSz, lElev, lpSz), mats.post);
        lpm.position.set(pt[0], lElev / 2, pt[1]);
        lpm.castShadow = true;
        stGrp.add(lpm);
        var pier = new THREE.Mesh(new THREE.CylinderGeometry(pR, pR, 0.35, 12), mats.concrete);
        pier.position.set(pt[0], 0.175, pt[1]);
        stGrp.add(pier);
      });

      var runBefore = sg.runs[li];
      var runAfter = sg.runs[li + 1];
      var adjRuns = [runBefore];
      if (runAfter) adjRuns.push(runAfter);

      var landingEdges = [
        { name: 'minY', x1: lr.x, z1: lr.y,        x2: lr.x + lr.w, z2: lr.y },
        { name: 'maxY', x1: lr.x, z1: lr.y + lr.h,  x2: lr.x + lr.w, z2: lr.y + lr.h },
        { name: 'minX', x1: lr.x, z1: lr.y,          x2: lr.x,        z2: lr.y + lr.h },
        { name: 'maxX', x1: lr.x + lr.w, z1: lr.y,   x2: lr.x + lr.w, z2: lr.y + lr.h }
      ];

      var lrTol = 0.3;
      landingEdges.forEach(function(edge) {
        var connected = false;
        adjRuns.forEach(function(run) {
          if (!run) return;
          var rr = run.rect;
          if (edge.name === 'minY' && Math.abs(rr.y + rr.h - lr.y) < lrTol && rr.x + rr.w > lr.x + lrTol && rr.x < lr.x + lr.w - lrTol) connected = true;
          if (edge.name === 'maxY' && Math.abs(rr.y - (lr.y + lr.h)) < lrTol && rr.x + rr.w > lr.x + lrTol && rr.x < lr.x + lr.w - lrTol) connected = true;
          if (edge.name === 'minX' && Math.abs(rr.x + rr.w - lr.x) < lrTol && rr.y + rr.h > lr.y + lrTol && rr.y < lr.y + lr.h - lrTol) connected = true;
          if (edge.name === 'maxX' && Math.abs(rr.x - (lr.x + lr.w)) < lrTol && rr.y + rr.h > lr.y + lrTol && rr.y < lr.y + lr.h - lrTol) connected = true;
        });

        if (!connected) {
          var ex1 = edge.x1, ez1 = edge.z1, ex2 = edge.x2, ez2 = edge.z2;
          var edx = ex2 - ex1, edz = ez2 - ez1;
          var eLen = Math.sqrt(edx * edx + edz * edz);
          if (eLen < 0.1) return;
          var emx = (ex1 + ex2) / 2, emz = (ez1 + ez2) / 2;
          var isHEdge = Math.abs(edz) < 0.01;
          var lrH = 3.0;

          var lTopG = isHEdge ? new THREE.BoxGeometry(eLen, 0.15, 0.15) : new THREE.BoxGeometry(0.15, 0.15, eLen);
          var lTopM = new THREE.Mesh(lTopG, mats.rail);
          lTopM.position.set(emx, lSurf + lrH, emz);
          stGrp.add(lTopM);

          var lBotG = isHEdge ? new THREE.BoxGeometry(eLen, 0.1, 0.1) : new THREE.BoxGeometry(0.1, 0.1, eLen);
          var lBotM = new THREE.Mesh(lBotG, mats.rail);
          lBotM.position.set(emx, lSurf + 0.25, emz);
          stGrp.add(lBotM);

          var lBalG = new THREE.BoxGeometry(0.07, lrH - 0.3, 0.07);
          var lN = Math.max(1, Math.floor(eLen / 0.33));
          for (var bi = 0; bi <= lN; bi++) {
            var bt = lN > 0 ? bi / lN : 0.5;
            var lbm = new THREE.Mesh(lBalG, mats.rail);
            lbm.position.set(ex1 + edx * bt, lSurf + lrH / 2 + 0.1, ez1 + edz * bt);
            stGrp.add(lbm);
          }

          var lPostG = new THREE.BoxGeometry(0.2, lrH + 0.3, 0.2);
          var lp1 = new THREE.Mesh(lPostG, mats.rail);
          lp1.position.set(ex1, lSurf + lrH / 2, ez1);
          stGrp.add(lp1);
          var lp2 = new THREE.Mesh(lPostG, mats.rail);
          lp2.position.set(ex2, lSurf + lrH / 2, ez2);
          stGrp.add(lp2);
        }
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

    stGrp.position.set(z0wx + stPl.anchorX, 0, z0wz + stPl.anchorY);
    stGrp.rotation.y = (stPl.angle || 0) * Math.PI / 180;
    scene.add(stGrp);
  }

  return { exitSide: exitSide };
};


// ============================================================
// Deck3D — Interactive Three.js preview component
// S20: Added zones to dependency array
// ============================================================
function Deck3D({ c, p }) {
  const ref = _d3UR(null); const frameRef = _d3UR(null);
  const orbit = _d3UR(window._deckOrbit || { theta: -0.6, phi: 0.5, dist: 0, drag: false, lx: 0, ly: 0 });
  const { W, D, H } = c;

  _d3UE(() => {
    if (typeof THREE === 'undefined') return;
    const el = ref.current; if (!el) return;
    const cW = el.clientWidth || 500; const cH = el.clientHeight || 380;
    if (cW < 10) return;

    // Scene + renderer
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf5f2eb); scene.fog = new THREE.Fog(0xf5f2eb, 60, 120);
    const cam = new THREE.PerspectiveCamera(45, cW / cH, 0.1, 200);
    if (!window._deckOrbit) orbit.current.dist = Math.max(W, D, H * 2) * 1.8;
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
    return () => { cancelAnimationFrame(frameRef.current); cv.removeEventListener("mousedown", onD); cv.removeEventListener("mousemove", onM); cv.removeEventListener("mouseup", onU); cv.removeEventListener("mouseleave", onU); cv.removeEventListener("wheel", onW); cv.removeEventListener("touchstart", onD); cv.removeEventListener("touchmove", onM); cv.removeEventListener("touchend", onU); window._deckOrbit = { theta: orbit.current.theta, phi: orbit.current.phi, dist: orbit.current.dist, drag: false, lx: 0, ly: 0 }; ren.dispose(); };
  }, [W, D, H, c.nP, c.pp, c.postSize, c.beamSize, c.sp, c.fDiam, p.deckingType, p.hasStairs, p.stairTemplate, p.stairWidth, p.numStringers, p.stairAnchorX, p.stairAnchorY, p.stairAngle, p.stairLocation, p.stairOffset, p.stairRunSplit, p.stairLandingDepth, p.stairGap, p.height, p.deckOffset, p.houseWidth, p.zones]);

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
      var pForZones = Object.assign({}, p, {
        deckWidth: p.width || W, deckDepth: p.depth || D, deckHeight: p.height || H
      });
      var hasZones2 = pForZones.zones && pForZones.zones.length > 0;
      var bbox2 = hasZones2 ? window.getBoundingBox(pForZones) : { x: 0, y: 0, w: W, d: D };
      var maxDim = Math.max(bbox2.w, bbox2.d, H * 2, p.houseWidth || 30);
      var dist = maxDim * 1.6;
      var phi = 0.55;
      var theta;
      switch (result.exitSide) {
        case "right": theta = 0.5;  break;
        case "left":  theta = 0.9;  break;
        case "back":  theta = 3.84; break;
        default:      theta = 0.7;  break;
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
