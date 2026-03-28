"""
SimpleBlueprints - Shared Title Block (Right-Side Strip)
S45: Redesigned to match architectural convention (Rutstein reference).
Vertical strip on right side of every sheet with project info, sheet title,
date, and sheet number.
"""
from datetime import date
import matplotlib.patches as patches

BRAND = {
    "dark": "#1a1f16", "green": "#3d5a2e", "cream": "#faf8f3",
    "mute": "#7a8068", "border": "#ddd8cc", "red": "#c62828",
}


def format_feet_inches(feet):
    ft = int(feet)
    inches = (feet - ft) * 12
    if inches < 0.5:
        return f"{ft}'-0\""
    else:
        return f"{ft}'-{inches:.0f}\""


def draw_title_block(fig, sheet_num, sheet_title, calc, project_info=None, total_sheets=7):
    """Draw a right-side vertical title block strip on each sheet.

    Modeled after Rutstein/All Things Architecture permit drawings.
    Sections from bottom to top:
      - Sheet number (large) + X of Y
      - Date
      - Branding (SIMPLEBLUEPRINTS)
      - Project description (owner, address)
      - Sheet title (rotated 90 degrees, large)
    """
    pi = project_info or {}
    W = calc["width"]
    D = calc["depth"]
    today = date.today().strftime("%m/%d/%Y")

    # Extract page number from sheet_num (e.g. "A-1" -> 2)
    try:
        _page = int(sheet_num.split("-")[1]) + 1
    except (IndexError, ValueError):
        _page = 0

    # === STRIP DIMENSIONS (figure coords) ===
    sx = 0.855   # strip left edge
    sw = 0.135   # strip width
    sy = 0.02    # strip bottom
    sh = 0.96    # strip height
    cx = sx + sw / 2  # center x of strip

    # === OUTER BORDER ===
    fig.patches.append(patches.FancyBboxPatch(
        (sx, sy), sw, sh,
        boxstyle="square,pad=0",
        fc="white", ec=BRAND["dark"], lw=1.5,
        transform=fig.transFigure, zorder=10
    ))

    # === SECTION DIVIDERS (horizontal lines) ===
    divider_ys = [0.14, 0.20, 0.38, 0.58, 0.88]
    for dy in divider_ys:
        fig.patches.append(patches.FancyBboxPatch(
            (sx, dy), sw, 0.001,
            boxstyle="square,pad=0",
            fc=BRAND["dark"], ec="none",
            transform=fig.transFigure, zorder=11
        ))

    # === SECTION 1 (bottom): SHEET NUMBER ===
    # "SHEET:" label
    fig.text(cx, 0.125, "SHEET:", fontsize=6, fontweight="bold",
             fontfamily="monospace", color=BRAND["mute"],
             ha="center", va="top", zorder=12)

    # Large sheet number (e.g. "A-1")
    fig.text(cx, 0.095, sheet_num, fontsize=22, fontweight="bold",
             fontfamily="monospace", color=BRAND["dark"],
             ha="center", va="center", zorder=12)

    # "X OF Y" below
    if _page > 0:
        fig.text(cx, 0.035, f"{_page} OF {total_sheets}",
                 fontsize=7, fontfamily="monospace", color=BRAND["mute"],
                 ha="center", va="center", zorder=12)

    # === SECTION 2: DATE ===
    fig.text(sx + 0.008, 0.195, "DATE:", fontsize=5.5, fontweight="bold",
             fontfamily="monospace", color=BRAND["mute"],
             va="top", zorder=12)
    fig.text(sx + 0.008, 0.17, today, fontsize=6, fontweight="bold",
             fontfamily="monospace", color=BRAND["dark"],
             va="top", zorder=12)

    # === SECTION 3: BRANDING + ARCHITECT INFO ===
    fig.text(sx + 0.008, 0.365, "DRAWINGS PROVIDED BY:",
             fontsize=4, fontfamily="monospace", color=BRAND["mute"],
             va="top", zorder=12)

    fig.text(sx + 0.008, 0.345, "SIMPLEBLUEPRINTS",
             fontsize=8, fontweight="bold", fontfamily="monospace",
             color=BRAND["green"], va="top", zorder=12)

    fig.text(sx + 0.008, 0.31, "simpleblueprints.xyz",
             fontsize=5.5, fontfamily="monospace", color=BRAND["mute"],
             va="top", zorder=12)

    # Deck specs summary
    fig.text(sx + 0.008, 0.275,
             f"{format_feet_inches(W)} x {format_feet_inches(D)}",
             fontsize=6, fontweight="bold", fontfamily="monospace",
             color=BRAND["dark"], va="top", zorder=12)

    fig.text(sx + 0.008, 0.245,
             f'{calc.get("joist_size","2x10")} @ {calc.get("joist_spacing",16)}" O.C.',
             fontsize=5, fontfamily="monospace", color=BRAND["mute"],
             va="top", zorder=12)

    fig.text(sx + 0.008, 0.225,
             f'{calc.get("beam_size","").upper()} BEAM',
             fontsize=5, fontfamily="monospace", color=BRAND["mute"],
             va="top", zorder=12)

    # === SECTION 4: PROJECT DESCRIPTION ===
    owner = pi.get("owner", "")
    address = pi.get("address", "")
    city = pi.get("city", "")
    state = pi.get("state", "")
    zip_code = pi.get("zip", "")

    fig.text(sx + 0.008, 0.565, "PROJECT DESCRIPTION:",
             fontsize=4, fontfamily="monospace", color=BRAND["mute"],
             va="top", zorder=12)

    if owner:
        fig.text(sx + 0.008, 0.54, owner.upper(),
                 fontsize=6, fontweight="bold", fontfamily="monospace",
                 color=BRAND["dark"], va="top", zorder=12)

    if address:
        fig.text(sx + 0.008, 0.51, address.upper(),
                 fontsize=5, fontfamily="monospace",
                 color=BRAND["dark"], va="top", zorder=12)

    city_line = ", ".join(filter(None, [city, state]))
    if zip_code:
        city_line += f" {zip_code}" if city_line else zip_code
    if city_line:
        fig.text(sx + 0.008, 0.485, city_line.upper(),
                 fontsize=5, fontfamily="monospace",
                 color=BRAND["dark"], va="top", zorder=12)

    # === SECTION 5: SHEET TITLE (rotated 90 degrees) ===
    fig.text(cx, 0.73, sheet_title,
             fontsize=14, fontweight="bold", fontfamily="monospace",
             color=BRAND["dark"], ha="center", va="center",
             rotation=90, zorder=12)

    # === SECTION 6 (top): REVISION / DESCRIPTION ===
    fig.text(sx + sw - 0.005, 0.965, "NO.", fontsize=4,
             fontfamily="monospace", color=BRAND["mute"],
             ha="right", va="top", rotation=90, zorder=12)
    fig.text(sx + sw - 0.018, 0.965, "DESCRIPTION", fontsize=4,
             fontfamily="monospace", color=BRAND["mute"],
             ha="right", va="top", rotation=90, zorder=12)
