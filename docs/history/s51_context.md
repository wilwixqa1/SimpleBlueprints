# SimpleBlueprints - Session 51 Context File
**Date:** March 2026
**Repo:** `github.com/Wilwixqa1/simpleblueprints`
**Live site:** `simpleblueprints-production.up.railway.app`
**Custom domain:** `simpleblueprints.xyz`
**Stack:** Split React/Babel frontend (11 JS files) + Python FastAPI backend on Railway. GitHub push to `main` auto-deploys in 60-90s (longer if Dockerfile changes).
**GitHub PAT:** (user provides each session)

---

## IMPORTANT: Session Start Protocol

1. **Clone the repo via git** (preferred since S47). `git clone --depth 1 https://<PAT>@github.com/Wilwixqa1/simpleblueprints.git sb_repo` works through the `github.com` domain. `api.github.com` is blocked by network config. Git push works natively, bypassing the content API size limit entirely. Files live at `backend/static/js/` (JS) and `backend/drawing/` (Python drawing files).
2. **Ask for ALL relevant files BEFORE proposing changes.** If the work involves rendering/visuals, ask for the view files (deck3d.js, planView.js, elevationView.js), not just the engine. If structural, ask for reference permit PDFs (Rutstein plans).
3. **Read uploaded files and reference materials BEFORE writing any code.** Verify the problem exists as described. Five minutes of reading saves an hour of wrong code.
4. **Declare session scope upfront.** One feature or fix per session. If scope creeps, stop and re-scope.

---

## ============================================================
## SESSION MANAGEMENT RULES
## ============================================================

### Git Clone Workflow Rule (S47)
Use `git clone` + `git push` through `github.com` domain (not api.github.com, which is blocked). This bypasses the content API size limit entirely and handles encoding natively (no mojibake risk). The repo path after clone is `backend/static/js/` for JS files and `backend/drawing/` for Python drawing files. After S47 cleanup, steps.js is ~186KB (well under the ~384KB API limit), so the old push tool approach also works again if needed.

### Encoding Hygiene Rule (S47)
All non-ASCII characters in comment lines have been stripped repo-wide. Prevention: (a) use git clone/push which handles encoding natively, (b) keep all comments pure ASCII, (c) if using the Content API, read as raw bytes and base64 encode directly without text decode/re-encode.

### File Request Rule (S40)
Ask for all relevant files upfront before proposing changes. Don't code from the context file description alone.

### Verify Before Building Rule (S40)
Before writing any code, verify the problem actually exists the way the context file describes it. Read the relevant source files.

### Reference Plans Rule (S40)
When the fix involves structural elements (posts, beams, footings, stairs), check the Rutstein reference plans (Ilaria, Welborn, Loucks) FIRST. These are real permitted plans that passed review.

### Stepwise Execution Rule (S39, reinforced S40)
One change at a time. Push, test, confirm before moving to the next thing.

### Timebox Rule (S39)
If a bug fix exceeds 30 minutes, STOP.

### Deliverable-First Rule (S39)
The PDF is the deliverable. The frontend preview is secondary.

### Don't Guess Rule (S40)
If you don't know how something works, look at the code. Don't ask the user questions you could answer by reading the uploaded files.

### Anti-Scope-Creep Rule (S41)
"Think harder" means think more precisely, not more broadly. If Claude has proposed 3 different approaches without shipping any, the session is failing.

### No Architecture Without Delivery Rule (S41)
Never propose new files, new modules, or new abstraction layers unless the current session has already shipped a working fix.

### Measure Before Changing Rule (S42)
Build an eval harness or measurement tool BEFORE iterating on prompts/solvers.

### Don't Oversell Rule (S42, reinforced S45)
Never confirm visual fixes from text extraction alone. Always ask the user to verify screenshots.

### Simplest Fix First Rule (S43)
Find the simplest fix before proposing architecture.

### User-Test Before Iterating Rule (S43)
Ship the minimal fix, let the user test with real data, then iterate based on actual feedback.

### Adaptive Scaling Pattern (S44)
Use `_sf = max(1.0, lot_span / 120)` for continuous proportional scaling and `_is_large = _sf > 2.0` for conditional hiding on large lots.

### No False Confirmation Rule (S45, CRITICAL)
Claude must NEVER confirm a visual fix worked based on text extraction alone. After any push that affects visual output, Claude must say "I can't verify the visual layout from here - does it look right to you?" and wait for user confirmation.

### Root Cause Before Fix Rule (S45)
When the same bug persists after multiple fix attempts, STOP proposing more fixes. Trace the actual coordinates/values through the code.

### Optimize for Best UX Rule (S47)
The website optimizes for best UI/UX. Non-technical homeowners need to go from "I need deck plans" to "I have permit-ready blueprints" with minimum friction and confusion. Pick the implementation that gives the clearest, most spacious, most intuitive experience, not the easiest to implement.

### Don't Dismiss User Ideas Rule (S46)
When the user proposes an approach, evaluate it on its merits rather than reflexively arguing for the simpler approach. Find the version of the user's idea that works.

