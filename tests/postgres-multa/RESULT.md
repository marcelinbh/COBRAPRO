# Ciclo36 — certificação e limites

## Certificação local — 23/11/2026

Migration: `drizzle/0036_rpc_multa_manual_fixa.sql`, 160009 bytes, SHA-256 `7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f`. Manifesto de 71 assinaturas predecessoras conhecidas, com exatamente três extensões de guards previstas. Nenhuma migration predecessora foi modificada. Dois fixtures de data do teste35 passaram a calcular DATE civil em São Paulo, sem alteração do SQL35.

A suíte completa depois da correção de concorrência passou com **3392 testes aprovados, 11 testes opt-in ignorados, 158 arquivos aprovados e 3 ignorados**. TypeScript, build e `git diff --check` aprovados. Os testes ignorados não são anunciados como executados nesta suíte.

O harness PostgreSQL17.11 descartável executado separadamente registrou **22 grupos aprovados**: preflight/drift/ACL/RLS/rowtypes/defaults/triggers; instalação sem mutação financeira e one-shot; cinco modalidades com n1/n60; parcial com encargos congelados; virada civil BRT; renovações sucessivas/principal único/sucessora limpa; replay/recovery/fence/concorrência real; ownership e ledger inteiro; imutabilidade e coexistência com writers predecessores. O grupo antigo que menciona0031 no nome não constitui prova de teste dedicado0031; não há declaração de certificação dedicada desse harness.

## Correção de concorrência na apresentação

A renovação entre a leitura REST dos IDs e as cotações SQL poderia tornar todas as cotações coerentes com o novo hash, mas omitir a sucessora no total. A apresentação agora exige uma releitura do conjunto completo de parcelas/vínculos próprios depois das cotações. IDs novos, ausentes, duplicados ou pertencentes a outra empresa/contrato impedem a publicação do total. Uma cotação final verifica hash global, dia, conta e componentes para detectar mudança durante essa reconferência. Não há retry, alteração monetária ou fallback para cálculo legado.

Regressões direcionadas: **190 testes aprovados**, incluindo 103 do helper, 17 da seleção reconferida e 70 de lista/ficha reais. Os dois casos de rota reproduzem a sucessora criada durante a identificação SQL e exigem recusa, em vez de exibir total0. Arrays/metadados e resposta final com getters não são executados como dados de prova; transporte final falho recusa sem retry, e o mesmo conjunto de IDs reordenado é aceito.

## Escopo efetivamente admitido

Aplicação36 exige origem35 íntegra. Não admite contratos0021 nem legado0034, não saneia dados financeiros e não atribui divergências históricas a uma empresa sem prova. Multa manual fixa substitui o percentual somente nas parcelas selecionadas; mora é separada. Aplicar multa não movimenta Caixa. Recebimentos integram a operação atômica com suas provas; parcial congela encargos/residual. Renovação de modalidade elegível recebe juros+multa+mora e transfere um único principal para sucessora sem multa manual herdada.

A parcela transferida com prova35/36 retorna status lógico `renovada`, total0, não elegível e valor recebido exatamente igual a juros+multa+mora, embora o status físico predecessor seja cancelada. Cancelada sem essa prova não é tratada como paga. Conta-base não é atualizada para duplicar o ledger.

## Produção e rollout

Antes da instalação, o preflight read-only do projeto `oxvtmibrgjruldkouhhb` conferiu 71/71 fontes, sem diferenças de corpo, ACL, owner/schema ou rowtype e com verificadores34/35 aprovados. O leitor usa o mesmo `search_path=pg_catalog,pg_temp` da instalação; a qualificação textual de tipo fora desse contexto não é considerada drift.

Este documento registra a certificação local. Instalação produtiva, checkpoint/commit/push/deploy e smoke oficial têm evidências separadas de rollout; não estão inferidos do teste local. Nenhuma operação financeira real ou mensagem é executada para produzir evidência de teste. O lote36 não representa liberação de todos os módulos: aporte/transferência37, manutenção de despesas, reparcelamento e demais trilhos financeiros continuam sujeitos à implementação/certificação própria.
