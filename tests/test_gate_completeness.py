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
import ast
import os
import re
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


def _installed_packages(workflow):
    """Every package name the workflow pip-installs, handling continuations."""
    joined = workflow.replace("\\\n", " ")
    pkgs = set()
    for m in re.finditer(r"pip install ([^\n]+)", joined):
        for tok in m.group(1).split():
            if tok.startswith("-"):
                continue
            pkgs.add(re.split(r"[=<>!\[]", tok)[0].strip().lower())
    return pkgs


# import name -> pip name, where they differ
_PIP_NAME = {
    "pdfminer": "pdfminer.six",
    "pil": "pillow",
    "yaml": "pyyaml",
    "cv2": "opencv-python",
    "sklearn": "scikit-learn",
    "dateutil": "python-dateutil",
    "multipart": "python-multipart",
}

# Modules that live in this repo, not on PyPI. Anything importable because a
# suite does sys.path.insert on backend/ or tests/pdf/.
_LOCAL_MODULES = {
    "app", "drawing", "config_matrix", "golden_structural", "render_review",
    "legibility_check", "linework_check", "panel_check", "fuzz_configs",
}


def _check_imports(workflow):
    """Every third-party import of every wired suite must be pip-installed.

    WHY (S103 push 6): push 2 added tests/pdf/legibility_gate.py to CI without
    adding pdfminer to the install list. It passes locally because pdfminer
    happens to be present in the dev container; on a clean runner the very first
    real CI run died with ModuleNotFoundError after ~4 minutes of green steps.

    Wiring a suite into the workflow is only half the job. This is the other
    half, and it is checked rather than remembered.
    """
    installed = _installed_packages(workflow)
    stdlib = set(sys.stdlib_module_names)
    problems = []
    for rel in _candidates():
        if rel in NOT_A_SUITE or not rel.endswith(".py"):
            continue
        if rel not in workflow:
            continue  # already reported as unwired
        try:
            tree = ast.parse(open(os.path.join(ROOT, rel)).read())
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            names = []
            if isinstance(node, ast.Import):
                names = [a.name.split(".")[0] for a in node.names]
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                names = [node.module.split(".")[0]]
            for n in names:
                if n in stdlib or n in _LOCAL_MODULES:
                    continue
                pip = _PIP_NAME.get(n.lower(), n.lower())
                if pip not in installed:
                    problems.append((rel, n, pip))
    return sorted(set(problems)), installed


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

    dep_problems, installed = _check_imports(workflow)

    print("GATE COMPLETENESS")
    print("  workflow          : %s" % _rel(WORKFLOW))
    print("  files scanned     : %d" % len(_candidates()))
    print("  exempted helpers  : %d" % len(NOT_A_SUITE))
    print("  pip packages      : %d" % len(installed))

    if missing:
        print()
        print("  %d suite(s) exist in tests/ but are NOT run by CI:" % len(missing))
        for m in missing:
            print("    [MISSING] " + m)
        print()
        print("  Add a step to .github/workflows/tests.yml, or add the file to")
        print("  NOT_A_SUITE with a reason if it is a helper. Do NOT exempt a")
        print("  real suite to make this green.")

    if dep_problems:
        print()
        print("  %d import(s) that CI cannot satisfy:" % len(dep_problems))
        for rel, mod, pip in dep_problems:
            print("    [NO DEP] %s imports %r -> add %r to the pip install step"
                  % (rel, mod, pip))
        print()
        print("  A suite wired into CI without its dependency fails on a clean")
        print("  runner even though it passes locally. That is what happened to")
        print("  legibility_gate.py and pdfminer in S103.")

    if unexplained:
        print()
        print("  %d exemption(s) name a file that no longer exists:" % len(unexplained))
        for u in unexplained:
            print("    [STALE] " + u)

    if missing or unexplained or dep_problems:
        print()
        print("GATE COMPLETENESS: FAILED")
        return 1

    print()
    print("GATE COMPLETENESS: every suite is wired into CI and its deps are installed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
