#!/usr/bin/env python3
"""S88 B9 regression: numeric frostZone / snowLoad must resolve consistently.

The bug (found by the S87 fuzz generator): calc_engine and permit_checker
each did TABLE.get(value, <own default>) on frostZone / snowLoad. The wizard
always sends category STRINGS, but a non-UI caller (API, AI helper, future
code) can send a NUMBER -- which missed the table and fell to DIFFERENT
defaults on each side (frost calc 30" vs checker 36"), a silent calc-vs-
checker mismatch with no error. Fix: resolve_frost_depth / resolve_snow_load
are the single source of truth; a number is taken literally, a category is
looked up, and both sides call the same resolver.

This test locks in: (1) numeric == literal, (2) category == table, (3) the
frost DEPTH the calc uses equals the depth the checker requires for the SAME
input (the exact thing that silently diverged), for both category and numeric.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from drawing.calc_engine import (
    resolve_frost_depth, resolve_snow_load,
    FROST_DEPTHS, SNOW_LOADS,
)

failures = []


def check(name, cond, detail=""):
    if cond:
        print(f"  ok   {name}")
    else:
        print(f"  FAIL {name}  {detail}")
        failures.append(name)


# 1. Numbers are taken literally (inches / psf), including numeric strings.
check("frost numeric int", resolve_frost_depth(42) == 42.0)
check("frost numeric float", resolve_frost_depth(30.5) == 30.5)
check("frost numeric string", resolve_frost_depth("42") == 42.0)
check("snow numeric int", resolve_snow_load(55) == 55.0)
check("snow numeric string", resolve_snow_load("55") == 55.0)

# 2. Categories look up the table exactly.
for cat, val in FROST_DEPTHS.items():
    check(f"frost cat {cat}", resolve_frost_depth(cat) == val)
for cat, val in SNOW_LOADS.items():
    check(f"snow cat {cat}", resolve_snow_load(cat) == val)

# 3. Unknown falls to the shared default (never raises, never None).
check("frost unknown -> 36", resolve_frost_depth("bogus") == 36)
check("snow unknown -> 0", resolve_snow_load("bogus") == 0)
check("frost None -> 36", resolve_frost_depth(None) == 36)
check("snow None -> 0", resolve_snow_load(None) == 0)

# 4. Booleans are NOT numbers (would be a nasty silent coercion).
check("frost True not numeric", resolve_frost_depth(True) == 36)

# 5. THE BUG ITSELF: calc-side depth == checker-side required depth for the
#    same frostZone input, for BOTH a category and a raw number. Before the
#    fix, the number path diverged (30 vs 36).
from drawing.permit_checker import check_footing_frost


def required_from_checker(frost_value, footing_depth):
    params = {"frostZone": frost_value}
    calc = {"footing_depth": footing_depth}
    res = check_footing_frost(params, calc, {})
    # detail string embeds "frost line at {required}\""
    import re
    m = re.search(r"frost line at (\d+(?:\.\d+)?)", res.detail)
    return float(m.group(1))


for frost_value in ["cold", "severe", 42, 30, "42"]:
    calc_depth = resolve_frost_depth(frost_value)
    checker_req = required_from_checker(frost_value, footing_depth=99)
    check(f"calc==checker frost for {frost_value!r}",
          calc_depth == checker_req,
          f"calc={calc_depth} checker={checker_req}")

# 6. End-to-end: a numeric frostZone that is DEEPER than the drawn footing
#    now correctly FAILS the frost check (before, 40" numeric was read as the
#    unknown->36 default on the calc side and could mis-pass).
res = check_footing_frost({"frostZone": 48}, {"footing_depth": 36}, {})
check("numeric frost 48 vs 36 footing -> fail", res.status == "fail",
      f"got {res.status}")
res = check_footing_frost({"frostZone": 24}, {"footing_depth": 36}, {})
check("numeric frost 24 vs 36 footing -> pass", res.status == "pass",
      f"got {res.status}")

print()
if failures:
    print(f"B9 NORMALIZE: {len(failures)} FAILURE(S)")
    sys.exit(1)
print("B9 NORMALIZE: all frost/snow normalization checks passed")