### Qualitative AI Over Pixel Measurement Rule (S48)
When extracting spatial information from survey drawings, ask the AI qualitative questions it can answer reliably (left/right/flush/detached) rather than asking it to measure pixel distances on small-scale drawings. Use application logic to compute precise coordinates from qualitative answers plus known reference points (house position, setback lines, lot boundaries).

### Incremental Push Rule (S49, NEW)
When making large UI/UX changes, split into multiple pushes: (1) additive code only (components, state, helpers - nothing renders them), (2) wire into render, (3) visibility/interaction logic. Test between each push. This catches breakage early.

---

## ============================================================
## COORDINATE SYSTEM (documented S38)
## ============================================================

**Origin:** SW corner of lot = (0, 0), which is the bottom-left corner at the street.
**X-axis:** Increases left to right (east).
**Y-axis:** Increases from street toward rear (north).

**House placement:** `houseOffsetSide` = distance from left property line at house Y position (polygon-aware since S48). `houseDistFromStreet` = Y distance from front (street) property line. For irregular polygons, the actual house X = `leftEdgeAtY(houseMidY) + houseOffsetSide` (computed by `leftEdgeAtY()` function in sitePlanView.js and draw_site_plan.py). For rectangular lots, leftEdgeAtY always returns 0, so behavior is unchanged.

**Deck placement:** Centered on house rear wall. `deckOffset` shifts left/right relative to house center. Deck Y starts at `houseDistFromStreet + houseDepth`.

**Polygon vertices:** Ordered clockwise from the street-side SW corner. Edge 0 = street (south), edges continue clockwise. `computePolygonVerts` normalizes so min X = 0, min Y = 0.

**Frontend SVG:** `sx(lx)` converts lot X to SVG X (left to right). `sy(ly)` converts lot Y to SVG Y (Y-axis flipped: street at bottom of SVG). Viewport scales to `viewW`/`viewD` (polygon bounds or slider rectangle).

**Backend matplotlib:** Same coordinate system. Y increases upward (matplotlib default matches lot coords). No flip needed.

---

## ============================================================
## WIZARD STEP ORDER (updated S48)
## ============================================================

The wizard was reordered in S48 so users start by uploading their survey. Extraction results auto-populate all subsequent steps via shared `p` state.

| Step | Name | Purpose |
|------|------|---------|
| 0 | Site Plan | Survey upload, AI extraction, lot shape selection (compare mode), house position, setbacks, site elements, north arrow, slope |
| 1 | Size & Shape | Deck width/depth/height, zone system, stair config. House dimensions pre-filled from extraction. |
| 2 | Structure | Joists, beams, posts, attachment |
| 3 | Finishes | Decking type, railing, cost breakdown |
| 4 | Review | Project info, summary, PDF generation |

**Extraction feeds forward:** When extraction sets values like `p.houseWidth`, `p.setbackFront`, `info.address` etc. in Step 0, they are immediately available in all subsequent steps because all steps share the same `p`, `c`, and `info` state objects.

---

## ============================================================
## AI GUIDED WIZARD (S49, NEW)
## ============================================================

### Architecture Overview
The AI Guide is an embedded panel at the top of each wizard step that walks non-technical users through the entire flow with simple questions, contextual tips, and action buttons. It uses a **hybrid approach**: scripted decision tree for the main flow, with future AI API integration planned for complex questions.

### Key Components (all in steps.js)
- **`GuidePanel`** - Reusable component rendering progress bar, message, tip, action buttons, back/mode toggle. Accepts dynamic `message`/`tip` props to override phase defaults.
- **`GuideChoiceScreen`** - Two-card picker ("Guided Setup" vs "Manual Setup") shown on first load of Step 0.
- **Phase definition arrays** - `GUIDE_PHASES_STEP0` (14 phases), `GUIDE_PHASES_STEP1` (4), `GUIDE_PHASES_STEP2` (3), `GUIDE_PHASES_STEP3` (2), `GUIDE_PHASES_STEP4` (2). Total: 25 phases.
- **`_guidePhaseMap`** - Lookup object mapping phase ID to phase definition. All step arrays merged into this.

### State Management (local state in StepContent)
```javascript
guideActive    // null = choice screen, true = guided, false = manual
guidePhase     // current phase ID string (e.g. 'has_survey', 's1_deck_size')
guideHistory   // array of previous phase IDs (for back navigation)
guidePeeked    // object tracking which sections user manually expanded during guided mode
```

### Guide Helper Functions
- **`guideAdvance(nextPhase)`** - Pushes current phase to history, sets new phase, auto-expands relevant sections
- **`guideBack()`** - Pops from history stack
- **`guideHandleAction(act)`** - Processes action buttons. Handles named actions (`apply_default_setbacks`, `set_flat`, `advance_step`, `expand_for_edit`, `expand_site_elements`, `start_trace`) and `next` navigation.
- **`guideChoose(mode)`** - Called from choice screen. Sets `guideActive` true/false.
- **`guideSectionShown(sectionId)`** - Controls whether an entire section (header + body) renders. In guided mode, hides irrelevant sections. In manual mode, shows all.
- **`guideSectionVisible(sectionId, manualToggle)`** - Controls whether a section's body is expanded.
- **`guideSectionToggle(sectionId, currentVal, setter)`** - Wraps section toggle clicks. Tracks "peeked" sections so they stay visible.
- **`guideFieldFocused(fieldName)`** - Returns true if the current phase's `focusFields` array includes this field.

