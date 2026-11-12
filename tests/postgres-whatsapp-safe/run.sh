#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/cobrapro
PG_BIN=/usr/lib/postgresql/17/bin
ROOT=$(mktemp -d /tmp/cobrapro-whatsapp-safe.XXXXXX)
chmod 700 "$ROOT"
mkdir -m 700 "$ROOT/socket"
cleanup() {
  "$PG_BIN/pg_ctl" -D "$ROOT/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$ROOT" tests/postgres-whatsapp-safe/.build
}
trap cleanup EXIT INT TERM
export DATABASE_URL='' SUPABASE_URL='' SUPABASE_SERVICE_ROLE_KEY='' BUILT_IN_FORGE_API_KEY=''
export NODE_ENV=test EVOLUTION_API_URL=https://evolution.invalid EVOLUTION_API_KEY=synthetic-mock-key
export EVOLUTION_WEBHOOK_TOKEN=synthetic-webhook-token
export PGHOST="$ROOT/socket" PGPORT=55439 PGUSER=ubuntu PGDATABASE=postgres
"$PG_BIN/initdb" -D "$ROOT/data" -U ubuntu --auth=trust --no-locale >/dev/null
"$PG_BIN/pg_ctl" -D "$ROOT/data" -l "$ROOT/pg.log" -o "-k $ROOT/socket -p $PGPORT -c listen_addresses='' -c unix_socket_permissions=0700" -w start >/dev/null
node tests/postgres-whatsapp-safe/build.mjs
node tests/postgres-whatsapp-safe/run.mjs
