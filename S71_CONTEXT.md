# SimpleBlueprints - Session 71 Context File
**Date:** April 2026
**Repo:** `github.com/Wilwixqa1/simpleblueprints`
**Live site:** `simpleblueprints-production.up.railway.app`
**Custom domain:** `simpleblueprints.xyz`
**Stack:** Split React/Babel frontend (11 JS files) + Python FastAPI backend on Railway. GitHub push to `main` auto-deploys in 60-90s. PyMuPDF for PDF page filtering. Realie API for parcel lookup. staticmap + CartoDB tiles for vicinity maps.
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
- **Understand Before Fixing:** If Claude can't explain the root cause, Claude doesn't understand the problem. (S67 lesson: spent 6+ pushes treating stair-landing clipping as a rendering issue when it was a geometry issue in stairGeometry.js.)
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
- **Rewrite Over Patch (S64):** When a feature has been patched 3+ times and still doesn't work, rewrite the function from scratch instead of adding more patches.
- **Trace Full Dependency Chain (S65):** When a feature works in frontend but not in PDF, trace the entire data flow from frontend state -> API request body -> Pydantic model -> generate function -> drawing module. Pydantic silently drops undeclared fields.
- **Match Reference Output (S66):** When Billy provides reference drawings, match the format as closely as possible. Billy's drawings pass permits. Don't reinvent.
- **Geometry Before Rendering (S67):** When 3D visuals look wrong, check the GEOMETRY first (stairGeometry.js, zone rects, coordinate positions). Rendering fixes (clipping, material changes, thickness tweaks) are bandaids if the underlying geometry is wrong.
- **Trace Actual Coordinates (S67):** When debugging spatial issues, compute actual numeric coordinates (e.g. run a trace script with node). Don't reason about geometry abstractly.
- **Callout Complexity Scales With Stair Complexity (S68):** Straight stairs get minimal annotation (stringer count, rise/run). Multi-run stairs get per-run dims, landing callouts, landing post labels.
- **py_compile Before Push (S69):** Always run `py_compile.compile()` on modified Python files before pushing. A 2-second syntax check prevents deploy failures.
- **Preview vs PDF Label Convention (S69):** Preview uses "DOWN" (shifted up in run) for compact display. PDF uses "DOWN" (centered in run). Different contexts, same label, optimized positioning.
- **Scope Check From User Perspectives (S70):** For every change, think from the perspectives of: DIY homeowner, General Contractor, and Architect. Different users have different needs. Don't over-optimize for one at the expense of another.
- **Wire Props Not Closures (S70):** When components reference functions from a parent component, pass them as props. Don't rely on JS closure scope across React components. S70 found `_applyActions` and `setChatMessages` were out of scope in GuidePanel, causing silent failures of AI suggestion buttons.
- **Compliance Requires Full Implementation (S70):** Don't ship "quick win" warnings without the full compliance check. If users can override structural values, the permit checker must validate every override against its actual engineering requirement.

---

## Billy's Reference Format (S68, 3 approved PDFs analyzed)

Billy (architect Rick Rutstein, "All Things Architecture") has 3 reference PDFs that pass PPRBC/IRC review: Ilaria (straight stair, 5 sheets), Loucks (switchback stair, 5 sheets), Welborn (steel framing, 4 sheets).

### What We Match
- Simpson hardware callouts (model numbers, quantities, pier dimensions)
- 4-view elevation layout with grade hatching and graphic scale bars
- Deck attachment sheet + cantilever detail on A-6
- Stair at lower landing detail on A-4
- Hardware schedule on A-4
- Loads box with LL/DL/TL/lumber/ledger
- Stair notes box on plan sheet (IRC rise/run/nosing requirements)

### Conditional Callout Rules (derived from Billy's patterns)
- **"DOWN" label**: Always present when stairs exist
- **Per-run dimensions**: Only on multi-run stairs (Loucks switchback has them, Ilaria straight does not)
- **Landing post/pier callouts**: Only when landings exist (with pier circles drawn)
- **"CONCRETE LANDING"**: Only for ground-level pad at stair base
- **Stair notes box**: On plan view, only when stairs exist. Condensed 5-line version.
- **Template name**: Never shown. Billy draws the geometry and lets the shape speak.

