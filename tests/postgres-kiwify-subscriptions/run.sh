#!/usr/bin/env bash
# Finito, descartável, sintético. Nunca lê .env nem usa banco/TCP remoto.
set -euo pipefail
SCRIPT=$(cd -- "$(dirname -- "$0")" && pwd -P)
PROJECT=$(cd "$SCRIPT/../.." && pwd -P)
[[ "$(id -u)" != 0 ]] || { echo 'Execute como usuário não root.'; exit 2; }
export PATH=/usr/bin:/bin
BIN=/usr/lib/postgresql/17/bin
[[ -x "$BIN/initdb" ]] || { echo 'Requer PG17 local; nenhuma instalação automática.'; exit 2; }
ROOT=$(mktemp -d /tmp/cobrapro-kiwify-subscriptions-XXXXXX)
mkdir -m 700 "$ROOT/socket"
mkdir "$ROOT/evidence"
PORT=$(python3 -c 'import secrets; print(20000 + secrets.randbelow(40000))')
run() { env -i PATH=/usr/bin:/bin LANG=C.UTF-8 "$@"; }
cleanup() {
 status=$?; trap - EXIT INT TERM; set +e
 run "$BIN/pg_ctl" -D "$ROOT/pgdata" -m immediate -w stop > "$ROOT/evidence/shutdown.log" 2>&1
 stop=$?; echo "STOP_EXIT=$stop"
 cp -a "$ROOT/evidence/." "$SCRIPT/evidence/"
 if [[ "$stop" == 0 ]]; then rm -rf -- "$ROOT/pgdata" "$ROOT/socket"; fi
 if [[ "$status" == 0 && "$stop" != 0 ]]; then status=1; fi
 exit "$status"
}
mkdir -p "$SCRIPT/evidence"
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
run "$BIN/initdb" -D "$ROOT/pgdata" -A trust --no-locale -E UTF8 > "$ROOT/evidence/initdb.log"
run "$BIN/pg_ctl" -D "$ROOT/pgdata" -l "$ROOT/evidence/postgres.log" -o "-k $ROOT/socket -p $PORT -c listen_addresses=''" -w start > "$ROOT/evidence/start.log"
echo "PostgreSQL: $($BIN/postgres --version); TCP desativado. Evidências: $ROOT/evidence"
run python3 "$SCRIPT/validate.py" "$BIN/psql" "$ROOT/socket" "$PORT" "$(id -un)" "$PROJECT" "$ROOT/evidence"
