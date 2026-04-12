"""
Shared stair-placement helper.
Mirrors the frontend getStairPlacement(p, c) logic so every backend
drawing module resolves stair position the same way.

S65: Added get_stair_placement_for_zone() and compute_stair_info() for
multi-stair PDF rendering.
"""

import math


def get_stair_placement(params: dict, calc: dict) -> dict:
    """Return { anchor_x, anchor_y, angle } in feet.

    If the new parametric fields (stairAnchorX, stairAnchorY, stairAngle)
    are present, use them directly.  Otherwise fall back to the legacy
    stairLocation / stairOffset pair.

    Coordinate system (matches frontend):
        Origin = deck top-left corner (house-wall / left-edge intersection)
        +X  = rightward along house wall
        +Y  = outward from house (toward yard)
        angle: 0 = front (exit toward yard)
               90 = right
               180 = back (toward house \u2014 unusual but allowed)
               270 = left
    """
    ax = params.get("stairAnchorX")
    ay = params.get("stairAnchorY")
    ang = params.get("stairAngle")

    if ax is not None and ay is not None and ang is not None:
        return {"anchor_x": float(ax), "anchor_y": float(ay), "angle": float(ang)}

    # Legacy fallback
    loc = params.get("stairLocation", "front")
    off = float(params.get("stairOffset", 0))
    W = float(calc["width"])
    D = float(calc["depth"])

    if loc == "front":
        return {"anchor_x": W / 2 + off, "anchor_y": D, "angle": 0}
    if loc == "right":
        return {"anchor_x": W, "anchor_y": D / 2 + off, "angle": 90}
    if loc == "left":
        return {"anchor_x": 0, "anchor_y": D / 2 + off, "angle": 270}

    # Default: front-center
    return {"anchor_x": W / 2, "anchor_y": D, "angle": 0}


def get_stair_exit_side(angle: float) -> str:
    """Convert angle to a cardinal exit direction string."""
    a = int(angle) % 360
    if a == 0:
        return "front"
    if a == 90:
        return "right"
    if a == 180:
        return "back"
    if a == 270:
        return "left"
    # Nearest 90 degrees
    snapped = round(a / 90) * 90 % 360
    return get_stair_exit_side(snapped)


def get_stair_placement_for_zone(stair: dict, zone_rect: dict) -> dict:
    """Compute stair anchor in zone-local coords. Mirrors frontend getStairPlacementForZone.

    stair: dict with keys location, offset, anchorX, anchorY, angle, width, ...
    zone_rect: dict with keys x, y, w, d (world-space zone rectangle)
    Returns: { anchor_x, anchor_y, angle } in zone-local coords
    """
    ax = stair.get("anchorX")
    ay = stair.get("anchorY")
    ang = stair.get("angle")
    if ax is not None and ay is not None and ang is not None:
        return {"anchor_x": float(ax), "anchor_y": float(ay), "angle": float(ang)}

    W = zone_rect["w"]
    D = zone_rect["d"]
    off = float(stair.get("offset", 0))
    loc = stair.get("location", "front")

    if loc == "front":
        return {"anchor_x": W / 2 + off, "anchor_y": D, "angle": 0}
    if loc == "right":
        return {"anchor_x": W, "anchor_y": D / 2 + off, "angle": 90}
    if loc == "left":
        return {"anchor_x": 0, "anchor_y": D / 2 + off, "angle": 270}
    return {"anchor_x": W / 2, "anchor_y": D, "angle": 0}


