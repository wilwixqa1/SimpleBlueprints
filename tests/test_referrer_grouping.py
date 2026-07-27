"""S104: referrers group by SOURCE, not raw URL.

WHY: every link posted on Twitter is wrapped in a per-link t.co code. One
account produced https://t.co/EYStut9CLA and https://t.co/yAhQIp8Qvw as two
separate rows in Will's dashboard -- the tweet and the bio link -- and that
fragmentation gets worse the more he posts.

Also asserts the accounts.google.com case. That row is our own OAuth round trip
(the user leaves for Google to sign in and returns, so the browser reports
Google as the referrer) and it was quietly inflating the acquisition table. It
is LABELLED rather than dropped: hiding rows is how you lose track of what your
data contains.

The ordering test matters most. accounts.google.com must be matched BEFORE the
general google pattern, or sign-ins silently count as organic search and the
number looks like growth.

Run: python3 tests/test_referrer_grouping.py
"""
import os
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

try:
    import pgserver
except ImportError:
    print("SKIP: pgserver not installed (pip install pgserver)")
    sys.exit(0)

_srv = pgserver.get_server(tempfile.mkdtemp())
os.environ["DATABASE_URL"] = _srv.get_uri()

import app.database as db  # noqa: E402

db.DATABASE_URL = os.environ["DATABASE_URL"]
db._pool = None

FAILS = []


def check(label, got, expected):
    ok = got == expected
    if not ok:
        FAILS.append(label)
    print(f"  [{'OK  ' if ok else 'FAIL'}] {label}: got {got!r}, expected {expected!r}")


# referrer -> expected label. Real values from Will's dashboard plus the
# variants each source actually emits.
CASES = [
    ("https://t.co/EYStut9CLA",                 "Twitter / X"),
    ("https://t.co/yAhQIp8Qvw",                 "Twitter / X"),
    ("https://twitter.com/someone/status/123",  "Twitter / X"),
    ("https://x.com/someone",                   "Twitter / X"),
    ("https://accounts.google.com/",            "Google sign-in (our own auth, not traffic)"),
    ("https://www.google.com/",                 "Google search"),
    ("https://google.co.uk/search?q=deck",      "Google search"),
    ("https://www.bing.com/search",             "Other search"),
    ("https://duckduckgo.com/",                 "Other search"),
    ("https://www.linkedin.com/feed/",          "LinkedIn"),
    ("https://lnkd.in/abc123",                  "LinkedIn"),
    ("https://l.facebook.com/",                 "Meta"),
    ("https://www.instagram.com/",              "Meta"),
    ("https://out.reddit.com/",                 "Reddit"),
    ("https://simpleblueprints.xyz/pricing",    "Our own site (internal)"),
    # unknown sources collapse to their HOST, never the full URL, so one blog
    # linking from five pages is one row
    ("https://someblog.com/posts/decks-2026",   "someblog.com"),
    ("https://someblog.com/about",              "someblog.com"),
]


def seed():
    db.init_tables()
    with db.get_db() as conn:
        cur = conn.cursor()
        for i, (ref, _) in enumerate(CASES):
            cur.execute(
                "INSERT INTO sessions (session_id, anonymous_id, ip_hash, is_bot,"
                " first_seen, referrer) VALUES (%s,%s,%s,FALSE,NOW(),%s)",
                (f"s{i}", f"a{i}", f"ip{i}", ref))
        conn.commit()


def main():
    seed()
    rows = db.get_analytics_v2(days=30, phase="all")["acquisition"]["referrers"]
    got = {r["referrer"]: r["sessions"] for r in rows}
    print("\nreferrer table as the dashboard receives it:")
    for r in rows:
        print(f"   {r['sessions']:>3}  {r['referrer']}")

    print("\n1. All four Twitter shapes collapse into one row")
    check("Twitter / X sessions", got.get("Twitter / X"), 4)
    check("no raw t.co row survives",
          any("t.co" in k for k in got), False)

    print("\n2. Our own sign-in is labelled, NOT counted as search and NOT hidden")
    check("sign-in row present",
          got.get("Google sign-in (our own auth, not traffic)"), 1)
    print("   ORDERING: if the general google pattern were tested first this")
    print("   would be 3 instead of 2, and our own auth would read as growth.")
    check("Google search is only real search", got.get("Google search"), 2)

    print("\n3. Other sources")
    check("Other search", got.get("Other search"), 2)
    check("LinkedIn", got.get("LinkedIn"), 2)
    check("Meta", got.get("Meta"), 2)
    check("Reddit", got.get("Reddit"), 1)
    check("internal navigation", got.get("Our own site (internal)"), 1)

    print("\n4. Unknown sources fall back to HOST, not the full URL, so two")
    print("   pages of the same blog are one source")
    check("someblog.com collapsed", got.get("someblog.com"), 2)
    check("no full-path row leaked", any("/posts/" in k for k in got), False)

    print("\n5. Nothing was lost: every seeded session is accounted for")
    check("total sessions", sum(got.values()), len(CASES))

    print()
    if FAILS:
        print(f"REFERRER GROUPING: {len(FAILS)} FAILED -> " + "; ".join(FAILS[:5]))
        sys.exit(1)
    print("REFERRER GROUPING: all checks passed")


if __name__ == "__main__":
    main()
