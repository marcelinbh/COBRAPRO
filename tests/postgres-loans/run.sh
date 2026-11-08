#!/usr/bin/env bash
# Só UNIX socket/cluster sintético, env-i; sem dotenv, URLs ou conexão remota.
set -euo pipefail
SCRIPT=$(cd -- "$(dirname -- "$0")" && pwd -P)
PROJECT=$(cd "$SCRIPT/../.." && pwd -P)
BIN=/usr/lib/postgresql/17/bin
[[ $(id -u) != 0 && -x "$BIN/initdb" ]] || { echo 'Requer usuário não root e PostgreSQL17 local.'; exit 2; }
NODE=$(command -v node)
ROOT=$(mktemp -d /tmp/cobrapro-loans-pg17-XXXXXX)
mkdir -m 700 "$ROOT/socket" "$ROOT/evidence"
run() { env -i PATH=/usr/bin:/bin LANG=C.UTF-8 "$@"; }
cleanup() {
  set +e
  run "$BIN/pg_ctl" -D "$ROOT/data" -m fast -w stop > "$ROOT/evidence/shutdown.log" 2>&1
  echo "STOP_EXIT=$?" | tee -a "$ROOT/evidence/shutdown.log"
  run "$BIN/pg_ctl" -D "$ROOT/data" status >> "$ROOT/evidence/shutdown.log" 2>&1
  echo "FINAL_STATUS=$? (3 = parado)" | tee -a "$ROOT/evidence/shutdown.log"
}
trap cleanup EXIT
printf 'EVIDENCE=%s/evidence\n' "$ROOT"
run "$BIN/initdb" -D "$ROOT/data" -A trust --no-locale -E UTF8 > "$ROOT/evidence/initdb.log"
run "$BIN/pg_ctl" -D "$ROOT/data" -l "$ROOT/evidence/postgres.log" -o "-k $ROOT/socket -p 55439 -c listen_addresses=''" -w start
PSQL=("$BIN/psql" -X -h "$ROOT/socket" -p 55439 -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1)
run "${PSQL[@]}" -1 -f "$SCRIPT/fixture.sql" > "$ROOT/evidence/fixture.log"
run "${PSQL[@]}" -f "$PROJECT/drizzle/0021_rpc_emprestimos_prospectivos.sql" > "$ROOT/evidence/migration.log"
run "$NODE" "$SCRIPT/validate.mjs" "$ROOT/socket" "$(id -un)" "$PROJECT" | tee "$ROOT/evidence/tests.log"
sha256sum "$PROJECT/drizzle/0021_rpc_emprestimos_prospectivos.sql" "$SCRIPT/fixture.sql" "$SCRIPT/validate.mjs" > "$ROOT/evidence/source-sha256.txt"
echo 'Sucesso sintético; não implica rollout. Trap encerra cluster.'
