# Caixa37 — aporte e transferência atômicos

Implementação dedicada com cinco RPCs backend, owner exclusivamente da sessão e UI com preview, UUID/request duráveis e recuperação sem reexecução financeira. Aporte adiciona uma entrada real; transferência grava saída e entrada iguais numa transação. Saldo-base/histórico não são reescritos e não se cria writer genérico como fallback.

SQL alvo congelado: `drizzle/0037_rpc_aporte_transferencia_caixa.sql`, SHA-256 `2acc5c0840e77a1131fa02d04f0b1faf85bbdb0430071b73477a276ded312334`,271244bytes. Baseline36a fonte conhecida independente;36 original frozen. São exatamente seis extensões byte-preserving e31 funções novas;98 fontes predecessoras,129 funções esperadas após instalação. O comentário de geração no SQL não é reescrito para mudar status: consulte RESULT.md.

## Estado em 24/11/2026

GO local restrito ao contrato37 exercitado, com base em duas freshPG17, runtime56 grupos/zero falhas e convivência38 dedicadas/486 seleções-equivalentes originais/zero falhas. A decisão,26 gaps shadow/36 omissões nominais e a distinção entre regressões integradas e setups baselines estão em RESULT.md. Não são suítes antigas full no schema37, proteção universal dos consumidores antigos isolados, teste financeiro produtivo ou liberação100% da plataforma. NovaConta segue cadastro legado separado. Kiwify/ofertas/planos/Blacklist/configuraçõesWhatsApp não fazem parte do lote.

Gate completo final, checkpoint37, instalação37, push/deploy e smoke oficial ainda precisam de registro factual posterior.36a já instalado/deployLive/Healthy; nenhum dado financeiro foi reparado.

## Execução local sintética

```sh
cd /home/ubuntu/cobrapro
node tests/postgres-caixa37/build.mjs --check
node tests/postgres-caixa37/validate.mjs
node tests/postgres-caixa37/runner.mjs
node tests/postgres-caixa37/certification-runtime.mjs
COEXISTENCE_FINAL_SQL37_SHA=2acc5c0840e77a1131fa02d04f0b1faf85bbdb0430071b73477a276ded312334 node tests/postgres-caixa37/certification-coexistence.mjs
pnpm test
pnpm check
pnpm build
git diff --check
```

PG17 local descartável, TCP desligado, socket0700, cleanup apenas do próprio cluster. Runtime/coex são provas financeiras extras, não substituídas pelo gate Vitest. Envelopes RPC versionados são sintéticos e gerados do SQL exato. Logs/JSON brutos/tentativas permanecem privados fora do checkpoint; não são migrações oficiais.

Produção exige baseline conhecida36a/selos válidos, snapshot financeiro e histórico read-only, payload apply_migration mecanicamente idêntico ao SQL congelado, postsource129/selos34–37, ACL/RLS/zero resíduos e comparação de snapshots sem saneamento. Depois, push normal fast-forward, confirmação do commit no deploy e bundle oficial, smoke em cobrapro.online somente leitura/preview. Não testar mutação financeira real por conveniência.
## Gate final confirmado

Em24/11/2026 às01h29:55BRT:3688 testes PASS/11SKIP,165 arquivos PASS/3SKIP; build37 --check, validate37, TypeScript, build e diff aprovados. SQL2acc e código/harness não alterados após essa execução; documentação e formato final conferidos no índice. Warnings de chunk acima600kB são conhecidos, não falha de build. Instalação/publicação37 continuam sujeitas aos gates produtivos descritos acima.
## Instalação produtiva37 — 24/11/2026

Checkpoint certificado12ec76b1. apply_migration do payload mecanicamente idêntico ao SQL271244bytes/SHA2acc concluiu success às01h36:11BRT. Preflight imediato01h33:98/98 fontes36a/zeroDrift/selos34–36PASS/nenhum objeto37. Pós-instalação01h36:129/129 fontes/zeroDrift/owner-schema0/selos34–37PASS;82/82 tabelasRLS/CRUD anon-auth0; sete tabelas37 privadas/leaks0,31 funções37/26helpers(serviceEXEC0)/cincoRPCservice/anon-authEXEC0. Operações/pernas/pins/fences/caps/coex37 e resíduos36 permaneceram zero; manifesto37 uma row.

Snapshot read-only pré01h35:56→pós01h36:25 comparou mecanicamente hashes e contagens integrais de45 tabelas históricas/financeiras, todos idênticos. Assinaturas dos três manifestos34/35/36 legitimamente re-selados pela instalação são excluídas desse hash, somenteID/versão comparados; novas fontes/selos conferidos separadamente. parcelas_renovacoes era ausente em produção antes do lote e permaneceu ausente; não foi criada nem anunciada como tabela hashada. A primeira consulta extra falhou42P01 por essa ausência e foi preservada/ajustada somente no instrumento de snapshot, sem alterar SQL37. Os quatro financeiros originais e divergências12/2/6 também permaneceram integralmente iguais. Nenhum DML financeiro/saneamento, operação de teste ou mensagem produtiva.

Push/deploy e smoke oficial37 ainda pendentes deste registro. SQL e código/harness permanecem idênticos ao checkpoint testado; complemento exclusivamente documental.
