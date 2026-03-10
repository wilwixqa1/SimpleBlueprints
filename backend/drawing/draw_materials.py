"""
SimpleBlueprints — Sheet A-5: Material List
Professional itemized material table with cost estimate
S23: Zone-aware materials — ports calcAllZones logic from engine.js
"""

import math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

BRAND = {
    "dark": "#1a1f16", "green": "#3d5a2e", "cream": "#faf8f3",
    "mute": "#7a8068", "border": "#ddd8cc", "red": "#c62828",
    "accent": "#c4960a",
}


def estimate_materials(params, calc):
    """Generate itemized material list matching frontend logic exactly."""
    items = []
    c = calc  # shorthand

    fDiam = c["footing_diam"]
    fDepth = c["footing_depth"]
    nF = c["num_footings"]
    postSize = c["post_size"]
    totalPosts = c["total_posts"]
    beamSize = c["beam_size"]
    W = c["width"]
    D = c["depth"]
    nJ = c["num_joists"]
    joistSize = c["joist_size"]
    railLen = c["rail_length"]
    attachment = c["attachment"]
    ledgerSize = c["ledger_size"]

    # Foundation
    bags = math.ceil((math.pi * (fDiam / 24) ** 2 * (fDepth / 12)) / 0.6) * nF
    items.append({"cat": "Foundation", "item": "Concrete 80lb bags", "qty": bags, "cost": 6.50})
    items.append({"cat": "Foundation", "item": f'Sonotube {fDiam}"', "qty": nF, "cost": 28 if fDiam > 18 else 18})
    items.append({"cat": "Foundation", "item": "Post Base Hardware", "qty": nF, "cost": 42 if postSize == "6x6" else 28})

    # Posts
    items.append({"cat": "Posts", "item": f"{postSize} PT Posts", "qty": totalPosts, "cost": 48 if postSize == "6x6" else 24})
    items.append({"cat": "Posts", "item": "Post Cap Hardware", "qty": totalPosts, "cost": 38 if postSize == "6x6" else 22})

    # Beam
    plies = int(beamSize[0])
    is_lvl = "LVL" in beamSize
    items.append({"cat": "Beam", "item": "LVL 20'" if is_lvl else "PT Beam 20'",
                  "qty": math.ceil(W / 20) * plies, "cost": 95 if is_lvl else 55})

    # Ledger
    if attachment == "ledger":
        items.append({"cat": "Ledger", "item": f"{ledgerSize} PT Ledger", "qty": math.ceil(W / 12), "cost": 32})
        items.append({"cat": "Ledger", "item": "LedgerLok Screws (box)", "qty": math.ceil(W / (16 / 12) * 2 / 50), "cost": 85})
        items.append({"cat": "Ledger", "item": "Flashing", "qty": 1, "cost": 55})

    # Framing
    jL = math.ceil(D)
    jCost = 22 if jL <= 10 else (32 if jL <= 12 else 42)
    # Lateral load connectors for ledger decks
    if calc.get("attachment") == "ledger":
        items.append({
            "cat": "LEDGER",
            "item": "Lateral Load Connectors (DTT2Z)",
            "qty": 2,
            "cost": 32.00,
        })

    items.append({"cat": "Framing", "item": f"{joistSize} Joists {jL}'", "qty": nJ + 4, "cost": jCost})
    items.append({"cat": "Framing", "item": "Rim Joists", "qty": math.ceil(W / 12) + 2, "cost": 32})

    # Mid-span blocking (when joist span > 7ft)
    if calc.get("mid_span_blocking", False):
        blocking_count = calc.get("blocking_count", 0)
        if blocking_count > 0:
            items.append({
                "cat": "FRAMING",
                "item": f'{calc["joist_size"]} Blocking (mid-span)',
                "qty": blocking_count,
                "cost": 8.00,
            })

    # Hardware
    items.append({"cat": "Hardware", "item": "Joist Hangers", "qty": nJ * 2, "cost": 6})
    # Flush beam: add beam-to-joist hangers (one per joist end at beam)
    if c.get("beam_type", "dropped") == "flush":
        items.append({"cat": "Hardware", "item": "Beam Joist Hangers (LUS)", "qty": nJ, "cost": 4})
    items.append({"cat": "Hardware", "item": "Hurricane Ties + Nails", "qty": 1, "cost": round(nJ * 2.75 + 50, 2)})

    # Decking
    bds = math.ceil(W / (5.5 / 12)) * 1.1
    if params.get("deckingType") == "composite":
        items.append({"cat": "Decking", "item": f'Composite {math.ceil(D + 2)}\'', "qty": math.ceil(bds), "cost": 28 if D <= 10 else 38})
        items.append({"cat": "Decking", "item": "Hidden Fasteners", "qty": 1, "cost": 175})
    else:
        items.append({"cat": "Decking", "item": f'5/4x6 PT {math.ceil(D + 2)}\'', "qty": math.ceil(bds), "cost": 12 if D <= 10 else 18})
        items.append({"cat": "Decking", "item": "Deck Screws 5lb", "qty": math.ceil(W * D / 50), "cost": 32})

    # Railing
    rP = math.ceil(railLen / 6) + 1
    if params.get("railType") == "fortress":
        items.append({"cat": "Railing", "item": "Fortress Panels", "qty": math.ceil(railLen / 7), "cost": 80})
        items.append({"cat": "Railing", "item": "Fortress Posts", "qty": rP, "cost": 45})
        items.append({"cat": "Railing", "item": "Top Rail + Brackets", "qty": math.ceil(railLen / 7), "cost": 52})
    else:
        items.append({"cat": "Railing", "item": "Wood Rail Kit (8')", "qty": math.ceil(railLen / 8), "cost": 85})

    # Stairs
    if calc.get("stairs"):
        st = calc["stairs"]
        items.append({"cat": "Stairs", "item": f'2\u00d712 Stringers {st["stringer_length_ft"]}\'', "qty": st["num_stringers"], "cost": 38})
        items.append({"cat": "Stairs", "item": "Stair Treads 2\u00d712", "qty": st["num_treads"], "cost": 18})
        items.append({"cat": "Stairs", "item": "Stair Stringer Brackets", "qty": st["num_stringers"], "cost": 8})
        if st.get("has_landing"):
            items.append({"cat": "Stairs", "item": "Landing Pad Concrete", "qty": 2, "cost": 6.50})

    # Misc
    items.append({"cat": "Misc", "item": "Joist Tape + Misc", "qty": 1, "cost": 120})

    sub = sum(i["qty"] * i["cost"] for i in items)
    return {"items": items, "subtotal": round(sub, 2), "tax": round(sub * 0.08, 2),
            "contingency": round(sub * 0.05, 2), "total": round(sub * 1.13, 2)}


