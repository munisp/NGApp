import hashlib
import hmac
import os
import secrets
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel

app = FastAPI(title="Keycloak Auth Service", version="1.0.0")

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "fintech")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "fintech-app")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "")
KEYCLOAK_ADMIN_USER = os.getenv("KEYCLOAK_ADMIN_USER", "admin")
KEYCLOAK_ADMIN_PASS = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_hex(32))

REALM_ROLES = [
    "user", "admin", "compliance_officer", "support_agent",
    "auditor", "finance_manager", "kyc_reviewer", "risk_analyst",
]

CLIENT_ROLES = {
    "fintech-app": [
        "view_accounts", "manage_accounts", "view_transactions", "create_transactions",
        "view_payments", "create_payments", "approve_payments",
        "view_budgets", "manage_budgets",
        "view_savings", "manage_savings",
        "submit_kyc", "review_kyc", "approve_kyc",
        "view_bnpl", "apply_bnpl",
        "view_reports", "generate_reports", "export_reports",
        "manage_users", "manage_settings",
        "view_audit_logs",
    ],
}

MFA_METHODS = ["totp", "sms", "email"]


@dataclass
class User:
    id: str
    username: str
    email: str
    password_hash: str
    first_name: str
    last_name: str
    realm_roles: list[str] = field(default_factory=list)
    client_roles: list[str] = field(default_factory=list)
    mfa_enabled: bool = False
    mfa_method: Optional[str] = None
    mfa_secret: Optional[str] = None
    enabled: bool = True
    email_verified: bool = False
    created_at: float = field(default_factory=time.time)
    last_login: Optional[float] = None
    failed_logins: int = 0
    locked_until: Optional[float] = None


@dataclass
class Session:
    session_id: str
    user_id: str
    access_token: str
    refresh_token: str
    expires_at: float
    refresh_expires_at: float
    ip_address: str = ""
    user_agent: str = ""
    created_at: float = field(default_factory=time.time)


users: dict[str, User] = {}
sessions: dict[str, Session] = {}
connected = False


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hash_val = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
    return f"{salt}:{hash_val.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    salt, hash_hex = stored.split(":")
    hash_val = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
    return hmac.compare_digest(hash_val.hex(), hash_hex)


def _generate_token() -> str:
    return secrets.token_urlsafe(64)


def _seed_users():
    seed_data = [
        ("admin-1", "admin", "admin@fintech.com", "Admin123!", "Admin", "User", ["admin", "user"], ["manage_users", "manage_settings", "view_audit_logs", "generate_reports"]),
        ("user-1", "john.doe", "john@example.com", "User123!", "John", "Doe", ["user"], ["view_accounts", "manage_accounts", "view_transactions", "create_transactions", "view_payments", "create_payments", "view_budgets", "manage_budgets", "view_savings", "manage_savings", "submit_kyc"]),
        ("user-2", "jane.smith", "jane@example.com", "User123!", "Jane", "Smith", ["user"], ["view_accounts", "view_transactions", "view_payments", "view_budgets", "view_savings"]),
        ("compliance-1", "compliance.officer", "compliance@fintech.com", "Comp123!", "Compliance", "Officer", ["compliance_officer", "user"], ["review_kyc", "approve_kyc", "view_audit_logs", "view_reports"]),
        ("support-1", "support.agent", "support@fintech.com", "Supp123!", "Support", "Agent", ["support_agent", "user"], ["view_accounts", "view_transactions", "view_payments"]),
    ]

    for uid, username, email, password, first, last, roles, client_roles in seed_data:
        users[uid] = User(
            id=uid,
            username=username,
            email=email,
            password_hash=_hash_password(password),
            first_name=first,
            last_name=last,
            realm_roles=roles,
            client_roles=client_roles,
            email_verified=True,
        )


_seed_users()


class LoginRequest(BaseModel):
    username: str
    password: str
    mfa_code: Optional[str] = None


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    first_name: str
    last_name: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class MFASetupRequest(BaseModel):
    method: str
    user_id: str


class ChangePasswordRequest(BaseModel):
    user_id: str
    current_password: str
    new_password: str


class AssignRoleRequest(BaseModel):
    user_id: str
    role: str
    role_type: str = "realm"


