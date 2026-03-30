"""
permit_spec.py - Permit Plan Specification Builder
Single source of truth for all data rendered across permit plan sheets.

Every drawing file reads from this spec. No drawing file should independently
interpret calc_engine output or hardcode hardware models.

Usage:
    calc = calculate_structure(params)
    spec = build_permit_spec(params, calc)
    draw_plan_and_framing(fig, params, calc, spec)
    draw_notes_sheet(fig, params, calc, spec)
    ...
"""


# ============================================================
# HARDWARE SELECTION TABLES
# ============================================================
# Billy's approved list (S51). Maps structural member sizes to
# specific Simpson model numbers. When adding new hardware,
# update this table and every sheet picks it up automatically.

POST_BASES = {
    "4x4": {"model": "ABU44Z", "manufacturer": "Simpson"},
    "6x6": {"model": "ABU66Z", "manufacturer": "Simpson"},
}

POST_CAPS = {
    "4x4": {"model": "BCS2-2/4", "manufacturer": "Simpson"},
    "6x6": {"model": "BCS2-3/6", "manufacturer": "Simpson"},
}

JOIST_HANGERS = {
    "2x6":  {"model": "LUS26Z",  "manufacturer": "Simpson"},
    "2x8":  {"model": "LUS28Z",  "manufacturer": "Simpson"},
    "2x10": {"model": "LUS210Z", "manufacturer": "Simpson"},
    "2x12": {"model": "LUS212Z", "manufacturer": "Simpson"},
}

# Hidden flange variants (premium option, not default)
JOIST_HANGERS_HF = {
    "2x8":  {"model": "LUS28Z-HF",  "manufacturer": "Simpson"},
    "2x10": {"model": "LUS210Z-HF", "manufacturer": "Simpson"},
    "2x12": {"model": "LUS212Z-HF", "manufacturer": "Simpson"},
}

HURRICANE_TIES = {
    "default": {"model": "H2.5AZ", "manufacturer": "Simpson"},
}

LATERAL_LOAD = {
    "default": {"model": "DTT2Z", "manufacturer": "Simpson", "min_count": 2},
}

STAIR_CONNECTORS = {
    "top":    {"model": "LSC", "manufacturer": "Simpson"},
    "bottom": {"model": "LSSU", "manufacturer": "Simpson"},
}

LEDGER_FASTENERS = {
    "default": {"type": "Ledger Locks", "size": '5"', "spacing": 16},
}

GUARD_SYSTEMS = {
    "fortress": {"brand": "Fortress", "model": "FE26", "label": "FORTRESS"},
    "wood":     {"brand": "",         "model": "",     "label": "WOOD"},
}


# ============================================================
# SPEC BUILDER
# ============================================================

