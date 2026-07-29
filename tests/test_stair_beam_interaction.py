#!/usr/bin/env python3
"""A stair opening that only TOUCHES the beam line must not segment the beam.

WHY THIS EXISTS (S106)
----------------------
Both of Will's real decks had a front stair dragged 1'-6" into the deck. The
opening that creates spans from the beam line to the front edge: it lives
entirely in the cantilever and never interrupts the beam. calc_engine fed it
through the notch path anyway, so the beam fractured into three segments, a
4ft middle segment grew its own post INSIDE the stairwell (rendered in 3D as
a grey Simpson cap floating over the treads, which is how Will found it), and
the segments were posted against a hardcoded 8ft span. Result, measured:

    engine (backend)   7 posts, one in the stairwell
    engine (frontend)  3 posts (never had segmentation)
    framing sheet      3 posts
    materials list     7 posts, footings, bases, caps -- about $1,370 over

THE RULE (IRC R502.10; Meadowview A-8 shows the built form)
An opening whose back edge sits AT or IN FRONT OF the beam line leaves the
beam layout completely untouched: same segments, same post positions, same
everything as if the stair were at the edge. The opening is framed off the
beam with trimmers, which is a drawing/materials concern, not a beam one.
An opening that genuinely CROSSES the beam line still segments (its correct
posting -- posts at the opening edges, LU228-hung doubled headers per the
Meadowview precedent -- is the pending Case B package and is NOT covered
here). User cutouts are never filtered; their stepped-beam behaviour is
golden-pinned.

MUTATION TESTED: flip the filter's >= to >, drop the source=="stair" guard,
or classify against depth instead of the beam line, and this goes red.
Confirmed by doing each.

Run: python3 tests/test_stair_beam_interaction.py
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))
os.chdir(ROOT)

from drawing.calc_engine import calculate_structure  # noqa: E402
from drawing.draw_materials import estimate_materials  # noqa: E402

fails = []


def check(name, cond, detail=""):
    print("  %-64s %s" % (name, "ok" if cond else "FAIL " + str(detail)))
    if not cond:
        fails.append(name)


BASE = dict(width=21.5, depth=8.5, height=4, houseWidth=40, houseDepth=30,
            attachment="ledger", joistSpacing=16, deckingType="composite",
            snowLoad="moderate", frostZone="cold", lotWidth=80, lotDepth=120,
            setbackFront=25, setbackSide=5, setbackRear=20, houseOffsetSide=20,
            beamType="dropped", framingType="wood", railType="steel")


def stair(anchorY, template="straight", ax=10.75):
    return [{"id": 0, "zoneId": 0, "location": "front", "offset": 0,
             "width": 4, "numStringers": 3, "template": template,
             "anchorX": ax, "anchorY": anchorY, "angle": 0}]


print("1. a touching stair opening never segments the beam")
plain = calculate_structure(dict(BASE))
touch = calculate_structure(dict(BASE, deckStairs=stair(7.0)))
check("beam stays one segment",
      len(touch["beam_layout"]["segments"]) == 1,
      len(touch["beam_layout"]["segments"]))
# The centred legacy post (10.75) stood inside this deck's opening
# [8.75..12.75] -- push 4 fixed the segmentation but codified that post as
# "byte-equal to no-stair". The relocation rule (2c) replaces it with posts
# at both opening edges. History: 7 posts (segmented, S105-era), then 3 with
# one in the stairwell (push 4), now 4 with none.
check("posts flank the opening, none inside",
      touch["post_positions"] == [2.0, 8.75, 12.75, 19.5],
      touch["post_positions"])
check("no post inside (8.75, 12.75)",
      not any(8.75 < px < 12.75 for px in touch["post_positions"]))
check("footings match posts (4)", touch["num_footings"] == 4, touch["num_footings"])

print("2. same for the lLeft-with-landing shape (Will's second deck)")
ll = calculate_structure(dict(BASE, width=22, depth=12,
                              deckStairs=stair(10.5, "lLeft", ax=17.5)))
check("lLeft touching: 3 posts", ll["total_posts"] == 3, ll["total_posts"])
check("lLeft touching: one segment",
      len(ll["beam_layout"]["segments"]) == 1)
check("no post inside the opening x-span [13.7, 19.5]",
      not any(13.7 < px < 19.5 for px in ll["post_positions"]),
      ll["post_positions"])

print("2b. an lLeft's opening is only as wide as the part that ENTERS the deck")
# Will's 27x12: run 1 (4ft wide) enters; run 2 and the landing stay outside.
# The whole-stair bbox used to inflate the cut to 7.5ft, cutting a phantom
# hole that exposed the beam post at x=17.33 (his "post clipping through the
# stairs" and "giant gap" screenshots, same root).
from drawing.zone_utils import get_opening_rects  # noqa: E402
llp = dict(BASE, width=27, depth=12, height=7,
           deckStairs=[{"id": 0, "zoneId": 0, "location": "front", "offset": 0,
                        "width": 4, "numStringers": 3, "template": "lLeft",
                        "runSplit": 55, "landingDepth": 4,
                        "anchorX": 21.0, "anchorY": 10.5, "angle": 0}])
op = get_opening_rects(llp)[0]["rect"]
check("opening is exactly stair-width (4.0 ft)", op["w"] == 4.0, op["w"])
check("opening spans run 1 only (x 19..23)",
      op["x"] == 19.0 and op["x"] + op["w"] == 23.0, op)
llc = calculate_structure(llp)
check("posts match Will's sheet", llc["post_positions"] == [2.0, 9.67, 17.33, 25.0],
      llc["post_positions"])
check("the x=17.33 post is OUTSIDE the opening",
      not (op["x"] < 17.33 < op["x"] + op["w"]))
# and the JS mirror emits the identical rect
node_op = (
    'const fs=require("fs");global.window=global;'
    'eval(fs.readFileSync("backend/static/js/zoneUtils.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/stairGeometry.js","utf8"));'
    'const p=JSON.parse(process.argv[1]);'
    'const r=window.getStairOpeningRects(p)[0];'
    'console.log(JSON.stringify(r ? r.rect : null));'
)
r = subprocess.run(["node", "-e", node_op, json.dumps(llp)],
                   capture_output=True, text=True)
jsr = json.loads(r.stdout) if r.returncode == 0 else None
check("JS mirror emits the identical opening rect",
      jsr == {"x": op["x"], "y": op["y"], "w": op["w"], "d": op["d"]},
      "js=%s py=%s err=%s" % (jsr, op, r.stderr[:80]))

print("2c. a post never stands inside a touching opening (Will's freestanding find)")
# 22x12 freestanding, stair at the right corner: legacy posts [2,11,20] with
# the opening at x[17..21] put the post at 20 in the stairwell -- on the
# framing sheet AND in the 3D. Rule: drop it, posts at both opening edges.
fsp = dict(BASE, width=22, depth=12, attachment="freestanding",
           deckStairs=[{"id": 0, "zoneId": 0, "location": "front", "offset": 0,
                        "width": 4, "numStringers": 3,
                        "anchorX": 19.0, "anchorY": 10.5, "angle": 0}])
fsc = calculate_structure(fsp)
fs_front = sorted(x for (x, y) in fsc["beam_layout"]["post_xy"] if abs(y - 10.5) < 0.01)
fs_back = sorted(x for (x, y) in fsc["beam_layout"]["post_xy"] if abs(y - 1.5) < 0.01)
check("front row posts flank the opening", fs_front == [2.0, 11.0, 17.0, 21.0], fs_front)
check("no front post inside (17, 21)",
      not any(17 < x < 21 for x in fs_front))
check("back row mirrors the front", fs_back == fs_front, fs_back)
check("counts follow (8 posts, 8 footings)",
      fsc["total_posts"] == 8 and fsc["num_footings"] == 8,
      (fsc["total_posts"], fsc["num_footings"]))
# left-corner ledger stair: post at 2 sits inside opening x[1..5]; the left
# edge lands at 1 and the right at 5
lcp = dict(BASE, width=22, depth=12,
           deckStairs=[{"id": 0, "zoneId": 0, "location": "front",
                        "offset": 0, "width": 4, "numStringers": 3,
                        "anchorX": 3.0, "anchorY": 10.5, "angle": 0}])
lcc = calculate_structure(lcp)
check("left-corner: no post inside (1, 5)",
      not any(1 < px < 5 for px in lcc["post_positions"]),
      lcc["post_positions"])
check("left-corner: posts at both opening edges",
      1.0 in lcc["post_positions"] and 5.0 in lcc["post_positions"],
      lcc["post_positions"])
# centred stair whose opening misses every legacy post: rule is a NO-OP
cen = calculate_structure(dict(BASE, width=28, depth=12,
                               deckStairs=[{"id": 0, "zoneId": 0,
                                            "location": "front", "offset": 0,
                                            "width": 4, "numStringers": 3,
                                            "anchorX": 14.0, "anchorY": 10.5,
                                            "angle": 0}]))
check("centred stair, posts untouched", cen["post_positions"] == [2.0, 10.0, 18.0, 26.0],
      cen["post_positions"])
# and the JS engine relocates identically
node_fs = (
    'const fs=require("fs");global.window=global;'
    'eval(fs.readFileSync("backend/static/js/zoneUtils.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/stairGeometry.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/engine.js","utf8"));'
    'const c=window.calcStructure(JSON.parse(process.argv[1]));'
    'console.log(JSON.stringify(c.beamLayout.postXY));'
)
r = subprocess.run(["node", "-e", node_fs, json.dumps(fsp)],
                   capture_output=True, text=True)
js_xy = sorted(map(tuple, json.loads(r.stdout))) if r.returncode == 0 else None
py_xy = sorted((float(x), float(y)) for (x, y) in fsc["beam_layout"]["post_xy"])
check("JS relocates to the identical post_xy", js_xy == py_xy,
      "js=%s py=%s" % (js_xy, py_xy))

print("3. an opening that CROSSES the beam line still segments (Case B kept)")
deep = calculate_structure(dict(BASE, deckStairs=stair(5.0)))
check("deep stair still segments",
      len(deep["beam_layout"]["segments"]) > 1,
      len(deep["beam_layout"]["segments"]))

print("4. user cutouts are never filtered (golden-pinned behaviour)")
cutp = dict(BASE, nextZoneId=2, zones=[
    {"id": 1, "type": "cutout", "attachEdge": "front", "attachOffset": 8.75,
     "w": 4, "d": 3, "h": None, "attachTo": 0, "label": "Cutout",
     "joistDir": "perpendicular", "beamType": "dropped", "stairs": None}])
cut = calculate_structure(cutp)
check("front cutout still steps the beam",
      len(cut["beam_layout"]["segments"]) > 1,
      len(cut["beam_layout"]["segments"]))
# The distinguishing case: a cutout exactly as deep as the setback TOUCHES the
# beam line just like the stairs do. Stairs get filtered; cutouts must not --
# a notch removes deck permanently and the beam must still step around it.
# Without this case, deleting the source=="stair" guard survives the suite.
cutp2 = dict(BASE, nextZoneId=2, zones=[
    {"id": 1, "type": "cutout", "attachEdge": "front", "attachOffset": 8.75,
     "w": 4, "d": 1.5, "h": None, "attachTo": 0, "label": "Cutout",
     "joistDir": "perpendicular", "beamType": "dropped", "stairs": None}])
cut2 = calculate_structure(cutp2)
check("a TOUCHING cutout (d=1.5) still steps the beam",
      len(cut2["beam_layout"]["segments"]) > 1,
      len(cut2["beam_layout"]["segments"]))

print("5. both engines agree on the touching case (the parity that was broken)")
node_src = (
    'const fs=require("fs");global.window=global;'
    'eval(fs.readFileSync("backend/static/js/zoneUtils.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/stairGeometry.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/engine.js","utf8"));'
    'const p=JSON.parse(process.argv[1]);'
    'const c=window.calcStructure(p);'
    'console.log(JSON.stringify({n: c.pp.length, pp: c.pp}));'
)
for name, p, backend in (("straight touching", dict(BASE, deckStairs=stair(7.0)), touch),
                         ("lLeft touching", dict(BASE, width=22, depth=12,
                                                 deckStairs=stair(10.5, "lLeft", ax=17.5)), ll)):
    r = subprocess.run(["node", "-e", node_src, json.dumps(p)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        check("frontend ran (%s)" % name, False, r.stderr[:120])
        continue
    js = json.loads(r.stdout)
    check("post count matches frontend (%s)" % name,
          js["n"] == backend["total_posts"],
          "js=%s py=%s" % (js["n"], backend["total_posts"]))
    check("post positions match frontend (%s)" % name,
          [round(x, 2) for x in js["pp"]] ==
          [round(x, 2) for x in backend["post_positions"]],
          "js=%s py=%s" % (js["pp"], backend["post_positions"]))

print("5b. S107 Case B: both engines agree on the CROSSING case")
node_b = (
    'const fs=require("fs");global.window=global;'
    'eval(fs.readFileSync("backend/static/js/zoneUtils.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/stairGeometry.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/engine.js","utf8"));'
    'const p=JSON.parse(process.argv[1]);'
    'const c=window.calcStructure(p);'
    'console.log(JSON.stringify({postXY: c.beamLayout.postXY,'
    ' segs: c.beamLayout.segments.map(s=>[s.x0,s.x1,s.beamY]),'
    ' headers: c.beamLayout.stairHeaders||[]}));'
)
pB = dict(BASE, deckStairs=stair(6.0))  # beam at y=7.0; opening y[6.0..8.5] crosses it
cB = calculate_structure(pB)
blB = cB["beam_layout"]
check("crossing: beam interrupted, not stepped",
      blB.get("interrupted") and not blB.get("stepped"),
      "%s/%s" % (blB.get("interrupted"), blB.get("stepped")))
check("crossing: one doubled header recorded",
      len(blB.get("stair_headers") or []) == 1, blB.get("stair_headers"))
rB = subprocess.run(["node", "-e", node_b, json.dumps(pB)],
                    capture_output=True, text=True)
if rB.returncode != 0:
    check("frontend ran (crossing)", False, rB.stderr[:120])
else:
    jsB = json.loads(rB.stdout)
    check("crossing: post_xy matches frontend",
          sorted([tuple(x) for x in jsB["postXY"]]) ==
          sorted([(round(a, 2), round(b, 2)) for a, b in blB["post_xy"]]),
          "js=%s py=%s" % (jsB["postXY"], blB["post_xy"]))
    check("crossing: segments match frontend",
          jsB["segs"] == [[s["x0"], s["x1"], s["beam_y"]]
                          for s in blB["segments"]],
          "js=%s py=%s" % (jsB["segs"],
                           [[s["x0"], s["x1"], s["beam_y"]]
                            for s in blB["segments"]]))
    check("crossing: headers match frontend",
          [(h["x0"], h["x1"], h["y"]) for h in jsB["headers"]] ==
          [(h["x0"], h["x1"], h["y"]) for h in blB["stair_headers"]],
          "js=%s py=%s" % (jsB["headers"], blB["stair_headers"]))

print("5c. S107 Case B: both estimates bill the header package identically")
from drawing.draw_materials import estimate_materials as _est_py
estB = _est_py(pB, cB)
py_hdr = sorted((i["item"], i["qty"]) for i in estB["items"]
                if "Header" in i["item"] or "Trimmer" in i["item"]
                or "Double Hanger" in i["item"])
check("PY bills header + trimmers + double hangers", len(py_hdr) == 3, py_hdr)
node_m = (
    'const fs=require("fs");global.window=global;'
    'eval(fs.readFileSync("backend/static/js/zoneUtils.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/stairGeometry.js","utf8"));'
    'eval(fs.readFileSync("backend/static/js/engine.js","utf8"));'
    'const p=JSON.parse(process.argv[1]);'
    'const c=window.calcStructure(p);'
    'const m=window.estMaterials(p,c);'
    'console.log(JSON.stringify(m.items.filter(i=>/Header|Trimmer|Double Hanger/.test(i.item))'
    '.map(i=>[i.item,i.qty]).sort()));'
)
rM = subprocess.run(["node", "-e", node_m, json.dumps(pB)],
                    capture_output=True, text=True)
if rM.returncode != 0:
    check("frontend materials ran", False, rM.stderr[:120])
else:
    js_hdr = sorted((a, b) for a, b in json.loads(rM.stdout))
    check("header package matches frontend item-for-item",
          js_hdr == py_hdr, "js=%s py=%s" % (js_hdr, py_hdr))

print("6. the estimate bills what the sheet draws")
est = estimate_materials(dict(BASE, deckStairs=stair(7.0)), touch)
posts_line = next(i for i in est["items"] if i["item"].endswith("PT Posts"))
sono_line = next(i for i in est["items"] if i["item"].startswith("Sonotube"))
check("materials bill 4 posts (edges of the opening)", posts_line["qty"] == 4, posts_line["qty"])
check("materials bill 4 footings", sono_line["qty"] == 4, sono_line["qty"])

print()
if fails:
    print("FAILED (%d): %s" % (len(fails), "; ".join(fails)))
    sys.exit(1)
print("PASS  touching stair openings leave the beam alone, everywhere")
