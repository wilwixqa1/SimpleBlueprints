# S102 CONTEXT (in progress)

Session theme so far: chased the S101 handoff's railing item, found it
misdiagnosed, and followed the evidence into what was actually wrong. Two
pushes landed. This file collects the findings that did NOT get fixed, so they
do not have to be rediscovered.

Pushed so far:
- `894c53e` S102 push 1: parked freestanding rail / deck-position question
  (docs only). See `docs/PARKED_freestanding_rail_and_deck_position.md`.
- `6c04d3f` S102 push 2: count stair guard + handrail in materials, both
  engines.

---

## 1. TEST COVERAGE GAP: golden does not check the materials sheet

**This is the most important process finding of the session.**

`tests/pdf/golden_structural.py` line 154, `SHEETS`, covers exactly four
sheets:

```python
SHEETS = [
    ("site", _site),
    ("plan", _plan),
    ("framing", _framing),
    ("details", _details),      # added S96
]
```

Elevations is omitted on purpose (documented in that file: ~1000 hatch/bracing
primitives per config makes a huge noisy golden).

**The materials sheet is not in the list and never has been.** Consequences:

1. A materials change cannot move golden. When S102 push 2 changed the
   materials output on every deck with stairs, golden still reported 20/20.
   That was a true result that said nothing about the change. Do not read
   "golden green" as "materials verified" — they are unrelated.
2. This is the most likely reason the railing divergence survived so long.
   `estimate_materials` and `estMaterials` have no fingerprint guard at all.
   The only thing watching them is `tests/test_frontend_parity.py`, which
   checks the two engines against EACH OTHER, not against a known-good
   baseline. Per S101 learning 4, that catches drift between the sides but
   cannot catch both sides being wrong together — which is exactly what the
   missing stair railing was.

**Recommended fix, when someone picks this up:** add `("materials", _materials)`
to `SHEETS` and regenerate with `--update`. Cheap, and it turns every future
materials change into a deliberate, reviewable golden diff instead of a silent
one. Check first whether the materials sheet emits a stable primitive set
across runs (no timestamps, no dict-order dependence) or the fingerprint will
be flaky.

Note the naming: the file is `golden_structural.py` and its docstring frames it
as a structural guard, so "materials is missing" is arguably by design rather
than an oversight. Either extend it or add a sibling `golden_materials.py`.
That is a judgment call for Will.

---

## 2. Steel path: stair railing not counted, and already divergent

S102 push 2 covered the WOOD path only. Steel decks still bill no stair
railing.

Fixing steel is not a copy-paste, because the steel stair emitters are already
inconsistent between the two engines, from before S102:

| | modern `deckStairs` | legacy `hasStairs` |
|---|---|---|
| `engine.js estSteelMaterials` (line 629) | yes, loop at ~772-774 | yes, branch at ~786-788 |
| `draw_materials.py estimate_steel_materials` (line 24) | **NO** | yes, `stair_info` at 116-118 |

So a steel deck configured with `deckStairs` gets stair materials on the screen
and, as far as the emitters go, a different answer on the PDF. This is the same
class of defect S99 fixed for the wood path (Python only understood legacy
params, so `deckStairs` decks got no stair materials on the sheet).

**Order of work:** bring `estimate_steel_materials` up to the modern
`deckStairs` shape FIRST, add steel cases to `test_frontend_parity.py` (there
are none today — no steel case and no steel cutout case exists in parity at
all), and only then add the stair rail. Doing the rail first would paper over
the bigger bug.

---

## 3. `attachmentType` is a dead field (unblocked, real, cheap)

Exhaustive grep, whole repo, `.js` and `.py`. Three occurrences, **all reads,
nothing ever writes it**:

```
backend/static/js/steps.js:4876             var isDet = p.attachmentType === "freestanding";
backend/static/js/steps.js:5037             var isDetached = p.attachmentType === "freestanding";
backend/drawing/jurisdiction_sheet.py:95    attachment = params.get("attachmentType", "attached")
```

The wizard writes `attachment` (`steps.js:2983`, a two-option chip: Ledger
Board / Freestanding).

Live consequences:
- `steps.js:4876` `isDet` is always false, so the `freestanding` auto-value in
  the jurisdiction checklist never fires.
- `steps.js:5037` same.
- `jurisdiction_sheet.py:95` always falls back to `"attached"`, so **the
  jurisdiction sheet states the deck is attached even when the customer
  selected Freestanding.** That is a wrong statement on a submitted document.

**Fix:** read `attachment`, keeping `attachmentType` as a fallback for any
stored configs. Confirm whether saved params in the wild carry `attachmentType`
before dropping the fallback. Small, self-contained, no geometry impact. This
is independent of the parked freestanding railing question and should not be
bundled with it.

---

## 4. Switchback stairs: landing perimeter guard not counted

S102 push 2 sizes stair rail from the sloped run using the same `total_run`
formula the stringer count already uses. A switchback stair has an intermediate
landing platform whose open perimeter also needs a guard, and that is not
added. So switchback stairs are understated.

Consistent with how stringers are already billed, so not a new inconsistency,
but not complete either. Needs the landing geometry from
`compute_stair_geometry` (`geom["landings"]`) to size properly, and a decision
on how many sides of the landing are open.

---

## 5. Stair rail kit price is an estimate

Priced at 95 in both engines against 85 for the deck kit, on the reasoning that
stair rail kits carry angled hardware. **Not a sourced number.** One-line change
in both files if Will has a real figure. Estimate only, never a permit number.

---

## 6. Permit set contradicts itself on handrail sides

- `draw_plan.py:1110` prints `'HANDRAIL ON BOTH SIDES, 34" ABOVE NOSING'`.
- `draw_notes.py:374` says handrails are required on at least one side at 4+
  risers, which is what IRC R311.7.8 actually requires.

Both statements ship in the same PDF. S102 push 2 bills both sides (Will's
call), so the plan sheet is now consistent with the count and the notes page is
the outlier. Not changed yet because it is a text edit on the permit path and
was outside the agreed scope of push 2.

Will's own framing on when one side is legitimate: a stair running against a
deck edge, or a landing on an L-shaped deck, where one side is closed by the
deck itself. That is roughly our `is_transitional` case. Worth wiring to that
flag if the one-side variant is ever wanted.

---

## 7. Corrections to the S101 handoff

- **Item 2.2 was misdiagnosed.** It says JS `railLen` does not account for the
  notch perimeter. Measured: `railLen` and `rail_length` agree exactly on every
  case, notched or flat. Production JS applies the same zone-aware exposed-edge
  override Python does, in `app.js:782-794` (`cAdj`). The "7 PY / 6 JS" gap the
  parity test reports is a **harness artifact**: the test calls
  `estMaterials(p, calcStructure(p))` directly and so bypasses `cAdj`.
- Therefore `RAIL_GAP_CASES` in `test_frontend_parity.py` is not documenting a
  production divergence in the direction stated. Anyone deleting it should
  understand it was masking a test-scaffolding difference, not a code bug.
- **Architectural note worth acting on:** `estMaterials`'s correctness depends
  on the caller having patched `c.railLen` first. `app.js` does; the test does
  not; any other caller might not. Moving the zone-aware override into
  `engine.js` would make the engine self-contained and make the parity test
  actually test production. No output change on any path. Recommended before
  anyone trusts a railing parity result again.
- This is S101 learning 8 ("grep before believing a backlog entry") repeating
  for the third recorded time, now in a handoff backlog entry rather than a
  chat claim.
