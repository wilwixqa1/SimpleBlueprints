"""S100: Dedicated stair support assembly (posts + footings + header).

BACKGROUND
----------
The IRC's joist, beam and footing span tables cover only UNIFORM dead/live/snow
load on the deck surface. They do not cover the CONCENTRATED load that the top
of a set of stair stringers delivers into the deck frame, and the code contains
no prescriptive table for sizing framing that carries stairs -- there are too
many variables (stair span, width, location, landing type).

Consequence for this engine, confirmed by inspection of calc_engine:
``design_load`` is ``max(40, snow_load)``, i.e. uniform only. Stair stringer
load has never entered beam or footing sizing. The main beam is sized as if the
stairs were not there.

The accepted field practice (Mike Guertin, Fine Homebuilding #322; and the
common answer in deck-building practice) is NOT to thread the main beam's posts
around the stair, but to give the stairs their OWN support: two footings, two
posts, and a header that the stringers bear on. That relieves the deck frame of
the stair load entirely, which is exactly what makes the uniform-load tables
valid again for the main structure.

WHAT THIS MODULE DOES
---------------------
Given a resolved stair (its world anchor, width, and exit direction), returns
the dedicated support assembly:

  * ``header``: the member the stringer tops bear on, spanning the stair width
    plus a bearing allowance each side.
  * ``posts``:  two posts, one under each end of the header.
  * ``footings``: one per post.

It also reports the stair's approximate reaction so the header/post sizing is
traceable rather than asserted.

SCOPE BOUNDARY (deliberate, and stated on the drawing)
------------------------------------------------------
This assembly is a PRESCRIPTIVE, conservative detail for ordinary residential
deck stairs. It is not a substitute for engineered design. Where the computed
reaction exceeds the range this detail is good for, ``needs_engineer`` is set
so the caller can print a note rather than silently emit a number we cannot
stand behind.

This module is PURE (no matplotlib, no I/O) so it is unit-testable in isolation.
"""

EPS = 1e-6

# Bearing allowance each side of the clear stair width, so the header extends
# past the outer stringers far enough to land on a post.
HEADER_BEARING_EACH_SIDE = 0.5  # ft

# Load model for the stair itself. IRC R301.5 puts stairs at the same 40 psf
# live load as the deck; dead load for a wood stair assembly is taken at 10 psf.
STAIR_LIVE_PSF = 40.0
STAIR_DEAD_PSF = 10.0

# The top of the stringers delivers roughly half the total stair weight (the
# other half goes to grade at the bottom). Simple statics for a simply-supported
# inclined member, which is how this detail is normally reasoned about.
TOP_REACTION_FRACTION = 0.5

# Beyond this the two-post/one-header prescriptive detail stops being clearly
# conservative and the assembly should be engineered.
MAX_PRESCRIPTIVE_REACTION_LB = 4000.0

# Header sizing: (max clear span ft, nominal size). Doubled members, SPF/DF-L,
# carrying the stair top reaction as a point/near-uniform load. Conservative
# relative to IRC R507.5 beam tables at the equivalent tributary.
_HEADER_TABLE = [
    (4.0, "2-ply 2x8"),
    (6.0, "2-ply 2x10"),
    (8.0, "2-ply 2x12"),
]


def stair_run_length(geometry):
    """Total horizontal run of a stair, in feet, from its template geometry.

    Uses the sum of the run rects' extent along the direction of travel, which
    is what determines how much stair weight exists (and therefore how much
    lands on the top header).
    """
    if not geometry:
        return 0.0
    total = 0.0
    for run in geometry.get("runs", []) or []:
        r = run.get("rect") or {}
        # Runs travel along whichever axis is longer for that rect; the tread
        # axis tells us which, but taking the max is equivalent and avoids
        # depending on a field that older geometry dicts may not carry.
        total += max(float(r.get("w", 0.0)), float(r.get("h", 0.0)))
    return total


def stair_top_reaction(stair_width, geometry, total_rise=None):
    """Approximate load (lb) delivered by the stringer tops into the deck.

    Returns a float. The stair's plan area carries live + dead; roughly half of
    that reaches the top bearing point.
    """
    sw = float(stair_width or 4.0)
    run = stair_run_length(geometry)
    if run <= EPS:
        # Fall back to an estimate from rise if geometry is unavailable:
        # a code-compliant stair runs about 1.4 ft horizontally per ft of rise.
        run = float(total_rise or 0.0) * 1.4
    plan_area = sw * run
    total_load = plan_area * (STAIR_LIVE_PSF + STAIR_DEAD_PSF)
    return total_load * TOP_REACTION_FRACTION


