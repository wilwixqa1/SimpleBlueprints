# SimpleBlueprints, S107 Context & Handoff

Written at the end of S107. Repo state: `main @ 175b63c` plus this file, gate
green (36 steps), production busters `s107a`. This file replaces the thin
`S107_CONTEXT.txt` committed mid-close.

**How to use this.** §1-§2 are orientation. §3-§6 are reference for the
subsystems S107 touched; read the part you are touching. §7 is tooling and
workflow, §8 the learnings (two of them cost real time this session and will
cost it again if unread), §9 the agenda, §10 quick reference.

**Accuracy note.** Every number here was measured this session with the probe
shown in the transcript or is re-derivable from the repo. Where something is
inference rather than measurement, it says so.

---

## 1. NORTH STAR, unchanged

From `MASTER_CONTEXT.txt`, still governing:

> **The business milestone that matters: one generated package approved by a
> real building department.** Nothing else counts as validation.

Jurisdiction Colorado Springs / PPRBD. Target customer (S84): contractors over
DIY, weighted for repeat business. Will's two-part restatement: (a) pass the
permit, (b) look professional enough that a contractor feels safe submitting it.

S107 moved (a) directly for the first time in several sessions: two of the
fixes were live IRC violations on generatable configs (§2, P2 and P6). The
S105 flag stands: the thing that ends this phase is one contractor putting one
set in front of PPRBD, and nobody has a timeline for that yet.

**Feature freeze (S84) still in force.** No sheds, no pergolas, no new zone
types, no new stair templates.

**New standing rule from Will this session:** build at >=80% confidence
WITHOUT waiting for Billy. He reviews after the fact. The Billy list (§9.3) is
now a review queue, not a blocking queue.

---

## 2. WHAT S107 DID

14 pushes (`90969ef..175b63c`), gate green after every one, ~20 mutations
killed. Charter items 1 (level-section structure), 2 (golden expansion), and
3 (Case B) complete. Item 4's smaller items carry (§9.1).

**P1/P1b — flush sections are shared-edge only.** The old model read "flush"
as "no structure": a section at deck height got a rim board, 0 posts, 0
footings. Now flush means only that the shared edge hangs on Deck A's rim
(LUS26/LUS210 hangers, callout drawn on A-2); the FAR edge always gets a sized
dropped beam on posts + footings directly under the outer rim (setback 0).
Fixed in engine.js `calcAllZones`, permit_spec.py `zone_calcs` (which also
gained the S81 effective-beam-type rule the backend never had), draw_plan.py,
and the post-count sites. Bonus fix: `getEffectiveBeamType` read only
`p.deckHeight` and silently defaulted on raw params — `mainDeckHeight(p)`
helper now used at 5 sites. New gate suite `tests/test_flush_sections.py`
(R1-R10); the `EXPECTED_FAILURES` register in the invariants suite emptied.

**P2 — one w/d rule.** `w` runs ALONG the attached edge, `d` runs OUT, every
edge; the definitive source is `addZoneDefaults`. Three violations fixed:
engine.js sized side sections transposed (joists were sized from `w` — Will's
B/C sections had joists two lumber classes undersized, 2x6 where 2x10 is
required); permit_spec.py mirrored the same transposition (parity stayed green
= consistent wrongness, see §8); Python `get_zone_rect` never swapped side-zone
extents the way JS `getZoneRect` does, so the PDF drew non-square side wings
transposed vs the app (8x8 defaults hid it; the S106 resize handles exposed
it). Also fixed: rail length (w + 2d on all edges), footing trib (d on all
edges), and the 3D zone block rewritten (deck3d.js ~717): engine-counted
posts, beam on the correct FAR edge per attachEdge, flush included — the old
code skipped flush structure entirely and put every zone beam on the front
edge. New gate suite `tests/test_3d_zone_structure.js` audits a real three.js
scene. Linework: white-out bboxes on wing tags / member specs / hanger
callouts / `_margin_callout` (E1 exemption; net WIN: zones_stairs_lcr 44→34
against a 41 baseline), loads-table leading 0.52→0.62, duplicate zone-label
`ax.text` removed. New linework fixture `sections_flush_lr` (baseline 27).

