// ============================================================
// WIZARD STEPS   Step 0 (Site Plan), Step 1 (Size), Step 2 (Structure),
//                Step 3 (Finishes), Step 4 (Review)
// Multi-zone support added S19, Site Plan step added S27
// S28: Unified Step 0 flow (Site Plan first, sliders + collapsible upload)
// ============================================================
const { useState: _stUS, useEffect: _stUE, useMemo: _stUM } = React;
const { br: _br, mono: _mono, sans: _sans } = window.SB;

// S47: Survey preview component with page navigation (pdf.js for PDFs, img for images)
function SurveyPreview({ b64, fileType }) {
  var _s = _stUS(null), src = _s[0], setSrc = _s[1];
  var _p = _stUS(1), page = _p[0], setPage = _p[1];
  var _pc = _stUS(1), pageCount = _pc[0], setPageCount = _pc[1];
  function renderPage(pg) {
    if (!b64 || fileType !== "pdf") return;
    try {
      var raw = atob(b64);
      var arr = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      window.pdfjsLib.getDocument({ data: arr }).promise.then(function(pdf) {
        setPageCount(pdf.numPages);
        return pdf.getPage(pg);
      }).then(function(pg2) {
        var vp = pg2.getViewport({ scale: 1.5 });
        var canvas = document.createElement("canvas");
        canvas.width = vp.width; canvas.height = vp.height;
        var ctx = canvas.getContext("2d");
        return pg2.render({ canvasContext: ctx, viewport: vp }).promise.then(function() {
          setSrc(canvas.toDataURL("image/png"));
        });
      }).catch(function(err) { console.error("Survey PDF render error:", err); });
    } catch (err) { console.error("Survey PDF decode error:", err); }
  }
  _stUE(function() {
    if (!b64) { setSrc(null); return; }
    if (fileType !== "pdf") {
      var mime = b64.substring(0, 4) === "/9j/" ? "jpeg" : "png";
      setSrc("data:image/" + mime + ";base64," + b64);
      return;
    }
    function doLoad() { renderPage(page); }
    if (window.pdfjsLib) { doLoad(); }
    else {
      var sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      sc.onload = function() {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        doLoad();
      };
      sc.onerror = function() { console.error("Failed to load pdf.js"); };
      document.head.appendChild(sc);
    }
  }, [b64, fileType, page]);
  if (!src) return null;
  var btnStyle = { fontSize: 10, fontFamily: _mono, padding: "3px 10px", cursor: "pointer", background: "none", border: "1px solid " + _br.bd, borderRadius: 4, color: _br.tx, fontWeight: 700 };
  return React.createElement("div", null,
    React.createElement("img", { src: src, style: { width: "100%", objectFit: "contain", borderRadius: 4, border: "1px solid " + _br.bd } }),
    fileType === "pdf" && pageCount > 1 && React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: 6 } },
      React.createElement("span", { style: { fontSize: 8, fontFamily: _mono, color: _br.mu, fontStyle: "italic" } }, "Navigate to the page showing your lot boundary"),
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
      React.createElement("button", { onClick: function() { if (page > 1) { setPage(page - 1); } }, disabled: page <= 1, style: Object.assign({}, btnStyle, page <= 1 ? { opacity: 0.3, cursor: "default" } : {}) }, "\u25C0"),
      React.createElement("span", { style: { fontSize: 9, fontFamily: _mono, color: _br.mu } }, "Page " + page + " of " + pageCount),
      React.createElement("button", { onClick: function() { if (page < pageCount) { setPage(page + 1); } }, disabled: page >= pageCount, style: Object.assign({}, btnStyle, page >= pageCount ? { opacity: 0.3, cursor: "default" } : {}) }, "\u25B6")
      )
    )
  );
}
window.SurveyPreview = SurveyPreview;

// S48: Shape cards for compare view with preview selection
function CompareShapes({ candidates, previewIdx }) {
  if (!candidates || candidates.length === 0) return React.createElement("div", { style: { fontSize: 10, color: _br.mu, fontFamily: _mono } }, "No shapes available");
  var edgeColors = ["#e53935", "#2563eb", "#8B7355", "#7c3aed", "#0d9488"];
  return React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 } },
    candidates.map(function(cand, ci) {
      var isSelected = previewIdx === ci;
      var cv = cand.vertices;
      var cmaxX = 0, cmaxY = 0;
      cv.forEach(function(v) { if (v[0] > cmaxX) cmaxX = v[0]; if (v[1] > cmaxY) cmaxY = v[1]; });
      var cpad = Math.max(cmaxX, cmaxY) * 0.12;
      var cvbW = cmaxX + cpad * 2, cvbH = cmaxY + cpad * 2;
      var cpts = cv.map(function(v) { return (v[0] + cpad).toFixed(1) + "," + (cvbH - v[1] - cpad).toFixed(1); }).join(" ");
      var csw = Math.max(1.5, cvbW / 200);
      return React.createElement("div", {
        key: ci,
        onClick: function() { if (window._onPreviewShape) window._onPreviewShape(ci); },
        style: { cursor: "pointer", padding: 10, background: isSelected ? "#f0fdf4" : "#fff", borderRadius: 8, border: "2px solid " + (isSelected ? "#2e7d32" : _br.bd), transition: "all 0.15s", position: "relative" },
        onMouseOver: function(e) { if (!isSelected) { e.currentTarget.style.borderColor = _br.gn; e.currentTarget.style.boxShadow = "0 2px 8px rgba(61,90,46,0.15)"; } },
        onMouseOut: function(e) { if (!isSelected) { e.currentTarget.style.borderColor = _br.bd; e.currentTarget.style.boxShadow = "none"; } }
      },
        isSelected && React.createElement("div", { style: { position: "absolute", top: 6, right: 8, fontSize: 14 } }, "\u2705"),
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
          React.createElement("svg", { viewBox: "0 0 " + cvbW.toFixed(0) + " " + cvbH.toFixed(0), style: { width: 80, height: 80, flexShrink: 0 }, preserveAspectRatio: "xMidYMid meet" },
            React.createElement("polygon", { points: cpts, fill: isSelected ? "rgba(46,125,50,0.12)" : "rgba(61,90,46,0.08)", stroke: isSelected ? "#2e7d32" : "#3d5a2e", strokeWidth: csw, strokeLinejoin: "round" }),
            cv.map(function(v, vi) {
              var v2 = cv[(vi + 1) % cv.length];
              var mx = (v[0] + v2[0]) / 2 + cpad;
              var my = cvbH - ((v[1] + v2[1]) / 2) - cpad;
              var col = edgeColors[vi % edgeColors.length];
              return React.createElement("circle", { key: vi, cx: mx.toFixed(1), cy: my.toFixed(1), r: 3, fill: col });
            })
          ),
          React.createElement("div", { style: { flex: 1 } },
            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, fontFamily: _mono, color: _br.tx, marginBottom: 4 } }, "Option " + (ci + 1) + "  " + cand.area.toLocaleString() + " SF"),
            cand.edges.map(function(e, ei) {
              var col = edgeColors[ei % edgeColors.length];
              var isStr = e.type === "street";
              return React.createElement("div", { key: ei, style: { display: "flex", alignItems: "center", gap: 4, padding: "1px 0" } },
                React.createElement("span", { style: { width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 } }),
                React.createElement("span", { style: { fontSize: 11, fontFamily: _mono, fontWeight: 700, color: _br.tx } }, e.length + "'"),
                React.createElement("span", { style: { fontSize: 9, fontFamily: _mono, color: isStr ? "#e53935" : _br.mu, fontWeight: isStr ? 600 : 400 } }, isStr ? (e.label || "street") : (e.neighborLabel || e.setbackType || ""))
              );
            })
          )
        )
      );
    })
  );
}
window.CompareShapes = CompareShapes;

// Feet-inches formatter (20.5   20'-6")
function fmtFtIn(v) {
  var ft = Math.floor(v);
  var inches = Math.round((v - ft) * 12);
  if (inches === 12) { ft += 1; inches = 0; }
  return inches === 0 ? ft + "'" : ft + "'-" + inches + '"';
}
window.fmtFtIn = fmtFtIn;

// Shared UI helpers
function Label({ children }) {
  return <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: _br.mu, marginBottom: 4, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase" }}>{children}</label>;
}

function Slider({ label, value, min, max, step: s = 1, field, unit = "'", fmt, u, p, focused }) {
  const [editing, setEditing] = _stUS(false);
  const [draft, setDraft] = _stUS(String(value));
  const commit = () => {
    setEditing(false);
    let v = parseFloat(draft);
    if (isNaN(v)) v = value;
    v = Math.max(min, Math.min(max, s < 1 ? v : Math.round(v / s) * s));
    u(field, v);
    setDraft(String(v));
  };
  _stUE(() => { if (!editing) setDraft(String(value)); }, [value, editing]);
  return (
    <div style={{ marginBottom: 16, borderLeft: focused ? ("3px solid " + _br.gn) : "3px solid transparent", paddingLeft: focused ? 10 : 0, transition: "all 0.2s" }}><Label>{label}</Label>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="range" min={min} max={max} step={s} value={value} onChange={e => u(field, Number(e.target.value))} style={{ flex: 1, accentColor: _br.gn, height: 6 }} />
        {editing ? (
          <input type="number" min={min} max={max} step={s} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()} autoFocus
            style={{ width: 60, fontFamily: _mono, fontSize: 16, fontWeight: 800, color: _br.tx, textAlign: "right", border: `2px solid ${_br.gn}`, borderRadius: 4, padding: "2px 4px", outline: "none", background: "#fff" }} />
        ) : (
          <span onClick={() => setEditing(true)} style={{ fontFamily: _mono, fontSize: 18, fontWeight: 800, color: _br.tx, minWidth: 58, textAlign: "center", cursor: "text", background: "#f0ede4", borderRadius: 5, padding: "2px 8px", border: `1px solid ${_br.bd}`, display: "inline-flex", alignItems: "center", gap: 4 }}>{fmt ? fmt(value) : (value + unit)}<span style={{ fontSize: 10, color: _br.mu, opacity: 0.6 }}>{"\u270E"}</span></span>
        )}
      </div>
    </div>
  );
}

function Chips({ label, field, opts, u, p }) {
  return (
    <div style={{ marginBottom: 16 }}><Label>{label}</Label>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {opts.map(([v, t]) => <button key={v} onClick={() => u(field, v)} style={{ padding: "7px 14px", borderRadius: 6, fontSize: 11, fontFamily: _mono, cursor: "pointer", border: p[field] === v ? `2px solid ${_br.gn}` : `1px solid ${_br.bd}`, background: p[field] === v ? _br.gn : "#fff", color: p[field] === v ? "#fff" : _br.tx, fontWeight: p[field] === v ? 700 : 400, transition: "all 0.15s" }}>{t}</button>)}
      </div>
    </div>
  );
}

