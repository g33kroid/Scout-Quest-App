#!/usr/bin/env bash
# Drop + recreate the dev database, apply migrations, run pgTAP.
# Mirrors what `supabase db reset` does, without Docker.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL not set — copy .env.example to .env.local}"

DB_NAME="${DATABASE_URL##*/}"
ADMIN_URL="${DATABASE_URL%/*}/postgres"

echo "dropping + recreating: $DB_NAME"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "drop database if exists \"$DB_NAME\";"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "create database \"$DB_NAME\";"

SCRIPT_DIR="$(dirname "$0")"
"$SCRIPT_DIR/db-migrate.sh"
"$SCRIPT_DIR/db-test.sh"
