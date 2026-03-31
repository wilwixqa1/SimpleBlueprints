"""
SimpleBlueprints — Database
PostgreSQL via psycopg2. Tables: users, generations, page_views, events, ai_conversations, ai_insights.
Connection pooling via ThreadedConnectionPool (S55).
"""

import os
import time
import json
import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor, Json
from contextlib import contextmanager

DATABASE_URL = os.getenv("DATABASE_URL", "")
SB_PHASE = os.getenv("SB_PHASE", "testing")  # testing | beta | production

# ============================================================
# BOT DETECTION (module-level, shared by get_tracking_stats and get_stats)
# ============================================================
BOT_PATTERN = (
    "%%(bot|crawl|spider|slurp|bingpreview|facebookexternalhit"
    "|semrush|ahref|bytespider|gptbot|claudebot|petalbot|yandex"
    "|baidu|duckduckbot|ia_archiver|mj12bot|dotbot|rogerbot"
    "|dataforseo|blexbot|seznambot|megaindex"
    "|go-http-client|python-requests|curl/|wget/|scrapy"
    "|headless|phantom|puppeteer"
    "|palo alto|nessus|qualys|nikto|nmap|zgrab|masscan"
    "|req/|httpx/|axios/|node-fetch|undici|okhttp|java/"
    "|dalvik/|nexus 5 build|mra58n"
    "|trident/|msie "
    ")%%"
)
BOT_EXTRA_SQL = (
    " OR LENGTH(TRIM(user_agent)) < 15"
    " OR user_agent = 'Mozilla/5.0'"
    " OR LOWER(user_agent) ~ 'chrome/[1-9]\\.'"
    " OR LOWER(user_agent) ~ 'chrome/1[0-9]\\.'"
)
IS_BOT_SQL = f"(LOWER(user_agent) SIMILAR TO '{BOT_PATTERN}'{BOT_EXTRA_SQL})"
NOT_BOT_SQL = f"(NOT {IS_BOT_SQL})"

# ============================================================
# CONNECTION POOL (S55)
# ============================================================
# minconn=2: keep 2 connections warm at all times
# maxconn=15: cap at 15 to stay within Railway Postgres limits (typically 20-100)
_pool = None

def _get_pool():
    global _pool
    if _pool is None and DATABASE_URL:
        try:
            _pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=2, maxconn=15, dsn=DATABASE_URL
            )
        except Exception as e:
            print(f"Connection pool init error: {e}")
    return _pool


@contextmanager
def get_db():
    pool = _get_pool()
    if pool is None:
        # Fallback: direct connection if pool fails
        conn = psycopg2.connect(DATABASE_URL)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        return
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


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
        # S55: Events table (lean analytics pipeline)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                anonymous_id TEXT,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                event_data JSONB DEFAULT '{}',
                step INTEGER,
                guide_phase TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_events_anon ON events(anonymous_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at)")
        # S55: AI Conversations table (full text for intelligence)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ai_conversations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                anonymous_id TEXT,
                session_id TEXT NOT NULL,
                step INTEGER,
                guide_phase TEXT,
                role TEXT NOT NULL,
                message TEXT NOT NULL,
                actions JSONB,
                action_count INTEGER DEFAULT 0,
                cost_cents REAL DEFAULT 0,
                duration_ms INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_aiconv_session ON ai_conversations(session_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_aiconv_user ON ai_conversations(user_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_aiconv_created ON ai_conversations(created_at)")
        # S55: Add classify column if not exists
        try:
            cur.execute("ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS classify TEXT DEFAULT ''")
        except Exception:
            pass
        # S55: AI Insights table (batch analysis results)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ai_insights (
                id SERIAL PRIMARY KEY,
                conversation_count INTEGER NOT NULL,
                event_summary JSONB,
                feature_requests JSONB DEFAULT '[]',
                pain_points JSONB DEFAULT '[]',
                product_issues JSONB DEFAULT '[]',
                usage_patterns JSONB DEFAULT '[]',
                recommendations JSONB DEFAULT '[]',
                raw_analysis TEXT,
                trigger_type TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        # S62: Projects table (user-saved deck configurations)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) NOT NULL,
                name TEXT NOT NULL DEFAULT 'Untitled Deck',
                status TEXT NOT NULL DEFAULT 'draft',
                params_json TEXT,
                info_json TEXT,
                step INTEGER DEFAULT 0,
                site_plan_mode TEXT DEFAULT 'generate',
                survey_b64 TEXT,
                last_generation_id INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)")
        # S55: Add stripe_customer_id to users if not exists
        try:
            cur.execute("""
                ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT
            """)
        except Exception:
            pass
        # S55: Phase tagging - add phase column to all data tables, backfill as 'testing'
        for tbl in ['events', 'ai_conversations', 'generations', 'ai_insights']:
            try:
                cur.execute(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'testing'")
            except Exception:
                pass
        # Backfill any NULL phase values
        for tbl in ['events', 'ai_conversations', 'generations', 'ai_insights']:
            try:
                cur.execute(f"UPDATE {tbl} SET phase = 'testing' WHERE phase IS NULL")
            except Exception:
                pass
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
             params_json, file_id, emailed, phase)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE, %s)
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
            SB_PHASE,
        ))
        return cur.fetchone()[0]


