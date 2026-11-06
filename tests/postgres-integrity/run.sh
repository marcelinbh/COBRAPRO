#!/usr/bin/env bash
# Finito, PostgreSQL 16 privado. Sem dotenv, sem TCP e sem produção.
set -euo pipefail
BASE=$(cd -- "$(dirname -- "$0")" && pwd -P)
BIN=/usr/lib/postgresql/16/bin
[[ $(id -u) != 0 ]] || { echo 'Não executar como root'; exit 2; }
[[ -x "$BIN/initdb" && -x "$BIN/psql" ]] || { echo 'Instale PostgreSQL 16 para esta suíte local.'; exit 2; }
RUN=$(mktemp -d /tmp/cobrapro-integrity.XXXXXX)
mkdir -m 700 "$RUN/socket" "$RUN/logs"
run() { env -i PATH=/usr/bin:/bin LANG=C.UTF-8 HOME="$RUN" "$@"; }
cleanup() {
  set +e
  run "$BIN/pg_ctl" -D "$RUN/pgdata" -m fast -w stop > "$RUN/logs/shutdown.log" 2>&1
  local stop_rc=$?
  run "$BIN/pg_ctl" -D "$RUN/pgdata" status >> "$RUN/logs/shutdown.log" 2>&1
  local status_rc=$?
  printf 'STOP_EXIT=%s\nFINAL_STATUS=%s (3 = parado)\nLOGS=%s\n' "$stop_rc" "$status_rc" "$RUN/logs" | tee -a "$RUN/logs/shutdown.log"
  if [[ $stop_rc != 0 || $status_rc != 3 ]]; then echo 'ATENÇÃO: inspecionar encerramento'; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
run "$BIN/initdb" -D "$RUN/pgdata" -A trust --no-locale -E UTF8 > "$RUN/logs/initdb.log" 2>&1
run "$BIN/pg_ctl" -D "$RUN/pgdata" -l "$RUN/logs/postgres.log" -o "-k $RUN/socket -p 55436 -c listen_addresses='' -c unix_socket_permissions=0700 -c log_error_verbosity=verbose -c log_min_error_statement=error" -w start
printf 'Cluster exclusivo local: %s\n' "$RUN"
run /usr/bin/python3 -u "$BASE/validate.py" "$BASE" "$RUN" "$(id -un)" | tee "$RUN/logs/tests-summary.log"
echo 'Execução finita concluída; trap encerra o cluster.'