@app.on_event("startup")
async def startup():
    global connected
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}")
            if resp.status_code == 200:
                connected = True
                print(f"[Keycloak] Connected to {KEYCLOAK_URL}, realm: {KEYCLOAK_REALM}")
    except Exception:
        connected = False
        print(f"[Keycloak] Server not available, running in local mode")


@app.get("/health")
async def health():
    return {
        "connected": connected,
        "keycloak_url": KEYCLOAK_URL,
        "realm": KEYCLOAK_REALM,
        "client_id": KEYCLOAK_CLIENT_ID,
        "users": len(users),
        "active_sessions": len(sessions),
    }


@app.post("/auth/login")
async def login(req: LoginRequest, request: Request):
    user = None
    for u in users.values():
        if u.username == req.username or u.email == req.username:
            user = u
            break

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.locked_until and time.time() < user.locked_until:
        raise HTTPException(status_code=423, detail="Account locked")

    if not user.enabled:
        raise HTTPException(status_code=403, detail="Account disabled")

    if not _verify_password(req.password, user.password_hash):
        user.failed_logins += 1
        if user.failed_logins >= 5:
            user.locked_until = time.time() + 900
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.mfa_enabled:
        if not req.mfa_code:
            return {"status": "mfa_required", "mfa_method": user.mfa_method}

    user.failed_logins = 0
    user.locked_until = None
    user.last_login = time.time()

    access_token = _generate_token()
    refresh_token = _generate_token()
    session_id = uuid.uuid4().hex

    session = Session(
        session_id=session_id,
        user_id=user.id,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=time.time() + 3600,
        refresh_expires_at=time.time() + 86400,
        ip_address=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", ""),
    )
    sessions[access_token] = session

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "expires_in": 3600,
        "refresh_expires_in": 86400,
        "session_id": session_id,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "realm_roles": user.realm_roles,
            "client_roles": user.client_roles,
            "mfa_enabled": user.mfa_enabled,
        },
    }


@app.post("/auth/register")
async def register(req: RegisterRequest):
    for u in users.values():
        if u.username == req.username:
            raise HTTPException(status_code=409, detail="Username already exists")
        if u.email == req.email:
            raise HTTPException(status_code=409, detail="Email already exists")

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user_id = f"user-{uuid.uuid4().hex[:8]}"
    user = User(
        id=user_id,
        username=req.username,
        email=req.email,
        password_hash=_hash_password(req.password),
        first_name=req.first_name,
        last_name=req.last_name,
        realm_roles=["user"],
        client_roles=["view_accounts", "view_transactions", "view_payments", "view_budgets", "view_savings", "submit_kyc"],
    )
    users[user_id] = user

    return {
        "user_id": user_id,
        "username": user.username,
        "email": user.email,
        "status": "created",
    }


@app.post("/auth/refresh")
async def refresh_token(req: RefreshTokenRequest):
    session = None
    for s in sessions.values():
        if s.refresh_token == req.refresh_token:
            session = s
            break

    if not session:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if time.time() > session.refresh_expires_at:
        raise HTTPException(status_code=401, detail="Refresh token expired")

    del sessions[session.access_token]

    new_access = _generate_token()
    new_refresh = _generate_token()
    session.access_token = new_access
    session.refresh_token = new_refresh
    session.expires_at = time.time() + 3600
    session.refresh_expires_at = time.time() + 86400
    sessions[new_access] = session

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "Bearer",
        "expires_in": 3600,
    }


@app.post("/auth/logout")
async def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else ""

    if token in sessions:
        del sessions[token]
        return {"status": "logged_out"}

    return {"status": "no_active_session"}


@app.get("/auth/userinfo")
async def userinfo(request: Request):
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else ""

    session = sessions.get(token)
    if not session or time.time() > session.expires_at:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = users.get(session.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "sub": user.id,
        "preferred_username": user.username,
        "email": user.email,
        "email_verified": user.email_verified,
        "given_name": user.first_name,
        "family_name": user.last_name,
        "realm_roles": user.realm_roles,
        "client_roles": user.client_roles,
    }


@app.post("/auth/validate")
async def validate_token(request: Request):
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else ""

    session = sessions.get(token)
    if not session:
        return {"valid": False, "reason": "token_not_found"}
    if time.time() > session.expires_at:
        return {"valid": False, "reason": "token_expired"}

    return {"valid": True, "user_id": session.user_id, "expires_in": int(session.expires_at - time.time())}


