"""
SimpleBlueprints - Shed Structural Calculation Engine
======================================================
Scaffolded S60. IRC table values marked TODO -- fill from ICC database.

Sheds under 200 SF are often permit-exempt (varies by jurisdiction).
Larger sheds or habitable structures (workshops, offices, ADUs) must
comply with full IRC requirements.

Key IRC sections:
  - R301 -- Design criteria (loads, wind, snow, seismic)
  - R403 -- Footings (continuous or pier)
  - R502 -- Floor framing (if elevated)
  - R602 -- Wall framing
  - R802 -- Roof framing
  - R301.2 -- Snow/wind/seismic by jurisdiction

Shed types:
  - Slab-on-grade: concrete pad, no floor framing
  - Pier/block: concrete piers or blocks, floor joists
  - Skid: pressure-treated skids (runners) on compacted gravel

Wall types:
  - Stud frame: 2x4 or 2x6 at 16" or 24" o.c.
  - Post-and-beam: fewer, larger posts with horizontal girts

Roof types:
  - Gable: two sloped planes meeting at ridge
  - Shed (mono-slope): single sloped plane
  - Gambrel: barn-style with two slopes per side
"""

import math

from .calc_engine import FROST_DEPTHS, SNOW_LOADS


# ============================================================
# IRC FLOOR JOIST SPANS -- TODO: fill from R502.3.1
# ============================================================
# These are DIFFERENT from deck joist spans (R507.6).
# R502 tables are for enclosed floor framing (higher deflection limits).
# R507 tables are specifically for exterior decks.
#
# For sheds, use R502.3.1(2) -- 40 PSF LL, L/360 deflection.
# Structure matches deck joist tables.

IRC_FLOOR_JOIST_SPANS = {
    # TODO: Fill from IRC 2021 Table R502.3.1(2)
    "dfl_hf_spf": {
        40: {
            # "2x6": {12: TODO, 16: TODO, 24: TODO},
            # "2x8": {12: TODO, 16: TODO, 24: TODO},
            # "2x10": {12: TODO, 16: TODO, 24: TODO},
            # "2x12": {12: TODO, 16: TODO, 24: TODO},
        },
    },
    "southern_pine": {40: {}},
    "redwood_cedar": {40: {}},
}


# ============================================================
# IRC RAFTER SPANS -- TODO: fill from R802.4
# ============================================================
# Same tables as pergola engine. Import from calc_pergola when populated.

IRC_SHED_RAFTER_SPANS = {
    # TODO: Same structure as calc_pergola.IRC_RAFTER_SPANS
    "dfl_hf_spf": {20: {}, 30: {}, 50: {}, 70: {}},
    "southern_pine": {20: {}, 30: {}, 50: {}, 70: {}},
    "redwood_cedar": {20: {}, 30: {}, 50: {}, 70: {}},
}


# ============================================================
# IRC WALL STUD TABLES -- TODO: fill from R602.3
# ============================================================
# R602.3(5) -- Size, Height, and Spacing of Wood Studs

IRC_STUD_HEIGHT_LIMITS = {
    # TODO: Fill from IRC 2021 Table R602.3(5)
    # Format: {stud_size: {spacing: {bearing: max_height, nonbearing: max_height}}}
    # For sheds, typically "supporting roof only" or "nonbearing"
    "2x4": {
        16: {"bearing_roof_only": 10, "nonbearing": 14},  # approximate, verify
        24: {"bearing_roof_only": 10, "nonbearing": 14},
    },
    "2x6": {
        16: {"bearing_roof_only": 10, "nonbearing": 20},
        24: {"bearing_roof_only": 10, "nonbearing": 20},
    },
}


# ============================================================
# CONSTANTS
# ============================================================

FOUNDATION_TYPES = {
    "slab": {"label": "Concrete Slab", "min_thickness": 4},  # inches
    "pier": {"label": "Concrete Pier", "needs_floor_frame": True},
    "skid": {"label": "PT Skid/Runner", "needs_floor_frame": True},
}

ROOF_SHAPES = {
    "gable": {"slopes": 2, "ridge": True},
    "shed": {"slopes": 1, "ridge": False},
    "gambrel": {"slopes": 4, "ridge": True},
}

WALL_DL = 8   # PSF - stud wall + siding + interior finish
ROOF_DL = 12  # PSF - sheathing + roofing material
FLOOR_DL = 10 # PSF - joists + subfloor


# ============================================================
# MAIN CALCULATION
# ============================================================

