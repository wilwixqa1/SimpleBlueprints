# SimpleBlueprints — Session S90 Handoff (for S91)

**Status: pushed to `main`.** S90 push 1 (`20c2703`) + push 2 (`4d80b5e`) on top
of S89 `21ae477`. Backend + tests only — **no cache-buster bump** (no production
frontend touched). Everything green; flat path untouched.

---

## 0. READ THIS FIRST — process guardrails (why S90 went in circles)

S90 lost hours to self-inflicted confusion during the P0 visual-confirm. Nothing
was wrong with the product; the waste was all in *how I inspected it*. Do these
and it won't repeat:

1. **Use the existing visual harness — `tests/pdf/render_review.py` — for EVERY
   visual check.** It renders named configs into their own per-config folders and
   rasterizes every page. Do **not** hand-roll `pdftoppm` against `/tmp/blueprints`.
2. **Never select a PDF by `ls -S` / size / recency.** `/tmp/blueprints` holds
   every config's output from the whole session; the largest/newest is usually the
   WRONG config. Always use the `permit_id` returned by `generate_blueprint_pdf`.
3. **Never assume a fixed page number for a sheet.** Page composition is
   config-dependent (a plain deck = 7 pages, framing on **p2**; a notched deck =
   8 pages, framing on **p3**; a stair adds a stair-detail sheet, etc.). Always map
   pages by their *rendered title* (`pdftotext -f N -l N ... | grep "DECK FRAMING"`),
   for the specific PDF.
4. **View the full sheet before cropping.** Guessed crops caused most of the
   "can't see anything" / wrong-region screenshots. Crop only after locating, and
   never present a crop you haven't confirmed contains the subject.
5. **"Numerically verified" ≠ "visually confirmed."** State which one you mean, and
   NEVER claim a visual confirm without a clean, correctly-identified image. S90's
   worst miss was describing the framing (single post, DBL HEADER, stepped beam)
   as *seen* when the image on screen was actually the notes page / a cut-off crop.
6. **Keep the actual target fixture.** The thing under test is a **notched deck
   with a notch-hosted stair, via `deckStairs`** (see §2). Don't drift to a plain
   rectangle to "isolate" a sub-question and lose the thread.
7. **When uncertain, get certain quietly with one clean render, then present.**
   Don't narrate the flailing turn-by-turn.

Owner note (unchanged from S88): Will is non-technical — LEAD with plain-English
"what it does + why"; codes are secondary. End every session with a retro.

---

## 1. What S90 shipped

### Push 1 (`20c2703`) — coincident-post bug on short notch segments (the P0 catch)
The P0 visual-confirm on the *realistic* notch+stair config caught a real bug:
a notch strip exactly 4 ft wide (≈ a 4 ft stair width) made `_posts_for_segment`
place BOTH 2-ft-inset end posts at the same x — two coincident posts. Because
`total_posts = len(post_positions)`, that **over-counted posts / piers / footings
in the materials list** by one on any ~4-ft segment.
- Fix (`backend/drawing/beam_layout.py`): when the two end posts would sit closer
  than `MIN_POST_SEP` (2 ft) apart, use a single centered post. The interior-count
  formula is untouched, so wider segments render IDENTICALLY — the flat deck never
  reaches this code (it uses `_legacy_posts`), and the deep-notch 6 ft wings
  (`[2,4]`/`[16,18]`) and 8 ft strip (`[8,12]`) are byte-for-byte unchanged.
- Added 4 regression checks to `tests/test_beam_layout.py` (degenerate 3–5.9 ft
  segments → single post; 6 ft → unchanged `[2,4]`; 4 ft notch strip → no dup).

### Push 2 (`4d80b5e`) — matrix notch+stair configs now render REAL stairs
The matrix's `m_notch_stair_*` / `m_notch_plus_front_stair` used the **legacy
flat-param stair path** (`hasStairs` + `stairAnchorX/Y` / `stairLocation`). That
path hits a compat fallback in `resolve_all_stairs` that returns a stair record
**with no `geometry` key**, so `draw_plan` skips it (`if not sg: continue`). Net
effect: the matrix's "stair" coverage was **hollow — the stairs never rendered on
any sheet**. Switched all three to the real `deckStairs=[{...}]` input; matrix
still 18/0 and all three now report `geom=True`. Sized the in-notch cases to the
stair width (realistic), matching the S90 visual-confirm fixture.