---

## 3D Rendering Architecture (S67 overhaul)

### File: `deck3d.js` (~1163 lines)

Three standalone helper functions + two main consumers:

#### `setupSceneEnv(scene, p, THREE)` (line ~12)
Shared environment setup used by BOTH interactive preview and PDF capture. Contains:
- Background color + fog (0xf5f2eb)
- 3 lights: ambient, sun (with shadows), fill
- Ground plane (natural grass green 0x6b8f4a, no grid)
- Slope tilt logic (4 directions, 3x exaggerated)

**Rule:** Any change to lighting, ground, or atmosphere MUST be here. Never duplicate in Deck3D or capture3D.

#### `addHouse(scene, cfg, mats, THREE)` (line ~58)
Config-driven house rendering. Called from buildDeckScene with:
```js
addHouse(scene, {
  width: p.houseWidth, depth: 14, height: Math.max(H + 8, 12),
  x: z0wx + (W - p.houseWidth) / 2 - dOff, z: z0wz - _houseDepth,
  deckHeight: H, doorX: z0wx + W / 2,
  showDoor: true, showWindows: true
}, mats, THREE);
```

#### `addM(geo, mat, x, y, z, shadow)` (line ~108)
Safe mesh creation helper. Fixes the Three.js bug where `scene.add(mesh).position.set()` sets the scene position, not the mesh position.

**Rule:** NEVER use `scene.add(new THREE.Mesh(...)).position.set(...)`. Always use `addM()`.

#### `buildDeckScene(scene, p, c, THREE)` (line ~122)
Main scene population function. Adds all deck geometry. Called by both Deck3D (interactive) and capture3D (PDF cover). Returns `{ exitSide }` for camera positioning.

#### `Deck3D({ c, p })` (line ~940) and `capture3D(p, c)` (line ~1010)
Interactive preview and offscreen PDF capture respectively.

---

## Stair Geometry Engine (S67 frontend + S68 backend)

### Frontend: `stairGeometry.js` (167 lines)
`computeStairGeometry(params)` handles all 6 templates: straight, wideLanding, lLeft, lRight, switchback, wrapAround.

### Backend: `stair_utils.py` (398 lines, S68)
1:1 Python port. Used by `resolve_all_stairs()` which includes a `geometry` field in each resolved stair dict.

### Run-Landing Positioning Rule (S67)
**CRITICAL:** Run 2+ must be ADJACENT to the landing, never INSIDE it.

---

## Coordinate System

**Origin:** SW corner of lot = (0, 0), bottom-left at street.
**X-axis:** Left to right (east). **Y-axis:** Street toward rear (north).
**Frontend SVG:** `sx(lx)` = lot X to SVG X. `sy(ly)` = lot Y to SVG Y (Y flipped).
**3D (Three.js):** X = left/right, Y = up/down (height), Z = front/back.

---

## Wizard Step Order

| Step | Name | Purpose |
|------|------|---------|
| 0 | Site Plan | **Address lookup (primary)**, survey upload, or manual entry |
| 1 | Size & Shape | Deck width/depth/height, zones, chamfers, stairs |
| 2 | Structure | Joists, beams, posts, attachment, snow/frost, per-footing overrides |
| 3 | Finishes | Decking type, railing (fortress/wood), guard height, cost breakdown |
| 4 | Review | Project info, permit readiness card, summary, PDF generation |

---

## Guided Mode Flow (S70 update)

Step 0 guided mode now shows a single "Look up by address" button (no more 3-choice screen). Survey upload and manual entry are accessible via "Switch to manual" button. The Property Information form is hidden during early guided phases (`has_survey`, `address_lookup`, `address_verifying`) to prevent users from filling it in and skipping the parcel lookup.

---

## Multi-Stair System (S64, completed S65)

### Data Model
```
p.deckStairs = [
  { id, zoneId, location, width, template, offset,
    anchorX, anchorY, angle, numStringers, runSplit,
    landingDepth, stairGap }
]
```

