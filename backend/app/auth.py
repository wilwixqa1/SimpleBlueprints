"""
SimpleBlueprints — Google OAuth Authentication
Handles: login redirect, callback, session cookie, user info endpoint.
"""

import os
import json
import time
import hmac
import hashlib
import base64
import urllib.parse
import httpx

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
SESSION_SECRET = os.getenv("SESSION_SECRET", "default-secret-change-me")
SITE_URL = os.getenv("SITE_URL", "https://simpleblueprints.xyz")

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# Cookie config
COOKIE_NAME = "sb_session"
COOKIE_MAX_AGE = 30 * 24 * 3600  # 30 days


def get_callback_url(request) -> str:
    """Build callback URL from request, respecting x-forwarded-proto."""
    proto = request.headers.get("x-forwarded-proto", "http")
    host = request.headers.get("host", "localhost:8000")
    return f"{proto}://{host}/auth/callback"


def get_login_url(request) -> str:
    """Build the Google OAuth login URL."""
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": get_callback_url(request),
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


async def exchange_code(code: str, request) -> dict:
    """Exchange auth code for tokens, then fetch user info."""
    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": get_callback_url(request),
            "grant_type": "authorization_code",
        })
        if token_resp.status_code != 200:
            raise Exception(f"Token exchange failed: {token_resp.text}")
        
        tokens = token_resp.json()
        access_token = tokens["access_token"]

        # Fetch user info
        user_resp = await client.get(GOOGLE_USERINFO_URL, headers={
            "Authorization": f"Bearer {access_token}"
        })
        if user_resp.status_code != 200:
            raise Exception(f"User info failed: {user_resp.text}")
        
        return user_resp.json()


def sign_session(user_id: int) -> str:
    """Create a signed session cookie value."""
    payload = json.dumps({"uid": user_id, "t": int(time.time())})
    b64 = base64.urlsafe_b64encode(payload.encode()).decode()
    sig = hmac.new(SESSION_SECRET.encode(), b64.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{b64}.{sig}"


def verify_session(cookie_value: str) -> int | None:
    """Verify session cookie signature, return user_id or None."""
    try:
        parts = cookie_value.split(".")
        if len(parts) != 2:
            return None
        b64, sig = parts
        expected_sig = hmac.new(SESSION_SECRET.encode(), b64.encode(), hashlib.sha256).hexdigest()[:32]
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload = json.loads(base64.urlsafe_b64decode(b64))
        # Check if session is not too old (30 days)
        if time.time() - payload.get("t", 0) > COOKIE_MAX_AGE:
            return None
        return payload.get("uid")
    except Exception:
        return None


def get_current_user_id(request) -> int | None:
    """Extract user_id from session cookie on request."""
    cookie = request.cookies.get(COOKIE_NAME)
    if not cookie:
        return None
    return verify_session(cookie)
