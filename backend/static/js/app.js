// ============================================================
// MAIN APP ÃÂ¢ÃÂÃÂ Wizard Shell, State, Nav, Preview Panel
// ============================================================
const { useState, useMemo, useEffect, useRef } = React;

const DEF_CORNERS = { BL: { type: "square", size: 0 }, BR: { type: "square", size: 0 }, FL: { type: "square", size: 0 }, FR: { type: "square", size: 0 } };

// S36: Polygon lot helpers (rectangle fallback)
window.computeRectVertices = function(p) {
  var w = p.lotWidth || 80, d = p.lotDepth || 120;
  return [[0, 0], [w, 0], [w, d], [0, d]];
};
window.computeRectEdges = function(p) {
  var w = p.lotWidth || 80, d = p.lotDepth || 120;
  var street = p.streetName || "";
  return [
    { type: "street", label: street, length: w, setbackType: "front", neighborLabel: "" },
    { type: "property", label: "", length: d, setbackType: "side", neighborLabel: "" },
    { type: "property", label: "", length: w, setbackType: "rear", neighborLabel: "" },
    { type: "property", label: "", length: d, setbackType: "side", neighborLabel: "" }
  ];
};

// S38: Setback gap calculator (polygon-aware)
// Returns array of {edgeIdx, setbackType, required, gap, warn} for each edge with a setback.
// gap = min signed distance from deck bounding box corners to lot edge (inward positive).
window.computeSetbackGaps = function(p) {
  var verts = p.lotVertices || window.computeRectVertices(p);
  var edges = p.lotEdges || window.computeRectEdges(p);
  var n = verts.length;

  // Deck bounding box corners in lot coordinates
  var hx = p.houseOffsetSide || 20;
  var hy = p.houseDistFromStreet || p.setbackFront || 25;
  var hw = p.houseWidth || 40;
  var hd = p.houseDepth || 30;
  var dw = p.width || 20;
  var dd = p.depth || 12;
  var dOff = p.deckOffset || 0;
  var dx = hx + hw / 2 + dOff - dw / 2;
  var dy = hy + hd;
  var deckCorners = [
    [dx, dy], [dx + dw, dy], [dx + dw, dy + dd], [dx, dy + dd]
  ];

  // Lot centroid for inward normal direction
  var cx = 0, cy = 0;
  for (var i = 0; i < n; i++) { cx += verts[i][0]; cy += verts[i][1]; }
  cx /= n; cy /= n;

  var results = [];
  for (var ei = 0; ei < n; ei++) {
    var eInf = edges[ei] || {};
    var sbType = eInf.setbackType || "side";
    var required = 0;
    if (sbType === "front") required = p.setbackFront || 0;
    else if (sbType === "rear") required = p.setbackRear || 0;
    else if (sbType === "side") required = p.setbackSide || 0;
    if (required <= 0) continue;

    var v1 = verts[ei], v2 = verts[(ei + 1) % n];
    var edx = v2[0] - v1[0], edy = v2[1] - v1[1];
    var segLen = Math.sqrt(edx * edx + edy * edy);
    if (segLen < 0.01) continue;

    // Outward normal (away from centroid)
    var nx = -edy / segLen, ny = edx / segLen;
    var mx = (v1[0] + v2[0]) / 2, my = (v1[1] + v2[1]) / 2;
    if (nx * (cx - mx) + ny * (cy - my) > 0) { nx = -nx; ny = -ny; }
    // nx, ny now points outward. Signed distance: positive = inside lot

    var minDist = Infinity;
    for (var ci = 0; ci < 4; ci++) {
      var px = deckCorners[ci][0], py = deckCorners[ci][1];
      // Signed distance from point to line (positive = on centroid side = inside)
      var d = -( nx * (px - v1[0]) + ny * (py - v1[1]) );
      if (d < minDist) minDist = d;
    }

    var gap = +minDist.toFixed(1);
    results.push({
      edgeIdx: ei,
      setbackType: sbType,
      required: required,
      gap: gap,
      warn: gap < required
    });
  }
  return results;
};

