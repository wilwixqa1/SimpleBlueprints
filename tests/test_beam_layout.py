"""S89: unit tests for drawing/beam_layout.py (cutout-aware beam + posts).

Judges the fix for B10 / B4-B6 without any rendering (vision-independent):
  1. FLAT deck (no cutout) reproduces the legacy post layout EXACTLY -- the
     no-zone permit set must stay byte-identical.
  2. DEEP front notch: no post lands inside the notch (the B10 bug), beam steps.
  3. SHALLOW front notch: a single straight beam absorbs it as a cantilever
     (option b) and still strands no post.
  4. No segment ever overhangs past the cantilever limit.
"""
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from drawing.beam_layout import (  # noqa: E402
    compute_beam_layout, front_edge_profile, _legacy_posts,
)

FAILS = []


def check(name, cond, detail=""):
    tag = "OK  " if cond else "FAIL"
    if not cond:
        FAILS.append(name)
    print(f"  [{tag}] {name}" + (f"  {detail}" if detail else ""))


def _cut(x, y, w, d):
    return {"rect": {"x": x, "y": y, "w": w, "d": d}}


def post_in_any_cut(post_xy, cut_rects):
    """True if a post center sits inside any cutout rect (= stranded)."""
    for (px, py) in post_xy:
        for cr in cut_rects:
            r = cr["rect"]
            if r["x"] <= px <= r["x"] + r["w"] and r["y"] <= py <= r["y"] + r["d"]:
                return (px, py)
    return None


# --- 1. FLAT deck: byte-identical to legacy ---------------------------------
for (W, D, NP) in [(20, 12, 3), (16, 12, 3), (32, 14, 4), (10, 10, 2), (40, 16, 5)]:
    lay = compute_beam_layout(W, D, [], NP, cantilever_max=3.0)
    legacy = _legacy_posts(W, NP)
    got = lay["segments"][0]["posts"]
    check(f"flat {W}x{D} np={NP}: legacy posts preserved", got == legacy,
          f"{got} vs {legacy}")
    check(f"flat {W}x{D}: single beam at depth-1.5",
          not lay["stepped"] and abs(lay["segments"][0]["beam_y"] - (D - 1.5)) < 1e-6,
          f"beam_y={lay['segments'][0]['beam_y']}")

# --- 2. DEEP front notch (the B10 repro: 20x14, notch x[6,14] to y=8) --------
deep_cuts = [_cut(6, 8, 8, 6)]  # front cutout, edge pulled to y=8 (cd=6)
prof = front_edge_profile(20, 14, deep_cuts)
check("deep notch: profile has 3 levels 14/8/14",
      [round(e[2]) for e in prof] == [14, 8, 14], str(prof))
deep = compute_beam_layout(20, 14, deep_cuts, 3, cantilever_max=3.125)
strand = post_in_any_cut(deep["post_xy"], deep_cuts)
check("deep notch: NO post stranded in the notch", strand is None,
      f"stranded {strand}" if strand else "clean")
check("deep notch: beam steps to follow the edge", deep["stepped"] is True)
check("deep notch: a post sits under the shallow strip (beam_y ~6.5)",
      any(abs(py - 6.5) < 1e-6 for (_px, py) in deep["post_xy"]),
      str(deep["post_xy"]))

# --- 3. SHALLOW front notch (cd=1: absorbed by cantilever, option b) ---------
shallow_cuts = [_cut(6, 13, 8, 1)]  # edge pulled only to y=13 (cd=1)
shallow = compute_beam_layout(20, 14, shallow_cuts, 3, cantilever_max=3.125)
check("shallow notch: single straight beam (no step)", shallow["stepped"] is False)
strand2 = post_in_any_cut(shallow["post_xy"], shallow_cuts)
check("shallow notch: NO post stranded", strand2 is None,
      f"stranded {strand2}" if strand2 else "clean")

# --- 4. Cantilever limit respected in every case ----------------------------
for name, cuts in [("deep", deep_cuts), ("shallow", shallow_cuts)]:
    lay = compute_beam_layout(20, 14, cuts, 3, cantilever_max=3.125)
    worst = max(s["max_cant"] for s in lay["segments"])
    check(f"{name}: no overhang over cantilever_max (worst={worst})",
          not lay["over_limit"])

print()
if FAILS:
    print(f"BEAM LAYOUT: {len(FAILS)} FAILURE(S): {FAILS}")
    sys.exit(1)
print("BEAM LAYOUT: all checks passed")
