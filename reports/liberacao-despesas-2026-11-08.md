# Integração local — despesas prospectivas 0020

**Data:** 08/11/2026. **Estado:** integração local e validações concluídas. Este relatório não autoriza nem certifica produção, deploy, habilitação de flags ou saneamento do legado. Preflight, backup e rollout pertencem à coordenação.

## Escopo efetivamente editado

Esta frente escreveu exclusivamente:

- `server/routers/contasPagar.ts` — novo router isolado.
- `server/routers/contasPagar.test.ts` — testes de router, proveniência, UI/intenção e integração PostgreSQL17 local.
- `client/src/pages/ContasPagar.tsx` — UI de consulta e três intenções atômicas.
- `shared/despesasIntent.ts` — schemas estritos, dinheiro/data civil e armazenamento por usuário/ação. Seus testes estão no `.test.ts` autorizado do router; nenhum arquivo extra foi necessário.
- `tests/postgres-expenses/run.sh` — seleção PG16/PG17 por `PG_BIN` sem perder isolamento.
- Este relatório.

Não foi editado `server/routers.ts`, env, db, schema, index, guards ou migrações por esta frente. O pai informou e realizou o registro `contasPagar: contasPagarProspectivasRouter` no `appRouter`; alterações desses caminhos no workspace compartilhado pertencem a outras frentes. Nenhum navegador, MCP remoto, banco de produção, DDL produtivo, commit, push, flag ou deploy foi utilizado.

## Assinatura e contrato público

```ts
export const contasPagarRouter = router({ /* procedimentos abaixo */ });
export type ContasPagarRouter = typeof contasPagarRouter;
```

Procedimentos autenticados:

| Procedimento | Contrato |
| --- | --- |
| `listar(input?)` | `{ status?, categoria? }`, schema `.strict()`, array compatível camelCase com status de apresentação normalizado. Aceita aliases físicos `pago/atrasado/cancelado` e legados `paga/atrasada/cancelada`. Acrescenta `proveniencia0020`, `podePagar`, `podeEstornar`, `pagamentoOperationId`, `transacaoSaidaId`, `requerConferencia`, `mensagemConferencia`. |
| `resumo()` | Mesmos nomes `totalPendente/qtdPendente`, `totalAtrasado/qtdAtrasado`, `totalPago/qtdPago`. Totais são **strings decimais exatas**, não floats; pagas somente no mês civil BRT. Erros de fonte/valor/data não viram zeros. |
| `capacidades()` | `{ prospectivasHabilitadas, recorrencia: false }`, somente leitura da flag existente. |
| `criar(input)` | `{ descricao, categoria?, valor: string, dataVencimento, observacoes?, idempotencyKey: UUID }`. RPC `rpc_criar_despesa_prospectiva` exclusiva. |
| `pagar(input)` | `{ id: int32 positivo, contaCaixaId: int32 positivo, dataPagamento: YYYY-MM-DD, idempotencyKey: UUID }`. RPC `rpc_pagar_despesa_prospectiva` exclusiva. |
| `estornar(input)` | `{ id: int32 positivo, pagamentoOperationId: UUID original da baixa, dataEstorno: YYYY-MM-DD, motivo obrigatório, idempotencyKey: UUID }`. RPC `rpc_estornar_despesa_prospectiva` exclusiva. Sem valor livre. |
| `editar/update/cancelar/excluir/recorrencia/sincronizarCaixa` | Sempre `PRECONDITION_FAILED` com mensagem clara. Nenhum fallback, nem quando flag legada de sync está habilitada. |

As três mutações públicas são `.strict()`: `userId`, `user_id`, valor livre no pagamento/estorno, recorrência e campos adicionais são rejeitados. `userId` vem exclusivamente de `ctx.user.id`, montado campo a campo no servidor. Flag prospectiva desligada bloqueia antes de obter cliente/DB. O serviço existente continua validando integralmente a confirmação da RPC. Não há reserva externa, REST DML, compensação manual ou escrita no saldo-base.

## Consulta, proveniência e isolamento

