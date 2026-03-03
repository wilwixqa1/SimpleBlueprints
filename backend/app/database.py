"""
SimpleBlueprints — Database
PostgreSQL via psycopg2. Tables: users, generations.
"""

import os
import time
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

DATABASE_URL = os.getenv("DATABASE_URL", "")


@contextmanager
def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_tables():
    """Create tables if they don't exist."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                google_id TEXT UNIQUE NOT NULL,
                email TEXT NOT NULL,
                name TEXT,
                picture TEXT,
                email_opt_in BOOLEAN DEFAULT TRUE,
                created_at DOUBLE PRECISION NOT NULL,
                last_login DOUBLE PRECISION NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS generations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                timestamp DOUBLE PRECISION NOT NULL,
                deck_width REAL,
                deck_depth REAL,
                deck_height REAL,
                deck_area REAL,
                attachment TEXT,
                has_stairs BOOLEAN,
                stair_location TEXT,
                decking_type TEXT,
                rail_type TEXT,
                params_json TEXT,
                file_id TEXT,
                emailed BOOLEAN DEFAULT FALSE
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS page_views (
                id SERIAL PRIMARY KEY,
                timestamp DOUBLE PRECISION NOT NULL,
                ip_hash TEXT,
                path TEXT,
                user_agent TEXT
            )
        """)
        cur.close()


# ============================================================
# USER OPERATIONS
# ============================================================

def upsert_user(google_id: str, email: str, name: str, picture: str) -> dict:
    """Create or update user on login. Returns user dict."""
    now = time.time()
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Try update first
        cur.execute("""
            UPDATE users SET email=%s, name=%s, picture=%s, last_login=%s
            WHERE google_id=%s RETURNING *
        """, (email, name, picture, now, google_id))
        row = cur.fetchone()
        if row:
            return dict(row)
        # Insert new
        cur.execute("""
            INSERT INTO users (google_id, email, name, picture, email_opt_in, created_at, last_login)
            VALUES (%s, %s, %s, %s, TRUE, %s, %s) RETURNING *
        """, (google_id, email, name, picture, now, now))
        row = cur.fetchone()
        return dict(row)


def get_user_by_id(user_id: int) -> dict | None:
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM users WHERE id=%s", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def update_email_opt_in(user_id: int, opt_in: bool):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE users SET email_opt_in=%s WHERE id=%s", (opt_in, user_id))


def get_all_users() -> list:
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM users ORDER BY created_at DESC")
        return [dict(r) for r in cur.fetchall()]


# ============================================================
# GENERATION LOGGING
# ============================================================

def log_generation(user_id: int, params: dict, calc: dict, file_id: str) -> int:
    """Log a PDF generation. Returns generation id."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO generations
            (user_id, timestamp, deck_width, deck_depth, deck_height, deck_area,
             attachment, has_stairs, stair_location, decking_type, rail_type,
             params_json, file_id, emailed)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE)
            RETURNING id
        """, (
            user_id,
            time.time(),
            params.get("width"),
            params.get("depth"),
            params.get("height"),
            calc.get("area"),
            params.get("attachment"),
            params.get("hasStairs", False),
            params.get("stairLocation"),
            params.get("deckingType"),
            params.get("railType"),
            json.dumps(params)[:5000],
            file_id,
        ))
        return cur.fetchone()[0]


def mark_emailed(gen_id: int):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE generations SET emailed=TRUE WHERE id=%s", (gen_id,))


# ============================================================
# PAGE VIEW LOGGING
# ============================================================

def log_page_view(ip_hash: str, path: str, user_agent: str = ""):
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO page_views (timestamp, ip_hash, path, user_agent) VALUES (%s, %s, %s, %s)",
                (time.time(), ip_hash, path, (user_agent or "")[:200])
            )
    except Exception as e:
        print(f"Page view log error: {e}")


# ============================================================
# ADMIN STATS
# ============================================================

