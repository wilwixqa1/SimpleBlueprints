# SimpleBlueprints — Full Handoff (post S81)

**Last updated:** end of Session 81 (S81), main branch at commit `27b5154`.
**Purpose:** Single source of truth for picking up the project cold. A fresh developer or AI assistant should read only this file plus the latest JSX upload and be immediately productive on S81d (transitional stairs).

---

## 1. What SimpleBlueprints is

SimpleBlueprints is a permit-ready deck blueprint generator at SimpleBlueprints.xyz. The user enters lot information and deck dimensions, and the system produces a multi-page IRC-compliant permit submission package: cover sheet, site plan, framing plan, deck plan, elevations, materials list, and notes. Engine outputs are derived from IRC R301–R507 prescriptive tables. The product positions itself as a tool for DIY builders, general contractors, and architects who want a permit submission they can hand to a building official without needing a structural engineer for standard deck shapes.

The owner-developer is Will (sole developer and founder). His business partner handles community validation and marketing. Standing development priorities, in order: IRC compliance accuracy, permit-ready output quality, and incremental push-test cycles with visual verification.

## 2. Stack and architecture

**Frontend:** Single-file React JSX, transpiled in-browser via Babel standalone. There is no build step. The JSX is split across several `.js` files in `backend/static/js/` (`app.js`, `home.js`, `steps.js`, `deck3d.js`, `engine.js`, `zoneUtils.js`, `stairGeometry.js`, `planView.js`, `elevationView.js`, `sitePlanView.js`, `traceView.js`, `tracking.js`, `steelDeckData.js`). 3D rendering uses Three.js. State is held in a single `p` object in React state and threaded through props; helpers exposed on `window.*` are how non-React modules read state.

**Backend:** Python FastAPI on Railway. Drawing code lives in `backend/drawing/` (15K lines across `draw_plan.py`, `draw_elevations.py`, `draw_cover.py`, `draw_site_plan.py`, `draw_materials.py`, `draw_notes.py`, `draw_details.py`, `draw_checklist.py`, `permit_spec.py`, `permit_checker.py`, `irc_tables.py`, `irc_tables_round2.py`, `stair_utils.py`, `zone_utils.py`, `title_block.py`, `jurisdiction_sheet.py`). PDF generation currently uses ReportLab; a migration to client-side SVG capture + cairosvg is planned but gated on first paying user or marketing push.

**Repo:** `github.com/Wilwixqa1/simpleblueprints` (note: GitHub now redirects this to lowercase `wilwixqa1/SimpleBlueprints`, but pushes to the old URL still succeed). Will provides his PAT inline in chat when pushes are needed; rotate frequently. Workflow is `git remote set-url origin https://PAT@github.com/Wilwixqa1/REPO.git` then `git push origin main`. Never reference an old PAT between sessions.

**Deployment:** Railway autodeploys from main on push. There is no staging environment. The cache buster string (last value: `s80c`) lives in the JSX and should be bumped before any production-visible push.

**Environment variables in Railway:**
- `GOOGLE_SOLAR_API_KEY` — building footprint detection (replaced Overpass in S70+; `requiredQuality=MEDIUM`, 10K free calls/month)
- `REALIE_API_KEY` — parcel lookup

## 3. How Will likes to work

These are not preferences; they are rules that have been violated and corrected enough times to be operational standards.

- **No em-dashes (`--` or `—`) in prose output** — emails, drafts, conversational text. Em-dashes inside code are fine.
- **Anti-anchoring rule:** when Will pushes back on the same issue twice, stop coding, list every assumption being made, and evaluate each from scratch. This applies equally to bug diagnosis. Two failed guesses about a screenshot mean "stop and ask," not "try a third guess."
- **Never confirm a visual fix worked from text extraction or code reading alone.** Say "I can't verify the visual layout from here — does it look right to you?" and wait for confirmation. Especially in 3D, where head-on screenshots flatten perspective and hide the actual height differences.
- **30-minute bug timebox.** If a bug isn't fixed after 30 minutes of focused work, stop and reassess scope.
- **Fix PDF before frontend.** When a feature touches both, make the PDF correct first, then the frontend. Reverse order leads to two passes.
- **Think in 2D plan view first** when computing stair/deck overlap in Three.js. The 3D code gets wrong easily; 2D math is the source of truth.
- **Batch cosmetic work.** Don't burn a commit on a one-line fraction display fix. Bundle it with the next functional change.
- **Direct feedback over flattery.** Will would rather hear "this is the wrong approach" than "great question, here's how to do the wrong approach."
- **Honest technical assessment.** When something isn't done, say it isn't done. When a "fix" is actually a workaround, say so.
- **Use the full context window if needed.** Complex tasks are expected to use many tool calls and many file reads. Don't artificially shorten work to save tokens.

