# SimpleBlueprints: Materials List + Referral Revenue Roadmap
Written at S99 (July 22, 2026), from Will's brief: substantially improve the materials list, research whether a price-sourced, referral-monetized shopping list is feasible, and plan the path.

**STATUS (decided later in S99): the referral/affiliate layer is DEFERRED.** Will's call, and it is the right one: the affiliate programs have application reviews and, in Amazon's case, a 3-sales-in-180-days clock that closes accounts, which is untenable for a site with no traffic yet. Nothing in sections 3, 4, 9, 11, or 12 should be acted on until the trigger: roughly 10 plan customers per month (or Will says go). The NEAR-TERM work is Phase 0 plus the new Phase 0.5 (Materials List Excellence) in section 10, which need no applications, no external accounts, and no APIs. The pricing-data APIs (BigBox/SerpApi) remain available anytime with no approval process if we want live prices sooner.

## 1. Executive summary (plain English)

The idea is feasible and worth doing, but the revenue model needs one correction. The vision (SimpleBlueprints tells you exactly how much of everything to order, shows you today's prices at stores near your address, links you to buy it, and we earn a referral cut) is the PCPartPicker model, and PCPartPicker proves it works: they are a free tool funded entirely by 1 to 5% retailer commissions, bootstrapped, powered by retailer price feeds.

The correction: PC parts are bought online and shipped. Lumber is bought at a store or delivered locally, and the big-box affiliate programs reflect that. Lowe's excludes lumber from commissions entirely. Home Depot pays about 1% on most products with a 24 hour cookie and pays nothing on in-store purchases. So affiliate links on the framing lumber will earn roughly $1 to $5 per customer, not $40. The real referral money is in three other places: (1) a direct partnership with a nationwide-shipping deck retailer like DecksDirect for composite, steel, railing, and hardware packages (5 to 10% on $5,000+ orders is plausible, and they already stock the Fortress steel products our plans spec), (2) contractor lead generation (Home Depot's own installation program pays $20 to $200 per qualified lead, and the broader home-services lead market pays similarly), and (3) the shippable hardware slice (hangers, ties, fasteners) via Amazon and Home Depot links.

Strategy: build the materials upgrade because it is valuable on its own (Billy reports it is a top ask from GCs and DIYers, competitors treat it as table stakes, and it strengthens the "contractor trusts the set" north star). Layer referral monetization on top at near-zero marginal cost, measure it honestly, and pursue the two high-yield channels (retailer partnership, contractor leads) as business development rather than betting on lumber commissions.

Everything here stays inside the S97 cut list decision: aggregate quantities and stock lengths only. No per-board cut lengths, ever, until the S97 revisit gates are met.

## 2. Where we are today (code reality)

- `backend/drawing/draw_materials.py::estimate_materials` and its lockstep mirror `estMaterials` in `backend/static/js/engine.js` already produce an itemized list: roughly 15 to 25 line items shaped `{cat, item, qty, cost}` across Foundation, Posts, Beam, Ledger, Framing, Hardware, Decking, Railing (plus a steel path speccing Fortress "FF" products).
- Quantities include stock lengths ("2x10 Joists 16', qty 18") and store units (80lb bags, boxes of screws). This is already an order list in structure.
- Every unit cost is a hardcoded literal in the code ($6.50 a bag, $24 a post). Prices are static guesses, not sourced, not localized, and they silently go stale.
- Quantities include rough fudge factors (for example joist count + 4) that have never been audited config-by-config as "exactly what to order."
- The Review page shows the takeoff collapsed behind a summary line; the PDF has a materials sheet. There is no shopping or linking layer anywhere.

Gap summary: quantities need an accuracy audit, prices need to become real, and there is no sourcing/purchase layer at all.

## 3. Market research findings

### 3a. Retailer-owned "design to cart" tools (captive, single catalog)

| Tool | What it does | Limitation |
|---|---|---|
| Menards Design & Buy Deck | Full 3D deck designer that generates an itemized BOM down to fasteners, priced with current store pricing, one-click transfer to the Menards cart, pickup or delivery | Menards catalog only, design tool is separate from any permit workflow |
| Lowe's Deck Designer | Free designer producing a cost estimate, materials list, and building plan | Lowe's catalog only, no structural/permit output |
| Home Depot Blueprint Takeoffs (launched Nov 2025) | Upload blueprints, AI produces a complete material list and quote in days, buy everything from Home Depot | Pro-only (via Pro Desk / sales reps), days of turnaround, single supplier |
| Decks.com (Trex) | Free plans with a materials breakdown | Fixed sizes, funnels to Trex products |
| TimberTech designer | 3D visualizer with a detailed takeoff list | Product catalog tool, no structural output |

