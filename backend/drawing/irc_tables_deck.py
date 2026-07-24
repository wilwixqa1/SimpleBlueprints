"""
SimpleBlueprints - IRC 2021 DECK TABLES (R507.5 / R507.6) - REFERENCE SNAPSHOT
=============================================================================
Source: 2021 International Residential Code, Section R507.
Transcribed in S59 (R507.6 joists, commit d042edb) and S60 (R507.5 beams,
commit fe5e401), two days BEFORE irc_tables.py existed (S60, ae867d3) --
which is why the deck tables were never stored alongside the rafter, floor
joist and header tables. This module closes that gap.

WHAT THIS IS
------------
A REFERENCE SNAPSHOT, not the live lookup. The engines still read their own
copies:

  * backend/drawing/calc_engine.py   IRC_JOIST_SPANS / IRC_BEAM_SPANS  (PDF)
  * backend/static/js/engine.js      JOIST_SPANS / BEAM_SPANS          (screen)

Nothing imports from this file at runtime, so it CANNOT change any output.
Its job is to be the durable record of what those tables held, and to give
tests/test_irc_table_drift.py something to compare against. If a future edit
to either engine changes a span value, that test fails and names the cell.

WHY A SNAPSHOT AND NOT A SINGLE SOURCE
--------------------------------------
Consolidating (engines importing from here, inline copies deleted) is the
right end state but moves structural sizing on the permit path, so golden
would change deliberately and it needs Billy's review. That is a separate,
higher-risk session. This file is the safe half: it makes drift VISIBLE
without touching what ships.

KNOWN DIVERGENCE RECORDED HERE (pre-existing, S101)
---------------------------------------------------
Python carries three species groups; JS carries only dfl_hf_spf, hardcoded.
For southern_pine the JS answer is conservative (weaker table -> more posts).
For redwood_cedar it is NOT: on a flat 20x14 deck Python calls 4 posts and
the screen shows 3 -- the screen UNDER-reports.

This is currently DORMANT: `species` is an API field defaulting to
dfl_hf_spf with no UI control anywhere in backend/static/js (the S60 Push 2
species selector was removed in Push 3, 8445cd5, and never restored). Only a
direct API POST can reach it. Filed rather than fixed: adding species to JS
is new capability on an unreachable path and invites the product question of
whether the selector should return at all.

DO NOT hand-edit the numbers below. They were generated from the live tables
so they are exact by construction. If a value here is genuinely wrong, the
fix belongs in calc_engine.py / engine.js first; regenerate afterwards.
"""

# Columns for every beam table below = effective deck joist span, in feet.
JOIST_SPAN_COLS = [6, 8, 10, 12, 14, 16, 18]


# =============================================================================
# TABLE R507.6: MAXIMUM DECK JOIST SPANS  (snapshot of calc_engine.IRC_JOIST_SPANS)
# =============================================================================
# Decimal feet. No. 2 grade, wet service. DL=10 psf assumed by the code.
# Design load tiers: 40 = live load; 50/60/70 = ground snow. Lookup key is
# max(40, snow_load) per IRC footnote a.
#
# ENGINE NOTE carried over from calc_engine.py: our engine uses DL=15
# (composite) or DL=12 (wood) against the table's DL=10 basis. Conservative
# for wood; ~10% non-conservative for composite on a 50 PSF TL, which S59
# judged to be inside the lumber safety margin. Revisiting that needs
# engineering interpolation beyond the code tables.

