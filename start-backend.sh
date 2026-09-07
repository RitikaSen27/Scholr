#!/usr/bin/env bash
# ──────────────────────────────────────────────────────
# Start NoteVault backend (FastAPI)
# ──────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo "🚀  Starting NoteVault backend..."

# Activate virtual environment
source "$BACKEND_DIR/venv/bin/activate"

# Copy .env if it doesn't exist
if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "⚠️   Created backend/.env from .env.example — please fill in your credentials."
fi

cd "$BACKEND_DIR"

# Run Alembic migrations
echo "📦  Running database migrations..."
alembic upgrade head

# Start FastAPI
echo "✅  Backend starting at http://localhost:8000"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
