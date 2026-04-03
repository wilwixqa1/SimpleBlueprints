"""
SimpleBlueprints -- Zone Utilities (Python port of zoneUtils.js)
Computes zone rectangles, composite outline, and exposed edges for PDF rendering.
S21: Plan view only. Framing/elevations remain zone-0 only.
S61: Chamfer-aware edge computation.
"""

import math


def _get_zone_corners(params, zone_id):
    """Get chamfer corner data for a zone. Returns None if no chamfers."""
    if zone_id == 0:
        return params.get("mainCorners")
    zones = params.get("zones", [])
    for z in zones:
        if z.get("id") == zone_id:
            return z.get("corners")
    return None


def _chamfered_vertices(x, y, w, d, corners):
    """
    Convert a rectangle + corner chamfers into polygon vertices.
    corners: dict with keys BL, BR, FL, FR, each {type, size}.
    Returns list of (x, y) tuples going CCW from bottom-left.
    """
    if not corners:
        return [(x, y), (x + w, y), (x + w, y + d), (x, y + d)]

    bl = corners.get("BL", {})
    br = corners.get("BR", {})
    fr = corners.get("FR", {})
    fl = corners.get("FL", {})

    bl_s = bl.get("size", 0) if bl.get("type") == "chamfer" else 0
    br_s = br.get("size", 0) if br.get("type") == "chamfer" else 0
    fr_s = fr.get("size", 0) if fr.get("type") == "chamfer" else 0
    fl_s = fl.get("size", 0) if fl.get("type") == "chamfer" else 0

    verts = []
    if bl_s > 0:
        verts.append((x, y + bl_s))
        verts.append((x + bl_s, y))
    else:
        verts.append((x, y))

    if br_s > 0:
        verts.append((x + w - br_s, y))
        verts.append((x + w, y + br_s))
    else:
        verts.append((x + w, y))

    if fr_s > 0:
        verts.append((x + w, y + d - fr_s))
        verts.append((x + w - fr_s, y + d))
    else:
        verts.append((x + w, y + d))

    if fl_s > 0:
        verts.append((x + fl_s, y + d))
        verts.append((x, y + d - fl_s))
    else:
        verts.append((x, y + d))

    return verts


def _chamfer_perimeter_delta(corners):
    """Compute the change in perimeter due to chamfers.
    Each chamfer of size S removes 2S of axis-aligned edge and adds S*sqrt(2) diagonal.
    Returns a negative number (chamfers shorten perimeter).
    """
    if not corners:
        return 0
    delta = 0
    for k in ("BL", "BR", "FL", "FR"):
        c = corners.get(k, {})
        if c.get("type") == "chamfer" and c.get("size", 0) > 0:
            s = c["size"]
            delta += s * math.sqrt(2) - 2 * s
    return delta


def get_zone_rect(zone, parent_w, parent_d):
    """Compute the rectangle for a zone relative to zone 0 origin (0,0)."""
    edge = zone.get("attachEdge", "front")
    offset = zone.get("attachOffset", 0)
    w = zone.get("w", 8)
    d = zone.get("d", 6)

    if zone.get("type") == "cutout":
        # S65: Simple fallback -- use parent zone 0 rect. Full cutout positioning
        # is handled in get_cutout_rects() via _get_cutout_rect().
        pr = {"x": 0, "y": 0, "w": parent_w, "d": parent_d}
        return _get_cutout_rect(zone, pr)

    if edge == "front":
        return {"x": offset, "y": parent_d, "w": w, "d": d}
    elif edge == "left":
        return {"x": -w, "y": offset, "w": w, "d": d}
    elif edge == "right":
        return {"x": parent_w, "y": offset, "w": w, "d": d}

    return {"x": 0, "y": 0, "w": w, "d": d}


