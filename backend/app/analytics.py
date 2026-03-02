"""
SimpleBlueprints — Analytics
Lightweight SQLite-based tracking for PDF generations.
Access dashboard at /admin
"""

import sqlite3
import hashlib
import time
import json
import os
from pathlib import Path
from contextlib import contextmanager

# Store DB in /tmp (Railway ephemeral) or persistent volume if available
PERSIST_DIR = Path(os.getenv("RAILWAY_VOLUME_MOUNT_PATH", "/tmp"))
DB_PATH = PERSIST_DIR / "simpleblueprints_analytics.db"


@contextmanager
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    """Create tables if they don't exist."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS generations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                ip_hash TEXT,
                deck_width REAL,
                deck_depth REAL,
                deck_height REAL,
                deck_area REAL,
                attachment TEXT,
                has_stairs INTEGER,
                stair_location TEXT,
                decking_type TEXT,
                rail_type TEXT,
                source TEXT DEFAULT 'test',
                user_agent TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS page_views (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                ip_hash TEXT,
                path TEXT,
                user_agent TEXT
            )
        """)


def hash_ip(ip: str) -> str:
    """One-way hash of IP for unique user counting without storing PII."""
    salt = os.getenv("IP_SALT", "simpleblueprints-2026")
    return hashlib.sha256(f"{salt}:{ip}".encode()).hexdigest()[:16]