def build_permit_spec(params, calc):
    """
    Build a complete, validated permit plan specification from params and calc.

    Returns a dict with every piece of information needed by any drawing sheet.
    All label strings are pre-formatted. All hardware models are resolved.
    """
    spec = {}

    # --- Basic dimensions ---
    width = calc["width"]
    depth = calc["depth"]
    height = calc["height"]
    area = calc["area"]
    attachment = calc["attachment"]
    beam_type = calc.get("beam_type", "dropped")

    spec["width"] = width
    spec["depth"] = depth
    spec["height"] = height
    spec["area"] = area
    spec["attachment"] = attachment
    spec["beam_type"] = beam_type

    # --- Loads ---
    LL = calc["LL"]
    DL = calc["DL"]
    TL = calc["TL"]
    # Ledger capacity: IRC Table R507.2.2 max supported load
    # 66 PSF is standard for ledger with proper fastening
    ledger_capacity = 66 if attachment == "ledger" else 0

    spec["loads"] = {
        "LL": LL,
        "DL": DL,
        "TL": TL,
        "ledger_capacity": ledger_capacity,
        "snow_load": params.get("snowLoad", "none"),
        "ground_snow": LL - 40,  # base LL is always 40; remainder is snow
    }

    # --- Joists ---
    joist_size = calc["joist_size"]
    joist_spacing = calc["joist_spacing"]
    num_joists = calc["num_joists"]
    joist_span = calc["joist_span"]
    mid_span_blocking = calc["mid_span_blocking"]
    blocking_count = calc["blocking_count"]
    ledger_size = calc["ledger_size"]

    spec["joists"] = {
        "size": joist_size,
        "spacing": joist_spacing,
        "count": num_joists,
        "span": joist_span,
        "mid_span_blocking": mid_span_blocking,
        "blocking_count": blocking_count,
    }

    # --- Beam ---
    beam_size = calc["beam_size"]
    beam_span = calc["beam_span"]
    # Parse ply count and lumber size from beam_size string (e.g. "3-ply 2x10")
    is_lvl = "LVL" in beam_size.upper()
    beam_material = "PT" if not is_lvl else "LVL"

    spec["beam"] = {
        "size": beam_size,
        "size_upper": beam_size.upper(),
        "span": beam_span,
        "type": beam_type,
        "material": beam_material,
        "is_lvl": is_lvl,
    }

    # --- Posts ---
    post_size = calc["post_size"]
    num_posts = calc["num_posts"]
    total_posts = calc["total_posts"]
    post_positions = calc["post_positions"]
    post_heights = calc.get("post_heights", [height] * num_posts)

    spec["posts"] = {
        "size": post_size,
        "count": num_posts,
        "total": total_posts,
        "positions": post_positions,
        "heights": post_heights,
        "material": "PT",
    }

    # --- Footings ---
    footing_diam = calc["footing_diam"]
    footing_depth = calc["footing_depth"]
    num_footings = calc["num_footings"]

    spec["footings"] = {
        "diameter": footing_diam,
        "depth": footing_depth,
        "count": num_footings,
        "concrete_psi": 3000,
    }

    # --- Ledger ---
    spec["ledger"] = {
        "size": ledger_size,
        "fastener": LEDGER_FASTENERS["default"]["type"],
        "fastener_size": LEDGER_FASTENERS["default"]["size"],
        "fastener_spacing": LEDGER_FASTENERS["default"]["spacing"],
        "material": "PT",
    }

    # --- Stairs ---
    stair_info = calc.get("stairs")
    spec["stairs"] = stair_info  # None if no stairs

    # --- Guard rail ---
    rail_height = calc.get("rail_height", 36)
    railing_type = params.get("railingType", "fortress")
    guard = GUARD_SYSTEMS.get(railing_type, GUARD_SYSTEMS["fortress"])

    spec["guardrail"] = {
        "height": rail_height,
        "system": guard["brand"],
        "model": guard["model"],
        "brand_label": guard["label"],
        "rail_length": calc.get("rail_length", 0),
    }

    # --- Decking ---
    decking_type = params.get("deckingType", "composite")
    spec["decking"] = {
        "type": decking_type,
        "label": "1 x 6 COMPOSITE DECKING" if decking_type == "composite"
                 else "5/4 x 6 PT WOOD DECKING",
    }

    # --- Hardware (resolved from selection tables) ---
    post_base = POST_BASES.get(post_size, POST_BASES["6x6"])
    post_cap = POST_CAPS.get(post_size, POST_CAPS["6x6"])
    joist_hanger = JOIST_HANGERS.get(joist_size, JOIST_HANGERS["2x10"])
    hurricane = HURRICANE_TIES["default"]
    lateral = LATERAL_LOAD["default"]
    stair_conn_top = STAIR_CONNECTORS["top"]
    stair_conn_bot = STAIR_CONNECTORS["bottom"]

    spec["hardware"] = {
        "post_base": post_base,
        "post_cap": post_cap,
        "joist_hanger": joist_hanger,
        "hurricane_tie": hurricane,
        "lateral_load": lateral,
        "stair_connector_top": stair_conn_top,
        "stair_connector_bottom": stair_conn_bot,
        "ledger_fastener": LEDGER_FASTENERS["default"],
    }

    # --- Zones ---
    zones = params.get("zones", [])
    spec["has_zones"] = len(zones) > 0

    # --- Slope ---
    spec["slope"] = {
        "percent": params.get("slopePercent", 0),
        "direction": params.get("slopeDirection", "front-to-back"),
    }

    # --- Frost / Snow ---
    spec["frost_zone"] = params.get("frostZone", "cold")

    # --- Warnings from calc engine ---
    spec["warnings"] = calc.get("warnings", [])

    # ============================================================
    # PRE-FORMATTED LABEL STRINGS
    # ============================================================
    # These are the exact strings that appear on drawings.
    # One place to edit, every sheet picks it up.

    labels = {}

    # Framing plan labels (A-1)
    labels["ledger"] = (
        f'{ledger_size} PT LEDGER W/ (2) {LEDGER_FASTENERS["default"]["size"]}'
        f' LEDGER LOCKS @ {LEDGER_FASTENERS["default"]["spacing"]}" O.C.'
    )
    labels["joist"] = f'P.T. {joist_size} @ {joist_spacing}" O.C.'
    labels["joist_deck"] = "DECK JOISTS"
    labels["blocking"] = f'{joist_size} SOLID BLOCKING AT MID-SPAN'
    labels["beam"] = f'{beam_size.upper()} PT {"DROPPED " if beam_type == "dropped" else ""}BEAM'
    labels["posts_and_hardware"] = (
        f'{post_size} PT POSTS W/ SIMPSON \'{post_base["model"]}\' POST BASE'
        f' AND \'{post_cap["model"]}\' POST CAP ({total_posts} PLCS)'
    )
    labels["footings"] = (
        f'{footing_diam}" DIA. CONCRETE PIERS x {footing_depth}" DEEP'
        f' ({num_footings} PLCS)'
    )
    labels["joist_hanger"] = (
        f'SIMPSON \'{joist_hanger["model"]}\' JOIST HANGER EA. JOIST'
    )
    labels["hurricane_tie"] = (
        f'SIMPSON \'{hurricane["model"]}\' EA. JOIST TO BEAM'
    )
    labels["lateral_load"] = (
        f'SIMPSON \'{lateral["model"]}\' LATERAL LOAD CONNECTORS'
        f' ({lateral["min_count"]}) PLCS'
    )
    labels["decking"] = spec["decking"]["label"]
    labels["guardrail"] = (
        f'{rail_height}" {guard["label"] + " " if guard["label"] else ""}'
        f'GUARD RAIL SYSTEM'
    ).replace("  ", " ")

    # Loads box
    labels["loads_LL"] = f'L.L. = {LL} PSF'
    labels["loads_DL"] = f'D.L. = {DL} PSF'
    labels["loads_TL"] = f'T.L. = {TL} PSF'
    labels["loads_ledger"] = f'LEDGER = {ledger_capacity} PSF' if attachment == "ledger" else None

    # Stair labels
    if stair_info:
        n_str = stair_info["num_stringers"]
        labels["stair_stringers"] = (
            f'({n_str}) 2x12 PT STRINGERS'
        )
        labels["stair_rise_run"] = (
            f'{stair_info["actual_rise"]:.1f}" RISE / {stair_info["tread_depth"]}" RUN'
        )
        labels["stair_connector"] = (
            f'SIMPSON \'{stair_conn_top["model"]}\' STRINGER CONNECTOR EA. STRINGER'
        )

    # Compact labels for side elevation views (shorter than A-1 but spec-driven)
    labels["post_compact"] = f'{post_size} PT POST'
    labels["pier_compact"] = (
        f'{footing_diam}" DIA. PIER x {footing_depth}" DEEP'
    )

    spec["labels"] = labels

    # ============================================================
    # VALIDATION
    # ============================================================
    errors = _validate_spec(spec)
    spec["validation_errors"] = errors

    return spec


