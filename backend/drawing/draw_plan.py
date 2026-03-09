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
from .stair_utils import get_stair_placement, get_stair_exit_side
from .zone_utils import get_additive_rects, get_cutout_rects, get_exposed_edges, get_bounding_box

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

    # S21: Zone-aware plan view data
    add_rects = get_additive_rects(params)
    cut_rects = get_cutout_rects(params)
    exp_edges = get_exposed_edges(params)
    bbox = get_bounding_box(params)

    margin_x = max(bbox["w"] * 0.18, 5)
    margin_y = max(bbox["d"] * 0.25, 4)
    house_depth = min(D * 0.6, 10)  # visual house depth, proportional

    for ax, title, is_framing in [(ax1, "MAIN LEVEL DECK PLAN", False), (ax2, "DECK FRAMING", True)]:
        ax.set_xlim(bbox["x"] - margin_x, bbox["x"] + bbox["w"] + margin_x)
        ax.set_ylim(-house_depth - margin_y * 0.5, bbox["y"] + bbox["d"] + margin_y)
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
            # S21: Zone-aware deck rendering
            for ar in add_rects:
                r = ar["rect"]
                ax.add_patch(patches.Rectangle((r["x"], r["y"]), r["w"], r["d"],
                             fc=BRAND["deck"], ec=BRAND["dark"], lw=2))
                board_w = 5.5 / 12
                for bi in range(int(r["d"] / board_w) + 1):
                    by = r["y"] + bi * board_w
                    if by <= r["y"] + r["d"]:
                        ax.plot([r["x"], r["x"] + r["w"]], [by, by], color=BRAND["deck_board"], lw=0.2)
            for cr in cut_rects:
                r = cr["rect"]
                ax.add_patch(patches.Rectangle((r["x"], r["y"]), r["w"], r["d"],
                             fc='white', ec=BRAND["dark"], lw=1.5, ls='--'))

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

            # Mid-span blocking (when joist span > 7ft)
            j_span = D - 1.5 if attachment == "ledger" else D / 2 - 0.75
            if j_span > 7:
                block_y = j_span / 2  # midpoint of joist span
                sp_ft = calc["joist_spacing"] / 12
                for jx in np.arange(sp_ft, W, sp_ft):
                    if jx < W - 0.3 and jx + sp_ft < W:
                        ax.plot([jx, jx + sp_ft], [block_y, block_y],
                                color=BRAND["dark"], lw=0.6, ls='--', dashes=(1.5, 1.5))
                ax.text(W + 1, block_y,
                        f'{calc["joist_size"]} SOLID BLOCKING\nAT MID-SPAN',
                        fontsize=3.5, fontfamily='monospace', color=BRAND["dark"], va='center')

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

            # ── BUILDER DIMENSION CALLOUTS (S17) ──
            beam_setback = 1.5  # beam is 1.5ft from front edge
            pp = calc["post_positions"]

            # Post-to-corner dimensions (below deck outline)
            dim_y_base = -1.5  # below the deck
            for i, px in enumerate(pp):
                if i == 0:
                    # First post: distance from left edge
                    if px > 0.5:
                        draw_dimension_h(ax, 0, px, dim_y_base, format_feet_inches(px),
                                         offset=-1.8, color='#555', fontsize=4.5)
                elif i == len(pp) - 1:
                    # Last post: distance from right edge
                    if W - px > 0.5:
                        draw_dimension_h(ax, px, W, dim_y_base, format_feet_inches(W - px),
                                         offset=-1.8, color='#555', fontsize=4.5)

            # Footing center-to-center spacing (below post dims)
            if len(pp) > 1:
                for i in range(len(pp) - 1):
                    spacing = pp[i + 1] - pp[i]
                    draw_dimension_h(ax, pp[i], pp[i + 1], dim_y_base,
                                     format_feet_inches(spacing),
                                     offset=-3.5, color='#777', fontsize=4)

            # Beam setback dimension (right side, vertical)
            draw_dimension_v(ax, W, D - beam_setback, D,
                             format_feet_inches(beam_setback),
                             offset=max(W * 0.08, 3.5), color='#8B6914', fontsize=4.5)

            # Joist count label
            n_joists = int(W / (calc["joist_spacing"] / 12)) + 1
            if n_joists > 0:
                ax.text(W / 2, D / 2 - 3.8,
                        f'{n_joists} JOISTS',
                        ha='center', fontsize=4.5, fontfamily='monospace',
                        color='#999', fontweight='bold')
        else:
            # Plan view labels
            ax.text(W / 2, D / 2 + 0.8, '1 × 6 COMPOSITE DECKING',
                    ha='center', fontsize=5.5, fontfamily='monospace', color='#666')
            ax.text(W / 2, D / 2 - 0.8, f'{calc["rail_height"]}" GUARD RAIL SYSTEM',
                    ha='center', fontsize=5, fontfamily='monospace', color='#666')

        # Railing (S21: zone-aware exposed edges)
        for e in exp_edges:
            ax.plot([e["x1"], e["x2"]], [e["y1"], e["y2"]], color=BRAND["rail"], lw=3.5)

        # Stairs (parametric)
        if has_stairs and calc.get("stairs"):
            st = calc["stairs"]
            sw_ft = st.get("width", 4)
            stair_run = st["total_run_ft"]  # actual total run from calc
            n_treads = st["num_treads"]
            n_stringers = st["num_stringers"]
            has_landing = st.get("has_landing", False)
            placement = get_stair_placement(params, {"width": W, "depth": D})
            stair_loc = get_stair_exit_side(placement["angle"])
            landing_depth = 3 if has_landing else 0
            tread_step = stair_run / max(n_treads, 1)

            if stair_loc == "front":
                sx = placement["anchor_x"] - sw_ft / 2
                sy = placement["anchor_y"]
                # Stringer outlines
                ax.plot([sx, sx], [sy, sy + stair_run], color=BRAND["dark"], lw=1.0)
                ax.plot([sx + sw_ft, sx + sw_ft], [sy, sy + stair_run], color=BRAND["dark"], lw=1.0)
                # Tread lines
                for i in range(n_treads + 1):
                    ty = sy + i * tread_step
                    ax.plot([sx, sx + sw_ft], [ty, ty], color=BRAND["mute"], lw=0.5)
                # Stringer center lines (dashed)
                for si in range(n_stringers):
                    ssx = sx + (si) * sw_ft / (n_stringers - 1) if n_stringers > 1 else sx + sw_ft / 2
                    ax.plot([ssx, ssx], [sy, sy + stair_run], color=BRAND["mute"], lw=0.3, ls='--', dashes=(2, 2))
                # DN arrow
                mid_x = sx + sw_ft / 2
                ax.annotate('', xy=(mid_x, sy + stair_run - 0.3), xytext=(mid_x, sy + 0.3),
                            arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=0.8))
                ax.text(mid_x, sy + stair_run / 2, 'DN', ha='center', va='center', fontsize=5,
                        fontweight='bold', color=BRAND["dark"],
                        bbox=dict(boxstyle='square,pad=0.15', fc='white', ec='none', alpha=0.9))
                # Landing pad
                if has_landing:
                    ly = sy + stair_run
                    ax.add_patch(patches.Rectangle((sx - 0.5, ly), sw_ft + 1, landing_depth,
                                 fc='#e8e8e0', ec=BRAND["dark"], lw=0.6, ls='--'))
                    ax.text(sx + sw_ft / 2, ly + landing_depth / 2, 'CONC. PAD',
                            ha='center', va='center', fontsize=3.5, color=BRAND["mute"])
                # Label
                ax.text(sx + sw_ft + 0.8, sy + stair_run / 2,
                        f'({n_stringers}) 2×12 PT\nSTRINGERS\n{st["actual_rise"]:.1f}" RISE\n{st["tread_depth"]}" RUN',
                        fontsize=3.5, fontfamily='monospace', color=BRAND["dark"], va='center')

            elif stair_loc == "left":
                sx = placement["anchor_x"] - stair_run
                sy = placement["anchor_y"] - sw_ft / 2
                deck_edge_x = placement["anchor_x"]
                ax.plot([sx, deck_edge_x], [sy, sy], color=BRAND["dark"], lw=1.0)
                ax.plot([sx, deck_edge_x], [sy + sw_ft, sy + sw_ft], color=BRAND["dark"], lw=1.0)
                for i in range(n_treads + 1):
                    tx = deck_edge_x - i * tread_step
                    ax.plot([tx, tx], [sy, sy + sw_ft], color=BRAND["mute"], lw=0.5)
                for si in range(n_stringers):
                    ssy = sy + (si) * sw_ft / (n_stringers - 1) if n_stringers > 1 else sy + sw_ft / 2
                    ax.plot([sx, deck_edge_x], [ssy, ssy], color=BRAND["mute"], lw=0.3, ls='--', dashes=(2, 2))
                mid_y = sy + sw_ft / 2
                ax.annotate('', xy=(sx + 0.3, mid_y), xytext=(deck_edge_x - 0.3, mid_y),
                            arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=0.8))
                ax.text(sx + stair_run / 2, mid_y, 'DN', ha='center', va='center', fontsize=5,
                        fontweight='bold', color=BRAND["dark"],
                        bbox=dict(boxstyle='square,pad=0.15', fc='white', ec='none', alpha=0.9))
                if has_landing:
                    ax.add_patch(patches.Rectangle((sx - landing_depth, sy - 0.5), landing_depth, sw_ft + 1,
                                 fc='#e8e8e0', ec=BRAND["dark"], lw=0.6, ls='--'))
                    ax.text(sx - landing_depth / 2, sy + sw_ft / 2, 'CONC.\nPAD',
                            ha='center', va='center', fontsize=3.5, color=BRAND["mute"])
                ax.text(sx + stair_run / 2, sy - 0.8,
                        f'({n_stringers}) 2×12 PT STRINGERS · {st["actual_rise"]:.1f}" RISE · {st["tread_depth"]}" RUN',
                        ha='center', fontsize=3.5, fontfamily='monospace', color=BRAND["dark"])

            elif stair_loc == "right":
                sx = placement["anchor_x"]
                sy = placement["anchor_y"] - sw_ft / 2
                ax.plot([sx, sx + stair_run], [sy, sy], color=BRAND["dark"], lw=1.0)
                ax.plot([sx, sx + stair_run], [sy + sw_ft, sy + sw_ft], color=BRAND["dark"], lw=1.0)
                for i in range(n_treads + 1):
                    tx = sx + i * tread_step
                    ax.plot([tx, tx], [sy, sy + sw_ft], color=BRAND["mute"], lw=0.5)
                for si in range(n_stringers):
                    ssy = sy + (si) * sw_ft / (n_stringers - 1) if n_stringers > 1 else sy + sw_ft / 2
                    ax.plot([sx, sx + stair_run], [ssy, ssy], color=BRAND["mute"], lw=0.3, ls='--', dashes=(2, 2))
                mid_y = sy + sw_ft / 2
                ax.annotate('', xy=(sx + stair_run - 0.3, mid_y), xytext=(sx + 0.3, mid_y),
                            arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=0.8))
                ax.text(sx + stair_run / 2, mid_y, 'DN', ha='center', va='center', fontsize=5,
                        fontweight='bold', color=BRAND["dark"],
                        bbox=dict(boxstyle='square,pad=0.15', fc='white', ec='none', alpha=0.9))
                if has_landing:
                    ax.add_patch(patches.Rectangle((sx + stair_run, sy - 0.5), landing_depth, sw_ft + 1,
                                 fc='#e8e8e0', ec=BRAND["dark"], lw=0.6, ls='--'))
                    ax.text(sx + stair_run + landing_depth / 2, sy + sw_ft / 2, 'CONC.\nPAD',
                            ha='center', va='center', fontsize=3.5, color=BRAND["mute"])
                ax.text(sx + stair_run / 2, sy - 0.8,
                        f'({n_stringers}) 2×12 PT STRINGERS · {st["actual_rise"]:.1f}" RISE · {st["tread_depth"]}" RUN',
                        ha='center', fontsize=3.5, fontfamily='monospace', color=BRAND["dark"])

        # Stair opening width callout on framing plan
        if is_framing and has_stairs and calc.get("stairs"):
            st = calc["stairs"]
            sw_ft = st.get("width", 4)
            placement = get_stair_placement(params, {"width": W, "depth": D})
            s_loc = get_stair_exit_side(placement["angle"])
            if s_loc == "front":
                sx = placement["anchor_x"] - sw_ft / 2
                # Opening width dim along front edge
                draw_dimension_h(ax, sx, sx + sw_ft, D,
                                 f'{format_feet_inches(sw_ft)} OPENING',
                                 offset=max(D * 0.08, 1.2), color='#c62828', fontsize=4.5)
            elif s_loc == "left":
                sy = placement["anchor_y"] - sw_ft / 2
                draw_dimension_v(ax, 0, sy, sy + sw_ft,
                                 f'{format_feet_inches(sw_ft)} OPENING',
                                 offset=-3.5, color='#c62828', fontsize=4.5)
            elif s_loc == "right":
                sy = placement["anchor_y"] - sw_ft / 2
                draw_dimension_v(ax, W, sy, sy + sw_ft,
                                 f'{format_feet_inches(sw_ft)} OPENING',
                                 offset=max(W * 0.08, 3), color='#c62828', fontsize=4.5)

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
