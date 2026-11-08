# Checklist de remediação prioritária — CobraPro

**Início:** 20 de outubro de 2026  
**Regra solicitada:** correções Kiwify ficam por último.  
**Objetivo:** eliminar primeiro riscos de tomada de conta, alteração/vazamento entre empresas e corrupção operacional/financeira.

## Liberação operacional de 8/11/2026 — em integração

- [x] Renovar a captura privada de aplicação e comprovar duas restaurações PostgreSQL 17: 29 tabelas / 4.117 linhas idênticas; arquivos fora do Git.
- [x] Ensaiar hashes finais 0019/0020/0021/0022/0023/0024/0025 na cópia restaurada sem modificar qualquer uma das 4.117 linhas legadas; ACL/RLS preservadas.
- [x] Conter localmente criação/edição financeira antiga de contratos e multa manual; remover UPDATE da consulta de parcelas e derivar calendário só na apresentação. 24 testes direcionados aprovados.
- [x] Concluir integração e validação completa: 1.091 testes aprovados, 11 opt-in ignorados, TypeScript e build aprovados; DDL aditiva instalada no projeto correto.
- [x] Exercitar SQL produtivo sob service_role com dados sintéticos segregados: onboarding/criação/despesa/parcial/quitação/estorno e replay na mesma conta; ROLLBACK integral, zero operações de teste persistidas.
- [ ] Concluir checkpoint/push/deploy/flags dos fluxos prospectivos; não habilitar o recebimento legado para contornar 0013/0015.
- [ ] Confirmar assinantes SaaS elegíveis antes de liberar Blacklist: `assinaturas` atual é cobrança dos clientes, não acesso ao CobraPro. Nenhuma concessão automática.
- [x] Instalar base/concessões Blacklist e congelar escrita pela 0026 até backend privado live; zero registros/fotos/grants e nenhum acesso anon/authenticated.
- [ ] Concluir cópia durável fora do sandbox e preservação de Auth/Storage/objetos. Backup lógico de `public` não é backup total do projeto.

Evidências e gates em `reports/liberacao-operacional-2026-11-08.md`. Não declarar liberação global antes dos testes e rollout.

## Pré-auditoria produtiva de 6/11/2026 — acesso correto finalmente confirmado

- [x] Confirmar via conector o projeto correto `oxvtmibrgjruldkouhhb`, sem executar SQL no outro projeto.
- [x] Conter acesso direto público ao banco: migration `0018` aplicada em produção às 20h59 BRT; 29/29 tabelas com RLS, nenhuma acessível por `anon`/`authenticated` e backend `service_role` preservado. Teste PostgreSQL real de ACL, reaplicação e continuidade aprovado; dashboard autenticado recarregado sem alteração dos valores.
- [x] Inventariar schema e inconsistências sem ler segredos ou alterar o Caixa; evidências em `reports/pre-auditoria-produtiva-2026-11-06.md`.
- [ ] Sanear, com aprovação e evidência por registro, seis parcelas sem tenant/cliente, 12 entradas com tenant diferente da conta, três parcelas parciais sem residual e demais divergências de valor. **Não criar ajustes automáticos: as 18 diferenças de recebimentos versus Caixa incluem propriedade legada incorreta.**
- [x] Revalidar 0015/0016 contra fixtures compatíveis com os tipos relevantes do catálogo produtivo: reset `used`/`usado`, datas DATE, status VARCHAR/CHECK e `pgcrypto` em `extensions`; preflight obrigatório antes/depois do DDL. Não equivale a teste financeiro na base real.
- [x] Instalar somente a estrutura 0016 no projeto correto às 21h13 BRT: coluna/trigger/RPC/grants confirmados, 14 versões iniciais zero, sem consumo de token ou troca de senha.
- [ ] Ativar as flags em operações separadas: revogação exige teste coordenado; recebimentos exigem saneamento aprovado. 0013/0014/0015/0017 continuam não aplicadas.
- [ ] Provisionar com segurança a base PostgreSQL ausente da Blacklist e comprovar armazenamento privado; não liberar compartilhamento direto no banco. Kiwify ausente fica por último.

