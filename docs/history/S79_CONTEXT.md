# Session 79 Context File

## S79 Status: Site Plan Architecture Overhaul

### Summary

S79 was a comprehensive rearchitecture of the site plan lookup feature, driven by a full codebase review and critical analysis of 6+ sessions of accumulated complexity (S71-S78). The core insight was that the pipeline had too many external dependencies in the critical path, and each session fixed one address while breaking another.

**Key architectural change:** Lot rotation is now derived from the lot polygon's street edge angle (available immediately from Realie data), not from Overpass road bearing. Overpass is demoted to a validation/enrichment role. The site plan renders correctly even when Overpass fails.

**Philosophy:** "Good enough, never wrong." Optimize for the floor of quality (never looks obviously broken) rather than the ceiling (sometimes perfect). Dimensions are sacred, position is flexible.

**Commits:** 4 (S79, S79b, S79c, S79c-fix)

---

### What Was Built

#### 1. Polygon-Edge Rotation (S79 -- the big architectural win)

**Before:** Rotation depended on Overpass road bearing. When Overpass timed out (~30% of requests), the lot wasn't rotated at all, or the address-point fallback bearing produced wildly wrong rotation (e.g., 10 Chichester: 64-degree error).

**After:** Rotation is computed from the street edge of the lot polygon itself. The street edge is identified by shooting a ray from the lot centroid through the Realie address geocode point (this detection already existed in S70). The bearing of that edge gives the rotation angle directly.

**Implementation (steps.js, parcel callback):**
- After `streetIdx` is identified by ray-cast, compute `streetEdgeAngle = atan2(dy, dx)` of that edge
- Rotation = `-streetEdgeAngle`, with a check to ensure street ends up at bottom (min Y), flip 180 if needed
- Skip rotation for near-zero angles (< 3 degrees)
- Store rotation params in closure variables (`_s79Cos`, `_s79Sin`, `_s79Cx`, `_s79Cy`, `_s79Mx`, `_s79My`, `_s79Rotated`) for reuse by building footprint callback
- Lot vertices rotated and shifted to origin immediately
- `lotVertices` set LAST to prevent engine polygon regeneration race

**Result:** Rotation is available immediately (~1s after address entry) with zero external API dependency. Works 100% of the time when Realie returns a polygon.

#### 2. Overpass Validation/Override (S79b)

**Problem discovered during testing:** The ray-cast street edge detection picked the wrong edge for 2 out of 3 test addresses (10 Chichester, 368 Croaton). The Realie address geocode point is not always on the street side of the lot centroid.

**Solution:** When Overpass returns a road bearing, check if it agrees with the ray-cast edge selection. If not, re-identify the correct street edge from the Overpass bearing and re-rotate the lot from original vertices.

**Implementation (steps.js, building footprint callback):**
- Compute outward normal of each original (unrotated) lot edge
- Find edge whose normal is closest to Overpass road bearing
- If that edge differs from `streetIdx`: re-rotate from `data.lot.vertices`, update all closure variables, update `lotVertices`/`lotEdges`/`lotWidth`/`lotDepth`
- If it matches: just enrich street name label (most common case when ray-cast is correct)
- If Overpass failed: keep ray-cast result (acceptable fallback)

**Flow:**
```
1. Parcel callback: ray-cast -> streetIdx -> rotate (immediate, ~1s)
2. Building footprint callback (~3-15s later):
   a. Overpass confirms ray-cast edge -> just add street name
   b. Overpass disagrees -> re-rotate from originals, reposition house
   c. Overpass failed -> keep ray-cast result, flag as medium confidence
```

#### 3. Improved House Positioning (S79)

**Before:** When house didn't fit at the Solar centroid position, it was clamped to the lot edge (`if (offset > maxOffset) offset = maxOffset`). This pushed houses against property lines, looking wrong.

**After:** When house doesn't fit, it's centered horizontally within the available span instead of being clamped to an edge. Minimum 2ft from any edge.

**Key principle:** Dimensions are sacred, position is flexible. Never shrink the house to fit. Never push to an edge. Center if uncertain.

#### 4. Realie Cross-Validation for Dimensions (S79)

**Backend (main.py):** Building-footprint endpoint now accepts `realie_sqft` and `stories` parameters. After Solar bbox inflation correction, compares Solar footprint against `realie_sqft / stories`. If Solar is >1.5x larger, scales down (preserving aspect ratio). Logs warnings for disagreements.

