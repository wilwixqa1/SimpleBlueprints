"""
SimpleBlueprints - Fence Structural Calculation Engine
=======================================================
Scaffolded S60.

Fences are NOT governed by a specific IRC section. Requirements come from:
  - Local zoning codes (height limits, setbacks, materials)
  - ASCE 7 wind load provisions (structural design)
  - IRC R404.4 (retaining walls >4' need engineering)
  - Local amendments and HOA restrictions

This engine handles:
  - Post sizing and spacing based on fence height and wind exposure
  - Post embedment depth (rule of thumb + engineering calc)
  - Footing sizing
  - Rail and picket/board material quantities
  - Gate framing

Design approach:
  - Wind is the primary structural concern for fences
  - Post embedment resists overturning moment from wind
  - Taller fences and higher wind exposures need deeper embedment
  - Standard residential: 4x4 posts for fences <=6', 6x6 for >6'
"""

import math


# ============================================================
# WIND LOAD PARAMETERS
# ============================================================
# Simplified wind pressure for fences based on ASCE 7
# Full ASCE 7 calculation uses: qz = 0.00256 * Kz * Kzt * Kd * V^2
# For residential fences, simplified to exposure-based PSF values

# TODO: These are engineering estimates, not IRC table values.
# Verify against ASCE 7 for your jurisdiction.
WIND_PRESSURE_PSF = {
    # (exposure_category, fence_type) -> design wind pressure PSF
    # Fence types: "solid" (privacy), "open" (picket/rail with gaps)
    # Open fences have ~50% wind area reduction
    ("B", "solid"): 15,   # suburban, sheltered
    ("B", "open"):  8,
    ("C", "solid"): 20,   # open terrain, scattered obstructions
    ("C", "open"):  11,
    ("D", "solid"): 25,   # flat, unobstructed (coastal)
    ("D", "open"):  14,
}

# Post embedment rule of thumb: 1/3 of total post length below grade
# Engineering: embedment depth resists overturning moment from wind
# Minimum embedment: 24" for fences <=4', 30" for <=6', 36" for >6'
MIN_EMBEDMENT = {4: 24, 6: 30, 8: 36, 10: 42}  # fence_height_ft: min_depth_inches

# Standard post spacing
MAX_POST_SPACING = {
    "solid": 6,   # 6' max for solid/privacy fences (wind load)
    "open": 8,    # 8' max for open/picket fences
}


# ============================================================
# MAIN CALCULATION
# ============================================================