def mark_emailed(gen_id: int):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE generations SET emailed=TRUE WHERE id=%s", (gen_id,))


# ============================================================
# PROJECT OPERATIONS (S62)
# ============================================================

def create_project(user_id: int, name: str = "Untitled Deck", params_json: str = None,
                   info_json: str = None, step: int = 0, site_plan_mode: str = "generate",
                   survey_b64: str = None) -> dict:
    """Create a new project. Returns project dict."""
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            INSERT INTO projects (user_id, name, params_json, info_json, step,
                                  site_plan_mode, survey_b64)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *
        """, (user_id, name, params_json, info_json, step, site_plan_mode, survey_b64))
        row = cur.fetchone()
        return dict(row)


def list_projects(user_id: int) -> list:
    """List all projects for a user (summary only, no survey blob)."""
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, name, status, step, site_plan_mode,
                   params_json, info_json, last_generation_id,
                   created_at, updated_at
            FROM projects WHERE user_id=%s
            ORDER BY updated_at DESC
        """, (user_id,))
        return [dict(r) for r in cur.fetchall()]


def get_project(project_id: int, user_id: int) -> dict | None:
    """Get full project including survey blob. Enforces ownership."""
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM projects WHERE id=%s AND user_id=%s", (project_id, user_id))
        row = cur.fetchone()
        return dict(row) if row else None


def update_project(project_id: int, user_id: int, **fields) -> dict | None:
    """Update project fields. Only updates provided keys. Enforces ownership."""
    allowed = {"name", "status", "params_json", "info_json", "step",
               "site_plan_mode", "survey_b64", "last_generation_id"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_project(project_id, user_id)
    set_parts = [f"{k}=%s" for k in updates]
    set_parts.append("updated_at=NOW()")
    vals = list(updates.values()) + [project_id, user_id]
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            f"UPDATE projects SET {', '.join(set_parts)} WHERE id=%s AND user_id=%s RETURNING *",
            vals
        )
        row = cur.fetchone()
        return dict(row) if row else None


def delete_project(project_id: int, user_id: int) -> bool:
    """Delete a project. Enforces ownership. Returns True if deleted."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM projects WHERE id=%s AND user_id=%s", (project_id, user_id))
        return cur.rowcount > 0


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
# EVENT TRACKING (S55)
# ============================================================

def log_event(event: dict):
    """Insert a single tracking event. Fire-and-forget safe."""
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO events (user_id, anonymous_id, session_id, event_type, event_data, step, guide_phase, phase)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                event.get("user_id"),
                event.get("anonymous_id"),
                event.get("session_id", ""),
                event.get("event_type", "unknown"),
                Json(event.get("event_data", {})),
                event.get("step"),
                event.get("guide_phase"),
                SB_PHASE,
            ))
    except Exception as e:
        print(f"Event log error: {e}")


def log_events_batch(events: list):
    """Insert multiple tracking events in one transaction."""
    if not events:
        return
    try:
        with get_db() as conn:
            cur = conn.cursor()
            for event in events:
                cur.execute("""
                    INSERT INTO events (user_id, anonymous_id, session_id, event_type, event_data, step, guide_phase, phase)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    event.get("user_id"),
                    event.get("anonymous_id"),
                    event.get("session_id", ""),
                    event.get("event_type", "unknown"),
                    Json(event.get("event_data", {})),
                    event.get("step"),
                    event.get("guide_phase"),
                    SB_PHASE,
                ))
    except Exception as e:
        print(f"Batch event log error: {e}")