**Frontend (steps.js):** Passes `data.building.sqft` and `data.building.stories` to the building-footprint fetch call.

#### 5. Address-Point Fallback Bearing Removed (S79)

The S78 fallback (computing road bearing from building center to address geocode point) was removed entirely. It was unreliable (13ft distance at 10 Chichester produced 243-degree bearing vs correct 346) and is now unnecessary since rotation comes from the polygon edge.

Caching logic simplified accordingly (no more "don't cache fallback-only results" special case).

#### 6. Loading Overlay (S79c)

**Problem:** User saw the site plan render with initial (potentially wrong) layout, then it jumped when Overpass corrected the street edge 5-15 seconds later. Jarring and undermines trust.

**Solution:** Fully opaque loading overlay covers the site plan preview while building footprint fetch is in-flight. User sees a spinner with "Finalizing site plan..." until everything is ready, then the final correct layout appears all at once.

**Implementation:**
- `p._siteplanLoading` flag set true when fetch starts, false when it completes (success, failure, or early return)
- `SitePlanView` renders overlay div on top of SVG when flag is true
- CSS keyframe animation for spinner injected once via `document.createElement("style")`

#### 7. Confidence Banner (S79c)

**After loading completes, a banner appears below the site plan with actionable guidance:**

| Level | Color | When | Message examples |
|-------|-------|------|-----------------|
| High | Green + checkmark | Overpass confirmed street edge + Solar centroid positioned inside lot | "Street, position, and dimensions verified against satellite data." |
| Medium | Yellow + warning | Overpass unavailable OR position was approximate | "Street edge detected from address data only. Verify the street is on the correct side." |
| Low | Orange + warning | No building data at all, or fetch failed | "Building data unavailable. Dimensions are estimated from tax records. Verify house width, depth, and position." |

**Implementation:**
- `p._siteplanConfidence` object with `{ level, messages }` set at end of building footprint callback
- Every exit path (success, no buildings, no primary, catch error) sets appropriate confidence
- `SitePlanView` renders banner div below SVG when confidence exists and loading is false

---

### Architecture After S79

```
Data flow (time-ordered):

  1. User enters address (~0s)
  
  2. Realie API response (~1-2s):
     -> Lot polygon (vertices in feet)
     -> Address geocode point (lat/lng)
     -> Building sqft estimate + stories
     -> Street edge detected via centroid->address ray-cast
     -> Lot rotated from polygon edge angle (IMMEDIATE, no API wait)
     -> Initial house position (centered, estimated dims)
     -> _siteplanLoading = true, loading overlay shown

  3. Building footprint API response (~3-15s):
     -> Overpass: road name + bearing (validates/overrides street edge)
     -> Overpass: secondary structures (sheds, garages)
     -> Google Solar: building center + bbox + roof area
     -> Cross-validation: Solar dims vs Realie sqft/stories
     -> If Overpass disagrees with ray-cast: re-rotate from originals
     -> Solar centroid rotated, house positioned with improved clamping
     -> _siteplanLoading = false, overlay removed
     -> _siteplanConfidence computed, banner shown

  4. User sees final site plan + confidence banner
```

**Key coordinate systems:**

| System | Origin | Used by |
|--------|--------|---------|
| Geographic (WGS84) | lat/lng | Realie API, Google Solar API, Overpass API |
| Lot coords (unrotated) | min(lat,lng) of parcel -> feet | `_coords_to_feet`, Solar centroid, Overpass buildings |
| Drawing space (rotated) | Rotated lot with min corner at (0,0) | Everything the renderer sees |

**Rotation transform (stored in closure):**
```javascript
// Forward: unrotated -> drawing space
drawX = _s79Cx + (x - _s79Cx) * _s79Cos - (y - _s79Cy) * _s79Sin - _s79Mx;
drawY = _s79Cy + (x - _s79Cx) * _s79Sin + (y - _s79Cy) * _s79Cos - _s79My;
```

---

### Test Results

**4 Tulsa St, Dix Hills NY 11746:**
- Ray-cast: edge 3 (correct)
- Overpass: confirms edge 3 (Tulsa Street, angleDiff=0.4)
- Rotation: 234.9 degrees
- Solar: 34.2x36.7, centroid rotated to (23.3, 35.7)
- Position: offset=6, dist=17
- Confidence: HIGH (Overpass confirmed, centroid inside lot)
- **Issue:** House positioned closer to street than reality (dist=17 vs ~42-47 estimated from Google Maps). Centroid Y offset issue, see Known Issues #1.
- Status: **ACCEPTABLE** -- user can drag to adjust

