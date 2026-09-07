from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import auth_router, ocr_router, notes_router, ws_router

# Create all tables (Alembic handles migrations in production)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="College Notes Sharing API",
    description="API for uploading, sharing, and discovering college notes.",
    version="1.0.0",
)

# ──── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth_router.router)
app.include_router(ocr_router.router)
app.include_router(notes_router.router)
app.include_router(ws_router.router)


@app.get("/health")
def health():
    return {"status": "ok"}
