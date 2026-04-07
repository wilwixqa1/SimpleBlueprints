# Session 78 Context File

## S78 Status: Google Solar API Integration + Architecture Overhaul

### Summary

S78 integrated Google Solar API as the primary building data source, removed Overpass building data (kept Overpass for road detection only), simplified lot rotation by removing building angle normalization and width/depth swap, and added an address-point fallback road bearing for when Overpass is down. Multiple iterations refined the architecture through testing with 3 addresses (4 Tulsa St, 368 Croaton St, 10 Chichester Rd).

**Key outcomes:**
- Solar API provides authoritative building center + bounding box tied to address via place_id
- Overpass is now ONLY used for road name/bearing (lot rotation) and secondary structures
- Lot rotation simplified from ~155 lines to ~70 lines (no angle normalization, no width/depth swap)
- House is always drawn as axis-aligned rectangle (houseAngle=0) after lot rotation
- Address-point fallback bearing added but found unreliable at short distances (min 30ft)

**Remaining issues for S79:**
- Solar bbox dimensions are inflated for rotated buildings (bbox inflation correction is approximate)
- After lot rotation, Solar's E-W/N-S bbox dimensions may not map correctly to side-to-side/front-to-back
- Address-point fallback bearing should probably be removed entirely (bad rotation worse than no rotation)
- Need to evaluate whether bbox inflation correction is even needed with current approach

---

### What Was Built (9 commits, 2 files changed)

**backend/app/main.py changes:**

1. **Google Solar API function** (`_google_solar_lookup`):
   - Calls `https://solar.googleapis.com/v1/buildingInsights:findClosest`
   - Takes lat/lng + optional lot_origin, returns building entry in same shape as Overpass
   - Returns: centroid_ft, width, depth, area_sqft, angle (always 0), dist_from_center
   - Converts center and boundingBox from WGS84 to lot coordinates (feet)
   - `GOOGLE_SOLAR_API_KEY` env var (set in Railway)
   - 10K free calls/month, `requiredQuality=MEDIUM`

2. **Bbox inflation correction**:
   - Solar's bbox is axis-aligned (N/S/E/W), so rotated buildings have inflated bounding boxes
   - Uses `solarPotential.wholeRoofStats.groundAreaMeters2` (actual roof footprint area)
   - When `roofArea / bboxArea < 0.80`, scales both dimensions by `sqrt(ratio)`
   - Limitation: uniform scaling assumes square-ish building, wrong for long narrow buildings
   - **S79 TODO**: evaluate whether this correction is even needed or causes more harm than good

3. **Solar-only building data** (replaces Overpass buildings):
   - `/api/building-footprint` endpoint: runs both Overpass and Solar
   - Solar building replaces ALL Overpass buildings >= 400sqft
   - Keeps Overpass secondary structures < 400sqft (sheds, garages)
   - Keeps Overpass road detection (nearest_road) unchanged
   - Result: `source: "google_solar"` on primary building entry

4. **Address-point fallback road bearing**:
   - When Overpass returns no roads (timeout/error), computes synthetic bearing
   - Bearing from building center toward Realie address geocode point (near mailbox/curb)
   - Same convention as Overpass: degrees from north, clockwise
   - Marked with `source: "address_point_fallback"` 
   - Results with fallback-only roads are NOT cached (allows Overpass retry)
   - **Minimum distance: 30ft** (short distances produce unreliable bearings)
   - **S79 TODO**: consider removing entirely -- bad rotation is worse than no rotation

**backend/static/js/steps.js changes:**

5. **Multi-Y edge scan** (`_tightEdges` helper):
   - Scans polygon left/right edges at 3 Y positions (top, mid, bottom of house)
   - Returns tightest (narrowest) span across house height
   - Fixes house overflowing lot boundary on tapered lots
   - Used by both centroid and address-point positioning paths

6. **Simplified lot rotation** (replaced old S72 block):
   - Old S72: ~155 lines with angle normalization, width/depth swap, multiple coordinate transforms
   - New S78: ~70 lines. Rotate lot vertices + centroid, set houseAngle=0, clamp, done
   - No building angle normalization (Solar gives angle=0, no angle to normalize)
   - No width/depth swap (no rotated building angle to trigger swap)
   - House always drawn as axis-aligned rectangle in rotated drawing space
   - `_rFn72` still used for site element positioning (identity when no rotation, real transform when rotation active)

---

### Architecture After S78

