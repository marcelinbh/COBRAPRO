# Caixa37 — consolidação local em 24/11/2026

**GO local para o contrato de aporte/transferência37 exercitado. Instalação e deploy37 ainda pendentes neste registro. Não é liberação100% da plataforma nem saneamento do histórico.** Decisão do responsável após revisão dos resultados base, runtime, convivência e adapters/UI; nenhuma falha financeira37 alcançável pelos fluxos autorizados permaneceu nos cenários executados.

SQL37 exato: `2acc5c0840e77a1131fa02d04f0b1faf85bbdb0430071b73477a276ded312334`,271244 bytes. SQL36 frozen `7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f`;36a `df1abe0b096b3f993954f16b3c93a1cdfb0ddd36cb968158f39b05150eaeba8f`. O comentário de geração “NÃO CERTIFICADO” no SQL é preservado para não modificar o artefato já testado; estado de liberação é registrado aqui, não por reescrever bytes congelados.

## Resultado e fronteira

Aporte: uma entrada de dinheiro efetivamente recebido. Transferência: uma saída e uma entrada iguais, entre duas contas distintas da empresa autenticada, no mesmo commit. Saldo-base/histórico não são alterados; saldo efetivo vem do livro físico inteiro. Transferência pode produzir saldo negativo com preview e confirmação explícita. Não há retirada genérica, cancelamento/estorno37 ou correção automática de divergências. NovaConta é fluxo cadastral preexistente separado, não certificado como operação37.

Novas RPCs somente service_role; helpers/tabelas privados. SQL usa NUMERIC, adapters/UI strings decimais/BigInt, owner da sessão, request/UUID duráveis e recovery sem retry financeiro/fallback. Cotação inclui contas inativas e reverse-links; livro estruturalmente inválido da empresa recusa operação sem esconder contaminação. Este gate de integridade não é remoção de todos os bloqueios históricos.

## Provas executadas

| Frente | Evidência efetivamente executada | Limite |
|---|---|---|
| Base37 | Duas fresh PG17, positivos aporte/transferência/negativo/grandes acumulados, ownership inteiro, onze drifts relacionais, seis extensões byte-preserving, originais31/35/36, corridas/recovery/overflow e PK rollback | stdout final chama esta frente de parcial; não substitui runtime/coexistência |
| Runtime37 |56 grupos PASS em duas fresh, zero achados; falhas antes/depois de cada perna/proof/seal, virada BRT pós-lock, NEW/extraefeito, capabilities37, schemas/provas/pin/fence, restart real e replay/recovery histórico | Instrumentos/corrupções privilegiadas exclusivamente sintéticos; não prometem proteção contra superuser reescrevendo toda a história |
| Correção S03 | Todos20 falseconfirmed anteriores rejeitados23514, além de missing_pernas e quote internamente coerente com saldo físico falso; recomposição histórica de quote/resultado/hash e pin causal | Baseline79dd preservada como diagnóstico anterior; não é candidato final |
| Convivência |38 PASS dedicadas,486 PASS seleções/equivalentes originais, zero erros/falhas;32 locks observados,14 tryfail40001; sete writers21/22/25/31/34/35/36 em ambos sentidos;create/reparent e stress32/fresh |36 omissões nominais de alcance, não36 negativas ignoradas; todas as seleções fullSuite=false |
| Setup original36 |9 PASS/fresh: sete drifts, instalação sem mutação financeira e reapply; trecho original executado sobre baseline35→36 | Pré37, sem36a/37; não é setup ou suíte full36+37 |
| Integração | Cinco envelopes reais SQL sintéticos com SHA2acc via SDK/shared/backend,23 testes; página real52 testes; schemas, recuperação, authgeneration A→B→A e readers independentes | Sem dinheiro/mensagem produtivos; dados sintéticos |
| Gate completo2acc |3688 PASS/11SKIP,165 arquivos PASS/3SKIP, SQLvalidate/TypeScript/build/diff em24/11 às01h08BRT | Gate final repetido após consolidação documental e congelamento da fronteira; resultado posterior deve ser registrado antes do publish |

## Omissões e garantias não atribuídas

O contrato P0 de37 foi conferido pela combinação das três frentes, não pela alegação de que todas as suítes antigas inteiras rodaram no schema37. As seleções financeiras originais34/35/36 foram integradas; setup/preflight, instrumentos pré-seal e provas CTAS/shadow tiveram complementos em baselines distintas, com os limites nominais preservados. A cobertura de erro após escrita/extraefeito37 é runtime dedicado, não renomeação dos testes antigos omitidos. A decisão local não amplia a semântica dos consumidores antigos nem seus contratos.

L05 conserva26 gaps de alcance:20 aceitações manuais isoladas de capacidades emitidas por superuser, duas limitações de sessão35 e quatro análises estáticas de payload em pontes. Nenhum foi contado como negativa PASS. As fronteiras reais recusaram witness inexistente/ambíguo/commitado/hash incorreto/crosscohort e rowtype adulterado. Emissores privados35/36 montam request/hash/rowtype e selos esperado×real; ACL impede anon/authenticated/service_role de fabricar capacidades. Aceitação shadow sem commit financeiro não demonstra exploração por RPC normal. Não se presume autenticação universal de request/prova no consumidor antigo isolado. Mapeamento em `docs/logcoexistence-L05-SCOPE.md`; contagens/limites em `docs/logcoexistence-FINAL.md`.

Manutenção:36a independente elimina estatísticas voláteis do selo36; autovacuum ON nas frentes, VACUUM(FREEZE,ANALYZE) real no coex. Worker autovacuum real foi provado na certificação36a, não atribuído indevidamente ao coex. Nenhum reseal runtime produtivo, dinheiro/histórico reparado, oldmigration regenerada, extensão extra ou fonte aprendida do catálogo.

## Comandos repetíveis

```sh
node tests/postgres-caixa37/build.mjs --check
node tests/postgres-caixa37/runner.mjs
node tests/postgres-caixa37/certification-runtime.mjs
COEXISTENCE_FINAL_SQL37_SHA=2acc5c0840e77a1131fa02d04f0b1faf85bbdb0430071b73477a276ded312334 node tests/postgres-caixa37/certification-coexistence.mjs
node tests/postgres-caixa37/validate.mjs
pnpm test
pnpm check
pnpm build
git diff --check
```

Executar sempre desde a raiz em PG17 local sintético, sem credenciais/rede produtiva. Logs/JSON brutos/tentativas/pgdata ficam privados e não integram o checkpoint de entrega. Qualquer mudança de SQL exige novas provas sobre seu SHA. Instalação produtiva exige preflight conhecido36a, snapshot, apply_migration exato, postflight129 fontes/RLS/ACL/zero resíduos, comparação de snapshots e deploy com smoke oficial somente leitura. Kiwify/ofertas/planos/Blacklist/WhatsApp não integram este lote.
## Gate final — 24/11/2026 às01h29:55BRT

Execução completa após harnesscoex final e consolidação:3688PASS/11SKIP,165arquivosPASS/3SKIP,build37 --check/validate37/TypeScript/build/diffPASS. Exit0. SQL2acc preservado; alterações posteriores limitadas a documentação/whitespace de relatórios e stage do envelope sintético regenerado do mesmo SQL. Fonte app/harness/SQL não mudou. Preflight read-only01h26:98/98 fontes36a semDrift/owner-schema0, verifiers34/35/36 aprovados e nenhum objeto37. Snapshot12/1152/316/1235 com mesmos quatro hashes e divergências12/2/6 preservadas. Estes são pré-instalação37, não resultado produtivo37.
