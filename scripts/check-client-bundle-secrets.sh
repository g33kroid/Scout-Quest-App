#!/usr/bin/env bash
# Fails if a server-only secret name or a service_role JWT shape ends up in the
# built client bundle. docs/spec.md: "the service-role key never exists
# client-side and never in a PWA bundle." Run after `next build`.
set -euo pipefail

BUILD_DIR=".next"

if [ ! -d "$BUILD_DIR" ]; then
  echo "error: $BUILD_DIR not found — run 'npm run build' first" >&2
  exit 1
fi

# Only the client-shipped output, not server-only chunks.
SCAN_DIRS=("$BUILD_DIR/static")
[ -d "$BUILD_DIR/server/app" ] && SCAN_DIRS+=("$BUILD_DIR/server/app")

PATTERNS=(
  "SUPABASE_SERVICE_ROLE_KEY"
  "LLM_API_KEY"
  '"role":"service_role"'
)

found=0
for pattern in "${PATTERNS[@]}"; do
  if grep -rlI --exclude-dir=node_modules -- "$pattern" "${SCAN_DIRS[@]}" 2>/dev/null; then
    echo "SECRET GATE FAILED: pattern '$pattern' found in client bundle" >&2
    found=1
  fi
done

# service_role JWTs carry this base64 fragment (base64 of {"role":"service_role")
# in their payload segment — same signature gitleaks uses for Supabase keys.
if grep -rlI --exclude-dir=node_modules -F 'eyJyb2xlIjoic2VydmljZV9yb2xl' "${SCAN_DIRS[@]}" 2>/dev/null; then
  echo "SECRET GATE FAILED: service_role JWT shape found in client bundle" >&2
  found=1
fi

if [ "$found" -eq 1 ]; then
  exit 1
fi

echo "secret gate: clean"
