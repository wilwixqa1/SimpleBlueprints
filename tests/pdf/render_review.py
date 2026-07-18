#!/usr/bin/env python3
"""
render_review.py -- S85 PDF visual-review harness (MASTER_CONTEXT sec 11 item 1)

One command renders named param sets through the real PDF pipeline
(generate_blueprint_pdf) and rasterizes EVERY page of both output PDFs
(permit set + materials list) to 150 DPI PNGs for visual review.

Usage:
    python3 tests/pdf/render_review.py              # all param sets
    python3 tests/pdf/render_review.py straight_stair trapezoid_siteplan
    python3 tests/pdf/render_review.py --list

Output layout:
    /tmp/render_review/<set_name>/permit.pdf
    /tmp/render_review/<set_name>/materials.pdf
    /tmp/render_review/<set_name>/permit-01.png ... (150 DPI, every page)
    /tmp/render_review/<set_name>/materials-01.png ...

Standing rule (MASTER_CONTEXT 6.1 / 9): review happens by VIEWING these
PNGs, never by text extraction.

Requires poppler-utils (pdftoppm) and the backend deps installed.
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND = REPO_ROOT / "backend"
OUT_ROOT = Path("/tmp/render_review")
DPI = 150

sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)  # drawing code may use relative asset paths

from app.main import generate_blueprint_pdf, PDF_DIR  # noqa: E402


def _lot_edges_for(verts, street_idx, rear_idx, street_label):
    """Build a lotEdges list matching the shape steps.js produces
    (see steps.js parcel callback ~line 1150)."""
    edges = []
    n = len(verts)
    for i in range(n):
        j = (i + 1) % n
        dx = verts[j][0] - verts[i][0]
        dy = verts[j][1] - verts[i][1]
        length = round((dx * dx + dy * dy) ** 0.5)
        is_street = i == street_idx
        is_rear = i == rear_idx
        edges.append({
            "type": "street" if is_street else "property",
            "label": street_label if is_street else "",
            "length": length,
            "setbackType": "front" if is_street else ("rear" if is_rear else "side"),
            "neighborLabel": "",
        })
    return edges


TRAPEZOID_VERTS = [[0, 0], [90, 0], [70, 130], [15, 130]]

PARAM_SETS = {
    # 1. Baseline: rectangular ledger-attached deck, no stairs, no zones.
    "basic_rect_ledger": {
        "width": 16, "depth": 12, "height": 4,
        "attachment": "ledger", "beamType": "dropped",
        "joistSpacing": 16, "deckingType": "composite",
        "railType": "fortress", "snowLoad": "moderate", "frostZone": "cold",
        "houseWidth": 40, "houseDepth": 30,
        "hasStairs": False, "deckStairs": [],
        "projectInfo": {"name": "Render Review - Basic Rect Ledger",
                        "address": "Test Fixture", "applicant": "S85 Harness"},
    },
    # 2. Freestanding deck (no ledger): different beam/post layout on A-1/A-2.
    "freestanding": {
        "width": 14, "depth": 14, "height": 3,
        "attachment": "freestanding", "beamType": "dropped",
        "joistSpacing": 16, "deckingType": "pt_lumber",
        "railType": "wood", "snowLoad": "moderate", "frostZone": "cold",
        "houseWidth": 40, "houseDepth": 30,
        "hasStairs": False, "deckStairs": [],
        "projectInfo": {"name": "Render Review - Freestanding",
                        "address": "Test Fixture", "applicant": "S85 Harness"},
    },
    # 3. Ledger deck with one straight grade stair (modern deckStairs array).
    "straight_stair": {
        "width": 20, "depth": 12, "height": 5,
        "attachment": "ledger", "beamType": "dropped",
        "joistSpacing": 16, "deckingType": "composite",
        "railType": "fortress", "snowLoad": "moderate", "frostZone": "cold",
        "houseWidth": 40, "houseDepth": 30,
        "hasStairs": True, "stairLocation": "front", "stairWidth": 4,
        "numStringers": 3,
        "deckStairs": [{
            "id": 1, "zoneId": 0, "location": "front", "width": 4,
            "template": "straight", "offset": 0,
            "numStringers": 3, "_landsOnZoneId": None,
        }],
        "projectInfo": {"name": "Render Review - Straight Stair",
                        "address": "Test Fixture", "applicant": "S85 Harness"},
    },
    # 4. Site plan on the S84/S85 canonical trapezoid lot (the divergence case).
    "trapezoid_siteplan": {
        "width": 16, "depth": 12, "height": 4,
        "attachment": "ledger", "beamType": "dropped",
        "joistSpacing": 16, "deckingType": "composite",
        "railType": "fortress", "snowLoad": "moderate", "frostZone": "cold",
        "houseWidth": 40, "houseDepth": 30,
        "houseOffsetSide": 20, "houseDistFromStreet": 30,
        "lotWidth": 90, "lotDepth": 130,
        "lotVertices": [list(v) for v in TRAPEZOID_VERTS],
        "lotEdges": _lot_edges_for(TRAPEZOID_VERTS, street_idx=0, rear_idx=2,
                                   street_label="Test Street"),
        "setbackFront": 25, "setbackSide": 5, "setbackRear": 20,
        "streetName": "Test Street", "northAngle": 0,
        "hasStairs": False, "deckStairs": [],
        "projectInfo": {"name": "Render Review - Trapezoid Site Plan",
                        "address": "1 Test Street", "applicant": "S85 Harness"},
    },
}


def rasterize(pdf_path: Path, out_prefix: Path):
    subprocess.run(
        ["pdftoppm", "-png", "-r", str(DPI), str(pdf_path), str(out_prefix)],
        check=True,
    )


def run_set(name: str) -> list:
    params = {k: (list(v) if isinstance(v, list) else v)
              for k, v in PARAM_SETS[name].items()}
    out_dir = OUT_ROOT / name
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    result = generate_blueprint_pdf(dict(params))
    permit_id, materials_id = result[0], result[1]

    pages = []
    for label, pdf_id in (("permit", permit_id), ("materials", materials_id)):
        src = PDF_DIR / f"{pdf_id}.pdf"
        dst = out_dir / f"{label}.pdf"
        shutil.copy(src, dst)
        rasterize(dst, out_dir / label)
        pngs = sorted(out_dir.glob(f"{label}-*.png"))
        pages.extend(pngs)
        print(f"  {label}: {dst.name} -> {len(pngs)} page(s) @ {DPI} DPI")
    return pages


def main(argv):
    if "--list" in argv:
        for n in PARAM_SETS:
            print(n)
        return 0
    names = [a for a in argv if not a.startswith("-")] or list(PARAM_SETS)
    unknown = [n for n in names if n not in PARAM_SETS]
    if unknown:
        print(f"Unknown param set(s): {unknown}. Use --list.")
        return 1
    all_pages = []
    for name in names:
        print(f"[{name}]")
        all_pages.extend(run_set(name))
    print(f"\nDone. {len(all_pages)} PNG page(s) under {OUT_ROOT}/")
    for p in all_pages:
        print(f"  {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
