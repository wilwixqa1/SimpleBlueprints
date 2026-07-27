# SimpleBlueprints — UI/UX Session Context

Written at the end of S104, for a session focused on interface and user
experience. Repo state: main @ `5ec2b43`, gate green, 31 suites.

**How to use this.** Sections 1–3 are orientation, read them. Sections 4–7 are
reference, read the part you're touching. Section 8 is tooling that changed this
session and materially affects how UI work can be verified. Section 10 is the
actual agenda: known weaknesses and open decisions.

**Accuracy note.** Everything here was read out of the code at S104, with file
and line references so it can be re-checked rather than trusted. Where something
is inference rather than verified, it says so.

---

## 1. NORTH STAR — what this is all for

From `MASTER_CONTEXT.txt`, unchanged and still governing:

> **The business milestone that matters: one generated package approved by a real
> building department.** Nothing else counts as validation.

Jurisdiction is Colorado Springs / Pikes Peak Regional Building Department
(PPRBD), because partner Billy operates there and the professional reference sets
are PPRBD permit sets.

Will restated the north star in two parts, and both are UX statements:

> (a) pass the permit, (b) **LOOK professional enough that a contractor feels safe
> submitting it.** Benchmark = the reference sets, goal "as clean or better."

**(b) is the one this session's work lives under.** A drawing that is
structurally correct but looks amateur does not get submitted, so it never gets
approved, so the milestone never happens. Visual credibility is not polish; it is
on the critical path.

**Target customer (decided S84): contractors, not DIY homeowners.** Homeowners
are still served and still the larger audience by count, but contractors are
weighted higher because of repeat business. Implication for UX: the wizard should
respect that a contractor already has a survey, already knows their setbacks, and
values speed over hand-holding. The current guided flow assumes the opposite.

**Feature freeze (agreed S84, still in force):** no new capabilities — no sheds,
no pergolas, no new zone types, no new stair templates — until the milestone is
hit. `calc_shed.py` and `calc_pergola.py` exist and stay dormant. **UI/UX work is
not a new capability and is not frozen.** Making the existing thing clearer is
explicitly in scope.

Pricing: Stripe wired but not active, `BLUEPRINT_PRICE=2900` ($29). Free during
beta. Contractor pricing ($49–99) is an open decision from S89.

---

## 2. THE USER JOURNEY, AS THE USER ACTUALLY EXPERIENCES IT

### 2.1 Entry

Homepage (`home.js` `HomePage`) is a marketing page scoped under `.sb-home` so
the wizard's styles never collide with it. Sections: hero with address input,
How it works, Sample drawing set, Pricing, FAQ, closing CTA, footer.

The footer grid is `1.4fr 1fr 1fr` (`home.css:239`) and now has three columns:
brand, Product, Support.

Entry points into the wizard: the hero address field, the closing CTA, "New Deck"
on the drafts page, or opening a saved project.

### 2.2 The five wizard steps

`app.js:1184` defines them:

| # | Name | What the user does |
|---|---|---|
| 0 | Site Plan | Establish the property: lot shape, house footprint, setbacks |
| 1 | Size & Shape | Deck dimensions, zones, cutouts, stairs |
| 2 | Structure | Framing material, beam type, joist spacing, heights |
| 3 | Finishes | Decking material, railing type |
| 4 | Review | Gallery of rendered sheets, then download |

Step 4 is a **delivery page, not an editing step** (S96.5). Two-column,
gallery-first, sticky rail, lightbox.

### 2.3 Step 0 is the hard one, and it is a guided flow

Step 0 is not a form. It is a state machine with sixteen phases, defined in
`steps.js`:

```
has_survey → address_lookup → address_verifying → footprint_loading
           → upload_survey → extracting → shape_select → verify_extracted
           → trace_or_manual → lot_dims → house_position → setbacks
           → site_elements_check → north_arrow → slope → complete
```

The current phase lives in `guidePhase` with an async-safe mirror in
`guidePhaseRef` (S96.5 — the ref exists because setState is async and the phase
was being read stale). `guideAdvance()` pushes the previous phase onto
`guideHistory`, which is what makes the Back button render.

