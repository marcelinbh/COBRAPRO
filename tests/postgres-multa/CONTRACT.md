# Multa manual fixa recebível — ciclo 36

Status: ciclo financeiro certificado localmente em PostgreSQL17, API e interface. Instalação e publicação produtivas exigem o preflight e o registro de rollout; teste local não implica disponibilidade produtiva. Baseline b63a6d0; apenas nova migration 0036 e este harness. Evidências e limites em RESULT.md.

## Integração reservada (nomes e argumentos definitivos)

Owner `p_user_id` sempre de `ctx.user.id`, jamais do payload. Todas as RPCs retornam JSONB. Valores monetários são strings decimais canônicas `^(0|[1-9][0-9]{0,9})\.[0-9]{2}$`, positivos quando exigidos, sem arredondamento silencioso; DATE são `YYYY-MM-DD`, nunca objetos JS Date. Conta é derivada e todas as parcelas devem usar a própria conta do contrato.

```ts
type AplicarMultaInput = {
  idcontrato: number;
  multa: string; // reais fixos POR parcela, centavos explícitos, > 0
  idempotencyKey: string; // UUID obrigatório; conservar até resultado conhecido
  parcelasIds?: number[]; // seleção explícita opcional; sem duplicados
};
// supabase.rpc('rpc_aplicar_multa36', {
//   p_user_id: ctx.user.id, p_chave_idempotencia: input.idempotencyKey,
//   p_contrato_id: input.idcontrato, p_multa: input.multa,
//   p_parcelas_ids: input.parcelasIds ?? null
// })
type AplicarMultaResult = {
  success: true; operationId: string; repetida: boolean;
  contratoId: number; contaCaixaId: number; parcelasIds: number[];
  quantidade: number; valorFixoPorParcela: string; valorMultaTotal: string;
  dataCivilBrt: string; estado: 'exigivel_nao_recebida'; trilho: 'multa36';
};
```

| RPC | Argumentos (ordem SQL e nomes PostgREST) |
|---|---|
| `rpc_aplicar_multa36` | `p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_multa text, p_parcelas_ids integer[] DEFAULT NULL` |
| `rpc_identificar_multa36` | `p_user_id integer, p_contrato_id integer, p_parcela_id integer` |
| `rpc_cotar_multa36` | `p_user_id integer, p_contrato_id integer, p_parcela_id integer` |
| `rpc_receber_multa36` | `p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido text, p_total_exigido text, p_data_pagamento date, p_estado_hash text, p_modo text, p_observacoes text DEFAULT NULL` |
| `rpc_cotar_renovacao_multa36` | `p_user_id integer, p_contrato_id integer, p_parcela_id integer, p_novo_vencimento date` |
| `rpc_renovar_multa36` | `p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido text, p_total_exigido text, p_data_pagamento date, p_estado_hash text, p_novo_vencimento date, p_observacoes text DEFAULT NULL` |
| `rpc_reconciliar_multa36` | `p_user_id integer, p_chave_idempotencia uuid, p_request jsonb` |

`rpc_identificar_multa36` tem prioridade sobre classificadores 0021/0034/0035: retorna `null` para contrato não admitido36, ou `{userId,contratoId,parcelaId,trilho:'multa36',status}`. Não converte nem falsifica origem histórica.

Cotação recebimento: `{elegivel,contratoId,parcelaId,contaCaixaId,totalExigido,multa,mora,jurosEmbutidos,valorPagoAcumulado,dataPagamento,vencimento,status,estadoHash,regra:'recebimento_multa36_brt_v1'}`. Cotação renovação: `{renovavel,contratoId,parcelaId,contaCaixaId,totalExigido,juros,multa,mora,principalPreservado,dataPagamento,novoVencimento,estadoHash,regra:'renovacao_multa36_brt_v1'}`.

Recebimento: `{success,operationId,repetida,contratoId,parcelaId,transacaoCaixaId,contaCaixaId,valorRecebido,totalExigido,saldoResidual,valorPagoAcumulado,dataPagamento,status,contratoStatus,regra:'recebimento_multa36_brt_v1'}`. Renovação: `{success,operationId,repetida,contratoId,parcelaId,novaParcelaId,transacaoCaixaId,contaCaixaId,valorRecebido,dataPagamento,novoVencimento,contratoStatus:'ativo',status:'renovada',regra:'renovacao_multa36_brt_v1'}`.

