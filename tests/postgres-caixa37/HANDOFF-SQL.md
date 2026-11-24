# Handoff SQL/harness local37 — implementação parcial, não GO P0

## Escopo e artefatos

Somente arquivos novos37 foram escritos por esta frente: `drizzle/0037_rpc_aporte_transferencia_caixa.sql`; `tests/postgres-caixa37/{build.mjs,template.sql,fixture.sql,runner.mjs,preflight.mjs,relational-preflight.mjs,validate.mjs}`; `server/migrations/caixa37.postgres.test.ts`; logs/evidências sintéticos e este handoff. CONTRACT/PLAN/RESULT37 e todos os arquivos financeiros predecessores não foram editados por esta frente. Sem Git/checkpoint, browser, Supabase, rede produtiva, flags ou operação financeira real.

**SHA-256 SQL37 final:** `711301010195d8bd4ed84948ab940308dde92d433ac118ceb9c4c52c59d23236`.

**SHA-256 SQL36 preservado:** `7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f`.

Builder37 lê somente fontes versionadas pinadas e NÃO executa builders antigos. Inventário de98 assinaturas predecessoras. O validador confirmou exatamente as seis extensões autorizadas, assinaturas/configs preservadas e ramos antigos byte a byte, exceto a exceção estrita prevista em legados_validar. Não surgiu necessidade de sétima extensão.

Implementadas as cinco RPCs com assinaturas congeladas/JSONB, NUMERIC sem typmod agregado, capabilities per-trigger/per-leg one-shot, prova privada pending-xmin, pins, imutabilidade, constraint-check diferido, recuperação/barreira/fence permanente, whole-owner incluindo inativos/reverse-links, locks financeiros try/NOWAIT failclosed, dia SQL BRT pós-lock e recheck pré-seal. Somente metadata34/35/36 é resealed durante instalação após pre/postflight. Runtime verifica, não reseal.

Correção de isolamento pedida pelo pai: `caixa37_anteriores(uid integer)` é helper NOVO e filtra snapshots predecessores por owner/vínculos físicos relevantes. Foi observada A37 bloqueada no FK users após capturar predecessor, commit legítimo B35 antes da comparação A, e confirmação A sem falsa23514. Não bloqueia users no protocolo financeiro; a espera usada no teste é FK físico observado.

## Execução real

Comandos executados em `/home/ubuntu/cobrapro`:

```sh
node tests/postgres-caixa37/build.mjs --check
node tests/postgres-caixa37/validate.mjs
node tests/postgres-caixa37/runner.mjs
pnpm exec vitest run server/migrations/caixa37.postgres.test.ts
```

Vitest final:1 arquivo/1 teste passed em47.37s; cada execução do teste cria dois bancos novos PG17 no mesmo cluster privado descartável. Socket0700, TCP desabilitado, roles/linhas sintéticos, nenhum secret. Cluster final `/tmp/caixa37-pg17-qiCDZ6`; todos os pgdata desta frente foram removidos apenas depois de PG17 encerrado e ausência de postmaster.pid, logs preservados. Nenhum processo37 permanece ativo.

`latest-test.log` contém92 linhas PASS de assertions/casos agrupados e10 observações de locks nos dois bancos, NÃO92 testes independentes P0 completos. `vitest.log` e `run-console.log` preservam execução. Catálogo antes sintético está em `catalog-before.json` (evidência, nunca fonte usada pelo build/preflight).

Contagens finais idênticas em ambos os bancos:15 operações37,20 pernas37,3 fences37,1034 ledger físico; capabilities e witnesses37 zero.

| Banco | Hash financeiro antes37 | Hash financeiro final |
|---|---|---|
|fresh1|`30418fbd396ce37533d18a9b2b4eb69a3bc37c4e6a37113a332c3ddd04469e23`|`0ce16ae4c3897064ec03261ef1a7c40904e225b286bc1b87c7b5ae98fd19d34b`|
|fresh2|`d7df4078d767e9a7d2c0e6a161e39bd0cf36447e5400f623b6de7d7e0397a2ab`|`eb3e982e22bc75f8068da597986af8d6dde5ee2b4af2f7572fb55cffbb5d0061`|

Hashes entre freshDB não são iguais porque fixture/defaults/UUID/clock são reais. Cada instalação37 compara próprio hash antes/depois e exigiu dinheiro zero; mutações subsequentes legítimas alteram o hash final intencionalmente. Assertions negativas comparam snapshots financeiros e zero resíduos; lacunas de sequência por rollback são permitidas.

## Matriz efetivamente executada

