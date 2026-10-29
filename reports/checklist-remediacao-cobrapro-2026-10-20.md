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
- [x] Alterar o cookie de sessão para `SameSite=Lax`, preservando callback OAuth por GET e impedindo mutações autenticadas por formulário cross-site.
- [x] Rejeitar mutações públicas de autenticação iniciadas por `Origin`/`Sec-Fetch-Site` externo e remover o logout HTTP legado por `GET`.
- [x] Remover a promoção automática do primeiro cadastro público a administrador; perfis administrativos exigem provisionamento explícito.
- [x] Desabilitar por padrão o callback OAuth legado sem nonce/state vinculado; só pode ser reativado por configuração explícita durante migração controlada.
- [x] Minimizar logs de login: não há mais geolocalização por HTTP, IP bruto, coordenadas, ISP ou user-agent integral persistidos; o IP passa a ser apenas um identificador HMAC de auditoria.
- [x] Remover o agendamento de cinco minutos que fazia `force-push` em `main`; o workflow restante é manual, somente leitura e usa ação fixada por SHA.
- [x] Restringir o OIDC de automação ao arquivo exato do workflow de lembretes na branch `main`, além de repositório, audience e evento.
- [x] Limitar tentativas de login e recuperação por endereço/origem e e-mail, sem guardar esses dados em claro.
- [x] Armazenar tokens de recuperação apenas como hash SHA-256 no banco de dados.
- [x] Consumir token de recuperação condicionalmente no banco antes de alterar a senha, bloqueando uso concorrente do mesmo link.
- [ ] Revogar todas as sessões de uma conta após redefinição de senha. **Migration PostgreSQL `0016_revogacao_sessoes_reset_senha.sql` preparada: adiciona versão de sessão, trigger de defesa e RPC única para consumir token/trocar senha/revogar sessões. Exige preflight no Supabase COBRA PRO e rollout coordenado do backend; não foi aplicada.**
- [x] Remover a chave padrão da Evolution do código e exigir variável criptografada na DigitalOcean.
- [x] Remover artefatos compilados versionados e impedir que `dist/` volte ao repositório.
- [x] Restringir uploads de logo a PNG/JPG/WEBP de até 2 MB, verificar assinatura do arquivo e eliminar a rota de upload inexistente.
- [x] Separar o limite de 15 MB do upload autenticado dos corpos das rotas comuns (3 MB) e formulários (256 KB).
- [ ] Rotacionar credenciais administrativas e segredos expostos em histórico. **Depende de configuração segura de variáveis na DigitalOcean; não será exposto em chat.**
- [x] Remover chave padrão da Evolution API do código depois de confirmar a variável de ambiente de produção.
- [x] Fazer a autenticação de sessão falhar fechada quando `JWT_SECRET` estiver ausente; adicionar regressão contra HS256 com chave vazia.
- [x] Adicionar `GET /api/health` JSON de liveness, separado do fallback SPA, sem expor dados ou consultar o banco.
- [x] Neutralizar fórmulas em exportações CSV e remover `select *` dos módulos de backup de vendas/veículos.
- [x] Atualizar dependências de produção vulneráveis e substituir SheetJS por ExcelJS com exportações CSV/XLSX protegidas contra fórmulas. A auditoria de produção não possui achados críticos ou altos; há uma exceção moderada limitada a `uuid@8` transitivo do ExcelJS, documentada em `reports/fontes-atualizacao-dependencias-2026-10-29.md`.

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
- [x] Corrigir o preview do reparcelamento: valida contrato e data civil no tenant, limita entradas, usa `saldo_residual`, aplica mora configurada no contrato e gera datas conforme periodicidade; a execução continua bloqueada até RPC transacional.
- [x] Compensar integralmente falhas REST na renovação de juros: remove a nova parcela e a entrada de caixa da tentativa, restaura a parcela original e bloqueia avanço concorrente do contrato.
- [x] Aplicar contenção P0 no servidor para mutações financeiras REST não atômicas: recebimentos/renovações de parcelas, quitação/edição/exclusão de parcelas, baixa/estorno de despesas, transições de cheque, vendas de telefone e recebimentos de assinatura retornam `PRECONDITION_FAILED` até a RPC substituta. Consultas e conferência permanecem disponíveis.
- [ ] Aplicar e ativar a transação/RPC única para pagamento de parcela e saldo residual. **O servidor e todas as telas de baixa já estão preparados para chamar exclusivamente `rpc_registrar_pagamento_parcela`, com chave idempotente obrigatória, validação de resposta e sem fallback REST. A flag `ENABLE_RPC_RECEBIMENTO_PARCELA` permanece desligada por padrão: só pode ser ativada depois do preflight, aplicação controlada da migration `0015` e teste sintético de retry/concorrência no Supabase COBRA PRO.**
- [ ] Implementar transação/RPC única para renovação de juros.
- [ ] Implementar transação/RPC única para despesas, cheques, reparcelamento, vendas de telefone e assinaturas, com vínculo estrutural do evento ao livro-caixa, idempotência obrigatória, tenant, datas de Brasília e cobertura de falha/concorrência.
- [x] Fechar as transições inseguras de cheque no app: novos cheques exigem Caixa e vencimento civil válido; a taxa usa o período correto, compensação reverte para aguardando se o Caixa falhar e devolução/cancelamento aceitam somente cheque pendente. Movimentos novos usam identificador do cheque na descrição, permitindo estorno rastreável; cheques legados sem esse identificador são sinalizados para conferência e a RPC transacional permanece pendente.
- [x] Corrigir falso sucesso no caminho Drizzle de despesas: cancelar e excluir agora exigem que exatamente uma linha seja alterada, mantendo conflito explícito para estado inválido ou registro inexistente.
- [ ] Criar restrição única por empresa, contrato e número de parcela. **Migration `0013_integridade_parcelas.sql` falha se houver chave nula/duplicada e confere que não ficou índice parcial ou homônimo divergente; aguarda auditoria de dados e execução no Supabase.**
- [ ] Aplicar a migration `0014_integridade_assinaturas_financeiras.sql` após sua pré-auditoria: ela bloqueia chaves nulas, competência duplicada e vínculos de assinatura/cliente/caixa entre empresas, criando FKs compostas por tenant. A aplicação já exige conta de Caixa, valor integral e compensa falhas de Caixa; a unicidade/RPC no banco segue pendente da execução controlada no Supabase.
- [x] Implantar conferência financeira somente leitura entre parcelas, despesas e livro-caixa; ela aponta ausência, valor divergente e provável duplicidade sem criar ajustes automáticos.
- [x] Padronizar todos os fluxos financeiros pelo calendário `America/Sao_Paulo`.

