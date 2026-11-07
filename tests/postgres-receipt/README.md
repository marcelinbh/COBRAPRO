# Regressões PostgreSQL de recebimento

Execute somente em ambiente de desenvolvimento descartável, com PostgreSQL e `postgresql-contrib` instalados, como usuário não root:

```bash
bash tests/postgres-receipt/run.sh
node node_modules/vitest/vitest.mjs run server/migrations/recebimentoParcelaRpc.test.ts
```

O runner cria um diretório único `/tmp/cobrapro-pg-test-*`, inicia PostgreSQL **somente em socket Unix** (`listen_addresses=''`), limpa o ambiente de cada subprocesso e não carrega `.env`. Não recebe URL de banco, não conecta à rede, não usa Supabase nem dados reais. Não remove cluster existente. Ao terminar, inclusive em falha, o trap encerra seu próprio cluster; evidências ficam no diretório informado, separadas em `legacy` e `prod`.

## Matriz de schemas e cobertura

O banco `rpc_validation` mantém o fixture legado original (`fixture.sql`), enums nas colunas, datas TIMESTAMPTZ e histórico TEXT. Executa a pré-auditoria antes da instalação, as migrations reais 0013 e 0015 duas vezes, os **17 grupos originais** e o preflight final.

O banco independente `rpc_validation_prod` usa `fixture-prod.sql`, sintético e baseado no catálogo informado pela auditoria READ ONLY. Reproduz colunas VARCHAR com os CHECKs de status produtivos, datas DATE, principal `valor` obrigatório com `valor_original` nullable, `numero` obrigatório, `numero_parcela`/tenant nullable, contadores `numero_parcelas` nullable/`num_parcelas` obrigatório, histórico com `user_id TEXT` e `valor_novo NUMERIC`, UUIDs financeiros sem default, `pgcrypto 1.3` instalado em `extensions` e ausência inicial das colunas `transacoes_caixa.cliente_id`/`operacao_financeira_id`. Não aplica 0013 nesse perfil para não esconder a nullabilidade produtiva. Executa somente 0015 duas vezes.

O perfil produtivo executa os mesmos 17 grupos e **6 grupos adicionais**: catálogo/ACL/extensão/histórico, contrato e parcela `atrasado` sem quitação prematura, estados `pago`/cancelados/renegociado bloqueados, links nullable sem inferência, fallback de `valor_original` para `valor` sem backfill e preservação DATE em timezones extremos UTC+14/UTC−12.

A cobertura comum inclui recebimento integral/parcial, descontos e juros/multa preservados entre baixas parciais, replay de chave, payload conflitante, isolamento empresa/cliente/Caixa, conta inativa, ACL `service_role` vs `anon/authenticated`, calendário civil de Brasília, rollback após falha injetada no lançamento, referências compostas e quatro cenários de concorrência com espera real por lock.

Antes da instalação produtiva, `validate-preflight.py` injeta **16 divergências sintéticas**, executa o arquivo 0015 **sem `psql -1`** e comprova schema/constraints/índices/funções idênticos antes e depois da falha. Isso prova que os bloqueios de chaves/links, estados, valores, Caixa, operações e configurações ocorrem no primeiro DO, antes de qualquer DDL. Cada cenário é limpo apenas no fixture descartável.

## Bloqueadores e limites

O relatório `reports/preflight-rpcs-financeiras.sql` usa `to_jsonb` para inspecionar `cliente_id` opcional antes de 0015, sem criar coluna artificial. O runner exige execução sem erro antes e depois do DDL nos dois fixtures: nenhuma falha de schema é tolerada. A pré-auditoria própria de 0015 também usa `to_jsonb` nas colunas aditivas e é testada independentemente.

0015 adiciona `cliente_id INTEGER` nullable sem backfill e grava o cliente validado apenas nos novos recebimentos. Um recebimento histórico sem `cliente_id` bloqueia a instalação, mesmo se houver candidato aparente: qualquer inferência só pode ser proposta para aprovação separada, nunca executada automaticamente. A migration não renomeia estados nem saneia dados antigos.

**Proposta para revisão futura, não executada:** considerar candidato somente um lançamento de `entrada`/`pagamento_parcela` cujo `parcela_id` identifique uma parcela existente, cujo `contrato_id` coincida com o contrato dessa parcela e cujo `user_id` não nulo seja igual ao de parcela, contrato, cliente e conta de Caixa. O `cliente_id` não nulo da parcela deve coincidir com o do contrato e identificar cliente existente nessa mesma empresa. Exigir exatamente um candidato, chave lógica de parcela não nula/não duplicada e ausência de divergência financeira relevante; divergências ou relações ausentes não podem ser inferidas. Primeiro produzir lista somente leitura de IDs/candidato/motivos de bloqueio para aprovação específica. Não preencher tenant, principal, número, status ou vínculos divergentes por conveniência. Nenhuma implementação de backfill integra este trabalho.

Os fixtures não são exportações nem verificação completa da base produtiva. Não cobrem RLS particulares, transporte PostgREST, UI, flag de ativação ou todas as tabelas CobraPro. Não há triggers de negócio persistentes; a trigger de falha só existe durante o teste de rollback. As invariantes validam o livro-caixa, não uma atualização externa da coluna `contas_caixa.saldo`. Aprovação local não substitui preflight da base correta e **não autoriza aplicar a migration nem liberar a flag financeira de produção**.