### Phase Definition Schema
```javascript
{
  id: 'phase_name',           // unique identifier
  message: "Question text",    // shown as bold heading in GuidePanel
  tip: "Contextual help",     // shown as muted text below message
  sections: ['sectionId'],    // which sections to auto-expand and show
  focusFields: ['fieldName'], // which Slider fields get green left border
  actions: [                  // buttons shown in GuidePanel
    { label: 'Button Text', next: 'next_phase', style: 'primary' },
    { label: 'Alt', action: 'named_action', next: 'phase', style: 'secondary' }
  ]
}
```

### Section IDs Used by Guide
- `lotHouse` - Lot Dimensions, House Position & Setbacks (collapsible)
- `lotShape` - Adjust lot shape / polygon editor (collapsible)
- `siteElements` - Site elements panel (collapsible)
- `upload` - Survey upload section (collapsible)
- `northArrow` - North arrow dial (not collapsible, visibility-wrapped)
- `slope` - Slope/grade section (not collapsible, visibility-wrapped)

### Step 0 Flow (14 phases)
```
has_survey
  -> "Yes" -> upload_survey -> [file uploaded, dynamic msg] -> extracting
      -> [shapes found] -> shape_select -> [shape confirmed] -> verify_extracted
      -> [no shapes] -> trace_or_manual -> trace OR lot_dims
  -> "No" -> lot_dims -> house_position -> setbacks
Both paths merge at:
  site_elements_check -> north_arrow -> slope -> complete -> Step 1
```

**Dynamic messages in Step 0:**
- `upload_survey`: Changes to "Survey uploaded! Now click 'Set Up Lot from Survey'" after file selected
- `shape_select`: Changes to detailed instructions during compare mode

### Step 1 Flow (4 phases)
```
s1_deck_size -> s1_attachment -> s1_stairs -> s1_complete -> Step 2
```
- Auto-fills deck width = min(houseWidth, 50) if extraction set houseWidth and user hasn't customized from default 20'
- Dynamic message: "We set your deck to 38' wide to match your house" when auto-filled

### Step 2 Flow (3 phases)
```
s2_environment -> s2_review -> s2_complete -> Step 3
```

### Step 3 Flow (2 phases)
```
s3_materials -> s3_complete -> Step 4
```
- Dynamic completion message includes estimated cost

### Step 4 Flow (2 phases)
```
s4_info -> s4_generate
```
- Auto-skips to `s4_generate` if extraction already filled address/city/state

### Auto-Initialization
A `useEffect` watching `step` auto-sets the correct starting phase when the user navigates between steps. Clears history and peeked state on each step transition.

### Slider Focus Highlighting
The `Slider` component accepts a `focused` prop. When true, renders a 3px green left border with 10px padding. Step 0 sliders (lot width/depth, house dims, setbacks) pass `guideFieldFocused('fieldName')`.

### Visual Connector
When a phase has sections, a small down-arrow indicator renders between the GuidePanel and the section below it, visually connecting the guide's question to the relevant controls.

### Manual Mode
Clicking "Manual Setup" or "Switch to manual" sets `guideActive = false`. All sections render normally (existing behavior). A "Switch to guided" button appears in the intro text.