```
Data flow:
  Realie API ──> Lot polygon (vertices in lat/lng -> feet)
                 Address geocode point (lat/lng near mailbox)
                 Building sqft estimate (not used for dimensions)
                 
  Google Solar API ──> Building center (authoritative, tied to place_id)
                       Bounding box (axis-aligned, may be inflated)
                       Roof area (groundAreaMeters2, accurate)
                       
  Overpass API ──> Road name + bearing (for lot rotation)
                   Secondary structures (sheds/garages < 400sqft)
                   [Building data IGNORED since S78]

House positioning pipeline:
  1. Realie lot polygon -> lot vertices in feet coords
  2. Solar centroid -> validate inside lot polygon (point-in-polygon)
  3. If centroid valid:
     a. houseDistFromStreet = centroidY - houseDepth/2
     b. houseOffsetSide = centroidX - houseWidth/2 - leftEdgeAtY
     c. Clamp using _tightEdges (3-Y scan for tapered lots)
  4. If centroid invalid -> fall back to address point (same math)
  5. If no data -> center house (generic fallback)
  6. Overpass road bearing -> identify street edge -> compute drawRotation
  7. If drawRotation != 0:
     a. Rotate lot vertices around centroid
     b. Shift to origin (min corner = 0,0)
     c. Rotate Solar centroid through same transform
     d. Recompute houseOffsetSide and houseDistFromStreet from rotated centroid
     e. Clamp to fit using _tightEdges on rotated vertices
     f. houseAngle = 0 (always, no angle normalization)
     g. Set lotVertices LAST (prevents engine polygon regeneration)
  8. Site elements: position through _rFn72 (identity or rotation transform)
```

**Key coordinate systems:**

| System | Origin | Used by |
|--------|--------|---------|
| Geographic (WGS84) | lat/lng | Realie API, Google Solar API, Overpass API |
| Lot coords (unrotated) | min(lat), min(lng) of parcel polygon -> feet | `_coords_to_feet`, Solar centroid, building positioning |
| Drawing space (rotated) | Rotated lot with min corner at (0,0) | Everything the renderer sees: lotVertices, houseOffsetSide, houseDistFromStreet |

---

### Test Results

**4 Tulsa St, Dix Hills NY 11746:**
- Solar: 34.2x36.7 (corrected from 46.6x50.1, ratio=0.54)
- Overpass road: Tulsa Street, bearing=55.3deg
- Result: House fits inside lot, parallel to street, street at bottom
- Positioning: reasonable, slightly left of center vs Google Maps
- Status: **ACCEPTABLE** (user can drag to adjust)

**368 Croaton St, Ronkonkoma NY 11779:**
- Solar: 30.3x47.8 (corrected from 34.8x54.8, ratio=0.76)
- Overpass road: Croaton Street, bearing=355.0deg
- Result: House fits inside lot, correct proportions, street at bottom
- Status: **GOOD**

**10 Chichester Rd, Huntington Station NY 11746:**
- Solar: 42.9x31.5 (corrected from 57.2x42.0, ratio=0.56)
- Overpass road: Chichester Road, bearing=346deg (when Overpass works)
- Overpass timeout scenario: address fallback bearing=243.9deg (WRONG, only 13ft distance)
- Result when Overpass works: house too far left (offset=1), dimensions possibly inflated
- Result when Overpass fails: wildly wrong 64-degree rotation (fixed by 30ft min distance)
- Status: **NEEDS WORK** -- bbox inflation correction giving wrong dimensions, house pushed to edge

---

### Remaining Issues for S79

1. **Solar bbox dimension accuracy**: The bbox inflation correction (uniform sqrt scaling) is approximate. For rotated buildings, inflation is not uniform across both axes. 10 Chichester shows 42.9x31.5 when real house is probably ~35x25. Options:
   - Remove bbox inflation correction entirely and accept raw bbox dims
   - Map bbox width/depth to side-to-side/front-to-back based on lot rotation angle
   - Use Realie's building sqft estimate as a cross-check
   - Accept approximate dims since user can adjust manually

2. **Address-point fallback bearing**: Should probably be removed entirely. When Overpass is down, no rotation is better than wrong rotation. The lot displays in natural orientation with street labeled on correct edge. The 30ft minimum helps but doesn't fully solve the problem.

3. **Bbox width/depth mapping after rotation**: Solar's bbox gives E-W width and N-S depth. After lot rotation, these may not correspond to the house's visual width (side-to-side) and depth (front-to-back). For a street running E-W, Solar width = house width. For a street running N-S, Solar width = house depth. Need to swap based on rotation angle? Or just let the user adjust?

4. **S77 test plan still not run**: Sections A-D (steel PDF, wood regression, toggle, AI helper) and Section F (edge cases) remain untested from the S77 test plan.

5. **Overpass reliability**: Multiple Overpass timeouts during S78 testing (504 errors on overpass-api.de, timeouts on kumi). Consider adding a third Overpass mirror or increasing timeout.

---

### Evolution of Architecture Decisions in S78

This section documents why we arrived at the current architecture, since S78 involved multiple iterations.

**Iteration 1: Solar replaces Overpass primary building**
- Solar building fully replaced the closest Overpass building
- Problem: lost Overpass building angle, house drawn as diamond after rotation

