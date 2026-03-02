"""
SimpleBlueprints — Structural Calculation Engine
Production version — mirrors frontend calcStructure() exactly
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


def calculate_structure(params):
    width = params["width"]
    depth = params["depth"]
    height = params["height"]
    attachment = params["attachment"]
    joist_spacing = params["joistSpacing"]
    snow = SNOW_LOADS.get(params["snowLoad"], 0)
    frost = FROST_DEPTHS.get(params["frostZone"], 30)

    area = width * depth
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

    # Auto posts
    if width <= 10: auto_np = 2
    elif width <= 16: auto_np = 3
    elif width <= 24: auto_np = 3
    elif width <= 32: auto_np = 4
    else: auto_np = max(4, math.ceil(width / 10) + 1)
    num_posts = params.get("overPostCount") or auto_np

    beam_span = width / (num_posts - 1)

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
    auto_post_size = "6x6" if height > 8 else ("6x6" if TL > 60 and height > 5 else "4x4")
    post_size = params.get("overPostSize") or auto_post_size

    post_positions = []
    for i in range(num_posts):
        if num_posts == 1:
            post_positions.append(width / 2)
        else:
            post_positions.append(round(2 + i * (width - 4) / (num_posts - 1), 2))

    total_posts = num_posts if attachment == "ledger" else num_posts * 2

    trib_area = (width / max(num_posts - 1, 1)) * depth
    footing_load = trib_area * TL
    required_area = footing_load / 1500
    required_diam_in = math.sqrt(required_area / math.pi) * 2 * 12
    standard_sizes = [12, 16, 18, 21, 24, 30]
    auto_footing = 12
    for s in standard_sizes:
        if s >= required_diam_in:
            auto_footing = s
            break
    else:
        auto_footing = 30
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

    warnings = []
    max_span_available = joist_spans.get("2x12", {}).get(joist_spacing, 0)
    if joist_span > max_span_available:
        warnings.append(f"Joist span ({joist_span:.1f}') exceeds IRC tables at {TL} PSF. Engineering required.")
    if height > 10:
        warnings.append("Height >10'. Lateral bracing by engineer recommended.")
    if area > 500:
        warnings.append("Area >500 SF. Check local permit requirements.")

    return {
        "width": width, "depth": depth, "height": height, "area": round(area, 1),
        "attachment": attachment, "LL": LL, "DL": DL, "TL": TL,
        "joist_size": joist_size, "joist_spacing": joist_spacing,
        "joist_span": round(joist_span, 1), "num_joists": num_joists,
        "beam_size": beam_size, "beam_span": round(beam_span, 1),
        "post_size": post_size, "num_posts": num_posts,
        "total_posts": total_posts, "post_positions": post_positions,
        "footing_diam": footing_diam, "footing_depth": footing_depth,
        "num_footings": total_posts, "ledger_size": ledger_size,
        "rail_length": round(rail_length, 1), "rail_height": 36,
        "stairs": stair_info, "warnings": warnings,
        "auto": {
            "joist": auto_joist, "beam": auto_beam,
            "post_size": auto_post_size, "post_count": auto_np,
            "footing": auto_footing,
        }
    }
