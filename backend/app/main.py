"""
# SimpleBlueprints   FastAPI Backend
Handles: PDF generation, Google OAuth, Stripe checkout, webhook, file serving
"""

import os
import uuid
import json
import time
import hashlib
import base64
import io
import zipfile
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import stripe

# PDF generation
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages

from drawing.calc_engine import calculate_structure
from drawing.permit_spec import build_permit_spec
from drawing.permit_checker import run_checks, report_to_dict, get_compliance_summary
from drawing.draw_plan import draw_plan_and_framing, format_feet_inches
from drawing.draw_elevations import draw_elevations_sheet
from drawing.draw_details import draw_details_sheet
from drawing.draw_materials import draw_materials_sheet
from drawing.title_block import draw_title_block
from drawing.draw_cover import draw_cover_sheet
from drawing.draw_notes import draw_notes_sheet
from drawing.draw_site_plan import draw_site_plan
from drawing.jurisdiction_sheet import is_colorado_springs, append_cos_attachment

from app.database import (
    init_tables, upsert_user, get_user_by_id, update_email_opt_in,
    get_all_users, log_generation as db_log_generation, log_page_view as db_log_page_view,
    get_stats, log_event, log_events_batch, log_ai_message,
    link_anonymous_to_user, get_tracking_stats,
    should_generate_insight, get_conversations_for_insight,
    get_event_summary_for_insight, save_insight,
    create_project, list_projects, get_project, update_project, delete_project,
    get_project_locations
)
from app.auth import (
    get_login_url, exchange_code, sign_session,
    get_current_user_id, COOKIE_NAME, COOKIE_MAX_AGE
)

