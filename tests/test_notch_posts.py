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

# --- P1.2: cutout-aware stair anchor ----------------------------------------
# A location-derived front stair must anchor at the REAL front edge across its
# footprint, not at full depth D over the notch void. S90 faked this with a
# manual anchorX/anchorY; now the location:"front" path resolves it.
from drawing.stair_utils import resolve_all_stairs  # noqa: E402


def _front_stair(**over):
    s = {"id": 1, "zoneId": 0, "location": "front", "width": 4,
         "numStringers": 3, "template": "straight"}
    s.update(over)
    return s


# S90 notch fixture: front cutout {x:6,y:8,w:8,d:6} -> notch back edge at y=8.
notch = _base(zones=[_cutout("front", 8, 6, off=6)])

# Front stair centered in the notch (deck center x=10 lands inside notch [6,14]).
p_in = dict(notch); p_in["deckStairs"] = [_front_stair()]
res_in = resolve_all_stairs(p_in, calculate_structure(dict(p_in)))
check("P1.2 front stair in notch: anchor_y == 8 (notch edge, not 14)",
      bool(res_in) and abs(res_in[0]["world_anchor_y"] - 8.0) < 1e-6,
      f"anchor_y={res_in[0]['world_anchor_y'] if res_in else 'NO STAIR'}")

# Flat deck (no cutout): front stair still anchors at full depth D=14.
p_flat = _base(); p_flat["deckStairs"] = [_front_stair()]
res_flat = resolve_all_stairs(p_flat, calculate_structure(dict(p_flat)))
check("P1.2 front stair on flat deck: anchor_y == 14 (unchanged)",
      bool(res_flat) and abs(res_flat[0]["world_anchor_y"] - 14.0) < 1e-6,
      f"anchor_y={res_flat[0]['world_anchor_y'] if res_flat else 'NO STAIR'}")

# Explicit anchor override is preserved (not touched by the cutout-aware path).
p_expl = dict(notch)
p_expl["deckStairs"] = [_front_stair(anchorX=10.0, anchorY=14.0, angle=0)]
res_expl = resolve_all_stairs(p_expl, calculate_structure(dict(p_expl)))
check("P1.2 explicit anchor preserved: anchor_y == 14 as given",
      bool(res_expl) and abs(res_expl[0]["world_anchor_y"] - 14.0) < 1e-6,
      f"anchor_y={res_expl[0]['world_anchor_y'] if res_expl else 'NO STAIR'}")

# Front stair offset fully OUT of the notch (onto the solid right wing) anchors
# at full depth. off=7 -> center x=17, footprint [15,19] sits inside solid
# [14,20]. (A footprint that straddled the notch edge would correctly pull to 8,
# since the stair's top edge must land on solid deck across its whole width.)
p_off = dict(notch); p_off["deckStairs"] = [_front_stair(offset=7)]
res_off = resolve_all_stairs(p_off, calculate_structure(dict(p_off)))
check("P1.2 front stair offset onto solid wing: anchor_y == 14",
      bool(res_off) and abs(res_off[0]["world_anchor_y"] - 14.0) < 1e-6,
      f"anchor_y={res_off[0]['world_anchor_y'] if res_off else 'NO STAIR'}")

# --- P1.4a: railing wraps the notch (not one straight front edge) -----------
from drawing.zone_utils import get_exposed_edges  # noqa: E402

# Matched notch/stair fixture: front cutout {x:8,y:8,w:4,d:6}, notch back y=8.
mnotch = _base(zones=[_cutout("front", 4, 6, off=8)])


def _has_straight_front(edges, D=14.0):
    # the old bug: a single horizontal edge spanning the whole front at y==D
    for e in edges:
        if e["dir"] == "h" and abs(e["y1"] - D) < 0.01:
            if abs(min(e["x1"], e["x2"])) < 0.01 and abs(max(e["x1"], e["x2"]) - 20.0) < 0.01:
                return True
    return False


ee = get_exposed_edges(mnotch)
check("P1.4a notch: no single straight front edge (0..20 @ y=14)",
      not _has_straight_front(ee))
# Front runs stop at the notch mouth (x=8 and x=12), leaving the notch open.
front_hs = sorted([(round(min(e["x1"], e["x2"]), 1), round(max(e["x1"], e["x2"]), 1))
                   for e in ee if e["dir"] == "h" and abs(e["y1"] - 14.0) < 0.01])
check("P1.4a notch: front rail is two runs [0,8] and [12,20]",
      front_hs == [(0.0, 8.0), (12.0, 20.0)], str(front_hs))
# Notch side walls present (vertical edges at x=8 and x=12 from y=8 to y=14).
walls = sorted([round(e["x1"], 1) for e in ee if e["dir"] == "v"
                and abs(min(e["y1"], e["y2"]) - 8.0) < 0.01
                and abs(max(e["y1"], e["y2"]) - 14.0) < 0.01])
check("P1.4a notch: both notch side walls railed (x=8, x=12)",
      walls == [8.0, 12.0], str(walls))

# With the stair filling the notch, the notch-back edge (y=8) carries no rail.
ee_open = get_exposed_edges(mnotch, stair_openings=[(8.0, 8.0, 12.0)])
back = [e for e in ee_open if e["dir"] == "h" and abs(e["y1"] - 8.0) < 0.01]
check("P1.4a notch+stair: no rail across the notch-back opening", not back,
      f"{len(back)} back-edge(s) remain")

# Flat deck unchanged: still one straight front edge, no notch wrap.
ee_flat = get_exposed_edges(_base())
check("P1.4a flat deck: straight front edge preserved (no regression)",
      _has_straight_front(ee_flat))

print()
if FAILS:
    print(f"NOTCH POSTS: {len(FAILS)} FAILURE(S): {FAILS}")
    sys.exit(1)
print("NOTCH POSTS: all checks passed -- no post stranded in any cutout")
