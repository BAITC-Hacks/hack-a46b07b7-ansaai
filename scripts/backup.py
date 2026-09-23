"""Consistent SQLite backup, including committed WAL contents."""
import os, sqlite3, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=Path(os.getenv('TASKREADY_DB_PATH',str(root/'data/taskready-v3.sqlite3')))
if not source.exists():raise SystemExit('Database not found; nothing to back up.')
if len(sys.argv)!=2:raise SystemExit('Usage: python scripts/backup.py /safe/path/backup.sqlite3')
target=Path(sys.argv[1]).resolve()
if target.exists():raise SystemExit('Target already exists; choose a new backup filename.')
with sqlite3.connect(source) as src, sqlite3.connect(target) as dst:src.backup(dst)
print('Backup created:',target)