### Verification state
- Flat / no-zone permit set unchanged in-env: `9766a0ce039d19a9` (see §3 re: the
  S89 absolute value). Re-check after ANY draw change.
- matrix 18/0, geometry 2764/0, structural 52/0, beam_layout / notch_posts green.
- **P0 visual confirm: DONE** on the correct A-2 framing sheet, for both the
  deep-notch and the notch-hosted-stair fixture. The notch outline, joist clip,
  stepped beam + connectors, DBL HEADER, and the single strip post all read
  correctly, and the stair descends through the notch. (Rendered with a hand-set
  anchor — see §2/P1: making that automatic is the remaining work.)

---

## 2. Stair mechanics you MUST know before touching P1

`resolve_all_stairs(params, calc)` (stair_utils.py) has two paths:
- **Real path — `params["deckStairs"]`** (a list of stair dicts): builds the record
  WITH `"geometry": sg` → the stair renders. Each entry:
  `{id, zoneId, anchorX, anchorY, angle}` (explicit anchor) **or**
  `{id, zoneId, location, offset}` (edge-anchored), plus
  `{width, numStringers, template, landingDepth, runSplit, stairGap}`.
- **Legacy fallback — `hasStairs` + `stairAnchorX/Y` / `stairLocation`**: returns a
  record **with NO `geometry`** → `draw_plan` silently skips the stair. This is the
  trap that made stairs "disappear" all of S90. Prefer `deckStairs` in all fixtures.

`get_stair_placement_for_zone` anchors a `location:"front"` stair at
`anchor_y = D` (full deck depth = the phantom old front edge), **ignoring cutouts**.
That is the P1 bug: on a notched deck a front stair floats at y=D instead of the
real notch edge.

The stair-draw block (`draw_plan.py` ~L826) is **NOT gated by `is_framing`** — it
runs on both the deck-plan and framing panels, so full treads currently draw on
BOTH. A **"DOWN" arrow already exists** (~L915) and renders on the plan — the S89
handoff's "no DN marker" TODO is **STALE**; reconcile rather than re-add.

---

## 3. Flat-invariant hash — cross-environment caveat (NEW, important)

The S89 absolute hash `57aaf8095e046067` **does not reproduce across containers**.
On S90's box (poppler 24.02.0) the untouched-`main` flat no-zone permit set hashes
`9766a0ce039d19a9`, deterministically. Same 7 pages, non-stepped, posts `[2,10,18]`
— i.e. correct; the difference is font/anti-alias rendering between poppler builds,
not a code change. **So the pixel hash is an environment-local, WITHIN-SESSION
before/after invariant, not a portable constant.** Recipe unchanged: 20×14 ledger
no-zone permit PDF at r=80, sha256 of concatenated page PNGs (config =
`test_notch_posts._base()`). S91: re-baseline your own env's flat hash at the start,
hold it across draw changes. Best real fix = the golden-file PDF regression (backlog)
so this stops living in prose.

---

## 4. TODO for S91 (P1 = stairs; Will's north star = edge-stairs first)

### P1 — STAIRS (order chosen so we're always testing something real)
- [x] (S90 push 2) Matrix notch+stair configs use real `deckStairs`.
- [ ] **P1.2 — make placement cutout-aware.** `get_stair_placement_for_zone`
      (and `get_stair_placement`) anchor a front stair at `anchor_y = D`. Anchor
      edge stairs to the REAL notched front edge at the stair's x (use
      `beam_layout.front_edge_profile` / the notched edge), so a front stair on a
      notched deck lands at the notch edge automatically instead of floating at y=D.
      This is what the S90 fixture faked with a manual anchor.
- [ ] **P1.3 — unify the site-plan stair.** `draw_site_plan.py` ~L516-550 draws the
      stair with its own crude math (uses `stairLocation` only, ignores explicit
      anchor, anchors at `z0_y + deck_d`, tread=10" vs 10.5" elsewhere). Replace with
      `resolve_all_stairs` / `compute_stair_geometry` + the real anchor so
      site/plan/elevation agree.
