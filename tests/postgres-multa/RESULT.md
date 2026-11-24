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

A instalação produtiva **exata** foi concluída em23/11 às23h31 BRT depois do checkpoint904e614e. Postflight aprovou verificadores34/35/36 e capacidade36;75 tabelas com RLS75, zero CRUD anon/authenticated,10 tabelas36 privadas sem policy/vazamento, oito RPCs36 executáveis por service_role e zero helper36 executável por essa role. Operações/origens/encargos/pernas/renovações/fences/capacidades residuais/coexistência36 permaneceram vazias.

Hashes integrais e contagens de contas_caixa, transacoes_caixa, contratos e parcelas ficaram **idênticos** entre os snapshots read-only antes e depois da instalação. Divergências históricas12 movimentos/2 contas e6 parcelas com vínculo nulo foram preservadas, não saneadas. Não houve operação financeira real nem envio de mensagem para criar evidência de teste.

Push fast-forward normal concluído para `2ce2f6cbaffbd76b3d4e407347848406817fef06` às23h32 BRT. O deploy DigitalOcean `159591e0-4c5c-4134-b4f9-a2dc8ebaca09` ficou Live às23h37min16 e Healthy. Bundle oficial `/assets/index-DWRXrj2Q.js` comparado byte a byte com o build certificado, SHA-256 `2a12193e0a3304934b7546671dd36b7fbd8ccfb24f9258230c15dbadbe0e96c6`. Regressões pós-push:490/490 aprovadas em sete arquivos. Publicação Manus também notificada como concluída.

Smoke autenticado em `cobrapro.online`: lista própria vazia carregada sem erro; cadastro de empréstimo carregou cinco modalidades, clientes e conta da empresa, sem submit; capacidade36 retornou disponível/aplicação/recebimento/renovação true. Origem, cotação e cotação de renovação com IDs inexistentes retornaram NOT_FOUND sem dado alheio; inputs incompletos retornaram BAD_REQUEST. Ficha inexistente mostrou “Empréstimo não encontrado”, sem crash ou total financeiro fictício. Health público200. A conta autenticada não possui ficha própria visível para exercitar aplicação/recebimento/renovação reais; este smoke **não é teste financeiro produtivo de ponta a ponta**.

Postflight read-only às23h40 repetiu verificadores34/35/36, RLS75/75/0 e zero operações/origens/pernas/fences36. Snapshot financeiro integral pós-smoke foi comparado mecanicamente ao anterior à instalação: contagens12/1152/316/1235 e todos os hashes idênticos, com12/2/6 preservados. O lote36 não representa liberação de todos os módulos: aporte/transferência37, manutenção de despesas, reparcelamento e demais trilhos financeiros continuam sujeitos à implementação/certificação própria.

## Achado posterior — manutenção do PostgreSQL (24/11/2026)

A certificação de convivência37 reproduziu falsa recusa55000 no36 após autovacuum: `pg_class` da tabela privada multa36_capacidades mudou somente campos de estatística/manutenção que entravam no selo36 inteiro. A recusa impede operação, sem demonstrar corrupção financeira. Às00h36 BRT a produção foi reconsultada somente leitura: verificadores34/35/36 passaram, capacidade36true, HTTP200 e quatro hashes financeiros integrais idênticos; nenhum efeito atual desse bug foi observado em produção.

Está sendo preparado hotfix36a independente, somente para excluir seis campos voláteis da projeção de metadata36, com fonte antiga intocada e preflight estrito. Exige verificador ORIGINAL válido antes da instalação; não ressela drift desconhecido nem toca saldos, histórico, operações ou provas. Certificação36a com autovacuum ON/manutenção real e instalação ainda pendentes. Esta descoberta limita a certificação original para manutenção futura até esse hotfix ser certificado/instalado; não declarar plataforma100%.
## Resolução preventiva36a — 24/11/2026

O hotfix36a foi certificado e instalado exatamente às01h11BRT, SHA `df1abe0b096b3f993954f16b3c93a1cdfb0ddd36cb968158f39b05150eaeba8f`,165369bytes; selo ORIGINAL36 válido requerido, uma função metadata e uma assinatura36 alteradas, sem resselo arbitrário. PG17 local61checksPASS/44negativas, autovacuum ON com worker real e ANALYZE/VACUUM reais. Postsource98/98 semDrift; verificadores34/35/36 aprovados,75/75RLS/zeroLeaks/zero resíduos e quatro hashes financeiros integrais idênticos, divergências12/2/6 preservadas.

Commit implementação `f02c6c3bff4b4a8faa339d181c5e5de63a8dd12b`; checkpoint/documentação `89f1668ddf64d9d614489c615da42b42dcc01dfb`. Gate exato36a sem37:3393PASS/11SKIP/159arquivosPASS/3SKIP/TypeScript/build. Push fast-forward01h18:50BRT; deployDigitalOcean `99259e18-80a1-47c6-9607-ef1c9dd34c4f` Success/Live/Healthy observado01h27:32BRT. Bundle oficial e SHA mantidosDWRXrj2Q/2a12193e..., como esperado, pois36a não altera frontend/backend. Smoke oficial autenticado: quatro clientes próprios carregados e modal NovoCliente acessível, sem submit. SQL37 segue local neste registro; nenhum pagamento/configuraçãoWhatsApp ou saneamento financeiro foi executado.
