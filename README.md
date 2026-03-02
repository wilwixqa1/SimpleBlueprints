# SimpleBlueprints

Permit-ready deck blueprints in minutes. Configure → Calculate → Download.

## Backend (FastAPI + Python)

### Local Development
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### API Endpoints
- `GET /api/health` — Health check
- `POST /api/calculate` — Run structural calculations (free)
- `POST /api/checkout` — Create Stripe checkout session ($29)
- `POST /api/webhooks/stripe` — Stripe payment webhook
- `GET /api/download/{file_id}` — Download generated PDF
- `POST /api/generate-test` — Generate PDF without payment (testing only)

### Deploy to Railway
1. Connect GitHub repo to Railway
2. Set root directory to `/backend`
3. Railway will detect the Dockerfile and build automatically
4. Add environment variables (see DEPLOY_GUIDE.md)

## Environment Variables
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SITE_URL=https://simpleblueprints.xyz
```
