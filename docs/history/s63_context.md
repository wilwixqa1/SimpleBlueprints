# SimpleBlueprints - Session 63 Context File
**Date:** April 2026
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
- **No Permit Promises:** We generate blueprints to SUPPORT permit applications. Never say "permit-ready" or "guaranteed to pass" in user-facing UI. The building department makes the final determination.

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

### Beam Spans -- VERIFIED (S60, critical fix end-of-S62)
IRC 2021 Tables R507.5(1)-(4). Full 4D lookup: `(load_tier, species, beam_size, effective_joist_span) -> max_beam_span`. 8 beam sizes (2-ply 2x6 through 3-ply 2x12), 7 joist span columns (6-18 ft), interpolation permitted. Key functions: `get_beam_max_span()`, `auto_select_beam()`.

**End-of-S62 verification:** Ran systematic check of all 827 IRC values against ICC source. Found critical bug: 70 PSF Southern Pine beam values were copies of DFL (56 values wrong). Fixed in both calc_engine.py and engine.js. Also fixed RW 2x12@12" 50PSF joist span. Final: ~824/827 match. Remaining ~3 discrepancies are within 1 inch and trace to known ICC digital source typos (e.g. "6-22", "5-20", "604"), not our code.

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

### Multi-Beam / Deep Decks -- REMOVED FROM ROADMAP (end-of-S62)
IRC R507 prescriptive tables assume single beam layout. Interior beams see double tributary load and can't be sized from R507.5. Adding intermediate beams goes beyond prescriptive path and requires engineering.

**End-of-S62 decision:** Instead of building multi-beam support, formalized depth cap at IRC prescriptive max for user's specific config. Engine computes exact limit from joist size, spacing, load tier, and species. When exceeded: specific warning ("Your deck depth of X' exceeds the IRC prescriptive limit of Y' for [member] at [spacing]. A licensed engineer is required for this design."). Updated in calc_engine.py (backend), engine.js (frontend), and permit_checker.py. Config 08 (50x24 heavy snow) now correctly shows engineering_required rather than failing.

### What Still Needs Verification (BEFORE BETA)
1. ~~**Multi-beam lines not supported.**~~ Resolved: depth cap with engineering_required flag.
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

## Project Persistence (S62)

### Architecture
- `projects` table: id, user_id, name, status (draft/generated), params_json, info_json, step, site_plan_mode, survey_b64, last_generation_id, city, state, zip, created_at, updated_at
- CRUD: `create_project`, `list_projects`, `get_project`, `update_project`, `delete_project`, `get_project_locations`
- API: GET/POST `/api/projects`, GET/PUT/DELETE `/api/projects/:id`
- Location (city/state/zip) auto-extracted from info_json on create/update

### Frontend Auto-Save
- `projectIdRef` (useRef) tracks active project ID
- `ensureProject()` creates project on first meaningful change (logged-in users only)
- `saveProject()` PUTs changed fields, debounced 3s via `scheduleSave()`
- Survey (sitePlanB64) saved separately only when dirty (large payload)
- `beforeunload` flushes pending save with `keepalive: true`
- `loadProject()` restores full wizard state from saved project
- `startNewProject()` resets all wizard state for fresh start
- `goHome()` flushes save and clears project context

### OAuth State Preservation
- Before OAuth redirect, wizard state saved to localStorage (`sb_auth_state`)
- On auth success, state restored so user lands back in wizard where they were
- Try/catch with fallback: if survey too large for localStorage quota, saves without it
- Handles deferred script loading for wizard page restoration

### Home Page / Drafts Architecture
- Landing page (home.js `HomePage`) is the marketing page for all users
- Logged-in users see "My Projects" button in nav bar
- Clicking it goes to dedicated drafts page (`DraftsPage` component)
- Drafts page: list layout with accent bar per row, status badge, dims, step info, delete button
- Empty state with prompt to start first project
- `page` state: "home" | "drafts" | "loading" | "wizard"

---

## Deferred Script Loading (S62)

### Architecture
Landing page only loads 5 files for Babel (engine.js, stairGeometry.js, zoneUtils.js, home.js, app.js = ~127KB). Three.js (600KB) and 6 wizard-only files (planView, elevationView, deck3d, sitePlanView, traceView, steps.js = ~380KB) load lazily via `window._loadWizardDeps()`.

