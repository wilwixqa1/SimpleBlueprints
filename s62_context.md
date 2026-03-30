# SimpleBlueprints - Session 62 Context File
**Date:** March 2026
**Repo:** `github.com/Wilwixqa1/simpleblueprints`
**Live site:** `simpleblueprints-production.up.railway.app`
**Custom domain:** `simpleblueprints.xyz`
**Stack:** Split React/Babel frontend (11 JS files) + Python FastAPI backend on Railway. GitHub push to `main` auto-deploys in 60-90s. PyMuPDF for PDF page filtering.
**GitHub PAT:** (user provides each session)

---

## Session Start Protocol

1. **Clone:** `git clone --depth 1 https://<PAT>@github.com/Wilwixqa1/simpleblueprints.git sb_repo` (github.com domain, not api.github.com which is blocked).
2. **Ask for ALL relevant files** before proposing changes.
3. **Read uploaded files** before writing code. Five minutes of reading saves an hour of wrong code.
4. **Declare session scope upfront.** One feature or fix per session.
5. **Generate PDF Test Suite** from admin page at session start for visual baseline.

---

## Session Rules (consolidated)

- **Verify Before Building:** Read the code. Don't guess. Don't code from the context file alone.
- **Stepwise Execution:** One change at a time. Push, test, confirm.
- **Timebox Bugs:** 30 minutes max per bug. Stop and reassess.
- **PDF First:** The PDF is the deliverable. Frontend preview is secondary.
- **No False Confirmation:** Never confirm visual fixes from text extraction. Say "I can't verify the visual layout from here -- does it look right to you?"
- **Root Cause Before Fix:** When same bug persists, stop proposing fixes. Trace actual values.
- **Understand Before Fixing:** If Claude can't explain the root cause, Claude doesn't understand the problem.
- **Simplest Fix First:** Find the simplest fix before proposing architecture.
- **Right Fix Over Bandaid:** Always evaluate whether a fix is a bandaid or the right solution. Prefer limiting tech debt. If it can't account for all cases (e.g. zones, chamfers), it is incomplete.
- **No Architecture Without Delivery:** Never propose new files/modules unless current session has shipped.
- **Anti-Scope-Creep:** "Think harder" = think more precisely, not more broadly.
- **Don't Dismiss User Ideas:** Evaluate on merits. Find the version that works.
- **Optimize for Best UX:** Non-technical homeowners need minimum friction.
- **Optimize for Limiting Tech Debt:** Choose the approach that limits tech debt.
- **Incremental Push:** Large UI changes split into multiple pushes. Test between each.
- **Check In Frequently:** Report progress during long operations.
- **Verify IRC Data Against Source:** Never assume structural tables are correct.
- **Audit Checker Honesty:** Checker must not claim to verify things it doesn't verify.
- **Phase Tagging:** `SB_PHASE` env var stamps all data. Never delete test data; filter by phase.
- **Think Before Implementing:** Before coding any feature, think critically as a top-tier PM, architect, engineer, GC, and architect. Make sure the build aligns with goals of compliance, accuracy, and best UX. Even if it requires rethinking current architecture.
- **Compliance Caution:** Don't add compliance stamps or engineering claims to the PDF until validated with building departments. Frontend warnings are fine; PDF stamps imply everything else is compliant.

---

## Coordinate System

**Origin:** SW corner of lot = (0, 0), bottom-left at street.
**X-axis:** Left to right (east). **Y-axis:** Street toward rear (north).
**House:** `houseOffsetSide` from left edge, `houseDistFromStreet` from front.
**Deck:** Centered on house rear wall. `deckOffset` shifts left/right.
**Polygon vertices:** Clockwise from street-side SW corner. Edge 0 = street.
**Frontend SVG:** `sx(lx)` = lot X to SVG X. `sy(ly)` = lot Y to SVG Y (Y flipped).
**Backend matplotlib:** Same coordinate system. Y increases upward.

---

## Wizard Step Order

| Step | Name | Purpose |
|------|------|---------|
| 0 | Site Plan | Survey upload, AI extraction, lot shape, house position, setbacks, site elements, north arrow, slope |
| 1 | Size & Shape | Deck width/depth/height, zones, chamfers, stairs. House dims pre-filled from extraction. |
| 2 | Structure | Joists, beams, posts, attachment, snow/frost. Species hidden (DFL default). |
| 3 | Finishes | Decking type, railing, guard height, cost breakdown |
| 4 | Review | Project info, permit readiness card (S60), summary, PDF generation |

