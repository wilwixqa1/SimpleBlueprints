# S105 KICKOFF — Step 1 (Size & Shape) UI/UX

Agreed with Will at the top of S105. Scope for this session and the next few:
**step 1 onward. The site plan step is out of scope, including its deck
positioning.** Nothing in `sitePlanView.js` gets touched.

Origin: the step-1 items came from S104's handoff §10.5, but Will and Billy had
independently reached the same conclusion from using the product. Billy is a
PPRBD contractor and the closest thing to a real user this product has. His
agreement outranks the document.

---

## The finding that sizes item A1

`zone` is not only a UI word. It is printed on the permit drawings:

```
draw_plan.py:299   label = zone.get("label", f"Zone {zone.get('id','?')}")
draw_plan.py:532   label = ar["zone"].get("label", f"Zone {ar['id']}")
draw_plan.py:534   label.upper()                    → "ZONE 1" on the sheet
```

Word-boundary counts across all four approved PPRBD reference sets:

```
TERM         Ilaria  Loucks  Meadow  Welborn   TOTAL
DECK A            3       4       1        1       9
LANDING           3       6       2        0      11
LEVEL             5       2       3        0      10
SECTION           1       0       0        0       1
ZONE              0       0       1        0       1
TIER / PLATFORM   0       0       0        0       0
```

The single ZONE hit is `ZONE: R1-6` on Meadowview's site plan: the **zoning
district**. So in a permit set the word already means something else, and we
print it beside a site plan that lists zoning setbacks. This is a collision, not
a preference.

(Method note: an earlier pass without word boundaries reported 32 hits for WING.
It was matching DRAWING. Real count is zero. Use `grep -ow`.)

---

## Punch list

### A. Naming
- **A1** Rename zone → section; name each one Deck A / B / C. Reaches the plan
  sheet, general notes, and the material list, not just the screen.
- **A2** Label the two Add controls. "Add Zone" does not say what it adds and
  the second entry point is a bare `+`. Blocked on A1.

### B. Direct manipulation
- **B1** Resize the deck by dragging any edge or corner. Numeric-input only today.
- **B2** Make the whole deck body the drag target, retiring the 30×6 px bar.
- **B3** Let the deck move in both axes, not just left/right.
- **B4** Same edge/corner resize for sections.
- **B5** Fix the cursor that says `ew-resize` and resizes nothing.
- **B6** Hit-target audit. Canvas +/− circles are r=6..10 px, far under a usable
  touch target. Same defect as the 30×6 bar in a different place.

Reference for feel: drafted.ai.

**B is the hard part.** Drag-resize must snap to buildable dimensions, respect
setbacks, stay in the lot, and keep `engine.js`↔`calc_engine.py` and
`zoneUtils.js`↔`zone_utils.py` in step. Drift between them is the exact failure
shape S104 §4.4 documents.

### C. Mode and affordance clarity
- **C1** Four modes on one canvas (select/add/cut/chamfer), never reviewed. Can
  the user tell which mode they are in and what a click will do?
- **C2** The 3-section cap deletes the `+` handles when reached. The UI enforces
  a rule by making the affordance vanish.

### D. Progressive disclosure
- **D1** Collapse completed parts of a step; pull the live part to the top.
- **D2** Deck A not visible without scrolling. Likely free once D1 lands.

### E. Carried
- **E1** Anonymous work survives a refresh, reusing the existing `sb_auth_state`
  snapshot (`app.js:1308` writes it, `app.js:840` restores it). It already
  captures the whole design; it just only fires on the Sign-in click.

---

## Order

A1 first. It is mechanical, it unblocks A2, and it touches the same files as B
and C, so doing it first avoids renaming code we are about to rewrite. It moves
the golden fingerprints; re-baselining is expected.

## Verification

Drag behaviour cannot be checked by reading code. Playwright runs in the
container (S104 §8.1), so B and C get driven in a real browser and measured with
`getBoundingClientRect`, not estimated. Will's screenshots remain the
authoritative visual ground truth.
