# SimpleBlueprints, S108 Context & Handoff

Written at the end of S108. Repo state: `main @ a7d1e65` plus this file,
gate green (39 steps, golden at 45 fingerprints), production busters `s108b`
(app.js `s108a`). PUSHED to origin at session end after Will supplied a
token late in the session.

**Rebase note.** The container initially had no credentials, so S108 was
built as local commits. When the token arrived, origin/main had moved: the
parallel session had landed S107 pushes 10/10b (elevations draw the REAL
house on both surfaces, elevations joined the golden -> 45 fingerprints,
busters s107b) plus an amended S107 close. The six S108 commits were REBASED
onto that (hashes in the transcript differ from the final ones), the
predicted buster conflicts in index.html resolved by keeping the s108
bumps (strictly newer than s107b), and the FULL gate re-ran green on the
combined tree before the push. The `sbp_s108.bundle` file handed to Will
mid-session is SUPERSEDED -- do not pull it.

**How to use this.** §1 orientation, §2 what shipped, §3 the new subsystems,
§4 learnings (two cost real time and refined the mutation norm), §5 agenda,
§6 quick reference.

**Accuracy note.** Every number was measured this session with the probe
shown in the transcript or is re-derivable from the repo. Inference is
flagged as such.

---

## 1. NORTH STAR, unchanged

> **One generated package approved by a real building department.** Nothing
> else counts as validation.

Jurisdiction Colorado Springs / PPRBD. Contractors weighted over DIY.
Feature freeze (S84) in force. The 80% rule (S107) in force: build without
waiting for Billy, he reviews after the fact.

**The submission timeline was raised at the top of S108 per the S107 close
and did not get an answer** -- Will went straight to bugs (fair, three were
real). Raise it AGAIN at the top of S109. The recommendation stands: Will's
real B/C-section deck, generated package, Billy walks it in. Two more live
IRC-adjacent defects were found and fixed this session, which again
strengthens submittability.

---

## 2. WHAT S108 DID

Six commits (`493e060..b2535c2`), gate green before every one, ~14 mutation
runs, every survivor converted into a new pin.

**P1/P1b -- the "19/20" was a rounding asymmetry (`493e060`, `a0b12ce`).**
The permit checker read calc["beam_span"] -- the nominal width/(num_posts-1)
selection figure ROUNDED to one decimal -- and compared it against the
UNROUNDED IRC allowable. On Will's 21.5x8.5: nominal 10.75 -> stored 10.8 >
allowable 10.79 -> checker fail, while the engine (unrounded vs unrounded)
passed and the drawn spans were 8.75'. The deck was never out of spec.

The rule now: every R507.5 beam-span comparison uses the MEASURED max
post-to-post span from the computed layout (new `calc_engine.max_layout_span`),
compared unrounded; rounding is display-only. Applied in the Python engine
warning, `permit_checker.check_beam_span`, and the engine.js mirror. calc
dict gains `beam_span_actual`. New gate suite
`tests/test_permit_checker_beam.py` (B1-B6): the repro, the rounding trap
kept live (B3 guards the fixture against IRC table drift), a genuine
overspan failing in BOTH systems, an agreement sweep (engine warning
presence == checker verdict, per config), and B6 driving engine.js via node
to pin the JS verdict too. Two mutation survivors became pins: B5.7 (a
width-13 forced-2-post config where nominal overspans but the drawn 9' span
does not -- separates the two rules on the engine side) and B6.7 (JS
reverted to nominal).

