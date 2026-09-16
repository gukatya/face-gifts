import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

ADMIN_TOKEN    = os.getenv("ADMIN_TOKEN",    "face-admin-token")
EMPLOYEE_TOKEN = os.getenv("EMPLOYEE_TOKEN", "face-employee-token")

# Individual user accounts. Passwords can be overridden via env vars.
_USERS = {
    "kate": {
        "name": "Кейт",
        "position": "Creative Director",
        "password": os.getenv("KATE_PASSWORD", "kate-face-2025"),
        "role": "admin",
        "token": ADMIN_TOKEN,
    },
    "kristina": {
        "name": "Кристина",
        "position": "Head of SMM",
        "password": os.getenv("KRISTINA_PASSWORD", "kristina-face-2025"),
        "role": "admin",
        "token": ADMIN_TOKEN,
    },
    "nika": {
        "name": "Ника",
        "position": "SMM",
        "password": os.getenv("NIKA_PASSWORD", "nika-face-2025"),
        "role": "employee",
        "token": EMPLOYEE_TOKEN,
    },
    "inna": {
        "name": "Инна",
        "position": "SMM",
        "password": os.getenv("INNA_PASSWORD", "inna-face-2025"),
        "role": "employee",
        "token": EMPLOYEE_TOKEN,
    },
}


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(payload: LoginRequest):
    user = _USERS.get(payload.username.lower().strip())
    if not user or user["password"] != payload.password:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    return {"role": user["role"], "token": user["token"], "name": user["name"]}


@router.get("/me")
def me(x_auth_token: Optional[str] = Header(None)):
    if x_auth_token == ADMIN_TOKEN:
        return {"role": "admin"}
    if x_auth_token == EMPLOYEE_TOKEN:
        return {"role": "employee"}
    raise HTTPException(status_code=401, detail="Не авторизован")


def require_admin(x_auth_token: Optional[str] = Header(None)):
    if x_auth_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Только администратор")
