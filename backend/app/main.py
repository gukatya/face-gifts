import os
from pathlib import Path

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .routers import events, knowledge, catalog
from .services.seed import seed_all

Base.metadata.create_all(bind=engine)

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

app.include_router(events.router, prefix="/api")
app.include_router(knowledge.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")


@app.on_event("startup")
def on_startup():
    db = next(get_db())
    try:
        result = seed_all(db)
        print(f"[seed] {result}")
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


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