**Three ways in, ranked in the UI:** address lookup (default), upload a survey
("BEST IF YOU HAVE ONE"), enter manually ("LAST RESORT"). This ranking is
deliberate and is shown as "Other ways in" beneath the address field.

`guideActive` defaults to true (S63). Manual mode is reachable via "Switch to
manual" and shows all sections at once.

**This is where users are lost or won.** It is the first thing anyone does, it
depends on external APIs that fail, and until S104 a failed lookup left no trace
in the analytics at all.

### 2.4 What happens behind step 0

1. `POST /api/parcel-lookup` → Realie API → lot polygon, dimensions, zoning
   setbacks. **Served from `parcel_cache` first** (`main.py:2112`) if an entry
   exists that is under 30 days old.
2. Building footprint → Google Solar API for the authoritative building, falling
   back to OpenStreetMap Overpass. Picks the in-parcel building, swaps
   width/depth if the long axis is perpendicular to the street, and rejects
   neighbouring garages and sheds by distance.
3. A confidence level (`high` / `medium` / `low`) is computed from data-quality
   signals and surfaced to the user with specific messages about what to verify.

That confidence UI is genuinely good and worth preserving: it tells the user
*which* thing to check rather than a generic "please verify."

### 2.5 Auth and persistence

Google OAuth only (`users.google_id` is NOT NULL). **Saving requires being signed
in** — `app.js:1027` and `app.js:1040` both bail without a user. Anonymous users
can do everything up to generating, and lose it all on refresh.

Autosave: debounced 3s, on changes to params, info, step, or site plan mode.
Creates the project on first meaningful edit, then PUTs updates.

As of S104 the active project id lives in the URL (`?project=<id>`), so a refresh
resumes the same project. Before that it was memory-only and every refresh
spawned a duplicate.

---

## 3. ARCHITECTURE — what owns what

### 3.1 Frontend (15,447 lines)

| File | Lines | Owns |
|---|---|---|
| `steps.js` | 5322 | All five step bodies, the guided flow, every form control |
| `deck3d.js` | 1688 | Three.js scene, and `window.capture3D` for the PDF cover |
| `app.js` | 1528 | Shell, routing, auth, autosave, generate, wizard nav |
| `engine.js` | 1254 | Structural calc **mirror of `calc_engine.py`** |
| `zoneUtils.js` | 1208 | Zone geometry **mirror of `zone_utils.py`** |
| `sitePlanView.js` | 782 | Site plan canvas |
| `home.js` | 599 | Homepage, drafts page, shared theme (`window.SB`), support contact |
| `traceView.js` | 576 | Survey tracing |
| `elevationView.js` | 535 | Elevation canvas |
| `steelDeckData.js` | 530 | Steel framing tables |
| `planView.js` | 519 | Plan canvas, zone drag/drop, stair placement |
| `lotGeometry.js` | 378 | Lot maths, house positioning |
| `stairGeometry.js` | 359 | Stair geometry **mirror of `stair_utils.py`** |
| `tracking.js` | 169 | Analytics, loads before React |

**Loading is split (S62).** Phase 1 loads immediately: `steelDeckData`, `engine`,
`stairGeometry`, `zoneUtils`, `home`, `lotGeometry`, `app`. Phase 2 loads on
wizard entry: Three.js from cdnjs, then `planView`, `elevationView`, `deck3d`,
`sitePlanView`, `traceView`, then `steps`. This keeps the landing page fast.

**Cache busting:** every script tag carries `?v=sNNNx`, bumped by hand.
`index.html` itself now sends `no-cache, must-revalidate` (S104 push 6) — before
that, a stale shell could pin visitors to old bundle versions indefinitely.

**Three parity pairs must stay in lockstep**, and every one of them has caused a
real bug: `engine.js` ↔ `calc_engine.py`, `zoneUtils.js` ↔ `zone_utils.py`,
`stairGeometry.js` ↔ `stair_utils.py`. Guarded by
`tests/test_frontend_parity.py` and `tests/test_cross_system_consistency.py`.

