#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/python scripts/build_demo.py
exec .venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
