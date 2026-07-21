# SimpleBlueprints — MASTER CONTEXT & TODO (start-here; written at S97 close)

Single "hit the ground running" doc. Read the **S97 RETROSPECTIVE (just below)**
and §0/§1 first. Supersedes docs/S96_CONTEXT.md. The S96 doc's §0–§8 working
rules remain accurate EXCEPT where this retrospective / the updated §2/§4/§6
below change them; the durable operational content (gate, push recipe, traps)
is reproduced here so this doc stands alone.

Repo: `https://github.com/wilwixqa1/SimpleBlueprints` (public clone).
As of S97 close: `main` @ `5868cc2` (S97 push 3). **CI GREEN on 5868cc2**
(run `completed/success`, confirmed via the authenticated Actions API).
**`main` moves under you** — TWO parallel sessions were active during/around
S97 and push to `main`: the S88.5 "UX mock" session (mock + it touches
production `deck3d.js`/textures/index.html — see §8) and an "S96.5" session
(sign-in no longer wipes the design; address re-lookup — touches app.js/steps.js
/index.html). Expect to fetch/rebase; expect a cache-buster conflict in
`backend/static/index.html` (everyone bumps the shared `var v = "v=sXX"` loader
line and/or per-file `?v=` tags; resolution = keep a value that busts, i.e. any
change from the deployed value). All 14 gate checks green at S97 close.

---

## S97 RETROSPECTIVE & HANDOFF (READ FIRST)

**Shipped in S97 (all 14-check gate green locally; rebased onto latest `main`;
pushed; CI confirmed success on `5868cc2`):**

1. **STAIR "shifts when you switch template" FIX (push 1, `7292791`).** Will's
   report: placing a stair at, say, front-center and then switching its TEMPLATE
   moved where the stair *attaches to the deck*. Verified numerically: for a
   front stair (offset 0) on a 20-wide deck (center x=10), the CONNECTING run
   attached at x=10 for straight/lLeft/lRight/wideLanding but at **x=12.25** for
   switchback (U-Turn) and wrapAround (Wrap) — the U-turn/wrap runs are laid out
   offset by `gap/2` from the anchor. Fix: after the template if/elif builds
   `runs`/`landings`, recenter so `runs[0]` (the run meeting the deck at y=0) is
   centered on the anchor for EVERY template — a **no-op** for the already-
   centered templates (byte-identical → golden unchanged) and a translate for
   switchback/wrap so they attach centered and fold to the side. Because plan,
   3D, and site plan all read the same geometry, this is a fix-once. Mirrored in
   BOTH `compute_stair_geometry` (backend/drawing/stair_utils.py) and
   `computeStairGeometry` (backend/static/js/stairGeometry.js); FRONTEND PARITY
   passed (JS==Python); GOLDEN unchanged (20 fingerprints; no U-Turn/Wrap in
   golden CONFIGS, others no-op); config_matrix + post-in-landing still pass.
   NOTE (design, not bug): L/U-Turn/Wrap still EXTEND to their side — an L has to
   turn. Only the *attachment point* is now stable across templates. Cache
   buster: stairGeometry.js `?v=s92a → s97a`.
   The wizard TEMPLATE label→key map (from steps.js ~L2717) is:
   Straight=`straight`, L-Left=`lLeft`, L-Right=`lRight`, **U-Turn=`switchback`**,
   **Wrap=`wrapAround`**, **Platform=`wideLanding`**.

