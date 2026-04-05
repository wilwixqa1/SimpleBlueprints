# Session 75 Context File

## S75 Status: Steel Deck Feature, Phases 1-3 Complete + PDF Generation Working

### Summary

Added Fortress Evolution steel deck framing as a parallel option to existing wood framing. Users can toggle between Wood (IRC R507) and Steel (Fortress Evolution, CCRR-0313) on Step 2 (Structure). The steel path has its own calc engine, materials estimator, and permit checker integration. PDF generation works for both paths. Labels on the PDF are functional but not yet formatted to match the Welborn/Rick Rutstein convention (Phase 4 work).

---

### What Was Built (10 files, 1,099 lines added, 6 commits)

**Frontend:**

1. **steelDeckData.js** (18 lines added): Window exports for all CCRR-0313 data tables and utility functions so engine.js can consume them.

2. **engine.js** (453 lines added):
   - `calcSteelStructure(p)`: Full parallel calc function. Maps snowLoad to CCRR load cases (50/75/100/125/150/200), validates joist spans by gauge (16ga/18ga) and spacing (12"/16"), auto-determines single vs double 2x11 beam, validates post height against Table 15. Returns identical dict shape to wood `calcStructure()`.
   - `estSteelMaterials(p, c)`: Full materials estimator with Fortress parts catalog pricing. Joists (gauge/length-matched), S-Ledger, 2x11 beam, 3.5" posts, all brackets (hanger, F50, ledger, rim, beam/post), blocking/straps, self-drilling screw count estimation, beam/joist caps, touch-up paint.
   - Both functions branch early from their wood counterparts via `framingType` check.

3. **app.js** (13 lines added): Three new state params (`framingType: "wood"`, `steelGauge: "16"`, `steelBeamType: "auto"`) in initial state and reset state. Updater clears all wood overrides when switching framingType.

4. **steps.js** (132 lines added):
   - Framing System toggle (Wood/Steel) at top of Step 2
   - Steel mode: gauge selector, fixed 2x6 display, single/double beam chips, fixed 3.5" post display with bury-prohibition warning, post count and footing overrides, CCRR code reference in specs
   - Wood mode: all original controls unchanged
   - Permit readiness display: conditional "CCRR-0313" vs "IRC 2021" label, conditional footer text
   - Bug fix: restored missing IIFE wrapper for wood joists section

5. **index.html** (13 lines changed): Load steelDeckData.js in Phase 1 (before engine.js). Cache buster s75a.

**Backend:**

6. **main.py** (4 lines added): `framingType`, `steelGauge`, `steelBeamType` fields on DeckParams model.

7. **calc_engine.py** (254 lines added): `calculate_steel_structure(params)` with CCRR-0313 joist span table (6 load cases, 2 gauges, 2 spacings), simplified single/double beam max span lookup, same return dict shape as wood.

8. **draw_materials.py** (107 lines added): `estimate_steel_materials(params, calc)` with full Fortress parts BOM. Fixed the crash: `int(beamSize[0])` on "Single 2x11 Steel" (the root cause of the 500 error).

9. **permit_checker.py** (6 lines added): Added `wood_framing`/`steel_framing` tags to `get_config_tags()`. Added `conditions=["wood_framing"]` to `IRC_JOIST_SPAN` and `IRC_BEAM_SPAN` checks so they skip for steel.

---

### Verified Working (manually tested in browser + automated)

