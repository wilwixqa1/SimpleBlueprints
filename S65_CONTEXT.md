# SimpleBlueprints - Session 65 Context File
**Date:** April 2026
**Repo:** `github.com/Wilwixqa1/simpleblueprints`
**Live site:** `simpleblueprints-production.up.railway.app`
**Custom domain:** `simpleblueprints.xyz`
**Stack:** Split React/Babel frontend (11 JS files) + Python FastAPI backend on Railway. GitHub push to `main` auto-deploys in 60-90s. PyMuPDF for PDF page filtering. Realie API for parcel lookup. staticmap + CartoDB tiles for vicinity maps.
**GitHub PAT:** (user provides each session)

---

## Session Start Protocol

1. **Clone:** `git clone --depth 1 https://<PAT>@github.com/Wilwixqa1/simpleblueprints.git sb_repo` (github.com domain, not api.github.com which is blocked).
2. **Test S64 Push 14 first:** User needs to verify SVG viewport extension for zone bounds works (stair draggable to zone outer edges).
3. **Ask for ALL relevant files** before proposing changes.
4. **Read uploaded files** before writing code. Five minutes of reading saves an hour of wrong code.
5. **Declare session scope upfront.** One feature or fix per session.
6. **Generate PDF Test Suite** from admin page at session start for visual baseline.

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
- **Multi-Perspective Thinking (S63):** Before building features, think as a top-tier PM, Solutions Architect, Chief of Revenue, Senior SWE, and General Contractor (the user). This catches UX gaps that purely technical thinking misses.
- **Rewrite Over Patch (S64):** When a feature has been patched 3+ times and still doesn't work, rewrite the function from scratch instead of adding more patches. Optimize for giving users the right functionality, not for minimal code changes.

---

## Coordinate System

**Origin:** SW corner of lot = (0, 0), bottom-left at street.
**X-axis:** Left to right (east). **Y-axis:** Street toward rear (north).
**House:** `houseOffsetSide` from left edge, `houseDistFromStreet` from front.
**Deck:** Centered on house rear wall. `deckOffset` shifts left/right.
**Polygon vertices:** Clockwise from street-side SW corner. Edge 0 = street.
**Frontend SVG:** `sx(lx)` = lot X to SVG X. `sy(ly)` = lot Y to SVG Y (Y flipped).
**Backend matplotlib:** Same coordinate system. Y increases upward.

### Parcel Lookup Coordinate Conversion (S63)
Realie API returns lat/lng GeoJSON polygon. Conversion to local feet: `x = (lng - min_lng) * 364000 * cos(min_lat)`, `y = (lat - min_lat) * 364000`. Origin at min_lat/min_lng vertex (SW-most point of polygon).

**CRITICAL LIMITATION:** We assign edge 0 (first edge in GeoJSON) as the "street" edge, but this may be ANY side of the property. If the actual street is on the north side, our page is flipped -- "up" is south, not north. We do NOT auto-set the north angle for this reason. The user sets it manually via the compass dial.

**House rotation not supported:** The house rectangle is always axis-aligned. Real houses follow the lot's rotation angle. This is a known gap (see S64 roadmap).

---

## Wizard Step Order

| Step | Name | Purpose |
|------|------|---------|
| 0 | Site Plan | **Address lookup (primary)**, survey upload, or manual entry. Lot shape, house position, setbacks, site elements, north arrow, slope |
| 1 | Size & Shape | Deck width/depth/height, zones, chamfers, stairs. House dims pre-filled from extraction/lookup. |
| 2 | Structure | Joists, beams, posts, attachment, snow/frost. Species hidden (DFL default). |
| 3 | Finishes | Decking type, railing, guard height, cost breakdown |
| 4 | Review | Project info, permit readiness card (S60), summary, PDF generation |

---

## Multi-Stair System (S64 -- NEW)

### Data Model
```
p.deckStairs = [
  {
    id: Number,           // unique, auto-increment via p._nextStairId
    zoneId: Number,       // which zone (0 = main deck, 1+ = zones)
    location: String,     // "front" | "left" | "right" (relative to zone)
    width: Number,        // stair width in feet (3-12)
    template: String,     // "straight" | "lLeft" | "lRight" | "switchback" | "wrapAround" | "wideLanding"
    offset: Number,       // offset from center along exit edge (feet)
    anchorX: Number|null, // manual anchor X in zone-local coords (null = compute from location+offset)
    anchorY: Number|null, // manual anchor Y in zone-local coords
    angle: Number|null,   // manual angle (0/90/180/270)
    numStringers: Number, // default 3
    runSplit: Number|null,// for multi-run templates (% for first run)
    landingDepth: Number|null,
    stairGap: Number,     // gap between runs (switchback/wrap), default 0.5
  }
]
```

