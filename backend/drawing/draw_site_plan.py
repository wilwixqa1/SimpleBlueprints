"""
SimpleBlueprints - Sheet A-6: Site Plan
Shows property boundaries, setbacks, house footprint, and deck placement.
S24: Zone-aware - draws composite deck outline for multi-zone configs.
S28: Consumes p.sitePlan when present, falls back to flat params.
     Independent left/right setbacks, address/parcel on sheet,
     house placement matches frontend SVG preview, deckOffset applied.
S29: houseDistFromStreet support (house can be further from street than setback).
S32: Site elements, stair projection, impervious coverage on PDF.
"""

import math
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

# Element colors matching frontend sitePlanView.js
EL_STYLES = {
    "driveway":  {"fc": "#d5d5d5", "ec": "#888888", "hatch": None},
    "garage":    {"fc": "#e0d8cc", "ec": "#888888", "hatch": "///"},
    "shed":      {"fc": "#d4c5a9", "ec": "#888888", "hatch": "///"},
    "pool":      {"fc": "#b3d9ff", "ec": "#1976d2", "hatch": None},
    "patio":     {"fc": "#d7ccc8", "ec": "#888888", "hatch": None},
    "tree":      {"fc": "#8bc34a", "ec": "#558b2f", "hatch": None},
    "ac_unit":   {"fc": "#c0c0c0", "ec": "#888888", "hatch": None},
    "fence":     {"fc": "#8d6e63", "ec": "#5d4037", "hatch": None},
    "walkway":   {"fc": "#e0e0e0", "ec": "#888888", "hatch": None},
}

IMPERVIOUS_TYPES = {"driveway", "garage", "shed", "patio"}


def _extract_site_params(params, calc):
    """
    Extract site plan parameters.
    Dimensions always come from flat params (what the sliders write to).
    Metadata (address, parcel, street, house label) pulled from sitePlan if present.
    """
    sp = params.get("sitePlan") or {}
    pi = params.get("projectInfo") or {}

    sb_side = params.get("setbackSide", 5)
    sb_front = params.get("setbackFront", 25)

    return {
        "lot_w": params.get("lotWidth", 80),
        "lot_d": params.get("lotDepth", 120),
        "sb_front": sb_front,
        "sb_rear": params.get("setbackRear", 20),
        "sb_left": sb_side,
        "sb_right": sb_side,
        "house_w": params.get("houseWidth", 40),
        "house_d": params.get("houseDepth", 30),
        "house_x": params.get("houseOffsetSide", 20),
        "house_y": params.get("houseDistFromStreet") or sb_front,
        "house_label": (sp.get("houseLabel") or "EXISTING SINGLE\nFAMILY RESIDENCE").upper(),
        "address": sp.get("address") or pi.get("address", ""),
        "parcel_id": sp.get("parcelId") or pi.get("lot", ""),
        "street_name": params.get("streetName") or sp.get("streetName", ""),
    }