Read on this: the plan-to-priced-materials-to-purchase flow is where the industry is going (Home Depot just made it a strategic launch), which validates demand. Every existing version is captive to one retailer's catalog. Nobody found is doing a retailer-neutral, instantly generated, permit-plan-linked version for decks. That is our opening: we produce the permit set AND a neutral priced order list in one shot, instantly, for DIYers as well as pros.

### 3b. The model to copy: PCPartPicker

- Free comparison/build tool, revenue exclusively from affiliate commissions when users buy parts through its retailer links.
- Commissions typically 1 to 5% per sale; relies on retailer data feeds for real-time pricing and stock; grew to 200+ retailers, bootstrapped, no paywall.
- Why it works there: PC parts are commodity SKUs bought ONLINE from many competing e-tailers with affiliate programs and data feeds. Users return repeatedly to watch prices.
- Where the analogy breaks for decks: fulfillment. Dimensional lumber and concrete are bought in person or delivered locally, which affiliate tracking mostly cannot credit.

### 3c. Affiliate program economics (verified July 2026, re-verify at signup)

| Program | Commission | Cookie | Notes |
|---|---|---|---|
| Home Depot (Impact network) | about 1% on most products, up to 8% on select home decor only | 24 hours | In-store purchases excluded. Reported figures vary slightly by source; confirm in the Impact dashboard at signup |
| Home Depot Installation (lead gen) | $20 to $200 per qualified lead | 30 days | Pays per lead/appointment, not per sale. Strong fit for "hire a builder" traffic |
| Lowe's (CJ / Impact) | about 2% (some sources 2 to 4%) | 24 hours (some sources longer) | LUMBER EXPLICITLY EXCLUDED from commissionable sales, along with gift cards and services |
| Amazon Associates | 3% home improvement / tools | 24 hours (90 days if added to cart) | No real dimensional lumber, but strong for hangers, ties, fasteners, tools |
| Wayfair / Walmart / Target | 3 to 7% | 3 to 7 days | Marginal fit (outdoor furniture, lighting add-ons at most) |
| Menards | No established affiliate program found | n/a | Their strategy is the captive Design & Buy tool |
| DecksDirect | No public affiliate program; runs a Pro loyalty program and does its own takeoff services | n/a | Partnership would be a direct negotiated deal. Ships decking/railing/framing nationwide. Stocks the Fortress steel products our steel plans already spec. Our old GTM doc already flagged them as a purchasing partner |
| Trex / TimberTech / Simpson | Sell through dealers; partner programs are trade-oriented | n/a | Brand partnership / co-marketing conversation, not a network signup |

### 3d. Price data access (the feasibility question)

