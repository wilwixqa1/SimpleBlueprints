#!/usr/bin/env python3
"""S87: FUZZ LOOP (oracle stack L1 + L2 at scale).

Generates seeded-random, UI-shaped deck configs and runs each through the
full PDF pipeline. Judges per config:
  L1 CRASH: generate_blueprint_pdf must not raise.
  L2 CHECKS: permit_checker.run_checks must complete (failing IRC checks
     are legitimate data for weird configs; RAISING is the bug).

Every failing seed's params are dumped to tests/pdf/fuzz_fixtures/ as a
permanent reproducer, per loop doctrine 8B lesson 6.

Usage:
  python3 tests/pdf/fuzz_configs.py [N] [--start SEED]
  (default N=8, start=1 -- the CI smoke batch; sessions run bigger N)
"""
import json
import os
import random
import sys
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import matplotlib
matplotlib.use("Agg")

FIXDIR = HERE / "fuzz_fixtures"

EDGES = ["left", "right", "front"]
STAIR_LOCS = ["front", "left", "right"]


def gen_config(seed):
    r = random.Random(seed)
    width = r.randint(8, 32)
    depth = r.randint(8, 20)
    p = {
        "width": width,
        "depth": depth,
        "height": r.choice([1, 2, 3, 4, 5, 6, 8, 9]),
        "attachment": r.choice(["ledger", "freestanding"]),
        "joistDir": r.choice(["width", "depth"]),
        "joistSpacing": r.choice([12, 16, 24]),
        "beamType": r.choice(["dropped", "flush"]),
        "deckingType": r.choice(["composite", "pt"]),
        "frostZone": r.choice(["warm", "moderate", "cold", "severe"]),
        "snowLoad": r.choice(["light", "moderate", "heavy"]),
        "slopePercent": r.choice([0, 0, 5, 10, 15]),
        "slopeDirection": r.choice(
            ["left-to-right", "right-to-left",
             "front-to-back", "back-to-front"]),
        "_gradeStyle": r.choice(["bench", "continuous"]),
        "zones": [],
        "deckStairs": [],
        "hasStairs": False,
    }
    nz = r.choice([0, 0, 1, 1, 2, 3])   # bias toward simple, cap 3 (S87)
    zid = 1
    used_edges = []
    for _ in range(nz):
        avail = [e for e in EDGES if e not in used_edges]
        if not avail:
            break
        edge = r.choice(avail)
        used_edges.append(edge)
        zw = r.randint(6, max(6, min(16, width - 2)))
        zd = r.randint(6, 14)
        p["zones"].append({
            "id": zid, "type": "add", "w": zw, "d": zd,
            "h": r.choice([None, None, p["height"],
                           max(1, p["height"] - 1)]),
            "attachTo": 0, "attachEdge": edge,
            "attachOffset": r.randint(0, 4),
            "joistDir": r.choice(["width", "depth"]),
            "beamType": r.choice(["dropped", "flush"]),
            "label": f"Zone {zid}",
        })
        zid += 1
    ns = r.choice([0, 1, 1, 2])
    sid = 1
    zone_ids = [0] + [z["id"] for z in p["zones"]]
    for _ in range(ns):
        p["deckStairs"].append({
            "id": sid,
            "zoneId": r.choice(zone_ids),
            "location": r.choice(STAIR_LOCS),
            "width": r.choice([3, 4, 5]),
            "template": "straight",
            "offset": r.randint(0, 3),
            "numStringers": r.choice([2, 3, 4]),
            "_landsOnZoneId": None,
        })
        sid += 1
    p["hasStairs"] = bool(p["deckStairs"])
    return p


def run_one(seed):
    p = gen_config(seed)
    try:
        from app.main import generate_blueprint_pdf
        generate_blueprint_pdf(dict(p))
    except Exception:
        return p, "CRASH:pipeline", traceback.format_exc(limit=4)
    # L2 note: generate_blueprint_pdf runs permit_checker.run_checks
    # internally (its "Permit checker: ..." line prints per config), so a
    # raising checker is already a pipeline crash -- no separate call needed.
    return p, "OK", None


def main(argv):
    n = 8
    start = 1
    args = [a for a in argv if not a.startswith("--")]
    if args:
        n = int(args[0])
    if "--start" in argv:
        start = int(argv[argv.index("--start") + 1])
    FIXDIR.mkdir(exist_ok=True)
    import matplotlib.pyplot as plt
    fails = 0
    for seed in range(start, start + n):
        p, status, tb = run_one(seed)
        plt.close("all")
        if status != "OK":
            fails += 1
            out = FIXDIR / f"seed_{seed}.json"
            out.write_text(json.dumps(
                {"seed": seed, "status": status, "params": p}, indent=1))
            first = [l for l in (tb or "").splitlines()
                     if l.strip()][-1] if tb else ""
            print(f"  seed {seed}: {status} -> {out.name}")
            print(f"      {first}")
        elif seed % 10 == 0:
            print(f"  seed {seed}: OK")
    print(f"FUZZ: {n} configs (seeds {start}..{start + n - 1}), "
          f"{fails} failures")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
