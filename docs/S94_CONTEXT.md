# SimpleBlueprints — MASTER CONTEXT & TODO (start-here for S94)

Single "hit the ground running" doc. Read §0 and §1 first, then work §4.
Self-contained: you should not need to reverse-engineer anything below.
Supersedes docs/S93_CONTEXT.md (finished S93 work is in §2, not §4).

Repo: `https://github.com/wilwixqa1/SimpleBlueprints` (public clone).
As of S93 close: `main` @ `8b8ed79` (S93 push 4). **`main` moves under you** — a
second "UX mock" (S88.5) session pushes to `main` concurrently (see §8); it was quiet
during S93 but can resume, so still expect to rebase. All suites green at S93 close
(8-check gate — see §0).

---

## 0. HOW TO WORK (anti-spiral rules + exact recipes)

**These are not optional. S90–S93 each lost time by ignoring them.**

### Inspection discipline (this is where trust is won or lost)
- **Identify a sheet by its DRAWING CONTENT, never by text-grepping the PDF.** "DECK PLAN"
  appears in the cover's drawing index (A-0), so `pdftotext | grep "DECK PLAN"` matches the
  COVER. To find the SITE PLAN page, grep for `"PROPOSED DECK"` (unique to it — this is how
  `legibility_gate.py::_site_page_index` finds it). Map by title block / body, not by page
  index (page order is config-dependent — see §3).
- **The `view` tool was UNRELIABLE for renders the WHOLE of S93** (returned an unreadable
  placeholder for most PNG crops; it rendered legibly maybe once out of many tries). Do NOT
  trust that you can see a render. The loop that actually works: **verify numerically
  (coordinates, pixel samples, text bboxes, hashes), then render → hand the PNG to Will →
  Will confirms.** Will caught real problems across S92/S93 that the tooling hid from the
  model. Never claim a visual confirm you didn't reliably make.
- **Numeric ways to verify a render without eyes (all used successfully in S93):**
  - *Stair placement:* extract the stair rect patches (facecolor `#e8d5b7`) and the deck
    rect (`#d4c4a0`) from the figure, convert to deck-local feet, assert the stair fills the
    notch / hangs off the right edge / etc. (see `/tmp/verify_aligned.py` pattern in §0 recipes).
  - *Text collisions / labels:* extract text-line bboxes with pdfminer and compute overlap %.
  - *Contrast (text lost on hatch):* rasterize with `pdftoppm`, map the text bbox to pixels,
    measure the dark-pixel fraction (see `legibility_check.contrast_flags`).
- **Trust the reference sets and running code over this document.** Every prior doc has had at
  least one wrong claim. VERIFY a documented plan against the actual code by running it before
  implementing. (S93 examples: the doc's "P1.c-remainder" was accurate, but the S93 model's
  own first multi-stair *test fixture* was unrealistic — notch and stair misaligned — which
  produced a "broken" render that was a fixture bug, not a code bug. Always sanity-check that
  a demo config is realistic before concluding the code is wrong.)
- **Visual checks still go through the harness where possible:**
  `python3 tests/pdf/render_review.py <set>` renders named configs to `/tmp/render_review/<set>/`.
  Select a PDF by its returned `permit_id`, never `ls -S`/size/recency. **Watch out:**
  `generate_blueprint_pdf` writes TWO PDFs (permit set + a 1-page materials PDF); `ls -t` can
  grab the materials PDF. Use the returned `permit_id` path explicitly.

### Verification techniques proven in S92–S93
- **Structural (vector) golden — THIS IS NOW THE FLAT-INVARIANT CHECK (see §2, P3 DONE).**
  `tests/pdf/golden_structural.py` captures the drawing PRIMITIVES each sheet emits (patch
  vertices, line/text coordinates, colors, linestyles, z-order) — deterministic from the deck
  config, immune to the matplotlib font-cache / anti-alias drift that made the old flat-pixel
  hash give false regressions. Workflow: after a draw change, run it; it prints exactly which
  `config/sheet` changed and the first differing primitive. If the change is intended, run
  `--update` and commit the regenerated golden alongside the change. **Adding configs/sheets
  is a one-line edit to `CONFIGS`/`SHEETS`, then `--update`.** Covers site/plan/framing across
  flat, edge-stair, notch+front-stair, multi-stair, side-stair. (Elevations intentionally
  omitted — ~1000 primitives, noisy; add if that sheet becomes active.)
