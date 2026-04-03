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

    # === DETAIL INDEX (thumbnail labels matching our A-4 layout) ===
    y -= 0.75
    ax.plot([0.5, 9.5], [y + 0.15, y + 0.15], color=BRAND["dark"], lw=0.5)

    # 3 columns x 2 rows matching A-4 grid
    col_w = 2.8
    row_h = 0.7
    labels_top = ["STAIR DETAILS", "GUARD DETAILS", "LEDGER DETAILS"]
    labels_bot = ["FOOTING DETAILS\n(posts must be centered)", "POST / BEAM\nCONNECTION", "CANTILEVER DETAILS"]

    for ci, label in enumerate(labels_top):
        cx = 1.2 + ci * col_w
        bx = cx - 0.8
        ax.add_patch(patches.Rectangle((bx, y - row_h), col_w - 0.4, row_h,
                     fc='#fafaf5', ec=BRAND["border"], lw=0.5))
        ax.text(cx + 0.5, y - row_h / 2, label, ha='center', va='center',
                fontsize=5, fontfamily='monospace', color=BRAND["dark"], fontweight='bold')

    y -= row_h + 0.15
    for ci, label in enumerate(labels_bot):
        cx = 1.2 + ci * col_w
        bx = cx - 0.8
        ax.add_patch(patches.Rectangle((bx, y - row_h), col_w - 0.4, row_h,
                     fc='#fafaf5', ec=BRAND["border"], lw=0.5))
        lines = label.split('\n')
        for li, line in enumerate(lines):
            ly = y - row_h / 2 + (0.12 if len(lines) > 1 else 0) - li * 0.2
            ax.text(cx + 0.5, ly, line, ha='center', va='center',
                    fontsize=5 if li == 0 else 4, fontfamily='monospace',
                    color=BRAND["dark"], fontweight='bold' if li == 0 else 'normal')