A 0020 já contém `GRANT SELECT` para `service_role` nas três tabelas dedicadas, portanto não houve blocker de ACL que exigisse inventar proveniência. Toda leitura usa `user_id = ctx.user.id`, projeções explícitas e paginação ordenada; teto excedido causa erro, não total parcial. Retorno com owner estranho é rejeitado.

Legado nunca é adotado por status, descrição ou coincidência de lançamento. Pagamento só aparece para origem dedicada mais operação de criação, hash e snapshot íntegros. Estorno somente para pagamento dedicado sem estorno anterior, UUID original estritamente vinculado à operação e resultado, auditoria antes/depois/saída, despesa original, conta, valor/data e saída original do mesmo owner. `pagamentoOperationId` e `transacaoSaidaId` não são fabricados nem expostos como elegíveis quando vínculo falha. Trilha ausente/sem SELECT mantém somente consulta com aviso de conferência; outras falhas de leitura não se disfarçam de vazio.

Dinheiro e IDs de movimentos são solicitados via casts PostgREST `::text`. Snapshots/payload/auditoria são solicitados como `JSONB::text`: a verificação SHA-256 usa **o payload textual original PostgreSQL**, sem reserializar números JS e perder escala. O parser de snapshot conserva `valor` textual e IDs grandes; textos livres não são substituídos pelo tokenizer. UUIDs de usuário/ação não são inferidos de status. Integração dedicada PG17 verificou essa técnica com textos contendo aspas/Unicode e `9999999999999.99`.

Atraso é derivado somente na apresentação e resumo pelo dia civil BRT. Uma linha física `pendente` vencida aparece em atraso mas continua pagável se snapshot prospectivo íntegro; nenhuma consulta executa `UPDATE` para mudar status. A RPC continua autoridade final: revalida conta ativa/owner e **todo** o ledger sob locks, inclusive inconsistências que surjam após listagem. Conta com ledger histórico válido não é proibida por mera existência de histórico; nenhum saldo-base é alterado.

## UI e resultado incerto

Não existem botões/mutações de edição, cancelamento, exclusão ou recorrência. Categorias novas são somente as nove admitidas pela 0020. Histórico fica em consulta com mensagem **“requer conferência”**. As ações de pagar e estornar exigem elegibilidade e flag confirmadas; nova despesa é avulsa. Estorno pede motivo e mostra UUID/ID da baixa original, mesmo valor e conta; explica a preservação da saída e encerramento da obrigação.

Sessão usa somente o ID retornado por auth; tokens, cookies e resposta completa de auth não são persistidos por esta implementação. Cada intenção guarda versão, usuário, ação, UUID e payload original em `sessionStorage` com namespace `cobrapro:despesas:0020:v1:user:<id>:action:<ação>`. Datas de pagamento/estorno são calculadas como dia civil BRT na primeira intenção e não mudam em retry/reload. Chave existente com payload diferente é bloqueada. Reabertura/remount/reload recupera o payload original e oferece reenvio da mesma intenção; não há descarte automático ou chave substituta por timeout.

Um lock síncrono compartilhado e `ref` de requisição impedem duplo clique. Mutations usam `retry: false`. Erro conserva intenção; somente confirmação validada remove. Falha de remoção conserva a mesma intenção para replay seguro. Quota de escrita conserva UUID/payload em memória e avisa explicitamente para não recarregar e salvar os dados exibidos para conferência. Leitura inacessível/JSON corrompido/escopo divergente bloqueia novas chaves em vez de sobrescrever. Uma confirmação tardia de sessão anterior não é apresentada como sucesso nem repovoa payload na sessão nova.

Estados de fonte/consulta da sessão, capacidade, resumo, lista e contas de Caixa são tratados separadamente de loading e vazio. Não há `?? 0` para esconder falha de resumo, `parseFloat` de dinheiro, sucesso otimista ou sucesso após confirmação incompleta. Falha na invalidação de consulta não transforma uma RPC já confirmada em nova operação.

## Validações executadas

### PostgreSQL17 — suíte completa da 0020

```sh
PG_BIN=/usr/lib/postgresql/17/bin bash tests/postgres-expenses/run.sh
```