### Backend Resolution (S65, updated S68)
`resolve_all_stairs(params, calc)` in `stair_utils.py` is the single source of truth. Returns list of dicts including `geometry` field.

### DeckParams Model (S65, updated S70)
Must include `deckStairs: Optional[list] = None`, `mainCorners: Optional[dict] = None`, and `footingOverrides: Optional[dict] = None`. Any new frontend state field consumed by PDF must be added to DeckParams or it will be silently dropped.

---

## Per-Footing Diameter System (S70)

### Data Model
- `p.overFooting`: Global footing diameter override (existing, single value)
- `p.footingOverrides`: Per-post overrides (new, object with post index keys e.g. `{"0": 24, "3": 18}`)
- Keys are string indices when serialized to JSON

### Frontend UI
- Global footing diameter buttons (12/16/18/21/24/30) with AUTO/MANUAL toggle
- Expandable "Customize per post (N footings)" section below
- Each post shows position and a dropdown defaulting to global value
- Inline warning when override < recommended minimum
- Red x to clear individual overrides

### Backend Compliance
- `footingOverrides` field in DeckParams Pydantic model
- `check_footing_bearing()` in permit_checker.py computes per-post tributary areas:
  - End posts (first/last): tributary width = beam_span / 2 (half bay)
  - Interior posts: tributary width = beam_span (full bay)
- Each footing checked against its specific load requirement at 1500 PSF soil bearing
- End posts can legitimately have smaller footings than interior posts
- Fix message explains: "End posts carry less load and can use smaller footings"

---

## Zone Management UX (S70)

### Delete Buttons
- **Tab selector:** Each zone tab has a subtle x that confirms before deleting
- **Preview:** Red x circles at top-right corner of each zone rect in the plan view. Rendered late in SVG (after deck content) so they stay on top. Same visual language as green + add buttons.
- `removeZone` is passed as a prop to PlanView from app.js

---

## AI Helper System (S54+, updated S70)

### Architecture
- Backend: `build_ai_helper_prompt()` in main.py builds step-aware system prompts
- Frontend: `GuidePanel` component renders chat + suggestion buttons
- Actions streamed via SSE, parsed from `ACTIONS:` line at end of response

### S70 Fixes
- **Prop wiring:** `_applyActions` and `setChatMessages` are defined in StepContent but used inside GuidePanel. Must be passed as `onApplyActions` and `setChatMessages` props. Before S70, these were out of scope causing silent button failures.
- **Suggestion fallback:** If a suggestion button has no recognized action types, clicking it sends the label as a chat message (fallback to conversational handling).
- **Param fixes:** Step 3 `railingType` corrected to `railType` (fortress/wood). `deckingType` options fixed to composite/pt_lumber. Step 2 added `snowLoad`, `frostZone`, `beamType`.
- **Zone update action:** New `zoneUpdate` action type added. AI can resize existing zones: `{"zoneUpdate":{"zoneId":1,"width":12,"depth":8}}`. Handler in `_applyActions`, chip display, and system prompt all updated.

### Recognized Action Types in _applyActions
`param`, `navigate`, `siteElementUpdate`, `siteElementAdd`, `siteElementRemove`, `zoneAdd`, `cutoutAdd`, `chamferSet`, `zoneRemove`, `zoneUpdate`

---

## Auth State Preservation (S70)

### Problem Solved
Users who reached Step 4 without logging in would click "Sign in with Google" and lose all their work because the OAuth redirect didn't save state.

### Fix
- Step 4 sign-in button (in steps.js) now saves full wizard state (params, info, step, sitePlanMode, sitePlanB64) to localStorage before OAuth redirect
- Auth error "Please sign in first" now shows an inline "Sign in now" button with state-saving
- Header sign-in button (in app.js) already had state-saving (since S62)
- Restoration logic in app.js reads from `sb_auth_state` key after successful auth

---

## Chamfer System (S61, completed S66)

Chamfer awareness throughout data layer and all PDF sheets. `mainCorners`/`zone.corners` -> `_chamfered_vertices` in zone_utils.py -> polygon outlines + exposed edges. Area subtracted at calc source (both frontend and backend).

---

## IRC 2021 Structural Data

