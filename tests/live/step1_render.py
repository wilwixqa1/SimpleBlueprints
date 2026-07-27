#!/usr/bin/env python3
"""Render step 1 of the real wizard and screenshot it.

Not a mock. This loads backend/static/index.html exactly as production serves
it, stubs only the network calls the container cannot make, and seeds the
sb_auth_state snapshot the app already uses to restore a design after OAuth.
That is the app's own resume path, so we land in step 1 through supported code
rather than by poking React internals.
"""
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8099/static/index.html"

USER = {"authenticated": True,
        "user": {"id": 1, "email": "harness@local", "name": "Harness"}}

# A two-section deck: main deck plus Deck B (right) and Deck C (left).
STATE = {
    "page": "wizard",
    "step": 1,
    "sitePlanMode": "guided",
    "info": {"name": "Harness", "address": "1 Test St"},
    "p": {
        "width": 21.5, "depth": 12, "height": 4,
        "houseWidth": 40, "houseDepth": 30,
        "attachment": "ledger", "joistSpacing": 16,
        "deckingType": "composite", "railType": "wood",
        "snowLoad": "moderate", "frostZone": "cold",
        "lotWidth": 80, "lotDepth": 120,
        "setbackFront": 25, "setbackSide": 5, "setbackRear": 20,
        "houseOffsetSide": 20, "beamType": "dropped", "framingType": "wood",
        "activeZone": 0, "nextZoneId": 3,
        "zones": [
            {"id": 1, "type": "add", "attachEdge": "right", "attachOffset": 0,
             "w": 8, "d": 8, "h": None, "attachTo": 0, "label": "Zone 1",
             "joistDir": "perpendicular", "beamType": "dropped", "stairs": None},
            {"id": 2, "type": "add", "attachEdge": "left", "attachOffset": 0,
             "w": 6, "d": 6, "h": None, "attachTo": 0, "label": "Zone 2",
             "joistDir": "perpendicular", "beamType": "dropped", "stairs": None},
        ],
        "deckStairs": [{"id": 0, "zoneId": 0, "location": "front",
                        "offset": 0, "width": 4, "numStringers": 3}],
    },
}


def run(active_zone, tag, width, height):
    STATE["p"]["activeZone"] = active_zone
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--no-sandbox", "--ignore-certificate-errors"])
        pg = b.new_page(viewport={"width": width, "height": height}, ignore_https_errors=True)

        errors = []
        pg.on("pageerror", lambda e: errors.append("PAGEERROR: "+str(e)[:300]))
        pg.on("requestfailed", lambda r: errors.append("FAILED " + r.url[:90] + " :: " + str(r.failure)[:60]))
        pg.on("response", lambda r: errors.append("HTTP%d %s" % (r.status, r.url[:90])) if r.status >= 400 else None)
        pg.on("console", lambda m: errors.append("console." + m.type + ": " + m.text[:200])
              if m.type == "error" else None)

        pg.route("**/auth/me", lambda r: r.fulfill(
            status=200, content_type="application/json", body=json.dumps(USER)))
        pg.route("**/api/**", lambda r: r.fulfill(
            status=200, content_type="application/json", body="{}"))

        pg.add_init_script(
            "localStorage.setItem('sb_auth_state', %s);" % json.dumps(json.dumps(STATE)))

        pg.goto(BASE, wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(4000)

        # Measure rather than eyeball: how tall is the left column really?
        metrics = pg.evaluate("""() => {
            const t = document.body.innerText || "";
            const sec = document.querySelector('[data-section="deckSize"]');
            const col = sec ? sec.closest('div[style*="flex"]') || sec.parentElement : null;
            const q = s => { const e=document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : null; };
            return {
              bodyScrollHeight: document.body.scrollHeight,
              viewportHeight: window.innerHeight,
              hasSizeShape: t.includes("Size & Shape"),
              hasSections: t.includes("SECTIONS") || t.includes("Sections"),
              hasDeckA: t.includes("Deck A"),
              stillSaysZone: (t.match(/\\bZone\\b/g) || []).length,
              sectionHeights: {
                deckSize: q('[data-section="deckSize"]'),
                chamfer: q('[data-section="chamfer"]'),
                attachment: q('[data-section="attachment"]'),
                stairs: q('[data-section="stairs"]'),
                advanced: q('[data-section="advanced"]'),
              },
            };
        }""")

        pg.screenshot(path="/mnt/user-data/outputs/step1_%s.png" % tag, full_page=True)
        b.close()
        return metrics, errors


if __name__ == "__main__":
    for active, tag, w, h in [(0, "maindeck_desktop", 1440, 1000),
                              (1, "section_desktop", 1440, 1000),
                              (0, "maindeck_mobile", 390, 844)]:
        m, errs = run(active, tag, w, h)
        print("### %s" % tag)
        print("   rendered:", m["hasSizeShape"], "| sections panel:", m["hasSections"],
              "| 'Deck A' present:", m["hasDeckA"], "| bare 'Zone' left:", m["stillSaysZone"])
        print("   page height %spx in a %spx viewport = %.1f screens"
              % (m["bodyScrollHeight"], m["viewportHeight"],
                 m["bodyScrollHeight"] / m["viewportHeight"]))
        print("   section heights:", m["sectionHeights"])
        if errs:
            print("   JS ERRORS:", errs[:4])
        print()