**10 Chichester Rd, Huntington Station NY 11746:**
- Ray-cast: edge 4 (WRONG)
- Overpass: edge 3 (Chichester Road, bearing=346, angleDiff=0.1)
- S79b re-rotation: 165.9 degrees, Chichester Road at bottom
- Solar: 42.9x31.5, centroid rotated to (24.4, 47.3)
- Position: offset=2, dist=31
- Confidence: HIGH (Overpass overrode and corrected)
- **Issue:** Lot shape looks slightly irregular, house dimensions (43x32) possibly inflated from Solar bbox. Real building is L-shaped which Solar can't represent.
- Status: **ACCEPTABLE** -- massive improvement over S78 (was wildly wrong)

**368 Croaton St, Ronkonkoma NY 11779:**
- Ray-cast: edge 0 (WRONG)
- Overpass: edge 2 (Croaton Street, bearing=355, angleDiff=0.5)
- S79b re-rotation: 175.5 degrees, Croaton Street at bottom
- Solar: 30.3x47.8, centroid rotated to (34.2, 42.2)
- Position: offset=19, dist=18
- Confidence: HIGH
- Status: **GOOD**

**Key finding:** Ray-cast picked the wrong edge for 2 out of 3 test addresses. Overpass validation/override (S79b) is essential, not optional. Without it, the polygon-edge rotation would have produced wrong results for the majority of properties.

---

### Known Issues and Where Site Plan Lookup Still Fails

#### 1. Centroid Y Offset (house too close to street)
**Severity: Medium. Affects: most properties.**
The Solar centroid, after rotation, maps to a Y position that's closer to the street than the actual house position. At 4 Tulsa, the house should be at dist ~42-47 but we compute dist=17. The rotation angle is correct (confirmed by Overpass), so the issue is either:
- Solar centroid has a slight geographic offset vs the Realie lot polygon origin
- The rotation transform amplifies a small coordinate mismatch
- The lot polygon origin (min lat/lng corner) doesn't precisely match the Solar coordinate reference

**Impact:** House is inside the lot and parallel to street, just not in the exact right spot vertically. User can drag to correct in ~1 second.

**Future fix:** Investigate the unrotated Solar centroid position relative to the lot polygon. Compare against Google Maps satellite to determine if the offset is consistent (always too close to street) or variable.

#### 2. Ray-Cast Street Edge Detection Unreliable
**Severity: Medium. Mitigated by Overpass validation.**
The Realie address geocode point is NOT a reliable indicator of which side the street is on. It may be near a driveway entrance, mailbox, or property access point that's on a different side than the street frontage.

2 out of 3 test addresses had wrong ray-cast results. Overpass corrected both. But when Overpass fails (~30% of requests), the ray-cast result stands and may show the wrong street edge.

**Impact when Overpass fails:** Lot may be rotated to put the wrong edge at the bottom. Confidence banner shows "medium" with "Verify the street is on the correct side." User needs to manually check.

**Future fix options:**
- Use lot frontage data from Realie (the shortest edge facing the street is often identifiable by lot geometry alone)
- Use Google Geocoding API for a more accurate address point
- Let user click which edge is the street

#### 3. Solar BBox Dimensions for Rotated/Irregular Buildings
**Severity: Low-Medium.**
Solar's bounding box is axis-aligned. For rotated buildings, the bbox is inflated. The sqrt correction (from S78) helps but is approximate. For L-shaped or T-shaped buildings, a rectangular bbox can't represent the actual footprint.

10 Chichester shows 43x32 but the real building is L-shaped and probably ~35x28 for the main section.

**Impact:** House dimensions are approximate. User can adjust via sliders.

**Future fix:** Microsoft Building Footprints API provides actual polygon outlines for free. Would give accurate dimensions AND shape representation.

