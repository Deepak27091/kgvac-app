"""KG Vac Service - Job Manager Backend"""
import os
import re
import secrets
import logging
import asyncio
import ipaddress
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Literal, Annotated
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
import jwt as pyjwt
import bcrypt
from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ISSUER = os.environ.get("JWT_ISSUER", "kgvac-jobmanager")
JWT_ALG = "HS256"
ACCESS_MINUTES = 60 * 12  # 12 hours for internal app
RESET_TOKEN_MINUTES = 60

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "KG Vac Service")
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("kgvac")

# -----------------------------------------------------------------------------
# Mongo & lifespan
# -----------------------------------------------------------------------------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

bearer = HTTPBearer(auto_error=False)

STATUSES = ["Scheduled", "Start", "Processing", "Completed", "Rescheduled", "Cancelled"]

# -----------------------------------------------------------------------------
# Password hashing
# -----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

# -----------------------------------------------------------------------------
# JWT
# -----------------------------------------------------------------------------
def issue_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "tv": user.get("token_version", 0),
        "iss": JWT_ISSUER,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_MINUTES),
        "jti": secrets.token_hex(16),
    }
    return pyjwt.encode(claims, JWT_SECRET, algorithm=JWT_ALG)


async def current_user(creds: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)]):
    unauth = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not creds:
        raise unauth
    try:
        payload = pyjwt.decode(
            creds.credentials, JWT_SECRET, algorithms=[JWT_ALG], issuer=JWT_ISSUER,
            options={"require": ["sub", "exp", "iat", "jti", "tv"]},
        )
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user or user.get("disabled") or payload["tv"] != user.get("token_version", 0):
            raise unauth
        return user
    except pyjwt.InvalidTokenError:
        raise unauth

async def admin_only(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin role required")
    return user

# -----------------------------------------------------------------------------
# Email (guardrail-compliant)
# -----------------------------------------------------------------------------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)

def _host_ok(host: str) -> bool:
    if not host or "xn--" in host: return False
    try:
        ipaddress.ip_address(host); return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)

def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)

class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []
    def handle_data(self, data):
        if self._href is not None: self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []

def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body: raise ValueError(f"Email asks for credentials: {p!r}")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")): continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links must be https: {url!r}")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Bad URL: {url!r}")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real: continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor host mismatch: {m.group(1)!r} vs {real!r}")

async def send_email(to: str, subject: str, html: str) -> Optional[str]:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                             headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        r.raise_for_status()
        return r.json().get("id")
    except Exception as e:
        logger.warning(f"Email send failed: {e}")
        return None

# -----------------------------------------------------------------------------
# Push
# -----------------------------------------------------------------------------
_push_client = httpx.AsyncClient(base_url=EMAIL_BASE_URL, headers={"X-Push-Key": PUSH_KEY}, timeout=10.0)

async def push_register(user_id: str, platform: str, device_token: str):
    try:
        r = await _push_client.post("/api/v1/push/users/register",
                                     json={"user_id": user_id, "platform": platform, "device_token": device_token})
        if r.status_code >= 400:
            logger.warning(f"Push register failed {r.status_code}: {r.text}")
    except Exception as e:
        logger.warning(f"Push register error: {e}")

async def send_push(recipients: List[str], title: str, message: str, action_url: Optional[str] = None, idem: Optional[str] = None):
    if not recipients: return
    data = {"title": title, "message": message}
    if action_url: data["action_url"] = action_url
    payload = {"recipients": recipients, "data": data}
    if idem: payload["$idempotency_key"] = idem
    try:
        r = await _push_client.post("/api/v1/push/trigger", json=payload)
        if r.status_code >= 400:
            logger.warning(f"Push failed {r.status_code}: {r.text[:200]}")
    except Exception as e:
        logger.warning(f"Push error: {e}")

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
def new_id() -> str:
    return secrets.token_hex(8)

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=72)

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=72)

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    role: Literal["admin", "staff"] = "staff"
    password: str = Field(min_length=6, max_length=72)

class UserUpdate(BaseModel):
    name: Optional[str] = None
    disabled: Optional[bool] = None

class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str
    disabled: bool
    must_change_password: bool

class CustomerIn(BaseModel):
    name: str
    company: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""

class CategoryIn(BaseModel):
    name: str

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    active: Optional[bool] = None

class JobIn(BaseModel):
    customer_id: str
    title: str
    category_id: str
    description: Optional[str] = ""
    scheduled_date: str  # YYYY-MM-DD
    scheduled_time: str  # HH:MM (24h)
    duration_minutes: int = 60
    assigned_to: Optional[str] = None  # user id
    price: float = 0.0
    notes: Optional[str] = ""

class JobUpdate(BaseModel):
    title: Optional[str] = None
    category_id: Optional[str] = None
    description: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    assigned_to: Optional[str] = None
    price: Optional[float] = None
    notes: Optional[str] = None
    customer_id: Optional[str] = None

