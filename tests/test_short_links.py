"""S104: branded short links attach attribution server-side.

WHY: t.co tells you "Twitter" and nothing more -- it cannot separate one tweet
from another, or a post click from a bio click. UTM parameters can, but Will
will not post a 90-character URL, and the evidence is on his side: Bitly's 2024
analysis puts URLs over 150 characters at roughly 11% lower click-through, and a
bio link displays its URL as plain text where that is fully visible.

So the tag moves to the server. /x is short, branded, and on our own domain; the
redirect attaches the full UTM set before the page loads. Clean for humans,
complete for analytics.

WHAT THIS GUARDS, in order of how badly it would hurt:
  1. The collision guard. A catch-all /{code} route would sit in front of every
     404 on the site. These are explicit routes, and a code that shadows a real
     path must break the DEPLOY rather than the dashboard.
  2. 302 not 301. A permanent redirect is cached by browsers near-permanently,
     so a mapping we later want to change would be stuck on visitors' machines
     with no way to reach them.
  3. The UTM set actually arriving, since a redirect that drops it is worse than
     no redirect: it looks like it works and reports nothing.

Run: python3 tests/test_short_links.py
"""
import os
import sys
import tempfile
import urllib.parse

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

import app.main as m  # noqa: E402

FAILS = []


def check(label, got, expected):
    ok = got == expected
    if not ok:
        FAILS.append(label)
    print(f"  [{'OK  ' if ok else 'FAIL'}] {label}: got {got!r}, expected {expected!r}")


def main():
    client = TestClient(m.app)

    print("\n1. Every configured code redirects with its full UTM set.")
    print("   A redirect that silently drops the tags is worse than none:")
    print("   it looks like it works and reports nothing.")
    for code, (src, medium, campaign) in m.SHORT_LINKS.items():
        r = client.get(f"/{code}", follow_redirects=False)
        check(f"/{code} redirects", r.status_code, 302)
        loc = r.headers.get("location", "")
        q = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)
        check(f"/{code} utm_source", q.get("utm_source", [None])[0], src)
        check(f"/{code} utm_medium", q.get("utm_medium", [None])[0], medium)
        check(f"/{code} utm_campaign", q.get("utm_campaign", [None])[0], campaign)

    print("\n2. 302, never 301. A permanent redirect is cached near-forever, so")
    print("   a remapped campaign would be unreachable on old visitors' machines.")
    any_code = next(iter(m.SHORT_LINKS))
    check("not a permanent redirect",
          client.get(f"/{any_code}", follow_redirects=False).status_code == 301, False)

    print("\n3. These are EXPLICIT routes, not a catch-all. A catch-all /{code}")
    print("   would sit in front of every 404 on the site.")
    for unknown in ("/definitely-not-a-code", "/xyz123", "/x/extra"):
        check(f"{unknown} still 404s",
              client.get(unknown, follow_redirects=False).status_code, 404)

    print("\n4. Real routes are untouched. If a short code ever shadowed one of")
    print("   these, the site would break in a way nobody would attribute to a")
    print("   marketing link.")
    for path, expected in [("/", 200), ("/admin", 200), ("/mock", 200)]:
        check(f"{path} unaffected", client.get(path, follow_redirects=False).status_code, expected)
    check("/static/js/app.js unaffected",
          client.get("/static/js/app.js").status_code, 200)

    print("\n5. The collision guard fails LOUDLY at registration, so a bad code")
    print("   breaks the deploy instead of the dashboard.")
    saved = dict(m.SHORT_LINKS)
    try:
        m.SHORT_LINKS.clear()
        m.SHORT_LINKS["admin"] = ("x", "y", "z")
        try:
            m._register_short_links()
            check("shadowing 'admin' raises", False, True)
        except RuntimeError as e:
            check("shadowing 'admin' raises RuntimeError", "collides" in str(e), True)
    finally:
        m.SHORT_LINKS.clear()
        m.SHORT_LINKS.update(saved)

    print("\n6. The redirect lands on the homepage, not somewhere unexpected.")
    r = client.get(f"/{any_code}", follow_redirects=False)
    check("target path is /",
          urllib.parse.urlparse(r.headers.get("location", "")).path, "/")

    print()
    if FAILS:
        print(f"SHORT LINKS: {len(FAILS)} FAILED -> " + "; ".join(FAILS[:5]))
        sys.exit(1)
    print("SHORT LINKS: all checks passed")


if __name__ == "__main__":
    main()
