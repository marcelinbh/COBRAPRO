# Convivência37 — resultado final local

**PASS / GO local restrito aos cenários L01–L05, H01, C01–C02 exercitados.** Sem decisão GO global, publish, instalação produtiva ou alteração financeira real. Rodada final terminou em24/11/2026 às01h22 BRT, exit0, duas fresh dedicadas e seleções/complementos originais em DBs próprias. Nenhuma assertion negativa foi descartada e nenhum oldguard/source SQL foi modificado.

## Comando e hashes

```sh
cd /home/ubuntu/cobrapro
COEXISTENCE_FINAL_SQL37_SHA=2acc5c0840e77a1131fa02d04f0b1faf85bbdb0430071b73477a276ded312334 node tests/postgres-caixa37/certification-coexistence.mjs > docs/logcoexistence-console.log 2>&1
```

SQL37 inicial/final/current: `2acc5c0840e77a1131fa02d04f0b1faf85bbdb0430071b73477a276ded312334`. SQL36: `7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f`. SQL36a: `df1abe0b096b3f993954f16b3c93a1cdfb0ddd36cb968158f39b05150eaeba8f`. Não foi executado certification-runtime.mjs nem script/runtimeflagged anterior.

Harness executado:
- `tests/postgres-caixa37/certification-coexistence.mjs`: `79fab89e29ded98cbf8fdd0abc0090d86f43dfb372b2bb39ebcdd846ae93adb0`
- `tests/postgres-caixa37/coexistence-originals.mjs`: `a1f989cfb017c233a37cbd6d24b81b41ea1c92a63bbe414a2b5637df0ae39c40`

Fontes originais intocadas, conferidas ao fim:
- `tests/postgres-legados/validate.mjs`: `82d5afac6c4d13c64b7f48328905f978498797ff2bfd5e095ee8312e534f8675`
- `tests/postgres-legados/prova.mjs`: `a6a045fc898fcdfa4e3510fbe5fd4cefe022d783f5e200a0c668c4c604d96d14`
- `server/migrations/multimodal.postgres.test.ts`: `a3e110c3bd9f69c450dba28bb98a37e8efd040707b12ea0e6aea4f20e4fdab6b`
- `server/migrations/multa.postgres.test.ts`: `8b455eb1b915b5bd49fd786d127cc1ee103416672797d014d34e5d11851903b3`

## Contagens exatas e locks

- Dedicadas:19PASS/fresh,38total; falhas0. Seleções/equivalentes originais:243PASS/fresh,486total;36omissões nominais total; erros0/falhas0. Capabilities são subassertions dentro das dedicadas, não se somam como testes independentes às38.
- Locks:32linhas OBSERVED (16/fresh),14TRYFAIL40001 (7/fresh), sete writers21/22/25/31/34/35/36 nos dois sentidos em cada fresh, e DML create/reparent. Locks lidos de pg_locks; espera/tryfail real, não sleeps como prova.
- Stress:32tentativas/fresh; fresh1 commits4/safe40001=28/aporteCents3/pernas5; fresh2 commits4/safe40001=28/aporteCents0/pernas8. Equações, saldo-base completo, ops/pernas e resíduos conferidos.
- Contagens financeiras dedicadas fresh1:ops127,legs207,ledger1269; fresh2:ops127,legs210,ledger1272. Diferença entre freshs provém dos winners reais do stress, não exige contagem idêntica.
- AutovacuumON e SHOW verificado; TCPoff, socket0700, PG17. VACUUM(FREEZE,ANALYZE) real nas tabelas36 com hash metadata36 preservado e verificadores34/35/36/37PASS. Isso não alega ter aguardado um worker autovacuum automático nesta subfrente.

## Suites, seleções e omissões

| Seleção | PASS fresh1/fresh2 | Omissões fresh1/fresh2 | Alcance |
|---|---:|---:|---|
| 34 | 34/34 | 7/7 | seleção integrada36a+37 |
| 35 | 23/23 | 3/3 | seleção integrada36a+37 |
| 36 | 13/13 | 1/1 | seleção integrada36a+37 |
| 34baseline | 80/80 | 0/0 | complemento baseline34; não integrado37 |
| 35setup | 79/79 | 1/1 | setup/0016/gates preservados baseline35 |
| 36setup | 9/9 | 1/1 | setup/preflight/reapply original36 baseline35→36; sem36a/37 |
| 35fault0 | 1/1 | 1/1 | equivalente dedicado com instrumento pré-seal; nunca reseal runtime |
| 35fault1 | 1/1 | 1/1 | equivalente dedicado com instrumento pré-seal; nunca reseal runtime |
| 35fault2 | 1/1 | 1/1 | equivalente dedicado com instrumento pré-seal; nunca reseal runtime |
| 35fault3 | 1/1 | 1/1 | equivalente dedicado com instrumento pré-seal; nunca reseal runtime |
| 35fault4 | 1/1 | 1/1 | equivalente dedicado com instrumento pré-seal; nunca reseal runtime |