class StatusChangeIn(BaseModel):
    new_status: Literal["Scheduled", "Start", "Processing", "Completed", "Rescheduled", "Cancelled"]
    note: Optional[str] = ""
    # For Reschedule:
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    # For Cancel:
    reason: Optional[str] = ""

class RegisterPushIn(BaseModel):
    platform: str
    device_token: str

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def to_public_user(u: dict) -> dict:
    return {
        "id": u["id"], "email": u["email"], "name": u.get("name", u["email"]),
        "role": u["role"], "disabled": u.get("disabled", False),
        "must_change_password": u.get("must_change_password", False),
    }

async def log_activity(job_id: str, user: dict, action: str, details: dict = None):
    await db.activity_logs.insert_one({
        "id": new_id(),
        "job_id": job_id,
        "user_id": user["id"],
        "user_name": user.get("name", user["email"]),
        "action": action,
        "details": details or {},
        "created_at": utc_now(),
    })

def parse_scheduled_dt(date_str: str, time_str: str) -> datetime:
    """Combine YYYY-MM-DD and HH:MM into a UTC datetime (treating input as UTC for simplicity)."""
    try:
        return datetime.fromisoformat(f"{date_str}T{time_str}:00").replace(tzinfo=timezone.utc)
    except Exception as e:
        raise HTTPException(400, f"Invalid date/time: {e}")

async def create_notification(user_id: str, title: str, body: str, job_id: Optional[str] = None, kind: str = "reminder"):
    doc = {
        "id": new_id(),
        "user_id": user_id,
        "title": title,
        "body": body,
        "job_id": job_id,
        "kind": kind,
        "read": False,
        "created_at": utc_now(),
    }
    await db.notifications.insert_one(doc)
    return doc

# -----------------------------------------------------------------------------
# Reminder scheduler
# -----------------------------------------------------------------------------
async def reminder_loop():
    """Checks every 60s for jobs that need a reminder (24h or 1h before scheduled start)."""
    await asyncio.sleep(5)  # let server boot
    while True:
        try:
            now = utc_now()
            # Fetch upcoming not-cancelled/not-completed jobs within next 25h
            cursor = db.jobs.find({
                "status": {"$in": ["Scheduled", "Start", "Processing", "Rescheduled"]},
                "scheduled_at": {"$gte": now - timedelta(minutes=5), "$lte": now + timedelta(hours=25)},
            })
            async for job in cursor:
                scheduled_at = job["scheduled_at"]
                if scheduled_at.tzinfo is None:
                    scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
                delta = scheduled_at - now
                reminders_sent = job.get("reminders_sent", [])
                due = []
                if timedelta(hours=23, minutes=55) <= delta <= timedelta(hours=24, minutes=5) and "24h" not in reminders_sent:
                    due.append("24h")
                if timedelta(minutes=55) <= delta <= timedelta(minutes=65) and "1h" not in reminders_sent:
                    due.append("1h")
                for tag in due:
                    recipients = []
                    if job.get("assigned_to"): recipients.append(job["assigned_to"])
                    # Also notify admin(s)
                    async for admin in db.users.find({"role": "admin", "disabled": {"$ne": True}}):
                        if admin["id"] not in recipients:
                            recipients.append(admin["id"])
                    customer = await db.customers.find_one({"id": job["customer_id"]}, {"_id": 0}) or {}
                    cat = await db.categories.find_one({"id": job["category_id"]}, {"_id": 0}) or {}
                    assigned_name = ""
                    if job.get("assigned_to"):
                        a = await db.users.find_one({"id": job["assigned_to"]}, {"_id": 0})
                        if a: assigned_name = a.get("name", "")
                    label = "24 hours" if tag == "24h" else "1 hour"
                    title = f"Upcoming job in {label}"
                    body = (f"{customer.get('company') or customer.get('name', '')} • "
                            f"{cat.get('name', '')} • {job['scheduled_date']} {job['scheduled_time']}")
                    for uid in recipients:
                        await create_notification(uid, title, body, job_id=job["id"], kind="reminder")
                    await send_push(recipients, title, body, action_url=f"/job/{job['id']}", idem=f"{job['id']}-{tag}")
                    await db.jobs.update_one({"id": job["id"]}, {"$addToSet": {"reminders_sent": tag}})
        except Exception as e:
            logger.exception(f"reminder_loop error: {e}")
        await asyncio.sleep(60)

