# SimpleBlueprints S82 Planning Doc — Deferred Issues from S81e Session

**Context:** The S81e session successfully shipped transitional stair rendering (Python/PDF/3D + warning panel). During production testing, several pre-existing issues were identified. None are caused by S81e; they existed in prior sessions and surfaced during visual verification.

This doc consolidates them into one planning document so a future session can prioritize, estimate, and tackle them as a coherent batch rather than discovering them one-at-a-time.

---

## What shipped in S81e (verified working in production)

All of the following were tested end-to-end on simpleblueprints.xyz after merge:

- **Transitional stair 3D rendering** — stair descends from higher zone to lower zone surface. No concrete pad. No grade-reaching piers. Lands correctly on the lower deck surface.
- **PDF plan view labels** — transitional stairs render with "LANDS ON [zone]" label instead of "CONCRETE LANDING" dashed pad.
- **Per-stair riser threading** — each stair's rise/run is computed from its own `fromH`/`toH`, not from the global main deck height. PDF shows different per-stair riser heights (e.g. 6.9" for grade, 7.2" for transitional on the same deck).
- **Main deck integrity** — deck boards intact where a transitional stair lands. Main deck railing preserved. The new `_stairCutsPoint` anchor-zone clipping rule works correctly.
- **Warning panel detection** — height transitions on shared edges are detected and classified correctly (`level`, `tripping`, `single-step`, `multi-step`, `guarded`, `over-max`).
- **Warning panel satisfaction state** — existing matching stairs turn the warning row green with "✓ Stair placed" prefix.
- **"+ Add compliant stair" button** — appears when warning is unsatisfied and classification requires a stair. Click creates a correctly-configured transitional stair (anchored on higher zone, landing on lower zone).

**Also included: S81e.1 hotfix** — fixed pre-existing bug where wrap-around stairs cut a 4ft-wide hole in the deck boards at the stair base. Root cause was `frontGap.zMin/zMax` using full stair bbox (which for wrap includes landing 2 and run 3 behind the anchor). Fix uses run 0's rect only.

## Current state on main

- Commit `48b5c9e`: S81e merge to main
- Commit `cdcee54`: S81f handoff doc filed
- Latest commit TBD: S82 planning doc (this file)

---

## Priority matrix

| Issue | Severity | Scope | Effort | User-facing impact |
|-------|----------|-------|--------|---------------------|
| S81f — Deck post through stair landing | High | JS + Python + calc | 4-6h | Multi-run stair decks look structurally wrong |
| S82a — Auto-guard rendering on shared zone edges | High | JS + Python PDF | 3-4h | IRC R312.1 non-compliance visible on plans |
| S82f — Elevations draw zones at wrong height | High | Python PDF | 1-2h | PDF elevations misrepresent the deck |
| S82d — Site plan shows only one stair | Medium | Python PDF | 1-2h | Multi-stair decks have inconsistent plans |
| S82b — L-shape floating/clipping deck boards | Medium | JS 3D | 2-3h | Visual polish; affects both L-shape templates |
| S82c — Platform stair intermediate landing rails disconnected | Medium | JS 3D | 1-2h | Visual polish |
| S82e — Cover sheet post count vs framing plan mismatch | Low | Python PDF | 30 min | Metadata inconsistency |

**Recommended order:** S82f → S82a → S82d → S81f → S82b → S82c → S82e

Rationale:
- **S82f** is cheap, high value, already has a TODO comment in the code. Fixing makes other zone-related testing cleaner.
- **S82a** is code-compliance critical and the user's eye will catch it. Per IRC R312.1, any 30"+ drop requires a guard.
- **S82d** is reviewer-facing correctness; inconsistent plans increase rejection risk.
- **S81f** is the biggest fix but high user-facing value. Defer until the smaller PDF fixes are done so that PDF + 3D stay in sync.
- **S82b/c/e** are visual polish. Can wait.

---

## S81f — Deck post collision with stair landing

**See:** `S81F_HANDOFF.md` in repo root (already filed, commit `cdcee54`).