- [ ] **P1.4 — A-2 stair representation (OPEN Will decision).** Framing currently
      draws full solid treads on the framing panel (same as the deck plan). There is
      already a dedicated **stair-detail sheet**, so full treads on A-2 are redundant.
      Recommendation: on A-2 show the stair OPENING framing (header/trimmers — the
      notch DBL HEADER already does this) + landing/stringer support + a **dashed**
      tread reference; keep full treads + DN on the deck plan. **Will has NOT chosen
      dashed-vs-full yet** — get the call before implementing.
- [ ] Reconcile the existing DN arrow (~L915) vs the stale "no DN" note.
- [ ] LATER: notch-hosts-the-stair sizing rules (relate notch width to stair width).

### P2 — consistency / completeness (from S89, still open)
- [ ] Convert `m_2zone_zonestairs_main_interior` (still legacy, `geom=False`) to
      `deckStairs` when P1 touches zone stairs.
- [ ] Site-plan deck OUTLINE truly notched (currently a dashed punch-box,
      `draw_site_plan.py` ~L454) to match the framing sheet.
- [ ] Wire `compute_beam_layout` into the STEEL calc (only in the WOOD calc now;
      drawing falls back to the legacy straight beam when `beam_layout` absent, so
      steel notched decks are un-fixed).
- [ ] Mirror the post-placement change into frontend `engine.js` (live preview
      should match the PDF).

### P3 — cantilever (needs Will decision) + polish
- [ ] Global cantilever ENFORCEMENT permit-check (≤ ¼ back-span). Deferred: every
      deck gets a flat 1.5 ft overhang, which on decks < ~7.5 ft deep already exceeds
      a strict ¼-span reading — a blanket rule would flag EXISTING shallow decks.
      Needs Will's call (beam-at-edge vs smaller overhang).
- [ ] Cantilever dimension label on framing (match reference sets).

### Carryover from S88/S89 (not started)
- [ ] B7/B8 grade-line fix: one honest natural-grade line (posts meet true grade,
      no averaging, no bench pad). Zero the grandfathered `test_post_grade.py` KNOWNs.
- [ ] Detectors G8/G9/G10; **golden-file PDF regression** (also fixes §3).
- [ ] B11 (cantilever at house bump-out); calibration notes (LVL/MicroLlam, Simpson).

---

## 5. Files changed in S90
- MOD `backend/drawing/beam_layout.py` (`MIN_POST_SEP`; `_posts_for_segment` guard)
- MOD `tests/test_beam_layout.py` (4 degenerate-segment regression checks)
- MOD `tests/pdf/config_matrix.py` (3 notch+stair configs → real `deckStairs`)

## 6. Resume recipe
```
git clone https://github.com/wilwixqa1/SimpleBlueprints && cd SimpleBlueprints
pip install matplotlib==3.10.8 numpy==2.4.4 --break-system-packages   # recipe versions
pip install -r backend/requirements.txt --break-system-packages       # EXCEPT keep mpl/np above
#   (requirements pins mpl 3.8.2/np 1.26.3 -- do NOT downgrade; flat hash needs 3.10.8/2.4.4)
# green gate:
python3 tests/test_structural.py; python3 tests/test_beam_layout.py
python3 tests/test_notch_posts.py; python3 tests/pdf/config_matrix.py    # expect 18/0
(cd tests/geometry && node lotGeometry.test.js)                          # 2764/0
# VISUAL review: use the harness, not ad-hoc pdftoppm --
python3 tests/pdf/render_review.py --list
python3 tests/pdf/render_review.py <set_name>   # -> /tmp/render_review/<set>/*.png (every page)
```
Real test address: Ilaria = 4739 Sweetgrass Lane, Colorado Springs CO 80922.

## 7. Standing reminders
- Push to `main` via **Will's PAT** — Will provides it in-session. **Never store it**
  (not in files, not in `.git/config`, not in memory). Use a transient env-var
  credential helper for the push, then verify `.git/config` is clean.
- Lead Will-facing summaries with plain-English "what it does"; codes secondary.
- Ship one change / verify / continue. Keep the flat no-zone permit set byte-identical
  (in-env). Feature-freeze until first permit (bug fixes allowed).