def log_generation(params: dict, calc: dict, ip: str = "", user_agent: str = "", source: str = "test"):
    """Log a PDF generation event."""
    try:
        with get_db() as conn:
            conn.execute("""
                INSERT INTO generations
                (timestamp, ip_hash, deck_width, deck_depth, deck_height, deck_area,
                 attachment, has_stairs, stair_location, decking_type, rail_type, source, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                time.time(),
                hash_ip(ip),
                params.get("width"),
                params.get("depth"),
                params.get("height"),
                calc.get("area"),
                params.get("attachment"),
                1 if params.get("hasStairs") else 0,
                params.get("stairLocation"),
                params.get("deckingType"),
                params.get("railType"),
                source,
                (user_agent or "")[:200],
            ))
    except Exception as e:
        print(f"Analytics log error: {e}")


def log_page_view(ip: str, path: str, user_agent: str = ""):
    """Log a page view."""
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO page_views (timestamp, ip_hash, path, user_agent) VALUES (?, ?, ?, ?)",
                (time.time(), hash_ip(ip), path, (user_agent or "")[:200])
            )
    except Exception as e:
        print(f"Analytics pageview error: {e}")


def get_stats() -> dict:
    """Get dashboard stats."""
    with get_db() as conn:
        now = time.time()
        day_ago = now - 86400
        week_ago = now - 604800
        month_ago = now - 2592000

        # Total generations
        total = conn.execute("SELECT COUNT(*) as c FROM generations").fetchone()["c"]
        today = conn.execute("SELECT COUNT(*) as c FROM generations WHERE timestamp > ?", (day_ago,)).fetchone()["c"]
        this_week = conn.execute("SELECT COUNT(*) as c FROM generations WHERE timestamp > ?", (week_ago,)).fetchone()["c"]
        this_month = conn.execute("SELECT COUNT(*) as c FROM generations WHERE timestamp > ?", (month_ago,)).fetchone()["c"]

        # Unique users (by IP hash)
        unique_total = conn.execute("SELECT COUNT(DISTINCT ip_hash) as c FROM generations").fetchone()["c"]
        unique_today = conn.execute("SELECT COUNT(DISTINCT ip_hash) as c FROM generations WHERE timestamp > ?", (day_ago,)).fetchone()["c"]
        unique_week = conn.execute("SELECT COUNT(DISTINCT ip_hash) as c FROM generations WHERE timestamp > ?", (week_ago,)).fetchone()["c"]

        # Page views
        pv_total = conn.execute("SELECT COUNT(*) as c FROM page_views").fetchone()["c"]
        pv_today = conn.execute("SELECT COUNT(*) as c FROM page_views WHERE timestamp > ?", (day_ago,)).fetchone()["c"]
        pv_unique_today = conn.execute("SELECT COUNT(DISTINCT ip_hash) as c FROM page_views WHERE timestamp > ?", (day_ago,)).fetchone()["c"]

        # Popular configs
        top_sizes = conn.execute("""
            SELECT deck_width || 'x' || deck_depth as size, COUNT(*) as c
            FROM generations GROUP BY size ORDER BY c DESC LIMIT 5
        """).fetchall()

        top_attachment = conn.execute("""
            SELECT attachment, COUNT(*) as c
            FROM generations GROUP BY attachment ORDER BY c DESC
        """).fetchall()

        top_decking = conn.execute("""
            SELECT decking_type, COUNT(*) as c
            FROM generations GROUP BY decking_type ORDER BY c DESC
        """).fetchall()

        stair_pct = conn.execute("""
            SELECT ROUND(100.0 * SUM(has_stairs) / MAX(COUNT(*), 1), 1) as pct
            FROM generations
        """).fetchone()["pct"] or 0

        # Daily generation counts (last 30 days)
        daily = conn.execute("""
            SELECT DATE(timestamp, 'unixepoch') as day, COUNT(*) as c
            FROM generations
            WHERE timestamp > ?
            GROUP BY day ORDER BY day
        """, (month_ago,)).fetchall()

        # Recent generations
        recent = conn.execute("""
            SELECT timestamp, ip_hash, deck_width, deck_depth, deck_height, 
                   deck_area, attachment, decking_type, has_stairs, stair_location
            FROM generations ORDER BY timestamp DESC LIMIT 20
        """).fetchall()

        return {
            "generations": {"total": total, "today": today, "this_week": this_week, "this_month": this_month},
            "unique_users": {"total": unique_total, "today": unique_today, "this_week": unique_week},
            "page_views": {"total": pv_total, "today": pv_today, "unique_today": pv_unique_today},
            "popular": {
                "sizes": [{"size": r["size"], "count": r["c"]} for r in top_sizes],
                "attachment": [{"type": r["attachment"], "count": r["c"]} for r in top_attachment],
                "decking": [{"type": r["decking_type"], "count": r["c"]} for r in top_decking],
                "stairs_pct": stair_pct,
            },
            "daily": [{"date": r["day"], "count": r["c"]} for r in daily],
            "recent": [{
                "time": r["timestamp"], "ip": r["ip_hash"][:8], "size": f'{r["deck_width"]}x{r["deck_depth"]}',
                "height": r["deck_height"], "area": r["deck_area"], "attachment": r["attachment"],
                "decking": r["decking_type"], "stairs": bool(r["has_stairs"]), "stair_loc": r["stair_location"],
            } for r in recent],
        }


# ============================================================
# ADMIN DASHBOARD HTML
# ============================================================
def admin_dashboard_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBlueprints — Admin Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;700;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'DM Sans', system-ui, sans-serif; background: #0d1117; color: #c9d1d9; min-height: 100vh; }
.wrap { max-width: 1100px; margin: 0 auto; padding: 32px 20px; }
h1 { font-size: 22px; color: #58a6ff; margin-bottom: 4px; }
.sub { font-size: 12px; color: #484f58; font-family: 'DM Mono', monospace; margin-bottom: 28px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 28px; }
.card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 18px; }
.card .label { font-size: 10px; color: #484f58; font-family: 'DM Mono', monospace; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
.card .val { font-size: 32px; font-weight: 900; color: #e6edf3; }
.card .detail { font-size: 11px; color: #484f58; font-family: 'DM Mono', monospace; margin-top: 4px; }
.section { margin-bottom: 28px; }
.section h2 { font-size: 14px; color: #8b949e; font-family: 'DM Mono', monospace; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
table { width: 100%; border-collapse: collapse; background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }
th { text-align: left; padding: 10px 14px; font-size: 10px; color: #484f58; font-family: 'DM Mono', monospace; text-transform: uppercase; letter-spacing: 1px; background: #0d1117; border-bottom: 1px solid #30363d; }
td { padding: 8px 14px; font-size: 12px; font-family: 'DM Mono', monospace; border-bottom: 1px solid #21262d; color: #c9d1d9; }
tr:last-child td { border-bottom: none; }
.bar-wrap { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.bar-label { font-size: 11px; font-family: 'DM Mono', monospace; color: #8b949e; min-width: 100px; }
.bar { height: 18px; background: #238636; border-radius: 3px; min-width: 2px; transition: width 0.3s; }
.bar-val { font-size: 11px; font-family: 'DM Mono', monospace; color: #484f58; }
.chart { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 18px; height: 200px; display: flex; align-items: flex-end; gap: 3px; }
.chart-bar { background: #238636; border-radius: 2px 2px 0 0; min-width: 8px; flex: 1; position: relative; cursor: default; }
.chart-bar:hover { background: #3fb950; }
.chart-bar .tip { display: none; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #30363d; color: #e6edf3; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-family: 'DM Mono', monospace; white-space: nowrap; margin-bottom: 4px; }
.chart-bar:hover .tip { display: block; }
.refresh { background: #21262d; border: 1px solid #30363d; color: #8b949e; padding: 6px 16px; border-radius: 6px; font-size: 11px; font-family: 'DM Mono', monospace; cursor: pointer; float: right; }
.refresh:hover { background: #30363d; color: #e6edf3; }
.green { color: #3fb950; }
.loading { text-align: center; padding: 40px; color: #484f58; font-family: 'DM Mono', monospace; }
</style>
</head>
<body>
<div class="wrap" id="app">
<div class="loading">Loading dashboard...</div>
</div>
<script>
async function load() {
  try {
    const res = await fetch('/admin/api/stats');
    const d = await res.json();
    render(d);
  } catch(e) {
    document.getElementById('app').innerHTML = '<div class="loading">Error loading stats: ' + e.message + '</div>';
  }
}

function ts(epoch) {
  const d = new Date(epoch * 1000);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return Math.floor(diff) + 's ago';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

function render(d) {
  const g = d.generations, u = d.unique_users, pv = d.page_views, p = d.popular;
  const maxDaily = Math.max(...d.daily.map(x => x.count), 1);

  document.getElementById('app').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px">
      <div>
        <h1>SimpleBlueprints Dashboard</h1>
        <div class="sub">Analytics · PDF Generations · User Activity</div>
      </div>
      <button class="refresh" onclick="load()">↻ Refresh</button>
    </div>

    <div class="grid">
      <div class="card">
        <div class="label">Total PDFs Generated</div>
        <div class="val">${g.total}</div>
        <div class="detail">${g.today} today · ${g.this_week} this week</div>
      </div>
      <div class="card">
        <div class="label">Unique Users</div>
        <div class="val">${u.total}</div>
        <div class="detail">${u.today} today · ${u.this_week} this week</div>
      </div>
      <div class="card">
        <div class="label">Page Views</div>
        <div class="val">${pv.total}</div>
        <div class="detail">${pv.today} today · ${pv.unique_today} unique</div>
      </div>
      <div class="card">
        <div class="label">Stairs Included</div>
        <div class="val">${p.stairs_pct}%</div>
        <div class="detail">of all generated blueprints</div>
      </div>
    </div>

    <div class="section">
      <h2>Daily Generations (30 days)</h2>
      <div class="chart">
        ${d.daily.map(x => `
          <div class="chart-bar" style="height:${Math.max(x.count/maxDaily*100, 4)}%">
            <div class="tip">${x.date}: ${x.count}</div>
          </div>
        `).join('')}
        ${d.daily.length === 0 ? '<div style="color:#484f58;font-family:DM Mono,monospace;font-size:12px;margin:auto">No data yet</div>' : ''}
      </div>
    </div>

    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
      <div class="section">
        <h2>Popular Deck Sizes</h2>
        <div class="card">
          ${p.sizes.map(x => `
            <div class="bar-wrap">
              <div class="bar-label">${x.size}'</div>
              <div class="bar" style="width:${Math.max(x.count/Math.max(g.total,1)*100,5)}%"></div>
              <div class="bar-val">${x.count}</div>
            </div>
          `).join('') || '<div class="bar-val">No data yet</div>'}
        </div>
      </div>
      <div class="section">
        <h2>Preferences</h2>
        <div class="card">
          ${p.attachment.map(x => `
            <div class="bar-wrap">
              <div class="bar-label">${x.type || 'unknown'}</div>
              <div class="bar" style="width:${Math.max(x.count/Math.max(g.total,1)*100,5)}%"></div>
              <div class="bar-val">${x.count}</div>
            </div>
          `).join('')}
          ${p.decking.map(x => `
            <div class="bar-wrap">
              <div class="bar-label">${x.type || 'unknown'}</div>
              <div class="bar" style="width:${Math.max(x.count/Math.max(g.total,1)*100,5)}%"></div>
              <div class="bar-val">${x.count}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Recent Generations</h2>
      <table>
        <tr><th>When</th><th>User</th><th>Size</th><th>Height</th><th>Area</th><th>Attach</th><th>Decking</th><th>Stairs</th></tr>
        ${d.recent.map(r => `
          <tr>
            <td>${ts(r.time)}</td>
            <td>${r.ip}</td>
            <td>${r.size}'</td>
            <td>${r.height}'</td>
            <td>${r.area} SF</td>
            <td>${r.attachment}</td>
            <td>${r.decking}</td>
            <td>${r.stairs ? '<span class="green">' + r.stair_loc + '</span>' : '—'}</td>
          </tr>
        `).join('') || '<tr><td colspan="8" style="text-align:center;color:#484f58">No generations yet</td></tr>'}
      </table>
    </div>
  `;
}

load();
setInterval(load, 30000);
</script>
</body>
</html>"""