function Spec({ l, v, color }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${_br.wr}` }}><span style={{ fontSize: 11, color: _br.mu, fontFamily: _mono }}>{l}</span><span style={{ fontSize: 11, fontWeight: 700, color: color || _br.tx, fontFamily: _mono }}>{v}</span></div>;
}

// ============================================================
// AI GUIDE   Phase definitions + GuidePanel component (S49)
// ============================================================

var GUIDE_PHASES_STEP0 = [
  // --- FIRST QUESTION ---
  {
    id: 'has_survey',
    message: "Do you have a property survey or plot map?",
    tip: "This is usually from your closing documents or a surveyor. A plat map from your county works too.",
    sections: [],
    actions: [
      { label: 'Yes, I have one', next: 'upload_survey', style: 'primary' },
      { label: 'No, I will enter manually', next: 'lot_dims', style: 'secondary' }
    ]
  },
  // --- SURVEY PATH ---
  {
    id: 'upload_survey',
    message: "Upload your property survey or plot map.",
    tip: "PDF works best. You can also use a photo of the document.",
    sections: ['upload'],
    actions: []
  },
  {
    id: 'extracting',
    message: "Analyzing your survey...",
    tip: "Detecting lot shape, dimensions, and property info.",
    sections: ['upload'],
    actions: []
  },
  {
    id: 'shape_select',
    message: "Which shape matches your lot?",
    tip: "Compare the options to your survey in the preview panel.",
    sections: [],
    actions: []
  },
  {
    id: 'verify_extracted',
    message: "Here is what we found. Do these numbers look right?",
    tip: "Check the preview on the right. Adjust any values that seem off.",
    sections: ['lotHouse'],
    actions: [
      { label: 'Looks good', next: 'site_elements_check', style: 'primary' },
      { label: 'Let me adjust', action: 'expand_for_edit', style: 'secondary' }
    ]
  },
  {
    id: 'trace_or_manual',
    message: "We could not auto-detect the lot shape.",
    tip: "You can trace it on the survey image or enter dimensions manually.",
    sections: ['upload'],
    actions: [
      { label: 'Trace on survey', action: 'start_trace', style: 'primary' },
      { label: 'Enter manually', next: 'lot_dims', style: 'secondary' }
    ]
  },
  // --- MANUAL PATH ---
  {
    id: 'lot_dims',
    message: "How big is your property?",
    tip: "Check your county tax records or closing documents for exact dimensions.",
    sections: ['lotHouse'],
    focusFields: ['lotWidth', 'lotDepth'],
    actions: [
      { label: 'Continue', next: 'house_position', style: 'primary' }
    ]
  },
  {
    id: 'house_position',
    message: "Where does your house sit on the lot?",
    tip: "House width is the wall where your deck will attach.",
    sections: ['lotHouse'],
    focusFields: ['houseWidth', 'houseDepth', 'houseOffsetSide', 'houseDistFromStreet'],
    actions: [
      { label: 'Continue', next: 'setbacks', style: 'primary' }
    ]
  },
  {
    id: 'setbacks',
    message: "What are your zoning setbacks?",
    tip: "Your building department can tell you these. Common: 25' front, 10' side, 25' rear.",
    sections: ['lotHouse'],
    focusFields: ['setbackFront', 'setbackSide', 'setbackRear'],
    actions: [
      { label: 'Use common defaults', action: 'apply_default_setbacks', next: 'site_elements_check', style: 'secondary' },
      { label: 'Continue', next: 'site_elements_check', style: 'primary' }
    ]
  },
  // --- MERGED PATH ---
  {
    id: 'site_elements_check',
    message: "Any other structures on your lot?",
    tip: "Garages, sheds, pools, driveways. These show on the site plan.",
    sections: ['siteElements'],
    actions: [
      { label: 'Add elements', action: 'expand_site_elements', style: 'secondary' },
      { label: 'Skip', next: 'north_arrow', style: 'primary' }
    ]
  },
  {
    id: 'north_arrow',
    message: "Which direction is north?",
    tip: "Check Google Maps if unsure. Use the compass below or pick a direction.",
    sections: ['northArrow'],
    actions: [
      { label: 'N', action: 'set_north_0', style: 'secondary' },
      { label: 'NE', action: 'set_north_45', style: 'secondary' },
      { label: 'E', action: 'set_north_90', style: 'secondary' },
      { label: 'S', action: 'set_north_180', style: 'secondary' },
      { label: 'W', action: 'set_north_270', style: 'secondary' },
      { label: 'Continue', next: 'slope', style: 'primary' }
    ]
  },
  {
    id: 'slope',
    message: "Does your yard slope?",
    tip: "Most lots have a gentle slope. Set to 0% if your yard looks flat.",
    sections: ['slope'],
    actions: [
      { label: 'Flat lot (0%)', action: 'set_flat', next: 'complete', style: 'secondary' },
      { label: 'Continue', next: 'complete', style: 'primary' }
    ]
  },
  {
    id: 'complete',
    message: "Your property is set up!",
    tip: "Review the site plan on the right, then continue to design your deck.",
    sections: [],
    actions: [
      { label: 'Design my deck \u2192', action: 'advance_step', style: 'primary' }
    ]
  }
];

// Build a lookup map for phases
var _guidePhaseMap = {};
GUIDE_PHASES_STEP0.forEach(function(ph) { _guidePhaseMap[ph.id] = ph; });

// All phase IDs in order for progress calculation
var _guidePhaseOrder = GUIDE_PHASES_STEP0.map(function(ph) { return ph.id; });

// S49: Step 1 guide phases
var GUIDE_PHASES_STEP1 = [
  {
    id: 's1_deck_size',
    // message/tip are dynamic based on extraction, set at render time
    sections: ['deckSize'],
    focusFields: ['width', 'depth', 'height'],
    actions: [
      { label: 'Continue', next: 's1_attachment', style: 'primary' }
    ]
  },
  {
    id: 's1_attachment',
    message: "How will the deck attach to your house?",
    tip: "Ledger board bolts directly to the house. Freestanding uses its own posts near the house wall.",
    sections: ['attachment'],
    actions: [
      { label: 'Continue', next: 's1_stairs', style: 'primary' }
    ]
  },
  {
    id: 's1_stairs',
    message: "Do you need stairs?",
    tip: "If your deck is more than 30 inches above grade, stairs are required by code.",
    sections: ['stairs'],
    actions: [
      { label: 'Continue', next: 's1_complete', style: 'primary' }
    ]
  },
  {
    id: 's1_complete',
    message: "Deck design is set!",
    tip: "Review the plan view on the right. Next up: structural specifications.",
    sections: [],
    actions: [
      { label: 'Continue to Structure \u2192', action: 'advance_step', style: 'primary' }
    ]
  }
];

// Add Step 1 phases to the lookup map
GUIDE_PHASES_STEP1.forEach(function(ph) { _guidePhaseMap[ph.id] = ph; });
var _guideStep1Order = GUIDE_PHASES_STEP1.map(function(ph) { return ph.id; });

// S49: Step 2 guide phases (Structure - mostly auto-calculated)
var GUIDE_PHASES_STEP2 = [
  {
    id: 's2_environment',
    message: "Tell us about your local conditions.",
    tip: "These affect footing depth and structural sizing. Your building department can confirm.",
    sections: [],
    actions: [
      { label: 'Continue', next: 's2_review', style: 'primary' }
    ]
  },
  {
    id: 's2_review',
    message: "Structural specs have been auto-calculated.",
    tip: "These are based on IRC tables for your deck size. Override any value by clicking AUTO to switch to MANUAL.",
    sections: [],
    actions: [
      { label: 'Looks good', next: 's2_complete', style: 'primary' }
    ]
  },
  {
    id: 's2_complete',
    message: "Structure is set!",
    tip: "Next up: choose your finish materials and see cost estimates.",
    sections: [],
    actions: [
      { label: 'Continue to Finishes \u2192', action: 'advance_step', style: 'primary' }
    ]
  }
];
GUIDE_PHASES_STEP2.forEach(function(ph) { _guidePhaseMap[ph.id] = ph; });
var _guideStep2Order = GUIDE_PHASES_STEP2.map(function(ph) { return ph.id; });

// S49: Step 3 guide phases (Finishes)
var GUIDE_PHASES_STEP3 = [
  {
    id: 's3_materials',
    message: "Choose your finish materials.",
    tip: "Composite costs more upfront but needs less maintenance. Pressure treated is budget-friendly.",
    sections: [],
    actions: [
      { label: 'Continue', next: 's3_complete', style: 'primary' }
    ]
  },
  {
    id: 's3_complete',
    message: "Materials selected! Cost estimate: $" + "COST",
    tip: "Review the cost breakdown below, then continue to generate your blueprints.",
    sections: [],
    actions: [
      { label: 'Continue to Review \u2192', action: 'advance_step', style: 'primary' }
    ]
  }
];
GUIDE_PHASES_STEP3.forEach(function(ph) { _guidePhaseMap[ph.id] = ph; });
var _guideStep3Order = GUIDE_PHASES_STEP3.map(function(ph) { return ph.id; });

// S49: Step 4 guide phases (Review)
var GUIDE_PHASES_STEP4 = [
  {
    id: 's4_info',
    message: "Fill in your project information.",
    tip: "This prints on the title block of your blueprints. The permit office needs your name and address.",
    sections: [],
    actions: [
      { label: 'Continue', next: 's4_generate', style: 'primary' }
    ]
  },
  {
    id: 's4_generate',
    message: "Ready to generate your permit-ready blueprints!",
    tip: "Click the button below to create your PDF blueprint package.",
    sections: [],
    actions: []
  }
];
GUIDE_PHASES_STEP4.forEach(function(ph) { _guidePhaseMap[ph.id] = ph; });
var _guideStep4Order = GUIDE_PHASES_STEP4.map(function(ph) { return ph.id; });

// GuidePanel: embedded guide at top of wizard step
function GuidePanel({ phase, onAction, onBack, history, onToggleOff, message, tip }) {
  var ph = _guidePhaseMap[phase];
  if (!ph) return null;

  // Progress: check all step arrays
  var _allOrders = [_guidePhaseOrder, _guideStep1Order, _guideStep2Order, _guideStep3Order, _guideStep4Order];
  var idx = -1, total = 1;
  for (var oi = 0; oi < _allOrders.length; oi++) {
    var found = _allOrders[oi].indexOf(phase);
    if (found >= 0) { idx = found; total = _allOrders[oi].length; break; }
  }
  var pct = total > 0 ? Math.round(((idx + 1) / total) * 100) : 0;
  if (phase.indexOf('_complete') >= 0) pct = 100;
  if (pct < 5) pct = 5;

  // Use dynamic message/tip if provided, otherwise phase defaults
  var displayMsg = message || ph.message;
  var displayTip = tip || ph.tip;
  if (pct < 5) pct = 5;

  var canGoBack = history && history.length > 0;

  return <div style={{
    marginBottom: 16,
    padding: "16px 18px",
    background: "linear-gradient(135deg, #f0fdf4 0%, #faf8f3 100%)",
    borderRadius: 10,
    border: "1px solid " + _br.gn + "44",
    boxShadow: "0 2px 8px rgba(61,90,46,0.08)"
  }}>
    {/* Progress bar */}
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{ flex: 1, height: 4, background: _br.wr, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", background: _br.gn, borderRadius: 2, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: 8, fontFamily: _mono, color: _br.mu, flexShrink: 0 }}>{pct}%</span>
    </div>

    {/* Message */}
    <div style={{ fontSize: 14, fontWeight: 700, color: _br.dk, fontFamily: _sans, lineHeight: 1.4, marginBottom: 4 }}>
      {displayMsg}
    </div>

    {/* Tip */}
    {displayTip && <div style={{ fontSize: 11, color: _br.mu, fontFamily: _sans, lineHeight: 1.5, marginBottom: 12 }}>
      {displayTip}
    </div>}

    {/* Action buttons */}
    {ph.actions && ph.actions.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {ph.actions.map(function(act, ai) {
        var isPrimary = act.style === 'primary';
        return <button key={ai} onClick={function() { onAction(act); }} style={{
          padding: "9px 18px",
          borderRadius: 6,
          fontSize: 11,
          fontFamily: _mono,
          fontWeight: 700,
          cursor: "pointer",
          border: isPrimary ? "none" : ("1px solid " + _br.gn),
          background: isPrimary ? _br.gn : "transparent",
          color: isPrimary ? "#fff" : _br.gn,
          transition: "all 0.15s"
        }}>{act.label}</button>;
      })}
    </div>}

    {/* Footer: back + mode toggle */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: ph.actions && ph.actions.length > 0 ? 12 : 4, paddingTop: 8, borderTop: "1px solid " + _br.gn + "22" }}>
      {canGoBack ? <button onClick={onBack} style={{
        fontSize: 10, fontFamily: _mono, color: _br.mu, background: "none",
        border: "none", cursor: "pointer", padding: "2px 0"
      }}>{"\u2190"} Back</button> : <span />}
      <button onClick={onToggleOff} style={{
        fontSize: 9, fontFamily: _mono, color: _br.mu, background: "none",
        border: "none", cursor: "pointer", padding: "2px 0", opacity: 0.7
      }}>Switch to manual</button>
    </div>
    {/* S49: Down-arrow connector when sections follow */}
    {ph.sections && ph.sections.length > 0 && <div style={{ textAlign: "center", marginTop: -8, marginBottom: -8, position: "relative", zIndex: 1 }}>
      <span style={{ fontSize: 16, color: _br.gn, opacity: 0.5 }}>{"\u25BC"}</span>
    </div>}
  </div>;
}
function GuideChoiceScreen({ onChoose }) {
  var cardBase = {
    flex: "1 1 200px",
    padding: "24px 20px",
    borderRadius: 10,
    cursor: "pointer",
    textAlign: "center",
    transition: "all 0.2s",
    minHeight: 160,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between"
  };
  return <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 14, fontWeight: 800, color: _br.dk, fontFamily: _sans, marginBottom: 4, textAlign: "center" }}>
      How would you like to get started?
    </div>
    <div style={{ fontSize: 11, color: _br.mu, fontFamily: _sans, marginBottom: 16, textAlign: "center" }}>
      You can switch modes at any time.
    </div>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div onClick={function() { onChoose('guided'); }}
        onMouseOver={function(e) { e.currentTarget.style.borderColor = _br.gn; e.currentTarget.style.boxShadow = "0 4px 16px rgba(61,90,46,0.15)"; }}
        onMouseOut={function(e) { e.currentTarget.style.borderColor = _br.gn + "66"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(61,90,46,0.06)"; }}
        style={Object.assign({}, cardBase, {
          background: "linear-gradient(135deg, #f0fdf4 0%, #e8f5e9 100%)",
          border: "2px solid " + _br.gn + "66",
          boxShadow: "0 2px 8px rgba(61,90,46,0.06)"
        })}>
        <div>
          <div style={{ fontSize: 28, marginBottom: 10 }}>{"\uD83E\uDDED"}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: _br.gn, fontFamily: _sans, marginBottom: 6 }}>Guided Setup</div>
          <div style={{ fontSize: 11, color: _br.tx, fontFamily: _sans, lineHeight: 1.5 }}>
            Simple questions walk you through each step. About 5 minutes.
          </div>
        </div>
        <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, marginTop: 12, fontStyle: "italic" }}>
          Best for homeowners
        </div>
      </div>
      <div onClick={function() { onChoose('manual'); }}
        onMouseOver={function(e) { e.currentTarget.style.borderColor = _br.bd; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
        onMouseOut={function(e) { e.currentTarget.style.borderColor = _br.bd; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
        style={Object.assign({}, cardBase, {
          background: "#fff",
          border: "2px solid " + _br.bd,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
        })}>
        <div>
          <div style={{ fontSize: 28, marginBottom: 10 }}>{"\u2699\uFE0F"}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: _br.tx, fontFamily: _sans, marginBottom: 6 }}>Manual Setup</div>
          <div style={{ fontSize: 11, color: _br.tx, fontFamily: _sans, lineHeight: 1.5 }}>
            Fill in dimensions and settings yourself. All controls visible.
          </div>
        </div>
        <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, marginTop: 12, fontStyle: "italic" }}>
          Best for contractors & repeat users
        </div>
      </div>
    </div>
  </div>;
}


// Stair template icons (unchanged)
function stairIcon(key) {
  var c = "#3d5a2e", f = "#faf8f3", lc = "#e8e6d8", s = 0.8, ao = 0.6;
  if (key === "straight") return (<svg width={28} height={24} viewBox="0 0 28 24"><rect x={9} y={1} width={10} height={22} fill={f} stroke={c} strokeWidth={s} rx={1}/><polygon points="14,18 11,14 17,14" fill={c} opacity={ao}/></svg>);
  if (key === "lLeft") return (<svg width={28} height={24} viewBox="0 0 28 24"><rect x={14} y={1} width={10} height={14} fill={f} stroke={c} strokeWidth={s} rx={1}/><rect x={4} y={12} width={12} height={11} fill={f} stroke={c} strokeWidth={s} rx={1}/><polygon points="19,11 17,8 21,8" fill={c} opacity={ao}/><polygon points="7,17.5 10.5,15.5 10.5,19.5" fill={c} opacity={ao}/></svg>);
  if (key === "lRight") return (<svg width={28} height={24} viewBox="0 0 28 24"><rect x={4} y={1} width={10} height={14} fill={f} stroke={c} strokeWidth={s} rx={1}/><rect x={12} y={12} width={12} height={11} fill={f} stroke={c} strokeWidth={s} rx={1}/><polygon points="9,11 7,8 11,8" fill={c} opacity={ao}/><polygon points="21,17.5 17.5,15.5 17.5,19.5" fill={c} opacity={ao}/></svg>);
  if (key === "switchback") return (<svg width={28} height={24} viewBox="0 0 28 24"><rect x={3} y={1} width={9} height={17} fill={f} stroke={c} strokeWidth={s} rx={1}/><rect x={16} y={6} width={9} height={17} fill={f} stroke={c} strokeWidth={s} rx={1}/><rect x={10} y={13} width={8} height={5} fill={lc} stroke={c} strokeWidth={s} rx={1}/><polygon points="7.5,14 5.5,10 9.5,10" fill={c} opacity={ao}/><polygon points="20.5,10 18.5,14 22.5,14" fill={c} opacity={ao}/></svg>);
  if (key === "wrapAround") return (<svg width={28} height={24} viewBox="0 0 28 24"><rect x={15} y={1} width={9} height={10} fill={f} stroke={c} strokeWidth={s} rx={1}/><rect x={4} y={9} width={13} height={6} fill={lc} stroke={c} strokeWidth={s} rx={1}/><rect x={4} y={13} width={9} height={10} fill={f} stroke={c} strokeWidth={s} rx={1}/><polygon points="19.5,8 17.5,5 21.5,5" fill={c} opacity={ao}/><polygon points="7,12.5 10,10.5 10,14.5" fill={c} opacity={ao}/><polygon points="8.5,17 10.5,20 6.5,20" fill={c} opacity={ao}/></svg>);
  if (key === "wideLanding") return (<svg width={28} height={24} viewBox="0 0 28 24"><rect x={9} y={1} width={10} height={8} fill={f} stroke={c} strokeWidth={s} rx={1}/><rect x={6} y={8} width={16} height={7} fill={lc} stroke={c} strokeWidth={s} rx={1}/><rect x={9} y={14} width={10} height={9} fill={f} stroke={c} strokeWidth={s} rx={1}/><polygon points="14,6.5 12,4 16,4" fill={c} opacity={ao}/><polygon points="14,20 12,17.5 16,17.5" fill={c} opacity={ao}/></svg>);
  return null;
}

// Step Content
function StepContent(props) {
  const { step, p, u, c, m, info, setI, showAdvanced, setShowAdvanced,
    sitePlanMode, setSitePlanMode, sitePlanFile, setSitePlanFile, setSitePlanB64,
    isProduction, feedbackDone, setFeedbackDone, feedback, setFeedback, submitFeedback,
    genStatus, genError, generateBlueprint, user, API, materialsUrl,
    zoneMode, setZoneMode, addZone, addCutout, removeZone, updateZone, setCorner, getCorners, pForZones, zc,
    traceMode, setTraceMode, traceState, setTraceState, sitePlanB64,
    compareMode, setCompareMode } = props;

  const [showDisclaimer, setShowDisclaimer] = _stUS(false);
  const [disclaimerAcked, setDisclaimerAcked] = _stUS(false);
  const [showUpload, setShowUpload] = _stUS(false);
  const [extracting, setExtracting] = _stUS(false);
  const [extractResult, setExtractResult] = _stUS(null);
  const [extractError, setExtractError] = _stUS(null);
  const [showMissingModal, setShowMissingModal] = _stUS(false);
  const [missingFieldsAcked, setMissingFieldsAcked] = _stUS(false);
  const [showPprbdModal, setShowPprbdModal] = _stUS(false);
  const [pprbdChecklistAcked, setPprbdChecklistAcked] = _stUS(false);
  const [showSiteElements, setShowSiteElements] = _stUS(false);
  const [showLotShape, setShowLotShape] = _stUS(false);
  const [selectedElId, setSelectedElId] = _stUS(null);
  const [showLotHouse, setShowLotHouse] = _stUS(true);
  var dialDragRef = React.useRef(false);
  _stUE(function() { u("_selectedElId", selectedElId); }, [selectedElId]);

  // S49: AI Guide state
  // null = choice screen not yet shown, true = guided, false = manual
  const [guideActive, setGuideActive] = _stUS(null);

  // S50: PPRBD jurisdiction detection helper
  var _pprbdCities = ["colorado springs","fountain","manitou springs","green mountain falls","monument","palmer lake","woodland park","security","widefield","cascade","peyton","falcon","black forest"];
  var _pprbdZips = new Set(["80808","80809","80817","80819","80829","80831","80840","80863","80132","80133","80911","80913","80914","80925","80926","80928","80929","80930","80938","80939"]);
  for (var _zi = 80901; _zi <= 80951; _zi++) _pprbdZips.add(String(_zi));
  var _isPPRBD = (function() {
    var c = (info.city || "").toLowerCase();
    for (var i = 0; i < _pprbdCities.length; i++) { if (c.indexOf(_pprbdCities[i]) >= 0) return true; }
    return _pprbdZips.has((info.zip || "").slice(0, 5));
  })();
  const [guidePhase, setGuidePhase] = _stUS('has_survey');
  const [guideHistory, setGuideHistory] = _stUS([]);
  const [guidePeeked, setGuidePeeked] = _stUS({});

  function guideAdvance(nextPhase) {
    setGuideHistory(function(prev) { return prev.concat([guidePhase]); });
    setGuidePhase(nextPhase);
    // Auto-expand the section for the new phase
    var ph = _guidePhaseMap[nextPhase];
    if (ph && ph.sections) {
      ph.sections.forEach(function(s) {
        if (s === 'lotHouse') setShowLotHouse(true);
        if (s === 'siteElements') setShowSiteElements(true);
        if (s === 'upload') setShowUpload(true);
        if (s === 'lotShape') setShowLotShape(true);
      });
    }
  }

  function guideBack() {
    setGuideHistory(function(prev) {
      var copy = prev.slice();
      var last = copy.pop();
      if (last) setGuidePhase(last);
      return copy;
    });
  }

  function guideHandleAction(act) {
    if (act.action === 'apply_default_setbacks') {
      u('setbackFront', 25);
      u('setbackSide', 10);
      u('setbackRear', 25);
    }
    if (act.action === 'set_flat') {
      u('slopePercent', 0);
    }
    if (act.action && act.action.startsWith('set_north_')) {
      var angle = parseInt(act.action.replace('set_north_', ''));
      u('northAngle', angle);
    }
    if (act.action === 'advance_step') {
      if (props.setStep) props.setStep(step + 1);
      return;
    }
    if (act.action === 'expand_for_edit') {
      setShowLotHouse(true);
      setGuidePeeked(function(prev) { var copy = Object.assign({}, prev); copy.lotHouse = true; return copy; });
      setTimeout(function() {
        var el = document.querySelector('[data-guide-section="lotHouse"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return;
    }
    if (act.action === 'expand_site_elements') {
      setShowSiteElements(true);
      setGuidePeeked(function(prev) { var copy = Object.assign({}, prev); copy.siteElements = true; return copy; });
      // Scroll to site elements section
      setTimeout(function() {
        var el = document.querySelector('[data-guide-section="siteElements"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }
    if (act.action === 'start_trace') {
      setTraceState({
        calPoints: [], calDist: "", ppf: null,
        vertices: [], edgeMeta: [], edgeLengths: [],
        imgW: 0, imgH: 0,
        selectedEdge: null, selectedVertex: null,
        pdfPage: 1, pdfPageCount: 1
      });
      setTraceMode(true);
      return;
    }
    if (act.next) {
      guideAdvance(act.next);
    }
  }

  function guideChoose(mode) {
    if (mode === 'guided') {
      setGuideActive(true);
      setGuidePhase('has_survey');
    } else {
      setGuideActive(false);
    }
  }

  // Guide helper: should this section's header + body render at all?
  // In guided mode, hides sections not relevant to current phase (unless user peeked)
  function guideSectionShown(sectionId) {
    if (guideActive === null) return false; // choice screen: hide all
    if (guideActive === false) return true; // manual mode: show all
    // guided mode: show if phase wants it or user peeked
    var ph = _guidePhaseMap[guidePhase];
    var phaseWants = ph && ph.sections && ph.sections.indexOf(sectionId) >= 0;
    return phaseWants || !!guidePeeked[sectionId];
  }

  // Guide helper: is a section's body expanded?
  function guideSectionVisible(sectionId, manualToggle) {
    if (!guideActive) return manualToggle;
    var ph = _guidePhaseMap[guidePhase];
    var phaseWants = ph && ph.sections && ph.sections.indexOf(sectionId) >= 0;
    return phaseWants || !!guidePeeked[sectionId];
  }

  // Wrapper for section toggle clicks in guide mode
  function guideSectionToggle(sectionId, currentVal, setter) {
    var newVal = !currentVal;
    setter(newVal);
    if (guideActive && newVal) {
      setGuidePeeked(function(prev) { var copy = Object.assign({}, prev); copy[sectionId] = true; return copy; });
    }
    if (guideActive && !newVal) {
      setGuidePeeked(function(prev) { var copy = Object.assign({}, prev); delete copy[sectionId]; return copy; });
    }
  }

  // Guide helper: is this field focused by the current phase?
  function guideFieldFocused(fieldName) {
    if (!guideActive) return false;
    var ph = _guidePhaseMap[guidePhase];
    return ph && ph.focusFields && ph.focusFields.indexOf(fieldName) >= 0;
  }

  // S49: Auto-advance guide on extraction events
  _stUE(function() {
    if (!guideActive || step !== 0) return;
    if (guidePhase === 'extracting' && !extracting && extractResult) {
      var hasShapes = extractResult.lotEdges && extractResult.lotEdges.length >= 4 && extractResult.lotArea;
      if (hasShapes) {
        guideAdvance('shape_select');
      } else {
        guideAdvance('trace_or_manual');
      }
    }
    if (guidePhase === 'extracting' && !extracting && extractError) {
      guideAdvance('trace_or_manual');
    }
    if (guidePhase === 'shape_select' && !extractResult && !compareMode && p.lotVertices) {
      guideAdvance('verify_extracted');
    }
    if (guidePhase === 'trace_or_manual' && !traceMode && p.lotVertices) {
      guideAdvance('verify_extracted');
    }
  }, [guideActive, guidePhase, extracting, extractResult, extractError, compareMode, traceMode, p.lotVertices, step]);

  // S49: Auto-init guide phase when step changes
  _stUE(function() {
    if (!guideActive) return;
    if (step === 1 && guidePhase.indexOf('s1_') !== 0 && guidePhase !== 'complete') {
      // Entering Step 1: set phase and auto-fill deck size from house width
      setGuideHistory([]);
      setGuidePeeked({});
      setGuidePhase('s1_deck_size');
      // Auto-fill deck width to match house width if it looks like user hasn't customized
      if (p.houseWidth && p.houseWidth > 20 && p.width === 20) {
        u('width', Math.min(p.houseWidth, 50));
      }
    }
    if (step === 2 && guidePhase.indexOf('s2_') !== 0 && guidePhase !== 's1_complete') {
      setGuideHistory([]);
      setGuidePeeked({});
      setGuidePhase('s2_environment');
    }
    if (step === 3 && guidePhase.indexOf('s3_') !== 0 && guidePhase !== 's2_complete') {
      setGuideHistory([]);
      setGuidePeeked({});
      setGuidePhase('s3_materials');
    }
    if (step === 4 && guidePhase.indexOf('s4_') !== 0 && guidePhase !== 's3_complete') {
      setGuideHistory([]);
      setGuidePeeked({});
      var hasInfo = info.address && info.city && info.state;
      setGuidePhase(hasInfo ? 's4_generate' : 's4_info');
    }
  }, [step]);


  // S46: Compute candidate lot shapes from extraction result
  var shapeCandidates = _stUM(function() {
    if (!extractResult || !extractResult.lotEdges || !extractResult.lotArea) return [];
    if (extractResult.lotEdges.length < 4) return [];
    if (!window.generateCandidateShapes) return [];
    return window.generateCandidateShapes(extractResult.lotEdges, extractResult.lotArea);
  }, [extractResult]);

  // S47: Register shape data for compare view
  _stUE(function() {
    if (shapeCandidates.length > 0 && extractResult) {
      window._shapeCompareData = { candidates: shapeCandidates, extractResult: extractResult };
      // S52: Auto-enter compare mode when shapes found and survey exists
      if (sitePlanB64 && setCompareMode && !compareMode) {
        setCompareMode(true);
        if (guideActive) guideAdvance('shape_select');
        setTimeout(function() { window.scrollTo({ top: 0, behavior: "smooth" }); }, 50);
      }
      window._selectShape = function(ci) {
        var cand = shapeCandidates[ci];
        if (!cand) return;
        var cv = cand.vertices;
        var cmaxX = 0, cmaxY = 0;
        cv.forEach(function(v) { if (v[0] > cmaxX) cmaxX = v[0]; if (v[1] > cmaxY) cmaxY = v[1]; });
        u("lotWidth", Math.max(30, Math.round(cmaxX)));
        u("lotDepth", Math.max(50, Math.round(cmaxY)));
        u("lotVertices", cv);
        u("lotEdges", cand.edges.map(function(e) {
          var eis = e.type === "street";
          return { type: e.type || "property", label: eis ? (e.label || "") : "", length: e.length || 1, setbackType: e.setbackType || "side", neighborLabel: eis ? "" : (e.neighborLabel || "") };
        }));
        u("lotArea", cand.area);
        var d = extractResult;
        if (d.setbackFront) u("setbackFront", d.setbackFront);
        if (d.setbackRear) u("setbackRear", d.setbackRear);
        if (d.setbackSide) u("setbackSide", d.setbackSide);
        // S48: Apply extracted house dimensions
        var _hw = d.houseWidth || 40;
        var _hd = d.houseDepth || 30;
        if (d.houseWidth) u("houseWidth", _hw);
        if (d.houseDepth) u("houseDepth", _hd);

        // S48: Smart house position - use percentage cross-check
        var lotBBW = Math.max(30, Math.round(cmaxX));
        var lotBBD = Math.max(50, Math.round(cmaxY));
        var finalOffsetSide = d.houseOffsetSide || 20;
        var finalDistFromStreet = d.houseDistFromStreet || 25;

        // If percentage estimates available, compute position from them
        if (d.houseXPercent != null && d.houseXPercent >= 0 && d.houseXPercent <= 100) {
          var pctDerivedX = Math.round(lotBBW * (d.houseXPercent / 100) - _hw / 2);
          pctDerivedX = Math.max(0, pctDerivedX);
          // If absolute and percentage disagree by more than 20%, prefer percentage
          if (finalOffsetSide > 0 && Math.abs(pctDerivedX - finalOffsetSide) / Math.max(finalOffsetSide, pctDerivedX) > 0.2) {
            finalOffsetSide = pctDerivedX;
          }
        }
        if (d.houseYPercent != null && d.houseYPercent >= 0 && d.houseYPercent <= 100) {
          var pctDerivedY = Math.round(lotBBD * (d.houseYPercent / 100) - _hd / 2);
          pctDerivedY = Math.max(0, pctDerivedY);
          if (finalDistFromStreet > 0 && Math.abs(pctDerivedY - finalDistFromStreet) / Math.max(finalDistFromStreet, pctDerivedY) > 0.2) {
            finalDistFromStreet = pctDerivedY;
          }
        }
        u("houseOffsetSide", finalOffsetSide);
        u("houseDistFromStreet", finalDistFromStreet);
        if (d.street) setI("address", d.street);
        if (d.city) setI("city", d.city);
        if (d.state) setI("state", d.state);
        if (d.zip) setI("zip", d.zip);
        if (d.parcelId) setI("lot", d.parcelId);
        if (d.streetName) u("streetName", d.streetName);
        if (d.northAngle != null) u("northAngle", d.northAngle);
        // S48: Auto-apply extracted site objects using relational placement
        if (d.siteObjects && d.siteObjects.length > 0) {
          var validTypes = { fence: true, pool: true, shed: true, driveway: true, garage: true, ac_unit: true, tree: true };
          var existing = p.siteElements || [];
          var _hx = finalOffsetSide;
          var _hy = finalDistFromStreet;
          var _hw2 = d.houseWidth || 40;
          var _hd2 = d.houseDepth || 30;
          var _lotBBW = Math.max(30, Math.round(cmaxX));
          var _lotBBD = Math.max(50, Math.round(cmaxY));

          var newEls = d.siteObjects.filter(function(obj) { return validTypes[obj.type]; }).map(function(obj, oi) {
            var ow = Math.round(obj.w || 10);
            var od = Math.round(obj.d || 1);
            var rel = obj.relativeToHouse || "";
            var flush = obj.flushWithHouse || "flush";
            var near = obj.nearestEdge || "";
            var ox, oy;

            // Compute Y from flush relationship
            if (flush === "flush") { oy = _hy; }
            else if (flush === "set-back") { oy = _hy + Math.round(_hd2 * 0.3); }
            else if (flush === "forward") { oy = Math.max(0, _hy - Math.round(_hd2 * 0.3)); }
            else { oy = _hy; }

            // Compute X from relative position
            if (rel === "left" || rel === "detached-left") {
              ox = rel === "detached-left" ? Math.max(0, _hx - ow - 5) : Math.max(0, _hx - ow);
            } else if (rel === "right" || rel === "detached-right") {
              ox = rel === "detached-right" ? _hx + _hw2 + 5 : _hx + _hw2;
            } else if (rel === "behind" || rel === "detached-behind") {
              ox = _hx;
              oy = rel === "detached-behind" ? _hy + _hd2 + 10 : _hy + _hd2;
            } else if (rel === "front") {
              ox = _hx;
              oy = Math.max(0, _hy - od);
            } else {
              // Fallback: use nearestEdge
              if (near === "left") { ox = 2; }
              else if (near === "right") { ox = _lotBBW - ow - 2; }
              else if (near === "rear") { ox = _hx; oy = _lotBBD - od - 5; }
              else if (near === "street") { ox = _hx; oy = 2; }
              else { ox = _hx; }
            }

            // Special cases by type
            if (obj.type === "driveway") {
              // Driveways connect to street
              oy = 0;
              if (!rel && near !== "left" && near !== "right") ox = _hx;
            } else if (obj.type === "fence" && near) {
              // Fences along property lines
              if (near === "left") { ox = 0; oy = _hy; }
              else if (near === "right") { ox = _lotBBW - 1; oy = _hy; }
              else if (near === "rear") { ox = 0; oy = _lotBBD - 1; }
            }

            return { id: Date.now() + oi, type: obj.type, x: Math.round(ox), y: Math.round(oy), w: ow, d: od, label: obj.label || obj.type.toUpperCase() };
          });
          if (newEls.length > 0) u("siteElements", existing.concat(newEls));
        }
        setExtractResult(null);
        if (setCompareMode) setCompareMode(false);
      };
    } else {
      window._shapeCompareData = null;
      window._selectShape = null;
    }
  }, [shapeCandidates, extractResult]);

// Active zone data
  var activeZoneObj = p.activeZone > 0 ? p.zones.find(function(z) { return z.id === p.activeZone; }) : null;
  var isZone0 = p.activeZone === 0;
  var zoneW = activeZoneObj ? activeZoneObj.w : p.width;
  var zoneD = activeZoneObj ? activeZoneObj.d : p.depth;
  var zoneH = activeZoneObj ? (activeZoneObj.h != null ? activeZoneObj.h : p.height) : p.height;
  var activeLabel = activeZoneObj ? (activeZoneObj.label || "Zone " + activeZoneObj.id) : "Main Deck";
  var isCutout = activeZoneObj && activeZoneObj.type === "cutout";

  if (step === 1) return <>
    {/* S49: Guide panel for Step 1 */}
    {guideActive === true && (() => {
      var s1Msg = null, s1Tip = null;
      if (guidePhase === 's1_deck_size') {
        var autoFilled = p.houseWidth && p.houseWidth > 20 && p.width === p.houseWidth;
        var matched = p.houseWidth && p.width === Math.min(p.houseWidth, 50);
        if (autoFilled || matched) {
          s1Msg = "We set your deck to " + p.width + "' wide to match your house. Adjust if you want it smaller.";
          s1Tip = "A standard depth is 12'. Height is how far off the ground your deck sits.";
        } else {
          s1Msg = "How big should your deck be?";
          s1Tip = "Width runs along the house wall. Depth is how far it extends into the yard.";
        }
      }
      return <GuidePanel
        phase={guidePhase}
        onAction={guideHandleAction}
        onBack={guideBack}
        history={guideHistory}
        onToggleOff={function() { setGuideActive(false); }}
        message={s1Msg}
        tip={s1Tip}
      />;
    })()}
// {/*   Zone selector bar   */}
    {p.zones.length > 0 && <div style={{ marginBottom: 16, padding: 10, background: _br.wr, borderRadius: 8, border: `1px solid ${_br.bd}` }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: _br.mu, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>Zones</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button onClick={() => u("activeZone", 0)} style={{
          padding: "5px 10px", fontSize: 10, fontWeight: 700, borderRadius: 5, fontFamily: _mono, cursor: "pointer",
          border: isZone0 ? `2px solid ${_br.gn}` : `1px solid ${_br.bd}`,
          background: isZone0 ? "#edf5e8" : "#fff",
          color: isZone0 ? _br.gn : _br.mu
        }}>Main Deck</button>
        {p.zones.map(function(z) {
          var isActive = p.activeZone === z.id;
          var isCut = z.type === "cutout";
          var col = isCut ? "#dc2626" : "#2563eb";
          return <button key={z.id} onClick={() => u("activeZone", z.id)} style={{
            padding: "5px 10px", fontSize: 10, fontWeight: 700, borderRadius: 5, fontFamily: _mono, cursor: "pointer",
            border: isActive ? `2px solid ${col}` : `1px solid ${_br.bd}`,
            background: isActive ? (isCut ? "#fef2f2" : "#eff6ff") : "#fff",
            color: isActive ? col : _br.mu
          }}>{isCut ? "\u2702 " : ""}{z.label || "Zone " + z.id}</button>;
        })}
      </div>
    </div>}

    {/* Active zone header (when not zone 0) */}
    {!isZone0 && <div style={{ marginBottom: 12, padding: "8px 12px", background: isCutout ? "#fef2f2" : "#eff6ff", borderRadius: 6, border: `1px solid ${isCutout ? "#fca5a5" : "#bfdbfe"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: isCutout ? "#dc2626" : "#2563eb", fontFamily: _mono }}>{activeLabel}</div>
        <div style={{ fontSize: 9, color: isCutout ? "#ef4444" : "#60a5fa", fontFamily: _mono }}>{isCutout ? "Cutout (subtracts from parent)" : "Add zone (extends deck)"}</div>
      </div>
      <button onClick={() => removeZone(p.activeZone)} style={{
        padding: "5px 12px", fontSize: 9, fontWeight: 700, borderRadius: 5, fontFamily: _mono, cursor: "pointer",
        border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626"
      }}>Delete</button>
    </div>}

