# PARKED: freestanding railing, deck position relative to the house, and the dead `attachmentType` field

Opened S102. **Deliberately not fixed.** Will's call: we do not understand the
problem well enough yet to change behavior. This file exists so the next session
does not re-derive it, and does not "fix" it by making one side match the other.

Read all of section 3 before touching any of this. The tempting one-line fix is
wrong.

---

## 1. What was actually measured (S102, verified, not inferred)

A freestanding deck **with a cutout zone** produces a different railing quantity
on the PDF than on the screen.

Reproduced with: 20x14 deck, 4 ft high, ledger vs freestanding, one 4x4 ft front
cutout at offset 8.

| config | PDF (Python) | screen (app.js) | delta |
|---|---|---|---|
| ledger + 4ft notch | 56.0 ft, 7 kits | 56.0 ft, 7 kits | match |
| **freestanding + 4ft notch** | **76.0 ft, 10 kits** | **56.0 ft, 7 kits** | **20 ft / 3 kits** |
| freestanding, NO zones | 68.0 ft | 68.0 ft | match |

The 20 ft delta is exactly the deck width, i.e. the house-side edge.

### Mechanism, exact locations

- `backend/drawing/zone_utils.py:283-284` gates the skip on attachment:
  `if attachment == "ledger" and e["dir"] == "h" and e["rid"] == 0:` -> skip.
  Docstring at line 239 says "Excludes house-wall edges (y=0 for ledger)".
  So Python **deliberately keeps** the house-side edge when freestanding.
- `backend/static/js/zoneUtils.js` `getExposedEdges` (line 238) has **no
  attachment awareness whatsoever**. Verified by grep: the words `attachment`
  and `ledger` appear in that file only in a comment block at lines 26-27
  describing zone `w`/`d`. It always drops the y=0 edge.

So this is not a rounding or geometry bug. Python implements an attachment rule;
JS never implemented it. Python's behavior is the intentional one.

### Only affects zoned decks

Non-zoned decks agree (both use `width*2 + depth*2` for freestanding). The
divergence only appears once `zones` is non-empty, because that is the only path
that routes through `get_exposed_edges` / `getExposedEdges`:
- Python: `draw_materials.py:158-168` overrides `railLen` when zones exist.
- JS: `app.js:782-794` (`cAdj`) does the same override for the screen.

### Blast radius is wider than materials

`getExposedEdges` also drives the drawn railing in:
- `backend/static/js/deck3d.js:211`
- `backend/static/js/planView.js:44`
and the Python equivalent drives `backend/drawing/draw_plan.py:386`.

So on a **freestanding zoned deck** the 3D view and the plan preview draw the
house-side edge with no guard, while the PDF plan draws one. Fixing the materials
number alone would leave the pictures disagreeing with the list.

---

## 2. Why this is NOT a simple bug fix (the actual open question)

**Will's observation, verified in S102 and the reason this is parked:**

In the current UI you cannot move the deck away from the house. There is no such
control and no such parameter.

Verified:
- The only attachment control is a two-option chip at
  `backend/static/js/steps.js:2983`:
  `<Chips label="Attachment" field="attachment" opts={[["ledger","Ledger Board"],["freestanding","Freestanding"]]} />`
- Grep for any distance/offset-from-house parameter across `calc_engine.py` and
  `zone_utils.py` (`houseOffsetSide`, `deckOffsetFromHouse`, `houseDist`,
  `distFromHouse`, `deckY`) returns **nothing**.
- Deck geometry is always built with the back edge at `y=0`, which IS the house
  wall. Freestanding does not translate the deck; it only changes how it is
  supported.

**Therefore `attachment=freestanding` in this product currently means "not
structurally bolted to the house," NOT "standing away from the house."** The deck
is still modeled tight against the wall.

That makes the correct railing answer genuinely ambiguous:

- If the deck is tight against the house (what the model actually represents),
  the house wall closes that side. There is no fall hazard and no guard is
  needed. **The JS behavior is arguably right and Python over-counts by 3 kits.**
- If the deck is genuinely detached out in the yard, every side is an open side
  with a drop, and over 30 in. above grade a guard is required on all four
  (IRC R312.1.1). **Python is right and the screen under-counts by 3 kits.**