### Joist Spans -- VERIFIED (S59)
IRC 2021 Table R507.6. All 3 species groups, all 4 load tiers (40/50/60/70 PSF).

### Beam Spans -- VERIFIED (S60, critical fix end-of-S62)
IRC 2021 Tables R507.5(1)-(4). Full 4D lookup. ~824/827 match ICC source.

---

## PDF Output

| Sheet | Source | Notes |
|-------|--------|-------|
| Cover (A-0) | draw_cover.py | Compliance stamp, LUMBER row, chamfer-corrected SF |
| A-1 Plan & Framing | draw_plan.py | Multi-stair all templates, chamfer-aware, stair notes box, freestanding bracing |
| A-2 Elevations | draw_elevations.py | Multi-run profiles/treads, chamfer-aware railing, beam_h from calc, freestanding bracing |
| A-3 General Notes | draw_notes.py | Lumber design basis note, cantilever note in ledger section |
| A-4 Structural Details | draw_details.py | 5 details + hardware schedule (3x2 grid) |
| A-5 Site Plan | draw_site_plan.py | Parcel ID + zoning, vicinity map, chamfer-aware deck outline |
| A-6 Attachment + Cantilever | draw_checklist.py | Deck attachment sheet (top) + cantilever detail (bottom) |
| PPRBD Sheet | jurisdiction_sheet.py | COS only |
| Materials | draw_materials.py | Per-zone sizing, chamfer-corrected areas, separate PDF |

### P0 Issues (would cause permit rejection)
1. **Freestanding deck second beam row** not drawn on framing plan (only front beam shows)

---

## Frontend/Backend Parity

### Known gaps
| Feature | Gap |
|---------|-----|
| **Freestanding second beam** | Framing plan shows only front beam, not house-side beam |
| **House rotation** | Parcel lookup returns angled lots, house always axis-aligned (see Future: House Rotation) |
| **A-2 deck outline** | Railing is chamfer-aware, deck surface line still rectangular |
| **Multi-run elevation profile** | "Unfolded section" convention, not true projected elevation |

---

## File Structure (11 JS files + backend)

| File | Lines | Last Modified |
|------|-------|---------------|
| `backend/app/main.py` | ~2159 | S70 (DeckParams footingOverrides, AI helper params fix) |
| `backend/app/database.py` | ~1221 | S63 |
| `backend/app/auth.py` | ~95 | S55 |
| `backend/static/index.html` | ~96 | S70 (cache buster s70b) |
| `backend/static/admin.html` | ~670 | S62 |
| `backend/static/js/engine.js` | ~557 | S66 (chamfer area, zone chamfer railing) |
| `backend/static/js/steps.js` | ~3846 | S70 (AI buttons fix, per-footing UI, guided mode, zone delete, auth) |
| `backend/static/js/app.js` | ~1376 | S70 (removeZone prop to PlanView) |
| `backend/static/js/home.js` | ~206 | S62 |
| `backend/static/js/tracking.js` | ~149 | S55 |
| `backend/static/js/traceView.js` | ~576 | S43 |
| `backend/static/js/sitePlanView.js` | ~635 | S63 |
| `backend/static/js/elevationView.js` | ~533 | S69 (font size increases ~40%) |
| `backend/static/js/planView.js` | ~515 | S70 (zone delete buttons in preview) |
| `backend/static/js/deck3d.js` | ~1163 | S67 (full 3D overhaul, stair fixes, house extraction) |
| `backend/static/js/stairGeometry.js` | ~167 | S67 |
| `backend/static/js/zoneUtils.js` | ~425 | S24 |
| `backend/drawing/calc_engine.py` | ~636 | S66 (chamfer area subtraction at source) |
| `backend/drawing/irc_tables.py` | ~3874 | S62 |
| `backend/drawing/permit_checker.py` | ~1718 | S70 (per-post tributary bearing check) |
| `backend/drawing/permit_spec.py` | ~422 | S61 |
| `backend/drawing/draw_plan.py` | ~890 | S68 |
| `backend/drawing/draw_elevations.py` | ~1522 | S68 |
| `backend/drawing/draw_notes.py` | ~353 | S66 |
| `backend/drawing/draw_details.py` | ~787 | S67 |
| `backend/drawing/draw_materials.py` | ~423 | S66 |
| `backend/drawing/draw_site_plan.py` | ~922 | S66 |
| `backend/drawing/draw_cover.py` | ~278 | S66 |
| `backend/drawing/draw_checklist.py` | ~229 | S66 |
| `backend/drawing/zone_utils.py` | ~331 | S65 |
| `backend/drawing/title_block.py` | ~167 | S45 |
| `backend/drawing/jurisdiction_sheet.py` | ~197 | S50 |
| `backend/drawing/stair_utils.py` | ~398 | S68 |
| `tests/test_structural.py` | ~267 | S62 |