SNAPSHOT_JOIST_SPANS_PY = {
    "southern_pine": {
        40: {
            "2x6": {12: 9.92, 16: 9.0, 24: 7.58},
            "2x8": {12: 13.08, 16: 11.83, 24: 9.67},
            "2x10": {12: 16.17, 16: 14.0, 24: 11.42},
            "2x12": {12: 18.0, 16: 16.5, 24: 13.5},
        },
        50: {
            "2x6": {12: 9.17, 16: 8.33, 24: 7.33},
            "2x8": {12: 12.08, 16: 11.0, 24: 9.42},
            "2x10": {12: 15.42, 16: 13.75, 24: 11.25},
            "2x12": {12: 18.0, 16: 16.17, 24: 13.17},
        },
        60: {
            "2x6": {12: 8.67, 16: 7.83, 24: 6.83},
            "2x8": {12: 11.42, 16: 10.33, 24: 8.75},
            "2x10": {12: 14.58, 16: 12.75, 24: 10.42},
            "2x12": {12: 17.25, 16: 15.0, 24: 12.25},
        },
        70: {
            "2x6": {12: 8.25, 16: 7.5, 24: 6.42},
            "2x8": {12: 10.83, 16: 9.83, 24: 8.17},
            "2x10": {12: 13.75, 16: 11.92, 24: 9.75},
            "2x12": {12: 16.17, 16: 14.0, 24: 11.42},
        },
    },
    "dfl_hf_spf": {
        40: {
            "2x6": {12: 9.5, 16: 8.33, 24: 6.83},
            "2x8": {12: 12.5, 16: 11.08, 24: 9.08},
            "2x10": {12: 15.67, 16: 13.58, 24: 11.08},
            "2x12": {12: 18.0, 16: 15.75, 24: 12.83},
        },
        50: {
            "2x6": {12: 8.83, 16: 8.0, 24: 6.67},
            "2x8": {12: 11.58, 16: 10.58, 24: 8.92},
            "2x10": {12: 14.83, 16: 13.25, 24: 10.83},
            "2x12": {12: 17.75, 16: 15.42, 24: 12.58},
        },
        60: {
            "2x6": {12: 8.33, 16: 7.5, 24: 6.17},
            "2x8": {12: 10.92, 16: 9.92, 24: 8.25},
            "2x10": {12: 13.92, 16: 12.33, 24: 10.0},
            "2x12": {12: 16.5, 16: 14.25, 24: 11.67},
        },
        70: {
            "2x6": {12: 7.92, 16: 7.08, 24: 5.75},
            "2x8": {12: 10.42, 16: 9.42, 24: 7.67},
            "2x10": {12: 13.25, 16: 11.5, 24: 9.42},
            "2x12": {12: 15.42, 16: 13.33, 24: 10.92},
        },
    },
    "redwood_cedar": {
        40: {
            "2x6": {12: 8.83, 16: 8.0, 24: 6.83},
            "2x8": {12: 11.67, 16: 10.58, 24: 8.67},
            "2x10": {12: 14.92, 16: 13.0, 24: 10.58},
            "2x12": {12: 17.42, 16: 15.08, 24: 12.33},
        },
        50: {
            "2x6": {12: 8.25, 16: 7.5, 24: 6.5},
            "2x8": {12: 10.83, 16: 9.83, 24: 8.5},
            "2x10": {12: 13.83, 16: 12.58, 24: 10.42},
            "2x12": {12: 16.83, 16: 14.75, 24: 12.08},
        },
        60: {
            "2x6": {12: 7.75, 16: 7.0, 24: 6.17},
            "2x8": {12: 10.17, 16: 9.25, 24: 7.92},
            "2x10": {12: 13.0, 16: 11.75, 24: 9.58},
            "2x12": {12: 15.75, 16: 13.67, 24: 11.17},
        },
        70: {
            "2x6": {12: 7.33, 16: 6.67, 24: 5.83},
            "2x8": {12: 9.67, 16: 8.83, 24: 7.33},
            "2x10": {12: 12.33, 16: 11.0, 24: 9.0},
            "2x12": {12: 14.75, 16: 12.75, 24: 10.42},
        },
    },
}


# =============================================================================
# TABLES R507.5(1)-(4): DECK BEAM SPANS  (snapshot of calc_engine.IRC_BEAM_SPANS)
# =============================================================================
# Decimal feet, converted from the code's feet-inches. Columns are
# JOIST_SPAN_COLS above. No. 2 grade, wet service, DL=10 psf.
# L/delta = 360 main span, 180 cantilever. Beam cantilevers limited to
# adjacent span / 4. R507.5(5) gives an effective-joist-span factor; the
# engine uses the actual joist span (factor 1.0), which is conservative.
#
# PROVENANCE NOTE: commit c980054 (S60 Push 1b) corrected a one-inch error in
# redwood_cedar "3-ply 2x12" at the 8 ft column, 12-0 -> 12-1. That is the
# kind of cell-level correction that only comes from reading the published
# table directly, and the kind that silently diverges when the same table
# lives in more than one file.