async def daily_summary_loop():
    """Send each active user a daily summary email in the morning (checked hourly, sent once per day)."""
    await asyncio.sleep(15)
    while True:
        try:
            now = utc_now()
            today_key = now.strftime("%Y-%m-%d")
            # Target: once per day, around 12:00 UTC (adjust in prod with timezone preference)
            if now.hour == 12:
                today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                today_end = today_start + timedelta(days=1)
                async for user in db.users.find({"disabled": {"$ne": True}}):
                    if user.get("last_summary_sent") == today_key:
                        continue
                    q = {"scheduled_at": {"$gte": today_start, "$lt": today_end},
                         "status": {"$nin": ["Cancelled"]}}
                    if user["role"] == "staff":
                        q["assigned_to"] = user["id"]
                    jobs = await db.jobs.find(q, {"_id": 0}).sort("scheduled_at", 1).to_list(100)
                    if not jobs:
                        await db.users.update_one({"id": user["id"]}, {"$set": {"last_summary_sent": today_key}})
                        continue
                    enriched = await enrich_jobs(jobs)
                    rows_html = ""
                    for j in enriched:
                        rows_html += (
                            f"<tr>"
                            f"<td style='padding:12px 8px;border-bottom:1px solid #E2E8F0;color:#1E3A8A;font-weight:700;white-space:nowrap'>{escape(j['scheduled_time'])}</td>"
                            f"<td style='padding:12px 8px;border-bottom:1px solid #E2E8F0'>"
                            f"<div style='color:#0F172A;font-weight:700'>{escape(j.get('customer_company') or j.get('customer_name',''))}</div>"
                            f"<div style='color:#64748B;font-size:13px;margin-top:2px'>{escape(j.get('category_name',''))}</div>"
                            f"<div style='color:#64748B;font-size:13px;margin-top:2px'>{escape(j.get('customer_address',''))}</div>"
                            f"</td>"
                            f"</tr>"
                        )
                    html = f"""
<table role="presentation" width="100%" style="font-family:Arial,sans-serif;background:#F4F6F8;padding:24px">
  <tr><td align="center">
    <table role="presentation" width="600" style="background:#FFFFFF;border-radius:12px;overflow:hidden">
      <tr><td style="background:#1E3A8A;padding:24px">
        <div style="color:#FFFFFF;font-size:20px;font-weight:800">KG Vac Service</div>
        <div style="color:#DBEAFE;font-size:14px;margin-top:4px">Daily Job Schedule</div>
      </td></tr>
      <tr><td style="padding:24px">
        <p style="color:#0F172A;font-size:15px;margin:0 0 8px 0">Good morning, {escape(user.get('name', user['email']))}</p>
        <p style="color:#64748B;font-size:14px;margin:0 0 16px 0">Here is your schedule for {escape(today_key)} ({len(enriched)} job{'s' if len(enriched) != 1 else ''}).</p>
        <table role="presentation" width="100%" style="border-collapse:collapse">{rows_html}</table>
        <p style="color:#64748B;font-size:12px;margin-top:24px">KG Vac Service will never ask for your password by email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>"""
                    await send_email(user["email"], f"Your KG Vac Service schedule for {today_key}", html)
                    await db.users.update_one({"id": user["id"]}, {"$set": {"last_summary_sent": today_key}})
        except Exception as e:
            logger.exception(f"daily_summary_loop error: {e}")
        await asyncio.sleep(3600)

# -----------------------------------------------------------------------------
# Seed data
# -----------------------------------------------------------------------------
async def seed_data():
    # Service categories
    seed_cats = ["Grease Trap Cleaning", "Drain Cleaning", "Other"]
    for name in seed_cats:
        existing = await db.categories.find_one({"name": name})
        if not existing:
            await db.categories.insert_one({
                "id": new_id(), "name": name, "active": True, "created_at": utc_now()
            })

    # Users — upsert password_hash on every boot when RESEED_PASSWORDS=true (dev/preview)
    reseed = os.environ.get("RESEED_PASSWORDS", "false").lower() == "true"
    seed_users = [
        (os.environ.get("SEED_ADMIN_EMAIL", "admin@kgvac.com"),
         os.environ.get("SEED_ADMIN_PASSWORD", "Admin@2026"), "admin", "Admin"),
        (os.environ.get("SEED_STAFF1_EMAIL", "staff1@kgvac.com"),
         os.environ.get("SEED_STAFF1_PASSWORD", "Staff1@2026"), "staff", "Staff One"),
        (os.environ.get("SEED_STAFF2_EMAIL", "staff2@kgvac.com"),
         os.environ.get("SEED_STAFF2_PASSWORD", "Staff2@2026"), "staff", "Staff Two"),
    ]
    for email, password, role, name in seed_users:
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({
                "id": new_id(), "email": email, "name": name, "role": role,
                "password_hash": hash_password(password),
                "token_version": 0, "disabled": False, "must_change_password": False,
                "created_at": utc_now(),
            })
        elif reseed:
            await db.users.update_one(
                {"email": email},
                {"$set": {"password_hash": hash_password(password), "disabled": False},
                 "$inc": {"token_version": 1}},
            )
    await db.users.create_index("email", unique=True)
    await db.customers.create_index("name")
    await db.jobs.create_index("scheduled_at")
    await db.jobs.create_index("status")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_data()
    task = asyncio.create_task(reminder_loop())
    task2 = asyncio.create_task(daily_summary_loop())
    yield
    task.cancel()
    task2.cancel()
    client.close()

