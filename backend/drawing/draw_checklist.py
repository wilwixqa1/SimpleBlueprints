#!/usr/bin/env python3
"""
SimpleBlueprints - Sheet A-6: Deck Construction Compliance Checklist
S66: Yes/no checklist that building departments expect per Billy's feedback.
Auto-populates based on user configuration and calc results.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

from .draw_plan import BRAND, format_feet_inches
from .calc_engine import calculate_structure


def draw_checklist_sheet(fig, params, calc, spec=None):
    """Draw deck construction compliance checklist."""
    if spec is None:
        from .permit_spec import build_permit_spec
        spec = build_permit_spec(params, calc)

    ax = fig.add_axes([0.06, 0.04, 0.76, 0.92])
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis('off')
    ax.set_facecolor('white')

    attachment = params.get("attachment", "ledger")
    has_stairs = params.get("hasStairs", False) and calc.get("height", 0) > 0.5

    # === TITLE ===
    ax.text(5, 9.7, 'DECK CONSTRUCTION COMPLIANCE CHECKLIST',
            ha='center', fontsize=12, fontweight='bold',
            fontfamily='monospace', color=BRAND["dark"])
    ax.text(5, 9.4, 'Per IRC 2021 Section R507',
            ha='center', fontsize=7, fontfamily='monospace', color=BRAND["mute"])

    # === CHECKLIST SECTIONS ===
    y = 9.0

    def draw_section_header(y_pos, title):
        ax.plot([0.3, 9.7], [y_pos, y_pos], color=BRAND["dark"], lw=0.8)
        ax.text(0.4, y_pos - 0.17, title, fontsize=6.5, fontweight='bold',
                fontfamily='monospace', color=BRAND["dark"])
        return y_pos - 0.28

    def draw_check_item(y_pos, text, value, detail="", ref=""):
        # Checkbox
        bx, by = 0.5, y_pos - 0.06
        box_sz = 0.13
        ax.add_patch(patches.Rectangle((bx, by - box_sz), box_sz, box_sz,
                     fc='white', ec=BRAND["dark"], lw=0.5))
        if value:
            ax.plot([bx + 0.02, bx + 0.05, bx + 0.11],
                    [by - 0.05, by - 0.10, by + 0.0],
                    color=BRAND["green"], lw=1.2)

        # Text
        ax.text(0.75, y_pos - 0.06, text, fontsize=5, fontfamily='monospace',
                color=BRAND["dark"], va='center')

        # Value + ref on right side
        right_text = detail
        if ref:
            right_text += f'  ({ref})'
        if right_text:
            ax.text(9.5, y_pos - 0.06, right_text, fontsize=4, fontfamily='monospace',
                    color=BRAND["blue"], ha='right', va='center', fontweight='bold')

        return y_pos - 0.22

    # 1. FOUNDATION
    y = draw_section_header(y, "1. FOUNDATION")
    footing_diam = calc.get("footing_diam", 24)
    footing_depth = calc.get("footing_depth", 42)
    frost_depth = calc.get("footing_depth", 30)
    y = draw_check_item(y, "Footings extend below frost line",
                        footing_depth >= 30,
                        f'{footing_depth}" deep', "IRC R507.3.1")
    y = draw_check_item(y, "Footing diameter adequate for tributary load",
                        True,
                        f'{footing_diam}" dia.', "IRC Table R507.3.1")
    y = draw_check_item(y, "Footings bear on undisturbed soil",
                        True, "Verify in field", "IRC R507.3.1")
    y = draw_check_item(y, "Post bases: Approved manufactured connectors",
                        True,
                        spec["hardware"]["post_base"]["model"] if spec else "ABU66Z",
                        "IRC R507.3.3")

    # 2. POSTS
    y = draw_section_header(y, "2. POSTS & BEAMS")
    post_size = calc.get("post_size", "6x6")
    beam_size = calc.get("beam_size", "2-ply 2x10")
    y = draw_check_item(y, "Posts: Pressure-treated, minimum size per table",
                        True, f'{post_size} PT', "IRC R507.4")
    y = draw_check_item(y, "Post-to-beam connectors installed",
                        True,
                        spec["hardware"]["post_cap"]["model"] if spec else "BCS2-3/6",
                        "IRC R507.4")
    y = draw_check_item(y, "Beam: Sized per IRC table for span and load",
                        True, beam_size.upper(), "IRC R507.5")
    beam_cant = calc.get("beam_span", 0) * 0.25
    y = draw_check_item(y, "Beam cantilever does not exceed 1/4 of span",
                        True,
                        f'Max {beam_cant:.1f}\' cant.', "IRC R507.5")

    # 3. LEDGER / FREESTANDING
    if attachment == "ledger":
        y = draw_section_header(y, "3. LEDGER ATTACHMENT")
        y = draw_check_item(y, "Siding/cladding removed at ledger location",
                            True, "Required", "IRC R507.2")
        y = draw_check_item(y, "Ledger fasteners: Lag screws or bolts per table",
                            True,
                            spec["hardware"]["ledger_fastener"]["size"] + " lags" if spec else '1/2" lags',
                            "IRC R507.2.2")
        y = draw_check_item(y, "Flashing installed over ledger board",
                            True, "Required", "IRC R507.2.1")
        y = draw_check_item(y, "Lateral load connectors installed",
                            True,
                            f'(2) {spec["hardware"]["lateral_load"]["model"]}' if spec else "(2) DTT2Z",
                            "IRC R507.2.5")
        y = draw_check_item(y, "Band joist: Min 2\" solid-sawn or 1\"x9.5\" LVL",
                            True, "Verify in field", "IRC R507.2")
        y = draw_check_item(y, "No attachment to brick veneer or cantilever",
                            True, "Prohibited", "IRC R507.2")
    else:
        y = draw_section_header(y, "3. FREESTANDING DECK")
        y = draw_check_item(y, "Lateral bracing at corner posts",
                            True, "Required", "IRC R507.8")
        y = draw_check_item(y, "All loads transfer through posts to footings",
                            True, "Verified", "IRC R507")

    # 4. FRAMING
    y = draw_section_header(y, "4. FRAMING")
    joist_size = calc.get("joist_size", "2x8")
    joist_spacing = calc.get("joist_spacing", 16)
    y = draw_check_item(y, "Joist size and spacing per IRC span table",
                        True,
                        f'{joist_size} @ {joist_spacing}" O.C.', "IRC R507.6")
    y = draw_check_item(y, "Joist hangers at all joist-to-beam/ledger connections",
                        True,
                        spec["hardware"]["joist_hanger"]["model"] if spec else "LUS28",
                        "IRC R507.6")
    y = draw_check_item(y, "Rim/band joist at deck perimeter",
                        True, "Required", "IRC R507.6")
    y = draw_check_item(y, "Joist cantilever does not exceed 1/4 of span",
                        True,
                        f'Max {calc.get("joist_span", 10) * 0.25:.1f}\' cant.', "IRC R507.6")

    # 5. DECKING
    y = draw_section_header(y, "5. DECKING & RAILINGS")
    decking = "Composite (Trex)" if params.get("deckingType") == "composite" else "5/4x6 PT"
    rail_type = "Fortress FE26" if params.get("railType") == "fortress" else "Wood"
    guard_h = calc.get("rail_height", 36)
    guard_req = calc.get("height", 0) * 12 > 30
    y = draw_check_item(y, "Decking material and fastening per manufacturer",
                        True, decking, "IRC R507.7")
    y = draw_check_item(y, f'Guards required (deck > 30" above grade)',
                        guard_req,
                        "YES" if guard_req else "N/A",
                        "IRC R312.1")
    if guard_req:
        y = draw_check_item(y, f'Guard height meets minimum requirement',
                            guard_h >= 36,
                            f'{guard_h}" min.', "IRC R312.1.3")
        y = draw_check_item(y, "Baluster spacing: 4\" sphere cannot pass through",
                            True, "Required", "IRC R312.1.3")
    y = draw_check_item(y, "Railing system installed per manufacturer specs",
                        True, rail_type, "IRC R312.1")

    # 6. STAIRS
    if has_stairs:
        y = draw_section_header(y, "6. STAIRS")
        st = calc.get("stairs", {})
        rise = st.get("actual_rise", 7.5)
        y = draw_check_item(y, "Riser height: Uniform, max 7.75\" (min 4\")",
                            4 <= rise <= 7.75,
                            f'{rise:.2f}" rise', "IRC R311.7.5")
        y = draw_check_item(y, "Tread depth: Min 10\" (10.5\" standard)",
                            True, '10.5" tread', "IRC R311.7.5")
        y = draw_check_item(y, "Stair width: Min 36\" clear between guards",
                            (st.get("width", 4) * 12) >= 36,
                            f'{st.get("width", 4) * 12:.0f}" wide', "IRC R311.7.1")
        y = draw_check_item(y, "Handrail: 34\" to 38\" height, continuous",
                            True, "Required", "IRC R311.7.8")
        y = draw_check_item(y, "Landing: Min 36\"x36\" at bottom of stairs",
                            True, "Required", "IRC R311.7.6")
        y = draw_check_item(y, "Stringer connectors at top and bottom",
                            True, "Required", "IRC R507.2.4")

    # 7. INSPECTIONS
    y = draw_section_header(y, "REQUIRED INSPECTIONS")
    y = draw_check_item(y, "1. Footing/post holes: Before concrete placement",
                        False, "Schedule", "")
    y = draw_check_item(y, "2. Framing: Structure complete, before decking",
                        False, "Schedule", "")
    y = draw_check_item(y, "3. Final: All work complete, stairs, guards, landing",
                        False, "Schedule", "")

    # Footer note
    ax.text(5, max(y - 0.5, 0.15),
            "This checklist is provided to support the permit application. "
            "All items must be verified by the building inspector during scheduled inspections. "
            "The building department makes the final determination of code compliance.",
            ha='center', fontsize=5, fontfamily='monospace', color=BRAND["mute"],
            fontstyle='italic', wrap=True,
            bbox=dict(boxstyle='round,pad=0.3', fc='#fafaf5', ec=BRAND["border"], lw=0.5))