**The wizard is styled with 877 inline style objects**, which CSS selectors
cannot reach — 709 in `steps.js`, 117 in `app.js`, 37 in `planView.js`, 14 in
`elevationView.js`. (Counted at S104. `home.css:254` says ~814; that comment is
stale and the number has grown.) This is the single biggest constraint on UI work. The
homepage has a real stylesheet (`home.css`, scoped `.sb-home`) and a mobile
breakpoint at 760px. The wizard has neither, and its mobile handling is a small
media query in `index.html` that stacks columns below 640px by targeting three
hand-added class names (`sbp-wizard-row`, `sbp-preview-col`, `sbp-review-row`).

### 3.2 Backend drawing (17,785 lines)

| File | Lines | Role |
|---|---|---|
| `irc_tables.py` | 3874 | IRC 2021 span tables |
| `permit_checker.py` | 1725 | 21 compliance checks, drives readiness % |
| `draw_elevations.py` | 1596 | Elevation sheet |
| `draw_plan.py` | 1228 | Plan + framing |
| `calc_engine.py` | 1098 | Structural sizing |
| `draw_site_plan.py` | 1029 | Site plan |
| `draw_details.py` | 928 | Construction details |
| `draw_materials.py` | 687 | Material list |
| `stair_utils.py` | 626 | Stair geometry, six templates |
| `zone_utils.py` | 599 | Zone geometry, exposed edges, stair openings |
| `beam_layout.py` | 242 | **Cutout-aware beam and post layout** |

---

## 4. ZONES, NOTCHES, CUTOUTS — the part you asked about

### 4.1 The data model

One schema, documented in `zoneUtils.js:20-45` and mirrored in Python:

```js
{
  id:           Number,   // unique, never reused. 0 = main deck (virtual)
  type:         String,   // 'add' | 'cutout'
  w:            Number,   // width (ft) along the attachment edge
  d:            Number,   // depth (ft) perpendicular to it
  h:            Number|null,  // height override, null = inherit parent
  attachTo:     Number,   // parent zone id
  attachEdge:   String,   // add:    'front'|'left'|'right'
                          // cutout: 'front-left'|'front-right'|'back-left'|
                          //         'back-right'|'front'|'left'|'right'|
                          //         'back'|'interior'
  attachOffset: Number,   // offset along that edge (ft)
  interiorY:    Number,   // interior cutouts only
  corners: { FL|FR|BL|BR: { type: 'square', size: 0 } },  // chamfers
  joistDir:     String,   // 'perpendicular' | 'parallel'
  beamType:     String,   // 'dropped' | 'flush'
  stairs:       Object|null,
  label:        String
}
```

**Zone 0 is virtual.** It is not in the `zones` array; it is synthesised from the
top-level params by `getZone0(p)` (`zoneUtils.js:56`). Any code that iterates
`params.zones` and forgets zone 0 is wrong, and this has bitten before.

**Terminology, because the words get used loosely.** "Notch" is not a type. A
notched deck is a deck with one or more `cutout` zones — the informal name for the
resulting puzzle-piece footprint. "Zone" in the UI means an added section.

**Cap: 3 additive zones** (`MAX_ADD_ZONES`, `zoneUtils.js:14`). Cutouts are
excluded from the cap. At the cap the "+" edge handles disappear and a hint
renders; this is asserted by a live DOM test (`tests/live/zone_cap_dom.py`, not
in CI because the runner has no browser — **that constraint is now obsolete, see
§8**).

### 4.2 What the UI lets you do

In `planView.js`, step 1, four modes: `select`, `add`, `cut`, `chamfer`. Zones are
created by dragging on edge handles, moved and resized on the canvas, and edited
numerically in the side panel.

Chamfers are per-corner on any zone, with a type and a size.

### 4.3 How a cutout reaches the drawings

This is the pipeline, and it is the most fragile part of the product:

```
zones[] ──► get_additive_rects()  ─┐
       └──► get_cutout_rects()   ─┤
                                  ├─► get_bounding_box()
                                  ├─► notched_deck_polygon()   (beam_layout.py)
                                  ├─► front_edge_profile()     ← the real notched edge
                                  └─► get_exposed_edges()      ← where railings go
```

**`beam_layout.py` is the piece that makes notched decks correct** (S89). Before
it, a cutout left a support post standing at the old edge, under a void where no
deck existed. It now walks the real front-edge profile, places beams to follow it,
steps the beam at a deep notch, absorbs a shallow one as an IRC quarter-span
cantilever, and never puts a post over a void. It also collapses two posts into
one centred post when they'd land under 2 ft apart (S90 — a 4 ft notch produced
two coincident posts and over-counted footings).

**`get_exposed_edges()` decides railings.** It walks the perimeter and subtracts
edges that are interior (against the house, or against another zone) and the
openings where stairs descend. Handles horizontal and vertical edges only;
diagonal (chamfer) edges are passed through untouched.

**Sheets are laid out differently for notched decks** (`main.py:301`). Any deck
with at least one zone is "complex" and gets plan and framing on separate
full-width sheets. Simple decks keep the combined A-1. This was a layout-capacity
fix, not a label-placement one.

### 4.4 How a cutout reaches the material list

`draw_materials.py`, and this is where the divergences keep appearing:

- **Decking** is reduced proportionally by cutout area (`draw_materials:283`).
- **Railing** goes through `_rail_length()` (`draw_materials:129`), which reads
  the same `get_exposed_edges()` the drawings use. Before S103 the wood path
  over-billed the notch gap and the steel path under-billed by 8–10 LF on every
  notched deck, which is the worse direction: the contractor arrives short.
- **Zone materials** are computed by `estimate_zone_materials()` — each zone gets
  independent joist, beam, and footing sizing from its own dimensions.
- **Steel** is a separate path, `estimate_steel_materials()`, which had no zone
  branch at all until S103.

**Structural pattern worth internalising:** every notch bug so far has been the
same shape. A rule gets written inline in one file, the other surfaces cannot see
it, and they drift. The fix is always to express the rule once and have every
surface call it. There are **four surfaces** that must agree: the permit PDF, the
3D view, the material list, and the on-screen preview.

### 4.5 What is NOT supported, and why

- **Interior openings** (a hole fully inside the deck — chimney, tree, hot tub).
  Refused in both engines (`zone_utils.py:527-542`, `zoneUtils.js:1153`). The
  Meadowview reference set does contain the detail, located in S102, but it has
  never been visually confirmed. Blocked on Will reading the A-8 crops.
- **Stairs at an angle** (off a chamfered corner). Backlogged in S103 §11. Three
  things assume a stair is square to an edge, and the known trap is that a
  bounding box around a diagonal stair over-cuts the framing (the S81e mistake,
  reverted once already).
- **Rear stairs** and **off-axis stairs** were both investigated in S103 and
  **withdrawn as non-gaps** — no UI path can produce either. Filed rather than
  deleted because they read like real gaps and would otherwise be rediscovered.

---

## 5. STAIRS

Six templates in `stair_utils.py:179-265`: `straight`, `wideLanding`, `lLeft`,
`lRight`, `switchback`, `wrapAround`. Unknown templates fall back to straight.

Stairs live in a `deckStairs[]` array, each entry naming the zone it descends
from, its location (`front`|`left`|`right`), width, template, offset, and
stringer count. Legacy flat params (`stairLocation`, `stairWidth`) are migrated
into the array by `_migrateStairs()` on load.

**Every template recenters on its anchor** (`stair_utils.py:271`), so switching
template does not shift the deck attachment point. This was broken and fixed in
S97, in both Python and JS.

Interior stairs **snap to edges** and never notch the deck. A notch is the cutout
tool only. The wizard offers Front, Left and Right only; the canvas explicitly
refuses to snap a stair to the back edge, because the back edge is the house wall.

---

## 6. THE SHEET SET

Two shapes, chosen by whether any zone exists (`main.py:301`):

