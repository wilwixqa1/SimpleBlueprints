# S102 SESSION CONTEXT — stair notches, freestanding decks, and a retraction

Repo: github.com/wilwixqa1/SimpleBlueprints — main @ **9a1b5a3** — full gate green
(17 suites, golden 28/28).

**This file supersedes `S102_SEAM_AUDIT_CONTEXT.md`, whose section 0 is WRONG.**
See §1 below. It also sits alongside `S101_HANDOFF.md` (earlier in the same
thread) and the parallel session's `S102_CONTEXT.md` (different work: steel
labels, jurisdiction checklist, guard rail). Read all four, this one first.

**Numbering warning.** Will opened saying "session 100." The handoff on disk was
S100's, so this thread self-labelled S101 without asking, and a parallel session
then labelled itself S102. One day's work spans three session numbers. Will's
call: **leave it.** Do not rewrite history.

---

## 0. START HERE — BLOCKING ITEMS

Per the process rule Will asked for: blockers are numbered, at the top, with a
magnitude and a definition of done. Not prose in a section body.

> **BLOCKER 1 — Freestanding detailing has NO reference corroboration.**
> Magnitude: every freestanding deck the product emits.
> Zero of the four reference sets contains a freestanding deck (§5). The S102
> rebuild is pure IRC R507.6 arithmetic. Billy said "two beams," which matches,
> but the inset `c = min(1.5, D/6)` is **our inference**.
> Unblocks when: Billy answers the three questions in §8.

> **BLOCKER 2 — Interior openings are refused, but the detail now exists.**
> Magnitude: any stair or obstruction fully inside the deck.
> `get_stair_opening_rects()` emits an `interior_opening` warning and declines to
> cut, because S100 recorded that no reference example existed. Meadowview A-8
> **is** that example (§6). The refusal can now be implemented against a real
> detail rather than a guess.
> Unblocks when: someone confirms the A-8 arrangement **visually** — the
> not-verified list in `docs/reference_sets/README.txt` is explicit about what
> was read from the text layer only.

---

## 1. RETRACTION — S102 PUSH 13 WAS WRONG

`S102_SEAM_AUDIT_CONTEXT.md` §0 declares S100's "post inside the stair opening"
finding a false positive, over 66 configs, with a table. **That conclusion is
wrong and the finding was real.**

What happened: the sweep built stairs only from `location` + `offset` — the
**sidebar** fields — which always pin a stair to the deck edge, where genuinely
nothing collides. It never exercised the **drag**. `planView.js:119` writes
`anchorX`/`anchorY` directly, and `onUp` only snaps back to an edge if released
within 1.5 ft of one. Drag a stair into the deck and it stays there.

Measured on a 40×12 before the fix:

```
stair box   x[18.0, 22.0]  y[6.0, 11.2]
post at     (20.0, 10.5)          <-- inside it in BOTH axes
```

A 6×6 post standing in the stairway with the beam running through it, on the
permit set. S100 was right.

**The generalisable lesson, now written into the test file itself:** a config
built from the sidebar fields is not the same as a config built from the canvas.
Test the *interaction*, not the form. A confident, well-evidenced correction
built on the wrong input surface is more dangerous than no analysis, because it
retires a real bug and puts a table under it.

---

## 2. WHAT SHIPPED

| SHA | What |
|-----|------|
| 9a1b5a3 | 19: Meadowview contains the interior-opening detail S100 said didn't exist. Docs only. |
| 55b5089 | 18: freestanding materials — beam qty and hurricane ties never doubled. Both engines. |
| 973c15a | 17: add Meadowview reference set; **no set has a freestanding deck**. |
| c4e9636 | 16: freestanding modelled as ledger — IRC R507.6 rebuild. Both engines. Golden 20→28. |
| 9618cd9 | 15: a stair dragged into the deck now opens the framing. Both engines. |
| 2bcc312 | 14: seam audit context doc — **§0 retracted, see §1 above**. |
| 95f2120 | 13: cross-system audit; contained the wrong false-positive claim. |

Earlier in the same thread, labelled S101: `085f10e` JS beam-layout port ·
`a94cf1e` IRC deck-table snapshot + drift guard · `a065490` mobile home page ·
`63b40c1` S101 handoff.

---

## 3. THE STAIR NOTCH FIX (push 15)

**Cutouts and notches are different things from the user's side, and only one
reached the framing.** Will said this repeatedly before it landed:

- **CUTOUT** — button in the plan view, user-placed, edge-limited. Lands in
  `params["zones"]`, so `get_cutout_rects()` returns it and the framing opens.
  This always worked, which is why the S94 example looked right.
