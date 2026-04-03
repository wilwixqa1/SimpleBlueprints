// ============================================================
// DECK 3D   Three.js interactive preview + capture3D for PDF cover
// Shared scene builder: buildDeckScene(scene, p, c, THREE)
// S20: Multi-zone support   iterates additive zones, cutouts, exposed edges
// ============================================================
const { useEffect: _d3UE, useRef: _d3UR } = React;

// ============================================================
// setupSceneEnv   Shared environment setup (lights, ground, grid, slope)
// Used by both interactive Deck3D and capture3D to stay in sync
// ============================================================
function setupSceneEnv(scene, p, THREE) {
  // Background + fog
  scene.background = new THREE.Color(0xf5f2eb);
  scene.fog = new THREE.Fog(0xf5f2eb, 60, 120);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  var sun = new THREE.DirectionalLight(0xfff5e0, 0.8);
  sun.position.set(20, 30, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  scene.add(sun);
  var fill = new THREE.DirectionalLight(0xc0d0ff, 0.3);
  fill.position.set(-10, 15, -10);
  scene.add(fill);

  // Ground plane
  var gnd = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0xb8c9a0, roughness: 1 })
  );
  gnd.rotation.x = -Math.PI / 2;
  gnd.receiveShadow = true;

  // S34: Slope tilt (3x exaggerated for visual clarity)
  var sPct = (p.slopePercent || 0) / 100;
  var sDir = p.slopeDirection || "front-to-back";
  if (sPct > 0) {
    var tilt = Math.atan(sPct) * 3;
    if (sDir === "front-to-back") gnd.rotation.x += tilt;
    else if (sDir === "back-to-front") gnd.rotation.x -= tilt;
    else if (sDir === "left-to-right") gnd.rotation.z -= tilt;
    else if (sDir === "right-to-left") gnd.rotation.z += tilt;
  }
  scene.add(gnd);

  // Grid
  var grid = new THREE.GridHelper(80, 80, 0xa0b088, 0xa8b890);
  grid.position.y = sPct > 0 ? -0.3 : 0.01;
  scene.add(grid);
}

// ============================================================
// addHouse   Render house geometry (walls, roof, door)
// Config-driven for future adjustable house size
// ============================================================
function addHouse(scene, cfg, mats, THREE) {
  var hW = cfg.width;
  var hD = cfg.depth;
  var hH = cfg.height;
  var hX = cfg.x;
  var hZ = cfg.z;
  var deckH = cfg.deckHeight;

  // House body
  var hm = new THREE.Mesh(new THREE.BoxGeometry(hW, hH, hD), mats.house);
  hm.position.set(hX + hW / 2, hH / 2, hZ + hD / 2);
  hm.castShadow = true;
  scene.add(hm);

  // Gable roof
  var ov = 1.5, rpk = 5;
  var rx1 = hX - ov, rx2 = hX + hW + ov, rxM = hX + hW / 2;
  var ry = hH, ryP = hH + rpk;
  var rz1 = hZ - 1, rz2 = hZ + hD + 1;
  var rv = new Float32Array([
    rx1,ry,rz2, rx2,ry,rz2, rxM,ryP,rz2,
    rx2,ry,rz1, rx1,ry,rz1, rxM,ryP,rz1,
    rx1,ry,rz1, rx1,ry,rz2, rxM,ryP,rz2, rx1,ry,rz1, rxM,ryP,rz2, rxM,ryP,rz1,
    rx2,ry,rz2, rx2,ry,rz1, rxM,ryP,rz1, rx2,ry,rz2, rxM,ryP,rz1, rxM,ryP,rz2,
    rx1,ry,rz1, rx2,ry,rz1, rx2,ry,rz2, rx1,ry,rz1, rx2,ry,rz2, rx1,ry,rz2
  ]);
  var rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(rv, 3));
  rg.computeVertexNormals();
  scene.add(new THREE.Mesh(rg, mats.roof));

  // Deck access door (always present: the deck exists because of this door)
  if (cfg.showDoor !== false) {
    var doorW = cfg.doorWidth || 4;
    var doorH = cfg.doorHeight || 6.5;
    var doorX = cfg.doorX || (hX + hW / 2);
    // Clamp door within house wall bounds
    doorX = Math.max(hX + doorW / 2 + 0.2, Math.min(hX + hW - doorW / 2 - 0.2, doorX));
    var dm = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.15), mats.win);
    dm.position.set(doorX, deckH + doorH / 2 + 0.2, hZ + hD + 0.1);
    scene.add(dm);
  }

  // Upper windows (off by default; we don't know actual window positions)
  if (cfg.showWindows) {
    var winCount = cfg.windowCount || 3;
    for (var wi = 0; wi < winCount; wi++) {
      var wx = (wi + 1) / (winCount + 1);
      var wm = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.15), mats.win);
      wm.position.set(hX + hW * wx, deckH + 5, hZ + hD + 0.1);
      scene.add(wm);
    }
  }
}