def draw_site_plan(fig, params, calc):
    """Draw Sheet A-6: Site Plan showing property, setbacks, house and deck."""

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

    margin = 15
    ax.set_xlim(-margin, lot_w + margin)
    ax.set_ylim(-margin, lot_d + margin)

    # === PROPERTY LINES ===
    lot_rect = patches.Rectangle((0, 0), lot_w, lot_d,
                                  fill=False, ec=BRAND["dark"], lw=2.5,
                                  linestyle='-')
    ax.add_patch(lot_rect)

    dim_off = 5
    ax.annotate('', xy=(lot_w, -dim_off), xytext=(0, -dim_off),
                arrowprops=dict(arrowstyle='<->', color=BRAND["dark"], lw=1))
    ax.text(lot_w / 2, -dim_off - 2.5, f"PROPERTY LINE  {lot_w}'",
            ha='center', fontsize=7, fontweight='bold', fontfamily='monospace',
            color=BRAND["dark"])

    ax.annotate('', xy=(lot_w, lot_d + dim_off), xytext=(0, lot_d + dim_off),
                arrowprops=dict(arrowstyle='<->', color=BRAND["dark"], lw=1))
    ax.text(lot_w / 2, lot_d + dim_off + 1.5, f"PROPERTY LINE  {lot_w}'",
            ha='center', fontsize=7, fontweight='bold', fontfamily='monospace',
            color=BRAND["dark"])

    ax.annotate('', xy=(-dim_off, lot_d), xytext=(-dim_off, 0),
                arrowprops=dict(arrowstyle='<->', color=BRAND["dark"], lw=1))
    ax.text(-dim_off - 2, lot_d / 2, f"PROPERTY LINE  {lot_d}'",
            ha='center', fontsize=7, fontweight='bold', fontfamily='monospace',
            color=BRAND["dark"], rotation=90)

    ax.annotate('', xy=(lot_w + dim_off, lot_d), xytext=(lot_w + dim_off, 0),
                arrowprops=dict(arrowstyle='<->', color=BRAND["dark"], lw=1))
    ax.text(lot_w + dim_off + 2.5, lot_d / 2, f"{lot_d}'",
            ha='center', fontsize=7, fontweight='bold', fontfamily='monospace',
            color=BRAND["dark"], rotation=90)

    # === SETBACK LINES ===
    sb_style = dict(fc='none', ec=BRAND["red"], lw=1, linestyle='--')
    setback_rect = patches.Rectangle(
        (sb_left, sb_front),
        lot_w - sb_left - sb_right,
        lot_d - sb_front - sb_rear,
        **sb_style
    )
    ax.add_patch(setback_rect)

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

    ax.text(house_x + house_w / 2, house_y - 2.5, f"{house_w}'",
            ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
            fontweight='bold')
    ax.text(house_x - 3, house_y + house_d / 2, f"{house_d}'",
            ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
            fontweight='bold', rotation=90)

    # === SITE ELEMENTS (S32) ===
    site_elements = params.get("siteElements") or []
    el_impervious_area = 0
    for el in site_elements:
        ex = el.get("x", 0)
        ey = el.get("y", 0)
        ew = el.get("w", 4)
        ed = el.get("d", 4)
        etype = el.get("type", "shed")
        elabel = el.get("label", "")
        style = EL_STYLES.get(etype, EL_STYLES["shed"])

        if etype in IMPERVIOUS_TYPES:
            el_impervious_area += ew * ed

        if etype == "tree":
            r = ew / 2
            circle = plt.Circle((ex + r, ey + r), r,
                                fc=style["fc"], ec=style["ec"],
                                alpha=0.4, lw=0.8, zorder=2)
            ax.add_patch(circle)
            # Trunk dot
            trunk = plt.Circle((ex + r, ey + r), 0.5,
                               fc='#33691e', ec='none', zorder=2.1)
            ax.add_patch(trunk)
            if elabel and r > 2:
                ax.text(ex + r, ey + r, elabel,
                        ha='center', va='center', fontsize=5,
                        fontfamily='monospace', color='#555', zorder=2.2)
        elif etype == "pool":
            pool_rect = patches.FancyBboxPatch(
                (ex, ey), ew, ed,
                boxstyle=f"round,pad={min(1, ew / 6):.1f}",
                fc=style["fc"], ec=style["ec"],
                alpha=0.5, lw=0.8, zorder=2)
            ax.add_patch(pool_rect)
            if elabel and ew > 4 and ed > 3:
                ax.text(ex + ew / 2, ey + ed / 2, elabel,
                        ha='center', va='center', fontsize=5,
                        fontfamily='monospace', color='#555', zorder=2.1)
        elif etype == "fence":
            fence_rect = patches.Rectangle(
                (ex, ey), max(ew, 0.5), max(ed, 0.5),
                fc=style["fc"], ec=style["ec"],
                alpha=0.6, lw=0.8, linestyle='--', zorder=2)
            ax.add_patch(fence_rect)
            if elabel and max(ew, ed) > 8:
                ax.text(ex + ew / 2, ey + ed / 2, elabel,
                        ha='center', va='center', fontsize=5,
                        fontfamily='monospace', color='#555',
                        rotation=90 if ed > ew else 0, zorder=2.1)
        else:
            el_rect = patches.Rectangle(
                (ex, ey), ew, ed,
                fc=style["fc"], ec=style["ec"],
                alpha=0.5, lw=0.8, zorder=2)
            ax.add_patch(el_rect)
            if style["hatch"]:
                hatch_rect = patches.Rectangle(
                    (ex, ey), ew, ed,
                    fc='none', ec='#cccccc', hatch='///',
                    alpha=0.3, lw=0, zorder=2.05)
                ax.add_patch(hatch_rect)
            if elabel and ew > 3 and ed > 2:
                ax.text(ex + ew / 2, ey + ed / 2, elabel,
                        ha='center', va='center', fontsize=5,
                        fontfamily='monospace', color='#555',
                        fontweight='bold', zorder=2.1)

    # === PROPOSED DECK (zone-aware) ===
    z0_x = house_x + (house_w - deck_w) / 2 + deck_offset
    z0_y = house_y + house_d

    add_rects = get_additive_rects(params)
    cut_rects = get_cutout_rects(params)

    for ar in add_rects:
        r = ar["rect"]
        rx, ry = z0_x + r["x"], z0_y + r["y"]
        rect_patch = patches.Rectangle(
            (rx, ry), r["w"], r["d"],
            fc='#d4c4a0', ec=BRAND["green"], lw=2, zorder=3
        )
        ax.add_patch(rect_patch)

    for cr in cut_rects:
        r = cr["rect"]
        rx, ry = z0_x + r["x"], z0_y + r["y"]
        rect_patch = patches.Rectangle(
            (rx, ry), r["w"], r["d"],
            fc='white', ec=BRAND["green"], lw=1.5, linestyle='--', zorder=4
        )
        ax.add_patch(rect_patch)

    bb = get_bounding_box(params)
    bb_x = z0_x + bb["x"]
    bb_y = z0_y + bb["y"]
    bb_w = bb["w"]
    bb_d = bb["d"]

    total_area = sum(r["rect"]["w"] * r["rect"]["d"] for r in add_rects)
    total_area -= sum(r["rect"]["w"] * r["rect"]["d"] for r in cut_rects)

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

    # === STAIR PROJECTION (S32) ===
    has_stairs = params.get("hasStairs", False)
    deck_height = params.get("height", 4)
    if has_stairs and deck_height > 0:
        rise_in = 7.5
        tread_in = 10
        n_risers = math.ceil(deck_height * 12 / rise_in)
        stair_run = (n_risers - 1) * tread_in / 12
        st_w = params.get("stairWidth", 4)
        st_off = params.get("stairOffset", 0)
        loc = params.get("stairLocation", "front")
        land_d = 4 if params.get("hasLanding", False) else 0

        if loc == "front":
            st_x = z0_x + deck_w / 2 + st_off - st_w / 2
            st_y = z0_y + deck_d
            st_draw_w = st_w
            st_draw_d = stair_run + land_d
        elif loc == "left":
            st_x = z0_x - stair_run - land_d
            st_y = z0_y + deck_d / 2 + st_off - st_w / 2
            st_draw_w = stair_run + land_d
            st_draw_d = st_w
        else:  # right
            st_x = z0_x + deck_w
            st_y = z0_y + deck_d / 2 + st_off - st_w / 2
            st_draw_w = stair_run + land_d
            st_draw_d = st_w

        # Main stair rect
        stair_rect = patches.Rectangle(
            (st_x, st_y), st_draw_w, st_draw_d,
            fc='#e8d5b7', ec='#8B7355', alpha=0.5,
            lw=0.8, linestyle='--', zorder=2.5)
        ax.add_patch(stair_rect)

        # Tread lines
        n_lines = min(8, n_risers - 1)
        if loc == "front" and st_draw_d > 2:
            for ti in range(1, n_lines + 1):
                frac = ti / (n_lines + 1)
                ty = st_y + frac * stair_run
                ax.plot([st_x + 0.3, st_x + st_w - 0.3], [ty, ty],
                        color='#8B7355', lw=0.4, alpha=0.5, zorder=2.6)
        elif loc == "left" and st_draw_w > 2:
            for ti in range(1, n_lines + 1):
                frac = ti / (n_lines + 1)
                tx = st_x + st_draw_w - frac * stair_run
                ax.plot([tx, tx], [st_y + 0.3, st_y + st_w - 0.3],
                        color='#8B7355', lw=0.4, alpha=0.5, zorder=2.6)
        elif loc == "right" and st_draw_w > 2:
            for ti in range(1, n_lines + 1):
                frac = ti / (n_lines + 1)
                tx = st_x + frac * stair_run
                ax.plot([tx, tx], [st_y + 0.3, st_y + st_w - 0.3],
                        color='#8B7355', lw=0.4, alpha=0.5, zorder=2.6)

        # Landing pad
        if land_d > 0:
            if loc == "front":
                lx, ly, lw, ld = st_x, st_y + stair_run, st_w, land_d
            elif loc == "left":
                lx, ly, lw, ld = st_x, st_y, land_d, st_w
            else:
                lx, ly, lw, ld = st_x + stair_run, st_y, land_d, st_w
            land_rect = patches.Rectangle(
                (lx, ly), lw, ld,
                fc='#d5c4a1', ec='#8B7355', alpha=0.4,
                lw=0.6, linestyle='--', zorder=2.5)
            ax.add_patch(land_rect)

        # Stair label
        if st_draw_w > 3 and st_draw_d > 2:
            ax.text(st_x + st_draw_w / 2, st_y + st_draw_d / 2,
                    "STAIRS", ha='center', va='center', fontsize=5,
                    fontfamily='monospace', color='#8B7355',
                    fontweight='bold', zorder=2.7)

        # Run dimension
        if loc == "front" and st_draw_d > 2:
            ax.text(st_x + st_draw_w + 2, st_y + st_draw_d / 2,
                    f"{stair_run:.1f}'", ha='left', fontsize=5,
                    fontfamily='monospace', color='#8B7355',
                    fontweight='bold', zorder=2.7)

    # === DISTANCE TO PROPERTY LINES ===
    rear_dist = lot_d - (bb_y + bb_d)
    if rear_dist > 0:
        mid_y = bb_y + bb_d + rear_dist / 2
        ax.plot([bb_x + bb_w / 2, bb_x + bb_w / 2],
                [bb_y + bb_d, lot_d],
                color=BRAND["mute"], lw=0.5, linestyle=':')
        ax.text(bb_x + bb_w / 2 + 3, mid_y, f"{rear_dist:.0f}'",
                ha='left', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
                fontweight='bold')

    left_dist = bb_x
    if left_dist > 0:
        ax.plot([0, bb_x], [bb_y + bb_d / 2, bb_y + bb_d / 2],
                color=BRAND["mute"], lw=0.5, linestyle=':')
        ax.text(left_dist / 2, bb_y + bb_d / 2 - 2, f"{left_dist:.0f}'",
                ha='center', fontsize=6, fontfamily='monospace', color=BRAND["mute"],
                fontweight='bold')

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

    # === LEGEND ===
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
    if has_stairs and deck_height > 0:
        legend_items.append(("\u254C\u254C\u254C", "#8B7355", "Stair Projection"))
    if site_elements:
        legend_items.append(("\u2588\u2588\u2588", "#888888", "Site Elements"))

    for i, (sym, color, label) in enumerate(legend_items):
        y = leg_y - 0.035 * (i + 1)
        fig.text(leg_x, y, sym, fontsize=7, fontfamily='monospace',
                 color=color, fontweight='bold')
        fig.text(leg_x + 0.05, y, label, fontsize=6, fontfamily='monospace',
                 color=BRAND["dark"])

    # Setback summary
    setback_y = leg_y - 0.035 * (len(legend_items) + 1) - 0.02
    fig.text(leg_x, setback_y, "SETBACKS", fontsize=8, fontweight='bold',
             fontfamily='monospace', color=BRAND["dark"])
    setbacks = [
        ("Front", sb_front),
        ("Rear", sb_rear),
        ("Left", sb_left),
        ("Right", sb_right),
    ]
    for i, (label, val) in enumerate(setbacks):
        y = setback_y - 0.03 * (i + 1)
        fig.text(leg_x, y, f"{label}:", fontsize=6, fontfamily='monospace',
                 color=BRAND["mute"], fontweight='bold')
        fig.text(leg_x + 0.06, y, f"{val}'", fontsize=6, fontfamily='monospace',
                 color=BRAND["dark"], fontweight='bold')

    # === LOT COVERAGE (S32) ===
    lot_area = lot_w * lot_d
    house_area = house_w * house_d
    deck_area = total_area if total_area > 0 else deck_w * deck_d
    total_impervious = house_area + deck_area + el_impervious_area
    coverage_pct = (total_impervious / lot_area * 100) if lot_area > 0 else 0

    cov_y = setback_y - 0.03 * (len(setbacks) + 1) - 0.02
    fig.text(leg_x, cov_y, "LOT COVERAGE", fontsize=8, fontweight='bold',
             fontfamily='monospace', color=BRAND["dark"])
    fig.text(leg_x, cov_y - 0.03, f"House:", fontsize=6, fontfamily='monospace',
             color=BRAND["mute"], fontweight='bold')
    fig.text(leg_x + 0.06, cov_y - 0.03, f"{house_area:.0f} SF", fontsize=6,
             fontfamily='monospace', color=BRAND["dark"], fontweight='bold')
    fig.text(leg_x, cov_y - 0.06, f"Deck:", fontsize=6, fontfamily='monospace',
             color=BRAND["mute"], fontweight='bold')
    fig.text(leg_x + 0.06, cov_y - 0.06, f"{deck_area:.0f} SF", fontsize=6,
             fontfamily='monospace', color=BRAND["dark"], fontweight='bold')
    if el_impervious_area > 0:
        fig.text(leg_x, cov_y - 0.09, f"Other:", fontsize=6, fontfamily='monospace',
                 color=BRAND["mute"], fontweight='bold')
        fig.text(leg_x + 0.06, cov_y - 0.09, f"{el_impervious_area:.0f} SF", fontsize=6,
                 fontfamily='monospace', color=BRAND["dark"], fontweight='bold')
        total_line_y = cov_y - 0.12
    else:
        total_line_y = cov_y - 0.09
    warn_color = "#e65100" if coverage_pct > 45 else BRAND["dark"]
    fig.text(leg_x, total_line_y, f"Total:", fontsize=6, fontfamily='monospace',
             color=BRAND["mute"], fontweight='bold')
    fig.text(leg_x + 0.06, total_line_y, f"{coverage_pct:.1f}%", fontsize=7,
             fontfamily='monospace', color=warn_color, fontweight='bold')
