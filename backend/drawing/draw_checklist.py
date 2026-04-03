#!/usr/bin/env python3
"""
SimpleBlueprints - Sheet A-6: Deck Attachment Sheet
S66: Matches Billy's reference format -- blank YES/NO intake form
for building departments. Auto-fills address if available.
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

    # Border
    ax.add_patch(patches.Rectangle((0.3, 0.3), 9.4, 9.4,
                 fc='none', ec=BRAND["dark"], lw=1.5))

    # === TITLE ===
    ax.text(5, 9.35, 'DECK ATTACHMENT SHEET',
            ha='center', fontsize=14, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])
    ax.text(5, 9.05, 'This document is to remain with your plans at all times',
            ha='center', fontsize=7, fontfamily='monospace', color=BRAND["dark"],
            fontstyle='italic')

    # Divider
    ax.plot([0.5, 9.5], [8.85, 8.85], color=BRAND["dark"], lw=0.8)

    # === PROJECT ADDRESS ===
    address = params.get("address", "")
    city = params.get("city", "")
    state = params.get("stateCode", "")
    full_addr = address
    if city:
        full_addr += f", {city}"
    if state:
        full_addr += f", {state}"

    ax.text(0.6, 8.6, 'PROJECT ADDRESS:', fontsize=8, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])
    # Address line
    ax.plot([3.2, 9.3], [8.55, 8.55], color=BRAND["dark"], lw=0.5)
    if full_addr:
        ax.text(3.3, 8.6, full_addr, fontsize=8, fontfamily='monospace',
                color=BRAND["dark"])

    # === YES / NO HEADER ===
    y = 8.15
    ax.text(0.7, y, 'YES', fontsize=7, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"], ha='center')
    ax.text(1.3, y, 'NO', fontsize=7, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"], ha='center')

    # === CHECKLIST ITEMS ===
    questions = [
        "DECK DESIGN INCLUDES A SOLID COVER OR PERGOLA STYLE COVER.",
        ("ELECTRICAL SERVICE AND METER LOCATION MAY BE AFFECTED BY DECK.\n"
         "RECOMMEND DISCUSSION WITH ELECTRICAL DEPARTMENT IF YES."),
        "DECK SUPPORTS HOT TUB OR SPA LOADING.",
        ("DECK IS SUPPORTED BY CANTILEVER AT HOUSE. EXISTING INVERTED HANGER\n"
         "INSTALLATION WAS VERIFIED OR ENGINEERING WAS PROVIDED."),
        "WALKING SURFACE LESS THAN 18\" ABOVE GRADE.",
        "WALKING SURFACE 8' OR MORE ABOVE GRADE.",
        "DECK IS FREESTANDING AND NOT ATTACHED TO A STRUCTURE (DETACHED).",
        "PROPOSED EXCAVATION OR VERTICAL PENETRATION GREATER THAN 3'-0\" IN DEPTH.",
    ]

    y = 7.85
    box_sz = 0.22

    for q in questions:
        # YES checkbox (blank)
        ax.add_patch(patches.Rectangle((0.55, y - box_sz / 2 - 0.02), box_sz, box_sz,
                     fc='white', ec=BRAND["dark"], lw=0.6))
        # NO checkbox (blank)
        ax.add_patch(patches.Rectangle((1.15, y - box_sz / 2 - 0.02), box_sz, box_sz,
                     fc='white', ec=BRAND["dark"], lw=0.6))

        # Question text
        lines = q.split('\n')
        for li, line in enumerate(lines):
            ax.text(1.7, y - li * 0.22, line, fontsize=6, fontfamily='monospace',
                    color=BRAND["dark"], va='center')

        # Spacing depends on number of lines
        y -= 0.55 if len(lines) > 1 else 0.42

    # === HARDWARE NOTE ===
    y -= 0.25
    ax.plot([0.5, 9.5], [y + 0.15, y + 0.15], color=BRAND["dark"], lw=0.5)
    ax.text(0.6, y - 0.1,
            "USE LISTED JOIST HANGERS TO MATCH JOIST SIZE AND PROVIDE LISTED HARDWARE AT POST CAP AND BASE.",
            fontsize=5.5, fontfamily='monospace', color=BRAND["dark"], fontweight='bold')
    ax.text(0.6, y - 0.35,
            "INSTALL ALL LISTED PRODUCTS PER THE MANUFACTURER'S RECOMMENDATIONS (USP/SIMPSON/ETC.)",
            fontsize=5.5, fontfamily='monospace', color=BRAND["dark"], fontweight='bold')

    # === DETAIL INDEX (thumbnail drawings matching our A-4 layout) ===
    y -= 0.75
    ax.plot([0.5, 9.5], [y + 0.15, y + 0.15], color=BRAND["dark"], lw=0.5)

    # 3 columns x 2 rows matching A-4 grid
    col_w = 2.8
    row_h = 1.35
    dk = BRAND["dark"]
    wd = BRAND.get("wood", "#c8a86e")
    rl = BRAND.get("rail", "#444")

    def cell_box(ci, row_y):
        cx = 1.2 + ci * col_w
        bx = cx - 0.8
        ax.add_patch(patches.Rectangle((bx, row_y - row_h), col_w - 0.4, row_h,
                     fc='white', ec=BRAND["border"], lw=0.5))
        return bx, row_y

    # --- TOP ROW ---
    # 1. Stair Details
    bx, ry = cell_box(0, y)
    sx0, sy0 = bx + 0.3, ry - row_h + 0.2
    for i in range(4):
        tx = sx0 + i * 0.35
        ty = sy0 + i * 0.2
        ax.plot([tx, tx + 0.35], [ty, ty], color=dk, lw=0.6)
        ax.plot([tx + 0.35, tx + 0.35], [ty, ty + 0.2], color=dk, lw=0.6)
    # Stringer line
    ax.plot([sx0, sx0 + 1.4], [sy0, sy0 + 0.8], color=dk, lw=0.4)
    # Handrail
    ax.plot([sx0 + 0.1, sx0 + 1.3], [sy0 + 0.55, sy0 + 1.1], color=rl, lw=0.8)
    ax.text(bx + (col_w - 0.4) / 2, ry - row_h + 0.08, 'STAIR DETAILS',
            ha='center', fontsize=4.5, fontfamily='monospace', color=dk, fontweight='bold')

    # 2. Guard Details
    bx, ry = cell_box(1, y)
    gx0, gy0 = bx + 0.4, ry - row_h + 0.25
    gw = 1.6
    gh = 0.8
    # Deck surface
    ax.plot([gx0, gx0 + gw], [gy0, gy0], color=dk, lw=0.8)
    # Posts
    ax.plot([gx0 + 0.1, gx0 + 0.1], [gy0, gy0 + gh], color=rl, lw=0.8)
    ax.plot([gx0 + gw - 0.1, gx0 + gw - 0.1], [gy0, gy0 + gh], color=rl, lw=0.8)
    # Top rail
    ax.plot([gx0, gx0 + gw], [gy0 + gh, gy0 + gh], color=rl, lw=0.8)
    # Bottom rail
    ax.plot([gx0, gx0 + gw], [gy0 + 0.1, gy0 + 0.1], color=rl, lw=0.4)
    # Balusters
    for bi in range(6):
        bbx = gx0 + 0.25 + bi * 0.2
        ax.plot([bbx, bbx], [gy0 + 0.1, gy0 + gh], color=rl, lw=0.2)
    ax.text(bx + (col_w - 0.4) / 2, ry - row_h + 0.08, 'GUARD DETAILS',
            ha='center', fontsize=4.5, fontfamily='monospace', color=dk, fontweight='bold')

    # 3. Ledger Details
    bx, ry = cell_box(2, y)
    lx0, ly0 = bx + 0.3, ry - row_h + 0.25
    # Wall
    ax.add_patch(patches.Rectangle((lx0, ly0), 0.4, 0.9,
                 fc='#ddd', ec=dk, lw=0.5))
    # Ledger board
    ax.add_patch(patches.Rectangle((lx0 + 0.4, ly0 + 0.2), 0.25, 0.5,
                 fc=wd, ec=dk, lw=0.4))
    # Joist
    ax.add_patch(patches.Rectangle((lx0 + 0.65, ly0 + 0.25), 0.15, 0.4,
                 fc=wd, ec=dk, lw=0.3))
    # Decking on top
    ax.plot([lx0 + 0.3, lx0 + 1.2], [ly0 + 0.75, ly0 + 0.75], color=dk, lw=0.8)
    # Bolts
    for by_pos in [ly0 + 0.35, ly0 + 0.5]:
        ax.plot(lx0 + 0.52, by_pos, 'o', ms=1.5, color='#c33', mew=0)
    ax.text(bx + (col_w - 0.4) / 2, ry - row_h + 0.08, 'LEDGER DETAILS',
            ha='center', fontsize=4.5, fontfamily='monospace', color=dk, fontweight='bold')

    # --- BOTTOM ROW ---
    y -= row_h + 0.15

    # 4. Footing Details
    bx, ry = cell_box(0, y)
    fx0, fy0 = bx + 0.6, ry - row_h + 0.2
    # Ground line
    ax.plot([bx + 0.2, bx + col_w - 0.6], [fy0 + 0.5, fy0 + 0.5], color=dk, lw=0.6)
    # Pier below ground
    ax.add_patch(patches.Rectangle((fx0, fy0), 0.6, 0.5,
                 fc='#d0d0d0', ec=dk, lw=0.5))
    # Post above ground
    ax.add_patch(patches.Rectangle((fx0 + 0.15, fy0 + 0.5), 0.3, 0.5,
                 fc=wd, ec=dk, lw=0.4))
    # Post base hardware
    ax.add_patch(patches.Rectangle((fx0 + 0.05, fy0 + 0.5), 0.5, 0.08,
                 fc='#888', ec=dk, lw=0.3))
    ax.text(bx + (col_w - 0.4) / 2, ry - row_h + 0.08, 'FOOTING DETAILS',
            ha='center', fontsize=4.5, fontfamily='monospace', color=dk, fontweight='bold')

    # 5. Post / Beam Connection
    bx, ry = cell_box(1, y)
    px0, py0 = bx + 0.5, ry - row_h + 0.2
    # Post
    ax.add_patch(patches.Rectangle((px0 + 0.3, py0), 0.3, 0.6,
                 fc=wd, ec=dk, lw=0.5))
    # Post cap
    ax.add_patch(patches.Rectangle((px0 + 0.15, py0 + 0.6), 0.6, 0.08,
                 fc='#888', ec=dk, lw=0.3))
    # Beam
    ax.add_patch(patches.Rectangle((px0, py0 + 0.68), 1.4, 0.25,
                 fc='#b8962e', ec=dk, lw=0.5))
    # Joist on top
    ax.plot([px0, px0 + 1.4], [py0 + 1.0, py0 + 1.0], color=dk, lw=0.6)
    ax.text(bx + (col_w - 0.4) / 2, ry - row_h + 0.08, 'POST / BEAM\nCONNECTION',
            ha='center', fontsize=4.5, fontfamily='monospace', color=dk, fontweight='bold',
            linespacing=0.9)

    # 6. Cantilever Details
    bx, ry = cell_box(2, y)
    cx0, cy0 = bx + 0.3, ry - row_h + 0.25
    # Foundation wall
    ax.add_patch(patches.Rectangle((cx0 + 0.5, cy0), 0.3, 0.6,
                 fc='#d0d0d0', ec=dk, lw=0.5))
    # Deck extending past
    ax.add_patch(patches.Rectangle((cx0, cy0 + 0.6), 1.6, 0.15,
                 fc=wd, ec=dk, lw=0.4))
    # Decking on top
    ax.plot([cx0, cx0 + 1.6], [cy0 + 0.8, cy0 + 0.8], color=dk, lw=0.6)
    # Ground line
    ax.plot([cx0 - 0.1, cx0 + 1.8], [cy0, cy0], color=dk, lw=0.5)
    ax.text(bx + (col_w - 0.4) / 2, ry - row_h + 0.08, 'CANTILEVER DETAILS',
            ha='center', fontsize=4.5, fontfamily='monospace', color=dk, fontweight='bold')