### Migration
`_migrateStairs(p)` in app.js converts old flat params (`p.hasStairs`, `p.stairLocation`, etc.) to `deckStairs` array on project load. Called in `loadProject()`.

### Backward Compatibility
`_syncFlatStairParams(p)` copies first zone-0 stair's values back to flat params (`p.hasStairs`, `p.stairLocation`, `p.stairWidth`, etc.) for backend PDF rendering which still reads flat params. Called whenever `deckStairs` changes.

Reverse sync: when flat params change via `u()` (e.g., from old code paths), the first zone-0 stair in deckStairs is updated via `_stairFieldMap` in the `u` function.

### Management Functions (app.js)
- `addStair(zoneId)` -- adds a default stair to the specified zone
- `removeStair(stairId)` -- removes a stair by ID
- `updateStair(stairId, field, value)` -- updates a single field (resets anchor when location changes)
- `updateStairFields(stairId, fields)` -- batch updates multiple fields in one state change (for drag). Only clears anchorX/Y/angle when NOT setting anchor directly.
- `getStairsForZone(zoneId)` -- returns array of stairs for a zone

### Zone-Aware Placement (stairGeometry.js)
`getStairPlacementForZone(stair, zoneRect)` -- computes anchor position in zone-local coords. Returns `{ anchorX, anchorY, angle }`. If stair has manual anchor (non-null), returns it directly. Otherwise computes from location + offset.

### 3D Rendering (deck3d.js)
- `resolvedStairs` array: iterates `p.deckStairs`, for each stair computes geometry via `computeStairGeometry`, placement via `getStairPlacementForZone`, and world-space bounding box (WBB)
- `allStairWBBs`: array of all stair world bboxes, used for:
  - Board gap cutting (all zones)
  - Railing gap cutting (all zones)
  - Corner post filtering
- Zone 0 joist/beam/rim splitting uses `frontGap`/`leftGap`/`rightGap` from first zone-0 stair (backward compat)
- Each stair group positioned at `(rs.wax, 0, rs.waz)` -- world-space anchor computed from zone rect + placement

### Plan View (planView.js)
- Iterates `p.deckStairs`, renders each stair positioned at `dx + (zr.x + placement.anchorX) * sc`
- **Drag system (rewritten S64 Push 13):** Stair follows cursor directly -- converts mouse to zone-local feet, sets as anchorX/anchorY. On release, snaps to nearest edge if within 1.5ft, otherwise stays at manual position.
- **Rotation handle:** When stair is selected, shows rotation circle above stair. Dragging computes angle from center, maps to front/left/right location.
- SVG viewport extends to include full zone bounding box (Push 14, needs testing)

### UI (steps.js)
- Per-zone stair cards appear for ALL zones (not locked to zone 0)
- Each card shows: location chips, width slider, stringers slider, template grid, offset slider
- Advanced controls (run split, landing depth, gap) show for multi-run templates
- "Add Stairs" button at bottom of zone's stair section
- Remove button (x) on each stair card

### Known Multi-Stair Gaps
1. **Engine.js** only computes stair materials for first zone-0 stair (flat params)
2. **Review step** only displays zone-0 stair info
3. **Backend PDF** only renders zone-0 stairs (known gap, flat params)
4. **Plan view setback warnings** only account for zone-0 stair footprint
5. **Zone deletion** removes orphaned stairs (implemented in Push 11)
6. **SVG viewport** -- Push 14 extends viewport for zones, needs testing at session start
7. **Stair-to-stair collision detection** not implemented

---

## Step 0 UX Flow (S63)

### Three paths to set up the lot:
1. **Address Lookup (primary, highlighted):** User types address + state (+ optional city/zip). Backend calls Realie API, returns parcel polygon + building sqft + property metadata. Frontend auto-populates lot vertices, dimensions, house size/position, property info. User confirms on "verify_extracted" screen.
2. **Survey Upload:** PDF or photo. AI extracts lot shape, dimensions, house position via Sonnet/Opus. User picks from shape candidates.
3. **Manual Entry:** User enters lot width, depth, house dimensions via sliders.

### Guided mode is default (S63)
`guideActive` defaults to `true` (was `null`/choice screen). Users go straight to "How should we get your property info?" with AI helper visible. No clicking "Guided Setup" first. Manual mode accessible via "Switch to manual" link.

---

## Parcel Lookup System (S63)

