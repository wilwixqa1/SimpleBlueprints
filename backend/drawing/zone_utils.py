"""
SimpleBlueprints -- Zone Utilities (Python port of zoneUtils.js)
Computes zone rectangles, composite outline, and exposed edges for PDF rendering.
S21: Plan view only. Framing/elevations remain zone-0 only.
S61: Chamfer-aware edge computation.
"""

import re
import math


def effective_beam_type(zone, params):
    """S107 mirror of zoneUtils.js getEffectiveBeamType (S81 rule).

    A section may only be flush when it sits at the main deck's height;
    any height mismatch forces a dropped beam. The backend previously read
    z["beamType"] raw everywhere, so a RAISED flush section got flush
    treatment on the sheets while the app engine had already forced it to
    dropped. One rule, both languages, parity-tested.
    """
    if not zone or zone.get("type") == "cutout":
        return "dropped"
    main_h = params.get("height", 4) if params else 4
    raw = zone.get("beamType") or "dropped"
    zh = zone.get("h")
    if zh is not None and abs(zh - main_h) > 0.01:
        return "dropped"
    return raw


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


def get_exposed_edges(params, stair_openings=None):
    """
    Compute exposed edges that need railing.
    S61: Chamfer-aware. Generates edges from chamfered vertex lists instead of
    rectangles. Diagonal chamfer edges are always exposed. Axis-aligned edges
    go through the standard overlap subtraction with neighboring zones.

    S91 (P1.4a): Cutout-aware. When the main deck (zone 0) has a front-reaching
    cutout, zone 0's edges are built from beam_layout.notched_deck_polygon so the
    rail WRAPS the notch (front-left run, notch side walls, notch-back, front-
    right run) instead of drawing one straight line across the phantom pre-notch
    front edge. Flat / interior-well decks are unaffected (notched_deck_polygon
    returns None -> the normal rectangle/chamfer path).

    stair_openings: optional list of (edge_y, x0, x1) horizontal spans where a
    stair descends through an exposed edge (e.g. the notch-back edge). Any
    horizontal exposed edge at edge_y has that span removed so no rail is drawn
    across the stair opening. None / empty -> no subtraction (flat behavior).

    Returns list of {"x1", "y1", "x2", "y2", "dir": "h"|"v"|"d"}.
    Excludes house-wall edges (y=0 for ledger) and shared interior edges.
    """
    from .beam_layout import notched_deck_polygon

    attachment = params.get("attachment", "ledger")
    add_rects = get_additive_rects(params)
    cut_rects = get_cutout_rects(params)

    # Phase 1: Build edges from chamfered vertices for each zone
    all_edges = []
    for ar in add_rects:
        r = ar["rect"]
        rid = ar["id"]
        x, y, w, d = r["x"], r["y"], r["w"], r["d"]
        # P1.4a: main deck follows a front cutout (wraps the notch). Falls back
        # to the chamfered rectangle when there is no front-reaching cutout.
        notch_verts = notched_deck_polygon(w, d, cut_rects) if rid == 0 else None
        if notch_verts is not None:
            verts = notch_verts
        else:
            corners = _get_zone_corners(params, rid)
            verts = _chamfered_vertices(x, y, w, d, corners)

        for vi in range(len(verts)):
            v1 = verts[vi]
            v2 = verts[(vi + 1) % len(verts)]
            dx = abs(v1[0] - v2[0])
            dy = abs(v1[1] - v2[1])
            if dx < 0.01 and dy < 0.01:
                continue  # degenerate (duplicate vertex from the notch polyline)
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

    # Phase 3 (P1.4a, generalised S103 push 5): remove railing across stair
    # openings. WILL'S RULE: if there are stairs, there is never a railing
    # across them -- any edge, any deck shape.
    #
    # An opening is either:
    #   (coord, a, b)         legacy 3-tuple, HORIZONTAL edge at y=coord
    #   ("h"|"v", coord, a, b) explicit
    # Vertical support was added in S103 push 5 because side stairs (angle
    # 90/270) land on a vertical edge, and this phase used to skip every
    # non-horizontal edge -- so a left or right stair had a railing drawn
    # straight across it on the permit set.
    if stair_openings:
        norm = []
        for o in stair_openings:
            if len(o) == 4:
                norm.append((o[0], float(o[1]), float(o[2]), float(o[3])))
            else:
                norm.append(("h", float(o[0]), float(o[1]), float(o[2])))
        result = []
        for e in exposed:
            d = e["dir"]
            if d not in ("h", "v"):
                result.append(e)          # diagonal chamfers are never opened
                continue
            if d == "h":
                coord = e["y1"]
                a, b = min(e["x1"], e["x2"]), max(e["x1"], e["x2"])
            else:
                coord = e["x1"]
                a, b = min(e["y1"], e["y2"]), max(e["y1"], e["y2"])
            blockers = [(o[2], o[3]) for o in norm
                        if o[0] == d and abs(o[1] - coord) < 0.01]
            if not blockers:
                result.append(e)
                continue
            for s_start, s_end in _subtract_segments(a, b, blockers):
                if s_end - s_start > 0.05:
                    if d == "h":
                        result.append({"x1": s_start, "y1": coord,
                                       "x2": s_end, "y2": coord, "dir": "h"})
                    else:
                        result.append({"x1": coord, "y1": s_start,
                                       "x2": coord, "y2": s_end, "dir": "v"})
        exposed = result

    return exposed