- [x] Preparar matriz restrita somente leitura com 43 itens de revisão / 38 registros distintos, ficha de proposta/aprovação vazia e manifesto verificado, fora do Git e sem PII. Não é backup integral nem autorização de saneamento.
- [x] Corrigir localmente base comum de carteira e calendário BRT do dashboard; residual inválido sinalizado sem inventar dívida e resumo independente do Caixa preservado. Suite final: 574 testes, 67 específicos também em Honolulu, TypeScript e build aprovados às 21h44 BRT. A publicação/smoke deste segundo lote é etapa separada.
- [x] Preparar 0019 base Blacklist backend-only e validar 21 verificações PostgreSQL locais, inclusive teto transacional de fotos, concorrência e reaplicação. **Não aplicada em produção; storage privado, descarte/compensação dos objetos e elegibilidade seguem pendentes.**
- [x] Publicar 89d8df78: deploy Success/Live confirmado às 21h52 BRT, saldo/contratos preservados e calendário/saúde de carteira carregados. O smoke identificou embed de clientes inválido nas listas; não declarar dashboard integralmente validado antes do ajuste seguinte.
- [x] Corrigir localmente listas sem depender de FK `parcelas.cliente_id` ausente: consulta de cliente por IDs e tenant explícito, completude obrigatória, sem inferência/backfill. Suite completa, 69 regressões de dashboard em Honolulu, TypeScript/build aprovados às 21h54 BRT.
- [x] Confirmar publicação `0a3a986` e smoke das listas de hoje/atrasadas após o ajuste: Live em 6/11 às 22h01 BRT; endpoint hoje retornou lista vazia válida, lista de atrasadas carregou e valores de Caixa/contratos permaneceram iguais.

- [ ] Obter backup integral recuperável antes de saneamento. Painel do projeto correto confirmou às 21h28 BRT que o plano Free não inclui backups e o resumo exibe No backups; nenhum upgrade ou restauração iniciado. Exportação parcial não substitui backup e teste de recuperação.

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
- [ ] Ativar revogação de todas as sessões após redefinição de senha. **Migration PostgreSQL `0016_revogacao_sessoes_reset_senha.sql` aplicada às 21h13 BRT no projeto correto e metadados/grants validados. O backend já tem emissão de JWT com snapshot de versão, validação estrita contra a conta persistida, proibição de bypass por prefixo cron e reset exclusivamente por RPC quando ativado. `ENABLE_SESSION_REVOCATION` segue desligada: falta ativação coordenada e teste com conta autorizada. Após ativação não desligar a validação como rollback, pois isso pode revalidar sessões revogadas.**
- [x] Validar 0014/0016/0017 atuais em PostgreSQL real descartável: 60 verificações, reaplicação, contratos `used`/`usado`, permissões do reset, rollback e concorrência aprovados. Corrigidos erro 42710 da 0014, nulabilidade de versão legada e índice/pedidos inválidos Kiwify. Runner em `tests/postgres-integrity/run.sh`; **0014/0017 não aplicadas em produção; somente a estrutura 0016 foi instalada após preflight**.
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
- [x] Conter enumeração na API da Blacklist compartilhada: busca somente CPF/CNPJ completo validado, DTO mascarado sem contato/endereço/valor/fotos, remoção de listagem geral e detalhes enumeráveis, URLs montadas somente para o autor. **Não comprova objeto privado no storage nem teto de fotos sob concorrência; tabelas-base também estão ausentes e esses itens continuam pendentes.**
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
- [x] Validar migrations 0013/0015 em PostgreSQL real descartável, duas aplicações integrais e preflight antes/depois: 17 grupos de pagamento, parcial, idempotência, isolamento, permissões, multa de Brasília, rollback e concorrência aprovados em 6/11. Corrigidos limites de array de índice e SELECT INTO de ROWTYPE; runner reproduzível em `tests/postgres-receipt/run.sh`. **Teste local não substitui inventário/schema produtivo.**
- [ ] Implementar transação/RPC única para renovação de juros.
- [ ] Implementar transação/RPC única para despesas, cheques, reparcelamento, vendas de telefone e assinaturas, com vínculo estrutural do evento ao livro-caixa, idempotência obrigatória, tenant, datas de Brasília e cobertura de falha/concorrência.
- [x] Fechar as transições inseguras de cheque no app: novos cheques exigem Caixa e vencimento civil válido; a taxa usa o período correto, compensação reverte para aguardando se o Caixa falhar e devolução/cancelamento aceitam somente cheque pendente. Movimentos novos usam identificador do cheque na descrição, permitindo estorno rastreável; cheques legados sem esse identificador são sinalizados para conferência e a RPC transacional permanece pendente.
- [x] Corrigir falso sucesso no caminho Drizzle de despesas: cancelar e excluir agora exigem que exatamente uma linha seja alterada, mantendo conflito explícito para estado inválido ou registro inexistente.
- [ ] Criar restrição única por empresa, contrato e número de parcela. **Migration `0013_integridade_parcelas.sql` falha se houver chave nula/duplicada e confere que não ficou índice parcial ou homônimo divergente; aguarda auditoria de dados e execução no Supabase.**
- [ ] Aplicar a migration `0014_integridade_assinaturas_financeiras.sql` após sua pré-auditoria: ela bloqueia chaves nulas, competência duplicada e vínculos de assinatura/cliente/caixa entre empresas, criando FKs compostas por tenant. A aplicação já exige conta de Caixa, valor integral e compensa falhas de Caixa; a unicidade/RPC no banco segue pendente da execução controlada no Supabase.
- [x] Implantar conferência financeira somente leitura entre parcelas, despesas e livro-caixa; ela aponta ausência, valor divergente e provável duplicidade sem criar ajustes automáticos.
- [ ] Concluir calendário `America/Sao_Paulo` em todos os indicadores e fluxos. A multa diária e os cenários da RPC de recebimento têm regressões aprovadas; ainda há janelas UTC em consultas do dashboard e caminhos legados a revisar. Não declarar todos os calendários validados apenas pelos testes de recebimento.

