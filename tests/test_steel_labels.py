#!/usr/bin/env python3
"""
S102: guard the steel-vs-wood labelling on the details sheet.

Why this exists: the steel path had NO PDF regression coverage of any kind.
tests/pdf/golden_structural.py and tests/pdf/config_matrix.py both hardcode
framingType="wood", and test_frontend_parity.py has no steel case either. So
draw_footing_detail could hardcode f'{post_size} PT POST' with no is_steel
check and nothing noticed. On a steel set post_size is "3.5x3.5 Steel", so that
rendered "3.5x3.5 Steel PT POST" -- a self-contradicting label ("PT" is
pressure-treated wood), on the same sheet where draw_post_beam_detail already
printed 'FORTRESS 3.5" STEEL POST' correctly.

This does not replace a steel golden config (still a backlog item). It pins the
specific claim that no wood-only term leaks onto a steel detail, and that the
wood path is untouched.

Run: python3 tests/test_steel_labels.py
"""
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))), "backend"))

from drawing.calc_engine import calculate_structure       # noqa: E402
from drawing.permit_spec import build_permit_spec          # noqa: E402
from drawing.draw_details import (                          # noqa: E402
    draw_footing_detail, draw_post_beam_detail,
)

FAILURES = []


def _params(framing, rail):
    return dict(width=20, depth=14, height=4, houseWidth=40, houseDepth=30,
                attachment="ledger", joistSpacing=16, deckingType="composite",
                snowLoad="moderate", frostZone="cold", lotWidth=80,
                lotDepth=120, setbackFront=25, setbackSide=5, setbackRear=20,
                houseOffsetSide=20, beamType="dropped",
                framingType=framing, railType=rail)


def texts_for(fn, framing, rail):
    p = _params(framing, rail)
    c = calculate_structure(p)
    spec = build_permit_spec(p, c)
    fig, ax = plt.subplots()
    fn(ax, p, c, spec)
    out = [t.get_text() for t in ax.texts]
    plt.close(fig)
    return out


def check(label, cond, detail=""):
    print("  [%s] %s%s" % ("OK  " if cond else "FAIL", label,
                           "" if cond else "   -> " + detail))
    if not cond:
        FAILURES.append(label)


# Terms that must never appear on a steel detail. "PT" is pressure-treated
# lumber; SIMPSON is the wood hardware line (Fortress uses FF-EVOLUTION).
WOOD_ONLY = ("PT POST", "PT BEAM", "SIMPSON")

DETAILS = [("footing", draw_footing_detail), ("post_beam", draw_post_beam_detail)]

print("1. no wood-only term leaks onto a STEEL detail")
for name, fn in DETAILS:
    joined = " || ".join(texts_for(fn, "steel", "fortress")).upper()
    for term in WOOD_ONLY:
        check("%s: no '%s'" % (name, term), term not in joined, joined[:240])

print("\n2. steel details name the steel system explicitly")
for name, fn in DETAILS:
    joined = " || ".join(texts_for(fn, "steel", "fortress")).upper()
    check("%s: says STEEL or FORTRESS" % name,
          ("STEEL" in joined or "FORTRESS" in joined or "FF-EVOLUTION" in joined),
          joined[:240])

print("\n3. the two details agree with each other on a steel set")
# The original bug was precisely that they disagreed: one said steel post, the
# other said PT post.
foot = " || ".join(texts_for(draw_footing_detail, "steel", "fortress")).upper()
pb = " || ".join(texts_for(draw_post_beam_detail, "steel", "fortress")).upper()
check("both name a 3.5\" steel post",
      ("3.5" in foot and "STEEL" in foot) and ("3.5" in pb and "STEEL" in pb),
      "footing=%s ||| post_beam=%s" % (foot[:120], pb[:120]))

print("\n4. WOOD path unchanged (regression guard)")
foot_w = texts_for(draw_footing_detail, "wood", "wood")
joined_w = " || ".join(foot_w).upper()
check("footing wood still says '6x6 PT POST'",
      any(t.strip() == "6x6 PT POST" for t in foot_w), joined_w[:240])
check("footing wood still names SIMPSON post base",
      "SIMPSON" in joined_w, joined_w[:240])
check("footing wood says nothing about steel/fortress",
      ("STEEL" not in joined_w and "FORTRESS" not in joined_w), joined_w[:240])

print()
if FAILURES:
    print("STEEL LABELS: %d failure(s): %s" % (len(FAILURES), ", ".join(FAILURES)))
    sys.exit(1)
print("STEEL LABELS: all checks passed")
