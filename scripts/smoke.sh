#!/usr/bin/env bash
# Smoke chain: start the backend, call the health endpoint, verify the
# structured log output, then shut down cleanly and confirm no process
# is left behind.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=${SMOKE_PORT:-8091}
LOG_FILE=$(mktemp)

PORT=$PORT node backend/src/server.js >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Wait until the health endpoint responds (max ~10 s).
READY=0
for _ in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then READY=1; break; fi
  sleep 0.25
done

if [ "$READY" != "1" ]; then
  echo "SMOKE FAIL: health endpoint never became ready"
  cat "$LOG_FILE"
  exit 1
fi

BODY=$(curl -sf "http://127.0.0.1:$PORT/healthz")
echo "health response: $BODY"

# Structured log line must be valid JSON with an event field.
if ! head -1 "$LOG_FILE" | python -c "import json,sys; d=json.loads(sys.stdin.readline()); assert d['event']=='server_started'" 2>/dev/null; then
  echo "SMOKE FAIL: first log line is not a structured server_started event"
  cat "$LOG_FILE"
  exit 1
fi

cleanup
trap - EXIT
sleep 0.3

# Confirm no leftover process is listening on the port.
if curl -sf --max-time 2 "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
  echo "SMOKE FAIL: server still responding after shutdown"
  exit 1
fi

echo "SMOKE OK"
