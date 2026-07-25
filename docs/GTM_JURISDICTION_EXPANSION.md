# GTM: jurisdiction expansion plan

Two separate workstreams, deliberately kept apart in this document:

- **PART 1 - WEBSITE WORK.** What has to change in the product before a
  jurisdiction can be served.
- **PART 2 - ADVERTISING.** Where to spend money, and where not to.

They are not the same list and they do not move at the same speed. Some
jurisdictions need advertising and zero code. Some need code before a single ad
should run.

Research date: 2026-07-25. Every claim below is either sourced to a jurisdiction
website or marked UNVERIFIED. Anything marked UNVERIFIED should be confirmed
before money is spent against it.

---

## The screening test (use this for every new jurisdiction)

Five questions, in order. A jurisdiction has to pass all five to be worth
advertising in.

1. Is a permit required for a typical residential deck?
   (If no, nobody needs a permit package. Too loose is as bad as too strict.)
2. Are construction drawings required with the application?
3. Is the prescriptive IRC path accepted, without a PE or architect seal, for a
   standard attached deck?
4. Can a HOMEOWNER submit their own plans, or is a licensed pro required to file?
5. Does the jurisdiction publish its own deck handout or submittal checklist?

Question 5 is the strongest single predictor and the reason to weight it: a
published checklist means they expect homeowner submittals, they have committed
to a prescriptive path, and they have handed us an exact spec to match. It is
why the PPRBD reference sets work so well as a benchmark.

**"Most lenient" is the wrong target.** The market is the middle of the
distribution, not the loose end.

---

# PART 1 - WEBSITE WORK

## Tier 0: already built, zero code required

**The product already serves eight jurisdictions, not one.** This was the main
finding of the research and it was already in the codebase.

PPRBD (Pikes Peak Regional Building Department) is a regional department, not a
city department. It does plan review, permitting and inspection for:

| Jurisdiction | County |
|---|---|
| Unincorporated El Paso County | El Paso |
| City of Colorado Springs | El Paso |
| City of Fountain | El Paso |
| City of Manitou Springs | El Paso |
| Town of Green Mountain Falls | El Paso |
| Town of Monument | El Paso |
| Town of Palmer Lake | El Paso |
| **City of Woodland Park** | **Teller** |

All eight adopt the same Pikes Peak Regional Building Code, which is the code
the product already targets. Formed by intergovernmental agreement between
Colorado Springs and El Paso County in 1966; the suburban jurisdictions joined
in 1982.

**Explicitly NOT covered by PPRBD:** the townships of Ramah and Calhan, and any
part of Teller County other than Woodland Park (so Divide, Cripple Creek etc.
are separate authorities).

**Code work required: NONE.** `backend/drawing/jurisdiction_sheet.py` already
carries `PPRBD_ZIPS` (80901-80951 plus Fountain 80817, Green Mountain Falls
80819, Manitou Springs 80829, Monument 80132, Palmer Lake 80133, Woodland Park
80863, Peyton/Falcon 80831, Cascade 80809, Security-Widefield 80911, the
military ZIPs, and the east-county ZIPs) and `PPRBD_CITIES` (colorado springs,
fountain, manitou springs, green mountain falls, monument, palmer lake,
woodland park, security, widefield, cascade, peyton, falcon, black forest).

Whoever wrote S50 already got this right. Nothing to do.

## Tier 1: small, well-defined work

### Douglas County (Castle Rock, Highlands Ranch, Parker, Lone Tree)

Best next target in Colorado. Passes all five screening questions. Publishes
both a deck page and a "Deck Submittal Requirements Check List" PDF, and accepts
homeowner permits via a Homeowner Agreement Form.

Their checklist asks for: site plan with dimensions to property lines and other
structures; location of existing egress windows and window wells under the deck;
structural framing plans with all dimensions, species and size of lumber, size
and spacing of footings, posts, beams, joists, and a ledger attachment detail;
a guardrail detail (or none if under 30in); stair and handrail details; all
solid timber structurally graded with species named; footing depth and diameter.

