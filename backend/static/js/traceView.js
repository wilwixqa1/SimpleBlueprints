// ============================================================
// TRACE VIEW - Click-to-place lot boundary vertices on survey
// S43: Scale calibration + vertex tracing + edge metadata
// Forward-compatible: geometry:"line" field for future arc support
// ============================================================

window.TraceView = function TraceView({ surveyB64, surveyFileType, ts, setTs }) {
  var _br = window.SB.br;
  var _mono = window.SB.mono;
  var svgRef = React.useRef(null);
  var dragRef = React.useRef(null);

  var [imgSrc, setImgSrc] = React.useState(null);
  var [loading, setLoading] = React.useState(true);
  var [isDragging, setIsDragging] = React.useState(false);

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

  // === Click handler (calibration or vertex placement) ===
  function onSvgClick(e) {
    if (isDragging) return;
    var pt = clientToImg(e.clientX, e.clientY);
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

  // === Vertex drag ===
  function onVertexDown(e, idx) {
    e.preventDefault();
    e.stopPropagation();
    var cX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    var cY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (cX == null) return;
    dragRef.current = { idx: idx };
    setIsDragging(true);
    update({ selectedVertex: idx, selectedEdge: null });
  }

  function onSvgPointerMove(e) {
    if (!dragRef.current) return;
    e.preventDefault();
    var cX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    var cY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (cX == null) return;
    var pt = clientToImg(cX, cY);
    if (!pt) return;
    var idx = dragRef.current.idx;
    var newVerts = vertices.slice();
    newVerts[idx] = pt;
    update({ vertices: newVerts });
  }

  function onSvgPointerUp() {
    if (dragRef.current) {
      dragRef.current = null;
      setTimeout(function() { setIsDragging(false); }, 50);
    }
  }

  // === Edge click (select for metadata editing in left panel) ===
  function onEdgeClick(e, idx) {
    e.stopPropagation();
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

  // Font sizes scaled to image
  var baseFontSize = Math.max(10, Math.min(16, imgW / 60));
  var smallFontSize = Math.max(8, Math.min(12, imgW / 80));
  var vertexR = Math.max(5, Math.min(10, imgW / 120));

  // === Build overlay elements ===
  var els = [];

  // Polygon fill (3+ vertices, closed)
  if (n >= 3) {
    var polyPts = vertices.map(function(v) { return v.px + "," + v.py; }).join(" ");
    els.push(React.createElement("polygon", {
      key: "poly", points: polyPts,
      fill: "rgba(61,90,46,0.12)", stroke: "#3d5a2e", strokeWidth: Math.max(1.5, imgW / 400),
      strokeLinejoin: "round", pointerEvents: "none"
    }));
  } else if (n === 2) {
    els.push(React.createElement("line", {
      key: "line01", x1: vertices[0].px, y1: vertices[0].py,
      x2: vertices[1].px, y2: vertices[1].py,
      stroke: "#3d5a2e", strokeWidth: Math.max(1.5, imgW / 400),
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
        strokeWidth: isSel ? Math.max(3, imgW / 250) : Math.max(1.5, imgW / 400),
        pointerEvents: "none"
      }));

      els.push(React.createElement("line", {
        key: "ec" + ei,
        x1: ev1.px, y1: ev1.py, x2: ev2.px, y2: ev2.py,
        stroke: "transparent", strokeWidth: Math.max(16, imgW / 50), cursor: "pointer",
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
      key: "cp" + ci, cx: cp.px, cy: cp.py, r: vertexR,
      fill: "#e53935", stroke: "#fff", strokeWidth: 2, pointerEvents: "none"
    }));
    if (ci === calPoints.length - 1 && !ppf) {
      els.push(React.createElement("circle", {
        key: "cpr" + ci, cx: cp.px, cy: cp.py, r: vertexR * 2,
        fill: "none", stroke: "#e53935", strokeWidth: 1.5, opacity: 0.5,
        pointerEvents: "none"
      }));
    }
  });
  if (calPoints.length === 2) {
    els.push(React.createElement("line", {
      key: "calln",
      x1: calPoints[0].px, y1: calPoints[0].py,
      x2: calPoints[1].px, y2: calPoints[1].py,
      stroke: "#e53935", strokeWidth: 2, strokeDasharray: "8,5",
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
    els.push(React.createElement("circle", {
      key: "vt" + vi, cx: v.px, cy: v.py, r: vertexR * 2.5,
      fill: "transparent", cursor: "grab",
      onMouseDown: function(e) { onVertexDown(e, vi); },
      onTouchStart: function(e) { onVertexDown(e, vi); }
    }));
    els.push(React.createElement("circle", {
      key: "vd" + vi, cx: v.px, cy: v.py,
      r: isSel ? vertexR * 1.3 : vertexR,
      fill: isSel ? "#2563eb" : "#3d5a2e",
      stroke: "#fff", strokeWidth: Math.max(1.5, vertexR * 0.3),
      pointerEvents: "none"
    }));
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

  // === SVG events ===
  var svgEvents = {
    onMouseMove: onSvgPointerMove,
    onMouseUp: onSvgPointerUp,
    onMouseLeave: onSvgPointerUp,
    onTouchMove: function(e) { e.preventDefault(); onSvgPointerMove(e); },
    onTouchEnd: onSvgPointerUp,
    onTouchCancel: onSvgPointerUp
  };

  return React.createElement("div", { style: { position: "relative" } },
    React.createElement("div", {
      style: {
        padding: "8px 12px", marginBottom: 6,
        background: isCalibrating ? "#fff3e0" : "#e8f5e9",
        borderRadius: 6,
        border: "1px solid " + (isCalibrating ? "#ffe0b2" : "#c8e6c9"),
        fontSize: 10, fontFamily: _mono, fontWeight: 600, color: statusColor
      }
    }, statusText),

    (ts.pdfPageCount || 1) > 1 ? React.createElement("div", {
      style: { display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }
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

    React.createElement("svg",
      Object.assign({
        ref: svgRef,
        viewBox: "0 0 " + imgW + " " + imgH,
        preserveAspectRatio: "xMidYMid meet",
        style: {
          width: "100%", height: "auto", maxHeight: "65vh",
          border: "1px solid " + _br.bd, borderRadius: 6,
          cursor: isCalibrating ? "crosshair" : (isDragging ? "grabbing" : "crosshair"),
          touchAction: isDragging ? "none" : "auto",
          background: "#f5f5f0"
        },
        onClick: onSvgClick
      }, svgEvents),

      React.createElement("image", {
        href: imgSrc, width: imgW, height: imgH,
        preserveAspectRatio: "none", pointerEvents: "none"
      }),

      React.createElement("g", null, els)
    ),

    React.createElement("div", {
      style: { textAlign: "center", fontSize: 8, color: _br.mu, fontFamily: _mono,
        marginTop: 4, fontStyle: "italic" }
    }, n >= 3 ? "Click edges to assign type (street/property). Drag vertices to adjust position."
      : isCalibrating ? "Click on reference points with a known distance apart."
      : "Click on lot corners in clockwise order starting from the street side.")
  );
};