# ============================================================
# CONFIG
# ============================================================
STRIPE_SECRET = os.getenv("STRIPE_SECRET_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
SITE_URL = os.getenv("SITE_URL", "http://localhost:8000")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
BLUEPRINT_PRICE = 2900

PDF_DIR = Path("/tmp/blueprints")
PDF_DIR.mkdir(exist_ok=True)
stripe.api_key = STRIPE_SECRET

# ============================================================
# APP
# ============================================================
app = FastAPI(title="SimpleBlueprints API", version="1.0.0")

@app.on_event("startup")
async def startup():
    init_tables()

@app.middleware("http")
async def https_redirect(request: Request, call_next):
    if request.headers.get("x-forwarded-proto") == "http":
        url = request.url.replace(scheme="https")
        return RedirectResponse(url=str(url), status_code=301)
    return await call_next(request)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def cache_control(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/static/js/"):
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
    elif path.startswith("/api/download/"):
        response.headers["Cache-Control"] = "no-store"
    return response

# ============================================================
# MODELS
# ============================================================
class DeckParams(BaseModel):
    width: float = 20; depth: float = 12; height: float = 4
    houseWidth: float = 40; houseDepth: float = 30
    attachment: str = "ledger"; hasStairs: bool = False
    stairLocation: str = "front"; stairWidth: float = 4
    numStringers: int = 3; hasLanding: bool = False
    joistSpacing: int = 16; deckingType: str = "composite"
    railType: str = "fortress"; snowLoad: str = "moderate"
    frostZone: str = "cold"; species: str = "dfl_hf_spf"
    deckOffset: float = 0; stairOffset: float = 0
    lotWidth: float = 80; lotDepth: float = 120
    lotVertices: Optional[list] = None
    lotEdges: Optional[list] = None
    lotArea: Optional[float] = None
    setbackFront: float = 25; setbackSide: float = 5
    setbackRear: float = 20; houseOffsetSide: float = 20
    overJoist: Optional[str] = None; overBeam: Optional[str] = None
    overPostSize: Optional[str] = None; overPostCount: Optional[int] = None
    overFooting: Optional[int] = None; overGuardHeight: Optional[int] = None
    houseDistFromStreet: Optional[float] = None
    streetName: Optional[str] = None
    projectInfo: Optional[dict] = None; coverImage: Optional[str] = None
    beamType: str = "dropped"
    stairAnchorX: Optional[float] = None; stairAnchorY: Optional[float] = None
    stairAngle: Optional[float] = None
    sitePlanMode: Optional[str] = "generate"; sitePlanFile: Optional[str] = None
    sitePlan: Optional[dict] = None
    siteElements: list = []
    northAngle: float = 0
    slopePercent: float = 0
    slopeDirection: str = "front-to-back"
    zones: list = []
    jurisdictionChecklist: Optional[dict] = None


# ============================================================
# PDF GENERATION
# ============================================================
def generate_blueprint_pdf(params: dict) -> tuple:
    """Generate two PDFs: permit plan set and materials list. Returns (permit_id, materials_id, calc)."""
    # S38: Validate lotVertices
    _lv = params.get("lotVertices")
    if _lv:
        try:
            _lv = [[float(v[0]), float(v[1])] for v in _lv[:12]]
            if len(_lv) < 3:
                _lv = None
            else:
                _sa = sum(_lv[i][0]*_lv[(i+1)%len(_lv)][1] - _lv[(i+1)%len(_lv)][0]*_lv[i][1] for i in range(len(_lv)))
                if abs(_sa) < 1:
                    _lv = None
        except (TypeError, ValueError, IndexError):
            _lv = None
        params["lotVertices"] = _lv
        if not _lv:
            params["lotEdges"] = None

    params["width"] = max(8, min(50, params.get("width", 20)))
    params["depth"] = max(6, min(24, params.get("depth", 12)))
    params["height"] = max(1, min(14, params.get("height", 4)))
    params["houseWidth"] = max(20, min(80, params.get("houseWidth", 40)))
    params["houseDepth"] = max(20, min(60, params.get("houseDepth", 30)))
    params["stairWidth"] = max(3, min(params["width"], params.get("stairWidth", 4)))
    params["lotWidth"] = max(30, min(300, params.get("lotWidth", 80)))
    params["lotDepth"] = max(50, min(400, params.get("lotDepth", 120)))
    params["setbackFront"] = max(0, min(50, params.get("setbackFront", 25)))
    params["setbackSide"] = max(0, min(30, params.get("setbackSide", 5)))
    params["setbackRear"] = max(0, min(50, params.get("setbackRear", 20)))
    # S38: Use polygon bounds for clamp when available
    _lot_max_x = params.get("lotWidth", 80)
    if params.get("lotVertices") and len(params["lotVertices"]) > 2:
        _lot_max_x = max(v[0] for v in params["lotVertices"])
    params["houseOffsetSide"] = max(5, min(_lot_max_x-params["houseWidth"]-5, params.get("houseOffsetSide", 20)))
    params["deckOffset"] = max(-params["houseWidth"]/2, min(params["houseWidth"]/2, params.get("deckOffset", 0)))
    params["stairOffset"] = params.get("stairOffset", 0)

    calc = calculate_structure(params)
    spec = build_permit_spec(params, calc)
    if spec["validation_errors"]:
        print(f"Permit spec validation warnings: {spec['validation_errors']}")

    # S58: Run permit completeness checker
    permit_report = run_checks("deck", params, calc, spec)
    if permit_report.overall_status == "not_ready":
        print(f"Permit checker: NOT READY - {permit_report.summary}")
    elif permit_report.overall_status != "ready":
        print(f"Permit checker: {permit_report.overall_status} - {permit_report.summary}")

    pi = params.get("projectInfo", {}) or {}
    cover_img = params.get("coverImage", None)
    sp_mode = params.get("sitePlanMode", "generate")
    sp_file = params.get("sitePlanFile", None)

    # S50: Two separate PDFs
    permit_id = str(uuid.uuid4())
    materials_id = str(uuid.uuid4())
    permit_path = PDF_DIR / f"{permit_id}.pdf"
    materials_path = PDF_DIR / f"{materials_id}.pdf"

    # -- Permit Plan Set (Cover + A-1 through A-5) --
    permit_sheets = [
        ("A-1", "DECK PLAN & FRAMING", draw_plan_and_framing),
        ("A-2", "ELEVATIONS", draw_elevations_sheet),
        ("A-3", "GENERAL NOTES", draw_notes_sheet),
        ("A-4", "STRUCTURAL DETAILS", draw_details_sheet),
    ]

    with PdfPages(str(permit_path)) as pdf:
        fig0 = plt.figure(figsize=(14, 8.5)); fig0.set_facecolor('white')
        _compliance = get_compliance_summary(permit_report)
        draw_cover_sheet(fig0, params, calc, pi, cover_img, compliance_summary=_compliance)
        pdf.savefig(fig0, dpi=200); plt.close(fig0)

        for sheet_num, sheet_name, draw_fn in permit_sheets:
            fig = plt.figure(figsize=(14, 8.5)); fig.set_facecolor('white')
            draw_fn(fig, params, calc, spec)
            draw_title_block(fig, sheet_num, sheet_name, calc, pi)
            pdf.savefig(fig, dpi=200); plt.close(fig)

        # A-5: Site plan (was A-6 before S50)
        fig5 = plt.figure(figsize=(14,8.5)); fig5.set_facecolor('white')
        draw_site_plan(fig5,params,calc); draw_title_block(fig5,"A-5","SITE PLAN",calc,pi)
        pdf.savefig(fig5,dpi=200); plt.close(fig5)

    # S50: Append jurisdiction-specific sheets (Colorado Springs PPRBD)
    if is_colorado_springs(pi):
        try:
            append_cos_attachment(permit_path, params, calc, pi)
        except Exception as e:
            print(f"COS attachment sheet error: {e}")

    # -- Materials & Cost Estimate (separate PDF) --
    with PdfPages(str(materials_path)) as pdf:
        fig_m = plt.figure(figsize=(14, 8.5)); fig_m.set_facecolor('white')
        draw_materials_sheet(fig_m, params, calc)
        draw_title_block(fig_m, "", "MATERIALS & COST ESTIMATE", calc, pi)
        pdf.savefig(fig_m, dpi=200); plt.close(fig_m)

    return permit_id, materials_id, calc, permit_report


# ============================================================
# AUTH ROUTES
# ============================================================
@app.get("/auth/login")
async def auth_login(request: Request):
    return RedirectResponse(url=get_login_url(request))

@app.get("/auth/callback")
async def auth_callback(request: Request, code: str = ""):
    if not code:
        return RedirectResponse(url="/?auth_error=no_code")
    try:
        user_info = await exchange_code(code, request)
        db_user = upsert_user(user_info.get("id",""), user_info.get("email",""),
                              user_info.get("name",""), user_info.get("picture",""))
        session_value = sign_session(db_user["id"])
        response = RedirectResponse(url="/?auth=success")
        response.set_cookie(key=COOKIE_NAME, value=session_value, max_age=COOKIE_MAX_AGE,
                           httponly=True, secure=True, samesite="lax")
        return response
    except Exception as e:
        print(f"Auth error: {e}")
        return RedirectResponse(url="/?auth_error=callback_failed")

@app.get("/auth/me")
async def auth_me(request: Request):
    user_id = get_current_user_id(request)
    if not user_id: return {"authenticated": False}
    user = get_user_by_id(user_id)
    if not user: return {"authenticated": False}
    return {"authenticated": True, "user": {
        "id": user["id"], "email": user["email"], "name": user["name"],
        "picture": user["picture"], "email_opt_in": user["email_opt_in"]}}

@app.post("/auth/logout")
async def auth_logout():
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE_NAME)
    return response

@app.post("/auth/opt-out")
async def auth_opt_out(request: Request):
    user_id = get_current_user_id(request)
    if not user_id: raise HTTPException(status_code=401)
    body = await request.json()
    update_email_opt_in(user_id, body.get("opt_in", True))
    return {"ok": True}

@app.get("/auth/unsubscribe")
async def auth_unsubscribe(uid: int = 0):
    if uid: update_email_opt_in(uid, False)
    return HTMLResponse('<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#faf8f3"><div style="text-align:center"><h2>Unsubscribed</h2><p>You will not receive further emails.</p><a href="https://simpleblueprints.xyz" style="color:#3d5a2e">Back to SimpleBlueprints</a></div></body></html>')


# ============================================================
# API ROUTES
# ============================================================
@app.post("/api/calculate")
async def calculate(params: DeckParams):
    return calculate_structure(params.dict())

# ============================================================
# AI SURVEY EXTRACTION (S29, S52 two-stage)
# ============================================================

def filter_pdf_pages(pdf_b64):
    """S52: Extract text from all pages, return only useful pages as PDF + pre-extracted text.
    Keeps: site plan, title/info, deck plan, survey, plat pages.
    Skips: cover sheets (just a rendering), elevation drawings."""
    import fitz, io
    try:
        pdf_bytes = base64.b64decode(pdf_b64)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        return pdf_b64, "", []  # fallback: send full PDF

    page_texts = []
    keep_pages = []
    skip_keywords = {"ELEVATION", "EXTERIOR ELEVATION"}
    keep_keywords = {"SITE PLAN", "SURVEY", "PLAT", "AREA TABULATION", "SETBACK",
                     "PROPERTY LINE", "DECK PLAN", "DECK FRAMING", "LOT AREA",
                     "VICINITY", "SCOPE OF WORK", "LEGAL DESCRIPTION", "PROJECT DATA",
                     "PARCEL", "ZONING"}

    all_extracted_text = []
    for i in range(len(doc)):
        text = doc[i].get_text().upper()
        page_texts.append(text)
        all_extracted_text.append(f"--- PAGE {i+1} ---\n{doc[i].get_text()[:2000]}")

        # Check if page has useful content
        has_keep = any(kw in text for kw in keep_keywords)
        is_only_elevation = any(kw in text for kw in skip_keywords) and not has_keep
        is_cover = "COVER SHEET" in text and not has_keep

        if has_keep and not is_only_elevation:
            keep_pages.append(i)
        elif not is_cover and not is_only_elevation:
            # Unknown page type - keep it to be safe
            keep_pages.append(i)

    if not keep_pages or len(keep_pages) == len(doc):
        # No filtering possible
        return pdf_b64, "\n".join(all_extracted_text), list(range(len(doc)))

    # Build filtered PDF
    out = fitz.open()
    for i in keep_pages:
        out.insert_pdf(doc, from_page=i, to_page=i)

    buf = io.BytesIO()
    out.save(buf)
    filtered_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    print(f"PDF filter: {len(doc)} pages -> {len(keep_pages)} pages (kept: {keep_pages})")
    return filtered_b64, "\n".join(all_extracted_text), keep_pages
SURVEY_EXTRACT_PROMPT = """Analyze this property survey or plat map and extract dimensions. Focus on the SITE PLAN sheet. Look for property line dimensions, setback lines, and area tabulations. Ignore cover sheets, elevation drawings, framing plans, and structural details.

Return ONLY a JSON object with no markdown, no backticks, no other text.

Required fields (use null if not found or not readable):
- lotWidth: lot width in feet, measured along the street frontage (number)
- lotDepth: lot depth in feet, measured from street to rear property line (number)
- lotArea: total lot area in square feet (number). Look in "AREA TABULATIONS" or "LOT AREA" sections, typically formatted as "LOT AREA: XX,XXX S.F." If given in acres, convert to square feet (1 acre = 43,560 SF).
- houseWidth: house/dwelling width in feet (number). See HOUSE DIMENSION ESTIMATION below.
- houseDepth: house/dwelling depth in feet (number). See HOUSE DIMENSION ESTIMATION below.
- houseDistFromStreet: distance from house front wall to front property line in feet (number). Estimate from the site plan using the graphic scale if not explicitly labeled. The house is typically set back from the street by the front setback distance or more.
- houseOffsetSide: distance from house left wall to left/west property line in feet (number). Estimate from the site plan using the graphic scale if not explicitly labeled.
- setbackFront: front setback requirement if shown on survey (number)
- setbackRear: rear setback requirement if shown on survey (number)
- setbackSide: side setback requirement if shown on survey (number)
- street: street address line only, no city/state/zip (string)
- city: city name (string)
- state: state abbreviation, e.g. "NY" (string)
- zip: ZIP or postal code (string)
- parcelId: lot number from the plat (e.g. "LOT 36", "LOT 46"). Use the lot number, not the parcel ID number or account number. Look for "LOT XX" labels on the site plan.
- streetName: name of the street the property faces (string)
- northAngle: orientation of north on this survey. Instead of estimating exact degrees, choose the closest cardinal direction that north points toward on the drawing: 0 = up, 45 = upper-right, 90 = right, 135 = lower-right, 180 = down, 225 = lower-left, 270 = left, 315 = upper-left. Look for a north arrow or compass rose. Use null if no north arrow is visible.
- streetSide: which side of the DRAWING is the street on? Look for road names, sidewalk markings, curb lines, or driveway access to identify the street edge. One of: "bottom", "top", "left", "right". Most surveys show the street at the bottom, but not always.
- houseXPercent: house center X position as percentage of lot bounding box width (number, 0-100). See HOUSE POSITION ESTIMATION below.
- houseYPercent: house center Y position as percentage from street to rear (number, 0-100). See HOUSE POSITION ESTIMATION below.

CRITICAL: Also extract per-edge lot boundary data. Property surveys label each boundary segment with its length. Extract these as a "lotEdges" array going CLOCKWISE starting from the STREET-FACING edge:
- lotEdges: array of objects, one per boundary segment, each with:
  - length: edge length in feet (number). Read this from the dimension label on the property line. Convert any decimal notation (e.g. 78.67') to a number.
  - type: "street" if this edge faces a road/street, "property" otherwise (string)
  - setbackType: "front" for the street edge, "rear" for the edge opposite the street, "side" for left/right edges (string)
  - label: street name if type is "street" (e.g. "SWEETGRASS LANE"), empty string otherwise (string)
  - neighborLabel: adjacent lot number if this is a property edge (e.g. "LOT 35"), empty string for street edges (string)

The street-facing edge is always edge 0. Identify the street by looking for road names, sidewalks, curb and gutter markings, or driveway access.

Example for a typical 4-sided lot:
[
  {"length": 78.67, "type": "street", "setbackType": "front", "label": "SWEETGRASS LANE", "neighborLabel": ""},
  {"length": 184.83, "type": "property", "setbackType": "side", "label": "", "neighborLabel": "LOT 35"},
  {"length": 78.07, "type": "property", "setbackType": "rear", "label": "", "neighborLabel": ""},
  {"length": 179.18, "type": "property", "setbackType": "side", "label": "", "neighborLabel": "LOT 37"}
]

For irregular lots with more than 4 sides (e.g. pie-shaped, cul-de-sac), include ALL boundary segments. Short connector segments (like 5.50' jogs between longer edges) are important for accurate shape. Assign their setbackType based on orientation: typically "side" for segments connecting front-to-rear edges, or "rear"/"front" if they run parallel to the street.

For curved property lines (arcs), use the arc length as the length value. If only arc notation is given (e.g. "L=49.11, R=1005'"), use the L value as the length. Keep type as "property" for curved boundaries.

If the lot is clearly rectangular (all angles are 90 degrees and opposite sides are equal), set lotEdges to null and just use lotWidth/lotDepth.

QUALITATIVE SHAPE ANALYSIS (helps reduce candidate shapes):
Also include these fields to help identify the correct lot shape:
- cornerAngles: array of approximate interior angles at each vertex IN THE SAME ORDER as lotEdges (degrees, number). Start at the corner between the street edge and the first clockwise edge. For a perfect rectangle, all angles are 90. For pie-shaped or irregular lots, corners may be 80, 95, 110, etc. Estimate from the drawing. Use null if you cannot determine angles.
- lotShapeDescription: brief text description of the lot shape, e.g. "roughly rectangular", "narrow pie-shaped lot wider at street", "trapezoid narrowing toward rear", "L-shaped with jog on east side" (string)
- isConvex: true if all corners point outward (no indentations), false if one or more corners point inward creating a concave shape (boolean). Most residential lots are convex.

Also include a "confidence" object with the same keys (including "lotEdges" and "lotArea"), each "high", "medium", or "low".

Also extract visible site objects as a "siteObjects" array. For each object you can ACTUALLY SEE drawn on the site plan (fences, pools, sheds, driveways, garages, A/C units), extract:
- type: one of "fence", "pool", "shed", "driveway", "garage", "ac_unit" (string)
- w: width in feet (number). For fences, this is the fence length. Estimate from graphic scale if not labeled.
- d: depth in feet (number). For fences, use 1. Estimate from graphic scale if not labeled.
- label: descriptive label like "FENCE", "POOL", "6' PRIVACY FENCE", "GARAGE" (string)
- relativeToHouse: spatial relationship to the house. One of: "left", "right", "behind", "front", "detached-left", "detached-right", "detached-behind" (string). Use "left"/"right"/"behind"/"front" when the object is attached or immediately adjacent to the house. Use "detached-*" when there is clear space between the object and the house.
- flushWithHouse: is the object's front wall aligned with the house front wall? One of: "flush", "set-back", "forward" (string). "flush" means same Y position as house front. "set-back" means further from street. "forward" means closer to street.
- nearestEdge: which property line is the object closest to? One of: "street", "left", "right", "rear" (string). This helps with fallback positioning.

Do NOT include xFromLeft or yFromStreet. Instead, use the relational fields above so the application can compute precise coordinates from the house position.

Common survey indicators:
- Fences: shown as dashed lines labeled "FENCE", "WOOD FENCE", "CHAIN LINK FENCE", "6' PRIVACY FENCE", etc. Measure the length along the fence line. Multiple fence segments should be separate entries. For relativeToHouse, describe which side of the property the fence is on. For fences along property lines, set nearestEdge to the property line they follow.
- Pools: shown as rounded rectangles labeled "POOL" with dimensions. Usually behind the house.
- Sheds/garages: shown as rectangles with labels and sometimes dimensions.
- Driveways: shown as rectangles or trapezoids connecting house area to street.

If no site objects are visible, set siteObjects to an empty array []. CRITICAL: Only include objects you can actually SEE drawn on the site plan. Do NOT invent or assume objects exist. If a garage is listed in area tabulations but its footprint is not drawn on the site plan, do NOT include it in siteObjects. NEVER include decks, porches, or patios in siteObjects - these are what the user is designing and are handled separately. Only include EXISTING permanent structures like garages, sheds, pools, driveways, fences, and A/C units.

HOUSE DIMENSION ESTIMATION (CRITICAL):
House dimensions are essential for accurate site plans. Use ALL available signals:
1. LABELED DIMENSIONS: If the house footprint has width/depth labels, use those directly.
2. AREA TABULATIONS: Look for "BUILDING: X,XXX S.F." in area tabulation sections. Use this as a cross-check (width x depth should approximate this area).
3. GRAPHIC SCALE: Every site plan has a graphic scale bar (e.g. "1' = 40'"). Measure the house footprint against this scale to estimate width and depth. This is the primary method when dimensions are not labeled.
4. DECK PLAN PAGES: If the document includes a deck plan at larger scale (e.g. 1/4" = 1'0"), the house outline is drawn much larger and easier to measure. Use this for more accurate estimates.
5. CROSS-CHECK: If building area is given (e.g. 1,140 SF) and you estimate 38' x 30' = 1,140 SF, that confirms your estimate.

HOUSE POSITION ESTIMATION (CRITICAL):
Accurate house positioning is essential. Use this two-step method:

Step 1 - ANCHOR TO SETBACK LINES: Setback lines (dashed) are drawn at known distances from property lines. Estimate the house position RELATIVE to these setback lines:
- houseDistFromStreet: If the house front wall appears to be AT the front setback line, use the front setback value. If it appears further back, estimate the additional distance using the graphic scale and add it. Example: front setback is 25', house appears about 15' behind the setback line, so houseDistFromStreet = 40.
- houseOffsetSide: If the house left wall appears to be AT the side setback line, use the side setback value. If it appears further in from the setback, estimate the additional distance and add it. Example: side setback is 15', house left wall appears about 45' beyond the setback line, so houseOffsetSide = 60.

Step 2 - CROSS-CHECK WITH RELATIVE POSITION: Also estimate these percentage fields to verify your absolute estimates:
- houseXPercent: What percentage across the lot's bounding box is the house center? 0 = left edge, 50 = centered, 100 = right edge. (number, 0-100)
- houseYPercent: What percentage from street to rear is the house center? 0 = at the street, 100 = at the rear property line. (number, 0-100)
Use these to sanity-check: if the lot is 195' wide and houseXPercent is 40%, the house center is at about 78' from the left, so houseOffsetSide should be roughly 78 - houseWidth/2. If your absolute estimate disagrees significantly with the percentage estimate, prefer the percentage-derived value.

OBJECT POSITION ESTIMATION:
For all objects (garage, site objects), use the same approach:
- Use setback lines and the graphic scale as reference points
- Estimate xFromLeft and yFromStreet using the graphic scale bar
- Also estimate approximate percentage position as a mental cross-check
- Property line lengths and setback distances are your most reliable reference points

Never return null for houseWidth, houseDepth, houseDistFromStreet, or houseOffsetSide if a house footprint is visible on the site plan. Use your best estimate.

Return ONLY valid JSON."""

@app.post("/api/extract-survey")
async def extract_survey(request: Request):
    """AI-powered survey dimension extraction using Claude Vision."""
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required")

    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="AI extraction not configured")

    try:
        body = await request.json()
        survey_b64 = body.get("surveyData", "")
        file_type = body.get("fileType", "image")

        if not survey_b64:
            raise HTTPException(status_code=400, detail="No survey data provided")

        # Build message content based on file type
        pre_text = ""
        if file_type == "pdf":
            # S52: Filter to useful pages only, extract text locally
            filtered_b64, pre_text, kept = filter_pdf_pages(survey_b64)
            # Find which original page is the site plan (for frontend page nav)
            site_page_idx = 0
            try:
                import fitz as _fitz
                _doc = _fitz.open(stream=base64.b64decode(survey_b64), filetype="pdf")
                _best_score = -1
                _site_kw = ["SITE PLAN", "PROPERTY LINE", "SETBACK", "GRAPHIC SCALE"]
                _skip_kw = ["ELEVATION", "COVER SHEET"]
                for _i in range(len(_doc)):
                    _t = _doc[_i].get_text().upper()
                    _sc = sum(2 for k in _site_kw if k in _t) - sum(1 for k in _skip_kw if k in _t)
                    if _sc > _best_score:
                        _best_score = _sc
                        site_page_idx = _i
                print(f"Site plan page detected: {site_page_idx}")
            except Exception as _e:
                print(f"Site page detection error: {_e}")
            doc_block = {
                "type": "document",
                "source": {"type": "base64", "media_type": "application/pdf", "data": filtered_b64}
            }
        else:
            media_type = "image/png" if survey_b64[:4] == "iVBO" else "image/jpeg"
            doc_block = {
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": survey_b64}
            }

        # S52: Prepend pre-extracted text context to prompt
        prompt_text = SURVEY_EXTRACT_PROMPT
        if pre_text:
            prompt_text = "PRE-EXTRACTED TEXT FROM ALL PAGES (use for address, area tabulations, parcel info):\n" + pre_text[:3000] + "\n\n" + prompt_text

        payload = {
            "model": "claude-sonnet-4-6",
            "max_tokens": 4096,
            "temperature": 0,
            "messages": [{
                "role": "user",
                "content": [doc_block, {"type": "text", "text": prompt_text}]
            }]
        }

        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "anthropic-beta": "pdfs-2024-09-25"
            }
        )

        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            # S52: Find the text block (skip thinking blocks)
            text = ""
            for block in result.get("content", []):
                if block.get("type") == "text":
                    text = block.get("text", "")
                    break
            text = text.strip()
            if not text.startswith("{"):
                start = text.find("{")
                end = text.rfind("}") + 1
                if start >= 0 and end > start:
                    text = text[start:end]
            extracted = json.loads(text)
            resp_data = {"ok": True, "data": extracted}
            if file_type == "pdf":
                resp_data["sitePageIndex"] = site_page_idx
            return resp_data

    except json.JSONDecodeError as e:
        return {"ok": False, "error": "Failed to parse AI response: " + str(e)}
    except urllib.error.HTTPError as he:
        error_body = he.read().decode("utf-8", errors="replace") if he.fp else ""
        print("Survey extraction HTTP error: " + str(he.code) + " body: " + error_body[:500])
        return {"ok": False, "error": "HTTP Error " + str(he.code) + ": " + error_body[:200]}
    except Exception as e:
        print("Survey extraction error: " + str(e))
        return {"ok": False, "error": str(e)}


