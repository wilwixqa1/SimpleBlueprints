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

import math


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

# ============================================================
# FORTRESS EVOLUTION HARDWARE (STEEL FRAMING)
# ============================================================
# Fortress-specific brackets and connectors per CCRR-0313.
# When framingType == "steel", these replace all Simpson hardware.

STEEL_HARDWARE = {
    "post_pier_bracket":       {"model": "3.5\" POST/PIER BRACKET",      "manufacturer": "Fortress"},
    "single_beam_post_bracket":{"model": "SNGL BEAM/POST BRACKET",       "manufacturer": "Fortress"},
    "double_beam_post_bracket":{"model": "DBL BEAM/POST BRACKET",        "manufacturer": "Fortress"},
    "hanger_bracket":          {"model": "SNGL HANGER BRACKET",          "manufacturer": "Fortress"},
    "double_hanger_bracket":   {"model": "DBL HANGER BRACKET",           "manufacturer": "Fortress"},
    "ledger_bracket":          {"model": "LEDGER BRACKET",               "manufacturer": "Fortress"},
    "f50_bracket":             {"model": "F50 BRACKET",                  "manufacturer": "Fortress"},
    "f10_bracket":             {"model": "F10 BRACKET",                  "manufacturer": "Fortress"},
    "rim_joist_bracket":       {"model": "RIM JOIST BRACKET",            "manufacturer": "Fortress"},
    "blocking_12":             {"model": "12OC BLOCKING",                "manufacturer": "Fortress"},
    "blocking_16":             {"model": "16OC BLOCKING",                "manufacturer": "Fortress"},
    "strap_12":                {"model": "12OC STRAP",                   "manufacturer": "Fortress"},
    "strap_16":                {"model": "16OC STRAP",                   "manufacturer": "Fortress"},
    "self_drilling_screw":     {"model": '3/4" SELF-DRILLING SCREW',     "manufacturer": "Fortress"},
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

    # --- Framing type (detected early, used throughout) ---
    is_steel = params.get("framingType") == "steel" or calc.get("framingType") == "steel"
    spec["is_steel"] = is_steel

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
        # Raw ground snow PSF from params (not derived from LL)
        "ground_snow": {"none": 0, "light": 20, "moderate": 40, "heavy": 60}.get(
            params.get("snowLoad", "none"), 0),
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
    if is_steel:
        beam_material = "STEEL"
    elif is_lvl:
        beam_material = "LVL"
    else:
        beam_material = "PT"

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

    # S82e: include zone posts in total so framing plan label matches cover sheet.
    # Mirrors zone post math in draw_cover.py extra_posts.
    zones = params.get("zones", [])
    extra_posts = 0
    for z in zones:
        if z.get("type") == "cutout":
            continue
        # Flush-beam zones don't have posts (joists bear on rim).
        if z.get("beamType") == "flush":
            continue
        edge = z.get("attachEdge", "front")
        dim = z.get("d", 6) if edge in ("right", "left") else z.get("w", 8)
        extra_posts += max(2, math.ceil(dim / 8) + 1)
    total_posts_with_zones = total_posts + extra_posts

    spec["posts"] = {
        "size": post_size,
        "count": num_posts,
        "total": total_posts_with_zones,
        "total_main": total_posts,
        "total_zones": extra_posts,
        "positions": post_positions,
        "heights": post_heights,
        "material": "STEEL" if is_steel else "PT",
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
        "material": "STEEL" if is_steel else "PT",
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

    # --- Framing type details ---
    steel_gauge = calc.get("steelGauge", params.get("steelGauge", "16"))
    steel_beam_is_single = calc.get("steelBeamIsSingle", True)
    spec["steel_gauge"] = steel_gauge

    # --- Hardware (resolved from selection tables) ---
    if is_steel:
        # Fortress Evolution brackets replace all Simpson hardware
        _bp = "single_beam_post_bracket" if steel_beam_is_single else "double_beam_post_bracket"
        _hng = "hanger_bracket"
        _blk = f"blocking_{joist_spacing}"
        _strp = f"strap_{joist_spacing}"
        post_base = STEEL_HARDWARE["post_pier_bracket"]
        post_cap = STEEL_HARDWARE[_bp]
        joist_hanger = STEEL_HARDWARE[_hng]
        hurricane = {"model": "N/A (steel system)", "manufacturer": "Fortress"}
        lateral = LATERAL_LOAD["default"]  # lateral load connectors still apply
        stair_conn_top = STAIR_CONNECTORS["top"]  # stairs are wood for now
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
            "f50_bracket": STEEL_HARDWARE["f50_bracket"],
            "ledger_bracket": STEEL_HARDWARE["ledger_bracket"],
            "rim_bracket": STEEL_HARDWARE["rim_joist_bracket"],
            "blocking": STEEL_HARDWARE.get(_blk, STEEL_HARDWARE["blocking_16"]),
            "strap": STEEL_HARDWARE.get(_strp, STEEL_HARDWARE["strap_16"]),
            "screw": STEEL_HARDWARE["self_drilling_screw"],
        }
    else:
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

    # S61: Per-zone structural sizing (single source of truth for all consumers)
    # S76: For steel framing, zones use same steel members as main deck
    _zone_calcs = []
    if is_steel:
        for z in zones:
            if z.get("type") == "cutout":
                _zone_calcs.append(None)
            else:
                _zone_calcs.append({
                    "joist_size": joist_size,
                    "beam_size": beam_size,
                    "beam_span": spec["beam"]["span"],
                    "j_span": spec["joists"]["span"],
                })
    else:
        from .calc_engine import get_joist_spans_for_load, auto_select_beam
        _beam_setback = 1.5
        for z in zones:
            if z.get("type") == "cutout":
                _zone_calcs.append(None)
                continue
            _ze = z.get("attachEdge", "front")
            _zw = z.get("w", 8)
            _zd = z.get("d", 6)
            _z_beam_type = z.get("beamType", "dropped")
            if _ze in ("right", "left"):
                _zbl = _zd
                _zjs = _zw - _beam_setback
                _znp = max(2, math.ceil(_zd / 8) + 1)
            else:
                _zbl = _zw
                _zjs = _zd - _beam_setback
                _znp = max(2, math.ceil(_zw / 8) + 1)
            _zjt = get_joist_spans_for_load(LL, calc.get("species", "dfl_hf_spf"))
            _zj_size = "2x12"
            for _zsz, _zsp in _zjt.items():
                if _zsp.get(joist_spacing, 0) >= _zjs:
                    _zj_size = _zsz
                    break
            # S80: Flush beam zones use rim board -- no beam sizing needed
            if _z_beam_type == "flush":
                _zone_calcs.append({
                    "joist_size": _zj_size,
                    "beam_size": "rim",
                    "beam_span": 0,
                    "j_span": round(_zjs, 1),
                    "beam_type": "flush",
                })
            else:
                _zbs = _zbl / max(_znp - 1, 1)
                _zb_size = auto_select_beam(_zbs, _zjs, LL, calc.get("species", "dfl_hf_spf"))
                _zone_calcs.append({
                    "joist_size": _zj_size,
                    "beam_size": _zb_size,
                    "beam_span": round(_zbs, 1),
                    "j_span": round(_zjs, 1),
                    "beam_type": "dropped",
                })
    spec["zone_calcs"] = _zone_calcs

    # --- Slope ---
    spec["slope"] = {
        "percent": params.get("slopePercent", 0),
        "direction": params.get("slopeDirection", "front-to-back"),
    }

    # --- Frost / Snow ---
    spec["frost_zone"] = params.get("frostZone", "cold")

    # --- Warnings from calc engine ---
    spec["warnings"] = calc.get("warnings", [])

    # S61: Engineering required flag (joist over-span)
    spec["engineering_required"] = calc.get("engineering_required", False)
    spec["max_depth_for_joists"] = calc.get("max_depth_for_joists", 0)

    # ============================================================
    # PRE-FORMATTED LABEL STRINGS
    # ============================================================
    # These are the exact strings that appear on drawings.
    # One place to edit, every sheet picks it up.
    # S76: Steel labels use Fortress/Welborn convention per STEEL_PDF_LABELS.

    labels = {}

    if is_steel:
        # ----- STEEL (Fortress Evolution) labels -----
        # Per Rick Rutstein / Welborn convention: "FF-EVOLUTION - ..."
        _beam_type_label = "SINGLE" if steel_beam_is_single else "DOUBLE"

        labels["ledger"] = f'FF-EVOLUTION - {joist_spacing}OC - S LEDGER'
        labels["joist"] = f'FF-EVOLUTION - 2X6-{steel_gauge} GA - PC DECK JOISTS @ {joist_spacing}" O.C.'
        labels["joist_deck"] = "DECK JOISTS"
        labels["blocking"] = f'FF-EVOLUTION - {joist_spacing}OC BLOCKING'
        labels["beam"] = f'FF-EVOLUTION 2X11 {_beam_type_label} {"DROPPED " if beam_type == "dropped" else ""}BEAM'
        labels["posts_and_hardware"] = (
            f'FORTRESS STEEL 3.5" X 3.5" POSTS W/ FF-EVOLUTION'
            f' \'{post_base["model"]}\''
            f' AND \'{post_cap["model"]}\' ({total_posts} PLCS)'
        )
        labels["footings"] = (
            f'{footing_diam}" DIA. CONCRETE PIERS x {footing_depth}" DEEP'
            f' ({num_footings} PLCS)'
        )
        labels["joist_hanger"] = (
            f'FF-EVOLUTION \'{joist_hanger["model"]}\' EA. JOIST'
        )
        labels["hurricane_tie"] = (
            f'FF-EVOLUTION F50 BRACKET EA. JOIST TO BEAM'
        )
        labels["lateral_load"] = (
            f'SIMPSON \'{lateral["model"]}\' LATERAL LOAD CONNECTORS'
            f' ({lateral["min_count"]}) PLCS'
        )
        labels["screw_note"] = (
            'USE 3/4" SELF-TAPPING SCREWS PER MANUFACTURER\'S'
            ' SPECIFICATIONS - FILL ALL HOLES'
        )
    else:
        # ----- WOOD (IRC R507) labels -----
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

    # --- Shared labels (same for wood and steel) ---
    labels["decking"] = spec["decking"]["label"]
    labels["guardrail"] = (
        f'{rail_height}" {guard["label"] + " " if guard["label"] else ""}'
        f'GUARD RAIL SYSTEM'
    ).replace("  ", " ")

    # Loads box - always show actual live load (40 PSF), add snow when applicable
    labels["loads_LL"] = 'L.L. = 40 PSF'
    _ground_snow = spec["loads"]["ground_snow"]
    if _ground_snow > 40:
        labels["loads_snow"] = f'G.S.L. = {_ground_snow} PSF (GOVERNS)'
    elif _ground_snow > 0:
        labels["loads_snow"] = f'G.S.L. = {_ground_snow} PSF'
    else:
        labels["loads_snow"] = None
    labels["loads_DL"] = f'D.L. = {DL} PSF'
    labels["loads_TL"] = f'T.L. = {TL} PSF'
    labels["loads_ledger"] = f'LEDGER = {ledger_capacity} PSF' if attachment == "ledger" else None

    # S76: Lumber/system label in loads box
    if is_steel:
        labels["loads_lumber"] = 'STEEL FRAMING PER FORTRESS EVOLUTION SYSTEM - INTERTEK CCRR-0313'
    else:
        _species = calc.get("species", "dfl_hf_spf")
        _species_names = {
            "southern_pine": "SOUTHERN PINE",
            "dfl_hf_spf": "DFL / HEM-FIR / SPF",
            "redwood_cedar": "REDWOOD / W. CEDAR / PP / RP",
        }
        labels["loads_lumber"] = f'LUMBER: No. 2 {_species_names.get(_species, "DFL / HEM-FIR / SPF")}'

    # Stair labels (stairs are wood for now, even on steel decks)
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

    # Compact labels for side elevation views
    if is_steel:
        labels["post_compact"] = f'FORTRESS 3.5" STEEL POST'
        labels["pier_compact"] = (
            f'{footing_diam}" DIA. PIER x {footing_depth}" DEEP'
        )
    else:
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
