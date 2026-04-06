# CobraPro - TODO

## Fase 1: Schema e Estrutura Base
- [x] Schema do banco de dados (clientes, contratos, parcelas, caixa, contas)
- [x] Migrations e seed inicial
- [x] Routers tRPC base (clientes, contratos, parcelas, caixa)
- [x] Helpers de cálculo financeiro (juros, multas, amortização)

## Fase 2: Tema e Layout
- [x] Tema Dark Mode com paleta de cores CobraPro
- [x] DashboardLayout com sidebar e navegação
- [x] Rotas principais configuradas no App.tsx
- [x] Componentes base (KPICard, StatusBadge, DataTable)

## Fase 3: Dashboard e Clientes
- [x] Dashboard com KPIs (Saldo, Capital, A Receber, Inadimplência, Juros, Vence Hoje)
- [x] Gráficos de fluxo de caixa e inadimplência
- [x] Listagem de clientes com busca e filtros
- [x] Formulário de cadastro de cliente (CPF/CNPJ, telefone, WhatsApp, PIX)
- [x] Score de crédito interno visual
- [x] Histórico unificado de contratos do cliente

## Fase 4: Contratos e Parcelas
- [x] Listagem de contratos com filtros por modalidade e status
- [x] Formulário de novo contrato (Padrão, Diário, Price, Produto, Cheque)
- [x] Cálculo automático de parcelas e juros
- [x] Listagem de parcelas com status visual (Pendente/Paga/Atrasada/Vencendo)
- [x] Modal de baixa de pagamento (parcial, total, com desconto)
- [x] Ação rápida de cobrança via WhatsApp

## Fase 5: Caixa, Calendário e Relatórios
- [x] Gestão de contas bancárias/caixas
- [x] Registro de transações (entradas/saídas manuais)
- [x] Saldo em tempo real por conta
- [x] Calendário de cobranças com status por cores
- [x] Relatório de empréstimos
- [x] Relatório de inadimplência
- [x] Relatório de fluxo de caixa
- [x] Fechamento diário
- [ ] Exportação em PDF (fase futura)

## Fase 6: Portal do Cliente e Integrações
- [x] Portal do cliente via Magic Link (BREVO)
- [x] Visualização de parcelas no portal
- [x] Copiar chave PIX no portal
- [x] Integração WhatsApp Business API (templates de cobrança)
- [x] Integração BREVO (Magic Links, lembretes, relatórios) — configurável via Configurações

## Fase 7: Qualidade e Entrega
- [x] Testes Vitest para routers principais (12 testes passando)
- [x] Responsividade mobile testada
- [x] Checkpoint final

## Fase 8: Melhorias Fase 2 (Auditoria)
- [x] Schema: tabela de koletores/usuários internos
- [x] Schema: tabela de reparcelamentos (contratoOrigemId)
- [x] Schema: campos de limite de crédito e categoria em clientes
- [x] Schema: templates WhatsApp avançados (tipos adicionais)
- [x] Módulo de Koletores com CRUD e perfis (admin/gerente/koletor)
- [x] Relatório de performance por koletor (mês/ano)
- [x] Sistema de Reparcelamento com preview e execução
- [x] Dashboard: barra de saúde da carteira com taxa de inadimplência
- [x] Dashboard: taxa de inadimplência % no KPI
- [x] Dashboard: contagem de contratos ativos no KPI
- [x] Menu lateral: Koletores e Reparcelamento adicionados
- [x] TypeScript: 0 erros em toda a base de código
- [x] Testes: 12 testes passando após todas as mudanças
- [ ] Clientes: importação em lote via CSV (fase futura)
- [ ] Contratos: geração de contrato em PDF (fase futura)
- [ ] Dashboard: top 5 clientes do período (fase futura)
- [ ] Caixa: transferência entre contas (fase futura)
- [ ] Caixa: ajuste manual de saldo (fase futura)

## Fase 9: Novas Funcionalidades
- [ ] Remover login Manus e implementar autenticação própria (email/senha)
- [ ] Importação de base de dados via CSV na tela de Clientes
- [ ] Geração de contrato em PDF com dados do cliente e parcelas

## Fase 10: Sistema 100% Funcional
- [ ] Autenticação própria email/senha (sem Manus OAuth)
- [ ] Rotas POST /api/auth/login e /api/auth/register no servidor
- [ ] Criar usuário admin koletor3@gmail.com / 97556511
- [ ] Página inicial com layout da página de vendas CobraPro
- [ ] Tela de login própria com email/senha
- [ ] Todos os módulos com dados 100% dinâmicos do banco
- [ ] Importação de base de dados via CSV (clientes)
- [ ] Geração de contrato em PDF

