"""
SimpleBlueprints - IRC 2021 Structural Tables (Round 2)
========================================================
Source: 2021 IRC via ICC Digital Codes (Tiny House Provisions edition)
Tables: Ledger fasteners, bolt placement, interior headers, fastening
        schedule, rafter tie factors, decking spacing, deck fastener specs,
        climatic design criteria template.
"""


# ======================================================================
# TABLE R507.9.1.3(1) - DECK LEDGER CONNECTION
# ======================================================================
# DL=10psf. Snow not concurrent with live load.
# Format: {load_psf: {joist_span_ft: {fastener_type: spacing_inches}}}

IRC_LEDGER_FASTENER_SPACING = {
    40: {
        6:  {"lag_half_sheathing": 30, "bolt_half_sheathing": 36, "bolt_1in_sheathing": 36},
        8:  {"lag_half_sheathing": 23, "bolt_half_sheathing": 36, "bolt_1in_sheathing": 36},
        10: {"lag_half_sheathing": 18, "bolt_half_sheathing": 34, "bolt_1in_sheathing": 29},
        12: {"lag_half_sheathing": 15, "bolt_half_sheathing": 29, "bolt_1in_sheathing": 24},
        14: {"lag_half_sheathing": 13, "bolt_half_sheathing": 24, "bolt_1in_sheathing": 21},
        16: {"lag_half_sheathing": 11, "bolt_half_sheathing": 21, "bolt_1in_sheathing": 18},
        18: {"lag_half_sheathing": 10, "bolt_half_sheathing": 19, "bolt_1in_sheathing": 16},
    },
    50: {
        6:  {"lag_half_sheathing": 29, "bolt_half_sheathing": 36, "bolt_1in_sheathing": 36},
        8:  {"lag_half_sheathing": 22, "bolt_half_sheathing": 36, "bolt_1in_sheathing": 35},
        10: {"lag_half_sheathing": 17, "bolt_half_sheathing": 33, "bolt_1in_sheathing": 28},
        12: {"lag_half_sheathing": 14, "bolt_half_sheathing": 27, "bolt_1in_sheathing": 23},
        14: {"lag_half_sheathing": 12, "bolt_half_sheathing": 23, "bolt_1in_sheathing": 20},
        16: {"lag_half_sheathing": 11, "bolt_half_sheathing": 20, "bolt_1in_sheathing": 17},
        18: {"lag_half_sheathing": 9,  "bolt_half_sheathing": 18, "bolt_1in_sheathing": 15},
    },
    60: {
        6:  {"lag_half_sheathing": 25, "bolt_half_sheathing": 36, "bolt_1in_sheathing": 36},
        8:  {"lag_half_sheathing": 18, "bolt_half_sheathing": 35, "bolt_1in_sheathing": 30},
        10: {"lag_half_sheathing": 15, "bolt_half_sheathing": 28, "bolt_1in_sheathing": 24},
        12: {"lag_half_sheathing": 12, "bolt_half_sheathing": 23, "bolt_1in_sheathing": 20},
        14: {"lag_half_sheathing": 10, "bolt_half_sheathing": 20, "bolt_1in_sheathing": 17},
        16: {"lag_half_sheathing": 9,  "bolt_half_sheathing": 17, "bolt_1in_sheathing": 15},
        18: {"lag_half_sheathing": 8,  "bolt_half_sheathing": 15, "bolt_1in_sheathing": 13},
    },
    70: {
        6:  {"lag_half_sheathing": 22, "bolt_half_sheathing": 36, "bolt_1in_sheathing": 35},
        8:  {"lag_half_sheathing": 16, "bolt_half_sheathing": 31, "bolt_1in_sheathing": 26},
        10: {"lag_half_sheathing": 13, "bolt_half_sheathing": 25, "bolt_1in_sheathing": 21},
        12: {"lag_half_sheathing": 11, "bolt_half_sheathing": 20, "bolt_1in_sheathing": 17},
        14: {"lag_half_sheathing": 9,  "bolt_half_sheathing": 17, "bolt_1in_sheathing": 15},
        16: {"lag_half_sheathing": 8,  "bolt_half_sheathing": 15, "bolt_1in_sheathing": 13},
        18: {"lag_half_sheathing": 7,  "bolt_half_sheathing": 13, "bolt_1in_sheathing": 11},
    },
}


