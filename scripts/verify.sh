#!/usr/bin/env bash
# Project verify gate. A green boot is not a green build — this runs the real
# typecheck and tests so every increment is provably sound.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== verify: typecheck (tsc --noEmit) =="
npm run -s typecheck

echo "== verify: tests (vitest run) =="
npm run -s test

# Web build is part of the gate. Install deps first on a fresh checkout.
if [ -f web/package.json ]; then
  if [ ! -d web/node_modules ]; then
    echo "== verify: web deps (install) =="
    npm --prefix web install --silent
  fi
  echo "== verify: web build (typecheck + vite) =="
  npm --prefix web run -s build
fi

echo "VERIFY OK"