The product already generates every one of those.

**Code work required, two items:**

1. **Footing type: caissons, not sonotube piers.** Douglas County's checklist
   asks for "caisson depth and diameter". PPRBD sheets show sonotube piers. This
   is a detail-sheet and callout change, not a structural math change. Scope:
   `backend/drawing/draw_details.py` footing detail, plus the footing callouts
   in `draw_plan.py`, plus the materials line naming in `draw_materials.py` and
   `engine.js` (parity guard applies).
2. **Engineering trigger: brick or stone veneer.** Douglas County requires
   engineering if any part of the deck attaches to brick or stone veneer. The
   product has no veneer concept. Cheapest correct behavior is to DETECT AND
   REFUSE rather than guess: ask the siding type at step 0 and, if brick or
   stone, tell the user this jurisdiction requires an engineer's stamp and we
   cannot produce a submittable set. Same posture as the S102 decision on true
   interior stair openings.

### Pueblo (city and county)

Own regional body, Pueblo Regional Building Department, separate from PPRBD.
Permit required for any deck attached to a building or 30in or more off the
ground. Homeowner permits explicitly allowed on your principal residence.

**Code work required:** a new jurisdiction entry (ZIP and city matching) in
`jurisdiction_sheet.py`, and confirmation of whether PRBD has its own
attachment sheet the way PPRBD does. UNVERIFIED: whether they publish a deck
handout with span tables.

### Larimer County (Fort Collins, Loveland)

Publishes a deck handout with deck details and allowed spans, which is the
signal we want. Footings minimum 30in below grade for an attached deck. Stamp
required only "if location or design warrants", so conditional rather than
blanket, and there is a second conditional at 10ft or more above surrounding
grade for attached decks (text truncated in source, needs reading in full).

**Code work required:** UNVERIFIED until the full handout is read. Likely the
same shape as Douglas County.

## Tier 2: needs a product capability we do not have

### Denver and Aurora

**Frost depth is the blocker, and it is a real one.** Denver and Aurora require
footings at least 36in below grade. Colorado Springs requires 30in. Mountain
communities can require 48in or more.

The product currently models frost by CATEGORY, not by jurisdiction:
`backend/drawing/calc_engine.py:367`
```python
FROST_DEPTHS = {"warm": 12, "moderate": 24, "cold": 36, "severe": 48}
DEFAULT_FROST_CATEGORY = "cold"    # 36" -- conservative shared default
```

**There is no 30in category, which means Colorado Springs itself is not
represented exactly.** Picking "moderate" under-builds it at 24in; the shipped
default "cold" over-builds it at 36in. Over-building is safe and is what ships
today, but it also means every PPRBD set specifies 6in more excavation than the
jurisdiction requires, which costs the customer concrete and may draw a
reviewer question.

**Recommended fix, and it unlocks multiple jurisdictions at once:** replace the
category lookup with a per-jurisdiction frost depth in inches, resolved from the
address the user already enters. Keep the categories as a fallback for addresses
we cannot resolve. This is the single highest-leverage product change for
expansion, because frost depth is the one parameter that differs in nearly every
jurisdiction.

## Tier 3: do not build for these

### Boulder County (unincorporated)

The clearest example of too strict. The majority of unincorporated Boulder
County exceeds the prescriptive construction requirements and requires a signed
and sealed drawing from a Colorado licensed design professional. Separately,
decks where wind speed is 140 MPH (Vult) or more, or ground snow load exceeds
70 psf, must be designed by a licensed professional.

No product change makes this servable. Skip it.

### New York City

Dead for this product. The permit application must be prepared by a licensed
NYS Professional Engineer or Registered Architect, and homeowners cannot
self-file. A permit is required for every new deck including backyard
ground-level decks on one-family homes, which is stricter than most states.

## Hardcoded-jurisdiction inventory (measured, for whoever does the work)

Files containing "Colorado Springs", "PPRBD", "Pikes Peak" or "El Paso":

