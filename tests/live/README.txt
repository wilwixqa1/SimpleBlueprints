LIVE-SITE DOM CHECKS (S88)
==========================
These run a HEADLESS BROWSER against a RUNNING server and assert DOM/JS facts.
They are NOT in CI (the CI runner has no chromium binary and no Postgres).
Run them locally or against simpleblueprints.xyz after a deploy.

Setup (sandbox, per MASTER_CONTEXT 6.5):
  playwright install chromium
  # Postgres: initdb a cluster, create db 'sbp' user 'sbp', start on :5432
  cd backend
  DATABASE_URL=postgresql://sbp:sbp@127.0.0.1:5432/sbp SESSION_SECRET=test \
    ADMIN_PASSWORD=test python3 -m uvicorn app.main:app --port 8000 --host 127.0.0.1 &
  sleep 9
  cd .. && python3 tests/live/zone_cap_dom.py

zone_cap_dom.py -- S87 3-zone cap Will-gate, automated (see MASTER_CONTEXT 11B
  PENDING WILL VISUAL GATES). Loads the served JS and asserts the shipped
  window.atZoneCap / window.MAX_ADD_ZONES behave at the cap (false at 0/2,
  true at 3/4, cutouts don't count) -- the exact function planView.js edge
  handles and the hint text gate on. Passed live S88 against cache buster s87a.
  Residual manual bit: a screenshot confirming the '+' handles are physically
  gone + the hint text renders (the function is proven; the render is not).
