import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

# Passwords and tokens are configured via Railway env vars.
# Change these in production!
_ADMIN_PASSWORD  = os.getenv("ADMIN_PASSWORD",    "face-admin-2025")
_EMPLOYEE_PASSWORD = os.getenv("EMPLOYEE_PASSWORD", "face-team-2025")
ADMIN_TOKEN    = os.getenv("ADMIN_TOKEN",    "face-admin-token")
EMPLOYEE_TOKEN = os.getenv("EMPLOYEE_TOKEN", "face-employee-token")


class LoginRequest(BaseModel):
    password: str


@router.post("/login")
def login(payload: LoginRequest):
    if payload.password == _ADMIN_PASSWORD:
        return {"role": "admin", "token": ADMIN_TOKEN}
    if payload.password == _EMPLOYEE_PASSWORD:
        return {"role": "employee", "token": EMPLOYEE_TOKEN}
    raise HTTPException(status_code=401, detail="Неверный пароль")


@router.get("/me")
def me(x_auth_token: Optional[str] = Header(None)):
    if x_auth_token == ADMIN_TOKEN:
        return {"role": "admin"}
    if x_auth_token == EMPLOYEE_TOKEN:
        return {"role": "employee"}
    raise HTTPException(status_code=401, detail="Не авторизован")


# ── Dependency for admin-only endpoints ──────────────────────────────────────

def require_admin(x_auth_token: Optional[str] = Header(None)):
    if x_auth_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Только администратор")