| Família | Prova executada | Limite |
|---|---|---|
|F01/F02/F03|Aporte0.01/máximo, base negativa, transferência/inversa IDs opostos, saldo negativo, base/updatedAt intocados; alvo inativo recusa e histórico inativo entra no total|Não todas combinações físicas possíveis|
|F04|Dinheiro zero/sinal/vírgula/exponent/3casas/leadingzero/overflow/NaN; JSON extra/number/desc/hash/date/ID inválidos|Casting inválido na chamada tipada continua SQLSTATE nativo quando anterior à função|
|F05/F06|Targets alheios, ledger userB/null em terceira conta inativaA, reverse userA/contaB; gate whole-owner|OwnerB independente demonstrado quando não integra a contaminação via reverse userB|
|F07/H01 parcial|1001 linhas históricas reais, entradas `10009999999999989.99`, saldo `9999999999999990.00`, total `10000000000000002.34`, aporte centavo sem overflow/limite agregado|Cancelamentos/duplicidades suspeitas não têm caso dedicado completo|
|Q01|Nome de terceira conta inativa muda hash global e mutation antiga40001|Outros phantoms/reparenting não exaustivos|
|Q02 parcial|UTC/BRT/Tóquio mesma cotação/dia; código clock pós-lock/recheck préseal|Virada real BRT durante espera/escrita NÃO induzida|
|I01/I02|Replay igual, divergente valor/ação23505; append legítimo e replay/recovery históricos; concorrência de mesmo UUID observada|Durabilidade via restart do cluster não testada|
|R02/R03/R04|Execução×recovery/replay/recovery×recovery/fence×lateexec com waiter real advisory; fence permanente; cotação1900/hash expirado; alvo inativo histórico|Timeout/transporte/envelope inválido é da integraçãoTS, não emulado aqui|
|C01|Duas transfers opostas simultâneas: exatamente uma confirma e outra40001 segura|Sem stress de muitos writers|
|C02 parcial|Trylocks conta/owner/row contention; cadastro update/create aborta40001; isolamento A37/B35 após snapshot observado|Não todas as corridas reais37×21/22/25/31/34/35/36 individuais|
|X01 parcial REAL|Sequência integer máxima e PK collision causam falha na segunda perna após primeira inserida; rollback total e retry mesmoUUID sem duplicar|Fault pós-prova/selagem/virada não coberto|
|D02 fault-source|Troca transacional de fonte de mutation privada em6 pontos, SEM reseal; guards intactos recusam drift antes money|Não contar isso como fault pós-perna ou adulterador NEW|
|S01/S02 parcial|anon/authenticated recusados, service_role cincoRPCs only; helpers/tabelas37 sem GRANT/RLS; manual/GUC/category fake, ledgerUPDATE/DELETE/base recusados|Capabilities cross-session/wrongguard/wrongleg/doubleconsume não têm matriz exaustiva|
|S03|Request/perna/pin/fence imutáveis; tentativa commit de operação pending23514|Tamper superuser contornando guard para testar replay corrupto não efetuado|
|D01|Source/ACL/overload/RLS/trigger/rowtype/config/homonym/helperextra/triggerextra/role/schema/CHECK/FK/index drift recusa55000; reapply55000; install sem money|Inventário físico relacional25+CHECK31 reforçado; constraints/indexes de contratos/parcelas/clientes/koletores ainda não possuem comparação própria completa fora de selos antigos|
|D02|Runtime ACL/config/trigger drift recusa sem reseal; fonte instrumentada bloqueada|Variantes adicionais não exaustivas|
|L01|Conta35+36 recebe37; proof/snapshots predecessores idênticos antes/depois; criação/recebimento35 e multa/recebimento36 depoispin|Renovação35/36 em ambos sentidos não caso dedicado|
|L02|Criação21/recebimento22/despesa25 pagar/estornar depoispin37|Despesa25 antespin não dedicada|
|L03|Conta legado34 elegível recebe aporte37, cotação/recebimento34/replay funcionam pela exceção privada37|Transfer perna37 na conta34 e avulso antigo negativo dedicado ainda pendentes|
|L04|Teste DEDICADO renovação31 depois37 em conta protegida, RPC original/defaults físicos aceitos|31 antespin37 não dedicado|
|L05|Bridge usa witness privado exato35/31/36/25/34/21/22, não role/source/GUC|Negativas witness inexistente/ambíguo/commitado e cohort cruzado ainda pendentes|

## Envelopes para integração do pai

`synthetic-rpc-envelopes.json` guarda cinco casos COMPLETOS produzidos pelo SQL final, com `syntheticOnly=true`, SHA37, userId sintético, UUID, Request37, cotação, resultado e recuperação confirmed: aporte0.01, aporte máximo, transfer8→7 e7→8. Quinto caso request expirado1900/hash antigo com recuperação not_executed. Todos os money em strings; perna ledger IDs strings integer. O primeiro transfer demonstra saldo origem negativo. Nenhuma PII real/credential.

## Conclusão e continuação

**Não certificado GO P0 completo e não pronto para publicação produtiva.** O núcleo está implementado e a rodada parcial é repetível/verde, mas não satisfaz toda a matriz congelada. Não foram executadas as suítes originais completas34/35/36 sobre schema37 (somente os verificadores e positivos dedicados acima). Não remover segurança para completar matriz. Próximos passos locais: faults sem reseal pós-prova/selagem, adulteradorNEW/extra effects, virada BRT, capabilities adversariais, remaining DDL preflight físico, convivência inversa/stress/corridas específicas e suítes predecessoras intactas. Pai decide continuação/revisão; este handoff não recomenda liberar financeiro.