## Fase 11: WhatsApp + Renomear Usuários
- [ ] Renomear Koletores → Usuários em todo o sistema (menu, páginas, routers)
- [ ] Configuração de WhatsApp na tela de Configurações (API Key, número, status)
- [ ] Templates dinâmicos de cobrança com variáveis (nome, valor, data, PIX)
- [ ] Envio de cobrança via WhatsApp direto das Parcelas
- [ ] Preview do template antes de enviar

## Fase 12: Logo + Dados Reais + Funcionalidades Cobra Fácil Completas
- [x] Upload logo CobraPro em alta definição para CDN
- [x] Logo no sidebar/DashboardLayout
- [x] Logo na landing page (Home.tsx)
- [x] Logo na tela de login
- [x] Configurar dados da empresa (koletor3)
- [x] Criar 5 clientes reais de teste
- [x] Criar contratos e empréstimos reais de teste
- [x] Simulador de Empréstimos (calculadora interativa)
- [x] Contas a Pagar (módulo completo)
- [x] Desconto de Cheques (módulo completo)
- [x] Vendas de Produtos (módulo completo)
- [x] Empréstimos Diários (modalidade - já existia)
- [x] Tabela Price (modalidade com cálculo PMT - já existia)
- [x] Testar fluxo completo de cobrança via WhatsApp

## Fase 13: Sugestões + Auditoria Completa
- [x] Desconto de Cheques (módulo completo com schema, router, página)
- [x] Exportação de Contrato em PDF (jsPDF client-side com download direto)
- [x] Importação CSV de Clientes (já estava implementada)
- [x] Auditoria completa do código (bugs, UX, consistência, segurança)
- [x] Corrigir todos os problemas encontrados na auditoria

## Fase 14: Correção de Bug Crítico
- [x] Corrigir skeleton infinito no domínio publicado (usuário não autenticado fica preso no loading)

## Fase 15: Recuperação de Senha + Landing Page
- [ ] Implementar recuperação de senha (esqueci minha senha) com token temporário
- [ ] Reconstruir landing page fiel ao design original cobrapro.online (todas as seções do vídeo)

## Fase 16: Correções Críticas + Funcionalidades Cobra Fácil
- [ ] Corrigir erro removeChild (crash ao navegar entre páginas)
- [ ] Cadastro de clientes robusto: 3 abas (Dados Pessoais, Endereço, Documentos), avatar, foto, CPF/CNPJ/RG, Instagram, Facebook, Profissão
- [ ] Score de Clientes (pontuação de pagamento)
- [ ] Veículos Registrados (financiamento de veículos)
- [ ] Backup de Dados (exportar dados em CSV/JSON)
- [ ] Aulas do App (tutoriais/onboarding)
- [ ] Relatório de Empréstimos (separado do relatório geral)
- [ ] Suporte destacado no menu lateral (+55 11 96419-2613)
- [ ] Landing page fiel ao design original cobrapro.online

## Fase 17: Recuperação de Senha + Primeiro Acesso Admin
- [ ] Página /recuperar-senha com formulário de e-mail
- [ ] Endpoint tRPC para gerar token de reset e enviar e-mail via Brevo
- [ ] Página /nova-senha/:token para definir nova senha
- [ ] Criar usuário admin koletor3@gmail.com via endpoint protegido

## Fase 18: Integração Brevo + Deploy Produção
- [x] Criar remetente CobraPro (noreply@cobrapro.online) no Brevo
- [x] Implementar envio de e-mail de recuperação de senha via Brevo API
- [x] Criar página /recuperar-senha com formulário de e-mail
- [x] Criar página /reset-senha com formulário de nova senha e indicador de força
- [x] Registrar rotas /recuperar-senha e /reset-senha no App.tsx
- [x] Habilitar endpoint /api/auth/seed-admin em produção (protegido por secret)
- [x] Adicionar BREVO_API_KEY ao .do/app.yaml (Digital Ocean)
- [x] Confirmar admin koletor3@gmail.com existente no banco de produção

## Fase 19: Correção de Conexão com Banco de Dados
- [x] Adicionar tratamento global de erros não capturados (uncaughtException/unhandledRejection)
- [x] Adicionar try/catch em todas as rotas de autenticação (authRoutes.ts)
- [x] Reescrever db.ts com fallback Supabase REST API (HTTPS) quando PostgreSQL direto falha
- [x] Adicionar SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY às variáveis de ambiente
- [x] Testes de conexão Supabase REST API passando (14 testes)
- [ ] Deploy no Digital Ocean com novas variáveis de ambiente
- [ ] Verificar que o app está funcionando em produção

