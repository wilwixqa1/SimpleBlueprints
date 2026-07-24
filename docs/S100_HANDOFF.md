# S100 HANDOFF (3D stair opening + stair support + materials catalog)

Repo: github.com/wilwixqa1/SimpleBlueprints (public) - main @ c8e67a7 - CI green.
S100 theme: the P0-3D "stairs clip through the deck" bug, which unravelled into a
structural finding about post placement, and a materials catalog pass.

READ SECTION 0 FIRST. It is the setup that every session needs and that S100
wasted time rediscovering.

---

## 0. SESSION START WORKFLOW (do this before anything else)

### 0.1 Clone and install

```bash
cd /home/claude
git clone --depth 50 https://github.com/wilwixqa1/SimpleBlueprints.git
cd SimpleBlueprints
pip install -q --break-system-packages -r backend/requirements.txt
pip install -q --break-system-packages reportlab pypdf        # if not in requirements
```

Node is present; no npm install needed for the test suite. For the babel syntax
check (section 0.4) you need `@babel/standalone@7.23.9` in a scratch dir:

```bash
mkdir -p /tmp/babelchk && cd /tmp/babelchk
npm install --silent @babel/standalone@7.23.9
```

### 0.2 Set git identity (this container has none)

```bash
git config user.email "will@simpleblueprints.xyz"
git config user.name "Will Wendt"
```

Needed for commits AND for completing a stopped rebase. If a rebase stalls, the
S99 tip still applies: `GIT_EDITOR=true` plus `git commit -C <orig-sha>`.

### 0.3 RUN THE FULL GATE BEFORE TOUCHING ANYTHING

Establish that main is green before you change it, so any later failure is
provably yours.

```bash
SBP_SHEET=arch_d python3 tests/pdf/golden_structural.py    # 20 sheet fingerprints
python3 tests/test_frontend_parity.py                       # JS <-> Python parity
SBP_SHEET=arch_d python3 tests/pdf/config_matrix.py         # 18 configs, B3/G11
python3 tests/test_structural.py                            # IRC known-answer
python3 tests/test_post_grade.py
python3 tests/test_beam_layout.py
python3 tests/test_notch_posts.py
python3 tests/test_stair_support.py                         # NEW in S100
node  tests/test_stair_footprint.js                         # NEW in S100
node  tests/geometry/lotGeometry.test.js                    # 2769 checks
```

**GATE CORRECTION, still in force since S98:** the golden test MUST be invoked as
`SBP_SHEET=arch_d`. Run bare it fails with everything scaled by 2.571 (36/14).
That failure signature means wrong sheet size, NOT a regression.

`estimate_materials` signature is `(params, calc)` and it returns a dict with an
`"items"` key. S100 got this backwards twice; it is `estimate_materials(p, calculate_structure(p))["items"]`.

To build params for a test call, borrow the matrix helper rather than hand-rolling
a dict (calculate_structure needs many keys: width/depth/height/joistSpacing/
species/snowLoad/...):

```python
import sys; sys.path.insert(0,'backend'); sys.path.insert(0,'tests/pdf')
from config_matrix import _base, _main_post_xy
from app.main import calculate_structure
p = _base(width=40, depth=12, height=4, attachment='ledger', hasStairs=True,
          stairTemplate='straight', stairWidth=4, stairLocation='front', stairOffset=0)
c = calculate_structure(p)
```

### 0.4 JS syntax check (production babel is old)

The site loads JS through babel 7.23.9. Node parses things that babel rejects, so
ALWAYS verify edited JS through babel before pushing:

```bash
cd /tmp/babelchk && node -e "
const babel=require('@babel/standalone');const fs=require('fs');
['deck3d.js','zoneUtils.js','engine.js'].forEach(f=>{
  const p='/home/claude/SimpleBlueprints/backend/static/js/'+f;
  try{babel.transform(fs.readFileSync(p,'utf8'),{presets:['react']});console.log('OK   '+f);}
  catch(e){console.log('FAIL '+f+': '+e.message);}});"
```

### 0.5 PAT PUSH WORKFLOW

