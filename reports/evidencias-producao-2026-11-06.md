# Evidências de produção — 6 de novembro de 2026

## DigitalOcean, 18h35 BRT

Página autenticada: https://cloud.digitalocean.com/apps/4cecbafa-ef34-4349-a502-f5e67e328214/deployments/6c01ca1a-fa38-4561-b8be-1b6e515c3f0b?i=c260e7

O painel exibiu **Deployment / Success / Live Deployment**, commit `06c37eb` do repositório `marcelinbh/COBRAPRO/main`, iniciado às 17h59min13s. Aplicação saudável, duas instâncias. O detalhe confirma a versão, não apenas disponibilidade HTTP.

O painel também exibiu saldo em atraso de **US$ 36,00**, com pagamento solicitado até **14/11/2026** para evitar suspensão. Nenhuma operação de pagamento foi feita.

## Endpoints públicos, 18h34 BRT

- https://cobrapro.online/api/health — HTTP 200; `{"ok":true,"service":"cobrapro"}`.
- https://cobrapro.online/ — HTTP 200.
- http://147.182.191.118:8080/ — HTTP 200. Continua transporte HTTP; o check não comprova TLS, estado das instâncias WhatsApp ou entrega de mensagem.

## Supabase, 18h36–18h42 BRT

Editor autenticado: https://supabase.com/dashboard/project/oxvtmibrgjruldkouhhb/sql/new ; cabeçalho **COBRA PRO / main PRODUCTION**.

Consulta inofensiva `SELECT 1 AS teste LIMIT 1;` apareceu visualmente, mas a execução retornou `Error: query: Too small: expected string to have >=1 characters`. O conteúdo visual ainda não está sincronizado com o modelo interno do SQL Editor. O console do navegador retornou `Unsupported browser action in payload`. Não houve DDL nem leitura financeira efetiva por essas tentativas.

O conector MCP Supabase foi consultado novamente e listou somente `vozmwdwpxacdsrzqevxg`, que não é a referência produtiva do CobraPro. Não executar queries ou migrations nesse projeto para corrigir CobraPro.

## Limites

Nenhuma migration 0013–0017 foi aplicada nesta confirmação. Nenhuma flag de recebimento ou revogação de sessão foi habilitada. Não há alegação de reconciliação de dados financeiros, rotação de credenciais ou teste de entrega real.
