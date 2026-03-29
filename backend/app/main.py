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
    get_stats
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
    frostZone: str = "cold"; deckOffset: float = 0; stairOffset: float = 0
    lotWidth: float = 80; lotDepth: float = 120
    lotVertices: Optional[list] = None
    lotEdges: Optional[list] = None
    lotArea: Optional[float] = None
    setbackFront: float = 25; setbackSide: float = 5
    setbackRear: float = 20; houseOffsetSide: float = 20
    overJoist: Optional[str] = None; overBeam: Optional[str] = None
    overPostSize: Optional[str] = None; overPostCount: Optional[int] = None
    overFooting: Optional[int] = None
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
def generate_blueprint_pdf(params: dict) -> tuple[str, str, dict]:
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
        draw_cover_sheet(fig0, params, calc, pi, cover_img)
        pdf.savefig(fig0, dpi=200); plt.close(fig0)

        for sheet_num, sheet_name, draw_fn in permit_sheets:
            fig = plt.figure(figsize=(14, 8.5)); fig.set_facecolor('white')
            draw_fn(fig, params, calc)
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

    return permit_id, materials_id, calc


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

        import urllib.request, urllib.error
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

CANDIDATE SHAPES (vertex coordinates, clockwise from street-side SW corner):
{shapes_text}

TASKS:
1. SHAPE MATCHING: Look at the lot boundary drawn on this survey page. Which candidate shape best matches the drawn boundary? Consider the proportions, angles, and overall outline. Give the 0-based index of the best match.

2. CONFIDENCE: How confident are you? "high" if one shape clearly matches, "medium" if 2-3 are close, "low" if hard to tell.

3. NORTH DIRECTION: Look for a north arrow or compass rose on this survey. Which direction does the north arrow point on the drawing? Use cardinal values: 0=up, 45=upper-right, 90=right, 135=lower-right, 180=down, 225=lower-left, 270=left, 315=upper-left.

4. STREET SIDE: Which side of the DRAWING is the street on? One of: "bottom", "top", "left", "right". This tells us how the survey is oriented visually.

Return ONLY a JSON object:
{
  "bestShapeIndex": 0,
  "confidence": "high",
  "northAngle": 0,
  "streetSide": "bottom",
  "reason": "brief explanation of why this shape matches"
}