When stuck or uncertain about scope, ask one focused question rather than three vague ones.

## 4. Repository layout

```
simpleblueprints/
├── README.md
├── S65_CONTEXT.md … S81_CONTEXT.md   # session summaries, oldest to newest
├── S77_TEST_PLAN.md                  # test plan, sections A–D and F still TODO
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/                          # FastAPI routes, request handlers
│   ├── drawing/                      # PDF generation (15K lines Python)
│   │   ├── calc_engine.py
│   │   ├── draw_plan.py              # framing plan + deck plan
│   │   ├── draw_elevations.py        # 4 elevation views
│   │   ├── draw_cover.py
│   │   ├── draw_site_plan.py
│   │   ├── draw_materials.py
│   │   ├── draw_notes.py
│   │   ├── draw_details.py
│   │   ├── draw_checklist.py
│   │   ├── permit_spec.py            # zone_calcs, structural spec dictionary
│   │   ├── permit_checker.py         # IRC compliance audit
│   │   ├── irc_tables.py             # joist/beam/post span tables
│   │   ├── irc_tables_round2.py
│   │   ├── stair_utils.py
│   │   ├── zone_utils.py             # Python mirror of zoneUtils.js
│   │   ├── jurisdiction/             # per-jurisdiction overlays
│   │   ├── jurisdiction_sheet.py
│   │   └── title_block.py
│   └── static/
│       └── js/                       # 12K lines JSX (in-browser Babel)
│           ├── app.js                # state + routing
│           ├── home.js               # landing UI
│           ├── steps.js              # 4752 lines, the wizard UI (incl. zone properties panel)
│           ├── deck3d.js             # 1191 lines, Three.js renderer
│           ├── engine.js             # 1045 lines, structural calc
│           ├── zoneUtils.js          # 556 lines, zone geometry + S81 helpers
│           ├── stairGeometry.js      # 167 lines, stair math (known bugs)
│           ├── planView.js           # 2D plan SVG
│           ├── elevationView.js      # 2D elevation SVG
│           ├── sitePlanView.js       # site plan SVG
│           ├── traceView.js          # Phase 2 trace feature (deferred)
│           ├── steelDeckData.js      # CCRR-0313 Fortress Evolution tables
│           └── tracking.js
└── tests/
```

## 5. Data model — the `p` object

`p` is the React state object. Key fields you need to know:

```javascript
{
  // Geometry
  deckWidth, deckDepth, deckHeight,    // ft, the main deck (zone 0)
  attachment,                          // 'ledger' | 'freestanding'
  joistDir,                            // 'perpendicular' | 'parallel'
  joistSpacing,                        // 12 | 16 | 24 (inches o.c.)
  beamType,                            // 'dropped' | 'flush' (zone 0 only)
  deckingType, frostZone, snowLoad,
  slopePercent, slopeDirection,

  // Zones (S60+)
  zones: [
    {
      id, type,                        // 'add' | 'cutout', id never reused
      w, d, h,                         // h: ft override or null
      attachTo, attachEdge,            // parent id, 'front'|'left'|'right'|'interior'
      attachOffset, interiorY,
      corners,                         // chamfer config per corner
      joistDir,
      beamType,                        // 'flush' | 'dropped' (validated by S81a)
      stairs,                          // {template, location, ...} or null
      label                            // user-editable, S80b
    }
  ],
  activeZone,                          // currently selected zone id (0 = main)

  // Lot + house (S70+)
  parcel, houseRect, houseAngle,       // houseAngle is ALWAYS 0 (S78 rule)
  lotPolygon, lotRotation,             // derived from polygon edge, not Overpass

  // Stairs (legacy single-zone path)
  stairTemplate, stairLocation,
  hasStairs, deckStairs,

  // Misc
  warnings, costEstimate
}
```