Summary: Main deck support posts (placed at evenly-spaced X positions along the beam line) can overlap with intermediate landing rectangles from multi-run stair templates (wrap-around, L-shape, switchback, wideLanding). Result: a deck post renders as passing through a stair landing in 3D, and the PDF framing plan and structural calc don't account for the collision either.

Full handoff in S81F_HANDOFF.md with layer-by-layer implementation plan, test cases, and construction-reality rationale for the suggested approach (relocate conflicting posts to edges of stair opening).

---

## S82a — Auto-guard rendering on shared zone edges

**Symptom:** When two zones share an edge with >30" height difference (e.g. Zone 1 at 8ft, main deck at 4ft = 48" drop), the S81b warning panel correctly detects the condition and surfaces it as `guarded` classification, but no guard rail is drawn on the shared edge in either 3D preview or the PDF plan view. Per IRC R312.1 any walking surface more than 30" above the adjacent surface requires a 36"-minimum guard.

**Root cause:** `getExposedEdges()` in `zoneUtils.js` returns only the outer perimeter of the composite deck outline. Its `isSolid()` check returns `true` for any cell that's inside ANY additive zone, so edges between two zones (even at different elevations) are considered "internal" and filtered out. The guard requirement at height deltas is handled by the separate `classifyHeightDelta()` function used by the warning panel, but that classification isn't wired into any rendering code.

**Historical note:** Session memory mentions "auto-guard rendering reverted per 'traversal before guards' rule" during S81a-S81c. The rule: fix how people *get between* zones (stair placement) BEFORE adding guards, because guards might block stair placement. S81e delivered the traversal system (transitional stairs + warning panel), so auto-guard is now unblocked.

**What's needed:**