SNAPSHOT_BEAM_SPANS_PY = {
    # --- TABLE R507.5(1): 40 PSF LIVE LOAD ---
    40: {
        "southern_pine": {
            "2-ply 2x6": [6.92, 5.92, 5.33, 4.83, 4.5, 4.25, 4.0],
            "2-ply 2x8": [8.75, 7.58, 6.75, 6.17, 5.75, 5.33, 5.0],
            "2-ply 2x10": [10.33, 9.0, 8.0, 7.33, 6.75, 6.33, 6.0],
            "2-ply 2x12": [12.17, 10.58, 9.42, 8.58, 8.0, 7.42, 7.0],
            "3-ply 2x6": [8.5, 7.42, 6.67, 6.08, 5.67, 5.25, 4.92],
            "3-ply 2x8": [10.92, 9.5, 8.5, 7.75, 7.17, 6.67, 6.33],
            "3-ply 2x10": [13.0, 11.17, 10.0, 9.17, 8.5, 7.92, 7.5],
            "3-ply 2x12": [15.25, 13.25, 11.83, 10.75, 10.0, 9.33, 8.83],
        },
        "dfl_hf_spf": {
            "2-ply 2x6": [6.08, 5.25, 4.75, 4.33, 3.92, 3.58, 3.25],
            "2-ply 2x8": [8.17, 7.08, 6.33, 5.75, 5.17, 4.67, 4.33],
            "2-ply 2x10": [10.0, 8.58, 7.75, 7.0, 6.5, 6.0, 5.5],
            "2-ply 2x12": [11.58, 10.0, 8.92, 8.17, 7.58, 7.08, 6.67],
            "3-ply 2x6": [7.67, 6.67, 6.0, 5.5, 5.08, 4.75, 4.5],
            "3-ply 2x8": [10.25, 8.83, 7.92, 7.25, 6.67, 6.25, 5.92],
            "3-ply 2x10": [12.5, 10.83, 9.67, 8.83, 8.17, 7.67, 7.17],
            "3-ply 2x12": [14.5, 12.58, 11.25, 10.25, 9.5, 8.92, 8.42],
        },
        "redwood_cedar": {
            "2-ply 2x6": [6.17, 5.33, 4.83, 4.42, 4.0, 3.67, 3.33],
            "2-ply 2x8": [7.83, 6.83, 6.08, 5.58, 5.17, 4.83, 4.42],
            "2-ply 2x10": [9.58, 8.33, 7.42, 6.75, 6.25, 5.83, 5.5],
            "2-ply 2x12": [11.08, 9.67, 8.58, 7.83, 7.25, 6.83, 6.42],
            "3-ply 2x6": [7.67, 6.75, 6.0, 5.5, 5.08, 4.75, 4.5],
            "3-ply 2x8": [9.83, 8.5, 7.58, 6.92, 6.42, 6.0, 5.67],
            "3-ply 2x10": [12.0, 10.42, 9.33, 8.5, 7.83, 7.33, 6.92],
            "3-ply 2x12": [13.92, 12.08, 10.75, 9.83, 9.08, 8.5, 8.08],
        },
    },
    # --- TABLE R507.5(2): 50 PSF GROUND SNOW LOAD ---
    50: {
        "southern_pine": {
            "2-ply 2x6": [6.67, 5.75, 5.17, 4.75, 4.33, 4.08, 3.83],
            "2-ply 2x8": [8.5, 7.33, 6.58, 6.0, 5.58, 5.17, 4.92],
            "2-ply 2x10": [10.08, 8.75, 7.83, 7.08, 6.58, 6.17, 5.83],
            "2-ply 2x12": [11.92, 10.25, 9.17, 8.42, 7.75, 7.25, 6.83],
            "3-ply 2x6": [7.92, 7.17, 6.5, 5.92, 5.5, 5.08, 4.83],
            "3-ply 2x8": [10.42, 9.25, 8.25, 7.5, 6.92, 6.5, 6.17],
            "3-ply 2x10": [12.67, 10.92, 9.75, 8.92, 8.25, 7.75, 7.25],
            "3-ply 2x12": [14.92, 12.92, 11.5, 10.5, 9.75, 9.08, 8.58],
        },
        "dfl_hf_spf": {
            "2-ply 2x6": [6.0, 5.17, 4.58, 4.17, 3.83, 3.42, 3.17],
            "2-ply 2x8": [8.0, 6.92, 6.17, 5.67, 5.0, 4.58, 4.17],
            "2-ply 2x10": [9.75, 8.42, 7.58, 6.92, 6.33, 5.83, 5.33],
            "2-ply 2x12": [11.33, 9.83, 8.75, 8.0, 7.42, 6.92, 6.5],
            "3-ply 2x6": [7.5, 6.5, 5.75, 5.25, 4.92, 4.58, 4.33],
            "3-ply 2x8": [10.0, 8.67, 7.75, 7.08, 6.5, 6.08, 5.67],
            "3-ply 2x10": [12.25, 10.58, 9.5, 8.67, 8.0, 7.5, 7.0],
            "3-ply 2x12": [14.25, 12.33, 11.0, 10.08, 9.33, 8.75, 8.25],
        },
        "redwood_cedar": {
            "2-ply 2x6": [6.08, 5.25, 4.67, 4.33, 3.92, 3.5, 3.25],
            "2-ply 2x8": [7.67, 6.67, 5.92, 5.42, 5.0, 4.67, 4.25],
            "2-ply 2x10": [9.42, 8.17, 7.25, 6.67, 6.17, 5.75, 5.42],
            "2-ply 2x12": [10.92, 9.42, 8.42, 7.67, 7.17, 6.67, 6.25],
            "3-ply 2x6": [7.08, 6.42, 5.92, 5.42, 5.0, 4.67, 4.42],
            "3-ply 2x8": [9.33, 8.33, 7.42, 6.83, 6.33, 5.92, 5.58],
            "3-ply 2x10": [11.75, 10.17, 9.08, 8.33, 7.67, 7.17, 6.75],
            "3-ply 2x12": [13.67, 11.83, 10.58, 9.67, 8.92, 8.33, 7.83],
        },
    },
    # --- TABLE R507.5(3): 60 PSF GROUND SNOW LOAD ---
    60: {
        "southern_pine": {
            "2-ply 2x6": [6.17, 5.33, 4.75, 4.33, 4.0, 3.75, 3.58],
            "2-ply 2x8": [7.83, 6.83, 6.08, 5.58, 5.17, 4.83, 4.5],
            "2-ply 2x10": [9.33, 8.08, 7.25, 6.58, 6.08, 5.67, 5.33],
            "2-ply 2x12": [11.0, 9.5, 8.5, 7.75, 7.17, 6.75, 6.33],
            "3-ply 2x6": [7.42, 6.75, 6.0, 5.5, 5.08, 4.75, 4.5],
            "3-ply 2x8": [9.75, 8.5, 7.5, 6.92, 6.42, 6.0, 5.67],
            "3-ply 2x10": [11.67, 10.17, 9.17, 8.25, 7.67, 7.17, 6.75],
            "3-ply 2x12": [13.75, 11.92, 10.67, 9.75, 9.0, 8.42, 7.92],
        },
        "dfl_hf_spf": {
            "2-ply 2x6": [5.5, 4.75, 4.25, 3.83, 3.42, 3.08, 2.83],
            "2-ply 2x8": [7.42, 6.42, 5.75, 5.0, 4.58, 4.08, 3.75],
            "2-ply 2x10": [9.0, 7.83, 7.0, 6.33, 5.75, 5.17, 4.83],
            "2-ply 2x12": [10.5, 9.08, 8.08, 7.42, 6.92, 6.33, 5.83],
            "3-ply 2x6": [6.92, 6.0, 5.33, 4.92, 4.5, 4.17, 3.83],
            "3-ply 2x8": [9.25, 8.0, 7.17, 6.5, 6.08, 5.5, 5.0],
            "3-ply 2x10": [11.33, 9.83, 8.75, 8.0, 7.42, 6.92, 6.42],
            "3-ply 2x12": [13.17, 11.42, 10.17, 9.33, 8.58, 8.08, 7.58],
        },
        "redwood_cedar": {
            "2-ply 2x6": [5.58, 4.83, 4.25, 3.92, 3.5, 3.17, 2.92],
            "2-ply 2x8": [7.08, 6.17, 5.5, 5.0, 4.58, 4.17, 3.83],
            "2-ply 2x10": [8.67, 7.5, 6.75, 6.17, 5.67, 5.25, 4.92],
            "2-ply 2x12": [10.08, 8.75, 7.83, 7.17, 6.67, 6.17, 5.75],
            "3-ply 2x6": [6.67, 5.92, 5.33, 4.83, 4.42, 4.08, 3.75],
            "3-ply 2x8": [8.75, 7.75, 6.92, 6.33, 5.83, 5.42, 5.0],
            "3-ply 2x10": [10.92, 9.42, 8.42, 7.75, 7.17, 6.67, 6.25],
            "3-ply 2x12": [12.67, 10.92, 9.83, 8.92, 8.25, 7.75, 7.25],
        },
    },
    # --- TABLE R507.5(4): 70 PSF GROUND SNOW LOAD ---
    70: {
        "southern_pine": {
            "2-ply 2x6": [5.75, 5.0, 4.5, 4.08, 3.75, 3.5, 3.33],
            "2-ply 2x8": [7.33, 6.33, 5.67, 5.17, 4.83, 4.5, 4.25],
            "2-ply 2x10": [8.75, 7.58, 6.75, 6.17, 5.67, 5.33, 5.0],
            "2-ply 2x12": [10.25, 8.92, 8.0, 7.25, 6.75, 6.25, 5.92],
            "3-ply 2x6": [7.0, 6.25, 5.58, 5.08, 4.75, 4.42, 4.17],
            "3-ply 2x8": [9.25, 8.0, 7.17, 6.5, 6.0, 5.67, 5.33],
            "3-ply 2x10": [10.92, 9.5, 8.5, 7.75, 7.17, 6.67, 6.33],
            "3-ply 2x12": [12.92, 11.17, 10.0, 9.08, 8.42, 7.92, 7.42],
        },
        "dfl_hf_spf": {
            "2-ply 2x6": [5.17, 4.5, 4.0, 3.42, 3.08, 2.83, 2.58],
            "2-ply 2x8": [6.92, 6.0, 5.25, 4.58, 4.08, 3.67, 3.42],
            "2-ply 2x10": [8.42, 7.33, 6.5, 5.83, 5.17, 4.75, 4.42],
            "2-ply 2x12": [9.83, 8.5, 7.58, 6.92, 6.33, 5.75, 5.33],
            "3-ply 2x6": [6.5, 5.58, 5.0, 4.58, 4.17, 3.75, 3.42],
            "3-ply 2x8": [8.67, 7.5, 6.67, 6.08, 5.5, 5.0, 4.58],
            "3-ply 2x10": [10.58, 9.17, 8.17, 7.5, 6.92, 6.33, 5.83],
            "3-ply 2x12": [12.33, 10.67, 9.58, 8.75, 8.08, 7.58, 7.08],
        },
        "redwood_cedar": {
            "2-ply 2x6": [5.25, 4.58, 4.08, 3.5, 3.17, 2.92, 2.67],
            "2-ply 2x8": [6.67, 5.75, 5.17, 4.67, 4.17, 3.83, 3.5],
            "2-ply 2x10": [8.17, 7.08, 6.33, 5.75, 5.33, 4.83, 4.5],
            "2-ply 2x12": [9.42, 8.17, 7.33, 6.67, 6.17, 5.75, 5.42],
            "3-ply 2x6": [6.33, 5.67, 5.08, 4.5, 4.08, 3.75, 3.42],
            "3-ply 2x8": [8.33, 7.25, 6.42, 5.92, 5.42, 5.08, 4.67],
            "3-ply 2x10": [10.17, 8.83, 7.92, 7.17, 6.67, 6.25, 5.92],
            "3-ply 2x12": [11.83, 10.25, 9.17, 8.33, 7.75, 7.25, 6.83],
        },
    },
}


