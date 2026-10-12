#!/usr/bin/env bash
# One-command test runner: executes every automated test suite in the repo
# and prints a summary (cases / passed / failed). Exits non-zero on failure.
set -uo pipefail
cd "$(dirname "$0")/.."

TOTAL_PASSED=0
TOTAL_FAILED=0
STATUS=0

tap_field() {
  printf '%s\n' "$1" | grep -E "^# $2 [0-9]+$" | tail -1 | awk '{print $3}'
}

run_suite() {
  local name="$1"; shift
  local out
  out=$(node --test --test-reporter=tap "$@" 2>&1)
  local rc=$?
  local p f
  p=$(tap_field "$out" pass); f=$(tap_field "$out" fail)
  p=${p:-0}; f=${f:-0}
  echo "[suite] $name: pass=$p fail=$f"
  TOTAL_PASSED=$((TOTAL_PASSED + p))
  TOTAL_FAILED=$((TOTAL_FAILED + f))
  if [ "$rc" -ne 0 ] || [ "$f" != "0" ]; then STATUS=1; fi
}

run_suite "backend" backend/test/*.test.js

echo "----------------------------------------"
echo "TOTAL passed=$TOTAL_PASSED failed=$TOTAL_FAILED"
if [ "$STATUS" -ne 0 ] || [ "$TOTAL_FAILED" -ne 0 ]; then
  echo "TESTS FAILED"
  exit 1
fi
echo "TESTS PASSED"
exit 0
