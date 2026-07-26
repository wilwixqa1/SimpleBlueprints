> # ⚠ RETRACTED — SECTION 0 OF THIS FILE IS WRONG
>
> **Superseded by `S102_SESSION_CONTEXT.md`. Read that instead.**
>
> Section 0 below declares S100's "post inside the stair opening" finding a false
> positive, with a 66-config table under it. **That conclusion is wrong. The
> finding was real.**
>
> The sweep built stairs only from `location` + `offset` — the sidebar fields —
> which always pin a stair to the deck edge, where nothing collides. It never
> exercised the **drag**. `planView.js:119` writes `anchorX`/`anchorY`, and a
> stair released more than 1.5 ft from an edge stays inside the deck. Measured on
> a 40×12: stair box x[18,22] y[6.0,11.2], post at (20.0, 10.5) — inside it in
> both axes. Fixed in push 15 (`9618cd9`).
>
> The rest of this file (root cause, the audit design, §5 open items) is still
> accurate. Section 0 is kept rather than deleted because the mistake is itself
> the lesson: a confident, well-evidenced correction built on the wrong input
> surface is more dangerous than no analysis at all.

# S102 SEAM AUDIT — CONTEXT

Repo: github.com/wilwixqa1/SimpleBlueprints — main @ 95f2120 — gate green (15 suites).

**Scope of this file.** This covers the SECOND HALF of a long session, which
diverged from the work planned in `S101_HANDOFF.md`. It is a companion to that
file, not a replacement. A separate parallel session wrote `S102_CONTEXT.md`
covering different work (steel labels, jurisdiction checklist, guard rail).
Read all three.

**Numbering warning.** Will opened the session saying "session 100." The
handoff on disk was S100's, so this thread labelled itself S101 without asking,
and the parallel session then labelled itself S102 — probably *because* it saw
the S101 commits. One day's work therefore spans three session numbers, and
`docs/S101_HANDOFF.md` may refer to a session that does not exist by that name.
Will's call: **leave it.** The labels are cosmetic; the content is what matters.
Do not "fix" the history.

---

## 0. THE HEADLINE — A TOP BACKLOG ITEM WAS NEVER A BUG

**`S100_HANDOFF.md` section 2, "THE BIG FINDING," is a false positive.
Do not implement any of its three options.**

It reports: *"41 of 72 sampled straight-stair configs have a post inside the
stair opening,"* files it as the highest-value item, and blocks it on Billy.
That comparison put the post's **X** against the stair's **X-span** and never
checked **Y**.

