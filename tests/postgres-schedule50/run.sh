#!/bin/bash
set -euo pipefail
: "${HOME:?HOME privado obrigatório}"
[[ "$HOME" == */50-schedule-compatible-v2 ]] || exit 64
[[ -z "${DATABASE_URL:-}${SUPABASE_URL:-}${SUPABASE_SERVICE_ROLE_KEY:-}${JWT_SECRET:-}${BUILT_IN_FORGE_API_KEY:-}" ]] || exit 64
mkdir -p "$HOME/evidence"
ROOT=$(mktemp -d "$HOME/evidence/pg-XXXXXX")
SOCKET="/proc/self/cwd"
chmod 0700 "$ROOT"
REPO="$PWD"
STARTED=0
cleanup() {
  if [[ "$STARTED" == 1 ]]; then
    pg_ctl -D "$ROOT/data" -m fast -w stop >> "$HOME/evidence/pg-lifecycle.log" 2>&1
    set +e
    pg_ctl -D "$ROOT/data" status >> "$HOME/evidence/pg-lifecycle.log" 2>&1
    STATUS=$?
    set -e
    printf 'FINAL_PG_STATUS=%s\n' "$STATUS" >> "$HOME/evidence/pg-lifecycle.log"
    [[ "$STATUS" == 3 ]] || exit 65
  fi
  : # socket relativo privado removido pelo shutdown
}
trap cleanup EXIT
initdb -D "$ROOT/data" -U bootstrap50 -A trust --no-locale -E UTF8 > "$HOME/evidence/pg-lifecycle.log" 2>&1
cd "$ROOT/data"
pg_ctl -D "$ROOT/data" -l "$ROOT/postgres.log" -o "-k $SOCKET -p 55553 -c listen_addresses='' -c unix_socket_permissions=0700" -w start >> "$HOME/evidence/pg-lifecycle.log" 2>&1
STARTED=1
cd "$ROOT/data"
# Bootstrap: apenas cria roles e DB. Todo DDL de apoio usa owner50,
# todo runtime usa service50 não proprietário, NOSUPERUSER NOBYPASSRLS.
psql -h "$SOCKET" -p 55553 -U bootstrap50 -d postgres -v ON_ERROR_STOP=1 -c 'CREATE ROLE owner50 LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; CREATE ROLE service50 LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; CREATE ROLE tenant50 LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;' > "$ROOT/bootstrap.log" 2>&1
psql -h "$SOCKET" -p 55553 -U bootstrap50 -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE schedule50 OWNER owner50;' >> "$ROOT/bootstrap.log" 2>&1
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$HOME/evidence/tmp" PGHOST="$SOCKET" PGPORT=55553 PGUSER=service50 PGDATABASE=schedule50 node "$REPO/tests/postgres-schedule50/run.mjs"
