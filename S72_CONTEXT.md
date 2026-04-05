# Session 72 Context File

## S72 Status: Data-Layer Rotation (Partially Complete)

### What Was Done
Moved lot rotation from the S71 renderer (sitePlanView.js) to the data layer (steps.js). The renderer no longer does any coordinate transforms. It draws what it receives.

### What Works (10 Chichester Rd verified)
- Lot polygon rotated correctly with street at bottom
- Irregular polygon shape preserved (not rectangularized)
- Edge labels showing correct lengths (70, 102, 98, 69, 1)
- House positioned near street, deck in backyard
- House tilt direction correct (SE corner closer to east property line)
- Gap DimLines showing (were hidden in S71)
- Street name (Chichester Road) at bottom
- North arrow correct

### What Needs Verification (S73)
- **houseAngle formula on other orientations.** The negation in the angle normalization was added specifically to fix 10 Chichester (lotRotation=166). Properties with different lotRotation values (especially 10-170 or 190-350 range) need testing. South-facing properties (lotRotation=0) are unaffected because the S72 block doesn't run.
- **Sliders.** `houseDistFromStreet` and `houseOffsetSide` still show un-rotated values (56 and 10). The visual position uses `_houseX`/`_houseY` which are drawing-space. Moving the sliders will change the un-rotated values but won't update `_houseX`/`_houseY`. This needs to be addressed.
- **Drag.** Re-enabled but untested. Drag updates `houseDistFromStreet`/`houseOffsetSide` in lot-space coordinates. With rotated polygon, the drag math may produce wrong results.
- **PDF backend.** `draw_site_plan.py` reads `lotVertices`, `houseDistFromStreet`, `houseOffsetSide`, `houseAngle`. The rotated `lotVertices` should be correct. The house position fields are un-rotated but `_houseX`/`_houseY` are not sent to the backend. PDF rendering needs verification.
- **Other views.** Plan view, elevation view, 3D view use `houseDistFromStreet` to position the deck relative to the house. Since deck is always at `hy + hd`, and those views don't know about `_houseX`/`_houseY`, they should be unaffected (they don't draw the lot polygon). But verify.

### Architecture (S72 Current State)

**Data flow:**
1. Parcel lookup returns lot vertices and address point (un-rotated, geographic)
2. Initial street detection via centroid-to-address ray
3. Building footprint callback fires (async):
   a. Road correction identifies street edge, computes `drawRotation`
   b. `newEdges` built with correct street/rear/side metadata
   c. Existing positioning code runs on un-rotated data, produces `newOffset=10, newDist=56`
   d. S72 block fires if `drawRotation !== 0`:
      - Rotates lot vertices around centroid, normalizes to origin
      - Computes `_rFn72` (same rotation function as S71 renderer)
      - Computes `hx/hy` from offset/dist using `leftEdgeAtY` on un-rotated polygon
      - Rotates house center via `_rFn72`, stores as `_houseX`/`_houseY`
      - Normalizes `houseAngle` mod 180, negates for SVG Y-flip
      - Stores all values via `u()` calls with `lotVertices` LAST

**Why lotVertices must be set last:**
The engine (`engine.js` line 107) calls `computePolygonVerts(p.lotEdges)` when `p.lotVertices` is null but `p.lotEdges` exists. `computePolygonVerts` for 5+ edges distributes edges with equal exterior angles (72 degrees for 5 edges), producing a regular polygon that looks rectangular. If `lotEdges` is set before `lotVertices` in the u() call sequence, an intermediate render triggers this regeneration, overwriting the real irregular polygon. Setting `lotVertices` last ensures the final render uses the actual rotated vertices.