### Architecture
`POST /api/parcel-lookup` -> `_realie_lookup()` -> Realie API -> parse + transform -> return

### Key Details
- Endpoint: `GET https://app.realie.ai/api/public/property/address/?state=XX&address=YY`
- Auth: `Authorization: <api_key>` header (raw key, not Bearer)
- Free tier: 25 lookups/month. Parcel cache table prevents duplicate API calls.
- City param requires county (which we don't have), so we only send address + state

---

## IRC 2021 Structural Data

### Joist Spans -- VERIFIED (S59)
IRC 2021 Table R507.6. All 3 species groups, all 4 load tiers (40/50/60/70 PSF).

### Beam Spans -- VERIFIED (S60, critical fix end-of-S62)
IRC 2021 Tables R507.5(1)-(4). Full 4D lookup. ~824/827 match ICC source.

### Depth Cap (S62)
Engine computes exact IRC prescriptive max depth for user's config. When exceeded: `engineering_required` flag + specific warning message.

---

## Chamfer System (S61)

Chamfer awareness in data layer (`zone_utils.py`). `_chamfered_vertices()` is single source of truth. Rendering uses chamfered polygon for plan view (A-1) outlines, board clipping, framing clipping, railing edges.

### Known chamfer gaps
- A-2 elevations still rectangular
- A-5 site plan still rectangular
- Cover sheet area doesn't subtract chamfer triangles
- Zone chamfer railing length only adjusted for mainCorners in engine.js

---

## Project Persistence (S62, improved S63)

### Architecture
- `projects` table: id, user_id, name, status, params_json, info_json, step, site_plan_mode, survey_b64, last_generation_id, city, state, zip, created_at, updated_at
- Auto-save debounced 3s for logged-in users
- Smart creation gate: `userEditedRef` must be true before project is created
- OAuth state preservation via localStorage

---

## PDF Output

| Sheet | Source | Notes |
|-------|--------|-------|
| Cover (A-0) | draw_cover.py | Compliance stamp, LUMBER row, ZONING/COUNTY/YEAR BUILT rows |
| A-1 Plan & Framing | draw_plan.py | Chamfer-aware outlines+clipping, zone labels with per-zone sizing |
| A-2 Elevations | draw_elevations.py | Guard height from calc |
| A-3 General Notes | draw_notes.py | Lumber design basis note |
| A-4 Structural Details | draw_details.py | Spec-driven |
| A-5 Site Plan | draw_site_plan.py | Parcel ID + zoning in subtitle, vicinity map |
| PPRBD Sheet | jurisdiction_sheet.py | COS only |
| Materials | draw_materials.py | Per-zone sizing, separate PDF |

### P0 Issues (would cause permit rejection)
1. **Freestanding deck bracing** -- notes mention but drawings don't show
2. **Chamfers not on A-2/A-5** -- elevations and site plan show rectangular deck
3. **Stair templates not on PDF** -- all render as straight
4. **Multi-stair not on PDF** -- only zone-0 stair renders (S64 gap)

---

## Frontend/Backend Parity

### Known gaps
| Feature | Gap |
|---------|-----|
| **Multi-stair** | Frontend supports N stairs on any zone; backend only renders zone-0 stair |
| **Chamfers on A-2/A-5** | Frontend renders 3D chamfers, PDF elevations/site plan still rectangular |
| **Stair templates** (L/switchback/wrap) | Frontend renders, backend treats all as straight |
| **Freestanding bracing** | Notes mention it, nothing drawn |
| **Zone chamfer railing length** | engine.js only adjusts mainCorners, not zone chamfers |
| **House rotation** | Parcel lookup returns angled lots, house always axis-aligned |

---

## File Structure (11 JS files + backend)

| File | Lines | Last Modified |
|------|-------|---------------|
| `backend/app/main.py` | ~2145 | S63 |
| `backend/app/database.py` | ~1221 | S63 |
| `backend/app/auth.py` | ~95 | S55 |
| `backend/static/index.html` | ~85 | S64 |
| `backend/static/admin.html` | ~670 | S62 |
| `backend/static/js/engine.js` | ~476 | S62 |
| `backend/static/js/steps.js` | ~3766 | S64 |
| `backend/static/js/app.js` | ~1375 | S64 |
| `backend/static/js/home.js` | ~206 | S62 |
| `backend/static/js/tracking.js` | ~149 | S55 |
| `backend/static/js/traceView.js` | ~576 | S43 |
| `backend/static/js/sitePlanView.js` | ~635 | S63 |
| `backend/static/js/elevationView.js` | ~497 | S58 |
| `backend/static/js/planView.js` | ~503 | S64 |
| `backend/static/js/deck3d.js` | ~967 | S64 |
| `backend/static/js/stairGeometry.js` | ~167 | S64 |
| `backend/static/js/zoneUtils.js` | ~425 | S24 |
| `backend/drawing/calc_engine.py` | ~628 | S62 |
| `backend/drawing/irc_tables.py` | ~3874 | S62 |
| `backend/drawing/irc_tables_round2.py` | ~204 | S62 |
| `backend/drawing/permit_checker.py` | ~1676 | S62 |
| `backend/drawing/permit_spec.py` | ~422 | S61 |
| `backend/drawing/draw_plan.py` | ~733 | S61 |
| `backend/drawing/draw_elevations.py` | ~1129 | S58 |
| `backend/drawing/draw_notes.py` | ~349 | S60 |
| `backend/drawing/draw_details.py` | ~310 | S57 |
| `backend/drawing/draw_materials.py` | ~395 | S60 |
| `backend/drawing/draw_site_plan.py` | ~891 | S63 |
| `backend/drawing/draw_cover.py` | ~260 | S63 |
| `backend/drawing/zone_utils.py` | ~289 | S61 |
| `backend/drawing/title_block.py` | ~167 | S45 |
| `backend/drawing/jurisdiction_sheet.py` | ~197 | S50 |
| `backend/drawing/stair_utils.py` | ~61 | S24 |
| `tests/test_structural.py` | ~267 | S62 |
| `tests/test_future_products.py` | ~252 | S62 |

---

## Session 64 History (14 pushes)
**Theme:** Multi-Stair System + 3D Stair Fix

### Push 1: Stair gap cutting for zone boards and railing
- Computed stair world-space bounding box (stairWBB) from anchor + rotation angle
- Board loop checks stairWBB for ALL boards (fixes zone boards clipping through stairs)
- Railing loop checks stairWBB for zone edges

### Push 2: Filter corner posts inside stair footprint
- Skip railing corner posts that fall within stairWBB
- Fixes post appearing in middle of stair opening at zone junction corners

### Push 3: Multi-stair foundation + 3D + UI (BIG PUSH)
- `deckStairs` array data model with per-stair objects
- Migration from flat params (`_migrateStairs`)
- `_syncFlatStairParams` for backward compat with backend
- `addStair`/`removeStair`/`updateStair` management functions
- 3D: `resolvedStairs` array iterates deckStairs, per-stair geometry/placement/WBB
- 3D: `allStairWBBs` merged array for gap cutting in boards + railing
- 3D: Stair groups positioned relative to owning zone rect
- UI: Per-zone stair cards with full controls
- stairGeometry.js: `getStairPlacementForZone(stair, zoneRect)`

### Push 4: Multi-stair plan view rendering
- planView.js iterates `p.deckStairs`, positions each stair relative to zone rect

### Push 5: Reverse sync flat stair params to deckStairs
- When drag handlers update flat params, also update first zone-0 stair in deckStairs

### Push 6: Pointer events fix (superseded by Push 7)

### Push 7: Removed stair drag (reverted in Push 8)

### Push 8: Per-stair drag handles in plan view
- Each stair independently draggable, updateStair passed to PlanView

### Push 9: Per-stair rotation handle
- Circle with arrow icon above selected stair, drag to change direction

### Push 10: Free-form drag with edge snapping
- Drag uses snapStairToEdge, batched updateStairFields for location+offset

### Push 11: Fix stair drag + robustness
- Root cause: snapStairToEdge threshold (1.5ft) meant drag only worked near edges
- Zone deletion now cleans up orphaned stairs
- Fixed wrong function reference in early return check

### Push 12: Restore free positioning with edge snapping
- Near edge: snaps to edge mode. Away from edges: manual anchor position.
- updateStairFields only clears anchor when NOT setting anchor directly

### Push 13: Clean rewrite of stair drag system
- Rewrote from scratch: stair follows cursor directly (mouse -> zone-local feet -> anchor)
- No deltas, no start tracking, no complex state
- On release near edge: snap to edge mode. Otherwise: stay at manual position.

### Push 14: Extend plan view SVG to show full zone bounds (NEEDS TESTING)
- SVG viewport adds zone overshoot (right, left, down) to dimensions
- Zones extending beyond main deck no longer clipped
- Enables cursor to reach zone outer edges for stair positioning

### Key Lessons (S64)
- **Rewrite over patch:** The stair drag system was patched 6 times (Pushes 5-12) before being rewritten from scratch in Push 13. The rewrite was simpler and more correct than any patch.
- **Circular dependencies in SVG sizing:** SVG dimensions depended on houseCx which depended on SVG dimensions. Broke the cycle by adding zone overshoot directly instead of recomputing center.
- **Coordinate systems matter:** Zone-local vs zone-0-relative vs SVG coords caused multiple bugs. The clean approach: always convert mouse position to zone-local feet, don't track deltas.
- **Threshold bugs are invisible:** The 1.5ft snap threshold meant stair drag silently failed on large decks (>3ft from any edge = dead zone). Only discovered after systematic analysis.
- **`var` hoisting gotcha:** Using `hasZones` (defined with `var`) before its assignment line caused it to be `undefined`, silently disabling zone-aware SVG sizing.

---

## Prioritized Roadmap

### S65: Test S64 + Multi-Stair Polish + UX Items from S63
1. **Test Push 14** -- verify SVG viewport extension works for zone stair dragging
2. **Stair materials from deckStairs** -- engine.js should compute materials for ALL stairs, not just zone-0
3. **Review step multi-stair display** -- show all stairs, not just zone-0
4. **Preview text size** -- increase font sizes in planView, elevationView, deck3d. Add fullscreen toggle.
5. **Slider debounce** -- choppy dragging on dimension sliders. Add requestAnimationFrame or debounce.
6. **Permit checker plain-English explanations** -- users see warnings but don't understand them.
7. **Deck wider than house warning** -- edge case UX warning.

### S66: Drawing Accuracy
8. **Chamfer area subtraction** -- deck SF on cover sheet should subtract chamfer triangle areas
9. **Zone chamfer railing in engine.js** -- frontend only adjusts mainCorners, not zone chamfers
10. **beam_h in draw_elevations.py** -- 4 TODOs to derive from calc["beam_size"]
11. **Chamfer on A-2 elevations** -- south/north elevation outline should reflect chamfered front edge
12. **Chamfer on A-5 site plan** -- site plan deck outline should show chamfers

### S67: Stair Templates + Bracing + Multi-Stair PDF
13. **Stair template rendering on PDF** (L-shape, switchback minimum)
14. **Multi-stair PDF rendering** -- iterate deckStairs in draw_plan.py
15. **Freestanding deck bracing** drawn on A-1 and A-2

### S68: Aerial Imagery + Site Elements
16. **Phase 1:** Fetch Google Static Maps aerial image, show as reference overlay
17. **Phase 2:** AI detection of structures from aerial image

### S69: House Rotation
18. **House rotation to match lot angle** -- significant: touches collision detection, setback rendering, deck positioning

### Beta Launch (after S67)
- Flip `SB_PHASE` to `beta` on Railway
- Beta is FREE (no Stripe checkout)
- Submit to 3-5 building departments for validation

---

## Remaining TODOs

### Code TODOs
- `draw_elevations.py` (4 places): `beam_h = 1.0 # TODO: derive from calc["beam_size"]`
- `deck3d.js:130`: `var zH = H; // TODO Phase 3: per-zone height from zone.h`
- `main.py:1096`: insight analysis prompt still says "permit-ready"
- `calc_pergola.py`: IRC rafter table values need wiring from irc_tables.py
- `calc_shed.py`: IRC stud/rafter/floor joist values need wiring from irc_tables.py

### Known Gaps
- Multi-stair not on PDF (only zone-0 stair renders)
- Engine.js stair materials only for zone-0 stair
- Zone chamfer railing length in engine.js
- Chamfer area not subtracted from cover sheet SF
- Chamfers not rendered on A-2 elevations or A-5 site plan
- Stair templates not rendered on PDF (all show as straight)
- Freestanding bracing not drawn
- House rotation to match lot angle
- Street edge detection for north angle auto-set
- Vicinity map sizing/placement not matching reference plans

---

## Standing Practices

**Cache busters:** `?v=s64n`. Format: `?v=sXXy`. Bump on any JS push.
**Architecture:** `window.*` export pattern. TRIPWIRE at 12 JS files (currently 11).
**Encoding:** All drawing files use plain ASCII comments.
**Visual verification:** Never confirm visual fixes from text extraction.
**Lumber species:** Default DFL/HF/SPF. NOT user-selectable.
**Beam lookup:** Use `get_beam_max_span()` and `auto_select_beam()`.
**Snow load:** `LL = max(40, snow)`, NOT `40 + snow`.
**Guard height:** Auto 36" standard, 42" for >8'. Override with 36" IRC floor.
**Phase tagging:** `SB_PHASE` env var. Current: `testing`.
**Push workflow:** git clone/push via github.com (not api.github.com).
**AI Helper cost:** ~$0.01/text (Sonnet), ~$0.05-0.08/image (Opus). Max tokens: 250 text, 500 image.
**AI Helper brevity:** Must include ABSOLUTE RULE at end of system prompt.
**3D rendering lesson:** Think in 2D plan view first for stair/deck overlap.
**Chamfer data flow:** `mainCorners`/`zone.corners` -> `_chamfered_vertices` in zone_utils.py -> polygon outlines + exposed edges.
**Zone sizing flow:** Computed once in `permit_spec.py` via `spec["zone_calcs"]`.
**Deferred loading:** Three.js + views + steps load lazily via `_loadWizardDeps()`.
**Project auto-save:** Debounced 3s, logged-in users only.
**Permit language:** Never say "permit-ready" or "guaranteed to pass" in user-facing UI.
**Parcel lookup:** Realie API, address + state only. Cache results in parcel_cache table. 25 free lookups/month.
**Vicinity map:** staticmap + CartoDB light_all tiles. Renders at PDF generation time.
**Guided mode default:** guideActive defaults to true.
**Multi-stair data flow (S64):** `p.deckStairs` -> `getStairPlacementForZone()` -> zone-local anchor -> world-space via zone rect offset. `_syncFlatStairParams` keeps flat params in sync for backend. `updateStairFields` batches multiple field changes for drag.
**Stair drag (S64):** Direct cursor tracking (mouse -> zone-local feet -> anchorX/Y). On release: snap to edge if within 1.5ft, otherwise stay at manual position. No deltas, no start tracking.
**Plan view SVG sizing (S64):** Extends viewport with `_extraRight`, `_extraLeft`, `_extraDown` from zone bounding box overshoot.

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
| `REALIE_API_KEY` | Realie parcel lookup API |
| `REGRID_API_TOKEN` | Regrid API (unused, can remove) |

---

## Business Strategy & Market Analysis (S64 discussion)

### Product-Market Fit Assessment

**The pain point is real:** ~750,000 US homeowners per year navigate the deck permit process themselves. Options today: pay $300-500 for a human drafter (slow, expensive), buy generic plans from Etsy for $20-40 (don't match your property, get rejected), or try to draw plans yourself (most can't).

**SimpleBlueprints fills a genuine gap:** Automated parametric permit-drawing generation with verified structural tables for a specific property. Nobody else does this.

**What makes the product sticky:** Address lookup auto-fills everything (magic for homeowners), AI helper feels like having an expert, materials estimate answers "what will this cost," permit checker catches issues before submission.

### Competitive Landscape

**Pre-drawn plan sites (MyOutdoorPlans, DecksGo, Etsy sellers):** $20-40 generic plans. Not customized to property, codes, or jurisdiction. Homeowner still gets rejected because plans don't show THEIR setbacks. Cheapest option but doesn't solve the problem.

**Lowe's/Home Depot/Trex deck designers:** Marketing tools. Pick colors, see render, get shopping list, find contractor. Zero permit value. No structural calcs, no site plan, no code references. Solving "what should my deck look like" not "how do I get a permit."

**Decks.com (Trex parent):** Same story. Design tool, not permit tool.

**Online drafting services (24hPlans, Thumbtack, Fiverr):** Most direct competitors. Real humans, $200-500, 2-7 day turnaround. Quality varies. Good ones produce professional stamped drawings. Cheap ones produce garbage.

**SketchUp with plugins:** Requires expertise. Not for homeowners.

**Nobody is doing automated parametric permit-drawing generation.** The gap exists because: architects think decks are beneath them, software companies think permitting is too messy, people who know construction don't build software, and people who build software don't know construction.

### Why We Can Do This (Moats)

**Verified structural data:** 824/827 IRC values cross-checked against ICC source. Took 4 sessions (S59-S62). A competitor starting from scratch hits every wall we already solved.

**Domain engineering, not AI:** The AI is a thin UX layer. The core is parametric engines with verified tables, a wizard UI, and PDF rendering. This is durable -- not dependent on any AI provider.

**The right analogy is TurboTax, not ChatGPT.** TurboTax does $5B+ because the value isn't understanding taxes -- it's the specific, verified, tested logic for every edge case connected to filing systems. SimpleBlueprints is the same pattern: AI can explain what a joist span table is, but our platform actually produces a correct blueprint with verified data for a specific property.

**Speed advantage matters.** The biggest risk isn't general AI commoditizing this (it won't, because "looks right" vs "passes permit review" is a chasm). The risk is a well-funded team throwing 5 engineers at the same problem. Speed to beta and jurisdiction validation are the priorities.

