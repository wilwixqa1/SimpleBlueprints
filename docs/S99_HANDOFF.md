# S99 HANDOFF (materials list session)

Repo: github.com/wilwixqa1/SimpleBlueprints (public) - main @ f6e411d - CI green.
S99 theme: materials list strategy + Phase 0 accuracy work. Follow the S98 handoff's
section 0 workflow (clone, validate, one-shot PAT push, backout per commit); it all
still applies. One gate correction below.

## GATE CORRECTION (matters to every future session)
Since S98 changed the default sheet size to letter, the golden test MUST be invoked
as `SBP_SHEET=arch_d python3 tests/pdf/golden_structural.py` (its fingerprints were
captured at arch_d). Run bare, it fails with everything scaled by 2.571 (36/14).
That failure signature = wrong sheet size, not a regression.

## WHAT SHIPPED (newest first)
| SHA | What |
|-----|------|
| f6e411d | Push 3: five quantity accuracy fixes, BOTH engine.js and draw_materials.py in lockstep: hangers at ledger only (was nJ*2 everywhere), cutouts reduce decking/screws proportionally, joist/decking order lengths round up to stock lengths (8/10/12/14/16/20), rim joists cover both sides at any depth, landing footings now include concrete bags. engine.js buster s81e.1 -> s99a |
| de72658 | Push 2: PDF materials sheet now itemizes ALL stairs. Ported the frontend S65+S81d multi-stair block to Python (deckStairs decks previously got ZERO stair materials on the PDF, the paid deliverable). Rail length now leaves a gap per deckStair in both Python calcs. Category case fix (LEDGER/FRAMING -> Ledger/Framing). NEW: materials parity check in test_frontend_parity, JS estMaterials == Python estimate_materials line for line (cat/item/qty/cost), 6 configs |
| 1dac4c4 | Push 1: docs/SBP_MATERIALS_ROADMAP.md (strategy + build plan, read it) |

Golden unchanged on every push: permit sheets provably untouched.

## THE BIG DECISIONS (from docs/SBP_MATERIALS_ROADMAP.md, read that doc for depth)
1. REFERRAL/AFFILIATE LAYER: researched thoroughly and DEFERRED by Will. Trigger:
   roughly 10 plan customers/month. Do NOT sign up for Amazon Associates before the
   trigger (signup starts a 3-sales-in-180-days clock that closes the account).
   Home Depot (Impact) application and the pricing-data API accounts are also on
   hold. The roadmap doc has the full checklist stamped ON HOLD.
2. NEAR-TERM WORK: Phase 0 (quantity accuracy, this session started it) then
   Phase 0.5 "Materials List Excellence" (cost ranges instead of fake-precise
   totals, hardware usage notes, staged purchasing groups, tools-required list,
   summary block, checklist/CSV output). All zero-dependency. Details in the doc.
3. Cut list shelf decision (S97) UNCHANGED: aggregate quantities and stock lengths
   only, never per-board cut lengths.

## NEW PERMANENT GUARD: materials parity
test_frontend_parity now compares the full materials list (screen vs PDF) for 6
configs. EVERY materials change must now be made in BOTH engine.js estMaterials and
draw_materials.py estimate_materials, or parity fails. engine.js edits need the
?v= buster on its own script tag in index.html (currently s99a) bumped.

## KNOWN GAPS (documented, not yet fixed)
1. JS calcStructure lacks the S96 notch-aware post layout: on a cutout deck the
   SCREEN shows 3 posts where the PDF correctly shows 6 (posts/footings/concrete
   underestimated on screen). Fix = port compute_beam_layout to JS, part of the
   consolidation work. A commented-out cutout parity case marks the spot in
   test_frontend_parity.
2. Zone materials paths (estimate_zone_materials / calcAllZones) and the steel
   materials path are NOT parity-covered yet. Also zone joists/decking lengths do
   not stock-round yet (base path does).
3. Still-silent waste: base joists are qty nJ+4 with no explicit waste line. Making
   waste explicit is Phase 0 Session B work.
4. Item catalog sharpening pending (Phase 0 Session B): "Hurricane Ties + Nails" is
   a qty-1 dollar lump (should be qty nJ of a named tie), "Post Base Hardware" and
   "Wood Rail Kit" are generic abstractions.
5. Landing pad: the old "Landing Pad Concrete qty 2" line was dropped in the port
   (landings are framed platforms with footings in the S81d model, and footing
   concrete is now itemized). If Will wants a grade-level pad option later, it is
   a new feature, not a regression.

## OPEN AUDIT ITEM FOR BILLY
Ask Billy to gut-check two of the shipped fixes on a real list: hangers at the
ledger only on dropped beams (ties on the beam side), and proportional decking
reduction for cutouts. Both are standard practice per DCA-6 style construction but
he is the code-literate ground truth.

## PARALLEL SESSIONS
An S100 session was active during S99 (analytics rebuild, admin dashboard, parcel
rendering, house orientation; pushes 1-6). Expect main to move; rebase, keep both
busters (engine s99a-or-later AND the shared loader var v, currently s100d), and
RE-RUN THE FULL GATE after every rebase. Rebase tip: this container needed
`git config user.email/name` set locally and `GIT_EDITOR=true` plus
`git commit -C <orig-sha>` to complete a stopped rebase.

## WHAT WILL SHOULD VERIFY ON THE LIVE SITE (hard refresh)
1. Any deck with stairs -> generate -> the PDF materials sheet lists Stairs lines
   (stringers, treads, brackets, landing items with concrete if applicable).
2. A 20x14 ledger deck: Joist Hangers 16 (not 32), Rim Joists 6 (not 4).
3. A deck with a cutout: decking board count drops vs the same deck without.
4. On-screen estimate and PDF materials sheet show identical items and quantities.
Backout: git revert f6e411d (push 3) and/or de72658 (push 2) independently.

## NEXT SESSION CANDIDATES (in rough priority)
1. The 3D stairs no-hole bug (P0 from the master doc, still the top product issue).
2. Phase 0 Session B: explicit waste lines, item catalog sharpening, zone-path
   stock rounding, matrix-wide materials assertions.
3. Phase 0.5 excellence items per the roadmap doc.

## PAT
Will pasted a PAT in the S99 chat. It was used only via one-shot push URLs, never
stored (swept after each push). ROTATE IT.
