# Especificação de rollout — RPCs financeiras atômicas

## Objetivo

Substituir os fluxos REST multi-etapa de pagamento de parcela e renovação de juros por funções PostgreSQL transacionais. A troca elimina janelas entre baixa de parcela, lançamento de Caixa, histórico, auditoria e idempotência.

## Pré-requisito obrigatório

Executar primeiro [preflight-rpcs-financeiras.sql](preflight-rpcs-financeiras.sql) no Supabase **COBRA PRO** (ref `oxvtmibrgjruldkouhhb`). O rollout fica bloqueado se houver duplicidades, tenant nulo, relações parcela/contrato divergentes, contador de contrato inconsistente, divergência caixa/parcela ou operações idempotentes pendentes.

## RPCs planejadas

1. `public.rpc_registrar_pagamento`: recebe `user_id` exclusivamente do backend, parcela, conta, valor, desconto, juros customizado, data civil de Brasília, observação e chave UUID obrigatória. Bloqueia conta, contrato e parcela; calcula mora sobre `DATE`; atualiza parcela, Caixa, contrato, histórico, auditoria e `operacoes_financeiras` na mesma transação.
2. `public.rpc_renovar_pagamento_juros`: bloqueia a mesma sequência, baixa a parcela de origem, lança Caixa, gera o próximo número sob lock do contrato, cria a nova parcela, atualiza contador, insere `parcelas_renovacoes`, histórico, auditoria e operação em uma única transação.

## Regras de segurança

- `SECURITY DEFINER` com `search_path` fixado e sem SQL dinâmico.
- `EXECUTE` revogado de `PUBLIC`, `anon` e `authenticated`; concedido somente a `service_role`.
- As funções reaplicam filtros por `user_id`; o frontend não escolhe tenant.
- A chave idempotente contém todos os argumentos de negócio, incluindo observação e juros customizado. Repetição concluída retorna o mesmo JSON; payload diferente é conflito.
- Sem fallback REST silencioso quando a RPC estiver habilitada.

## Regras comerciais preservadas

- Datas e atraso pelo calendário `America/Sao_Paulo`.
- Parcela parcial usa somente `saldo_residual` como base e não recalcula mora.
- Renovação diária soma um dia; semanal 7, quinzenal 15, mensal 30 e anual 365.
- A categoria de entrada permanece `pagamento_parcela`, compatível com o enum atual.

## Testes mínimos antes do rollout

- Retry com mesma chave e payload retorna o mesmo resultado sem novo Caixa.
- Mesma chave com payload diferente falha.
- Pagamentos parciais concorrentes preservam soma e saldo reais.
- Erro induzido após cada escrita deixa zero alteração persistida.
- Renovações concorrentes preservam numeração única e contador correto.
- Tentativas entre empresas falham antes de qualquer escrita.
- Casos de meia-noite de Brasília preservam a data comercial.
