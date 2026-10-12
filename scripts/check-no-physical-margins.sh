#!/usr/bin/env bash
# docs/tasks/00b-cross-cutting-ui.md / docs/tasks/11-bilingual.md: logical
# CSS properties only in layout — margin-left/margin-right (Tailwind's
# ml-*/mr-*/pl-*/pr-*/left-*/right-* included) break RTL mirroring. Use
# ms-*/me-*/ps-*/pe-*/start-*/end-* instead.
set -euo pipefail

PATTERN='margin-left|margin-right|(^|[^A-Za-z0-9_-])(ml|mr|pl|pr|left|right)-[a-zA-Z0-9/]'

matches=$(git grep -nIE "$PATTERN" -- \
  '*.css' '*.tsx' '*.ts' \
  ':!node_modules' ':!.next' \
  2>/dev/null || true)

if [ -n "$matches" ]; then
  echo "RTL GATE FAILED: physical left/right margin or padding found:" >&2
  echo "$matches" >&2
  exit 1
fi

echo "RTL gate: clean"
