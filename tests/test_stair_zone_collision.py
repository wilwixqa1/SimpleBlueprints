"""S108: stairs whose RUN crosses another deck section (Will's 3rd bug).

THE BUG: a zone-0 stair dragged to Deck A's left edge runs its full descent
over Deck B's footprint. Opening synthesis clips the run to the stair's OWN
zone frame (0..W x 0..D), so the 28 sq ft overlap with Deck B is discarded:
the 3D drew the run straight through Deck B's slab, the plan overlapped
silently, and the A-2 framing sheet would have shipped Deck B with an intact
joist field and no stairwell.

THE RULE (interior-opening precedent -- refuse, never half-frame): sections
have no beam-layout/opening machinery, so a stair crossing one is DETECTED
(zone_utils.get_stair_zone_collisions / zoneUtils.getStairZoneCollisions,
kept in lockstep), WARNED in both calc engines, ERRORED in the permit
pre-check (STAIR_SECTION_COLLISION), and surfaced as a step-4 advisory.
Connecting stairs (_landsOnZoneId) sit over their landing zone by design and
are excluded. Framing an actual stairwell through a section is an S109+
feature (needs section beam layout + Billy).

Pins:
  Z1  detection: the repro flags Deck B at 28 sq ft; symmetric on Deck C
  Z2  exclusions: connecting stair, open-edge stair, no-zones deck
  Z3  JS mirror emits the identical collision list (id/zone/area)
  Z4  both calc engines carry the warning; verdicts agree per config
  Z5  permit checker: fail on the repro, pass on the clean config
"""

import copy
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))
os.chdir(ROOT)

from drawing.zone_utils import get_stair_zone_collisions  # noqa: E402
from drawing.calc_engine import calculate_structure  # noqa: E402
from drawing.permit_spec import build_permit_spec  # noqa: E402
from drawing.permit_checker import run_checks  # noqa: E402

fails = []


def check(name, cond, detail=""):
    print("  %-64s %s" % (name, "ok" if cond else "FAIL " + str(detail)))
    if not cond:
        fails.append(name)


def base_params():
    return dict(
        width=22, depth=12, height=5.5, houseWidth=40, houseDepth=30,
        attachment="ledger", joistSpacing=16, deckingType="composite",
        snowLoad="moderate", frostZone="cold", lotWidth=80, lotDepth=120,
        setbackFront=25, setbackSide=5, setbackRear=20, houseOffsetSide=20,
        beamType="dropped", framingType="wood", railType="steel",
        hasStairs=True,
        zones=[dict(id=1, type="add", attachTo=0, attachEdge="left",
                    attachOffset=0, w=12, d=8),
               dict(id=2, type="add", attachTo=0, attachEdge="right",
                    attachOffset=0, w=12, d=8)],
        deckStairs=[dict(id=1, zoneId=0, location="left", offset=0, width=4,
                         numStringers=3, template="straight",
                         anchorX=0, anchorY=6, angle=270)])


def stair_warns(calc):
    return any("Stair passes through" in w for w in calc.get("warnings", []))


print("Z1. detection")
repro = base_params()
cols = get_stair_zone_collisions(repro)
check("Z1a repro flags exactly Deck B",
      len(cols) == 1 and cols[0]["zone_id"] == 1
      and cols[0]["zone_name"] == "Deck B", cols)
check("Z1b overlap area is the full 7x4 run (28 sq ft)",
      cols and abs(cols[0]["area"] - 28.0) < 0.01, cols)
right = copy.deepcopy(repro)
right["deckStairs"][0].update(location="right", anchorX=22, angle=90)
cols_r = get_stair_zone_collisions(right)
check("Z1c symmetric: right-edge stair flags Deck C",
      len(cols_r) == 1 and cols_r[0]["zone_id"] == 2
      and cols_r[0]["zone_name"] == "Deck C", cols_r)


print("Z2. exclusions")
# A REAL connecting stair: Deck B sits 3.5 ft lower, so the resolved run has
# an actual footprint over Deck B. With zero rise the geometry is empty and
# the exclusion never fires (a landing-exclusion mutation survived that
# fixture at S108 push 3 -- this one kills it).
conn = copy.deepcopy(repro)
conn["zones"][0]["h"] = 2
conn["deckStairs"][0]["_landsOnZoneId"] = 1
check("Z2a fixture is live: without the exclusion this run overlaps B",
      True)  # asserted structurally by Z2b vs Z2c below