// {/* Width / Depth / Height sliders   zone-aware */}
    <Slider label={isZone0 ? "Width (along house)" : "Width"} value={zoneW} min={isCutout ? 2 : 4} max={50} step={0.5} fmt={fmtFtIn} field="width" u={u} p={p} />
    <Slider label={isZone0 ? "Depth (from house)" : "Depth"} value={zoneD} min={isCutout ? 2 : 4} max={24} step={0.5} fmt={fmtFtIn} field="depth" u={u} p={p} />
    {isZone0 && <Slider label="Height above grade" value={p.height} min={1} max={14} step={0.5} fmt={fmtFtIn} field="height" u={u} p={p} />}

    {/* Zone offset slider (zones 1+ add type) */}
    {!isZone0 && activeZoneObj && activeZoneObj.type === "add" && (
      <div style={{ marginBottom: 16 }}>
        <Label>Position along parent edge</Label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="range" min={0} max={30} step={0.5} value={activeZoneObj.attachOffset || 0}
            onChange={e => updateZone(p.activeZone, "attachOffset", Number(e.target.value))}
            style={{ flex: 1, accentColor: "#2563eb", height: 6 }} />
          <span style={{ fontFamily: _mono, fontSize: 14, fontWeight: 800, color: _br.tx }}>{activeZoneObj.attachOffset || 0}'</span>
        </div>
      </div>
    )}

    {/* Cutout interior offset */}
    {!isZone0 && isCutout && activeZoneObj.attachEdge === "interior" && <>
      <div style={{ marginBottom: 16 }}>
        <Label>X Offset</Label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="range" min={0} max={30} step={0.5} value={activeZoneObj.attachOffset || 0}
            onChange={e => updateZone(p.activeZone, "attachOffset", Number(e.target.value))}
            style={{ flex: 1, accentColor: "#dc2626", height: 6 }} />
          <span style={{ fontFamily: _mono, fontSize: 14, fontWeight: 800, color: _br.tx }}>{activeZoneObj.attachOffset || 0}'</span>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Label>Y Offset</Label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="range" min={0} max={30} step={0.5} value={activeZoneObj.interiorY || 0}
            onChange={e => updateZone(p.activeZone, "interiorY", Number(e.target.value))}
            style={{ flex: 1, accentColor: "#dc2626", height: 6 }} />
          <span style={{ fontFamily: _mono, fontSize: 14, fontWeight: 800, color: _br.tx }}>{activeZoneObj.interiorY || 0}'</span>
        </div>
      </div>
    </>}

// {/*   Chamfer controls for active zone   */}
    {!isCutout && <div style={{ marginBottom: 16, padding: 12, background: _br.wr, borderRadius: 8, border: `1px solid ${_br.bd}` }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#7c3aed", fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Corner Modifiers</div>
      <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, marginBottom: 8 }}>Toggle 45{"\u00B0"} chamfers on corners. Adjust size below.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {[["BL", "Back Left"], ["BR", "Back Right"], ["FL", "Front Left"], ["FR", "Front Right"]].map(function([corner, label]) {
          var cur = getCorners(p.activeZone)[corner];
          var hasCh = cur && cur.type === "chamfer" && cur.size > 0;
          return <div key={corner}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: hasCh ? 4 : 0 }}>
              <button onClick={function() { setCorner(p.activeZone, corner, hasCh ? "square" : "chamfer", hasCh ? 0 : 3); }} style={{
                width: 22, height: 22, borderRadius: 4, border: `1.5px solid ${hasCh ? "#7c3aed" : "#ddd"}`,
                background: hasCh ? "#f3e8ff" : "#fff", cursor: "pointer", fontSize: 10,
                display: "flex", alignItems: "center", justifyContent: "center", color: "#7c3aed", fontWeight: 700
              }}>{hasCh ? "\u2713" : ""}</button>
              <span style={{ fontSize: 10, color: hasCh ? _br.tx : _br.mu, fontFamily: _mono, fontWeight: hasCh ? 600 : 400 }}>{label}</span>
              {hasCh && <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", fontFamily: _mono, marginLeft: "auto" }}>{cur.size}'</span>}
            </div>
            {hasCh && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <input type="range" min={1} max={Math.min(zoneW, zoneD) / 2} step={0.5} value={cur.size}
                onChange={e => setCorner(p.activeZone, corner, "chamfer", Number(e.target.value))}
                style={{ flex: 1, accentColor: "#7c3aed", height: 4 }} />
            </div>}
          </div>;
        })}
      </div>
    </div>}

// {/*   Zone 0 only: house width, attachment, stairs   */}
    {isZone0 && <>
      <Slider label="House width" value={p.houseWidth} min={20} max={80} field="houseWidth" u={u} p={p} />
      <Chips label="Attachment" field="attachment" opts={[["ledger", "Ledger Board"], ["freestanding", "Freestanding"]]} u={u} p={p} />
      <Chips label="Stairs" field="hasStairs" opts={[[true, "Yes"], [false, "No"]]} u={u} p={p} />
      {p.hasStairs && <>
        <Chips label="Stair location" field="stairLocation" opts={[["front", "Front"], ["left", "Left"], ["right", "Right"]]} u={u} p={p} />
        <Slider label="Stair width" value={p.stairWidth} min={3} max={p.width} step={0.5} fmt={fmtFtIn} field="stairWidth" u={u} p={p} />
        <Slider label="Number of stringers" value={p.numStringers} min={2} max={5} field="numStringers" unit="" u={u} p={p} />
        <Chips label="Landing pad" field="hasLanding" opts={[[true, "Yes"], [false, "No"]]} u={u} p={p} />
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
                border: p.stairTemplate === key ? "2px solid " + _br.gn : "1px solid " + _br.bd,
                background: p.stairTemplate === key ? "#edf5e8" : "#fff",
                fontFamily: _mono, transition: "all 0.15s",
              }}>
                <div style={{ marginBottom: 2 }}>{stairIcon(key)}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: p.stairTemplate === key ? _br.gn : _br.tx }}>{name}</div>
              </button>
            ))}
          </div>
        </div>
      </>}

      </>}

      <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ width: "100%", padding: "8px 14px", marginBottom: 12, background: "none", border: `1px solid ${_br.bd}`, borderRadius: 6, cursor: "pointer", fontSize: 10, fontFamily: _mono, color: _br.mu, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Positioning (drag in preview or set here)</span>
        <span style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "0.2s" }}>{"\u25BE"}</span>
      </button>
      {showAdvanced && <div style={{ padding: 14, background: _br.wr, borderRadius: 8, border: `1px solid ${_br.bd}`, marginBottom: 12 }}>
        <Slider label="Deck offset from center" value={p.deckOffset} min={-Math.floor(p.houseWidth / 2)} max={Math.floor(p.houseWidth / 2)} field="deckOffset" u={u} p={p} />
        {p.hasStairs && p.stairAnchorX == null && <Slider label="Stair offset from center" value={p.stairOffset} min={-Math.floor((p.stairLocation === "front" ? (p.width - (p.stairWidth || 4)) : (p.depth - (p.stairWidth || 4))) / 2)} max={Math.floor((p.stairLocation === "front" ? (p.width - (p.stairWidth || 4)) : (p.depth - (p.stairWidth || 4))) / 2)} field="stairOffset" u={u} p={p} />}
        {p.hasStairs && p.stairAnchorX != null && <>
          <Slider label="Stair anchor X (from left)" value={p.stairAnchorX} min={0} max={p.width} step={0.5} field="stairAnchorX" fmt={fmtFtIn} u={u} p={p} />
          <Slider label="Stair anchor Y (from house)" value={p.stairAnchorY} min={0} max={p.depth} step={0.5} field="stairAnchorY" fmt={fmtFtIn} u={u} p={p} />
          <Slider label="Stair angle" value={p.stairAngle} min={0} max={270} step={90} field="stairAngle" unit={"\u00B0"} u={u} p={p} />
          <button onClick={() => { u("stairAnchorX", null); u("stairAnchorY", null); u("stairAngle", null); }} style={{ padding: "5px 12px", fontSize: 9, fontFamily: _mono, color: "#c62828", background: "none", border: "1px solid #c62828", borderRadius: 4, cursor: "pointer", marginBottom: 8 }}>Reset to edge mode</button>
        </>}
      {["lLeft","lRight","switchback","wrapAround","wideLanding"].includes(p.stairTemplate) && p.hasStairs && (<>
        <Slider label="Run Split (1st run %)" value={p.stairRunSplit!=null?p.stairRunSplit:55} min={30} max={70} step={5} field="stairRunSplit" unit="%" u={u} p={p} />
        <Slider label="Landing Depth" value={p.stairLandingDepth!=null?p.stairLandingDepth:Math.max(p.stairWidth||4,4)} min={3} max={8} step={0.5} field="stairLandingDepth" fmt={fmtFtIn} u={u} p={p} />
      </>)}
      {["switchback","wrapAround"].includes(p.stairTemplate) && p.hasStairs && (
        <Slider label="Gap Between Runs" value={p.stairGap!=null?p.stairGap:0.5} min={0} max={2} step={0.5} field="stairGap" fmt={fmtFtIn} u={u} p={p} />
      )}
      </div>}

    </>}
  </>;