def select_header_size(clear_span_ft):
    """Smallest tabulated doubled header that spans ``clear_span_ft``."""
    for max_span, size in _HEADER_TABLE:
        if clear_span_ft <= max_span + EPS:
            return size
    return None  # beyond the prescriptive detail


def compute_stair_support(world_anchor_x, world_anchor_y, angle, stair_width,
                          geometry=None, total_rise=None, deck_height=None):
    """Return the dedicated support assembly for one stair.

    Coordinates are deck-frame world feet, matching beam_layout / stair_utils:
    +x right along the house, +y outward from the house.

    ``angle`` is the stair's rotation: 0 = exits front (+y), 90 = exits right
    (+x), 270 = exits left (-x), 180 = exits back (-y).

    Returns::

        {
          "header": {"x0","y0","x1","y1","size","clear_span"},
          "posts":   [{"x","y","height"}, ...],
          "footings":[{"x","y"}, ...],
          "reaction_lb": float,
          "needs_engineer": bool,
          "reason": str or None,
        }

    The header is placed AT the stair's top bearing line, perpendicular to the
    direction of travel, and extends ``HEADER_BEARING_EACH_SIDE`` past the clear
    stair width on each side so each end lands on a post.
    """
    sw = float(stair_width or 4.0)
    ax = float(world_anchor_x)
    ay = float(world_anchor_y)
    ang = int(round(float(angle or 0))) % 360

    half = sw / 2.0 + HEADER_BEARING_EACH_SIDE
    clear_span = sw + 2 * HEADER_BEARING_EACH_SIDE

    # Header runs perpendicular to travel, centered on the anchor.
    if ang == 0 or ang == 180:
        # Travel along y -> header runs along x.
        x0, x1 = ax - half, ax + half
        y0 = y1 = ay
        post_pts = [(x0, ay), (x1, ay)]
    else:
        # Travel along x -> header runs along y.
        y0, y1 = ay - half, ay + half
        x0 = x1 = ax
        post_pts = [(ax, y0), (ax, y1)]

    reaction = stair_top_reaction(sw, geometry, total_rise)
    size = select_header_size(clear_span)

    needs_engineer = False
    reason = None
    if size is None:
        needs_engineer = True
        reason = ("Stair width %.1f ft exceeds the prescriptive header detail "
                  "(max %.1f ft clear span)." % (sw, _HEADER_TABLE[-1][0]))
        size = _HEADER_TABLE[-1][1]
    elif reaction > MAX_PRESCRIPTIVE_REACTION_LB:
        needs_engineer = True
        reason = ("Stair top reaction %.0f lb exceeds the prescriptive detail "
                  "(%.0f lb)." % (reaction, MAX_PRESCRIPTIVE_REACTION_LB))

    post_h = float(deck_height) if deck_height is not None else None
    posts = [{"x": round(px, 3), "y": round(py, 3), "height": post_h}
             for (px, py) in post_pts]
    footings = [{"x": p["x"], "y": p["y"]} for p in posts]

    return {
        "header": {
            "x0": round(x0, 3), "y0": round(y0, 3),
            "x1": round(x1, 3), "y1": round(y1, 3),
            "size": size,
            "clear_span": round(clear_span, 2),
        },
        "posts": posts,
        "footings": footings,
        "reaction_lb": round(reaction, 0),
        "needs_engineer": needs_engineer,
        "reason": reason,
    }


def compute_all_stair_supports(resolved_stairs, deck_height=None):
    """Map ``resolve_all_stairs()`` output to a list of support assemblies.

    Grade-bearing stairs get an assembly. Transitional stairs (landing on
    another deck zone) are skipped: their top and bottom both bear on framed
    structure that is already sized, so a ground-bearing post/footing pair is
    not the right detail.
    """
    out = []
    for rs in resolved_stairs or []:
        elev = rs.get("elevation_info") or {}
        if elev.get("isTransitional"):
            continue
        support = compute_stair_support(
            world_anchor_x=rs.get("world_anchor_x", 0.0),
            world_anchor_y=rs.get("world_anchor_y", 0.0),
            angle=rs.get("angle", 0),
            stair_width=(rs.get("stair") or {}).get("width", 4),
            geometry=rs.get("geometry"),
            total_rise=elev.get("totalRise"),
            deck_height=deck_height,
        )
        support["stair_id"] = (rs.get("stair") or {}).get("id")
        out.append(support)
    return out
