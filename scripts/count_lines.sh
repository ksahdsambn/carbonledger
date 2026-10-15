#!/usr/bin/env bash
# Self-developed code size (T-048, NFR-504). Counts first-party source lines
# and reports the breakdown so the number is auditable rather than asserted.
#
# Excluded from every figure: dependencies (node_modules), lockfiles, generated
# build output (frontend/dist), data files (data/**), and progress artifacts.
#
# Two figures are reported:
#   A. Application code   — backend/src + frontend/src + eval (what ships)
#   B. All JS tooling     — A + scripts/**.js verification and build tooling
#   C. Everything         — B + the offline Python dataset toolchain
# The offline Python toolchain builds the committed data assets under data/;
# its output is data, and it is neither part of the delivered application nor
# copied into the container image (.gcloudignore excludes scripts/).
set -uo pipefail
cd "$(dirname "$0")/.."

count() {
  local pattern="$1"
  local files
  files=$(git ls-files --cached | grep -E "$pattern" | grep -v 'package-lock.json' | grep -v '^data/' | grep -v '^progress/')
  if [ -z "$files" ]; then echo 0; return; fi
  printf '%s\n' "$files" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}'
}

APP=$(count '^(backend/src|frontend/src|eval)/.*\.(js|jsx|css)$')
TOOLING=$(count '^(backend|frontend|eval|scripts)/.*\.(js|jsx|css)$')
PYTHON=$(count '^scripts/.*\.py$')
EVERYTHING=$(count '\.(js|jsx|py|css)$')

echo "=== self-developed code size (T-048 / NFR-504) ==="
printf 'A. application code (backend/src + frontend/src + eval): %s\n' "$APP"
printf 'B. A + scripts/**/*.js verification and build tooling:     %s\n' "$TOOLING"
printf 'C. B + offline Python dataset toolchain:                   %s\n' "$EVERYTHING"
printf '   (Python dataset toolchain alone:                         %s)\n' "$PYTHON"
echo "target <= 7,000; hard cap 10,000"
STATUS=PASS
if [ "$TOOLING" -gt 7000 ]; then STATUS=FAIL; fi
if [ "$EVERYTHING" -gt 10000 ]; then STATUS=FAIL; fi
# The summary text states the actual cap result instead of a fixed phrase, so
# an over-cap figure C can never be reported as meeting the cap (D-106).
if [ "$EVERYTHING" -le 10000 ]; then CAPTXT="figure C $EVERYTHING within the 10,000 hard cap"; else CAPTXT="figure C $EVERYTHING EXCEEDS the 10,000 hard cap"; fi
echo "NFR-504: $STATUS (figure B $TOOLING vs 7,000 target; $CAPTXT)"
[ "$STATUS" = PASS ]