# =============================================================================
# FRONTEND SNAPSHOT  (backend/static/js/engine.js JOIST_SPANS / BEAM_SPANS)
# =============================================================================
# The browser cannot import Python, so engine.js keeps its own hand-maintained
# copy. It has carried ONLY the dfl_hf_spf group since S59 (f98c7ee), when the
# product had no species selector and that was the correct single choice.
# Recorded here so the drift test can assert JS == PY[dfl_hf_spf] cell by cell.

SNAPSHOT_JOIST_SPANS_JS = {
    40: {
        "2x6": {12: 9.5, 16: 8.33, 24: 6.83},
        "2x8": {12: 12.5, 16: 11.08, 24: 9.08},
        "2x10": {12: 15.67, 16: 13.58, 24: 11.08},
        "2x12": {12: 18, 16: 15.75, 24: 12.83},
    },
    50: {
        "2x6": {12: 8.83, 16: 8, 24: 6.67},
        "2x8": {12: 11.58, 16: 10.58, 24: 8.92},
        "2x10": {12: 14.83, 16: 13.25, 24: 10.83},
        "2x12": {12: 17.75, 16: 15.42, 24: 12.58},
    },
    60: {
        "2x6": {12: 8.33, 16: 7.5, 24: 6.17},
        "2x8": {12: 10.92, 16: 9.92, 24: 8.25},
        "2x10": {12: 13.92, 16: 12.33, 24: 10},
        "2x12": {12: 16.5, 16: 14.25, 24: 11.67},
    },
    70: {
        "2x6": {12: 7.92, 16: 7.08, 24: 5.75},
        "2x8": {12: 10.42, 16: 9.42, 24: 7.67},
        "2x10": {12: 13.25, 16: 11.5, 24: 9.42},
        "2x12": {12: 15.42, 16: 13.33, 24: 10.92},
    },
}

