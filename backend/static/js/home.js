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

function HomePage({ setPage, user, startNewProject, setInfo }) {
  const [addr, setAddr] = React.useState("");
  const [sheets, setSheets] = React.useState(null);

  // Sample sheets rendered by the production drawing pipeline (cached server-side).
  // NOTE: /api/mock/sample-sheets currently lives in the S88.5 fenced revert block
  // in main.py. The homepage now depends on it, so that block is NO LONGER cleanly
  // revertable. See the comment at the fence.
  React.useEffect(function () {
    var alive = true;
    fetch("/api/mock/sample-sheets")
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (resp) {
        if (!alive) return;
        var list = (resp.sheets || []).filter(function (x) { return x.png; });
        if (list.length) setSheets(list);
      })
      .catch(function () { /* hero keeps the drawn fallback */ });
    return function () { alive = false; };
  }, []);

  // Address entered on the landing page seeds the wizard's project info, so the
  // user does not retype it on step 1.
  const start = function (mode) {
    var a = (addr || "").trim();
    if (a && setInfo) setInfo(function (prev) { return Object.assign({}, prev, { address: a }); });
    if (mode) { try { window._sbStartMode = mode; } catch (e) {} }
    if (startNewProject) { startNewProject(); } else { setPage("wizard"); }
  };

  const heroSite = sheets && sheets.filter(function (x) { return /SITE/.test(x.name); })[0];

  return (
    <div className="sb-home">
      <nav className="nav" aria-label="Main">
        <a className="wordmark" href="/" onClick={function (e) { e.preventDefault(); }}>
          <span className="wm-main">SimpleBlueprints</span>
          <span className="wm-sub">DECK PERMIT PLANS</span>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#sheets">Your drawing set</a>
          <a href="#pricing">Pricing</a>
          {user && <a href="#projects" onClick={function (e) { e.preventDefault(); setPage("drafts"); }}>My projects</a>}
          <button className="btn primary" style={{ padding: "9px 18px", fontSize: 13 }} onClick={function () { start(); }}>Start with your address</button>
        </div>
      </nav>

      <header className="hero">
        <div>
          <h1>Deck permit plans,<br />drawn from <span className="accent">your actual property.</span></h1>
          <p className="lede">Enter your address and we pull your lot lines, setbacks, and house footprint from public records. Design your deck on your real property, then download a complete permit drawing set with IRC structural calculations. No graph paper, no drafter, no waiting.</p>

          <div className="addr-card sheet" aria-label="Start with your address">
            <div className="addr-head">
              <span className="tb-label">Project address</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--mut)" }}>FIELD 01 / TITLE BLOCK</span>
            </div>
            <div className="addr-row">
              <input
                type="text"
                value={addr}
                onChange={function (e) { setAddr(e.target.value); }}
                onKeyDown={function (e) { if (e.key === "Enter") start(); }}
                placeholder="4739 Sweetgrass Ln, Colorado Springs, CO"
                autoComplete="street-address"
                aria-label="Property address"
              />
              <button className="btn primary" type="button" onClick={function () { start(); }}>Find my lot</button>
            </div>
            <p className="addr-alt">Have a property survey? <a href="#survey" onClick={function (e) { e.preventDefault(); start("survey"); }}>Uploading it</a> is the most accurate start. If lookup cannot find you and you have no survey, <a href="#manual" onClick={function (e) { e.preventDefault(); start("manual"); }}>draw your lot manually</a>. Free to design, and free to preview every sheet.</p>
          </div>
        </div>

        <figure className="hero-fig">
          <div className="sheet" style={{ padding: 10 }}>
            {heroSite ? (
              <img src={"data:image/png;base64," + heroSite.png} alt="Sample site plan sheet drawn by the SimpleBlueprints pipeline" style={{ width: "100%", display: "block" }} />
            ) : (
              <svg viewBox="0 0 460 330" role="img" aria-label="Sample site plan drawing of a lot with a house and deck">
                <rect width="460" height="330" fill="#0e2f4d" />
                <g stroke="#a8c4dd" fill="none" strokeWidth="1">
                  <g opacity=".14">
                    <path d="M0 0 H460 M0 33 H460 M0 66 H460 M0 99 H460 M0 132 H460 M0 165 H460 M0 198 H460 M0 231 H460 M0 264 H460 M0 297 H460" />
                    <path d="M0 0 V330 M46 0 V330 M92 0 V330 M138 0 V330 M184 0 V330 M230 0 V330 M276 0 V330 M322 0 V330 M368 0 V330 M414 0 V330" />
                  </g>
                  <polygon points="70,300 78,110 175,42 340,66 390,250 330,300" strokeWidth="1.6" />
                  <polygon points="100,282 106,140 186,84 322,102 360,244 316,282" strokeDasharray="6 4" opacity=".5" />
                  <rect x="150" y="170" width="130" height="86" strokeWidth="1.6" />
                  <text x="215" y="218" fill="#a8c4dd" fontFamily="DM Mono, monospace" fontSize="11" textAnchor="middle">EXISTING RESIDENCE</text>
                  <rect x="170" y="122" width="92" height="48" strokeWidth="1.8" fill="#a8c4dd" fillOpacity=".12" />
                  <text x="216" y="149" fill="#e9f1f8" fontFamily="DM Mono, monospace" fontSize="10" textAnchor="middle">PROPOSED DECK</text>
                  <text x="216" y="160" fill="#a8c4dd" fontFamily="DM Mono, monospace" fontSize="8.5" textAnchor="middle">16'-0" x 12'-0"</text>
                  <path d="M170 112 H262 M170 108 V116 M262 108 V116" strokeWidth=".8" />
                  <text x="216" y="106" fill="#a8c4dd" fontFamily="DM Mono, monospace" fontSize="8" textAnchor="middle">16'-0"</text>
                  <circle cx="404" cy="52" r="20" /><path d="M404 66 V38 M404 38 l-6 10 M404 38 l6 10" />
                  <text x="404" y="88" fill="#a8c4dd" fontFamily="DM Mono, monospace" fontSize="9" textAnchor="middle">N</text>
                  <text x="150" y="316" fill="#a8c4dd" fontFamily="DM Mono, monospace" fontSize="8.5">SWEETGRASS LANE</text>
                </g>
              </svg>
            )}
          </div>
          <figcaption className="cap">
            {heroSite ? "SHEET " + heroSite.no + " · SITE PLAN · RENDERED BY THE PRODUCTION PIPELINE" : "SITE PLAN · AUTO-DRAWN FROM PARCEL RECORDS"}
          </figcaption>
        </figure>
      </header>

      <section className="section" id="how" aria-labelledby="how-h">
        <div className="sec-head"><span className="sec-no">SEC. 01</span><h2 id="how-h">How it works</h2></div>
        <div className="acts">
          <article className="act">
            <div className="act-tag">STEP 01 / YOUR PROPERTY</div>
            <h3>Enter your address</h3>
            <p>We find your parcel in public records: lot shape, dimensions, zoning setbacks, and your house footprint. Confirm it with one click, upload a survey and let our AI read it, or draw the lot yourself.</p>
            <div className="act-time">ABOUT 15 SECONDS</div>
          </article>
          <article className="act">
            <div className="act-tag">STEP 02 / YOUR DECK</div>
            <h3>Design on your lot</h3>
            <p>Size your deck right on your property. Add wings, corners, and stairs. Joists, beams, posts, and footings size themselves to code as you work, and setback problems surface immediately instead of at the permit counter.</p>
            <div className="act-time">ABOUT 5 MINUTES</div>
          </article>
          <article className="act">
            <div className="act-tag">STEP 03 / YOUR PLANS</div>
            <h3>Download your drawing set</h3>
            <p>Preview every sheet free: site plan, deck plan, framing, elevations, details, notes, and checklist, all drawn from your design. Submit the set to your building department when you are ready.</p>
            <div className="act-time">8 SHEETS, INSTANT</div>
          </article>
        </div>
      </section>

      <section className="section" id="sheets" aria-labelledby="sheets-h" style={{ background: "var(--paper)", maxWidth: "none" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div className="sec-head"><span className="sec-no">SEC. 02</span><h2 id="sheets-h">What your building department gets</h2></div>
          <p style={{ maxWidth: "64ch", marginBottom: 26, color: "#454d3f", fontSize: 15 }}>A complete deck permit submission set. Every sheet carries a title block with your address and parcel number, and every structural member cites the 2021 IRC section it was sized from. These are not stock previews. The sheets below are drawn live by the same pipeline that will draw yours.</p>
          {sheets ? (function () {
            // Cover (A-0) and deck plan (A-1) lead at full size; the remaining
            // sheets sit in a row underneath.
            var hero = sheets.filter(function (s) { return s.no === "A-0" || s.no === "A-1"; });
            var rest = sheets.filter(function (s) { return s.no !== "A-0" && s.no !== "A-1"; });
            var thumb = function (sh, big) {
              return (
                <div key={sh.no} className="sheet-thumb">
                  <img src={"data:image/png;base64," + sh.png} alt={sh.name + " sample sheet"} style={{ width: "100%", display: "block" }} />
                  <div className="st-cap"><b>{sh.no}</b><span>{sh.name}{big && sh.no === "A-1" ? " \u00b7 REAL RENDER" : ""}</span></div>
                </div>
              );
            };
            return (
              <React.Fragment>
                <div className="sheets-feature">{hero.map(function (s) { return thumb(s, true); })}</div>
                <div className="sheets-strip">{rest.map(function (s) { return thumb(s, false); })}</div>
              </React.Fragment>
            );
          })() : (
            <React.Fragment>
              <div className="sheets-feature">
                {[0, 1].map(function (i) {
                  return (
                    <div key={"fskel-" + i} className="sheet-thumb">
                      <div style={{ width: "100%", paddingTop: "66%", background: "var(--ruling-soft)" }} />
                      <div className="st-cap"><b>&nbsp;</b><span>RENDERING</span></div>
                    </div>
                  );
                })}
              </div>
              <div className="sheets-strip">
                {[0, 1, 2, 3, 4].map(function (i) {
                  return (
                    <div key={"skel-" + i} className="sheet-thumb">
                      <div style={{ width: "100%", paddingTop: "66%", background: "var(--ruling-soft)" }} />
                      <div className="st-cap"><b>&nbsp;</b><span>RENDERING</span></div>
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          )}
          <p style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 11, color: "var(--mut)" }}>THE FULL SET REDRAWS FROM YOUR DESIGN AS YOU WORK</p>
        </div>
      </section>

      <section className="section" id="pricing" aria-labelledby="pricing-h">
        <div className="sec-head"><span className="sec-no">SEC. 03</span><h2 id="pricing-h">Pricing</h2></div>
        <div className="pricing">
          <div className="price-card">
            <div className="pc-tier">Standard</div>
            <div className="pc-price">Free</div>
            <div className="pc-per">DURING BETA</div>
            <ul>
              <li>Complete 8-sheet permit drawing set (PDF)</li>
              <li>Site plan drawn from your parcel records</li>
              <li>IRC 2021 structural calculations with code citations</li>
              <li>Unlimited revisions</li>
            </ul>
            <button className="btn ghost" onClick={function () { start(); }}>Start a design</button>
          </div>
          <div className="price-card featured">
            <div className="pc-tier">Complete</div>
            <div className="pc-price">Free</div>
            <div className="pc-per">DURING BETA</div>
            <ul>
              <li>Everything in Standard</li>
              <li>Cut list with every board length and quantity</li>
              <li>Materials list organized by component</li>
              <li>Hardware schedule with connector callouts</li>
            </ul>
            <button className="btn primary" onClick={function () { start(); }}>Start a design</button>
          </div>
        </div>
        <p style={{ textAlign: "center", marginTop: 22, fontFamily: "var(--mono)", fontSize: 12, color: "var(--mut)" }}>SimpleBlueprints is in beta and everything is free while we are here. A drafter charges $150 to $500 and takes days.</p>
      </section>

      <section className="section" aria-labelledby="faq-h" style={{ background: "var(--paper)", maxWidth: "none" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div className="sec-head"><span className="sec-no">SEC. 04</span><h2 id="faq-h">Deck permit questions</h2></div>
          <div className="faq">
            <details>
              <summary>Do I need a permit to build a deck?</summary>
              <p className="faq-a">In most jurisdictions, yes. Decks attached to a house, taller than 30 inches above grade, or larger than about 200 square feet typically require a building permit, which means a site plan and structural drawings. Your local building department makes the final call, so it is always worth a phone call before you build.</p>
            </details>
            <details>
              <summary>What do I need to submit for a deck permit?</summary>
              <p className="faq-a">Most departments want a site plan showing your lot, house, the proposed deck, and setback distances, plus a framing plan, elevations, structural details for footings, posts, and the ledger connection, and general notes. SimpleBlueprints generates all of these from one design session, in one drawing set.</p>
            </details>
            <details>
              <summary>How do you know what my property looks like?</summary>
              <p className="faq-a">We look up your parcel in public records to get your lot boundary, dimensions, and zoning setbacks, and detect your house footprint from public mapping data. Nothing is submitted anywhere. You confirm and adjust everything yourself before designing. If records for your lot are thin, upload your property survey and our AI will read it, or draw the lot manually.</p>
            </details>
            <details>
              <summary>Are the structural calculations legitimate?</summary>
              <p className="faq-a">Joists, beams, posts, and footings are sized from the 2021 International Residential Code prescriptive tables (R507), adjusted for your snow load and frost depth, with the code sections printed on your plans. Plans support your permit application, and the building department always has final authority.</p>
            </details>
            <details>
              <summary>Can contractors use this for client projects?</summary>
              <p className="faq-a">Yes. Contractors and deck builders use SimpleBlueprints to turn a site visit into a submittable drawing set the same day, with a title block carrying the project address and parcel number. Run as many properties as you need, and revise a set as many times as the plan examiner asks.</p>
            </details>
            <details>
              <summary>What if my building department rejects the plans?</summary>
              <p className="faq-a">Come back, revise your design, and download again. Revisions are free. Departments usually mark up exactly what they want changed, and most changes take minutes in the designer.</p>
            </details>
          </div>
        </div>
      </section>

      <section className="section" style={{ textAlign: "center" }}>
        <h2 className="disp" style={{ fontSize: "clamp(26px,4vw,44px)", marginBottom: 12 }}>Your lot is already on file.<br />Go look at it.</h2>
        <button className="btn primary" style={{ fontSize: 16, padding: "15px 30px" }} onClick={function () { start(); }}>Start with your address</button>
      </section>

      <footer className="footer">
        <div className="f-grid">
          <div>
            <a className="wordmark" href="/" style={{ marginBottom: 8 }} onClick={function (e) { e.preventDefault(); }}><span className="wm-main" style={{ fontSize: 18 }}>SimpleBlueprints</span></a>
            <p style={{ fontSize: 12.5, color: "var(--mut)", maxWidth: "34ch" }}>Permit-ready deck plans drawn from your actual property. Free while we are in beta.</p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="#how" >How it works</a>
            <a href="#sheets">Sample drawing set</a>
            <a href="#pricing">Pricing</a>
          </div>
        </div>
        <div className="f-legal">{"\u00A9"} 2026 SIMPLEBLUEPRINTS · PLANS SUPPORT YOUR PERMIT APPLICATION · YOUR BUILDING DEPARTMENT HAS FINAL AUTHORITY</div>
      </footer>
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