**Iteration 2: Solar centroid + Overpass dimensions (hybrid merge)**
- Used Solar's authoritative centroid but Overpass polygon dimensions/angle
- Problem: Overpass matched wrong building (4 Tulsa had 43x31 from neighbor's polygon)

**Iteration 3: Cross-check Overpass dims against Solar roof area**
- Added area ratio and per-dimension ratio checks before trusting Overpass
- Problem: 4 Tulsa had similar area (1346 vs 1253 sqft) despite wrong shape, thresholds couldn't catch it

**Iteration 4: Solar-only building data (current)**
- Abandoned Overpass building data entirely
- Solar for building center + dimensions, Overpass for roads only
- Added bbox inflation correction using roof area
- Problem: bbox correction is approximate (uniform scaling)

**Iteration 5: Removed lot rotation entirely**
- Tried keeping lot in natural orientation, just labeling street on correct edge
- Problem: street edge is diagonal, house drawn axis-aligned = not parallel to street, house overflows boundary

**Iteration 6: Simplified lot rotation (current)**
- Brought back lot vertex rotation but with no angle normalization or width/depth swap
- houseAngle always 0, house always drawn as rectangle parallel to street
- Much simpler than old S72 block (~70 lines vs ~155 lines)
- Remaining issue: bbox dimensions may not map correctly to side-to-side vs front-to-back after rotation

**Key lesson**: We were optimizing for theoretical accuracy (Overpass polygon geometry) when we should have been optimizing for reliability (Solar always returns the right building). The simplified rotation with angle=0 eliminates the entire class of angle/swap bugs that plagued S71-S77.

---

### Files Changed in S78

1. **backend/app/main.py** (~80 net lines added):
   - `GOOGLE_SOLAR_API_KEY` env var
   - `_google_solar_lookup()` function (~90 lines including bbox inflation correction)
   - Modified `/api/building-footprint` endpoint: Solar replaces Overpass buildings, keeps roads
   - Address-point fallback road bearing (30ft minimum distance)
   - Smart caching: don't cache fallback-only results

2. **backend/static/js/steps.js** (~30 net lines removed):
   - Added `_tightEdges()` helper for multi-Y polygon edge scanning
   - Removed old S72 rotation block (~155 lines)
   - Added simplified rotation block (~70 lines)
   - `_lotRotation` re-enabled with simplified rotation
   - `houseAngle` always set to 0

---

### Bugs Found and Fixed

1. **House extending past lot boundary on tapered lots** (4 Tulsa St): Old code checked lot width at single Y position (house mid-height). On tapered lots, lot is wider at mid-Y but narrower at top/bottom. Fixed with `_tightEdges` 3-Y scan.

2. **Overpass building cache cross-contamination**: Carried forward from S77 -- cache key now includes `lot_origin`.

3. **Wrong building dimensions from Overpass** (4 Tulsa St): Overpass polygon had 43x31 for a house that's actually ~34x37. Overpass was matching the right building but had a bad polygon. Fixed by switching to Solar-only building data.

4. **Diamond-shaped house after rotation**: Old S72 block applied building angle + lot rotation, producing a composite angle that made the house appear rotated. Fixed by removing angle normalization entirely (houseAngle=0).

5. **Wildly wrong lot rotation from address fallback** (10 Chichester): Address point only 13ft from building center, producing a 243.9deg bearing (should be ~346deg). Fixed by increasing minimum distance to 30ft.

6. **Width/depth swap producing wrong dimensions**: Old S77 swap logic (`|angle| > 45`) was triggered by the composite building+lot angle, swapping dimensions incorrectly for some properties. Fixed by removing swap entirely (Solar gives axis-aligned bbox, no angle to trigger swap).

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

**New from S78:**
- **Solar API is the sole building data source.** Overpass buildings are ignored. Overpass is only for roads and secondary structures.
- **houseAngle is always 0.** No building angle normalization, no width/depth swap.
- **Lot rotation is vertex + centroid only.** No angle composition, no coordinate space bridging.
- **Address-point fallback bearing needs 30ft minimum distance.** Short distances produce unreliable bearings. Consider removing entirely in S79.
- **Don't cache fallback-only results.** Results with `source: "address_point_fallback"` roads should not be cached so Overpass can be retried.
- **Always look at the site plan critically.** Check: is the house inside the lot? Is it parallel to the street? Are dimensions realistic? Don't just check logs.
- **When Overpass times out, the site plan may be missing rotation.** This is acceptable -- better than wrong rotation.

### Deferred Work

- S77 Test Plan Sections A-D, F (steel PDF, wood regression, toggle, AI helper, edge cases)
- Remove address-point fallback bearing entirely
- Evaluate bbox inflation correction (may cause more harm than good)
- Solve bbox width/depth mapping after lot rotation
- Microsoft Building Footprints evaluation (free actual polygons, future alternative)
- Whole-image rotation approach (render correctly, then rotate entire output)
- Pre-existing `app.js` line 73 inconsistency: setback check uses `houseOffsetSide` as absolute X

### Environment Variables

- `GOOGLE_SOLAR_API_KEY` = set in Railway (Solar API key from GCP Console)
- Solar API: `requiredQuality=MEDIUM`, 10K free calls/month for Building Insights

### Cache Buster
s78a