check("Z2b connecting stair to Deck B is excluded",
      get_stair_zone_collisions(conn) == [], get_stair_zone_collisions(conn))
grade = copy.deepcopy(conn)
del grade["deckStairs"][0]["_landsOnZoneId"]
cols_g = get_stair_zone_collisions(grade)
check("Z2c same stair WITHOUT the destination flags Deck B (exclusion live)",
      len(cols_g) == 1 and cols_g[0]["zone_id"] == 1, cols_g)
front = copy.deepcopy(repro)
front["deckStairs"] = [dict(id=1, zoneId=0, location="front", offset=0,
                            width=4, numStringers=3, template="straight")]
check("Z2d open-edge (front) stair is clean",
      get_stair_zone_collisions(front) == [])
nozones = copy.deepcopy(repro)
nozones["zones"] = []
check("Z2e no sections: nothing to cross",
      get_stair_zone_collisions(nozones) == [])


print("Z3. JS mirror emits the identical collision list")
node_src = (
    'const fs=require("fs");global.window=global;'
    'eval(fs.readFileSync("backend/static/js/zoneUtils.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/stairGeometry.js","utf8"));'
    'const p=JSON.parse(process.argv[1]);'
    'console.log(JSON.stringify(window.getStairZoneCollisions(p)));'
)
for name, cfg, py_cols in [("repro", repro, cols), ("right", right, cols_r),
                           ("connecting", conn, []), ("front", front, [])]:
    r = subprocess.run(["node", "-e", node_src, json.dumps(cfg)],
                       capture_output=True, text=True)
    js = json.loads(r.stdout) if r.returncode == 0 else None
    js_norm = ([{"stair_id": c["stairId"], "zone_id": c["zoneId"],
                 "zone_name": c["zoneName"], "area": c["area"]}
                for c in js] if js is not None else None)
    check("Z3 %-11s js == py" % name, js_norm == py_cols,
          "js=%s py=%s err=%s" % (js_norm, py_cols, r.stderr[:120]))


print("Z4. both calc engines carry the warning; verdicts agree")
node_calc = (
    'const fs=require("fs");global.window=global;'
    'eval(fs.readFileSync("backend/static/js/zoneUtils.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/stairGeometry.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/engine.js","utf8"));'
    'const p=JSON.parse(process.argv[1]);'
    'p.deckWidth=p.width;p.deckDepth=p.depth;'
    'const c=window.calcStructure(p);'
    'console.log(JSON.stringify({warn:(c.warnings||[]).some('
    'w=>w.indexOf("Stair passes through")>=0)}));'
)
for name, cfg, expect in [("repro wood", repro, True),
                          ("front clean", front, False),
                          ("connecting", conn, False)]:
    c = calculate_structure(cfg)
    check("Z4 %-11s python warns == %s" % (name, expect),
          stair_warns(c) == expect, c.get("warnings"))
    r = subprocess.run(["node", "-e", node_calc, json.dumps(cfg)],
                       capture_output=True, text=True)
    js = json.loads(r.stdout) if r.returncode == 0 else None
    check("Z4 %-11s js verdict matches" % name,
          js is not None and js["warn"] == expect,
          "js=%s err=%s" % (js, r.stderr[:120]))
steel = copy.deepcopy(repro)
steel["framingType"] = "steel"
check("Z4 steel path warns too", stair_warns(calculate_structure(steel)),
      calculate_structure(steel).get("warnings"))


print("Z5. permit checker")
def collision_check(cfg):
    calc = calculate_structure(cfg)
    spec = build_permit_spec(cfg, calc)
    rep = run_checks("deck", cfg, calc, spec)
    res = [r for r in rep.checks if r.id == "STAIR_SECTION_COLLISION"]
    return res[0] if res else None

r_bad = collision_check(repro)
check("Z5a repro fails STAIR_SECTION_COLLISION",
      r_bad is not None and r_bad.status == "fail" and r_bad.severity == "error",
      r_bad.status if r_bad else "missing")
check("Z5b detail names the deck and the area",
      r_bad is not None and "Deck B" in (r_bad.detail or "")
      and "28.0" in (r_bad.detail or ""), r_bad.detail if r_bad else "")
r_ok = collision_check(front)
check("Z5c clean config passes",
      r_ok is not None and r_ok.status == "pass",
      r_ok.status if r_ok else "missing")

print()
if fails:
    print("STAIR ZONE COLLISION: %d FAILURE(S): %s" % (len(fails), fails))
    sys.exit(1)
print("STAIR ZONE COLLISION: all checks passed")
