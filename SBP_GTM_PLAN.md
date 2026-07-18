# SimpleBlueprints Go-To-Market Plan
## Market Research Summary + GTM Strategy + Product Roadmap
### July 2026

---

## 1. COMPETITIVE LANDSCAPE

### Direct Competitors (Permit Plan Generators)

**RedX Decks** (redxapps.com/redx-decks-app)
- What: 3D deck design software with structural calculations, permit-ready blueprints, cut lists
- Platform: Web, iOS, Android
- Pricing: Free (limited) / $4.99/mo single app / $14.99/mo all apps / $14.99/seat/mo org
- Strengths: Arbitrary shape drawing, AI text-to-deck ("describe your deck"), multi-platform, roof-over-deck, photorealistic renders, cut list with exact board lengths
- Weaknesses: No site plan with property data, no parcel lookup, immediate paywall frustrates users, steep learning curve, app crashes, cross-device sync broken, no IRC code citations
- Users: ~1,000+ (App Store claim, likely total installs not active paid)
- Est. Revenue: $2K-8K/month
- Team: 1-3 people, Ontario Canada, founded by a carpenter
- Customer acquisition: Google Ads on "deck designer" keywords, App Store organic, SEO blog content, help center
- Key user complaints: Paywall before trying, crashes, unintuitive resizing, missing features, material list discrepancies

**Etsy/Gumroad Sellers** (BlueprintUnlimited, others)
- What: Pre-made, fixed-dimension deck plan PDFs
- Pricing: $29-50 per plan set
- Strengths: Instant download, cheap, simple purchase flow, Etsy marketplace discoverability
- Weaknesses: Fixed dimensions only (8x10, 12x14, etc.), no customization, no site plan, no structural calculations, generic
- Volume: BlueprintUnlimited has 49 orders/month, 20+ daily views per listing
- Customer acquisition: Etsy search, Etsy ads

**Fiverr Drafters** (permit-drawing category)
- What: Human-drafted custom permit drawings
- Pricing: $50-190+ per plan set
- Strengths: Fully custom, human judgment on local codes, can handle unusual situations
- Weaknesses: Days of turnaround, quality varies, communication overhead, no instant delivery
- Volume: 7,210 services available in permit drawing category
- Customer acquisition: Fiverr marketplace

### Indirect Competitors (Design/Visualization Tools)

**Decks.com** (owned by Trex)
- What: Free pre-made deck plans in fixed sizes + free deck designer tool
- Purpose: Content marketing to sell Trex products
- Strengths: Free, professional quality, good SEO, strong brand, materials breakdown included
- Weaknesses: Fixed sizes (10 per design), no site plan, no property data, no customization, funnel to Trex products
- Mentioned in Reddit threads as a go-to resource
- Customer acquisition: SEO (excellent), brand recognition, Trex marketing budget

**TimberTech Deck Designer** (timbertech.com)
- What: 3D visualization and product selection tool
- Purpose: Sell TimberTech decking and railing products
- Strengths: Free, polished 3D, color/material selection, detailed take-off list, works on tablets
- Weaknesses: No permit plans, no structural calculations, no site plan, product catalog not a permit tool
- Customer acquisition: Trex/AZEK marketing budget, Google Ads

**Trex Deck Cost Estimator** (trex.com)
- What: Simple cost calculator
- Purpose: Lead capture for Trex sales
- Strengths: Free, simple
- Weaknesses: No design, no plans, no structural calc, email required for results
- Customer acquisition: Trex brand, Google Ads

**DecksDirect** (decksdirect.com)
- What: Materials retailer with planning services
- Purpose: Sell physical deck products (boards, railing, hardware, lighting)
- Not a competitor: Sells materials, not plans. 103K+ reviews, established retailer since 2008
- Potential partner: SBP could link to DecksDirect for material purchasing

**Simpson Deck Designer** (historical)
- What: Free structural design tool (no longer exists in original form)
- Mentioned in Reddit as useful but required Photoshop fixes for permit submission
- Relevance: Validates demand for a tool that "just works" for permits

### Non-Tool Alternatives

**Hand-drawn plans on graph paper**
- Dominant advice in DIY forums ("just draw your own")
- Free, accepted by most building departments
- Requires knowledge of span tables, footing requirements, code
- The person who does this is not SBP's customer

**Local permit office assistance**
- Free, helpful staff in many jurisdictions
- Multiple Reddit users report spending 1+ hours getting walked through requirements
- Not scalable but sets the bar for what "help" looks like

---

## 2. TARGET AUDIENCES