def calculate_fence_structure(params):
    """Calculate structural members and materials for a fence.

    Required params:
        totalLength: float -- total fence length in feet
        height: float -- fence height in feet (typically 4 or 6)
        fenceType: str -- "solid" (privacy) or "open" (picket/rail)
        windExposure: str -- "B", "C", or "D"
        numGates: int -- number of gates
        gateWidth: float -- gate width in feet (3-5 typical)
        postMaterial: str -- "wood" or "metal"
        soilType: str -- "firm", "average", "soft"

    Returns dict with all structural members and materials.
    """
    total_length = params.get("totalLength", 100)
    height = params.get("height", 6)
    fence_type = params.get("fenceType", "solid")
    wind_exposure = params.get("windExposure", "B")
    num_gates = params.get("numGates", 1)
    gate_width = params.get("gateWidth", 3.5)
    post_material = params.get("postMaterial", "wood")
    soil_type = params.get("soilType", "average")

    # Post sizing
    if height <= 4:
        post_size = "4x4"
    elif height <= 6:
        post_size = "4x4"  # 4x4 OK for standard 6' fence in Exposure B
    else:
        post_size = "6x6"  # >6' needs 6x6

    # Upgrade post for high wind
    if wind_exposure in ("C", "D") and height >= 6:
        post_size = "6x6"

    # Post spacing
    max_spacing = MAX_POST_SPACING.get(fence_type, 8)
    # Reduce spacing for tall fences in high wind
    if height > 6 and wind_exposure in ("C", "D"):
        max_spacing = min(max_spacing, 4)
    elif height > 6:
        max_spacing = min(max_spacing, 6)

    # Calculate fence line (minus gate openings)
    fence_line = total_length - (num_gates * gate_width)
    num_posts = math.ceil(fence_line / max_spacing) + 1 + (num_gates * 2)

    # Post embedment depth
    # Engineering: M_wind = (wind_psf * height * spacing * height/2)
    # M_resist = (soil_bearing * embed_depth^2 * post_width / 3)
    # Simplified: use min embedment table + soil factor
    soil_factor = {"firm": 1.0, "average": 1.2, "soft": 1.5}.get(soil_type, 1.2)
    base_embedment = 24
    for h_limit, depth in sorted(MIN_EMBEDMENT.items()):
        if height <= h_limit:
            base_embedment = depth
            break
    else:
        base_embedment = 42

    embedment_depth = round(base_embedment * soil_factor)
    total_post_length = height + (embedment_depth / 12)

    # Footing
    # Concrete collar around post: typically 8-12" diameter
    footing_diam = 10 if post_size == "4x4" else 12
    concrete_per_post_cf = math.pi * (footing_diam / 24) ** 2 * (embedment_depth / 12)
    bags_per_post = math.ceil(concrete_per_post_cf / 0.6)  # 80lb bag = 0.6 cf

    # Rails
    if height <= 4:
        num_rails = 2  # top + bottom
    elif height <= 6:
        num_rails = 3  # top + middle + bottom
    else:
        num_rails = 3

    rail_size = "2x4"  # standard
    total_rail_length = fence_line * num_rails

    # Pickets/boards
    if fence_type == "solid":
        picket_width = 5.5 / 12  # 1x6 nominal (5.5" actual)
        num_pickets = math.ceil(fence_line / picket_width)
        picket_size = f"1x6x{math.ceil(height)}'"
    else:
        picket_width = 3.5 / 12  # 1x4 nominal
        gap = 3.5 / 12  # equal gap for open fence
        num_pickets = math.ceil(fence_line / (picket_width + gap))
        picket_size = f"1x4x{math.ceil(height)}'"

    # Gate framing
    gate_items = []
    if num_gates > 0:
        gate_items.append({"item": f"Gate frame {gate_width}'x{height}' (pre-built or site-built)", "qty": num_gates, "cost": 150})
        gate_items.append({"item": "Gate hinges (pair)", "qty": num_gates, "cost": 25})
        gate_items.append({"item": "Gate latch", "qty": num_gates, "cost": 20})

    # Wind load check
    wind_psf = WIND_PRESSURE_PSF.get((wind_exposure, fence_type), 15)
    wind_force_per_post = wind_psf * height * max_spacing  # lbs per post
    overturning_moment = wind_force_per_post * (height / 2) * 12  # inch-lbs

    warnings = []
    if overturning_moment > 5000 and post_size == "4x4":
        warnings.append("Wind overturning moment is high for 4x4 posts. Consider 6x6.")
    if height > 8:
        warnings.append("Fence >8' may require engineering review in most jurisdictions.")
    if height > 6 and fence_type == "solid" and wind_exposure == "D":
        warnings.append("Tall solid fence in Exposure D (coastal). Engineering strongly recommended.")

    # Materials list
    materials = [
        {"cat": "Posts", "item": f"{post_size} PT Posts {total_post_length:.0f}'", "qty": num_posts, "cost": 24 if post_size == "4x4" else 48},
        {"cat": "Foundation", "item": "Concrete 80lb bags", "qty": num_posts * bags_per_post, "cost": 6.50},
        {"cat": "Rails", "item": f"{rail_size} PT Rails 8'", "qty": math.ceil(total_rail_length / 8), "cost": 12},
        {"cat": "Boards", "item": f"PT {picket_size}", "qty": num_pickets, "cost": 4 if fence_type == "open" else 5},
        {"cat": "Hardware", "item": "Rail brackets", "qty": num_posts * num_rails * 2, "cost": 2},
        {"cat": "Hardware", "item": "Screws (1 lb boxes)", "qty": math.ceil(num_pickets / 50), "cost": 12},
    ]
    materials.extend(gate_items)

    sub = sum(i["qty"] * i["cost"] for i in materials)

    return {
        "product_type": "fence",
        "total_length": total_length,
        "fence_line": round(fence_line, 1),
        "height": height,
        "fence_type": fence_type,
        "wind_exposure": wind_exposure,
        "post_size": post_size,
        "post_spacing": max_spacing,
        "num_posts": num_posts,
        "embedment_depth": embedment_depth,
        "total_post_length": round(total_post_length, 1),
        "footing_diam": footing_diam,
        "rail_size": rail_size,
        "num_rails": num_rails,
        "num_pickets": num_pickets,
        "picket_size": picket_size,
        "num_gates": num_gates,
        "gate_width": gate_width,
        "wind_psf": wind_psf,
        "wind_force_per_post": round(wind_force_per_post),
        "materials": materials,
        "subtotal": round(sub),
        "total": round(sub * 1.13),  # +tax+contingency
        "warnings": warnings,
    }
