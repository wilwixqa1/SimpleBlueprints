// ============================================================
// TRACE VIEW - Click-to-place lot boundary vertices on survey
// S43: Scale calibration + vertex tracing + edge metadata
// S43 update: Zoom/pan for accurate vertex placement on dense PDFs
// Forward-compatible: geometry:"line" field for future arc support
// ============================================================

window.TraceView = function TraceView({ surveyB64, surveyFileType, ts, setTs }) {
  var _br = window.SB.br;
  var _mono = window.SB.mono;
  var svgRef = React.useRef(null);
  var dragRef = React.useRef(null);
  var panStartRef = React.useRef(null);

  var [imgSrc, setImgSrc] = React.useState(null);
  var [loading, setLoading] = React.useState(true);
  var [isDragging, setIsDragging] = React.useState(false);

  // Zoom and pan state
  var [zoom, setZoom] = React.useState(1);
  var [panOffset, setPanOffset] = React.useState({ x: 0, y: 0 });
  // Refs for event handler closures (wheel handler)
  var zoomRef = React.useRef(1);
  var panRef = React.useRef({ x: 0, y: 0 });
  zoomRef.current = zoom;
  panRef.current = panOffset;

  // Read trace state
  var calPoints = ts.calPoints || [];
  var vertices = ts.vertices || [];
  var edgeMeta = ts.edgeMeta || [];
  var ppf = ts.ppf || null;
  var imgW = ts.imgW || 0;
  var imgH = ts.imgH || 0;
  var selectedEdge = ts.selectedEdge;
  var selectedVertex = ts.selectedVertex;

  function update(changes) {
    setTs(function(prev) { return Object.assign({}, prev, changes); });
  }

  // === Load image (PNG/JPG direct, PDF via pdf.js) ===
  React.useEffect(function() {
    if (!surveyB64) return;
    // Reset zoom/pan when page changes
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    if (surveyFileType === "pdf") {
      loadPdfPage(surveyB64, ts.pdfPage || 1);
    } else {
      var mimeType = surveyB64.substring(0, 4) === "/9j/" ? "jpeg" : "png";
      var src = "data:image/" + mimeType + ";base64," + surveyB64;
      var img = new Image();
      img.onload = function() {
        update({ imgW: img.naturalWidth, imgH: img.naturalHeight });
        setImgSrc(src);
        setLoading(false);
      };
      img.onerror = function() { setLoading(false); };
      img.src = src;
    }
  }, [surveyB64, surveyFileType, ts.pdfPage]);

  function loadPdfPage(b64, pageNum) {
    setLoading(true);
    function doRender() {
      try {
        var raw = atob(b64);
        var arr = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        window.pdfjsLib.getDocument({ data: arr }).promise.then(function(pdf) {
          update({ pdfPageCount: pdf.numPages });
          return pdf.getPage(pageNum);
        }).then(function(page) {
          var vp = page.getViewport({ scale: 2 });
          var canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          var ctx = canvas.getContext("2d");
          return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function() {
            update({ imgW: vp.width, imgH: vp.height });
            setImgSrc(canvas.toDataURL("image/png"));
            setLoading(false);
          });
        }).catch(function(err) {
          console.error("PDF render error:", err);
          setLoading(false);
        });
      } catch (err) {
        console.error("PDF decode error:", err);
        setLoading(false);
      }
    }
    if (window.pdfjsLib) {
      doRender();
    } else {
      var sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      sc.onload = function() {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        doRender();
      };
      sc.onerror = function() { console.error("Failed to load pdf.js"); setLoading(false); };
      document.head.appendChild(sc);
    }
  }

  // === Coordinate conversion (client -> image pixels) ===
  // Works regardless of zoom/pan because SVG CTM accounts for viewBox
  function clientToImg(clientX, clientY) {
    var svg = svgRef.current;
    if (!svg || !imgW) return null;
    var pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return null;
    var svgPt = pt.matrixTransform(ctm.inverse());
    return {
      px: Math.max(0, Math.min(imgW, Math.round(svgPt.x))),
      py: Math.max(0, Math.min(imgH, Math.round(svgPt.y)))
    };
  }

  // === Scroll-wheel zoom (passive:false via ref-based listener) ===
  React.useEffect(function() {
    var el = svgRef.current;
    if (!el || !imgW || !imgH) return;
    function handleWheel(e) {
      e.preventDefault();
      var z = zoomRef.current;
      var p = panRef.current;
      var factor = e.deltaY > 0 ? 0.9 : 1.1;
      var newZoom = Math.max(1, Math.min(10, z * factor));

      // Zoom toward cursor position
      var rect = el.getBoundingClientRect();
      var fracX = (e.clientX - rect.left) / rect.width;
      var fracY = (e.clientY - rect.top) / rect.height;
      var oldVbW = imgW / z, oldVbH = imgH / z;
      var newVbW = imgW / newZoom, newVbH = imgH / newZoom;
      // Point under cursor in image coordinates
      var imgX = p.x + fracX * oldVbW;
      var imgY = p.y + fracY * oldVbH;
      // New pan to keep that point under cursor
      var newPanX = imgX - fracX * newVbW;
      var newPanY = imgY - fracY * newVbH;

      setZoom(newZoom);
      setPanOffset({
        x: Math.max(0, Math.min(imgW - newVbW, newPanX)),
        y: Math.max(0, Math.min(imgH - newVbH, newPanY))
      });
    }
    el.addEventListener("wheel", handleWheel, { passive: false });
    return function() { el.removeEventListener("wheel", handleWheel); };
  }, [imgW, imgH]);

  // === Zoom toolbar actions ===
  function zoomIn() {
    var newZoom = Math.min(10, zoom * 1.3);
    // Zoom toward center
    var vbW = imgW / zoom, vbH = imgH / zoom;
    var newVbW = imgW / newZoom, newVbH = imgH / newZoom;
    var cx = panOffset.x + vbW / 2, cy = panOffset.y + vbH / 2;
    setZoom(newZoom);
    setPanOffset({
      x: Math.max(0, Math.min(imgW - newVbW, cx - newVbW / 2)),
      y: Math.max(0, Math.min(imgH - newVbH, cy - newVbH / 2))
    });
  }
  function zoomOut() {
    var newZoom = Math.max(1, zoom / 1.3);
    var vbW = imgW / zoom, vbH = imgH / zoom;
    var newVbW = imgW / newZoom, newVbH = imgH / newZoom;
    var cx = panOffset.x + vbW / 2, cy = panOffset.y + vbH / 2;
    setZoom(newZoom);
    setPanOffset({
      x: Math.max(0, Math.min(imgW - newVbW, cx - newVbW / 2)),
      y: Math.max(0, Math.min(imgH - newVbH, cy - newVbH / 2))
    });
  }
  function zoomReset() {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }

  // === Point placement (calibration or vertex) ===
  function handlePointPlacement(pt) {
    if (!pt) return;
    // Calibration mode: place calibration reference points
    if (!ppf) {
      if (calPoints.length < 2) {
        update({ calPoints: calPoints.concat([pt]) });
      }
      return;
    }
    // Trace mode: add vertex
    var newVerts = vertices.concat([pt]);
    var newMeta = edgeMeta.slice();
    while (newMeta.length < newVerts.length) {
      newMeta.push({ type: "property", label: "", neighborLabel: "", setbackType: "side", geometry: "line" });
    }
    update({ vertices: newVerts, edgeMeta: newMeta, selectedEdge: null, selectedVertex: newVerts.length - 1 });
  }

  // === Pointer handlers (click-vs-pan disambiguation) ===
  function onSvgPointerDown(e) {
    if (e.button && e.button !== 0) return; // left click only
    var cX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    var cY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (cX == null) return;

    // If a vertex drag is starting, don't start a pan
    if (dragRef.current) return;

    var pt = clientToImg(cX, cY);
    panStartRef.current = {
      clientX: cX, clientY: cY,
      imgPt: pt, wasPan: false,
      startPan: { x: panOffset.x, y: panOffset.y }
    };
  }

  function onVertexDown(e, idx) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { idx: idx };
    setIsDragging(true);
    update({ selectedVertex: idx, selectedEdge: null });
    // Clear any pan start so we don't confuse the handlers
    panStartRef.current = null;
  }

  function onSvgPointerMove(e) {
    var cX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    var cY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (cX == null) return;

    // Vertex drag
    if (dragRef.current) {
      e.preventDefault();
      var pt = clientToImg(cX, cY);
      if (!pt) return;
      var idx = dragRef.current.idx;
      var newVerts = vertices.slice();
      newVerts[idx] = pt;
      update({ vertices: newVerts });
      return;
    }

    // Pan drag (only when zoomed in)
    var ps = panStartRef.current;
    if (ps && zoom > 1) {
      var dx = cX - ps.clientX;
      var dy = cY - ps.clientY;
      if (!ps.wasPan && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        ps.wasPan = true;
      }
      if (ps.wasPan) {
        e.preventDefault();
        var svg = svgRef.current;
        if (svg) {
          var rect = svg.getBoundingClientRect();
          var vbW = imgW / zoom;
          var vbH = imgH / zoom;
          var scaleX = vbW / rect.width;
          var scaleY = vbH / rect.height;
          var newPanX = ps.startPan.x - dx * scaleX;
          var newPanY = ps.startPan.y - dy * scaleY;
          setPanOffset({
            x: Math.max(0, Math.min(imgW - vbW, newPanX)),
            y: Math.max(0, Math.min(imgH - vbH, newPanY))
          });
        }
      }
    }
  }

  function onSvgPointerUp(e) {
    // End vertex drag
    if (dragRef.current) {
      dragRef.current = null;
      setTimeout(function() { setIsDragging(false); }, 50);
      return;
    }

    // End pan or handle click
    var ps = panStartRef.current;
    panStartRef.current = null;
    if (ps && !ps.wasPan && ps.imgPt) {
      // It was a click (no pan movement) - place point
      handlePointPlacement(ps.imgPt);
    }
  }

  // === Edge click (select for metadata editing in left panel) ===
  function onEdgeClick(e, idx) {
    e.stopPropagation();
    // Prevent if we were panning
    if (panStartRef.current && panStartRef.current.wasPan) return;
    update({ selectedEdge: idx, selectedVertex: null });
  }

  // === Compute edge lengths from pixel distances + calibration ===
  var edgeLengths = [];
  if (ppf && vertices.length >= 2) {
    for (var i = 0; i < vertices.length; i++) {
      var v1 = vertices[i];
      var v2 = vertices[(i + 1) % vertices.length];
      var dx = v2.px - v1.px, dy = v2.py - v1.py;
      edgeLengths.push(+(Math.sqrt(dx * dx + dy * dy) / ppf).toFixed(2));
    }
  }
  // Expose edge lengths for left panel controls
  React.useEffect(function() {
    if (edgeLengths.length > 0 && JSON.stringify(edgeLengths) !== JSON.stringify(ts.edgeLengths)) {
      update({ edgeLengths: edgeLengths });
    }
  }, [JSON.stringify(edgeLengths)]);

  // === Render ===
  if (loading) {
    return React.createElement("div", {
      style: { display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 320, color: _br.mu, fontFamily: _mono, fontSize: 12 }
    }, "\u23F3 Loading survey image...");
  }
  if (!imgSrc || !imgW) {
    return React.createElement("div", {
      style: { display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 320, color: "#dc2626", fontFamily: _mono, fontSize: 12 }
    }, "Could not load survey image. Try a PNG or JPG file.");
  }

  var isCalibrating = !ppf;
  var n = vertices.length;

  // Compute viewBox from zoom and pan
  var vbW = imgW / zoom;
  var vbH = imgH / zoom;
  var vbX = Math.max(0, Math.min(imgW - vbW, panOffset.x));
  var vbY = Math.max(0, Math.min(imgH - vbH, panOffset.y));

  // Font sizes scaled to viewBox (so they stay readable when zoomed)
  var baseFontSize = Math.max(8, Math.min(16, vbW / 60));
  var smallFontSize = Math.max(6, Math.min(12, vbW / 80));
  var vertexR = Math.max(4, Math.min(10, vbW / 120));

  // === Build overlay elements ===
  var els = [];

  // Polygon fill (3+ vertices, closed)
  if (n >= 3) {
    var polyPts = vertices.map(function(v) { return v.px + "," + v.py; }).join(" ");
    els.push(React.createElement("polygon", {
      key: "poly", points: polyPts,
      fill: "rgba(61,90,46,0.12)", stroke: "#3d5a2e", strokeWidth: Math.max(1.5, vbW / 400),
      strokeLinejoin: "round", pointerEvents: "none"
    }));
  } else if (n === 2) {
    els.push(React.createElement("line", {
      key: "line01", x1: vertices[0].px, y1: vertices[0].py,
      x2: vertices[1].px, y2: vertices[1].py,
      stroke: "#3d5a2e", strokeWidth: Math.max(1.5, vbW / 400),
      pointerEvents: "none"
    }));
  }

  // Edges: visible lines + invisible click targets + length labels
  if (n >= 2) {
    var edgeCount = n >= 3 ? n : 1;
    for (var ei = 0; ei < edgeCount; ei++) {
      var ev1 = vertices[ei], ev2 = vertices[(ei + 1) % n];
      var isSel = selectedEdge === ei;
      var meta = edgeMeta[ei] || {};
      var isStreet = meta.type === "street";

      els.push(React.createElement("line", {
        key: "ev" + ei,
        x1: ev1.px, y1: ev1.py, x2: ev2.px, y2: ev2.py,
        stroke: isSel ? "#2563eb" : (isStreet ? "#e53935" : "#3d5a2e"),
        strokeWidth: isSel ? Math.max(3, vbW / 250) : Math.max(1.5, vbW / 400),
        pointerEvents: "none"
      }));

      // Invisible click target for edge selection
      els.push(React.createElement("line", {
        key: "ec" + ei,
        x1: ev1.px, y1: ev1.py, x2: ev2.px, y2: ev2.py,
        stroke: "transparent", strokeWidth: Math.max(16, vbW / 50), cursor: "pointer",
        onClick: (function(idx) { return function(e) { onEdgeClick(e, idx); }; })(ei)
      }));

      if (ppf && edgeLengths[ei]) {
        var emx = (ev1.px + ev2.px) / 2, emy = (ev1.py + ev2.py) / 2;
        var edx = ev2.px - ev1.px, edy = ev2.py - ev1.py;
        var enrm = Math.sqrt(edx * edx + edy * edy);
        if (enrm > vertexR * 6) {
          var enx = -edy / enrm, eny = edx / enrm;
          var pcx = 0, pcy = 0;
          for (var vi = 0; vi < n; vi++) { pcx += vertices[vi].px; pcy += vertices[vi].py; }
          pcx /= n; pcy /= n;
          if (enx * (emx - pcx) + eny * (emy - pcy) < 0) { enx = -enx; eny = -eny; }
          var ofsD = baseFontSize * 1.2;
          var lx = emx + enx * ofsD, ly = emy + eny * ofsD;
          var angle = Math.atan2(edy, edx) * 180 / Math.PI;
          while (angle > 90) angle -= 180;
          while (angle < -90) angle += 180;
          var lbl = edgeLengths[ei] % 1 === 0 ? edgeLengths[ei] + "'" : edgeLengths[ei].toFixed(1) + "'";

          els.push(React.createElement("rect", {
            key: "elbg" + ei,
            x: lx - baseFontSize * 2, y: ly - baseFontSize * 0.6,
            width: baseFontSize * 4, height: baseFontSize * 1.2,
            fill: "rgba(255,255,255,0.85)", rx: 3,
            transform: "rotate(" + angle.toFixed(1) + "," + lx.toFixed(1) + "," + ly.toFixed(1) + ")",
            pointerEvents: "none"
          }));
          els.push(React.createElement("text", {
            key: "el" + ei, x: lx, y: ly,
            textAnchor: "middle", dominantBaseline: "central",
            transform: "rotate(" + angle.toFixed(1) + "," + lx.toFixed(1) + "," + ly.toFixed(1) + ")",
            style: { fontSize: baseFontSize, fill: isSel ? "#2563eb" : "#333",
              fontFamily: _mono, fontWeight: 700 },
            pointerEvents: "none"
          }, lbl));

          var typeLbl = "";
          if (isStreet) typeLbl = meta.label || "STREET";
          else if (meta.neighborLabel) typeLbl = meta.neighborLabel;
          if (typeLbl) {
            var tly = ly + baseFontSize * 1.1;
            els.push(React.createElement("text", {
              key: "et" + ei, x: lx, y: tly,
              textAnchor: "middle", dominantBaseline: "central",
              transform: "rotate(" + angle.toFixed(1) + "," + lx.toFixed(1) + "," + tly.toFixed(1) + ")",
              style: { fontSize: smallFontSize, fill: isStreet ? "#e53935" : "#888",
                fontFamily: _mono, fontWeight: 600, fontStyle: isStreet ? "normal" : "italic" },
              pointerEvents: "none"
            }, typeLbl));
          }
        }
      }
    }
  }

  // Calibration elements
  calPoints.forEach(function(cp, ci) {
    els.push(React.createElement("circle", {
      key: "cp" + ci, cx: cp.px, cy: cp.py, r: vertexR * 1.3,
      fill: "#e53935", stroke: "#fff", strokeWidth: Math.max(2, vertexR * 0.4), pointerEvents: "none"
    }));
    if (ci === calPoints.length - 1 && !ppf) {
      els.push(React.createElement("circle", {
        key: "cpr" + ci, cx: cp.px, cy: cp.py, r: vertexR * 2.5,
        fill: "none", stroke: "#e53935", strokeWidth: Math.max(1.5, vertexR * 0.3), opacity: 0.5,
        pointerEvents: "none"
      }));
    }
  });
  if (calPoints.length === 2) {
    els.push(React.createElement("line", {
      key: "calln",
      x1: calPoints[0].px, y1: calPoints[0].py,
      x2: calPoints[1].px, y2: calPoints[1].py,
      stroke: "#e53935", strokeWidth: Math.max(2.5, vbW / 300), strokeDasharray: (vbW / 60) + "," + (vbW / 100),
      pointerEvents: "none"
    }));
    if (ts.calDist) {
      var cmx = (calPoints[0].px + calPoints[1].px) / 2;
      var cmy = (calPoints[0].py + calPoints[1].py) / 2;
      els.push(React.createElement("rect", {
        key: "clbg", x: cmx - baseFontSize * 2.5, y: cmy - baseFontSize - 4,
        width: baseFontSize * 5, height: baseFontSize * 1.4,
        fill: "rgba(255,255,255,0.9)", rx: 3, pointerEvents: "none"
      }));
      els.push(React.createElement("text", {
        key: "cltx", x: cmx, y: cmy - baseFontSize * 0.3,
        textAnchor: "middle",
        style: { fontSize: baseFontSize, fill: "#e53935", fontFamily: _mono, fontWeight: 700 },
        pointerEvents: "none"
      }, ts.calDist + "'"));
    }
  }

  // Vertex dots (rendered last so they appear on top)
  vertices.forEach(function(v, vi) {
    var isSel = selectedVertex === vi;
    // Invisible larger hit target for drag
    els.push(React.createElement("circle", {
      key: "vt" + vi, cx: v.px, cy: v.py, r: vertexR * 2.5,
      fill: "transparent", cursor: "grab",
      onMouseDown: function(e) { onVertexDown(e, vi); },
      onTouchStart: function(e) { e.preventDefault(); onVertexDown(e, vi); }
    }));
    // Visible dot
    els.push(React.createElement("circle", {
      key: "vd" + vi, cx: v.px, cy: v.py,
      r: isSel ? vertexR * 1.3 : vertexR,
      fill: isSel ? "#2563eb" : "#3d5a2e",
      stroke: "#fff", strokeWidth: Math.max(1.5, vertexR * 0.3),
      pointerEvents: "none"
    }));
    // Vertex number label
    els.push(React.createElement("text", {
      key: "vn" + vi, x: v.px, y: v.py - vertexR * 1.8,
      textAnchor: "middle",
      style: { fontSize: smallFontSize, fill: isSel ? "#2563eb" : "#3d5a2e",
        fontFamily: _mono, fontWeight: 700 },
      pointerEvents: "none"
    }, "" + (vi + 1)));
  });

  // === Status text ===
  var statusText = "";
  var statusColor = "";
  if (isCalibrating) {
    statusColor = "#e65100";
    if (calPoints.length === 0) statusText = "\uD83D\uDCCF Click two points on a dimension you know (e.g. a labeled property line)";
    else if (calPoints.length === 1) statusText = "\uD83D\uDCCF Click the second reference point";
    else statusText = "\uD83D\uDCCF Enter the distance between reference points in the panel on the left";
  } else {
    statusColor = "#2e7d32";
    if (n === 0) statusText = "\uD83D\uDCCD Click lot corners clockwise starting from the street side";
    else if (n < 3) statusText = "\uD83D\uDCCD Keep clicking corners (" + n + " placed, need at least 3)";
    else statusText = "\u2705 " + n + " vertices placed. Click to add more, drag to adjust, click edges to label.";
  }

  // === SVG event props ===
  var svgEvents = {
    onMouseDown: onSvgPointerDown,
    onMouseMove: onSvgPointerMove,
    onMouseUp: onSvgPointerUp,
    onMouseLeave: function() { onSvgPointerUp(); panStartRef.current = null; },
    onTouchStart: function(e) { e.preventDefault(); onSvgPointerDown(e); },
    onTouchMove: function(e) { e.preventDefault(); onSvgPointerMove(e); },
    onTouchEnd: function(e) { onSvgPointerUp(e); },
    onTouchCancel: function() { onSvgPointerUp(); panStartRef.current = null; }
  };

  // Zoom toolbar button style
  var zBtnStyle = {
    padding: "3px 10px", fontSize: 11, fontFamily: _mono, cursor: "pointer",
    border: "1px solid " + _br.bd, borderRadius: 4,
    background: "#fff", color: _br.tx, fontWeight: 700,
    lineHeight: 1, minWidth: 28, textAlign: "center"
  };

  return React.createElement("div", { style: { position: "relative" } },
    // Status bar
    React.createElement("div", {
      style: {
        padding: "8px 12px", marginBottom: 6,
        background: isCalibrating ? "#fff3e0" : "#e8f5e9",
        borderRadius: 6,
        border: "1px solid " + (isCalibrating ? "#ffe0b2" : "#c8e6c9"),
        fontSize: 10, fontFamily: _mono, fontWeight: 600, color: statusColor
      }
    }, statusText),

    // Page selector + Zoom toolbar
    React.createElement("div", {
      style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }
    },
      // Page buttons (PDF only)
      (ts.pdfPageCount || 1) > 1 ? React.createElement("div", {
        style: { display: "flex", gap: 3, alignItems: "center" }
      },
        React.createElement("span", {
          style: { fontSize: 9, fontFamily: _mono, color: _br.mu }
        }, "Page:"),
        Array.from({ length: ts.pdfPageCount }, function(_, i) {
          var pg = i + 1;
          var isActive = (ts.pdfPage || 1) === pg;
          return React.createElement("button", {
            key: pg,
            onClick: function() { update({ pdfPage: pg }); },
            style: {
              padding: "3px 8px", fontSize: 9, fontFamily: _mono, cursor: "pointer",
              border: isActive ? "1.5px solid " + _br.gn : "1px solid " + _br.bd,
              background: isActive ? "#edf5e8" : "#fff",
              color: isActive ? _br.gn : _br.mu,
              borderRadius: 4, fontWeight: isActive ? 700 : 400
            }
          }, "" + pg);
        })
      ) : null,

      // Spacer
      React.createElement("div", { style: { flex: 1 } }),

      // Zoom controls
      React.createElement("div", {
        style: { display: "flex", gap: 3, alignItems: "center" }
      },
        React.createElement("span", {
          style: { fontSize: 9, fontFamily: _mono, color: _br.mu, marginRight: 2 }
        }, "\uD83D\uDD0D"),
        React.createElement("button", {
          onClick: zoomOut, disabled: zoom <= 1,
          style: Object.assign({}, zBtnStyle, { opacity: zoom <= 1 ? 0.4 : 1 })
        }, "\u2212"),
        React.createElement("span", {
          style: { fontSize: 10, fontFamily: _mono, color: _br.tx, fontWeight: 700,
            minWidth: 40, textAlign: "center" }
        }, Math.round(zoom * 100) + "%"),
        React.createElement("button", {
          onClick: zoomIn, disabled: zoom >= 10,
          style: Object.assign({}, zBtnStyle, { opacity: zoom >= 10 ? 0.4 : 1 })
        }, "+"),
        React.createElement("button", {
          onClick: zoomReset, disabled: zoom === 1,
          style: Object.assign({}, zBtnStyle, {
            fontSize: 9, padding: "3px 8px",
            opacity: zoom === 1 ? 0.4 : 1
          })
        }, "Fit"),
        zoom > 1 ? React.createElement("span", {
          style: { fontSize: 8, fontFamily: _mono, color: "#888", marginLeft: 4 }
        }, "drag to pan") : null
      )
    ),

    // SVG with survey image and overlays
    React.createElement("svg",
      Object.assign({
        ref: svgRef,
        viewBox: vbX + " " + vbY + " " + vbW + " " + vbH,
        preserveAspectRatio: "xMidYMid meet",
        style: {
          width: "100%", height: "auto", maxHeight: "65vh",
          border: "1px solid " + _br.bd, borderRadius: 6,
          cursor: isCalibrating ? "crosshair" : (isDragging ? "grabbing" : (zoom > 1 ? "grab" : "crosshair")),
          touchAction: "none",
          background: "#f5f5f0",
          userSelect: "none"
        }
      }, svgEvents),

      React.createElement("image", {
        href: imgSrc, width: imgW, height: imgH,
        preserveAspectRatio: "none", pointerEvents: "none"
      }),

      React.createElement("g", null, els)
    ),

    // Bottom hint text
    React.createElement("div", {
      style: { textAlign: "center", fontSize: 8, color: _br.mu, fontFamily: _mono,
        marginTop: 4, fontStyle: "italic" }
    }, zoom > 1
      ? "Scroll to zoom. Drag to pan. Click to place points."
      : n >= 3 ? "Scroll to zoom in. Click edges to assign type. Drag vertices to adjust."
      : isCalibrating ? "Scroll to zoom in for precise placement."
      : "Scroll to zoom in. Click lot corners clockwise from the street side.")
  );
};
