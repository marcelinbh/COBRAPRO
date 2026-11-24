# Hotfix36a — certificação preventiva PG17

**PASS local36a; não é GO produtivo nem certificação37.** SHA36a testado e final: `df1abe0b096b3f993954f16b3c93a1cdfb0ddd36cb968158f39b05150eaeba8f` / `df1abe0b096b3f993954f16b3c93a1cdfb0ddd36cb968158f39b05150eaeba8f`. SHA36 frozen: `7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f`.

## Execução e isolamento

`cd /home/ubuntu/cobrapro && node tests/postgres-multa-metadata36a/build.mjs --check`

`cd /home/ubuntu/cobrapro && node tests/postgres-multa-metadata36a/runner.mjs`

`cd /home/ubuntu/cobrapro && pnpm exec vitest run server/migrations/multaMetadata36a.postgres.test.ts`

Duas freshDB preventivas e duas bases adicionais negativas de ANALYZE original. Somente fixtures sintéticas e migrations20/21/22/25/31/33/34/35/36 frozen; nenhum builder antigo, runtime37, produção, Git, rede, browser, mensagem ou corrupção privilegiada. Hashes frozen e comandos exatos initdb/pg_ctl constam em results36a.json.

PG17 local: `{"version":"PostgreSQL 17.11 (Ubuntu 17.11-1.pgdg24.04+2) on x86_64-pc-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit","autovacuum":"on","naptime":"1s","listen":"","socket_permissions":"0700","vacuum_threshold":"50","vacuum_scale_factor":"0.2","analyze_threshold":"50"}`. Socket0700, listen_addresses vazio, autovacuum ON sempre/naptime1s. Thresholds padrão50/0.2/50 durante instalação original/preventiva. Após36a, ALTER SYSTEM do cluster próprio define vacuum threshold1/scale_factor0 e analyze threshold1000000 para observar autovacuum sem ALTER reloptions; reloptions NULL preservadas. Antes de montar a segunda freshDB, configuração global volta aos defaults. ANALYZE e VACUUM(FREEZE,ANALYZE) todas10 tables36 são reais e fora de transação. Nenhum selo foi atualizado fora da migration36a.

## Resultado agregado

61 checks registrados, 0 falhas. Em cada freshDB: 11 negativos preflight, 1 reapply55000 e 10 negativos runtime55000; total44 negativos além de4 recusas original/hotfix nas duas bases negativas. Controle original34/35/36 positivo logo após instalação36 e imediatamente antes36a.

Delta36a: uma função antiga alterada (apenas prosrc de multa36_metadata), 97 funções públicas intocadas, uma assinatura na linha manifesto36 id1 alterada. Todas as demais linhas de todas as tabelas públicas permanecem idênticas na instalação. Zero linhas money/proof alteradas pela instalação, manutenção e recusas; ACL/owner/RLS/rowtypes/colunas/constraints/triggers/policies/sequences intactos. O corpo metadata recebe exclusivamente a subtração dos seis campos pg_class relpages/reltuples/relallvisible/relallfrozen/relfrozenxid/relminmxid. Verificadores34/35/36 passam depois de ANALYZE, VACUUM/FREEZE e autovacuum sem reseal.

## fresh1

Checks: 30; negativos: 22; manutenção: 2×10 comandos. 26 linhas históricas em 11 tabelas comparadas por ID, zero alteradas.

Baseline preventiva não vazia: {"contractId":1001,"create35":1,"apply36":1,"receive36Partial":1,"originalVerifierValid":true,"thresholdsDefault":true}. Um criar35/apply36/receive36 parcial legítimo antes36a, ainda nos thresholds padrão, com verifier original válido. 8 provas anteriores em 7 tabelas permaneceram exatamente intactas até fim. Operações para observar autovacuum abaixo são adicionais a essa baseline.

Original ANALYZE em base dedicada metadata36a_old_analyze1: `{"database":"metadata36a_old_analyze1","diff":[{"relation":"multa36_capacidades","field":"reltuples","before":-1,"after":0}],"originalReject":{"code":"55000","message":"Metadata/ACL/controlguard36 desconhecido"},"hotfixReject":{"code":"55000","message":"Metadata/ACL/controlguard36 desconhecido"},"rolledBack":true,"reseal":false,"functionsMoneyManifestUnchanged":true,"catalogRestoredAfterRollback":false}`. A mudança reltuples -1→0 não foi revertida por rollback; por isso a base negativa jamais recebe36a e não contamina o teste preventivo.