SHAPE_RANK_PROMPT = """You are analyzing a property survey to determine the correct lot shape and orientation.

Above you see the SURVEY SITE PLAN page, followed by {shapes_text}. Each candidate has the same edge lengths but arranged differently, producing different outlines. The candidate shapes have been rotated to match the survey's orientation.

TASKS:
1. SHAPE MATCHING: Compare the VISUAL OUTLINE of each candidate shape image to the lot boundary drawn on the survey. Focus on the overall shape: is it roughly rectangular, trapezoidal, triangular, L-shaped? Match the proportions and angles visually. Do NOT reason from edge lengths. Just look at which shape image most closely matches what you see on the survey. Give the 0-based index.

2. CONFIDENCE: "high" if one clearly matches visually, "medium" if 2-3 look similar, "low" if hard to tell.

3. NORTH DIRECTION: Look for a north arrow or compass rose on the survey. Which direction does it point? 0=up, 45=upper-right, 90=right, 135=lower-right, 180=down, 225=lower-left, 270=left, 315=upper-left.

4. STREET SIDE: Which side of the DRAWING is the street on? "bottom", "top", "left", "right".

Return ONLY a JSON object:
{
  "bestShapeIndex": 0,
  "confidence": "high",
  "northAngle": 0,
  "streetSide": "bottom",
  "reason": "brief explanation"
}

Return ONLY valid JSON, no markdown, no backticks."""