| Test | Result |
|------|--------|
| JSX compilation (all 12 JS files) | PASS |
| Frontend calc: 7 configs (wood + steel variants) | ALL PASS |
| Backend calc: 3 configs | ALL PASS |
| Frontend materials: wood and steel BOMs | ALL PASS |
| Backend materials: wood and steel BOMs | ALL PASS |
| Permit checker: wood 17/17, steel 15/15 | ALL PASS |
| Step 2 UI: toggle between wood and steel | PASS (browser verified) |
| Step 2 UI: steel gauge, spacing, beam type selectors | PASS (browser verified) |
| Step 3 UI: unchanged, decking/railing still works with steel | PASS (browser verified) |
| Step 4 UI: permit readiness shows CCRR-0313 for steel | PASS (browser verified) |
| Step 4 UI: permit readiness shows all checks passing for steel | PASS (browser verified) |
| Toggle wood -> steel -> wood -> steel: state clears correctly | PASS (browser verified) |
| Materials list swaps between FF parts and PT lumber | PASS (browser verified) |
| PDF generation with wood: no regressions | PASS (PDF reviewed) |
| PDF generation with steel: generates successfully | PASS (PDF reviewed) |
| Console errors: none after IIFE fix | PASS (browser verified) |

---

### Bugs Found and Fixed During Session

1. **Missing IIFE wrapper** (commit c601bc9): When wrapping the wood structural members block in a `framingType` conditional fragment, the IIFE opening `{(() => { const isOver = ...; const val = ...; return (` was accidentally dropped, leaving `isOver` and `val` as undefined references. Runtime error: "ReferenceError: isOver is not defined". Babel didn't catch it because syntax was valid. Fix: restored the IIFE.

2. **Permit checker false failures** (commit ec58e95): The IRC_JOIST_SPAN and IRC_BEAM_SPAN checks validated steel member names ("2x6-16ga", "Single 2x11 Steel") against IRC R507 tables. They correctly reported "not in IRC tables" because they aren't. Fix: added `conditions=["wood_framing"]` so these checks skip for steel. Also made the permit readiness display conditional (CCRR-0313 vs IRC 2021).

3. **PDF generation 500 error** (commit aa1e591): `draw_materials.py` line 65: `plies = int(beamSize[0])` tried to parse "S" from "Single 2x11 Steel" as an integer. Fix: added `estimate_steel_materials()` as an early-return branch. Also fixed return key mismatch: steel function returned `"sub"` but drawing function expected `"subtotal"`.

---

### Known Issues for Phase 4 (PDF Label Cleanup)

These are all cosmetic label issues on the generated PDF. The structural data is correct; the formatting needs to match the Welborn/Rick Rutstein convention.

**A-0 Cover Sheet:**
- "LUMBER: No. 2 DFL / HEM-FIR / SPF" shows even for steel decks. Should say "FORTRESS EVOLUTION STEEL FRAMING SYSTEM" or similar.

**A-1 Plan & Framing Sheet:**
- Ledger label says "S-Ledger PT LEDGER W/ (2) 5" LEDGER LOCKS @ 16" O.C." -- should drop "PT" for steel, use "FF-EVOLUTION - 16OC - S LEDGER" format.
- Joist label says "P.T. 2x6-18ga @ 16" O.C." -- should say "FF-EVOLUTION - 2X6-18 GA - PC DECK JOISTS @ 16" O.C." per Welborn convention.
- Beam label says "SINGLE 2X11 STEEL PT DROPPED BEAM" -- should drop "PT", use "FF-EVOLUTION 2X11 SINGLE BEAM" format.
- Post label says "3.5x3.5 Steel PT POSTS (5) W/ SIMPSON 'ABU66Z'..." -- should reference Fortress post/pier bracket, not Simpson.
- Blocking label says "2x6-18ga SOLID BLOCKING AT MID-SPAN" -- should say "FF-EVOLUTION - 16OC BLOCKING" per Fortress naming.
- Hardware callout says "SIMPSON H2.5AZ TIES + LUS210Z HANGERS" -- steel uses Fortress brackets, not Simpson hardware.
- Loads box says "LUMBER: No. 2 DFL / HEM-FIR / SPF" -- should say "STEEL FRAMING PER FORTRESS EVOLUTION SYSTEM - INTERTEK CCRR-0313".
- Screw note missing: should add "USE 3/4" SELF-TAPPING SCREWS PER MANUFACTURER'S SPECIFICATIONS - FILL ALL HOLES".

**A-2 Elevations Sheet:**
- Same label issues as A-1 (beam, post, pier labels inherited from permit_spec).