- **Function-level parity (JS vs Python):** load a JS file in Node with a `window` shim
  (`global.window = {}; eval(fs.readFileSync(...))`) and compare its output to the Python
  equivalent. This is the committed `tests/test_frontend_parity.py` (runs
  `tests/geometry/parity_probe.js`).
- **Localize a render change:** diff two PNGs with PIL to find exactly what moved:
  `from PIL import Image, ImageChops; import numpy as np;
   d = np.asarray(ImageChops.difference(a,b)).sum(2); ys,xs = np.where(d>20)` → bbox of change.
- **JSX syntax check (browser-equivalent):** `npm install @babel/standalone` then
  `Babel.transform(code, {presets:['react']})` on each `.js` view file. `node --check` does
  NOT work on the JSX view files (planView/deck3d/elevationView/sitePlanView/steps/etc.).
  DELETE the `package.json`/`package-lock.json` it creates afterward; don't commit them.

### Environment setup
```
git clone https://github.com/wilwixqa1/SimpleBlueprints && cd SimpleBlueprints
pip install matplotlib==3.10.8 numpy==2.4.4 --break-system-packages       # render versions
grep -viE '^(matplotlib|numpy)==' backend/requirements.txt > /tmp/r.txt    # keep mpl/np pinned
pip install -r /tmp/r.txt --break-system-packages                          # ABOVE requirements
#   (a camelot-py/pillow warning is pre-existing and harmless; ignore it.)
pip install pdfminer.six --break-system-packages    # needed by legibility_check (NOT in reqs)
# poppler-utils (pdftoppm/pdftotext/pdfinfo), node, and Pillow are needed too.
```

### Green gate (run before AND after any change) — NOW 8 CHECKS
```
python3 tests/test_structural.py            # "All tests passed"
python3 tests/test_beam_layout.py           # "BEAM LAYOUT: all checks passed"
python3 tests/test_notch_posts.py           # "NOTCH POSTS: all checks passed"
python3 tests/pdf/config_matrix.py          # "MATRIX: 18 configs, 0 failure(s)"
(cd tests/geometry && node lotGeometry.test.js)       # passed: 2764  failed: 0
python3 tests/test_frontend_parity.py       # "FRONTEND PARITY: all checks passed"
python3 tests/pdf/golden_structural.py      # "GOLDEN STRUCTURAL: all N sheet fingerprints match" (S93/P3)
python3 tests/pdf/legibility_gate.py        # "LEGIBILITY GATE: passed" (S93; generates PDFs, ~10s)
```

### Flat / drawing invariant — USE THE STRUCTURAL GOLDEN (not a pixel hash)
The old advice was to render the flat set to PNG and sha256 it. **Do NOT do that anymore** —
that hash drifts within a session (font cache / AA) and gave false regressions three sessions
running. The permanent fix shipped in S93: `tests/pdf/golden_structural.py`. To prove a draw
edit left plain/existing decks untouched, just run the golden — if `flat/site`,
`edge_stair_front/*`, etc. are unchanged, they're byte-identical at the primitive level.
Intended changes: `--update` and commit the diff.

### Pushing to main
Will provides a GitHub PAT in-session. **NEVER store it** (not in files, not in `.git/config`,
not in memory). Push via a transient env-var credential helper, then verify + leak-sweep:
```
export SBP_PAT="<pat>"
git -c credential.helper='!f(){ echo username=x-access-token; echo "password=$SBP_PAT"; };f' \
  push origin HEAD:main
unset SBP_PAT
# leak sweep: grep for the ACTUAL token value, not the substring "ghp_"
git grep -n "<pat>" ; grep -rn "<pat>" .git/config
```
NOTE: the helper line emits a harmless `sh: Bad substitution` if you append a bash-ism like
`${PIPESTATUS[0]}` on the same line — the push still succeeds (check for the `old..new HEAD ->
main` line). `main` moves under you (mock session). If push is rejected non-fast-forward:
`git fetch origin main`, check `git diff --stat <yourbase>..origin/main` is mock-only (`uxmock_*`
+ `backend/static/uxmock/`; `main.py` changes should be additive mock endpoints only), then
`git rebase origin/main`, re-verify, push. **Beware a false "leak" alarm:** `git grep "ghp_"`
matches the example command inside older `docs/S9x_CONTEXT.md`; grep the real token value instead.
Commit granularly: `S<NN> push <k>: <plain-English what+why>`.
**Suggest Will rotate the PAT after the session** (it is visible in chat once used).

