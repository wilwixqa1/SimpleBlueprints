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


# ============================================================
# PDF GENERATION
# ============================================================
def generate_blueprint_pdf(params: dict) -> tuple[str, dict]:
    """Generate a complete blueprint PDF. Returns (file_id, calc_result)."""
    calc = calculate_structure(params)
    file_id = str(uuid.uuid4())
    output_path = PDF_DIR / f"{file_id}.pdf"

    with PdfPages(str(output_path)) as pdf:
        # Sheet A-1: Plan + Framing
        fig1 = plt.figure(figsize=(14, 8.5))
        fig1.set_facecolor('white')
        draw_plan_and_framing(fig1, params, calc)
        pdf.savefig(fig1, dpi=200)
        plt.close(fig1)

        # Sheet A-2: Elevations
        fig2 = plt.figure(figsize=(14, 8.5))
        fig2.set_facecolor('white')
        draw_elevations_sheet(fig2, params, calc)
        pdf.savefig(fig2, dpi=200)
        plt.close(fig2)

        # Sheet A-3: Details
        fig3 = plt.figure(figsize=(14, 8.5))
        fig3.set_facecolor('white')
        draw_details_sheet(fig3, params, calc)
        pdf.savefig(fig3, dpi=200)
        plt.close(fig3)

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
# SERVE FRONTEND (in production, Next.js handles this)
# ============================================================
# For now, serve a simple redirect to show the API is running
@app.get("/")
async def root():
    return {"message": "SimpleBlueprints API is running", "docs": "/docs"}