Autovacuum REAL: antes `[{"relname":"multa36_capacidades","last_autovacuum":null,"autovacuum_count":0,"n_tup_ins":24,"n_tup_del":24,"n_dead_tup":0},{"relname":"multa36_coexistencia","last_autovacuum":null,"autovacuum_count":0,"n_tup_ins":0,"n_tup_del":0,"n_dead_tup":0}]`; depois `[{"relname":"multa36_capacidades","last_autovacuum":"2026-11-24 04:07:13.457833+00","autovacuum_count":2,"n_tup_ins":360,"n_tup_del":360,"n_dead_tup":84},{"relname":"multa36_coexistencia","last_autovacuum":"2026-11-24 04:07:13.458307+00","autovacuum_count":2,"n_tup_ins":8,"n_tup_del":8,"n_dead_tup":2}]`. Timestamp last_autovacuum não nulo e contador de capacidades36 aumenta. Não basta espera presumida.

Operações legítimas service_role: 8criar35, 8apply36, 4receive36parcial, 4renew36, 8receive36integral; 8 contratos quitados. Alocação total `{"pernas":16,"contratos":8,"principal":"800.00","juros":"120.00","multa":"60.00","mora":"0.32"}` (16pernas, principal800.00, juros120.00, multa60.00, mora0.32). São efeitos financeiros legítimos, não delta da manutenção; snapshot após operações e durante espera autovacuum idêntico. Capacidades/coexistência/fences resíduos zero.

| Tabela | Linhas finais | SHA256 snapshot |
|---|---:|---|
| users | 2 | `0ab11d2603e2e22bce5df41ffdb9a267eae37e2d22abf2531de7b5e5c476c629` |
| clientes | 2 | `189e9b7ee5eeb8abf2a2bcc98a641bc6b9f285421e354aabc0bd90a3ae623354` |
| contas_caixa | 5 | `e58189234d5d09d2b2479aab0633c769cabbd0a52a8bf2bc61b1e4deac221138` |
| contratos | 10 | `6fb02b820131f21c27fe8b425150f56d4c2ac887725eea698ec0e0f7253534de` |
| parcelas | 15 | `f046a3924f85279897cd328dd4d7e6d7624ea5c5f4a198c181036ea038213e90` |
| transacoes_caixa | 28 | `9294fbc3b35ff6d1e908fe9b0691030a2515c0d2b4e369d7fd9862fed5017a60` |
| contrato_historico | 35 | `6bd3c29bc7983a8ea373b230777b5c8d86582000fc46bb7f693029f58c12a0f9` |
| multimodal_operacoes | 9 | `c3f991365a58696879c65e20e4f6155afa0e3a1c5ef575e8649ebccf4b554185` |
| multimodal_pernas | 9 | `4736dec6a47a4877eb3577273b2323f4560bcaac93a88b70e3b853bdfd2c6098` |
| multa36_operacoes | 26 | `13259decc44111f9682356f257f1a6d9f3797c85ee38434f19509251dbb1937a` |
| multa36_origens | 9 | `b48a9e2c3d0f6c7adfabbdd51c9b4a3d6e3047db0d0cae02dee001c22645da1c` |
| multa36_estados | 9 | `b060b377166110a7782e88d528abedf476d4f5ea035188a48d81c38c999104ce` |
| multa36_encargos | 9 | `39e288311a5e7abd7d8cbc066328e17f9f6baa9c37d0eded9b5d5e2ef3931d34` |
| multa36_pernas | 17 | `1e1f21d5e16f84d49a0e2af1cad196068c8416ee4f47baff1ec6eec1db95e837` |
| multa36_renovacoes | 4 | `8854bb3bc295508d9fbb385fba48ef8933e36db733fb95a2ce2503cdf91378e2` |
| multa36_capacidades | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| multa36_coexistencia | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| multa36_fences | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |

Diferenças pg_class por manutenção, com valores antes/depois, estão em results36a.json/maintenance e autovacuum.diffs; são exclusivamente campos voláteis autorizados.

## fresh2

Checks: 30; negativos: 22; manutenção: 2×10 comandos. 26 linhas históricas em 11 tabelas comparadas por ID, zero alteradas.

Baseline preventiva não vazia: {"contractId":1001,"create35":1,"apply36":1,"receive36Partial":1,"originalVerifierValid":true,"thresholdsDefault":true}. Um criar35/apply36/receive36 parcial legítimo antes36a, ainda nos thresholds padrão, com verifier original válido. 8 provas anteriores em 7 tabelas permaneceram exatamente intactas até fim. Operações para observar autovacuum abaixo são adicionais a essa baseline.

Original ANALYZE em base dedicada metadata36a_old_analyze2: `{"database":"metadata36a_old_analyze2","diff":[{"relation":"multa36_capacidades","field":"reltuples","before":-1,"after":0}],"originalReject":{"code":"55000","message":"Metadata/ACL/controlguard36 desconhecido"},"hotfixReject":{"code":"55000","message":"Metadata/ACL/controlguard36 desconhecido"},"rolledBack":true,"reseal":false,"functionsMoneyManifestUnchanged":true,"catalogRestoredAfterRollback":false}`. A mudança reltuples -1→0 não foi revertida por rollback; por isso a base negativa jamais recebe36a e não contamina o teste preventivo.