def estimate_zone_materials(params, calc):
    """
    Compute extra materials for add zones (Python port of calcAllZones from engine.js).
    Returns None if no zones, otherwise dict with extraItems, extraPosts, etc.
    """
    zones = params.get("zones", [])
    if not zones:
        return None

    W = params.get("width", 20)
    D = params.get("depth", 12)
    BS = 1.5  # beam setback, matches zone 0 and draw_plan.py

    add_area = 0
    cut_area = 0
    extra_posts = 0
    extra_footings = 0
    extra_items = []

    # Pull base calc values for consistency
    sp = calc.get("joist_spacing", 16)
    fDiam = calc.get("footing_diam", 30)
    fDepth = calc.get("footing_depth", 36)
    post_size = calc.get("post_size", "6x6")
    beam_size = calc.get("beam_size", "3-ply 2x10")
    joist_size = calc.get("joist_size", "2x12")

    for z in zones:
        edge = z.get("attachEdge", "front")
        zw = z.get("w", 8)
        zd = z.get("d", 6)

        # Cutouts subtract area only
        if z.get("type") == "cutout":
            cut_area += zw * zd
            continue

        add_area += zw * zd

        # Compute framing geometry by edge (matches engine.js + draw_plan.py)
        if edge in ("right", "left"):
            beam_len = zd
            j_span = zw - BS
            n_joists = math.ceil(zd / (sp / 12)) + 1
            n_posts = max(2, math.ceil(zd / 8) + 1)
        else:
            # front (and any future "back")
            beam_len = zw
            j_span = zd - BS
            n_joists = math.ceil(zw / (sp / 12)) + 1
            n_posts = max(2, math.ceil(zw / 8) + 1)

        extra_posts += n_posts
        extra_footings += n_posts

        label = z.get("label", f'Zone {z.get("id", "?")}')
        jL = math.ceil(j_span)

        # Foundation
        bags = math.ceil((math.pi * (fDiam / 24) ** 2 * (fDepth / 12)) / 0.6) * n_posts
        extra_items.append({"cat": "Foundation", "item": f"Concrete bags ({label})", "qty": bags, "cost": 6.50})
        extra_items.append({"cat": "Foundation", "item": f"Sonotube ({label})", "qty": n_posts, "cost": 28 if fDiam > 18 else 18})
        extra_items.append({"cat": "Foundation", "item": f"Post Base ({label})", "qty": n_posts, "cost": 42 if post_size == "6x6" else 28})

        # Posts
        extra_items.append({"cat": "Posts", "item": f"{post_size} Posts ({label})", "qty": n_posts, "cost": 48 if post_size == "6x6" else 24})
        extra_items.append({"cat": "Posts", "item": f"Post Caps ({label})", "qty": n_posts, "cost": 38 if post_size == "6x6" else 22})

        # Beam
        plies = int(beam_size[0])
        is_lvl = "LVL" in beam_size
        extra_items.append({"cat": "Beam", "item": f'{"LVL" if is_lvl else "PT Beam"} ({label})',
                            "qty": math.ceil(beam_len / 20) * plies, "cost": 95 if is_lvl else 55})

        # Joists + rim
        j_cost = 22 if jL <= 10 else (32 if jL <= 12 else 42)
        extra_items.append({"cat": "Framing", "item": f"{joist_size} Joists {jL}' ({label})", "qty": n_joists + 2, "cost": j_cost})
        extra_items.append({"cat": "Framing", "item": f"Rim Joists ({label})", "qty": 3, "cost": 32})

        # Decking
        board_dim = max(zw, zd)
        board_len = math.ceil(min(zw, zd) + 2)
        bds = math.ceil(board_dim / (5.5 / 12)) * 1.1
        if params.get("deckingType") == "composite":
            extra_items.append({"cat": "Decking", "item": f"Composite {board_len}' ({label})",
                                "qty": math.ceil(bds), "cost": 28 if board_len <= 10 else 38})
        else:
            extra_items.append({"cat": "Decking", "item": f"5/4x6 PT {board_len}' ({label})",
                                "qty": math.ceil(bds), "cost": 12 if board_len <= 10 else 18})

        # Hardware
        extra_items.append({"cat": "Hardware", "item": f"Joist Hangers ({label})", "qty": n_joists * 2, "cost": 6})

    extra_sub = sum(i["qty"] * i["cost"] for i in extra_items)
    base_area = calc.get("area", W * D)
    total_area = round(base_area + add_area - cut_area)

    return {
        "totalArea": total_area,
        "extraPosts": extra_posts,
        "extraFootings": extra_footings,
        "extraItems": extra_items,
        "extraSub": round(extra_sub, 2),
        "extraTotal": round(extra_sub * 1.13, 2),
    }