def render_candidate_images(candidates, street_side="bottom"):
    """Render each candidate shape as a small PNG image for visual comparison.
    Rotates shapes so the street edge matches the survey orientation."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import math

    def rotate_verts(verts, street_side):
        """Rotate vertices so street edge appears on the given side.
        Shapes are generated with street at bottom. Rotate around centroid."""
        if street_side == "bottom" or not street_side:
            return verts
        cx = sum(v[0] for v in verts) / len(verts)
        cy = sum(v[1] for v in verts) / len(verts)
        # Rotation angles: street starts at bottom, rotate to target side
        # CCW pi/2 moves bottom edge to right side
        # CW -pi/2 moves bottom edge to left side
        # pi moves bottom edge to top
        rotations = {"top": math.pi, "right": math.pi / 2, "left": -math.pi / 2}
        theta = rotations.get(street_side, 0)
        if theta == 0:
            return verts
        cos_t, sin_t = math.cos(theta), math.sin(theta)
        rotated = []
        for v in verts:
            dx, dy = v[0] - cx, v[1] - cy
            rotated.append([cx + dx * cos_t - dy * sin_t, cy + dx * sin_t + dy * cos_t])
        return rotated

    images = []
    for i, c in enumerate(candidates):
        verts = c.get("vertices", [])
        if not verts or len(verts) < 3:
            continue
        verts = rotate_verts(verts, street_side)
        fig, ax = plt.subplots(1, 1, figsize=(3, 3), dpi=100)
        xs = [v[0] for v in verts] + [verts[0][0]]
        ys = [v[1] for v in verts] + [verts[0][1]]
        ax.fill(xs, ys, alpha=0.15, color="#3d5a2e")
        ax.plot(xs, ys, color="#3d5a2e", linewidth=2.5)
        ax.set_aspect("equal")
        ax.set_title(f"Shape {i}", fontsize=10, fontweight="bold")
        ax.axis("off")
        fig.tight_layout(pad=0.3)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", dpi=100)
        plt.close(fig)
        buf.seek(0)
        images.append(base64.b64encode(buf.read()).decode("utf-8"))
    return images


def get_site_plan_page(pdf_b64):
    """Extract just the site plan page from a PDF as a single-page PDF."""
    import fitz
    try:
        pdf_bytes = base64.b64decode(pdf_b64)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        return pdf_b64

    # Find the page most likely to be the site plan
    best_page = 0
    best_score = -1
    site_kw = ["SITE PLAN", "PROPERTY LINE", "SETBACK", "GRAPHIC SCALE"]
    skip_kw = ["ELEVATION", "DECK PLAN", "FRAMING", "COVER SHEET"]

    for i in range(len(doc)):
        t = doc[i].get_text().upper()
        score = sum(2 for k in site_kw if k in t) - sum(1 for k in skip_kw if k in t)
        if score > best_score:
            best_score = score
            best_page = i

    out = fitz.open()
    out.insert_pdf(doc, from_page=best_page, to_page=best_page)
    buf = io.BytesIO()
    out.save(buf)
    print(f"Site plan page: {best_page} (score {best_score})")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@app.post("/api/rank-shapes")
async def rank_shapes(request: Request):
    """S52 Stage 2: Opus-powered shape ranking and orientation detection."""
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="AI not configured")

    try:
        body = await request.json()
        survey_b64 = body.get("surveyData", "")
        candidates = body.get("candidates", [])
        file_type = body.get("fileType", "image")
        street_side = body.get("streetSide", "bottom")

        if not survey_b64 or not candidates:
            return {"ok": False, "error": "Missing survey data or candidates"}

        # S53: Render candidate shapes rotated to match survey orientation
        shape_images = render_candidate_images(candidates, street_side)
        print(f"Rendered {len(shape_images)} shape images for ranking (streetSide={street_side})")

        # Get just the site plan page
        if file_type == "pdf":
            site_b64 = get_site_plan_page(survey_b64)
            doc_block = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": site_b64}}
        else:
            media_type = "image/png" if survey_b64[:4] == "iVBO" else "image/jpeg"
            doc_block = {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": survey_b64}}

        # Build content blocks: survey page + shape images + prompt
        content_blocks = [doc_block]
        for si, img_b64 in enumerate(shape_images):
            content_blocks.append({"type": "text", "text": f"CANDIDATE SHAPE {si}:"})
            content_blocks.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_b64}})

        prompt = SHAPE_RANK_PROMPT.replace("{shapes_text}", f"{len(shape_images)} candidate shapes shown as images above")
        content_blocks.append({"type": "text", "text": prompt})

        payload = {
            "model": "claude-opus-4-6",
            "max_tokens": 1024,
            "temperature": 0,
            "messages": [{"role": "user", "content": content_blocks}]
        }

        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "anthropic-beta": "pdfs-2024-09-25"
            }
        )

        with urllib.request.urlopen(req, timeout=45) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            text = ""
            for block in result.get("content", []):
                if block.get("type") == "text":
                    text = block.get("text", "")
                    break
            text = text.strip()
            if not text.startswith("{"):
                s = text.find("{")
                e = text.rfind("}") + 1
                if s >= 0 and e > s: text = text[s:e]
            ranking = json.loads(text)
            print(f"Shape ranking: best={ranking.get('bestShapeIndex')}, conf={ranking.get('confidence')}, north={ranking.get('northAngle')}, street={ranking.get('streetSide')}")
            return {"ok": True, "data": ranking}

    except urllib.error.HTTPError as he:
        error_body = he.read().decode("utf-8", errors="replace") if he.fp else ""
        print("Shape ranking HTTP error: " + str(he.code) + " body: " + error_body[:500])
        return {"ok": False, "error": "HTTP Error " + str(he.code) + ": " + error_body[:200]}
    except Exception as e:
        print("Shape ranking error: " + str(e))
        return {"ok": False, "error": str(e)}


# S54: AI Helper - conversational guide assistant
AI_HELPER_PARAMS = {
    0: {
        "step_name": "Site Plan",
        "step_description": "Setting up property boundaries, house position, and lot details.",
        "params": {
            "lotWidth": {"desc": "Lot width in feet (front to back neighbor)", "min": 30, "max": 300, "type": "number"},
            "lotDepth": {"desc": "Lot depth in feet (street to back)", "min": 50, "max": 400, "type": "number"},
            "houseWidth": {"desc": "House width in feet (wall where deck attaches)", "min": 20, "max": 80, "type": "number"},
            "houseDepth": {"desc": "House depth in feet", "min": 20, "max": 60, "type": "number"},
            "houseOffsetSide": {"desc": "Distance from left property line to house", "min": 5, "max": 200, "type": "number"},
            "houseDistFromStreet": {"desc": "Distance from street to front of house", "min": 5, "max": 200, "type": "number"},
            "setbackFront": {"desc": "Front setback in feet (minimum distance from street)", "min": 0, "max": 50, "type": "number"},
            "setbackSide": {"desc": "Side setback in feet", "min": 0, "max": 30, "type": "number"},
            "setbackRear": {"desc": "Rear setback in feet", "min": 0, "max": 50, "type": "number"},
            "streetName": {"desc": "Street name for site plan label", "type": "string"},
            "northAngle": {"desc": "North arrow angle in degrees (0=up, 90=right, 180=down, 270=left)", "min": 0, "max": 359, "type": "number"},
            "slopePercent": {"desc": "Ground slope percentage (0 for flat)", "min": 0, "max": 30, "type": "number"},
            "slopeDirection": {"desc": "Slope direction", "type": "choice", "options": ["front-to-back", "back-to-front", "left-to-right", "right-to-left"]},
        }
    },
    1: {
        "step_name": "Size & Shape",
        "step_description": "Designing the deck dimensions, height, stairs, and attachment method.",
        "params": {
            "width": {"desc": "Deck width in feet (along the house wall)", "min": 8, "max": 50, "type": "number"},
            "depth": {"desc": "Deck depth in feet (how far it extends into the yard)", "min": 6, "max": 24, "type": "number"},
            "height": {"desc": "Deck height in feet above ground", "min": 1, "max": 14, "type": "number"},
            "hasStairs": {"desc": "Whether the deck has stairs", "type": "boolean"},
            "stairLocation": {"desc": "Which side stairs exit from", "type": "choice", "options": ["front", "left", "right"]},
            "stairWidth": {"desc": "Stair width in feet", "min": 3, "max": 8, "type": "number"},
            "stairTemplate": {"desc": "Stair layout template", "type": "choice", "options": ["straight", "lLeft", "lRight", "switchback", "wrapAround", "wideLanding"]},
            "hasLanding": {"desc": "Whether stairs have a landing pad at the bottom", "type": "boolean"},
            "numStringers": {"desc": "Number of stair stringers (structural supports)", "min": 2, "max": 5, "type": "number"},
            "stairOffset": {"desc": "Stair offset from center of the deck edge (negative=left, positive=right)", "type": "number"},
            "deckOffset": {"desc": "Horizontal offset of deck center from house center (negative=left, positive=right)", "type": "number"},
            "attachment": {"desc": "How deck attaches to house", "type": "choice", "options": ["ledger", "freestanding"]},
        }
    },
    2: {
        "step_name": "Structure",
        "step_description": "Structural specifications: joists, beams, posts, footings. Most values are auto-calculated from IRC tables.",
        "params": {
            "joistSize": {"desc": "Joist lumber size", "type": "choice", "options": ["2x6", "2x8", "2x10", "2x12"]},
            "joistSpacing": {"desc": "Joist spacing in inches", "type": "choice", "options": [12, 16]},
            "attachment": {"desc": "Ledger (bolted to house) or freestanding (own posts)", "type": "choice", "options": ["ledger", "freestanding"]},
        }
    },
    3: {
        "step_name": "Finishes",
        "step_description": "Choosing decking material, railing style, and reviewing cost estimates.",
        "params": {
            "deckingType": {"desc": "Decking board material", "type": "choice", "options": ["pt_wood", "cedar", "composite"]},
            "railingType": {"desc": "Railing style", "type": "choice", "options": ["wood", "composite", "aluminum", "cable", "glass", "none"]},
        }
    },
    4: {
        "step_name": "Review",
        "step_description": "Final review and PDF blueprint generation.",
        "params": {}
    }
}

def build_ai_helper_prompt(step, params, extraction_summary, guide_phase="", compare_context=""):
    step_info = AI_HELPER_PARAMS.get(step, AI_HELPER_PARAMS[0])
    param_desc = ""
    current_vals = ""
    for k, v in step_info["params"].items():
        param_desc += f"- {k}: {v['desc']}"
        if v.get("type") == "choice":
            param_desc += f" (options: {v['options']})"
        elif v.get("min") is not None:
            param_desc += f" (range: {v['min']}-{v['max']})"
        param_desc += "\n"
        val = params.get(k)
        if val is not None:
            current_vals += f"- {k}: {val}\n"

    # S54: Cross-step params - always available regardless of current step
    # The site plan preview shows the deck, so the AI needs to know about it everywhere
    cross_step_params = {
        "width": {"desc": "Deck width in feet (along the house wall)", "min": 8, "max": 50, "type": "number"},
        "depth": {"desc": "Deck depth in feet (how far it extends into yard)", "min": 6, "max": 24, "type": "number"},
        "height": {"desc": "Deck height in feet above ground", "min": 1, "max": 14, "type": "number"},
        "hasStairs": {"desc": "Whether the deck has stairs", "type": "boolean"},
        "stairLocation": {"desc": "Which side stairs exit from", "type": "choice", "options": ["front", "left", "right"]},
        "attachment": {"desc": "How deck attaches to house", "type": "choice", "options": ["ledger", "freestanding"]},
        "deckOffset": {"desc": "Horizontal offset of deck center from house center", "type": "number"},
    }
    cross_desc = ""
    cross_vals = ""
    for k, v in cross_step_params.items():
        if k not in step_info["params"]:  # avoid duplicates
            cross_desc += f"- {k}: {v['desc']}"
            if v.get("type") == "choice":
                cross_desc += f" (options: {v['options']})"
            elif v.get("min") is not None:
                cross_desc += f" (range: {v['min']}-{v['max']})"
            cross_desc += "\n"
            val = params.get(k)
            if val is not None:
                cross_vals += f"- {k}: {val}\n"

    extraction_note = ""
    if extraction_summary:
        extraction_note = f"\nExtraction results from their survey upload:\n{extraction_summary}\n"

    # S56: Include compare mode context (shape candidates + ranking)
    compare_note = ""
    if compare_context:
        compare_note = f"\n{compare_context}\nWhen the user asks about shapes, candidates, or which option to pick, use this context to give specific answers. Reference shapes by their number (Shape 1, Shape 2, etc.). If the AI has recommended a shape, explain the recommendation. If ranking is in progress, let them know it's still analyzing. The user can click a shape card to preview it, then click 'Confirm' to apply it.\n"

    # S54: Include site elements context
    site_elements_note = ""
    site_els = params.get("siteElements") or []
    if site_els:
        site_elements_note = "\nSITE ELEMENTS currently on the plan:\n"
        for i, el in enumerate(site_els):
            etype = el.get("type", "unknown")
            elabel = el.get("label", "")
            ex, ey = el.get("x", 0), el.get("y", 0)
            ew, ed = el.get("w", 0), el.get("d", 0)
            site_elements_note += f"- index {i}: type={etype}, label=\"{elabel}\", x={ex}, y={ey}, w={ew}', d={ed}'\n"
    else:
        site_elements_note = "\nSITE ELEMENTS: None currently on the plan.\n"
    site_elements_note += """
Site element properties (all settable):
- type: one of "garage", "shed", "pool", "driveway", "patio", "tree", "ac_unit", "fence", "walkway"
- label: display name (e.g. "EXISTING GARAGE")
- x: horizontal position from left property line (feet)
- y: vertical position from street/front property line (feet)
- w: width in feet
- d: depth in feet

Coordinate system: (0,0) is the bottom-left corner at the street. X increases left to right, Y increases from street toward the rear. So a garage at x=50, y=80 is in the back-right area of the lot.
"""

    # S54: UI map for navigate actions - describes what sections exist and how they work
    ui_maps = {
        0: """PREVIEW PANEL: Shows the Site Plan - lot boundary, house footprint, proposed deck outline, site elements (garage, shed, etc.), setback lines, north arrow. Everything is visible here.

UI SECTIONS (scrollable/expandable):
- "upload": Survey upload area. User can upload a PDF or photo of their property survey.
- "lotHouse": Lot Dimensions & House Position. Contains sliders for lot width, lot depth, house width, house depth, house offset from left property line, and distance from street. Collapsible section.
- "siteElements": Site Elements. Add structures like sheds, pools, driveways, garages, fences, trees. Each has type, position, and size. Collapsible section.
- "northArrow": North Arrow compass dial. Drag or click cardinal directions (N/NE/E/S/W/NW). Also has a degree slider.
- "slope": Slope settings. Slope percentage slider and direction selector (front-to-back, back-to-front, left-to-right, right-to-left).

HOW COMPLEX TASKS WORK:
- To change lot shape: User uploads a survey (the AI extracts it), OR uses the shape picker in compare mode, OR traces manually on the survey image. Navigate to "upload" section.
- To add site elements: Navigate to "siteElements", click to expand, then use the "Add Element" button. Each element has type dropdown, position, and size controls.
- To set north arrow: Navigate to "northArrow". They can drag the compass, click a cardinal direction button, or use the degree slider.""",
        1: """PREVIEW PANEL: Shows the Deck Plan - just the deck layout, house wall, and stairs. Does NOT show the full lot, garage, shed, or other site elements. Those only appear on the Site Plan in Step 0 and in the final PDF.

UI SECTIONS (scrollable/expandable):
- "deckSize": Width, Depth, and Height sliders for the main deck (or active zone).
- "zones": Zone selector bar. Shows Main Deck and any added zones. User clicks to switch between zones. To ADD a zone: look at the preview panel on the right, switch to "+" mode using the toolbar above the preview, then click a deck edge. To add a CUTOUT, use the scissors mode.
- "chamfer": Corner Modifiers. Toggle 45-degree chamfers on any of the 4 corners (Back Left, Back Right, Front Left, Front Right). Each has a size slider.
- "attachment": Attachment method - Ledger Board (bolted to house) or Freestanding (own posts near house wall).
- "stairs": Stairs section. First choose Yes/No, then location (Front/Left/Right), width, number of stringers, and landing pad (Yes/No toggle).
- "stairTemplate": Stair Template picker. Six visual options: Straight, L-Left, L-Right, U-Turn (switchback), Wrap (3-run), Platform (wide landing). Each shows a small icon.
- "advanced": Positioning section (collapsible). Contains deck offset from center, stair offset, and for complex stair templates: run split percentage, landing depth, gap between runs.

STAIR SPATIAL GUIDE (use this to translate user descriptions):
The deck attaches to the house wall. "Front" of the deck = the edge facing AWAY from the house (into the yard).
- stairLocation="front": Stairs exit from the front edge, going AWAY from house into the yard. Perpendicular to the house wall.
- stairLocation="left": Stairs exit from the left side edge, going sideways. Parallel to the house wall.
- stairLocation="right": Stairs exit from the right side edge, going sideways. Parallel to the house wall.
- stairTemplate="straight": Single run of stairs going straight out.
- stairTemplate="lLeft": Two runs with a landing. First run goes out, turns left for second run. Good when user says "L-shaped" or "turn left."
- stairTemplate="lRight": Two runs with a landing, turning right.
- stairTemplate="switchback" (U-Turn): Goes out, turns 180 on a landing, comes back parallel. Both runs are side by side. Good when user says "U-turn," "switchback," "come back," or "parallel runs."
- stairTemplate="wrapAround" (Wrap): Three runs wrapping around. Most compact for high decks.
- stairTemplate="wideLanding" (Platform): Two runs separated by a wide landing. Good for ADA or when user says "platform" or "wide landing."
- hasLanding: Adds a landing pad at the bottom of the stairs (Yes/No toggle). This is a simple boolean, set it directly.

When user says "stairs parallel to the deck/house" they likely mean stairLocation="left" or "right" (stairs run along the house wall).
When user says "stairs overlap" or "run alongside" the deck, they mean the stair run is parallel to the deck face, which is stairLocation="left" or "right", or stairTemplate="switchback".