def link_anonymous_to_user(anonymous_id: str, user_id: int):
    """On login, retroactively link anonymous events/conversations to the authenticated user."""
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("UPDATE events SET user_id = %s WHERE anonymous_id = %s AND user_id IS NULL", (user_id, anonymous_id))
            cur.execute("UPDATE ai_conversations SET user_id = %s WHERE anonymous_id = %s AND user_id IS NULL", (user_id, anonymous_id))
    except Exception as e:
        print(f"Link anonymous error: {e}")


# ============================================================
# AI CONVERSATION LOGGING (S55)
# ============================================================

def log_ai_message(msg: dict):
    """Log a single AI conversation message (user or assistant)."""
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO ai_conversations
                (user_id, anonymous_id, session_id, step, guide_phase, role, message, actions, action_count, cost_cents, duration_ms, classify, phase)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                msg.get("user_id"),
                msg.get("anonymous_id"),
                msg.get("session_id", ""),
                msg.get("step"),
                msg.get("guide_phase"),
                msg.get("role", "user"),
                (msg.get("message", ""))[:5000],
                Json(msg.get("actions")) if msg.get("actions") else None,
                msg.get("action_count", 0),
                msg.get("cost_cents", 0),
                msg.get("duration_ms"),
                msg.get("classify", ""),
                SB_PHASE,
            ))
    except Exception as e:
        print(f"AI message log error: {e}")


# ============================================================
# AI INSIGHTS (S55 - Batch Analysis)
# ============================================================

def should_generate_insight() -> bool:
    """Check if we should trigger a new insight: 50+ convos since last, or 7+ days."""
    try:
        with get_db() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            # Get last insight timestamp
            cur.execute("SELECT created_at FROM ai_insights ORDER BY created_at DESC LIMIT 1")
            last = cur.fetchone()
            if not last:
                # No insights yet; check if we have any conversations at all
                cur.execute("SELECT COUNT(*) as c FROM ai_conversations WHERE role = 'user'")
                count = cur.fetchone()["c"]
                return count >= 50
            last_ts = last["created_at"]
            # Check days since last insight
            cur.execute("SELECT EXTRACT(EPOCH FROM (NOW() - %s)) / 86400 as days", (last_ts,))
            days = cur.fetchone()["days"]
            if days >= 7:
                # Also need at least 5 conversations to be worth it
                cur.execute("SELECT COUNT(*) as c FROM ai_conversations WHERE role = 'user' AND created_at > %s", (last_ts,))
                return cur.fetchone()["c"] >= 5
            # Check conversation count since last insight
            cur.execute("SELECT COUNT(*) as c FROM ai_conversations WHERE role = 'user' AND created_at > %s", (last_ts,))
            count = cur.fetchone()["c"]
            return count >= 50
    except Exception as e:
        print(f"Insight check error: {e}")
        return False


def get_conversations_for_insight() -> list:
    """Get conversations since last insight for batch analysis."""
    try:
        with get_db() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT created_at FROM ai_insights ORDER BY created_at DESC LIMIT 1")
            last = cur.fetchone()
            since = last["created_at"] if last else "2020-01-01"
            cur.execute("""
                SELECT session_id, role, message, step, guide_phase, classify,
                       action_count, created_at
                FROM ai_conversations
                WHERE created_at > %s
                ORDER BY session_id, created_at
                LIMIT 500
            """, (since,))
            return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        print(f"Get conversations for insight error: {e}")
        return []


def get_event_summary_for_insight() -> dict:
    """Get event stats since last insight for context in batch analysis."""
    try:
        with get_db() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT created_at FROM ai_insights ORDER BY created_at DESC LIMIT 1")
            last = cur.fetchone()
            since = last["created_at"] if last else "2020-01-01"
            cur.execute("""
                SELECT event_type, COUNT(*) as c
                FROM events WHERE created_at > %s
                GROUP BY event_type ORDER BY c DESC
            """, (since,))
            event_counts = {r["event_type"]: r["c"] for r in cur.fetchall()}
            # Classify breakdown
            cur.execute("""
                SELECT classify, COUNT(*) as c
                FROM ai_conversations
                WHERE role = 'assistant' AND classify != '' AND created_at > %s
                GROUP BY classify ORDER BY c DESC
            """, (since,))
            classify_counts = {r["classify"]: r["c"] for r in cur.fetchall()}
            return {"event_counts": event_counts, "classify_counts": classify_counts}
    except Exception as e:
        print(f"Event summary for insight error: {e}")
        return {}


