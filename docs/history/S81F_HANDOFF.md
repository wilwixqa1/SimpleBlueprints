# S81f Handoff: Deck Post Collision with Stair Landing Footprint

**Status:** Deferred from S81e session
**Scope:** Structural integrity fix across 3D, PDF, and calc engine
**Estimated effort:** 4-6 hours of careful work
**Risk level:** Medium-high (touches structural calc, permit output, and multi-file rendering)

---

## The bug in one sentence

Multi-run stair templates (wrap-around, L-shape, switchback, wideLanding) can have landing footprints that overlap the main deck's support post positions, causing a main-deck support post to render as going through the stair landing platform in the 3D view. The PDF framing plan and the permit's structural calculations do not account for this collision either.

## Visual symptom

3D preview shows a tall, thick (6x6 or 4x4) wooden post extending from grade up past the deck surface, passing through whatever landing platform happens to sit in its path. Users notice it because it looks structurally impossible and visually messy. See screenshot in S81e session transcript dated 2026-04-19.

## Why this exists

Two independent systems place posts without coordinating:

1. **Main deck posts** are placed by the calc engine (`calculate_structure` in `backend/drawing/calc_engine.py` and equivalent JS in `engine.js`) at positions along the beam line `z = z0wz + D - 1.5`. X-positions (`calc.pp`) are evenly spaced across deck width, derived from max beam span rules.

2. **Stair landings** are placed by the stair geometry engine (`computeStairGeometry` in `backend/static/js/stairGeometry.js` and `compute_stair_geometry` in Python). For multi-run templates, some landings extend back into the main deck's footprint in world-space x/z coordinates. Landing support posts are at the landing's corners (drawn inside the stair group in `deck3d.js` line ~1067-1088).

Neither system knows about the other's positions. For a wrap-around stair centered on an 18.5ft deck, the deck's middle support post can end up inside the wrap's second landing footprint.

## Construction reality

Real decks don't have this problem because a builder would:

1. **Move the conflicting deck post to one side of the stair opening** (most common approach — slightly uneven post spacing, totally permit-compliant as long as beam max-span isn't exceeded)
2. Or **use the deck post as a shared support** (the post goes from grade past the landing surface up to the main beam, with the landing attached via joist hangers at mid-height). Less common but sometimes done on tight sites.
3. Or **hang the landing from the main beam** via hardware (suitable for smaller landings only).

For SimpleBlueprints, **approach 1 is the right default** because it matches what 90%+ of builders would do and produces a structurally conventional deck.

## What to fix, across all layers

### Layer 1: Calc engine (both Python and JS)
- `calc_engine.py` → `compute_post_positions` (or wherever post X positions are derived)
- `engine.js` → the equivalent JS function

Post placement rule should become: "Evenly space posts across width, then check for stair landing collisions. For each colliding post, snap it to the nearest edge of the offending landing (outside). If snapping creates a beam span that exceeds max, add a post on the other side instead."

Concretely: post positions should be a function of `(W, maxBeamSpan, stairLandingRectsAtBeamLine)` not just `(W, maxBeamSpan)`.

### Layer 2: 3D rendering (`deck3d.js`)
After the calc engine change, `calc.pp` already reflects the corrected positions. The zone 0 post rendering loop at line ~326 (`pp.forEach(function(px, _pi) { ... })`) should Just Work with no changes, because it reads `calc.pp`.

### Layer 3: PDF framing plan (`draw_plan.py`)
Same principle. `draw_plan_and_framing` reads `calc["post_positions"]` and `calc["num_posts"]`. Those values come from calc_engine, so if calc_engine is fixed, the PDF updates automatically.

One subtle thing: the PDF also renders post-to-corner dimensions and footing center-to-center spacing. These need to match the new (non-uniform) spacing. Should be automatic if the code just reads `calc.pp`, but verify.

### Layer 4: Materials / cost calc
Count of posts may change (approach 1 in a span-limited case might add a post). `calc.num_posts` should be used everywhere. Check for any hard-coded post counts.

### Layer 5: Dimensions sanity
After moving a post, check that:
- Beam span between adjacent posts still ≤ max allowed (from `get_max_span` in calc engine)
- Post-to-corner distance still reasonable (usually max 2ft overhang per IRC)
- Cantilever beam length at ends is within allowed range

If any of these would be violated by approach 1, the fallback is approach 2 (shared post) or showing an error to the user.

## Suggested implementation order (safer path)

1. **Start in Python** (`calc_engine.py`) — simpler language, better for getting the logic right first. Write unit tests.
2. **Port to JS** (`engine.js`) — the function signature should match. Verify 3D preview updates correctly.
3. **Verify PDF** regenerates correctly with new post positions.
4. **Check materials calc** — post count, footing count still accurate.
5. **Test across every stair template** (straight, wideLanding, lLeft, lRight, switchback, wrapAround) at different deck widths (10ft, 18ft, 30ft) and stair offsets (center, off-center, corner-adjacent).

## Edge cases to think about

- **Stair at the corner of the deck:** landing may exit past the deck's X range. No collision possible because the deck post is at `W - 2` or similar, and the landing is at `x > W`.
- **Small deck, large stair:** landing may span so much of the deck width that MULTIPLE deck posts collide. Algorithm should handle arbitrary collision count.
- **Multiple stairs:** multiple stairs can each have landings. All must be considered.
- **Transitional stairs (S81d/S81e):** these land on a zone surface, not grade, but their intermediate landings may still collide with zone-0 deck posts. Treat the same way.
- **Zone 1+ stairs with their own posts:** non-zone-0 zones have their own post sets. Same principle applies for multi-run stairs anchored on add zones, but those zone posts are positioned simpler (4 corners + intermediate at 6ft spacing). Less likely to collide.

## Why this wasn't caught earlier

The bug pre-dates S81e. It was first noticed during S81e visual testing on production when a wrap-around stair test case showed the through-post. It's been present in all multi-run templates since those templates were added (S64/S65 era), but users often don't notice because it's visually subtle from many camera angles, and straight stairs (the most common template) don't trigger it.

## Explicit non-goals for S81f

- Don't redesign the whole post-placement system. Just fix the collision rule.
- Don't touch the landing-post system (the 4 corner posts on each landing) — that's correct as-is.
- Don't try to handle the rare "builder uses shared post as double-duty" approach — stick with approach 1.

## Related code locations

- `backend/drawing/calc_engine.py` — `compute_post_positions`, `calculate_structure`
- `backend/static/js/engine.js` — `estMaterials` section, post positioning
- `backend/static/js/stairGeometry.js` — `computeStairGeometry`, returns landing rects in stair-local coords
- `backend/static/js/stair_utils.py` (Python) → `resolve_all_stairs` returns landing world rects
- `backend/static/js/deck3d.js` line ~326 — consumes `calc.pp` to render main deck posts
- `backend/drawing/draw_plan.py` — consumes `calc["post_positions"]` for PDF framing plan

## Reference: how stair landing world rects are already computed

Both Python and JS already have helpers that give you the world-space rect of every stair landing. This is the input to the collision check:

- **JS**: In `deck3d.js`, the `resolvedStairs` array has `.sg.landings` (local coords) + `.wax/.waz/.stPl.angle` (world transform). Use existing `transformStairPoint` or similar to get world-space corners.
- **Python**: `resolve_all_stairs(params, calc)` returns entries with `geometry.landings` plus `world_anchor_x`, `world_anchor_y`, `angle`. Use `transform_stair_rect` from `stair_utils.py`.

So the collision-check logic has everything it needs. The work is just wiring it into post placement.

## Test plan for S81f session

1. Regression: straight stair (all widths/heights) → post positions unchanged
2. Wrap around, 18'×12' deck, stair centered → middle post shifts, no through-post in 3D
3. Wrap around, 30'×12' deck, stair off-center → multiple posts may shift
4. L-shape left/right, 16'×12' → landing footprint is smaller, collision rarer
5. Switchback, various sizes → landing footprint is symmetric, 1 post likely affected
6. wideLanding, 20'×14' → landing is wide, up to 2 posts affected
7. Two stairs on one deck (e.g. front-exit wrap + right-exit straight) → both stair's landings considered
8. PDF regenerate for each case → post positions in PDF match 3D, dimensions correct, materials count correct

---

**End of handoff.** Pick up by reading this doc, then start with the calc engine in Python.