def compute_stair_geometry(template: str, height: float, stair_width: float = 4,
                           num_stringers: int = 3, run_split=None,
                           landing_depth=None, stair_gap: float = 0.5) -> dict:
    """Compute multi-segment stair geometry. Python port of frontend computeStairGeometry().

    All coords in feet. Origin (0,0) = stair exit on deck edge.
    +Y = away from house, +X = right (facing away from house).

    Returns:
        { template, runs, landings, totalRisers, riseIn, stairWidth,
          bbox: { minX, minY, maxX, maxY, w, h },
          totalStringers, totalLandingPosts }
    Each run: { risers, treads, runFt, nStringers, rect: {x,y,w,h}, treadAxis, downDir }
    Each landing: { rect: {x,y,w,h}, posts: [[x,y], ...] }
    """
    if height <= 0.5:
        return None
    sw = stair_width or 4
    ns = num_stringers or 3
    total_rise_in = height * 12
    total_risers = math.ceil(total_rise_in / 7.5)
    rise_in = total_rise_in / total_risers
    tread_in = 10.5
    gap = stair_gap

    def split_risers(n_runs):
        if n_runs == 1:
            return [total_risers]
        if n_runs == 2:
            ratio = run_split if (run_split is not None and not isinstance(run_split, list)) else 0.55
            r1 = math.ceil(total_risers * ratio)
            return [r1, total_risers - r1]
        if n_runs == 3:
            ratios = run_split if isinstance(run_split, list) else [0.4, 0.3]
            r1 = math.ceil(total_risers * ratios[0])
            r2 = math.ceil(total_risers * ratios[1])
            return [r1, r2, total_risers - r1 - r2]
        return [total_risers]

    def get_landing_depth():
        return landing_depth if landing_depth is not None else max(sw, 4)

    def make_run(risers):
        treads = max(risers - 1, 1)
        run_ft = round(treads * tread_in / 12, 1)
        return {"risers": risers, "treads": treads, "runFt": run_ft, "nStringers": ns}

    runs = []
    landings = []

    if template == "straight":
        run = make_run(total_risers)
        runs.append({**run, "rect": {"x": -sw/2, "y": 0, "w": sw, "h": run["runFt"]},
                     "treadAxis": "h", "downDir": "+y"})

    elif template == "wideLanding":
        r1n, r2n = split_risers(2)
        run1, run2 = make_run(r1n), make_run(r2n)
        plat_w = sw + 2
        plat_d = get_landing_depth()
        runs.append({**run1, "rect": {"x": -sw/2, "y": 0, "w": sw, "h": run1["runFt"]},
                     "treadAxis": "h", "downDir": "+y"})
        ly = run1["runFt"]
        landings.append({"rect": {"x": -plat_w/2, "y": ly, "w": plat_w, "h": plat_d},
                         "posts": [[-plat_w/2, ly], [plat_w/2, ly],
                                   [-plat_w/2, ly + plat_d], [plat_w/2, ly + plat_d]]})
        runs.append({**run2, "rect": {"x": -sw/2, "y": ly + plat_d, "w": sw, "h": run2["runFt"]},
                     "treadAxis": "h", "downDir": "+y"})

    elif template == "lLeft":
        r1n, r2n = split_risers(2)
        run1, run2 = make_run(r1n), make_run(r2n)
        ld = get_landing_depth()
        runs.append({**run1, "rect": {"x": -sw/2, "y": 0, "w": sw, "h": run1["runFt"]},
                     "treadAxis": "h", "downDir": "+y"})
        ly = run1["runFt"]
        landings.append({"rect": {"x": -sw/2, "y": ly, "w": sw, "h": ld},
                         "posts": [[-sw/2, ly], [sw/2, ly],
                                   [-sw/2, ly + ld], [sw/2, ly + ld]]})
        runs.append({**run2, "rect": {"x": -sw/2 - run2["runFt"], "y": ly + (ld - sw)/2,
                                       "w": run2["runFt"], "h": sw},
                     "treadAxis": "w", "downDir": "-x"})

    elif template == "lRight":
        r1n, r2n = split_risers(2)
        run1, run2 = make_run(r1n), make_run(r2n)
        ld = get_landing_depth()
        runs.append({**run1, "rect": {"x": -sw/2, "y": 0, "w": sw, "h": run1["runFt"]},
                     "treadAxis": "h", "downDir": "+y"})
        ly = run1["runFt"]
        landings.append({"rect": {"x": -sw/2, "y": ly, "w": sw, "h": ld},
                         "posts": [[-sw/2, ly], [sw/2, ly],
                                   [-sw/2, ly + ld], [sw/2, ly + ld]]})
        runs.append({**run2, "rect": {"x": sw/2, "y": ly + (ld - sw)/2,
                                       "w": run2["runFt"], "h": sw},
                     "treadAxis": "w", "downDir": "+x"})

    elif template == "switchback":
        r1n, r2n = split_risers(2)
        run1, run2 = make_run(r1n), make_run(r2n)
        max_run = max(run1["runFt"], run2["runFt"])
        ld = get_landing_depth()
        total_w = sw * 2 + gap
        runs.append({**run1, "rect": {"x": gap/2, "y": 0, "w": sw, "h": run1["runFt"]},
                     "treadAxis": "h", "downDir": "+y"})
        ly = max_run
        landings.append({"rect": {"x": -sw - gap/2, "y": ly, "w": total_w, "h": ld},
                         "posts": [[-sw - gap/2, ly], [sw + gap/2, ly],
                                   [-sw - gap/2, ly + ld], [sw + gap/2, ly + ld]]})
        runs.append({**run2, "rect": {"x": -sw - gap/2, "y": ly - run2["runFt"],
                                       "w": sw, "h": run2["runFt"]},
                     "treadAxis": "h", "downDir": "-y"})

    elif template == "wrapAround":
        r1n, r2n, r3n = split_risers(3)
        run1, run2, run3 = make_run(r1n), make_run(r2n), make_run(r3n)
        ld = get_landing_depth()
        total_w = sw * 2 + gap
        runs.append({**run1, "rect": {"x": gap/2, "y": 0, "w": sw, "h": run1["runFt"]},
                     "treadAxis": "h", "downDir": "+y"})
        l1y = run1["runFt"]
        landings.append({"rect": {"x": -sw - gap/2, "y": l1y, "w": total_w, "h": ld},
                         "posts": [[-sw - gap/2, l1y], [sw + gap/2, l1y],
                                   [-sw - gap/2, l1y + ld], [sw + gap/2, l1y + ld]]})
        runs.append({**run2, "rect": {"x": -sw - gap/2, "y": l1y - run2["runFt"],
                                       "w": sw, "h": run2["runFt"]},
                     "treadAxis": "h", "downDir": "-y"})
        l2y = l1y - run2["runFt"] - ld
        l2x = -sw - gap/2 - run3["runFt"]
        landings.append({"rect": {"x": l2x, "y": l2y, "w": sw + run3["runFt"] + gap/2, "h": ld},
                         "posts": [[l2x, l2y], [-gap/2, l2y],
                                   [l2x, l2y + ld], [-gap/2, l2y + ld]]})
        runs.append({**run3, "rect": {"x": l2x, "y": l2y + (ld - sw)/2,
                                       "w": run3["runFt"], "h": sw},
                     "treadAxis": "w", "downDir": "-x"})
    else:
        # Unknown template, fall back to straight
        run = make_run(total_risers)
        runs.append({**run, "rect": {"x": -sw/2, "y": 0, "w": sw, "h": run["runFt"]},
                     "treadAxis": "h", "downDir": "+y"})

    # Compute bounding box
    all_items = runs + landings
    min_x = min(item["rect"]["x"] for item in all_items)
    min_y = min(item["rect"]["y"] for item in all_items)
    max_x = max(item["rect"]["x"] + item["rect"]["w"] for item in all_items)
    max_y = max(item["rect"]["y"] + item["rect"]["h"] for item in all_items)

    return {
        "template": template,
        "runs": runs,
        "landings": landings,
        "totalRisers": total_risers,
        "riseIn": round(rise_in, 2),
        "stairWidth": sw,
        "bbox": {"minX": min_x, "minY": min_y, "maxX": max_x, "maxY": max_y,
                 "w": max_x - min_x, "h": max_y - min_y},
        "totalStringers": sum(r["nStringers"] for r in runs),
        "totalLandingPosts": sum(len(l["posts"]) for l in landings),
    }


