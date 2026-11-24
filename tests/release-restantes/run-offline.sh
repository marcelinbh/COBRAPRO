#!/usr/bin/env bash
set -euo pipefail
SUITE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$SUITE/../.." && pwd)"
NODE="$(command -v node)"
MINPATH="$(dirname "$NODE"):/usr/bin:/bin"
mkdir -p "$SUITE/artifacts"
cd "$ROOT"
CLEAN=(env -i HOME="$SUITE/artifacts" PATH="$MINPATH" LANG=C.UTF-8 NODE_ENV=test)
if [[ -n "${PG_BIN:-}" ]]; then CLEAN+=(PG_BIN="$PG_BIN"); fi
"${CLEAN[@]}" /usr/bin/python3 "$SUITE/verify-stack.py"
"${CLEAN[@]}" /usr/bin/python3 "$SUITE/regenerate43.py"
"${CLEAN[@]}" "$NODE" "$ROOT/node_modules/vitest/vitest.mjs" run --config "$SUITE/vitest.config.ts"
"${CLEAN[@]}" "$NODE" "$SUITE/typecheck.mjs"
"${CLEAN[@]}" "$NODE" "$SUITE/pg/combined.mjs"