**Simple deck, 7 sheets:** A-0 Cover, A-1 Deck Plan & Framing, A-2 Elevations,
A-3 General Notes, A-4 Structural Details, A-5 Site Plan, A-6 Deck Attachment.

**Complex deck, 8 sheets:** A-0 Cover, A-1 Deck Plan, A-2 Deck Framing, A-3
Elevations, A-4 General Notes, A-5 Structural Details, A-6 Site Plan, A-7 Deck
Attachment.

Plus a separate materials PDF.

**A-0 carries the 3D perspective, and it comes from the browser.**
`window.capture3D(p, c)` (`deck3d.js:1636`) renders the Three.js scene offscreen
at 800×500 and hands the image to the backend as `coverImage`. If Three.js is
undefined or the capture throws, it returns `null` and `draw_cover.py` silently
draws a grey "3D PERSPECTIVE VIEW" placeholder. **Server-side renders therefore
always show the placeholder**; that is expected and not a customer-facing bug.
The silent fallback is worth noting as a design weakness: a broken capture
produces a cover that looks deliberate.

Default paper is **letter**. `arch_d` (36×24) exists behind `SBP_SHEET` and is
used by the golden and legibility gates, but nothing triggers it in production.
It garbles if enabled naively because `render_scale()` rescales only 3 text
methods while ~294 font literals and panel positions assume a 14-wide canvas.

---

## 7. ANALYTICS — what exists and what it can tell you

### 7.1 The pipeline

`tracking.js` loads before React on every page and exposes
`window._trackEvent(type, data)`. Events queue and flush every 5s, or immediately
for critical types, or on page hide. Identity is `anonymous_id` (localStorage,
permanent) plus `session_id` (per page load). **No login required** —
`/api/track` logs whatever `get_current_user_id` returns, including `None`.

Storage: `events` (facts, JSONB payload) joined to `sessions` (dimensions:
ip_hash, user agent, device, referrer, landing path, UTMs, click IDs, first-touch
snapshot, bot flag) on `session_id`.

Dashboard: `/admin`, served by `get_analytics_v2()`. Bot sessions excluded
everywhere via `NOT s.is_bot`.

### 7.2 Event inventory

`session_start`, `auth_login`, `step_change`, `guide_choice`,
`guide_phase_change`, `parcel_lookup_start`*, `parcel_lookup`,
`parcel_lookup_failed`*, `building_footprint`, `survey_upload`,
`extraction_complete`, `extraction_error`, `shape_confirmed`,
`shape_ranking_complete`, `house_dragged`, `house_reset`, `user_flip`,
`auto_confirm_action`, `auto_mirror_fired`, `pdf_generate_start`,
`pdf_generate_complete`, `pdf_generate_error`, `ai_helper_message`,
`support_contact`*.

`*` = new in S104.

### 7.3 What it can and cannot tell you

**Can:** how many distinct people (by anonymous_id and by ip_hash) reached each
funnel stage; which addresses were attempted and which failed and why; cache hit
rate against the Realie API; where in the wizard people asked for help; anonymous
versus signed-in split; acquisition source with first-touch attribution.

**Cannot:** anything about anonymous users' *designs*, because nothing is
persisted without a login. Cannot tell you why someone abandoned mid-step, only
that they did. Cannot attribute a support email to a session yet — the ref code
ships in the mail subject but nothing ingests the inbox.

### 7.4 Phase tagging

`SB_PHASE` (`database.py:17`, env var, default `testing`) stamps six insert
sites. Dashboard has All / Testing / Beta / Production pills. Forward-only —
existing rows are never rewritten. **Will is switching this to `beta` in
Railway**; check whether that happened before reading any numbers.

### 7.5 Attribution links

`/x`, `/launch`, `/pin` redirect to `/` with a full UTM set attached server-side
(`main.py`, `SHORT_LINKS`). Adding a campaign is one line. Referrers are grouped
by source, so all t.co codes read as "Twitter / X", and our own OAuth round trip
is labelled rather than counted as organic search.

---

