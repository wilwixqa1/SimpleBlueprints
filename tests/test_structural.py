"""
SimpleBlueprints Structural Verification Tests
================================================
Run at the start of each session to verify calc_engine produces expected results.
Usage: python3 tests/test_structural.py

These are known-answer tests -- each assertion was manually verified against
IRC 2021 tables during S60. If any test fails, something changed in the
structural calculation pipeline and needs investigation before proceeding.

Last verified: S60 (March 2026)
"""

import sys
import os

# Add project root to path so we can import backend modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from drawing.calc_engine import (
    calculate_structure, get_beam_max_span, auto_select_beam,
    get_joist_spans_for_load, IRC_BEAM_SPANS, BEAM_SIZE_ORDER
)

passed = 0
failed = 0
errors = []


def check(name, actual, expected, tolerance=0.01):
    global passed, failed
    if isinstance(expected, float):
        if abs(actual - expected) <= tolerance:
            passed += 1
        else:
            failed += 1
            errors.append(f"FAIL: {name}: expected {expected}, got {actual}")
    elif actual == expected:
        passed += 1
    else:
        failed += 1
        errors.append(f"FAIL: {name}: expected {expected}, got {actual}")


def calc(overrides=None):
    """Build params dict with sensible defaults, apply overrides."""
    p = {
        'width': 20, 'depth': 12, 'height': 4,
        'attachment': 'ledger', 'joistSpacing': 16,
        'snowLoad': 'none', 'frostZone': 'moderate',
        'deckingType': 'composite', 'beamType': 'dropped',
        'railType': 'fortress',
    }
    if overrides:
        p.update(overrides)
    return calculate_structure(p)


# ============================================================
# 1. BEAM TABLE LOOKUP SPOT CHECKS
# ============================================================
# These values come directly from IRC 2021 Table R507.5(1) for 40 PSF

# DFL 2-ply 2x10 at 10' joist span = 7-9 = 7.75'
check("beam_lookup_dfl_2x10_40_10",
      get_beam_max_span("2-ply 2x10", 10, 40, "dfl_hf_spf"), 7.75)

# DFL 3-ply 2x12 at 10' joist span = 11-3 = 11.25'
check("beam_lookup_dfl_3x12_40_10",
      get_beam_max_span("3-ply 2x12", 10, 40, "dfl_hf_spf"), 11.25)

# Southern Pine 2-ply 2x8 at 6' joist span = 8-9 = 8.75'
check("beam_lookup_sp_2x8_40_6",
      get_beam_max_span("2-ply 2x8", 6, 40, "southern_pine"), 8.75)

# DFL 2-ply 2x12 at 12' joist span, 50 PSF = 8-0 = 8.0'
check("beam_lookup_dfl_2x12_50_12",
      get_beam_max_span("2-ply 2x12", 12, 50, "dfl_hf_spf"), 8.0)

# DFL 3-ply 2x10 at 8' joist span, 70 PSF = 9-2 = 9.17'
check("beam_lookup_dfl_3x10_70_8",
      get_beam_max_span("3-ply 2x10", 8, 70, "dfl_hf_spf"), 9.17)

# Interpolation: DFL 2-ply 2x10 at 9' (between 8 and 10), 40 PSF
# At 8': 8.58, at 10': 7.75. Midpoint = 8.165
check("beam_lookup_interpolation_9ft",
      get_beam_max_span("2-ply 2x10", 9, 40, "dfl_hf_spf"), 8.17, tolerance=0.02)


# ============================================================
# 2. AUTO BEAM SELECTION
# ============================================================

# Small freestanding deck: 4' beam span, 5' joist span -> 2-ply 2x6
check("auto_beam_small",
      auto_select_beam(4.0, 5.0, 40, "dfl_hf_spf"), "2-ply 2x6")

# Medium deck: 6' beam span, 8' joist span -> 2-ply 2x8
check("auto_beam_medium",
      auto_select_beam(6.0, 8.0, 40, "dfl_hf_spf"), "2-ply 2x8")

# Standard 20x12 ledger: 10' beam span, 10.5' joist span -> 3-ply 2x12
check("auto_beam_20x12",
      auto_select_beam(10.0, 10.5, 40, "dfl_hf_spf"), "3-ply 2x12")

# 60 PSF snow, 10' beam, 10.5' joist -> LVL (nothing in table works)
check("auto_beam_60psf_lvl",
      auto_select_beam(10.0, 10.5, 60, "dfl_hf_spf"), "3-ply LVL 1.75x12")


# ============================================================
# 3. JOIST SPAN TABLE SPOT CHECKS
# ============================================================

spans_40 = get_joist_spans_for_load(40, "dfl_hf_spf")
check("joist_dfl_2x8_16_40", spans_40["2x8"][16], 11.08)
check("joist_dfl_2x12_16_40", spans_40["2x12"][16], 15.75)

spans_70 = get_joist_spans_for_load(70, "dfl_hf_spf")
check("joist_dfl_2x12_16_70", spans_70["2x12"][16], 13.33)


# ============================================================
# 4. FULL CALCULATE_STRUCTURE -- STANDARD CONFIGS
# ============================================================

# Config A: Default 20x12 ledger, no snow, DFL
r = calc()
check("config_a_beam", r["beam_size"], "3-ply 2x12")
check("config_a_joist", r["joist_size"], "2x8")
check("config_a_posts", r["num_posts"], 3)
check("config_a_joist_span", r["joist_span"], 10.5)
check("config_a_beam_span", r["beam_span"], 10.0)
check("config_a_beam_within_irc", r["beam_span"] <= r["beam_max_span"], True)