def get_stats() -> dict:
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        now = time.time()
        day_ago = now - 86400
        week_ago = now - 604800
        month_ago = now - 2592000

        # Generations
        cur.execute("SELECT COUNT(*) as c FROM generations")
        total = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM generations WHERE timestamp > %s", (day_ago,))
        today = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM generations WHERE timestamp > %s", (week_ago,))
        this_week = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM generations WHERE timestamp > %s", (month_ago,))
        this_month = cur.fetchone()["c"]

        # Users
        cur.execute("SELECT COUNT(*) as c FROM users")
        users_total = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM users WHERE created_at > %s", (day_ago,))
        users_today = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM users WHERE created_at > %s", (week_ago,))
        users_week = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM users WHERE email_opt_in = TRUE")
        users_opted_in = cur.fetchone()["c"]

        # Page views
        cur.execute("SELECT COUNT(*) as c FROM page_views")
        pv_total = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM page_views WHERE timestamp > %s", (day_ago,))
        pv_today = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(DISTINCT ip_hash) as c FROM page_views WHERE timestamp > %s", (day_ago,))
        pv_unique_today = cur.fetchone()["c"]

        # Popular configs
        cur.execute("""
            SELECT deck_width || 'x' || deck_depth as size, COUNT(*) as c
            FROM generations GROUP BY size ORDER BY c DESC LIMIT 5
        """)
        top_sizes = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT attachment, COUNT(*) as c
            FROM generations GROUP BY attachment ORDER BY c DESC
        """)
        top_attachment = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT decking_type, COUNT(*) as c
            FROM generations GROUP BY decking_type ORDER BY c DESC
        """)
        top_decking = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT ROUND(100.0 * SUM(CASE WHEN has_stairs THEN 1 ELSE 0 END) / GREATEST(COUNT(*), 1), 1) as pct
            FROM generations
        """)
        stair_pct = cur.fetchone()["pct"] or 0

        # Daily (30 days)
        cur.execute("""
            SELECT TO_CHAR(TO_TIMESTAMP(timestamp), 'YYYY-MM-DD') as day, COUNT(*) as c
            FROM generations WHERE timestamp > %s GROUP BY day ORDER BY day
        """, (month_ago,))
        daily = [dict(r) for r in cur.fetchall()]

        # Recent generations with user info
        cur.execute("""
            SELECT g.timestamp, u.email, u.name, g.deck_width, g.deck_depth,
                   g.deck_height, g.deck_area, g.attachment, g.decking_type,
                   g.has_stairs, g.stair_location, g.emailed
            FROM generations g LEFT JOIN users u ON g.user_id = u.id
            ORDER BY g.timestamp DESC LIMIT 20
        """)
        recent = [dict(r) for r in cur.fetchall()]

        # User list
        cur.execute("""
            SELECT u.id, u.email, u.name, u.email_opt_in, u.created_at, u.last_login,
                   COUNT(g.id) as gen_count
            FROM users u LEFT JOIN generations g ON u.id = g.user_id
            GROUP BY u.id ORDER BY u.created_at DESC
        """)
        user_list = [dict(r) for r in cur.fetchall()]

        return {
            "generations": {"total": total, "today": today, "this_week": this_week, "this_month": this_month},
            "users": {"total": users_total, "today": users_today, "this_week": users_week, "opted_in": users_opted_in},
            "page_views": {"total": pv_total, "today": pv_today, "unique_today": pv_unique_today},
            "popular": {
                "sizes": [{"size": r["size"], "count": r["c"]} for r in top_sizes],
                "attachment": [{"type": r["attachment"], "count": r["c"]} for r in top_attachment],
                "decking": [{"type": r["decking_type"], "count": r["c"]} for r in top_decking],
                "stairs_pct": float(stair_pct),
            },
            "daily": [{"date": r["day"], "count": r["c"]} for r in daily],
            "recent": [{
                "time": r["timestamp"], "email": r["email"] or "—", "name": r["name"] or "—",
                "size": f'{r["deck_width"]}x{r["deck_depth"]}',
                "height": r["deck_height"], "area": r["deck_area"],
                "attachment": r["attachment"], "decking": r["decking_type"],
                "stairs": bool(r["has_stairs"]), "stair_loc": r["stair_location"],
                "emailed": r["emailed"],
            } for r in recent],
            "user_list": [{
                "id": r["id"], "email": r["email"], "name": r["name"],
                "opted_in": r["email_opt_in"], "created": r["created_at"],
                "last_login": r["last_login"], "generations": r["gen_count"],
            } for r in user_list],
        }


def store_feedback(feedback: dict):
    """Store user feedback in the feedback table."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            role TEXT,
            source TEXT,
            price TEXT,
            feedback_text TEXT,
            email TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute(
        "INSERT INTO feedback (user_id, role, source, price, feedback_text, email) VALUES (%s, %s, %s, %s, %s, %s)",
        (feedback.get("user_id"), feedback.get("role", ""), feedback.get("source", ""),
         feedback.get("price", ""), feedback.get("feedback", ""), feedback.get("email", ""))
    )
    conn.commit()