def calculate_shed_structure(params):
    """Calculate structural members for a shed.

    Required params:
        width: float -- shed width in feet (perpendicular to ridge)
        depth: float -- shed depth in feet (parallel to ridge for gable)
        wallHeight: float -- wall height in feet (typically 8)
        roofShape: str -- "gable", "shed", "gambrel"
        roofPitch: float -- roof pitch as rise/12 (e.g. 4 means 4:12)
        foundationType: str -- "slab", "pier", "skid"
        snowLoad: str -- "none", "light", "moderate", "heavy"
        frostZone: str -- "warm", "moderate", "cold", "severe"
        studSpacing: int -- 16 or 24
        doorCount: int -- number of doors
        windowCount: int -- number of windows

    Returns dict with all structural members and materials.
    """
    width = params.get("width", 12)
    depth = params.get("depth", 10)
    wall_height = params.get("wallHeight", 8)
    roof_shape = params.get("roofShape", "gable")
    roof_pitch = params.get("roofPitch", 4)  # 4:12 default
    foundation = params.get("foundationType", "pier")
    snow = SNOW_LOADS.get(params.get("snowLoad", "none"), 0)
    frost = FROST_DEPTHS.get(params.get("frostZone", "moderate"), 24)
    stud_spacing = params.get("studSpacing", 16)
    species = params.get("species", "dfl_hf_spf")
    door_count = params.get("doorCount", 1)
    window_count = params.get("windowCount", 2)

    area = width * depth
    perimeter = 2 * (width + depth)

    # ---- LOADS ----
    roof_ll = max(20, snow)
    floor_ll = 40  # storage use
    roof_tl = ROOF_DL + roof_ll
    floor_tl = FLOOR_DL + floor_ll

    # ---- ROOF GEOMETRY ----
    roof_info = ROOF_SHAPES.get(roof_shape, ROOF_SHAPES["gable"])
    if roof_shape == "gable":
        rafter_run = width / 2
        ridge_height = rafter_run * (roof_pitch / 12)
        rafter_length = math.sqrt(rafter_run ** 2 + ridge_height ** 2)
        roof_area = rafter_length * depth * 2  # both slopes
    elif roof_shape == "shed":
        rafter_run = width
        ridge_height = rafter_run * (roof_pitch / 12)
        rafter_length = math.sqrt(rafter_run ** 2 + ridge_height ** 2)
        roof_area = rafter_length * depth
    else:  # gambrel
        rafter_run = width / 2
        ridge_height = rafter_run * (roof_pitch / 12) * 1.5  # approx
        rafter_length = math.sqrt(rafter_run ** 2 + ridge_height ** 2)
        roof_area = rafter_length * depth * 2

    # ---- RAFTERS ----
    rafter_span = rafter_run  # horizontal span
    num_rafters = math.ceil(depth / (stud_spacing / 12)) + 1
    if roof_shape != "shed":
        num_rafters *= 2  # both sides of ridge

    # Auto rafter sizing (TODO: use IRC_SHED_RAFTER_SPANS when populated)
    auto_rafter = "2x6"
    if rafter_span > 8:
        auto_rafter = "2x8"
    if rafter_span > 12:
        auto_rafter = "2x10"
    if rafter_span > 16:
        auto_rafter = "2x12"
    rafter_size = params.get("overRafter") or auto_rafter

    # ---- RIDGE BEAM (gable/gambrel only) ----
    ridge_size = None
    if roof_info["ridge"]:
        # Ridge beam carries no load in a conventional rafter system
        # (rafters push against each other). But if no ceiling joists / collar ties,
        # a structural ridge beam is needed.
        has_ceiling_joists = params.get("hasCeilingJoists", True)
        if has_ceiling_joists:
            ridge_size = "1x8"  # non-structural ridge board
        else:
            # TODO: Structural ridge beam sizing from IRC R802.3
            ridge_size = "ENGINEERING_REQUIRED"

    # ---- WALLS ----
    stud_size = "2x4"
    if wall_height > 10:
        stud_size = "2x6"

    # Corner posts: doubled studs
    num_corners = 4
    # Wall studs (excluding corners, doors, windows)
    wall_stud_length = perimeter - (door_count * 3) - (window_count * 3)
    num_studs = math.ceil(wall_stud_length / (stud_spacing / 12)) + num_corners * 2

    # Headers for doors and windows
    # Standard: 4x12 or doubled 2x12 for spans >4'
    door_header_size = "2-2x10" if params.get("doorWidth", 3) <= 4 else "2-2x12"
    window_header_size = "2-2x8"

    # Top/bottom plates
    plate_length = perimeter * 2  # double top plate + single bottom plate = 3x perimeter
    # Actually: single bottom plate + double top plate = 3 runs of perimeter
    plate_runs = 3

    # ---- FLOOR FRAMING (pier/skid only) ----
    floor_joist_size = None
    floor_joist_span = None
    num_floor_joists = 0
    num_skids = 0

    if foundation in ("pier", "skid"):
        floor_joist_span = width if depth > width else depth
        # Joists span the short direction
        if floor_joist_span > width:
            floor_joist_span = width

        # Auto floor joist (TODO: use IRC_FLOOR_JOIST_SPANS when populated)
        if floor_joist_span <= 8:
            floor_joist_size = "2x6"
        elif floor_joist_span <= 12:
            floor_joist_size = "2x8"
        elif floor_joist_span <= 16:
            floor_joist_size = "2x10"
        else:
            floor_joist_size = "2x12"

        other_dim = depth if floor_joist_span == width else width
        num_floor_joists = math.ceil(other_dim / (stud_spacing / 12)) + 1

        if foundation == "skid":
            # PT 4x6 or 6x6 runners under the shed
            num_skids = max(2, math.ceil(width / 4))

    # ---- FOUNDATION ----
    num_piers = 0
    pier_size = 0
    slab_thickness = 0

    if foundation == "slab":
        slab_thickness = 4  # inches minimum
    elif foundation == "pier":
        # Piers at corners + intermediate at ~6' spacing
        piers_per_side_w = max(2, math.ceil(width / 6) + 1)
        piers_per_side_d = max(2, math.ceil(depth / 6) + 1)
        num_piers = piers_per_side_w * 2 + (piers_per_side_d - 2) * 2
        # Simplified: just corner + midpoints
        num_piers = max(4, 2 * (math.ceil(width / 6) + 1) + 2 * max(0, math.ceil(depth / 6) - 1))
        pier_size = 12  # inches diameter

    footing_depth = max(frost, 12)

    # ---- MATERIALS LIST ----
    materials = []

    # Foundation
    if foundation == "slab":
        # Concrete volume: width * depth * thickness/12 / 27 = cubic yards
        cy = round(width * depth * (slab_thickness / 12) / 27, 1)
        materials.append({"cat": "Foundation", "item": f"Concrete slab ({slab_thickness}\" thick)", "qty_note": f"{cy} cu yd", "qty": 1, "cost": cy * 150})
        materials.append({"cat": "Foundation", "item": "Vapor barrier 10mil", "qty": 1, "cost": 50})
        materials.append({"cat": "Foundation", "item": "Wire mesh / rebar", "qty": 1, "cost": area * 0.50})
    elif foundation == "pier":
        bags = math.ceil((math.pi * (pier_size / 24) ** 2 * (footing_depth / 12)) / 0.6) * num_piers
        materials.append({"cat": "Foundation", "item": f"Concrete 80lb bags", "qty": bags, "cost": 6.50})
        materials.append({"cat": "Foundation", "item": f'Sonotube {pier_size}"', "qty": num_piers, "cost": 18})
        materials.append({"cat": "Foundation", "item": "Pier brackets", "qty": num_piers, "cost": 12})
    elif foundation == "skid":
        materials.append({"cat": "Foundation", "item": f"4x6 PT Skids {depth}'", "qty": num_skids, "cost": depth * 4})
        materials.append({"cat": "Foundation", "item": "Compacted gravel base (tons)", "qty": math.ceil(area / 80), "cost": 45})

    # Floor framing
    if floor_joist_size:
        materials.append({"cat": "Floor", "item": f"{floor_joist_size} PT Floor Joists", "qty": num_floor_joists, "cost": 18 if floor_joist_span <= 10 else 28})
        materials.append({"cat": "Floor", "item": "Rim joists", "qty": math.ceil(perimeter / 12), "cost": 22})
        sheets = math.ceil(area / 32)  # 4x8 sheets = 32 sf
        materials.append({"cat": "Floor", "item": "3/4\" T&G Plywood subfloor (4x8)", "qty": sheets, "cost": 45})

    # Walls
    materials.append({"cat": "Walls", "item": f"{stud_size} PT Studs {wall_height}'", "qty": num_studs, "cost": 8 if stud_size == "2x4" else 14})
    materials.append({"cat": "Walls", "item": f"{stud_size} Plates (top x2 + bottom)", "qty": math.ceil(perimeter * plate_runs / 12), "cost": 8 if stud_size == "2x4" else 14})
    materials.append({"cat": "Walls", "item": f"Door header ({door_header_size})", "qty": door_count, "cost": 35})
    materials.append({"cat": "Walls", "item": f"Window header ({window_header_size})", "qty": window_count, "cost": 25})
    wall_sheets = math.ceil(perimeter * wall_height / 32)
    materials.append({"cat": "Walls", "item": "7/16\" OSB Sheathing (4x8)", "qty": wall_sheets, "cost": 28})
    materials.append({"cat": "Walls", "item": "House wrap (roll)", "qty": max(1, math.ceil(perimeter * wall_height / 150)), "cost": 120})

    # Siding
    materials.append({"cat": "Exterior", "item": "Siding (LP SmartSide or T1-11)", "qty": wall_sheets, "cost": 35})
    materials.append({"cat": "Exterior", "item": "Exterior trim", "qty": 1, "cost": perimeter * 3})

    # Roof
    materials.append({"cat": "Roof", "item": f"{rafter_size} Rafters", "qty": num_rafters, "cost": 15 if rafter_span <= 8 else 25})
    if ridge_size and ridge_size != "ENGINEERING_REQUIRED":
        materials.append({"cat": "Roof", "item": f"{ridge_size} Ridge board {depth}'", "qty": math.ceil(depth / 12), "cost": 20})
    roof_sheets = math.ceil(roof_area / 32)
    materials.append({"cat": "Roof", "item": "1/2\" Roof Sheathing (4x8)", "qty": roof_sheets, "cost": 30})
    materials.append({"cat": "Roof", "item": "Roofing felt (roll)", "qty": max(1, math.ceil(roof_area / 200)), "cost": 25})
    materials.append({"cat": "Roof", "item": "Asphalt shingles (bundle)", "qty": math.ceil(roof_area / 33.3), "cost": 35})
    materials.append({"cat": "Roof", "item": "Drip edge + fascia", "qty": 1, "cost": perimeter * 2})

    # Doors and windows
    materials.append({"cat": "Openings", "item": "Pre-hung exterior door", "qty": door_count, "cost": 250})
    materials.append({"cat": "Openings", "item": "Window (vinyl, standard)", "qty": window_count, "cost": 180})

    # Hardware
    materials.append({"cat": "Hardware", "item": "Framing nails (50 lb)", "qty": 1, "cost": 65})
    materials.append({"cat": "Hardware", "item": "Simpson ties + brackets", "qty": 1, "cost": num_rafters * 3 + 50})
    materials.append({"cat": "Hardware", "item": "Screws, misc hardware", "qty": 1, "cost": 80})

    sub = sum(i["qty"] * i["cost"] for i in materials)

    # Warnings
    warnings = []
    if area > 200:
        warnings.append("Shed >200 SF -- likely requires building permit. Check local requirements.")
    if area <= 200:
        warnings.append("Shed <=200 SF -- may be permit-exempt. Check local zoning for setback requirements.")
    if wall_height > 10 and stud_size == "2x4":
        warnings.append("Wall height >10' with 2x4 studs may exceed IRC limits. Consider 2x6.")
    if ridge_size == "ENGINEERING_REQUIRED":
        warnings.append("Structural ridge beam required (no ceiling joists). Engineering needed.")
    if not IRC_SHED_RAFTER_SPANS["dfl_hf_spf"][20]:
        warnings.append("IRC rafter span tables not yet loaded. Rafter sizing is estimated.")

    return {
        "product_type": "shed",
        "width": width,
        "depth": depth,
        "area": area,
        "wall_height": wall_height,
        "roof_shape": roof_shape,
        "roof_pitch": f"{roof_pitch}:12",
        "roof_area": round(roof_area, 1),
        "ridge_height": round(ridge_height, 1),
        "foundation": foundation,
        "species": species,
        # Loads
        "roof_LL": roof_ll,
        "roof_DL": ROOF_DL,
        "roof_TL": roof_tl,
        "floor_LL": floor_ll if foundation != "slab" else 0,
        "floor_DL": FLOOR_DL if foundation != "slab" else 0,
        "floor_TL": floor_tl if foundation != "slab" else 0,
        # Roof
        "rafter_size": rafter_size,
        "rafter_span": round(rafter_span, 1),
        "rafter_length": round(rafter_length, 1),
        "num_rafters": num_rafters,
        "ridge_size": ridge_size,
        # Walls
        "stud_size": stud_size,
        "stud_spacing": stud_spacing,
        "num_studs": num_studs,
        "door_header": door_header_size,
        "window_header": window_header_size,
        # Floor
        "floor_joist_size": floor_joist_size,
        "floor_joist_span": round(floor_joist_span, 1) if floor_joist_span else None,
        "num_floor_joists": num_floor_joists,
        "num_skids": num_skids,
        # Foundation
        "num_piers": num_piers,
        "pier_size": pier_size,
        "footing_depth": footing_depth,
        "slab_thickness": slab_thickness,
        # Materials
        "materials": materials,
        "subtotal": round(sub),
        "total": round(sub * 1.13),
        "warnings": warnings,
    }
