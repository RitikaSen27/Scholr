import os
import sys

# Add backend dir to path so `app.*` imports resolve correctly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app  # noqa: F401 - Vercel needs this symbol named `app`