- **NOTCH** — stair **dragged** into the deck. Lands in `params["deckStairs"]`
  with `anchorX`/`anchorY` and populated **nothing** the framing engine read.

New `zone_utils.get_stair_opening_rects()` / `get_opening_rects()`, mirrored in
`zoneUtils.js`. Trigger is purely geometric:

```
stair footprint overlaps the deck plane -> opening, framing opens
stair footprint clears it               -> nothing (edge stairs byte-identical)
```

Wired into `calc_engine` (both beam sites), `draw_plan` (framing sheet) and
`engine.js`. Golden unchanged — no existing sheet moved.

**Two traps, both worth knowing:**
- **RECURSION.** `stair_utils` calls `get_cutout_rects()` to find the notch edge
  a stair snaps to. Folding stair openings into that function loops forever, so
  `get_cutout_rects()` stays cutouts-only and `get_opening_rects()` sits beside
  it for framing consumers. Documented at both definitions. **Do not merge them.**
- **DOUBLE COUNT.** A stair snapping into an existing cutout is the same hole.
  The first version emitted both; golden caught it as a duplicate `DBL HEADER` on
  `notch_front_stair`. Deduped at 80% area overlap.

Refused deliberately: fully-interior stairs (§ BLOCKER 2) and off-axis rotations
(a bbox would over-cut — the S81e mistake).

---

## 4. FREESTANDING DECKS WERE MODELLED AS LEDGER DECKS (pushes 16, 18)

Will: *"basically everything about freestanding decks has been wrong… we had been
treating them exactly the same."* Confirmed, and the worst was on the permit set.

### 4.1 The unsafe part

`joist_span = depth/2 - 0.75` did not merely give a wrong number — **it described
a deck that cannot be built.**

A freestanding deck has no ledger, so both ends of every joist land on a beam:
`D = 2c + s`. IRC R507.6 caps a cantilever at ¼ the adjacent span, so `c ≤ s/4`,
so `D ≤ 1.5s` — the **shortest** span a depth-D deck can have is `2D/3`.

| depth | code assumed | IRC minimum | realizable |
|---|---|---|---|
| 12 | 5.25 | 8.00 | no |
| 16 | 7.25 | 10.67 | no |
| 20 | 9.25 | 13.33 | no |

Below the minimum at **every** depth. Two consequences on issued plans:

- **Undersized joists.** 20×16 freestanding got **2×6** where the same deck on a
  ledger got 2×12. Corrected: 12 ft→2×8, 14 ft→2×8, 16 ft→2×10, 20 ft→2×12.
- **Overstated max depth.** `max_depth_for_joists` inverted the same formula and
  reported a **33 ft** deep freestanding deck on 2×6 joists. A ledger deck maxes
  at 17.2 ft on 2×8. Now ~18.8 ft.

Fix: `freestanding_geometry(depth)` → `c = min(1.5, D/6)`, `s = D - 2c`. The 1.5
keeps the ledger setback convention; `D/6` is the IRC cap and binds below 9 ft.

### 4.2 The missing beam

The engine has **always** doubled posts, footings and hangers for freestanding —
it modelled two beams — but the second beam existed only as a count.
`beam_layout` carried one line and every drawing showed one beam, on a deck that
by definition is not attached to anything.

Both beams now exist (`post_xy`, `segments`, `beam_lines=2`) and `draw_plan`
renders the second line with its posts. Drawn **explicitly, not through the
stepped path** — these are two independent beams, and the stepped branch's
vertical connector between segments would wrongly join them.

`post_positions` and `total_posts` keep their meaning: one line's x positions,
doubled count. Every downstream reader still works.

### 4.3 Materials (push 18, found by Will asking "do we make more posts?")

We do. Posts, footings, piers, bases, caps and concrete all doubled correctly and
the ledger lines correctly disappear. **Two did not:**

- **Beam material** — `ceil(W/20) * plies` with no attachment factor. A 24×12
  freestanding deck quoted 4 lengths while needing 8.
- **Hurricane ties** — flat `nJ`. The comment above it already stated the rule
  correctly (one per joist-to-**beam bearing point**, per Ilaria and Loucks) and a
  freestanding joist bears on two. `calc_engine`'s `joist_hangers_for_beam`
  already doubled for exactly this reason; the tie line never did.

Verified 24×12: posts 4→8, footings 4→8, concrete 100→200, **beam 4→8, ties
19→38**.

### 4.4 Golden had no freestanding coverage

**All 20 fingerprinted sheets were ledger decks.** That is how this survived: the
freestanding permit path was never fingerprinted. Added `freestanding_shallow`
(20×10) and `freestanding_deep` (24×16); golden is now **28**, and the 20
pre-existing fingerprints are unchanged.

