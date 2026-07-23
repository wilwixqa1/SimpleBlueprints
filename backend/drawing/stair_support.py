"""S100: Stair support detailing, derived from approved permit sets.

WHY THIS MODULE EXISTS
----------------------
calc_engine sizes beams from ``design_load = max(40, snow_load)`` -- uniform
load only. Stair stringer load never enters beam or footing sizing. That gap is
inherited from the IRC itself: the span tables cover only uniform load on the
deck surface, and the code has no prescriptive table for framing that carries
stairs (Mike Guertin, FHB #322 -- too many variables).

The obvious move is to invent a rule. We did not. Instead this module encodes
what three APPROVED Rutstein permit sets actually show:

  Ilaria  (wood, straight stair to grade)
      No dedicated stair support at all. "STAIR AT LOWER LANDING DETAIL"
      shows the stringer NOTCHED FOR PLATE bearing on a MIN. 4" THICK
      concrete landing at grade, 12" MIN. dimensions. Deck posts are 6x6 PT
      w/ Simpson ABU66Z base + BCS2-3/6 cap on 21" piers.

  Welborn (steel Fortress Evolution, straight stairs to grade)
      No dedicated stair support either. Stringers hang from the deck
      structure: "Stair Stringer Anchor Bracket", "Stair Strap", "Preset
      7-1/2in/11in Stair Bracket". The only posts on the plan are the deck's
      3.5" x 3.5" steel posts.

  Loucks  (wood, SWITCHBACK stair with an ELEVATED LANDING)
      The landing IS supported -- as a framed platform on its OWN posts:
      4x4 PT posts w/ Simpson ABU44Z base + BCS2-2/4 cap, (4) PLCS, on their
      own piers. Lighter than the deck's 6x6 / ABU66Z system, and separate
      from it.

THE RULE, as the sets actually practice it
------------------------------------------
Support keys off the LANDING, not off the stair:

  * Stair runs to grade  -> NO posts, NO header. It bears on a concrete pad
    (wood) or hangs from stringer brackets (steel).
  * Stair has an ELEVATED landing -> that landing is a framed platform on
    four corner posts with their own footings.

Note what is absent from all three sets: a header spanning the stringer tops
on two posts. That detail belongs to Guertin's article, which is a RETROFIT
for an existing under-built deck, not a new-construction permit drawing. An
earlier revision of this module built exactly that; the reference sets
corrected us.

This module is PURE (no matplotlib, no I/O) so it is unit-testable in isolation.
"""

EPS = 1e-6

# Grade landing pad, per the "STAIR AT LOWER LANDING DETAIL" in Ilaria/Loucks.
GRADE_PAD_MIN_THICKNESS_IN = 4.0
GRADE_PAD_MIN_DIM_IN = 12.0

# Elevated landing posts, per Loucks. Deliberately lighter than the deck's 6x6.
LANDING_POST_SIZE_WOOD = "4x4"
LANDING_POST_BASE_WOOD = "Simpson ABU44Z"
LANDING_POST_CAP_WOOD = "Simpson BCS2-2/4"
LANDING_PIER_DIA_IN = 20.0  # Loucks uses 20in dia piers

# Steel path (Fortress Evolution), per Welborn.
STAIR_BRACKET_STEEL = "Stair Stringer Anchor Bracket"
STAIR_STRAP_STEEL = "Stair Strap"
LANDING_POST_SIZE_STEEL = '3.5in x 3.5in steel post'

# Load model, used only to flag outliers -- never to size a member we then
# print without a reference set backing it. IRC R301.5 puts stairs at the same
# 40 psf live load as the deck; 10 psf dead for a wood stair assembly.
STAIR_LIVE_PSF = 40.0
STAIR_DEAD_PSF = 10.0
TOP_REACTION_FRACTION = 0.5

# Beyond this, the prescriptive detail the reference sets show stops being
# clearly conservative and the assembly should be engineered.
MAX_PRESCRIPTIVE_REACTION_LB = 4000.0