### Reporting to Will
Non-technical owner. LEAD every summary with plain-English "what it does + why"; codes
(P1.c/B10) are secondary. **Will is the visual ground truth** — present renders
(`present_files`) and WAIT for his confirm on anything you cannot verify numerically yourself
(and given the `view` tool is unreliable, that is most visual things). When Will describes a
problem, believe him and diagnose from code + his words rather than arguing from a render you
can't read. Ask before pushing when a prior result was disputed. End every session with a
retrospective + a fresh context doc like this one.

### Cache-busters (frontend edits ONLY)
`backend/static/index.html` loads each JS file with `?v=sXX`. **If you change a frontend JS
file you MUST bump its cache-buster** or the browser serves a stale cached copy (Will won't see
your change). Static `<script>` tags carry a per-file `?v=`; the deferred wizard files
(planView, deck3d, elevationView, sitePlanView, traceView, steps) share one `var v = "v=sXX"`
in the lazy loader. S92 bumped everything to `s92a`. Backend-only changes (draw_*, calc_engine,
etc.) do NOT need a bump. **S93 was backend-only (draw_site_plan.py + tests) — no bump. The next
frontend change (e.g. the sitePlanView mirror in §4) DOES need one.**

### Page composition & how to tell a notch from an edge stair
`_complex = len(params.get("zones", [])) > 0` in `main.py`. A **simple** deck (no zones) → 7
pages with a COMBINED "A-1 PLAN & FRAMING" sheet; site plan is A-5 (page 6). A **complex** deck
(has a cutout/zone) → 8 pages with plan and framing on SEPARATE sheets; site plan is A-6 (page
7). So page count (7 vs 8), or `get_cutout_rects(params)`, tells you if a deck is notched.
A plain "add front stair" via the wizard makes an EDGE stair (no cutout); a NOTCH requires the
explicit cutout tool. Confirm the deck actually has a cutout before judging notch behavior.

---

## 1. ORIENTATION (what this is + where things live)

SimpleBlueprints generates **IRC-2021 deck permit drawing sets** (PDF) from a deck config.
Jurisdiction focus: Colorado Springs / PPRBD. Beta; NO paying customers yet.
Sheets are drawn at **ARCH D (36"×24")** — set in `backend/drawing/sheet.py` (`_ACTIVE =
os.environ.get("SBP_SHEET", "arch_d")`; the "kept at letter" comment there is STALE). Fonts are
authored in points for a 14" sheet and scaled ~2.57× by `render_scale()` for ARCH D, so the
smallest labels print at ~11–13pt (a bit LARGER than the pro reference sets' ~0.3% of sheet
width). **On-screen the whole 3-ft sheet is shrunk to fit, which makes text look tiny — that is
a viewing artifact, not a print problem** (a zoomable preview is a UI follow-up, §4/§6).

(Line numbers drift; search by function name. Below is approximate.)

- Backend render pipeline: `backend/app/main.py::generate_blueprint_pdf(params)` -> returns
  `(permit_id, materials_id, calc, permit_report)` (4-tuple), writes `/tmp/blueprints/<id>.pdf`
  (permit set) AND a separate 1-page materials PDF. Sheet composition split by `_complex`.
- Structural engine: `backend/drawing/calc_engine.py::calculate_structure(params)`.
- `backend/drawing/beam_layout.py`: cutout-aware beam+posts + shared notch geometry:
  `front_edge_profile` (left→right `[x0,x1,edgeY]` segments; full-depth on a flat deck),
  `notched_deck_polygon`, `notch_headers`, `compute_beam_layout`. `EPS=1e-6`, `MIN_POST_SEP=2.0`.
- Plan+framing: `backend/drawing/draw_plan.py::draw_plan_and_framing` (`panels=("plan",)` /
  `("framing",)`). Computes `stair_openings` and passes to `get_exposed_edges` for the notch
  rail gap (P1.4a).
