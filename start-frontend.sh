#!/usr/bin/env bash
# ──────────────────────────────────────────────────────
# Start NoteVault frontend (Next.js dev server)
# ──────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "🚀  Starting NoteVault frontend..."

if [ ! -f "$FRONTEND_DIR/.env.local" ]; then
  cp "$FRONTEND_DIR/.env.local.example" "$FRONTEND_DIR/.env.local"
  echo "⚠️   Created frontend/.env.local from example."
fi

cd "$FRONTEND_DIR"
echo "✅  Frontend starting at http://localhost:3000"
npm run dev
