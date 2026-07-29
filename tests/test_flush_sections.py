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
# One w/d rule (S107): w runs ALONG the attached edge, d runs OUT.
# Zone 1: left section, 8 along the deck's left edge, 11.5 ft out.
p = base_params(zones=[section(1, "left", 8, 11.5, 4.0, "flush", "Zone 1"),
                       section(2, "front", 10, 6, 4.0, "dropped", "Zone 2")])
fe = frontend(p)
z1, z2 = fe["zoneCalcs"]
check(z1["beamType"] == "flush", "left flush section stays flush at deck height")
check(z1["nPosts"] == 2, "flush section has ceil(8/8)+1 = 2 posts along its 8ft beam (%s)" % z1["nPosts"])
check(z1["fDiam"] > 0, "flush section has footings (%s in)" % z1["fDiam"])
check(z1["beamSize"] not in ("rim", "", None), "flush far-edge beam is a real member (%s)" % z1["beamSize"])
check(z1["beamSpan"] > 0, "flush beam has a span (%s ft)" % z1["beamSpan"])
check(abs(z1["jSpan"] - 11.5) < 0.05, "flush joists span the FULL 11.5 ft OUT (setback 0, span from d), got %s" % z1["jSpan"])
check(abs(z1["beamSpan"] - 8.0) < 0.05, "flush beam parallels the shared edge: 8ft / 1 bay (from w), got %s" % z1["beamSpan"])
check(abs(z2["jSpan"] - (6 - 1.2)) < 0.05,
      "dropped joists span depth minus the CLAMPED setback min(1.5, 6/5)=1.2 "
      "-> 4.8 ft, got %s" % z2["jSpan"])
check(fe["extraPosts"] == fe["extraFootings"] and fe["extraPosts"] == 5,
      "posts==footings: 2 (flush, 8ft beam) + 3 (dropped, 10ft beam) = %s" % fe["extraPosts"])

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
# The rect swaps for side zones (x-extent = d OUT, y-extent = w ALONG),
# matching getZoneRect in zoneUtils.js. Taken from get_zone_rect itself so
# this stays a geometry test, not a rect-convention test.
from drawing.zone_utils import get_zone_rect
z = p["zones"][0]                     # left-attached, 8 along, 11.5 out
rect = get_zone_rect(z, p["width"], p["depth"])
check(rect == {"x": -11.5, "y": 0, "w": 11.5, "d": 8},
      "side-zone rect swaps extents to match the app: %s" % rect)
fr = compute_zone_framing(z, rect, 16, params=p)
check(fr["beam_type"] == "flush", "framing records flush")
check(fr["beam"] is not None, "flush framing HAS a beam")
check(abs(fr["beam"]["x1"] - rect["x"]) < 1e-6,
      "left section: beam at outer rim x=%s (setback 0)" % fr["beam"]["x1"])
check(abs(fr["beam"]["y2"] - fr["beam"]["y1"]) <= rect["d"],
      "beam runs ALONG the deck edge (y direction)")
check(len(fr["posts"]) == fe["zoneCalcs"][0]["nPosts"],
      "sheet posts (%d) == engine nPosts (%d)"
      % (len(fr["posts"]), fe["zoneCalcs"][0]["nPosts"]))
zd = p["zones"][1]                    # front-attached dropped, keeps 1.5
rect_d = {"x": 0.0, "y": 12.0, "w": 10.0, "d": 6.0}
frd = compute_zone_framing(zd, rect_d, 16, params=p)
check(abs(frd["beam"]["y1"] - (12.0 + 6.0 - 1.2)) < 1e-6,
      "dropped section beam at the clamped min(1.5, 6/5)=1.2 ft setback")

print("R6: spec post totals count flush-section posts")
exp_flush = max(2, math.ceil(8 / 8) + 1)      # beam length = w (along edge)
exp_drop = max(2, math.ceil(10 / 8) + 1)
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

print("R8: elevations -- a flush wing draws a SOLID dropped beam, not a dashed in-plane line")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import patches as _mp
from drawing.draw_elevations import _draw_zone_section_south, _draw_zone_section_north

