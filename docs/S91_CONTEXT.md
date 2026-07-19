# SimpleBlueprints — MASTER CONTEXT & TODO (start-here for S91)

This is the single "hit the ground running" doc. Read §0 and §1 first, then work §4.
It is self-contained: you should not need to reverse-engineer anything below.

Repo: `https://github.com/wilwixqa1/SimpleBlueprints` (public clone).
As of S90 close: `main` @ `8ad582f`. Backend + tests only since S89. Cache buster
`s87a` (no production frontend touched). All suites green.

---

## 0. HOW TO WORK (anti-spiral rules + exact recipes)

**S90 lost hours circling because of sloppy inspection. These are not optional.**

- **Visual checks go through the harness:** `python3 tests/pdf/render_review.py <set>`.
  It renders named configs into `/tmp/render_review/<set>/` with EVERY page as PNG.
  Do **NOT** hand-roll `pdftoppm` against `/tmp/blueprints`.
- **Select a PDF by its returned `permit_id`**, never `ls -S`/size/recency —
  `/tmp/blueprints` accumulates every config's output; the biggest/newest is usually
  the WRONG one. (This caused S90's "wrong file" screenshots.)
- **Map pages by RENDERED TITLE, never a fixed index.** Page composition is
  config-dependent: plain deck = 7 pages (framing on p2); notched deck = 8 pages
  (framing on p3); a real stair adds a stair-detail sheet. Find the page with
  `for i in ...; pdftotext -f i -l i file - | grep "DECK FRAMING"`.
- **View the full sheet before cropping.** Crop only after locating; never present a
  crop you haven't confirmed contains the subject.
- **Say which kind of check you did:** "numerically verified" (from calc/geometry)
  vs "visually confirmed" (from a clean, correctly-identified image). NEVER claim a
  visual confirm you didn't actually do.
- **Keep the real target fixture** (notched deck + notch-hosted stair via `deckStairs`);
  don't drift to a plain rectangle to "isolate" and lose the thread.
- **When uncertain, get certain with ONE clean render, then present.** Don't narrate
  the flailing.

### Environment setup
```
git clone https://github.com/wilwixqa1/SimpleBlueprints && cd SimpleBlueprints
pip install matplotlib==3.10.8 numpy==2.4.4 --break-system-packages       # render versions
grep -viE '^(matplotlib|numpy)==' backend/requirements.txt > /tmp/r.txt    # keep mpl/np above;
pip install -r /tmp/r.txt --break-system-packages                          # requirements pins
#   OLDER mpl/np -- do NOT let them downgrade or the flat hash shifts.
# poppler-utils (pdftoppm/pdftotext) and node are needed too.
```

### Green gate (run before and after any change)
```
python3 tests/test_structural.py            # 52/0
python3 tests/test_beam_layout.py           # all pass
python3 tests/test_notch_posts.py           # all pass
python3 tests/pdf/config_matrix.py          # MATRIX: 18 configs, 0 failure(s)
(cd tests/geometry && node lotGeometry.test.js)   # passed: 2764  failed: 0
```

### Flat-invariant hash (sacred: flat/no-zone permit set must not change on a draw edit)
Render 20×14 ledger no-zone permit PDF at r=80, sha256 of concatenated page PNGs
(config = `tests/test_notch_posts._base()`).
- **In S90's env the value is `9766a0ce039d19a9`.** S89's `57aaf8095e046067` does NOT
  reproduce across containers (poppler/font anti-alias differs). So this is a
  **within-session before/after invariant, not a portable constant** — re-baseline it
  at the start of the session, then hold it across draw changes. (Permanent fix =
  the golden-file PDF regression, see §4 carryover.)

### Pushing to main
Will provides a GitHub PAT in-session. **Never store it** (not in files, not in
`.git/config`, not in memory). Push via a transient env-var credential helper, then
verify `.git/config` is clean:
```
export SBP_PAT="<pat>"
git -c credential.helper='!f(){ echo username=x-access-token; echo "password=$SBP_PAT"; };f' \
  push origin HEAD:main
unset SBP_PAT
grep -q ghp_ .git/config && echo LEAK || echo clean
```
Commit granularly: `S<NN> push <k>: <plain-English what+why>`.

### Reporting to Will
Non-technical owner. LEAD every summary with plain-English "what it does + why";
codes (B10/G5) are secondary labels. Present context/handoff files to him (present_files)
in addition to committing. End every session with a retrospective.

---

## 1. ORIENTATION (what this is + where things live)

SimpleBlueprints generates **IRC-2021 deck permit drawing sets** (PDF) from a deck
config. Jurisdiction focus: Colorado Springs / PPRBD.

- Backend render pipeline: `backend/app/main.py::generate_blueprint_pdf(params)` →
  returns `(permit_id, materials_id, calc, permit_report)`, writes
  `/tmp/blueprints/<id>.pdf`. Permit set is the multi-page set; a plain deck is 7
  pages, a notched deck 8.
- Structural engine: `backend/drawing/calc_engine.py::calculate_structure(params)`.
- **`backend/drawing/beam_layout.py`** (S89): cutout-aware beam + posts. Key fns:
  `front_edge_profile`, `notched_deck_polygon`, `notch_headers`,
  `compute_beam_layout`, `_posts_for_segment`.
- Drawing: `backend/drawing/draw_plan.py::draw_plan_and_framing(fig, params, calc, ...)`
  draws BOTH the deck-plan and framing panels (`for ax,title,is_framing in _panel_iter`).
- Stairs: `backend/drawing/stair_utils.py` — `resolve_all_stairs`,
  `compute_stair_geometry`, `get_stair_placement[_for_zone]`.
- Zones/edges: `backend/drawing/zone_utils.py` — `get_cutout_rects`,
  `get_additive_rects`, `get_exposed_edges`, `_chamfered_vertices`.
- Site plan: `backend/drawing/draw_site_plan.py`.
- Tests: `tests/test_structural.py`, `tests/test_beam_layout.py`,
  `tests/test_notch_posts.py`, `tests/pdf/config_matrix.py` (parametric sweep +
  crash/post-in-cutout/post-in-landing judges), `tests/geometry/lotGeometry.test.js`.
- Visual harness: `tests/pdf/render_review.py`.

### Config shape (essentials)
`_base()` in the test files is the canonical 20×14 ledger deck. Zones:
`{"id", "type": "cutout"|"add", "attachEdge": "front"|"front-left"|..., "attachOffset",
"w", "d", "attachTo"}`. Stairs (USE THIS, see §5 trap):
`params["deckStairs"] = [{"id","zoneId","anchorX","anchorY","angle"  # explicit anchor
                          OR "location","offset",                    # edge-anchored
                          "width","numStringers","template","landingDepth","runSplit"}]`.

---

## 2. CURRENT STATE (shipped through S90)

- **B10 notched-deck framing (S89):** beam + posts follow the real notched edge with
  automatic IRC ¼-back-span cantilever (shallow notch absorbed as cantilever, deep
  notch steps the beam). No post over the void. Notched body outline, stepped beam +
  connectors, doubled header. Flat path byte-identical.
- **S90 push 1:** fixed coincident-post bug — a ~4 ft notch strip stacked two posts
  at one x (over-counting materials). Single centered post when end posts would be
  < `MIN_POST_SEP` (2 ft) apart; wider segments unchanged. +regression tests.
- **S90 push 2:** matrix notch+stair configs now use real `deckStairs` (were hollow).
- **Verified good (numerically + visually):** notch body is a correct U-notch;
  stepped beam, posts (incl. single strip post), doubled header all correct.

---

## 3. DOMAIN CONVENTIONS (what "correct" looks like — set expectations here)

A deck permit set needs: site plan (deck + stair projection to grade, dimensioned),
framing plan, elevation(s) (height + guard/handrail), stair detail. We produce all.

**Sheet responsibilities:**
- **Deck plan (A-1):** architectural. Decking, guardrail, and the FULL stair — treads,
  landing, "DN" arrow, dimensions.
- **Framing plan (A-2):** structural only. Joists, beam, posts/piers, ledger, blocking,
  hangers, and the stair's *structural* interface: the opening header/trimmers and the
  landing/stringer support. The stair should be a **dashed reference** here, NOT full
  solid treads, and NOT the concrete landing pad (that's a grade element). There is a
  separate stair-detail sheet for the section.
- **Elevations (A-3):** height, guard/handrail, and the diagonal bracing X (on the
  plan we show only a dashed bay-marker + "SEE ELEVATIONS" keynote).
- **Stair detail:** tread/riser/stringer/handrail section.

**Two distinct deck+stair topologies (this drove Will's S90 question):**
- **(A) Edge notch / U-shape** — cutout REACHES the front edge; deck wraps 3 sides
  around the stair opening. Body outline MUST break inward at the notch; **railing
  must wrap the notch** (down one wall, across the back, up the other), stopping where
  the stairs descend. Stairs descend through the open side.
- **(B) Interior well** — cutout stops short of the edge; deck is continuous around a
  hole. Body outline stays CLOSED; opening is internal with a header + rail around it.

Our front-reaching cutout is case (A). **Currently the body outline is correct (breaks),
but the railing is wrong (draws straight across the front — the "unbroken line" Will
saw), and the concrete landing is wrongly drawn on the framing sheet.** See §4 P1.4.

**Stair placement convention (Will's north star): edge-stairs first.** Stairs normally
descend from a deck EDGE. Notching a deck *for* stairs is the less common case.

---

## 4. TODO (priority order; each item: WHAT/WHY · WHERE · HOW · VERIFY)

### P1 — STAIRS + notch drawing correctness (current focus)

**P1.1 — [DONE S90]** Matrix notch+stair configs use real `deckStairs`.

**P1.2 — Cutout-aware stair anchor.**
- WHAT/WHY: A `location:"front"` stair anchors at `anchor_y = D` (full deck depth = the
  phantom pre-notch edge), so on a notched deck it floats over the void instead of
  sitting at the real notch edge. S90's good render faked the correct look with a
  manual `anchorX/anchorY`.
- WHERE: `stair_utils.py::get_stair_placement_for_zone` (~L69–93, the `loc=="front"`
  branch `return {"anchor_x": W/2+off, "anchor_y": D, ...}`) and `get_stair_placement`
  (~L13).
- HOW: When placing a front (or side) stair, compute the REAL edge position at the
  stair's x-span using `beam_layout.front_edge_profile(W, D, get_cutout_rects(params))`.
  For a stair centered at `ax` with width `w`, take `edge_y = min(profile edge_y over
  [ax-w/2, ax+w/2])` (the stair must land on solid deck, so use the *shallowest* solid
  edge across its footprint). Anchor `anchor_y = edge_y`. Preserve the explicit-anchor
  override (only change the location-derived path). Edge case: if the notch is narrower
  than the stair, either clamp the stair to the notch width or flag — get Will's call.
- VERIFY: Add a unit test (front stair on the S90 notch fixture → `anchor_y == 8`, not
  14). Render `m_notch_plus_front_stair` and the in-notch fixtures via render_review;
  stair starts at the notch edge, not floating. Green gate + flat hash.

**P1.3 — Unify the site-plan stair.**
- WHAT/WHY: The site plan uses a separate, cruder stair routine, so site/plan/elevation
  can disagree (it ignores explicit anchor, anchors at full depth, uses tread=10" vs
  10.5" elsewhere).
- WHERE: `draw_site_plan.py` ~L516–550.
- HOW: Replace the bespoke math with `resolve_all_stairs(params, calc)` +
  `compute_stair_geometry`, transforming stair-local geometry into site coords with the
  real anchor (same source of truth as the framing/plan). Delete the local tread/anchor
  constants.
- VERIFY: Render the site plan for a notched+stair config; the stair projection matches
  the framing/plan footprint and dimensions. Add a site-plan set to render_review.

**P1.4 — Notch/stair DRAWING correctness (three parts; addresses Will's S90 findings).**
- (a) **Railing not notch-aware — REAL BUG.** WHERE: `zone_utils.py::get_exposed_edges`
  (~L219); it builds edges from `_get_zone_corners` (chamfer-aware but cutout-BLIND), so
  a front cutout yields one straight front edge `(20,14)→(0,14)`. HOW: when zone 0 has a
  front-reaching cutout, build the exposed-edge list from `beam_layout.notched_deck_polygon`
  instead — emit the front-left segment, the two notch side walls, the notch-back
  segment, and the front-right segment, so the rail wraps the notch. Then SUBTRACT the
  stair-opening span (the notch-bottom edge where the stair descends) so there's no rail
  across the opening. VERIFY: `get_exposed_edges` for the S90 fixture returns wrapped
  edges (not one straight front); render shows the rail hugging the notch with a gap at
  the stairs.
- (b) **A-2 = dashed stair reference; no concrete landing on framing.** WHERE: the stair
  block (`draw_plan.py` ~L826, ungated) draws full treads + the "CONCRETE LANDING" pad
  (~L996) on BOTH panels. HOW: gate the concrete-landing draw and the solid-tread fill
  behind `if not is_framing`; on the framing panel draw only a light dashed tread outline
  + the "OPENING" dimension. Keep full treads + DN + landing on the deck plan and the
  stair-detail sheet. **OPEN WILL DECISION: dashed reference (recommended) vs keep full
  treads on A-2.** Do not implement until Will chooses.
- (c) **Reconcile the DN arrow.** A "DOWN" arrow already renders (`draw_plan.py` ~L915);
  the S89 handoff's "no DN marker" TODO is STALE. Confirm it renders on the deck plan
  (and per convention NOT clutter the framing) and close the stale TODO.
- ALSO: add matrix configs for BOTH topologies — a case-(A) front-reaching U-notch AND
  a case-(B) interior well (cutout that stops short of the edge) — and assert the body
  outline breaks in (A) and stays closed in (B).

### P2 — consistency / completeness
- Convert `m_2zone_zonestairs_main_interior` (still legacy, `geom=False`) to `deckStairs`.
- Site-plan deck OUTLINE truly notched (currently a dashed punch-box,
  `draw_site_plan.py` ~L454) — the notch-aware `get_exposed_edges` from P1.4(a) can feed
  this too.
- Wire `compute_beam_layout` into the STEEL calc (only in the WOOD calc now; drawing
  falls back to the legacy straight beam when `beam_layout` absent → steel notched decks
  un-fixed).
- Mirror the post-placement change into frontend `engine.js` (live preview == PDF).

### P3 — cantilever (needs Will decision) + polish
- Global cantilever ENFORCEMENT permit-check (≤ ¼ back-span). Deferred: every deck gets
  a flat 1.5 ft overhang, which on decks < ~7.5 ft deep already exceeds a strict ¼-span
  reading — a blanket rule would flag EXISTING shallow decks. Needs Will's call
  (beam-at-edge vs smaller overhang).
- Cantilever dimension label on framing (match reference sets).

### Carryover (from S88/S89)
- **B7/B8 grade-line fix:** one honest natural-grade line (posts meet true grade, no
  averaging, no bench pad — consider deleting the bench-pad path). Zero the grandfathered
  `test_post_grade.py` KNOWNs.
- Detectors G8/G9/G10.
- **Golden-file PDF regression** (also makes the flat-hash invariant portable — see §0).
- B11 (cantilever at a house bump-out — ledger can't attach to a bay/fireplace
  projection; needs a separate beam in framing).
- Calibration notes (LVL/MicroLlam beams, 4x4-vs-6x6 posts, Simpson models) so output
  reads like the pro reference sets in `docs/reference_sets`.

---

## 5. KEY TRAPS & LEARNINGS (don't rediscover these)

- **`deckStairs` vs legacy stair params.** `resolve_all_stairs` has two paths: the
  `deckStairs` array attaches `"geometry"` (stair renders); the legacy fallback
  (`hasStairs` + `stairAnchorX/Y` / `stairLocation`) returns a record with NO geometry,
  so `draw_plan` silently skips the stair (`if not sg: continue`). ALWAYS use `deckStairs`
  in fixtures or your stair won't draw at all.
- **Stair block is not `is_framing`-gated** (`draw_plan.py` ~L826) → currently draws on
  both panels. The DN arrow at ~L915 already exists.
- **Flat pixel hash is env-local** (poppler/font AA). Within-session before/after only.
- **Page order is config-dependent** — map by title.
- **Interior stairs SNAP to edges / never notch the deck.** A notch comes ONLY from the
  explicit cutout tool. "Notch for stairs" = user chooses cutout + stair, not automatic.
- **Auto-cantilever is an engine calc, not UI.**
- **Bracing:** X on ELEVATIONS; dashed bay-marker + keynote on the PLAN.
- **Test realistic full configs early** (the S89/S90 notch+stair sweeps caught the
  `_main_post_xy` harness bug AND the coincident-post bug).

---

## 6. PENDING ON WILL (decisions that unblock work)
- **P1.4(b): A-2 stair = dashed reference (recommended) or full treads?** Blocks that item.
- Shallow-deck cantilever handling (P3): beam-at-edge vs smaller overhang?
- B7/B8 grade convention (delete bench-pad path?).
- Notch-narrower-than-stair behavior (P1.2 edge case): clamp stair or flag?
- Older/business: contractor pricing ($49/$99?); confirm PPRBD accepts a mixed-size set
  (36×24 drawings + letter form); Welborn address (Ilaria = 4739 Sweetgrass Lane,
  Colorado Springs CO 80922 in hand).

## 7. STANDING REMINDERS
- Ship one change / verify / continue. Keep the flat no-zone permit set byte-identical
  (in-env) after any draw change. Feature-freeze until first permit (bug fixes allowed).
- PAT: Will provides in-session; NEVER store it; push via transient env-var helper.
- Lead Will-facing summaries with plain-English "what it does"; codes secondary.
- Real test address: Ilaria = 4739 Sweetgrass Lane, Colorado Springs CO 80922.
