"""
SimpleBlueprints — FastAPI Backend
Handles: PDF generation, Stripe checkout, webhook, file serving
"""

import os
import uuid
import json
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
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
from drawing.draw_site_plan import draw_site_plan

# ============================================================
# CONFIG
# ============================================================
STRIPE_SECRET = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
SITE_URL = os.getenv("SITE_URL", "http://localhost:8000")
BLUEPRINT_PRICE = 2900  # $29.00 in cents

# Storage dir for generated PDFs
PDF_DIR = Path("/tmp/blueprints")
PDF_DIR.mkdir(exist_ok=True)

stripe.api_key = STRIPE_SECRET

# ============================================================
# APP
# ============================================================
app = FastAPI(title="SimpleBlueprints API", version="1.0.0")

# Redirect HTTP to HTTPS in production
@app.middleware("http")
async def https_redirect(request: Request, call_next):
    if request.headers.get("x-forwarded-proto") == "http":
        url = request.url.replace(scheme="https")
        return RedirectResponse(url=str(url), status_code=301)
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# MODELS
# ============================================================
class DeckParams(BaseModel):
    width: float
    depth: float
    height: float
    attachment: str = "ledger"
    hasStairs: bool = False
    stairLocation: str = "front"
    joistSpacing: int = 16
    deckingType: str = "composite"
    railType: str = "fortress"
    snowLoad: str = "moderate"
    frostZone: str = "cold"
    overJoist: Optional[str] = None
    overBeam: Optional[str] = None
    overPostSize: Optional[str] = None
    overPostCount: Optional[int] = None
    overFooting: Optional[int] = None
    projectInfo: Optional[dict] = None
    coverImage: Optional[str] = None
    sitePlanMode: Optional[str] = "generate"
    sitePlanFile: Optional[str] = None


# ============================================================
# PDF GENERATION
# ============================================================
def generate_blueprint_pdf(params: dict) -> tuple[str, dict]:
    """Generate a complete blueprint PDF. Returns (file_id, calc_result)."""
    calc = calculate_structure(params)
    pi = params.get("projectInfo", {}) or {}
    cover_img = params.get("coverImage", None)
    sp_mode = params.get("sitePlanMode", "generate")
    sp_file = params.get("sitePlanFile", None)
    file_id = str(uuid.uuid4())
    output_path = PDF_DIR / f"{file_id}.pdf"

    sheets = [
        ("A-1", "DECK PLAN & FRAMING", draw_plan_and_framing),
        ("A-2", "EXTERIOR ELEVATIONS", draw_elevations_sheet),
        ("A-3", "STRUCTURAL DETAILS", draw_details_sheet),
        ("A-4", "MATERIAL LIST & COST ESTIMATE", draw_materials_sheet),
    ]

    with PdfPages(str(output_path)) as pdf:
        # Sheet A-0: Cover
        fig0 = plt.figure(figsize=(14, 8.5))
        fig0.set_facecolor('white')
        draw_cover_sheet(fig0, params, calc, pi, cover_img)
        pdf.savefig(fig0, dpi=200)
        plt.close(fig0)

        for sheet_num, sheet_title, draw_fn in sheets:
            fig = plt.figure(figsize=(14, 8.5))
            fig.set_facecolor('white')
            draw_fn(fig, params, calc)
            draw_title_block(fig, sheet_num, sheet_title, calc, pi)
            pdf.savefig(fig, dpi=200)
            plt.close(fig)

        # Sheet A-5: Site Plan (generated or uploaded)
        if sp_mode == "upload" and sp_file:
            try:
                import io
                import base64
                from PIL import Image
                img_data = base64.b64decode(sp_file)
                # Check if it's a PDF or image
                if img_data[:4] == b'%PDF':
                    # For PDF uploads, convert first page to image
                    # Save temp file and use pdf2image or just embed as image
                    tmp_path = PDF_DIR / f"{file_id}_survey.pdf"
                    tmp_path.write_bytes(img_data)
                    import subprocess
                    tmp_png = PDF_DIR / f"{file_id}_survey.png"
                    subprocess.run(["pdftoppm", "-png", "-r", "200", "-f", "1", "-l", "1",
                                    str(tmp_path), str(tmp_png).replace('.png', '')],
                                   capture_output=True, timeout=10)
                    png_path = PDF_DIR / f"{file_id}_survey-1.png"
                    if png_path.exists():
                        img = Image.open(png_path)
                    else:
                        img = None
                    tmp_path.unlink(missing_ok=True)
                    png_path.unlink(missing_ok=True)
                else:
                    img = Image.open(io.BytesIO(img_data))

                if img:
                    fig5 = plt.figure(figsize=(14, 8.5))
                    fig5.set_facecolor('white')
                    ax5 = fig5.add_axes([0.02, 0.05, 0.96, 0.88])
                    ax5.axis('off')
                    import numpy as np
                    ax5.imshow(np.array(img), aspect='auto')
                    fig5.text(0.5, 0.97, "SHEET A-5  |  UPLOADED SITE PLAN / SURVEY",
                              ha='center', fontsize=8, fontfamily='monospace',
                              color='#7a8068')
                    draw_title_block(fig5, "A-5", "SITE PLAN (UPLOADED)", calc, pi)
                    pdf.savefig(fig5, dpi=200)
                    plt.close(fig5)
            except Exception as e:
                # Fallback to generated if upload fails
                fig5 = plt.figure(figsize=(14, 8.5))
                fig5.set_facecolor('white')
                draw_site_plan(fig5, params, calc)
                draw_title_block(fig5, "A-5", "SITE PLAN", calc, pi)
                pdf.savefig(fig5, dpi=200)
                plt.close(fig5)
        else:
            fig5 = plt.figure(figsize=(14, 8.5))
            fig5.set_facecolor('white')
            draw_site_plan(fig5, params, calc)
            draw_title_block(fig5, "A-5", "SITE PLAN", calc, pi)
            pdf.savefig(fig5, dpi=200)
            plt.close(fig5)

    return file_id, calc


