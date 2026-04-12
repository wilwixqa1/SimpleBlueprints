# S81d — Transitional Stair Schema + Per-Stair Material Takeoff

## What shipped

**Schema (additive, backwards-compat):**
- New field `_landsOnZoneId` on every stair in `p.deckStairs`. `null` = lands on grade (existing behavior). Number = lands on top of that zone (transitional).
- Underscore prefix signals "derived, do not set by hand."
- `_defaultStair` initializes to `null`. `_migrateStairs` backfills `null` for any pre-S81d saved decks.

**Inference helper (`zoneUtils.js`):**
- `inferStairLanding(stair, p)` walks `getSharedEdges()` to find the lower zone touching the stair's anchored edge. Returns the smallest-delta candidate where the parent is higher than the candidate, or `null` for grade.
- Wired into `addStair` and `updateStair` (location change branch) in `app.js`. The user never sets `_landsOnZoneId` directly — it's recomputed whenever a stair is placed or moved.
- Picks `null` automatically when no qualifying lower zone touches the chosen edge.

**Engine (`engine.js`) — TWO bug fixes for the price of one:**
1. Pre-S81d both `estMaterials` (wood) and `estSteelMaterials` used a single global `c.H` for stair rise across all stairs. Stairs anchored to non-zero zones (e.g. Zone 1 at 7'-6") computed materials as if they descended from the main deck height — wrong. Now each stair resolves its own `fromH` from its anchor zone's height.
2. New transitional branch: when `_landsOnZoneId != null`, `toH` = landing zone's height. Total rise = `|fromH - toH|`. Landing footings, posts, and bases are skipped (the stair lands on a deck surface, not concrete). Stringers, treads, and brackets are always included.
3. Same logic applied to both wood and steel materials paths.

**Python mirror (`stair_utils.py`):**
- `resolve_all_stairs` still uses single-global `height` for drawing — TODO comment added pointing to S81e for the fix. No drawing changes in S81d per scope.

**Cache buster bumps:**
- `engine.js`, `zoneUtils.js`, `app.js` → `s81d`. Note: handoff doc said `s80c`; actual was `s75a`. Handoff was outdated.

## What's intentionally NOT in S81d

- 3D rendering of transitional stairs (S81e)
- PDF rendering of transitional stairs and per-zone-anchor stair rise (S81e + S82)
- "Add compliant stair" button on the warning panel (S81e)
- Auto-guard rail rendering bring-back (S81c-v2, gated on S81e clipping logic)
- `permit_checker.py` integration (S81f)

## Test plan (run after deploy)

1. **Regression — zone 0 grade stair byte-identical:**
   Open a deck with a single stair on the main deck (no zones), check the materials list. Compare to a deck saved before S81d if available. Line items must match exactly.

2. **NEW — zone N grade stair now produces materials:**
   Add Zone 1 (any height ≠ main), add a stair to Zone 1 with `location` on an edge that does NOT touch the main deck (e.g. the outer-facing side). Check materials list — should now include stringers, treads, brackets, AND landing footings/concrete (lands on grade). Pre-S81d this would have produced $0.

3. **NEW — zone N transitional stair (the headline feature):**
   Add Zone 1 at 7'-6" attached to right edge of main deck (4'). Add a stair to Zone 1 with `location = "left"` (the side touching main deck). Check materials list — should include stringers, treads, brackets, but **NO** landing footings, post bases, or concrete bags. Total rise should be 3'-6", which works out to 6 risers @ 7" each.

4. **Migration check:**
   Load any deck saved before S81d. Should not crash. Stairs should have `_landsOnZoneId === null` after load.

## Known limitations (will look broken until S81e)

- Transitional stairs render in 3D as if they go all the way to grade — they pass through the lower deck surface visually. This is expected. S81e will fix the 3D path.
- PDF plan view will draw transitional stairs at the wrong rise. Same fix in S81e.
- The warning panel still says "Stair required" even after a transitional stair is added, because the warning panel doesn't know about the new field yet. Will be wired up in S81e along with the "Add compliant stair" button.

## Files changed

- `backend/static/js/zoneUtils.js` (+156) — `inferStairLanding`
- `backend/static/js/app.js` (+33) — schema field, migration backfill, addStair/updateStair wiring
- `backend/static/js/engine.js` (+62) — per-stair fromH/toH resolution + transitional branch in BOTH wood and steel paths
- `backend/drawing/stair_utils.py` (+6) — TODO marker for S81e
- `backend/static/index.html` (+3/-3) — cache buster bump to s81d