// ============================================================
// buildDeckScene   shared scene population for Deck3D + capture3D
// Adds all deck geometry (house, structure, decking, railing, stairs)
// to the provided scene. Returns { exitSide } for camera positioning.
// ============================================================
window.buildDeckScene = function(scene, p, c, THREE) {
  var W = c.W, D = c.D, H = c.H, pp = c.pp, postSize = c.postSize,
      beamSize = c.beamSize, sp = c.sp, fDiam = c.fDiam;

// S20: Build pForZones alias for zoneUtils compatibility
  var pForZones = Object.assign({}, p, {
    deckWidth: p.width || W, deckDepth: p.depth || D, deckHeight: p.height || H
  });
  var hasZones = pForZones.zones && pForZones.zones.length > 0;

// S20: Get zone geometry from zoneUtils
  var addRects = hasZones ? window.getAdditiveRects(pForZones) : [{ id: 0, zone: { type: "add" }, rect: { x: 0, y: 0, w: W, d: D } }];
  var composite = hasZones ? window.getCompositeOutline(pForZones) : [{ x: 0, y: 0, w: W, d: D }];
  var exposedEdges = hasZones ? window.getExposedEdges(pForZones) : [];
  var bbox = hasZones ? window.getBoundingBox(pForZones) : { x: 0, y: 0, w: W, d: D };

// S20: World offset   center bounding box at origin
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
    win: new THREE.MeshStandardMaterial({ color: 0x90bcd4, roughness: 0.2, side: THREE.DoubleSide }),
    metal: new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.5 }),
    stairTread: new THREE.MeshStandardMaterial({ color: p.deckingType === "composite" ? 0x8B7355 : 0xc4a060, roughness: 0.65 }),
    stairRiser: new THREE.MeshStandardMaterial({ color: 0xd4b87a, roughness: 0.75 }),
    stringer: new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.7 }),
  };

  // Helper: create mesh, position it, add to scene (fixes scene.add().position.set() bug)
  function addM(geo, mat, x, y, z, shadow) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (shadow) m.castShadow = true;
    scene.add(m);
    return m;
  }

  var isLedger = c.attachment === "ledger";

// S64: Multi-stair setup -- resolve all stairs from deckStairs array
  var z0wx = cx + 0, z0wz = cz + 0; // zone 0 rect is at (0,0)

  var resolvedStairs = [];
  var allStairWBBs = [];
  (p.deckStairs || []).forEach(function(stairDef) {
    if (H <= 0.5) return;
    var zr = window.getZoneRect ? window.getZoneRect(stairDef.zoneId, pForZones) : null;
    if (!zr && stairDef.zoneId === 0) zr = { x: 0, y: 0, w: W, d: D };
    if (!zr) return;
    var _sg = window.computeStairGeometry({
      template: stairDef.template || "straight", height: H,
      stairWidth: stairDef.width || 4, numStringers: stairDef.numStringers || 3,
      runSplit: stairDef.runSplit ? stairDef.runSplit / 100 : null,
      landingDepth: stairDef.landingDepth || null,
      stairGap: stairDef.stairGap != null ? stairDef.stairGap : 0.5
    });
    if (!_sg) return;
    var _stPl = window.getStairPlacementForZone(stairDef, zr);
    var _exit = _stPl.angle === 90 ? "right" : _stPl.angle === 270 ? "left" : _stPl.angle === 180 ? "back" : "front";
    var _zwx = cx + zr.x, _zwz = cz + zr.y;
    var _wax = _zwx + _stPl.anchorX, _waz = _zwz + _stPl.anchorY;
    var _bb = _sg.bbox, _ang = _stPl.angle || 0, _wbb;
    if (_ang === 0)        _wbb = { xMin: _wax + _bb.minX, xMax: _wax + _bb.maxX, zMin: _waz + _bb.minY, zMax: _waz + _bb.maxY };
    else if (_ang === 90)  _wbb = { xMin: _wax + _bb.minY, xMax: _wax + _bb.maxY, zMin: _waz - _bb.maxX, zMax: _waz - _bb.minX };
    else if (_ang === 180) _wbb = { xMin: _wax - _bb.maxX, xMax: _wax - _bb.minX, zMin: _waz - _bb.maxY, zMax: _waz - _bb.minY };
    else if (_ang === 270) _wbb = { xMin: _wax - _bb.maxY, xMax: _wax - _bb.minY, zMin: _waz + _bb.minX, zMax: _waz + _bb.maxX };
    allStairWBBs.push(_wbb);
    resolvedStairs.push({ def: stairDef, zoneRect: zr, sg: _sg, stPl: _stPl, exitSide: _exit,
      wbb: _wbb, wax: _wax, waz: _waz, zwx: _zwx, zwz: _zwz, stW: stairDef.width || 4 });
  });

  // Backward compat: zone 0 stair gaps for joist/beam/rim/board splitting
  var hasSt = resolvedStairs.length > 0;
  var exitSide = null;
  var frontGap = null, leftGap = null, rightGap = null;
  var stairClipD = 0;
  resolvedStairs.forEach(function(rs) {
    if (rs.def.zoneId !== 0) return;
    if (!exitSide) exitSide = rs.exitSide;
    var wbb = rs.wbb;
    if (rs.exitSide === "front" && !frontGap) {
      stairClipD = Math.max(0, wbb.zMax - wbb.zMin);
      if (wbb.xMax > z0wx && wbb.xMin < z0wx + W) {
        frontGap = { min: Math.max(wbb.xMin, z0wx), max: Math.min(wbb.xMax, z0wx + W),
          zMin: Math.max(wbb.zMin, z0wz), zMax: Math.min(wbb.zMax, z0wz + D) };
      }
    } else if (rs.exitSide === "right" && !rightGap) {
      stairClipD = Math.max(0, wbb.xMax - wbb.xMin);
      if (wbb.zMax > z0wz && wbb.zMin < z0wz + D) {
        rightGap = { min: Math.max(wbb.zMin, z0wz), max: Math.min(wbb.zMax, z0wz + D),
          xMin: Math.max(wbb.xMin, z0wx),
          xMax: Math.min(wbb.xMax, z0wx + W) };
      }
    } else if (rs.exitSide === "left" && !leftGap) {
      stairClipD = Math.max(0, wbb.xMax - wbb.xMin);
      if (wbb.zMax > z0wz && wbb.zMin < z0wz + D) {
        leftGap = { min: Math.max(wbb.zMin, z0wz), max: Math.min(wbb.zMax, z0wz + D),
          xMin: Math.max(wbb.xMin, z0wx),
          xMax: Math.min(wbb.xMax, z0wx + W) };
      }
    }
  });
  var leftAtEdge = leftGap && leftGap.xMin <= z0wx + 0.1;
  var rightAtEdge = rightGap && rightGap.xMax >= z0wx + W - 0.1;

  // Helper: check if a world-space point is inside zone 0
  function inZone0(wx, wz) {
    return wx >= z0wx - 0.01 && wx <= z0wx + W + 0.01 && wz >= z0wz - 0.01 && wz <= z0wz + D + 0.01;
  }

