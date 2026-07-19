"""S89: Cutout-aware main-deck beam + post layout (fix for B10 / B4-B6 class).

BACKGROUND
----------
The legacy engine placed ONE straight beam at ``depth - 1.5`` with posts spread
evenly across the full deck width, computed only from ``width``. It had no idea
about the deck's real shape. On a notched (cutout) deck this strands a support
post over the empty notch -- a post that holds up nothing (bug B10) -- and more
generally mis-supports any non-rectangular deck (the B4 / B6 L-shape and
wraparound class).

WHAT THIS DOES
--------------
Computes the beam line(s) and post positions from the REAL, cutout-aware
front-edge profile of the main deck, honoring the IRC 2021 cantilever allowance:

  * A deck may overhang past its beam as a cantilever, but only up to one-fourth
    of the joist back-span (IRC 2021 R507.6), capped by the joist span table --
    ``cantilever_max`` here. Beyond that the deck must sit on a beam + posts.

DECISION (the automatic "option b" cantilever, layered on the "option a" base):
  * If a SINGLE straight beam can support the whole deck with every overhang
    within ``cantilever_max``, keep it straight (fewest posts -- the cantilever
    absorbs shallow steps). This is what a good contractor does.
  * Otherwise the beam STEPS IN to follow the real edge, segment by segment, so
    no post is ever placed where there is no deck above it (option a fallback).

INVARIANT: with NO front cutouts the result is byte-for-byte the legacy layout
(one beam at ``depth - 1.5``; the exact legacy post x-positions). The no-zone /
no-cutout permit set must stay identical -- callers pass the legacy ``num_posts``
and get the legacy positions back unchanged.

This module is PURE (no matplotlib, no I/O) so it is unit-testable in isolation
and works with vision down.
"""

import math

EPS = 1e-6
DEFAULT_SETBACK = 1.5  # ft the beam sits in from the edge it supports (legacy)


def front_edge_profile(width, depth, cut_rects):
    """Return the outer (front) edge of the main deck as a left-to-right list of
    ``(x0, x1, edge_y)`` segments across ``[0, width]``.

    ``edge_y`` is how far the deck extends toward the yard at that x. Normally
    ``depth``; a cutout that reaches the front edge pulls it in to the cutout's
    inner y. Only front-reaching cutouts matter for the front beam -- side/back
    cutouts don't move this edge (they're a later generalization).
    """
    fronts = []  # (x0, x1, edge_y) reductions
    for cr in cut_rects:
        r = cr.get("rect", cr)
        # A cutout reaches the front edge when its far side hits the deck's front.
        if r["y"] + r["d"] >= depth - EPS:
            x0 = max(0.0, float(r["x"]))
            x1 = min(float(width), float(r["x"]) + float(r["w"]))
            if x1 > x0 + EPS:
                fronts.append((x0, x1, float(r["y"])))  # edge pulled in to r.y

    # Breakpoints = every cutout edge, plus the deck ends.
    xs = {0.0, float(width)}
    for (x0, x1, _ey) in fronts:
        xs.add(x0)
        xs.add(x1)
    xs = sorted(xs)

    segs = []
    for i in range(len(xs) - 1):
        a, b = xs[i], xs[i + 1]
        if b - a < EPS:
            continue
        mid = (a + b) / 2.0
        ey = float(depth)
        for (fx0, fx1, fey) in fronts:
            if fx0 - EPS <= mid <= fx1 + EPS:
                ey = min(ey, fey)
        segs.append([a, b, ey])

    # Merge adjacent segments at the same edge level.
    merged = []
    for s in segs:
        if merged and abs(merged[-1][2] - s[2]) < EPS and abs(merged[-1][1] - s[0]) < EPS:
            merged[-1][1] = s[1]
        else:
            merged.append(list(s))
    return [tuple(m) for m in merged]


def _legacy_posts(width, num_posts):
    """EXACT legacy post x-positions (calc_engine). Preserved byte-for-byte for
    the flat / no-cutout deck."""
    out = []
    for i in range(num_posts):
        if num_posts == 1:
            out.append(width / 2)
        else:
            out.append(round(2 + i * (width - 4) / (num_posts - 1), 2))
    return out


def _posts_for_segment(x0, x1, max_beam_span):
    """Post x-positions along one beam segment so no post-to-post span exceeds
    ``max_beam_span``. Mirrors the legacy 2-in-from-each-end inset."""
    seg_w = x1 - x0
    if seg_w < 4.0:
        # Segment too short for the 2ft insets: a single centered post.
        return [round(x0 + seg_w / 2.0, 2)]
    n = max(2, math.ceil(seg_w / max_beam_span - EPS) + 1)
    return [round(x0 + 2 + i * (seg_w - 4) / (n - 1), 2) for i in range(n)]


