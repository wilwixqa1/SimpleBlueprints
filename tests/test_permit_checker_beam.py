"""S108: the permit checker and the calc engine must see the same beam.

THE BUG (reported S106 as "the 19/20"): on Will's first real deck, 21.5 x 8.5,
the permit pre-check failed IRC_BEAM_SPAN while the engine raised no warning.
Root cause was a rounding asymmetry, not a structural question: the checker
read calc["beam_span"] -- the nominal width/(num_posts-1) selection figure,
ROUNDED to one decimal (10.75 -> 10.8) -- and compared it against the
UNROUNDED table allowable (10.79). The engine compared unrounded vs unrounded
and passed. Meanwhile the drawn layout's real post-to-post spans were 8.75'.

THE RULE (S108): every IRC R507.5 beam-span comparison uses the measured
max post-to-post span from the computed layout (calc_engine.max_layout_span),
compared unrounded; rounding is display-only. Both the engine warning and
permit_checker.check_beam_span apply it, so they cannot disagree about the
same calc again.

Pins:
  B1  max_layout_span measures the layout, not the nominal figure
  B2  Will's 21.5x8.5 deck: checker passes IRC_BEAM_SPAN, engine has no
      beam warning (the original repro)
  B3  the rounding trap itself: the nominal span still rounds ABOVE the
      allowable on this config, so B2 keeps exercising the asymmetry
  B4  a genuinely overspanned config (forced 2 posts + undersized beam)
      fails in BOTH the checker and the engine
  B5  agreement sweep: across a config matrix, engine-beam-warning presence
      == checker IRC_BEAM_SPAN failure, always
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))
os.chdir(ROOT)

from drawing.calc_engine import (  # noqa: E402
    calculate_structure, get_beam_max_span, max_layout_span,
)
from drawing.permit_spec import build_permit_spec  # noqa: E402
from drawing.permit_checker import run_checks  # noqa: E402

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


def beam_check_result(params):
    calc = calculate_structure(params)
    spec = build_permit_spec(params, calc)
    report = run_checks("deck", params, calc, spec)
    res = [r for r in report.checks if r.id == "IRC_BEAM_SPAN"]
    return calc, (res[0] if res else None)


def has_beam_warning(calc):
    return any("exceeds IRC max" in w and "Beam span" in w
               for w in calc.get("warnings", []))


print("B1. max_layout_span measures the layout, not the nominal figure")
calc = calculate_structure(dict(BASE))
actual = max_layout_span(calc["beam_layout"])
check("B1a 21.5' deck, 3 posts at 2/10.75/19.5 -> 8.75' spans",
      abs(actual - 8.75) < 1e-9, actual)
nominal = calc["width"] / (calc["num_posts"] - 1)
check("B1b measured span < nominal selection span",
      actual < nominal, (actual, nominal))
check("B1c calc exposes beam_span_actual",
      abs(calc.get("beam_span_actual", -1) - 8.75) < 1e-9,
      calc.get("beam_span_actual"))
check("B1d empty/missing layout returns None",
      max_layout_span(None) is None and max_layout_span({}) is None)


print("B2. the original repro: 21.5x8.5 passes both engine and checker")
calc, res = beam_check_result(dict(BASE))
check("B2a checker IRC_BEAM_SPAN status == pass",
      res is not None and res.status == "pass",
      res.status if res else "check missing")
check("B2b engine raises no beam-span warning",
      not has_beam_warning(calc), calc.get("warnings"))


print("B3. the rounding trap is still live in this fixture")
# Guard that B2 keeps exercising the asymmetry: if the IRC table snapshot ever
# shifts so the nominal span no longer rounds above the allowable, this fires
# and the fixture must be re-chosen (see test_irc_table_drift for the tables).
allowable = get_beam_max_span(calc["beam_size"], calc["joist_span"],
                              calc["LL"], calc["species"])
check("B3a round(nominal,1) > unrounded allowable (the old fail)",
      round(nominal, 1) > allowable, (round(nominal, 1), allowable))
check("B3b unrounded nominal <= allowable (the engine's old pass)",
      nominal <= allowable, (nominal, allowable))


print("B4. a genuinely overspanned config fails in BOTH systems")
bad = dict(BASE, width=20, overPostCount=2, overBeam="2-ply 2x8")
calc_bad, res_bad = beam_check_result(bad)
span_bad = max_layout_span(calc_bad["beam_layout"])
allow_bad = get_beam_max_span("2-ply 2x8", calc_bad["joist_span"],
                              calc_bad["LL"], calc_bad["species"])
check("B4a fixture really overspans (measured > allowable)",
      span_bad > allow_bad, (span_bad, allow_bad))
check("B4b checker IRC_BEAM_SPAN fails",
      res_bad is not None and res_bad.status == "fail",
      res_bad.status if res_bad else "check missing")
check("B4c engine warns", has_beam_warning(calc_bad), calc_bad.get("warnings"))
check("B4d checker detail reports the measured span",
      res_bad is not None and ("%.2f'" % span_bad) in (res_bad.detail or ""),
      res_bad.detail if res_bad else "")


print("B5. agreement sweep: engine warning presence == checker verdict")
sweep = [
    dict(BASE),                                            # the repro
    dict(BASE, width=12, depth=8),                         # small deck
    dict(BASE, width=40, depth=12, snowLoad="heavy"),      # big + heavy snow
    dict(BASE, width=20, overPostCount=2, overBeam="2-ply 2x8"),   # forced fail
    dict(BASE, width=28, depth=10, overPostCount=2),       # forced wide span
    dict(BASE, width=16, depth=10, attachment="freestanding"),     # freestanding
    dict(BASE, width=24, depth=9, overBeam="2-ply 2x10"),  # undersized override
]
for i, cfg in enumerate(sweep):
    calc_i, res_i = beam_check_result(cfg)
    if calc_i["beam_size"] == "3-ply LVL 1.75x12":
        # LVL is outside the prescriptive tables in both systems; the checker
        # flags it as needing engineering docs, the engine skips the span
        # warning. Not a span disagreement -- excluded from this pin.
        print("  B5.%d w=%-4s (LVL selected, excluded)                        ok"
              % (i, cfg["width"]))
        continue
    eng = has_beam_warning(calc_i)
    chk = res_i is not None and res_i.status == "fail"
    check("B5.%d w=%-4s engine_warn=%-5s == checker_fail=%-5s"
          % (i, cfg["width"], eng, chk), eng == chk,
          (calc_i.get("warnings"), res_i.detail if res_i else None))


print()
if fails:
    print("PERMIT CHECKER BEAM: %d FAILURE(S): %s" % (len(fails), fails))
    sys.exit(1)
print("PERMIT CHECKER BEAM: all checks passed")