// House (anchored to zone 0)
  var dOff = p.deckOffset || 0;
  var _houseDepth = 14;
  addHouse(scene, {
    width: p.houseWidth,
    depth: _houseDepth,
    height: Math.max(H + 8, 12),
    x: z0wx + (W - p.houseWidth) / 2 - dOff,
    z: z0wz - _houseDepth,
    deckHeight: H,
    doorX: z0wx + W / 2,   // center door on deck, not house
    showDoor: true,
    showWindows: true
  }, mats, THREE);

// S20: Structure per zone (piers, posts, beams, joists)
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
      // S40: Render all posts at beam line (1.5' behind rim joist, no stair collision)
      // S34: Variable post heights based on slope
      pp.forEach(function(px, _pi) {
        var pH = (c.postHeights && _pi >= 0) ? c.postHeights[_pi] : zH;
        var _gY = H - pH;
        addM(new THREE.CylinderGeometry(pR, pR, 0.5, 16), mats.concrete, z0wx + px, _gY + 0.25, z0wz + D - 1.5);
        var po = new THREE.Mesh(new THREE.BoxGeometry(pD, pH, pD), mats.post); po.position.set(z0wx + px, _gY + pH / 2, z0wz + D - 1.5); po.castShadow = true; scene.add(po);
        addM(new THREE.BoxGeometry(pD + 0.2, 0.15, pD + 0.2), mats.metal, z0wx + px, zH, z0wz + D - 1.5);
      });

// Zone 0: Beam (with stair gap split)
      if (frontGap && stairClipD > 1.5 && frontGap.zMax > z0wz + D - 2) {
        var bL = frontGap.min - (z0wx + 1);
        var bR2 = (z0wx + W - 1) - frontGap.max;
        if (bL > 0.1) { var bmL = new THREE.Mesh(new THREE.BoxGeometry(bL, bH2, bW2), mats.beam); bmL.position.set(z0wx + 1 + bL / 2, zH - bH2 / 2 - 0.1, z0wz + D - 1.5); bmL.castShadow = true; scene.add(bmL); }
        if (bR2 > 0.1) { var bmR = new THREE.Mesh(new THREE.BoxGeometry(bR2, bH2, bW2), mats.beam); bmR.position.set(frontGap.max + bR2 / 2, zH - bH2 / 2 - 0.1, z0wz + D - 1.5); bmR.castShadow = true; scene.add(bmR); }
      } else {
        var bm = new THREE.Mesh(new THREE.BoxGeometry(W - 2, bH2, bW2), mats.beam); bm.position.set(z0wx + W / 2, zH - bH2 / 2 - 0.1, z0wz + D - 1.5); bm.castShadow = true; scene.add(bm);
      }

