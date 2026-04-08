"""
draw_notes.py - General Notes & Code Compliance Sheet
Auto-populates IRC references based on deck parameters.
"""

def draw_notes_sheet(fig, params, calc, spec=None):
    """Draw a General Notes page with IRC code references, auto-populated from spec."""

    # If spec not provided, fall back to raw calc (backwards compat)
    if spec is None:
        from .permit_spec import build_permit_spec
        spec = build_permit_spec(params, calc)

    W = spec["width"]
    D = spec["depth"]
    H = spec["height"]
    attachment = spec["attachment"]
    beam_type = spec["beam_type"]
    has_stairs = spec["stairs"] is not None
    has_zones = spec["has_zones"]
    decking_type = spec["decking"]["type"]
    joist_spacing = spec["joists"]["spacing"]
    frost_zone = spec["frost_zone"]
    snow_load = spec["loads"]["snow_load"]

    # All values from spec (single source of truth)
    post_size = spec["posts"]["size"]
    joist_size = spec["joists"]["size"]
    beam_size = spec["beam"]["size"]
    footing_diam = spec["footings"]["diameter"]
    footing_depth = spec["footings"]["depth"]
    joist_span = spec["joists"]["span"]
    needs_blocking = spec["joists"]["mid_span_blocking"]
    rail_height = spec["guardrail"]["height"]
    post_base = spec["hardware"]["post_base"]
    joist_hanger = spec["hardware"]["joist_hanger"]
    hurricane_tie = spec["hardware"]["hurricane_tie"]
    lateral_load = spec["hardware"]["lateral_load"]

    ax = fig.add_axes([0, 0, 0.84, 1])
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 8.5)
    ax.axis('off')

    # S76: Steel framing awareness
    is_steel = spec.get("is_steel", False)
    steel_gauge = spec.get("steel_gauge", "16")

    # --- Title ---
    ax.text(7, 8.05, "GENERAL NOTES & CODE COMPLIANCE",
            ha='center', va='top', fontsize=14, fontweight='bold',
            fontfamily='monospace', color='#2c2c2c')
    if is_steel:
        ax.text(7, 7.80, "Per Intertek CCRR-0313 (Fortress Evolution Steel Framing System)",
                ha='center', va='top', fontsize=8, fontfamily='monospace', color='#666666')
    else:
        ax.text(7, 7.80, "Per IRC 2021 (International Residential Code) \u2014 Deck Construction",
                ha='center', va='top', fontsize=8, fontfamily='monospace', color='#666666')

    # --- Drawing helpers ---
    left_col_x = 0.7
    right_col_x = 7.3
    col_width = 5.8
    head_font = 8

    # S35: Dynamic spacing based on right-column section count
    slope_pct = params.get("slopePercent", 0)
    _rc_sections = 3  # ledger/freestanding + guardrails + materials (always)
    if has_stairs:
        _rc_sections += 1
    if slope_pct > 0:
        _rc_sections += 1
    _tight_rc = _rc_sections >= 5  # stairs + slope + guardrails + ledger + materials
    _compact_rc = _rc_sections >= 4

    # Use progressively tighter spacing based on section count
    if _tight_rc:
        note_font = 5.5
        line_h = 0.095
        note_gap = 0.015
        bar_h = 0.18
        irc_font = 5.0
    elif _compact_rc:
        note_font = 6.0
        line_h = 0.105
        note_gap = 0.02
        bar_h = 0.20
        irc_font = 5.5
    else:
        note_font = 6.5
        line_h = 0.12
        note_gap = 0.03
        bar_h = 0.24
        irc_font = 5.5

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
    if is_steel:
        general_notes = [
            ("All work shall comply with Intertek CCRR-0313 (Fortress Evolution Steel Framing System) "
             "and all applicable local codes and amendments. Obtain all required permits prior to construction.",
             "CCRR-0313"),
            (("Design loads: 40 PSF live load, "
             + str(spec["loads"]["DL"]) + " PSF dead load"
             + (", " + str(spec["loads"]["ground_snow"]) + " PSF ground snow load"
                + (" (governs)" if spec["loads"]["ground_snow"] > 40 else "")
                if spec["loads"]["ground_snow"] > 0 else "") + ". "
             + "Snow load not concurrent with live load."
             if spec["loads"]["ground_snow"] > 0
             else "Design loads: 40 PSF live load, "
             + str(spec["loads"]["DL"]) + " PSF dead load."),
             "CCRR-0313 Table 2"),
            ("Contractor shall verify all dimensions and site conditions prior to construction. "
             "Report any discrepancies to the designer.",
             None),
            ("Steel framing system: Fortress Evolution per Intertek CCRR-0313. "
             "All steel members are galvanized ASTM A653 G60.",
             "CCRR-0313"),
            ("All connections use Fortress Evolution brackets and 3/4\" self-tapping screws. "
             "Fill all holes in every bracket.",
             "CCRR-0313 Table 1"),
        ]
    else:
        general_notes = [
            ("All work shall comply with the 2021 International Residential Code (IRC) "
             "and all applicable local amendments. Obtain all required permits prior to construction.",
             "IRC R105.1"),
            (("Design loads: 40 PSF live load, "
             + str(spec["loads"]["DL"]) + " PSF dead load"
             + (", " + str(spec["loads"]["ground_snow"]) + " PSF ground snow load"
                + (" (governs)" if spec["loads"]["ground_snow"] > 40 else "")
                if spec["loads"]["ground_snow"] > 0 else "") + ". "
             + "Snow load not concurrent with live load per IRC R507.6 fn. a."
             if spec["loads"]["ground_snow"] > 0
             else "Design loads: 40 PSF live load, "
             + str(spec["loads"]["DL"]) + " PSF dead load."),
             "IRC Table R301.5, R507.6"),
            ("Contractor shall verify all dimensions and site conditions prior to construction. "
             "Report any discrepancies to the designer.",
             None),
            ("All lumber in contact with concrete, masonry, or ground shall be pressure-treated "
             "(UC4A min.) or approved decay-resistant species.",
             "IRC R507.2"),
            ("Structural lumber design basis: No. 2 grade, " +
             spec["labels"]["loads_lumber"].replace("LUMBER: No. 2 ", "") +
             ", wet service factor included. "
             "All span tables per IRC 2021 Section R507.",
             "IRC R507.5, R507.6"),
        ]
    y = draw_section(left_col_x, y, "GENERAL REQUIREMENTS", general_notes)

    y -= 0.04

    # --- 2. FOUNDATION & FOOTINGS ---
    if is_steel:
        foundation_notes = [
            ("Footings: " + str(footing_diam) + "\" diameter x " +
             str(footing_depth) + "\" deep min., bearing on undisturbed soil below frost line.",
             "IRC R507.3.1, Table R301.2"),
            ("Footing concrete: 3,000 PSI min. compressive strength (f'c). "
             "Footings shall extend min. 6\" above grade.",
             "IRC R507.3.1"),
            ("Steel posts must NOT be buried underground. Mount on top of Fortress "
             "3.5\" Post/Pier Brackets. Posts shall not bear directly on concrete.",
             "CCRR-0313 Table 15"),
            ("Post size: 3.5\" x 3.5\" Fortress steel, 11-gauge galvanized ASTM A653 G60. "
             "Posts shall be plumb and braced during construction.",
             "CCRR-0313 Table 15"),
        ]
    else:
        foundation_notes = [
            ("Footings: " + str(footing_diam) + "\" diameter x " +
             str(footing_depth) + "\" deep min., bearing on undisturbed soil below frost line.",
             "IRC R507.3.1, Table R301.2"),
            ("Footing concrete: 3,000 PSI min. compressive strength (f'c). "
             "Footings shall extend min. 6\" above grade.",
             "IRC R507.3.1"),
            ("Posts shall bear on Simpson '" + post_base["model"] + "' adjustable post bases. "
             "Posts shall not bear directly on concrete.",
             "IRC R507.8"),
            ("Post size: " + post_size + " minimum. Posts shall be plumb and braced during construction.",
             "IRC R507.8"),
        ]
    y = draw_section(left_col_x, y, "FOUNDATION & FOOTINGS", foundation_notes)

    y -= 0.04

    # --- 3. FRAMING ---
    zone_prefix = "Main deck joists" if has_zones else "Joists"
    if is_steel:
        framing_notes = [
            (zone_prefix + ": FF-Evolution 2x6-" + steel_gauge + " GA at " + str(joist_spacing) + "\" O.C. "
             "Joists shall be secured at both ends with Fortress Hanger Brackets.",
             "CCRR-0313 Table 2"),
        ]
        if needs_blocking:
            framing_notes.append(
                ("Joist blocking required (joist span > 8 ft). Install Fortress "
                 + str(joist_spacing) + "OC Blocking at mid-span between all joists.",
                 "CCRR-0313")
            )
        _beam_type_str = "Single" if calc.get("steelBeamIsSingle", True) else "Double"
        framing_notes.append(
            ("Beam: FF-Evolution 2x11 " + _beam_type_str + " Beam. " +
             ("Beam bears on top of posts (drop beam). " if beam_type == "dropped" else
              "Beam is flush-mounted with approved connectors. ") +
             "Beam splices shall have 24\" overlap with (4) 3/8\" SS thru bolts.",
             "CCRR-0313 Tables 3-14")
        )
        if beam_type == "dropped":
            framing_notes.append(
                ("Fortress F50 Brackets required at every joist-to-beam connection for drop beam. "
                 "Install Fortress blocking above beam to prevent joist rollover.",
                 "CCRR-0313")
            )
        framing_notes.append(
            ("Rim joists: Fortress " + str(joist_spacing) + "OC U-Rim Joist. "
             "Secure with Fortress Rim Joist Brackets at each joist.",
             "CCRR-0313")
        )
    else:
        framing_notes = [
            (zone_prefix + ": " + joist_size + " at " + str(joist_spacing) + "\" O.C. "
             "Joists shall be crowned up and secured at both ends with Simpson '"
             + joist_hanger["model"] + "' joist hangers.",
             "IRC R507.5, Table R507.5"),
        ]
        if needs_blocking:
            framing_notes.append(
                ("Mid-span blocking required (joist span > 7 ft). Install solid "
                 + joist_size + " blocking at mid-span between all joists.",
                 "IRC R507.5")
            )
        framing_notes.append(
            ("Beam: " + beam_size + " PT. " +
             ("Beam bears on top of posts (drop beam). " if beam_type == "dropped" else
              "Beam is flush-mounted with approved connectors. ") +
             "Beam splices shall occur directly over posts only.",
             "IRC R507.6")
        )
        if beam_type == "dropped":
            framing_notes.append(
                ("Simpson '" + hurricane_tie["model"] + "' hurricane ties required at every "
                 "joist-to-beam connection for drop beam. Install solid roll blocking above "
                 "beam to prevent joist rollover.",
                 "IRC R507.5")
            )
        framing_notes.append(
            ("Rim/band joists at all open joist ends. Secure with min. (3) 16d nails or "
             "approved fasteners at each joist.",
             "IRC R507.5")
        )
    if has_zones:
        framing_notes.append(
            ("Additional zones have independent framing as shown on Sheet A-1. "
             "Zones may use dropped beams with posts and footings, or flush beams "
             "where joists bear into the main deck rim board with joist hangers. "
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
        if is_steel:
            ledger_notes = [
                ("Ledger: Fortress S-Ledger. Attach with Fortress Ledger Brackets and "
                 "3/4\" self-tapping screws. Fill all holes.",
                 "CCRR-0313"),
                ("Flashing: Self-adhering or metal flashing required over ledger, extending up "
                 "wall behind siding/cladding. Must prevent water infiltration at wall connection.",
                 "IRC R507.2.1"),
                ("Lateral load connectors: Install min. (2) Simpson '" + lateral_load["model"] + "' connectors "
                 "tying deck to house floor framing. Space within 24\" of each end of ledger.",
                 "IRC R507.2.5"),
                ("Remove siding/cladding at ledger location. Ledger shall bear directly against house "
                 "rim board or band joist. Do not attach ledger over siding.",
                 "IRC R507.2"),
            ]
        else:
            ledger_notes = [
                ("Ledger board: Pressure-treated lumber matching joist depth. Attach with 1/2\" lag "
                 "screws or approved ledger fasteners per IRC Table R507.2.2 spacing.",
                 "IRC R507.2.2"),
                ("Flashing: Self-adhering or metal flashing required over ledger board, extending up "
                 "wall behind siding/cladding. Must prevent water infiltration at wall connection.",
                 "IRC R507.2.1"),
                ("Lateral load connectors: Install min. (2) Simpson '" + lateral_load["model"] + "' connectors "
                 "tying deck to house floor framing. Space within 24\" of each end of ledger.",
                 "IRC R507.2.5"),
                ("Remove siding/cladding at ledger location. Ledger shall bear directly against house "
                 "rim board or band joist. Do not attach ledger over siding.",
                 "IRC R507.2"),
                ("Cantilever: Where deck floor extends past foundation, no ledger connection to "
                 "cantilevered portion is allowed. Extend ledger 6\" min. and install (3) lags "
                 "each side of beam connection at ledger. See Cantilever Details on A-4.",
                 "IRC R507.5"),
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
    if is_steel:
        mat_notes = [
            ("Decking: " + ("Composite per manufacturer specs. Joist spacing shall not exceed "
             "manufacturer maximum." if decking_type == "composite"
             else "Pressure-treated wood decking (5/4x6 or 2x6). ") +
             " Fasten per manufacturer requirements.",
             "IRC R507.4"),
            ("All structural connections use Fortress Evolution brackets and 3/4\" "
             "self-tapping screws. Fill all holes in every bracket. No Simpson hardware "
             "for steel-to-steel connections.",
             "CCRR-0313 Table 1"),
            ("Fasteners: Use only manufacturer-specified 3/4\" self-drilling screws "
             "(Fortress #183990341). Minimum 3 exposed threads through steel.",
             "CCRR-0313 Table 1"),
        ]
    else:
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
    if is_steel:
        _footer = ("NOTES ARE GENERAL IN NATURE. STEEL FRAMING PER INTERTEK CCRR-0313. "
                   "LOCAL JURISDICTIONS MAY HAVE ADDITIONAL REQUIREMENTS. "
                   "VERIFY ALL CODE REFERENCES WITH YOUR LOCAL BUILDING DEPARTMENT.")
    else:
        _footer = ("NOTES ARE GENERAL IN NATURE. LOCAL JURISDICTIONS MAY HAVE ADDITIONAL "
                   "REQUIREMENTS. VERIFY ALL CODE REFERENCES WITH YOUR LOCAL BUILDING DEPARTMENT.")
    ax.text(7, 0.42, _footer,
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