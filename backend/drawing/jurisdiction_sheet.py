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

# PPRBD jurisdiction: all of El Paso County + City of Woodland Park (Teller County)
# Does NOT include unincorporated Teller County (Divide, Cripple Creek, etc.)
# or the townships of Ramah and Calhan
PPRBD_ZIPS = set(str(z) for z in range(80901, 80952))  # Colorado Springs core
PPRBD_ZIPS.update([
    "80808",  # Calhan area (unincorp El Paso) - note: PPRBD excludes Calhan township
    "80809",  # Cascade
    "80817",  # Fountain
    "80819",  # Green Mountain Falls
    "80829",  # Manitou Springs
    "80831",  # Peyton / Falcon
    "80840",  # USAF Academy
    "80863",  # Woodland Park (Teller County, but in PPRBD)
    "80132",  # Monument
    "80133",  # Palmer Lake
    "80911",  # Security-Widefield
    "80913",  # Fort Carson
    "80914",  # Peterson AFB
    "80925",  # South El Paso County
    "80926",  # Fort Carson area
    "80928",  # East El Paso County
    "80929",  # Schriever area
    "80930",  # East COS
    "80938",  # East COS
    "80939",  # East COS
])

# City names that fall under PPRBD jurisdiction
PPRBD_CITIES = [
    "colorado springs", "fountain", "manitou springs", "green mountain falls",
    "monument", "palmer lake", "woodland park", "security", "widefield",
    "cascade", "peyton", "falcon", "black forest",
]

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
    """Check if the project is in PPRBD jurisdiction (El Paso County + Woodland Park)."""
    if not project_info:
        return False
    city = (project_info.get("city") or "").strip().lower()
    zipcode = (project_info.get("zip") or "").strip()[:5]
    for pprbd_city in PPRBD_CITIES:
        if pprbd_city in city:
            return True
    if zipcode in PPRBD_ZIPS:
        return True
    return False


def compute_checklist(params, calc):
    """
    Compute the PPRBD checklist from deck parameters.
    Returns dict of {row_key: True/False/None}.
    None = unanswered (user skipped), True = YES, False = NO.
    Frontend overrides via params['jurisdictionChecklist'] take priority.
    """
    height_inches = params.get("height", 4) * 12  # height is in feet
    footing_depth = calc.get("footing_depth", 36)
    attachment = params.get("attachmentType", "attached")

    # Auto-computable values get True/False; unknowable items get None
    defaults = {
        "cover":       None,   # We can't determine this
        "electrical":  None,   # We can't determine this
        "hottub":      None,   # We can't determine this
        "cantilever":  None,   # We can't determine this
        "under18":     height_inches <= 18,
        "over8ft":     height_inches >= 96,
        "freestanding": attachment == "freestanding",
        "excavation":  footing_depth > 36,
    }

    # Frontend overrides (explicit user answers)
    overrides = params.get("jurisdictionChecklist") or {}
    for key in defaults:
        if key in overrides and overrides[key] is not None:
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

    # Draw checkmarks (skip unanswered/None items - user will fill by hand)
    c.setFont("Helvetica-Bold", 14)
    for key, row_y in CHECKBOX_ROWS.items():
        val = checklist.get(key)
        if val is None:
            continue  # Leave blank for unanswered items
        x = YES_X if val else NO_X
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