// Zone 0: Ledger
      addM(new THREE.BoxGeometry(W, 9.25 / 12, 1.5 / 12), mats.joist, z0wx + W / 2, zH - 0.4, z0wz + 0.06);

// Zone 0: Joists (with stair gap splits)
      var jLen = D - 1.5;
      for (var x = sp / 12; x < W; x += sp / 12) {
        var jx = z0wx + x;
        if (frontGap && stairClipD > 0.5 && jx > frontGap.min + 0.05 && jx < frontGap.max - 0.05) {
          var jSeg1 = frontGap.zMin - z0wz;
          if (jSeg1 > 0.2) { addM(new THREE.BoxGeometry(jW2, jH2, jSeg1), mats.joist, jx, zH - jH2 / 2 - 0.1, z0wz + jSeg1 / 2); }
          var jSeg2 = (z0wz + D - 1.5) - frontGap.zMax;
          if (jSeg2 > 0.2) { addM(new THREE.BoxGeometry(jW2, jH2, jSeg2), mats.joist, jx, zH - jH2 / 2 - 0.1, frontGap.zMax + jSeg2 / 2); }
          continue;
        }
        if (leftGap && jx > leftGap.xMin + 0.05 && jx < leftGap.xMax - 0.05) {
          var jSeg1 = leftGap.min - z0wz;
          if (jSeg1 > 0.2) { addM(new THREE.BoxGeometry(jW2, jH2, jSeg1), mats.joist, jx, zH - jH2 / 2 - 0.1, z0wz + jSeg1 / 2); }
          var jSeg2 = (z0wz + D - 1.5) - leftGap.max;
          if (jSeg2 > 0.2) { addM(new THREE.BoxGeometry(jW2, jH2, jSeg2), mats.joist, jx, zH - jH2 / 2 - 0.1, leftGap.max + jSeg2 / 2); }
          continue;
        }
        if (rightGap && jx > rightGap.xMin + 0.05 && jx < rightGap.xMax - 0.05) {
          var jSeg1 = rightGap.min - z0wz;
          if (jSeg1 > 0.2) { addM(new THREE.BoxGeometry(jW2, jH2, jSeg1), mats.joist, jx, zH - jH2 / 2 - 0.1, z0wz + jSeg1 / 2); }
          var jSeg2 = (z0wz + D - 1.5) - rightGap.max;
          if (jSeg2 > 0.2) { addM(new THREE.BoxGeometry(jW2, jH2, jSeg2), mats.joist, jx, zH - jH2 / 2 - 0.1, rightGap.max + jSeg2 / 2); }
          continue;
        }
        addM(new THREE.BoxGeometry(jW2, jH2, jLen), mats.joist, jx, zH - jH2 / 2 - 0.1, z0wz + jLen / 2);
      }

// Zone 0: Rim joists (with stair gaps)
      function addRimSeg(x, y, z, w, h, d) { addM(new THREE.BoxGeometry(w, h, d), mats.joist, x, y, z); }
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
// Zones 1+: Simplified structure (posts at corners, beam along far edge, joists)
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
        addM(new THREE.CylinderGeometry(pR, pR, 0.5, 16), mats.concrete, pt[0], 0.25, pt[1]);
        var po = new THREE.Mesh(new THREE.BoxGeometry(pD, zH, pD), mats.post); po.position.set(pt[0], zH / 2, pt[1]); po.castShadow = true; scene.add(po);
        addM(new THREE.BoxGeometry(pD + 0.2, 0.15, pD + 0.2), mats.metal, pt[0], zH, pt[1]);
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
        addM(new THREE.BoxGeometry(jW2, jH2, zJLen), mats.joist, zwx + zx2, zH - jH2 / 2 - 0.1, zwz + zJLen / 2 + 0.5);
      }

      // Rim joists on 3 exposed sides (not the attachment edge which connects to parent)
      var zone = ar.zone;
      var attachEdge = zone.attachEdge;
      // Front rim (far from house, high Y)
      if (attachEdge !== "front") {
        addM(new THREE.BoxGeometry(zW, jH2, jW2), mats.joist, zwx + zW / 2, zH - jH2 / 2 - 0.1, zwz + zD);
      }
