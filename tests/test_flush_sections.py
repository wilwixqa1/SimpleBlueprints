"""
S107 push 1: flush sections mean SHARED-EDGE ONLY.

The rule (from Will's 22ft + B/C design, 2026-07-28, and the S106 lesson):
a "flush" additive section at deck height hangs its joists off Deck A's rim
at the shared edge (LUS26/LUS210 hangers). The FAR edge always gets a
dropped beam on posts and footings, directly under the section's outer rim
(beam setback 0; dropped sections keep the 1.5ft setback / cantilever).
A section whose height differs from the main deck is never flush (S81 rule),
in BOTH engines -- the backend used to read beamType raw.

This suite pins:
  R1  frontend calcAllZones gives flush sections real structure
  R2  flush setback is 0, dropped setback is 1.5 (joist span tells)
  R3  raised "flush" is forced to dropped in both engines
  R4  frontend zoneCalcs and backend zone_calcs agree member-for-member
  R5  the framing sheet geometry puts the flush beam under the outer rim,
      with the same post count the engines size for
  R6  spec post totals count flush-section posts (cover sheet source)
  R7  the height-key fix: getEffectiveBeamType sees raw params' `height`

Run: python3 tests/test_flush_sections.py
"""
import json
import math
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))
os.chdir(ROOT)

from drawing.calc_engine import calculate_structure          # noqa: E402
from drawing.permit_spec import build_permit_spec            # noqa: E402
from drawing.draw_plan import compute_zone_framing           # noqa: E402
from drawing.zone_utils import effective_beam_type           # noqa: E402

FAILS = []


def check(cond, msg):
    if cond:
        print("  ok   " + msg)
    else:
        print("  FAIL " + msg)
        FAILS.append(msg)


def base_params(height=4.0, zones=None):
    return dict(width=22, depth=12, height=height, houseWidth=45.5,
                houseDepth=30, attachment="ledger", joistSpacing=16,
                deckingType="composite", railType="steel",
                framingType="wood", beamType="dropped",
                snowLoad="moderate", frostZone="cold",
                lotWidth=80, lotDepth=120, setbackFront=25, setbackSide=5,
                setbackRear=20, houseOffsetSide=20, nextZoneId=3,
                zones=zones or [])


def section(zid, edge, w, d, h, bt, label):
    return {"id": zid, "type": "add", "attachEdge": edge, "attachOffset": 0,
            "w": w, "d": d, "h": h, "attachTo": 0, "label": label,
            "joistDir": "perpendicular", "beamType": bt, "stairs": None}


NODE = (
    'const fs=require("fs");global.window=global;'
    'eval(fs.readFileSync("backend/static/js/zoneUtils.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/stairGeometry.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/engine.js","utf8"));'
    'const p=JSON.parse(process.argv[1]);'
    'const c=window.calcStructure(p);'
    'const zc=window.calcAllZones(p,c);'
    'const ebt=(p.zones||[]).map(z=>window.getEffectiveBeamType(z,p));'
    'console.log(JSON.stringify({zoneCalcs:zc?zc.zoneCalcs:null,'
    ' extraPosts:zc?zc.extraPosts:0, extraFootings:zc?zc.extraFootings:0,'
    ' ebt:ebt}));'
)


