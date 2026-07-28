#!/usr/bin/env python3
"""The site must be crawlable: HEAD works, one canonical host, robots and
sitemap healthy.

WHY THIS EXISTS (S106)
----------------------
Google Search Console reported the sitemap as "Couldn't fetch" and pages as
"Blocked due to other 4xx issue" while GET on every URL served perfectly.
Measured from outside on Jul 28 2026:

    HEAD https://simpleblueprints.xyz/sitemap.xml   -> 405, allow: GET
    HEAD https://simpleblueprints.xyz/robots.txt    -> 405, allow: GET
    HEAD https://simpleblueprints.xyz/              -> 405, allow: GET
    GET  https://www.simpleblueprints.xyz/          -> 200 (a full duplicate
                                                       of the site, no 301)

Every route is registered with @app.get and FastAPI registers only the
methods you name, so the entire site refused HEAD, which crawlers use, and a
405 is a 4xx. The www host serving 200 meant search engines saw two copies of
every page. Both are now middleware (head_method_support, canonical_host) and
this test pins them, against the real app via TestClient, the same pattern as
test_cache_headers.py.

Run: python3 tests/test_seo_endpoints.py
"""
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))

try:
    import pgserver
    from fastapi.testclient import TestClient
except ImportError as e:
    print(f"SKIP: missing dependency ({e})")
    sys.exit(0)

_srv = pgserver.get_server(tempfile.mkdtemp())
os.environ["DATABASE_URL"] = _srv.get_uri()
os.environ.setdefault("SESSION_SECRET", "test-secret")

import app.database as db  # noqa: E402

db.DATABASE_URL = os.environ["DATABASE_URL"]
db._pool = None
db.init_tables()

from app.main import app  # noqa: E402

client = TestClient(app, base_url="https://simpleblueprints.xyz")
fails = []


def check(name, cond, detail=""):
    print("  %-58s %s" % (name, "ok" if cond else "FAIL " + str(detail)))
    if not cond:
        fails.append(name)


print("1. HEAD works everywhere GET does (the Search Console fix)")
for path in ("/", "/robots.txt", "/sitemap.xml", "/favicon.ico"):
    g = client.get(path)
    h = client.head(path)
    check("HEAD %s returns 200" % path, h.status_code == 200, h.status_code)
    check("HEAD %s has no body" % path, h.content == b"", len(h.content))
    check("HEAD %s content-length matches GET" % path,
          h.headers.get("content-length") == str(len(g.content)),
          "%s vs %s" % (h.headers.get("content-length"), len(g.content)))
    check("HEAD %s content-type matches GET" % path,
          h.headers.get("content-type") == g.headers.get("content-type"))

print("2. HEAD does not weaken other methods or statuses")
check("HEAD on a missing path is 404",
      client.head("/definitely-not-a-page").status_code == 404,
      client.head("/definitely-not-a-page").status_code)
check("GET on an auth API is still 401",
      client.get("/api/projects").status_code == 401,
      client.get("/api/projects").status_code)
check("POST /auth/opt-out still requires auth (401)",
      client.post("/auth/opt-out", json={}).status_code == 401,
      client.post("/auth/opt-out", json={}).status_code)

print("3. one canonical host: www 301s to the apex, path and query kept")
www = TestClient(app, base_url="https://www.simpleblueprints.xyz")
r = www.get("/sitemap.xml", follow_redirects=False)
check("www GET is a 301", r.status_code == 301, r.status_code)
check("www redirects to the apex sitemap",
      r.headers.get("location") == "https://simpleblueprints.xyz/sitemap.xml",
      r.headers.get("location"))
r2 = www.get("/?utm_source=x", follow_redirects=False)
check("www redirect keeps the query string",
      r2.headers.get("location") == "https://simpleblueprints.xyz/?utm_source=x",
      r2.headers.get("location"))
r3 = www.head("/", follow_redirects=False)
check("www HEAD also 301s", r3.status_code == 301, r3.status_code)
check("apex GET is NOT redirected",
      client.get("/", follow_redirects=False).status_code == 200,
      client.get("/", follow_redirects=False).status_code)

print("4. robots.txt and the sitemap agree with each other")
robots = client.get("/robots.txt")
check("robots.txt is 200 text/plain",
      robots.status_code == 200 and
      robots.headers["content-type"].startswith("text/plain"))
check("robots.txt names the sitemap",
      "Sitemap: https://simpleblueprints.xyz/sitemap.xml" in robots.text)
check("robots.txt disallows /api/", "Disallow: /api/" in robots.text)
check("robots.txt disallows /admin", "Disallow: /admin" in robots.text)
sm = client.get("/sitemap.xml")
check("sitemap is 200 application/xml",
      sm.status_code == 200 and "xml" in sm.headers["content-type"])
check("sitemap declares the urlset namespace",
      'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' in sm.text)
check("sitemap lists the canonical homepage",
      "<loc>https://simpleblueprints.xyz/</loc>" in sm.text)
check("sitemap contains no www urls", "www.simpleblueprints" not in sm.text)

print()
if fails:
    print("FAILED (%d): %s" % (len(fails), "; ".join(fails)))
    sys.exit(1)
print("PASS  the site is crawlable")
