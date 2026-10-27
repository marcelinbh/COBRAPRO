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
- [x] Consumir token de recuperação condicionalmente no banco antes de alterar a senha, bloqueando uso concorrente do mesmo link.
- [x] Remover a chave padrão da Evolution do código e exigir variável criptografada na DigitalOcean.
- [x] Remover artefatos compilados versionados e impedir que `dist/` volte ao repositório.
- [x] Restringir uploads de logo a PNG/JPG/WEBP de até 2 MB, verificar assinatura do arquivo e eliminar a rota de upload inexistente.
- [x] Separar o limite de 15 MB do upload autenticado dos corpos das rotas comuns (3 MB) e formulários (256 KB).
- [ ] Rotacionar credenciais administrativas e segredos expostos em histórico. **Depende de configuração segura de variáveis na DigitalOcean; não será exposto em chat.**
- [x] Remover chave padrão da Evolution API do código depois de confirmar a variável de ambiente de produção.

## Prioridade P1 — Proteção entre assinantes (isolamento multiempresa)

- [x] Criar inventário de todas as procedures sem filtro de proprietário.
- [x] Restringir contratos, PDFs, histórico, multas e atualização diária de parcelas à empresa proprietária.
- [x] Restringir assinaturas, clientes vinculados, pagamentos recorrentes e contas de caixa à empresa proprietária.
- [x] Restringir produtos, cheques, resumos e links do portal de cliente à empresa proprietária.
- [x] Corrigir mutações de contratos, parcelas, caixa, produtos, cheques, templates, etiquetas, vendas, assinaturas e portal para filtrar `user_id`; importação de clientes e coletores incluídos.
- [x] Corrigir os caminhos Drizzle que ainda permitiam consulta individual de contrato e edição/documentos de cliente apenas por ID; adicionados testes de regressão por empresa.
- [x] Validar o recurso de origem antes de qualquer escrita encadeada nos fluxos de veículos, contratos, parcelas, renovação, despesas e Blacklist.
- [x] Criar regressões de autorização: conta A não cria veículo para cliente B, não apaga veículo/parcela B, não edita contrato B, não cria reserva financeira com IDs B e não remove foto de outro registro Blacklist.
- [x] Escapar dados de negócio nos comprovantes e contratos HTML; limitar logo a URL HTTPS e fotos compartilhadas da Blacklist a JPEG/PNG/WEBP de até 2 MB com assinatura binária.
- [x] Endurecer o Portal do Cliente: novas emissões armazenam somente hash do token, o acesso é de uso único por compare-and-set, respostas não entram em cache e parcelas são projetadas com campos mínimos.
- [x] Conter enumeração e exposição da Blacklist compartilhada: busca somente CPF/CNPJ completo validado, DTO mascarado sem contato/endereço/valor/fotos, remoção de listagem geral e detalhes enumeráveis, fotos privadas somente para o autor e limite de cinco uploads no servidor.
- [ ] Criar migration aditiva de índices e constraints por tenant; aplicar somente após verificar dados legados.

## Prioridade P2 — Caixa, parcelas e renovação

- [x] Desabilitar/corrigir a quitação total que marca parcelas sem lançar entrada de caixa.
- [x] Remover a transferência automática de saldo parcial para a parcela seguinte; o saldo pendente permanece na própria parcela e é acumulado corretamente em cada baixa.
- [x] Corrigir dashboard, cartões e listas para não somarem novamente o principal de parcela parcial que já possui `saldo_residual`.
- [x] Bloquear a rotina legada de sincronização automática que criava lançamentos no caixa sem uma conferência explícita.
- [x] Suspender o reparcelamento não atômico até sua substituição por RPC/transação única, evitando contratos parcialmente quitados ou recriados.
- [x] Compensar integralmente falhas REST na renovação de juros: remove a nova parcela e a entrada de caixa da tentativa, restaura a parcela original e bloqueia avanço concorrente do contrato.
- [ ] Implementar transação/RPC única para pagamento de parcela e saldo residual.
- [ ] Implementar transação/RPC única para renovação de juros.
- [ ] Implementar transação/RPC única para despesas, cheques, reparcelamento e vendas de telefone.
- [ ] Criar restrição única por empresa, contrato e número de parcela. **Migration `0013_integridade_parcelas.sql` pronta; aguarda auditoria de duplicidades e execução no Supabase, que está recusando autenticação do conector.**
- [ ] Aplicar a migration `0014_integridade_assinaturas_financeiras.sql` após sua pré-auditoria: ela torna obrigatório o tenant/caixa dos pagamentos recorrentes, bloqueia competência duplicada e liga o movimento de Caixa ao pagamento. A aplicação já exige conta de Caixa, valor integral e compensa falhas de Caixa; a unicidade/RPC no banco segue pendente da execução controlada no Supabase.
- [x] Implantar conferência financeira somente leitura entre parcelas, despesas e livro-caixa; ela aponta ausência, valor divergente e provável duplicidade sem criar ajustes automáticos.
- [x] Padronizar todos os fluxos financeiros pelo calendário `America/Sao_Paulo`.

## Prioridade P3 — WhatsApp e controle operacional

- [x] Recuperar mensagens presas em `enviando` com lease vencido.
- [x] Persistir e mostrar ID da mensagem da Evolution em outbox e histórico.
- [x] Autenticar webhook Evolution e vincular evento à instância/empresa correta.
- [x] Mostrar na tela: aceita pela API, enviada, entregue, lida, falhou ou estado desconhecido.
- [x] Registrar relatório diário como concluído somente após aceite técnico confirmado pelo worker.
- [x] Limitar tentativas, alertar sobre instância desconectada e evitar reenvio indevido.

## Proteção HTTP complementar

- [x] Aplicar CSP de base, proteção contra clickjacking, MIME sniffing, referrer excessivo, permissões sensíveis e HSTS quando a requisição chegar por HTTPS.

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
