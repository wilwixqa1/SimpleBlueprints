# S81d Session Context — Transitional Stair Schema, Engine, and Destination UI

**Commits:** `9c40ee0` (S81d), `7218875` (S81d.5), `08b40db` (S81d.5 hotfix)
**Branch:** main
**Cache buster:** `s81d5` on engine.js, zoneUtils.js, app.js, steps.js (via global `var v`)
**Status:** Verified working end-to-end. Transitional stair to Main Deck = $12,540. Grade stair to Ground = $13,506. $966 delta confirms engine branching is correct.

---

## What this session shipped

### 1. Schema: `_landsOnZoneId` field on stairs

Every stair in `p.deckStairs[]` now has `_landsOnZoneId`:
- `null` = lands on grade (existing behavior, backwards-compatible default)
- `<number>` = lands on top of that zone (transitional stair)

The underscore prefix signals "derived, do not set by hand." The field is set automatically by `getStairDestinations()` when the user clicks a destination button, and by `inferStairLanding()` when a stair's location changes.

**Migration:** `_migrateStairs` in `app.js` backfills `_landsOnZoneId: null` for any pre-S81d saved decks. Old saves load without crashing. All pre-existing stairs are treated as grade stairs.

**`_defaultStair` in `app.js`:** initializes `_landsOnZoneId: null`.

### 2. Destination-aware stair buttons (the headline UX change)

**Before S81d:** A single "+ Add Stairs" button on every zone. No way to specify where the stair lands. All stairs went to grade by default.

**After S81d.5:** The Stairs section renders one button per valid destination:
- `+ Add stairs to Ground` (always present)
- `+ Add stairs to Main Deck` (appears when the zone shares an edge with main deck and is higher)
- `+ Add stairs to <Zone Label>` (appears for each adjacent lower zone)

Labels use the zone's custom label (from S80b) if one exists, otherwise "Zone N" or "Main Deck."

**Implementation:** `getStairDestinations(zoneId, p)` in `zoneUtils.js` walks `getSharedEdges()` and returns `[{label, landsOnZoneId, location}, ...]`. Each entry includes the pre-computed `location` (front/left/right/back) of the shared edge, so clicking the button sets everything the engine needs in one shot. The UI in `steps.js` (line ~2672) maps over this array to render the buttons.

**`addStair(zoneId, dest)` in `app.js`** now accepts an optional second argument `dest = {landsOnZoneId, location}`. Backwards compatible (calling `addStair(0)` with no dest still works).

**Design decisions baked in:**
- Tripping-range deltas (0.5"--4") are NOT filtered out. The destination button appears, the user can create the stair, and the S81b warning panel surfaces R311.7.5.1 for the consequence. This was a deliberate product decision: stay unopinionated at edge cases, maximize flexibility for architects who may be designing for variance/exception permits.
- Deltas < 0.5" are treated as `'level'` (within construction tolerance). No stair destination button appears because no stair is needed.
- The "Ground" option always appears regardless of adjacency.

### 3. Engine: per-stair rise resolution + transitional branch

**Bug fix (pre-S81d hidden bug):** Both `estMaterials` (wood) and `estSteelMaterials` used a single global `c.H` (main deck height) for ALL stair rise calculations. A stair anchored to Zone 1 at 8' would compute its rise as if it descended from main deck height (4'). Wrong stringer lengths, wrong riser counts, wrong costs. Now each stair resolves its own `fromH` from its anchor zone's height via `(p.zones || []).find(z => z.id === _anchorId)`.

**New transitional branch:** When `_landsOnZoneId != null`:
- `toH` = landing zone's height (not 0)
- Total rise = `|fromH - toH|`
- Landing footings, posts, post bases, sonotubes, and concrete bags are **skipped** (stair lands on a deck surface, not concrete)
- Stringers, treads, riser boards, and stringer brackets are always included regardless of landing type

**Both wood and steel paths** have identical S81d logic. The steel path is in `estSteelMaterials` (line ~710), the wood path is in `estMaterials` (line ~818).

### 4. Helpers in `zoneUtils.js`

Three new helpers, all exposed on `window.*`:

