# Session 75 Context File

## S75 Status: Steel Deck Feature - Phases 1-3 Complete

### What Was Done

**Phase 1: Core State + UI Selection (Complete)**

1. **steelDeckData.js Exports**: Added `window.*` exports for all CCRR-0313 data tables and utility functions.

2. **calcSteelStructure() in engine.js**: Full parallel calculation function for steel framing. Maps snowLoad to CCRR-0313 load cases, validates joist spans by gauge/spacing, auto-determines single vs double 2x11 beam, uses 3.5" steel post with height validation.

3. **State Model (app.js)**: Added `framingType` ("wood"/"steel"), `steelGauge` ("16"/"18"), `steelBeamType` ("auto"/"single"/"double"). Updater clears wood overrides when switching to steel.

4. **Step 2 UI (steps.js)**: Framing type selector with conditional rendering. Steel mode shows gauge selector, fixed 2x6 display, single/double beam selector, fixed 3.5" post display with bury prohibition warning, CCRR-0313 code reference.

5. **Backend DeckParams (main.py)**: Added `framingType`, `steelGauge`, `steelBeamType` fields.

6. **Script Loading (index.html)**: Added steelDeckData.js to Phase 1. Cache buster s75a.

**Phase 2: Structural Calculations (Complete)**
All CCRR-0313 table lookups implemented and tested in both frontend and backend.

**Phase 3: Materials List (Complete)**

7. **estSteelMaterials() in engine.js**: Full steel materials estimator with Fortress parts catalog pricing:
   - Steel joists (16ga/18ga, length-matched to Fortress inventory: 12/14/16/18/20')
   - S-Ledger (12OC/16OC variants)
   - Steel beam 2x11 (single or double with track pieces)
   - 3.5" steel posts with pier brackets
   - All Fortress brackets: hanger, F50, ledger, rim joist, beam/post
   - Blocking and straps (CCRR-mandated when span >8')
   - Self-drilling screw count estimation from CCRR fastening schedule
   - Beam caps, joist caps, touch-up paint
   - Decking and railing same as wood path (material sits on top of steel frame)
   - Stairs use wood materials for now (Fortress steel stair system is separate CCRR eval)
   - Result: ~28% premium over wood, matching real-world pricing

8. **calculate_steel_structure() in calc_engine.py**: Backend parallel to frontend, with:
   - CCRR-0313 joist span table (all 6 load cases, 2 gauges, 2 spacings)
   - Simplified single/double beam max span lookup
   - Same return dict shape as wood for PDF compatibility
   - Engineering warnings for span exceeded

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

**Phase 4: PDF Output (next session)**
- Framing plan labels match Welborn convention (label functions in steelDeckData.js)
- Notes reference CCRR-0313 instead of IRC R507
- Assembly diagram references
- draw_plan_and_framing needs steel framing labels
- draw_notes needs steel-specific general notes
- draw_details needs steel connection details

**Phase 5: AI Assistant + Polish**
- System prompt with steel context
- AI can recommend wood vs steel
- AI understands Fortress part naming
- AI knows CCRR-0313 constraints

---

### Files Modified

- `backend/static/index.html` - Load steelDeckData.js, cache buster s75a
- `backend/static/js/steelDeckData.js` - Window exports added
- `backend/static/js/engine.js` - calcSteelStructure() (195 lines) + estSteelMaterials() (140 lines)
- `backend/static/js/app.js` - framingType/steelGauge/steelBeamType state + updater
- `backend/static/js/steps.js` - Framing type selector, conditional steel/wood controls
- `backend/app/main.py` - DeckParams model fields
- `backend/drawing/calc_engine.py` - calculate_steel_structure() (180 lines)

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