| File | refs | Notes |
|---|---|---|
| `backend/drawing/jurisdiction_sheet.py` | 19 | The real one. ZIP/city tables + PPRBD attachment-sheet overlay |
| `backend/static/js/steps.js` | 12 | Wizard copy and the PPRBD checklist UI |
| `backend/app/main.py` | 3 | API-level |
| `backend/drawing/sheet.py` | 2 | Titleblock |
| `backend/drawing/draw_plan.py` | 1 | |
| `backend/drawing/draw_details.py` | 1 | |
| `backend/static/js/home.js` | 1 | Marketing copy |
| `backend/static/js/steelDeckData.js` | 1 | |
| `backend/static/uxmock/*` | 6 | Separate mock, ignore |

Adding a second jurisdiction is therefore mostly a `jurisdiction_sheet.py` job
plus wizard copy, NOT a rewrite of the drawing pipeline. That is the good news.

---

# PART 2 - ADVERTISING

Separate from the above. Some of this can start today with no code at all.

## Spend now, no code needed

**The seven non-Colorado-Springs PPRBD jurisdictions.** Fountain, Monument,
Manitou Springs, Palmer Lake, Green Mountain Falls, Woodland Park, and
unincorporated El Paso County (Falcon, Peyton, Black Forest, Security-Widefield).

Same code, same reviewer, same forms, already handled in the product. If ads are
currently geo-targeted to "Colorado Springs" as a city, they are leaving the
rest of the county on the table for free. **Widen the geo-target to El Paso
County plus Woodland Park.** This is the single cheapest action in this
document.

Note for ad copy: these are small markets individually. Monument, Palmer Lake
and Green Mountain Falls are towns, not cities. The volume is in unincorporated
El Paso County and Fountain.

## Do not spend yet

- **Douglas County and Pueblo.** Strong targets, but wait for the Tier 1 code
  work. Advertising into a jurisdiction whose footing detail we get wrong is
  worse than not advertising, because the failure mode is a rejected permit and
  a GC who never comes back.
- **Denver and Aurora.** Wait for per-jurisdiction frost depth. A 30in footing
  on a Denver set is a rejection.

## Never spend

- **Boulder County unincorporated.** Engineer stamp required regardless.
- **New York City.** Homeowners cannot self-file.

## The one that needs a phone call, not a search

**Upstate New York is not settled, and the earlier assumption that "New York
requires an engineer stamp" is only true for NYC.**

Upstate, the seal requirement is a cost-and-scope test rather than a blanket
rule. One town's published guidance sets the trigger at alterations costing
$20,000 or more, OR where the work in the building department's opinion
materially affects structural safety. NYSED's own guidance is explicit that the
dollar limitation alone does not decide it, and that the scope and nature of the
work and its relationship to structural and public safety also matter.

**Honest read: that second clause probably catches us.** A deck bolted to a
house is arguably a change affecting structural safety at any cost. So upstate
NY is ambiguous, not open. Worth exactly one phone call to one town building
department before it is either pursued or written off. Not worth a research
session and definitely not worth ad spend on the current evidence.

---

## Recommended order of work

1. **Today, no code:** widen ad geo-targeting to all of El Paso County plus
   Woodland Park.
2. **Next code session:** per-jurisdiction frost depth in inches (fixes
   Colorado Springs' own 30in exactness AND unlocks Denver/Aurora/Larimer).
3. **After that:** Douglas County, which is caisson callouts plus a
   veneer detect-and-refuse.
4. **Then:** Pueblo, pending confirmation of whether PRBD has its own
   attachment sheet.
5. **Own session:** the national state-by-state screen against the five
   questions above. Not attempted here.

## Still unverified (do not act on these without checking)

- Teller County outside Woodland Park (Divide, Cripple Creek, Florissant)
- Fremont County (Canon City)
- Ramah and Calhan townships
- Larimer County's full deck handout, including the 10ft-above-grade condition
- Whether Pueblo Regional Building Department publishes a deck handout
- Denver and Aurora beyond frost depth
- Every state other than Colorado and New York
