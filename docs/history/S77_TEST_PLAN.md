# S77 Test Plan: Steel Deck Feature + Site Plan Deferred Tests

## Scope

This plan covers all testing deferred from S73-S76:
- S75-S76: Steel deck framing (frontend calc, backend calc, PDF labels, AI helper)
- S73-S74: Site plan improvements (address lookup, lot polygon, setback lines, site elements)

---

## SECTION A: Steel PDF End-to-End (Phase 4 Verification)

Visual verification required for each test. Generate PDF, open in browser, check every sheet.

### A-1: Steel + Ledger + Moderate Snow + 16ga

**Config:**
- 16' x 12' x 4', ledger, 16" OC, 16ga, moderate snow, cold frost
- Composite decking, Fortress railing, no stairs

**Check each sheet:**

| Sheet | What to verify | Pass? |
|-------|---------------|-------|
| A-0 Cover | "FORTRESS EVOLUTION STEEL FRAMING (CCRR-0313)" in LUMBER row (not "NO. 2 DFL / HEM-FIR / SPF") | |
| A-0 Cover | JOISTS shows "2x6-16ga @ 16" O.C." | |
| A-0 Cover | BEAM shows "SINGLE 2X11 STEEL" or similar | |
| A-1 Plan | Ledger label: "FF-EVOLUTION - 16OC - S LEDGER" (no "PT") | |
| A-1 Plan | Joist label: "FF-EVOLUTION - 2X6-16 GA - PC DECK JOISTS @ 16" O.C." (no "P.T.") | |
| A-1 Plan | Beam label: "FF-EVOLUTION 2X11 SINGLE DROPPED BEAM" (no "PT") | |
| A-1 Plan | Post label: "FORTRESS STEEL 3.5"..." (not "6x6 PT", not "SIMPSON") | |
| A-1 Plan | Blocking label: "FF-EVOLUTION - 16OC BLOCKING" (not "2x6-16ga SOLID BLOCKING") | |
| A-1 Plan | Hardware callout: "FF-EVOLUTION" hanger/bracket (not "SIMPSON H2.5AZ" or "LUS210Z") | |
| A-1 Plan | Loads box: "STEEL FRAMING PER FORTRESS EVOLUTION SYSTEM - INTERTEK CCRR-0313" | |
| A-2 Elevations | Beam label uses FF-EVOLUTION format | |
| A-2 Elevations | Post label: "FORTRESS 3.5" STEEL POST" (not "6x6 PT POST") | |
| A-3 Notes | Title: "Per Intertek CCRR-0313 (Fortress Evolution Steel Framing System)" | |
| A-3 Notes | General Req #4: mentions steel framing, ASTM A653 G60 (not "pressure-treated lumber") | |
| A-3 Notes | General Req #5: mentions Fortress brackets + 3/4" screws (not "DFL / HEM-FIR / SPF") | |
| A-3 Notes | Foundation: "Steel posts must NOT be buried underground" + Fortress bracket | |
| A-3 Notes | Framing: FF-Evolution joists, Fortress blocking, F50 brackets (not Simpson hangers) | |
| A-3 Notes | Framing: beam splice "24" overlap + 4x 3/8" SS thru bolts" | |
| A-3 Notes | Ledger: "Fortress S-Ledger" (not "pressure-treated lumber matching joist depth") | |
| A-3 Notes | Materials: "Fortress Evolution brackets and 3/4" self-tapping screws" | |
| A-3 Notes | Footer: mentions CCRR-0313 | |
| A-4 Details | Hardware Schedule: Fortress brackets (Post/Pier, Beam/Post, Hanger, F50, Blocking) | |
| A-4 Details | Hardware Schedule: no Simpson entries except lateral load (DTT2Z) and stair connectors | |
| A-4 Details | Post/Beam detail: "FORTRESS 3.5" STEEL POST", "FF-EVOLUTION" bracket label | |
| A-4 Details | Footing detail: "FF-EVOLUTION" post/pier bracket (not "SIMPSON ABU66Z") | |
| A-4 Details | Ledger detail: "FF-EVOLUTION S-LEDGER" (not "2x8 PT LEDGER") | |
| A-6 Checklist | "FORTRESS/SIMPSON/ETC." (not just "USP/SIMPSON/ETC.") | |

### A-2: Steel + Freestanding + No Snow + 18ga

**Config:**
- 20' x 14' x 6', freestanding, 12" OC, 18ga, no snow, moderate frost
- PT decking, wood railing, no stairs