def transform_stair_point(lx, ly, anchor_x, anchor_y, angle_deg):
    """Transform a stair-local point to world coordinates.
    Stair-local: +Y = away from house, +X = right.
    World: same axes as plan view (X = left-right, Y = front-back).
    """
    rad = math.radians(angle_deg)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)
    wx = anchor_x + lx * cos_a - ly * sin_a
    wy = anchor_y + lx * sin_a + ly * cos_a
    return wx, wy


def transform_stair_rect(rect, anchor_x, anchor_y, angle_deg):
    """Transform a stair-local rect to world-space polygon (4 corners).
    Returns list of 4 (x, y) tuples in world coords.
    """
    x, y, w, h = rect["x"], rect["y"], rect["w"], rect["h"]
    corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    return [transform_stair_point(cx, cy, anchor_x, anchor_y, angle_deg) for cx, cy in corners]


def compute_stair_info(height: float, stair_width: float = 4,
                       num_stringers: int = 3) -> dict:
    """Compute stair geometry for any stair given deck height.
    Mirrors calc_engine stair calculation.
    Returns same dict shape as calc["stairs"].
    """
    if height <= 0.5:
        return None
    num_risers = math.ceil(height * 12 / 7.5)
    actual_rise = height * 12 / num_risers
    tread_depth = 10.5
    total_run = (num_risers - 1) * tread_depth
    stringer_length = math.sqrt((height * 12) ** 2 + total_run ** 2) / 12
    return {
        "num_risers": num_risers,
        "num_treads": num_risers - 1,
        "actual_rise": round(actual_rise, 2),
        "tread_depth": tread_depth,
        "total_run_ft": round(total_run / 12, 1),
        "stringer_length_ft": round(stringer_length + 1, 1),
        "num_stringers": num_stringers,
        "width": stair_width,
        "has_landing": False,
    }


