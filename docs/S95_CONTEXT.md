# SimpleBlueprints — MASTER CONTEXT & TODO (start-here for S95)

Single "hit the ground running" doc. Read §0 and §1 first, then work §4.
Self-contained: you should not need to reverse-engineer anything below.
Supersedes docs/S94_CONTEXT.md (finished S94 work is in §2, not §4).

Repo: `https://github.com/wilwixqa1/SimpleBlueprints` (public clone).
As of S94 close: `main` @ `1e6ffb5` (S94 push 5 = this doc, on top of push 4).
**`main` moves under you** — the S88.5 "UX mock" session pushes to `main`
concurrently and was ACTIVE during S94 (pushes 13–18, and it now touches
PRODUCTION files — see §8). Expect to fetch/rebase; expect a cache-buster
conflict in `backend/static/index.html` (both sessions bump the shared
`var v = "v=sXX"` line; resolution = keep the newest value, any change busts).
All suites green at S94 close (8-check gate — see §0).

---

## 0. HOW TO WORK (anti-spiral rules + exact recipes)

**These are not optional. S90–S94 each validated them the hard way.**

### Inspection discipline (this is where trust is won or lost)
- **Identify a sheet by its DRAWING CONTENT, never by page index.** "PROPOSED
  DECK" (unique) → site plan. "GUARD RAIL DETAIL" → details sheet. "DECK PLAN"
  matches the cover's index too — grep for content unique to the target page.
  Complex deck (has zones) = 8 pages (site plan p7, details p6, deck plan p2);
  simple = 7 pages with combined A-1.
- **The `view` tool is INTERMITTENT for renders.** In S94 it rendered PNG crops
  legibly twice, then returned an unreadable placeholder on the very next call
  in the same session. Treat every view of a render as a coin flip: attempt it,
  but NEVER let a claim rest on it. The loop that works: verify numerically
  (coordinates, text bboxes, pixel counts, primitive extraction) → render →
  present to Will → Will confirms. Say explicitly when you could not see a
  render yourself.
- **pdfminer CANNOT see rotated text — this bit us TWICE (S93, S94).** Rotated
  dimension labels split into 1-char fragments the overlap detector ignores.
  In S94 a rotated '36" MIN.' dim collided with the stair-notes box and the
  decking label and sailed through a "0 overlaps + 40pt clearance" check.
  Stopgap that works: rasterize and COUNT COLOR PIXELS in the suspect zone
  (e.g. red dims: `(R>150)&(G<100)&(B<100)` over the bbox; S94 measured 384 →
  0 across the fix). Do this for any zone where a rotated label could land.
- **Trust reference sets and running code over docs — but not blindly:
  the pro reference sets themselves contain errors.** S94 found the references'
  stair note is garbled ('RISE- 4" TO 7.75", MIN.' is not what IRC says) and
  their landing '12" MIN.' labels are ambiguous/contradictory. When a drawing
  copies the reference, verify the CODE CLAIM against the actual IRC/PPRBD
  text (web search) before propagating it. We now EXCEED the reference on code
  accuracy (see §3) — keep it that way.
- **The S94 doc itself had a wrong claim** (said `resolveAllStairs` existed in
  the frontend; it did not — S94 built it). Every doc has ≥1 wrong claim.
  Verify by grep/run before building on a stated fact.
- **A "broken" render is often a bad fixture, not a code bug.** Verify a demo
  config is realistic (notch aligned with + filled by its stair) first. In S94
  even a *verification harness* had the bug (a tree-walker that didn't descend
  into element arrays reported zero stairs from correct code). Suspect the
  probe before the product.
- Harness renders: `python3 tests/pdf/render_review.py <set>`. Select PDFs by
  the returned `permit_id` — `generate_blueprint_pdf` writes TWO PDFs (permit
  set + 1-page materials) and `ls -t` can grab the wrong one.

### Verification techniques proven in S92–S94
- **Structural (vector) golden = the flat-invariant check.**
  `tests/pdf/golden_structural.py` fingerprints drawing primitives per
  config/sheet (site/plan/framing across 5 configs). After a draw change it
  prints exactly which config/sheet + first differing primitive. Intended
  change → `--update`, commit the JSON diff alongside. NOTE: the DETAILS sheet
  is NOT in the golden (S94 details rework was invisible to it). Adding
  configs/sheets is a one-line edit to `CONFIGS`/`SHEETS` + `--update`.
- **Function-level parity (JS vs Python):** `tests/test_frontend_parity.py`
  runs `tests/geometry/parity_probe.js` (Node + `global.window = {}` shim) and
  compares against the Python geometry. As of S94 it covers profile, anchor,
  openings, edges, AND `resolveAllStairs` vs `resolve_all_stairs` (multi-stair
  + legacy-fallback configs).
