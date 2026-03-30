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


# ============================================================
# SHEET: COMBINED DETAILS
# ============================================================
def draw_details_sheet(fig, params, calc, spec=None):
    """Draw all 4 detail views on one sheet"""
    if spec is None:
        from .permit_spec import build_permit_spec
        spec = build_permit_spec(params, calc)

    axes = fig.subplots(2, 2)
    fig.subplots_adjust(left=0.04, right=0.84, top=0.93, bottom=0.06, hspace=0.3, wspace=0.15)

    draw_ledger_detail(axes[0, 0], params, calc, spec)
    draw_footing_detail(axes[0, 1], params, calc, spec)
    draw_guard_rail_detail(axes[1, 0], params, calc, spec)
    draw_post_beam_detail(axes[1, 1], params, calc, spec)

    # Construction notes at bottom
    fig.text(0.05, 0.03,
             'NOTES: 1) All PT lumber shall be .40 CCA or ACQ rated for ground contact where applicable.  '
             '2) All hardware shall be HDG or stainless for PT compatibility.  '
             '3) Verify all dimensions in field prior to construction.',
             fontsize=5, fontfamily='monospace', color=BRAND["mute"], wrap=True)
