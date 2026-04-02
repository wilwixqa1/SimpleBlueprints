"""
SimpleBlueprints - Sheet A-6: Site Plan
Shows property boundaries, setbacks, house footprint, and deck placement.
S24: Zone-aware - draws composite deck outline for multi-zone configs.
S28: Consumes p.sitePlan when present, falls back to flat params.
     Independent left/right setbacks, address/parcel on sheet,
     house placement matches frontend SVG preview, deckOffset applied.
S29: houseDistFromStreet support (house can be further from street than setback).
S32: Site elements, stair projection, impervious coverage on PDF.
S44: Graphic scale bar, expanded area tabulations, disclaimer.
"""

import math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.lines import Line2D
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
        "zoning": pi.get("zoning", ""),
        "county": pi.get("county", ""),
        "street_name": params.get("streetName") or sp.get("streetName", ""),
        "lot_vertices": params.get("lotVertices"),
        "lot_edges": params.get("lotEdges"),
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
    zoning = sp["zoning"]
    county = sp["county"]
    street_name = sp["street_name"]

    deck_w = calc["width"]
    deck_d = calc["depth"]
    deck_offset = params.get("deckOffset", 0)
    attachment = calc.get("attachment", "ledger")
    zones = params.get("zones", [])

    ax = fig.add_axes([0.08, 0.08, 0.63, 0.82])
    ax.set_aspect('equal')
    ax.axis('off')

    # === LOT POLYGON (S37: polygon-aware) ===
    lot_verts = sp.get("lot_vertices")
    lot_edge_data = sp.get("lot_edges")
    if not lot_verts:
        lot_verts = [[0, 0], [lot_w, 0], [lot_w, lot_d], [0, lot_d]]
    if not lot_edge_data:
        lot_edge_data = [
            {"type": "street", "label": street_name, "length": lot_w, "setbackType": "front", "neighborLabel": ""},
            {"type": "property", "label": "", "length": lot_d, "setbackType": "side", "neighborLabel": ""},
            {"type": "property", "label": "", "length": lot_w, "setbackType": "rear", "neighborLabel": ""},
            {"type": "property", "label": "", "length": lot_d, "setbackType": "side", "neighborLabel": ""},
        ]
    n_verts = len(lot_verts)
    poly_max_x = max(v[0] for v in lot_verts)
    poly_max_y = max(v[1] for v in lot_verts)
    cx_lot = sum(v[0] for v in lot_verts) / n_verts
    cy_lot = sum(v[1] for v in lot_verts) / n_verts

    # S44: Adaptive scaling for large lots
    _lot_span = max(poly_max_x, poly_max_y)
    _sf = max(1.0, _lot_span / 120.0)  # 1.0 for default lots, ~4 for Welborn
    _is_large = _sf > 2.0  # True when lot span > 240'
    margin = max(15, 15 * _sf)

    ax.set_xlim(-margin, poly_max_x + margin)
    ax.set_ylim(-margin, poly_max_y + margin)

    # Lot boundary polygon
    lot_poly = plt.Polygon(lot_verts, fill=False, ec=BRAND["dark"], lw=2.5, closed=True)
    ax.add_patch(lot_poly)

    # Street edges: thicker overlay
    for ei in range(n_verts):
        e_info = lot_edge_data[ei] if ei < len(lot_edge_data) else {}
        if e_info.get("type") == "street":
            v1, v2 = lot_verts[ei], lot_verts[(ei + 1) % n_verts]
            ax.plot([v1[0], v2[0]], [v1[1], v2[1]],
                    color=BRAND["dark"], lw=4, solid_capstyle="round", zorder=1.5)

    # Per-edge dimension labels
    for ei in range(n_verts):
        v1 = lot_verts[ei]
        v2 = lot_verts[(ei + 1) % n_verts]
        e_info = lot_edge_data[ei] if ei < len(lot_edge_data) else {}
        e_len = e_info.get("length") or math.sqrt((v2[0]-v1[0])**2 + (v2[1]-v1[1])**2)
        mx, my = (v1[0]+v2[0])/2, (v1[1]+v2[1])/2
        edx, edy = v2[0]-v1[0], v2[1]-v1[1]
        seg_len = math.sqrt(edx*edx + edy*edy)
        if seg_len < 1:
            continue
        nx, ny = -edy/seg_len, edx/seg_len
        if nx*(cx_lot-mx) + ny*(cy_lot-my) > 0:
            nx, ny = -nx, -ny
        lx, ly = mx + nx * 4.5 * _sf, my + ny * 4.5 * _sf
        angle = math.degrees(math.atan2(edy, edx))
        while angle > 90: angle -= 180
        while angle < -90: angle += 180
        e_label = f"{e_len:.0f}'" if e_len == int(e_len) else f"{e_len:.1f}'"
        ax.text(lx, ly, e_label, ha="center", va="center",
                fontsize=7, fontweight="bold", fontfamily="monospace",
                color=BRAND["dark"], rotation=angle)

    # Per-edge neighbor labels
    for ei in range(n_verts):
        e_info = lot_edge_data[ei] if ei < len(lot_edge_data) else {}
        nlbl = e_info.get("neighborLabel", "")
        if not nlbl:
            continue
        v1 = lot_verts[ei]
        v2 = lot_verts[(ei + 1) % n_verts]
        mx, my = (v1[0]+v2[0])/2, (v1[1]+v2[1])/2
        edx, edy = v2[0]-v1[0], v2[1]-v1[1]
        seg_len = math.sqrt(edx*edx + edy*edy)
        if seg_len < 1:
            continue
        nx, ny = -edy/seg_len, edx/seg_len
        if nx*(cx_lot-mx) + ny*(cy_lot-my) > 0:
            nx, ny = -nx, -ny
        lx, ly = mx + nx * 9 * _sf, my + ny * 9 * _sf
        angle = math.degrees(math.atan2(edy, edx))
        while angle > 90: angle -= 180
        while angle < -90: angle += 180
        ax.text(lx, ly, nlbl.upper(), ha="center", va="center",
                fontsize=6, fontweight="bold", fontfamily="monospace",
                color=BRAND["mute"], fontstyle="italic", rotation=angle)

    # === SETBACK POLYGON (S37: polygon-aware) ===
    sb_map = {"front": sb_front, "rear": sb_rear, "side": max(sb_left, sb_right), "none": 0}
    sb_dists = []
    has_sb = False
    for ei in range(n_verts):
        e_info = lot_edge_data[ei] if ei < len(lot_edge_data) else {}
        sb_type = e_info.get("setbackType", "side")
        dist = sb_map.get(sb_type, 0)
        sb_dists.append(dist)
        if dist > 0:
            has_sb = True

    if has_sb:
        offset_lines = []
        for ei in range(n_verts):
            v1 = lot_verts[ei]
            v2 = lot_verts[(ei + 1) % n_verts]
            edx, edy = v2[0]-v1[0], v2[1]-v1[1]
            seg_len = math.sqrt(edx*edx + edy*edy)
            if seg_len < 0.01:
                offset_lines.append(None)
                continue
            nx, ny = -edy/seg_len, edx/seg_len
            emx, emy = (v1[0]+v2[0])/2, (v1[1]+v2[1])/2
            if nx*(cx_lot-emx) + ny*(cy_lot-emy) < 0:
                nx, ny = -nx, -ny
            d = sb_dists[ei]
            offset_lines.append({
                "x1": v1[0]+nx*d, "y1": v1[1]+ny*d,
                "x2": v2[0]+nx*d, "y2": v2[1]+ny*d
            })

        sb_verts_list = []
        for ei in range(n_verts):
            L1 = offset_lines[ei]
            L2 = offset_lines[(ei + 1) % n_verts]
            if not L1 or not L2:
                sb_verts_list.append(lot_verts[(ei + 1) % n_verts])
                continue
            x1, y1 = L1["x1"], L1["y1"]
            x2, y2 = L1["x2"], L1["y2"]
            x3, y3 = L2["x1"], L2["y1"]
            x4, y4 = L2["x2"], L2["y2"]
            denom = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4)
            if abs(denom) < 0.001:
                sb_verts_list.append([(x2+x3)/2, (y2+y3)/2])
                continue
            t = ((x1-x3)*(y3-y4) - (y1-y3)*(x3-x4)) / denom
            sb_verts_list.append([x1 + t*(x2-x1), y1 + t*(y2-y1)])

        sb_poly = plt.Polygon(sb_verts_list, fill=False, ec=BRAND["red"],
                              lw=1, linestyle="--", closed=True)
        ax.add_patch(sb_poly)

        # Per-edge setback labels
        for ei in range(n_verts):
            if sb_dists[ei] <= 0:
                continue
            e_info = lot_edge_data[ei] if ei < len(lot_edge_data) else {}
            sb_type = e_info.get("setbackType", "side")
            v1 = lot_verts[ei]
            v2 = lot_verts[(ei + 1) % n_verts]
            mx, my = (v1[0]+v2[0])/2, (v1[1]+v2[1])/2
            edx, edy = v2[0]-v1[0], v2[1]-v1[1]
            seg_len = math.sqrt(edx*edx + edy*edy)
            if seg_len < 1:
                continue
            nx, ny = -edy/seg_len, edx/seg_len
            if nx*(cx_lot-mx) + ny*(cy_lot-my) < 0:
                nx, ny = -nx, -ny
            lx = mx + nx * sb_dists[ei] * 0.5
            ly = my + ny * sb_dists[ei] * 0.5
            angle = math.degrees(math.atan2(edy, edx))
            while angle > 90: angle -= 180
            while angle < -90: angle += 180
            ax.text(lx, ly, f"{sb_dists[ei]}' {sb_type.upper()} SETBACK",
                    ha="center", va="center", fontsize=5.5, fontfamily="monospace",
                    color=BRAND["red"], fontweight="bold", rotation=angle,
                    bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="none", alpha=0.8))

    # === HOUSE FOOTPRINT ===
    # S48: Polygon-aware house X placement
    # houseOffsetSide means "distance from left property line at this Y"
    def left_edge_at_y(y_val):
        """Find the leftmost X of the polygon boundary at a given Y."""
        if not sp.get("lot_vertices"):
            return 0  # rectangle: left edge is always x=0
        min_x = float('inf')
        for ei in range(n_verts):
            a = lot_verts[ei]
            b = lot_verts[(ei + 1) % n_verts]
            y_lo, y_hi = min(a[1], b[1]), max(a[1], b[1])
            if y_val < y_lo or y_val > y_hi or y_lo == y_hi:
                continue
            t = (y_val - a[1]) / (b[1] - a[1])
            x_at = a[0] + t * (b[0] - a[0])
            if x_at < min_x:
                min_x = x_at
        return 0 if min_x == float('inf') else min_x

    house_mid_y = house_y + house_d / 2
    house_x = left_edge_at_y(house_mid_y) + house_x  # house_x was houseOffsetSide

    house_rect = patches.Rectangle(
        (house_x, house_y), house_w, house_d,
        fc='#e8e6e0', ec=BRAND["dark"], lw=1.5, hatch='///', zorder=3
    )
    ax.add_patch(house_rect)
    # S44: Simpler label on large lots where house rect is tiny
    _house_label = "EXISTING\nRESIDENCE" if _is_large else house_label
    ax.text(house_x + house_w / 2, house_y + house_d / 2,
            _house_label,
            ha='center', va='center', fontsize=7, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"], zorder=4)

    # S44: Skip house dimension labels on large lots (unreadable, cluttery)
    if not _is_large:
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

    # S44: Simpler label on large lots (dimensions unreadable, show SF instead)
    _deck_area = total_area if total_area > 0 else deck_w * deck_d
    if _is_large:
        label = f"PROPOSED DECK\n{_deck_area:.0f} SF"
    elif zones:
        label = f"PROPOSED DECK\n{total_area:.0f} S.F."
    else:
        label = f"PROPOSED DECK\n{deck_w}'\u00D7{deck_d}'"

    ax.text(z0_x + deck_w / 2, z0_y + deck_d / 2, label,
            ha='center', va='center', fontsize=7, fontweight='bold',
            fontfamily='monospace', color=BRAND["green"], zorder=5)

    # Deck dimensions (bounding box) - S44: skip on large lots
    if not _is_large:
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

    # === DISTANCE TO PROPERTY LINES (S44: skip on large lots) ===
    if not _is_large:
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

    # === STREET (S37: polygon-aware) ===
    _st_label = ""
    for _ei in range(len(lot_edge_data)):
        if lot_edge_data[_ei].get("type") == "street" and lot_edge_data[_ei].get("label"):
            _st_label = lot_edge_data[_ei]["label"]
            break
    if not _st_label:
        _st_label = street_name or "STREET"
    _st_band_h = max(5, margin * 0.4)
    ax.add_patch(patches.Rectangle((-margin, -margin), poly_max_x + 2 * margin, _st_band_h,
                 fc='#e0e0e0', ec='none'))
    ax.text(poly_max_x / 2, -margin + _st_band_h * 0.5, _st_label.upper(),
            ha='center', va='center', fontsize=10, fontweight='bold',
            fontfamily='monospace', color=BRAND["mute"])

    # === NORTH ARROW (S32: rotatable) ===
    na_x, na_y = poly_max_x + 8 * _sf, poly_max_y - 10 * _sf
    north_angle = params.get("northAngle", 0) or 0
    na_rad = math.radians(north_angle)
    na_len = 8 * _sf
    na_dx = na_len * math.sin(na_rad)
    na_dy = na_len * math.cos(na_rad)
    ax.annotate('', xy=(na_x + na_dx, na_y + na_dy), xytext=(na_x, na_y),
                arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=2))
    na_tx = na_x + (na_len + 2 * _sf) * math.sin(na_rad)
    na_ty = na_y + (na_len + 2 * _sf) * math.cos(na_rad)
    ax.text(na_tx, na_ty, "N", ha='center', va='center', fontsize=12, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])

    # === GRADE ARROW (S33) ===
    slope_pct = params.get("slopePercent", 0)
    slope_dir = params.get("slopeDirection", "front-to-back")
    if slope_pct and slope_pct > 0:
        _dir_angles = {
            "front-to-back": 0,
            "left-to-right": 90,
            "back-to-front": 180,
            "right-to-left": 270,
        }
        _ga_deg = _dir_angles.get(slope_dir, 0)
        _ga_rad = math.radians(_ga_deg)
        _ga_len = 5
        _ga_x = poly_max_x - 8
        _ga_y = 8
        _ga_dx = _ga_len * math.sin(_ga_rad)
        _ga_dy = _ga_len * math.cos(_ga_rad)
        ax.annotate('', xy=(_ga_x + _ga_dx, _ga_y + _ga_dy),
                    xytext=(_ga_x, _ga_y),
                    arrowprops=dict(arrowstyle='->', color='#8B7355', lw=1.8))
        ax.text(_ga_x + _ga_dx / 2 + (2.5 if _ga_dy != 0 else 0),
                _ga_y + _ga_dy / 2 + (2 if _ga_dx != 0 else 0),
                f"{slope_pct}% DN", ha='center', fontsize=5.5,
                fontfamily='monospace', color='#8B7355', fontweight='bold')
        ax.text(_ga_x + _ga_dx / 2 + (2.5 if _ga_dy != 0 else 0),
                _ga_y + _ga_dy / 2 + (2 if _ga_dx != 0 else 0) - 1.8,
                "GRADE", ha='center', fontsize=4.5,
                fontfamily='monospace', color='#8B7355', fontstyle='italic')

    # === GRAPHIC SCALE BAR (S44) ===
    _nice_units = [5, 10, 20, 25, 40, 50, 100, 200]
    _scale_unit = 10
    for _u in _nice_units:
        if _u >= _lot_span * 0.08 and _u <= _lot_span * 0.3:
            _scale_unit = _u
            break
    _bar_y = -margin + 6.5 * _sf
    _bar_x = 0
    _bar_segs = 4
    _seg_w = _scale_unit / _bar_segs
    _bar_h = 1.5 * _sf
    for _si in range(_bar_segs):
        _sx = _bar_x + _si * _seg_w
        _fc = BRAND["dark"] if _si % 2 == 0 else "white"
        ax.add_patch(patches.Rectangle(
            (_sx, _bar_y), _seg_w, _bar_h,
            fc=_fc, ec=BRAND["dark"], lw=0.6, zorder=10))
    ax.text(_bar_x, _bar_y - 1.2 * _sf, "0", ha='center', fontsize=5,
            fontfamily='monospace', color=BRAND["dark"], fontweight='bold', zorder=10)
    ax.text(_bar_x + _scale_unit, _bar_y - 1.2 * _sf, f"{_scale_unit}'",
            ha='center', fontsize=5, fontfamily='monospace',
            color=BRAND["dark"], fontweight='bold', zorder=10)
    ax.text(_bar_x + _scale_unit / 2, _bar_y + _bar_h + 1.0 * _sf,
            "GRAPHIC SCALE (FEET)", ha='center', fontsize=4.5,
            fontfamily='monospace', color=BRAND["mute"], zorder=10)

    # === TITLE ===
    fig.text(0.44, 0.94, "SITE PLAN", ha='center',
             fontsize=16, fontweight='bold', fontfamily='monospace',
             color=BRAND["dark"])

    subtitle_parts = []
    if address:
        subtitle_parts.append(address.upper())
    if parcel_id:
        subtitle_parts.append(f"PARCEL: {parcel_id}")
    if zoning:
        subtitle_parts.append(f"ZONING: {zoning.upper()}")
    if subtitle_parts:
        fig.text(0.44, 0.92, "  |  ".join(subtitle_parts),
                 ha='center', fontsize=7, fontfamily='monospace', color=BRAND["mute"])

    # === LEGEND + SETBACKS + AREA INFO BOX (S51: right margin) ===
    # Positioned between axes right edge (~0.71) and title block (0.855)
    # using figure-level coords so it never overlaps the drawing.
    _tf = fig.transFigure
    _box_left = 0.72
    _box_right = 0.845
    _lx = _box_left + 0.008   # text left margin
    _vx = _box_left + 0.08    # value column x
    _row_h = 0.022             # line height
    _sec_gap = 0.010           # gap between sections
    _clr = BRAND["dark"]       # all text dark for readability

    # -- Build legend items --
    legend_items = [
        (BRAND["dark"], "solid", "Property Line"),
        (BRAND["red"], "dashed", "Setback Line"),
        (BRAND["dark"], "hatch", "Existing House"),
        (BRAND["green"], "filled", "Proposed Deck"),
    ]
    if has_stairs and deck_height > 0:
        legend_items.append(("#8B7355", "dashed", "Stair Projection"))
    if site_elements:
        legend_items.append(("#888888", "filled", "Site Elements"))

    lot_area = calc.get("lot_area", lot_w * lot_d)
    house_area = house_w * house_d
    deck_area = total_area if total_area > 0 else deck_w * deck_d
    total_impervious = house_area + deck_area + el_impervious_area
    coverage_pct = (total_impervious / lot_area * 100) if lot_area > 0 else 0
    _has_other = el_impervious_area > 0
    _area_rows = 5 + (1 if _has_other else 0)

    _n_lines = (1 + len(legend_items) + 1 + 4 + 1 + _area_rows + 1)
    _total_h = _n_lines * _row_h + 3 * _sec_gap + 0.025
    _box_top = 0.88
    _box_bot = _box_top - _total_h

    # Background box
    _bg = patches.FancyBboxPatch(
        (_box_left, _box_bot), _box_right - _box_left, _total_h,
        boxstyle="round,pad=0.005", facecolor='white', edgecolor=BRAND["border"],
        linewidth=0.8, transform=_tf, zorder=0, alpha=1.0)
    _bg.set_clip_on(False)
    fig.add_artist(_bg)

    _y = _box_top - 0.02

    # -- LEGEND --
    fig.text(_lx, _y, "LEGEND", fontsize=7, fontweight='bold',
             fontfamily='monospace', color=_clr)
    _y -= _row_h

    for _lc, _ls, _ll in legend_items:
        _sx = _lx
        _sw = 0.03
        if _ls == "solid":
            _ln = Line2D([_sx, _sx + _sw], [_y + 0.004, _y + 0.004],
                         color=_lc, lw=2.5, transform=_tf, zorder=16)
            _ln.set_clip_on(False)
            fig.add_artist(_ln)
        elif _ls == "dashed":
            _ln = Line2D([_sx, _sx + _sw], [_y + 0.004, _y + 0.004],
                         color=_lc, lw=2, linestyle='--', transform=_tf, zorder=16)
            _ln.set_clip_on(False)
            fig.add_artist(_ln)
        elif _ls == "hatch":
            _hb = patches.FancyBboxPatch(
                (_sx, _y - 0.002), _sw, 0.013,
                boxstyle="square,pad=0", facecolor='white', edgecolor=_lc,
                linewidth=0.8, hatch='///', transform=_tf, zorder=16)
            _hb.set_clip_on(False)
            fig.add_artist(_hb)
        elif _ls == "filled":
            _fb = patches.FancyBboxPatch(
                (_sx, _y - 0.002), _sw, 0.013,
                boxstyle="square,pad=0", facecolor=_lc, edgecolor=_lc,
                linewidth=0.5, alpha=0.6, transform=_tf, zorder=16)
            _fb.set_clip_on(False)
            fig.add_artist(_fb)
        fig.text(_sx + _sw + 0.008, _y, _ll, fontsize=5.5, fontfamily='monospace',
                 color=_clr)
        _y -= _row_h

    _y -= _sec_gap

    # -- SETBACKS --
    fig.text(_lx, _y, "SETBACKS", fontsize=7, fontweight='bold',
             fontfamily='monospace', color=_clr)
    _y -= _row_h
    for _sl, _sv in [("Front", sb_front), ("Rear", sb_rear),
                      ("Left", sb_left), ("Right", sb_right)]:
        fig.text(_lx, _y, f"{_sl}:", fontsize=5.5, fontfamily='monospace',
                 color=_clr, fontweight='bold')
        fig.text(_vx, _y, f"{_sv}'", fontsize=5.5, fontfamily='monospace',
                 color=_clr, fontweight='bold')
        _y -= _row_h

    _y -= _sec_gap

    # -- AREA TABULATIONS --
    fig.text(_lx, _y, "AREA TABULATIONS", fontsize=6.5, fontweight='bold',
             fontfamily='monospace', color=_clr)
    _y -= _row_h

    fig.text(_lx, _y, "Lot Area:", fontsize=5.5, fontfamily='monospace',
             color=_clr, fontweight='bold')
    if lot_area >= 43560:
        _acres = lot_area / 43560
        fig.text(_vx, _y, f"{_acres:.2f} AC",
                 fontsize=5.5, fontfamily='monospace',
                 color=_clr, fontweight='bold')
    else:
        fig.text(_vx, _y, f"{lot_area:,.0f} SF", fontsize=5.5, fontfamily='monospace',
                 color=_clr, fontweight='bold')
    _y -= _row_h

    fig.text(_lx, _y, "Building:", fontsize=5.5, fontfamily='monospace',
             color=_clr, fontweight='bold')
    fig.text(_vx, _y, f"{house_area:,.0f} SF", fontsize=5.5, fontfamily='monospace',
             color=_clr, fontweight='bold')
    _y -= _row_h

    fig.text(_lx, _y, "Deck:", fontsize=5.5, fontfamily='monospace',
             color=_clr, fontweight='bold')
    fig.text(_vx, _y, f"{deck_area:,.0f} SF", fontsize=5.5, fontfamily='monospace',
             color=_clr, fontweight='bold')
    _y -= _row_h

    if _has_other:
        fig.text(_lx, _y, "Other:", fontsize=5.5, fontfamily='monospace',
                 color=_clr, fontweight='bold')
        fig.text(_vx, _y, f"{el_impervious_area:,.0f} SF", fontsize=5.5,
                 fontfamily='monospace', color=_clr, fontweight='bold')
        _y -= _row_h

    # Divider
    _y -= 0.004
    _div = Line2D([_lx, _box_right - 0.01], [_y, _y],
                  color=BRAND["border"], lw=0.5, transform=_tf)
    _div.set_clip_on(False)
    fig.add_artist(_div)
    _y -= 0.010

    fig.text(_lx, _y, "Covered:", fontsize=5.5, fontfamily='monospace',
             color=_clr, fontweight='bold')
    fig.text(_vx, _y, f"{total_impervious:,.0f} SF", fontsize=5.5,
             fontfamily='monospace', color=_clr, fontweight='bold')
    _y -= _row_h

    warn_color = "#e65100" if coverage_pct > 45 else _clr
    fig.text(_lx, _y, "Coverage:", fontsize=5.5, fontfamily='monospace',
             color=_clr, fontweight='bold')
    fig.text(_vx, _y, f"{coverage_pct:.1f}%", fontsize=6, fontfamily='monospace',
             color=warn_color, fontweight='bold')

    # === VICINITY MAP (S63) ===
    # Render a small neighborhood map from lat/lng if available from parcel lookup
    _pi = params.get("projectInfo") or {}
    _vic_lat = params.get("_parcel_lat") or 0
    _vic_lng = params.get("_parcel_lng") or 0
    # Also check project info for lat/lng
    if not _vic_lat:
        try:
            _vic_lat = float(_pi.get("lat") or 0)
        except (ValueError, TypeError):
            _vic_lat = 0
    if not _vic_lng:
        try:
            _vic_lng = float(_pi.get("lng") or 0)
        except (ValueError, TypeError):
            _vic_lng = 0

    if _vic_lat and _vic_lng:
        try:
            from staticmap import StaticMap, CircleMarker
            _map_w_px, _map_h_px = 600, 400
            sm = StaticMap(_map_w_px, _map_h_px,
                           url_template='https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                           headers={'User-Agent': 'SimpleBlueprints/1.0 (permit blueprint generator)'})
            sm.add_marker(CircleMarker((_vic_lng, _vic_lat), 'red', 10))
            map_img = sm.render(zoom=15)

            map_arr = np.array(map_img)

            # Position: wider footprint below the info box, extending left
            _map_fig_right = _box_right
            _map_fig_w = 0.26
            _map_fig_left = _map_fig_right - _map_fig_w
            _map_fig_h = _map_fig_w * (_map_h_px / _map_w_px) * (14.0 / 8.5)  # aspect ratio corrected for fig dims
            _map_fig_bot = _box_bot - 0.03 - _map_fig_h

            if _map_fig_bot > 0.03:
                # Label above map
                fig.text(_map_fig_left, _map_fig_bot + _map_fig_h + 0.008, "VICINITY MAP",
                         fontsize=7, fontfamily='monospace', color=_clr, fontweight='bold')

                # Render map image
                ax_map = fig.add_axes([_map_fig_left, _map_fig_bot, _map_fig_w, _map_fig_h])
                ax_map.imshow(map_arr)
                ax_map.set_xticks([])
                ax_map.set_yticks([])
                for spine in ax_map.spines.values():
                    spine.set_edgecolor(BRAND["dark"])
                    spine.set_linewidth(1.0)

                # "SITE" label with arrow (offset to upper-left of center)
                cx_px = _map_w_px // 2
                cy_px = _map_h_px // 2
                ax_map.annotate('SITE', xy=(cx_px, cy_px), xytext=(cx_px - 80, cy_px - 60),
                                fontsize=7, fontfamily='monospace', fontweight='bold', color='#333',
                                arrowprops=dict(arrowstyle='->', color='#333', lw=1.2),
                                bbox=dict(boxstyle='round,pad=0.3', fc='white', ec='#333', lw=0.8, alpha=0.9))

                # North arrow on the map
                _na_x = _map_w_px - 30
                _na_y = 25
                ax_map.annotate('', xy=(_na_x, _na_y - 12), xytext=(_na_x, _na_y + 12),
                                arrowprops=dict(arrowstyle='->', color='#333', lw=1.5))
                ax_map.text(_na_x, _na_y - 18, 'N', ha='center', fontsize=7,
                            fontfamily='monospace', fontweight='bold', color='#333')
        except Exception as _vic_err:
            print(f"Vicinity map error: {_vic_err}")
    else:
        print(f"Vicinity map skipped: lat={_vic_lat}, lng={_vic_lng}, params keys with _parcel: {[k for k in params.keys() if 'parcel' in str(k).lower()]}")