**P2 -- stairs survive shape changes (`52ee4cf`, the S106 stale-stairs bug).**
Stairs persist edge-relative (location+offset) or absolute (anchorX/Y from a
manual drop). Neither was revalidated on resize: u()'s zone-routing branch
returned early past even the legacy flat offset clamp, and absolute anchors
were never touched anywhere. New `zoneUtils.revalidateStairs(nextP, prevP)`:
edge-pinned anchors FOLLOW their edge into the new frame (along-coordinate
clamped so the stair's width stays on the deck), interior drops clamp into
the new rect, offsets re-clamp with the drop snap's formula, anchors stay on
the drag's 0.5 ft grid, same-array return when nothing changed. Wired into
u() flat width/depth/stairWidth, u()'s zone-routing branch, updateZone w/d
(the AI helper path), and project load (prev=null sanitize -- old saved
projects get cleaned on open). New suite `tests/test_stair_revalidation.js`
(R1-R11) covers both axes, grow AND shrink, the side-section rect w/d swap,
mixed-list identity, and load sanitize. Four mutations, all killed.

**P3/P3b -- stairs cannot run through another section (`68da2c7`, `b2535c2`,
Will's 3rd bug).** A zone-0 stair dragged to Deck A's left edge ran its
descent over Deck B: the run footprint is a 7x4 box at x -7..0, 28 sq ft
inside Deck B. Opening synthesis clips to the stair's OWN zone frame
(0..W x 0..D), so the overlap was discarded -- 3D drew the run through Deck
B's slab, the plan overlapped silently, and A-2 would have shipped Deck B
with an intact joist field and no stairwell.

Sections have NO beam-layout/opening machinery (calcAllZones / zone_calcs is
the simple far-edge-beam model), so this config is UNFRAMEABLE today. Per
the interior-opening precedent it is now detected and refused with guidance,
never half-framed: lockstep detection (`zoneUtils.getStairZoneCollisions` /
`zone_utils.get_stair_zone_collisions`) intersecting run+landing part boxes
with every other additive zone rect, excluding the stair's own zone and its
`_landsOnZoneId` destination (connecting stairs sit over their landing zone
BY DESIGN); off-axis skipped like opening synthesis; seam grazes (<=0.05 ft
per axis or <=0.25 sq ft) ignored. Consumers: both calc engines warn (wood +
steel, identical text), permit checker `STAIR_SECTION_COLLISION` errors
(severity error, gates readiness, sheet A-2), steps.js shows a red step-4
advisory next to the S81e orphan advisory. New suite
`tests/test_stair_zone_collision.py` (Z1-Z5): detection, exclusions, JS==PY
collision lists, warning verdict parity, permit check. One mutation
survivor (landing exclusion dropped) exposed a vacuous fixture -- the
connecting stair had zero rise, so it had no footprint; P3b gave it real
rise (Deck B 3.5' lower) and Z2c pins the counterfactual.

**Found, NOT fixed -- a P6-class live IRC violation (top S109 candidate).**
The fixed 2 ft end-post inset means the beam overhangs 2 ft past the end
posts; IRC R507.5 caps beam cantilever at a quarter of the ACTUAL span.
Measured live: an 8 ft deck gets posts at 2/6 (span 4, allowed cant 1.0,
actual 2.0); a 12 ft deck gets posts at 2/6/10 (span 4, same violation);
any config whose spans land under 8 ft violates. Will's 21.5 (spans 8.75,
allowed 2.19) is fine. Fixing it moves post positions on many configs --
a large golden blast radius -- so it was deliberately deferred with Will's
knowledge. Also noteworthy: 12 ft getting THREE posts suggests the auto
post count is generous; the fix should look at inset formula and count
together.

---

## 3. NEW SUBSYSTEMS / RULES (S108 delta)

**3.1 The beam-span rule.** ONE quantity governs every R507.5 comparison:
`max_layout_span(beam_layout)` = largest post-to-post distance across
segments (what the sheet draws). Fallbacks: unrounded nominal
width/(num_posts-1), then the stored rounded value. Compare unrounded.
Sites: calc_engine wood warning (~1245), permit_checker.check_beam_span,
engine.js wood warning (bSpanActual, ~790). Steel keeps its CCRR path.

**3.2 Stair revalidation.** `revalidateStairs(nextP, prevP)` in zoneUtils.js
(window-exported, node-testable). The zone-local frame is the zone's WORLD
rect extents (side sections swap w/d -- rect from getZoneRect). Call sites
in app.js: u() flat path (k in width/depth/stairWidth, after the legacy flat
clamp), u() zone-routing branch (before its early return), updateZone
('w'/'d'), project load. Every call follows the pattern: result !== old
array -> assign + `_syncFlatStairParams(next)`. The call sites themselves
have NO headless coverage (app.js is JSX with hooks); keep them thin,
Will's live check is the end-to-end verification.

**3.3 Stair-section collision.** Detection in both engines, kept in
lockstep (Z3 pins list equality). The JS side shims deckWidth/deckDepth
when absent (app state uses width/depth; getZoneRect falls back to a
hardcoded 16x12 otherwise -- this bit during development). Consumers listed
in §2 P3. Framing an ACTUAL stairwell through a section is an S109+ feature:
needs section beam layout (full Case A/B for sections) and Billy.

---

## 4. LEARNINGS FROM S108

**4.1 Rounding asymmetry across systems is a bug class of its own.** Two
systems can each be internally sensible (engine: unrounded vs unrounded;
checker: stored-rounded vs recomputed-unrounded) and still disagree at a
table boundary. The rule: compare unrounded, round only for display, and
when two systems judge the same quantity, pin their AGREEMENT per config
(the B5/Z4 sweep pattern), not just each side's correctness.

**4.2 A mutation kill must fail the pin, not incidental text.** Push 1's
first mutation was "killed" only by a detail-string check -- a weak kill
that says nothing about the behavior. And push 3's landing-exclusion
mutation survived outright because the fixture was vacuous (zero-rise
connecting stair = no footprint = exclusion never fired). Refinement to the
S107 norm: verify the fixture is LIVE by pinning the counterfactual in the
suite itself (Z2c: the same stair WITHOUT the destination must flag).
A fixture that cannot fail both ways proves nothing.

**4.3 babel-standalone is stricter than the runtime loader.** steps.js has
a pre-existing `(>25%)` in JSX text that @babel/standalone rejects but the
live loader tolerates. JSX edits can still be verified headlessly: babel
stops at the FIRST error, so if the first error is the same pre-existing
one shifted by EXACTLY the number of lines added, everything before it
(including the edit) parses. Count the lines; the offset matched (+16).

**4.4 This container had no GitHub credentials and no surviving background
processes.** Pushes fail with "could not read Username"; nohup'd processes
die between tool calls. Workarounds that worked: commit locally + hand Will
a git bundle; run the gate in foreground chunks (Python suites in one call,
node in another, each PDF suite separately -- config_matrix and golden are
the long poles). Check both capabilities at S109 open before planning.

**4.5 Will's screenshots remain the bug reports that matter.** The 3rd bug
arrived as two screenshots; the headless repro reproduced the exact 28 sq ft
overlap in one probe. Reproduce numerically FIRST, then scope: the repro is
what revealed that sections have no opening machinery at all, which turned
"apply the crossing rules" into "detect and refuse now, frame later" --
the right scope under freeze.

---

## 5. THE AGENDA

**5.1 S109 top of session**
1. Verify Railway deployed the S108 push, then Will's live checks (§5.2).
2. The PPRBD submission timeline. Third session running it goes unanswered.
3. Beam end-overhang R507.5 violation (§2, found-not-fixed): own the golden
   blast radius deliberately -- inventory affected configs first, decide
   inset formula (min(2, span/4)?) WITH the auto post count question, Billy
   input on his end-overhang practice.

**5.2 Pending Will (live checks after deploy, all S108)**
- Stair advisory on his real B/C deck: recreate the screenshot config, the
  step-4 red advisory + app warning should appear, permit pre-check should
  show STAIR_SECTION_COLLISION as the failure.
- Resize behavior: drag a stair to an edge, resize deck/section by slider
  AND drag handles -- stair stays glued to its edge.
- Permit report on the 21.5x8.5: IRC_BEAM_SPAN now passes (the 19/20 is
  gone).
- Carried from S107: Case B framing PNG sign-off, live Elevation tab (38 ft
  deck inside the 45'-6" house), slope/grade UI screenshot, under-deck field
  photo if available.

**5.3 Billy review list (additions; S107 items 1-6 carry)**
7. Beam end overhang: how far past the end posts does he run a dropped
   beam in practice? (R507.5 says <= span/4; our fixed 2 ft violates on
   short spans.)
8. Stair through an adjacent section: real request, or do builders always
   relocate the stair / connect the decks? (Decides whether
   stairwell-through-section framing is ever worth building.)

**5.4 Carried S108+ candidates (from S107 §9.1, still open)**
- 3D cosmetics: duplicate corner balusters, sunken rail infill, embedded
  post caps.
- Materials golden (agenda debt).
- main.py wing-translation layer (~3283) test coverage.
- A-3 freestanding gap note wording (needs freestanding reference or Billy).
- arch_d sheet support dormant behind SBP_SHEET (unchanged assessment).
- Possibly-misplaced rail gap -- awaiting Will's re-check.

---

## 6. QUICK REFERENCE

**Session loop:** unchanged (this file + MASTER_CONTEXT.txt + STATUS.txt ->
pushes -> gate green -> commit BEFORE mutating -> renders to Will -> close
with context file). Commit convention `S{n} push {m}: description`.

**Gate: 39 steps.** Rebuild /tmp/rungate.sh from .github/workflows/tests.yml.
New suites: test_permit_checker_beam.py (after invariants),
test_stair_revalidation.js (after section resize),
test_stair_zone_collision.py (after permit_checker_beam).

**Busters:** engine.js, zoneUtils.js, and the lazy-loader var (steps,
planView, elevationView, deck3d, sitePlanView, traceView) all `s108b`;
app.js `s108a`. Bump in the same push as any JS change.

**Key locations (measured this session, drift expected):**
- `max_layout_span` calc_engine.py ~470 (after auto_select_beam); wood
  warning ~1245; `_stair_collision_warnings` just above calculate_structure.
- `check_beam_span` + `STAIR_SECTION_COLLISION` in permit_checker.py
  (collision check sits just above CAP_ZONE_CALCS).
- `revalidateStairs` zoneUtils.js ~1385 (after resizeSection);
  `getStairZoneCollisions` ~1300 (after getOpeningRects).
- engine.js: bSpanActual block ~775; collision warnings after BOTH
  "Area >500 SF" pushes (steel ~400, wood ~800).
- steps.js: collision advisory next to the S81e orphan advisory (~3010);
  panel gate now includes `_collisions.length`.
- app.js: revalidation calls at u() zone-routing branch (~605), flat clamp
  block (~660), updateZone (~715), load path (~1120).

**Repro probes (rerunnable):**
- 19/20: 21.5x8.5 ledger deck -> nominal 10.75, allowable 10.79, layout
  posts [2, 10.75, 19.5].
- Crossing stair: 22x12 + left/right sections 12 along x 8 out, zone-0
  stair anchorX 0 anchorY 6 angle 270 -> 28 sq ft over Deck B.

**Reference material:** docs/reference_sets/ unchanged (four PPRBD sets +
field photos). Parallel S88.5 UX-mock session still pushes to main and
conflicts on buster lines -- rebase, keep both bumps, re-gate.