### 4.5 Left alone, recorded

Footing tributary uses **full deck depth per post on both beam lines**, so a
freestanding deck is designed for roughly twice its actual load. Over-conservative
— safe direction, wasteful. Needs Billy before changing.

---

## 5. NO REFERENCE SET HAS A FREESTANDING DECK

Ilaria, Loucks, Welborn **and** Meadowview are all ledger-attached. Meadowview
says it directly: `2x8 P.T. LEDGER W/ (2) LEDGER LAGS @ 16" O.C.`

So everything in §4 is IRC arithmetic with **zero corroboration from Rick's
plans**. Present it to Billy that way. This is BLOCKER 1.

---

## 6. MEADOWVIEW — THE NEW REFERENCE SET (pushes 17, 19)

`docs/reference_sets/Meadowview_reference_set.pdf`. 4307 Meadowview Ct, Rick
Rutstein / All Things Architecture, 11/12/24, 8 sheets, text layer present. Deck
framing is sheet A-8.

**It contains the interior-opening detail S100 said did not exist.** The deck
wraps a masonry fireplace inside the footprint:

```
(2) P.T. 2X8 BEAM W/ 'LU228' @ EACH END     <-- three of them
(2) P.T. 2X8 @ RIM                          <-- doubled rim throughout
2X8 PT JOISTS @ 16" O.C., 'LU28' EA. JOIST (BOTH ENDS)
```

Doubled 2×8 members, face-hung with Simpson LU228 at each end, boxing the
obstruction. Same trimmer/header vocabulary as a notch, applied to an opening
that does not touch an edge. **An obstruction — chimney, tree, bay window, hot
tub — is just an interior cutout that never reaches an edge**, so it is the same
geometry and the same headers.

Hardware gap: LU228 is the double-2×8 face-mount hanger. Our estimate carries
`LUS28Z`/`LUS210` for single joists and nothing for doubled members hung off other
framing.

**NOT VERIFIED — read from the text layer, arrangement not confirmed visually:**
which of the three doubled members are trimmers vs headers; whether the opening
is interior on all four sides or closed by the ledger on the house side; whether
the doubled rim is job-specific or standard. Do not build on these without eyes
on the sheet. This is the S100 push-13 trap (a detail built from a magazine
article, thrown away in push 14).

**Other Meadowview findings:**
- **6X12 P.T. SOLID timber beam**, posts @ 12'-0" O.C., "SPLICE BEAM OVER CENTER
  OF PIER, TYP." We produce multi-ply at comparable spans and model no splice
  rule. Both legitimate.
- **Hardware differs between Rick's own jobs**: PC66 cap + PBS66 base here vs
  ABU66Z + BCS2-3/6 in Ilaria/Loucks. Our estimate hardcodes the latter, which
  should be understood as one valid choice, not a standard.
- Secondary flush beams and a doubled rim — we model neither.
- **Stair at lower landing corroborates Ilaria/Loucks exactly** (2×14 stringer @
  16", notch stringer for plate, min 4" thick landing). Third independent
  confirmation that a run to grade gets no posts — strengthens the case for
  wiring `stair_support.py`, still unused.

---

## 7. THE AUDIT — `tests/test_cross_system_consistency.py`

Every other suite checks ONE system: golden checks the PDF, `test_structural` the
engine, `test_frontend_parity` JS-vs-Python *of the same system*. Nothing checked
that two **different** systems, given the same deck, agree. Both of this
session's real bugs lived in that gap, which is how a fully green gate coexisted
with wrong output.

Root cause it is built around: **no single source of truth for deck geometry**.
Each system re-derives it. Measured — the freestanding joist-span rule was
restated in **5 places across 3 files**; `attachment == "ledger"` branches **27
times**.

Current state: **all seams consistent.** Invariant 1 (stair anchor vs framing),
1b (the **drag** path — the case the first version missed), 2 (freestanding beam
count), plus a control asserting a plain ledger deck is consistent today.

Mutation-tested both directions. Reverting the stair fix produces 10 hard
failures naming the exact post coordinate.

**Rules:** never relax an assertion to make it green — that re-opens the seam.
Any post-vs-stair assertion **must compare both axes**; the X-only comparison is
what produced a phantom top-priority bug that survived several sessions, and it
is what my own first draft of this audit did.

---

## 8. FOR BILLY

Withdrawn: S100's Q3 ("post inside a stairway — move the post or the stair?").
It described a collision that does not occur **for edge stairs**; for dragged-in
stairs it was real and is now fixed.

1. **Freestanding inset** — is `c = min(1.5, D/6)` right, or do you use a fixed
   number (2 ft?)? Symmetric, or biased toward one end?
