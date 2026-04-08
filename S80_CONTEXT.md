# Session 80 Context File

## S80 Status: Zone Optimization (Per-Zone Beam Type + Zone Panel + 3D Height)

### Summary

S80 was a multi-commit zone optimization session driven by direct contractor feedback (Billy) and architectural analysis. Three features shipped across 3 commits (S80, S80b, S80c) touching 8 files with ~200 net lines changed.

**Core insight from Billy:** Small zones (like a stair landing bump-out) should use flush beams (rim board as beam) instead of drop beams. Drop beams on small zones waste material and increase cost. Reference: Ilaria deck plans show this framing pattern.

**Commits:** S80, S80b, S80c

---

### What Was Built

#### 1. Per-Zone Beam Type (S80 -- Billy's feedback)

**Before:** `beamType` was a global parameter (dropped/flush) on the main deck. All zones inherited it. Every additive zone got a full drop beam with posts, piers, and footings regardless of size.

**After:** Each zone has its own `beamType: "flush" | "dropped"` property. Flush beam = rim board acts as beam, joists bear into joist hangers on the main deck rim. No posts, no piers, no separate beam needed.

**Smart defaults:** Zones under 80 sqft OR depth under 6ft default to `"flush"`. Larger zones default to `"dropped"`. User can always override.

**Files changed:**

1. **`zoneUtils.js`** -- Added `beamType` to zone schema, `addZoneDefaults()` computes smart default, `buildZoneCalcParams()` passes it through.

2. **`engine.js` / `calcAllZones()`** -- Flush beam path: skips posts, footings, beam materials. Still includes joists, rim joists, decking, joist hangers, and railing in material estimates. `zoneCalcs` entries now include `beamType` field.

3. **`steps.js`** -- Flush/Dropped toggle in zone properties panel (only for additive zones, not cutouts). Descriptive text explains each option.

4. **`draw_plan.py`** -- `compute_zone_framing()`: flush path returns joists spanning full zone to rim board, no beam line, no posts. `draw_zone_framing()`: conditionally renders beam line and posts/piers only for dropped beams. Zone label shows "FLUSH (RIM)" for flush zones.

5. **`permit_spec.py`** -- `zone_calcs` entries include `beam_type` and `beam_size: "rim"` for flush zones. Skips beam sizing entirely.

6. **`draw_notes.py`** -- General notes updated: "Zones may use dropped beams with posts and footings, or flush beams where joists bear into the main deck rim board with joist hangers."

#### 2. Zone Panel Improvements (S80b)

**Editable zone label:** Zone header now contains an inline text input instead of static text. Users can rename zones to meaningful names ("Stair Landing", "Hot Tub Area"). Labels flow through to PDF plan view labels and zone selector tabs.

**Zone height slider:** Height slider shown for additive zones (not zone 0, not cutouts). Uses existing `u()` routing which maps `height` to `zone.h` when `activeZone > 0`. Warning note when height differs from main deck: "Different from main deck. PDF elevation views will reflect this in a future update."

**Dimension context:** Zone header subtitle shows `Add zone (W' x D')` instead of generic "Add zone (extends deck)".

#### 3. Per-Zone Height in 3D Preview (S80c)

**Before:** All zones rendered at main deck height `H` in 3D. The `zH = H` line had a `TODO Phase 3` comment.

**After:** Each zone renders at its own height in 3D. Stepped decks are visually accurate.

**Implementation:**

- **Zone height resolution:** `var zH = isZ0 ? H : (ar.zone && ar.zone.h != null ? ar.zone.h : H);`
- **Height lookup function:** `getHeightAtPoint(wx, wz)` maps world coordinates to zone height by checking which zone rect contains the point. Used by deck boards and railing.
- **Zone structure:** Posts, beam, joists, rim joists all use `zH` (already did, just needed the assignment fix).
- **Deck boards:** `addDeckBoard()` uses `getHeightAtPoint()` to place boards at correct zone height.
- **Railing:** `addRail()` and `addRailPost()` compute `localH` via `getHeightAtPoint()` at the rail midpoint/post position. Top rail, bottom rail, balusters, and posts all at correct height.
- **Flush beam 3D:** Zones with `beamType === "flush"` skip posts, piers, and beam rendering. Joists span full zone depth.

**`_zoneHeightRects` array:** Built once from `addRects`, stores `{ xMin, xMax, zMin, zMax, h }` for each zone in world coords. Iterated in reverse so child zones (later in array) take priority over parents.

---

### Data Model After S80

#### Zone Schema (zoneUtils.js)
```javascript
{
  id:           Number,       // Unique, never reused (0 = main deck, virtual)
  type:         String,       // 'add' | 'cutout'
  w:            Number,       // Width (ft) along attachment edge
  d:            Number,       // Depth (ft) perpendicular to attachment edge
  h:            Number|null,  // Height override (null = inherit main deck height)
  attachTo:     Number,       // Parent zone ID
  attachEdge:   String,       // 'front'|'left'|'right' for add
  attachOffset: Number,       // Offset along edge (ft)
  interiorY:    Number,       // Y offset for interior cutouts only
  corners:      Object,       // Corner chamfer modifiers
  joistDir:     String,       // 'perpendicular'|'parallel'
  beamType:     String,       // 'dropped'|'flush' (NEW S80)
  stairs:       Object|null,
  label:        String        // User-editable name (NEW S80b)
}
```

