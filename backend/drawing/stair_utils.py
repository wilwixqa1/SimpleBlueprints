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

        # Compute stair geometry
        sw = float(stair.get("width", 4))
        ns = int(stair.get("numStringers", 3))
        st_info = compute_stair_info(height, sw, ns)
        if not st_info:
            continue

        resolved.append({
            "stair": stair,
            "zone_rect": zr,
            "world_anchor_x": wax,
            "world_anchor_y": way,
            "angle": placement["angle"],
            "exit_side": get_stair_exit_side(placement["angle"]),
            "stair_info": st_info,
        })

    return resolved
