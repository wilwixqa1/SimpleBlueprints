"""
SimpleBlueprints — Sheet A-5: Site Plan
Shows property boundaries, setbacks, house footprint, and deck placement.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyArrowPatch
import numpy as np

BRAND = {
    "dark": "#1a1f16", "green": "#3d5a2e", "cream": "#faf8f3",
    "mute": "#7a8068", "border": "#ddd8cc", "red": "#c62828",
    "blue": "#1565c0",
}


def format_feet_inches(feet):
    ft = int(feet)
    inches = (feet - ft) * 12
    if inches < 0.5:
        return f"{ft}'-0\""
    else:
        return f"{ft}'-{inches:.0f}\""


def draw_site_plan(fig, params, calc):
    """Draw Sheet A-5: Site Plan showing property, setbacks, house and deck."""

    # Extract params
    lot_w = params.get("lotWidth", 80)
    lot_d = params.get("lotDepth", 120)
    sb_front = params.get("setbackFront", 25)
    sb_side = params.get("setbackSide", 5)
    sb_rear = params.get("setbackRear", 20)
    house_w = params.get("houseWidth", 40)
    house_d = params.get("houseDepth", 30)
    house_off = params.get("houseOffsetSide", 20)
    deck_w = calc["width"]
    deck_d = calc["depth"]
    attachment = calc.get("attachment", "ledger")

    ax = fig.add_axes([0.08, 0.08, 0.72, 0.82])
    ax.set_aspect('equal')
    ax.axis('off')

    # Scale to fit
    margin = 15
    ax.set_xlim(-margin, lot_w + margin)
    ax.set_ylim(-margin, lot_d + margin)

    # === PROPERTY LINES ===
    lot_rect = patches.Rectangle((0, 0), lot_w, lot_d,
                                  fill=False, ec=BRAND["dark"], lw=2.5,
                                  linestyle='-')
    ax.add_patch(lot_rect)

    # Property line dimensions
    dim_off = 5
    # Bottom (front)
    ax.annotate('', xy=(lot_w, -dim_off), xytext=(0, -dim_off),
                arrowprops=dict(arrowstyle='<->', color=BRAND["dark"], lw=1))
    ax.text(lot_w / 2, -dim_off - 2.5, f"PROPERTY LINE  {lot_w}'",
            ha='center', fontsize=7, fontweight='bold', fontfamily='monospace',
            color=BRAND["dark"])

    # Top (rear)
    ax.annotate('', xy=(lot_w, lot_d + dim_off), xytext=(0, lot_d + dim_off),
                arrowprops=dict(arrowstyle='<->', color=BRAND["dark"], lw=1))
    ax.text(lot_w / 2, lot_d + dim_off + 1.5, f"PROPERTY LINE  {lot_w}'",
            ha='center', fontsize=7, fontweight='bold', fontfamily='monospace',
            color=BRAND["dark"])

    # Left
    ax.annotate('', xy=(-dim_off, lot_d), xytext=(-dim_off, 0),
                arrowprops=dict(arrowstyle='<->', color=BRAND["dark"], lw=1))
    ax.text(-dim_off - 2, lot_d / 2, f"PROPERTY LINE  {lot_d}'",
            ha='center', fontsize=7, fontweight='bold', fontfamily='monospace',
            color=BRAND["dark"], rotation=90)

    # Right
    ax.annotate('', xy=(lot_w + dim_off, lot_d), xytext=(lot_w + dim_off, 0),
                arrowprops=dict(arrowstyle='<->', color=BRAND["dark"], lw=1))
    ax.text(lot_w + dim_off + 2.5, lot_d / 2, f"{lot_d}'",
            ha='center', fontsize=7, fontweight='bold', fontfamily='monospace',
            color=BRAND["dark"], rotation=90)

    # === SETBACK LINES (dashed) ===
    sb_style = dict(fc='none', ec=BRAND["red"], lw=1, linestyle='--')
    setback_rect = patches.Rectangle(
        (sb_side, sb_front),
        lot_w - 2 * sb_side,
        lot_d - sb_front - sb_rear,
        **sb_style
    )
    ax.add_patch(setback_rect)

    # Setback labels
    if sb_front > 0:
        ax.text(lot_w / 2, sb_front / 2, f"{sb_front}' FRONT SETBACK",
                ha='center', va='center', fontsize=6, fontfamily='monospace',
                color=BRAND["red"], fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.3', fc='white', ec='none', alpha=0.8))

    if sb_rear > 0:
        ax.text(lot_w / 2, lot_d - sb_rear / 2, f"{sb_rear}' REAR SETBACK",
                ha='center', va='center', fontsize=6, fontfamily='monospace',
                color=BRAND["red"], fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.3', fc='white', ec='none', alpha=0.8))

    if sb_side > 0:
        ax.text(sb_side / 2, lot_d / 2, f"{sb_side}'\nSIDE",
                ha='center', va='center', fontsize=5, fontfamily='monospace',
                color=BRAND["red"], fontweight='bold', rotation=90)
        ax.text(lot_w - sb_side / 2, lot_d / 2, f"{sb_side}'\nSIDE",
                ha='center', va='center', fontsize=5, fontfamily='monospace',
                color=BRAND["red"], fontweight='bold', rotation=90)

    # === HOUSE FOOTPRINT ===
    # House positioned: left edge at house_off, front face at sb_front + some gap
    house_y = sb_front + 10  # 10' from front setback
    house_x = house_off

    house_rect = patches.Rectangle(
        (house_x, house_y), house_w, house_d,
        fc='#e8e6e0', ec=BRAND["dark"], lw=1.5, hatch='///', zorder=3
    )
    ax.add_patch(house_rect)
    ax.text(house_x + house_w / 2, house_y + house_d / 2,
            "EXISTING SINGLE\nFAMILY RESIDENCE",
            ha='center', va='center', fontsize=7, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"], zorder=4)

    # House dimensions
    ax.text(house_x + house_w / 2, house_y - 2.5, f"{house_w}'",
            ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
            fontweight='bold')
    ax.text(house_x - 3, house_y + house_d / 2, f"{house_d}'",
            ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
            fontweight='bold', rotation=90)

    # === PROPOSED DECK ===
    # Deck attaches to rear of house, centered on house
    deck_x = house_x + (house_w - deck_w) / 2
    deck_y = house_y + house_d  # rear of house

    deck_rect = patches.Rectangle(
        (deck_x, deck_y), deck_w, deck_d,
        fc='#d4c4a0', ec=BRAND["green"], lw=2, zorder=3
    )
    ax.add_patch(deck_rect)

    ax.text(deck_x + deck_w / 2, deck_y + deck_d / 2,
            f"PROPOSED DECK\n{deck_w}'×{deck_d}'",
            ha='center', va='center', fontsize=7, fontweight='bold',
            fontfamily='monospace', color=BRAND["green"], zorder=4)

    # Deck dimensions
    ax.annotate('', xy=(deck_x + deck_w, deck_y + deck_d + 3),
                xytext=(deck_x, deck_y + deck_d + 3),
                arrowprops=dict(arrowstyle='<->', color=BRAND["blue"], lw=0.8))
    ax.text(deck_x + deck_w / 2, deck_y + deck_d + 4.5, f"{deck_w}'",
            ha='center', fontsize=6, fontweight='bold', fontfamily='monospace',
            color=BRAND["blue"])

    ax.annotate('', xy=(deck_x + deck_w + 3, deck_y + deck_d),
                xytext=(deck_x + deck_w + 3, deck_y),
                arrowprops=dict(arrowstyle='<->', color=BRAND["blue"], lw=0.8))
    ax.text(deck_x + deck_w + 5, deck_y + deck_d / 2, f"{deck_d}'",
            ha='center', fontsize=6, fontweight='bold', fontfamily='monospace',
            color=BRAND["blue"], rotation=90)

    # === DISTANCE TO PROPERTY LINES from deck ===
    # Deck to rear property line
    rear_dist = lot_d - (deck_y + deck_d)
    if rear_dist > 0:
        mid_y = deck_y + deck_d + rear_dist / 2
        ax.plot([deck_x + deck_w / 2, deck_x + deck_w / 2],
                [deck_y + deck_d, lot_d],
                color=BRAND["mute"], lw=0.5, linestyle=':')
        ax.text(deck_x + deck_w / 2 + 3, mid_y, f"{rear_dist:.0f}'",
                ha='left', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
                fontweight='bold')

    # Deck to left property line
    left_dist = deck_x
    if left_dist > 0:
        ax.plot([0, deck_x], [deck_y + deck_d / 2, deck_y + deck_d / 2],
                color=BRAND["mute"], lw=0.5, linestyle=':')
        ax.text(left_dist / 2, deck_y + deck_d / 2 - 2, f"{left_dist:.0f}'",
                ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
                fontweight='bold')

    # Deck to right property line
    right_dist = lot_w - (deck_x + deck_w)
    if right_dist > 0:
        ax.plot([deck_x + deck_w, lot_w],
                [deck_y + deck_d / 2, deck_y + deck_d / 2],
                color=BRAND["mute"], lw=0.5, linestyle=':')
        ax.text(deck_x + deck_w + right_dist / 2, deck_y + deck_d / 2 - 2,
                f"{right_dist:.0f}'",
                ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
                fontweight='bold')

    # === STREET ===
    ax.add_patch(patches.Rectangle((-margin, -margin), lot_w + 2 * margin, margin - 1,
                 fc='#e0e0e0', ec='none'))
    ax.text(lot_w / 2, -margin / 2 - 0.5, "S T R E E T",
            ha='center', va='center', fontsize=10, fontweight='bold',
            fontfamily='monospace', color=BRAND["mute"])

    # === NORTH ARROW ===
    na_x, na_y = lot_w + 8, lot_d - 10
    ax.annotate('', xy=(na_x, na_y + 8), xytext=(na_x, na_y),
                arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=2))
    ax.text(na_x, na_y + 9.5, "N", ha='center', fontsize=12, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])

    # === TITLE ===
    fig.text(0.44, 0.94, "SITE PLAN", ha='center',
             fontsize=16, fontweight='bold', fontfamily='monospace',
             color=BRAND["dark"])
    fig.text(0.44, 0.92, f'SCALE: NOT TO SCALE',
             ha='center', fontsize=7, fontfamily='monospace', color=BRAND["mute"])

    # === LEGEND (right side) ===
    leg_x = 0.84
    leg_y = 0.85
    fig.text(leg_x, leg_y, "LEGEND", fontsize=8, fontweight='bold',
             fontfamily='monospace', color=BRAND["dark"])

    legend_items = [
        ("━━━", BRAND["dark"], "Property Line"),
        ("╌╌╌", BRAND["red"], "Setback Line"),
        ("▓▓▓", BRAND["dark"], "Existing House"),
        ("███", BRAND["green"], "Proposed Deck"),
    ]
    for i, (sym, color, label) in enumerate(legend_items):
        y = leg_y - 0.035 * (i + 1)
        fig.text(leg_x, y, sym, fontsize=7, fontfamily='monospace',
                 color=color, fontweight='bold')
        fig.text(leg_x + 0.05, y, label, fontsize=6, fontfamily='monospace',
                 color=BRAND["dark"])

    # Setback summary
    fig.text(leg_x, leg_y - 0.22, "SETBACKS", fontsize=8, fontweight='bold',
             fontfamily='monospace', color=BRAND["dark"])
    setbacks = [
        ("Front", sb_front),
        ("Side", sb_side),
        ("Rear", sb_rear),
    ]
    for i, (label, val) in enumerate(setbacks):
        y = leg_y - 0.22 - 0.03 * (i + 1)
        fig.text(leg_x, y, f"{label}:", fontsize=6, fontfamily='monospace',
                 color=BRAND["mute"], fontweight='bold')
        fig.text(leg_x + 0.06, y, f"{val}'", fontsize=6, fontfamily='monospace',
                 color=BRAND["dark"], fontweight='bold')
