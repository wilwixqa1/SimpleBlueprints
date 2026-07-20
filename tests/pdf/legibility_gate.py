#!/usr/bin/env python3
"""
legibility_gate.py -- runs the legibility checker on freshly generated permit
sets and FAILS on real readability problems. This is the piece that was missing:
legibility_check.py (S85) existed but was never wired into the routine tests, so
text collisions and unreadable labels could ship unnoticed (they did -- S93).

What it enforces, per config:
  * ZERO overlapping text pairs on ANY page ("words on top of each other").
  * On the SITE PLAN page specifically (the active work area, cleanly calibrated
    for this check): zero tiny text and zero low-contrast text (dark labels lost
    on hatching -- the S93 house-label bug).

Non-site pages: tiny / low-contrast are REPORTED but not gated. The contrast
metric is calibrated for light-background sheets like the site plan; reversed
text on dark banners (the cover sheet) needs a contrast-vs-local-background
refinement before it can gate globally. Tracked as follow-up.

Run:
    python3 tests/pdf/legibility_gate.py
"""
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, os.path.join(_REPO, "backend"))
sys.path.insert(0, _HERE)  # for legibility_check + golden_structural

from pdfminer.high_level import extract_pages  # noqa: E402

from app.main import generate_blueprint_pdf, PDF_DIR  # noqa: E402
from legibility_check import (  # noqa: E402
    _iter_text_lines, _line_info, _overlap_frac,
    OVERLAP_MIN_FRAC, IGNORE_SHORT, DEFAULT_FLOOR_PT,
    contrast_flags,
)
from golden_structural import CONFIGS  # reuse the same realistic fixtures  # noqa: E402


def _page_overlaps(layout):
    lines = [li for li in (_line_info(l) for l in _iter_text_lines(layout)) if li]
    cand = [li for li in lines if len(li["text"]) > IGNORE_SHORT]
    hits = []
    for i in range(len(cand)):
        for j in range(i + 1, len(cand)):
            f = _overlap_frac(cand[i]["bbox"], cand[j]["bbox"])
            if f >= OVERLAP_MIN_FRAC:
                # ignore CAD duplicate-draw (identical text on itself)
                if not (cand[i]["text"] == cand[j]["text"] and f > 0.95):
                    hits.append((f, cand[i]["text"], cand[j]["text"]))
    return hits


def _tiny(layout, floor):
    lines = [li for li in (_line_info(l) for l in _iter_text_lines(layout)) if li]
    # Skip <=1-char fragments (rotated-dimension ticks, decimal points, etc.);
    # they are pdfminer split artifacts, not real labels.
    return [(li["size"], li["text"]) for li in lines
            if li["size"] < floor and len(li["text"]) > IGNORE_SHORT]


def _site_page_index(path):
    """Site plan page = the one whose deck label reads 'PROPOSED DECK' (unique to
    the site plan; the cover's drawing index does not carry it)."""
    for i, layout in enumerate(extract_pages(path)):
        for line in _iter_text_lines(layout):
            info = _line_info(line)
            if info and "PROPOSED DECK" in info["text"].upper():
                return i
    return None


def check_config(name, params, floor=DEFAULT_FLOOR_PT):
    pid, _mid, _calc, _rep = generate_blueprint_pdf(dict(params))
    path = str(PDF_DIR / f"{pid}.pdf")
    pages = list(extract_pages(path))
    site_idx = _site_page_index(path)

    failures = []
    reports = []

    # 1) text overlaps -- gated on every page
    for pageno, layout in enumerate(pages, start=1):
        for f, a, b in _page_overlaps(layout):
            failures.append(f"{name} p{pageno}: text overlap {f*100:.0f}% "
                            f"'{a[:30]}' x '{b[:30]}'")

    # 2/3) tiny + low-contrast -- gated on the SITE page, reported elsewhere
    cf = contrast_flags(path)
    for pageno, layout in enumerate(pages, start=1):
        is_site = (pageno - 1) == site_idx
        for sz, txt in _tiny(layout, floor):
            msg = f"{name} p{pageno}: tiny text {sz:.1f}pt '{txt[:30]}'"
            (failures if is_site else reports).append(msg)
    for pageno, frac, txt in cf:
        is_site = (pageno - 1) == site_idx
        msg = f"{name} p{pageno}: low-contrast {frac*100:.0f}% '{txt[:30]}'"
        (failures if is_site else reports).append(msg)

    return failures, reports


def main():
    all_fail, all_report = [], []
    for name, params in CONFIGS.items():
        f, r = check_config(name, params)
        all_fail += f
        all_report += r

    if all_report:
        _tiny_n = sum(1 for m in all_report if "tiny text" in m)
        _contrast_n = sum(1 for m in all_report if "low-contrast" in m)
        print(f"legibility gate: {len(all_report)} non-gated note(s) on other "
              f"sheets ({_tiny_n} tiny, {_contrast_n} low-contrast) -- pre-existing"
              f" / out of scope; see handoff for extending gate coverage.")

    if all_fail:
        print(f"\nLEGIBILITY GATE: FAILED -- {len(all_fail)} problem(s):")
        for m in all_fail:
            print(f"    ! {m}")
        return 1

    print(f"\nLEGIBILITY GATE: passed "
          f"({len(CONFIGS)} configs; 0 overlaps anywhere; site plans clean)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