# Widest landing the (4)-corner-post detail covers WITHOUT an intermediate
# post. Loucks' approved landing is a 4ft switchback, which computes to 8.5ft
# (two flights side by side plus the gap) -- that is the widest span we have
# direct evidence for. A wider landing is not an engineering event; it just
# needs a post partway along the long side, which is ordinary framing. Beyond
# MAX_LANDING_SPAN_FT the platform stops being a simple prescriptive detail.
MAX_PRESCRIPTIVE_LANDING_SPAN_FT = 8.5
MAX_LANDING_SPAN_FT = 16.0


def stair_run_length(geometry):
    """Total horizontal run of a stair in feet, from its template geometry."""
    if not geometry:
        return 0.0
    total = 0.0
    for run in geometry.get("runs", []) or []:
        r = run.get("rect") or {}
        total += max(float(r.get("w", 0.0)), float(r.get("h", 0.0)))
    return total


def stair_top_reaction(stair_width, geometry, total_rise=None):
    """Approximate load (lb) the stringer tops deliver into the deck frame.

    Reported for traceability and for the engineering-threshold check. It does
    NOT size any printed member.
    """
    sw = float(stair_width or 4.0)
    run = stair_run_length(geometry)
    if run <= EPS:
        run = float(total_rise or 0.0) * 1.4
    return sw * run * (STAIR_LIVE_PSF + STAIR_DEAD_PSF) * TOP_REACTION_FRACTION


def _to_world(rect, wax, way, angle):
    """Rotate a stair-local rect into deck-frame world coords."""
    ang = int(round(float(angle or 0))) % 360
    x, y = float(rect.get("x", 0.0)), float(rect.get("y", 0.0))
    w, h = float(rect.get("w", 0.0)), float(rect.get("h", 0.0))
    if ang == 0:
        return {"x0": wax + x, "y0": way + y, "x1": wax + x + w, "y1": way + y + h}
    if ang == 90:
        return {"x0": wax + y, "y0": way - (x + w), "x1": wax + y + h, "y1": way - x}
    if ang == 270:
        return {"x0": wax - (y + h), "y0": way + x, "x1": wax - y, "y1": way + x + w}
    return {"x0": wax - (x + w), "y0": way - (y + h), "x1": wax - x, "y1": way - y}


def _post_to_world(pt, wax, way, angle):
    ang = int(round(float(angle or 0))) % 360
    px, py = float(pt[0]), float(pt[1])
    if ang == 0:
        return (wax + px, way + py)
    if ang == 90:
        return (wax + py, way - px)
    if ang == 270:
        return (wax - py, way + px)
    return (wax - px, way - py)


def _intermediate_landing_posts(world, span, n_bays):
    """Evenly spaced posts along a landing's long side, both edges.

    Returns the interior post pairs only -- the four corners are already
    supplied by the geometry. With ``n_bays`` bays there are ``n_bays - 1``
    interior stations, each getting a post on both long edges.
    """
    x_lo, x_hi = min(world["x0"], world["x1"]), max(world["x0"], world["x1"])
    y_lo, y_hi = min(world["y0"], world["y1"]), max(world["y0"], world["y1"])
    wide_in_x = (x_hi - x_lo) >= (y_hi - y_lo)
    out = []
    for i in range(1, n_bays):
        f = float(i) / n_bays
        if wide_in_x:
            x = x_lo + (x_hi - x_lo) * f
            out.append({"x": round(x, 3), "y": round(y_lo, 3)})
            out.append({"x": round(x, 3), "y": round(y_hi, 3)})
        else:
            y = y_lo + (y_hi - y_lo) * f
            out.append({"x": round(x_lo, 3), "y": round(y, 3)})
            out.append({"x": round(x_hi, 3), "y": round(y, 3)})
    return out


