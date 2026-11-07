#!/usr/bin/env bash
# Finito, local e sintético. Não lê dotenv, URLs, banco externo ou TCP.
set -euo pipefail
SCRIPT=$(cd -- "$(dirname -- "$0")" && pwd -P)
PROJECT=$(cd "$SCRIPT/../.." && pwd -P)
[[ "$(id -u)" != 0 ]] || { echo 'Execute como usuário não root.'; exit 2; }
export PATH=/usr/bin:/bin
BIN=$(find /usr/lib/postgresql -path '*/bin/initdb' -type f 2>/dev/null | sort -V | tail -1 | xargs -r dirname)
[[ -n "$BIN" && -x "$BIN/initdb" ]] || { echo 'Requer PostgreSQL local instalado; nenhuma instalação automática.'; exit 2; }
ROOT=$(mktemp -d /tmp/cobrapro-blacklist-XXXXXX)
mkdir -p "$ROOT/socket" "$ROOT/evidence"
# Socket exclusivo elimina colisão de instância; nenhum listener TCP é aberto.
PORT=$(python3 -c 'import secrets; print(20000 + secrets.randbelow(40000))')
run() { env -i PATH=/usr/bin:/bin LANG=C.UTF-8 "$@"; }
cleanup() {
  status=$?
  trap - EXIT INT TERM
  set +e
  run "$BIN/pg_ctl" -D "$ROOT/pgdata" -m immediate -w stop > "$ROOT/evidence/shutdown.log" 2>&1
  stop=$?
  echo "STOP_EXIT=$stop (cluster próprio encerrado)"
  # Artefatos de evidência permanecem; dados descartáveis são apagados após stop.
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
echo "PostgreSQL local: $($BIN/postgres --version); socket privado; porta $PORT; TCP desativado."
echo "Evidências: $ROOT/evidence"
run python3 "$SCRIPT/validate.py" "$BIN/psql" "$ROOT/socket" "$PORT" "$(id -un)" \
  "$PROJECT/drizzle/0019_base_blacklist_backend_only.sql" "$SCRIPT/fixture.sql" "$ROOT/evidence"
