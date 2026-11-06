#!/usr/bin/env bash
# Apenas cluster descartável local: não carrega dotenv, não aceita DATABASE_URL.
set -euo pipefail
SCRIPT=$(cd -- "$(dirname -- "$0")" && pwd -P)
PROJECT=$(cd "$SCRIPT/../.." && pwd -P)
[[ "$(id -u)" != 0 ]] || { echo 'Execute como usuário não root.'; exit 2; }
export PATH=/usr/bin:/bin
BIN=$(find /usr/lib/postgresql -path '*/bin/initdb' -type f 2>/dev/null | sort -V | tail -1 | xargs -r dirname)
[[ -n "$BIN" && -x "$BIN/initdb" ]] || { echo 'Requer PostgreSQL e postgresql-contrib locais.'; exit 2; }
ROOT=$(mktemp -d /tmp/cobrapro-pg-test-XXXXXX)
mkdir -p "$ROOT/socket" "$ROOT/evidence"
USER_NAME=$(id -un)
echo "Evidências isoladas: $ROOT/evidence"
cleanup() {
  set +e
  env -i PATH=/usr/bin:/bin "$BIN/pg_ctl" -D "$ROOT/pgdata" -m fast -w stop > "$ROOT/evidence/shutdown.log" 2>&1
  echo "STOP_EXIT=$?"
  env -i PATH=/usr/bin:/bin "$BIN/pg_ctl" -D "$ROOT/pgdata" status >> "$ROOT/evidence/shutdown.log" 2>&1
  echo "FINAL_STATUS=$? (3 = parado)"
}
trap cleanup EXIT
run() { env -i PATH=/usr/bin:/bin LANG=C.UTF-8 "$@"; }
run "$BIN/initdb" -D "$ROOT/pgdata" -A trust --no-locale -E UTF8 > "$ROOT/evidence/initdb.log"
run "$BIN/pg_ctl" -D "$ROOT/pgdata" -l "$ROOT/evidence/postgres.log" -o "-k $ROOT/socket -p 55432 -c listen_addresses=''" -w start
PSQL=(psql -X -h "$ROOT/socket" -p 55432 -U "$USER_NAME" -d rpc_validation -v ON_ERROR_STOP=1 -v VERBOSITY=verbose)
run psql -X -h "$ROOT/socket" -p 55432 -U "$USER_NAME" -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE rpc_validation'
run "${PSQL[@]}" -1 -f "$SCRIPT/fixture.sql" > "$ROOT/evidence/fixture.log"
# Pré-auditoria funciona mesmo ANTES da coluna que a 0015 adiciona.
run "${PSQL[@]}" -f "$PROJECT/reports/preflight-rpcs-financeiras.sql" > "$ROOT/evidence/preflight-before.log"
for n in 1 2; do
  run "${PSQL[@]}" -1 -f "$PROJECT/drizzle/0013_integridade_parcelas.sql" > "$ROOT/evidence/migration-0013-$n.log"
  run "${PSQL[@]}" -1 -f "$PROJECT/drizzle/0015_rpc_recebimento_parcela.sql" > "$ROOT/evidence/migration-0015-$n.log"
done
run python3 "$SCRIPT/validate.py" "$ROOT" | tee "$ROOT/evidence/tests-summary.log"
run "${PSQL[@]}" -f "$PROJECT/reports/preflight-rpcs-financeiras.sql" > "$ROOT/evidence/preflight-after.log"
sha256sum "$PROJECT/drizzle/0013_integridade_parcelas.sql" "$PROJECT/drizzle/0015_rpc_recebimento_parcela.sql" "$PROJECT/reports/preflight-rpcs-financeiras.sql" > "$ROOT/evidence/source-sha256.txt"
echo 'Validação concluída. O trap encerra o cluster local.'
