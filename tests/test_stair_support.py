"""S100: tests for the dedicated stair support assembly.

The IRC has no prescriptive table for framing that carries stairs, so this
module encodes the accepted field detail (two footings, two posts, a header the
stringers bear on) plus an explicit boundary where it stops being valid.

Run: python3 tests/test_stair_support.py
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from drawing.stair_support import (  # noqa: E402
    compute_stair_support, compute_all_stair_supports, stair_top_reaction,
    stair_run_length, select_header_size, HEADER_BEARING_EACH_SIDE,
    MAX_PRESCRIPTIVE_REACTION_LB,
)
from drawing.stair_utils import compute_stair_geometry  # noqa: E402

failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)


def geo(template="straight", height=4.0, sw=4, ns=3):
    return compute_stair_geometry(template=template, height=height,
                                  stair_width=sw, num_stringers=ns)


# ---- 1. Header straddles the stair, so posts never sit in the stairway -----
# This is the whole point of the detail: the stair opening stays clear.
for sw in [3, 4, 5, 6]:
    for ang in [0, 90, 180, 270]:
        s = compute_stair_support(20.0, 12.0, ang, sw, geometry=geo(sw=sw),
                                  total_rise=4.0, deck_height=4.0)
        for p in s["posts"]:
            if ang in (0, 180):
                inside = (20.0 - sw / 2.0) < p["x"] < (20.0 + sw / 2.0)
            else:
                inside = (12.0 - sw / 2.0) < p["y"] < (12.0 + sw / 2.0)
            check(not inside,
                  "sw=%s ang=%s: post at (%s,%s) sits inside the stairway"
                  % (sw, ang, p["x"], p["y"]))

# ---- 2. Header spans the clear width plus bearing each side ----------------
for sw in [3, 4, 5, 6]:
    s = compute_stair_support(20.0, 12.0, 0, sw, geometry=geo(sw=sw),
                              total_rise=4.0)
    span = s["header"]["clear_span"]
    expect = sw + 2 * HEADER_BEARING_EACH_SIDE
    check(abs(span - expect) < 1e-6,
          "sw=%s: header clear span %.2f, expected %.2f" % (sw, span, expect))
    hx = abs(s["header"]["x1"] - s["header"]["x0"])
    check(abs(hx - expect) < 1e-6,
          "sw=%s: header geometric length %.2f != clear span %.2f" % (sw, hx, expect))

# ---- 3. Two posts, two footings, footings under posts ---------------------
s = compute_stair_support(20.0, 12.0, 0, 4, geometry=geo(), total_rise=4.0)
check(len(s["posts"]) == 2, "expected 2 posts, got %d" % len(s["posts"]))
check(len(s["footings"]) == 2, "expected 2 footings, got %d" % len(s["footings"]))
for p, f in zip(s["posts"], s["footings"]):
    check(abs(p["x"] - f["x"]) < 1e-9 and abs(p["y"] - f["y"]) < 1e-9,
          "footing not under its post")

# ---- 4. Reaction grows with stair size, and is never negative -------------
prev = -1.0
for h in [2, 4, 6, 8, 10, 13]:
    r = stair_top_reaction(4, geo(height=float(h)), total_rise=float(h))
    check(r > 0, "rise %s: non-positive reaction %s" % (h, r))
    check(r >= prev, "rise %s: reaction %s decreased from %s" % (h, r, prev))
    prev = r

prev = -1.0
for sw in [3, 4, 5, 6]:
    r = stair_top_reaction(sw, geo(sw=sw, height=8.0), total_rise=8.0)
    check(r >= prev, "width %s: reaction %s decreased from %s" % (sw, r, prev))
    prev = r

# ---- 5. Ordinary residential stairs stay inside the prescriptive detail ----
# If routine configs trip the engineer flag, the calibration is wrong.
for h in [2, 4, 6, 8, 10, 13]:
    for sw in [3, 4, 5]:
        s = compute_stair_support(20.0, 12.0, 0, sw, geometry=geo(sw=sw, height=float(h)),
                                  total_rise=float(h), deck_height=float(h))
        check(not s["needs_engineer"],
              "routine config rise=%s width=%s flagged for engineering: %s"
              % (h, sw, s["reason"]))

# ---- 6. The boundary actually triggers ------------------------------------
# A very wide stair exceeds the header table.
s = compute_stair_support(20.0, 12.0, 0, 12, geometry=geo(sw=12, height=8.0),
                          total_rise=8.0)
check(s["needs_engineer"], "12ft-wide stair should require engineering")
check(s["reason"] is not None, "needs_engineer set without a reason")

# A very tall, very wide stair exceeds the reaction ceiling.
big = stair_top_reaction(10, geo(sw=10, height=20.0), total_rise=20.0)
check(big > MAX_PRESCRIPTIVE_REACTION_LB,
      "expected a config above the prescriptive reaction ceiling, got %s" % big)

# ---- 7. Header size is monotonic in span ----------------------------------
sizes = [select_header_size(sp) for sp in [3.0, 4.0, 5.0, 6.0, 7.0, 8.0]]
check(all(x is not None for x in sizes), "header table gap inside 3-8ft")
check(sizes == sorted(sizes, key=lambda s: int(s.split("x")[-1])),
      "header sizes not monotonic in span: %s" % sizes)

# ---- 8. Transitional stairs are skipped -----------------------------------
resolved = [
    {"stair": {"id": 1, "width": 4}, "world_anchor_x": 10.0, "world_anchor_y": 12.0,
     "angle": 0, "geometry": geo(),
     "elevation_info": {"isTransitional": False, "totalRise": 4.0}},
    {"stair": {"id": 2, "width": 4}, "world_anchor_x": 20.0, "world_anchor_y": 12.0,
     "angle": 0, "geometry": geo(),
     "elevation_info": {"isTransitional": True, "totalRise": 2.0}},
]
out = compute_all_stair_supports(resolved, deck_height=4.0)
check(len(out) == 1, "transitional stair should be skipped, got %d assemblies" % len(out))
check(out[0]["stair_id"] == 1, "wrong stair kept")

# ---- 9. No stairs -> no assemblies ----------------------------------------
check(compute_all_stair_supports([], deck_height=4.0) == [], "empty input should give []")
check(compute_all_stair_supports(None, deck_height=4.0) == [], "None input should give []")

# ---- 10. Missing geometry falls back to a rise-based estimate -------------
r = stair_top_reaction(4, None, total_rise=6.0)
check(r > 0, "fallback reaction should be positive when geometry is absent")

print("")
if failures:
    for f in failures:
        print("  [FAIL] " + f)
    print("STAIR SUPPORT: %d FAILURES" % len(failures))
    sys.exit(1)
print("STAIR SUPPORT: all checks passed")
