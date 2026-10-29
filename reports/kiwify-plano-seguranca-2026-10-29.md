# Kiwify — plano de correção para a etapa final

**Status:** planejamento documentado; nenhuma alteração Kiwify deste documento foi publicada ou aplicada em produção. A prioridade permanece após as correções financeiras e de banco pendentes.

A documentação oficial da Kiwify define que o token configurado no webhook não é transmitido pela requisição. Ele é a chave de um HMAC-SHA1 calculado sobre os bytes exatos do corpo HTTP. A Kiwify envia o resultado hexadecimal de 40 caracteres na query `signature`. Logo, validar um cabeçalho, um `token` em query ou o JSON reserializado não atende ao contrato oficial e pode permitir chamadas forjadas ou bloquear eventos legítimos.[1]

Quando a etapa Kiwify for autorizada, a execução deve preservar o corpo bruto antes do parser JSON, exigir `KIWIFY_WEBHOOK_TOKEN` configurado e comparar `HMAC-SHA1(token, rawBody)` com `signature` em tempo constante. Falta de segredo deve retornar indisponibilidade e assinatura inválida deve retornar `401`, sem criar usuário, enviar e-mail ou registrar efeito financeiro. A configuração no painel Kiwify deve usar um token longo e aleatório correspondente ao segredo protegido da DigitalOcean.

Também devem ser tratados os riscos já encontrados no fluxo legado: senha temporária fixa, redefinição de senha de usuário existente em reentrega de pedido e reserva de idempotência somente depois da criação/envio. A correção deve gerar credencial aleatória apenas para conta nova, nunca alterar a senha de uma conta já existente por webhook repetido, reservar `order_id` mais tipo de evento de forma atômica antes de efeitos externos e cobrir reentrega, concorrência, falha de e-mail, assinatura inválida e vetor oficial de teste da Kiwify.

A Kiwify reenvia eventos que não recebem resposta 2xx e a assinatura não impede replay por si só; a deduplicação estrutural é obrigatória. O painel oferece “Testar Webhook” com dados fictícios no mesmo contrato de assinatura, devendo ser usado somente depois de validar a implantação.[1]

## Referências

[1]: https://docs.kiwify.com.br/api-reference/webhooks/receiving "Receber e validar webhooks"
