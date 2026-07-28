#!/usr/bin/env python3
"""window.resizeSection() in zoneUtils.js: dragging a section's edge.

WHY THIS EXISTS (S106)
----------------------
S105 gave the MAIN deck drag-to-resize handles. Its rule was simple enough to
live inline in planView.js: two edges change width, one changes depth, and
deckOffset shifts to hold the edge you did not grab.

A section is not that simple. getZoneRect() measures w ALONG the parent's edge
and d AWAY from it, so which screen edge changes which field depends on
attachEdge, and the "hold the opposite edge still" move has to go through
attachOffset rather than deckOffset. That is three interacting numbers instead
of two, with two clamps that can disagree with each other.

So the rule is a pure function in zoneUtils.js and this is its test. The same
reasoning as test_section_naming_parity.py: a rule written inline on one
surface is a rule the other surfaces cannot obey (S105 learning 9.8, which was
itself about the size bounds hiding in JSX props).

THE INVARIANT THAT MATTERS
--------------------------
Drag one edge and ONLY that edge moves. The other three stay exactly where
they were. That is what makes a drag feel like a drag rather than like a
resize. Most of the cases below assert precisely that, in feet, including at
both clamps.

MUTATION TESTED. Confirmed red by: swapping nearAlong/farAlong for "front",
dropping the attachOffset compensation, letting the cutout floor apply to
attachOffset, and removing the joint offset/width bound. See the header of
each block.

Run: python3 tests/test_section_resize.py
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS_DIR = os.path.join(ROOT, "backend", "static", "js")

NODE_SRC = """
const fs = require("fs"), path = require("path");
global.window = {};
eval(fs.readFileSync(path.join(%s, "zoneUtils.js"), "utf8"));
const calls = JSON.parse(process.argv[1]);
const out = calls.map(c => {
  if (c.fn === "resize") return window.resizeSection(c.zone, c.pr, c.edge, c.pt);
  if (c.fn === "clamp")  return window.clampSize(c.field, c.v, c.isCutout);
  if (c.fn === "edges")  return window.sectionResizeEdges(c.attachEdge);
  if (c.fn === "bounds") return window.SIZE_BOUNDS;
  return null;
});
console.log(JSON.stringify(out));
""" % json.dumps(JS_DIR)


def js(calls):
    r = subprocess.run(["node", "-e", NODE_SRC, json.dumps(calls)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print("node failed:\n" + r.stderr)
        sys.exit(1)
    return json.loads(r.stdout)


# The parent is the main deck: 21.5 wide, 12 deep, origin at 0,0.
PARENT = {"x": 0, "y": 0, "w": 21.5, "d": 12}


def sect(edge, w=8, d=8, off=2, typ="add"):
    return {"type": typ, "w": w, "d": d, "attachOffset": off, "attachEdge": edge}


def rect_of(zone, pr):
    """Mirror of getZoneRect, so the test computes the expected screen box
    independently of the code under test rather than trusting it."""
    w, d, off = zone["w"], zone["d"], zone["attachOffset"]
    if zone["attachEdge"] == "front":
        return {"x": pr["x"] + off, "y": pr["y"] + pr["d"], "w": w, "d": d}
    if zone["attachEdge"] == "left":
        return {"x": pr["x"] - d, "y": pr["y"] + off, "w": d, "d": w}
    if zone["attachEdge"] == "right":
        return {"x": pr["x"] + pr["w"], "y": pr["y"] + off, "w": d, "d": w}
    return None


def edges_of(r):
    return {"left": r["x"], "right": r["x"] + r["w"],
            "top": r["y"], "bottom": r["y"] + r["d"]}


fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n      got  %s\n      want %s" % (name, got, want))


# ---------------------------------------------------------------- 1
# Drag one edge, the other three must not move. Every attachEdge, every
# draggable edge, dragged both outward and inward.
#
# MUTATION: swap nearAlong and farAlong in sectionResizeEdges for "front" and
# the two "left"/"right" rows of this block go red.
print("1. dragging an edge moves that edge and nothing else")
cases = []
for ae in ("right", "left", "front"):
    z = sect(ae)
    r0 = rect_of(z, PARENT)
    e0 = edges_of(r0)
    m = js([{"fn": "edges", "attachEdge": ae}])[0]
    for edge in (m["far"], m["nearAlong"], m["farAlong"]):
        for delta in (3.0, -2.5):
            # put the pointer where we want that edge to end up
            pt = {"x": (e0["left"] + e0["right"]) / 2,
                  "y": (e0["top"] + e0["bottom"]) / 2}
            if edge == "left":   pt["x"] = e0["left"] - delta
            if edge == "right":  pt["x"] = e0["right"] + delta
            if edge == "top":    pt["y"] = e0["top"] - delta
            if edge == "bottom": pt["y"] = e0["bottom"] + delta
            cases.append({"fn": "resize", "zone": z, "pr": PARENT,
                          "edge": edge, "pt": pt, "_ae": ae, "_edge": edge,
                          "_delta": delta, "_e0": e0})
res = js([{k: v for k, v in c.items() if not k.startswith("_")} for c in cases])
for c, out in zip(cases, res):
    ae, edge, delta, e0 = c["_ae"], c["_edge"], c["_delta"], c["_e0"]
    nz = dict(sect(ae)); nz.update(out)
    e1 = edges_of(rect_of(nz, PARENT))
    # Expected position of the grabbed edge: where the pointer put it, BUT
    # bounded by what the fields can legally hold. The first version of this
    # test forgot the bound and flagged 3 correct clamps as failures: dragging
    # the near-along edge outward from offset 2 by 3ft asks for offset -1,
    # which floors at 0, so the edge legally stops 1ft short of the pointer.
    sign = -1 if edge in ("left", "top") else 1
    want = e0[edge] + sign * delta
    m = js([{"fn": "edges", "attachEdge": ae}])[0]
    if edge == m["nearAlong"]:
        # this edge sits at parentOrigin + attachOffset, offset in [0, 30],
        # and also cannot pass the far end minus min width
        origin = PARENT["y"] if m["axis"] == "y" else PARENT["x"]
        far_end = origin + sect(ae)["attachOffset"] + sect(ae)["w"]
        want = max(origin + 0, min(origin + 30, want))
        want = min(want, far_end - 4)
    check("  %-5s drag %-6s by %+.1f: grabbed edge" % (ae, edge, delta),
          round(e1[edge], 4), round(want, 4))
    for other in ("left", "right", "top", "bottom"):
        if other == edge:
            continue
        check("  %-5s drag %-6s by %+.1f: %s edge held"
              % (ae, edge, delta, other), round(e1[other], 4), round(e0[other], 4))
print("   %d cases" % (len(cases) * 4))

# ---------------------------------------------------------------- 2
# The seam gets no handle and no result. Dragging it must be a no-op, not a
# silent detach.
print("2. the seam edge is not resizable")
for ae, seam in (("right", "left"), ("left", "right"), ("front", "top")):
    out = js([{"fn": "resize", "zone": sect(ae), "pr": PARENT,
               "edge": seam, "pt": {"x": 0, "y": 0}}])[0]
    check("  %-5s seam=%s returns null" % (ae, seam), out, None)

# ---------------------------------------------------------------- 3
# Clamps. At a clamp the grabbed edge stops; the opposite edge STILL holds.
#
# MUTATION: delete the lo/hi joint bound in the nearAlong branch and the
# "w and offset still agree" line goes red, because clampSize pins w at 50
# while attachOffset keeps travelling.
print("3. clamps hold, and w and attachOffset never disagree")
B = js([{"fn": "bounds"}])[0]
z = sect("right", w=8, d=8, off=2)
r0 = rect_of(z, PARENT); e0 = edges_of(r0)
# drag the far edge miles out: depth pins at its max
out = js([{"fn": "resize", "zone": z, "pr": PARENT, "edge": "right",
           "pt": {"x": 900, "y": 5}}])[0]
check("  depth clamps to max", out["d"], B["depth"]["max"])
# drag it miles in: depth pins at its min, does not go negative
out = js([{"fn": "resize", "zone": z, "pr": PARENT, "edge": "right",
           "pt": {"x": -900, "y": 5}}])[0]
check("  depth clamps to min", out["d"], B["depth"]["min"])
# drag the near-along edge miles up: offset floors at 0 and w = B exactly
out = js([{"fn": "resize", "zone": z, "pr": PARENT, "edge": "top",
           "pt": {"x": 25, "y": -900}}])[0]
check("  offset clamps to min", out["attachOffset"], B["attachOffset"]["min"])
check("  w and offset still agree at the clamp",
      out["attachOffset"] + out["w"], z["attachOffset"] + z["w"])
# drag it miles down: w floors, and the bottom edge is still exactly where it was
out = js([{"fn": "resize", "zone": z, "pr": PARENT, "edge": "top",
           "pt": {"x": 25, "y": 900}}])[0]
check("  w clamps to min", out["w"], B["width"]["min"])
check("  bottom edge held while w bottomed out",
      out["attachOffset"] + out["w"], z["attachOffset"] + z["w"])
# a section already at max width: nudging the near edge cannot exceed the max
wide = sect("right", w=B["width"]["max"], d=8, off=0)
out = js([{"fn": "resize", "zone": wide, "pr": PARENT, "edge": "top",
           "pt": {"x": 25, "y": -900}}])[0]
check("  w never exceeds max", out["w"], B["width"]["max"])
check("  offset absorbs it instead", out["attachOffset"], 0)

# ---------------------------------------------------------------- 4
# Everything lands on the slider's own 0.5 grid, so a dragged value is a
# value the slider could also have produced.
print("4. every result is a value the slider could produce")
grid = []
for ae in ("right", "left", "front"):
    for edge in ("left", "right", "top", "bottom"):
        for k in range(0, 40):
            grid.append({"fn": "resize", "zone": sect(ae), "pr": PARENT,
                         "edge": edge, "pt": {"x": -7 + k * 0.37, "y": -3 + k * 0.41}})
for out in js(grid):
    if out is None:
        continue
    for f in ("w", "d", "attachOffset"):
        if round(out[f] * 2) != out[f] * 2:
            fails.append("  off the 0.5 grid: %s=%s" % (f, out[f]))
        if out[f] < 0:
            fails.append("  negative %s=%s" % (f, out[f]))
print("   %d results checked" % len(grid))

# ---------------------------------------------------------------- 5
# clampSize's cutout floor is a floor on a cutout's SIZE. It must not reach
# attachOffset, or a cutout could never sit flush at offset 0.
#
# MUTATION: revert the isSize guard in clampSize and the last line goes red.
print("5. the cutout floor applies to size, not to offset")
r = js([
    {"fn": "clamp", "field": "width",        "v": 1,   "isCutout": True},
    {"fn": "clamp", "field": "width",        "v": 1,   "isCutout": False},
    {"fn": "clamp", "field": "depth",        "v": 0.4, "isCutout": True},
    {"fn": "clamp", "field": "attachOffset", "v": 0,   "isCutout": True},
    {"fn": "clamp", "field": "attachOffset", "v": 99,  "isCutout": False},
    {"fn": "clamp", "field": "attachOffset", "v": -5,  "isCutout": False},
])
check("  cutout width floors at 2", r[0], 2)
check("  section width floors at 4", r[1], 4)
check("  cutout depth floors at 2", r[2], 2)
check("  cutout offset is NOT floored at 2", r[3], 0)
check("  offset ceils at 30", r[4], 30)
check("  offset floors at 0", r[5], 0)

# ---------------------------------------------------------------- 6
# Cutouts get no handles at all this session. Their attachEdge names are
# corners and their anchoring is different, so the map must refuse them
# rather than guess.
print("6. cutout attach edges get no resize map")
for ae in ("back-left", "back-right", "front-left", "front-right",
           "back", "interior", None, "nonsense"):
    out = js([{"fn": "edges", "attachEdge": ae}])[0]
    check("  %-12s -> null" % str(ae), out, None)

# ---------------------------------------------------------------- 7
# A section on a section. The parent rect is whatever getZoneRect returns, so
# the maths must not assume the parent is the main deck at the origin.
print("7. works against a parent that is not at the origin")
pr2 = {"x": 21.5, "y": 3, "w": 8, "d": 8}
z2 = sect("front", w=5, d=4, off=1)
r0 = rect_of(z2, pr2); e0 = edges_of(r0)
out = js([{"fn": "resize", "zone": z2, "pr": pr2, "edge": "bottom",
           "pt": {"x": e0["left"] + 1, "y": e0["bottom"] + 2}}])[0]
nz = dict(z2); nz.update(out)
e1 = edges_of(rect_of(nz, pr2))
check("  bottom edge followed the pointer", round(e1["bottom"], 4),
      round(e0["bottom"] + 2, 4))
check("  top edge (the seam) held", round(e1["top"], 4), round(e0["top"], 4))
check("  depth grew by 2", out["d"], z2["d"] + 2)

# ----------------------------------------------------------------
print()
if fails:
    print("FAILED (%d)" % len(fails))
    for f in fails:
        print("   " + f)
    sys.exit(1)
print("PASS  section resize rule holds")
