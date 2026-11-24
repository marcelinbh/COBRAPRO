# Hotfix preventivo36a — metadata estável PG17

SQL independente `drizzle/0036a_multa_metadata_estavel.sql`, SHA256 `df1abe0b096b3f993954f16b3c93a1cdfb0ddd36cb968158f39b05150eaeba8f`. O arquivo0036 instalado conserva SHA7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f. Builders antigos não são executados.

A única função antiga alterada é multa36_metadata: excluir da projeção pg_class somente relpages/reltuples/relallvisible/relallfrozen/relfrozenxid/relminmxid. Esses campos refletem ANALYZE/VACUUM/autovacuum, não ownership, ACL, RLS, constraints, colunas ou triggers. O restante do corpo é byte-preserving. Atualiza exclusivamente uma assinatura do manifesto36 de instalação; nenhum dinheiro, operação, prova, tenant ou histórico. Manifestos34/35 não são atualizados.

**Precondição deliberada:** verificador36 ORIGINAL válido antes, além de98 fontes exatas/ACL/owner/config/rowtypes/triggers/constraints/indexes conhecidos sob locks de aplicação. Não ressela manifesto inválido por catálogo desconhecido. Se o selo original já falhou55000, abortar e diagnosticar; não usar este hotfix como saneamento automático. Janela de DDL exige governança exclusiva, como predecessores.

Certificação local: duas freshDB preventivas e duas negativas exclusivas, PG17.11/socket0700/TCP desabilitado/autovacuum ON,61 checks/0 falhas e44 negativas de drift/reapply além de4 recusas oldANALYZE/hotfix. Baseline financeira sintética não vazia e provas anteriores preservadas. ANALYZE/VACUUM(FREEZE,ANALYZE) de todas10 tabelas36 e autovacuum REAL observado após operações legítimas service_role, sem reseal nem delta de dinheiro por manutenção. Resultado detalhado em RESULT36a.md. Teste Vitest não é opt-in; execução independente responsável1/1PASS14.29s em24/11/2026. Regressões36 originais direcionadas183PASS em3arquivos.

Comandos (desde a raiz do projeto):

```sh
node tests/postgres-multa-metadata36a/build.mjs --check
node tests/postgres-multa-metadata36a/runner.mjs
pnpm exec vitest run server/migrations/multaMetadata36a.postgres.test.ts
```

Os testes registram artefatos sintéticos locais; logs PostgreSQL/pgdata não devem integrar commits. Cleanup só remove cluster próprio apósSTOP/STATUS3/PIDausente. O teste negativo ANALYZE original usa base separada: rollback de ANALYZE não restaura reltuples nesse PG17.

Produção read-only24/11 às01h02:98/98 fontes sem drift, verifiers34/35/36PASS, quatro hashes financeiros integrais idênticos ao préDDL36/pós-smoke;12/1152/316/1235 registros e12/2/6 divergências históricas preservadas. Instalação36a ainda pendente na criação deste registro. Este hotfix é independente do candidato37 e não libera aporte, transferência, retirada genérica nem todos os módulos financeiros. Não mexe Kiwify/ofertas/Blacklist/WhatsApp/configuração de planos.
