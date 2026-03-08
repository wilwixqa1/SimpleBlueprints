"""
draw_notes.py — General Notes & Code Compliance Sheet
Auto-populates IRC references based on deck parameters.
"""

def draw_notes_sheet(fig, params, calc):
    """Draw a General Notes page with IRC code references, auto-populated from params."""

    W = params.get("width", 20)
    D = params.get("depth", 12)
    H = params.get("height", 4)
    attachment = params.get("attachment", "ledger")
    beam_type = params.get("beamType", "dropped")
    has_stairs = params.get("hasStairs", False)
    decking_type = params.get("deckingType", "composite")
    joist_spacing = params.get("joistSpacing", 16)
    frost_zone = params.get("frostZone", "cold")
    snow_load = params.get("snowLoad", "moderate")
    post_size = calc.get("postSize", "6x6")
    joist_size = calc.get("joistSize", "2x10")
    beam_size = calc.get("beamSize", "2-ply 2x10")
    footing_diam = calc.get("fDiam", 24)
    footing_depth = calc.get("fDepth", 42)
    joist_span = D - 1.5  # approximate joist span in feet
    needs_blocking = joist_span > 7
    rail_height = 42 if H > 8 else 36  # IRC R507.7.3

    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 8.5)
    ax.axis('off')

    # --- Title ---
    ax.text(7, 8.05, "GENERAL NOTES & CODE COMPLIANCE",
            ha='center', va='top', fontsize=14, fontweight='bold',
            fontfamily='monospace', color='#2c2c2c')
    ax.text(7, 7.78, "Per IRC 2021 (International Residential Code) \u2014 Deck Construction",
            ha='center', va='top', fontsize=8, fontfamily='monospace', color='#666666')

    # --- Drawing helpers ---
    left_col_x = 0.7
    right_col_x = 7.3
    col_width = 5.8
    note_font = 7.5
    head_font = 9
    irc_font = 6.5

    def draw_section(x, y, title, notes, width=col_width):
        """Draw a section with title bar and numbered notes. Returns new y."""
        # Section header bar
        ax.fill_between([x - 0.05, x + width + 0.05], y, y - 0.28,
                        color='#3d5a2e', alpha=0.9, zorder=2)
        ax.text(x + 0.1, y - 0.07, title,
                fontsize=head_font, fontweight='bold', fontfamily='monospace',
                color='white', va='top', zorder=3)
        cy = y - 0.42

        for i, (note_text, irc_ref) in enumerate(notes, 1):
            # Number
            ax.text(x + 0.05, cy, str(i) + ".",
                    fontsize=note_font, fontfamily='monospace', fontweight='bold',
                    color='#3d5a2e', va='top')
            # Note text — wrap long lines
            lines = _wrap_text(note_text, 80)
            for li, line in enumerate(lines):
                ax.text(x + 0.3, cy - li * 0.16, line,
                        fontsize=note_font, fontfamily='monospace',
                        color='#2c2c2c', va='top')
            line_count = len(lines)
            # IRC reference
            if irc_ref:
                ax.text(x + 0.3, cy - line_count * 0.16, irc_ref,
                        fontsize=irc_font, fontfamily='monospace',
                        color='#888888', va='top', style='italic')
                cy -= (line_count + 1) * 0.16 + 0.06
            else:
                cy -= line_count * 0.16 + 0.06
        return cy

    # ============================================================
    # LEFT COLUMN
    # ============================================================
    y = 7.45

    # --- 1. GENERAL REQUIREMENTS ---
    general_notes = [
        ("All work shall comply with the 2021 International Residential Code (IRC) "
         "and all applicable local amendments. Obtain all required permits prior "
         "to construction.",
         "IRC R105.1"),
        ("Design loads: 40 PSF live load, 10 PSF dead load" +
         (", 30 PSF ground snow load" if snow_load == "moderate" else
          ", 50 PSF ground snow load" if snow_load == "heavy" else "") + ".",
         "IRC Table R301.5"),
        ("Contractor shall verify all dimensions and site conditions prior to "
         "construction. Report any discrepancies to the designer.",
         None),
        ("All lumber in contact with concrete, masonry, or ground shall be "
         "pressure-treated (UC4A min.) or approved decay-resistant species.",
         "IRC R507.2"),
    ]
    y = draw_section(left_col_x, y, "GENERAL REQUIREMENTS", general_notes)

    y -= 0.15

    # --- 2. FOUNDATION & FOOTINGS ---
    foundation_notes = [
        ("Footings: " + str(footing_diam) + "\" diameter x " +
         str(footing_depth) + "\" deep minimum, bearing on undisturbed soil "
         "below frost line.",
         "IRC R507.3.1, Table R301.2"),
        ("Footing concrete: 3,000 PSI minimum compressive strength (f'c). "
         "Footings shall extend minimum 6\" above grade.",
         "IRC R507.3.1"),
        ("Posts shall bear on approved adjustable post bases (e.g., Simpson "
         "ABU/ABA series). Posts shall not bear directly on concrete.",
         "IRC R507.8"),
        ("Post size: " + post_size + " minimum. Posts shall be plumb and "
         "braced during construction.",
         "IRC R507.8"),
    ]
    y = draw_section(left_col_x, y, "FOUNDATION & FOOTINGS", foundation_notes)

    y -= 0.15

    # --- 3. FRAMING ---
    framing_notes = [
        ("Joists: " + joist_size + " at " + str(joist_spacing) + "\" O.C. "
         "Joists shall be crowned up and secured at both ends with approved "
         "joist hangers or bearing connections.",
         "IRC R507.5, Table R507.5"),
    ]
    if needs_blocking:
        framing_notes.append(
            ("Mid-span blocking required (joist span > 7 ft). Install solid "
             + joist_size + " blocking at mid-span between all joists.",
             "IRC R507.5")
        )
    framing_notes.append(
        ("Beam: " + beam_size + ". " +
         ("Beam bears on top of posts (drop beam). " if beam_type == "dropped" else
          "Beam is flush-mounted with approved connectors. ") +
         "Beam splices shall occur directly over posts only.",
         "IRC R507.6")
    )
    if beam_type == "dropped":
        framing_notes.append(
            ("Hurricane ties (e.g., Simpson H2.5A) required at every joist-to-beam "
             "connection for drop beam condition. Install solid roll blocking above "
             "beam between joists to prevent rollover.",
             "IRC R507.5")
        )
    framing_notes.append(
        ("Rim/band joists: Install at all open joist ends. Secure with "
         "minimum (3) 16d nails or approved fasteners at each joist.",
         "IRC R507.5")
    )
    y = draw_section(left_col_x, y, "FRAMING", framing_notes)

    # ============================================================
    # RIGHT COLUMN
    # ============================================================
    y2 = 7.45

    # --- 4. LEDGER or FREESTANDING ---
    if attachment == "ledger":
        ledger_notes = [
            ("Ledger board: Pressure-treated lumber matching joist depth. "
             "Attach with 1/2\" lag screws or approved ledger fasteners per "
             "IRC Table R507.2.2 spacing.",
             "IRC R507.2.2"),
            ("Flashing: Self-adhering or metal flashing required over ledger "
             "board, extending up wall behind siding/cladding. Must prevent "
             "water infiltration at wall connection.",
             "IRC R507.2.1"),
            ("Lateral load connectors: Install minimum (2) approved lateral "
             "load connectors (e.g., Simpson DTT2Z) tying deck to house floor "
             "framing. Space within 24\" of each end of ledger.",
             "IRC R507.2.5"),
            ("Remove siding/cladding at ledger location. Ledger shall bear "
             "directly against house rim board or band joist. Do not attach "
             "ledger over siding.",
             "IRC R507.2"),
        ]
        y2 = draw_section(right_col_x, y2, "LEDGER ATTACHMENT", ledger_notes)
    else:
        freestanding_notes = [
            ("Deck is freestanding (not attached to house). All lateral and "
             "vertical loads transfer through posts to footings.",
             "IRC R507"),
            ("Provide diagonal bracing or knee bracing at corner posts if "
             "deck height exceeds 4 feet above grade.",
             "IRC R507.8"),
            ("All post-to-beam and post-to-footing connections shall use "
             "approved metal connectors.",
             "IRC R507.8"),
        ]
        y2 = draw_section(right_col_x, y2, "FREESTANDING DECK", freestanding_notes)

    y2 -= 0.15

    # --- 5. GUARDRAILS & HANDRAILS ---
    guard_notes = [
        ("Guards required on all open sides where deck surface is more than "
         "30\" above grade. Minimum guard height: " + str(rail_height) + "\".",
         "IRC R507.7.3, R312.1"),
        ("Baluster spacing: Maximum 4\" clear between balusters. A 4\" "
         "sphere shall not pass through any opening in the guard system.",
         "IRC R312.1.3"),
        ("Guard posts: Must resist 200 lb concentrated load applied in any "
         "direction at the top. Use through-bolted blocking or approved "
         "tension-tie connectors (e.g., Simpson DTT2Z).",
         "IRC R301.5"),
        ("Top rail: Must support 200 lb concentrated load applied in any "
         "direction along the top.",
         "IRC R301.5"),
    ]
    y2 = draw_section(right_col_x, y2, "GUARDRAILS & HANDRAILS", guard_notes)

    y2 -= 0.15

    # --- 6. STAIRS (conditional) ---
    if has_stairs:
        stair_notes = [
            ("Maximum riser height: 7-3/4\". Minimum tread depth: 10\". "
             "Rise and run shall be uniform with max 3/8\" variation "
             "between largest and smallest.",
             "IRC R311.7.5"),
            ("Stair width: Minimum 36\" clear between guards.",
             "IRC R311.7.1"),
            ("Handrails required on at least one side if 4 or more risers. "
             "Graspable handrail height: 34\" to 38\" measured from stair "
             "nosing.",
             "IRC R311.7.8"),
            ("Stringer connections: Use approved stair stringer connectors "
             "(e.g., Simpson LSC) at top (deck) and bottom (landing/pad) "
             "of each stringer.",
             "IRC R507.5"),
            ("Stair landing/pad: Minimum 36\" x 36\" at bottom of stairs. "
             "Landing surface shall be level and on stable base.",
             "IRC R311.7.6"),
        ]
        y2 = draw_section(right_col_x, y2, "STAIRS", stair_notes)

        y2 -= 0.15

    # --- 7. MATERIALS & HARDWARE ---
    mat_notes = [
        ("Decking: " + ("Composite decking per manufacturer specs. "
         "Joist spacing shall not exceed manufacturer maximum." if decking_type == "composite"
         else "Pressure-treated wood decking (5/4x6 or 2x6). ") +
         " Fasten per manufacturer requirements.",
         "IRC R507.4"),
        ("All connectors, hangers, and hardware: Hot-dip galvanized (HDG) "
         "or stainless steel. Use only manufacturer-specified fasteners for "
         "each connector.",
         "IRC R507.2"),
        ("Fasteners in contact with pressure-treated lumber: Use hot-dip "
         "galvanized, stainless steel, or approved ACQ-compatible fasteners.",
         "IRC R317.3"),
    ]
    y2 = draw_section(right_col_x, y2, "MATERIALS & HARDWARE", mat_notes)

    # --- Footer note ---
    ax.plot([0.5, 13.5], [0.55, 0.55], color='#cccccc', linewidth=0.5)
    ax.text(7, 0.42, "NOTES ARE GENERAL IN NATURE. LOCAL JURISDICTIONS MAY HAVE ADDITIONAL "
            "REQUIREMENTS. VERIFY ALL CODE REFERENCES WITH YOUR LOCAL BUILDING DEPARTMENT.",
            ha='center', va='top', fontsize=6.5, fontfamily='monospace',
            color='#999999', style='italic')


def _wrap_text(text, max_chars):
    """Simple word-wrap that respects max character width."""
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = current + (" " if current else "") + word
        if len(test) > max_chars and current:
            lines.append(current)
            current = word
        else:
            current = test
    if current:
        lines.append(current)
    return lines if lines else [""]