## Prioridade P3 — WhatsApp e controle operacional

- [x] Recuperar mensagens presas em `enviando` com lease vencido.
- [x] Persistir e mostrar ID da mensagem da Evolution em outbox e histórico.
- [x] Autenticar webhook Evolution e vincular evento à instância/empresa correta.
- [x] Mostrar na tela: aceita pela API, enviada, entregue, lida, falhou ou estado desconhecido.
- [x] Registrar relatório diário como concluído somente após aceite técnico confirmado pelo worker.
- [x] Limitar tentativas, alertar sobre instância desconectada e evitar reenvio indevido.
- [x] Endurecer o intake do webhook: permitir somente eventos reconhecidos, validar e limitar atualizações, guardar resumo sem corpo/JID/mídia, confirmar HTTP somente após persistência e impedir regressão de `lido` para estados inferiores.
- [ ] Adicionar deduplicação estrutural por evento/status, vínculo único `(user_id, provider_message_id)` e fencing token de lease na outbox. **Exige migration controlada e pré-auditoria no Supabase COBRA PRO; o código atual já reduz replay e regressão, mas não substitui essa garantia de banco.**
- [x] Preparar callbacks Evolution com segredo em cabeçalho e compatibilidade legada reversível. **Validado no código; retirada da query e configuração TLS aguardam conferência nas instâncias reais.**
- [x] Centralizar Brevo com timeout, resultado tipado e logs sem conteúdo/PII; exigir persistência do token antes de enviar recuperação de senha e separar entrega indeterminada de rejeição.
- [x] Impedir reenvio cego de convite Kiwify após timeout e aquisição concorrente de retry; validar destinatário contra a conta vinculada. **Unicidade de pedido novo continua dependente da migration 0017.**

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

## Critério de publicação — lote de segurança 07444cb

- [x] `pnpm check`, suite completa (507 testes aprovados, 11 opt-in ignorados), runners PostgreSQL e build aprovados em 6/11 às 21h11 BRT.
- [x] Checkpoint `6a47d722` salvo antes de publicar, com conteúdo igual ao tree validado.
- [x] Commit enviado ao GitHub por push normal como `07444cb`, preservando histórico remoto.
- [x] Deploy DigitalOcean `048dc812-40dd-46d6-b969-673fce8b99fb` confirmado Success / Live Deployment às 21h24 BRT.
- [x] Dashboard recarregado com sessão existente e valores preservados; health/site/Evolution HTTP 200; reset com token comprovadamente inexistente retorna 400, sem trocar senha. Não é validação de todas as operações financeiras, que continuam bloqueadas.
