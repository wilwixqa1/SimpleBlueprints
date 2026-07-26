ALL THINGS ARCHITECTURE REFERENCE SETS (Richard Rutstein, Colorado Springs)
These are REAL, approved PPRBD residential deck permit sets -- the exact quality
+ convention bar SimpleBlueprints output must match. Will provided them S88.

Loucks_reference_set.pdf  -- 1451 W. Costilla St, CO Springs. Switchback stairs,
  natural-grade elevations, 4x4 + 6x6 posts, dropped 2x12 beam. Note Will's
  cantilever annotation (patio-door bump-out -> ledger can't attach, separate
  beam needed).
Ilaria_reference_set.pdf  -- 4739 Sweetgrass Lane, CO Springs (our real test
  address). Larger deck, long switchback stair, MicroLlam/LVL beam, sloped
  natural grade on N/S elevations. Note Will's cantilever annotation (fireplace
  bump-out).

KEY CONVENTIONS THESE ESTABLISH (used for S88 decisions -- see MASTER_CONTEXT
B7/B8/B10/B11 + calibration notes):
- SLOPED GRADE: one honest continuous grade line following the real slope; every
  post run down to meet it at its true ground point. No averaging, no bench pad.
- STAIRS: switchback with a landing, attaching at the deck edge; stairs sit clear
  of the deck's support posts.
- CANTILEVER: where the house projects out (bump-out), the deck ledger does NOT
  attach to it; a separate beam spans past it, shown in the framing plan.
- BEAMS: engineered LVL/MicroLlam for longer spans; dropped wood beams otherwise.
- POSTS: 4x4 for light load, 6x6 for main; Simpson ABU bases + BCS2 caps.

Welborn_reference_set.pdf -- 365 Alpine View Road, Divide, CO. Added S100.
  ALL-STEEL job: Fortress Evolution deck + stair framing, 3.5"x3.5" steel posts
  on existing piers. (3) decks rebuilt from wood to steel. Straight stairs to
  grade, no landings. This is the reference for the steel framing path.

S100 ADDITIONS TO THE CONVENTIONS ABOVE
- STAIR SUPPORT KEYS OFF THE LANDING, NOT THE STAIR:
  * stair runs to grade -> NO dedicated support. Ilaria's "STAIR AT LOWER
    LANDING DETAIL" = stringer NOTCHED FOR PLATE on a MIN 4" THICK concrete
    landing, 12" MIN. Welborn (steel) = Stair Stringer Anchor Bracket + Stair
    Strap, hung off the structure. Two of three sets are this case.
  * stair has an ELEVATED landing -> that landing is a framed platform on its
    OWN four corner posts. Loucks: 4x4 PT w/ ABU44Z base + BCS2-2/4 cap,
    (4) PLCS, 12" piers x 30" deep. Lighter than and separate from the deck's
    6x6 / ABU66Z / 20" pier system.
  * NO header spanning the stringer tops appears in ANY of the three sets. That
    detail is from a Fine Homebuilding RETROFIT article and does not belong on a
    new-construction permit set. S100 push 13 built it and push 14 removed it.
- HARDWARE PART NUMBERS (now used verbatim in the materials estimate, S100 p15):
  H2.5 hurricane ties ea. joist to beam below; LUS210 joist hangers (LUS26 for
  2x6); LUC106 Z / LUC66 Z at corners; ABU66Z / ABU44Z post bases; BCS2-3/6 /
  BCS2-2/4 post caps. Post caps were MISSING from our estimate entirely until
  S100 -- every real build buys one per post.
- POST SPACING: Rick's spacing matches ours. Loucks is a 13ft deck with 3 posts
  and two 5'-1" spans, i.e. a centre post at ~6.5ft -- exactly where our engine
  puts one on a 13ft deck. He does NOT move or remove posts to clear a stair.
  He puts the STAIR somewhere else. This is the "stairs sit clear of the deck's
  support posts" convention above, and it is why our default config (centered
  straight stair on an odd-post deck) produces a collision his plans never
  contain. See S100_HANDOFF section 2.
- LOADS: L.L. 60 psf (with snow), D.L. 15 psf, T.L. 75 psf, ledger 66 psf.
  All three sets. Note our calc engine uses uniform load ONLY; stair stringer
  load has never entered beam/footing sizing (S100_HANDOFF section 8).

================================================================================
S102 ADDITION -- Meadowview_reference_set.pdf (4th set)
================================================================================
4307 Meadowview Ct, Colorado Springs CO. Rick Rutstein / All Things Architecture,
11/12/24. 8 sheets, text layer present. Deck framing is sheet A-8.

THE HEADLINE, and the reason this was pulled:

    NONE OF THE FOUR REFERENCE SETS CONTAINS A FREESTANDING DECK.

  Ilaria, Loucks, Welborn and Meadowview are ALL ledger-attached. Meadowview
  states it plainly: 2x8 P.T. LEDGER W/ (2) LEDGER LAGS @ 16" O.C.

  So we have ZERO ground truth for freestanding detailing. The S102 freestanding
  rebuild (two beams, cantilever c = min(1.5, D/6), span s = D - 2c) is derived
  purely from IRC R507.6 arithmetic -- the quarter-span cantilever rule -- and is
  NOT corroborated by any set. Billy said "two beams", which is consistent with
  what we built, but the INSET is our inference. Ask him specifically:
    - is min(1.5, D/6) the right inset, or does he use a fixed number (2ft?)
    - symmetric, or beams biased toward one end
    - at 20ft deep our engine needs >2x12 -- does he refuse those or engineer them