**State variables after S72 block:**
- `lotVertices`: rotated polygon (drawing space)
- `lotWidth`: rotated bounding box width (75 for Chichester)
- `lotDepth`: rotated bounding box height (102 for Chichester)
- `lotEdges`: original `newEdges` from road correction (lengths preserved by rotation)
- `_houseX`: rotated house corner X (5.5 for Chichester)
- `_houseY`: rotated house corner Y (22.3 for Chichester)
- `houseAngle`: normalized and negated (1.5 for Chichester)
- `_lotRotation`: 0 (cleared so renderer doesn't double-rotate)
- `houseDistFromStreet`: UNCHANGED (56, un-rotated geographic value)
- `houseOffsetSide`: UNCHANGED (10, un-rotated geographic value)
- `northAngle`: 166 (unchanged, used for north arrow direction)

**Renderer (sitePlanView.js):**
- No S71 rotation code remains
- `verts = p.lotVertices` (pre-rotated)
- If `_houseX`/`_houseY` exist, uses them directly as `hx`/`hy`
- Otherwise falls back to `leftEdgeAtY` + `houseOffsetSide` (for non-rotated properties)
- `_combAngle = p.houseAngle` (already includes lot rotation)
- Gap DimLines use `bbLx`/`bbLy`/`viewW`/`viewD` directly (drawing space)
- Stairs use `dx`/`dy` directly
- Drag re-enabled (no `lotRot` check)

### S72 Key Lessons

1. **computePolygonVerts will regenerate your polygon.** The engine rebuilds polygon vertices from edge lengths when `lotVertices` is null. Individual `u()` calls create intermediate states where this happens. Always set `lotVertices` last.

2. **React state is stale in async callbacks.** Use local variables (`newDist`, `newOffset`) from the computation, not `p.houseDistFromStreet` which has the pre-callback value. This was already an S70 lesson but was re-learned the hard way.

3. **SVG Y-flip reverses rotation direction.** `sy(ly) = oy + lotPxH - ly * scale` flips Y. A positive angle in lot-space produces the opposite visual rotation in SVG. The houseAngle must be negated after normalization.

4. **178.5 degree SVG group rotation flips the deck.** When positions are pre-rotated, a 178.5 degree group rotation puts the deck on the wrong side. Must normalize mod 180 to get ~1.5 degrees, then negate for SVG Y-flip.

5. **Don't re-derive positions. Carry forward correct values.** The S71 renderer already computed correct `hx`/`hy`. The S72 refactor should reproduce that exact computation (compute in un-rotated space, rotate via `_rFn`), not feed rotated inputs into positioning code. Will stated this repeatedly. It took 21 pushes to actually do it.

6. **Map all consumers before changing state variables.** `lotVertices`, `lotEdges`, `lotWidth`, `lotDepth`, `houseAngle`, `houseDistFromStreet`, `houseOffsetSide` are read by: renderer, sliders, drag handler, PDF backend, engine (area calc), setback computation, `computePolygonVerts`, `computeRectEdges`, `computeRectVertices`, deck positioning, other views. Changing one without understanding all consumers causes cascading bugs.

7. **Ship one change, verify visually, then continue.** Stacking vertex rotation + position rotation + angle normalization + edge recomputation in one push makes it impossible to identify which change broke things.

### Critical Anti-Pattern (S72)
**DO NOT re-derive house position from rotated inputs.** The positioning code (`leftEdgeAtY`, address point scan) was designed for un-rotated geographic coordinates. Feeding rotated coordinates through it produces wrong results. The correct approach: let positioning code run on un-rotated data, then rotate the OUTPUT.

**DO NOT try to back-compute `houseOffsetSide`/`houseDistFromStreet` from rotated `hx`/`hy`.** This back-conversion through `leftEdgeAtY` on the rotated polygon is lossy and produces wrong values. Store `_houseX`/`_houseY` directly.

**WHEN WILL SAYS "just use the values that are already correct" HE MEANS IT.** Do not acknowledge and then do something different. Repeat his instruction back, confirm the specific code change, then implement exactly that.

---

## S72 Git History
```
856c4b3 S72 push 21: Set lotVertices LAST to prevent engine computePolygonVerts override
5696833 S72 push 20: Debug log for lotEdges to trace why rect fallback
ccb3b9e S72 push 19: Restore u(lotEdges, newEdges)
1d2da84 S72 push 18: Don't recompute edge lengths
e594f41 S72 push 17: Log input and rotated vertices
a9376ca S72 push 16: Negate normalized angle for SVG Y-flip
0588ee6 S72 push 15: Fix crash - _normAng72 reference
7b5bc55 S72 push 14: houseAngle = 346 (testing)
646cd24 S72 push 13: houseAngle = 364 (testing)
c8b30ba S72 push 11: angle [0,360) range
3eda503 S72 push 10: Revert to normalized angle
916927d S72 push 9: Raw angle (broke deck)
2552c80 S72 push 8: Centroid debug log
a39314c S72 push 7: Pre-rotate hx/hy debug log
0439dec S72 push 6: Fix stale React state
5129472 S72 push 5: Store _houseX/_houseY directly
07aac24 (reverted to 3x) S71 push 10 baseline
```
Note: Pushes 1-4 were reverted. Push 5 was the first approach that stored `_houseX`/`_houseY` directly. Pushes 6-21 were fixes and debugging.

## Updated File Sizes

| File | Lines | Last Modified |
|------|-------|---------------|
| `backend/app/main.py` | ~2505 | S70 |
| `backend/static/js/steps.js` | ~4223 | S72 push 21 |
| `backend/static/js/sitePlanView.js` | ~665 | S72 push 5 |
| `backend/drawing/draw_site_plan.py` | ~955 | S70 |
| `backend/static/index.html` | ~97 | S72 (cache buster s72u) |

## Updated Cache Buster
s72u

## Session Rules Additions

- **Set lotVertices LAST in u() call sequences (S72).** The engine regenerates polygon from edge lengths when lotVertices is null. Individual u() calls create intermediate renders. lotVertices must be the final u() call to prevent computePolygonVerts from overwriting the real polygon with a regular shape.
- **Do not re-derive house position from rotated data (S72).** Compute position in un-rotated space (proven correct), then rotate the output. Store as `_houseX`/`_houseY`. Never back-compute offset/dist from rotated coordinates.
- **houseAngle normalization needs verification on other orientations (S72).** Current formula: `-(((primary.angle + lotRotation) % 180 + 180) % 180)` clamped to [-90,90]. Verified for lotRotation=166 (Chichester). Not verified for other bearings. Test with east/west-facing properties in S73.
