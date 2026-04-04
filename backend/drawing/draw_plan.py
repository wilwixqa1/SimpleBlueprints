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
from .stair_utils import (get_stair_placement, get_stair_exit_side, resolve_all_stairs,
                          transform_stair_point, transform_stair_rect)
from .zone_utils import get_additive_rects, get_cutout_rects, get_exposed_edges, get_bounding_box, _chamfered_vertices

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


def draw_zone_framing(ax, zone, rect, calc, zone_sizing=None):
    """Draw framing elements (outline, joists, beam, posts, piers) for an add zone."""
    framing = compute_zone_framing(zone, rect, calc.get("joist_spacing", 16))
    if not framing:
        return
    footing_diam = calc.get("footing_diam", 30)
    b = framing["beam"]

    # S61: Zone outline (chamfer-aware)
    _zcorners = zone.get("corners")
    _zverts = _chamfered_vertices(rect["x"], rect["y"], rect["w"], rect["d"], _zcorners)
    _z_clip = Polygon(_zverts, closed=True,
                 fc='#fcfaf5', ec=BRAND["dark"], lw=1.5)
    ax.add_patch(_z_clip)

    # Joists (clipped to zone chamfer polygon)
    for jl in framing["joist_lines"]:
        ln, = ax.plot([jl["x1"], jl["x2"]], [jl["y1"], jl["y2"]],
                color=BRAND["light"], lw=0.4)
        ln.set_clip_path(_z_clip)

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

    # S61: Zone label with zone-specific joist/beam callout (from spec, compact)
    label = zone.get("label", f"Zone {zone.get('id', '?')}")
    if zone_sizing:
        zj = zone_sizing["joist_size"]
        zb = zone_sizing["beam_size"].upper()
        label_text = f'{label}\n{zj} @ {calc.get("joist_spacing", 16)}" / {zb}'
    else:
        label_text = f'{label}\n{calc.get("joist_size", "2x12")} @ {calc.get("joist_spacing", 16)}"'
    ax.text(rect["x"] + rect["w"] / 2, rect["y"] + rect["d"] / 2,
            label_text,
            ha='center', va='center', fontsize=3.0,
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
    has_zones = len(params.get("zones", [])) > 0

    ax1, ax2 = fig.subplots(1, 2)
    fig.subplots_adjust(left=0.04, right=0.84, top=0.91, bottom=0.08, wspace=0.12)

    # S21: Zone-aware plan view data
    add_rects = get_additive_rects(params)
    cut_rects = get_cutout_rects(params)
    exp_edges = get_exposed_edges(params)
    bbox = get_bounding_box(params)

    # S22: Adaptive margins - wider multi-zone decks need proportionally more room
    # S68: Expand bounds to include stair geometry extents
    all_stairs_pre = resolve_all_stairs(params, calc)
    stair_x_min, stair_x_max = bbox["x"], bbox["x"] + bbox["w"]
    stair_y_min, stair_y_max = bbox["y"], bbox["y"] + bbox["d"]
    for rs in all_stairs_pre:
        sg = rs.get("geometry")
        if not sg:
            continue
        _wax, _way, _ang = rs["world_anchor_x"], rs["world_anchor_y"], rs["angle"]
        sb = sg["bbox"]
        # Transform all 4 corners of stair bbox to world coords
        for lx, ly in [(sb["minX"], sb["minY"]), (sb["maxX"], sb["minY"]),
                        (sb["maxX"], sb["maxY"]), (sb["minX"], sb["maxY"])]:
            wx, wy = transform_stair_point(lx, ly, _wax, _way, _ang)
            stair_x_min = min(stair_x_min, wx)
            stair_x_max = max(stair_x_max, wx)
            stair_y_min = min(stair_y_min, wy)
            stair_y_max = max(stair_y_max, wy)
    # Effective drawing bounds include stairs
    eff_w = stair_x_max - stair_x_min
    eff_d = stair_y_max - stair_y_min
    margin_x_left = max(eff_w * 0.20, 5)
    margin_x_right = max(eff_w * 0.15, 4)  # tighter for title block strip, but enough for callouts
    margin_y = max(eff_d * 0.30, 6)  # S57: enough for title and stair extents
    house_depth = min(D * 0.5, 8)

    for ax, title, is_framing in [(ax1, "MAIN LEVEL DECK PLAN", False), (ax2, "DECK FRAMING", True)]:
        ax.set_xlim(min(bbox["x"], stair_x_min) - margin_x_left,
                   max(bbox["x"] + bbox["w"], stair_x_max) + margin_x_right)
        ax.set_ylim(-house_depth - margin_y * 0.4,
                   max(bbox["y"] + bbox["d"], stair_y_max) + margin_y)
        ax.set_aspect('equal')
        ax.axis('off')
        ax.set_facecolor('white')

        # S68: Title positioned above all content including stairs
        _view_top = max(bbox["y"] + bbox["d"], stair_y_max)
        title_y = _view_top + margin_y - 0.5
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
            # S61: Zone 0 framing area (chamfer-aware)
            _main_corners = params.get("mainCorners")
            _z0_verts = _chamfered_vertices(0, 0, W, D, _main_corners)
            _z0_clip = Polygon(_z0_verts, closed=True,
                         fc='#fcfaf5', ec=BRAND["dark"], lw=2)
            ax.add_patch(_z0_clip)
            # S22: Draw framing for add zones
            if has_zones:
                _zone_calcs = spec.get("zone_calcs", [])
                _zones_list = params.get("zones", [])
                for zi, ar in enumerate(add_rects):
                    if ar["id"] == 0:
                        continue
                    # Match zone to its zone_calcs entry by finding its index in zones list
                    _zs = None
                    for _zli, _zz in enumerate(_zones_list):
                        if _zz.get("id") == ar["zone"].get("id") and _zli < len(_zone_calcs):
                            _zs = _zone_calcs[_zli]
                            break
                    draw_zone_framing(ax, ar["zone"], ar["rect"], calc, zone_sizing=_zs)
        else:
            # S22: Zone-aware plan view with color differentiation
            for idx, ar in enumerate(add_rects):
                r = ar["rect"]
                fill = ZONE_FILLS[idx % len(ZONE_FILLS)]
                board_color = ZONE_BOARD_COLORS[idx % len(ZONE_BOARD_COLORS)]

                # S61: Chamfer-aware zone outline (also used as clip path for board lines)
                _zcorners = params.get("mainCorners") if ar["id"] == 0 else ar["zone"].get("corners")
                _zverts = _chamfered_vertices(r["x"], r["y"], r["w"], r["d"], _zcorners)
                _zone_clip = Polygon(_zverts, closed=True,
                             fc=fill, ec=BRAND["dark"], lw=2)
                ax.add_patch(_zone_clip)

                # Board lines (clipped to chamfer polygon)
                board_w = 5.5 / 12
                for bi in range(int(r["d"] / board_w) + 1):
                    by = r["y"] + bi * board_w
                    if by <= r["y"] + r["d"]:
                        ln, = ax.plot([r["x"], r["x"] + r["w"]], [by, by],
                                color=board_color, lw=0.2)
                        ln.set_clip_path(_zone_clip)

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
                    spec["labels"]["ledger"],
                    ha='center', fontsize=4, fontweight='bold', color=BRAND["ledger_green"])

        # Framing-specific elements
        if is_framing:
            beam_y = D - 1.5

            # Joists (clipped to chamfer polygon)
            sp = calc["joist_spacing"] / 12
            for jx in np.arange(sp, W, sp):
                if jx < W - 0.3:
                    ln, = ax.plot([jx, jx], [0.1, beam_y], color=BRAND["light"], lw=0.4)
                    ln.set_clip_path(_z0_clip)

            # S58: Joist hanger symbols at ledger connections
            if attachment == "ledger":
                _hh = 0.35  # hanger symbol height
                _hw = 0.18  # hanger symbol half-width
                for jx in np.arange(sp, W, sp):
                    if jx < W - 0.3:
                        # Small U-bracket at each joist-to-ledger connection
                        ln, = ax.plot([jx - _hw, jx - _hw, jx + _hw, jx + _hw],
                                [_hh, 0.02, 0.02, _hh],
                                color=BRAND["dark"], lw=0.6, solid_capstyle='round')
                        ln.set_clip_path(_z0_clip)

            # Mid-span blocking (when joist span > 7ft)
            j_span = D - 1.5 if attachment == "ledger" else D / 2 - 0.75
            if j_span > 7:
                block_y = j_span / 2  # midpoint of joist span
                sp_ft = calc["joist_spacing"] / 12
                for jx in np.arange(sp_ft, W, sp_ft):
                    if jx < W - 0.3 and jx + sp_ft < W:
                        ln, = ax.plot([jx, jx + sp_ft], [block_y, block_y],
                                color=BRAND["dark"], lw=0.6, ls='--', dashes=(1.5, 1.5))
                        ln.set_clip_path(_z0_clip)
                # S22: Position blocking label relative to bbox right edge
                ax.text(W / 2, block_y + 0.5,
                        spec["labels"]["blocking"],
                        ha='center', fontsize=3.5, fontfamily='monospace', color=BRAND["dark"],
                        bbox=dict(boxstyle='square,pad=0.15', fc='white', ec='none', alpha=0.85))

            # Joist label
            ax.text(W / 2, D / 2 - 1.5,
                    spec["labels"]["joist"],
                    ha='center', fontsize=6, fontfamily='monospace', color='#666')

            # Beam (clipped to chamfer polygon)
            _bl1, = ax.plot([1, W - 1], [beam_y, beam_y], color=BRAND["beam"], lw=4)
            _bl2, = ax.plot([1, W - 1], [beam_y - 0.12, beam_y - 0.12], color=BRAND["beam"], lw=0.5)
            _bl3, = ax.plot([1, W - 1], [beam_y + 0.12, beam_y + 0.12], color=BRAND["beam"], lw=0.5)
            _bl1.set_clip_path(_z0_clip)
            _bl2.set_clip_path(_z0_clip)
            _bl3.set_clip_path(_z0_clip)
            ax.text(W / 2, beam_y - 0.8,
                    spec["labels"]["beam"],
                    ha='center', fontsize=4, fontweight='bold', color='#8B6914')

            # Posts + piers (clipped to chamfer polygon)
            for px in calc["post_positions"]:
                _pp, = ax.plot(px, beam_y, 'o', ms=5, color=BRAND["post"],
                        mec=BRAND["dark"], mew=0.8)
                _pp.set_clip_path(_z0_clip)
                pier = plt.Circle((px, beam_y), calc["footing_diam"] / 24,
                                  fill=False, ec=BRAND["dark"], lw=0.5, ls='--')
                ax.add_patch(pier)
                pier.set_clip_path(_z0_clip)

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

            # S61: Hardware labels - consolidated for readability
            _first_px = calc["post_positions"][0]
            # Combined post + footing on one line above beam
            _hw_fs = 3.0
            _hw_box = dict(boxstyle='square,pad=0.1', fc='white', ec='none', alpha=0.85)
            ax.text(_first_px, beam_y + 1.2,
                    f'{spec["posts"]["size"]} PT POSTS ({spec["posts"]["total"]}) W/ {spec["footings"]["diameter"]}" PIERS x {spec["footings"]["depth"]}" DEEP',
                    ha='left', fontsize=_hw_fs, fontfamily='monospace', color=BRAND["dark"],
                    bbox=_hw_box)

            # Hurricane tie + joist hanger: single line below beam
            _hw_items = []
            if calc.get("beam_type", "dropped") == "dropped":
                _hw_items.append(spec["hardware"]["hurricane_tie"]["model"] + ' TIES')
            if attachment == "ledger":
                _hw_items.append(spec["hardware"]["joist_hanger"]["model"] + ' HANGERS')
            if _hw_items:
                ax.text(W / 2, beam_y - 1.5,
                        'SIMPSON ' + ' + '.join(_hw_items),
                        ha='center', fontsize=_hw_fs, fontfamily='monospace', color=BRAND["dark"],
                        bbox=_hw_box)

            # S61: Loads box - moved OUTSIDE deck to lower-left margin
            _has_snow = bool(spec["labels"].get("loads_snow"))
            _has_ledger = bool(spec["labels"].get("loads_ledger"))
            _lb_x = min(bbox["x"], stair_x_min) - margin_x_left + 1
            _lb_y = -house_depth + 0.5
            _lb_lines = 4 + (1 if _has_snow else 0) + (1 if _has_ledger else 0)
            _lb_h = 0.5 + _lb_lines * 0.55
            _lb_w = 5.5
            ax.add_patch(patches.Rectangle((_lb_x, _lb_y), _lb_w, _lb_h,
                         fc='#fafaf8', ec=BRAND["dark"], lw=0.5, zorder=5))
            _ly = _lb_y + _lb_h - 0.4
            _line_n = 0
            ax.text(_lb_x + 0.2, _ly, 'DECK LOADS:', fontsize=4,
                    fontweight='bold', color=BRAND["dark"], zorder=6)
            _line_n += 1
            ax.text(_lb_x + 0.2, _ly - _line_n * 0.55, spec["labels"]["loads_LL"],
                    fontsize=3.5, color=BRAND["dark"], zorder=6)
            if _has_snow:
                _line_n += 1
                ax.text(_lb_x + 0.2, _ly - _line_n * 0.55, spec["labels"]["loads_snow"],
                        fontsize=3.5, color=BRAND["dark"], zorder=6)
            _line_n += 1
            ax.text(_lb_x + 0.2, _ly - _line_n * 0.55, spec["labels"]["loads_DL"],
                    fontsize=3.5, color=BRAND["dark"], zorder=6)
            _line_n += 1
            ax.text(_lb_x + 0.2, _ly - _line_n * 0.55, spec["labels"]["loads_TL"],
                    fontsize=3.5, fontweight='bold', color=BRAND["red"], zorder=6)
            _line_n += 1
            ax.text(_lb_x + 0.2, _ly - _line_n * 0.55, spec["labels"]["loads_lumber"],
                    fontsize=3.5, color=BRAND["dark"], zorder=6)
            if _has_ledger:
                _line_n += 1
                ax.text(_lb_x + 0.2, _ly - _line_n * 0.55, spec["labels"]["loads_ledger"],
                        fontsize=3.5, color=BRAND["dark"], zorder=6)



            # S68: FREESTANDING DIAGONAL BRACING on framing plan
            if attachment != "ledger" and len(calc["post_positions"]) >= 2:
                _pp_brace = calc["post_positions"]
                for _bi in range(len(_pp_brace) - 1):
                    _bx1 = _pp_brace[_bi]
                    _bx2 = _pp_brace[_bi + 1]
                    # X-brace between adjacent posts (plan view shows as diagonals)
                    ax.plot([_bx1, _bx2], [beam_y, beam_y - 3],
                            color=BRAND["dark"], lw=0.6, ls='--', dashes=(3, 2))
                    ax.plot([_bx1, _bx2], [beam_y - 3, beam_y],
                            color=BRAND["dark"], lw=0.6, ls='--', dashes=(3, 2))
                # Label
                ax.text(W / 2, beam_y - 4.5,
                        '2x4 PT DIAGONAL BRACING (TYP.) - SEE ELEVATIONS',
                        ha='center', fontsize=3.0, fontfamily='monospace',
                        color=BRAND["dark"], fontstyle='italic',
                        bbox=dict(boxstyle='square,pad=0.15', fc='white',
                                  ec=BRAND["border"], lw=0.3, alpha=0.9))

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

        else:
            # Plan view labels (zone 0 center)
            ax.text(W / 2, D / 2 + 0.8, spec["labels"]["decking"],
                    ha='center', fontsize=5.5, fontfamily='monospace', color='#666')
            ax.text(W / 2, D / 2 - 0.8, spec["labels"]["guardrail"],
                    ha='center', fontsize=5, fontfamily='monospace', color='#666')

        # Railing (S61: chamfer-aware edges from zone_utils)
        for e in exp_edges:
            ax.plot([e["x1"], e["x2"]], [e["y1"], e["y2"]], color=BRAND["rail"], lw=3.5)

        # S68: Generic stair rendering from geometry engine (all templates)
        all_stairs = resolve_all_stairs(params, calc)
        for rs in all_stairs:
            sg = rs.get("geometry")
            if not sg:
                continue
            _wax = rs["world_anchor_x"]
            _way = rs["world_anchor_y"]
            _ang = rs["angle"]
            st = rs["stair_info"]

            def _tp(lx, ly):
                return transform_stair_point(lx, ly, _wax, _way, _ang)

            # Draw each landing platform
            _is_multi_run = len(sg["runs"]) > 1
            for li, landing in enumerate(sg["landings"]):
                lr = landing["rect"]
                lx, ly, lw, lh = lr["x"], lr["y"], lr["w"], lr["h"]
                corners = [_tp(lx, ly), _tp(lx + lw, ly), _tp(lx + lw, ly + lh), _tp(lx, ly + lh)]
                poly = Polygon(corners, closed=True, fc='#e8e8e0', ec=BRAND["dark"], lw=0.8)
                ax.add_patch(poly)
                cx_l, cy_l = _tp(lx + lw / 2, ly + lh / 2)
                ax.text(cx_l, cy_l, 'LANDING', ha='center', va='center',
                        fontsize=3.0, fontweight='bold', color=BRAND["mute"],
                        bbox=dict(boxstyle='square,pad=0.1', fc='white', ec='none', alpha=0.85))
                # Landing posts
                for pp in landing.get("posts", []):
                    wpx, wpy = _tp(pp[0], pp[1])
                    ax.plot(wpx, wpy, 's', ms=3, color=BRAND["post"],
                            mec=BRAND["dark"], mew=0.5)
                    # Pier circle at each landing post
                    pier = plt.Circle((wpx, wpy), calc.get("footing_diam", 24) / 24 * 0.5,
                                      fill=False, ec=BRAND["dark"], lw=0.3, ls='--')
                    ax.add_patch(pier)
                # Landing post/pier callout (only on first landing, only for multi-run)
                if _is_multi_run and li == 0 and landing.get("posts"):
                    _lp0 = landing["posts"][0]
                    _lpx, _lpy = _tp(_lp0[0], _lp0[1])
                    _lp_txt = (f'4x4 PT POSTS W/ SIMPSON\n'
                               f"'ABU44Z' POST BASE ({len(landing['posts'])}) PLCS\n"
                               f'{calc.get("footing_diam", 12)}" CONC. PIERS')
                    ax.text(_lpx - 1.5, _lpy - 0.8, _lp_txt, fontsize=2.5,
                            fontfamily='monospace', color=BRAND["dark"],
                            bbox=dict(boxstyle='square,pad=0.15', fc='white',
                                      ec=BRAND["border"], lw=0.2, alpha=0.9))

            # Draw each run
            for ri, run in enumerate(sg["runs"]):
                rr = run["rect"]
                rx, ry, rw, rh = rr["x"], rr["y"], rr["w"], rr["h"]

                # Outline (4 sides)
                corners = [_tp(rx, ry), _tp(rx + rw, ry), _tp(rx + rw, ry + rh), _tp(rx, ry + rh)]
                for ci in range(4):
                    c1, c2 = corners[ci], corners[(ci + 1) % 4]
                    ax.plot([c1[0], c2[0]], [c1[1], c2[1]], color=BRAND["dark"], lw=1.0)

                # Treads
                n_treads = run["treads"]
                axis = run["treadAxis"]
                if axis == "h":
                    # Treads are horizontal lines across width
                    tread_step = rh / max(n_treads, 1)
                    for ti in range(n_treads + 1):
                        ty = ry + ti * tread_step
                        p1, p2 = _tp(rx, ty), _tp(rx + rw, ty)
                        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=BRAND["mute"], lw=0.5)
                    # Stringers (dashed, along length)
                    ns = run["nStringers"]
                    for si in range(ns):
                        sx_l = rx + si * rw / (ns - 1) if ns > 1 else rx + rw / 2
                        p1, p2 = _tp(sx_l, ry), _tp(sx_l, ry + rh)
                        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=BRAND["mute"],
                                lw=0.3, ls='--', dashes=(2, 2))
                else:
                    # treadAxis == "w": treads are vertical lines across height
                    tread_step = rw / max(n_treads, 1)
                    for ti in range(n_treads + 1):
                        tx = rx + ti * tread_step
                        p1, p2 = _tp(tx, ry), _tp(tx, ry + rh)
                        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=BRAND["mute"], lw=0.5)
                    # Stringers (dashed, along length)
                    ns = run["nStringers"]
                    for si in range(ns):
                        sy_l = ry + si * rh / (ns - 1) if ns > 1 else ry + rh / 2
                        p1, p2 = _tp(rx, sy_l), _tp(rx + rw, sy_l)
                        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=BRAND["mute"],
                                lw=0.3, ls='--', dashes=(2, 2))

                # DN arrow (points in downDir direction)
                ddir = run["downDir"]
                cx_r, cy_r = rx + rw / 2, ry + rh / 2
                arrow_len = (rh if axis == "h" else rw) * 0.4
                if ddir == "+y":
                    a_from, a_to = _tp(cx_r, ry + 0.3), _tp(cx_r, ry + rh - 0.3)
                elif ddir == "-y":
                    a_from, a_to = _tp(cx_r, ry + rh - 0.3), _tp(cx_r, ry + 0.3)
                elif ddir == "+x":
                    a_from, a_to = _tp(rx + 0.3, cy_r), _tp(rx + rw - 0.3, cy_r)
                elif ddir == "-x":
                    a_from, a_to = _tp(rx + rw - 0.3, cy_r), _tp(rx + 0.3, cy_r)
                else:
                    a_from, a_to = _tp(cx_r, ry + 0.3), _tp(cx_r, ry + rh - 0.3)
                ax.annotate('', xy=a_to, xytext=a_from,
                            arrowprops=dict(arrowstyle='->', color=BRAND["dark"], lw=0.8))
                dn_cx, dn_cy = _tp(cx_r, cy_r)
                ax.text(dn_cx, dn_cy, 'DOWN', ha='center', va='center', fontsize=4,
                        fontweight='bold', color=BRAND["dark"],
                        bbox=dict(boxstyle='square,pad=0.15', fc='white', ec='none', alpha=0.9))

            # Concrete pad at base of last run
            if sg["runs"]:
                last = sg["runs"][-1]
                lr = last["rect"]
                dd = last["downDir"]
                lx, ly, lw, lh = lr["x"], lr["y"], lr["w"], lr["h"]
                pad_d = 3.0  # 3ft concrete pad
                if dd == "+y":
                    pad_corners = [_tp(lx - 0.25, ly + lh), _tp(lx + lw + 0.25, ly + lh),
                                   _tp(lx + lw + 0.25, ly + lh + pad_d), _tp(lx - 0.25, ly + lh + pad_d)]
                elif dd == "-y":
                    pad_corners = [_tp(lx - 0.25, ly - pad_d), _tp(lx + lw + 0.25, ly - pad_d),
                                   _tp(lx + lw + 0.25, ly), _tp(lx - 0.25, ly)]
                elif dd == "+x":
                    pad_corners = [_tp(lx + lw, ly - 0.25), _tp(lx + lw + pad_d, ly - 0.25),
                                   _tp(lx + lw + pad_d, ly + lh + 0.25), _tp(lx + lw, ly + lh + 0.25)]
                elif dd == "-x":
                    pad_corners = [_tp(lx - pad_d, ly - 0.25), _tp(lx, ly - 0.25),
                                   _tp(lx, ly + lh + 0.25), _tp(lx - pad_d, ly + lh + 0.25)]
                else:
                    pad_corners = None
                if pad_corners:
                    poly = Polygon(pad_corners, closed=True, fc='#e8e8e0', ec=BRAND["dark"], lw=0.6, ls='--')
                    ax.add_patch(poly)
                    pcx, pcy = sum(c[0] for c in pad_corners) / 4, sum(c[1] for c in pad_corners) / 4
                    ax.text(pcx, pcy, 'CONCRETE\nLANDING', ha='center', va='center',
                            fontsize=2.5, color=BRAND["mute"])

            # Stringer/rise/run callout (positioned outside the stair bbox)
            bb = sg["bbox"]
            _rise_txt = f'{sg["riseIn"]:.1f}" RISE'
            _run_txt = '10.5" RUN'
            _callout_lines = []
            # Per-run stringer counts (only itemize if multi-run)
            if _is_multi_run:
                for ri, run in enumerate(sg["runs"]):
                    _callout_lines.append(f'RUN {ri + 1}: ({run["nStringers"]}) 2x12 PT STRINGERS')
            else:
                _callout_lines.append(f'({sg["totalStringers"]}) 2x12 PT STRINGERS')
            _callout_lines.append(f'{_rise_txt} / {_run_txt}')
            _callout_text = '\n'.join(_callout_lines)
            # Place callout to the right of the stair bbox
            _cb_lx = bb["maxX"] + 0.5
            _cb_ly = (bb["minY"] + bb["maxY"]) / 2
            _cb_wx, _cb_wy = _tp(_cb_lx, _cb_ly)
            ax.text(_cb_wx, _cb_wy, _callout_text, fontsize=3.5,
                    fontfamily='monospace', color=BRAND["dark"], va='center',
                    bbox=dict(boxstyle='square,pad=0.2', fc='white', ec=BRAND["border"],
                              lw=0.3, alpha=0.9))

            # S68: Per-run length dimensions (only for multi-run stairs)
            if _is_multi_run:
                for ri, run in enumerate(sg["runs"]):
                    rr = run["rect"]
                    rx, ry, rw, rh = rr["x"], rr["y"], rr["w"], rr["h"]
                    axis = run["treadAxis"]
                    run_len = rh if axis == "h" else rw
                    # Dimension line along the run length, offset outside
                    if axis == "h":
                        # Vertical run: dimension on the left side
                        p1 = _tp(rx - 0.3, ry)
                        p2 = _tp(rx - 0.3, ry + rh)
                        _dim_cx, _dim_cy = _tp(rx - 1.0, ry + rh / 2)
                        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=BRAND["mute"], lw=0.4)
                        ax.text(_dim_cx, _dim_cy, format_feet_inches(run_len),
                                ha='center', va='center', fontsize=3.0, color=BRAND["dark"],
                                rotation=90 if abs(_ang) < 45 else 0,
                                bbox=dict(boxstyle='square,pad=0.1', fc='white',
                                          ec='none', alpha=0.85))
                    else:
                        # Horizontal run: dimension below
                        p1 = _tp(rx, ry - 0.3)
                        p2 = _tp(rx + rw, ry - 0.3)
                        _dim_cx, _dim_cy = _tp(rx + rw / 2, ry - 1.0)
                        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=BRAND["mute"], lw=0.4)
                        ax.text(_dim_cx, _dim_cy, format_feet_inches(run_len),
                                ha='center', va='center', fontsize=3.0, color=BRAND["dark"],
                                bbox=dict(boxstyle='square,pad=0.1', fc='white',
                                          ec='none', alpha=0.85))
                # Landing depth dimensions
                for li, landing in enumerate(sg["landings"]):
                    lr = landing["rect"]
                    _ld_txt = format_feet_inches(lr["h"])
                    _ld_cx, _ld_cy = _tp(lr["x"] + lr["w"] + 0.8, lr["y"] + lr["h"] / 2)
                    ax.text(_ld_cx, _ld_cy, f'{_ld_txt}\nLANDING', ha='center', va='center',
                            fontsize=2.5, color=BRAND["dark"],
                            bbox=dict(boxstyle='square,pad=0.1', fc='white',
                                      ec='none', alpha=0.85))

        # S68: Stair opening width callouts on framing plan (all stairs)
        if is_framing and all_stairs:
            for rs in all_stairs:
                sg = rs.get("geometry")
                if not sg or not sg["runs"]:
                    continue
                # Opening = first run rect width at deck edge
                r0 = sg["runs"][0]["rect"]
                sw_ft = r0["w"] if sg["runs"][0]["treadAxis"] == "h" else r0["h"]
                _wax = rs["world_anchor_x"]
                _way = rs["world_anchor_y"]
                s_loc = rs["exit_side"]
                if s_loc == "front":
                    p1x, _ = transform_stair_point(r0["x"], 0, _wax, _way, rs["angle"])
                    p2x, _ = transform_stair_point(r0["x"] + r0["w"], 0, _wax, _way, rs["angle"])
                    draw_dimension_h(ax, p1x, p2x, _way,
                                     f'{format_feet_inches(sw_ft)} OPENING',
                                     offset=max(D * 0.08, 1.2), color='#c62828', fontsize=4.5)
                elif s_loc == "left":
                    _, p1y = transform_stair_point(r0["x"], 0, _wax, _way, rs["angle"])
                    _, p2y = transform_stair_point(r0["x"] + r0["w"], 0, _wax, _way, rs["angle"])
                    draw_dimension_v(ax, _wax, min(p1y, p2y), max(p1y, p2y),
                                     f'{format_feet_inches(sw_ft)} OPENING',
                                     offset=-3.5, color='#c62828', fontsize=4.5)
                elif s_loc == "right":
                    _, p1y = transform_stair_point(r0["x"], 0, _wax, _way, rs["angle"])
                    _, p2y = transform_stair_point(r0["x"] + r0["w"], 0, _wax, _way, rs["angle"])
                    draw_dimension_v(ax, _wax, min(p1y, p2y), max(p1y, p2y),
                                     f'{format_feet_inches(sw_ft)} OPENING',
                                     offset=max(W * 0.08, 3), color='#c62828', fontsize=4.5)

        # S68: Stair notes box (plan view only, only when stairs exist)
        if not is_framing and all_stairs:
            _sn_lines = [
                'STAIR NOTES:',
                'PROVIDE HANDRAIL ON BOTH SIDES OF STAIR,',
                'HANDRAIL SHALL BE PLACED 34" ABOVE THE',
                'NOSING OF TREADS.',
                '',
                'STAIR TREADS AND RISERS NOTE: STAIRS TO MEET',
                'THE FOLLOWING REQUIREMENTS OF CURRENT IRC',
                'MAX STAIR RISER OF 7.75", MINIMUM STAIR',
                'TREAD DEPTH OF 10"',
                'TREAD NOSINGS BETWEEN .75" AND 1.25"',
                'IF TREADS <11" WITH SOLID RISERS',
                '',
                '*THE GREATEST RISER HEIGHT AND TREAD DEPTH',
                'SHALL NOT EXCEED THE SMALLEST BY MORE THAN',
                '3/8" WITHIN ANY FLIGHT OF STAIRS',
            ]
            _sn_text = '\n'.join(_sn_lines)
            _sn_x = min(bbox["x"], stair_x_min) - margin_x_left + 1.5
            _sn_y = bbox["y"] + bbox["d"] * 0.15
            ax.text(_sn_x, _sn_y, _sn_text, fontsize=2.8,
                    fontfamily='monospace', color=BRAND["dark"], va='top',
                    linespacing=1.3,
                    bbox=dict(boxstyle='square,pad=0.3', fc='#fafaf8',
                              ec=BRAND["dark"], lw=0.4))

        # Dimensions (zone 0 overall)
        draw_dimension_h(ax, 0, W, D, format_feet_inches(W),
                         offset=max(D * 0.15, 2), color=BRAND["red"], fontsize=7)
        draw_dimension_v(ax, W, 0, D, format_feet_inches(D),
                         offset=max(W * 0.04, 1.2), color=BRAND["blue"], fontsize=7)

        # S47: North arrow in upper-left margin, scale bar below house
        draw_north_arrow(ax, min(bbox["x"], stair_x_min) - margin_x_left + 2,
                         _view_top + margin_y - 2.5,
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
