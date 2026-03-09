"""
SimpleBlueprints -- Zone Utilities (Python port of zoneUtils.js)
Computes zone rectangles, composite outline, and exposed edges for PDF rendering.
S21: Plan view only. Framing/elevations remain zone-0 only.
"""


def get_zone_rect(zone, parent_w, parent_d):
    """Compute the rectangle for a zone relative to zone 0 origin (0,0)."""
    edge = zone.get("attachEdge", "front")
    offset = zone.get("attachOffset", 0)
    w = zone.get("w", 8)
    d = zone.get("d", 6)

    if zone.get("type") == "cutout":
        if edge == "interior":
            return {"x": offset, "y": zone.get("interiorY", 0), "w": w, "d": d}
        return {"x": offset, "y": 0, "w": w, "d": d}

    if edge == "front":
        return {"x": offset, "y": parent_d, "w": w, "d": d}
    elif edge == "left":
        return {"x": -w, "y": offset, "w": w, "d": d}
    elif edge == "right":
        return {"x": parent_w, "y": offset, "w": w, "d": d}

    return {"x": 0, "y": 0, "w": w, "d": d}


def get_additive_rects(params):
    """Get all additive zone rects including zone 0."""
    w = params.get("width", 20)
    d = params.get("depth", 12)
    zones = params.get("zones", [])

    rects = [{"id": 0, "zone": {"type": "add"}, "rect": {"x": 0, "y": 0, "w": w, "d": d}}]

    for z in zones:
        if z.get("type") == "cutout":
            continue
        rect = get_zone_rect(z, w, d)
        rects.append({"id": z.get("id", 0), "zone": z, "rect": rect})

    return rects


def get_cutout_rects(params):
    """Get all cutout zone rects."""
    w = params.get("width", 20)
    d = params.get("depth", 12)
    zones = params.get("zones", [])

    rects = []
    for z in zones:
        if z.get("type") != "cutout":
            continue
        rect = get_zone_rect(z, w, d)
        rects.append({"id": z.get("id", 0), "zone": z, "rect": rect})

    return rects


def get_bounding_box(params):
    """Get bounding box of all additive rects."""
    rects = get_additive_rects(params)
    if not rects:
        return {"x": 0, "y": 0, "w": params.get("width", 20), "d": params.get("depth", 12)}

    min_x = min(r["rect"]["x"] for r in rects)
    min_y = min(r["rect"]["y"] for r in rects)
    max_x = max(r["rect"]["x"] + r["rect"]["w"] for r in rects)
    max_y = max(r["rect"]["y"] + r["rect"]["d"] for r in rects)

    return {"x": min_x, "y": min_y, "w": max_x - min_x, "d": max_y - min_y}


def _segments_overlap(a_start, a_end, b_start, b_end):
    """Check if two 1D segments overlap and return the overlap range."""
    start = max(a_start, b_start)
    end = min(a_end, b_end)
    if end > start + 0.01:
        return (start, end)
    return None


def _subtract_segments(start, end, blockers):
    """Subtract a list of (block_start, block_end) from range [start, end]."""
    blockers = sorted(blockers, key=lambda b: b[0])
    result = []
    cur = start
    for b_start, b_end in blockers:
        if b_start > cur + 0.01:
            result.append((cur, b_start))
        cur = max(cur, b_end)
    if cur < end - 0.01:
        result.append((cur, end))
    return result


def get_exposed_edges(params):
    """
    Compute exposed edges that need railing.
    Returns list of {"x1", "y1", "x2", "y2", "dir": "h"|"v"}.
    Excludes house-wall edges (y=0 for ledger) and shared interior edges.
    """
    attachment = params.get("attachment", "ledger")
    add_rects = get_additive_rects(params)

    all_edges = []
    for ar in add_rects:
        r = ar["rect"]
        rid = ar["id"]
        x, y, w, d = r["x"], r["y"], r["w"], r["d"]
        all_edges.append({"x1": x, "y1": y, "x2": x + w, "y2": y, "dir": "h", "rid": rid, "edge": "back"})
        all_edges.append({"x1": x, "y1": y + d, "x2": x + w, "y2": y + d, "dir": "h", "rid": rid, "edge": "front"})
        all_edges.append({"x1": x, "y1": y, "x2": x, "y2": y + d, "dir": "v", "rid": rid, "edge": "left"})
        all_edges.append({"x1": x + w, "y1": y, "x2": x + w, "y2": y + d, "dir": "v", "rid": rid, "edge": "right"})

    exposed = []

    for e in all_edges:
        if attachment == "ledger" and e["edge"] == "back" and abs(e["y1"]) < 0.01 and e["rid"] == 0:
            continue

        blockers = []
        for ar2 in add_rects:
            if ar2["id"] == e["rid"]:
                continue
            r2 = ar2["rect"]
            x2, y2, w2, d2 = r2["x"], r2["y"], r2["w"], r2["d"]

            if e["dir"] == "h":
                for ry in [y2, y2 + d2]:
                    if abs(ry - e["y1"]) < 0.01:
                        overlap = _segments_overlap(e["x1"], e["x2"], x2, x2 + w2)
                        if overlap:
                            blockers.append(overlap)
            else:
                for rx in [x2, x2 + w2]:
                    if abs(rx - e["x1"]) < 0.01:
                        overlap = _segments_overlap(e["y1"], e["y2"], y2, y2 + d2)
                        if overlap:
                            blockers.append(overlap)

        if not blockers:
            exposed.append({"x1": e["x1"], "y1": e["y1"], "x2": e["x2"], "y2": e["y2"], "dir": e["dir"]})
        else:
            if e["dir"] == "h":
                segments = _subtract_segments(e["x1"], e["x2"], blockers)
                for s_start, s_end in segments:
                    if s_end - s_start > 0.05:
                        exposed.append({"x1": s_start, "y1": e["y1"], "x2": s_end, "y2": e["y2"], "dir": "h"})
            else:
                segments = _subtract_segments(e["y1"], e["y2"], blockers)
                for s_start, s_end in segments:
                    if s_end - s_start > 0.05:
                        exposed.append({"x1": e["x1"], "y1": s_start, "x2": e["x2"], "y2": s_end, "dir": "v"})

    return exposed