- Stairs: `backend/drawing/stair_utils.py` — `_front_edge_y_for_span` (shallowest front-edge y
  over an x-span = notch-back), `get_stair_placement_for_zone(stair, zone_rect,
  front_profile=None)` (notch anchor; angle 0=front, 90=right, 270=left),
  `compute_stair_geometry`, `resolve_all_stairs(params, calc)` → list of dicts with keys
  `stair, zone_rect, world_anchor_x, world_anchor_y (deck-LOCAL), angle, exit_side, stair_info,
  geometry, elevation_info`. Falls back to legacy `hasStairs` single-stair when no `deckStairs`.
- Zones/edges: `backend/drawing/zone_utils.py` — `get_additive_rects`, `get_cutout_rects`,
  `get_exposed_edges(params, stair_openings=None)`, `_get_cutout_rect` (handles `attachEdge`
  incl. `"interior"` = a mid-deck well; `"front"` always reaches the front edge because
  `y = depth - d`).
- **Site plan: `backend/drawing/draw_site_plan.py::draw_site_plan(fig, params, calc)`.
  CHANGED HEAVILY IN S93 (see §2). Deck origin: `z0_x = house_x + (house_w - deck_w)/2 +
  deck_offset`, `z0_y = house_y + house_d`; deck-local (x,y) → site `(z0_x+x, z0_y+y)`. The
  axes maps the whole LOT into the panel, so the site plan's x-scale and y-scale DIFFER
  (not equal aspect) — don't assume 1:1 feet when reading pixels.** As of S93 it iterates
  `resolve_all_stairs` (draws EVERY stair, notch-aware) and has legibility fixes (label plates,
  dimensions offset clear of stairs, fit-gated stair labels).
- Frontend (live preview; MUST mirror backend geometry — "lockstep"):
  - `stairGeometry.js`: `frontEdgeProfile`, `_frontEdgeYForSpan`, `getStairPlacementForZone`.
  - `zoneUtils.js`: `getExposedEdges`, `_subtractSegments`, `computeStairOpenings`,
    **and `resolveAllStairs`** (JS mirror of the Python resolver — used by deck3d/elevation).
  - Consumers pass notch-aware args: `planView.js`, `deck3d.js`, `elevationView.js`.
  - **`sitePlanView.js` is the on-screen site-plan preview. IT WAS NOT UPDATED FOR NOTCHES AND
    STILL DRAWS ONE LEGACY STAIR — it now DISAGREES with the S93 backend site plan. This is the
    top lockstep gap; see §4.**
  - `app.js::_syncFlatStairParams` mirrors the first zone-0 `deckStairs` entry into legacy
    `hasStairs`/`stairLocation`/... fields (so backend + site plan see the single stair).
- Tests / gate: see §0. NEW in S93: `tests/pdf/golden_structural.py` (+ `golden_structural.json`)
  and `tests/pdf/legibility_gate.py`; strengthened `tests/pdf/legibility_check.py`.

### Config shape (essentials)
Canonical deck `_base()` = 20×14 ledger deck, NO stairs (defined inline in the golden test and
in `tests/test_notch_posts.py`). Zones:
`{"id","type":"cutout"|"add","attachEdge":"front"|"front-left"|"interior"|...,"attachOffset",
"w","d","attachTo","interiorY"?}`. Stairs: ALWAYS use `deckStairs`:
`[{"id","zoneId","location":"front"|"left"|"right","offset","width","numStringers","template",
...}]` (or explicit `anchorX/anchorY/angle`). A front `cutout` maps to rect `{x: attachOffset,
y: depth - d, w, d}` — always reaches the front edge. **REALISTIC RULE (confirmed by Will
S93): a notch is ALWAYS filled by its stair — notch width == stair width AND they are
x-ALIGNED (a front stair at `offset o` centres at `W/2 + o`; the notch at `attachOffset a`
spans `[a, a+w]`; for the stair to fill it, `W/2 + o == a + w/2`). A misaligned notch/stair or
a notch with no stair is NOT a real deck** — don't demo those; if you see one it's a bad fixture.

---

## 2. CURRENT STATE (shipped through S93)

- **B10 notched-deck framing (S89):** beam+posts follow the notched edge; ¼-back-span
  cantilever; no post over the void; stepped beam, doubled header. Flat path byte-identical.
