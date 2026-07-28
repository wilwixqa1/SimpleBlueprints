#!/usr/bin/env python3
"""Structural invariants: checks against physics, not against another surface.

WHY THIS EXISTS (S106, Will's level-sections find)
--------------------------------------------------
Every consistency test in this repo verifies AGREEMENT: engine vs engine,
scene vs engine, estimate vs sheet. Agreement tests cannot see consistent
wrongness. Measured example: level deck sections get beamType "flush" and
the flush branch emits NO beam, NO posts, NO footings for the entire
section -- an 11.5ft platform hanging in the air off joist hangers. Both
engines agreed, the 3D faithfully drew nothing, the estimate faithfully
billed nothing, and every parity test stayed green.

This suite asserts things that must be true of ANY buildable deck,
independent of what any other surface says:

  I1  every additive section is supported: a beam with >= 2 posts, or an
      explicit flush model that still provides far-edge support
  I2  posts == footings, everywhere, always
  I3  a freestanding deck has two beam rows, post rows mirrored
  I4  no post stands inside a stair opening
  I5  every beam segment with span > 0 carries at least one post

KNOWN FAILURES are registered in EXPECTED_FAILURES with the S107 work item
that owns them. They are printed loudly and do NOT fail the gate; anything
NOT registered does. S107 burns this list down to empty; adding to it
requires a named work item.

Run: python3 tests/test_structural_invariants.py
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))
os.chdir(ROOT)

from drawing.calc_engine import calculate_structure  # noqa: E402
from drawing.zone_utils import get_opening_rects  # noqa: E402

# ---------------------------------------------------------------------------
# The xfail register. Every entry names the S107 work item that owns it.
# Deleting the fix without deleting the entry keeps the gate green -- so the
# entries are ALSO asserted to still fail, and a fixed entry left registered
# turns the suite red until it is removed (no silently stale register).
EXPECTED_FAILURES = {
    ("I1", "level_sections_flush"):
        "S107: a FLUSH section at deck height gets rim/0-posts/0-footings "
        "for the WHOLE section (engine.js calcAllZones flush branch). Flush "
        "may only remove the SHARED-edge beam; the far edge still needs a "
        "beam on posts. Reproduced from Will's 22ft + B/C design, "
        "2026-07-28. Backend zone framing must gain the same model.",
}

BASE = dict(width=22, depth=12, height=4, houseWidth=45.5, houseDepth=30,
            attachment="ledger", joistSpacing=16, deckingType="composite",
            railType="steel", framingType="wood", beamType="dropped",
            snowLoad="moderate", frostZone="cold", lotWidth=80, lotDepth=120,
            setbackFront=25, setbackSide=5, setbackRear=20,
            houseOffsetSide=20, nextZoneId=3)


def sections(h, bt="dropped"):
    return [{"id": 1, "type": "add", "attachEdge": "left", "attachOffset": 0,
             "w": 8, "d": 11.5, "h": h, "attachTo": 0, "label": "Zone 1",
             "joistDir": "perpendicular", "beamType": bt, "stairs": None},
            {"id": 2, "type": "add", "attachEdge": "right", "attachOffset": 0,
             "w": 8, "d": 12, "h": h, "attachTo": 0, "label": "Zone 2",
             "joistDir": "perpendicular", "beamType": bt, "stairs": None}]


CONFIGS = {
    "plain_ledger": dict(BASE),
    "plain_freestanding": dict(BASE, attachment="freestanding"),
    "touching_front_stair": dict(BASE, deckStairs=[
        {"id": 0, "zoneId": 0, "location": "front", "offset": 0, "width": 4,
         "numStringers": 3, "anchorX": 19.0, "anchorY": 10.5, "angle": 0}]),
    "freestanding_corner_stair": dict(BASE, attachment="freestanding",
                                      deckStairs=[
        {"id": 0, "zoneId": 0, "location": "front", "offset": 0, "width": 4,
         "numStringers": 3, "anchorX": 19.0, "anchorY": 10.5, "angle": 0}]),
    # Will's real state: flush at deck height -> zero structure. Registered.
    "level_sections_flush": dict(BASE, zones=sections(4, bt="flush")),
    # dropped-beam sections must be fully supported at any height
    "level_sections_dropped": dict(BASE, zones=sections(None)),
    "raised_sections": dict(BASE, zones=sections(4.5)),
    "front_cutout": dict(BASE, nextZoneId=2, zones=[
        {"id": 1, "type": "cutout", "attachEdge": "front", "attachOffset": 9,
         "w": 4, "d": 3, "h": None, "attachTo": 0, "label": "Cutout",
         "joistDir": "perpendicular", "beamType": "dropped", "stairs": None}]),
}

# Frontend zone structure (backend has none yet -- itself an S107 target):
NODE = (
    'const fs=require("fs");global.window=global;'
    'eval(fs.readFileSync("backend/static/js/zoneUtils.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/stairGeometry.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/engine.js","utf8"));'
    'const p=JSON.parse(process.argv[1]);'
    'const c=window.calcStructure(p);'
    'const zc=window.calcAllZones?window.calcAllZones(p,c):null;'
    'console.log(JSON.stringify({zoneCalcs: zc?zc.zoneCalcs:null,'
    ' extraPosts: zc?zc.extraPosts:0, extraFootings: zc?zc.extraFootings:0}));'
)


def violations(name, p):
    """Return a list of (invariant, message) violations for one config."""
    out = []
    c = calculate_structure(p)

    # I2: posts == footings
    if c["total_posts"] != c["num_footings"]:
        out.append(("I2", "posts %s != footings %s"
                    % (c["total_posts"], c["num_footings"])))

    # I3: freestanding rows
    if p.get("attachment") == "freestanding":
        rows = sorted(set(round(y, 2) for (_x, y) in c["beam_layout"]["post_xy"]))
        if len(rows) != 2:
            out.append(("I3", "freestanding has %d beam rows: %s"
                        % (len(rows), rows)))
        else:
            xs = [sorted(x for (x, y) in c["beam_layout"]["post_xy"]
                         if round(y, 2) == r) for r in rows]
            if xs[0] != xs[1]:
                out.append(("I3", "post rows not mirrored: %s vs %s"
                            % (xs[0], xs[1])))

    # I4: no post inside a stair opening
    for r in get_opening_rects(p):
        if r.get("source") != "stair":
            continue
        rr = r["rect"]
        for (x, y) in c["beam_layout"]["post_xy"]:
            if (rr["x"] + 1e-6 < x < rr["x"] + rr["w"] - 1e-6
                    and rr["y"] - 0.01 <= y <= rr["y"] + rr["d"] + 0.01):
                out.append(("I4", "post (%.2f, %.2f) inside stair opening "
                            "x[%.2f..%.2f]" % (x, y, rr["x"], rr["x"] + rr["w"])))

    # I5: every real segment carries a post
    for seg in c["beam_layout"]["segments"]:
        if seg["x1"] - seg["x0"] > 0.5 and not seg["posts"]:
            out.append(("I5", "beam segment x[%.2f..%.2f] has no posts"
                        % (seg["x0"], seg["x1"])))

    # I1: every additive section is supported. Zone structure lives in the
    # frontend only, so ask it.
    adds = [z for z in (p.get("zones") or []) if z.get("type") != "cutout"]
    if adds:
        r = subprocess.run(["node", "-e", NODE, json.dumps(p)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            out.append(("I1", "frontend zone calc failed: " + r.stderr[:120]))
        else:
            zc = json.loads(r.stdout)
            zcs = zc.get("zoneCalcs") or []
            for z, zi in zip(adds, [x for x in zcs if x is not None]):
                n_posts = (zi or {}).get("nPosts") or 0
                depth_ft = z["w"] if z["attachEdge"] in ("left", "right") else z["d"]
                if depth_ft > 2.0 and n_posts < 2:
                    out.append(("I1", "section '%s' (%.1fft out) has %d posts "
                                "and beam '%s': unsupported free edge"
                                % (z["label"], depth_ft, n_posts,
                                   (zi or {}).get("beamSize"))))
            # the section's support must also be REAL: reach the totals
            if zc.get("extraFootings", 0) != zc.get("extraPosts", 0):
                out.append(("I2", "zone extraPosts %s != extraFootings %s"
                            % (zc.get("extraPosts"), zc.get("extraFootings"))))
    return out


fails, stale = [], []
print("structural invariants over %d configs:" % len(CONFIGS))
for name, p in CONFIGS.items():
    vio = violations(name, p)
    expected = {k[0] for k in EXPECTED_FAILURES if k[1] == name}
    hit = {v[0] for v in vio}
    for inv, msg in vio:
        if inv in expected:
            print("  KNOWN-S107  %-28s %s: %s" % (name, inv, msg))
        else:
            print("  VIOLATION   %-28s %s: %s" % (name, inv, msg))
            fails.append((name, inv, msg))
    for inv in expected - hit:
        stale.append((name, inv))
        print("  STALE-XFAIL %-28s %s registered but no longer fails -- "
              "remove it from EXPECTED_FAILURES" % (name, inv))
    if not vio and not expected:
        print("  ok          %-28s" % name)

print()
if fails or stale:
    print("FAILED: %d unregistered violations, %d stale register entries"
          % (len(fails), len(stale)))
    sys.exit(1)
known = sum(1 for _ in EXPECTED_FAILURES)
print("PASS  invariants hold everywhere except %d registered S107 items" % known)
