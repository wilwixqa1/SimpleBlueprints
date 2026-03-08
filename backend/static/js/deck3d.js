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
      rail: new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.3 }),
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

    // Piers + Posts + Caps
    const pR = (fDiam/12)/2, pD = postSize==="6x6" ? 5.5/12 : 3.5/12;
    pp.forEach(px => {
      scene.add(new THREE.Mesh(new THREE.CylinderGeometry(pR,pR,0.5,16), mats.concrete)).position.set(cx+px, 0.25, cz+D-1.5);
      var po = new THREE.Mesh(new THREE.BoxGeometry(pD,H,pD), mats.post); po.position.set(cx+px, H/2, cz+D-1.5); po.castShadow=true; scene.add(po);
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(pD+0.2,0.15,pD+0.2), mats.metal)).position.set(cx+px, H, cz+D-1.5);
    });

    // Beam + Ledger
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

    // Decking — with stairwell opening at stair exit
    const bdW=5.5/12, bdH=1/12;
    const notchD = 1.2; // notch depth (ft) at stair exit for visual step-down
    for (let x=bdW/2; x<W; x+=bdW) {
      const bx = cx + x; // board center X in world coords

      // Front stair: boards crossing stair width stop short of front edge
      if (frontGap && bx > frontGap.min + 0.02 && bx < frontGap.max - 0.02) {
        const shortD = D - notchD;
        if (shortD > 0.2) {
          var b=new THREE.Mesh(new THREE.BoxGeometry(bdW-0.02, bdH, shortD), mats.deck);
          b.position.set(bx, H+bdH/2, cz+shortD/2); b.receiveShadow=true; scene.add(b);
        }
      }
      // Left stair: boards near left edge split around the stair Z-range
      else if (leftGap && bx < cx + notchD) {
        var zMin = leftGap.min, zMax = leftGap.max;
        // Segment before gap (house-side)
        var seg1Len = zMin - cz;
        if (seg1Len > 0.1) {
          var b1=new THREE.Mesh(new THREE.BoxGeometry(bdW-0.02, bdH, seg1Len), mats.deck);
          b1.position.set(bx, H+bdH/2, cz+seg1Len/2); b1.receiveShadow=true; scene.add(b1);
        }
        // Segment after gap (yard-side)
        var seg2Len = (cz+D) - zMax;
        if (seg2Len > 0.1) {
          var b2=new THREE.Mesh(new THREE.BoxGeometry(bdW-0.02, bdH, seg2Len), mats.deck);
          b2.position.set(bx, H+bdH/2, zMax+seg2Len/2); b2.receiveShadow=true; scene.add(b2);
        }
      }
      // Right stair: boards near right edge split around the stair Z-range
      else if (rightGap && bx > cx + W - notchD) {
        var zMin = rightGap.min, zMax = rightGap.max;
        var seg1Len = zMin - cz;
        if (seg1Len > 0.1) {
          var b1=new THREE.Mesh(new THREE.BoxGeometry(bdW-0.02, bdH, seg1Len), mats.deck);
          b1.position.set(bx, H+bdH/2, cz+seg1Len/2); b1.receiveShadow=true; scene.add(b1);
        }
        var seg2Len = (cz+D) - zMax;
        if (seg2Len > 0.1) {
          var b2=new THREE.Mesh(new THREE.BoxGeometry(bdW-0.02, bdH, seg2Len), mats.deck);
          b2.position.set(bx, H+bdH/2, zMax+seg2Len/2); b2.receiveShadow=true; scene.add(b2);
        }
      }
      // Normal full board
      else {
        var b=new THREE.Mesh(new THREE.BoxGeometry(bdW-0.02, bdH, D+0.1), mats.deck);
        b.position.set(bx, H+bdH/2, cz+D/2); b.receiveShadow=true; scene.add(b);
      }
    }

    // ── RAILING with gaps ──
    const rH=3, trY=H+bdH+rH, brY=H+bdH+0.25;
    function addRail(x1,z1,x2,z2) {
      var dx2=x2-x1,dz2=z2-z1,len=Math.sqrt(dx2*dx2+dz2*dz2);
      if(len<0.05) return;
      var mx=(x1+x2)/2,mz=(z1+z2)/2,isX=Math.abs(dz2)<0.01;
      scene.add(new THREE.Mesh(isX?new THREE.BoxGeometry(len,0.1,0.08):new THREE.BoxGeometry(0.08,0.1,len),mats.rail)).position.set(mx,trY,mz);
      scene.add(new THREE.Mesh(isX?new THREE.BoxGeometry(len,0.06,0.06):new THREE.BoxGeometry(0.06,0.06,len),mats.rail)).position.set(mx,brY,mz);
      var bG=new THREE.BoxGeometry(0.04,rH-0.3,0.04), step=3.75/12, n=Math.floor(len/step);
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
    [[cx,cz],[cx+W,cz],[cx,cz+D],[cx+W,cz+D]].forEach(([x,z])=>{
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.2,rH+0.2,0.2),mats.rail)).position.set(x,H+bdH+rH/2,z);
    });

    // ================================================================
    // STAIRS 3D
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
        var riseFt = sg.riseIn / 12, treadFt = 10.5 / 12;
        var brdTh = 1.25 / 12, rsrT = 0.75 / 12;
        var strW = 1.5 / 12, strBH = 11.25 / 12, stRailH = 3;
        var landingRects = sg.landings.map(function(l){return l.rect;});

        function isAdjacentTo(edgePos, axis, rect, skipIdx, collection) {
          for (var i = 0; i < collection.length; i++) {
            if (i === skipIdx) continue;
            var r = collection[i].rect || collection[i];
            if (axis === "x") {
              if (Math.abs(edgePos - r.x) < 0.3 || Math.abs(edgePos - (r.x + r.w)) < 0.3) {
                if (rect.y < r.y + r.h && rect.y + rect.h > r.y) return true;
              }
            } else {
              if (Math.abs(edgePos - r.y) < 0.3 || Math.abs(edgePos - (r.y + r.h)) < 0.3) {
                if (rect.x < r.x + r.w && rect.x + rect.w > r.x) return true;
              }
            }
          }
          return false;
        }

        var cumR = 0;
        sg.runs.forEach(function(run, ri) {
          var topElev = H - cumR * riseFt;
          var dsx=0,dsz=0;
          if(run.downDir==="+y")dsz=1;else if(run.downDir==="-y")dsz=-1;
          else if(run.downDir==="+x")dsx=1;else if(run.downDir==="-x")dsx=-1;
          var isHoriz=(run.treadAxis==="h"), span=isHoriz?run.rect.w:run.rect.h;
          var sx,sz;
          if(dsz>0){sx=run.rect.x+run.rect.w/2;sz=run.rect.y;}
          else if(dsz<0){sx=run.rect.x+run.rect.w/2;sz=run.rect.y+run.rect.h;}
          else if(dsx>0){sx=run.rect.x;sz=run.rect.y+run.rect.h/2;}
          else{sx=run.rect.x+run.rect.w;sz=run.rect.y+run.rect.h/2;}

          for(var i=0;i<run.risers;i++){
            var tY=topElev-(i+1)*riseFt;
            if(i<run.treads){
              var tm=new THREE.Mesh(new THREE.BoxGeometry(isHoriz?span:treadFt,brdTh,isHoriz?treadFt:span),mats.stairTread);
              tm.position.set(sx+dsx*treadFt*(i+0.5),tY+brdTh/2,sz+dsz*treadFt*(i+0.5));
              tm.castShadow=true;tm.receiveShadow=true;stGrp.add(tm);
            }
            var rm=new THREE.Mesh(new THREE.BoxGeometry(isHoriz?span:rsrT,riseFt*0.85,isHoriz?rsrT:span),mats.stairRiser);
            rm.position.set(sx+dsx*treadFt*i,tY+riseFt*0.425,sz+dsz*treadFt*i);
            stGrp.add(rm);
          }

          var hDist=run.treads*treadFt, vDist=run.risers*riseFt;
          var sLen=Math.sqrt(hDist*hDist+vDist*vDist), sAng=Math.atan2(vDist,hDist);
          var midY=topElev-vDist/2, midHX=sx+dsx*hDist/2, midHZ=sz+dsz*hDist/2;

          var edges=[];
          if(isHoriz){
            edges.push({pos:run.rect.x+strW/2, edgeVal:run.rect.x, axis:"x"});
            edges.push({pos:run.rect.x+run.rect.w-strW/2, edgeVal:run.rect.x+run.rect.w, axis:"x"});
          } else {
            edges.push({pos:run.rect.y+strW/2, edgeVal:run.rect.y, axis:"z"});
            edges.push({pos:run.rect.y+run.rect.h-strW/2, edgeVal:run.rect.y+run.rect.h, axis:"z"});
          }

          edges.forEach(function(edge){
            var sg2=isHoriz?new THREE.BoxGeometry(strW,strBH,sLen):new THREE.BoxGeometry(sLen,strBH,strW);
            var sm=new THREE.Mesh(sg2,mats.stringer);
            if(isHoriz){sm.position.set(edge.pos,midY,midHZ);sm.rotation.x=dsz>0?sAng:-sAng;}
            else{sm.position.set(midHX,midY,edge.pos);sm.rotation.z=dsx>0?-sAng:sAng;}
            sm.castShadow=true;stGrp.add(sm);

            var adjL = isAdjacentTo(edge.edgeVal, edge.axis, run.rect, -1, sg.landings);
            var adjR = isAdjacentTo(edge.edgeVal, edge.axis, run.rect, ri, sg.runs);
            if (!adjL && !adjR) {
              var trG=isHoriz?new THREE.BoxGeometry(0.08,0.08,sLen):new THREE.BoxGeometry(sLen,0.08,0.08);
              var tr=new THREE.Mesh(trG,mats.rail);
              if(isHoriz){tr.position.set(edge.pos,midY+stRailH,midHZ);tr.rotation.x=dsz>0?sAng:-sAng;}
              else{tr.position.set(midHX,midY+stRailH,edge.pos);tr.rotation.z=dsx>0?-sAng:sAng;}
              stGrp.add(tr);
              var pInt=Math.max(2,Math.round(4/treadFt));
              for(var si=1;si<=run.treads;si+=pInt){
                var sI=Math.min(si,run.treads-1);
                var pB=topElev-(sI+1)*riseFt;
                var px2=isHoriz?edge.pos:sx+dsx*treadFt*(si+0.5);
                var pz2=isHoriz?sz+dsz*treadFt*(si+0.5):edge.pos;
                stGrp.add(new THREE.Mesh(new THREE.BoxGeometry(0.08,stRailH,0.08),mats.rail)).position.set(px2,pB+stRailH/2+brdTh,pz2);
              }
            }
          });
          cumR += run.risers;
        });

        // Landings
        var lCumR=0;
        sg.landings.forEach(function(landing,li){
          lCumR+=sg.runs[li].risers;
          var lElev=H-lCumR*riseFt, lr=landing.rect;
          var platM=new THREE.Mesh(new THREE.BoxGeometry(lr.w, brdTh*2, lr.h), mats.deck);
          platM.position.set(lr.x+lr.w/2, lElev+brdTh, lr.y+lr.h/2);
          platM.receiveShadow=true; stGrp.add(platM);
          [[lr.x+0.0625,lr.y+lr.h/2,0.125,9.25/12,lr.h],[lr.x+lr.w-0.0625,lr.y+lr.h/2,0.125,9.25/12,lr.h],
           [lr.x+lr.w/2,lr.y+0.0625,lr.w,9.25/12,0.125],[lr.x+lr.w/2,lr.y+lr.h-0.0625,lr.w,9.25/12,0.125]].forEach(function(f){
            stGrp.add(new THREE.Mesh(new THREE.BoxGeometry(f[2],f[3],f[4]),mats.joist)).position.set(f[0],lElev-f[3]/2,f[1]);
          });
          var lpSz=postSize==="6x6"?5.5/12:3.5/12;
          landing.posts.forEach(function(pt){
            var lpm=new THREE.Mesh(new THREE.BoxGeometry(lpSz,lElev,lpSz),mats.post);
            lpm.position.set(pt[0],lElev/2,pt[1]);lpm.castShadow=true;stGrp.add(lpm);
            stGrp.add(new THREE.Mesh(new THREE.CylinderGeometry(pR,pR,0.4,12),mats.concrete)).position.set(pt[0],0.2,pt[1]);
          });
          // Landing rail — outer edges only
          [[lr.x,lr.y,lr.x+lr.w,lr.y,"z",lr.y],
           [lr.x,lr.y+lr.h,lr.x+lr.w,lr.y+lr.h,"z",lr.y+lr.h],
           [lr.x,lr.y,lr.x,lr.y+lr.h,"x",lr.x],
           [lr.x+lr.w,lr.y,lr.x+lr.w,lr.y+lr.h,"x",lr.x+lr.w]].forEach(function(le){
            var adjRun=false;
            sg.runs.forEach(function(r){
              var rr=r.rect;
              if(le[4]==="x"){
                if(Math.abs(le[5]-rr.x)<0.3||Math.abs(le[5]-(rr.x+rr.w))<0.3){
                  var mn=Math.min(le[1],le[3]),mx2=Math.max(le[1],le[3]);
                  if(rr.y<mx2&&rr.y+rr.h>mn)adjRun=true;
                }
              } else {
                if(Math.abs(le[5]-rr.y)<0.3||Math.abs(le[5]-(rr.y+rr.h))<0.3){
                  var mn=Math.min(le[0],le[2]),mx2=Math.max(le[0],le[2]);
                  if(rr.x<mx2&&rr.x+rr.w>mn)adjRun=true;
                }
              }
            });
            if(!adjRun){
              var len2=Math.sqrt((le[2]-le[0])*(le[2]-le[0])+(le[3]-le[1])*(le[3]-le[1]));
              if(len2>0.1){
                var isV=Math.abs(le[0]-le[2])<0.01;
                var rG=isV?new THREE.BoxGeometry(0.08,0.08,len2):new THREE.BoxGeometry(len2,0.08,0.08);
                stGrp.add(new THREE.Mesh(rG,mats.rail)).position.set((le[0]+le[2])/2,lElev+stRailH,(le[1]+le[3])/2);
                [0,1].forEach(function(idx){
                  stGrp.add(new THREE.Mesh(new THREE.BoxGeometry(0.08,stRailH,0.08),mats.rail)).position.set(idx?le[2]:le[0],lElev+stRailH/2+brdTh,idx?le[3]:le[1]);
                });
              }
            }
          });
        });

        // Ground pad
        var bb=sg.bbox;
        stGrp.add(new THREE.Mesh(new THREE.BoxGeometry(bb.w+0.5,0.2,bb.h+0.5),
          new THREE.MeshStandardMaterial({color:0xc0c0c0,roughness:0.95}))).position.set((bb.minX+bb.maxX)/2,0.1,(bb.minY+bb.maxY)/2);

        stGrp.position.set(cx+stPl.anchorX, 0, cz+stPl.anchorY);
        stGrp.rotation.y = -(stPl.angle||0)*Math.PI/180;
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