#### Zone Calc Entry (engine.js zoneCalcs / permit_spec.py zone_calcs)
```javascript
{
  joistSize: "2x8",
  beamSize: "2-ply 2x8" | "rim",   // "rim" for flush
  beamSpan: 4.5 | 0,               // 0 for flush
  jSpan: 5.5,
  fDiam: 18 | 0,                   // 0 for flush
  nPosts: 2 | 0,                   // 0 for flush
  beamType: "dropped" | "flush"    // NEW S80
}
```

---

### Zone Properties Panel (UI)

When a zone is selected (`activeZone > 0`, type === "add"):

| Control | Field | Notes |
|---------|-------|-------|
| Label (text input) | `zone.label` | Inline in header, flows to PDF |
| Width slider | `zone.w` via `u("width")` routing | 4-50 ft |
| Depth slider | `zone.d` via `u("depth")` routing | 4-24 ft |
| Height slider | `zone.h` via `u("height")` routing | 1-14 ft, warning if differs from main |
| Offset slider | `zone.attachOffset` | Position along parent edge |
| Beam type toggle | `zone.beamType` | Flush/Dropped, smart default |
| Corner chamfers | `zone.corners` | Per-corner toggle + size |

Zone 0 (main deck) shows: Width, Depth, Height, Chamfers. No beam type toggle (uses global `p.beamType`).

---

### Billy's Feedback Items -- Status

| Item | Status | Notes |
|------|--------|-------|
| Per-zone beam type (flush vs dropped) | **DONE** | Full pipeline: UI, engine, PDF, 3D |
| Stair direction arrow backwards | **DEFERRED** | Need Billy's project config data to trace the exact bug. Two potential issues: (1) arrow convention (DOWN vs UP label), (2) direction mismatch between 2D and 3D for rotated stairs. Asked Billy for clarification. |

#### Stair Arrow Bug Analysis (for next session)

Billy reported the stair arrow on the framing plan points in the wrong direction. Investigation found:

- The arrow code uses `downDir` from stair geometry (e.g., `"+y"` for straight stairs)
- Arrow endpoints are transformed via `_tp()` which applies stair rotation angle
- For standard front stairs at angle=0, the direction appears correct
- Billy likely used manual anchor/angle positioning (drag/rotate) to get stairs perpendicular to a zone edge, which our UI doesn't natively support well
- The 3D view may show stairs going one direction while the 2D plan shows them going another
- **Root cause possibilities:** (a) the stored `angle` value creates a different rotation in 2D vs 3D coordinate systems, (b) the `downDir` doesn't account for stair rotation, (c) purely a label convention issue (DOWN vs UP)
- **Action needed:** Get Billy's project save data or stair configuration to trace the exact transform pipeline

---

### Known Issues

#### 1. Stair Arrow Direction (from Billy)
See above. Deferred pending Billy's config data.

#### 2. Zone Height in PDF Elevations (deferred to S82)
The height slider is functional and 3D renders correctly, but PDF elevation drawings still use main deck height for all zones. The elevation code in `draw_elevations.py` needs to:
- Draw zone beams/posts at the zone's height
- Show height dimensions per zone
- Handle railing at height transitions (zone at different height from main deck needs railing on shared edge)

#### 3. Zone Joist Direction Not Wired (schema exists)
`joistDir` exists in the zone schema but `compute_zone_framing()` determines joist direction from `attachEdge`, not from `zone.joistDir`. Low priority.

