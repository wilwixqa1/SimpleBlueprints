"""
S101 -- IRC DECK TABLE DRIFT GUARD (R507.5 / R507.6)

The R507 deck tables live in THREE places:

  * backend/drawing/calc_engine.py   IRC_JOIST_SPANS / IRC_BEAM_SPANS  (PDF)
  * backend/static/js/engine.js      JOIST_SPANS / BEAM_SPANS          (screen)
  * backend/drawing/irc_tables_deck.py                                 (snapshot)

They are hand-maintained copies of the same published tables. Commit c980054
is the cautionary tale: a one-inch correction to redwood_cedar "3-ply 2x12" at
the 8 ft column, found only by reading the code table cell by cell. A
correction like that applied to one copy and missed in the others is invisible
until a plan is wrong.

This test makes that failure loud. It asserts:

  1. calc_engine.py still matches the snapshot, cell by cell.
  2. engine.js still matches the snapshot, cell by cell.
  3. engine.js == calc_engine.py[dfl_hf_spf] -- the seam that actually ships.

If a table is edited ON PURPOSE, this test SHOULD fail. Fix the engine first,
then regenerate the snapshot, then confirm the two agree again. Do not edit
the snapshot to silence a failure -- that defeats the entire point of it.

Run: python3 tests/test_irc_table_drift.py
"""

import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))

from drawing.calc_engine import (  # noqa: E402
    IRC_JOIST_SPANS, IRC_BEAM_SPANS, _JOIST_SPAN_COLS,
)
from drawing.irc_tables_deck import (  # noqa: E402
    SNAPSHOT_JOIST_SPANS_PY, SNAPSHOT_BEAM_SPANS_PY,
    SNAPSHOT_JOIST_SPANS_JS, SNAPSHOT_BEAM_SPANS_JS,
    JOIST_SPAN_COLS,
)

SPECIES = ["southern_pine", "dfl_hf_spf", "redwood_cedar"]
TIERS = [40, 50, 60, 70]
JOIST_SIZES = ["2x6", "2x8", "2x10", "2x12"]
SPACINGS = [12, 16, 24]
BEAM_SIZES = ["2-ply 2x6", "2-ply 2x8", "2-ply 2x10", "2-ply 2x12",
              "3-ply 2x6", "3-ply 2x8", "3-ply 2x10", "3-ply 2x12"]

failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)


def _load_js_tables():
    """Read JOIST_SPANS / BEAM_SPANS out of engine.js as shipped."""
    node_src = (
        'global.window=global;const fs=require("fs");'
        'eval(fs.readFileSync("backend/static/js/engine.js","utf8"));'
        'console.log(JSON.stringify({J:window.JOIST_SPANS,B:window.BEAM_SPANS}));'
    )
    out = subprocess.run(["node", "-e", node_src],
                         capture_output=True, text=True, cwd=ROOT)
    if out.returncode != 0:
        raise RuntimeError("could not load engine.js: " + out.stderr[:300])
    return json.loads(out.stdout)


print("\nIRC DECK TABLE DRIFT (R507.5 / R507.6)")

# --- 0. Column definition ---
print("0. Joist span columns")
check(JOIST_SPAN_COLS == _JOIST_SPAN_COLS,
      "JOIST_SPAN_COLS drifted: snapshot %s vs calc_engine %s"
      % (JOIST_SPAN_COLS, _JOIST_SPAN_COLS))

# --- 1. Python joists vs snapshot ---
print("1. calc_engine IRC_JOIST_SPANS vs snapshot")
n = 0
for sp in SPECIES:
    for tier in TIERS:
        for size in JOIST_SIZES:
            for spacing in SPACINGS:
                a = IRC_JOIST_SPANS[sp][tier][size][spacing]
                b = SNAPSHOT_JOIST_SPANS_PY[sp][tier][size][spacing]
                n += 1
                check(abs(a - b) < 1e-9,
                      "joist PY drift %s/%s/%s@%s: engine %s vs snapshot %s"
                      % (sp, tier, size, spacing, a, b))
print("   %d cells" % n)

# --- 2. Python beams vs snapshot ---
print("2. calc_engine IRC_BEAM_SPANS vs snapshot")
n = 0
for tier in TIERS:
    for sp in SPECIES:
        for size in BEAM_SIZES:
            eng = IRC_BEAM_SPANS[tier][sp].get(size)
            snap = SNAPSHOT_BEAM_SPANS_PY[tier][sp].get(size)
            check((eng is None) == (snap is None),
                  "beam PY presence drift %s/%s/%s" % (tier, sp, size))
            if eng is None or snap is None:
                continue
            check(len(eng) == len(snap),
                  "beam PY length drift %s/%s/%s" % (tier, sp, size))
            for i, (a, b) in enumerate(zip(eng, snap)):
                n += 1
                check(abs(a - b) < 1e-9,
                      "beam PY drift %s/%s/%s[%s ft]: engine %s vs snapshot %s"
                      % (tier, sp, size, JOIST_SPAN_COLS[i], a, b))