for _name, _fn, _extra in (("south", _draw_zone_section_south, ()),
                           ("north", _draw_zone_section_north, (30.0,))):
    _fig, _ax = plt.subplots()
    _sec = {"x_draw": 0.0, "w": 11.5, "deck_top": 4.0}
    # threading beam_type="flush" (the old main-deck inheritance) must no
    # longer produce a dashed beam: the wing's far beam is dropped structure
    # signature: (ax, deck_x, section[, total_w], ground_y, beam_h, beam_type, rail_h, sp)
    _fn(_ax, 0.0, _sec, *(_extra), 0.0, 0.9, "flush", 3.0, 16)
    _rects = [pa for pa in _ax.patches if isinstance(pa, _mp.Rectangle)
              and abs(pa.get_height() - 0.9) < 1e-6]
    check(len(_rects) >= 1, "%s view: solid beam block drawn on a 'flush' wing (%d found)"
          % (_name, len(_rects)))
    _dashed = [ln for ln in _ax.lines
               if ln.get_linestyle() not in ("-", "solid") and len(ln.get_xdata()) == 2
               and abs(ln.get_ydata()[0] - (4.0 - 0.9)) < 1e-6
               and abs(ln.get_ydata()[1] - (4.0 - 0.9)) < 1e-6]
    check(len(_dashed) == 0, "%s view: no dashed in-plane beam line on the wing" % _name)
    plt.close(_fig)

print("R9: app elevation width == PDF elevation width (non-square side sections)")
from drawing.draw_elevations import _get_zone_south_north_sections
# Will's ACTUAL B/C shape: 8 ft OUT, 11.5/12 along the deck edge.
p9 = base_params(zones=[section(1, "left", 11.5, 8, 4.0, "flush", "Zone 1"),
                        section(2, "right", 12, 8, 4.0, "flush", "Zone 2")])
calc9 = calculate_structure(p9)
_sn = _get_zone_south_north_sections(p9, calc9)
bb_w, secs = _sn["bb_w"], _sn["sections"]
JSNODE = (
    'const fs=require("fs");global.window=global;'
    'global.React={createElement:()=>null,useState:v=>[v,()=>{}],'
    'useRef:()=>({current:null}),useEffect:()=>{}};'
    'const Babel=require("@babel/standalone");'
    'const src=fs.readFileSync("backend/static/js/elevationView.js","utf8");'
    'eval.call(global,Babel.transform(src,{presets:[["react",{runtime:"classic"}]]}).code);'
    'const p=JSON.parse(process.argv[1]);'
    'const r=window._getZoneSNContext(p, p.width, p.height);'
    'console.log(JSON.stringify(r));'
)
r9 = subprocess.run(["node", "-e", JSNODE, json.dumps(p9)],
                    capture_output=True, text=True)
if r9.returncode != 0:
    check(False, "app elevation context failed: " + r9.stderr[:200])
else:
    js9 = json.loads(r9.stdout)
    check(abs(js9["bbW"] - bb_w) < 0.01,
          "visible width: app %s == PDF %s (22 deck + 8 + 8 out = 38, NOT 45.5)"
          % (js9["bbW"], bb_w))
    check(abs(js9["bbW"] - 38.0) < 0.01, "and that width is the OUT-extent sum, 38.0")
    # JS keeps deck-local xDraw plus a separate xOff applied at draw time;
    # PY bakes x_off into x_draw. Compare in the bbox frame.
    for _js, _py in zip(sorted(js9["sections"], key=lambda x: x["xDraw"]),
                        sorted(secs, key=lambda x: x["x_draw"])):
        _jsx = _js["xDraw"] + js9["xOff"]
        check(abs(_js["w"] - _py["w"]) < 0.01 and abs(_jsx - _py["x_draw"]) < 0.01,
              "wing section app (bbox x=%s w=%s) == PDF (x=%s w=%s)"
              % (_jsx, _js["w"], _py["x_draw"], _py["w"]))

print("R9b: elevation house is the REAL house on both surfaces (deck fits inside)")
from drawing.draw_elevations import _elev_house_span
p9b = dict(p9, houseWidth=45.5, deckOffset=0)
hx_py, hw_py = _elev_house_span(p9b, p9b["width"], 0.0)
check(abs(hw_py - 45.5) < 0.01, "PDF house width == houseWidth (45.5), got %s" % hw_py)
_bb9 = 38.0  # 22 + 8 + 8, pinned above
check(hx_py <= -8.0 + 0.01 and hx_py + hw_py >= 30.0 - 0.01,
      "PDF: deck bb x[-8..30] (z0 frame) inside house x[%.2f..%.2f]"
      % (hx_py, hx_py + hw_py))
