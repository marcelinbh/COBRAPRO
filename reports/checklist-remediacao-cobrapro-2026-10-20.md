# Checklist de remediação prioritária — CobraPro

**Início:** 20 de outubro de 2026  
**Regra solicitada:** correções Kiwify ficam por último.  
**Objetivo:** eliminar primeiro riscos de tomada de conta, alteração/vazamento entre empresas e corrupção operacional/financeira.

## Prioridade P0 — Contenção imediata

- [x] Remover a rota pública de bootstrap administrativo (`/api/auth/seed-admin`).
- [x] Remover endpoints HTTP temporários que executavam/expunham migrations (`/api/admin/migration-*`).
- [x] Exigir autenticação de automação nos heartbeats de parcelas e Supabase.
- [x] Reduzir o tamanho global aceito para JSON e formulários HTTP.
- [x] Exigir sessão de usuário e restringir tamanho, MIME, destino e nome nos uploads de clientes.
- [x] Adicionar testes de regressão à validação de upload.
- [x] Impedir que o cabeçalho `Origin` redirecione e-mails de recuperação de senha a domínios externos.
- [x] Limitar tentativas de login e recuperação por endereço/origem e e-mail, sem guardar esses dados em claro.
- [x] Armazenar tokens de recuperação apenas como hash SHA-256 no banco de dados.
- [x] Remover a chave padrão da Evolution do código e exigir variável criptografada na DigitalOcean.
- [ ] Rotacionar credenciais administrativas e segredos expostos em histórico. **Depende de configuração segura de variáveis na DigitalOcean; não será exposto em chat.**
- [ ] Remover chave padrão da Evolution API do código depois de confirmar a variável de ambiente de produção.

## Prioridade P1 — Proteção entre assinantes (isolamento multiempresa)

- [ ] Criar inventário de todas as procedures sem filtro de proprietário.
- [x] Restringir contratos, PDFs, histórico, multas e atualização diária de parcelas à empresa proprietária.
- [x] Restringir assinaturas, clientes vinculados, pagamentos recorrentes e contas de caixa à empresa proprietária.
- [x] Restringir produtos, cheques, resumos e links do portal de cliente à empresa proprietária.
- [ ] Corrigir mutações de contratos, parcelas, caixa, produtos, cheques, templates, etiquetas, vendas, assinaturas e portal para filtrar `user_id`.
- [ ] Validar o recurso de origem antes de qualquer escrita encadeada.
- [ ] Criar testes de autorização: conta A não pode ler, editar ou apagar recurso da conta B.
- [ ] Criar migration aditiva de índices e constraints por tenant; aplicar somente após verificar dados legados.

## Prioridade P2 — Caixa, parcelas e renovação

- [ ] Desabilitar/corrigir a quitação total que marca parcelas sem lançar entrada de caixa.
- [ ] Implementar transação/RPC única para pagamento de parcela e saldo residual.
- [ ] Implementar transação/RPC única para renovação de juros.
- [ ] Implementar transação/RPC única para despesas, cheques, reparcelamento e vendas de telefone.
- [ ] Criar restrição única por empresa, contrato e número de parcela.
- [ ] Implantar relatório de reconciliação entre parcelas, operações e livro-caixa.
- [ ] Padronizar todos os fluxos financeiros pelo calendário `America/Sao_Paulo`.

## Prioridade P3 — WhatsApp e controle operacional

- [ ] Recuperar mensagens presas em `enviando` com lease vencido.
- [ ] Persistir e mostrar ID da mensagem da Evolution em outbox e histórico.
- [ ] Autenticar webhook Evolution e vincular evento à instância/empresa correta.
- [ ] Mostrar na tela: aceita pela API, enviada, entregue, lida, falhou ou estado desconhecido.
- [ ] Registrar relatório diário como concluído somente após confirmação do worker.
- [ ] Limitar tentativas, alertar sobre instância desconectada e evitar reenvio indevido.

## Prioridade P4 — Kiwify (por último, conforme solicitado)

- [ ] Validar assinatura oficial usando corpo bruto e segredo em ambiente.
- [ ] Substituir senha temporária fixa por fluxo de definição de senha de uso único.
- [ ] Reservar idempotência de pedido antes de criar usuário/enviar e-mail.
- [ ] Cobrir webhook aprovado, duplicado, inválido e erro de e-mail com testes.

## Critério de publicação

- [ ] `pnpm check`, testes direcionados e build aprovados.
- [ ] Checkpoint salvo antes de publicar.
- [ ] Commit enviado ao GitHub.
- [ ] Deploy concluído na DigitalOcean.
- [ ] Após deploy, teste no `cobrapro.online` com a conta real `koletor3`, sem criar dados financeiros fora de um fluxo de teste autorizado.
