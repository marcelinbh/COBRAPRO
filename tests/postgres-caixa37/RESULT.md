# Caixa37 — consolidação local em 24/11/2026

**Contrato37 certificado localmente, instalado e publicado; deploy exato Live/Healthy e smoke oficial somente leitura concluídos com os limites abaixo. Não é liberação100% da plataforma nem saneamento do histórico.** Decisão do responsável após revisão dos resultados base, runtime, convivência e adapters/UI; nenhuma falha financeira37 alcançável pelos fluxos autorizados permaneceu nos cenários locais executados. Não houve teste de movimentação financeira em produção.

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
## Instalação e postflight produtivos37 — 24/11/2026

SQL271244bytes/SHA2acc, payload comparado byte a byte e checkpoint12ec76b1 certificado antes: apply_migration success às01h36:11BRT. Preflight imediato01h33:98/98 fontes36a semDrift/owner-schema0/selos34–36PASS/nenhum objeto37. Postsource01h36:23:129/129 fontes esperadas semDrift/owner-schema0/verifiers34–37PASS,31 funções37 e16 relações37 (sete tabelas+índices/sequência, não16 tabelas).

Postflight01h36:24:aporte/transferência/recovery/disponíveltrue;82/82RLS/zero CRUD/columnCRUD anon-auth; sete tabelas37 privadas/leaks0;31 funções37/26helpers não executáveis por service_role/cincoRPCservice/anon-authEXEC0. Operações/pernas/pins/fences/caps/coex37 zero/manifesto37=1. Todos resíduos36 zero,10tabelas36 privadas/leaks0/helpers serviceEXEC0/oitoRPCservice.

Comparação mecânica pré01h35:56→pós01h36:25:45 pares de hashes e contagens históricos/financeiros e contexto de serialização idênticos. Manifestos34/35/36 comparados somente porID/versão e contagem: assinaturas mudam legitimamente por reseal de instalação, não runtime. A tabela extra parcelas_renovacoes nunca existia na produção atual: tentativa de snapshot adicional42P01 preservada, catálogo somente leitura confirmou única ausência entre46 nomes; instrumento ajustado para45 tabelas e prova de ausência antes/depois. Não foi instalada0008, não é drift aprendido da baseline37, não houve alteração de SQL/código para contornar teste. Quatro financeiros12/1152/316/1235 com hashes integrais idênticos/divergências12/2/6 preservadas. Nenhum saneamento ou financeiro/mensagem de teste. Push/deploy/smoke37 ainda pendentes deste registro.

## Publicação e smoke oficial — 24/11/2026, registro final37

Checkpoint de implementação12ec76b1; complemento de instalação exclusivamente3docs efe1df2a360e7207076611abd559851813b3f0e3, código/SQL/harness idênticos ao gate. Push normal fast-forward89f→efe1 confirmado no GitHub às01h39:14BRT. Deploy DigitalOcean f75e671c-f50d-446d-80ba-144398cd03a7 clonou efe1 completo; Success/Live/Healthy observado às01h46:40BRT, build2m42. Regressão pós-push às01h41:53:377PASS em8files, exit0, sem alteração tracked/SQL ou regeneraçãoPG.

Bundle oficial `/assets/index-DniMPhp2.js`,1289337bytes, SHA256 `0eea85bc4c2e0227fd32d96c04a9796b216525336c6348fbb5aa7aec00cba60b`: resposta fresh01h46 HTTP200 application/javascript comparada byte a byte com o build certificado. Uma resposta anterior01h43 teve hash divergente32d6a943... e o corpo não foi salvo: ocorrência transitória/inconclusiva preservada, sem atribuir causa aHTML/CDN/instâncias nem alegar alteração de código. A conferência posterior exata não apaga essa limitação da primeira coleta.

Smoke em `https://cobrapro.online/caixa`01h47–01h53, sessão administrativa existente: modais Aportar e Transferir carregaram capability e metadados próprios independentes do leitor antigo. Única conta própria ativa disponível no seletor. A seleção inicial automatizada não persistiu no rerender; seleção por evento nativo de teclado persistiu e habilitou cotação. Não classificado como bug do app.

Leitor antigo de saldo/contas recusou integridade histórica. A cotação de aporte0.01 foi realmente solicitada e terminou na UI com “Cotação não comprovada. Nenhum envio autorizado.” GET autenticado da mesma procedure confirmou JSON PRECONDITION_FAILED/httpStatus412/pathcaixa.cotar37 e mensagem “Livro ou prova caixa37 não comprovados; nenhum saneamento/fallback será executado.” Não é quote positivo nem execução financeira aprovada. A causa não foi atribuída automaticamente à UltraCredi ou a qualquer anomalia global específica. Nenhum histórico foi saneado para fazer o smoke passar.

Transferência: ambos seletores continham somente a conta própria; origem=destino com valor0.01 manteve cotação e confirmação desabilitadas e aviso de contas distintas. Não foi criada outra conta para testar; quote entre duas contas e preview de saldo negativo NÃO executados emprodução, embora exercitados noPG17 sintético. Confirmar aporte/transferência nunca foi clicado. Recovery não chamado, pois pode gravar fence; nenhuma mensagem ou dinheiro de teste. Formulários foram fechados/abandonados sem envio.

Pós-smoke01h53:58–01h54:01:129/129 fontes esperadas/zeroDrift/owner-schema0/selos34–37PASS, postflight82/82RLS/ACL/capabilities idêntico ao pós-instalação. Zero operações/pernas/pins/fences/caps/coex37 e resíduos36. Comparação mecânica do JSON inteiro:45 hashes/contagens/contexto e ausência parcelas_renovacoes idênticos ao pré-instalação; quatro financeiros integrais e divergências12/2/6 idênticos. Não prova disponibilidade de toda conta histórica ou liberação100%.

Este complemento é somente documental e descreve o deploy efe1 efetivamente observado. Um commit documental posterior não é automaticamente declarado Live; sua publicação deve ser conferida externamente, sem alterar o SQL37 congelado.