// Step 0: Site Plan (S28   unified flow, no mode cards)
  if (step === 0) {
    // === SETBACK WARNINGS (computed from current params) ===
    var spWarnings = [];
    var deckCenterX = p.houseOffsetSide + p.houseWidth / 2 + (p.deckOffset || 0);
    var deckLeftX = deckCenterX - p.width / 2;
    var deckRightX = deckCenterX + p.width / 2;
    var houseY = p.houseDistFromStreet || p.setbackFront;
    var deckRearY = houseY + p.houseDepth + p.depth;
    // S38: Polygon-aware deck setback warnings
    if (window.computeSetbackGaps) {
      var _sbGaps = window.computeSetbackGaps(p);
      for (var _gi = 0; _gi < _sbGaps.length; _gi++) {
        var _g = _sbGaps[_gi];
        if (_g.gap < 0) spWarnings.push("Deck extends past " + _g.setbackType + " property line by " + Math.abs(_g.gap).toFixed(1) + "'");
        else if (_g.warn) spWarnings.push("Deck is " + _g.gap + "' from " + _g.setbackType + " property line (setback requires " + _g.required + "')");
      }
    } else {
      var rearGap = p.lotDepth - deckRearY;
      var leftGap = deckLeftX;
      var rightGap = p.lotWidth - deckRightX;
      if (rearGap < 0) spWarnings.push("Deck extends past the rear property line by " + Math.abs(rearGap).toFixed(1) + "'");
      else if (rearGap < p.setbackRear) spWarnings.push("Deck is " + rearGap.toFixed(1) + "' from rear property line (setback requires " + p.setbackRear + "')");
      if (leftGap < 0) spWarnings.push("Deck extends past the left property line");
      else if (leftGap < p.setbackSide) spWarnings.push("Deck is " + leftGap.toFixed(1) + "' from left property line (setback requires " + p.setbackSide + "')");
      if (rightGap < 0) spWarnings.push("Deck extends past the right property line");
      else if (rightGap < p.setbackSide) spWarnings.push("Deck is " + rightGap.toFixed(1) + "' from right property line (setback requires " + p.setbackSide + "')");
    }
    if (p.hasStairs && p.height > 0) {
      var _riseIn = 7.5, _treadIn = 10;
      var _nR = Math.ceil((p.height || 4) * 12 / _riseIn);
      var _stairRun = (_nR - 1) * _treadIn / 12;
      var _landD = p.hasLanding ? 4 : 0;
      var _stW = p.stairWidth || 4;
      var _stOff = p.stairOffset || 0;
      var _loc = p.stairLocation || "front";
      if (_loc === "front") {
        var stEndY = deckRearY + _stairRun + _landD;
        var stRearGap = p.lotDepth - stEndY;
        if (stRearGap < 0) spWarnings.push("Stairs extend past the rear property line by " + Math.abs(stRearGap).toFixed(1) + "'");
        else if (stRearGap < p.setbackRear) spWarnings.push("Stairs are " + stRearGap.toFixed(1) + "' from rear property line (setback requires " + p.setbackRear + "')");
      } else if (_loc === "left") {
        var stLeftEnd = deckLeftX - _stairRun - _landD;
        if (stLeftEnd < 0) spWarnings.push("Stairs extend past the left property line by " + Math.abs(stLeftEnd).toFixed(1) + "'");
        else if (stLeftEnd < p.setbackSide) spWarnings.push("Stairs are " + stLeftEnd.toFixed(1) + "' from left property line (setback requires " + p.setbackSide + "')");
      } else if (_loc === "right") {
        var stRightEnd = deckRightX + _stairRun + _landD;
        var stRightGap = p.lotWidth - stRightEnd;
        if (stRightGap < 0) spWarnings.push("Stairs extend past the right property line by " + Math.abs(stRightGap).toFixed(1) + "'");
        else if (stRightGap < p.setbackSide) spWarnings.push("Stairs are " + stRightGap.toFixed(1) + "' from right property line (setback requires " + p.setbackSide + "')");
      }
    }
    var lotArea = c.lotArea || (p.lotWidth * p.lotDepth);
    var houseArea = p.houseWidth * p.houseDepth;
    var deckArea = c.area || (p.width * p.depth);
    var imperviousTypes = { driveway: true, garage: true, shed: true, patio: true };
    var elArea = (p.siteElements || []).reduce(function(s, el) { return s + (imperviousTypes[el.type] ? el.w * el.d : 0); }, 0);
    var coveragePct = lotArea > 0 ? ((houseArea + deckArea + elArea) / lotArea * 100).toFixed(1) : 0;

    // === TRACE MODE CONTROLS (S43) ===
    if (traceMode) {
      var ts = traceState || {};
      var tsVerts = ts.vertices || [];
      var tsMeta = ts.edgeMeta || [];
      var tsLengths = ts.edgeLengths || [];
      var tsPpf = ts.ppf || null;
      var tsCalPts = ts.calPoints || [];
      var tsSelEdge = ts.selectedEdge;
      var tsSelVert = ts.selectedVertex;

      function tsUpdate(changes) {
        setTraceState(function(prev) { return Object.assign({}, prev, changes); });
      }

      function calibrate() {
        var dist = parseFloat(ts.calDist);
        var edgeIdx = ts.selectedEdge;
        if (!dist || dist <= 0 || edgeIdx == null || tsVerts.length < 2) return;
        var v1 = tsVerts[edgeIdx];
        var v2 = tsVerts[(edgeIdx + 1) % tsVerts.length];
        var tdx = v2.px - v1.px;
        var tdy = v2.py - v1.py;
        var pxDist = Math.sqrt(tdx * tdx + tdy * tdy);
        tsUpdate({ ppf: pxDist / dist, calEdge: edgeIdx, selectedEdge: null });
      }

      function recalibrate() {
        tsUpdate({ calDist: "", ppf: null, calEdge: null, selectedEdge: null });
      }

      function removeVertex(idx) {
        var newVerts = tsVerts.filter(function(_, i) { return i !== idx; });
        var newMeta = tsMeta.filter(function(_, i) { return i !== idx; });
        var newSelVert = tsSelVert;
        var newSelEdge = tsSelEdge;
        if (newSelVert === idx) newSelVert = null;
        else if (newSelVert != null && newSelVert > idx) newSelVert--;
        if (newSelEdge != null && newSelEdge >= newVerts.length) newSelEdge = null;
        tsUpdate({ vertices: newVerts, edgeMeta: newMeta, selectedVertex: newSelVert, selectedEdge: newSelEdge });
      }

      function updateEdgeMeta(idx, field, val) {
        var newMeta = tsMeta.slice();
        while (newMeta.length <= idx) {
          newMeta.push({ type: "property", label: "", neighborLabel: "", setbackType: "side", geometry: "line" });
        }
        newMeta[idx] = Object.assign({}, newMeta[idx], { [field]: val });
        if (field === "type") {
          if (val === "street") {
            newMeta[idx].setbackType = "front";
            newMeta[idx].neighborLabel = "";
          } else {
            if (newMeta[idx].setbackType === "front") newMeta[idx].setbackType = "side";
            newMeta[idx].label = "";
          }
        }
        tsUpdate({ edgeMeta: newMeta });
      }

      function applyTrace() {
        if (!tsPpf || tsVerts.length < 3) return;
        var tn = tsVerts.length;
        var tMinPx = Infinity, tMaxPx = -Infinity, tMinPy = Infinity, tMaxPy = -Infinity;
        tsVerts.forEach(function(v) {
          if (v.px < tMinPx) tMinPx = v.px;
          if (v.px > tMaxPx) tMaxPx = v.px;
          if (v.py < tMinPy) tMinPy = v.py;
          if (v.py > tMaxPy) tMaxPy = v.py;
        });
        var lotVerts = tsVerts.map(function(v) {
          return [
            +((v.px - tMinPx) / tsPpf).toFixed(2),
            +((tMaxPy - v.py) / tsPpf).toFixed(2)
          ];
        });
        var lotEdgesOut = [];
        for (var ti = 0; ti < tn; ti++) {
          var tlv1 = lotVerts[ti], tlv2 = lotVerts[(ti + 1) % tn];
          var tedx = tlv2[0] - tlv1[0], tedy = tlv2[1] - tlv1[1];
          var tlen = +Math.sqrt(tedx * tedx + tedy * tedy).toFixed(2);
          var tem = tsMeta[ti] || {};
          var tisStr = tem.type === "street";
          lotEdgesOut.push({
            type: tem.type || "property",
            label: tisStr ? (tem.label || "") : "",
            neighborLabel: tisStr ? "" : (tem.neighborLabel || ""),
            setbackType: tem.setbackType || "side",
            length: tlen
          });
        }
        // S43: Auto-replace traced edge lengths with AI-extracted values when close
        var aiEdgeLengthsUsed = false;
        if (extractResult && extractResult.lotEdges && extractResult.lotEdges.length === tn) {
          var aiLens = extractResult.lotEdges.map(function(e) { return e.length || 0; });
          var tracedLens = lotEdgesOut.map(function(e) { return e.length; });
          // Sort both to match by size (edges may be in different order)
          var aiSorted = aiLens.slice().sort(function(a, b) { return a - b; });
          var tracedSorted = tracedLens.slice().sort(function(a, b) { return a - b; });
          var maxPctOff = 0;
          for (var ai = 0; ai < aiSorted.length; ai++) {
            var pct = aiSorted[ai] > 0 ? Math.abs(tracedSorted[ai] - aiSorted[ai]) / aiSorted[ai] * 100 : 0;
            if (pct > maxPctOff) maxPctOff = pct;
          }
          if (maxPctOff <= 25) {
            // Match each traced edge to its closest AI edge by length
            var aiUsed = new Array(aiLens.length);
            for (var ei = 0; ei < tn; ei++) {
              var bestMatch = -1, bestDiff = Infinity;
              for (var aj = 0; aj < aiLens.length; aj++) {
                if (aiUsed[aj]) continue;
                var diff = Math.abs(lotEdgesOut[ei].length - aiLens[aj]);
                if (diff < bestDiff) { bestDiff = diff; bestMatch = aj; }
              }
              if (bestMatch >= 0) {
                lotEdgesOut[ei].length = aiLens[bestMatch];
                aiUsed[bestMatch] = true;
              }
            }
            aiEdgeLengthsUsed = true;
          }
        }

        var tArea = 0;
        for (var ti = 0; ti < tn; ti++) {
          var tav1 = lotVerts[ti], tav2 = lotVerts[(ti + 1) % tn];
          tArea += tav1[0] * tav2[1] - tav2[0] * tav1[1];
        }
        tArea = +Math.abs(tArea / 2).toFixed(0);
        var bboxW = +((tMaxPx - tMinPx) / tsPpf).toFixed(1);
        var bboxD = +((tMaxPy - tMinPy) / tsPpf).toFixed(1);
        u("lotWidth", Math.max(Math.round(bboxW), 30));
        u("lotDepth", Math.max(Math.round(bboxD), 50));
        u("lotVertices", lotVerts);
        u("lotEdges", lotEdgesOut);
        u("lotArea", tArea);
        u("traceData", {
          calibration: { calEdge: ts.calEdge || ts.selectedEdge, distanceFt: parseFloat(ts.calDist), pixelsPerFoot: tsPpf },
          vertices: tsVerts,
          edges: tsMeta,
          pdfPage: ts.pdfPage || 1
        });
        // S43: Merge extraction results if available
        if (extractResult) {
          var d = extractResult;
          if (d.setbackFront) u("setbackFront", d.setbackFront);
          if (d.setbackRear) u("setbackRear", d.setbackRear);
          if (d.setbackSide) u("setbackSide", d.setbackSide);
          if (d.street) setI("address", d.street);
          if (d.city) setI("city", d.city);
          if (d.state) setI("state", d.state);
          if (d.zip) setI("zip", d.zip);
          if (d.parcelId) setI("lot", d.parcelId);
          if (d.streetName) u("streetName", d.streetName);
          if (d.northAngle != null) u("northAngle", d.northAngle);
          setExtractResult(null);
        }
        setTraceMode(false);
      }

      var tracePreviewArea = null;
      if (tsPpf && tsVerts.length >= 3) {
        var tpMinPx = Infinity, tpMaxPy = -Infinity, tpMinPy = Infinity;
        tsVerts.forEach(function(v) {
          if (v.px < tpMinPx) tpMinPx = v.px;
          if (v.py > tpMaxPy) tpMaxPy = v.py;
          if (v.py < tpMinPy) tpMinPy = v.py;
        });
        var tmpV = tsVerts.map(function(v) {
          return [(v.px - tpMinPx) / tsPpf, (tpMaxPy - v.py) / tsPpf];
        });
        var ta2 = 0;
        for (var ti = 0; ti < tmpV.length; ti++) {
          var ttv1 = tmpV[ti], ttv2 = tmpV[(ti + 1) % tmpV.length];
          ta2 += ttv1[0] * ttv2[1] - ttv2[0] * ttv1[1];
        }
        tracePreviewArea = +Math.abs(ta2 / 2).toFixed(0);
      }

      var trSbColors = { front: "#2563eb", side: "#8B7355", rear: "#dc2626", none: "#999" };

      return <>
        <div style={{ padding: 14, background: "#e8f5e9", borderRadius: 8, border: "1px solid #c8e6c9", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#2e7d32", fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase" }}>{"\uD83D\uDCCD"} Tracing Lot Boundary</span>
            <button onClick={function() { setTraceMode(false); if (sitePlanB64 && shapeCandidates.length > 0 && extractResult && setCompareMode) setCompareMode(true); }} style={{ padding: "4px 12px", fontSize: 9, fontFamily: _mono, cursor: "pointer", border: "1px solid #fca5a5", borderRadius: 4, background: "#fef2f2", color: "#dc2626" }}>Cancel</button>
          </div>

          {/* S43: Extraction status */}
          {extracting && <div style={{ padding: "6px 10px", marginBottom: 8, background: "#eff6ff", borderRadius: 4, border: "1px solid #93c5fd", fontSize: 9, fontFamily: _mono, color: "#1d4ed8" }}>
            {"\u23F3"} Extracting property info (address, setbacks, lot area)...
          </div>}
          {extractResult && <div style={{ padding: "6px 10px", marginBottom: 8, background: "#f0fdf4", borderRadius: 4, border: "1px solid #bbf7d0", fontSize: 9, fontFamily: _mono, color: "#2e7d32" }}>
            {"\u2705"} Property info extracted. Will be applied with traced shape.
          </div>}
          {extractError && <div style={{ padding: "6px 10px", marginBottom: 8, background: "#fff8e1", borderRadius: 4, border: "1px solid #ffe082", fontSize: 9, fontFamily: _mono, color: "#d97706" }}>
            {"\u26A0\uFE0F"} Could not extract property info: {extractError}. You can still trace the lot shape.
          </div>}

          
          {/* Lot Corners */}
          <div style={{ marginBottom: 12, padding: "10px 12px", background: "#fff", borderRadius: 6, border: "1px solid " + _br.bd }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#2e7d32", fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase" }}>
                {"\uD83D\uDCCD"} Lot Corners ({tsVerts.length})
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {tsVerts.length > 0 && <button onClick={function() { tsUpdate({ vertices: [], edgeMeta: [], edgeLengths: [], selectedVertex: null, selectedEdge: null, ppf: null, calDist: "", calEdge: null }); }} style={{ padding: "2px 8px", fontSize: 8, fontFamily: _mono, cursor: "pointer", border: "1px solid #fca5a5", borderRadius: 3, background: "#fef2f2", color: "#dc2626" }}>Reset All</button>}
              </div>
            </div>
            {tsVerts.length === 0 && <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, lineHeight: 1.6 }}>
              Click the corners of your property boundary on the survey image. Start at any corner and work your way around.
            </div>}
            {tsVerts.length > 0 && tsVerts.length < 3 && <div style={{ fontSize: 9, color: "#e65100", fontFamily: _mono, lineHeight: 1.6, marginBottom: 6 }}>
              Keep clicking corners. Need at least 3 to form a lot shape.
            </div>}
            {tsVerts.length > 0 && <div style={{ maxHeight: 150, overflowY: "auto" }}>
              {tsVerts.map(function(v, vi) {
                var trIsSel = ts.selectedVertex === vi;
                var trEdgeLen = tsLengths[vi];
                return <div key={vi} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px", marginBottom: 2, background: trIsSel ? "#e8f5e9" : "transparent", borderRadius: 4, border: trIsSel ? "1px solid #c8e6c9" : "1px solid transparent" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: trIsSel ? "#2e7d32" : _br.mu, fontFamily: _mono, minWidth: 16 }}>{vi + 1}</span>
                  <span style={{ fontSize: 9, fontFamily: _mono, color: _br.mu, flex: 1 }}>({v.px}, {v.py})</span>
                  {trEdgeLen && <span style={{ fontSize: 9, fontFamily: _mono, color: _br.tx, fontWeight: 600 }}>{trEdgeLen.toFixed(1)}'</span>}
                  <button onClick={function() { removeVertex(vi); }} style={{ padding: "1px 5px", fontSize: 9, cursor: "pointer", border: "1px solid #fca5a5", borderRadius: 3, background: "#fef2f2", color: "#dc2626", lineHeight: 1 }}>{"\u00D7"}</button>
                </div>;
              })}
            </div>}
            {tracePreviewArea && <div style={{ fontSize: 9, fontFamily: _mono, color: _br.mu, marginTop: 6, padding: "4px 8px", background: "#f0fdf4", borderRadius: 4 }}>
              Lot area: <span style={{ fontWeight: 700, color: _br.tx }}>{tracePreviewArea.toLocaleString()} SF</span>
            </div>}
          </div>

          {/* Set Scale (when 3+ vertices and not calibrated) */}
          {tsVerts.length >= 3 && !tsPpf && <div style={{ marginBottom: 12, padding: "10px 12px", background: "#fff", borderRadius: 6, border: "2px solid #ff9800" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#e65100", fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>
              {"\uD83D\uDCCF"} Set Scale
            </div>
            <div style={{ fontSize: 9, color: "#e65100", fontFamily: _mono, lineHeight: 1.6, marginBottom: 8 }}>
              Select an edge that has a labeled dimension on the survey, then enter the distance.
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
              {tsVerts.map(function(v, vi) {
                var nextVi = (vi + 1) % tsVerts.length;
                var isSelected = tsSelEdge === vi;
                return <button key={"edge" + vi} onClick={function() { tsUpdate({ selectedEdge: isSelected ? null : vi, selectedVertex: null }); }} style={{
                  padding: "4px 10px", fontSize: 9, fontFamily: _mono, cursor: "pointer",
                  border: isSelected ? "2px solid #e65100" : "1px solid " + _br.bd,
                  background: isSelected ? "#fff3e0" : "#fff",
                  color: isSelected ? "#e65100" : _br.mu,
                  borderRadius: 4, fontWeight: isSelected ? 700 : 400
                }}>Edge {vi + 1}</button>;
              })}
            </div>
            {tsSelEdge != null && <div>
              <div style={{ fontSize: 9, color: "#e65100", fontFamily: _mono, marginBottom: 6 }}>
                {"\u2705"} Edge {tsSelEdge + 1} selected (V{tsSelEdge + 1} {"\u2192"} V{(tsSelEdge + 1) % tsVerts.length + 1}). Enter the labeled distance:
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="number" value={ts.calDist || ""} step="0.01" min="0.1"
                  onChange={function(e) { tsUpdate({ calDist: e.target.value }); }}
                  onKeyDown={function(e) { if (e.key === "Enter") calibrate(); }}
                  placeholder="e.g. 184.83"
                  autoFocus
                  style={{ flex: 1, padding: "7px 10px", border: "2px solid #ff9800", borderRadius: 5, fontSize: 14, fontFamily: _mono, fontWeight: 800, color: _br.tx, textAlign: "center", outline: "none", background: "#fff" }}
                />
                <span style={{ fontSize: 12, fontFamily: _mono, color: _br.mu, fontWeight: 700 }}>ft</span>
                <button onClick={calibrate} disabled={!ts.calDist || parseFloat(ts.calDist) <= 0} style={{ padding: "7px 16px", background: (ts.calDist && parseFloat(ts.calDist) > 0) ? "#e65100" : "#ccc", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, fontFamily: _mono, cursor: (ts.calDist && parseFloat(ts.calDist) > 0) ? "pointer" : "default" }}>Set Scale</button>
              </div>
            </div>}
          </div>}

                    {tsPpf && <div style={{ marginBottom: 12, padding: "10px 12px", background: "#fff", borderRadius: 6, border: "1px solid #c8e6c9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 10, fontFamily: _mono, color: "#2e7d32", fontWeight: 700 }}>{"\u2705"} {tsPpf.toFixed(2)} px/ft</span>
                <span style={{ fontSize: 9, fontFamily: _mono, color: _br.mu, marginLeft: 6 }}>({ts.calDist}' reference)</span>
              </div>
              <button onClick={recalibrate} style={{ padding: "3px 10px", fontSize: 8, fontFamily: _mono, cursor: "pointer", border: "1px solid " + _br.bd, borderRadius: 4, background: "#fff", color: _br.mu }}>Re-calibrate</button>
            </div>
          </div>}

                    
          {/* Edge verification: compare traced vs AI-extracted lengths */}
          {tsPpf && extractResult && extractResult.lotEdges && extractResult.lotEdges.length >= 3 && tsVerts.length >= 3 && (() => {
            var aiEdges = extractResult.lotEdges.map(function(e) { return e.length || 0; }).sort(function(a, b) { return a - b; });
            var tracedEdges = tsLengths.slice().sort(function(a, b) { return a - b; });
            var matchCount = Math.min(aiEdges.length, tracedEdges.length);
            var matches = [];
            var maxPctOff = 0;
            for (var mi = 0; mi < matchCount; mi++) {
              var aiLen = aiEdges[mi];
              var trLen = tracedEdges[mi];
              var pctOff = aiLen > 0 ? Math.abs(trLen - aiLen) / aiLen * 100 : 0;
              if (pctOff > maxPctOff) maxPctOff = pctOff;
              matches.push({ ai: aiLen, traced: trLen, pct: pctOff });
            }
            var allGood = maxPctOff < 15;
            var hasWarning = maxPctOff >= 15 && maxPctOff < 25;
            var hasError = maxPctOff >= 25;
            var borderCol = allGood ? "#c8e6c9" : hasError ? "#fca5a5" : "#ffe082";
            var bgCol = allGood ? "#f0fdf4" : hasError ? "#fef2f2" : "#fff8e1";
            // Also compare areas if available
            var aiArea = extractResult.lotArea;
            var areaPct = (aiArea && tracePreviewArea) ? Math.abs(tracePreviewArea - aiArea) / aiArea * 100 : null;
            return <div style={{ marginBottom: 12, padding: "10px 12px", background: bgCol, borderRadius: 6, border: "1px solid " + borderCol }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: allGood ? "#2e7d32" : hasError ? "#dc2626" : "#d97706", fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>
                {allGood ? "\u2705" : hasWarning ? "\u26A0\uFE0F" : "\u274C"} Edge Verification
              </div>
              <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginBottom: 6 }}>Traced vs AI-extracted edge lengths (sorted by size):</div>
              {matches.map(function(m, mi) {
                var col = m.pct < 15 ? "#2e7d32" : m.pct < 25 ? "#d97706" : "#dc2626";
                var icon = m.pct < 15 ? "\u2705" : m.pct < 25 ? "\u26A0\uFE0F" : "\u274C";
                return <div key={mi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: mi < matches.length - 1 ? "1px solid " + borderCol : "none" }}>
                  <span style={{ fontSize: 9, fontFamily: _mono, color: _br.mu }}>{icon}</span>
                  <span style={{ fontSize: 9, fontFamily: _mono, color: _br.tx, fontWeight: 600 }}>{m.traced.toFixed(1)}'</span>
                  <span style={{ fontSize: 8, fontFamily: _mono, color: _br.mu }}>vs</span>
                  <span style={{ fontSize: 9, fontFamily: _mono, color: "#1d4ed8", fontWeight: 600 }}>{m.ai.toFixed(1)}' AI</span>
                  <span style={{ fontSize: 8, fontFamily: _mono, color: col, fontWeight: 700 }}>{m.pct < 1 ? "<1" : m.pct.toFixed(0)}%</span>
                </div>;
              })}
              {areaPct != null && <div style={{ marginTop: 6, padding: "4px 8px", background: "rgba(255,255,255,0.6)", borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 8, fontFamily: _mono, color: _br.mu }}>Area:</span>
                <span style={{ fontSize: 9, fontFamily: _mono, color: _br.tx, fontWeight: 600 }}>{tracePreviewArea.toLocaleString()} SF traced</span>
                <span style={{ fontSize: 8, fontFamily: _mono, color: _br.mu }}>vs</span>
                <span style={{ fontSize: 9, fontFamily: _mono, color: "#1d4ed8", fontWeight: 600 }}>{aiArea.toLocaleString()} SF AI</span>
                <span style={{ fontSize: 8, fontFamily: _mono, color: areaPct < 15 ? "#2e7d32" : areaPct < 25 ? "#d97706" : "#dc2626", fontWeight: 700 }}>{areaPct.toFixed(0)}%</span>
              </div>}
              {allGood && <div style={{ fontSize: 8, color: "#2e7d32", fontFamily: _mono, marginTop: 4 }}>All edges match within 5%. Calibration looks accurate.</div>}
              {allGood && <div style={{ fontSize: 8, color: "#1d4ed8", fontFamily: _mono, marginTop: 2 }}>Using exact dimensions from survey document.</div>}
              {hasWarning && <div style={{ fontSize: 8, color: "#d97706", fontFamily: _mono, marginTop: 4 }}>Some edges differ by 15-25%. Using survey dimensions, but consider adjusting vertex positions for a better shape.</div>}
              {hasError && <div style={{ fontSize: 8, color: "#dc2626", fontFamily: _mono, marginTop: 4 }}>Significant difference (>25%). Survey dimensions NOT used. Re-trace vertices or re-calibrate with a different edge.</div>}
            </div>;
          })()}

          {tsSelEdge != null && tsPpf && tsVerts.length >= 3 && (() => {
            var trMeta = tsMeta[tsSelEdge] || {};
            return <div style={{ marginBottom: 12, padding: "10px 12px", background: "#fff", borderRadius: 6, border: "2px solid #2563eb" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#2563eb", fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>
                Edge {tsSelEdge + 1} {tsLengths[tsSelEdge] ? "(" + tsLengths[tsSelEdge].toFixed(1) + "')" : ""}
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 8, fontWeight: 600, color: _br.mu, fontFamily: _mono, marginBottom: 4 }}>TYPE</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {["street", "property"].map(function(t) {
                    var trIsAct = (trMeta.type || "property") === t;
                    return <button key={t} onClick={function() { updateEdgeMeta(tsSelEdge, "type", t); }} style={{
                      padding: "4px 12px", fontSize: 9, fontFamily: _mono, cursor: "pointer",
                      border: trIsAct ? "2px solid " + _br.gn : "1px solid " + _br.bd,
                      background: trIsAct ? "#edf5e8" : "#fff",
                      color: trIsAct ? _br.gn : _br.mu,
                      borderRadius: 4, fontWeight: trIsAct ? 700 : 400, textTransform: "capitalize"
                    }}>{t}</button>;
                  })}
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 8, fontWeight: 600, color: _br.mu, fontFamily: _mono, marginBottom: 4 }}>
                  {trMeta.type === "street" ? "STREET NAME" : "NEIGHBOR LABEL"}
                </div>
                <input
                  value={trMeta.type === "street" ? (trMeta.label || "") : (trMeta.neighborLabel || "")}
                  onChange={function(e) {
                    var trField = trMeta.type === "street" ? "label" : "neighborLabel";
                    updateEdgeMeta(tsSelEdge, trField, e.target.value);
                  }}
                  placeholder={trMeta.type === "street" ? "e.g. Sweetgrass Lane" : "e.g. LOT 45"}
                  style={{ width: "100%", padding: "5px 8px", border: "1px solid " + _br.bd, borderRadius: 4, fontSize: 10, fontFamily: _mono, color: _br.tx, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 8, fontWeight: 600, color: _br.mu, fontFamily: _mono, marginBottom: 4 }}>SETBACK TYPE</div>
                <div style={{ display: "flex", gap: 3 }}>
                  {["front", "side", "rear", "none"].map(function(sb) {
                    var trSbAct = (trMeta.setbackType || "side") === sb;
                    var trCol = trSbColors[sb];
                    return <button key={sb} onClick={function() { updateEdgeMeta(tsSelEdge, "setbackType", sb); }} style={{
                      padding: "3px 8px", fontSize: 8, fontFamily: _mono, cursor: "pointer",
                      border: trSbAct ? "1.5px solid " + trCol : "1px solid " + _br.bd,
                      background: trSbAct ? trCol + "18" : "#fff",
                      color: trSbAct ? trCol : _br.mu,
                      borderRadius: 3, fontWeight: trSbAct ? 700 : 400, textTransform: "capitalize"
                    }}>{sb}</button>;
                  })}
                </div>
              </div>
            </div>;
          })()}

          {/* Apply button */}
          {tsVerts.length >= 3 && tsPpf && <button onClick={applyTrace} style={{
            width: "100%", padding: "12px",
            background: "#2e7d32", color: "#fff", border: "none", borderRadius: 6,
            fontSize: 12, fontWeight: 700, fontFamily: _mono, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 2px 12px rgba(46,125,50,0.3)"
          }}>{"\u2713"} Apply Traced Shape ({tsVerts.length} vertices{tracePreviewArea ? ", " + tracePreviewArea.toLocaleString() + " SF" : ""})</button>}

          {tsVerts.length >= 3 && tsPpf && <div style={{ fontSize: 8, color: "#66bb6a", fontFamily: _mono, marginTop: 6, textAlign: "center" }}>
            Sets lot shape from traced vertices. Re-enter trace mode to adjust later.
          </div>}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={function() { setTraceMode(false); if (sitePlanB64 && shapeCandidates.length > 0 && extractResult && setCompareMode) setCompareMode(true); }} style={{ padding: "9px 18px", border: "1px solid " + _br.bd, borderRadius: 6, background: "transparent", color: _br.mu, cursor: "pointer", fontFamily: _mono, fontSize: 11, fontWeight: 600 }}>{"\u2190"} Back to Site Plan</button>
        </div>
      </>;
    }

    return <>
      {/* S49: Choice screen (first time only) */}
      {step === 0 && guideActive === null && <GuideChoiceScreen onChoose={guideChoose} />}

      {/* S49: Guide panel (when active) */}
      {step === 0 && guideActive === true && !traceMode && (() => {
        var s0Msg = null, s0Tip = null;
        if (guidePhase === 'upload_survey') {
          if (sitePlanFile && !extracting && !extractResult) {
            s0Msg = "Survey uploaded! Now click 'Set Up Lot from Survey' below to extract your dimensions.";
            s0Tip = null;
          }
        }
        if (guidePhase === 'shape_select') {
          if (compareMode) {
            s0Msg = "Find the page showing your lot boundary, then tap the shape that matches.";
            s0Tip = "Use the page arrows on the left to navigate your survey. Select a shape on the right, then click Confirm.";
          }
        }
        return <GuidePanel
          phase={guidePhase}
          onAction={guideHandleAction}
          onBack={guideBack}
          history={guideHistory}
          onToggleOff={function() { setGuideActive(false); }}
          message={s0Msg}
          tip={s0Tip}
        />;
      })()}

      {/* S49: Intro text (manual mode or after choosing) */}
      {(guideActive === false) && <div style={{ fontSize: 11, color: _br.tx, fontFamily: _sans, lineHeight: 1.7, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span>Your permit office needs a site plan showing your property, house, and proposed deck. Enter your lot dimensions below to generate one automatically.</span>
        <button onClick={function() { setGuideActive(true); setGuidePhase('has_survey'); }} style={{
          fontSize: 9, fontFamily: _mono, color: _br.gn, background: "none",
          border: "1px solid " + _br.gn + "44", borderRadius: 4, padding: "4px 10px",
          cursor: "pointer", flexShrink: 0, marginLeft: 10, whiteSpace: "nowrap"
        }}>Switch to guided</button>
      </div>}

      {/* === LOT & HOUSE SLIDERS (collapsible, S31) === */}
      {guideSectionShown('lotHouse') && <><button onClick={function() { guideSectionToggle('lotHouse', showLotHouse, setShowLotHouse); }} style={{
        width: "100%", padding: "10px 14px", marginBottom: guideSectionVisible('lotHouse', showLotHouse) ? 0 : 14,
        background: _br.wr,
        border: "1px solid " + _br.bd,
        borderRadius: guideSectionVisible('lotHouse', showLotHouse) ? "8px 8px 0 0" : 8,
        cursor: "pointer", fontSize: 10, fontFamily: _mono, color: _br.mu,
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <span>{"\uD83D\uDCCF"} Lot Dimensions, House Position & Setbacks</span>
        <span style={{ transform: guideSectionVisible('lotHouse', showLotHouse) ? "rotate(180deg)" : "none", transition: "0.2s" }}>{"\u25BE"}</span>
      </button>
      {guideSectionVisible('lotHouse', showLotHouse) && <div style={{ padding: 14, background: _br.wr, borderRadius: "0 0 8px 8px", border: "1px solid " + _br.bd, borderTop: "none", marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, marginBottom: 12, lineHeight: 1.6, padding: "8px 10px", background: "#fff", borderRadius: 6, border: "1px solid " + _br.bd }}>
          {"\uD83D\uDCA1"} Don't know your exact lot size? Check your county assessor or tax records online, or look at your closing documents. Approximate dimensions are fine for planning.
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, color: _br.mu, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Lot Dimensions</div>
        {p.lotEdges && <div style={{ marginBottom: 8, padding: "6px 10px", background: "#f0fdf4", borderRadius: 4, border: "1px solid #bbf7d0" }}>
          <span style={{ fontSize: 8, fontFamily: _mono, color: _br.gn, fontWeight: 600 }}>{"\u2713"} Custom polygon active. Editing these sliders will reset to rectangle.</span>
        </div>}
        <Slider label="Lot width (front to back neighbor)" value={p.lotWidth} min={30} max={300} field="lotWidth" u={u} p={p} focused={guideFieldFocused('lotWidth')} />
        <Slider label="Lot depth (street to back)" value={p.lotDepth} min={50} max={400} field="lotDepth" u={u} p={p} focused={guideFieldFocused('lotDepth')} />
        <div style={{ fontSize: 9, fontWeight: 700, color: _br.mu, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8, marginTop: 12 }}>House Position</div>
        <Slider label="House width" value={p.houseWidth} min={20} max={80} field="houseWidth" u={u} p={p} focused={guideFieldFocused('houseWidth')} />
        <Slider label="House depth" value={p.houseDepth} min={20} max={60} field="houseDepth" u={u} p={p} focused={guideFieldFocused('houseDepth')} />
        <Slider label="House offset from left property line" value={p.houseOffsetSide} min={5} max={Math.max(5, p.lotWidth - p.houseWidth - 5)} field="houseOffsetSide" u={u} p={p} focused={guideFieldFocused('houseOffsetSide')} />
        <Slider label="House distance from street" value={p.houseDistFromStreet || p.setbackFront} min={p.setbackFront} max={Math.max(p.setbackFront + 1, p.lotDepth - p.houseDepth - 10)} field="houseDistFromStreet" u={u} p={p} focused={guideFieldFocused('houseDistFromStreet')} />
        <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginTop: -12, marginBottom: 12, fontStyle: "italic" }}>Front setback is the minimum ({p.setbackFront}'). Your house may sit further back.</div>
        <div style={{ fontSize: 9, fontWeight: 700, color: _br.mu, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8, marginTop: 12 }}>Setbacks (from zoning code)</div>
        <Slider label="Front setback" value={p.setbackFront} min={0} max={50} field="setbackFront" u={u} p={p} focused={guideFieldFocused('setbackFront')} />
        <Slider label="Side setback" value={p.setbackSide} min={0} max={30} field="setbackSide" u={u} p={p} focused={guideFieldFocused('setbackSide')} />
        <Slider label="Rear setback" value={p.setbackRear} min={0} max={50} field="setbackRear" u={u} p={p} focused={guideFieldFocused('setbackRear')} />
      </div>}
      </>}

      {/* === ADJUST LOT SHAPE (S37) === */}
      {guideSectionShown('lotShape') && (() => {
        var currentEdges = p.lotEdges || window.computeRectEdges(p);
        var isCustom = !!p.lotEdges;

        function commitEdges(newEdges) {
          u("lotEdges", newEdges);
          var verts = window.computePolygonVerts(newEdges, p.lotArea || null);
          u("lotVertices", verts);
        }

        function updateEdge(idx, field, val) {
          var newEdges = currentEdges.map(function(edge, i) {
            if (i !== idx) return Object.assign({}, edge);
            return Object.assign({}, edge, { [field]: val });
          });
          commitEdges(newEdges);
        }

        function addCornerPoint(idx) {
          var edge = currentEdges[idx];
          var half = Math.round(edge.length / 2 * 10) / 10;
          var e1 = Object.assign({}, edge, { length: half });
          var e2 = { type: "property", label: "", length: +(edge.length - half).toFixed(1), setbackType: edge.setbackType, neighborLabel: "" };
          var newEdges = [];
          for (var i = 0; i < currentEdges.length; i++) {
            if (i === idx) { newEdges.push(e1); newEdges.push(e2); }
            else newEdges.push(Object.assign({}, currentEdges[i]));
          }
          commitEdges(newEdges);
        }

        function removeEdge(idx) {
          if (currentEdges.length <= 3) return;
          var prevIdx = idx === 0 ? currentEdges.length - 1 : idx - 1;
          var newEdges = currentEdges.map(function(e) { return Object.assign({}, e); });
          newEdges[prevIdx] = Object.assign({}, newEdges[prevIdx], {
            length: +(newEdges[prevIdx].length + newEdges[idx].length).toFixed(1)
          });
          newEdges.splice(idx, 1);
          commitEdges(newEdges);
        }

        function resetToRect() {
          u("lotVertices", null);
          u("lotEdges", null);
        }

        var dirLabels = currentEdges.length === 4
          ? ["South", "East", "North", "West"]
          : currentEdges.map(function(_, i) { return "Edge " + (i + 1); });
        var sbColors = { front: "#2563eb", side: "#8B7355", rear: "#dc2626", none: "#999" };

        return <React.Fragment>
          <button onClick={function() { guideSectionToggle('lotShape', showLotShape, setShowLotShape); }} style={{
            width: "100%", padding: "10px 14px", marginBottom: guideSectionVisible('lotShape', showLotShape) ? 0 : 14,
            background: isCustom ? "#f0fdf4" : "none",
            border: "1px solid " + (isCustom ? _br.gn : _br.bd),
            borderRadius: guideSectionVisible('lotShape', showLotShape) ? "8px 8px 0 0" : 8,
            cursor: "pointer", fontSize: 10, fontFamily: _mono,
            color: isCustom ? _br.gn : _br.mu,
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <span>{isCustom ? ("\u270E Custom lot shape (" + currentEdges.length + " edges)") : "\u270E Adjust lot shape (polygon lots)"}</span>
            <span style={{ transform: guideSectionVisible('lotShape', showLotShape) ? "rotate(180deg)" : "none", transition: "0.2s" }}>{"\u25BE"}</span>
          </button>
          {guideSectionVisible('lotShape', showLotShape) && <div style={{
            padding: 14, background: _br.wr, borderRadius: "0 0 8px 8px",
            border: "1px solid " + _br.bd, borderTop: "none", marginBottom: 14
          }}>
            {!isCustom && <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, marginBottom: 12, lineHeight: 1.6, padding: "8px 10px", background: "#fff", borderRadius: 6, border: "1px solid " + _br.bd }}>
              {"\uD83D\uDCA1"} Edit edge lengths to define an irregular lot. This overrides the lot width/depth sliders.
            </div>}

            {isCustom && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 9, color: _br.gn, fontFamily: _mono, fontWeight: 700 }}>{"\u2713"} Custom polygon active</span>
              <button onClick={resetToRect} style={{
                padding: "4px 10px", fontSize: 8, fontFamily: _mono, cursor: "pointer",
                border: "1px solid " + _br.bd, borderRadius: 4, background: "#fff", color: _br.mu
              }}>Reset to rectangle</button>
            </div>}

            {currentEdges.map(function(edge, idx) {
              var dir = dirLabels[idx];
              var sbCol = sbColors[edge.setbackType] || "#999";
              var isStreet = edge.type === "street";
              return <div key={idx} style={{
                padding: 10, background: "#fff", borderRadius: 6,
                border: "1px solid " + _br.bd, marginBottom: 6
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: _br.tx, fontFamily: _mono }}>{dir}</span>
                    <span style={{ fontSize: 7, fontWeight: 600, color: sbCol, fontFamily: _mono, background: sbCol + "18", padding: "1px 5px", borderRadius: 3, textTransform: "uppercase" }}>{edge.setbackType}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input type="number" value={edge.length} step={0.1} min={1} max={999}
                      onChange={function(e) { var raw = e.target.value; updateEdge(idx, "length", raw === "" ? 0 : (parseFloat(raw) || 0)); }}
                      onBlur={function(e) { var v = parseFloat(e.target.value); if (!v || v < 1) updateEdge(idx, "length", 1); }}
                      style={{ width: 64, fontFamily: _mono, fontSize: 14, fontWeight: 800, color: _br.tx, textAlign: "right", border: "1px solid " + _br.bd, borderRadius: 4, padding: "3px 6px", outline: "none", background: "#faf8f3" }}
                    />
                    <span style={{ fontSize: 10, color: _br.mu, fontFamily: _mono }}>ft</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 6 }}>
                  {["street", "property"].map(function(t) {
                    var isAct = edge.type === t;
                    return <button key={t} onClick={function() { updateEdge(idx, "type", t); }} style={{
                      padding: "2px 7px", fontSize: 8, fontFamily: _mono, cursor: "pointer",
                      border: isAct ? "1.5px solid " + _br.gn : "1px solid " + _br.bd,
                      background: isAct ? "#edf5e8" : "#fff", color: isAct ? _br.gn : _br.mu,
                      borderRadius: 3, fontWeight: isAct ? 700 : 400, textTransform: "capitalize"
                    }}>{t}</button>;
                  })}
                  <span style={{ width: 1, background: _br.bd, margin: "0 1px", alignSelf: "stretch" }} />
                  {["front", "side", "rear", "none"].map(function(sb) {
                    var isAct = edge.setbackType === sb;
                    var col = sbColors[sb];
                    return <button key={sb} onClick={function() { updateEdge(idx, "setbackType", sb); }} style={{
                      padding: "2px 7px", fontSize: 8, fontFamily: _mono, cursor: "pointer",
                      border: isAct ? "1.5px solid " + col : "1px solid " + _br.bd,
                      background: isAct ? col + "18" : "#fff", color: isAct ? col : _br.mu,
                      borderRadius: 3, fontWeight: isAct ? 700 : 400, textTransform: "capitalize"
                    }}>{sb}</button>;
                  })}
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input value={isStreet ? (edge.label || "") : (edge.neighborLabel || "")}
                    onChange={function(e) { updateEdge(idx, isStreet ? "label" : "neighborLabel", e.target.value); }}
                    placeholder={isStreet ? "Street name" : "Neighbor (e.g. LOT 45)"}
                    style={{ flex: 1, padding: "4px 8px", border: "1px solid " + _br.bd, borderRadius: 4, fontSize: 9, fontFamily: _mono, color: _br.tx, background: "#fff", outline: "none" }}
                  />
                  <button onClick={function() { addCornerPoint(idx); }} title="Split edge to add corner" style={{
                    padding: "3px 7px", fontSize: 8, fontFamily: _mono, cursor: "pointer",
                    border: "1px solid " + _br.bd, borderRadius: 3, background: "#fff", color: _br.mu
                  }}>+ Split</button>
                  {currentEdges.length > 4 && <button onClick={function() { removeEdge(idx); }} title="Merge with previous" style={{
                    padding: "3px 5px", fontSize: 9, cursor: "pointer",
                    border: "1px solid #fca5a5", borderRadius: 3, background: "#fef2f2", color: "#dc2626"
                  }}>{"\u00D7"}</button>}
                </div>
              </div>;
            })}

            {currentEdges.length > 4 && <div style={{ fontSize: 8, color: "#60a5fa", fontFamily: _mono, padding: "6px 10px", background: "#eff6ff", borderRadius: 4, border: "1px solid #bfdbfe", marginTop: 2, marginBottom: 4 }}>
              {"\u2139\uFE0F"} Approximate preview for {currentEdges.length}-sided lots. Shape uses equal-angle estimation.
            </div>}

            <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginTop: 6, fontStyle: "italic" }}>
              Edges ordered clockwise from street. Use "Split" to create 5+ sided lots (jogs, angled property lines).
            </div>
          </div>}
        </React.Fragment>;
      })()}


      {/* === SITE ELEMENTS (S31) === */}
      {guideSectionShown('siteElements') && (() => {
        var siteElDefs = {
          driveway: { w: 12, d: 20, label: "DRIVEWAY", icon: "\uD83D\uDE97", name: "Driveway" },
          garage: { w: 12, d: 22, label: "GARAGE", icon: "\uD83D\uDE99", name: "Garage" },
          shed: { w: 8, d: 10, label: "SHED", icon: "\u2302", name: "Shed" },
          pool: { w: 12, d: 24, label: "POOL", icon: "\u223C", name: "Pool" },
          patio: { w: 12, d: 12, label: "PATIO", icon: "\u25A3", name: "Patio" },
          tree: { w: 6, d: 6, label: "", icon: "\u2742", name: "Tree" },
          ac_unit: { w: 3, d: 3, label: "A/C", icon: "\u2744", name: "A/C Unit" },
          fence: { w: 30, d: 1, label: "FENCE", icon: "\u2502", name: "Fence" }
        };
        var elArr = p.siteElements || [];
        var lotW = p.lotWidth || 80;
        var lotD = p.lotDepth || 120;
        var selEl = selectedElId ? elArr.find(function(e) { return e.id === selectedElId; }) : null;
        var selDef = selEl ? siteElDefs[selEl.type] : null;
        var sizeConfig = {
          driveway: { wMin: 6, wMax: 24, dMin: 8, dMax: 50 },
          garage: { wMin: 8, wMax: 30, dMin: 10, dMax: 35 },
          shed: { wMin: 4, wMax: 16, dMin: 4, dMax: 16 },
          pool: { wMin: 6, wMax: 24, dMin: 8, dMax: 36 },
          patio: { wMin: 4, wMax: 30, dMin: 4, dMax: 30 },
          tree: { wMin: 2, wMax: 20, dMin: 2, dMax: 20 },
          ac_unit: { wMin: 2, wMax: 6, dMin: 2, dMax: 6 },
          fence: { wMin: 4, wMax: 100, dMin: 1, dMax: 4 }
        };
        var sc = selEl ? (sizeConfig[selEl.type] || sizeConfig.shed) : null;
        function addSiteEl(type) {
          var def = siteElDefs[type];
          var houseY = p.houseDistFromStreet || p.setbackFront || 25;
          var x = 5, y = 5;
          if (type === "driveway") { x = 2; y = 2; }
          else if (type === "garage") { x = Math.max(2, (p.houseOffsetSide || 20) - def.w - 2); y = houseY; }
          else if (type === "shed") { x = lotW - def.w - 3; y = lotD - def.d - 3; }
          else if (type === "pool") { x = (p.houseOffsetSide || 20) + 2; y = houseY + (p.houseDepth || 30) + (p.depth || 12) + 3; }
          else if (type === "patio") { x = (p.houseOffsetSide || 20) + 2; y = houseY + (p.houseDepth || 30) + (p.depth || 12) + 2; }
          else if (type === "tree") { x = 3 + elArr.filter(function(e){return e.type==="tree";}).length * 8; y = lotD - 10; }
          else if (type === "ac_unit") { x = (p.houseOffsetSide || 20) + (p.houseWidth || 40) + 2; y = houseY + (p.houseDepth || 30) / 2; }
          else if (type === "fence") { x = 0; y = houseY + (p.houseDepth || 30); }
          var newId = Date.now();
          u("siteElements", elArr.concat([{ id: newId, type: type, x: Math.round(x), y: Math.round(y), w: def.w, d: def.d, label: def.label }]));
          setSelectedElId(newId);
        }
        function removeSiteEl(id) {
          u("siteElements", elArr.filter(function(e) { return e.id !== id; }));
          if (selectedElId === id) setSelectedElId(null);
        }
        function updateEl(id, field, val) {
          u("siteElements", elArr.map(function(e) {
            if (e.id !== id) return e;
            var copy = Object.assign({}, e);
            copy[field] = val;
            if (field === "w" && e.type === "tree") copy.d = val;
            return copy;
          }));
        }
        return <React.Fragment>
          <button data-guide-section="siteElements" onClick={function() { guideSectionToggle('siteElements', showSiteElements, setShowSiteElements); }} style={{
            width: "100%", padding: "10px 14px", marginBottom: guideSectionVisible('siteElements', showSiteElements) ? 0 : 14,
            background: elArr.length > 0 ? "#f5f0e8" : "none",
            border: "1px solid " + (elArr.length > 0 ? "#c4a060" : _br.bd),
            borderRadius: guideSectionVisible('siteElements', showSiteElements) ? "8px 8px 0 0" : 8,
            cursor: "pointer", fontSize: 10, fontFamily: _mono,
            color: elArr.length > 0 ? "#8B7355" : _br.mu,
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <span>{elArr.length > 0 ? ("\u2302 " + elArr.length + " site element" + (elArr.length !== 1 ? "s" : "") + " placed") : "\u2302 Add site elements (shed, pool, driveway...)"}</span>
            <span style={{ transform: guideSectionVisible('siteElements', showSiteElements) ? "rotate(180deg)" : "none", transition: "0.2s" }}>{"\u25BE"}</span>
          </button>
          {guideSectionVisible('siteElements', showSiteElements) && <div style={{ padding: 14, background: _br.wr, borderRadius: "0 0 8px 8px", border: "1px solid " + _br.bd, borderTop: "none", marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, marginBottom: 8, lineHeight: 1.5 }}>Click to place elements on your site plan.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
              {Object.keys(siteElDefs).map(function(type) {
                var def = siteElDefs[type];
                return <button key={type} onClick={function() { addSiteEl(type); }} style={{
                  padding: "8px 4px", borderRadius: 6, cursor: "pointer", textAlign: "center",
                  border: "1px solid " + _br.bd, background: "#fff", fontFamily: _mono, transition: "all 0.15s"
                }}>
                  <div style={{ fontSize: 16, marginBottom: 2, lineHeight: 1 }}>{def.icon}</div>
                  <div style={{ fontSize: 8, fontWeight: 600, color: _br.tx }}>{def.name}</div>
                </button>;
              })}
            </div>
            {elArr.length > 0 && <React.Fragment>
              <div style={{ fontSize: 9, fontWeight: 700, color: _br.mu, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>Placed Elements</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: selEl ? 10 : 0 }}>
                {elArr.map(function(el) {
                  var def = siteElDefs[el.type] || { icon: "?", name: el.type };
                  var isSel = selectedElId === el.id;
                  return <button key={el.id} onClick={function() { setSelectedElId(isSel ? null : el.id); }} style={{
                    padding: "5px 10px", fontSize: 10, fontWeight: 700, borderRadius: 5, fontFamily: _mono, cursor: "pointer",
                    border: isSel ? "2px solid #8B7355" : "1px solid " + _br.bd,
                    background: isSel ? "#f5f0e8" : "#fff",
                    color: isSel ? "#8B7355" : _br.mu,
                    display: "flex", alignItems: "center", gap: 4
                  }}>
                    <span style={{ fontSize: 12 }}>{def.icon}</span> {def.name}
                  </button>;
                })}
              </div>
            </React.Fragment>}
            {selEl && <div style={{ padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #d4c5a9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#8B7355", fontFamily: _mono }}>{selDef.icon} {selDef.name}</div>
                <button onClick={function() { removeSiteEl(selEl.id); }} style={{
                  padding: "4px 10px", fontSize: 9, fontWeight: 700, borderRadius: 4, fontFamily: _mono, cursor: "pointer",
                  border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626"
                }}>Delete</button>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Label>Distance from left property line</Label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="range" min={0} max={Math.max(0, lotW - selEl.w)} step={1} value={selEl.x}
                    onChange={function(e) { updateEl(selEl.id, "x", Number(e.target.value)); }}
                    style={{ flex: 1, accentColor: "#8B7355", height: 6 }} />
                  <span style={{ fontFamily: _mono, fontSize: 16, fontWeight: 800, color: _br.tx, minWidth: 40, textAlign: "right" }}>{selEl.x}'</span>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Label>Distance from street</Label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="range" min={0} max={Math.max(0, lotD - selEl.d)} step={1} value={selEl.y}
                    onChange={function(e) { updateEl(selEl.id, "y", Number(e.target.value)); }}
                    style={{ flex: 1, accentColor: "#8B7355", height: 6 }} />
                  <span style={{ fontFamily: _mono, fontSize: 16, fontWeight: 800, color: _br.tx, minWidth: 40, textAlign: "right" }}>{selEl.y}'</span>
                </div>
              </div>
              {selEl.type === "tree" ? (
                <div style={{ marginBottom: 4 }}>
                  <Label>Canopy diameter</Label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="range" min={sc.wMin} max={sc.wMax} step={1} value={selEl.w}
                      onChange={function(e) { updateEl(selEl.id, "w", Number(e.target.value)); }}
                      style={{ flex: 1, accentColor: "#8B7355", height: 6 }} />
                    <span style={{ fontFamily: _mono, fontSize: 16, fontWeight: 800, color: _br.tx, minWidth: 40, textAlign: "right" }}>{selEl.w}'</span>
                  </div>
                </div>
              ) : (
                <React.Fragment>
                  <div style={{ marginBottom: 12 }}>
                    <Label>{selEl.type === "fence" ? "Length" : "Width"}</Label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="range" min={sc.wMin} max={sc.wMax} step={1} value={selEl.w}
                        onChange={function(e) { updateEl(selEl.id, "w", Number(e.target.value)); }}
                        style={{ flex: 1, accentColor: "#8B7355", height: 6 }} />
                      <span style={{ fontFamily: _mono, fontSize: 16, fontWeight: 800, color: _br.tx, minWidth: 40, textAlign: "right" }}>{selEl.w}'</span>
                    </div>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <Label>{selEl.type === "fence" ? "Thickness" : "Depth"}</Label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="range" min={sc.dMin} max={sc.dMax} step={1} value={selEl.d}
                        onChange={function(e) { updateEl(selEl.id, "d", Number(e.target.value)); }}
                        style={{ flex: 1, accentColor: "#8B7355", height: 6 }} />
                      <span style={{ fontFamily: _mono, fontSize: 16, fontWeight: 800, color: _br.tx, minWidth: 40, textAlign: "right" }}>{selEl.d}'</span>
                    </div>
                  </div>
                </React.Fragment>
              )}
              <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginTop: 8, fontStyle: "italic" }}>Position and size update on the site plan preview in real time.</div>
            </div>}
          </div>}
        </React.Fragment>;
      })()}


      {/* === NORTH ARROW (S32) === */}
      {guideSectionVisible('northArrow', guideActive === false) && (() => {
        var northAngle = p.northAngle || 0;
        function calcAngle(e, svg) {
          var rect = svg.getBoundingClientRect();
          var cx = rect.left + rect.width / 2;
          var cy = rect.top + rect.height / 2;
          var cX = e.clientX != null ? e.clientX : (e.touches ? e.touches[0].clientX : null);
          var cY = e.clientY != null ? e.clientY : (e.touches ? e.touches[0].clientY : null);
          if (cX == null) return null;
          var a = Math.round(Math.atan2(cX - cx, -(cY - cy)) * 180 / Math.PI);
          return a < 0 ? a + 360 : a;
        }
        var cardinals = ["N","NE","E","SE","S","SW","W","NW"];
        var cardIdx = Math.round(northAngle / 45) % 8;
        var cardLabel = cardinals[cardIdx];
        return <div style={{ padding: 14, background: _br.wr, borderRadius: 8, border: "1px solid " + _br.bd, marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: _br.mu, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>{"\uD83E\uDDED"} North Arrow Direction</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width={64} height={64} viewBox="0 0 64 64" style={{ cursor: "pointer", flexShrink: 0 }}
              onMouseDown={function(e) { dialDragRef.current = true; var a = calcAngle(e, e.currentTarget); if (a != null) u("northAngle", a); }}
              onMouseMove={function(e) { if (!dialDragRef.current) return; var a = calcAngle(e, e.currentTarget); if (a != null) u("northAngle", a); }}
              onMouseUp={function() { dialDragRef.current = false; }}
              onMouseLeave={function() { dialDragRef.current = false; }}
              onTouchStart={function(e) { e.preventDefault(); dialDragRef.current = true; var a = calcAngle(e, e.currentTarget); if (a != null) u("northAngle", a); }}
              onTouchMove={function(e) { e.preventDefault(); if (!dialDragRef.current) return; var a = calcAngle(e, e.currentTarget); if (a != null) u("northAngle", a); }}
              onTouchEnd={function() { dialDragRef.current = false; }}>
              <circle cx={32} cy={32} r={28} fill="#fff" stroke={_br.bd} strokeWidth={1.5} />
              {[0,90,180,270].map(function(deg) {
                var rad = deg * Math.PI / 180;
                return <line key={deg} x1={32 + 23 * Math.sin(rad)} y1={32 - 23 * Math.cos(rad)} x2={32 + 28 * Math.sin(rad)} y2={32 - 28 * Math.cos(rad)} stroke="#ccc" strokeWidth={1} />;
              })}
              {[["N",0],["E",90],["S",180],["W",270]].map(function(pair) {
                var rad = pair[1] * Math.PI / 180;
                return <text key={pair[0]} x={32 + 18 * Math.sin(rad)} y={32 - 18 * Math.cos(rad) + 3} textAnchor="middle" style={{ fontSize: 7, fill: "#aaa", fontFamily: _mono, fontWeight: 600 }}>{pair[0]}</text>;
              })}
              <g transform={"rotate(" + northAngle + ",32,32)"}>
                <line x1={32} y1={32} x2={32} y2={8} stroke="#333" strokeWidth={1.5} />
                <polygon points="28,14 32,6 36,14" fill="#333" />
                <circle cx={32} cy={32} r={2.5} fill="#333" />
              </g>
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: _mono, fontSize: 20, fontWeight: 800, color: _br.tx }}>{northAngle}{"\u00B0"}</span>
                <span style={{ fontFamily: _mono, fontSize: 11, fontWeight: 600, color: _br.mu }}>{cardLabel}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <input type="range" min={0} max={359} step={1} value={northAngle}
                  onChange={function(e) { u("northAngle", Number(e.target.value)); }}
                  style={{ flex: 1, accentColor: _br.gn, height: 6 }} />
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {[[0,"N"],[45,"NE"],[90,"E"],[135,"SE"],[180,"S"],[225,"SW"],[270,"W"],[315,"NW"]].map(function(pair) {
                  var isAct = northAngle === pair[0];
                  return <button key={pair[0]} onClick={function() { u("northAngle", pair[0]); }} style={{
                    padding: "3px 7px", fontSize: 9, fontFamily: _mono, cursor: "pointer",
                    border: isAct ? "2px solid " + _br.gn : "1px solid " + _br.bd,
                    background: isAct ? "#edf5e8" : "#fff",
                    color: isAct ? _br.gn : _br.mu,
                    borderRadius: 4, fontWeight: isAct ? 700 : 400, minWidth: 26, textAlign: "center"
                  }}>{pair[1]}</button>;
                })}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginTop: 8, fontStyle: "italic" }}>Click or drag the dial, use the slider, or pick a cardinal direction.</div>
        </div>;
      })()}

      {/* === SLOPE / GRADE (S33) === */}
      {guideSectionVisible('slope', guideActive === false) && <div style={{ padding: 14, background: _br.wr, borderRadius: 8, border: "1px solid " + _br.bd, marginBottom: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: _br.mu, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>{"\u2B06\uFE0F"} Site Slope / Grade</div>
        <Slider label="Slope %" value={p.slopePercent || 0} min={0} max={15} step={0.5} field="slopePercent" unit="%" u={u} p={p} />
        {(p.slopePercent || 0) > 0 && <div style={{ marginBottom: 12 }}>
          <Label>Downhill direction</Label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {[["front-to-back", "Front \u2192 Back"], ["back-to-front", "Back \u2192 Front"], ["left-to-right", "Left \u2192 Right"], ["right-to-left", "Right \u2192 Left"]].map(function(pair) {
              var isAct = (p.slopeDirection || "front-to-back") === pair[0];
              return <button key={pair[0]} onClick={function() { u("slopeDirection", pair[0]); }} style={{
                padding: "7px 12px", borderRadius: 6, fontSize: 10, fontFamily: _mono, cursor: "pointer",
                border: isAct ? "2px solid " + _br.gn : "1px solid " + _br.bd,
                background: isAct ? _br.gn : "#fff",
                color: isAct ? "#fff" : _br.tx,
                fontWeight: isAct ? 700 : 400, transition: "all 0.15s"
              }}>{pair[1]}</button>;
            })}
          </div>
        </div>}
        {(p.slopePercent || 0) > 0 && (() => {
          var pct = p.slopePercent || 0;
          var dir = p.slopeDirection || "front-to-back";
          var isDepthSlope = dir === "front-to-back" || dir === "back-to-front";
          var span = isDepthSlope ? (p.depth || 12) : (p.width || 20);
          var delta = (pct / 100 * span * 12).toFixed(1);
          return <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, lineHeight: 1.6, padding: "8px 10px", background: "#fff", borderRadius: 6, border: "1px solid " + _br.bd }}>
            {pct}% slope over {span}' = <span style={{ fontWeight: 700, color: _br.tx }}>{delta}" of grade change</span>. This affects post heights on the elevation views.
          </div>;
        })()}
        {(p.slopePercent || 0) === 0 && <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, fontStyle: "italic" }}>Set to 0% for a flat lot. Most residential lots have 2-6% slope.</div>}
      </div>}

      {/* === UPLOAD SURVEY (collapsible) === */}
      {guideSectionShown('upload') && <><button onClick={function() { guideSectionToggle('upload', showUpload, setShowUpload); }} style={{
        width: "100%", padding: "10px 14px", marginBottom: guideSectionVisible('upload', showUpload || !!sitePlanFile) ? 0 : 14,
        background: sitePlanFile ? "#edf5e8" : "none",
        border: "1px solid " + (sitePlanFile ? _br.gn : _br.bd),
        borderRadius: guideSectionVisible('upload', showUpload || !!sitePlanFile) ? "8px 8px 0 0" : 8,
        cursor: "pointer", fontSize: 10, fontFamily: _mono, color: sitePlanFile ? _br.gn : _br.mu,
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <span>{sitePlanFile ? ("\u2713 Survey attached: " + sitePlanFile.name) : "\uD83D\uDCC4 Have a property survey? Upload it here"}</span>
        <span style={{ transform: guideSectionVisible('upload', showUpload || !!sitePlanFile) ? "rotate(180deg)" : "none", transition: "0.2s" }}>{"\u25BE"}</span>
      </button>
      {guideSectionVisible('upload', showUpload || !!sitePlanFile) && <div style={{ padding: 14, background: _br.wr, borderRadius: "0 0 8px 8px", border: "1px solid " + _br.bd, borderTop: "none", marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, marginBottom: 10, lineHeight: 1.6, padding: "8px 10px", background: "#fff", borderRadius: 6, border: "1px solid " + _br.bd }}>
          {"\uD83D\uDCA1"} Upload your property survey, plat map, or site plan. This will be included as a separate sheet in your blueprint package. The dimensions above will still be used for the generated site plan.
        </div>
        <div style={{ textAlign: "center", padding: 20, border: "2px dashed " + (sitePlanFile ? _br.gn : _br.bd), borderRadius: 8, background: sitePlanFile ? "#edf5e8" : "#fff", cursor: "pointer", position: "relative" }}
          onClick={function() { document.getElementById("sitePlanInput").click(); }}>
          <input id="sitePlanInput" type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: "none" }} onChange={function(e) {
            var file = e.target.files[0]; if (!file) return;
            setSitePlanFile(file);
            setSitePlanMode("upload");
            var reader = new FileReader();
            reader.onload = function() { setSitePlanB64(reader.result.split(",")[1]); };
            reader.readAsDataURL(file);
          }} />
          {sitePlanFile ? (
            <div>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{"\u2713"}</div>
              <div style={{ fontSize: 11, fontFamily: _mono, color: _br.gn, fontWeight: 700 }}>{sitePlanFile.name}</div>
              <div style={{ fontSize: 9, fontFamily: _mono, color: _br.mu, marginTop: 4 }}>{(sitePlanFile.size / 1024).toFixed(0)} KB {"\u00B7"} Click to change</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{"\uD83D\uDCC4"}</div>
              <div style={{ fontSize: 11, fontFamily: _mono, color: _br.tx, fontWeight: 600 }}>Click to upload your survey</div>
              <div style={{ fontSize: 9, fontFamily: _mono, color: _br.mu, marginTop: 4 }}>PDF, PNG, or JPG</div>
            </div>
          )}
        </div>
      </div>}
      </>}

      {/* S46: Set Up Lot from Survey - extraction first, shape picker or trace */}
      {sitePlanFile && !traceMode && !extracting && !extractResult && <div style={{ marginBottom: 14 }}>
        <button onClick={function() {
          (async function() {
            setExtracting(true); setExtractError(null);
            // S49: Advance guide to extracting phase
            if (guideActive && guidePhase === 'upload_survey') guideAdvance('extracting');
            try {
              var fileType = sitePlanFile.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image";
              var b64 = sitePlanB64 || await new Promise(function(resolve, reject) {
                var reader = new FileReader();
                reader.onload = function() { resolve(reader.result.split(",")[1]); };
                reader.onerror = function() { reject(new Error("Failed to read file")); };
                reader.readAsDataURL(sitePlanFile);
              });
              var res = await fetch(API + "/api/extract-survey", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ surveyData: b64, fileType: fileType })
              });
              var data = await res.json();
              if (data.ok) {
                setExtractResult(data.data);
                var hasShapes = data.data.lotEdges && data.data.lotEdges.length >= 4 && data.data.lotArea;
                if (!hasShapes) {
                  setTraceState({
                    calPoints: [], calDist: "", ppf: null,
                    vertices: [], edgeMeta: [], edgeLengths: [],
                    imgW: 0, imgH: 0,
                    selectedEdge: null, selectedVertex: null,
                    pdfPage: 1, pdfPageCount: 1
                  });
                  setTraceMode(true);
                }
              } else {
                setExtractError(data.error || "Extraction failed");
                setTraceState({
                  calPoints: [], calDist: "", ppf: null,
                  vertices: [], edgeMeta: [], edgeLengths: [],
                  imgW: 0, imgH: 0,
                  selectedEdge: null, selectedVertex: null,
                  pdfPage: 1, pdfPageCount: 1
                });
                setTraceMode(true);
              }
            } catch(e) {
              setExtractError(e.message);
              setTraceState({
                calPoints: [], calDist: "", ppf: null,
                vertices: [], edgeMeta: [], edgeLengths: [],
                imgW: 0, imgH: 0,
                selectedEdge: null, selectedVertex: null,
                pdfPage: 1, pdfPageCount: 1
              });
              setTraceMode(true);
            }
            setExtracting(false);
          })();
        }} style={{
          width: "100%", padding: "12px 14px",
          background: "#f0fdf4",
          border: "1px solid " + _br.gn,
          borderRadius: 8, cursor: "pointer",
          fontSize: 11, fontFamily: _mono,
          color: "#2e7d32", fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8
        }}>
          {"\uD83D\uDCCD"} Set Up Lot from Survey
        </button>
        <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginTop: 4, textAlign: "center" }}>
          Detects lot shape automatically. Trace manually if needed.
        </div>
      </div>}

      {/* S46: Loading indicator */}
      {extracting && !traceMode && <div style={{ padding: 20, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", marginBottom: 14, textAlign: "center" }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>{"\u23F3"}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#2e7d32", fontFamily: _mono, marginBottom: 4 }}>Analyzing survey...</div>
        <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono }}>Extracting dimensions, setbacks, and lot shape</div>
      </div>}

      {/* === AI EXTRACTION (S29) === */}
      {sitePlanFile && !extractResult && !traceMode && !extracting && !guideActive && <div style={{ marginBottom: 14 }}>
        <button onClick={async function() {
          setExtracting(true); setExtractError(null);
          try {
            var fileType = sitePlanFile.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image";
            var b64 = await new Promise(function(resolve, reject) {
              var reader = new FileReader();
              reader.onload = function() { resolve(reader.result.split(",")[1]); };
              reader.onerror = function() { reject(new Error("Failed to read file")); };
              reader.readAsDataURL(sitePlanFile);
            });
            var res = await fetch(API + "/api/extract-survey", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ surveyData: b64, fileType: fileType })
            });
            var data = await res.json();
            if (data.ok) { setExtractResult(data.data); }
            else { setExtractError(data.error || "Extraction failed"); }
          } catch(e) { setExtractError(e.message); }
          setExtracting(false);
        }} disabled={extracting} style={{
          width: "100%", padding: "12px 14px",
          background: extracting ? _br.wr : "#fff",
          border: "1px solid " + _br.bd,
          borderRadius: 8, cursor: extracting ? "wait" : "pointer",
          fontSize: 11, fontFamily: _mono,
          color: extracting ? _br.mu : "#1d4ed8", fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8
        }}>
          {extracting ? "\u23F3 Analyzing survey with AI..." : "\u2728 Just extract text info (no tracing)"}
        </button>
        {extractError && <div style={{ fontSize: 10, color: "#dc2626", fontFamily: _mono, marginTop: 6 }}>{"\u26A0\uFE0F"} {extractError}</div>}
      </div>}

            {/* S47: Shape Picker - inline grid only (no survey image). S52: When survey exists, auto-enters compare mode */}
      {extractResult && !traceMode && !compareMode && !sitePlanB64 && shapeCandidates.length > 0 && <div style={{ padding: 14, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#2e7d32", fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase" }}>Select Your Lot Shape</span>
          <button onClick={function() { setExtractResult(null); }} style={{ fontSize: 8, fontFamily: _mono, color: _br.mu, background: "none", border: "1px solid " + _br.bd, borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}>Dismiss</button>
        </div>
        <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, marginBottom: 10, lineHeight: 1.6 }}>
          We found {shapeCandidates.length} possible shapes matching the survey dimensions ({extractResult.lotArea ? extractResult.lotArea.toLocaleString() : "?"} SF).
          {sitePlanB64 ? " Compare them to your survey to find the best match." : " Tap the one that looks like your lot."}
        </div>
        {sitePlanB64 && setCompareMode && <button onClick={function() { setCompareMode(true); if (guideActive) guideAdvance('shape_select'); setTimeout(function() { window.scrollTo({ top: 0, behavior: "smooth" }); }, 50); }} style={{
          width: "100%", padding: "14px", background: "#2e7d32", color: "#fff", border: "none",
          borderRadius: 8, cursor: "pointer", fontSize: 12, fontFamily: _mono, fontWeight: 700,
          marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8
        }}>{"\uD83D\uDDFA\uFE0F"} Compare to Survey</button>}
        {!sitePlanB64 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
          {shapeCandidates.map(function(cand, ci) {
            var cv = cand.vertices;
            var cmaxX = 0, cmaxY = 0;
            cv.forEach(function(v) { if (v[0] > cmaxX) cmaxX = v[0]; if (v[1] > cmaxY) cmaxY = v[1]; });
            var cpad = Math.max(cmaxX, cmaxY) * 0.12;
            var cvbW = cmaxX + cpad * 2, cvbH = cmaxY + cpad * 2;
            var cpts = cv.map(function(v) { return (v[0] + cpad).toFixed(1) + "," + (cvbH - v[1] - cpad).toFixed(1); }).join(" ");
            var csw = Math.max(1.5, cvbW / 200);
            var edgeColors = ["#e53935", "#2563eb", "#8B7355", "#7c3aed", "#0d9488"];
            return <div key={ci} onClick={function() { if (window._selectShape) window._selectShape(ci); }}
            style={{ cursor: "pointer", padding: 10, background: "#fff", borderRadius: 8, border: "2px solid " + _br.bd, transition: "all 0.15s" }}
            onMouseOver={function(e) { e.currentTarget.style.borderColor = _br.gn; e.currentTarget.style.boxShadow = "0 2px 8px rgba(61,90,46,0.15)"; }}
            onMouseOut={function(e) { e.currentTarget.style.borderColor = _br.bd; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ textAlign: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: _mono, color: _br.tx }}>Option {ci + 1}</span>
                <span style={{ fontSize: 11, fontFamily: _mono, color: _br.mu, marginLeft: 6 }}>{cand.area.toLocaleString()} SF</span>
              </div>
              <svg viewBox={"0 0 " + cvbW.toFixed(0) + " " + cvbH.toFixed(0)} style={{ width: "100%", height: 110 }} preserveAspectRatio="xMidYMid meet">
                <polygon points={cpts} fill="rgba(61,90,46,0.08)" stroke="#3d5a2e" strokeWidth={csw} strokeLinejoin="round" />
                {cv.map(function(v, vi) {
                  var v2 = cv[(vi + 1) % cv.length];
                  var mx = (v[0] + v2[0]) / 2 + cpad;
                  var my = cvbH - ((v[1] + v2[1]) / 2) - cpad;
                  var col = edgeColors[vi % edgeColors.length];
                  var r = Math.max(3, cvbW / 70);
                  return <circle key={vi} cx={mx.toFixed(1)} cy={my.toFixed(1)} r={r} fill={col} />;
                })}
              </svg>
              <div style={{ marginTop: 6, borderTop: "1px solid " + _br.bd, paddingTop: 6 }}>
                {cand.edges.map(function(e, ei) {
                  var col = edgeColors[ei % edgeColors.length];
                  var isStr = e.type === "street";
                  return <div key={ei} style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 0" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: col, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontFamily: _mono, fontWeight: 700, color: _br.tx }}>{e.length}'</span>
                    <span style={{ fontSize: 10, fontFamily: _mono, color: isStr ? "#e53935" : _br.mu, fontWeight: isStr ? 600 : 400 }}>
                      {isStr ? (e.label || "street") : (e.neighborLabel || e.setbackType || "")}
                    </span>
                  </div>;
                })}
              </div>
            </div>;
          })}
        </div>}

      </div>}


      {extractResult && !traceMode && !compareMode && <div style={{ padding: 14, background: "#eff6ff", borderRadius: 8, border: "1px solid #93c5fd", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#1d4ed8", fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase" }}>{"\u2728"} AI Extracted Dimensions</div>
          <button onClick={function() { setExtractResult(null); }} style={{ fontSize: 8, fontFamily: _mono, color: _br.mu, background: "none", border: "1px solid " + _br.bd, borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}>Dismiss</button>
        </div>
        <div style={{ fontSize: 9, color: "#1e40af", fontFamily: _mono, marginBottom: 10 }}>Review the values below, then click Apply to populate the sliders.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            ["lotWidth", "Lot Width", "'"],
            ["lotDepth", "Lot Depth", "'"],
            ["houseWidth", "House Width", "'"],
            ["houseDepth", "House Depth", "'"],
            ["houseDistFromStreet", "Dist. from Street", "'"],
            ["houseOffsetSide", "Offset from Left", "'"],
            ["setbackFront", "Front Setback", "'"],
            ["setbackRear", "Rear Setback", "'"],
            ["setbackSide", "Side Setback", "'"],
            ["northAngle", "North Arrow", "\u00B0"],
          ].map(function(item) {
            var key = item[0], label = item[1], unit = item[2];
            var val = extractResult[key];
            var conf = extractResult.confidence ? extractResult.confidence[key] : "low";
            var confColor = conf === "high" ? "#16a34a" : conf === "medium" ? "#ca8a04" : "#dc2626";
            if (val === null || val === undefined) return null;
            return <div key={key} style={{ padding: "6px 8px", background: "#fff", borderRadius: 4, border: "1px solid #dbeafe" }}>
              <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono }}>{label}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, fontFamily: _mono, color: _br.tx }}>{val}{unit}</span>
                <span style={{ fontSize: 7, fontWeight: 700, fontFamily: _mono, color: confColor, background: confColor + "18", padding: "2px 5px", borderRadius: 3, textTransform: "uppercase" }}>{conf}</span>
              </div>
            </div>;
          })}
        </div>
        {(extractResult.street || extractResult.city || extractResult.streetName || extractResult.parcelId) && <div style={{ marginTop: 8, padding: "6px 8px", background: "#fff", borderRadius: 4, border: "1px solid #dbeafe" }}>
          <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginBottom: 2 }}>Property Info</div>
          {extractResult.street && <div style={{ fontSize: 10, fontFamily: _mono, color: _br.tx }}>{extractResult.street}</div>}
          {(extractResult.city || extractResult.state || extractResult.zip) && <div style={{ fontSize: 9, fontFamily: _mono, color: _br.mu }}>{[extractResult.city, extractResult.state, extractResult.zip].filter(Boolean).join(", ")}</div>}
          {extractResult.streetName && <div style={{ fontSize: 9, fontFamily: _mono, color: _br.mu }}>Street: {extractResult.streetName}</div>}
          {extractResult.parcelId && <div style={{ fontSize: 9, fontFamily: _mono, color: _br.mu }}>Parcel: {extractResult.parcelId}</div>}
        </div>}
        {extractResult.lotEdges && Array.isArray(extractResult.lotEdges) && extractResult.lotEdges.length >= 3 && <div style={{ marginTop: 8, padding: "6px 8px", background: "#f0fdf4", borderRadius: 4, border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: 8, color: _br.gn, fontFamily: _mono, marginBottom: 4, fontWeight: 700 }}>Polygon Lot Boundary ({extractResult.lotEdges.length} edges)</div>
          {extractResult.lotEdges.map(function(e, i) {
            var dirLabels = extractResult.lotEdges.length >= 4 ? ["South (Street)", "East", "North (Rear)", "West"] : null;
            return <div key={i} style={{ fontSize: 9, fontFamily: _mono, color: _br.tx, display: "flex", gap: 6, marginBottom: 2 }}>
              <span style={{ color: _br.mu, minWidth: 55 }}>{dirLabels ? dirLabels[i] : ("Edge " + (i+1))}</span>
              <span style={{ fontWeight: 700 }}>{e.length}'"'"'</span>
              <span style={{ color: _br.mu, fontSize: 8 }}>{e.type === "street" ? "street" : "property"}{e.label ? " (" + e.label + ")" : ""}</span>
            </div>;
          })}
          <div style={{ fontSize: 8, color: _br.gn, fontFamily: _mono, marginTop: 4, fontStyle: "italic" }}>This will set a custom polygon lot shape.</div>
        </div>}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={function() {
            var d = extractResult;
            if (d.lotWidth) u("lotWidth", d.lotWidth);
            if (d.lotDepth) u("lotDepth", d.lotDepth);
            if (d.houseWidth) u("houseWidth", d.houseWidth);
            if (d.houseDepth) u("houseDepth", d.houseDepth);
            if (d.houseDistFromStreet) u("houseDistFromStreet", d.houseDistFromStreet);
            if (d.houseOffsetSide) u("houseOffsetSide", d.houseOffsetSide);
            if (d.setbackFront) u("setbackFront", d.setbackFront);
            if (d.setbackRear) u("setbackRear", d.setbackRear);
            if (d.setbackSide) u("setbackSide", d.setbackSide);
            if (d.street) setI("address", d.street);
            if (d.city) setI("city", d.city);
            if (d.state) setI("state", d.state);
            if (d.zip) setI("zip", d.zip);
            if (d.parcelId) setI("lot", d.parcelId);
            if (d.streetName) u("streetName", d.streetName);
            if (d.northAngle != null) u("northAngle", d.northAngle);
            // S40: Apply polygon lot edges from AI extraction
            if (d.lotEdges && Array.isArray(d.lotEdges) && d.lotEdges.length >= 3) {
              var aiEdges = d.lotEdges.map(function(e) {
                var isStreet = (e.type || "property") === "street";
                return { type: e.type || "property", label: isStreet ? (e.label || "") : "", length: e.length || 1, setbackType: e.setbackType || "side", neighborLabel: isStreet ? "" : (e.neighborLabel || e.label || "") };
              });
              u("lotEdges", aiEdges);
              if (d.lotArea) u("lotArea", d.lotArea);
              var verts = window.computePolygonVerts(aiEdges, d.lotArea || null);
              if (verts) u("lotVertices", verts);
            }
            setExtractResult(null);
          }} style={{ flex: 1, padding: "10px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: _mono, cursor: "pointer" }}>{"\u2713"} Apply All Dimensions</button>
          <button onClick={function() { setExtractResult(null); }} style={{ padding: "10px 14px", background: "none", border: "1px solid " + _br.bd, borderRadius: 6, fontSize: 11, fontFamily: _mono, color: _br.mu, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>}

      {/* === PROPERTY INFO (prints on site plan + title block) === */}
      <div style={{ padding: 14, background: _br.wr, borderRadius: 8, border: "1px solid " + _br.bd, marginBottom: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: _br.gn, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Property Information</div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>Property Address</label>
          <input value={info.address} onChange={function(e) { setI("address", e.target.value); }} placeholder="123 Main St" style={{ width: "100%", padding: "7px 10px", border: !info.address ? "1.5px solid #f59e0b" : "1px solid " + _br.bd, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: !info.address ? "#fffbeb" : "#fff", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>City</label>
            <input value={info.city} onChange={function(e) { setI("city", e.target.value); }} placeholder="City" style={{ width: "100%", padding: "7px 10px", border: !info.city ? "1.5px solid #f59e0b" : "1px solid " + _br.bd, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: !info.city ? "#fffbeb" : "#fff", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>State</label>
            <input value={info.state} onChange={function(e) { setI("state", e.target.value); }} placeholder="ST" style={{ width: "100%", padding: "7px 10px", border: !info.state ? "1.5px solid #f59e0b" : "1px solid " + _br.bd, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: !info.state ? "#fffbeb" : "#fff", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>ZIP</label>
            <input value={info.zip} onChange={function(e) { setI("zip", e.target.value); }} placeholder="12345" style={{ width: "100%", padding: "7px 10px", border: !info.zip ? "1.5px solid #f59e0b" : "1px solid " + _br.bd, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: !info.zip ? "#fffbeb" : "#fff", outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>Lot / Parcel #</label>
            <input value={info.lot} onChange={function(e) { setI("lot", e.target.value); }} placeholder="Optional" style={{ width: "100%", padding: "7px 10px", border: "1px solid " + _br.bd, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: "#fff", outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginTop: 6, fontStyle: "italic" }}>This prints on your site plan sheet and title block. You can also edit in the Review step.</div>
        {(() => { var miss = []; if (!info.address) miss.push("Address"); if (!info.city) miss.push("City"); if (!info.state) miss.push("State"); if (!info.zip) miss.push("ZIP"); return miss.length > 0 ? <div style={{ marginTop: 8, padding: "6px 10px", background: "#fff8e1", borderRadius: 4, border: "1px solid #ffe082", borderLeft: "3px solid #f59e0b" }}><span style={{ fontSize: 9, fontFamily: _mono, color: "#d97706", fontWeight: 600 }}>{"\u26A0\uFE0F"} Permit offices typically require: {miss.join(", ")}</span></div> : null; })()}
      </div>

      {/* === SETBACK WARNINGS (always visible) === */}
      {spWarnings.length > 0 && <div style={{ padding: 12, background: "#fff8e1", borderRadius: 8, border: "1px solid #ffe082", marginBottom: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#f57f17", fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>{"\u26A0\uFE0F"} Setback Warnings</div>
        {spWarnings.map(function(w, i) { return <div key={i} style={{ fontSize: 10, color: "#e65100", fontFamily: _mono, lineHeight: 1.6, marginBottom: 2 }}>{"\u2022"} {w}</div>; })}
        <div style={{ fontSize: 8, color: "#f57f17", fontFamily: _mono, marginTop: 6, fontStyle: "italic" }}>Adjust your deck size in Step 2 or setbacks above to resolve.</div>
      </div>}

      {/* === LOT COVERAGE (always visible) === */}
      <div style={{ padding: 10, background: _br.wr, borderRadius: 8, border: "1px solid " + _br.bd }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 9, color: _br.mu, fontFamily: _mono }}>Lot Coverage (house + deck)</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: parseFloat(coveragePct) > 45 ? "#e65100" : _br.gn, fontFamily: _mono }}>{coveragePct}%</span>
        </div>
        <div style={{ height: 4, background: "#e0e0e0", borderRadius: 2, marginTop: 6 }}>
          <div style={{ height: "100%", background: parseFloat(coveragePct) > 45 ? "#ff9800" : _br.gn, borderRadius: 2, width: Math.min(100, parseFloat(coveragePct)) + "%", transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginTop: 4 }}>Most codes cap at 30-50%. Check your local zoning ordinance.</div>
      </div>
    </>;
  }

// Steps 2, 3 unchanged; Step 4 (Review) below
  if (step === 2) return <>
    {/* S49: Guide panel for Step 2 */}
    {guideActive === true && <GuidePanel
      phase={guidePhase}
      onAction={guideHandleAction}
      onBack={guideBack}
      history={guideHistory}
      onToggleOff={function() { setGuideActive(false); }}
    />}
    <Chips label="Joist spacing" field="joistSpacing" opts={[[12, '12" O.C.'], [16, '16" O.C.'], [24, '24" O.C.']]} u={u} p={p} />
    <Chips label="Snow load" field="snowLoad" opts={[["none", "None"], ["light", "Light"], ["moderate", "Moderate"], ["heavy", "Heavy"]]} u={u} p={p} />
    <Chips label="Footing depth (frost line)" field="frostZone" opts={[["warm", '12"'], ["moderate", '24"'], ["cold", '36"'], ["severe", '48"']]} u={u} p={p} />

    <div style={{ marginTop: 16, padding: 14, background: _br.wr, borderRadius: 8, border: `1px solid ${_br.bd}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: _br.gn, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase" }}>Structural Members</div>
        <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono }}>AUTO = IRC recommended</div>
      </div>

      {(() => { const isOver = !!p.overJoist; const val = isOver ? p.overJoist : c.auto.joist; return (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: _br.mu, fontFamily: _mono, fontWeight: 700 }}>JOISTS</span>
            <button onClick={() => u("overJoist", isOver ? null : c.auto.joist)} style={{ fontSize: 8, fontFamily: _mono, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${isOver ? _br.ac : _br.bd}`, background: isOver ? "#fef9e7" : "#fff", color: isOver ? _br.ac : _br.mu, fontWeight: 700 }}>{isOver ? "MANUAL \u270E" : "AUTO \u2713"}</button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["2x6", "2x8", "2x10", "2x12"].map(sz => (
              <button key={sz} onClick={() => isOver && u("overJoist", sz)} style={{ flex: 1, padding: "6px 4px", fontSize: 10, fontFamily: _mono, cursor: isOver ? "pointer" : "default", border: val === sz ? `2px solid ${isOver ? _br.ac : _br.gn}` : `1px solid ${_br.bd}`, background: val === sz ? (isOver ? "#fef9e7" : "#edf5e8") : (isOver ? "#fff" : "#fafafa"), color: val === sz ? (isOver ? _br.ac : _br.gn) : (isOver ? _br.tx : "#ccc"), borderRadius: 5, fontWeight: val === sz ? 700 : 400, opacity: isOver ? 1 : 0.7, textAlign: "center" }}>
                {sz}{!isOver && sz === c.auto.joist && <div style={{ fontSize: 6, color: _br.gn, marginTop: 1 }}>REC</div>}
              </button>
            ))}
          </div>
        </div>
      ); })()}

      {(() => { const isOver = !!p.overBeam; const val = isOver ? p.overBeam : c.auto.beam; const opts = ["2-ply 2x10", "3-ply 2x10", "3-ply 2x12", "3-ply LVL 1.75x12"]; return (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: _br.mu, fontFamily: _mono, fontWeight: 700 }}>BEAM</span>
            <button onClick={() => u("overBeam", isOver ? null : c.auto.beam)} style={{ fontSize: 8, fontFamily: _mono, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${isOver ? _br.ac : _br.bd}`, background: isOver ? "#fef9e7" : "#fff", color: isOver ? _br.ac : _br.mu, fontWeight: 700 }}>{isOver ? "MANUAL \u270E" : "AUTO \u2713"}</button>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {opts.map(sz => { const short = sz.replace("1.75x12", "LVL").replace("-ply ", "\u00D7"); return (
              <button key={sz} onClick={() => isOver && u("overBeam", sz)} style={{ flex: "1 1 auto", padding: "6px 6px", fontSize: 9, fontFamily: _mono, cursor: isOver ? "pointer" : "default", border: val === sz ? `2px solid ${isOver ? _br.ac : _br.gn}` : `1px solid ${_br.bd}`, background: val === sz ? (isOver ? "#fef9e7" : "#edf5e8") : (isOver ? "#fff" : "#fafafa"), color: val === sz ? (isOver ? _br.ac : _br.gn) : (isOver ? _br.tx : "#ccc"), borderRadius: 5, fontWeight: val === sz ? 700 : 400, opacity: isOver ? 1 : 0.7, textAlign: "center" }}>
                {short}{!isOver && sz === c.auto.beam && <div style={{ fontSize: 6, color: _br.gn, marginTop: 1 }}>REC</div>}
              </button>
            ); })}
          </div>
        </div>
      ); })()}

      {(() => { const isOver = !!p.overPostSize; const val = isOver ? p.overPostSize : c.auto.postSize; return (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: _br.mu, fontFamily: _mono, fontWeight: 700 }}>POST SIZE</span>
            <button onClick={() => u("overPostSize", isOver ? null : c.auto.postSize)} style={{ fontSize: 8, fontFamily: _mono, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${isOver ? _br.ac : _br.bd}`, background: isOver ? "#fef9e7" : "#fff", color: isOver ? _br.ac : _br.mu, fontWeight: 700 }}>{isOver ? "MANUAL \u270E" : "AUTO \u2713"}</button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["4x4", "6x6"].map(sz => (
              <button key={sz} onClick={() => isOver && u("overPostSize", sz)} style={{ flex: 1, padding: "6px 4px", fontSize: 10, fontFamily: _mono, cursor: isOver ? "pointer" : "default", border: val === sz ? `2px solid ${isOver ? _br.ac : _br.gn}` : `1px solid ${_br.bd}`, background: val === sz ? (isOver ? "#fef9e7" : "#edf5e8") : (isOver ? "#fff" : "#fafafa"), color: val === sz ? (isOver ? _br.ac : _br.gn) : (isOver ? _br.tx : "#ccc"), borderRadius: 5, fontWeight: val === sz ? 700 : 400, opacity: isOver ? 1 : 0.7, textAlign: "center" }}>
                {sz}{!isOver && sz === c.auto.postSize && <div style={{ fontSize: 6, color: _br.gn, marginTop: 1 }}>REC</div>}
              </button>
            ))}
          </div>
        </div>
      ); })()}

      {(() => { const isOver = !!p.overPostCount; const val = isOver ? p.overPostCount : c.auto.postCount; return (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: _br.mu, fontFamily: _mono, fontWeight: 700 }}>POST COUNT</span>
            <button onClick={() => u("overPostCount", isOver ? null : c.auto.postCount)} style={{ fontSize: 8, fontFamily: _mono, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${isOver ? _br.ac : _br.bd}`, background: isOver ? "#fef9e7" : "#fff", color: isOver ? _br.ac : _br.mu, fontWeight: 700 }}>{isOver ? "MANUAL \u270E" : "AUTO \u2713"}</button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[2, 3, 4, 5, 6].map(n => (
              <button key={n} onClick={() => isOver && u("overPostCount", n)} style={{ flex: 1, padding: "6px 4px", fontSize: 10, fontFamily: _mono, cursor: isOver ? "pointer" : "default", border: val === n ? `2px solid ${isOver ? _br.ac : _br.gn}` : `1px solid ${_br.bd}`, background: val === n ? (isOver ? "#fef9e7" : "#edf5e8") : (isOver ? "#fff" : "#fafafa"), color: val === n ? (isOver ? _br.ac : _br.gn) : (isOver ? _br.tx : "#ccc"), borderRadius: 5, fontWeight: val === n ? 700 : 400, opacity: isOver ? 1 : 0.7, textAlign: "center" }}>
                {n}{!isOver && n === c.auto.postCount && <div style={{ fontSize: 6, color: _br.gn, marginTop: 1 }}>REC</div>}
              </button>
            ))}
          </div>
        </div>
      ); })()}

      {(() => { const isOver = !!p.overFooting; const val = isOver ? p.overFooting : c.auto.footing; return (
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: _br.mu, fontFamily: _mono, fontWeight: 700 }}>FOOTING DIA.</span>
            <button onClick={() => u("overFooting", isOver ? null : c.auto.footing)} style={{ fontSize: 8, fontFamily: _mono, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${isOver ? _br.ac : _br.bd}`, background: isOver ? "#fef9e7" : "#fff", color: isOver ? _br.ac : _br.mu, fontWeight: 700 }}>{isOver ? "MANUAL \u270E" : "AUTO \u2713"}</button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[12, 16, 18, 21, 24, 30].map(d => (
              <button key={d} onClick={() => isOver && u("overFooting", d)} style={{ flex: 1, padding: "6px 2px", fontSize: 9, fontFamily: _mono, cursor: isOver ? "pointer" : "default", border: val === d ? `2px solid ${isOver ? _br.ac : _br.gn}` : `1px solid ${_br.bd}`, background: val === d ? (isOver ? "#fef9e7" : "#edf5e8") : (isOver ? "#fff" : "#fafafa"), color: val === d ? (isOver ? _br.ac : _br.gn) : (isOver ? _br.tx : "#ccc"), borderRadius: 5, fontWeight: val === d ? 700 : 400, opacity: isOver ? 1 : 0.7, textAlign: "center" }}>
                {d}"{!isOver && d === c.auto.footing && <div style={{ fontSize: 6, color: _br.gn, marginTop: 1 }}>REC</div>}
              </button>
            ))}
          </div>
        </div>
      ); })()}

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontFamily: _mono, letterSpacing: 1, color: _br.mu, fontWeight: 700 }}>BEAM TYPE</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["dropped", "flush"].map(bt => (
            <button key={bt} onClick={() => u("beamType", bt)} style={{ flex: 1, padding: "6px 4px", fontSize: 11, fontFamily: _mono, cursor: "pointer", borderRadius: 4, border: `1px solid ${p.beamType === bt ? _br.ac : _br.bd}`, background: p.beamType === bt ? _br.ac : "#fff", color: p.beamType === bt ? "#fff" : _br.mu, fontWeight: p.beamType === bt ? 700 : 400, textTransform: "capitalize" }}>{bt === "dropped" ? "Dropped" : "Flush"}</button>
          ))}
        </div>
        {p.beamType === "flush" && (<div style={{ fontSize: 9, color: _br.mu, marginTop: 4, fontStyle: "italic" }}>Beam sits inline with joists {"\u2014"} requires LUS joist hangers</div>)}
      </div>
      <div style={{ height: 1, background: _br.bd, margin: "10px 0" }} />
      <Spec l="Joist Span" v={`${c.jSpan}'`} /><Spec l="Beam Span" v={`${c.bSpan}'`} /><Spec l="Total Load" v={`${c.TL} PSF`} color={_br.rd} />
      {c.warnings.map((w, i) => <div key={i} style={{ fontSize: 10, color: _br.rd, marginTop: 4, fontFamily: _mono }}>{"\u26A0\uFE0F"} {w}</div>)}
    </div>
  </>;

  if (step === 3) return <>
    {/* S49: Guide panel for Step 3 */}
    {guideActive === true && (() => {
      var s3Msg = null;
      if (guidePhase === 's3_complete') {
        var totalCost = zc ? m.total + zc.extraTotal : m.total;
        s3Msg = "Materials selected! Estimated cost: $" + totalCost.toFixed(0);
      }
      return <GuidePanel
        phase={guidePhase}
        onAction={guideHandleAction}
        onBack={guideBack}
        history={guideHistory}
        onToggleOff={function() { setGuideActive(false); }}
        message={s3Msg}
      />;
    })()}
    <Chips label="Decking" field="deckingType" opts={[["composite", "Composite (Trex)"], ["pt_lumber", "Pressure Treated"]]} u={u} p={p} />
    <Chips label="Railing" field="railType" opts={[["fortress", "Fortress Iron"], ["wood", "Wood"]]} u={u} p={p} />
    <div style={{ marginTop: 16, padding: 14, background: _br.wr, borderRadius: 8, border: `1px solid ${_br.bd}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: _br.gn, marginBottom: 6, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase" }}>Cost Breakdown</div>
      {(() => { var allItems = zc ? m.items.concat(zc.extraItems) : m.items; return ["Foundation", "Posts", "Beam", "Ledger", "Framing", "Hardware", "Decking", "Railing", "Misc"].map(cat => { const t = allItems.filter(i => i.cat === cat).reduce((s, i) => s + i.qty * i.cost, 0); return t > 0 ? <Spec key={cat} l={cat} v={`${t.toFixed(0)}`} /> : null; }); })()}
      <div style={{ height: 2, background: _br.gn, margin: "8px 0", opacity: 0.3 }} />
      <Spec l="Subtotal" v={`${(zc ? m.sub + zc.extraSub : m.sub).toFixed(0)}`} /><Spec l="Tax + Contingency" v={`${(zc ? (m.tax + m.cont) + (zc.extraTotal - zc.extraSub) : (m.tax + m.cont)).toFixed(0)}`} /><Spec l="TOTAL" v={`${(zc ? m.total + zc.extraTotal : m.total).toFixed(0)}`} color={_br.gn} />
      <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, marginTop: 6, fontStyle: "italic" }}>Based on typical national pricing.</div>
    </div>
  </>;

// Step 4: Review (was Step 3 before S27)
  if (step === 4) return <>
    {/* S49: Guide panel for Step 4 */}
    {guideActive === true && (() => {
      var s4Msg = null, s4Tip = null;
      if (guidePhase === 's4_info') {
        var filled = info.address && info.city && info.state;
        if (filled) {
          s4Msg = "Project info was filled from your survey. Verify it looks correct.";
          s4Tip = "Add your name and contractor info if needed.";
        }
      }
      if (guidePhase === 's4_generate') {
        s4Msg = "Ready to generate your permit-ready blueprints!";
        s4Tip = "Click 'Generate Blueprint PDF' below. Your 4-sheet package will be ready in about 30 seconds.";
      }
      return <GuidePanel
        phase={guidePhase}
        onAction={guideHandleAction}
        onBack={guideBack}
        history={guideHistory}
        onToggleOff={function() { setGuideActive(false); }}
        message={s4Msg}
        tip={s4Tip}
      />;
    })()}
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: _br.gn, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Blueprint Preview</div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ flex: "0 0 auto", width: 200, background: "#fff", border: `1px solid ${_br.bd}`, borderRadius: 6, overflow: "hidden", position: "relative" }}>
          <div style={{ padding: "4px 8px", background: _br.wr, borderBottom: `1px solid ${_br.bd}` }}><span style={{ fontSize: 7, fontFamily: _mono, fontWeight: 700, color: _br.mu }}>SHEET A-1 {"\u2014"} DECK PLAN</span></div>
          <div style={{ padding: 4, height: 130 }}>
            <svg viewBox="0 0 200 120" style={{ width: "100%", height: "100%" }}>
              <rect x="30" y="5" width={Math.min(140, c.W * 3.5)} height={15} fill="#e8e6e0" stroke="#888" strokeWidth="0.5" />
              <text x={30 + Math.min(140, c.W * 3.5) / 2} y="14" textAnchor="middle" style={{ fontSize: 4, fill: "#aaa" }}>HOUSE</text>
              <rect x="30" y="20" width={Math.min(140, c.W * 3.5)} height={Math.min(80, c.D * 5)} fill="#efe5d5" stroke="#333" strokeWidth="0.8" />
              {c.attachment === "ledger" && <line x1="30" y1="20" x2={30 + Math.min(140, c.W * 3.5)} y2="20" stroke="#2e7d32" strokeWidth="1.5" />}
              {Array.from({ length: Math.min(20, Math.ceil(c.W / (c.sp / 12))) }, (_, i) => { const x = 30 + (i + 1) * Math.min(140, c.W * 3.5) / Math.ceil(c.W / (c.sp / 12)); return x < 30 + Math.min(140, c.W * 3.5) ? <line key={i} x1={x} y1="21" x2={x} y2={20 + Math.min(80, c.D * 5) - 8} stroke="#ddd" strokeWidth="0.2" /> : null; })}
              <line x1="32" y1={20 + Math.min(80, c.D * 5) - 8} x2={28 + Math.min(140, c.W * 3.5)} y2={20 + Math.min(80, c.D * 5) - 8} stroke="#c4960a" strokeWidth="1.5" />
              {c.pp.map((px, i) => <circle key={i} cx={30 + (px / c.W) * Math.min(140, c.W * 3.5)} cy={20 + Math.min(80, c.D * 5) - 8} r="2" fill="#c4a060" stroke="#444" strokeWidth="0.3" />)}
              <text x={30 + Math.min(140, c.W * 3.5) / 2} y={20 + Math.min(80, c.D * 5) / 2} textAnchor="middle" style={{ fontSize: 5, fill: "#888" }}>{c.joistSize} @ {c.sp}" O.C.</text>
              <text x={30 + Math.min(140, c.W * 3.5) / 2} y={20 + Math.min(80, c.D * 5) + 8} textAnchor="middle" style={{ fontSize: 5, fill: "#c62828", fontWeight: 700 }}>{fmtFtIn(c.W)}</text>
            </svg>
          </div>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><span style={{ fontSize: 22, fontWeight: 900, color: "rgba(61,90,46,0.08)", fontFamily: _mono, transform: "rotate(-20deg)", letterSpacing: 4 }}>PREVIEW</span></div>
        </div>
        <div style={{ flex: "0 0 auto", width: 200, background: "#fff", border: `1px solid ${_br.bd}`, borderRadius: 6, overflow: "hidden", position: "relative" }}>
          <div style={{ padding: "4px 8px", background: _br.wr, borderBottom: `1px solid ${_br.bd}` }}><span style={{ fontSize: 7, fontFamily: _mono, fontWeight: 700, color: _br.mu }}>SHEET A-2 {"\u2014"} ELEVATIONS</span></div>
          <div style={{ padding: 4, height: 130 }}><svg viewBox="0 0 200 120" style={{ width: "100%", height: "100%" }}><line x1="15" y1="85" x2="185" y2="85" stroke="#444" strokeWidth="0.5" />{(() => { const dw = Math.min(150, c.W * 3.5); const dxv = (200 - dw) / 2; const hSc = Math.min(4, 50 / c.H); const dy = 85 - c.H * hSc; return (<><rect x={dxv} y="15" width={dw} height={70} fill="#e8e6e0" stroke="#888" strokeWidth="0.3" /><polygon points={`${dxv-3},15 ${dxv+dw/2},5 ${dxv+dw+3},15`} fill="#888" stroke="#444" strokeWidth="0.3" />{c.pp.map((px, i) => <line key={i} x1={dxv+(px/c.W)*dw} y1="85" x2={dxv+(px/c.W)*dw} y2={dy} stroke="#c4a060" strokeWidth="1" />)}<rect x={dxv+2} y={dy+1} width={dw-4} height={3} fill="#c4960a" fillOpacity="0.8" stroke="#444" strokeWidth="0.2" /><line x1={dxv} y1={dy} x2={dxv+dw} y2={dy} stroke="#6B5340" strokeWidth="1.5" /><line x1={dxv} y1={dy-c.H*hSc*0.4} x2={dxv+dw} y2={dy-c.H*hSc*0.4} stroke="#333" strokeWidth="0.8" /><text x={dxv+dw+4} y={(85+dy)/2+1} style={{ fontSize: 5, fill: "#1565c0", fontWeight: 700 }}>{fmtFtIn(c.H)}</text><text x={dxv+dw/2} y="97" textAnchor="middle" style={{ fontSize: 5, fill: "#c62828", fontWeight: 700 }}>{fmtFtIn(c.W)}</text></>); })()}</svg></div>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><span style={{ fontSize: 22, fontWeight: 900, color: "rgba(61,90,46,0.08)", fontFamily: _mono, transform: "rotate(-20deg)", letterSpacing: 4 }}>PREVIEW</span></div>
        </div>
        <div style={{ flex: "0 0 auto", width: 200, background: "#fff", border: `1px solid ${_br.bd}`, borderRadius: 6, overflow: "hidden", position: "relative" }}>
          <div style={{ padding: "4px 8px", background: _br.wr, borderBottom: `1px solid ${_br.bd}` }}><span style={{ fontSize: 7, fontFamily: _mono, fontWeight: 700, color: _br.mu }}>SHEET A-3 {"\u2014"} DETAILS</span></div>
          <div style={{ padding: 8, height: 130, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 4 }}>
            {[{ t: "LEDGER DETAIL", lines: [[10,30,10,80],[10,30,60,30],[20,30,20,80],[30,35,30,75],[40,35,40,75]] },{ t: "FOOTING DETAIL", lines: [[25,20,25,70],[45,20,45,70],[25,70,45,70],[30,15,40,15],[30,15,30,20],[40,15,40,20]] },{ t: "GUARD RAIL", lines: [[5,65,65,65],[5,15,65,15],[5,15,5,65],[65,15,65,65]] },{ t: "POST / BEAM", lines: [[25,80,25,30],[45,80,45,30],[10,30,60,30],[10,25,60,25]] }].map((detail, di) => (
              <div key={di} style={{ background: "#fcfcfa", border: `0.5px solid ${_br.bd}`, borderRadius: 3, position: "relative", overflow: "hidden" }}><svg viewBox="0 0 70 90" style={{ width: "100%", height: "100%" }}>{detail.lines.map(([x1,y1,x2,y2], li) => <line key={li} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#bbb" strokeWidth="0.5" />)}<text x="35" y="87" textAnchor="middle" style={{ fontSize: 4.5, fill: "#aaa", fontWeight: 600 }}>{detail.t}</text></svg></div>
            ))}
          </div>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><span style={{ fontSize: 22, fontWeight: 900, color: "rgba(61,90,46,0.08)", fontFamily: _mono, transform: "rotate(-20deg)", letterSpacing: 4 }}>PREVIEW</span></div>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 6 }}><span style={{ fontSize: 8, color: _br.mu, fontFamily: _mono }}>4 sheets included {"\u00B7"} Plan {"\u00B7"} Elevations {"\u00B7"} Details {"\u00B7"} Materials</span></div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
      <div style={{ padding: 12, background: _br.wr, borderRadius: 8, border: `1px solid ${_br.bd}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: _br.gn, marginBottom: 6, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase" }}>Project</div>
        <Spec l="Size" v={`${fmtFtIn(c.W)}\u00D7${fmtFtIn(c.D)} (${zc ? zc.totalArea : c.area} SF)`} /><Spec l="Height" v={fmtFtIn(c.H)} /><Spec l="Attach" v={c.attachment === "ledger" ? "Ledger" : "Free"} /><Spec l="Stairs" v={p.hasStairs ? `${p.stairLocation} ${fmtFtIn(p.stairWidth || 4)} \u00B7 ${p.numStringers || 3} stringers${p.hasLanding ? " \u00B7 landing" : ""}` : "None"} /><Spec l="Deck" v={p.deckingType === "composite" ? "Composite" : "PT"} /><Spec l="Rail" v={p.railType === "fortress" ? "Fortress" : "Wood"} />
      </div>
      <div style={{ padding: 12, background: _br.wr, borderRadius: 8, border: `1px solid ${_br.bd}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: _br.gn, marginBottom: 6, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase" }}>Structure</div>
        <Spec l="Joists" v={`${c.joistSize}@${c.sp}"`} /><Spec l="Beam" v={c.beamSize.replace("3-ply ","3\u00D7").replace("2-ply ","2\u00D7")} /><Spec l="Posts" v={`${c.postSize}\u00D7${zc ? c.nP + zc.extraPosts : c.nP}`} /><Spec l="Footings" v={`${c.fDiam}"\u00D8\u00D7${c.nF}`} /><Spec l="Load" v={`${c.TL} PSF`} color={_br.rd} />
        {c.warnings.length > 0 && <div style={{ fontSize: 8, color: _br.rd, marginTop: 4, fontFamily: _mono }}>{"\u26A0\uFE0F"} {c.warnings.length} warning{c.warnings.length > 1 ? "s" : ""}</div>}
      </div>
    </div>

    <div style={{ padding: 14, background: _br.wr, borderRadius: 8, border: `1px solid ${_br.bd}`, marginBottom: 14 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: _br.gn, marginBottom: 10, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase" }}>Project Information <span style={{ fontWeight: 400, color: _br.mu, fontSize: 8 }}>(prints on title block)</span></div>
      {[["owner", "Owner / Applicant Name"],["address", "Project Address"],["city", "City"]].map(([f, lbl]) => (
        <div key={f} style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>{lbl}</label>
          <input value={info[f]} onChange={e => setI(f, e.target.value)} placeholder={lbl} style={{ width: "100%", padding: "7px 10px", border: !info[f] ? "1.5px solid #f59e0b" : "1px solid " + _br.bd, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: !info[f] ? "#fffbeb" : "#fff", outline: "none" }} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>State</label><input value={info.state} onChange={e => setI("state", e.target.value)} placeholder="State" style={{ width: "100%", padding: "7px 10px", border: !info.state ? "1.5px solid #f59e0b" : "1px solid " + _br.bd, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: !info.state ? "#fffbeb" : "#fff", outline: "none" }} /></div>
        <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>ZIP</label><input value={info.zip} onChange={e => setI("zip", e.target.value)} placeholder="ZIP" style={{ width: "100%", padding: "7px 10px", border: !info.zip ? "1.5px solid #f59e0b" : "1px solid " + _br.bd, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: !info.zip ? "#fffbeb" : "#fff", outline: "none" }} /></div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>Lot / Parcel #</label><input value={info.lot} onChange={e => setI("lot", e.target.value)} placeholder="Optional" style={{ width: "100%", padding: "7px 10px", border: `1px solid ${_br.bd}`, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: "#fff", outline: "none" }} /></div>
        <div style={{ flex: 1 }}><label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>Contractor</label><input value={info.contractor} onChange={e => setI("contractor", e.target.value)} placeholder="Owner-Builder" style={{ width: "100%", padding: "7px 10px", border: `1px solid ${_br.bd}`, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: "#fff", outline: "none" }} /></div>
      </div>
    </div>

    {/* S50: PPRBD Deck Attachment Sheet checklist (PPRBD jurisdiction only) */}
    {(() => {
      if (!_isPPRBD) return null;

      var heightIn = (p.height || 4) * 12;
      var footingDepth = c.footing_depth || 36;
      var isDetached = p.attachmentType === "freestanding";
      var jcl = p.jurisdictionChecklist || {};

      // autoVal: true/false = we can determine from config, null = user must answer
      var items = [
        { key: "cover", label: "Deck design includes a solid cover or pergola style cover", autoVal: null },
        { key: "electrical", label: "Electrical service and meter location may be affected by deck", autoVal: null },
        { key: "hottub", label: "Deck supports hot tub or spa loading", autoVal: null },
        { key: "cantilever", label: "Deck is supported by cantilever at house (existing inverted hanger installation verified or engineering provided)", autoVal: null },
        { key: "under18", label: "Walking surface less than 18\" above grade", autoVal: heightIn <= 18 },
        { key: "over8ft", label: "Walking surface 8'0\" or more above grade", autoVal: heightIn >= 96 },
        { key: "freestanding", label: "Deck is freestanding and not attached to a structure (detached)", autoVal: isDetached },
        { key: "excavation", label: "Proposed excavation or vertical penetration greater than 3'-0\" in depth", autoVal: footingDepth > 36 }
      ];

      var setItem = function(key, newVal) {
        var updated = Object.assign({}, jcl);
        updated[key] = newVal;
        u("jurisdictionChecklist", updated);
      };

      var unansweredCount = 0;
      items.forEach(function(item) {
        var resolved = jcl.hasOwnProperty(item.key) ? jcl[item.key] : item.autoVal;
        if (resolved === null || resolved === undefined) unansweredCount++;
      });

      return <div style={{ padding: 16, background: "#f0f7ff", borderRadius: 8, border: unansweredCount > 0 ? "1.5px solid #f59e0b" : "1px solid #bbdefb", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#1565c0", fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase" }}>PPRBD Deck Attachment Sheet</div>
          <span style={{ fontSize: 8, color: "#64b5f6", fontFamily: _mono, fontWeight: 400 }}>Pikes Peak Region</span>
        </div>
        <div style={{ fontSize: 9, color: "#5c6b7a", fontFamily: _mono, marginBottom: 12, lineHeight: 1.5 }}>
          Pikes Peak Regional Building Dept. requires this checklist with all deck permits in El Paso County and Woodland Park. Items marked with a green check were auto-filled from your design. Please answer the remaining items or skip when generating.
        </div>
        {unansweredCount > 0 && <div style={{ padding: "6px 10px", background: "#fff8e1", borderRadius: 4, border: "1px solid #ffe082", borderLeft: "3px solid #f59e0b", marginBottom: 12 }}>
          <span style={{ fontSize: 9, fontFamily: _mono, color: "#d97706", fontWeight: 600 }}>{unansweredCount} item{unansweredCount > 1 ? "s" : ""} still need{unansweredCount === 1 ? "s" : ""} your answer</span>
        </div>}
        <div style={{ display: "flex", gap: 24, marginBottom: 8, paddingLeft: 2 }}>
          <span style={{ fontSize: 8, fontFamily: _mono, fontWeight: 700, color: "#1565c0", width: 30, textAlign: "center" }}>YES</span>
          <span style={{ fontSize: 8, fontFamily: _mono, fontWeight: 700, color: "#1565c0", width: 30, textAlign: "center" }}>NO</span>
        </div>
        {items.map(function(item) {
          var val = jcl.hasOwnProperty(item.key) ? jcl[item.key] : item.autoVal;
          var isUnanswered = val === null || val === undefined;
          var isAutoFilled = !jcl.hasOwnProperty(item.key) && item.autoVal !== null;
          return <div key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, paddingLeft: 2, padding: "4px 2px", borderRadius: 4, background: isUnanswered ? "#fff8e1" : "transparent" }}>
            <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
              <button onClick={function() { setItem(item.key, true); }} style={{
                width: 30, height: 20, borderRadius: 3, cursor: "pointer",
                border: val === true ? "2px solid #1565c0" : isUnanswered ? "1.5px solid #f59e0b" : "1px solid #bbb",
                background: val === true ? "#e3f2fd" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 900, color: "#1565c0", fontFamily: _mono
              }}>{val === true ? "X" : ""}</button>
              <button onClick={function() { setItem(item.key, false); }} style={{
                width: 30, height: 20, borderRadius: 3, cursor: "pointer",
                border: val === false ? "2px solid #1565c0" : isUnanswered ? "1.5px solid #f59e0b" : "1px solid #bbb",
                background: val === false ? "#e3f2fd" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 900, color: "#1565c0", fontFamily: _mono
              }}>{val === false ? "X" : ""}</button>
            </div>
            <span style={{ fontSize: 9, fontFamily: _mono, color: _br.tx, lineHeight: 1.5, paddingTop: 2 }}>
              {item.label}
              {isAutoFilled && <span style={{ color: "#2e7d32", fontSize: 7, marginLeft: 4 }}>(auto-filled)</span>}
            </span>
          </div>;
        })}
      </div>;
    })()}

    {isProduction && !feedbackDone && <div style={{ padding: 16, background: "#fff8e1", borderRadius: 8, border: "1px solid #ffe082", marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#f57f17", fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Quick Feedback <span style={{ fontWeight: 400, color: "#ffa000", fontSize: 8 }}>(helps us build what you need)</span></div>
      <div style={{ marginBottom: 8 }}><label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>I am a...</label><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{[["diy","DIY Homeowner"],["contractor","Contractor"],["designer","Designer"],["other","Other"]].map(([v,t])=>(<button key={v} onClick={()=>setFeedback(f=>({...f,role:v}))} style={{padding:"5px 12px",borderRadius:5,fontSize:10,fontFamily:_mono,cursor:"pointer",border:feedback.role===v?"2px solid #f57f17":"1px solid "+_br.bd,background:feedback.role===v?"#fff3e0":"#fff",color:feedback.role===v?"#e65100":_br.tx,fontWeight:feedback.role===v?700:400}}>{t}</button>))}</div></div>
      <div style={{ marginBottom: 8 }}><label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>How did you find us?</label><input value={feedback.source} onChange={e=>setFeedback(f=>({...f,source:e.target.value}))} placeholder="Google, Reddit, friend, etc." style={{width:"100%",padding:"6px 10px",border:"1px solid "+_br.bd,borderRadius:5,fontSize:11,fontFamily:_mono,color:_br.tx,background:"#fff",outline:"none"}} /></div>
      <div style={{ marginBottom: 8 }}><label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>What would you pay for this?</label><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{[["$0","$0"],["$25-49","$25\u201349"],["$50-99","$50\u201399"],["$100+","$100+"]].map(([v,t])=>(<button key={v} onClick={()=>setFeedback(f=>({...f,price:v}))} style={{padding:"5px 12px",borderRadius:5,fontSize:10,fontFamily:_mono,cursor:"pointer",border:feedback.price===v?"2px solid #f57f17":"1px solid "+_br.bd,background:feedback.price===v?"#fff3e0":"#fff",color:feedback.price===v?"#e65100":_br.tx,fontWeight:feedback.price===v?700:400}}>{t}</button>))}</div></div>
      <div style={{ marginBottom: 8 }}><label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>Anything confusing or missing? <span style={{ color: "#bbb" }}>(optional)</span></label><textarea value={feedback.feedback} onChange={e=>setFeedback(f=>({...f,feedback:e.target.value}))} placeholder="Your thoughts..." rows={2} style={{width:"100%",padding:"6px 10px",border:"1px solid "+_br.bd,borderRadius:5,fontSize:11,fontFamily:_mono,color:_br.tx,background:"#fff",outline:"none",resize:"vertical"}} /></div>
      <div style={{ marginBottom: 10 }}><label style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, display: "block", marginBottom: 2 }}>Email <span style={{ color: "#bbb" }}>(optional)</span></label><input type="email" value={feedback.email} onChange={e=>setFeedback(f=>({...f,email:e.target.value}))} placeholder="you@example.com" style={{width:"100%",padding:"6px 10px",border:"1px solid "+_br.bd,borderRadius:5,fontSize:11,fontFamily:_mono,color:_br.tx,background:"#fff",outline:"none"}} /></div>
      <button onClick={submitFeedback} disabled={!feedback.role||!feedback.price} style={{padding:"8px 20px",background:!feedback.role||!feedback.price?"#ccc":"#f57f17",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:!feedback.role||!feedback.price?"default":"pointer",fontFamily:_mono}}>Submit Feedback</button>
      <span style={{ fontSize: 8, color: "#bbb", fontFamily: _mono, marginLeft: 8 }}>Required to generate on this domain</span>
    </div>}
    {isProduction && feedbackDone && <div style={{padding:10,background:"#e8f5e9",borderRadius:8,border:"1px solid #c8e6c9",marginBottom:14,textAlign:"center"}}><span style={{fontSize:11,color:"#2e7d32",fontFamily:_mono,fontWeight:700}}>{"\u2713"} Thanks for your feedback!</span></div>}

    <div style={{padding:16,background:"#e8f5e9",borderRadius:8,border:"1px solid #c8e6c9",textAlign:"center",marginBottom:10}}>
      <div style={{fontSize:10,fontFamily:_mono,color:_br.gn,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase"}}>Estimated Materials</div>
      <div style={{fontSize:36,fontWeight:900,color:_br.gn,fontFamily:_mono}}>${(zc ? m.total + zc.extraTotal : m.total).toFixed(0)}</div>
      <div style={{fontSize:10,color:"#66bb6a",fontFamily:_mono}}>Includes tax + 5% contingency</div>
    </div>

    <div style={{background:_br.dk,borderRadius:10,padding:20,textAlign:"center",marginBottom:10}}>
      <div style={{fontSize:10,fontFamily:_mono,color:"rgba(255,255,255,0.5)",letterSpacing:"2px",textTransform:"uppercase",marginBottom:6}}>Your Blueprint Package</div>
      <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:12,flexWrap:"wrap"}}>
        {["Plan View","Framing Plan","Elevations","Details","Site Plan"].concat(
          _isPPRBD ? ["PPRBD Attachment"] : []
        ).map(s=>(<div key={s} style={{display:"flex",alignItems:"center",gap:4}}><span style={{color:"#66bb6a",fontSize:11}}>{"\u2713"}</span><span style={{fontSize:10,fontFamily:_mono,color:"rgba(255,255,255,0.8)"}}>{s}</span></div>))}
      </div>
      <div style={{fontSize:8,color:"rgba(255,255,255,0.35)",fontFamily:_mono,marginBottom:12}}>Materials & Cost Estimate included as separate download</div>
      {user ? <>
      <button onClick={function(){var miss=[];if(!info.owner)miss.push("Owner / Applicant Name");if(!info.address)miss.push("Property Address");if(!info.city)miss.push("City");if(!info.state)miss.push("State");if(!info.zip)miss.push("ZIP");if(miss.length>0&&!missingFieldsAcked){setShowMissingModal(miss);return;}if(_isPPRBD&&!pprbdChecklistAcked){var jcl=p.jurisdictionChecklist||{};var hIn=(p.height||4)*12;var fDep=c.footing_depth||36;var isDet=p.attachmentType==="freestanding";var autos={under18:hIn<=18,over8ft:hIn>=96,freestanding:isDet,excavation:fDep>36};var uKeys=[];["cover","electrical","hottub","cantilever","under18","over8ft","freestanding","excavation"].forEach(function(k){var v=jcl.hasOwnProperty(k)?jcl[k]:(autos.hasOwnProperty(k)?autos[k]:null);if(v===null||v===undefined)uKeys.push(k);});if(uKeys.length>0){setShowPprbdModal(uKeys);return;}}disclaimerAcked?generateBlueprint():setShowDisclaimer(true);}} disabled={genStatus==="generating"||(isProduction&&!feedbackDone)} style={{padding:"14px 40px",background:genStatus==="generating"?"#555":genStatus==="done"?"#2e7d32":_br.gn,color:"#fff",border:"none",borderRadius:8,fontSize:16,fontWeight:800,cursor:genStatus==="generating"?"wait":"pointer",fontFamily:_mono,letterSpacing:"1px",boxShadow:"0 4px 20px rgba(61,90,46,0.4)",transition:"all 0.2s"}}>
        {genStatus==="generating"?"Generating PDF...":genStatus==="done"?"\u2713 Download Complete \u2014 Generate Again?":"Generate Blueprint \u2014 FREE BETA"}
      </button>
      {genStatus==="error"&&<div style={{fontSize:10,color:"#f44336",fontFamily:_mono,marginTop:8}}>Error: {genError}</div>}
      {genStatus==="done" && materialsUrl ? <div style={{marginTop:10}}>
        <div style={{fontSize:8,color:"rgba(255,255,255,0.5)",fontFamily:_mono,marginBottom:6}}>Permit plans opened in new tab</div>
        <a href={materialsUrl} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.25)",borderRadius:6,color:"#fff",fontSize:11,fontFamily:_mono,fontWeight:600,textDecoration:"none",cursor:"pointer"}}>
          {"\u2193"} Materials & Cost Estimate
        </a>
      </div> : <div style={{fontSize:8,color:"rgba(255,255,255,0.4)",fontFamily:_mono,marginTop:8}}>{genStatus==="done"?"PDF opened in new tab":"Instant PDF download \u00B7 Print-ready quality \u00B7 Permit-office format"}</div>}
      </> : <div style={{textAlign:"center"}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",fontFamily:_mono,marginBottom:12}}>Sign in to generate your blueprint</div>
        <button onClick={()=>{window.location.href=`${API}/auth/login`;}} style={{padding:"12px 32px",background:"#fff",color:"#333",border:"none",borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:_mono,display:"inline-flex",alignItems:"center",gap:10,boxShadow:"0 2px 12px rgba(0,0,0,0.15)"}}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.04 24.04 0 000 21.56l7.98-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Sign in with Google
        </button>
      </div>}
    </div>

    {showDisclaimer && <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>setShowDisclaimer(false)}>
      <div style={{background:"#fff",borderRadius:12,padding:28,maxWidth:440,margin:"0 20px",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:11,fontWeight:700,color:_br.gn,fontFamily:_mono,letterSpacing:"1px",textTransform:"uppercase",marginBottom:14}}>Before You Download</div>
        <p style={{fontSize:12,color:_br.tx,fontFamily:_sans,lineHeight:1.7,margin:"0 0 10px"}}>SimpleBlueprints generates draft deck plans to assist with the permitting process. By downloading, you acknowledge that:</p>
        <ul style={{fontSize:11,color:_br.tx,fontFamily:_sans,lineHeight:1.8,margin:"0 0 18px",paddingLeft:18}}>
          <li>All deck projects require review and approval by your local building department before construction.</li>
          <li>Plans should be verified for accuracy before submission.</li>
          <li>This tool is a drafting aid and does not constitute professional engineering certification.</li>
        </ul>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={()=>setShowDisclaimer(false)} style={{padding:"10px 18px",background:"none",border:"1px solid "+_br.bd,borderRadius:6,fontSize:11,fontFamily:_mono,color:_br.mu,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>{setDisclaimerAcked(true);setShowDisclaimer(false);generateBlueprint();}} style={{padding:"10px 24px",background:_br.gn,border:"none",borderRadius:6,fontSize:11,fontFamily:_mono,color:"#fff",fontWeight:700,cursor:"pointer",boxShadow:"0 2px 12px rgba(61,90,46,0.3)"}}>I Understand {"\u2014"} Generate Blueprint</button>
        </div>
      </div>
    </div>}

    {showMissingModal && <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>setShowMissingModal(false)}>
      <div style={{background:"#fff",borderRadius:12,padding:28,maxWidth:440,margin:"0 20px",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:11,fontWeight:700,color:"#d97706",fontFamily:_mono,letterSpacing:"1px",textTransform:"uppercase",marginBottom:14}}>{"\u26A0\uFE0F"} Missing Information</div>
        <p style={{fontSize:12,color:_br.tx,fontFamily:_sans,lineHeight:1.7,margin:"0 0 10px"}}>Permit offices typically require the following fields, which are currently empty:</p>
        <div style={{padding:"10px 14px",background:"#fff8e1",borderRadius:6,border:"1px solid #ffe082",marginBottom:14}}>
          {showMissingModal.map(function(f,i){return <div key={i} style={{fontSize:11,fontFamily:_mono,color:"#92400e",lineHeight:1.8,fontWeight:600}}>{"\u2022"} {f}</div>;})}
        </div>
        <p style={{fontSize:11,color:_br.mu,fontFamily:_sans,lineHeight:1.6,margin:"0 0 18px"}}>You can fill these in using the Project Information section above, or generate your blueprint without them.</p>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={function(){setShowMissingModal(false);}} style={{padding:"10px 18px",background:"none",border:"1px solid "+_br.bd,borderRadius:6,fontSize:11,fontFamily:_mono,color:_br.mu,cursor:"pointer"}}>Fill in Fields</button>
          <button onClick={function(){setMissingFieldsAcked(true);setShowMissingModal(false);disclaimerAcked?generateBlueprint():setShowDisclaimer(true);}} style={{padding:"10px 24px",background:"#d97706",border:"none",borderRadius:6,fontSize:11,fontFamily:_mono,color:"#fff",fontWeight:700,cursor:"pointer"}}>Generate Anyway</button>
        </div>
      </div>
    </div>}

    {showPprbdModal && <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>setShowPprbdModal(false)}>
      <div style={{background:"#fff",borderRadius:12,padding:28,maxWidth:440,margin:"0 20px",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:11,fontWeight:700,color:"#1565c0",fontFamily:_mono,letterSpacing:"1px",textTransform:"uppercase",marginBottom:14}}>{"\u26A0\uFE0F"} PPRBD Checklist Incomplete</div>
        <p style={{fontSize:12,color:_br.tx,fontFamily:_sans,lineHeight:1.7,margin:"0 0 10px"}}>Your property is in PPRBD jurisdiction. The Deck Attachment Sheet has {showPprbdModal.length} unanswered item{showPprbdModal.length > 1 ? "s" : ""}. The permit office will need these filled in.</p>
        <p style={{fontSize:11,color:_br.mu,fontFamily:_sans,lineHeight:1.6,margin:"0 0 18px"}}>You can answer them now in the checklist above, or skip and fill them in by hand after printing.</p>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={function(){setShowPprbdModal(false);}} style={{padding:"10px 18px",background:"none",border:"1px solid "+_br.bd,borderRadius:6,fontSize:11,fontFamily:_mono,color:_br.mu,cursor:"pointer"}}>Answer Items</button>
          <button onClick={function(){setPprbdChecklistAcked(true);setShowPprbdModal(false);disclaimerAcked?generateBlueprint():setShowDisclaimer(true);}} style={{padding:"10px 24px",background:"#1565c0",border:"none",borderRadius:6,fontSize:11,fontFamily:_mono,color:"#fff",fontWeight:700,cursor:"pointer"}}>Skip & Generate</button>
        </div>
      </div>
    </div>}
  </>;

  return null;
}

window.StepContent = StepContent;