print("   %d cells" % n)

# --- 3. JS vs snapshot ---
print("3. engine.js tables vs snapshot")
js = _load_js_tables()
n = 0
for tier in TIERS:
    for size in JOIST_SIZES:
        for spacing in SPACINGS:
            a = js["J"][str(tier)][size][str(spacing)]
            b = SNAPSHOT_JOIST_SPANS_JS[tier][size][spacing]
            n += 1
            check(abs(a - b) < 1e-9,
                  "joist JS drift %s/%s@%s: engine.js %s vs snapshot %s"
                  % (tier, size, spacing, a, b))
for tier in TIERS:
    for size, arr in js["B"][str(tier)].items():
        snap = SNAPSHOT_BEAM_SPANS_JS[tier].get(size)
        check(snap is not None, "beam JS presence drift %s/%s" % (tier, size))
        if snap is None:
            continue
        for i, (a, b) in enumerate(zip(arr, snap)):
            n += 1
            check(abs(a - b) < 1e-9,
                  "beam JS drift %s/%s[%s ft]: engine.js %s vs snapshot %s"
                  % (tier, size, JOIST_SPAN_COLS[i], a, b))
print("   %d cells" % n)

# --- 4. THE SEAM: JS vs Python dfl_hf_spf ---
# engine.js carries only the dfl_hf_spf group (since S59 f98c7ee, when the
# product had no species selector). This is the assertion that would have
# caught the S101 finding, and it is the one that matters most: the screen and
# the PDF must agree for the species the product actually ships.
print("4. engine.js == calc_engine[dfl_hf_spf] (the shipping seam)")
n = 0
for tier in TIERS:
    for size in JOIST_SIZES:
        for spacing in SPACINGS:
            a = js["J"][str(tier)][size][str(spacing)]
            b = IRC_JOIST_SPANS["dfl_hf_spf"][tier][size][spacing]
            n += 1
            check(abs(a - b) < 1e-9,
                  "SEAM joist %s/%s@%s: JS %s vs PY %s"
                  % (tier, size, spacing, a, b))
for tier in TIERS:
    for size, arr in js["B"][str(tier)].items():
        pyarr = IRC_BEAM_SPANS[tier]["dfl_hf_spf"].get(size)
        check(pyarr is not None,
              "SEAM beam %s/%s missing on the Python side" % (tier, size))
        if pyarr is None:
            continue
        for i, (a, b) in enumerate(zip(arr, pyarr)):
            n += 1
            check(abs(a - b) < 1e-9,
                  "SEAM beam %s/%s[%s ft]: JS %s vs PY %s"
                  % (tier, size, JOIST_SPAN_COLS[i], a, b))
print("   %d cells" % n)

# --- 5. Known-value spot checks (independent of the bulk compare) ---
# These pin specific published cells so a wholesale regeneration of BOTH the
# engine and the snapshot cannot quietly agree on a wrong number.
print("5. Known-value spot checks")
# c980054: redwood_cedar 3-ply 2x12 @ 8 ft was corrected 12-0 -> 12-1.
check(abs(IRC_BEAM_SPANS[40]["redwood_cedar"]["3-ply 2x12"][1] - 12.08) < 1e-9,
      "c980054 correction lost: redwood 3-ply 2x12 @8ft should be 12.08 (12'-1\"), "
      "got %s" % IRC_BEAM_SPANS[40]["redwood_cedar"]["3-ply 2x12"][1])
# R507.6, DFL/HF/SPF, 2x8 @ 16" oc, 40 psf -> 11'-1" = 11.08
check(abs(IRC_JOIST_SPANS["dfl_hf_spf"][40]["2x8"][16] - 11.08) < 1e-9,
      "R507.6 dfl 2x8@16 t40 should be 11.08, got %s"
      % IRC_JOIST_SPANS["dfl_hf_spf"][40]["2x8"][16])
# Column layout is the code's effective joist span series.
check(_JOIST_SPAN_COLS == [6, 8, 10, 12, 14, 16, 18],
      "beam table columns are not the R507.5 series")

print("")
if failures:
    print("IRC TABLE DRIFT: %d check(s) FAILED" % len(failures))
    for f in failures[:40]:
        print("  [FAIL] " + f)
    if len(failures) > 40:
        print("  ... and %d more" % (len(failures) - 40))
    sys.exit(1)
else:
    print("IRC TABLE DRIFT: all checks passed")
    sys.exit(0)