app = FastAPI(lifespan=lifespan)
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# Routes
# =============================================================================

@api.get("/")
async def root():
    return {"service": "KG Vac Service - Job Manager", "status": "ok"}

# ----------------- Auth -----------------
@api.post("/auth/login")
async def login(body: LoginIn):
    u = await db.users.find_one({"email": body.email.lower()})
    if not u or u.get("disabled") or not verify_password(body.password, u["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    token = issue_token(u)
    return {"access_token": token, "user": to_public_user(u)}

@api.post("/auth/logout")
async def logout(user=Depends(current_user)):
    await db.users.update_one({"id": user["id"]}, {"$inc": {"token_version": 1}})
    return {"ok": True}

@api.get("/auth/me", response_model=UserOut)
async def me(user=Depends(current_user)):
    return to_public_user(user)

@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user=Depends(current_user)):
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(400, "New password must be different")
    await db.users.update_one({"id": user["id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "must_change_password": False},
         "$inc": {"token_version": 1}})
    return {"ok": True}

@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordIn):
    # Always respond ok to avoid enumeration
    u = await db.users.find_one({"email": body.email.lower()})
    if u and not u.get("disabled"):
        token = secrets.token_urlsafe(32)
        expires = utc_now() + timedelta(minutes=RESET_TOKEN_MINUTES)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": u["id"], "expires_at": expires, "used": False,
        })
        reset_url = f"{FRONTEND_URL}/reset-password?token={token}" if FRONTEND_URL else f"https://kgvac-ops.preview.emergentagent.com/reset-password?token={token}"
        html = f"""
<table role="presentation" width="100%" style="font-family:Arial,sans-serif;background:#F4F6F8;padding:24px">
  <tr><td align="center">
    <table role="presentation" width="560" style="background:#FFFFFF;border-radius:12px;padding:32px">
      <tr><td>
        <h2 style="color:#1E3A8A;margin:0 0 16px 0">KG Vac Service</h2>
        <p style="color:#0F172A;font-size:16px;line-height:1.5">Hi {escape(u.get('name', u['email']))},</p>
        <p style="color:#334155;font-size:14px;line-height:1.6">We received a request to reset the password for your Job Manager account. Click the button below to set a new password. The link expires in {RESET_TOKEN_MINUTES} minutes.</p>
        <p style="margin:24px 0"><a href="{escape(reset_url)}" style="background:#1E3A8A;color:#FFFFFF;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Reset password</a></p>
        <p style="color:#64748B;font-size:12px;line-height:1.6">If you did not request this, you can safely ignore this message. KG Vac Service will never ask for your password by email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>"""
        await send_email(u["email"], "Reset your KG Vac Service password", html)
    return {"ok": True, "message": "If an account exists, a reset email has been sent."}

