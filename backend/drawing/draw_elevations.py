#!/usr/bin/env python3
"""
SimpleBlueprints — Parametric PDF Drawing Engine
Step 1c: Elevation Views (Sheet 2 of 4)
South elevation (front) + North elevation (side)
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


def draw_grade_line(ax, x1, x2, y):
    """Draw ground line with hatch marks"""
    ax.plot([x1, x2], [y, y], color=BRAND["dark"], lw=1)
    for i in np.arange(x1, x2, 0.3):
        ax.plot([i, i - 0.2], [y, y - 0.2], color=BRAND["mute"], lw=0.2)


def draw_house_elevation(ax, house_x, house_w, ground_y, height):
    """Draw simplified house behind deck in elevation view"""
    # Estimate house proportions from deck height
    # If deck height is low (<3'), assume 1-story ranch
    # If high (>6'), assume 2-story
    if height < 4:
        foundation_h = height + 1
        floor1_h = 8.5
        floor2_h = 0
    elif height < 8:
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
    # Siding
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
    # 1st floor
    ax.add_patch(patches.Rectangle((house_x + house_w * 0.1, f1_y + 1.5),
                 house_w * 0.15, 4, **win_kw))
    ax.add_patch(patches.Rectangle((house_x + house_w * 0.45, f1_y + 2),
                 house_w * 0.1, 3, **win_kw))
    ax.add_patch(patches.Rectangle((house_x + house_w * 0.75, f1_y + 2),
                 house_w * 0.08, 2.5, **win_kw))
    # 2nd floor
    if floor2_h > 0:
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
            ha='center', fontsize=5.5, color=BRAND["mute"])

    return total_wall, roof_peak


def draw_south_elevation(ax, params, calc):
    """Front elevation showing deck width, posts, beam, railing"""
    W = calc["width"]
    D = calc["depth"]
    H = calc["height"]

    ground_y = 0
    deck_x = 0.5  # slight offset from house

    # House behind
    house_x = deck_x + (W - min(W, 30)) / 2  # center house, max 30' wide
    house_w = min(W, 30)
    total_wall, roof_peak = draw_house_elevation(ax, house_x, house_w, ground_y, H)

    # Grade line
    draw_grade_line(ax, -3, W + 5, ground_y)

    deck_top = H

    # === POSTS ===
    for px in calc["post_positions"]:
        sx = deck_x + px
        # Pier
        ax.add_patch(patches.Rectangle((sx - 0.5, ground_y - 0.4), 1.0, 0.4,
                     fc=BRAND["concrete"], ec=BRAND["dark"], lw=0.5))
        # Post base plate
        ax.add_patch(patches.Rectangle((sx - 0.35, ground_y), 0.7, 0.2,
                     fc='#888', ec=BRAND["dark"], lw=0.4))
        # Post
        ax.plot([sx, sx], [ground_y + 0.2, deck_top], color=BRAND["post"], lw=2)

    # === BEAM ===
    beam_h = 1.0  # visual height
    beam_type = calc.get("beam_type", "dropped")
    if beam_type == "flush":
        # Flush beam: inline with joists, top of beam = deck_top, posts reach deck underside
        beam_y = deck_top - beam_h
        # Flush beam: single dashed hidden line at bottom of joist zone per IRC blueprint convention
        beam_bottom = deck_top - beam_h
        ax.plot([deck_x + 1, deck_x + W - 1], [beam_bottom, beam_bottom],
                color=BRAND["beam"], lw=1.5, linestyle=(0, (8, 4)), zorder=4)
        # Re-draw posts to reach joist bottom (deck_top - joist_h)
        for px in calc["post_positions"]:
            sx = deck_x + px
            ax.plot([sx, sx], [ground_y + 0.2, deck_top - beam_h], color=BRAND["post"], lw=2)
    else:
        # Dropped beam: sits below joists, posts reach beam bottom
        ax.add_patch(patches.Rectangle((deck_x + 1, deck_top - beam_h - 0.1), W - 2, beam_h,
                     fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))

    # === JOISTS (visible as small rectangles from front) ===
    joist_sp = calc["joist_spacing"] / 12
    for jx in np.arange(0, W, joist_sp):
        ax.add_patch(patches.Rectangle((deck_x + jx - 0.04, deck_top - 0.8), 0.08, 0.68,
                     fc=BRAND["wood"], ec=BRAND["dark"], lw=0.15))

    # === DECK SURFACE ===
    ax.plot([deck_x, deck_x + W], [deck_top, deck_top], color='#6B5340', lw=2.5)

    # === RAILING ===
    rail_h = calc["rail_height"] / 12  # convert inches to feet
    rail_top = deck_top + rail_h

    ax.plot([deck_x, deck_x + W], [rail_top, rail_top], color=BRAND["rail"], lw=2)
    ax.plot([deck_x, deck_x + W], [deck_top + 0.25, deck_top + 0.25], color=BRAND["rail"], lw=0.8)

    # Rail posts
    for rpx in np.arange(0, W + 0.1, 4):
        ax.plot([deck_x + rpx, deck_x + rpx], [deck_top, rail_top], color=BRAND["rail"], lw=1)

    # Balusters
    for bx in np.arange(0, W, 3.75 / 12):
        ax.plot([deck_x + bx, deck_x + bx], [deck_top + 0.25, rail_top],
                color=BRAND["rail"], lw=0.12, alpha=0.5)

    # === STAIRS (if front) - seen head-on, show stepped profile ===
    if params.get("hasStairs") and params.get("stairLocation") == "front" and calc.get("stairs"):
        stair = calc["stairs"]
        sw = stair.get("width", 4)
        stair_x = deck_x + W / 2 - sw / 2 + params.get("stairOffset", 0)
        rise_per = stair["actual_rise"] / 12  # feet per step
        n_risers = stair["num_risers"]

        # Draw stepped profile: stairs descend from deck_top down to ground
        for i in range(n_risers):
            ty = deck_top - i * rise_per  # each step down from deck level
            # Tread (horizontal line)
            ax.plot([stair_x, stair_x + sw], [ty, ty], color=BRAND["dark"], lw=0.8)
            # Riser (vertical line down to next tread)
            ax.plot([stair_x, stair_x], [ty, ty - rise_per], color=BRAND["dark"], lw=0.5)
            ax.plot([stair_x + sw, stair_x + sw], [ty, ty - rise_per], color=BRAND["dark"], lw=0.5)

        # Bottom tread at ground
        ax.plot([stair_x, stair_x + sw], [ground_y, ground_y], color=BRAND["dark"], lw=0.8)

        # Stringer label
        if stair.get("has_landing"):
            pad_w = sw + 1
            ax.add_patch(patches.Rectangle((stair_x - 0.5, ground_y), pad_w, 0.3,
                         fc='#e8e8e0', ec=BRAND["dark"], lw=0.4))

        # Handrails on both sides
        rail_h = 3  # 36" rail height in feet
        ax.plot([stair_x, stair_x], [deck_top, deck_top - rail_h / 12],
                color=BRAND["dark"], lw=0.3, ls='--')
        ax.plot([stair_x + sw, stair_x + sw], [deck_top, deck_top - rail_h / 12],
                color=BRAND["dark"], lw=0.3, ls='--')

    # === LABELS ===
    lbl_x = deck_x + W + 1.5
    lbl_kw = dict(fontsize=4.5, fontfamily='monospace', color=BRAND["dark"])

    ax.text(lbl_x, rail_top - 0.3, f'{calc["rail_height"]}" GUARD RAIL SYSTEM', **lbl_kw)
    ax.text(lbl_x, deck_top - beam_h / 2 - 0.2, f'{calc["beam_size"].upper()}', **lbl_kw)
    ax.text(lbl_x, deck_top - beam_h / 2 - 0.8, 'FLUSH BEAM' if beam_type == 'flush' else 'DROPPED BEAM', **lbl_kw)
    ax.text(lbl_x, H * 0.4, f'{calc["post_size"]} PT POSTS', **lbl_kw)
    ax.text(lbl_x, H * 0.4 - 0.6, f'SIMPSON HARDWARE', **lbl_kw)
    ax.text(lbl_x, H * 0.4 - 1.2, f'({calc["num_posts"]}) PLCS', **lbl_kw)
    ax.text(lbl_x, -0.5, f'{calc["footing_diam"]}" Ø PIERS', **lbl_kw)
    ax.text(lbl_x, -1.1, f'X {calc["footing_depth"]}" DEEP', **lbl_kw)

    # === DIMENSIONS ===
    draw_dimension_v(ax, deck_x - 1, ground_y, deck_top,
                     format_feet_inches(H), offset=-3.5, color=BRAND["blue"], fontsize=6)
    draw_dimension_v(ax, deck_x + W + 0.5, deck_top, rail_top,
                     f'{calc["rail_height"]}"', offset=7, color=BRAND["ledger_green"], fontsize=5)

    return total_wall + roof_peak  # return max height for axis limits


def draw_north_elevation(ax, params, calc):
    """Side elevation showing deck depth, single post line, beam, ledger connection"""
    W = calc["width"]
    D = calc["depth"]
    H = calc["height"]
    attachment = calc["attachment"]

    ground_y = 0

    # House (side view)
    house_d = 12  # visual house depth
    house_x = 2

    if H < 4:
        house_h = H + 1 + 8.5
    elif H < 8:
        house_h = H + 1 + 8.5
    else:
        house_h = H + 1 + 8.5 + 8

    roof_peak = 5.5

    # House side wall
    ax.add_patch(patches.Rectangle((house_x, ground_y), house_d, house_h,
                 fc=BRAND["house"], ec=BRAND["dark"], lw=1))
    for sy in np.arange(ground_y + H + 1.5, ground_y + house_h, 0.5):
        ax.plot([house_x, house_x + house_d], [sy, sy], color=BRAND["light"], lw=0.15)

    # Roof
    roof_base = ground_y + house_h
    verts = [(house_x - 1.5, roof_base),
             (house_x + house_d / 2, roof_base + roof_peak),
             (house_x + house_d + 1.5, roof_base)]
    ax.add_patch(Polygon(verts, fc='#888', ec=BRAND["dark"], lw=1.5))
    ax.text(house_x + house_d / 2, roof_base + 1.5, 'EXISTING HOUSE',
            ha='center', fontsize=5.5, color=BRAND["mute"])

    # Grade
    draw_grade_line(ax, -2, house_x + house_d + D + 5, ground_y)

    deck_top = H
    deck_start_x = house_x + house_d  # where deck begins (at house wall)

    # === POST (far end) ===
    post_x = deck_start_x + D - 1.5
    # Pier
    ax.add_patch(patches.Rectangle((post_x - 0.5, ground_y - 0.4), 1.0, 0.4,
                 fc=BRAND["concrete"], ec=BRAND["dark"], lw=0.5))
    ax.add_patch(patches.Rectangle((post_x - 0.35, ground_y), 0.7, 0.2,
                 fc='#888', ec=BRAND["dark"], lw=0.4))
    ax.plot([post_x, post_x], [ground_y + 0.2, deck_top], color=BRAND["post"], lw=2)

    # === BEAM ===
    beam_h = 1.0
    beam_type_side = calc.get("beam_type", "dropped")
    if beam_type_side == "flush":
        ax.add_patch(patches.Rectangle((deck_start_x, deck_top - beam_h), D - 0.5, beam_h,
                     fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))
    else:
        ax.add_patch(patches.Rectangle((deck_start_x, deck_top - beam_h - 0.1), D - 0.5, beam_h,
                     fc=BRAND["beam"], ec=BRAND["dark"], lw=0.8, alpha=0.85))

    # === LEDGER CONNECTION ===
    if attachment == "ledger":
        ax.plot([deck_start_x, deck_start_x], [deck_top - 1, deck_top],
                color=BRAND["ledger_green"], lw=2.5)
        ax.text(deck_start_x + 0.3, deck_top - 0.5, 'LEDGER',
                fontsize=4, color=BRAND["ledger_green"], rotation=90, va='center')

    # === DECK SURFACE ===
    ax.plot([deck_start_x, deck_start_x + D], [deck_top, deck_top], color='#6B5340', lw=2.5)

    # === RAILING ===
    rail_h = calc["rail_height"] / 12
    rail_top = deck_top + rail_h

    ax.plot([deck_start_x, deck_start_x + D], [rail_top, rail_top],
            color=BRAND["rail"], lw=2)
    ax.plot([deck_start_x, deck_start_x + D], [deck_top + 0.25, deck_top + 0.25],
            color=BRAND["rail"], lw=0.8)

    # End posts
    ax.plot([deck_start_x, deck_start_x], [deck_top, rail_top], color=BRAND["rail"], lw=1.2)
    ax.plot([deck_start_x + D, deck_start_x + D], [deck_top, rail_top], color=BRAND["rail"], lw=1.2)

    # Balusters
    for bx in np.arange(0, D, 3.75 / 12):
        ax.plot([deck_start_x + bx, deck_start_x + bx], [deck_top + 0.25, rail_top],
                color=BRAND["rail"], lw=0.15, alpha=0.5)

    # === STAIRS (if left or right — shown in side view) ===
    if params.get("hasStairs") and calc.get("stairs"):
        stair = calc["stairs"]
        stair_loc = params.get("stairLocation", "front")
        
        if stair_loc in ("left", "right"):
            # In side view, stairs extend outward from the deck edge
            # Right stairs: extend past the far edge of deck
            # Left stairs: extend before the near edge of deck
            if stair_loc == "right":
                sx = deck_start_x + D
                direction = 1
            else:
                sx = deck_start_x
                direction = -1
            
            rise = stair["actual_rise"] / 12
            run = stair["tread_depth"] / 12

            # Draw stepped profile (horizontal treads + vertical risers)
            for i in range(stair["num_treads"]):
                tx = sx + direction * i * run
                ty = deck_top - i * rise
                # Tread (horizontal)
                ax.plot([tx, tx + direction * run], [ty, ty], color=BRAND["dark"], lw=0.6)
                # Riser (vertical down)
                next_ty = deck_top - (i + 1) * rise
                ax.plot([tx + direction * run, tx + direction * run], [ty, next_ty],
                        color=BRAND["dark"], lw=0.6)

            # Bottom tread at ground
            end_x = sx + direction * stair["num_treads"] * run
            ax.plot([end_x - direction * run, end_x], [ground_y, ground_y], color=BRAND["dark"], lw=0.6)

            # Stringer (diagonal)
            ax.plot([sx, end_x], [deck_top, ground_y], color=BRAND["dark"], lw=0.8)

            # Handrails (dashed)
            rail_h_ft = 3
            ax.plot([sx, end_x], [deck_top + rail_h_ft, ground_y + rail_h_ft],
                    color=BRAND["dark"], lw=0.4, ls='--')

    # === LABELS ===
    lbl_x = deck_start_x + D + 2
    lbl_kw = dict(fontsize=4.5, fontfamily='monospace', color=BRAND["dark"])

    ax.text(lbl_x, rail_top - 0.3, f'{calc["rail_height"]}" GUARD RAIL', **lbl_kw)
    ax.text(lbl_x, deck_top - beam_h / 2, f'{calc["beam_size"].upper()}', **lbl_kw)
    ax.text(lbl_x, deck_top - beam_h / 2 - 0.6, 'BEAM', **lbl_kw)
    ax.text(lbl_x, H * 0.4, f'{calc["post_size"]} PT POST', **lbl_kw)
    ax.text(lbl_x, -0.5, f'{calc["footing_diam"]}" Ø PIER', **lbl_kw)

    # === DIMENSIONS ===
    draw_dimension_v(ax, deck_start_x + D + 0.5, ground_y, deck_top,
                     format_feet_inches(H), offset=7, color=BRAND["blue"], fontsize=6)
    draw_dimension_h(ax, deck_start_x, deck_start_x + D, deck_top,
                     format_feet_inches(D), offset=max(rail_h + 1.5, 3), color=BRAND["red"], fontsize=6)

    return house_h + roof_peak


# ============================================================
# SHEET 2: COMBINED ELEVATIONS
# ============================================================
def draw_elevations_sheet(fig, params, calc):
    """Draw south (top) and north (bottom) elevations"""

    ax1, ax2 = fig.subplots(2, 1)
    fig.subplots_adjust(left=0.05, right=0.95, top=0.93, bottom=0.05, hspace=0.25)

    W = calc["width"]
    D = calc["depth"]
    H = calc["height"]

    # === SOUTH ELEVATION (top) ===
    ax1.set_facecolor('white')
    ax1.axis('off')

    max_h = draw_south_elevation(ax1, params, calc)

    margin_x = max(W * 0.15, 5)
    ax1.set_xlim(-margin_x, W + margin_x + 2)
    ax1.set_ylim(-2, max(max_h + 4, H + 15))
    ax1.set_aspect('equal')

    ax1.text(-margin_x + 1, max(max_h + 2, H + 13), 'SOUTH ELEVATION',
             fontsize=10, fontweight='bold', fontfamily='monospace', color=BRAND["dark"])
    ax1.text(-margin_x + 1, max(max_h + 0.8, H + 11.8), 'SCALE: 1/4" = 1\'-0"',
             fontsize=5.5, fontfamily='monospace', color=BRAND["mute"])

    draw_scale_bar(ax1, 0, -1.5)

    # === NORTH ELEVATION (bottom) ===
    ax2.set_facecolor('white')
    ax2.axis('off')

    max_h2 = draw_north_elevation(ax2, params, calc)

    margin_x2 = max(D * 0.3, 4)
    ax2.set_xlim(-margin_x2, D + 25)
    ax2.set_ylim(-2, max(max_h2 + 4, H + 15))
    ax2.set_aspect('equal')

    ax2.text(-margin_x2 + 1, max(max_h2 + 2, H + 13), 'NORTH ELEVATION (SIDE VIEW)',
             fontsize=10, fontweight='bold', fontfamily='monospace', color=BRAND["dark"])
    ax2.text(-margin_x2 + 1, max(max_h2 + 0.8, H + 11.8), 'SCALE: 1/4" = 1\'-0"',
             fontsize=5.5, fontfamily='monospace', color=BRAND["mute"])

    draw_scale_bar(ax2, 0, -1.5)

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
            "name": "small_12x10_2ft",
            "params": {
                "width": 12, "depth": 10, "height": 2, "attachment": "ledger",
                "joistSpacing": 16, "snowLoad": "none", "frostZone": "warm",
                "deckingType": "pt_lumber", "hasStairs": True, "stairLocation": "front",
                "railType": "wood",
            }
        },
        {
            "name": "medium_20x14_4ft",
            "params": {
                "width": 20, "depth": 14, "height": 4, "attachment": "ledger",
                "joistSpacing": 16, "snowLoad": "light", "frostZone": "moderate",
                "deckingType": "composite", "hasStairs": True, "stairLocation": "right",
                "railType": "fortress",
            }
        },
        {
            "name": "large_35x10_9ft",
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