---

## IRC 2021 Structural Data

### Joist Spans -- VERIFIED (S59)
IRC 2021 Table R507.6. All 3 species groups, all 4 load tiers (40/50/60/70 PSF). Design load = `max(40, snow_load)` per footnote a. Values in `IRC_JOIST_SPANS` dict in `calc_engine.py`.

### Beam Spans -- VERIFIED (S60)
IRC 2021 Tables R507.5(1)-(4). Full 4D lookup: `(load_tier, species, beam_size, effective_joist_span) -> max_beam_span`. 8 beam sizes (2-ply 2x6 through 3-ply 2x12), 7 joist span columns (6-18 ft), interpolation permitted. 392 values verified against ICC source (40+50 PSF text extraction, 70 PSF WA State code). Key functions: `get_beam_max_span()`, `auto_select_beam()`.

**Effective joist span:** We use actual joist span (factor=1.0, assumes max cantilever). Conservative -- beams may be slightly over-sized for decks without cantilever.

**Beam-aware post auto-selection (S60):** Engine adds posts when beam can't span, preventing LVL fallback.

**Old `IRC_BEAM_CAPACITY` kept as legacy alias.** New code uses `get_beam_max_span()` and `auto_select_beam()`.

### Wood Species -- Design Decision (S60)
**Species is NOT user-facing.** Default DFL/HF/SPF. Rationale: homeowners can't identify species; wrong selection is liability; DFL is safe conservative default. Backend has all 3 groups for future Professional Mode. PDF states "No. 2 DFL / HEM-FIR / SPF" on A-0, A-1, A-3.

### Per-Zone Structural Sizing (S60, improved S61)
Each zone gets independent joist, beam, and footing sizing based on its own dimensions. Frontend (`calcAllZones`) and backend (`estimate_zone_materials`) both compute zone-specific members. Zone railing materials also computed (3 exposed sides per zone).

**S61:** Per-zone sizing now computed once in `permit_spec.py` (single source of truth) via `spec["zone_calcs"]`. Drawing files consume from spec, not computed independently. Zone labels on A-1 framing plan show zone-specific joist/beam.

### Post Heights -- VERIFIED (S58)
IRC Table R507.4: 4x4 max varies by tributary area, 6x6 max 14', 8x8 max 14'.

### Multi-Beam / Deep Decks -- NOT SUPPORTED (S61 decision)
IRC R507 prescriptive tables assume single beam layout. Interior beams see double tributary load and can't be sized from R507.5 (table maxes at 18' effective joist span). Any deck needing an intermediate beam is outside prescriptive scope and requires engineering.

**S61 approach:** Frontend shows warning when joist span exceeds IRC max. `engineering_required` flag and `max_depth_for_joists` computed in calc_engine.py. No PDF stamp (premature before compliance validation with building departments).

