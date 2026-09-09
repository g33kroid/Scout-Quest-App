#!/usr/bin/env bash
# Runs the pgTAP suite (supabase/tests/*.sql) against $DATABASE_URL.
# Uses pg_prove if available (nicer TAP output), falls back to psql.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL not set — copy .env.example to .env.local}"

TESTS_DIR="$(dirname "$0")/../supabase/tests"

shopt -s nullglob
files=("$TESTS_DIR"/*.sql)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  echo "pgtap: zero tests, suite passes"
  exit 0
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "create extension if not exists pgtap;" >/dev/null

if command -v pg_prove >/dev/null 2>&1; then
  pg_prove -d "$DATABASE_URL" "${files[@]}"
else
  echo "pg_prove not found, falling back to psql (less readable output)"
  for f in "${files[@]}"; do
    echo "running: $f"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
  done
fi
