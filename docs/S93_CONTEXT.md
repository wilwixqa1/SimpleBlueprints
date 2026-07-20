# SimpleBlueprints — MASTER CONTEXT & TODO (start-here for S93)

Single "hit the ground running" doc. Read §0 and §1 first, then work §4.
Self-contained: you should not need to reverse-engineer anything below.
Supersedes docs/S91_CONTEXT.md and the (never-committed) S92 start-doc — both are now
partly stale; finished S92 work is described in §2, not §4.

Repo: `https://github.com/wilwixqa1/SimpleBlueprints` (public clone).
As of S92 close: `main` @ `7600e7e` (S92 push 3, P1.c). **`main` moves under you** — a
second "UX mock" (S88.5) session pushes to `main` concurrently (see §8); expect to rebase.
All suites green at S92 close.

---

## 0. HOW TO WORK (anti-spiral rules + exact recipes)

**These are not optional. S90, S91, and S92 each lost time by ignoring them.**

### Inspection discipline (this is where trust is won or lost)
- **Identify a sheet by its DRAWING CONTENT, never by text-grepping the PDF.** "DECK PLAN"
  appears in the cover's drawing index (A-0), so `pdftotext | grep "DECK PLAN"` matches the
  COVER. To find the SITE PLAN page, grep for `"PROPOSED DECK"` (unique to it). Map by title
  block / body, not by page index (page order is config-dependent — see §3).
- **Separate "numerically verified" from "visually confirmed", and NEVER claim a visual
  confirm you didn't do.** In S92 my image-reading of the thin site-plan / PDF renders was
  unreliable the WHOLE session — the `view` tool kept returning placeholders I couldn't read.
  The loop that actually worked: *verify numerically (hashes, pixel diffs, geometry), then
  render → hand the PNG to Will → Will confirms.* Will caught two real problems I could not
  see. Do this by default; do not narrate a look you didn't take.
- **Trust the reference sets and running code over this document.** S91's doc was wrong about
  the concrete landing; S92's doc was wrong about P1.a's "main task" (see §2/§5). Before
  implementing a documented plan, VERIFY it against the actual code by running it. Two S92
  examples: the doc said to port `notchedDeckPolygon` into the JS for the rail — but the JS
  rail already wrapped notches, so that work was unnecessary; and the doc treated P1.c's
  stair-anchor and deck-outline as separable, but the outline half turned out to be REQUIRED
  (the stair was hidden behind the deck fill until the notch became a real gap).
- **Visual checks go through the harness:** `python3 tests/pdf/render_review.py <set>` renders
  named configs to `/tmp/render_review/<set>/` as per-page PNGs. `notch_front_stair` is the
  reference notched-deck+stair set (8 pages). Don't hand-roll `pdftoppm` against random PDFs.
- **Select a PDF by its returned `permit_id`**, never `ls -S`/size/recency.
- **When uncertain, get certain with ONE clean render (or the geometry/pixels), then present.**

### Useful verification techniques proven in S92
- **Function-level parity (JS vs Python):** load a JS file in Node with a `window` shim
  (`global.window = {}; eval(fs.readFileSync(...))`) and compare its output to the Python
  equivalent on the same config. This is how P1.a was verified and is now the committed
  `tests/test_frontend_parity.py` (runs `tests/geometry/parity_probe.js`).
- **Byte-identity of a render:** render a page to PNG at fixed DPI and sha256 it; compare
  before/after. Use this to prove "flat/plain decks unchanged" after a draw edit.
- **Localize a render change:** diff two PNGs with PIL to find exactly what moved:
  `from PIL import Image, ImageChops; import numpy as np;
   d = np.asarray(ImageChops.difference(a,b)).sum(2); ys,xs = np.where(d>20)` → bbox of change,
  then sample colors in that bbox. Used in S92 to prove the site-plan change was localized to
  the notch/stair region and nowhere else.
