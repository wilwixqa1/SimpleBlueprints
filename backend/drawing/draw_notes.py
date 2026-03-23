"""
draw_notes.py â General Notes & Code Compliance Sheet
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
    has_zones = len(params.get("zones", [])) > 0
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
    ax.text(7, 7.80, "Per IRC 2021 (International Residential Code) \u2014 Deck Construction",
            ha='center', va='top', fontsize=8, fontfamily='monospace', color='#666666')

    # --- Drawing helpers ---
    left_col_x = 0.7
    right_col_x = 7.3
    col_width = 5.8
    note_font = 6.5
    head_font = 8
    irc_font = 5.5
    line_h = 0.12
    note_gap = 0.03
    bar_h = 0.24

    def draw_section(x, y, title, notes, width=col_width):
        """Draw a section with title bar and numbered notes. Returns new y."""
        ax.fill_between([x - 0.05, x + width + 0.05], y, y - bar_h,
                        color='#3d5a2e', alpha=0.9, zorder=2)
        ax.text(x + 0.1, y - 0.06, title,
                fontsize=head_font, fontweight='bold', fontfamily='monospace',
                color='white', va='top', zorder=3)
        cy = y - bar_h - line_h

        for i, (note_text, irc_ref) in enumerate(notes, 1):
            ax.text(x + 0.05, cy, str(i) + ".",
                    fontsize=note_font, fontfamily='monospace', fontweight='bold',
                    color='#3d5a2e', va='top')
            lines = _wrap_text(note_text, 90)
            for li, line in enumerate(lines):
                ax.text(x + 0.3, cy - li * line_h, line,
                        fontsize=note_font, fontfamily='monospace',
                        color='#2c2c2c', va='top')
            line_count = len(lines)
            if irc_ref:
                ax.text(x + 0.3, cy - line_count * line_h, irc_ref,
                        fontsize=irc_font, fontfamily='monospace',
                        color='#888888', va='top', style='italic')
                cy -= (line_count + 1) * line_h + note_gap
            else:
                cy -= line_count * line_h + note_gap
        return cy

    # ============================================================
    # LEFT COLUMN
    # ============================================================
    y = 7.55

    # --- 1. GENERAL REQUIREMENTS ---
    general_notes = [
        ("All work shall comply with the 2021 International Residential Code (IRC) "
         "and all applicable local amendments. Obtain all required permits prior to construction.",
         "IRC R105.1"),
        ("Design loads: 40 PSF live load, 10 PSF dead load" +
         (", 30 PSF ground snow load" if snow_load == "moderate" else
          ", 50 PSF ground snow load" if snow_load == "heavy" else "") + ".",
         "IRC Table R301.5"),
        ("Contractor shall verify all dimensions and site conditions prior to construction. "
         "Report any discrepancies to the designer.",
         None),
        ("All lumber in contact with concrete, masonry, or ground shall be pressure-treated "
         "(UC4A min.) or approved decay-resistant species.",
         "IRC R507.2"),
    ]
    y = draw_section(left_col_x, y, "GENERAL REQUIREMENTS", general_notes)

    y -= 0.04

    # --- 2. FOUNDATION & FOOTINGS ---
    foundation_notes = [
        ("Footings: " + str(footing_diam) + "\" diameter x " +
         str(footing_depth) + "\" deep min., bearing on undisturbed soil below frost line.",
         "IRC R507.3.1, Table R301.2"),
        ("Footing concrete: 3,000 PSI min. compressive strength (f'c). "
         "Footings shall extend min. 6\" above grade.",
         "IRC R507.3.1"),
        ("Posts shall bear on approved adjustable post bases (e.g., Simpson ABU/ABA series). "
         "Posts shall not bear directly on concrete.",
         "IRC R507.8"),
        ("Post size: " + post_size + " minimum. Posts shall be plumb and braced during construction.",
         "IRC R507.8"),
    ]
    y = draw_section(left_col_x, y, "FOUNDATION & FOOTINGS", foundation_notes)

    y -= 0.04

    # --- 3. FRAMING ---
    zone_prefix = "Main deck joists" if has_zones else "Joists"
    framing_notes = [
        (zone_prefix + ": " + joist_size + " at " + str(joist_spacing) + "\" O.C. "
         "Joists shall be crowned up and secured at both ends with approved hangers or bearing.",
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
            ("Hurricane ties (e.g., Simpson H2.5A) required at every joist-to-beam connection "
             "for drop beam. Install solid roll blocking above beam to prevent joist rollover.",
             "IRC R507.5")
        )
    framing_notes.append(
        ("Rim/band joists at all open joist ends. Secure with min. (3) 16d nails or "
         "approved fasteners at each joist.",
         "IRC R507.5")
    )
    if has_zones:
        framing_notes.append(
            ("Additional zones have independent framing (joists, beam, posts, footings) "
             "as shown on Sheet A-1. Each zone section is structurally self-supporting. "
             "Verify zone-specific member sizes on the framing plan.",
             "IRC R507")
        )
    y = draw_section(left_col_x, y, "FRAMING", framing_notes)

    # ============================================================
    # RIGHT COLUMN
    # ============================================================
    y2 = 7.55

    # --- 4. LEDGER or FREESTANDING ---
    if attachment == "ledger":
        ledger_notes = [
            ("Ledger board: Pressure-treated lumber matching joist depth. Attach with 1/2\" lag "
             "screws or approved ledger fasteners per IRC Table R507.2.2 spacing.",
             "IRC R507.2.2"),
            ("Flashing: Self-adhering or metal flashing required over ledger board, extending up "
             "wall behind siding/cladding. Must prevent water infiltration at wall connection.",
             "IRC R507.2.1"),
            ("Lateral load connectors: Install min. (2) approved connectors (e.g., Simpson DTT2Z) "
             "tying deck to house floor framing. Space within 24\" of each end of ledger.",
             "IRC R507.2.5"),
            ("Remove siding/cladding at ledger location. Ledger shall bear directly against house "
             "rim board or band joist. Do not attach ledger over siding.",
             "IRC R507.2"),
        ]
        y2 = draw_section(right_col_x, y2, "LEDGER ATTACHMENT", ledger_notes)
    else:
        freestanding_notes = [
            ("Deck is freestanding (not attached to house). All lateral and vertical loads "
             "transfer through posts to footings.",
             "IRC R507"),
            ("Provide diagonal bracing or knee bracing at corner posts if deck height "
             "exceeds 4 feet above grade.",
             "IRC R507.8"),
            ("All post-to-beam and post-to-footing connections shall use approved metal connectors.",
             "IRC R507.8"),
        ]
        y2 = draw_section(right_col_x, y2, "FREESTANDING DECK", freestanding_notes)

    y2 -= 0.04

    # --- 5. GUARDRAILS & HANDRAILS ---
    guard_notes = [
        ("Guards required on all open sides where deck surface is more than 30\" above grade. "
         "Minimum guard height: " + str(rail_height) + "\".",
         "IRC R507.7.3, R312.1"),
        ("Baluster spacing: Max 4\" clear between balusters. A 4\" sphere shall not pass "
         "through any opening in the guard system.",
         "IRC R312.1.3"),
        ("Guard posts and top rail: Must resist 200 lb concentrated load in any direction. "
         "Use through-bolted blocking or approved tension-tie connectors.",
         "IRC R301.5"),
    ]
    y2 = draw_section(right_col_x, y2, "GUARDRAILS & HANDRAILS", guard_notes)

    y2 -= 0.04

    # --- 6. STAIRS (conditional) ---
    if has_stairs:
        stair_notes = [
            ("Max riser height: 7-3/4\". Min tread depth: 10\". Rise and run shall be uniform "
             "with max 3/8\" variation. Min stair width: 36\" clear between guards.",
             "IRC R311.7.5, R311.7.1"),
            ("Handrails required on at least one side if 4 or more risers. Graspable handrail "
             "height: 34\" to 38\" measured from stair nosing.",
             "IRC R311.7.8"),
            ("Stringer connections: Use approved stair stringer connectors (e.g., Simpson LSC) "
             "at top (deck) and bottom (landing/pad) of each stringer.",
             "IRC R507.5"),
            ("Landing/pad: Min 36\" x 36\" at bottom of stairs. Surface shall be level and "
             "on stable base.",
             "IRC R311.7.6"),
        ]
        y2 = draw_section(right_col_x, y2, "STAIRS", stair_notes)

        y2 -= 0.04

    # --- S34: SITE CONDITIONS (slope) ---
    slope_pct = params.get("slopePercent", 0)
    slope_dir = params.get("slopeDirection", "front-to-back")
    if slope_pct > 0:
        dir_labels = {"front-to-back": "front to back", "back-to-front": "back to front",
                      "left-to-right": "left to right", "right-to-left": "right to left"}
        dir_label = dir_labels.get(slope_dir, slope_dir)
        grade_change = slope_pct / 100 * max(W, D)
        site_notes = [
            (f"Site slope: {slope_pct}% grade, {dir_label}. Approximate grade change of "
             f"{grade_change:.1f}\" across the deck footprint. Post heights vary per elevation drawings.",
             None),
            ("Positive drainage away from house foundation required. Final grade shall slope "
             "min. 6\" in the first 10 feet away from foundation per IRC R401.3.",
             "IRC R401.3"),
            ("On sloped sites, downhill footings may require deeper embedment to maintain "
             "min. soil cover. Verify footing depth at each post location.",
             "IRC R403.1.4"),
        ]
        if H > 6 or slope_pct > 5:
            site_notes.append(
                ("Lateral bracing recommended for tall posts on sloped sites. Provide "
                 "diagonal bracing or knee bracing at posts exceeding 8 feet in height.",
                 "IRC R507.8")
            )
        y2 = draw_section(right_col_x, y2, "SITE CONDITIONS", site_notes)
        y2 -= 0.04

    # --- 7. MATERIALS & HARDWARE ---
    mat_notes = [
        ("Decking: " + ("Composite per manufacturer specs. Joist spacing shall not exceed "
         "manufacturer maximum." if decking_type == "composite"
         else "Pressure-treated wood decking (5/4x6 or 2x6). ") +
         " Fasten per manufacturer requirements.",
         "IRC R507.4"),
        ("All connectors, hangers, and hardware: Hot-dip galvanized (HDG) or stainless steel. "
         "Use only manufacturer-specified fasteners for each connector.",
         "IRC R507.2"),
        ("Fasteners in contact with PT lumber: Use HDG, stainless steel, or approved "
         "ACQ-compatible fasteners.",
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