### What Still Needs Verification (BEFORE BETA)
1. **Multi-beam lines not supported.** Deep decks (>15' joist span for 2x12@16) need intermediate beams. Engine warns but doesn't auto-add.
2. **DL assumption higher than IRC.** DL=15 composite, DL=12 wood vs IRC DL=10. Conservative.
3. **Soil bearing hardcoded** at 1500 PSF.

---

## Chamfer System (S61)

### Architecture
Chamfer awareness lives in the **data layer** (`zone_utils.py`), not the rendering layer.

- `_chamfered_vertices(x, y, w, d, corners)` -- single source of truth for converting rect + corner chamfers to polygon vertices. Lives in `zone_utils.py`.
- `_get_zone_corners(params, zone_id)` -- looks up chamfer data for any zone (0 = mainCorners, zones 1+ from zone.corners).
- `get_exposed_edges()` -- builds railing edges from chamfered polygon vertices. Diagonal edges tagged `dir="d"`. Internal junction diagonals (where chamfer cut corner falls inside another zone's rect) are hidden.
- `_chamfer_perimeter_delta(corners)` -- computes railing length adjustment.

### Rendering
- **Plan view (A-1):** Zone outlines use `Polygon` from chamfered vertices. Board lines clipped to polygon via `set_clip_path`.
- **Framing view (A-1):** Zone 0 outline is chamfered polygon. Joists, blocking, hangers, beam, posts, piers all clipped to it. Zone framing outlines also chamfer-aware.
- **Railing:** Simple loop over `exp_edges` -- edges are correct from data layer, no rendering workarounds needed.

### Railing length
- `calc_engine.py` adjusts railing for chamfers: each chamfer of size S removes 2S axis-aligned edge, adds S*sqrt(2) diagonal. BL/BR on ledger only loses one side.
- `engine.js` has frontend parity for mainCorners chamfers.

### Known chamfer gaps
- **A-2 elevations:** Still rectangular, chamfer not rendered.
- **A-5 site plan:** Still rectangular.
- **Cover sheet area:** Chamfer area not subtracted from deck SF.
- **Zone chamfer railing length in engine.js:** Only mainCorners adjusted, not zone chamfer railing.

---

## Permit Spec Layer

`permit_spec.py` is the single source of truth for all data rendered on permit sheets. Every drawing file reads from the spec. Architecture: `params -> calc_engine -> permit_spec -> draw_*`.

Hardware selection tables auto-select based on member sizes (Billy's approved list in S51, codified S57). Loads box includes lumber design basis (S60).

**S61 additions:** `spec["zone_calcs"]` for per-zone structural sizing, `spec["engineering_required"]` flag, `spec["max_depth_for_joists"]`.

---

## Permit Completeness Checker

Registry-based, 25 checks across 3 layers (structural, drawing, capability). Test matrix: 15 configs. Admin endpoint: `GET /admin/api/plan-quality`. PDF test suite: `GET /admin/api/generate-test-suite`.

Current results (S60): Configs 01-03, 05-07, 09-12, 14-15 = OK. Config 04, 13 = UNSUP (freestanding bracing). Config 08 = FAIL (joist over-span on 50x24).

---

## Frontend/Backend Parity

### Full parity
Width/depth/height, attachment, joist spacing/sizing, beam sizing (IRC R507.5, S60), snow load, frost zone, beam type (dropped/flush), decking/rail type, guard height, zones (with per-zone sizing S60), stairs, slope, lumber design basis on PDF, chamfer outlines (S61), engineering_required flag (S61).

### Known gaps
| Feature | Gap |
|---------|-----|
| **Chamfers on A-2/A-5** | Frontend renders 3D chamfers, PDF elevations/site plan still rectangular |
| **Stair templates** (L/switchback/wrap) | Frontend renders, backend treats all as straight |
| **Freestanding bracing** | Notes mention it, nothing drawn |
| **Multi-beam lines** | Not supported for deep decks (engineering required) |
| **Zone chamfer railing length** | engine.js only adjusts mainCorners, not zone chamfers |

---

## PDF Output

| Sheet | Source | Notes |
|-------|--------|-------|
| Cover (A-0) | draw_cover.py | Compliance stamp, LUMBER row (S60) |
| A-1 Plan & Framing | draw_plan.py | Chamfer-aware outlines+clipping (S61), zone labels with per-zone sizing (S61), decluttered labels (S61), loads box in margin |
| A-2 Elevations | draw_elevations.py | Guard height from calc |
| A-3 General Notes | draw_notes.py | Lumber design basis note (S60) |
| A-4 Structural Details | draw_details.py | Spec-driven |
| A-5 Site Plan | draw_site_plan.py | |
| PPRBD Sheet | jurisdiction_sheet.py | COS only |
| Materials | draw_materials.py | Per-zone sizing (S60), separate PDF |

### P0 Issues (would cause permit rejection)
1. **Freestanding deck bracing** -- notes mention but drawings don't show
2. **Chamfers not on A-2/A-5** -- elevations and site plan show rectangular deck
3. **Stair templates not on PDF** -- all render as straight
4. **Multi-beam lines not on PDF** -- deep decks show single beam with over-spanned joists (now warns in frontend)

---

## AI Systems

### Two-Stage Extraction
Stage 1: Sonnet for structured data (~10s). Stage 2: Opus for shape ranking (~5-15s).

### AI Helper
Streaming SSE, 10+ action types. Text -> Sonnet (400 tokens). Image -> Opus (600 tokens).

### AI Guided Wizard
25 phases across 5 steps. Hybrid scripted + AI helper.

---

## Event Tracking & Analytics

17 event types, 3-ID identity layer, bot detection at module level. Admin dashboard at `/admin` (password-protected). Phase tagging via `SB_PHASE` env var.

---

## Session History

### SESSION 61 (7 pushes, 6 files modified)
**Theme:** Zone Member Labels + Chamfer Rendering + Drawing Declutter

Push 1: Zone member labels on A-1 framing (per-zone joist/beam from spec). Chamfer polygon outlines on plan+framing views. Depth over-span warning (frontend only, no PDF stamp). Engineering_required flag in calc_engine + engine.js. Cache bust s61a.

Push 2: Fixed chamfer clipping -- board lines, joists, blocking, hangers all clipped to chamfer polygon via set_clip_path. Eliminated zone sizing duplication (moved compute_zone_sizing from draw_plan.py to permit_spec.py as single source of truth).

Push 3: Chamfer railing clip workaround (bandaid, replaced in Push 4).

Push 4: **Chamfer at data layer.** Moved _chamfered_vertices to zone_utils.py. get_exposed_edges now builds edges from chamfered polygon vertices natively. Diagonal edges tagged dir="d". Removed all rendering-layer workarounds from draw_plan.py. Railing rendering back to simple loop. Railing length adjusted for chamfer geometry in calc_engine.py.

Push 5: Clipped beam lines, post dots, pier circles to chamfer polygon on framing plan. Frontend engine.js railing length parity for mainCorners chamfers.

Push 6: Fixed junction chamfer railing. Push 4 had marked all diagonal edges as "always exposed", which drew railing at internal zone junctions. Fix: check if chamfer's cut-off corner falls inside another zone's rectangle; if so, diagonal is internal and not exposed.

Push 7: Decluttered framing plan. Loads box moved to left margin (out of framing area). Hardware consolidated to 2 lines (posts+footings, ties+hangers). Removed redundant "DECK JOISTS" and joist count labels. Zone labels compacted. Font sizes reduced.

**Key Lessons:** Always do the right fix, not the simplest. Bandaid rendering workarounds (clip_path in draw_plan.py) had to be replaced with data-layer awareness (zone_utils.py). Zone chamfer railing required geometric reasoning about internal vs external diagonals. Compliance stamps on PDF are premature before building department validation. Think critically across all disciplines before implementing.

### SESSION 60 (7 pushes, 16+ files modified)
**Theme:** IRC Beam Table Overhaul + Structural Accuracy Sprint

Push 1+1b: Full IRC 2021 R507.5 beam tables (4 load tiers x 3 species x 8 sizes x 7 cols). 392 values verified. Beam-aware auto post count. Frontend + backend + checker updated.

Push 2->3: Species selector built, audited, deliberately removed. Lumber design basis added to PDF (A-0, A-1, A-3). Product decision: species NOT user-facing.

Push 4: Permit readiness card in Step 4 (auto-fetches /api/check-permit, green/yellow/red). Post count UI expanded to 8.

Push 5: Flush beam hanger count fix (attachment-aware: 1x ledger, 2x freestanding).

Push 6: Structural info lines in Step 2 (span capacity under joist/beam buttons).

Push 7: Per-zone structural sizing (independent joist/beam/footing per zone). Zone railing materials. BEAM_SPANS/getBeamMaxSpan moved to module scope. CAP_ZONE_CALCS now passes.

**Key Lessons:** IRC beam table is 4-dimensional (load x species x beam x joist span). More options != better product. Audit before shipping. Beam-aware post auto-selection is better UX than LVL warnings.

### SESSIONS 43-59 (archived)
See prior context files for detailed push-by-push history. Key milestones: polygon lot system (S44), AI extraction pipeline (S48-52), AI Helper with actions (S54-56), event tracking (S55), permit spec architecture (S57), permit checker + guard height (S58), IRC joist verification + PDF test suite (S59).

---

## File Structure (11 JS files + backend)

| File | Lines | Last Modified |
|------|-------|---------------|
| `backend/app/main.py` | ~1710 | S60 |
| `backend/app/database.py` | ~1022 | S59 |
| `backend/static/index.html` | ~33 | S61 (?v=s61a) |
| `backend/static/admin.html` | ~629 | S59 |
| `backend/static/js/engine.js` | ~476 | S61 |
| `backend/static/js/steps.js` | ~3584 | S61 |
| `backend/static/js/app.js` | ~1045 | S60 |
| `backend/static/js/tracking.js` | ~149 | S55 |
| `backend/static/js/traceView.js` | ~576 | S43 |
| `backend/static/js/sitePlanView.js` | ~635 | S48 |
| `backend/static/js/elevationView.js` | ~497 | S58 |
| `backend/static/js/planView.js` | ~502 | S47 |
| `backend/static/js/deck3d.js` | ~901 | S58 |
| `backend/static/js/stairGeometry.js` | ~147 | S24 |
| `backend/static/js/zoneUtils.js` | ~425 | S24 |
| `backend/static/js/home.js` | ~62 | S25 |
| `backend/drawing/calc_engine.py` | ~628 | S61 |
| `backend/drawing/permit_checker.py` | ~1655 | S60 |
| `backend/drawing/permit_spec.py` | ~422 | S61 |
| `backend/drawing/draw_plan.py` | ~733 | S61 |
| `backend/drawing/draw_elevations.py` | ~1129 | S58 |
| `backend/drawing/draw_notes.py` | ~349 | S60 |
| `backend/drawing/draw_details.py` | ~310 | S57 |
| `backend/drawing/draw_materials.py` | ~395 | S60 |
| `backend/drawing/draw_site_plan.py` | ~815 | S51 |
| `backend/drawing/draw_cover.py` | ~254 | S60 |
| `backend/drawing/zone_utils.py` | ~289 | S61 |
| `backend/drawing/title_block.py` | ~167 | S45 |
| `backend/drawing/jurisdiction_sheet.py` | ~197 | S50 |
| `backend/drawing/stair_utils.py` | ~61 | S24 |

---

## Prioritized Roadmap

### S62: Remaining Drawing Accuracy
1. **Chamfer on A-2 elevations** -- south/north elevation outline should reflect chamfered front edge
2. **Chamfer on A-5 site plan** -- site plan deck outline should show chamfers
3. **Chamfer area subtraction** -- deck SF on cover sheet should subtract chamfer triangle areas
4. **Stair template rendering on PDF** (L-shape, switchback minimum)
5. **Freestanding deck bracing** drawn on A-1 and A-2

### S63: Reduce Friction
6. **Project persistence** (localStorage save/load)
7. **Parcel lookup** (address -> lot/house via Realie.ai or ReportAll)

### Beta Launch (after S63)
- Flip `SB_PHASE` to `beta` on Railway
- Beta is FREE (no Stripe checkout)
- Submit to 3-5 building departments for validation

### Post-Beta
- Stripe checkout + regeneration tracking
- SEO content, example gallery, contractor referrals
- Future product types: porches, pergolas, sheds, garages

---

## Standing Practices

**Cache busters:** `?v=s61a`. Format: `?v=sXXy`. Bump on any JS push.
**Architecture:** `window.*` export pattern. TRIPWIRE at 12 JS files (currently 11).
**Encoding:** All drawing files use plain ASCII comments.
**Visual verification:** Never confirm visual fixes from text extraction.
**Lumber species:** Default DFL/HF/SPF. NOT user-selectable. Backend supports all 3 groups.
**Beam lookup:** Use `get_beam_max_span()` and `auto_select_beam()`, not legacy `IRC_BEAM_CAPACITY`.
**Snow load:** `LL = max(40, snow)`, NOT `40 + snow`.
**Guard height:** Auto 36" standard, 42" for >8'. Override with 36" IRC floor.
**Joist span lookup:** Design load `LL = max(40, snow)` as IRC table key.
**Phase tagging:** `SB_PHASE` env var. Current: `testing`.
**Bot detection:** Module-level in database.py.
**Checker architecture:** Registry-based. Adding product types is purely additive.
**Push workflow:** git clone/push via github.com (not api.github.com).
**AI Helper cost:** ~$0.01/text (Sonnet), ~$0.05-0.08/image (Opus).
**SimpleBlueprints 3D rendering lesson:** Think in 2D plan view first for stair/deck overlap.
**Chamfer data flow:** `mainCorners` (zone 0) and `zone.corners` (zones 1+) -> `_chamfered_vertices` in zone_utils.py -> polygon outlines + exposed edges. All drawing files consume from zone_utils, never compute chamfer geometry independently.
**Zone sizing flow:** Computed once in `permit_spec.py` via `spec["zone_calcs"]`. Consumed by draw_plan.py. Not duplicated in drawing files.

---

## ENV VARS

| Variable | Purpose |
|----------|---------|
| `ADMIN_PASSWORD` | /admin dashboard |
| `SB_PHASE` | `testing` -> `beta` -> `production` |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth |
| `SESSION_SECRET` | Session encryption |
| `SITE_URL` | Base URL for callbacks |
| `STRIPE_SECRET_KEY` | Stripe (test mode) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks |
| `ANTHROPIC_API_KEY` | Claude API |
| `DATABASE_URL` | Railway Postgres |