**A-3 General Notes Sheet:**
- Header says "Per IRC 2021 (International Residential Code)" -- for steel should say "Per Intertek CCRR-0313 (Fortress Evolution Steel Framing System)".
- General Requirements #4 mentions "pressure-treated lumber" -- not applicable to steel frame.
- General Requirements #5 mentions "DFL / HEM-FIR / SPF" -- not applicable.
- Framing section references Simpson joist hangers -- should reference Fortress brackets.
- Framing section says "Beam splices shall occur directly over posts only" -- correct for steel too, but should add "24" overlap + 4x 3/8" SS thru bolts" per CCRR.
- Ledger section mentions "pressure-treated lumber matching joist depth" -- should say "Fortress S-Ledger".
- Missing: "Steel posts must NOT be buried underground. Mount on top of pier brackets."
- Missing: "All connections use Fortress Evolution brackets and 3/4" self-tapping screws. Fill all holes."
- Missing: "Joist blocking required every bay at mid-span when span exceeds 8'."

**A-4 Details Sheet:**
- Hardware Schedule references Simpson ABU66Z, BCS2-3/6, LUS210Z, H2.5AZ -- should reference Fortress equivalents (post/pier bracket, beam/post bracket, hanger bracket, F50 bracket).
- Post/Beam Connection detail shows "(2) 2x11 Steel PT BEAM" with "SIMPSON 'BCS2-3/6' POST CAP" -- should show Fortress bracket.
- Ledger detail shows "SIMPSON 'LUS210Z'" -- should show "FF-EVOLUTION LEDGER BRACKET".
- Notes say "All PT lumber shall be .40 CCA or ACQ rated" -- not applicable to steel.

**A-6 Deck Attachment Sheet:**
- References "USP/SIMPSON/ETC." -- should include "FORTRESS" for steel decks.

**Implementation approach for Phase 4:**
The label functions already exist in `steelDeckData.js` (`STEEL_PDF_LABELS`). The fix is in `permit_spec.py` `build_permit_spec()`: when `framingType == "steel"`, generate different label strings using the Fortress naming convention. The drawing functions (`draw_plan.py`, `draw_elevations.py`, `draw_details.py`, `draw_notes.py`) already consume labels from the spec, so updating the spec is sufficient for most fixes. The notes sheet (`draw_notes.py`) needs a steel-specific text variant.

---

### Architecture Notes

**How the steel path works (data flow):**

```
User clicks "Steel" on Step 2
  -> app.js updater sets framingType="wood"->"steel", clears overrides
  -> engine.js calcStructure() branches to calcSteelStructure()
  -> calcSteelStructure() uses CCRR-0313 tables from steelDeckData.js
  -> Returns same dict shape as wood (W, D, H, joistSize, beamSize, postSize, etc.)
  -> All downstream consumers work unchanged (preview, materials table, summary cards)
  -> estMaterials() branches to estSteelMaterials() for Fortress BOM

On PDF generation:
  -> main.py receives framingType="steel" in DeckParams
  -> calc_engine.py calculate_structure() branches to calculate_steel_structure()
  -> permit_spec.py build_permit_spec() generates labels (currently wood-style, Phase 4 fixes)
  -> permit_checker.py skips IRC_JOIST_SPAN and IRC_BEAM_SPAN checks (wood_framing condition)
  -> draw_materials.py estimate_materials() branches to estimate_steel_materials()
  -> All drawing functions render using the labels from spec (functional but not Fortress-formatted)
```

