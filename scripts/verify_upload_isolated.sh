#!/usr/bin/env bash
# Isolated runner for the upload verification suite (used by scripts/test.sh).
# Sets throwaway store/storage roots so repeated runs never share state.
set -uo pipefail
cd "$(dirname "$0")/.."
STORE_ROOT=$(mktemp -d) STORAGE_ROOT=$(mktemp -d) node scripts/verify_upload.js 2>/dev/null
