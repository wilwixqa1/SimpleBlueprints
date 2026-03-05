#!/usr/bin/env python3
"""
SimpleBlueprints — Parametric PDF Drawing Engine
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


def draw_ledger_detail(ax, params, calc):
    """Ledger-to-house connection cross section"""
    ax.set_xlim(-3, 16)
    ax.set_ylim(-4, 12)
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_facecolor('white')

    ax.text(-2, 11, 'LEDGER DETAIL', fontsize=9, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])
    ax.text(-2, 10, 'NOT TO SCALE', fontsize=5, fontfamily='monospace', color=BRAND["mute"])

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
    ax.text(8.5, 5, f'{calc["ledger_size"]} PT\nLEDGER', fontsize=5, fontweight='bold', color=BRAND["dark"])
    ax.annotate('', xy=(5.2, 5), xytext=(8.3, 5),
                arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=0.5))

    # Ledger locks
    bolt_positions = [3, 5, 7]
    for by in bolt_positions:
        ax.plot([2, 5.2], [by, by], color=BRAND["red"], lw=1.5)
        ax.plot(2.5, by, 'o', ms=3, color=BRAND["red"])
        ax.plot(5.2, by, 'o', ms=3, color=BRAND["red"])
    ax.text(8.5, 3, '(2) 5" LEDGER\nLOCKS @ 16" O.C.', fontsize=4.5, fontweight='bold', color=BRAND["red"])

    # Joist
    ax.add_patch(patches.Rectangle((5.2, 1.8), 0.8, 6.4, fc=BRAND["wood"], ec=BRAND["dark"], lw=0.6))
    ax.text(8.5, 7.5, f'{calc["joist_size"]} JOIST', fontsize=4.5, color=BRAND["dark"])
    ax.annotate('', xy=(6, 7.5), xytext=(8.3, 7.5),
                arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=0.5))

    # Decking on top
    if params["deckingType"] == "composite":
        deck_label = '1×6 TREX\nCOMPOSITE'
    else:
        deck_label = '5/4×6 PT\nDECKING'
    ax.add_patch(patches.Rectangle((3.5, 8.5), 4, 0.35, fc='#8B7355', ec=BRAND["dark"], lw=0.6))
    ax.text(8.5, 8.8, deck_label, fontsize=4.5, color=BRAND["dark"])

    # Joist hanger
    ax.plot([5.2, 5.2, 6, 6], [2, 1.5, 1.5, 2], color='#888', lw=1.5)
    ax.text(5.4, 0.8, 'JOIST HANGER', fontsize=3.5, color=BRAND["mute"])

    # Joist tape
    ax.add_patch(patches.Rectangle((5.2, 8.2), 0.8, 0.3, fc='#555', ec=BRAND["dark"], lw=0.3))
    ax.text(8.5, 8.2, 'JOIST TAPE', fontsize=3.5, color=BRAND["mute"])


def draw_footing_detail(ax, params, calc):
    """Concrete pier footing cross section"""
    ax.set_xlim(-3, 16)
    ax.set_ylim(-9, 10)
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_facecolor('white')

    ax.text(-2, 9, 'FOOTING DETAIL', fontsize=9, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])
    ax.text(-2, 8, 'NOT TO SCALE', fontsize=5, fontfamily='monospace', color=BRAND["mute"])

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
            f'{calc["footing_diam"]}" Ø\nCONCRETE\nPIER', ha='center', fontsize=5, color='#555')

    # Grade label
    ax.text(10, 0.3, 'GRADE', fontsize=4.5, color=BRAND["dark"])

    # Gravel base
    ax.add_patch(patches.Rectangle((3, -pier_visual_depth - 0.5), pier_width, 0.5,
                 fc='#d4d0c0', ec=BRAND["dark"], lw=0.5))
    ax.text(10, -pier_visual_depth - 0.3, '3" GRAVEL BASE', fontsize=4, color=BRAND["mute"])

    # Post base hardware
    ax.add_patch(patches.Rectangle((3.5, 0), pier_width - 1, 0.5,
                 fc='#888', ec=BRAND["dark"], lw=0.8))
    post_base_name = "ABU66Z" if calc["post_size"] == "6x6" else "ABU44Z"
    ax.text(10, 0.2, f"SIMPSON '{post_base_name}'\nPOST BASE", fontsize=4.5, color=BRAND["dark"])

    # Post
    post_visual_w = 2.2 if calc["post_size"] == "6x6" else 1.5
    ax.add_patch(patches.Rectangle((3 + (pier_width - post_visual_w) / 2, 0.5),
                 post_visual_w, 6, fc=BRAND["post"], ec=BRAND["dark"], lw=1))
    ax.text(10, 3.5, f'{calc["post_size"]} PT POST', fontsize=5, fontweight='bold', color=BRAND["dark"])

    # Rebar
    ax.plot([4, 4], [-pier_visual_depth + 0.5, 0], color=BRAND["red"], lw=0.8)
    ax.plot([6, 6], [-pier_visual_depth + 0.5, 0], color=BRAND["red"], lw=0.8)
    ax.text(10, -2, '#4 REBAR', fontsize=4, color=BRAND["red"])

    # Frost line
    frost_visual = min(pier_visual_depth * 0.3, 2)
    ax.plot([-1, 9], [-frost_visual, -frost_visual], color=BRAND["blue"], lw=0.5, ls='-.')
    ax.text(-1, -frost_visual + 0.3, 'FROST LINE', fontsize=3.5, color=BRAND["blue"])

    # Dimensions
    draw_dimension_v(ax, 2, -pier_visual_depth, 0,
                     f'{calc["footing_depth"]}" MIN.', offset=-2.5, color=BRAND["blue"], fontsize=5)
    draw_dimension_h(ax, 3, 3 + pier_width, -pier_visual_depth,
                     f'{calc["footing_diam"]}" DIA.', offset=-2, color=BRAND["red"], fontsize=5)


def draw_guard_rail_detail(ax, params, calc):
    """Guard rail cross section / front view"""
    ax.set_xlim(-2, 18)
    ax.set_ylim(-2, 10)
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_facecolor('white')

    ax.text(-1, 9, 'GUARD RAIL DETAIL', fontsize=9, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])
    ax.text(-1, 8.2, 'NOT TO SCALE', fontsize=5, fontfamily='monospace', color=BRAND["mute"])

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
                     f'{calc["rail_height"]}" MIN.', offset=-1.5, color=BRAND["red"], fontsize=5)

    # 4" sphere test — always centered between two balusters, vertically centered in open rail space
    sphere_r = 0.35
    baluster_start = 1.5
    baluster_spacing = 0.9
    baluster_w = 0.15
    sphere_cx = baluster_start + baluster_spacing / 2 + baluster_w / 2  # midpoint between first two balusters
    sphere_cy = (1.05 + rail_visual_h) / 2  # midpoint of open vertical space
    ax.add_patch(plt.Circle((sphere_cx, sphere_cy), sphere_r, fc='none', ec=BRAND["red"], lw=0.8, ls='--'))
    ax.text(sphere_cx + 0.5, sphere_cy - 0.2, '< 4" MUST NOT ALLOW\nPASSAGE OF 4" SPHERE',
            fontsize=4, color=BRAND["red"])


def draw_post_beam_detail(ax, params, calc):
    """Post cap to beam connection detail"""
    ax.set_xlim(-2, 16)
    ax.set_ylim(-3, 10)
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_facecolor('white')

    ax.text(-1, 9, 'POST / BEAM CONNECTION', fontsize=8, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])
    ax.text(-1, 8.2, 'NOT TO SCALE', fontsize=5, fontfamily='monospace', color=BRAND["mute"])

    # Post
    post_w = 2.2 if calc["post_size"] == "6x6" else 1.5
    ax.add_patch(patches.Rectangle((3, -2), post_w, 6,
                 fc=BRAND["post"], ec=BRAND["dark"], lw=1))
    ax.text(9, 0.5, f'{calc["post_size"]} PT POST', fontsize=5, fontweight='bold', color=BRAND["dark"])

    # Post cap
    ax.add_patch(patches.Rectangle((2.5, 4), post_w + 1, 0.5,
                 fc='#888', ec=BRAND["dark"], lw=0.8))
    cap_name = "BCS2-3/6" if calc["post_size"] == "6x6" else "BC4"
    ax.text(9, 4, f"SIMPSON '{cap_name}'\nPOST CAP", fontsize=4.5, color=BRAND["dark"])

    # Beam
    beam_y = 4.5
    beam_visual_w = 7

    # Determine ply count from beam size string
    plies = 3 if "3-ply" in calc["beam_size"] else 2
    ax.add_patch(patches.Rectangle((1, beam_y), beam_visual_w, 2.5,
                 fc=BRAND["beam"], ec=BRAND["dark"], lw=1))

    # Ply lines
    ply_spacing = beam_visual_w / plies
    for p in range(1, plies):
        px = 1 + p * ply_spacing
        ax.plot([px, px], [beam_y, beam_y + 2.5], color='#9a8030', lw=0.5)

    is_lvl = "LVL" in calc["beam_size"]
    if is_lvl:
        beam_label = f'({plies}) 1-3/4" × 11-7/8"\n2.0E LVL EXT. GRADE'
    else:
        beam_lumber = calc["beam_size"].split(" ", 1)[1] if " " in calc["beam_size"] else calc["beam_size"]
        beam_label = f'({plies}) {beam_lumber}\nPT BEAM'

    ax.text(9, 5.5, beam_label, fontsize=4.5, fontweight='bold', color=BRAND["dark"])

    # Joist on top
    ax.add_patch(patches.Rectangle((0.5, 7), 8, 0.8,
                 fc=BRAND["wood"], ec=BRAND["dark"], lw=0.6))
    ax.text(9, 7.2, f'{calc["joist_size"]} DECK JOIST', fontsize=4.5, color=BRAND["dark"])

    # Through bolts
    for by in [5, 5.8, 6.5]:
        ax.plot([1.5, 7.5], [by, by], color=BRAND["mute"], lw=0.3, ls='--')
        ax.plot(1.5, by, 'x', ms=3, color=BRAND["red"], mew=0.8)
        ax.plot(7.5, by, 'x', ms=3, color=BRAND["red"], mew=0.8)

    ax.text(9, 6.5, '1/2" CARRIAGE BOLTS\nW/ NUTS & WASHERS', fontsize=3.5, color=BRAND["mute"])


# ============================================================
# SHEET 3: COMBINED DETAILS
# ============================================================
def draw_details_sheet(fig, params, calc):
    """Draw all 4 detail views on one sheet"""

    axes = fig.subplots(2, 2)
    fig.subplots_adjust(left=0.04, right=0.96, top=0.93, bottom=0.06, hspace=0.3, wspace=0.15)

    draw_ledger_detail(axes[0, 0], params, calc)
    draw_footing_detail(axes[0, 1], params, calc)
    draw_guard_rail_detail(axes[1, 0], params, calc)
    draw_post_beam_detail(axes[1, 1], params, calc)

    # Construction notes at bottom
    fig.text(0.05, 0.03,
             'NOTES: 1) All PT lumber shall be .40 CCA or ACQ rated for ground contact where applicable.  '
             '2) All hardware shall be HDG or stainless for PT compatibility.  '
             '3) Verify all dimensions in field prior to construction.',
             fontsize=5, fontfamily='monospace', color=BRAND["mute"], wrap=True)

    fig.text(0.5, 0.01,
             f'SHEET A-3  |  STRUCTURAL DETAILS  |  {format_feet_inches(calc["width"])} × {format_feet_inches(calc["depth"])}  |  simpleblueprints.xyz',
             ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"])


# ============================================================
# TEST
# ============================================================
def main():
    test_configs = [
        {
            "name": "small_12x10_wood",
            "params": {
                "width": 12, "depth": 10, "height": 2, "attachment": "ledger",
                "joistSpacing": 16, "snowLoad": "none", "frostZone": "warm",
                "deckingType": "pt_lumber", "hasStairs": True, "stairLocation": "front",
                "railType": "wood",
            }
        },
        {
            "name": "medium_20x14_fortress",
            "params": {
                "width": 20, "depth": 14, "height": 4, "attachment": "ledger",
                "joistSpacing": 16, "snowLoad": "light", "frostZone": "moderate",
                "deckingType": "composite", "hasStairs": True, "stairLocation": "right",
                "railType": "fortress",
            }
        },
        {
            "name": "large_35x10_elevated",
            "params": {
                "width": 35, "depth": 10, "height": 9.3, "attachment": "ledger",
                "joistSpacing": 16, "snowLoad": "moderate", "frostZone": "cold",
                "deckingType": "composite", "hasStairs": False, "stairLocation": "front",
                "railType": "fortress",
            }
        },
    ]

    output = "/home/claude/test_detail_sheets.pdf"

    with PdfPages(output) as pdf:
        for cfg in test_configs:
            print(f"Drawing details: {cfg['name']}...")
            calc = calculate_structure(cfg["params"])

            fig = plt.figure(figsize=(14, 8.5))
            fig.set_facecolor('white')
            draw_details_sheet(fig, cfg["params"], calc)

            fig.text(0.5, 0.97,
                     f'TEST: {cfg["name"]}  —  {calc["joist_size"]} joists | {calc["beam_size"]} beam | '
                     f'{calc["post_size"]} posts | {calc["footing_diam"]}" × {calc["footing_depth"]}" piers | '
                     f'{cfg["params"]["railType"]} rail',
                     ha='center', fontsize=7, fontfamily='monospace', color=BRAND["red"],
                     bbox=dict(boxstyle='square,pad=0.3', fc='#fff8f0', ec=BRAND["red"], lw=0.5))

            pdf.savefig(fig, dpi=200)
            plt.close(fig)

    print(f"\nSaved 3 detail sheets to {output}")


if __name__ == "__main__":
    main()