Autovacuum REAL: antes `[{"relname":"multa36_capacidades","last_autovacuum":null,"autovacuum_count":0,"n_tup_ins":24,"n_tup_del":24,"n_dead_tup":0},{"relname":"multa36_coexistencia","last_autovacuum":null,"autovacuum_count":0,"n_tup_ins":0,"n_tup_del":0,"n_dead_tup":0}]`; depois `[{"relname":"multa36_capacidades","last_autovacuum":"2026-11-24 04:07:19.810388+00","autovacuum_count":2,"n_tup_ins":360,"n_tup_del":360,"n_dead_tup":128},{"relname":"multa36_coexistencia","last_autovacuum":"2026-11-24 04:07:19.811043+00","autovacuum_count":2,"n_tup_ins":8,"n_tup_del":8,"n_dead_tup":3}]`. Timestamp last_autovacuum não nulo e contador de capacidades36 aumenta. Não basta espera presumida.

Operações legítimas service_role: 8criar35, 8apply36, 4receive36parcial, 4renew36, 8receive36integral; 8 contratos quitados. Alocação total `{"pernas":16,"contratos":8,"principal":"800.00","juros":"120.00","multa":"60.00","mora":"0.32"}` (16pernas, principal800.00, juros120.00, multa60.00, mora0.32). São efeitos financeiros legítimos, não delta da manutenção; snapshot após operações e durante espera autovacuum idêntico. Capacidades/coexistência/fences resíduos zero.

| Tabela | Linhas finais | SHA256 snapshot |
|---|---:|---|
| users | 2 | `0ab11d2603e2e22bce5df41ffdb9a267eae37e2d22abf2531de7b5e5c476c629` |
| clientes | 2 | `0f0f45d1f5213c0bef58a5e91181400d91e03aa555ef5f0f005a08ff05acd54c` |
| contas_caixa | 5 | `ba2892a22c4f4a84d9ef408f8a7b450352aba2ca93b21cdb586cd13c1b58d195` |
| contratos | 10 | `f481a548990a1f1e615574b34c8c2c68082081bba0e68e84978a939c810c9e51` |
| parcelas | 15 | `45edce26cad176a87944b30f89be073036e383d200a1d57c39dba32277a5cf78` |
| transacoes_caixa | 28 | `3290a7e33eaf1e9cff86e8eba7a3c7990c124984012fe2be88d7cae35c30d5bf` |
| contrato_historico | 35 | `e032d32fd020c49198087e6fb4434fa7a0e6fa8df6082d2c45f839f6b2dc4759` |
| multimodal_operacoes | 9 | `2c714edc4c0fcf811aaf519225b0829725a88117ad27ce3980f31b616cb78769` |
| multimodal_pernas | 9 | `2dbd43400850cc063450ad10ef97d6153214988f68036bf818166a8bdb55c177` |
| multa36_operacoes | 26 | `5a83535eca0a354841ef3a18a4e9322607ce2217d3edeb5dd619829161f18295` |
| multa36_origens | 9 | `0ea6e74bc1ae49af2c55307b9dea3035f6052620163897ebde2f4a115b5beb89` |
| multa36_estados | 9 | `fad2b175558f6b6715518016e258ef7b5ec7668b8e548c4b1da708ee7dd0f0b6` |
| multa36_encargos | 9 | `caab348af5d31d66958bee9660696620e189cea6523cc80b9a3baf086798852c` |
| multa36_pernas | 17 | `d9cc5d79a59c8daa842dee4761a6e68fb0eca56be667b8f13b9451a6dc1a45fb` |
| multa36_renovacoes | 4 | `6bc05a830a653fd99d2e6bced852ada405d8d429b30cc4c6028b1f1c27ec082b` |
| multa36_capacidades | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| multa36_coexistencia | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| multa36_fences | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |

Diferenças pg_class por manutenção, com valores antes/depois, estão em results36a.json/maintenance e autovacuum.diffs; são exclusivamente campos voláteis autorizados.

## Matriz

