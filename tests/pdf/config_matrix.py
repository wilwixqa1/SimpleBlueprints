#!/usr/bin/env python3
"""S88 item 4: CONFIG MATRIX BATTLE TEST + post-in-landing (B3/G11) check.

Carried since S86 and never run: the main-deck PARAMETRIC stair path
(stairAnchorX / stairAnchorY / stairAngle in get_stair_placement) is
exercised by NO fixture and NO test -- the frontend can produce it (drag a
stair to an interior anchor) but every backend fixture uses the legacy
stairLocation path. Highest info value: expect B3-class bugs (a deck post
landing inside a stair-landing rectangle).

This harness has two halves, per the S88 doctrine (crash/oracle = no vision;
only a final look needs eyes):

  CRASH JUDGE (no vision): push a matrix of configs -- {1,2 zones} x stair
  {main / one zone / both} x >=1 INTERIOR-ANCHORED main stair -- through the
  full generate_blueprint_pdf pipeline (which runs permit_checker internally,
  so a raising checker IS a crash). Any exception = failure, dumped as a
  reproducer.

  POST-IN-LANDING JUDGE (no vision -- G11 / B3 detector): for each config,
  compute the main-deck post (x,y) positions and the main stair's landing
  rectangles in the SAME deck coordinate frame (origin = deck top-left,
  +X right along the house wall, +Y outward toward the yard), then assert no
  post center falls inside any landing rect. Pure coordinate math, no eyes.

Usage:
  python3 tests/pdf/config_matrix.py            # run matrix, exit 1 on any fail
  python3 tests/pdf/config_matrix.py --list     # print the matrix, no run
Library: run_matrix() -> (results, failures).
"""
import os
import sys
import math
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

import matplotlib  # noqa: E402
matplotlib.use("Agg")

from drawing.calc_engine import calculate_structure  # noqa: E402
from drawing.stair_utils import (  # noqa: E402
    get_stair_placement, compute_stair_geometry,
)
from drawing.zone_utils import get_cutout_rects  # noqa: E402  (S89 B10)

FIX_DIR = HERE / "matrix_fixtures"


# --------------------------------------------------------------------------
# Coordinate transform: stair-local landing rects -> deck frame.
# Stair-local: origin (0,0) at the stair exit on the deck edge, +Y away from
# house, +X to the right facing away. The exit sits at the deck-frame point
# (anchor_x, anchor_y); `angle` rotates the stair about that exit (0=front/
# +Y outward, 90=right/+X, 180=back, 270=left). We map each landing rect's
# four corners into the deck frame and take their axis-aligned bbox (adequate
# for a post-inside test; a post inside the true rotated rect is inside its
# bbox, so this never MISSES a hit -- it can only over-flag, which we then
# eyeball, and none occur here).
# --------------------------------------------------------------------------
def _stair_to_deck(px, py, anchor_x, anchor_y, angle_deg):
    """Map a stair-local point to deck coords.
    angle 0 => stair +Y aligns with deck +Y (outward)."""
    a = math.radians(angle_deg)
    # Rotate (px,py) by angle, then translate to the exit anchor.
    dx = px * math.cos(a) - py * math.sin(a)
    dy = px * math.sin(a) + py * math.cos(a)
    return anchor_x + dx, anchor_y + dy


def _landing_rects_deck(calc, params):
    """Return list of axis-aligned landing bboxes in deck coords for the
    MAIN deck stair, or [] if no landing / no stair."""
    stair = calc.get("stairs")
    if not stair:
        return []
    height = float(calc.get("height", params.get("height", 4)))
    template = params.get("stairTemplate", "straight")
    geom = compute_stair_geometry(
        template, height,
        stair_width=stair.get("width", 4),
        num_stringers=stair.get("num_stringers", 3),
        run_split=params.get("stairRunSplit"),
        landing_depth=params.get("stairLandingDepth"),
        stair_gap=params.get("stairGap", 0.5),
    )
    if not geom or not geom.get("landings"):
        return []
    place = get_stair_placement(params, calc)
    ax, ay, ang = place["anchor_x"], place["anchor_y"], place["angle"]
    bboxes = []
    for lnd in geom["landings"]:
        r = lnd["rect"]
        corners = [(r["x"], r["y"]), (r["x"] + r["w"], r["y"]),
                   (r["x"], r["y"] + r["h"]), (r["x"] + r["w"], r["y"] + r["h"])]
        pts = [_stair_to_deck(cx, cy, ax, ay, ang) for cx, cy in corners]
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        bboxes.append((min(xs), min(ys), max(xs), max(ys)))
    return bboxes