### Audience A: "Permit-Confused Homeowner" (PRIMARY)
- Who: Homeowner who wants to build a deck, knows they need a permit, doesn't know how to get one
- Search behavior: "do I need a permit for a deck", "how to get a deck building permit", "deck permit requirements [city]", "what do I need for a deck permit"
- Pain: Overwhelmed by requirements, doesn't know their lot dimensions, doesn't want to hand-draw plans, doesn't want to spend hours at the permit office
- Willingness to pay: $49-99 for a solution that eliminates the permit obstacle
- Where they are: Google search, home improvement forums (lurking not posting), YouTube "how to build a deck" videos, local Facebook groups
- What they need from SBP: Enter address, get plans, submit to building department. Minimum friction.

### Audience B: "Experienced DIY Builder" (SECONDARY)
- Who: Has built decks before, knows construction, views permit drawings as a chore
- Search behavior: "deck plans for permits", "deck plan software", "free deck plans", "deck span calculator"
- Pain: Can build the deck, doesn't want to spend time on paperwork. Wants professional-looking plans without hand-drawing.
- Willingness to pay: $29-49 if it saves significant time. Price-sensitive, compares against free options.
- Where they are: r/Decks, r/HomeImprovement, contractor forums, YouTube
- What they need from SBP: Fast, accurate output. Cut list. Professional PDF. They'll verify the structural sizing themselves.

### Audience C: "Small Contractor" (TERTIARY)
- Who: 1-5 person deck building business, builds 10-50 decks/year
- Search behavior: "deck design software for contractors", "permit plan generator", "deck blueprint software"
- Pain: Spending hours per project on permit drawings, or paying a drafter $150-500
- Willingness to pay: $15-30/month subscription or $30-50 per plan if it replaces their drafter
- Where they are: Contractor forums, trade shows, Google Ads, word of mouth
- What they need from SBP: Volume pricing, speed, professional output they can put their name on, client-facing 3D renders

### Audience D: "Plan Examiner / Building Department" (INFLUENCER)
- Who: Municipal staff who review and approve/reject deck permit applications
- Not a paying customer but a critical influencer. If they recommend SBP to applicants, it's the most powerful acquisition channel possible.
- Where they are: NADRA conferences, ICC events, municipal networks
- What they need: Plans that consistently meet their requirements so they spend less time on deck permits

---

## 3. CHANNEL STRATEGY

### Channel 1: SEO (Highest Priority, Lowest Cost)

**Current state:** SBP's website is entirely client-side rendered React. Google cannot crawl it. This is the single biggest growth blocker.

**Fix required:** Server-rendered landing page with proper meta tags, FAQ schema, Open Graph tags. This is not optional. Every other channel drives traffic to a page Google can't index.

**Target keywords (by audience):**

Audience A (permit-confused):
- "how to get a deck building permit" (informational, blog post)
- "deck permit requirements [state/county]" (localized, blog series)
- "deck permit plans" (transactional, landing page)
- "deck setback requirements" (informational, blog post)
- "do I need a permit for a deck" (informational, blog post)

Audience B (DIY builder):
- "deck plans for permits" (transactional, landing page)
- "permit ready deck plans" (transactional, landing page)
- "deck plan generator" (transactional, landing page)
- "free deck plans with dimensions" (competitive, offer free preview)

Audience C (contractor):
- "deck permit software" (transactional, landing page)
- "deck blueprint generator" (transactional, landing page)
- "deck design software with site plan" (differentiator keyword)

**Content plan:** 10-15 blog posts targeting permit-related long-tail keywords. Each post answers a specific question, includes a CTA to try SBP. Focus on states with high deck-building volume: NY, NJ, CT, MA, PA, TX, FL, CA, CO, WA.

**Estimated timeline:** 2-3 sessions for technical SEO fix, 1-2 sessions for initial blog posts.

### Channel 2: Google Ads (Fastest to Revenue)

**Target keywords:** "deck permit plans", "deck building permit application", "permit ready deck plans", "deck blueprint for permit"

**Why these work:** Lower competition than "deck designer" (where RedX and TimberTech compete). Higher purchase intent. The person searching "deck permit plans" is ready to buy, not browsing.

**Estimated CPC:** $2-5 for permit-specific keywords vs $8-15 for generic "deck designer" keywords.

**Landing page:** Dedicated permit-focused landing page, not the main app. Show a sample PDF output, address auto-detection demo, price, and CTA.

**Budget to test:** $500-1,000/month for 2-3 months. Target 100-200 clicks/month. At 5% conversion and $49/plan, that's 5-10 sales = $245-490 revenue. Not profitable immediately but validates demand and refines messaging.

