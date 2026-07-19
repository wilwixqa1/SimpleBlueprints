# SimpleBlueprints UX Mock — Design Rationale (S88.5)

A clean-sheet redesign of the user journey and UI, built without reference to the
current site structure. Judged only against the goals in SBP_GTM_PLAN.md.

## Who this is for

SBP_GTM_PLAN.md (July 2026) makes the "Permit-Confused Homeowner" the PRIMARY
audience, with the free-preview / pay-at-download pricing model built around
them. This mock follows the GTM plan. (Note: MASTER_CONTEXT records an older
S84 decision targeting contractors; the GTM doc is newer and was treated as
authoritative for this exercise. The journey still serves contractors — they
just move through it faster.)

## What is objectively wrong with the current journey

1. The landing page sells "configure structures" while the customer searches
   "deck permit plans". Six product cards (five dead), no price, no sample
   output, no trust signals, and client-side React that Google cannot crawl —
   the GTM plan's own CRITICAL blocker.
2. The most differentiated capability in the product — "we already know your
   property" — is buried inside wizard step 0 behind a Start Building click.
   No competitor can do it. It should BE the hero.
3. The 5-step wizard (Site Plan / Size / Structure / Finishes / Review) mirrors
   the data model and the PDF sheet list, not the user's mental model. The
   user has three ideas: my property, my deck, my plans. "Structure" is not a
   decision the user makes — the IRC engine makes it. It should be a live
   readout that builds trust, not a step that creates work.
4. The payoff is invisible until the end. Every competitor shows their output
   up front; SBP shows nothing until the wizard is complete.

## The redesigned journey: three acts

ACT I — YOUR PROPERTY (the magic moment, < 15 seconds)
  Landing hero = an address field. Submit → animated public-records lookup →
  the user's actual lot polygon and house footprint draw themselves on screen.
  One confirmation (drag the house, spin the north dial, adjust setbacks).
  Survey upload (AI extraction) and manual drawing are inline fallbacks, not
  equal siblings — address is the fast path, per the GTM audience.

ACT II — YOUR DECK (one canvas, everything on it)
  The deck is designed ON the property. Direct manipulation: drag to move,
  drag handles to resize, live dimension lines, wings (3-cap, matching
  production), stairs, plan/axonometric toggle. Structure is a live spec card
  with IRC citations that re-sizes on every drag — green "SIZED TO IRC 2021"
  stamp. Setback violations turn the canvas red the moment they happen, not
  at the permit counter. The AI drafter is docked and can act on the design.
  The only questions asked of the user: snow load and frost depth.

ACT III — YOUR PLANS (the payoff + the paywall)
  All 8 sheets render as watermarked previews drawn from the live design.
  Materials summary. Everything is free until the Download button — the GTM
  free-preview decision made physical, directly countering RedX's #1
  complaint (paywall before trying). $49 Standard / $79 Complete.

Progress is not a dot-stepper. The signature element is the live TITLE BLOCK
in the corner of the drawing sheet the whole app lives on: address fills in
after lookup, parcel after records, deck dims as you design, sheet count at
preview. Progress = your drawing set coming into existence.

## Brand direction

The product's credibility object is the drawing set, so the identity comes
from the drafting table: cyanotype blueprint blue (#17456e / #0e2f4d), vellum
paper (#f7f5ef), drafting ink (#14212e). Type: Barlow Condensed in caps for
title-block display, Public Sans for body (the typeface of US civic
paperwork — on brand for permits), IBM Plex Mono for dimensions and spec
values. The current forest green (#3d5a2e) survives as the "approved / passes
code" color: green means stamped.

## SEO

The landing page is real static HTML: full meta/OG tags, FAQPage JSON-LD,
copy aligned to GTM keywords ("deck permit plans", "permit ready deck plans"),
sample sheet imagery, visible pricing, an FAQ, and footer slots for the
planned permit-guide blog posts.

## Explicitly out of scope (per the session brief)

Real PDF generation, the compliance checker, Google login, payments, real
Realie/Overpass calls (mocked with canned Colorado Springs parcel data), and
phone-width mobile layout (tablet and up is responsive).
