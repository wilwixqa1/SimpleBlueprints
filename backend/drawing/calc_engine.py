"""
SimpleBlueprints ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Structural Calculation Engine
Production version ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ mirrors frontend calcStructure() exactly
"""

import math

IRC_JOIST_SPANS_BY_LOAD = {
    50: {"2x6": {12: 9.5, 16: 8.5, 24: 7.0}, "2x8": {12: 12.5, 16: 11.5, 24: 9.5}, "2x10": {12: 16.0, 16: 14.5, 24: 12.0}, "2x12": {12: 19.5, 16: 17.5, 24: 14.5}},
    60: {"2x6": {12: 8.5, 16: 7.5, 24: 6.0}, "2x8": {12: 11.0, 16: 10.0, 24: 8.5}, "2x10": {12: 14.0, 16: 12.5, 24: 10.5}, "2x12": {12: 17.0, 16: 15.5, 24: 12.5}},
    75: {"2x6": {12: 7.5, 16: 6.5, 24: 5.5}, "2x8": {12: 10.0, 16: 9.0, 24: 7.5}, "2x10": {12: 12.5, 16: 11.0, 24: 9.5}, "2x12": {12: 15.0, 16: 13.5, 24: 11.0}},
    95: {"2x6": {12: 6.5, 16: 5.5, 24: 4.5}, "2x8": {12: 8.5, 16: 7.5, 24: 6.5}, "2x10": {12: 11.0, 16: 9.5, 24: 8.0}, "2x12": {12: 13.0, 16: 11.5, 24: 9.5}},
}

IRC_BEAM_CAPACITY = {
    "2-ply 2x8": {"max_span": 6, "max_trib": 8},
    "2-ply 2x10": {"max_span": 8, "max_trib": 10},
    "2-ply 2x12": {"max_span": 9, "max_trib": 12},
    "3-ply 2x10": {"max_span": 10, "max_trib": 13},
    "3-ply 2x12": {"max_span": 12, "max_trib": 15},
    "3-ply LVL 1.75x12": {"max_span": 14, "max_trib": 18},
}

FROST_DEPTHS = {"warm": 12, "moderate": 24, "cold": 36, "severe": 48}
SNOW_LOADS = {"none": 0, "light": 20, "moderate": 40, "heavy": 60}


def get_joist_spans_for_load(total_load):
    tiers = sorted(IRC_JOIST_SPANS_BY_LOAD.keys())
    for tier in tiers:
        if total_load <= tier:
            return IRC_JOIST_SPANS_BY_LOAD[tier]
    return IRC_JOIST_SPANS_BY_LOAD[tiers[-1]]


# S40: Stair-aware post placement helpers (mirrors frontend engine.js)
def get_stair_opening_on_beam(params, width, depth):
    if not params.get("hasStairs") or (params.get("height", 0) or 0) <= 0.5:
        return None
    stair_w = params.get("stairWidth", 4)
    anchor_x = None
    if params.get("stairAnchorX") is not None and params.get("stairAngle") is not None:
        angle = params["stairAngle"] % 360
        if angle > 5 and abs(angle - 360) > 5:
            return None
        if params.get("stairAnchorY") is not None and abs(params["stairAnchorY"] - depth) > 1:
            return None
        anchor_x = params["stairAnchorX"]
    else:
        if (params.get("stairLocation", "front") or "front") != "front":
            return None
        anchor_x = width / 2 + (params.get("stairOffset", 0) or 0)
    clearance = 0.25
    return {
        "left": round(max(0, anchor_x - stair_w / 2 - clearance), 2),
        "right": round(min(width, anchor_x + stair_w / 2 + clearance), 2),
    }


