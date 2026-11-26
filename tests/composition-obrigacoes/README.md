# Obrigações51 — provas locais de composição

A migração `drizzle/0051_composicao_obrigacoes.sql` é uma instalação única com predecessores fixados e validação de sucessores antes dos selos de instalação. Nunca reaplicar migrações anteriores para recuperar uma operação.

O teste `server/migrations/obrigacoes51.postgres.test.ts` inicia PostgreSQL17 com banco temporário fora do repositório, socket0700, sem TCP, papel NOSUPERUSER/NOBYPASSRLS e encerramento comprovado. As fontes predecessoras são comparadas byte a byte com `predecessor-sources.json`. Não usa `.env` nem banco de produção. Execute em namespace sem rede e com dependências somente leitura.

O conjunto cobre31 verificações SQL, incluindo recusa de DDL divergente, instalação sem mudança financeira, operações atômicas, UUID/recovery/fence, concorrência e rollback, parcelas pagas/parciais/abertas,512parcelas, cadeias43/47, dono e vínculos completos, máximo monetário textual NUMERIC15 somente para leitura. Propostas de novos writers continuam NUMERIC12 e1..60. Cheques permanecem fora das novas operações51.

Os testes Vitest `server/obrigacoes51Rpc.test.ts`, `server/obrigacoes51Statefix.test.ts` e `server/obrigacoes51MoneyRead.test.ts` usam provas sintéticas reais do PostgreSQL em `proofs/`; não contêm dados de clientes. A presença de provas fixas não substitui a execução fresca do banco.

As provas originais admitiam status físico específico; o ramo puro SQL `registrada({status:renovada})=0` é testado, mas não equivale a E2E físico de parcela renovada na fixture congelada.
