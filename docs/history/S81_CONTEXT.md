# Session 81 Context File

## S81 Status: Multi-Level Zone Foundation (Flush Validation + Edge Detection + IRC Warnings)

### Summary

S81 was a planning-heavy session that established the foundation for handling height transitions between zones. Three commits shipped (S81a, S81b, S81c-fix) and one was reverted (S81c). The original bug from Billy-style feedback ("zones float in the air at mismatched heights") is fixed. The architectural helpers needed for the rest of S81 (transitional stairs, auto-guards, permit flags) are in place but not yet wired to UI or 3D rendering.

**Core insight from S81 reverted commit:** Safety features that block access force the user to manually break them, which is worse than no safeguard at all. **Traversal must come before guards** when modeling multi-level decks. Auto-adding railing on a shared edge between two zones at different heights creates a code-compliant but inaccessible elevated zone. The right order: ship transitional stairs first, then ship auto-guards that clip around the stair footprint.

**Commits on main:** S81a (`f095f4a`), S81b (`9a6355e`), revert of S81c (`bf4f2c8`), S81c-fix (`c029972`).
**Reverted:** S81c (`f057d1d`) — see "Reverted Work" below.

---

### What Was Built

#### 1. Per-Zone Beam Type Validation (S81a)

**The bug:** S80 added per-zone height (`zone.h`) and per-zone beam type (`zone.beamType: "flush" | "dropped"`) but didn't validate the combination. A flush beam zone has its joists bear into the main deck rim board via joist hangers — that only works when the zone shares the main deck's elevation. When `zone.h` was set to a different value, the rim board was at the wrong height, the zone had no posts (flush skips them), and the structure floated in 3D with broken material takeoff.

**The fix:** Force beam type to `"dropped"` whenever `zone.h !== main deck H`. New helper `getEffectiveBeamType(zone, p)` is the single source of truth.

**Files changed:**

1. **`zoneUtils.js`** — New `getEffectiveBeamType()` helper exported on window. `buildZoneCalcParams()` now reads through it so the engine path is always validated.

2. **`engine.js`** — `calcAllZones()` reads `zoneBeamType` via `getEffectiveBeamType(z, p)` instead of `z.beamType || "dropped"`. Material takeoff now correctly generates posts, footings, and beam for the auto-converted zones.

3. **`deck3d.js`** — `isFlushZone` reads through `getEffectiveBeamType()` so 3D structure renders posts and beam.

4. **`steps.js`** — Beam type toggle in zone properties panel. When height mismatch is detected, the "Flush" button is disabled (greyed out, `cursor: not-allowed`) with explanation: *"Flush beam unavailable: zone is at a different height than the main deck, so the rim board cannot carry its joists. Dropped beam with posts to grade is required."*

#### 2. Shared Edge Detection + IRC Traversal Warnings (S81b)

**Detection-only commit. No 3D or PDF changes.** Establishes the architectural helpers and surfaces height transition information in the zone properties panel as a yellow warning badge.

**New helpers in `zoneUtils.js`:**

- **`getSharedEdges(p)`** — Returns every shared boundary segment between pairs of additive rects (including main deck = id 0). Each segment has:
  ```
  { aId, bId, aH, bH, deltaIn, axis, x1, y1, x2, y2, length }
  ```
  - `aH` / `bH`: heights in feet (resolved from `zone.h` or main deck H)
  - `deltaIn`: `|aH - bH| * 12`, rounded to 2 decimals
  - `axis`: `'vertical'` (constant x) or `'horizontal'` (constant y)
  - Coordinates are deck-local (same space as `getZoneRect`)
  - Pure function over zone geometry, no side effects

- **`classifyHeightDelta(deltaIn)`** — IRC-derived classification:
  | Range | Classification | IRC reference |
  |---|---|---|
  | `< 0.5"` | `flush` | (effectively same level) |
  | `0.5"–4"` | `tripping` | R311.7.5.1 violation (sub-min riser) |
  | `4"–7.75"` | `single-step` | One riser, no handrail required |
  | `7.75"–30"` | `multi-step` | Multi-riser, no guard required |
  | `30"–147"` | `guarded` | R312.1.1 guard required + multi-riser |
  | `≥ 147"` | `over-max` | R311.7.3 intermediate landing required (not supported) |

- **`suggestRiserPlan(deltaIn)`** — Returns:
  ```
  { nRisers, riserHeightIn, needsGuard, needsHandrail, needsLanding,
    classification, irc }
  ```
  Riser height is uniform across the flight per R311.7.5.1. `needsHandrail` triggers at 4+ risers per R311.7.8.