// Back rim (near house, low Y)   usually the attachment edge for front-attached zones
      if (attachEdge !== "back") {
        addM(new THREE.BoxGeometry(zW, jH2, jW2), mats.joist, zwx + zW / 2, zH - jH2 / 2 - 0.1, zwz);
      }
      // Left rim
      if (attachEdge !== "left") {
        addM(new THREE.BoxGeometry(jW2, jH2, zD), mats.joist, zwx, zH - jH2 / 2 - 0.1, zwz + zD / 2);
      }
      // Right rim
      if (attachEdge !== "right") {
        addM(new THREE.BoxGeometry(jW2, jH2, zD), mats.joist, zwx + zW, zH - jH2 / 2 - 0.1, zwz + zD / 2);
      }
    }
  });

// S20: Chamfer data for 3D board trimming
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

// S21: Chamfer corner data for railing
  var chamferCorners = [];
  chamferZones.forEach(function(cz2) {
    var bl = cz2.corners.BL && cz2.corners.BL.type === "chamfer" ? cz2.corners.BL.size : 0;
    var brC = cz2.corners.BR && cz2.corners.BR.type === "chamfer" ? cz2.corners.BR.size : 0;
    var fl = cz2.corners.FL && cz2.corners.FL.type === "chamfer" ? cz2.corners.FL.size : 0;
    var frC = cz2.corners.FR && cz2.corners.FR.type === "chamfer" ? cz2.corners.FR.size : 0;
    if (bl > 0) chamferCorners.push({ cx: cz2.wx, cz: cz2.wz, p1: [cz2.wx + bl, cz2.wz], p2: [cz2.wx, cz2.wz + bl] });
    if (brC > 0) chamferCorners.push({ cx: cz2.wx + cz2.w, cz: cz2.wz, p1: [cz2.wx + cz2.w - brC, cz2.wz], p2: [cz2.wx + cz2.w, cz2.wz + brC] });
    if (fl > 0) chamferCorners.push({ cx: cz2.wx, cz: cz2.wz + cz2.d, p1: [cz2.wx + fl, cz2.wz + cz2.d], p2: [cz2.wx, cz2.wz + cz2.d - fl] });
    if (frC > 0) chamferCorners.push({ cx: cz2.wx + cz2.w, cz: cz2.wz + cz2.d, p1: [cz2.wx + cz2.w - frC, cz2.wz + cz2.d], p2: [cz2.wx + cz2.w, cz2.wz + cz2.d - frC] });
  });

  var adjustedCorners = {};

  function adjustRailEnd(x, z, ox, oz) {
    var tol = 0.15;
    for (var i = 0; i < chamferCorners.length; i++) {
      var cc = chamferCorners[i];
      if (Math.abs(x - cc.cx) < tol && Math.abs(z - cc.cz) < tol) {
        var isH = Math.abs(z - oz) < 0.1;
        var key = cc.cx.toFixed(2) + "," + cc.cz.toFixed(2);
        if (!adjustedCorners[key]) adjustedCorners[key] = { cc: cc, h: false, v: false };
        if (isH) adjustedCorners[key].h = true; else adjustedCorners[key].v = true;
        return isH ? cc.p1 : cc.p2;
      }
    }
    return null;
  }

  function isAtChamferCorner(x, z) {
    var tol = 0.15;
    for (var i = 0; i < chamferCorners.length; i++) {
      if (Math.abs(x - chamferCorners[i].cx) < tol && Math.abs(z - chamferCorners[i].cz) < tol) return true;
    }
    return false;
  }

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

// S20: Decking boards   iterate over composite outline rects
  var bdW = 5.5 / 12, bdH = 1 / 12;
  composite.forEach(function(cr) {
    var crwx = cx + cr.x;  // composite rect world X
    var crwz = cz + cr.y;  // composite rect world Z
    var crW = cr.w;
    var crD = cr.d;

    for (var lx = bdW / 2; lx < crW; lx += bdW) {
      var bx = crwx + lx;

      // Check if this board X falls within zone 0 and has a stair gap
      var _bZs = crwz, _bZe = crwz + crD;
      if (inZone0(bx, z0wz + D / 2)) {
        if (frontGap && stairClipD > 0.1 && bx > frontGap.min + 0.02 && bx < frontGap.max - 0.02) {
          addDeckBoard(bx, _bZs, frontGap.zMin);
          addDeckBoard(bx, Math.max(_bZs, frontGap.zMax), _bZe);
          continue;
        }
        if (leftGap && bx > leftGap.xMin + 0.02 && bx < leftGap.xMax - 0.02) {
          addDeckBoard(bx, _bZs, leftGap.min);
          addDeckBoard(bx, Math.max(_bZs, leftGap.max), _bZe);
          continue;
        }
        if (rightGap && bx > rightGap.xMin + 0.02 && bx < rightGap.xMax - 0.02) {
          addDeckBoard(bx, _bZs, rightGap.min);
          addDeckBoard(bx, Math.max(_bZs, rightGap.max), _bZe);
          continue;
        }
      }

      // S64: Check ALL stair world bboxes for board gaps (handles all zones)
      var _stairCut = false;
      for (var _si = 0; _si < allStairWBBs.length; _si++) {
        var _swb = allStairWBBs[_si];
        if (bx > _swb.xMin + 0.02 && bx < _swb.xMax - 0.02 &&
            _bZe > _swb.zMin + 0.02 && _bZs < _swb.zMax - 0.02) {
          addDeckBoard(bx, _bZs, _swb.zMin);
          addDeckBoard(bx, Math.max(_bZs, _swb.zMax), _bZe);
          _stairCut = true; break;
        }
      }
      if (_stairCut) continue;

// No gap   full board for this composite rect
      addDeckBoard(bx, _bZs, _bZe);
    }
  });