**P3** — elevation wings always draw the dropped far-edge beam (they had
inherited the MAIN deck's flush style).

**P4** — goldens 28→36 fingerprints (`sections_flush_lr`,
`sections_raised_chamfer`).

**P5/P5b — the app elevation bug Will screenshotted.** `elevationView.js
_getZoneSNContext` used `z.w` (along) instead of `z.d` (out) for wing visible
width, so a 38 ft deck drew house-wide at 45.5. Fixed, per-section heights
(`z.h`) folded in, function exported to window, R9 pins app==PDF elevation
parity. Cache busters bumped to `s107a` — P1/P2 had shipped JS without
bumping, which is exactly how S106's stale-engine incident happened. Owned.

**P6 — a real IRC violation found from Will's question.** IRC R507.6 caps a
joist cantilever at a quarter of the back-span. Our fixed 1.5 ft section beam
setback gave a 4 ft dropped section a 60% cantilever. Setback is now
`min(1.5, d/5)` in all three sites (engine.js, permit_spec, draw_plan), pinned
by R10 and new oracle invariant I6 with a `shallow_dropped_section` config.
This also settles "where does the beam go": under-rim (0 cantilever) is always
compliant; fixed setbacks are not.

**P7 — the Case B model.** Vocabulary: a stair opening whose back edge sits AT
or in front of the beam line is Case A (touching) — S106 established the beam
is not interrupted, posts at the opening edges. An opening that CROSSES the
beam line is Case B, and until this session it fell into the cutout/notch
treatment: the beam STEPPED behind the stairwell with crowded posts. Now the
beam stays ON its line, segments split at the opening, a post lands AT each
opening edge (the header bearing points; deck ends keep the 2 ft inset), and
the header run is recorded (`stair_headers` / `stairHeaders`:
`{x0,x1,y,width_ft}`). Test deck: 4 posts vs the old 6. Same push: the wood
call site now passes the real IRC R507.5 allowable
(`get_beam_max_span(beam_size, joist_span, LL, species)`) instead of a
hardcoded 8.0 (steel always did). The cross-system oracle's dragged-stair
block was REWRITTEN to assert geometry, not the old `stepped` flag: no segment
through the stairwell, beam_y unchanged, exactly one header, no interior
posts, a bearing post at each edge. Parity block 5b (segments, posts, headers
JS==PY).

**P8/P8b/P8c — Case B on the sheets.** draw_plan's beam drawing branched on
`stepped`; an interrupted layout fell into the flat branch and would have
drawn the beam straight through the stairwell — caught before it ever
rendered. `_multi_seg` = stepped OR interrupted ONLY (freestanding two-line
layouts must stay in the flat branch for byte-identical goldens; their second
line has a dedicated block). Same-y segment gaps get NO connector. The doubled
header + doubled trimmers are drawn boxing the stairwell with the callout
`(2) 2x8 HEADER W/ 'LU228' EA. END / (2) 2x8 TRIMMER EA. SIDE` on a white-out.
The OPENING dimension now states the ACTUAL cut width (matched to the stair's
opening rect by `stair_id`) instead of always printing the first run's width.
Hardware naming: 2x8 → LU228 (Meadowview verbatim), otherwise HUS2{depth}-2;
steel decks bill the member verbatim plus generic "Steel Double Hangers" (no
reference set covers a steel stairwell header, so no part number is invented).
Materials: header stock (2-ply), trimmer joists, double hangers billed in
draw_materials.py `estimate_materials` AND engine.js `estMaterials`, placed
AFTER the stair items because parity compares positionally. P8b deleted the
containment rule as dead code after a mutation survived; P8c corrected the
mechanism comments (see §8.3 — this sequence is the session's best worked
example of the mutation norm).

**P9** — Will's real-build field photo committed to
`docs/reference_sets/field_photos/2026-07_edge_stair_posts_underrim_beam.png`
with a README entry. Corroborates: stair-to-grade on a pad with NO posts under
the run (fourth independent confirmation), stair verticals are rail posts not
structure, deck bearing posts FLANK the stair, and a beam apparently directly
under the outer rim on piers (caveat in the README: could be a doubled rim
with a set-back beam out of view — an under-deck photo would settle it).

---

## 3. ARCHITECTURE NOTES (what S107 touched)

The overall architecture (FastAPI backend on Railway, matplotlib sheet
pipeline, vanilla-JS frontend served from `backend/static`, JS engine mirrored
by Python calc) is unchanged from S105 §5. What follows is the S107 delta.

**3.1 The beam pipeline, end to end.** `get_opening_rects` (zone_utils) emits
user cutouts + stair openings, each `{id, source, stair_id, zone, rect}`.
`_beam_relevant_openings` (calc_engine ~462) splits three ways: `kept`
(cutouts and anything not a stair — these segment/step the beam via
`front_edge_profile`), `touching` (Case A — beam continuous, posts moved to
opening edges by `_posts_clear_of_touching_openings`), `crossing` (Case B —
handled after layout by `_beam_interrupted_at_crossing_openings` +
`_posts_edge_aware`). `compute_beam_layout` (beam_layout.py) is unchanged in
shape: `{segments:[{x0,x1,beam_y,max_cant,posts}], post_xy, stepped,
over_limit}` plus now `stair_headers` and `interrupted`. engine.js mirrors
this inline at ~lines 540-640; the JS layout core lives in stairGeometry.js.
Consumers: draw_plan (sheet), deck3d (3D posts via postXY — updates free),
materials (both engines read the header record).

**3.2 Zone w/d semantics.** One rule: `w` ALONG the attached edge, `d` OUT,
every edge. JS `getZoneRect` swaps for side zones when building world rects;
Python `get_zone_rect` now does the same. The main.py wing-translation layer
(~3283) swaps side-wing w/d on the way in and has NO test coverage — flagged
in §9.1. Will's real B/C sections are 8 ft OUT and 11.5/12 ALONG (the reverse
of most session fixtures); R9 uses the real shape.