**`steps.js` UI:** Yellow warning panel above the beam type toggle. Renders when the active zone has any shared edge with `deltaIn >= 0.5`. Each edge gets a line showing neighbor name (Main Deck or Zone N), delta in feet+inches+reduced eighths (e.g., `2" 3/8`), edge length, IRC classification, and required mitigation. Tripping (sub-4") and over-max (>147") are flagged in red. Guarded (>30") shows the riser plan plus the R312.1.1 guard requirement plus R311.7.8 handrail requirement when applicable.

**Known UI gap:** The warning panel only appears when an additive zone is selected. Clicking the "Main Deck" tab does not show the matching warning from the main deck side. To fix in S81d/e when wiring the auto-guard.

#### 3. Fraction Formatting Cleanup (S81c-fix)

Cosmetic: replaced raw sixteenths (`2" 6/16`) with reduced eighths (`2" 3/8`) in the height-transition warning. One block of code in `steps.js` around line 2506.

---

### Reverted Work: S81c Auto-Guard

**What it did:** After the existing exposed-edge rail loop in `deck3d.js`, walked `getSharedEdges(p)` and rendered an automatic railing on the higher zone's side of any shared edge with `deltaIn >= 30` (R312.1.1 trigger). The rail centerline was inset 0.05 ft toward the higher rect interior so `getHeightAtPoint` would resolve to the higher zone's elevation. End posts at both endpoints. Stair-footprint clipping was honored on both axes for future compatibility with S81d transitional stairs.

**Why it was reverted:** The code was technically correct and IRC-compliant, but it created a worse problem than it solved. With no transitional stair existing yet, the auto-guard sealed off the elevated zone completely — no door, no opening, no way in. A code-compliant inaccessible deck is worse than the original safety gap because the user is now forced to manually delete a railing they can't easily distinguish from intentional perimeter rail.

**The lesson, written down:** Safety features that block access force the user to break them, and a "manually broken" safeguard is worse than no safeguard. The right order of operations on multi-level decks is:
1. First add a way to **traverse** between levels (transitional stairs)
2. *Then* add **guards** on the remaining unguarded edges (auto-guard with stair gap clipping)

The S81c code is preserved in the git history at `f057d1d` and should be brought back in S81c-v2 after S81d/e ship transitional stairs.

---

### Data Model After S81

#### Zone Schema (unchanged from S80)

```javascript
{
  id:           Number,       // Unique, never reused (0 = main deck, virtual)
  type:         String,       // 'add' | 'cutout'
  w:            Number,       // Width (ft)
  d:            Number,       // Depth (ft)
  h:            Number|null,  // Height override (null = inherit main deck)
  attachTo:     Number,
  attachEdge:   String,
  attachOffset: Number,
  interiorY:    Number,
  corners:      Object,
  joistDir:     String,
  beamType:     String,       // 'dropped'|'flush' (validated via getEffectiveBeamType)
  stairs:       Object|null,
  label:        String
}
```

S81 did **not** modify the schema. The transitional stair schema extension (`zone.stairs.landingType` and `landingZoneId`) is deferred to S81d.

#### Shared Edge Object (S81 new, derived not stored)

```javascript
{
  aId, bId,           // Zone IDs (0 = main deck)
  aH, bH,             // Heights in feet
  deltaIn,            // |aH - bH| * 12, rounded to 0.01"
  axis,               // 'vertical' | 'horizontal'
  x1, y1, x2, y2,     // Deck-local coordinates of segment endpoints
  length              // Segment length in feet
}
```

---

### Architecture Notes

#### IRC Threshold Single Source of Truth

All riser/guard thresholds live in exactly one place: `classifyHeightDelta()` and `suggestRiserPlan()` in `zoneUtils.js`. Future stair, guard, and permit checker code must funnel through these helpers — never hardcode 4", 7.75", 30", or 147" anywhere else. The IRC references that justify each number are in the JSDoc comments.

#### Composite Outline vs Internal Edges

The existing `getExposedEdges()` returns the **outer perimeter** of the union of all additive zones. A shared edge between two zones at different heights is **internal** to this composite outline, so it does NOT appear in `exposedEdges` and the existing rail loop never sees it. This is correct for normal coplanar zones (no need for an interior rail) but creates the height-transition gap that `getSharedEdges()` was built to detect.

When S81c-v2 brings back the auto-guard, the data flow will be:
```
getSharedEdges(p)
  -> filter to deltaIn >= 30
  -> filter out segments overlapping any transitional stair gap (S81d)
  -> render rail at higher zone's elevation, inset toward higher rect interior
```

---

### Files Changed in S81

| File | S81a | S81b | S81c (reverted) | S81c-fix |
|---|---|---|---|---|
| `backend/static/js/zoneUtils.js` | +22 | +110 | — | — |
| `backend/static/js/engine.js` | +5 | — | — | — |
| `backend/static/js/deck3d.js` | +4 | — | (+54 then reverted) | — |
| `backend/static/js/steps.js` | +29 | +31 | (+13 then reverted) | +11 |

Total net additions on main after S81: ~212 lines across 4 files.

---

### Critical Rules (carried forward + new)

**Carried forward from S80:**
- Per-zone beamType is independent. Each zone stores its own beamType.
- Smart defaults: zones < 80 sqft or depth < 6 ft default to flush.
- Zone labels are user-editable.
- Zone height is stored in `zone.h`. null = inherit main deck.
- `getHeightAtPoint()` is the single source of truth for mapping world coords to deck surface height in 3D.
- Anti-anchoring rule: when Will pushes back twice, stop coding and list every assumption.
- Never confirm visual fixes from text extraction alone.
- Lot rotation derived from polygon edge.
- Dimensions are sacred, position is flexible.
- houseAngle is always 0.

**New from S81:**
- **Flush beam is auto-converted to dropped when `zone.h !== main deck H`.** Funneled through `getEffectiveBeamType()`. Engine, 3D, and UI all consume it. The user-facing toggle disables the Flush button at mismatched heights with an explanatory note.
- **`getSharedEdges(p)` is the canonical "find internal zone boundaries" helper.** Lives in zoneUtils.js. Returns deck-local coordinates, axis-aligned only. Pure function.
- **`classifyHeightDelta` and `suggestRiserPlan` own all IRC riser/guard thresholds.** No code outside these helpers may hardcode 4", 7.75", 30", or 147". Future stair, guard, and permit checker code must funnel through them.
- **Traversal before guards.** Never auto-add railing on an internal shared edge until there's a stair to clip against. A "manually broken" safeguard is worse than no safeguard.
- **Warning panels for IRC concerns** belong in the zone properties panel in `steps.js` around line 2492. Yellow for warnings, red text for violations. Each line cites the specific IRC code reference.

---

### Deferred Work

**Next session (S81 continued or S82):**
- **S81d** — Transitional stair schema + engine. Extend `zone.stairs` with `landingType: "grade" | "zone"` and `landingZoneId`. Stair total rise computed from `|fromZone.h - toZone.h|` instead of main deck H. No concrete pad when landing on a zone. Material takeoff in `engine.js`. Backwards-compatible defaults so existing stairs keep working unchanged.
- **S81e** — Transitional stair 3D + plan + UI. New code path in `deck3d.js` for stairs landing on a zone (bottom Y at `toZone.h`, not 0). New code path in `draw_plan.py` for the stair footprint and arrow. New "Add transitional stair" button in the warning panel that picks a sensible default riser plan from `suggestRiserPlan()`.
- **S81c-v2** — Bring back auto-guard rails on >30" shared edges, **with the precondition that S81d/e ships first** so there's an actual stair to clip against. Code is preserved in git history at `f057d1d`.
- **S81f** — Permit checker integration. R311.7.5.1 tripping flag, R311.7.3 over-max landing flag, R312.1.1 unguarded edge flag (only when no stair exists), R311.7.8 handrail flag.

**Still deferred from S82:**
- PDF elevation views with per-zone height (beams, posts, dimensions at zone height)
- Railing at height transitions in elevation drawings
- Stair height recalc for stairs on zones with different height (this overlaps with S81d)
- S83: Per-edge railing control
- S83: "Not occupiable" zone flag (architect use case for planter ledges)
- S83: Back-edge zones, zone-to-zone attachment

**Still deferred from earlier sessions:**
- Stair arrow direction bug (Billy's report, still waiting on his project config data)
- Flush beam joist span IRC validation
- Zone joist direction wiring (`joistDir` schema exists but not used)
- S77 Test Plan Sections A–D, F
- Centroid Y offset investigation (house too close to street in site plan)
- Rotation context object refactor

---

### Known Stair-System Landmines for S81d

The transitional stair work in S81d will touch `stairGeometry.js`. Carry these forward as risks:

1. **Stair arrow direction bug** (Billy's report) — unresolved, pending config data. Two suspect causes: (a) `downDir` doesn't account for stair rotation, (b) `angle` value creates different rotation in 2D vs 3D coordinate systems. Don't touch the arrow code unless you have to.
2. **U-Turn/Wrap 3D bugs** deferred from S15 — likely causes are `downDir="-y"` stringer rotation sign, handrail shortening on run2, `stairGap` offset drift, landing elevation assumption mismatch.
3. **Stair geometry currently assumes landing is at grade.** `stairGeometry.js` will need a `toH` parameter for transitional stairs. Adding it as a new code path (not refactoring existing grade stairs) is the lowest-risk path.

---

### Environment Variables

- `GOOGLE_SOLAR_API_KEY` = set in Railway
- `REALIE_API_KEY` = set in Railway

### Cache Buster

Last bumped: s80c (S80). S81 did not bump the cache buster — Will hard-refreshed during the session. Should bump to `s81` before any production push or marketing activity.

### S81 Lessons for the Permanent Memory

1. **Traversal before guards** on multi-level work. Period.
2. **Read code before guessing.** I burned cycles in this session pattern-matching screenshots when a side-angle 3D view would have answered the question in seconds. Ask for a specific angle when in doubt.
3. **Anti-anchoring rule applies to bug diagnosis, not just code edits.** When I'm "sure" something is broken, the second time I'm sure should trigger a stop-and-verify, not another fix attempt. Ask the user.
4. **IRC thresholds are not opinions.** When Will says "be compliant in any situation we need to be," the answer is to look up the actual code references and bake them into a single helper, not to invent thresholds based on judgment.
5. **The "smart default + visible warning + easy override" pattern** is the right product approach for IRC-driven behavior. Auto-suggest, never silently force, always provide a manual escape hatch.
