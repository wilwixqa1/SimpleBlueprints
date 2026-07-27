# S104 SESSION CONTEXT — support contact, and making anonymous users visible

Repo: github.com/wilwixqa1/SimpleBlueprints — main @ `43a921c` + this push.
Read alongside `S103_CONTEXT.md`.

**Numbering.** Will opened with "session 104" and S103 was closed at 10 pushes.
No ambiguity this time.

---

## 0. PARKED DECISION — parcel cache staleness (Will, S104)

> **This is the one thing in this session that is deliberately unresolved.**
> Will asked for it to be written down WITH his reasoning so future-him
> remembers why he was thinking about it, not just what he chose.

**The decision made now: cache forever, serve on the existing 30-day rule.**

Which turned out to require **no code at all**, and that is the interesting part.
`parcel_cache` is already permanent. The only two SQL statements that touch the
table are the read at `database.py:547` and the upsert at `database.py:566`.
There is no `DELETE`, no `TRUNCATE`, no cron, no pruning anywhere in the repo
(verified by grep across `backend/`, complete reference list, S104). The 30 days
in `get_cached_parcel(max_age_days=30)` is a **read filter only** — a stale row
is skipped for serving and then overwritten on the next lookup. Rows are never
lost, so coverage has been accumulating since S63.

Will's framing, verbatim, because it is the right framing:

> "Maybe we just store it, but we don't use it past thirty days. Or maybe we set
> up a warning that this lot line is greater than thirty days old, do you want to
> make a new query? And it'll probably be the same almost every time. But I
> haven't, I can't decide how I wanna handle that yet."

**What still has to be decided, eventually:**

1. Should a user be *told* their parcel data is older than 30 days and offered a
   re-query, instead of us silently re-fetching? Will's instinct is that the
   answer will be the same almost every time, which argues for not spending an
   API call — but a permit drawing built on a stale lot line is a real failure,
   worse than an API bill. That tension is the whole decision.
2. Should the 30 days be 30? Nothing has ever justified that number.
3. **The one genuine data loss, not yet raised with Will:** the upsert
   *overwrites* `response_json` and resets `created_at`, so the PREVIOUS snapshot
   is destroyed on every refresh. Rows persist; versions do not. For a permit
   product that may matter more than it looks — if a customer says "my drawing
   was wrong," you currently cannot see what parcel data you held when you drew
   it. Keeping history is cheap (one row per refresh, lot lines rarely change).
   Not built, not decided, do not infer that it should be.

**Do NOT change `max_age_days` without Will.** He parked this knowingly.

---

## 1. DECIDED — do not cache failures (Will, S104)

> "Sometimes Realie just fails for no reason at all, and I'll make a second query
> and it works. So let's definitely not cache failures."

This is correct and the reasoning is worth preserving: a cached negative would
poison a transient error into a durable "no such address," and the retry that
would have worked never happens. The cost is real repeat API calls on genuinely
bad addresses, and that cost was accepted deliberately.

It is also why `parcel_lookup_failed` carries a **`kind`** of `no_parcel` or
`network` rather than collapsing into one bucket. They mean different things:
`no_parcel` is a data gap that might be fillable, `network` is our own flakiness.
If the `network` share is high, that is an argument for a retry, not a taxonomy.

---

## 2. CORRECTION TO THE RECORD

Earlier in this session I told Will that `parcel_lookup` "is not in the funnel so
none of it reaches your dashboard." **That was wrong and he should not carry it
forward.** There are two analytics functions:

- `get_tracking_stats` (`database.py:873`, legacy S55, `/admin/api/tracking`) —
  `funnel_types` genuinely does not list `parcel_lookup`.
- `get_analytics_v2` (`database.py:1373`, `/admin/api/analytics`) — this is what
  the dashboard actually renders, and it **does** use `parcel_lookup`, folded
  into the "Property entered" stage alongside `survey_upload`, `shape_confirmed`
  and `guide_choice` (`database.py:1431`).

So lookups did reach the dashboard, merged with three other event types and
successes-only. The real gaps were the merge and the missing failures, not total
absence. The S104 lookups block is what separates them out.

---

## 3. WHAT SHIPPED

### Push 1 — support contact (`43a921c`)

Two addresses on the site in three places, both the click and the copy path
instrumented. Full reasoning in the commit message. The short version:

- **Footer**, both addresses labelled. `home.css:239` already declared `f-grid`
  as `1.4fr 1fr 1fr` with only two children, so this dropped into a slot that
  had existed all along. No CSS change.