# =============================================================================
# S102: STAIR-DERIVED OPENINGS  (the "notch" case)
# =============================================================================
# A CUTOUT and a NOTCH are different things from the user's point of view, and
# only one of them used to reach the framing engine:
#
#   CUTOUT -- created by a button in the plan view, placed by the user, limited
#       to a deck edge. Lands in params["zones"] as type "cutout", so
#       get_cutout_rects() returns it and the framing opens. This always worked.
#
#   NOTCH -- created by DRAGGING a stair into the deck (planView.js onStairDrag,
#       which writes anchorX/anchorY and only snaps back to an edge if released
#       within 1.5 ft of one). It lands in params["deckStairs"] and populates
#       NOTHING that the framing engine reads. get_cutout_rects() returned [],
#       so the beam ran straight through the stairwell and a post could stand
#       inside it. Measured on a 40x12: post at (20.0, 10.5) inside the stair
#       box x[18,22] y[6.0,11.2] -- in BOTH axes. That cannot be built.
#
# This module closes that gap. The trigger is purely geometric and matches the
# product rule exactly:
#
#     stair footprint overlaps the deck plane  -> opening, framing must open
#     stair footprint clears the deck plane    -> no opening, framing continuous
#
# An edge-anchored stair starts AT the deck edge and runs outward, so its
# overlap is zero and it produces nothing here. Those sheets stay byte-identical.
#
# SCOPE (S102, deliberate -- Billy: the excluded case is very rare):
#   Handled  : stairs that start inside the deck and still exit past the rim.
#              These are a notch in the edge; the existing notch pipeline
#              (front_edge_profile / notch_headers / compute_beam_layout) already
#              draws them correctly.
#   REFUSED  : stairs whose footprint is fully interior (never touches the rim).
#              A true interior opening needs a second header on the yard side and
#              there is no reference example in docs/reference_sets. Flagged, not
#              guessed -- see get_stair_opening_warnings().
#   REFUSED  : stairs rotated off-axis (angle not a multiple of 90). The framing
#              pipeline takes axis-aligned rects; a bbox would over-cut, which is
#              the S81e mistake.
#
# DO NOT call this from stair_utils.resolve_all_stairs() or anything it calls.
# That function already calls get_cutout_rects() to find the notch edge a stair
# should sit on; routing stair openings back into it would recurse forever.
# =============================================================================

_STAIR_OPEN_EPS = 0.02          # ft; below this an overlap is a touching edge
_STAIR_MIN_OPEN_DEPTH = 0.25    # ft; ignore slivers


def _stair_part_boxes(rs):
    """World-space box PER RUN AND LANDING of a resolved stair, or None.

    S106: the opening used to be cut from the bbox of the WHOLE stair, then
    clipped to the deck. Parts that never enter the deck still widened that
    bbox: Will's 27x12 lLeft had only its 4ft run 1 inside the deck, but run 2
    (entirely outside, descending parallel to the front) stretched the bbox to
    7.5ft, cutting a giant hole in the decking and exposing the beam post at
    x=17.33 inside a stairwell it was never actually in. Openings must be
    built from parts that individually intersect the deck, so each part gets
    its own box. Only valid for angles that are multiples of 90.
    """
    from .stair_utils import transform_stair_rect

    sg = rs.get("geometry")
    if not sg:
        return None
    ang = float(rs.get("angle") or 0)
    if abs((ang % 90.0)) > 1e-6:
        return None  # off-axis: refused, see module note

    boxes = []
    for part in list(sg.get("runs") or []) + list(sg.get("landings") or []):
        r = part.get("rect")
        if not r:
            continue
        xs, ys = [], []
        for cx, cy in transform_stair_rect(r, rs["world_anchor_x"],
                                           rs["world_anchor_y"], ang):
            xs.append(cx)
            ys.append(cy)
        if xs:
            boxes.append((min(xs), max(xs), min(ys), max(ys)))
    return boxes or None


