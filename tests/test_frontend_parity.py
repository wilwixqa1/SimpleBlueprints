"""Frontend/backend geometry parity (P1.a anti-drift guard).

S91 changed the backend stair anchor (P1.2) and notch-aware guardrail (P1.4a).
S92 (P1.a) brought the live preview into line. The two implementations use
different algorithms (the JS railing is an occupancy scan; the backend builds a
vertex loop), so they can silently diverge on a code change. This test runs BOTH
on the same configs and asserts they agree on:

  * front_edge_profile            (stair-anchor primitive)
  * get_stair_placement_for_zone  (notch-aware front anchor)
  * stair openings                (rail gap where a front stair descends)
  * get_exposed_edges             (guardrail, with the opening subtracted)

Reference for the opening COMPOSITION is draw_plan.py (world anchors of the
resolved front stairs, gated to notched decks); the JS side is
computeStairOpenings(). Both compose the same public primitives, so a drift in
either the primitives or the composition changes the final edges and trips here.

Run: python3 tests/test_frontend_parity.py   -> "FRONTEND PARITY: all checks passed"
Requires node on PATH (same as the JS geometry suite).
"""
import json
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
PROBE = Path(__file__).resolve().parents[1] / "tests" / "geometry" / "parity_probe.js"
sys.path.insert(0, str(BACKEND))

from drawing.beam_layout import front_edge_profile  # noqa: E402
from drawing.stair_utils import get_stair_placement_for_zone  # noqa: E402
from drawing.zone_utils import (  # noqa: E402
    get_cutout_rects, get_exposed_edges,
)


def _cutout(edge, w, d, off=0, zid=1):
    return {"id": zid, "type": "cutout", "attachEdge": edge,
            "attachOffset": off, "w": w, "d": d, "attachTo": 0}


def _stair(off=0, width=4, zid=0, loc="front"):
    return {"id": 0, "zoneId": zid, "location": loc, "offset": off,
            "width": width, "numStringers": 3}


# (name, W, D, zones, deckStairs)
CONFIGS = [
    ("flat, no stairs", 20, 14, [], []),
    ("flat + front stair", 20, 14, [], [_stair()]),
    ("centered 4ft notch + front stair", 20, 14,
     [_cutout("front", 4, 4, off=8)], [_stair()]),
    ("off-center notch + matching stair", 20, 14,
     [_cutout("front", 4, 5, off=4)], [_stair(off=-4)]),
    ("notch, NO stair (rail wraps, no opening)", 20, 14,
     [_cutout("front", 6, 5, off=7)], []),
    ("front-left notch + front stair", 18, 12,
     [_cutout("front-left", 5, 4)], [_stair(off=-6.5, width=5)]),
    # S94/P0: multi-stair -- the config class the old single-stair site-plan
    # preview could not draw. Notch-aligned front stair + a right side stair.
    ("notch + front stair + right side stair", 20, 14,
     [_cutout("front", 4, 4, off=8)],
     [_stair(off=0, width=4), _stair(off=1, width=4, zid=0, loc="right")]),
]


def _canon_edge(e):
    p1 = (round(e["x1"], 2), round(e["y1"], 2))
    p2 = (round(e["x2"], 2), round(e["y2"], 2))
    lo, hi = sorted([p1, p2])
    return (e["dir"], lo, hi)


def _canon_edges(edges):
    return sorted(_canon_edge(e) for e in edges)


def _canon_prof(prof):
    return [(round(a, 2), round(b, 2), round(ey, 2)) for (a, b, ey) in prof]


def _canon_openings(ops):
    if not ops:
        return []
    return sorted((round(o[0], 2), round(o[1], 2), round(o[2], 2)) for o in ops)


def _py_openings(W, D, zones, deck_stairs):
    """Mirror draw_plan.py: front stairs on a notched deck, world anchors."""
    params = {"width": W, "depth": D, "zones": zones}
    cuts = get_cutout_rects(params)
    if not cuts:
        return None
    prof = front_edge_profile(float(W), float(D), cuts)
    has_front = len(prof) > 1 or (prof and abs(prof[0][2] - float(D)) > 1e-6)
    if not has_front:
        return None
    ops = []
    for st in deck_stairs:
        zone_id = st.get("zoneId", 0)
        # Only zone 0 exists as a cutout host in these configs; zone rect = origin.
        zr = {"x": 0.0, "y": 0.0, "w": float(W), "d": float(D)}
        fp = prof if zone_id == 0 else None
        pl = get_stair_placement_for_zone(st, zr, fp)
        if int(round(pl["angle"])) % 360 != 0:
            continue
        sw = float(st.get("width", 4))
        wax = zr["x"] + pl["anchor_x"]
        way = zr["y"] + pl["anchor_y"]
        ops.append((way, wax - sw / 2.0, wax + sw / 2.0))
    return ops or None