- **Wizard nav**, `customerservice@` only, persistent on every step.
- **Error states**, address lookup and generate. Ranked *below* the existing
  self-serve alternatives, and suppressed entirely for "Please sign in first"
  because offering support for a self-fixable problem teaches people to email
  instead of read.

**Not a form, deliberately.** A form cannot carry the attachment (the wrong PDF)
that most real support mail about this product needs, and it takes away the
sender's own copy of a message about a permit. The copy button is what earns its
place instead: it instruments the grab-the-address-and-email-later path that a
bare `mailto` loses completely.

**The ref code shipped before anything ingests mail** because it is the only
piece that cannot be backfilled. Mail arriving without it can never be joined to
its session.

### Push 2 — address lookup analytics (this push)

Answers Will's actual question: *are there real users who are not me, Billy and
my dad?*

Three event changes in `steps.js`, all on the anonymous path:

| Event | When | New? |
|---|---|---|
| `parcel_lookup_start` | on submit, with address + state + city + zip | NEW |
| `parcel_lookup` | on success, now carrying `cached` | flag NEW |
| `parcel_lookup_failed` | both failure branches, with `kind` and `reason` | NEW |

Before this, **only the success path fired**. Both failure branches were silent
and nothing fired at the start, so there was no denominator: a lookup that failed
and a person who never typed an address were indistinguishable. `start` now
balances against `success + failed`, and the test asserts that.

New `lookups` block in `get_analytics_v2` plus an "Address Lookups" section in
`admin.html`: attempts, resolved, failed split by kind, cache hit rate, sessions
split anonymous vs signed-in, distinct visitors, distinct IPs, and a table of
every address anyone typed whether or not it resolved.

The distinct-IP count is the one that answers the question. Exclude your own,
Billy's and your dad's and what remains is strangers.

**Addresses live in the event payload, not a new table.** `event_data` is JSONB,
so a query over `events WHERE event_type LIKE 'parcel_lookup%'` gives every
attempt with session, timestamp and outcome. No migration.

### Push 3 — the copy button stopped wrapping (`a680414`)

Will's screenshots of the deployed footer showed the defect: `contact@`
(28 chars) kept its Copy button inline, `customerservice@` (36 chars) wrapped
its button to the next line, so the footer rendered ragged. The 290px nav panel
wrapped too.

Fixed structurally, not by tuning widths: the address now sits on its own line
with Copy underneath, always, everywhere. A layout that depends on how long an
address happens to be breaks again the next time one changes.

**The reason this is worth remembering** is the first attempt. I modelled the
wrap point arithmetically; the model correctly predicted the panel and said the
footer would FIT, which the screenshot had already disproved. Tuning against a
wrong model is guesswork wearing a lab coat. So chromium went in (see §6.8) and
the component was rendered in a harness reproducing the real footer grid and the
real 290px panel including the 760px media query, measured at 1440px and 390px,
then looked at.

### Push 4 — projects stay on the project you are editing (`9571f53`)

Will: *"my projects are not actually saving"* and *"products that are the same in
every single possible way should not present as more than one file, especially
if they have the same address."*

One bug. The active project id lived only in a React ref (`app.js:901`) and was
written nowhere else. Four things dropped it, three of them ordinary: a page
refresh, the sign-in round trip (all three sign-in buttons snapshot the design to
localStorage and `restoreAuthState` restored params/info/step/mode/survey but
never the id), and `goHome()` nulling it outright. The fourth,
`startNewProject()`, is correct.

Once the id was gone the next autosave hit `ensureProject`, saw no id, and POSTed
a whole new row. The name is auto-derived from `info.address`, so every copy
carried the same address.

Fixes: the URL is now the source of truth (`setProjectId` owns the ref, the query
param and `window._sbProjectId` together); a refresh re-adopts `?project=<id>`;
all three sign-in snapshots carry the id and `restoreAuthState` puts it back;
`creatingRef` closes the race where a 3s autosave fired inside a slower create
round trip; and `find_identical_project` is the server backstop.

**The backstop is narrow in two ways and most of its test asserts it does NOT
fire.** Byte-identical on name AND params AND info, so the row it declines to
create contains no unique work by definition. Plus a 6-hour window, so a
deliberate fresh start from identical defaults next week still gets its own row.
Will's own data later proved this right: four *different* designs at 368 Croaton
St (20x12, 22x12, 30x7.5, 50x12). Matching on address alone would have destroyed
three of them.

### Push 5 — My Projects can actually load (`2d22415`)

Will's screenshot: signed in, stuck on "Loading projects..." forever.