SNAPSHOT_BEAM_SPANS_JS = {
    40: {
        "2-ply 2x6": [6.08, 5.25, 4.75, 4.33, 3.92, 3.58, 3.25],
        "2-ply 2x8": [8.17, 7.08, 6.33, 5.75, 5.17, 4.67, 4.33],
        "2-ply 2x10": [10, 8.58, 7.75, 7, 6.5, 6, 5.5],
        "2-ply 2x12": [11.58, 10, 8.92, 8.17, 7.58, 7.08, 6.67],
        "3-ply 2x6": [7.67, 6.67, 6, 5.5, 5.08, 4.75, 4.5],
        "3-ply 2x8": [10.25, 8.83, 7.92, 7.25, 6.67, 6.25, 5.92],
        "3-ply 2x10": [12.5, 10.83, 9.67, 8.83, 8.17, 7.67, 7.17],
        "3-ply 2x12": [14.5, 12.58, 11.25, 10.25, 9.5, 8.92, 8.42],
    },
    50: {
        "2-ply 2x6": [6, 5.17, 4.58, 4.17, 3.83, 3.42, 3.17],
        "2-ply 2x8": [8, 6.92, 6.17, 5.67, 5, 4.58, 4.17],
        "2-ply 2x10": [9.75, 8.42, 7.58, 6.92, 6.33, 5.83, 5.33],
        "2-ply 2x12": [11.33, 9.83, 8.75, 8, 7.42, 6.92, 6.5],
        "3-ply 2x6": [7.5, 6.5, 5.75, 5.25, 4.92, 4.58, 4.33],
        "3-ply 2x8": [10, 8.67, 7.75, 7.08, 6.5, 6.08, 5.67],
        "3-ply 2x10": [12.25, 10.58, 9.5, 8.67, 8, 7.5, 7],
        "3-ply 2x12": [14.25, 12.33, 11, 10.08, 9.33, 8.75, 8.25],
    },
    60: {
        "2-ply 2x6": [5.5, 4.75, 4.25, 3.83, 3.42, 3.08, 2.83],
        "2-ply 2x8": [7.42, 6.42, 5.75, 5, 4.58, 4.08, 3.75],
        "2-ply 2x10": [9, 7.83, 7, 6.33, 5.75, 5.17, 4.83],
        "2-ply 2x12": [10.5, 9.08, 8.08, 7.42, 6.92, 6.33, 5.83],
        "3-ply 2x6": [6.92, 6, 5.33, 4.92, 4.5, 4.17, 3.83],
        "3-ply 2x8": [9.25, 8, 7.17, 6.5, 6.08, 5.5, 5],
        "3-ply 2x10": [11.33, 9.83, 8.75, 8, 7.42, 6.92, 6.42],
        "3-ply 2x12": [13.17, 11.42, 10.17, 9.33, 8.58, 8.08, 7.58],
    },
    70: {
        "2-ply 2x6": [5.17, 4.5, 4, 3.42, 3.08, 2.83, 2.58],
        "2-ply 2x8": [6.92, 6, 5.25, 4.58, 4.08, 3.67, 3.42],
        "2-ply 2x10": [8.42, 7.33, 6.5, 5.83, 5.17, 4.75, 4.42],
        "2-ply 2x12": [9.83, 8.5, 7.58, 6.92, 6.33, 5.75, 5.33],
        "3-ply 2x6": [6.5, 5.58, 5, 4.58, 4.17, 3.75, 3.42],
        "3-ply 2x8": [8.67, 7.5, 6.67, 6.08, 5.5, 5, 4.58],
        "3-ply 2x10": [10.58, 9.17, 8.17, 7.5, 6.92, 6.33, 5.83],
        "3-ply 2x12": [12.33, 10.67, 9.58, 8.75, 8.08, 7.58, 7.08],
    },
}
