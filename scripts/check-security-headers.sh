#!/usr/bin/env bash
# check-security-headers.sh
# Asserts that the API server responds with all required security headers.
# Usage: bash scripts/check-security-headers.sh [URL]
#   URL defaults to http://localhost:${PORT:-8080}/api/healthz
set -euo pipefail

TARGET="${1:-http://localhost:${PORT:-8080}/api/healthz}"

REQUIRED_HEADERS=(
  "content-security-policy"
  "x-content-type-options"
  "strict-transport-security"
  "referrer-policy"
)

# ── readiness wait ────────────────────────────────────────────────────────────
MAX_WAIT=30   # seconds
INTERVAL=2
elapsed=0
echo "Waiting for API server at $TARGET ..."
until curl -sf "$TARGET" > /dev/null 2>&1; do
  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    echo "ERROR: API server did not respond within ${MAX_WAIT}s — aborting."
    exit 2
  fi
  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
done
echo "API server is up (waited ${elapsed}s)."
echo ""

# ── header check ─────────────────────────────────────────────────────────────
HEADERS=$(curl -sI "$TARGET")
echo "$HEADERS"
echo ""

FAILED=0
for header in "${REQUIRED_HEADERS[@]}"; do
  if echo "$HEADERS" | grep -qi "^${header}:"; then
    echo "  [PASS] ${header}"
  else
    echo "  [FAIL] ${header} — not present"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
if [ "$FAILED" -gt 0 ]; then
  echo "Security header check FAILED: ${FAILED} header(s) missing."
  exit 1
else
  echo "Security header check PASSED: all required headers present."
fi