WHAT MEADOWVIEW ADDS (all ledger-deck detail):

- BEAM: 6X12 P.T. SOLID TIMBER, posts @ 12'-0" O.C. Our engine produces MULTI-PLY
  (3-ply 2x12) at a similar span. Both are legitimate; Rick uses solid timber
  here and multi-ply elsewhere. Worth knowing before "correcting" a plan that
  shows a solid beam. "SPLICE BEAM OVER CENTER OF PIER, TYP."
- SECONDARY BEAMS: (2) P.T. 2X8 BEAM W/ 'LU228' @ EACH END -- flush beams hung
  between the main beams, three of them. We do not model this.
- HARDWARE DIFFERS FROM THE OTHER SETS: 6X6 P.T. POST WITH SIMPSON 'PC66' AT TOP
  AND 'PBS66' AT BASE. Ilaria/Loucks use ABU66Z base + BCS2-3/6 cap. So Rick's
  hardware is job-specific, not a fixed standard -- our materials estimate hard
  codes ABU66Z/BCS2-3/6 and should be understood as ONE valid choice, not THE
  answer.
- PIERS: 22" dia x 30" deep round concrete (Ilaria 21"x30", Loucks 20"x30").
- JOISTS: 2X8 PT @ 16" O.C., 'LU28' hangers each joist BOTH ENDS, H2.5A each
  joist to beam. (2) P.T. 2X8 @ RIM -- doubled rim, which we do not model.
- DECKING: 1x6 Trex composite.
- STAIR: 2x14 stringer @ 16", NOTCH STRINGER FOR PLATE, 2x6 PT w/ 1/2" dia
  expansion bolts @ 16" OC, MIN 4" THICK LANDING, 12" min. CORROBORATES the
  Ilaria/Loucks stair-to-grade detail exactly -- no posts under a run to grade,
  pad plus notched stringer. Third independent confirmation.
- LOADS: L.L. 60 psf (with snow), D.L. 15, T.L. 75, ledger 66. Same as the other
  three sets.

--------------------------------------------------------------------------------
MEADOWVIEW: FRAMING AROUND AN OBSTRUCTION (chimney / fireplace)
--------------------------------------------------------------------------------
THIS IS THE REFERENCE EXAMPLE S100 SAID DID NOT EXIST.

S100_HANDOFF section 10 item 9 and the S102 stair-opening work both refuse the
same case: "true interior stair openings (not reaching the rim) need a second
header on the yard side. No reference example; detect and refuse rather than
guess." zone_utils.get_stair_opening_rects() still refuses it today and emits an
`interior_opening` warning.

Meadowview sheet A-8 contains exactly that condition. The deck wraps a masonry
FIREPLACE / chimney that sits INSIDE the deck footprint, and Rick frames it as:

    (2) P.T. 2X8 BEAM W/ 'LU228' @ EACH END      -- appears THREE times
    (2) P.T. 2X8 @ RIM                           -- doubled rim throughout
    2X8 PT JOISTS @ 16" O.C., 'LU28' EA. JOIST (BOTH ENDS)

So the detail is: DOUBLED 2x8 members, FACE-HUNG with Simpson LU228 hangers at
each end, boxing the obstruction. Doubled members on the sides carry the cut
joists; doubled members across the ends close the opening. Same trimmer/header
vocabulary as a notch, but the opening is INTERIOR -- it does not reach the rim,
which is precisely the case we have been refusing.

Hardware note: LU228 is the DOUBLE-2x8 face-mount hanger. Our estimate carries
LUS28Z/LUS210 for single joists and nothing for doubled members hung off other
framing. A "frame around an obstruction" feature would need LU228 (or the
equivalent for the joist size) added to the hardware schedule.

WHAT THIS UNBLOCKS
- The interior-opening refusal in get_stair_opening_rects() now has a detail to
  implement against instead of a guess.
- A future "deck around a chimney / tree / bay window / hot tub" feature. The
  obstruction is just an interior cutout that never touches an edge -- the same
  geometry, so the same headers.

WHAT IS NOT YET VERIFIED, do not build on these without checking the sheet
- Which of the three doubled members are trimmers (parallel to joists) versus
  headers (perpendicular). Read from the text layer only; the arrangement was
  NOT confirmed visually.
- Whether the opening is fully interior on all four sides or shares an edge with
  the ledger wall (the fireplace is against the house, so the house side may be
  closed by the ledger rather than a header).
- Whether the doubled rim is specific to this job or Rick's standard. Ilaria and
  Loucks were not re-checked for it.

Also worth noting for beam sizing: Meadowview's main beams are 6X12 P.T. SOLID
timber with posts @ 12'-0" O.C. and "SPLICE BEAM OVER CENTER OF PIER, TYP." Our
engine produces multi-ply at those spans and models no splice rule.