---

## Session 70 History (11 pushes)
**Theme:** Billy's Feedback + AI Helper Fixes + Per-Footing Compliance

### Zone Delete UX (pushes 1-2)
- Added x delete button to zone tabs in left panel
- Added red x circle buttons at top-right of each zone in preview (same visual language as green + add buttons)
- Rendered late in SVG to stay on top of deck lines
- `removeZone` passed as prop from app.js to PlanView

### Auth State Preservation (push 3)
- Step 4 "Sign in with Google" button now saves wizard state to localStorage before OAuth redirect
- Auth error state shows inline "Sign in now" button
- Fixes data loss when users reach Step 4 without being logged in

### AI Suggestion Buttons Fix (pushes 4, 8)
- Root cause: `_applyActions` and `setChatMessages` defined in StepContent but referenced from GuidePanel (separate React component). Out of scope = silent ReferenceError.
- Fix: Wired both as props (`onApplyActions`, `setChatMessages`) to all 5 GuidePanel render calls.
- Added fallback: if suggestion has no recognized actions, sends label as chat message.

### Per-Footing Diameter System (pushes 5, 10-11)
- Frontend: Expandable "Customize per post" section with dropdown per post
- Inline warning when override < IRC recommended minimum
- DeckParams: `footingOverrides: Optional[dict] = None` added to Pydantic model
- Permit checker: Per-post tributary area calculation (end posts = half bay, interior = full bay)
- Each footing checked against its specific structural requirement
- Fix message explains end posts can legitimately use smaller footings

### Guided Mode Simplification (pushes 6-7)
- Reduced to single "Look up by address" button (was 3 choices)
- "Switch to manual" button made more prominent (visible border, larger text)
- Property Information form hidden during early guided phases to prevent skipping address lookup

### AI Helper Updates (push 9)
- Fixed Step 3 params: `railingType` -> `railType` (fortress/wood), `deckingType` options corrected
- Added missing Step 2 params: `snowLoad`, `frostZone`, `beamType`
- Added `zoneUpdate` action type: AI can resize existing zones
- Added action chip display for zone updates

### Key S70 Lessons
- **Wire props, not closures:** React components are separate scopes. Always pass functions as props.
- **Compliance = full implementation:** Don't ship UI overrides without backend validation.
- **Per-post structural math matters:** End posts carry half the load of interior posts. One-size-fits-all checks are overly prescriptive.
- **Fewer choices = better UX:** Reducing guided mode from 3 buttons to 1 eliminated confusion.
- **Hide confusing UI:** Property info form during guided mode caused users to skip address lookup entirely.

---

## Session 69 History (5 pushes)
**Theme:** Preview Font Sizes + Permit Checker UX

### Preview Font Increases (push 1)
- planView.js: all key labels increased ~40%
- elevationView.js: all labels increased ~40%

### Permit Checker Plain English (push 2)
- Added `fix` fields to footing frost, bearing, guard height checks
- Frontend: 8px mono -> 10px sans-serif, fixes on separate line
- "Go to Step X" navigation buttons via `window._wizStep`

### Key S69 Lessons
- **py_compile before push:** Always verify syntax. A 2-second check prevents deploy failures.
- **Don't add duplicate kwargs:** When replacing a field value, remove the old one first.

---

## Prioritized Roadmap