#### 4. Per-Zone Railing Control (S83)
Currently all exposed edges get railing. No way to toggle railing off for specific edges (e.g., ground-level zone that doesn't need railing).

#### 5. Flush Beam Joist Span Validation
Flush beam zones have joists spanning the full zone depth (no beam setback). For deep zones, this could exceed IRC prescriptive joist span limits. Currently no warning is shown. Should validate joist span against IRC tables and warn if exceeded.

---

### Architecture Notes

#### Per-Zone Height Flow
```
User adjusts height slider
  -> u("height", val)
  -> zone-aware updater routes to zone.h (app.js line 546-552)
  -> p.zones array updated (new objects via Object.assign)
  -> 3D re-renders (p.zones in useEffect deps)
     -> addRects.forEach reads ar.zone.h
     -> zH = zone height for structure (posts, beam, joists, rims)
     -> getHeightAtPoint() for deck boards and railing
  -> PDF generation reads zone.h (not yet wired for elevations)
```

#### Per-Zone Beam Type Flow
```
User clicks Flush/Dropped toggle
  -> updateZone(activeZone, "beamType", "flush"|"dropped")
  -> zones array updated

Frontend:
  -> calcAllZones() checks z.beamType
     -> flush: skip posts/footings, use rim board, continue
     -> dropped: full beam/post/footing calculation

3D:
  -> isFlushZone = ar.zone.beamType === "flush"
  -> skip posts/beam mesh creation for flush
  -> joists span full depth

PDF:
  -> compute_zone_framing() reads zone.beamType
     -> flush: joists to rim, no beam/posts returned
  -> draw_zone_framing() conditionally renders beam/posts
  -> permit_spec zone_calcs: beam_size="rim", nPosts=0 for flush
```

#### getHeightAtPoint (deck3d.js)
```javascript
// Built once from addRects
var _zoneHeightRects = [];
addRects.forEach(function(ar) {
  var zr = ar.rect;
  var zh = ar.id === 0 ? H : (ar.zone && ar.zone.h != null ? ar.zone.h : H);
  _zoneHeightRects.push({
    xMin: cx + zr.x, xMax: cx + zr.x + zr.w,
    zMin: cz + zr.y, zMax: cz + zr.y + zr.d,
    h: zh
  });
});
// Iterate reverse so child zones (later) take priority
function getHeightAtPoint(wx, wz) {
  for (var i = _zoneHeightRects.length - 1; i >= 0; i--) {
    var r = _zoneHeightRects[i];
    if (wx >= r.xMin - 0.01 && wx <= r.xMax + 0.01 &&
        wz >= r.zMin - 0.01 && wz <= r.zMax + 0.01) return r.h;
  }
  return H;
}
```

---

### Files Changed in S80

1. **`backend/static/js/zoneUtils.js`** (~10 lines): beamType in schema, defaults, buildZoneCalcParams
2. **`backend/static/js/engine.js`** (~40 lines): flush beam path in calcAllZones, railing for flush
3. **`backend/static/js/steps.js`** (~35 lines): beam type toggle, editable label, height slider
4. **`backend/static/js/deck3d.js`** (~60 lines): per-zone height, flush beam 3D, getHeightAtPoint, per-zone railing
5. **`backend/drawing/draw_plan.py`** (~30 lines): flush beam framing, conditional beam/post render
6. **`backend/drawing/permit_spec.py`** (~15 lines): flush zone_calcs entries
7. **`backend/drawing/draw_notes.py`** (~5 lines): updated zone framing note

---

### Critical Rules (carried forward + new)

**Carried forward from S79:**
- Lot rotation is derived from polygon edge, not Overpass
- Overpass is enrichment-only
- Never push house to lot edge; center if uncertain
- Dimensions are sacred, position is flexible
- Loading overlay must be fully opaque
- Every exit path in building footprint callback must set loading/confidence
- Secondary structure point-in-polygon checks must use UNROTATED vertices
- Use CCRR-0313 tables as single source of truth for steel span data
- Match Welborn's labeling convention exactly for PDF output
- Steel posts must NOT be buried
- Anti-anchoring rule: when Will pushes back twice, stop and list all assumptions
- Never confirm visual fixes from text extraction alone
- Solar API is the sole building data source
- houseAngle is always 0

**New from S80:**
- **Per-zone beamType is independent.** Each zone stores its own beamType. Global p.beamType is for zone 0 only.
- **Flush beam = rim board as beam.** No posts, no piers, no separate beam line. Joists bear into main deck rim via joist hangers.
- **Smart defaults:** Zones < 80 sqft or depth < 6ft default to flush. Larger zones default to dropped.
- **Zone labels are user-editable.** Flow through to PDF plan view, zone selector tabs, and material estimates.
- **Zone height is stored in zone.h.** null = inherit main deck. 3D renders per-zone height. PDF elevations NOT yet wired.
- **getHeightAtPoint() is the single source of truth** for mapping world coords to deck surface height in 3D. Used by deck boards and railing.
- **Flush zones in 3D skip posts/beam meshes.** Joists span full zone depth with no beam setback.

### Deferred Work

- **S82:** PDF elevation views with per-zone height (beams, posts, dimensions at zone height)
- **S82:** Railing at height transitions (shared edge between zones at different heights)
- **S82:** Stair height recalculation for stairs on zones with different height
- **S83:** Per-edge railing control (toggle railing per exposed edge)
- **S83:** Back-edge zones, zone-to-zone attachment
- Stair arrow direction bug (pending Billy's config data)
- Flush beam joist span validation against IRC tables
- Zone joist direction wiring (joistDir schema exists but not used)
- S77 Test Plan Sections A-D, F
- Centroid Y offset investigation (house too close to street in site plan)
- Rotation context object refactor (closure fragility cleanup)

### Environment Variables

- `GOOGLE_SOLAR_API_KEY` = set in Railway
- Solar API: `requiredQuality=MEDIUM`, 10K free calls/month
- `REALIE_API_KEY` = set in Railway

### Cache Buster
s80c
