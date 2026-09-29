from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import auth_router, ocr_router, notes_router, ws_router

import logging
logger = logging.getLogger(__name__)
try:
    # Create all tables (Alembic handles migrations in production)
    Base.metadata.create_all(bind=engine)
except Exception as e:
    logger.warning("Could not connect to database on startup: %s", e)

app = FastAPI(
    title="College Notes Sharing API",
    description="API for uploading, sharing, and discovering college notes.",
    version="1.0.0",
)

# ──── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth_router.router)
app.include_router(ocr_router.router)
app.include_router(notes_router.router)
app.include_router(ws_router.router)


@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok"}