- **S90:** fixed coincident-post bug; matrix notch+stair configs use real `deckStairs`.
- **S91 P1.2 (backend stair anchor):** location-derived front stair anchors at the notch-back.
- **S91 P1.4a (backend notch rail):** `get_exposed_edges` wraps the guardrail around a front
  notch and opens it across the stair.
- **S92 P1.a (frontend parity):** preview stairs anchor at the notch + rail opens at stairs;
  `tests/test_frontend_parity.py` guards it.
- **S92 P1.c (site plan front notch stair):** site plan seats a FRONT stair in a FRONT notch.
- **S93 push 1 — P3 STRUCTURAL GOLDEN (infra).** `tests/pdf/golden_structural.py` +
  `golden_structural.json`. Environment-independent vector regression that REPLACES the flaky
  flat-pixel hash. Proven: stable across renders AND a font-cache clear; catches real geometry
  changes; leaves unaffected sheets constant. This is the permanent fix to the drift that cost
  time in S90–S92.
- **S93 push 2 — P1.c-remainder: SITE PLAN DRAWS ALL STAIRS.** `draw_site_plan` now iterates
  `resolve_all_stairs` (was a single legacy stair), so multi-stair and side-stair decks show
  every stair at its notch-aware placement, matching A-1/A-2. Single front/edge stair is
  byte-identical to before (proven via the golden). Interior "wells" left on the prior dashed
  path (see §3 — not a real feature).
- **S93 push 3 — SITE PLAN LEGIBILITY.** Fixed three real defects Will spotted: (a) house label
  ("EXISTING SINGLE FAMILY RESIDENCE") was dark text on black hatch → added a translucent white
  plate (measured region brightness 0.71 vs 0.53 bare hatch); (b) the rotated "12'" depth
  dimension clipped a right-side stair's "STAIRS" label → deck width/depth dimensions are now
  placed BEYOND any stair projecting on that edge (measured 0% overlap); (c) "STAIRS" overflowed
  a narrow 4' front-stair box → the label only draws when the box is wide enough (≥4.5'); tread
  lines + legend identify narrow stairs. Also nudged "PROPOSED DECK" below deck-centre (clears a
  front notch). Site-plan only; plan/framing byte-identical. **Will visually confirmed.**
- **S93 push 4 — LEGIBILITY CHECKER ON + STRONGER.** `legibility_check.py` (S85, the
  "words-on-top" detector) was never wired into the gate and only saw text-vs-text overlaps.
  Added a rasterized low-contrast detector (`contrast_flags`: flags text whose box is mostly
  dark pixels = lost on hatch; calibrated 0.45, normal ≤0.31, on-hatch ~0.58). Added
  `tests/pdf/legibility_gate.py` (new 8th gate check): generates PDFs for the 5 golden configs
  and FAILS on any text overlap on any page, and on tiny/low-contrast text on the SITE plan.
  Verified it FAILS when the house-label plate is removed (catches the exact S93 bug) and
  PASSES on shipped output.

**Verified in S93:** push 1 by stability + font-cache-clear + change-detection; push 2 by
byte-identity golden + numeric stair-placement extraction; push 3 by numeric bbox/overlap +
pixel-brightness sampling + Will's visual confirm; push 4 by the disable-plate regression test.

---

## 3. DOMAIN CONVENTIONS (what "correct" looks like)

A deck permit set needs: cover, deck plan, framing plan, elevations, stair detail, general
notes, site plan, attachment. Benchmark = the pro sets in `docs/reference_sets/` (Ilaria,
Loucks). North stars (Will): (a) PASS the permit, (b) LOOK professional enough that a
contractor feels safe submitting it.

**Sheet responsibilities:**
- **Deck plan (A-1):** architectural — decking, guardrail, FULL stair, "DN", dims. On a notched
  deck the stair sits in the notch and the rail wraps it.
- **Framing plan:** structural — joists, beam, posts/piers, ledger, blocking, hangers, stair
  structural interface. Concrete landing/patio belongs here (matches both reference sets).
- **Elevations:** height, guard/handrail, diagonal bracing X.
- **Site plan:** deck + stair projection to grade, dimensioned, setbacks/area tabulations.
  As of S93 it draws EVERY stair (notch-aware for front) and keeps labels/dimensions readable
  and non-overlapping. Schematic run math (rise 7.5", tread 10") is intentionally local to the
  site plan — the exact tread run lives on the stair-detail sheet.

