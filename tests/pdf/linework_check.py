#!/usr/bin/env python3
"""S87: TEXT-OVER-LINEWORK detector (oracle blind-spot fix).

The legibility oracle (legibility_check.py) only sees text-over-TEXT.
It was blind to the S86 DECK LOADS table printing on top of the house
block -- Will's eyes caught what the machine could not. This detector
closes that gap: it hooks the live matplotlib figures during
generate_blueprint_pdf and flags any text whose bounding box is crossed
by foreign linework (Line2D segments or visible patch edges).

Calibrated exclusions (see EXCLUSIONS below):
  E1  Text with a background bbox patch (white-out) is INTENTIONAL
      over-line placement (dimension labels, DOWN, scale text) -- skipped.
  E2  Segments that TERMINATE at the text box (leader lines pointing at a
      margin callout) graze by design -- a segment endpoint inside the
      slightly-expanded box with only a short run inside is excluded.
  E3  Very short intrusions (< MIN_RUN_PX and < MIN_RUN_FRAC of box width)
      are anti-aliased grazes, not tangles.

Usage:
  python3 tests/pdf/linework_check.py <fixture> [<fixture> ...]
  (fixture names from render_review.py PARAM_SETS)

Exit code 1 if any page flags. Library use: scan_params(params) -> issues.
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
import numpy as np  # noqa: E402

MIN_RUN_PX = 9.0        # display px a segment must run inside a text box
MIN_RUN_FRAC = 0.30     # ...or 30% of the box width, whichever is larger
LEADER_PAD_PX = 4.0     # endpoint-inside-expanded-box => leader terminus


def _clip_len(p0, p1, bb):
    """Length of segment p0-p1 clipped to bbox bb (Liang-Barsky)."""
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    t0, t1 = 0.0, 1.0
    for p, q in (
        (-dx, x0 - bb.x0), (dx, bb.x1 - x0),
        (-dy, y0 - bb.y0), (dy, bb.y1 - y0),
    ):
        if p == 0:
            if q < 0:
                return 0.0
            continue
        r = q / p
        if p < 0:
            if r > t1:
                return 0.0
            if r > t0:
                t0 = r
        else:
            if r < t0:
                return 0.0
            if r < t1:
                t1 = r
    if t1 <= t0:
        return 0.0
    return float(np.hypot(dx, dy) * (t1 - t0))


def _inside(pt, bb, pad):
    return (bb.x0 - pad <= pt[0] <= bb.x1 + pad and
            bb.y0 - pad <= pt[1] <= bb.y1 + pad)


def _patch_edge_visible(patch):
    if patch.get_linewidth() == 0:
        return False
    ec = patch.get_edgecolor()
    try:
        return len(ec) < 4 or ec[3] > 0
    except TypeError:
        return ec not in ("none", None)


def scan_figure(fig, page_label=""):
    """Return a list of (page_label, text, kind, run_px, frac) issues."""
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    issues = []
    for ax in fig.axes:
        texts = []
        for t in ax.texts:
            s = t.get_text().strip()
            if not t.get_visible() or not s:
                continue
            if t.get_bbox_patch() is not None:      # E1: intentional white-out
                continue
            try:
                bb = t.get_window_extent(renderer)
            except Exception:
                continue
            if bb.width <= 0 or bb.height <= 0:
                continue
            texts.append((s, bb))
        if not texts:
            continue
        segs = []
        for ln in ax.lines:
            if not ln.get_visible():
                continue
            xy = ln.get_xydata()
            if len(xy) < 2:
                continue
            disp = ln.get_transform().transform(xy)
            for i in range(len(disp) - 1):
                segs.append((disp[i], disp[i + 1], "line"))
        for pt in ax.patches:
            if not pt.get_visible() or not _patch_edge_visible(pt):
                continue
            try:
                tp = pt.get_path().transformed(
                    pt.get_patch_transform() + ax.transData)
            except Exception:
                continue
            for poly in tp.to_polygons():
                for i in range(len(poly) - 1):
                    segs.append((poly[i], poly[i + 1], "patch-edge"))
        for s, bb in texts:
            worst = None
            for a, b, kind in segs:
                run = _clip_len(a, b, bb)
                if run <= 0:
                    continue
                frac = run / bb.width
                # E2: leader terminus graze
                if (_inside(a, bb, LEADER_PAD_PX) or
                        _inside(b, bb, LEADER_PAD_PX)) and frac < 0.40:
                    continue
                # E3: tiny graze
                if run < MIN_RUN_PX and frac < MIN_RUN_FRAC:
                    continue
                if worst is None or run > worst[2]:
                    worst = (s, kind, run, frac)
            if worst:
                issues.append((page_label, worst[0], worst[1],
                               round(worst[2], 1), round(worst[3], 2)))
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
        state["issues"].extend(
            scan_figure(fig, f"{label}p{state['n']}"))
        return orig(self, figure=figure, **kw)

    PdfPages.savefig = hooked
    try:
        generate_blueprint_pdf(dict(params))
    finally:
        PdfPages.savefig = orig
    return state["issues"]


def main(argv):
    import json
    import render_review as rr
    sets = getattr(rr, "PARAM_SETS", None)
    if sets is None:  # fall back: find the dict holding known fixture names
        for v in vars(rr).values():
            if isinstance(v, dict) and "basic_rect_ledger" in v:
                sets = v
                break
    record = "--record-baseline" in argv
    names = [a for a in argv if not a.startswith("--")] or ["basic_rect_ledger"]
    base_path = HERE / "linework_baseline.json"
    baseline = {}
    if base_path.exists():
        baseline = json.loads(base_path.read_text())
    regressions = 0
    for name in names:
        params = sets[name]
        issues = scan_params(params, label=f"{name}:")
        # per-page counts
        counts = {}
        for pg, *_ in issues:
            counts[pg] = counts.get(pg, 0) + 1
        if record:
            baseline[name] = counts
            print(f"[{name}] baseline recorded: {sum(counts.values())} "
                  f"grandfathered (conventional on-line labels)")
            continue
        ref = baseline.get(name, {})
        new = {pg: c for pg, c in counts.items() if c > ref.get(pg, 0)}
        status = "REGRESSION" if new else "OK vs baseline"
        print(f"[{name}] text-over-linework: {sum(counts.values())} "
              f"(baseline {sum(ref.values())}) -> {status}")
        if new:
            regressions += 1
            for pg, txt, kind, run, frac in issues:
                if pg in new:
                    print(f"    {pg}  '{txt[:44]}' x {kind}  "
                          f"run={run}px frac={frac}")
    if record:
        base_path.write_text(json.dumps(baseline, indent=1, sort_keys=True))
        print(f"baseline written: {base_path}")
    sys.exit(1 if regressions else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