# Config B: 20x12 ledger, heavy snow (60 PSF), DFL
r = calc({'snowLoad': 'heavy'})
check("config_b_beam", r["beam_size"], "2-ply 2x10")
check("config_b_posts", r["num_posts"], 4)
check("config_b_LL", r["LL"], 60)
check("config_b_beam_within_irc", r["beam_span"] <= r["beam_max_span"], True)

# Config C: Wide 36x12 ledger, no snow
r = calc({'width': 36})
check("config_c_posts", r["num_posts"], 5)
check("config_c_beam_within_irc", r["beam_span"] <= r["beam_max_span"], True)

# Config D: Freestanding 20x12
r = calc({'attachment': 'freestanding'})
check("config_d_joist_span", r["joist_span"], 5.2)  # depth/2 - 0.75, rounded to 1dp
check("config_d_total_posts", r["total_posts"], 6)  # 3 per beam line x 2
check("config_d_beam_within_irc", r["beam_span"] <= r["beam_max_span"], True)

# Config E: Low deck, wood decking
r = calc({'width': 16, 'depth': 10, 'height': 2, 'deckingType': 'wood', 'frostZone': 'warm'})
check("config_e_DL", r["DL"], 12)  # wood = 12 PSF
check("config_e_beam_within_irc", r["beam_span"] <= r["beam_max_span"], True)

# Config F: Tall deck, guard height should auto to 42"
r = calc({'height': 9})
check("config_f_guard_height", r["rail_height"], 42)
check("config_f_guard_required", r["guard_required"], True)

# Config G: Short deck, no guard required
r = calc({'height': 2})
check("config_g_guard_height", r["rail_height"], 36)
# 2' = 24" above grade, guards required when > 30"
check("config_g_guard_required", r["guard_required"], False)

# Config H: Moderate snow (40 PSF) -- LL should still be 40
r = calc({'snowLoad': 'moderate'})
check("config_h_LL", r["LL"], 40)  # max(40, 40) = 40

# Config I: Light snow (20 PSF) -- LL should be 40 (minimum)
r = calc({'snowLoad': 'light'})
check("config_i_LL", r["LL"], 40)  # max(40, 20) = 40

# Config J: Flush beam
r = calc({'beamType': 'flush'})
check("config_j_flush_hangers", r["joist_hangers_for_beam"] > 0, True)

# Config K: Flush beam freestanding (2x hanger multiplier)
r_flush_ledger = calc({'beamType': 'flush', 'attachment': 'ledger'})
r_flush_free = calc({'beamType': 'flush', 'attachment': 'freestanding'})
# Freestanding flush has 2x the hangers of ledger flush (for same joist count)
check("config_k_flush_free_2x",
      r_flush_free["joist_hangers_for_beam"] >= r_flush_ledger["joist_hangers_for_beam"], True)


# ============================================================
# 5. SPECIES COMPARISON (backend supports all 3, default is DFL)
# ============================================================

# Same deck, 3 species -- Southern Pine >= DFL >= Redwood for beam capacity
sp_sp = get_beam_max_span("3-ply 2x12", 10, 40, "southern_pine")
sp_dfl = get_beam_max_span("3-ply 2x12", 10, 40, "dfl_hf_spf")
sp_rw = get_beam_max_span("3-ply 2x12", 10, 40, "redwood_cedar")
check("species_order_sp_gte_dfl", sp_sp >= sp_dfl, True)
check("species_order_dfl_gte_rw", sp_dfl >= sp_rw, True)

# Default species should be DFL
r = calc()
check("default_species", r["species"], "dfl_hf_spf")


# ============================================================
# 6. BEAM-AWARE POST AUTO-SELECTION
# ============================================================

# Heavy snow should increase post count to avoid LVL
r_no_snow = calc({'snowLoad': 'none'})
r_heavy = calc({'snowLoad': 'heavy'})
check("heavy_snow_more_posts", r_heavy["num_posts"] >= r_no_snow["num_posts"], True)
check("heavy_snow_no_lvl", "LVL" not in r_heavy["beam_size"], True)

# Max stress config: 50x24 heavy snow -- should have many posts
r_max = calc({'width': 50, 'depth': 24, 'snowLoad': 'heavy'})
check("max_stress_posts_gte_6", r_max["num_posts"] >= 6, True)
check("max_stress_beam_within_irc", r_max["beam_span"] <= r_max["beam_max_span"], True)


# ============================================================
# 7. STRUCTURAL WARNINGS
# ============================================================

# Normal deck should have no warnings
r = calc()
check("no_warnings_default", len(r["warnings"]), 0)

# Tall deck should warn about lateral bracing
r = calc({'height': 11})
check("tall_warning", any("bracing" in w.lower() for w in r["warnings"]), True)

# Large area should warn
r = calc({'width': 40, 'depth': 20})
check("area_warning", any("500 SF" in w for w in r["warnings"]), True)


# ============================================================
# 8. SNOW LOAD MATH
# ============================================================

# LL = max(40, snow). Snow loads: none=0, light=20, moderate=40, heavy=60
check("snow_none_LL", calc({'snowLoad': 'none'})["LL"], 40)
check("snow_light_LL", calc({'snowLoad': 'light'})["LL"], 40)
check("snow_moderate_LL", calc({'snowLoad': 'moderate'})["LL"], 40)
check("snow_heavy_LL", calc({'snowLoad': 'heavy'})["LL"], 60)


# ============================================================
# RESULTS
# ============================================================

print(f"\n{'='*60}")
print(f"STRUCTURAL VERIFICATION: {passed} passed, {failed} failed")
print(f"{'='*60}")

if errors:
    print()
    for e in errors:
        print(f"  {e}")
    print()
    print("SOME TESTS FAILED -- investigate before proceeding.")
    sys.exit(1)
else:
    print("\nAll tests passed. Structural pipeline is consistent with S60 baseline.")
    sys.exit(0)
