#!/usr/bin/env python3
"""
SimpleBlueprints - Sheet A-6: Deck Attachment Sheet
S66: Matches Billy's reference format -- blank YES/NO intake form
for building departments. Auto-fills address and project specs.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

from .draw_plan import BRAND


def draw_checklist_sheet(fig, params, calc, spec=None):
    """Draw deck attachment sheet matching Billy's reference format."""

    ax = fig.add_axes([0.06, 0.04, 0.76, 0.92])
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis('off')
    ax.set_facecolor('white')

    dk = BRAND["dark"]
    wd = BRAND.get("wood", "#c8a86e")
    rl = BRAND.get("rail", "#444")

    # === TITLE ===
    ax.text(5, 9.55, 'DECK ATTACHMENT SHEET',
            ha='center', fontsize=13, fontweight='bold',
            fontfamily='monospace', color=dk)
    ax.text(5, 9.3, 'This document is to remain with your plans at all times',
            ha='center', fontsize=6.5, fontfamily='monospace', color=dk)
    ax.plot([0.4, 9.6], [9.15, 9.15], color=dk, lw=0.8)

    # === PROJECT ADDRESS ===
    address = params.get("address", "")
    city = params.get("city", "")
    state = params.get("stateCode", "")
    full_addr = address
    if city:
        full_addr += f", {city}"
    if state:
        full_addr += f", {state}"

    ax.text(0.5, 8.95, 'PROJECT ADDRESS:', fontsize=7, fontweight='bold',
            fontfamily='monospace', color=dk)
    ax.plot([3.0, 9.5], [8.9, 8.9], color=dk, lw=0.4)
    if full_addr:
        ax.text(3.1, 8.95, full_addr, fontsize=7, fontfamily='monospace', color=dk)

    # === YES / NO HEADER ===
    y = 8.55
    ax.text(0.65, y, 'YES', fontsize=6.5, fontweight='bold',
            fontfamily='monospace', color=dk, ha='center')
    ax.text(1.15, y, 'NO', fontsize=6.5, fontweight='bold',
            fontfamily='monospace', color=dk, ha='center')

    # === CHECKLIST ITEMS ===
    questions = [
        ("DECK DESIGN INCLUDES A SOLID COVER OR PERGOLA STYLE COVER.", False),
        ("ELECTRICAL SERVICE AND METER LOCATION MAY BE AFFECTED BY DECK.\n"
         "RECOMMEND DISCUSSION WITH ELECTRICAL DEPARTMENT IF YES.", True),
        ("DECK SUPPORTS HOT TUB OR SPA LOADING.", False),
        ("DECK IS SUPPORTED BY CANTILEVER AT HOUSE. EXISTING INVERTED HANGER\n"
         "INSTALLATION WAS VERIFIED OR ENGINEERING WAS PROVIDED.", True),
        ("WALKING SURFACE LESS THAN 18\" ABOVE GRADE.", False),
        ("WALKING SURFACE 8' OR MORE ABOVE GRADE.", False),
        ("DECK IS FREESTANDING AND NOT ATTACHED TO A STRUCTURE (DETACHED).", False),
        ("PROPOSED EXCAVATION OR VERTICAL PENETRATION GREATER THAN 3'-0\" IN DEPTH.", False),
    ]

    y = 8.25
    box_sz = 0.18

    for q_text, is_multi in questions:
        # YES checkbox (blank)
        ax.add_patch(patches.Rectangle((0.5, y - box_sz / 2), box_sz, box_sz,
                     fc='white', ec=dk, lw=0.5))
        # NO checkbox (blank)
        ax.add_patch(patches.Rectangle((1.0, y - box_sz / 2), box_sz, box_sz,
                     fc='white', ec=dk, lw=0.5))

        # Question text
        lines = q_text.split('\n')
        for li, line in enumerate(lines):
            ax.text(1.5, y - li * 0.2, line, fontsize=5.5, fontfamily='monospace',
                    color=dk, va='center')

        y -= 0.48 if is_multi else 0.35

    # === HARDWARE NOTE ===
    y -= 0.15
    ax.plot([0.4, 9.6], [y + 0.1, y + 0.1], color=dk, lw=0.5)
    ax.text(0.5, y - 0.1,
            "USE LISTED JOIST HANGERS TO MATCH JOIST SIZE AND PROVIDE LISTED HARDWARE AT POST CAP AND BASE.",
            fontsize=5, fontfamily='monospace', color=dk, fontweight='bold')
    ax.text(0.5, y - 0.3,
            "INSTALL ALL LISTED PRODUCTS PER THE MANUFACTURER'S RECOMMENDATIONS (USP/SIMPSON/ETC.)",
            fontsize=5, fontfamily='monospace', color=dk, fontweight='bold')

    # === DETAIL INDEX GRID ===
    y -= 0.55
    ax.plot([0.4, 9.6], [y + 0.1, y + 0.1], color=dk, lw=0.5)

    col_w = 3.0
    row_h = 1.5
    grid_x0 = 0.5

    def cell(ci, row_y):
        bx = grid_x0 + ci * col_w
        ax.add_patch(patches.Rectangle((bx, row_y - row_h), col_w - 0.1, row_h,
                     fc='white', ec=dk, lw=0.5))
        return bx, row_y

    # --- TOP ROW ---
    # 1. Stair Details
    bx, ry = cell(0, y)
    sx, sy = bx + 0.4, ry - row_h + 0.3
    for i in range(5):
        tx = sx + i * 0.32
        ty = sy + i * 0.18
        ax.plot([tx, tx + 0.32], [ty, ty], color=dk, lw=0.5)
        ax.plot([tx + 0.32, tx + 0.32], [ty, ty + 0.18], color=dk, lw=0.5)
    ax.plot([sx, sx + 1.6], [sy, sy + 0.9], color=dk, lw=0.3)
    ax.plot([sx + 0.1, sx + 1.5], [sy + 0.5, sy + 1.15], color=rl, lw=0.7)
    # Posts on stair
    for pi in [1, 3]:
        ppx = sx + pi * 0.32 + 0.16
        ppy = sy + pi * 0.18
        ax.plot([ppx, ppx], [ppy, ppy + 0.65], color=rl, lw=0.5)
    ax.text(bx + (col_w - 0.1) / 2, ry - row_h + 0.1, 'STAIR DETAILS',
            ha='center', fontsize=5, fontfamily='monospace', color=dk, fontweight='bold')

    # 2. Guard Details
    bx, ry = cell(1, y)
    gx, gy = bx + 0.35, ry - row_h + 0.3
    gw, gh = 2.0, 0.9
    ax.plot([gx, gx + gw], [gy, gy], color=dk, lw=0.8)
    ax.text(gx + gw / 2, gy - 0.12, 'DECK SURFACE', ha='center', fontsize=3, color=BRAND["mute"])
    ax.plot([gx + 0.1, gx + 0.1], [gy, gy + gh], color=rl, lw=0.7)
    ax.plot([gx + gw - 0.1, gx + gw - 0.1], [gy, gy + gh], color=rl, lw=0.7)
    ax.plot([gx, gx + gw], [gy + gh, gy + gh], color=rl, lw=0.8)
    ax.plot([gx, gx + gw], [gy + 0.12, gy + 0.12], color=rl, lw=0.4)
    for bi in range(8):
        bbx = gx + 0.25 + bi * 0.2
        ax.plot([bbx, bbx], [gy + 0.12, gy + gh], color=rl, lw=0.15)
    # 4" sphere
    sph_x = gx + 0.55
    sph_cy = gy + gh * 0.5
    ax.add_patch(plt.Circle((sph_x, sph_cy), 0.07, fc='none', ec='#c33', lw=0.4, ls='--'))
    ax.text(bx + (col_w - 0.1) / 2, ry - row_h + 0.1, 'GUARD DETAILS',
            ha='center', fontsize=5, fontfamily='monospace', color=dk, fontweight='bold')

    # 3. Ledger Details
    bx, ry = cell(2, y)
    lx, ly = bx + 0.3, ry - row_h + 0.3
    # Wall (wider, taller)
    ax.add_patch(patches.Rectangle((lx, ly), 0.5, 1.0,
                 fc='#e8e4dc', ec=dk, lw=0.6))
    ax.text(lx + 0.25, ly + 0.7, 'WALL', ha='center', fontsize=3, color=BRAND["mute"])
    # Sheathing
    ax.add_patch(patches.Rectangle((lx + 0.5, ly), 0.12, 1.0,
                 fc='#ddd4c0', ec=dk, lw=0.3))
    # Ledger
    ax.add_patch(patches.Rectangle((lx + 0.62, ly + 0.15), 0.2, 0.6,
                 fc=wd, ec=dk, lw=0.5))
    # Joist
    ax.add_patch(patches.Rectangle((lx + 0.82, ly + 0.2), 0.12, 0.5,
                 fc=wd, ec=dk, lw=0.3))
    # Decking
    ax.add_patch(patches.Rectangle((lx + 0.45, ly + 0.8), 1.0, 0.06,
                 fc='#8B7355', ec=dk, lw=0.3))
    # Flashing
    ax.plot([lx + 0.4, lx + 0.62, lx + 0.62, lx + 0.95], [ly + 0.75, ly + 0.75, ly + 0.7, ly + 0.7],
            color=BRAND.get("blue", "#4a7ab5"), lw=0.6)
    # Bolts
    for by_pos in [ly + 0.35, ly + 0.55]:
        ax.plot([lx + 0.5, lx + 0.82], [by_pos, by_pos], color='#c33', lw=0.5)
        ax.plot(lx + 0.82, by_pos, 'o', ms=1.2, color='#c33', mew=0)
    ax.text(bx + (col_w - 0.1) / 2, ry - row_h + 0.1, 'LEDGER DETAILS',
            ha='center', fontsize=5, fontfamily='monospace', color=dk, fontweight='bold')

    # --- BOTTOM ROW ---
    y -= row_h + 0.1

    # 4. Footing Details
    bx, ry = cell(0, y)
    fx, fy = bx + 0.7, ry - row_h + 0.2
    # Ground line with hatching
    gl_y = fy + 0.55
    ax.plot([bx + 0.2, bx + col_w - 0.3], [gl_y, gl_y], color=dk, lw=0.7)
    for gi in range(8):
        gix = bx + 0.3 + gi * 0.3
        ax.plot([gix, gix - 0.1], [gl_y, gl_y - 0.08], color=BRAND["mute"], lw=0.2)
    # Pier below ground
    ax.add_patch(patches.Rectangle((fx, fy), 0.8, 0.55,
                 fc='#d0d0d0', ec=dk, lw=0.5))
    ax.text(fx + 0.4, fy + 0.25, 'CONC.\nPIER', ha='center', va='center', fontsize=2.5, color='#666')
    # Post base
    ax.add_patch(patches.Rectangle((fx + 0.1, gl_y), 0.6, 0.08,
                 fc='#888', ec=dk, lw=0.3))
    # Post above ground
    ax.add_patch(patches.Rectangle((fx + 0.2, gl_y + 0.08), 0.4, 0.55,
                 fc=wd, ec=dk, lw=0.5))
    ax.text(bx + (col_w - 0.1) / 2, ry - row_h + 0.1, 'FOOTING DETAILS\n(posts must be centered)',
            ha='center', fontsize=5, fontfamily='monospace', color=dk, fontweight='bold',
            linespacing=0.85)

    # 5. Post / Beam Connection
    bx, ry = cell(1, y)
    px, py = bx + 0.6, ry - row_h + 0.25
    # Post
    ax.add_patch(patches.Rectangle((px + 0.4, py), 0.4, 0.65,
                 fc=wd, ec=dk, lw=0.5))
    # Post cap
    ax.add_patch(patches.Rectangle((px + 0.2, py + 0.65), 0.8, 0.08,
                 fc='#888', ec=dk, lw=0.3))
    # Beam (multi-ply)
    ax.add_patch(patches.Rectangle((px, py + 0.73), 1.8, 0.3,
                 fc='#b8962e', ec=dk, lw=0.5))
    ax.plot([px + 0.6, px + 0.6], [py + 0.73, py + 1.03], color='#9a8030', lw=0.3)
    ax.plot([px + 1.2, px + 1.2], [py + 0.73, py + 1.03], color='#9a8030', lw=0.3)
    # Joist on top
    ax.add_patch(patches.Rectangle((px, py + 1.03), 1.8, 0.12,
                 fc=wd, ec=dk, lw=0.3))
    # Through bolts
    for bby in [py + 0.8, py + 0.93]:
        ax.plot(px + 0.3, bby, 'x', ms=2, color='#c33', mew=0.5)
        ax.plot(px + 1.5, bby, 'x', ms=2, color='#c33', mew=0.5)
    ax.text(bx + (col_w - 0.1) / 2, ry - row_h + 0.1, 'POST / BEAM CONNECTION',
            ha='center', fontsize=5, fontfamily='monospace', color=dk, fontweight='bold')

    # 6. Cantilever Details
    bx, ry = cell(2, y)
    cx, cy = bx + 0.3, ry - row_h + 0.25
    # Ground line
    ax.plot([cx - 0.1, cx + 2.2], [cy, cy], color=dk, lw=0.6)
    for gi in range(8):
        gix = cx + gi * 0.3
        ax.plot([gix, gix - 0.1], [cy, cy - 0.08], color=BRAND["mute"], lw=0.2)
    # Foundation wall
    ax.add_patch(patches.Rectangle((cx + 0.6, cy), 0.35, 0.7,
                 fc='#d0d0d0', ec=dk, lw=0.6))
    # Hatching
    for hy in [cy + 0.15, cy + 0.35, cy + 0.55]:
        ax.plot([cx + 0.65, cx + 0.9], [hy, hy - 0.08], color=BRAND["mute"], lw=0.2)
    # Deck floor extending past
    ax.add_patch(patches.Rectangle((cx + 0.1, cy + 0.7), 2.0, 0.15,
                 fc=wd, ec=dk, lw=0.4))
    # Decking on top
    ax.add_patch(patches.Rectangle((cx + 0.1, cy + 0.85), 2.0, 0.06,
                 fc='#8B7355', ec=dk, lw=0.3))
    # Rim joist at end
    ax.add_patch(patches.Rectangle((cx + 2.1, cy + 0.7), 0.06, 0.15,
                 fc=wd, ec=dk, lw=0.3))
    # "No ledger" callout
    ax.text(cx + 1.55, cy + 0.4, 'No ledger\nconnection', ha='center',
            fontsize=2.8, color='#c33', fontfamily='monospace', fontstyle='italic')
    ax.text(bx + (col_w - 0.1) / 2, ry - row_h + 0.1, 'CANTILEVER DETAILS',
            ha='center', fontsize=5, fontfamily='monospace', color=dk, fontweight='bold')
