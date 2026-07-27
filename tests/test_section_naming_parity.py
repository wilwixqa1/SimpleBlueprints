#!/usr/bin/env python3
"""zoneUtils.js sectionName() and zone_utils.py section_name() must agree.

WHY THIS EXISTS (S105)
----------------------
Before S105 the naming rule was written inline in eight places across five
files: zoneUtils.js (x3), app.js (x2), steps.js (x2), planView.js (x2) and
draw_plan.py (x3). That is the same shape as every notch bug this product has
had (S104 doc section 4.4): a rule stated once per surface, then free to drift.

The four surfaces that must agree on a section's name are the permit PDF, the
material list, the 3D view and the on-screen preview. A contractor reading
"DECK B" on the framing sheet and "Zone 2" on the screen has to work out that
they are the same thing, and that is exactly the kind of doubt that stops a set
being submitted.

The rename itself: "zone" already means ZONING DISTRICT on a permit site plan.
Across all four approved PPRBD reference sets the word appears exactly once, as
"ZONE: R1-6" on Meadowview's site plan, and never for a part of a deck. The sets
label deck parts DECK A / DECK B.

MUTATION TESTED. Break either side (change a letter, letter by id instead of
position, drop the auto-label check) and this goes red. Confirmed by doing it.

Run: python3 tests/test_section_naming_parity.py
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))

from drawing.zone_utils import section_name  # noqa: E402

JS_DIR = os.path.join(ROOT, "backend", "static", "js")

NODE_SRC = """
const fs = require("fs"), path = require("path");
global.window = {};
eval(fs.readFileSync(path.join(%s, "zoneUtils.js"), "utf8"));
const cases = JSON.parse(process.argv[1]);
console.log(JSON.stringify(cases.map(c => window.sectionName(c[0], c[1]))));
""" % json.dumps(JS_DIR)

# (zone_id, params, expected). Expected is asserted too, so a matching pair of
# wrong implementations still fails.
CASES = [
    # zone 0 is virtual; its label is synthesised, never typed.
    (0, {}, "Deck A"),
    (0, {"zones": [{"id": 1, "type": "add"}]}, "Deck A"),

    # letters follow POSITION and skip the main deck, which is already A
    (1, {"zones": [{"id": 1, "type": "add"}]}, "Deck B"),
    (2, {"zones": [{"id": 1, "type": "add"}, {"id": 2, "type": "add"}]}, "Deck C"),
    (3, {"zones": [{"id": 1, "type": "add"}, {"id": 2, "type": "add"},
                   {"id": 3, "type": "add"}]}, "Deck D"),

    # old rows carry a stored auto label; it must be ignored, not printed
    (1, {"zones": [{"id": 1, "type": "add", "label": "Zone 1"}]}, "Deck B"),
    (1, {"zones": [{"id": 1, "type": "add", "label": "Zone"}]}, "Deck B"),
    (1, {"zones": [{"id": 1, "type": "add", "label": "  zone 7 "}]}, "Deck B"),
    (1, {"zones": [{"id": 1, "type": "add", "label": "Main Deck"}]}, "Deck B"),

    # a name the user actually typed always wins
    (1, {"zones": [{"id": 1, "type": "add", "label": "Grill Deck"}]}, "Grill Deck"),
    (1, {"zones": [{"id": 1, "type": "add", "label": "Zone by the pool"}]},
        "Zone by the pool"),

    # cutouts are holes, not deck parts: numbered separately, no letter consumed
    (1, {"zones": [{"id": 1, "type": "cutout"}]}, "Cutout 1"),
    (2, {"zones": [{"id": 1, "type": "cutout"}, {"id": 2, "type": "add"}]}, "Deck B"),
    (3, {"zones": [{"id": 1, "type": "add"}, {"id": 2, "type": "cutout"},
                   {"id": 3, "type": "cutout"}]}, "Cutout 2"),

    # ids are never reused: after deleting id 1, the survivor is still B, not C
    (2, {"zones": [{"id": 2, "type": "add"}]}, "Deck B"),

    # id not present in the list at all: best effort, must not throw
    (5, {"zones": []}, "Deck F"),
]


def main():
    payload = json.dumps([[c[0], c[1]] for c in CASES])
    out = subprocess.run(["node", "-e", NODE_SRC, payload],
                         capture_output=True, text=True)
    if out.returncode != 0:
        print("[FAIL] node error: %s" % out.stderr.strip()[:400])
        return 1
    js = json.loads(out.stdout.strip())

    fails = 0
    for (zid, params, expected), js_val in zip(CASES, js):
        py_val = section_name(zid, params)
        ok = (js_val == py_val == expected)
        if not ok:
            fails += 1
            print("  [FAIL] id=%-2s js=%-18r py=%-18r expected=%r"
                  % (zid, js_val, py_val, expected))
        else:
            print("  [ok]   id=%-2s -> %r" % (zid, py_val))

    print("\n%d cases, %d failed" % (len(CASES), fails))
    if fails:
        print("FAIL: zoneUtils.js sectionName() and zone_utils.py section_name() "
              "must stay identical.")
        return 1
    print("PASS: section naming is identical on both sides.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
