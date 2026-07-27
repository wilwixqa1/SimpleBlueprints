"""S104: the project duplicate backstop, against a REAL Postgres.

THE BUG (Will, S104): "my projects are not actually saving" and "products that
are the same in every single possible way should not present as more than one
file, especially if they have the same address."

Those were one bug. The active project id lived only in a React ref
(app.js:901). A page refresh, the sign-in round trip, or clicking the logo
dropped it; the next autosave then called POST /api/projects with no id and got
a WHOLE NEW ROW, auto-named from info.address, so the copies all carried the
same address. Edits after that went to a row the user was not looking at, which
reads as "not saving."

The real repair is client-side: the id now lives in the URL. This guards the
server half, because a rule that only lives in the client is one refactor away
from being gone (S103: an instruction is not a mechanism).

WHAT THE GUARD MUST NOT DO is collapse two projects that differ. Byte-identical
rows contain no unique work by definition, so returning the first loses nothing.
Anything else must get its own row. Most of the checks below are that direction.

Run: python3 tests/test_project_dedupe.py
"""
import json
import os
import sys
import tempfile

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
    print(f"  [{'OK  ' if ok else 'FAIL'}] {label}: got {got}, expected {expected}")


PARAMS_A = json.dumps({"width": 20, "depth": 12, "railType": "fortress"})
PARAMS_B = json.dumps({"width": 24, "depth": 12, "railType": "fortress"})
INFO_A = json.dumps({"address": "4739 Sweetgrass Lane", "city": "Colorado Springs", "state": "CO"})
INFO_B = json.dumps({"address": "800 Meadowview Dr", "city": "Colorado Springs", "state": "CO"})
NAME_A = "4739 Sweetgrass Lane"


def setup():
    db.init_tables()
    with db.get_db() as conn:
        cur = conn.cursor()
        import time as _t
        now = _t.time()
        cur.execute("INSERT INTO users (google_id, email, created_at, last_login)"
                    " VALUES ('g_will','will@example.com',%s,%s) RETURNING id", (now, now))
        uid = cur.fetchone()[0]
        cur.execute("INSERT INTO users (google_id, email, created_at, last_login)"
                    " VALUES ('g_other','other@example.com',%s,%s) RETURNING id", (now, now))
        other = cur.fetchone()[0]
        conn.commit()
    return uid, other


def main():
    uid, other = setup()

    proj = db.create_project(user_id=uid, name=NAME_A, params_json=PARAMS_A,
                             info_json=INFO_A, step=2)
    print(f"\nseeded project id={proj['id']} name={proj['name']!r}")

    print("\n1. The exact repeat that the refresh / sign-in bug produced")
    hit = db.find_identical_project(uid, NAME_A, PARAMS_A, INFO_A)
    check("identical content finds the existing row", hit and hit["id"], proj["id"])

    print("\n2. MUST NOT collapse things that differ. This is the risky direction:")
    print("   a false match here would silently merge two real designs.")
    check("different params -> new row",
          db.find_identical_project(uid, NAME_A, PARAMS_B, INFO_A), None)
    check("different info -> new row",
          db.find_identical_project(uid, NAME_A, PARAMS_A, INFO_B), None)
    check("different name -> new row",
          db.find_identical_project(uid, "Back deck", PARAMS_A, INFO_A), None)
    check("ANOTHER USER's identical project is never returned",
          db.find_identical_project(other, NAME_A, PARAMS_A, INFO_A), None)

    print("\n3. Same address, genuinely different design, still two rows.")
    print("   Will's rule is 'the same in every possible way', not 'same address'.")
    p2 = db.create_project(user_id=uid, name=NAME_A, params_json=PARAMS_B, info_json=INFO_A)
    check("second design at the same address was created", p2["id"] != proj["id"], True)
    check("and it does not match the first",
          db.find_identical_project(uid, NAME_A, PARAMS_A, INFO_A)["id"], proj["id"])

    print("\n4. NULL handling. A brand-new project posts null params before the")
    print("   user has touched anything; SQL '=' never matches NULL, so this")
    print("   needs IS NOT DISTINCT FROM or the guard silently never fires.")
    pn = db.create_project(user_id=uid, name="Untitled Deck", params_json=None, info_json=None)
    hitn = db.find_identical_project(uid, "Untitled Deck", None, None)
    check("null params/info still match", hitn and hitn["id"], pn["id"])

    print("\n5. Time window. A deliberate fresh start from identical defaults")
    print("   next week must NOT be swallowed into an old row.")
    with db.get_db() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE projects SET updated_at = NOW() - INTERVAL '48 hours' WHERE id = %s",
                    (proj["id"],))
        conn.commit()
    check("stale identical row is not returned",
          db.find_identical_project(uid, NAME_A, PARAMS_A, INFO_A), None)
    check("but a wide enough window still finds it",
          db.find_identical_project(uid, NAME_A, PARAMS_A, INFO_A, within_hours=200)["id"],
          proj["id"])

    print("\n6. The read-only duplicate report used to review cleanup.")
    with db.get_db() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE projects SET updated_at = NOW() WHERE id = %s", (proj["id"],))
        conn.commit()
    for _ in range(2):
        db.create_project(user_id=uid, name=NAME_A, params_json=PARAMS_A, info_json=INFO_A)
    groups = db.list_duplicate_projects(uid)
    grp = [g for g in groups if g["name"] == NAME_A and g["params_json"] == PARAMS_A]
    check("the 3 identical rows report as one group of 3", grp and grp[0]["copies"], 3)
    check("singletons are not reported",
          any(g["params_json"] == PARAMS_B for g in groups), False)
    check("report deletes nothing",
          db.list_projects(uid).__len__() >= 5, True)

    print()
    if FAILS:
        print(f"PROJECT DEDUPE: {len(FAILS)} FAILED -> " + "; ".join(FAILS[:5]))
        sys.exit(1)
    print("PROJECT DEDUPE: all checks passed")


if __name__ == "__main__":
    main()
