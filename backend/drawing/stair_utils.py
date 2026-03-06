"""
Shared stair-placement helper.
Mirrors the frontend getStairPlacement(p, c) logic so every backend
drawing module resolves stair position the same way.
"""


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
