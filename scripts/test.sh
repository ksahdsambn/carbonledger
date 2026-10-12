#!/usr/bin/env bash
# One-command test runner: executes every automated test suite in the repo
# and prints a summary (cases / passed / failed). Exits non-zero on failure.
set -uo pipefail
cd "$(dirname "$0")/.."

TOTAL_PASSED=0
TOTAL_FAILED=0

run_suite() {
  local name="$1"; shift
  local out
  if out=$("$@" 2>&1); then
    local p f
    p=$(printf '%s\n' "$out" | grep -oE '^# pass [0-9]+' | grep -oE '[0-9]+' || echo 0)
    f=$(printf '%s\n' "$out" | grep -oE '^# fail [0-9]+' | grep -oE '[0-9]+' || echo 0)
    echo "[suite] $name: pass=$p fail=$f"
    TOTAL_PASSED=$((TOTAL_PASSED + p))
    TOTAL_FAILED=$((TOTAL_FAILED + f))
    return 0
  else
    local p f
    p=$(printf '%s\n' "$out" | grep -oE '^# pass [0-9]+' | grep -oE '[0-9]+' || echo 0)
    f=$(printf '%s\n' "$out" | grep -oE '^# fail [0-9]+' | grep -oE '[0-9]+' || echo 0)
    echo "[suite] $name: pass=$p fail=$f (SUITE FAILED)"
    TOTAL_PASSED=$((TOTAL_PASSED + p))
    TOTAL_FAILED=$((TOTAL_FAILED + f))
    return 1
  fi
}

STATUS=0
run_suite "backend" npm test --workspace carbonledger-backend || STATUS=1

echo "----------------------------------------"
echo "TOTAL passed=$TOTAL_PASSED failed=$TOTAL_FAILED"
exit $STATUS
