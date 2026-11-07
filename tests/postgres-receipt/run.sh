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
mkdir -p "$ROOT/socket" "$ROOT/evidence/legacy" "$ROOT/evidence/prod"
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
for PROFILE in legacy prod; do
  DB=rpc_validation
  FIXTURE=fixture.sql
  if [[ "$PROFILE" == prod ]]; then DB=rpc_validation_prod; FIXTURE=fixture-prod.sql; fi
  EVIDENCE="$ROOT/evidence/$PROFILE"
  PSQL=(psql -X -h "$ROOT/socket" -p 55432 -U "$USER_NAME" -d "$DB" -v ON_ERROR_STOP=1 -v VERBOSITY=verbose)
  run psql -X -h "$ROOT/socket" -p 55432 -U "$USER_NAME" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB"
  run "${PSQL[@]}" -1 -f "$SCRIPT/$FIXTURE" > "$EVIDENCE/fixture.log"
  # O preflight deve funcionar antes do DDL nos dois contratos físicos.
  run "${PSQL[@]}" -f "$PROJECT/reports/preflight-rpcs-financeiras.sql" > "$EVIDENCE/preflight-before.log"
  if [[ "$PROFILE" == prod ]]; then
    run python3 "$SCRIPT/validate-preflight.py" "$ROOT" "$PROJECT" | tee "$EVIDENCE/preflight-tests-summary.log"
  fi
  for n in 1 2; do
    if [[ "$PROFILE" == legacy ]]; then
      run "${PSQL[@]}" -1 -f "$PROJECT/drizzle/0013_integridade_parcelas.sql" > "$EVIDENCE/migration-0013-$n.log"
    fi
    run "${PSQL[@]}" -1 -f "$PROJECT/drizzle/0015_rpc_recebimento_parcela.sql" > "$EVIDENCE/migration-0015-$n.log"
  done
  run python3 "$SCRIPT/validate.py" "$ROOT" "$PROFILE" | tee "$EVIDENCE/tests-summary.log"
  run "${PSQL[@]}" -f "$PROJECT/reports/preflight-rpcs-financeiras.sql" > "$EVIDENCE/preflight-after.log"
done
sha256sum "$PROJECT/drizzle/0013_integridade_parcelas.sql" "$PROJECT/drizzle/0015_rpc_recebimento_parcela.sql" "$PROJECT/reports/preflight-rpcs-financeiras.sql" "$SCRIPT/fixture.sql" "$SCRIPT/fixture-prod.sql" > "$ROOT/evidence/source-sha256.txt"
echo 'Validação concluída. O trap encerra o cluster local.'