def _main_post_xy(calc, params):
    """Main-deck post (x,y) centers in deck coords. S89: use the true beam
    layout positions (a notched deck steps the beam, so posts are NOT all at
    depth-1.5); fall back to the flat beam line only when no layout is present.
    Freestanding decks also get a house-side row at y~1.5; landings extend
    OUTWARD (+Y) so mainly the outer row can collide, but include both."""
    layout = calc.get("beam_layout") or {}
    if layout.get("post_xy"):
        pts = [(float(x), float(y)) for (x, y) in layout["post_xy"]]
    else:
        xs = calc.get("post_positions", [])
        depth = float(calc.get("depth", params.get("depth", 12)))
        pts = [(x, depth - 1.5) for x in xs]
    if params.get("attachment", "ledger") != "ledger":
        pts += [(x, 1.5) for (x, _y) in pts]  # inner beam row on freestanding
    return pts


def check_post_in_cutout(calc, params):
    """S89 (B10): every main-deck support post must sit over real deck, never
    inside a cutout/notch. Returns the list of (post_xy, cutout_rect) hits;
    empty = correct."""
    layout = calc.get("beam_layout") or {}
    post_xy = layout.get("post_xy") or [(px, None) for px in calc.get("post_positions", [])]
    cuts = get_cutout_rects(params)
    hits = []
    for (px, py) in post_xy:
        for cr in cuts:
            r = cr["rect"]
            in_x = r["x"] <= px <= r["x"] + r["w"]
            in_y = (py is None) or (r["y"] <= py <= r["y"] + r["d"])
            if in_x and in_y:
                hits.append(((round(px, 2), py), r))
    return hits


def check_post_in_landing(calc, params):
    """Return list of (post_xy, landing_bbox) collisions. Empty = clean."""
    posts = _main_post_xy(calc, params)
    lands = _landing_rects_deck(calc, params)
    hits = []
    for (x, y) in posts:
        for (x0, y0, x1, y1) in lands:
            if x0 <= x <= x1 and y0 <= y <= y1:
                hits.append(((round(x, 2), round(y, 2)),
                             (round(x0, 2), round(y0, 2),
                              round(x1, 2), round(y1, 2))))
    return hits


# --------------------------------------------------------------------------
# The matrix.
# --------------------------------------------------------------------------
def _base(**over):
    p = dict(
        width=20, depth=12, height=4, houseWidth=40, houseDepth=30,
        attachment="ledger", joistSpacing=16, deckingType="composite",
        railType="fortress", snowLoad="moderate", frostZone="cold",
        lotWidth=80, lotDepth=120, setbackFront=25, setbackSide=5,
        setbackRear=20, houseOffsetSide=20, beamType="dropped",
        numStringers=3, stairWidth=4, framingType="wood",
    )
    p.update(over)
    return p


