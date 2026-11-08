# Ciclo prospectivo local — PostgreSQL17

Execute somente `env -i PATH="$PATH" HOME=/home/ubuntu bash tests/postgres-loan-cycle/run.sh` no repositório. O runner inicia cluster sintético privado, UNIX socket em `/tmp/cobrapro-loan-cycle-pg17-*`, `listen_addresses=''`, sem dotenv/URL/credenciais; trap encerra inclusive em falha. Reutiliza **somente estrutura e dados sintéticos** do fixture `tests/postgres-loans/fixture.sql`. Não lê backup privado nem produção.

Ordem: fixture → 0021 → `antes-0022.sql` (origens anteriores intacta/adulteradas sintéticas) → 0022 → `validate.mjs`. Evidências, hashes e shutdown ficam no diretório impresso. Não aplica 0013/0015: tenta cada uma em transação abortada e demonstra bloqueio legado.

Treze grupos cobrem PostgreSQL/DATE, snapshots completos futuros, 0021 anterior íntegra versus adulterações, BRT 23:59:59.999 → 00:00 em quatro fusos, juros embutidos sem cobrança duplicada, baixa parcial/integral, residual, quitação somente todas pagas, ledger/saldo-base, cross-tenant, hash/payload/UUID, retorno perdido/replay, guardas manual/owner/ledger, ACL e RLS privadas, rollback em nove escritas, oito replays concorrentes e corridas integral/integral e parcial/integral, troca adversarial de owner, homônimos/overloads e legado intacto. Testa PostgreSQL real; não simula rede PostgREST/failover, browser ou produção.

**Decisão comercial implementada e visível:** defaults 2% multa única + 0,033% mora simples por dia civil BRT após o vencimento, sobre `valor_original` que já inclui juros contratuais. Ao primeiro parcial, encargos ficam fixados; residual não é multado novamente. Integral exige igualdade exata; parcial estritamente menor; nenhum desconto, renovação, transferência de residual ou troca da conta original.

**Fronteira:** a guarda de ledger bloqueia qualquer movimentação manual e UPDATE/DELETE na conta que contém origem 0021, inclusive movimentos de outra categoria; ela não saneia o livro histórico. Outras RPCs de despesas/transferências não têm autorização nesta migration e exigem conta separada ou integração autorizada futura. Só empréstimos mensal simples 1..60; não constitui liberação global.
