#!/usr/bin/env bash
# One-command build: install dependencies if missing, then build the
# frontend bundle. The backend is plain ES modules and needs no build step;
# it is verified by a syntax pass.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d node_modules ] || [ ! -d frontend/node_modules ]; then
  npm install --no-audit --no-fund
fi

# Backend syntax pass (no build required for plain ESM).
for f in backend/src/*.js backend/src/*/*.js; do
  node --check "$f"
done

npm run build --workspace carbonledger-frontend

# Assert the SEO surface over the fresh dist (fails the build on regression).
node scripts/seo/verify.js

echo "BUILD OK"
