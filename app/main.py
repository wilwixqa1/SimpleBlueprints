"""SimpleBlueprints UX Mock -- Session 88.5
Clean-sheet user journey prototype. Completely separate from production.
No PDF generation, no compliance engine, no auth, no payments. Mock data only.
"""
import asyncio
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

app = FastAPI(title="SimpleBlueprints UX Mock")

DEMO_PARCEL = {
    "address": "4739 Sweetgrass Ln, Colorado Springs, CO 80922",
    "parcelId": "53-081-04-039",
    "jurisdiction": "Pikes Peak Regional Building Department",
    "lotVertices": [[0, 0], [4, 68], [38, 112], [96, 96], [104, 22], [88, 0]],
    "lotArea": 9480,
    "setbacks": {"front": 25, "side": 5, "rear": 15},
    "house": {"x": 26, "y": 30, "w": 44, "d": 30},
    "northAngle": 12,
    "zoning": "R1-6 Single-Family Residential",
    "confidence": {"lot": "high", "house": "high", "street": "verified"},
}

@app.get("/api/mock/parcel")
async def mock_parcel(address: str = ""):
    await asyncio.sleep(1.4)
    d = dict(DEMO_PARCEL)
    if address.strip():
        d["address"] = address.strip()
        d["demo_note"] = "Demo mode: showing sample parcel data for any address."
    return JSONResponse(d)

@app.get("/api/mock/extract")
async def mock_extract():
    await asyncio.sleep(2.2)
    d = dict(DEMO_PARCEL)
    d["source"] = "survey_extraction"
    d["confidence"] = {"lot": "high", "house": "medium", "north": "low"}
    return JSONResponse(d)

@app.get("/")
async def landing():
    return FileResponse("static/index.html")

@app.get("/app")
async def journey():
    return FileResponse("static/app.html")

app.mount("/static", StaticFiles(directory="static"), name="static")
