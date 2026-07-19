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
    compute_beam_layout, front_edge_profile, _legacy_posts, _posts_for_segment,
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

# --- 5. S90: short segments never emit coincident/near-coincident posts ------
# The exactly-4-ft strip (a realistic "notch sized to a 4 ft stair") used to
# stack two posts at the same x, over-counting posts/piers. Now: one centered.
for sw in [3.0, 4.0, 4.5, 5.0, 5.9]:
    posts = _posts_for_segment(0.0, sw, 8.0)
    uniq = len({round(p, 3) for p in posts})
    check(f"short seg {sw}ft: single centered post (no dup)",
          len(posts) == 1 and abs(posts[0] - sw / 2.0) < 1e-6,
          f"{posts}")
# 6 ft segment keeps the legacy two end posts (unchanged behavior).
check("6ft seg: legacy two end posts [2,4]",
      _posts_for_segment(0.0, 6.0, 8.0) == [2.0, 4.0],
      str(_posts_for_segment(0.0, 6.0, 8.0)))
# deep-notch 8 ft strip unchanged (previously visually confirmed).
check("8ft seg (x[6,14]): unchanged [8,12]",
      _posts_for_segment(6.0, 14.0, 8.0) == [8.0, 12.0],
      str(_posts_for_segment(6.0, 14.0, 8.0)))
# End-to-end: the realistic 4 ft notch strip yields NO duplicate post_xy.
_strip = compute_beam_layout(20, 14, [_cut(8, 8, 4, 6)], 3, cantilever_max=3.125)
_pxy = _strip["post_xy"]
check("4ft notch strip: no duplicate post positions",
      len(_pxy) == len(set(_pxy)), str(_pxy))

print()
if FAILS:
    print(f"BEAM LAYOUT: {len(FAILS)} FAILURE(S): {FAILS}")
    sys.exit(1)
print("BEAM LAYOUT: all checks passed")
