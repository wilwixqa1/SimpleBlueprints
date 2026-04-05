# Session 73 Context File

## S73 Status: Coordinate Unification + UX Improvements (Complete)

### What Was Done

**1. Option C: Unified Coordinate Systems (Push 1)**
Eliminated the split-brain problem from S72 where `_houseX`/`_houseY` (drawing space) coexisted with `houseOffsetSide`/`houseDistFromStreet` (un-rotated geographic). After the S72 rotation block, `houseOffsetSide` and `houseDistFromStreet` are now recomputed in drawing space so all downstream consumers work without knowing rotation occurred.

- `_houseX`/`_houseY` eliminated entirely
- Renderer uses single code path: `leftEdgeAtY` + `houseOffsetSide` for all properties
- Every consumer (sliders, drag, PDF, setback gaps, site elements) receives values consistent with the rotated `lotVertices`

**2. Engine Clamp Bypass for Auto-Detected Properties (Push 3-4)**
The S29 engine rule clamped `houseDistFromStreet` to `setbackFront` minimum. This overwrote the correct auto-detected value (e.g., 22) with the setback value (e.g., 25). Houses can legitimately be closer to the street than the setback (setback applies to new construction, not existing house).

- Skip clamp when `_autoHouseDist` exists in state
- When `_autoHouseDist` is being set via `u()`, also sync `houseDistFromStreet` to undo any prior clamping
- This handles React batching where `_autoHouseDist` may not be in `prev` state when `houseDistFromStreet` fires

**3. Auto-Detected House Position UI (Push 2, 5)**
- House position sliders hidden behind green "Auto-detected from satellite data" banner when `_autoHouseOffset` exists
- Banner shows current values: "House: 57' x 28', offset 4' from left, 22' from street"
- "Adjust manually" link reveals sliders with yellow warning: "Only adjust if the position doesn't match your property"
- "Reset to detected values" button appears when any value differs from auto-detected
- In guided `verify_extracted` phase, `lotHouse` section is hidden entirely (only revealed via "Let me adjust" button)

**4. Building Footprint Loading Screen (Push 9)**
- New `footprint_loading` guide phase: "Detecting your house..." shown while building footprint API is in flight
- Guide only advances to `verify_extracted` when footprint callback completes or fails
- All early-return paths in footprint callback also advance the guide
- Prevents user from clicking "Looks good" before all data is loaded

**5. Footprint Retry + Failure Warning (Push 10)**
- Auto-retries building footprint lookup once after 2s on network failure
- If both attempts fail, sets `footprintFailed` flag
- Yellow warning banner: "House detection unavailable" with explanation
- "Retry Detection" button fires `window._retryFootprint()`
- "Dismiss" button hides warning and lets user proceed

**6. AI Chat Reset House Position (Push 11)**
- New `resetHousePosition` action type in `_applyActions`
- Backend system prompt updated with auto-detected values context
- AI can respond to "I accidentally moved the house" with reset action
- Example in prompt format for the AI

**7. Multi-Select Delete on My Projects (Push 8)**
- Checkboxes on each project row in DraftsPage
- "Select All" / "Deselect All" toggle button
- "Delete N" button for bulk delete with confirmation
- Parallel API delete calls via `Promise.all`
- Selected rows get green highlight
- Row click toggles selection in select mode, opens project in normal mode
- Back arrow exits select mode when items selected

**8. PDF Backend Verified (Push 6-7)**
- PDF site plan confirmed working with unified coordinates
- `houseAngle` negation tested and reverted (was correct as-is)
- House position, lot polygon, setback lines, edge labels all match frontend

### Architecture (S73 Current State)

**Data flow (after S73):**
1. Parcel lookup returns lot vertices and address point (un-rotated, geographic)
2. Initial street detection via centroid-to-address ray
3. Building footprint callback fires (async):
   a. Road correction identifies street edge, computes `drawRotation`
   b. `newEdges` built with correct street/rear/side metadata
   c. Positioning code runs on un-rotated data, produces `newOffset=10, newDist=56`
   d. S72 rotation block fires if `drawRotation !== 0`:
      - Rotates lot vertices around centroid, normalizes to origin
      - Computes house corner in un-rotated space, rotates via `_rFn72`
      - Computes `_drawHX`/`_drawHY` (drawing-space house corner)
      - **S73: Runs `leftEdgeAtY` on rotated polygon to compute `_drawOffset`**
      - **S73: Sets `houseDistFromStreet = _drawHY`, `houseOffsetSide = _drawOffset`**
      - **S73: Stashes auto-detected values BEFORE setting houseDistFromStreet (for clamp bypass)**
      - Normalizes `houseAngle` mod 180, negates for SVG Y-flip
      - Stores all values via `u()` calls with `lotVertices` LAST
   e. For non-rotated path: stashes auto-detected values after positioning