def format_feet_inches(feet):
    ft = int(feet)
    inches = (feet - ft) * 12
    if inches < 0.5:
        return f"{ft}'-0\""
    else:
        return f"{ft}'-{inches:.0f}\""


def draw_materials_sheet(fig, params, calc):
    """Draw Sheet A-5: Material list table with cost breakdown (zone-aware)."""
    mat = estimate_materials(params, calc)
    zc = estimate_zone_materials(params, calc)

    # Combine items and totals
    if zc:
        all_items = mat["items"] + zc["extraItems"]
        combined_sub = mat["subtotal"] + zc["extraSub"]
        display_area = zc["totalArea"]
    else:
        all_items = mat["items"]
        combined_sub = mat["subtotal"]
        display_area = calc["area"]

    combined_tax = round(combined_sub * 0.08, 2)
    combined_cont = round(combined_sub * 0.05, 2)
    combined_total = round(combined_sub * 1.13, 2)

    items = all_items
    W = calc["width"]
    D = calc["depth"]

    ax = fig.add_axes([0.06, 0.06, 0.88, 0.88])
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 70)
    ax.axis('off')
    ax.set_facecolor('white')

    # Title — uses total area (zone-aware)
    ax.text(50, 67, 'MATERIAL LIST & COST ESTIMATE', ha='center', fontsize=14,
            fontweight='bold', fontfamily='monospace', color=BRAND["dark"])
    ax.text(50, 65.2, f'{format_feet_inches(W)} \u00d7 {format_feet_inches(D)} DECK  \u00b7  {display_area} SF',
            ha='center', fontsize=8, fontfamily='monospace', color=BRAND["mute"])

    # Table header
    hY = 63
    ax.add_patch(patches.Rectangle((3, hY - 0.8), 94, 2, fc=BRAND["dark"], ec='none'))
    cols = [("CATEGORY", 5), ("ITEM", 22), ("QTY", 60), ("UNIT $", 70), ("TOTAL", 82)]
    for label, x in cols:
        ax.text(x, hY, label, fontsize=6, fontweight='bold', fontfamily='monospace', color='white', va='center')

    # Determine row height — shrink if many items to fit on page
    total_rows = len(items)
    available_height = 63 - 8  # from hY down to summary area
    row_h = min(2.2, available_height / max(total_rows + 1, 1))
    row_h = max(row_h, 1.2)  # minimum readable height
    font_size = 5.5 if row_h >= 1.8 else 4.5

    # Table rows
    y = hY - 2.5
    last_cat = ""
    for i, item in enumerate(items):
        if y < 8:
            break

        bg = '#fafaf8' if i % 2 == 0 else 'white'
        ax.add_patch(patches.Rectangle((3, y - row_h / 2 - 0.3), 94, row_h, fc=bg, ec='none'))

        # Category (only show when it changes)
        if item["cat"] != last_cat:
            ax.text(5, y, item["cat"].upper(), fontsize=font_size, fontweight='bold',
                    fontfamily='monospace', color=BRAND["green"], va='center')
            last_cat = item["cat"]

        ax.text(22, y, item["item"], fontsize=font_size, fontfamily='monospace', color=BRAND["dark"], va='center')
        ax.text(65, y, str(item["qty"]), fontsize=font_size, fontfamily='monospace', color=BRAND["dark"], va='center', ha='center')
        ax.text(75, y, f'${item["cost"]:.2f}', fontsize=font_size, fontfamily='monospace', color=BRAND["mute"], va='center', ha='center')
        line_total = item["qty"] * item["cost"]
        ax.text(90, y, f'${line_total:,.2f}', fontsize=font_size, fontweight='bold', fontfamily='monospace',
                color=BRAND["dark"], va='center', ha='right')

        # Separator line
        ax.plot([3, 97], [y - row_h / 2 - 0.3, y - row_h / 2 - 0.3], color='#eee', lw=0.3)
        y -= row_h

    # Bottom summary box — uses combined totals
    bY = max(y - 1, 3)
    ax.plot([3, 97], [bY + 1.5, bY + 1.5], color=BRAND["dark"], lw=1)

    summary_items = [
        ("SUBTOTAL", combined_sub),
        ("SALES TAX (8%)", combined_tax),
        ("CONTINGENCY (5%)", combined_cont),
    ]
    for j, (label, val) in enumerate(summary_items):
        sy = bY - j * 1.8
        ax.text(65, sy, label, fontsize=5.5, fontfamily='monospace', color=BRAND["mute"], va='center', ha='right')
        ax.text(90, sy, f'${val:,.2f}', fontsize=5.5, fontfamily='monospace', color=BRAND["dark"], va='center', ha='right')

    # Total
    tY = bY - len(summary_items) * 1.8
    ax.add_patch(patches.Rectangle((55, tY - 0.8), 42, 2.5, fc=BRAND["green"], ec='none', alpha=0.1))
    ax.text(65, tY + 0.3, 'ESTIMATED TOTAL', fontsize=7, fontweight='bold',
            fontfamily='monospace', color=BRAND["green"], va='center', ha='right')
    ax.text(90, tY + 0.3, f'${combined_total:,.2f}', fontsize=10, fontweight='bold',
            fontfamily='monospace', color=BRAND["green"], va='center', ha='right')

    # Disclaimer
    ax.text(50, tY - 2.5, 'Prices are estimates based on average home center pricing. Actual costs may vary by region and supplier.',
            ha='center', fontsize=4.5, fontstyle='italic', fontfamily='monospace', color=BRAND["mute"])
    ax.text(50, tY - 3.5, 'Tax rate assumed at 8%. Contingency of 5% included for waste and misc. hardware.',
            ha='center', fontsize=4.5, fontstyle='italic', fontfamily='monospace', color=BRAND["mute"])
