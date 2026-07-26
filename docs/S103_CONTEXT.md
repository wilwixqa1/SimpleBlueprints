# S103 SESSION CONTEXT — the material list catches up to the drawings

Repo: github.com/wilwixqa1/SimpleBlueprints — main @ **49cee3e** — gate green,
**22/22**, golden 28/28 unchanged.

Read alongside `S102_SESSION_CONTEXT.md` (which supersedes
`S102_SEAM_AUDIT_CONTEXT.md`) and `PARKED_freestanding_rail_and_deck_position.md`.

**Numbering.** Will opened saying "session 102", which was already closed with 20
pushes. He was asked rather than guessed at, and chose **S103**. That is the fix
for the S101/S102 mess: ask, do not self-label.

---

## 0. START HERE — BLOCKING ITEMS

> **BLOCKER 1 — Freestanding detailing has NO reference corroboration.**
> Magnitude: every freestanding deck the product emits.
> Carried unchanged from S102. Zero of the four reference sets contains a
> freestanding deck. The inset `c = min(1.5, D/6)` is our inference.
> Unblocks when: Billy answers §8 of `S102_SESSION_CONTEXT.md`.

> **BLOCKER 2 — Interior openings refused; the detail exists but is unconfirmed.**
> Magnitude: any stair or obstruction fully inside the deck.
> Still refused in both engines (`zone_utils.py:527-542`, `zoneUtils.js:1153`),
> and the warning text still claims "no reference detail exists", which S102
> push 19 already contradicted. S103 got closer but did NOT close it: see §4.
> Unblocks when: Will confirms from the rendered crops which of the three
> doubled members are trimmers vs header, and whether the house side is closed.

> **BLOCKER 3 — NEW. The material sheet has no golden coverage.**
> Magnitude: every material number the product has ever shipped.
> `golden_structural.py` `SHEETS` = site, plan, framing, details. The material
> sheet is not in it, so no material-list change can move golden. Confirmed by
> this session's fix altering real line items with golden at 28/28 throughout.
> Until S103, the only guard was JS-vs-Python parity, which stays green if both
> sides drift the same way.
> Unblocks when: someone adds the material sheet to `SHEETS` and `--update`s.
> Small push, no design question. Invariant 3 (§2) covers only the rail line.

---

## 1. WILL'S RULE FOR THIS SESSION — write it down, it decided everything

> "I feel very comfortable right now with what is actually drawn on the permits
> and what's actually drawn in 3D. If the material list does not equate to what's
> being drawn, we make the material list look like that. We should not be messing
> with how the current railing looks in the permit or in 3D."

The drawings are the source of truth. The material list follows them. This turned
a debatable three-way disagreement into a mechanical fix with no judgement calls,
and golden proved nothing drawn moved.

**It also has a limit, and the limit matters (§5.2).** On flat decks the drawing
is the side that is behind reality, so applying the rule literally there would
make things worse. A source-of-truth rule is a tiebreaker, not a law of physics.

---

## 2. WHAT SHIPPED

| SHA | What |
|-----|------|
| `35f4286` | Push 1: the material list now bills the rail the drawings show. |
| `49cee3e` | Push 2: CI ran 11 of 21 suites; now runs all of them and cannot drift again. |

### Push 1 — four surfaces, three answers, one deck

Measured on a 20x14 ledger deck, centered 4 ft front notch, one 4 ft front stair:

```
drawn on the framing sheet (draw_plan.py:392)      54.0 LF
billed by the material list (draw_materials:161)   56.0 LF   over-bills the gap
billed by the STEEL material path (draw_materials:37)  44 LF  misses notch wrap
shown on screen (app.js cAdj override)               52 LF   blunt subtraction
```

Sweep of 450 notch+stair configs: 444 had drawn ≠ billed; **312 changed a real
line item.** Wood always over-billed. Steel under-billed by 8-10 LF on every
notched deck, which is the worse direction — the contractor shows up short.

Root cause is the S102 shape exactly: the rail-gap rule was written **inline in
`draw_plan.py` and nowhere else**, so the material list could not see it, and
`estimate_steel_materials` had no zone branch at all.

Fix, the rule expressed once per engine:
- NEW `stair_utils.build_front_stair_openings()`; `draw_plan` calls it instead of
  inlining it.
- NEW `draw_materials._rail_length()`; both the wood and steel estimators use it.
- NEW `engine.js railLengthFromDrawing()`; applied in **both** `calcStructure`
  and `calcSteelStructure`. The `app.js` `cAdj` override is retired.
- Busters `s103a` on `engine.js` and `app.js`. Nothing else was edited.

Real before/after, captured by **stashing the changes and re-running**, not
reconstructed (a first attempt at reconstruction invented item names that do not
exist and had to be thrown away — see §6.3):