# ======================================================================
# TABLE R507.9.1.3(2) - LEDGER BOLT PLACEMENT (inches)
# ======================================================================

IRC_LEDGER_BOLT_PLACEMENT = {
    "ledger": {
        "top_edge_min": 2.0, "bottom_edge_min": 0.75,
        "end_distance_min": 2.0, "row_spacing_min": 1.625,
    },
    "band_joist": {
        "top_edge_min": 0.75, "bottom_edge_min": 2.0,
        "end_distance_min": 2.0, "row_spacing_min": 1.625,
    },
}


# ======================================================================
# TABLE R602.7(2) - INTERIOR HEADER SPANS
# ======================================================================
# No. 2 grade. Format: (span_ft, jack_studs_required)

IRC_HEADER_SPANS_INTERIOR = {
    "one_floor_only": {
        12: {
            "2-2x4": (4.08, 1), "2-2x6": (6.08, 1), "2-2x8": (7.75, 1),
            "2-2x10": (9.17, 1), "2-2x12": (10.75, 1),
            "3-2x8": (9.67, 1), "3-2x10": (11.42, 1), "3-2x12": (13.50, 1),
            "4-2x8": (11.17, 1), "4-2x10": (13.25, 1), "4-2x12": (15.58, 1),
        },
        24: {
            "2-2x4": (2.83, 1), "2-2x6": (4.33, 1), "2-2x8": (5.42, 1),
            "2-2x10": (6.50, 2), "2-2x12": (7.58, 2),
            "3-2x8": (6.83, 1), "3-2x10": (8.08, 1), "3-2x12": (9.50, 2),
            "4-2x8": (7.92, 1), "4-2x10": (9.33, 1), "4-2x12": (11.00, 1),
        },
        36: {
            "2-2x4": (2.33, 1), "2-2x6": (3.50, 1), "2-2x8": (4.42, 2),
            "2-2x10": (5.25, 2), "2-2x12": (6.25, 2),
            "3-2x8": (5.58, 1), "3-2x10": (6.58, 2), "3-2x12": (7.75, 2),
            "4-2x8": (6.42, 1), "4-2x10": (7.67, 1), "4-2x12": (9.00, 2),
        },
    },
    "two_floors": {
        12: {
            "2-2x4": (2.58, 1), "2-2x6": (3.92, 1), "2-2x8": (5.00, 1),
            "2-2x10": (5.92, 2), "2-2x12": (6.92, 2),
            "3-2x8": (6.25, 1), "3-2x10": (7.42, 1), "3-2x12": (8.67, 2),
            "4-2x8": (7.17, 1), "4-2x10": (8.50, 1), "4-2x12": (10.08, 1),
        },
        24: {
            "2-2x4": (1.92, 1), "2-2x6": (2.92, 2), "2-2x8": (3.67, 2),
            "2-2x10": (4.33, 2), "2-2x12": (5.17, 2),
            "3-2x8": (4.58, 2), "3-2x10": (5.50, 2), "3-2x12": (6.42, 2),
            "4-2x8": (5.33, 1), "4-2x10": (6.33, 2), "4-2x12": (7.42, 2),
        },
        36: {
            "2-2x4": (1.58, 1), "2-2x6": (2.42, 2), "2-2x8": (3.08, 2),
            "2-2x10": (3.58, 2), "2-2x12": (4.25, 3),
            "3-2x8": (3.83, 2), "3-2x10": (4.50, 2), "3-2x12": (5.33, 2),
            "4-2x8": (4.42, 2), "4-2x10": (5.25, 2), "4-2x12": (6.17, 2),
        },
    },
}


# ======================================================================
# TABLE R602.3(1) - KEY FASTENING SCHEDULE ENTRIES
# ======================================================================