# ============================================================
# API ROUTES
# ============================================================

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "simpleblueprints"}


@app.post("/api/calculate")
async def calculate(params: DeckParams):
    """Run structural calculations without generating PDF (free, used by wizard)."""
    calc = calculate_structure(params.dict())
    return calc


@app.post("/api/preview")
async def preview(params: DeckParams):
    """Generate a preview calculation + material estimate (free)."""
    calc = calculate_structure(params.dict())
    return {
        "calc": calc,
        "summary": {
            "area": calc["area"],
            "joistSize": calc["joist_size"],
            "beamSize": calc["beam_size"],
            "postSize": calc["post_size"],
            "numPosts": calc["num_posts"],
            "footingDiam": calc["footing_diam"],
            "footingDepth": calc["footing_depth"],
            "totalLoad": calc["TL"],
            "warnings": calc["warnings"],
        }
    }


@app.post("/api/checkout")
async def create_checkout(params: DeckParams):
    """Create a Stripe Checkout session for blueprint purchase."""
    if not STRIPE_SECRET:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Store params in metadata so we can generate the PDF after payment
    param_json = json.dumps(params.dict())

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"Deck Blueprint — {params.width}'×{params.depth}'",
                        "description": f"{params.width}'×{params.depth}' deck blueprint set (3 sheets + material list)",
                    },
                    "unit_amount": BLUEPRINT_PRICE,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{SITE_URL}/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{SITE_URL}/wizard?step=3",
            metadata={"deck_params": param_json},
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook — generate PDF after successful payment."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        param_json = session.get("metadata", {}).get("deck_params")

        if param_json:
            params = json.loads(param_json)
            file_id, calc = generate_blueprint_pdf(params)

            # TODO: Store file_id in database linked to session/customer
            # TODO: Send email with download link via Resend
            print(f"Blueprint generated: {file_id} for session {session['id']}")

    return {"received": True}


@app.get("/api/download/{file_id}")
async def download_blueprint(file_id: str):
    """Download a generated blueprint PDF."""
    # Sanitize file_id to prevent path traversal
    safe_id = file_id.replace("/", "").replace("..", "")
    pdf_path = PDF_DIR / f"{safe_id}.pdf"

    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Blueprint not found")

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=f"SimpleBlueprints-Deck-{safe_id[:8]}.pdf",
    )


@app.get("/api/success")
async def success_page(session_id: str = ""):
    """After payment — look up the session and return download info."""
    if not session_id or not STRIPE_SECRET:
        return {"status": "error", "message": "Invalid session"}

    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if session.payment_status == "paid":
            param_json = session.metadata.get("deck_params")
            if param_json:
                params = json.loads(param_json)
                file_id, calc = generate_blueprint_pdf(params)
                return {
                    "status": "paid",
                    "download_url": f"/api/download/{file_id}",
                    "calc": calc,
                }
        return {"status": "pending"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ============================================================
# GENERATE WITHOUT PAYMENT (for testing)
# ============================================================
@app.post("/api/generate-test")
async def generate_test(params: DeckParams):
    """Generate blueprint without payment — FOR TESTING ONLY.
    Remove or protect this endpoint before going live."""
    file_id, calc = generate_blueprint_pdf(params.dict())
    return {
        "file_id": file_id,
        "download_url": f"/api/download/{file_id}",
        "calc": calc,
    }


# ============================================================
# SERVE FRONTEND
# ============================================================
from pathlib import Path as _Path
_STATIC_DIR = _Path(__file__).parent.parent / "static"

@app.get("/")
async def root():
    index_path = _STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path), media_type="text/html")
    return {"message": "SimpleBlueprints API is running", "docs": "/docs"}
