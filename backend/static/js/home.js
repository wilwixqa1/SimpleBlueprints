// ============================================================
// HOME PAGE + SHARED THEME CONSTANTS
// ============================================================

// Shared theme -- used by home.js, steps.js, app.js
window.SB = {
  mono: "'DM Mono', 'SF Mono', monospace",
  sans: "'DM Sans', system-ui, sans-serif",
  br: { dk: "#1a1f16", gn: "#3d5a2e", cr: "#faf8f3", wr: "#f2ece0", ac: "#c4960a", tx: "#2c3024", mu: "#7a8068", bd: "#ddd8cc", rd: "#c0392b", bl: "#2471a3" },
};

window.products = [
  { id: "deck", name: "Decks", icon: "\u2B1C", active: true, desc: "Attached & freestanding decks" },
  { id: "pergola", name: "Pergolas", icon: "\u2630", desc: "Patio covers & shade structures" },
  { id: "fence", name: "Fences", icon: "\u25AE\u25AE\u25AE", desc: "Privacy, picket & iron fences" },
  { id: "shed", name: "Sheds", icon: "\u2302", desc: "Storage sheds under 200 SF" },
  { id: "garage", name: "Garages", icon: "\u229E", desc: "Detached 1-2 car garages" },
  { id: "porch", name: "Porches", icon: "\u25A6", desc: "Screened & 3-season rooms" },
];