- Home Depot has no official public product API. Two established third-party APIs fill the gap: BigBox API (Traject Data) and SerpApi's Home Depot API. Both return real-time product data including price, stock, and store/zip-localized results, queryable by SKU or search term, JSON out. BigBox starts around $15/month; SerpApi has a free tier (about 100 searches/month) and paid plans in the ~$50+/month class. Similar third-party scrapers exist for Lowe's.
- Affiliate networks themselves (Impact for Home Depot, CJ for Lowe's) provide product catalogs/feeds to approved affiliates, which is the most terms-of-service-clean data path and comes bundled with the tracked links. Feed freshness and lumber coverage need checking after approval.
- We already hold the customer's address from the parcel lookup, so zip-localized pricing ("priced at the store near your property") is a one-line parameter, and it is a differentiator no captive tool can offer neutrally.
- Practical plan: nightly cached refresh of a fixed SKU map (roughly 40 to 80 SKUs covering our item catalog) rather than per-request live calls. Cheap, fast, and stays within low API tiers during beta.

## 4. Revenue math (scenarios per 100 plan customers)

Assumptions: average wood deck materials package $3,000 to $5,000; composite $6,000 to $12,000; hardware/fastener slice $300 to $800.

| Scenario | Mechanics | Revenue per 100 customers | Per customer |
|---|---|---|---|
| A. Big-box affiliate only (conservative) | 30% open the shopping list, 10% of those buy something online in the cookie window, $500 average online basket, 1.5% blended | about $25 | about $0.25 |
| B. Big-box affiliate (healthy engagement) | 50% engage, 20% buy online, $1,200 basket, 2% blended | about $240 | about $2.40 |
| C. B plus hardware-kit capture | B plus 25% buy a $500 hardware kit via links at 3% | about $615 | about $6 |
| D. C plus DecksDirect direct deal | C plus 10 to 15% of customers buy a $5,000 to $7,000 composite/steel package at a negotiated 5 to 8% | $3,100 to $8,000 | $31 to $80 |
| E. Contractor lead gen | 20% click "get builder quotes," half qualify, $30 to $100 per qualified lead | $300 to $1,000 | $3 to $10 |

Takeaways:
1. Network affiliate links on lumber alone (A/B) are a rounding error next to $49 plan sales. They are still worth having because they cost nothing once the list exists.
2. The step change is D: a direct retail partnership on shippable high-ticket packages. That is a business development conversation, not a network signup, and it is the single highest-leverage referral action available.
3. E (contractor leads) is the best per-click channel and serves the large fraction of plan buyers who will not build it themselves.
4. Realistic blended potential once mature: $10 to $40 of referral revenue per plan customer, meaningfully additive to the $49 plan but not a replacement for it. The referral route complements pricing the plan set; it does not replace charging for it at beta scale.

## 5. Strategy: value first, referrals second

The materials upgrade is justified before a dollar of referral revenue because:
- Billy reports the materials list is one of the biggest asks from GCs and DIY builders (know exactly how much to order).
- The GTM doc rates materials capability as table stakes vs RedX and the Etsy sellers, and a priced, localized, shoppable list leapfrogs both (neither has live pricing).
- It reinforces the trust north star: a plan set that also nails the order list is a set a contractor trusts more.
- Marketing surface: "your permit plans plus a priced shopping list for the store near you" is a concrete, screenshot-able differentiator for the landing page and ads.

Positioning (Will's framing, S99): this is NOT an attempt to compete with Home Depot, Menards, or anyone else on materials. Our wedge is upstream of all of them: the customer comes to us permit-first, and the moment we deliver their blueprints is exactly the moment a builder starts quoting and buying supplies. The captive tools require you to start inside their designer or walk finished blueprints to a pro desk; we are already standing there when the blueprints are created. So the materials/referral layer is an ADD-ON revenue stream for people already on our platform, building our own ecosystem and moat, monetized as attach revenue on a funnel we already paid to acquire. The retailers are inspiration for how to build the best materials list generator, not the competition. Consequences: (a) the metric that matters is attach revenue per plan customer (the $10 to $40 blended figure) times plan volume, so this work compounds with everything that grows plan sales; (b) the list should stay free and ungated, because the priced list helps sell the $49 plan set and the referrals monetize what happens after.

Operational note: Home Depot's Blueprint Takeoffs takes days and is gated behind Pro sales reps; ours is instant, DIY-accessible, retailer-neutral, and attached to the permit set. And it is synergy rather than competition: our PDF is exactly the input their service consumes, so the materials sheet should look takeoff-grade and be easy to hand to any pro desk.

## 6. Build plan (phased, with session estimates)

### Phase 0: Quantity accuracy audit (1 to 2 sessions) [prerequisite]
Make the quantities defensible as an order list before attaching prices and links to them.
- Audit `estimate_materials` line by line against the config matrix: joist counts, board counts, bag math, hangers, fasteners, railing segments, across zones/cutouts/stairs/steel.
- Make waste/extras explicit and visible ("18 joists + 2 extra (10% waste)") instead of silent fudges like +4.
- Extend tests: a materials assertion pass over the config matrix (counts change only when geometry changes), keeping JS/Python lockstep guarded by the existing parity test.
- Wording pass: label it an "order list (verify quantities before purchase)". Quantities are far lower risk than cut lengths, but the disclaimer costs nothing.
- Reuse from S97: the reverted `build_cutlist` reconciliation idea (aggregates must agree with estimate_materials on bags and stringers) is a sound self-check pattern.
- Optional sliver already sanctioned in S97: add the summary block (deck area, perimeter, concrete volume, bag count) to the materials sheet.

### Phase 1: Live localized pricing (2 to 3 sessions)
- Build a SKU map: our item strings to retailer SKUs/search queries (start Home Depot only). Roughly 40 to 80 mappings, one-time effort plus drift maintenance.
- Backend pricing service: nightly cached refresh via BigBox or SerpApi, zip-localized using the project address, with the hardcoded costs as fallback when a price is missing. Frontend fetches prices from OUR endpoint, so no new JS/Python parity burden (single source of truth for prices).
- Surface it: Review page materials section shows sourced prices with a store + date stamp ("Estimated at Home Depot, Colorado Springs, July 22, 2026"). PDF materials sheet gets a priced-as-of date.
- Costs: $15 to $50/month API tier during beta.

### Phase 2: Shoppable list + first referral dollars (2 sessions)
- A "Shopping list" view (web page linked from the delivery page and a link/QR from the PDF materials sheet): every line item with quantity, price, subtotal, and a Buy button per retailer where a link exists.
- Affiliate integration: Home Depot (Impact) and Amazon Associates links with tracking, FTC-compliant disclosure line. Lowe's optional (lumber excluded anyway; useful for non-lumber lines).
- Export paths that respect how people actually buy: printable list formatted for a pro desk / lumber yard quote, CSV download.
- Instrumentation: click-through and (where networks report it) conversion per line item, so we know real numbers within a month instead of guessing.

### Phase 3: The high-yield channels (business development + 1 session each to wire up)
- DecksDirect direct partnership: pitch is "we generate permit-ready deck projects with itemized takeoffs; send us a rev share and we one-click your cart for composite/railing/steel/hardware." Our steel plans already spec Fortress products they stock. This is the scenario D unlock.
- Contractor lead gen: "Get quotes from local deck builders" CTA on the delivery page, via Home Depot Installation ($20 to $200/lead) and/or a home-services lead network. Serves the buyer segment that will never swing a hammer.
- Brand conversations (Trex/TimberTech/Simpson/Fortress): co-marketing or spec-placement deals, exploratory.

### Explicit non-goals
- No per-member cut lengths (S97 shelf stands; revisit gates unchanged).
- No cart-injection automation for retailers without sanctioned APIs (links and exports only; keeps us clean on terms of service).
- No paywalling the materials list behind an extra fee: the referral route replaces the gate idea, and a free priced list is itself the conversion asset.

## 7. Risks and guardrails

| Risk | Guardrail |
|---|---|
| Wrong quantity damages trust (same disease as wrong cut length, milder) | Phase 0 audit + tests before any price/link ships; explicit waste lines; "verify before purchase" wording; round up to store units |
| Stale or wrong prices | Nightly refresh, visible priced-as-of date, per-store caveat, hardcoded fallback marked "estimate" |
| Scraper API terms-of-service exposure | Prefer affiliate-network product feeds once approved (fully sanctioned); third-party APIs only for gap-fill; no direct scraping by us |
| SKU drift (retailers change SKUs/packaging) | Small fixed SKU map, drift check in the nightly refresh, alert on missing prices |
| Referral bias perception ("they spec what pays them") | Specs come from the structural engine, never from commissions; disclose affiliate links plainly (PCPartPicker's disclosure page is the model) |
| Home Depot competes upstream (Blueprint Takeoffs) | Our moat is instant + DIY + retailer-neutral + permit-attached; also treat their tool as a channel (our PDF is its input) |
| Effort creep | Phases are independently shippable; stop after any phase and keep the value delivered |

## 8. Decisions pending on Will

1. Green-light the phase order (0 then 1 then 2 then 3), or reorder.
2. Sign-ups (Will's side, needs his identity/accounts): Impact (Home Depot), Amazon Associates, CJ (Lowe's, optional), and a BigBox or SerpApi account with the key dropped into Railway as an env var (same pattern as the planned address autocomplete key).
3. DecksDirect outreach: Will to make contact (or approve an email draft) once Phase 1 is demo-able; the pitch is much stronger with a live priced list to show.
4. Whether to ask Billy for 2 or 3 real GC/DIY reactions to a mocked priced list before Phase 1 (cheap validation, strongly recommended).
5. Pricing display choice: show retailer names and prices openly vs a blended "estimated total" until affiliate approvals land.
6. Where this sits vs the other open work: the 3D no-hole bug remains the top product-quality item; suggested interleave is 3D bug next session, then Phase 0.

## 9. Technical feasibility, honestly (added at Will's request)

Verdict: HIGH feasibility. The engineering is routine; the risk lives in data quality and curation. Difficulty map:

### GREEN (easy, infrastructure already exists)
- The app already runs PostgreSQL on Railway (users, generations, events tables, pooled connections) and already integrates Stripe, so a price cache is one new table and a referral click log is one more. No new infrastructure.
- API keys follow the existing Railway env var pattern (REALIE_API_KEY, GOOGLE_SOLAR_API_KEY, etc.). The pricing key is one more of the same.
- No scheduler needed: use a lazy cache (when a cached price is older than 24 hours, refetch on the next request and update the row). Zero new moving parts, fine at beta volume.
- Displaying sourced prices on the Review page and a priced-as-of date on the PDF materials sheet is routine work, subject to the usual steps.js care, validation gate, and cache busters.
- Shopping list page, exports, disclosure page, and link generation are all routine.

### YELLOW (methodical grind, well-contained)
- The quantity audit (Phase 0). Aggregate counts are far more forgiving than cut lengths, and the config matrix plus the parity test give us the harness. But it crosses zones, cutouts, stairs, and steel, which is our historically buggiest geometry, so it needs the same discipline as any structural work: verify numerically, ship one change at a time.
- Item catalog sharpening. Several current line items are generic abstractions ("Post Base Hardware", "Wood Rail Kit", "Hurricane Ties + Nails" as a lump sum). To be shoppable they must become real orderable products (for example a specific Simpson post base model). This interacts with the audit and with the materials sheet text. The golden test pins the permit sheets (plan/framing/site/details), not the materials sheet, but verify blast radius before assuming.
- Frontend/backend split: prices must come ONLY from a new backend endpoint (single source of truth). engine.js keeps its hardcoded costs strictly as a fallback label ("estimate"). This avoids creating any new JS/Python parity burden.

### RED (the honest hard part)
- SKU MATCHING QUALITY. Mapping "2x10 Joists 16'" to the right Home Depot product is curation, not coding, and it can be quietly wrong: lumber brands and treatment types vary by region, search matching can return the wrong grade at the wrong price, and availability differs store to store. A confidently wrong price or product is a trust wound (same disease as a wrong cut length, milder). Mitigations: hand-curate the map starting with the ~25 highest-confidence items; display the matched product's real name and photo so the user sees exactly what was matched; mark unmapped or low-confidence items as "estimate"; test against 3 or 4 zip codes in different regions before shipping. Accept that the SKU map is an ongoing maintenance chore (drift check in the refresh path, alert on missing prices).
- AMAZON LIVE PRICES: effectively unavailable. Amazon's product data API (PA-API) requires an approved Associates account with 3 qualifying sales in 180 days, and continued access requires roughly 10 qualifying sales per trailing 30 days. Plan Amazon as static links only, no price display. Do not architect anything that depends on PA-API.
- APPROVAL DEPENDENCIES: affiliate link work (Phase 2) is blocked on program approvals that take days to weeks and are not guaranteed. The build plan sequences approval applications early so they overlap with Phase 0/1 build time instead of blocking it.

## 10. The build plan, session by session (~8 sessions of build work)

Each session follows the standing rules: read before editing, full validation gate, granular commits, busters bumped, plain-English report to Will, backout SHA provided.

### Phase 0: Make the quantities defensible (2 sessions)
- SESSION A: Audit `estimate_materials` / `estMaterials` line by line against the config matrix (zones, cutouts, stairs, steel, cantilever). Fix wrong counts. Convert silent fudges into explicit lines ("+2 extra, 10% waste"). Extend tests: a materials assertion pass over the matrix, parity intact.
- SESSION B: Item catalog sharpening (generic items become real orderable products), the sanctioned summary block on the materials sheet (area, perimeter, concrete volume, bags), and the "order list, verify quantities before purchase" wording. Verify the materials PDF renders clean; confirm golden/legibility unaffected.
- Exit test: Billy or a GC looks at one real config's list and says "yes, I could order from this."

### Phase 0.5: Materials List Excellence (2 to 3 sessions) [S99: THE near-term work, no external dependencies]
What the competitor research says to copy, ranked by value for effort. All of it works with zero applications, zero API keys.
- COST RANGES, not fake precision. Replace hardcoded single-figure totals with honest ranges ("materials typically $3,400 to $4,300") plus a priced-as-of note. The credible cost tools all present ranges because pricing varies by region; this fixes our stale-hardcoded-price problem before any API exists. Add a hiring-out context line (typical built cost range per square foot) so the customer sees the whole project picture, materials vs hired-out (the SimplyWise pattern of showing labor and materials separately).
- USAGE NOTES on hardware and fasteners (the Menards packet trick: every fastener and where it's used). Our engine already knows why each line exists, so each hardware line gains a short note: "Joist hangers, qty 36: one per joist end at ledger and beam." Build guidance and trust, safely NOT a cut list.
- STAGED PURCHASING grouping, unique to our permit-first wedge: group the list by build stage matching the inspection sequence (1: footings and foundation, before your footing inspection; 2: framing; 3: decking and railing). No captive retailer tool frames purchasing around the permit workflow.
- TOOLS REQUIRED list (the Etsy plan sellers' staple), generated from config features (footings imply post hole digger, mixing tub; composite implies hidden fastener tool; etc.). Trivial to add, loved by DIYers.
- SUMMARY BLOCK (already sanctioned in S97): deck area, perimeter, concrete volume, bag count.
- OUTPUT POLISH: printable checklist formatting (checkboxes, pro-desk friendly), CSV download, nominal vs actual dimension note, and the accuracy line we have uniquely earned: "quantities verified against the same structural engine that draws your permit set." (Competitive context: a recorded user complaint about RedX is material list discrepancies, so verified accuracy is the differentiator, not just hygiene.)
- Session split: SESSION C': ranges + summary block + usage notes (touches draw_materials.py + engine.js + Review display; parity and golden/legibility checked). SESSION D': staged grouping + tools list + checklist/CSV output. SESSION E' (if needed): polish, Billy feedback incorporated.

### Phase 1: Live localized pricing (3 sessions) [DEFERRED until the traffic trigger]
- SESSION C: SKU map v1 (top ~25 items, hand-curated, Home Depot only) as a data file; backend pricing module calling BigBox or SerpApi with zip from the project address; Postgres price cache table with 24h lazy refresh; hardcoded costs as labeled fallback. Admin endpoint to eyeball the cache.
- SESSION D: Surface it. Review page materials section shows sourced prices with store + priced-as-of date; PDF materials sheet gets the date stamp; unmapped items visibly labeled "estimate." Frontend fetches prices from our endpoint only.
- SESSION E: Hardening. Test against 3 or 4 zips in different regions; wrong-match sweep (compare returned product names against expectations); missing-price alerting; extend the SKU map toward full coverage where confidence allows.
- Exit test: a Colorado Springs config prices sanely, and a deliberately different-region zip prices differently and correctly.

### Phase 2: Shoppable list and first referral dollars (2 sessions) [DEFERRED until the traffic trigger]
- SESSION F: The Shopping List view: every line item with quantity, matched product (name + photo), price, subtotal, per-retailer Buy buttons where links exist; printable pro-desk/lumber-yard version; CSV export; FTC disclosure line and a disclosure page (PCPartPicker's is the model). Ships with plain links first if approvals are still pending.
- SESSION G: Affiliate wiring once approvals land (Impact link format for Home Depot, Associates tags for Amazon hardware links); click instrumentation into the existing events table so we measure real click-through and, where the networks report it, conversions.
- Exit test: a real purchase click tracks end to end in the Impact dashboard.

### Phase 3: High-yield channels (1 session each, plus Will's business development) [DEFERRED until the traffic trigger]
- DecksDirect (or similar) direct partnership: after Phase 1 exists, Will sends the outreach (draft provided on request); if a deal lands, one session wires their catalog/links for composite, railing, steel, and hardware. This is the scenario D unlock and the biggest single revenue lever.
- Contractor lead generation: "Get quotes from local deck builders" CTA on the delivery page via Home Depot Installation and/or a home-services lead network; one session to wire and instrument.

### Sequencing vs other open work
The 3D stairs no-hole bug remains the top product-quality item and should not wait 8 sessions. Suggested interleave: 3D bug next build session, then Phase 0, then alternate as needed. Phases are independently shippable; stopping after any phase still leaves delivered value.

## 11. Will's checklist (plain English, in order) [ALL ON HOLD per the S99 deferral; execute when the traffic trigger is met, roughly 10 plan customers/month]

1. NOW: Apply to the Home Depot affiliate program. Go to homedepot.com/c/affiliate_program, click Join Now, create a free Impact account, and fill in the application: your site (simpleblueprints.xyz), your audience (DIY deck builders and contractors getting permit plans), and how you'll promote (a priced material shopping list attached to each generated plan set). Use a business email (an @simpleblueprints.xyz address reads far better than Gmail). Free to apply. Approval takes from a couple of business days up to about three weeks, which is why this starts now, in parallel with the build. Note for later: payouts arrive about 90 days after a sale, by direct deposit or check (their program does not pay via PayPal).
2. NOW: While inside Impact, also look for the Home Depot Installation (lead generation) program and apply if it's open to us. It pays roughly $20 to $200 per qualified lead with a 30 day cookie, which is the best per-click economics available to us.
3. NOW: Create the pricing data account. Either BigBox API (trajectdata.com, from about $15/month) or SerpApi (free tier of about 100 searches/month to prototype, then roughly $50/month). Credit card signup, no approval process. Put the key into Railway as an env var (suggested name SBP_PRICING_API_KEY), exactly like the Realie key. I can walk you through it in-session.
4. DO NOT YET: Amazon Associates. Signing up starts a clock: three qualifying sales within 180 days or the account is closed (you can reapply, but it's a hassle). We sign up in Phase 2, right before links go live, so the clock starts when sales are actually possible. When we do: affiliate-program.amazon.com, free, needs the site plus a disclosure statement on it (I'll have the disclosure page built by then).
5. DURING PHASE 0/1: Ask Billy to show the priced list mock to 2 or 3 real GCs or DIYers and collect reactions. Cheap validation before we polish.
6. DURING PHASE 1: One product decision: show retailer names and prices openly from day one, or show a blended "estimated total" until affiliate approvals land. My recommendation is open retailer pricing immediately (it's the value), links come when they come.
7. PHASE 2/3: DecksDirect outreach. I draft the email; you send it. The pitch is strongest once the live priced list exists to demo. If they bite, the negotiation ask is a rev share (target 5 to 10%) on referred orders, tracked via a partner code or their preferred mechanism.
8. ADMIN, small but real: affiliate networks will ask for a W-9 and payout details, and affiliate income is taxable income to the business. Not advice, just flagging it so it's not a surprise (worth a mention to your accountant alongside the Stripe revenue).

## 12. Go to market for the feature itself

1. Naming and framing on-site: "Your plans + a priced shopping list for the store near you." Update the homepage and the permit landing page copy once Phase 1 ships. The priced list becomes a primary screenshot asset (nobody else in the permit-plan space shows one).
2. Review page: a "includes your priced material list" line near the Generate CTA doubles as the trust signal we already wanted there (ties into the deferred social-proof item).
3. Ads angle: "deck permit plans with material list and cost" style keywords. Purchase intent is high and the captive tools don't compete on permit terms.
4. SEO play (bigger, later): programmatic cost pages powered by our own engine and live pricing ("what a 12x16 deck costs to build in Colorado Springs, itemized"). Decks.com owns this traffic today with static content; we can answer it with real localized numbers. Worth its own planning pass after Phase 2.
5. Announcement moment: when Phase 2 ships, that's the "SimpleBlueprints now tells you exactly what to order and what it costs near you" beat for any channel we have (site banner, Billy's network, ads refresh).

## 13. Sources (verify at execution time; affiliate terms change)

- PCPartPicker model: pcpartpicker.com/disclosure, en.wikipedia.org/wiki/PCPartPicker, grokipedia.com/page/PCPartPicker
- Home Depot affiliate terms: creatorinvestor.com, funnelscene.com, odiproductions.com (1 to 8%, 24h cookie, in-store excluded; Installation program $20 to $200/lead)
- Lowe's affiliate terms incl. lumber exclusion: medium.com/@affiliatedatamine/lowes-affiliate-program, nichepursuits.com/lowes-affiliate-program, geniuslink.com/blog/lowes-affiliate-program
- Amazon rates: geniuslink.com/blog/amazon-affiliate-commission-rates (home improvement 3% since April 2020)
- Menards Design & Buy: menards.com/main/a-deck.html, engineerfix.com Menards deck designer guide
- Lowe's Deck Designer: lowes.com/l/about/deck-designer-planner
- Home Depot Blueprint Takeoffs (Nov 2025): corporate.homedepot.com/news/company/home-depot-launches-ai-powered-blueprint-takeoffs, digitalcommerce360.com analysis
- Price data APIs: trajectdata.com (BigBox API, from $15/mo, zip-localized), serpapi.com/home-depot-search-api
- DecksDirect: decksdirect.com/pro-program (Pro loyalty program; no public affiliate program found)
