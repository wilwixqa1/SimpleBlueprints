#!/usr/bin/env python3
"""
SimpleBlueprints - Sheet A-6: Deck Attachment Sheet + Cantilever Details
S66: Attachment sheet (blank YES/NO intake form) on top half,
full cantilever detail drawing on bottom half.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

from .draw_plan import BRAND


def draw_checklist_sheet(fig, params, calc, spec=None):
    """Draw deck attachment sheet (top) + cantilever detail (bottom)."""

    dk = BRAND["dark"]
    wd = BRAND.get("wood", "#c8a86e")
    rl = BRAND.get("rail", "#444")

    # ============================================================
    # TOP HALF: ATTACHMENT SHEET
    # ============================================================
    ax = fig.add_axes([0.06, 0.48, 0.76, 0.48])
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis('off')

    # Title
    ax.text(5, 9.6, 'DECK ATTACHMENT SHEET',
            ha='center', fontsize=12, fontweight='bold',
            fontfamily='monospace', color=dk)
    ax.text(5, 9.2, 'This document is to remain with your plans at all times',
            ha='center', fontsize=6, fontfamily='monospace', color=dk)
    ax.plot([0.3, 9.7], [9.0, 9.0], color=dk, lw=0.7)

    # Project address
    address = params.get("address", "")
    city = params.get("city", "")
    state = params.get("stateCode", "")
    full_addr = address
    if city:
        full_addr += f", {city}"
    if state:
        full_addr += f", {state}"

    ax.text(0.4, 8.7, 'PROJECT ADDRESS:', fontsize=7, fontweight='bold',
            fontfamily='monospace', color=dk)
    ax.plot([2.8, 9.5], [8.65, 8.65], color=dk, lw=0.4)
    if full_addr:
        ax.text(2.9, 8.7, full_addr, fontsize=7, fontfamily='monospace', color=dk)

    # YES / NO header
    y = 8.2
    ax.text(0.55, y, 'YES', fontsize=6, fontweight='bold',
            fontfamily='monospace', color=dk, ha='center')
    ax.text(1.05, y, 'NO', fontsize=6, fontweight='bold',
            fontfamily='monospace', color=dk, ha='center')

    # Checklist items
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

    y = 7.85
    box_sz = 0.16

    for q_text, is_multi in questions:
        ax.add_patch(patches.Rectangle((0.4, y - box_sz / 2), box_sz, box_sz,
                     fc='white', ec=dk, lw=0.5))
        ax.add_patch(patches.Rectangle((0.9, y - box_sz / 2), box_sz, box_sz,
                     fc='white', ec=dk, lw=0.5))

        lines = q_text.split('\n')
        for li, line in enumerate(lines):
            ax.text(1.35, y - li * 0.18, line, fontsize=5, fontfamily='monospace',
                    color=dk, va='center')

        y -= 0.42 if is_multi else 0.3

    # Hardware note
    y -= 0.1
    ax.plot([0.3, 9.7], [y + 0.08, y + 0.08], color=dk, lw=0.4)
    ax.text(0.4, y - 0.12,
            "USE LISTED JOIST HANGERS TO MATCH JOIST SIZE AND PROVIDE LISTED HARDWARE AT POST CAP AND BASE.",
            fontsize=4.5, fontfamily='monospace', color=dk, fontweight='bold')
    ax.text(0.4, y - 0.32,
            "INSTALL ALL LISTED PRODUCTS PER THE MANUFACTURER'S RECOMMENDATIONS (USP/SIMPSON/ETC.)",
            fontsize=4.5, fontfamily='monospace', color=dk, fontweight='bold')

    # Reference to A-4
    ax.text(5, y - 0.65, 'See Sheet A-4 for Structural Details: Ledger, Footing, Stair Landing, Guard Rail, Post/Beam',
            ha='center', fontsize=4.5, fontfamily='monospace', color=BRAND["mute"], fontstyle='italic')

    # ============================================================
    # BOTTOM HALF: CANTILEVER DETAIL (full drawing)
    # ============================================================
    ax2 = fig.add_axes([0.06, 0.04, 0.76, 0.42])
    ax2.set_xlim(-3, 17)
    ax2.set_ylim(-7, 12)
    ax2.set_aspect('equal')
    ax2.axis('off')

    ax2.text(-2, 11, 'CANTILEVER DETAILS', fontsize=10, fontweight='bold',
             fontfamily='monospace', color=dk)
    ax2.text(-2, 9.8, 'NOT TO SCALE', fontsize=5, fontfamily='monospace', color=BRAND["mute"])

    # Ledger extension note
    ax2.text(-2, 8.8,
             'Extend ledger 6" and install (3) lags (min)\neach side of beam connection at ledger',
             fontsize=5.5, color=dk, fontfamily='monospace', fontweight='bold', va='top')

    # === PLAN VIEW (top-down) ===
    plan_y = 3.0
    plan_h = 4.5

    # House wall
    wall_x = -1.5
    wall_w = 2.2
    ax2.add_patch(patches.Rectangle((wall_x, plan_y), wall_w, plan_h,
                  fc=BRAND.get("house", "#e8e4dc"), ec=dk, lw=1))
    ax2.text(wall_x + wall_w / 2, plan_y + plan_h / 2, 'HOUSE\nWALL',
             ha='center', va='center', fontsize=5, color=BRAND["mute"])

    # Ledger board
    ledger_x = wall_x + wall_w
    ax2.add_patch(patches.Rectangle((ledger_x, plan_y + 0.3), 0.5, plan_h - 0.6,
                  fc=BRAND.get("post", "#a08860"), ec=dk, lw=0.8))

    # Foundation line (dashed)
    found_x = 7.5
    ax2.plot([found_x, found_x], [plan_y - 0.5, plan_y + plan_h + 0.5],
             color=dk, lw=1.2, ls='--')
    ax2.text(found_x, plan_y + plan_h + 0.8, 'Line of foundation below',
             fontsize=4.5, color=BRAND["mute"], fontfamily='monospace',
             fontstyle='italic', ha='center')

    # Deck floor
    deck_start = ledger_x + 0.5
    deck_end = 15.5
    ax2.add_patch(patches.Rectangle((deck_start, plan_y + 0.1), deck_end - deck_start, plan_h - 0.2,
                  fc='#f5f0e0', ec=dk, lw=0.8))

    # Joists
    for jy in np.arange(plan_y + 0.7, plan_y + plan_h - 0.3, 0.8):
        ax2.plot([deck_start, deck_end], [jy, jy], color=wd, lw=0.5, alpha=0.7)

    # Rim joist
    ax2.add_patch(patches.Rectangle((deck_end, plan_y + 0.1), 0.4, plan_h - 0.2,
                  fc=wd, ec=dk, lw=0.6))

    # Cantilever zone shading
    ax2.add_patch(patches.Rectangle((found_x, plan_y + 0.1), deck_end - found_x, plan_h - 0.2,
                  fc=BRAND.get("red", "#c33"), ec='none', alpha=0.06))

    # Cantilever zone label
    ax2.text((found_x + deck_end) / 2, plan_y + plan_h / 2,
             'Cantilever floor\nthat extends past\nfoundation',
             ha='center', va='center', fontsize=5, color=dk,
             fontfamily='monospace', fontstyle='italic')

    ax2.text(-2, plan_y - 0.8, 'Plan view from the top',
             fontsize=4.5, color=BRAND["mute"], fontfamily='monospace', fontstyle='italic')

    # === ELEVATION VIEW ===
    elev_ground = -4.5

    # Foundation wall
    fw_x = 6
    fw_w = 2.2
    fw_h = 5.5
    ax2.add_patch(patches.Rectangle((fw_x, elev_ground), fw_w, fw_h,
                  fc=BRAND.get("concrete", "#d0d0d0"), ec=dk, lw=1.2))
    for hy in np.arange(elev_ground + 0.5, elev_ground + fw_h, 0.6):
        ax2.plot([fw_x + 0.2, fw_x + fw_w - 0.2], [hy, hy - 0.3],
                 color=BRAND["mute"], lw=0.3)
    ax2.text(fw_x + fw_w / 2, elev_ground + fw_h * 0.4, 'FOUNDATION\nWALL',
             ha='center', va='center', fontsize=4.5, color='#555', fontweight='bold')

    # Deck floor
    deck_elev_y = elev_ground + fw_h
    dk_start = 0.5
    dk_end = 16
    joist_h = 1.2
    ax2.add_patch(patches.Rectangle((dk_start, deck_elev_y), dk_end - dk_start, joist_h,
                  fc=wd, ec=dk, lw=0.8))
    ax2.add_patch(patches.Rectangle((dk_start, deck_elev_y + joist_h), dk_end - dk_start, 0.3,
                  fc='#8B7355', ec=dk, lw=0.5))

    # Ledger at house side
    ax2.add_patch(patches.Rectangle((dk_start - 0.4, deck_elev_y), 0.4, joist_h,
                  fc=BRAND.get("post", "#a08860"), ec=dk, lw=0.6))

    # Rim joist at end
    ax2.add_patch(patches.Rectangle((dk_end, deck_elev_y), 0.4, joist_h,
                  fc=wd, ec=dk, lw=0.6))

    # Ground line
    ax2.plot([-2, 17], [elev_ground, elev_ground], color=dk, lw=1)
    for gi in np.arange(-2, 17, 0.4):
        ax2.plot([gi, gi - 0.2], [elev_ground, elev_ground - 0.3],
                 color=BRAND["mute"], lw=0.25)

    # "No ledger connection" callout
    callout_x = 12
    callout_y = elev_ground + fw_h * 0.35
    ax2.text(callout_x, callout_y,
             'No ledger connection\nto cantilever allowed',
             ha='center', va='center', fontsize=5, color=BRAND.get("red", "#c33"),
             fontweight='bold', fontfamily='monospace',
             bbox=dict(boxstyle='round,pad=0.4', fc='white', ec=BRAND.get("red", "#c33"), lw=1))
    ax2.annotate('', xy=(fw_x + fw_w + 1.2, deck_elev_y + 0.6),
                 xytext=(callout_x - 2, callout_y + 0.5),
                 arrowprops=dict(arrowstyle='->', color=BRAND.get("red", "#c33"), lw=0.8))

    ax2.text(-2, elev_ground - 1, 'Elevation view of the ledger connection',
             fontsize=4.5, color=BRAND["mute"], fontfamily='monospace', fontstyle='italic')