### Known Limitations / Future Work
- **No AI API calls yet** - The hybrid plan calls for Anthropic API integration for complex questions (e.g., "what are my setbacks?"). Currently scripted only.
- **No persistence** - Guide state resets on page reload. Future: localStorage or URL param.
- **Section peeking** - Users can expand any section during guided mode, but the guide doesn't detect if they've already filled fields ahead (skip-ahead detection planned).
- **Steps 2-4 guide** - Basic but functional. No section visibility gating (Steps 2-4 don't have collapsible sections). Future: more granular control.
- **No analytics** - No tracking of guide completion rates or drop-off points.

---

## ============================================================
## S49 COMPLETED WORK (6 pushes, 2 files modified)
## ============================================================

### Push 1: Component Definitions (additive only, zero render changes)
- `GUIDE_PHASES_STEP0`: 14 phases covering survey/manual/merged paths
- `GuidePanel` component: progress bar, message, tip, action buttons, back/toggle
- `GuideChoiceScreen` component: two-card Guided vs Manual picker
- Guide state variables in StepContent: `guideActive`, `guidePhase`, `guideHistory`, `guidePeeked`
- Helper functions: `guideAdvance`, `guideBack`, `guideHandleAction`, `guideChoose`
- Section helpers: `guideSectionShown`, `guideSectionVisible`, `guideSectionToggle`, `guideFieldFocused`
- Auto-advance useEffect for extraction events

### Push 2: Wire Choice Screen + Guide Panel
- Replaced static intro text with 3 conditional renders (choice screen / guide panel / manual intro)
- Passed `setStep` prop from App to StepContent

### Push 3: Section Visibility Gating
- lotHouse, lotShape, siteElements, upload sections use `guideSectionVisible` + `guideSectionToggle`
- North arrow + slope sections hidden in guided mode unless phase matches
- Slider `focused` prop with green left border highlight
- 9 Step 0 sliders pass `guideFieldFocused()`
- Extraction button advances guide to 'extracting' phase
- Compare mode button advances guide to 'shape_select' phase

### Push 4: Fix Guide Section Visibility + Broken Buttons
- `guideSectionShown()` hides entire sections (header + body) in guided mode
- lotHouse, lotShape, siteElements, upload wrapped in `guideSectionShown`
- Guide panel stays visible during compare mode
- Down-arrow connector between guide and sections
- Fixed "Flat lot (0%)" - added `next: 'complete'`
- Fixed "Use common defaults" - added `next: 'site_elements_check'`

### Push 5: Step 1 Guide + Deck Size Auto-Fill
- `GUIDE_PHASES_STEP1`: 4 phases (deck_size, attachment, stairs, complete)
- Dynamic deck_size message based on extraction
- Auto-fill deck width = min(houseWidth, 50) on Step 1 entry
- GuidePanel accepts dynamic `message`/`tip` props
- Progress bar works for all step arrays
- `advance_step` uses `step + 1` (generic)

### Push 6: Steps 2-4 + Compare Gap Fix
- `GUIDE_PHASES_STEP2` (3 phases), `GUIDE_PHASES_STEP3` (2), `GUIDE_PHASES_STEP4` (2)
- Dynamic Step 0 messages: post-upload instruction, compare mode guidance
- Step 3 completion message includes dynamic cost
- Step 4 auto-skips info phase if extraction filled address
- Step-change watcher initializes all steps

### Key S49 Lessons
1. **Incremental pushes save debugging time.** Push 1 (additive only) confirmed the code parsed correctly before any render changes. Push 2 (minimal render wiring) caught issues early.
2. **guideSectionShown vs guideSectionVisible.** Two layers: `Shown` controls whether the header renders at all, `Visible` controls whether the body is expanded. Both are needed for clean guided UX.
3. **Dynamic messages beat static phases.** The same phase ID can show different messages based on state (e.g., upload_survey changes message after file is selected). Pass `message`/`tip` props to GuidePanel.
4. **Actions need both `action` AND `next`.** Named actions (set values) and navigation (advance phase) are independent. A button can do both: `{ action: 'set_flat', next: 'complete' }`.
5. **Auto-fill from extraction is high value.** Setting deck width to match house width from extraction is a single line of code but saves users significant confusion.

---

## ============================================================
## SHAPE PICKER / CANDIDATE SOLVER (S46)
## ============================================================

### How It Works (post-S48)
When the user uploads a survey PDF and clicks "Set Up Lot from Survey":
1. Extraction runs (loading indicator: "Analyzing survey...")
2. If extraction returns 4+ edges with lengths + lot area: shape picker appears
3. Solver generates all mathematically valid polygon shapes from edge lengths + area
4. If survey was uploaded: "Compare to Survey" button appears (enters compare mode)
5. User clicks a shape to preview it (green border + checkmark + site plan preview)
6. "Confirm Option N" button applies the shape (sets vertices, edges, area, setbacks, address, house dims, site objects)
7. "None of these match? Trace manually" falls through to existing trace flow
8. If extraction fails or returns < 4 edges: falls through to trace automatically

### Compare Mode Layout (S47-S48)
Right panel splits into:
- Left 55%: Survey preview (with page navigation) + Site Plan Preview (when shape selected)
- Right 45%: Scrollable shape cards with Confirm button sticky at bottom

### How the Solver Works (window.generateCandidateShapes)
**4-sided lots:**
- Street edge fixed as base (A=origin, B=(streetLen, 0))
- 3 remaining edges permuted in all 6 orderings
- For each ordering: sweep angle alpha (vertex C position), solve vertex D via circle intersection
- Binary search on alpha to find exact area match with target
- Both convex and concave solutions found per ordering

**5-sided lots:**
- Same approach but 2D sweep (alpha + beta for vertices C and D)
- Vertex E solved via circle intersection
- 24 permutations of 4 non-street edges

**Filtering:**
- Self-intersection check
- Area match within 10%
- Lot must extend above street (maxY > 1)
- Deduplication by vertex distance

### Current Limitations
- **No candidate ranking:** All candidates shown equally. AI shape descriptor could rank best match first.
- **Arc edges not supported:** Trace fallback handles this.
- **6+ sided lots not supported:** Falls through to trace.

---

## ============================================================
## AI EXTRACTION SYSTEM (S29, updated S40-S43, S46, S48)
## ============================================================

### What Extraction Returns (post-S48)
**High reliability:**
- Edge lengths (text OCR from labeled dimensions)
- Lot area, street names, neighbor labels, parcel IDs
- Setback values, address, city, state, zip
- House dimensions (estimated from graphic scale + area tabulations cross-check)

**Medium reliability:**
- House position (setback-anchored + percentage cross-check)
- houseXPercent/houseYPercent (relative position in bounding box)
- Site object relational data (relativeToHouse, flushWithHouse, nearestEdge)

**Low reliability:**
- Edge ordering, vertex angles, arc/curve notation
- Absolute pixel-based position measurements on small-scale drawings

### Extraction Prompt Structure (main.py SURVEY_EXTRACT_PROMPT)
1. **Lot data:** lotWidth, lotDepth, lotArea, lotEdges array (clockwise from street)
2. **House data:** houseWidth, houseDepth, houseDistFromStreet, houseOffsetSide, houseXPercent, houseYPercent
3. **Setbacks:** setbackFront, setbackRear, setbackSide
4. **Address:** street, city, state, zip, parcelId, streetName
5. **Orientation:** northAngle
6. **Confidence:** object with same keys, each "high"/"medium"/"low"
7. **Site objects:** siteObjects array with type, w, d, label, relativeToHouse, flushWithHouse, nearestEdge

### How Shape Confirmation Works (_selectShape in steps.js)
When user confirms a shape:
1. Lot data applied: lotVertices, lotEdges, lotArea, lotWidth, lotDepth
2. House dimensions applied with percentage cross-check (>20% disagreement prefers percentage)
3. Setbacks applied
4. Address/parcel info applied
5. Site objects auto-applied with relational placement logic
6. extractResult cleared, compareMode exited

### Relational Placement Logic (S48)
Site objects use qualitative spatial data instead of absolute coordinates:
- `relativeToHouse`: "left"/"right"/"behind"/"front"/"detached-left"/"detached-right"/"detached-behind"
- `flushWithHouse`: "flush"/"set-back"/"forward"
- `nearestEdge`: "street"/"left"/"right"/"rear"
Frontend computes x/y from house position + these hints. Special cases: driveways always start at y=0 (street), fences placed along nearestEdge property line.

---

## ============================================================
## TRACE FEATURE (S43)
## ============================================================

### How It Works (post-S43)
User uploads survey/plat PDF. Clicks "Set Up Lot from Survey" which:
1. Fires AI extraction in the background
2. If extraction returns 4+ edges + area, shows shape picker first
3. If shape picker not available or user clicks "Trace manually," enters trace mode
4. User places lot corner vertices on the survey image
5. User selects an edge via panel buttons and enters its labeled dimension (calibration)
6. AI-extracted edge lengths auto-replace traced lengths when within 25%
7. "Apply Traced Shape" sets lotVertices + lotEdges + extracted scalars

### TraceView Component (traceView.js)
- SVG with viewBox-based zoom (1x-10x, scroll wheel toward cursor)
- Click-vs-drag disambiguation
- PDF page selector with pdf.js rendering at 2x scale
- Vertex dots with numbered labels
- Polygon fill and edge lines with length labels

---

## ============================================================
## POLYGON LOT SYSTEM (S36-S38, S41-S43, S46, S48)
## ============================================================

### Data Model
```javascript
p.lotVertices = null;  // null = rectangular fallback; [[x,y], ...] = polygon
p.lotEdges = null;     // null = auto from sliders; [{type, label, length, setbackType, neighborLabel}, ...]
p.lotArea = null;      // lot area in SF
p.traceData = null;    // persisted trace state for re-entry
p.siteElements = [];   // [{id, type, x, y, w, d, label}, ...] - auto-populated from extraction

// Helpers on window (app.js):
window.computeRectVertices(p)
window.computeRectEdges(p)
window.computePolygonVerts(edges, targetArea)
window.computeLotArea(p)
window.computeSetbackGaps(p)
window.generateCandidateShapes(edges, targetArea)
```

**Edge data format:**
```javascript
{ type: "street"|"property", label: "Sweetgrass Lane", length: 184.83,
  setbackType: "front"|"rear"|"side"|"none", neighborLabel: "LOT 37" }
```

**Site element format:**
```javascript
{ id: 1234, type: "garage"|"fence"|"pool"|"shed"|"driveway"|"patio"|"tree"|"ac_unit",
  x: 60, y: 25, w: 25, d: 25, label: "GARAGE" }
```

---

## ============================================================
## TITLE BLOCK (S45)
## ============================================================

Right-side vertical strip on every sheet (Rutstein style). Strip starts at x=0.855 in figure coords. All sheets now have right=0.84 margins (fixed S47).

---

## ============================================================
## KNOWN PDF RENDERING ISSUES (post-S50)
## ============================================================

### Fixed in S50:
- Materials list removed from permit plan set (separate PDF)
- Site plan renumbered from A-6 to A-5
- PPRBD Deck Attachment Sheet auto-appended for COS jurisdiction

### Fixed in S47-S48:
- All unicode corruption stripped (1.46MB garbage removed)
- A-2 through A-5 margins fixed (right=0.84)
- North arrow repositioned to upper-left margin
- Polygon-aware house placement in PDF backend (draw_site_plan.py)

### Still Open - A-1 Framing Plan Label Audit:
**Problem:** Numbers appear in random places on the framing plan and it is difficult to determine what they inform. This looks very different from professional reference permit applications where there is clear visual hierarchy via leader lines, font weights, and consistent placement conventions.

**Why it matters:** A permit reviewer needs to quickly find specific information (joist size, beam specs, post spacing). If labels are scattered without clear hierarchy, they will request revisions or reject the application. This directly impacts whether our blueprints actually get permits approved.

**Proposed approach:**
1. Upload all three reference PDFs (Ilaria, Loucks, Welborn) at session start
2. Catalog what labels they show and how (leader lines from elements to labels in margin whitespace, font size hierarchy, consistent placement rules)
3. Create a gap analysis: what our A-1 shows vs what the references show
4. Fix one label category at a time: dimensions first, then structural specs, then material callouts
5. User verifies each push with screenshot comparison against reference

### Other Open Issues:
- Elevations: generic house rendering (plain box, no windows/doors/siding)
- Site plan: missing vicinity map, legal description, zoning info (lower priority)

### UX Issues (reported S50 by Billy):
- **"Trace manually" link is in wrong location.** Currently shows pre-compare-mode ("None of these match? Trace manually") before the user has seen any shapes. Once they enter compare mode, the trace option disappears. Fix: move "Trace manually" to the bottom of the proposed shapes list inside compare mode. Remove the pre-compare trace link. See S51 roadmap item #2.

---

## ============================================================
## JURISDICTION SHEET SYSTEM (S50)
## ============================================================

### Architecture
When the user's city/zip matches a known jurisdiction, we auto-include that jurisdiction's required attachment sheets in the permit PDF. Currently only PPRBD (Pikes Peak Regional Building Dept) is supported.

### Files
- `backend/drawing/jurisdiction_sheet.py` - Detection, checklist computation, overlay generation, PDF merge
- `backend/drawing/jurisdiction/cos_deck_attachment.pdf` - Official PPRBD Deck Attachment Sheet

### Detection Logic
`is_colorado_springs(project_info)` checks:
- City name against PPRBD_CITIES list (colorado springs, fountain, manitou springs, monument, palmer lake, woodland park, etc.)
- Zip code against PPRBD_ZIPS set (80901-80951 + 80817, 80829, 80819, 80863, etc.)
- Excludes: unincorporated Teller County (Divide 80814, Cripple Creek 80813), Ramah, Calhan

### Checklist Flow
1. Frontend detects PPRBD jurisdiction via `_isPPRBD` helper in StepContent
2. Step 4 shows YES/NO checklist with three states: YES, NO, unanswered (null)
3. Auto-computable items (under18, over8ft, freestanding, excavation) filled from deck config
4. Unknowable items (cover, electrical, hottub, cantilever) start blank
5. User answers or skips via "Skip & Generate" modal
6. `p.jurisdictionChecklist` object sent in generate payload
7. Backend `compute_checklist()` merges auto-values with user overrides
8. `build_overlay_pdf()` creates transparent reportlab overlay with X marks + address
9. `append_cos_attachment()` merges overlay onto official PDF, appends to permit set

### Adding New Jurisdictions
1. Obtain the official jurisdiction PDF
2. Store in `backend/drawing/jurisdiction/`
3. Use pdfplumber to map checkbox positions
4. Add detection logic (city names + zip codes)
5. Add frontend checklist items specific to that jurisdiction
6. Wire into main.py similar to COS pattern

---

## ============================================================
## PDF OUTPUT STRUCTURE (updated S50)
## ============================================================

### Permit Plan Set (auto-opens in new tab)
| Sheet | Name | Source |
|-------|------|--------|
| Cover | COVER SHEET | draw_cover.py |
| A-1 | DECK PLAN & FRAMING | draw_plan.py |
| A-2 | ELEVATIONS | draw_elevations.py |
| A-3 | GENERAL NOTES | draw_notes.py |
| A-4 | STRUCTURAL DETAILS | draw_details.py |
| A-5 | SITE PLAN | draw_site_plan.py |
| (last) | PPRBD DECK ATTACHMENT | jurisdiction_sheet.py (COS only) |

### Materials & Cost Estimate (separate download button)
| Sheet | Name | Source |
|-------|------|--------|
| (single page) | MATERIALS & COST ESTIMATE | draw_materials.py |

### Sheet Numbering History
- Pre-S50: A-5 was Material List, A-6 was Site Plan
- S50: Materials moved to separate PDF, Site Plan renumbered to A-5
- PPRBD attachment is unnumbered (appended after A-5 via pypdf merge)

---

## ============================================================
## SESSION HISTORY
## ============================================================

### SESSION 50 (5 pushes, 4 files modified)
**Theme:** Billy's Feedback - Jurisdiction Sheets + PDF Split

Implemented PPRBD (Pikes Peak Regional Building Dept) Deck Attachment Sheet auto-inclusion for Colorado Springs / El Paso County properties. Split PDF output into permit plan set + separate materials document.

**Push 1: Backend merge logic**
- Stored PPRBD Deck Attachment Sheet PDF in `backend/drawing/jurisdiction/`
- New `jurisdiction_sheet.py`: detect PPRBD jurisdiction by city/zip, compute checklist from deck params, build reportlab overlay with checkmarks and address, merge onto official PDF via pypdf
- Wired into main.py post-PdfPages

**Push 2: Step 4 checklist UI**
- YES/NO checklist in Step 4 between project info and feedback sections
- Auto-filled from deck config, user can toggle

**Push 3: Expand PPRBD jurisdiction detection**
- Covers all El Paso County + Woodland Park (Teller County)
- Correctly excludes unincorporated Teller County (Divide, Cripple Creek)
- Shared `_isPPRBD` helper in StepContent

**Push 4: Three-state checklist + skip gate**
- Items: YES, NO, or unanswered (null). Cover/electrical/hottub/cantilever start blank
- Under18/over8ft/freestanding/excavation auto-filled from config
- Orange highlight on unanswered items, counter shows remaining
- Generate button warns about incomplete checklist, "Skip & Generate" to proceed
- Backend leaves blank checkboxes for unanswered items on PDF

**Push 5: Split permit plans + materials into separate PDFs**
- Permit PDF: Cover + A-1 (Deck Plan) + A-2 (Elevations) + A-3 (General Notes) + A-4 (Structural Details) + A-5 (Site Plan, renumbered from A-6) + PPRBD attachment if applicable
- Materials PDF: Separate single-page "Materials & Cost Estimate"
- API returns both `download_url` and `materials_url`
- Permit auto-opens; materials available as download button
- Download endpoint accepts `?type=materials` for descriptive filename

**Key S50 Lessons:**
1. **Jurisdiction-aware features add real value.** Billy confirmed PPRBD requires this exact sheet. Auto-filling it from existing data saves the user manual work.
2. **Three-state is better than default-NO.** Defaulting unknowable items to NO is risky. Blank + prompt is safer.
3. **Split PDFs keep the plan set professional.** Permit reviewers don't want to see materials lists. Separate files serve different audiences.
4. **reportlab must be in requirements.txt.** Missing dependency crashed production (hotfixed same session).

### SESSION 49 (6 pushes, 2 files modified)
**Theme:** AI Guided Wizard - Full Implementation

Built a complete AI-guided wizard system spanning all 5 wizard steps with 25 total phases. Users see a choice screen on first load ("Guided Setup" vs "Manual Setup"). Guided mode walks them through with questions, contextual tips, action buttons, and section auto-expansion. Manual mode preserves existing behavior.

**Key S49 Lessons:**
1. **Incremental pushes save debugging time.** Additive-only push first, then render wiring, then visibility logic.
2. **Two visibility layers needed.** `guideSectionShown` (render at all?) vs `guideSectionVisible` (body expanded?).
3. **Dynamic messages beat static phases.** Same phase shows different text based on state.
4. **Actions need both `action` AND `next`.** Named actions (set values) and navigation are independent.
5. **Auto-fill from extraction is high value.** Deck width = houseWidth saves user confusion.

### SESSION 48 (12 commits, 5 files modified)
**Theme:** Extraction Pipeline + Compare Mode UX + Wizard Reorder

### SESSION 47 (8 commits, 12 files modified)
**Theme:** Code Hygiene + Margin Rollout + Compare Mode

### SESSION 46 - Shape Picker
### SESSION 45 - PDF Encoding Cleanup + Title Block Redesign
### SESSION 44 - PDF Quality Sprint
### SESSION 43 - Trace Feature UX Overhaul

---

## ============================================================
## File Structure (11 JS files + backend)
## ============================================================

| File | Size | Purpose | Last Modified |
|------|------|---------|---------------|
| `backend/app/main.py` | ~35KB | FastAPI, PDF gen (split permit+materials S50), auth, AI extraction | **S50** |
| `backend/drawing/draw_plan.py` | ~27KB | Plan + framing (right=0.84, north arrow upper-left) | S47 |
| `backend/drawing/draw_elevations.py` | ~45KB | Elevations (right=0.84) | S47 |
| `backend/drawing/draw_notes.py` | ~12KB | General Notes (axes [0,0,0.84,1]) | S47 |
| `backend/drawing/draw_details.py` | ~12KB | Structural details (right=0.84) | S47 |
| `backend/drawing/draw_materials.py` | ~15KB | Material list (now separate PDF, S50) | S47 |
| `backend/drawing/draw_site_plan.py` | ~32KB | Site plan + polygon-aware house placement (leftEdgeAtY) | S48 |
| `backend/drawing/draw_cover.py` | ~9KB | Cover sheet | S47 |
| `backend/drawing/title_block.py` | ~6KB | Right-side vertical strip (x=0.855) | S45 |
| `backend/drawing/calc_engine.py` | ~9KB | Backend structural calc | S47 |
| `backend/drawing/jurisdiction_sheet.py` | ~6KB | PPRBD jurisdiction detection, checklist overlay, PDF merge | **S50** |
| `backend/drawing/jurisdiction/cos_deck_attachment.pdf` | ~500KB | Official PPRBD Deck Attachment Sheet | **S50** |
| `backend/static/index.html` | ~3KB | HTML shell, script tags | S47 |
| `backend/static/js/steps.js` | ~199KB | Steps 0-4, shape picker, trace flow, extraction, AI Guide, **PPRBD checklist (S50)** | **S50** |
| `backend/static/js/app.js` | ~46KB | App shell, state, wizard nav, polygon helpers, **materialsUrl state (S50)** | **S50** |
| `backend/static/js/traceView.js` | ~22KB | Trace overlay: zoom/pan, vertex placement, PDF page selector | S43 |
| `backend/static/js/sitePlanView.js` | ~31KB | Site plan SVG preview + polygon-aware house placement (leftEdgeAtY) | S48 |
| `backend/static/js/elevationView.js` | ~27KB | Elevation views | S39 |
| `backend/static/js/planView.js` | ~32KB | Plan view SVG | S47 |
| `backend/static/js/deck3d.js` | ~44KB | 3D preview | S47 |
| `backend/static/js/engine.js` | ~16KB | Structural calcs + materials | S47 |
| `backend/static/js/stairGeometry.js` | ~8KB | Stair geometry | S24 |
| `backend/static/js/zoneUtils.js` | ~16KB | Frontend zone utilities | S24 |
| `backend/static/js/home.js` | ~5.5KB | Landing page + shared theme constants | S25 |

---

## Standing Practices

**Compliance audit:** Baseline 143/143 (6 known).
**Architecture: `window.*` pattern:** TRIPWIRE at 12+ JS files. Count is 11. One slot remaining.
**Context file uploads:** Upload at start of each session.
**Encoding:** All drawing files now use plain ASCII comments. Keep it that way.
**Visual verification:** Never confirm visual fixes from text extraction. Always ask user to verify.
**Em-dash rule:** Em dashes in code are fine. No-em-dash rule only applies to conversational/email output.

---

## ============================================================
## PRIORITIZED ROADMAP
## ============================================================

### S51: Guide Polish + Compare Mode Trace Fix
1. **Guide polish from S49 testing** - Fix any remaining UX gaps, improve section transitions, refine dynamic messages
2. **Move "Trace manually" into compare mode** - Currently the "None of these match? Trace manually" link appears BEFORE the user enters compare mode, which is backwards. They can't know if shapes match until they've seen the compare view. Move the trace escape hatch to the bottom of the proposed shapes list inside compare mode. Remove the pre-compare trace link.
3. **Orange highlight on estimated fields** - If extraction returned values with low/medium confidence, show orange border on those sliders so users know to verify
4. **Skip-ahead detection** - If user manually fills fields ahead of guide phase, offer to skip

### S52: A-1 Framing Plan Label Audit
5. **Reference comparison with Ilaria, Loucks, Welborn** (see KNOWN PDF ISSUES section)

### S53: Enhanced Extraction
6. **AI shape descriptor** to rank candidates (best match first)
7. **Use deck plan pages** for more accurate house dimension estimation

### Tier 2: Engine Integrity (before paid launch)
8. Beam span validation + LVL recommendation
9. Independent IRC table verification

### Tier 3: PDF Quality (before paid launch)
10. Elevation house rendering (currently plain box, no windows/doors/siding)
11. Architectural SVG conventions
12. cairosvg migration

### Tier 4: Materials List Monetization Strategy
**Context:** The materials list was split into a separate PDF in S50. Currently included free with every generation. The data is also visible in the UI (Step 3 items, Step 4 total), so a simple PDF paywall is easily circumvented.

**Approaches that DON'T work:**
- Charging $5 for the materials PDF alone (user can screenshot the UI)
- Gating the materials data in the UI (degrades the free experience, reduces conversion)

**Approaches worth exploring:**
- **Bundle into base price.** "Permit-ready blueprints + materials shopping list for $X" justifies a higher base price ($79-99 vs $49-59). The materials list is perceived value, not a separate line item.
- **Premium materials intelligence (future upsell).** Features that go beyond what the UI shows and are genuinely hard to replicate: optimized lumber cut lists that minimize waste, purchase lists grouped by store/aisle, supplier pricing integration (Home Depot/Lowes API), quantity calculators with waste factor, delivery cost estimates. These justify a separate charge ($15-25 addon) because the value is computational, not just formatting.
- **Contractor-tier subscription.** Contractors generating plans for multiple clients would pay monthly for bulk generation + enhanced materials features. This is post-launch.

**Current decision (S50):** Materials PDF included free, separate download. Architecture supports gating later. Revisit monetization when approaching paid launch.

### Tier 5: AI-Powered UX (post-launch)
13. **AI hybrid for guide** - Anthropic API calls for complex questions ("what are my setbacks?")
14. **Parcel API** - Address lookup to auto-populate lot shape without survey
15. AI chatbot for deck configuration
16. Natural language input

### Tier 6: Deferred
17. Phase 3 parcel API
18. Curved edge support
19. 6+ sided lot solver
20. User project persistence
21. Guide state persistence (localStorage)
22. Guide analytics / completion tracking
23. Additional jurisdiction support (Denver, other CO counties, then national)
