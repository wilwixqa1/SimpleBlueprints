# SimpleBlueprints, S105 Context & Handoff

Written at the end of S105. Repo state: `main @ c5896ba`, gate green, production
serving `s105g`.

**How to use this.** §1 and §2 are orientation. §3 to §7 are reference; read the part
you are touching. §8 is tooling and it is the most important thing in this
document, because a real browser now runs in the container and it changes how UI
work must be done. §9 is the learnings, which are unusually expensive this session and worth
reading in full. §10 is the agenda.

**Accuracy note.** Every number here was measured at S105 with the command shown
or re-derivable from the repo. Where something is inference rather than
measurement, it says so.

---

## 1. NORTH STAR, unchanged

From `MASTER_CONTEXT.txt`, still governing:

> **The business milestone that matters: one generated package approved by a real
> building department.** Nothing else counts as validation.

Jurisdiction is Colorado Springs / PPRBD. Target customer, decided S84, is
**contractors** over DIY homeowners, weighted for repeat business.

Will's two-part restatement, both of which are UX statements:

> (a) pass the permit, (b) **LOOK professional enough that a contractor feels safe
> submitting it.**

**Worth raising at the top of S106, because nobody raised it in S105:** none of
the work in this session moves the milestone directly. Visual credibility is on
the critical path, but the thing that actually ends this phase is one contractor
putting one generated set in front of PPRBD. If Billy has a timeline, that
outranks the UI agenda. It was flagged once in S105 and never answered.

**Feature freeze (S84) still in force.** No sheds, no pergolas, no new zone
types, no new stair templates. `calc_shed.py` and `calc_pergola.py` stay dormant.
UI/UX work is explicitly not frozen.

Pricing: Stripe wired, not active. `BLUEPRINT_PRICE=2900`. Free during beta.
Contractor pricing ($49–99) open since S89.

---

## 2. WHAT S105 DID

Seven pushes, all live. This was a UI/UX session scoped by Will to **step 1 and
later. The site plan step was explicitly out of scope and `sitePlanView.js` was
not touched.**

```
de51fd7  push 1  deck sections are called Deck A, B and C, like a real permit set
6a46dd2  push 2  the four "zone" strings push 1 missed, and say what a section is
a34ee13  push 3  the screen labels the main deck too, and sliders name the parent
efd7877  push 4  set the size before choosing sections, and a browser harness
b80e3f0  push 5  step 1 collapses to one thing at a time (fixes push 4's red CI)
8e95266  push 6  you can actually add a section from the Shape group
c5896ba  push 7  drag the deck's edges to resize it
```

Pushes 2, 3 and 6 were all fixes for defects in the push before, every one of
them found by **Will's screenshots, not by the gate and not by me.** That pattern
is the subject of §9 and it is the single most important thing to carry forward.

---

## 3. THE NAMING SYSTEM, new in S105, read before touching any label

### 3.1 Why "zone" was wrong

Not a style preference. Measured word-boundary counts across all four approved
PPRBD reference sets in `docs/reference_sets/`:

```
TERM         Ilaria  Loucks  Meadow  Welborn   TOTAL
DECK A            3       4       1        1       9
LANDING           3       6       2        0      11
LEVEL             5       2       3        0      10
SECTION           1       0       0        0       1
ZONE              0       0       1        0       1
TIER / PLATFORM   0       0       0        0       0
```

The single ZONE hit is `ZONE: R1-6` on Meadowview's site plan. That is the
**zoning district.** So in a permit set the word already means something else,
and we were printing "ZONE 1" on a sheet next to zoning setbacks.

Reproduce with:
```bash
cd docs/reference_sets && for f in *.pdf; do
  pdftotext -layout "$f" - | grep -owic zone; done
```
**Use `grep -ow`.** An earlier pass without word boundaries reported 32 hits for
WING. It was matching DRAWING. See §9.2.

### 3.2 The rule, and where it lives

**One function per language. Nine inline copies were deleted.**

- `sectionName(zoneId, params)`, `zoneUtils.js`
- `section_name(zone_id, params)`, `zone_utils.py`

Guarded by `tests/test_section_naming_parity.py` (16 cases, mutation-tested
three ways: letters-by-id, honouring stored auto labels, and zone 0 reverting to
"Main Deck" all turn it red).

The rule:

| Input | Output | Why |
|---|---|---|
| zone id 0 | `Deck A` | zone 0 is virtual, its label is synthesised, never user-typed |
| additive zone | `Deck B`, `Deck C`, `Deck D` | **lettered by POSITION in the array, not by id** |
| cutout | `Cutout 1`, `Cutout 2` | a hole is not a deck part; never consumes a letter |
| user-typed label | returned verbatim | `"Grill Deck"` stays `"Grill Deck"` |
| stored `"Zone 1"` / `"Cutout"` / `"Main Deck"` | treated as absent, re-derived | lets old DB rows upgrade with **no migration** |

`AUTO_LABEL = /^(zone|cutout|main deck)(\s+\d+)?$/i`

**Why position and not id:** ids are never reused, so lettering by id leaves
"Deck A, Deck C" after a delete. A gap like that on a submitted sheet reads as a
missing section.

**Known accepted edge case:** if a user literally types "Zone 3" as a custom
name it will be treated as auto and renamed. Failure mode is benign.

### 3.3 Where the name is consumed

Four surfaces must agree, permit PDF, material list, 3D view, on-screen
preview. Every one of these now calls the shared function:

```
zoneUtils.js   getZone0 label, validateZone overlap msg, getStairDestinations
steps.js       active label, chip list, chip delete confirm, stair dest buttons
planView.js    canvas section labels, delete confirm
app.js         cap hint
draw_plan.py   _zone_display_label, plan tag, framing tag
draw_materials.py  estimate_zone_materials line labels
draw_notes.py / permit_checker.py  prose
```

### 3.4 The main-deck label rule

`draw_plan.py` and `planView.js` both label every section **only when there is
more than one** (`len(add_rects) > 1` / `addRects.length > 1`).

- Single-section decks stay unlabelled and **byte-identical**, which is what
  keeps the golden honest.
- A cutout-only deck is still ONE section, so it stays unlabelled. Gating on
  `has_zones` would have been wrong, because a cutout lives in `zones[]` too.

---

## 4. STEP 1, restructured in S105

### 4.1 The accordion

Step 1 now has three collapsible groups, one open at a time, Size open by
default. Implemented by `Group({id, n, title, summary, open, onToggle})` in
`steps.js`, driven by `openGroup` state (`_toggleGroup`).

```
1  Size     width, depth, height
2  Shape    add/cut controls, sections chip list, section card, corners
3  Stairs
```

**The order is dependency, not taste, and this is the part to preserve:**

- a section attaches to the deck's edges, so it needs the size first
- a stair needs the **final** perimeter, `getExposedEdges()` reads sections and
  cutouts, plus the height for risers. Place a stair, then add a section on
  that edge, and the stair's edge may no longer be exposed.

Every header stays clickable in any order. Nothing gates. A collapsed header
shows its current values so nothing is hidden.

**Attachment and Advanced get no group.** They are 49px and 31px. A header plus
summary would be more chrome than content.