The state holds the user's intent. Derived geometry — composite outline, exposed edges, shared edges, stair footprints — is computed by helpers in `zoneUtils.js`, never stored.

## 6. Key derived helpers in `zoneUtils.js`

All exposed on `window.*` for non-React consumers (deck3d, engine, plan view).

| Helper | Purpose | Returns |
|---|---|---|
| `getZone0(p)` | Virtual main deck zone | `{id:0, type:'add', w, d, h:null, ...}` |
| `getAllZones(p)` | Main deck + all user zones | `[zone, ...]` |
| `getZoneById(id, p)` | Lookup by id | `zone` or `null` |
| `getZoneRect(id, p)` | Deck-local rect for any zone | `{x, y, w, d}` |
| `getAllZoneRects(p)` | All rects with `{id, zone, rect}` | array |
| `getAdditiveRects(p)` | Filter to non-cutout | array |
| `getCutoutRects(p)` | Filter to cutouts | array |
| `getBoundingBox(p)` | Composite bbox | `{x, y, w, d}` |
| `getCompositeOutline(p)` | Boolean union of adds minus cuts, grid-based | array of rects |
| `getExposedEdges(p)` | Outer perimeter segments | array (used by rail loop) |
| `getAddableEdges(p)` | Where the user can add a new zone | array |
| `validateZone(zone, p)` | Geometry validation | `{valid, msg}` |
| `addZoneDefaults(parentId, edge, type, p)` | Smart defaults for new zone | zone object |
| `buildZoneCalcParams(zone, p)` | Per-zone params for engine | `p`-shaped object |
| **`getEffectiveBeamType(zone, p)`** | **S81a:** flush auto-converts to dropped when `zone.h !== mainH` | `'flush'` or `'dropped'` |
| **`getSharedEdges(p)`** | **S81b:** internal edges between adjacent zones | array of edge segments |
| **`classifyHeightDelta(deltaIn)`** | **S81b:** IRC bucket | `'flush'`, `'tripping'`, `'single-step'`, `'multi-step'`, `'guarded'`, `'over-max'` |
| **`suggestRiserPlan(deltaIn)`** | **S81b:** uniform risers + flag flags | `{nRisers, riserHeightIn, needsGuard, needsHandrail, needsLanding, classification, irc}` |

### `getSharedEdges` output shape

```javascript
{
  aId, bId,           // zone ids (0 = main deck)
  aH, bH,             // heights in feet
  deltaIn,            // |aH - bH| * 12, rounded to 0.01"
  axis,               // 'vertical' (constant x) | 'horizontal' (constant y)
  x1, y1, x2, y2,     // deck-local coordinates of segment endpoints
  length              // segment length in feet
}
```

### IRC threshold table (single source of truth, in `classifyHeightDelta`)

| Range | Class | IRC | Action |
|---|---|---|---|
| `< 0.5"` | `flush` | — | nothing |
| `0.5"–4"` | `tripping` | R311.7.5.1 | warn red, no compliant single step |
| `4"–7.75"` | `single-step` | R311.7.5.1 | one riser, no handrail |
| `7.75"–30"` | `multi-step` | R311.7.5.1 | uniform risers, no guard |
| `30"–147"` | `guarded` | R312.1.1 | uniform risers + guard on higher side |
| `≥ 147"` | `over-max` | R311.7.3 | intermediate landing required, not yet supported |

`needsHandrail` triggers at 4+ risers (R311.7.8). **Never hardcode these numbers anywhere else** — funnel through these helpers.

## 7. Engine: `calcAllZones` and material takeoff

`engine.js` has two main flows:

1. **Single-zone calc** (`calcStructure(p)`) — legacy path, runs when `p.zones.length === 0`. Returns `{joistSize, beamSize, postSize, nP, pp, postHeights, fDiam, fDepth, ...}`.

2. **Multi-zone calc** (`calcAllZones(p, baseCalc)`) — runs after `calcStructure` for the main deck, then adds extras for each zone. For each zone, it determines `zoneBeamType` via `getEffectiveBeamType` (S81a). Flush zones generate joists, rim joists, decking, hangers, and railing only — no posts or footings or beam. Dropped zones generate posts, footings, sonotubes, post bases, post caps, beam, joists, rim joists, decking, and railing.