- **JSX syntax check (browser-equivalent):** `npm install @babel/standalone` then
  `Babel.transform(code, {presets:['react']})` on each `.js` view file. `node --check` does
  NOT work on the JSX view files (planView/deck3d/elevationView/steps/etc.); use Babel.
  (This installs `node_modules` (gitignored) + `package.json`/`package-lock.json` — DELETE the
  latter two after; don't commit them.)

### Environment setup
```
git clone https://github.com/wilwixqa1/SimpleBlueprints && cd SimpleBlueprints
pip install matplotlib==3.10.8 numpy==2.4.4 --break-system-packages       # render versions
grep -viE '^(matplotlib|numpy)==' backend/requirements.txt > /tmp/r.txt    # keep mpl/np pinned
pip install -r /tmp/r.txt --break-system-packages                          # ABOVE requirements
#   (a camelot-py/pillow warning is pre-existing and harmless; ignore it.)
# poppler-utils (pdftoppm/pdftotext/pdfinfo) and node are needed too.
```

### Green gate (run before AND after any change)
```
python3 tests/test_structural.py            # "All tests passed"
python3 tests/test_beam_layout.py           # "BEAM LAYOUT: all checks passed"
python3 tests/test_notch_posts.py           # "NOTCH POSTS: all checks passed"
python3 tests/pdf/config_matrix.py          # "MATRIX: 18 configs, 0 failure(s)"
(cd tests/geometry && node lotGeometry.test.js)       # passed: 2764  failed: 0
python3 tests/test_frontend_parity.py       # "FRONTEND PARITY: all checks passed" (S92, needs node)
```

### Flat-invariant hash (flat/no-zone permit set must not change on a draw edit)
Render the 20x14 ledger no-zone permit PDF at r=80, sha256 of concatenated page PNGs
(config = `test_notch_posts._base()`, no zones/stairs, 7 pages).
**WARNING (S92 finding): the absolute value is NOT stable even within one session.** In S92 it
drifted `9766a0ce039d19a9` → `0c774dc7e21f40d0` at the SAME commit, from a matplotlib font
cache / anti-alias shift. So do NOT trust an absolute baseline captured earlier. Instead, use a
**relative** check in the current environment at the current moment: render the flat set at
`origin/main` (or a stashed clean tree) AND at your HEAD, back-to-back, and assert the two are
equal. The `_base()` config has no stairs, so the stair code never runs and the flat hash is
usually only touched by deck-outline / structural draw changes. **The permanent fix is P3
(golden-file regression); this session's pain is the argument for prioritizing it.**
Reusable scratch (NOT committed — recreate `/tmp/flat_hash.py`): add `backend` and `tests` to
`sys.path`, `from app.main import generate_blueprint_pdf, PDF_DIR`, `from test_notch_posts
import _base`, render `_base()` with `pdftoppm -r 80`, sha256 first 16 hex, select PDF by the
RETURNED `permit_id`. (Import path: `sys.path.insert(0, "<repo>/backend")` then
`from app.main import ...`, because `main.py` does `from drawing... import ...`.)

### Site-plan byte-identity scratch (S92, recreate as needed)
To prove a site-plan change leaves plain decks untouched: build an EDGE-stair 27x12 config
(`hasStairs=True, stairLocation="front", stairWidth=4` + a matching `deckStairs` entry, NO
`zones`), `generate_blueprint_pdf`, find the site page via `"PROPOSED DECK"` grep, `pdftoppm
-r 100 -png`, sha256. Edge site plan hashed `8e2f5b1019436b6f` at S92 close (env-local).

### Pushing to main
Will provides a GitHub PAT in-session. **NEVER store it** (not in files, not in `.git/config`,
not in memory). Push via a transient env-var credential helper, then verify:
```
export SBP_PAT="<pat>"
git -c credential.helper='!f(){ echo username=x-access-token; echo "password=$SBP_PAT"; };f' \
  push origin HEAD:main
unset SBP_PAT
# leak sweep: grep for the ACTUAL token value, not the substring "ghp_"
git grep -n "<pat>" ; grep -rn "<pat>" .git/config
```
`main` moves under you (mock session). If push is rejected non-fast-forward: `git fetch origin
main`, check `git diff --stat <yourbase>..origin/main` is mock-only (`uxmock_*` + `backend/
static/uxmock/`; the `main.py` changes are additive mock endpoints only — check the `@@` hunk
headers name `uxmock_*` funcs, not `generate_blueprint_pdf`), then `git rebase origin/main`,
re-verify, push. **Beware a false "leak" alarm:** `git grep "ghp_"` matches the example command
inside `docs/S91_CONTEXT.md`; grep the real token value instead.
Commit granularly: `S<NN> push <k>: <plain-English what+why>`.
Suggest Will rotate the PAT after the session (it is visible in chat once used).

### Reporting to Will
Non-technical owner. LEAD every summary with plain-English "what it does + why"; codes
(P1.2/B10) are secondary. Present handoff/context + renders (`present_files`) in addition to
committing. Ask before pushing when a prior result was disputed; wait for Will's visual
confirm on anything you cannot verify visually yourself. End every session with a retrospective.

### Cache-busters (frontend edits ONLY — S92 learning)
`backend/static/index.html` loads each JS file with `?v=sXX`. **If you change a frontend JS
file you MUST bump its cache-buster or the browser serves a stale cached copy** (Will won't see
your change). Static `<script>` tags carry a per-file `?v=`; the deferred wizard files
(planView, deck3d, elevationView, sitePlanView, traceView, steps) share one `var v = "v=sXX"`
in the lazy loader. S91 (backend only) didn't touch this; S92 bumped everything to `s92a`.
Backend-only changes (e.g. `draw_*`, `calc_engine`) do NOT need a bump.

### Page composition & how to tell a notch from an edge stair (S92)
`_complex = len(params.get("zones", [])) > 0` in `main.py`. A **simple** deck (no zones) → 7
pages with a COMBINED "A-1 PLAN & FRAMING" sheet; site plan is A-5 (page 6). A **complex** deck
(has a cutout/zone) → 8 pages with plan and framing on SEPARATE sheets; site plan is A-6 (page
7). So **page count (7 vs 8), or `get_cutout_rects(params)`, tells you if a deck is notched.**
A plain "add front stair" via the wizard makes an EDGE stair (no cutout); a NOTCH requires the
explicit cutout tool. (Will's early S92 "test" was an edge stair, so it never exercised the fix
— confirm the deck actually has a cutout before judging notch behavior.)

---

## 1. ORIENTATION (what this is + where things live)

SimpleBlueprints generates **IRC-2021 deck permit drawing sets** (PDF) from a deck config.
Jurisdiction focus: Colorado Springs / PPRBD. Beta; NO paying customers yet.
(Line numbers below drift as files change — search by function name; lines are approximate.)

- Backend render pipeline: `backend/app/main.py::generate_blueprint_pdf(params)` -> returns
  `(permit_id, materials_id, calc, permit_report)` (4-tuple; the docstring saying 3 is stale),
  writes `/tmp/blueprints/<id>.pdf`. Sheet composition split by `_complex` (see §0).
- Structural engine: `backend/drawing/calc_engine.py::calculate_structure(params)`.
- **`backend/drawing/beam_layout.py`** cutout-aware beam+posts + shared notch geometry:
  `front_edge_profile` (left→right `[x0,x1,edgeY]` segments; full-depth on a flat deck),
  `notched_deck_polygon` (CCW vertex loop of the notched main-deck outline, or None if no
  front cutout), `notch_headers`, `compute_beam_layout`. `EPS = 1e-6`, `MIN_POST_SEP = 2.0`.
- Plan+framing drawing: `backend/drawing/draw_plan.py::draw_plan_and_framing` (takes
  `panels=("plan",)` / `("framing",)`). Computes `stair_openings` from resolved stairs and
  passes them to `get_exposed_edges` for the notch rail gap (P1.4a).
- Stairs: `backend/drawing/stair_utils.py` — `_front_edge_y_for_span` (shallowest front-edge y
  over an x-span = notch-back), `get_stair_placement_for_zone(stair, zone_rect,
  front_profile=None)` (P1.2 notch anchor), `compute_stair_geometry`, `resolve_all_stairs`
  (reads `deckStairs`; supplies the main-deck front profile for zone 0 only; falls back to
  legacy `hasStairs`).
- Zones/edges: `backend/drawing/zone_utils.py` — `get_additive_rects`, `get_cutout_rects`,
  `get_exposed_edges(params, stair_openings=None)` (notch-aware rail via
  `notched_deck_polygon`; subtracts `stair_openings`), `_subtract_segments`,
  `_segments_overlap`, `_chamfered_vertices`, `_get_zone_corners`.
- Site plan: `backend/drawing/draw_site_plan.py::draw_site_plan(fig, params, calc)`.
  **S92 P1.c changed this:** the main deck is drawn as `notched_deck_polygon` when there's a
  front cutout (a real gap), the dashed white overlay box is SKIPPED for front-reaching
  cutouts (kept for interior wells), and the FRONT stair anchors at the notch-back via
  `front_edge_profile` + `_front_edge_y_for_span`. Deck origin: `z0_x = house_x +
  (house_w - deck_w)/2 + deck_offset`, `z0_y = house_y + house_d`; deck-local (x,y) → site
  (z0_x+x, z0_y+y), 1:1 feet. **Still on the LEGACY path:** the stair is read from
  `hasStairs`/`stairLocation`/`stairWidth`/`stairOffset` (not `deckStairs`), so only ONE stair
  draws and only FRONT stairs get the notch anchor; side/multi-stair use the old full-depth
  routine (tread=10 vs 10.5 elsewhere). See §4 P1.c-remainder.

- Frontend (live preview; MUST mirror backend geometry):
  - `stairGeometry.js`: **S92 added** `frontEdgeProfile(width, depth, cutRects)` and
    `_frontEdgeYForSpan(...)` (line-by-line ports of the Python), and gave
    `getStairPlacementForZone(stair, zoneRect, frontProfile)` an optional 3rd arg — a front
    stair on zone 0 with a front cutout now anchors at the notch-back. Exports
    `window.frontEdgeProfile`.
  - `zoneUtils.js`: `getExposedEdges(p, stairOpenings)` (**S92 added** the 2nd arg + a phase-3
    subtraction of stair openings), `_subtractSegments`, and `computeStairOpenings(p)`
    (**S92 added** — mirrors `draw_plan`'s opening computation; front stairs on notched
    decks). Exports `window.computeStairOpenings`. NOTE: this file's `getExposedEdges` uses an
    OCCUPANCY/CELL-SCAN algorithm, structurally DIFFERENT from the Python vertex-loop — they
    produce equivalent edges but are NOT line-by-line mirrors (see §5).
  - Consumers pass the new args: `planView.js` (stair placement ~L356 passes profile for zone
    0; rail memo ~L43 passes `computeStairOpenings`), `deck3d.js` (~L207 profile, ~L130
    openings), `elevationView.js` (~L183 profile). `app.js` `cAdj` rail-length (~L786) was
    LEFT ALONE (it already subtracts stair width; passing openings would double-count).
    `app.js::_syncFlatStairParams` mirrors the first zone-0 `deckStairs` entry into the legacy
    `hasStairs`/`stairLocation`/... fields (so backend + site plan see them).
- Tests: `tests/test_structural.py`, `test_beam_layout.py`, `test_notch_posts.py` (incl. S91
  P1.2/P1.4a numeric checks), `tests/pdf/config_matrix.py`, `tests/geometry/lotGeometry.test.js`,
  and **S92:** `tests/test_frontend_parity.py` (+ `tests/geometry/parity_probe.js`) — runs the
  preview JS and the backend on shared notch/stair configs and asserts profile/anchor/openings/
  edges agree, so P1.a can't silently drift. Visual harness: `tests/pdf/render_review.py`.

### Config shape (essentials)
`_base()` (in `tests/test_notch_posts.py`) = canonical 20x14 ledger deck, NO stairs. Zones:
`{"id","type":"cutout"|"add","attachEdge":"front"|"front-left"|...,"attachOffset","w","d",
"attachTo"}`. Stairs: ALWAYS use `deckStairs`:
`params["deckStairs"] = [{"id","zoneId","location","offset","width","numStringers","template",
...}]` (or explicit `anchorX/anchorY/angle`). **Realistic rule:** notch width == stair width.
A front `cutout` maps to rect `{x: attachOffset, y: depth - d, w, d}` (reaches the front edge
when `y + d == depth`). Backend zone-0 dims come from `params["width"]/["depth"]`; JS from
`p.deckWidth/p.deckDepth`. The editor sets both `deckStairs` and the synced legacy fields.

---

## 2. CURRENT STATE (shipped through S92)

- **B10 notched-deck framing (S89):** beam+posts follow the notched edge; auto ¼-back-span
  cantilever; no post over the void; stepped beam, doubled header. Flat path byte-identical.
- **S90:** fixed coincident-post bug (single centered post when end posts would be
  < MIN_POST_SEP); matrix notch+stair configs use real `deckStairs`.
- **S91 P1.2 (backend stair anchor):** a location-derived `front` stair anchors at the real
  front edge (notch-back) across its footprint, not full depth over the void.
- **S91 P1.4a (backend notch rail):** `get_exposed_edges` wraps the guardrail around a front
  notch and removes the rail across the stair opening (`stair_openings`). Plan-only; framing
  untouched; flat byte-identical.
- **S92 P1.a — FRONTEND PARITY (preview == PDF on notched decks).** Pushed `main`.
  - Key finding: the preview guardrail ALREADY wrapped notches (the JS occupancy-scan does it
    natively), so the doc's headline task (port `notchedDeckPolygon` for the rail) was
    UNNECESSARY and was skipped. The two REAL gaps were fixed:
    1. **Stair anchor:** ported `frontEdgeProfile` + `_frontEdgeYForSpan` into
       `stairGeometry.js`; `getStairPlacementForZone` takes a `frontProfile`; the 3 stair
       callers pass it for zone 0. A notched front stair now anchors at the notch-back in the
       preview, matching the PDF (was floating at full depth over the void).
    2. **Rail opening:** `zoneUtils.js::getExposedEdges` takes `stairOpenings`; added
       `_subtractSegments` + `computeStairOpenings`; the 2 rail callers (planView/deck3d) pass
       them. The preview rail now opens at the stairs (was a solid bar across the steps).
  - Added `tests/test_frontend_parity.py` + `tests/geometry/parity_probe.js` (anti-drift).
  - Bumped `index.html` cache-busters to `s92a`. Flat PDF pipeline untouched.
- **S92 P1.c — SITE PLAN notch stair.** Pushed `main` (`7600e7e`).
  - The site plan drew the front stair at FULL DEPTH (outer edge) from the legacy `hasStairs`
    path, and drew the deck as a full rectangle with a white dashed cutout box — with the
    stair at a LOWER zorder than the deck fill, so the stair's notch portion was HIDDEN. Net
    effect: the stair "hung off the outer edge / went up to nothing."
  - Fix: (a) anchor the FRONT stair at the notch-back via `front_edge_profile` +
    `_front_edge_y_for_span` (same value the plan sheet uses); (b) draw the main deck as a
    true `notched_deck_polygon` (real gap) and SKIP the dashed overlay box for front-reaching
    cutouts (kept for interior wells). Now the stair fills the notch and meets the deck.
  - Plain/rectangular decks byte-identical (edge site plan `8e2f5b1019436b6f` before/after).
  - **Scope shipped:** FRONT stairs + FRONT-reaching notches only.
- **Verified in S92:** P1.a by function-level JS/Python parity on 6 configs + the committed
  parity test; P1.c by byte-identity (flat), localized pixel-diff, matching numeric anchors,
  AND Will's visual confirm on the rendered site plan vs plan sheet.

---

## 3. DOMAIN CONVENTIONS (what "correct" looks like)

A deck permit set needs: cover, deck plan, framing plan, elevations, stair detail, general
notes, site plan, attachment. Benchmark = the pro sets in `docs/reference_sets/` (Ilaria,
Loucks). North stars (Will): (a) PASS the permit, (b) LOOK professional enough that a
contractor feels safe submitting it.

**Sheet responsibilities:**
- **Deck plan (A-1):** architectural. Decking, guardrail, FULL stair (treads, landing, "DN",
  dims). On a notched deck the stair sits in the notch and the rail wraps it (S91 P1.4a).
- **Framing plan:** structural — joists, beam, posts/piers, ledger, blocking, hangers, and the
  stair's structural interface (opening header/trimmers, landing/stringer support). The
  concrete landing/patio DOES belong here (matches both reference sets — S91 corrected this).
  Open: light-dashed reference vs full solid treads on framing (see §6).
- **Elevations:** height, guard/handrail, diagonal bracing X (plan shows only a dashed
  bay-marker + "SEE ELEVATIONS").
- **Site plan:** deck + stair projection to grade, dimensioned, with setbacks/area
  tabulations. As of S92 a front notch is drawn as a real cut with the stair filling it.

**Two deck+stair topologies:**
- **(A) Edge notch / U-shape** — cutout REACHES the front edge; deck wraps 3 sides; railing
  wraps the notch, open where the stairs descend. Handled on plan/framing (S91) AND preview
  (S92 P1.a) AND site plan front stairs (S92 P1.c).
- **(B) Interior well** — cutout stops short of the edge; deck continuous around a hole. **STILL
  NOT HANDLED for the rail:** `get_exposed_edges` falls back to the closed rectangle with NO
  rail around the interior hole (a real fall-hazard gap). Site plan still draws the dashed box
  for these. See §4 P1.b.

**Stair placement (north star): edge-stairs first.** Stairs normally descend from a deck EDGE;
notching for stairs is the less common case and comes ONLY from the explicit cutout tool (a
plain "add stair" snaps to an edge and does not notch). The exact in-product cutout gesture was
not confirmable from the clone; defer to Will on live UX.

---

## 4. TODO (priority order; each: WHAT/WHY · WHERE · HOW · VERIFY)

### P1 — finish the notch/stair correctness thread

**P1.c-remainder — the rest of the site plan (natural next step).**
- WHAT/WHY: S92 fixed FRONT stairs + front notches on the site plan, but the site plan still
  reads the LEGACY single-stair fields (`hasStairs`/`stairLocation`/`stairWidth`/`stairOffset`),
  so (1) only ONE stair draws — multi-stair decks lose the rest; (2) SIDE stairs still anchor
  with the old full-depth routine and cruder tread=10 (vs 10.5); (3) interior-well cutouts
  still show the dashed box, not a real outline.
- WHERE: `draw_site_plan.py` stair block (the `if has_stairs:` section, ~L517) and the deck /
  cutout drawing loop (~L428–472).
- HOW: replace the legacy `has_stairs` block with `resolve_all_stairs(params, calc)` (it has
  `calc`), iterate ALL resolved stairs, and draw each projection at `z0_x + world_anchor_x`,
  `z0_y + world_anchor_y` with the resolved width/angle/exit_side. Keep the site-plan
  projection STYLE (dashed rect + tread lines + landing + label + run dim). To preserve flat
  byte-identity while switching source, keep the local run math OR verify the edge hash
  (`8e2f5b…`) is unchanged. For interior wells, draw the real inner outline instead of the box.
- VERIFY: flat/edge site plan byte-identical; multi-stair + side-stair notched configs render
  with every stair in the right place; matrix stays 0 failures; hand renders to Will.

**P1.b — matrix tests for topologies + handle case (B) interior well.**
- WHAT/WHY: nothing in the matrix asserts the notch topologies, so P1.2/P1.4a/P1.a could
  silently regress; and interior-well decks get NO rail around the hole (fall hazard).
- WHERE: `tests/pdf/config_matrix.py`; `zone_utils.py::get_exposed_edges` (interior path) +
  `draw_plan.py` rail; the JS mirror in `zoneUtils.js`.
- HOW: add a case-(A) front-reaching U-notch config AND a case-(B) interior well; assert the
  body outline BREAKS in A and stays CLOSED in B, and that A wraps/opens correctly. Extend
  `get_exposed_edges` (and the JS mirror + the parity test) to emit the interior opening's four
  edges as exposed (rail around the hole), with a header per convention.
- VERIFY: matrix 0 failures; parity test still passes; render both topologies.

**P1.d — small polish (cheap).**
- Decking-label nudge: on a notched deck the "1 x 6 COMPOSITE DECKING" label can land on the
  notch-back line — move it clear ONLY for notched decks (gate on `cut_rects`; a global move
  trips the flat hash). WHERE: the decking `ax.text` in `draw_plan.py` plan branch.
- DN arrow: confirm it renders on the deck plan and not the framing, then close the stale S89
  "no DN marker" TODO. (Will noted the plan stair can read as "going up" vs the DOWN arrow —
  low priority perception check; verify tread/nosing direction reads correctly.)

**P1.e — stair tread style on framing (pending Will).** Dashed reference vs full solid treads
on the framing sheet — check the reference framing sheets and match. (Concrete landing: KEEP.)

### P2 — consistency / completeness
- Wire `compute_beam_layout` into the STEEL calc (only WOOD now; steel notched decks fall back
  to the legacy straight beam and are un-fixed).
- Convert legacy `m_2zone_zonestairs_main_interior` (still `geom=False`) to `deckStairs`.

### P3 — infra + cantilever + polish
- **Golden-file PDF regression — NOW HIGH PRIORITY.** S92 proved the flat pixel hash drifts
  WITHIN a session (font-cache/AA), not just across containers, and it cost real time twice.
  A committed golden-file (or vector/structural) regression that is environment-independent
  would end this. Do this before more draw work if possible.
- Global cantilever ENFORCEMENT permit-check (≤ ¼ back-span) — needs Will's call (blanket
  1.5 ft overhang exceeds ¼-span on decks < ~7.5 ft deep; would flag existing decks).