@api.post("/auth/reset-password")
async def reset_password(body: ResetPasswordIn):
    rec = await db.password_reset_tokens.find_one({"token": body.token})
    if not rec or rec.get("used"):
        raise HTTPException(400, "Invalid or expired reset link")
    expires = rec["expires_at"]
    if expires.tzinfo is None: expires = expires.replace(tzinfo=timezone.utc)
    if expires < utc_now():
        raise HTTPException(400, "Reset link has expired")
    await db.users.update_one({"id": rec["user_id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "must_change_password": False},
         "$inc": {"token_version": 1}})
    await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
    return {"ok": True}

# ----------------- Push registration -----------------
@api.post("/register-push", status_code=201)
async def register_push(body: RegisterPushIn, user=Depends(current_user)):
    await push_register(user["id"], body.platform, body.device_token)
    return {"status": "registered"}

# ----------------- User management (admin) -----------------
@api.get("/users", response_model=List[UserOut])
async def list_users(user=Depends(current_user)):
    # Staff can see list to know names (no sensitive data); admin can see all.
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return [to_public_user(u) for u in users]

@api.post("/users", response_model=UserOut)
async def create_user(body: UserCreate, admin=Depends(admin_only)):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing: raise HTTPException(400, "Email already exists")
    doc = {
        "id": new_id(), "email": body.email.lower(), "name": body.name, "role": body.role,
        "password_hash": hash_password(body.password), "token_version": 0,
        "disabled": False, "must_change_password": True, "created_at": utc_now(),
    }
    await db.users.insert_one(doc)
    return to_public_user(doc)

@api.patch("/users/{user_id}", response_model=UserOut)
async def update_user(user_id: str, body: UserUpdate, admin=Depends(admin_only)):
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if update:
        await db.users.update_one({"id": user_id}, {"$set": update})
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not u: raise HTTPException(404, "User not found")
    return to_public_user(u)

@api.post("/users/{user_id}/reset-password")
async def admin_reset_password(user_id: str, admin=Depends(admin_only)):
    """Admin initiates reset: emails a reset link to the staff user."""
    u = await db.users.find_one({"id": user_id})
    if not u: raise HTTPException(404, "User not found")
    token = secrets.token_urlsafe(32)
    expires = utc_now() + timedelta(hours=24)
    await db.password_reset_tokens.insert_one({
        "token": token, "user_id": u["id"], "expires_at": expires, "used": False,
    })
    # Invalidate existing sessions
    await db.users.update_one({"id": u["id"]}, {"$inc": {"token_version": 1}, "$set": {"must_change_password": True}})
    reset_url = f"{FRONTEND_URL}/reset-password?token={token}" if FRONTEND_URL else f"https://kgvac-ops.preview.emergentagent.com/reset-password?token={token}"
    html = f"""
<table role="presentation" width="100%" style="font-family:Arial,sans-serif;background:#F4F6F8;padding:24px">
  <tr><td align="center">
    <table role="presentation" width="560" style="background:#FFFFFF;border-radius:12px;padding:32px">
      <tr><td>
        <h2 style="color:#1E3A8A;margin:0 0 16px 0">KG Vac Service</h2>
        <p style="color:#0F172A;font-size:16px">Hi {escape(u.get('name', u['email']))},</p>
        <p style="color:#334155;font-size:14px;line-height:1.6">An administrator has initiated a password reset for your Job Manager account. Click below to set a new password within 24 hours.</p>
        <p style="margin:24px 0"><a href="{escape(reset_url)}" style="background:#1E3A8A;color:#FFFFFF;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Set new password</a></p>
        <p style="color:#64748B;font-size:12px">KG Vac Service will never ask for your password by email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>"""
    await send_email(u["email"], "Password reset for your KG Vac Service account", html)
    return {"ok": True, "message": "Reset email sent"}

# ----------------- Categories -----------------
@api.get("/categories")
async def list_categories(user=Depends(current_user)):
    cats = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return cats

@api.post("/categories")
async def create_category(body: CategoryIn, admin=Depends(admin_only)):
    doc = {"id": new_id(), "name": body.name, "active": True, "created_at": utc_now()}
    await db.categories.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.patch("/categories/{cat_id}")
async def update_category(cat_id: str, body: CategoryUpdate, admin=Depends(admin_only)):
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if update:
        await db.categories.update_one({"id": cat_id}, {"$set": update})
    cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not cat: raise HTTPException(404, "Category not found")
    return cat

# ----------------- Customers -----------------
@api.get("/customers")
async def list_customers(q: Optional[str] = None, user=Depends(current_user)):
    query = {}
    if q:
        query = {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]}
    customers = await db.customers.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    return customers

@api.post("/customers")
async def create_customer(body: CustomerIn, user=Depends(current_user)):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": utc_now(), "created_by": user["id"]})
    await db.customers.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.get("/customers/{cid}")
async def get_customer(cid: str, user=Depends(current_user)):
    c = await db.customers.find_one({"id": cid}, {"_id": 0})
    if not c: raise HTTPException(404, "Customer not found")
    # Attach jobs
    jobs = await db.jobs.find({"customer_id": cid}, {"_id": 0}).sort("scheduled_at", -1).to_list(500)
    for j in jobs:
        if isinstance(j.get("scheduled_at"), datetime): j["scheduled_at"] = iso(j["scheduled_at"])
        if isinstance(j.get("created_at"), datetime): j["created_at"] = iso(j["created_at"])
        if isinstance(j.get("updated_at"), datetime): j["updated_at"] = iso(j["updated_at"])
    c["jobs"] = jobs
    return c

@api.patch("/customers/{cid}")
async def update_customer(cid: str, body: CustomerIn, user=Depends(current_user)):
    await db.customers.update_one({"id": cid}, {"$set": body.model_dump()})
    c = await db.customers.find_one({"id": cid}, {"_id": 0})
    if not c: raise HTTPException(404, "Customer not found")
    return c

# ----------------- Jobs -----------------
def serialize_job(j: dict) -> dict:
    for k in ("scheduled_at", "created_at", "updated_at"):
        if isinstance(j.get(k), datetime): j[k] = iso(j[k])
    return j