1. Add a new function `getGuardedSharedEdges(p)` in `zoneUtils.js`:
   - Iterates shared edges between adjacent zones
   - For each, computes `classifyHeightDelta(deltaIn)`
   - Returns only edges where classification is `guarded` (delta ≥ 30")
   - Each returned edge includes: `x1, y1, x2, y2, dir, higherZoneId, lowerZoneId, deltaIn`

2. Update `deck3d.js` — after the existing `exposedEdges.forEach`, also iterate `getGuardedSharedEdges` and draw rail geometry (posts + top rail + bottom rail + balusters) on the HIGHER zone's side of each edge. Use the same `addRail`/`addRailPost` helpers as the existing railing code.

3. When a transitional stair exists on a shared edge, the stair creates an opening in the guard. Use the existing `_stairCutsPoint` helper (added in S81e) to detect the stair's opening in the guard edge, same way stair openings work in outer railings.

4. Mirror in Python: add `get_guarded_shared_edges` to `zone_utils.py`, update `draw_plan.py` to render these edges in both plan and framing views.

5. Warning panel update: keep the warning message but consider whether to append "Guard rendered" indicator when both a stair is placed AND guard is rendered. May not be necessary — the user can visually verify.

**Testing matrix:**
- Zone 1 at 8ft, main deck at 4ft, no stair → guard on Zone 1's shared edge side; warning panel says "Stair required + guard required"
- Same, with transitional stair placed → guard appears with opening where stair descends
- Zone 1 at 5ft, main deck at 4ft (12" delta, `single-step`) → no guard, warning panel shows `single-step` message
- Zone 1 at 8ft, Zone 2 at 5ft, main deck at 4ft → guards on BOTH shared edges where delta ≥30"
- PDF version: rail appears in plan view AND framing plan

**Effort:** 3-4 hours.

---

## S82f — Elevations draw zones at wrong height

**Symptom:** In PDF sheet A-2 (elevations), additional zones (Zone 1, Zone 2, etc.) with per-zone heights different from main deck are drawn at the main deck's height instead of their own height. A Zone 1 at 8ft on a 4ft main deck appears as a 4ft elevation section in all four elevation views.

**Root cause:** `backend/drawing/draw_elevations.py` line 82 has an explicit TODO:

```python
sections.append({
    "x_draw": r["x"] + x_off,
    "w": r["w"],
    "deck_top": H,  # future: zone.get("height", H)
})
```

The code was written during S24 when zone heights were always equal to main deck height. S80 added per-zone heights but didn't update this file.

**Fix:**

1. Change line 82 from `"deck_top": H` to `"deck_top": zone.get("h", H)` (the S80 schema uses `h` for zone height, not `height`).
2. Verify `_draw_zone_section_south` and `_draw_zone_section_north` use `section["deck_top"]` everywhere they need the zone's top elevation (already appears to via line 96).
3. Check that the beam height, posts, and railing drawn for each zone section also use `deck_top` and not the global H.
4. East/West elevations: currently these don't show zones at all (they show only the main deck). Consider if zones attached to front/back edges should appear in east/west views. (This might be a separate sub-issue.)

**Testing:**
- Single zone attached on left, height 8ft, main deck 4ft → South elevation shows zone as 8ft section, main deck as 4ft section.
- Zone attached on right, same heights → similar on North elevation.
- Multiple zones with different heights → each section at its own height.
- Zones at same height as main deck (H=4, zone h=4) → should look identical to current behavior (no regression).

**Effort:** 1-2 hours. Simple TODO completion plus verification across elevation views.

---

## S82d — Site plan shows only one stair (pre-S64 schema)

**Symptom:** When a deck has multiple stairs (e.g. grade stair on front + transitional stair between zones), sheet A-5 (site plan) shows only one stair — the first one — and only for decks with the legacy `hasStairs: true` schema.

**Root cause:** `backend/drawing/draw_site_plan.py` line 516+ uses the pre-S64 flat schema: `params.get("hasStairs")`, `params.get("stairWidth")`, `params.get("stairOffset")`, `params.get("stairLocation")`. The current schema (S64+) stores stairs in `params.deckStairs` as an array.

`_migrateStairs` in `app.js` synthesizes legacy params from the first element of `deckStairs` for backward compat. That's why ONE stair shows. Others invisible.

**Fix:**

1. Replace the legacy single-stair block in `draw_site_plan.py` with iteration over `resolve_all_stairs(params, calc)`.
2. For each resolved stair, decide whether to render based on stair type:
   - **Grade stair (non-transitional):** YES, render as simple rectangle with arrow and "STAIRS" label. Shows as a projection beyond the deck footprint.
   - **Transitional stair:** YES, render as a smaller arrow within the deck footprint showing direction of descent + label like "↓ to Main Deck". Shows internal traversal.
3. Update the legend entry on A-5 to distinguish grade stairs (projection) from transitional stairs (internal traversal).

**Design choice:** Should transitional stairs show on site plan? Arguments for: reviewer sees the full deck design. Arguments against: site plan is typically about lot coverage and setbacks, not internal design. **Recommendation: show both, but with different styling** so the reviewer can still clearly see what projects beyond the deck.

**Testing:**
- Deck with only grade stair → unchanged from current (single rectangle + arrow, "STAIRS" label).
- Deck with grade + transitional → BOTH appear on A-5.
- Deck with only transitional (unusual but possible) → transitional shows internally, no grade stair projection.
- Deck with NO stairs → A-5 shows just the deck outline, no stair elements.

**Effort:** 1-2 hours.

---

## S82b — L-shape stairs have floating/clipping deck boards

**Symptom:** On L-shape templates (`lLeft` and `lRight`), deck boards near the stair area appear to be floating or clipping into each other. Affects both L-shape variants symmetrically (user confirmed), suggesting systemic issue not template-specific bug.

**Note:** S81e.1 fixed the wrap-around stair's deck hole by correcting `frontGap.zMin/zMax` to use run 0 rather than full wbb. That fix applies to ALL templates including L-shape, but user reports the L-shape issue persists post-S81e. So this is a DIFFERENT bug from the wrap hole.

**Diagnostic status:** Not yet root-caused. Session ended before diagnosis.

**Starting points for investigation:**

1. Reproduce on both `lLeft` and `lRight` with identical deck configs to confirm the visual is symmetric (expected if systemic).
2. Take a screenshot showing the issue clearly.
3. Candidate root causes:
   - `frontGap`/`leftGap`/`rightGap` is still using wbb for the x-range (only the z-range was fixed in S81e.1). For L-shapes, bbox.maxX extends past run 0's width because run 1 extends sideways from the landing.
   - Stair rendering loop in `deck3d.js` (around line 770+) might be rendering treads/stringers incorrectly when treadAxis differs between runs (L-shapes have treadAxis="h" on run 0 and treadAxis="w" on run 1).
   - The `_stairCutsPoint` anchor-zone clipping check might have an off-by-one or direction bug that's only triggered by L-shape footprint shape.

**First investigation step:** Compare `allStairWBBs[i]` values for wrap vs L-shape. Specifically look at xMin/xMax — for L-shape lLeft, bbox extends in -x (run 1 direction); for lRight, in +x. If board-cutting uses the full bbox x-range but the actual stair occupies only a narrow part at each z-slice, boards get cut wider than they should be.

**Effort:** 2-3 hours depending on root cause complexity.

---

## S82c — Platform stair intermediate landing rails disconnected

**Symptom:** On multi-run stairs with intermediate landings (switchback, L-shape, wideLanding, wrapAround), rails on the upper run end at the landing and rails on the lower run start fresh at the landing. The rail on the landing itself doesn't connect across to continue the handrail. Visual gap at every intermediate landing.

**Root cause hypothesis (needs code verification):** In `deck3d.js` around line 1101, the `landingEdges.forEach(...)` loop classifies each landing edge as "connected" (a run runs up against it → no rail drawn) or "exposed" (open air → rail drawn). The tolerance check uses `lrTol = 0.3`. Issue likely: the "connected" edges are correctly excluded (where you'd step onto a run), but the code doesn't add a continuation rail ALONG the landing between where the upper run ends and the lower run begins. Code needs to look at the two run ends meeting at the landing and add a short rail connecting their handrail ends across the landing.

**Scope:** Contained to `deck3d.js` landing-rail rendering. Pure visual, no calc or PDF involvement.

**Effort:** 1-2 hours.

---

## S82e — Cover sheet post count vs framing plan mismatch

**Symptom:** Sheet A-0 (cover) "DECK SPECIFICATIONS" section says `POSTS 6x6 (5 TOTAL)`. Sheet A-1 (framing plan) label says `6x6 PT POSTS (3)`.

**Root cause:** Two different files compute or read the post count from different sources. One is likely using `calc["num_posts"]` from the calc engine (accounting for stair landing posts as "deck posts"), the other is using only the main deck beam-line posts. Needs investigation of which file is wrong.

**Fix:** Identify both sources, pick the semantically correct value, update the incorrect one to match.

**Candidate locations:**
- `backend/drawing/draw_cover.py`
- `backend/drawing/draw_plan.py`
- `backend/drawing/permit_spec.py`

**Effort:** 30 minutes.

---

## Cross-cutting: discovery pattern

During S81e testing, 6 issues surfaced that were pre-existing but had never been caught. Pattern observation: each of these bugs is on a code path that's only exercised for **specific deck configurations** (multi-zone, multi-stair, non-rectangular, specific templates). The default test case (simple rectangular deck with one grade stair) was fine; complex configs revealed everything.

Suggestion for future sessions: maintain a short list of "canonical test decks" that cover the combinatorial space:
- Single-zone with straight grade stair (baseline, most users)
- Single-zone with wrap-around grade stair (tests non-rectangular stair geometry)
- Single-zone with L-shape stair
- Two-zone with matching heights (tests `getSharedEdges`)
- Two-zone with different heights + transitional stair (S81e primary case)
- Three-zone with multiple height transitions (tests compound cases)

Regenerate PDFs for all canonical decks after any structural change and visually diff against previously-approved outputs. Low-overhead smoke test.

---

## Session memory updates

For the next S82 session handoff, add to user memory:
- SimpleBlueprints S81e completed and live in production. Transitional stair feature working end-to-end.
- Known pre-existing issues tracked in S82_PLANNING.md, prioritized and scoped.
- Next recommended session: S82f (elevation zone heights) — cheapest, unblocks testing for other issues.

---

**End of planning doc.** Pick up by opening this file + S81F_HANDOFF.md, decide which items to tackle, proceed.
