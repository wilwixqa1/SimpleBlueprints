// ============================================================
// WIZARD STEPS   Step 0 (Site Plan), Step 1 (Size), Step 2 (Structure),
//                Step 3 (Finishes), Step 4 (Review)
// Multi-zone support added S19, Site Plan step added S27
// S28: Unified Step 0 flow (Site Plan first, sliders + collapsible upload)
// ============================================================
const { useState: _stUS, useEffect: _stUE, useMemo: _stUM } = React;
const { br: _br, mono: _mono, sans: _sans } = window.SB;

// S56: Client-side image resize for AI helper reference photos
function _resizeImageFile(file, maxDim, callback) {
  maxDim = maxDim || 1024;
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      var canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      var b64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
      callback({ b64: b64, mediaType: "image/jpeg", thumbUrl: canvas.toDataURL("image/jpeg", 0.5) });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// S56: Handle paste/drop image from clipboard
function _imageFromClipboard(items, callback) {
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") >= 0) {
      var file = items[i].getAsFile();
      if (file) { _resizeImageFile(file, 1024, callback); return true; }
    }
  }
  return false;
}

// S47: Survey preview component with page navigation (pdf.js for PDFs, img for images)
function SurveyPreview({ b64, fileType }) {
  var _s = _stUS(null), src = _s[0], setSrc = _s[1];
  // S52: Start on site plan page if detected
  var initPage = (window._sitePageIndex || 0) + 1;  // 0-indexed -> 1-indexed
  var _p = _stUS(initPage), page = _p[0], setPage = _p[1];
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

// S54: Simple markdown renderer for chat messages (bold, italic)
function _renderChatText(text) {
  if (!text) return null;
  // Split by bold (**text**) and italic (*text*) markers
  var parts = [];
  var re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  var lastIdx = 0;
  var match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    if (match[2]) parts.push(React.createElement("strong", { key: "b" + match.index }, match[2]));
    else if (match[3]) parts.push(React.createElement("em", { key: "i" + match.index }, match[3]));
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length > 0 ? parts : text;
}

// S54: Phase-aware placeholder hints for chat input
var _chatPlaceholders = {
  has_survey: "Ask me anything, or describe what you want",
  upload_survey: "",
  extracting: "",
  shape_select: "",
  verify_extracted: "e.g. The lot is actually 80 feet wide",
  lot_dims: "e.g. My lot is 75 by 150",
  house_position: "e.g. The house is 20 feet from the left line",
  setbacks: "e.g. What are typical setbacks?",
  site_elements_check: "e.g. I also have a pool out back",
  north_arrow: "e.g. North is to the upper right",
  slope: "e.g. My yard slopes about 3% toward the back",
  s1_deck_size: "e.g. I want my deck to be 20 by 14",
  s1_attachment: "e.g. What's a ledger board?",
  s1_stairs: "e.g. I need stairs on the left side",
  s2_environment: "e.g. We get heavy snow here",
  s2_review: "e.g. Can I use 4x4 posts instead?",
  s3_materials: "e.g. How much more is composite?",
  s4_info: "e.g. Do I need a contractor name?",
  s4_generate: "e.g. Does this meet code?"
};

// S53: Rotate lot vertices to match survey orientation for display
// Shapes are generated with street at bottom. This rotates around centroid.
// hFlip mirrors left-right, vFlip mirrors top-bottom.
function _rotateVertsForDisplay(verts, streetSide, hFlip, vFlip) {
  var result = verts;
  if (streetSide && streetSide !== "bottom") {
    var cx = 0, cy = 0;
    for (var i = 0; i < result.length; i++) { cx += result[i][0]; cy += result[i][1]; }
    cx /= result.length; cy /= result.length;
    // CCW pi/2 moves bottom to right, CW -pi/2 moves bottom to left, pi moves bottom to top
    var angles = { top: Math.PI, right: Math.PI / 2, left: -Math.PI / 2 };
    var theta = angles[streetSide] || 0;
    if (theta !== 0) {
      var cosT = Math.cos(theta), sinT = Math.sin(theta);
      result = result.map(function(v) {
        var dx = v[0] - cx, dy = v[1] - cy;
        return [cx + dx * cosT - dy * sinT, cy + dx * sinT + dy * cosT];
      });
    }
  }
  if (hFlip || vFlip) {
    var fcx = 0, fcy = 0;
    for (var j = 0; j < result.length; j++) { fcx += result[j][0]; fcy += result[j][1]; }
    fcx /= result.length; fcy /= result.length;
    result = result.map(function(v) {
      return [hFlip ? 2 * fcx - v[0] : v[0], vFlip ? 2 * fcy - v[1] : v[1]];
    });
  }
  return result;
}
window._rotateVertsForDisplay = _rotateVertsForDisplay;

// S48: Shape cards for compare view with preview selection
function CompareShapes({ candidates, previewIdx, streetSide, hFlip, vFlip }) {
  if (!candidates || candidates.length === 0) return React.createElement("div", { style: { fontSize: 10, color: _br.mu, fontFamily: _mono } }, "No shapes available");
  var edgeColors = ["#e53935", "#2563eb", "#8B7355", "#7c3aed", "#0d9488"];
  return React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 } },
    candidates.map(function(cand, ci) {
      var isSelected = previewIdx === ci;
      var cv = _rotateVertsForDisplay(cand.vertices, streetSide, hFlip, vFlip);
      // Compute bounding box from rotated vertices
      var cminX = Infinity, cminY = Infinity, cmaxX = -Infinity, cmaxY = -Infinity;
      cv.forEach(function(v) { if (v[0] < cminX) cminX = v[0]; if (v[1] < cminY) cminY = v[1]; if (v[0] > cmaxX) cmaxX = v[0]; if (v[1] > cmaxY) cmaxY = v[1]; });
      var cw = cmaxX - cminX, ch = cmaxY - cminY;
      var cpad = Math.max(cw, ch) * 0.12;
      var cvbW = cw + cpad * 2, cvbH = ch + cpad * 2;
      var cpts = cv.map(function(v) { return (v[0] - cminX + cpad).toFixed(1) + "," + (cvbH - (v[1] - cminY) - cpad).toFixed(1); }).join(" ");
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
              var mx = (v[0] + v2[0]) / 2 - cminX + cpad;
              var my = cvbH - ((v[1] + v2[1]) / 2 - cminY) - cpad;
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
  // S65: Local state for instant slider feedback; debounced u() for expensive re-renders
  var [localVal, setLocalVal] = _stUS(value);
  var _timerRef = React.useRef(null);
  var _dragging = React.useRef(false);
  var _latestVal = React.useRef(value);
  // Sync from parent when not dragging
  _stUE(function() { if (!_dragging.current) { setLocalVal(value); _latestVal.current = value; } }, [value]);
  var _onSlide = function(e) {
    var v = Number(e.target.value);
    _latestVal.current = v;
    setLocalVal(v);
    _dragging.current = true;
    clearTimeout(_timerRef.current);
    _timerRef.current = setTimeout(function() { _dragging.current = false; u(field, v); }, 120);
  };
  var _onRelease = function() {
    if (_timerRef.current) { clearTimeout(_timerRef.current); _timerRef.current = null; }
    _dragging.current = false;
    u(field, _latestVal.current);
  };
  _stUE(function() { return function() { clearTimeout(_timerRef.current); }; }, []);
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
        <input type="range" min={min} max={max} step={s} value={localVal} onChange={_onSlide} onMouseUp={_onRelease} onTouchEnd={_onRelease} style={{ flex: 1, accentColor: _br.gn, height: 6 }} />
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
  // S85 UX: the address form shows IMMEDIATELY. Previously this phase had no
  // sections and a single 'Look up by address' action button -- the screen
  // said "start with your property address" but the only visible input was
  // the AI chat, so users typed their address into the chat. One mandatory
  // button between the user and the promised action is pure friction.
  {
    id: 'has_survey',
    message: "Let's start with your property address.",
    tip: "We'll pull your lot shape, dimensions, and zoning directly from public records. Need to upload a survey or enter manually? Use 'Switch to manual' below.",
    sections: ['addressLookup'],
    actions: []
  },
  // --- ADDRESS LOOKUP PATH ---
  {
    id: 'address_lookup',
    message: "Enter your property address.",
    tip: "We will look up your lot shape, dimensions, and house position from public records.",
    sections: ['addressLookup'],
    actions: []
  },
  {
    id: 'address_verifying',
    message: "Looking up your property...",
    tip: "Searching public parcel records.",
    sections: ['addressLookup'],
    actions: []
  },
  {
    id: 'footprint_loading',
    message: "Detecting your house...",
    tip: "Finding building footprint, orientation, and position from satellite data.",
    sections: [],
    actions: []
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
    // S96.5: sections was [] -- so on this screen the address form was not in
    // the DOM at all and there was NO way to look up a different address
    // (guideSectionShown renders only the sections the phase declares).
    // Keeping 'addressLookup' here makes re-lookup always reachable.
    id: 'verify_extracted',
    message: "Here is what we found. Do these numbers look right?",
    tip: "Check the preview on the right. Adjust any values that seem off, or enter a different address to start over.",
    sections: ['addressLookup'],
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
      { label: 'Continue', next: 'north_arrow', style: 'primary' }
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
    message: "Ready to generate your blueprint package!",
    tip: "Click the button below to create your PDF blueprint package.",
    sections: [],
    actions: []
  }
];
GUIDE_PHASES_STEP4.forEach(function(ph) { _guidePhaseMap[ph.id] = ph; });
var _guideStep4Order = GUIDE_PHASES_STEP4.map(function(ph) { return ph.id; });

// GuidePanel: embedded guide at top of wizard step
function GuidePanel({ phase, onAction, onBack, history, onToggleOff, message, tip, chatMessages, chatLoading, onSendMessage, onApplyActions, setChatMessages }) {
  var ph = _guidePhaseMap[phase];
  if (!ph) return null;

  var chatInputRef = React.useRef(null);
  var fileInputRef = React.useRef(null);

  // S56: Pending image attachment state
  var _imgState = _stUS(null);
  var pendingImage = _imgState[0], setPendingImage = _imgState[1];

  function _handleImageFile(file) {
    if (!file || file.type.indexOf("image") < 0) return;
    if (file.size > 20 * 1024 * 1024) { alert("Image too large (max 20MB)"); return; }
    _resizeImageFile(file, 1024, function(data) { setPendingImage(data); });
  }

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

  function handleChatSubmit(e) {
    if (e) e.preventDefault();
    var input = chatInputRef.current;
    var msg = (input && input.value.trim()) || "";
    // S56: Allow image-only messages (no text required if image attached)
    if (!msg && !pendingImage) return;
    if (chatLoading) return;
    if (!msg && pendingImage) msg = "Here's a reference photo of what I'm looking for.";
    if (input) { input.value = ""; input.style.height = ""; }
    var imgData = pendingImage;
    setPendingImage(null);
    if (onSendMessage) onSendMessage(msg, imgData);
  }

  return <div style={{
    marginBottom: 16,
    padding: "16px 18px",
    background: "linear-gradient(135deg, #f0fdf4 0%, #faf8f3 100%)",
    borderRadius: 10,
    border: "1px solid " + _br.gn + "44",
    boxShadow: "0 2px 8px rgba(61,90,46,0.08)"
  }}>
    {/* Assistant identity: makes it obvious this is a chattable AI helper,
        not just a progress/form widget. Shared across all steps. */}
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: _br.gn, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(61,90,46,0.28)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9L12 2.5z" fill="#fff" />
          <path d="M18.6 14.4l.75 2.05 2.05.75-2.05.75-.75 2.05-.75-2.05-2.05-.75 2.05-.75.75-2.05z" fill="#fff" opacity="0.8" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: _br.dk, fontFamily: _sans }}>Deck Assistant</span>
          <span style={{ fontSize: 7.5, fontWeight: 700, fontFamily: _mono, color: _br.gn, border: "1px solid " + _br.gn, borderRadius: 4, padding: "1px 5px", letterSpacing: "0.5px" }}>AI</span>
        </div>
        <div style={{ fontSize: 10, color: _br.mu, fontFamily: _sans }}>Ask me anything, or I'll walk you through each step.</div>
      </div>
    </div>

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
      {onSendMessage && (!chatMessages || chatMessages.length === 0) && <span style={{ display: "block", marginTop: 4, fontSize: 10, color: _br.gn, fontStyle: "italic" }}>
        You can also type below to ask questions or describe what you want.
      </span>}
    </div>}

    {/* S54: Chat conversation area */}
    {chatMessages && chatMessages.length > 0 && <div style={{
      marginBottom: 10, maxHeight: 200, overflowY: "auto",
      borderRadius: 8, background: "rgba(255,255,255,0.6)",
      padding: "8px 10px", border: "1px solid " + _br.bd
    }}>
      {chatMessages.map(function(msg, mi) {
        var isUser = msg.role === "user";
        return <div key={mi} style={{
          marginBottom: mi < chatMessages.length - 1 ? 8 : 0,
          display: "flex", flexDirection: "column",
          alignItems: isUser ? "flex-end" : "flex-start"
        }}>
          <div style={{
            maxWidth: "85%", padding: "7px 11px", borderRadius: 10,
            fontSize: 12, fontFamily: _sans, lineHeight: 1.45,
            background: isUser ? _br.gn : "#fff",
            color: isUser ? "#fff" : _br.dk,
            border: isUser ? "none" : ("1px solid " + _br.bd),
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
          }}>
            {/* S56: Show image thumbnail in chat bubble */}
            {isUser && msg.image && msg.image.thumbUrl && <img src={msg.image.thumbUrl} style={{ maxWidth: "100%", maxHeight: 120, borderRadius: 6, marginBottom: msg.text ? 6 : 0, display: "block" }} />}
            {isUser ? msg.text : _renderChatText(msg.text)}
          </div>
          {/* Action confirmations */}
          {msg.actions && msg.actions.length > 0 && <div style={{
            marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap",
            justifyContent: isUser ? "flex-end" : "flex-start"
          }}>
            {msg.actions.map(function(act, ai) {
              var chipText = "";
              if (act.param) chipText = act.param + " = " + JSON.stringify(act.value);
              else if (act.navigate) chipText = "Showing: " + act.navigate;
              else if (act.siteElementUpdate) chipText = "Updated " + (act.siteElementUpdate.type || "element");
              else if (act.siteElementAdd) chipText = "Added " + (act.siteElementAdd.type || "element");
              else if (act.siteElementRemove) chipText = "Removed element";
              else if (act.zoneAdd) chipText = "Added zone (" + (act.zoneAdd.edge || "left") + ")";
              else if (act.cutoutAdd) chipText = "Added cutout (" + (act.cutoutAdd.edge || "front") + ")";
              else if (act.chamferSet) chipText = (act.chamferSet.enabled ? "Chamfer " : "Removed chamfer ") + (act.chamferSet.corner || "");
              else if (act.zoneRemove) chipText = "Removed zone";
              else if (act.zoneUpdate) chipText = "Updated zone " + (act.zoneUpdate.zoneId || "");
              else return null;
              return <span key={ai} style={{
                fontSize: 9, fontFamily: _mono, color: _br.gn, fontWeight: 700,
                background: _br.gn + "15", padding: "2px 8px", borderRadius: 10,
                border: "1px solid " + _br.gn + "33"
              }}>
                {chipText}
              </span>;
            })}
          </div>}
          {/* S62: Suggestion buttons -- clickable quick actions */}
          {msg.suggestions && msg.suggestions.length > 0 && <div style={{
            marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap"
          }}>
            {msg.suggestions.map(function(sug, si) {
              var isApplied = msg.appliedSuggestion === si;
              var isDismissed = msg.appliedSuggestion != null && msg.appliedSuggestion !== si;
              return <button key={si} disabled={msg.appliedSuggestion != null}
                onClick={function() {
                  var hasRecognized = sug.actions && sug.actions.length > 0 && sug.actions.some(function(a) {
                    return a.param || a.navigate || a.siteElementUpdate || a.siteElementAdd || a.siteElementRemove || a.zoneAdd || a.cutoutAdd || a.chamferSet || a.zoneRemove || a.zoneUpdate;
                  });
                  if (hasRecognized && onApplyActions) {
                    onApplyActions(sug.actions);
                  } else if (onSendMessage) {
                    onSendMessage(sug.label);
                  }
                  setChatMessages(function(prev) {
                    var updated = prev.slice();
                    var target = Object.assign({}, updated[mi]);
                    target.appliedSuggestion = si;
                    updated[mi] = target;
                    return updated;
                  });
                }}
                style={{
                  fontSize: 11, fontFamily: _mono, fontWeight: 600,
                  padding: "6px 14px", borderRadius: 6, cursor: msg.appliedSuggestion != null ? "default" : "pointer",
                  border: isApplied ? "1.5px solid " + _br.gn : "1px solid " + _br.bd,
                  background: isApplied ? "#f0fdf4" : isDismissed ? "#f5f5f5" : "#fff",
                  color: isApplied ? _br.gn : isDismissed ? _br.mu : _br.dk,
                  opacity: isDismissed ? 0.5 : 1,
                  transition: "all 0.15s",
                }}>
                {isApplied ? "\u2713 " : ""}{sug.label}
              </button>;
            })}
          </div>}
        </div>;
      })}
    </div>}

    {/* S54: Chat text input with S56 image support */}
    {onSendMessage && <div style={{ marginBottom: 10 }}>
      {/* S56: Pending image preview */}
      {pendingImage && <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
        <img src={pendingImage.thumbUrl} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, border: "1px solid " + _br.bd }} />
        <span style={{ fontSize: 10, fontFamily: _mono, color: _br.gn, fontWeight: 600, flex: 1 }}>Reference photo attached</span>
        <button onClick={function() { setPendingImage(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: _br.mu, padding: 2 }}>{"\u2715"}</button>
      </div>}
      <form onSubmit={handleChatSubmit} style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        <input type="file" ref={fileInputRef} accept="image/*" style={{ display: "none" }} onChange={function(e) { if (e.target.files && e.target.files[0]) _handleImageFile(e.target.files[0]); e.target.value = ""; }} />
        <button type="button" onClick={function() { if (fileInputRef.current) fileInputRef.current.click(); }} disabled={chatLoading} title="Attach reference photo" style={{
          padding: "8px 10px", borderRadius: 8, border: "1px solid " + _br.bd,
          background: pendingImage ? "#f0fdf4" : "#fff", color: pendingImage ? _br.gn : _br.mu,
          fontSize: 14, cursor: chatLoading ? "default" : "pointer", flexShrink: 0,
          transition: "background 0.2s"
        }}>{"\uD83D\uDCF7"}</button>
        <textarea ref={chatInputRef} rows={1}
          placeholder={pendingImage ? "Describe what you like about this deck..." : (_chatPlaceholders[phase] || "Ask a question or describe what you want...")}
          disabled={chatLoading}
          onKeyDown={function(e) { if (e.key === "Enter" && !e.shiftKey) handleChatSubmit(e); }}
          onInput={function(e) { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
          onPaste={function(e) {
            var items = e.clipboardData && e.clipboardData.items;
            if (items && _imageFromClipboard(items, function(data) { setPendingImage(data); })) {
              e.preventDefault();
            }
          }}
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 12,
            fontFamily: _sans, border: "1px solid " + _br.bd,
            background: "#fff", color: _br.dk, outline: "none",
            transition: "border-color 0.2s",
            opacity: chatLoading ? 0.6 : 1,
            resize: "none", lineHeight: 1.4, minHeight: 38, maxHeight: 120, overflowY: "auto"
          }}
          onFocus={function(e) { e.target.style.borderColor = _br.gn; }}
          onBlur={function(e) { e.target.style.borderColor = _br.bd; }}
        ></textarea>
        <button type="submit" disabled={chatLoading} style={{
          padding: "8px 14px", borderRadius: 8, border: "none",
          background: chatLoading ? _br.mu : _br.gn, color: "#fff",
          fontSize: 11, fontFamily: _mono, fontWeight: 700,
          cursor: chatLoading ? "default" : "pointer",
          transition: "background 0.2s", flexShrink: 0
        }}>{"\u2191"}</button>
      </form>
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
        fontSize: 10, fontFamily: _mono, color: _br.mu, background: "#fff",
        border: "1px solid " + _br.bd, borderRadius: 4, cursor: "pointer", padding: "4px 10px", fontWeight: 600
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
    addStair, removeStair, updateStair, getStairsForZone,
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
  const [rankingInProgress, setRankingInProgress] = _stUS(false);
  const [rankingResult, setRankingResult] = _stUS(null);
  const [parcelLoading, setParcelLoading] = _stUS(false);
  const [parcelError, setParcelError] = _stUS(null);
  const [footprintFailed, setFootprintFailed] = _stUS(false);
  const [parcelAddress, setParcelAddress] = _stUS("");
  const [parcelState, setParcelState] = _stUS("");
  const [parcelCity, setParcelCity] = _stUS("");
  const [parcelZip, setParcelZip] = _stUS("");
  const [showSiteElements, setShowSiteElements] = _stUS(false);
  const [showLotShape, setShowLotShape] = _stUS(false);
  const [selectedElId, setSelectedElId] = _stUS(null);
  const [showLotHouse, setShowLotHouse] = _stUS(true);
  const [showHouseAdj, setShowHouseAdj] = _stUS(false);
  const [showPerFooting, setShowPerFooting] = _stUS(false);
  var dialDragRef = React.useRef(false);
  _stUE(function() { u("_selectedElId", selectedElId); }, [selectedElId]);

  // S63: Parcel lookup function
  function _doParcelLookup() {
    if (!parcelAddress || !parcelState || parcelLoading) return;
    setParcelLoading(true);
    setParcelError(null);
    // S96.5: guideAdvance (not setGuidePhase) so the phase we came FROM lands in
    // guideHistory -- the Back button only renders when history is non-empty, so
    // the whole lookup path previously left the user with no way back.
    if (guideActive) guideAdvance('address_verifying');
    fetch('/api/parcel-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: parcelAddress, state: parcelState, city: parcelCity, zip: parcelZip })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      setParcelLoading(false);
      if (data.error) {
        setParcelError(data.error);
        // S96.5: rollback on error -- sync the async-safe mirror too.
        if (guideActive) { guidePhaseRef.current = 'address_lookup'; setGuidePhase('address_lookup'); }
        return;
      }
      // Apply lot vertices
      var verts = data.lot.vertices;
      if (verts && verts.length >= 3) {
        u("lotVertices", verts);
        u("lotWidth", Math.round(data.lot.width));
        u("lotDepth", Math.round(data.lot.depth));
        // S70: Street edge identification using address point proximity
        // The Realie lat/lng is the geocoded address point, typically near
        // the front of the property (near the street/mailbox). The lot edge
        // closest to this point is the street edge.
        var nv = verts.length;
        var streetIdx = 0, rearIdx = 0;
        // S100: street/rear edge candidacy filter. Corner chamfers and arc
        // leftovers (e.g. a 16ft corner cut where two roads meet) must never
        // be chosen as "the street edge" -- rotating the lot onto a chip tilts
        // the whole plan. Candidates must be >= max(20ft, 15% of the longest
        // edge), capped at 35ft so narrow real frontages (flag lots) qualify.
        var _edgeLens = [];
        var _maxEdgeLen = 0;
        for (var eiL = 0; eiL < nv; eiL++) {
          var niL = (eiL + 1) % nv;
          var eLdx = verts[niL][0] - verts[eiL][0], eLdy = verts[niL][1] - verts[eiL][1];
          var eLl = Math.sqrt(eLdx * eLdx + eLdy * eLdy);
          _edgeLens.push(eLl);
          if (eLl > _maxEdgeLen) _maxEdgeLen = eLl;
        }
        var _minStreetEdge = Math.min(35, Math.max(20, 0.15 * _maxEdgeLen));
        if (_maxEdgeLen < _minStreetEdge) _minStreetEdge = 0; // degenerate tiny lot: no filter
        function _edgeQualifies(ei) { return _edgeLens[ei] >= _minStreetEdge; }
        function _distToEdge(px, py, ei) {
          var a = verts[ei], b = verts[(ei + 1) % nv];
          var abx = b[0] - a[0], aby = b[1] - a[1];
          var L2 = abx * abx + aby * aby;
          if (L2 < 1e-9) return Math.sqrt((px - a[0]) * (px - a[0]) + (py - a[1]) * (py - a[1]));
          var t = ((px - a[0]) * abx + (py - a[1]) * aby) / L2;
          t = Math.max(0, Math.min(1, t));
          var qx = a[0] + t * abx, qy = a[1] + t * aby;
          return Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy));
        }
        // Convert Realie lat/lng to lot coordinates using raw GeoJSON
        var rawC = data.raw_coords;
        var propLotX = null, propLotY = null;
        if (rawC && rawC.length >= 3 && data.location.lat && data.location.lng) {
          var minLatR = Infinity, minLngR = Infinity;
          for (var ci2 = 0; ci2 < rawC.length; ci2++) {
            if (rawC[ci2][1] < minLatR) minLatR = rawC[ci2][1];
            if (rawC[ci2][0] < minLngR) minLngR = rawC[ci2][0];
          }
          var ftLat2 = 364000.0;
          var ftLng2 = 364000.0 * Math.cos(minLatR * Math.PI / 180);
          propLotX = (data.location.lng - minLngR) * ftLng2;
          propLotY = (data.location.lat - minLatR) * ftLat2;
        }
        if (propLotX !== null && propLotY !== null) {
          // Street edge = the edge hit by a ray from lot centroid through address point
          // The address point is between the centroid and the street.
          // So centroid -> address point -> street edge.
          var lotCx3 = 0, lotCy3 = 0;
          for (var vi3 = 0; vi3 < nv; vi3++) { lotCx3 += verts[vi3][0]; lotCy3 += verts[vi3][1]; }
          lotCx3 /= nv; lotCy3 /= nv;
          // Ray direction: centroid toward address point
          var rayDx = propLotX - lotCx3, rayDy = propLotY - lotCy3;
          var rayLen = Math.sqrt(rayDx * rayDx + rayDy * rayDy);
          if (rayLen > 0.1) {
            // Find which edge the ray hits (S100: qualifying edges only)
            var bestT = Infinity;
            var _rayHit = false;
            for (var ei = 0; ei < nv; ei++) {
              if (!_edgeQualifies(ei)) continue;
              var ni = (ei + 1) % nv;
              var ex = verts[ei][0], ey = verts[ei][1];
              var fx = verts[ni][0], fy = verts[ni][1];
              // Ray-segment intersection
              var sx2 = fx - ex, sy2 = fy - ey;
              var denom = rayDx * sy2 - rayDy * sx2;
              if (Math.abs(denom) < 0.001) continue;
              var t = ((ex - lotCx3) * sy2 - (ey - lotCy3) * sx2) / denom;
              var u2 = ((ex - lotCx3) * rayDy - (ey - lotCy3) * rayDx) / denom;
              if (t > 0.01 && u2 >= 0 && u2 <= 1 && t < bestT) {
                bestT = t;
                streetIdx = ei;
                _rayHit = true;
              }
            }
            // S100: ray exited through a filtered-out chamfer -- fall back to
            // the qualifying edge nearest the address point.
            if (!_rayHit) {
              var _bestD = Infinity;
              for (var eiF = 0; eiF < nv; eiF++) {
                if (!_edgeQualifies(eiF)) continue;
                var dF = _distToEdge(propLotX, propLotY, eiF);
                if (dF < _bestD) { _bestD = dF; streetIdx = eiF; }
              }
              console.log("S100: Street ray hit no qualifying edge; nearest-edge fallback chose " + streetIdx);
            }
          }
          // Rear = edge hit by ray in opposite direction (centroid away from address point)
          var bestT2 = Infinity;
          var _rearHit = false;
          var revDx = -rayDx, revDy = -rayDy;
          for (var ei = 0; ei < nv; ei++) {
            if (!_edgeQualifies(ei)) continue;
            var ni = (ei + 1) % nv;
            var ex = verts[ei][0], ey = verts[ei][1];
            var fx = verts[ni][0], fy = verts[ni][1];
            var sx2 = fx - ex, sy2 = fy - ey;
            var denom = revDx * sy2 - revDy * sx2;
            if (Math.abs(denom) < 0.001) continue;
            var t = ((ex - lotCx3) * sy2 - (ey - lotCy3) * sx2) / denom;
            var u2 = ((ex - lotCx3) * revDy - (ey - lotCy3) * revDx) / denom;
            if (t > 0.01 && u2 >= 0 && u2 <= 1 && t < bestT2) {
              bestT2 = t;
              rearIdx = ei;
              _rearHit = true;
            }
          }
          if (!_rearHit) {
            var _bestD2 = -1;
            for (var eiF2 = 0; eiF2 < nv; eiF2++) {
              if (!_edgeQualifies(eiF2) || eiF2 === streetIdx) continue;
              var dF2 = _distToEdge(propLotX, propLotY, eiF2);
              if (dF2 > _bestD2) { _bestD2 = dF2; rearIdx = eiF2; }
            }
          }
          console.log("Street edge " + streetIdx + " detected via centroid->address ray. Centroid(" + lotCx3.toFixed(1) + "," + lotCy3.toFixed(1) + ") Addr(" + propLotX.toFixed(1) + "," + propLotY.toFixed(1) + ")");
        } else {
          // Fallback: lowest average Y (most southern), qualifying edges only (S100)
          var minAvgY = Infinity, maxAvgY = -Infinity;
          for (var ei = 0; ei < nv; ei++) {
            if (!_edgeQualifies(ei)) continue;
            var ni = (ei + 1) % nv;
            var avgY = (verts[ei][1] + verts[ni][1]) / 2;
            if (avgY < minAvgY) { minAvgY = avgY; streetIdx = ei; }
            if (avgY > maxAvgY) { maxAvgY = avgY; rearIdx = ei; }
          }
          console.log("Street edge " + streetIdx + " detected via lowest-Y fallback");
        }
        var edges = [];
        for (var ei = 0; ei < nv; ei++) {
          var ni = (ei + 1) % nv;
          var edx = verts[ni][0] - verts[ei][0], edy = verts[ni][1] - verts[ei][1];
          var elen = Math.round(Math.sqrt(edx * edx + edy * edy));
          var isStreet = (ei === streetIdx);
          var isRear = (ei === rearIdx);
          var sbType = isStreet ? "front" : (isRear ? "rear" : "side");
          edges.push({
            type: isStreet ? "street" : "property",
            label: isStreet ? (data.location.address || "") : "",
            length: elen,
            setbackType: sbType,
            neighborLabel: ""
          });
        }
        u("lotArea", data.lot.area_sqft || Math.round(data.lot.width * data.lot.depth));
        // S79: Compute lot rotation from street edge angle (polygon-derived).
        // The street edge bearing gives us the rotation needed to put street
        // at the bottom of the drawing. This replaces Overpass road bearing
        // dependency -- rotation is now available immediately from Realie data.
        var sv1 = verts[streetIdx], sv2 = verts[(streetIdx + 1) % nv];
        var streetEdgeDx = sv2[0] - sv1[0], streetEdgeDy = sv2[1] - sv1[1];
        var streetEdgeLen = Math.sqrt(streetEdgeDx * streetEdgeDx + streetEdgeDy * streetEdgeDy);
        // Edge angle in radians (from +X axis, counterclockwise)
        var streetEdgeAngle = Math.atan2(streetEdgeDy, streetEdgeDx);
        // We want this edge horizontal at the bottom (pointing right = angle 0).
        // Rotation needed = -streetEdgeAngle. But we also need the street edge
        // to end up at minimum Y (bottom). After rotating by -edgeAngle, the
        // edge is horizontal. Check if it's at the bottom or top.
        var rotForHoriz = -streetEdgeAngle;
        // Rotate lot centroid and street edge midpoint to test position
        var lotCxR = 0, lotCyR = 0;
        for (var viR = 0; viR < nv; viR++) { lotCxR += verts[viR][0]; lotCyR += verts[viR][1]; }
        lotCxR /= nv; lotCyR /= nv;
        var cosTest = Math.cos(rotForHoriz), sinTest = Math.sin(rotForHoriz);
        var streetMidX = (sv1[0] + sv2[0]) / 2, streetMidY = (sv1[1] + sv2[1]) / 2;
        var rotStreetY = (streetMidX - lotCxR) * sinTest + (streetMidY - lotCyR) * cosTest;
        var rotCentY = 0; // centroid rotates to origin
        // If street edge is above centroid after rotation, flip 180 degrees
        if (rotStreetY > rotCentY) {
          rotForHoriz += Math.PI;
        }
        // Normalize to 0..2PI range
        while (rotForHoriz < 0) rotForHoriz += 2 * Math.PI;
        while (rotForHoriz >= 2 * Math.PI) rotForHoriz -= 2 * Math.PI;
        var rotDeg = rotForHoriz * 180 / Math.PI;
        // Skip rotation for near-zero angles (street already at bottom)
        var _s79RotRad = 0, _s79Cos = 1, _s79Sin = 0;
        var _s79Cx = lotCxR, _s79Cy = lotCyR, _s79Mx = 0, _s79My = 0;
        var _s79Rotated = false;
        if (rotDeg > 3 && rotDeg < 357) {
          _s79RotRad = rotForHoriz;
          _s79Cos = Math.cos(_s79RotRad);
          _s79Sin = Math.sin(_s79RotRad);
          // Rotate all vertices around lot centroid
          var rotVerts = [];
          for (var viR2 = 0; viR2 < nv; viR2++) {
            var rdx = verts[viR2][0] - _s79Cx, rdy = verts[viR2][1] - _s79Cy;
            rotVerts.push([_s79Cx + rdx * _s79Cos - rdy * _s79Sin, _s79Cy + rdx * _s79Sin + rdy * _s79Cos]);
          }
          // Shift to origin (min corner = 0,0)
          var rMinX = Infinity, rMinY = Infinity;
          for (var viR3 = 0; viR3 < rotVerts.length; viR3++) {
            if (rotVerts[viR3][0] < rMinX) rMinX = rotVerts[viR3][0];
            if (rotVerts[viR3][1] < rMinY) rMinY = rotVerts[viR3][1];
          }
          _s79Mx = rMinX; _s79My = rMinY;
          for (var viR4 = 0; viR4 < rotVerts.length; viR4++) {
            rotVerts[viR4][0] -= rMinX;
            rotVerts[viR4][1] -= rMinY;
          }
          // Compute new bounding box
          var rMaxX = 0, rMaxY = 0;
          for (var viR5 = 0; viR5 < rotVerts.length; viR5++) {
            if (rotVerts[viR5][0] > rMaxX) rMaxX = rotVerts[viR5][0];
            if (rotVerts[viR5][1] > rMaxY) rMaxY = rotVerts[viR5][1];
          }
          // Rebuild edges for rotated vertices
          var rotEdges = [];
          for (var ei = 0; ei < nv; ei++) {
            var ni = (ei + 1) % nv;
            var edx = rotVerts[ni][0] - rotVerts[ei][0], edy = rotVerts[ni][1] - rotVerts[ei][1];
            var elen = Math.round(Math.sqrt(edx * edx + edy * edy));
            var isStreet = (ei === streetIdx);
            var isRear = (ei === rearIdx);
            var sbType = isStreet ? "front" : (isRear ? "rear" : "side");
            rotEdges.push({
              type: isStreet ? "street" : "property",
              label: isStreet ? (data.location.address || "") : "",
              length: elen,
              setbackType: sbType,
              neighborLabel: ""
            });
          }
          verts = rotVerts; // update closure variable for building footprint callback
          edges = rotEdges;
          u("lotWidth", Math.round(rMaxX));
          u("lotDepth", Math.round(rMaxY));
          // S100: SVG rotate() is clockwise but the lot was rotated
          // counterclockwise by rotDeg on screen, so the north arrow needs the
          // complement. Previously stored +rotDeg, which mirrored the arrow.
          u("northAngle", Math.round((360 - rotDeg) % 360));
          u("_lotRotation", 0);
          _s79Rotated = true;
          console.log("S79: Polygon-edge rotation applied: " + rotDeg.toFixed(1) + "deg from street edge " + streetIdx + " (edgeAngle=" + (streetEdgeAngle * 180 / Math.PI).toFixed(1) + "deg, edgeLen=" + streetEdgeLen.toFixed(0) + "ft)");
        } else {
          u("northAngle", 0);
          u("_lotRotation", 0);
          console.log("S79: No rotation needed (street edge already near-horizontal, rotDeg=" + rotDeg.toFixed(1) + ")");
        }
        u("lotEdges", edges);
        // lotVertices MUST be set last (prevents engine polygon regeneration race)
        u("lotVertices", verts);
      }
      // Apply house dimensions
      if (data.building.estimated_width && data.building.estimated_depth) {
        u("houseWidth", Math.round(data.building.estimated_width));
        u("houseDepth", Math.round(data.building.estimated_depth));
      }
      // Estimate house position from standard setbacks
      // S79: Use rotated lot dimensions if rotation was applied
      var lotW = _s79Rotated ? Math.round(Math.max.apply(null, verts.map(function(v) { return v[0]; }))) : Math.round(data.lot.width);
      var lotD = _s79Rotated ? Math.round(Math.max.apply(null, verts.map(function(v) { return v[1]; }))) : Math.round(data.lot.depth);
      var hw = Math.round(data.building.estimated_width || 40);
      var hd = Math.round(data.building.estimated_depth || 30);
      var offsetSide = Math.max(5, Math.round((lotW - hw) / 2));
      var distFromStreet = Math.min(Math.round(lotD * 0.3), 35);
      u("houseOffsetSide", offsetSide);
      u("houseDistFromStreet", distFromStreet);
      // Apply property info
      if (data.location.address) setI("address", data.location.address);
      if (data.location.city) setI("city", data.location.city);
      if (data.location.state) setI("state", data.location.state);
      if (data.location.zip) setI("zip", data.location.zip);
      if (data.parcel.id) setI("lot", data.parcel.id);
      if (data.parcel.zoning) setI("zoning", data.parcel.zoning);
      if (data.location.county) setI("county", data.location.county);
      if (data.building.year_built) setI("yearBuilt", String(data.building.year_built));
      // Set street name from address
      if (data.location.address) u("streetName", data.location.address);
      // Save lat/lng for vicinity map on PDF
      if (data.location.lat) { u("_parcel_lat", data.location.lat); setI("lat", String(data.location.lat)); }
      if (data.location.lng) { u("_parcel_lng", data.location.lng); setI("lng", String(data.location.lng)); }
      // S70: Async building footprint lookup (non-blocking enhancement)
      // Queries OpenStreetMap for actual building footprint to get
      // accurate house dimensions, orientation angle, and position.
      // S73: Auto-retry once on failure, show warning if both attempts fail.
      if (data.location.lat && data.location.lng) {
        var _fpLat = data.location.lat, _fpLng = data.location.lng, _fpRaw = data.raw_coords;
        var _fpRealieSqft = data.building.sqft || null;
        var _fpStories = data.building.stories || 1;
        // S79c: Flag site plan as loading until building footprint returns
        u("_siteplanLoading", true);
        var _doFootprintLookup = function(attempt) {
          setFootprintFailed(false);
          if (guideActive && attempt > 1) setGuidePhase('footprint_loading');
          fetch('/api/building-footprint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: _fpLat, lng: _fpLng, raw_coords: _fpRaw, realie_sqft: _fpRealieSqft, stories: _fpStories })
          })
          .then(function(r) { return r.json(); })
        .then(function(bldg) {
          console.log("Building footprint response:", bldg.count + " buildings, nearest_road:", bldg.nearest_road ? bldg.nearest_road.name + " bearing=" + bldg.nearest_road.bearing + "deg dist=" + bldg.nearest_road.dist + "ft" : "none");
          // S79b: Overpass road validation and street edge correction.
          // The parcel callback identified the street edge via ray-cast and applied
          // rotation. Overpass may confirm or override that choice.
          if (bldg.nearest_road && bldg.nearest_road.bearing !== undefined) {
            var roadBearing = bldg.nearest_road.bearing;
            var origVerts = data.lot.vertices; // unrotated original
            var nv2 = origVerts.length;
            // Find which edge's outward normal is closest to road bearing
            var cxL = 0, cyL = 0;
            for (var vi2 = 0; vi2 < nv2; vi2++) { cxL += origVerts[vi2][0]; cyL += origVerts[vi2][1]; }
            cxL /= nv2; cyL /= nv2;
            var bestEdge = -1, bestAngleDiff = 999;
            // S100: same chamfer exclusion as the ray-cast pass. A corner
            // chamfer's outward normal points between the two road bearings
            // and can out-score both real frontage edges.
            var _maxEL2 = 0;
            for (var eiM = 0; eiM < nv2; eiM++) {
              var niM = (eiM + 1) % nv2;
              var eMdx = origVerts[niM][0] - origVerts[eiM][0], eMdy = origVerts[niM][1] - origVerts[eiM][1];
              var eMl = Math.sqrt(eMdx * eMdx + eMdy * eMdy);
              if (eMl > _maxEL2) _maxEL2 = eMl;
            }
            var _minEdge2 = Math.min(35, Math.max(20, 0.15 * _maxEL2));
            if (_maxEL2 < _minEdge2) _minEdge2 = 0;
            for (var ei2 = 0; ei2 < nv2; ei2++) {
              var ni2 = (ei2 + 1) % nv2;
              var edx2 = origVerts[ni2][0] - origVerts[ei2][0];
              var edy2 = origVerts[ni2][1] - origVerts[ei2][1];
              var elen2 = Math.sqrt(edx2 * edx2 + edy2 * edy2);
              if (elen2 < _minEdge2 || elen2 < 1) continue;
              var nx2 = -edy2 / elen2, ny2 = edx2 / elen2;
              var mx2 = (origVerts[ei2][0] + origVerts[ni2][0]) / 2;
              var my2 = (origVerts[ei2][1] + origVerts[ni2][1]) / 2;
              if (nx2 * (cxL - mx2) + ny2 * (cyL - my2) > 0) { nx2 = -nx2; ny2 = -ny2; }
              var normalBearing = Math.atan2(nx2, ny2) * 180 / Math.PI;
              if (normalBearing < 0) normalBearing += 360;
              var diff2 = Math.abs(normalBearing - roadBearing);
              if (diff2 > 180) diff2 = 360 - diff2;
              if (diff2 < bestAngleDiff) { bestAngleDiff = diff2; bestEdge = ei2; }
            }
            if (bestEdge >= 0 && bestAngleDiff < 60 && bestEdge !== streetIdx) {
              // Overpass disagrees with ray-cast! Re-rotate using correct edge.
              console.log("S79b: Overpass street edge " + bestEdge + " differs from ray-cast edge " + streetIdx + " (road=" + bldg.nearest_road.name + " bearing=" + roadBearing + " angleDiff=" + bestAngleDiff.toFixed(1) + "). Re-rotating.");
              streetIdx = bestEdge;
              // Find rear edge (most opposite to new street)
              rearIdx = 0;
              var maxDiff2 = 0;
              for (var ei3 = 0; ei3 < nv2; ei3++) {
                if (ei3 === bestEdge) continue;
                var ni3 = (ei3 + 1) % nv2;
                var edx3 = origVerts[ni3][0] - origVerts[ei3][0];
                var edy3 = origVerts[ni3][1] - origVerts[ei3][1];
                var elen3 = Math.sqrt(edx3 * edx3 + edy3 * edy3);
                if (elen3 < _minEdge2 || elen3 < 1) continue;
                var nx3 = -edy3 / elen3, ny3 = edx3 / elen3;
                var mx3 = (origVerts[ei3][0] + origVerts[ni3][0]) / 2;
                var my3 = (origVerts[ei3][1] + origVerts[ni3][1]) / 2;
                if (nx3 * (cxL - mx3) + ny3 * (cyL - my3) > 0) { nx3 = -nx3; ny3 = -ny3; }
                var nb3 = Math.atan2(nx3, ny3) * 180 / Math.PI;
                if (nb3 < 0) nb3 += 360;
                var d3 = Math.abs(nb3 - roadBearing);
                if (d3 > 180) d3 = 360 - d3;
                if (d3 > maxDiff2) { maxDiff2 = d3; rearIdx = ei3; }
              }
              // Recompute rotation from corrected street edge
              var sv1b = origVerts[bestEdge], sv2b = origVerts[(bestEdge + 1) % nv2];
              var seAngle = Math.atan2(sv2b[1] - sv1b[1], sv2b[0] - sv1b[0]);
              var rotB = -seAngle;
              // Check if street ends up at bottom
              var cosB = Math.cos(rotB), sinB = Math.sin(rotB);
              var smxB = (sv1b[0] + sv2b[0]) / 2, smyB = (sv1b[1] + sv2b[1]) / 2;
              var rotSY = (smxB - cxL) * sinB + (smyB - cyL) * cosB;
              if (rotSY > 0) rotB += Math.PI;
              while (rotB < 0) rotB += 2 * Math.PI;
              while (rotB >= 2 * Math.PI) rotB -= 2 * Math.PI;
              var rotDegB = rotB * 180 / Math.PI;
              // Apply rotation to original vertices
              if (rotDegB > 3 && rotDegB < 357) {
                var cosR = Math.cos(rotB), sinR = Math.sin(rotB);
                var rv2 = [];
                for (var vi3 = 0; vi3 < nv2; vi3++) {
                  var rdx = origVerts[vi3][0] - cxL, rdy = origVerts[vi3][1] - cyL;
                  rv2.push([cxL + rdx * cosR - rdy * sinR, cyL + rdx * sinR + rdy * cosR]);
                }
                var rmx = Infinity, rmy = Infinity;
                for (var vi4 = 0; vi4 < rv2.length; vi4++) {
                  if (rv2[vi4][0] < rmx) rmx = rv2[vi4][0];
                  if (rv2[vi4][1] < rmy) rmy = rv2[vi4][1];
                }
                for (var vi5 = 0; vi5 < rv2.length; vi5++) { rv2[vi5][0] -= rmx; rv2[vi5][1] -= rmy; }
                var rmaxX = 0, rmaxY = 0;
                for (var vi6 = 0; vi6 < rv2.length; vi6++) {
                  if (rv2[vi6][0] > rmaxX) rmaxX = rv2[vi6][0];
                  if (rv2[vi6][1] > rmaxY) rmaxY = rv2[vi6][1];
                }
                // Update stored rotation params for centroid transform
                _s79Rotated = true;
                _s79Cos = cosR; _s79Sin = sinR;
                _s79Cx = cxL; _s79Cy = cyL;
                _s79Mx = rmx; _s79My = rmy;
                // Rebuild edges
                var corrEdges = [];
                for (var ei4 = 0; ei4 < nv2; ei4++) {
                  var ni4 = (ei4 + 1) % nv2;
                  var edx4 = rv2[ni4][0] - rv2[ei4][0], edy4 = rv2[ni4][1] - rv2[ei4][1];
                  var elen4 = Math.round(Math.sqrt(edx4 * edx4 + edy4 * edy4));
                  var isStr4 = (ei4 === bestEdge);
                  var isRear4 = (ei4 === rearIdx);
                  var sbT4 = isStr4 ? "front" : (isRear4 ? "rear" : "side");
                  corrEdges.push({
                    type: isStr4 ? "street" : "property",
                    label: isStr4 ? (bldg.nearest_road.name || data.location.address || "") : "",
                    length: elen4,
                    setbackType: sbT4,
                    neighborLabel: ""
                  });
                }
                verts = rv2; // update closure
                edges = corrEdges;
                u("lotWidth", Math.round(rmaxX));
                u("lotDepth", Math.round(rmaxY));
                // S100: complement for SVG clockwise rotate (see S79 site above)
                u("northAngle", Math.round((360 - rotDegB) % 360));
                u("_lotRotation", 0);
                u("lotEdges", corrEdges);
                u("lotVertices", rv2);
                if (bldg.nearest_road.name) u("streetName", bldg.nearest_road.name);
                console.log("S79b: Re-rotated lot: " + rotDegB.toFixed(1) + "deg, street edge " + bestEdge + " (" + bldg.nearest_road.name + "), bbox=" + Math.round(rmaxX) + "x" + Math.round(rmaxY));
              } else {
                // Corrected edge is already horizontal, just update labels
                var corrEdges = [];
                for (var ei4 = 0; ei4 < nv2; ei4++) {
                  var ni4 = (ei4 + 1) % nv2;
                  var edx4 = origVerts[ni4][0] - origVerts[ei4][0], edy4 = origVerts[ni4][1] - origVerts[ei4][1];
                  var elen4 = Math.round(Math.sqrt(edx4 * edx4 + edy4 * edy4));
                  var isStr4 = (ei4 === bestEdge);
                  var isRear4 = (ei4 === rearIdx);
                  var sbT4 = isStr4 ? "front" : (isRear4 ? "rear" : "side");
                  corrEdges.push({
                    type: isStr4 ? "street" : "property",
                    label: isStr4 ? (bldg.nearest_road.name || data.location.address || "") : "",
                    length: elen4,
                    setbackType: sbT4,
                    neighborLabel: ""
                  });
                }
                _s79Rotated = false;
                _s79Cos = 1; _s79Sin = 0; _s79Mx = 0; _s79My = 0;
                verts = origVerts;
                edges = corrEdges;
                u("northAngle", 0);
                u("_lotRotation", 0);
                u("lotEdges", corrEdges);
                u("lotVertices", origVerts);
                if (bldg.nearest_road.name) u("streetName", bldg.nearest_road.name);
                console.log("S79b: Corrected street edge " + bestEdge + ", no rotation needed");
              }
            } else if (bestEdge >= 0 && bestEdge === streetIdx) {
              // Overpass confirms ray-cast edge selection, just enrich name
              if (bldg.nearest_road.name) {
                u("streetName", bldg.nearest_road.name);
                var curEdges = edges || [];
                if (curEdges.length > 0) {
                  var updatedEdges = curEdges.map(function(e) {
                    if (e.type === "street") return Object.assign({}, e, { label: bldg.nearest_road.name });
                    return e;
                  });
                  u("lotEdges", updatedEdges);
                }
              }
              console.log("S79b: Overpass confirms street edge " + bestEdge + " (" + (bldg.nearest_road.name || "unnamed") + ", angleDiff=" + bestAngleDiff.toFixed(1) + ")");
            } else {
              console.log("S79b: Road bearing didn't match any edge well (bestEdge=" + bestEdge + " diff=" + bestAngleDiff.toFixed(1) + "), keeping ray-cast edge " + streetIdx);
            }
          } else if (bldg.nearest_road && bldg.nearest_road.name) {
            // No bearing but has name -- just enrich
            u("streetName", bldg.nearest_road.name);
            var curEdges = edges || [];
            if (curEdges.length > 0) {
              var updatedEdges = curEdges.map(function(e) {
                if (e.type === "street") return Object.assign({}, e, { label: bldg.nearest_road.name });
                return e;
              });
              u("lotEdges", updatedEdges);
            }
            console.log("S79: Street name enriched from Overpass: " + bldg.nearest_road.name);
          }
          if (!bldg.buildings || bldg.buildings.length === 0) {
            console.log("Building footprint: no buildings found" + (bldg.error ? " (error: " + bldg.error + ")" : ""));
            // S96.5: guideAdvance so this transition is recorded in guideHistory.
            u("_siteplanLoading", false);
            u("_siteplanConfidence", { level: "low", messages: ["Building data unavailable. Dimensions are estimated from tax records.", "Verify house width, depth, and position."] });
            if (guideActive) guideAdvance('verify_extracted');
            return;
          }
          console.log("Building footprint: " + bldg.buildings.length + " buildings found");
          for (var bi = 0; bi < Math.min(bldg.buildings.length, 5); bi++) {
            var b = bldg.buildings[bi];
            console.log("  #" + bi + ": " + b.width + "x" + b.depth + " area=" + b.area_sqft + "sqft dist=" + b.dist_from_center + "ft angle=" + b.angle + " type=" + b.type);
          }
          // Find the primary residence: closest building with area > 400 sqft
          var primary = null;
          for (var bi = 0; bi < bldg.buildings.length; bi++) {
            var b = bldg.buildings[bi];
            if (b.area_sqft >= 400 && b.dist_from_center < 250) {
              primary = b; break;
            }
          }
          if (!primary) {
            console.log("Building footprint: no building passed filter (>= 400sqft, < 250ft)");
            u("_siteplanLoading", false);
            u("_siteplanConfidence", { level: "low", messages: ["Building data unavailable. Dimensions are estimated from tax records.", "Verify house width, depth, and position."] });
            if (guideActive) guideAdvance('verify_extracted');
            return;
          }
          // Apply building dimensions from Solar/Overpass
          // S100: primary.width runs along the building's LONG axis and
          // primary.angle is that axis's direction in the unrotated lot frame.
          // Compare against the street edge direction (same frame): if the
          // long axis is closer to perpendicular than parallel, the long
          // dimension is the house DEPTH, not width. (Croaton: angle=94.3 vs
          // street 4.5 -> 58ft house drawn sideways.) Solar-only entries
          // report angle=0, which folds to "parallel" = previous behavior.
          var hw2 = Math.round(primary.width);
          var hd2 = Math.round(primary.depth);
          try {
            var _origV = data.lot.vertices;
            if (primary.angle && _origV && _origV.length >= 3) {
              var _sv1a = _origV[streetIdx], _sv2a = _origV[(streetIdx + 1) % _origV.length];
              var _stAngD = Math.atan2(_sv2a[1] - _sv1a[1], _sv2a[0] - _sv1a[0]) * 180 / Math.PI;
              var _relA = Math.abs(primary.angle - _stAngD) % 180;
              if (_relA > 90) _relA = 180 - _relA;
              if (_relA > 45) {
                hw2 = Math.round(primary.depth);
                hd2 = Math.round(primary.width);
                console.log("S100: Building long axis " + primary.angle + "deg is perpendicular to street (" + _stAngD.toFixed(1) + "deg, rel=" + _relA.toFixed(1) + "). Width/depth swapped: " + hw2 + "x" + hd2);
              }
            }
          } catch (eOr) { console.log("S100: orientation check skipped: " + eOr.message); }
          u("houseWidth", hw2);
          u("houseDepth", hd2);
          u("houseAngle", 0); // S78: always 0, Solar bbox is axis-aligned

          // S79: Position house using Solar centroid in the already-rotated lot.
          // The lot was rotated in the parcel callback. We rotate the centroid
          // through the same transform to get its position in drawing space.
          var centroidX = primary.centroid_ft[0];
          var centroidY = primary.centroid_ft[1];
          // Apply S79 rotation to centroid (same transform as lot vertices)
          if (_s79Rotated) {
            var cdx = centroidX - _s79Cx, cdy = centroidY - _s79Cy;
            centroidX = _s79Cx + cdx * _s79Cos - cdy * _s79Sin - _s79Mx;
            centroidY = _s79Cy + cdx * _s79Sin + cdy * _s79Cos - _s79My;
            console.log("S79: Centroid rotated to drawing space: (" + centroidX.toFixed(1) + "," + centroidY.toFixed(1) + ")");
          }

          // Use the current (potentially rotated) lot vertices for positioning
          var lotVerts2 = verts; // closure variable, already rotated if applicable
          var lotW2 = Math.round(Math.max.apply(null, lotVerts2.map(function(v) { return v[0]; })));
          var lotD2 = Math.round(Math.max.apply(null, lotVerts2.map(function(v) { return v[1]; })));

          // S85: positioning ladder now lives in lotGeometry.js
          // (window.lotGeometry.positionHouse). Priority is unchanged:
          // Solar centroid > address point > center fallback. Key rule:
          // dimensions are sacred, position is flexible, never push house
          // to a lot edge. The returned offset is RENDERER-space
          // (leftEdgeAtY(midY) reference) per the S85 offset contract, so
          // the site plan draws the house exactly where positioning intended.
          var newDist, newOffset;

          // Address point in drawing space (computed up front; positionHouse
          // uses it only if the centroid path does not apply)
          var pLotX = null, pLotY = null;
          var rawC2 = data.raw_coords;
          if (rawC2 && rawC2.length >= 3 && data.location.lat && data.location.lng) {
            var mLatR = Infinity, mLngR = Infinity;
            for (var ci3 = 0; ci3 < rawC2.length; ci3++) {
              if (rawC2[ci3][1] < mLatR) mLatR = rawC2[ci3][1];
              if (rawC2[ci3][0] < mLngR) mLngR = rawC2[ci3][0];
            }
            var addrX = (data.location.lng - mLngR) * 364000.0 * Math.cos(mLatR * Math.PI / 180);
            var addrY = (data.location.lat - mLatR) * 364000.0;
            // Rotate address point through same S79 transform
            if (_s79Rotated) {
              var adx = addrX - _s79Cx, ady = addrY - _s79Cy;
              addrX = _s79Cx + adx * _s79Cos - ady * _s79Sin - _s79Mx;
              addrY = _s79Cy + adx * _s79Sin + ady * _s79Cos - _s79My;
            }
            pLotX = addrX;
            pLotY = addrY;
          }

          var placed = window.lotGeometry.positionHouse({
            verts: lotVerts2, lotW: lotW2, lotD: lotD2,
            hw: hw2, hd: hd2,
            centroid: [centroidX, centroidY],
            addrPoint: (pLotX !== null && pLotY !== null) ? [pLotX, pLotY] : null
          });
          newDist = placed.dist;
          newOffset = placed.offset;
          console.log("S85: House positioned via lotGeometry.positionHouse: method=" + placed.method +
            " offset=" + newOffset + " dist=" + newDist +
            " houseLeftX=" + (placed.houseLeftX != null ? placed.houseLeftX.toFixed(1) : "?"));
          u("houseDistFromStreet", newDist);
          u("houseOffsetSide", newOffset);
          u("_autoHouseOffset", newOffset);
          u("_autoHouseDist", newDist);
          u("_autoHouseWidth", hw2);
          u("_autoHouseDepth", hd2);
          console.log("S79: Building applied: " + hw2 + "x" + hd2 + " offset=" + newOffset + " dist=" + newDist + " area=" + primary.area_sqft + "sqft");

          // S79: Rotation function for secondary structure positioning
          // Uses the same S79 transform stored from parcel callback
          var _rFn72 = _s79Rotated ? function(x, y) {
            var ddx = x - _s79Cx, ddy = y - _s79Cy;
            return [_s79Cx + ddx * _s79Cos - ddy * _s79Sin - _s79Mx, _s79Cy + ddx * _s79Sin + ddy * _s79Cos - _s79My];
          } : function(x, y) { return [x, y]; };
          // S70: Auto-add secondary structures (sheds, garages) as site elements
          // Use position relative to primary building (internally consistent in Overpass)
          // S77: Use _rFn72 to rotate element positions into drawing space
          var osmTypeMap = { "shed": "shed", "garage": "garage", "garages": "garage", "carport": "garage" };
          var newElements = (p.siteElements || []).slice(); // copy existing
          var addedCount = 0;
          // S79: Use UNROTATED centroid for relative positioning of secondary structures
          // (Overpass centroids are in original lot coordinate space)
          var houseCX2 = primary.centroid_ft[0]; // unrotated
          var houseCY2 = primary.centroid_ft[1]; // unrotated
          // Store original unrotated lot vertices for point-in-polygon check on secondary structures
          var unrotatedVerts = data.lot.vertices;
          for (var bi2 = 0; bi2 < bldg.buildings.length; bi2++) {
            var b2 = bldg.buildings[bi2];
            if (b2.osm_id === primary.osm_id) continue; // skip primary
            var mappedType = osmTypeMap[b2.type];
            if (!mappedType && b2.area_sqft < 300 && b2.type !== "detached" && b2.type !== "house" && b2.type !== "residential") {
              mappedType = "shed"; // small unlabeled structure = likely shed
            }
            if (!mappedType) continue;
            if (b2.area_sqft < 20 || b2.area_sqft > 2000) continue; // skip tiny or huge
            // Filter: only structures within 60ft of primary building (skip neighbors)
            var dx2 = b2.centroid_ft[0] - primary.centroid_ft[0];
            var dy2 = b2.centroid_ft[1] - primary.centroid_ft[1];
            var distFromPrimary = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            if (distFromPrimary > 60) {
              console.log("Skipped " + (mappedType || b2.type) + " " + b2.osm_id + ": " + distFromPrimary.toFixed(0) + "ft from house (too far, likely neighbor)");
              continue;
            }
            // S79: Point-in-polygon check uses UNROTATED vertices (Overpass centroids are in original space)
            // S85: delegated to window.lotGeometry.pointInPolygon (shared module)
            if (unrotatedVerts && unrotatedVerts.length >= 3 && !window.lotGeometry.pointInPolygon(b2.centroid_ft[0], b2.centroid_ft[1], unrotatedVerts)) {
              console.log("Skipped " + (mappedType || b2.type) + " " + b2.osm_id + ": centroid outside lot polygon (neighbor's structure)");
              continue;
            }
            // Map to lot coords: house center + relative offset (unrotated space)
            var elXRaw = houseCX2 + dx2 - b2.width / 2;
            var elYRaw = houseCY2 + dy2 - b2.depth / 2;
            // S77: Rotate element center into drawing space using same transform as house
            var elCenter = _rFn72(elXRaw + b2.width / 2, elYRaw + b2.depth / 2);
            var elX = Math.max(0, Math.round(elCenter[0] - b2.width / 2));
            var elY = Math.max(0, Math.round(elCenter[1] - b2.depth / 2));
            var elId = "osm_" + b2.osm_id;
            // Don't add duplicates
            if (newElements.some(function(e) { return e.id === elId; })) continue;
            newElements.push({
              id: elId,
              type: mappedType,
              label: mappedType.toUpperCase(),
              x: elX,
              y: elY,
              w: Math.round(b2.width),
              d: Math.round(b2.depth)
            });
            addedCount++;
            console.log("Auto-added " + mappedType + ": " + b2.width + "x" + b2.depth + " at (" + elX + "," + elY + ") from OSM " + b2.osm_id);
          }
          if (addedCount > 0) {
            u("siteElements", newElements);
            console.log("Added " + addedCount + " site elements from OSM building data");
          }
          if (window._trackEvent) window._trackEvent('building_footprint', { width: primary.width, depth: primary.depth, angle: primary.angle, area: primary.area_sqft, osm_id: primary.osm_id });
          // S79c: Compute site plan confidence based on data quality signals
          var _confMessages = [];
          var _confLevel = "high"; // start optimistic
          var _hadOverpassRoad = bldg.nearest_road && bldg.nearest_road.bearing !== undefined;
          if (!_hadOverpassRoad) {
            // No Overpass road data -- street edge is ray-cast only
            _confLevel = "medium";
            _confMessages.push("Street edge detected from address data only. Verify the street is on the correct side.");
          }
          if (placed.method === "centeredFallback") {
            _confLevel = "medium";
            _confMessages.push("House position is approximate. Drag to adjust if needed.");
          }
          if (primary.source === "google_solar" && primary.solar_meta) {
            // Solar data available -- good signal for dimensions
          } else {
            _confLevel = _confLevel === "high" ? "medium" : "low";
            _confMessages.push("House dimensions are estimated. Please verify width and depth.");
          }
          if (_confMessages.length === 0) {
            _confMessages.push("Street, position, and dimensions verified against satellite data.");
          }
          u("_siteplanLoading", false);
          u("_siteplanConfidence", { level: _confLevel, messages: _confMessages });
          if (guideActive) guideAdvance('verify_extracted');
        })
        .catch(function(err) {
          console.log("Building footprint lookup failed (attempt " + attempt + "):", err.message);
          if (attempt < 2) {
            console.log("Retrying building footprint lookup...");
            setTimeout(function() { _doFootprintLookup(attempt + 1); }, 2000);
          } else {
            setFootprintFailed(true);
            u("_siteplanLoading", false);
            u("_siteplanConfidence", { level: "low", messages: ["Building detection failed. Dimensions are estimated from tax records.", "Verify house width, depth, and position."] });
            if (guideActive) guideAdvance('verify_extracted');
          }
        });
        };
        _doFootprintLookup(1);
        // S73: Expose retry function for manual retry button
        window._retryFootprint = function() { _doFootprintLookup(1); };
      }
      // Advance guide to verify
      if (window._markProjectEdited) window._markProjectEdited();
      // S96.5: guideAdvance so this lands in guideHistory (see _doParcelLookup).
      if (guideActive) guideAdvance(data.location.lat && data.location.lng ? 'footprint_loading' : 'verify_extracted');
      // Track event
      if (window._trackEvent) window._trackEvent('parcel_lookup', { address: parcelAddress, state: parcelState, lot_width: data.lot.width, lot_depth: data.lot.depth, building_sqft: data.building.sqft });
    })
    .catch(function(err) {
      setParcelLoading(false);
      setParcelError("Network error: " + err.message);
      // S96.5: rollback on error -- sync the async-safe mirror too.
      if (guideActive) { guidePhaseRef.current = 'address_lookup'; setGuidePhase('address_lookup'); }
    });
  }

  // S49: AI Guide state
  // S63: Default to guided mode (was null=choice screen). Users go straight
  // to "How should we get your property info?" with AI helper visible.
  // Manual mode still accessible via "Switch to manual" link.
  const [guideActive, setGuideActive] = _stUS(true);

  // S60: Permit readiness check state
  const [permitCheck, setPermitCheck] = _stUS(null);
  const [permitCheckLoading, setPermitCheckLoading] = _stUS(false);
  _stUE(function() {
    if (step !== 4) return;
    setPermitCheckLoading(true);
    fetch("/api/check-permit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    }).then(function(r) { return r.json(); }).then(function(d) {
      setPermitCheck(d);
      setPermitCheckLoading(false);
    }).catch(function() { setPermitCheckLoading(false); });
  }, [step, p.width, p.depth, p.height, p.attachment, p.joistSpacing,
      p.snowLoad, p.frostZone, p.beamType, p.hasStairs, p.deckingType,
      p.overJoist, p.overBeam, p.overPostSize, p.overPostCount, p.overFooting]);

  // S96.5: Real sheet previews for the Review step.
  // Fetched ONE SHEET AT A TIME, in order, so the gallery paints progressively
  // instead of sitting blank for ~2s waiting on the whole set. Cover and deck
  // plan land first because they are the most convincing. A render token guards
  // against a stale in-flight sequence overwriting a newer design's sheets.
  const [previewSheets, setPreviewSheets] = _stUS([]);
  // S96.5: when the title-block data is complete we show it as confirmable rows;
  // this flips it back to the editable form on request.
  const [infoEditing, setInfoEditing] = _stUS(false);
  const [previewDone, setPreviewDone] = _stUS(0);
  const [lightbox, setLightbox] = _stUS(null);
  const [lightboxPng, setLightboxPng] = _stUS(null);
  const previewTokenRef = React.useRef(0);
  const coverImgRef = React.useRef(null);
  // S97: collapsed-materials toggle.
  const [materialsOpen, setMaterialsOpen] = _stUS(false);

  _stUE(function() {
    if (step !== 4) return;
    var token = ++previewTokenRef.current;
    setPreviewDone(0);
    setLightbox(null);
    fetch("/api/preview-manifest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (token !== previewTokenRef.current) return;
      var list = (d.sheets || []).map(function(s) {
        return { no: s.no, name: s.name, png: null, error: null };
      });
      setPreviewSheets(list);
      // S97: the cover sheet embeds the 3D perspective. capture3D renders it
      // offscreen; gate only the start of the walk on it (with a timeout so a
      // slow/absent renderer can't hang the gallery), then include it on the
      // cover (idx 0) fetch so the preview cover matches the real PDF cover.
      var coverCapP = Promise.resolve(null);
      try {
        if (window.capture3D) {
          coverCapP = Promise.race([
            window.capture3D(p, c).catch(function() { return null; }),
            new Promise(function(res) { setTimeout(function() { res(null); }, 1500); })
          ]);
        }
      } catch (e) { coverCapP = Promise.resolve(null); }
      coverCapP.then(function(coverB64) {
      if (token !== previewTokenRef.current) return;
      if (coverB64) coverImgRef.current = coverB64;
      // Walk the sheets in series. Sequential (not parallel) on purpose: each
      // render is a matplotlib figure on the server, and firing 7-8 at once
      // just queues them anyway while making the first one arrive later.
      var i = 0;
      function next() {
        if (token !== previewTokenRef.current || i >= list.length) return;
        var idx = i++;
        var body = Object.assign({}, p, { _sheet_index: idx, _dpi: 55 });
        if (idx === 0 && coverB64) body.coverImage = coverB64;
        fetch("/api/preview-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(function(r) { return r.json(); }).then(function(sh) {
          if (token !== previewTokenRef.current) return;
          setPreviewSheets(function(prev) {
            var copy = prev.slice();
            if (copy[idx]) copy[idx] = Object.assign({}, copy[idx], { png: sh.png || null, error: sh.error || null });
            return copy;
          });
          setPreviewDone(function(n) { return n + 1; });
          next();
        }).catch(function() {
          if (token !== previewTokenRef.current) return;
          setPreviewSheets(function(prev) {
            var copy = prev.slice();
            if (copy[idx]) copy[idx] = Object.assign({}, copy[idx], { error: "fetch failed" });
            return copy;
          });
          setPreviewDone(function(n) { return n + 1; });
          next();
        });
      }
      next();
      });
    }).catch(function() {
      if (token !== previewTokenRef.current) return;
      setPreviewSheets([]);
    });
  }, [step, p.width, p.depth, p.height, p.attachment, p.joistSpacing,
      p.snowLoad, p.frostZone, p.beamType, p.hasStairs, p.deckingType,
      p.railType, p.framingType, JSON.stringify(p.zones || []),
      JSON.stringify(p.deckStairs || [])]);

  // S96.5: pull a full-resolution copy when a sheet is opened. The gallery runs
  // at dpi 20 to stay light; the lightbox needs real detail to be worth opening.
  _stUE(function() {
    setLightboxPng(null);
    if (lightbox == null) return;
    var token = previewTokenRef.current;
    var body = Object.assign({}, p, { _sheet_index: lightbox, _dpi: 100 });
    if (lightbox === 0 && coverImgRef.current) body.coverImage = coverImgRef.current;
    fetch("/api/preview-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function(r) { return r.json(); }).then(function(sh) {
      if (token !== previewTokenRef.current) return;
      if (sh && sh.png) setLightboxPng(sh.png);
    }).catch(function() {});
  }, [lightbox]);

  // S54: AI Helper chat state - persists across step changes via window
  if (!window._chatMessages) window._chatMessages = [];
  const [chatMessages, setChatMessages] = _stUS(window._chatMessages);
  const [chatLoading, setChatLoading] = _stUS(false);
  // Sync to window on every change
  _stUE(function() { window._chatMessages = chatMessages; }, [chatMessages]);

  // S54: Apply actions helper (shared between streaming and non-streaming)
  function _applyActions(actions) {
    if (!actions || actions.length === 0) return;
    actions.forEach(function(act) {
      if (act.param && act.value !== undefined) u(act.param, act.value);
      if (act.navigate) {
        // S56: Ensure prerequisite state before navigating to conditional sections
        var _stairSections = { stairs: true, stairTemplate: true, advanced: true };
        if (_stairSections[act.navigate] && !p.hasStairs) {
          u("hasStairs", true);
          // Extra delay for React to re-render the section into the DOM
          setTimeout(function() { _navigateToSection(act.navigate); }, 350);
        } else {
          _navigateToSection(act.navigate);
        }
      }
      if (act.siteElementUpdate) {
        var upd = act.siteElementUpdate;
        var els = (p.siteElements || []).slice();
        if (upd.index >= 0 && upd.index < els.length) {
          var el = Object.assign({}, els[upd.index]);
          if (upd.x !== undefined) el.x = upd.x;
          if (upd.y !== undefined) el.y = upd.y;
          if (upd.w !== undefined) el.w = upd.w;
          if (upd.d !== undefined) el.d = upd.d;
          if (upd.type !== undefined) el.type = upd.type;
          if (upd.label !== undefined) el.label = upd.label;
          els[upd.index] = el;
          u("siteElements", els);
        }
      }
      if (act.siteElementAdd) {
        var newEl = act.siteElementAdd;
        var els2 = (p.siteElements || []).slice();
        els2.push({ type: newEl.type || "shed", label: newEl.label || "", x: newEl.x || 0, y: newEl.y || 0, w: newEl.w || 10, d: newEl.d || 10 });
        u("siteElements", els2);
      }
      if (act.siteElementRemove) {
        var rmIdx = act.siteElementRemove.index;
        var els3 = (p.siteElements || []).slice();
        if (rmIdx >= 0 && rmIdx < els3.length) { els3.splice(rmIdx, 1); u("siteElements", els3); }
      }
      // S73: Reset house position to auto-detected values
      if (act.resetHousePosition) {
        if (p._autoHouseOffset != null) u("houseOffsetSide", p._autoHouseOffset);
        if (p._autoHouseDist != null) u("houseDistFromStreet", p._autoHouseDist);
        if (p._autoHouseWidth != null) u("houseWidth", p._autoHouseWidth);
        if (p._autoHouseDepth != null) u("houseDepth", p._autoHouseDepth);
      }
      // S56: Zone add action - creates L-shaped, wraparound, extensions
      if (act.zoneAdd) {
        if (window.atZoneCap && window.atZoneCap(p)) {
          // S87: 3-zone cap (AI action path) -- skip only this action
        } else {
        var za = act.zoneAdd;
        var newZoneId = p.nextZoneId;
        addZone(za.parentId || 0, za.edge || "left");
        setTimeout(function() {
          if (za.width) updateZone(newZoneId, "w", za.width);
          if (za.depth) updateZone(newZoneId, "d", za.depth);
        }, 100);
        }
      }
      // S56: Cutout add action - creates notches in deck
      if (act.cutoutAdd) {
        var ca = act.cutoutAdd;
        var cutId = p.nextZoneId;
        addCutout(ca.parentId || 0, ca.edge || "front");
        setTimeout(function() {
          if (ca.width) updateZone(cutId, "w", ca.width);
          if (ca.depth) updateZone(cutId, "d", ca.depth);
        }, 100);
      }
      // S56: Chamfer set action - angled corners
      if (act.chamferSet) {
        var cs = act.chamferSet;
        setCorner(cs.zoneId != null ? cs.zoneId : 0, cs.corner, cs.enabled ? "chamfer" : "square", cs.size || 3);
      }
      // S56: Zone remove action
      if (act.zoneRemove) {
        removeZone(act.zoneRemove.zoneId || act.zoneRemove);
      }
      // S70: Zone update action - resize existing zones
      if (act.zoneUpdate) {
        var zu = act.zoneUpdate;
        if (zu.zoneId != null) {
          if (zu.width) updateZone(zu.zoneId, "w", zu.width);
          if (zu.depth) updateZone(zu.zoneId, "d", zu.depth);
          if (zu.label) updateZone(zu.zoneId, "label", zu.label);
        }
      }
    });
  }

  function sendChatMessage(msg, imageData) {
    var userMsg = { role: "user", text: msg };
    if (imageData) userMsg.image = { thumbUrl: imageData.thumbUrl };
    setChatMessages(function(prev) { return prev.concat([userMsg]); });
    setChatLoading(true);
    // S55: Track AI helper message
    if (window._trackEvent) window._trackEvent('ai_helper_message', { message_length: msg.length, step: step, guide_phase: guidePhase, has_image: !!imageData });

    var extSummary = "";
    if (extractResult) {
      var er = extractResult;
      var parts = [];
      if (er.area) parts.push("Lot area: " + er.area + " sq ft");
      if (er.edges && er.edges.length > 0) parts.push("Edges: " + er.edges.map(function(e) { return (e.length || "?") + "'"; }).join(", "));
      if (er.streetName) parts.push("Street: " + er.streetName);
      if (er.houseWidth) parts.push("House width: " + er.houseWidth + "'");
      if (er.houseDepth) parts.push("House depth: " + er.houseDepth + "'");
      extSummary = parts.join(". ");
    }

    // S56: Build compare mode context for AI helper
    var compareContext = "";
    if (compareMode && shapeCandidates.length > 0) {
      compareContext = "COMPARE MODE ACTIVE: User is choosing between " + shapeCandidates.length + " lot shape candidates.\n";
      shapeCandidates.forEach(function(c, i) {
        compareContext += "  Shape " + (i + 1) + " (index " + i + "): " + c.edges.length + " edges, area=" + c.area + " SF";
        if (c.edges) {
          var edgeLens = c.edges.map(function(e) { return Math.round(e.length) + "'"; });
          compareContext += ", edge lengths: " + edgeLens.join(", ");
        }
        compareContext += "\n";
      });
      if (rankingInProgress) {
        compareContext += "AI ranking is IN PROGRESS (analyzing survey to recommend best shape).\n";
      } else if (rankingResult && !rankingResult.failed) {
        compareContext += "AI RECOMMENDATION: Shape " + (rankingResult.bestShapeIndex + 1) + " (index " + rankingResult.bestShapeIndex + "), confidence: " + (rankingResult.confidence || "unknown");
        if (rankingResult.reason) compareContext += ". Reason: " + rankingResult.reason;
        compareContext += "\n";
      } else if (rankingResult && rankingResult.failed) {
        compareContext += "AI ranking failed. User must choose manually.\n";
      }
    }

    var apiHistory = chatMessages.map(function(m) { return { role: m.role, text: m.text }; });

    // Add placeholder assistant message for streaming
    var streamIdx;
    setChatMessages(function(prev) { streamIdx = prev.length; return prev.concat([{ role: "assistant", text: "", actions: [] }]); });

    fetch(API + "/api/ai-helper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message: msg, step: step, params: p, history: apiHistory, extractionSummary: extSummary, compareContext: compareContext, guidePhase: guidePhase, sessionId: window._sbSessionId || "", anonymousId: window._sbAnonymousId || "", image: imageData ? { b64: imageData.b64, mediaType: imageData.mediaType } : null })
    }).then(function(res) {
      if (!res.ok) throw new Error("Server error: " + res.status);
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = "";
      var streamText = "";

      function processStream() {
        return reader.read().then(function(result) {
          if (result.done) {
            setChatLoading(false);
            return;
          }
          buf += decoder.decode(result.value, { stream: true });
          while (buf.indexOf("\n\n") >= 0) {
            var idx = buf.indexOf("\n\n");
            var line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 2);
            if (!line.startsWith("data: ")) continue;
            try {
              var evt = JSON.parse(line.slice(6));
              if (evt.t) {
                // Token delta - append to streaming message
                streamText += evt.t;
                var displayText = streamText;
                // Strip ACTIONS line from display if partially visible
                var actIdx = displayText.lastIndexOf("\nACTIONS:");
                if (actIdx >= 0) displayText = displayText.slice(0, actIdx);
                setChatMessages(function(prev) {
                  var updated = prev.slice();
                  var last = Object.assign({}, updated[updated.length - 1]);
                  last.text = displayText;
                  updated[updated.length - 1] = last;
                  return updated;
                });
              }
              if (evt.d) {
                // Done - set final message, separate suggestions from direct actions
                var allActions = evt.actions || [];
                var directActions = [];
                var suggestions = [];
                allActions.forEach(function(act) {
                  if (act.suggest) {
                    suggestions = act.suggest;
                  } else {
                    directActions.push(act);
                  }
                });
                setChatMessages(function(prev) {
                  var updated = prev.slice();
                  var last = Object.assign({}, updated[updated.length - 1]);
                  last.text = evt.msg || streamText;
                  last.actions = directActions;
                  if (suggestions.length > 0) last.suggestions = suggestions;
                  updated[updated.length - 1] = last;
                  return updated;
                });
                _applyActions(directActions);
                setChatLoading(false);
              }
            } catch(e) { /* skip malformed SSE */ }
          }
          return processStream();
        });
      }
      return processStream();
    }).catch(function(err) {
      setChatLoading(false);
      setChatMessages(function(prev) {
        var updated = prev.slice();
        if (updated.length > 0 && updated[updated.length - 1].role === "assistant" && !updated[updated.length - 1].text) {
          updated[updated.length - 1] = { role: "assistant", text: "Connection error. Please try again." };
        } else {
          updated = updated.concat([{ role: "assistant", text: "Connection error. Please try again." }]);
        }
        return updated;
      });
    });
  }

  // S54: Navigate to a UI section - expand, scroll, highlight
  function _navigateToSection(sectionId) {
    // Expand relevant collapsed sections
    var expandMap = {
      "lotHouse": function() { setShowLotHouse(true); },
      "siteElements": function() { setShowSiteElements(true); },
      "upload": function() { setShowUpload(true); },
      "advanced": function() { setShowAdvanced(true); }
    };
    if (expandMap[sectionId]) expandMap[sectionId]();

    // Scroll and highlight after a brief delay (so expanded content renders)
    setTimeout(function() {
      var el = document.querySelector('[data-section="' + sectionId + '"]');
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Pulse highlight
      el.style.transition = "box-shadow 0.3s ease, outline 0.3s ease";
      el.style.outline = "2px solid #3d5a2e";
      el.style.boxShadow = "0 0 16px rgba(61,90,46,0.25)";
      el.style.borderRadius = "8px";
      setTimeout(function() {
        el.style.outline = "none";
        el.style.boxShadow = "none";
      }, 2000);
    }, 150);
  }

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
  // S96.5: mirror of guidePhase that is always current, even inside async
  // callbacks that captured an older render. guideAdvance reads this.
  var guidePhaseRef = React.useRef(guidePhase);
  _stUE(function() { guidePhaseRef.current = guidePhase; }, [guidePhase]);

  function guideAdvance(nextPhase) {
    // S96.5: use the phase REF, not the render closure. Async callers (the
    // parcel/footprint lookups) call guideAdvance twice from a single closure --
    // once at start, again in .then() -- so a closed-over `guidePhase` would
    // push a stale value and lose a step of history.
    var fromPhase = guidePhaseRef.current;
    if (fromPhase === nextPhase) return; // no-op advance
    guidePhaseRef.current = nextPhase;
    setGuideHistory(function(hist) {
      if (hist.length && hist[hist.length - 1] === fromPhase) return hist;
      return hist.concat([fromPhase]);
    });
    setGuidePhase(nextPhase);
    // S55: Expose guide phase for tracking and track phase change
    window._currentGuidePhase = nextPhase;
    if (window._trackEvent) window._trackEvent('guide_phase_change', { from_phase: fromPhase, to_phase: nextPhase });
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

  // S52: Skip transient phases that are not meaningful to return to.
  // S96.5: 'extracting' was the only one listed, but address_verifying and
  // footprint_loading are equally transient -- going Back into one stranded the
  // user on a spinner with no way out.
  var _GUIDE_TRANSIENT = ['extracting', 'address_verifying', 'footprint_loading'];

  function guideBack() {
    setGuideHistory(function(prev) {
      var copy = prev.slice();
      var last = copy.pop();
      while (_GUIDE_TRANSIENT.indexOf(last) >= 0 && copy.length > 0) {
        last = copy.pop();
      }
      if (last && _GUIDE_TRANSIENT.indexOf(last) < 0) {
        guidePhaseRef.current = last; // S96.5: keep the async-safe mirror current
        setGuidePhase(last);
      }
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
        var el = document.querySelector('[data-section="lotHouse"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      return;
    }
    if (act.action === 'expand_site_elements') {
      setShowSiteElements(true);
      setGuidePeeked(function(prev) { var copy = Object.assign({}, prev); copy.siteElements = true; return copy; });
      setTimeout(function() {
        var el = document.querySelector('[data-section="siteElements"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
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
    // S55: Track guide choice
    if (window._trackEvent) window._trackEvent('guide_choice', { choice: mode });
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
    // S96.5: Step 0 (Site Plan) had NO branch here while steps 1-4 all reset
    // their phase on entry. So coming BACK to Site Plan -- after skipping ahead,
    // or just to look up a different address -- left the guide parked on a
    // later step's phase (e.g. 's1_deck_size'), which renders that step's
    // sections and no address form. The panel looked alive but had no way back
    // to the lookup. Reset to an address-step phase on entry.
    var _s0 = (guidePhase.indexOf('s1_') === 0 || guidePhase.indexOf('s2_') === 0 ||
               guidePhase.indexOf('s3_') === 0 || guidePhase.indexOf('s4_') === 0 ||
               guidePhase === 'complete');
    if (step === 0 && _s0) {
      setGuideHistory([]);
      setGuidePeeked({});
      // Keep the work: if a lot is already loaded, land on the verify screen
      // (which now carries the address form, so a NEW lookup is still one
      // click away). With no lot yet, go back to the top of the address flow.
      var _next = p.lotVertices ? 'verify_extracted' : 'has_survey';
      guidePhaseRef.current = _next;
      setGuidePhase(_next);
    }
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
      // S52: Reset function for "Start over" button in compare mode
      window._resetExtraction = function() { setExtractResult(null); if (guideActive) { setGuidePhase('upload_survey'); setGuideHistory([]); } };
      // S52: Auto-enter compare mode when shapes found and survey exists
      if (sitePlanB64 && setCompareMode && !compareMode) {
        setCompareMode(true);
        if (guideActive) guideAdvance('shape_select');
        setTimeout(function() { window.scrollTo({ top: 0, behavior: "smooth" }); }, 50);
      }
      window._selectShape = function(ci) {
        var cand = shapeCandidates[ci];
        if (!cand) return;
        // S55: Track shape confirmed
        if (window._trackEvent) window._trackEvent('shape_confirmed', { shape_index: ci, source: 'manual', candidate_count: shapeCandidates.length });
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
      window._resetExtraction = null;
    }
  }, [shapeCandidates, extractResult]);

  // S52: Stage 2 - Background Opus shape ranking
  _stUE(function() {
    if (!compareMode || shapeCandidates.length === 0 || !sitePlanB64 || rankingInProgress || rankingResult) return;
    setRankingInProgress(true);
    window._rankingInProgress = true;
    console.log("Stage 2: Sending " + shapeCandidates.length + " candidates to Opus for ranking...");
    var fileType = sitePlanFile && sitePlanFile.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image";
    var candidateData = shapeCandidates.map(function(c) {
      return { vertices: c.vertices, area: c.area, edges: c.edges };
    });
    (async function() {
      try {
        var res = await fetch(API + "/api/rank-shapes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ surveyData: sitePlanB64, candidates: candidateData, fileType: fileType, streetSide: extractResult && extractResult.streetSide || "bottom" })
        });
        var data = await res.json();
        console.log("Stage 2 response ok:", data.ok);
        if (data.ok && data.data) {
          console.log("Stage 2 success:", JSON.stringify(data.data));
          setRankingResult(data.data);
          window._rankingResult = data.data;
          // S55: Track shape ranking complete
          if (window._trackEvent) window._trackEvent('shape_ranking_complete', { best_index: data.data.bestShapeIndex, confidence: data.data.confidence || '', streetSide: data.data.streetSide || '' });
          // S56: Track auto-mirror if streetSide triggers it
          if (data.data.streetSide === 'top' && window._trackEvent) window._trackEvent('auto_mirror_fired', { streetSide: 'top' });
          // S54: Adjust northAngle for canonical lot orientation (street-at-bottom)
          // Opus returns north relative to survey drawing; our rendering rotates the lot
          // based on streetSide, so north arrow must rotate by the same amount.
          var _ssAdj = { bottom: 0, top: 180, right: 90, left: 270 };
          var _rawNorth = data.data.northAngle || 0;
          var _ss = data.data.streetSide || "bottom";
          u("northAngle", (_rawNorth + (_ssAdj[_ss] || 0)) % 360);
          var idx = data.data.bestShapeIndex;
          if (idx != null && idx >= 0 && idx < shapeCandidates.length && window._onPreviewShape) {
            window._onPreviewShape(idx);
          }
        } else {
          console.error("Stage 2 failed:", data.error || "unknown error");
          setRankingResult({ failed: true, error: data.error });
        }
      } catch(e) {
        console.error("Shape ranking error:", e);
        setRankingResult({ failed: true, error: e.message });
      }
      setRankingInProgress(false);
      window._rankingInProgress = false;
      console.log("Shape ranking complete. Result:", window._rankingResult || "none");
    })();
  }, [compareMode, shapeCandidates, sitePlanB64, rankingInProgress, rankingResult]);

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
        chatMessages={chatMessages} chatLoading={chatLoading} onSendMessage={sendChatMessage} onApplyActions={_applyActions} setChatMessages={setChatMessages}
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
            color: isActive ? col : _br.mu, display: "inline-flex", alignItems: "center", gap: 4
          }}>{isCut ? "\u2702 " : ""}{z.label || "Zone " + z.id}
            <span onClick={function(e) { e.stopPropagation(); if (confirm("Delete " + (z.label || "Zone " + z.id) + "?")) removeZone(z.id); }} style={{
              marginLeft: 2, fontSize: 11, lineHeight: "1", color: isCut ? "#fca5a5" : "#93c5fd", cursor: "pointer", fontWeight: 400
            }} onMouseEnter={function(e) { e.target.style.color = "#ef4444"; }} onMouseLeave={function(e) { e.target.style.color = isCut ? "#fca5a5" : "#93c5fd"; }}>{"\u00D7"}</span></button>;
        })}
      </div>
    </div>}

    {/* Active zone header (when not zone 0) -- S80: editable label */}
    {!isZone0 && <div style={{ marginBottom: 12, padding: "8px 12px", background: isCutout ? "#fef2f2" : "#eff6ff", borderRadius: 6, border: `1px solid ${isCutout ? "#fca5a5" : "#bfdbfe"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <input type="text" value={activeLabel} onChange={e => updateZone(p.activeZone, "label", e.target.value)} style={{
          fontSize: 12, fontWeight: 800, color: isCutout ? "#dc2626" : "#2563eb", fontFamily: _mono,
          border: "none", background: "transparent", outline: "none", width: "100%", padding: 0
        }} />
        <button onClick={() => removeZone(p.activeZone)} style={{
          padding: "5px 12px", fontSize: 9, fontWeight: 700, borderRadius: 5, fontFamily: _mono, cursor: "pointer",
          border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", flexShrink: 0, marginLeft: 8
        }}>Delete</button>
      </div>
      <div style={{ fontSize: 9, color: isCutout ? "#ef4444" : "#60a5fa", fontFamily: _mono }}>{isCutout ? "Cutout (subtracts from parent)" : `Add zone (${zoneW}' x ${zoneD}')`}</div>
    </div>}

// {/* Width / Depth / Height sliders   zone-aware */}
    <div data-section="deckSize">
    <Slider label={isZone0 ? "Width (along house)" : "Width"} value={zoneW} min={isCutout ? 2 : 4} max={50} step={0.5} fmt={fmtFtIn} field="width" u={u} p={p} />
    <Slider label={isZone0 ? "Depth (from house)" : "Depth"} value={zoneD} min={isCutout ? 2 : 4} max={24} step={0.5} fmt={fmtFtIn} field="depth" u={u} p={p} />
    {isZone0 && c.engineeringRequired && <div style={{ padding: "8px 10px", background: "#fef2f2", borderRadius: 6, border: "1px solid #fca5a5", marginBottom: 8, marginTop: -4 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#dc2626", fontFamily: _mono, marginBottom: 3 }}>{"\u26A0\uFE0F"} EXCEEDS IRC PRESCRIPTIVE LIMITS</div>
      <div style={{ fontSize: 8, color: "#991b1b", fontFamily: _mono, lineHeight: 1.5 }}>
        Deck depth ({p.depth}') exceeds the IRC prescriptive limit of {c.maxDepthForJoists}' for 2x12 joists @ {c.sp}" O.C. at {c.LL} PSF.
        A licensed engineer or architect is required for this design.
        Reduce depth to {c.maxDepthForJoists}' or less for permit-ready plans.
      </div>
    </div>}
    {isZone0 && <Slider label="Height above grade" value={p.height} min={1} max={14} step={0.5} fmt={fmtFtIn} field="height" u={u} p={p} />}
    {!isZone0 && activeZoneObj && activeZoneObj.type === "add" && <>
      <Slider label="Zone height" value={zoneH} min={1} max={14} step={0.5} fmt={fmtFtIn} field="height" u={u} p={p} />
      {zoneH !== p.height && <div style={{ fontSize: 9, color: "#d97706", fontFamily: _mono, marginTop: -4, marginBottom: 8, fontStyle: "italic" }}>
        Different from main deck ({fmtFtIn(p.height)}). PDF elevation views will reflect this in a future update.
      </div>}
    </>}
    </div>

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

    {/* S81e: Height transition warnings on shared edges + satisfaction/orphan detection.
        Upgrades the S81b warning panel to:
          1. Turn each warning row green when a matching transitional stair exists
             (anchor on higher zone, lands on lower zone, location matches the
             shared edge per inferStairLanding()).
          2. Show an "Add compliant stair" one-click button when a warning is
             unsatisfied and the class is a case that requires a stair
             (multi-step, guarded). The stair is anchored on the higher zone
             with the correct destination pre-filled via getStairDestinations.
          3. Surface an orphan-stair advisory if any stair in the deck has
             fromH <= toH (e.g. user dragged a zone height below the stair's
             landing after the stair was placed).
    */}
    {!isZone0 && activeZoneObj && activeZoneObj.type === "add" && (() => {
      if (typeof window.getSharedEdges !== "function" || typeof window.classifyHeightDelta !== "function") return null;
      var _edges = window.getSharedEdges(p) || [];
      var _mine = _edges.filter(function(e) { return (e.aId === p.activeZone || e.bId === p.activeZone) && e.deltaIn >= 0.5; });

      // S81e: Detect orphan stairs (same logic as Python resolve_stair_elevation.directionValid == false).
      // An orphan is a stair whose anchor is now at or below its landing -- the stair
      // no longer represents a valid descending transition. Does NOT remove the stair;
      // surfaces an advisory so the user can decide to keep or remove it.
      function _zoneH(zid) {
        if (zid === 0) return p.height || 4;
        var zlist = p.zones || [];
        for (var zi = 0; zi < zlist.length; zi++) if (zlist[zi].id === zid) {
          return (zlist[zi].h != null) ? zlist[zi].h : (p.height || 4);
        }
        return p.height || 4;
      }
      var _hasOrphan = (p.deckStairs || []).some(function(s) {
        var fromH = _zoneH(s.zoneId || 0);
        var toH = (s._landsOnZoneId != null) ? _zoneH(s._landsOnZoneId) : 0;
        return fromH <= toH;
      });

      if (_mine.length === 0 && !_hasOrphan) return null;

      var _plan = window.suggestRiserPlan;

      // S81e: Does an existing transitional stair already serve this edge?
      // Rule: anchor on higher zone, lands on lower zone, and the stair's
      // location maps to this same shared edge (verified via inferStairLanding,
      // which is the same helper the UI uses when stair location changes).
      function _existingStairForEdge(edge) {
        var higherId = edge.aH >= edge.bH ? edge.aId : edge.bId;
        var lowerId  = edge.aH >= edge.bH ? edge.bId : edge.aId;
        var stairs = p.deckStairs || [];
        for (var si = 0; si < stairs.length; si++) {
          var s = stairs[si];
          if ((s.zoneId || 0) !== higherId) continue;
          if (s._landsOnZoneId !== lowerId) continue;
          // Location-on-edge check: use inferStairLanding if available. It
          // computes the landing zone id based on the stair's location; if it
          // matches the lower zone, the stair serves this edge.
          if (typeof window.inferStairLanding === "function") {
            var inferred = window.inferStairLanding(s, p);
            if (inferred !== lowerId) continue;
          }
          return s;
        }
        return null;
      }

      // S81e: One-click compliant stair for the higher zone of this edge.
      // Uses the same addStair(zoneId, dest) signature as the destination
      // buttons in the Stairs section, so the resulting stair is identical to
      // one the user would create manually.
      function _addCompliantStair(edge) {
        var higherId = edge.aH >= edge.bH ? edge.aId : edge.bId;
        var lowerId  = edge.aH >= edge.bH ? edge.bId : edge.aId;
        if (typeof window.getStairDestinations !== "function") return;
        var dests = window.getStairDestinations(higherId, pForZones) || [];
        var match = null;
        for (var di = 0; di < dests.length; di++) {
          if (dests[di].landsOnZoneId === lowerId) { match = dests[di]; break; }
        }
        if (!match) return; // destination not resolvable; UI out of sync, skip silently
        addStair(higherId, match);
      }

      return (
        <div style={{ marginBottom: 16, padding: 10, border: `1px solid ${_br.bd}`, borderLeft: `3px solid #d97706`, borderRadius: 4, background: "#fffbeb" }}>
          <div style={{ fontSize: 11, fontFamily: _mono, fontWeight: 800, color: "#92400e", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Height transition</div>
          {_mine.map(function(e, idx) {
            var cls = window.classifyHeightDelta(e.deltaIn);
            var otherId = e.aId === p.activeZone ? e.bId : e.aId;
            var otherLabel = otherId === 0 ? "Main Deck" : ("Zone " + otherId);

            // Delta formatting (unchanged from S81b)
            var _whole = Math.floor(e.deltaIn);
            var _frac = e.deltaIn - _whole;
            var _eighths = Math.round(_frac * 8);
            var _fracStr = "";
            if (_eighths === 8) { _whole += 1; }
            else if (_eighths > 0) {
              var _num = _eighths, _den = 8;
              while (_num % 2 === 0 && _den % 2 === 0) { _num /= 2; _den /= 2; }
              _fracStr = " " + _num + "/" + _den;
            }
            var deltaStr = _whole + "\"" + _fracStr;

            // S81e: Check for existing matching stair
            var _existing = _existingStairForEdge(e);
            var _isSatisfied = !!_existing;
            var _requiresStair = (cls === 'multi-step' || cls === 'guarded');
            var _showAddButton = !_isSatisfied && _requiresStair;

            // Warning message (unchanged classification -> text logic)
            var msg, isError = false;
            if (cls === 'tripping') { msg = "Step is below 4\" minimum riser (R311.7.5.1). Match heights or increase the difference."; isError = true; }
            else if (cls === 'single-step') { msg = "Single step required. Add a transitional step on this edge."; }
            else if (cls === 'multi-step') { var pl = _plan(e.deltaIn); msg = "Transitional stair required: " + pl.nRisers + " risers @ " + pl.riserHeightIn.toFixed(2) + "\". No guard required (under 30\")."; }
            else if (cls === 'guarded') { var pl2 = _plan(e.deltaIn); msg = "Stair required: " + pl2.nRisers + " risers @ " + pl2.riserHeightIn.toFixed(2) + "\". Guard required on the higher side (R312.1.1, drop > 30\")." + (pl2.needsHandrail ? " Handrail required (4+ risers, R311.7.8)." : ""); }
            else if (cls === 'over-max') { msg = "Transition exceeds 12'-3\" max between landings (R311.7.3). An intermediate landing is required and not yet supported."; isError = true; }
            else { msg = ""; }

            // S81e: Color + prefix depend on satisfaction state
            var rowColor, rowBorder, rowBackground, rowPrefix;
            if (_isSatisfied) {
              rowColor = "#166534";         // green
              rowBorder = "transparent";
              rowBackground = "#f0fdf4";
              rowPrefix = "\u2713 Stair placed -- ";
            } else if (isError) {
              rowColor = "#991b1b";
              rowBorder = "transparent";
              rowBackground = "transparent";
              rowPrefix = "";
            } else {
              rowColor = "#92400e";
              rowBorder = "transparent";
              rowBackground = "transparent";
              rowPrefix = "";
            }

            var aboveOrBelow = (e.aH > e.bH && e.aId === p.activeZone) || (e.bH > e.aH && e.bId === p.activeZone) ? "above" : "below";

            return (
              <div key={idx} style={{
                fontSize: 10, color: rowColor, marginBottom: idx < _mine.length - 1 ? 6 : 0,
                lineHeight: 1.45, padding: _isSatisfied ? "4px 6px" : 0, borderRadius: 4,
                background: rowBackground
              }}>
                <span style={{ fontWeight: 700 }}>{otherLabel}</span>: {deltaStr} {aboveOrBelow} ({e.length.toFixed(1)}' edge). {rowPrefix}{msg}
                {_showAddButton && (
                  <div style={{ marginTop: 4 }}>
                    <button onClick={function() { _addCompliantStair(e); }} style={{
                      fontSize: 10, fontFamily: _mono, fontWeight: 700,
                      padding: "4px 10px", borderRadius: 4, cursor: "pointer",
                      border: "1px solid " + _br.gn, background: "#fff", color: _br.gn
                    }}>+ Add compliant stair</button>
                  </div>
                )}
              </div>
            );
          })}

          {/* S81e: Orphan-stair advisory. Single line, no buttons -- per the
              scoping decision, don't build a remove/dismiss UX in this
              session; surface information only. */}
          {_hasOrphan && (
            <div style={{ fontSize: 9, color: "#92400e", marginTop: 8, paddingTop: 6, borderTop: "1px solid #fde68a", fontStyle: "italic" }}>
              One or more stairs may no longer match your deck's current heights. Check the Stairs section above.
            </div>
          )}
        </div>
      );
    })()}

    {/* S80: Per-zone beam type toggle (zones 1+ add type) */}
    {!isZone0 && activeZoneObj && activeZoneObj.type === "add" && (() => {
      // S81: flush beam invalid when zone is at a different elevation than main deck
      var _mainH = p.deckHeight || 4;
      var _zoneH = activeZoneObj.h != null ? activeZoneObj.h : _mainH;
      var _heightMismatch = activeZoneObj.h != null && Math.abs(_zoneH - _mainH) > 0.01;
      var _effectiveBT = _heightMismatch ? "dropped" : (activeZoneObj.beamType || "dropped");
      return (
      <div style={{ marginBottom: 16 }}>
        <Label>Beam type</Label>
        <div style={{ display: "flex", gap: 6 }}>
          {["flush", "dropped"].map(bt => {
            var _disabled = bt === "flush" && _heightMismatch;
            var _selected = _effectiveBT === bt;
            return (
            <button key={bt} disabled={_disabled} onClick={() => { if (!_disabled) updateZone(p.activeZone, "beamType", bt); }} style={{ flex: 1, padding: "6px 4px", fontSize: 11, fontFamily: _mono, cursor: _disabled ? "not-allowed" : "pointer", borderRadius: 4, border: `1px solid ${_selected ? _br.ac : _br.bd}`, background: _selected ? _br.ac : "#fff", color: _disabled ? "#bbb" : (_selected ? "#fff" : _br.mu), fontWeight: _selected ? 700 : 400, textTransform: "capitalize", opacity: _disabled ? 0.55 : 1 }}>{bt === "dropped" ? "Dropped" : "Flush"}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 9, color: _br.mu, marginTop: 4, fontStyle: "italic" }}>
          {_heightMismatch
            ? "Flush beam unavailable: zone is at a different height than the main deck, so the rim board cannot carry its joists. Dropped beam with posts to grade is required."
            : (_effectiveBT === "flush"
                ? "Rim board acts as beam. No posts or footings needed for this zone."
                : "Separate beam below joists with posts and footings.")}
        </div>
      </div>
      );
    })()}

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
    {!isCutout && <div data-section="chamfer" style={{ marginBottom: 16, padding: 12, background: _br.wr, borderRadius: 8, border: `1px solid ${_br.bd}` }}>
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

// {/*   Zone 0 only: house width, attachment   */}
    {isZone0 && <>
      <Slider label="House width" value={p.houseWidth} min={20} max={80} field="houseWidth" u={u} p={p} />
      <div data-section="attachment">
      <Chips label="Attachment" field="attachment" opts={[["ledger", "Ledger Board"], ["freestanding", "Freestanding"]]} u={u} p={p} />
      </div>
    </>}

// {/*   S64: Per-zone stairs (all zones)   */}
    {(() => {
      var azId = p.activeZone || 0;
      var zoneStairs = (p.deckStairs || []).filter(function(s) { return s.zoneId === azId; });
      var azRect = window.getZoneRect ? window.getZoneRect(azId, pForZones) : null;
      if (!azRect && azId === 0) azRect = { x: 0, y: 0, w: p.width, d: p.depth };
      var zW = azRect ? azRect.w : p.width;
      var zD = azRect ? azRect.d : p.depth;

      return <div data-section="stairs" style={{ marginBottom: 16 }}>
        <Label>Stairs</Label>
        {zoneStairs.length === 0 && <div style={{ fontSize: 11, color: _br.mu, fontFamily: _mono, marginBottom: 8 }}>No stairs on this zone</div>}
        {zoneStairs.map(function(st) {
          var stU = function(f, v) { updateStair(st.id, f, v); };
          var maxW = st.location === "front" ? zW : zD;
          return <div key={st.id} style={{ padding: 12, marginBottom: 8, background: _br.wr, borderRadius: 8, border: "1px solid " + _br.bd }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: _mono, color: _br.tx }}>Stair {st.id}</span>
              <button onClick={function() { removeStair(st.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#c62828", fontWeight: 700, lineHeight: 1 }}>{"\u00D7"}</button>
            </div>
            <Chips label="Location" field="location" opts={[["front", "Front"], ["left", "Left"], ["right", "Right"]]} u={stU} p={st} />
            <Slider label="Width" value={st.width} min={3} max={maxW} step={0.5} fmt={fmtFtIn} field="width" u={stU} p={st} />
            <Slider label="Stringers" value={st.numStringers} min={2} max={5} field="numStringers" unit="" u={stU} p={st} />
            <div style={{ marginBottom: 8 }}>
              <Label>Template</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                {[["straight","Straight"],["lLeft","L-Left"],["lRight","L-Right"],["switchback","U-Turn"],["wrapAround","Wrap"],["wideLanding","Platform"]].map(function(arr) {
                  var key = arr[0], name = arr[1];
                  return <button key={key} onClick={function() { stU("template", key); }} style={{
                    padding: "6px 2px", borderRadius: 5, cursor: "pointer", textAlign: "center", fontSize: 9, fontFamily: _mono,
                    border: st.template === key ? "2px solid " + _br.gn : "1px solid " + _br.bd,
                    background: st.template === key ? "#edf5e8" : "#fff",
                    color: st.template === key ? _br.gn : _br.tx, fontWeight: st.template === key ? 700 : 400
                  }}>{stairIcon(key)}<div style={{ marginTop: 1 }}>{name}</div></button>;
                })}
              </div>
            </div>
            {["lLeft","lRight","switchback","wrapAround","wideLanding"].includes(st.template) && <>
              <Slider label="Run Split" value={st.runSplit != null ? st.runSplit : 55} min={30} max={70} step={5} field="runSplit" unit="%" u={stU} p={st} />
              <Slider label="Landing Depth" value={st.landingDepth != null ? st.landingDepth : Math.max(st.width || 4, 4)} min={3} max={8} step={0.5} field="landingDepth" fmt={fmtFtIn} u={stU} p={st} />
            </>}
            {["switchback","wrapAround"].includes(st.template) &&
              <Slider label="Gap Between Runs" value={st.stairGap != null ? st.stairGap : 0.5} min={0} max={2} step={0.5} field="stairGap" fmt={fmtFtIn} u={stU} p={st} />
            }
            <Slider label="Offset from center" value={st.offset || 0} min={-Math.floor(((st.location === "front" ? zW : zD) - (st.width || 4)) / 2)} max={Math.floor(((st.location === "front" ? zW : zD) - (st.width || 4)) / 2)} field="offset" u={stU} p={st} />
          </div>;
        })}
        {/* S81d.5: One button per valid destination (ground + adjacent lower zones) */}
        {(() => {
          var dests = window.getStairDestinations ? window.getStairDestinations(azId, pForZones) : [{ label: "Ground", landsOnZoneId: null, location: "front" }];
          return dests.map(function(dest, di) {
            var labelText = "+ Add stairs to " + dest.label;
            return <button key={"dest-" + di} onClick={function() { addStair(azId, dest); }} style={{ width: "100%", padding: "8px 14px", marginTop: di === 0 ? 0 : 6, background: "none", border: "1px dashed " + _br.gn, borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: _mono, color: _br.gn, fontWeight: 600 }}>{labelText}</button>;
          });
        })()}
      </div>;
    })()}

      <div data-section="advanced">
      <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ width: "100%", padding: "8px 14px", marginBottom: 12, background: "none", border: `1px solid ${_br.bd}`, borderRadius: 6, cursor: "pointer", fontSize: 10, fontFamily: _mono, color: _br.mu, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Positioning (drag in preview or set here)</span>
        <span style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "0.2s" }}>{"\u25BE"}</span>
      </button>
      {showAdvanced && <div style={{ padding: 14, background: _br.wr, borderRadius: 8, border: `1px solid ${_br.bd}`, marginBottom: 12 }}>
        <Slider label="Deck offset from center" value={p.deckOffset} min={-Math.floor(p.houseWidth / 2)} max={Math.floor(p.houseWidth / 2)} field="deckOffset" u={u} p={p} />
      </div>}
      </div>{/* close data-section="advanced" */}

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

      {/* S73: Footprint detection failure warning */}
      {footprintFailed && guideActive && guidePhase === 'verify_extracted' && <div style={{ padding: "10px 14px", background: "#fefce8", borderRadius: 8, border: "1px solid #fde68a", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontFamily: _sans, color: "#92400e", fontWeight: 600, marginBottom: 4 }}>{"\u26A0"} House detection unavailable</div>
        <div style={{ fontSize: 10, fontFamily: _sans, color: "#92400e", lineHeight: 1.5, marginBottom: 8 }}>We could not detect your house from satellite data. The lot shape is correct, but house size and position may need manual adjustment.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={function() { if (window._retryFootprint) { setFootprintFailed(false); window._retryFootprint(); } }} style={{ fontSize: 10, fontFamily: _mono, color: "#fff", background: _br.gn, border: "none", borderRadius: 4, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>Retry Detection</button>
          <button onClick={function() { setFootprintFailed(false); }} style={{ fontSize: 10, fontFamily: _mono, color: _br.mu, background: "none", border: "1px solid " + _br.bd, borderRadius: 4, padding: "5px 12px", cursor: "pointer" }}>Dismiss</button>
        </div>
      </div>}

      {/* S49: Intro text (manual mode or after choosing) */}
      {(guideActive === false) && <div style={{ fontSize: 11, color: _br.tx, fontFamily: _sans, lineHeight: 1.7, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span>Your permit office needs a site plan showing your property, house, and proposed deck. Enter your lot dimensions below to generate one automatically.</span>
        <button onClick={function() { setGuideActive(true); setGuidePhase('has_survey'); }} style={{
          fontSize: 9, fontFamily: _mono, color: _br.gn, background: "none",
          border: "1px solid " + _br.gn + "44", borderRadius: 4, padding: "4px 10px",
          cursor: "pointer", flexShrink: 0, marginLeft: 10, whiteSpace: "nowrap"
        }}>Switch to guided</button>
      </div>}

      {/* === ADDRESS LOOKUP (S63) === */}
      {guideSectionShown('addressLookup') && <div data-section="addressLookup" style={{ padding: 18, background: "#fff", borderRadius: 10, border: "1px solid " + _br.bd, marginBottom: 14, boxShadow: "0 2px 12px rgba(26,31,22,0.06)" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: _br.dk, fontFamily: _sans, letterSpacing: "-0.2px", marginBottom: 3 }}>Find your property</div>
        <div style={{ fontSize: 11.5, color: _br.mu, fontFamily: _sans, lineHeight: 1.5, marginBottom: 12 }}>Enter your address and we'll pull your lot lines, setbacks, and house footprint from public records.</div>
        <input type="text" placeholder="Street address (e.g. 123 Main St)" value={parcelAddress}
          onChange={function(e) { setParcelAddress(e.target.value); setParcelError(null); }}
          style={{ width: "100%", padding: "10px 12px", fontSize: 12, fontFamily: _mono, border: "1px solid " + _br.bd, borderRadius: 6, marginBottom: 8, boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input type="text" placeholder="City" value={parcelCity}
            onChange={function(e) { setParcelCity(e.target.value); }}
            style={{ flex: 1, padding: "10px 12px", fontSize: 12, fontFamily: _mono, border: "1px solid " + _br.bd, borderRadius: 6, boxSizing: "border-box" }} />
          <input type="text" placeholder="ST" value={parcelState} maxLength={2}
            onChange={function(e) { setParcelState(e.target.value.toUpperCase()); setParcelError(null); }}
            style={{ width: 55, padding: "10px 12px", fontSize: 12, fontFamily: _mono, border: "1px solid " + _br.bd, borderRadius: 6, textTransform: "uppercase", boxSizing: "border-box" }} />
          <input type="text" placeholder="ZIP" value={parcelZip} maxLength={5}
            onChange={function(e) { setParcelZip(e.target.value.replace(/\D/g, '')); }}
            style={{ width: 70, padding: "10px 12px", fontSize: 12, fontFamily: _mono, border: "1px solid " + _br.bd, borderRadius: 6, boxSizing: "border-box" }} />
        </div>
        <button disabled={!parcelAddress || !parcelState || parcelLoading} onClick={_doParcelLookup}
          style={{ width: "100%", padding: "12px 16px", fontSize: 12, fontWeight: 700, fontFamily: _mono, color: "#fff", marginBottom: 8,
            background: (!parcelAddress || !parcelState || parcelLoading) ? _br.mu : _br.gn,
            border: "none", borderRadius: 6, cursor: (!parcelAddress || !parcelState || parcelLoading) ? "default" : "pointer" }}>
          {parcelLoading ? "Finding your lot..." : "Find my lot"}
        </button>
        {parcelError && <div style={{ fontSize: 11, color: "#dc2626", fontFamily: _mono, padding: "8px 10px", background: "#fef2f2", borderRadius: 6, marginBottom: 8 }}>
          {parcelError}
        </div>}
        <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, lineHeight: 1.5 }}>
          Nothing is submitted anywhere. We only read public parcel records, and you can adjust everything after we find it.
        </div>
      </div>}

      {/* Other ways in: survey upload + manual, ranked like the mock. Shown wherever
          the address lookup is (so on a failed lookup the error sits right above these). */}
      {guideSectionShown('addressLookup') && <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: _br.mu, fontFamily: _sans, marginBottom: 8, paddingLeft: 2 }}>Other ways in</div>
        <input id="sitePlanInputAlt" type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: "none" }} onChange={function(e) {
          var file = e.target.files[0]; if (!file) return;
          setSitePlanFile(file);
          setSitePlanMode("upload");
          if (window._trackEvent) window._trackEvent('survey_upload', { file_type: file.name.split('.').pop(), file_size: file.size, source: 'alt_ways_in' });
          var reader = new FileReader();
          reader.onload = function() { setSitePlanB64(reader.result.split(",")[1]); };
          reader.readAsDataURL(file);
          e.target.value = "";
        }} />
        <button onClick={function() { var el = document.getElementById("sitePlanInputAlt"); if (el) el.click(); }}
          onMouseOver={function(e) { e.currentTarget.style.borderColor = _br.gn; }}
          onMouseOut={function(e) { e.currentTarget.style.borderColor = _br.bd; }}
          style={{ width: "100%", textAlign: "left", background: "#fff", border: "1px solid " + _br.bd, borderRadius: 8, padding: "12px 14px", marginBottom: 8, cursor: "pointer", display: "block", transition: "border-color 0.15s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: _br.dk, fontFamily: _sans }}>Upload a survey</span>
            <span style={{ fontSize: 8, fontFamily: _mono, fontWeight: 700, color: _br.gn, border: "1px solid " + _br.gn, borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap", letterSpacing: "0.5px" }}>BEST IF YOU HAVE ONE</span>
          </div>
          <div style={{ fontSize: 10.5, color: _br.mu, fontFamily: _sans, lineHeight: 1.45 }}>Your survey is the most accurate source there is. We read the lot lines, dimensions, house, and north arrow off the page, and you just confirm.</div>
        </button>
        <button onClick={function() { if (window._trackEvent) window._trackEvent('guide_choice', { choice: 'manual', source: 'alt_ways_in' }); setGuideActive(false); setShowLotHouse(true); setTimeout(function() { var el = document.querySelector('[data-section="lotHouse"]'); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 90); }}
          onMouseOver={function(e) { e.currentTarget.style.borderColor = _br.mu; }}
          onMouseOut={function(e) { e.currentTarget.style.borderColor = _br.bd; }}
          style={{ width: "100%", textAlign: "left", background: "#fff", border: "1px solid " + _br.bd, borderRadius: 8, padding: "12px 14px", cursor: "pointer", display: "block", transition: "border-color 0.15s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: _br.dk, fontFamily: _sans }}>Enter my lot manually</span>
            <span style={{ fontSize: 8, fontFamily: _mono, fontWeight: 700, color: _br.mu, border: "1px solid " + _br.bd, borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap", letterSpacing: "0.5px" }}>LAST RESORT</span>
          </div>
          <div style={{ fontSize: 10.5, color: _br.mu, fontFamily: _sans, lineHeight: 1.45 }}>Use this if the lookup can't find your parcel and you don't have a survey. You'll set the lot size, house position, and setbacks yourself.</div>
        </button>
        <div style={{ fontSize: 9.5, color: _br.mu, fontFamily: _sans, marginTop: 8, paddingLeft: 2 }}>Whichever way in, you confirm everything before designing.</div>
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
      {guideSectionVisible('lotHouse', showLotHouse) && <div data-section="lotHouse" style={{ padding: 14, background: _br.wr, borderRadius: "0 0 8px 8px", border: "1px solid " + _br.bd, borderTop: "none", marginBottom: 14 }}>
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
        {p._autoHouseOffset != null ? <>
          {!showHouseAdj ? <div style={{ padding: "8px 10px", background: "#f0fdf4", borderRadius: 6, border: "1px solid #bbf7d0", marginBottom: 12 }}>
            <div style={{ fontSize: 8, fontFamily: _mono, color: _br.gn, fontWeight: 600, marginBottom: 4 }}>{"\u2713"} Auto-detected from satellite data</div>
            <div style={{ fontSize: 8, fontFamily: _mono, color: _br.mu }}>House: {p.houseWidth}' x {p.houseDepth}', offset {p.houseOffsetSide}' from left, {p.houseDistFromStreet}' from street</div>
            <button onClick={function() { setShowHouseAdj(true); }} style={{ marginTop: 6, fontSize: 8, fontFamily: _mono, color: _br.dk, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>Adjust manually</button>
          </div> : <div>
            <div style={{ padding: "8px 10px", background: "#fefce8", borderRadius: 6, border: "1px solid #fde68a", marginBottom: 8 }}>
              <div style={{ fontSize: 8, fontFamily: _mono, color: "#92400e", fontWeight: 600 }}>{"\u26A0"} Only adjust if the position doesn't match your property</div>
            </div>
            <Slider label="House width" value={p.houseWidth} min={20} max={80} field="houseWidth" u={u} p={p} focused={guideFieldFocused('houseWidth')} />
            <Slider label="House depth" value={p.houseDepth} min={20} max={60} field="houseDepth" u={u} p={p} focused={guideFieldFocused('houseDepth')} />
            <Slider label="House offset from left property line" value={p.houseOffsetSide} min={0} max={Math.max(5, p.lotWidth - p.houseWidth - 5)} field="houseOffsetSide" u={u} p={p} focused={guideFieldFocused('houseOffsetSide')} />
            <Slider label="House distance from street" value={p.houseDistFromStreet || p.setbackFront} min={0} max={Math.max(p.setbackFront + 1, p.lotDepth - p.houseDepth - 10)} field="houseDistFromStreet" u={u} p={p} focused={guideFieldFocused('houseDistFromStreet')} />
            {(p.houseOffsetSide !== p._autoHouseOffset || p.houseDistFromStreet !== p._autoHouseDist || p.houseWidth !== p._autoHouseWidth || p.houseDepth !== p._autoHouseDepth) && <button onClick={function() {
              u("houseOffsetSide", p._autoHouseOffset);
              u("houseDistFromStreet", p._autoHouseDist);
              u("houseWidth", p._autoHouseWidth);
              u("houseDepth", p._autoHouseDepth);
            }} style={{ fontSize: 8, fontFamily: _mono, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, padding: "4px 8px", cursor: "pointer", marginBottom: 8 }}>{"\u21A9"} Reset to detected values</button>}
            <button onClick={function() { setShowHouseAdj(false); }} style={{ fontSize: 8, fontFamily: _mono, color: _br.mu, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", display: "block", marginBottom: 8 }}>Hide adjustments</button>
          </div>}
        </> : <>
          <Slider label="House width" value={p.houseWidth} min={20} max={80} field="houseWidth" u={u} p={p} focused={guideFieldFocused('houseWidth')} />
          <Slider label="House depth" value={p.houseDepth} min={20} max={60} field="houseDepth" u={u} p={p} focused={guideFieldFocused('houseDepth')} />
          <Slider label="House offset from left property line" value={p.houseOffsetSide} min={5} max={Math.max(5, p.lotWidth - p.houseWidth - 5)} field="houseOffsetSide" u={u} p={p} focused={guideFieldFocused('houseOffsetSide')} />
          <Slider label="House distance from street" value={p.houseDistFromStreet || p.setbackFront} min={p.setbackFront} max={Math.max(p.setbackFront + 1, p.lotDepth - p.houseDepth - 10)} field="houseDistFromStreet" u={u} p={p} focused={guideFieldFocused('houseDistFromStreet')} />
        </>}
        <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginTop: -4, marginBottom: 12, fontStyle: "italic" }}>Front setback is the minimum ({p.setbackFront}'). Your house may sit further back.</div>
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
          {guideSectionVisible('siteElements', showSiteElements) && <div data-section="siteElements" style={{ padding: 14, background: _br.wr, borderRadius: "0 0 8px 8px", border: "1px solid " + _br.bd, borderTop: "none", marginBottom: 14 }}>
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
        return <div data-section="northArrow" style={{ padding: 14, background: _br.wr, borderRadius: 8, border: "1px solid " + _br.bd, marginBottom: 14 }}>
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
      {guideSectionVisible('slope', guideActive === false) && <div data-section="slope" style={{ padding: 14, background: _br.wr, borderRadius: 8, border: "1px solid " + _br.bd, marginBottom: 14 }}>
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
      {guideSectionVisible('upload', showUpload || !!sitePlanFile) && <div data-section="upload" style={{ padding: 14, background: _br.wr, borderRadius: "0 0 8px 8px", border: "1px solid " + _br.bd, borderTop: "none", marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, marginBottom: 10, lineHeight: 1.6, padding: "8px 10px", background: "#fff", borderRadius: 6, border: "1px solid " + _br.bd }}>
          {"\uD83D\uDCA1"} Upload your property survey, plat map, or site plan. This will be included as a separate sheet in your blueprint package. The dimensions above will still be used for the generated site plan.
        </div>
        <div style={{ textAlign: "center", padding: 20, border: "2px dashed " + (sitePlanFile ? _br.gn : _br.bd), borderRadius: 8, background: sitePlanFile ? "#edf5e8" : "#fff", cursor: "pointer", position: "relative" }}
          onClick={function() { document.getElementById("sitePlanInput").click(); }}>
          <input id="sitePlanInput" type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: "none" }} onChange={function(e) {
            var file = e.target.files[0]; if (!file) return;
            setSitePlanFile(file);
            setSitePlanMode("upload");
            // S55: Track survey upload
            if (window._trackEvent) window._trackEvent('survey_upload', { file_type: file.name.split('.').pop(), file_size: file.size });
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
                // S55: Track extraction success
                if (window._trackEvent) window._trackEvent('extraction_complete', { success: true, edge_count: (data.data.lotEdges||[]).length, area: data.data.lotArea||0, confidence: data.data.confidence||'' });
                // S52: Store site plan page index for SurveyPreview
                if (data.sitePageIndex != null) window._sitePageIndex = data.sitePageIndex;
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
                // S55: Track extraction failure
                if (window._trackEvent) window._trackEvent('extraction_error', { error: data.error || 'Extraction failed' });
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
              // S55: Track extraction exception
              if (window._trackEvent) window._trackEvent('extraction_error', { error: e.message });
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


      {extractResult && !traceMode && !compareMode && !(sitePlanB64 && shapeCandidates.length > 0) && <div style={{ padding: 14, background: "#eff6ff", borderRadius: 8, border: "1px solid #93c5fd", marginBottom: 14 }}>
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
      {(!guideActive || (guidePhase !== 'has_survey' && guidePhase !== 'address_lookup' && guidePhase !== 'address_verifying' && guidePhase !== 'footprint_loading')) && <div style={{ padding: 14, background: _br.wr, borderRadius: 8, border: "1px solid " + _br.bd, marginBottom: 14 }}>
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
      </div>}

      {/* === SETBACK WARNINGS (always visible) === */}
      {spWarnings.length > 0 && <div style={{ padding: 12, background: "#fff8e1", borderRadius: 8, border: "1px solid #ffe082", marginBottom: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#f57f17", fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>{"\u26A0\uFE0F"} Setback Warnings</div>
        {spWarnings.map(function(w, i) { return <div key={i} style={{ fontSize: 10, color: "#e65100", fontFamily: _mono, lineHeight: 1.6, marginBottom: 2 }}>{"\u2022"} {w}</div>; })}
        <div style={{ fontSize: 8, color: "#f57f17", fontFamily: _mono, marginTop: 6, fontStyle: "italic" }}>Adjust your deck size in Step 2 or setbacks above to resolve.</div>
      </div>}

      {/* === LOT COVERAGE (always visible) === */}
      <div style={{ padding: 10, background: _br.wr, borderRadius: 8, border: "1px solid " + _br.bd }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 9, color: _br.mu, fontFamily: _mono }}>Lot Coverage (house + deck) <span title="Lot coverage is the percentage of your total lot area that is covered by structures (house, deck, garage, etc.). Most zoning codes limit this to 30-50% to ensure adequate open space, drainage, and setback compliance. Check with your local building department for your specific limit." style={{ cursor: "help", display: "inline-block", width: 13, height: 13, lineHeight: "13px", textAlign: "center", borderRadius: "50%", background: _br.bd, color: _br.mu, fontSize: 8, fontWeight: 700 }}>?</span></span>
          <span style={{ fontSize: 11, fontWeight: 700, color: parseFloat(coveragePct) > 45 ? "#e65100" : _br.gn, fontFamily: _mono }}>{coveragePct}%</span>
        </div>
        <div style={{ height: 4, background: "#e0e0e0", borderRadius: 2, marginTop: 6 }}>
          <div style={{ height: "100%", background: parseFloat(coveragePct) > 45 ? "#ff9800" : _br.gn, borderRadius: 2, width: Math.min(100, parseFloat(coveragePct)) + "%", transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginTop: 4 }}>Most codes cap at 30-50%. Check your local zoning ordinance.</div>
      </div>

      {/* Guide panel: moved to the BOTTOM on step 0 so its chat box isn't mistaken for the address bar. It's a helper here, not the entry point. */}
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
        if (guidePhase === 'site_elements_check') {
          var _existingEls = (p.siteElements || []);
          if (_existingEls.length > 0) {
            var _elNames = _existingEls.map(function(e) { return e.label || e.type; }).join(", ");
            s0Msg = "We found: " + _elNames + ". Anything else on your lot?";
            s0Tip = "If everything looks right, continue to the next step.";
          }
        }
        return <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid " + _br.bd }}><GuidePanel
          phase={guidePhase}
          onAction={guideHandleAction}
          onBack={guideBack}
          history={guideHistory}
          onToggleOff={function() { setGuideActive(false); }}
          message={s0Msg}
          tip={s0Tip}
          chatMessages={chatMessages} chatLoading={chatLoading} onSendMessage={sendChatMessage} onApplyActions={_applyActions} setChatMessages={setChatMessages}
        /></div>;
      })()}

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
      chatMessages={chatMessages} chatLoading={chatLoading} onSendMessage={sendChatMessage} onApplyActions={_applyActions} setChatMessages={setChatMessages}
    />}
    <div data-section="structure">
    {/* S75: Framing type selector */}
    <div style={{ marginBottom: 16 }}>
      <Label>Framing System</Label>
      <div style={{ display: "flex", gap: 6 }}>
        {[["wood", "\uD83E\uDEB5 Wood (IRC R507)"], ["steel", "\u2699\uFE0F Steel (Fortress Evolution)"]].map(function(arr) {
          var val = arr[0], label = arr[1];
          var isActive = (p.framingType || "wood") === val;
          var steelColor = "#4a90d9";
          var activeColor = val === "steel" ? steelColor : _br.gn;
          return <button key={val} onClick={function() { u("framingType", val); }} style={{
            flex: 1, padding: "10px 8px", borderRadius: 6, fontSize: 11, fontFamily: _mono, cursor: "pointer",
            border: isActive ? ("2px solid " + activeColor) : ("1px solid " + _br.bd),
            background: isActive ? (val === "steel" ? "#eef4fc" : "#edf5e8") : "#fff",
            color: isActive ? activeColor : _br.mu,
            fontWeight: isActive ? 700 : 400, transition: "all 0.15s", textAlign: "center"
          }}>{label}</button>;
        })}
      </div>
      {(p.framingType || "wood") === "steel" && <div style={{ fontSize: 9, color: "#4a90d9", fontFamily: _mono, marginTop: 6, padding: "6px 10px", background: "#eef4fc", borderRadius: 6, border: "1px solid #c5d9f0", lineHeight: 1.6 }}>
        Fortress Evolution steel framing system. Spans validated per Intertek CCRR-0313. All connections use Fortress brackets and 3/4" self-tapping screws.
      </div>}
    </div>

    {/* S75: Steel-specific controls */}
    {(p.framingType || "wood") === "steel" && <>
      <Chips label="Steel gauge" field="steelGauge" opts={[["16", "16 ga (standard)"], ["18", "18 ga (lighter)"]]} u={u} p={p} />
      <Chips label="Joist spacing" field="joistSpacing" opts={[[12, '12" O.C.'], [16, '16" O.C.']]} u={u} p={p} />
      <Chips label="Snow load" field="snowLoad" opts={[["none", "None"], ["light", "Light"], ["moderate", "Moderate"], ["heavy", "Heavy"]]} u={u} p={p} />
      <Chips label="Footing depth (frost line)" field="frostZone" opts={[["warm", '12"'], ["moderate", '24"'], ["cold", '36"'], ["severe", '48"']]} u={u} p={p} />
    </>}

    {/* Wood controls (original) */}
    {(p.framingType || "wood") === "wood" && <>
    <Chips label="Joist spacing" field="joistSpacing" opts={[[12, '12" O.C.'], [16, '16" O.C.'], [24, '24" O.C.']]} u={u} p={p} />
    <Chips label="Snow load" field="snowLoad" opts={[["none", "None"], ["light", "Light"], ["moderate", "Moderate"], ["heavy", "Heavy"]]} u={u} p={p} />
    <Chips label="Footing depth (frost line)" field="frostZone" opts={[["warm", '12"'], ["moderate", '24"'], ["cold", '36"'], ["severe", '48"']]} u={u} p={p} />
    </>}
    </div>

    <div style={{ marginTop: 16, padding: 14, background: _br.wr, borderRadius: 8, border: `1px solid ${_br.bd}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: (p.framingType || "wood") === "steel" ? "#4a90d9" : _br.gn, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase" }}>Structural Members</div>
        <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono }}>{(p.framingType || "wood") === "steel" ? "CCRR-0313 validated" : "AUTO = IRC recommended"}</div>
      </div>

      {/* ===== STEEL STRUCTURAL DISPLAY (S75) ===== */}
      {(p.framingType || "wood") === "steel" && <>
        {/* Joists: always 2x6, gauge already selected above */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: _br.mu, fontFamily: _mono, fontWeight: 700 }}>JOISTS</span>
            <span style={{ fontSize: 8, fontFamily: _mono, padding: "2px 8px", borderRadius: 3, border: "1px solid #c5d9f0", background: "#eef4fc", color: "#4a90d9", fontWeight: 700 }}>FIXED 2x6</span>
          </div>
          <div style={{ padding: "8px 10px", background: "#eef4fc", borderRadius: 6, border: "1px solid #c5d9f0" }}>
            <div style={{ fontSize: 11, fontFamily: _mono, fontWeight: 700, color: "#4a90d9" }}>2x6 {p.steelGauge || "16"}ga Steel @ {c.sp}" O.C.</div>
            <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginTop: 2 }}>
              Span: {c.jSpan}' {c.attachment === "ledger" ? "(ledger to beam)" : "(beam to beam)"}
              {c.steelMaxJoistSpan ? (" \u00B7 Max: " + c.steelMaxJoistSpan.toFixed(1) + "'") : ""}
            </div>
          </div>
        </div>

        {/* Beam: single or double 2x11 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: _br.mu, fontFamily: _mono, fontWeight: 700 }}>BEAM</span>
          </div>
          <Chips label="" field="steelBeamType" opts={[["auto", "Auto"], ["single", "Single 2x11"], ["double", "Double 2x11"]]} u={u} p={p} />
          <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginTop: 2 }}>
            {c.beamSize} {"\u00B7"} Span: {c.bSpan}' between posts
            {c.beamMaxSpan > 0 ? (" (max " + c.beamMaxSpan.toFixed(1) + "')") : ""}
          </div>
        </div>

        {/* Post: fixed 3.5x3.5 steel */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: _br.mu, fontFamily: _mono, fontWeight: 700 }}>POST</span>
            <span style={{ fontSize: 8, fontFamily: _mono, padding: "2px 8px", borderRadius: 3, border: "1px solid #c5d9f0", background: "#eef4fc", color: "#4a90d9", fontWeight: 700 }}>3.5" STEEL</span>
          </div>
          <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono }}>
            Fortress 3.5" x 3.5" galvanized steel post {"\u00B7"} {c.nP} posts
          </div>
          <div style={{ fontSize: 8, color: "#c62828", fontFamily: _mono, marginTop: 2, fontStyle: "italic" }}>
            Steel posts must NOT be buried. Mount on top of pier brackets.
          </div>
        </div>

        {/* Post count override */}
        {(() => { const isOver = !!p.overPostCount; const val = isOver ? p.overPostCount : c.auto.postCount; return (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: _br.mu, fontFamily: _mono, fontWeight: 700 }}>POST COUNT</span>
              <button onClick={() => u("overPostCount", isOver ? null : c.auto.postCount)} style={{ fontSize: 8, fontFamily: _mono, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${isOver ? _br.ac : _br.bd}`, background: isOver ? "#fef9e7" : "#fff", color: isOver ? _br.ac : _br.mu, fontWeight: 700 }}>{isOver ? "MANUAL \u270E" : "AUTO \u2713"}</button>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[2, 3, 4, 5, 6, 7, 8].map(n => (
                <button key={n} onClick={() => isOver && u("overPostCount", n)} style={{ flex: 1, padding: "6px 4px", fontSize: 10, fontFamily: _mono, cursor: isOver ? "pointer" : "default", border: val === n ? `2px solid ${isOver ? _br.ac : "#4a90d9"}` : `1px solid ${_br.bd}`, background: val === n ? (isOver ? "#fef9e7" : "#eef4fc") : (isOver ? "#fff" : "#fafafa"), color: val === n ? (isOver ? _br.ac : "#4a90d9") : (isOver ? _br.tx : "#ccc"), borderRadius: 5, fontWeight: val === n ? 700 : 400, opacity: isOver ? 1 : 0.7, textAlign: "center" }}>
                  {n}{!isOver && n === c.auto.postCount && <div style={{ fontSize: 6, color: "#4a90d9", marginTop: 1 }}>REC</div>}
                </button>
              ))}
            </div>
          </div>
        ); })()}

        {/* Footing diameter */}
        {(() => { const isOver = !!p.overFooting; const val = isOver ? p.overFooting : c.auto.footing; return (
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: _br.mu, fontFamily: _mono, fontWeight: 700 }}>FOOTING DIA.</span>
              <button onClick={() => u("overFooting", isOver ? null : c.auto.footing)} style={{ fontSize: 8, fontFamily: _mono, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${isOver ? _br.ac : _br.bd}`, background: isOver ? "#fef9e7" : "#fff", color: isOver ? _br.ac : _br.mu, fontWeight: 700 }}>{isOver ? "MANUAL \u270E" : "AUTO \u2713"}</button>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[12, 16, 18, 21, 24, 30].map(d => (
                <button key={d} onClick={() => isOver && u("overFooting", d)} style={{ flex: 1, padding: "6px 2px", fontSize: 9, fontFamily: _mono, cursor: isOver ? "pointer" : "default", border: val === d ? `2px solid ${isOver ? _br.ac : "#4a90d9"}` : `1px solid ${_br.bd}`, background: val === d ? (isOver ? "#fef9e7" : "#eef4fc") : (isOver ? "#fff" : "#fafafa"), color: val === d ? (isOver ? _br.ac : "#4a90d9") : (isOver ? _br.tx : "#ccc"), borderRadius: 5, fontWeight: val === d ? 700 : 400, opacity: isOver ? 1 : 0.7, textAlign: "center" }}>
                  {d}"{!isOver && d === c.auto.footing && <div style={{ fontSize: 6, color: "#4a90d9", marginTop: 1 }}>REC</div>}
                </button>
              ))}
            </div>
          </div>
        ); })()}

        <div style={{ height: 1, background: _br.bd, margin: "10px 0" }} />
        <Spec l="Joist Span" v={`${c.jSpan}'`} /><Spec l="Beam Span" v={`${c.bSpan}'`} /><Spec l="Total Load" v={`${c.TL} PSF`} color={_br.rd} />
        <Spec l="Load Case" v={`CCRR ${c.steelLoadCase || "75"} PSF`} color={"#4a90d9"} />
        <Spec l="Code Reference" v="Intertek CCRR-0313" color={"#4a90d9"} />
        {c.warnings.map((w, i) => <div key={i} style={{ fontSize: 10, color: _br.rd, marginTop: 4, fontFamily: _mono }}>{"\u26A0\uFE0F"} {w}</div>)}
      </>}

      {/* ===== WOOD STRUCTURAL DISPLAY (original) ===== */}
      {(p.framingType || "wood") === "wood" && <>

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
          <div style={{ fontSize: 7, color: c.warnings.some(function(w) { return w.indexOf("Joist span") >= 0; }) ? _br.rd : _br.mu, fontFamily: _mono, marginTop: 4 }}>
            Span: {c.jSpan}' {c.attachment === "ledger" ? "(ledger to beam)" : "(beam to beam)"} {"\u00B7"} {c.joistSize}@{c.sp}" O.C.
          </div>
        </div>
      ); })()}

      {(() => { const isOver = !!p.overBeam; const val = isOver ? p.overBeam : c.auto.beam; const opts = ["2-ply 2x6", "2-ply 2x8", "2-ply 2x10", "2-ply 2x12", "3-ply 2x6", "3-ply 2x8", "3-ply 2x10", "3-ply 2x12", "3-ply LVL 1.75x12"]; return (
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
          <div style={{ fontSize: 7, color: c.bSpan > c.beamMaxSpan ? _br.rd : _br.mu, fontFamily: _mono, marginTop: 4 }}>
            Span: {c.bSpan}' between posts {c.beamMaxSpan < 900 ? `(max ${c.beamMaxSpan}' per IRC R507.5)` : '(engineering required)'}
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
            {[2, 3, 4, 5, 6, 7, 8].map(n => (
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

      {/* Per-footing diameter customizer */}
      {c.nP > 1 && <div style={{ marginBottom: 8 }}>
        <button onClick={() => setShowPerFooting(!showPerFooting)} style={{
          fontSize: 9, fontFamily: _mono, color: _br.mu, background: "none", border: "none", cursor: "pointer",
          padding: "2px 0", fontWeight: 600, opacity: 0.8
        }}>{showPerFooting ? "\u25BC" : "\u25B6"} Customize per post ({c.nP} footings)</button>
        {showPerFooting && <div style={{ marginTop: 6, padding: 8, background: "#fafaf8", borderRadius: 6, border: "1px solid " + _br.bd }}>
          <div style={{ fontSize: 8, color: _br.mu, fontFamily: _mono, marginBottom: 6 }}>Override individual footing diameters. Unset footings use the global value above.</div>
          {(c.pp || []).map(function(pos, idx) {
            var overrides = p.footingOverrides || {};
            var globalDia = p.overFooting || c.auto.footing || 18;
            var curVal = overrides[idx] != null ? overrides[idx] : globalDia;
            var isCustom = overrides[idx] != null;
            return <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontFamily: _mono, color: _br.mu, minWidth: 72 }}>Post {idx + 1} ({window.fmtFtIn(pos)})</span>
              <select value={isCustom ? curVal : ""} onChange={function(e) {
                var newOverrides = Object.assign({}, p.footingOverrides || {});
                if (e.target.value === "") { delete newOverrides[idx]; }
                else { newOverrides[idx] = parseInt(e.target.value); }
                u("footingOverrides", Object.keys(newOverrides).length > 0 ? newOverrides : null);
              }} style={{ fontSize: 9, fontFamily: _mono, padding: "3px 4px", borderRadius: 3, border: "1px solid " + (isCustom ? _br.ac : _br.bd), background: isCustom ? "#fef9e7" : "#fff", color: isCustom ? _br.ac : _br.mu, cursor: "pointer" }}>
                <option value="">{globalDia}" (default)</option>
                {[12, 16, 18, 21, 24, 30].map(function(d) {
                  return <option key={d} value={d}>{d}"</option>;
                })}
              </select>
              {isCustom && <button onClick={function() {
                var newOverrides = Object.assign({}, p.footingOverrides || {});
                delete newOverrides[idx];
                u("footingOverrides", Object.keys(newOverrides).length > 0 ? newOverrides : null);
              }} style={{ fontSize: 8, fontFamily: _mono, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{"\u2715"}</button>}
              {isCustom && curVal < c.auto.footing && <span style={{ fontSize: 7, color: "#dc2626", fontFamily: _mono, fontWeight: 600 }}>{"\u26A0"} below {c.auto.footing}" min</span>}
            </div>;
          })}
        </div>}
      </div>}

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
      </>}
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
        chatMessages={chatMessages} chatLoading={chatLoading} onSendMessage={sendChatMessage} onApplyActions={_applyActions} setChatMessages={setChatMessages}
      />;
    })()}
    <div data-section="materials">
    <Chips label="Decking" field="deckingType" opts={[["composite", "Composite (Trex)"], ["pt_lumber", "Pressure Treated"]]} u={u} p={p} />
    <Chips label="Railing" field="railType" opts={[["fortress", "Fortress Iron"], ["wood", "Wood"]]} u={u} p={p} />
    {/* S58: Guard height with auto/manual toggle */}
    {(() => { const isOver = !!p.overGuardHeight; const val = isOver ? p.overGuardHeight : c.auto.guardHeight; const req = c.guardRequired; return (
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: _br.tx, fontFamily: _mono }}>Guard Height</span>
          <button onClick={() => u("overGuardHeight", isOver ? null : c.auto.guardHeight)} style={{ fontSize: 8, fontFamily: _mono, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${isOver ? _br.ac : _br.bd}`, background: isOver ? "#fef9e7" : "#fff", color: isOver ? _br.ac : _br.mu, fontWeight: 700 }}>{isOver ? "MANUAL \u270E" : "AUTO \u2713"}</button>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[36, 42].map(h =>
            <button key={h} onClick={() => isOver && u("overGuardHeight", h)} style={{ flex: 1, padding: "6px 4px", fontSize: 11, fontFamily: _mono, cursor: isOver ? "pointer" : "default", border: val === h ? `2px solid ${isOver ? _br.ac : _br.gn}` : `1px solid ${_br.bd}`, background: val === h ? (isOver ? "#fef9e7" : "#edf5e8") : (isOver ? "#fff" : "#fafafa"), color: val === h ? (isOver ? _br.ac : _br.gn) : (isOver ? _br.tx : "#ccc"), borderRadius: 5, fontWeight: val === h ? 700 : 400, opacity: isOver ? 1 : 0.7, textAlign: "center" }}>
              {h}"
            </button>
          )}
        </div>
        {req && <div style={{ fontSize: 9, color: _br.mu, marginTop: 4, fontStyle: "italic", fontFamily: _mono }}>Guards required (deck &gt;30" above grade). {c.H > 8 ? "42\" recommended for elevated decks." : "36\" is IRC minimum."}</div>}
        {!req && <div style={{ fontSize: 9, color: _br.mu, marginTop: 4, fontStyle: "italic", fontFamily: _mono }}>Deck is 30" or less above grade. Guards optional but recommended.</div>}
      </div>
    ); })()}
    </div>
    <div data-section="costBreakdown" style={{ marginTop: 16, padding: 14, background: _br.wr, borderRadius: 8, border: `1px solid ${_br.bd}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: _br.gn, marginBottom: 6, fontFamily: _mono, letterSpacing: "1px", textTransform: "uppercase" }}>Cost Breakdown</div>
      {(() => { var allItems = zc ? m.items.concat(zc.extraItems) : m.items; return ["Foundation", "Posts", "Beam", "Ledger", "Framing", "Hardware", "Decking", "Railing", "Misc"].map(cat => { const t = allItems.filter(i => i.cat === cat).reduce((s, i) => s + i.qty * i.cost, 0); return t > 0 ? <Spec key={cat} l={cat} v={`${t.toFixed(0)}`} /> : null; }); })()}
      <div style={{ height: 2, background: _br.gn, margin: "8px 0", opacity: 0.3 }} />
      <Spec l="Subtotal" v={`${(zc ? m.sub + zc.extraSub : m.sub).toFixed(0)}`} /><Spec l="Tax + Contingency" v={`${(zc ? (m.tax + m.cont) + (zc.extraTotal - zc.extraSub) : (m.tax + m.cont)).toFixed(0)}`} /><Spec l="TOTAL" v={`${(zc ? m.total + zc.extraTotal : m.total).toFixed(0)}`} color={_br.gn} />
      <div style={{ fontSize: 9, color: _br.mu, fontFamily: _mono, marginTop: 6, fontStyle: "italic" }}>Based on typical national pricing.</div>
    </div>
  </>;

// Step 4: Review (was Step 3 before S27)
  // S97: shared generate-gate handler used by both the primary CTA and the
  // sticky-footer CTA. Gating is identical to the pre-S97 inline button:
  // required title-block fields -> missing modal; PPRBD unanswered -> pprbd
  // modal; then disclaimer -> generate.
  var _genReqMissing = [];
  if (!info.owner) _genReqMissing.push("Owner / Applicant Name");
  if (!info.address) _genReqMissing.push("Property Address");
  if (!info.city) _genReqMissing.push("City");
  if (!info.state) _genReqMissing.push("State");
  if (!info.zip) _genReqMissing.push("ZIP");
  function handleGenerateClick() {
    if (_genReqMissing.length > 0 && !missingFieldsAcked) { setShowMissingModal(_genReqMissing); return; }
    if (_isPPRBD && !pprbdChecklistAcked) {
      var jcl = p.jurisdictionChecklist || {};
      var hIn = (p.height || 4) * 12;
      var fDep = c.footing_depth || 36;
      var isDet = p.attachmentType === "freestanding";
      var autos = { under18: hIn <= 18, over8ft: hIn >= 96, freestanding: isDet, excavation: fDep > 36 };
      var uKeys = [];
      ["cover", "electrical", "hottub", "cantilever", "under18", "over8ft", "freestanding", "excavation"].forEach(function(k) {
        var v = jcl.hasOwnProperty(k) ? jcl[k] : (autos.hasOwnProperty(k) ? autos[k] : null);
        if (v === null || v === undefined) uKeys.push(k);
      });
      if (uKeys.length > 0) { setShowPprbdModal(uKeys); return; }
    }
    disclaimerAcked ? generateBlueprint() : setShowDisclaimer(true);
  }

  if (step === 4) return <>
    {/* ============================================================
        S97b: Review as a mock-style delivery page. Two columns: the
        rendered sheets lead on the left as the hero; a sticky rail on the
        right carries the summary and the Generate CTA so it stays in view
        while the user scrolls the detail. The AI guide drops to the bottom
        -- on a delivery page it's a helper, not the headline.
        ============================================================ */}
    <div className="sbp-review-row" style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>

      {/* ===== LEFT: hero gallery + detail ===== */}
      <div style={{ flex: "1 1 600px", minWidth: 300 }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: _br.dk, fontFamily: _sans, letterSpacing: "-0.3px", margin: 0 }}>Your permit set is ready</h2>
        <div style={{ fontSize: 13, color: _br.mu, fontFamily: _sans, marginTop: 5 }}>
          {(previewSheets.length || 7)} sheets {"\u00B7"} drawn from your design by the same pipeline that makes your PDF
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gridAutoRows: 178, gap: 14, marginTop: 16 }}>
          {previewSheets.map(function(sh, i) {
            return <div key={i} onClick={function() { if (sh.png) setLightbox(i); }}
              style={{ display: "flex", flexDirection: "column", background: "#fff", border: "1px solid " + _br.bd, borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 14px rgba(26,31,22,0.07)", cursor: sh.png ? "zoom-in" : "default" }}>
              <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", background: sh.png ? "#fff" : _br.wr, padding: 8 }}>
                {sh.png
                  ? <img src={"data:image/png;base64," + sh.png} alt={sh.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
                  : sh.error
                    ? <span style={{ fontSize: 9, fontFamily: _mono, color: _br.rd, padding: 8, textAlign: "center" }}>RENDER ERROR</span>
                    : <span style={{ fontSize: 9, fontFamily: _mono, color: _br.mu, letterSpacing: "1.5px" }}>DRAWING{"\u2026"}</span>}
              </div>
              <div style={{ padding: "6px 10px", borderTop: "1px solid " + _br.bd, background: _br.wr, display: "flex", justifyContent: "space-between", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 8, fontFamily: _mono, fontWeight: 700, color: _br.dk }}>{sh.no}</span>
                <span style={{ fontSize: 8, fontFamily: _mono, color: _br.mu, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sh.name}</span>
              </div>
            </div>;
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: _br.mu, fontFamily: _mono }}>
          {previewSheets.length > 0
            ? (previewDone < previewSheets.length ? (previewDone + " of " + previewSheets.length + " sheets rendered\u2026") : (previewSheets.length + " sheets \u00B7 click any sheet to inspect at full size"))
            : "Rendering your sheets\u2026"}
        </div>

        {/* Permit detail: shown only when NOT ready. */}
        {(() => {
          if (permitCheckLoading || !permitCheck) return null;
          var rpt = permitCheck.permit_report;
          if (rpt.overall_status === "ready") return null;
          var isWarn = rpt.overall_status === "warnings";
          var accent = isWarn ? "#e65100" : "#c62828";
          var failChecks = (rpt.checks || []).filter(function(ck) { return ck.status === "fail"; });
          var gapChecks = rpt.capability_gaps || [];
          return <div style={{ marginTop: 18, padding: "12px 16px", background: "#fff", borderRadius: 8, border: "1px solid " + _br.bd, borderLeft: "3px solid " + accent }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: accent, fontFamily: _sans, marginBottom: failChecks.length || gapChecks.length ? 8 : 0 }}>
              {isWarn ? "Advisories before you submit" : "Issues to resolve"}
            </div>
            {failChecks.map(function(ck, i) { return <div key={i} style={{ fontSize: 11, fontFamily: _sans, color: "#c62828", padding: "5px 0", borderTop: i > 0 ? "1px solid " + _br.bd : "none" }}>
              {"\u2022"} <strong>{ck.message}</strong>
              {ck.fix ? <div style={{ fontSize: 10, color: _br.mu, marginTop: 2, marginLeft: 12 }}>{"\u2192"} {ck.fix}{ck.fix_step != null ? <button onClick={function(){window._wizStep && window._wizStep(ck.fix_step)}} style={{marginLeft:6,fontSize:9,padding:"1px 6px",border:"1px solid "+_br.bd,borderRadius:3,background:"#fff",cursor:"pointer",color:_br.bl}}>Go to Step {ck.fix_step + 1}</button> : null}</div> : null}
            </div>; })}
            {gapChecks.length > 0 && failChecks.length === 0 && gapChecks.map(function(ck, i) { return <div key={i} style={{ fontSize: 11, fontFamily: _sans, color: "#e65100", padding: "5px 0" }}>
              {"\u2022"} {ck.message}
            </div>; })}
          </div>;
        })()}

        {/* Materials: full takeoff kept, collapsed by default behind a summary line */}
        {m && m.items && (() => {
          var allItems = zc ? m.items.concat(zc.extraItems) : m.items;
          var matTotal = (zc ? m.total + zc.extraTotal : m.total).toFixed(0);
          return <div style={{ background: "#fff", borderRadius: 8, border: "1px solid " + _br.bd, marginTop: 14, overflow: "hidden" }}>
            <div onClick={function() { setMaterialsOpen(function(o) { return !o; }); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: _br.dk, fontFamily: _sans }}>Materials & cost estimate</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: _br.mu, fontFamily: _sans }}>{allItems.length} line items {"\u00B7"} ${matTotal} estimated</span>
                <span style={{ fontSize: 17, lineHeight: 1, color: _br.dk, transform: materialsOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>{"\u25BE"}</span>
              </div>
            </div>
            {materialsOpen && <div style={{ padding: "0 18px 16px" }}>
              <div style={{ maxHeight: 300, overflowY: "auto", borderRadius: 6, border: "1px solid " + _br.bd, background: "#fff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: _mono, fontSize: 10 }}>
                  <thead><tr style={{ background: _br.wr }}>
                    <th style={{ textAlign: "left", padding: "5px 8px", color: _br.mu, fontSize: 8 }}>ITEM</th>
                    <th style={{ textAlign: "right", padding: "5px 8px", color: _br.mu, fontSize: 8 }}>QTY</th>
                    <th style={{ textAlign: "right", padding: "5px 8px", color: _br.mu, fontSize: 8 }}>EXT</th>
                  </tr></thead>
                  <tbody>{allItems.map(function(it, i) {
                    return <tr key={i} style={{ borderBottom: `1px solid ${_br.wr}` }}>
                      <td style={{ padding: "4px 8px", color: _br.dk }}>{it.item}</td>
                      <td style={{ padding: "4px 8px", textAlign: "right", color: _br.tx }}>{it.qty}</td>
                      <td style={{ padding: "4px 8px", textAlign: "right", color: _br.mu }}>${(it.qty * it.cost).toFixed(0)}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
              <div style={{ fontSize: 9, color: _br.mu, fontFamily: _sans, fontStyle: "italic", marginTop: 8 }}>
                Estimate only {"\u00B7"} lumber prices vary by supplier and region. Delivered as a separate sheet with your set. Includes tax + 5% contingency.
              </div>
            </div>}
          </div>;
        })()}

        {/* Title block / project information -- confirmable rows, edit on request.
            Kept LAST per the handoff; gating on the required fields is unchanged. */}
        <div data-section="projectInfo" style={{ padding: 18, background: "#fff", borderRadius: 8, border: "1px solid " + _br.bd, marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: _br.dk, fontFamily: _sans, marginBottom: 12 }}>Project information <span style={{ fontWeight: 400, color: _br.mu, fontSize: 11 }}>(prints on the title block)</span></div>
          {(function() {
            var _need = ["owner", "address", "city", "state", "zip"];
            var _missing = _need.filter(function(f) { return !((info[f] || "").toString().trim()); });
            if (infoEditing || _missing.length > 0) return null;
            return <div>
              {[["owner","Owner / Applicant"],["address","Project Address"],["city","City"],["state","State"],["zip","ZIP"],["lot","Lot / Parcel #"],["contractor","Contractor"]].map(function(row) {
                var f = row[0], lbl = row[1], val = (info[f] || "").toString().trim();
                if (!val) return null;
                return <div key={f} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderBottom: `1px solid ${_br.wr}` }}>
                  <span style={{ fontSize: 11, color: _br.mu, fontFamily: _sans }}>{lbl}</span>
                  <span style={{ fontSize: 11, color: _br.dk, fontFamily: _mono, fontWeight: 600, textAlign: "right" }}>{val}</span>
                </div>;
              })}
              <button onClick={function() { setInfoEditing(true); }} style={{ marginTop: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, fontFamily: _sans, color: _br.gn, textDecoration: "underline" }}>Edit project info</button>
            </div>;
          })()}
          {(function() {
            var _need = ["owner", "address", "city", "state", "zip"];
            var _missing = _need.filter(function(f) { return !((info[f] || "").toString().trim()); });
            if (!infoEditing && _missing.length === 0) return null;
            return <div>
          {[["owner", "Owner / Applicant Name"],["address", "Project Address"],["city", "City"]].map(([f, lbl]) => (
            <div key={f} style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: _br.mu, fontFamily: _sans, display: "block", marginBottom: 3 }}>{lbl}</label>
              <input value={info[f]} onChange={e => setI(f, e.target.value)} placeholder={lbl} style={{ width: "100%", padding: "8px 10px", border: !info[f] ? "1.5px solid #f59e0b" : "1px solid " + _br.bd, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: !info[f] ? "#fffbeb" : "#fff", outline: "none" }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: 10, color: _br.mu, fontFamily: _sans, display: "block", marginBottom: 3 }}>State</label><input value={info.state} onChange={e => setI("state", e.target.value)} placeholder="State" style={{ width: "100%", padding: "8px 10px", border: !info.state ? "1.5px solid #f59e0b" : "1px solid " + _br.bd, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: !info.state ? "#fffbeb" : "#fff", outline: "none" }} /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: 10, color: _br.mu, fontFamily: _sans, display: "block", marginBottom: 3 }}>ZIP</label><input value={info.zip} onChange={e => setI("zip", e.target.value)} placeholder="ZIP" style={{ width: "100%", padding: "8px 10px", border: !info.zip ? "1.5px solid #f59e0b" : "1px solid " + _br.bd, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: !info.zip ? "#fffbeb" : "#fff", outline: "none" }} /></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: 10, color: _br.mu, fontFamily: _sans, display: "block", marginBottom: 3 }}>Lot / Parcel #</label><input value={info.lot} onChange={e => setI("lot", e.target.value)} placeholder="Optional" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${_br.bd}`, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: "#fff", outline: "none" }} /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: 10, color: _br.mu, fontFamily: _sans, display: "block", marginBottom: 3 }}>Contractor</label><input value={info.contractor} onChange={e => setI("contractor", e.target.value)} placeholder="Owner-Builder" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${_br.bd}`, borderRadius: 5, fontSize: 12, fontFamily: _mono, color: _br.tx, background: "#fff", outline: "none" }} /></div>
          </div>
            </div>;
          })()}
        </div>

        {/* S50: PPRBD Deck Attachment Sheet checklist (PPRBD jurisdiction only) */}
        {(() => {
          if (!_isPPRBD) return null;

          var heightIn = (p.height || 4) * 12;
          var footingDepth = c.footing_depth || 36;
          var isDetached = p.attachmentType === "freestanding";
          var jcl = p.jurisdictionChecklist || {};

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

          return <div style={{ padding: 16, background: "#f0f7ff", borderRadius: 8, border: unansweredCount > 0 ? "1.5px solid #f59e0b" : "1px solid #bbdefb", marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1565c0", fontFamily: _sans }}>PPRBD Deck Attachment Sheet</div>
              <span style={{ fontSize: 9, color: "#64b5f6", fontFamily: _mono, fontWeight: 400 }}>Pikes Peak Region</span>
            </div>
            <div style={{ fontSize: 11, color: "#5c6b7a", fontFamily: _sans, marginBottom: 12, lineHeight: 1.5 }}>
              Pikes Peak Regional Building Dept. requires this checklist with all deck permits in El Paso County and Woodland Park. Items marked with a green check were auto-filled from your design. Please answer the remaining items or skip when generating.
            </div>
            {unansweredCount > 0 && <div style={{ padding: "6px 10px", background: "#fff8e1", borderRadius: 4, border: "1px solid #ffe082", borderLeft: "3px solid #f59e0b", marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontFamily: _sans, color: "#d97706", fontWeight: 600 }}>{unansweredCount} item{unansweredCount > 1 ? "s" : ""} still need{unansweredCount === 1 ? "s" : ""} your answer</span>
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
                <span style={{ fontSize: 10, fontFamily: _sans, color: _br.tx, lineHeight: 1.5, paddingTop: 2 }}>
                  {item.label}
                  {isAutoFilled && <span style={{ color: "#2e7d32", fontSize: 8, marginLeft: 4 }}>(auto-filled)</span>}
                </span>
              </div>;
            })}
          </div>;
        })()}

        {isProduction && !feedbackDone && <div style={{ padding: 16, background: "#fff8e1", borderRadius: 8, border: "1px solid #ffe082", marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f57f17", fontFamily: _sans, marginBottom: 10 }}>Quick feedback <span style={{ fontWeight: 400, color: "#ffa000", fontSize: 10 }}>(helps us build what you need)</span></div>
          <div style={{ marginBottom: 8 }}><label style={{ fontSize: 10, color: _br.mu, fontFamily: _sans, display: "block", marginBottom: 3 }}>I am a...</label><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{[["diy","DIY Homeowner"],["contractor","Contractor"],["designer","Designer"],["other","Other"]].map(([v,t])=>(<button key={v} onClick={()=>setFeedback(f=>({...f,role:v}))} style={{padding:"5px 12px",borderRadius:5,fontSize:10,fontFamily:_sans,cursor:"pointer",border:feedback.role===v?"2px solid #f57f17":"1px solid "+_br.bd,background:feedback.role===v?"#fff3e0":"#fff",color:feedback.role===v?"#e65100":_br.tx,fontWeight:feedback.role===v?700:400}}>{t}</button>))}</div></div>
          <div style={{ marginBottom: 8 }}><label style={{ fontSize: 10, color: _br.mu, fontFamily: _sans, display: "block", marginBottom: 3 }}>How did you find us?</label><input value={feedback.source} onChange={e=>setFeedback(f=>({...f,source:e.target.value}))} placeholder="Google, Reddit, friend, etc." style={{width:"100%",padding:"6px 10px",border:"1px solid "+_br.bd,borderRadius:5,fontSize:11,fontFamily:_mono,color:_br.tx,background:"#fff",outline:"none"}} /></div>
          <div style={{ marginBottom: 8 }}><label style={{ fontSize: 10, color: _br.mu, fontFamily: _sans, display: "block", marginBottom: 3 }}>What would you pay for this?</label><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{[["$0","$0"],["$25-49","$25\u201349"],["$50-99","$50\u201399"],["$100+","$100+"]].map(([v,t])=>(<button key={v} onClick={()=>setFeedback(f=>({...f,price:v}))} style={{padding:"5px 12px",borderRadius:5,fontSize:10,fontFamily:_sans,cursor:"pointer",border:feedback.price===v?"2px solid #f57f17":"1px solid "+_br.bd,background:feedback.price===v?"#fff3e0":"#fff",color:feedback.price===v?"#e65100":_br.tx,fontWeight:feedback.price===v?700:400}}>{t}</button>))}</div></div>
          <div style={{ marginBottom: 8 }}><label style={{ fontSize: 10, color: _br.mu, fontFamily: _sans, display: "block", marginBottom: 3 }}>Anything confusing or missing? <span style={{ color: "#bbb" }}>(optional)</span></label><textarea value={feedback.feedback} onChange={e=>setFeedback(f=>({...f,feedback:e.target.value}))} placeholder="Your thoughts..." rows={2} style={{width:"100%",padding:"6px 10px",border:"1px solid "+_br.bd,borderRadius:5,fontSize:11,fontFamily:_mono,color:_br.tx,background:"#fff",outline:"none",resize:"vertical"}} /></div>
          <div style={{ marginBottom: 10 }}><label style={{ fontSize: 10, color: _br.mu, fontFamily: _sans, display: "block", marginBottom: 3 }}>Email <span style={{ color: "#bbb" }}>(optional)</span></label><input type="email" value={feedback.email} onChange={e=>setFeedback(f=>({...f,email:e.target.value}))} placeholder="you@example.com" style={{width:"100%",padding:"6px 10px",border:"1px solid "+_br.bd,borderRadius:5,fontSize:11,fontFamily:_mono,color:_br.tx,background:"#fff",outline:"none"}} /></div>
          <button onClick={submitFeedback} disabled={!feedback.role||!feedback.price} style={{padding:"8px 20px",background:!feedback.role||!feedback.price?"#ccc":"#f57f17",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:!feedback.role||!feedback.price?"default":"pointer",fontFamily:_sans}}>Submit feedback</button>
          <span style={{ fontSize: 9, color: "#bbb", fontFamily: _sans, marginLeft: 8 }}>Optional \u2014 helps us build what you need</span>
        </div>}
        {isProduction && feedbackDone && <div style={{padding:10,background:"#e8f5e9",borderRadius:8,border:"1px solid #c8e6c9",marginTop:14,textAlign:"center"}}><span style={{fontSize:11,color:"#2e7d32",fontFamily:_sans,fontWeight:700}}>{"\u2713"} Thanks for your feedback!</span></div>}
      </div>

      {/* ===== RIGHT: summary + CTA + guide rail ===== */}
      <div style={{ flex: "0 0 380px", minWidth: 320 }}>

        {/* Drawing-set note */}
        <div style={{ padding: 16, background: "#fff", borderRadius: 8, border: "1px solid " + _br.bd, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: _br.dk, fontFamily: _sans }}>Your drawing set</div>
            <span style={{ fontSize: 8, fontFamily: _mono, fontWeight: 700, color: _br.gn, border: "1px solid " + _br.gn, borderRadius: 4, padding: "2px 6px", letterSpacing: "0.5px" }}>FROM YOUR DESIGN</span>
          </div>
          <div style={{ fontSize: 11, color: _br.mu, fontFamily: _sans, lineHeight: 1.55 }}>
            Every sheet is your design rendered by the same pipeline that makes the final PDF. Click any sheet to inspect it {"\u2014"} revise anything in the earlier steps and the set redraws.
          </div>
        </div>

        {/* Summary */}
        <div style={{ padding: 16, background: "#fff", borderRadius: 8, border: "1px solid " + _br.bd, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: _br.dk, fontFamily: _sans, marginBottom: 8 }}>Summary</div>
          <Spec l="Deck" v={`${fmtFtIn(c.W)} \u00D7 ${fmtFtIn(c.D)} \u00B7 ${fmtFtIn(c.H)} high`} />
          <Spec l="Total area" v={`${zc ? zc.totalArea : c.area} SF`} />
          <Spec l="Structure" v={`${c.joistSize}@${c.sp}" / ${c.beamSize.replace("3-ply ","(3) ").replace("2-ply ","(2) ")}`} />
          <Spec l="Load" v={`${c.TL} PSF`} color={_br.rd} />
          <Spec l="Finishes" v={`${(p.deckingType === "composite" ? "Composite" : "PT pine")} / ${((p.railType || p.railingType || "fortress") === "wood" ? "Wood baluster" : "Fortress steel")}`} />
          <Spec l="Stairs" v={(() => { var ds = p.deckStairs || []; if (!ds.length) return "None"; if (ds.length === 1) { var s0 = ds[0]; return `${s0.location} ${fmtFtIn(s0.width || 4)}`; } return ds.length + " sets"; })()} />
          <Spec l="Jurisdiction" v={_isPPRBD ? "Pikes Peak RBD" : "IRC 2021"} />
          {c.warnings.length > 0 && <div style={{ fontSize: 9, color: _br.rd, marginTop: 6, fontFamily: _mono }}>{"\u26A0\uFE0F"} {c.warnings.length} warning{c.warnings.length > 1 ? "s" : ""}</div>}
        </div>

        {/* Download / CTA */}
        {(() => {
          var rpt = permitCheck && permitCheck.permit_report;
          var isReady = rpt && rpt.overall_status === "ready";
          var codeLabel = (p.framingType || "wood") === "steel" ? "CCRR-0313" : "IRC 2021";
          return <div style={{ padding: 16, background: "#fff", borderRadius: 8, border: "1px solid " + _br.bd }}>
            {user ? <div>
              <button data-section="generate" onClick={handleGenerateClick} disabled={genStatus === "generating"}
                style={{ width: "100%", padding: "15px 20px", background: genStatus === "generating" ? "#555" : genStatus === "done" ? "#2e7d32" : _br.gn, color: "#fff", border: "none", borderRadius: 9, fontSize: 15, fontWeight: 800, cursor: genStatus === "generating" ? "wait" : "pointer", fontFamily: _sans, letterSpacing: "0.2px", boxShadow: "0 6px 20px rgba(61,90,46,0.30)", transition: "all 0.2s" }}>
                {genStatus === "generating" ? "Generating PDF\u2026" : genStatus === "done" ? "\u2713 Done \u2014 generate again?" : "Generate my plan set"}
              </button>
              <div style={{ fontSize: 11, color: _br.mu, fontFamily: _sans, marginTop: 10, lineHeight: 1.5 }}>
                Free during beta {"\u00B7"} normally <span style={{ textDecoration: "line-through" }}>$49</span><br />instant PDF, print-ready at 36{"\u00D7"}24
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid " + _br.wr }}>
                {permitCheckLoading
                  ? <span style={{ fontSize: 11, fontFamily: _sans, color: _br.mu }}>Checking permit readiness{"\u2026"}</span>
                  : rpt
                    ? <span style={{ fontSize: 11, fontFamily: _sans, color: isReady ? _br.gn : "#e65100", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span>{isReady ? "\u2713" : "\u26A0\uFE0F"}</span>{rpt.passed}/{rpt.total_applicable} checks passed {"\u00B7"} {codeLabel}
                      </span>
                    : null}
              </div>
              {genStatus === "error" && <div style={{ fontSize: 11, color: "#c62828", fontFamily: _sans, marginTop: 8 }}>Error: {genError}
                {genError === "Please sign in first" && <button onClick={() => { try { var _state = { p: p, info: info, step: step, sitePlanMode: sitePlanMode, page: "wizard" }; if (sitePlanB64) _state.sitePlanB64 = sitePlanB64; try { localStorage.setItem("sb_auth_state", JSON.stringify(_state)); } catch (qe) { delete _state.sitePlanB64; localStorage.setItem("sb_auth_state", JSON.stringify(_state)); } } catch (e) { console.warn("Could not save auth state:", e); } window.location.href = `${API}/auth/login`; }} style={{ marginLeft: 8, padding: "3px 10px", background: "#fff", color: "#333", border: "1px solid #ccc", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: _mono }}>Sign in now</button>}
              </div>}
              {genStatus === "done" && materialsUrl && <div style={{ marginTop: 10 }}>
                <a href={materialsUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: _br.wr, border: "1px solid " + _br.bd, borderRadius: 6, color: _br.dk, fontSize: 11, fontFamily: _sans, fontWeight: 600, textDecoration: "none", cursor: "pointer" }}>
                  {"\u2193"} Materials & cost estimate
                </a>
              </div>}
            </div> : <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: _br.tx, fontFamily: _sans, marginBottom: 12 }}>Sign in to generate your plan set {"\u2014"} free during beta.</div>
              <button onClick={() => { try { var _state = { p: p, info: info, step: step, sitePlanMode: sitePlanMode, page: "wizard" }; if (sitePlanB64) _state.sitePlanB64 = sitePlanB64; try { localStorage.setItem("sb_auth_state", JSON.stringify(_state)); } catch (qe) { delete _state.sitePlanB64; localStorage.setItem("sb_auth_state", JSON.stringify(_state)); } } catch (e) { console.warn("Could not save auth state:", e); } window.location.href = `${API}/auth/login`; }} style={{ width: "100%", padding: "12px 20px", background: "#fff", color: "#333", border: "1px solid " + _br.bd, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: _sans, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.10)" }}>
                <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.04 24.04 0 000 21.56l7.98-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Sign in with Google
              </button>
            </div>}
          </div>;
        })()}
        {/* AI guide -- lives in the rail below the CTA, using the space beside the tall left column */}
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
        s4Msg = "Ready to generate your blueprint package!";
        s4Tip = "Click 'Generate my plan set' above. Your " + (previewSheets.length || 7) + "-sheet package will be ready in about 30 seconds.";
      }
      return <div style={{ marginTop: 14 }}><GuidePanel
        phase={guidePhase}
        onAction={guideHandleAction}
        onBack={guideBack}
        history={guideHistory}
        onToggleOff={function() { setGuideActive(false); }}
        message={s4Msg}
        tip={s4Tip}
        chatMessages={chatMessages} chatLoading={chatLoading} onSendMessage={sendChatMessage} onApplyActions={_applyActions} setChatMessages={setChatMessages}
      /></div>;
    })()}
      </div>
    </div>

    {/* S96.5: full-size sheet inspection. Re-fetched at higher dpi. */}
    {lightbox != null && previewSheets[lightbox] && <div
      onClick={function() { setLightbox(null); }}
      style={{ position: "fixed", inset: 0, background: "rgba(20,24,18,0.82)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out" }}>
      <div style={{ maxWidth: 1100, width: "100%", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        {lightboxPng
          ? <img src={"data:image/png;base64," + lightboxPng} alt="sheet" style={{ width: "100%", display: "block" }} />
          : <img src={"data:image/png;base64," + previewSheets[lightbox].png} alt="sheet" style={{ width: "100%", display: "block", filter: "blur(0.4px)" }} />}
        <div style={{ padding: "8px 12px", borderTop: "1px solid " + _br.bd, display: "flex", justifyContent: "space-between", fontFamily: _mono, fontSize: 10, color: _br.mu }}>
          <b style={{ color: _br.dk }}>{previewSheets[lightbox].no}</b>
          <span>{previewSheets[lightbox].name} {"\u00B7"} {lightboxPng ? "CLICK ANYWHERE TO CLOSE" : "LOADING FULL SIZE\u2026"}</span>
        </div>
      </div>
    </div>}

    {showDisclaimer && <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>setShowDisclaimer(false)}>
      <div style={{background:"#fff",borderRadius:12,padding:28,maxWidth:440,margin:"0 20px",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:13,fontWeight:700,color:_br.dk,fontFamily:_sans,marginBottom:14}}>Before you download</div>
        <p style={{fontSize:12,color:_br.tx,fontFamily:_sans,lineHeight:1.7,margin:"0 0 10px"}}>SimpleBlueprints generates draft deck plans to assist with the permitting process. By downloading, you acknowledge that:</p>
        <ul style={{fontSize:11,color:_br.tx,fontFamily:_sans,lineHeight:1.8,margin:"0 0 18px",paddingLeft:18}}>
          <li>All deck projects require review and approval by your local building department before construction.</li>
          <li>Plans should be verified for accuracy before submission.</li>
          <li>This tool is a drafting aid and does not constitute professional engineering certification.</li>
        </ul>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={()=>setShowDisclaimer(false)} style={{padding:"10px 18px",background:"none",border:"1px solid "+_br.bd,borderRadius:6,fontSize:11,fontFamily:_sans,color:_br.mu,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>{setDisclaimerAcked(true);setShowDisclaimer(false);generateBlueprint();}} style={{padding:"10px 24px",background:_br.gn,border:"none",borderRadius:6,fontSize:11,fontFamily:_sans,color:"#fff",fontWeight:700,cursor:"pointer",boxShadow:"0 2px 12px rgba(61,90,46,0.3)"}}>I understand {"\u2014"} generate</button>
        </div>
      </div>
    </div>}

    {showMissingModal && <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>setShowMissingModal(false)}>
      <div style={{background:"#fff",borderRadius:12,padding:28,maxWidth:440,margin:"0 20px",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:13,fontWeight:700,color:"#d97706",fontFamily:_sans,marginBottom:14}}>{"\u26A0\uFE0F"} Missing information</div>
        <p style={{fontSize:12,color:_br.tx,fontFamily:_sans,lineHeight:1.7,margin:"0 0 10px"}}>Permit offices typically require the following fields, which are currently empty:</p>
        <div style={{padding:"10px 14px",background:"#fff8e1",borderRadius:6,border:"1px solid #ffe082",marginBottom:14}}>
          {showMissingModal.map(function(f,i){return <div key={i} style={{fontSize:11,fontFamily:_sans,color:"#92400e",lineHeight:1.8,fontWeight:600}}>{"\u2022"} {f}</div>;})}
        </div>
        <p style={{fontSize:11,color:_br.mu,fontFamily:_sans,lineHeight:1.6,margin:"0 0 18px"}}>You can fill these in using the Project Information section on the left, or generate your blueprint without them.</p>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={function(){setShowMissingModal(false);}} style={{padding:"10px 18px",background:"none",border:"1px solid "+_br.bd,borderRadius:6,fontSize:11,fontFamily:_sans,color:_br.mu,cursor:"pointer"}}>Fill in fields</button>
          <button onClick={function(){setMissingFieldsAcked(true);setShowMissingModal(false);disclaimerAcked?generateBlueprint():setShowDisclaimer(true);}} style={{padding:"10px 24px",background:"#d97706",border:"none",borderRadius:6,fontSize:11,fontFamily:_sans,color:"#fff",fontWeight:700,cursor:"pointer"}}>Generate anyway</button>
        </div>
      </div>
    </div>}

    {showPprbdModal && <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>setShowPprbdModal(false)}>
      <div style={{background:"#fff",borderRadius:12,padding:28,maxWidth:440,margin:"0 20px",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:13,fontWeight:700,color:"#1565c0",fontFamily:_sans,marginBottom:14}}>{"\u26A0\uFE0F"} PPRBD checklist incomplete</div>
        <p style={{fontSize:12,color:_br.tx,fontFamily:_sans,lineHeight:1.7,margin:"0 0 10px"}}>Your property is in PPRBD jurisdiction. The Deck Attachment Sheet has {showPprbdModal.length} unanswered item{showPprbdModal.length > 1 ? "s" : ""}. The permit office will need these filled in.</p>
        <p style={{fontSize:11,color:_br.mu,fontFamily:_sans,lineHeight:1.6,margin:"0 0 18px"}}>You can answer them now in the checklist on the left, or skip and fill them in by hand after printing.</p>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={function(){setShowPprbdModal(false);}} style={{padding:"10px 18px",background:"none",border:"1px solid "+_br.bd,borderRadius:6,fontSize:11,fontFamily:_sans,color:_br.mu,cursor:"pointer"}}>Answer items</button>
          <button onClick={function(){setPprbdChecklistAcked(true);setShowPprbdModal(false);disclaimerAcked?generateBlueprint():setShowDisclaimer(true);}} style={{padding:"10px 24px",background:"#1565c0",border:"none",borderRadius:6,fontSize:11,fontFamily:_sans,color:"#fff",fontWeight:700,cursor:"pointer"}}>Skip & generate</button>
        </div>
      </div>
    </div>}
  </>;

  return null;
}

window.StepContent = StepContent;