// S20: Railing   from exposed edges (multi-zone) or hardcoded (single-zone)
  var rH = (c.guardHeight || 36) / 12, trY = H + bdH + rH, brY = H + bdH + 0.25;
  var railTopW = 0.18, railBotW = 0.12, balW = 0.07, balSp = 0.5, postW = 0.3;
  var railZStart = isLedger ? cz + 0.3 : cz;

  function addRail(x1, z1, x2, z2, skipAdjust) {
    // S21: Auto-adjust endpoints at chamfered corners
    if (!skipAdjust) {
      var a1 = adjustRailEnd(x1, z1, x2, z2);
      if (a1) { x1 = a1[0]; z1 = a1[1]; }
      var a2 = adjustRailEnd(x2, z2, x1, z1);
      if (a2) { x2 = a2[0]; z2 = a2[1]; }
    }
    var dx2 = x2 - x1, dz2 = z2 - z1;
    var len = Math.sqrt(dx2 * dx2 + dz2 * dz2);
    if (len < 0.05) return;
    var mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    var isDiag = Math.abs(dx2) > 0.01 && Math.abs(dz2) > 0.01;
    var angle = isDiag ? Math.atan2(dz2, dx2) : 0;
    var isX = !isDiag && Math.abs(dz2) < 0.01;
    var topG = (isDiag || isX) ? new THREE.BoxGeometry(len, railTopW, railTopW) : new THREE.BoxGeometry(railTopW, railTopW, len);
    var topM = new THREE.Mesh(topG, mats.rail); topM.position.set(mx, trY, mz);
    if (isDiag) topM.rotation.y = -angle;
    scene.add(topM);
    var botG = (isDiag || isX) ? new THREE.BoxGeometry(len, railBotW, railBotW) : new THREE.BoxGeometry(railBotW, railBotW, len);
    var botM = new THREE.Mesh(botG, mats.rail); botM.position.set(mx, brY, mz);
    if (isDiag) botM.rotation.y = -angle;
    scene.add(botM);
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
// S20: Multi-zone railing from exposed edges
    exposedEdges.forEach(function(e) {
      var ex1 = cx + e.x1, ey1 = cz + e.y1, ex2 = cx + e.x2, ey2 = cz + e.y2;

      // Check if this edge overlaps a stair gap on zone 0
      if (e.dir === "h") {
// Horizontal edge   check front gap
        if (frontGap && Math.abs(ey1 - (z0wz + D)) < 0.1) {
// This edge is on zone 0's front   split around stair gap
          if (ex1 < frontGap.min - 0.05) addRail(ex1, ey1, Math.min(ex2, frontGap.min), ey1);
          if (ex2 > frontGap.max + 0.05) addRail(Math.max(ex1, frontGap.max), ey1, ex2, ey1);
          if (frontGap.min > ex1 + 0.1) addRailPost(frontGap.min, ey1);
          if (frontGap.max < ex2 - 0.1) addRailPost(frontGap.max, ey1);
          return;
        }
      } else {
// Vertical edge   check left/right gap
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

// S64: Check ALL stair world bboxes for zone railing edges
      for (var _ri = 0; _ri < allStairWBBs.length; _ri++) {
        var _swb = allStairWBBs[_ri];
        if (e.dir === "h" && ey1 > _swb.zMin - 0.1 && ey1 < _swb.zMax + 0.1 &&
            ex1 < _swb.xMax && ex2 > _swb.xMin) {
          if (ex1 < _swb.xMin - 0.05) addRail(ex1, ey1, Math.min(ex2, _swb.xMin), ey1);
          if (ex2 > _swb.xMax + 0.05) addRail(Math.max(ex1, _swb.xMax), ey1, ex2, ey1);
          if (_swb.xMin > ex1 + 0.1) addRailPost(_swb.xMin, ey1);
          if (_swb.xMax < ex2 - 0.1) addRailPost(_swb.xMax, ey1);
          return;
        }
        if (e.dir === "v" && ex1 > _swb.xMin - 0.1 && ex1 < _swb.xMax + 0.1 &&
            ey1 < _swb.zMax && ey2 > _swb.zMin) {
          if (ey1 < _swb.zMin - 0.05) addRail(ex1, ey1, ex1, Math.min(ey2, _swb.zMin));
          if (ey2 > _swb.zMax + 0.05) addRail(ex1, Math.max(ey1, _swb.zMax), ex1, ey2);
          if (_swb.zMin > ey1 + 0.1) addRailPost(ex1, _swb.zMin);
          if (_swb.zMax < ey2 - 0.1) addRailPost(ex1, _swb.zMax);
          return;
        }
      }

// No stair gap on this edge   full railing
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
      var pt = outlineCorners[k];
      if (isAtChamferCorner(pt[0], pt[1])) return;
      // S64: Skip posts inside any stair footprint
      var _inStair = false;
      for (var _si2 = 0; _si2 < allStairWBBs.length; _si2++) {
        var _sw2 = allStairWBBs[_si2];
        if (pt[0] > _sw2.xMin + 0.05 && pt[0] < _sw2.xMax - 0.05 &&
            pt[1] > _sw2.zMin - 0.1 && pt[1] < _sw2.zMax + 0.1) { _inStair = true; break; }
      }
      if (_inStair) return;
      addRailPost(pt[0], pt[1]);
    });

  } else {
// Single-zone: original hardcoded railing (unchanged)
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
    cornerPosts.forEach(function(pt) {
      if (!isAtChamferCorner(pt[0], pt[1])) addRailPost(pt[0], pt[1]);
    });
  }

// S21: Diagonal railing at chamfered corners
  Object.keys(adjustedCorners).forEach(function(key) {
    var ac = adjustedCorners[key];
    if (ac.h && ac.v) {
      addRail(ac.cc.p1[0], ac.cc.p1[1], ac.cc.p2[0], ac.cc.p2[1], true);
      addRailPost(ac.cc.p1[0], ac.cc.p1[1]);
      addRailPost(ac.cc.p2[0], ac.cc.p2[1]);
    }
  });

// S64: Stairs 3D -- iterate all resolved stairs
  var V_TREAD_RUN = 10.5 / 12;
  var V_STR_W = 0.25;
  var V_STR_H = 0.9;
  var V_RAIL_W = 0.15;
  resolvedStairs.forEach(function(rs) {
    var sg = rs.sg, stPl = rs.stPl;
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
    // Precompute landing elevations for clipping
    var landingElevs = [];
    var _lcr = 0;
    for (var _li = 0; _li < sg.landings.length; _li++) {
      _lcr += sg.runs[_li].risers;
      landingElevs.push(H - _lcr * riseFt);
    }
    // Helper: check if a tread/riser clips through a landing platform
    // Only clips if inside the landing rect AND at/above the landing surface elevation
    function clipsLanding(x, z, y) {
      for (var li2 = 0; li2 < sg.landings.length; li2++) {
        var lr2 = sg.landings[li2].rect;
        if (x > lr2.x + 0.05 && x < lr2.x + lr2.w - 0.05 &&
            z > lr2.y + 0.05 && z < lr2.y + lr2.h - 0.05 &&
            y > landingElevs[li2] - treadTh) return true;
      }
      return false;
    }
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
        if (clipsLanding(tX, tZ, tY)) continue;
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
        if (clipsLanding(rX, rZ, rY2)) continue;
        var rw = isHoriz ? span : riserTh;
        var rd = isHoriz ? riserTh : span;
        var rm = new THREE.Mesh(new THREE.BoxGeometry(rw, riseFt * 0.92, rd), mats.stairRiser);
        rm.position.set(rX, rY2 + riseFt * 0.46, rZ);
        stGrp.add(rm);
      }

      var hDist = run.treads * treadFt;
      var vDist = run.risers * riseFt;

      // Compute landing overlap to clip stringers/railings at landing edge
      var landingOverlap = 0;
      for (var _lo = 0; _lo < sg.landings.length; _lo++) {
        var _lr = sg.landings[_lo].rect;
        // Check overlap in direction of travel
        if (isHoriz) {
          // treadAxis "h" means treads span X, travel is in Z
          var runZMin = Math.min(sz, sz + dsz * hDist);
          var runZMax = Math.max(sz, sz + dsz * hDist);
          var oMin = Math.max(runZMin, _lr.y);
          var oMax = Math.min(runZMax, _lr.y + _lr.h);
          if (oMax > oMin && sx > _lr.x + 0.05 && sx < _lr.x + _lr.w - 0.05) {
            landingOverlap = Math.max(landingOverlap, oMax - oMin);
          }
        } else {
          var runXMin = Math.min(sx, sx + dsx * hDist);
          var runXMax = Math.max(sx, sx + dsx * hDist);
          var oMin = Math.max(runXMin, _lr.x);
          var oMax = Math.min(runXMax, _lr.x + _lr.w);
          if (oMax > oMin && sz > _lr.y + 0.05 && sz < _lr.y + _lr.h - 0.05) {
            landingOverlap = Math.max(landingOverlap, oMax - oMin);
          }
        }
      }

      // Effective stringer/railing dimensions (clipped at landing edge)
      var effHDist = hDist - landingOverlap;
      var effVDist = vDist * (effHDist / Math.max(hDist, 0.1));
      var sLen = Math.sqrt(effHDist * effHDist + effVDist * effVDist);
      var sAng = Math.atan2(vDist, hDist); // angle stays based on full run slope
      var strYClip = strH / 2 * Math.cos(sAng) + 0.08;
      // Offset midpoint: stringer starts at landing edge, not run start
      var strStartOffset = landingOverlap;
      var midY = topElev - (landingOverlap > 0 ? effVDist + vDist * (landingOverlap / hDist) : vDist / 2) - strYClip;
      var midHX = sx + dsx * (strStartOffset + effHDist / 2);
      var midHZ = sz + dsz * (strStartOffset + effHDist / 2);

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
        var trLen = Math.sqrt(effHDist * effHDist + effVDist * effVDist);
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

      // Landing deck surface (thin, like a tread - not a thick solid box)
      var platM = new THREE.Mesh(
        new THREE.BoxGeometry(lr.w, treadTh, lr.h), mats.deck
      );
      platM.position.set(lr.x + lr.w / 2, lElev + treadTh / 2, lr.y + lr.h / 2);
      platM.receiveShadow = true; platM.castShadow = true;
      stGrp.add(platM);

      // Landing rim joists (gives visual structure like a real platform)
      var rimH = 9.25 / 12, rimW = 1.5 / 12;
      var rimY = lElev - rimH / 2;
      // Front and back rims
      var rimFront = new THREE.Mesh(new THREE.BoxGeometry(lr.w, rimH, rimW), mats.joist);
      rimFront.position.set(lr.x + lr.w / 2, rimY, lr.y);
      stGrp.add(rimFront);
      var rimBack = new THREE.Mesh(new THREE.BoxGeometry(lr.w, rimH, rimW), mats.joist);
      rimBack.position.set(lr.x + lr.w / 2, rimY, lr.y + lr.h);
      stGrp.add(rimBack);
      // Left and right rims
      var rimLeft = new THREE.Mesh(new THREE.BoxGeometry(rimW, rimH, lr.h), mats.joist);
      rimLeft.position.set(lr.x, rimY, lr.y + lr.h / 2);
      stGrp.add(rimLeft);
      var rimRight = new THREE.Mesh(new THREE.BoxGeometry(rimW, rimH, lr.h), mats.joist);
      rimRight.position.set(lr.x + lr.w, rimY, lr.y + lr.h / 2);
      stGrp.add(rimRight);

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
          var lrH = (c.guardHeight || 36) / 12;

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

    stGrp.position.set(rs.wax, 0, rs.waz);
    stGrp.rotation.y = (stPl.angle || 0) * Math.PI / 180;
    scene.add(stGrp);
  }); // end resolvedStairs.forEach

  return { exitSide: exitSide };
};


