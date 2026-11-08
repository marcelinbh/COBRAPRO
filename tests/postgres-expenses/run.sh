#!/usr/bin/env bash
# PostgreSQL privado/finito. Sem dotenv, conexão externa, TCP ou migrations 0013/0015.
set -euo pipefail
BASE=$(cd -- "$(dirname -- "$0")" && pwd -P)
BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
[[ $(id -u) != 0 ]] || { echo 'Não executar como root'; exit 2; }
[[ "$BIN" =~ ^/usr/lib/postgresql/(16|17)/bin$ ]] || { echo 'PG_BIN deve apontar para binários locais explícitos PG16/PG17 em /usr/lib/postgresql.'; exit 2; }
for executable in initdb psql pg_ctl postgres; do
  [[ -x "$BIN/$executable" ]] || { echo "Binário local ausente: $BIN/$executable; nenhuma instalação/rede automática."; exit 2; }
done
RUN=$(mktemp -d /tmp/cobrapro-expenses.XXXXXX)
chmod 700 "$RUN"
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
run "$BIN/pg_ctl" -D "$RUN/pgdata" -l "$RUN/logs/postgres.log" -o "-k $RUN/socket -p 55437 -c listen_addresses='' -c unix_socket_permissions=0700 -c log_error_verbosity=verbose -c log_min_error_statement=error" -w start
printf 'Cluster exclusivo local: %s\n' "$RUN"
# validate.py original é PG16 rígido. Adaptar SOMENTE três marcadores conhecidos
# em memória, não editar artefato alheio nem enfraquecer o gate de versão/socket.
run /usr/bin/python3 -u - "$BASE" "$RUN" "$(id -un)" "$BIN" <<'PY' | tee "$RUN/logs/tests-summary.log"
import pathlib
import sys
base, run, owner, binary = sys.argv[1:]
major = int(pathlib.Path(binary).parent.name)
source = (pathlib.Path(base)/'validate.py').read_text()
changes = {
    "BIN = '/usr/lib/postgresql/16/bin'": 'BIN = '+repr(binary),
    "'isolated socket-only PostgreSQL16'": repr('isolated socket-only PostgreSQL'+str(major)),
    "'16||'+str(RUN/'socket')": repr(str(major)+'||')+"+str(RUN/'socket')",
    "'postgres_major':16": "'postgres_major':"+str(major),
}
for old, new in changes.items():
    if source.count(old) != 1:
        raise RuntimeError('Contrato do runner original mudou; não relaxar verificações: '+old)
    source = source.replace(old, new, 1)
sys.argv = [str(pathlib.Path(base)/'validate.py'), base, run, owner]
exec(compile(source, sys.argv[0], 'exec'), {'__name__': '__main__', '__file__': sys.argv[0]})
PY
echo 'Execução finita concluída; trap encerra o cluster.'