Reconciliação recebe o request SQL normalizado (sem owner): multa `{acao:'multa',contratoId,multa,parcelasIds:null|number[]}`; recebimento `{acao:'receber',contratoId,parcelaId,valorRecebido,totalExigido,dataPagamento,estadoHash,modo,observacoes:null|string}`; renovação igual, `acao:'renovar'`, `modo:'renovar'`, `novoVencimento`. Retorna `{status:'confirmed'|'not_executed',operationId:string|null,result:object|null,idempotencyKey,proof:'uuid_fenced36_v1'}`. Após `not_executed`, UUID fica fechado e requer nova intenção/UUID. Owner atual é validado inclusive em retry/reconciliação.

## Semântica financeira

Multa fixa substitui a multa percentual automática apenas nas parcelas selecionadas; mora simples permanece distinta. Não altera `valor`, `valor_original`, principal ou juros embutidos. Não cria lançamento de Caixa até recebimento. Somente parcela aberta sem pagamento, DATE vencimento estritamente menor que hoje Brasília e sem multa36 anterior. Seleção automática congela IDs no primeiro commit; retry não inclui novos vencidos. Nenhuma elegível é erro, não sucesso vazio. UUID é único por owner em todas ações36; divergência `23505`.

Primeiro parcial fixa multa e mora; demais parciais só consomem residual e não geram novos encargos. Integral exige residual exato. Renovação preserva principal uma única vez, recebe juros+multa+mora, cria sucessora sem multa herdada; não permite renovar Price ou parcelas já parcialmente recebidas. Parcelas transferidas têm status físico `cancelada` e prova explícita36, não quitação de principal. Quitado exige prova integral de todos descendentes pagos/transferidos, pernas e encargos. Não há patch de redução/exclusão de pagamento ou desconto.

## Segurança e instalação

Somente `service_role` executa RPCs; helpers e tabelas privados, RLS sem policies. Sessão autentica owner no adapter e banco valida toda cadeia e ledger inteiro da própria conta, nunca filtrando crossowner. Operações/auditorias/origens/encargos/pernas imutáveis. Transições usam capacidades privadas por linha inteira, por operação e por guard; sem GUC, flag ou owner/source forjado. Anteriores snapshots/auditorias ficam imutáveis, prova36 referencia admissão íntegra e cada evento novo.

DDL one-shot em Read Committed, PG17 e janela cooperativa exclusiva. Gate compara source/ACL/config/overloads/rowtypes versionados antes de estender apenas os guards previstos. Manifestos predecessores só recebem novo selo na instalação após verificação exata das mudanças previstas; runtime nunca adota drift. `55000` drift; `42501` ownership/permissão; `23514` prova/estado não suportado; `22023` input; `40001` cotação/data expirou ou contenção; `23505` UUID divergente/multa já aplicada.

## Admissão efetiva e leitura encerrada

| Origem/caso | Comportamento certificado36 |
|---|---|
|0035 íntegra, parcela aberta vencida sem recebimento/multa36 anterior|Aplicação manual fixa; não altera principal nem Caixa.|
|0035 com multa36 admitida|Recebimento integral/parcial, residual congelado e quitação comprovada.|
|Bullet mensal/semanal/diário elegível, sem parcial|Renovação sucessiva preserva um principal; sucessora sem multa manual herdada.|
|Tabela Price ou parcela parcial|Renovação recusada; recebimento próprio continua conforme estado provado.|
|0021 e legado0034|Não admitidos para aplicação36; recusa explícita, sem conversão ou adoção de histórico.|
|Paga comprovada|Cotação total0/elegivelfalse, pagamento registrado preservado.|
|Transferida com prova35/36|Cotação status lógico renovada, total0/elegivelfalse, pago exatamente juros+multa+mora; não conta principal transferido como pago.|
|Cancelada sem prova de transferência|Recusa; jamais inferir quitação ou nova entrada de Caixa.|

O hash da cotação é o snapshot contratual global. A apresentação consulta todas as parcelas, inclusive encerradas, com concorrência máxima4; reconfere o conjunto completo de IDs/vínculos depois das cotações e realiza uma cotação final para detectar renovação durante a seleção. Falha ou composição diferente não devolve total parcial/zero e não cai em cálculo legado. Somente ausência SQL36 explícita permite o caminho anterior. Não há retry financeiro automático.