## Prioridade P3 — WhatsApp e controle operacional

- [x] Recuperar mensagens presas em `enviando` com lease vencido.
- [x] Persistir e mostrar ID da mensagem da Evolution em outbox e histórico.
- [x] Autenticar webhook Evolution e vincular evento à instância/empresa correta.
- [x] Mostrar na tela: aceita pela API, enviada, entregue, lida, falhou ou estado desconhecido.
- [x] Registrar relatório diário como concluído somente após aceite técnico confirmado pelo worker.
- [x] Limitar tentativas, alertar sobre instância desconectada e evitar reenvio indevido.
- [x] Endurecer o intake do webhook: permitir somente eventos reconhecidos, validar e limitar atualizações, guardar resumo sem corpo/JID/mídia, confirmar HTTP somente após persistência e impedir regressão de `lido` para estados inferiores.
- [ ] Adicionar deduplicação estrutural por evento/status, vínculo único `(user_id, provider_message_id)` e fencing token de lease na outbox. **Exige migration controlada e pré-auditoria no Supabase COBRA PRO; o código atual já reduz replay e regressão, mas não substitui essa garantia de banco.**

## Proteção HTTP complementar

- [x] Aplicar CSP de base, proteção contra clickjacking, MIME sniffing, referrer excessivo, permissões sensíveis e HSTS quando a requisição chegar por HTTPS.
- [x] Remover o cabeçalho de fingerprint `X-Powered-By` do Express.

## Prioridade P4 — Kiwify (por último, conforme solicitado)

- [x] Validar assinatura oficial HMAC-SHA1 sobre o corpo bruto, em comparação de tempo constante; o endpoint falha fechado em ausência de segredo (503) ou assinatura inválida (401), antes de acessar banco, enviar e-mail ou criar conta.
- [x] Remover a redefinição de senha de conta existente e a senha temporária fixa. Uma conta nova recebe somente link individual de definição de senha, com token hash e expiração; reentrega nunca altera conta já existente.
- [x] Reservar o pedido antes de criar usuário/enviar e-mail e minimizar log novo para estado, produto e e-mail mascarado. Se o e-mail falhar, o evento fica pendente e só a conta criada por aquele mesmo pedido pode receber novo convite autenticado.
- [x] Cobrir vetor oficial HMAC, ausência de segredo, assinatura inválida, evento não aprovado e proteção de conta existente com testes automatizados.
- [ ] Aplicar `0017_integridade_webhook_kiwify.sql` depois de preflight no Supabase COBRA PRO. Ela bloqueia `order_id` vazio/duplicado e cria unicidade estrutural, necessária para garantir idempotência contra concorrência e replay. **Nenhum DDL foi aplicado ainda.**
- [ ] Rotacionar a chave de serviço Supabase e `JWT_SECRET` por terem sido encontrados em artefatos históricos do repositório; apagar os arquivos atuais é apenas contenção, não invalida cópias/histórico/sessões existentes.

## Critério de publicação

- [ ] `pnpm check`, testes direcionados e build aprovados.
- [ ] Checkpoint salvo antes de publicar.
- [ ] Commit enviado ao GitHub.
- [ ] Deploy concluído na DigitalOcean.
- [ ] Após deploy, teste no `cobrapro.online` com a conta real `koletor3`, sem criar dados financeiros fora de um fluxo de teste autorizado.
