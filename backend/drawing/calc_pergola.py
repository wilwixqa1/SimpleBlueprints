"""
SimpleBlueprints - Pergola Structural Calculation Engine
=========================================================
Scaffolded S60. IRC table values marked TODO -- fill from ICC database.

Pergola types:
  - Freestanding: 4+ posts, beams, rafters, optional lattice/solid cover
  - Attached: ledger to house, 2+ posts, beam, rafters

Key IRC sections needed:
  - R802.4 -- Rafter spans (governs rafter sizing)
  - R602.7 -- Header/girder spans (governs beam sizing)
  - R507.4 -- Post height limits (same as decks)
  - R507.3 -- Footing sizing (same as decks, but with roof load added)
  - R301.2.1 -- Wind design (critical for open structures)

Design loads for pergolas:
  - Roof LL: 20 PSF (typical) or ground snow load, whichever governs
  - Roof DL: 5 PSF (open lattice) to 15 PSF (solid roof with roofing)
  - No floor live load (pergola has no floor -- that's a porch)
  - Wind: ASCE 7 component and cladding, open structure coefficients
"""

import math


# ============================================================
# IRC RAFTER SPAN TABLES -- TODO: fill from R802.4
# ============================================================
# Structure: {design_load: {species: {size: {spacing: max_span_ft}}}}
# Design load = roof LL (typically 20 PSF) or ground snow load
# Same footnote as decks: snow not concurrent with live load
#
# Tables needed:
#   R802.4(1) -- LL=20, DL=10 (open lattice with light cover)
#   R802.4(2) -- LL=20, DL=20 (solid roof with roofing material)
#   Snow load variants follow same tier pattern as deck joists

IRC_RAFTER_SPANS = {
    # TODO: Fill from IRC 2021 Table R802.4(1) -- LL=20, DL=10
    # Format matches deck joist tables for consistency:
    # "species": { load_tier: { "size": { spacing: span_ft } } }
    "dfl_hf_spf": {
        20: {
            # "2x6": {12: TODO, 16: TODO, 24: TODO},
            # "2x8": {12: TODO, 16: TODO, 24: TODO},
            # "2x10": {12: TODO, 16: TODO, 24: TODO},
            # "2x12": {12: TODO, 16: TODO, 24: TODO},
        },
        30: {},  # TODO: 30 PSF snow
        50: {},  # TODO: 50 PSF snow
        70: {},  # TODO: 70 PSF snow
    },
    "southern_pine": {
        20: {},  # TODO
        30: {},
        50: {},
        70: {},
    },
    "redwood_cedar": {
        20: {},  # TODO
        30: {},
        50: {},
        70: {},
    },
}


# ============================================================
# IRC BEAM/GIRDER SPAN TABLES -- TODO: fill from R602.7
# ============================================================
# Pergola beams are horizontal members supporting rafters.
# IRC R602.7 tables govern header/girder spans.
# These are DIFFERENT from deck beam tables (R507.5) because
# they carry roof loads, not floor loads.
#
# Structure: {species: {beam_size: [span_at_trib_4, _6, _8, _10, _12]}}
# Tributary widths in feet (rafter span from one side)

IRC_PERGOLA_BEAM_SPANS = {
    # TODO: Fill from IRC 2021 Table R602.7(1) or R602.7(2)
    # These tables are indexed by:
    #   - Building width (tributary width to beam)
    #   - Number of stories supported
    #   - Beam size (2-2x6 through 2-2x12, 3-2x8 through 3-2x12)
    #   - Species group
    #
    # For pergolas, we use "supporting roof only" (1 story, roof only)
    "dfl_hf_spf": {
        # "2-ply 2x6":  [TODO],  # spans at trib widths [4, 6, 8, 10, 12]
        # "2-ply 2x8":  [TODO],
        # "2-ply 2x10": [TODO],
        # "2-ply 2x12": [TODO],
        # "3-ply 2x8":  [TODO],
        # "3-ply 2x10": [TODO],
        # "3-ply 2x12": [TODO],
    },
    "southern_pine": {},  # TODO
    "redwood_cedar": {},  # TODO
}

PERGOLA_BEAM_TRIB_COLS = [4, 6, 8, 10, 12]  # tributary width columns in feet


# ============================================================
# CONSTANTS
# ============================================================

