"""
SimpleBlueprints — Sheet A-0: Cover Sheet
Professional cover page with 3D rendering and project information
"""

import io
import base64
from datetime import date
from PIL import Image

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

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


def draw_cover_sheet(fig, params, calc, project_info=None, cover_image_b64=None):
    """Draw Sheet A-0: Cover page with 3D rendering and project details."""
    pi = project_info or {}
    W = calc["width"]
    D = calc["depth"]
    H = calc["height"]
    today = date.today().strftime("%B %d, %Y")

    ax = fig.add_axes([0.0, 0.0, 1.0, 1.0])
    ax.set_xlim(0, 140)
    ax.set_ylim(0, 85)
    ax.axis('off')
    ax.set_facecolor('white')

    # Border
    ax.add_patch(patches.Rectangle((3, 3), 134, 79, fill=False,
                 ec=BRAND["dark"], lw=2))
    ax.add_patch(patches.Rectangle((3.5, 3.5), 133, 78, fill=False,
                 ec=BRAND["dark"], lw=0.5))

    # Title area (top)
    ax.add_patch(patches.Rectangle((3.5, 72), 133, 9.5, fc=BRAND["dark"], ec='none'))

    ax.text(7, 77.5, "SIMPLEBLUEPRINTS", fontsize=18, fontweight='bold',
            fontfamily='monospace', color='white')
    ax.text(7, 74.5, "RESIDENTIAL DECK CONSTRUCTION DRAWINGS",
            fontsize=8, fontfamily='monospace', color=(1,1,1,0.6))

    ax.text(133, 77.5, f"DATE: {today}", fontsize=6, fontfamily='monospace',
            color=(1,1,1,0.6), ha='right')
    ax.text(133, 75.5, f"SHEET A-0  |  COVER", fontsize=6, fontfamily='monospace',
            color=(1,1,1,0.6), ha='right')

    # 3D Rendering area
    img_y_top = 70
    img_y_bot = 30
    img_x_left = 5
    img_x_right = 135

    if cover_image_b64:
        try:
            img_data = base64.b64decode(cover_image_b64)
            img = Image.open(io.BytesIO(img_data))
            img_array = np.array(img)
            ax.imshow(img_array,
                      extent=[img_x_left, img_x_right, img_y_bot, img_y_top],
                      aspect='auto', zorder=2)
            # Border around image
            ax.add_patch(patches.Rectangle(
                (img_x_left, img_y_bot), img_x_right - img_x_left, img_y_top - img_y_bot,
                fill=False, ec=BRAND["dark"], lw=1, zorder=3))
        except Exception as e:
            # Fallback: gray placeholder
            ax.add_patch(patches.Rectangle(
                (img_x_left, img_y_bot), img_x_right - img_x_left, img_y_top - img_y_bot,
                fc='#f0ede4', ec=BRAND["dark"], lw=1))
            ax.text(70, 50, "3D PERSPECTIVE VIEW", ha='center', va='center',
                    fontsize=14, fontweight='bold', fontfamily='monospace',
                    color=BRAND["mute"])
    else:
        ax.add_patch(patches.Rectangle(
            (img_x_left, img_y_bot), img_x_right - img_x_left, img_y_top - img_y_bot,
            fc='#f0ede4', ec=BRAND["dark"], lw=1))
        ax.text(70, 50, "3D PERSPECTIVE VIEW", ha='center', va='center',
                fontsize=14, fontweight='bold', fontfamily='monospace',
                color=BRAND["mute"])

    # Project info area (below image)
    info_y = 27

    # Left: Project details
    ax.add_patch(patches.Rectangle((5, 5), 64, info_y - 5,
                 fc='#fafaf8', ec=BRAND["dark"], lw=0.5))

    ax.text(7, info_y - 2, "PROJECT INFORMATION", fontsize=8, fontweight='bold',
            fontfamily='monospace', color=BRAND["green"])

    owner = pi.get("owner", "—")
    address = pi.get("address", "—")
    city = pi.get("city", "")
    state = pi.get("state", "")
    zip_code = pi.get("zip", "")
    lot = pi.get("lot", "")
    contractor = pi.get("contractor", "") or "Owner-Builder"

    city_line = ", ".join(filter(None, [city, state]))
    if zip_code:
        city_line += f" {zip_code}" if city_line else zip_code

    details = [
        ("OWNER / APPLICANT", owner.upper() if owner != "—" else "—"),
        ("PROJECT ADDRESS", address.upper() if address != "—" else "—"),
        ("CITY / STATE / ZIP", city_line.upper() if city_line else "—"),
        ("LOT / PARCEL", lot.upper() if lot else "—"),
        ("CONTRACTOR", contractor.upper()),
        ("DATE PREPARED", today.upper()),
    ]

    dy = info_y - 5
    for label, value in details:
        ax.text(8, dy, label, fontsize=5, fontfamily='monospace', color=BRAND["mute"])
        ax.text(35, dy, value, fontsize=6, fontweight='bold', fontfamily='monospace',
                color=BRAND["dark"])
        dy -= 3

    # Right: Deck specs
    ax.add_patch(patches.Rectangle((71, 5), 64.5, info_y - 5,
                 fc='#fafaf8', ec=BRAND["dark"], lw=0.5))

    ax.text(73, info_y - 2, "DECK SPECIFICATIONS", fontsize=8, fontweight='bold',
            fontfamily='monospace', color=BRAND["green"])

    attachment = "Ledger Board" if calc.get("attachment") == "ledger" else "Freestanding"
    stair_desc = "None"
    if params.get("hasStairs") and calc.get("stairs"):
        st = calc["stairs"]
        stair_desc = f'{st.get("location","front").upper()} — {st["width"]}\' WIDE, {st["num_stringers"]} STRINGERS'

    specs = [
        ("DECK SIZE", f'{format_feet_inches(W)} × {format_feet_inches(D)}  ({calc["area"]} SF)'),
        ("HEIGHT", f'{format_feet_inches(H)} ABOVE GRADE'),
        ("ATTACHMENT", attachment.upper()),
        ("JOISTS", f'{calc["joist_size"]} @ {calc["joist_spacing"]}" O.C.'),
        ("BEAM", calc["beam_size"].upper()),
        ("POSTS", f'{calc["post_size"]}  ({calc["total_posts"]} TOTAL)'),
        ("FOOTINGS", f'{calc["footing_diam"]}" Ø × {calc["footing_depth"]}" DEEP  ({calc["num_footings"]})'),
        ("STAIRS", stair_desc),
    ]

    dy = info_y - 5
    for label, value in specs:
        ax.text(73, dy, label, fontsize=5, fontfamily='monospace', color=BRAND["mute"])
        ax.text(95, dy, value, fontsize=5.5, fontweight='bold', fontfamily='monospace',
                color=BRAND["dark"])
        dy -= 2.5

    # Sheet index at bottom right
    ax.text(133, 6.5, "DRAWING INDEX", fontsize=6, fontweight='bold',
            fontfamily='monospace', color=BRAND["mute"], ha='right')
    sheets = ["A-0  COVER SHEET", "A-1  PLAN & FRAMING", "A-2  ELEVATIONS",
              "A-3  STRUCTURAL DETAILS", "A-4  MATERIAL LIST"]
    for i, s in enumerate(sheets):
        ax.text(133, 5.5 - i * 1.8, s, fontsize=4.5, fontfamily='monospace',
                color=BRAND["dark"], ha='right')