**The preview is deliberately outside the accordion** (Will's call). It is the
feedback loop, so it stays visible while you work.

Measured effect (main deck selected):

```
                 before    after     screens
desktop          1746px    1106px    1.8 → 1.1    −37%
mobile           2363px    1688px    2.8 → 2.0    −29%
opening Stairs   1106px  → 1429px    (toggle verified)
```

### 4.2 Drag to resize, push 7

`onResizeDown(e, edge)` in `planView.js`. Three handles: left, right, front.

**The design principle, and it was Will's:** the drag computes almost nothing.
It converts the drag to feet, runs it through the shared clamp, and calls the
**same `u()` the slider calls.** The calc engine, 3D view, material list and PDF
cannot distinguish a dragged size from a typed one.

- left / right → `width`, and `deckOffset` shifts so the edge you did **not**
  grab stays put
- front → `depth`. The back edge is the house and cannot move.
- the old slide handle's cursor said `ew-resize` and resized nothing. It says
  `grab` now.

**`u()` does not validate.** It is `{...prev, [k]: v}` plus zone routing. The
min/max/step lived only in the Slider's JSX props. They now live in
`window.SIZE_BOUNDS` and `window.clampSize()` in `zoneUtils.js`, and **the
sliders read them too**:

```js
SIZE_BOUNDS = { width: {min:4,max:50}, depth: {min:4,max:24},
                cutout: {min:2}, step: 0.5 }
```

**Guarded to the main deck** (`(p.activeZone || 0) === 0`). `u()` routes
width/depth to the ACTIVE section when `activeZone > 0` via its `zoneKeyMap`, so
dragging the main deck's edge with a section selected would silently resize the
section. Sections need their own handles; see §10.

Verified by driving a real mouse at 1440×1000:
```
before             21'-6" × 12'   left edge x = 830
drag RIGHT +60px   24'-6" × 12'   left edge x = 831   ← opposite edge holds
drag FRONT +40px   24'-6" × 15'
drag RIGHT +1200   50'    × 15'   ← clamps at max
drag LEFT inward   4'     × 15'   ← clamps at min
```

### 4.3 The Shape group's add controls, push 6

Before S105 the entire sections panel, **including the description of what a
section is**, was gated on `p.zones.length > 0`. So the explanation of the
feature appeared only after you had already used it, and the only way to create
a section was four unlabelled icon buttons in the preview toolbar
(`app.js:1488`: `◇ + ✂ ◣`).

Shape now always contains: the description (including what a notch is),
`+ Add a section`, `✂ Cut a notch`, a follow-up line naming the next action, and
a disabled state at the cap. The chip list stays conditional, correctly, there
is nothing to list until something exists.

---

## 5. ARCHITECTURE

### 5.1 Frontend (line counts measured at S105)

| File | Lines | Δ S104 | Owns |
|---|---|---|---|
| `steps.js` | 5415 | +93 | All five step bodies, guided flow, every form control, `Group` |
| `deck3d.js` | 1688 |, | Three.js scene, `window.capture3D` for the PDF cover |
| `app.js` | 1529 | +1 | Shell, routing, auth, autosave, generate, `u()` |
| `zoneUtils.js` | 1281 | +73 | Zone geometry mirror, **naming rule**, **size bounds** |
| `engine.js` | 1254 |, | Structural calc mirror of `calc_engine.py` |
| `sitePlanView.js` | 782 |, | Site plan canvas (untouched in S105) |
| `home.js` | 599 |, | Homepage, drafts, `window.SB` theme |
| `planView.js` | 580 | +61 | Plan canvas, **resize handles**, zone drag/drop |
| `traceView.js` | 576 |, | Survey tracing |
| `elevationView.js` | 535 |, | Elevation canvas |
| `steelDeckData.js` | 530 |, | Steel framing tables |
| `lotGeometry.js` | 378 |, | Lot maths, house positioning |
| `stairGeometry.js` | 359 |, | Stair geometry mirror |
| `tracking.js` | 169 |, | Analytics, loads before React |

**Three parity pairs must stay in lockstep**, each has caused a real bug:
`engine.js`↔`calc_engine.py`, `zoneUtils.js`↔`zone_utils.py`,
`stairGeometry.js`↔`stair_utils.py`. Guarded by `test_frontend_parity.py` and
`test_cross_system_consistency.py`, plus `test_section_naming_parity.py` as of
S105.

**Inline styles grew, as predicted.** 877 → **911** across the four wizard files
(steps 742, app 117, planView 38, elevationView 14). Every session makes the
theme extraction bigger. This is still the structural blocker on wizard UI work
and it is still undecided. See §10.

**Shared rules now exported from `zoneUtils.js`:** `sectionName`, `isAutoLabel`,
`sectionLetter`, `SIZE_BOUNDS`, `clampSize`, alongside the pre-existing geometry
exports. This module has become the place where cross-surface rules live. Put
new ones there rather than inline.

**Cache busting is manual and easy to forget.** `index.html` carries
`?v=sNNNx` on phase-1 scripts and a single `var v = "v=sNNNx"` for phase-2
(`planView`, `elevationView`, `deck3d`, `sitePlanView`, `traceView`, `steps`).
**Bump both.** Currently `s105g`.

**Known pre-existing parse error:** `steps.js` has one Babel `UnexpectedToken`
from an unescaped `>` inside JSX text (`"Significant difference (>25%)"`). It
predates S105, the browser's transform tolerates it, and it is unrelated to
anything here. When checking syntax, **compare the error list before and after
your edit** rather than expecting zero.

### 5.2 Backend drawing

Unchanged from S104 except the naming call sites. `irc_tables.py` 3874,
`permit_checker.py` 1725, `draw_elevations.py` 1596, `draw_plan.py` ~1230,
`calc_engine.py` 1098, `draw_site_plan.py` 1029, `draw_details.py` 928,
`draw_materials.py` ~687, `stair_utils.py` 626, `zone_utils.py` ~658,
`beam_layout.py` 242.

`draw_zone_framing()` gained a `params=None` kwarg in S105, threaded from its
call site purely so the naming rule can see the zones list.

---

## 6. ZONES / SECTIONS / CUTOUTS

Data model, cap of 3 additive zones, `getZone0()` virtuality, the
`beam_layout.py` cutout-aware post logic, `get_exposed_edges()` driving
railings, and the complex-vs-simple sheet split are all **unchanged from S104
§4**. Read that section for the geometry; nothing in S105 altered it.

**Terminology now, and use it consistently:**

- **section** is the category noun. What used to be called a zone. Use in prose
  and buttons.
- **Deck A / B / C** is the name of a specific section. Use in labels, on screen
  and on the sheet.
- **notch / cutout** is a piece cut out. `Cutout 1`, `Cutout 2`.
- **zone** is retained ONLY as internal code vocabulary (`zones[]`, `attachTo`,
  `MAX_ADD_ZONES`, `activeZone`, `zoneMode`). Never user-visible.

Still unsupported and why: interior openings (blocked on Will reading the
Meadowview A-8 crops), stairs at an angle off a chamfered corner (backlogged
S103 §11), rear and off-axis stairs (investigated S103, withdrawn as non-gaps).

---

## 7. THE SHEET SET, STAIRS, ANALYTICS

Geometry and pipeline are unchanged from S104 §5 to §7. Restated here so this
document stands on its own, with the S105 deltas marked.

### 7.1 Stairs

Six templates in `stair_utils.py:179-265`: `straight`, `wideLanding`, `lLeft`,
`lRight`, `switchback`, `wrapAround`. Unknown templates fall back to straight.

Stairs live in `deckStairs[]`, each entry naming the section it descends from,
its location (`front`|`left`|`right`), width, template, offset and stringer
count. Legacy flat params are migrated by `_migrateStairs()` on load.

**Every template recenters on its anchor** (`stair_utils.py:271`), so switching
template does not shift the deck attachment point. Broken and fixed in S97, in
both Python and JS.

Interior stairs snap to edges and never notch the deck. The wizard offers Front,
Left and Right only; the canvas refuses the back edge because that is the house
wall.

*S105 delta:* stair destination buttons now read "Deck A" rather than "Main
Deck", via `sectionName()`. The stairs block is group 3 of the accordion and is
by far the largest, at 496px against 173px for size and 116px for corners.

### 7.2 The sheet set

Two shapes, chosen by whether any zone exists (`main.py:301`).

**Simple deck, 7 sheets:** A-0 Cover, A-1 Deck Plan & Framing, A-2 Elevations,
A-3 General Notes, A-4 Structural Details, A-5 Site Plan, A-6 Deck Attachment.

**Complex deck, 8 sheets:** A-0 Cover, A-1 Deck Plan, A-2 Deck Framing, A-3
Elevations, A-4 General Notes, A-5 Structural Details, A-6 Site Plan, A-7 Deck
Attachment.

Plus a separate materials PDF, which is **not** in the golden's `SHEETS` and is
therefore uncovered. See §9.5.

**A-0 carries the 3D perspective and it comes from the browser.**
`window.capture3D(p, c)` (`deck3d.js:1636`) renders offscreen at 800x500 and
hands the image over as `coverImage`. If Three.js is undefined or the capture
throws it returns `null` and `draw_cover.py` silently draws a grey placeholder.
Server-side renders therefore always show the placeholder; that is expected. The
silent fallback remains a design weakness: a broken capture produces a cover
that looks deliberate.

Default paper is **letter**. `arch_d` (36x24) exists behind `SBP_SHEET` and is
used by the golden and legibility gates, but nothing triggers it in production.
It garbles if naively enabled because `render_scale()` rescales only 3 text
methods while roughly 294 font literals and panel positions assume a 14-wide
canvas.

*S105 delta:* section labels on the plan and framing sheets now read DECK A /
DECK B / DECK C, and the main deck is labelled whenever more than one section
exists. General notes prose and one `permit_checker` message were rewritten off
the word "zone".

### 7.3 Analytics

`tracking.js` loads before React on every page and exposes
`window._trackEvent(type, data)`. Events queue and flush every 5s, immediately
for critical types, or on page hide. Identity is `anonymous_id` (localStorage,
permanent) plus `session_id` (per page load). No login required.

Storage: `events` (JSONB payload) joined to `sessions` (ip_hash, user agent,
device, referrer, landing path, UTMs, click IDs, first-touch snapshot, bot flag)
on `session_id`. Dashboard at `/admin`, bot sessions excluded via `NOT s.is_bot`.

Event inventory is unchanged from S104 §7.2: `session_start`, `auth_login`,
`step_change`, `guide_choice`, `guide_phase_change`, `parcel_lookup_start`,
`parcel_lookup`, `parcel_lookup_failed`, `building_footprint`, `survey_upload`,
`extraction_complete`, `extraction_error`, `shape_confirmed`,
`shape_ranking_complete`, `house_dragged`, `house_reset`, `user_flip`,
`auto_confirm_action`, `auto_mirror_fired`, `pdf_generate_start`,
`pdf_generate_complete`, `pdf_generate_error`, `ai_helper_message`,
`support_contact`.

`SB_PHASE` (`database.py:17`, default `testing`) stamps six insert sites.
Forward-only; existing rows are never rewritten. **Will was switching this to
`beta` in Railway. That was open at S104 and is still unconfirmed at S105. Check
before reading any numbers.**

Attribution short links `/x`, `/launch`, `/pin` redirect to `/` with a full UTM
set attached server-side (`main.py`, `SHORT_LINKS`).

*S105 delta: none.* **No events were added.** Nothing tracks accordion group
opens, drag-resize usage, or Add-section clicks, so there is currently no way to
tell whether any of S105's UI work is being used. See §10.4.

## 8. TOOLING, read this before any UI work

### 8.1 A real browser renders step 1, and it is committed

`tests/live/step1_render.py`. Not a mock. It serves `backend/static/` and loads
`index.html` exactly as production does, then enters the wizard through the
app's **own `sb_auth_state` resume path** rather than poking React internals.

```bash
cd backend && python3 -m http.server 8099 &   # note the root
cd /home/claude && python3 harness.py
```

**Three container-specific gotchas, each of which cost real time:**

1. **Serve from `backend/`, not `backend/static/`.** `index.html` requests
   `/static/js/...`, so the wrong root 404s every script and the page renders
   blank with no obvious cause.
2. **Chromium does not trust the egress proxy's certificate.** Launch with
   `--ignore-certificate-errors` and `ignore_https_errors=True`, or React,
   ReactDOM and Babel all fail from cdnjs. `curl` works fine, which makes this
   confusing to diagnose.
3. **The static server does not survive between tool calls.** Start it in the
   same command as the run.

Install: `pip install playwright && playwright install chromium` plus
`playwright install-deps chromium`. About four minutes.

**It caught two real defects in S105 that the entire 27-suite gate could not
see:**

- the SECTIONS panel silently vanishing after a bad edit anchor (page height
  dropped 154px)
- the resize handles rendering perfectly and doing nothing, because a decking
  `<line>` was painted on top and swallowed every pointerdown

**Standing rule, now with evidence behind it: for anything visual, render it and
measure it.** `getBoundingClientRect`, `document.elementFromPoint`,
`document.body.scrollHeight`. Estimating produces confident wrong answers.

### 8.2 Harness pitfalls that produced wrong answers in S105

- **A collapsed accordion group's children are not in the DOM.** Measuring
  `innerText` with the group closed reports everything as missing. Open it first.
- **`get_by_text("SHAPE")` matches the page heading "Size & Shape"** before the
  group header. Match the header button by its numbered prefix instead.
- **`document.elementFromPoint(cx, cy) === handle`** is the check for "is my
  interactive element actually reachable." Use it on every new SVG control.

### 8.3 A real Postgres is available

`pip install pgserver`, own binary, no sudo, ~2s boot, 34MB. sqlite cannot
substitute, the queries use `FILTER`, JSONB `->>`, and `BOOL_OR`.
`test_lookup_analytics.py` and `test_project_dedupe.py` need it.

### 8.4 The `view` tool is still unreliable on images

It returned nothing usable on every screenshot in S105, exactly as S104 warned.
**Never claim to have seen something the tool did not show.** Measure, and hand
the screenshots to Will, who is the visual ground truth.

### 8.5 Git

**No credentials in the container by default.** Will supplied a token mid-session
so pushes went direct. If there is no token, `git format-patch -1 HEAD --stdout`
and hand Will the patch. Set identity to match the repo:
`Claude (S1NN) <claude@simpleblueprints.local>`.

**A token pasted into the chat is compromised.** One was pasted in S105 and Will
was told to revoke it. If it still works in S106, tell him again. The safe
pattern is a token in the container environment, never in the transcript.

### 8.6 Verification discipline that keeps paying

- Identify PDF pages by **rendered title**, never index.
- **Mutation-test every guard.** A test that cannot fail is not a guard.
- **Test the call site, not the helper.**
- **Stage files by name, never `git add -A`.**
- **Write commit messages to a file** (`git commit -F`).
- **Run the gate AFTER the last file is added.** See §9.4.

---

## 9. LEARNINGS FROM S105

The expensive ones first. This session had an unusually high defect rate and the
pattern is consistent enough to be actionable.

### 9.1 The meta-lesson: I edited a screen I had never seen

Pushes 2, 3 and 6 were all fixes for the push before, and **every defect was
found by Will's screenshots.** Three rounds. The gate never fired once.

The cause is simple: pushes 1–3 were built from greps and a structural map of
`steps.js`, not from the rendered result. The pattern stopped the moment the
browser harness existed in push 4.

**For S106: build the harness state first, look at the screen, then edit.** The
harness takes about two minutes to run.

### 9.2 Substring matching gives confident wrong answers

Twice in one session:

- `grep -i wing` on the reference sets returned **32 hits**. It was matching
  **DRAWING**. Real count zero. This nearly became a finding in a handoff.
- `DECK A` in a before/after count matched **DECK AREA**, and `DECK C` matched
  **Deck Construction**, making a rename look partially applied when it was not.

**Always `grep -ow` / `\b` when counting words.** And when a count looks
surprising, print the matching lines before believing it.

### 9.3 A grep over quoted strings cannot see JSX text

The push 1 inventory searched for `"...zone..."` inside quoted strings. Three of
the four misses were **JSX text nodes with no quotes** (`>Main Deck</button>`,
`add a deck zone`). A fourth was killed by an exclusion filter that contained
`"add"`, which removed the line `Add zone (8' x 8')`.

Worse: `steps.js:2696` **was in the inventory output** and I simply did not act
on it.

**For user-facing wording, the inventory must come from the rendered screen, not
the source.** Will did it with three screenshots in about a minute.

### 9.4 Run the gate after the last file is added

Push 4 ran the gate, **then** added `tests/live/step1_render.py`, then committed.
`test_gate_completeness` failed on the unwired suite and **left CI red on main
for a whole push.** Found only because the next push happened to re-run it.

### 9.5 A passing golden can mean the test cannot see your change

The golden stayed 28/28 through the entire rename. Both of its zone configs are
**cutout-only**, so it is structurally incapable of exercising section labels.
Meanwhile the materials list was still printing "Zone 1" in 22 places after the
plan sheet was already correct.

This is S104 learning #10 recurring, and it has now cost something in two
consecutive sessions. **Material sheet golden coverage is still open.** It is
small. Do it.

**The general form: before trusting a green test, ask what inputs it actually
runs.**

### 9.6 SVG paints in document order

The resize handles rendered with correct geometry and cursors and did nothing,
because a decking `<line>` later in the SVG was on top of them.
`document.elementFromPoint()` at the handle's own centre returned the line.

**Interactive SVG elements must come last.** Verify with `elementFromPoint`.

### 9.7 Anchor edits on unique, indentation-exact strings

Moving the SECTIONS panel matched `l.strip() == '</div>'`, which found the
**inner** close of a nested warning block. The panel got inserted inside
`{isZone0 && c.engineeringRequired && ...}` and silently stopped rendering.

**Match indentation exactly, and assert the anchor count is 1 before writing.**
The assertion is what turned the second attempt into a clean abort instead of
another silent corruption.

### 9.8 Validation living in JSX props is invisible to everything else

`u()` does not clamp. The bounds lived in the Slider's props, so any other
route to setting a size could produce an illegal value. Same shape as the naming
rule: **a rule stated on one surface is a rule the other surfaces cannot obey.**

### 9.9 A conditional can hide a feature's explanation until after you need it

The description of what a section is was inside `{p.zones.length > 0 && ...}`.
It appeared only once you had already made a section.

**When gating UI on "does the user have any X", ask whether the thing being
gated is what teaches them what X is.**

### 9.10 Naming: use the customer's vocabulary, verified from their documents

The whole rename came from counting words in four approved permit sets rather
than from taste. That is repeatable. `docs/reference_sets/` is the authority for
any future wording question, ahead of web research.

---

## 10. THE AGENDA

### 10.1 Next session, in the order I would take them

1. **Section resize handles.** Push 7 covered the main deck only. `u()` already
   routes to the active section, so the value path is free; what is needed is
   handles positioned on the section's own rect and the `activeZone === 0` guard
   relaxed correctly. Highest continuity, lowest risk, Will is expecting it.
2. **Mobile sticky preview.** `.sbp-preview-col` is `position: static` below
   640px, so on a phone the preview sits **1179px** down the page (was 1833px
   before the accordion) in an 844px viewport. You cannot see the deck while you
   change it. Small fix, large effect, and it is the difference between the
   product working on a phone and not.
3. **Material sheet golden coverage.** Open since S103, has now cost something
   twice. Small.
4. **Hit-target audit.** Canvas `+`/`−` circles are r=6–10px. Far below a usable
   touch target. Same defect class as the 30×6 slide bar that push 7 replaced.
5. **Whole-body drag** to move the deck, retiring the 30×6 bar entirely, and
   letting it move in both axes rather than only left/right.

### 10.2 Structural, undecided, getting worse

**The wizard cannot be styled.** 911 inline style objects, up from 877 at S104.
No stylesheet can reach them. Mobile is one 640px media query targeting three
hand-added class names. The homepage has a real stylesheet and a proper mobile
pass; the wizard has neither.

Every session makes the extraction bigger. This needs a deliberate decision from
Will: extract a theme layer as its own session, or accept the cost and convert
opportunistically. It has now been carried, unaddressed, for two sessions.

### 10.3 Carried and unchanged

Contractor pricing; parcel-cache staleness; whether to keep parcel history;
interior openings (blocked on Will reading the A-8 crops); freestanding rail
detailing (blocked on Billy); LU228 in the hardware schedule; anonymous work
destroyed on refresh (the `sb_auth_state` mechanism at `app.js:1308`/`:840`
already snapshots the entire design and only fires on the Sign-in click, so this
is small); the 3D silent-fallback placeholder; `list_duplicate_projects()` never
to be run against production.

### 10.4 Not instrumented

Nothing tracks whether the accordion, the drag handles or the Add section button
are used. If S106 wants to know whether S105 helped, that has to be added.

---

## 11. QUICK REFERENCE

```
Repo         github.com/wilwixqa1/SimpleBlueprints, direct push to main, no PRs
HEAD         c5896ba  (S105 push 7)
Commits      S{n} push {m}: description
Deploy       Railway, autodeploys from main
Live         simpleblueprints.xyz   (serving s105g)
Gate         27 test files / 32 workflow steps, enforced by test_gate_completeness.py
Golden       SBP_SHEET=arch_d python3 tests/pdf/golden_structural.py   (28 sheets)
Naming       python3 tests/test_section_naming_parity.py
Renders      python3 tests/pdf/render_review.py [set...]  -> /tmp/render_review/
Browser      tests/live/step1_render.py   (serve from backend/, see §8.1)
Admin        /admin
Env          SB_PHASE, SBP_SHEET, DATABASE_URL, GOOGLE_SOLAR_API_KEY, Realie
Deps         pip install --break-system-packages ...   (no sudo in container)
Cache bust   index.html: per-script ?v= AND `var v = "v=sNNNx"` for phase 2
```

**Session close rule:** every session ends with a comprehensive context file
committed to `docs/` and a retrospective. Will is non-technical, is the visual
ground truth and the product decision-maker. Lead with plain-English "what this
does and why", keep codes as secondary labels, and **never use em dashes in
anything written for Will.**
