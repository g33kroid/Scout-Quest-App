#!/usr/bin/env bash
# Applies supabase/migrations/*.sql in order against $DATABASE_URL.
# Plain Postgres, no Docker/Supabase CLI required — see docs/runbook.md.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL not set — copy .env.example to .env.local}"

MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  echo "no migrations yet"
  exit 0
fi

for f in "${files[@]}"; do
  echo "applying: $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