**Key design decisions:**
- Steel calc returns identical dict shape to wood. This means plan view, elevation view, 3D preview, site plan, zone system, stair system all work without any changes. No rendering code was modified.
- Steel-specific fields are additive: `framingType`, `steelGauge`, `steelBeamIsSingle`, `steelLoadCase`, `steelMaxJoistSpan`, `steelMaxCantilever`.
- CCRR load case mapping: snowLoad "moderate" maps to CCRR 75 PSF (matching Welborn/Colorado convention). The mapping accounts for our slightly higher DL (12-15 vs CCRR's assumed 10) by rounding up conservatively.
- Backend has simplified beam span lookup (conservative mid-range constants) vs frontend's full CCRR table lookup. This is acceptable for PDF generation but should be upgraded if we add steel-specific beam span validation to the permit checker.

**What was NOT changed (and doesn't need to be):**
- planView.js, elevationView.js, deck3d.js, sitePlanView.js: all consume calc results generically
- stairGeometry.js, zoneUtils.js, traceView.js: no framing-type awareness needed
- home.js, tracking.js: no changes needed
- All drawing functions (draw_plan.py, draw_elevations.py, etc.): consume labels from spec, work as-is

---

### Remaining Phases

**Phase 4: PDF Labels (next session, S76)**
- Update `permit_spec.py` to generate Fortress-convention labels when `framingType == "steel"`
- Update `draw_notes.py` to have a steel-specific general notes variant referencing CCRR-0313
- Update `draw_details.py` hardware schedule for steel (Fortress brackets instead of Simpson)
- Update `draw_cover.py` to show "FORTRESS EVOLUTION STEEL" instead of lumber species
- The label functions in `steelDeckData.js` STEEL_PDF_LABELS provide the exact format strings

**Phase 5: AI Assistant + Polish**
- Add steel framing context to AI helper system prompt in main.py
- AI should understand: wood vs steel tradeoffs, Fortress part naming, CCRR-0313 constraints
- AI should be able to set framingType, steelGauge, steelBeamType via actions
- Add framingType to the AI_HELPER_PARAMS Step 2 settable params

---

### Files to Upload for S76

1. **steps.js** - Step 2 UI with framing type selector
2. **engine.js** - calcSteelStructure + estSteelMaterials
3. **app.js** - State model with steel params
4. **main.py** - Backend with DeckParams updates
5. **calc_engine.py** - calculate_steel_structure
6. **draw_materials.py** - estimate_steel_materials
7. **permit_checker.py** - wood_framing conditions
8. **permit_spec.py** - Current labels (to be updated in S76)
9. **draw_notes.py** - Current notes (to be updated in S76)
10. **steelDeckData.js** - Data tables + STEEL_PDF_LABELS (reference for label formatting)

### Critical Rules (carried forward)

- **Use CCRR-0313 tables as the single source of truth for all steel span data.** Do not use the installation guide TER numbers.
- **Match Welborn's labeling convention exactly for PDF output.** Label functions are in steelDeckData.js STEEL_PDF_LABELS. Rick's format: "FF-EVOLUTION - 2X6-16 GA - PC DECK JOISTS @ 16" O.C."
- **Steel posts must NOT be buried.** CCRR-0313 and Fortress both prohibit this. Posts mount on pier brackets.
- **Joist blocking is mandatory when span > 8' (96").** This is the CCRR threshold, different from wood's 7'.
- **The 75 PSF load case is the default for snow regions** (Colorado: LL=40, DL=10, SL=25).
- **framingType must not invalidate deck shape/dimensions.** Switching between wood and steel only affects structural member sizing, not geometry.
- **Never use emdashes in prose output.** Use commas, semicolons, or parentheses instead.
- **Steel uses Fortress brackets, not Simpson hardware.** No joist hangers (LUS), no hurricane ties (H2.5AZ), no post bases (ABU). All connections use Fortress-specific brackets and 3/4" self-tapping screws.
- **No species selection for steel.** Steel is steel. The species picker is hidden when steel is selected.
- **Stairs use wood materials for now.** Fortress steel stair system is a separate CCRR evaluation, not included in CCRR-0313. Future phase.
- **SimpleBlueprints anti-anchoring rule:** When Will pushes back on the same issue twice, stop coding, list every assumption being made, and evaluate each from scratch.
- **Never confirm visual fixes from text extraction alone.** Must say "I can't verify the visual layout from here" and wait for user confirmation.

### Cache Buster
s75a