# Roof dead loads (PSF)
ROOF_DL = {
    "open_lattice": 5,      # spaced lattice strips, no roofing
    "lattice_cover": 8,     # close-spaced lattice with partial shade cloth
    "polycarbonate": 8,     # polycarbonate panels
    "solid_wood": 12,       # T&G boards or plywood sheathing
    "shingle": 15,          # solid sheathing + asphalt shingles
    "metal": 10,            # solid sheathing + standing seam metal
}

# Roof live loads -- same logic as deck: max(20, snow)
ROOF_LL_BASE = 20  # PSF minimum per IRC R301.6

# Reuse deck constants for shared components
FROST_DEPTHS = {"warm": 12, "moderate": 24, "cold": 36, "severe": 48}
SNOW_LOADS = {"none": 0, "light": 20, "moderate": 40, "heavy": 60}


# ============================================================
# LOOKUP FUNCTIONS
# ============================================================

def get_rafter_spans_for_load(design_load, species="dfl_hf_spf"):
    """Look up IRC rafter spans by design load and species.

    design_load: max(20, snow_load) for roof
    species: "southern_pine", "dfl_hf_spf", or "redwood_cedar"
    Returns dict of {size: {spacing: span}} or empty dict if TODO.
    """
    species_data = IRC_RAFTER_SPANS.get(species, IRC_RAFTER_SPANS.get("dfl_hf_spf", {}))
    tiers = sorted(species_data.keys())
    if not tiers:
        return {}
    for tier in tiers:
        if design_load <= tier:
            return species_data[tier]
    return species_data[tiers[-1]]


def get_pergola_beam_max_span(beam_size, trib_width, species="dfl_hf_spf"):
    """Look up max pergola beam span from IRC R602.7.

    beam_size: e.g. "2-ply 2x10"
    trib_width: rafter span / 2 (one-sided tributary) in feet
    species: wood species group
    Returns max beam span in feet, or 0 if table not yet populated.
    """
    species_data = IRC_PERGOLA_BEAM_SPANS.get(species, {})
    spans = species_data.get(beam_size)
    if not spans:
        return 0

    # Interpolate between tributary width columns
    cols = PERGOLA_BEAM_TRIB_COLS
    if trib_width <= cols[0]:
        return spans[0]
    if trib_width >= cols[-1]:
        return spans[-1]
    for idx in range(len(cols) - 1):
        if cols[idx] <= trib_width <= cols[idx + 1]:
            frac = (trib_width - cols[idx]) / (cols[idx + 1] - cols[idx])
            return round(spans[idx] + frac * (spans[idx + 1] - spans[idx]), 2)
    return spans[-1]


def auto_select_pergola_beam(beam_span, trib_width, species="dfl_hf_spf"):
    """Select smallest beam that can span the required distance.

    Returns beam size string or "ENGINEERING_REQUIRED" if nothing works.
    """
    beam_order = [
        "2-ply 2x6", "2-ply 2x8", "2-ply 2x10", "2-ply 2x12",
        "3-ply 2x8", "3-ply 2x10", "3-ply 2x12",
    ]
    for bsize in beam_order:
        max_span = get_pergola_beam_max_span(bsize, trib_width, species)
        if max_span >= beam_span:
            return bsize
    return "ENGINEERING_REQUIRED"


# ============================================================
# MAIN CALCULATION
# ============================================================