**47 PASS, 0 FAIL**, servidor PostgreSQL **17.11**. Apenas fixture sintético e 0020, sem 0013/0015. Cluster privado com diretório/socket 0700, `listen_addresses=''`, ambiente limpo sem dotenv. Encerramento confirmado: `STOP_EXIT=0`, `FINAL_STATUS=3`.

Evidências:

- `/tmp/cobrapro-expenses.ENLuJj/logs/summary.json`
- `/tmp/cobrapro-expenses.ENLuJj/logs/results.json`
- `/tmp/cobrapro-expenses.ENLuJj/logs/tests-summary.log`
- `/tmp/cobrapro-expenses.ENLuJj/logs/shutdown.log`

O runner seleciona somente binários locais explícitos PG16/17. Como `validate.py` é artefato não autorizado a editar e contém versão rígida, `run.sh` adapta quatro marcadores conhecidos **em memória**: caminho BIN, nome do gate, versão esperada no gate e versão no relatório. Exige ocorrência única de cada marcador e falha se contrato mudar; gate de versão/socket continua ativo. `PG_BIN=/tmp/postgresql` rejeitou com exit 2 antes de abrir cluster. Nenhum arquivo de validação/migração foi modificado.

### Testes dedicados e contenção integrada

Última execução:

```sh
pnpm check
pnpm exec vitest run \
  server/routers/contasPagar.test.ts \
  server/services/despesasRpc.test.ts \
  server/migrations/despesasRpc.test.ts \
  server/contasPagarPagamento.test.ts \
  server/contasPagarSchemaFallback.test.ts \
  server/contasPagarStatus.test.ts \
  server/financialOperations.blocked.test.ts \
  server/tenantOwnership.financial.test.ts
```

**8 arquivos, 182 PASS, 0 FAIL**, exit 0. Destes, **164** são dedicados despesas/compatibilidade (77 novo router/intenção/PG17, 75 serviço RPC, 5 migração estática, 7 compatibilidade). Mais **18** contenção/ownership do pai, apenas executados, não editados por esta frente. `pnpm check`: **exit 0** após estado final integrado. `git diff --check` dos arquivos rastreados desta frente e `bash -n tests/postgres-expenses/run.sh`: exit 0.

O teste novo de integração abre PG17 em socket privado separado/porta 55438, executa a migração preparada e extrai as mesmas projeções textuais usadas pelo router. Comprova criação, listagem elegível, pagamento, UUID/saída de estorno vinculados, valor máximo exato, histórico prévio válido, estorno integral, saldo-base inalterado e linha histórica inalterada; encerramento exige status 3. Último cluster/log: `/tmp/cobrapro-expenses-router.RS76ZP/postgres.log`. O fixture sintético concede SELECT das tabelas financeiras legadas somente dentro do teste, reproduzindo a fronteira de leitura; não adiciona DML dedicado nem altera grants da 0020.

## Limitações e gates restantes

1. Não houve ensaio browser/DOM interativo nem HTTP/PostgREST real. O contrato de casts `::text`, ACL de leitura legada, formato de timestamps e disponibilidade da 0020 devem ser confirmados pelo pai no preflight/rehearsal autorizado; qualquer incompatibilidade de leitura falha fechado.
2. A consulta marca elegibilidade conservadora, não garante que uma mutação posterior terá sucesso: concorrência, conta inativa e ledger inconsistente são revalidados atomicamente pela RPC.
3. Falha efetiva de quota impede persistência física; a intenção permanece em memória com aviso e dados visíveis, mas recarregar/fechar essa sessão pode perder o fallback. Nessa condição exige conferência com UUID/payload copiados, não alegação de recuperação durável impossível.
4. Legado e estados encerrados permanecem somente consulta/conferência. Nenhum saneamento, backfill, adoção, certificação de saldo antigo ou ajuste de base foi feito.
5. O antigo bloco local de router pode permanecer no arquivo do pai, mas seu registro público deve continuar apontando exclusivamente ao novo router. Esta frente não realizou alterações nesse arquivo.
6. Produção continua sob gates do pai: backup recuperável, revisão/instalação da 0020 via fluxo aprovado, preflight de ACL/RPC/leitura e flags desligadas por padrão até autorização específica de rollout.