HOW COMPLEX TASKS WORK:
- To make an L-shaped deck: Use a zoneAdd action to add a zone on the desired edge. Example: {{"zoneAdd":{{"edge":"left","width":10,"depth":8}}}} adds a 10x8 extension on the left side.
- To make a wraparound deck: Add zones on multiple edges. Example: add one zone on the left and another on the right to wrap around the house.
- To change stair shape/template: Set the stairTemplate param directly (e.g. stairTemplate="switchback"). Also set hasStairs=true if not already. Then optionally navigate to "stairTemplate" to show the user their options.
- To add angled corners (chamfers): Use a chamferSet action. Corners are BL (back-left), BR (back-right), FL (front-left), FR (front-right). Example: {{"chamferSet":{{"corner":"FR","enabled":true,"size":4}}}} adds a 4-foot 45-degree chamfer on the front-right corner.
- To cut a notch in the deck: Use a cutoutAdd action. Example: {{"cutoutAdd":{{"edge":"front","width":4,"depth":4}}}} cuts a 4x4 notch from the front edge.
- To remove a zone or cutout: Use {{"zoneRemove":{{"zoneId":1}}}} with the zone's ID number.
- To reposition the deck: Set deckOffset param directly (negative=left, positive=right). Or navigate to "advanced" to show the slider.
- To toggle landing pad on/off: Set hasLanding directly (true/false). This is a simple toggle, no need to navigate.""",
        2: """PREVIEW PANEL: Shows the Deck Plan with structural members (joists, beams, posts) overlaid.

UI SECTIONS:
- "structure": All structural settings. Joist spacing (12" or 16"), snow load (None/Light/Moderate/Heavy), footing depth based on frost zone. Most values are auto-calculated from IRC tables based on deck size.

HOW IT WORKS:
- Values are auto-calculated. The user can override by looking at the controls. Most homeowners should leave these at defaults unless their building department specifies different requirements.""",
        3: """PREVIEW PANEL: Shows the Deck Plan.

UI SECTIONS:
- "materials": Decking material selector (Composite/Pressure Treated) and Railing style (Fortress Iron/Wood).
- "costBreakdown": Cost breakdown table showing itemized costs by category.

HOW IT WORKS:
- Pick decking and railing materials. Cost updates automatically. The breakdown shows Foundation, Posts, Beam, Framing, Hardware, Decking, Railing costs.""",
        4: """PREVIEW PANEL: Shows a mini blueprint preview with thumbnail of each sheet.

UI SECTIONS:
- "projectInfo": Project information form. Name, address, city, state, zip, contractor info. This prints on the title block.
- "generate": Generate Blueprint button. Creates a PDF permit plan set (Cover, Plan, Elevations, Notes, Details, Site Plan).

HOW IT WORKS:
- Fill in project info (may be pre-filled from survey extraction), then click Generate. PDF opens in a new tab. Takes about 30 seconds."""
    }

    ui_map = ui_maps.get(step, "")

    return f"""You are the AI guide for SimpleBlueprints, a tool that helps homeowners generate deck blueprint packages for permit applications. You are currently helping on Step {step}: {step_info['step_name']} - {step_info['step_description']}
{f"Current guide phase: {guide_phase}" if guide_phase else ""}

IMPORTANT: SimpleBlueprints generates blueprint packages to support permit applications. We do NOT guarantee permit approval. Structural sizing follows IRC 2021 prescriptive tables, but every jurisdiction has its own requirements. If a user asks whether their plans will pass or be approved, explain that we provide IRC-based calculations and professional-quality drawings to support their application, but the building department makes the final determination. Never say "permit-ready" or "guaranteed to pass".

Your personality: Warm, knowledgeable, concise. You are a friendly building expert helping a non-technical homeowner. Use plain English. Avoid jargon unless asked. Keep responses to 1-2 sentences. Only go longer if the user asks for detail or explanation.

SETTABLE PARAMETERS for this step:
{param_desc if param_desc else "(No settable parameters on this step)"}
{"CROSS-STEP PARAMETERS (always available - the site plan preview shows the deck on every step):" + chr(10) + cross_desc + chr(10) + "Current deck values:" + chr(10) + (cross_vals if cross_vals else "(defaults)") if cross_desc else ""}
CURRENT VALUES:
{current_vals if current_vals else "(defaults)"}
{extraction_note}{compare_note}{site_elements_note}
{ui_map}

RESPONSE FORMAT:
Write your response as plain text (this is what the user sees streaming in real-time).
If you need to take actions, put them on the VERY LAST LINE starting with ACTIONS: followed by a JSON array.
If no actions are needed, just write your plain text response with no ACTIONS line.

Example with actions:
I've set your deck to 20' wide by 14' deep. Check the preview to see how it looks!
ACTIONS:[{{"param":"width","value":20}},{{"param":"depth","value":14}}]

Example with navigate:
You can change your stair style in the Stair Template section. I'll scroll you there now.
ACTIONS:[{{"navigate":"stairTemplate"}}]

Example with site element update:
Done! I've shrunk the garage from 24' to 20' wide. You can fine-tune it in the Site Elements section.
ACTIONS:[{{"siteElementUpdate":{{"index":0,"w":20}}}}]

Example adding a zone (L-shaped deck):
I've added a 10' by 8' extension on the left side of your deck to create that L-shape. Check the preview!
ACTIONS:[{{"zoneAdd":{{"edge":"left","width":10,"depth":8}}}},{{"classify":"configuration_help"}}]

Example adding a chamfer:
Done! I've added a 4-foot 45-degree chamfer on the front-right corner.
ACTIONS:[{{"chamferSet":{{"corner":"FR","enabled":true,"size":4}}}},{{"classify":"configuration_help"}}]

Example adding a cutout:
I've cut a 4' by 4' notch from the front edge. This is useful if you need clearance around a post or tree.
ACTIONS:[{{"cutoutAdd":{{"edge":"front","width":4,"depth":4}}}},{{"classify":"configuration_help"}}]

Example with stair template:
I've set up L-shaped stairs turning left from the front of the deck. They'll go straight out, then turn left on a landing.
ACTIONS:[{{"param":"hasStairs","value":true}},{{"param":"stairLocation","value":"front"}},{{"param":"stairTemplate","value":"lLeft"}},{{"classify":"configuration_help"}}]

Example with SUGGEST BUTTONS (gives user clickable choices instead of asking a yes/no question):
A few options for your deck size:
ACTIONS:[{{"suggest":[{{"label":"20' x 14' (standard)","actions":[{{"param":"width","value":20}},{{"param":"depth","value":14}}]}},{{"label":"24' x 16' (spacious)","actions":[{{"param":"width","value":24}},{{"param":"depth","value":16}}]}},{{"label":"16' x 12' (compact)","actions":[{{"param":"width","value":16}},{{"param":"depth","value":12}}]}}]}},{{"classify":"configuration_help"}}]

Example with single SUGGEST (confirmation instead of making user type "yes"):
I can add an L-shaped extension on the left side.
ACTIONS:[{{"suggest":[{{"label":"Add 10' x 8' extension","actions":[{{"zoneAdd":{{"edge":"left","width":10,"depth":8}}}}]}},{{"label":"Skip","actions":[]}}]}},{{"classify":"configuration_help"}}]

Example without actions:
A setback is the minimum distance your deck must be from the property line. Your building department sets these requirements.

IMPORTANT: Do NOT wrap your response in JSON or code fences. Write naturally as plain text. Only use the ACTIONS: line when you need to change values or navigate.

CLASSIFY: ALWAYS include a "classify" action in your ACTIONS line to tag the user's message intent. Categories: general_question, feature_request, bug_report, confusion, frustration, positive_feedback, configuration_help. If there are no other actions, still include ACTIONS with just the classify. Examples:
User asks how setbacks work -> ACTIONS:[{{"classify":"general_question"}}]
User says "I wish I could add a hot tub" -> ACTIONS:[{{"classify":"feature_request"}}]
User says "the deck is overlapping my house and won't stop" -> ACTIONS:[{{"classify":"bug_report"}}]
User says "this is so easy, love it" -> ACTIONS:[{{"classify":"positive_feedback"}}]
User sets their deck width -> ACTIONS:[{{"param":"width","value":20}},{{"classify":"configuration_help"}}]

RULES:
- "actions" array is optional. Only include it when the user clearly wants to set/change a value or needs to see a specific section.
- Values must respect the min/max ranges and valid options listed above.
- If the user asks a question, just answer it (no actions needed).
- If the user describes what they want in natural language, translate to parameter values and set them.
- If the user says something ambiguous, ask a clarifying question (no actions).
- When you set values, confirm what you set in your message.
- BREVITY: Keep responses SHORT. 1-2 sentences max for simple changes. No need to re-explain what the tool does. Don't list out what you changed in detail; the action chips show that. Don't say "Check the preview" or "Let me know if you need anything else" -- skip filler.
- SUGGEST BUTTONS: Use the "suggest" action when you want the user to choose between options or confirm a change. This renders clickable buttons -- the user taps instead of typing. Use suggest instead of asking yes/no questions. Use suggest when offering 2-4 options. Keep labels short (under 25 characters). Include a "Skip" or "Keep current" option when appropriate.
- DIRECT vs SUGGEST: If the user explicitly asks for something specific ("make my deck 20 wide"), use direct actions. If you're recommending or offering choices, use suggest buttons. Never ask "Would you like me to...?" -- use a suggest button instead.
- ACT FIRST: When the user asks for something that maps to a settable parameter (landing pad, stair template, deck width, attachment type, etc.), SET IT DIRECTLY with a param action. Do not just navigate to the section and tell them to click. Only use navigate for tasks that genuinely require visual interaction (adding zones via the preview panel, choosing chamfer corners). If you set a value AND want to show them the section, do both: set the param and navigate.
- PHASE AWARENESS: The current guide phase tells you what the user is working on right now. When the user says something ambiguous like "can you do this for me?" or "yes" or "set it up", interpret it in the context of the current guide phase, NOT previous conversation topics. For example, if the phase is "north_arrow" and they say "do this for me", they mean "set the north direction", not something from an earlier conversation about the garage.
- PREVIEW AWARENESS: Each step shows a different preview panel (described in PREVIEW PANEL above). If the user asks "why doesn't X show here?" or refers to something not visible, explain what the current preview shows and where they can see the thing they're looking for.
- Use {{"navigate": "sectionId"}} to scroll the user to the relevant section and highlight it. Use this when the user needs to SEE controls to complete a task (like choosing a stair template visually, or toggling chamfer corners). Combine navigate with your instructional message.
- SITE ELEMENTS: Use siteElementUpdate to modify an existing element's properties (only include the properties you want to change). Use siteElementAdd to add a new element. Use siteElementRemove to remove one. When the user asks about a site element (position, size, etc.), reference the current site elements data to answer accurately.
- For complex visual tasks (adding zones, choosing chamfer corners), use navigate to show the section and INSTRUCT the user on what to click.
- For deck height, help users think about it: "How high is your back door above the ground?" Common heights: 2-4 feet for most homes, 6-10 feet for walkout basements.
- A setback is the minimum distance a structure must be from a property line. Permit offices enforce these.
- A ledger board is a board bolted directly to the house framing. Freestanding means the deck has its own support posts near the house instead.
- Never mention "sections" or "sectionId" or UI implementation details. Just describe what the user should look for and do.
- CROSS-STEP FIXES: If the user reports a problem visible in the site plan preview (like deck overlapping with a garage), fix it immediately using cross-step parameters. Don't tell the user to fix it in a later step. The preview updates live, so they'll see the fix right away.
- TEACH THE TOOL: When you make a change for the user, briefly mention how they can do it themselves. For example: "I've shrunk the garage to 20' wide. If you want to fine-tune it, you can adjust the size in the Site Elements section below." This builds confidence and helps them learn the tool. Keep it to one short sentence, not a tutorial.
- REFERENCE PHOTOS: Users can attach or paste reference photos of decks they like using the camera button or by pasting an image from the web. When a user's description is vague or you are unsure what layout they want (e.g. "I want something fancy" or "make it look like my neighbor's"), suggest they share a reference photo: "If you have a photo of a deck you like, you can paste it or click the camera icon to share it, and I'll match the settings for you." Do not ask for photos unprompted on every message; only suggest when it would genuinely help resolve ambiguity."""