**NOTCH ↔ STAIR are COUPLED (Will's ruling, S93 — this resolves a long-open question).**
A notch exists ONLY because a stair descends through it. Consequences:
- The stair must ALWAYS fill the notch (same width, x-aligned). A stair floating centre while
  the notch sits off to the side is WRONG.
- A "hole in the middle of the deck with no stair" (interior well) is NOT a real deck. Nobody
  builds one. So interior wells are not a feature to polish — the site plan leaves them on the
  old dashed reference box, and the interior-well guardrail work (old P1.b) is DOWN-PRIORITIZED
  (only matters if such a config can even be created).
- Stairs can descend front / left / right (and in theory back toward the house, though that's
  odd for a ledger deck). Front stairs create a front notch; side stairs descend from the edge
  (no notch needed).
- ENFORCING the coupling (so a user cannot create a misaligned or orphan notch) lives in the
  DECK EDITOR (frontend), not the drawing code — see §4.

**Two deck+stair topologies:**
- **(A) Edge notch / U-shape** — cutout reaches the front edge; rail wraps the notch, open where
  stairs descend. Handled on plan/framing (S91), preview stairs+rail (S92 P1.a), and site plan
  (S92 P1.c front + **S93 all stairs**). The on-screen **sitePlanView.js preview is NOT yet
  updated** (§4).
- **(B) Interior well** — cutout stops short of the edge. Per Will, not a real deck; de-scoped.

---

## 4. TODO (priority order; each: WHAT/WHY · WHERE · HOW · VERIFY)

### P0 — lockstep: on-screen site-plan preview disagrees with the PDF (NEW, top priority)
- WHAT/WHY: S93 fixed the backend site plan (`draw_site_plan.py`) to draw ALL stairs, notch-
  aware. The on-screen preview `backend/static/js/sitePlanView.js` was NEVER updated for
  notches and still draws ONE legacy stair from `p.hasStairs`/`p.stairLocation`/... So the live
  preview now disagrees with the printed site plan — exactly the class of bug P1.a existed to
  kill. This predates S93 (S92 P1.c was backend-only) but S93 widened it.
- WHERE: `backend/static/js/sitePlanView.js`, the `if (p.hasStairs && p.height > 0)` block
  (~L291) and the cutout/dimension drawing. There IS a JS `resolveAllStairs` in `zoneUtils.js`
  and the notch helpers in `stairGeometry.js` — `deck3d.js`/`elevationView.js` already use them.
- HOW: mirror the S93 backend change — iterate `window.resolveAllStairs(pz, calc?)` (see how
  deck3d does it), draw every stair with the notch-aware anchor, and mirror the legibility fixes
  (label plates, dimensions offset clear of stairs, fit-gated labels, "PROPOSED DECK" nudged).
  BUMP the cache-buster (shared lazy-loader `var v` for the deferred views) — this is a frontend
  edit. Extend `tests/test_frontend_parity.py` if feasible to cover the site-plan path.
- VERIFY: preview == PDF on multi/side/notch configs (numeric parity where possible); render
  both and hand to Will; golden + gate stay green; cache-buster bumped.

### P1 — notch↔stair coupling in the editor (NEW; Will's ruling, §3)
- WHAT/WHY: a notch and its stair must stay locked (same width, x-aligned); no orphan notch, no
  misaligned stair. Today it's convention, not enforced, so a user can build the broken thing.
- WHERE: the deck editor (frontend `app.js` / wizard). The exact in-product cutout+stair gesture
  wasn't confirmable from the clone — DEFER to Will on the intended UX before building.
- HOW: when a stair is placed on an edge, auto-create/align the matching notch (and vice-versa);
  prevent width/offset drift. Confirm the interaction model with Will first.
- VERIFY: can't produce a misaligned/orphan notch in the editor; backend still receives aligned
  `deckStairs` + zones.

### P2 — detector refinements (NEW; from S93 push 4)
- **Contrast detector reversed-text refinement.** `legibility_check.contrast_flags` over-flags
  white text on the cover's dark banner (readable) because it only measures dark-pixel fraction.
  So the gate only GATES contrast on the site plan (light bg) and merely REPORTS elsewhere. Make
  it robust to reversed text (measure contrast between the text strokes and their LOCAL
  background, or detect a strong light-glyph cluster) so it can gate globally. WHERE:
  `tests/pdf/legibility_check.py::contrast_flags`.
- **Rotated-text overlap blind spot.** pdfminer splits rotated dimension labels (e.g. "12'")
  into 1-char fragments that the overlap pass ignores; that's why the S93 "12' on STAIRS"
  collision wasn't auto-caught (fixed in the drawing instead). Consider char-level (LTChar)
  clustering so rotated labels are seen as one token.
- **Other-sheet tiny text.** Framing/elevations/details have genuinely tiny text (~3.5–3.9pt
  rendered). The gate reports but doesn't fail on it (out of S93 scope). Decide a floor and
  bump those labels, then extend the gate to gate tiny text on all pages.

### P3 — remaining site-plan / drawing polish
- **P1.d (carryover):** decking-label nudge on notched decks (gate on `cut_rects`; a global move
  trips the golden); confirm the DN arrow renders on the deck plan (not framing) and the plan
  stair reads as DOWN not up.
- **P1.e (pending Will):** stair tread style on framing — dashed reference vs full solid treads;
  match the reference framing sheets. (Concrete landing: KEEP.)

### P4 — consistency / completeness
- Wire `compute_beam_layout` into the STEEL calc (only WOOD now; steel notched decks fall back
  to the legacy straight beam).
- Convert legacy `m_2zone_zonestairs_main_interior` (still `geom=False`) to `deckStairs`.

### P5 — bigger infra + cantilever
- Global cantilever ENFORCEMENT permit-check (≤ ¼ back-span) — needs Will's call (a blanket
  1.5 ft overhang exceeds ¼-span on decks < ~7.5 ft deep).
