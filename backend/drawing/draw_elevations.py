#!/usr/bin/env python3
"""
SimpleBlueprints — Parametric PDF Drawing Engine
Sheet A-2: Exterior Elevations (4-View: South / North / East / West)
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
from .stair_utils import get_stair_placement, get_stair_exit_side


# ============================================================
# STAIR VIEW HELPER
# ============================================================
def stair_view_type(exit_side, view_direction):
    """
    Determine how stairs appear in a given elevation view.

    Returns: (view_type, profile_dir)
        view_type: "treads" | "profile" | "hidden"
        profile_dir: 1 (extends right) or -1 (extends left), None for treads/hidden
    """
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
    """
    Draw head-on tread view (horizontal lines, two stringer verticals).
    cx = center X position of stair in drawing coords.
    """
    sw = stair.get("width", 4)
    rise_per = stair["actual_rise"] / 12
    n_risers = stair["num_risers"]
    sx = cx - sw / 2

    # White fill to mask structure behind stairs
    ax.add_patch(patches.Rectangle((sx, ground_y), sw, deck_top - ground_y,
                 fc='white', ec='none', zorder=5))

    # Tread lines
    for i in range(n_risers + 1):
        ty = deck_top - i * rise_per
        ax.plot([sx, sx + sw], [ty, ty], color=BRAND["dark"], lw=0.8, zorder=6)

    # Stringer sides
    ax.plot([sx, sx], [ground_y, deck_top], color=BRAND["dark"], lw=1.0, zorder=6)
    ax.plot([sx + sw, sx + sw], [ground_y, deck_top], color=BRAND["dark"], lw=1.0, zorder=6)
    ax.plot([sx, sx + sw], [ground_y, ground_y], color=BRAND["dark"], lw=0.8, zorder=6)

    # Handrails
    ax.plot([sx, sx], [ground_y + rail_h_ft, deck_top + rail_h_ft],
            color=BRAND["rail"], lw=0.8, zorder=6)
    ax.plot([sx + sw, sx + sw], [ground_y + rail_h_ft, deck_top + rail_h_ft],
            color=BRAND["rail"], lw=0.8, zorder=6)
    # Top rail cap
    ax.plot([sx, sx + sw], [deck_top + rail_h_ft, deck_top + rail_h_ft],
            color=BRAND["rail"], lw=1.0, zorder=6)

    # Landing pad
    ax.add_patch(patches.Rectangle((sx - 0.2, ground_y - 0.12), sw + 0.4, 0.12,
                 fc='#e0ddd8', ec=BRAND["dark"], lw=0.4, zorder=6))

    return sx, sx + sw  # return left/right edges for rail gap


def _draw_stair_profile(ax, sx, ground_y, deck_top, stair, rail_h_ft, direction):
    """
    Draw side-profile (stepped outline) of stairs.
    sx = start X position (where stairs meet deck edge).
    direction = 1 (extends right) or -1 (extends left).
    """
    rise = stair["actual_rise"] / 12
    run = stair["tread_depth"] / 12
    n_treads = stair["num_treads"]

    # Stepped profile
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

    # Stringer outline
    ax.plot([sx, end_x], [deck_top, ground_y], color=BRAND["dark"], lw=0.8, zorder=6)

    # Handrail (dashed diagonal)
    hr_top = deck_top + rail_h_ft
    ax.plot([sx, end_x], [hr_top, ground_y + rail_h_ft],
            color=BRAND["dark"], lw=0.4, ls='--', zorder=6)

    # Landing pad at bottom of stairs
    ax.add_patch(patches.Rectangle((end_x - 0.5, ground_y - 0.12), 1.0, 0.12,
                 fc='#e0ddd8', ec=BRAND["dark"], lw=0.4, zorder=6))


# ============================================================
# SHARED DRAWING HELPERS
# ============================================================
def draw_grade_line(ax, x1, x2, y):
    """Draw ground line with hatch marks"""
    ax.plot([x1, x2], [y, y], color=BRAND["dark"], lw=1)
    for i in np.arange(x1, x2, 0.3):
        ax.plot([i, i - 0.2], [y, y - 0.2], color=BRAND["mute"], lw=0.2)


def _draw_house_front(ax, house_x, house_w, ground_y, height):
    """Draw simplified house (front face) behind deck in front/rear elevation"""
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

    # Foundation
    ax.add_patch(patches.Rectangle((house_x, ground_y), house_w, foundation_h,
                 fc=BRAND["concrete"], ec=BRAND["dark"], lw=1))

    # 1st floor
    f1_y = ground_y + foundation_h
    ax.add_patch(patches.Rectangle((house_x, f1_y), house_w, floor1_h,
                 fc=BRAND["house"], ec=BRAND["dark"], lw=1))
    for sy in np.arange(f1_y + 0.4, f1_y + floor1_h, 0.5):
        ax.plot([house_x, house_x + house_w], [sy, sy], color=BRAND["light"], lw=0.15)

    # 2nd floor
    if floor2_h > 0:
        f2_y = f1_y + floor1_h
        ax.add_patch(patches.Rectangle((house_x, f2_y), house_w, floor2_h,
                     fc=BRAND["house"], ec=BRAND["dark"], lw=1))
        for sy in np.arange(f2_y + 0.4, f2_y + floor2_h, 0.5):
            ax.plot([house_x, house_x + house_w], [sy, sy], color=BRAND["light"], lw=0.15)

    # Windows
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

    # Roof
    roof_base = ground_y + total_wall
    overhang = 1.5
    verts = [(house_x - overhang, roof_base),
             (house_x + house_w / 2, roof_base + roof_peak),
             (house_x + house_w + overhang, roof_base)]
    ax.add_patch(Polygon(verts, fc='#888', ec=BRAND["dark"], lw=1.5))

    ax.text(house_x + house_w / 2, roof_base + 1.5, 'EXISTING HOUSE',
            ha='center', fontsize=4.5, color=BRAND["mute"])

    return total_wall, roof_peak


def _draw_house_side(ax, house_x, house_d, ground_y, height):
    """Draw simplified house (side face) for side elevations"""
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

    return house_h, roof_peak


# ============================================================
# SOUTH ELEVATION (front — observer looks north at deck front)
# ============================================================
def draw_south_elevation(ax, params, calc, compact=False):
    """Front elevation: full deck width, all posts, beam, railing"""
    W = calc["width"]
    D = calc["depth"]
    H = calc["height"]
    ground_y = 0
    deck_x = 0.5

    # Font scaling for compact (2×2) layout
    fs_lbl = 3.5 if compact else 4.5
    fs_dim = 4.5 if compact else 6
    fs_title = 4 if compact else 5.5

    # House behind
    house_x = deck_x + (W - min(W, 30)) / 2
    house_w = min(W, 30)
    total_wall, roof_peak = _draw_house_front(ax, house_x, house_w, ground_y, H)

    draw_grade_line(ax, -3, W + 5, ground_y)

    deck_top = H

    # === POSTS ===
    for px in calc["post_positions"]:
        sx = deck_x + px
        ax.add_patch(patches.Rectangle((sx - 0.5, ground_y - 0.4), 1.0, 0.4,
                     fc=BRAND["concrete"], ec=BRAND["dark"], lw=0.5))
        ax.add_patch(patches.Rectangle((sx - 0.35, ground_y), 0.7, 0.2,
                     fc='#888', ec=BRAND["dark"], lw=0.4))
        ax.plot([sx, sx], [ground_y + 0.2, deck_top], color=BRAND["post"], lw=2)

    # === BEAM ===
    beam_h = 1.0
    beam_type = calc.get("beam_type", "dropped")
    if beam_type == "flush":
        beam_bottom = deck_top - beam_h
        ax.plot([deck_x + 1, deck_x + W - 1], [beam_bottom, beam_bottom],
                color=BRAND["beam"], lw=1.5, linestyle=(0, (8, 4)), zorder=4)
        for px in calc["post_positions"]:
            sx = deck_x + px
            ax.plot([sx, sx], [ground_y + 0.2, deck_top - beam_h], color=BRAND["post"], lw=2)
    else:
        ax.add_patch(patches.Rectangle((deck_x + 1, deck_top - beam_h - 0.1), W - 2, beam_h,
                     fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))

    # === JOISTS ===
    joist_sp = calc["joist_spacing"] / 12
    for jx in np.arange(0, W, joist_sp):
        ax.add_patch(patches.Rectangle((deck_x + jx - 0.04, deck_top - 0.8), 0.08, 0.68,
                     fc=BRAND["wood"], ec=BRAND["dark"], lw=0.15))

    # === DECK SURFACE ===
    ax.plot([deck_x, deck_x + W], [deck_top, deck_top], color='#6B5340', lw=2.5)

    # === RAILING ===
    rail_h = calc["rail_height"] / 12
    rail_top = deck_top + rail_h

    # Stair placement
    _placement = get_stair_placement(params, {"width": W, "depth": D})
    _exit_side = get_stair_exit_side(_placement["angle"])
    _svt, _sdir = stair_view_type(_exit_side, "south")
    has_stairs = params.get("hasStairs") and calc.get("stairs")

    # Rail gap for head-on treads
    stair_open_l = stair_open_r = None
    if has_stairs and _svt == "treads":
        _sw = calc["stairs"].get("width", 4)
        _stair_cx = deck_x + _placement["anchor_x"]
        stair_open_l = _stair_cx - _sw / 2
        stair_open_r = _stair_cx + _sw / 2

    # Top rail
    if stair_open_l is not None:
        ax.plot([deck_x, stair_open_l], [rail_top, rail_top], color=BRAND["rail"], lw=2)
        ax.plot([stair_open_r, deck_x + W], [rail_top, rail_top], color=BRAND["rail"], lw=2)
        ax.plot([deck_x, stair_open_l], [deck_top + 0.25, deck_top + 0.25], color=BRAND["rail"], lw=0.8)
        ax.plot([stair_open_r, deck_x + W], [deck_top + 0.25, deck_top + 0.25], color=BRAND["rail"], lw=0.8)
    else:
        ax.plot([deck_x, deck_x + W], [rail_top, rail_top], color=BRAND["rail"], lw=2)
        ax.plot([deck_x, deck_x + W], [deck_top + 0.25, deck_top + 0.25], color=BRAND["rail"], lw=0.8)

    # Rail posts
    for rpx in np.arange(0, W + 0.1, 4):
        px_abs = deck_x + rpx
        if stair_open_l is not None and stair_open_l < px_abs < stair_open_r:
            continue
        ax.plot([px_abs, px_abs], [deck_top, rail_top], color=BRAND["rail"], lw=1)

    # Balusters
    for bx in np.arange(0, W, 3.75 / 12):
        bx_abs = deck_x + bx
        if stair_open_l is not None and stair_open_l < bx_abs < stair_open_r:
            continue
        ax.plot([bx_abs, bx_abs], [deck_top + 0.25, rail_top],
                color=BRAND["rail"], lw=0.12, alpha=0.5)

    # === STAIRS ===
    if has_stairs:
        stair = calc["stairs"]
        if _svt == "treads":
            _draw_stair_treads(ax, deck_x + _placement["anchor_x"],
                               ground_y, deck_top, stair, rail_h)
        elif _svt == "profile":
            _draw_stair_profile(ax, deck_x + _placement["anchor_x"],
                                ground_y, deck_top, stair, rail_h, _sdir)

    # === LABELS ===
    lbl_x = deck_x + W + 1.5
    lbl_kw = dict(fontsize=fs_lbl, fontfamily='monospace', color=BRAND["dark"])

    ax.text(lbl_x, rail_top - 0.3, f'{calc["rail_height"]}" GUARD RAIL', **lbl_kw)
    ax.text(lbl_x, deck_top - beam_h / 2 - 0.2, f'{calc["beam_size"].upper()}', **lbl_kw)
    ax.text(lbl_x, deck_top - beam_h / 2 - 0.8,
            'FLUSH BEAM' if beam_type == 'flush' else 'DROPPED BEAM', **lbl_kw)
    ax.text(lbl_x, H * 0.4, f'{calc["post_size"]} PT POSTS', **lbl_kw)
    ax.text(lbl_x, H * 0.4 - 0.6, f'({calc["num_posts"]}) PLCS', **lbl_kw)
    ax.text(lbl_x, -0.5, f'{calc["footing_diam"]}" Ø PIERS', **lbl_kw)

    # === DIMENSIONS ===
    draw_dimension_v(ax, deck_x - 1, ground_y, deck_top,
                     format_feet_inches(H), offset=-3.5, color=BRAND["blue"], fontsize=fs_dim)
    draw_dimension_v(ax, deck_x + W + 0.5, deck_top, rail_top,
                     f'{calc["rail_height"]}"', offset=7, color=BRAND["ledger_green"], fontsize=fs_dim - 1)

    return total_wall + roof_peak


# ============================================================
# NORTH ELEVATION (rear — observer looks south at house wall)
# ============================================================
def draw_north_elevation(ax, params, calc, compact=False):
    """
    True rear elevation: observer stands north of house, looks south.
    Shows full deck width, house wall prominent, ledger detail.
    Left-right is MIRRORED vs south (east side on left, west on right).
    """
    W = calc["width"]
    D = calc["depth"]
    H = calc["height"]
    attachment = calc["attachment"]
    ground_y = 0
    deck_x = 0.5

    fs_lbl = 3.5 if compact else 4.5
    fs_dim = 4.5 if compact else 6

    # House — prominent in rear view
    house_x = deck_x + (W - min(W, 30)) / 2
    house_w = min(W, 30)
    total_wall, roof_peak = _draw_house_front(ax, house_x, house_w, ground_y, H)

    draw_grade_line(ax, -3, W + 5, ground_y)

    deck_top = H

    # === LEDGER (prominent in rear view) ===
    if attachment == "ledger":
        # Ledger board runs full width at deck height on house wall
        ax.plot([deck_x, deck_x + W], [deck_top, deck_top], color=BRAND["ledger_green"], lw=3)
        ax.plot([deck_x, deck_x + W], [deck_top - 0.8, deck_top - 0.8],
                color=BRAND["ledger_green"], lw=1.5, alpha=0.6)
        # Ledger label
        ax.text(deck_x + W / 2, deck_top - 0.4, 'LEDGER BOARD',
                ha='center', fontsize=fs_lbl, color=BRAND["ledger_green"],
                fontfamily='monospace', fontweight='bold')

    # === DECK SURFACE (just a line — deck extends away from viewer) ===
    ax.plot([deck_x, deck_x + W], [deck_top, deck_top], color='#6B5340', lw=2.5)

    # === POSTS (visible at far edge, shown as dashed/hidden lines) ===
    for px in calc["post_positions"]:
        sx = deck_x + (W - px)  # MIRRORED left-right
        ax.plot([sx, sx], [ground_y, deck_top],
                color=BRAND["post"], lw=1.0, ls=(0, (6, 3)), alpha=0.4)

    # === BEAM (far edge, shown as hidden/dashed) ===
    beam_h = 1.0
    beam_type = calc.get("beam_type", "dropped")
    if beam_type == "flush":
        ax.plot([deck_x + 1, deck_x + W - 1], [deck_top - beam_h, deck_top - beam_h],
                color=BRAND["beam"], lw=1.0, ls=(0, (6, 3)), alpha=0.5)
    else:
        ax.add_patch(patches.Rectangle((deck_x + 1, deck_top - beam_h - 0.1), W - 2, beam_h,
                     fc=BRAND["beam"], ec=BRAND["dark"], lw=0.5, alpha=0.3))

    # === RAILING (far edge, shown lighter) ===
    rail_h = calc["rail_height"] / 12
    rail_top = deck_top + rail_h

    # Stair placement (mirrored)
    _placement = get_stair_placement(params, {"width": W, "depth": D})
    _exit_side = get_stair_exit_side(_placement["angle"])
    _svt, _sdir = stair_view_type(_exit_side, "north")
    has_stairs = params.get("hasStairs") and calc.get("stairs")

    # Rail at far edge (lighter, it's in the background)
    ax.plot([deck_x, deck_x + W], [rail_top, rail_top],
            color=BRAND["rail"], lw=1.5, alpha=0.5)
    ax.plot([deck_x, deck_x + W], [deck_top + 0.25, deck_top + 0.25],
            color=BRAND["rail"], lw=0.6, alpha=0.5)

    # Balusters (far edge, lighter)
    for bx in np.arange(0, W, 3.75 / 12):
        ax.plot([deck_x + bx, deck_x + bx], [deck_top + 0.25, rail_top],
                color=BRAND["rail"], lw=0.08, alpha=0.3)

    # === STAIRS (mirrored X for north view) ===
    if has_stairs:
        stair = calc["stairs"]
        # Mirror anchor_x for north view
        mirrored_ax = W - _placement["anchor_x"]
        if _svt == "treads":
            _draw_stair_treads(ax, deck_x + mirrored_ax,
                               ground_y, deck_top, stair, rail_h)
        elif _svt == "profile":
            _draw_stair_profile(ax, deck_x + mirrored_ax,
                                ground_y, deck_top, stair, rail_h, _sdir)

    # === LABELS ===
    lbl_x = deck_x + W + 1.5
    lbl_kw = dict(fontsize=fs_lbl, fontfamily='monospace', color=BRAND["dark"])

    if attachment == "ledger":
        ax.text(lbl_x, deck_top - 0.4, 'LEDGER TO HOUSE', **lbl_kw)
    ax.text(lbl_x, rail_top - 0.3, f'{calc["rail_height"]}" RAIL (FAR SIDE)', **lbl_kw)

    # === DIMENSIONS ===
    draw_dimension_v(ax, deck_x - 1, ground_y, deck_top,
                     format_feet_inches(H), offset=-3.5, color=BRAND["blue"], fontsize=fs_dim)
    draw_dimension_h(ax, deck_x, deck_x + W, ground_y,
                     format_feet_inches(W), offset=-1.5, color=BRAND["red"], fontsize=fs_dim)

    return total_wall + roof_peak


# ============================================================
# SIDE ELEVATION (East or West)
# ============================================================
def draw_side_elevation(ax, params, calc, direction="east", compact=False):
    """
    Side elevation showing deck depth, post, beam, ledger.

    direction="east":  observer faces west — house on LEFT, yard on RIGHT
    direction="west":  observer faces east — house on RIGHT, yard on LEFT (mirrored)
    """
    W = calc["width"]
    D = calc["depth"]
    H = calc["height"]
    attachment = calc["attachment"]
    ground_y = 0

    fs_lbl = 3.5 if compact else 4.5
    fs_dim = 4.5 if compact else 6

    house_d = 12
    house_x = 2

    # For west view, we mirror: house on right instead of left
    if direction == "west":
        # Draw house on RIGHT side
        house_draw_x = house_x + D + house_d  # offset to right
        _draw_house_side(ax, house_draw_x, house_d, ground_y, H)
        deck_start_x = house_draw_x  # deck starts at left edge of house
        deck_end_x = deck_start_x - D
        # Actually, let's think about this differently for west:
        # In west view, house is on the right. Deck extends left from house.
        # Let's keep house_x fixed and adjust:
        house_draw_x = house_x + D + 2  # house on right
        deck_start_x = house_draw_x  # ledger at house
        deck_end_x = house_draw_x - D  # far edge (yard side)

        house_h, roof_peak = _draw_house_side(ax, house_draw_x, house_d, ground_y, H)
        draw_grade_line(ax, -2, house_draw_x + house_d + 3, ground_y)

        deck_top = H

        # Post at far (left) end
        post_x = deck_end_x + 1.5
        ax.add_patch(patches.Rectangle((post_x - 0.5, ground_y - 0.4), 1.0, 0.4,
                     fc=BRAND["concrete"], ec=BRAND["dark"], lw=0.5))
        ax.add_patch(patches.Rectangle((post_x - 0.35, ground_y), 0.7, 0.2,
                     fc='#888', ec=BRAND["dark"], lw=0.4))
        ax.plot([post_x, post_x], [ground_y + 0.2, deck_top], color=BRAND["post"], lw=2)

        # Beam
        beam_h = 1.0
        beam_type = calc.get("beam_type", "dropped")
        if beam_type == "flush":
            ax.add_patch(patches.Rectangle((deck_end_x + 0.5, deck_top - beam_h), D - 0.5, beam_h,
                         fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))
        else:
            ax.add_patch(patches.Rectangle((deck_end_x + 0.5, deck_top - beam_h - 0.1), D - 0.5, beam_h,
                         fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))

        # Ledger
        if attachment == "ledger":
            ax.plot([deck_start_x, deck_start_x], [deck_top - 1, deck_top],
                    color=BRAND["ledger_green"], lw=2.5)
            ax.text(deck_start_x - 0.3, deck_top - 0.5, 'LEDGER',
                    fontsize=3.5, color=BRAND["ledger_green"], rotation=90, va='center')

        # Deck surface
        ax.plot([deck_end_x, deck_start_x], [deck_top, deck_top], color='#6B5340', lw=2.5)

        # Railing
        rail_h = calc["rail_height"] / 12
        rail_top = deck_top + rail_h
        ax.plot([deck_end_x, deck_start_x], [rail_top, rail_top], color=BRAND["rail"], lw=2)
        ax.plot([deck_end_x, deck_start_x], [deck_top + 0.25, deck_top + 0.25],
                color=BRAND["rail"], lw=0.8)
        ax.plot([deck_end_x, deck_end_x], [deck_top, rail_top], color=BRAND["rail"], lw=1.2)
        ax.plot([deck_start_x, deck_start_x], [deck_top, rail_top], color=BRAND["rail"], lw=1.2)
        for bx in np.arange(0, D, 3.75 / 12):
            ax.plot([deck_end_x + bx, deck_end_x + bx], [deck_top + 0.25, rail_top],
                    color=BRAND["rail"], lw=0.15, alpha=0.5)

        # Stairs
        _placement = get_stair_placement(params, {"width": W, "depth": D})
        _exit_side = get_stair_exit_side(_placement["angle"])
        _svt, _sdir = stair_view_type(_exit_side, "west")
        has_stairs = params.get("hasStairs") and calc.get("stairs")

        if has_stairs:
            stair = calc["stairs"]
            if _svt == "treads":
                # anchor_y maps to X axis in side view; mirrored for west
                stair_cx = deck_start_x - _placement["anchor_y"]
                _draw_stair_treads(ax, stair_cx, ground_y, deck_top, stair, rail_h)
            elif _svt == "profile":
                stair_sx = deck_start_x - _placement["anchor_y"]
                _draw_stair_profile(ax, stair_sx, ground_y, deck_top, stair, rail_h, _sdir)

        # Labels
        lbl_x = deck_end_x - 1.5
        lbl_kw = dict(fontsize=fs_lbl, fontfamily='monospace', color=BRAND["dark"], ha='right')
        ax.text(lbl_x, rail_top - 0.3, f'{calc["rail_height"]}" RAIL', **lbl_kw)
        ax.text(lbl_x, deck_top - beam_h / 2, f'{calc["beam_size"].upper()}', **lbl_kw)
        ax.text(lbl_x, H * 0.4, f'{calc["post_size"]} POST', **lbl_kw)

        # Dimensions
        draw_dimension_v(ax, deck_end_x - 0.5, ground_y, deck_top,
                         format_feet_inches(H), offset=-5, color=BRAND["blue"], fontsize=fs_dim)
        draw_dimension_h(ax, deck_end_x, deck_start_x, deck_top,
                         format_feet_inches(D), offset=max(rail_h + 1.5, 3), color=BRAND["red"], fontsize=fs_dim)

        max_h = house_h + roof_peak

    else:
        # EAST view: house on LEFT, yard on RIGHT (same layout as old "north")
        house_h, roof_peak = _draw_house_side(ax, house_x, house_d, ground_y, H)
        draw_grade_line(ax, -2, house_x + house_d + D + 5, ground_y)

        deck_top = H
        deck_start_x = house_x + house_d

        # Post at far (right) end
        post_x = deck_start_x + D - 1.5
        ax.add_patch(patches.Rectangle((post_x - 0.5, ground_y - 0.4), 1.0, 0.4,
                     fc=BRAND["concrete"], ec=BRAND["dark"], lw=0.5))
        ax.add_patch(patches.Rectangle((post_x - 0.35, ground_y), 0.7, 0.2,
                     fc='#888', ec=BRAND["dark"], lw=0.4))
        ax.plot([post_x, post_x], [ground_y + 0.2, deck_top], color=BRAND["post"], lw=2)

        # Beam
        beam_h = 1.0
        beam_type = calc.get("beam_type", "dropped")
        if beam_type == "flush":
            ax.add_patch(patches.Rectangle((deck_start_x, deck_top - beam_h), D - 0.5, beam_h,
                         fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))
        else:
            ax.add_patch(patches.Rectangle((deck_start_x, deck_top - beam_h - 0.1), D - 0.5, beam_h,
                         fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))

        # Ledger
        if attachment == "ledger":
            ax.plot([deck_start_x, deck_start_x], [deck_top - 1, deck_top],
                    color=BRAND["ledger_green"], lw=2.5)
            ax.text(deck_start_x + 0.3, deck_top - 0.5, 'LEDGER',
                    fontsize=3.5, color=BRAND["ledger_green"], rotation=90, va='center')

        # Deck surface
        ax.plot([deck_start_x, deck_start_x + D], [deck_top, deck_top], color='#6B5340', lw=2.5)

        # Railing
        rail_h = calc["rail_height"] / 12
        rail_top = deck_top + rail_h
        ax.plot([deck_start_x, deck_start_x + D], [rail_top, rail_top], color=BRAND["rail"], lw=2)
        ax.plot([deck_start_x, deck_start_x + D], [deck_top + 0.25, deck_top + 0.25],
                color=BRAND["rail"], lw=0.8)
        ax.plot([deck_start_x, deck_start_x], [deck_top, rail_top], color=BRAND["rail"], lw=1.2)
        ax.plot([deck_start_x + D, deck_start_x + D], [deck_top, rail_top], color=BRAND["rail"], lw=1.2)
        for bx in np.arange(0, D, 3.75 / 12):
            ax.plot([deck_start_x + bx, deck_start_x + bx], [deck_top + 0.25, rail_top],
                    color=BRAND["rail"], lw=0.15, alpha=0.5)

        # Stairs
        _placement = get_stair_placement(params, {"width": W, "depth": D})
        _exit_side = get_stair_exit_side(_placement["angle"])
        _svt, _sdir = stair_view_type(_exit_side, "east")
        has_stairs = params.get("hasStairs") and calc.get("stairs")

        if has_stairs:
            stair = calc["stairs"]
            if _svt == "treads":
                stair_cx = deck_start_x + _placement["anchor_y"]
                _draw_stair_treads(ax, stair_cx, ground_y, deck_top, stair, rail_h)
            elif _svt == "profile":
                stair_sx = deck_start_x + _placement["anchor_y"]
                _draw_stair_profile(ax, stair_sx, ground_y, deck_top, stair, rail_h, _sdir)

        # Labels
        stair_ext = 0
        if has_stairs and _svt == "profile" and _sdir == 1:
            stair_ext = calc["stairs"]["num_treads"] * (calc["stairs"]["tread_depth"] / 12)
        lbl_x = deck_start_x + D + max(2, stair_ext + 1.5)
        lbl_kw = dict(fontsize=fs_lbl, fontfamily='monospace', color=BRAND["dark"])

        _min_gap = 0.55
        _lbl_rail = rail_top - 0.3
        _lbl_beam = min(deck_top - beam_h / 2, _lbl_rail - _min_gap)
        _lbl_post = min(H * 0.4, _lbl_beam - _min_gap)
        _lbl_pier = min(-0.5, _lbl_post - _min_gap)

        ax.text(lbl_x, _lbl_rail, f'{calc["rail_height"]}" RAIL', **lbl_kw)
        ax.text(lbl_x, _lbl_beam, f'{calc["beam_size"].upper()}', **lbl_kw)
        ax.text(lbl_x, _lbl_post, f'{calc["post_size"]} POST', **lbl_kw)
        ax.text(lbl_x, _lbl_pier, f'{calc["footing_diam"]}" Ø PIER', **lbl_kw)

        # Dimensions
        dim_x = deck_start_x + D + max(0.5, stair_ext + 0.5)
        draw_dimension_v(ax, dim_x, ground_y, deck_top,
                         format_feet_inches(H), offset=7, color=BRAND["blue"], fontsize=fs_dim)
        draw_dimension_h(ax, deck_start_x, deck_start_x + D, deck_top,
                         format_feet_inches(D), offset=max(rail_h + 1.5, 3), color=BRAND["red"], fontsize=fs_dim)

        max_h = house_h + roof_peak

    return max_h


# ============================================================
# SHEET A-2: 4-ELEVATION LAYOUT (2×2 Grid)
# ============================================================
def draw_elevations_sheet(fig, params, calc):
    """Draw all 4 elevations in a 2×2 grid layout"""

    # 2×2 grid: South (top-left), North (top-right), East (bottom-left), West (bottom-right)
    axes = fig.subplots(2, 2)
    fig.subplots_adjust(left=0.04, right=0.96, top=0.92, bottom=0.06, hspace=0.22, wspace=0.12)

    ax_south = axes[0, 0]
    ax_north = axes[0, 1]
    ax_east  = axes[1, 0]
    ax_west  = axes[1, 1]

    W = calc["width"]
    D = calc["depth"]
    H = calc["height"]

    # ---- SOUTH ELEVATION (top-left) ----
    ax_south.set_facecolor('white')
    ax_south.axis('off')
    max_h_s = draw_south_elevation(ax_south, params, calc, compact=True)
    margin_sx = max(W * 0.15, 4)
    ax_south.set_xlim(-margin_sx, W + margin_sx + 2)
    ax_south.set_ylim(-2, max(max_h_s + 3, H + 14))
    ax_south.set_aspect('equal')
    ax_south.text(-margin_sx + 0.5, max(max_h_s + 1.5, H + 12.5), 'SOUTH ELEVATION',
                  fontsize=7, fontweight='bold', fontfamily='monospace', color=BRAND["dark"])
    ax_south.text(-margin_sx + 0.5, max(max_h_s + 0.3, H + 11.3), 'SCALE: 1/4" = 1\'-0"',
                  fontsize=4, fontfamily='monospace', color=BRAND["mute"])

    # ---- NORTH ELEVATION (top-right) ----
    ax_north.set_facecolor('white')
    ax_north.axis('off')
    max_h_n = draw_north_elevation(ax_north, params, calc, compact=True)
    margin_nx = max(W * 0.15, 4)
    ax_north.set_xlim(-margin_nx, W + margin_nx + 2)
    ax_north.set_ylim(-2, max(max_h_n + 3, H + 14))
    ax_north.set_aspect('equal')
    ax_north.text(-margin_nx + 0.5, max(max_h_n + 1.5, H + 12.5), 'NORTH ELEVATION',
                  fontsize=7, fontweight='bold', fontfamily='monospace', color=BRAND["dark"])
    ax_north.text(-margin_nx + 0.5, max(max_h_n + 0.3, H + 11.3), 'SCALE: 1/4" = 1\'-0"',
                  fontsize=4, fontfamily='monospace', color=BRAND["mute"])

    # ---- EAST ELEVATION (bottom-left) ----
    ax_east.set_facecolor('white')
    ax_east.axis('off')
    max_h_e = draw_side_elevation(ax_east, params, calc, direction="east", compact=True)
    margin_ex = max(D * 0.3, 3)
    ax_east.set_xlim(-margin_ex, D + 22)
    ax_east.set_ylim(-2, max(max_h_e + 3, H + 14))
    ax_east.set_aspect('equal')
    ax_east.text(-margin_ex + 0.5, max(max_h_e + 1.5, H + 12.5), 'EAST ELEVATION',
                 fontsize=7, fontweight='bold', fontfamily='monospace', color=BRAND["dark"])
    ax_east.text(-margin_ex + 0.5, max(max_h_e + 0.3, H + 11.3), 'SCALE: 1/4" = 1\'-0"',
                 fontsize=4, fontfamily='monospace', color=BRAND["mute"])

    # ---- WEST ELEVATION (bottom-right) ----
    ax_west.set_facecolor('white')
    ax_west.axis('off')
    max_h_w = draw_side_elevation(ax_west, params, calc, direction="west", compact=True)
    margin_wx = max(D * 0.3, 3)
    ax_west.set_xlim(-margin_wx, D + 22)
    ax_west.set_ylim(-2, max(max_h_w + 3, H + 14))
    ax_west.set_aspect('equal')
    ax_west.text(-margin_wx + 0.5, max(max_h_w + 1.5, H + 12.5), 'WEST ELEVATION',
                 fontsize=7, fontweight='bold', fontfamily='monospace', color=BRAND["dark"])
    ax_west.text(-margin_wx + 0.5, max(max_h_w + 0.3, H + 11.3), 'SCALE: 1/4" = 1\'-0"',
                 fontsize=4, fontfamily='monospace', color=BRAND["mute"])

    # Sheet label
    fig.text(0.5, 0.02,
             f'SHEET A-2  |  EXTERIOR ELEVATIONS  |  {format_feet_inches(W)} × {format_feet_inches(D)}  |  simpleblueprints.xyz',
             ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"])


# ============================================================
# TEST
# ============================================================
def main():
    test_configs = [
        {
            "name": "small_12x10_2ft_front_stairs",
            "params": {
                "width": 12, "depth": 10, "height": 2, "attachment": "ledger",
                "joistSpacing": 16, "snowLoad": "none", "frostZone": "warm",
                "deckingType": "pt_lumber", "hasStairs": True, "stairLocation": "front",
                "railType": "wood",
            }
        },
        {
            "name": "medium_20x14_4ft_right_stairs",
            "params": {
                "width": 20, "depth": 14, "height": 4, "attachment": "ledger",
                "joistSpacing": 16, "snowLoad": "light", "frostZone": "moderate",
                "deckingType": "composite", "hasStairs": True, "stairLocation": "right",
                "railType": "fortress",
            }
        },
        {
            "name": "large_35x10_9ft_no_stairs",
            "params": {
                "width": 35, "depth": 10, "height": 9.3, "attachment": "ledger",
                "joistSpacing": 16, "snowLoad": "moderate", "frostZone": "cold",
                "deckingType": "composite", "hasStairs": False, "stairLocation": "front",
                "railType": "fortress",
            }
        },
    ]

    output = "/home/claude/test_elevation_sheets.pdf"

    with PdfPages(output) as pdf:
        for cfg in test_configs:
            print(f"Drawing elevations: {cfg['name']}...")
            calc = calculate_structure(cfg["params"])

            fig = plt.figure(figsize=(14, 8.5))
            fig.set_facecolor('white')

            draw_elevations_sheet(fig, cfg["params"], calc)

            fig.text(0.5, 0.97,
                     f'TEST: {cfg["name"]}  —  H={calc["height"]}\' | '
                     f'{calc["post_size"]} × {calc["num_posts"]} posts | '
                     f'{calc["beam_size"]} beam | {calc["footing_diam"]}" piers @ {calc["footing_depth"]}"',
                     ha='center', fontsize=7, fontfamily='monospace', color=BRAND["red"],
                     bbox=dict(boxstyle='square,pad=0.3', fc='#fff8f0', ec=BRAND["red"], lw=0.5))

            pdf.savefig(fig, dpi=200)
            plt.close(fig)

    print(f"\nSaved 3 elevation sheets to {output}")


if __name__ == "__main__":
    main()
