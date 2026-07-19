"""S89: B10 regression oracle -- no support post inside a deck cutout.

The real, user-reachable B10: main-deck posts ignored cutouts, so a notch left
a post standing over empty space. This test drives the REAL notched-deck path
(cutout zones on the main deck) through the actual calc and asserts, from the
cutout-aware beam layout, that no post center falls inside any cutout. It also
locks the flat / no-cutout deck to the legacy positions. Pure numeric -- runs
with vision down; belongs in CI.
"""
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from drawing.calc_engine import calculate_structure  # noqa: E402
from drawing.zone_utils import get_cutout_rects  # noqa: E402

FAILS = []


def check(name, cond, detail=""):
    if not cond:
        FAILS.append(name)
    print(f"  [{'OK  ' if cond else 'FAIL'}] {name}" + (f"  {detail}" if detail else ""))


def _base(**over):
    p = dict(width=20, depth=14, height=4, houseWidth=40, houseDepth=30,
             attachment="ledger", joistSpacing=16, deckingType="composite",
             snowLoad="moderate", frostZone="cold", lotWidth=80, lotDepth=120,
             setbackFront=25, setbackSide=5, setbackRear=20, houseOffsetSide=20,
             beamType="dropped", framingType="wood")
    p.update(over)
    return p


def _cutout(edge, w, d, off=0):
    return {"id": 1, "type": "cutout", "attachEdge": edge, "attachOffset": off,
            "w": w, "d": d, "attachTo": 0}


def posts_in_cutouts(params):
    calc = calculate_structure(dict(params))
    post_xy = calc["beam_layout"]["post_xy"]
    cuts = get_cutout_rects(params)
    hits = []
    for (px, py) in post_xy:
        for cr in cuts:
            r = cr["rect"]
            if r["x"] <= px <= r["x"] + r["w"] and r["y"] <= py <= r["y"] + r["d"]:
                hits.append((round(px, 2), round(py, 2)))
    return hits, post_xy


# --- Flat deck: legacy positions preserved ----------------------------------
flat = calculate_structure(_base())
check("flat deck: legacy posts [2,10,18]",
      flat["post_positions"] == [2.0, 10.0, 18.0], str(flat["post_positions"]))
check("flat deck: not stepped", flat["beam_layout"]["stepped"] is False)

# --- Notched decks: NO post inside any cutout -------------------------------
CASES = [
    ("deep front notch (cd=6, centered)", _base(zones=[_cutout("front", 8, 6, off=6)])),
    ("front-left notch", _base(zones=[_cutout("front-left", 6, 5)])),
    ("front-right notch", _base(zones=[_cutout("front-right", 6, 5)])),
    ("shallow front notch (cd=1)", _base(zones=[_cutout("front", 8, 1, off=6)])),
    ("wide deep notch (cd=8)", _base(width=24, depth=14, zones=[_cutout("front", 10, 8, off=7)])),
]
for name, params in CASES:
    hits, post_xy = posts_in_cutouts(params)
    check(f"{name}: no post in cutout", not hits,
          f"STRANDED {hits}" if hits else f"clean ({len(post_xy)} posts)")

print()
if FAILS:
    print(f"NOTCH POSTS: {len(FAILS)} FAILURE(S): {FAILS}")
    sys.exit(1)
print("NOTCH POSTS: all checks passed -- no post stranded in any cutout")