def _validate_spec(spec):
    """
    Cross-sheet consistency checks. Returns list of error strings (empty = valid).
    """
    errors = []

    # Joist size on framing must match joist size in notes
    # (This is guaranteed by the spec, but verify the data is present)
    if not spec.get("joists", {}).get("size"):
        errors.append("Missing joist size")
    if not spec.get("beam", {}).get("size"):
        errors.append("Missing beam size")
    if not spec.get("posts", {}).get("size"):
        errors.append("Missing post size")
    if not spec.get("footings", {}).get("diameter"):
        errors.append("Missing footing diameter")
    if not spec.get("footings", {}).get("depth"):
        errors.append("Missing footing depth")

    # Hardware models must be resolved
    hw = spec.get("hardware", {})
    if not hw.get("post_base", {}).get("model"):
        errors.append("Unresolved post base model")
    if not hw.get("joist_hanger", {}).get("model"):
        errors.append("Unresolved joist hanger model")
    if not hw.get("hurricane_tie", {}).get("model"):
        errors.append("Unresolved hurricane tie model")

    # Labels must be populated
    labels = spec.get("labels", {})
    required_labels = ["ledger", "joist", "beam", "posts_and_hardware",
                       "footings", "joist_hanger", "hurricane_tie"]
    for lbl in required_labels:
        if not labels.get(lbl):
            errors.append(f"Missing label: {lbl}")

    return errors
