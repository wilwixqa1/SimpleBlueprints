#!/usr/bin/env python3
"""
SimpleBlueprints - Parametric PDF Drawing Engine
Sheet A-2: Exterior Elevations (4-View: South / North / East / West)
S24: Zone-aware South/North views - left/right zones extend visible width.
     Each zone section drawn independently with own deck_top (future: height-per-zone).
S35: Variable post heights in all 4 elevations, underground footing lines,
     Simpson hardware callouts, graphic scale bars.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Polygon
from matplotlib.backends.backend_pdf import PdfPages
import numpy as np

from .calc_engine import calculate_structure
from .draw_plan import BRAND, draw_dimension_h, draw_dimension_v, draw_scale_bar, format_feet_inches
from .stair_utils import get_stair_placement, get_stair_exit_side, resolve_all_stairs, transform_stair_point
from .zone_utils import get_additive_rects, get_bounding_box


# Actual lumber depths in feet (nominal -> actual)
_BEAM_DEPTH_MAP = {
    "2x6": 5.5 / 12, "2x8": 7.25 / 12, "2x10": 9.25 / 12,
    "2x12": 11.25 / 12, "1.75x12": 11.875 / 12,
}


def _beam_h_from_calc(calc):
    """Derive beam visual height (ft) from calc['beam_size'].
    Parses strings like '2-ply 2x10', '3-ply LVL 1.75x12'."""
    bs = calc.get("beam_size", "")
    for key, depth in _BEAM_DEPTH_MAP.items():
        if key in bs:
            return depth
    return 11.25 / 12  # default to 2x12 depth


# ============================================================
# ZONE ELEVATION HELPERS
# ============================================================
def _get_zone_south_north_sections(params, calc):
    """
    Compute zone sections visible in South/North elevation views.
    Only left/right zones extend the visible width in these views.

    Returns: {
        x_off: float - shift for zone-0 drawing (accounts for left zones),
        bb_w: float - total bounding box width,
        sections: list of {x_draw, w, deck_top} - zone wing sections to draw
    }
    No-zone case: x_off=0, bb_w=W, sections=[]
    """
    zones = params.get("zones", [])
    W = calc["width"]
    H = calc["height"]

    if not zones:
        return {"x_off": 0, "bb_w": W, "sections": []}

    bb = get_bounding_box(params)
    x_off = -bb["x"]  # shift zone-0 right when left zones exist
    bb_w = bb["w"]

    add_rects = get_additive_rects(params)
    sections = []
    for ar in add_rects:
        if ar["id"] == 0:
            continue  # zone-0 drawn by main function
        r = ar["rect"]
        zone = ar["zone"]
        edge = zone.get("attachEdge", "front")
        if edge not in ("left", "right"):
            continue  # only left/right zones affect S/N width

        sections.append({
            "x_draw": r["x"] + x_off,  # x in drawing coords (relative to deck_x)
            "w": r["w"],
            "deck_top": H,  # future: zone.get("height", H)
        })

    return {"x_off": x_off, "bb_w": bb_w, "sections": sections}


def _draw_zone_section_south(ax, deck_x, section, ground_y, beam_h, beam_type, rail_h, joist_spacing=16):
    """
    Draw one zone wing section in the South elevation view.
    Independent block: own deck surface, posts, beam, railing.
    deck_top is per-section (future: height-per-zone support).
    """
    zx = deck_x + section["x_draw"]
    zw = section["w"]
    zt = section["deck_top"]
    rail_top = zt + rail_h

    # Posts: guard against narrow zones (<3 ft) where edge offsets would overlap
    post_offsets = [zw / 2] if zw < 3 else [1.5, zw - 1.5]
    for px_off in post_offsets:
        spx = zx + px_off
        # Footing
        ax.add_patch(patches.Rectangle((spx - 0.5, ground_y - 0.4), 1.0, 0.4,
                     fc=BRAND["concrete"], ec=BRAND["dark"], lw=0.5))
        # Post base
        ax.add_patch(patches.Rectangle((spx - 0.35, ground_y), 0.7, 0.2,
                     fc='#888', ec=BRAND["dark"], lw=0.4))
        # Post
        ax.plot([spx, spx], [ground_y + 0.2, zt], color=BRAND["post"], lw=2)

    # Beam
    if beam_type == "flush":
        ax.plot([zx + 0.5, zx + zw - 0.5], [zt - beam_h, zt - beam_h],
                color=BRAND["beam"], lw=1.5, linestyle=(0, (8, 4)), zorder=4)
    else:
        ax.add_patch(patches.Rectangle((zx + 0.5, zt - beam_h - 0.1), zw - 1, beam_h,
                     fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))

    # Joists (visible ends)
    joist_sp = joist_spacing / 12
    for jx in np.arange(0, zw, joist_sp):
        ax.add_patch(patches.Rectangle((zx + jx - 0.04, zt - 0.8), 0.08, 0.68,
                     fc=BRAND["wood"], ec=BRAND["dark"], lw=0.15))

    # Deck surface
    ax.plot([zx, zx + zw], [zt, zt], color='#6B5340', lw=2.5)

    # Railing: top rail, bottom rail, posts, balusters
    ax.plot([zx, zx + zw], [rail_top, rail_top], color=BRAND["rail"], lw=2)
    ax.plot([zx, zx + zw], [zt + 0.25, zt + 0.25], color=BRAND["rail"], lw=0.8)
    for rpx in np.arange(0, zw + 0.1, 4):
        ax.plot([zx + rpx, zx + rpx], [zt, rail_top], color=BRAND["rail"], lw=1)
    for bx in np.arange(0, zw, 3.75 / 12):
        ax.plot([zx + bx, zx + bx], [zt + 0.25, rail_top],
                color=BRAND["rail"], lw=0.12, alpha=0.5)


def _draw_zone_section_north(ax, deck_x, section, total_w, ground_y, beam_h, beam_type, rail_h, joist_spacing=16):
    """
    Draw one zone wing section in the North elevation view (mirrored X).
    """
    # Mirror: north view flips left/right
    mirror_x = total_w - (section["x_draw"] + section["w"])
    zx = deck_x + mirror_x
    zw = section["w"]
    zt = section["deck_top"]
    rail_top = zt + rail_h

    # Posts: guard against narrow zones (<3 ft) where edge offsets would overlap
    post_offsets = [zw / 2] if zw < 3 else [1.5, zw - 1.5]
    for px_off in post_offsets:
        spx = zx + px_off
        ax.plot([spx, spx], [ground_y, zt],
                color=BRAND["post"], lw=1.0, ls=(0, (6, 3)), alpha=0.4)

    # Beam (far side, lighter)
    if beam_type == "flush":
        ax.plot([zx + 0.5, zx + zw - 0.5], [zt - beam_h, zt - beam_h],
                color=BRAND["beam"], lw=1.0, ls=(0, (6, 3)), alpha=0.5)
    else:
        ax.add_patch(patches.Rectangle((zx + 0.5, zt - beam_h - 0.1), zw - 1, beam_h,
                     fc=BRAND["beam"], ec=BRAND["dark"], lw=0.5, alpha=0.3))

    # Deck surface
    ax.plot([zx, zx + zw], [zt, zt], color='#6B5340', lw=2.5)

    # Railing (far side, lighter)
    ax.plot([zx, zx + zw], [rail_top, rail_top],
            color=BRAND["rail"], lw=1.5, alpha=0.5)
    ax.plot([zx, zx + zw], [zt + 0.25, zt + 0.25],
            color=BRAND["rail"], lw=0.6, alpha=0.5)
    for bx in np.arange(0, zw, 3.75 / 12):
        ax.plot([zx + bx, zx + bx], [zt + 0.25, rail_top],
                color=BRAND["rail"], lw=0.08, alpha=0.3)


# ============================================================
# STAIR VIEW HELPER
# ============================================================
def stair_view_type(exit_side, view_direction):
    MATRIX = {
        ("front", "south"): ("treads", None),
        ("right", "south"): ("profile", 1),
        ("left",  "south"): ("profile", -1),
        ("back",  "south"): ("hidden", None),

        ("front", "north"): ("hidden", None),
        ("right", "north"): ("profile", -1),
        ("left",  "north"): ("profile", 1),
        ("back",  "north"): ("treads", None),

        ("front", "east"):  ("profile", 1),
        ("right", "east"):  ("treads", None),
        ("left",  "east"):  ("hidden", None),
        ("back",  "east"):  ("profile", -1),

        ("front", "west"):  ("profile", -1),
        ("right", "west"):  ("hidden", None),
        ("left",  "west"):  ("treads", None),
        ("back",  "west"):  ("profile", 1),
    }
    return MATRIX.get((exit_side, view_direction), ("hidden", None))


# ============================================================
# REUSABLE STAIR DRAWING PRIMITIVES
# ============================================================
def _draw_stair_treads(ax, cx, ground_y, deck_top, stair, rail_h_ft):
    sw = stair.get("width", 4)
    rise_per = stair["actual_rise"] / 12
    n_risers = stair["num_risers"]
    sx = cx - sw / 2

    ax.add_patch(patches.Rectangle((sx, ground_y), sw, deck_top - ground_y,
                 fc='white', ec='none', zorder=5))

    for i in range(n_risers + 1):
        ty = deck_top - i * rise_per
        ax.plot([sx, sx + sw], [ty, ty], color=BRAND["dark"], lw=0.8, zorder=6)

    ax.plot([sx, sx], [ground_y, deck_top], color=BRAND["dark"], lw=1.0, zorder=6)
    ax.plot([sx + sw, sx + sw], [ground_y, deck_top], color=BRAND["dark"], lw=1.0, zorder=6)
    ax.plot([sx, sx + sw], [ground_y, ground_y], color=BRAND["dark"], lw=0.8, zorder=6)

    ax.plot([sx, sx], [ground_y + rail_h_ft, deck_top + rail_h_ft],
            color=BRAND["rail"], lw=0.8, zorder=6)
    ax.plot([sx + sw, sx + sw], [ground_y + rail_h_ft, deck_top + rail_h_ft],
            color=BRAND["rail"], lw=0.8, zorder=6)
    ax.plot([sx, sx + sw], [deck_top + rail_h_ft, deck_top + rail_h_ft],
            color=BRAND["rail"], lw=1.0, zorder=6)

    ax.add_patch(patches.Rectangle((sx - 0.2, ground_y - 0.12), sw + 0.4, 0.12,
                 fc='#e0ddd8', ec=BRAND["dark"], lw=0.4, zorder=6))

    return sx, sx + sw


def _draw_stair_profile(ax, sx, ground_y, deck_top, stair, rail_h_ft, direction):
    rise = stair["actual_rise"] / 12
    run = stair["tread_depth"] / 12
    n_treads = stair["num_treads"]

    for i in range(n_treads):
        tx = sx + direction * i * run
        ty = deck_top - i * rise
        ax.plot([tx, tx + direction * run], [ty, ty], color=BRAND["dark"], lw=0.6, zorder=6)
        nty = deck_top - (i + 1) * rise
        ax.plot([tx + direction * run, tx + direction * run], [ty, nty],
                color=BRAND["dark"], lw=0.6, zorder=6)

    end_x = sx + direction * n_treads * run
    ax.plot([end_x - direction * run, end_x], [ground_y, ground_y],
            color=BRAND["dark"], lw=0.6, zorder=6)

    ax.plot([sx, end_x], [deck_top, ground_y], color=BRAND["dark"], lw=0.8, zorder=6)

    hr_top = deck_top + rail_h_ft
    ax.plot([sx, end_x], [hr_top, ground_y + rail_h_ft],
            color=BRAND["dark"], lw=0.4, ls='--', zorder=6)

    ax.add_patch(patches.Rectangle((end_x - 0.5, ground_y - 0.12), 1.0, 0.12,
                 fc='#e0ddd8', ec=BRAND["dark"], lw=0.4, zorder=6))


# S68: MULTI-RUN STAIR ELEVATION HELPERS
# ============================================================
def _draw_multi_run_profile(ax, sx, ground_y, deck_top, sg, rail_h_ft, direction):
    """Draw a multi-run stair profile for elevation views.

    Shows each run descending with landing platforms between runs.
    sx: starting X position (deck edge)
    direction: +1 or -1 for left/right profile direction
    sg: geometry dict from compute_stair_geometry
    """
    rise_in = sg["riseIn"]
    rise_per = rise_in / 12  # feet per riser
    tread_run = 10.5 / 12    # feet per tread
    runs = sg["runs"]
    landings = sg["landings"]

    # Compute elevation of each landing
    # Each run descends by (risers * rise_per) from its starting elevation
    # Run 0 starts at deck_top, subsequent runs start at previous landing elevation
    run_elevations = []  # (start_y, end_y) for each run
    current_elev = deck_top
    for run in runs:
        descent = run["risers"] * rise_per
        run_elevations.append((current_elev, current_elev - descent))
        current_elev = current_elev - descent

    # Draw profile for each run sequentially along the horizontal axis
    cursor_x = sx
    for ri, run in enumerate(runs):
        start_y, end_y = run_elevations[ri]
        n_treads = run["treads"]

        # Draw treads (step pattern)
        for i in range(n_treads):
            tx = cursor_x + direction * i * tread_run
            ty = start_y - i * rise_per
            # Horizontal tread
            ax.plot([tx, tx + direction * tread_run], [ty, ty],
                    color=BRAND["dark"], lw=0.6, zorder=6)
            # Vertical riser
            nty = start_y - (i + 1) * rise_per
            ax.plot([tx + direction * tread_run, tx + direction * tread_run],
                    [ty, nty], color=BRAND["dark"], lw=0.6, zorder=6)

        run_end_x = cursor_x + direction * n_treads * tread_run

        # Stringer line (diagonal)
        ax.plot([cursor_x, run_end_x], [start_y, end_y],
                color=BRAND["dark"], lw=0.8, zorder=6)

        # Railing line (dashed, parallel to stringer)
        ax.plot([cursor_x, run_end_x],
                [start_y + rail_h_ft, end_y + rail_h_ft],
                color=BRAND["dark"], lw=0.4, ls='--', zorder=6)

        # If there's a landing after this run, draw it and advance cursor
        if ri < len(landings):
            landing = landings[ri]
            lr = landing["rect"]
            # Landing horizontal extent in profile direction
            # Use the landing depth as the horizontal extent
            land_extent = lr["h"] if runs[ri]["treadAxis"] == "h" else lr["w"]
            land_x1 = run_end_x
            land_x2 = run_end_x + direction * land_extent

            # Landing platform (thick line at landing elevation)
            ax.plot([land_x1, land_x2], [end_y, end_y],
                    color=BRAND["dark"], lw=1.5, zorder=6)
            # Landing railing
            ax.plot([land_x1, land_x2], [end_y + rail_h_ft, end_y + rail_h_ft],
                    color=BRAND["dark"], lw=0.4, ls='--', zorder=6)
            # Landing posts (at edges)
            ax.plot([land_x1, land_x1], [end_y, end_y + rail_h_ft],
                    color=BRAND["rail"], lw=0.8, zorder=6)
            ax.plot([land_x2, land_x2], [end_y, end_y + rail_h_ft],
                    color=BRAND["rail"], lw=0.8, zorder=6)
            # Landing label
            mid_lx = (land_x1 + land_x2) / 2
            ax.text(mid_lx, end_y + 0.15, 'LNDG', ha='center', va='bottom',
                    fontsize=2.5, color=BRAND["mute"], zorder=7)

            cursor_x = land_x2
        else:
            cursor_x = run_end_x

    # Concrete pad at bottom of last run
    last_end_x = cursor_x
    ax.add_patch(patches.Rectangle(
        (min(sx, last_end_x) - 0.3, ground_y - 0.12),
        abs(last_end_x - sx) + 0.6, 0.12,
        fc='#e0ddd8', ec=BRAND["dark"], lw=0.4, zorder=6))


def _draw_multi_run_treads(ax, cx, ground_y, deck_top, sg, rail_h_ft):
    """Draw multi-run stair treads for elevation face-on views.

    For switchback/wrap: shows parallel runs side by side.
    For L-shapes: shows only the visible run (run 1).
    cx: center X position in elevation coords
    sg: geometry dict from compute_stair_geometry
    """
    rise_in = sg["riseIn"]
    rise_per = rise_in / 12
    runs = sg["runs"]
    template = sg["template"]
    sw = sg["stairWidth"]

    # Determine which runs are visible face-on (treadAxis == "h" for front exit)
    # For treads view, runs with treadAxis == "h" are visible
    visible_runs = [(ri, r) for ri, r in enumerate(runs) if r["treadAxis"] == "h"]
    if not visible_runs:
        visible_runs = [(0, runs[0])]  # fallback to first run

    # Compute elevation of each run
    current_elev = deck_top
    run_tops = {}
    for ri, run in enumerate(runs):
        run_tops[ri] = current_elev
        current_elev -= run["risers"] * rise_per

    # Draw each visible run
    for ri, run in visible_runs:
        # X position from the geometry rect
        rect = run["rect"]
        rx_offset = rect["x"] + rect["w"] / 2  # center of run in stair-local coords
        run_cx = cx + rx_offset  # offset from stair center

        run_top = run_tops[ri]
        n_risers = run["risers"]
        run_bottom = run_top - n_risers * rise_per

        # White background
        sx = run_cx - sw / 2
        ax.add_patch(patches.Rectangle((sx, run_bottom), sw, run_top - run_bottom,
                     fc='white', ec='none', zorder=5))

        # Tread lines
        for i in range(n_risers + 1):
            ty = run_top - i * rise_per
            ax.plot([sx, sx + sw], [ty, ty], color=BRAND["dark"], lw=0.8, zorder=6)

        # Side lines
        ax.plot([sx, sx], [run_bottom, run_top], color=BRAND["dark"], lw=1.0, zorder=6)
        ax.plot([sx + sw, sx + sw], [run_bottom, run_top], color=BRAND["dark"], lw=1.0, zorder=6)
        ax.plot([sx, sx + sw], [run_bottom, run_bottom], color=BRAND["dark"], lw=0.8, zorder=6)

        # Stair railing
        ax.plot([sx, sx], [run_bottom + rail_h_ft, run_top + rail_h_ft],
                color=BRAND["rail"], lw=0.8, zorder=6)
        ax.plot([sx + sw, sx + sw], [run_bottom + rail_h_ft, run_top + rail_h_ft],
                color=BRAND["rail"], lw=0.8, zorder=6)
        ax.plot([sx, sx + sw], [run_top + rail_h_ft, run_top + rail_h_ft],
                color=BRAND["rail"], lw=1.0, zorder=6)

    # Draw landing platforms
    for li, landing in enumerate(sg.get("landings", [])):
        lr = landing["rect"]
        land_cx = cx + lr["x"] + lr["w"] / 2
        land_w = lr["w"]
        # Landing elevation = run_top of the run AFTER the landing
        # Landing is between run li and run li+1
        if li + 1 < len(runs):
            land_elev = run_tops[li + 1]
        else:
            land_elev = ground_y
        # Draw landing platform line
        lsx = land_cx - land_w / 2
        ax.plot([lsx, lsx + land_w], [land_elev, land_elev],
                color=BRAND["dark"], lw=1.5, zorder=6)
        # Landing railing posts
        ax.plot([lsx, lsx], [land_elev, land_elev + rail_h_ft],
                color=BRAND["rail"], lw=0.6, zorder=6)
        ax.plot([lsx + land_w, lsx + land_w], [land_elev, land_elev + rail_h_ft],
                color=BRAND["rail"], lw=0.6, zorder=6)

    # Concrete pad at ground
    all_x_min = min(cx + r["rect"]["x"] for _, r in visible_runs)
    all_x_max = max(cx + r["rect"]["x"] + r["rect"]["w"] for _, r in visible_runs)
    ax.add_patch(patches.Rectangle(
        (all_x_min - 0.2, ground_y - 0.12),
        (all_x_max - all_x_min) + 0.4, 0.12,
        fc='#e0ddd8', ec=BRAND["dark"], lw=0.4, zorder=6))


# ============================================================
# S35: UNDERGROUND FOOTING HELPER
# ============================================================
def _draw_underground_footing(ax, post_x, ground_at_post, footing_diam_in, footing_depth_in):
    """Draw dotted underground pier/footing below grade.
    footing_diam_in and footing_depth_in are in inches."""
    fd_ft = footing_depth_in / 12  # depth in feet
    fr = footing_diam_in / 12 / 2  # radius in feet
    pier_bottom = ground_at_post - fd_ft

    # Dotted vertical pier shaft
    ax.plot([post_x - fr * 0.6, post_x - fr * 0.6],
            [ground_at_post - 0.4, pier_bottom],
            color=BRAND["mute"], lw=0.4, ls=(0, (3, 2)), zorder=0)
    ax.plot([post_x + fr * 0.6, post_x + fr * 0.6],
            [ground_at_post - 0.4, pier_bottom],
            color=BRAND["mute"], lw=0.4, ls=(0, (3, 2)), zorder=0)

    # Dotted bottom of footing
    ax.plot([post_x - fr, post_x + fr],
            [pier_bottom, pier_bottom],
            color=BRAND["mute"], lw=0.5, ls=(0, (3, 2)), zorder=0)

    # Small depth label
    ax.text(post_x + fr + 0.3, (ground_at_post - 0.4 + pier_bottom) / 2,
            f'{footing_depth_in}"',
            fontsize=2.8, color=BRAND["mute"], fontfamily='monospace',
            va='center', ha='left')


# ============================================================
# S35: GRAPHIC SCALE BAR HELPER
# ============================================================
def _draw_graphic_scale_bar(ax, x_center, y, scale_label="1/4\" = 1'-0\""):
    """Draw a graphic scale bar for elevation views.
    Standard bar: 0-4-8-12 feet at 1/4" = 1'-0" scale."""
    bar_len_ft = 12  # total bar length in drawing feet
    seg = 4  # segment length in feet
    n_segs = bar_len_ft // seg
    bar_start = x_center - bar_len_ft / 2
    bar_h = 0.2

    for i in range(n_segs):
        sx = bar_start + i * seg
        fill = '#333' if i % 2 == 0 else 'white'
        ax.add_patch(patches.Rectangle((sx, y), seg, bar_h,
                     fc=fill, ec='#333', lw=0.3))

    # Tick labels
    for i in range(n_segs + 1):
        tx = bar_start + i * seg
        ax.plot([tx, tx], [y - 0.15, y + bar_h + 0.15], color='#333', lw=0.3)
        ax.text(tx, y - 0.4, str(i * seg) + "'",
                fontsize=2.8, ha='center', va='top', fontfamily='monospace', color='#333')

    # Scale label
    ax.text(x_center, y - 0.9, scale_label,
            fontsize=3, ha='center', va='top', fontfamily='monospace', color=BRAND["mute"])


# ============================================================
# SHARED DRAWING HELPERS
# ============================================================
def draw_grade_line(ax, x1, x2, y, slope_rise=0, slope_pct=None, house_bounds=None):
    """Draw grade line with earth fill below and APPROX label.
    slope_rise = total vertical change from x1 to x2 (positive = x2 higher).
    house_bounds = (hx1, hx2) to skip grade through house footprint."""
    y1 = y - slope_rise / 2
    y2 = y + slope_rise / 2

    # S35: Helper to compute grade Y at any X position
    def _gy(gx):
        return y1 + (y2 - y1) * (gx - x1) / max(x2 - x1, 0.01)

    # S35: Build segment list (skip house zone if provided)
    if house_bounds and house_bounds[0] < house_bounds[1]:
        hx1, hx2 = house_bounds
        _segments = []
        if x1 < hx1:
            _segments.append((x1, hx1))
        if hx2 < x2:
            _segments.append((hx2, x2))
    else:
        _segments = [(x1, x2)]

    # S34: Earth fill below grade (cross-hatch, matches frontend earthH1/earthH2)
    _fill_btm = min(y1, y2) - 1.5
    for _sx, _ex in _segments:
        _sy, _ey = _gy(_sx), _gy(_ex)
        _earth = [(_sx, _sy), (_ex, _ey), (_ex, _fill_btm), (_sx, _fill_btm)]
        ax.add_patch(Polygon(_earth, closed=True, fc='#f0ece4', ec='none', zorder=0))
        ax.add_patch(Polygon(_earth, closed=True, fc='none', ec='#999999',
                             hatch='////', lw=0.1, alpha=0.2, zorder=0))

    # Grade line (per segment)
    for _sx, _ex in _segments:
        ax.plot([_sx, _ex], [_gy(_sx), _gy(_ex)], color=BRAND["dark"], lw=1)

    # Tick marks below grade (skip house zone)
    n_hatch = int((x2 - x1) / 0.3)
    for j in range(n_hatch + 1):
        t = j / max(n_hatch, 1)
        hx = x1 + t * (x2 - x1)
        if house_bounds and house_bounds[0] <= hx <= house_bounds[1]:
            continue
        hy = _gy(hx)
        ax.plot([hx, hx - 0.2], [hy, hy - 0.2], color=BRAND["mute"], lw=0.2)

    # S34: APPROX label with actual slope percentage
    _actual_pct = slope_pct if slope_pct is not None else (abs(slope_rise) / max(x2 - x1, 0.01) * 100)
    if _actual_pct > 0.01:
        ax.text(x2 + 0.5, y + slope_rise / 2 + 0.3, f'APPROX. {_actual_pct:.1f}% GRADE',
                fontsize=3.5, fontfamily='monospace', color=BRAND["mute"])
    else:
        ax.text(x2 + 0.5, y + 0.3, 'APPROX. GRADE',
                fontsize=3.5, fontfamily='monospace', color=BRAND["mute"],
                fontstyle='italic')


def _draw_house_front(ax, house_x, house_w, ground_y, height, grade_drop=0):
    if height < 8:
        foundation_h = height + 1
        floor1_h = 8.5
        floor2_h = 0
    else:
        foundation_h = height + 1
        floor1_h = 8.5
        floor2_h = 8

    total_wall = foundation_h + floor1_h + floor2_h
    roof_peak = 5.5

    ax.add_patch(patches.Rectangle((house_x, ground_y), house_w, foundation_h,
                 fc=BRAND["concrete"], ec=BRAND["dark"], lw=1))

    f1_y = ground_y + foundation_h
    ax.add_patch(patches.Rectangle((house_x, f1_y), house_w, floor1_h,
                 fc=BRAND["house"], ec=BRAND["dark"], lw=1))
    for sy in np.arange(f1_y + 0.4, f1_y + floor1_h, 0.5):
        ax.plot([house_x, house_x + house_w], [sy, sy], color=BRAND["light"], lw=0.15)

    if floor2_h > 0:
        f2_y = f1_y + floor1_h
        ax.add_patch(patches.Rectangle((house_x, f2_y), house_w, floor2_h,
                     fc=BRAND["house"], ec=BRAND["dark"], lw=1))
        for sy in np.arange(f2_y + 0.4, f2_y + floor2_h, 0.5):
            ax.plot([house_x, house_x + house_w], [sy, sy], color=BRAND["light"], lw=0.15)

    win_kw = dict(fc='#b0d4e8', ec=BRAND["dark"], lw=0.6)
    ax.add_patch(patches.Rectangle((house_x + house_w * 0.1, f1_y + 1.5),
                 house_w * 0.15, 4, **win_kw))
    ax.add_patch(patches.Rectangle((house_x + house_w * 0.45, f1_y + 2),
                 house_w * 0.1, 3, **win_kw))
    ax.add_patch(patches.Rectangle((house_x + house_w * 0.75, f1_y + 2),
                 house_w * 0.08, 2.5, **win_kw))
    if floor2_h > 0:
        f2_y = f1_y + floor1_h
        ax.add_patch(patches.Rectangle((house_x + house_w * 0.15, f2_y + 1.5),
                     house_w * 0.12, 3.5, **win_kw))
        ax.add_patch(patches.Rectangle((house_x + house_w * 0.6, f2_y + 1.5),
                     house_w * 0.1, 3, **win_kw))

    roof_base = ground_y + total_wall
    overhang = 1.5
    verts = [(house_x - overhang, roof_base),
             (house_x + house_w / 2, roof_base + roof_peak),
             (house_x + house_w + overhang, roof_base)]
    ax.add_patch(Polygon(verts, fc='#888', ec=BRAND["dark"], lw=1.5))

    ax.text(house_x + house_w / 2, roof_base + 1.5, 'EXISTING HOUSE',
            ha='center', fontsize=4.5, color=BRAND["mute"])

    # S34: Foundation wall extension below grade for sloped sites
    if grade_drop > 0:
        ax.add_patch(patches.Rectangle((house_x, ground_y - grade_drop), house_w, grade_drop,
                     fc=BRAND["concrete"], ec=BRAND["dark"], lw=1, zorder=1))
        for _fy in np.arange(ground_y - grade_drop + 0.5, ground_y, 0.5):
            ax.plot([house_x, house_x + house_w], [_fy, _fy],
                    color='#aaaaaa', lw=0.2, zorder=1)

    return total_wall, roof_peak


def _draw_house_side(ax, house_x, house_d, ground_y, height, grade_drop=0):
    if height < 8:
        house_h = height + 1 + 8.5
    else:
        house_h = height + 1 + 8.5 + 8

    roof_peak = 5.5

    ax.add_patch(patches.Rectangle((house_x, ground_y), house_d, house_h,
                 fc=BRAND["house"], ec=BRAND["dark"], lw=1))
    for sy in np.arange(ground_y + height + 1.5, ground_y + house_h, 0.5):
        ax.plot([house_x, house_x + house_d], [sy, sy], color=BRAND["light"], lw=0.15)

    roof_base = ground_y + house_h
    verts = [(house_x - 1.5, roof_base),
             (house_x + house_d / 2, roof_base + roof_peak),
             (house_x + house_d + 1.5, roof_base)]
    ax.add_patch(Polygon(verts, fc='#888', ec=BRAND["dark"], lw=1.5))
    ax.text(house_x + house_d / 2, roof_base + 1.5, 'EXISTING HOUSE',
            ha='center', fontsize=4.5, color=BRAND["mute"])

    # S34: Foundation wall extension below grade for sloped sites
    if grade_drop > 0:
        ax.add_patch(patches.Rectangle((house_x, ground_y - grade_drop), house_d, grade_drop,
                     fc=BRAND["concrete"], ec=BRAND["dark"], lw=1, zorder=1))
        for _fy in np.arange(ground_y - grade_drop + 0.5, ground_y, 0.5):
            ax.plot([house_x, house_x + house_d], [_fy, _fy],
                    color='#aaaaaa', lw=0.2, zorder=1)

    return house_h, roof_peak


# ============================================================
# S35: SIMPSON HARDWARE CALLOUT HELPER
# ============================================================
def _draw_hardware_callout(ax, x, y, label, leader_dx=2.5, leader_dy=-0.8, fontsize=3.0):
    """Draw a Simpson hardware callout with leader line."""
    tx = x + leader_dx
    ty = y + leader_dy
    # Leader line
    ax.plot([x, tx], [y, ty], color='#555', lw=0.3)
    # Dot at connection point
    ax.plot(x, y, 'o', color='#555', markersize=1.5, zorder=5)
    # Label
    ax.text(tx + 0.15, ty, label,
            fontsize=fontsize, fontfamily='monospace', color='#555',
            va='center', ha='left',
            bbox=dict(boxstyle='round,pad=0.1', fc='white', ec='#999', lw=0.3, alpha=0.85))


# ============================================================
# SOUTH ELEVATION (front - observer looks north at deck front)
# S24: Zone-aware - left/right zones extend visible width
# S35: Underground footings, hardware callouts, scale bar
# ============================================================
def draw_south_elevation(ax, params, calc, compact=False, spec=None):
    W = calc["width"]
    D = calc["depth"]
    H = calc["height"]
    ground_y = 0
    deck_x = 0.5  # overall left margin

    # Zone context
    zone_ctx = _get_zone_south_north_sections(params, calc)
    x_off = zone_ctx["x_off"]
    total_w = zone_ctx["bb_w"]
    z0_x = deck_x + x_off  # zone-0 drawing origin

    fs_lbl = 3.5 if compact else 4.5
    fs_dim = 4.5 if compact else 6
    fs_title = 4 if compact else 5.5

    # S33: Compute grade slope for this view (moved before house for S34 grade_drop)
    _slope_pct = params.get("slopePercent", 0) / 100
    _slope_dir = params.get("slopeDirection", "front-to-back")
    _grade_rise = 0
    if _slope_dir == "left-to-right":
        _grade_rise = _slope_pct * total_w
    elif _slope_dir == "right-to-left":
        _grade_rise = -_slope_pct * total_w

    # House behind (centered on zone-0)
    house_x = z0_x + (W - min(W, 30)) / 2
    house_w = min(W, 30)
    # S34: Foundation extends to lowest grade at house edges
    _glx1, _glx2 = -3.0, deck_x + total_w + 5.0
    _gly1, _gly2 = ground_y - _grade_rise / 2, ground_y + _grade_rise / 2
    _ghl = _gly1 + (_gly2 - _gly1) * (house_x - _glx1) / max(_glx2 - _glx1, 0.01)
    _ghr = _gly1 + (_gly2 - _gly1) * (house_x + house_w - _glx1) / max(_glx2 - _glx1, 0.01)
    _gdrop = max(0, ground_y - min(_ghl, _ghr))
    total_wall, roof_peak = _draw_house_front(ax, house_x, house_w, ground_y, H, grade_drop=_gdrop)

    draw_grade_line(ax, -3, deck_x + total_w + 5, ground_y, slope_rise=_grade_rise, slope_pct=params.get("slopePercent", 0), house_bounds=(house_x, house_x + house_w))

    deck_top = H
    footing_diam = calc.get("footing_diam", calc.get("fDiam", 24))
    footing_depth = calc.get("footing_depth", calc.get("fDepth", 42))

    # === ZONE-0 POSTS (S34: variable heights, S35: underground footings) ===
    _post_heights = calc.get("post_heights", [])
    _hw_callout_done = False
    for _pi, px in enumerate(calc["post_positions"]):
        sx = z0_x + px
        _ph = _post_heights[_pi] if _pi < len(_post_heights) else H
        _ground_at_post = deck_top - _ph  # ground level at this post
        ax.add_patch(patches.Rectangle((sx - 0.5, _ground_at_post - 0.4), 1.0, 0.4,
                     fc=BRAND["concrete"], ec=BRAND["dark"], lw=0.5))
        ax.add_patch(patches.Rectangle((sx - 0.35, _ground_at_post), 0.7, 0.2,
                     fc='#888', ec=BRAND["dark"], lw=0.4))
        ax.plot([sx, sx], [_ground_at_post + 0.2, deck_top], color=BRAND["post"], lw=2)

        # S35: Underground footing (dotted)
        _draw_underground_footing(ax, sx, _ground_at_post, footing_diam, footing_depth)

        # S35: Hardware callout on first post only
        if not _hw_callout_done and not compact:
            _draw_hardware_callout(ax, sx, _ground_at_post + 0.1,
                                   spec["hardware"]["post_base"]["model"] if spec else 'ABU66Z',
                                   leader_dx=-2.5, leader_dy=-0.5)
            _hw_callout_done = True

    # === ZONE-0 BEAM ===
    beam_h = _beam_h_from_calc(calc)
    beam_type = calc.get("beam_type", "dropped")
    if beam_type == "flush":
        ax.plot([z0_x + 1, z0_x + W - 1], [deck_top - beam_h, deck_top - beam_h],
                color=BRAND["beam"], lw=1.5, linestyle=(0, (8, 4)), zorder=4)
        for px in calc["post_positions"]:
            sx = z0_x + px
            ax.plot([sx, sx], [ground_y + 0.2, deck_top - beam_h], color=BRAND["post"], lw=2)
    else:
        ax.add_patch(patches.Rectangle((z0_x + 1, deck_top - beam_h - 0.1), W - 2, beam_h,
                     fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))

    # S35: Beam-to-joist hardware callout
    if not compact:
        _bm_cx = z0_x + W * 0.3
        if beam_type == "dropped":
            _draw_hardware_callout(ax, _bm_cx, deck_top - beam_h, 'H2.5A (TYP)',
                                   leader_dx=3, leader_dy=0.6)
        else:
            _draw_hardware_callout(ax, _bm_cx, deck_top - beam_h * 0.5, 'LUS210 (TYP)',
                                   leader_dx=3, leader_dy=0.4)

    # === ZONE-0 JOISTS ===
    joist_sp = calc["joist_spacing"] / 12
    for jx in np.arange(0, W, joist_sp):
        ax.add_patch(patches.Rectangle((z0_x + jx - 0.04, deck_top - 0.8), 0.08, 0.68,
                     fc=BRAND["wood"], ec=BRAND["dark"], lw=0.15))

    # === ZONE-0 DECK SURFACE ===
    ax.plot([z0_x, z0_x + W], [deck_top, deck_top], color='#6B5340', lw=2.5)

    # === ZONE-0 RAILING ===
    rail_h = calc["rail_height"] / 12
    rail_top = deck_top + rail_h

    # S66: Chamfer insets for front edge (south view sees FL/FR)
    _mc = params.get("mainCorners")
    _fl_s = 0
    _fr_s = 0
    if _mc:
        _fl = _mc.get("FL", {})
        _fr = _mc.get("FR", {})
        if _fl.get("type") == "chamfer" and _fl.get("size", 0) > 0:
            _fl_s = _fl["size"]
        if _fr.get("type") == "chamfer" and _fr.get("size", 0) > 0:
            _fr_s = _fr["size"]

    # Front railing bounds (chamfer-aware)
    _rail_left = z0_x + _fl_s
    _rail_right = z0_x + W - _fr_s

    # S65: Resolve all stairs for multi-stair rendering
    all_stairs = resolve_all_stairs(params, calc)

    # Build railing gaps for zone-0 front-facing stairs
    _z0_gaps = []
    for rs in all_stairs:
        if rs["stair"]["zoneId"] == 0:
            _svt, _sdir = stair_view_type(rs["exit_side"], "south")
            if _svt == "treads":
                _sg = rs.get("geometry")
                _cx = z0_x + rs["world_anchor_x"]
                if _sg and _sg["runs"]:
                    # S68: Use first run rect for accurate gap position
                    _r0 = _sg["runs"][0]["rect"]
                    _z0_gaps.append((_cx + _r0["x"], _cx + _r0["x"] + _r0["w"]))
                else:
                    _sw = rs["stair_info"].get("width", 4)
                    _z0_gaps.append((_cx - _sw / 2, _cx + _sw / 2))
    _z0_gaps.sort()

    # Draw zone-0 railing with gaps (S66: chamfer-aware bounds)
    def _draw_rail_with_gaps(y_pos, lw_val):
        if not _z0_gaps:
            ax.plot([_rail_left, _rail_right], [y_pos, y_pos], color=BRAND["rail"], lw=lw_val)
            return
        cursor = _rail_left
        for gl, gr in _z0_gaps:
            if cursor < gl:
                ax.plot([cursor, gl], [y_pos, y_pos], color=BRAND["rail"], lw=lw_val)
            cursor = gr
        if cursor < _rail_right:
            ax.plot([cursor, _rail_right], [y_pos, y_pos], color=BRAND["rail"], lw=lw_val)

    _draw_rail_with_gaps(rail_top, 2)
    _draw_rail_with_gaps(deck_top + 0.25, 0.8)

    # S66: Vertical railing at chamfer boundary (corner posts)
    if _fl_s > 0:
        ax.plot([_rail_left, _rail_left], [deck_top, rail_top], color=BRAND["rail"], lw=1.5)
    if _fr_s > 0:
        ax.plot([_rail_right, _rail_right], [deck_top, rail_top], color=BRAND["rail"], lw=1.5)

    def _in_any_gap(x_val):
        for gl, gr in _z0_gaps:
            if gl < x_val < gr:
                return True
        return False

    for rpx in np.arange(_fl_s, W - _fr_s + 0.1, 4):
        px_abs = z0_x + rpx
        if _in_any_gap(px_abs):
            continue
        ax.plot([px_abs, px_abs], [deck_top, rail_top], color=BRAND["rail"], lw=1)

    for bx in np.arange(_fl_s, W - _fr_s, 3.75 / 12):
        bx_abs = z0_x + bx
        if _in_any_gap(bx_abs):
            continue
        ax.plot([bx_abs, bx_abs], [deck_top + 0.25, rail_top],
                color=BRAND["rail"], lw=0.12, alpha=0.5)

    # === ALL STAIRS (south elevation) === S68: multi-run geometry aware
    for rs in all_stairs:
        _svt, _sdir = stair_view_type(rs["exit_side"], "south")
        _draw_x = z0_x + rs["world_anchor_x"]
        _sg = rs.get("geometry")
        if _sg and _sg["template"] != "straight":
            if _svt == "treads":
                _draw_multi_run_treads(ax, _draw_x, ground_y, deck_top, _sg, rail_h)
            elif _svt == "profile":
                _draw_multi_run_profile(ax, _draw_x, ground_y, deck_top, _sg, rail_h, _sdir)
        else:
            if _svt == "treads":
                _draw_stair_treads(ax, _draw_x, ground_y, deck_top, rs["stair_info"], rail_h)
            elif _svt == "profile":
                _draw_stair_profile(ax, _draw_x, ground_y, deck_top, rs["stair_info"], rail_h, _sdir)

    # === ZONE WING SECTIONS ===
    for sec in zone_ctx["sections"]:
        _draw_zone_section_south(ax, deck_x, sec, ground_y, beam_h, beam_type, rail_h, calc["joist_spacing"])

    # === LABELS (positioned at right edge of bounding box) ===
    lbl_x = deck_x + total_w + 1.5
    lbl_kw = dict(fontsize=fs_lbl, fontfamily='monospace', color=BRAND["dark"])

    ax.text(lbl_x, rail_top - 0.3,
            spec["labels"]["guardrail"] if spec else f'{calc["rail_height"]}" GUARD RAIL', **lbl_kw)
    _beam_lbl = spec["labels"]["beam"] if spec else f'{calc["beam_size"].upper()} {"DROPPED" if beam_type != "flush" else "FLUSH"} BEAM'
    ax.text(lbl_x, deck_top - beam_h / 2 - 0.5, _beam_lbl, **lbl_kw)
    _post_lbl = spec["labels"]["posts_and_hardware"] if spec else f'{calc["post_size"]} PT POSTS\n({calc["num_posts"]}) PLCS'
    ax.text(lbl_x, H * 0.4, _post_lbl, **lbl_kw)
    ax.text(lbl_x, -0.5,
            spec["labels"]["footings"] if spec else f'{calc["footing_diam"]}" DIA. PIERS', **lbl_kw)

    # === DIMENSIONS (span bounding box) ===
    draw_dimension_v(ax, deck_x - 1, ground_y, deck_top,
                     format_feet_inches(H), offset=-3.5, color=BRAND["blue"], fontsize=fs_dim)
    draw_dimension_v(ax, deck_x + total_w + 0.5, deck_top, rail_top,
                     f'{calc["rail_height"]}"', offset=7, color=BRAND["ledger_green"], fontsize=fs_dim - 1)

    # S35: Graphic scale bar
    _draw_graphic_scale_bar(ax, deck_x + total_w / 2, -3.2)

    return total_wall + roof_peak


# ============================================================
# NORTH ELEVATION (rear - observer looks south at house wall)
# S24: Zone-aware - left/right zones extend visible width (mirrored)
# S35: Variable post heights, underground footings, hardware callouts
# ============================================================
def draw_north_elevation(ax, params, calc, compact=False, spec=None):
    W = calc["width"]
    D = calc["depth"]
    H = calc["height"]
    attachment = calc["attachment"]
    ground_y = 0
    deck_x = 0.5

    # Zone context
    zone_ctx = _get_zone_south_north_sections(params, calc)
    x_off = zone_ctx["x_off"]
    total_w = zone_ctx["bb_w"]
    # North view mirrors: zone-0 origin is mirrored within bounding box
    z0_x = deck_x + (total_w - x_off - W)

    fs_lbl = 3.5 if compact else 4.5
    fs_dim = 4.5 if compact else 6

    # S33: Grade slope for north view (moved before house for S34 grade_drop)
    _slope_pct_n = params.get("slopePercent", 0) / 100
    _slope_dir_n = params.get("slopeDirection", "front-to-back")
    _grade_rise_n = 0
    if _slope_dir_n == "left-to-right":
        _grade_rise_n = -_slope_pct_n * total_w
    elif _slope_dir_n == "right-to-left":
        _grade_rise_n = _slope_pct_n * total_w

    # House (centered on zone-0, mirrored)
    house_x = z0_x + (W - min(W, 30)) / 2
    house_w = min(W, 30)
    # S34: Foundation extends to lowest grade at house edges
    _glx1n, _glx2n = -3.0, deck_x + total_w + 5.0
    _gly1n, _gly2n = ground_y - _grade_rise_n / 2, ground_y + _grade_rise_n / 2
    _ghln = _gly1n + (_gly2n - _gly1n) * (house_x - _glx1n) / max(_glx2n - _glx1n, 0.01)
    _ghrn = _gly1n + (_gly2n - _gly1n) * (house_x + house_w - _glx1n) / max(_glx2n - _glx1n, 0.01)
    _gdropn = max(0, ground_y - min(_ghln, _ghrn))
    total_wall, roof_peak = _draw_house_front(ax, house_x, house_w, ground_y, H, grade_drop=_gdropn)

    draw_grade_line(ax, -3, deck_x + total_w + 5, ground_y, slope_rise=_grade_rise_n, slope_pct=params.get("slopePercent", 0), house_bounds=(house_x, house_x + house_w))

    deck_top = H
    footing_diam = calc.get("footing_diam", calc.get("fDiam", 24))
    footing_depth = calc.get("footing_depth", calc.get("fDepth", 42))

    # === LEDGER ===
    if attachment == "ledger":
        ax.plot([z0_x, z0_x + W], [deck_top, deck_top], color=BRAND["ledger_green"], lw=3)
        ax.plot([z0_x, z0_x + W], [deck_top - 0.8, deck_top - 0.8],
                color=BRAND["ledger_green"], lw=1.5, alpha=0.6)
        ax.text(z0_x + W / 2, deck_top - 0.4, 'LEDGER BOARD',
                ha='center', fontsize=fs_lbl, color=BRAND["ledger_green"],
                fontfamily='monospace', fontweight='bold')

        # S35: Ledger hardware callout
        if not compact:
            _draw_hardware_callout(ax, z0_x + W * 0.2, deck_top, 'DTT2Z',
                                   leader_dx=-2, leader_dy=1)

    # === ZONE-0 DECK SURFACE ===
    ax.plot([z0_x, z0_x + W], [deck_top, deck_top], color='#6B5340', lw=2.5)

    # === ZONE-0 POSTS (S35: variable heights, mirrored, far side - dashed) ===
    _post_heights = calc.get("post_heights", [])
    for _pi, px in enumerate(calc["post_positions"]):
        sx = z0_x + (W - px)  # mirrored
        _ph = _post_heights[_pi] if _pi < len(_post_heights) else H
        _ground_at_post = deck_top - _ph
        ax.plot([sx, sx], [_ground_at_post, deck_top],
                color=BRAND["post"], lw=1.0, ls=(0, (6, 3)), alpha=0.4)
        # S35: Underground footing (dotted, lighter for far side)
        _draw_underground_footing(ax, sx, _ground_at_post, footing_diam, footing_depth)

    # === ZONE-0 BEAM (far side) ===
    beam_h = _beam_h_from_calc(calc)
    beam_type = calc.get("beam_type", "dropped")
    if beam_type == "flush":
        ax.plot([z0_x + 1, z0_x + W - 1], [deck_top - beam_h, deck_top - beam_h],
                color=BRAND["beam"], lw=1.0, ls=(0, (6, 3)), alpha=0.5)
    else:
        ax.add_patch(patches.Rectangle((z0_x + 1, deck_top - beam_h - 0.1), W - 2, beam_h,
                     fc=BRAND["beam"], ec=BRAND["dark"], lw=0.5, alpha=0.3))

    # === ZONE-0 RAILING (far side, lighter) ===
    rail_h = calc["rail_height"] / 12
    rail_top = deck_top + rail_h

    # S66: Chamfer insets for front edge (north view sees FL/FR, mirrored)
    _mc_n = params.get("mainCorners")
    _fl_s_n = 0
    _fr_s_n = 0
    if _mc_n:
        _fl_n = _mc_n.get("FL", {})
        _fr_n = _mc_n.get("FR", {})
        if _fl_n.get("type") == "chamfer" and _fl_n.get("size", 0) > 0:
            _fl_s_n = _fl_n["size"]
        if _fr_n.get("type") == "chamfer" and _fr_n.get("size", 0) > 0:
            _fr_s_n = _fr_n["size"]

    # Mirrored: FL appears on right, FR appears on left in north view
    _nrl = z0_x + _fr_s_n
    _nrr = z0_x + W - _fl_s_n

    ax.plot([_nrl, _nrr], [rail_top, rail_top],
            color=BRAND["rail"], lw=1.5, alpha=0.5)
    ax.plot([_nrl, _nrr], [deck_top + 0.25, deck_top + 0.25],
            color=BRAND["rail"], lw=0.6, alpha=0.5)
    for bx in np.arange(_fr_s_n, W - _fl_s_n, 3.75 / 12):
        ax.plot([z0_x + bx, z0_x + bx], [deck_top + 0.25, rail_top],
                color=BRAND["rail"], lw=0.08, alpha=0.3)

    # S65/S68: All stairs (north elevation -- mirrored X, multi-run aware)
    all_stairs = resolve_all_stairs(params, calc)
    _x_off = zone_ctx["x_off"]
    for rs in all_stairs:
        _svt, _sdir = stair_view_type(rs["exit_side"], "north")
        _draw_x = deck_x + total_w - _x_off - rs["world_anchor_x"]
        _sg = rs.get("geometry")
        if _sg and _sg["template"] != "straight":
            if _svt == "treads":
                _draw_multi_run_treads(ax, _draw_x, ground_y, deck_top, _sg, rail_h)
            elif _svt == "profile":
                _draw_multi_run_profile(ax, _draw_x, ground_y, deck_top, _sg, rail_h, _sdir)
        else:
            if _svt == "treads":
                _draw_stair_treads(ax, _draw_x, ground_y, deck_top, rs["stair_info"], rail_h)
            elif _svt == "profile":
                _draw_stair_profile(ax, _draw_x, ground_y, deck_top, rs["stair_info"], rail_h, _sdir)

    # === ZONE WING SECTIONS (mirrored for north view) ===
    for sec in zone_ctx["sections"]:
        _draw_zone_section_north(ax, deck_x, sec, total_w, ground_y, beam_h, beam_type, rail_h, calc["joist_spacing"])

    # === LABELS ===
    lbl_x = deck_x + total_w + 1.5
    lbl_kw = dict(fontsize=fs_lbl, fontfamily='monospace', color=BRAND["dark"])

    if attachment == "ledger":
        ax.text(lbl_x, deck_top - 0.4, 'LEDGER TO HOUSE', **lbl_kw)
    ax.text(lbl_x, rail_top - 0.3,
            (spec["labels"]["guardrail"] + ' (FAR SIDE)') if spec else f'{calc["rail_height"]}" RAIL (FAR SIDE)', **lbl_kw)

    # === DIMENSIONS (span bounding box) ===
    draw_dimension_v(ax, deck_x - 1, ground_y, deck_top,
                     format_feet_inches(H), offset=-3.5, color=BRAND["blue"], fontsize=fs_dim)
    draw_dimension_h(ax, deck_x, deck_x + total_w, ground_y,
                     format_feet_inches(total_w), offset=-1.5, color=BRAND["red"], fontsize=fs_dim)

    # S35: Graphic scale bar
    _draw_graphic_scale_bar(ax, deck_x + total_w / 2, -3.2)

    return total_wall + roof_peak


# ============================================================
# SIDE ELEVATION (East or West) - zone-0 only
# S35: Variable post heights, underground footings, hardware callouts
# ============================================================
def draw_side_elevation(ax, params, calc, direction="east", compact=False, spec=None):
    W = calc["width"]
    D = calc["depth"]
    H = calc["height"]
    attachment = calc["attachment"]
    ground_y = 0

    fs_lbl = 3.5 if compact else 4.5
    fs_dim = 4.5 if compact else 6

    house_d = 12
    house_x = 2

    # S35: Get post heights for variable height support
    _post_heights = calc.get("post_heights", [])
    footing_diam = calc.get("footing_diam", calc.get("fDiam", 24))
    footing_depth = calc.get("footing_depth", calc.get("fDepth", 42))

    if direction == "west":
        # S35: West view shows leftmost post (first in post_positions)
        _side_ph = _post_heights[0] if len(_post_heights) > 0 else H

        house_draw_x = house_x + D + 2
        deck_start_x = house_draw_x
        deck_end_x = house_draw_x - D

        # S33: Grade slope for west view (moved before house for S34)
        _slope_pct_w = params.get("slopePercent", 0) / 100
        _slope_dir_w = params.get("slopeDirection", "front-to-back")
        _grade_rise_w = 0
        if _slope_dir_w == "front-to-back":
            _grade_rise_w = -_slope_pct_w * D
        elif _slope_dir_w == "back-to-front":
            _grade_rise_w = _slope_pct_w * D

        # S34: Foundation extends to lowest grade at house edges
        _glx1w, _glx2w = -2.0, house_draw_x + house_d + 3.0
        _gly1w, _gly2w = ground_y - _grade_rise_w / 2, ground_y + _grade_rise_w / 2
        _ghlw = _gly1w + (_gly2w - _gly1w) * (house_draw_x - _glx1w) / max(_glx2w - _glx1w, 0.01)
        _ghrw = _gly1w + (_gly2w - _gly1w) * (house_draw_x + house_d - _glx1w) / max(_glx2w - _glx1w, 0.01)
        _gdropw = max(0, ground_y - min(_ghlw, _ghrw))
        house_h, roof_peak = _draw_house_side(ax, house_draw_x, house_d, ground_y, H, grade_drop=_gdropw)

        draw_grade_line(ax, -2, house_draw_x + house_d + 3, ground_y, slope_rise=_grade_rise_w, slope_pct=params.get("slopePercent", 0), house_bounds=(house_draw_x, house_draw_x + house_d))

        deck_top = H
        _ground_at_post = deck_top - _side_ph

        post_x = deck_end_x + 1.5
        ax.add_patch(patches.Rectangle((post_x - 0.5, _ground_at_post - 0.4), 1.0, 0.4,
                     fc=BRAND["concrete"], ec=BRAND["dark"], lw=0.5))
        ax.add_patch(patches.Rectangle((post_x - 0.35, _ground_at_post), 0.7, 0.2,
                     fc='#888', ec=BRAND["dark"], lw=0.4))
        ax.plot([post_x, post_x], [_ground_at_post + 0.2, deck_top], color=BRAND["post"], lw=2)

        # S35: Underground footing
        _draw_underground_footing(ax, post_x, _ground_at_post, footing_diam, footing_depth)

        # S35: Hardware callout on post
        if not compact:
            _draw_hardware_callout(ax, post_x, _ground_at_post + 0.1,
                                   spec["hardware"]["post_base"]["model"] if spec else 'ABU66Z',
                                   leader_dx=-2.5, leader_dy=-0.5)

        beam_h = _beam_h_from_calc(calc)
        beam_type = calc.get("beam_type", "dropped")
        if beam_type == "flush":
            ax.add_patch(patches.Rectangle((deck_end_x + 0.5, deck_top - beam_h), D - 0.5, beam_h,
                         fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))
        else:
            ax.add_patch(patches.Rectangle((deck_end_x + 0.5, deck_top - beam_h - 0.1), D - 0.5, beam_h,
                         fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))

        if attachment == "ledger":
            ax.plot([deck_start_x, deck_start_x], [deck_top - 1, deck_top],
                    color=BRAND["ledger_green"], lw=2.5)
            ax.text(deck_start_x - 0.3, deck_top - 0.5, 'LEDGER',
                    fontsize=3.5, color=BRAND["ledger_green"], rotation=90, va='center')

        ax.plot([deck_end_x, deck_start_x], [deck_top, deck_top], color='#6B5340', lw=2.5)

        rail_h = calc["rail_height"] / 12
        rail_top = deck_top + rail_h

        # S66: Chamfer insets for west (left side sees FL/BL)
        _mc_w = params.get("mainCorners")
        _fl_w = 0
        _bl_w = 0
        if _mc_w:
            _flc = _mc_w.get("FL", {})
            _blc = _mc_w.get("BL", {})
            if _flc.get("type") == "chamfer" and _flc.get("size", 0) > 0:
                _fl_w = _flc["size"]
            if _blc.get("type") == "chamfer" and _blc.get("size", 0) > 0 and attachment != "ledger":
                _bl_w = _blc["size"]

        _wrl = deck_end_x + _fl_w   # front (left in drawing)
        _wrr = deck_start_x - _bl_w  # house side (right in drawing)

        ax.plot([_wrl, _wrr], [rail_top, rail_top], color=BRAND["rail"], lw=2)
        ax.plot([_wrl, _wrr], [deck_top + 0.25, deck_top + 0.25],
                color=BRAND["rail"], lw=0.8)
        ax.plot([_wrl, _wrl], [deck_top, rail_top], color=BRAND["rail"], lw=1.2)
        ax.plot([_wrr, _wrr], [deck_top, rail_top], color=BRAND["rail"], lw=1.2)
        for bx in np.arange(_fl_w, D - _bl_w, 3.75 / 12):
            ax.plot([deck_end_x + bx, deck_end_x + bx], [deck_top + 0.25, rail_top],
                    color=BRAND["rail"], lw=0.15, alpha=0.5)

        # S65/S68: Side elevation stairs -- zone-0 only (west, mirrored depth, multi-run aware)
        all_stairs_w = resolve_all_stairs(params, calc)
        for rs in all_stairs_w:
            if rs["stair"]["zoneId"] != 0:
                continue
            _svt, _sdir = stair_view_type(rs["exit_side"], "west")
            _draw_x_w = deck_start_x - rs["world_anchor_y"]
            _sg = rs.get("geometry")
            if _sg and _sg["template"] != "straight":
                if _svt == "treads":
                    _draw_multi_run_treads(ax, _draw_x_w, ground_y, deck_top, _sg, rail_h)
                elif _svt == "profile":
                    _draw_multi_run_profile(ax, _draw_x_w, ground_y, deck_top, _sg, rail_h, _sdir)
            else:
                if _svt == "treads":
                    _draw_stair_treads(ax, _draw_x_w, ground_y, deck_top, rs["stair_info"], rail_h)
                elif _svt == "profile":
                    _draw_stair_profile(ax, _draw_x_w, ground_y, deck_top, rs["stair_info"], rail_h, _sdir)

        lbl_x = deck_end_x - 1.5
        lbl_kw = dict(fontsize=fs_lbl, fontfamily='monospace', color=BRAND["dark"], ha='right')
        ax.text(lbl_x, rail_top - 0.3,
                spec["labels"]["guardrail"] if spec else f'{calc["rail_height"]}" RAIL', **lbl_kw)
        ax.text(lbl_x, deck_top - beam_h / 2,
                spec["labels"]["beam"] if spec else f'{calc["beam_size"].upper()}', **lbl_kw)
        ax.text(lbl_x, H * 0.4,
                spec["labels"]["post_compact"] if spec else f'{calc["post_size"]} POST', **lbl_kw)
        ax.text(lbl_x, -0.5,
                spec["labels"]["pier_compact"] if spec else f'{calc["footing_diam"]}" DIA. PIER', **lbl_kw)

        draw_dimension_v(ax, deck_end_x - 0.5, ground_y, deck_top,
                         format_feet_inches(H), offset=-5, color=BRAND["blue"], fontsize=fs_dim)
        draw_dimension_h(ax, deck_end_x, deck_start_x, deck_top,
                         format_feet_inches(D), offset=max(rail_h + 1.5, 3), color=BRAND["red"], fontsize=fs_dim)

        # S35: Scale bar
        _draw_graphic_scale_bar(ax, (deck_end_x + deck_start_x) / 2, -3.2)

        max_h = house_h + roof_peak

    else:
        # S35: East view shows rightmost post (last in post_positions)
        _side_ph = _post_heights[-1] if len(_post_heights) > 0 else H

        # S33: Compute grade slope for east view (moved before house for S34)
        _slope_pct_e = params.get("slopePercent", 0) / 100
        _slope_dir_e = params.get("slopeDirection", "front-to-back")
        _grade_rise_e = 0
        if _slope_dir_e == "front-to-back":
            _grade_rise_e = _slope_pct_e * D
        elif _slope_dir_e == "back-to-front":
            _grade_rise_e = -_slope_pct_e * D

        # S34: Foundation extends to lowest grade at house edges
        _glx1e, _glx2e = -2.0, house_x + house_d + D + 5.0
        _gly1e, _gly2e = ground_y - _grade_rise_e / 2, ground_y + _grade_rise_e / 2
        _ghle = _gly1e + (_gly2e - _gly1e) * (house_x - _glx1e) / max(_glx2e - _glx1e, 0.01)
        _ghre = _gly1e + (_gly2e - _gly1e) * (house_x + house_d - _glx1e) / max(_glx2e - _glx1e, 0.01)
        _gdrope = max(0, ground_y - min(_ghle, _ghre))
        house_h, roof_peak = _draw_house_side(ax, house_x, house_d, ground_y, H, grade_drop=_gdrope)

        draw_grade_line(ax, -2, house_x + house_d + D + 5, ground_y, slope_rise=_grade_rise_e, slope_pct=params.get("slopePercent", 0), house_bounds=(house_x, house_x + house_d))

        deck_top = H
        _ground_at_post = deck_top - _side_ph
        deck_start_x = house_x + house_d

        post_x = deck_start_x + D - 1.5
        ax.add_patch(patches.Rectangle((post_x - 0.5, _ground_at_post - 0.4), 1.0, 0.4,
                     fc=BRAND["concrete"], ec=BRAND["dark"], lw=0.5))
        ax.add_patch(patches.Rectangle((post_x - 0.35, _ground_at_post), 0.7, 0.2,
                     fc='#888', ec=BRAND["dark"], lw=0.4))
        ax.plot([post_x, post_x], [_ground_at_post + 0.2, deck_top], color=BRAND["post"], lw=2)

        # S35: Underground footing
        _draw_underground_footing(ax, post_x, _ground_at_post, footing_diam, footing_depth)

        # S35: Hardware callout on post
        if not compact:
            _draw_hardware_callout(ax, post_x, _ground_at_post + 0.1,
                                   spec["hardware"]["post_base"]["model"] if spec else 'ABU66Z',
                                   leader_dx=2.5, leader_dy=-0.5)

        beam_h = _beam_h_from_calc(calc)
        beam_type = calc.get("beam_type", "dropped")
        if beam_type == "flush":
            ax.add_patch(patches.Rectangle((deck_start_x, deck_top - beam_h), D - 0.5, beam_h,
                         fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))
        else:
            ax.add_patch(patches.Rectangle((deck_start_x, deck_top - beam_h - 0.1), D - 0.5, beam_h,
                         fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))

        if attachment == "ledger":
            ax.plot([deck_start_x, deck_start_x], [deck_top - 1, deck_top],
                    color=BRAND["ledger_green"], lw=2.5)
            ax.text(deck_start_x + 0.3, deck_top - 0.5, 'LEDGER',
                    fontsize=3.5, color=BRAND["ledger_green"], rotation=90, va='center')

        ax.plot([deck_start_x, deck_start_x + D], [deck_top, deck_top], color='#6B5340', lw=2.5)

        rail_h = calc["rail_height"] / 12
        rail_top = deck_top + rail_h

        # S66: Chamfer insets for east (right side sees FR/BR)
        _mc_e = params.get("mainCorners")
        _fr_e = 0
        _br_e = 0
        if _mc_e:
            _frc = _mc_e.get("FR", {})
            _brc = _mc_e.get("BR", {})
            if _frc.get("type") == "chamfer" and _frc.get("size", 0) > 0:
                _fr_e = _frc["size"]
            if _brc.get("type") == "chamfer" and _brc.get("size", 0) > 0 and attachment != "ledger":
                _br_e = _brc["size"]

        _erl = deck_start_x + _br_e       # house side (left in drawing)
        _err = deck_start_x + D - _fr_e   # front (right in drawing)

        ax.plot([_erl, _err], [rail_top, rail_top], color=BRAND["rail"], lw=2)
        ax.plot([_erl, _err], [deck_top + 0.25, deck_top + 0.25],
                color=BRAND["rail"], lw=0.8)
        ax.plot([_erl, _erl], [deck_top, rail_top], color=BRAND["rail"], lw=1.2)
        ax.plot([_err, _err], [deck_top, rail_top], color=BRAND["rail"], lw=1.2)
        for bx in np.arange(_br_e, D - _fr_e, 3.75 / 12):
            ax.plot([deck_start_x + bx, deck_start_x + bx], [deck_top + 0.25, rail_top],
                    color=BRAND["rail"], lw=0.15, alpha=0.5)

        # S65/S68: Side elevation stairs -- zone-0 only (multi-run aware)
        all_stairs = resolve_all_stairs(params, calc)
        for rs in all_stairs:
            if rs["stair"]["zoneId"] != 0:
                continue
            _svt, _sdir = stair_view_type(rs["exit_side"], direction)
            _draw_x_e = deck_start_x + rs["world_anchor_y"]
            _sg = rs.get("geometry")
            if _sg and _sg["template"] != "straight":
                if _svt == "treads":
                    _draw_multi_run_treads(ax, _draw_x_e, ground_y, deck_top, _sg, rail_h)
                elif _svt == "profile":
                    _draw_multi_run_profile(ax, _draw_x_e, ground_y, deck_top, _sg, rail_h, _sdir)
            else:
                if _svt == "treads":
                    _draw_stair_treads(ax, _draw_x_e, ground_y, deck_top, rs["stair_info"], rail_h)
                elif _svt == "profile":
                    _draw_stair_profile(ax, _draw_x_e, ground_y, deck_top, rs["stair_info"], rail_h, _sdir)

        stair_ext = 0
        for rs in all_stairs:
            if rs["stair"]["zoneId"] != 0:
                continue
            _svt2, _sdir2 = stair_view_type(rs["exit_side"], direction)
            if _svt2 == "profile" and _sdir2 == 1:
                _se = rs["stair_info"]["num_treads"] * (rs["stair_info"]["tread_depth"] / 12)
                stair_ext = max(stair_ext, _se)
        lbl_x = deck_start_x + D + max(2, stair_ext + 1.5)
        lbl_kw = dict(fontsize=fs_lbl, fontfamily='monospace', color=BRAND["dark"])

        _min_gap = 0.55
        _lbl_rail = rail_top - 0.3
        _lbl_beam = min(deck_top - beam_h / 2, _lbl_rail - _min_gap)
        _lbl_post = min(H * 0.4, _lbl_beam - _min_gap)
        _lbl_pier = min(-0.5, _lbl_post - _min_gap)

        ax.text(lbl_x, _lbl_rail,
                spec["labels"]["guardrail"] if spec else f'{calc["rail_height"]}" RAIL', **lbl_kw)
        ax.text(lbl_x, _lbl_beam,
                spec["labels"]["beam"] if spec else f'{calc["beam_size"].upper()}', **lbl_kw)
        ax.text(lbl_x, _lbl_post,
                spec["labels"]["post_compact"] if spec else f'{calc["post_size"]} POST', **lbl_kw)
        ax.text(lbl_x, _lbl_pier,
                spec["labels"]["pier_compact"] if spec else f'{calc["footing_diam"]}" DIA. PIER', **lbl_kw)

        dim_x = deck_start_x + D + max(0.5, stair_ext + 0.5)
        draw_dimension_v(ax, dim_x, ground_y, deck_top,
                         format_feet_inches(H), offset=7, color=BRAND["blue"], fontsize=fs_dim)
        draw_dimension_h(ax, deck_start_x, deck_start_x + D, deck_top,
                         format_feet_inches(D), offset=max(rail_h + 1.5, 3), color=BRAND["red"], fontsize=fs_dim)

        # S35: Scale bar
        _draw_graphic_scale_bar(ax, deck_start_x + D / 2, -3.2)

        max_h = house_h + roof_peak

    return max_h


# ============================================================
# SHEET A-2: 4-ELEVATION LAYOUT (2x2 Grid)
# S24: Uses total_w for S/N axis limits when zones exist
# S35: Scale bars integrated into each elevation
# ============================================================
def draw_elevations_sheet(fig, params, calc, spec=None):
    if spec is None:
        from .permit_spec import build_permit_spec
        spec = build_permit_spec(params, calc)
    axes = fig.subplots(2, 2)
    fig.subplots_adjust(left=0.04, right=0.84, top=0.92, bottom=0.06, hspace=0.22, wspace=0.12)

    ax_south = axes[0, 0]
    ax_north = axes[0, 1]
    ax_east  = axes[1, 0]
    ax_west  = axes[1, 1]

    W = calc["width"]
    D = calc["depth"]
    H = calc["height"]

    # Compute total width for S/N axis limits
    zone_ctx = _get_zone_south_north_sections(params, calc)
    total_w = zone_ctx["bb_w"]

    # ---- SOUTH ELEVATION (top-left) ----
    ax_south.set_facecolor('white')
    ax_south.axis('off')
    max_h_s = draw_south_elevation(ax_south, params, calc, compact=True, spec=spec)
    margin_sx = max(total_w * 0.15, 4)
    ax_south.set_xlim(-margin_sx, total_w + margin_sx + 2)
    ax_south.set_ylim(-4.5, max(max_h_s + 3, H + 14))
    ax_south.set_aspect('equal')
    ax_south.text(-margin_sx + 0.5, max(max_h_s + 1.5, H + 12.5), 'SOUTH ELEVATION',
                  fontsize=7, fontweight='bold', fontfamily='monospace', color=BRAND["dark"])
    ax_south.text(-margin_sx + 0.5, max(max_h_s + 0.3, H + 11.3), 'SCALE: 1/4" = 1\'-0"',
                  fontsize=4, fontfamily='monospace', color=BRAND["mute"])

    # ---- NORTH ELEVATION (top-right) ----
    ax_north.set_facecolor('white')
    ax_north.axis('off')
    max_h_n = draw_north_elevation(ax_north, params, calc, compact=True, spec=spec)
    margin_nx = max(total_w * 0.15, 4)
    ax_north.set_xlim(-margin_nx, total_w + margin_nx + 2)
    ax_north.set_ylim(-4.5, max(max_h_n + 3, H + 14))
    ax_north.set_aspect('equal')
    ax_north.text(-margin_nx + 0.5, max(max_h_n + 1.5, H + 12.5), 'NORTH ELEVATION',
                  fontsize=7, fontweight='bold', fontfamily='monospace', color=BRAND["dark"])
    ax_north.text(-margin_nx + 0.5, max(max_h_n + 0.3, H + 11.3), 'SCALE: 1/4" = 1\'-0"',
                  fontsize=4, fontfamily='monospace', color=BRAND["mute"])

    # ---- EAST ELEVATION (bottom-left) ----
    ax_east.set_facecolor('white')
    ax_east.axis('off')
    max_h_e = draw_side_elevation(ax_east, params, calc, direction="east", compact=True, spec=spec)
    margin_ex = max(D * 0.3, 3)
    ax_east.set_xlim(-margin_ex, D + 22)
    ax_east.set_ylim(-4.5, max(max_h_e + 3, H + 14))
    ax_east.set_aspect('equal')
    ax_east.text(-margin_ex + 0.5, max(max_h_e + 1.5, H + 12.5), 'EAST ELEVATION',
                 fontsize=7, fontweight='bold', fontfamily='monospace', color=BRAND["dark"])
    ax_east.text(-margin_ex + 0.5, max(max_h_e + 0.3, H + 11.3), 'SCALE: 1/4" = 1\'-0"',
                 fontsize=4, fontfamily='monospace', color=BRAND["mute"])

    # ---- WEST ELEVATION (bottom-right) ----
    ax_west.set_facecolor('white')
    ax_west.axis('off')
    max_h_w = draw_side_elevation(ax_west, params, calc, direction="west", compact=True, spec=spec)
    margin_wx = max(D * 0.3, 3)
    ax_west.set_xlim(-margin_wx, D + 22)
    ax_west.set_ylim(-4.5, max(max_h_w + 3, H + 14))
    ax_west.set_aspect('equal')
    ax_west.text(-margin_wx + 0.5, max(max_h_w + 1.5, H + 12.5), 'WEST ELEVATION',
                 fontsize=7, fontweight='bold', fontfamily='monospace', color=BRAND["dark"])
    ax_west.text(-margin_wx + 0.5, max(max_h_w + 0.3, H + 11.3), 'SCALE: 1/4" = 1\'-0"',
                 fontsize=4, fontfamily='monospace', color=BRAND["mute"])

