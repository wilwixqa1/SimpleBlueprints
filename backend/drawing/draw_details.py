#!/usr/bin/env python3
"""
SimpleBlueprints - Parametric PDF Drawing Engine
Step 1d: Structural Details (Sheet 3 of 4)
Ledger detail, footing detail, guard rail detail, post/beam connection
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.backends.backend_pdf import PdfPages
import numpy as np
import math

from .calc_engine import calculate_structure
from .draw_plan import BRAND, draw_dimension_h, draw_dimension_v, format_feet_inches


def draw_ledger_detail(ax, params, calc, spec=None):
    """Ledger-to-house connection cross section"""
    ax.set_xlim(-3, 16)
    ax.set_ylim(-4, 13)  # S57: increased from 12 to prevent title clipping
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_facecolor('white')

    ax.text(-2, 11, 'LEDGER DETAIL', fontsize=9, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])
    ax.text(-2, 10, 'NOT TO SCALE', fontsize=5, fontfamily='monospace', color=BRAND["mute"])

    ledger_size = spec["ledger"]["size"] if spec else calc["ledger_size"]
    joist_size = spec["joists"]["size"] if spec else calc["joist_size"]
    joist_hanger_model = spec["hardware"]["joist_hanger"]["model"] if spec else "JOIST HANGER"

    # House wall section
    ax.add_patch(patches.Rectangle((0, -2), 2, 12, fc=BRAND["house"], ec=BRAND["dark"], lw=1.2))
    ax.text(1, 8.5, 'HOUSE\nWALL', ha='center', fontsize=5, color=BRAND["mute"])

    # Sheathing
    ax.add_patch(patches.Rectangle((2, -2), 0.5, 12, fc='#ddd4c0', ec=BRAND["dark"], lw=0.5))

    # Flashing
    ax.plot([1.8, 2.5, 2.5, 3.5], [7.5, 7.5, 7, 7], color=BRAND["blue"], lw=1.5)
    ax.text(0.5, 7.8, 'FLASHING', fontsize=4.5, color=BRAND["blue"], fontweight='bold')

    # Rim joist
    ax.add_patch(patches.Rectangle((2.5, 1), 1.5, 8, fc=BRAND["wood"], ec=BRAND["dark"], lw=0.8))
    ax.text(3.25, 5, 'RIM\nJOIST', ha='center', fontsize=4, color='#666')

    # Ledger board
    ax.add_patch(patches.Rectangle((4, 1.5), 1.2, 7, fc=BRAND["post"], ec=BRAND["dark"], lw=1))
    ax.text(8.5, 5, f'{ledger_size} PT\nLEDGER', fontsize=5, fontweight='bold', color=BRAND["dark"])
    ax.annotate('', xy=(5.2, 5), xytext=(8.3, 5),
                arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=0.5))

    # Ledger locks
    bolt_positions = [3, 5, 7]
    for by in bolt_positions:
        ax.plot([2, 5.2], [by, by], color=BRAND["red"], lw=1.5)
        ax.plot(2.5, by, 'o', ms=3, color=BRAND["red"])
        ax.plot(5.2, by, 'o', ms=3, color=BRAND["red"])
    _fastener = spec["hardware"]["ledger_fastener"] if spec else {"size": '5"', "spacing": 16}
    ax.text(8.5, 3, f'(2) {_fastener["size"]} LEDGER\nLOCKS @ {_fastener["spacing"]}" O.C.',
            fontsize=4.5, fontweight='bold', color=BRAND["red"])

    # Joist
    ax.add_patch(patches.Rectangle((5.2, 1.8), 0.8, 6.4, fc=BRAND["wood"], ec=BRAND["dark"], lw=0.6))
    ax.text(8.5, 7.5, f'{joist_size} JOIST', fontsize=4.5, color=BRAND["dark"])
    ax.annotate('', xy=(6, 7.5), xytext=(8.3, 7.5),
                arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=0.5))

    # Decking on top
    if params["deckingType"] == "composite":
        deck_label = '1x6 TREX\nCOMPOSITE'
    else:
        deck_label = '5/4x6 PT\nDECKING'
    ax.add_patch(patches.Rectangle((3.5, 8.5), 4, 0.35, fc='#8B7355', ec=BRAND["dark"], lw=0.6))
    ax.text(8.5, 8.8, deck_label, fontsize=4.5, color=BRAND["dark"])

    # Joist hanger
    ax.plot([5.2, 5.2, 6, 6], [2, 1.5, 1.5, 2], color='#888', lw=1.5)
    ax.text(5.4, 0.8, f"SIMPSON '{joist_hanger_model}'", fontsize=3.5, color=BRAND["mute"])

    # Joist tape
    ax.add_patch(patches.Rectangle((5.2, 8.2), 0.8, 0.3, fc='#555', ec=BRAND["dark"], lw=0.3))
    ax.text(8.5, 8.2, 'JOIST TAPE', fontsize=3.5, color=BRAND["mute"])


def draw_footing_detail(ax, params, calc, spec=None):
    """Concrete pier footing cross section"""
    ax.set_xlim(-3, 16)
    ax.set_ylim(-9, 10)
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_facecolor('white')

    ax.text(-2, 9, 'FOOTING DETAIL', fontsize=9, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])
    ax.text(-2, 8, 'NOT TO SCALE', fontsize=5, fontfamily='monospace', color=BRAND["mute"])

    post_size = spec["posts"]["size"] if spec else calc["post_size"]
    footing_diam = spec["footings"]["diameter"] if spec else calc["footing_diam"]
    footing_depth = spec["footings"]["depth"] if spec else calc["footing_depth"]
    post_base_model = spec["hardware"]["post_base"]["model"] if spec else ("ABU66Z" if post_size == "6x6" else "ABU44Z")

    # Ground
    ax.plot([-2, 14], [0, 0], color=BRAND["dark"], lw=1)
    for i in np.arange(-2, 14, 0.25):
        ax.plot([i, i - 0.15], [0, -0.15], color=BRAND["mute"], lw=0.2)

    # Pier depth as proportion
    pier_visual_depth = 5.5  # visual, not to scale
    pier_width = 4.5

    # Concrete pier
    ax.add_patch(patches.Rectangle((3, -pier_visual_depth), pier_width, pier_visual_depth,
                 fc=BRAND["concrete"], ec=BRAND["dark"], lw=1))
    # Below grade hatching
    ax.add_patch(patches.Rectangle((3, -pier_visual_depth), pier_width, pier_visual_depth * 0.75,
                 fc=BRAND["concrete"], ec=BRAND["mute"], lw=0.8, ls='--'))

    ax.text(3 + pier_width / 2, -pier_visual_depth / 2,
            f'{footing_diam}" DIA.\nCONCRETE\nPIER', ha='center', fontsize=5, color='#555')

    # Grade label
    ax.text(11, 0.3, 'GRADE', fontsize=4.5, color=BRAND["dark"])

    # Gravel base
    ax.add_patch(patches.Rectangle((3, -pier_visual_depth - 0.5), pier_width, 0.5,
                 fc='#d4d0c0', ec=BRAND["dark"], lw=0.5))
    ax.text(10, -pier_visual_depth - 0.3, '3" GRAVEL BASE', fontsize=4, color=BRAND["mute"])

    # Post base hardware
    ax.add_patch(patches.Rectangle((3.5, 0), pier_width - 1, 0.5,
                 fc='#888', ec=BRAND["dark"], lw=0.8))
    ax.text(10, 1.2, f"SIMPSON '{post_base_model}'\nPOST BASE", fontsize=4.5, color=BRAND["dark"])

    # Post
    post_visual_w = 2.2 if post_size == "6x6" else 1.5
    ax.add_patch(patches.Rectangle((3 + (pier_width - post_visual_w) / 2, 0.5),
                 post_visual_w, 6, fc=BRAND["post"], ec=BRAND["dark"], lw=1))
    ax.text(10, 4.5, f'{post_size} PT POST', fontsize=5, fontweight='bold', color=BRAND["dark"])

    # Rebar (subtle, not the visual focus)
    ax.plot([4, 4], [-pier_visual_depth + 0.5, 0], color='#b04040', lw=0.5, ls='--')
    ax.plot([6, 6], [-pier_visual_depth + 0.5, 0], color='#b04040', lw=0.5, ls='--')
    ax.text(10, -2, '#4 REBAR', fontsize=4, color='#b04040')

    # Frost line
    frost_visual = min(pier_visual_depth * 0.3, 2)
    ax.plot([-1, 14], [-frost_visual, -frost_visual], color=BRAND["blue"], lw=0.5, ls='-.')
    ax.text(10, -frost_visual, 'FROST LINE', fontsize=4, color=BRAND["blue"])

    # Dimensions
    draw_dimension_v(ax, 1.5, -pier_visual_depth, 0,
                     f'{footing_depth}" MIN.', offset=-2, color=BRAND["blue"], fontsize=5)
    draw_dimension_h(ax, 3, 3 + pier_width, -pier_visual_depth,
                     f'{footing_diam}" DIA.', offset=-2, color=BRAND["red"], fontsize=5)


def draw_guard_rail_detail(ax, params, calc, spec=None):
    """Guard rail cross section / front view"""
    ax.set_xlim(-2, 18)
    ax.set_ylim(-2, 10)
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_facecolor('white')

    ax.text(-1, 9, 'GUARD RAIL DETAIL', fontsize=9, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])
    ax.text(-1, 8.2, 'NOT TO SCALE', fontsize=5, fontfamily='monospace', color=BRAND["mute"])

    rail_height = spec["guardrail"]["height"] if spec else calc.get("rail_height", 36)

    rail_visual_h = 6.0  # visual rail height

    # Deck surface
    ax.add_patch(patches.Rectangle((0, 0), 14, 0.4, fc='#8B7355', ec=BRAND["dark"], lw=0.8))
    ax.text(7, -0.6, 'DECK SURFACE', ha='center', fontsize=4, color=BRAND["mute"])

    # Rail posts
    for rpx in [0.5, 13.5]:
        ax.add_patch(patches.Rectangle((rpx, 0.4), 0.5, rail_visual_h,
                     fc=BRAND["rail"], ec=BRAND["dark"], lw=0.6))

    # Top rail
    ax.add_patch(patches.Rectangle((0, rail_visual_h), 14, 0.4,
                 fc=BRAND["rail"], ec=BRAND["dark"], lw=0.8))
    ax.text(15, rail_visual_h + 0.1, 'TOP RAIL', fontsize=4.5, color=BRAND["dark"])

    # Bottom rail
    ax.add_patch(patches.Rectangle((0, 0.8), 14, 0.25,
                 fc=BRAND["rail"], ec=BRAND["dark"], lw=0.6))
    ax.text(15, 0.9, 'BOTTOM RAIL', fontsize=4.5, color=BRAND["dark"])

    # Balusters
    for bx in np.arange(1.5, 13.5, 0.9):
        ax.add_patch(patches.Rectangle((bx, 1.05), 0.15, rail_visual_h - 0.65,
                     fc=BRAND["rail"], ec=BRAND["rail"], lw=0.3))

    # Rail type label
    if params["railType"] == "fortress":
        rail_name = "'FORTRESS'\nFE26 IRON\nRAIL SYSTEM"
    else:
        rail_name = "WOOD\nGUARD RAIL\nSYSTEM"
    ax.text(15, 3.5, rail_name, fontsize=5, fontweight='bold', color=BRAND["dark"])

    # Dimensions
    draw_dimension_v(ax, -0.5, 0, rail_visual_h + 0.4,
                     f'{rail_height}" MIN.', offset=-1.5, color=BRAND["red"], fontsize=5)

    # 4" sphere test
    sphere_r = 0.35
    baluster_start = 1.5
    baluster_spacing = 0.9
    baluster_w = 0.15
    sphere_cx = baluster_start + baluster_spacing / 2 + baluster_w / 2
    sphere_cy = (1.05 + rail_visual_h) / 2
    ax.add_patch(plt.Circle((sphere_cx, sphere_cy), sphere_r, fc='none', ec=BRAND["red"], lw=0.8, ls='--'))
    ax.text(sphere_cx + 0.5, sphere_cy - 0.2, '< 4" MUST NOT ALLOW\nPASSAGE OF 4" SPHERE',
            fontsize=4, color=BRAND["red"])


def draw_post_beam_detail(ax, params, calc, spec=None):
    """Post cap to beam connection detail"""
    ax.set_xlim(-2, 16)
    ax.set_ylim(-3, 10)
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_facecolor('white')

    ax.text(-1, 9, 'POST / BEAM CONNECTION', fontsize=8, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])
    ax.text(-1, 8.2, 'NOT TO SCALE', fontsize=5, fontfamily='monospace', color=BRAND["mute"])

    post_size = spec["posts"]["size"] if spec else calc["post_size"]
    beam_size = spec["beam"]["size"] if spec else calc["beam_size"]
    joist_size = spec["joists"]["size"] if spec else calc["joist_size"]
    cap_model = spec["hardware"]["post_cap"]["model"] if spec else ("BCS2-3/6" if post_size == "6x6" else "BC4")
    is_lvl = spec["beam"]["is_lvl"] if spec else ("LVL" in beam_size)

    # Post
    post_w = 2.2 if post_size == "6x6" else 1.5
    ax.add_patch(patches.Rectangle((3, -2), post_w, 6,
                 fc=BRAND["post"], ec=BRAND["dark"], lw=1))
    ax.text(9, 0.5, f'{post_size} PT POST', fontsize=5, fontweight='bold', color=BRAND["dark"])

    # Post cap
    ax.add_patch(patches.Rectangle((2.5, 4), post_w + 1, 0.5,
                 fc='#888', ec=BRAND["dark"], lw=0.8))
    ax.text(9, 4, f"SIMPSON '{cap_model}'\nPOST CAP", fontsize=4.5, color=BRAND["dark"])

    # Beam
    beam_y = 4.5
    beam_visual_w = 7

    plies = 3 if "3-ply" in beam_size else 2
    ax.add_patch(patches.Rectangle((1, beam_y), beam_visual_w, 2.5,
                 fc=BRAND["beam"], ec=BRAND["dark"], lw=1))

    ply_spacing = beam_visual_w / plies
    for p in range(1, plies):
        px = 1 + p * ply_spacing
        ax.plot([px, px], [beam_y, beam_y + 2.5], color='#9a8030', lw=0.5)

    if is_lvl:
        beam_label = f'({plies}) 1-3/4" x 11-7/8"\n2.0E LVL EXT. GRADE'
    else:
        beam_lumber = beam_size.split(" ", 1)[1] if " " in beam_size else beam_size
        beam_label = f'({plies}) {beam_lumber}\nPT BEAM'

    ax.text(9, 5.5, beam_label, fontsize=4.5, fontweight='bold', color=BRAND["dark"])

    # Joist on top
    ax.add_patch(patches.Rectangle((0.5, 7), 8, 0.8,
                 fc=BRAND["wood"], ec=BRAND["dark"], lw=0.6))
    ax.text(9, 7.2, f'{joist_size} DECK JOIST', fontsize=4.5, color=BRAND["dark"])

    # Through bolts
    for by in [5, 5.8, 6.5]:
        ax.plot([1.5, 7.5], [by, by], color=BRAND["mute"], lw=0.3, ls='--')
        ax.plot(1.5, by, 'x', ms=3, color=BRAND["red"], mew=0.8)
        ax.plot(7.5, by, 'x', ms=3, color=BRAND["red"], mew=0.8)

    ax.text(9, 6.5, '1/2" CARRIAGE BOLTS\nW/ NUTS & WASHERS', fontsize=3.5, color=BRAND["mute"])


def draw_stair_landing_detail(ax, params, calc, spec=None):
    """S65: Stair at lower landing detail -- cross section per Billy's reference.
    Parametric: decking type, rail type, guard height. Everything else is standard."""
    ax.set_xlim(-6, 24)
    ax.set_ylim(-5.5, 18)
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_facecolor('white')

    ax.text(-5, 17, 'STAIR AT LOWER LANDING DETAIL', fontsize=7.5, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])
    ax.text(-5, 16, 'NOT TO SCALE', fontsize=5, fontfamily='monospace', color=BRAND["mute"])

    rail_height = spec["guardrail"]["height"] if spec else calc.get("rail_height", 36)
    is_fortress = params.get("railType") == "fortress"
    is_composite = params.get("deckingType") == "composite"

    # === CONCRETE LANDING PAD ===
    pad_x, pad_y = -1, -3
    pad_w, pad_h = 8, 1.2
    ax.add_patch(patches.Rectangle((pad_x, pad_y), pad_w, pad_h,
                 fc=BRAND["concrete"], ec=BRAND["dark"], lw=1.2))
    # Earth hatching below
    for i in np.arange(pad_x - 1, pad_x + pad_w + 1, 0.35):
        ax.plot([i, i - 0.2], [pad_y, pad_y - 0.25], color=BRAND["mute"], lw=0.3)
    ax.text(pad_x + pad_w / 2, pad_y + pad_h / 2, 'MIN. 4" THICK CONCRETE PAD',
            ha='center', va='center', fontsize=4, color='#444', fontweight='bold')
    # Pad width dimension
    draw_dimension_h(ax, pad_x, pad_x + pad_w, pad_y,
                     '12" MIN.', offset=-1.5, color=BRAND["red"], fontsize=4.5)
    # Pad depth dimension (right side)
    draw_dimension_v(ax, pad_x + pad_w, pad_y, pad_y + pad_h,
                     '12" MIN.', offset=1.2, color=BRAND["red"], fontsize=4.5)

    # === 2x6 PT PLATE ON PAD ===
    plate_top = pad_y + pad_h
    plate_h = 0.4
    ax.add_patch(patches.Rectangle((pad_x + 0.5, plate_top), pad_w - 1, plate_h,
                 fc='#a08860', ec=BRAND["dark"], lw=0.7))
    # Expansion bolts in plate
    for bx in np.arange(pad_x + 1.5, pad_x + pad_w - 1, 1.8):
        ax.plot(bx, plate_top + plate_h / 2, 'x', ms=3.5, color=BRAND["red"], mew=1)
    # Plate label (right side)
    ax.text(16, plate_top - 0.5, '2x6 PT W/ 1/2" DIA\nEXPANSION BOLTS @ 16" OC',
            fontsize=4, color=BRAND["dark"], fontfamily='monospace')
    ax.annotate('', xy=(pad_x + pad_w - 1, plate_top + plate_h / 2),
                xytext=(15.8, plate_top - 0.2),
                arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=0.5))

    # === STAIR GEOMETRY ===
    stringer_base_x = pad_x + 1.5
    stringer_base_y = plate_top + plate_h
    n_treads = 5
    rise_vis = 1.5    # visual height per riser
    run_vis = 2.2     # visual depth per tread
    tread_thick = 0.35
    nosing = 0.25     # nosing overhang

    # Deck surface position
    deck_top_y = stringer_base_y + n_treads * rise_vis + 0.8
    deck_left_x = stringer_base_x + n_treads * run_vis

    # === STRINGER (two lines showing board thickness) ===
    str_thick = 0.7
    # Bottom of stringer follows tread notch line
    ang = math.atan2(n_treads * rise_vis, n_treads * run_vis)
    cos_a, sin_a = math.cos(ang), math.sin(ang)
    # Outer stringer line (top edge)
    s_x1 = stringer_base_x - 0.5
    s_y1 = stringer_base_y - 0.2
    s_x2 = deck_left_x + 1.0
    s_y2 = deck_top_y - 0.5
    ax.plot([s_x1, s_x2], [s_y1, s_y2], color=BRAND["dark"], lw=1.2)
    # Inner stringer line (bottom edge, offset perpendicular)
    dx_perp = sin_a * str_thick
    dy_perp = -cos_a * str_thick
    ax.plot([s_x1 + dx_perp, s_x2 + dx_perp], [s_y1 + dy_perp, s_y2 + dy_perp],
            color=BRAND["dark"], lw=1.2)

    # Bottom notch for plate
    notch_x = stringer_base_x - 0.3
    notch_y = stringer_base_y
    ax.plot([notch_x - 0.2, notch_x - 0.2, notch_x + str_thick + 0.1],
            [notch_y + 0.3, notch_y - 0.3, notch_y - 0.3],
            color=BRAND["dark"], lw=0.8)

    # Stringer label (right side with leader)
    ax.text(16, stringer_base_y + 4, '2x12 STRINGER @ 16"',
            fontsize=4, color=BRAND["dark"], fontweight='bold', fontfamily='monospace')
    ax.annotate('', xy=(s_x1 + 3, stringer_base_y + 2.5),
                xytext=(15.8, stringer_base_y + 4),
                arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=0.5))

    # Notch label (right side, below stringer label)
    ax.text(16, stringer_base_y + 1.5, 'NOTCH STRINGER\nFOR PLATE',
            fontsize=4, color=BRAND["dark"], fontfamily='monospace')
    ax.annotate('', xy=(notch_x + 0.5, notch_y),
                xytext=(15.8, stringer_base_y + 1.5),
                arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=0.5))

    # === TREADS AND RISERS ===
    for i in range(n_treads):
        tx = stringer_base_x + i * run_vis
        ty = stringer_base_y + (i + 1) * rise_vis
        # Tread (with nosing overhang)
        ax.add_patch(patches.Rectangle((tx - nosing, ty), run_vis + nosing + 0.15, tread_thick,
                     fc=BRAND["wood"], ec=BRAND["dark"], lw=0.6))
        # Riser (vertical board)
        riser_bottom = ty - rise_vis + tread_thick
        ax.add_patch(patches.Rectangle((tx, riser_bottom), 0.12, rise_vis - tread_thick,
                     fc='#d8cdb8', ec=BRAND["dark"], lw=0.4))

    # 5" min callout at bottom of first riser
    ax.text(stringer_base_x - 1.5, stringer_base_y + 0.8, '5" MIN.',
            fontsize=4, fontweight='bold', color=BRAND["dark"],
            bbox=dict(boxstyle='square,pad=0.1', fc='white', ec=BRAND["border"], lw=0.3))

    # === DECK SURFACE AT TOP ===
    deck_w = 6
    if is_composite:
        deck_label = '1 X 6 TREX COMPOSITE\nDECKING'
    else:
        deck_label = '5/4 X 6 PT\nDECKING'
    ax.add_patch(patches.Rectangle((deck_left_x - 1.5, deck_top_y), deck_w, 0.4,
                 fc='#8B7355', ec=BRAND["dark"], lw=0.8))
    # Joist under deck
    ax.add_patch(patches.Rectangle((deck_left_x - 1.5, deck_top_y - 1.0), deck_w, 1.0,
                 fc=BRAND["wood"], ec=BRAND["dark"], lw=0.5, alpha=0.4))
    # Deck label
    ax.text(16, deck_top_y + 0.8, deck_label,
            fontsize=4, color=BRAND["dark"], fontfamily='monospace')
    ax.annotate('', xy=(deck_left_x + deck_w - 1.5, deck_top_y + 0.2),
                xytext=(15.8, deck_top_y + 0.8),
                arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=0.5))

    # === HANDRAIL SYSTEM ===
    rail_vis_h = 6.5

    # Two posts along the stair
    for pi_idx in [1, 3]:
        px = stringer_base_x + pi_idx * run_vis + 0.3
        py_base = stringer_base_y + pi_idx * rise_vis + tread_thick
        py_top = py_base + rail_vis_h
        ax.add_patch(patches.Rectangle((px - 0.2, py_base), 0.4, rail_vis_h,
                     fc=BRAND["rail"], ec=BRAND["dark"], lw=0.7))

    # Top rail (angled along stair slope)
    tr_x1 = stringer_base_x + 0.5 * run_vis
    tr_y1 = stringer_base_y + 1 * rise_vis + tread_thick + rail_vis_h
    tr_x2 = deck_left_x - 0.5
    tr_y2 = stringer_base_y + n_treads * rise_vis + tread_thick + rail_vis_h * 0.9
    ax.plot([tr_x1, tr_x2], [tr_y1, tr_y2], color=BRAND["rail"], lw=2.5)
    # Bottom rail
    br_y_off = 0.6
    ax.plot([tr_x1, tr_x2], [tr_y1 - rail_vis_h + br_y_off, tr_y2 - rail_vis_h * 0.9 + br_y_off],
            color=BRAND["rail"], lw=1)

    # Balusters between the two posts
    n_bal = 8
    for bi_idx in range(n_bal):
        frac = (bi_idx + 0.5) / n_bal
        bx = tr_x1 + frac * (tr_x2 - tr_x1)
        by_top = tr_y1 + frac * (tr_y2 - tr_y1)
        by_bot = by_top - rail_vis_h * (1 - frac * 0.1) + br_y_off
        ax.plot([bx, bx], [by_bot, by_top], color=BRAND["rail"], lw=0.4, alpha=0.6)

    # 4" sphere test circle between balusters
    sph_frac = 2.5 / n_bal
    sph_x = tr_x1 + sph_frac * (tr_x2 - tr_x1)
    sph_y_top = tr_y1 + sph_frac * (tr_y2 - tr_y1)
    sph_y_bot = sph_y_top - rail_vis_h * (1 - sph_frac * 0.1) + br_y_off
    sph_cy = (sph_y_top + sph_y_bot) / 2
    sph_r = 0.45
    ax.add_patch(plt.Circle((sph_x, sph_cy), sph_r, fc='none', ec=BRAND["red"], lw=0.8, ls='--'))
    ax.text(sph_x + 0.8, sph_cy + 0.3, '< 4"', fontsize=3.5, color=BRAND["red"], fontweight='bold')

    # Rail system label (top-left, above everything)
    if is_fortress:
        rail_label = "'FORTRESS' HANDRAIL SYSTEM"
    else:
        rail_label = "WOOD HANDRAIL SYSTEM"
    ax.text(-5, 14.5, rail_label, fontsize=4.5, fontweight='bold', color=BRAND["dark"])
    ax.annotate('', xy=(tr_x1 + 1, tr_y1 - 0.5),
                xytext=(-2, 14.3),
                arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=0.5))

    # "Must not allow passage of 4" sphere" (left side, below rail label)
    ax.text(-5, sph_cy + 0.3, 'MUST NOT ALLOW PASSAGE\nOF 4" SPHERE',
            fontsize=3.5, color=BRAND["red"], fontweight='bold')
    ax.annotate('', xy=(sph_x - sph_r - 0.2, sph_cy),
                xytext=(-0.5, sph_cy + 0.3),
                arrowprops=dict(arrowstyle='->', color=BRAND["red"], lw=0.5))

    # === DIMENSIONS ===
    # Handrail height dimension (far left, clear of labels)
    _post1_base = stringer_base_y + 1 * rise_vis + tread_thick
    _post1_top = _post1_base + rail_vis_h
    draw_dimension_v(ax, -2, _post1_base, _post1_top,
                     '34" TO 38"\nHANDRAIL\nHEIGHT',
                     offset=-3.5, color=BRAND["blue"], fontsize=4)

    # Guard height at deck (right side)
    draw_dimension_v(ax, deck_left_x + deck_w - 0.5, deck_top_y, deck_top_y + rail_vis_h * 0.75,
                     f'{rail_height}" MIN.',
                     offset=2, color=BRAND["red"], fontsize=4)

    # Rise/run annotation box (upper right)
    ax.text(16, 13, "RISE: 4\" TO 7.75\" MIN.\nRUN: 10.5\"\nTREAD NOSINGS\nBETWEEN .75\" AND 1.25\"\nIF TREADS <11\" WITH\nSOLID RISERS",
            fontsize=3.5, color=BRAND["dark"], fontfamily='monospace', va='top',
            bbox=dict(boxstyle='square,pad=0.3', fc='#fafaf5', ec=BRAND["border"], lw=0.5))

    # 12" min depth label on landing
    draw_dimension_v(ax, pad_x + pad_w + 0.3, pad_y, pad_y + pad_h,
                     '12" MIN.', offset=1.2, color=BRAND["red"], fontsize=4)


def draw_cantilever_detail(ax, params, calc, spec=None):
    """Cantilever detail -- deck extending past foundation line.
    Two stacked views: plan view (top-down) and elevation view (side).
    Standard detail per Billy's reference -- on every application."""
    ax.set_xlim(-3, 17)
    ax.set_ylim(-6, 12)
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_facecolor('white')

    ax.text(-2, 11, 'CANTILEVER DETAILS', fontsize=9, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])
    ax.text(-2, 10, 'NOT TO SCALE', fontsize=5, fontfamily='monospace', color=BRAND["mute"])

    # === LEDGER EXTENSION NOTE (top) ===
    ax.text(-2, 9,
            'Extend ledger 6" and install (3) lags (min)\neach side of beam connection at ledger',
            fontsize=5, color=BRAND["dark"], fontfamily='monospace', fontweight='bold',
            va='top')

    # === PLAN VIEW (top-down) -- upper half ===
    plan_y = 3.5
    plan_h = 4.0

    # House wall (left, full height of plan)
    wall_x = -1
    wall_w = 2.0
    ax.add_patch(patches.Rectangle((wall_x, plan_y), wall_w, plan_h,
                 fc=BRAND["house"], ec=BRAND["dark"], lw=1))
    ax.text(wall_x + wall_w / 2, plan_y + plan_h / 2, 'HOUSE\nWALL',
            ha='center', va='center', fontsize=4.5, color=BRAND["mute"])

    # Ledger board (against wall)
    ledger_x = wall_x + wall_w
    ax.add_patch(patches.Rectangle((ledger_x, plan_y + 0.3), 0.5, plan_h - 0.6,
                 fc=BRAND["post"], ec=BRAND["dark"], lw=0.8))

    # Foundation line (dashed, vertical, partway across deck)
    found_x = 7
    ax.plot([found_x, found_x], [plan_y - 0.3, plan_y + plan_h + 0.3],
            color=BRAND["dark"], lw=1.2, ls='--')
    ax.text(found_x, plan_y + plan_h + 0.6, 'Line of foundation below',
            fontsize=4, color=BRAND["mute"], fontfamily='monospace',
            fontstyle='italic', ha='center')

    # Deck floor area (full extent from ledger to past foundation)
    deck_start = ledger_x + 0.5
    deck_end = 15
    ax.add_patch(patches.Rectangle((deck_start, plan_y + 0.1), deck_end - deck_start, plan_h - 0.2,
                 fc='#f5f0e0', ec=BRAND["dark"], lw=0.8))

    # Joists running perpendicular to ledger (horizontal lines)
    for jy in np.arange(plan_y + 0.7, plan_y + plan_h - 0.3, 0.7):
        ax.plot([deck_start, deck_end], [jy, jy], color=BRAND["wood"], lw=0.5, alpha=0.7)

    # Rim joist at far end
    ax.add_patch(patches.Rectangle((deck_end, plan_y + 0.1), 0.4, plan_h - 0.2,
                 fc=BRAND["wood"], ec=BRAND["dark"], lw=0.6))

    # Cantilever zone shading (past foundation line)
    ax.add_patch(patches.Rectangle((found_x, plan_y + 0.1), deck_end - found_x, plan_h - 0.2,
                 fc=BRAND["red"], ec='none', alpha=0.07))

    # Cantilever zone label
    cant_cx = (found_x + deck_end) / 2
    ax.text(cant_cx, plan_y + plan_h / 2,
            'Cantilever floor\nthat extends past\nfoundation',
            ha='center', va='center', fontsize=4.5, color=BRAND["dark"],
            fontfamily='monospace', fontstyle='italic')

    # "Plan view from the top" sub-label
    ax.text(-2, plan_y - 0.6, 'Plan view from the top',
            fontsize=4, color=BRAND["mute"], fontfamily='monospace', fontstyle='italic')

    # === ELEVATION VIEW (side profile) -- lower half ===
    elev_ground = -3.5

    # Foundation wall (prominent)
    fw_x = 5.5
    fw_w = 2.0
    fw_h = 5.0
    ax.add_patch(patches.Rectangle((fw_x, elev_ground), fw_w, fw_h,
                 fc=BRAND["concrete"], ec=BRAND["dark"], lw=1.2))
    # Diagonal hatching inside foundation
    for hy in np.arange(elev_ground + 0.4, elev_ground + fw_h, 0.5):
        ax.plot([fw_x + 0.2, fw_x + fw_w - 0.2], [hy, hy - 0.25],
                color=BRAND["mute"], lw=0.3)
    ax.text(fw_x + fw_w / 2, elev_ground + fw_h * 0.4, 'FOUNDATION\nWALL',
            ha='center', va='center', fontsize=4, color='#555', fontweight='bold')

    # Deck floor extending from wall past foundation
    deck_elev_y = elev_ground + fw_h
    dk_start = 1
    dk_end = 15.5
    # Joist depth (full structural member)
    joist_h = 1.0
    ax.add_patch(patches.Rectangle((dk_start, deck_elev_y), dk_end - dk_start, joist_h,
                 fc=BRAND["wood"], ec=BRAND["dark"], lw=0.8))
    # Decking on top
    ax.add_patch(patches.Rectangle((dk_start, deck_elev_y + joist_h), dk_end - dk_start, 0.3,
                 fc='#8B7355', ec=BRAND["dark"], lw=0.5))

    # Ledger at house side
    ax.add_patch(patches.Rectangle((dk_start - 0.4, deck_elev_y), 0.4, joist_h,
                 fc=BRAND["post"], ec=BRAND["dark"], lw=0.6))

    # Rim joist at cantilever end
    ax.add_patch(patches.Rectangle((dk_end, deck_elev_y), 0.4, joist_h,
                 fc=BRAND["wood"], ec=BRAND["dark"], lw=0.6))

    # Ground line with hatching
    ax.plot([-2, 16.5], [elev_ground, elev_ground], color=BRAND["dark"], lw=1)
    for gi in np.arange(-2, 16.5, 0.35):
        ax.plot([gi, gi - 0.2], [elev_ground, elev_ground - 0.25],
                color=BRAND["mute"], lw=0.25)

    # "No ledger connection to cantilever allowed" callout (prominent)
    callout_x = 11.5
    callout_y = elev_ground + fw_h * 0.35
    ax.text(callout_x, callout_y,
            'No ledger connection\nto cantilever allowed',
            ha='center', va='center', fontsize=4.5, color=BRAND["red"],
            fontweight='bold', fontfamily='monospace',
            bbox=dict(boxstyle='round,pad=0.4', fc='white', ec=BRAND["red"], lw=1))

    # Arrow pointing to the cantilever zone on the elevation
    ax.annotate('', xy=(fw_x + fw_w + 1, deck_elev_y + 0.5),
                xytext=(callout_x - 2, callout_y + 0.5),
                arrowprops=dict(arrowstyle='->', color=BRAND["red"], lw=0.8))

    # "Elevation view" sub-label
    ax.text(-2, elev_ground - 0.8, 'Elevation view of the ledger connection',
            fontsize=4, color=BRAND["mute"], fontfamily='monospace', fontstyle='italic')


