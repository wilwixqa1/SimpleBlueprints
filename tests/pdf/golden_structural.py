#!/usr/bin/env python3
"""
Structural (vector) golden regression for the PDF draw pipeline.

WHY THIS EXISTS
---------------
The historical "flat invariant" check rendered a sheet to PNG and sha256'd the
pixels. That hash drifts WITHIN a single session and across containers because
of matplotlib font-cache / anti-alias changes, even when NO geometry changed
(see S90/S91/S92 retros -- it produced false regressions and cost real time).

This test instead captures the *drawing primitives* each draw_* function emits:
patch vertices, line coordinates, text position + string, colors, linestyles,
z-order. Those values are computed deterministically from the deck config and
contain NO pixel / font / anti-alias information, so they are immune to the
drift that broke the pixel hash. Coordinates and colors are rounded, so tiny
floating-point differences across platforms/versions don't register. The result
is an environment-INDEPENDENT golden you can commit, diff, and trust.

Properties proven when this was written:
  * identical across back-to-back renders in the same env (stable where the
    pixel hash was not);
  * changes when the geometry actually changes (a 1 ft stair shift moves the
    site + plan fingerprints);
  * unaffected sheets stay byte-identical (flat deck unchanged by a notch edit).

USAGE
-----
    python3 tests/pdf/golden_structural.py            # compare vs committed golden
    python3 tests/pdf/golden_structural.py --update   # regenerate the golden

Extend it by adding entries to CONFIGS or SHEETS; then --update and commit the
regenerated golden alongside the geometry change (the JSON diff shows exactly
what moved, which is the whole point).
"""
import sys
import os
import json
import argparse

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, os.path.join(_REPO, "backend"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.text import Annotation
from matplotlib.colors import to_rgba

from app.main import calculate_structure, build_permit_spec  # noqa: E402
from drawing.sheet import sheet_size, render_scale            # noqa: E402
from drawing.draw_plan import draw_plan_and_framing           # noqa: E402
from drawing.draw_site_plan import draw_site_plan             # noqa: E402
from drawing.draw_elevations import draw_elevations_sheet     # noqa: E402

GOLDEN_PATH = os.path.join(_HERE, "golden_structural.json")

COORD_DP = 3   # feet -> 0.001 ft, far above any float noise, below any real move
COLOR_DP = 4


# --------------------------------------------------------------------------
# Fixtures (self-contained; NO import of test modules, to avoid side effects).
# All dims stay inside generate_blueprint_pdf's clamp ranges so calling the
# draw functions directly matches the production pipeline.
# --------------------------------------------------------------------------
def _base(**over):
    p = dict(width=20, depth=14, height=4, houseWidth=40, houseDepth=30,
             attachment="ledger", joistSpacing=16, deckingType="composite",
             snowLoad="moderate", frostZone="cold", lotWidth=80, lotDepth=120,
             setbackFront=25, setbackSide=5, setbackRear=20, houseOffsetSide=20,
             beamType="dropped", framingType="wood")
    p.update(over)
    return p


def _front_cutout(w, d, off, zid=1):
    return {"id": zid, "type": "cutout", "attachEdge": "front",
            "attachOffset": off, "w": w, "d": d, "attachTo": 0}


def _interior_cutout(w, d, off, interiorY, zid=1):
    return {"id": zid, "type": "cutout", "attachEdge": "interior",
            "attachOffset": off, "interiorY": interiorY, "w": w, "d": d,
            "attachTo": 0}


def _front_stair(width, off=0, zid=0):
    return {"id": 0, "zoneId": zid, "location": "front", "offset": off,
            "width": width, "numStringers": 3}


def _sync_legacy(width, off=0):
    # Mirror _syncFlatStairParams: the site plan still reads the legacy stair
    # fields, so a fixture that should show a stair on the site plan must set
    # them to match its zone-0 front deckStairs entry.
    return dict(hasStairs=True, stairLocation="front",
                stairWidth=width, stairOffset=off)


# name -> params.  Covers: flat invariant, common front EDGE stair, case-A
# front-reaching notch + notch stair, case-B interior well (rail currently
# unhandled -- capturing it now means P1.b's fix will show as an explicit,
# reviewable golden diff).
CONFIGS = {
    "flat": _base(),
    "edge_stair_front": _base(
        deckStairs=[_front_stair(4)],
        **_sync_legacy(4)),
    "notch_front_stair": _base(
        width=27, depth=12,
        zones=[_front_cutout(4, 4, off=8)],
        deckStairs=[_front_stair(4)],
        **_sync_legacy(4)),
    "interior_well": _base(
        width=27, depth=14,
        zones=[_interior_cutout(5, 4, off=10, interiorY=5)]),
}


# --------------------------------------------------------------------------
# Sheets to capture.  (name, callable(fig, params, calc, spec), needs_spec)
# --------------------------------------------------------------------------
def _plan(fig, p, c, s):
    draw_plan_and_framing(fig, p, c, s, panels=("plan",))


def _framing(fig, p, c, s):
    draw_plan_and_framing(fig, p, c, s, panels=("framing",))


def _site(fig, p, c, s):
    draw_site_plan(fig, p, c)


def _elev(fig, p, c, s):
    draw_elevations_sheet(fig, p, c, s)


SHEETS = [
    ("site", _site),
    ("plan", _plan),
    ("framing", _framing),
    # Elevations is intentionally omitted: it emits ~1000 hatch/bracing
    # primitives per config (huge, noisy golden) and is not in the current
    # notch/stair work path. Add `("elevations", _elev)` here + --update if the
    # elevation sheet becomes an active work area.
]


# --------------------------------------------------------------------------
# Primitive extraction
# --------------------------------------------------------------------------
def _r(x, n=COORD_DP):
    try:
        return round(float(x), n)
    except (TypeError, ValueError):
        return x


def _rv(seq, n=COORD_DP):
    return [[_r(a, n), _r(b, n)] for (a, b) in seq]


def _color(c):
    try:
        return [round(v, COLOR_DP) for v in to_rgba(c)]
    except (ValueError, TypeError):
        return str(c)


def _extract_axes(ax):
    lines, patches, texts, annots = [], [], [], []
    for ln in list(ax.lines):
        lines.append({
            "xy": _rv(ln.get_xydata()),
            "ls": str(ln.get_linestyle()),
            "lw": _r(ln.get_linewidth()),
            "color": _color(ln.get_color()),
            "z": _r(ln.get_zorder()),
        })
    for p in list(ax.patches):
        try:
            verts = _rv(p.get_verts())
        except Exception:
            verts = None
        patches.append({
            "type": type(p).__name__,
            "verts": verts,
            "fc": _color(p.get_facecolor()),
            "ec": _color(p.get_edgecolor()),
            "ls": str(p.get_linestyle()),
            "lw": _r(p.get_linewidth()),
            "a": _r(p.get_alpha()),
            "z": _r(p.get_zorder()),
        })
    for t in list(ax.texts):
        if isinstance(t, Annotation):
            annots.append({
                "xy": [_r(t.xy[0]), _r(t.xy[1])],
                "xytext": [_r(t.get_position()[0]), _r(t.get_position()[1])],
                "s": t.get_text(),
                "z": _r(t.get_zorder()),
            })
        else:
            texts.append({
                "pos": [_r(t.get_position()[0]), _r(t.get_position()[1])],
                "s": t.get_text(),
                "rot": _r(t.get_rotation()),
                "ha": t.get_ha(),
                "va": t.get_va(),
                "color": _color(t.get_color()),
                "z": _r(t.get_zorder()),
            })

    def key(d):
        return json.dumps(d, sort_keys=True)

    return {
        "lines": sorted(lines, key=key),
        "patches": sorted(patches, key=key),
        "texts": sorted(texts, key=key),
        "annots": sorted(annots, key=key),
    }


def _capture_sheet(params, draw_fn, needs_spec):
    calc = calculate_structure(dict(params))
    spec = build_permit_spec(dict(params), calc)
    with render_scale():
        fig = plt.figure(figsize=sheet_size())
        fig.set_facecolor("white")
        draw_fn(fig, dict(params), calc, spec)
        axes = [_extract_axes(ax) for ax in fig.get_axes()]
        plt.close(fig)
    return axes


def capture_all():
    result = {}
    for cname, params in CONFIGS.items():
        result[cname] = {}
        for sname, fn in SHEETS:
            # needs_spec is irrelevant now (all wrappers take 4 args), kept for clarity
            result[cname][sname] = _capture_sheet(params, fn, True)
    return result


# --------------------------------------------------------------------------
# Comparison with a readable diff
# --------------------------------------------------------------------------
def _describe_diff(cname, sname, golden_axes, live_axes):
    msgs = []
    if len(golden_axes) != len(live_axes):
        msgs.append(f"    axes count: golden={len(golden_axes)} live={len(live_axes)}")
        return msgs
    for ai, (g_ax, l_ax) in enumerate(zip(golden_axes, live_axes)):
        for cat in ("patches", "lines", "texts", "annots"):
            g, l = g_ax.get(cat, []), l_ax.get(cat, [])
            if g == l:
                continue
            if len(g) != len(l):
                msgs.append(f"    axes[{ai}].{cat}: count golden={len(g)} live={len(l)}")
            # first differing element
            for i in range(min(len(g), len(l))):
                if g[i] != l[i]:
                    gj = json.dumps(g[i], sort_keys=True)
                    lj = json.dumps(l[i], sort_keys=True)
                    msgs.append(f"    axes[{ai}].{cat}[{i}] differs")
                    msgs.append(f"        golden: {gj[:180]}")
                    msgs.append(f"        live:   {lj[:180]}")
                    break
    return msgs


def compare(live, golden):
    failures = []
    checked = 0
    for cname in CONFIGS:
        for sname, _ in SHEETS:
            checked += 1
            if cname not in golden or sname not in golden.get(cname, {}):
                failures.append((cname, sname, ["    MISSING from golden (run --update)"]))
                continue
            g = golden[cname][sname]
            l = live[cname][sname]
            if g != l:
                failures.append((cname, sname, _describe_diff(cname, sname, g, l)))
    return checked, failures


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--update", action="store_true",
                    help="regenerate the committed golden")
    args = ap.parse_args()

    live = capture_all()

    if args.update:
        # Compact on purpose: the golden is regenerated wholesale via --update
        # and the human-facing diff is this test's failure output, not the file
        # itself -- so we optimize for a small repo footprint.
        with open(GOLDEN_PATH, "w") as f:
            json.dump(live, f, sort_keys=True, separators=(",", ":"))
        n = sum(len(v) for v in live.values())
        print(f"GOLDEN STRUCTURAL: wrote {n} sheet fingerprints to "
              f"{os.path.relpath(GOLDEN_PATH, _REPO)}")
        return 0

    if not os.path.exists(GOLDEN_PATH):
        print("GOLDEN STRUCTURAL: no golden found -- run with --update first")
        return 1

    with open(GOLDEN_PATH) as f:
        golden = json.load(f)

    checked, failures = compare(live, golden)

    if failures:
        print(f"GOLDEN STRUCTURAL: {len(failures)} of {checked} sheet(s) changed:\n")
        for cname, sname, msgs in failures:
            print(f"  [{cname} / {sname}]")
            for m in msgs:
                print(m)
            print()
        print("If the change is intended, re-run with --update and commit the "
              "golden diff alongside your change.")
        return 1

    print(f"GOLDEN STRUCTURAL: all {checked} sheet fingerprints match")
    return 0


if __name__ == "__main__":
    sys.exit(main())
