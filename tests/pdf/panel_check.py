#!/usr/bin/env python3
"""S88: PANEL-OVERFLOW detector -- G5 / G6 / G7 from the vision-dependency
inventory (MASTER_CONTEXT 10E). All three are the same bbox fact measured
against the owning axes rectangle, with three distinct outcomes:

  G5 text-outside-panel      text bbox extends beyond its own axes rect
                             (clip_on False -> prints outside the panel).
                             EVIDENCE: S85 South-elevation callout spanning
                             the gutter into the North view's quadrant.
  G6 text-clipped-at-edge    text bbox extends beyond its axes rect WITH
                             clip_on True -> prints partial words ("...Z'
                             POST BASE AND" fragments, S85 North elevation),
                             OR any text bbox crossing the physical sheet
                             trim (clipped by the page itself).
  G7 callout-into-neighbor   the overflowing bbox (G5 case) additionally
                             lands inside ANOTHER axes' rectangle on the
                             same sheet -- text from view A printing over
                             view B's drawing space. G5+G7 co-occur on
                             multi-view elevation sheets; reported per-kind.

DIFFERENTIAL BASELINE (same doctrine as linework_check.py): sheets have
conventional, intentional outside-the-rect text (panel titles above the
axes, dimension text in the margin band, title-block furniture). A per-
fixture/per-page baseline (panel_baseline.json) grandfathers those; CI
fails only ABOVE baseline. Fonts + matplotlib are pinned (the S87 push 8-9
lesson) so bboxes measure identically on every machine.

Calibrated exclusions:
  E1  Overflow smaller than MIN_OUT_PX in every direction (anti-alias /
      descender grazes of the rect edge).
  E2  Axes that are sheet furniture (frameless, no drawing content --
      title block strips) still count as panels for OWNERSHIP but their
      texts often live at the rect edge by design; tiny overflows excluded
      by E1, larger ones grandfathered by the baseline.

Usage:
  python3 tests/pdf/panel_check.py <fixture> [<fixture> ...]
  python3 tests/pdf/panel_check.py --record-baseline <fixtures...>
Exit 1 on any fixture above baseline. Library: scan_params(params) -> issues.
"""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(HERE))

import matplotlib  # noqa: E402
matplotlib.use("Agg")
# Pin to matplotlib's BUNDLED fonts -- identical text bboxes on every machine.
matplotlib.rcParams["font.family"] = "sans-serif"
matplotlib.rcParams["font.sans-serif"] = ["DejaVu Sans"]
matplotlib.rcParams["font.monospace"] = ["DejaVu Sans Mono"]
matplotlib.rcParams["font.serif"] = ["DejaVu Serif"]

MIN_OUT_PX = 6.0     # bbox must poke out at least this far to count (E1)
NEIGHBOR_MIN_PX = 4.0  # overlap depth into a neighbor rect to call it G7


def _overflow(bb, rect):
    """Max distance (px) the text bbox pokes outside the axes rect."""
    return max(rect.x0 - bb.x0, bb.x1 - rect.x1,
               rect.y0 - bb.y0, bb.y1 - rect.y1, 0.0)


def _overlap_depth(bb, rect):
    """Min penetration depth of bb into rect (0 if disjoint)."""
    ox = min(bb.x1, rect.x1) - max(bb.x0, rect.x0)
    oy = min(bb.y1, rect.y1) - max(bb.y0, rect.y0)
    if ox <= 0 or oy <= 0:
        return 0.0
    return min(ox, oy)


def scan_figure(fig, page_label=""):
    """Return list of (page_label, kind, text, px) issues.
    kind in {"G5-outside-panel", "G6-clipped", "G7-into-neighbor"}."""
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    fig_bb = fig.bbox  # physical sheet in display px
    axes = [ax for ax in fig.axes if ax.get_visible()]
    rects = {id(ax): ax.get_window_extent(renderer) for ax in axes}
    issues = []
    for ax in axes:
        own = rects[id(ax)]
        for t in ax.texts:
            s = t.get_text().strip()
            if not t.get_visible() or not s:
                continue
            try:
                bb = t.get_window_extent(renderer)
            except Exception:
                continue
            if bb.width <= 0 or bb.height <= 0:
                continue
            # G6a: crosses the physical sheet trim -> printed partial words.
            trim_out = _overflow(bb, fig_bb)
            if trim_out > MIN_OUT_PX:
                issues.append((page_label, "G6-clipped", s, round(trim_out, 1)))
                continue
            out = _overflow(bb, own)
            if out <= MIN_OUT_PX:
                continue  # E1: inside its panel (or grazing)
            clipped = bool(t.get_clip_on())
            if clipped:
                # G6b: clip_on text poking out prints PARTIAL words.
                issues.append((page_label, "G6-clipped", s, round(out, 1)))
                continue
            # G5: prints outside its own panel.
            kind = "G5-outside-panel"
            # G7: does the escaped bbox land in a neighbor's rect?
            for other in axes:
                if other is ax:
                    continue
                depth = _overlap_depth(bb, rects[id(other)])
                if depth > NEIGHBOR_MIN_PX:
                    kind = "G7-into-neighbor"
                    out = depth
                    break
            issues.append((page_label, kind, s, round(out, 1)))
    return issues


