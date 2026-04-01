"""
SimpleBlueprints - Porch Structural Calculation Engine
=======================================================
Scaffolded S60. IRC table values marked TODO -- fill from ICC database.

A porch = deck floor + roof structure. The floor uses deck tables (R507),
the roof uses rafter/ceiling joist tables (R802). The critical difference
from a standalone deck or pergola is COMBINED LOADING: posts and footings
carry both floor loads AND roof loads.

Key IRC sections:
  - R507 -- Floor (joists, beams, posts, footings) -- ALREADY IMPLEMENTED in calc_engine.py
  - R802 -- Roof framing (rafters, ceiling joists, ridge)
  - R602.7 -- Header/girder spans for roof beams
  - R301 -- Combined load calculations

Design approach:
  1. Calculate floor structure exactly like a deck (reuse calc_engine)
  2. Calculate roof structure exactly like a pergola (reuse calc_pergola)
  3. Combine post/footing loads: floor tributary + roof tributary
  4. Re-size footings for combined load
"""

import math

# Import the deck and pergola engines -- porch reuses both
from .calc_engine import (
    calculate_structure as calculate_deck_structure,
    get_joist_spans_for_load,
    auto_select_beam as auto_select_deck_beam,
    get_beam_max_span as get_deck_beam_max_span,
    FROST_DEPTHS, SNOW_LOADS,
)
from .calc_pergola import (
    calculate_pergola_structure,
    ROOF_DL, ROOF_LL_BASE,
    get_rafter_spans_for_load,
    auto_select_pergola_beam,
)


def calculate_porch_structure(params):
    """Calculate structural members for a porch (deck + roof).

    Required params:
        -- All deck params (width, depth, height, attachment, joistSpacing, etc.)
        -- Plus roof params:
        roofType: str -- key into ROOF_DL
        rafterSpacing: int -- 12, 16, 24
        roofPitch: str -- "flat", "low", "medium", "steep" (affects snow load factor)
        roofOverhang: float -- overhang beyond posts in feet (0-2 typical)

    Returns dict with floor calc, roof calc, and combined footing sizing.
    """
    width = params.get("width", 12)
    depth = params.get("depth", 10)
    height = params.get("height", 8)
    snow = SNOW_LOADS.get(params.get("snowLoad", "none"), 0)
    frost = FROST_DEPTHS.get(params.get("frostZone", "moderate"), 24)
    species = params.get("species", "dfl_hf_spf")

    roof_type = params.get("roofType", "shingle")
    rafter_spacing = params.get("rafterSpacing", 16)
    roof_pitch = params.get("roofPitch", "medium")
    roof_overhang = params.get("roofOverhang", 1.0)

    # ---- FLOOR (reuse deck engine) ----
    floor_params = dict(params)
    floor_params["hasStairs"] = params.get("hasStairs", True)
    floor_calc = calculate_deck_structure(floor_params)

    # ---- ROOF (reuse pergola engine) ----
    roof_params = {
        "width": width,
        "depth": depth + roof_overhang,  # rafters extend past posts
        "height": height,  # post height (roof sits above this)
        "attachment": params.get("attachment", "attached"),
        "rafterSpacing": rafter_spacing,
        "roofType": roof_type,
        "snowLoad": params.get("snowLoad", "none"),
        "frostZone": params.get("frostZone", "moderate"),
        "species": species,
    }
    roof_calc = calculate_pergola_structure(roof_params)

    # ---- COMBINED LOADING ----
    # Posts carry floor load + roof load
    # Floor load per post = (floor tributary area) * (floor DL + floor LL)
    # Roof load per post = (roof tributary area) * (roof DL + roof LL)
    floor_tl = floor_calc["TL"]
    roof_tl = roof_calc["TL"]

    num_posts = floor_calc["num_posts"]
    floor_trib_per_post = (width / max(num_posts - 1, 1)) * depth
    roof_trib_per_post = (width / max(num_posts - 1, 1)) * (depth + roof_overhang)

    combined_load_per_post = (floor_trib_per_post * floor_tl) + (roof_trib_per_post * roof_tl)

    # Re-size footings for combined load
    soil_bearing = 1500  # PSF
    required_area = combined_load_per_post / soil_bearing
    required_diam_in = math.sqrt(required_area / math.pi) * 2 * 12
    standard_sizes = [12, 16, 18, 21, 24, 30, 36, 42]
    combined_footing = 12
    for s in standard_sizes:
        if s >= required_diam_in:
            combined_footing = s
            break
    else:
        combined_footing = 42

    footing_depth = max(frost, 12)

    # Warnings
    warnings = list(floor_calc.get("warnings", []))
    warnings.extend(roof_calc.get("warnings", []))
    if combined_footing > floor_calc["footing_diam"]:
        warnings.append(
            f"Combined floor+roof load requires {combined_footing}\" footings "
            f"(vs {floor_calc['footing_diam']}\" for floor only)."
        )

    # Roof height above deck surface
    # Minimum ceiling height is 7' for habitable porch (IRC R305.1)
    roof_plate_height = params.get("roofPlateHeight", 8.0)  # height of roof bearing above deck
    if roof_plate_height < 7:
        warnings.append(f"Roof plate height {roof_plate_height}' is below 7' IRC minimum for habitable space.")

    # Pitch factor for snow load reduction
    # TODO: IRC R301.2 Table R301.2(3) snow load reduction by roof pitch
    # Steeper roofs shed snow better. For now, no reduction.
    pitch_labels = {"flat": "0:12", "low": "2:12", "medium": "4:12", "steep": "8:12"}

    return {
        "product_type": "porch",
        "width": width,
        "depth": depth,
        "height": height,
        "roof_plate_height": roof_plate_height,
        "roof_pitch": pitch_labels.get(roof_pitch, roof_pitch),
        "roof_overhang": roof_overhang,
        # Floor structure (from deck engine)
        "floor": {
            "joist_size": floor_calc["joist_size"],
            "joist_spacing": floor_calc["joist_spacing"],
            "joist_span": floor_calc["joist_span"],
            "beam_size": floor_calc["beam_size"],
            "beam_span": floor_calc["beam_span"],
            "DL": floor_calc["DL"],
            "LL": floor_calc["LL"],
            "TL": floor_calc["TL"],
        },
        # Roof structure (from pergola engine)
        "roof": {
            "rafter_size": roof_calc["rafter_size"],
            "rafter_spacing": roof_calc["rafter_spacing"],
            "rafter_span": roof_calc["rafter_span"],
            "beam_size": roof_calc["beam_size"],
            "beam_span": roof_calc["beam_span"],
            "roof_DL": roof_calc["roof_DL"],
            "roof_LL": roof_calc["roof_LL"],
            "TL": roof_calc["TL"],
        },
        # Combined structure
        "post_size": floor_calc["post_size"],
        "num_posts": num_posts,
        "total_posts": floor_calc["total_posts"],
        "post_positions": floor_calc["post_positions"],
        "footing_diam": combined_footing,
        "footing_depth": footing_depth,
        "num_footings": floor_calc["total_posts"],
        "combined_load_per_post": round(combined_load_per_post),
        "species": species,
        "attachment": params.get("attachment", "attached"),
        "warnings": warnings,
    }