**3.3 Flush vs dropped sections.** `effective_beam_type` (both engines) can
RAISE flush→dropped per the S81 rule; permit_spec now applies it too. Flush:
shared edge on hangers, far edge dropped beam at setback 0. Dropped: far-edge
beam at `min(1.5, d/5)`. Elevations draw the far-edge beam for both.

**3.4 App elevation wings.** `elevationView.js _getZoneSNContext` (exported on
window for the R9 test) supplies per-wing visible width (`z.d` for side
wings), and per-section heights.

**3.5 Cache busters.** `backend/static/index.html` pins `engine.js`,
`zoneUtils.js` and the lazy loader versions for planView / elevationView /
deck3d / sitePlanView / traceView / steps. All at `s107a`. ANY JS change ships
with a bump in the same push — see §8.4.

---

## 4. THE STAIR / OPENING MODEL (complete as of S107)

- **Edge stair** (exits at the rim, like Will's field photo): no opening rect
  at all; beam continuous; stringers to a grade pad, no posts under the run.
- **Case A, touching** (opening back edge at/in front of the beam line): beam
  continuous; interior posts removed; posts at the opening edges (S106).
- **Case B, crossing** (opening back edge behind the beam line): beam
  interrupted on its line; post AT each opening edge; doubled header at the
  opening's deep edge on double-member hangers; doubled trimmers each side;
  billed and drawn (S107).
- **Stair filling a notch:** never reaches the classifier — the notch-aware
  anchor resolves it to the notch edge, so no opening is synthesized. The
  stepped-notch treatment + `notch_headers` own the geometry.
- **Stair partially overlapping a notch:** step (notch) AND interruption
  (stairwell) combine; the layout is coherent and pinned (5d).
- **Interior opening (reaches no edge):** still refused with the
  `interior_opening` warning. Meadowview A-8's fireplace detail is the
  implementation reference when this is built (S102 README section).

Pins live in `tests/test_stair_beam_interaction.py` (blocks 1-6, 5b parity,
5c materials parity, 5d notch interactions), the cross-system dragged-stair
block, and invariants I4/I5.

---

## 5. STRUCTURAL INVARIANT ORACLE (S106 + S107)

`tests/test_structural_invariants.py`: I1 every section supported, I2
posts==footings, I3 freestanding rows mirrored, I4 no post in a stair opening,
I5 no unsupported beam segment, **I6 (new)** section cantilever within IRC
R507.6 quarter-span. Configs include `shallow_dropped_section`. The oracle
fired for real twice this session (JS clamp mutation; steel materials crash
via cross-system). When adding structural behavior, add the invariant, not
just the example test.

---

## 6. THE SHEET SET (S107 delta only)

A-2 framing: interrupted beam branch, header/trimmer drawing + callout,
actual-width OPENING dimension, section hanger callouts, white-out patches on
wing tags/member specs/hanger callouts/margin callouts. A-1: unchanged except
white-out + dedup. Elevations: far-edge beams on wings. Goldens: 36
fingerprints across `tests/pdf/golden_structural.py` CONFIGS; linework
fixtures include `sections_flush_lr`. The materials sheet gained the stairwell
header package (wood + steel variants).

---

## 7. TOOLING & WORKFLOW

**7.1 The gate.** `/tmp/rungate.sh` (rebuild from `.github/workflows/tests.yml`
if lost) runs all 36 steps; required green before ANY push. Suites added this
session: test_flush_sections.py, test_3d_zone_structure.js, plus extensions
to invariants, cross-system, stair_beam_interaction.

**7.2 Mutation protocol, now with a hard rule: COMMIT BEFORE MUTATION-TESTING.**
Mutations are applied with sed/python-replace and reverted with
`git checkout` — which wipes uncommitted work. It wiped the P1 fixes (five
files, reapplied from the transcript) and the P3 elevation fix. Sequence:
gate green → commit → push → mutate → verify kill → checkout → verify clean
tree.

**7.3 Verification rule (Will's, permanent).** Never claim checked/verified
without printing the side-by-side in the same message; spot checks labeled
with exact coverage; every deliverable declares its source; inference flagged
in the first line. Applied this session to every layout claim (numeric dumps),
regression claim (suite output printed), and the field-photo README (caveats
inline).

**7.4 Renders to Will.** Numeric/byte verification is Claude's; renders are
Will's ground truth. The view tool worked for A-2 inspection this session
(several successful reads, one unusable crop) but the standing rule stays:
assume it can be down, hand PNGs to Will. Render recipe in §10.

**7.5 The 80% rule.** Don't block on Billy. Record the question in the Billy
list, build the best-referenced answer, flag it for after-the-fact review.

**7.6 Evidence order for framing decisions:** repo reference sets (four
approved PPRBD sets + field photos) → IRC arithmetic → web. Rick's vocabulary
is copied verbatim where it exists (LU228, header/trimmer callouts).

---

## 8. LEARNINGS FROM S107 (the expensive ones)

**8.1 Consistent wrongness passes parity.** Twice: the w/d transposition
existed identically in engine.js and permit_spec.py, so the JS==PY parity gate
stayed green while joists were undersized two lumber classes; and both engines
generated the same wrong hanger name (HUS10-2 for HUS210-2). Parity proves
agreement, not correctness. The antidotes used: check against the definitive
in-repo source (`addZoneDefaults`), against the reference sets, and READ the
parity diff content, not just its pass/fail.

**8.2 Anchored inserts land in the wrong twin.** draw_materials.py has
steel/wood function pairs sharing near-identical anchors. Two inserts in a row
landed in `estimate_steel_materials` instead of `estimate_materials` (first on
the stairs anchor, then on the first Joist-Tape anchor). Verify placement with
`inspect.getsource(fn)` after every anchored edit in that file — it costs one
line.

**8.3 A surviving mutation means delete the code or add the pin — literally.**
The P8 containment rule survived mutation. Chasing it produced the real
finding: notch-filling stairs never emit opening rects because the notch-aware
anchor resolves them upstream, so the rule was dead code. It was deleted, the
BEHAVIOR was pinned instead (5d: output-level assertions, mechanism-agnostic),
and a decisive mutation (disabling `_already_cut` upstream, observing no
change) proved which mechanism actually owns the invariant — which corrected a
wrong comment before it could mislead a future session. Also: an initial
mutation "kill" can be a no-op mutation; verify the mutation applied (print
the mutated lines) before crediting the suite.

**8.4 Cache busters ship WITH the JS, not at session end.** P1/P2 shipped
engine.js changes without bumping; the live site would have served stale
engine against new backend until P5b. This is the second session running this
class of miss appeared. Bump in the same push, always.

**8.5 Positional parity constrains insertion order.** The materials parity
compares line-by-line, so the PY billing block had to sit AFTER the stair
items to match JS. When mirroring a block across engines, mirror its position.

**8.6 The steel path is not the wood path with different numbers.** Steel
joist names carry gauge suffixes ("2x6-16ga") that crash naive parsing, and
steel hardware has no Simpson wood equivalents. Any member-name parsing needs
a steel case, and the cross-system oracle is what catches it.

**8.7 Will's questions find bugs.** "Does IRC tell us where the beam goes?"
→ the R507.6 clamp (a live violation). "Did we regress the S106 fix?" → the
printed-proof workflow that later caught the flat-branch bug. Treat product
questions as audit prompts.

---

## 9. THE AGENDA

**9.1 S108 candidates (charter item 4 carry-over + debts)**
- Stale stairs surviving shape changes in the UI (drag a stair, resize the
  deck, the stair stays anchored to nothing).
- Possibly-misplaced rail gap — awaiting Will's re-check.
- 3D cosmetics: duplicate corner balusters, sunken rail infill, embedded post
  caps.
- The 19/20 "beam exceeds IRC capacity" checker disagreement on the 21.5x8.5
  test deck (one engine warns, one doesn't — undiagnosed).
- Materials golden (agenda debt since the materials engine rework).
- main.py wing-translation layer (~3283) has no test coverage.
- A-3 freestanding gap note wording — needs a freestanding reference example
  (none of the four sets is one) or Billy's wording.
- arch_d sheet support stays dormant behind SBP_SHEET (S106 assessment
  unchanged: fix only if a jurisdiction requires 24x36; own session, inventory
  first).

**9.2 Pending Will (no urgency)**
- Visual sign-off on `s107_caseB_after_framing_A2.png` (header/trimmer
  drawing).
- Live app Elevation tab after Railway deploy: the 38 ft deck should sit
  inside the 45'-6" house (busters `s107a`).
- Slope/grade UI: code says Step 0 manual mode below the orientation dial
  renders it — unverified live; screenshot if missing.
- More field photos from the July build if available, especially under-deck
  (settles the under-rim-beam vs doubled-rim caveat).

**9.3 Billy review list (after the fact, per the 80% rule)**
1. Under-rim flush beam for narrow sections (field photo + IRC R507.6 now
   support it).
2. w-along / d-out reading of wing callouts.
3. Freestanding house-side inset: 18" kept; is 12" (or anything else) his
   practice?
4. Case B: posts at the opening edges + LU228/HUS2xx-2 headers.
5. Far-edge dropped beam under narrow flush sections.
6. (Carried from S102) freestanding inset formula min(1.5, D/6): symmetric?
   >2x12 at 20 ft — refuse or engineer?

**9.4 North-star check.** Nothing in S107 or the S108 list schedules the PPRBD
submission itself. Two live code violations were fixed this session, which
strengthens the case that the sets are submittable. Raise the timeline with
Will/Billy at the top of S108.

---

## 10. QUICK REFERENCE

**Session loop:** read this file + MASTER_CONTEXT.txt + STATUS.txt → work in
pushes → gate green before every push → commit BEFORE mutating → renders to
Will → close with the next context file. Direct push to main, no PRs. Commit
convention `S{n} push {m}: description`.

**Gate:** `bash /tmp/rungate.sh` (rebuild from .github/workflows/tests.yml).

**Render a sheet PNG for Will:**
```
SBP_SHEET=arch_d; generate_blueprint_pdf(params)  # via backend/app/main.py
# pick the multi-page PDF (>=3 pages, PdfReader) from PDF_DIR, then
pdftoppm -png -r 110 -f 3 -l 3 <pdf> /tmp/out   # page 3 = A-2 framing
```
(The generator also writes single-page artifacts; ALWAYS filter by page count
— grabbing newest-by-mtime alone picked the wrong file this session.)

**JS engine smoke-test without a browser:**
```
node -e 'global.window=global; eval(fs...zoneUtils.js); eval(fs...stairGeometry.js);
eval(fs...engine.js); window.calcStructure(params)'
```
(zoneUtils and stairGeometry must load before engine.js. Preview-style params
need deckWidth/deckDepth supplied alongside width/depth for getAdditiveRects.)

**Key locations (measured this session, drift expected):**
- `_beam_relevant_openings` calc_engine.py ~462; interruption pass +
  `_posts_edge_aware` directly above `_posts_clear_of_touching_openings`.
- engine.js beam block ~514-650; `getBeamMaxSpan` ~102; wood materials
  `estMaterials` ~984 (steel `estSteelMaterials` ~809 — the twin trap, §8.2).
- draw_plan.py: beam drawing ~688+ (`_multi_seg`), header/trimmer block just
  before the S86 beam margin callout, OPENING label ~1155.
- deck3d.js zone structure block ~717.
- elevationView.js `_getZoneSNContext` (on window).
- Busters: backend/static/index.html, all at `s107a`.

**Reference material:** docs/reference_sets/ — four approved PPRBD sets
(Ilaria, Loucks, Welborn=steel, Meadowview=headers/obstruction) + README with
all extracted conventions + field_photos/. Meadowview A-8 is the framing
vocabulary source.

**Parallel work:** the S88.5 UX-mock session pushes to the same main and
routinely conflicts on cache-buster lines — rebase, keep both bumps, re-gate.