The product cannot currently distinguish these. The wizard's own wording at
`steps.js:5047` leans detached: "Deck is freestanding and not attached to a
structure (detached)". The geometry leans against-the-house. **These two
disagree, and that is the real defect.** It is a modeling gap, not an arithmetic
gap.

Real-world note supporting the ambiguity: building freestanding tight against
the house is a common way to avoid cutting into siding and flashing a ledger. So
"freestanding but adjacent" is a legitimate, common configuration that we
currently render correctly and price ambiguously.

---

## 3. Do NOT do any of these

1. **Do not make JS match Python** (add attachment awareness to
   `getExposedEdges`) as a "parity fix." That silently decides the product
   question in favor of "detached," bills every freestanding zoned customer for
   3 extra kits, and adds a guard across the house side of the 3D view where a
   wall may well be. S101 learning 4 applies exactly: consistency is not
   correctness. Proving the two sides agree would prove nothing about whether
   the number is right.
2. **Do not make Python match JS** either. That deletes a deliberate, documented
   code rule (`zone_utils.py:239, 283-284`) and would under-guard a genuinely
   detached elevated deck. That is the direction that could actually hurt
   somebody.
3. **Do not treat this as the S101 handoff's item 2.2.** Item 2.2 was
   misdiagnosed (see section 5) and this is not it.

---

## 4. What resolving it actually requires (in order)

1. **Product decision from Will:** should the wizard let a deck be positioned
   away from the house at all? That is a new capability touching the site plan,
   setbacks, the ledger/lateral-load path, and stair runs, not a rail tweak.
2. If yes: add an explicit parameter (e.g. `houseGap` in ft, 0 = adjacent) and
   drive the guard rule off `houseGap > 0`, not off `attachment`.
3. If no: decide that freestanding means adjacent, then **Python is the side
   that changes**, and `zone_utils.py:283` should stop gating on attachment.
   Golden will move. That needs Billy on whether a plan reviewer expects a guard
   symbol on the house side of a freestanding deck.
4. **Billy question either way:** on a freestanding deck built tight to the
   house, does the reviewer want a guard called out on the house side? This is
   the kind of thing the reference sets cannot answer because all three
   (Ilaria, Loucks, Welborn) are ledger-attached.
5. Whichever way it lands, it must land in **both** engines in the same push per
   the standing S101 seam guard, and the drawn-railing consumers in section 1
   have to be checked, not just the materials line.

---

## 5. Related finding: `attachmentType` is a dead field (separate, real bug)

Found while verifying the above. Exhaustive grep, whole repo, `.js` and `.py`:

```
backend/static/js/steps.js:4876      var isDet = p.attachmentType === "freestanding";
backend/static/js/steps.js:5037      var isDetached = p.attachmentType === "freestanding";
backend/drawing/jurisdiction_sheet.py:95   attachment = params.get("attachmentType", "attached")
```

**All three are reads. Nothing in the repo ever writes `attachmentType`.** The
wizard writes `attachment` (steps.js:2983).

Consequences, all currently live:
- `steps.js:4876` `isDet` is always false, so the `freestanding` auto-value in
  the jurisdiction checklist never fires.
- `steps.js:5037` `isDetached` always false, same effect.
- `jurisdiction_sheet.py:95` always falls back to `"attached"`, so **the
  jurisdiction sheet reports the deck as attached even when the customer
  selected Freestanding.**

That last one is on the permit path and is a straightforward correctness bug: it
is a wrong statement on a submitted document. It is independent of the railing
question above and can be fixed on its own (read `attachment`, keep
`attachmentType` as a fallback for any stored configs). Confirm whether any
saved params in the wild carry `attachmentType` before removing the fallback.

Not fixed in S102 only because it was out of scope for the session's two agreed
pushes, not because it is ambiguous. **This one is unblocked.**

---

## 6. Provenance

Everything above was verified by execution or exhaustive grep in S102, not
inferred from a prior handoff. The measured tables were produced by running both
engines side by side on identical params. No claim in this file rests on reading
code alone except where a file and line number is cited.