- Cantilever dimension label on framing (match reference sets).
- Calibration notes (LVL/MicroLlam beams, 4x4-vs-6x6 posts, Simpson models).

### P6 — product / UX (needs Will)
- **Zoomable on-screen preview** — the sheets are ARCH D (36×24); shrunk to screen they look
  tiny even though print is fine. A zoom/pan preview would fix the review experience without
  bloating print fonts.

### Carryover (S88/S89)
- B7/B8 grade-line fix (one honest natural-grade line; consider deleting the bench-pad path).
- Detectors G8/G9/G10.
- B11 (ledger can't attach to a house bump-out/bay/fireplace — needs a separate beam).

---

## 5. KEY TRAPS & LEARNINGS (don't rediscover these)

- **The `view` tool could not read renders for most of S93.** Verify numerically and hand PNGs
  to Will; never claim a look you didn't take. [S92/S93]
- **Use the STRUCTURAL GOLDEN, not a pixel hash, for the flat/drawing invariant.** The pixel
  hash drifts within a session (font cache/AA). `golden_structural.py` is deterministic and
  env-independent. [S90–S93]
- **A "broken" render is often a bad TEST FIXTURE, not a code bug.** S93's first multi-stair demo
  had the notch and stair MISALIGNED (unrealistic) — the code was correct; the fixture wasn't.
  Sanity-check that a demo config is realistic (notch aligned with + filled by its stair) before
  concluding the drawing code is wrong. [S93]
- **Notch ↔ stair are coupled; a bare interior hole is not a real deck.** [S93 — Will]
- **The site plan reads LEGACY stair fields historically, but the BACKEND now uses
  `resolve_all_stairs` (S93).** The FRONTEND `sitePlanView.js` still uses legacy single-stair —
  they're out of lockstep (P0). [S93]
- **Backend + frontend geometry must stay in lockstep — change both together.** S92 P1.c and
  S93 push 2/3 changed only the backend site plan; `sitePlanView.js` was left behind. Don't
  repeat: when you touch site-plan geometry, touch the preview too (and bump the cache-buster).
  [S92/S93]
- **`generate_blueprint_pdf` writes TWO PDFs** (permit set + 1-page materials); `ls -t` can grab
  the materials PDF. Use the returned `permit_id` path. [S93]
- **pdfminer mangles rotated text** into 1-char fragments; the overlap detector ignores ≤1-char
  fragments, so rotated-dimension collisions can slip past it. [S93]
- **Contrast-by-dark-fraction over-flags reversed text** (white on a dark banner). Only trust it
  on light-background sheets until refined. [S93]
- **legibility_check needs `pdfminer.six`** (NOT in requirements.txt) and `contrast_flags` needs
  `pdftoppm` + Pillow + numpy. [S93]
- **Identify sheets by content, not text-grep** ("PROPOSED DECK" → site plan). [S91]
- **`node --check` can't validate JSX view files; use `@babel/standalone`.** Delete the
  package.json/lock it creates. [S92]
- **`deckStairs` vs legacy stair params:** `resolve_all_stairs` attaches `geometry` only for the
  `deckStairs` array; the legacy fallback has none. Use `deckStairs` in fixtures. [S91]
- **`main` moves under you** — the S88.5 mock session pushes concurrently (quiet during S93).
  Rebase; confirm new commits are mock-only before trusting your baseline. [S92]

---

## 6. PENDING ON WILL (decisions that unblock work)

**Resolved:** concrete landing on framing = KEEP; realistic fixture = notch width == stair width
AND aligned; **notch↔stair are COUPLED** (S93); **interior wells are not a real feature** (S93);
site plan draws all stairs (S93, confirmed).

**Still pending:**
- **NORTH STAR: homeowner vs contractor.** MASTER_CONTEXT/S84 says contractors; SBP_GTM_PLAN
  (Jul 2026) says permit-confused homeowners primary. UNRESOLVED — gates UX-mock porting and
  shapes structure/finishes/AI decisions. (Coupling now leans homeowner-first; worth confirming.)
- **Editor UX for notch↔stair coupling** (P1): the exact in-product gesture to create a
  notch-with-stair wasn't confirmable from the clone — confirm before building.
- **Validate real parcel lookup accuracy** in the first target jurisdiction (the "we know your
  property" differentiator + UX-mock #1/#5 rest on it; currently stubbed).
- Stair tread style on framing: dashed reference (recommended) vs full solid treads?
- Notch-narrower-than-stair behavior: clamp stair to notch, or flag?
- Shallow-deck cantilever handling (beam-at-edge vs smaller overhang)?
- B7/B8 grade convention (delete bench-pad path?).
- Business: contractor pricing ($49 beta / $99 standard?); confirm PPRBD accepts a mixed-size
  set (36×24 drawings + letter form); target town.
- **ROTATE THE PAT** used across S93 pushes (visible in chat).
- Real test address in hand: Ilaria = 4739 Sweetgrass Lane, Colorado Springs CO 80922.

---

## 7. STANDING REMINDERS
- Ship one change / verify / continue. Prove plain/existing decks unchanged after any draw edit
  via the STRUCTURAL GOLDEN (not a pixel hash).
- Backend + frontend geometry must stay in lockstep; change both together; bump the frontend
  cache-buster on any JS edit. The parity test guards the plan/deck3d/elevation notch path —
  extend it (and add the site-plan preview) when you touch that geometry.
- Run the full 8-check green gate before AND after changes.
- PAT: Will provides in-session; NEVER store it; push via transient env-var helper; sweep for
  the real token value; suggest rotation afterward.
- Lead Will-facing summaries with plain-English "what it does"; codes secondary. Present
  handoff + renders. Wait for Will's visual confirm on anything you can't verify yourself. End
  every session with a retrospective + a fresh context doc.

---

## 8. UX MOCK STATUS (S88.5 — separate session, pushes to `main`)

A separate session builds a clean-sheet redesign of the user journey (the "mock"), live under
`simpleblueprints.xyz/mock`. Code: `backend/static/uxmock/` + additive `uxmock_*` endpoints in
`main.py` (in a fenced revert block). It was QUIET during S93 (no mock commits since `cb67459`),
but can resume. **Practical impact:** `main` may get ahead of your clone; rebase and confirm new
commits are mock-only (`uxmock_*` + `backend/static/uxmock/`) before trusting your baseline.

**Strategic critique (still applies):** the mock redesigns the JOURNEY, not the PRODUCT (real
PDF/compliance/parcel lookup are stubbed there). PORT the clear wins under either audience —
SEO-real static landing, free preview of all sheets before paywall. Data-dependent (needs real
parcel lookup): address-as-hero, live setback violations. RECONSIDER: asking homeowners for snow
load / frost depth (derive from address); the acting AI drafter (right idea, wrong priority,
highest risk). BIGGEST RISK: the differentiator depends on parcel/GIS accuracy that is stubbed —
validate against real addresses first. SETTLE the north star (§6) before porting to production.