As36omissões são entradas nominais de escopo (18/fresh), não36negativas descartadas. Integrada34 omite seis grupos originais e setup geral; baseline34 executa validate preservado mais proof34 projetada (80PASS/fresh). Proof34 negativa usa universo CTAS de leitura/corpo versionado com somente schema literal alterado; não é suite integral sobre dados financeiros37. Integrada35 omite dois grupos instrumentados e setup geral; seus complementos35setup(79PASS/fresh), faults0..3(4PASS/fresh) e legacyfault4(1PASS/fresh) estão separados, com instrumentos antes do selo inicial real; não há reseal runtime. Integrada36 omite setup/initdb/preflight/reapply/catálogo baseline:13runtimePASS/fresh sobre36a+37.

**Complemento36setup:** sete drifts originais(source guard/overload/ACL helper/RLS capability/policy/trigger-off/default), instalação36 sem mutação financeira e one-shot reapply:9PASS/fresh, baseline35→36 pré37. Initdb/roles/fixtures/dependências fornecidos pelo instalador autorizado;36a/37 ausentes nesta baseline. Instalação positiva35→36→36a→37 nas fresh integradas não é equivalente presumido aos sete drifts. D01/D02 do runner37 são do pai, não contados aqui. Não se rotula nenhum conjunto como full36+37.

## L05: capacidades, pontes reais e limites

Por fresh: bridges35/36=15PASS cada(14DML recusados em camada Ponte37/Ponte36 +1FK); payload-value=1análise estática/gap cada, sem DML autorizado. Consumidores originais=42PASS (consumer35=17,consumer36=22,ACL=3resumos). Cada resumoACL contém10recusas42501:4DML×2tabelas+2helpers;30recusas/fresh,60total.

Gaps mantidos:13/fresh,26total =20aceitações isoladas manuais(7consumer35+3consumer36 por fresh),2limitações sessão35(uma/fresh),4análises estáticas de binding payload nas pontes(duas/fresh). Consumer35 aceita manualmente operação concluída/owner/contrato/ação/hash/payload/prova não consultados;36 isolado não consulta hash/payload/prova. Consumer35 peer não executado; pid distinto exercitado. Consumer36 peer real executado. Nenhum desses itens é contado como negativa que passou.

**Classe1:** nenhum bug financeiro/cooperativo37 alcançável por RPC/service_role normal demonstrado nesta rodada. RPCs cooperativas reais, ACL, posterior inteiro, hash/pendência, snapshots/selo esperado×real, atomicidade e zero resíduos passaram nos cenários. **Classe2:** omissões nominais/setup substituído e projeções/shadow limitam a alegação de suite original completa; baseline36 complementa seus nove checks pré37, não runtime37. **Classe3:** superusuário de teste emite capacidade pendente na própria sessão fora daRPC; aceitação shadow ou consumo isolado sem commit financeiro não prova exploit anon/authenticated/service_role nem emissão cap+proof inválidos por issuer congelado. Emissores privados35/36 montam requests/hashes/rowtypes e selos esperados; pontes autenticam witness/linha e o selo final compara físico ao calculado. CONTRACT37 não pede autenticação universal isolada de todos os componentes nos consumidores antigos.

Mapeamento detalhado às linhas congeladas CONTRACT §8/PLAN L05, emissores35/36→ponte→consumo→selo/ACL: `docs/logcoexistence-L05-SCOPE.md`. Resultados atuais conservam todos os GAP_NO_GO históricos com a atribuição acima; não representam novos requisitos nem constatação de dinheiro corrompido.

## Tentativas preservadas e cleanup

Tentativa01(6cc): fonte37 sintaticamente inválida,42601,nenhum cenário executado; pai corrigiu sua fonte e autorizou2acc. Tentativa02(2acc): dedicadas/seleçõesPASS,10falhas de adaptação35 por dollar-quoting. Tentativa03(2acc): dollar-quoting corrigido,10falhas de adaptação35 por search_path. Corrigidos somente callback de String.replace +assertion de preservação literal e contexto public do instrumento/restauração do search_path antes do selo, mantendo SQL original/assertions. Rodada final completa2acc exit0. Arquivos anteriores em `docs/logcoexistence-attempt01/`, `attempt02/`, `attempt03/`; artefatos brutos finais em `docs/logcoexistence-final-raw/`.

Cleanup final próprio: `/tmp/coexistence-caixa37-pg17-qfK9l0/data`, STOP0 STATUS3 PID_ABSENT=true PGDATA_REMOVED=true. Cluster parado e PGDATA removido; somente diretório/socket/log temporários sem dados permanecem. Todas tentativas possuem cleanup equivalente em seus logs. Sem rede/browser/prod/Git, builders antigos, SQL/helper/backend/client/shared/migrations ou oldtestfiles alterados.

A síntese corrigiu apenas a nota automática nominal36 desatualizada, derivando-a da baseline36setup executada, e explicitou que a decisão global é do responsável. JSON/log brutos preservados; nenhum rerun foi feito para mudar nome/relatório.
