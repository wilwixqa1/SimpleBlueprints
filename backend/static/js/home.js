// ============================================================
// HOME PAGE + DRAFTS PAGE + SHARED THEME CONSTANTS
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

function HomePage({ setPage, user, startNewProject }) {
  const { br, mono, sans } = window.SB;
  const products = window.products;
  return (
    <div style={{ minHeight: "100vh", background: br.cr }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid " + br.bd }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, background: br.gn, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>SB</span></div>
          <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 800, color: br.dk, letterSpacing: "0.5px" }}>simpleblueprints</span>
          <span style={{ fontSize: 10, color: br.ac, fontWeight: 700, fontFamily: mono, border: "1px solid " + br.ac, padding: "1px 6px", borderRadius: 3, marginLeft: 4 }}>BETA</span>
        </div>
        {user && (
          <button onClick={function() { setPage("drafts"); }}
            style={{ padding: "6px 14px", background: "transparent", border: "1px solid " + br.bd, borderRadius: 6, fontSize: 11, fontFamily: mono, color: br.dk, cursor: "pointer", fontWeight: 600 }}>
            My Projects
          </button>
        )}
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
      <div style={{ borderTop: "1px solid " + br.bd, padding: "20px 32px", textAlign: "center" }}><span style={{ fontSize: 10, fontFamily: mono, color: br.mu }}>{"\u00A9"} 2026 SimpleBlueprints.com {"\u00B7"} Plans for reference -- verify with local building department</span></div>
    </div>
  );
}

