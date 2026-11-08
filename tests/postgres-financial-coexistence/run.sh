#!/usr/bin/env bash
# Execução finita estritamente local: sem dotenv, TCP, produção ou credenciais.
set -euo pipefail
SCRIPT=$(cd -- "$(dirname -- "$0")" && pwd -P)
PROJECT=$(cd "$SCRIPT/../.." && pwd -P)
BIN=/usr/lib/postgresql/17/bin
NODE=$(command -v node)
[[ $(id -u) != 0 ]] || { echo 'Não executar como root'; exit 2; }
for executable in initdb pg_ctl postgres psql; do [[ -x "$BIN/$executable" ]] || exit 2; done
ROOT=$(mktemp -d /tmp/cobrapro-financial-coexistence-pg17-XXXXXX)
chmod 700 "$ROOT"
mkdir -m 700 "$ROOT/socket" "$ROOT/evidence"
run() { env -i PATH=/usr/bin:/bin LANG=C.UTF-8 HOME="$ROOT" "$@"; }
cleanup() {
 local original=$? stop_rc status_rc
 trap - EXIT
 set +e
 run "$BIN/pg_ctl" -D "$ROOT/data" -m fast -w stop > "$ROOT/evidence/shutdown.log" 2>&1
 stop_rc=$?
 run "$BIN/pg_ctl" -D "$ROOT/data" status >> "$ROOT/evidence/shutdown.log" 2>&1
 status_rc=$?
 printf 'STOP_EXIT=%s\nFINAL_STATUS=%s (3 = parado)\nEVIDENCE=%s/evidence\n' "$stop_rc" "$status_rc" "$ROOT" | tee -a "$ROOT/evidence/shutdown.log"
 if [[ $stop_rc != 0 || $status_rc != 3 ]]; then exit 3; fi
 exit "$original"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
printf 'EVIDENCE=%s/evidence\n' "$ROOT"
run "$BIN/initdb" -D "$ROOT/data" -A trust --no-locale -E UTF8 > "$ROOT/evidence/initdb.log" 2>&1
run "$BIN/pg_ctl" -D "$ROOT/data" -l "$ROOT/evidence/postgres.log" -o "-k $ROOT/socket -p 55441 -c listen_addresses='' -c unix_socket_permissions=0700 -c log_error_verbosity=verbose" -w start
run "$NODE" "$SCRIPT/validate.mjs" "$ROOT/socket" "$(id -un)" "$PROJECT" "$ROOT/evidence" | tee "$ROOT/evidence/tests.log"
sha256sum "$PROJECT/drizzle/0020_rpc_despesas_prospectivas.sql" "$PROJECT/drizzle/0021_rpc_emprestimos_prospectivos.sql" "$PROJECT/drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql" "$PROJECT/drizzle/0025_integrar_rpc_despesas_ciclo.sql" "$PROJECT/tests/postgres-loans/fixture.sql" "$SCRIPT/baseline.json" "$SCRIPT/build-migration.py" "$SCRIPT/fixture.sql" "$SCRIPT/validate.mjs" "$SCRIPT/run.sh" "$PROJECT/server/migrations/financialCoexistence.test.ts" > "$ROOT/evidence/source-sha256.txt"
echo 'Teste sintético local concluído. Não autoriza deploy/flags.'
