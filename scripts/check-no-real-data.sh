#!/usr/bin/env bash
# Public repo, real minors' data. Fails on anything shaped like a UAE phone
# number in tracked files — seeds, fixtures, snapshots, docs, issues text
# pasted into the repo. docs/spec.md + docs/tasks/01-repo-baseline.md.
set -euo pipefail

# UAE mobile: 05X-XXXXXXX or +9715XXXXXXXX / 9715XXXXXXXX, X = digit.
PATTERN='(\+?971[ -]?5[0-9]{8}|\b05[0-9][ -]?[0-9]{3}[ -]?[0-9]{4}\b)'

matches=$(git grep -nIE "$PATTERN" -- \
  ':!node_modules' ':!.next' ':!package-lock.json' \
  2>/dev/null || true)

if [ -n "$matches" ]; then
  echo "REAL-DATA GATE FAILED: UAE phone-shaped string found in tracked files:" >&2
  echo "$matches" >&2
  exit 1
fi

echo "real-data gate: clean"