# ============================================================
# AI INSIGHT GENERATION (S55 - Auto-batch with Opus)
# ============================================================

async def _generate_insight_async():
    """Background task: analyze recent conversations + events with Opus."""
    import httpx
    try:
        conversations = get_conversations_for_insight()
        if not conversations:
            return
        event_summary = get_event_summary_for_insight()

        # Group conversations by session
        sessions = {}
        for c in conversations:
            sid = c["session_id"]
            if sid not in sessions:
                sessions[sid] = []
            sessions[sid].append(c)

        # Build conversation summaries (truncate to fit context)
        conv_text = ""
        for sid, msgs in list(sessions.items())[:30]:
            conv_text += f"\n--- Session {sid[:12]} ---\n"
            for m in msgs:
                role = "USER" if m["role"] == "user" else "AI"
                classify = f" [{m.get('classify','')}]" if m.get("classify") else ""
                conv_text += f"{role}{classify}: {(m['message'] or '')[:300]}\n"

        prompt = f"""You are a product analyst for SimpleBlueprints, a web app that generates permit-ready deck blueprint PDFs.

Analyze these recent AI helper conversations and usage data. Extract actionable product insights.

CONVERSATIONS ({len(conversations)} messages across {len(sessions)} sessions):
{conv_text[:12000]}

EVENT STATS (since last analysis):
{json.dumps(event_summary, indent=2, default=str)[:3000]}

Respond with ONLY valid JSON (no markdown, no code fences) in this exact structure:
{{
  "feature_requests": ["list of features users asked for that don't exist yet"],
  "pain_points": ["specific frustrations or confusion patterns observed"],
  "product_issues": ["bugs, UX problems, or things that aren't working as expected"],
  "usage_patterns": ["interesting patterns in how people use the product"],
  "recommendations": ["your top 3-5 actionable recommendations for the product team"]
}}

Be specific and cite actual user messages where relevant. Each item should be a concrete, actionable string, not vague. If a category has no items, use an empty array."""

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                json={
                    "model": "claude-opus-4-20250514",
                    "max_tokens": 2000,
                    "temperature": 0,
                    "messages": [{"role": "user", "content": prompt}],
                },
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01"
                },
                timeout=60.0
            )
            if resp.status_code != 200:
                print(f"Insight generation API error: {resp.status_code} {resp.text[:200]}")
                return

            data = resp.json()
            raw_text = data["content"][0]["text"].strip()

            # Parse JSON (strip code fences if present)
            clean = raw_text
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()

            try:
                analysis = json.loads(clean)
            except json.JSONDecodeError:
                print(f"Insight JSON parse error: {clean[:500]}")
                analysis = {}

            save_insight({
                "conversation_count": len(conversations),
                "event_summary": event_summary,
                "feature_requests": analysis.get("feature_requests", []),
                "pain_points": analysis.get("pain_points", []),
                "product_issues": analysis.get("product_issues", []),
                "usage_patterns": analysis.get("usage_patterns", []),
                "recommendations": analysis.get("recommendations", []),
                "raw_analysis": raw_text,
                "trigger_type": "auto_50" if len(conversations) >= 50 else "auto_weekly",
            })
            print(f"Insight generated: {len(conversations)} convos analyzed, {len(analysis.get('recommendations', []))} recommendations")

    except Exception as e:
        print(f"Insight generation error: {e}")


@app.post("/api/ai-helper")
async def ai_helper(request: Request):
    """AI-powered conversational guide assistant with streaming."""
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="AI helper not configured")

    try:
        body = await request.json()
        user_message = body.get("message", "").strip()
        step = body.get("step", 0)
        params = body.get("params", {})
        history = body.get("history", [])
        extraction_summary = body.get("extractionSummary", "")
        guide_phase = body.get("guidePhase", "")
        compare_context = body.get("compareContext", "")

        # S56: Reference image support
        image_data = body.get("image")
        has_image = bool(image_data and image_data.get("b64"))

        if not user_message:
            return {"ok": False, "error": "No message provided"}

        # S55: Log user message to ai_conversations
        session_id = body.get("sessionId", "")
        anonymous_id = body.get("anonymousId", "")
        log_ai_message({
            "user_id": user_id,
            "anonymous_id": anonymous_id,
            "session_id": session_id,
            "step": step,
            "guide_phase": guide_phase,
            "role": "user",
            "message": user_message,
        })

        system_prompt = build_ai_helper_prompt(step, params, extraction_summary, guide_phase, compare_context)

        # S62: Inject structural calc + permit check context
        try:
            _ai_params = dict(params)
            _ai_params["width"] = max(8, min(50, _ai_params.get("width", 20)))
            _ai_params["depth"] = max(6, min(24, _ai_params.get("depth", 12)))
            _ai_params["height"] = max(1, min(14, _ai_params.get("height", 4)))
            _ai_calc = calculate_structure(_ai_params)
            calc_context = f"""
CURRENT STRUCTURAL CALCULATIONS (auto-computed from IRC 2021):
- Joists: {_ai_calc.get('joist_size', '?')} @ {_ai_calc.get('sp', '?')}" spacing
- Beam: {_ai_calc.get('beam_size', '?')} ({_ai_calc.get('beamType', 'dropped')})
- Posts: {_ai_calc.get('post_size', '?')} x {_ai_calc.get('nP', '?')}
- Footings: {_ai_calc.get('footing_diam', '?')}" diameter x {_ai_calc.get('nF', '?')}
- Design load: {_ai_calc.get('TL', '?')} PSF (LL={_ai_calc.get('LL', '?')}, DL={_ai_calc.get('DL', '?')})
- Guard height: {_ai_calc.get('rail_height', 36)}"
- Deck area: {_ai_calc.get('area', '?')} SF
"""
            if _ai_calc.get('engineering_required'):
                calc_context += f"- WARNING: Joist span exceeds IRC prescriptive max. Engineering may be required.\n"
            if _ai_calc.get('warnings'):
                calc_context += "- Warnings: " + "; ".join(_ai_calc['warnings']) + "\n"
            system_prompt += calc_context

            # Permit pre-check
            _ai_spec = build_permit_spec(_ai_params, _ai_calc)
            _ai_report = run_checks("deck", _ai_params, _ai_calc, _ai_spec)
            fail_checks = [c for c in _ai_report.checks if c.status == "fail"]
            gap_checks = _ai_report.capability_gaps
            permit_context = f"""
PERMIT PRE-CHECK ({_ai_report.passed}/{_ai_report.total_applicable} checks passed):
"""
            if not fail_checks and not gap_checks:
                permit_context += "All automated checks passed. No structural or drawing issues detected.\n"
            if fail_checks:
                permit_context += "ISSUES that could cause permit rejection:\n"
                for fc in fail_checks:
                    permit_context += f"- {fc.message}"
                    if fc.fix:
                        permit_context += f" (fix: {fc.fix})"
                    permit_context += "\n"
            if gap_checks:
                permit_context += "ADVISORIES (drawing limitations we have not yet addressed):\n"
                for gc in gap_checks:
                    permit_context += f"- {gc.message}\n"
            permit_context += "\nREMINDER: These are automated pre-checks based on IRC 2021. They do not guarantee permit approval. Always direct the user to verify requirements with their local building department.\n"
            system_prompt += permit_context
        except Exception as e:
            print(f"AI helper calc/permit context error: {e}")

        # S56: Add image analysis instructions when image is present
        if has_image:
            system_prompt += """

REFERENCE IMAGE ANALYSIS:
The user has shared a reference photo. Analyze it carefully and map what you see to settable parameters and actions. Look for:
- Deck shape/layout: rectangular (just set width/depth), L-shaped (use zoneAdd on one edge), wraparound (use zoneAdd on two edges, e.g. left and right)
- Approximate proportions: estimate width vs depth ratio for main deck and any extensions
- Stair configuration: straight, L-turn (stairTemplate="lLeft" or "lRight"), switchback/U-turn (stairTemplate="switchback"), wrap (stairTemplate="wrapAround"), wide landing (stairTemplate="wideLanding"). Also set stairLocation ("front", "left", "right") based on where stairs exit.
- Railing style: metal/iron (use railType="fortress") or wood (railType="wood")
- Decking material: composite (uniform color, no grain) or pressure-treated wood (visible grain, knots)
- Attachment: ledger (flush against house) or freestanding (gap/posts near house)
- Corner modifications: angled/chamfered corners use chamferSet action. Corners are BL (back-left), BR (back-right), FL (front-left), FR (front-right). Estimate size in feet.
- Cutouts/notches: use cutoutAdd action if the deck has sections removed (around trees, posts, etc.)
- Height: estimate from stair count (each step is ~7.5 inches)

ACTION MAPPING for complex shapes:
- L-shaped deck: Set main deck width/depth, then use zoneAdd on the side edge for the extension.
- Wraparound deck: Set main deck width/depth (the section along the house), then zoneAdd on "left" and/or "right" edges.
- Angled corners: Use chamferSet for each visible angled corner.
- Notched deck: Use cutoutAdd for each visible notch/cutout.

Set as many parameters as you can confidently identify. Be honest about what you cannot determine from the photo. If the photo shows features not yet supported (pergola, built-in seating, planters, multi-level/split-level, hot tub, curved edges), acknowledge them and explain they are not yet available.

Describe what you see FIRST in your response text (so the description stays in chat history for future turns), then set the params via ACTIONS."""

        messages = []
        for h in history[-6:]:
            messages.append({"role": h["role"], "content": h["text"]})

        # S56: Build multimodal user content when image is present
        if has_image:
            user_content = [
                {"type": "image", "source": {"type": "base64", "media_type": image_data.get("mediaType", "image/jpeg"), "data": image_data["b64"]}},
                {"type": "text", "text": user_message}
            ]
            messages.append({"role": "user", "content": user_content})
        else:
            messages.append({"role": "user", "content": user_message})

        payload = {
            "model": "claude-opus-4-20250514" if has_image else "claude-sonnet-4-6",
            "max_tokens": 600 if has_image else 400,
            "temperature": 0.3,
            "system": system_prompt,
            "messages": messages,
            "stream": True
        }

    except Exception as e:
        return {"ok": False, "error": str(e)}

    async def generate():
        import httpx
        full_text = ""
        try:
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    "https://api.anthropic.com/v1/messages",
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "x-api-key": ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01"
                    },
                    timeout=30.0
                ) as resp:
                    buf = ""
                    async for chunk in resp.aiter_text():
                        buf += chunk
                        while "\n" in buf:
                            line, buf = buf.split("\n", 1)
                            line = line.strip()
                            if not line or not line.startswith("data: "):
                                continue
                            data_str = line[6:]
                            if data_str == "[DONE]":
                                continue
                            try:
                                evt = json.loads(data_str)
                                if evt.get("type") == "content_block_delta":
                                    delta = evt.get("delta", {})
                                    if delta.get("type") == "text_delta":
                                        token = delta.get("text", "")
                                        full_text += token
                                        yield f"data: {json.dumps({'t': token})}\n\n"
                            except json.JSONDecodeError:
                                pass
        except Exception as e:
            print(f"AI helper stream error: {e}")
            yield f"data: {json.dumps({'t': f' (Error: {str(e)[:100]})'})}\n\n"

        # Parse ACTIONS from the complete text
        actions = []
        message = full_text.strip()
        lines = message.split("\n")
        if lines and lines[-1].strip().startswith("ACTIONS:"):
            actions_str = lines[-1].strip()[8:]
            message = "\n".join(lines[:-1]).strip()
            try:
                actions = json.loads(actions_str)
            except json.JSONDecodeError:
                print(f"AI helper actions parse error: {actions_str[:200]}")

        # S55: Extract classify tag from actions (don't send to frontend)
        classify_tag = ""
        frontend_actions = []
        for a in actions:
            if isinstance(a, dict) and "classify" in a:
                classify_tag = a["classify"]
            else:
                frontend_actions.append(a)

        yield f"data: {json.dumps({'d': True, 'msg': message, 'actions': frontend_actions})}\n\n"

        # S55: Log assistant response to ai_conversations
        try:
            log_ai_message({
                "user_id": user_id,
                "anonymous_id": anonymous_id,
                "session_id": session_id,
                "step": step,
                "guide_phase": guide_phase,
                "role": "assistant",
                "message": message,
                "actions": frontend_actions if frontend_actions else None,
                "action_count": len(frontend_actions),
                "cost_cents": 1.0,
                "classify": classify_tag,
            })
        except Exception as log_err:
            print(f"AI conv log error: {log_err}")

        # S55: Check if we should auto-generate an insight report
        try:
            if should_generate_insight():
                import asyncio
                asyncio.get_event_loop().create_task(_generate_insight_async())
        except Exception as insight_err:
            print(f"Insight trigger check error: {insight_err}")

    from starlette.responses import StreamingResponse
    return StreamingResponse(generate(), media_type="text/event-stream")