@app.post("/mfa/setup")
async def setup_mfa(req: MFASetupRequest):
    if req.method not in MFA_METHODS:
        raise HTTPException(status_code=400, detail=f"Invalid MFA method. Supported: {MFA_METHODS}")

    user = users.get(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.mfa_enabled = True
    user.mfa_method = req.method
    user.mfa_secret = secrets.token_hex(20)

    return {"status": "mfa_configured", "method": req.method}


@app.post("/mfa/disable")
async def disable_mfa(user_id: str):
    user = users.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.mfa_enabled = False
    user.mfa_method = None
    user.mfa_secret = None
    return {"status": "mfa_disabled"}


@app.post("/users/password")
async def change_password(req: ChangePasswordRequest):
    user = users.get(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not _verify_password(req.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Current password incorrect")

    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    user.password_hash = _hash_password(req.new_password)
    return {"status": "password_changed"}


@app.post("/users/roles")
async def assign_role(req: AssignRoleRequest):
    user = users.get(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.role_type == "realm":
        if req.role not in REALM_ROLES:
            raise HTTPException(status_code=400, detail=f"Unknown realm role: {req.role}")
        if req.role not in user.realm_roles:
            user.realm_roles.append(req.role)
    elif req.role_type == "client":
        all_client_roles = CLIENT_ROLES.get(KEYCLOAK_CLIENT_ID, [])
        if req.role not in all_client_roles:
            raise HTTPException(status_code=400, detail=f"Unknown client role: {req.role}")
        if req.role not in user.client_roles:
            user.client_roles.append(req.role)

    return {"status": "role_assigned", "user_id": req.user_id, "role": req.role}


@app.get("/users")
async def list_users():
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "enabled": u.enabled,
            "email_verified": u.email_verified,
            "realm_roles": u.realm_roles,
            "mfa_enabled": u.mfa_enabled,
            "last_login": u.last_login,
        }
        for u in users.values()
    ]


@app.get("/users/{user_id}")
async def get_user(user_id: str):
    user = users.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "enabled": user.enabled,
        "email_verified": user.email_verified,
        "realm_roles": user.realm_roles,
        "client_roles": user.client_roles,
        "mfa_enabled": user.mfa_enabled,
        "mfa_method": user.mfa_method,
        "last_login": user.last_login,
        "created_at": user.created_at,
    }


@app.get("/roles")
async def list_roles():
    return {"realm_roles": REALM_ROLES, "client_roles": CLIENT_ROLES}


@app.get("/sessions")
async def list_sessions():
    return [
        {
            "session_id": s.session_id,
            "user_id": s.user_id,
            "created_at": s.created_at,
            "expires_at": s.expires_at,
            "ip_address": s.ip_address,
        }
        for s in sessions.values()
    ]


@app.get("/metrics")
async def get_metrics():
    active = [s for s in sessions.values() if time.time() < s.expires_at]
    mfa_users = [u for u in users.values() if u.mfa_enabled]

    return {
        "total_users": len(users),
        "active_sessions": len(active),
        "expired_sessions": len(sessions) - len(active),
        "mfa_enabled_users": len(mfa_users),
        "locked_accounts": len([u for u in users.values() if u.locked_until and time.time() < u.locked_until]),
        "realm_roles": len(REALM_ROLES),
        "client_roles": sum(len(r) for r in CLIENT_ROLES.values()),
        "connected": connected,
    }


@app.get("/.well-known/openid-configuration")
async def openid_config():
    base = KEYCLOAK_URL
    return {
        "issuer": f"{base}/realms/{KEYCLOAK_REALM}",
        "authorization_endpoint": f"{base}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/auth",
        "token_endpoint": f"{base}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token",
        "userinfo_endpoint": f"{base}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/userinfo",
        "end_session_endpoint": f"{base}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/logout",
        "jwks_uri": f"{base}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs",
        "grant_types_supported": ["authorization_code", "refresh_token", "password", "client_credentials"],
        "response_types_supported": ["code", "id_token", "token"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
        "scopes_supported": ["openid", "profile", "email", "roles"],
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("KEYCLOAK_SERVICE_PORT", "8091"))
    uvicorn.run(app, host="0.0.0.0", port=port)
