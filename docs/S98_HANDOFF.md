# S98 HANDOFF

Repo: github.com/wilwixqa1/SimpleBlueprints (PUBLIC) · main @ a96e771 · CI green
Focus of S98: a full UI/UX pass on the two highest-stakes pages (Review and Site Plan), one serious rendering bug fix, a lookup reliability fix, and mobile pass 1. Everything below shipped and is live.

---

## 0. START HERE (setup + workflow)

This is the exact workflow that worked all session. Follow it as is.

1. **Get the PAT.** Will pastes a GitHub Personal Access Token in chat at the start of the session. That token is how you clone and push. Just use it. Do not raise anything about rotating, recycling, or replacing it. It is a personal side project, public repo, no user data and no financials, and the token conversation only wastes the session.
2. **Clone.** The repo is public, so a plain clone needs no auth:
   `git clone --depth 1 https://github.com/wilwixqa1/SimpleBlueprints.git`
   (You only need the PAT for pushing, since push is a write.)
3. **Work on a writable copy.** Read before editing (see the repo's own rule below). Make changes.
4. **Validate before every push** (see the validation gate in section 2).
5. **Commit, then push with the PAT** using a one shot authenticated URL so the token never gets baked into the stored remote:
   `git -c credential.helper= push "https://x-access-token:<PAT>@github.com/wilwixqa1/SimpleBlueprints.git" HEAD:main`
   After this, `git remote get-url origin` is still the plain tokenless URL. Good.
6. **Deploy is automatic.** Pushing to `main` redeploys the whole app (Railway). Will then hard refreshes the live site and confirms visually. That visual check is the QA step, so ship, tell him exactly what to look at, and give a one line backout (`git revert <sha>`) for anything risky.

**The single most important deploy gotcha (this bit us hard in S98):** a push to `main` deploys the ENTIRE backend at HEAD, not just the files you touched. A "frontend only" change still ships whatever backend code is sitting at HEAD. In S98 a latent backend change (the sheet size default, see section 3) had been committed in a prior session but never deployed, and our first frontend push of the session deployed it and broke every rendered sheet. Before pushing, it is worth a quick `git log origin/main..HEAD` / `git diff` to know what backend code you are actually shipping.

---

## 1. WHAT SHIPPED THIS SESSION (newest first)

| SHA | What |
|-----|------|
| a96e771 | Mobile pass 1: stack wizard columns on phones, desktop untouched |
| 928d262 | Guide panel gets a clear AI assistant identity header |
| 3302fc5 | Site Plan: auto scroll to manual section, sticky preview column |
| 8a7d69a | Parcel lookup retries transient failures (fixes "fails first try") |
| c583416 | Step 0 stage 2: survey upload + manual as ranked "Other ways in" |
| c04aa13 | Step 0 stage 1: address card as hero, guide moved to bottom |
| ab16fc3 | 3D cover shows in the lightbox too, not just the thumbnail |
| cde7894 | 3D cover shows on the Review preview cover sheet |
| 1e31c9f | Fix garbled sheets: restore sheet size default to letter (BIG) |
| c2090fb | Review: widen rail 322->380, chat input becomes wrapping textarea |
| 836f1ae | Review: move guide into the rail, de-sticky the rail |
| 9019e3a | Review: enlarge materials collapse chevron |
| 7c451c4 | Review: mock style two column layout, wider, guide to bottom |
| 38fe5c2 | Rebuild Review as a gallery first delivery page |
| ade600e | Fix materials table blank columns in Review |

Session started at aa7f708 ("S96.5 push 4"). The starting handoff (the S96.5 doc) is now fully addressed: the materials table is fixed and the Review page is rebuilt.

---

## 2. VALIDATION GATE (run before every push)

The frontend is React compiled in the browser by Babel standalone, so a syntax error ships a blank page. Always parse `steps.js` (and `app.js` if touched) before pushing. There is one pre existing quirk: a bare `>` in JSX text (`(>25%)`) that standalone Babel rejects but the browser tolerates, so apply the documented workaround in the parse:

```js
const babel = require("@babel/core");
let code = fs.readFileSync("backend/static/js/steps.js","utf8").replace(/\(>25%\)/g,"(&gt;25%)");
babel.transformSync(code, { presets:["@babel/preset-react"], filename:"steps.js" }); // throws on syntax error
```

For backend edits, `python3 -c "import ast; ast.parse(open('backend/app/main.py').read())"`.

**Cache busters.** `steps.js` and other wizard deps load through a shared lazy loader version string in `backend/static/index.html` (`var v = "v=s97X"`). `app.js` has its own `?v=` on its script tag. When you change a JS file, bump the relevant buster or clients keep the old cached file. Currently at **s97k**. (Naming is loose; just increment the letter.)

**Read before editing.** The repo's own rule, and it exists because of a real scar: the S96.5 materials bug came from retyping table markup from memory instead of copying the working source. Every S98 change started by reading the actual current code. Do the same. `view` the real file, do not reconstruct from the handoff's paraphrase.

---

## 3. KEY LEARNINGS AND GOTCHAS

### 3a. Sheet size default was the cause of the garbled sheets (fixed)
Symptom: every rendered sheet (previews and the downloadable PDF) had text ballooned and overlapping. Root cause: `backend/drawing/sheet.py` defaulted the active sheet size to `arch_d` (36x24). That triggers `render_scale()` to multiply font sizes by 36/14 = 2.57x, but `render_scale()` only rescales three matplotlib text methods (Axes.text, Axes.annotate, Figure.text), not titles, legends, standalone Text objects, or panel positions. So on a 36x24 canvas the type balloons over a mis positioned layout. The ~294 hard coded font literals were all authored for the 14x8.5 "letter" size, which is where `render_scale()` is a no op. Fix: restore the default to `letter`. The `SBP_SHEET` env var still overrides it, so 36x24 remains available for anyone who deliberately wants it. Both the homepage sample sheets (`/api/mock/sample-sheets`) and the wizard previews (`/api/preview-sheet`) share the same render path, which is why the clean homepage confirmed letter was correct.

Proper 36x24 support is a separate, non trivial project (fix `render_scale` to cover all text and positions). Only worth doing if a jurisdiction requires 24x36 submittals. See section 6.

### 3b. Auto deploy ships the whole backend
Covered in section 0. The arch_d default had been committed earlier and sat undeployed; our first push of the session deployed it. Lesson lives in section 0.

### 3c. The app uses inline React style objects everywhere
`style={{...}}` objects, not CSS classes. This means you cannot express media queries in the component styles. For anything responsive, the pattern is: add a small `<style>` block (we put the mobile one in `index.html`) gated on a media query, plus `className` hooks on the containers you want to override, using `!important` to beat the inline styles. Because the rules live inside `@media (max-width:640px)`, desktop is untouched by construction. See section 5 (mobile).

### 3d. Design tokens
`window.SB` exposes `{ br, mono, sans }`. In `steps.js` they are destructured as `_br`, `_mono`, `_sans` (`const { br:_br, mono:_mono, sans:_sans } = window.SB;`). Palette (`br`): `gn` #3d5a2e (the one green, CTA + compliance only), `wr` #f2ece0 (warm beige card bg), `cr` #faf8f3 (page cream), `dk` #1a1f16 (near black text), `tx` #2c3024 (body), `mu` #7a8068 (muted), `bd` #ddd8cc (border), `rd` #c0392b (red), `bl` #2471a3 (blue), `ac` #c4960a (amber). Fonts: `sans` = DM Sans (headings, prose), `mono` = DM Mono (spec values, sheet numbers, drawing labels).

**Review polish rules (keep applying these):** green does one job (CTA and the compliance check only, never labels or headers), headings use the sans face, mono is reserved for values and sheet numbers. Whitespace over dense stacked cards.

### 3e. The 3D cover image
The cover sheet's "3D PERSPECTIVE VIEW" is filled by `window.capture3D(p, c)` in `deck3d.js`, which renders the deck offscreen (its own WebGLRenderer with preserveDrawingBuffer) and returns a base64 JPEG. It does NOT depend on the visible canvas. The PDF path already sent it as `params.coverImage`. In S98 we wired it into the Review preview too: the preview fetch captures it once (with a 1.5s timeout guard) and includes it on the cover (sheet index 0) fetch, and the captured image is stashed in `coverImgRef` so the lightbox re fetch reuses it instead of re rendering.

### 3f. Parcel lookup ("fails first, works second")
`/api/parcel-lookup` requires `address` and `state` and calls Realie. It used to make a single attempt and surface any transient failure (cold connection, timeout, 5xx, rate limit) as an error, so the user clicked twice. `_realie_lookup` now retries up to 3 attempts with short backoff on retryable failures only (4xx like bad address or no parcel still fail fast). Root cause is likely upstream or container cold start; the retry makes it invisible. The retry logs each attempt if you ever want to measure how often it takes 2 or 3 tries.

---

## 4. WRITING FOR WILL (style)

Never use em dashes or dashes as sentence punctuation in anything written for Will (chat, docs, questions). Rephrase with commas, colons, periods, or parentheses. (Hyphens inside code, file paths, flags, and numeric ranges are fine.)

---

## 5. PAGE STATE (where each page stands now)

Step map: 0 = Site Plan (address), 1 = Size & Shape, 2 = Structure, 3 = Finishes, 4 = Review.

### Review (step 4) — DONE, Will is happy with it
Rebuilt into a mock style delivery page. Two columns: left is the hero gallery of rendered sheets (cover first, dpi bumped 30->55, click to lightbox at dpi 100), right is a sticky-ish rail with a "Your drawing set" note, a condensed Summary, the green "Generate my plan set" CTA (pricing folded in as a struck through $49, compliance shown as a one line green check, sign in variant when logged out), and the AI guide panel at the bottom of the rail. Full materials takeoff is collapsed behind a summary line. Project information (title block) is last. The container is widened (app.js maxWidth 1480 on step 4) and the desktop white card chrome is dropped on step 4 so cards sit on the page background like the mock. Gating (missing field / PPRBD / disclaimer modals) is unchanged and factored into one shared `handleGenerateClick`.

### Site Plan (step 0) — partly reworked
Stage 1 and 2 shipped: the address lookup is a white hero card ("Find your property", "Find my lot" button, privacy line), the guide panel moved to the BOTTOM of the step (it was masquerading as the address bar at the top), and an "Other ways in" card sits under the address hero with two ranked options: "Upload a survey" (BEST IF YOU HAVE ONE, opens a file picker that reuses the real dropzone handler and reveals the extraction UI) and "Enter my lot manually" (LAST RESORT, `setGuideActive(false)`). Clicking manual now expands the lot section and smooth scrolls to it. The right side SITE PLAN PREVIEW column is sticky so it follows you down the page.

Step 0 is the biggest and most stateful block in `steps.js` (trace mode, survey OCR, the guide state machine, manual sliders, setback warnings all live there) and it has a documented back navigation bug history. Treat edits here carefully.

### Guide / AI assistant — clearer now
The shared `GuidePanel` (used on every step) now leads with an assistant identity header: a green sparkle avatar, the name "Deck Assistant" (placeholder name, easy to rename), an "AI" tag, and "Ask me anything, or I'll walk you through each step." Progress bar demoted below it. First screen chat placeholder reworded from "Questions? Ask here (optional)" to "Ask me anything, or describe what you want."

### Mobile — pass 1 only
`index.html` has a `@media (max-width:640px)` block plus class hooks (`.sbp-wizard-row`, `.sbp-preview-col`, `.sbp-review-row`) that stack the side by side columns full width and undo the sticky / fixed width behavior on phones. Desktop is unaffected (rules never fire above 640px). This is ONLY the top level column stacking. Inner elements (the 3D / site plan canvas sizing, wide materials table, spec card grids, the guide chat input) likely still need mobile tuning, and that needs on device checking since the assistant cannot see the phone render. HARD CONSTRAINT for all future mobile work: do not change how the desktop UI looks (Will is very happy with it) and do not break anything.

---

## 6. OPEN ITEMS / NEXT STEPS (roughly prioritized)

1. **Mobile pass 2+.** Inner element tuning below 640px: canvas/preview sizing, wide tables, spec grids, guide input, touch targets, font sizes. Multi session. Get Will to test on his phone and report specifics. Desktop must stay identical.
2. **Site Plan entry gate.** Step 0 still opens with the old "Guided vs Manual" choice screen before the address box. Finishing "address first" (address box is literally the first thing, alternatives quietly available) is the remaining friction. This touches the `guideActive` state machine (null -> choice, true -> guided, false -> manual), so read it carefully.
3. **Promote alternatives on a failed / rejected lookup.** Right now "Other ways in" sits at constant quiet weight under the address box (which is decent, because a lookup error renders just above it). The refinement is to make survey/manual LOUDER specifically when a lookup fails or the user rejects the result. Also: in manual mode the "Enter manually" option is redundant, easy to hide.
4. **Single box address (stage 3).** Replace the four fields (street / city / ST / ZIP) with one autocomplete box via an address autocomplete API (Google Places, or cheaper Radar / Geoapify / Mapbox). This gives one box AND accurate structured results AND autofill, and removes the wrong house risk. Needs Will to pick a provider, create an account, and drop the key into Railway as an env var. Free tier covers beta volume. Build is roughly one focused session on our side once the key exists.
5. **Frontend `.catch` on `_doParcelLookup`.** Deferred in S98 because that fetch chain is deeply nested (it contains a building footprint sub fetch). Add a catch so a thrown / non JSON response cannot leave the button spinning. Backend retry already covers most cases.
6. **Review required field gate.** The owner/address fields are still skippable via "Generate anyway" and the title block is at the bottom. Open question from the S96.5 handoff: make the required fields impossible to skip, or surface a "N fields needed" note in the CTA card. Needs Will's call.
7. **Proper 36x24 (arch_d) sheet support.** Dormant behind `SBP_SHEET`. Only if a jurisdiction requires 24x36. Step 1 would be to render every sheet at arch_d and inventory exactly what breaks before deciding if it is a few missed cases or structural. See 3a.
8. **After beta:** trust signals / social proof near the Review CTA (none there today). And the cut list stays SHELVED (see below).

**Do NOT build the per member cut list.** The go to market doc (`SBP_GTM_PLAN.md`) lists it as a high priority gap versus RedX and Etsy, but that doc predates the S97 decision to deliberately shelve it. Reasons it was shelved: not permit required, large accuracy and liability burden, DIYers are the people most likely to be hurt by a wrong length, and a wrong cut length damages the "contractor trusts the set" goal more than a missing feature does. If Will wants something in that direction, the surviving low risk option is a summary block on the existing materials sheet (area, perimeter, concrete volume, bag count) with no per board claims.

---

## 7. FILE MAP

Frontend (`backend/static/`):
- `js/app.js` — wizard shell, layout container (the flex row + left column + preview column), nav, cache busters live in `index.html`.
- `js/steps.js` — all step content. StepContent(props) around L939. Step 0 (~2926), Step 2 (~4343), Step 4 / Review (`if (step === 4)` block). GuidePanel component (~606). GuideChoiceScreen (~862). Design tokens destructured at top.
- `js/deck3d.js` — Three.js viewer and `window.capture3D`.
- `js/engine.js` — `estMaterials` (items shaped `{cat, item, qty, cost}`; extended cost is computed `qty*cost`, there is no `ext` field) and structural calc.
- `index.html` — script tags with `?v=` busters, the shared lazy loader `var v`, and the mobile `<style>` block.
- `uxmock/` — the S88.5 design mock (reference only, a separate concurrent session owns it). Act I is the property page, Act III is the delivery page.

Backend (`backend/`):
- `app/main.py` — FastAPI. `/api/parcel-lookup` + `_realie_lookup` (retry logic). `/api/preview-manifest`, `/api/preview-sheet` (per sheet render, passes `params.get("coverImage")` to the cover). `/api/mock/sample-sheets` (homepage). `generate_blueprint_pdf`.
- `drawing/sheet.py` — sheet size (`_ACTIVE`, default `letter`), `render_scale()`, `font_scale()`, `SBP_SHEET` override. See 3a.
- `drawing/*.py` — the per sheet draw functions and `draw_cover.py`.

---

## 8. BACKOUT

Every S98 change is a clean single commit; `git revert <sha>` drops any one. The riskiest were the two big Review rebuilds (38fe5c2, 7c451c4) and the mobile stylesheet (a96e771). The sheet size fix (1e31c9f) should not be reverted, it is what makes the sheets render correctly.