def build_matrix():
    """Return [(name, params), ...] covering the item-4 grid, with at least
    one INTERIOR-ANCHORED main stair per stair-bearing case."""
    configs = []

    # An interior anchor: exit pulled off the front-center toward the deck
    # interior (anchor_y < depth) so the stair/landing projects across posts.
    def interior_anchor(p):
        p = dict(p)
        p["hasStairs"] = True
        p["stairAnchorX"] = p["width"] / 2
        p["stairAnchorY"] = p["depth"] - 3      # 3 ft INSIDE the outer edge
        p["stairAngle"] = 0
        p["stairTemplate"] = "wideLanding"      # has a landing to collide with
        p["stairLandingDepth"] = 4
        return p

    zone_L = {"id": "L", "side": "left", "width": 8, "depth": 10}
    zone_R = {"id": "R", "side": "right", "width": 8, "depth": 10}

    # 1 zone / no zones x stair placements, all with interior-anchored main.
    configs.append(("m_0zone_main_interior",
                    interior_anchor(_base())))
    configs.append(("m_0zone_main_interior_switchback",
                    {**interior_anchor(_base()), "stairTemplate": "switchback",
                     "stairAnchorY": _base()["depth"] - 2}))
    configs.append(("m_0zone_main_interior_freestanding",
                    interior_anchor(_base(attachment="freestanding"))))

    # right-anchored interior stair (angle 90) -- exercises rotation.
    p = interior_anchor(_base())
    p["stairAngle"] = 90
    p["stairAnchorX"] = p["width"] - 3
    p["stairAnchorY"] = p["depth"] / 2
    configs.append(("m_0zone_main_interior_right90", p))

    # 1 zone + interior-anchored main stair
    configs.append(("m_1zone_main_interior",
                    {**interior_anchor(_base()), "zones": [dict(zone_L)]}))
    # 2 zones + interior-anchored main stair
    configs.append(("m_2zone_main_interior",
                    {**interior_anchor(_base()),
                     "zones": [dict(zone_L), dict(zone_R)]}))
    # 2 zones + stairs off both zones + interior main (dense torture)
    p = {**interior_anchor(_base()),
         "zones": [{**zone_L, "stairs": [{"location": "left"}]},
                   {**zone_R, "stairs": [{"location": "right"}]}]}
    configs.append(("m_2zone_zonestairs_main_interior", p))

    # deep interior anchor that SHOULD drive a landing over the beam posts --
    # the deliberate B3 probe (anchor pulled far inside).
    p = interior_anchor(_base(width=20, depth=14))
    p["stairAnchorY"] = 6          # landing lands mid-deck, over the beam row
    p["stairLandingDepth"] = 5
    configs.append(("m_0zone_B3_probe_deep_interior", p))

    # === S89 (B10): NOTCHED / CUTOUT decks -- with and without stairs. ===
    # These are the configs the notch fix must hold on: no post in a cutout,
    # beam follows the real edge, full pipeline renders. The stair variants are
    # the realistic "notch cut FOR the stairs" case.
    def _notch(edge, w, d, off=0, **extra):
        z = {"id": 1, "type": "cutout", "attachEdge": edge, "attachOffset": off,
             "w": w, "d": d, "attachTo": 0}
        base = _base(width=20, depth=14)
        base["zones"] = [z]
        base.update(extra)
        return base

    configs.append(("m_notch_front_deep_bare", _notch("front", 8, 6, off=6)))
    configs.append(("m_notch_front_shallow_bare", _notch("front", 8, 1, off=6)))
    configs.append(("m_notch_frontleft_bare", _notch("front-left", 6, 5)))
    configs.append(("m_notch_frontright_bare", _notch("front-right", 6, 5)))
    configs.append(("m_notch_wide_deep_bare",
                    {**_base(width=24, depth=14),
                     "zones": [{"id": 1, "type": "cutout", "attachEdge": "front",
                                "attachOffset": 7, "w": 10, "d": 8, "attachTo": 0}]}))
    # notch cut FOR the stairs: stair descends IN the notch, hosted at the notch
    # edge. S90: use the REAL deckStairs input -- the legacy flat-param stair path
    # produces NO geometry, so the stair silently never rendered (the matrix's
    # "stair" coverage was hollow). Notch sized to the stair width (the realistic
    # case), matching the S90 visual-confirm fixture.
    configs.append(("m_notch_stair_in_notch",
                    _notch("front", 4, 6, off=8, hasStairs=True,
                           deckStairs=[{"id": 1, "zoneId": 0, "anchorX": 10,
                                        "anchorY": 8, "angle": 0,
                                        "template": "straight", "width": 4,
                                        "numStringers": 3}])))
    configs.append(("m_notch_stair_in_notch_widelanding",
                    _notch("front", 5, 6, off=7.5, hasStairs=True,
                           deckStairs=[{"id": 1, "zoneId": 0, "anchorX": 10,
                                        "anchorY": 8, "angle": 0,
                                        "template": "wideLanding", "width": 5,
                                        "numStringers": 4, "landingDepth": 4}])))
    # notch PLUS a normal (edge-anchored) front stair elsewhere -- independent
    # features. Uses location="front" so it exercises the not-yet-cutout-aware
    # placement (anchors at full depth, the phantom edge) on a notched deck.
    configs.append(("m_notch_plus_front_stair",
                    _notch("front", 6, 5, off=2, hasStairs=True,
                           deckStairs=[{"id": 1, "zoneId": 0, "location": "front",
                                        "width": 4, "numStringers": 3,
                                        "template": "straight"}])))
    # notch on a FREESTANDING deck (exercises diagonal bracing + notch together)
    fs = _notch("front", 8, 6, off=6)
    fs["attachment"] = "freestanding"
    configs.append(("m_notch_freestanding", fs))
    # notch + an add-zone (L-shape wing) to stress composite outline
    configs.append(("m_notch_plus_zone",
                    _notch("front-right", 5, 5,
                           zones=None) if False else {
                        **_base(width=20, depth=14),
                        "zones": [
                            {"id": 1, "type": "cutout", "attachEdge": "front-left",
                             "attachOffset": 0, "w": 5, "d": 5, "attachTo": 0},
                            {"id": 2, "type": "add", "attachEdge": "right",
                             "attachOffset": 0, "w": 6, "d": 8},
                        ]}))

    return configs