// S37 Push 5: General polygon vertex solver
// S41: Added bearing-based (Path 1) and angle-based (Path 2) solver paths
window.computePolygonVerts = function(edges) {
  var n = edges.length;
  if (n < 3) return null;

  // Helper: normalize vertices so min X = 0 and min Y = 0
  function normalizeVerts(verts) {
    var minX = verts[0][0], minY = verts[0][1];
    for (var i = 1; i < verts.length; i++) {
      if (verts[i][0] < minX) minX = verts[i][0];
      if (verts[i][1] < minY) minY = verts[i][1];
    }
    for (var i = 0; i < verts.length; i++) {
      verts[i][0] = +(verts[i][0] - minX).toFixed(2);
      verts[i][1] = +(verts[i][1] - minY).toFixed(2);
    }
    return verts;
  }

  // S41: Parse survey bearing to math heading in radians (0=east, pi/2=north)
  // Handles formats like "N 45 30' E", "N 45.5 E", "S 30 W"
  function parseBearing(str) {
    if (!str) return null;
    var m = str.match(/([NS])\s*(\d+(?:\.\d+)?)\s*[�]?\s*(?:(\d+(?:\.\d+)?)\s*[']?)?\s*(?:(\d+(?:\.\d+)?)\s*["]?)?\s*([EW])/i);
    if (!m) return null;
    var ns = m[1].toUpperCase();
    var deg = parseFloat(m[2]) + (m[3] ? parseFloat(m[3]) / 60 : 0) + (m[4] ? parseFloat(m[4]) / 3600 : 0);
    var ew = m[5].toUpperCase();
    var h;
    if (ns === "N" && ew === "E") h = 90 - deg;
    else if (ns === "N" && ew === "W") h = 90 + deg;
    else if (ns === "S" && ew === "E") h = 270 + deg;
    else if (ns === "S" && ew === "W") h = 270 - deg;
    else return null;
    return h * Math.PI / 180;
  }

  // Path 1: Bearing-based (exact geometry from survey bearings)
  var allBearings = true;
  for (var i = 0; i < n; i++) {
    if (!edges[i].bearing || parseBearing(edges[i].bearing) === null) { allBearings = false; break; }
  }
  if (allBearings) {
    var rawVerts = [[0, 0]];
    for (var i = 0; i < n - 1; i++) {
      var heading = parseBearing(edges[i].bearing);
      var len = edges[i].length || 1;
      var prev = rawVerts[rawVerts.length - 1];
      rawVerts.push([prev[0] + len * Math.cos(heading), prev[1] + len * Math.sin(heading)]);
    }
    return normalizeVerts(rawVerts);
  }

  // Path 2: Angle-based (uses estimated interior angles at each vertex)
  // edge[i].angle = interior angle at vertex where edge i meets edge i+1
  var allAngles = true;
  for (var i = 0; i < n; i++) {
    if (edges[i].angle == null || edges[i].angle <= 0) { allAngles = false; break; }
  }
  if (allAngles) {
    var rawVerts = [[0, 0]];
    var heading = 0; // start heading east
    for (var i = 0; i < n - 1; i++) {
      var len = edges[i].length || 1;
      var prev = rawVerts[rawVerts.length - 1];
      rawVerts.push([prev[0] + len * Math.cos(heading), prev[1] + len * Math.sin(heading)]);
      // Turn by exterior angle at the vertex we just placed
      var extAngle = Math.PI - (edges[i].angle * Math.PI / 180);
      heading += extAngle;
    }
    // Distribute closure error
    var last = rawVerts[n - 1];
    var lastLen = edges[n - 1].length || 1;
    var endX = last[0] + lastLen * Math.cos(heading);
    var endY = last[1] + lastLen * Math.sin(heading);
    for (var i = 1; i < n; i++) {
      var frac = i / n;
      rawVerts[i][0] -= endX * frac;
      rawVerts[i][1] -= endY * frac;
    }
    return normalizeVerts(rawVerts);
  }

  // Path 3: 4 edges - closed-form trapezoid solver
  if (n === 4) {
    var s = edges[0].length || 1;
    var e = edges[1].length || 1;
    var nLen = edges[2].length || 1;
    var w = edges[3].length || 1;
    var D = nLen - s;
    var a, h;
    if (Math.abs(D) < 0.01) {
      a = 0; h = e;
    } else {
      a = (e * e - w * w - D * D) / (2 * D);
      var hSq = w * w - a * a;
      if (hSq < 1) { a = 0; h = Math.max(e, w); }
      else { h = Math.sqrt(hSq); }
    }
    return [[0, 0], [s, 0], [a + nLen, h], [a, h]];
  }

  // Path 4: 5+ edges - equal exterior angle distribution (approximate fallback)
  var extAngle = 2 * Math.PI / n;
  var rawVerts = [[0, 0]];
  var heading = 0;
  for (var i = 0; i < n - 1; i++) {
    var len = edges[i].length || 1;
    var prev = rawVerts[rawVerts.length - 1];
    rawVerts.push([prev[0] + len * Math.cos(heading), prev[1] + len * Math.sin(heading)]);
    heading += extAngle;
  }
  var last = rawVerts[n - 1];
  var lastLen = edges[n - 1].length || 1;
  var endX = last[0] + lastLen * Math.cos(heading);
  var endY = last[1] + lastLen * Math.sin(heading);
  for (var i = 1; i < n; i++) {
    var frac = i / n;
    rawVerts[i][0] -= endX * frac;
    rawVerts[i][1] -= endY * frac;
  }
  return normalizeVerts(rawVerts);
};

const App = function SimpleBlueprints() {
  const { br, mono, sans } = window.SB;
  const [page, setPage] = useState("home");
  const [step, setStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [view, setView] = useState("plan");
  const [planMode, setPlanMode] = useState("plan");
  const [zoneMode, setZoneMode] = useState("select"); // "select" | "add" | "cut" | "chamfer"
  const [p, setP] = useState({ width: 20, depth: 12, height: 4, houseWidth: 40, houseDepth: 30, attachment: "ledger", hasStairs: true, stairLocation: "front", stairWidth: 4, numStringers: 3, hasLanding: false, joistSpacing: 16, deckingType: "composite", railType: "fortress", snowLoad: "moderate", frostZone: "cold", lotWidth: 80, lotDepth: 120, setbackFront: 25, setbackSide: 5, setbackRear: 20, houseOffsetSide: 20, deckOffset: 0, stairOffset: 0, beamType: "dropped", stairTemplate: "straight", stairRunSplit: null, stairLandingDepth: null, stairLandingWidth: null, stairGap: 0.5, stairRotation: 0, stairAnchorX: null, stairAnchorY: null, stairAngle: null,
    houseDistFromStreet: null,
    streetName: "",
    // Polygon lot (S36)
    lotVertices: null, lotEdges: null,
    // Zone system ÃÂ¢ÃÂÃÂ S19
    zones: [], activeZone: 0, nextZoneId: 1, mainCorners: { BL: { type: "square", size: 0 }, BR: { type: "square", size: 0 }, FL: { type: "square", size: 0 }, FR: { type: "square", size: 0 } },
    // Site plan ÃÂ¢ÃÂÃÂ S27 (defaults seeded from existing flat params)
    sitePlan: {
      lotShape: "rectangle", lotWidth: 80, lotDepth: 120,
      streetSide: "south", streetName: "",
      houseWidth: 40, houseDepth: 30, houseOffsetX: 20, houseOffsetY: 25,
      houseLabel: "Existing Residence", houseShape: "rectangle",
      setbackFront: 25, setbackRear: 20, setbackLeft: 5, setbackRight: 5,
      deckAttachSide: "rear", deckOffsetX: 0,
      elements: [],
      address: "", parcelId: "", northAngle: 0,
      lotCoverage: null, deckToPropertyLine: null
    }
  });

  // Zone-aware updater
  const u = (k, v) => setP(prev => {
    const next = { ...prev, [k]: v };

    // Route zone-specific keys to active zone when activeZone > 0
    if (next.activeZone > 0) {
      const zoneKeyMap = { width: "w", depth: "d", height: "h" };
      if (zoneKeyMap[k]) {
        next[k] = prev[k]; // restore original flat param
        next.zones = prev.zones.map(function(z) {
          if (z.id !== prev.activeZone) return z;
          return Object.assign({}, z, { [zoneKeyMap[k]]: v });
        });
        return next;
      }
    }

    if (k === "stairLocation") { next.stairOffset = 0; next.stairAnchorX = null; next.stairAnchorY = null; next.stairAngle = null; }
    if (k === "stairAngle" && v != null) {
      if (v === 0) next.stairLocation = "front";
      else if (v === 90) next.stairLocation = "right";
      else if (v === 270) next.stairLocation = "left";
      else if (v === 180) next.stairLocation = "back";
    }
    if (k === "houseWidth" || k === "width") {
      const maxOff = Math.floor(next.houseWidth / 2);
      next.deckOffset = Math.max(-maxOff, Math.min(maxOff, next.deckOffset || 0));
    }
    if (k === "width" && next.stairWidth > next.width) next.stairWidth = next.width;
    if (k === "deckingType") { next.joistSpacing = v === "composite" ? 12 : 16; }
    if (k === "stairWidth" || k === "width" || k === "depth") {
      const edge = next.stairLocation === "front" ? next.width : next.depth;
      const maxSO = Math.floor((edge - (next.stairWidth || 4)) / 2);
      next.stairOffset = Math.max(-maxSO, Math.min(maxSO, next.stairOffset || 0));
    }
    if (k === "lotWidth" || k === "houseWidth") {
      const maxHO = Math.max(5, next.lotWidth - next.houseWidth - 5);
      next.houseOffsetSide = Math.min(next.houseOffsetSide || 20, maxHO);
    }
    // S37: Clear custom polygon when lot dimension sliders change
    if ((k === "lotWidth" || k === "lotDepth") && prev.lotEdges) {
      next.lotEdges = null;
      next.lotVertices = null;
    }
    // S29: clamp houseDistFromStreet when setbackFront changes
    if (k === "setbackFront" && next.houseDistFromStreet !== null && next.houseDistFromStreet < v) {
      next.houseDistFromStreet = v;
    }
    if (k === "houseDistFromStreet" && v !== null) {
      next.houseDistFromStreet = Math.max(next.setbackFront, v);
    }
    return next;
  });

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Zone management functions ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  const addZone = (parentId, edge) => setP(prev => {
    var parentP = Object.assign({}, prev, { deckWidth: prev.width, deckDepth: prev.depth });
    var defaults = window.addZoneDefaults(parentId, edge, "add", parentP);
    if (!defaults) return prev;
    defaults.id = prev.nextZoneId;
    defaults.label = "Zone " + prev.nextZoneId;
    return {
      ...prev,
      zones: prev.zones.concat([defaults]),
      activeZone: prev.nextZoneId,
      nextZoneId: prev.nextZoneId + 1
    };
  });

  const addCutout = (parentId, edge) => setP(prev => {
    var parentP = Object.assign({}, prev, { deckWidth: prev.width, deckDepth: prev.depth });
    var defaults = window.addZoneDefaults(parentId, edge, "cutout", parentP);
    if (!defaults) return prev;
    defaults.id = prev.nextZoneId;
    defaults.label = "Cutout " + prev.nextZoneId;
    return {
      ...prev,
      zones: prev.zones.concat([defaults]),
      activeZone: prev.nextZoneId,
      nextZoneId: prev.nextZoneId + 1
    };
  });

  const removeZone = (zoneId) => setP(prev => {
    if (zoneId === 0) return prev;
    var toRemove = new Set([zoneId]);
    var changed = true;
    while (changed) {
      changed = false;
      prev.zones.forEach(function(z) {
        if (toRemove.has(z.attachTo) && !toRemove.has(z.id)) { toRemove.add(z.id); changed = true; }
      });
    }
    return {
      ...prev,
      zones: prev.zones.filter(function(z) { return !toRemove.has(z.id); }),
      activeZone: 0
    };
  });

  const updateZone = (zoneId, key, val) => setP(prev => {
    if (zoneId === 0) {
      // For zone 0, update flat params or mainCorners
      if (key === "corners") return { ...prev, mainCorners: val };
      return prev; // zone 0 uses flat params via u()
    }
    return {
      ...prev,
      zones: prev.zones.map(function(z) {
        if (z.id !== zoneId) return z;
        return Object.assign({}, z, { [key]: val });
      })
    };
  });

  const setCorner = (zoneId, corner, type, size) => {
    var upd = { type: type, size: type === "square" ? 0 : size };
    if (zoneId === 0) {
      setP(prev => ({ ...prev, mainCorners: Object.assign({}, prev.mainCorners, { [corner]: upd }) }));
    } else {
      setP(prev => ({
        ...prev,
        zones: prev.zones.map(function(z) {
          if (z.id !== zoneId) return z;
          return Object.assign({}, z, { corners: Object.assign({}, z.corners || DEF_CORNERS, { [corner]: upd }) });
        })
      }));
    }
  };

  const getCorners = (zoneId) => {
    if (zoneId === 0) return p.mainCorners || DEF_CORNERS;
    var z = p.zones.find(function(z) { return z.id === zoneId; });
    return (z && z.corners) || DEF_CORNERS;
  };

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Provide deckWidth/deckDepth aliases for zoneUtils ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  // zoneUtils reads p.deckWidth/p.deckDepth, but our flat params use width/depth
  const pForZones = useMemo(() => Object.assign({}, p, { deckWidth: p.width, deckDepth: p.depth, deckHeight: p.height }), [p]);

  const c = useMemo(() => window.calcStructure(p), [p]);
  const cAdj = useMemo(function() {
    if (!p.zones || !p.zones.length || !window.getExposedEdges) return c;
    var pz = Object.assign({}, p, { deckWidth: p.width, deckDepth: p.depth, deckHeight: p.height });
    var edges = window.getExposedEdges(pz);
    var totalLen = edges.reduce(function(s, e) {
      return s + (e.dir === "h" ? Math.abs(e.x2 - e.x1) : Math.abs(e.y2 - e.y1));
    }, 0);
    if (p.hasStairs) totalLen -= (p.stairWidth || 4);
    return Object.assign({}, c, { railLen: +totalLen.toFixed(1) });
  }, [p, c]);
  const m = useMemo(() => window.estMaterials(p, cAdj), [p, cAdj]);
  const zc = useMemo(() => window.calcAllZones ? window.calcAllZones(p, c) : null, [p, c]);
  const [genStatus, setGenStatus] = useState("idle");
  const [info, setInfo] = useState({ owner: "", address: "", city: "", state: "", zip: "", lot: "", contractor: "" });
  const setI = (f, v) => setInfo(prev => ({ ...prev, [f]: v }));
  const [sitePlanMode, setSitePlanMode] = useState("generate");
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

  const generateBlueprint = async () => {
    setGenStatus("generating"); setGenError("");
    try {
      const coverImage = await window.capture3D(p, c);
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

  const steps = [{ t: "Size & Shape", i: "\uD83D\uDCD0" }, { t: "Structure", i: "\uD83C\uDFD7\uFE0F" }, { t: "Finishes", i: "\uD83E\uDEB5" }, { t: "Site Plan", i: "\uD83D\uDDFA\uFE0F" }, { t: "Review", i: "\uD83D\uDCCB" }];

  const PlanView = window.PlanView;
  const ElevationView = window.ElevationView;
  const Deck3D = window.Deck3D;
  const HomePage = window.HomePage;
  const StepContent = window.StepContent;
  const SitePlanView = window.SitePlanView;

  // HOME
  if (page === "home") return <HomePage setPage={setPage} />;

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
          {steps.map((s, i) => <button key={i} onClick={() => setStep(i)} style={{ padding: "7px 16px", fontSize: 10, cursor: "pointer", border: "none", fontFamily: mono, background: step === i ? br.gn : "transparent", color: step === i ? "#fff" : br.mu, borderRadius: i === 0 ? "5px 0 0 5px" : i === steps.length - 1 ? "0 5px 5px 0" : 0, fontWeight: step === i ? 700 : 400, letterSpacing: "0.5px" }}>{s.i} {s.t}</button>)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontFamily: mono, color: br.mu }}>{user.name || user.email}</span>
            {user.picture && <img src={user.picture} style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${br.bd}` }} referrerPolicy="no-referrer" />}
            <button onClick={() => fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }).then(() => setUser(null))} style={{ fontSize: 9, fontFamily: mono, color: br.mu, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>logout</button>
          </div> : <button onClick={() => { window.location.href = `${API}/auth/login`; }} style={{ padding: "5px 14px", background: br.gn, color: "#fff", border: "none", borderRadius: 5, fontSize: 10, fontFamily: mono, cursor: "pointer", fontWeight: 700 }}>Sign in</button>}
        </div>
      </nav>
      <div style={{ height: 3, background: br.wr }}><div style={{ height: "100%", background: br.gn, width: `${((step + 1) / steps.length) * 100}%`, transition: "width 0.3s" }} /></div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "12px", display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* LEFT: INPUTS */}
        <div style={{ flex: "1 1 320px", minWidth: 290 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 22, border: `1px solid ${br.bd}`, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 800, color: br.dk, fontFamily: sans, borderBottom: `2px solid ${br.gn}`, paddingBottom: 8 }}>{steps[step].i} {steps[step].t}</h2>

            <StepContent step={step} p={p} u={u} c={c} m={m} zc={zc} info={info} setI={setI}
              showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced}
              sitePlanMode={sitePlanMode} setSitePlanMode={setSitePlanMode}
              sitePlanFile={sitePlanFile} setSitePlanFile={setSitePlanFile} setSitePlanB64={setSitePlanB64}
              isProduction={isProduction} feedbackDone={feedbackDone} setFeedbackDone={setFeedbackDone}
              feedback={feedback} setFeedback={setFeedback} submitFeedback={submitFeedback}
              genStatus={genStatus} genError={genError} generateBlueprint={generateBlueprint}
              user={user} API={API}
              zoneMode={zoneMode} setZoneMode={setZoneMode}
              addZone={addZone} addCutout={addCutout} removeZone={removeZone} updateZone={updateZone}
              setCorner={setCorner} getCorners={getCorners} pForZones={pForZones} />

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button onClick={() => step > 0 ? setStep(step - 1) : setPage("home")} style={{ padding: "9px 18px", border: `1px solid ${br.bd}`, borderRadius: 6, background: "transparent", color: br.mu, cursor: "pointer", fontFamily: mono, fontSize: 11, fontWeight: 600 }}>{"\u2190"} {step > 0 ? "Back" : "Home"}</button>
              {step < steps.length - 1 && <button onClick={() => setStep(step + 1)} style={{ padding: "9px 18px", border: "none", borderRadius: 6, background: br.gn, color: "#fff", cursor: "pointer", fontFamily: mono, fontSize: 11, fontWeight: 700 }}>Next {"\u2192"}</button>}
            </div>
          </div>
        </div>

        {/* RIGHT: PREVIEW */}
        <div style={{ flex: "1 1 500px", minWidth: 280 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 18, border: `1px solid ${br.bd}`, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: br.dk, fontFamily: mono, letterSpacing: "1px", textTransform: "uppercase" }}>{step === 3 ? "Site Plan Preview" : "Preview"}</h3>
              {step !== 3 && <div style={{ display: "flex", gap: 1 }}>
                {views.map(([id, label], i) => <button key={id} onClick={() => setView(id)} style={{ padding: "5px 12px", fontSize: 10, cursor: "pointer", fontFamily: mono, border: view === id ? `1px solid ${br.gn}` : `1px solid ${br.bd}`, background: view === id ? br.gn : "transparent", color: view === id ? "#fff" : br.mu, borderRadius: i === 0 ? "4px 0 0 4px" : i === views.length - 1 ? "0 4px 4px 0" : 0, fontWeight: view === id ? 700 : 400 }}>{label}</button>)}
              </div>}
            </div>

            <div style={{ background: step === 3 ? br.cr : (view === "3d" ? "transparent" : br.cr), border: step === 3 || view !== "3d" ? `1px solid ${br.bd}` : "none", borderRadius: 6, padding: step === 3 ? 8 : (view === "3d" ? 0 : 12), minHeight: 320 }}>
              {step === 3 && SitePlanView && <SitePlanView p={p} c={c} u={u} />}
              {step !== 3 && view === "plan" && <>
                <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                  {[["plan", "Deck Plan"], ["framing", "Framing"]].map(([id, label]) => <button key={id} onClick={() => setPlanMode(id)} style={{ padding: "4px 10px", fontSize: 9, fontFamily: mono, cursor: "pointer", border: planMode === id ? `1px solid ${br.gn}` : `1px solid ${br.bd}`, background: planMode === id ? br.gn : "transparent", color: planMode === id ? "#fff" : br.mu, borderRadius: 4, fontWeight: planMode === id ? 700 : 400 }}>{label}</button>)}
                  <div style={{ flex: 1 }} />
                  {planMode === "plan" && [["select", "\u25C7"], ["add", "+"], ["cut", "\u2702"], ["chamfer", "\u25E3"]].map(([id, icon]) => <button key={id} onClick={() => setZoneMode(id)} style={{ padding: "4px 10px", fontSize: 9, fontFamily: mono, cursor: "pointer", border: zoneMode === id ? `1px solid ${id === "cut" ? "#dc2626" : id === "chamfer" ? "#7c3aed" : id === "add" ? "#16a34a" : br.gn}` : `1px solid ${br.bd}`, background: zoneMode === id ? (id === "cut" ? "#fef2f2" : id === "chamfer" ? "#faf5ff" : id === "add" ? "#f0fdf4" : "#edf5e8") : "transparent", color: zoneMode === id ? (id === "cut" ? "#dc2626" : id === "chamfer" ? "#7c3aed" : id === "add" ? "#16a34a" : br.gn) : br.mu, borderRadius: 4, fontWeight: zoneMode === id ? 700 : 400, minWidth: 28, textAlign: "center" }}>{icon}</button>)}
                </div>
                <PlanView p={p} c={c} mode={planMode} u={u}
                  zoneMode={zoneMode} pForZones={pForZones}
                  addZone={addZone} addCutout={addCutout}
                  getCorners={getCorners} setCorner={setCorner} />
                {planMode === "plan" && <div style={{ textAlign: "center", fontSize: 9, color: br.mu, fontFamily: mono, marginTop: 4, opacity: 0.7 }}>
                  {zoneMode === "select" && <>Drag the <span style={{ color: "#3d5a2e", fontWeight: 700 }}>green</span> handle to slide the deck ÃÂÃÂ· Click <span style={{ color: "#c62828", fontWeight: 700 }}>stairs</span> to select, drag to move, grab <span style={{ color: "#3d5a2e", fontWeight: 700 }}>{"\u21BB"}</span> to rotate</>}
                  {zoneMode === "add" && <>Click <span style={{ color: "#16a34a", fontWeight: 700 }}>+</span> on any edge to add a deck zone</>}
                  {zoneMode === "cut" && <>Click <span style={{ color: "#dc2626", fontWeight: 700 }}>{"\u2702"}</span> on corners for house wraps, center for openings</>}
                  {zoneMode === "chamfer" && <>Click <span style={{ color: "#7c3aed", fontWeight: 700 }}>{"\u25E3"}</span> on corners to toggle 45{"\u00B0"} chamfers</>}
                </div>}
              </>}
              {step !== 3 && view === "elevation" && <ElevationView c={c} p={p} />}
              {step !== 3 && view === "3d" && <Deck3D c={c} p={p} />}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 12 }}>
              {[["Area", `${zc ? zc.totalArea : c.area} SF`, br.dk], ["Joists", c.joistSize, br.bl], ["Beam", c.beamSize.replace("3-ply ", "3\u00D7").replace("2-ply ", "2\u00D7"), br.ac], ["Posts", `${c.postSize}\u00D7${zc ? c.nP + zc.extraPosts : c.nP}`, "#8B6508"], ["Footings", `${c.fDiam}"\u00D8\u00D7${zc ? c.nF + zc.extraFootings : c.nF}`, "#777"], ["Est. Cost", `$${(zc ? m.total + zc.extraTotal : m.total).toFixed(0)}`, br.gn]].map(([l, v, cl]) => (
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
                  <tbody>{(zc ? m.items.concat(zc.extraItems) : m.items).map((it, i) => <tr key={i} style={{ borderBottom: `1px solid ${br.wr}` }}><td style={{ padding: "4px 8px", color: br.tx }}>{it.item}</td><td style={{ padding: "4px 8px", textAlign: "center", color: br.bl, fontWeight: 700 }}>{it.qty}</td><td style={{ padding: "4px 8px", textAlign: "right", color: br.dk }}>${(it.qty * it.cost).toFixed(0)}</td></tr>)}</tbody>
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
