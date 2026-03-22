"""
SimpleBlueprints — Sheet A-6: Site Plan
Shows property boundaries, setbacks, house footprint, and deck placement.
S24: Zone-aware — draws composite deck outline for multi-zone configs.
S28: Consumes p.sitePlan when present, falls back to flat params.
     Independent left/right setbacks, address/parcel on sheet,
     house placement matches frontend SVG preview, deckOffset applied.
S29: houseDistFromStreet support (house can be further from street than setback).
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyArrowPatch
import numpy as np
from .zone_utils import get_additive_rects, get_cutout_rects, get_bounding_box

BRAND = {
    "dark": "#1a1f16", "green": "#3d5a2e", "cream": "#faf8f3",
    "mute": "#7a8068", "border": "#ddd8cc", "red": "#c62828",
    "blue": "#1565c0",
}


def _extract_site_params(params, calc):
    """
    Extract site plan parameters.
    Dimensions always come from flat params (what the sliders write to).
    Metadata (address, parcel, street, house label) pulled from sitePlan if present.
    When the frontend migrates sliders to write p.sitePlan directly, this
    function can be updated to prefer sitePlan for dimensions too.
    """
    sp = params.get("sitePlan") or {}
    pi = params.get("projectInfo") or {}

    sb_side = params.get("setbackSide", 5)
    sb_front = params.get("setbackFront", 25)

    return {
        # Dimensions from flat params (what sliders update)
        "lot_w": params.get("lotWidth", 80),
        "lot_d": params.get("lotDepth", 120),
        "sb_front": sb_front,
        "sb_rear": params.get("setbackRear", 20),
        "sb_left": sb_side,
        "sb_right": sb_side,
        "house_w": params.get("houseWidth", 40),
        "house_d": params.get("houseDepth", 30),
        "house_x": params.get("houseOffsetSide", 20),
        "house_y": params.get("houseDistFromStreet") or sb_front,           # Match frontend SVG preview
        # Metadata from sitePlan (if set) or projectInfo fallback
        "house_label": (sp.get("houseLabel") or "EXISTING SINGLE\nFAMILY RESIDENCE").upper(),
        "address": sp.get("address") or pi.get("address", ""),
        "parcel_id": sp.get("parcelId") or pi.get("lot", ""),
        "street_name": sp.get("streetName", ""),
    }


def draw_site_plan(fig, params, calc):
    """Draw Sheet A-6: Site Plan showing property, setbacks, house and deck."""

    # === Unified param extraction (sitePlan or flat) ===
    sp = _extract_site_params(params, calc)
    lot_w = sp["lot_w"]
    lot_d = sp["lot_d"]
    sb_front = sp["sb_front"]
    sb_rear = sp["sb_rear"]
    sb_left = sp["sb_left"]
    sb_right = sp["sb_right"]
    house_w = sp["house_w"]
    house_d = sp["house_d"]
    house_x = sp["house_x"]
    house_y = sp["house_y"]
    house_label = sp["house_label"]
    address = sp["address"]
    parcel_id = sp["parcel_id"]
    street_name = sp["street_name"]

    deck_w = calc["width"]
    deck_d = calc["depth"]
    deck_offset = params.get("deckOffset", 0)
    attachment = calc.get("attachment", "ledger")
    zones = params.get("zones", [])

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

    # === SETBACK LINES (dashed, independent left/right) ===
    sb_style = dict(fc='none', ec=BRAND["red"], lw=1, linestyle='--')
    setback_rect = patches.Rectangle(
        (sb_left, sb_front),
        lot_w - sb_left - sb_right,
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

    if sb_left > 0:
        ax.text(sb_left / 2, lot_d / 2, f"{sb_left}'\nSIDE",
                ha='center', va='center', fontsize=5, fontfamily='monospace',
                color=BRAND["red"], fontweight='bold', rotation=90)
    if sb_right > 0:
        ax.text(lot_w - sb_right / 2, lot_d / 2, f"{sb_right}'\nSIDE",
                ha='center', va='center', fontsize=5, fontfamily='monospace',
                color=BRAND["red"], fontweight='bold', rotation=90)

    # === HOUSE FOOTPRINT ===
    house_rect = patches.Rectangle(
        (house_x, house_y), house_w, house_d,
        fc='#e8e6e0', ec=BRAND["dark"], lw=1.5, hatch='///', zorder=3
    )
    ax.add_patch(house_rect)
    ax.text(house_x + house_w / 2, house_y + house_d / 2,
            house_label,
            ha='center', va='center', fontsize=7, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"], zorder=4)

    # House dimensions
    ax.text(house_x + house_w / 2, house_y - 2.5, f"{house_w}'",
            ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
            fontweight='bold')
    ax.text(house_x - 3, house_y + house_d / 2, f"{house_d}'",
            ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
            fontweight='bold', rotation=90)

    # === PROPOSED DECK (zone-aware) ===
    # Zone 0 origin: centered on house rear wall, offset by deckOffset
    z0_x = house_x + (house_w - deck_w) / 2 + deck_offset
    z0_y = house_y + house_d

    # Get zone rects from zone_utils
    add_rects = get_additive_rects(params)
    cut_rects = get_cutout_rects(params)

    # Draw each additive zone rect
    for ar in add_rects:
        r = ar["rect"]
        rx, ry = z0_x + r["x"], z0_y + r["y"]
        rect_patch = patches.Rectangle(
            (rx, ry), r["w"], r["d"],
            fc='#d4c4a0', ec=BRAND["green"], lw=2, zorder=3
        )
        ax.add_patch(rect_patch)

    # Draw cutout rects (punch holes with lot background)
    for cr in cut_rects:
        r = cr["rect"]
        rx, ry = z0_x + r["x"], z0_y + r["y"]
        rect_patch = patches.Rectangle(
            (rx, ry), r["w"], r["d"],
            fc='white', ec=BRAND["green"], lw=1.5, linestyle='--', zorder=4
        )
        ax.add_patch(rect_patch)

    # Bounding box in site-plan coords (for dims + distances)
    bb = get_bounding_box(params)
    bb_x = z0_x + bb["x"]
    bb_y = z0_y + bb["y"]
    bb_w = bb["w"]
    bb_d = bb["d"]

    # Total area for label
    total_area = sum(r["rect"]["w"] * r["rect"]["d"] for r in add_rects)
    total_area -= sum(r["rect"]["w"] * r["rect"]["d"] for r in cut_rects)

    # Deck label (centered on zone 0)
    if zones:
        label = f"PROPOSED DECK\n{total_area:.0f} S.F."
    else:
        label = f"PROPOSED DECK\n{deck_w}'\u00D7{deck_d}'"

    ax.text(z0_x + deck_w / 2, z0_y + deck_d / 2, label,
            ha='center', va='center', fontsize=7, fontweight='bold',
            fontfamily='monospace', color=BRAND["green"], zorder=5)

    # Deck dimensions (bounding box)
    ax.annotate('', xy=(bb_x + bb_w, bb_y + bb_d + 3),
                xytext=(bb_x, bb_y + bb_d + 3),
                arrowprops=dict(arrowstyle='<->', color=BRAND["blue"], lw=0.8))
    ax.text(bb_x + bb_w / 2, bb_y + bb_d + 4.5, f"{bb_w:.0f}'",
            ha='center', fontsize=6, fontweight='bold', fontfamily='monospace',
            color=BRAND["blue"])

    ax.annotate('', xy=(bb_x + bb_w + 3, bb_y + bb_d),
                xytext=(bb_x + bb_w + 3, bb_y),
                arrowprops=dict(arrowstyle='<->', color=BRAND["blue"], lw=0.8))
    ax.text(bb_x + bb_w + 5, bb_y + bb_d / 2, f"{bb_d:.0f}'",
            ha='center', fontsize=6, fontweight='bold', fontfamily='monospace',
            color=BRAND["blue"], rotation=90)

    # === DISTANCE TO PROPERTY LINES from deck bounding box ===
    # Deck to rear property line
    rear_dist = lot_d - (bb_y + bb_d)
    if rear_dist > 0:
        mid_y = bb_y + bb_d + rear_dist / 2
        ax.plot([bb_x + bb_w / 2, bb_x + bb_w / 2],
                [bb_y + bb_d, lot_d],
                color=BRAND["mute"], lw=0.5, linestyle=':')
        ax.text(bb_x + bb_w / 2 + 3, mid_y, f"{rear_dist:.0f}'",
                ha='left', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
                fontweight='bold')

    # Deck to left property line
    left_dist = bb_x
    if left_dist > 0:
        ax.plot([0, bb_x], [bb_y + bb_d / 2, bb_y + bb_d / 2],
                color=BRAND["mute"], lw=0.5, linestyle=':')
        ax.text(left_dist / 2, bb_y + bb_d / 2 - 2, f"{left_dist:.0f}'",
                ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
                fontweight='bold')

    # Deck to right property line
    right_dist = lot_w - (bb_x + bb_w)
    if right_dist > 0:
        ax.plot([bb_x + bb_w, lot_w],
                [bb_y + bb_d / 2, bb_y + bb_d / 2],
                color=BRAND["mute"], lw=0.5, linestyle=':')
        ax.text(bb_x + bb_w + right_dist / 2, bb_y + bb_d / 2 - 2,
                f"{right_dist:.0f}'",
                ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
                fontweight='bold')

    # === STREET ===
    street_top = -margin + 3  # leave room for property line dims above
    ax.add_patch(patches.Rectangle((-margin, -margin), lot_w + 2 * margin, margin - 10,
                 fc='#e0e0e0', ec='none'))
    street_label = street_name.upper() if street_name else "S T R E E T"
    ax.text(lot_w / 2, -margin + 3, street_label,
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

    # Address and parcel below title
    subtitle_parts = []
    if address:
        subtitle_parts.append(address.upper())
    if parcel_id:
        subtitle_parts.append(f"PARCEL: {parcel_id}")
    if subtitle_parts:
        fig.text(0.44, 0.92, "  |  ".join(subtitle_parts),
                 ha='center', fontsize=7, fontfamily='monospace', color=BRAND["mute"])
        fig.text(0.44, 0.905, 'SCALE: NOT TO SCALE',
                 ha='center', fontsize=7, fontfamily='monospace', color=BRAND["mute"])
    else:
        fig.text(0.44, 0.92, 'SCALE: NOT TO SCALE',
                 ha='center', fontsize=7, fontfamily='monospace', color=BRAND["mute"])

    # === LEGEND (right side) ===
    leg_x = 0.84
    leg_y = 0.85
    fig.text(leg_x, leg_y, "LEGEND", fontsize=8, fontweight='bold',
             fontfamily='monospace', color=BRAND["dark"])

    legend_items = [
        ("\u2501\u2501\u2501", BRAND["dark"], "Property Line"),
        ("\u254C\u254C\u254C", BRAND["red"], "Setback Line"),
        ("\u2593\u2593\u2593", BRAND["dark"], "Existing House"),
        ("\u2588\u2588\u2588", BRAND["green"], "Proposed Deck"),
    ]
    for i, (sym, color, label) in enumerate(legend_items):
        y = leg_y - 0.035 * (i + 1)
        fig.text(leg_x, y, sym, fontsize=7, fontfamily='monospace',
                 color=color, fontweight='bold')
        fig.text(leg_x + 0.05, y, label, fontsize=6, fontfamily='monospace',
                 color=BRAND["dark"])

    # Setback summary (4 independent values)
    fig.text(leg_x, leg_y - 0.22, "SETBACKS", fontsize=8, fontweight='bold',
             fontfamily='monospace', color=BRAND["dark"])
    setbacks = [
        ("Front", sb_front),
        ("Rear", sb_rear),
        ("Left", sb_left),
        ("Right", sb_right),
    ]
    for i, (label, val) in enumerate(setbacks):
        y = leg_y - 0.22 - 0.03 * (i + 1)
        fig.text(leg_x, y, f"{label}:", fontsize=6, fontfamily='monospace',
                 color=BRAND["mute"], fontweight='bold')
        fig.text(leg_x + 0.06, y, f"{val}'", fontsize=6, fontfamily='monospace',
                 color=BRAND["dark"], fontweight='bold')
