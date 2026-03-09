// ============================================================
// HOME PAGE + SHARED THEME CONSTANTS
// ============================================================

// Shared theme — used by home.js, steps.js, app.js
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

function HomePage({ setPage }) {
  const { br, mono, sans } = window.SB;
  const products = window.products;
  return (
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
        <p style={{ fontFamily: sans, fontSize: "clamp(14px, 2.5vw, 18px)", color: br.mu, maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.6 }}>Configure your project, get IRC-compliant structural calculations, and download a professional drawing set. Draft your deck plans \u2014 fast.</p>
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
}

window.HomePage = HomePage;
