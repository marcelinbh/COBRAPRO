#!/usr/bin/env bash
# Finito, local e sintético. Reutiliza fixture.sql pai; nunca .env/URLs/TCP.
set -euo pipefail
SCRIPT=$(cd -- "$(dirname -- "$0")" && pwd -P)
PROJECT=$(cd "$SCRIPT/../../.." && pwd -P)
[[ "$(id -u)" != 0 ]] || { echo 'Execute como usuário não root.'; exit 2; }
export PATH=/usr/bin:/bin
BIN=/usr/lib/postgresql/17/bin
[[ -x "$BIN/initdb" ]] || { echo 'Requer PG17 local; nenhuma instalação automática.'; exit 2; }
ROOT=$(mktemp -d /tmp/cobrapro-blacklist-reopen-XXXXXX)
mkdir -m 700 "$ROOT/socket"
mkdir "$ROOT/evidence"
PORT=$(python3 -c 'import secrets; print(20000 + secrets.randbelow(40000))')
run() { env -i PATH=/usr/bin:/bin LANG=C.UTF-8 "$@"; }
cleanup() {
  status=$?; trap - EXIT INT TERM; set +e
  run "$BIN/pg_ctl" -D "$ROOT/pgdata" -m immediate -w stop > "$ROOT/evidence/shutdown.log" 2>&1
  stop=$?; echo "STOP_EXIT=$stop (cluster próprio encerrado)"
  mkdir -p "$SCRIPT/evidence"
  cp -a "$ROOT/evidence/." "$SCRIPT/evidence/"
  if [[ "$stop" == 0 ]]; then rm -rf -- "$ROOT/pgdata" "$ROOT/socket"; fi
  if [[ "$status" == 0 && "$stop" != 0 ]]; then status=1; fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
run "$BIN/initdb" -D "$ROOT/pgdata" -A trust --no-locale -E UTF8 > "$ROOT/evidence/initdb.log"
run "$BIN/pg_ctl" -D "$ROOT/pgdata" -l "$ROOT/evidence/postgres.log" \
  -o "-k $ROOT/socket -p $PORT -c listen_addresses='' -c max_connections=25" -w start > "$ROOT/evidence/start.log"
echo "PostgreSQL: $($BIN/postgres --version); socket exclusivo; TCP desativado."
echo "Evidências: $ROOT/evidence"
run python3 "$SCRIPT/validate.py" "$BIN/psql" "$ROOT/socket" "$PORT" "$(id -un)" "$PROJECT" "$ROOT/evidence"
