#!/usr/bin/env bash
# Teste finito, local e sintético. Não lê dotenv e não aceita URL produtiva.
set -euo pipefail
SCRIPT=$(cd -- "$(dirname -- "$0")" && pwd -P)
PROJECT=$(cd "$SCRIPT/../.." && pwd -P)
[[ "$(id -u)" != 0 ]] || { echo 'Execute como usuário não root.'; exit 2; }
export PATH=/usr/bin:/bin
BIN=$(find /usr/lib/postgresql -path '*/bin/initdb' -type f 2>/dev/null | sort -V | tail -1 | xargs -r dirname)
[[ -n "$BIN" && -x "$BIN/initdb" ]] || { echo 'Requer PostgreSQL local.'; exit 2; }
ROOT=$(mktemp -d /tmp/cobrapro-access-XXXXXX)
mkdir -p "$ROOT/socket" "$ROOT/evidence"
run() { env -i PATH=/usr/bin:/bin LANG=C.UTF-8 "$@"; }
cleanup() {
  set +e
  run "$BIN/pg_ctl" -D "$ROOT/pgdata" -m fast -w stop > "$ROOT/evidence/shutdown.log" 2>&1
  echo "STOP_EXIT=$?"
}
trap cleanup EXIT
run "$BIN/initdb" -D "$ROOT/pgdata" -A trust --no-locale -E UTF8 > "$ROOT/evidence/initdb.log"
run "$BIN/pg_ctl" -D "$ROOT/pgdata" -l "$ROOT/evidence/postgres.log" -o "-k $ROOT/socket -p 55434 -c listen_addresses=''" -w start > "$ROOT/evidence/start.log"
PSQL=(psql -X -h "$ROOT/socket" -p 55434 -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1)
run "${PSQL[@]}" -f "$SCRIPT/fixture.sql" > "$ROOT/evidence/fixture.log"
for n in 1 2; do
  run "${PSQL[@]}" -1 -f "$PROJECT/drizzle/0018_conter_acesso_publico_tabelas.sql" > "$ROOT/evidence/migration-$n.log"
done
run "${PSQL[@]}" -f "$SCRIPT/validate.sql" > "$ROOT/evidence/validation.log"
echo "Contenção aprovada: reaplicação, ACL anon/authenticated, RLS, backend, linhas preservadas."
echo "Evidências: $ROOT/evidence"
