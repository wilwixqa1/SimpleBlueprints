"""S100: tests for stair support detailing.

Every assertion here traces to an APPROVED Rutstein permit set, not to a rule
we invented:

  Ilaria  -- wood, straight stair to grade, NO stair posts, 4in concrete pad,
             stringer notched for PT plate.
  Welborn -- steel Fortress, straight stairs to grade, NO stair posts,
             stringer anchor brackets + straps.
  Loucks  -- wood, switchback with an ELEVATED landing carried on 4x4 PT
             posts w/ ABU44Z base + BCS2-2/4 cap, (4) PLCS.

Run: python3 tests/test_stair_support.py
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from drawing.stair_support import (  # noqa: E402
    compute_stair_support, compute_all_stair_supports, stair_top_reaction,
    landing_post_xy, MAX_PRESCRIPTIVE_REACTION_LB,
    LANDING_POST_SIZE_WOOD, LANDING_POST_BASE_WOOD, LANDING_POST_CAP_WOOD,
    GRADE_PAD_MIN_THICKNESS_IN, STAIR_BRACKET_STEEL,
)
from drawing.stair_utils import compute_stair_geometry  # noqa: E402

failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)


def geo(template="straight", height=6.0, sw=4, ns=3):
    return compute_stair_geometry(template=template, height=height,
                                  stair_width=sw, num_stringers=ns)


# ---- 1. ILARIA / WELBORN: a straight run to grade gets NO posts ------------
# This is the majority case and the one an earlier revision got wrong by
# inventing a two-post header assembly that appears in none of the sets.
for h in [2, 4, 6, 8, 10, 13]:
    for sw in [3, 4, 5]:
        for ang in [0, 90, 180, 270]:
            s = compute_stair_support(20.0, 12.0, ang, sw,
                                      geometry=geo(height=float(h), sw=sw),
                                      total_rise=float(h), deck_height=float(h))
            check(s["kind"] == "grade_pad",
                  "straight h=%s sw=%s ang=%s: kind=%s, expected grade_pad"
                  % (h, sw, ang, s["kind"]))
            check(s["landings"] == [],
                  "straight h=%s sw=%s: expected no landings, got %d"
                  % (h, sw, len(s["landings"])))
            check(landing_post_xy([s]) == [],
                  "straight h=%s sw=%s: a straight stair to grade must add NO posts"
                  % (h, sw))
            check(s["grade_pad"] is not None, "grade stair should specify a pad")
            check(s["grade_pad"]["min_thickness_in"] == GRADE_PAD_MIN_THICKNESS_IN,
                  "pad thickness should match the Ilaria detail")

# ---- 2. There is no header anywhere in the output -------------------------
# The header/two-post detail came from a retrofit article, not a permit set.
s = compute_stair_support(20.0, 12.0, 0, 4, geometry=geo(), total_rise=6.0)
check("header" not in s, "output must not contain a header detail")
for lnd in s.get("landings") or []:
    check("header" not in lnd, "landing must not contain a header detail")

# ---- 3. LOUCKS: an elevated landing gets four corner posts ----------------
for template in ["lLeft", "lRight", "switchback", "wideLanding"]:
    g = geo(template=template, height=6.0)
    s = compute_stair_support(20.0, 12.0, 0, 4, geometry=g, total_rise=6.0,
                              deck_height=6.0)
    check(s["kind"] == "elevated_landing",
          "%s: kind=%s, expected elevated_landing" % (template, s["kind"]))
    check(len(s["landings"]) == len(g["landings"]),
          "%s: landing count mismatch" % template)
    for lnd in s["landings"]:
        # At the Loucks width (4ft switchback -> 8.5ft landing) the detail is
        # exactly (4) PLCS. Wider landings add intermediate posts in pairs.
        check(len(lnd["posts"]) >= 4,
              "%s: landing has %d posts, expected at least the (4) corners"
              % (template, len(lnd["posts"])))
        check(len(lnd["posts"]) % 2 == 0,
              "%s: landing posts should come in pairs, got %d"
              % (template, len(lnd["posts"])))
        check(lnd["post_size"] == LANDING_POST_SIZE_WOOD,
              "%s: post size %s, Loucks uses %s"
              % (template, lnd["post_size"], LANDING_POST_SIZE_WOOD))
        check(lnd["post_base"] == LANDING_POST_BASE_WOOD,
              "%s: post base %s, Loucks uses %s"
              % (template, lnd["post_base"], LANDING_POST_BASE_WOOD))
        check(lnd["post_cap"] == LANDING_POST_CAP_WOOD,
              "%s: post cap %s, Loucks uses %s"
              % (template, lnd["post_cap"], LANDING_POST_CAP_WOOD))

# wrapAround has two landings -> two sets of four posts
g = geo(template="wrapAround", height=8.0)
s = compute_stair_support(20.0, 12.0, 0, 4, geometry=g, total_rise=8.0)
check(len(s["landings"]) == 2, "wrapAround should have 2 landings")
check(len(landing_post_xy([s])) >= 8,
      "wrapAround (2 landings) should have at least 8 landing posts, got %d"
      % len(landing_post_xy([s])))

# ---- 4. Landing posts sit at the landing's corners, not inside it ---------
g = geo(template="switchback", height=6.0)
s = compute_stair_support(20.0, 12.0, 0, 4, geometry=g, total_rise=6.0)
lnd = s["landings"][0]
r = lnd["rect"]
x_lo, x_hi = min(r["x0"], r["x1"]), max(r["x0"], r["x1"])
y_lo, y_hi = min(r["y0"], r["y1"]), max(r["y0"], r["y1"])
for p in lnd["posts"]:
    on_x_edge = abs(p["x"] - x_lo) < 0.01 or abs(p["x"] - x_hi) < 0.01
    on_y_edge = abs(p["y"] - y_lo) < 0.01 or abs(p["y"] - y_hi) < 0.01
    check(on_x_edge or on_y_edge,
          "landing post (%s,%s) is not on an edge of [%s,%s]x[%s,%s]"
          % (p["x"], p["y"], x_lo, x_hi, y_lo, y_hi))
    check(x_lo - 0.01 <= p["x"] <= x_hi + 0.01
          and y_lo - 0.01 <= p["y"] <= y_hi + 0.01,
          "landing post (%s,%s) lies outside the landing" % (p["x"], p["y"]))

# ---- 5. WELBORN: the steel path uses brackets, never a pad-and-plate ------
s = compute_stair_support(20.0, 12.0, 0, 4, geometry=geo(), total_rise=6.0,
                          framing_type="steel")
check(STAIR_BRACKET_STEEL in s["hardware"],
      "steel straight stair should call out the stringer anchor bracket")
check(landing_post_xy([s]) == [], "steel straight stair should add no posts")

s_steel_land = compute_stair_support(20.0, 12.0, 0, 4,
                                     geometry=geo(template="switchback", height=6.0),
                                     total_rise=6.0, framing_type="steel")
for lnd in s_steel_land["landings"]:
    check(lnd["post_base"] is None,
          "steel landing should not carry Simpson wood hardware")
    check("steel" in lnd["post_size"].lower(),
          "steel landing post size should be the steel post, got %s" % lnd["post_size"])

# ---- 6. Rotation puts landing posts in the right world quadrant ----------
# A landing on a right-exit stair must not land back on top of the deck origin.
for ang in [0, 90, 180, 270]:
    s = compute_stair_support(20.0, 12.0, ang, 4,
                              geometry=geo(template="switchback", height=6.0),
                              total_rise=6.0)
    pts = landing_post_xy([s])
    check(len(pts) >= 4, "ang=%s: expected at least 4 landing posts" % ang)
    check(len(set(pts)) == len(pts),
          "ang=%s: landing posts collapsed onto each other" % ang)

# ---- 7. Reaction is reported, monotonic, and never sizes a printed member -
prev = -1.0
for h in [2, 4, 6, 8, 10, 13]:
    r = stair_top_reaction(4, geo(height=float(h)), total_rise=float(h))
    check(r > 0, "rise %s: non-positive reaction" % h)
    check(r >= prev, "rise %s: reaction decreased" % h)
    prev = r

# ---- 8. Routine residential configs never demand an engineer -------------
for h in [2, 4, 6, 8, 10, 13]:
    for sw in [3, 4, 5]:
        for t in ["straight", "lLeft", "switchback"]:
            s = compute_stair_support(20.0, 12.0, 0, sw,
                                      geometry=geo(template=t, height=float(h), sw=sw),
                                      total_rise=float(h), deck_height=float(h))
            check(not s["needs_engineer"],
                  "routine %s h=%s sw=%s flagged: %s" % (t, h, sw, s["reason"]))

# ---- 9. The engineering threshold still triggers on a genuine outlier ----
big = stair_top_reaction(10, geo(height=20.0, sw=10), total_rise=20.0)
check(big > MAX_PRESCRIPTIVE_REACTION_LB,
      "expected an outlier above the reaction ceiling, got %s" % big)
s = compute_stair_support(20.0, 12.0, 0, 10, geometry=geo(height=20.0, sw=10),
                          total_rise=20.0)
check(s["needs_engineer"], "outlier config should require engineering")
check(s["reason"], "needs_engineer set without a reason")

# ---- 10. Transitional stairs are skipped; empty input is safe ------------
resolved = [
    {"stair": {"id": 1, "width": 4}, "world_anchor_x": 10.0, "world_anchor_y": 12.0,
     "angle": 0, "geometry": geo(),
     "elevation_info": {"isTransitional": False, "totalRise": 6.0}},
    {"stair": {"id": 2, "width": 4}, "world_anchor_x": 20.0, "world_anchor_y": 12.0,
     "angle": 0, "geometry": geo(),
     "elevation_info": {"isTransitional": True, "totalRise": 2.0}},
]
out = compute_all_stair_supports(resolved, deck_height=6.0)
check(len(out) == 1, "transitional stair should be skipped, got %d" % len(out))
check(out[0]["stair_id"] == 1, "wrong stair kept")
check(compute_all_stair_supports([], deck_height=4.0) == [], "empty input -> []")
check(compute_all_stair_supports(None, deck_height=4.0) == [], "None input -> []")
check(landing_post_xy([]) == [], "landing_post_xy([]) should be []")

print("")
if failures:
    for f in failures:
        print("  [FAIL] " + f)
    print("STAIR SUPPORT: %d FAILURES" % len(failures))
    sys.exit(1)
print("STAIR SUPPORT: all checks passed")
