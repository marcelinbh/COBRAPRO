#!/usr/bin/env bash
set -euo pipefail
SCRIPT=$(cd -- "$(dirname -- "$0")" && pwd -P)
PROJECT=$(cd "$SCRIPT/../.." && pwd -P)
cd "$PROJECT"
BIN=/usr/lib/postgresql/17/bin
NODE=$(command -v node)
[[ $(id -u) != 0 && -x "$BIN/initdb" ]] || exit 2
ROOT=$(mktemp -d /tmp/cobrapro-renewal-safe-pg17-XXXXXX)
umask 077
chmod 700 "$ROOT"
mkdir -m 700 "$ROOT/socket" "$ROOT/evidence"
run() { env -i PATH=/usr/bin:/bin LANG=C.UTF-8 "$@"; }
cleanup() {
 set +e
 run "$BIN/pg_ctl" -D "$ROOT/data" -m fast -w stop > "$ROOT/evidence/shutdown.log" 2>&1
 stop_rc=$?; echo "STOP_EXIT=$stop_rc" | tee -a "$ROOT/evidence/shutdown.log"
 run "$BIN/pg_ctl" -D "$ROOT/data" status >> "$ROOT/evidence/shutdown.log" 2>&1
 status_rc=$?; echo "FINAL_STATUS=$status_rc (3 = parado)" | tee -a "$ROOT/evidence/shutdown.log"
 if [[ $stop_rc != 0 || $status_rc != 3 ]]; then exit 1; fi
}
trap cleanup EXIT
printf 'EVIDENCE=%s/evidence\n' "$ROOT"
run "$BIN/initdb" -D "$ROOT/data" -A trust --no-locale -E UTF8 > "$ROOT/evidence/initdb.log"
run "$BIN/pg_ctl" -D "$ROOT/data" -l "$ROOT/evidence/postgres.log" -o "-k $ROOT/socket -p 55441 -c listen_addresses='' -c unix_socket_permissions=0700" -w start
PSQL=("$BIN/psql" -X -h "$ROOT/socket" -p 55441 -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1)
run "${PSQL[@]}" -1 -f "$PROJECT/tests/postgres-loans/fixture.sql" > "$ROOT/evidence/fixture.log"
run "${PSQL[@]}" -1 -f "$PROJECT/tests/postgres-financial-coexistence/fixture.sql" > "$ROOT/evidence/fixture-coexistence.log"
run "${PSQL[@]}" -f "$PROJECT/drizzle/0020_rpc_despesas_prospectivas.sql" > "$ROOT/evidence/0020.log"
run "${PSQL[@]}" -f "$PROJECT/drizzle/0021_rpc_emprestimos_prospectivos.sql" > "$ROOT/evidence/0021.log"
run "${PSQL[@]}" -c "CREATE TABLE test_before_0022(r jsonb); INSERT INTO test_before_0022 SELECT public.rpc_criar_emprestimo(1,'99999999-9999-4999-8999-999999999999',1,1,'mensal','mensal',1000.03,5.56,1,'2026-01-01','2026-01-01',ARRAY['2026-11-10'::date],NULL,NULL);" > "$ROOT/evidence/before-0022.log"
run "${PSQL[@]}" -f "$PROJECT/drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql" > "$ROOT/evidence/0022.log"
run "${PSQL[@]}" -f "$PROJECT/drizzle/0025_integrar_rpc_despesas_ciclo.sql" > "$ROOT/evidence/0025.log"
run "$NODE" "$SCRIPT/validate.mjs" "$ROOT/socket" "$(id -un)" "$PROJECT" "${1:-}" | tee "$ROOT/evidence/tests.log"
sha256sum "$PROJECT/drizzle/0031_rpc_renovacao_juros_prospectiva.sql" "$SCRIPT"/* > "$ROOT/evidence/source-sha256.txt"
echo 'Teste sintético local concluído; não certifica produção.'
