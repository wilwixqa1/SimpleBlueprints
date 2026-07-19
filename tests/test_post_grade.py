#!/usr/bin/env python3
"""S87: POST-TO-GRADE consistency test (permanent codification of the S85
hand-check).

THE INVARIANT: on every elevation view, the ground point of every post
(where the pier/footing is drawn) must lie exactly ON the drawn grade
profile at that post's x. A post floating above the dirt or buried
through it is the amateur tell examiners question -- S85 found piers
19.2in off grade and fixed the anchoring; this test keeps them fixed.

Method: monkeypatch draw_grade_line (records each view's grade geometry)
and _draw_underground_footing (records each post's (x, ground_y)), run
draw_elevations_sheet for several fixtures, then replay the grade
profile math (linear / bench pad / continuous) and assert every footing
sits on it within tolerance.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import drawing.draw_elevations as de
from drawing.calc_engine import calculate_structure
from drawing.permit_spec import build_permit_spec

TOL_FT = 1e-3

BASE = {
    "width": 16, "depth": 12, "height": 4, "attachment": "ledger",
    "joistDir": "width", "joistSpacing": 16, "beamType": "dropped",
    "deckingType": "composite", "frostZone": "cold", "snowLoad": "moderate",
    "zones": [], "deckStairs": [], "hasStairs": False,
}

FIXTURES = {
    "flat": dict(BASE),
    "slope15_l2r": dict(BASE, slopePercent=15, slopeDirection="left-to-right"),
    "slope10_f2b": dict(BASE, slopePercent=10, slopeDirection="front-to-back"),
    "slope15_freestanding": dict(BASE, attachment="freestanding",
                                 slopePercent=15,
                                 slopeDirection="left-to-right"),
}


def expected_grade_y(x, g):
    """Replay draw_grade_line's profile math for a recorded call g."""
    x1, x2, y, rise, house, style = g
    y1 = y - rise / 2
    y2 = y + rise / 2

    def lin(gx):
        return y1 + (y2 - y1) * (gx - x1) / max(x2 - x1, 0.01)

    has_house = bool(house and house[0] < house[1])
    if style == "bench" and has_house:
        hx1, hx2 = house
        if hx1 <= x <= hx2:
            return min(lin(hx1), lin(hx2))
    return lin(x)


def run_fixture(name, params, style):
    params = dict(params, _gradeStyle=style)
    calc = calculate_structure(params)
    spec = build_permit_spec(params, calc)

    grades = {}    # ax id -> grade params
    footings = []  # (ax id, post_x, ground_y)

    orig_grade = de.draw_grade_line
    orig_foot = de._draw_underground_footing

    def spy_grade(ax, x1, x2, y, slope_rise=0, slope_pct=None,
                  house_bounds=None, style="skip"):
        grades[id(ax)] = (x1, x2, y, slope_rise, house_bounds, style)
        return orig_grade(ax, x1, x2, y, slope_rise=slope_rise,
                          slope_pct=slope_pct, house_bounds=house_bounds,
                          style=style)

    def spy_foot(ax, post_x, ground_at_post, fd, fdep):
        footings.append((id(ax), post_x, ground_at_post))
        return orig_foot(ax, post_x, ground_at_post, fd, fdep)

    de.draw_grade_line = spy_grade
    de._draw_underground_footing = spy_foot
    try:
        fig = plt.figure(figsize=(14, 8.5))
        de.draw_elevations_sheet(fig, params, calc, spec=spec)
    finally:
        de.draw_grade_line = orig_grade
        de._draw_underground_footing = orig_foot
        plt.close("all")

    fails = []
    for axid, px, gy in footings:
        g = grades.get(axid)
        if g is None:
            fails.append((px, gy, None, "no grade line on this view"))
            continue
        exp = expected_grade_y(px, g)
        if abs(gy - exp) > TOL_FT:
            fails.append((px, gy, exp, f"off by {gy - exp:+.3f} ft"))
    return len(footings), fails


def main():
    # S87: two REAL bugs found the day this test was born, documented as
    # B7/B8 (fix needs eyes + Will's call on drawing convention):
    #  B7 bench-pad vs pier anchoring: S/N views, lateral slope -- piers
    #     inside the house-cut span anchor to the natural slope and float
    #     above the drawn pad (worst seen: +2.1 ft).
    #  B8 depth-plane mismatch: front-to-back slope -- S/N grade line drawn
    #     at deck-center elevation, piers grounded at their true front
    #     elevation, punching below the drawn line (-1.05 ft).
    # KNOWN maps (style, fixture) -> exact expected failure count. CI fails
    # on ANY deviation: new failures = regression; fewer = a fix landed,
    # tighten this table in the same push.
    KNOWN = {
        ("bench", "slope15_l2r"): 6,          # B7
        ("bench", "slope10_f2b"): 6,          # B8
        ("bench", "slope15_freestanding"): 6,  # B7
        ("continuous", "slope10_f2b"): 6,     # B8
    }
    total_posts = 0
    unexpected = 0
    for style in ("bench", "continuous"):
        for name, params in FIXTURES.items():
            n, fails = run_fixture(name, params, style)
            total_posts += n
            allowed = KNOWN.get((style, name), 0)
            if n == 0:
                print(f"  [{style:10s}] {name:22s} NO FOOTINGS RECORDED "
                      f"(spy broken?)")
                unexpected += 1
                continue
            if len(fails) == allowed:
                tag = "OK" if allowed == 0 else f"OK ({allowed} known: B7/B8)"
            else:
                tag = (f"DEVIATION: {len(fails)} failures, "
                       f"{allowed} known")
                unexpected += 1
            print(f"  [{style:10s}] {name:22s} posts: {n:2d}  {tag}")
            if len(fails) != allowed:
                for px, gy, exp, msg in fails:
                    print(f"      post@x={px:.2f} ground={gy:.3f} "
                          f"expected={exp} -- {msg}")
    print(f"POST-TO-GRADE: {total_posts} posts checked, "
          f"{unexpected} unexpected deviations")
    sys.exit(1 if unexpected else 0)


if __name__ == "__main__":
    main()
