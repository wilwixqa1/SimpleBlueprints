# SimpleBlueprints UX Mock (S88.5)

Clean-sheet user-journey prototype. Completely separate from production —
deploy as its OWN Railway service. See UX_RATIONALE.md for the design thesis.

## Run locally
    pip install -r requirements.txt
    uvicorn app.main:app --reload
    # http://localhost:8000        -> SEO landing page
    # http://localhost:8000/app    -> the three-act journey

## Deploy to Railway (new service, not production!)
1. Push this folder to a NEW GitHub repo (e.g. sbp-ux-mock).
2. Railway -> New Project -> Deploy from GitHub repo -> pick it.
3. railway.json already sets the start command. No env vars needed.
4. Generate a domain under Settings -> Networking.

## What's mocked
- /api/mock/parcel  : any address returns the demo Colorado Springs parcel
                      (1.4s simulated latency for the lookup animation)
- /api/mock/extract : simulated AI survey extraction (2.2s)
- "Ask the drafter" : canned AI with a real action parser (sizes, wings,
                      stairs, height, explanations)
- Sheet previews    : SVG facsimiles drawn live from the design state
- Download button   : toast only (Stripe intentionally out of scope)

## Known limitations
- Phone-width layout not tuned (tablet and up is responsive)
- Setback geometry assumes a convex lot (demo lot is convex)
- Spec engine is simplified/plausible, not the production IRC engine
- Nothing persists; refresh restarts the journey