# ============================================================
# SHEET: COMBINED DETAILS (S66: 5-panel layout, cantilever moved to A-6)
# ============================================================
def draw_details_sheet(fig, params, calc, spec=None):
    """Draw all 5 detail views: 3 top + 2 bottom"""
    if spec is None:
        from .permit_spec import build_permit_spec
        spec = build_permit_spec(params, calc)

    import matplotlib.gridspec as gridspec
    gs = gridspec.GridSpec(2, 3, figure=fig,
                           left=0.04, right=0.84, top=0.93, bottom=0.06,
                           hspace=0.3, wspace=0.15)

    ax_ledger = fig.add_subplot(gs[0, 0])
    ax_footing = fig.add_subplot(gs[0, 1])
    ax_stair = fig.add_subplot(gs[0, 2])
    ax_guard = fig.add_subplot(gs[1, 0])
    ax_post = fig.add_subplot(gs[1, 1])

    draw_ledger_detail(ax_ledger, params, calc, spec)
    draw_footing_detail(ax_footing, params, calc, spec)
    draw_stair_landing_detail(ax_stair, params, calc, spec)
    draw_guard_rail_detail(ax_guard, params, calc, spec)
    draw_post_beam_detail(ax_post, params, calc, spec)

    # Construction notes at bottom
    fig.text(0.05, 0.03,
             'NOTES: 1) All PT lumber shall be .40 CCA or ACQ rated for ground contact where applicable.  '
             '2) All hardware shall be HDG or stainless for PT compatibility.  '
             '3) Verify all dimensions in field prior to construction.',
             fontsize=5, fontfamily='monospace', color=BRAND["mute"], wrap=True)