`DraftsPage` guarded its load effect with `if (!user || !API) return;`. `API` is
the same-origin prefix and has been the **empty string** since S96.5 push 1
(`fc91b47`, `app.js:833`). `""` is falsy, so `!API` was always true, the effect
returned before the fetch every single time, and `loading` (which initialises to
`true`) was never cleared.

The page never asked. Nothing was wrong with the fetch, endpoint, query or data.
My Projects was dead for every user for several sessions, and the only symptom
was a spinner that looks exactly like a slow network. Only occurrence of the
pattern; grepped.

Verified in chromium by mounting the real `DraftsPage` with a stubbed fetch, then
mutated back to the old guard to confirm zero fetch calls and a permanent
spinner, reproducing the screenshot exactly.

**My miss, recorded because the shape of it will recur.** Will said "not
saving." I traced the save path, found a real bug, fixed it. I never checked
whether the list could *render*, and it could not, which was most of what he was
looking at. Trace the whole path the user describes, not the half named in the
report.

### Push 6 — HTML shells revalidate + this doc

Every versioned asset is cache-busted by query string, so a bumped version is a
new URL. That scheme has exactly one weak link: the HTML file that *names* the
versions cannot bust itself. `index.html` shipped with only an etag and
last-modified and no `Cache-Control`, so browsers used heuristic freshness
(roughly a tenth of the time since last change, growing the longer between
deploys) and could reuse a stale shell, request the OLD bundle versions named
inside it, and never receive a deploy.

Not theoretical: push 5 was confirmed live and serving `home.js?v=s104d` while
Will's browser still ran the previous bundle. Every "is it actually deployed?"
moment in this session traces here.

Extended the existing `cache_control` middleware rather than adding a second
mechanism. Covers `/`, `/admin`, `/mock`, `/mock/app`. `no-cache` means
"revalidate before use", not "never cache": the browser still sends its etag and
still gets a bodyless 304.

---

## 3b. DECIDED THIS SESSION — analytics phase

`SB_PHASE` (`database.py:17`, env var, default `testing`) stamps six insert
sites: events, sessions, generations, AI conversations, AI insights. The admin
dashboard already has All / Testing / Beta / Production pills.

Will is switching it to `beta` in Railway. It is a **label only** — nothing
behaves differently — and it is **forward-only**, so existing rows stay
`testing`. That is the point: it draws a hard line between Will and Billy
testing, and real strangers, at the exact moment marketing started.

Note the dashboard defaults to All, so the Beta pill has to be clicked.

---

## 3c. GTM — the first tweet

Four-panel collage of real pipeline output, built in `/tmp/mkt/build.py`
(not committed; regenerate from `render_review.py` param sets).

**Two traps worth not rediscovering.** The built-in demo configs print
`TEST FIXTURE` in the project description on every sheet, which would have gone
out publicly. And no street address is used on purpose: any plausible-looking
one is somebody's actual house. City and state only still reads correctly in a
title block.

Also mislabelled A-4 as "footing details" on a first pass by grepping for the
word "footing", which appears as a section heading inside the **general notes**
sheet. Will caught it. Same error as picking a page by index rather than by its
rendered title, in different clothes. A-5 is the real details sheet and is a far
better panel.

The 3D perspective **cannot be produced server-side**: it is Three.js drawing to
a WebGL canvas in the browser, and `draw_cover.py` only receives the resulting
image. Server-side renders always show the placeholder box on A-0. This is NOT a
bug and does not affect customers, whose covers are populated from their own
browser. Confirmed with Will.


---

## 4. THE EMAIL INGESTION PLAN (not built, phase 2)

Will wants message *content* eventually, for FAQ mining and AI-drafted replies he
approves. A form was considered and rejected (section 3). The route that gets
content without touching UX at all:

Mail currently goes sender → Spaceship forwarding → Will's Willex QA Gmail. Both
aliases confirmed set up by Will, S104. To also land it in the database, **Will
adds one forwarding rule in Gmail** sending a copy to an address we host, and the
backend picks it up. No DNS change, no Spaceship change, inbox untouched.

Note for whoever builds it: **Spaceship forwarding cannot post to a webhook**, so
the Gmail-rule route is the one that avoids moving MX. If MX ever does move, the
providers that post inbound mail as JSON are Postmark, Mailgun and SendGrid
Inbound Parse. Cloudflare Email Routing is free but needs the domain on
Cloudflare DNS and a TypeScript Worker, which is a second runtime this stack
does not have.

**Do not build this until mail is actually arriving.** The pipeline will be
designed better against ten real messages than against zero.