def scan_params(params, label=""):
    """Run generate_blueprint_pdf with a savefig hook; return all issues."""
    from matplotlib.backends.backend_pdf import PdfPages
    from app.main import generate_blueprint_pdf
    orig = PdfPages.savefig
    state = {"n": 0, "issues": []}

    def hooked(self, figure=None, **kw):
        state["n"] += 1
        fig = figure
        if fig is None:
            import matplotlib.pyplot as plt
            fig = plt.gcf()
        state["issues"].extend(scan_figure(fig, f"{label}p{state['n']}"))
        return orig(self, figure=figure, **kw)

    PdfPages.savefig = hooked
    try:
        generate_blueprint_pdf(dict(params))
    finally:
        PdfPages.savefig = orig
    return state["issues"]


def selftest():
    """Prove each kind detects on a synthetic two-panel figure (the S85
    elevation bug shapes), and that clean text does not flag."""
    import matplotlib.pyplot as plt
    fig, (axA, axB) = plt.subplots(1, 2, figsize=(20, 10))
    for ax in (axA, axB):
        ax.set_xlim(0, 10); ax.set_ylim(0, 10)
    # clean: inside its own panel
    axA.text(5, 5, "INSIDE PANEL TEXT", ha="center")
    # G5: escapes its panel leftward into empty margin (clip off)
    axA.text(0, 8, "6x6 PT POST", ha="right", clip_on=False)
    # G7: escapes rightward across the gutter INTO panel B (the S85 bug)
    axA.text(10, 2, "CALLOUT SPANNING THE GUTTER INTO THE NORTH VIEW " * 2,
             ha="left", clip_on=False)
    # G6: clip_on text poking out -> prints partial words
    axB.text(9.5, 5, "DEEP (3 PLCS) CLIPPED MID WORD FRAGMENT",
             ha="left", clip_on=True)
    issues = scan_figure(fig, "selftest")
    kinds = {k for _, k, *_ in issues}
    texts = {t for _, _, t, _ in issues}
    ok = True
    for want in ("G5-outside-panel", "G7-into-neighbor", "G6-clipped"):
        got = want in kinds
        print(f"  {want}: {'DETECTED' if got else 'MISSED'}")
        ok &= got
    clean_flagged = "INSIDE PANEL TEXT" in texts
    print(f"  clean text: {'WRONGLY FLAGGED' if clean_flagged else 'clean'}")
    ok &= not clean_flagged
    plt.close(fig)
    print("SELFTEST:", "PASS" if ok else "FAIL")
    return ok


def main(argv):
    import json
    if "--selftest" in argv:
        sys.exit(0 if selftest() else 1)
    import render_review as rr
    sets = getattr(rr, "PARAM_SETS", None)
    if sets is None:
        for v in vars(rr).values():
            if isinstance(v, dict) and "basic_rect_ledger" in v:
                sets = v
                break
    record = "--record-baseline" in argv
    verbose = "--verbose" in argv
    names = [a for a in argv if not a.startswith("--")] or ["basic_rect_ledger"]
    base_path = HERE / "panel_baseline.json"
    baseline = {}
    if base_path.exists():
        baseline = json.loads(base_path.read_text())
    regressions = 0
    for name in names:
        params = sets[name]
        issues = scan_params(params, label=f"{name}:")
        counts = {}
        for pg, kind, *_ in issues:
            key = f"{pg}|{kind}"
            counts[key] = counts.get(key, 0) + 1
        if verbose:
            for pg, kind, txt, px in issues:
                print(f"    {pg}  {kind}  '{txt[:48]}'  out={px}px")
        if record:
            baseline[name] = counts
            print(f"[{name}] baseline recorded: {sum(counts.values())} "
                  f"grandfathered (conventional out-of-rect text)")
            continue
        ref = baseline.get(name, {})
        new = {k: c for k, c in counts.items() if c > ref.get(k, 0)}
        status = "REGRESSION" if new else "OK vs baseline"
        print(f"[{name}] panel-overflow (G5/G6/G7): {sum(counts.values())} "
              f"(baseline {sum(ref.values())}) -> {status}")
        if new:
            regressions += 1
            for pg, kind, txt, px in issues:
                if f"{pg}|{kind}" in new:
                    print(f"    NEW {pg}  {kind}  '{txt[:48]}'  out={px}px")
    if record:
        base_path.write_text(json.dumps(baseline, indent=1, sort_keys=True))
        print(f"baseline written: {base_path}")
    sys.exit(1 if regressions else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