JS9B = (
    'const fs=require("fs");global.window=global;'
    'global.React={createElement:()=>null,useState:v=>[v,()=>{}],'
    'useRef:()=>({current:null}),useEffect:()=>{}};'
    'const Babel=require("@babel/standalone");'
    'const src=fs.readFileSync("backend/static/js/elevationView.js","utf8");'
    'eval.call(global,Babel.transform(src,{presets:[["react",{runtime:"classic"}]]}).code);'
    'const p=JSON.parse(process.argv[1]);'
    'console.log(JSON.stringify(window._getElevHouseSpan(p, p.width, 38.0)));'
)
r9b = subprocess.run(["node", "-e", JS9B, json.dumps(p9b)],
                     capture_output=True, text=True)
if r9b.returncode != 0:
    check(False, "app house span failed: " + r9b.stderr[:200])
else:
    js9b = json.loads(r9b.stdout)
    check(abs(js9b["hwFt"] - hw_py) < 0.01 and abs(js9b["hxFtRelZ0"] - hx_py) < 0.01,
          "app house span == PDF house span: js=(%s,%s) py=(%.2f,%.2f)"
          % (js9b["hwFt"], js9b["hxFtRelZ0"], hw_py, hx_py))
_off = dict(p9b, deckOffset=3)
hx_o, hw_o = _elev_house_span(_off, _off["width"], 0.0)
check(abs(hx_o - (hx_py - 3)) < 0.01,
      "deckOffset shifts the house: hx %.2f -> %.2f (A-1 convention)"
      % (hx_py, hx_o))
r9o = subprocess.run(["node", "-e", JS9B, json.dumps(_off)],
                     capture_output=True, text=True)
if r9o.returncode == 0:
    js9o = json.loads(r9o.stdout)
    check(abs(js9o["hxFtRelZ0"] - hx_o) < 0.01,
          "app applies the same deckOffset shift: js=%s py=%.2f"
          % (js9o["hxFtRelZ0"], hx_o))
else:
    check(False, "app deckOffset span failed: " + r9o.stderr[:120])
_leg = _elev_house_span(dict(p9b, zones=[]), 22, 0.0)
check(_leg == (0.0 + (22 - 22) / 2, 22),
      "sectionless deck keeps the legacy schematic house (min(W,30)), got %s" % (_leg,))

print("R10: IRC R507.6 -- section beam setback clamps to d/5 on shallow sections")
p10 = base_params(zones=[section(1, "front", 10, 4, 4.0, "dropped", "Zone 1")])
fe10 = frontend(p10)
z10 = fe10["zoneCalcs"][0]
check(abs(z10["jSpan"] - 3.2) < 0.05,
      "4ft dropped section: setback 4/5=0.8, joist span 3.2 (was 2.5 with a "
      "60%% cantilever), got %s" % z10["jSpan"])
_cant = 4.0 - z10["jSpan"]
check(_cant <= z10["jSpan"] / 4 + 1e-6,
      "cantilever %.2f <= back-span/4 = %.2f" % (_cant, z10["jSpan"] / 4))
calc10 = calculate_structure(p10)
spec10 = build_permit_spec(p10, calc10)
check(abs(spec10["zone_calcs"][0]["j_span"] - z10["jSpan"]) < 0.05,
      "backend agrees: j_span %s" % spec10["zone_calcs"][0]["j_span"])
fr10 = compute_zone_framing(p10["zones"][0],
                            {"x": 6.0, "y": 12.0, "w": 10.0, "d": 4.0}, 16,
                            params=p10)
check(abs(fr10["beam"]["y1"] - (12.0 + 4.0 - 0.8)) < 1e-6,
      "sheet beam at the clamped 0.8ft setback, y=%s" % fr10["beam"]["y1"])

print()
if FAILS:
    print("FAILED: %d assertion(s)" % len(FAILS))
    sys.exit(1)
print("PASS  flush sections: shared-edge only, far edge on a real beam, "
      "both engines and the sheet agree")