def notched_deck_polygon(width, depth, cut_rects):
    """CCW vertex loop of the main-deck outline that follows front cutouts, for
    the framing-sheet deck body + joist clip. Returns None when there is no
    front cutout, so the caller keeps its normal rectangle/chamfer outline
    (flat decks stay byte-identical).
    """
    prof = front_edge_profile(width, depth, cut_rects)
    has_front = len(prof) > 1 or (prof and abs(prof[0][2] - depth) > EPS)
    if not has_front:
        return None
    # Front edge as a polyline, left -> right (horizontal runs + vertical steps).
    pts = []
    prev = None
    for i, (a, b, ey) in enumerate(prof):
        if i == 0:
            pts.append((a, ey))
        else:
            pts.append((a, prev))
            pts.append((a, ey))
        pts.append((b, ey))
        prev = ey
    # Deck loop: ledger edge (y=0) left->right, up the right side, front edge
    # right->left (concave at the notch), down the left side, close.
    verts = [(0.0, 0.0), (float(width), 0.0)]
    verts += list(reversed(pts))
    return verts


def notch_headers(width, depth, cut_rects):
    """Doubled-header segments framing each front notch: a list of
    {'x0','x1','y'} where y is the bottom-of-notch line the header runs along
    and x0/x1 are the inside corners where joists double up.
    """
    out = []
    for cr in cut_rects:
        r = cr.get("rect", cr)
        if r["y"] + r["d"] >= depth - EPS:  # front-reaching cutout
            x0 = max(0.0, float(r["x"]))
            x1 = min(float(width), float(r["x"]) + float(r["w"]))
            if x1 > x0 + EPS:
                out.append({"x0": x0, "x1": x1, "y": float(r["y"])})
    return out


def compute_beam_layout(width, depth, cut_rects, num_posts,
                        cantilever_max, setback=DEFAULT_SETBACK,
                        max_beam_span=8.0):
    """Return the main-deck beam layout.

    Result dict:
      ``segments``: list of ``{x0, x1, beam_y, max_cant, posts:[x...]}``
      ``post_xy``:  flat list of ``(x, beam_y)`` post centers (for callers /
                    the post-in-notch oracle)
      ``stepped``:  True if the beam had to step to follow the edge
      ``over_limit``: True if any required overhang exceeds ``cantilever_max``
                      even after stepping (should never happen for option a;
                      signals a config the prescriptive path can't support)

    ``cut_rects`` are get_cutout_rects()-style dicts. ``num_posts`` is the
    legacy count used ONLY for the flat case to stay byte-identical.
    """
    profile = front_edge_profile(width, depth, cut_rects)
    has_front_cut = len(profile) > 1 or (profile and abs(profile[0][2] - depth) > EPS)

    # ---- Flat / no-front-cutout: reproduce the legacy layout EXACTLY. ----
    if not has_front_cut:
        beam_y = round(depth - setback, 2)
        posts = _legacy_posts(width, num_posts)
        return {
            "segments": [{"x0": 0.0, "x1": float(width), "beam_y": beam_y,
                          "max_cant": setback, "posts": posts}],
            "post_xy": [(px, beam_y) for px in posts],
            "stepped": False,
            "over_limit": False,
        }

    min_edge = min(ey for _, _, ey in profile)
    max_edge = max(ey for _, _, ey in profile)

    # ---- Option b: can ONE straight beam serve the whole deck? ----
    # Place it setback in from the DEEPEST notch so it's under real deck
    # everywhere; the widest overhang is then (max_edge - beam_y).
    straight_y = min_edge - setback
    straight_cant = max_edge - straight_y  # = (max_edge - min_edge) + setback
    if straight_y > EPS and straight_cant <= cantilever_max + EPS:
        posts = _posts_for_segment(0.0, float(width), max_beam_span)
        by = round(straight_y, 2)
        return {
            "segments": [{"x0": 0.0, "x1": float(width), "beam_y": by,
                          "max_cant": round(straight_cant, 2), "posts": posts}],
            "post_xy": [(px, by) for px in posts],
            "stepped": False,
            "over_limit": False,
        }

    # ---- Option a: step the beam to follow each edge level. ----
    segments = []
    post_xy = []
    over_limit = False
    for (a, b, ey) in profile:
        by = round(ey - setback, 2)
        if by <= EPS:
            # Edge too shallow for a full setback; sit the beam at the edge.
            by = round(max(ey - min(setback, ey * 0.5), 0.5), 2)
        cant = round(ey - by, 2)
        if cant > cantilever_max + EPS:
            over_limit = True
        posts = _posts_for_segment(a, b, max_beam_span)
        segments.append({"x0": a, "x1": b, "beam_y": by,
                         "max_cant": cant, "posts": posts})
        post_xy.extend((px, by) for px in posts)

    return {
        "segments": segments,
        "post_xy": post_xy,
        "stepped": True,
        "over_limit": over_limit,
    }
