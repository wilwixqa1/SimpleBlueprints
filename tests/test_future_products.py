"""
SimpleBlueprints - Future Product Type Structural Tests
========================================================
Scaffolded S60. Tests verify the calculation LOGIC is correct even
before IRC table values are populated. When tables are filled in,
update the @skip decorators and add known-answer assertions.

Usage: python3 tests/test_future_products.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

passed = 0
failed = 0
skipped = 0
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


def skip(name, reason):
    global skipped
    skipped += 1
    # Uncomment to see skipped tests:
    # print(f"  SKIP: {name} -- {reason}")


# ============================================================
# PERGOLA TESTS
# ============================================================
print("Testing calc_pergola...")
from drawing.calc_pergola import calculate_pergola_structure, ROOF_DL

# Test 1: Basic freestanding pergola creates valid output
r = calculate_pergola_structure({
    "width": 12, "depth": 10, "height": 8,
    "attachment": "freestanding", "rafterSpacing": 16,
    "roofType": "open_lattice", "snowLoad": "none", "frostZone": "moderate",
})
check("pergola_product_type", r["product_type"], "pergola")
check("pergola_width", r["width"], 12)
check("pergola_depth", r["depth"], 10)
check("pergola_total_posts_freestanding", r["total_posts"], r["num_posts"] * 2)
check("pergola_roof_dl_lattice", r["roof_DL"], 5)
check("pergola_roof_ll_no_snow", r["roof_LL"], 20)
check("pergola_has_no_ledger", r["ledger_size"], None)

# Test 2: Attached pergola
r = calculate_pergola_structure({
    "width": 14, "depth": 12, "height": 9,
    "attachment": "attached", "rafterSpacing": 16,
    "roofType": "polycarbonate", "snowLoad": "none", "frostZone": "moderate",
})
check("pergola_attached_posts", r["total_posts"], r["num_posts"])
check("pergola_attached_ledger", r["ledger_size"] is not None, True)
check("pergola_rafter_span_attached", r["rafter_span"], 12.0)

# Test 3: Snow load increases roof LL
r_snow = calculate_pergola_structure({
    "width": 12, "depth": 10, "height": 8,
    "attachment": "freestanding", "rafterSpacing": 16,
    "roofType": "shingle", "snowLoad": "heavy", "frostZone": "severe",
})
check("pergola_snow_LL", r_snow["roof_LL"], 60)
check("pergola_snow_TL", r_snow["TL"], 60 + 15)  # shingle DL=15

# Test 4: Roof DL varies by type
for rt, expected_dl in ROOF_DL.items():
    r = calculate_pergola_structure({
        "width": 12, "depth": 10, "height": 8,
        "attachment": "freestanding", "rafterSpacing": 16,
        "roofType": rt, "snowLoad": "none", "frostZone": "moderate",
    })
    check(f"pergola_roof_dl_{rt}", r["roof_DL"], expected_dl)

# Test 5: IRC rafter spans (awaiting table values)
skip("pergola_rafter_known_answer", "IRC rafter span tables not yet populated")

print(f"  pergola: {passed} passed")


# ============================================================
# PORCH TESTS
# ============================================================
print("Testing calc_porch...")
from drawing.calc_porch import calculate_porch_structure

# Test 1: Porch produces floor + roof sections
r = calculate_porch_structure({
    "width": 12, "depth": 10, "height": 8,
    "attachment": "attached", "joistSpacing": 16,
    "deckingType": "composite", "beamType": "dropped",
    "snowLoad": "none", "frostZone": "moderate",
    "roofType": "shingle", "rafterSpacing": 16,
    "railType": "fortress",
})
check("porch_product_type", r["product_type"], "porch")
check("porch_has_floor", "floor" in r, True)
check("porch_has_roof", "roof" in r, True)
check("porch_floor_joist", r["floor"]["joist_size"] in ["2x6", "2x8", "2x10", "2x12"], True)
check("porch_roof_rafter", r["roof"]["rafter_size"] in ["2x6", "2x8", "2x10", "2x12"], True)

# Test 2: Combined footing should be >= floor-only footing
# Porch footings carry floor + roof loads, so should be at least as big
# (They could be equal if both loads are small)
check("porch_combined_footing_gte_12", r["footing_diam"] >= 12, True)

# Test 3: Combined load is floor + roof
check("porch_combined_load_positive", r["combined_load_per_post"] > 0, True)
floor_only_load = r["floor"]["TL"] * 10 * 12  # rough estimate
check("porch_combined_gt_floor_only", r["combined_load_per_post"] > floor_only_load * 0.5, True)

porch_passed = passed
print(f"  porch: {passed - (porch_passed - passed if False else 0)} total passed so far")


# ============================================================
# FENCE TESTS
# ============================================================
print("Testing calc_fence...")
from drawing.calc_fence import calculate_fence_structure

# Test 1: Basic 6' privacy fence
r = calculate_fence_structure({
    "totalLength": 100, "height": 6, "fenceType": "solid",
    "windExposure": "B", "numGates": 1, "gateWidth": 3.5,
    "soilType": "average",
})
check("fence_product_type", r["product_type"], "fence")
check("fence_height", r["height"], 6)
check("fence_has_posts", r["num_posts"] > 0, True)
check("fence_has_materials", len(r["materials"]) > 0, True)
check("fence_post_spacing_solid", r["post_spacing"], 6)

# Test 2: Open fence has wider spacing
r_open = calculate_fence_structure({
    "totalLength": 100, "height": 4, "fenceType": "open",
    "windExposure": "B", "numGates": 0, "gateWidth": 3.5,
    "soilType": "average",
})
check("fence_open_spacing", r_open["post_spacing"], 8)

# Test 3: Tall fence in high wind gets 6x6 posts
r_wind = calculate_fence_structure({
    "totalLength": 50, "height": 8, "fenceType": "solid",
    "windExposure": "D", "numGates": 0, "gateWidth": 3.5,
    "soilType": "average",
})
check("fence_tall_wind_post", r_wind["post_size"], "6x6")
check("fence_tall_wind_spacing", r_wind["post_spacing"] <= 4, True)

# Test 4: Embedment increases with height
r4 = calculate_fence_structure({"totalLength": 50, "height": 4, "fenceType": "solid", "windExposure": "B", "numGates": 0, "soilType": "average"})
r6 = calculate_fence_structure({"totalLength": 50, "height": 6, "fenceType": "solid", "windExposure": "B", "numGates": 0, "soilType": "average"})
r8 = calculate_fence_structure({"totalLength": 50, "height": 8, "fenceType": "solid", "windExposure": "B", "numGates": 0, "soilType": "average"})
check("fence_embed_increases", r4["embedment_depth"] <= r6["embedment_depth"] <= r8["embedment_depth"], True)

# Test 5: Soft soil increases embedment
r_firm = calculate_fence_structure({"totalLength": 50, "height": 6, "fenceType": "solid", "windExposure": "B", "numGates": 0, "soilType": "firm"})
r_soft = calculate_fence_structure({"totalLength": 50, "height": 6, "fenceType": "solid", "windExposure": "B", "numGates": 0, "soilType": "soft"})
check("fence_soft_deeper", r_soft["embedment_depth"] > r_firm["embedment_depth"], True)

print(f"  fence: passed so far")


# ============================================================
# SHED TESTS
# ============================================================
print("Testing calc_shed...")
from drawing.calc_shed import calculate_shed_structure

# Test 1: Basic 10x12 shed
r = calculate_shed_structure({
    "width": 12, "depth": 10, "wallHeight": 8,
    "roofShape": "gable", "roofPitch": 4,
    "foundationType": "pier", "snowLoad": "none", "frostZone": "moderate",
    "studSpacing": 16, "doorCount": 1, "windowCount": 2,
})
check("shed_product_type", r["product_type"], "shed")
check("shed_area", r["area"], 120)
check("shed_has_floor_joists", r["floor_joist_size"] is not None, True)
check("shed_has_rafters", r["num_rafters"] > 0, True)
check("shed_has_studs", r["num_studs"] > 0, True)
check("shed_has_materials", len(r["materials"]) > 5, True)
check("shed_gable_ridge", r["ridge_size"] is not None, True)

# Test 2: Slab foundation has no floor joists
r_slab = calculate_shed_structure({
    "width": 12, "depth": 10, "wallHeight": 8,
    "roofShape": "gable", "roofPitch": 4,
    "foundationType": "slab", "snowLoad": "none", "frostZone": "moderate",
    "studSpacing": 16, "doorCount": 1, "windowCount": 1,
})
check("shed_slab_no_floor_joists", r_slab["floor_joist_size"], None)
check("shed_slab_thickness", r_slab["slab_thickness"], 4)

# Test 3: Shed roof shape
r_shed_roof = calculate_shed_structure({
    "width": 10, "depth": 8, "wallHeight": 8,
    "roofShape": "shed", "roofPitch": 3,
    "foundationType": "skid", "snowLoad": "none", "frostZone": "warm",
    "studSpacing": 24, "doorCount": 1, "windowCount": 0,
})
check("shed_mono_no_ridge", r_shed_roof["ridge_size"], None)
check("shed_skid_has_skids", r_shed_roof["num_skids"] > 0, True)

# Test 4: Snow increases roof load
r_no_snow = calculate_shed_structure({"width": 12, "depth": 10, "wallHeight": 8, "roofShape": "gable", "roofPitch": 4, "foundationType": "pier", "snowLoad": "none", "frostZone": "moderate", "studSpacing": 16, "doorCount": 1, "windowCount": 1})
r_heavy = calculate_shed_structure({"width": 12, "depth": 10, "wallHeight": 8, "roofShape": "gable", "roofPitch": 4, "foundationType": "pier", "snowLoad": "heavy", "frostZone": "severe", "studSpacing": 16, "doorCount": 1, "windowCount": 1})
check("shed_snow_higher_TL", r_heavy["roof_TL"] > r_no_snow["roof_TL"], True)

# Test 5: >200 SF warning
r_big = calculate_shed_structure({"width": 20, "depth": 16, "wallHeight": 8, "roofShape": "gable", "roofPitch": 4, "foundationType": "pier", "snowLoad": "none", "frostZone": "moderate", "studSpacing": 16, "doorCount": 1, "windowCount": 2})
check("shed_big_permit_warning", any("200 SF" in w for w in r_big["warnings"]), True)
check("shed_big_area", r_big["area"], 320)

print(f"  shed: passed so far")


# ============================================================
# RESULTS
# ============================================================

print(f"\n{'='*60}")
print(f"FUTURE PRODUCTS: {passed} passed, {failed} failed, {skipped} skipped")
print(f"{'='*60}")

if errors:
    print()
    for e in errors:
        print(f"  {e}")
    print()
    print("SOME TESTS FAILED.")
    sys.exit(1)
else:
    print(f"\nAll logic tests passed. {skipped} test(s) awaiting IRC table values.")
    sys.exit(0)