Each zone produces a `zoneCalcs[i]` entry:
```javascript
{
  joistSize: "2x8",
  beamSize: "2-ply 2x8" | "rim",   // "rim" for flush
  beamSpan,
  jSpan,
  fDiam, nPosts,                    // 0 for flush
  beamType                          // matches getEffectiveBeamType output
}
```

Known gap: post material cost in `extraItems` is flat per-post (`$48` for 6x6), not per linear foot. An 11ft post for an elevated zone costs the same as a 4ft post. Will mentioned this; not yet fixed.

## 8. 3D rendering: `deck3d.js`

The Three.js renderer is one large `useEffect` keyed on the entire `p` object. Render order:

1. Build `addRects` from `getAdditiveRects(p)`
2. Build `composite` from `getCompositeOutline(p)` and exposed edges from `getExposedEdges(p)`
3. Set up materials, ground plane, house mesh
4. **Per-zone structure:** for each zone in `addRects`, render piers, posts, beam, ledger, joists, rim joists. Zone 0 uses the legacy path (variable post heights from `c.postHeights`, slope drop, stair gap clipping). Zones 1+ use a simplified path (corner posts + intermediate every ~6ft, flush skips posts/beam, joists span depth).
5. **`_zoneHeightRects` array:** built from `addRects`, each entry `{xMin, xMax, zMin, zMax, h}` in world coords. Iterated in reverse so child zones (later in array) take priority over parents.
6. **`getHeightAtPoint(wx, wz)`** — single source of truth for "what's the deck-top elevation at this world point." Used by deck boards, railing top/bottom, balusters, and rail posts.
7. **Deck boards** via `addDeckBoard()` which uses `getHeightAtPoint` to set Y.
8. **Railing** via `addRail(x1,z1,x2,z2)` and `addRailPost(x,z)`. Both call `getHeightAtPoint` at the segment midpoint or post position.
9. **Rail loop** walks `exposedEdges` and renders rail along each, with stair gap clipping for front/left/right and special-walk-out-bay logic.
10. **Corner posts** at composite outline corners (skipping chamfers and stair footprints).
11. **Stair geometry** from `stairGeometry.js` — known landmines, see section 10.

The S81c auto-guard rendering (reverted) was inserted between step 10 and the closing `} else {` of the multi-zone branch. Code is preserved at git commit `f057d1d` for reference.

## 9. Standing critical rules across all sessions

Distilled from S60–S81. These are non-negotiable architectural constraints:

- **Lot rotation is derived from polygon edge, not Overpass.** Overpass is enrichment-only.
- **Never push the house to a lot edge.** Center if uncertain.
- **Dimensions are sacred, position is flexible.** When in doubt, preserve dimensions and shift position.
- **`houseAngle` is always 0.** Hard rule from S78. Any code that reads it should treat it as a constant.
- **Solar API is the sole building data source.** No fallbacks to Overpass for the building footprint.
- **Loading overlay must be fully opaque.** Translucent loading overlays are a known UX failure mode.
- **Every exit path in the building footprint callback must set loading and confidence flags.** Missing any path leaves the UI stuck.
- **Secondary structure point-in-polygon checks must use unrotated vertices.**
- **Use CCRR-0313 tables as the single source of truth for steel span data** (Fortress Evolution).
- **Match Welborn's labeling convention exactly for PDF output.** Welborn is the reference permit set.
- **Steel posts must NOT be buried.**
- **Per-zone `beamType` is independent.** Each zone stores its own. Global `p.beamType` is for zone 0 only.
- **Flush beam = rim board as beam.** No posts, no piers, no separate beam line.
- **Flush beam is invalid when `zone.h !== mainH`.** Funneled through `getEffectiveBeamType()`. (S81a)
- **Smart defaults:** zones < 80 sqft or depth < 6 ft default to flush.
- **`zone.h = null` means inherit main deck.** 3D renders per-zone height. PDF elevations don't yet.
- **`getHeightAtPoint()` is the single source of truth** for mapping world coords to deck-top in 3D.
- **`getSharedEdges()` is the single source of truth** for "find internal zone boundaries." (S81b)
- **`classifyHeightDelta` and `suggestRiserPlan` own all IRC riser/guard thresholds.** No hardcoded 4", 7.75", 30", or 147" anywhere else. (S81b)
- **Traversal before guards.** Never auto-add railing on an internal shared edge until a transitional stair exists to clip against. (S81 reverted lesson)
- **Anti-anchoring rule** applies to bug diagnosis as well as code edits.
- **Never confirm visual fixes from text extraction alone.**