function HomePage({ setPage, user, API, loadProject, startNewProject }) {
  const { br, mono, sans } = window.SB;
  const products = window.products;
  const [projects, setProjects] = React.useState([]);
  const [loadingProjects, setLoadingProjects] = React.useState(false);
  const [openingId, setOpeningId] = React.useState(null);

  React.useEffect(function() {
    if (!user || !API) return;
    setLoadingProjects(true);
    fetch(API + "/api/projects", { credentials: "include" })
      .then(function(r) { return r.json(); })
      .then(function(d) { setProjects(d.projects || []); setLoadingProjects(false); })
      .catch(function() { setLoadingProjects(false); });
  }, [user, API]);

  var openProject = function(projId) {
    setOpeningId(projId);
    fetch(API + "/api/projects/" + projId, { credentials: "include" })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.project) loadProject(d.project);
        setOpeningId(null);
      })
      .catch(function(e) { console.warn("Open project error:", e); setOpeningId(null); });
  };

  var deleteProject = function(e, projId, projName) {
    e.stopPropagation();
    if (!confirm("Delete \"" + projName + "\"? This cannot be undone.")) return;
    fetch(API + "/api/projects/" + projId, { method: "DELETE", credentials: "include" })
      .then(function() { setProjects(function(prev) { return prev.filter(function(pr) { return pr.id !== projId; }); }); })
      .catch(function(e) { console.warn("Delete error:", e); });
  };

  var timeAgo = function(dateStr) {
    var d = new Date(dateStr);
    var now = new Date();
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
    return d.toLocaleDateString();
  };

  var stepNames = ["Site Plan", "Size & Shape", "Structure", "Finishes", "Review"];
  var isDashboard = user && !loadingProjects && projects.length > 0;

  // ============================================================
  // Project card component
  // ============================================================
  var renderProjectCard = function(proj) {
    var dims = proj.deck_width && proj.deck_depth ? proj.deck_width + "' x " + proj.deck_depth + "'" : "";
    var isOpening = openingId === proj.id;
    return (
      <div key={proj.id} onClick={function() { if (!isOpening) openProject(proj.id); }}
        style={{ padding: 18, background: "#fff", border: "1px solid " + br.bd, borderRadius: 10, cursor: isOpening ? "wait" : "pointer", position: "relative", transition: "border-color 0.15s, box-shadow 0.15s", opacity: isOpening ? 0.7 : 1 }}
        onMouseEnter={function(e) { e.currentTarget.style.borderColor = br.gn; e.currentTarget.style.boxShadow = "0 2px 12px rgba(61,90,46,0.1)"; }}
        onMouseLeave={function(e) { e.currentTarget.style.borderColor = br.bd; e.currentTarget.style.boxShadow = "none"; }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: br.dk, lineHeight: 1.3, flex: 1, paddingRight: 8 }}>
            {proj.name || "Untitled Deck"}
          </div>
          <span style={{ fontSize: 9, fontFamily: mono, fontWeight: 700, padding: "2px 8px", borderRadius: 3, flexShrink: 0,
            background: proj.status === "generated" ? "#f0fdf4" : "#fef9e7",
            color: proj.status === "generated" ? "#2e7d32" : br.ac,
            border: "1px solid " + (proj.status === "generated" ? "#2e7d32" : br.ac),
          }}>{proj.status === "generated" ? "GENERATED" : "DRAFT"}</span>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, fontFamily: mono, color: br.mu, marginBottom: 6 }}>
          {dims && <span>{dims}</span>}
          {proj.deck_height && <span>{proj.deck_height}' high</span>}
          {proj.attachment && <span>{proj.attachment}</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 10, fontFamily: mono, color: br.mu }}>
            Step {(proj.step || 0) + 1}: {stepNames[proj.step || 0] || "?"} {"\u00B7"} {timeAgo(proj.updated_at)}
          </div>
          <button onClick={function(e) { deleteProject(e, proj.id, proj.name || "Untitled Deck"); }}
            style={{ fontSize: 9, fontFamily: mono, color: br.rd, background: "none", border: "none", cursor: "pointer", padding: "2px 6px", opacity: 0.6 }}
            onMouseEnter={function(e) { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={function(e) { e.currentTarget.style.opacity = "0.6"; }}>
            delete
          </button>
        </div>
        {isOpening && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(250,248,243,0.8)", borderRadius: 10 }}>
          <span style={{ fontFamily: mono, fontSize: 11, color: br.gn, fontWeight: 700 }}>Opening...</span>
        </div>}
      </div>
    );
  };

  var footer = (
    <div style={{ borderTop: "1px solid " + br.bd, padding: "20px 32px", textAlign: "center" }}>
      <span style={{ fontSize: 10, fontFamily: mono, color: br.mu }}>{"\u00A9"} 2026 SimpleBlueprints.com {"\u00B7"} Plans for reference -- verify with local building department</span>
    </div>
  );

  // ============================================================
  // DASHBOARD (logged in + has projects)
  // ============================================================
  if (isDashboard) {
    return (
      <div style={{ minHeight: "100vh", background: br.cr }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid " + br.bd, background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, background: br.gn, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>SB</span></div>
            <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 800, color: br.dk, letterSpacing: "0.5px" }}>simpleblueprints</span>
            <span style={{ fontSize: 10, color: br.ac, fontWeight: 700, fontFamily: mono, border: "1px solid " + br.ac, padding: "1px 6px", borderRadius: 3, marginLeft: 4 }}>BETA</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontFamily: mono, color: br.mu }}>{user.name || user.email}</span>
            {user.picture && <img src={user.picture} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid " + br.bd }} referrerPolicy="no-referrer" />}
          </div>
        </nav>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 20px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontFamily: sans, fontSize: 22, fontWeight: 800, color: br.dk, margin: 0 }}>Your Projects</h1>
              <div style={{ fontSize: 12, fontFamily: sans, color: br.mu, marginTop: 4 }}>{projects.length} project{projects.length !== 1 ? "s" : ""}</div>
            </div>
            <button onClick={startNewProject} style={{ padding: "10px 20px", background: br.gn, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontFamily: mono, cursor: "pointer", fontWeight: 700 }}>+ New Deck</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 14 }}>
            {projects.map(renderProjectCard)}
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px 50px" }}>
          <div style={{ fontSize: 10, fontFamily: mono, color: br.mu, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 14 }}>Other Project Types</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {products.filter(function(pr) { return !pr.active; }).map(function(pr) {
              return (
                <div key={pr.id} style={{ padding: "8px 14px", background: "#fff", border: "1px solid " + br.bd, borderRadius: 6, opacity: 0.6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{pr.icon}</span>
                  <span style={{ fontFamily: sans, fontSize: 12, color: br.dk, fontWeight: 600 }}>{pr.name}</span>
                  <span style={{ fontSize: 8, fontFamily: mono, color: br.ac, fontWeight: 700 }}>SOON</span>
                </div>
              );
            })}
          </div>
        </div>
        {footer}
      </div>
    );
  }

  // ============================================================
  // LANDING PAGE (not logged in, or logged in with no projects)
  // ============================================================
  return (
    <div style={{ minHeight: "100vh", background: br.cr }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid " + br.bd }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, background: br.gn, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>SB</span></div>
          <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 800, color: br.dk, letterSpacing: "0.5px" }}>simpleblueprints</span>
          <span style={{ fontSize: 10, color: br.ac, fontWeight: 700, fontFamily: mono, border: "1px solid " + br.ac, padding: "1px 6px", borderRadius: 3, marginLeft: 4 }}>BETA</span>
        </div>
      </nav>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "50px 20px 40px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontFamily: mono, color: br.gn, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", marginBottom: 16 }}>Permit-Ready Plans in Minutes</div>
        <h1 style={{ fontFamily: sans, fontSize: "clamp(28px, 6vw, 52px)", fontWeight: 900, color: br.dk, lineHeight: 1.1, margin: "0 0 20px", letterSpacing: "-1px" }}>Simple structures.<br />Simple blueprints.</h1>
        <p style={{ fontFamily: sans, fontSize: "clamp(14px, 2.5vw, 18px)", color: br.mu, maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.6 }}>Configure your project, get IRC-compliant structural calculations, and download a professional drawing set. Draft your deck plans -- fast.</p>
        <div style={{ display: "flex", gap: 32, justifyContent: "center", marginBottom: 60, flexWrap: "wrap" }}>
          {[["01", "Configure", "Set dimensions, materials, and location"], ["02", "Calculate", "Auto-sized joists, beams, posts & footings"], ["03", "Download", "6-sheet PDF blueprint set + material list"]].map(([n, t, d]) => (
            <div key={n} style={{ textAlign: "center", maxWidth: 180 }}><div style={{ fontFamily: mono, fontSize: 28, fontWeight: 900, color: br.gn, marginBottom: 4 }}>{n}</div><div style={{ fontFamily: sans, fontSize: 16, fontWeight: 700, color: br.dk, marginBottom: 4 }}>{t}</div><div style={{ fontFamily: sans, fontSize: 13, color: br.mu, lineHeight: 1.5 }}>{d}</div></div>
          ))}
        </div>
      </div>

      {user && loadingProjects && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px 30px", textAlign: "center" }}>
          <div style={{ padding: 20, color: br.mu, fontFamily: mono, fontSize: 12 }}>Loading your projects...</div>
        </div>
      )}

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px 60px" }}>
        <div style={{ fontSize: 11, fontFamily: mono, color: br.mu, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 20, textAlign: "center" }}>Choose Your Project</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {products.map(pr => (
            <button key={pr.id} onClick={() => pr.active && (startNewProject ? startNewProject() : setPage("wizard"))} style={{ padding: "24px 20px", background: "#fff", border: pr.active ? "2px solid " + br.gn : "1px solid " + br.bd, borderRadius: 10, cursor: pr.active ? "pointer" : "default", textAlign: "left", opacity: pr.active ? 1 : 0.55, position: "relative" }}>
              {!pr.active && <span style={{ position: "absolute", top: 10, right: 10, fontSize: 8, fontFamily: mono, color: br.ac, fontWeight: 700, background: "#fef9e7", padding: "2px 8px", borderRadius: 3 }}>COMING SOON</span>}
              <div style={{ fontSize: 24, marginBottom: 8 }}>{pr.icon}</div>
              <div style={{ fontFamily: sans, fontSize: 16, fontWeight: 700, color: br.dk }}>{pr.name}</div>
              <div style={{ fontFamily: sans, fontSize: 12, color: br.mu, marginTop: 2 }}>{pr.desc}</div>
              {pr.active && <div style={{ marginTop: 12, fontSize: 11, fontFamily: mono, color: br.gn, fontWeight: 700 }}>Start Building {"\u2192"}</div>}
            </button>
          ))}
        </div>
      </div>
      {footer}
    </div>
  );
}

window.HomePage = HomePage;
