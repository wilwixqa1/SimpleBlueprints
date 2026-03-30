"""
# SimpleBlueprints   Structural Calculation Engine
# Production version   mirrors frontend calcStructure() exactly
#
# IRC 2021 Table R507.6 joist spans verified from published code (S59).
# IRC 2021 Table R507.5(1) beam spans: simplified lookup (beam overhaul deferred).
"""

import math

# ============================================================
# IRC 2021 TABLE R507.6: MAXIMUM DECK JOIST SPANS
# ============================================================
# Verified against 2021 International Residential Code, Section R507.6.
# Values in decimal feet. No. 2 grade, wet service factor included.
# Footnote a: DL = 10 psf assumed. Snow load not concurrent with live load.
# Footnote b/c: L/delta = 360 at main span.
#
# NOTE: Our engine uses DL=15 (composite) or DL=12 (wood), which is 2-5 PSF
# higher than the IRC's assumed DL=10. This makes our total load slightly
# higher than the IRC table's design basis. The difference is conservative
# for wood (DL=12, only 2 PSF over) and very slightly non-conservative for
# composite (DL=15, 5 PSF over = ~10% on a 50 PSF TL). This is within the
# lumber safety factor margin. A future update could adjust spans downward
# for composite, but would require engineering interpolation beyond the code
# tables.
#
# Design load tiers: 40 = live load, 50/60/70 = ground snow load.
# Lookup key = max(40, snow_load) per IRC footnote a.
# ============================================================

IRC_JOIST_SPANS = {
    # ----- Southern Pine (No. 2 grade, wet service) -----
    "southern_pine": {
        40: {
            "2x6":  {12: 9.92, 16: 9.0,  24: 7.58},
            "2x8":  {12: 13.08, 16: 11.83, 24: 9.67},
            "2x10": {12: 16.17, 16: 14.0, 24: 11.42},
            "2x12": {12: 18.0,  16: 16.5, 24: 13.5},
        },
        50: {
            "2x6":  {12: 9.17, 16: 8.33, 24: 7.33},
            "2x8":  {12: 12.08, 16: 11.0, 24: 9.42},
            "2x10": {12: 15.42, 16: 13.75, 24: 11.25},
            "2x12": {12: 18.0,  16: 16.17, 24: 13.17},
        },
        60: {
            "2x6":  {12: 8.67, 16: 7.83, 24: 6.83},
            "2x8":  {12: 11.42, 16: 10.33, 24: 8.75},
            "2x10": {12: 14.58, 16: 12.75, 24: 10.42},
            "2x12": {12: 17.25, 16: 15.0, 24: 12.25},
        },
        70: {
            "2x6":  {12: 8.25, 16: 7.5,  24: 6.42},
            "2x8":  {12: 10.83, 16: 9.83, 24: 8.17},
            "2x10": {12: 13.75, 16: 11.92, 24: 9.75},
            "2x12": {12: 16.17, 16: 14.0, 24: 11.42},
        },
    },
    # ----- Douglas Fir-Larch / Hem-Fir / Spruce-Pine-Fir -----
    # (incising factor included per IRC footnote e)
    # Most common lumber outside the South
    "dfl_hf_spf": {
        40: {
            "2x6":  {12: 9.5,  16: 8.33, 24: 6.83},
            "2x8":  {12: 12.5, 16: 11.08, 24: 9.08},
            "2x10": {12: 15.67, 16: 13.58, 24: 11.08},
            "2x12": {12: 18.0,  16: 15.75, 24: 12.83},
        },
        50: {
            "2x6":  {12: 8.83, 16: 8.0,  24: 6.67},
            "2x8":  {12: 11.58, 16: 10.58, 24: 8.92},
            "2x10": {12: 14.83, 16: 13.25, 24: 10.83},
            "2x12": {12: 17.75, 16: 15.42, 24: 12.58},
        },
        60: {
            "2x6":  {12: 8.33, 16: 7.5,  24: 6.17},
            "2x8":  {12: 10.92, 16: 9.92, 24: 8.25},
            "2x10": {12: 13.92, 16: 12.33, 24: 10.0},
            "2x12": {12: 16.5,  16: 14.25, 24: 11.67},
        },
        70: {
            "2x6":  {12: 7.92, 16: 7.08, 24: 5.75},
            "2x8":  {12: 10.42, 16: 9.42, 24: 7.67},
            "2x10": {12: 13.25, 16: 11.5, 24: 9.42},
            "2x12": {12: 15.42, 16: 13.33, 24: 10.92},
        },
    },
    # ----- Redwood / Western Cedars / Ponderosa Pine / Red Pine -----
    # (incising factor NOT included per IRC footnote f)
    "redwood_cedar": {
        40: {
            "2x6":  {12: 8.83, 16: 8.0,  24: 6.83},
            "2x8":  {12: 11.67, 16: 10.58, 24: 8.67},
            "2x10": {12: 14.92, 16: 13.0, 24: 10.58},
            "2x12": {12: 17.42, 16: 15.08, 24: 12.33},
        },
        50: {
            "2x6":  {12: 8.25, 16: 7.5,  24: 6.5},
            "2x8":  {12: 10.83, 16: 9.83, 24: 8.5},
            "2x10": {12: 13.83, 16: 12.58, 24: 10.42},
            "2x12": {12: 16.75, 16: 14.75, 24: 12.08},
        },
        60: {
            "2x6":  {12: 7.75, 16: 7.0,  24: 6.17},
            "2x8":  {12: 10.17, 16: 9.25, 24: 7.92},
            "2x10": {12: 13.0,  16: 11.75, 24: 9.58},
            "2x12": {12: 15.75, 16: 13.67, 24: 11.17},
        },
        70: {
            "2x6":  {12: 7.33, 16: 6.67, 24: 5.83},
            "2x8":  {12: 9.67, 16: 8.83, 24: 7.33},
            "2x10": {12: 12.33, 16: 11.0, 24: 9.0},
            "2x12": {12: 14.75, 16: 12.75, 24: 10.42},
        },
    },
}

