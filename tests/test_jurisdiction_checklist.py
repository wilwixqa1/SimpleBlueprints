#!/usr/bin/env python3
"""
S102: guard for compute_checklist() in backend/drawing/jurisdiction_sheet.py.

This had NO test coverage, which is how the attachmentType bug survived: the
function read params["attachmentType"], a key nothing in the repo ever writes,
so the "freestanding" PPRBD row was always NO even when the customer selected
Freestanding in the wizard. That is a wrong statement on a submitted document.

The wizard writes `attachment` with values "ledger" | "freestanding"
(steps.js:2983). engine.js/calc_engine.py read the same key.

Run: python3 tests/test_jurisdiction_checklist.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))), "backend"))

from drawing.jurisdiction_sheet import compute_checklist  # noqa: E402


def _base(**kw):
    p = dict(width=20, depth=14, height=4, attachment="ledger")
    p.update(kw)
    return p


def _calc(footing_depth=36):
    return {"footing_depth": footing_depth}


FAILURES = []


def check(label, got, want):
    ok = got == want
    print("  [%s] %-56s got=%s want=%s" % ("OK  " if ok else "FAIL", label, got, want))
    if not ok:
        FAILURES.append(label)


print("1. freestanding row reads the field the wizard actually writes")
# The regression this test exists for.
check("attachment=freestanding -> freestanding row True",
      compute_checklist(_base(attachment="freestanding"), _calc())["freestanding"], True)
check("attachment=ledger -> freestanding row False",
      compute_checklist(_base(attachment="ledger"), _calc())["freestanding"], False)

print("\n2. legacy attachmentType still honored as a fallback")
p = _base()
del p["attachment"]
p["attachmentType"] = "freestanding"
check("attachmentType=freestanding (no attachment key) -> True",
      compute_checklist(p, _calc())["freestanding"], True)
p2 = _base()
del p2["attachment"]
check("neither key present -> False (defaults to attached)",
      compute_checklist(p2, _calc())["freestanding"], False)

print("\n3. attachment wins over a stale attachmentType")
check("attachment=freestanding beats attachmentType=ledger",
      compute_checklist(_base(attachment="freestanding",
                              attachmentType="ledger"), _calc())["freestanding"], True)

print("\n4. height-driven rows (regression guard, unchanged by S102)")
check("height 1.0ft (12in) -> under18 True",
      compute_checklist(_base(height=1.0), _calc())["under18"], True)
check("height 4ft -> under18 False",
      compute_checklist(_base(height=4), _calc())["under18"], False)
check("height 8ft (96in) -> over8ft True",
      compute_checklist(_base(height=8), _calc())["over8ft"], True)
check("height 7.9ft -> over8ft False",
      compute_checklist(_base(height=7.9), _calc())["over8ft"], False)

print("\n5. excavation row follows footing depth")
check("footing 36in -> excavation False (not > 36)",
      compute_checklist(_base(), _calc(36))["excavation"], False)
check("footing 42in -> excavation True",
      compute_checklist(_base(), _calc(42))["excavation"], True)

print("\n6. unknowable rows stay None (never guessed)")
for k in ("cover", "electrical", "hottub", "cantilever"):
    check("%s stays None" % k, compute_checklist(_base(), _calc())[k], None)

print("\n7. explicit user answers override every auto value")
# A user who ticks the box must beat our detection, including on the row S102
# just fixed -- otherwise the fix would trample a deliberate answer.
check("override freestanding=True over ledger deck",
      compute_checklist(_base(attachment="ledger",
                              jurisdictionChecklist={"freestanding": True}),
                        _calc())["freestanding"], True)
check("override freestanding=False over freestanding deck",
      compute_checklist(_base(attachment="freestanding",
                              jurisdictionChecklist={"freestanding": False}),
                        _calc())["freestanding"], False)
check("override cover=True (was None)",
      compute_checklist(_base(), _calc(),
                        )["cover"] if False else
      compute_checklist(_base(jurisdictionChecklist={"cover": True}),
                        _calc())["cover"], True)
check("override of None value is ignored, stays auto",
      compute_checklist(_base(attachment="freestanding",
                              jurisdictionChecklist={"freestanding": None}),
                        _calc())["freestanding"], True)

print()
if FAILURES:
    print("JURISDICTION CHECKLIST: %d failure(s): %s" % (len(FAILURES), ", ".join(FAILURES)))
    sys.exit(1)
print("JURISDICTION CHECKLIST: all checks passed")
