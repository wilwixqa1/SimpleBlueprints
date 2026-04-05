# Session 76 Context File

## S76 Status: Steel PDF Labels (Phase 4) + AI Helper (Phase 5) Complete

### Summary

Completed the remaining two phases of the steel deck feature. Phase 4 updated all PDF drawing sheets to use Fortress/Welborn convention labels instead of wood/Simpson labels when `framingType == "steel"`. Phase 5 added steel framing awareness to the AI helper (settable params, tradeoff knowledge, CCRR-0313 references). The entire steel feature (Phases 1-5) is now code-complete. Next session (S77) is dedicated to comprehensive testing.

---

### What Was Built (3 commits, 7 files changed, ~900 lines)

**Phase 4: PDF Labels (2 commits, 6 files)**

1. **permit_spec.py** (~260 lines changed):
   - Added `STEEL_HARDWARE` table with 14 Fortress bracket/connector types
   - `is_steel` detection moved to top of `build_permit_spec()` for early use
   - Hardware section branches: Fortress brackets for steel, Simpson for wood
   - Full label section branches: all labels use "FF-EVOLUTION" prefix for steel per Welborn/Rick Rutstein convention
   - `loads_lumber` label: "STEEL FRAMING PER FORTRESS EVOLUTION SYSTEM - INTERTEK CCRR-0313" for steel
   - `screw_note` label added for steel (3/4" self-tapping screws, fill all holes)
   - Post/ledger/beam material fields: "STEEL" for steel, "PT"/"LVL" for wood
   - Zone calcs: steel zones use same steel members as main deck (skip wood-specific auto-sizing)

2. **draw_notes.py** (~320 lines changed):
   - Title: "Per Intertek CCRR-0313" for steel, "Per IRC 2021" for wood
   - General Requirements: CCRR compliance, ASTM A653 G60, Fortress brackets/screws (not PT lumber, not species)
   - Foundation: no-bury rule, Fortress Post/Pier Bracket (not Simpson ABU)
   - Framing: FF-Evolution joists, Fortress blocking at 8' threshold, F50 brackets, beam splice 24" overlap + 4x thru bolts, Fortress rim joists
   - Ledger: Fortress S-Ledger (not "pressure-treated lumber matching joist depth")
   - Materials: Fortress-only connections, specific screw part number (#183990341)
   - Footer: references CCRR-0313

3. **draw_details.py** (~190 lines changed):
   - Hardware schedule: complete Fortress bracket list for steel (Post/Pier, Beam/Post, Hanger, F50, Ledger, Blocking, Screws)
   - Ledger detail: "FF-EVOLUTION S-LEDGER" and "FF-EVOLUTION HANGER BRACKET"
   - Footing detail: "FF-EVOLUTION POST/PIER BRACKET" (not "SIMPSON ABU66Z")
   - Post/beam detail: "FORTRESS 3.5" STEEL POST", "FF-EVOLUTION" bracket, beam label
   - Fixed pre-existing `KeyError: 'railType'` bug (used `.get()`)

4. **draw_cover.py** (~19 lines changed):
   - LUMBER row: "FORTRESS EVOLUTION STEEL FRAMING (CCRR-0313)" for steel

5. **draw_checklist.py** (~7 lines changed):
   - Hardware manufacturer: "FORTRESS/SIMPSON/ETC." for steel decks

**Phase 5: AI Helper (1 commit, 1 file)**

6. **main.py** (~30 lines changed):
   - `AI_HELPER_PARAMS` Step 2: Added `framingType`, `steelGauge`, `steelBeamType` as settable params
   - Step 2 UI map: Full description of Wood vs Steel systems, tradeoffs (cost, spans, rot resistance), steel constraints (no-bury, 2x6-only joists, 8' blocking threshold, CCRR scope)
   - Cross-step params: Added `framingType` (settable from any step)
   - Calc context: Shows "STEEL (Fortress Evolution)" or "WOOD (PT lumber)" with correct code reference
   - Fixed stale field names in calc context (`sp` -> `joist_spacing`, `nP` -> `num_posts`, `nF` -> `num_footings`)
   - System prompt: Updated permit disclaimer to mention both IRC 2021 and CCRR-0313

---

### Verified Working

| Test | Result |
|------|--------|
| permit_spec.py: steel labels match Welborn convention | PASS (14/14 checks) |
| permit_spec.py: wood labels unchanged (regression) | PASS |
| draw_notes.py: steel notes render without crash | PASS |
| draw_notes.py: wood notes unchanged | PASS |
| draw_details.py: steel hardware schedule renders | PASS |
| draw_details.py: wood hardware schedule unchanged | PASS |
| draw_cover.py: steel cover sheet renders | PASS |
| draw_checklist.py: steel checklist renders | PASS |
| Steel + stairs: stair labels remain wood/Simpson | PASS |
| Steel + freestanding: freestanding notes render | PASS |
| AI helper prompt: steel params settable | PASS (7/7 checks) |
| AI helper prompt: CCRR-0313 referenced | PASS |
| AI helper prompt: Fortress tradeoffs included | PASS |
| All Python syntax validation | PASS |

---

### Bugs Found and Fixed

1. **Pre-existing `KeyError: 'railType'`** in `draw_guard_rail_detail()`: `params["railType"]` crashed when key not present. Fixed to `params.get("railType", params.get("railingType", "fortress"))`.

2. **Zone calcs indentation error**: When wrapping the wood zone calc loop in an `if/else` for steel, the `for z in zones:` body in the else branch lost its indentation. Fixed immediately.

3. **Stale calc context field names** in AI helper: `sp`, `nP`, `nF` were old aliases that returned `?` in the prompt. Updated to `joist_spacing`, `num_posts`, `num_footings`.

---

### Architecture Notes

**How steel labels flow through the system:**

```
User selects "Steel" on Step 2
  -> Frontend: app.js sets framingType="steel"
  -> Frontend: engine.js calcSteelStructure() returns calc dict with framingType="steel"
  -> Backend (PDF): main.py receives framingType="steel" in DeckParams
  -> Backend: calc_engine.py calculate_steel_structure() returns calc with framingType="steel"
  -> Backend: permit_spec.py build_permit_spec() detects is_steel=True
    -> Sets STEEL_HARDWARE (Fortress brackets)
    -> Generates FF-EVOLUTION labels
    -> Sets material="STEEL" on posts, ledger, beam
  -> Backend: All draw_*.py functions consume spec labels
    -> draw_plan.py: labels from spec (auto-correct)
    -> draw_elevations.py: labels from spec (auto-correct)
    -> draw_notes.py: branches on spec["is_steel"]
    -> draw_details.py: branches on spec["is_steel"]
    -> draw_cover.py: branches on calc["framingType"]
    -> draw_checklist.py: branches on spec["is_steel"]
```

**What was NOT changed (and doesn't need to be):**
- draw_plan.py: consumes spec labels generically (auto-correct)
- draw_elevations.py: consumes spec labels generically (auto-correct)
- draw_site_plan.py: no framing-type awareness needed
- Frontend JS files: no changes needed for Phase 4/5
- steelDeckData.js: reference only, STEEL_PDF_LABELS functions not consumed by backend
- permit_checker.py: already had wood_framing conditions from S75

---

### S77 Test Plan

A comprehensive test plan is committed as `S77_TEST_PLAN.md` in the repo. It covers:

- **Section A**: Steel PDF end-to-end (5 configs: ledger/freestanding, 16ga/18ga, snow levels, stairs, double beam, zones)
- **Section B**: Wood regression (2 configs)
- **Section C**: Toggle stress tests (rapid switching, state persistence)
- **Section D**: AI helper tests (param setting, knowledge questions, calc context)
- **Section E**: Site plan deferred tests from S73-S74 (address lookup, lot polygon, setbacks, site elements, north arrow, slope)
- **Section F**: Edge cases (extreme configs, mixed features)

Total: ~80 individual check items across 6 sections.

---

### Files Changed in S76

1. **permit_spec.py** - STEEL_HARDWARE table, steel label generation, steel-aware materials
2. **draw_notes.py** - Steel-specific general notes (all 7 sections)
3. **draw_details.py** - Fortress hardware schedule, FF-EVOLUTION detail labels, railType fix
4. **draw_cover.py** - Fortress steel framing label
5. **draw_checklist.py** - Fortress manufacturer reference
6. **main.py** - AI helper steel params, UI map, calc context, system prompt
7. **S77_TEST_PLAN.md** - Comprehensive test plan

### Critical Rules (carried forward)

- **Use CCRR-0313 tables as the single source of truth for all steel span data.**
- **Match Welborn's labeling convention exactly for PDF output.** "FF-EVOLUTION - 2X6-16 GA - PC DECK JOISTS @ 16" O.C."
- **Steel posts must NOT be buried.** Mount on pier brackets.
- **Joist blocking required when span > 8' (96").** CCRR threshold, different from wood's 7'.
- **75 PSF load case is the default for snow regions.**
- **framingType must not invalidate deck shape/dimensions.**
- **Never use emdashes in prose output.**
- **Steel uses Fortress brackets, not Simpson hardware.** Exception: lateral load connectors (DTT2Z) and stair connectors (LSC/LSSU) are still Simpson.
- **Stairs use wood materials.** Fortress steel stair system is separate CCRR evaluation.
- **Anti-anchoring rule:** When Will pushes back twice, stop and list all assumptions.
- **Never confirm visual fixes from text extraction alone.**

### Cache Buster
s75a (no frontend changes in S76, backend-only)