def place_posts_smartly(width, num_posts, stair_opening):
    INSET = 2
    left_end = INSET
    right_end = width - INSET
    MIN_GAP = 1.0

    if not stair_opening:
        pp = [round(left_end + i * (right_end - left_end) / (num_posts - 1), 2) for i in range(num_posts)]
        return {"pp": pp, "header_span": None, "stair_opening": None}

    s_l = stair_opening["left"]
    s_r = stair_opening["right"]
    if s_r <= left_end or s_l >= right_end:
        pp = [round(left_end + i * (right_end - left_end) / (num_posts - 1), 2) for i in range(num_posts)]
        return {"pp": pp, "header_span": None, "stair_opening": stair_opening}

    open_l = round(max(s_l, left_end), 2)
    open_r = round(min(s_r, right_end), 2)
    if open_l - left_end < MIN_GAP:
        open_l = left_end
    if right_end - open_r < MIN_GAP:
        open_r = right_end
    header_span = round(open_r - open_l, 2)

    fixed = [left_end]
    if open_l != left_end:
        fixed.append(open_l)
    if open_r != right_end:
        fixed.append(open_r)
    fixed.append(right_end)
    fixed = sorted(set(fixed))

    target_span = (right_end - left_end) / max(num_posts - 1, 1)
    max_span = max(min(target_span, 8), 4)

    final_posts = []
    for seg in range(len(fixed) - 1):
        seg_l = fixed[seg]
        seg_r = fixed[seg + 1]
        seg_len = round(seg_r - seg_l, 2)

        if not final_posts or abs(final_posts[-1] - seg_l) > 0.01:
            final_posts.append(seg_l)

        # Skip header span (stair opening)
        if abs(seg_l - open_l) < 0.01 and abs(seg_r - open_r) < 0.01:
            continue

        if seg_len > max_span + 0.1:
            n_sub = math.ceil(seg_len / max_span)
            sub_sp = seg_len / n_sub
            for si in range(1, n_sub):
                final_posts.append(round(seg_l + si * sub_sp, 2))

    last = fixed[-1]
    if not final_posts or abs(final_posts[-1] - last) > 0.01:
        final_posts.append(last)

    return {
        "pp": final_posts,
        "header_span": header_span,
        "stair_opening": {"left": open_l, "right": open_r},
    }


def max_beam_span_from_posts(pp):
    mx = 0
    for i in range(1, len(pp)):
        s = pp[i] - pp[i - 1]
        if s > mx:
            mx = s
    return round(mx, 2)