def resolve_all_stairs(params: dict, calc: dict) -> list:
    """Resolve all stairs from deckStairs array into world-space placements.

    Returns list of dicts:
        { stair, zone_rect, placement_local, world_anchor_x, world_anchor_y,
          angle, stair_info, exit_side }
    Falls back to flat params if deckStairs not present.
    """
    from .zone_utils import get_additive_rects

    deck_stairs = params.get("deckStairs")
    height = float(params.get("height", 4))

    # Fallback: no deckStairs array -> use flat params (backward compat)
    if not deck_stairs:
        if not params.get("hasStairs"):
            return []
        st_info = calc.get("stairs")
        if not st_info:
            return []
        placement = get_stair_placement(params, {"width": calc["width"], "depth": calc["depth"]})
        return [{
            "stair": {
                "id": 0, "zoneId": 0,
                "location": params.get("stairLocation", "front"),
                "width": st_info["width"],
                "numStringers": st_info["num_stringers"],
            },
            "zone_rect": {"x": 0, "y": 0, "w": calc["width"], "d": calc["depth"]},
            "world_anchor_x": placement["anchor_x"],
            "world_anchor_y": placement["anchor_y"],
            "angle": placement["angle"],
            "exit_side": get_stair_exit_side(placement["angle"]),
            "stair_info": st_info,
        }]

    # Build zone rect lookup: zone_id -> rect
    # S81d NOTE: `height` above is a single global value used for every stair below.
    # This is incorrect once zones can have per-zone heights and stairs can land
    # transitionally on other zones. Fix in S81e along with draw_plan.py rendering.
    # The JS engine (engine.js) already resolves per-stair fromH/toH from
    # anchor zone and _landsOnZoneId; mirror that logic here when wiring up
    # drawing.
    add_rects = get_additive_rects(params)
    zone_rects = {}
    for ar in add_rects:
        zone_rects[ar["id"]] = ar["rect"]
    # Zone 0 is always { x:0, y:0, w:W, d:D }
    zone_rects[0] = {"x": 0, "y": 0, "w": float(calc["width"]), "d": float(calc["depth"])}

    resolved = []
    for stair in deck_stairs:
        zone_id = stair.get("zoneId", 0)
        zr = zone_rects.get(zone_id)
        if not zr:
            continue  # orphaned stair, skip

        # Compute placement in zone-local coords
        placement = get_stair_placement_for_zone(stair, zr)

        # Convert to world coords
        wax = zr["x"] + placement["anchor_x"]
        way = zr["y"] + placement["anchor_y"]

        # Compute stair geometry (flat info for backward compat)
        sw = float(stair.get("width", 4))
        ns = int(stair.get("numStringers", 3))
        st_info = compute_stair_info(height, sw, ns)
        if not st_info:
            continue

        # S68: Compute full template geometry (runs + landings)
        template = stair.get("template", "straight")
        raw_split = stair.get("runSplit")
        run_split_val = raw_split / 100 if (raw_split is not None and not isinstance(raw_split, list)) else raw_split
        landing_depth_val = stair.get("landingDepth")
        if landing_depth_val is not None:
            landing_depth_val = float(landing_depth_val)
        stair_gap_val = float(stair.get("stairGap", 0.5))
        sg = compute_stair_geometry(
            template=template, height=height,
            stair_width=sw, num_stringers=ns,
            run_split=run_split_val,
            landing_depth=landing_depth_val,
            stair_gap=stair_gap_val,
        )

        resolved.append({
            "stair": stair,
            "zone_rect": zr,
            "world_anchor_x": wax,
            "world_anchor_y": way,
            "angle": placement["angle"],
            "exit_side": get_stair_exit_side(placement["angle"]),
            "stair_info": st_info,
            "geometry": sg,  # S68: full template geometry
        })

    return resolved
