#!/usr/bin/env python3
"""Every runnable suite in tests/ must be invoked by the CI workflow.

WHY THIS EXISTS (S103)
----------------------
The gate list has been silently losing suites for several sessions, and every
handoff carried the loss forward because each one copied the previous handoff's
list instead of reading the filesystem.

Measured at cedb50b, diffing .github/workflows/tests.yml against the gate
documented in docs/S102_SESSION_CONTEXT.md section 9:

  in the documented gate but NOT run by CI on push:  9 suites, including
    golden_structural.py, test_frontend_parity.py and
    test_cross_system_consistency.py -- the three that caught S102's real bugs
  run by CI but MISSING from the documented gate:    3 suites
  in NEITHER list:  tests/pdf/legibility_gate.py, a real passing gate

Railway autodeploys from main with no gate. CI is the only tripwire, so a suite
missing from CI is a suite that cannot warn anybody about the deploy that just
went out.

S100's handoff said "re-derive the gate from ls tests/". S101 and S102 repeated
the instruction. It kept happening anyway, because an instruction in a document
is not a mechanism. This file is the mechanism: add a suite and forget to wire
it up, and the build goes red telling you exactly which one.

HOW TO ADD A NEW SUITE
  1. write tests/test_yourthing.py
  2. add a step to .github/workflows/tests.yml that runs it
  3. this test passes

HOW TO ADD A NON-SUITE HELPER
  Add it to NOT_A_SUITE below WITH A REASON. Never add a real suite there to get
  a green build -- that is precisely the failure mode this file exists to stop.

Run: python3 tests/test_gate_completeness.py
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.join(ROOT, "tests")
WORKFLOW = os.path.join(ROOT, ".github", "workflows", "tests.yml")

# Files under tests/ that are NOT standalone gate suites. Each needs a reason.
NOT_A_SUITE = {
    "tests/geometry/parity_probe.js":
        "helper -- driven by test_frontend_parity.py, not run on its own",
    "tests/pdf/legibility_check.py":
        "library -- the checker itself; legibility_gate.py is the runnable gate",
    "tests/pdf/linework_baseline.json":
        "data",
    "tests/pdf/panel_baseline.json":
        "data",
    "tests/pdf/golden_structural.json":
        "data -- golden fingerprints",
    "tests/pdf/render_review.py":
        "interactive visual harness -- renders sheets for a human to look at, "
        "has no pass/fail",
    "tests/live/zone_cap_dom.py":
        "live browser check -- needs a running server and a real DOM, cannot "
        "run in CI; see tests/live/README.txt",
    "tests/test_gate_completeness.py":
        "this file -- it is in the workflow, but self-reference in the scan "
        "below would be circular",
}


def _rel(path):
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def _candidates():
    out = []
    for dirpath, dirnames, filenames in os.walk(TESTS):
        dirnames[:] = [d for d in dirnames
                       if d not in ("__pycache__", "fuzz_fixtures")]
        for fn in filenames:
            if not (fn.endswith(".py") or fn.endswith(".js")):
                continue
            if fn.startswith("_") or fn == "README.txt":
                continue
            out.append(_rel(os.path.join(dirpath, fn)))
    return sorted(out)


def main():
    if not os.path.exists(WORKFLOW):
        print("GATE COMPLETENESS: FAILED -- %s does not exist" % _rel(WORKFLOW))
        return 1

    workflow = open(WORKFLOW).read()
    missing, unexplained = [], []

    for rel in _candidates():
        if rel in NOT_A_SUITE:
            continue
        if rel not in workflow:
            missing.append(rel)

    # A stale exemption is its own kind of drift: a file listed as "not a suite"
    # that no longer exists means the list was copied rather than checked.
    for rel in NOT_A_SUITE:
        if not os.path.exists(os.path.join(ROOT, rel)):
            unexplained.append(rel)

    print("GATE COMPLETENESS")
    print("  workflow          : %s" % _rel(WORKFLOW))
    print("  files scanned     : %d" % len(_candidates()))
    print("  exempted helpers  : %d" % len(NOT_A_SUITE))

    if missing:
        print()
        print("  %d suite(s) exist in tests/ but are NOT run by CI:" % len(missing))
        for m in missing:
            print("    [MISSING] " + m)
        print()
        print("  Add a step to .github/workflows/tests.yml, or add the file to")
        print("  NOT_A_SUITE with a reason if it is a helper. Do NOT exempt a")
        print("  real suite to make this green.")

    if unexplained:
        print()
        print("  %d exemption(s) name a file that no longer exists:" % len(unexplained))
        for u in unexplained:
            print("    [STALE] " + u)

    if missing or unexplained:
        print()
        print("GATE COMPLETENESS: FAILED")
        return 1

    print()
    print("GATE COMPLETENESS: every suite in tests/ is wired into CI")
    return 0


if __name__ == "__main__":
    sys.exit(main())