- Cantilever dimension label on framing (match reference sets).
- Calibration notes (LVL/MicroLlam beams, 4x4-vs-6x6 posts, Simpson models) so output reads
  like the reference sets.

### Carryover (S88/S89)
- B7/B8 grade-line fix (one honest natural-grade line; consider deleting the bench-pad path;
  zero the grandfathered `test_post_grade.py` KNOWNs).
- Detectors G8/G9/G10.
- B11 (ledger can't attach to a house bump-out/bay/fireplace — needs a separate beam).

---

## 5. KEY TRAPS & LEARNINGS (don't rediscover these)

- **Identify sheets by content, not text-grep** ("DECK PLAN" is on the cover index; use
  "PROPOSED DECK" to find the site plan). [S91]
- **Never claim a visual confirm you didn't do.** In S92 the `view` tool consistently failed to
  render the thin site-plan/PDF PNGs legibly for me; hand renders to Will and verify
  numerically. Will caught two real defects I couldn't see. [S92]
- **This doc / prior docs can be WRONG — verify against running code first.** S91's landing
  claim and S92's P1.a "main task" were both wrong; S92's P1.c was under-scoped (the outline
  half was mandatory, not optional). Run it before you build it. [S91/S92]
- **JS `getExposedEdges` and Python `get_exposed_edges` use DIFFERENT algorithms** (JS
  occupancy/cell scan; Python vertex loop). They produce equivalent edges but are NOT
  line-by-line mirrors — do not assume parity from structure; verify by running both (the
  parity test does this). The stair-anchor helpers (`frontEdgeProfile`/`_frontEdgeYForSpan`)
  ARE faithful line-by-line ports and should stay that way. [S92]
- **Zorder matters in the site plan.** A stair drawn below the deck fill is invisible; the fix
  needed a real gap (notched polygon), not just a correct anchor. When a "correct" element
  doesn't show, check zorder / whether something opaque is painted over it. [S92]
- **The site plan reads LEGACY stair fields, not `deckStairs`.** The editor syncs them
  (`_syncFlatStairParams`), so editor-built single front stairs work — but multi-stair and any
  path that doesn't sync will silently drop stairs on the site plan. [S92]
- **Bump `index.html` cache-busters on any frontend JS edit** or Will sees a stale cached file.
  Backend-only edits don't need it. [S92]
- **Flat pixel hash is env-local AND drifts within a session** (font cache/AA). Use relative
  before/after in the same env; don't trust an earlier absolute. Golden-file (P3) is the fix.
  [S90/S91/S92]
- **`main` moves under you** — the S88.5 mock session pushes concurrently (pushes 4–11 landed
  during S92). Rebase; confirm new commits are mock-only before trusting your baseline. [S92]
- **A plain "add front stair" is an EDGE stair, not a notch.** Confirm `get_cutout_rects` /
  page count (7 vs 8) before judging notch behavior; an edge-stair test won't exercise notch
  fixes. [S92]
- **`deckStairs` vs legacy stair params.** `resolve_all_stairs` attaches `"geometry"` only for
  the `deckStairs` array; the legacy `hasStairs` fallback has no geometry and `draw_plan` skips
  it. ALWAYS use `deckStairs` in fixtures (and set the synced legacy fields when testing the
  site plan). [S91]
- **`node --check` can't validate the JSX view files; use `@babel/standalone`** (preset react),
  the same transpiler the browser uses. Delete the `package.json`/`package-lock.json` it
  creates. [S92]
- **Test realistic full configs early** (the S89/S90 sweeps caught the coincident-post bug).

---

## 6. PENDING ON WILL (decisions that unblock work)

**Resolved earlier:** concrete landing on framing = KEEP; realistic fixture = notch width ==
stair width.

**Still pending:**
- **NORTH STAR: homeowner vs contractor.** MASTER_CONTEXT/S84 says contractors; SBP_GTM_PLAN
  (Jul 2026) says permit-confused homeowners primary. UNRESOLVED — gates UX-mock porting and
  shapes structure/finishes/AI decisions.
- **Should a notch and its stair be COUPLED as one entity (a "stair well")?** (New in S92.)
  Today a cutout is a zone and a stair is a separate `deckStairs` entry referencing a `zoneId`
  — alignment (notch width == stair width) is convention, not enforced, so you can get a notch
  with no stair. Coupling (auto width/position lock, no orphan notch) fits a homeowner-first
  product; keeping them independent fits a contractor-first product. Rides on the north star.
- **Validate real parcel lookup accuracy** in the first target jurisdiction (the "we know your
  property" differentiator + UX-mock #1/#5 rest on it; currently stubbed).
- Stair tread style on framing: dashed reference (recommended) vs full solid treads?
- Notch-narrower-than-stair behavior: clamp stair to notch, or flag?
- Shallow-deck cantilever handling (beam-at-edge vs smaller overhang)?
- B7/B8 grade convention (delete bench-pad path?).
- Business: contractor pricing ($49 beta / $99 standard?); confirm PPRBD accepts a mixed-size
  set (36x24 drawings + letter form); target town.
- **Rotate the PAT** used across S92 pushes (visible in chat).
- Real test address in hand: Ilaria = 4739 Sweetgrass Lane, Colorado Springs CO 80922.

---

## 7. STANDING REMINDERS
- Ship one change / verify / continue. Keep the flat no-zone permit set unchanged (relative,
  in-env) after any draw change. Feature-freeze until first permit (bug fixes allowed).
- Backend + frontend geometry must stay in lockstep; change both together; the parity test
  guards the notch/stair path — extend it when you touch that geometry.
- PAT: Will provides in-session; NEVER store it; push via transient env-var helper; sweep for
  the real token value; suggest rotation afterward.
- Lead Will-facing summaries with plain-English "what it does"; codes secondary. Present
  handoff + renders. Wait for Will's visual confirm on anything you can't verify yourself. End
  every session with a retrospective.

---

## 8. UX MOCK STATUS (S88.5 — STILL ACTIVE, pushing to `main`)

A separate, ACTIVE session is building a clean-sheet redesign of the user journey (the "mock"),
live under `simpleblueprints.xyz/mock`. Code: `backend/static/uxmock/` + additive `uxmock_*`
endpoints in `main.py` (inside a fenced revert block). During S92 it landed pushes 4 through 11
on `main` — all mock-only; the production `generate_blueprint_pdf` pipeline is untouched. Recent
pushes hooked the mock's Act III previews to the REAL renderers (`POST /api/mock/render-sheets`,
`/api/mock/sample-sheets`) and added a "PREVIEW" watermark to user-specific previews only
(sample/demo site imagery stays clean). **Practical impact on you:** `main` will be ahead of
your clone; rebase and confirm the new commits are mock-only (`uxmock_*` + `backend/static/
uxmock/`) before trusting your flat baseline. This is TWO sessions committing to `main` at once.

**Strategic critique (from S91, still applies):** the mock redesigns the JOURNEY, not the
PRODUCT (real PDF/compliance/parcel lookup are stubbed there). PORT the clear wins under either
audience — SEO-real static landing (fixes "Google can't crawl React"), free preview of all 8
sheets before paywall. Data-dependent (needs real parcel lookup): address-as-hero, live setback
violations. RECONSIDER: asking homeowners for snow load / frost depth (derive from address); the
acting AI drafter (right idea, wrong priority, highest risk). BIGGEST RISK: the differentiator
depends on parcel/GIS accuracy that is stubbed — validate against real addresses first. SETTLE
the north star (§6) before porting anything to production.