### S71: House Rotation on Site Plan
**Problem:** Parcel lookup returns angled lot polygons, but house always renders axis-aligned. This is visually incorrect on the site plan.
**Scope assessment:** Significant. Touches:
- Site plan rendering (frontend sitePlanView.js + backend draw_site_plan.py): Rotate house rectangle to match lot front edge angle
- Setback calculations: Currently assume axis-aligned rectangles
- Deck positioning: Deck centered on house rear wall, which changes orientation when house rotates
- Collision detection: All rect-vs-rect checks assume axis-aligned
**Recommended approach:** Start with visual-only fix on site plan (rotate the drawing without changing internal coordinate math). Structural calcs all work in local axis-aligned space. The site plan is the only place lot angle matters visually.

### Future: Steel Deck Support
**Problem:** Billy's Welborn reference is a steel-framed deck. Users want steel as an option.
**Why it's a multi-session epic (3-5 sessions):**
- IRC R507 prescriptive tables are for WOOD ONLY. Steel framing requires AISC manual calculations or manufacturer span tables. This means building a second structural engine.
- Different dead loads (steel is heavier), different deflection criteria (L/360 vs L/240), different connection hardware (base plates, through-bolts instead of Simpson connectors)
- Every drawing module changes: elevations show HSS columns and W-shape beams, details show steel connections, hardware schedule lists steel-specific fasteners, A-6 attachment sheet changes
- Materials estimator changes (steel priced by weight, not board-feet)
- 3D rendering changes (HSS columns, W-shape beams, different visual style)
- **Compliance risk:** If we generate steel structural sizing from IRC wood tables, we're giving users incorrect engineering. A building department would reject it, or worse, it could pass and be structurally inadequate.
**Recommended phased approach:**
1. **Phase 1:** "Steel framing" toggle that flags PDF with "Steel framing requires engineered design review" and adjusts visual representation. No structural calcs.
2. **Phase 2:** Steel beam/column span tables from manufacturer data (e.g., Lally columns, HSS tubes). Basic sizing.
3. **Phase 3:** Full steel calc engine with AISC-based checks.
**Key constraint:** Billy's Welborn steel deck likely had an engineer's stamp. Most steel decks do. We should be transparent about this limitation.

### Future: Zones at Different Levels
**Problem:** Billy wants zones to support different heights. Currently all zones share the main deck height.
**Existing TODO:** `deck3d.js:170`: `var zH = H; // TODO Phase 3: per-zone height from zone.h`
**Scope:** Medium-large. Touches 3D rendering, PDF elevations, calc engine (different post heights per zone), permit checker (guard height per zone).

### Beta Launch (after building dept validation)
- Flip `SB_PHASE` to `beta` on Railway
- Beta is FREE (no Stripe checkout)
- Submit to 3-5 building departments for validation

---

## Remaining TODOs

### Billy's Feedback (from S70, not yet addressed)
- **Zones at different levels:** Per-zone height support
- **House orientation on site plan:** See "S71: House Rotation" in roadmap

### Code TODOs
- `deck3d.js:170`: `var zH = H; // TODO Phase 3: per-zone height from zone.h`
- `main.py:1096`: insight analysis prompt language

### Known 3D Gaps (from S67)
- Inner railing between parallel runs on switchback/wrap
- Stair-to-deck railing transition (small gap at connection point)
- Balusters could be denser (IRC 4" sphere test requires ~3.5" spacing)

### Known Gaps (other)
- House rotation to match lot angle
- A-2 deck surface outline still rectangular (railing is chamfer-aware)
- Freestanding second beam row not drawn on framing plan
- Zone wing stair railing gaps not implemented
- Soil bearing hardcoded at 1500 PSF
- Zone chamfer railing in backend calc_engine.py (frontend is correct)
- Multi-run elevation profile is "unfolded section" not true projected elevation
- Per-run dimensions for horizontal runs (L-shape run 2 going sideways)
- Per-footing diameters not yet rendered on PDF (backend has the data, drawing modules need update)
- Future: Integrate attachment sheet as sidebar on A-4 per Billy's layout
- Future: Bracing connection detail on A-4 (bolt size, spacing, angle)
- Future: Steel deck support (see roadmap)

---

## Standing Practices