## Fase 20: Formulário de Clientes Completo + Upload de Foto/Documentos

- [x] Migrar schema: adicionar colunas rg, cnpj, instagram, facebook, profissao, foto_url, documentos_urls
- [x] Reescrever modal de cadastro de clientes com 3 abas (Dados Pessoais / Endereço / Documentos)
- [x] Avatar automático com iniciais coloridas + upload de foto (S3)
- [x] Campos separados: CPF, CNPJ, RG
- [x] Campos de redes sociais: Instagram, Facebook
- [x] Campo de Profissão
- [x] Aba Documentos: upload de arquivos (S3) com preview
- [x] Atualizar procedures tRPC (clientes.create, clientes.update) com novos campos
- [x] Cadastrar 3 clientes simulados: João Carlos Silva, Ana Paula Ferreira, Roberto Oliveira Santos
- [x] Aplicar migração das colunas faltantes no Supabase PostgreSQL (sexo, estado_civil, nome_mae, nome_pai, data_nascimento, documentos_urls)

## Fase 21: Empréstimo Quinzenal 50% + Pagamento Parcial (Só Juros)
- [x] Corrigir erros TypeScript no reparcelamento (totalContrato faltando)
- [x] Corrigir parcelas.list para mostrar nome do cliente corretamente
- [x] Criar contrato 50% quinzenal (R$500 → paga R$750 total ou R$250 só juros)
- [x] Implementar opção de pagamento parcial (somente juros) no modal de pagamento
- [x] Testar fluxo completo: pagamento total e somente juros

## Fase 22: Periodicidades Completas + Pagamento Parcial
- [ ] Adicionar Diário, Semanal, Quinzenal, Mensal no enum tipoTaxa (routers.ts)
- [ ] Adicionar Diário, Semanal, Quinzenal, Mensal no select do NovoContrato
- [ ] Adicionar Diário, Semanal, Quinzenal, Mensal no Simulador
- [ ] Corrigir cálculo de datas: semanal = +7 dias, quinzenal = +15 dias
- [ ] Exibir periodicidade correta na lista de contratos
- [ ] Botões rápidos no modal de pagamento: "Pagar Total" e "Só Juros"
- [ ] Criar contrato 50% quinzenal R$500 e testar pagamento

## Fase 23: Caixa Livre + Lançamentos Manuais
- [ ] Remover validação de saldo do caixa ao criar contratos/empréstimos
- [ ] Adicionar botão "Adicionar Saldo" (entrada manual) na página de Caixa
- [ ] Adicionar botão "Debitar Saldo" (saída manual) na página de Caixa
- [ ] Fallback REST para caixa.transacoes (listagem de transações)
- [ ] Corrigir exibição de saldo real nas contas (usar campo saldo do Supabase)

## Fase 24: Correção Cálculo Pagamento Total
- [x] Corrigir botão "Pagar Total": deve mostrar capital + juros (ex: R$500 capital + R$250 juros = R$750 total)
- [x] Corrigir botão "Só Juros": deve mostrar apenas os juros (ex: R$250)
- [x] O valor da parcela já inclui capital+juros? Verificar lógica de cálculo

## Auditoria Cobra Fácil - Funcionalidades a Implementar

- [ ] Corrigir cálculo Pagar Total: valor_parcela = capital/n + juros (ex: R$750 = R$500 capital + R$250 juros)
- [ ] Corrigir botão Só Juros: mostrar apenas os juros do período (ex: R$250)
- [ ] Score de clientes (0-100): bom/mau pagador baseado em histórico de pagamentos
- [ ] Cards coloridos por status: azul=diário, amarelo=renegociado, verde=pago, vermelho=atraso
- [ ] Calendário de cobranças com vencimentos por dia (visualização mensal)
- [ ] Recálculo inverso de taxa: digitar valor da parcela → sistema calcula a taxa de juros
- [ ] Pagamento parcial melhorado: opção "cliente pagou só os juros" com renegociação automática
- [ ] Exportação PDF de contratos e relatórios
- [ ] Exportação CSV de clientes e empréstimos
- [ ] Contas a pagar (despesas operacionais do credor)
- [ ] Resumo semanal no dashboard
- [ ] Notificações WhatsApp automáticas (vencimentos, atrasos)
- [ ] Comprovantes automáticos em PDF ao registrar pagamento
- [ ] Gestão de funcionários/koletores
- [ ] Backup de dados

## Fase 25: Empréstimo Renovável (Bullet)