Return ONLY valid JSON, no markdown, no backticks."""


def get_site_plan_page(pdf_b64):
    """Extract just the site plan page from a PDF as a single-page PDF."""
    import fitz, io
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

        if not survey_b64 or not candidates:
            return {"ok": False, "error": "Missing survey data or candidates"}

        # Build shapes description for prompt
        shapes_lines = []
        for i, c in enumerate(candidates):
            verts = c.get("vertices", [])
            area = c.get("area", 0)
            edges = c.get("edges", [])
            edge_desc = ", ".join([f"{e['length']}' ({e.get('label') or e.get('neighborLabel') or e['type']})" for e in edges])
            shapes_lines.append(f"Shape {i}: area={area} SF, edges=[{edge_desc}]")
        shapes_text = "\n".join(shapes_lines)

        # Get just the site plan page
        if file_type == "pdf":
            site_b64 = get_site_plan_page(survey_b64)
            doc_block = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": site_b64}}
        else:
            media_type = "image/png" if survey_b64[:4] == "iVBO" else "image/jpeg"
            doc_block = {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": survey_b64}}

        prompt = SHAPE_RANK_PROMPT.replace("{shapes_text}", shapes_text)

        payload = {
            "model": "claude-opus-4-6",
            "max_tokens": 1024,
            "temperature": 0,
            "messages": [{"role": "user", "content": [doc_block, {"type": "text", "text": prompt}]}]
        }

        import urllib.request, urllib.error
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
    permit_id, materials_id, calc = generate_blueprint_pdf(params.dict())
    try: db_log_generation(user_id, params.dict(), calc, permit_id)
    except Exception as e: print(f"Log error: {e}")
    return {"file_id": permit_id, "download_url": f"/api/download/{permit_id}",
            "materials_id": materials_id, "materials_url": f"/api/download/{materials_id}",
            "calc": calc}

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
                permit_id, materials_id, calc = generate_blueprint_pdf(json.loads(pj))
                return {"status":"paid","download_url":f"/api/download/{permit_id}",
                        "materials_url":f"/api/download/{materials_id}","calc":calc}
        return {"status":"pending"}
    except Exception as e: return {"status":"error","message":str(e)}


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
@app.get("/admin")
async def admin():
    return HTMLResponse(content=ADMIN_HTML)

@app.get("/admin/api/stats")
async def admin_stats():
    return get_stats()

@app.get("/admin/api/users/csv")
async def admin_csv():
    users = get_all_users()
    csv = "email,name,opted_in,created,last_login\n"
    for u in users:
        csv += f'{u["email"]},{u.get("name","")},{u["email_opt_in"]},{u["created_at"]},{u["last_login"]}\n'
    return Response(content=csv, media_type="text/csv", headers={"Content-Disposition":"attachment; filename=simpleblueprints-users.csv"})

ADMIN_HTML = """<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>SimpleBlueprints Admin</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;700;900&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',system-ui,sans-serif;background:#0d1117;color:#c9d1d9;min-height:100vh}.wrap{max-width:1100px;margin:0 auto;padding:32px 20px}h1{font-size:22px;color:#58a6ff;margin-bottom:4px}.sub{font-size:12px;color:#484f58;font-family:'DM Mono',monospace;margin-bottom:20px}.tabs{display:flex;gap:4px;margin-bottom:20px}.tab{padding:8px 18px;background:#161b22;border:1px solid #30363d;border-radius:6px;color:#8b949e;font-size:12px;font-family:'DM Mono',monospace;cursor:pointer}.tab.active{background:#238636;border-color:#238636;color:#fff}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:28px}.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:18px}.card .label{font-size:10px;color:#484f58;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}.card .val{font-size:32px;font-weight:900;color:#e6edf3}.card .detail{font-size:11px;color:#484f58;font-family:'DM Mono',monospace;margin-top:4px}table{width:100%;border-collapse:collapse;background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:hidden}th{text-align:left;padding:10px 14px;font-size:10px;color:#484f58;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:1px;background:#0d1117;border-bottom:1px solid #30363d}td{padding:8px 14px;font-size:12px;font-family:'DM Mono',monospace;border-bottom:1px solid #21262d}tr:last-child td{border-bottom:none}.chart{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:18px;height:200px;display:flex;align-items:flex-end;gap:3px}.chart-bar{background:#238636;border-radius:2px 2px 0 0;min-width:8px;flex:1;position:relative}.chart-bar:hover{background:#3fb950}.chart-bar .tip{display:none;position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:#30363d;color:#e6edf3;padding:4px 8px;border-radius:4px;font-size:10px;font-family:'DM Mono',monospace;white-space:nowrap;margin-bottom:4px}.chart-bar:hover .tip{display:block}.btn{background:#21262d;border:1px solid #30363d;color:#8b949e;padding:6px 16px;border-radius:6px;font-size:11px;font-family:'DM Mono',monospace;cursor:pointer;text-decoration:none}.btn:hover{background:#30363d;color:#e6edf3}.green{color:#3fb950}.red{color:#f85149}.bar-wrap{display:flex;align-items:center;gap:8px;margin-bottom:6px}.bar-label{font-size:11px;font-family:'DM Mono',monospace;color:#8b949e;min-width:100px}.bar{height:18px;background:#238636;border-radius:3px;min-width:2px}.bar-val{font-size:11px;font-family:'DM Mono',monospace;color:#484f58}</style>
</head><body><div class="wrap" id="app"><div style="text-align:center;padding:40px;color:#484f58;font-family:'DM Mono',monospace">Loading...</div></div>
<script>
let tab='overview',D=null;
async function load(){try{const r=await fetch('/admin/api/stats');D=await r.json();render()}catch(e){document.getElementById('app').innerHTML='Error: '+e.message}}
function ts(e){const d=(Date.now()/1000-e);if(d<60)return Math.floor(d)+'s ago';if(d<3600)return Math.floor(d/60)+'m ago';if(d<86400)return Math.floor(d/3600)+'h ago';return Math.floor(d/86400)+'d ago'}
function setTab(t){tab=t;render()}
function render(){if(!D)return;const g=D.generations,u=D.users,pv=D.page_views,p=D.popular,mx=Math.max(...D.daily.map(x=>x.count),1);
# let h='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px"><div><h1>SimpleBlueprints Dashboard</h1><div class="sub">Analytics   Users   Generations</div></div><button class="btn" onclick="load()">  Refresh</button></div>';
h+='<div class="tabs"><div class="tab '+(tab==='overview'?'active':'')+'" onclick="setTab(\'overview\')">Overview</div><div class="tab '+(tab==='users'?'active':'')+'" onclick="setTab(\'users\')">Users ('+u.total+')</div><div class="tab '+(tab==='generations'?'active':'')+'" onclick="setTab(\'generations\')">Generations</div></div>';
# if(tab==='overview'){h+='<div class="grid"><div class="card"><div class="label">PDFs Generated</div><div class="val">'+g.total+'</div><div class="detail">'+g.today+' today   '+g.this_week+' this week</div></div><div class="card"><div class="label">Registered Users</div><div class="val">'+u.total+'</div><div class="detail">'+u.today+' today   '+u.this_week+' this week</div></div><div class="card"><div class="label">Email Opt-ins</div><div class="val">'+u.opted_in+'</div><div class="detail">of '+u.total+' total</div></div><div class="card"><div class="label">Page Views</div><div class="val">'+pv.total+'</div><div class="detail">'+pv.today+' today   '+pv.unique_today+' unique</div></div></div>';
h+='<div style="margin-bottom:28px"><h2 style="font-size:14px;color:#8b949e;font-family:DM Mono,monospace;margin-bottom:12px">DAILY GENERATIONS</h2><div class="chart">'+D.daily.map(x=>'<div class="chart-bar" style="height:'+Math.max(x.count/mx*100,4)+'%"><div class="tip">'+x.date+': '+x.count+'</div></div>').join('')+(D.daily.length===0?'<div style="color:#484f58;margin:auto;font-size:12px;font-family:DM Mono,monospace">No data yet</div>':'')+'</div></div>';
# h+='<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))"><div><h2 style="font-size:14px;color:#8b949e;font-family:DM Mono,monospace;margin-bottom:12px">POPULAR SIZES</h2><div class="card">'+p.sizes.map(x=>'<div class="bar-wrap"><div class="bar-label">'+x.size+'</div><div class="bar" style="width:'+Math.max(x.count/Math.max(g.total,1)*100,5)+'%"></div><div class="bar-val">'+x.count+'</div></div>').join('')+'</div></div><div><h2 style="font-size:14px;color:#8b949e;font-family:DM Mono,monospace;margin-bottom:12px">PREFERENCES</h2><div class="card">'+p.attachment.map(x=>'<div class="bar-wrap"><div class="bar-label">'+(x.type||' ')+'</div><div class="bar" style="width:'+Math.max(x.count/Math.max(g.total,1)*100,5)+'%"></div><div class="bar-val">'+x.count+'</div></div>').join('')+p.decking.map(x=>'<div class="bar-wrap"><div class="bar-label">'+(x.type||' ')+'</div><div class="bar" style="width:'+Math.max(x.count/Math.max(g.total,1)*100,5)+'%"></div><div class="bar-val">'+x.count+'</div></div>').join('')+'</div></div></div>'}
# if(tab==='users'){h+='<div style="margin-bottom:16px"><a href="/admin/api/users/csv" class="btn" download>  Export CSV</a></div><table><tr><th>Email</th><th>Name</th><th>Opted In</th><th>Generations</th><th>Signed Up</th><th>Last Login</th></tr>'+D.user_list.map(u=>'<tr><td>'+u.email+'</td><td>'+(u.name||' ')+'</td><td>'+(u.opted_in?'<span class="green">Yes</span>':'<span class="red">No</span>')+'</td><td>'+u.generations+'</td><td>'+ts(u.created)+'</td><td>'+ts(u.last_login)+'</td></tr>').join('')+(D.user_list.length===0?'<tr><td colspan="6" style="text-align:center;color:#484f58">No users yet</td></tr>':'')+'</table>'}
# if(tab==='generations'){h+='<table><tr><th>When</th><th>User</th><th>Size</th><th>Height</th><th>Area</th><th>Attach</th><th>Decking</th><th>Stairs</th></tr>'+D.recent.map(r=>'<tr><td>'+ts(r.time)+'</td><td>'+r.email+'</td><td>'+r.size+'</td><td>'+r.height+'</td><td>'+r.area+' SF</td><td>'+r.attachment+'</td><td>'+r.decking+'</td><td>'+(r.stairs?'<span class="green">'+r.stair_loc+'</span>':' ')+'</td></tr>').join('')+(D.recent.length===0?'<tr><td colspan="8" style="text-align:center;color:#484f58">No data yet</td></tr>':'')+'</table>'}
document.getElementById('app').innerHTML=h}
load();setInterval(load,30000);
</script></body></html>"""


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
