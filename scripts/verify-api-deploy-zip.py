#!/usr/bin/env python3
import sys
import zipfile
from pathlib import Path

zip_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.artifacts/deploy/familyscheduler-api.zip')

if not zip_path.exists():
    print(f"ERROR: zip not found: {zip_path}", file=sys.stderr)
    sys.exit(1)

required_entries = {'host.json', 'package.json', 'dist/index.js'}

with zipfile.ZipFile(zip_path, 'r') as zf:
    names = zf.namelist()

name_set = set(names)
missing = sorted(required_entries - name_set)
backslash_entries = [name for name in names if '\\' in name]

if missing:
    print(f"ERROR: missing required entries: {missing}", file=sys.stderr)
if backslash_entries:
    print('ERROR: zip contains Windows-style backslash entries:', file=sys.stderr)
    for entry in backslash_entries[:20]:
        print(f'  - {entry}', file=sys.stderr)

if missing or backslash_entries:
    sys.exit(1)

print(f"Verified {zip_path} ({len(names)} entries)")