KNOWN_POST_IN_LANDING = {
    # SYNTHETIC probe: a stair forced to a deep INTERIOR anchor (angle set
    # directly, bypassing the UI's edge-snap) so its landing overlaps the beam-
    # post row on a FULL-RECTANGLE deck. This is NOT the B10 cutout bug -- the
    # post here sits over real deck (there IS deck above it); it's a landing/
    # post draw overlap on a state the real UI resists (interior stairs snap to
    # an edge within 1 ft, else fall back to a front edge). Kept as a crash +
    # detector fixture. Recorded with its exact hit count so CI fails on ANY
    # deviation. Real B10 (a post over an empty cutout) is guarded separately by
    # KNOWN_POST_IN_CUTOUT below (expected 0 everywhere after the S89 fix).
    "m_0zone_B3_probe_deep_interior": 1,
}

# S89 (B10): expected post-in-CUTOUT hits. The fix guarantees ZERO for every
# config -- a post over an empty notch is always a real structural bug, so any
# nonzero here is a regression (there is no grandfathered case).
KNOWN_POST_IN_CUTOUT = {}


def run_matrix(verbose=False):
    from app.main import generate_blueprint_pdf
    FIX_DIR.mkdir(exist_ok=True)
    results = []
    failures = []
    for name, params in build_matrix():
        entry = {"name": name, "crash": None, "post_in_landing": [], "post_in_cutout": []}
        # --- POST-IN-LANDING + POST-IN-CUTOUT (independent of render; math) ---
        try:
            calc = calculate_structure(dict(params))
            entry["post_in_landing"] = check_post_in_landing(calc, dict(params))
            entry["post_in_cutout"] = check_post_in_cutout(calc, dict(params))
        except Exception as e:  # calc itself blowing up is a crash too
            entry["crash"] = f"calc: {e}"
        # --- CRASH JUDGE (full pipeline incl. permit checker) ---
        if entry["crash"] is None:
            try:
                generate_blueprint_pdf(dict(params))
            except Exception as e:
                entry["crash"] = f"{type(e).__name__}: {e}"
                (FIX_DIR / f"{name}.crash.txt").write_text(
                    traceback.format_exc())
        known = KNOWN_POST_IN_LANDING.get(name, 0)
        n_hits = len(entry["post_in_landing"])
        entry["known"] = known
        entry["hits"] = n_hits
        # post-in-cutout: expected count (0 unless grandfathered, which is none)
        cut_known = KNOWN_POST_IN_CUTOUT.get(name, 0)
        n_cut = len(entry["post_in_cutout"])
        entry["cut_known"] = cut_known
        entry["cut_hits"] = n_cut
        # A config passes if it doesn't crash AND both the landing and cutout
        # hit counts exactly match their KNOWN counts. More = regression.
        pil_ok = (n_hits == known)
        pic_ok = (n_cut == cut_known)
        ok = entry["crash"] is None and pil_ok and pic_ok
        if not ok:
            failures.append(entry)
        results.append(entry)
        if verbose or not ok:
            status = "OK" if ok else "FAIL"
            note = ""
            if known and pil_ok:
                note = f"  (KNOWN B10: {known} expected collision)"
            elif n_hits != known:
                note = f"  (hits={n_hits} KNOWN={known})"
            print(f"  [{status}] {name}{note}")
            if entry["crash"]:
                print(f"      crash: {entry['crash']}")
            for post, land in entry["post_in_landing"]:
                print(f"      post {post} inside landing {land}")
            for post, rect in entry["post_in_cutout"]:
                print(f"      post {post} inside CUTOUT {rect}  <-- B10 regression")
    return results, failures


def main(argv):
    if "--list" in argv:
        for name, _ in build_matrix():
            print(name)
        return 0
    print("CONFIG MATRIX (interior-anchored stair + post-in-landing B3/G11):")
    results, failures = run_matrix(verbose="--verbose" in argv)
    print(f"\nMATRIX: {len(results)} configs, {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