Re-derived with Y included, 66 straight-stair configs
(reproduce via `/tmp` script pattern in push 13's message):

| comparison | result |
|---|---|
| post inside the stair X-span only (S100's method) | **44** — reproduces the finding |
| post inside the stair X **and** Y (real collision) | **0** — never happens |

On a 40×12 deck the post sits at **(20.0, 10.5)** — under solid decking, 1.5 ft
behind the front edge — while the stair occupies **y 12.0 → 17.2**, entirely off
the deck. They are 1.5 ft apart and never touch.

**A continuous beam under an edge-anchored stair is CORRECT.** It is the Ilaria
detail: straight stair to grade, stringer notched onto a concrete pad, deck
framing untouched.

Corroborated independently from the 3D side by the parallel session's push 12
(`22bad50`): an edge-anchored stair has *exactly zero* overlap with the deck
plane; an inboard stair genuinely overlaps. Two codebases, two methods, same
conclusion.

---

## 1. THE RULE, NOW CONFIRMED IN BOTH CODEBASES

Will stated it as a binary and the code agrees:

> Stair **on the perimeter** → no notch → framing continuous.
> Stair **inside the deck** → notch → framing opens.

The deciding variable is the **stair's anchor position**, nothing else.

| anchor | Python (`stair_utils.get_stair_placement_for_zone`) | 3D (`deck3d.js`) |
|---|---|---|
| deck outer edge | `anchor_y = D`; run0 runs outward; no overlap | overlap exactly 0 → `frontGap` null |
| inboard (notch) | `_front_edge_y_for_span` pulls it to the notch edge | run0 crosses the plane → `frontGap` fires |

Measured, 20×14 deck, absolute coords:

```
zone front edge y=14 (deck outer edge) -> run0 z[14.00, 19.30]  NO overlap
zone front edge y=9  (inboard)         -> run0 z[ 9.00, 14.30]  OVERLAPS
zone front edge y=6  (inboard)         -> run0 z[ 6.00, 11.30]  OVERLAPS
```

**Important nuance about the wizard.** `steps.js` never writes
`anchorX`/`anchorY` — zero occurrences. A front stair is therefore *always*
anchored at the deck edge **unless a cutout already exists**, in which case
`_front_edge_y_for_span` moves it inboard automatically. The wizard has a
separate zone editor (`activeZoneObj.type === "cutout"`). So the flow "drag the
stair inward to make a notch" does not exist as a direct manipulation; the
notch comes first and the stair follows it.

**This is worth a product conversation with Will.** If users believe dragging a
stair inward creates a notch, that is a UX mismatch, not a framing bug.

---

## 2. WHAT SHIPPED THIS HALF

| SHA | What |
|-----|------|
| 95f2120 | Push 13: `tests/test_cross_system_consistency.py` — the seam audit — plus the S100 false-positive correction. Test file only, no product code. |

Earlier in the same thread (labelled S101, before the split):
`085f10e` JS beam-layout port · `a94cf1e` IRC deck-table snapshot + drift guard ·
`a065490` mobile home page · `63b40c1` S101 handoff.

---

## 3. THE ROOT CAUSE (why these keep happening)

**There is no single source of truth for deck geometry. Each system re-derives
it from raw params.**

Measured:
- the rule *"freestanding joists span half the depth"* is restated
  **independently in 5 places across 3 files**
- `attachment == "ledger"` branches **27 times**

When a rule is expressed once, a bug is wrong everywhere — loud, caught. When
it is expressed five times, it is wrong in **one** place while the other four
stay right. The result is a system that is *mostly* correct and quietly
self-contradictory in specific corners. That is exactly the felt experience:
"I assumed we had it all correct" — and you mostly did.

Every bug found this session is the same shape:

| bug | system A knows | system B re-derives differently |
|---|---|---|
| freestanding beam | engine models 2 beams | `beam_layout` expresses 1 line |
| railing kits | Python uses real exposed edges | JS uses `W + 2D` formula |
| guard rail (push 10) | decking/joist gap logic | rail borrowed the framing variable |
| `attachmentType` (push 4) | wizard writes `attachment` | checklist read `attachmentType` |

**Why the gate never caught any of it:** every test checks ONE system in
isolation. Golden checks the PDF. `test_structural` checks the engine.
`test_frontend_parity` checks JS-vs-Python *of the same system*. You can have
100% coverage of each system and 0% coverage of the seams between them.

---

## 4. THE AUDIT — `tests/test_cross_system_consistency.py`

The instrument built to close that gap. **It was written before the fixes on
purpose**, so it is proven to catch bugs rather than written to pass them. On
its first run it caught both known bugs and surfaced two nobody was looking for.

**Invariant 1 — stair anchor vs framing response.** 12 configs, all passing.
Edge-anchored: framing must stay continuous, stair must start at the deck edge,
and no post may intersect the stair box **in both axes**. Inboard: the beam must
open. These document correct behaviour and fail if either direction regresses.

**Invariant 2 — freestanding beam count. STILL OPEN, 6/6 failing.** See §5.1.

**Control** — a plain ledger deck must be consistent today. If the control ever
fails, the audit is broken, not the product.

Known-open seams are tracked separately from unexpected failures and exit 0 —
they are the work queue, not a red build. As each fix lands, tighten its check
so a regression becomes a hard failure.

**Rules for anyone touching this file:**
- **Never relax an assertion to make it green.** That re-opens the seam.
- **Any post-vs-stair assertion MUST compare both axes.** The X-only comparison
  is what produced a phantom top-priority bug that survived several sessions —
  and it is what my own first draft of this audit did, generating 9 false
  positives before it was caught.

---

## 5. OPEN, VERIFIED, UNFIXED

### 5.1 Freestanding decks draw one beam, engine models two — REAL

`calc_engine` models freestanding as a two-beam deck: posts doubled (560), joist
span halved (515/757), joist hangers doubled (930, comment: *"joists span
between 2 beam lines"*). But `beam_layout.post_xy` carries **one** beam line, and
`draw_plan.py` draws one. Rendered and confirmed on the framing sheet.

Also note `draw_plan.py:639` — `j_span = D - 1.5 if attachment == "ledger" else
D / 2 - 0.75` — the *drawing* knows the joists span half the depth, i.e. it
knows there are two beams, and still draws one.

**This is the highest-value real bug now that §0 is retired.** Not attempted
because the second beam's geometry must be *constructed* (its y, which posts
belong to it, where its footings land), it moves golden on every freestanding
config, and the correct two-beam detail should be checked against the reference
sets first. **Do not invent the detail** — that is what S100's push 13 did with a
magazine article and push 14 threw it away.

### 5.2 Railing kits: Python 7, JS 6 on notched decks — REAL, Python is correct

Verified this session. The mechanism is **not** what `S101_HANDOFF.md` §2.2
implies about `railLen` in the engines — those are character-identical and both
return 48. The difference is in `draw_materials.py:160-168`: when *any* zone
exists, Python **discards** the engine's `rail_length` and recomputes it from
`get_exposed_edges(params)`. JS never does this.

Measured, 20×14 with a 4×4 front notch:

| edge | ft |
|---|---|
| left side | 14.0 |
| front, left of notch | 8.0 |
| notch left wall | 4.0 |
| notch back | 4.0 |
| notch right wall | 4.0 |
| front, right of notch | 8.0 |
| right side | 14.0 |
| **total** | **56.0** (vs 48 flat) |

The notch adds exactly **8 ft — its two side walls.** Python then subtracts 4 ft
for the stair opening → 52 → `ceil(52/8)` = **7**. JS: 48 → **6**.

**Python is right.** A notch creates two new interior walls; if the deck is over
30" above grade they are fall hazards needing guard rail (IRC R312.1.1). The 4 ft
that is correctly *not* railed is the notch back, where the stair descends — and
Python's `-stairWidth` removes exactly that.

**Fix: JS should adopt Python's exposed-edge calculation.** Screen catches up to
PDF, no permit-path change, no golden movement. Clean and unblocked — the best
next task after this file.

### 5.3 No clamp on stair offset — REAL

`offset` is **centre-relative** (offset 0 centres the stair). On a 40 ft deck,
offset 20 produces an opening at **[38, 42]** — two feet past the end — and both
the drawing and the structural engine accept it silently. No warning, no clamp.
Owner (UI vs backend) undecided, so the audit reports it rather than asserting.

### 5.4 `geometry` only on the deckStairs path

`resolve_all_stairs` attaches `geometry` at `stair_utils.py:571`, on the
`deckStairs` path only — not on the legacy `hasStairs` fallback. Two stair entry
paths carrying different data shapes is itself a seam. Anything reading
`rs["geometry"]` must handle its absence.

### 5.5 Stale line numbers in the `deck3d.js` correction comment

Push 12's comment cites `frontGap` consumers at "~570 (beam), ~602 (joists),
~642 (rim), ~913 (deck boards)." The actual lines are **592, 624, 664, 935** —
off by exactly 22, the length of the comment insertion itself. The comment
invalidated its own references while being written. Suggest citing the stable
markers instead: `mats.beam`, `mats.joist`, `addRimSeg`, `addDeckBoard`.

---

## 6. LEARNINGS

1. **Compare all axes, always.** A phantom top-priority bug survived several
   sessions on an X-only comparison, and my first audit draft repeated the exact
   same error while trying to catch it. If you are testing whether two things
   collide, collide them in every dimension they exist in.

2. **Verify before doubting, not just before asserting.** I told Will the S101
   railing note was probably wrong. It was right. Reflexive self-correction under
   pushback is the same failure as overconfidence — both substitute a posture for
   a measurement. Check, then speak.

3. **Render and look before arguing.** Twice I reasoned from post coordinates to
   a wrong conclusion and only got straight by generating the sheet and viewing
   it. For anything visual, the picture is the evidence; coordinates are a proxy.

4. **"No commit touched this file" does not mean "no regression."** I concluded
   the framing could not have changed because S101 touched no drawing code. The
   right test is *does the current output match what was established as correct*,
   which is a different question. Behaviour can change because inputs changed,
   because a fixture hand-fed something the real flow does not, or because two
   paths diverged.

5. **A fixture that hand-feeds internal state does not test the user's path.**
   Every notched golden config supplies `zones=[...]` explicitly. The wizard does
   not. So the "correct" behaviour was certified on a path no user takes, and the
   gate stayed green for many sessions while the real flow differed.

6. **Test that systems AGREE, not that each is right.** This is the generalisable
   rule and the reason the audit exists. It is cheap and it finds things you were
   not hunting — the off-deck stair and the two-path `geometry` asymmetry both
   fell out of it unprompted.

7. **Build the instrument before the fix.** Watching it correctly fail on a known
   bug is the only way to know it works. An alarm that has never fired is not an
   alarm.

8. **Commit messages are read as ground truth by other sessions.** Push 10's
   overstated note ("would corrupt the permit set") actively misled this thread
   until Will flagged it. Push 12's correction is a model: measured numbers,
   explicit scope, and a *"NOT MEASURED, do not assume"* section naming what was
   never checked. Copy that pattern.

9. **Line numbers in comments rot immediately** — including from the edit that
   writes them. Cite stable identifiers.

---

## 7. PROCESS CHANGE WILL ASKED FOR

**Blockers must be numbered, top-of-file, and carry a magnitude — not prose in a
section body.**

S100 documented the stair/framing gap in plain English (*"user-drawn zones only.
Stair geometry never enters"*) and it carried perfectly across sessions. The
knowledge was never lost. What failed is that a flagged item framed as a *design
question awaiting Billy* reads as parked, so every later session treated it as
someone else's turn. Nothing forced it back to the top.

Format going forward:

```
BLOCKER 1: <what is broken> — <magnitude, e.g. "6/6 freestanding configs">
  correct output: <reference, e.g. "the notch_front_stair golden">
  unblocks when: <specific question + who answers>
```

That is impossible to mistake for a musing. And a blocker should die by being
**disproven** as readily as by being fixed — §0 is exactly that case.

---

## 8. QUESTIONS FOR BILLY (revised)

S100's Q3 (*"a deck post landing inside a stairway — move the post or the
stair?"*) is **withdrawn.** It describes a collision that does not occur.

Still open:
1. Straight stair to grade — do you ever add support under it, or is the pad and
   notched stringer really all there is?
2. Elevated landing — is 4×4 your normal? Looks light next to 6×6 deck posts, but
   that is what Loucks shows.
3. Does an inspector ever ask about stair loading on the deck frame, or is the
   pad and bracket detail enough in practice?
4. Hangers at the ledger only on dropped beams; proportional decking reduction
   for cutouts. (S99 carryover.)
5. **NEW:** freestanding decks — two dropped beams, each inset from the ends? How
   far in, and does the joist span really split evenly? (§5.1.)
6. **NEW:** on a notched deck, does the guard rail wrap the notch's two side
   walls? Our materials estimate assumes yes (§5.2).

---

## 9. GATE (17 suites as of 95f2120)

```bash
SBP_SHEET=arch_d python3 tests/pdf/golden_structural.py
python3 tests/test_frontend_parity.py
SBP_SHEET=arch_d python3 tests/pdf/config_matrix.py
python3 tests/test_structural.py
python3 tests/test_post_grade.py
python3 tests/test_beam_layout.py
python3 tests/test_notch_posts.py
python3 tests/test_stair_support.py
python3 tests/test_irc_table_drift.py
python3 tests/test_jurisdiction_checklist.py      # parallel session
python3 tests/test_steel_labels.py                # parallel session
python3 tests/test_cross_system_consistency.py    # NEW — the seam audit
python3 tests/test_frost_snow_normalize.py        # see note below
python3 tests/test_future_products.py             # see note below
node  tests/test_beam_layout.js
node  tests/test_stair_footprint.js
node  tests/geometry/lotGeometry.test.js
```

**GATE CORRECTION (S102):** `test_frost_snow_normalize.py` and
`test_future_products.py` are real, passing suites that **no prior handoff's gate
list included** — S100's listed nine, S101's listed eleven, neither mentioned
these. They were found by diffing the documented gate against `ls tests/`. Both
pass. Any future handoff should re-derive the gate list from the filesystem
rather than copying it forward, since copying is how they went missing.

**Still in force:** golden MUST be `SBP_SHEET=arch_d`; bare it fails with
everything scaled by 2.571 (36/14) — that is a sheet-size signature, not a
regression.

**Stale bytecode will lie to you.** If a test fails against a file `git diff`
calls clean:
`find . -name "__pycache__" -type d -exec rm -rf {} + ; find . -name "*.pyc" -delete`

**Cache busters — TEN locations covering FIFTEEN files, not the three S100
listed.** Nine explicit `?v=` tags (`home.css`, `tracking.js`, `steelDeckData.js`,
`engine.js`, `stairGeometry.js`, `zoneUtils.js`, `home.js`, `lotGeometry.js`,
`app.js`) plus the shared loader `var v` at `index.html:112`, which covers SIX
dynamically-loaded files — planView, elevationView, deck3d, sitePlanView,
traceView **and steps.js** (index.html:126). S100 §4 listed three; S101 §4 added
`stairGeometry.js` but said the loader covered five, missing `steps.js` — caught
by the parallel session's push 4.

Bump only what you edited. **Verify by grep, never from any table including this
one — it will drift:**
`grep -n "\.js?v=\|\.css?v=" backend/static/index.html`

---

## 10. RECOMMENDED NEXT

1. **JS adopts Python's exposed-edge railing calc** (§5.2). Clean, unblocked, no
   golden movement, closes the last known screen-vs-PDF divergence.
2. **Freestanding second beam** (§5.1). Highest-value real bug. Check the
   reference sets for the detail before writing anything; expect deliberate
   golden movement reviewed sheet by sheet.
3. **Retire S100 §2 in the backlog** so nobody else builds on it. §0 is the
   record.
4. **Fix the stale line numbers** in the `deck3d.js` comment (§5.5).
5. **Product question:** does the wizard imply you can drag a stair inward to
   make a notch, when in fact the notch must exist first? (§1.)
