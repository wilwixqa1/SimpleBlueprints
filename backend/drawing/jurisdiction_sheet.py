"""
SimpleBlueprints - Jurisdiction-Specific Attachment Sheets
S50: Colorado Springs (PPRBD) Deck Attachment Sheet
Overlays auto-filled checkbox marks and address onto the official PDF.
"""

import io
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import pypdf

# Path to stored jurisdiction PDFs
JURISDICTION_DIR = Path(__file__).parent / "jurisdiction"

# Colorado Springs zip codes (El Paso County core COS range)
COS_ZIPS = set(str(z) for z in range(80901, 80952))

# Checkbox row Y positions (pdfplumber coords, top of page = 0)
# Converted to reportlab coords (bottom = 0) via: rl_y = 792 - plumber_y
CHECKBOX_ROWS = {
    "cover":       792 - 76.5,    # Solid cover or pergola
    "electrical":  792 - 100.1,   # Electrical service affected
    "hottub":      792 - 143.2,   # Hot tub or spa loading
    "cantilever":  792 - 166.8,   # Supported by cantilever
    "under18":     792 - 210.0,   # Walking surface < 18" above grade
    "over8ft":     792 - 233.5,   # Walking surface 8'0"+ above grade
    "freestanding": 792 - 257.2,  # Freestanding / detached
    "excavation":  792 - 280.8,   # Excavation > 3'-0" depth
}

# Column X centers for YES and NO checkboxes
YES_X = 27
NO_X = 67

# Address field position (reportlab coords)
ADDRESS_X = 130
ADDRESS_Y = 792 - 48.2


def is_colorado_springs(project_info):
    """Check if the project is in Colorado Springs based on city or zip."""
    if not project_info:
        return False
    city = (project_info.get("city") or "").strip().lower()
    zipcode = (project_info.get("zip") or "").strip()[:5]
    if "colorado springs" in city:
        return True
    if zipcode in COS_ZIPS:
        return True
    return False


def compute_checklist(params, calc):
    """
    Auto-fill the PPRBD checklist from deck parameters.
    Returns dict of {row_key: True/False} where True = YES, False = NO.
    Frontend can override these via params['jurisdictionChecklist'].
    """
    height_inches = params.get("height", 4) * 12  # height is in feet
    footing_depth = calc.get("footing_depth", 36)
    attachment = params.get("attachmentType", "attached")

    defaults = {
        "cover":       False,  # We don't support covers
        "electrical":  False,  # Default NO, user can override
        "hottub":      False,  # We don't support hot tub loading
        "cantilever":  False,  # We don't support cantilever
        "under18":     height_inches <= 18,
        "over8ft":     height_inches >= 96,
        "freestanding": attachment == "freestanding",
        "excavation":  footing_depth > 36,
    }

    # Allow frontend overrides
    overrides = params.get("jurisdictionChecklist") or {}
    for key in defaults:
        if key in overrides:
            defaults[key] = bool(overrides[key])

    return defaults


def build_overlay_pdf(params, calc, project_info):
    """
    Create a transparent PDF overlay with checkmarks and address text
    that will be merged onto the PPRBD sheet.
    """
    checklist = compute_checklist(params, calc)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)

    # Draw address
    addr_parts = []
    if project_info.get("address"):
        addr_parts.append(project_info["address"])
    city_state = []
    if project_info.get("city"):
        city_state.append(project_info["city"])
    if project_info.get("state"):
        city_state.append(project_info["state"])
    if city_state:
        addr_parts.append(", ".join(city_state))
    if project_info.get("zip"):
        addr_parts[-1] = addr_parts[-1] + " " + project_info["zip"] if addr_parts else project_info["zip"]

    address_text = " ".join(addr_parts) if addr_parts else ""
    if address_text:
        c.setFont("Helvetica", 10)
        c.drawString(ADDRESS_X, ADDRESS_Y - 3, address_text)

    # Draw checkmarks
    c.setFont("Helvetica-Bold", 14)
    for key, row_y in CHECKBOX_ROWS.items():
        is_yes = checklist.get(key, False)
        x = YES_X if is_yes else NO_X
        # Draw an X mark centered in the checkbox
        c.drawCentredString(x, row_y - 4, "X")

    c.save()
    buf.seek(0)
    return buf


def append_cos_attachment(output_path, params, calc, project_info):
    """
    Merge the PPRBD Deck Attachment Sheet with auto-filled overlay
    and append it to the existing blueprint PDF.
    """
    cos_pdf_path = JURISDICTION_DIR / "cos_deck_attachment.pdf"
    if not cos_pdf_path.exists():
        print("COS deck attachment PDF not found, skipping")
        return

    # Build the overlay
    overlay_buf = build_overlay_pdf(params, calc, project_info)

    # Read the original PPRBD sheet
    base_reader = pypdf.PdfReader(str(cos_pdf_path))
    overlay_reader = pypdf.PdfReader(overlay_buf)

    # Merge overlay onto the PPRBD page
    base_page = base_reader.pages[0]
    overlay_page = overlay_reader.pages[0]
    base_page.merge_page(overlay_page)

    # Read the existing blueprint PDF and append the filled sheet
    blueprint_reader = pypdf.PdfReader(str(output_path))
    writer = pypdf.PdfWriter()

    # Copy all existing pages
    for page in blueprint_reader.pages:
        writer.add_page(page)

    # Append the filled PPRBD sheet
    writer.add_page(base_page)

    # Write back
    with open(str(output_path), "wb") as f:
        writer.write(f)

    print(f"COS Deck Attachment Sheet appended to {output_path}")
