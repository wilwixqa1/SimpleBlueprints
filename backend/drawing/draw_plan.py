#!/usr/bin/env python3
"""
SimpleBlueprints — Parametric PDF Drawing Engine
Step 1b: Plan View + Framing Plan (Sheet 1 of 4)
Tests with 3 different configs to verify scaling and member sizing
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Polygon
from matplotlib.backends.backend_pdf import PdfPages
import numpy as np

# Import our calculation engine
from .calc_engine import calculate_structure

# ============================================================
# DRAWING CONSTANTS
# ============================================================
BRAND = {
    "dark": "#1a1f16",
    "green": "#3d5a2e",
    "cream": "#faf8f3",
    "warm": "#f2ece0",
    "accent": "#c4960a",
    "text": "#2c3024",
    "mute": "#7a8068",
    "border": "#ddd8cc",
    "red": "#c62828",
    "blue": "#1565c0",
    "house": "#e8e6e0",
    "deck": "#efe5d5",
    "deck_board": "#c9ad7a",
    "beam": "#c4960a",
    "post": "#c4a060",
    "concrete": "#c8c8c8",
    "rail": "#333333",
    "ledger_green": "#2e7d32",
    "wood": "#d4b87a",
    "light": "#cccccc",
}


def draw_dimension_h(ax, x1, x2, y, text, offset=1.5, color="#333", fontsize=6):
    """Horizontal dimension line with text"""
    yo = y + offset
    ax.plot([x1, x1], [y, yo], color=color, lw=0.3, ls='--', dashes=(2, 2))
    ax.plot([x2, x2], [y, yo], color=color, lw=0.3, ls='--', dashes=(2, 2))
    ax.annotate('', xy=(x2, yo), xytext=(x1, yo),
                arrowprops=dict(arrowstyle='<->', color=color, lw=0.5))
    ax.text((x1 + x2) / 2, yo + 0.3, text, ha='center', va='bottom',
            fontsize=fontsize, fontweight='bold', color=color,
            bbox=dict(boxstyle='square,pad=0.15', fc='white', ec='none', alpha=0.9))


def draw_dimension_v(ax, x, y1, y2, text, offset=1.5, color="#333", fontsize=6):
    """Vertical dimension line with text"""
    xo = x + offset
    ax.plot([x, xo], [y1, y1], color=color, lw=0.3, ls='--', dashes=(2, 2))
    ax.plot([x, xo], [y2, y2], color=color, lw=0.3, ls='--', dashes=(2, 2))
    ax.annotate('', xy=(xo, y2), xytext=(xo, y1),
                arrowprops=dict(arrowstyle='<->', color=color, lw=0.5))
    ax.text(xo + 0.3, (y1 + y2) / 2, text, ha='left', va='center',
            fontsize=fontsize, fontweight='bold', color=color, rotation=90,
            bbox=dict(boxstyle='square,pad=0.15', fc='white', ec='none', alpha=0.9))


def draw_north_arrow(ax, x, y):
    ax.annotate('', xy=(x, y + 2), xytext=(x, y),
                arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=1.5))
    ax.text(x, y + 2.3, 'N', ha='center', va='bottom', fontsize=8, fontweight='bold')


def draw_scale_bar(ax, x, y, total_ft=12):
    segments = 4
    seg = total_ft / segments
    for i in range(segments):
        color = BRAND["dark"] if i % 2 == 0 else 'white'
        ax.add_patch(patches.Rectangle((x + i * seg, y), seg, 0.25,
                     fc=color, ec=BRAND["dark"], lw=0.5))
    for i in range(segments + 1):
        ax.text(x + i * seg, y - 0.2, str(int(i * seg)),
                ha='center', va='top', fontsize=4, color=BRAND["dark"])
    ax.text(x, y - 0.6, 'GRAPHIC SCALE (FEET)', fontsize=3.5, color=BRAND["mute"])


def format_feet_inches(feet):
    """Convert decimal feet to feet-inches string"""
    ft = int(feet)
    inches = (feet - ft) * 12
    if inches < 0.5:
        return f"{ft}'-0\""
    else:
        return f"{ft}'-{inches:.0f}\""


# ============================================================
# SHEET 1: DECK PLAN + FRAMING (side by side)
# ============================================================
def draw_plan_and_framing(fig, params, calc):
    """Draw plan view (left) and framing plan (right)"""

    W = calc["width"]
    D = calc["depth"]
    attachment = calc["attachment"]
    has_stairs = params.get("hasStairs", False)
    stair_loc = params.get("stairLocation", "front")

    ax1, ax2 = fig.subplots(1, 2)
    fig.subplots_adjust(left=0.04, right=0.96, top=0.91, bottom=0.08, wspace=0.12)

    # Compute margins based on deck size
    margin_x = max(W * 0.18, 5)
    margin_y = max(D * 0.25, 4)
    house_depth = min(D * 0.6, 10)  # visual house depth, proportional

    for ax, title, is_framing in [(ax1, "MAIN LEVEL DECK PLAN", False), (ax2, "DECK FRAMING", True)]:
        ax.set_xlim(-margin_x, W + margin_x)
        ax.set_ylim(-house_depth - margin_y * 0.5, D + margin_y)
        ax.set_aspect('equal')
        ax.axis('off')
        ax.set_facecolor('white')

        # Title
        ax.text(0, D + margin_y - 1, title, fontsize=10, fontweight='bold',
                fontfamily='monospace', color=BRAND["dark"])
        ax.text(0, D + margin_y - 2.2, 'SCALE: 1/4" = 1\'-0"', fontsize=5.5,
                fontfamily='monospace', color=BRAND["mute"])

        # House
        ax.add_patch(patches.Rectangle((0, -house_depth), W, house_depth,
                     fc=BRAND["house"], ec=BRAND["dark"], lw=1.5))
        ax.text(W / 2, -house_depth / 2 + 0.5, 'EXISTING SINGLE',
                ha='center', fontsize=6.5, color=BRAND["mute"])
        ax.text(W / 2, -house_depth / 2 - 0.8, 'FAMILY RESIDENCE',
                ha='center', fontsize=6.5, color=BRAND["mute"])

        # Deck body
        if is_framing:
            ax.add_patch(patches.Rectangle((0, 0), W, D,
                         fc='#fcfaf5', ec=BRAND["dark"], lw=2))
        else:
            ax.add_patch(patches.Rectangle((0, 0), W, D,
                         fc=BRAND["deck"], ec=BRAND["dark"], lw=2))
            # Board lines
            board_w = 5.5 / 12
            for i in range(int(D / board_w) + 1):
                by = i * board_w
                if by <= D:
                    ax.plot([0, W], [by, by], color=BRAND["deck_board"], lw=0.2)

        # Ledger
        if attachment == "ledger":
            ax.plot([0, W], [0, 0], color=BRAND["ledger_green"], lw=3.5)
            ax.text(W / 2, -0.6,
                    f'{calc["ledger_size"]} PT LEDGER W/ (2) 5" LEDGER LOCKS @ {16}" O.C.',
                    ha='center', fontsize=4, fontweight='bold', color=BRAND["ledger_green"])

        # Framing-specific elements
        if is_framing:
            beam_y = D - 1.5

            # Joists
            sp = calc["joist_spacing"] / 12
            for jx in np.arange(sp, W, sp):
                if jx < W - 0.3:
                    ax.plot([jx, jx], [0.1, beam_y], color=BRAND["light"], lw=0.4)

            # Joist label
            ax.text(W / 2, D / 2 - 1.5,
                    f'P.T. {calc["joist_size"]} @ {calc["joist_spacing"]}" O.C.',
                    ha='center', fontsize=6, fontfamily='monospace', color='#666')
            ax.text(W / 2, D / 2 - 2.8, 'DECK JOISTS',
                    ha='center', fontsize=5, fontfamily='monospace', color='#888')

            # Beam
            ax.plot([1, W - 1], [beam_y, beam_y], color=BRAND["beam"], lw=4)
            ax.plot([1, W - 1], [beam_y - 0.12, beam_y - 0.12], color=BRAND["beam"], lw=0.5)
            ax.plot([1, W - 1], [beam_y + 0.12, beam_y + 0.12], color=BRAND["beam"], lw=0.5)
            ax.text(W / 2, beam_y - 0.8,
                    f'{calc["beam_size"].upper()} BEAM',
                    ha='center', fontsize=4, fontweight='bold', color='#8B6914')

            # Posts + piers
            for px in calc["post_positions"]:
                ax.plot(px, beam_y, 'o', ms=5, color=BRAND["post"],
                        mec=BRAND["dark"], mew=0.8)
                pier = plt.Circle((px, beam_y), calc["footing_diam"] / 24,
                                  fill=False, ec=BRAND["dark"], lw=0.5, ls='--')
                ax.add_patch(pier)

            # Hardware labels (right side)
            label_x = W + 1
            ax.text(label_x, beam_y + 0.5,
                    f'{calc["post_size"]} PT POSTS W/ SIMPSON',
                    fontsize=4, color=BRAND["dark"])
            ax.text(label_x, beam_y - 0.3,
                    f"'ABU POST BASE & POST CAP",
                    fontsize=4, color=BRAND["dark"])
            ax.text(label_x, beam_y - 1.1,
                    f'({calc["num_posts"]}) PLCS',
                    fontsize=4, color=BRAND["dark"])
            ax.text(label_x, beam_y - 2.5,
                    f'{calc["footing_diam"]}" Ø CONCRETE PIERS',
                    fontsize=4, color=BRAND["dark"])
            ax.text(label_x, beam_y - 3.3,
                    f'X {calc["footing_depth"]}" DEEP, ({calc["num_footings"]}) PLCS',
                    fontsize=4, color=BRAND["dark"])

            # Loads box
            lbx, lby = W + 1, 0.5
            ax.add_patch(patches.Rectangle((lbx, lby), 8, 3.5,
                         fc='#fafaf8', ec=BRAND["dark"], lw=0.5))
            ax.text(lbx + 0.3, lby + 2.9, 'DECK LOADS:', fontsize=5,
                    fontweight='bold', color=BRAND["dark"])
            ax.text(lbx + 0.3, lby + 2.1, f'L.L. = {calc["LL"]} PSF',
                    fontsize=4.5, color=BRAND["dark"])
            ax.text(lbx + 0.3, lby + 1.4, f'D.L. = {calc["DL"]} PSF',
                    fontsize=4.5, color=BRAND["dark"])
            ax.text(lbx + 0.3, lby + 0.7, f'T.L. = {calc["TL"]} PSF',
                    fontsize=4.5, fontweight='bold', color=BRAND["red"])
        else:
            # Plan view labels
            ax.text(W / 2, D / 2 + 0.8, '1 × 6 COMPOSITE DECKING',
                    ha='center', fontsize=5.5, fontfamily='monospace', color='#666')
            ax.text(W / 2, D / 2 - 0.8, f'{calc["rail_height"]}" GUARD RAIL SYSTEM',
                    ha='center', fontsize=5, fontfamily='monospace', color='#666')

        # Railing (3 sides for ledger, 4 for freestanding)
        rail_sides = [(0, 0, 0, D), (0, D, W, D), (W, 0, W, D)]
        if attachment == "freestanding":
            rail_sides.append((0, 0, W, 0))
        for x1, y1, x2, y2 in rail_sides:
            ax.plot([x1, x2], [y1, y2], color=BRAND["rail"], lw=3.5)

        # Stairs
        if has_stairs:
            sw_ft = 4  # stair width
            stair_len = 2  # visual length on plan

            if stair_loc == "front":
                sx = W / 2 - sw_ft / 2
                sy = D
                # Opening in front rail
                ax.plot([sx, sx], [sy, sy + stair_len], color=BRAND["dark"], lw=0.8)
                ax.plot([sx + sw_ft, sx + sw_ft], [sy, sy + stair_len], color=BRAND["dark"], lw=0.8)
                # Treads
                for i in range(5):
                    ty = sy + i * stair_len / 5
                    ax.plot([sx, sx + sw_ft], [ty, ty], color=BRAND["mute"], lw=0.4)
                ax.text(sx + sw_ft / 2, sy + stair_len + 0.5, 'DN',
                        ha='center', fontsize=5, fontweight='bold', color=BRAND["dark"])

            elif stair_loc == "left":
                sx = -stair_len
                sy = D - sw_ft
                ax.plot([sx, 0], [sy, sy], color=BRAND["dark"], lw=0.8)
                ax.plot([sx, 0], [sy + sw_ft, sy + sw_ft], color=BRAND["dark"], lw=0.8)
                for i in range(5):
                    tx = sx + i * stair_len / 5
                    ax.plot([tx, tx], [sy, sy + sw_ft], color=BRAND["mute"], lw=0.4)
                ax.text(sx - 0.5, sy + sw_ft / 2, 'DN',
                        ha='right', fontsize=5, fontweight='bold', color=BRAND["dark"])

            elif stair_loc == "right":
                sx = W
                sy = D - sw_ft
                ax.plot([sx, sx + stair_len], [sy, sy], color=BRAND["dark"], lw=0.8)
                ax.plot([sx, sx + stair_len], [sy + sw_ft, sy + sw_ft], color=BRAND["dark"], lw=0.8)
                for i in range(5):
                    tx = sx + i * stair_len / 5
                    ax.plot([tx, tx], [sy, sy + sw_ft], color=BRAND["mute"], lw=0.4)
                ax.text(sx + stair_len + 0.5, sy + sw_ft / 2, 'DN',
                        ha='left', fontsize=5, fontweight='bold', color=BRAND["dark"])

        # Dimensions
        draw_dimension_h(ax, 0, W, D, format_feet_inches(W),
                         offset=max(D * 0.15, 2), color=BRAND["red"], fontsize=7)
        draw_dimension_v(ax, W, 0, D, format_feet_inches(D),
                         offset=max(W * 0.06, 2), color=BRAND["blue"], fontsize=7)

        # North arrow + scale bar
        draw_north_arrow(ax, W + margin_x - 2, D + margin_y - 5)
        draw_scale_bar(ax, 0, -house_depth - margin_y * 0.3)

    # Sheet label
    fig.text(0.5, 0.02,
             f'SHEET A-1  |  DECK PLAN & FRAMING  |  {format_feet_inches(W)} × {format_feet_inches(D)}  |  simpleblueprints.xyz',
             ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"])


# ============================================================
# TEST: Generate 3 configs
# ============================================================
def main():
    test_configs = [
        {
            "name": "small_12x10",
            "params": {
                "width": 12, "depth": 10, "height": 2, "attachment": "ledger",
                "joistSpacing": 16, "snowLoad": "none", "frostZone": "warm",
                "deckingType": "pt_lumber", "hasStairs": True, "stairLocation": "front",
                "railType": "wood",
            }
        },
        {
            "name": "medium_20x14",
            "params": {
                "width": 20, "depth": 14, "height": 4, "attachment": "ledger",
                "joistSpacing": 16, "snowLoad": "light", "frostZone": "moderate",
                "deckingType": "composite", "hasStairs": True, "stairLocation": "right",
                "railType": "fortress",
            }
        },
        {
            "name": "large_35x10",
            "params": {
                "width": 35, "depth": 10, "height": 9.3, "attachment": "ledger",
                "joistSpacing": 16, "snowLoad": "moderate", "frostZone": "cold",
                "deckingType": "composite", "hasStairs": False, "stairLocation": "front",
                "railType": "fortress",
            }
        },
    ]

    output = "/home/claude/test_plan_sheets.pdf"

    with PdfPages(output) as pdf:
        for cfg in test_configs:
            print(f"Drawing: {cfg['name']}...")
            calc = calculate_structure(cfg["params"])

            fig = plt.figure(figsize=(14, 8.5))
            fig.set_facecolor('white')

            draw_plan_and_framing(fig, cfg["params"], calc)

            # Add config label at top
            fig.text(0.5, 0.97,
                     f'TEST: {cfg["name"]}  —  {calc["width"]}\' × {calc["depth"]}\' | '
                     f'TL={calc["TL"]} PSF | {calc["joist_size"]} joists | {calc["beam_size"]} beam | '
                     f'{calc["post_size"]} × {calc["num_posts"]} posts | {calc["footing_diam"]}" piers',
                     ha='center', fontsize=7, fontfamily='monospace', color=BRAND["red"],
                     bbox=dict(boxstyle='square,pad=0.3', fc='#fff8f0', ec=BRAND["red"], lw=0.5))

            pdf.savefig(fig, dpi=200)
            plt.close(fig)

    print(f"\nSaved 3 test sheets to {output}")


if __name__ == "__main__":
    main()
