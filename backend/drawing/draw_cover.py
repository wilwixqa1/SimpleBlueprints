"""
SimpleBlueprints  -  Sheet A-0: Cover Sheet
Professional cover page with 3D rendering and project information
"""

import io
import json
import base64
from datetime import date
from PIL import Image
import math
from .zone_utils import get_additive_rects, get_cutout_rects

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
    if isinstance(pi, str):
        try:
            pi = json.loads(pi)
        except (json.JSONDecodeError, TypeError):
            pi = {}
    pi = pi or {}

    W = calc["width"]
    D = calc["depth"]
    H = calc["height"]
    today = date.today().strftime("%B %d, %Y")

    ax = fig.add_axes([0.0, 0.0, 1.0, 1.0])
    ax.set_xlim(0, 140)
    ax.set_ylim(0, 85)
    ax.axis('off')
    ax.set_facecolor('white')

    ax.add_patch(patches.Rectangle((3, 3), 134, 79, fill=False,
                 ec=BRAND["dark"], lw=2))
    ax.add_patch(patches.Rectangle((3.5, 3.5), 133, 78, fill=False,
                 ec=BRAND["dark"], lw=0.5))

    ax.add_patch(patches.Rectangle((3.5, 72), 133, 9.5, fc=BRAND["dark"], ec='none'))

    ax.text(7, 77.5, "SIMPLEBLUEPRINTS", fontsize=18, fontweight='bold',
            fontfamily='monospace', color='white')
    ax.text(7, 74.5, "RESIDENTIAL DECK CONSTRUCTION DRAWINGS",
            fontsize=8, fontfamily='monospace', color=(1,1,1,0.6))

    ax.text(133, 77.5, f"DATE: {today}", fontsize=6, fontfamily='monospace',
            color=(1,1,1,0.6), ha='right')
    ax.text(133, 75.5, f"SHEET A-0  |  COVER", fontsize=6, fontfamily='monospace',
            color=(1,1,1,0.6), ha='right')

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
            ax.add_patch(patches.Rectangle(
                (img_x_left, img_y_bot), img_x_right - img_x_left, img_y_top - img_y_bot,
                fill=False, ec=BRAND["dark"], lw=1, zorder=3))
        except Exception as e:
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

    info_y = 27
    box_h = info_y - 5
    row_h = 1.8
    label_fs = 5
    val_fs = 5.5

    ax.add_patch(patches.Rectangle((5, 5), 64, box_h,
                 fc='white', ec=BRAND["dark"], lw=0.8))

    ax.add_patch(patches.Rectangle((5, info_y - 3.5), 64, 3.5,
                 fc=BRAND["green"], ec='none'))
    ax.text(7, info_y - 2.2, "PROJECT INFORMATION", fontsize=7, fontweight='bold',
            fontfamily='monospace', color='white')

    owner = pi.get("owner", "-")
    address = pi.get("address", "-")
    city = pi.get("city", "")
    state = pi.get("state", "")
    zip_code = pi.get("zip", "")
    lot = pi.get("lot", "")
    contractor = pi.get("contractor", "") or "Owner-Builder"

    city_line = ", ".join(filter(None, [city, state]))
    if zip_code:
        city_line += f" {zip_code}" if city_line else zip_code

    details = [
        ("OWNER", owner.upper() if owner != "-" else "-"),
        ("ADDRESS", address.upper() if address != "-" else "-"),
        ("CITY / STATE / ZIP", city_line.upper() if city_line else "-"),
        ("LOT / PARCEL", lot.upper() if lot else "-"),
        ("CONTRACTOR", contractor.upper()),
        ("DATE", today.upper()),
    ]

    dy = info_y - 5.5
    for i, (label, value) in enumerate(details):
        if i % 2 == 0:
            ax.add_patch(patches.Rectangle((5.2, dy - 0.5), 63.6, row_h,
                         fc='#f5f4f0', ec='none'))
        ax.text(7, dy, label, fontsize=label_fs, fontfamily='monospace', color=BRAND["mute"],
                fontweight='bold')
        ax.text(28, dy, value, fontsize=val_fs, fontweight='bold', fontfamily='monospace',
                color=BRAND["dark"])
        dy -= row_h

    ax.add_patch(patches.Rectangle((71, 5), 44, box_h,
                 fc='white', ec=BRAND["dark"], lw=0.8))

    ax.add_patch(patches.Rectangle((71, info_y - 3.5), 44, 3.5,
                 fc=BRAND["green"], ec='none'))
    ax.text(73, info_y - 2.2, "DECK SPECIFICATIONS", fontsize=7, fontweight='bold',
            fontfamily='monospace', color='white')

    attachment = "Ledger Board" if calc.get("attachment") == "ledger" else "Freestanding"
    stair_desc = "None"
    if params.get("hasStairs") and calc.get("stairs"):
        st = calc["stairs"]
        stair_desc = f'{st.get("location","front").upper()} - {st["width"]}\' WIDE, {st["num_stringers"]} STRINGERS'

    # S22: Compute zone-aware totals
    zones = params.get('zones', [])
    add_rects = get_additive_rects(params)
    cut_rects = get_cutout_rects(params)
    total_area = round(sum(r['rect']['w'] * r['rect']['d'] for r in add_rects) - sum(r['rect']['w'] * r['rect']['d'] for r in cut_rects))
    extra_posts = 0
    for z in zones:
        if z.get('type') == 'cutout': continue
        edge = z.get('attachEdge', 'front')
        dim = z.get('d', 6) if edge in ('right', 'left') else z.get('w', 8)
        extra_posts += max(2, math.ceil(dim / 8) + 1)
    total_posts = calc['total_posts'] + extra_posts
    total_footings = calc['num_footings'] + extra_posts

    specs = [
        ("DECK SIZE", f'{format_feet_inches(W)} \u00d7 {format_feet_inches(D)}  ({total_area} SF)'),
        ("HEIGHT", f'{format_feet_inches(H)} ABOVE GRADE'),
        ("ATTACHMENT", attachment.upper()),
        ("JOISTS", f'{calc["joist_size"]} @ {calc["joist_spacing"]}" O.C.'),
        ("BEAM", calc["beam_size"].upper()),
        ("POSTS", f'{calc["post_size"]}  ({total_posts} TOTAL)'),
        ("FOOTINGS", f'{calc["footing_diam"]}" \u00d8 \u00d7 {calc["footing_depth"]}" DEEP  ({total_footings})'),
        ("STAIRS", stair_desc),
    ]

    dy = info_y - 5.5
    for i, (label, value) in enumerate(specs):
        if i % 2 == 0:
            ax.add_patch(patches.Rectangle((71.2, dy - 0.5), 43.6, row_h,
                         fc='#f5f4f0', ec='none'))
        ax.text(73, dy, label, fontsize=label_fs, fontfamily='monospace', color=BRAND["mute"],
                fontweight='bold')
        ax.text(93, dy, value, fontsize=val_fs, fontweight='bold', fontfamily='monospace',
                color=BRAND["dark"])
        dy -= row_h

    idx_x = 117
    idx_w = 18.5
    ax.add_patch(patches.Rectangle((idx_x, 5), idx_w, box_h,
                 fc='white', ec=BRAND["dark"], lw=0.8))

    ax.add_patch(patches.Rectangle((idx_x, info_y - 3.5), idx_w, 3.5,
                 fc=BRAND["green"], ec='none'))
    ax.text(idx_x + idx_w / 2, info_y - 2.2, "DRAWING INDEX", fontsize=6, fontweight='bold',
            fontfamily='monospace', color='white', ha='center')

    sheets = [
        ("A-0", "COVER"),
        ("A-1", "PLAN & FRAMING"),
        ("A-2", "ELEVATIONS"),
        ("A-3", "GENERAL NOTES"),
        ("A-4", "DETAILS"),
        ("A-5", "MATERIALS"),
        ("A-6", "SITE PLAN"),
    ]
    dy = info_y - 5.5
    for i, (num, title) in enumerate(sheets):
        if i % 2 == 0:
            ax.add_patch(patches.Rectangle((idx_x + 0.2, dy - 0.5), idx_w - 0.4, row_h,
                         fc='#f5f4f0', ec='none'))
        ax.text(idx_x + 1.5, dy, num, fontsize=label_fs, fontweight='bold',
                fontfamily='monospace', color=BRAND["green"])
        ax.text(idx_x + 5, dy, title, fontsize=label_fs, fontfamily='monospace',
                color=BRAND["dark"])
        dy -= row_h