# S58: Pre-generation permit readiness check
@app.post("/api/check-permit")
async def check_permit(request: Request):
    """Run permit checks without generating PDF. Fast (~50ms)."""
    try:
        body = await request.body()
        params = DeckParams(**json.loads(body))
    except (json.JSONDecodeError, Exception) as e:
        raise HTTPException(status_code=400, detail=str(e))
    p = params.dict()
    # Run the same clamps as generate_blueprint_pdf
    p["width"] = max(8, min(50, p.get("width", 20)))
    p["depth"] = max(6, min(24, p.get("depth", 12)))
    p["height"] = max(1, min(14, p.get("height", 4)))
    calc = calculate_structure(p)
    spec = build_permit_spec(p, calc)
    report = run_checks("deck", p, calc, spec)
    return {"permit_report": report_to_dict(report), "calc_summary": {
        "joist_size": calc["joist_size"], "beam_size": calc["beam_size"],
        "post_size": calc["post_size"], "footing_diam": calc["footing_diam"],
        "guard_height": calc["rail_height"], "TL": calc["TL"],
    }}


@app.post("/api/generate-test")
async def generate_test(request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required")
    try:
        body = await request.body()
        if len(body) > 20*1024*1024: raise HTTPException(status_code=413)
        params = DeckParams(**json.loads(body))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    permit_id, materials_id, calc, permit_report = generate_blueprint_pdf(params.dict())
    gen_id = None
    try: gen_id = db_log_generation(user_id, params.dict(), calc, permit_id)
    except Exception as e: print(f"Log error: {e}")
    # S62: Update project status if project_id provided
    try:
        raw = json.loads(body)
        proj_id = raw.get("project_id")
        if proj_id and gen_id:
            update_project(proj_id, user_id, status="generated", last_generation_id=gen_id)
    except Exception as e:
        print(f"Project link error: {e}")
    return {"file_id": permit_id, "download_url": f"/api/download/{permit_id}",
            "materials_id": materials_id, "materials_url": f"/api/download/{materials_id}",
            "calc": calc,
            "permit_report": report_to_dict(permit_report)}

@app.get("/api/download/{file_id}")
async def download(file_id: str, type: str = "permit"):
    safe_id = file_id.replace("/","").replace("..","")
    path = PDF_DIR / f"{safe_id}.pdf"
    if not path.exists(): raise HTTPException(status_code=404)
    fname = f"SimpleBlueprints-Materials-{safe_id[:8]}.pdf" if type == "materials" else f"SimpleBlueprints-Permit-Plans-{safe_id[:8]}.pdf"
    return FileResponse(str(path), media_type="application/pdf", filename=fname,
                        headers={"Cache-Control": "no-store"})

@app.post("/api/checkout")
async def checkout(params: DeckParams):
    if not STRIPE_SECRET: raise HTTPException(status_code=500, detail="Stripe not configured")
    pd = params.dict(); pd.pop("coverImage",None); pd.pop("sitePlanFile",None)
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price_data":{"currency":"usd","product_data":{"name":"Permit-Ready Deck Blueprint PDF"},"unit_amount":BLUEPRINT_PRICE},"quantity":1}],
        mode="payment",
        success_url=f"{SITE_URL}?session_id={{CHECKOUT_SESSION_ID}}&status=paid",
        cancel_url=f"{SITE_URL}?status=cancelled",
        metadata={"deck_params": json.dumps(pd)})
    return {"checkout_url": session.url}

@app.get("/api/check-payment")
async def check_payment(session_id: str):
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if session.payment_status == "paid":
            pj = session.metadata.get("deck_params")
            if pj:
                permit_id, materials_id, calc, _report = generate_blueprint_pdf(json.loads(pj))
                return {"status":"paid","download_url":f"/api/download/{permit_id}",
                        "materials_url":f"/api/download/{materials_id}","calc":calc}
        return {"status":"pending"}
    except Exception as e: return {"status":"error","message":str(e)}


# ============================================================
# PROJECT PERSISTENCE (S62)
# ============================================================

@app.get("/api/projects")
async def api_list_projects(request: Request):
    """List all projects for current user (summary, no survey blob)."""
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required")
    projects = list_projects(user_id)
    # Extract summary info from params_json for display
    result = []
    for proj in projects:
        summary = {
            "id": proj["id"],
            "name": proj["name"],
            "status": proj["status"],
            "step": proj["step"],
            "created_at": str(proj["created_at"]),
            "updated_at": str(proj["updated_at"]),
            "last_generation_id": proj["last_generation_id"],
        }
        # Pull deck dims from params for card display
        if proj.get("params_json"):
            try:
                pp = json.loads(proj["params_json"])
                summary["deck_width"] = pp.get("width")
                summary["deck_depth"] = pp.get("depth")
                summary["deck_height"] = pp.get("height")
                summary["attachment"] = pp.get("attachment")
            except Exception:
                pass
        # Pull address from info for card display
        if proj.get("info_json"):
            try:
                ii = json.loads(proj["info_json"])
                summary["address"] = ii.get("address", "")
            except Exception:
                pass
        result.append(summary)
    return {"projects": result}


@app.post("/api/projects")
async def api_create_project(request: Request):
    """Create a new project."""
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required")
    body = await request.json()
    name = body.get("name", "Untitled Deck")
    proj = create_project(
        user_id=user_id,
        name=name,
        params_json=body.get("params_json"),
        info_json=body.get("info_json"),
        step=body.get("step", 0),
        site_plan_mode=body.get("site_plan_mode", "generate"),
        survey_b64=body.get("survey_b64"),
    )
    return {"project": {"id": proj["id"], "name": proj["name"], "status": proj["status"],
                        "created_at": str(proj["created_at"])}}


@app.get("/api/projects/{project_id}")
async def api_get_project(project_id: int, request: Request):
    """Get full project including survey blob."""
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required")
    proj = get_project(project_id, user_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project": {
        "id": proj["id"], "name": proj["name"], "status": proj["status"],
        "step": proj["step"], "site_plan_mode": proj["site_plan_mode"],
        "params_json": proj["params_json"], "info_json": proj["info_json"],
        "survey_b64": proj["survey_b64"],
        "last_generation_id": proj["last_generation_id"],
        "created_at": str(proj["created_at"]),
        "updated_at": str(proj["updated_at"]),
    }}


@app.put("/api/projects/{project_id}")
async def api_update_project(project_id: int, request: Request):
    """Update project (auto-save). Only sends changed fields."""
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required")
    body = await request.json()
    # Whitelist fields the client can update
    fields = {}
    for k in ["name", "status", "params_json", "info_json", "step",
              "site_plan_mode", "survey_b64", "last_generation_id"]:
        if k in body:
            fields[k] = body[k]
    proj = update_project(project_id, user_id, **fields)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True, "updated_at": str(proj["updated_at"])}