**Cache busters:** `?v=s70b`. Format: `?v=sXXy`. Bump on any JS push.
**Architecture:** `window.*` export pattern. TRIPWIRE at 12 JS files (currently 11).
**Encoding:** All drawing files use plain ASCII comments.
**Visual verification:** Never confirm visual fixes from text extraction.
**Lumber species:** Default DFL/HF/SPF. NOT user-selectable.
**Beam lookup:** Use `get_beam_max_span()` and `auto_select_beam()`.
**Snow load:** `LL = max(40, snow)`, NOT `40 + snow`.
**Guard height:** Auto 36" standard, 42" for >8'. Override with 36" IRC floor.
**Phase tagging:** `SB_PHASE` env var. Current: `testing`.
**Push workflow:** git clone/push via github.com (not api.github.com).
**Python syntax check:** Always `py_compile.compile()` before pushing Python changes.
**AI Helper cost:** ~$0.01/text (Sonnet), ~$0.05-0.08/image (Opus). Max tokens: 250 text, 500 image.
**AI Helper brevity:** Must include ABSOLUTE RULE at end of system prompt.
**AI Helper props (S70):** GuidePanel requires `onApplyActions={_applyActions}` and `setChatMessages={setChatMessages}` props from StepContent. Without these, suggestion buttons silently fail.
**AI Helper params (S70):** Step 2: snowLoad, frostZone, beamType. Step 3: deckingType (composite/pt_lumber), railType (fortress/wood). NOT railingType.
**AI Helper actions (S70):** `zoneUpdate` action type: `{"zoneUpdate":{"zoneId":1,"width":12,"depth":8,"label":"Dining"}}`.
**3D rendering (S67):** Always use `addM()` for mesh creation. Never `scene.add(mesh).position.set()`.
**3D house (S67):** `addHouse(scene, cfg, mats, THREE)` is config-driven.
**3D environment (S67):** `setupSceneEnv(scene, p, THREE)` is the single source.
**3D stair geometry (S67):** Run 2+ must be ADJACENT to landing, never inside it.
**3D stair gap (S67):** Uses run 1 actual rect position (`wax + r0.x`).
**Slider debounce (S67):** 120ms.
**Chamfer data flow (S66):** `mainCorners`/`zone.corners` -> `_chamfered_vertices` in zone_utils.py.
**Beam height (S66):** `_beam_h_from_calc(calc)` in draw_elevations.py.
**Zone sizing flow:** Computed once in `permit_spec.py` via `spec["zone_calcs"]`.
**Deferred loading:** Three.js + views + steps load lazily via `_loadWizardDeps()`.
**Project auto-save:** Debounced 3s, logged-in users only.
**Permit language:** Never say "permit-ready" or "guaranteed to pass" in user-facing UI.
**Parcel lookup:** Realie API, address + state only. Cache results in parcel_cache table. 25 free lookups/month.
**Vicinity map:** staticmap + CartoDB light_all tiles. Renders at PDF generation time.
**Guided mode (S70):** Address lookup is the only guided mode entry. "Switch to manual" provides survey upload and manual entry. Property info hidden during early guided phases.
**Auth state (S70):** All sign-in buttons (header, Step 4, error state) save wizard state to `sb_auth_state` in localStorage before OAuth redirect.
**Per-footing (S70):** `footingOverrides` in DeckParams. Permit checker uses per-post tributary areas. End posts = half bay. Frontend inline warning + full backend check.
**Zone delete (S70):** x on tabs + red x circles in preview. Both confirm before deleting.
**Multi-stair backend (S65/S68):** `resolve_all_stairs()` in stair_utils.py is single source of truth.
**Stair plan rendering (S68):** Generic geometry-based. One function handles all 6 templates.
**Freestanding bracing (S68):** X-brace on A-1 framing + all 4 A-2 elevations. Only when attachment != ledger and height >= 2ft.
**Landing pier circles (S68):** 12" diameter (landing-appropriate), not deck footing diameter.
**Preview fonts (S69):** All key labels increased ~40%.
**Permit checker fixes (S69/S70):** Plain-English fix instructions with fix_step navigation. Per-post bearing with tributary area awareness.

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