### Channel 3: Etsy/Gumroad (Market Validation)

**Strategy:** List SBP-generated plans on Etsy as "Custom Deck Permit Plans - Enter Your Address" at $39-49. Differentiator: customized to buyer's actual property vs fixed dimensions. Etsy handles discoverability, payment, and trust.

**Why this works:** BlueprintUnlimited sells 49 static plans/month at $29-39. A custom plan with a real site plan at $39-49 is a premium offering in an established marketplace. Zero marketing cost beyond Etsy fees.

**Execution:** Could be semi-automated. Buyer provides address and deck dimensions in Etsy message, you generate through SBP, deliver PDF. Later, automate with a custom Etsy integration.

### Channel 4: Reddit/Forum Seeding (Free, Slow)

**Strategy:** When someone posts "deck plans for permits" or "how to submit deck permit" in r/Decks, r/HomeImprovement, r/DIY, respond helpfully with genuine advice AND mention SBP as an option. Not spammy, not self-promotional. Helpful first, tool mention second.

**Why this works:** The Reddit thread showed that nobody recommends a good paid tool. SBP fills a visible gap. One authentic recommendation in the right thread reaches hundreds of lurkers.

### Channel 5: Building Department Partnerships (Long-term, High Value)

**Strategy:** Contact 5-10 building departments in high-volume deck permit areas (Suffolk County, Nassau County, Westchester, etc.). Offer a free link or QR code they can include in their deck permit information packets. "Need help with your deck plans? Try SimpleBlueprints.xyz"

**Why this works:** Building departments want fewer incomplete applications. If SBP produces consistently approvable plans, the department saves review time. It's a win-win.

**Execution:** Start with your local jurisdiction (Suffolk County / Town of Islip). Walk in, show the product, ask if they'd be willing to mention it to applicants.

---

## 4. GAPS AND LOWEST-HANGING FRUIT

### Gap Analysis

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| Google can't crawl SBP website | Blocks all organic growth | 2-3 sessions | CRITICAL |
| No Stripe checkout flow working | Can't collect money | 1-2 sessions | CRITICAL |
| No cut list with board lengths | Missing table-stakes feature vs RedX/Etsy | 3-4 sessions | HIGH |
| No blog/content for SEO | No organic traffic pipeline | 2-3 sessions | HIGH |
| S73 bugs not fully tested | Risk of broken experience for new users | 2-3 sessions | HIGH |
| No mobile responsiveness | Poor experience on phones/tablets | 3-4 sessions | MEDIUM |
| No testimonials/social proof | Low trust for new visitors | 1 session | MEDIUM |
| No Etsy/marketplace presence | Missing established sales channel | 1 session | MEDIUM |
| No email capture/drip | No way to nurture interested visitors | 1-2 sessions | MEDIUM |
| Shape flexibility limited to rectangles | Can't match RedX on design freedom | 8-12 sessions | LOW (defer) |
| No mobile app | Missing App Store discovery | 15-20 sessions | LOW (defer) |
| No roof-over-deck | Missing RedX feature | 10+ sessions | LOW (defer) |

### Lowest-Hanging Fruit (ranked by impact/effort ratio)

1. **Make the website crawlable** - Server-rendered landing page. Without this, nothing else matters.
2. **Stripe checkout working end-to-end** - Can't make money without this.
3. **List on Etsy** - Immediate access to buyers actively searching for deck plans. Zero marketing cost.
4. **Google Ads on permit keywords** - Fastest paid channel to validate demand.
5. **3-5 blog posts on permit topics** - Start building organic traffic pipeline.
6. **Fix critical S73/S82 bugs** - Don't send paid traffic to a broken product.
7. **Add cut list to PDF** - Closes the biggest feature gap vs RedX and Etsy sellers.
8. **Building department outreach** - Start with Suffolk County. One partnership = ongoing referrals.

---

## 5. PRODUCT UPDATES FOR THE NEXT 2 MONTHS (10 Items)

### Must-Ship (Weeks 1-4)

**1. SEO-Ready Landing Page**
What: Server-rendered HTML landing page at simpleblueprints.xyz with proper meta tags, OG tags, FAQ schema, keyword-rich copy, and a clear CTA. The React app loads after click-through.
Why: Google cannot index the current site. Every marketing dollar is wasted until this is fixed.
Effort: 2-3 sessions
Competes with: Decks.com (excellent SEO), RedX (strong meta tags and keyword coverage)