## 10. Known landmines for stair work

The S81d transitional stair work will touch `stairGeometry.js` (167 lines) and the stair rendering paths in `deck3d.js` and `draw_plan.py`. Carry these forward as risks:

1. **Stair arrow direction bug** (Billy's report from S80) — unresolved. Two suspect causes: (a) `downDir` doesn't account for stair rotation, (b) stored `angle` value creates different rotation in 2D vs 3D coordinate systems. Don't touch the arrow code unless you have to. Pending Billy's project config data.
2. **U-Turn / Wrap 3D bugs** deferred from S15 — likely causes: `downDir="-y"` stringer rotation sign, handrail shortening on `run2`, `stairGap` offset drift, landing elevation assumption mismatch.
3. **Stair geometry currently assumes landing is at grade.** Adding a `toH` parameter as a new code path (not refactoring existing grade stairs) is the lowest-risk path for transitional stairs.
4. **`stair_utils.py`** is the Python mirror — any schema change must be replicated there for PDF output to stay correct.

## 11. Active known issues across the codebase

- Stair arrow direction bug (Billy, deferred)
- U-Turn/Wrap 3D rendering bugs (S15 deferred)
- Flush beam joist span IRC validation missing (warn if zone joists exceed prescriptive table)
- Zone post material cost is flat per-post, should be per linear foot (S81 noted, not fixed)
- Zone `joistDir` schema exists but `compute_zone_framing()` ignores it (S80 deferred)
- Per-edge railing control missing (S83)
- Back-edge zones, zone-to-zone attachment missing (S83)
- "Not occupiable" zone flag for architects (S83)
- PDF elevation views still draw all zones at main deck height (S82, blocking)
- Centroid Y offset bug — house too close to street in site plan (S78 deferred)
- Rotation context object is fragile closure-based, refactor pending
- S77 Test Plan Sections A–D and F not yet executed
- PDF migration to client SVG capture + cairosvg gated on first paying user or marketing push
- Phase 2 trace feature is low priority

## 12. Where Session 81 left off

**Shipped on main:**
- **S81a (`f095f4a`)** — Flush beam auto-converts to dropped when `zone.h !== mainH`. New `getEffectiveBeamType()` helper. Engine, 3D, and steps.js toggle UI all consume it. Fixes the "floating zone" bug from Billy-style feedback where flush beam zones at mismatched heights had no posts.
- **S81b (`9a6355e`)** — Shared edge detection + IRC traversal warnings. New helpers `getSharedEdges()`, `classifyHeightDelta()`, `suggestRiserPlan()`. Yellow warning panel in zone properties surfaces R311.7.5.1, R311.7.8, R312.1.1, R311.7.3 with specific code references. Detection-only, no rendering changes.
- **S81c-fix (`c029972`)** — Cosmetic fraction display: `2" 3/8` instead of `2" 6/16`.
- **S81 context (`27b5154`)** — Session summary file `S81_CONTEXT.md`.

**Reverted:**
- **S81c (`f057d1d`, reverted by `bf4f2c8`)** — Auto-rendered guard rails on shared edges with delta ≥ 30". Code was IRC-compliant but sealed off elevated zones with no entry, because no transitional stair existed yet to break up the rail. The lesson "traversal before guards" was added to the standing rules. The S81c code is preserved in git history and should be brought back in **S81c-v2** after S81d/e ship transitional stairs.

**Active screenshot context (Will's test setup):** main deck at 4', Zone 1 at 7'-6" attached to one side, Zone 2 at 9'-6" attached to the other. Both zones currently render correctly with posts to grade and dropped beams (S81a fix). The warning panel correctly surfaces "Stair required: 6 risers @ 7.00". Guard required on the higher side (R312.1.1, drop > 30"). Handrail required (4+ risers, R311.7.8)." The 3D view shows the zones elevated with no rail or stair on the shared internal edges — the known unresolved state.

## 13. Roadmap from here

**S81d (next session, start here):** Transitional stair schema + engine.
- Extend `zone.stairs` schema with `landingType: "grade" | "zone"` and `landingZoneId`
- Backwards-compatible defaults so existing grade stairs keep working unchanged
- New code path in `engine.js` for stair material takeoff when landing on a zone (no concrete pad)
- Total rise computed from `|fromZone.h - toZone.h|`
- Mirror schema change in `backend/drawing/stair_utils.py`
- Riser count and uniform riser height from `suggestRiserPlan(deltaIn * 12)`
- No 3D or PDF rendering yet — that's S81e

**S81e:** Transitional stair 3D + plan + UI.
- New code path in `deck3d.js` rendering stair bottom at `toZone.h`, not 0
- New code path in `draw_plan.py` for the stair footprint and arrow on a shared edge
- "Add transitional stair" button in the warning panel that picks defaults from `suggestRiserPlan()`
- Verify no collision with `stairGeometry.js` known bugs

**S81c-v2:** Bring back auto-guard rails on >30" shared edges, gated on stair-footprint clipping working correctly. Code preserved at `f057d1d`. The clip-around-stair logic was already in the reverted S81c, so the bring-back is mostly a re-cherry-pick once S81d/e ship.

**S81f:** Permit checker integration in `permit_checker.py`.
- R311.7.5.1 tripping flag for any unmitigated 0.5"–4" delta
- R311.7.3 over-max landing flag for any delta ≥ 147"
- R312.1.1 unguarded edge flag for any delta ≥ 30" without an existing rail
- R311.7.8 handrail flag for any stair with 4+ risers and no handrail

**S82 (still deferred from S80):** PDF elevations rendering per-zone heights.
- `draw_elevations.py` currently draws everything at main deck H
- Zone beams, posts, dimensions need to render at zone height
- Railing at height transitions in elevation drawings
- Stair height recalc for stairs landing on zones with different heights (overlaps with S81d)

**S83 (architect features):**
- Per-edge railing control
- Back-edge zones, zone-to-zone attachment
- "Not occupiable" zone flag for planter ledges
- Stair height recalc when stair lands on a zone with different height (if not already covered by S81d)

## 14. Session start checklist

Before doing any work in a new session:

1. **Verify the latest JSX is uploaded.** Will normally uploads the current `steps.js` and any other actively-edited files at the start of each session.
2. **Read the latest session context file** (`S81_CONTEXT.md` for the next session). It's the diff over this handoff.
3. **Clone or sync the repo** so you have all the source files locally:
   ```
   git clone https://PAT@github.com/Wilwixqa1/simpleblueprints.git
   ```
4. **Confirm scope with Will** before starting any code. Even when scope feels obvious, verify it. Past sessions have lost time to assumptions.
5. **Read the files you're about to touch** before editing. Especially `stairGeometry.js`, `deck3d.js`, and `engine.js calcAllZones` for S81d.
6. **Bump the cache buster** in the JSX before the final push of the session if anything visible to users changed.
7. **Remind Will to rotate the PAT** at session end.

## 15. Standing reference: prior session context files

These exist in the repo root. Each is a session summary, not a full handoff. Read in order if you need deep history on a specific subsystem:

- `S65_CONTEXT.md` — Realie API parcel lookup
- `S70_CONTEXT.md` — Solar API building detection
- `S72_CONTEXT.md`, `S73_CONTEXT.md` — Lot rotation
- `S75_CONTEXT.md`, `S76_CONTEXT.md` — Compliance audit infrastructure
- `S77_CONTEXT.md`, `S77_TEST_PLAN.md` — Test plan (sections A–D and F still TODO)
- `S78_CONTEXT.md` — `houseAngle = 0` rule, secondary structure fixes
- `S79_CONTEXT.md` — Steel framing CCRR-0313 phases
- `S80_CONTEXT.md` — Per-zone beam type, editable labels, per-zone height in 3D
- `S81_CONTEXT.md` — This session: flush validation, edge detection, IRC warnings, reverted auto-guard
- Earlier: `s51_context.md`, `s62_context.md`, `s63_context.md`, `s64_context.md` (note lowercase `s`)

---

**End of handoff. Read `S81_CONTEXT.md` next for the most recent diff.**