Will pastes a PAT in chat when a push is needed. It is his solo public repo, no
financials, no sensitive user data, and he generates tokens fresh per session. He
has assessed the exposure and accepts it. **Note it at most once, briefly, then
drop it and push.** No repeating within a session, no lecturing, no re-raising
after he has answered. If he says "noted, use it," push immediately with no
further comment. S100 violated this three times and it cost real session time and
goodwill.

Mechanics - one-shot URL, never written to a file or `.git/config`:

```bash
git fetch -q origin main
git rev-list --count HEAD..origin/main          # confirm 0 before pushing
git push "https://<PAT>@github.com/wilwixqa1/SimpleBlueprints.git" main
git remote set-url origin https://github.com/wilwixqa1/SimpleBlueprints.git
grep -rl "<PAT>" . | head                        # sweep: must return nothing
```

Repo redirects Wilwixqa1 -> wilwixqa1 (lowercase); push succeeds either way.
Tell Will to rotate at session end.

### 0.6 Push discipline

- ONE push at a time, with visual confirmation from Will before the next.
- Read files before editing them. Never guess a variable name - S100 wrote
  `bdH` and `jointDepthFt` into deck3d.js and neither existed.
- Never confirm a visual fix from text extraction alone.
- Bump busters on every frontend change (section 4).
- Every push gets a backout line in the commit message.

---

## 1. WHAT SHIPPED (newest first)