def _stair_world_footprint(rs):
    """Axis-aligned world bbox of a resolved stair's runs + landings.

    Returns (x0, x1, y0, y1) or None. Only valid for angles that are multiples
    of 90, where the bbox is exact rather than an over-approximation.
    NOTE: this is the WHOLE-STAIR bbox. Opening analysis must NOT clip this
    directly (S106); it uses _stair_part_boxes so parts outside the deck
    cannot inflate the opening.
    """
    boxes = _stair_part_boxes(rs)
    if not boxes:
        return None
    return (min(b[0] for b in boxes), max(b[1] for b in boxes),
            min(b[2] for b in boxes), max(b[3] for b in boxes))


def _analyse_stair_openings(params):
    """Shared worker: returns (rects, warnings).

    Split out so get_stair_opening_rects() and get_stair_opening_warnings()
    cannot drift from one another.
    """
    deck_stairs = params.get("deckStairs")
    if not deck_stairs:
        return [], []

    W = float(params.get("width") or 0)
    D = float(params.get("depth") or 0)
    if W <= 0 or D <= 0:
        return [], []

    from .stair_utils import resolve_all_stairs

    # Param-only stub. resolve_all_stairs() uses calc solely for width/depth on
    # the deckStairs path, and those come from params anyway -- so this avoids
    # depending on calculate_structure(), which is what needs these rects.
    stub = {"width": W, "depth": D, "stairs": None}
    try:
        resolved = resolve_all_stairs(params, stub)
    except Exception:
        return [], []

    # A stair that snaps INTO an existing user cutout is the same hole, not a
    # second one. Emitting both double-draws the header and moves golden on
    # configs that were already correct (caught by golden on notch_front_stair).
    existing = [c["rect"] for c in get_cutout_rects(params)]

    def _already_cut(r):
        ra = r["w"] * r["d"]
        if ra <= 0:
            return True
        for e in existing:
            ox = max(0.0, min(r["x"] + r["w"], e["x"] + e["w"]) - max(r["x"], e["x"]))
            oy = max(0.0, min(r["y"] + r["d"], e["y"] + e["d"]) - max(r["y"], e["y"]))
            if (ox * oy) / ra >= 0.80:
                return True
        return False

    rects, warnings = [], []
    for rs in resolved:
        sid = (rs.get("stair") or {}).get("id")

        # Zone-0 only for now: the framing pipeline is zone-0 only.
        if (rs.get("stair") or {}).get("zoneId") not in (0, None):
            continue

        boxes = _stair_part_boxes(rs)
        if boxes is None:
            if rs.get("geometry"):
                warnings.append({
                    "stair_id": sid, "kind": "off_axis",
                    "message": "Stair %s is rotated off-axis; its opening is not "
                               "drawn. Rotate to 0/90/180/270 or use a cutout."
                               % sid,
                })
            continue

        # S106: clip PER PART and union only the survivors. Clipping the
        # whole-stair bbox let parts entirely outside the deck (an lLeft's
        # run 2, its landing) inflate the opening: measured 7.5ft cut for a
        # 4ft stair, with a beam post exposed inside the phantom hole.
        surviving = []
        for (px0, px1, py0, py1) in boxes:
            sx0, sx1 = max(0.0, px0), min(W, px1)
            sy0, sy1 = max(0.0, py0), min(D, py1)
            if (sx1 - sx0) > _STAIR_OPEN_EPS and (sy1 - sy0) > _STAIR_MIN_OPEN_DEPTH:
                surviving.append((px0, px1, py0, py1, sx0, sx1, sy0, sy1))
        if not surviving:
            continue  # edge-anchored / clears the deck -> no opening

        x0 = min(s[0] for s in surviving)
        x1 = max(s[1] for s in surviving)
        y0 = min(s[2] for s in surviving)
        y1 = max(s[3] for s in surviving)
        cx0 = min(s[4] for s in surviving)
        cx1 = max(s[5] for s in surviving)
        cy0 = min(s[6] for s in surviving)
        cy1 = max(s[7] for s in surviving)

        reaches_rim = (
            y1 >= D - _STAIR_OPEN_EPS or y0 <= _STAIR_OPEN_EPS
            or x1 >= W - _STAIR_OPEN_EPS or x0 <= _STAIR_OPEN_EPS
        )
        if not reaches_rim:
            warnings.append({
                "stair_id": sid, "kind": "interior_opening",
                "message": "Stair %s sits fully inside the deck (opening "
                           "x[%.2f,%.2f] y[%.2f,%.2f] never reaches an edge). A "
                           "true interior opening needs a second header on the "
                           "yard side; no reference detail exists, so the "
                           "framing is NOT cut. Move the stair to an edge or "
                           "add a cutout." % (sid, cx0, cx1, cy0, cy1),
            })
            continue

        _r = {"x": round(cx0, 4), "y": round(cy0, 4),
              "w": round(cx1 - cx0, 4), "d": round(cy1 - cy0, 4)}
        if _already_cut(_r):
            continue  # the user's cutout already opened this hole

        rects.append({
            "id": "stair-%s" % sid,
            "source": "stair",
            "stair_id": sid,
            "zone": None,
            "rect": _r,
        })

    return rects, warnings