**Raised once, not resolved:** ingesting support mail means storing customer
personal data (names, addresses, property details) in our own database. That is
a different commitment from a mailbox a human reads, and it should be decided
deliberately rather than discovered.

---

## 5. ON USER-SELECTED CATEGORIES — considered and rejected

Will floated a five-option "what is the nature of your problem" picker. Rejected
on evidence, not taste. Manual classification runs 60-70% accurate against 90%+
for AI classification over the same content, so the picker buys data that is
wrong a third of the time, at the cost of a click from someone already annoyed.
Overloaded intake forms also produce abandonment or garbage entered to get past
the field, and the documented end state is "Other" quietly becoming the largest
category.

The sequencing argument is stronger than the accuracy one: **picking five
categories before seeing a single real support email means inventing a taxonomy
from guesses**, then shaping a year of data with it. Let content arrive
unstructured, classify later against real messages.

What replaces it, free: the app already knows what it was doing when help was
requested. `tracking.js` attaches step and guide phase automatically, and the
placement field says which surface it came from. "Nine of eleven help requests
fired within 30 seconds of a failed address lookup" beats any dropdown.

---

## 6. LEARNINGS

1. **Check whether the feature already exists before designing it.** Will asked
   to start caching parcel lookups. It has been cached since S63. The whole
   "cache forever" instruction turned out to need zero lines. Two greps would
   have found it, and I proposed a build before running them.

2. **A DNS answer from a missing binary is not an answer.** `dig` was not
   installed, so the first MX check returned empty and looked exactly like "this
   domain accepts no mail" — the opposite of the truth. The control query against
   a known-good domain is what caught it. Never read a negative result from a
   tool you have not proven is working.

3. **Wrong analytics never throw.** Two real bugs shipped-in-waiting were caught
   only by executing the SQL: `LIKE 'parcel_lookup%'` where psycopg2 reads the
   `%` as a placeholder and raises, and a per-address `attempts` column that
   summed all three event types and reported 2 as 4. Neither is visible by
   reading the query. Both took one execution to find.

4. **If the query cannot be run, install a database.** sqlite cannot stand in for
   `FILTER`, `JSONB ->>` or `BOOL_OR`. `pgserver` ships its own Postgres binary,
   installs by pip with no sudo, and boots in about two seconds. There was no
   real reason to ship this unverified.

5. **Test the shipped function, not a copy of its SQL.** `test_lookup_analytics`
   calls `get_analytics_v2` and builds its fixture from the real `init_tables()`.
   A retyped query would have stayed green through all three mutations. S103
   learning 3 in a new costume, again.

6. **A frustrated user should not be asked to route their own ticket.** The
   in-product surfaces show one address; only the footer shows both, because a
   footer is a directory and a broken PDF is not.

7. **Trace the whole path the user describes, not the half named in the
   report.** "Projects aren't saving" sent me into the save path, where I found
   and fixed a real bug. The thing he was actually looking at was a list that
   could not render at all. Both were real; only one was the symptom.

8. **For anything visual, render it.** Estimating a text-wrap point in my head
   produced a confident wrong answer in seconds. `pip install playwright` plus
   `playwright install chromium` works in this container with no sudo and took
   about four minutes. That capability now exists for the project: real
   components can be mounted, measured and screenshotted before shipping. It
   does not replace Will as ground truth on whether something looks *right*, but
   layout defects should not reach him again.

9. **A falsy empty string is a real outage.** `!API` where `API === ""` killed
   My Projects for every user for several sessions, and presented as a spinner.
   Guard on `== null` when the empty string is a legitimate value.

10. **Benchmark before believing a volume theory.** Will reasonably guessed 237
    projects was too many. Measured against real Postgres: 6.3ms. A thousand is
    49ms. The real cause was a stale bundle.

---

## 7. RECOMMENDED NEXT

1. **Look at the deployed footer and nav panel.** Neither has been seen in a
   browser. Will is the visual ground truth.
2. **Carried from S103, unchanged and still the best small win:** the material
   sheet is not in `golden_structural.SHEETS` (site, plan, framing, details
   only), so no material-list change can move golden.
3. LU228 in the hardware schedule for doubled members. Carried from S102.
4. BLOCKER 2, interior openings — still waiting on Will reading the A-8 crops.
5. BLOCKER 1, freestanding detailing — still waiting on Billy.
6. `stair_support.py` still has zero importers outside its own tests.

**Note that S103 section 7 items 3 and 5 are stale** — `attachmentType` was fixed
in S102 push 4 and the flat-deck rail opening shipped in S103 push 4. Section 7
was written after push 3 and never updated. Do not re-do them.
