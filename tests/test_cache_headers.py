"""S104: HTML shells must carry Cache-Control: no-cache.

WHY THIS EXISTS
---------------
Every versioned asset is cache-busted with a query string (?v=s104d), so
bumping a version produces a different URL and the browser always fetches it.
That scheme has exactly one weak link: the HTML file that NAMES those versions
cannot bust itself, because its own URL never changes.

index.html was served with only an etag and last-modified and no Cache-Control,
so browsers fell back to heuristic freshness. A returning visitor could reuse a
stale shell, request the OLD bundle versions named inside it, and never receive
a deploy however carefully the busters were bumped.

Observed rather than theorised: in S104, push 5 fixed the drafts page, the
server was confirmed serving home.js?v=s104d, and the browser was still running
the previous bundle. Every "is it actually deployed?" question in that session
traces back here.

no-cache does NOT mean "never cache". It means "revalidate before use": the
browser still sends its etag and still gets a bodyless 304 when nothing has
changed. One conditional request per page load.

Run: python3 tests/test_cache_headers.py
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

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

FAILS = []


def check(label, got, expected):
    ok = got == expected
    if not ok:
        FAILS.append(label)
    print(f"  [{'OK  ' if ok else 'FAIL'}] {label}: got {got!r}, expected {expected!r}")


def main():
    client = TestClient(app)

    print("\n1. The HTML shells. These name the bundle versions and cannot bust")
    print("   themselves, so they are the ONLY files where the header matters.")
    for path in ("/", "/admin", "/mock", "/mock/app"):
        r = client.get(path, follow_redirects=False)
        cc = r.headers.get("cache-control")
        check(f"{path} revalidates", cc, "no-cache, must-revalidate")

    print("\n2. Versioned assets keep the header they already had.")
    r = client.get("/static/js/app.js")
    check("/static/js/app.js revalidates",
          r.headers.get("cache-control"), "no-cache, must-revalidate")

    print("\n3. Generated PDFs stay no-store. A permit set is per-request and")
    print("   must never sit in a shared cache.")
    r = client.get("/api/download/does-not-exist")
    check("/api/download/* is no-store", r.headers.get("cache-control"), "no-store")

    print("\n4. API responses are deliberately NOT forced to revalidate here;")
    print("   they are dynamic and uncached by default. Asserted so that")
    print("   widening the path match later shows up as a failure.")
    r = client.get("/api/projects")
    check("/api/projects has no cache-control", r.headers.get("cache-control"), None)

    print()
    if FAILS:
        print(f"CACHE HEADERS: {len(FAILS)} FAILED -> " + "; ".join(FAILS))
        sys.exit(1)
    print("CACHE HEADERS: all checks passed")


if __name__ == "__main__":
    main()