| Helper | Purpose | Returns |
|---|---|---|
| `inferStairLanding(stair, p)` | Given a placed stair, infer which zone it lands on from its location and the shared edges | `number` (zone id) or `null` (grade) |
| `getStairDestinations(zoneId, p)` | All valid stair destinations from a zone (ground + adjacent lower zones) | `[{label, landsOnZoneId, location}, ...]` |
| (existing) `getSharedEdges(p)` | Internal edges between adjacent zones | array of edge segments (unchanged from S81b) |

**`inferStairLanding` logic:**
- Maps the stair's `location` (front/left/right/back) to an edge coordinate on the parent zone's rect
- Walks `getSharedEdges` to find any segment matching that edge
- Returns the adjacent zone id where the parent zone is higher, picking the smallest delta
- Returns `null` if no qualifying neighbor (grade landing)
- Wired into `updateStair` location-change branch so `_landsOnZoneId` updates when the user changes direction

**`getStairDestinations` logic:**
- Calls `getSharedEdges`, filters to zones lower than the source zone
- Maps each shared edge's axis (vertical/horizontal) to a location (front/left/right/back)
- Returns one entry per unique lower neighbor, plus always includes "Ground"
- Does NOT filter out tripping-range deltas (product decision, see above)

### 5. `classifyHeightDelta` rename: 'flush' -> 'level'

The IRC height-delta classifier returned `'flush'` for deltas < 0.5". This collided with the flush-vs-dropped beam type terminology used elsewhere in the codebase. Renamed to `'level'` in all three call sites within `zoneUtils.js`. No behavior change.

Updated classification table:

| Range | Class | IRC | Action |
|---|---|---|---|
| `< 0.5"` | `level` | -- | nothing (was `flush`, renamed S81d.5) |
| `0.5"--4"` | `tripping` | R311.7.5.1 | warn red, no compliant single step |
| `4"--7.75"` | `single-step` | R311.7.5.1 | one riser, no handrail |
| `7.75"--30"` | `multi-step` | R311.7.5.1 | uniform risers, no guard |
| `30"--147"` | `guarded` | R312.1.1 | uniform risers + guard on higher side |
| `>= 147"` | `over-max` | R311.7.3 | intermediate landing required, not yet supported |

### 6. Python marker (`stair_utils.py`)

`resolve_all_stairs` in `backend/drawing/stair_utils.py` has a TODO comment at line ~344 pointing to S81e. The function currently uses a single global `height` for all stairs regardless of anchor zone or landing target. This means PDF stair drawings use the wrong rise for non-zero-zone stairs. The fix belongs in S81e alongside the `draw_plan.py` rendering changes.

---

## Files changed (cumulative across all 3 commits)

| File | Lines changed | What |
|---|---|---|
| `backend/static/js/zoneUtils.js` | +220 | `inferStairLanding`, `getStairDestinations`, `classifyHeightDelta` rename, `getZoneById` arg order fix |
| `backend/static/js/app.js` | +35/-14 | `_landsOnZoneId` in `_defaultStair` and `_migrateStairs`, `addStair(zoneId, dest)` signature, removed dead `pickBestStairLocation` ref |
| `backend/static/js/engine.js` | +62/-8 | Per-stair fromH/toH resolution + transitional branch in BOTH wood and steel paths |
| `backend/static/js/steps.js` | +9/-1 | Destination button loop replacing single "+ Add Stairs" button |
| `backend/static/index.html` | +4/-4 | Cache buster bump to `s81d5` |
| `backend/drawing/stair_utils.py` | +6 | TODO marker for S81e |

---

## S81d.5 hotfix: reversed `getZoneById` args

**Root cause:** `getZoneById` signature is `(p, zoneId)` but all five S81d call sites in `zoneUtils.js` had `(zoneId, p)`. Every lookup silently returned `null`, causing:
- `inferStairLanding` to always return `null` (no transitional detection)
- `getStairDestinations` to show only "Ground" (no adjacent zone buttons)
- Engine math was unaffected (uses `.find()` directly, not `getZoneById`)

**Fix:** Five one-line argument swaps in `zoneUtils.js`.

---

## Verified test results