**Key checks (delta from A-1):**

| Check | Pass? |
|-------|-------|
| A-3 Notes: Freestanding section (not Ledger Attachment) | |
| A-1 Plan: 18ga label "FF-EVOLUTION - 2X6-18 GA" | |
| A-1 Plan: 12" OC spacing shown correctly | |
| Hardware schedule: no ledger bracket, no lateral load entries | |
| Loads box: no snow line, no ledger capacity line | |

### A-3: Steel + Stairs + Heavy Snow

**Config:**
- 16' x 12' x 5', ledger, 16" OC, 16ga, heavy snow, severe frost
- Composite decking, Fortress railing, front stairs

**Key checks:**

| Check | Pass? |
|-------|-------|
| Stair labels: "(3) 2x12 PT STRINGERS" (stairs are wood even on steel deck) | |
| Stair connector: "SIMPSON 'LSC'" (stairs use Simpson, not Fortress) | |
| A-3 Notes: stairs section present with IRC references (not CCRR) | |
| Hardware schedule: stair connectors show Simpson LSC/LSSU | |
| A-1 loads box: snow load line present with "heavy" PSF value | |
| Footing depth: severe frost depth (48") | |

### A-4: Steel + Double Beam

**Config:**
- 24' x 16' x 4', ledger, 16" OC, 16ga, moderate snow, cold frost
- Force steelBeamType: "double" (or use a config that exceeds single beam max)

**Key checks:**

| Check | Pass? |
|-------|-------|
| A-1: Beam label says "DOUBLE" not "SINGLE" | |
| Hardware schedule: "DBL BEAM/POST BRACKET" (not single) | |
| A-4 post/beam detail: shows double beam label | |

### A-5: Steel + Zones

**Config:**
- 16' x 12' main deck + one additive zone (left, 8x6), ledger, steel, 16ga

**Key checks:**

| Check | Pass? |
|-------|-------|
| Zone renders correctly in plan view | |
| Zone framing labels also use FF-EVOLUTION format | |
| A-3 notes: zone note present ("Additional zones have independent framing") | |
| PDF generates without crash | |

---

## SECTION B: Wood Regression Tests

Generate these configs and compare against known-good S75 output.

### B-1: Standard Wood Config

**Config:**
- 16' x 12' x 4', ledger, 16" OC, moderate snow, cold frost, composite, fortress railing, front stairs

**Verify:**

| Check | Pass? |
|-------|-------|
| A-0: "NO. 2 DFL / HEM-FIR / SPF" in LUMBER row | |
| A-1: "P.T. 2x8 @ 16" O.C." joist label (or appropriate size) | |
| A-1: "SIMPSON 'LUS28Z'" or appropriate Simpson hanger | |
| A-1: "SIMPSON 'H2.5AZ'" hurricane tie | |
| A-3: "Per IRC 2021" title | |
| A-3: "pressure-treated lumber" references present | |
| A-4: All Simpson hardware in schedule | |
| A-6: "USP/SIMPSON/ETC." (not Fortress) | |
| No "FF-EVOLUTION" or "Fortress" or "CCRR" appears anywhere | |

### B-2: Wood Freestanding + Heavy Snow

**Config:**
- 20' x 14' x 8', freestanding, 12" OC, heavy snow, severe frost, PT decking, wood railing

**Verify:** All wood labels correct, no steel bleed-through.

---

## SECTION C: Toggle Stress Test

### C-1: Rapid Wood/Steel Toggle

1. Start with wood config, generate PDF. Note labels.
2. Toggle to steel. Verify all state clears (wood overrides gone).
3. Generate steel PDF. Verify Fortress labels.
4. Toggle back to wood. Verify Simpson labels restored.
5. Generate wood PDF. Verify no Fortress labels leaked.

### C-2: Steel Config Persistence

1. Set steel + 18ga + 12" OC.
2. Change deck size (width/depth).
3. Verify gauge/spacing did NOT reset.
4. Toggle to wood then back to steel. Verify gauge/spacing DID reset to defaults.

---

## SECTION D: AI Helper Tests

### D-1: Steel Param Setting

| Test | User message | Expected AI action | Pass? |
|------|-------------|-------------------|-------|
| Switch to steel | "I want to use steel framing" | Sets framingType=steel | |
| Set gauge | "Use 18 gauge joists" | Sets steelGauge=18 | |
| Set beam type | "I want a double beam" | Sets steelBeamType=double | |
| Switch back | "Actually, use wood" | Sets framingType=wood | |

### D-2: Steel Knowledge Questions

| Test | User message | Expected behavior | Pass? |
|------|-------------|------------------|-------|
| Tradeoff question | "Should I use wood or steel?" | Mentions cost, span, rot/termite, CCRR. Doesn't recommend one over the other. | |
| Steel constraint | "Can I bury the steel posts?" | Says NO, steel posts must NOT be buried, mount on pier brackets | |
| Stair material | "Are the stairs steel too?" | Says stairs use wood for now, Fortress steel stair system not yet supported | |
| Code reference | "What code is used for steel?" | Mentions CCRR-0313 (not IRC R507) | |

### D-3: Calc Context

| Test | Expected in calc context | Pass? |
|------|------------------------|-------|
| Steel config | "Framing: STEEL (Fortress Evolution)" | |
| Steel config | "CCRR-0313" in label | |
| Wood config | "Framing: WOOD (PT lumber)" | |
| Wood config | "IRC 2021" in label | |

---

## SECTION E: Site Plan Deferred Tests (S73-S74)

### E-1: Address Lookup

| Test | Steps | Expected | Pass? |
|------|-------|----------|-------|
| Valid address | Enter real CO address, click Look Up | Lot polygon fills, house footprint appears, dimensions auto-populate | |
| Invalid address | Enter nonsense address | Graceful error message, no crash | |
| Auto-fill review | After lookup, check lotWidth, lotDepth, houseWidth, houseDepth | Values match parcel data | |
| House position | After lookup, house appears inside lot boundary | Correct offset and distance from street | |

### E-2: Lot Polygon Rendering

| Test | Expected | Pass? |
|------|----------|-------|
| Rectangular lot | Clean rectangle with correct dimensions | |
| Irregular lot (from address lookup) | Polygon matches parcel shape, no distortion | |
| Lot boundary labels | Width and depth dimensions shown | |

### E-3: Setback Lines

| Test | Expected | Pass? |
|------|----------|-------|
| Default setbacks visible | Dashed lines at front/side/rear setbacks | |
| Custom setback values | Lines move when setback values change | |
| Deck inside setbacks | No warning when deck fits within setbacks | |
| Deck crosses setback | Warning indicator / permit check flag | |

### E-4: Site Elements

| Test | Expected | Pass? |
|------|----------|-------|
| Add garage | Garage rectangle appears on site plan at correct position | |
| Move garage | Position updates when x/y changed | |
| Resize element | Width/depth change reflected in rendering | |
| Remove element | Element disappears from plan | |
| Multiple elements | All render without overlap issues | |
| PDF site plan | All elements appear on A-5 sheet | |

### E-5: North Arrow

| Test | Expected | Pass? |
|------|----------|-------|
| Default (0 degrees) | Arrow points up | |
| Rotate to 90 | Arrow points right | |
| Rotate to 180 | Arrow points down | |
| PDF site plan | North arrow on A-5 matches app setting | |

### E-6: Slope

| Test | Expected | Pass? |
|------|----------|-------|
| Set slope 5% front-to-back | Elevations sheet shows varying post heights | |
| Slope direction changes | Post heights adjust for new direction | |
| A-3 Notes | Site Conditions section appears with slope info | |

---

## SECTION F: Edge Cases

### F-1: Extreme Steel Configs

| Test | Config | Expected | Pass? |
|------|--------|----------|-------|
| Minimum steel | 8' x 6' x 1', steel, 16ga, 16" OC, no snow | PDF generates, no crash | |
| Maximum steel | 50' x 24' x 14', steel, 18ga, 12" OC, heavy snow | Engineering warning appears, PDF generates | |
| 200 PSF load | Very heavy snow region | Correct CCRR load case used | |

### F-2: Mixed Edge Cases

| Test | Config | Expected | Pass? |
|------|--------|----------|-------|
| Steel + chamfer zones | Steel deck with chamfered corners | PDF generates, labels correct | |
| Steel + cutout zone | Steel deck with a cutout | No crash, plan view correct | |
| Steel + all stairs | Steel deck with switchback stairs | Stair labels are wood/Simpson | |

---

## Execution Notes

- Use browser dev console to verify no JS errors after toggle
- For PDF checks, open in browser (not just download) to verify text rendering
- Screenshot any failures for bug tracking
- Mark each cell PASS or FAIL during testing
- Any FAIL gets a bug number and goes into S78 fix queue