@app.delete("/api/projects/{project_id}")
async def api_delete_project(project_id: int, request: Request):
    """Delete a project."""
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required")
    deleted = delete_project(project_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


# ============================================================
# PARCEL LOOKUP (S63)
# ============================================================

import math as _math

def _coords_to_feet(coords_raw):
    """Convert GeoJSON lat/lng polygon to local feet coordinates (SW corner origin)."""
    if not coords_raw or len(coords_raw) < 3:
        return None, None, None
    lats = [c[1] for c in coords_raw]
    lngs = [c[0] for c in coords_raw]
    min_lat, min_lng = min(lats), min(lngs)
    ft_per_deg_lat = 364000.0
    ft_per_deg_lng = 364000.0 * _math.cos(_math.radians(min_lat))
    vertices_ft = []
    for lng, lat in coords_raw:
        x = (lng - min_lng) * ft_per_deg_lng
        y = (lat - min_lat) * ft_per_deg_lat
        vertices_ft.append([round(x, 1), round(y, 1)])
    if len(vertices_ft) > 1 and vertices_ft[0] == vertices_ft[-1]:
        vertices_ft = vertices_ft[:-1]
    return vertices_ft, min_lat, min_lng


def _estimate_house_dims(bldg_sqft, lot_width, lot_depth):
    """Estimate house width/depth from building sqft."""
    if not bldg_sqft or bldg_sqft <= 0:
        return None, None
    lot_area = lot_width * lot_depth
    footprint = bldg_sqft
    if lot_area > 0 and bldg_sqft > lot_area * 0.4:
        footprint = bldg_sqft / 2.0
    house_depth = round(_math.sqrt(footprint / 1.3), 1)
    house_width = round(house_depth * 1.3, 1)
    return house_width, house_depth


def _realie_lookup(address: str, state: str, city: str = "", zip_code: str = ""):
    """Call Realie API address lookup, return parsed parcel data."""
    api_key = os.environ.get("REALIE_API_KEY", "")
    if not api_key:
        return {"error": "Parcel lookup not configured (REALIE_API_KEY missing)"}

    params = {"state": state, "address": address}
    # Note: Realie requires county when city is provided, so we omit city
    # and let Realie resolve from address + state alone
    qs = urllib.parse.urlencode(params)
    url = f"https://app.realie.ai/api/public/property/address/?{qs}"

    try:
        req = urllib.request.Request(url, headers={
            "Authorization": api_key,
            "Accept": "application/json",
            "User-Agent": "SimpleBlueprints/1.0"
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode()
            data = json.loads(raw)
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode()
        except Exception:
            pass
        return {"error": f"Realie API HTTP {e.code}: {body[:500]}"}
    except Exception as e:
        return {"error": f"Realie API error: {str(e)}"}

    prop = data.get("property", {})
    if not prop:
        keys = list(data.keys()) if isinstance(data, dict) else str(type(data))
        return {"error": "No parcel found for this address", "debug_keys": keys, "debug_snippet": str(raw)[:1000]}

    # Extract geometry
    geom = prop.get("geometry", {})
    coords_raw = []
    if geom.get("type") == "Polygon":
        coords_raw = geom.get("coordinates", [[]])[0]
    elif geom.get("type") == "MultiPolygon":
        polys = geom.get("coordinates", [])
        if polys:
            largest = max(polys, key=lambda p: len(p[0]) if p else 0)
            coords_raw = largest[0] if largest else []

    vertices_ft, min_lat, min_lng = _coords_to_feet(coords_raw)
    if not vertices_ft:
        return {"error": "No polygon geometry found in parcel data", "debug_snippet": str(raw)[:1000]}

    xs = [v[0] for v in vertices_ft]
    ys = [v[1] for v in vertices_ft]
    lot_width = round(max(xs) - min(xs), 1)
    lot_depth = round(max(ys) - min(ys), 1)

    # Realie may provide lot dims directly
    realie_frontage = prop.get("frontage")
    realie_depth = prop.get("depthSize")
    if realie_frontage:
        try:
            v = float(realie_frontage)
            if v > 0:
                lot_width = v
        except (ValueError, TypeError):
            pass
    if realie_depth:
        try:
            v = float(realie_depth)
            if v > 0:
                lot_depth = v
        except (ValueError, TypeError):
            pass

    # Building info
    bldg_sqft = None
    for key in ["buildingArea", "livingArea", "totalArea"]:
        val = prop.get(key)
        if val:
            try:
                v = float(val)
                if v > 0:
                    bldg_sqft = v
                    break
            except (ValueError, TypeError):
                pass

    house_width, house_depth = _estimate_house_dims(bldg_sqft, lot_width, lot_depth)

    lot_area_sqft = 0
    for key in ["landArea", "lotSize"]:
        val = prop.get(key)
        if val:
            try:
                v = float(val)
                if v > 0:
                    lot_area_sqft = v
                    break
            except (ValueError, TypeError):
                pass
    if not lot_area_sqft:
        lot_area_sqft = round(lot_width * lot_depth, 0)

    acres = 0
    try:
        acres = float(prop.get("acres") or 0)
    except (ValueError, TypeError):
        pass
    if not acres:
        acres = lot_area_sqft / 43560.0

    result = {
        "ok": True,
        "lot": {
            "vertices": vertices_ft,
            "width": lot_width,
            "depth": lot_depth,
            "area_sqft": lot_area_sqft,
            "acres": round(acres, 3),
        },
        "building": {
            "sqft": bldg_sqft,
            "estimated_width": house_width,
            "estimated_depth": house_depth,
            "year_built": prop.get("yearBuilt") or None,
        },
        "location": {
            "lat": float(prop.get("latitude") or min_lat or 0),
            "lng": float(prop.get("longitude") or min_lng or 0),
            "address": prop.get("fullAddress") or prop.get("address") or address,
            "city": prop.get("city") or city,
            "state": prop.get("state") or state,
            "zip": prop.get("zip") or zip_code,
            "county": prop.get("county") or "",
        },
        "parcel": {
            "id": prop.get("parcelId") or prop.get("apn") or "",
            "zoning": prop.get("zoningCode") or "",
            "owner": prop.get("ownerName") or "",
        },
        "raw_coords": coords_raw,
    }
    return result


@app.post("/api/parcel-lookup")
async def parcel_lookup(request: Request):
    """Look up parcel data by address using Realie API."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    address = body.get("address", "").strip()
    state = body.get("state", "").strip()
    city = body.get("city", "").strip()
    zip_code = body.get("zip", "").strip()

    if not address:
        raise HTTPException(status_code=400, detail="Address is required")
    if not state:
        raise HTTPException(status_code=400, detail="State is required")

    result = _realie_lookup(address, state, city, zip_code)
    if "error" in result:
        return JSONResponse(result, status_code=404 if "No parcel" in result.get("error", "") else 200)

    return JSONResponse(result)


# ============================================================
# EVENT TRACKING (S55)
# ============================================================

@app.post("/api/track")
async def track_event(request: Request):
    """Fire-and-forget single event tracking."""
    try:
        body = await request.json()
        user_id = get_current_user_id(request)
        event = {
            "user_id": user_id,
            "anonymous_id": body.get("anonymous_id"),
            "session_id": body.get("session_id", ""),
            "event_type": body.get("event_type", "unknown"),
            "event_data": body.get("event_data", {}),
            "step": body.get("step"),
            "guide_phase": body.get("guide_phase"),
        }
        log_event(event)
        return {"ok": True}
    except Exception as e:
        print(f"Track error: {e}")
        return {"ok": False}


@app.post("/api/track-batch")
async def track_events_batch(request: Request):
    """Batch event tracking (queue flush)."""
    try:
        body = await request.json()
        user_id = get_current_user_id(request)
        events = body.get("events", [])
        for evt in events:
            evt["user_id"] = user_id
        log_events_batch(events)
        return {"ok": True, "count": len(events)}
    except Exception as e:
        print(f"Batch track error: {e}")
        return {"ok": False}


@app.post("/api/track-link")
async def track_link_anonymous(request: Request):
    """Link anonymous_id to user_id on login."""
    try:
        body = await request.json()
        user_id = get_current_user_id(request)
        anon_id = body.get("anonymous_id")
        if user_id and anon_id:
            link_anonymous_to_user(anon_id, user_id)
        return {"ok": True}
    except Exception as e:
        print(f"Link error: {e}")
        return {"ok": False}


# ============================================================
# FEEDBACK
# ============================================================
@app.post("/api/feedback")
async def submit_feedback(request: Request):
    """Collect user feedback before PDF generation (production domain only)."""
    try:
        body = await request.json()
        feedback_data = {
            "role": body.get("role", ""),
            "source": body.get("source", ""),
            "price": body.get("price", ""),
            "feedback": body.get("feedback", ""),
            "email": body.get("email", ""),
        }
        user_id = get_current_user_id(request)
        if user_id:
            feedback_data["user_id"] = user_id
        # Store feedback - try database first, fall back to file
        try:
            from app.database import store_feedback
            store_feedback(feedback_data)
        except Exception as db_err:
            print(f"DB feedback error: {db_err}")
            feedback_path = Path("/tmp/feedback.jsonl")
            with open(feedback_path, "a") as f:
                f.write(json.dumps({**feedback_data, "timestamp": time.time()}) + "\n")
        return {"ok": True}
    except Exception as e:
        print(f"Feedback error: {e}")
        return {"ok": False, "error": str(e)}


# ============================================================
# ADMIN
# ============================================================

def _check_admin(request: Request):
    """Verify admin password from header. Raises 401 if wrong."""
    if not ADMIN_PASSWORD:
        return  # No password set = open access (dev mode)
    pw = request.headers.get("X-Admin-Password", "")
    if pw != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin password")


@app.post("/api/admin/login")
async def admin_login(request: Request):
    """Validate admin password."""
    body = await request.json()
    pw = body.get("password", "")
    if not ADMIN_PASSWORD:
        return {"ok": True}  # No password set = open
    if pw == ADMIN_PASSWORD:
        return {"ok": True}
    raise HTTPException(status_code=401, detail="Invalid password")


@app.get("/admin")
async def admin():
    """Serve admin dashboard from static file (S55: moved out of inline HTML)."""
    admin_path = Path(__file__).parent.parent / "static" / "admin.html"
    if admin_path.exists():
        return FileResponse(str(admin_path), media_type="text/html")
    return HTMLResponse(content="<h1>Admin dashboard not found</h1>", status_code=404)

@app.get("/admin/api/stats")
async def admin_stats(request: Request):
    _check_admin(request)
    return get_stats()

@app.get("/admin/api/tracking")
async def admin_tracking(request: Request, days: int = 30):
    """S55: Tracking stats for new admin dashboard."""
    _check_admin(request)
    return get_tracking_stats(min(days, 90))

@app.get("/admin/api/users/csv")
async def admin_csv(request: Request):
    _check_admin(request)
    users = get_all_users()
    csv = "email,name,opted_in,created,last_login\n"
    for u in users:
        csv += f'{u["email"]},{u.get("name","")},{u["email_opt_in"]},{u["created_at"]},{u["last_login"]}\n'
    return Response(content=csv, media_type="text/csv", headers={"Content-Disposition":"attachment; filename=simpleblueprints-users.csv"})


# S58: Plan quality matrix endpoint
@app.get("/admin/api/plan-quality")
async def admin_plan_quality(request: Request):
    """Run test matrix and return readiness results for all configurations."""
    _check_admin(request)
    from drawing.permit_checker import run_test_matrix, report_to_dict
    results = run_test_matrix()
    return {
        "configs": [
            {
                "name": name,
                "overall_status": report.overall_status,
                "readiness_pct": report.readiness_pct,
                "passed": report.passed,
                "total": report.total_applicable,
                "failed": report.failed,
                "warnings": report.warnings,
                "gaps": len(report.capability_gaps),
                "failing_checks": [
                    {"id": c.id, "message": c.message, "severity": c.severity}
                    for c in report.checks
                    if c.status in ("fail", "unsupported")
                ],
            }
            for name, report in results
        ]
    }


# S62: Project location analytics
@app.get("/admin/api/locations")
async def admin_locations(request: Request):
    """Geographic breakdown of where users are building decks."""
    _check_admin(request)
    return get_project_locations()


@app.get("/admin/api/generate-test-suite")
async def admin_generate_test_suite(request: Request):
    """Generate PDFs for all test matrix configs, return as zip with manifest."""
    _check_admin(request)
    from drawing.permit_checker import TEST_MATRIX, run_checks, report_to_dict, get_compliance_summary
    from drawing.calc_engine import calculate_structure
    from drawing.permit_spec import build_permit_spec

    zip_buf = io.BytesIO()
    manifest_lines = []
    manifest_lines.append("SimpleBlueprints PDF Test Suite")
    manifest_lines.append(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    manifest_lines.append(f"Configs: {len(TEST_MATRIX)}")
    manifest_lines.append("=" * 70)

    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, config in enumerate(TEST_MATRIX):
            name = config["name"]
            tests_for = config.get("tests_for", "")
            params = dict(config["params"])  # copy so generate_blueprint_pdf clamps don't mutate

            t0 = time.time()
            try:
                permit_id, materials_id, calc, permit_report = generate_blueprint_pdf(params)
                elapsed = time.time() - t0

                # Add permit PDF to zip
                permit_path = PDF_DIR / f"{permit_id}.pdf"
                safe_name = name.replace(" ", "_").replace("(", "").replace(")", "").replace(",", "").replace("/", "-")
                zf.write(str(permit_path), f"{safe_name}_permit.pdf")

                # Add materials PDF to zip
                materials_path = PDF_DIR / f"{materials_id}.pdf"
                zf.write(str(materials_path), f"{safe_name}_materials.pdf")

                # Clean up temp files
                try:
                    permit_path.unlink()
                    materials_path.unlink()
                except:
                    pass

                # Build manifest entry
                manifest_lines.append("")
                manifest_lines.append(f"CONFIG {name}")
                manifest_lines.append(f"  Tests for: {tests_for}")
                manifest_lines.append(f"  Generated in: {elapsed:.1f}s")
                manifest_lines.append(f"  Checker: {permit_report.overall_status} "
                                      f"({permit_report.passed}/{permit_report.total_applicable} passed)")
                manifest_lines.append(f"  Calc: joist={calc['joist_size']} beam={calc['beam_size']} "
                                      f"post={calc['post_size']} footing={calc['footing_diam']}in "
                                      f"guard={calc['rail_height']}in TL={calc['TL']}psf")
                # Log all params
                manifest_lines.append(f"  Params:")
                for k, v in sorted(config["params"].items()):
                    manifest_lines.append(f"    {k}: {v}")
                # Log failing checks
                failing = [c for c in permit_report.checks if c.status in ("fail", "unsupported")]
                if failing:
                    manifest_lines.append(f"  Failing checks:")
                    for c in failing:
                        manifest_lines.append(f"    [{c.severity}] {c.id}: {c.message}")

            except Exception as e:
                elapsed = time.time() - t0
                manifest_lines.append("")
                manifest_lines.append(f"CONFIG {name}")
                manifest_lines.append(f"  GENERATION FAILED: {str(e)}")
                manifest_lines.append(f"  Failed after: {elapsed:.1f}s")

        # Add manifest to zip
        zf.writestr("manifest.txt", "\n".join(manifest_lines))

    zip_buf.seek(0)
    from starlette.responses import StreamingResponse
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=SB_TestSuite_{time.strftime('%Y%m%d_%H%M%S')}.zip",
            "Cache-Control": "no-store",
        },
    )


# ============================================================
# SERVE FRONTEND
# ============================================================
from pathlib import Path as _Path
_STATIC_DIR = _Path(__file__).parent.parent / "static"

@app.get("/")
async def root(request: Request):
    index_path = _STATIC_DIR / "index.html"
    if index_path.exists():
        try:
            ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
            ip_hash = hashlib.sha256(f"sb:{ip}".encode()).hexdigest()[:16]
            db_log_page_view(ip_hash, "/", request.headers.get("user-agent", "")[:200])
        except: pass
        return FileResponse(str(index_path), media_type="text/html")
    return {"message": "SimpleBlueprints API is running"}

# /js/ mount removed S26   all JS now served via /static/js/ (S25 mount)
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static-all")