- PASS STATIC único corpo metadata36 alterado, seis campos voláteis; SHA=df1abe0b096b3f993954f16b3c93a1cdfb0ddd36cb968158f39b05150eaeba8f
- PASS fresh1 original ANALYZE invalida selo e hotfix recusa sem instalar/reseal
- PASS fresh1 baseline preventiva com prova35/36 e ledger não vazios; originalverifier válido
- PASS fresh1 preflight-negative source-guard
- PASS fresh1 preflight-negative ACL-helper
- PASS fresh1 preflight-negative config-helper
- PASS fresh1 preflight-negative RLS-private
- PASS fresh1 preflight-negative trigger-off
- PASS fresh1 preflight-negative column-default
- PASS fresh1 preflight-negative CHECK-base
- PASS fresh1 preflight-negative FK-base
- PASS fresh1 preflight-negative index-base
- PASS fresh1 preflight-negative policy-private
- PASS fresh1 preflight-negative column-ACL
- PASS fresh1 install delta-only metadata + manifesto36; zero money/proof delta
- PASS fresh1 ACL/RLS36 service_role RPC only; anon/auth sem execute
- PASS fresh1 one-shot reapply 55000; zero snapshot delta
- PASS fresh1 fixed-negative source-metadata
- PASS fresh1 fixed-negative ACL-helper
- PASS fresh1 fixed-negative config-helper
- PASS fresh1 fixed-negative RLS-private
- PASS fresh1 fixed-negative trigger-off
- PASS fresh1 fixed-negative column-private
- PASS fresh1 fixed-negative CHECK-private
- PASS fresh1 fixed-negative FK-private
- PASS fresh1 fixed-negative index-PK-private
- PASS fresh1 fixed-negative reloptions-structural
- PASS fresh1 ANALYZE real todas10 tables36; verifier pass sem reseal
- PASS fresh1 VACUUM (FREEZE, ANALYZE) real todas10 tables36; verifier pass sem reseal
- PASS fresh1 operações legítimas35/apply36/receive36/renew36 geram mortes; autovacuum REAL; sem reseal
- PASS fresh1 final34/35/36 e ledger/provas históricos imutáveis
- PASS fresh2 original ANALYZE invalida selo e hotfix recusa sem instalar/reseal
- PASS fresh2 baseline preventiva com prova35/36 e ledger não vazios; originalverifier válido
- PASS fresh2 preflight-negative source-guard
- PASS fresh2 preflight-negative ACL-helper
- PASS fresh2 preflight-negative config-helper
- PASS fresh2 preflight-negative RLS-private
- PASS fresh2 preflight-negative trigger-off
- PASS fresh2 preflight-negative column-default
- PASS fresh2 preflight-negative CHECK-base
- PASS fresh2 preflight-negative FK-base
- PASS fresh2 preflight-negative index-base
- PASS fresh2 preflight-negative policy-private
- PASS fresh2 preflight-negative column-ACL
- PASS fresh2 install delta-only metadata + manifesto36; zero money/proof delta
- PASS fresh2 ACL/RLS36 service_role RPC only; anon/auth sem execute
- PASS fresh2 one-shot reapply 55000; zero snapshot delta
- PASS fresh2 fixed-negative source-metadata
- PASS fresh2 fixed-negative ACL-helper
- PASS fresh2 fixed-negative config-helper
- PASS fresh2 fixed-negative RLS-private
- PASS fresh2 fixed-negative trigger-off
- PASS fresh2 fixed-negative column-private
- PASS fresh2 fixed-negative CHECK-private
- PASS fresh2 fixed-negative FK-private
- PASS fresh2 fixed-negative index-PK-private
- PASS fresh2 fixed-negative reloptions-structural
- PASS fresh2 ANALYZE real todas10 tables36; verifier pass sem reseal
- PASS fresh2 VACUUM (FREEZE, ANALYZE) real todas10 tables36; verifier pass sem reseal
- PASS fresh2 operações legítimas35/apply36/receive36/renew36 geram mortes; autovacuum REAL; sem reseal
- PASS fresh2 final34/35/36 e ledger/provas históricos imutáveis

## Falhas e limites

Nenhuma falha final.

A primeira tentativa foi inválida por contaminação ANALYZE original/rollback na própria base preventiva. Seus logs são attempt1-*; não contam como negativos certificados nem falha SQL36a. Primeira falha de ambiente foi caminho do Node, corrigida apenas no runner novo.

Não extrapolar cobertura runtime: índices/CHECK/FK físicos de bases antigas são verificados pelo preflight36a, enquanto runtime cobre metadata36 e verificadores34/35. O negativo runtime índice privado remove PK/constraint+index; não prova cobertura geral de pg_index. N_dead_tup estimado pode permanecer >0 por novas operações posteriores ao último autovacuum; last_autovacuum e contador provam worker real, não necessariamente esvaziamento físico completo. Estatísticas e UUID/timestamps sintéticos podem variar entre execuções.

## Limpeza e artefatos

`{"stopExit":0,"status":3,"pidAbsent":true,"ownRoot":"/home/ubuntu/cobrapro/tests/postgres-multa-metadata36a/.pg17-IwWcjX","ownRootRemoved":true}`. STOP0/STATUS3/PIDausente; removidos só root/pgdata/socket próprios após parar. results36a.json registra evidências completas, runner36a.log/console36a.log e postgres36a.log registram execução; Vitest em vitest36a.log. SQL final deve continuar no SHA testado; qualquer alteração exige rerun.