def get_stair_opening_rects(params):
    """Opening rects produced by stairs dragged into the deck. See module note."""
    return _analyse_stair_openings(params)[0]


def get_stair_opening_warnings(params):
    """Stair openings we deliberately refuse to draw, with the reason."""
    return _analyse_stair_openings(params)[1]


def get_opening_rects(params):
    """EVERY opening in the deck plane: user cutouts + stair-derived notches.

    This is what the FRAMING pipeline should consume -- beam layout, headers,
    joists, rim, decking. get_cutout_rects() remains cutouts-only because stair
    PLACEMENT depends on it (a stair snaps to a notch edge), and feeding stair
    openings back into placement would recurse.
    """
    return list(get_cutout_rects(params)) + list(get_stair_opening_rects(params))


# ---- S105: ONE naming rule. Mirror of sectionName() in zoneUtils.js. ----
#
# WHY THIS EXISTS. "Zone" already means ZONING DISTRICT on a permit site plan.
# Measured across all four approved PPRBD reference sets, the word appears
# exactly once: "ZONE: R1-6" on Meadowview's site plan. It is never used for a
# part of a deck. The sets label deck parts DECK A / DECK B (9 hits). We were
# printing "ZONE 1" on a sheet beside zoning setbacks, which is a wrong word,
# not a style preference.
#
# Letters follow POSITION, not id, because ids are never reused and lettering
# by id leaves "Deck A, Deck C" after a delete. A gap like that on a submitted
# sheet reads as a missing section.
#
# Cutouts are holes, not deck parts. They never consume a letter.
#
# THIS MUST STAY IDENTICAL TO zoneUtils.js sectionName(). Guarded by
# tests/test_section_naming_parity.py.
_AUTO_LABEL = re.compile(r"^(zone|cutout|main deck)(\s+\d+)?$", re.IGNORECASE)


def is_auto_label(s):
    return not s or bool(_AUTO_LABEL.match(str(s).strip()))


def section_letter(i):
    """0->A, 25->Z, 26->AA. MAX_ADD_ZONES=3 means we never pass D in practice."""
    s = ""
    i = int(i)
    while True:
        s = chr(65 + (i % 26)) + s
        i = i // 26 - 1
        if i < 0:
            return s


def section_name(zone_id, params):
    """Display name for a zone id. Zone 0 is virtual, its label is synthesised,
    never user-typed, so it is always 'Deck A'."""
    if zone_id == 0:
        return "Deck A"
    zones = (params or {}).get("zones") or []
    add_idx = 0
    cut_idx = 0
    for z in zones:
        is_cut = z.get("type") == "cutout"
        if is_cut:
            cut_idx += 1
        else:
            add_idx += 1
        if z.get("id") == zone_id:
            label = z.get("label")
            if not is_auto_label(label):
                return label
            return "Cutout %d" % cut_idx if is_cut else "Deck " + section_letter(add_idx)
    return "Deck " + section_letter(zone_id)
