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


print("1. a touching stair opening leaves the beam layout untouched")
plain = calculate_structure(dict(BASE))
touch = calculate_structure(dict(BASE, deckStairs=stair(7.0)))
check("posts unchanged (3)", touch["total_posts"] == 3, touch["total_posts"])
check("positions byte-equal to the no-stair deck",
      touch["post_positions"] == plain["post_positions"],
      touch["post_positions"])
check("beam stays one segment",
      len(touch["beam_layout"]["segments"]) == 1,
      len(touch["beam_layout"]["segments"]))
check("footings match posts", touch["num_footings"] == 3, touch["num_footings"])

print("2. same for the lLeft-with-landing shape (Will's second deck)")
ll = calculate_structure(dict(BASE, width=22, depth=12,
                              deckStairs=stair(10.5, "lLeft", ax=17.5)))
check("lLeft touching: 3 posts", ll["total_posts"] == 3, ll["total_posts"])
check("lLeft touching: one segment",
      len(ll["beam_layout"]["segments"]) == 1)
check("no post inside the opening x-span [13.7, 19.5]",
      not any(13.7 < px < 19.5 for px in ll["post_positions"]),
      ll["post_positions"])

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

print("6. the estimate bills what the sheet draws")
est = estimate_materials(dict(BASE, deckStairs=stair(7.0)), touch)
posts_line = next(i for i in est["items"] if i["item"].endswith("PT Posts"))
sono_line = next(i for i in est["items"] if i["item"].startswith("Sonotube"))
check("materials bill 3 posts", posts_line["qty"] == 3, posts_line["qty"])
check("materials bill 3 footings", sono_line["qty"] == 3, sono_line["qty"])

print()
if fails:
    print("FAILED (%d): %s" % (len(fails), "; ".join(fails)))
    sys.exit(1)
print("PASS  touching stair openings leave the beam alone, everywhere")
