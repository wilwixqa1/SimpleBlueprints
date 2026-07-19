# SimpleBlueprints — Session S89 Handoff (for S90)

**Status: pushed to `main`.** Commits `acf20e0..21fc7e0` (4 granular "S89 push N"
commits on top of S88 `4874f40`). Backend-only — **no cache-buster bump needed**
(frontend untouched). A full patch + the 3 new files are also in
`outputs/S89_handoff/` as a backup, but you shouldn't need them since it's on main.

---

## 1. What S89 did (B10: notched-deck framing)

Fixed the real, user-reachable B10 bug — **main-deck support posts ignored cutouts**,
so a notch left a post stranded over empty space — and made the framing sheet
represent a notched deck properly.

- **Cutout-aware beam + posts** (`backend/drawing/beam_layout.py`, NEW): beam and
  posts follow the real notched front edge; **automatic cantilever** using the IRC
  R507.6 quarter-of-joist-back-span limit — a *shallow* notch is absorbed as a
  cantilever (beam stays straight), a *deep* notch steps the beam in. No post is
  ever left over the void. This is an **engine decision, no new UI** (confirmed
  with Will).
- **Notched framing outline** (`draw_plan.py`): the deck body + joists follow the
  notch (clip to a notched polygon), the beam draws as stepped segments + vertical
  connectors, and a **doubled header + doubled joists** frame each notch.
- **Bracing convention** (`draw_plan.py`): diagonal bracing on the *plan* is now a
  thin dashed bay-marker + "SEE ELEVATIONS" keynote (the real X stays on the
  elevations) — matches structural-drawing convention.
- **Test coverage**: `test_beam_layout.py`, `test_notch_posts.py` (NEW), and
  `config_matrix.py` expanded **8 → 18 configs** with 10 notch/stair cases + a new
  `check_post_in_cutout` judge. Also fixed a latent harness bug: `_main_post_xy`
  hardcoded every post to `depth-1.5`, mis-placing stepped notch posts.

### Verification state
- **Flat/no-zone permit set is byte-identical** — pixel hash `57aaf8095e046067`
  (7-page permit set) unchanged before/after. Re-verify this after ANY draw change.
- Geometry proven numerically (notch void is *outside* the deck polygon; wings +
  shallow strip *inside*), matrix 18/0, geometry 2764/0, structural / beam_layout /
  notch_posts / post_grade 64/0 / frost_snow all green.
- **NOT visually eyeballed** — the image/vision tool went down mid-session. The
  notched framing (outline, stepped beam, header, stair-in-notch) is proven
  numerically but needs a **visual confirm** with vision back up. ← TOP TODO.

---

## 2. TODO for S90 (do in this order)

### P0 — Visual confirm (do first, vision back up)
- [ ] Render a notched ledger deck (20×14, front cutout x[6,14] d=6) and eyeball
      **A-2 framing**: outline follows notch, joists stop at notch, stepped beam +
      connectors, "DBL HEADER". Confirm it looks professional.
- [ ] Render notch **+ stair-in-notch** and eyeball. Use a **realistic** config
      (notch sized ~stair width, not the arbitrary 8-wide-notch/4-wide-stair combo
      that made review confusing).
- [ ] If anything looks off, fix before moving on.

### P1 — STAIRS (Will's north star: **edge-stairs first**, then notch-hosted)
Root cause of the site-plan stair bug: **stair placement is not cutout-aware**, and
the **site plan uses a separate, cruder stair routine**.
- [ ] **Make stair placement cutout-aware.** `get_stair_placement` (stair_utils.py)
      anchors a front stair at full deck depth (`anchor_y = depth`), so on a
      front-notched deck it floats at the phantom old edge. Anchor edge stairs to
      the REAL (notched) edge.
- [ ] **Unify the site-plan stair.** `draw_site_plan.py` ~L516-550 draws the stair
      with its own math: uses `stairLocation` only (ignores explicit
      stairAnchorX/Y/Angle), anchors at `z0_y + deck_d` (ignores cutouts), and uses
      tread=10" vs 10.5" everywhere else. Replace with `resolve_all_stairs` /
      `compute_stair_geometry` + the real anchor so site/plan/elevation agree.
- [ ] **Add "DN" down-arrow + label** on the plan-view stair (plan-checker
      convention; we currently draw treads + rise/run callout + "OPENING" width dim
      + landing, but no DN marker).
- [ ] LATER: the uncommon **notch-hosts-the-stair** case + relate notch size to
      stair width.

### P2 — Consistency / completeness
- [ ] **Site plan outline**: currently marks the notch as a dashed punch-box
      (`draw_site_plan.py` ~L454). Optionally make the deck OUTLINE truly notched to
      match the framing sheet.
- [ ] **Steel calc**: `compute_beam_layout` is wired only into the WOOD
      `calculate_structure`. Wire the steel calc too (drawing already falls back to
      the legacy straight beam when `beam_layout` is absent, so steel notched decks
      are currently un-fixed).