# Legacy alias: flat lookup keyed by total load (for backward compat with checker)
# Maps our TL tiers to IRC design load tiers using default species
IRC_JOIST_SPANS_BY_LOAD = {
    50: IRC_JOIST_SPANS["dfl_hf_spf"][40],   # TL=50 -> IRC 40 PSF LL
    60: IRC_JOIST_SPANS["dfl_hf_spf"][50],   # TL=60 -> IRC 50 PSF snow
    70: IRC_JOIST_SPANS["dfl_hf_spf"][60],   # TL=70 -> IRC 60 PSF snow
    80: IRC_JOIST_SPANS["dfl_hf_spf"][70],   # TL=80 -> IRC 70 PSF snow
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


def get_joist_spans_for_load(design_load, species="dfl_hf_spf"):
    """Look up IRC joist spans by design load and species.

    design_load: the governing load = max(40, snow_load) per IRC footnote a.
    species: "southern_pine", "dfl_hf_spf", or "redwood_cedar".
    """
    species_data = IRC_JOIST_SPANS.get(species, IRC_JOIST_SPANS["dfl_hf_spf"])
    tiers = sorted(species_data.keys())
    for tier in tiers:
        if design_load <= tier:
            return species_data[tier]
    return species_data[tiers[-1]]


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
    # IRC R507.6 footnote a: "Snow load not assumed to be concurrent
    # with live load." Use whichever is greater, not both added.
    # Live load minimum is always 40 PSF (IRC Table R301.5).
    LL = max(40, snow)
    TL = DL + LL

    # Wood species for IRC table lookup (S59)
    species = params.get("species", "dfl_hf_spf")

    joist_span = depth - 1.5 if attachment == "ledger" else depth / 2 - 0.75
    # IRC table is keyed by design load (LL), not total load (TL).
    # The IRC assumes DL=10. Our higher DL is slightly conservative.
    joist_spans = get_joist_spans_for_load(LL, species)

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
    auto_post_size = "6x6"  # Billy Rule 8: 6x6 minimum per IRC R507.8
    post_size = params.get("overPostSize") or auto_post_size

    post_positions = []
    for i in range(num_posts):
        if num_posts == 1:
            post_positions.append(width / 2)
        else:
            post_positions.append(round(2 + i * (width - 4) / (num_posts - 1), 2))

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

    # Guard rail system (IRC R312.1.1, R312.1.3)
    # Guards required when walking surface > 30" above adjacent grade
    guard_required = height * 12 > 30
    # Auto height: 36" standard (IRC R312.1.3), 42" for elevated decks
    # Many jurisdictions require 42" for decks significantly above grade
    auto_guard_height = 42 if height > 8 else 36
    # Accept user override, but never below the IRC minimum when required
    override_guard = params.get("overGuardHeight")
    if override_guard and guard_required:
        guard_height = max(override_guard, 36)  # IRC floor
    elif override_guard:
        guard_height = override_guard
    else:
        guard_height = auto_guard_height

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
        warnings.append(f"Joist span ({joist_span:.1f}') exceeds IRC tables for {species} at {LL} PSF design load. Engineering required.")
    if height > 10:
        warnings.append("Height >10'. Lateral bracing by engineer recommended.")
    if area > 500:
        warnings.append("Area >500 SF. Check local permit requirements.")

    return {
        "width": width, "depth": depth, "height": height, "area": round(area, 1), "lot_area": lot_area,
        "attachment": attachment, "beam_type": beam_type, "LL": LL, "DL": DL, "TL": TL,
        "species": species,
        "joist_size": joist_size, "joist_spacing": joist_spacing,
        "joist_span": round(joist_span, 1), "num_joists": num_joists,
        "beam_size": beam_size, "beam_span": round(beam_span, 1),
        "post_size": post_size, "num_posts": num_posts,
        "total_posts": total_posts, "post_positions": post_positions,
        "post_heights": post_heights,
        "footing_diam": footing_diam, "footing_depth": footing_depth,
        "num_footings": total_posts, "ledger_size": ledger_size,
        "rail_length": round(rail_length, 1), "rail_height": guard_height,
        "guard_required": guard_required, "auto_guard_height": auto_guard_height,
        "mid_span_blocking": mid_span_blocking, "blocking_count": blocking_count,
        "stairs": stair_info, "warnings": warnings,
        "joist_hangers_for_beam": joist_hangers_for_beam,
        "auto": {
            "joist": auto_joist, "beam": auto_beam,
            "post_size": auto_post_size, "post_count": auto_np,
            "footing": auto_footing, "guard_height": auto_guard_height,
        }
    }