- [x] Cálculo correto: valor_total = capital × (1 + taxa/100), ex: R$1.000 × 1.5 = R$1.500
- [x] Botão "Pagar Total" no modal de parcelas: capital + juros (ex: R$1.500)
- [x] Botão "Renovar (Só Juros)": paga apenas os juros (ex: R$500) e gera nova parcela +15 dias automaticamente
- [x] Procedure parcelas.pagarJuros: marca parcela como paga (juros), cria nova parcela com vencimento +periodicidade
- [x] Testar fluxo completo: criar contrato renovável, pagar total, renovar

## Fase 26: Card de Empréstimo estilo Cobra Fácil

- [x] Nova página /emprestimos com cards estilo Cobra Fácil
- [x] Card: avatar com iniciais + badge status (Atrasado/Quinzenal/Mensal/Diário)
- [x] Card: valor "Restante a receber" em destaque
- [x] Card: grid Emprestado / Total a Receber / Lucro Previsto / Lucro Realizado (com %)
- [x] Card: Venc: data · Pago: valor
- [x] Card: linha "Só Juros (por parcela)"
- [x] Card: bloco parcela em atraso com dias, vencimento, valor original, juros acumulados, total com atraso
- [x] Card: botão "Cobrar Atraso (WhatsApp)" (abre WhatsApp com mensagem pré-formatada)
- [x] Card: barra inferior com botões: Pagar · Pagar Juros · WhatsApp · Histórico · Novo
- [x] Procedure contratos.listComParcelas: calcular juros de atraso em tempo real, lucro realizado, só juros por parcela
- [x] Procedure parcelas.pagarJuros: paga só juros e gera nova parcela +periodicidade automaticamente
- [x] KPIs no topo: Atrasados, Em Dia, Capital na Rua, Total a Receber
- [x] Filtro por status e busca por nome de cliente
- [x] Histórico expandível de parcelas por empréstimo

## Fase 27: Multa por Atraso Configurável + Pasta do Cliente

- [x] Procedure configuracoes.get/set para salvar multa_diaria_atraso (R$/dia)
- [x] Tabela configuracoes no banco (chave/valor por usuário)
- [x] Campo de multa/dia na tela de Configurações
- [x] Usar multa configurada no cálculo de juros por atraso nos cards de Empréstimos
- [x] Pasta do Cliente: agrupar empréstimos por clienteId na página /emprestimos
- [x] Card de Pasta: nome do cliente, total de empréstimos, capital total, total a receber
- [x] Badge "Atrasado" para mostrar quantos empréstimos estão com atraso
- [x] KPIs da Pasta: capital total, total a receber, parcelas atrasadas


## Fase 28: Score de Clientes (CRÍTICA)
- [x] Adicionar coluna score (INTEGER) na tabela clientes
- [x] Procedure clientes.listarComScore: retorna clientes ordenados por score
- [x] Nova página /scores com ranking visual
- [x] Cards de cliente com score, badge (Excelente/Bom/Regular/Ruim), histórico
- [x] Filtro por score e por lucro
- [x] Menu lateral atualizado com "Score de Clientes"

## Fase 29: Veículos Registrados (ALTA)
- [x] Schema: tabela veiculos (marca, modelo, placa, renavam, chassi, comprador, valor, entrada, parcelas)
- [x] Schema: tabela parcelas_veiculo (veiculoId, numero, valor, vencimento, status, pago_em)
- [x] Nova página /veiculos com KPIs e listagem
- [x] Formulário de novo veículo (3 abas: Dados, Comprador, Financeiro)
- [x] Cards de veículo com status, comprador, valor, parcelas
- [x] Menu lateral atualizado com "Veículos"
- [ ] Procedure veiculos.criar: criar novo veículo com parcelas
- [ ] Procedure veiculos.listar: listar veículos com filtros
- [ ] Procedure parcelas_veiculo.pagar: registrar pagamento
- [ ] Gerar contrato em PDF

## Fase 30: Comprovante em PDF (MÉDIA)
- [x] Integração jsPDF + html2canvas para geração de PDF
- [x] Utility gerarComprovante.ts com template HTML profissional
- [x] Função gerarComprovantePDF() para download automático
- [ ] Envio automático por email via Brevo
- [ ] Envio automático por WhatsApp
- [ ] Armazenamento em S3 com link permanente
- [ ] Página de histórico de comprovantes

## Fase 31: Backup de Dados (BAIXA)
- [x] Página /backup com interface de exportação
- [x] Seleção de tabelas para exportar
- [x] Exportação em CSV
- [x] Exportação em JSON
- [x] Agendamento de backup automático (UI)
- [x] Histórico de backups
- [x] Menu lateral atualizado com "Backup"
- [x] Aviso de segurança para dados sensíveis