- [ ] **Frontend mirror**: mirror the post-placement change into `engine.js`
      (fix-PDF-first is satisfied; now the live preview should match the PDF).

### P3 — Cantilever (needs a Will decision) + polish
- [ ] **Global cantilever ENFORCEMENT** permit-check (≤ ¼ back-span). Deferred on
      purpose: our code already gives every deck a flat 1.5-ft overhang, which on
      decks < ~7.5 ft deep already exceeds a strict ¼-span reading — so a blanket
      rule would flag EXISTING shallow decks. Needs Will's call on shallow-deck
      handling (beam-at-edge vs smaller overhang). Separate from B10.
- [ ] **Cantilever dimension label** on framing (match reference sets) — polish.

### Carryover from S88 (not started in S89)
- [ ] **B7/B8 grade-line fix**: one honest natural-grade line (posts meet true
      grade, no averaging, no bench pad — consider deleting the bench-pad path).
      Goal: zero KNOWN in `test_post_grade.py` (currently 24 grandfathered).
- [ ] Detectors G8/G9/G10; golden-file PDF regression.
- [ ] B11 (cantilever at house bump-out); calibration notes (LVL/MicroLlam beams,
      Simpson models).

---

## 3. Key learnings (do NOT rehash these)

- **Interior stairs do NOT notch the deck.** They snap to the nearest edge within
  1 ft (`snapStairToEdge`) or fall back to a front edge; they never carve the deck.
  Notches come ONLY from the explicit cutout tool. So "notch for stairs" is a user
  choice (cutout + stair), not automatic. The S88 "interior-stair" framing was a
  red herring — real B10 = posts ignore cutouts. (Verified in code.)
- **Auto-cantilever is an engine calculation, not a UI choice** — no new UI. The
  cantilever-vs-support decision is computed from the deck shape. (Agreed w/ Will.)
- **Professional convention** (researched): stairs descend from the deck EDGE (the
  norm); notching a deck *for* stairs is uncommon. Bracing = X on ELEVATIONS,
  dashed bay-marker + keynote on the PLAN. Deck permit set needs site plan (deck +
  stair projection to grade, dimensioned), framing plan, elevation (height +
  guard/handrail), and a stair detail (tread/riser/stringer/handrail) — we have all.
- **Flat invariant is sacred**: no-zone permit set hash = `57aaf8095e046067`
  (recipe: `/tmp/render_hash.py`-style — render 20×14 ledger no-zone permit PDF at
  r=80, sha256 of concatenated page PNGs). Re-verify after every draw change.
- The flat drawing path is literally unchanged; only `beam_layout["stepped"]` decks
  hit the new drawing code. That's how flat stays byte-identical.
- **Vision can drop mid-session.** When it does: verify with geometry
  (`matplotlib.path.Path.contains_point`), the flat hash, and the matrix. Pixel-
  color forensics are unreliable (anti-aliasing + page layout confound them).
- **Test realistic full configs, not minimal ones.** S89's biggest process miss:
  the notch fix was validated in isolation first; the realistic notch+stair sweep
  (added to config_matrix) is what caught the `_main_post_xy` harness bug. Go to the
  config matrix early.

---

## 4. Resume recipe
```
git clone https://github.com/wilwixqa1/SimpleBlueprints && cd SimpleBlueprints
pip install matplotlib==3.10.8 numpy==2.4.4 --break-system-packages   # + poppler
# green gate:
python3 tests/test_structural.py; python3 tests/test_beam_layout.py
python3 tests/test_notch_posts.py; python3 tests/pdf/config_matrix.py   # expect 18/0
(cd tests/geometry && node lotGeometry.test.js)                          # 2764/0
# render: cd backend; generate_blueprint_pdf(cfg) -> /tmp/blueprints/<uuid>.pdf
#   (permit set = largest file; complex/zoned deck = 8 pages)
# rasterize: pdftoppm -png -r 130 -f N -l N file.pdf out
```
Real test address: Ilaria = 4739 Sweetgrass Lane, Colorado Springs CO 80922.

## 5. Files changed in S89
- NEW `backend/drawing/beam_layout.py`
- NEW `tests/test_beam_layout.py`, `tests/test_notch_posts.py`
- MOD `backend/drawing/calc_engine.py` (wood calc: beam_layout wiring + return)
- MOD `backend/drawing/draw_plan.py` (notched outline, stepped beam, header, bracing)
- MOD `tests/pdf/config_matrix.py` (10 notch configs, cutout judge, `_main_post_xy` fix)

## 6. Standing reminders
- Push to `main` via **Will's PAT** — Will provides it in-session. **Never store it**
  (not in files, not in memory).
- Lead Will-facing summaries with plain-English "what it does"; codes secondary.
- Ship one change / verify / continue. Keep no-zone permit set byte-identical.
- Feature-freeze until first permit (B10 was a bug fix, allowed).