**State variables after S73 rotation block:**
- `lotVertices`: rotated polygon (drawing space)
- `lotWidth`: rotated bounding box width
- `lotDepth`: rotated bounding box height
- `lotEdges`: original `newEdges` from road correction (lengths preserved)
- `houseOffsetSide`: drawing-space offset from left polygon edge (was un-rotated in S72)
- `houseDistFromStreet`: drawing-space Y position (was un-rotated in S72)
- `houseAngle`: normalized and negated for SVG
- `_lotRotation`: 0 (cleared so renderer doesn't double-rotate)
- `_autoHouseOffset`: stashed auto-detected offset (for reset)
- `_autoHouseDist`: stashed auto-detected distance (for reset)
- `_autoHouseWidth`: stashed auto-detected house width (for reset)
- `_autoHouseDepth`: stashed auto-detected house depth (for reset)
- `northAngle`: unchanged, used for north arrow direction

**Renderer (sitePlanView.js):**
- Single code path for house positioning
- `leftEdgeAtY(houseMidY) + houseOffsetVal` for all properties
- No `_houseX`/`_houseY` branch (removed in S73)

**Engine (app.js):**
- S29 clamp of `houseDistFromStreet` to `setbackFront` skipped when `_autoHouseDist` exists
- When `_autoHouseDist` is set, `houseDistFromStreet` is synced to match (undoes prior clamping)

### What Needs Verification (S74)

- **houseAngle formula on other orientations.** Still only verified for lotRotation=166 (Chichester). East/west-facing properties untested. This was on the S72 todo and not addressed in S73.
- **Drag handler.** Re-enabled, should work with unified coordinates since `leftEdgeAtY` scans rotated `verts`. Untested.
- **Slider behavior when expanded.** The "Adjust manually" sliders should move the house visually. Not fully tested due to the `houseDistFromStreet` clamping fix arriving mid-session.
- **Non-rotated property flow.** Auto-detected values stash for non-rotated path (`_lotRot72 === 0`) should work but needs testing to confirm the green banner appears.
- **Footprint retry timing.** 2-second retry delay is arbitrary. May need adjustment based on real Overpass timeout patterns.
- **AI chat resetHousePosition.** Added to system prompt but not tested end-to-end. Verify the AI actually fires the action.

### S73 Key Lessons

1. **Unify coordinate systems, don't patch consumers.** S72 stored `_houseX`/`_houseY` and patched the renderer. S73 showed the right approach: recompute `houseOffsetSide`/`houseDistFromStreet` in drawing space so no consumer needs to change. Every downstream consumer works as if there was no rotation.

2. **The engine has hidden clamping rules.** `app.js` S29 clamps `houseDistFromStreet >= setbackFront`. This silently overwrote the correct auto-detected value. Always check the reducer/engine for side effects when storing values via `u()`.

3. **React batching affects reducer state.** Each `u()` call creates `next = { ...prev, [k]: v }`. In async callbacks, `prev` may not include values set by a prior `u()` in the same callback. Solution: add reducer rules that fire on the dependency's key (e.g., when `_autoHouseDist` is set, also sync `houseDistFromStreet`).

4. **Product thinking matters.** Hiding house position sliders and adding the auto-detected banner was the right UX call. Users shouldn't adjust values that came from satellite data unless something looks wrong. The "Adjust manually" / "Reset to detected values" pattern protects against accidents while preserving control.

5. **Handle async failure gracefully.** The Overpass API times out frequently. Auto-retry + warning banner + manual retry button gives users a good experience even when external services fail.

### Critical Rules (Carried Forward + New)

- **Set lotVertices LAST in u() call sequences (S72).** The engine regenerates polygon from edge lengths when lotVertices is null.
- **Do not re-derive house position from rotated data (S72).** Compute position in un-rotated space, then rotate the output.
- **houseAngle normalization needs verification on other orientations (S72).** Current formula verified only for lotRotation=166.
- **Set _autoHouseDist BEFORE houseDistFromStreet (S73).** The engine clamp checks for `_autoHouseDist` to decide whether to skip clamping. If `_autoHouseDist` isn't set yet, the clamp fires and overwrites the correct value.
- **houseAngle is stored in SVG convention (negated) (S73).** The PDF backend uses it directly with matplotlib, which happens to work because matplotlib's `rotate_deg_around` with Y-up produces the correct visual. Do not negate again in the PDF backend.

---

## S73 Git History
```
0429f32 S73 push 11: AI chat can reset house position to auto-detected values
b5a8738 S73 push 10: Auto-retry footprint detection + failure warning with retry button
ab901f6 S73 push 9: Loading screen for building footprint detection
516643f S73 push 8: Multi-select delete on My Projects page
6d1f377 S73 push 7: Revert houseAngle negation in PDF - was correct before
b8abfac S73 push 6: Negate houseAngle in PDF backend for matplotlib Y-up coords (reverted)
f183435 S73 push 5: Hide lot/house sliders in guided verify phase
b539d26 S73: trigger redeploy
31fc3f0 S73 push 4: Force houseDistFromStreet sync when _autoHouseDist is set
0b68651 S73 push 3: Fix houseDistFromStreet clamping for auto-detected properties
faebb40 S73 push 2: Hide house position sliders behind auto-detected banner with reset
f22ae47 S73 push 1: Option C - unify coordinate systems, eliminate _houseX/_houseY
```

## Updated File Sizes

| File | Lines | Last Modified |
|------|-------|---------------|
| `backend/app/main.py` | ~2513 | S73 push 11 |
| `backend/static/js/steps.js` | ~4343 | S73 push 11 |
| `backend/static/js/sitePlanView.js` | ~659 | S73 push 1 |
| `backend/static/js/app.js` | ~1381 | S73 push 4 |
| `backend/static/js/home.js` | ~253 | S73 push 8 |
| `backend/drawing/draw_site_plan.py` | ~955 | S73 push 7 |
| `backend/static/index.html` | ~96 | S73 push 11 |

## Updated Cache Buster
s73j

## TODOs for Future Sessions

- **Bulk delete UX:** Works but could use a "select mode" toggle instead of always-visible checkboxes
- **Test houseAngle on other orientations:** East/west-facing properties, lotRotation values in 10-170 and 190-350 ranges
- **Test non-rotated property flow:** Verify auto-detected banner appears for properties with drawRotation=0
- **Test drag handler:** Verify dragging house updates position correctly with rotated polygon
- **Footprint retry tuning:** Monitor Overpass timeout frequency, adjust retry delay if needed
- **AI chat resetHousePosition:** End-to-end test