def calculate_pergola_structure(params):
    """Calculate structural members for a pergola.

    Required params:
        width: float -- pergola width (beam direction) in feet
        depth: float -- pergola depth (rafter direction) in feet
        height: float -- post height in feet
        attachment: str -- "freestanding" or "attached"
        rafterSpacing: int -- rafter spacing in inches (12, 16, 24)
        roofType: str -- key into ROOF_DL
        snowLoad: str -- "none", "light", "moderate", "heavy"
        frostZone: str -- "warm", "moderate", "cold", "severe"

    Returns dict with all structural members and calculations.
    """
    width = params.get("width", 12)
    depth = params.get("depth", 10)
    height = params.get("height", 8)
    attachment = params.get("attachment", "freestanding")
    rafter_spacing = params.get("rafterSpacing", 16)
    roof_type = params.get("roofType", "open_lattice")
    snow = SNOW_LOADS.get(params.get("snowLoad", "none"), 0)
    frost = FROST_DEPTHS.get(params.get("frostZone", "moderate"), 24)
    species = params.get("species", "dfl_hf_spf")

    # Loads
    roof_dl = ROOF_DL.get(roof_type, 5)
    roof_ll = max(ROOF_LL_BASE, snow)
    total_load = roof_dl + roof_ll

    # Rafter span
    if attachment == "attached":
        rafter_span = depth  # rafters run from ledger to beam
    else:
        rafter_span = depth / 2  # rafters run from beam to beam (center ridge optional)

    # Auto rafter sizing
    rafter_spans = get_rafter_spans_for_load(roof_ll, species)
    auto_rafter = "2x8"  # default fallback
    if rafter_spans:
        auto_rafter = "2x12"
        for size in ["2x6", "2x8", "2x10", "2x12"]:
            spans = rafter_spans.get(size, {})
            if spans.get(rafter_spacing, 0) >= rafter_span:
                auto_rafter = size
                break
    rafter_size = params.get("overRafter") or auto_rafter

    # Number of rafters
    num_rafters = math.ceil(width / (rafter_spacing / 12)) + 1

    # Posts -- pergolas typically have 4 (freestanding) or 2 (attached)
    if attachment == "attached":
        if width <= 12:
            auto_np = 2
        elif width <= 20:
            auto_np = 3
        else:
            auto_np = max(3, math.ceil(width / 10) + 1)
    else:
        if width <= 12:
            auto_np_per_side = 2
        elif width <= 20:
            auto_np_per_side = 3
        else:
            auto_np_per_side = max(3, math.ceil(width / 10) + 1)
        auto_np = auto_np_per_side  # per beam line

    num_posts = params.get("overPostCount") or auto_np
    beam_span = width / max(num_posts - 1, 1)

    # Auto beam sizing
    trib_width = depth / 2 if attachment == "attached" else depth / 2
    auto_beam = auto_select_pergola_beam(beam_span, trib_width, species)
    beam_size = params.get("overBeam") or auto_beam

    # Post size -- same rules as decks (6x6 default per Billy)
    auto_post_size = "6x6"
    post_size = params.get("overPostSize") or auto_post_size

    # Total posts
    if attachment == "attached":
        total_posts = num_posts
    else:
        total_posts = num_posts * 2  # two beam lines

    # Post positions along beam
    post_positions = []
    for i in range(num_posts):
        if num_posts == 1:
            post_positions.append(width / 2)
        else:
            post_positions.append(round(1.0 + i * (width - 2.0) / (num_posts - 1), 2))

    # Footings -- roof load tributary to each footing
    # For pergolas, footing load = (roof DL + roof LL) * tributary area
    trib_area = (width / max(num_posts - 1, 1)) * (depth if attachment == "attached" else depth / 2)
    footing_load = trib_area * total_load
    soil_bearing = 1500  # PSF, same assumption as decks
    required_area = footing_load / soil_bearing
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

    # Ledger (attached only)
    ledger_size = rafter_size if attachment == "attached" else None

    # Warnings
    warnings = []
    if not rafter_spans:
        warnings.append("IRC rafter span tables not yet loaded. Rafter sizing is estimated.")
    if auto_beam == "ENGINEERING_REQUIRED":
        warnings.append("Beam span exceeds IRC prescriptive tables. Engineering required.")
    if height > 14:
        warnings.append("Post height >14'. Engineering review recommended.")

    return {
        "product_type": "pergola",
        "width": width,
        "depth": depth,
        "height": height,
        "attachment": attachment,
        "roof_type": roof_type,
        "roof_DL": roof_dl,
        "roof_LL": roof_ll,
        "TL": total_load,
        "species": species,
        "rafter_size": rafter_size,
        "rafter_spacing": rafter_spacing,
        "rafter_span": round(rafter_span, 1),
        "num_rafters": num_rafters,
        "beam_size": beam_size,
        "beam_span": round(beam_span, 1),
        "post_size": post_size,
        "num_posts": num_posts,
        "total_posts": total_posts,
        "post_positions": post_positions,
        "footing_diam": footing_diam,
        "footing_depth": footing_depth,
        "num_footings": total_posts,
        "ledger_size": ledger_size,
        "warnings": warnings,
        "auto": {
            "rafter": auto_rafter,
            "beam": auto_beam,
            "post_size": auto_post_size,
            "post_count": auto_np,
            "footing": auto_footing,
        },
    }
