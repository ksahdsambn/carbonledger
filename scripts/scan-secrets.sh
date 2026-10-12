#!/usr/bin/env bash
# Secret scan across the repository (plan rule 7 / NFR-304). Looks for
# private key headers, service-account JSON signatures and Google API key
# patterns. Exits non-zero on any hit. .git and node_modules are excluded
# (untracked/ignored); all tracked files ARE scanned.
set -uo pipefail
cd "$(dirname "$0")/.."

HITS=0

scan() {
  local label="$1"; shift
  local matches
  matches=$(git ls-files -z --cached --others --exclude-standard | xargs -0 grep -lE "$1" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "SECRET SCAN HIT [$label]:"
    echo "$matches"
    HITS=$((HITS + 1))
  fi
}

scan "private-key-header"   '-----BEGIN [A-Z ]*PRIVATE KEY-----'
scan "service-account-json" '"type": *"service_account"'
scan "google-api-key"       'AIza[A-Za-z0-9_-]{30,}'
scan "gcp-oauth-refresh"    '"refresh_token": *"[A-Za-z0-9._-]{20,}"'

if [ "$HITS" -gt 0 ]; then
  echo "SECRET SCAN: FAILED ($HITS pattern groups matched)"
  exit 1
fi
echo "SECRET SCAN: PASSED (0 hits)"