**2. Stripe Checkout End-to-End**
What: Working payment flow. User completes deck design, clicks "Download Plans", pays $49-79, receives PDF.
Why: No revenue without this. Everything else is academic.
Effort: 1-2 sessions (Stripe integration already partially built)
Pricing recommendation: $49 for standard plan, $79 for plan + cut list (when available)

**3. Bug Fixes from S73/S82**
What: Test S73 coordinate unification on 5+ different property orientations. Fix elevation zone heights (S82f). Fix multi-stair site plan (S82d).
Why: Paid traffic to a buggy product is worse than no traffic. The auto-detection flow must work reliably.
Effort: 3-4 sessions

**4. Cut List with Board Lengths**
What: Add a materials page to the PDF that lists every individual board, joist, beam, and post with exact lengths and quantities. Organized by component (decking, framing, substructure).
Why: This is what the Etsy sellers include for $29. RedX includes it. It's table stakes for a paid product. Also differentiates from Decks.com free plans which only list general materials.
Effort: 3-4 sessions
Competes with: RedX (has this), Etsy sellers (have this), Decks.com (has materials breakdown)

### Should-Ship (Weeks 5-8)

**5. Blog + Content Hub**
What: 5-10 SEO-optimized blog posts targeting permit-related keywords. "How to Get a Deck Permit in New York", "Deck Setback Requirements Explained", "What Your Building Department Wants to See in Deck Plans", etc.
Why: Long-tail organic traffic. Each post is a permanent asset that compounds over time.
Effort: 2-3 sessions for infrastructure + initial posts
Competes with: Decks.com (strong content), RedX (has blog), Trex (has how-to guides)

**6. Landing Page for Google Ads**
What: Dedicated permit-focused landing page separate from the main app. Shows sample PDF output, highlights address auto-detection, displays price, has clear CTA. Optimized for conversion, not exploration.
Why: Google Ads sending traffic to the main app will convert poorly. A focused landing page with one action ("Get Your Deck Permit Plans") converts 3-5x better.
Effort: 1-2 sessions
Competes with: RedX (dedicated landing pages per feature), Trex (dedicated cost calculator page)

**7. Sample PDF Preview**
What: Let visitors see a complete sample permit plan PDF (for a demo address) without signing up. Watermarked or for a sample property. Shows all 7 sheets.
Why: The PDF is SBP's best sales tool. People need to see what they're buying. RedX shows screenshots of their blueprints on their landing page. Etsy sellers show preview images. SBP shows nothing until you complete the entire wizard.
Effort: 1 session (generate a sample, host it as a static PDF)
Competes with: Everyone (all competitors show their output upfront)

**8. Social Proof**
What: Add 3-5 testimonials or case studies to the landing page. Could be from beta testers, friends who've used SBP, or your own permit submission experience. Add a "Plans accepted by building departments in NY, NJ, CT..." line if true.
Why: Nobody buys a $49-79 product from an unknown website without trust signals. RedX has "Trusted by 1K+ people" on their site. Decks.com has Trex brand behind it. SBP has nothing.
Effort: 1 session
Competes with: RedX (testimonials, App Store reviews), DecksDirect (103K reviews)

### Nice-to-Ship (If Time Allows)

**9. Etsy Listing**
What: Create 3-5 Etsy listings for "Custom Deck Permit Plans - Your Actual Property". Differentiate from static plan sellers by emphasizing customization and real site plan. Fulfill semi-manually initially.
Why: Immediate access to an audience already paying $29-50 for inferior static plans. Validates pricing. Generates revenue and testimonials.
Effort: 1 session to create listings, ongoing fulfillment time
Competes with: BlueprintUnlimited ($29-39 static plans), other Etsy deck plan sellers

**10. Email Capture + Nurture**
What: Capture email when users create an account or start a project. Send a follow-up sequence: "Your deck plans are ready to download" (if they abandoned), "How to submit your deck permit" (educational), "5 things your building department checks on deck plans" (value).
Why: Most visitors won't buy on first visit. Email brings them back. The educational content positions SBP as the expert.
Effort: 1-2 sessions
Competes with: Trex/DecksDirect (sophisticated email marketing), RedX (none visible)

---

## 6. 2-MONTH TIMELINE

### Weeks 1-2: Foundation
- Session 1: SEO landing page (server-rendered HTML, meta tags, FAQ schema)
- Session 2: Stripe checkout end-to-end + pricing page
- Session 3: S73/S82 bug fixes, test on 5+ property orientations

