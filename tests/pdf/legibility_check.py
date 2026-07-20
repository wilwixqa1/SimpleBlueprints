#!/usr/bin/env python3
"""
legibility_check.py -- S85 L3 consistency oracle: text legibility metrics.

Works on ANY PDF (ours or reference blueprints). Per page reports:
  - text line count and font-size distribution (min / p10 / median, in points)
  - overlapping text-line pairs (bbox intersection), the "words on top of
    each other" detector from MASTER_CONTEXT section 7 L3
  - tiny-text count (lines below a legibility floor)

Usage:
    python3 tests/pdf/legibility_check.py file1.pdf [file2.pdf ...]
    python3 tests/pdf/legibility_check.py --floor 4.0 file.pdf

Deterministic; no vision required. Complements (does not replace) visual
review of rasterized pages.
"""
import sys
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextLine, LTTextContainer, LTChar

DEFAULT_FLOOR_PT = 4.0     # below this, flag as tiny
OVERLAP_MIN_FRAC = 0.30    # >=30% of smaller bbox; below that is line-spacing/touching, not collision (S85 calibration: artifacts cluster 22-24%, real hits 38%+)
IGNORE_SHORT = 1           # ignore fragments of <= N chars for overlap pairs


def _iter_text_lines(layout):
    for el in layout:
        if isinstance(el, LTTextContainer):
            for line in el:
                if isinstance(line, LTTextLine):
                    yield line


def _line_info(line):
    text = line.get_text().strip()
    sizes = [c.size for c in line if isinstance(c, LTChar)]
    if not sizes or not text:
        return None
    return {
        "text": text,
        "bbox": line.bbox,  # (x0, y0, x1, y1) in points
        "size": sum(sizes) / len(sizes),
    }


def _overlap_frac(a, b):
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix = max(0.0, min(ax1, bx1) - max(ax0, bx0))
    iy = max(0.0, min(ay1, by1) - max(ay0, by0))
    inter = ix * iy
    if inter <= 0:
        return 0.0
    area_a = max((ax1 - ax0) * (ay1 - ay0), 1e-6)
    area_b = max((bx1 - bx0) * (by1 - by0), 1e-6)
    return inter / min(area_a, area_b)


def check_pdf(path, floor_pt=DEFAULT_FLOOR_PT):
    print(f"\n=== {path} ===")
    # Width-normalized sizes (pct of sheet width) allow fair comparison
    # across page sizes (e.g. ARCH D references vs our 14x8.5in sheets).
    grand_overlaps = 0
    grand_tiny = 0
    for pageno, layout in enumerate(extract_pages(path), start=1):
        page_w = layout.bbox[2] - layout.bbox[0]
        lines = [li for li in (_line_info(l) for l in _iter_text_lines(layout)) if li]
        sizes = sorted(li["size"] for li in lines)
        overlaps = []
        dupes = 0
        cand = [li for li in lines if len(li["text"]) > IGNORE_SHORT]
        for i in range(len(cand)):
            for j in range(i + 1, len(cand)):
                f = _overlap_frac(cand[i]["bbox"], cand[j]["bbox"])
                if f >= OVERLAP_MIN_FRAC:
                    # CAD duplicate-draw artifact: identical text painted on
                    # itself. Invisible in print; count separately.
                    if cand[i]["text"] == cand[j]["text"] and f > 0.95:
                        dupes += 1
                    else:
                        overlaps.append((f, cand[i], cand[j]))
        tiny = [li for li in lines if li["size"] < floor_pt]
        grand_overlaps += len(overlaps)
        grand_tiny += len(tiny)

        if sizes:
            p10 = sizes[max(0, int(len(sizes) * 0.10) - 1)]
            med = sizes[len(sizes) // 2]
            print(f"  p{pageno}: {len(lines):4d} lines | pt min={sizes[0]:.1f} "
                  f"p10={p10:.1f} med={med:.1f} | %width med={med/page_w*100:.3f} "
                  f"| overlaps={len(overlaps):3d} | tiny={len(tiny)} | dupes={dupes}")
        else:
            print(f"  p{pageno}: no extractable text")
        for f, a, b in sorted(overlaps, reverse=True, key=lambda t: t[0])[:5]:
            print(f"       OVERLAP {f*100:3.0f}%: '{a['text'][:38]}' x '{b['text'][:38]}'")
    print(f"  TOTAL: overlapping text pairs={grand_overlaps}  tiny lines={grand_tiny}")
    return grand_overlaps, grand_tiny


CONTRAST_DARK_FRAC = 0.45  # >this fraction of dark pixels inside a text line's
#   box means the text sits on a busy/dark background (e.g. hatching) and reads
#   poorly. Calibrated (S93): normal text tops out ~0.31; text on the house hatch
#   measured ~0.58. This is the text-on-hatching detector the pdfminer text-vs-
#   text pass structurally cannot see.


def contrast_flags(path, dpi=100, dark_frac=CONTRAST_DARK_FRAC):
    """Rasterize each page and flag text lines whose bounding box is mostly dark
    pixels -- i.e. low-contrast text sitting on hatching / a dark fill. Returns
    a list of (page_no, dark_fraction, text). Needs pdftoppm + Pillow + numpy.
    """
    import os
    import subprocess
    import tempfile
    import numpy as np
    from PIL import Image

    flags = []
    pages = list(extract_pages(path))
    for pageno, layout in enumerate(pages, start=1):
        with tempfile.TemporaryDirectory() as d:
            subprocess.run(
                ["pdftoppm", "-r", str(dpi), "-png",
                 "-f", str(pageno), "-l", str(pageno), "-singlefile",
                 path, os.path.join(d, "p")],
                check=True, capture_output=True)
            img = np.asarray(Image.open(os.path.join(d, "p.png")).convert("L"))
        H, W = img.shape
        sc = dpi / 72.0
        for line in _iter_text_lines(layout):
            info = _line_info(line)
            if not info or len(info["text"]) <= IGNORE_SHORT:
                continue
            x0, y0, x1, y1 = info["bbox"]
            px0, px1 = int(x0 * sc), int(x1 * sc)
            py0, py1 = int(H - y1 * sc), int(H - y0 * sc)   # PDF y is bottom-up
            box = img[max(0, py0):py1, max(0, px0):px1]
            if box.size < 10:
                continue
            frac = float((box < 128).mean())
            if frac > dark_frac:
                flags.append((pageno, frac, info["text"]))
    return flags


if __name__ == "__main__":
    args = sys.argv[1:]
    floor = DEFAULT_FLOOR_PT
    if args and args[0] == "--floor":
        floor = float(args[1]); args = args[2:]
    if not args:
        print(__doc__); sys.exit(1)
    for f in args:
        check_pdf(f, floor)
        cf = contrast_flags(f)
        if cf:
            print(f"  LOW-CONTRAST text (on hatch/dark bg): {len(cf)}")
            for pageno, frac, text in cf[:5]:
                print(f"       p{pageno} {frac*100:.0f}% dark: '{text[:38]}'")
        else:
            print("  LOW-CONTRAST text: none")