```
16x12, 6x5 notch, 5 ft stair, wood    7 rail kits -> 6   over-bill corrected
20x14 notch + 4 ft stair, STEEL       6 rail kits -> 7   under-bill corrected
20x14 notch, no stair,    STEEL       6 rail kits -> 7
flat decks                            byte-identical
```

Two wood configs did not move because rounding absorbed 1-2 LF. The error was
always real; it only sometimes crossed a kit boundary.

**Guard: `test_cross_system_consistency` invariant 3.** 90 notch+stair configs,
wood and steel, asserting the estimator's rail line equals the drawn length.
Asserted against **estimator output, not the helper** — the first draft checked
`_rail_length` directly and stayed completely green when the steel call site was
reverted. Mutation-tested three ways (helper, steel call site, wood call site);
all three fire.

**`test_frontend_parity`:** the S101 `RAIL_GAP_CASES` skip drops from six cases to
one. Five now assert full parity including Railing.

### Push 2 — CI was running half the gate

Measured at `cedb50b`, workflow diffed against the documented gate:

- **9 suites in the documented gate that CI never ran**, including
  `golden_structural`, `test_frontend_parity` and
  `test_cross_system_consistency` — the three that caught S102's real bugs.
- 3 suites CI ran that no handoff listed (`fuzz_configs`, `linework_check`,
  `panel_check`).
- 1 in **neither** list: `tests/pdf/legibility_gate.py`, a real passing gate
  nobody was running.

Workflow last touched 2026-07-23. The gate grew for three sessions without it,
while Railway autodeployed from main with no gate.

**Why it kept happening:** S100's handoff said "re-derive the gate from
`ls tests/`". S101 and S102 repeated it. It drifted anyway, because **an
instruction in a document is not a mechanism.**

NEW `tests/test_gate_completeness.py` is the mechanism: walks `tests/`, reads the
workflow, fails naming any suite not wired in. Helpers live in `NOT_A_SUITE` and
each needs a written reason; an exemption naming a file that no longer exists
also fails, since a stale exemption is itself evidence the list was copied rather
than checked. It runs **first** so a wiring mistake is the first thing you see.
Mutation-tested three ways: drop the golden step (reproduces the historical
drift), add a suite without wiring it, leave a stale exemption. All three fire.

---

## 3. THE FULL GATE — 22 invocations, derived from the workflow

Do **not** copy this list into the next handoff. Read
`.github/workflows/tests.yml`; `test_gate_completeness.py` keeps it honest.

Local timings, this container: config_matrix 32 s, legibility_gate 67 s, fuzz
17 s, panel 9 s, linework 8 s, golden 3 s, everything else ~6 s. About 142 s
total. CI timeout raised 10 → 20 min for slower hosted runners.

Still in force:
- Golden **MUST** be `SBP_SHEET=arch_d`. Bare it fails with everything scaled by
  2.571 (36/14) — a sheet-size signature, not a regression.
- **Stale bytecode will lie to you.** If a test fails on a file `git diff` calls
  clean: `find . -name __pycache__ -type d -exec rm -rf {} + ; find . -name '*.pyc' -delete`
- Busters: verify by grep, never from a table.
  `grep -n "\.js?v=\|\.css?v=" backend/static/index.html`

---

## 4. MEADOWVIEW A-8 — advanced, NOT closed

The A-8 sheet was located by **rendered title, not page index** (it is page 8 of
8; both agree here, but the habit is the rule). Text layer extracted with
bounding boxes:

```
   x0      y0       x1      y1   orient  text
  717.4   746.3    764.0   755.8  horiz  FIREPLACE
  647.7   760.4    657.2   844.3  VERT   (2) P.T. 2X8 BEAM W/ 'LU228' @ EACH END
  813.6   759.3    823.1   843.3  VERT   (2) P.T. 2X8 BEAM W/ 'LU228' @ EACH END
  712.5   785.0    797.0   805.4  horiz  (2) P.T. 2X8 BEAM W/ 'LU228' @ EACH END
  990.0   710.3   1094.3   730.7  horiz  2x8 P.T. LEDGER W/ (2) LEDGER LAGS @ 16" O.C.
```

Two members flank the fireplace left (x≈652) and right (x≈818) with **rotated**
labels; one sits between them with a **horizontal** label. Two flanking plus one
crossing is the standard trimmer/trimmer/header arrangement. The ledger is at
y≈710-730 while the opening members start at y≈759, which suggests the opening
stands off the house side rather than being closed by it.

**This is NOT the visual confirmation BLOCKER 2 asks for.** Label rotation is a
drafting convention for member direction, a strong heuristic but not the drawn
geometry. The `view` tool returned image placeholders again, so nothing on this
sheet was actually seen. 200 dpi crops were rendered and handed to Will, who is
the visual ground truth:
`A8_fireplace_opening.png`, `A8_opening_in_context.png`, `A8_full_sheet.png`.