| SHA | What |
|-----|------|
| c8e67a7 | Push 15: materials catalog sharpened with real Simpson part numbers from the reference sets, BOTH engine.js and draw_materials.py. Hurricane ties split from a qty-1 dollar lump into `Hurricane Ties (Simpson H2.5)` qty nJ + a separate nail box line. Post bases -> ABU66Z/ABU44Z, joist hangers -> LUS210/LUS26 keyed off joist size, landing post bases -> ABU44Z flat 28. **NEW LINE: post caps (BCS2-3/6 or BCS2-2/4), which were missing from the estimate entirely** - every real build buys one per post, so quotes were under. Also fixed a pre-existing JS/Python drift where one of three JS landing-post-base sites used cost 35. engine.js buster s99a -> s100k |
| cc41d3d | Push 14: rewrote stair_support.py against the three approved Rutstein sets. Support keys off the LANDING, not the stair: runs-to-grade gets NO posts (pad + PT plate for wood, stringer brackets for steel), an elevated landing gets four corner posts (4x4 PT, ABU44Z base, BCS2-2/4 cap, 20" pier). Landings wider than 8.5ft get intermediate posts rather than an engineering flag. NOT WIRED INTO DRAWING |
| 9b01984 | Push 13: first stair_support.py - a two-post + header assembly built from Guertin's FHB article. **Superseded by push 14; the header detail was wrong** (that article is a retrofit for an existing under-built deck, not new-construction permit drawing) |
| f07136e | Push 12: headroom rule. A stair part needs an opening when clear height to the underside of framing is < 80in (IRC R311.7.2), not merely when it sits at deck level. Push 11 had excluded the L-Left landing as "below deck", leaving decking 33in over a platform you stand on |
| d772674 | Push 11: elevation-aware footprint. stairFootprintRects stamps topEl/botEl per run and landing; parts that have descended below the framing pass underneath. Fixed the over-wide cut (5.80ft -> 4.00ft on an inset L-Left) |
| bc42dcf | Push 10: THE P0-3D FIX. deck3d derived the deck cut from `runs[0]` only. For a STRAIGHT stair runs[0] IS the whole stair, which is exactly why straight stairs always looked right. Every other template has landings and later runs the cut never saw, so the stair and its railing passed through solid decking. New shared helpers in zoneUtils (stairFootprintRects / clipRectsTo / unionSpan) return the union of ALL parts clipped to the deck plane |

Golden unchanged on every push in this session. Permit sheets provably untouched.

---

## 2. THE BIG FINDING (unresolved, needs Billy - START HERE NEXT SESSION)

**A deck post can stand in the middle of the stairway, in the 3D AND on the permit set.**

Measured: on a 40ft deck with a centered 4ft straight stair, `_legacy_posts` puts
a post at x=20.0 and the stair occupies x[18,22]. **41 of 72 sampled straight-stair
configs have a post inside the stair opening.** That is the product's default
configuration - straight stair, front edge, zero offset.

Reproduce:

```python
import sys; sys.path.insert(0,'backend'); sys.path.insert(0,'tests/pdf')
from config_matrix import _base, _main_post_xy
from app.main import calculate_structure
p = _base(width=40, depth=12, height=4, attachment='ledger', hasStairs=True,
          stairTemplate='straight', stairWidth=4, stairLocation='front', stairOffset=0)
c = calculate_structure(p)
print([ (round(x,2),round(y,2)) for x,y in _main_post_xy(c,p) ])
# -> [(2.0,10.5),(11.0,10.5),(20.0,10.5),(29.0,10.5),(38.0,10.5)]
# stair occupies x[18,22]; the post at 20.0 is dead centre of it
```

Why the existing B3/G11 matrix check does NOT catch it: `check_post_in_landing`
only tests LANDING rects, and a straight stair has no landing. The most common
collision in the product is invisible to the check that exists for it.

### What the reference sets say about it

**Nothing directly, and that is itself the finding.** Rick's post spacing is the
SAME as ours - Loucks is a 13ft deck with 3 posts and two 5'-1" spans, i.e. a
centre post at ~6.5ft, exactly where our engine puts one on a 13ft deck. He does
not move or remove it. **He puts the stair somewhere else.** In all three sets the
stairs sit at deck ends or off corners, never in front of a mid-span post.

So the conflict is a configuration Rick's plans never contain. Our product allows
it because the stair is freely placeable and the posts are evenly spaced, and the
two systems do not talk to each other.

### Three options, none yet chosen

1. **Move the post.** Span arithmetic works: `beam_max_span` is 11.0 on that deck
   and current spans are 9.0, so there is 2ft of slack. Posts at 2,13,22.5,30,38
   clears the opening at max span 11.0 (no margin), or 6 posts at 2,9,16,24,31,38
   gives max span 8.0 (comfortable, one extra post + footing ~$50-80). **No
   reference support - Rick never does this.**
2. **Move the stair** off the post. What all three sets effectively do, but it
   means overriding the user's placement.
3. **Surface the conflict** and let the user slide the stair or accept a post shift.

**The machinery for option 1 already exists and is proven.** Feeding a
stair-derived rect into the existing notch pipeline produces the right answer:

```python
from drawing.beam_layout import notch_headers, compute_beam_layout
stair_rect = [{'rect': {'x':18.0,'y':9.0,'w':4.0,'d':3.0}}]
notch_headers(40, 12, stair_rect)
# -> [{'x0':18.0,'x1':22.0,'y':9.0}]          doubled header, correct
compute_beam_layout(40, 12, stair_rect, 5, 1.5, max_beam_span=11.0)
# -> stepped: True, 3 segments,
#    posts [(2,10.5),(9,10.5),(16,10.5),(20,7.5),(24,10.5),(31,10.5),(38,10.5)]
#    the post at x=20 moved BEHIND the opening to y=7.5. None inside the opening.
```

The only missing link is that `get_cutout_rects` reads `params["zones"]` and
filters `type == "cutout"` - **user-drawn zones only. Stair geometry never enters.**
So `compute_beam_layout` and `notch_headers` receive an empty list for a stair
opening and take the flat path.

Note also `notch_headers` only fires for a FRONT-REACHING cutout
(`r["y"] + r["d"] >= depth - EPS`). An L-Left stair opening always reaches the rim
(measured: strip beyond the opening is 0.00ft at every inset), so it qualifies as a
notch geometrically. A truly interior opening (not touching the rim) would need a
second header on the yard side - not yet handled, and no reference example exists.

**Do not ship any of the three options without Billy.** This changes the permit
set. Golden WILL change, deliberately, and each fingerprint delta must be reviewed
rather than blanket re-baselined.

---

## 3. WHAT S100 ACTUALLY FIXED, AND WHAT IT DID NOT

Be honest with Will about this - he asked twice and the answer was muddled.

**Fixed and visible:**
- Stairs and railings no longer clip through the deck (pushes 10-12). Confirmed by
  Will's screenshots: the hole appears, the landing area opened.
- Materials catalog now names real parts and includes post caps (push 15).

**Built but invisible:**
- `stair_support.py` (pushes 13-14). Computes landing posts and grade-pad specs.
  **Nothing draws it.** Screenshots look identical before and after.

**NOT fixed:**
- The post in the stairway. Still there in every screenshot Will has sent.

---

## 4. CACHE BUSTERS (all currently s100k)

- `engine.js` - own tag, line 71 of index.html. `?v=s100k`
- `zoneUtils.js` - own tag, line 73. `?v=s100k`
- Shared loader `var v = "v=s100k"`, line 112 - covers deck3d.js, planView.js and
  the rest of the dynamically loaded modules.

Any edit to engine.js or zoneUtils.js needs ITS OWN tag bumped. Any edit to
deck3d.js needs the shared `v` bumped. When in doubt bump all three; they are
currently in sync, which is convenient and worth preserving.

---

## 5. NEW MODULES AND TESTS FROM S100

### `backend/drawing/stair_support.py` (pure, no I/O)
Stair support detailing derived from the approved sets. Key API:

- `compute_stair_support(wax, way, angle, stair_width, geometry, total_rise, deck_height, framing_type)`
  returns `{kind, grade_pad, landings[], hardware[], reaction_lb, needs_engineer, reason}`.
  `kind` is `"grade_pad"` (no posts) or `"elevated_landing"` (four corner posts).
- `compute_all_stair_supports(resolved_stairs, deck_height, framing_type)` - maps
  `resolve_all_stairs()` output; skips transitional stairs.
- `landing_post_xy(supports)` - flat list of (x,y) landing post centres.

`reaction_lb` is reported for traceability and threshold checks but sizes NOTHING
that gets printed. Every printed callout traces to a reference set.

### `tests/test_stair_support.py` (10 sections, in CI)
Straight-to-grade adds zero posts across 6 rises x 3 widths x 4 rotations; no
"header" key anywhere in the output; elevated landings get >=4 posts with the
exact Loucks hardware strings; posts lie on landing edges and inside bounds; steel
path uses brackets and no Simpson wood hardware; rotation keeps posts distinct;
reaction monotonic; routine configs never flagged; boundary triggers; transitional
skipped; empty input safe.

### `tests/test_stair_footprint.js` (6 sections, in CI)
Locks the P0-3D fix. Straight-stair invariant (union == runs[0], 375 configs);
edge-anchored no-cut; previously-clipping configs now cut; union stays tighter
than bbox (the S81e over-cut guard); rotation preserves area; headroom rule.

### zoneUtils.js additions (frontend, shared)
`stairFootprintRects(sg, wax, waz, angle)` - all runs+landings in world space with
`topEl`/`botEl`/`part` stamped. `clipRectsTo(rects, ...)` - preserves that metadata
(it silently dropped it in the first revision, causing a crash). `unionSpan(rects)`.
`stairPartsNeedingOpening(rects, frameDepthFt, headroomFt)` - the headroom filter.

---

## 6. LEARNINGS FROM THIS SESSION (expensive ones)

1. **GREP BEFORE CLAIMING SOMETHING IS MISSING.** S100 declared headers, trimmers
   and beam-around-opening a "missing structural concept" needing a multi-session
   rebuild, then designed a 7-step plan on it. All of it had existed since S89/S96
   (`notch_headers` in beam_layout.py, doubled headers and doubled joists drawn in
   draw_plan.py). Will pushed back three times before it was checked. The S97 rule
   already said this: every claim has at least one wrong thing in it, verify by
   grep before building on it.

2. **CHECK THE REFERENCE SETS BEFORE INVENTING A DETAIL.** Push 13 built a
   two-post + header assembly from a magazine article. The three approved sets
   contain no such detail - the article is a RETROFIT for an existing under-built
   deck. Push 14 threw it away. The sets are in `docs/reference_sets/` and both
   have text layers: `pdftotext -layout <file> - | grep -i "stair\|post\|header"`.

3. **TEST FIXTURES CAN HIDE THE COMMON CASE.** The first sweep tested only
   edge-anchored stairs and concluded "only wrapAround is broken." Will said the
   problem showed up on "pretty much every stair other than straight." Sweeping
   interior anchors too showed 4 more templates broken. Later, the same shape of
   mistake: `config_matrix`'s B3/G11 check passed 18/18 while the default straight
   stair had a post through it, because that check only looks at landing rects.

4. **DON'T LET RESEARCH DISPLACE THE FIX.** Will proposed moving the post in his
   first sentence on the topic. S100 turned it into a research project (GC
   practice, IRC, three reference sets) and never shipped the fix. The research
   was useful and corrected two wrong turns, but the asked-for change is still
   undone.

5. **READ THE USER'S WORDS LITERALLY.** Will wrote "we are back to having the deck
   over the landing area which we should have" meaning *should NOT have*; S100 read
   it as approval and called a broken thing correct. When a report is ambiguous,
   ask - do not confirm.

6. **NEVER GUESS A VARIABLE NAME.** `bdH` and `jointDepthFt` were written into
   deck3d.js; neither existed. `jH2` (9.25/12) is the real joist depth and it is
   declared AFTER the edit site, so it would have hoisted as undefined rather than
   erroring. Compute constants locally when scope is uncertain.

7. **The straight stair is the oracle.** Anything that changes straight-stair
   behaviour is almost certainly wrong. `union == runs[0]` for straight stairs is
   asserted over 375 configs precisely so this is caught mechanically.

---

## 7. REFERENCE SETS (docs/reference_sets/, both have text layers)

Ground truth for what a reviewer accepts. Rick Rutstein / All Things Architecture.

| | Ilaria | Loucks | Welborn |
|---|---|---|---|
| Framing | wood | wood | steel (Fortress Evolution) |
| Deck | 6x6 PT posts, ABU66Z base, BCS2-3/6 cap, 21" piers x 30" | 13x17, 6x6 PT, ABU66Z, BCS2-3/6, 20" piers x 30", (3) PLCS | 3.5"x3.5" steel posts, existing piers |
| Stair | straight to grade, 2x12 stringer @16" | switchback + elevated landing, 2x14 stringer @16" | straight to grade |
| Stair support | **NONE** - stringer notched for PT plate on MIN 4" THICK concrete landing, 12" MIN | **landing on its own 4x4 PT posts, ABU44Z base, BCS2-2/4 cap, 12" piers x 30", (4) PLCS** | **NONE** - Stair Stringer Anchor Bracket, Stair Strap |
| Hangers | LUS210 @ each end, LUC106 Z @ corners | LUS210/LUS26, LUC106 Z/LUC66 Z | Fortress brackets |
| Ties | H2.5 ea. joist to beam below | H2.5 ea. joist to beam below | n/a |
| Loads | | L.L. 60 psf w/ snow, D.L. 15, T.L. 75, ledger 66 | same |

Welborn is the third set, uploaded during S100, currently only in chat - **ask Will
to add `Welborn_02-28-26.pdf` to `docs/reference_sets/`** so future sessions have it.

---

## 8. THE OTHER STRUCTURAL FINDING (real, unaddressed)

`calc_engine` sizes beams and footings from `design_load = max(40, snow_load)` -
**uniform load only. Stair stringer load has never entered beam or footing sizing.**

This is inherited from the IRC rather than a local bug: the span tables cover only
uniform load on the deck surface and the code has no prescriptive table for framing
that carries stairs (Mike Guertin, FHB #322 - too many variables). Guertin's
estimate is that 99% of existing stair-to-frame assemblies would not pass an
engineering review.

`stair_support.py` computes a `reaction_lb` for traceability, but nothing consumes
it structurally. Whether it should is a Billy question (section 9, Q4).

---

## 9. QUESTIONS FOR BILLY (email drafted, Will sends)

1. Straight stair to grade - do you ever add support under it, or is the pad and
   notched stringer really all there is?
2. Elevated landing - is 4x4 your normal? It looks light next to the 6x6 deck
   posts, but that is what the Loucks plan shows.
3. A deck post landing inside a stairway - do you move the post, move the stair, or
   something else? (Rick's plans avoid the situation rather than solve it.)
4. Does an inspector ever ask about stair loading on the deck frame, or is the pad
   and bracket detail enough in practice?
5. S99 carryover, still unanswered: gut-check hangers at the ledger only on dropped
   beams, and proportional decking reduction for cutouts.

Also unverified by S100 and worth his eye: a 2ft-rise stair produces a run shorter
than the stair width, which makes the computed reaction width-driven. Arithmetically
fine, possibly meaningless.

---

## 10. TODO BACKLOG (rough priority)

1. **The post-in-stairway fix** (section 2). Highest value, affects the permit set,
   blocked on Billy for which of three approaches. The plumbing is proven.
2. **Wire `stair_support.py` into drawing** once Billy confirms the detail. Landing
   posts onto the framing plan and footing plan, grade pad note, hardware callouts.
   Golden will change deliberately.
3. **Port the S96 notch-aware post layout to JS** (`compute_beam_layout` -> JS).
   Handoff gap #1 since S99. On a cutout deck the SCREEN shows 3 posts where the
   PDF correctly shows 6. A commented-out cutout parity case in
   test_frontend_parity marks the spot.
4. **3D: render landing posts.** They did not exist as data until S100; now they do.
5. **Phase 0 Session B remainder:** explicit waste lines (base joists are qty nJ+4
   with no visible waste line), zone-path stock rounding (base path rounds to
   8/10/12/14/16/20, zone paths do not), matrix-wide materials assertions.
6. **Phase 0.5 "Materials List Excellence"** per docs/SBP_MATERIALS_ROADMAP.md:
   cost ranges instead of fake-precise totals, hardware usage notes, staged
   purchasing groups, tools-required list, summary block, checklist/CSV output.
7. **Nail quantity** is flat qty 1 regardless of tie count (31 ties on a 40ft deck
   needs more than one 5lb box). Will's call: "not the biggest deal."
8. Zone materials paths (`estimate_zone_materials` / `calcAllZones`) and the steel
   materials path are still NOT parity-covered.
9. True interior stair openings (not reaching the rim) need a second header on the
   yard side. No reference example; detect and refuse rather than guess.

---

## 11. STANDING DECISIONS (unchanged)

- **Referral/affiliate layer: DEFERRED.** Trigger is roughly 10 plan customers/month.
  Do NOT sign up for Amazon Associates before then (signup starts a 3-sales-in-180-days
  clock that closes the account). Home Depot (Impact) and pricing-data API accounts
  also ON HOLD. Full checklist stamped ON HOLD in the roadmap doc.
- **Cut list shelf decision (S97): UNCHANGED.** Aggregate quantities and stock
  lengths only, never per-board cut lengths.
- **Materials parity is a permanent guard.** Every materials change must be made in
  BOTH `engine.js estMaterials` and `draw_materials.py estimate_materials` or
  parity fails. 6 configs.
- **Production PRs:** Will self-merges. Claude never opens or merges without
  explicit approval.

---

## 12. WHAT WILL SHOULD VERIFY ON THE LIVE SITE (hard refresh, busters s100k)

1. Straight front-edge stair - the control. Should look IDENTICAL to before S100.
   If it changed, something is wrong.
2. wrapAround stair at the front edge - opening should appear where the folded run
   and landing pass over the deck.
3. Switchback anchored a few feet in from the edge - was broken in every interior
   config; should now cut.
4. Railings on the wrapAround - they split on the same gaps, so they should break
   around the opening rather than running through it.
5. Materials list - should now show `Post Caps (Simpson BCS2-3/6)` as a NEW line,
   `Hurricane Ties (Simpson H2.5)` at qty = number of joists (not qty 1), and
   named hangers.
6. The post in the stairway is STILL THERE. Expected. Not fixed. See section 2.

Backout is per-commit and clean:
- `git revert c8e67a7` - materials catalog only
- `git revert cc41d3d` and/or `9b01984` - stair_support module (nothing draws it)
- `git revert f07136e` / `d772674` - headroom and elevation refinements
- `git revert bc42dcf` - the whole P0-3D fix (revert last if reverting several)

---

## 13. PARALLEL SESSIONS

An S99 session was interleaved with S100 earlier (robots.txt/sitemap, favicon;
pushes 4-6) and an S100 analytics/house-orientation thread ran through push 9.
Expect main to move. Rebase, keep ALL busters in sync (engine, zoneUtils, shared
loader - currently all s100k), and RE-RUN THE FULL GATE after every rebase.