### Lazy Loader
- `loadScript(url)` -- injects regular `<script>` tag (for Three.js CDN)
- `loadBabelScript(url)` -- fetches source, `Babel.transform()`, injects result
- Load order: Three.js first, then views in parallel, then steps.js last
- Promise-based, cached (only loads once)
- `window._wizardDepsReady()` checks if already loaded

### Integration
- `enterWizard()` helper checks deps, shows "Loading wizard..." screen if needed
- `startNewProject`, `loadProject`, and OAuth restore all use `enterWizard()`
- Loading page: simple SB logo + "Loading wizard..." text

---

## AI Helper System (S54-S62)

### Architecture
Streaming SSE via `/api/ai-helper`. Text queries use Sonnet (~$0.01), image queries use Opus (~$0.05-0.08). System prompt built dynamically per step with settable params, current values, UI maps, site elements context.

### S62 Improvements
- **Structural calc context:** Joist/beam/post sizes, design loads, engineering warnings injected into system prompt from server-side calc
- **Permit pre-check context:** Pass/fail checks with messages and fix suggestions injected into prompt
- **Suggestion buttons:** New `suggest` action type renders clickable buttons instead of asking yes/no questions. User taps to apply actions directly (no second AI call). Labels under 25 chars.
- **Brevity rules:** 1-2 sentences max, no filler, no "check the preview"
- **Permit language:** AI explicitly instructed never to say "permit-ready" or "guaranteed to pass"

### Action Types
- `param` -- set a parameter directly
- `navigate` -- scroll to a UI section
- `siteElementUpdate/Add/Remove` -- modify site elements
- `zoneAdd` -- add L-shaped extension
- `cutoutAdd` -- add notch
- `chamferSet` -- set corner chamfer
- `zoneRemove` -- remove zone
- `suggest` -- render clickable option buttons (S62)
- `classify` -- tag user message intent (internal)

---

## Permit Spec Layer

`permit_spec.py` is the single source of truth for all data rendered on permit sheets. Every drawing file reads from the spec. Architecture: `params -> calc_engine -> permit_spec -> draw_*`.