// ============================================================
// DRAFTS PAGE
// ============================================================
function DraftsPage({ setPage, user, API, loadProject, startNewProject }) {
  const { br, mono, sans } = window.SB;
  const [projects, setProjects] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [openingId, setOpeningId] = React.useState(null);
  const [selected, setSelected] = React.useState({});
  const [deleting, setDeleting] = React.useState(false);

  var selectedCount = Object.keys(selected).filter(function(k) { return selected[k]; }).length;
  var selectMode = selectedCount > 0;

  React.useEffect(function() {
    if (!user || !API) return;
    fetch(API + "/api/projects", { credentials: "include" })
      .then(function(r) { return r.json(); })
      .then(function(d) { setProjects(d.projects || []); setLoading(false); })
      .catch(function() { setLoading(false); });
  }, [user, API]);

  var openProject = function(projId) {
    if (selectMode) return;
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

  var toggleSelect = function(e, projId) {
    e.stopPropagation();
    setSelected(function(prev) {
      var copy = Object.assign({}, prev);
      if (copy[projId]) { delete copy[projId]; } else { copy[projId] = true; }
      return copy;
    });
  };

  var selectAll = function() {
    if (selectedCount === projects.length) {
      setSelected({});
    } else {
      var all = {};
      projects.forEach(function(p) { all[p.id] = true; });
      setSelected(all);
    }
  };

  var deleteSelected = function() {
    var ids = Object.keys(selected).filter(function(k) { return selected[k]; });
    if (ids.length === 0) return;
    if (!confirm("Delete " + ids.length + " project" + (ids.length > 1 ? "s" : "") + "? This cannot be undone.")) return;
    setDeleting(true);
    Promise.all(ids.map(function(id) {
      return fetch(API + "/api/projects/" + id, { method: "DELETE", credentials: "include" });
    })).then(function() {
      setProjects(function(prev) { return prev.filter(function(pr) { return !selected[pr.id]; }); });
      setSelected({});
      setDeleting(false);
    }).catch(function(e) { console.warn("Bulk delete error:", e); setDeleting(false); });
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

  return (
    <div style={{ minHeight: "100vh", background: br.cr, display: "flex", flexDirection: "column" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid " + br.bd, background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={function() { setPage("home"); }}>
          <div style={{ width: 28, height: 28, background: br.gn, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>SB</span></div>
          <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 800, color: br.dk, letterSpacing: "0.5px" }}>simpleblueprints</span>
          <span style={{ fontSize: 10, color: br.ac, fontWeight: 700, fontFamily: mono, border: "1px solid " + br.ac, padding: "1px 6px", borderRadius: 3, marginLeft: 4 }}>BETA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: mono, color: br.mu }}>{user.name || user.email}</span>
          {user.picture && <img src={user.picture} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid " + br.bd }} referrerPolicy="no-referrer" />}
        </div>
      </nav>

      <div style={{ flex: 1 }}>
        <div style={{ maxWidth: 840, margin: "0 auto", padding: "32px 20px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={function() { if (selectMode) { setSelected({}); } else { setPage("home"); } }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: br.mu, padding: 0 }}>{"\u2190"}</button>
              <h1 style={{ fontFamily: sans, fontSize: 22, fontWeight: 800, color: br.dk, margin: 0 }}>{selectMode ? selectedCount + " Selected" : "My Projects"}</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {projects.length > 0 && <button onClick={selectAll} style={{ padding: "6px 12px", background: "transparent", border: "1px solid " + br.bd, borderRadius: 6, fontSize: 10, fontFamily: mono, color: br.mu, cursor: "pointer", fontWeight: 600 }}>{selectedCount === projects.length ? "Deselect All" : "Select All"}</button>}
              {selectMode && <button onClick={deleteSelected} disabled={deleting} style={{ padding: "6px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 10, fontFamily: mono, color: br.rd, cursor: deleting ? "wait" : "pointer", fontWeight: 700, opacity: deleting ? 0.5 : 1 }}>{deleting ? "Deleting..." : "Delete " + selectedCount}</button>}
              {!selectMode && <button onClick={startNewProject} style={{ padding: "8px 18px", background: br.gn, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontFamily: mono, cursor: "pointer", fontWeight: 700 }}>+ New Deck</button>}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: br.mu, fontFamily: mono, fontSize: 12 }}>Loading projects...</div>
          ) : projects.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{"\uD83D\uDDC2"}</div>
              <div style={{ fontSize: 15, color: br.dk, fontFamily: sans, fontWeight: 600, marginBottom: 6 }}>No projects yet</div>
              <div style={{ fontSize: 13, color: br.mu, fontFamily: sans, marginBottom: 20 }}>Start your first deck project and it will appear here.</div>
              <button onClick={startNewProject} style={{ padding: "10px 24px", background: br.gn, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontFamily: mono, cursor: "pointer", fontWeight: 700 }}>Start a Deck Project</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {projects.map(function(proj) {
                var dims = proj.deck_width && proj.deck_depth ? proj.deck_width + "' x " + proj.deck_depth + "'" : "";
                var isOpening = openingId === proj.id;
                var isGenerated = proj.status === "generated";
                return (
                  <div key={proj.id} onClick={function() { if (selectMode) { toggleSelect({stopPropagation: function(){}}, proj.id); } else if (!isOpening) { openProject(proj.id); } }}
                    style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", background: selected[proj.id] ? "#f0fdf4" : "#fff", border: "1px solid " + (selected[proj.id] ? br.gn : br.bd), borderRadius: 8, cursor: isOpening ? "wait" : "pointer", transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s", opacity: isOpening ? 0.7 : 1, position: "relative" }}
                    onMouseEnter={function(e) { if (!selected[proj.id]) { e.currentTarget.style.borderColor = br.gn; e.currentTarget.style.boxShadow = "0 2px 8px rgba(61,90,46,0.08)"; } }}
                    onMouseLeave={function(e) { if (!selected[proj.id]) { e.currentTarget.style.borderColor = br.bd; e.currentTarget.style.boxShadow = "none"; } }}>
                    {/* Checkbox */}
                    <div onClick={function(e) { toggleSelect(e, proj.id); }} style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + (selected[proj.id] ? br.gn : br.bd), background: selected[proj.id] ? br.gn : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all 0.15s" }}>
                      {selected[proj.id] && <span style={{ color: "#fff", fontSize: 12, fontWeight: 900, lineHeight: 1 }}>{"\u2713"}</span>}
                    </div>
                    {/* Left accent */}
                    <div style={{ width: 3, height: 36, borderRadius: 2, background: isGenerated ? br.gn : br.ac, flexShrink: 0 }} />
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: br.dk, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name || "Untitled Deck"}</span>
                        <span style={{ fontSize: 9, fontFamily: mono, fontWeight: 700, padding: "1px 6px", borderRadius: 3, flexShrink: 0,
                          background: isGenerated ? "#f0fdf4" : "#fef9e7",
                          color: isGenerated ? "#2e7d32" : br.ac,
                          border: "1px solid " + (isGenerated ? "#2e7d32" : br.ac),
                        }}>{isGenerated ? "GENERATED" : "DRAFT"}</span>
                      </div>
                      <div style={{ fontSize: 11, fontFamily: mono, color: br.mu }}>
                        {dims && <span>{dims} {"\u00B7"} </span>}
                        {proj.deck_height && <span>{proj.deck_height}' high {"\u00B7"} </span>}
                        {stepNames[proj.step || 0]} {"\u00B7"} {timeAgo(proj.updated_at)}
                      </div>
                    </div>
                    {/* Delete */}
                    <button onClick={function(e) { deleteProject(e, proj.id, proj.name || "Untitled Deck"); }}
                      style={{ fontSize: 10, fontFamily: mono, color: br.rd, background: "none", border: "1px solid transparent", borderRadius: 4, cursor: "pointer", padding: "4px 10px", opacity: 0.4, transition: "opacity 0.15s, border-color 0.15s" }}
                      onMouseEnter={function(e) { e.currentTarget.style.opacity = "1"; e.currentTarget.style.borderColor = br.rd; }}
                      onMouseLeave={function(e) { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.borderColor = "transparent"; }}>
                      Delete
                    </button>
                    {isOpening && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(250,248,243,0.9)", borderRadius: 8 }}>
                      <span style={{ fontFamily: mono, fontSize: 11, color: br.gn, fontWeight: 700 }}>Opening...</span>
                    </div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ borderTop: "1px solid " + br.bd, padding: "20px 32px", textAlign: "center" }}>
        <span style={{ fontSize: 10, fontFamily: mono, color: br.mu }}>{"\u00A9"} 2026 SimpleBlueprints.com {"\u00B7"} Plans for reference -- verify with local building department</span>
      </div>
    </div>
  );
}

window.HomePage = HomePage;
window.DraftsPage = DraftsPage;