### Honest Product Gaps (Critical Assessment)

**Engineering stamp:** Many jurisdictions require PE/architect stamp on deck plans, especially >30" above grade. SimpleBlueprints cannot provide a stamp. Value proposition may be "save $300 on drafting" not "skip the professional entirely."

**Jurisdiction variability:** We produce one output format. Different counties want different sheet orders, separate grading plans, manufacturer spec sheets, soil reports, or pre-printed forms. Beta validation with 3-5 departments will reveal how bad this is.

**Ledger connection details:** The #1 cause of deck collapses and the most scrutinized item by reviewers. Our general notes reference proper attachment but we don't detail specific flashing, lag bolt pattern, or waterproofing for the user's wall type (vinyl vs brick vs stucco).

**Soil bearing hardcoded at 1500 PSF:** Wrong for many locations. Some jurisdictions require soil tests. We don't even ask about soil conditions.

**PDF output looks generated:** Matplotlib drawings look like software output compared to hand-drafted reference plans. Plan reviewers develop intuitions about submissions. This triggers extra scrutiny.

**No rejection support path:** User pays $59, gets rejected. Now what? No revision service, no escalation to professional, no refund framework.

### Revenue Projections (Realistic)

**Pricing:** $49-79 per blueprint package. Alternative is $300-500 human drafter. Easy yes at $59.