2. **REMOVED the production feedback GATE on the Generate/Download button
   (push 2, `a197286`).** Will reported "the download button doesn't work — I
   press it, nothing happens" on simpleblueprints.xyz. FORENSICS (important, and
   it corrected a hasty first guess of mine): the button was `disabled` whenever
   `isProduction && !feedbackDone`, where `isProduction =
   hostname.includes("simpleblueprints.xyz")`. So the button is inert on the
   production DOMAIN until the "Quick Feedback" form (role + price) is submitted;
   a disabled button gives no click reaction → reads as "broken." This gate has
   existed since ~S19 (unchanged; steps.js last edited S87 — NOT a recent
   regression). It does NOT apply on the Railway `*.railway.app` URL (hostname
   doesn't match → gate off), which is why Will could generate there. Will's
   call: **take the gate off.** Now `disabled={genStatus==="generating"}` only;
   the feedback box still shows but is labeled optional. Frontend-only; cannot
   touch the permit PDF. Cache buster: wizard lazy-loader `var v = s95d → s97a`.

3. **Busters (push 3, `5868cc2`).** stairGeometry tag s97a + loader var v s97a.
   Rebased over S96.5's `s965a` loader value → resolved to `s97a` (busts).

**Decisions captured this session (see §6):**
- **CUT LIST / LABELED FRAMING (old §4 P0): RESEARCHED and deliberately
  SHELVED.** See §4/PARKED. Will saw the competitor screenshots concretely
  (a labeled framing DRAWING keyed to a cut-list table + an interactive 3D
  member-tagged view). Key findings: (a) NOT permit-required — I read PPRBD's
  own deck plan-review handout; it requires "joist sizes and spacing of all
  REPETITIVE framing materials" = the GROUP-callout style we ALREADY produce;
  DCA-6's typical framing plan and BOTH approved reference sets (Ilaria/Loucks)
  are group-callout, no per-member tags, no cut list; no jurisdiction found
  requires a cut list. (b) The real cost isn't the table — it's OWNING exact
  per-member CUT LENGTHS across zones/cutouts/chamfers/cantilevers/steel/stair
  templates (our buggiest geometry), where a WRONG length hurts the
  "contractor-trusts-the-set" north star MORE than a missing feature, and DIY
  builders are the highest-risk consumer of a wrong length. (c) A bare table
  (built + reverted this session) is useless without the labeled drawing the
  labels key to. Net: not necessary, asymmetric downside, not confidently doable
  across configs, not expected/required by users or permit offices → shelved.
- **North-star "restyle the permit framing sheet?" question: RESOLVED** — keep
  the permit framing page CLEAN; any build detail goes on a SEPARATE sheet
  (Will, S97). (Moot for now since the separate sheet is shelved, but this
  retires the S96 parked question.)

**TOP OF NEXT SESSION: the 3D "stairs clip through the deck / no hole" bug.**
Full diagnosis below in §4/P0-3D.

**PAT:** Will provided a GitHub PAT in the S97 chat to push. **ROTATE IT** (told
in-session, twice). Used only via a transient env-var credential helper; never
written to a file or `.git/config`; swept after each use (grep for the actual
token value, not the `ghp_` substring — older docs contain example `ghp_` text).

---

## 0. HOW TO WORK (anti-spiral rules + recipes) — carried forward from S96, still binding

- **Identify a sheet by DRAWING CONTENT, never page index.** Complex deck
  (zones>0) = 8 pages (site p7, details p6, deck plan p2, "A-2 DECK FRAMING"
  p3); simple = 7 pages with combined "A-1 DECK PLAN & FRAMING" (no standalone
  framing page — this is why a plain rectangle looks like it "has no framing").
- **The `view` tool is INTERMITTENT for self-generated renders and can even fail
  on Will's uploads (S96).** Never let a claim rest on a render you could not
  see. Verify NUMERICALLY (coords, pixel diffs, primitive/zorder extraction,
  text-bbox overlap), reason from CODE + the exact config, present to Will, and
  WAIT for his confirm on visuals. **3D (deck3d.js) CANNOT be rendered headless
  at all (WebGL) — 3D claims MUST be verified by Will's screenshots.** (S97)
- **Every doc/claim has ≥1 wrong claim — verify by grep/run before building on
  it.** S97 example: I first said the download gate was "since S15–19" from a
  quick `git log -S`; blame/history confirmed the exact button-disable dates to
  S19 and was NOT touched recently — verify precisely, don't repeat guesses.
  Another: a bare-`>` "syntax error" I "found" in steps.js was a FALSE POSITIVE
  from a newer babel; the PRODUCTION babel (7.23.9) accepts it. When checking JS
  syntax, use `@babel/standalone@7.23.9` (the version index.html loads), not
  latest, and run npm OUT of the repo dir (/tmp).
- **A "broken" render is often a bad fixture.** Test stair templates with
  REALISTIC configs (proper opening/room to fold), not e.g. wrapAround on a
  plain front edge with offset 0 and no cutout.
- **matplotlib z-order trap:** `ax.plot` lines default zorder=2, patches
  (incl. `annotate` arrow FancyArrowPatch) default zorder=1, so a patch drawn
  later still sorts UNDER lines. (S97 confirmed the S96 "DN arrow hidden under
  decking" claim did NOT reproduce as a visible defect — the arrow sits over
  grade for edge stairs and only thin lines graze it on wrapAround; a zorder
  bump changed 0 pixels. Don't chase it.)
- **Notch ↔ stair are COUPLED (Will):** a notch exists only because a stair
  descends through it; the stair fills it (same width, x-aligned). Interior
  wells are not a real feature.

### Green gate — CI-parity (run before AND after any change, and after any rebase)
The GitHub Actions CI (`.github/workflows/tests.yml`) runs a SUBSET on every push
to main, and Railway AUTODEPLOYS from main UNGATED, so a red CI = the live deploy
is suspect. Your local gate must be the UNION (14 checks):
```
# Core (local):
python3 tests/test_structural.py            # "All tests passed"
python3 tests/test_beam_layout.py           # "BEAM LAYOUT: all checks passed"
python3 tests/test_notch_posts.py           # "NOTCH POSTS: all checks passed"
python3 tests/pdf/config_matrix.py          # "MATRIX: 18 configs, 0 failure(s)"
(cd tests/geometry && node lotGeometry.test.js)   # passed: 2764  failed: 0
python3 tests/test_frontend_parity.py       # "FRONTEND PARITY: all checks passed"
python3 tests/pdf/golden_structural.py      # "GOLDEN STRUCTURAL: all 20 sheet fingerprints match"
python3 tests/pdf/legibility_gate.py        # "LEGIBILITY GATE: passed"
# CI-run:
python3 tests/test_post_grade.py
python3 tests/test_frost_snow_normalize.py
python3 tests/test_future_products.py
SBP_SHEET=arch_d python3 tests/pdf/linework_check.py basic_rect_ledger zones_stairs_lcr   # OK vs baseline
python3 tests/pdf/panel_check.py --selftest && SBP_SHEET=arch_d python3 tests/pdf/panel_check.py basic_rect_ledger zones_stairs_lcr
SBP_SHEET=arch_d python3 tests/pdf/fuzz_configs.py 8
```
NOTE: CI does NOT run the golden, legibility, beam_layout, notch_posts, or
frontend_parity checks — those are local-only. So the golden guards the PERMIT
SHEETS locally but not in CI; parity guards JS↔Python locally but not in CI.
Run the full union locally and confirm CI green after pushing.

Env setup: `pip install matplotlib==3.10.8 numpy==2.4.4 --break-system-packages`,
then the rest of backend/requirements.txt minus those pins, plus
`pdfminer.six` (legibility) — poppler-utils, node, Pillow also required. The
camelot/pillow warning is harmless.

### Pushing to main
Will provides a PAT in-session. **NEVER store it.** Transient helper, verify,
sweep, suggest rotation:
```
export SBP_PAT="<pat>"
git -c credential.helper='!f(){ echo username=x-access-token; echo "password=$SBP_PAT"; };f' push origin HEAD:main
unset SBP_PAT
grep -rn "<actual token value>" . ; grep -n "<actual token value>" .git/config   # must be empty
```
`main` moves under you; rebase, resolve the index.html buster conflict (keep a
busting value), RE-RUN THE FULL GATE after the rebase, push. Confirm CI:
```
curl -s -H "Authorization: Bearer $SBP_PAT" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/wilwixqa1/SimpleBlueprints/actions/runs?per_page=3"
# the head_sha=<sha> filter is flaky; list latest 3 and match your SHA -> status/conclusion
```
Commit granularly: `S<NN> push <k>: <plain-English what+why>`.

### Reporting to Will
Non-technical owner. LEAD with plain-English "what it does + why." Present
renders (`present_files`) and WAIT for his confirm on anything not verifiable
numerically. Ask before pushing when a prior result was disputed. Will is the
visual/ground-truth authority — especially for 3D (no headless render). End
every session with a retrospective + a fresh context doc (this file).

---

## 1. ORIENTATION (what this is + where things live)

IRC-2021 deck permit drawing sets (PDF) from a deck config. Jurisdiction:
Colorado Springs / PPRBD. Beta; no paying customers. Deployment: Railway
AUTODEPLOYS from `main` on every push, UNGATED — live at simpleblueprints.xyz
(FastAPI serving `backend/static/` as the production wizard; the S88.5 mock at
/mock; the S95-rebuilt homepage is `home.js`). Sheets ARCH D (36"×24").

- Pipeline: `backend/app/main.py::generate_blueprint_pdf(params)` → 4-tuple;
  writes a permit-set PDF + a materials PDF to `/tmp/blueprints/`.
  `/api/generate-test` (auth-gated) calls it and returns `download_url`;
  `/api/download/{id}` serves the file. **NOTE (download fragility, S97):**
  PDFs live in `/tmp/blueprints` — per-instance and ephemeral on Railway; a
  download can 404 if it lands on a recycled/other instance. Not the cause of
  the S97 "button" report (that was the feedback gate), but a real risk.
- Structural engine: `backend/drawing/calc_engine.py::calculate_structure`.
  Exposes width/depth/height/area, num_joists/joist_size/joist_spacing/joist_span,
  beam_size/beam_type/beam_span, post_size/total_posts/post_positions/
  **post_heights** (per-post list), num_footings/footing_diam/footing_depth,
  ledger_size, rail_length, mid_span_blocking/blocking_count, stairs{...},
  beam_layout{segments,post_xy,stepped}.
- Stairs: `backend/drawing/stair_utils.py` — `resolve_all_stairs`,
  `compute_stair_geometry` (templates: straight, wideLanding, lLeft, lRight,
  switchback, wrapAround; **S97 recenter block** just before the bbox comp keeps
  runs[0] centered on the anchor), `transform_stair_point`,
  `get_stair_placement_for_zone`.
- Plan+framing: `backend/drawing/draw_plan.py::draw_plan_and_framing`
  (panels=("plan",)/("framing",)). Stair block ~L852+; the cutout white patch is
  zorder=2 (S94). DN arrow is an annotate FancyArrowPatch (zorder 1) — see the
  z-order trap; not a real defect.
- Materials/cost sheet: `backend/drawing/draw_materials.py` —
  `estimate_materials` (aggregate qty + cost; mirrors engine.js `estMaterials`,
  LOCKSTEP), `estimate_zone_materials`, `draw_materials_sheet`.
- Frontend (live preview; MUST mirror backend — "lockstep", guarded by
  test_frontend_parity):
  - `stairGeometry.js`: `computeStairGeometry` (S97 recenter mirror),
    `getStairPlacement`, `getStairPlacementForZone`.
  - `zoneUtils.js`: zone rects/edges/openings + `resolveAllStairs` (shared
    resolver mirror), `computeStairOpenings`.
  - `sitePlanView.js`: consumes the shared `resolveAllStairs` (migrated S94).
  - **`deck3d.js`, `planView.js`, `elevationView.js`, `engine.js` still INLINE
    their own multi-stair resolution/elevation (and deck3d inlines its own
    deck-cut) — the consolidation target (§4/CONSOLIDATION) and the source of
    the S97 3D-hole bug.**
  - Wizard steps + the Generate button live in `steps.js`.

### Config shape
Canonical `_base()` = 20×14 ledger deck (copy from tests/test_notch_posts.py or
tests/pdf/golden_structural.py — carries all keys incl. snowLoad/frostZone).
Stairs ALWAYS `deckStairs: [{id,zoneId,location,offset,width,numStringers,
template,...}]`. REALISTIC RULE (Will): a notch is always filled by its stair
(same width, x-aligned). Misaligned/orphan notches are bad fixtures.

---

## 2. CURRENT STATE (shipped through S97)

- Through S96: notched framing + notch-aware anchors; site-plan preview lockstep;
  details sheet reworked (IRC citations) + pinned in the golden (S96); steel
  notched-deck beam uses cutout-aware layout (S96); structural + legibility gates.
- **S97 push 1 (`7292791`):** stair connecting-run recenter (all templates attach
  at the anchor; plan+3D via shared geometry; JS/Python parity; golden unchanged).
- **S97 push 2 (`a197286`):** removed the production feedback gate on the Generate
  button (feedback now optional). Frontend-only.
- **S97 push 3 (`5868cc2`):** cache busters (stairGeometry s97a, loader s97a).
  CI green on 5868cc2.

Verified in S97: recenter numerically (all templates → attach x=10 on the test
deck) + parity + golden + matrix + full gate; button change by transpile under
prod babel 7.23.9 + logic read; both pushed, rebased over S96.5, CI success.

---

## 3. DOMAIN CONVENTIONS (what "correct" looks like) — carried forward

North stars (Will): (a) PASS the permit, (b) LOOK professional enough that a
contractor feels safe submitting AND building from it. Benchmark for LAYOUT =
`docs/reference_sets/` (Ilaria, Loucks — REAL approved PPRBD sets); for CODE
TEXT the benchmark is the IRC + PPRBD handouts (the reference sets contain
code-text errors — verify claims). **S97 primary-source confirmations:**
- PPRBD deck plan-review handout (`pprbd.org/File/ByAlias/DeckPlanReview`)
  requires on the framing plan: framing material + species; joist sizes and
  spacing of REPETITIVE framing (group callouts — which we produce); beam sizes;
  post/pier locations (material/size/height + footing detail); ledger spec;
  decking material + direction; stair sections (stringers material/size/spacing,
  rise ≤7¾"/run ≥10", width ≥36"). It does NOT require per-member tags or a cut
  list. DCA-6 (AWC prescriptive guide) "Typical Deck Framing Plan" is group-
  callout style too. Our framing sheet already meets this bar.

---

## 4. TODO (priority order)

### P0-3D — "STAIRS CLIP THROUGH THE DECK / NO HOLE" in the 3D VIEW (TOP; Will-flagged S97)
- WHAT/WHY: In the 3D View, a stair that descends THROUGH/INTO the deck —
  interior-anchored stairs, and folding templates (U-Turn/Wrap) whose landing +
  later runs project back over the deck interior — CLIPS through the SOLID deck.
  There is no HOLE where the stair passes through. The PLAN view is correct (it
  shows the void via the cutout/notch zone). So this is 3D-ONLY and, per Will,
  "the same idea as the stair issue" — the views compute it separately.
- ROOT CAUSE (diagnosed S97, from code): `deck3d.js` cuts the deck opening from
  `stairClipD`, computed from **run 0 ONLY** and scoped to the deck EDGE / anchor
  zone (deck3d.js ~L377–424; the decking/joist/rim cuts read `frontGap` +
  `stairClipD` at ~L485, ~L517, ~L808). There's an explicit comment that "run 0
  extends away from the deck, so a front stair produces a ~zero cut" — true for a
  plain straight edge stair, but it means INTERIOR openings and the folded-back
  landing/runs of U-Turn/Wrap are NEVER cut → they clip a solid deck. The plan
  gets its void from a different mechanism (cutout zone / notch), so the two
  diverge. Textbook consolidation problem.
- FIX DIRECTION: cut the 3D decking (and the joists/rim it keys off) at the FULL
  stair-opening footprint — the union of runs+landing that overlap the deck
  plane, OR (better) reuse the SAME opening geometry the plan uses
  (`computeStairOpenings` / the cutout/notch rects) for ALL stair positions, not
  just run0-edge. Doing it via the shared opening is the first consolidation win.
- CONSTRAINTS: **3D is WebGL — cannot be verified headless. Verify with Will's
  before/after SCREENSHOTS.** `deck3d.js` is also executed by the S88.5 mock's
  3D tab and edited by that session (§8) — coordinate; keep the classic path
  safe; bump the shared loader buster.
- START: build a realistic interior-anchored + U-Turn/Wrap config; read the
  deck3d decking-build loop (around L470–530) and the `frontGap`/`stairClipD`
  usage; propose cutting at the full opening; hand Will renders to confirm.

### CONSOLIDATION — one shared "stair/geometry brain" for all views (Will asked for this write-up)
**WHY (the problem, in Will's terms).** The live preview, the 3D view, and the
PDF each do their own geometry math, so they can DIVERGE — that's the family of
bugs we hit in S97 (the template-attachment shift; the 3D no-hole clip). Two
distinct SEAMS:
  1. **JS browser preview vs Python server PDF.** Two implementations of the
     same deck math, in two languages. This is LARGELY INHERENT to the product:
     you want an instant in-browser preview AND an authoritative server-made PDF,
     and you can't cheaply run the Python in the browser. NOT a mistake — it's
     the price of both. Keep it; the safety net is the automated PARITY tests
     (test_frontend_parity) that fail the moment JS and Python disagree. Do NOT
     try to merge this seam (WASM/round-trip previews are a big lift with their
     own costs); just keep investing in parity coverage.
  2. **Within the frontend, view-by-view duplication.** As each view was built
     (plan → 3D → elevation → site), several grew their OWN copy of "resolve all
     stairs + their elevations" and (deck3d) "where's the deck hole," instead of
     all calling ONE shared module. `sitePlanView.js` was already migrated onto
     the shared `resolveAllStairs` in S94; `deck3d.js`, `planView.js`,
     `elevationView.js`, `engine.js` still inline. **THIS is the genuine,
     fixable technical debt** — the thing that lets views drift and forces a fix
     in several places. It is normal early-build debt (build a few views, see
     what they share, then extract), not a screw-up — but worth paying down
     deliberately now that the shared shape is clear.

**RISK / BLAST-RADIUS (what we established in S97, because Will's #1 concern is
not reintroducing fixed bugs).**
- It is **frontend-only. It CANNOT touch the permit PDF** — that's generated by
  the separate Python/server code, locked by the GOLDEN test (fails on any
  drawing-primitive change to plan/framing/site/details). So the hard-won
  backend fixes (notch beam, details, railType, geometry) cannot regress from
  this work. Full stop.
- Risk is confined to the ONE view being migrated, and only while working it. A
  migrated view ends up reading the PARITY-TESTED shared resolver (i.e. moving
  toward the verified-correct math, not away).
- We already PROVED the pattern: sitePlanView was migrated this way in S94 and
  checked to the inch against the backend.
- METHOD per view: capture output BEFORE and AFTER — numerically/headless for
  plan & elevation (headless-render + primitive diff), **screenshots for 3D**
  (no headless WebGL) — and require ZERO change except where the shared version
  is deliberately more correct (flag those for Will). If you can't PROVE a view
  is unchanged, don't ship that step.
- Sequence `deck3d.js` **LAST**, or defer it while the mock session is active,
  since that file is shared with the mock (§8) and is the riskiest.

**HOW (incremental, safe).** One consumer at a time onto the shared
`zoneUtils.resolveAllStairs` + `stairGeometry.computeStairGeometry` (which Python
mirrors and parity guards): planView → elevationView → engine → deck3d. Verify
each. The **3D hole-cut fix (P0-3D) is the natural first step**: make the 3D use
the same opening/void the plan uses instead of its own run0 cut.

### PARKED / REVISIT-LATER — Labeled framing + per-member CUT LIST (was S96 P0)
RESEARCHED and SHELVED in S97 (full reasoning in the retrospective + §6).
Summary: not permit-required (PPRBD/DCA-6/reference sets all use repetitive-
framing GROUP callouts, which we already produce); large accuracy burden owning
exact cut lengths across every config (our buggiest geometry); a wrong length
hurts the contractor-trust north star more than a missing feature; GCs do their
own takeoffs, DIY are the highest-risk consumer; no jurisdiction requires it; a
bare table is useless without a labeled drawing to key it to.
- REVISIT ONLY IF: (1) stair templates fully verified incl. the 3D hole, (2)
  zone/cutout/cantilever member-length math proven correct per config, AND (3)
  GCs actually ask for it — and even then frame lengths as "verify on site."
- OPTIONAL low-risk sliver if wanted: add a summary block (deck area, perimeter,
  concrete volume, concrete bags) to the EXISTING materials sheet — NO per-member
  labels, NO cut lengths, no new drawing, no accuracy exposure. (Reference:
  `build_cutlist`/`draw_cutlist_sheet` were prototyped then reverted in S97; the
  reconciliation approach — cut list agrees with estimate_materials on bags &
  stringers, ≤ on joists — is sound if we ever return.)

### P-other (carried from S96, still open)
- Notch↔stair coupling in the EDITOR (auto-create/align notch with stair; prevent
  orphan/misaligned) — needs Will's UX call.
- Detector: rotated-text overlap (pdfminer splits rotated labels to 1-char
  fragments the overlap pass ignores; stopgap = per-zone red-pixel count).
  Extend the golden/legibility gate to the details sheet once handled.
- Migrate legacy matrix config to deckStairs; wire compute_beam_layout into the
  STEEL calc (S96 shared compute_beam_layout for steel notch; verify remaining).
- Global cantilever enforcement (≤¼ back-span); cantilever dim on framing.
- Zoomable on-screen preview (ARCH D shrunk looks tiny; print is fine).
- B7/B8 grade-line; B11 ledger-to-bump-out.

---

## 5. KEY TRAPS & LEARNINGS (don't rediscover) — updated S97
- **3D (deck3d.js) cannot be rendered headless — verify with Will's screenshots.**
  Plan/PDF you can verify numerically + headless render. [S97]
- **Verify your tools/probes, not just the product.** S97: a "syntax error" in
  steps.js was a false positive from a NEWER babel than production's 7.23.9
  (which accepts it); a "buried DN arrow" from S96 didn't reproduce (zorder bump
  = 0 pixels). Use the prod babel version; pixel-diff before claiming a visual
  fix. [S94–S97]
- **Views compute geometry separately → they diverge.** The stair-attachment
  shift and the 3D no-hole clip are the same root disease (see CONSOLIDATION).
  Backend+frontend lockstep is guarded by test_frontend_parity; within-frontend
  divergence is not (deck3d/plan/elevation/engine inline). [S97]
- **CI runs only a SUBSET** (no golden/legibility/parity/beam/notch). Run the
  full union locally; confirm CI green after pushing. Railway autodeploys
  ungated. [S94–S97]
- **`main` moves under you** (mock + S96.5 + your line). Expect the index.html
  buster conflict; re-run the FULL gate after every rebase. [S92–S97]
- **PAT: transient helper only; sweep the actual token value; suggest rotation.**
- Reference sets contain code-text errors; verify against IRC/PPRBD. `view` tool
  intermittent. `generate_blueprint_pdf` writes TWO PDFs. legibility_check needs
  pdfminer.six. Keep npm artifacts out of the repo. Notch↔stair coupled.

---

## 6. PENDING ON WILL
- **3D hole-cut fix (P0-3D):** will need Will's before/after screenshots to
  verify (no headless 3D).
- **ROTATE the S97 PAT** (exposed in chat).
- Cut-list REVISIT gates (see PARKED) — and whether the optional summary-block
  sliver is wanted.
- Editor UX for notch↔stair coupling; notch outline style; stair tread style on
  framing (dashed vs solid).
- Validate real parcel-lookup accuracy in the target jurisdiction.
- Have Billy (code-literate contact) sanity-read the details-sheet IRC citations
  before a real submittal.
- Business: pricing; PPRBD mixed-size set acceptance; target town.
- Real test address: Ilaria = 4739 Sweetgrass Lane, Colorado Springs CO 80922.

---

## 7. STANDING REMINDERS
- Ship one change / verify / continue. Prove plain decks unchanged via the
  GOLDEN; prove visual claims numerically (+ Will's eyes; screenshots for 3D).
- Backend+frontend geometry lockstep; bump busters on JS edits; extend
  test_frontend_parity when touching shared geometry.
- Full 14-check gate before AND after changes, and after every rebase. Confirm
  CI green after pushing.
- PAT: transient only; sweep; suggest rotation.
- Lead Will-facing summaries with plain-English what+why. Present renders. Wait
  for confirm. End with retrospective + fresh context doc.

---

## 8. PARALLEL SESSIONS pushing to `main`
- **S88.5 UX MOCK** (simpleblueprints.xyz/mock): modifies PRODUCTION files —
  `deck3d.js` (photo materials theme, now the DEFAULT for 3D view + PDF cover),
  the PDF cover's capture3D angle, `backend/static/textures/`, the shared
  index.html buster. Its mock 3D tab executes production deck3d.js verbatim, so
  it reaches into production. If the PDF cover's 3D looks different, that's this
  session's camera/theme change. **Any deck3d work (incl. P0-3D) must be verified
  against BOTH the production 3D view and the mock tab, and coordinated to avoid
  clobbering their changes.**
- **S96.5** (recent): "signing in no longer wipes your deck design" + "look up a
  different address again" — touches app.js / steps.js / index.html. Rebase
  cleanly (S97's steps.js button edit auto-merged with theirs).
- On every push: `git fetch`, check the new commits' scope, rebase, re-run the
  FULL gate, resolve the index.html buster conflict (keep a busting value), push,
  confirm CI.