def save_insight(insight: dict):
    """Save a batch analysis insight."""
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO ai_insights
                (conversation_count, event_summary, feature_requests, pain_points,
                 product_issues, usage_patterns, recommendations, raw_analysis, trigger_type, phase)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                insight.get("conversation_count", 0),
                Json(insight.get("event_summary", {})),
                Json(insight.get("feature_requests", [])),
                Json(insight.get("pain_points", [])),
                Json(insight.get("product_issues", [])),
                Json(insight.get("usage_patterns", [])),
                Json(insight.get("recommendations", [])),
                insight.get("raw_analysis", ""),
                insight.get("trigger_type", "auto"),
                SB_PHASE,
            ))
    except Exception as e:
        print(f"Save insight error: {e}")


def get_latest_insight() -> dict | None:
    """Get the most recent insight for dashboard display."""
    try:
        with get_db() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("""
                SELECT * FROM ai_insights ORDER BY created_at DESC LIMIT 1
            """)
            row = cur.fetchone()
            return dict(row) if row else None
    except Exception as e:
        print(f"Get latest insight error: {e}")
        return None

def get_tracking_stats(days: int = 30) -> dict:
    """Get comprehensive tracking stats for the admin dashboard."""
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cutoff = f"NOW() - INTERVAL '{days} days'"

        # --- FUNNEL COUNTS ---
        funnel_types = [
            "session_start", "auth_login", "survey_upload",
            "extraction_complete", "shape_confirmed",
            "step_change", "pdf_generate_complete",
            "checkout_start", "checkout_complete"
        ]
        funnel = {}
        for et in funnel_types:
            cur.execute(f"""
                SELECT COUNT(*) as total,
                       COUNT(DISTINCT session_id) as sessions
                FROM events WHERE event_type = %s AND created_at >= {cutoff}
            """, (et,))
            row = cur.fetchone()
            funnel[et] = {"total": row["total"], "sessions": row["sessions"]}

        # --- DAILY EVENT COUNTS (for chart) ---
        cur.execute(f"""
            SELECT DATE(created_at) as day, event_type, COUNT(*) as c
            FROM events
            WHERE created_at >= {cutoff}
            GROUP BY day, event_type
            ORDER BY day
        """)
        daily_raw = [dict(r) for r in cur.fetchall()]
        # Reshape into {day: {type: count}}
        daily = {}
        for r in daily_raw:
            d = str(r["day"])
            if d not in daily:
                daily[d] = {}
            daily[d][r["event_type"]] = r["c"]

        # --- EXTRACTION STATS ---
        cur.execute(f"""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE (event_data->>'success')::boolean = true) as successes,
                AVG((event_data->>'duration_ms')::numeric) as avg_duration_ms,
                COUNT(*) FILTER (WHERE event_data ? 'confidence') as has_confidence
            FROM events
            WHERE event_type = 'extraction_complete' AND created_at >= {cutoff}
        """)
        extraction = dict(cur.fetchone())

        # --- EXTRACTION CONFIDENCE BREAKDOWN ---
        # Flatten the confidence JSON object and count high/medium/low per field
        cur.execute(f"""
            SELECT kv.key as field, kv.value as level, COUNT(*) as c
            FROM events, jsonb_each_text(event_data->'confidence') as kv
            WHERE event_type = 'extraction_complete' AND created_at >= {cutoff}
                AND event_data ? 'confidence'
                AND jsonb_typeof(event_data->'confidence') = 'object'
            GROUP BY kv.key, kv.value
            ORDER BY kv.key, kv.value
        """)
        conf_raw = cur.fetchall()
        # Reshape into {field: {high: N, medium: N, low: N}}
        confidence_breakdown = {}
        for r in conf_raw:
            field = r["field"]
            if field not in confidence_breakdown:
                confidence_breakdown[field] = {"high": 0, "medium": 0, "low": 0}
            if r["level"] in ("high", "medium", "low"):
                confidence_breakdown[field][r["level"]] = r["c"]
        extraction["confidence_breakdown"] = confidence_breakdown

        # --- AUTO-CONFIRM / MIRROR STATS ---
        cur.execute(f"""
            SELECT
                event_data->>'action' as action, COUNT(*) as c
            FROM events
            WHERE event_type = 'auto_confirm_action' AND created_at >= {cutoff}
            GROUP BY action
        """)
        auto_confirm = {r["action"]: r["c"] for r in cur.fetchall()}

        cur.execute(f"""
            SELECT COUNT(*) as fires,
                   COUNT(DISTINCT session_id) as sessions
            FROM events
            WHERE event_type = 'auto_mirror_fired' AND created_at >= {cutoff}
        """)
        auto_mirror = dict(cur.fetchone())

        cur.execute(f"""
            SELECT COUNT(*) as flips
            FROM events
            WHERE event_type = 'user_flip' AND created_at >= {cutoff}
        """)
        user_flips = cur.fetchone()["flips"]

        # --- STEP TIMING ---
        cur.execute(f"""
            SELECT
                (event_data->>'from_step')::int as from_step,
                AVG((event_data->>'duration_on_prev_step_ms')::numeric) as avg_ms,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (event_data->>'duration_on_prev_step_ms')::numeric) as median_ms,
                COUNT(*) as transitions
            FROM events
            WHERE event_type = 'step_change' AND created_at >= {cutoff}
                AND event_data ? 'duration_on_prev_step_ms'
            GROUP BY from_step
            ORDER BY from_step
        """)
        step_timing = [dict(r) for r in cur.fetchall()]

        # --- AI HELPER STATS ---
        cur.execute(f"""
            SELECT
                COUNT(*) as total_messages,
                COUNT(DISTINCT session_id) as sessions_with_ai,
                ROUND(COUNT(*)::numeric / GREATEST(COUNT(DISTINCT session_id), 1), 1) as avg_per_session,
                SUM(cost_cents) as total_cost_cents,
                ROUND(SUM(cost_cents)::numeric / GREATEST(COUNT(DISTINCT session_id), 1), 2) as avg_cost_per_session,
                AVG(duration_ms) FILTER (WHERE role = 'assistant') as avg_response_ms,
                SUM(action_count) FILTER (WHERE role = 'assistant') as total_actions,
                COUNT(*) FILTER (WHERE role = 'assistant' AND action_count > 0) as responses_with_actions
            FROM ai_conversations
            WHERE created_at >= {cutoff}
        """)
        ai_stats = dict(cur.fetchone())

        # --- AI: STUCK USERS (3+ messages same step without progressing) ---
        cur.execute(f"""
            SELECT session_id, step, COUNT(*) as msg_count,
                   MIN(message) as first_msg
            FROM ai_conversations
            WHERE role = 'user' AND created_at >= {cutoff}
            GROUP BY session_id, step
            HAVING COUNT(*) >= 4
            ORDER BY msg_count DESC
            LIMIT 20
        """)
        stuck_sessions = [dict(r) for r in cur.fetchall()]

        # --- AI: RECENT CONVERSATIONS (for review) ---
        cur.execute(f"""
            SELECT session_id, role, message, step, guide_phase, action_count,
                   actions, created_at
            FROM ai_conversations
            WHERE created_at >= {cutoff}
            ORDER BY created_at DESC
            LIMIT 100
        """)
        recent_conversations = [dict(r) for r in cur.fetchall()]

        # --- AI: UNIQUE USER MESSAGES (most common questions) ---
        cur.execute(f"""
            SELECT LOWER(TRIM(message)) as msg, COUNT(*) as c
            FROM ai_conversations
            WHERE role = 'user' AND created_at >= {cutoff}
            GROUP BY msg
            ORDER BY c DESC
            LIMIT 30
        """)
        common_questions = [dict(r) for r in cur.fetchall()]

        # --- ERROR EVENTS ---
        cur.execute(f"""
            SELECT event_type, event_data->>'error' as error, COUNT(*) as c
            FROM events
            WHERE event_type IN ('extraction_error', 'pdf_generate_error')
                AND created_at >= {cutoff}
            GROUP BY event_type, error
            ORDER BY c DESC
            LIMIT 20
        """)
        errors = [dict(r) for r in cur.fetchall()]

        # --- SESSIONS OVERVIEW ---
        cur.execute(f"""
            SELECT COUNT(DISTINCT session_id) as total_sessions,
                   COUNT(DISTINCT anonymous_id) FILTER (WHERE anonymous_id IS NOT NULL) as unique_visitors,
                   COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as logged_in_users
            FROM events
            WHERE created_at >= {cutoff}
        """)
        sessions = dict(cur.fetchone())

        # --- CHECKOUT STATS ---
        cur.execute(f"""
            SELECT
                COUNT(*) FILTER (WHERE event_type = 'checkout_start') as starts,
                COUNT(*) FILTER (WHERE event_type = 'checkout_complete') as completes,
                COUNT(*) FILTER (WHERE event_type = 'checkout_abandon') as abandons
            FROM events
            WHERE event_type IN ('checkout_start', 'checkout_complete', 'checkout_abandon')
                AND created_at >= {cutoff}
        """)
        checkout = dict(cur.fetchone())

        # --- AI CLASSIFY BREAKDOWN ---
        cur.execute(f"""
            SELECT classify, COUNT(*) as c
            FROM ai_conversations
            WHERE role = 'assistant' AND classify != '' AND classify IS NOT NULL
                AND created_at >= {cutoff}
            GROUP BY classify ORDER BY c DESC
        """)
        classify_breakdown = [dict(r) for r in cur.fetchall()]

        # --- LATEST INSIGHT ---
        latest_insight = get_latest_insight()

        return {
            "period_days": days,
            "sessions": sessions,
            "funnel": funnel,
            "daily": daily,
            "extraction": extraction,
            "auto_confirm": auto_confirm,
            "auto_mirror": {**auto_mirror, "user_flips": user_flips},
            "step_timing": step_timing,
            "ai_helper": {
                **ai_stats,
                "stuck_sessions": stuck_sessions,
                "common_questions": common_questions,
                "recent_conversations": recent_conversations,
                "classify_breakdown": classify_breakdown,
            },
            "checkout": checkout,
            "errors": errors,
            "latest_insight": {
                "feature_requests": latest_insight["feature_requests"] if latest_insight else [],
                "pain_points": latest_insight["pain_points"] if latest_insight else [],
                "product_issues": latest_insight["product_issues"] if latest_insight else [],
                "usage_patterns": latest_insight["usage_patterns"] if latest_insight else [],
                "recommendations": latest_insight["recommendations"] if latest_insight else [],
                "created_at": str(latest_insight["created_at"]) if latest_insight else None,
                "conversation_count": latest_insight["conversation_count"] if latest_insight else 0,
                "trigger_type": latest_insight["trigger_type"] if latest_insight else None,
            } if latest_insight else None,
        }


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

        # Traffic breakdown: bot vs human, daily uniques, top paths
        cur.execute(f"""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE {IS_BOT_SQL}) as bots,
                COUNT(DISTINCT ip_hash) as unique_ips,
                COUNT(DISTINCT ip_hash) FILTER (WHERE {NOT_BOT_SQL}) as unique_human_ips
            FROM page_views
        """)
        traffic = dict(cur.fetchone())

        # Daily unique IPs (last 30 days), human only
        cur.execute(f"""
            SELECT TO_CHAR(TO_TIMESTAMP(timestamp), 'YYYY-MM-DD') as day,
                   COUNT(*) as views,
                   COUNT(DISTINCT ip_hash) as unique_ips
            FROM page_views
            WHERE timestamp > %s
                AND {NOT_BOT_SQL}
            GROUP BY day ORDER BY day
        """, (month_ago,))
        daily_traffic = [dict(r) for r in cur.fetchall()]

        # Top paths (human only, all time)
        cur.execute(f"""
            SELECT path, COUNT(*) as views, COUNT(DISTINCT ip_hash) as unique_ips
            FROM page_views
            WHERE {NOT_BOT_SQL}
            GROUP BY path ORDER BY views DESC LIMIT 10
        """)
        top_paths = [dict(r) for r in cur.fetchall()]

        # Top bot user agents (for awareness)
        cur.execute(f"""
            SELECT
                CASE
                    WHEN LOWER(user_agent) LIKE '%%googlebot%%' THEN 'Googlebot'
                    WHEN LOWER(user_agent) LIKE '%%bingbot%%' OR LOWER(user_agent) LIKE '%%bingpreview%%' THEN 'Bing'
                    WHEN LOWER(user_agent) LIKE '%%semrush%%' THEN 'SEMrush'
                    WHEN LOWER(user_agent) LIKE '%%ahref%%' THEN 'Ahrefs'
                    WHEN LOWER(user_agent) LIKE '%%bytespider%%' THEN 'ByteSpider'
                    WHEN LOWER(user_agent) LIKE '%%gptbot%%' THEN 'GPTBot'
                    WHEN LOWER(user_agent) LIKE '%%claudebot%%' THEN 'ClaudeBot'
                    WHEN LOWER(user_agent) LIKE '%%petalbot%%' THEN 'PetalBot'
                    WHEN LOWER(user_agent) LIKE '%%yandex%%' THEN 'Yandex'
                    WHEN LOWER(user_agent) LIKE '%%facebookexternalhit%%' THEN 'Facebook'
                    WHEN LOWER(user_agent) LIKE '%%duckduckbot%%' THEN 'DuckDuckBot'
                    WHEN LOWER(user_agent) LIKE '%%dataforseo%%' THEN 'DataForSEO'
                    WHEN LOWER(user_agent) LIKE '%%python-requests%%' THEN 'python-requests'
                    WHEN LOWER(user_agent) LIKE '%%go-http-client%%' THEN 'Go-http-client'
                    WHEN LOWER(user_agent) LIKE '%%palo alto%%' THEN 'Palo Alto Scanner'
                    WHEN LOWER(user_agent) LIKE '%%req/%%' OR LOWER(user_agent) LIKE '%%httpx/%%' THEN 'HTTP library'
                    WHEN LOWER(user_agent) LIKE '%%dalvik/%%' THEN 'Dalvik'
                    WHEN LOWER(user_agent) LIKE '%%trident/%%' OR LOWER(user_agent) LIKE '%%msie %%' THEN 'Ancient IE'
                    WHEN LOWER(user_agent) ~ 'chrome/[1-9]\.' OR LOWER(user_agent) ~ 'chrome/1[0-9]\.' THEN 'Ancient Chrome'
                    WHEN LENGTH(TRIM(user_agent)) < 15 OR user_agent = 'Mozilla/5.0' THEN 'Bare/empty UA'
                    ELSE 'Other bot'
                END as bot_name,
                COUNT(*) as hits
            FROM page_views
            WHERE {IS_BOT_SQL}
            GROUP BY bot_name ORDER BY hits DESC LIMIT 15
        """)
        top_bots = [dict(r) for r in cur.fetchall()]

        # Top "human" user agents (to spot stealth bots)
        cur.execute(f"""
            SELECT
                CASE
                    WHEN LENGTH(user_agent) < 30 THEN user_agent
                    ELSE SUBSTRING(user_agent FROM 1 FOR 80)
                END as ua_short,
                COUNT(*) as hits,
                COUNT(DISTINCT ip_hash) as unique_ips
            FROM page_views
            WHERE {NOT_BOT_SQL}
            GROUP BY ua_short ORDER BY hits DESC LIMIT 15
        """)
        top_human_uas = [dict(r) for r in cur.fetchall()]

        # IP visit frequency: how many IPs visited 1x, 2-5x, 6-20x, 20+
        cur.execute(f"""
            SELECT
                CASE
                    WHEN visit_count = 1 THEN '1 visit'
                    WHEN visit_count BETWEEN 2 AND 5 THEN '2-5 visits'
                    WHEN visit_count BETWEEN 6 AND 20 THEN '6-20 visits'
                    ELSE '20+ visits'
                END as bucket,
                COUNT(*) as ip_count,
                SUM(visit_count) as total_views
            FROM (
                SELECT ip_hash, COUNT(*) as visit_count
                FROM page_views
                WHERE {NOT_BOT_SQL}
                GROUP BY ip_hash
            ) sub
            GROUP BY bucket
            ORDER BY MIN(visit_count)
        """)
        ip_frequency = [dict(r) for r in cur.fetchall()]

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
            "page_views": {"total": pv_total, "today": pv_today, "unique_today": pv_unique_today,
                "traffic": traffic, "daily_traffic": daily_traffic, "top_paths": top_paths, "top_bots": top_bots,
                "top_human_uas": top_human_uas, "ip_frequency": ip_frequency},
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