def _get_cutout_rect(zone, parent_rect):
    """Compute cutout rectangle relative to parent zone rect.
    Mirrors frontend getCutoutRect() in zoneUtils.js.
    """
    pr = parent_rect
    cw = zone.get("w", 4)
    cd = zone.get("d", 4)
    off = zone.get("attachOffset", 0)
    edge = zone.get("attachEdge", "back-left")

    if edge == "back-left":
        return {"x": pr["x"], "y": pr["y"], "w": cw, "d": cd}
    elif edge == "back-right":
        return {"x": pr["x"] + pr["w"] - cw, "y": pr["y"], "w": cw, "d": cd}
    elif edge == "front-left":
        return {"x": pr["x"], "y": pr["y"] + pr["d"] - cd, "w": cw, "d": cd}
    elif edge == "front-right":
        return {"x": pr["x"] + pr["w"] - cw, "y": pr["y"] + pr["d"] - cd, "w": cw, "d": cd}
    elif edge == "back":
        return {"x": pr["x"] + off, "y": pr["y"], "w": cw, "d": cd}
    elif edge == "front":
        return {"x": pr["x"] + off, "y": pr["y"] + pr["d"] - cd, "w": cw, "d": cd}
    elif edge == "left":
        return {"x": pr["x"], "y": pr["y"] + off, "w": cd, "d": cw}
    elif edge == "right":
        return {"x": pr["x"] + pr["w"] - cd, "y": pr["y"] + off, "w": cd, "d": cw}
    elif edge == "interior":
        return {"x": pr["x"] + off, "y": pr["y"] + zone.get("interiorY", 0), "w": cw, "d": cd}

    return {"x": pr["x"], "y": pr["y"], "w": cw, "d": cd}


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
    """Get all cutout zone rects, positioned relative to their parent zone."""
    w = params.get("width", 20)
    d = params.get("depth", 12)
    zones = params.get("zones", [])

    # S65: Build parent zone rect lookup for cutout positioning
    add_rects_list = get_additive_rects(params)
    zone_rect_map = {0: {"x": 0, "y": 0, "w": w, "d": d}}
    for ar in add_rects_list:
        if ar["id"] != 0:
            zone_rect_map[ar["id"]] = ar["rect"]

    rects = []
    for z in zones:
        if z.get("type") != "cutout":
            continue
        parent_id = z.get("attachTo", 0)
        pr = zone_rect_map.get(parent_id, zone_rect_map[0])
        rect = _get_cutout_rect(z, pr)
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
    S61: Chamfer-aware. Generates edges from chamfered vertex lists instead of
    rectangles. Diagonal chamfer edges are always exposed. Axis-aligned edges
    go through the standard overlap subtraction with neighboring zones.

    Returns list of {"x1", "y1", "x2", "y2", "dir": "h"|"v"|"d"}.
    Excludes house-wall edges (y=0 for ledger) and shared interior edges.
    """
    attachment = params.get("attachment", "ledger")
    add_rects = get_additive_rects(params)

    # Phase 1: Build edges from chamfered vertices for each zone
    all_edges = []
    for ar in add_rects:
        r = ar["rect"]
        rid = ar["id"]
        x, y, w, d = r["x"], r["y"], r["w"], r["d"]
        corners = _get_zone_corners(params, rid)
        verts = _chamfered_vertices(x, y, w, d, corners)

        for vi in range(len(verts)):
            v1 = verts[vi]
            v2 = verts[(vi + 1) % len(verts)]
            dx = abs(v1[0] - v2[0])
            dy = abs(v1[1] - v2[1])
            if dx < 0.01:
                edir = "v"
            elif dy < 0.01:
                edir = "h"
            else:
                edir = "d"
            all_edges.append({
                "x1": v1[0], "y1": v1[1], "x2": v2[0], "y2": v2[1],
                "dir": edir, "rid": rid,
            })

    # Phase 2: Filter and subtract
    exposed = []
    for e in all_edges:
        # Skip ledger edge: any horizontal edge at y=0 for zone 0
        if attachment == "ledger" and e["dir"] == "h" and e["rid"] == 0:
            if abs(e["y1"]) < 0.01 and abs(e["y2"]) < 0.01:
                continue

        # Diagonal edges: exposed only if the chamfer is on the exterior
        # Check if the cut-off corner falls inside another zone's rectangle.
        # If it does, the chamfer is at an internal junction and should NOT get railing.
        if e["dir"] == "d":
            # The cut-off corner is one of (x1,y2) or (x2,y1) -- check both
            candidates = [(e["x1"], e["y2"]), (e["x2"], e["y1"])]
            is_internal = False
            for ar2 in add_rects:
                if ar2["id"] == e["rid"]:
                    continue
                r2 = ar2["rect"]
                for cx, cy in candidates:
                    if (r2["x"] - 0.1 <= cx <= r2["x"] + r2["w"] + 0.1 and
                        r2["y"] - 0.1 <= cy <= r2["y"] + r2["d"] + 0.1):
                        is_internal = True
                        break
                if is_internal:
                    break
            if not is_internal:
                exposed.append({"x1": e["x1"], "y1": e["y1"], "x2": e["x2"], "y2": e["y2"], "dir": "d"})
            continue

        # Axis-aligned edges: subtract overlapping portions from neighboring zones
        blockers = []
        for ar2 in add_rects:
            if ar2["id"] == e["rid"]:
                continue
            r2 = ar2["rect"]
            x2, y2, w2, d2 = r2["x"], r2["y"], r2["w"], r2["d"]

            if e["dir"] == "h":
                e_y = e["y1"]
                e_x_min = min(e["x1"], e["x2"])
                e_x_max = max(e["x1"], e["x2"])
                for ry in [y2, y2 + d2]:
                    if abs(ry - e_y) < 0.01:
                        overlap = _segments_overlap(e_x_min, e_x_max, x2, x2 + w2)
                        if overlap:
                            blockers.append(overlap)
            else:  # "v"
                e_x = e["x1"]
                e_y_min = min(e["y1"], e["y2"])
                e_y_max = max(e["y1"], e["y2"])
                for rx in [x2, x2 + w2]:
                    if abs(rx - e_x) < 0.01:
                        overlap = _segments_overlap(e_y_min, e_y_max, y2, y2 + d2)
                        if overlap:
                            blockers.append(overlap)

        if not blockers:
            exposed.append({"x1": e["x1"], "y1": e["y1"], "x2": e["x2"], "y2": e["y2"], "dir": e["dir"]})
        else:
            if e["dir"] == "h":
                e_x_min = min(e["x1"], e["x2"])
                e_x_max = max(e["x1"], e["x2"])
                segments = _subtract_segments(e_x_min, e_x_max, blockers)
                for s_start, s_end in segments:
                    if s_end - s_start > 0.05:
                        exposed.append({"x1": s_start, "y1": e["y1"], "x2": s_end, "y2": e["y2"], "dir": "h"})
            else:
                e_y_min = min(e["y1"], e["y2"])
                e_y_max = max(e["y1"], e["y2"])
                segments = _subtract_segments(e_y_min, e_y_max, blockers)
                for s_start, s_end in segments:
                    if s_end - s_start > 0.05:
                        exposed.append({"x1": e["x1"], "y1": s_start, "x2": e["x2"], "y2": s_end, "dir": "v"})

    return exposed