async def enrich_jobs(jobs: List[dict]) -> List[dict]:
    # Attach customer, category, assignee names
    cust_ids = {j["customer_id"] for j in jobs if j.get("customer_id")}
    cat_ids = {j["category_id"] for j in jobs if j.get("category_id")}
    user_ids = {j["assigned_to"] for j in jobs if j.get("assigned_to")}
    customers = {c["id"]: c for c in await db.customers.find({"id": {"$in": list(cust_ids)}}, {"_id": 0}).to_list(500)}
    categories = {c["id"]: c for c in await db.categories.find({"id": {"$in": list(cat_ids)}}, {"_id": 0}).to_list(500)}
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": list(user_ids)}}, {"_id": 0, "password_hash": 0}).to_list(500)}
    now = utc_now()
    for j in jobs:
        c = customers.get(j.get("customer_id"), {})
        j["customer_name"] = c.get("name", "")
        j["customer_company"] = c.get("company", "")
        j["customer_phone"] = c.get("phone", "")
        j["customer_address"] = c.get("address", "")
        cat = categories.get(j.get("category_id"), {})
        j["category_name"] = cat.get("name", "")
        a = users.get(j.get("assigned_to"), {})
        j["assigned_to_name"] = a.get("name", "") if a else ""
        # Overdue: scheduled time has passed and status is still active
        sa = j.get("scheduled_at")
        if isinstance(sa, datetime):
            sa_utc = sa if sa.tzinfo else sa.replace(tzinfo=timezone.utc)
            j["is_overdue"] = sa_utc < now and j.get("status") in ("Scheduled", "Start", "Processing", "Rescheduled")
        else:
            j["is_overdue"] = False
        serialize_job(j)
    return jobs