## 8. TOOLING — this changed materially in S104, read this

### 8.1 A browser is now available

`pip install playwright && playwright install chromium` works in the container
with no sudo, in about four minutes. This is new and it changes how UI work
should be done.

What it enables: mounting a real React component in a harness, measuring actual
rendered geometry (`getBoundingClientRect`), screenshotting at any viewport, and
mutation-testing layout by breaking the CSS and confirming the measurement moves.

**Used twice in S104 and it caught a real defect both times.** The Copy button
wrap was found by Will's screenshot after I had shipped it blind, and my
arithmetic model of the wrap point gave a confident wrong answer. The drafts
hang was confirmed by mounting `DraftsPage` with a stubbed fetch and reproducing
the exact spinner.

**Standing recommendation: for anything visual, render it.** Estimating layout
mentally produces confident wrong answers in seconds. The browser takes minutes.

This also obsoletes the note that `tests/live/zone_cap_dom.py` cannot run in CI
for want of a browser.

### 8.2 A real Postgres is available

`pip install pgserver` ships its own Postgres binary, no sudo, boots in about 2
seconds, 34MB. sqlite cannot substitute for this codebase's queries — they use
`FILTER`, JSONB `->>`, and `BOOL_OR`.

Three S104 suites depend on it and each caught a bug that would otherwise have
shipped: an unescaped `%` in a `LIKE` that psycopg2 read as a placeholder and
would have 500'd the dashboard, and a per-address count that summed three event
types and doubled every number.

### 8.3 The `view` tool is unreliable

It returned empty on image files repeatedly during S104. **Never state that you
have seen something when the tool returned nothing.** Measure instead (ink
coverage, pixel spans, `getBoundingClientRect`) and say which you did. Will's
screenshots remain the authoritative visual ground truth.

### 8.4 Verification discipline that keeps paying

- Identify PDF pages by **rendered title**, never by index. S104 mislabelled a
  marketing image by grepping for "footing" and hitting a section heading inside
  the general notes sheet.
- **Mutation-test every guard.** A test that cannot fail is not a guard. Every
  S104 suite was broken deliberately to confirm it fires.
- **Test the call site, not the helper.** A test that re-implements the logic
  stays green while the real thing is reverted.
- **Stage files by name, never `git add -A`.** Commit messages that don't match
  their contents hid a bug for seven sessions.
- **Write commit messages to a file** (`git commit -F`). A heredoc let the shell
  interpret backticks and silently deleted three words from a message in S104.
- **Watch the CI run.** Saying "watch it" in a commit message is not watching it.

---

## 9. LEARNINGS FROM S104

1. **Check whether the feature already exists before designing it.** Will asked
   to start caching parcel lookups. It had been cached since S63. Two greps
   would have found it; I proposed a build first.

2. **Trace the whole path the user describes, not the half named in the report.**
   "Projects aren't saving" sent me into the save path, where I found and fixed a
   real bug. What he was actually looking at was a list that could not render at
   all. Both were real; only one was the symptom.

3. **A falsy empty string is a real outage.** `!API` where `API === ""` killed My
   Projects for every user for several sessions, and presented as a spinner that
   looks exactly like a slow network. Guard on `== null` when empty string is a
   legitimate value.

4. **For anything visual, render it.** See §8.1.

5. **A DNS answer from a missing binary is not an answer.** `dig` was not
   installed, so an MX check returned empty and looked exactly like "this domain
   accepts no mail" — the opposite of the truth. Always run a control query
   against something known-good before trusting a negative.

6. **Wrong analytics never throw.** They just quietly say the wrong thing. Two
   bugs in the new queries were only findable by executing them.

7. **Benchmark before believing a volume theory.** 237 projects sounded like a
   lot. Measured: 6.3ms. The real cause was a stale bundle.

8. **A silent fallback wearing the costume of a design decision is a trap.** The
   3D capture returns `null` on failure and the cover draws a tidy placeholder,
   so a broken capture produces output nobody would question. Same shape as the
   drafts spinner and the `TEST FIXTURE` text nearly going out on a public
   timeline.