| Scenario | Cost | Verified |
|---|---|---|
| Zone 1 at 10', main at 4', stair to Main Deck (transitional) | $12,540 | Yes -- no concrete/footings in line items |
| Zone 1 at 10', main at 4', stair to Ground (grade) | $13,506 | Yes -- includes concrete bags, sonotubes |
| Delta | $966 | Correct -- matches saved materials |
| Warning panel fires at correct IRC thresholds | Yes | R312.1.1, R311.7.8 verified at 72" delta |
| Beam auto-switches to Dropped when heights differ | Yes | S81a still working |
| Migration: old saves load without crash | Yes | `_landsOnZoneId` backfilled to null |

---

## What is NOT in S81d (deferred to future sessions)

### S81e (next session -- start here)
- **Python `resolve_all_stairs` rise fix:** Mirror the JS per-stair fromH/toH logic. TODO marker is at line ~344 of `stair_utils.py`. Currently uses single global `height` for all stairs.
- **3D rendering:** Transitional stairs currently render to grade (pass through lower deck surface). Need new code path in `deck3d.js` that sets stair bottom at `toZone.h` instead of 0.
- **PDF plan view:** Transitional stair footprint and arrow on shared edge. Changes in `draw_plan.py`.
- **Warning panel satisfaction:** The S81b warning panel still says "Stair required" even after a transitional stair exists. Wire the panel to count existing `deckStairs` with matching `_landsOnZoneId` and turn the warning green when satisfied.
- **"Add compliant stair" one-click button** on the warning panel. Calls `addStair(activeZone, dest)` with the right destination pre-set from `suggestRiserPlan`. The S81d.5 destination buttons already exist in the Stairs section; this would be a convenience shortcut from the warning itself.

### S81c-v2 (after S81e)
- Re-land auto-guard rails on shared edges with delta >= 30". Code preserved at git commit `f057d1d`. The bring-back is gated on stair-footprint clipping working correctly, which requires S81e's transitional stair rendering to exist first. The lesson "traversal before guards" from S81 still applies.

### S82 (after S81e)
- PDF elevation views rendering per-zone heights. `draw_elevations.py` currently draws everything at main deck H. Zone beams, posts, dimensions need to render at zone height.

### S81f (after S81e)
- `permit_checker.py` integration: R311.7.5.1 tripping flag, R311.7.3 over-max flag, R312.1.1 unguarded edge flag, R311.7.8 handrail flag.

### S83 (architect features)
- Per-edge railing control
- Back-edge zones, zone-to-zone attachment
- "Not occupiable" zone flag for planter ledges

---

## Standing rules carried forward

All rules from the S81 handoff doc still apply. Key ones for S81e specifically:

- **Traversal before guards.** Never auto-add railing on an internal shared edge until a transitional stair exists to clip against.
- **Fix PDF before frontend** when a feature touches both.
- **Think in 2D plan view first** when computing stair/deck overlap in Three.js.
- **Never confirm visual fixes from text extraction alone.** Say "does it look right to you?" and wait.
- **Anti-anchoring rule.** When Will pushes back twice, stop, list assumptions, evaluate from scratch.
- **30-minute bug timebox.**
- **No em-dashes in prose output.**
- **`getZoneById` signature is `(p, zoneId)` not `(zoneId, p)`.** The S81d.5 hotfix caught five reversed calls. Double-check arg order on every future call.
- **`classifyHeightDelta` returns `'level'` for delta < 0.5", not `'flush'`.** Renamed in S81d.5 to avoid collision with flush beam terminology.
- **IRC thresholds live exclusively in `classifyHeightDelta()`.** Never hardcode 4", 7.75", 30", or 147" anywhere else.
- **`getEffectiveBeamType()` is single source of truth** for per-zone beam type validation.
- **`getHeightAtPoint()` is single source of truth** for deck-top elevation in 3D.
- **`getSharedEdges()` is single source of truth** for internal zone boundaries.

---

## Session start checklist for S81e

1. Read this file plus the main handoff doc (`HANDOFF.md` or equivalent in repo root).
2. Clone/sync the repo. Latest commit should be `08b40db` or later.
3. Upload current `deck3d.js`, `draw_plan.py`, and `stair_utils.py` if working from files rather than repo clone.
4. Confirm scope with Will before starting code.
5. Read `deck3d.js` stair rendering path before editing (known landmines in stairGeometry.js -- see S81 handoff section 10).
6. Read `stair_utils.py` `resolve_all_stairs` and the TODO marker before editing.
7. Bump cache buster before final push.
8. Remind Will to rotate PAT at session end.
