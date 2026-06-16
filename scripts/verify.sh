#!/usr/bin/env bash
# Project verify gate. A green boot is not a green build — this runs the real
# typecheck and tests so every increment is provably sound.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== verify: typecheck (tsc --noEmit) =="
npm run -s typecheck

echo "== verify: tests (vitest run) =="
npm run -s test

# Web build is added to this gate once the Vite app lands.
if [ -f web/package.json ]; then
  echo "== verify: web build =="
  npm --prefix web run -s build
fi

echo "VERIFY OK"