def calculate_structure(params):
    width = params["width"]
    depth = params["depth"]
    height = params["height"]
    attachment = params["attachment"]
    joist_spacing = params["joistSpacing"]
    snow = SNOW_LOADS.get(params["snowLoad"], 0)
    frost = FROST_DEPTHS.get(params["frostZone"], 30)

    # Beam type: "dropped" (default, below joists) or "flush" (inline with joists)
    beam_type = params.get("beamType", "dropped")

    area = width * depth

    # S38: Lot area (single source of truth, mirrors engine.js)
    _lot_verts = params.get("lotVertices")
    if _lot_verts and len(_lot_verts) >= 3:
        _sa = 0
        for _i in range(len(_lot_verts)):
            _j = (_i + 1) % len(_lot_verts)
            _sa += _lot_verts[_i][0] * _lot_verts[_j][1]
            _sa -= _lot_verts[_j][0] * _lot_verts[_i][1]
        lot_area = round(abs(_sa) / 2)
    else:
        lot_area = params.get("lotWidth", 80) * params.get("lotDepth", 120)
    DL = 15 if params["deckingType"] == "composite" else 12
    LL = 40 + snow
    TL = DL + LL

    joist_span = depth - 1.5 if attachment == "ledger" else depth / 2 - 0.75
    joist_spans = get_joist_spans_for_load(TL)

    # Auto joist
    auto_joist = "2x12"
    for size, spans in joist_spans.items():
        if spans.get(joist_spacing, 0) >= joist_span:
            auto_joist = size
            break
    joist_size = params.get("overJoist") or auto_joist

    # S40: Auto posts (stair-aware placement)
    if width <= 10: auto_np = 2
    elif width <= 16: auto_np = 3
    elif width <= 24: auto_np = 3
    elif width <= 32: auto_np = 4
    else: auto_np = max(4, math.ceil(width / 10) + 1)
    num_posts = params.get("overPostCount") or auto_np

    # S40: Compute stair opening on beam line, place posts around it
    stair_opening = get_stair_opening_on_beam(params, width, depth)
    post_result = place_posts_smartly(width, num_posts, stair_opening)
    post_positions = post_result["pp"]
    requested_np = num_posts  # what user or auto requested before stair adjustment
    num_posts = len(post_positions)  # actual count after smart placement
    header_span = post_result["header_span"]
    stair_opening_resolved = post_result["stair_opening"]

    # S40: Beam span from actual max span between posts
    beam_span = max_beam_span_from_posts(post_positions)

    # Auto beam
    auto_beam = None
    for bsize, caps in IRC_BEAM_CAPACITY.items():
        if caps["max_span"] >= beam_span and caps["max_trib"] >= depth:
            auto_beam = bsize
            break
    if auto_beam is None:
        auto_beam = "3-ply LVL 1.75x12"
    beam_size = params.get("overBeam") or auto_beam

    # Auto post size
    auto_post_size = "6x6"  # Billy Rule 8: 6x6 minimum per IRC R507.8
    post_size = params.get("overPostSize") or auto_post_size

    total_posts = num_posts if attachment == "ledger" else num_posts * 2

    # S34: Slope-adjusted post heights per position (mirrors frontend engine.js)
    slope_pct = params.get("slopePercent", 0) / 100
    slope_dir = params.get("slopeDirection", "front-to-back")
    beam_depth = depth - 1.5
    post_heights = []
    for pp_x in post_positions:
        ground_drop = 0  # positive = ground is lower = post is taller
        if slope_dir == "front-to-back":
            ground_drop = slope_pct * beam_depth
        elif slope_dir == "back-to-front":
            ground_drop = -slope_pct * beam_depth
        elif slope_dir == "left-to-right":
            ground_drop = slope_pct * (pp_x - width / 2)
        elif slope_dir == "right-to-left":
            ground_drop = -(slope_pct * (pp_x - width / 2))
        post_heights.append(round(max(0.5, height + ground_drop), 2))

    trib_area = (width / max(num_posts - 1, 1)) * depth
    footing_load = trib_area * TL
    required_area = footing_load / 1500
    required_diam_in = math.sqrt(required_area / math.pi) * 2 * 12
    standard_sizes = [12, 16, 18, 21, 24, 30, 36, 42]
    auto_footing = 12
    for s in standard_sizes:
        if s >= required_diam_in:
            auto_footing = s
            break
    else:
        auto_footing = 42
    footing_diam = params.get("overFooting") or auto_footing

    footing_depth = max(frost, 12)
    num_joists = math.ceil(width / (joist_spacing / 12)) + 1
    ledger_size = joist_size

    if attachment == "ledger":
        rail_length = width + depth * 2
    else:
        rail_length = width * 2 + depth * 2
    if params.get("hasStairs"):
        rail_length -= 3

    stair_info = None
    if params.get("hasStairs") and height > 0.5:
        stair_width = params.get("stairWidth", 4)
        num_stringers_param = params.get("numStringers", 3)
        has_landing = params.get("hasLanding", False)
        stair_loc = params.get("stairLocation", "front")
        num_risers = math.ceil(height * 12 / 7.5)
        actual_rise = height * 12 / num_risers
        tread_depth = 10.5
        total_run = (num_risers - 1) * tread_depth
        stringer_length = math.sqrt((height * 12) ** 2 + total_run ** 2) / 12
        stair_info = {
            "num_risers": num_risers,
            "num_treads": num_risers - 1,
            "actual_rise": round(actual_rise, 2),
            "tread_depth": tread_depth,
            "total_run_ft": round(total_run / 12, 1),
            "stringer_length_ft": round(stringer_length + 1, 1),
            "num_stringers": num_stringers_param,
            "width": stair_width,
            "has_landing": has_landing,
            "location": stair_loc,
        }

    # Joist hanger count for flush beams
    joist_hangers_for_beam = num_joists * 2 if beam_type == "flush" else 0

    mid_span_blocking = joist_span > 7
    blocking_count = math.ceil(width / (joist_spacing / 12)) - 1 if mid_span_blocking else 0

    warnings = []
    max_span_available = joist_spans.get("2x12", {}).get(joist_spacing, 0)
    if joist_span > max_span_available:
        warnings.append(f"Joist span ({joist_span:.1f}') exceeds IRC tables at {TL} PSF. Engineering required.")
    if height > 10:
        warnings.append("Height >10'. Lateral bracing by engineer recommended.")
    if area > 500:
        warnings.append("Area >500 SF. Check local permit requirements.")
    # S40: Warn if stair placement required more posts than requested
    if header_span and num_posts > requested_np:
        warnings.append(f"Post count adjusted from {requested_np} to {num_posts} to clear stair opening. Header posts required at stair edges.")

    return {
        "width": width, "depth": depth, "height": height, "area": round(area, 1), "lot_area": lot_area,
        "attachment": attachment, "beam_type": beam_type, "LL": LL, "DL": DL, "TL": TL,
        "joist_size": joist_size, "joist_spacing": joist_spacing,
        "joist_span": round(joist_span, 1), "num_joists": num_joists,
        "beam_size": beam_size, "beam_span": round(beam_span, 1),
        "post_size": post_size, "num_posts": num_posts,
        "total_posts": total_posts, "post_positions": post_positions,
        "post_heights": post_heights,
        "footing_diam": footing_diam, "footing_depth": footing_depth,
        "num_footings": total_posts, "ledger_size": ledger_size,
        "rail_length": round(rail_length, 1), "rail_height": 36,
        "mid_span_blocking": mid_span_blocking, "blocking_count": blocking_count,
        "stairs": stair_info, "warnings": warnings,
        "joist_hangers_for_beam": joist_hangers_for_beam,
        "header_span": header_span, "stair_opening": stair_opening_resolved,
        "auto": {
            "joist": auto_joist, "beam": auto_beam,
            "post_size": auto_post_size, "post_count": auto_np,
            "footing": auto_footing,
        }
    }