def frontend(p):
    r = subprocess.run(["node", "-e", NODE, json.dumps(p)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("frontend calc failed: " + r.stderr[:300])
    return json.loads(r.stdout)


print("R1/R2: flush section gets far-edge structure, setback 0")
p = base_params(zones=[section(1, "left", 8, 11.5, 4.0, "flush", "Zone 1"),
                       section(2, "front", 10, 6, 4.0, "dropped", "Zone 2")])
fe = frontend(p)
z1, z2 = fe["zoneCalcs"]
check(z1["beamType"] == "flush", "left flush section stays flush at deck height")
check(z1["nPosts"] >= 2, "flush section has posts (%s)" % z1["nPosts"])
check(z1["fDiam"] > 0, "flush section has footings (%s in)" % z1["fDiam"])
check(z1["beamSize"] not in ("rim", "", None), "flush far-edge beam is a real member (%s)" % z1["beamSize"])
check(z1["beamSpan"] > 0, "flush beam has a span (%s ft)" % z1["beamSpan"])
check(abs(z1["jSpan"] - 8.0) < 0.05, "flush joists span the FULL 8.0 ft (setback 0), got %s" % z1["jSpan"])
check(abs(z2["jSpan"] - (6 - 1.5)) < 0.05, "dropped joists span depth-1.5 = 4.5 ft, got %s" % z2["jSpan"])
check(fe["extraPosts"] == fe["extraFootings"] and fe["extraPosts"] >= 5,
      "posts==footings and both sections counted (%s)" % fe["extraPosts"])

print("R3: raised 'flush' forced to dropped, both engines")
pr = base_params(zones=[section(1, "left", 8, 11.5, 4.5, "flush", "Zone 1")])
fer = frontend(pr)
check(fer["ebt"][0] == "dropped", "JS effective type: raised flush -> dropped")
check(fer["zoneCalcs"][0]["beamType"] == "dropped", "JS zoneCalcs records dropped")
check(effective_beam_type(pr["zones"][0], pr) == "dropped", "PY effective type: raised flush -> dropped")
calc_r = calculate_structure(pr)
spec_r = build_permit_spec(pr, calc_r)
check(spec_r["zone_calcs"][0]["beam_type"] == "dropped", "PY zone_calcs records dropped")

print("R4: frontend zoneCalcs == backend zone_calcs, member for member")
calc = calculate_structure(p)
spec = build_permit_spec(p, calc)
for i, (fz, bz) in enumerate(zip(fe["zoneCalcs"], spec["zone_calcs"])):
    check(fz["joistSize"] == bz["joist_size"],
          "zone %d joist %s == %s" % (i + 1, fz["joistSize"], bz["joist_size"]))
    check(fz["beamSize"] == bz["beam_size"],
          "zone %d beam %s == %s" % (i + 1, fz["beamSize"], bz["beam_size"]))
    check(abs(fz["beamSpan"] - bz["beam_span"]) < 0.05,
          "zone %d beam span %s == %s" % (i + 1, fz["beamSpan"], bz["beam_span"]))
    check(abs(fz["jSpan"] - bz["j_span"]) < 0.05,
          "zone %d joist span %s == %s" % (i + 1, fz["jSpan"], bz["j_span"]))
    check(fz["nPosts"] == bz["n_posts"],
          "zone %d posts %s == %s" % (i + 1, fz["nPosts"], bz["n_posts"]))
    check(fz["beamType"] == bz["beam_type"],
          "zone %d type %s == %s" % (i + 1, fz["beamType"], bz["beam_type"]))

print("R5: framing sheet geometry -- flush beam under the outer rim")
z = p["zones"][0]                     # left-attached, 8 out, 11.5 along
rect = {"x": -8.0, "y": 0.0, "w": 8.0, "d": 11.5}
fr = compute_zone_framing(z, rect, 16, params=p)
check(fr["beam_type"] == "flush", "framing records flush")
check(fr["beam"] is not None, "flush framing HAS a beam")
check(abs(fr["beam"]["x1"] - rect["x"]) < 1e-6,
      "left section: beam at outer rim x=%s (setback 0)" % fr["beam"]["x1"])
check(len(fr["posts"]) == fe["zoneCalcs"][0]["nPosts"],
      "sheet posts (%d) == engine nPosts (%d)"
      % (len(fr["posts"]), fe["zoneCalcs"][0]["nPosts"]))
zd = p["zones"][1]                    # front-attached dropped, keeps 1.5
rect_d = {"x": 0.0, "y": 12.0, "w": 10.0, "d": 6.0}
frd = compute_zone_framing(zd, rect_d, 16, params=p)
check(abs(frd["beam"]["y1"] - (12.0 + 6.0 - 1.5)) < 1e-6,
      "dropped section keeps the 1.5 ft beam setback")

print("R6: spec post totals count flush-section posts")
exp_flush = max(2, math.ceil(11.5 / 8) + 1)   # left zone counts along d
exp_drop = max(2, math.ceil(10 / 8) + 1)      # front zone counts along w
check(spec["posts"]["total_zones"] == exp_flush + exp_drop,
      "total_zones %s == %s (flush %d + dropped %d)"
      % (spec["posts"]["total_zones"], exp_flush + exp_drop,
         exp_flush, exp_drop))
check(spec["posts"]["total"] == spec["posts"]["total_main"] + exp_flush + exp_drop,
      "spec post total sums main + sections")

print("R7: getEffectiveBeamType reads raw params' `height` key")
p5 = base_params(height=5.0,
                 zones=[section(1, "left", 8, 11.5, 5.0, "flush", "Zone 1")])
fe5 = frontend(p5)
check(fe5["ebt"][0] == "flush",
      "flush section at 5ft on a 5ft deck STAYS flush (was forced dropped "
      "by the deckHeight-only read)")
check(effective_beam_type(p5["zones"][0], p5) == "flush",
      "PY agrees for the 5ft deck")

print()
if FAILS:
    print("FAILED: %d assertion(s)" % len(FAILS))
    sys.exit(1)
print("PASS  flush sections: shared-edge only, far edge on a real beam, "
      "both engines and the sheet agree")
