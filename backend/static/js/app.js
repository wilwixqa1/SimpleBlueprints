// ============================================================
// MAIN APP — Wizard, State, Products, capture3D
// ============================================================
const { useState, useMemo, useEffect, useRef } = React;

const products = [
  { id: "deck", name: "Decks", icon: "\u2B1C", active: true, desc: "Attached & freestanding decks" },
  { id: "pergola", name: "Pergolas", icon: "\u2630", desc: "Patio covers & shade structures" },
  { id: "fence", name: "Fences", icon: "\u25AE\u25AE\u25AE", desc: "Privacy, picket & iron fences" },
  { id: "shed", name: "Sheds", icon: "\u2302", desc: "Storage sheds under 200 SF" },
  { id: "garage", name: "Garages", icon: "\u229E", desc: "Detached 1-2 car garages" },
  { id: "porch", name: "Porches", icon: "\u25A6", desc: "Screened & 3-season rooms" },
];

const App = function SimpleBlueprints() {
  const [page, setPage] = useState("home");
  const [step, setStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [view, setView] = useState("plan");
  const [planMode, setPlanMode] = useState("plan");
  const [p, setP] = useState({ width: 20, depth: 12, height: 4, houseWidth: 40, houseDepth: 30, attachment: "ledger", hasStairs: true, stairLocation: "front", stairWidth: 4, numStringers: 3, hasLanding: false, joistSpacing: 16, deckingType: "composite", railType: "fortress", snowLoad: "moderate", frostZone: "cold", lotWidth: 80, lotDepth: 120, setbackFront: 25, setbackSide: 5, setbackRear: 20, houseOffsetSide: 20, deckOffset: 0, stairOffset: 0, beamType: "dropped", stairTemplate: "straight", stairRunSplit: null, stairLandingDepth: null, stairLandingWidth: null, stairGap: 0.5, stairRotation: 0, stairAnchorX: null, stairAnchorY: null, stairAngle: null });
  const u = (k, v) => setP(prev => {
    const next = { ...prev, [k]: v };
    if (k === "stairLocation") { next.stairOffset = 0; next.stairAnchorX = null; next.stairAnchorY = null; next.stairAngle = null; }
    if (k === "houseWidth" || k === "width") {
      const maxOff = Math.floor(next.houseWidth / 2);
      next.deckOffset = Math.max(-maxOff, Math.min(maxOff, next.deckOffset || 0));
    }
    if (k === "width" && next.stairWidth > next.width) next.stairWidth = next.width;
    if (k === "stairWidth" || k === "width" || k === "depth") {
      const edge = next.stairLocation === "front" ? next.width : next.depth;
      const maxSO = Math.floor((edge - (next.stairWidth || 4)) / 2);
      next.stairOffset = Math.max(-maxSO, Math.min(maxSO, next.stairOffset || 0));
    }
    if (k === "lotWidth" || k === "houseWidth") {
      const maxHO = Math.max(5, next.lotWidth - next.houseWidth - 5);
      next.houseOffsetSide = Math.min(next.houseOffsetSide || 20, maxHO);
    }
    return next;
  });
  const c = useMemo(() => window.calcStructure(p), [p]);
  const m = useMemo(() => window.estMaterials(p, c), [p, c]);
  const [genStatus, setGenStatus] = useState("idle");
  const [info, setInfo] = useState({ owner: "", address: "", city: "", state: "", zip: "", lot: "", contractor: "" });
  const setI = (f, v) => setInfo(prev => ({ ...prev, [f]: v }));
  const [sitePlanMode, setSitePlanMode] = useState("upload");
  const [sitePlanFile, setSitePlanFile] = useState(null);
  const [sitePlanB64, setSitePlanB64] = useState(null);
  const [genError, setGenError] = useState("");
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedback, setFeedback] = useState({ role: "", source: "", price: "", feedback: "", email: "" });
  const isProduction = typeof window !== 'undefined' && window.location.hostname.includes("simpleblueprints.xyz");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const API = "https://simpleblueprints-production.up.railway.app";

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.authenticated) setUser(d.user); setAuthLoading(false); })
      .catch(() => setAuthLoading(false));
  }, []);

  const capture3D = () => {
    return new Promise((resolve) => {
      try {
        if (typeof THREE === 'undefined') { resolve(null); return; }
        const w = 800, h = 500;
        const { W, D, H, pp, postSize, beamSize, joistSize, sp, fDiam } = c;
        const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf5f2eb);
        scene.fog = new THREE.Fog(0xf5f2eb, 60, 120);
        const cam = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
        const ren = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        ren.setSize(w, h); ren.setPixelRatio(1);
        ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;

        scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const sun = new THREE.DirectionalLight(0xfff5e0, 0.8); sun.position.set(20, 30, 15); sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
        scene.add(sun);
        const fill = new THREE.DirectionalLight(0xc0d0ff, 0.3); fill.position.set(-10, 15, -10); scene.add(fill);

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
        };

        const gnd = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0xb8c9a0, roughness: 1 }));
        gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; scene.add(gnd);
        const grid = new THREE.GridHelper(80, 80, 0xa0b088, 0xa8b890); grid.position.y = 0.01; scene.add(grid);

        const cx = -W / 2, cz = -D / 2;
        const hW = p.houseWidth, hD = 14, hH = Math.max(H + 8, 12);
        const hX = cx + (W - hW) / 2, hZ = cz - hD;
        const house = new THREE.Mesh(new THREE.BoxGeometry(hW, hH, hD), mats.house);
        house.position.set(hX + hW / 2, hH / 2, hZ + hD / 2); house.castShadow = true; scene.add(house);

        const ov = 1.5, rpk = 5;
        const rx1 = hX - ov, rx2 = hX + hW + ov, rxM = hX + hW / 2;
        const ry = hH, ryP = hH + rpk, rz1 = hZ - 1, rz2 = hZ + hD + 1;
        const rv = new Float32Array([rx1,ry,rz2,rx2,ry,rz2,rxM,ryP,rz2, rx2,ry,rz1,rx1,ry,rz1,rxM,ryP,rz1, rx1,ry,rz1,rx1,ry,rz2,rxM,ryP,rz2,rx1,ry,rz1,rxM,ryP,rz2,rxM,ryP,rz1, rx2,ry,rz2,rx2,ry,rz1,rxM,ryP,rz1,rx2,ry,rz2,rxM,ryP,rz1,rxM,ryP,rz2, rx1,ry,rz1,rx2,ry,rz1,rx2,ry,rz2,rx1,ry,rz1,rx2,ry,rz2,rx1,ry,rz2]);
        const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rv, 3)); rg.computeVertexNormals();
        const roofM = new THREE.Mesh(rg, mats.roof); roofM.castShadow = true; scene.add(roofM);

        for (let wx = 0.2; wx < 0.9; wx += 0.3) { const wn = new THREE.Mesh(new THREE.PlaneGeometry(3, 4), mats.win); wn.position.set(hX + hW * wx, H + 5, hZ + hD + 0.05); scene.add(wn); }
        const dr = new THREE.Mesh(new THREE.PlaneGeometry(4, 6.5), mats.win); dr.position.set(cx + W / 2, H - 6.5 / 2 + 6.7, cz + 0.05); scene.add(dr);

        const pR = (fDiam / 12) / 2;
        const pierG = new THREE.CylinderGeometry(pR, pR, 0.5, 16);
        pp.forEach(px => { const pr = new THREE.Mesh(pierG, mats.concrete); pr.position.set(cx + px, 0.25, cz + D - 1.5); scene.add(pr); });

        const pDim = postSize === "6x6" ? 5.5 / 12 : 3.5 / 12;
        const postG = new THREE.BoxGeometry(pDim, H, pDim);
        pp.forEach(px => { const po = new THREE.Mesh(postG, mats.post); po.position.set(cx + px, H / 2, cz + D - 1.5); po.castShadow = true; scene.add(po); });

        const capG = new THREE.BoxGeometry(pDim + 0.2, 0.15, pDim + 0.2);
        pp.forEach(px => { const ca = new THREE.Mesh(capG, mats.metal); ca.position.set(cx + px, H, cz + D - 1.5); scene.add(ca); });

        const bH2 = 11.875 / 12, bW2 = beamSize.includes("3") ? 5.25 / 12 : 3.5 / 12;
        const bm = new THREE.Mesh(new THREE.BoxGeometry(W - 2, bH2, bW2), mats.beam);
        bm.position.set(cx + W / 2, H - bH2 / 2 - 0.1, cz + D - 1.5); bm.castShadow = true; scene.add(bm);

        const ld = new THREE.Mesh(new THREE.BoxGeometry(W, 9.25 / 12, 1.5 / 12), mats.joist);
        ld.position.set(cx + W / 2, H - 0.4, cz + 0.06); scene.add(ld);

        const jH2 = 9.25 / 12, jW2 = 1.5 / 12, jLen = D - 1.5;
        const jG = new THREE.BoxGeometry(jW2, jH2, jLen);
        for (let x = sp / 12; x < W; x += sp / 12) { const j = new THREE.Mesh(jG, mats.joist); j.position.set(cx + x, H - jH2 / 2 - 0.1, cz + jLen / 2); scene.add(j); }

        const rimF = new THREE.Mesh(new THREE.BoxGeometry(W, jH2, jW2), mats.joist);
        rimF.position.set(cx + W / 2, H - jH2 / 2 - 0.1, cz + D); scene.add(rimF);
        [0, W].forEach(x => { const rim = new THREE.Mesh(new THREE.BoxGeometry(jW2, jH2, D), mats.joist); rim.position.set(cx + x, H - jH2 / 2 - 0.1, cz + D / 2); scene.add(rim); });

        const bdW = 5.5 / 12, bdH = 1 / 12;
        const bdG = new THREE.BoxGeometry(bdW - 0.02, bdH, D + 0.1);
        for (let x = bdW / 2; x < W; x += bdW) { const b = new THREE.Mesh(bdG, mats.deck); b.position.set(cx + x, H + bdH / 2, cz + D / 2); b.receiveShadow = true; scene.add(b); }

        const rH = 3, trY = H + bdH + rH, brY = H + bdH + 0.25;
        [[new THREE.BoxGeometry(W, 0.1, 0.08), cx + W / 2, trY, cz + D], [new THREE.BoxGeometry(0.08, 0.1, D), cx, trY, cz + D / 2], [new THREE.BoxGeometry(0.08, 0.1, D), cx + W, trY, cz + D / 2]].forEach(([g, x, y, z]) => { const r = new THREE.Mesh(g, mats.rail); r.position.set(x, y, z); scene.add(r); });
        [[new THREE.BoxGeometry(W, 0.06, 0.06), cx + W / 2, brY, cz + D], [new THREE.BoxGeometry(0.06, 0.06, D), cx, brY, cz + D / 2], [new THREE.BoxGeometry(0.06, 0.06, D), cx + W, brY, cz + D / 2]].forEach(([g, x, y, z]) => { const r = new THREE.Mesh(g, mats.rail); r.position.set(x, y, z); scene.add(r); });

        const balG = new THREE.BoxGeometry(0.04, rH - 0.3, 0.04);
        for (let x = 0; x < W; x += 3.75 / 12) { const b = new THREE.Mesh(balG, mats.rail); b.position.set(cx + x, H + bdH + rH / 2 + 0.1, cz + D); scene.add(b); }
        for (let z = 0; z < D; z += 3.75 / 12) { [cx, cx + W].forEach(x => { const b = new THREE.Mesh(balG, mats.rail); b.position.set(x, H + bdH + rH / 2 + 0.1, cz + z); scene.add(b); }); }

        const crnG = new THREE.BoxGeometry(0.2, rH + 0.2, 0.2);
        [[cx, cz], [cx + W, cz], [cx, cz + D], [cx + W, cz + D]].forEach(([x, z]) => { const cp = new THREE.Mesh(crnG, mats.rail); cp.position.set(x, H + bdH + rH / 2, z); scene.add(cp); });

        const maxDim = Math.max(W, D, H * 2, hW);
        const dist = maxDim * 1.6;
        const theta = 0.7, phi = 0.55;
        const lookY = H * 0.6;
        cam.position.set(dist * Math.sin(phi) * Math.cos(theta), dist * Math.cos(phi) + lookY, dist * Math.sin(phi) * Math.sin(theta));
        cam.lookAt(0, lookY, 0);

        ren.render(scene, cam);
        const dataUrl = ren.domElement.toDataURL("image/jpeg", 0.85);
        ren.dispose();
        resolve(dataUrl.split(",")[1]);
      } catch (e) { console.warn("3D capture failed:", e); resolve(null); }
    });
  };

  const generateBlueprint = async () => {
    setGenStatus("generating"); setGenError("");
    try {
      const coverImage = await capture3D();
      const res = await fetch(`${API}/api/generate-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...p, projectInfo: info, coverImage, sitePlanMode, sitePlanFile: sitePlanB64 }),
      });
      if (res.status === 401) { setGenError("Please sign in first"); setGenStatus("error"); return; }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.download_url) {
        window.open(`${API}${data.download_url}`, "_blank");
        setGenStatus("done");
      } else {
        throw new Error("No download URL returned");
      }
    } catch (e) {
      setGenError(e.message);
      setGenStatus("error");
    }
  };

  const submitFeedback = async () => {
    try {
      await fetch(`${API}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(feedback),
      });
      setFeedbackDone(true);
    } catch (e) { console.warn("Feedback error:", e); setFeedbackDone(true); }
  };

  const steps = [{ t: "Size & Shape", i: "\uD83D\uDCD0" }, { t: "Structure", i: "\uD83C\uDFD7\uFE0F" }, { t: "Finishes", i: "\uD83E\uDEB5" }, { t: "Review", i: "\uD83D\uDCCB" }];
  const mono = "'DM Mono', 'SF Mono', monospace"; const sans = "'DM Sans', system-ui, sans-serif";
  const br = { dk: "#1a1f16", gn: "#3d5a2e", cr: "#faf8f3", wr: "#f2ece0", ac: "#c4960a", tx: "#2c3024", mu: "#7a8068", bd: "#ddd8cc", rd: "#c0392b", bl: "#2471a3" };

  const Label = ({ children }) => <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: br.mu, marginBottom: 4, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase" }}>{children}</label>;
  const Slider = ({ label, value, min, max, step: s = 1, field, unit = "'" }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(value));
    const commit = () => {
      setEditing(false);
      let v = parseFloat(draft);
      if (isNaN(v)) v = value;
      v = Math.max(min, Math.min(max, s < 1 ? v : Math.round(v / s) * s));
      u(field, v);
      setDraft(String(v));
    };
    useEffect(() => { if (!editing) setDraft(String(value)); }, [value, editing]);
    return (
      <div style={{ marginBottom: 16 }}><Label>{label}</Label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="range" min={min} max={max} step={s} value={value} onChange={e => u(field, Number(e.target.value))} style={{ flex: 1, accentColor: br.gn, height: 6 }} />
          {editing ? (
            <input type="number" min={min} max={max} step={s} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()} autoFocus
              style={{ width: 60, fontFamily: mono, fontSize: 16, fontWeight: 800, color: br.tx, textAlign: "right", border: `2px solid ${br.gn}`, borderRadius: 4, padding: "2px 4px", outline: "none", background: "#fff" }} />
          ) : (
            <span onClick={() => setEditing(true)} style={{ fontFamily: mono, fontSize: 18, fontWeight: 800, color: br.tx, minWidth: 58, textAlign: "center", cursor: "text", background: "#f0ede4", borderRadius: 5, padding: "2px 8px", border: `1px solid ${br.bd}`, display: "inline-flex", alignItems: "center", gap: 4 }}>{value}{unit}<span style={{ fontSize: 10, color: br.mu, opacity: 0.6 }}>{"\u270E"}</span></span>
          )}
        </div>
      </div>
    );
  };
  const Chips = ({ label, field, opts }) => (
    <div style={{ marginBottom: 16 }}><Label>{label}</Label>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {opts.map(([v, t]) => <button key={v} onClick={() => u(field, v)} style={{ padding: "7px 14px", borderRadius: 6, fontSize: 11, fontFamily: mono, cursor: "pointer", border: p[field] === v ? `2px solid ${br.gn}` : `1px solid ${br.bd}`, background: p[field] === v ? br.gn : "#fff", color: p[field] === v ? "#fff" : br.tx, fontWeight: p[field] === v ? 700 : 400, transition: "all 0.15s" }}>{t}</button>)}
      </div>
    </div>
  );
  const Spec = ({ l, v, color }) => <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${br.wr}` }}><span style={{ fontSize: 11, color: br.mu, fontFamily: mono }}>{l}</span><span style={{ fontSize: 11, fontWeight: 700, color: color || br.tx, fontFamily: mono }}>{v}</span></div>;

  // Components from other files
  const PlanView = window.PlanView;
  const ElevationView = window.ElevationView;
  const Deck3D = window.Deck3D;

  // HOME
  if (page === "home") return (
    <div style={{ minHeight: "100vh", background: br.cr }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${br.bd}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, background: br.gn, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>SB</span></div>
          <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 800, color: br.dk, letterSpacing: "0.5px" }}>simpleblueprints</span>
          <span style={{ fontSize: 10, color: br.ac, fontWeight: 700, fontFamily: mono, border: `1px solid ${br.ac}`, padding: "1px 6px", borderRadius: 3, marginLeft: 4 }}>BETA</span>
        </div>
      </nav>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "50px 20px 40px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontFamily: mono, color: br.gn, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", marginBottom: 16 }}>Permit-Ready Plans in Minutes</div>
        <h1 style={{ fontFamily: sans, fontSize: "clamp(28px, 6vw, 52px)", fontWeight: 900, color: br.dk, lineHeight: 1.1, margin: "0 0 20px", letterSpacing: "-1px" }}>Simple structures.<br />Simple blueprints.</h1>
        <p style={{ fontFamily: sans, fontSize: "clamp(14px, 2.5vw, 18px)", color: br.mu, maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.6 }}>Configure your project, get IRC-compliant structural calculations, and download a professional drawing set. No architect required.</p>
        <div style={{ display: "flex", gap: 32, justifyContent: "center", marginBottom: 60, flexWrap: "wrap" }}>
          {[["01", "Configure", "Set dimensions, materials, and location"], ["02", "Calculate", "Auto-sized joists, beams, posts & footings"], ["03", "Download", "6-sheet PDF blueprint set + material list"]].map(([n, t, d]) => (
            <div key={n} style={{ textAlign: "center", maxWidth: 180 }}><div style={{ fontFamily: mono, fontSize: 28, fontWeight: 900, color: br.gn, marginBottom: 4 }}>{n}</div><div style={{ fontFamily: sans, fontSize: 16, fontWeight: 700, color: br.dk, marginBottom: 4 }}>{t}</div><div style={{ fontFamily: sans, fontSize: 13, color: br.mu, lineHeight: 1.5 }}>{d}</div></div>
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px 60px" }}>
        <div style={{ fontSize: 11, fontFamily: mono, color: br.mu, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 20, textAlign: "center" }}>Choose Your Project</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {products.map(pr => (
            <button key={pr.id} onClick={() => pr.active && setPage("wizard")} style={{ padding: "24px 20px", background: "#fff", border: pr.active ? `2px solid ${br.gn}` : `1px solid ${br.bd}`, borderRadius: 10, cursor: pr.active ? "pointer" : "default", textAlign: "left", opacity: pr.active ? 1 : 0.55, position: "relative" }}>
              {!pr.active && <span style={{ position: "absolute", top: 10, right: 10, fontSize: 8, fontFamily: mono, color: br.ac, fontWeight: 700, background: "#fef9e7", padding: "2px 8px", borderRadius: 3 }}>COMING SOON</span>}
              <div style={{ fontSize: 24, marginBottom: 8 }}>{pr.icon}</div>
              <div style={{ fontFamily: sans, fontSize: 16, fontWeight: 700, color: br.dk }}>{pr.name}</div>
              <div style={{ fontFamily: sans, fontSize: 12, color: br.mu, marginTop: 2 }}>{pr.desc}</div>
              {pr.active && <div style={{ marginTop: 12, fontSize: 11, fontFamily: mono, color: br.gn, fontWeight: 700 }}>Start Building →</div>}
            </button>
          ))}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${br.bd}`, padding: "20px 32px", textAlign: "center" }}><span style={{ fontSize: 10, fontFamily: mono, color: br.mu }}>{"\u00A9"} 2026 SimpleBlueprints.com · Plans for reference — verify with local building department</span></div>
    </div>
  );

  // WIZARD
  const views = [["plan", "Plan"], ["elevation", "Elevation"], ["3d", "3D View"]];
  return (
    <div style={{ minHeight: "100vh", background: br.cr }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 24px", borderBottom: `1px solid ${br.bd}`, background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setPage("home")}>
          <div style={{ width: 24, height: 24, background: br.gn, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>SB</span></div>
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: br.dk }}>simpleblueprints</span>
        </div>
        <div style={{ display: "flex", gap: 1 }}>
          {steps.map((s, i) => <button key={i} onClick={() => setStep(i)} style={{ padding: "7px 16px", fontSize: 10, cursor: "pointer", border: "none", fontFamily: mono, background: step === i ? br.gn : "transparent", color: step === i ? "#fff" : br.mu, borderRadius: i === 0 ? "5px 0 0 5px" : i === 3 ? "0 5px 5px 0" : 0, fontWeight: step === i ? 700 : 400, letterSpacing: "0.5px" }}>{s.i} {s.t}</button>)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontFamily: mono, color: br.mu }}>{user.name || user.email}</span>
            {user.picture && <img src={user.picture} style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${br.bd}` }} referrerPolicy="no-referrer" />}
            <button onClick={() => fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }).then(() => setUser(null))} style={{ fontSize: 9, fontFamily: mono, color: br.mu, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>logout</button>
          </div> : <button onClick={() => { window.location.href = `${API}/auth/login`; }} style={{ padding: "5px 14px", background: br.gn, color: "#fff", border: "none", borderRadius: 5, fontSize: 10, fontFamily: mono, cursor: "pointer", fontWeight: 700 }}>Sign in</button>}
        </div>
      </nav>
      <div style={{ height: 3, background: br.wr }}><div style={{ height: "100%", background: br.gn, width: `${((step + 1) / 4) * 100}%`, transition: "width 0.3s" }} /></div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "12px", display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* LEFT: INPUTS */}
        <div style={{ flex: "1 1 320px", minWidth: 290 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 22, border: `1px solid ${br.bd}`, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 800, color: br.dk, fontFamily: sans, borderBottom: `2px solid ${br.gn}`, paddingBottom: 8 }}>{steps[step].i} {steps[step].t}</h2>

            {step === 0 && <>
              <Slider label="Width (along house)" value={p.width} min={8} max={50} field="width" />
              <Slider label="Depth (from house)" value={p.depth} min={6} max={24} field="depth" />
              <Slider label="Height above grade" value={p.height} min={1} max={14} field="height" />
              <Slider label="House width" value={p.houseWidth} min={20} max={80} field="houseWidth" />
              <Chips label="Attachment" field="attachment" opts={[["ledger", "Ledger Board"], ["freestanding", "Freestanding"]]} />
              <Chips label="Stairs" field="hasStairs" opts={[[true, "Yes"], [false, "No"]]} />
              {p.hasStairs && <>
                <Chips label="Stair location" field="stairLocation" opts={[["front", "Front"], ["left", "Left"], ["right", "Right"]]} />
                <Slider label="Stair width" value={p.stairWidth} min={3} max={p.width} field="stairWidth" />
                <Slider label="Number of stringers" value={p.numStringers} min={2} max={5} field="numStringers" unit="" />
                <Chips label="Landing pad" field="hasLanding" opts={[[true, "Yes"], [false, "No"]]} />
              {p.hasStairs && <>
                <div style={{ marginBottom: 16 }}>
                  <Label>Stair Template</Label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
                    {[
                      ["straight", "Straight", "\u2193"],
                      ["lLeft", "L-Left", "\u2193\u2190"],
                      ["lRight", "L-Right", "\u2193\u2192"],
                      ["switchback", "U-Turn", "\u2193\u2191"],
                      ["wrapAround", "Wrap", "\u2193\u2190\u2191"],
                      ["wideLanding", "Platform", "\u2193\u25A0\u2193"],
                    ].map(([key, name, icon]) => (
                      <button key={key} onClick={() => u("stairTemplate", key)} style={{
                        padding: "10px 4px", borderRadius: 6, cursor: "pointer", textAlign: "center",
                        border: p.stairTemplate === key ? "2px solid " + br.gn : "1px solid " + br.bd,
                        background: p.stairTemplate === key ? "#edf5e8" : "#fff",
                        fontFamily: mono, transition: "all 0.15s",
                      }}>
                        <div style={{ fontSize: 16, marginBottom: 2 }}>{icon}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: p.stairTemplate === key ? br.gn : br.tx }}>{name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>}

              </>}

              <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ width: "100%", padding: "8px 14px", marginBottom: 12, background: "none", border: `1px solid ${br.bd}`, borderRadius: 6, cursor: "pointer", fontSize: 10, fontFamily: mono, color: br.mu, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Positioning (drag in preview or set here)</span>
                <span style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "0.2s" }}>{"\u25BE"}</span>
              </button>
              {showAdvanced && <div style={{ padding: 14, background: br.wr, borderRadius: 8, border: `1px solid ${br.bd}`, marginBottom: 12 }}>
                <Slider label="Deck offset from center" value={p.deckOffset} min={-Math.floor(p.houseWidth / 2)} max={Math.floor(p.houseWidth / 2)} field="deckOffset" unit="'" />
                {p.hasStairs && p.stairAnchorX == null && <Slider label="Stair offset from center" value={p.stairOffset} min={-Math.floor((p.stairLocation === "front" ? (p.width - (p.stairWidth || 4)) : (p.depth - (p.stairWidth || 4))) / 2)} max={Math.floor((p.stairLocation === "front" ? (p.width - (p.stairWidth || 4)) : (p.depth - (p.stairWidth || 4))) / 2)} field="stairOffset" unit="'" />}
                {p.hasStairs && p.stairAnchorX != null && <>
                  <Slider label="Stair anchor X (from left)" value={p.stairAnchorX} min={0} max={p.width} step={0.5} field="stairAnchorX" unit="'" />
                  <Slider label="Stair anchor Y (from house)" value={p.stairAnchorY} min={0} max={p.depth} step={0.5} field="stairAnchorY" unit="'" />
                  <Slider label="Stair angle" value={p.stairAngle} min={0} max={270} step={90} field="stairAngle" unit="\u00B0" />
                  <button onClick={() => { u("stairAnchorX", null); u("stairAnchorY", null); u("stairAngle", null); }} style={{ padding: "5px 12px", fontSize: 9, fontFamily: "'DM Mono', monospace", color: "#c62828", background: "none", border: "1px solid #c62828", borderRadius: 4, cursor: "pointer", marginBottom: 8 }}>Reset to edge mode</button>
                </>}
              {["lLeft","lRight","switchback","wrapAround","wideLanding"].includes(p.stairTemplate) && p.hasStairs && (<>
                <Slider label="Run Split (1st run %)" value={p.stairRunSplit!=null?p.stairRunSplit:55} min={30} max={70} step={5} field="stairRunSplit" unit="%" />
                <Slider label="Landing Depth" value={p.stairLandingDepth!=null?p.stairLandingDepth:Math.max(p.stairWidth||4,4)} min={3} max={8} step={0.5} field="stairLandingDepth" unit="'" />
              </>)}
              {["switchback","wrapAround"].includes(p.stairTemplate) && p.hasStairs && (
                <Slider label="Gap Between Runs" value={p.stairGap!=null?p.stairGap:0.5} min={0} max={2} step={0.5} field="stairGap" unit="'" />
              )}
              </div>}

              <div style={{ marginTop: 16, padding: 14, background: br.wr, borderRadius: 8, border: `1px solid ${br.bd}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: br.gn, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4 }}>Site Plan / Survey</div>
                <div style={{ fontSize: 9, color: br.mu, fontFamily: mono, marginBottom: 10, lineHeight: 1.5 }}>
                  Find lot dimensions and setbacks on your county assessor website or in your home's survey/closing documents. Setbacks come from your local zoning code.
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  {[["generate", "Generate for me"], ["upload", "Upload my survey"]].map(([v, t]) => (
                    <button key={v} onClick={() => setSitePlanMode(v)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, fontSize: 11, fontFamily: mono, cursor: "pointer", border: sitePlanMode === v ? `2px solid ${br.gn}` : `1px solid ${br.bd}`, background: sitePlanMode === v ? br.gn : "#fff", color: sitePlanMode === v ? "#fff" : br.tx, fontWeight: sitePlanMode === v ? 700 : 400, transition: "all 0.15s" }}>{t}</button>
                  ))}
                </div>

                {sitePlanMode === "generate" && <>
                  <Slider label="Lot width" value={p.lotWidth} min={30} max={300} field="lotWidth" />
                  <Slider label="Lot depth" value={p.lotDepth} min={50} max={400} field="lotDepth" />
                  <Slider label="House depth" value={p.houseDepth} min={20} max={60} field="houseDepth" />
                  <Slider label="Front setback" value={p.setbackFront} min={0} max={50} field="setbackFront" />
                  <Slider label="Side setback" value={p.setbackSide} min={0} max={30} field="setbackSide" />
                  <Slider label="Rear setback" value={p.setbackRear} min={0} max={50} field="setbackRear" />
                  <Slider label="House offset from left" value={p.houseOffsetSide} min={5} max={Math.max(5, p.lotWidth - p.houseWidth - 5)} field="houseOffsetSide" />
                </>}

                {sitePlanMode === "upload" && (
                  <div style={{ textAlign: "center", padding: 20, border: `2px dashed ${sitePlanFile ? br.gn : br.bd}`, borderRadius: 8, background: sitePlanFile ? "#edf5e8" : "#fff", cursor: "pointer", position: "relative" }}
                    onClick={() => document.getElementById("sitePlanInput").click()}>
                    <input id="sitePlanInput" type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: "none" }} onChange={e => {
                      const file = e.target.files[0]; if (!file) return;
                      setSitePlanFile(file);
                      const reader = new FileReader();
                      reader.onload = () => setSitePlanB64(reader.result.split(",")[1]);
                      reader.readAsDataURL(file);
                    }} />
                    {sitePlanFile ? (
                      <div>
                        <div style={{ fontSize: 20, marginBottom: 6 }}>{"\u2713"}</div>
                        <div style={{ fontSize: 11, fontFamily: mono, color: br.gn, fontWeight: 700 }}>{sitePlanFile.name}</div>
                        <div style={{ fontSize: 9, fontFamily: mono, color: br.mu, marginTop: 4 }}>{(sitePlanFile.size / 1024).toFixed(0)} KB · Click to change</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{"\uD83D\uDCC4"}</div>
                        <div style={{ fontSize: 11, fontFamily: mono, color: br.tx, fontWeight: 600 }}>Click to upload your survey</div>
                        <div style={{ fontSize: 9, fontFamily: mono, color: br.mu, marginTop: 4 }}>PDF, PNG, or JPG</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>}
            {step === 1 && <>
              <Chips label="Joist spacing" field="joistSpacing" opts={[[12, '12" O.C.'], [16, '16" O.C.'], [24, '24" O.C.']]} />
              <Chips label="Snow load" field="snowLoad" opts={[["none", "None"], ["light", "Light"], ["moderate", "Moderate"], ["heavy", "Heavy"]]} />
              <Chips label="Frost zone" field="frostZone" opts={[["warm", '12"'], ["moderate", '24"'], ["cold", '36"'], ["severe", '48"']]} />

              <div style={{ marginTop: 16, padding: 14, background: br.wr, borderRadius: 8, border: `1px solid ${br.bd}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: br.gn, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase" }}>Structural Members</div>
                  <div style={{ fontSize: 8, color: br.mu, fontFamily: mono }}>AUTO = IRC recommended</div>
                </div>

                {(() => { const isOver = !!p.overJoist; const val = isOver ? p.overJoist : c.auto.joist; return (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: br.mu, fontFamily: mono, fontWeight: 700 }}>JOISTS</span>
                      <button onClick={() => u("overJoist", isOver ? null : c.auto.joist)} style={{ fontSize: 8, fontFamily: mono, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${isOver ? br.ac : br.bd}`, background: isOver ? "#fef9e7" : "#fff", color: isOver ? br.ac : br.mu, fontWeight: 700 }}>{isOver ? "MANUAL \u270E" : "AUTO \u2713"}</button>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {["2x6", "2x8", "2x10", "2x12"].map(sz => (
                        <button key={sz} onClick={() => isOver && u("overJoist", sz)} style={{
                          flex: 1, padding: "6px 4px", fontSize: 10, fontFamily: mono, cursor: isOver ? "pointer" : "default",
                          border: val === sz ? `2px solid ${isOver ? br.ac : br.gn}` : `1px solid ${br.bd}`,
                          background: val === sz ? (isOver ? "#fef9e7" : "#edf5e8") : (isOver ? "#fff" : "#fafafa"),
                          color: val === sz ? (isOver ? br.ac : br.gn) : (isOver ? br.tx : "#ccc"),
                          borderRadius: 5, fontWeight: val === sz ? 700 : 400, opacity: isOver ? 1 : 0.7,
                          textAlign: "center", position: "relative",
                        }}>
                          {sz}
                          {!isOver && sz === c.auto.joist && <div style={{ fontSize: 6, color: br.gn, marginTop: 1 }}>REC</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                ); })()}

                {(() => { const isOver = !!p.overBeam; const val = isOver ? p.overBeam : c.auto.beam; const opts = ["2-ply 2x10", "3-ply 2x10", "3-ply 2x12", "3-ply LVL 1.75x12"]; return (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: br.mu, fontFamily: mono, fontWeight: 700 }}>BEAM</span>
                      <button onClick={() => u("overBeam", isOver ? null : c.auto.beam)} style={{ fontSize: 8, fontFamily: mono, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${isOver ? br.ac : br.bd}`, background: isOver ? "#fef9e7" : "#fff", color: isOver ? br.ac : br.mu, fontWeight: 700 }}>{isOver ? "MANUAL \u270E" : "AUTO \u2713"}</button>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {opts.map(sz => { const short = sz.replace("1.75x12", "LVL").replace("-ply ", "\u00D7"); return (
                        <button key={sz} onClick={() => isOver && u("overBeam", sz)} style={{
                          flex: "1 1 auto", padding: "6px 6px", fontSize: 9, fontFamily: mono, cursor: isOver ? "pointer" : "default",
                          border: val === sz ? `2px solid ${isOver ? br.ac : br.gn}` : `1px solid ${br.bd}`,
                          background: val === sz ? (isOver ? "#fef9e7" : "#edf5e8") : (isOver ? "#fff" : "#fafafa"),
                          color: val === sz ? (isOver ? br.ac : br.gn) : (isOver ? br.tx : "#ccc"),
                          borderRadius: 5, fontWeight: val === sz ? 700 : 400, opacity: isOver ? 1 : 0.7, textAlign: "center",
                        }}>
                          {short}
                          {!isOver && sz === c.auto.beam && <div style={{ fontSize: 6, color: br.gn, marginTop: 1 }}>REC</div>}
                        </button>
                      ); })}
                    </div>
                  </div>
                ); })()}

                {(() => { const isOver = !!p.overPostSize; const val = isOver ? p.overPostSize : c.auto.postSize; return (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: br.mu, fontFamily: mono, fontWeight: 700 }}>POST SIZE</span>
                      <button onClick={() => u("overPostSize", isOver ? null : c.auto.postSize)} style={{ fontSize: 8, fontFamily: mono, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${isOver ? br.ac : br.bd}`, background: isOver ? "#fef9e7" : "#fff", color: isOver ? br.ac : br.mu, fontWeight: 700 }}>{isOver ? "MANUAL \u270E" : "AUTO \u2713"}</button>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {["4x4", "6x6"].map(sz => (
                        <button key={sz} onClick={() => isOver && u("overPostSize", sz)} style={{
                          flex: 1, padding: "6px 4px", fontSize: 10, fontFamily: mono, cursor: isOver ? "pointer" : "default",
                          border: val === sz ? `2px solid ${isOver ? br.ac : br.gn}` : `1px solid ${br.bd}`,
                          background: val === sz ? (isOver ? "#fef9e7" : "#edf5e8") : (isOver ? "#fff" : "#fafafa"),
                          color: val === sz ? (isOver ? br.ac : br.gn) : (isOver ? br.tx : "#ccc"),
                          borderRadius: 5, fontWeight: val === sz ? 700 : 400, opacity: isOver ? 1 : 0.7, textAlign: "center",
                        }}>
                          {sz}
                          {!isOver && sz === c.auto.postSize && <div style={{ fontSize: 6, color: br.gn, marginTop: 1 }}>REC</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                ); })()}

                {(() => { const isOver = !!p.overPostCount; const val = isOver ? p.overPostCount : c.auto.postCount; return (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: br.mu, fontFamily: mono, fontWeight: 700 }}>POST COUNT</span>
                      <button onClick={() => u("overPostCount", isOver ? null : c.auto.postCount)} style={{ fontSize: 8, fontFamily: mono, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${isOver ? br.ac : br.bd}`, background: isOver ? "#fef9e7" : "#fff", color: isOver ? br.ac : br.mu, fontWeight: 700 }}>{isOver ? "MANUAL \u270E" : "AUTO \u2713"}</button>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[2, 3, 4, 5, 6].map(n => (
                        <button key={n} onClick={() => isOver && u("overPostCount", n)} style={{
                          flex: 1, padding: "6px 4px", fontSize: 10, fontFamily: mono, cursor: isOver ? "pointer" : "default",
                          border: val === n ? `2px solid ${isOver ? br.ac : br.gn}` : `1px solid ${br.bd}`,
                          background: val === n ? (isOver ? "#fef9e7" : "#edf5e8") : (isOver ? "#fff" : "#fafafa"),
                          color: val === n ? (isOver ? br.ac : br.gn) : (isOver ? br.tx : "#ccc"),
                          borderRadius: 5, fontWeight: val === n ? 700 : 400, opacity: isOver ? 1 : 0.7, textAlign: "center",
                        }}>
                          {n}
                          {!isOver && n === c.auto.postCount && <div style={{ fontSize: 6, color: br.gn, marginTop: 1 }}>REC</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                ); })()}

                {(() => { const isOver = !!p.overFooting; const val = isOver ? p.overFooting : c.auto.footing; return (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: br.mu, fontFamily: mono, fontWeight: 700 }}>FOOTING DIA.</span>
                      <button onClick={() => u("overFooting", isOver ? null : c.auto.footing)} style={{ fontSize: 8, fontFamily: mono, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${isOver ? br.ac : br.bd}`, background: isOver ? "#fef9e7" : "#fff", color: isOver ? br.ac : br.mu, fontWeight: 700 }}>{isOver ? "MANUAL \u270E" : "AUTO \u2713"}</button>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[12, 16, 18, 21, 24, 30].map(d => (
                        <button key={d} onClick={() => isOver && u("overFooting", d)} style={{
                          flex: 1, padding: "6px 2px", fontSize: 9, fontFamily: mono, cursor: isOver ? "pointer" : "default",
                          border: val === d ? `2px solid ${isOver ? br.ac : br.gn}` : `1px solid ${br.bd}`,
                          background: val === d ? (isOver ? "#fef9e7" : "#edf5e8") : (isOver ? "#fff" : "#fafafa"),
                          color: val === d ? (isOver ? br.ac : br.gn) : (isOver ? br.tx : "#ccc"),
                          borderRadius: 5, fontWeight: val === d ? 700 : 400, opacity: isOver ? 1 : 0.7, textAlign: "center",
                        }}>
                          {d}"
                          {!isOver && d === c.auto.footing && <div style={{ fontSize: 6, color: br.gn, marginTop: 1 }}>REC</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                ); })()}

                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontFamily: mono, letterSpacing: 1, color: br.mu, fontWeight: 700 }}>BEAM TYPE</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["dropped", "flush"].map(bt => (
                      <button key={bt} onClick={() => u("beamType", bt)} style={{
                        flex: 1, padding: "6px 4px", fontSize: 11, fontFamily: mono,
                        cursor: "pointer", borderRadius: 4,
                        border: `1px solid ${p.beamType === bt ? br.ac : br.bd}`,
                        background: p.beamType === bt ? br.ac : "#fff",
                        color: p.beamType === bt ? "#fff" : br.mu,
                        fontWeight: p.beamType === bt ? 700 : 400,
                        textTransform: "capitalize"
                      }}>{bt === "dropped" ? "Dropped" : "Flush"}</button>
                    ))}
                  </div>
                  {p.beamType === "flush" && (
                    <div style={{ fontSize: 9, color: br.mu, marginTop: 4, fontStyle: "italic" }}>
                      Beam sits inline with joists — requires LUS joist hangers
                    </div>
                  )}
                </div>
                <div style={{ height: 1, background: br.bd, margin: "10px 0" }} />
                <Spec l="Joist Span" v={`${c.jSpan}'`} /><Spec l="Beam Span" v={`${c.bSpan}'`} /><Spec l="Total Load" v={`${c.TL} PSF`} color={br.rd} />
                {c.warnings.map((w, i) => <div key={i} style={{ fontSize: 10, color: br.rd, marginTop: 4, fontFamily: mono }}>{"\u26A0\uFE0F"} {w}</div>)}
              </div>
            </>}
            {step === 2 && <>
              <Chips label="Decking" field="deckingType" opts={[["composite", "Composite (Trex)"], ["pt_lumber", "Pressure Treated"]]} />
              <Chips label="Railing" field="railType" opts={[["fortress", "Fortress Iron"], ["wood", "Wood"]]} />
              <div style={{ marginTop: 16, padding: 14, background: br.wr, borderRadius: 8, border: `1px solid ${br.bd}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: br.gn, marginBottom: 6, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase" }}>Cost Breakdown</div>
                {["Foundation", "Posts", "Beam", "Ledger", "Framing", "Hardware", "Decking", "Railing", "Misc"].map(cat => { const t = m.items.filter(i => i.cat === cat).reduce((s, i) => s + i.qty * i.cost, 0); return t > 0 ? <Spec key={cat} l={cat} v={`$${t.toFixed(0)}`} /> : null; })}
                <div style={{ height: 2, background: br.gn, margin: "8px 0", opacity: 0.3 }} />
                <Spec l="Subtotal" v={`$${m.sub.toFixed(0)}`} /><Spec l="Tax + Contingency" v={`$${(m.tax + m.cont).toFixed(0)}`} /><Spec l="TOTAL" v={`$${m.total.toFixed(0)}`} color={br.gn} />
              </div>
            </>}
            {step === 3 && <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: br.gn, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Blueprint Preview</div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  <div style={{ flex: "0 0 auto", width: 200, background: "#fff", border: `1px solid ${br.bd}`, borderRadius: 6, overflow: "hidden", position: "relative" }}>
                    <div style={{ padding: "4px 8px", background: br.wr, borderBottom: `1px solid ${br.bd}` }}>
                      <span style={{ fontSize: 7, fontFamily: mono, fontWeight: 700, color: br.mu }}>SHEET A-1 — DECK PLAN</span>
                    </div>
                    <div style={{ padding: 4, height: 130 }}>
                      <svg viewBox="0 0 200 120" style={{ width: "100%", height: "100%" }}>
                        <rect x="30" y="5" width={Math.min(140, c.W * 3.5)} height={15} fill="#e8e6e0" stroke="#888" strokeWidth="0.5" />
                        <text x={30 + Math.min(140, c.W * 3.5) / 2} y="14" textAnchor="middle" style={{ fontSize: 4, fill: "#aaa" }}>HOUSE</text>
                        <rect x="30" y="20" width={Math.min(140, c.W * 3.5)} height={Math.min(80, c.D * 5)} fill="#efe5d5" stroke="#333" strokeWidth="0.8" />
                        {c.attachment === "ledger" && <line x1="30" y1="20" x2={30 + Math.min(140, c.W * 3.5)} y2="20" stroke="#2e7d32" strokeWidth="1.5" />}
                        {Array.from({ length: Math.min(20, Math.ceil(c.W / (c.sp / 12))) }, (_, i) => {
                          const x = 30 + (i + 1) * Math.min(140, c.W * 3.5) / Math.ceil(c.W / (c.sp / 12));
                          return x < 30 + Math.min(140, c.W * 3.5) ? <line key={i} x1={x} y1="21" x2={x} y2={20 + Math.min(80, c.D * 5) - 8} stroke="#ddd" strokeWidth="0.2" /> : null;
                        })}
                        <line x1="32" y1={20 + Math.min(80, c.D * 5) - 8} x2={28 + Math.min(140, c.W * 3.5)} y2={20 + Math.min(80, c.D * 5) - 8} stroke="#c4960a" strokeWidth="1.5" />
                        {c.pp.map((px, i) => <circle key={i} cx={30 + (px / c.W) * Math.min(140, c.W * 3.5)} cy={20 + Math.min(80, c.D * 5) - 8} r="2" fill="#c4a060" stroke="#444" strokeWidth="0.3" />)}
                        <text x={30 + Math.min(140, c.W * 3.5) / 2} y={20 + Math.min(80, c.D * 5) / 2} textAnchor="middle" style={{ fontSize: 5, fill: "#888" }}>{c.joistSize} @ {c.sp}" O.C.</text>
                        <text x={30 + Math.min(140, c.W * 3.5) / 2} y={20 + Math.min(80, c.D * 5) + 8} textAnchor="middle" style={{ fontSize: 5, fill: "#c62828", fontWeight: 700 }}>{c.W}'-0"</text>
                      </svg>
                    </div>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: "rgba(61,90,46,0.08)", fontFamily: mono, transform: "rotate(-20deg)", letterSpacing: 4 }}>PREVIEW</span>
                    </div>
                  </div>

                  <div style={{ flex: "0 0 auto", width: 200, background: "#fff", border: `1px solid ${br.bd}`, borderRadius: 6, overflow: "hidden", position: "relative" }}>
                    <div style={{ padding: "4px 8px", background: br.wr, borderBottom: `1px solid ${br.bd}` }}>
                      <span style={{ fontSize: 7, fontFamily: mono, fontWeight: 700, color: br.mu }}>SHEET A-2 — ELEVATIONS</span>
                    </div>
                    <div style={{ padding: 4, height: 130 }}>
                      <svg viewBox="0 0 200 120" style={{ width: "100%", height: "100%" }}>
                        <line x1="15" y1="85" x2="185" y2="85" stroke="#444" strokeWidth="0.5" />
                        {(() => { const dw = Math.min(150, c.W * 3.5); const dx = (200 - dw) / 2; const hSc = Math.min(4, 50 / c.H); const dy = 85 - c.H * hSc; return (<>
                          <rect x={dx} y="15" width={dw} height={70} fill="#e8e6e0" stroke="#888" strokeWidth="0.3" />
                          <polygon points={`${dx - 3},15 ${dx + dw / 2},5 ${dx + dw + 3},15`} fill="#888" stroke="#444" strokeWidth="0.3" />
                          {c.pp.map((px, i) => <line key={i} x1={dx + (px / c.W) * dw} y1="85" x2={dx + (px / c.W) * dw} y2={dy} stroke="#c4a060" strokeWidth="1" />)}
                          <rect x={dx + 2} y={dy + 1} width={dw - 4} height={3} fill="#c4960a" fillOpacity="0.8" stroke="#444" strokeWidth="0.2" />
                          <line x1={dx} y1={dy} x2={dx + dw} y2={dy} stroke="#6B5340" strokeWidth="1.5" />
                          <line x1={dx} y1={dy - c.H * hSc * 0.4} x2={dx + dw} y2={dy - c.H * hSc * 0.4} stroke="#333" strokeWidth="0.8" />
                          <text x={dx + dw + 4} y={(85 + dy) / 2 + 1} style={{ fontSize: 5, fill: "#1565c0", fontWeight: 700 }}>{c.H}'</text>
                          <text x={dx + dw / 2} y="97" textAnchor="middle" style={{ fontSize: 5, fill: "#c62828", fontWeight: 700 }}>{c.W}'-0"</text>
                        </>); })()}
                      </svg>
                    </div>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: "rgba(61,90,46,0.08)", fontFamily: mono, transform: "rotate(-20deg)", letterSpacing: 4 }}>PREVIEW</span>
                    </div>
                  </div>

                  <div style={{ flex: "0 0 auto", width: 200, background: "#fff", border: `1px solid ${br.bd}`, borderRadius: 6, overflow: "hidden", position: "relative" }}>
                    <div style={{ padding: "4px 8px", background: br.wr, borderBottom: `1px solid ${br.bd}` }}>
                      <span style={{ fontSize: 7, fontFamily: mono, fontWeight: 700, color: br.mu }}>SHEET A-3 — DETAILS</span>
                    </div>
                    <div style={{ padding: 8, height: 130, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 4 }}>
                      {[
                        { t: "LEDGER DETAIL", lines: [[10, 30, 10, 80], [10, 30, 60, 30], [20, 30, 20, 80], [30, 35, 30, 75], [40, 35, 40, 75]] },
                        { t: "FOOTING DETAIL", lines: [[25, 20, 25, 70], [45, 20, 45, 70], [25, 70, 45, 70], [30, 15, 40, 15], [30, 15, 30, 20], [40, 15, 40, 20]] },
                        { t: "GUARD RAIL", lines: [[5, 65, 65, 65], [5, 15, 65, 15], [5, 15, 5, 65], [65, 15, 65, 65]] },
                        { t: "POST / BEAM", lines: [[25, 80, 25, 30], [45, 80, 45, 30], [10, 30, 60, 30], [10, 25, 60, 25]] },
                      ].map((detail, di) => (
                        <div key={di} style={{ background: "#fcfcfa", border: `0.5px solid ${br.bd}`, borderRadius: 3, position: "relative", overflow: "hidden" }}>
                          <svg viewBox="0 0 70 90" style={{ width: "100%", height: "100%" }}>
                            {detail.lines.map(([x1, y1, x2, y2], li) => <line key={li} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#bbb" strokeWidth="0.5" />)}
                            <text x="35" y="87" textAnchor="middle" style={{ fontSize: 4.5, fill: "#aaa", fontWeight: 600 }}>{detail.t}</text>
                          </svg>
                        </div>
                      ))}
                    </div>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: "rgba(61,90,46,0.08)", fontFamily: mono, transform: "rotate(-20deg)", letterSpacing: 4 }}>PREVIEW</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "center", marginTop: 6 }}>
                  <span style={{ fontSize: 8, color: br.mu, fontFamily: mono }}>4 sheets included · Plan · Elevations · Details · Materials</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
                <div style={{ padding: 12, background: br.wr, borderRadius: 8, border: `1px solid ${br.bd}` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: br.gn, marginBottom: 6, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase" }}>Project</div>
                  <Spec l="Size" v={`${c.W}'\u00D7${c.D}' (${c.area} SF)`} /><Spec l="Height" v={`${c.H}'`} /><Spec l="Attach" v={c.attachment === "ledger" ? "Ledger" : "Free"} /><Spec l="Stairs" v={p.hasStairs ? `${p.stairLocation} ${p.stairWidth || 4}' \u00B7 ${p.numStringers || 3} stringers${p.hasLanding ? " \u00B7 landing" : ""}` : "None"} /><Spec l="Deck" v={p.deckingType === "composite" ? "Composite" : "PT"} /><Spec l="Rail" v={p.railType === "fortress" ? "Fortress" : "Wood"} />
                </div>
                <div style={{ padding: 12, background: br.wr, borderRadius: 8, border: `1px solid ${br.bd}` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: br.gn, marginBottom: 6, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase" }}>Structure</div>
                  <Spec l="Joists" v={`${c.joistSize}@${c.sp}"`} /><Spec l="Beam" v={c.beamSize.replace("3-ply ","3\u00D7").replace("2-ply ","2\u00D7")} /><Spec l="Posts" v={`${c.postSize}\u00D7${c.nP}`} /><Spec l="Footings" v={`${c.fDiam}"\u00D8\u00D7${c.nF}`} /><Spec l="Load" v={`${c.TL} PSF`} color={br.rd} />
                  {c.warnings.length > 0 && <div style={{ fontSize: 8, color: br.rd, marginTop: 4, fontFamily: mono }}>{"\u26A0\uFE0F"} {c.warnings.length} warning{c.warnings.length > 1 ? "s" : ""}</div>}
                </div>
              </div>

              <div style={{ padding: 14, background: br.wr, borderRadius: 8, border: `1px solid ${br.bd}`, marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: br.gn, marginBottom: 10, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase" }}>Project Information <span style={{ fontWeight: 400, color: br.mu, fontSize: 8 }}>(prints on title block)</span></div>
                {[["owner", "Owner / Applicant Name"],["address", "Project Address"],["city", "City"]].map(([f, lbl]) => (
                  <div key={f} style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 9, color: br.mu, fontFamily: mono, display: "block", marginBottom: 2 }}>{lbl}</label>
                    <input value={info[f]} onChange={e => setI(f, e.target.value)} placeholder={lbl}
                      style={{ width: "100%", padding: "7px 10px", border: `1px solid ${br.bd}`, borderRadius: 5, fontSize: 12, fontFamily: mono, color: br.tx, background: "#fff", outline: "none" }} />
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 9, color: br.mu, fontFamily: mono, display: "block", marginBottom: 2 }}>State</label>
                    <input value={info.state} onChange={e => setI("state", e.target.value)} placeholder="State"
                      style={{ width: "100%", padding: "7px 10px", border: `1px solid ${br.bd}`, borderRadius: 5, fontSize: 12, fontFamily: mono, color: br.tx, background: "#fff", outline: "none" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 9, color: br.mu, fontFamily: mono, display: "block", marginBottom: 2 }}>ZIP</label>
                    <input value={info.zip} onChange={e => setI("zip", e.target.value)} placeholder="ZIP"
                      style={{ width: "100%", padding: "7px 10px", border: `1px solid ${br.bd}`, borderRadius: 5, fontSize: 12, fontFamily: mono, color: br.tx, background: "#fff", outline: "none" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 9, color: br.mu, fontFamily: mono, display: "block", marginBottom: 2 }}>Lot / Parcel #</label>
                    <input value={info.lot} onChange={e => setI("lot", e.target.value)} placeholder="Optional"
                      style={{ width: "100%", padding: "7px 10px", border: `1px solid ${br.bd}`, borderRadius: 5, fontSize: 12, fontFamily: mono, color: br.tx, background: "#fff", outline: "none" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 9, color: br.mu, fontFamily: mono, display: "block", marginBottom: 2 }}>Contractor</label>
                    <input value={info.contractor} onChange={e => setI("contractor", e.target.value)} placeholder="Owner-Builder"
                      style={{ width: "100%", padding: "7px 10px", border: `1px solid ${br.bd}`, borderRadius: 5, fontSize: 12, fontFamily: mono, color: br.tx, background: "#fff", outline: "none" }} />
                  </div>
                </div>
              </div>

              {isProduction && !feedbackDone && <div style={{ padding: 16, background: "#fff8e1", borderRadius: 8, border: "1px solid #ffe082", marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#f57f17", fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Quick Feedback <span style={{ fontWeight: 400, color: "#ffa000", fontSize: 8 }}>(helps us build what you need)</span></div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 9, color: br.mu, fontFamily: mono, display: "block", marginBottom: 2 }}>I am a...</label>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {[["diy", "DIY Homeowner"], ["contractor", "Contractor"], ["designer", "Designer"], ["other", "Other"]].map(([v, t]) => (
                      <button key={v} onClick={() => setFeedback(f => ({...f, role: v}))} style={{ padding: "5px 12px", borderRadius: 5, fontSize: 10, fontFamily: mono, cursor: "pointer", border: feedback.role === v ? "2px solid #f57f17" : "1px solid " + br.bd, background: feedback.role === v ? "#fff3e0" : "#fff", color: feedback.role === v ? "#e65100" : br.tx, fontWeight: feedback.role === v ? 700 : 400 }}>{t}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 9, color: br.mu, fontFamily: mono, display: "block", marginBottom: 2 }}>How did you find us?</label>
                  <input value={feedback.source} onChange={e => setFeedback(f => ({...f, source: e.target.value}))} placeholder="Google, Reddit, friend, etc." style={{ width: "100%", padding: "6px 10px", border: "1px solid " + br.bd, borderRadius: 5, fontSize: 11, fontFamily: mono, color: br.tx, background: "#fff", outline: "none" }} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 9, color: br.mu, fontFamily: mono, display: "block", marginBottom: 2 }}>What would you pay for this?</label>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {[["$0", "$0"], ["$25-49", "$25\u201349"], ["$50-99", "$50\u201399"], ["$100+", "$100+"]].map(([v, t]) => (
                      <button key={v} onClick={() => setFeedback(f => ({...f, price: v}))} style={{ padding: "5px 12px", borderRadius: 5, fontSize: 10, fontFamily: mono, cursor: "pointer", border: feedback.price === v ? "2px solid #f57f17" : "1px solid " + br.bd, background: feedback.price === v ? "#fff3e0" : "#fff", color: feedback.price === v ? "#e65100" : br.tx, fontWeight: feedback.price === v ? 700 : 400 }}>{t}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 9, color: br.mu, fontFamily: mono, display: "block", marginBottom: 2 }}>Anything confusing or missing? <span style={{ color: "#bbb" }}>(optional)</span></label>
                  <textarea value={feedback.feedback} onChange={e => setFeedback(f => ({...f, feedback: e.target.value}))} placeholder="Your thoughts..." rows={2} style={{ width: "100%", padding: "6px 10px", border: "1px solid " + br.bd, borderRadius: 5, fontSize: 11, fontFamily: mono, color: br.tx, background: "#fff", outline: "none", resize: "vertical" }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 9, color: br.mu, fontFamily: mono, display: "block", marginBottom: 2 }}>Email <span style={{ color: "#bbb" }}>(optional — for launch notification)</span></label>
                  <input type="email" value={feedback.email} onChange={e => setFeedback(f => ({...f, email: e.target.value}))} placeholder="you@example.com" style={{ width: "100%", padding: "6px 10px", border: "1px solid " + br.bd, borderRadius: 5, fontSize: 11, fontFamily: mono, color: br.tx, background: "#fff", outline: "none" }} />
                </div>
                <button onClick={submitFeedback} disabled={!feedback.role || !feedback.price} style={{ padding: "8px 20px", background: !feedback.role || !feedback.price ? "#ccc" : "#f57f17", border: "none", borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 700, cursor: !feedback.role || !feedback.price ? "default" : "pointer", fontFamily: mono }}>Submit Feedback</button>
                <span style={{ fontSize: 8, color: "#bbb", fontFamily: mono, marginLeft: 8 }}>Required to generate on this domain</span>
              </div>}
              {isProduction && feedbackDone && <div style={{ padding: 10, background: "#e8f5e9", borderRadius: 8, border: "1px solid #c8e6c9", marginBottom: 14, textAlign: "center" }}>
                <span style={{ fontSize: 11, color: "#2e7d32", fontFamily: mono, fontWeight: 700 }}>{"\u2713"} Thanks for your feedback!</span>
              </div>}

              <div style={{ padding: 16, background: "#e8f5e9", borderRadius: 8, border: "1px solid #c8e6c9", textAlign: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontFamily: mono, color: br.gn, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>Estimated Materials</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: br.gn, fontFamily: mono }}>${m.total.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: "#66bb6a", fontFamily: mono }}>Includes tax + 5% contingency</div>
              </div>

              <div style={{ background: br.dk, borderRadius: 10, padding: 20, textAlign: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontFamily: mono, color: "rgba(255,255,255,0.5)", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6 }}>Your Blueprint Package</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
                  {["Plan View", "Framing Plan", "Elevations", "Details", "Material List"].map(s => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: "#66bb6a", fontSize: 11 }}>{"\u2713"}</span>
                      <span style={{ fontSize: 10, fontFamily: mono, color: "rgba(255,255,255,0.8)" }}>{s}</span>
                    </div>
                  ))}
                </div>
                {user ? <>
                <button
                  onClick={generateBlueprint}
                  disabled={genStatus === "generating" || (isProduction && !feedbackDone)}
                  style={{ padding: "14px 40px", background: genStatus === "generating" ? "#555" : genStatus === "done" ? "#2e7d32" : br.gn, color: "#fff", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 800, cursor: genStatus === "generating" ? "wait" : "pointer", fontFamily: mono, letterSpacing: "1px", boxShadow: "0 4px 20px rgba(61,90,46,0.4)", transition: "all 0.2s" }}>
                  {genStatus === "generating" ? "Generating PDF..." : genStatus === "done" ? "\u2713 Download Complete — Generate Again?" : "Generate Blueprint — FREE BETA"}
                </button>
                {genStatus === "error" && <div style={{ fontSize: 10, color: "#f44336", fontFamily: mono, marginTop: 8 }}>Error: {genError}</div>}
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: mono, marginTop: 8 }}>
                  {genStatus === "done" ? "PDF opened in new tab \u00B7 Check your downloads" : "Instant PDF download \u00B7 Print-ready quality \u00B7 Permit-office format"}
                </div>
                </> : <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: mono, marginBottom: 12 }}>Sign in to generate your blueprint</div>
                  <button onClick={() => { window.location.href = `${API}/auth/login`; }} style={{ padding: "12px 32px", background: "#fff", color: "#333", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: mono, display: "inline-flex", alignItems: "center", gap: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
                    <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.04 24.04 0 000 21.56l7.98-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                    Sign in with Google
                  </button>
                </div>}
              </div>
            </>}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button onClick={() => step > 0 ? setStep(step - 1) : setPage("home")} style={{ padding: "9px 18px", border: `1px solid ${br.bd}`, borderRadius: 6, background: "transparent", color: br.mu, cursor: "pointer", fontFamily: mono, fontSize: 11, fontWeight: 600 }}>{"\u2190"} {step > 0 ? "Back" : "Home"}</button>
              {step < 3 && <button onClick={() => setStep(step + 1)} style={{ padding: "9px 18px", border: "none", borderRadius: 6, background: br.gn, color: "#fff", cursor: "pointer", fontFamily: mono, fontSize: 11, fontWeight: 700 }}>Next {"\u2192"}</button>}
            </div>
          </div>
        </div>

        {/* RIGHT: PREVIEW */}
        <div style={{ flex: "1 1 500px", minWidth: 280 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 18, border: `1px solid ${br.bd}`, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: br.dk, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase" }}>Preview</h3>
              <div style={{ display: "flex", gap: 1 }}>
                {views.map(([id, label], i) => <button key={id} onClick={() => setView(id)} style={{ padding: "5px 12px", fontSize: 10, cursor: "pointer", fontFamily: mono, border: view === id ? `1px solid ${br.gn}` : `1px solid ${br.bd}`, background: view === id ? br.gn : "transparent", color: view === id ? "#fff" : br.mu, borderRadius: i === 0 ? "4px 0 0 4px" : i === views.length - 1 ? "0 4px 4px 0" : 0, fontWeight: view === id ? 700 : 400 }}>{label}</button>)}
              </div>
            </div>

            <div style={{ background: view === "3d" ? "transparent" : br.cr, border: view === "3d" ? "none" : `1px solid ${br.bd}`, borderRadius: 6, padding: view === "3d" ? 0 : 12, minHeight: 320 }}>
              {view === "plan" && <>
                <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                  {[["plan", "Deck Plan"], ["framing", "Framing"]].map(([id, label]) => <button key={id} onClick={() => setPlanMode(id)} style={{ padding: "4px 10px", fontSize: 9, fontFamily: mono, cursor: "pointer", border: planMode === id ? `1px solid ${br.gn}` : `1px solid ${br.bd}`, background: planMode === id ? br.gn : "transparent", color: planMode === id ? "#fff" : br.mu, borderRadius: 4, fontWeight: planMode === id ? 700 : 400 }}>{label}</button>)}
                </div>
                <PlanView p={p} c={c} mode={planMode} u={u} />
                {planMode === "plan" && <div style={{ textAlign: "center", fontSize: 9, color: br.mu, fontFamily: mono, marginTop: 4, opacity: 0.7 }}>
                  Drag the <span style={{ color: "#3d5a2e", fontWeight: 700 }}>green</span> handle to slide the deck · Click <span style={{ color: "#c62828", fontWeight: 700 }}>stairs</span> to select, drag to move, grab <span style={{ color: "#3d5a2e", fontWeight: 700 }}>{"\u21BB"}</span> to rotate
                </div>}
              </>}
              {view === "elevation" && <ElevationView c={c} p={p} />}
              {view === "3d" && <Deck3D c={c} p={p} />}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 12 }}>
              {[["Area", `${c.area} SF`, br.dk], ["Joists", c.joistSize, br.bl], ["Beam", c.beamSize.replace("3-ply ", "3\u00D7").replace("2-ply ", "2\u00D7"), br.ac], ["Posts", `${c.postSize}\u00D7${c.nP}`, "#8B6508"], ["Footings", `${c.fDiam}"\u00D8`, "#777"], ["Est. Cost", `$${m.total.toFixed(0)}`, br.gn]].map(([l, v, cl]) => (
                <div key={l} style={{ padding: "8px 10px", background: br.cr, borderRadius: 6, border: `1px solid ${br.bd}`, textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: br.mu, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.5px" }}>{l}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: cl, fontFamily: mono, marginTop: 1 }}>{v}</div>
                </div>
              ))}
            </div>

            {step >= 2 && <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: br.mu, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>Materials</div>
              <div style={{ maxHeight: 200, overflowY: "auto", borderRadius: 6, border: `1px solid ${br.bd}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 10 }}>
                  <thead><tr style={{ background: br.wr }}><th style={{ textAlign: "left", padding: "5px 8px", color: br.mu, fontSize: 8 }}>ITEM</th><th style={{ textAlign: "center", padding: "5px 8px", color: br.mu, fontSize: 8 }}>QTY</th><th style={{ textAlign: "right", padding: "5px 8px", color: br.mu, fontSize: 8 }}>EXT</th></tr></thead>
                  <tbody>{m.items.map((it, i) => <tr key={i} style={{ borderBottom: `1px solid ${br.wr}` }}><td style={{ padding: "4px 8px", color: br.tx }}>{it.item}</td><td style={{ padding: "4px 8px", textAlign: "center", color: br.bl, fontWeight: 700 }}>{it.qty}</td><td style={{ padding: "4px 8px", textAlign: "right", color: br.dk }}>${(it.qty * it.cost).toFixed(0)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