#### 4. Overpass Reliability
**Severity: Low (demoted from critical in S79).**
Overpass still times out ~30% of the time. Before S79, this was critical (no rotation). Now it means:
- Street name shows as address instead of road name (cosmetic)
- Street edge detection falls back to ray-cast (may be wrong, see #2)
- Confidence drops to "medium"

**Future fix:** Add third Overpass mirror, or cache road data at neighborhood level (roads don't change).

#### 5. Closure Variable Fragility
**Severity: Low (technical debt).**
The rotation state is stored in 7 separate closure variables (`_s79RotRad`, `_s79Cos`, `_s79Sin`, `_s79Cx`, `_s79Cy`, `_s79Mx`, `_s79My`, `_s79Rotated`). The building footprint callback reads these async, relying on JavaScript's single-threaded execution. Works correctly but is fragile and error-prone for future modifications.

During S79 implementation, a coordinate-system bug was caught where secondary structure centroids (unrotated space) were being checked against rotated lot vertices. Fixed by using `data.lot.vertices` (original unrotated) for the point-in-polygon check. This class of bug is made more likely by the implicit coordinate space tracking.

**Future fix:** Refactor into a single rotation context object:
```javascript
var _s79 = {
  rotated: false,
  originalVerts: verts,
  rotatedVerts: verts,
  edges: edges,
  transform: function(x, y) { return [x, y]; }
};
```

---

### Files Changed in S79

1. **backend/app/main.py** (~30 net lines removed):
   - Removed address-point fallback bearing (~30 lines)
   - Added Realie cross-validation for Solar dimensions (~20 lines)
   - Simplified caching logic

2. **backend/static/js/steps.js** (~130 net lines changed):
   - Added polygon-edge rotation in parcel callback (~80 lines)
   - Replaced Overpass road-bearing rotation block (~155 lines removed) with Overpass validation/override (~160 lines)
   - Simplified house positioning with improved clamping
   - Added `_siteplanLoading` and `_siteplanConfidence` data flow
   - Fixed secondary structure point-in-polygon check (unrotated vs rotated coords)
   - Passes `realie_sqft` and `stories` to building-footprint endpoint

3. **backend/static/js/sitePlanView.js** (~70 lines added):
   - Loading overlay with spinner animation
   - Confidence banner (green/yellow/orange)
   - "SITE PLAN PREVIEW" header moved into component
   - SVG wrapped in div for overlay positioning

---

### Critical Rules (carried forward + new)

**Carried forward:**
- Use CCRR-0313 tables as single source of truth for steel span data
- Match Welborn's labeling convention exactly for PDF output
- Steel posts must NOT be buried -- mount on pier brackets
- Joist blocking required when span > 8' (96") for steel
- 75 PSF load case is default for snow regions
- framingType must not invalidate deck shape/dimensions
- Never use emdashes in prose output
- Steel uses Fortress brackets, not Simpson hardware (exception: DTT2Z, LSC/LSSU)
- Stairs use wood materials
- Anti-anchoring rule: when Will pushes back twice, stop and list all assumptions
- Never confirm visual fixes from text extraction alone
- Solar API is the sole building data source. Overpass buildings are ignored.
- houseAngle is always 0. No building angle normalization, no width/depth swap.
- Don't cache fallback-only results (removed in S79 -- simplified caching)

**New from S79:**
- **Lot rotation is derived from polygon edge, not Overpass.** Overpass validates/overrides but is not required.
- **Overpass is enrichment-only.** If it fails, site plan is still functional (medium confidence).
- **Never push house to lot edge.** If it doesn't fit at centroid position, center it. Minimum 2ft from any edge.
- **Dimensions are sacred, position is flexible.** Never shrink house to fit lot.
- **Ray-cast street edge is unreliable.** 2/3 test addresses had wrong ray-cast results. Overpass correction is essential for accuracy.
- **Loading overlay must be fully opaque.** Don't show intermediate (potentially wrong) site plan state.
- **Every exit path in building footprint callback must set `_siteplanLoading = false` and `_siteplanConfidence`.** Missing either leaves the UI in a broken state.
- **Secondary structure point-in-polygon checks must use UNROTATED vertices** (`data.lot.vertices`), since Overpass centroid_ft is in unrotated coordinate space.

### Deferred Work

- Centroid Y offset investigation (house too close to street)
- Rotation context object refactor (closure fragility cleanup)
- Microsoft Building Footprints evaluation (actual polygons for irregular buildings)
- Test harness with 10-15 ground truth addresses
- S77 Test Plan Sections A-D, F (steel PDF, wood regression, toggle, AI helper, edge cases)
- User-selectable street edge (click to override)
- Neighborhood-level road cache (Overpass reliability)
- Pre-existing `app.js` line 73 inconsistency: setback check uses `houseOffsetSide` as absolute X

### Environment Variables

- `GOOGLE_SOLAR_API_KEY` = set in Railway (Solar API key from GCP Console)
- Solar API: `requiredQuality=MEDIUM`, 10K free calls/month for Building Insights
- `REALIE_API_KEY` = set in Railway

### Cache Buster
s79c
