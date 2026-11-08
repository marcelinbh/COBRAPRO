# Empréstimos prospectivos — entrega local de 8/11/2026

## Escopo

Criação mensal simples 0021 e recebimento prospectivo 0022 integrados ao `appRouter.emprestimosProspectivos` e às páginas Contratos/Parcelas. **Não instalados nem habilitados em produção neste ponto.** A criação exige simultaneamente `ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS` e `ENABLE_RPC_CICLO_EMPRESTIMOS_PROSPECTIVOS`, impedindo abrir dívida sem caminho de recebimento. O recebimento antigo `ENABLE_RPC_RECEBIMENTO_PARCELA` permanece desligado; não se aplicam 0013/0015 para contornar o legado.

O recorte é mensal simples, 1 a 60 parcelas, agenda explícita e dinheiro exato. Price, diário, semanal, quinzenal, bullet, venda, cheque e reparcelamento não são liberados. No esquema produtivo, multa padrão de 2% e mora simples de 0,033% por dia civil são calculadas no SQL apenas depois da virada de Brasília após o vencimento; `valor_juros` já está embutido e não é somado como mora. No primeiro parcial os encargos são fixados; o residual não recebe nova multa/mora nesse recorte. Não prometer configurabilidade de encargos além da assinatura implementada.

## Recebimento 0022

RPCs de cotação somente leitura e recebimento atômico, com EXECUTE exclusivo do backend. UUID da intenção e hash por tenant; replay devolve resultado persistido. Locks de ledger, conta, cliente, cobrador, contrato e parcelas preservam atomicidade e isolamento. Conta original é fixa. Cada baixa gera uma entrada do valor efetivamente recebido; residual parcial permanece na parcela, e contrato só quita depois de todas pagas. Histórico, auditoria, snapshots, perna de Caixa e resultado confirmam na mesma transação. O saldo-base não é recalculado ou sobrescrito.

A origem 0021 não é aceita isoladamente: payload/hash/auditoria/resultado, aliases, cálculo e rateio, somas de capital/juros, agenda, defaults, ausência de pagamento/encargos, estados/timestamps, débito original e histórico precisam corresponder. Futuras criações capturam snapshots completos na conclusão. Antes de cada mutação são comparados novamente. Não existe adoção ou backfill de parcelas legadas.

As tabelas privadas de operações, estados, pernas e autorizações têm RLS e não permitem SELECT/DML a `service_role`; capacidades internas são transacionais e não dependem de GUC controlável pelo caller. Contratos/parcelas do cohort, proprietário/saldo-base/exclusão de conta e lançamentos vinculados ficam protegidos contra mutações externas.

## Gate de coexistência identificado

A versão inicial 0022 bloqueia também outras RPCs legítimas de despesa na conta do cohort. **Isso impede o rollout como Caixa compartilhado entre despesas e empréstimos.** Uma integração dedicada 0025 está sendo preparada e precisa provar as duas operações na mesma conta, concorrência, saldo líquido, rollback e proteção contra INSERT manual e UPDATE/DELETE de saldo/livro-caixa. Não resolver escondendo essa restrição ou enfraquecendo os triggers.

## Interface e retry

Criação/recebimento usam tRPC autenticado tipado. UUID e payload integral são gravados em sessionStorage por tenant/ação/parcela antes do envio, preservados no timeout/reload; erro de persistência impede envio. Cotação e encargos vêm do SQL. Parcela paga continua consultável para conferir replay após resultado incerto. O formulário antigo não é liberado por esse trabalho: o backend o contém e a página o identifica como anterior.

## Evidências locais finais da primeira entrega

| Verificação | Resultado |
|---|---|
| Ciclo PostgreSQL 17.11, socket privado sem TCP | 13 grupos aprovados; shutdown confirmado |
| Criação PostgreSQL 17.11 | 13 grupos aprovados; shutdown confirmado |
| Vitest de serviço/router/interface, 5 arquivos | 141 aprovados |
| TypeScript | aprovado |
| Rollback induzido | 11 etapas de escrita cobertas |
| Concorrência | replay 8 chamadas, full/full e partial/full; um vencedor e stale explícito |
| Calendário BRT | 23h59min59,999s/virada, em quatro fusos |

Evidências: `/tmp/cobrapro-loan-cycle-pg17-Arfgtr/evidence/` e `/tmp/cobrapro-loans-pg17-QGXWLW/evidence/`; README em `tests/postgres-loan-cycle/README.md`. Testes locais não são smoke PostgREST/browser nem certificação de failover ou proteção contra DBA que desabilite triggers.

## Renovação e legado

Renovação permanece **NO-GO**: convenções conflitantes de capital/juros embutidos, origem paga versus transferida e agenda mensal versus 30 dias precisam de regra de negócio definida. Implementar agora inventaria política e poderia repetir as divergências denunciadas. Os registros antigos inconsistentes continuam para revisão/aprovação individual; nenhum saldo, parcela ou tenant histórico foi corrigido automaticamente.

Rollout exige ainda integração 0025, validação completa, ensaio dos hashes finais no clone, DDL aditivo correto, deploy e smoke sintético segregado autorizado antes da habilitação conjunta das flags. A segurança de uma chamada nova não equivale à liberação financeira global.