2. **Freestanding at 20 ft deep** needs >2×12 — refuse those configs, or
   engineer them?
3. **Freestanding footings** — ours are designed for ~2× the actual load. Worth
   correcting, or is the conservatism fine?
4. **Obstruction framing** (Meadowview A-8) — which members are trimmers vs
   headers, and does the ledger close the house side?
5. Carried: straight stair to grade — pad and notched stringer only? Elevated
   landing on 4×4? Does an inspector ask about stair loading on the deck frame?

---

## 9. GATE (17 suites @ 9a1b5a3)

```bash
SBP_SHEET=arch_d python3 tests/pdf/golden_structural.py      # 28 fingerprints
SBP_SHEET=arch_d python3 tests/pdf/config_matrix.py
python3 tests/test_frontend_parity.py
python3 tests/test_cross_system_consistency.py
python3 tests/test_irc_table_drift.py
python3 tests/test_structural.py
python3 tests/test_post_grade.py
python3 tests/test_beam_layout.py
python3 tests/test_notch_posts.py
python3 tests/test_stair_support.py
python3 tests/test_frost_snow_normalize.py
python3 tests/test_future_products.py
python3 tests/test_jurisdiction_checklist.py
python3 tests/test_steel_labels.py
node  tests/test_beam_layout.js
node  tests/test_stair_footprint.js
node  tests/geometry/lotGeometry.test.js
```

- Golden **MUST** be `SBP_SHEET=arch_d`. Bare it fails with everything scaled by
  2.571 (36/14) — a sheet-size signature, not a regression.
- **Stale bytecode will lie to you.** If a test fails on a file `git diff` calls
  clean: `find . -name __pycache__ -type d -exec rm -rf {} + ; find . -name '*.pyc' -delete`
- **Re-derive this list from `ls tests/` rather than copying it forward.**
  `test_frost_snow_normalize` and `test_future_products` were missing from every
  prior handoff's gate because each one copied the last.

**Busters:** `engine.js` s102d, `zoneUtils.js` s102b. Ten locations cover fifteen
files; verify by grep, never from a table:
`grep -n "\.js?v=\|\.css?v=" backend/static/index.html`

---

## 10. LEARNINGS

1. **Test the interaction, not the form.** The sidebar and the canvas produce
   different configs. Every stair test used the sidebar; the bug lived in the
   drag. This is the single most expensive lesson of the session.
2. **Compare all axes.** A phantom top-priority bug survived sessions on an
   X-only comparison, and my audit repeated the exact error while trying to catch
   it.
3. **A fixture that hand-feeds internal state does not test the user's path.**
   Every notched golden config supplies `zones=[...]`. The wizard does not.
4. **Coverage gaps are invisible by construction.** Golden had zero freestanding
   configs, so the freestanding permit path could be wrong indefinitely with a
   green gate. Ask what is *not* covered, not whether tests pass.
5. **"No commit touched this file" ≠ "no regression."** The right question is
   whether current output matches what was established as correct.
6. **Verify before doubting, not just before asserting.** I told Will the S101
   railing note was probably wrong. It was right. Reflexive self-correction under
   pushback is the same failure as overconfidence — both substitute a posture for
   a measurement.
7. **Render and look before arguing.** Twice I reasoned from coordinates to a
   wrong conclusion and only got straight by generating the sheet.
8. **When the user keeps repeating a distinction, the distinction is the bug.**
   Will separated cutouts from notches at least four times while I insisted they
   were "the same code." They shared plumbing and differed in the only way that
   mattered.
9. **Build the instrument before the fix**, and mutation-test it. An alarm that
   has never fired is not an alarm.
10. **Don't invent structural details.** Where no reference exists (freestanding),
    say so and mark it for Billy rather than shipping inference as fact.

---

## 11. RECOMMENDED NEXT

1. **Billy on BLOCKER 1** (freestanding inset/footings). Everything in §4 rests
   on it.
2. **Visually verify Meadowview A-8**, then implement interior openings
   (BLOCKER 2). Unblocks obstruction support — chimneys, trees, hot tubs.
3. **Wire `stair_support.py`.** Still zero importers. Now has three independent
   reference confirmations (Ilaria, Loucks, Meadowview).
4. **JS railing perimeter** — Python recomputes from real exposed edges when a
   zone exists, JS uses `W + 2D`. Python is correct. Screen-catches-up-to-PDF, no
   golden movement. Last known screen/PDF divergence.
5. **Add LU228** to the hardware schedule for doubled members.
6. **Wizard UX question:** the sidebar cannot inset a stair; only the canvas drag
   can. If users expect the sidebar to do it, that is a UX gap, not a framing bug.
