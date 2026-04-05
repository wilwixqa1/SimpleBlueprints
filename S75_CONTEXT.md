# Session 75 Context File

## S75 Status: Steel Deck Feature - Phase 1 Complete (Core State + UI Selection)

### What Was Done

**1. steelDeckData.js Exports**
Added `window.*` exports for all CCRR-0313 data tables, utility functions, and Fortress parts catalog. This allows engine.js to consume the steel data through global functions like `window.steelJoistMaxSpan()`, `window.steelSingleBeamMaxSpan()`, `window.steelDoubleBeamMaxSpan()`, `window.steelMaxPostHeight()`, `window.steelBeamType()`, and `window.spanToInches()`.

**2. calcSteelStructure() in engine.js**
Full parallel calculation function for steel framing that mirrors the wood `calcStructure()` return shape exactly:

- Maps `snowLoad` to CCRR-0313 load cases: none=50, light=75, moderate=75, heavy=100, with TL-based escalation to 125/150/200
- Validates joist span by gauge (16ga/18ga) and spacing (12"/16" OC) against CCRR-0313 Table 2
- Auto-determines single vs double 2x11 beam based on required beam span vs CCRR Tables 3-14
- Uses fixed 3.5" x 3.5" steel post with height validation against CCRR Table 15
- Same footing/slope/stair/railing/chamfer math as wood path
- Returns steel-specific fields: `framingType`, `steelGauge`, `steelBeamIsSingle`, `steelLoadCase`, `steelMaxJoistSpan`, `steelMaxCantilever`
- All downstream consumers (preview, materials, PDF gen) work unchanged because return shape matches

**3. State Model (app.js)**
Added three new params to initial state and reset state:
- `framingType`: "wood" (default) or "steel"
- `steelGauge`: "16" or "18" (default "16")
- `steelBeamType`: "auto", "single", or "double" (default "auto")

Updater logic: when `framingType` changes, all wood-specific overrides (overJoist, overBeam, overPostSize, overPostCount, overFooting) are cleared.

**4. Step 2 UI (steps.js)**
Added framing type selector at top of Step 2 with conditional rendering:

When **steel** is selected:
- Gauge selector (16ga standard / 18ga lighter)
- Joist spacing (12" / 16" only; no 24" for steel)
- Fixed "2x6 Steel" joist display (no size selection, always 2x6)
- Single/Double 2x11 beam selector (auto/single/double chips)
- Fixed "3.5" Steel" post display with "do not bury" warning
- Post count and footing overrides still available
- Blue accent color (#4a90d9) to visually distinguish from wood (green)
- CCRR-0313 load case and code reference in specs section

When **wood** is selected:
- All original controls unchanged

**5. Backend (main.py)**
Added `framingType`, `steelGauge`, `steelBeamType` fields to `DeckParams` model.

**6. Script Loading (index.html)**
Added `steelDeckData.js` to Phase 1 loading (before engine.js). Updated all cache busters to `s75a`.

---

### Test Results

Verified both calc paths with automated tests:

| Config | Joist | Beam | Post | TL | Load Case | Warnings |
|--------|-------|------|------|----|-----------|----------|
| Wood 20x12 moderate | 2x8 | 3-ply 2x12 | 6x6 | 55 | IRC R507 | none |
| Steel 20x12 16ga moderate | 2x6-16ga | Single 2x11 | 3.5x3.5 | 55 | CCRR 75 | none |
| Steel 20x14 18ga heavy | 2x6-18ga | Single 2x11 | 3.5x3.5 | 75 | CCRR 100 | Joist span exceeded |
| Steel 20x18 18ga moderate | 2x6-18ga | Single 2x11 | 3.5x3.5 | 55 | CCRR 75 | Engineering required |
| Steel 30x12 16ga moderate | 2x6-16ga | Single 2x11 | 3.5x3.5 | 55 | CCRR 75 | none (4 posts) |
| Steel 20x12 freestanding | 2x6-16ga | Single 2x11 | 3.5x3.5 | 52 | CCRR 50 | none |

---

### Implementation Plan (Remaining Phases)

**Phase 2: Structural Calculations (done in this session)**
All CCRR-0313 table lookups are implemented and tested.

**Phase 3: Materials List (next session)**
- Steel parts catalog with Fortress naming/item numbers (data already in steelDeckData.js)
- Quantity calculations: joists, ledger pieces, brackets, screws, blocking, straps
- Screw count estimation from fastening schedule
- Cost estimates for steel components
- `estMaterials()` needs a steel branch

**Phase 4: PDF Output**
- Framing plan labels match Welborn convention (label functions in steelDeckData.js)
- Notes reference CCRR-0313 instead of IRC R507
- Assembly diagram references
- Backend calc_engine.py needs steel path for PDF generation
- draw_plan_and_framing needs steel framing labels
- draw_notes needs steel-specific general notes

**Phase 5: AI Assistant + Polish**
- System prompt with steel context
- AI can recommend wood vs steel
- AI understands Fortress part naming

---

### Files Modified

- `backend/static/index.html` - Load steelDeckData.js, cache buster s75a
- `backend/static/js/steelDeckData.js` - Window exports added
- `backend/static/js/engine.js` - calcSteelStructure() function (195 lines)
- `backend/static/js/app.js` - framingType/steelGauge/steelBeamType state + updater
- `backend/static/js/steps.js` - Framing type selector, conditional steel/wood controls
- `backend/app/main.py` - DeckParams model fields

### Files to Upload for S76

1. **steps.js** - Step 2 UI with framing type selector
2. **app.js** - State model with steel params
3. **engine.js** - calcSteelStructure function
4. **steelDeckData.js** - Data tables with exports
5. **main.py** - Backend with DeckParams updates

### Critical Rules (carried from S74)

- **Use CCRR-0313 tables as the single source of truth for all steel span data.** Do not use the installation guide TER numbers.
- **Match Welborn's labeling convention exactly for PDF output.** Label functions are in steelDeckData.js STEEL_PDF_LABELS.
- **Steel posts must NOT be buried.** CCRR-0313 and Fortress both prohibit this. Posts mount on pier brackets.
- **Joist blocking is mandatory when span > 8'.** (Changed from wood's 7' threshold per CCRR constraint.)
- **The 75psf load case is the default for snow regions** (Colorado: LL=40, DL=10, SL=25).
- **Never use emdashes in prose output.**
- **framingType must not invalidate deck shape/dimensions.** Switching between wood and steel only affects structural member sizing, not geometry.

### Cache Buster
s75a
