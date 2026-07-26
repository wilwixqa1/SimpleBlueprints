"""
CROSS-SYSTEM CONSISTENCY AUDIT
==============================

Every other test in this suite checks ONE system in isolation: golden checks
the PDF, test_structural checks the engine's numbers, test_frontend_parity
checks JS-vs-Python of the SAME system. None of them check that two DIFFERENT
systems, handed the same deck, agree with each other.

That gap is where the expensive bugs live. Two were found the hard way (Billy
spotted the framing on a printed sheet):

  1. STAIRS. A stair placed inside the deck IS an opening. The drawing knows
     it -- it prints "N'-N" OPENING" and draws a header. But the beam-placement
     engine derives its layout from an opening list the stair never populates,
     so the beam runs straight through the stairwell and a post can stand in
     it. The label and the framing disagree.

  2. FREESTANDING. The structural engine models a freestanding deck as TWO
     beams (post count doubled, joist span halved, hangers doubled). The
     drawing renders ONE beam line. The count and the picture disagree.

Both are the same failure: each system re-derives geometry from raw params
instead of sharing one model, so they can silently reach different answers.
This file asserts the systems AGREE. It is expected to FAIL on the two bugs
above until they are fixed -- that failure is the point. A green run here means
the seams are consistent, not that any single system is individually correct.

CRITICAL: when you fix a seam, the fix is what makes the assertion pass. Do NOT
relax an assertion to make it green -- that re-opens the seam and defeats the
audit. If a NEW config legitimately should not satisfy an invariant, add it to
that invariant's documented exception set with a reason, don't widen the rule.

Run: python3 tests/test_cross_system_consistency.py
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))
sys.path.insert(0, os.path.join(ROOT, "tests", "pdf"))

from config_matrix import _base  # noqa: E402
from app.main import calculate_structure  # noqa: E402
from drawing.stair_utils import resolve_all_stairs  # noqa: E402

failures = []
known_fail = []  # invariants we EXPECT to fail pre-fix, tracked separately


def check(cond, msg, expected_fail=False):
    if cond:
        return
    (known_fail if expected_fail else failures).append(msg)


def _stair_world_box(rs):
    """World-space box of a stair's FIRST run: (x_lo, x_hi, y_lo, y_hi).

    Computed the way draw_plan.py's S68 block computes the "N'-N" OPENING"
    dimension -- transform the run rect into world space. Y IS INCLUDED, and
    that is the entire point of this helper (see the header note on S100).
    """
    from drawing.stair_utils import transform_stair_point
    sg = rs.get("geometry")
    if not sg or not sg.get("runs"):
        return None
    r0 = sg["runs"][0]["rect"]
    ax, ay, ang = rs["world_anchor_x"], rs["world_anchor_y"], rs["angle"]
    x1, _ = transform_stair_point(r0["x"], 0, ax, ay, ang)
    x2, _ = transform_stair_point(r0["x"] + r0["w"], 0, ax, ay, ang)
    return min(x1, x2), max(x1, x2), ay, ay + r0["h"]


def _front_stair_params(width, depth, offset, zone_depth=None):
    """Front-stair config. `offset` is CENTRE-relative (offset 0 centres the
    stair). When zone_depth is given, a cutout of that depth is added so the
    stair anchors INBOARD -- which is what a notch produces."""
    kw = dict(width=width, depth=depth, height=4, attachment="ledger",
              deckStairs=[{"id": 0, "zoneId": 0, "location": "front",
                           "offset": offset, "width": 4,
                           "numStringers": 3, "template": "straight"}])
    if zone_depth:
        kw["zones"] = [{"id": 1, "type": "cutout", "attachEdge": "front",
                        "attachOffset": width / 2.0 - 2.0 + offset,
                        "w": 4, "d": zone_depth, "attachTo": 0}]
    return _base(**kw)


# ============================================================
# INVARIANT 1 -- STAIR ANCHOR POSITION drives whether the framing opens.
#
# The rule, confirmed independently in both codebases:
#   stair anchored at the deck's OUTER EDGE -> runs outward, never crosses the
#       deck plane -> framing stays CONTINUOUS. Nothing is cut. This is the
#       Ilaria detail: straight stair to grade, stringer on a concrete pad.
#   stair anchored INBOARD (a notch)         -> genuinely crosses the deck
#       plane -> framing MUST open (beam steps, header closes it).
#
# WHY THIS ASSERTION IS SHAPED THIS WAY -- read before "fixing" it:
# The S100 handoff reported "41 of 72 sampled straight-stair configs have a
# post inside the stair opening" and filed it as the top backlog item, blocked
# on Billy. That comparison used the post's X against the stair's X-span and
# never checked Y. Re-derived here with Y included, over 66 configs:
#       post inside stair X-span only  : 44   (reproduces the finding)
#       post inside stair X *and* Y    :  0   (no actual collision, ever)
# On a 40x12 deck the post sits at (20.0, 10.5) -- under solid decking, 1.5ft
# behind the front edge -- while the stair occupies y 12.0 -> 17.2, entirely
# off the deck. They are 1.5ft apart. There is no post in the stairway.
#
# So a continuous beam under an edge-anchored stair is CORRECT, not a defect.
# Any future assertion here must compare BOTH axes.
# ============================================================
print("\nCROSS-SYSTEM CONSISTENCY AUDIT")
print("1. Stair anchor position vs framing response")

n_edge = n_inboard = 0
for width in [24, 32, 40]:
    max_off = width / 2.0 - 3.0
    for off in [0, round(max_off / 2, 1)]:

        # --- 1a. EDGE-anchored: framing must stay continuous ---
        p = _front_stair_params(width, 12, off)
        c = calculate_structure(p)
        stairs = resolve_all_stairs(p, c)
        box = _stair_world_box(stairs[0]) if stairs else None
        if box:
            lo, hi, ylo, yhi = box
            n_edge += 1
            posts = (c.get("beam_layout") or {}).get("post_xy") or []
            hits = [(round(px, 2), round(py, 2)) for px, py in posts
                    if lo - 1e-6 < px < hi + 1e-6 and ylo - 1e-6 < py < yhi + 1e-6]
            check(not hits,
                  "EDGE STAIR w=%d off=%s: post(s) %s genuinely intersect the "
                  "stair box x[%.1f,%.1f] y[%.1f,%.1f]"
                  % (width, off, hits, lo, hi, ylo, yhi))
            check(ylo >= p["depth"] - 1e-6,
                  "EDGE STAIR w=%d off=%s: expected the stair to start at the "
                  "deck edge (y=%.1f), got y=%.2f"
                  % (width, off, p["depth"], ylo))
            check(not (c.get("beam_layout") or {}).get("stepped"),
                  "EDGE STAIR w=%d off=%s: framing opened for a stair that "
                  "never crosses the deck plane" % (width, off))

        # --- 1b. INBOARD (notch): framing MUST open ---
        p2 = _front_stair_params(width, 12, off, zone_depth=4)
        c2 = calculate_structure(p2)
        n_inboard += 1
        check(bool((c2.get("beam_layout") or {}).get("stepped")),
              "INBOARD STAIR w=%d off=%s: a notch is present but the beam did "
              "not open for it" % (width, off))

print("   %d edge-anchored, %d inboard configs checked" % (n_edge, n_inboard))

# ============================================================
# INVARIANT 1b -- STAIR DRAGGED INTO THE DECK ("notch") must open the framing.
#
# THIS IS THE CASE THE FIRST VERSION OF THIS FILE MISSED, and the miss was
# expensive: it tested stair placement ONLY through location+offset (the
# sidebar), which always pins a stair to the deck edge where nothing collides.
# From that it "proved" S100's post-in-stairway finding was a false positive.
#
# But planView.js onStairDrag writes anchorX/anchorY directly and only snaps
# back to an edge if released within 1.5ft of one. Drag a stair into the deck
# and it STAYS there. Measured on a 40x12 before the fix: the stair box was
# x[18,22] y[6.0,11.2] and a post sat at (20.0, 10.5) -- inside it in BOTH
# axes. A 6x6 post standing in the stairway, with the beam running through it.
#
# So S100 was RIGHT and the "false positive" conclusion was wrong. It was drawn
# from a test that never exercised the interaction the bug lives in.
#
# LESSON, and the reason this block exists: a config built from the sidebar
# fields is not the same as a config built from the canvas. Test the
# INTERACTION, not just the form.
# ============================================================
print("1b. Stair dragged into the deck vs framing response")

n_drag = 0
for width, depth in [(40, 12), (28, 14), (20, 12)]:
    for inset in [2.0, 3.0]:
        ay = depth - inset          # dragged `inset` ft in from the front edge
        p = _base(width=width, depth=depth, height=4, attachment="ledger",
                  deckStairs=[{"id": 0, "zoneId": 0, "width": 4,
                               "numStringers": 3, "template": "straight",
                               "anchorX": width / 2.0, "anchorY": ay,
                               "angle": 0}])
        c = calculate_structure(p)
        bl = c.get("beam_layout") or {}
        n_drag += 1

        check(bool(bl.get("stepped")),
              "DRAGGED STAIR %dx%d inset %.1fft: stair is inside the deck but "
              "the beam did not open (would run through the stairwell)"
              % (width, depth, inset))

        lo, hi = width / 2.0 - 2.0, width / 2.0 + 2.0
        hits = [(round(px, 2), round(py, 2)) for px, py in (bl.get("post_xy") or [])
                if lo - 1e-6 < px < hi + 1e-6 and ay - 1e-6 < py < depth + 1e-6]
        check(not hits,
              "DRAGGED STAIR %dx%d inset %.1fft: post(s) %s stand inside the "
              "stair opening x[%.1f,%.1f] y[%.1f,%.1f]"
              % (width, depth, inset, hits, lo, hi, ay, depth))
print("   %d dragged-in configs checked" % n_drag)

# ============================================================
# INVARIANT 2 -- FREESTANDING BEAM COUNT (engine) vs BEAM GEOMETRY (layout)
# The engine doubles posts for freestanding because it models two beams. The
# beam_layout must then express two distinct beam lines. Today it expresses
# one -> expected_fail until the second-beam fix lands.
# ============================================================
print("2. Freestanding beam count (engine) vs beam geometry (layout)")

n_fs = 0
for width in [16, 20, 28]:
    for depth in [10, 14]:
        p = _base(width=width, depth=depth, height=4, attachment="freestanding")
        c = calculate_structure(p)
        posts = c.get("post_positions") or []
        total = c.get("total_posts")
        bl = c.get("beam_layout") or {}
        post_xy = bl.get("post_xy") or []
        beam_lines = sorted(set(round(y, 2) for _, y in post_xy))

        n_fs += 1
        # The engine says freestanding = 2 beams (total_posts == 2 * per-beam).
        # The geometry must therefore carry 2 distinct beam-line y-values.
        check(len(beam_lines) == 2,
              "FREESTANDING SEAM %dx%d: engine models 2 beams (total_posts=%s, "
              "%d per line) but beam_layout has %d beam line(s) at y=%s"
              % (width, depth, total, len(posts), len(beam_lines), beam_lines),
              expected_fail=True)
print("   %d freestanding configs checked" % n_fs)

# ============================================================
# CONTROL -- a plain ledger deck must be consistent TODAY.
# This guards the audit itself: if this ever fails, the test is broken, not the
# product.
# ============================================================
# INVARIANT 3 -- BILLED rail length == DRAWN rail length.
#
# The seam this closes (S103): the framing sheet drew the guard rail open where
# a front stair descends (draw_plan.py passed stair_openings into
# get_exposed_edges) while the material list on the SAME permit set billed rail
# straight across that gap (draw_materials.py did not pass them), and the steel
# material path had no zone branch at all so it missed the notch wrap entirely.
# Measured pre-fix: 54.0 LF drawn vs 56.0 LF billed wood, 44 LF billed steel;
# 312 of 450 swept notch+stair configs changed a line item.
#
# This needs its own invariant because NOTHING ELSE COVERS IT. golden_structural
# fingerprints site/plan/framing/details -- the material sheet is not in SHEETS,
# so a material-list regression is invisible to golden by construction.
# test_frontend_parity only proves JS and Python agree with EACH OTHER, which
# would stay green if both drifted the same way.
#
# Both sides must read the same rule: draw_plan and draw_materials go through
# stair_utils.build_front_stair_openings. If someone re-inlines it in one place,
# this fails.
#
# Asserted against the ESTIMATOR OUTPUT, not against _rail_length. Testing the
# helper directly passes even if a call site is reverted -- found by mutation
# test: dropping the steel path back to calc["rail_length"] left a
# helper-level check completely green.
print("3. Billed rail length vs drawn rail length")
import math  # noqa: E402
from drawing.draw_materials import (  # noqa: E402
    estimate_materials, estimate_steel_materials,
)
from drawing.zone_utils import get_exposed_edges  # noqa: E402
from drawing.stair_utils import build_front_stair_openings  # noqa: E402


def _edge_total(edges):
    return round(sum(abs(e["x2"] - e["x1"]) if e["dir"] == "h"
                     else abs(e["y2"] - e["y1"]) for e in edges), 1)


n_rail = 0
for _w, _d in [(16, 12), (20, 14), (24, 12), (30, 16), (40, 12)]:
    for _cw, _cd, _coff in [(4, 4, 8), (4, 5, 4), (6, 5, 7)]:
        if _coff + _cw > _w:
            continue
        for _sw in [3, 4, 5]:
            for _framing in ["wood", "steel"]:
                _p = _base(width=_w, depth=_d, height=4, attachment="ledger",
                           framingType=_framing,
                           zones=[{"id": 1, "type": "cutout",
                                   "attachEdge": "front", "attachOffset": _coff,
                                   "w": _cw, "d": _cd, "attachTo": 0}],
                           deckStairs=[{"id": 0, "zoneId": 0,
                                        "location": "front", "offset": 0,
                                        "width": _sw, "numStringers": 3,
                                        "template": "straight"}])
                _p["railType"] = "wood"
                _c = calculate_structure(_p)
                _drawn = _edge_total(get_exposed_edges(
                    _p, stair_openings=build_front_stair_openings(_p, _c)))
                _est = (estimate_steel_materials if _framing == "steel"
                        else estimate_materials)(_p, _c)
                # The deck guard rail line only. Stair rail is a separate item
                # ("Wood Stair Rail Kit (8')") computed from stair geometry.
                _kits = [i["qty"] for i in _est["items"]
                         if i["item"] == "Wood Rail Kit (8')"]
                _want = math.ceil(_drawn / 8)
                check(len(_kits) == 1 and _kits[0] == _want,
                      "RAIL %s %dx%d notch %dx%d@%d stair %dft: sheet DRAWS "
                      "%s LF (= %d kits), material list BILLS %s kits"
                      % (_framing, _w, _d, _cw, _cd, _coff, _sw,
                         _drawn, _want, _kits))
                n_rail += 1
print("   %d notch+stair configs checked (wood and steel)" % n_rail)


# ============================================================
print("4. Control: plain ledger deck is already consistent")
p = _base(width=20, depth=12, height=4, attachment="ledger")
c = calculate_structure(p)
bl = c.get("beam_layout") or {}
beam_lines = sorted(set(round(y, 2) for _, y in (bl.get("post_xy") or [])))
check(len(beam_lines) == 1, "CONTROL: plain ledger deck should have exactly 1 "
      "beam line, got %s" % beam_lines)
check(not bl.get("stepped"), "CONTROL: plain flat deck should not be stepped")

# ============================================================
print("")
if failures:
    print("CROSS-SYSTEM AUDIT: %d UNEXPECTED failure(s)" % len(failures))
    for f in failures:
        print("  [FAIL] " + f)
    sys.exit(1)

if known_fail:
    print("CROSS-SYSTEM AUDIT: control checks pass. %d KNOWN-SEAM failure(s) "
          "still open (expected until the fixes land):" % len(known_fail))
    for f in known_fail:
        print("  [OPEN] " + f)
    # Known-open seams do not fail the build YET -- they are the work queue.
    # Once a fix lands, flip its check's expected_fail=False so a regression
    # becomes a hard failure. When ALL are flipped, this whole file is a guard.
    sys.exit(0)

print("CROSS-SYSTEM AUDIT: all seams consistent")
sys.exit(0)