### Weeks 3-4: Core Product
- Session 4: Cut list feature (board lengths + quantities in PDF)
- Session 5: Cut list polish + sample PDF preview for landing page
- Session 6: Google Ads landing page + campaign setup ($500/month test)

### Weeks 5-6: Content + Distribution
- Session 7: Blog infrastructure + first 3 posts (permit-focused keywords)
- Session 8: Social proof (testimonials, trust badges) + 2 more blog posts
- Session 9: Etsy listings (3-5 custom plan listings)

### Weeks 7-8: Optimization
- Session 10: Analyze Google Ads data, optimize landing page conversion
- Session 11: Email capture + nurture sequence
- Session 12: Additional blog posts, Reddit/forum engagement, building dept outreach

### Expected Outcomes After 2 Months
- Google can index the site (SEO pipeline started)
- Google Ads running with data on CPC, conversion rate, and CAC
- First paid customers (target: 10-30 sales)
- Etsy presence validated (target: 5-15 sales)
- 5-10 blog posts generating organic impressions
- Critical bugs fixed, product stable for new users
- Cut list feature closes biggest gap vs competitors

---

## 7. PRICING STRATEGY

### Recommended Model: Per-Plan Purchase

**Why not subscription (like RedX):** SBP's primary customer (Audience A) needs one plan for one project. They're not building decks monthly. A subscription feels like waste. RedX's subscription model generates complaints ("paywall immediately"). Per-plan aligns with how the customer thinks: "I need a permit, here's $49, give me the plans."

**Why not free (like Decks.com):** SBP doesn't sell physical products to monetize downstream. The plans ARE the product.

**Recommended tiers:**

| Tier | Price | Includes |
|------|-------|----------|
| Standard | $49 | 7-sheet permit plan PDF (cover, plan, framing, elevations, details, notes, site plan) |
| Complete | $79 | Standard + cut list with board lengths + materials shopping list |

**Etsy pricing:** $39-49 (Etsy takes ~13% in fees, so net ~$34-43)

**Fiverr comparison:** Custom deck plans on Fiverr start at $50-190. SBP at $49-79 with instant delivery undercuts human drafters on both price and speed.

**Free tier:** Let users complete the entire wizard and see the site plan preview for free. Only charge for PDF download. This lets them verify the product works for their property before paying. Directly addresses RedX's #1 complaint (paywall before trying).

---

## 8. KEY METRICS TO TRACK

| Metric | Target (Month 1) | Target (Month 2) |
|--------|-------------------|-------------------|
| Website visits (organic) | 50-100 | 200-500 |
| Website visits (paid) | 100-200 | 200-400 |
| Plans generated (free preview) | 30-50 | 80-150 |
| Plans purchased | 5-10 | 15-30 |
| Revenue | $245-790 | $735-2,370 |
| Google Ads CPC | $3-5 | $2-4 (optimized) |
| Conversion rate (visit to purchase) | 2-5% | 5-8% |
| Etsy sales | 3-5 | 8-15 |
| Blog posts published | 3 | 8-10 |

---

## APPENDIX: SOURCE LINKS

- RedX Decks: https://www.redxapps.com/redx-decks-app
- RedX Pricing: https://www.redxapps.com/pricing
- RedX App Store reviews: https://apps.apple.com/us/app/redx-decks-3d-deck-builder/id6474487367
- RedX Google Play reviews: https://play.google.com/store/apps/details?id=com.RedXApps.Decks
- TimberTech Deck Designer: https://www.timbertech.com/design/deck-designer/
- Trex Cost Estimator: https://www.trex.com/build-your-deck/planyourdeck/deck-cost-landing/
- Decks.com (Trex): https://www.decks.com/deck-plans/
- DecksDirect: https://www.decksdirect.com/
- Etsy deck plans (BlueprintUnlimited): https://www.etsy.com/shop/BlueprintUnlimited
- Gumroad deck plans: https://outdoorseatingarea.gumroad.com/l/pnpvd
- Fiverr permit drawings: https://block.fiverr.com/gigs/permit-drawing
- Reddit r/Decks thread: https://www.reddit.com/r/Decks/comments/18s3gdv/deck_plans_for_permits/
- Trex how to draw deck plans: https://www.trex.com/deck-ideas/how-to-draw-deck-plans/
- SAFEbuilt deck permit guide: https://calhouncounty.sc.gov (2018 IRC Building Guide)
- Seattle deck permit requirements: https://www.seattle.gov/DPD/Publications/CAM/cam312.pdf
- Minneapolis deck guidelines: https://www.minneapolismn.gov (Wood Deck Guidelines)