IRC_FASTENING_SCHEDULE_KEY = [
    {"item": "2",  "desc": "Ceiling joists to top plate",            "fastener": "3-8d common or 3-10d box", "method": "toe nail per joist"},
    {"item": "5",  "desc": "Collar tie to rafter",                   "fastener": "3-10d common or 4-10d box", "method": "face nail each rafter"},
    {"item": "6",  "desc": "Rafter or roof truss to plate",          "fastener": "3-10d common or 4-10d box", "method": "2 toe nails one side + 1 opposite"},
    {"item": "7",  "desc": "Roof rafter to ridge/valley/hip",        "fastener": "3-10d common (toe); 2-16d common (end)", "method": "toe nail or end nail"},
    {"item": "10", "desc": "Built-up header (2in to 2in w/ spacer)", "fastener": "16d common", "method": "16in o.c. each edge face nail"},
    {"item": "13", "desc": "Top plate to top plate",                 "fastener": "16d common", "method": "16in o.c. face nail"},
    {"item": "14", "desc": "Double top plate splice",                "fastener": "8-16d common or 12-16d box", "method": "face nail each side, min 24in lap"},
    {"item": "15", "desc": "Bottom plate to joist/rim/blocking",     "fastener": "16d common", "method": "16in o.c. face nail"},
    {"item": "17", "desc": "Top or bottom plate to stud",            "fastener": "2-16d common (end); 4-8d common (toe)", "method": "end nail or toe nail"},
    {"item": "22", "desc": "Joist to sill, top plate or girder",     "fastener": "3-8d common or 3-10d box", "method": "toe nail"},
    {"item": "27", "desc": "Band or rim joist to joist",             "fastener": "3-16d common or 4-10d box", "method": "end nail"},
    {"item": "28", "desc": "Built-up girders/beams, 2in layers",     "fastener": "20d common or 10d box", "method": "32in o.c. top+bottom staggered"},
    {"item": "29", "desc": "Ledger strip supporting joists/rafters", "fastener": "3-16d common or 4-10d box", "method": "face nail at each joist/rafter"},
    {"item": "30", "desc": "Bridging/blocking to joist/rafter",      "fastener": "2-8d common or 2-10d box", "method": "toe nail each end"},
]


# ======================================================================
# TABLE R802.4.1(9) - RAFTER TIE ADJUSTMENT (NOT IN TINY HOUSE EDITION)
# ======================================================================

IRC_RAFTER_TIE_ADJUSTMENT = {
    "note": "Table R802.4.1(9) not in Tiny House Provisions edition. Source from full 2021 IRC.",
    "default_factor": 1.00,
    "engineering_required_above": 0.333,
}


# ======================================================================
# TABLE R507.7 - DECKING JOIST SPACING (inches)
# ======================================================================

IRC_DECKING_MAX_JOIST_SPACING = {
    "1.25_inch_wood": {
        "perpendicular_single": 12, "perpendicular_multiple": 16,
        "diagonal_single": 8, "diagonal_multiple": 12,
    },
    "2_inch_wood": {
        "perpendicular_single": 24, "perpendicular_multiple": 24,
        "diagonal_single": 18, "diagonal_multiple": 24,
    },
}


# ======================================================================
# TABLE R507.2.3 - DECK FASTENER SPECS
# ======================================================================

IRC_DECK_FASTENER_SPECS = [
    {"item": "Nails/rivets", "material": "ASTM F1667", "min_finish": "HDG per ASTM A153 Class D", "alt": "Stainless/silicon bronze/copper"},
    {"item": "Bolts", "material": "ASTM A307/A563/F844", "min_finish": "HDG per ASTM A153 Class C or mech galv ASTM B695 Class 55 or 410 SS", "alt": "Stainless/silicon bronze/copper"},
    {"item": "Lag screws", "material": "ASTM A307/A563/F844", "min_finish": "HDG per ASTM A153 Class C or mech galv ASTM B695 Class 55 or 410 SS", "alt": "Stainless/silicon bronze/copper"},
    {"item": "Metal connectors", "material": "Per mfr spec", "min_finish": "ASTM A653 G185 zinc or post HDG per ASTM A123 min 2.0 oz/ft2", "alt": "Stainless steel"},
]


# ======================================================================
# TABLE R301.2 - CLIMATIC DESIGN CRITERIA TEMPLATE
# ======================================================================

IRC_CLIMATIC_DESIGN_CRITERIA_TEMPLATE = {
    "ground_snow_load_psf": None,
    "wind_speed_mph": None,
    "wind_topographic_effects": None,
    "special_wind_region": None,
    "windborne_debris_zone": None,
    "seismic_design_category": None,
    "weathering": None,
    "frost_line_depth_inches": None,
    "termite": None,
    "ice_barrier_underlayment_required": None,
    "flood_hazards": None,
    "air_freezing_index": None,
    "mean_annual_temp_f": None,
    "elevation_ft": None,
    "latitude": None,
    "daily_range": None,
}
