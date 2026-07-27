"""S104: the address-lookup analytics block, against a REAL Postgres.

WHY THIS EXISTS
---------------
Will's question in S104 was "do we have actual users that are not me and Billy
and my dad?" The address lookup is the earliest signal of that, because
/api/parcel-lookup has no auth check, so a stranger who never signs up still
shows up. These numbers are decision-grade, and wrong analytics are the worst
kind of bug: they never throw, they just quietly say the wrong thing.

Two real bugs were caught by writing this, both of which would have shipped:

  1. `LIKE 'parcel_lookup%'` -- psycopg2 reads the % as a parameter placeholder
     and raises IndexError. The admin dashboard would have 500'd on load.
  2. The per-address `attempts` column summed every parcel_lookup* event, so
     two attempts reported as four.

Neither is visible by reading the SQL. Both took one execution to find.

WHAT IT GUARDS
--------------
It calls the SHIPPED get_analytics_v2 rather than a retyped copy of the query.
A test that re-implements the SQL stays green while the real one breaks; that
is S103 learning 3 (test the call site, not the helper) and it is why the
fixture goes through db.init_tables() instead of hand-rolled CREATE statements
-- a hand-rolled schema can drift from production and hide a column rename.

Run: python3 tests/test_lookup_analytics.py
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


def seed():
    db.init_tables()
    with db.get_db() as conn:
        cur = conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS feedback (
            id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW(),
            rating INTEGER, comment TEXT, email TEXT, phase TEXT, session_id TEXT)""")

        # Two anonymous strangers sharing one IP, one on their own, one signed-in
        # user, and one bot that must be excluded from every single number.
        for sid, aid, uid, ip, bot in [
            ("s_anon1", "a1", None, "ip_AAA", False),
            ("s_anon2", "a2", None, "ip_BBB", False),
            ("s_anon3", "a3", None, "ip_AAA", False),
            ("s_auth", "a4", 7, "ip_CCC", False),
            ("s_bot", "a9", None, "ip_ZZZ", True),
        ]:
            cur.execute(
                "INSERT INTO sessions (session_id,anonymous_id,user_id,ip_hash,is_bot)"
                " VALUES (%s,%s,%s,%s,%s)", (sid, aid, uid, ip, bot))

        def ev(sid, aid, uid, et, data):
            cur.execute(
                "INSERT INTO events (session_id,anonymous_id,user_id,event_type,event_data)"
                " VALUES (%s,%s,%s,%s,%s)", (sid, aid, uid, et, json.dumps(data)))

        A1 = {"address": "4739 Sweetgrass Lane", "state": "CO"}
        A2 = {"address": "11 Nowhere Rd", "state": "CO"}
        A3 = {"address": "800 Meadowview Dr", "state": "CO"}

        # resolves, fresh from the Realie API
        ev("s_anon1", "a1", None, "parcel_lookup_start", A1)
        ev("s_anon1", "a1", None, "parcel_lookup", dict(A1, cached=False))
        # fails twice, once per failure KIND -- these stay separate on purpose:
        # no_parcel is a data gap we could fill, network is our own flakiness.
        ev("s_anon2", "a2", None, "parcel_lookup_start", A2)
        ev("s_anon2", "a2", None, "parcel_lookup_failed", dict(A2, kind="no_parcel", reason="No parcel found"))
        ev("s_anon2", "a2", None, "parcel_lookup_start", A2)
        ev("s_anon2", "a2", None, "parcel_lookup_failed", dict(A2, kind="network", reason="timeout"))
        # same address as anon1, so this one is served from parcel_cache
        ev("s_anon3", "a3", None, "parcel_lookup_start", A1)
        ev("s_anon3", "a3", None, "parcel_lookup", dict(A1, cached=True))
        ev("s_auth", "a4", 7, "parcel_lookup_start", A3)
        ev("s_auth", "a4", 7, "parcel_lookup", dict(A3, cached=False))
        # bot -- excluded everywhere by the NOT s.is_bot filter
        ev("s_bot", "a9", None, "parcel_lookup_start", A1)
        ev("s_bot", "a9", None, "parcel_lookup", dict(A1, cached=False))
        conn.commit()


def main():
    seed()
    L = db.get_analytics_v2(days=30, phase="all")["lookups"]

    print("\n1. Totals. attempts is the denominator that did not exist before S104:")
    print("   only the success path fired an event, so a failed lookup and a person")
    print("   who never typed an address were indistinguishable.")
    check("attempts", L["attempts"], 5)
    check("succeeded", L["succeeded"], 3)
    check("failed", L["failed"], 2)
    check("attempts balances (start = success + failed)",
          L["succeeded"] + L["failed"], L["attempts"])

    print("\n2. Failure kinds stay separate")
    check("failed_no_parcel", L["failed_no_parcel"], 1)
    check("failed_network", L["failed_network"], 1)

    print("\n3. Cache hit rate -- what you actually pay Realie for")
    check("cache_hits", L["cache_hits"], 1)

    print("\n4. Anonymous vs signed in. This is the whole point: lookups need no")
    print("   login, so strangers who never sign up are counted here.")
    check("sessions", L["sessions"], 4)
    check("sessions_anon", L["sessions_anon"], 3)
    check("sessions_auth", L["sessions_auth"], 1)
    check("anon + auth = sessions", L["sessions_anon"] + L["sessions_auth"], L["sessions"])
    check("distinct visitors", L["visitors"], 4)
    check("distinct IPs (anon1 and anon3 share one)", L["ips"], 3)

    print("\n5. Bot exclusion. The bot fired a start and a success; if any number")
    print("   above were 6 / 5 instead of 5 / 4 the is_bot filter is not applying.")
    check("bot not in attempts", L["attempts"], 5)
    check("bot not in sessions", L["sessions"], 4)

    print("\n6. Per-address table. attempts counts parcel_lookup_start ONLY --")
    print("   the first version summed all three event types and doubled it.")
    by = {a["address"]: a for a in L["addresses"]}
    expected = {
        "11 NOWHERE RD": {"attempts": 2, "resolved": 0, "failed": 2, "sessions": 1},
        "4739 SWEETGRASS LANE": {"attempts": 2, "resolved": 2, "failed": 0, "sessions": 2},
        "800 MEADOWVIEW DR": {"attempts": 1, "resolved": 1, "failed": 0, "sessions": 1},
    }
    for addr, exp in expected.items():
        row = by.get(addr)
        if row is None:
            FAILS.append(f"{addr} missing")
            print(f"  [FAIL] {addr} missing from the address table")
            continue
        for k, v in exp.items():
            check(f"{addr} {k}", row[k], v)

    print("\n7. An address that NEVER resolved is still listed. Failures write no")
    print("   parcel_cache row, so if this regresses the address vanishes entirely.")
    check("never-resolved address present", "11 NOWHERE RD" in by, True)
    check("and shows zero resolutions", by.get("11 NOWHERE RD", {}).get("resolved"), 0)

    print()
    if FAILS:
        print(f"LOOKUP ANALYTICS: {len(FAILS)} FAILED -> " + "; ".join(FAILS[:5]))
        sys.exit(1)
    print("LOOKUP ANALYTICS: all checks passed")


if __name__ == "__main__":
    main()