@api.get("/jobs")
async def list_jobs(
    status_f: Optional[str] = Query(None, alias="status"),
    category_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    q: Optional[str] = None,
    mine: bool = False,
    overdue: bool = False,
    sort: str = "upcoming",  # upcoming | created | updated
    user=Depends(current_user),
):
    query = {}
    if status_f: query["status"] = status_f
    if category_id: query["category_id"] = category_id
    if assigned_to: query["assigned_to"] = assigned_to
    if overdue:
        query["status"] = {"$in": ["Scheduled", "Start", "Processing", "Rescheduled"]}
        query["scheduled_at"] = {"$lt": datetime.now(timezone.utc)}
    if mine or user["role"] == "staff":
        # Staff can only see their own jobs
        if user["role"] == "staff":
            query["assigned_to"] = user["id"]
        elif mine:
            query["assigned_to"] = user["id"]
    if date_from or date_to:
        rng = query.get("scheduled_at", {})
        if date_from: rng["$gte"] = datetime.fromisoformat(f"{date_from}T00:00:00").replace(tzinfo=timezone.utc)
        if date_to: rng["$lte"] = datetime.fromisoformat(f"{date_to}T23:59:59").replace(tzinfo=timezone.utc)
        query["scheduled_at"] = rng
    if q:
        # Search by job id prefix or customer name/company/phone — resolve customers first
        matching_customers = await db.customers.find({"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]}, {"id": 1, "_id": 0}).to_list(200)
        cust_ids = [c["id"] for c in matching_customers]
        query["$or"] = [{"customer_id": {"$in": cust_ids}}, {"id": {"$regex": q, "$options": "i"}}]
    sort_key = ("scheduled_at", 1) if sort == "upcoming" else (("created_at", -1) if sort == "created" else ("updated_at", -1))
    jobs = await db.jobs.find(query, {"_id": 0}).sort([sort_key]).to_list(500)
    return await enrich_jobs(jobs)

@api.post("/jobs")
async def create_job(body: JobIn, admin=Depends(admin_only)):
    scheduled_at = parse_scheduled_dt(body.scheduled_date, body.scheduled_time)
    cust = await db.customers.find_one({"id": body.customer_id})
    if not cust: raise HTTPException(400, "Customer not found")
    cat = await db.categories.find_one({"id": body.category_id})
    if not cat: raise HTTPException(400, "Category not found")
    if body.assigned_to:
        a = await db.users.find_one({"id": body.assigned_to})
        if not a: raise HTTPException(400, "Assignee not found")
    doc = body.model_dump()
    doc.update({
        "id": new_id(), "status": "Scheduled", "scheduled_at": scheduled_at,
        "created_at": utc_now(), "updated_at": utc_now(), "created_by": admin["id"],
        "reminders_sent": [],
    })
    await db.jobs.insert_one(doc)
    await log_activity(doc["id"], admin, "created", {"status": "Scheduled"})
    # Notify assignee
    if body.assigned_to and body.assigned_to != admin["id"]:
        await create_notification(body.assigned_to, "New job assigned",
                                  f"{cust.get('company') or cust.get('name')} • {cat['name']} • {body.scheduled_date} {body.scheduled_time}",
                                  job_id=doc["id"], kind="assignment")
        await send_push([body.assigned_to], "New job assigned",
                        f"{cust.get('company') or cust.get('name')} on {body.scheduled_date} at {body.scheduled_time}",
                        action_url=f"/job/{doc['id']}")
    return (await enrich_jobs([{k: v for k, v in doc.items() if k != "_id"}]))[0]

@api.get("/jobs/{jid}")
async def get_job(jid: str, user=Depends(current_user)):
    j = await db.jobs.find_one({"id": jid}, {"_id": 0})
    if not j: raise HTTPException(404, "Job not found")
    if user["role"] == "staff" and j.get("assigned_to") != user["id"]:
        raise HTTPException(403, "Not authorized to view this job")
    enriched = (await enrich_jobs([j]))[0]
    logs = await db.activity_logs.find({"job_id": jid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for l in logs:
        if isinstance(l.get("created_at"), datetime): l["created_at"] = iso(l["created_at"])
    enriched["activity"] = logs
    return enriched

@api.patch("/jobs/{jid}")
async def update_job(jid: str, body: JobUpdate, admin=Depends(admin_only)):
    j = await db.jobs.find_one({"id": jid})
    if not j: raise HTTPException(404, "Job not found")
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    changes = {}
    for k, v in update.items():
        if j.get(k) != v: changes[k] = {"from": j.get(k), "to": v}
    if "scheduled_date" in update or "scheduled_time" in update:
        d = update.get("scheduled_date", j["scheduled_date"])
        t = update.get("scheduled_time", j["scheduled_time"])
        update["scheduled_at"] = parse_scheduled_dt(d, t)
        update["reminders_sent"] = []  # recalc reminders
    update["updated_at"] = utc_now()
    await db.jobs.update_one({"id": jid}, {"$set": update})
    await log_activity(jid, admin, "edited", changes)
    # Notify new assignee
    if "assigned_to" in update and update["assigned_to"] and update["assigned_to"] != j.get("assigned_to"):
        await create_notification(update["assigned_to"], "Job assigned to you",
                                  f"Job {jid} has been assigned to you",
                                  job_id=jid, kind="assignment")
        await send_push([update["assigned_to"]], "Job assigned to you",
                        f"Open the app to view details",
                        action_url=f"/job/{jid}")
    updated = await db.jobs.find_one({"id": jid}, {"_id": 0})
    return (await enrich_jobs([updated]))[0]

@api.post("/jobs/{jid}/status")
async def change_status(jid: str, body: StatusChangeIn, user=Depends(current_user)):
    j = await db.jobs.find_one({"id": jid})
    if not j: raise HTTPException(404, "Job not found")
    # Staff can only change status of their own jobs
    if user["role"] == "staff" and j.get("assigned_to") != user["id"]:
        raise HTTPException(403, "Not authorized")
    prev = j.get("status")
    update = {"status": body.new_status, "updated_at": utc_now()}
    details = {"from": prev, "to": body.new_status, "note": body.note}
    if body.new_status == "Rescheduled":
        if not body.scheduled_date or not body.scheduled_time:
            raise HTTPException(400, "scheduled_date and scheduled_time required for Rescheduled")
        update["scheduled_date"] = body.scheduled_date
        update["scheduled_time"] = body.scheduled_time
        update["scheduled_at"] = parse_scheduled_dt(body.scheduled_date, body.scheduled_time)
        update["reminders_sent"] = []
        details["original_date"] = j["scheduled_date"]
        details["original_time"] = j["scheduled_time"]
        details["new_date"] = body.scheduled_date
        details["new_time"] = body.scheduled_time
    if body.new_status == "Cancelled":
        update["cancellation_reason"] = body.reason or ""
        update["reminders_sent"] = ["24h", "1h"]  # prevent further reminders
        details["reason"] = body.reason
    if body.new_status == "Completed":
        update["completed_at"] = utc_now()
        update["completed_by"] = user["id"]
    await db.jobs.update_one({"id": jid}, {"$set": update})
    await log_activity(jid, user, f"status_changed_to_{body.new_status.lower()}", details)
    return {"ok": True}

@api.post("/jobs/{jid}/notes")
async def add_note(jid: str, body: dict, user=Depends(current_user)):
    j = await db.jobs.find_one({"id": jid})
    if not j: raise HTTPException(404, "Job not found")
    if user["role"] == "staff" and j.get("assigned_to") != user["id"]:
        raise HTTPException(403, "Not authorized")
    note = (body or {}).get("note", "")
    await db.jobs.update_one({"id": jid}, {"$set": {"notes": note, "updated_at": utc_now()}})
    await log_activity(jid, user, "notes_updated", {"notes": note})
    return {"ok": True}

# ----------------- Dashboard -----------------
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(current_user)):
    base_q = {}
    if user["role"] == "staff":
        base_q["assigned_to"] = user["id"]
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    week_end = today_start + timedelta(days=7)

    async def count(extra):
        q = {**base_q, **extra}
        return await db.jobs.count_documents(q)

    stats = {
        "today": await count({"scheduled_at": {"$gte": today_start, "$lt": today_end}}),
        "upcoming": await count({"scheduled_at": {"$gte": today_end, "$lt": week_end},
                                  "status": {"$nin": ["Cancelled", "Completed"]}}),
        "scheduled": await count({"status": "Scheduled"}),
        "started": await count({"status": "Start"}),
        "processing": await count({"status": "Processing"}),
        "completed": await count({"status": "Completed"}),
        "rescheduled": await count({"status": "Rescheduled"}),
        "cancelled": await count({"status": "Cancelled"}),
        "overdue": await count({"scheduled_at": {"$lt": datetime.now(timezone.utc)},
                                 "status": {"$in": ["Scheduled", "Start", "Processing", "Rescheduled"]}}),
    }

    # Today's schedule
    today_q = {**base_q, "scheduled_at": {"$gte": today_start, "$lt": today_end}}
    today_jobs = await db.jobs.find(today_q, {"_id": 0}).sort("scheduled_at", 1).to_list(100)
    upcoming_q = {**base_q, "scheduled_at": {"$gte": today_end},
                   "status": {"$nin": ["Cancelled", "Completed"]}}
    upcoming_jobs = await db.jobs.find(upcoming_q, {"_id": 0}).sort("scheduled_at", 1).to_list(10)

    stats["today_jobs"] = await enrich_jobs(today_jobs)
    stats["upcoming_jobs"] = await enrich_jobs(upcoming_jobs)
    return stats

# ----------------- Earnings -----------------
@api.get("/earnings")
async def earnings(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    staff_id: Optional[str] = None,
    category_id: Optional[str] = None,
    user=Depends(current_user),
):
    q = {"status": "Completed"}
    if user["role"] == "staff":
        q["assigned_to"] = user["id"]
    elif staff_id:
        q["assigned_to"] = staff_id
    if category_id:
        q["category_id"] = category_id
    if date_from or date_to:
        rng = {}
        if date_from: rng["$gte"] = datetime.fromisoformat(f"{date_from}T00:00:00").replace(tzinfo=timezone.utc)
        if date_to: rng["$lte"] = datetime.fromisoformat(f"{date_to}T23:59:59").replace(tzinfo=timezone.utc)
        q["completed_at"] = rng

    jobs = await db.jobs.find(q, {"_id": 0}).sort("completed_at", -1).to_list(1000)
    total = sum(float(j.get("price", 0) or 0) for j in jobs)

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today_q = {**q, "completed_at": {"$gte": today_start}}
    month_q = {**q, "completed_at": {"$gte": month_start}}
    all_q = {k: v for k, v in q.items() if k != "completed_at"}

    today_jobs = await db.jobs.find(today_q, {"price": 1, "_id": 0}).to_list(500)
    month_jobs = await db.jobs.find(month_q, {"price": 1, "_id": 0}).to_list(500)
    all_jobs = await db.jobs.find(all_q, {"price": 1, "_id": 0}).to_list(5000)

    today_total = sum(float(j.get("price", 0) or 0) for j in today_jobs)
    month_total = sum(float(j.get("price", 0) or 0) for j in month_jobs)
    all_total = sum(float(j.get("price", 0) or 0) for j in all_jobs)

    # By staff / category breakdown (admin-only)
    by_staff = []
    by_category = []
    if user["role"] == "admin":
        pipeline_staff = [{"$match": all_q}, {"$group": {"_id": "$assigned_to", "total": {"$sum": "$price"}, "count": {"$sum": 1}}}]
        async for r in db.jobs.aggregate(pipeline_staff):
            u = await db.users.find_one({"id": r["_id"]}, {"_id": 0, "name": 1}) if r["_id"] else None
            by_staff.append({"staff_id": r["_id"], "staff_name": u.get("name") if u else "Unassigned",
                             "total": r["total"], "count": r["count"]})
        pipeline_cat = [{"$match": all_q}, {"$group": {"_id": "$category_id", "total": {"$sum": "$price"}, "count": {"$sum": 1}}}]
        async for r in db.jobs.aggregate(pipeline_cat):
            c = await db.categories.find_one({"id": r["_id"]}, {"_id": 0, "name": 1}) if r["_id"] else None
            by_category.append({"category_id": r["_id"], "category_name": c.get("name") if c else "—",
                                 "total": r["total"], "count": r["count"]})

    enriched_jobs = await enrich_jobs(jobs)

    return {
        "filtered_total": total,
        "filtered_count": len(jobs),
        "all_time_total": all_total,
        "all_time_count": len(all_jobs),
        "today_total": today_total,
        "month_total": month_total,
        "by_staff": by_staff,
        "by_category": by_category,
        "jobs": enriched_jobs,
    }

# ----------------- Notifications -----------------
@api.get("/notifications")
async def list_notifications(user=Depends(current_user)):
    notifs = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for n in notifs:
        if isinstance(n.get("created_at"), datetime): n["created_at"] = iso(n["created_at"])
    return notifs

@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}

@api.post("/notifications/read-all")
async def mark_all_read(user=Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}

app.include_router(api)
