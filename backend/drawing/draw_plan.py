#!/usr/bin/env python3
"""
SimpleBlueprints - Parametric PDF Drawing Engine
Step 1b: Plan View + Framing Plan (Sheet 1 of 4)
S22: Zone-aware rendering with visual differentiation + adaptive layout
S45: Full encoding cleanup (plain ASCII) + label spacing fix
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Polygon
from matplotlib.backends.backend_pdf import PdfPages
import numpy as np
import math

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

# S22: Per-zone fill colors for visual differentiation
ZONE_FILLS = [
    "#efe5d5",  # zone 0: warm original
    "#e5ebd5",  # zone 1: subtle green tint
    "#dde5ef",  # zone 2: subtle blue tint
    "#efe5df",  # zone 3: subtle pink tint
]

ZONE_BOARD_COLORS = [
    "#c9ad7a",  # zone 0
    "#a9b98a",  # zone 1
    "#9aabbf",  # zone 2
    "#c9a98a",  # zone 3
]


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


def draw_north_arrow(ax, x, y, angle=0, size=1.2):
    rad = math.radians(angle)
    dx = size * math.sin(rad)
    dy = size * math.cos(rad)
    ax.annotate('', xy=(x + dx, y + dy), xytext=(x, y),
                arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=1.5))
    tx = x + (size + 0.3) * math.sin(rad)
    ty = y + (size + 0.3) * math.cos(rad)
    ax.text(tx, ty, 'N', ha='center', va='center', fontsize=8, fontweight='bold')


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
# S22: ZONE FRAMING HELPERS
# ============================================================
BEAM_SETBACK = 1.5  # beam inset from far edge (ft)


def compute_zone_framing(zone, rect, joist_spacing_in=16):
    """
    Compute framing layout for an add zone.
    Returns beam position, post positions, and joist lines.
    """
    edge = zone.get("attachEdge", "front")
    x, y, w, d = rect["x"], rect["y"], rect["w"], rect["d"]
    sp = joist_spacing_in / 12  # spacing in feet

    if edge == "right":
        beam_x = x + w - BEAM_SETBACK
        beam_y1, beam_y2 = y + 0.5, y + d - 0.5
        n_posts = max(2, math.ceil(d / 8) + 1)
        post_ys = np.linspace(y + 1, y + d - 1, n_posts)
        posts = [{"x": beam_x, "y": py} for py in post_ys]
        joist_lines = []
        for jy in np.arange(y + sp, y + d, sp):
            if jy < y + d - 0.3:
                joist_lines.append({"x1": x + 0.1, "y1": jy, "x2": beam_x, "y2": jy})
        return {"beam": {"x1": beam_x, "y1": beam_y1, "x2": beam_x, "y2": beam_y2},
                "posts": posts, "joist_lines": joist_lines}

    elif edge == "left":
        beam_x = x + BEAM_SETBACK
        beam_y1, beam_y2 = y + 0.5, y + d - 0.5
        n_posts = max(2, math.ceil(d / 8) + 1)
        post_ys = np.linspace(y + 1, y + d - 1, n_posts)
        posts = [{"x": beam_x, "y": py} for py in post_ys]
        joist_lines = []
        for jy in np.arange(y + sp, y + d, sp):
            if jy < y + d - 0.3:
                joist_lines.append({"x1": beam_x, "y1": jy, "x2": x + w - 0.1, "y2": jy})
        return {"beam": {"x1": beam_x, "y1": beam_y1, "x2": beam_x, "y2": beam_y2},
                "posts": posts, "joist_lines": joist_lines}

    elif edge == "front":
        beam_y = y + d - BEAM_SETBACK
        beam_x1, beam_x2 = x + 0.5, x + w - 0.5
        n_posts = max(2, math.ceil(w / 8) + 1)
        post_xs = np.linspace(x + 1, x + w - 1, n_posts)
        posts = [{"x": px, "y": beam_y} for px in post_xs]
        joist_lines = []
        for jx in np.arange(x + sp, x + w, sp):
            if jx < x + w - 0.3:
                joist_lines.append({"x1": jx, "y1": y + 0.1, "x2": jx, "y2": beam_y})
        return {"beam": {"x1": beam_x1, "y1": beam_y, "x2": beam_x2, "y2": beam_y},
                "posts": posts, "joist_lines": joist_lines}

    return None


def draw_zone_framing(ax, zone, rect, calc):
    """Draw framing elements (outline, joists, beam, posts, piers) for an add zone."""
    framing = compute_zone_framing(zone, rect, calc.get("joist_spacing", 16))
    if not framing:
        return
    footing_diam = calc.get("footing_diam", 30)
    b = framing["beam"]

    # Zone outline
    ax.add_patch(patches.Rectangle(
        (rect["x"], rect["y"]), rect["w"], rect["d"],
        fc='#fcfaf5', ec=BRAND["dark"], lw=1.5))

    # Joists
    for jl in framing["joist_lines"]:
        ax.plot([jl["x1"], jl["x2"]], [jl["y1"], jl["y2"]],
                color=BRAND["light"], lw=0.4)

    # Beam
    ax.plot([b["x1"], b["x2"]], [b["y1"], b["y2"]],
            color=BRAND["beam"], lw=3)

    # Posts + piers
    for p in framing["posts"]:
        ax.plot(p["x"], p["y"], 'o', ms=4, color=BRAND["post"],
                mec=BRAND["dark"], mew=0.7)
        pier = plt.Circle((p["x"], p["y"]), footing_diam / 24,
                          fill=False, ec=BRAND["dark"], lw=0.4, ls='--')
        ax.add_patch(pier)

    # Zone label with joist callout
    label = zone.get("label", f"Zone {zone.get('id', '?')}")
    ax.text(rect["x"] + rect["w"] / 2, rect["y"] + rect["d"] / 2,
            f'{label}\n{calc.get("joist_size", "2x12")} @ {calc.get("joist_spacing", 16)}" O.C.',
            ha='center', va='center', fontsize=3.5,
            fontfamily='monospace', color=BRAND["mute"], fontstyle='italic')


# ============================================================
# SHEET 1: DECK PLAN + FRAMING (side by side)
# ============================================================
def draw_plan_and_framing(fig, params, calc, spec=None):
    """Draw plan view (left) and framing plan (right)"""

    # Build spec if not provided (backwards compat)
    if spec is None:
        from .permit_spec import build_permit_spec
        spec = build_permit_spec(params, calc)

    W = calc["width"]
    D = calc["depth"]
    attachment = calc["attachment"]
    has_stairs = params.get("hasStairs", False)
    stair_loc = params.get("stairLocation", "front")
    has_zones = len(params.get("zones", [])) > 0

    ax1, ax2 = fig.subplots(1, 2)
    fig.subplots_adjust(left=0.04, right=0.84, top=0.91, bottom=0.08, wspace=0.12)

    # S21: Zone-aware plan view data
    add_rects = get_additive_rects(params)
    cut_rects = get_cutout_rects(params)
    exp_edges = get_exposed_edges(params)
    bbox = get_bounding_box(params)

    # S22: Adaptive margins - wider multi-zone decks need proportionally more room
    margin_x_left = max(bbox["w"] * 0.20, 5)
    margin_x_right = max(bbox["w"] * 0.10, 3)  # tighter for title block strip
    margin_y = max(bbox["d"] * 0.30, 4)
    house_depth = min(D * 0.5, 8)

    for ax, title, is_framing in [(ax1, "MAIN LEVEL DECK PLAN", False), (ax2, "DECK FRAMING", True)]:
        ax.set_xlim(bbox["x"] - margin_x_left, bbox["x"] + bbox["w"] + margin_x_right)
        ax.set_ylim(-house_depth - margin_y * 0.4, bbox["y"] + bbox["d"] + margin_y)
        ax.set_aspect('equal')
        ax.axis('off')
        ax.set_facecolor('white')

        # S22: Title positioned relative to bbox top, not hardcoded D
        title_y = bbox["y"] + bbox["d"] + margin_y - 1
        ax.text(bbox["x"], title_y, title, fontsize=10, fontweight='bold',
                fontfamily='monospace', color=BRAND["dark"])
        _scale_txt = 'SCALE: 1/4" = 1' + "'" + '-0"'
        ax.text(bbox["x"], title_y - 1.2, _scale_txt, fontsize=5.5,
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
            # Zone 0 framing area
            ax.add_patch(patches.Rectangle((0, 0), W, D,
                         fc='#fcfaf5', ec=BRAND["dark"], lw=2))
            # S22: Draw framing for add zones
            if has_zones:
                for ar in add_rects:
                    if ar["id"] == 0:
                        continue
                    draw_zone_framing(ax, ar["zone"], ar["rect"], calc)
        else:
            # S22: Zone-aware plan view with color differentiation
            for idx, ar in enumerate(add_rects):
                r = ar["rect"]
                fill = ZONE_FILLS[idx % len(ZONE_FILLS)]
                board_color = ZONE_BOARD_COLORS[idx % len(ZONE_BOARD_COLORS)]

                ax.add_patch(patches.Rectangle((r["x"], r["y"]), r["w"], r["d"],
                             fc=fill, ec=BRAND["dark"], lw=2))

                # Board lines
                board_w = 5.5 / 12
                for bi in range(int(r["d"] / board_w) + 1):
                    by = r["y"] + bi * board_w
                    if by <= r["y"] + r["d"]:
                        ax.plot([r["x"], r["x"] + r["w"]], [by, by],
                                color=board_color, lw=0.2)

                # S22: Zone labels + per-zone dimensions for add zones
                if ar["id"] != 0 and has_zones:
                    label = ar["zone"].get("label", f"Zone {ar['id']}")
                    ax.text(r["x"] + r["w"] / 2, r["y"] + r["d"] / 2,
                            label.upper(),
                            ha='center', va='center', fontsize=5,
                            fontfamily='monospace', color=BRAND["mute"],
                            fontweight='bold',
                            bbox=dict(boxstyle='square,pad=0.3', fc='white',
                                      ec=BRAND["border"], alpha=0.85))
                    # Per-zone width
                    draw_dimension_h(ax, r["x"], r["x"] + r["w"], r["y"],
                                     format_feet_inches(r["w"]),
                                     offset=-1.5, color=BRAND["mute"], fontsize=4.5)
                    # Per-zone depth
                    draw_dimension_v(ax, r["x"] + r["w"], r["y"], r["y"] + r["d"],
                                     format_feet_inches(r["d"]),
                                     offset=0.8, color=BRAND["mute"], fontsize=4.5)

            # Cutouts
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
                # S22: Position blocking label relative to bbox right edge
                ax.text(W / 2, block_y + 0.5,
                        f'{calc["joist_size"]} SOLID BLOCKING AT MID-SPAN',
                        ha='center', fontsize=3.5, fontfamily='monospace', color=BRAND["dark"],
                        bbox=dict(boxstyle='square,pad=0.15', fc='white', ec='none', alpha=0.85))

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
                    spec["labels"]["beam"],
                    ha='center', fontsize=4, fontweight='bold', color='#8B6914')

            # Posts + piers
            for px in calc["post_positions"]:
                ax.plot(px, beam_y, 'o', ms=5, color=BRAND["post"],
                        mec=BRAND["dark"], mew=0.8)
                pier = plt.Circle((px, beam_y), calc["footing_diam"] / 24,
                                  fill=False, ec=BRAND["dark"], lw=0.5, ls='--')
                ax.add_patch(pier)

            # S34: Per-post height annotations when slope is active
            post_heights = calc.get("post_heights", [])
            if post_heights and params.get("slopePercent", 0) > 0:
                for phi, px in enumerate(calc.get("post_positions", [])):
                    if phi < len(post_heights):
                        ph = post_heights[phi]
                        ax.text(px, beam_y + 1.2, format_feet_inches(ph),
                                ha='center', fontsize=3.5, fontweight='bold',
                                fontfamily='monospace', color='#8B6914',
                                bbox=dict(boxstyle='square,pad=0.1', fc='#fff8f0',
                                          ec='#c4960a', lw=0.3, alpha=0.9))

            # S57: Hardware labels from permit spec - right-aligned near beam
            _hw_x = W - 0.5
            _hw_kw = dict(fontsize=3.5, fontfamily='monospace', color=BRAND["dark"], ha='right',
                          bbox=dict(boxstyle='square,pad=0.1', fc='white', ec='none', alpha=0.85))
            _hw_y = beam_y + 2.2
            ax.text(_hw_x, _hw_y, spec["labels"]["posts_and_hardware"], **_hw_kw)
            ax.text(_hw_x, _hw_y - 0.6, spec["labels"]["footings"], **_hw_kw)
            ax.text(_hw_x, _hw_y - 1.2, spec["labels"]["joist_hanger"], **_hw_kw)
            if calc.get("beam_type", "dropped") == "dropped":
                ax.text(_hw_x, _hw_y - 1.8, spec["labels"]["hurricane_tie"], **_hw_kw)

            # S57: Loads box - inside deck, bottom-left corner
            _lb_x = 0.3
            _lb_y = 0.3
            _lb_h = 3.4 if spec["labels"].get("loads_ledger") else 2.8
            ax.add_patch(patches.Rectangle((_lb_x, _lb_y), 4.5, _lb_h,
                         fc='#fafaf8', ec=BRAND["dark"], lw=0.5, zorder=5))
            _ly = _lb_y + _lb_h - 0.5
            ax.text(_lb_x + 0.2, _ly, 'DECK LOADS:', fontsize=4.5,
                    fontweight='bold', color=BRAND["dark"], zorder=6)
            ax.text(_lb_x + 0.2, _ly - 0.6, spec["labels"]["loads_LL"],
                    fontsize=4, color=BRAND["dark"], zorder=6)
            ax.text(_lb_x + 0.2, _ly - 1.2, spec["labels"]["loads_DL"],
                    fontsize=4, color=BRAND["dark"], zorder=6)
            ax.text(_lb_x + 0.2, _ly - 1.8, spec["labels"]["loads_TL"],
                    fontsize=4, fontweight='bold', color=BRAND["red"], zorder=6)
            if spec["labels"].get("loads_ledger"):
                ax.text(_lb_x + 0.2, _ly - 2.4, spec["labels"]["loads_ledger"],
                        fontsize=4, color=BRAND["dark"], zorder=6)



            # === BUILDER DIMENSION CALLOUTS (S17) ===
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
                             offset=max(W * 0.04, 1.5), color='#8B6914', fontsize=4.5)

            # Joist count label
            n_joists = int(W / (calc["joist_spacing"] / 12)) + 1
            if n_joists > 0:
                ax.text(W / 2, D / 2 - 3.8,
                        f'{n_joists} JOISTS',
                        ha='center', fontsize=4.5, fontfamily='monospace',
                        color='#999', fontweight='bold')
        else:
            # Plan view labels (zone 0 center)
            ax.text(W / 2, D / 2 + 0.8, '1 x 6 COMPOSITE DECKING',
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
                        f'({n_stringers}) 2x12 PT\nSTRINGERS\n{st["actual_rise"]:.1f}" RISE\n{st["tread_depth"]}" RUN',
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
                        f'({n_stringers}) 2x12 PT STRINGERS - {st["actual_rise"]:.1f}" RISE - {st["tread_depth"]}" RUN',
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
                        f'({n_stringers}) 2x12 PT STRINGERS - {st["actual_rise"]:.1f}" RISE - {st["tread_depth"]}" RUN',
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

        # Dimensions (zone 0 overall)
        draw_dimension_h(ax, 0, W, D, format_feet_inches(W),
                         offset=max(D * 0.15, 2), color=BRAND["red"], fontsize=7)
        draw_dimension_v(ax, W, 0, D, format_feet_inches(D),
                         offset=max(W * 0.04, 1.2), color=BRAND["blue"], fontsize=7)

        # S47: North arrow in upper-left margin, scale bar below house
        draw_north_arrow(ax, bbox["x"] - margin_x_left + 2,
                         bbox["y"] + bbox["d"] + margin_y - 2.5,
                         angle=params.get("northAngle", 0) or 0)
        draw_scale_bar(ax, bbox["x"], -house_depth - margin_y * 0.35)

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
                     f'TEST: {cfg["name"]}  -  {calc["width"]}\' x {calc["depth"]}\' | '
                     f'TL={calc["TL"]} PSF | {calc["joist_size"]} joists | {calc["beam_size"]} beam | '
                     f'{calc["post_size"]} x {calc["num_posts"]} posts | {calc["footing_diam"]}" piers',
                     ha='center', fontsize=7, fontfamily='monospace', color=BRAND["red"],
                     bbox=dict(boxstyle='square,pad=0.3', fc='#fff8f0', ec=BRAND["red"], lw=0.5))

            pdf.savefig(fig, dpi=200)
            plt.close(fig)

    print(f"\nSaved 3 test sheets to {output}")


if __name__ == "__main__":
    main()
