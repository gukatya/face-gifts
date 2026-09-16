import os
import asyncio
import shutil
import tempfile
import urllib.request
import urllib.parse
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from sqlalchemy import text
from .database import Base, engine, get_db
from .routers import events, knowledge, catalog, budgets, dashboard, proposals
from .routers.auth import router as auth_router, require_admin
from .services.seed import seed_all

DB_PATH = os.getenv("DATABASE_URL", "").replace("sqlite:///", "").replace("sqlite://", "") or "/data/face_gifts.db"
TG_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TG_CHAT  = os.getenv("TELEGRAM_CHAT_ID", "")


def _send_db_to_telegram(label: str = "") -> bool:
    """Send a copy of the SQLite DB to the configured Telegram chat. Returns True on success."""
    if not TG_TOKEN or not TG_CHAT:
        return False
    db_file = Path(DB_PATH)
    if not db_file.exists():
        return False
    try:
        date_str = datetime.now().strftime("%Y-%m-%d_%H-%M")
        filename = f"face_gifts_backup_{date_str}.db"
        url = f"https://api.telegram.org/bot{TG_TOKEN}/sendDocument"
        caption = f"🗄 Бэкап базы FACE Gifts {date_str}"
        if label:
            caption += f" ({label})"
        with open(db_file, "rb") as f:
            data = f.read()
        boundary = "----BackupBoundary"
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="chat_id"\r\n\r\n{TG_CHAT}\r\n'
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="caption"\r\n\r\n{caption}\r\n'
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="document"; filename="{filename}"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n"
        ).encode() + data + f"\r\n--{boundary}--\r\n".encode()
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=30)
        return True
    except Exception as e:
        print(f"[backup] Telegram send failed: {e}")
        return False


async def _daily_backup_loop():
    """Send DB backup to Telegram every day at 21:00 Moscow time (UTC+3 = 18:00 UTC)."""
    await asyncio.sleep(5)  # wait for app to finish starting
    while True:
        now = datetime.utcnow()
        # Target: 18:00 UTC = 21:00 MSK
        target = now.replace(hour=18, minute=0, second=0, microsecond=0)
        if now >= target:
            target = target.replace(day=target.day + 1)
        seconds_until = (target - now).total_seconds()
        print(f"[backup] Next backup in {seconds_until/3600:.1f}h (at 21:00 MSK)")
        await asyncio.sleep(seconds_until)
        print("[backup] Sending daily backup to Telegram...")
        ok = _send_db_to_telegram("авто")
        print(f"[backup] {'ok' if ok else 'skipped (no token or chat configured)'}")

Base.metadata.create_all(bind=engine)

# ── SQLite column migrations (idempotent) ─────────────────────────────────────
_MIGRATIONS = [
    "ALTER TABLE events ADD COLUMN gifts_sent BOOLEAN DEFAULT 0",
    "ALTER TABLE events ADD COLUMN shipped_date VARCHAR(20)",
    "ALTER TABLE pigments ADD COLUMN is_mini BOOLEAN DEFAULT 0",
    "ALTER TABLE pigments ADD COLUMN volume_ml VARCHAR(10)",
    "ALTER TABLE events ADD COLUMN deleted_at TIMESTAMP",
    "ALTER TABLE events ADD COLUMN delete_reason VARCHAR(50)",
    "ALTER TABLE events ADD COLUMN created_by VARCHAR(100)",
    "ALTER TABLE events ADD COLUMN comment TEXT",
    "ALTER TABLE events ADD COLUMN training_format VARCHAR(100)",
]
with engine.connect() as _conn:
    for _stmt in _MIGRATIONS:
        try:
            _conn.execute(text(_stmt))
            _conn.commit()
        except Exception:
            pass  # column already exists

app = FastAPI(title="FACE Gifts API", version="1.0.0")

# In production allow all origins (frontend is served from same host).
# In dev restrict to localhost only.
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(knowledge.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")
app.include_router(budgets.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(proposals.router, prefix="/api")


@app.on_event("startup")
async def on_startup():
    db = next(get_db())
    try:
        result = seed_all(db)
        print(f"[seed] {result}")
    finally:
        db.close()
    # Start daily Telegram backup if configured
    if TG_TOKEN and TG_CHAT:
        asyncio.create_task(_daily_backup_loop())
        print("[backup] Daily Telegram backup scheduled")
    else:
        print("[backup] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — backup disabled")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/admin/backup/download", dependencies=[Depends(require_admin)])
def download_backup():
    """Download the SQLite database file."""
    db_file = Path(DB_PATH)
    if not db_file.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Database file not found")
    date_str = datetime.now().strftime("%Y-%m-%d_%H-%M")
    filename = f"face_gifts_backup_{date_str}.db"

    def _stream():
        with open(db_file, "rb") as f:
            while chunk := f.read(65536):
                yield chunk

    return StreamingResponse(
        _stream(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/admin/backup/telegram", dependencies=[Depends(require_admin)])
def send_backup_now():
    """Manually trigger a Telegram backup."""
    ok = _send_db_to_telegram("ручной")
    if not ok:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Telegram not configured or send failed")
    return {"status": "sent"}


@app.post("/admin/reseed")
def reseed(db: Session = Depends(get_db)):
    result = seed_all(db)
    return {"seeded": result}



# Serve built React frontend (production only).
# If the /frontend/dist directory exists, mount it as static files.
_STATIC_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"
if _STATIC_DIR.exists():
    # Mount assets sub-folder so hashed JS/CSS files are served efficiently.
    app.mount("/assets", StaticFiles(directory=str(_STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        """Catch-all: return index.html so React Router handles navigation."""
        index = _STATIC_DIR / "index.html"
        return FileResponse(str(index))