// ============================================================
// Deck3D   Interactive Three.js preview component
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
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(45, cW / cH, 0.1, 200);
    if (!window._deckOrbit) orbit.current.dist = Math.max(W, D, H * 2) * 1.8;
    const ren = new THREE.WebGLRenderer({ antialias: true }); ren.setSize(cW, cH); ren.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
    el.innerHTML = ""; el.appendChild(ren.domElement);

    // Shared environment (lights, ground, grid, slope)
    setupSceneEnv(scene, p, THREE);

// Deck scene   shared builder
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
  }, [W, D, H, c.nP, c.pp, c.postSize, c.beamSize, c.sp, c.fDiam, p.deckingType, p.deckStairs, p.height, p.deckOffset, p.houseWidth, p.zones, p.slopePercent, p.slopeDirection]);

  return <div ref={ref} style={{ width: "100%", height: 380, borderRadius: 6, overflow: "hidden" }} />;
}

window.Deck3D = Deck3D;


// ============================================================
// capture3D   PDF cover image render using shared scene builder
// Exported as window.capture3D(p, c)   Promise<base64 string | null>
// ============================================================
window.capture3D = function(p, c) {
  return new Promise(function(resolve) {
    try {
      if (typeof THREE === 'undefined') { resolve(null); return; }
      var w = 800, h = 500;
      var W = c.W, D = c.D, H = c.H;

      // Offscreen renderer
      var scene = new THREE.Scene();
      var cam = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
      var ren = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      ren.setSize(w, h); ren.setPixelRatio(1);
      ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;

      // Shared environment (lights, ground, grid, slope)
      setupSceneEnv(scene, p, THREE);

// Deck scene   shared builder
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