Do not implement interior openings off the coordinate table above.

---

## 5. DELIBERATELY NOT FIXED

### 5.1 Freestanding + notch stays out of parity

Python keeps the house-side edge (`zone_utils.py:283-284` gates the skip on
`attachment == "ledger"`); JS has no attachment awareness. Which is right depends
on an unanswered product question — the wizard says freestanding means detached,
the geometry puts the deck tight against the wall at y=0, and there is no
parameter to move it. `PARKED_freestanding_rail_and_deck_position.md` §3 is
explicit that closing it either way silently decides that question. The single
remaining `RAIL_GAP_CASES` entry carries that reasoning inline so nobody deletes
it to turn a build green.

### 5.2 Flat decks disagree in the OPPOSITE direction

On a flat deck with a front stair the sheet draws the rail **continuous** — S91
gated the rail opening to notched decks deliberately, for byte-identity — while
the material list bills the gap. Measured: drawn 48 LF, billed 44 LF on a 20x14.

Here the **drawing** is behind reality (a stair does descend through the rail)
and the material number is physically right. Applying Will's source-of-truth rule
literally would bill rail across a real opening. Left untouched. Resolving it
means drawing the opening on flat decks, which moves golden.

### 5.3 `attachmentType` is still a dead field

From the parked doc §5, unblocked and still unfixed: nothing writes
`attachmentType`, three places read it, and `jurisdiction_sheet.py:95` therefore
**reports every deck as attached on the permit sheet even when the customer chose
Freestanding.** That is a wrong statement on a submitted document. It is
independent of the railing question and needs no decision.

---

## 6. LEARNINGS

1. **A source-of-truth rule is a tiebreaker, not a law.** Will's "the drawings
   are right" resolved a three-way disagreement instantly and correctly on
   notched decks — and would have caused a new bug on flat decks, where the
   drawing is the incomplete side. Apply the rule, then check where it stops
   applying.

2. **An instruction in a document is not a mechanism.** Three consecutive
   handoffs told the next session to re-derive the gate from the filesystem.
   Three consecutive sessions did not. The fix was 130 lines of test, not a
   fourth, firmer sentence.

3. **Test the call site, not the helper.** Invariant 3's first draft asserted on
   `_rail_length` and was completely green while the steel estimator was reverted
   to the broken formula. A guard that cannot see the wiring is not a guard. This
   is S102's "test the interaction, not the form" in a new costume.

4. **Reconstructing "before" is not measuring it.** The first before/after table
   invented material line items that do not exist, because it re-implemented the
   old rule from reading the code. `git stash`, run, `git stash pop`, run is the
   real measurement and it took less time than the reconstruction.

5. **A green golden can mean the sheet is not covered.** Golden stayed 28/28
   through a change that altered real line items. That is correct — it proves
   nothing DRAWN moved — but it is easy to read as "nothing changed". Ask what a
   passing test actually covers before taking comfort from it. S102 learning 4,
   confirmed again on a different sheet.

6. **A test that skips a category hides a bug in plain sight.**
   `RAIL_GAP_CASES` documented the railing divergence honestly in a comment and
   then excluded it, so the gate was green over a known defect for two sessions.
   An honest exclusion still buys silence. Prefer a failing known-open marker to
   a skip.

7. **Ask which session this is.** Three session numbers for one day of work cost
   real confusion in S102. One question at the top of S103 cost nothing.

8. **When the tool is down, say so and hand it over.** The `view` tool returned
   placeholders. The alternative was not to guess from coordinates and call it
   verified — it was to extract what the text layer objectively supports, label
   it as a heuristic, render crops, and give them to the person who can see.

---

## 7. RECOMMENDED NEXT

1. **Add the material sheet to golden** (BLOCKER 3). Small, no design question,
   and it closes the coverage gap that let all of this run unobserved.
2. **Will confirms A-8 from the crops**, then implement interior openings
   (BLOCKER 2). Unblocks obstruction support: chimneys, trees, hot tubs.
3. **Fix `attachmentType`** (§5.3). Unblocked, on the permit path, wrong on a
   submitted document. Read `attachment`, keep `attachmentType` as a fallback for
   stored configs.
4. **Watch the first CI run on main.** The new workflow has never executed on
   GitHub's runners; the dep list and timings come from this container on Python
   3.12 and CI pins 3.11.
5. **Flat-deck rail opening** (§5.2). Needs a decision, moves golden.
6. **Billy on BLOCKER 1**, unchanged from S102.
7. **Add LU228** to the hardware schedule for doubled members. Carried from S102.
8. `stair_support.py` still has **zero importers** outside its own tests. Carried
   from S102, now with three independent reference confirmations.
