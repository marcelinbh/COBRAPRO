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

## Publicação e smoke comprovados

O lote foi registrado no commit descritivo `d9be08f`, salvo no checkpoint `6a47d722` e publicado no GitHub como `07444cb1ae377bc277f3c0e0c3700cd7e5c5ad67`, por push normal após conciliar os históricos. A comparação do tree confirmou conteúdo integralmente igual ao lote validado, sem perda das correções. TypeScript foi revalidado depois do merge.

A DigitalOcean iniciou automaticamente o deploy `048dc812-40dd-46d6-b969-673fce8b99fb` às 21h17min53s BRT e confirmou **Success / Live Deployment** às 21h24 BRT. O dashboard autenticado foi recarregado e manteve saldo exibido e 17 contratos ativos. Health JSON, site e Evolution responderam HTTP 200. Os três workflows WhatsApp recentes continuavam concluídos com success; não foi disparada mensagem de teste real.

O smoke de reset usou somente um token sintético cuja ausência foi comprovada previamente por contagem: HTTP 400 com `Token inválido ou expirado`, não 500 de schema. Contagens posteriores: 14 usuários, 14 versões iniciais zero, três resets e zero tokens sintéticos persistidos. Nenhuma senha foi alterada. Consultas adicionais não encontraram grants residuais por coluna, views acessíveis publicamente ou CREATE no schema public por anon/authenticated.

O gráfico de últimos sete dias ainda inclui o dia UTC seguinte após 21h BRT; o percentual de saúde divide bases distintas e pode superar 100%. Esses indicadores estão em correção separada, sem UPDATE financeiro ou alteração de saldo.

## Matriz de revisão restrita preparada

Consultas somente leitura das 21h22 BRT confirmaram os grupos e preservaram somente IDs, campos financeiros e vínculos mínimos fora do Git, em diretório de acesso restrito. O pacote contém **43 itens de revisão referentes a 38 registros distintos**, pois alguns registros pertencem a mais de um grupo. A ficha CSV mantém propostas e aprovações vazias; o manifesto e o ZIP foram validados. Não contém nomes, CPF, endereços, e-mails, fotos ou tokens. Não é backup integral nem comprovação de restauração.

A conferência específica dos IDs 247/279 confirmou mesma parcela número 2, contrato 42, vencimento e valor; a segunda linha está sem tenant/cliente e nenhuma delas tem lançamento de Caixa vinculado. Isso reforça a necessidade de evidência original, não autoriza exclusão. Nenhum ajuste foi executado. Os valores individuais do pacote restrito não devem ser publicados no repositório.

## Backup integral — bloqueio adicional confirmado

Às 21h28 BRT, o painel autenticado do projeto correto em `https://supabase.com/dashboard/project/oxvtmibrgjruldkouhhb/database/backups/scheduled` informou **Free Plan does not include project backups**. O resumo também exibia No backups. Assim, não há backup de projeto disponível nesse painel como proteção para saneamento; eventual backup externo ainda precisa ser demonstrado e testado.

Não foi acionado upgrade, pagamento, criação de projeto, restauração ou reset de senha do banco. Antes de qualquer UPDATE financeiro, obter backup lógico completo por canal seguro ou outra solução aprovada, verificar sua integridade e ensaiar restauração em ambiente isolado. A exportação parcial de 38 registros não satisfaz esse requisito e não justifica assumir recuperabilidade do banco.

## Segundo lote — dashboard e preparação da Blacklist

O dashboard foi corrigido para usar a mesma coleção elegível e o mesmo saldo aberto em total a receber/inadimplência, sem clamp para esconder divergência, e janelas civis BRT em dias/meses. O residual parcial não é reconstruído: ausência/valor não positivo bloqueia os indicadores da carteira. A consulta protegida `dashboard.resumoCaixa` permite exibir saldo/capital/recebido/contratos de fonte independente quando a carteira exige revisão, sem alterar lançamentos. Isso preserva disponibilidade, não certifica como contabilmente saneado o saldo histórico. Relatórios não convertem a falha dos KPIs em zero nem mostram dados stale. O score legado e os demais calendários de relatórios não foram reescritos neste escopo.

A migration local `0019_base_blacklist_backend_only.sql` cria as duas tabelas-base, enums, FKs, índices, ACL backend-only e teto transacional de cinco fotos, falhando diante de objeto homônimo incompatível. SHA-256: `91b0a14ef7878de8ca9c05a7c90be4b07ed38e712cb62c6f5e133b6b0ec79a24`. O runner PostgreSQL local confirmou 21 verificações, reaplicações sem perda de dados/sequências e concorrência real em READ COMMITTED, REPEATABLE READ e SERIALIZABLE, com cluster encerrado. **0019 não foi aplicada em produção:** privacidade efetiva do storage, remoção/compensação de objetos e elegibilidade de assinantes continuam blockers de liberação. Kiwify não foi alterada.

Validação final encerrada às 21h44 BRT com `LOTE2_FINAL_VALIDATION_EXIT=0`: 88 arquivos/574 testes Vitest aprovados, três arquivos/11 integrações opt-in ignoradas; 67 testes de dashboard aprovados também com `TZ=Pacific/Honolulu`; TypeScript, build e diff-check aprovados. Guards, workflow WhatsApp, auth e migrations 0013/0015/0016/0018 permanecem iguais ao lote anterior. Nenhuma flag foi ativada, nenhum DDL produtivo adicional foi executado. A revisão e o smoke deste segundo deploy devem ser registrados depois de sua conclusão.

O checkpoint/commit `89d8df78` foi publicado por push normal. O deploy `7fd59957-d6a8-4223-9200-06426dd3080e`, iniciado às 21h45min32s BRT, foi confirmado Success / Live Deployment às 21h52 BRT. O smoke autenticado preservou saldo e 17 contratos, passou a apresentar saúde calculada sobre total aberto (84,7%, sem saldo em dia negativo) e janela de 31/10 a 6/11. Health/site/Evolution retornaram 200. Isso não saneou divergências históricas.

O mesmo smoke identificou falha nas listas: `dashboard.parcelasHoje` retornou 500 de consulta. Catálogo somente leitura confirmou três FKs em parcelas (conta/contrato/user), nenhuma para `cliente_id`; portanto o embed PostgREST `clientes!inner` não é suportado. O ajuste local consulta parcelas e depois clientes por IDs limitados e `user_id` explícito, verificando completude e propriedade, sem DDL/backfill e sem mostrar nome de outra empresa. Lista vazia não consulta cliente. A validação completa do ajuste terminou às 21h54 BRT com `LOTE3_VALIDATION_EXIT=0`, 69 regressões de dashboard também em Honolulu, TypeScript/build aprovados; publicação e smoke específicos ainda devem ser confirmados.

## Fontes e limites

Fontes primárias: `supabase/list_projects`, `supabase/execute_sql` (information_schema, pg_catalog, contagens financeiras, ACLs), `supabase/apply_migration`, aplicativo `https://cobrapro.online/dashboard`, healthcheck `https://cobrapro.online/api/health`, Evolution `http://147.182.191.118:8080/`.

Esta pré-auditoria valida metadados, permissões e inconsistências apontadas, não uma auditoria contábil completa de todos os assinantes. Nenhum envio real de mensagem/e-mail, baixa de pagamento ou ajuste de Caixa foi efetuado.