Hardware selection tables auto-select based on member sizes (Billy's approved list in S51, codified S57). Loads box includes lumber design basis (S60).

**S61 additions:** `spec["zone_calcs"]` for per-zone structural sizing, `spec["engineering_required"]` flag, `spec["max_depth_for_joists"]`.

---

## Permit Completeness Checker

Registry-based, 25 checks across 3 layers (structural, drawing, capability). Test matrix: 15 configs. Admin endpoint: `GET /admin/api/plan-quality`. PDF test suite: `GET /admin/api/generate-test-suite`.

Current results (S60, updated end-of-S62): Configs 01-03, 05-07, 09-12, 14-15 = OK. Config 04, 13 = UNSUP (freestanding bracing). Config 08 = correctly shows engineering_required (50x24 exceeds IRC prescriptive depth).

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

---

## Event Tracking & Analytics

17 event types, 3-ID identity layer, bot detection at module level. Admin dashboard at `/admin` (password-protected). Phase tagging via `SB_PHASE` env var.

**S62 addition:** `GET /admin/api/locations` returns geographic breakdown of projects by state/city for regulatory planning.

---

## Session History

### SESSION 62 (12 pushes + end-of-session IRC work)
**Theme:** Project Persistence + AI Helper Upgrades + Performance + IRC Verification

Push 1: Projects DB table + CRUD API (5 endpoints, ownership enforcement).
Push 2: Auto-save wiring in app.js (debounced 3s, create-on-change, beforeunload flush, loadProject/startNewProject/goHome).
Push 3: Home page project list (initial version with cards).
Push 4: OAuth state preservation (localStorage stash before redirect, restore after auth success, size fallback for large surveys).
Push 5: Landing vs dashboard split (initial attempt, iterated).
Push 6: Dashboard UI polish (accent bars, progress dots, hover effects).
Push 7: Reverted to clean landing page + separate "My Projects" page. DraftsPage as dedicated list view with delete buttons.
Push 8: Location tracking (city/state/zip auto-extracted from info_json, indexed on state, GET /admin/api/locations for geographic analytics).
Push 9: Deferred script loading. Landing page loads 5 files (127KB) instead of 11 (517KB). Three.js + views + steps lazy-loaded on wizard entry.
Push 10: Fix deferred loading crash (stairGeometry + zoneUtils needed by engine.js at load time, moved back to initial load).
Push 11: AI helper structural calc + permit check context injected into system prompt. Permit language audit: "PERMIT READY" changed to "CHECKS PASSED", disclaimer added, AI instructed never to promise approval.
Push 12: AI suggestion buttons. New `suggest` action type renders clickable buttons (applied directly, no second AI call). Brevity rules: 1-2 sentences max, no filler. Never ask "would you like me to?" -- use suggest buttons instead.

**End-of-session IRC data work:**
- Created `irc_tables.py` (3,874 lines) -- rafter spans, floor joists, ceiling joists, studs, footings, porch headers from IRC 2021.
- Created `irc_tables_round2.py` (204 lines) -- ledger fasteners, bolt placement, interior headers, fastening schedule, decking spacing, fastener specs, climatic template.
- Created future product calc engines: `calc_pergola.py` (351 lines, scaffolded with TODOs for IRC table wiring), `calc_porch.py` (176 lines, scaffolded), `calc_fence.py` (216 lines, wind-based, complete), `calc_shed.py` (395 lines, scaffolded).
- Created `tests/test_structural.py` (267 lines, 52 deck tests all passing) and `tests/test_future_products.py` (252 lines, 50 tests passing, 1 skipped).
- **Critical verification fix:** Ran systematic check of all 827 IRC structural values. Found 70 PSF Southern Pine beam values were copies of DFL (56 values wrong). Fixed in calc_engine.py + engine.js. Also fixed RW 2x12@12" 50PSF joist span. Final: ~824/827 verified.
- **Depth cap decision:** Removed multi-beam from roadmap. Instead, engine computes max depth from IRC prescriptive tables for user's specific config. Engineering_required with specific messaging when exceeded. Updated calc_engine.py, engine.js, permit_checker.py. 102/102 tests pass.

**Key Lessons:** Let users tell you when the UX is wrong (dashboard was over-designed, simple "My Projects" nav button was better). Deferred loading needs careful dependency analysis (engine.js depends on stairGeometry at load time). Permit language matters legally -- never imply guaranteed approval. AI UX: buttons > typing "yes". IRC verification loop caught a critical compliance bug (56 wrong SP beam values) that would only surface when a homeowner in heavy-snow Southern Pine territory submits to their building department. Always verify structural data against source. Write known-answer tests before building features.

### SESSION 61 (7 pushes, 6 files modified)
**Theme:** Zone Member Labels + Chamfer Rendering + Drawing Declutter
(See S62 context file for details)

### SESSION 60 (7 pushes, 16+ files modified)
**Theme:** IRC Beam Table Overhaul + Structural Accuracy Sprint
(See S62 context file for details)

### SESSIONS 43-59 (archived)
Key milestones: polygon lot system (S44), AI extraction pipeline (S48-52), AI Helper with actions (S54-56), event tracking (S55), permit spec architecture (S57), permit checker + guard height (S58), IRC joist verification + PDF test suite (S59).

---

## File Structure (11 JS files + backend)

| File | Lines | Last Modified |
|------|-------|---------------|
| `backend/app/main.py` | ~1850 | S62 |
| `backend/app/database.py` | ~1140 | S62 |
| `backend/app/auth.py` | ~95 | S55 |
| `backend/static/index.html` | ~85 | S62 |
| `backend/static/admin.html` | ~670 | S62 |
| `backend/static/js/engine.js` | ~476 | S62 (SP 70PSF fix) |
| `backend/static/js/steps.js` | ~3590 | S62 |
| `backend/static/js/app.js` | ~1240 | S62 |
| `backend/static/js/home.js` | ~220 | S62 |
| `backend/static/js/tracking.js` | ~149 | S55 |
| `backend/static/js/traceView.js` | ~576 | S43 |
| `backend/static/js/sitePlanView.js` | ~635 | S48 |
| `backend/static/js/elevationView.js` | ~497 | S58 |
| `backend/static/js/planView.js` | ~502 | S47 |
| `backend/static/js/deck3d.js` | ~901 | S58 |
| `backend/static/js/stairGeometry.js` | ~147 | S24 |
| `backend/static/js/zoneUtils.js` | ~425 | S24 |
| `backend/drawing/calc_engine.py` | ~628 | S62 (SP 70PSF + depth cap) |
| `backend/drawing/irc_tables.py` | ~3874 | S62 (NEW) |
| `backend/drawing/irc_tables_round2.py` | ~204 | S62 (NEW) |
| `backend/drawing/calc_pergola.py` | ~351 | S62 (NEW, scaffolded) |
| `backend/drawing/calc_porch.py` | ~176 | S62 (NEW, scaffolded) |
| `backend/drawing/calc_fence.py` | ~216 | S62 (NEW, complete) |
| `backend/drawing/calc_shed.py` | ~395 | S62 (NEW, scaffolded) |
| `backend/drawing/permit_checker.py` | ~1676 | S62 (depth cap messaging) |
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
| `tests/test_structural.py` | ~267 | S62 (NEW, 52 tests) |
| `tests/test_future_products.py` | ~252 | S62 (NEW, 50 tests) |

---

## Prioritized Roadmap

### S63: Drawing Accuracy + Quick Fixes
1. **Chamfer area subtraction** -- deck SF on cover sheet should subtract chamfer triangle areas (pure math)
2. **Zone chamfer railing in engine.js** -- frontend only adjusts mainCorners, not zone chamfers (parity fix)
3. **beam_h in draw_elevations.py** -- 4 TODOs to derive from calc["beam_size"], now unblocked since S61
4. **Chamfer on A-2 elevations** -- south/north elevation outline should reflect chamfered front edge
5. **Chamfer on A-5 site plan** -- site plan deck outline should show chamfers

### S64: Stair Templates + Bracing
6. **Stair template rendering on PDF** (L-shape, switchback minimum)
7. **Freestanding deck bracing** drawn on A-1 and A-2

### S65: Reduce Friction
8. **Parcel lookup** (address -> lot/house via Realie.ai or ReportAll)

### Beta Launch (after S65)
- Flip `SB_PHASE` to `beta` on Railway
- Beta is FREE (no Stripe checkout)
- Submit to 3-5 building departments for validation

### Post-Beta
- Stripe checkout + regeneration tracking
- SEO content, example gallery, contractor referrals
- Wire irc_tables.py rafter/stud data into calc_pergola.py and calc_shed.py (replace TODOs)
- Future product types: porches, pergolas, sheds, garages (calc engines scaffolded, test suites ready)

---

## Remaining TODOs

### Code TODOs
- `draw_elevations.py` (4 places): `beam_h = 1.0 # TODO: derive from calc["beam_size"]` -- per-zone calcs now available in spec
- `deck3d.js:130`: `var zH = H; // TODO Phase 3: per-zone height from zone.h`
- `main.py:1096`: insight analysis prompt still says "permit-ready" (internal, low priority)
- `calc_pergola.py`: IRC rafter table values need wiring from irc_tables.py (TODOs throughout)
- `calc_shed.py`: IRC stud/rafter/floor joist values need wiring from irc_tables.py (TODOs throughout)

### Known Gaps (from context)
- Zone chamfer railing length in engine.js (only mainCorners adjusted)
- Chamfer area not subtracted from cover sheet SF
- Chamfers not rendered on A-2 elevations or A-5 site plan
- Stair templates not rendered on PDF (all show as straight)
- Freestanding bracing not drawn

---

## Standing Practices

**Cache busters:** `?v=s62e`. Format: `?v=sXXy`. Bump on any JS push. Lazy-loaded files use cache buster variable in index.html loader.
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
**Deferred loading:** Three.js + views + steps load lazily via `_loadWizardDeps()`. Engine + stairGeometry + zoneUtils must stay in initial load.
**Project auto-save:** Debounced 3s, logged-in users only. Anonymous users still lose work on refresh.
**Permit language:** Never say "permit-ready" or "guaranteed to pass" in user-facing UI. Use "blueprint package" and "automated pre-check".
**IRC data repository:** `irc_tables.py` (3,874 lines) and `irc_tables_round2.py` (204 lines) contain verified IRC 2021 data for rafters, floor joists, ceiling joists, studs, footings, headers, fasteners, and climatic data. Data is extracted and permanent -- no ICC access needed for future wiring.
**Test suites:** `tests/test_structural.py` (52 deck tests) + `tests/test_future_products.py` (50 tests). Run with `python -m pytest tests/`. All 102 pass.
**Future product engines:** calc_fence.py (complete), calc_pergola.py/calc_shed.py/calc_porch.py (scaffolded, IRC table wiring as TODOs). Fence calc is wind-based and fully functional.

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