- **Headless component verification:** load stairGeometry/zoneUtils/
  sitePlanView with a stub React (`createElement` returns plain objects;
  `useRef`/`useState` stubbed), call the component, walk the element tree
  (REMEMBER: children can be ARRAYS — recurse into them), invert px→feet, and
  compare drawn rects to backend math. S94's /tmp/verify_siteplan_lockstep.py
  pattern; also serialized the tree to a standalone .svg for Will
  (/tmp/siteplan_to_svg.js pattern). Not committed; rebuild if needed.
- **Localize a render change:** PIL ImageChops diff two PNGs → bbox of change.
  S94 proved the notch fix surgical this way: 1012 tan pixels removed inside a
  square bbox (aspect 1.05 ≈ the 4×4' notch), 0 changed pixels elsewhere.
- **JSX syntax check:** `npm install @babel/standalone` then
  `Babel.transform(code, {presets:['react']})` per view file. `node --check`
  does NOT work on JSX views. Delete the package.json/lock afterward (they
  land where you ran npm — keep npm runs OUT of the repo dir).
- **Matplotlib z-order trap:** `ax.plot` lines default zorder=2, patches
  default zorder=1 — a "covering" white patch under lines does NOT cover.
  Equal zorder draws in INSERTION order (stable sort), so `zorder=2` on a
  patch added after the lines but before later lines slots it exactly between.
  This is how S94 fixed the notch (see §2) — reuse the idiom deliberately.

### Environment setup
```
git clone https://github.com/wilwixqa1/SimpleBlueprints && cd SimpleBlueprints
pip install matplotlib==3.10.8 numpy==2.4.4 --break-system-packages
grep -viE '^(matplotlib|numpy)==' backend/requirements.txt > /tmp/r.txt
pip install -r /tmp/r.txt --break-system-packages   # camelot/pillow warning = harmless
pip install pdfminer.six --break-system-packages    # legibility_check needs it (NOT in reqs)
# poppler-utils (pdftoppm/pdftotext/pdfinfo), node, Pillow also required.
git config user.name "SimpleBlueprints Session"; git config user.email "session@simpleblueprints.xyz"
```

### Green gate (run before AND after any change, and AFTER any rebase)
**There is a GitHub Actions CI (`.github/workflows/tests.yml`, S84) that runs
on every push to main — and Railway AUTODEPLOYS from main with NO gate, so a
red CI means the live deploy is suspect. The S94 doc omitted CI entirely and
S94 shipped a panel-overflow regression that only CI caught (fixed in S94
push 7). Your local gate must be CI-PARITY: the 8 core checks PLUS the 6
CI-only checks below.**
```
# Core 8:
python3 tests/test_structural.py            # "All tests passed"
python3 tests/test_beam_layout.py           # "BEAM LAYOUT: all checks passed"
python3 tests/test_notch_posts.py           # "NOTCH POSTS: all checks passed"
python3 tests/pdf/config_matrix.py          # "MATRIX: 18 configs, 0 failure(s)"
(cd tests/geometry && node lotGeometry.test.js)   # passed: 2764  failed: 0
python3 tests/test_frontend_parity.py       # "FRONTEND PARITY: all checks passed"
python3 tests/pdf/golden_structural.py      # "GOLDEN STRUCTURAL: all 15 sheet fingerprints match"
python3 tests/pdf/legibility_gate.py        # "LEGIBILITY GATE: passed"
# CI-only 6 (MANDATORY before any push touching drawing code):
python3 tests/test_post_grade.py            # "POST-TO-GRADE: ... 0 unexpected deviations"
python3 tests/test_frost_snow_normalize.py  # "B9 NORMALIZE: all ... passed"
python3 tests/test_future_products.py       # "All logic tests passed"
SBP_SHEET=arch_d python3 tests/pdf/linework_check.py basic_rect_ledger zones_stairs_lcr  # OK vs baseline
python3 tests/pdf/panel_check.py --selftest && \
  SBP_SHEET=arch_d python3 tests/pdf/panel_check.py basic_rect_ledger zones_stairs_lcr  # OK vs baseline (G5/G6/G7)
SBP_SHEET=arch_d python3 tests/pdf/fuzz_configs.py 8   # "FUZZ: 8 configs ... 0 failures"
```
`linework_check`/`panel_check` are BASELINE-DIFFERENTIAL oracles: fix code to
return to baseline; only re-baseline deliberately with Will's knowledge.
After pushing, CONFIRM CI WENT GREEN (authenticated GET
/repos/wilwixqa1/SimpleBlueprints/actions/runs with the session PAT — the
unauthenticated API is rate-limited from this egress IP).

### Pushing to main
Will provides a GitHub PAT in-session. **NEVER store it** (not in files, not in
`.git/config`, not in memory). Push via transient env-var helper, verify, sweep:
```
export SBP_PAT="<pat>"
git -c credential.helper='!f(){ echo username=x-access-token; echo "password=$SBP_PAT"; };f' \
  push origin HEAD:main
unset SBP_PAT
git grep -n "<actual token value>"; grep -rn "<actual token value>" .git/config
```
Sweep for the ACTUAL token value, not the "ghp_" substring (older docs contain
example "ghp_" text = false alarm). `main` moves under you; non-fast-forward →
fetch, check the new commits' scope (see §8), rebase, RE-RUN THE FULL GATE,
push. Commit granularly: `S<NN> push <k>: <plain-English what+why>`.
**Suggest Will rotate the PAT after the session.** (S94's PAT is in chat —
rotation was requested.)

### Reporting to Will
Non-technical owner. LEAD with plain-English "what it does + why"; codes
secondary. **Will is the visual ground truth** — present renders
(`present_files`) and WAIT for his confirm on anything you cannot verify
numerically (given the view tool's unreliability, that is most visual things —
and even when the tool works, Will still catches what detectors miss: in S94
he found the notch boards bug, the clipped rotated dim, AND the rail-label
inconsistency; each one led to a real code fix). When Will describes a
problem, believe him and diagnose from code + his words. Ask before pushing
when a prior result was disputed. End every session with a retrospective + a
fresh context doc like this one (commit it as the session's final push).

### Cache-busters (frontend edits ONLY)
`backend/static/index.html`: static `<script>` tags carry per-file `?v=`; the
deferred wizard views (planView, deck3d, elevationView, sitePlanView,
traceView, steps) share one `var v = "v=sXX"` in the lazy loader. S94 set the
shared loader to `s94a` and zoneUtils.js's static tag to `s94a`
(stairGeometry.js is still `s92a` — untouched). Bump on ANY frontend JS edit.
The mock session bumps the same shared line (s885x series) → rebase conflicts
here are ROUTINE; keep the newest value.

---

## 1. ORIENTATION (what this is + where things live)

SimpleBlueprints generates **IRC-2021 deck permit drawing sets** (PDF) from a
deck config. Jurisdiction: Colorado Springs / PPRBD. Beta; NO paying customers.
Sheets are ARCH D (36"×24") — `backend/drawing/sheet.py` (`_ACTIVE`; the
"kept at letter" comment is STALE). Fonts authored in points for a 14" sheet,
scaled ~2.57× by `render_scale()` — a 3.8pt authored label prints ~9.8pt.
On-screen the sheet is shrunk to fit → text LOOKS tiny; that's a viewing
artifact (zoomable preview = §4/P6).

(Line numbers drift; search by function name.)

- Pipeline: `backend/app/main.py::generate_blueprint_pdf(params)` → 4-tuple
  `(permit_id, materials_id, calc, permit_report)`; writes permit set + 1-page
  materials PDF to `/tmp/blueprints/`. `_complex = len(zones) > 0` splits
  7-page (combined A-1) vs 8-page (separate plan/framing) composition.
- Structural engine: `backend/drawing/calc_engine.py::calculate_structure`.
- `backend/drawing/beam_layout.py`: `front_edge_profile`,
  `notched_deck_polygon`, `notch_headers`, `compute_beam_layout`.
- Plan+framing: `backend/drawing/draw_plan.py::draw_plan_and_framing`
  (`panels=("plan",)` / `("framing",)`). **S94: the cutout white patch on the
  plan panel is zorder=2** (covers boards, sits under later-drawn stairs).
- Stairs: `backend/drawing/stair_utils.py` — `resolve_stair_elevation`,
  `resolve_all_stairs(params, calc)` (per-stair notch-aware anchors + legacy
  `hasStairs` fallback), `get_stair_placement_for_zone`,
  `compute_stair_geometry`, `compute_stair_info` (None if rise ≤ 0.5).
- Zones/edges: `backend/drawing/zone_utils.py` — `get_additive_rects`,
  `get_cutout_rects`, `get_exposed_edges(params, stair_openings=None)`.
- Site plan: `backend/drawing/draw_site_plan.py` — draws ALL stairs via
  `resolve_all_stairs` (S93), legibility-hardened. Site axes are NOT equal
  aspect — don't assume 1:1 feet when reading pixels.
- Details: `backend/drawing/draw_details.py` — 2×3 grid
  (`draw_details_sheet`): ledger, footing, stair-landing / guard-rail,
  post-beam, hardware schedule. **Reworked in S94** (see §2): IRC citations,
  label columns, sphere circles in gaps. NOT covered by the golden.
- Spec: `backend/drawing/permit_spec.py::build_permit_spec` — single source
  of truth for labels. **Rail branding: reads `railType` (wizard key) with
  legacy `railingType` fallback, default fortress (S94 fix).** Both details
  derive `is_fortress` from `spec["guardrail"]["system"]`.
- Frontend (live preview; MUST mirror backend geometry — "lockstep"):
  - `stairGeometry.js`: `frontEdgeProfile`, `getStairPlacement(p, {W, D})`
    (note key names), `getStairPlacementForZone`.
  - `zoneUtils.js`: zone rects/edges/openings **+ NEW (S94):
    `resolveAllStairs(p)`, `resolveStairElevation`, `getStairExitSide` — the
    shared JS mirror of the Python resolver.** Takes the zone-params shape
    (deckWidth/deckDepth + height, zones, deckStairs or legacy fields);
    returns deck-LOCAL `worldAnchorX/Y`, angle, exitSide, elevationInfo.
  - `sitePlanView.js`: **now consumes `resolveAllStairs`** (S94) — draws every
    stair, notch-aware, mirrors the backend's site-plan spec math (its stair
    loop is a line-by-line mirror of draw_site_plan's `_stair_specs`; keep
    them together).
  - **`deck3d.js`, `planView.js`, `elevationView.js`, `engine.js` still INLINE
    their own multi-stair resolution/elevation logic** — a consolidation
    target (§4), not a bug (parity holds today).
  - Wizard railing option: steps.js `Chips label="Railing" field="railType"`
    (fortress|wood, default fortress).
- Tests: see §0 gate. Parity covers the shared resolver as of S94.

### Config shape (essentials)
Canonical `_base()` = 20×14 ledger deck (see tests/test_notch_posts.py — it
carries ALL keys calculate_structure needs, incl. snowLoad/frostZone; copy it
for fixtures instead of hand-building). Zones:
`{"id","type":"cutout"|"add","attachEdge","attachOffset","w","d","attachTo"}`.
Stairs: ALWAYS `deckStairs`:
`[{"id","zoneId","location","offset","width","numStringers","template",
"_landsOnZoneId",...}]`. **REALISTIC RULE (Will, S93): a notch is ALWAYS
filled by its stair — same width, x-aligned (front stair at offset o centres
at W/2+o; notch [a, a+w]; aligned ⇔ W/2+o == a+w/2).** Misaligned/orphan
notches are bad fixtures, not real decks.

---

## 2. CURRENT STATE (shipped through S94)

- Through S93: B10 notched framing; notch-aware stair anchors + rail openings
  on plan/preview (P1.2/P1.4a/P1.a); site plan draws all stairs + legibility
  fixes; structural golden (P3); legibility gate (8th check).
- **S94 push 1 — SITE-PLAN PREVIEW LOCKSTEP (was P0).** Built the shared
  `resolveAllStairs` in zoneUtils.js (JS mirror of Python, incl. legacy
  fallback and the additive-rects-only zone lookup); rewrote sitePlanView's
  stair block to iterate it (all stairs, notch-aware, backend-identical spec
  math); nudged PROPOSED DECK label to 0.40·depth (mirror of S93 backend).
  Verified: headless component render vs backend `_stair_specs` matched
  to the inch on 6 configs (multi-stair, side, legacy, landing, flat, notch).
  Parity test now guards the resolver pair. Cache busters → s94a.
- **S94 push 2 — DECK PLAN NOTCH FIX (Will-flagged).** Decking board lines
  (zorder 2) painted THROUGH the notch's white cutout patch (zorder 1), so a
  notch stair sat on boards and read as going UP. Fix: cutout patch zorder=2
  (insertion order slots it above boards, below the later-drawn stair).
  Verified: pixel diff = 1012 tan pixels removed in a notch-shaped bbox, 0
  pixels changed elsewhere; golden changed ONLY the two notched configs' plan
  sheets (updated + committed). Will visually confirmed.
- **S94 push 3 — DETAILS SHEET REWORK (Will-flagged; IRC-verified).**
  Guard rail detail: sphere note OUT of the baluster infill into the right
  label column; IRC R312.1.1/.2/.3 cited. Stair-landing detail: duplicate
  '12" MIN.' dim deleted (was drawn twice at the same spot); landing pad
  relabeled per IRC R311.7.6 (36" min in direction of travel; 4" min thick —
  the old labels contradicted each other AND the code); garbled reference
  note replaced with correct R311.7 stair notes; sphere circle recentered
  into a baluster GAP (old frac 2.5/8 was exactly baluster #3's position —
  it had always been drawn ON a baluster); notes box shortened/inside panel;
  floating deck-guard '36" MIN.' dim REMOVED (dimensioned a guard this detail
  doesn't draw; its rotated label collided invisibly with the notes box —
  caught by Will, confirmed by red-pixel count 384 → 0).
- **S94 push 4 — RAILTYPE FIX.** permit_spec read legacy `railingType` while
  the wizard writes `railType` → choosing Wood never changed sheet labels;
  and the two details had OPPOSITE defaults (one FORTRESS, one WOOD on the
  same sheet when unset). Now: spec reads railType→railingType→fortress; both
  details derive from spec. Verified end-to-end: wood → 0 FORTRESS mentions on
  the details page; fortress/unset → Fortress consistently.
- S94 push 5: this doc.

**Verified in S94:** push 1 numerically (headless component parity) + Will;
push 2 by pixel diff + golden surgicality + Will; push 3/4 by bbox/red-pixel
measurements + wood-path text extraction + gate + Will ("MUCH MUCH BETTER").

---

## 3. DOMAIN CONVENTIONS (what "correct" looks like)

A permit set: cover, deck plan, framing, elevations, stair detail, notes, site
plan, attachment. Benchmark = `docs/reference_sets/` (Ilaria, Loucks) for
LAYOUT — but S94 established the references contain CODE-TEXT errors; for code
content the benchmark is the IRC itself + PPRBD handouts. North stars (Will):
(a) PASS the permit, (b) LOOK professional enough that a contractor feels safe
submitting it.

**IRC 2021 numbers (verified S94 via published code + PPRBD; cited on sheets):**
- Riser ≤ 7-3/4"; tread ≥ 10" (≥ 11" without nosing); variation ≤ 3/8" per
  flight; nosing 3/4"–1-1/4" when treads <11" w/ solid risers (R311.7.5.x).
- Handrail: required at 4+ risers, ONE side min; 34"–38" above nosings; grip
  1-1/4"–2" dia (Type I/II); continuous, returned ends (R311.7.8.x).
- Guards: required where walking surface >30" above grade (within 36"
  horizontally per PPRBD wording); ≥36" high; 4" sphere infill (4-3/8"
  permitted on stair-guard sides — we use the stricter 4"). (R312.1.x)
- Landing: top AND bottom of each flight; width ≥ flight; ≥36" in direction
  of travel (R311.7.6). Stairway clear width ≥36" (R311.7.1). Flight rise
  ≤ 12 ft (R311.7.3).
- PPRBD plan review checks stairs for: material, rise/run, handrail/guardrail,
  landing, stringer connection. Our details sheet is aimed at that checklist.

**NOTCH ↔ STAIR are COUPLED (Will, S93).** A notch exists only because a stair
descends through it; stair fills the notch (width == , aligned). Interior
wells are NOT a real feature (de-scoped). Enforcement belongs in the EDITOR
(frontend) — see §4/P1, still needs Will's UX call.

**Sheet responsibilities:** deck plan = architectural (decking, rail, full
stair, DN, dims — notch now renders as a true opening, S94); framing =
structural (+ concrete landing, per references — KEEP); elevations = heights,
guards, bracing; site plan = deck+stairs to grade, dims, setbacks; details =
ledger/footing/stair-landing/guard-rail/post-beam/hardware with IRC citations
(S94). The standalone GUARD RAIL DETAIL is OUR addition (neither reference has
one) — a differentiator; keep it sharp.

---

## 4. TODO (priority order; each: WHAT/WHY · WHERE · HOW · VERIFY)

### P0 — LABELED FRAMING + CUT LIST / MATERIAL LIST (NEW; Will: "the thing I
### wanna add the most" — TOP PRIORITY, RESEARCH FIRST)
- WHAT/WHY: Will shared competitor screenshots (end of S94; not in the repo,
  described here because you cannot see them): (1) an interactive 3D framing
  view where EVERY individual member carries a label chip — J1/J2/J10... for
  joists, BK1/BK2/BK3 for blocking, S1 for stair stringers; (2) a print sheet
  combining a labeled joist-layout plan with a CUT LIST table keyed to those
  labels (columns: LABEL, QTY, SIZE, LENGTH, USE — e.g. "J1 | 12 | 2x8 |
  104-5/8" | FLOOR JOIST"), a MATERIAL LIST (qty/size/length totals), and a
  summary block (DECK AREA, DECK PERIMETER, CONCRETE VOLUME, CONCRETE BAGS —
  "37 - 30kg Bags"); plus dimensioned elevations. Also an email from William
  Pappas: "the building department wants to see a drawing of the structural
  framing. it doesnt have to be super perfect but they do require a sketch
  for the permit." NOTE: our existing framing sheet already satisfies that
  permit requirement — the FEATURE is the per-member labeling + cut list
  layer that makes the set buildable, not just permittable. Serves both
  north-star audiences (contractor: cut/shop list; homeowner: complete
  packet). Will may share more detail — check the conversation start.
- WHAT EXISTS TODAY (verified S94 close): framing plan with GROUP callouts
  only (matches the pro reference sets' style — '(2) P.T. 2X10',
  'P.T. 2x8 @ 16" O.C.'); a separate 1-page materials PDF
  (`draw_materials.py::draw_materials_sheet`, aggregate quantities) that
  mirrors the frontend estimator (`engine.js::estMaterials` — LOCKSTEP
  obligation if quantities logic changes). NO per-member labels, NO cut list,
  NO lengths-per-label, NO perimeter/concrete-bags summary.
- HOW (Will's explicit sequencing): RESEARCH FIRST, build second.
  1. Re-read the reference sets for member-labeling conventions (S94 finding:
     they label groups, not individuals; no cut-list table observed — so the
     cut list likely EXCEEDS local pro practice, a differentiator like our
     guard rail detail).
  2. Web-search: PPRBD framing-plan submittal requirements (their plan-review
     guide lists what the framing drawing must show); AWC DCA-6 prescriptive
     deck guide (canonical member sizing/span reference); cut-list and
     member-tagging conventions in deck/framing software (the screenshots
     resemble products in the RoomSketcher/decks.com/StruCalc space); whether
     any jurisdiction requires cut lists (almost certainly not — frame it as
     build-value, keep the permit sheets uncluttered).
  3. Hunt for MORE professional docs (Will asked explicitly) — real submitted
     deck sets with cut lists, framing-package examples from lumberyards
     (84 Lumber / Home Depot deck packages include cut lists).
  4. Then design: likely a NEW sheet (or the materials PDF upgraded into a
     labeled cut-list sheet) + optional member labels on the existing framing
     sheet. DESIGN QUESTION for Will: labels on the permit framing sheet
     itself (competitor style, busier) vs. a separate labeled shop-drawing
     sheet (keeps the permit sheet clean). Member lengths largely already
     exist implicitly (beam_layout/joist math, stair_utils stringer lengths);
     the work is grouping identical members into label classes, stable label
     assignment, and the table renderer.
- WHERE: `backend/drawing/draw_materials.py` (cut-list computation + sheet),
  `backend/drawing/draw_plan.py` framing panel (member labels, if Will wants
  them there), `backend/drawing/beam_layout.py` (member geometry source),
  `engine.js` (frontend estimator mirror — lockstep), possibly the 3D view
  label chips later (deck3d — coordinate with §8 mock-session activity).
- VERIFY: cut-list totals reconcile with the existing materials estimate
  (same lumber totals two ways = strong cross-check); parity with engine.js;
  add the new sheet to the structural golden; legibility gate on the table;
  Will's eyes on a render vs. the competitor screenshot.

### P1 — notch↔stair coupling in the editor (BLOCKED on Will's UX call)
- WHAT/WHY: notch and its stair must stay locked (same width, x-aligned); no
  orphan/misaligned notch creatable. Today convention only.
- WHERE: frontend editor (`app.js` / wizard). The in-product cutout+stair
  gesture wasn't confirmable from the clone — DEFER to Will on intended UX.
- HOW: stair placed on an edge → auto-create/align matching notch (and
  vice-versa); prevent width/offset drift.
- VERIFY: can't produce a broken config; backend receives aligned
  deckStairs+zones; parity + golden green.

### P2 — detector refinements (PRIORITY RAISED: rotated-text blind spot has
now caused TWO escaped defects, S93 + S94)
- **Rotated-text overlap detection.** pdfminer splits rotated labels into
  1-char fragments the overlap pass ignores. S94 stopgap = per-zone red-pixel
  counting (manual). Proper fix: LTChar-level clustering so rotated labels
  become tokens, OR a rasterized cross-color collision pass. WHERE:
  `tests/pdf/legibility_check.py`. Consider extending the gate to the details
  sheet once rotated text is handled (the S94 details fixes currently have NO
  regression guard — golden doesn't cover details, and the gate's overlap
  pass can't see rotated dims).
- **Details sheet in the golden.** Add `details` to golden SHEETS for the 5
  configs (+`--update`) so the S94 rework is pinned. Cheap, do early.
- **Contrast detector reversed-text refinement** (white-on-dark over-flags);
  gate contrast beyond the site plan once robust.
- **Other-sheet tiny text**: decide a floor, bump labels, extend gate.

### P3 — remaining site-plan / drawing polish
- **P1.d (carryover):** decking-label nudge on notched decks (gate on
  `cut_rects` so the golden only changes for notch configs); confirm DN arrow
  renders on the deck plan and reads DOWN (the S94 notch fix largely resolved
  the visual, but the label-nudge item remains unreviewed).
- **P1.e (pending Will):** stair tread style on framing — dashed reference vs
  full solid treads; match the reference framing sheets.
- **Notch outline style (NEW, S94 follow-up):** the notch keeps a dashed
  border on all 4 sides incl. across the stair mouth. Pro convention would be
  solid on the 3 real edges, nothing across the mouth. Raised with Will in
  S94; he didn't object to current state — treat as polish, pairs with P1.e.

### P4 — consolidation / completeness
- **Migrate inline stair resolution to the shared resolver (NEW).**
  deck3d.js, planView.js, elevationView.js, engine.js each inline their own
  deckStairs iteration/elevation math; zoneUtils.resolveAllStairs is now the
  canonical mirror. Migrate one consumer at a time; the parity test + Will's
  eyes on the 3D/elevation output are the check. CAUTION: the mock session
  executes production deck3d.js verbatim (§8) — a deck3d migration also
  changes the mock's 3D tab; verify both.
- Wire `compute_beam_layout` into the STEEL calc (steel notched decks still
  fall back to the legacy straight beam).
- Convert legacy `m_2zone_zonestairs_main_interior` matrix config (still
  `geom=False`) to `deckStairs`.

### P5 — bigger infra + cantilever
- Global cantilever ENFORCEMENT permit-check (≤ ¼ back-span) — needs Will's
  call (blanket 1.5 ft overhang exceeds ¼-span on decks < ~7.5 ft deep).
- Cantilever dimension label on framing (match references).
- Calibration notes (LVL beams, 4x4-vs-6x6 posts, Simpson models).

### P6 — product / UX (needs Will)
- Zoomable on-screen sheet preview (ARCH D shrunk to screen looks tiny;
  print is fine).

### Carryover (S88/S89)
- B7/B8 grade-line fix (one honest natural-grade line; bench-pad path?).
- Detectors G8/G9/G10.
- B11 (ledger can't attach to a house bump-out/bay/fireplace — needs a
  separate beam; both reference sets illustrate this exact issue in their
  margin notes).

---

## 5. KEY TRAPS & LEARNINGS (don't rediscover these)

- **CI EXISTS and is BIGGER than the local gate — and Railway autodeploys
  main ungated.** S94 shipped a details-sheet panel overflow that only CI's
  panel_check G5 oracle caught (the golden doesn't cover details; the
  legibility gate doesn't measure panel bounds). Run the CI-only checks
  locally before pushing; confirm CI green after pushing. The failure email's
  duration display can be misleading — read the run's step list via the API,
  not the email. [S94]
- **Rotated text is invisible to the overlap detector — twice burned.** Any
  "0 overlaps" claim is silent about rotated dims. Pixel-count the zone. [S93/S94]
- **The `view` tool is intermittent for renders** (worked 2×, failed 1× within
  S94). Attempt, never rely; state when you couldn't see. [S92–S94]
- **matplotlib: lines zorder 2 > patches zorder 1; equal zorder = insertion
  order.** A patch meant to cover lines must say `zorder=2` (and be added
  between the things it should sit between). [S94]
- **The reference sets contain code-text errors** (garbled rise/run note,
  ambiguous 12" MIN landing labels). Verify code claims against IRC/PPRBD,
  don't copy the reference verbatim. [S94]
- **Param key splits: wizard writes `railType`; legacy code read
  `railingType`.** When adding a params consumer, grep BOTH spellings; prefer
  reading via permit_spec. Similar splits may lurk elsewhere. [S94]
- **Details sheet has NO golden coverage** — a details regression is invisible
  to the gate today (see §4/P2). [S94]
- **Verification harnesses have bugs too** — a stub-React tree walker that
  didn't recurse into child ARRAYS reported zero stairs from correct code.
  When a probe says "nothing there", test the probe. [S94]
- **Use the STRUCTURAL GOLDEN, not a pixel hash, for the flat invariant.**
  [S90–S93]
- **Notch ↔ stair are coupled; interior wells aren't real decks.** [S93]
- **Backend + frontend geometry stay in lockstep — change both together, bump
  the buster.** sitePlanView is now lockstep (S94); deck3d/plan/elevation
  still inline (P4). [S92–S94]
- **`generate_blueprint_pdf` writes TWO PDFs**; use the returned `permit_id`.
  [S93]
- **legibility_check needs `pdfminer.six`** (not in reqs) + pdftoppm + Pillow.
  [S93]
- **Identify sheets by content, not page index/text-grep of titles.** [S91]
- **`node --check` can't parse JSX views; use @babel/standalone**; keep npm
  artifacts out of the repo. [S92]
- **`main` moves under you; expect the index.html buster conflict.** Re-run
  the FULL gate after every rebase. [S92–S94]
- **Demo/fixture configs: copy `_base()` from tests/test_notch_posts.py** —
  hand-built configs miss required keys (snowLoad etc.). [S94]

---

## 6. PENDING ON WILL (decisions that unblock work)

**Resolved in S94:** details sheet rework + notch fix + preview lockstep all
visually confirmed ("MUCH MUCH BETTER"); railing option confirmed to exist in
wizard (Fortress/Wood chip; labels now honor it).

**Still pending:**
- **NORTH STAR: homeowner vs contractor.** MASTER_CONTEXT/S84 says
  contractors; SBP_GTM_PLAN (Jul 2026) says permit-confused homeowners.
  UNRESOLVED — gates UX-mock porting and product decisions.
- **Editor UX for notch↔stair coupling** (P1) — the blocker for the top TODO.
- **Validate real parcel lookup accuracy** in the first target jurisdiction
  (the "we know your property" differentiator is stubbed).
- Stair tread style on framing (P1.e): dashed reference vs solid treads?
- Notch outline style (§4/P3): dashed box vs solid-3-sides/open-mouth?
- Notch-narrower-than-stair behavior: clamp or flag?
- Shallow-deck cantilever handling; B7/B8 grade convention.
- Have Billy (code-literate contact) sanity-read the S94 IRC citations on the
  details sheet before a real submittal — they came from the published IRC +
  PPRBD handouts, but a human code read is cheap insurance.
- Business: pricing; PPRBD mixed-size set acceptance; target town.
- **ROTATE THE PAT** used in S94 (visible in chat; rotation suggested).
- Real test address: Ilaria = 4739 Sweetgrass Lane, Colorado Springs CO 80922.

---

## 7. STANDING REMINDERS
- Ship one change / verify / continue. Prove plain decks unchanged via the
  STRUCTURAL GOLDEN; prove visual claims numerically (incl. pixel counts for
  rotated-text zones) + Will's eyes.
- Backend + frontend geometry lockstep; bump busters on JS edits; extend the
  parity test when touching shared geometry.
- Full 8-check gate before AND after changes, and after every rebase.
- PAT: transient helper only; sweep the actual token value; suggest rotation.
- Lead Will-facing summaries with plain-English what+why. Present renders.
  Wait for his confirm. End with retrospective + fresh context doc.

---

## 8. UX MOCK STATUS (S88.5 — separate session, pushes to `main`)

The mock session (clean-sheet journey redesign at simpleblueprints.xyz/mock)
was ACTIVE through S94: pushes 12–18. **IMPORTANT SCOPE CHANGE: it is no
longer mock-only.** Since push 13 it modifies PRODUCTION files:
`backend/static/js/deck3d.js` (photo materials theme, opt-in via
`window.SBP3D_THEME='photo'`, "default classic pixel-identical"), the
production 3D View's default camera + the PDF cover's capture3D angle
(pushes 14–15 — an actual production-output change), textures under
`backend/static/textures/`, and the shared index.html buster. Its mock 3D tab
executes production deck3d.js VERBATIM (push 12), which is why it reaches into
production. Practical impact: (a) rebase conflicts on index.html are routine;
(b) "confirm new commits are mock-only" is now "confirm they're mock +
deck3d/theme-scoped and claim classic-path safety"; (c) any P4 deck3d
consolidation work must be verified against BOTH the production 3D view and
the mock tab; (d) if the PDF cover's 3D view looks different, that was the
mock session's camera change, not a regression from this line of work.

**Strategic critique (still applies):** the mock redesigns the JOURNEY, not
the PRODUCT. Port the clear wins (SEO-real landing, free preview before
paywall); data-dependent items need real parcel lookup first; settle the
north star (§6) before porting to production.