9. **Don't hide rows to clean up a table.** `accounts.google.com` was inflating
   acquisition. It is now labelled "our own auth, not traffic" rather than
   dropped, because hiding data is how you lose track of what your data contains.

10. **Ask what a passing test actually covers.** Golden stayed 28/28 through a
    change that altered real material line items, because the material sheet is
    not in `SHEETS`. Still true. Still the best small win available.

---

## 10. THE ACTUAL UI/UX AGENDA — known weaknesses and open decisions

Ordered by my estimate of user impact. Numbers 1–4 are the ones I'd argue for.

### 10.1 Anonymous work is silently destroyed

Saving requires a login (`app.js:1027`, `app.js:1040`). Someone can complete the
entire design and lose everything on refresh, with no warning at any point. Your
own analytics now prove anonymous people do address lookups.

Options: persist to localStorage for anonymous users and migrate on sign-in;
prompt to sign in at a natural moment before effort is sunk; or warn honestly.
Doing nothing is the current choice and it is the worst one.

### 10.2 The wizard cannot be styled

877 inline style objects that no stylesheet can reach, and the count grows every
session. Mobile is handled by a
640px query targeting three hand-added class names. The homepage got a real
mobile pass in S101; the wizard did not, and was explicitly declared out of scope
at the time.

This is the structural blocker on all wizard UI work. Worth a deliberate decision
about whether to extract a theme layer before doing more surface work, because
every change made now makes that extraction bigger.

### 10.3 The guided flow assumes a homeowner, but contractors are the target

Sixteen phases of hand-holding. A contractor with a survey in hand wants to
upload it and move. "Upload a survey" is currently the *second* option, beneath a
lookup they may not need.

Worth testing: does a contractor-shaped fast path exist, and should the guide
default to off for repeat users? `guideActive` defaults to true.

### 10.4 Errors are dead ends, and now only partially

S104 added support contact to the address-lookup and generate errors. The
building-footprint failure path still just sets a low-confidence message. Worth
an audit of every error state for "what does the user do next."

### 10.5 Smaller, known, specific

- **The 3D silent-fallback placeholder** (§6). Should a failed capture tell
  someone, rather than producing a tidy empty box?
- **Duplicate projects already in the database.** `list_duplicate_projects()` is
  a read-only report built for reviewing a cleanup. Never run against production.
- **Support email placement not yet seen on mobile** by Will.
- **Step 1 zone editing** has never been usability-reviewed. It is the most
  complex interaction in the product (four modes, drag handles, a cap that
  changes affordances) and the least examined.
- **Materials sheet has no golden coverage** — carried from S103, still open,
  still small.

### 10.6 Open product decisions, not UX

Carried and unchanged: contractor pricing; the parcel-cache staleness call
(S104 doc §0, with Will's reasoning recorded); whether to keep parcel history;
interior openings (blocked on Will reading the A-8 crops); freestanding rail
detailing (blocked on Billy); LU228 in the hardware schedule.

---

## 11. QUICK REFERENCE

```
Repo         github.com/wilwixqa1/SimpleBlueprints, direct push to main, no PRs
Commits      S{n} push {m}: description
Deploy       Railway, autodeploys from main
Live         simpleblueprints.xyz
Gate         31 suites, all wired, enforced by tests/test_gate_completeness.py
Golden       SBP_SHEET=arch_d python3 tests/pdf/golden_structural.py   (28 sheets)
Renders      python3 tests/pdf/render_review.py [set...]  → /tmp/render_review/
Admin        /admin  (analytics, plan quality matrix, user CSV)
Env          SB_PHASE, SBP_SHEET, DATABASE_URL, GOOGLE_SOLAR_API_KEY, Realie
Deps         pip install --break-system-packages ...   (no sudo in container)
```

**Session close rule:** every session ends with a comprehensive context file
committed to `docs/`, and a retrospective. Will is non-technical, is the visual
ground truth and the product decision-maker; lead with plain-English "what this
does and why," and keep codes as secondary labels.