**Year 1 (post-beta): $500-3,000/month.** 10-50 paying users/month from organic search, Billy's network, forums. SEO takes time to build.

**Year 2: $3,000-15,000/month.** Requires building department validations as marketing asset + compounding SEO. Contractor referrals (one contractor = 10-20 purchases/year).

**Year 3+: $15,000-50,000/month.** Requires expanding to pergolas/sheds/fences (4x addressable market) and/or contractor subscription tier ($99/month unlimited).

**Partnership upside (year 2-3):** Local lumber yard integrations, contractor networks. NOT Trex/TimberTech (they're year-3+ conversations requiring proven traction data).

**Cost structure is favorable:** Marginal cost per generation is near zero (API calls + compute). Railway is cheap. Profitable at very low volumes.

### Go-to-Market Sequence

1. **Beta with real homeowners + 3-5 building departments** -- validate output passes review
2. **A few local contractors as repeat users** -- validate contractor use case
3. **Couple independent lumber yards as referral partners** -- validate distribution channel
4. **Only then approach bigger players** with actual data ("X plans generated, Y% accepted, Z contractors monthly")

### Materials List as Revenue Driver

**Current state:** Rough cost estimator. "14 2x8 joists, $22 each." Useful for "should I even do this" decision but can't be handed to a lumber counter.

**Target state:** Purchasable cut list. "14 pieces 2x8 at 11'-6", cut from 8 twelve-footers." Specific lengths based on actual deck geometry. Optimized standard lumber lengths (8/10/12/14/16/20ft) minimizing waste. Simpson Strong-Tie part numbers (already started in S51). Concrete volume per footing.

**Why this matters for partnerships:** A rough estimate is information. A cut list is an order. Lumber yards don't care about estimates. They care about transactions they can fill. The cut list upgrade transforms the materials page from a feature into a standalone product that happens to come WITH permit drawings.

**Build estimate:** 2-3 sessions. The geometry data already exists in the engine. This is reformatting existing data + lumber length optimization algorithm.

### Affiliate Programs (Researched S64)

| Retailer | Commission | Cookie | Network | Notes |
|----------|-----------|--------|---------|-------|
| Home Depot | 2-8% by category | 1 day | Impact Radius | Free to join, need relevant website. Building materials on low end (1-2%) |
| Lowe's | 2% standard, up to 20% Creator Program | 1 day | CJ Affiliate | Explicitly excludes lumber. Creator Program has better rates |
| Amazon | 3% home improvement | 1 day | Amazon Associates | Need 3 sales in 180 days for Product Advertising API access |

**Commission reality check:** On a $2,000 deck materials order, affiliate commission = $40-60. At 100 orders/year = $4,000-6,000 supplementary income. Not primary revenue.

**The real value is UX, not commission:** "14 2x8 joists" vs "14 2x8x12 Pressure Treated - $8.47 each at Home Depot [Buy]". Transforms materials list from reference document to shopping cart. Makes the $59 blueprint stickier.

**Amazon API is best starting point:** Product Advertising API gives full catalog search (prices, images, availability). Most developer-friendly. Materials list items ("2x8x12 Pressure Treated", "Simpson LUS28") are directly searchable product names.

**Integration phases:**
1. Amazon affiliate links on materials list (1 session)
2. Home Depot as alternative retailer option (1 session)
3. "Send to cart" pre-filled shopping cart feature (future)

**Action item:** Join all three affiliate programs now (free, 10 min each). SimpleBlueprints.xyz qualifies for all of them.

### Visual/UX Gaps vs Competitors (Trex, Decks.com)

**Where they crush us:**
- Beautiful 3D renders with real material textures, lighting, furniture. Users screenshot and show spouse.
- Real product selection (Trex Transcend in Havana Gold vs our "composite or PT")
- 30-second time to first design (draw shape on grid). We ask lot/house/setback questions first.
- Mobile-native experience. We're desktop-first.
- Inspiration gallery and educational content before the tool.

**Where we crush them:**
- Structural calculations (they have zero)
- IRC code references
- Site plan with actual property boundaries
- Setback compliance checking
- Multi-sheet permit drawing package
- Parcel-specific data (zoning, year built, parcel ID)

**Closing the gap (prioritized):**

| Priority | Item | Sessions | Impact |
|----------|------|----------|--------|
| 1 | Reorder wizard: deck design first (fun), site plan later (necessary) | 1 | High - first impression |
| 2 | 3D visual polish: textures, lighting, decking color options | 2-3 | High - emotional buy-in |
| 3 | Landing page with gallery renders + educational content | 1 + ongoing | High - SEO + trust |
| 4 | Expanded material/finish choices with cost tiers | 1 | Medium - product depth |
| 5 | Cut list upgrade (materials as purchasable order) | 2-3 | High - partnership enabler |
| 6 | Mobile responsive polish (fullscreen preview, touch-friendly) | 2-3 | Medium - growth |
| 7 | Affiliate product links on materials list | 1 | Low revenue, high UX |

### AI Threat Assessment

**Will general AI generate deck blueprints in 2 years?** Partially. Someone will prompt Claude/GPT and get something that looks like a deck plan. But "looks like" and "passes permit review" are worlds apart.

**What AI will commoditize:** Nice-looking drawings, general deck Q&A, rough cost estimates, generic code summaries.

**What AI won't commoditize easily:** Verified IRC lookup tables (4D beam span = load tier x species x size x joist span), jurisdiction-specific requirements, exact building department formatting, parcel-specific data integration, liability-aware language, permit checking against real code.

**The real threat isn't general AI -- it's someone building exactly what we're building.** If a competitor spends 6 months verifying IRC tables, building parcel lookup, testing with building departments, and creating a polished wizard -- that's competition. Not ChatGPT.

**Defense strategy:**
1. Speed to beta + building department validation (every approval is data no competitor has)
2. Expand to other structure types (pergolas, sheds, fences -- multiply value of platform)
3. Build jurisdiction relationships (distribution moat)
4. Use AI internally to move faster while competitors figure out if their joist spans are correct

### Why No One Built This Before

The market falls between two stools. Architects think deck plans are beneath them. Software companies think permitting is too messy. Neither sees the opportunity.

The domain knowledge barrier is deceptive. "Just read the IRC" leads to: footnotes that change lookup logic, 4D beam tables, snow load replacing (not adding to) live load, prescriptive depth limits, jurisdiction amendments. We discovered all of these through 64 sessions of painful debugging.

The people who know construction don't build software. The people who build software don't know construction. The rare overlap (BD experience + technical product management + subject matter expert) is why this can exist.

The enabling technology isn't AI -- it's parcel data APIs (Realie), serverless deployment (Railway), and React making it possible for a small team to build what required 10 engineers five years ago.

### CAD Assessment (Decided: Not Needed)

**Evaluated and rejected.** Plan reviewers check content, not aesthetics. Correct dimensions + structural member sizes + code references = pass. Beautiful CAD drawing with wrong joist spans = rejection.

**Current matplotlib approach wins:** Parametric (change a dimension, entire drawing regenerates in seconds), easy to iterate, simple to debug. CAD integration would be weeks of rewriting 8 draw_*.py files for marginal visual improvement.

**Better investment:** Make matplotlib output look more professional (cleaner dimension lines, consistent line weights, polished title block). Match reference plan quality through graphic design conventions, not tool changes. 1-2 sessions vs weeks.

**DXF export as future additive feature:** If contractors/architects become a market segment, add a DXF export layer that translates existing parametric data to DXF format WITHOUT replacing matplotlib for PDF. Additive, not a rewrite.