def _canon_resolved_py(rs_list):
    return sorted(
        (round(r["world_anchor_x"], 2), round(r["world_anchor_y"], 2),
         int(round(r["angle"])), r["exit_side"],
         round(float(r["elevation_info"]["totalRise"]), 2))
        for r in rs_list)


def _canon_resolved_js(rs_list):
    return sorted(
        (round(r["worldAnchorX"], 2), round(r["worldAnchorY"], 2),
         int(round(r["angle"])), r["exitSide"],
         round(float(r["elevationInfo"]["totalRise"]), 2))
        for r in rs_list)


def _check_legacy_fallback():
    """S94/P0: the resolver's backward-compat path (hasStairs, no deckStairs)
    must agree between JS resolveAllStairs and Python resolve_all_stairs."""
    from drawing.stair_utils import resolve_all_stairs, compute_stair_info
    W, D, H = 20, 14, 5
    params = {"width": W, "depth": D, "zones": [], "hasStairs": True,
              "stairLocation": "right", "stairOffset": 2, "stairWidth": 5,
              "height": H}
    calc = {"width": W, "depth": D, "stairs": compute_stair_info(H, 5, 3)}
    py = resolve_all_stairs(params, calc)
    js_in = {"deckWidth": W, "deckDepth": D, "zones": [], "hasStairs": True,
             "stairLocation": "right", "stairOffset": 2, "stairWidth": 5,
             "height": H}
    out = subprocess.run(["node", str(PROBE), json.dumps(js_in)],
                         capture_output=True, text=True)
    if out.returncode != 0:
        print("  [FAIL] legacy fallback: node error: %s"
              % out.stderr.strip()[:200])
        return 1
    js = json.loads(out.stdout)
    pyv = _canon_resolved_py(py)
    jsv = _canon_resolved_js(js["resolvedStairs"])
    if pyv != jsv:
        print("  [FAIL] legacy fallback resolvedStairs mismatch")
        print("         PY: %s" % (pyv,))
        print("         JS: %s" % (jsv,))
        return 1
    print("  [OK  ] legacy hasStairs fallback (resolver)")
    return 0


def _run():
    from drawing.stair_utils import resolve_all_stairs
    failures = 0
    for name, W, D, zones, stairs in CONFIGS:
        params = {"width": W, "depth": D, "zones": zones}
        cuts = get_cutout_rects(params)
        py_prof = front_edge_profile(float(W), float(D), cuts)
        st = next((s for s in stairs if s.get("zoneId", 0) == 0
                   and s.get("location", "front") == "front"),
                  {"location": "front", "offset": 0, "width": 4})
        py_anchor = get_stair_placement_for_zone(
            st, {"x": 0, "y": 0, "w": float(W), "d": float(D)}, py_prof)
        py_ops = _py_openings(W, D, zones, stairs)
        py_edges = get_exposed_edges(params, stair_openings=py_ops)

        js_in = {"deckWidth": W, "deckDepth": D, "zones": zones, "deckStairs": stairs}
        out = subprocess.run(
            ["node", str(PROBE), json.dumps(js_in)],
            capture_output=True, text=True)
        if out.returncode != 0:
            print("  [FAIL] %-40s node error: %s" % (name, out.stderr.strip()[:200]))
            failures += 1
            continue
        js = json.loads(out.stdout)

        checks = [
            ("profile", _canon_prof(py_prof), _canon_prof(js["profile"])),
            ("anchor",
             (round(py_anchor["anchor_x"], 2), round(py_anchor["anchor_y"], 2),
              int(round(py_anchor["angle"]))),
             (round(js["anchor"]["anchorX"], 2), round(js["anchor"]["anchorY"], 2),
              int(round(js["anchor"]["angle"])))),
            ("openings", _canon_openings(py_ops), _canon_openings(js["openings"])),
            ("edges", _canon_edges(py_edges), _canon_edges(js["edges"])),
            # S94/P0: shared multi-stair resolver (site-plan preview path)
            ("resolvedStairs",
             _canon_resolved_py(resolve_all_stairs(
                 {"width": W, "depth": D, "zones": zones,
                  "deckStairs": stairs, "height": 4},
                 {"width": W, "depth": D})) if stairs else [],
             _canon_resolved_js(js["resolvedStairs"])),
        ]
        ok = True
        for label, pyv, jsv in checks:
            if pyv != jsv:
                ok = False
                failures += 1
                print("  [FAIL] %-40s %s mismatch" % (name, label))
                print("         PY: %s" % (pyv,))
                print("         JS: %s" % (jsv,))
        if ok:
            print("  [OK  ] %s" % name)

    failures += _check_legacy_fallback()

    print()
    if failures:
        print("FRONTEND PARITY: %d check(s) FAILED" % failures)
        sys.exit(1)
    print("FRONTEND PARITY: all checks passed")


if __name__ == "__main__":
    _run()
