# Session 77 Context File

## S77 Status: Site Plan House Positioning Overhaul + Google Solar API Research

### Summary

S77 was planned as a comprehensive testing session (S77_TEST_PLAN.md), but testing the Site Plan (Section E) immediately revealed critical house positioning bugs. The entire session was spent fixing house placement after address lookup on irregular/rotated lots. Nine commits, 2 files changed, ~170 net lines added. The S77 test plan Sections A-D (steel PDF tests) and Section F (edge cases) remain untested.

Key outcome: house positioning is significantly improved but still imperfect for edge cases. Research identified Google Solar API as the best path to reliable building data. Next session should start by enabling the Solar API and wiring it up as the primary building data source.

---

### What Was Built (9 commits, 2 files changed, ~170 lines)

**All changes in `backend/static/js/steps.js` and `backend/app/main.py`**

1. **House position clamping** (commit 4ae2efd):
   - Added right-edge polygon scan at house mid-Y in both non-rotated and rotated paths
   - Clamp `houseOffsetSide` so house right edge stays inside lot boundary (2' margin)
   - Y-axis clamp in rotated path to prevent house extending past lot top

2. **Site element rotation fix** (commit f9fb1f9):
   - Auto-added garages/sheds from Overpass were positioned in unrotated lot coords while lot/house were in rotated drawing space
   - Hoisted `_rFn72` as identity function before rotation block; overridden with real transform inside block
   - Site element centers now rotated through same `_rFn72` transform as house
   - Fixed `houseCY2` to use `pLotY` (Overpass coords) instead of stale React state

3. **Overpass centroid for house positioning** (commit 5e646f9):
   - Replaced Realie address geocode point with Overpass building centroid as primary house position source
   - Address point was near mailbox/curb, not house center -- caused misplacement on diagonal-street lots
   - Added `_pointInPoly` ray-casting function for lot boundary validation
   - Centroid validated with point-in-polygon before use; falls back to address point, then centered fallback
   - Secondary structures also filtered with point-in-polygon (rejects neighbor buildings outside lot)

4. **Centroid rotation fix** (commit d8b3e6a):
   - When `usedCentroid` is true, rotate centroid coordinates directly through `_rFn72`
   - Previously reconstructed house corner from offset/dist via `leftEdgeAtY` (lossy round-trip)
   - Address-point fallback still uses the old reconstruction path

5. **Center house fallback** (commit 0b4c590, then replaced by c954431):
   - Initially: center house when rotated centroid position was unreliable
   - Problem: centering was wrong for 10 Chichester where house IS near one edge
   - Replaced with shift-to-fit: just clamp to 2' margin, preserving relative position from centroid

6. **Width/depth swap for rotated buildings** (commit edc0821):
   - Root cause of deck-on-wrong-side bug (368 Croaton St)
   - Overpass returns width as longest-edge dimension regardless of street orientation
   - When building angle > 45 degrees in drawing space, longest edge is vertical (front-to-back)
   - Swap `hw2`/`hd2` and adjust angle by +/-90 degrees so width=side-to-side, depth=front-to-back
   - Fixes deck placement (`dy = hy + hd`), house shape, and all downstream dimension consumers

7. **Building footprint cache fix** (commits 19bcd44 + 680a56f):
   - Cache key was lat/lng only (4 decimal places) -- nearby properties shared cached results
   - 4 Tulsa St was getting 10 Chichester's building data (same neighborhood)
   - Fixed: include `lot_origin` in cache key
   - Bug fix: `lot_origin` was referenced before definition (caused 500 error on ALL building footprint requests)
   - Moved `lot_origin` computation above cache check

---

### Test Results

**Addresses tested:**

| Address | Result | Notes |
|---------|--------|-------|
| 4 Tulsa St, Dix Hills NY | Partially working | House positioning still slightly off (too close to one edge). Overpass may be matching neighbor's building. Need Google Solar API for reliable data. |
| 10 Chichester Rd, Huntington Station NY | Good | House near SE edge matching Google Maps. No swap triggered (angle=1.5). |
| 368 Croaton St, Ronkonkoma NY | Good | Width/depth swap fixed deck placement. House shape matches Google Maps. |

**S77 Test Plan status:**
- Section A (Steel PDF): NOT TESTED
- Section B (Wood regression): NOT TESTED
- Section C (Toggle stress): NOT TESTED
- Section D (AI helper): NOT TESTED
- Section E (Site plan): PARTIALLY TESTED (E-1 address lookup extensively tested, E-2 through E-6 need visual verification)
- Section F (Edge cases): NOT TESTED

---

### Architecture Insights

**How house positioning works after S77:**

```
Realie API returns:
  - Lot polygon (vertices in lat/lng -> converted to feet)
  - Address geocode point (lat/lng near mailbox)
  - Building sqft (estimate only, no footprint polygon)

Overpass API returns (async, after Realie):
  - Building footprint polygons (from OSM volunteer data)
  - Building centroid, width, depth, angle (computed from polygon)
  - Nearest road name and bearing (for street edge detection)

House positioning pipeline:
  1. Realie lot polygon -> lot vertices in feet coords
  2. Overpass centroid -> validate inside lot polygon (point-in-polygon)
  3. If centroid valid:
     a. houseDistFromStreet = centroidY - houseDepth/2
     b. houseOffsetSide = centroidX - houseWidth/2 - leftEdgeAtY
     c. Clamp to fit inside lot (right edge scan)
  4. If centroid invalid -> fall back to address point (same math)
  5. If no address point -> center house (generic fallback)
  6. Road bearing -> identify street edge -> compute lot rotation
  7. S72 rotation block:
     a. Rotate lot vertices around centroid by lotRotation degrees
     b. Shift to origin (min corner = 0,0)
     c. If usedCentroid: rotate centroid directly through _rFn72
     d. If address point: reconstruct house corner, then rotate
     e. If |drawingAngle| > 45: swap width/depth, adjust angle +/-90
     f. Compute drawOffset from rotated left edge
     g. Clamp/shift-to-fit if house overflows
     h. Set lotVertices LAST (prevents engine polygon regeneration)
  8. Site elements: rotate through same _rFn72, filter by point-in-polygon
```

**Key coordinate systems:**

| System | Origin | Used by |
|--------|--------|---------|
| Geographic (WGS84) | lat/lng | Realie API, Overpass API, Google Solar API |
| Lot coords (unrotated) | min(lat), min(lng) of parcel polygon -> feet | `_coords_to_feet`, Overpass `lot_origin`, building centroids |
| Drawing space (rotated) | Rotated lot with min corner at (0,0) | Everything the renderer sees: lotVertices, houseOffsetSide, houseDistFromStreet, siteElements |

**The fundamental data quality problem:**

Overpass (OSM) building data is volunteer-mapped and varies in quality:
- Building polygons can be offset from actual position
- Nearest building by distance may be a neighbor, not the target property
- No authoritative link between address and building (we infer by proximity)
- Public Overpass servers have intermittent downtime (500 errors, rate limiting)

This is why we're moving to Google Solar API, which uses Google's own aerial imagery and has an authoritative address-to-building association.

---

### Next Session (S78) Priority: Google Solar API Integration

**What we need:**
1. Enable Solar API in Google Cloud Console (same project as OAuth)
2. Create API key
3. Add `GOOGLE_SOLAR_API_KEY` env var to Railway
4. Build `/api/building-footprint-google` endpoint (or replace Overpass)
5. Parse `buildingInsights.findClosest` response for `center`, `boundingBox`

**Google Solar API response gives us:**
```json
{
  "center": { "latitude": 37.4449, "longitude": -122.1391 },
  "boundingBox": {
    "sw": { "latitude": 37.4445, "longitude": -122.1395 },
    "ne": { "latitude": 37.4453, "longitude": -122.1388 }
  },
  "imageryQuality": "HIGH",
  "solarPotential": { "wholeRoofStats": { "groundAreaMeters2": 2370.51 } }
}
```

From `boundingBox` we get precise width/depth. From `center` we get building centroid. Both in WGS84, same as Realie parcel data. No coordinate bridging needed.

**Pricing:** 10,000 free calls/month for Building Insights. At our volume, effectively free.

**Integration strategy:**
- Option A: Replace Overpass entirely with Google Solar API
- Option B: Try Google Solar first, fall back to Overpass if NOT_FOUND
- Recommendation: Option A for simplicity. Overpass still useful for secondary structures (sheds/garages) if needed, but Google building center + bounding box is sufficient for house positioning.

**What Google Solar does NOT give us:**
- Secondary structure detection (sheds, garages) -- Overpass is still better for this
- Road name/bearing for street edge detection -- Overpass still needed for this
- Building polygon vertices (only bounding box) -- but bbox is sufficient for house rectangle

**Recommended approach:** Use Google Solar for primary house (center + bbox), keep Overpass for road detection and secondary structures. This gives us the best of both.

---

### Bugs Found and Fixed

1. **House extending past lot boundary** (4 Tulsa St): Address geocode point at X=54.3 on a 55' lot produced offset pushing house outside polygon. Fixed with right-edge scan + clamp.

2. **Site elements in wrong coordinate space**: Garages/sheds from Overpass positioned in unrotated coords while lot was rotated. Fixed by applying `_rFn72` rotation.

3. **Stale React state in site element positioning**: `parseInt(p.houseDistFromStreet)` read batched React state that hadn't updated yet. Fixed by using `pLotY` from same Overpass dataset.

4. **Deck on wrong side of house** (368 Croaton St): Building with 58x30 dimensions and 94-degree angle was drawn as wide rectangle rotated 90 degrees, but deck used `hd=30` instead of visual depth of 58. Fixed with width/depth swap when |angle| > 45.

5. **Building footprint cache cross-contamination**: 4 Tulsa got 10 Chichester's building data because cache key was lat/lng only (4 decimal places). Fixed by including `lot_origin` in cache key.

6. **NameError crashing all building lookups**: `lot_origin` referenced before definition in cache key computation. Fixed by moving `lot_origin` computation above cache check.

---

### Lessons Learned

1. **Never replicate a transform by computation -- use the same function.** The `_rFn72` hoisting pattern (identity by default, overridden in rotation block) is the right way to share transforms across code paths. Every time we tried to compute a parallel transform, we introduced bugs (S71, S72, S73, and again in S77).

2. **Width/depth are relative to the building, not the street.** After lot rotation, a building's "width" (longest edge) may run vertically in drawing space. Always check the drawing-space angle and swap if > 45 degrees.

3. **Address geocode points are for mail, not positioning.** The Realie lat/lng is near the mailbox/curb/street, not the building center. Never use it as a proxy for house position.

4. **Point-in-polygon is the only reliable neighbor filter.** Distance-based filters (60ft radius) fail on narrow lots where neighbors are close. Checking if the building centroid falls inside the lot polygon is definitive.

5. **In-memory caches need full context in the key.** The building footprint cache keyed on lat/lng only, ignoring `lot_origin`. Different properties with the same lat/lng (rounded to 4 decimals) got each other's results. Always include every parameter that affects the output.

6. **Test variable ordering after refactoring.** The `lot_origin` NameError was caused by moving the cache check above the variable definition. Classic use-before-define bug. Always trace the execution order after reorganizing code.

7. **The centroid-in-lot-polygon test is necessary but not sufficient.** A building centroid can be inside the lot polygon but still be a neighbor's building (OSM polygon overlap, lot boundary imprecision). Google Solar API solves this by having authoritative address-to-building association.

---

### Files Changed in S77

1. **backend/static/js/steps.js** (~155 lines net added):
   - `_pointInPoly` ray-casting utility function
   - Overpass centroid positioning (primary) with address point fallback
   - Centroid direct rotation through `_rFn72`
   - Width/depth swap for |angle| > 45 degrees
   - Right-edge polygon scan + clamp in both rotation paths
   - Site element rotation through `_rFn72`
   - Point-in-polygon filter for secondary structures

2. **backend/app/main.py** (~14 lines net changed):
   - Building footprint cache key includes `lot_origin`
   - `lot_origin` computed before cache check (fix NameError)

### Deferred Work

- S77 Test Plan Sections A-D, F (steel PDF, wood regression, toggle, AI helper, edge cases)
- Google Solar API integration (blocked on GCP console access for 6 hours)
- Microsoft Building Footprints evaluation (free alternative, harder to integrate)
- Remaining site plan visual tests (E-2 through E-6)
- Pre-existing `app.js` line 73 inconsistency: setback check uses `houseOffsetSide` as absolute X, not offset from left polygon edge

### Critical Rules (carried forward)

- **Use CCRR-0313 tables as the single source of truth for all steel span data.**
- **Match Welborn's labeling convention exactly for PDF output.**
- **Steel posts must NOT be buried.** Mount on pier brackets.
- **Joist blocking required when span > 8' (96").** CCRR threshold, different from wood's 7'.
- **75 PSF load case is the default for snow regions.**
- **framingType must not invalidate deck shape/dimensions.**
- **Never use emdashes in prose output.**
- **Steel uses Fortress brackets, not Simpson hardware.** Exception: lateral load connectors (DTT2Z) and stair connectors (LSC/LSSU) are still Simpson.
- **Stairs use wood materials.** Fortress steel stair system is separate CCRR evaluation.
- **Anti-anchoring rule:** When Will pushes back twice, stop and list all assumptions.
- **Never confirm visual fixes from text extraction alone.**
- **Never replicate a transform by computation -- use the same _rFn72 function.**
- **Width/depth are relative to the building, not the street.** Swap when |drawingAngle| > 45.
- **Address geocode points are for street edge detection, not house positioning.**

### Cache Buster
s77a