def compute_stair_support(world_anchor_x, world_anchor_y, angle, stair_width,
                          geometry=None, total_rise=None, deck_height=None,
                          framing_type="wood"):
    """Return the stair's support detailing, matching the reference sets.

    Returns::

        {
          "kind": "grade_pad" | "elevated_landing",
          "grade_pad": {...} or None,
          "landings":  [ {rect, posts:[{x,y}], post_size, post_base,
                          post_cap, pier_dia_in, span_ft}, ... ],
          "hardware":  [str, ...],
          "reaction_lb": float,
          "needs_engineer": bool,
          "reason": str or None,
        }

    A stair with no landings (the straight run, and the majority case) gets
    ``kind == "grade_pad"``, an empty ``landings`` list, and NO posts. That is
    what Ilaria and Welborn both show.
    """
    sw = float(stair_width or 4.0)
    wax = float(world_anchor_x)
    way = float(world_anchor_y)
    is_steel = str(framing_type or "wood").lower() == "steel"

    reaction = stair_top_reaction(sw, geometry, total_rise)
    raw_landings = (geometry or {}).get("landings") or []

    landings = []
    needs_engineer = False
    reason = None

    for lnd in raw_landings:
        rect = lnd.get("rect") or {}
        world = _to_world(rect, wax, way, angle)
        posts = [{"x": round(px, 3), "y": round(py, 3)}
                 for (px, py) in (_post_to_world(p, wax, way, angle)
                                  for p in (lnd.get("posts") or []))]
        span = max(float(rect.get("w", 0.0)), float(rect.get("h", 0.0)))
        # A landing wider than the corner-post detail gets intermediate posts
        # along its long side, evenly spaced so no bay exceeds the detail.
        # Only genuinely oversized platforms fall out to an engineer.
        n_bays = 1
        while span / n_bays > MAX_PRESCRIPTIVE_LANDING_SPAN_FT + EPS:
            n_bays += 1
        if span > MAX_LANDING_SPAN_FT + EPS:
            needs_engineer = True
            reason = ("Landing span %.1f ft exceeds the prescriptive platform "
                      "detail (max %.1f ft)." % (span, MAX_LANDING_SPAN_FT))
        if n_bays > 1:
            posts = posts + _intermediate_landing_posts(world, span, n_bays)
        landings.append({
            "rect": {k: round(v, 3) for k, v in world.items()},
            "posts": posts,
            "post_size": LANDING_POST_SIZE_STEEL if is_steel else LANDING_POST_SIZE_WOOD,
            "post_base": None if is_steel else LANDING_POST_BASE_WOOD,
            "post_cap": None if is_steel else LANDING_POST_CAP_WOOD,
            "pier_dia_in": None if is_steel else LANDING_PIER_DIA_IN,
            "span_ft": round(span, 2),
        })

    if reaction > MAX_PRESCRIPTIVE_REACTION_LB:
        needs_engineer = True
        reason = ("Stair top reaction %.0f lb exceeds the prescriptive range "
                  "(%.0f lb)." % (reaction, MAX_PRESCRIPTIVE_REACTION_LB))

    if landings:
        kind = "elevated_landing"
        grade_pad = None
    else:
        # Straight run to grade: no posts, no header. Ilaria + Welborn.
        kind = "grade_pad"
        grade_pad = {
            "min_thickness_in": GRADE_PAD_MIN_THICKNESS_IN,
            "min_dim_in": GRADE_PAD_MIN_DIM_IN,
            "note": "Notch stringer for PT plate; bear on concrete landing.",
        }

    if is_steel:
        hardware = [STAIR_BRACKET_STEEL, STAIR_STRAP_STEEL]
    else:
        hardware = ["Stringer notched for PT plate"]
        if landings:
            hardware = hardware + [LANDING_POST_BASE_WOOD, LANDING_POST_CAP_WOOD]

    return {
        "kind": kind,
        "grade_pad": grade_pad,
        "landings": landings,
        "hardware": hardware,
        "reaction_lb": round(reaction, 0),
        "needs_engineer": needs_engineer,
        "reason": reason,
    }


def compute_all_stair_supports(resolved_stairs, deck_height=None,
                               framing_type="wood"):
    """Map ``resolve_all_stairs()`` output to support detailing per stair.

    Transitional stairs (landing on another deck zone) are skipped: both ends
    bear on framing that is already sized, so neither a grade pad nor a
    ground-bearing post set is the right detail.
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
            framing_type=framing_type,
        )
        support["stair_id"] = (rs.get("stair") or {}).get("id")
        out.append(support)
    return out


def landing_post_xy(supports):
    """Flat list of (x, y) landing post centers across all supports.

    Useful to the post-in-opening oracles and to the materials estimator, and
    keeps callers out of the nested structure.
    """
    pts = []
    for s in supports or []:
        for lnd in s.get("landings") or []:
            for p in lnd.get("posts") or []:
                pts.append((p["x"], p["y"]))
    return pts
