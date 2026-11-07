# CobraPro — pré-auditoria produtiva após reautorização Supabase

**Projeto verificado:** `oxvtmibrgjruldkouhhb`, organização `qlofkaegdcvpqjuunxsv`, Supabase PostgreSQL 17.6.1.084, `ACTIVE_HEALTHY`. Fonte: MCP `supabase/list_projects`, 6/11/2026 às 20h54 BRT. Consultas de inventário e contagens executadas exclusivamente nessa referência. Não foram lidas senhas, hashes, tokens de recuperação, e-mails nem documentos de clientes.

## Risco crítico de acesso direto — corrigido em produção

O catálogo confirmou privilégios SELECT/INSERT/UPDATE/DELETE para `anon` e `authenticated` nas tabelas da aplicação, várias sem RLS. Como o frontend utiliza tRPC e o cliente de banco do servidor utiliza exclusivamente `SUPABASE_SERVICE_ROLE_KEY`, o acesso direto por esses papéis não é necessário ao produto.

A migration `0018_conter_acesso_publico_tabelas.sql` foi testada duas vezes em PostgreSQL descartável, com prova de bloqueio de leitura/alteração pública mesmo diante de política RLS permissiva e continuidade de leitura/escrita por `service_role`. Foi aplicada pelo MCP `apply_migration` sob o nome `conter_acesso_publico_tabelas_backend_only` e retornou sucesso às 20h59 BRT. Ela não altera qualquer linha de negócio, senha, saldo ou política existente.

Verificação posterior do catálogo produtivo: **29 tabelas, 29 com RLS, zero acessíveis por anon, zero acessíveis por authenticated e 29 com acesso preservado para o backend service_role.** Site, healthcheck JSON e Evolution responderam HTTP 200 após a aplicação. O dashboard autenticado foi recarregado às 21h00 BRT e exibiu os mesmos valores e 17 contratos ativos do baseline anterior à mudança; a sessão permaneceu válida. HTTP 200 de liveness sozinho não prova banco.

Isto contém o acesso público direto, não invalida credenciais de serviço expostas em histórico. A rotação de `SUPABASE_SERVICE_ROLE_KEY`/`JWT_SECRET` continua pendente e deve preservar a configuração correta em todas as instâncias.

## Divergências históricas — somente leitura, ainda não saneadas

Consulta agregada no banco em 6/11 às 20h56 BRT:

| Verificação | Resultado |
|---|---:|
| Total de parcelas | 1.235 |
| Grupos de número de parcela duplicado | 0 |
| Parcelas com chave nula/vínculo proprietário incompleto | 6 |
| Parcelas com pagamento acumulado diferente do livro-caixa no mesmo tenant | 18 |
| Diferença líquida entre pagamento acumulado e Caixa correspondente | R$ 2.510,47 |
| Parcelas parciais com saldo residual inválido | 3 |
| Transações de Caixa com tenant diferente da conta vinculada | 12 |
| Assinaturas / pagamentos de assinatura | 0 / 0 |
| Operações financeiras pendentes ou sem resultado | 2 |
| Configurações duplicadas encontradas | 0 |

**A diferença de R$ 2.510,47 não comprova perda financeira e não deve virar crédito de ajuste.** Ela inclui registros de Caixa existentes com proprietário errado, além de divergências e legado. A leitura detalhada confirma 12 entradas ligadas a contas de outras empresas mas gravadas com `user_id=4683`; seis parcelas possuem user_id/cliente_id nulos apesar do contrato e cliente identificarem a empresa. Existem também divergências de valor que exigem análise própria (incluindo recebimento registrado de 500 versus 1.500 em Caixa). Nenhum desses registros foi alterado nesta pré-auditoria.

As migrations 0013/0015 e a ativação de recebimentos permanecem bloqueadas até saneamento aprovado e nova conferência. Nenhuma flag foi habilitada.

Uma consulta de projeção, ainda sem UPDATE, demonstrou que atribuir automaticamente todas as seis parcelas ao proprietário do contrato revelaria uma duplicidade latente: empresa `4682`, contrato `42`, parcela número `2` aparece duas vezes. Portanto nem mesmo a correção de tenant das seis parcelas deve ser feita em bloco sem classificação do legado. As 12 transações foram confrontadas com proprietários de conta, contrato e cliente; esses vínculos concordam entre si e divergem do user_id gravado. Nenhuma reatribuição foi executada.

As duas operações operacionais identificadas pertencem a `renovacao_juros` e estão em `falha`; não são renovações concluídas. O dashboard também exibe inadimplência superior a 100% e saldo em dia negativo, evidência de cálculo com denominadores distintos a revisar sem modificar saldos históricos.

## Drift de schema confirmado

O inventário real não equivale ao fixture PostgreSQL originalmente usado:

- `password_resets` utiliza **used**, não **usado**. Tem `token` único, `expires_at` timestamptz e `createdAt`.
- `users` utiliza `passwordHash` e `updatedAt`; não possui `session_version` antes da aplicação da 0016.
- `parcelas.status`, `contratos.status`, `transacoes_caixa.tipo/categoria` são **VARCHAR com CHECK**, embora enums homônimos existam no schema.
- O CHECK de contratos aceita **atrasado**, não **inadimplente**.
- `parcelas.data_pagamento` e `transacoes_caixa.data_transacao` são **DATE**, não timestamptz.
- `transacoes_caixa` não tem `cliente_id`, `operacao_financeira_id` nem `pagamento_assinatura_id` antes das migrations.
- `contrato_historico.user_id` é **TEXT**; `valor_novo` é **NUMERIC**.
- `pgcrypto` está no schema **extensions**. Funções que usam digest precisam de resolução segura compatível.
- `kiwify_webhooks` não existe no schema público. A 0017 não pode ser considerada aplicada nem o provisionamento Kiwify plenamente funcional.
- `blacklist` e `blacklist_fotos` também não aparecem no inventário público; o router atual referencia esses nomes. Os testes prévios de validação documental não provaram persistência real dessa funcionalidade.
- Nenhuma RPC de recebimento/reset ou trigger dessas migrations estava instalada no inventário inicial.

As correções locais específicas da 0015 e da 0016 foram integradas com fixtures sintéticos compatíveis com os tipos relevantes do catálogo real, sem renomear colunas produtivas. O relatório de preflight aceita a ausência inicial de `transacoes_caixa.cliente_id` via `to_jsonb`; o runner exige sucesso antes e depois do DDL nos dois perfis, sem tolerar erros de schema.

## Estrutura de reset instalada — ativação ainda separada

Após preflight de metadados e validação integral do lote, o conteúdo exato de `0016_revogacao_sessoes_reset_senha.sql` foi aplicado no projeto correto via MCP como `revogacao_sessoes_reset_senha_compatibilidade_used`, com sucesso em 6/11 às 21h13 BRT. SHA-256 do arquivo: `899156853431a0fa01e3844fa69cd6a1d853c0177cb3fed2a7945392f739ebb6`.

A verificação posterior confirmou `session_version INTEGER NOT NULL DEFAULT 0`, trigger habilitada, RPC SECURITY DEFINER usando `used`, EXECUTE negado a `anon`/`authenticated` e permitido a `service_role`. Permaneceram 14 usuários e três registros de recuperação; os 14 usuários estão na versão inicial zero. Nenhum token foi lido ou consumido, nenhuma senha foi redefinida e nenhuma RPC financeira foi instalada. A migration cria a estrutura; **não ativa a validação de versão no backend**. `ENABLE_SESSION_REVOCATION` continua para uma operação posterior coordenada, com teste de sessão antiga e conta de teste autorizada.

## Validação integral do lote

Execução finita de 6/11 às 21h11 BRT, encerrada com `FULL_VALIDATION_EXIT=0`:

- PostgreSQL ACL: contenção aplicada duas vezes, acesso público negado, backend e linhas preservados.
- PostgreSQL integridade/reset: runner completo aprovado, com rollback, concorrência e contrato `used`/`usado` testados; clusters descartáveis encerrados.
- PostgreSQL recebimento: 17/17 grupos no fixture legado, 16/16 bloqueios de preflight antes do DDL e 23/23 grupos no fixture compatível com produção.
- Vitest completo: 84 arquivos e 507 testes aprovados; três arquivos e 11 testes de integração opt-in ignorados, não validados em produção.
- `pnpm check`, `pnpm build` e `git diff --check`: aprovados. O build ainda informa aviso de chunk grande, não erro.

0013/0014/0015/0017 continuam não aplicadas. Validação sintética não autoriza saneamento histórico nem ativação financeira.

## Riscos operacionais adicionais

O App Platform estava Healthy, com duas instâncias, e exibia a revisão anterior `adfc79b` às 21h11 BRT. O painel também informou saldo de **US$ 36,00 em atraso**, com risco de suspensão em **14/11/2026**. Nenhum pagamento foi iniciado. A publicação deste lote deve ser comprovada separadamente pela revisão implantada e pelo smoke pós-deploy.

A revisão estática da Blacklist confirmou ausência de migration-base PostgreSQL local. Além de criar as tabelas com ACL backend-only e grants de sequência, a próxima etapa precisa resolver a corrida do teto de cinco fotos, exclusão não atômica e a política efetivamente privada de armazenamento. Não afirmar que fotos estão privadas apenas pelo comentário do código; não liberar policies públicas para permitir compartilhamento. Kiwify permanece por último.

## Fontes e limites

Fontes primárias: `supabase/list_projects`, `supabase/execute_sql` (information_schema, pg_catalog, contagens financeiras, ACLs), `supabase/apply_migration`, aplicativo `https://cobrapro.online/dashboard`, healthcheck `https://cobrapro.online/api/health`, Evolution `http://147.182.191.118:8080/`.

Esta pré-auditoria valida metadados, permissões e inconsistências apontadas, não uma auditoria contábil completa de todos os assinantes. Nenhum envio real de mensagem/e-mail, baixa de pagamento ou ajuste de Caixa foi efetuado.
