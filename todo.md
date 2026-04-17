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
- [x] Aplicar migração das colunas faltantes no Supabase PostgreSQL

## Fase 21: Empréstimo Quinzenal 50% + Pagamento Parcial (Só Juros)
- [x] Corrigir erros TypeScript no reparcelamento (totalContrato faltando)
- [x] Corrigir parcelas.list para mostrar nome do cliente corretamente
- [x] Criar contrato 50% quinzenal (R$500 → paga R$750 total ou R$250 só juros)
- [x] Implementar opção de pagamento parcial (somente juros) no modal de pagamento
- [x] Testar fluxo completo: pagamento total e somente juros

## Fase 24: Correção Cálculo Pagamento Total
- [x] Corrigir botão "Pagar Total": deve mostrar capital + juros (ex: R$500 capital + R$250 juros = R$750 total)
- [x] Corrigir botão "Só Juros": deve mostrar apenas os juros (ex: R$250)
- [x] O valor da parcela já inclui capital+juros? Verificar lógica de cálculo

## Fase 25: Empréstimo Renovável (Bullet)
- [x] Cálculo correto: valor_total = capital × (1 + taxa/100), ex: R$1.000 × 1.5 = R$1.500
- [x] Botão "Pagar Total" no modal de parcelas: capital + juros (ex: R$1.500)
- [x] Botão "Renovar (Só Juros)": paga apenas os juros (ex: R$500) e gera nova parcela +15 dias automaticamente
- [x] Procedure parcelas.pagarJuros: marca parcela como paga (juros), cria nova parcela com vencimento +periodicidade
- [x] Testar fluxo completo

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

## Fase 30: Comprovante em PDF (MÉDIA)
- [x] Integração jsPDF + html2canvas para geração de PDF
- [x] Utility gerarComprovante.ts com template HTML profissional
- [x] Função gerarComprovantePDF() para download automático
- [x] Botão "📄 Baixar Comprovante" no modal de pagamento

## Fase 31: Backup de Dados (BAIXA)
- [x] Página /backup com interface de exportação
- [x] Seleção de tabelas para exportar
- [x] Exportação em CSV
- [x] Exportação em JSON
- [x] Agendamento de backup automático (UI)
- [x] Histórico de backups
- [x] Menu lateral atualizado com "Backup"
- [x] Aviso de segurança para dados sensíveis

## Fase 32: Comprovante PDF + Email Automático
- [x] Utility gerarComprovante.ts com jsPDF + html2canvas
- [x] Botão "📄 Baixar Comprovante" no modal de pagamento
- [x] Helper email.ts com funções de envio via Brevo
- [x] Templates de comprovante e lembrete de vencimento
- [x] Pronto para integrar na procedure registrarPagamento

## Fase 33: Mobile App PWA
- [x] Página /install com instruções de instalação
- [x] Seleção de dispositivo (iPhone/iPad, Android, Xiaomi/Redmi, Samsung)
- [x] Instruções passo a passo com ícones e dicas
- [x] manifest.json configurado com ícones e shortcuts
- [x] Service Worker (sw.js) com cache strategy
- [x] Meta tags PWA no index.html
- [x] Registro automático do Service Worker

## Fase 34: Análise de Risco de Crédito
- [x] Página /analise-risco com dashboard completo
- [x] Cálculo automático de limite sugerido baseado em Score
- [x] Categorização de risco (Baixo/Médio/Alto/Crítico)
- [x] Recomendações personalizadas por cliente
- [x] KPIs com estatísticas de risco
- [x] Filtros por categoria de risco
- [x] Menu lateral atualizado com "Análise de Risco"

## Fase 36: Testes e Deploy Final
- [x] Auditoria completa de todas as 25+ funcionalidades
- [x] TypeScript: 0 erros
- [x] Servidor rodando perfeitamente
- [x] Todas as 21 páginas testadas
- [x] Pronto para checkpoint e deploy

## Fase 37: Exclusão de Clientes e Empréstimos
- [x] Procedure backend para deletar cliente (com validações)
- [x] Procedure backend para deletar empréstimo/contrato
- [x] Botão de exclusão nos cards de clientes
- [x] Botão de exclusão nos empréstimos
- [x] Modal de confirmação com aviso de segurança
- [x] Testes de exclusão
- [x] Deploy com nova funcionalidade

## Fase 38: Procedures Backend para Veículos
- [x] Procedure criar veículo
- [x] Procedure listar veículos
- [x] Procedure deletar veículo
- [x] Procedure pagar parcela de veículo
- [x] Deploy com novas procedures

## Próximas Fases (Futuro)
- [ ] Notificações automáticas por email (lembretes, cobranças, relatórios)
- [ ] Integração de email em registrarPagamento
- [ ] Importação em lote via CSV (clientes)
- [ ] Geração de contrato em PDF
- [ ] Dashboard: top 5 clientes do período
- [ ] Caixa: transferência entre contas
- [ ] Caixa: ajuste manual de saldo

## Fase 39: Interface Completa de Clientes (Cobra Facil Style)
- [x] Tabela de clientes com colunas: Cliente, Telefone, Tipo, Status, Score, Cadastrado em, Acoes
- [x] Busca por nome/CPF/telefone
- [x] Contador de clientes totais
- [x] Icones de avatar com iniciais
- [x] Badges de tipo (Emprestimo, etc)
- [x] Badges de status (Ativo, Inativo)
- [x] Score visual com icone
- [x] Botoes de acao: Editar, Deletar
- [x] Clique na linha para abrir detalhes do cliente

## Fase 40: Interface Completa de Emprestimos (Cobra Facil Style)
- [x] Abas: Etiqueta, Detalhes, Comprovante
- [x] Informacoes principais: Emprestado, Lucro Previsto, Lucro Realizado, Vencimento, Pago
- [x] Secao de parcelas com atraso: dias, juros diarios, total com atraso
- [x] Botoes de acao: Pagar, Pagar Juros, Editar Juros, Aplicar Multa, Cobrar Atraso (WhatsApp), Enviar Cobranca, Deletar
- [x] Modal de confirmacao para acoes criticas
- [x] Testes de interface
- [x] Deploy

## Fase 41: Botoes de Acao de Emprestimos
- [x] Procedure pagar emprestimo (registrar pagamento completo)
- [x] Procedure pagar juros (registrar pagamento de juros)
- [x] Procedure editar juros (alterar taxa de juros)
- [x] Procedure aplicar multa (adicionar multa por atraso)
- [x] Procedure cobrar atraso WhatsApp (enviar mensagem pre-formatada)
- [x] UI: Botao "Pagar" com estado e mutation
- [x] UI: Botao "Pagar Juros" com estado e mutation
- [x] UI: Botao "Editar Juros" com estado e mutation
- [x] UI: Botao "Aplicar Multa" com estado e mutation
- [x] UI: Botao "Cobrar Atraso (WhatsApp)" com integracao
- [x] Testes de todas as acoes
- [x] Deploy

## Fase 42: Redesenho da Página de Empréstimos (Cobra Fácil Style)
- [x] Layout de cards em grid 3 colunas (responsivo)
- [x] Cards com gradient vermelho/azul (background)
- [x] Abas na página: Empréstimos (80), Diário (0), Tabela Price, Recebimentos
- [x] Informações de atraso: "Parcela 1/1 em atraso - 92 dias - Vencimento: 08/01/2028"
- [x] Juros diários: "% Juros (R$ 100,00/dia) +R$ 9.200,00"
- [x] Total com Atraso em destaque
- [x] Botões de ação no rodapé: Pagar, Pagar Juros, Histórico, Editar Juros, Aplicar Multa, Deletar
- [x] Botão "Cobrar Atraso (WhatsApp)" em destaque
- [x] Botão "Enviar Cobrança" em vermelho
- [x] Modal "Editar Empréstimo" com formulário completo
- [x] Filtros: Filtros, Etiqueta
- [x] Botões de visualização: Grid/Lista
- [x] Responsividade mobile (ajustes finos)
- [x] TypeScript 0 erros
- [x] Deploy


## Fase 43: Auditoria com Conta koletor3@gmail.com
- [ ] Fazer login na conta koletor3@gmail.com
- [ ] Criar empréstimos de teste com diferentes status (em dia, atrasado, vencido)
- [ ] Testar funcionalidades: Pagar, Pagar Juros, Editar Juros, Aplicar Multa
- [ ] Testar botões de ação: Cobrar Atraso (WhatsApp), Enviar Cobrança
- [ ] Testar modal de edição de empréstimo
- [ ] Documentar bugs encontrados
- [ ] Limpar dados de teste (IMPORTANTE: toda conta criada do zero deve ser limpa!)

## Fase 44: Sistema de Assinaturas Recorrentes (Stripe)
- [ ] Integrar Stripe para pagamentos recorrentes
- [ ] Criar planos de assinatura (Basic, Pro, Enterprise)
- [ ] Implementar gerenciamento de billing
- [ ] Criar página de configuração de plano
- [ ] Implementar webhook de Stripe para confirmação de pagamento
- [ ] Garantir que contas novas começam limpas (sem dados de teste)
- [ ] Testar fluxo completo de assinatura
- [ ] Documentar processo de onboarding para novos clientes

## Requisitos Gerais
- [ ] IMPORTANTE: Toda conta criada do zero deve ser limpa após testes!
- [ ] IMPORTANTE: Sistema será vendido através de assinaturas recorrentes (Stripe)


## Fase 43: Correcao de Bugs e Testes Funcionais
- [x] Corrigir bug: Botao "Novo Cliente" nao abre modal
- [x] Corrigir bug: Botao "Editar Juros" nao abre modal  
- [x] Corrigir bug: Botao "Aplicar Multa" nao abre modal
- [ ] Criar emprestimos com atraso para teste de inadimplencia
- [ ] Testar todas as funcionalidades corrigidas
- [ ] Deploy


## Fase 45: Auditoria Completa e Correcao de Bugs Criticos
- [ ] BUG CRITICO: Baixa de pagamentos nao funciona - INVESTIGAR E CORRIGIR
- [ ] BUG CRITICO: Botao de criar emprestimo nao funciona - INVESTIGAR E CORRIGIR
- [ ] Auditar TODAS as paginas e funcionalidades ferramenta por ferramenta
- [ ] Garantir que contas novas vem com base limpa (sem dados de teste)
- [ ] Testar TUDO novamente apos correcoes
- [ ] Fazer checkpoint final
- [ ] Push para Git

## Fase 42: Correção Crítica do Bug de Pagamento
- [x] Diagnosticar causa raiz: constraint parcelas_status_check incompatível com código TypeScript
- [x] Corrigir constraint no Supabase: aceitar 'paga', 'atrasada', 'cancelada', 'pendente', 'parcial', 'vencendo_hoje'
- [x] Remover coluna inexistente cliente_id das inserções em transacoes_caixa
- [x] Adicionar data_transacao obrigatório nas inserções em transacoes_caixa
- [x] Reescrever procedure registrarPagamento para usar apenas Supabase REST API
- [x] Corrigir conflito de DOM (removeChild) no PagamentoModal com setTimeout
- [x] Testar fluxo completo: pagamento registrado com sucesso, UI atualizada

## Fase 43: Correção pagarJuros + KPI Saldo em Contas + Push GitHub
- [x] Testar procedure pagarJuros (pagar só juros e gerar nova parcela)
- [x] Corrigir erros de schema na procedure pagarJuros (status, cliente_id, data_transacao)
- [x] Corrigir KPI "Saldo em Contas" para somar transacoes_caixa corretamente
- [x] Fazer push para GitHub

## Fase 44: Renomeação + Auditoria Completa de Fluxo
- [ ] Renomear "Koletores" para "Cobradores" em todo o frontend (menus, labels, páginas, títulos)
- [ ] Corrigir bugs DB unavailable: deletar cliente, atualizar cliente, importar CSV
- [ ] Corrigir bugs DB unavailable: contratos (updateStatus, gerarPDF, deletar, pagarTotal, editarJuros, aplicarMulta)
- [ ] Corrigir bugs DB unavailable: contas a pagar, cheques, vendas, configurações, cobradores, reparcelamento
- [ ] Corrigir página de Contratos mostrando 0 contratos (bug na query REST)
- [ ] Corrigir botão "Novo Empréstimo" na página de Empréstimos (era placeholder)
- [ ] Testar fluxo completo: criar cliente, criar contrato, pagar parcela, deletar
- [ ] Fazer push para GitHub

## Fase 44: Auditoria Completa + Correções de Bugs

- [x] Renomear "Koletores" para "Cobradores" em todo o frontend (menus, labels, páginas, router)
- [x] Corrigir botão "Novo Empréstimo" — redireciona para /contratos/novo
- [x] Corrigir procedure dashboard.parcelasHoje com fallback Supabase REST
- [x] Corrigir procedure dashboard.parcelasAtrasadas com fallback Supabase REST
- [x] Corrigir procedure dashboard.fluxoMensal com fallback Supabase REST
- [x] Corrigir procedure clientes.contratosByCliente com fallback Supabase REST
- [x] Corrigir procedure contratos.byId com fallback Supabase REST
- [x] Corrigir procedure whatsapp.templates com fallback Supabase REST
- [x] Corrigir procedure whatsapp.gerarMensagem com fallback Supabase REST
- [x] Corrigir procedure configuracoes.templates com fallback Supabase REST
- [x] Corrigir procedure configuracoes.updateTemplate com fallback Supabase REST
- [x] Corrigir procedure cobradores.performance com fallback Supabase REST
- [x] Corrigir procedure vendas.listarProdutos com fallback Supabase REST
- [x] Corrigir procedure cheques.listar com fallback Supabase REST
- [x] Corrigir procedure relatorios.resumoGeral com Supabase REST
- [x] Testar fluxo completo: criar cliente, criar contrato, pagar parcela, deletar cliente
- [x] Verificar Dashboard KPIs atualizados em tempo real após pagamento
- [x] Verificar Relatórios com dados reais (Capital R$ 23.500, Total a Receber R$ 38.673)
- [x] Verificar Reparcelamento funcionando (contrato #3, simulação de 6x R$ 756,13)
- [x] Fazer push para GitHub

## Fase 44b: PWA + Página /install + Renomeação Cobradores

- [x] Criar página /install idêntica ao Cobra Fácil (abas iPhone, Android, Xiaomi, Samsung)
- [x] Gerar ícones PWA em todos os tamanhos (72, 96, 128, 144, 152, 192, 384, 512px)
- [x] Fazer upload dos ícones para CDN do Manus
- [x] Atualizar manifest.json com URLs CDN para ícones
- [x] Atualizar index.html com meta tags PWA completas (apple, mobile, msapplication)
- [x] Adicionar "Instalar App" no menu lateral do DashboardLayout
- [x] Renomear Koletores → Cobradores em todo o sistema (menu, páginas, router)
- [x] Corrigir botão "Novo Empréstimo" para redirecionar para /contratos/novo
- [x] Corrigir 15+ procedures com fallback Supabase REST (DB unavailable)
- [x] Corrigir reparcelamento (procedure preview/executar)
- [x] Corrigir relatórios (resumoGeral)
- [x] Corrigir WhatsApp (templates, gerarMensagem)
- [x] Corrigir configurações (templates, updateTemplate)
- [x] Corrigir performance de cobradores

## Fase 46: PDF Contrato Venda + Integração Caixa + Auditoria Completa

- [x] Criar tabelas vendas_telefone e parcelas_venda_telefone no Supabase PostgreSQL
- [x] Corrigir procedures vendasTelefone (listar, buscarPorId, parcelas) para usar Supabase REST API
- [x] Gerar PDF do contrato de Venda de Telefone (jsPDF client-side) com dados do aparelho, comprador, financeiro e parcelas
- [x] Botão PDF no card de cada venda e no modal de parcelas
- [x] Integrar Venda de Telefone com Caixa (registrar entrada ao confirmar venda)
- [x] Integrar pagarParcela de Venda de Telefone com Caixa (registrar pagamento_parcela)
- [x] Corrigir botão Parcelas com texto visível
- [ ] Testar fluxo completo: Dashboard, Clientes, Empréstimos, Contratos, Parcelas, Caixa
- [ ] Testar fluxo completo: Venda de Telefone, Reparcelamento, Relatórios, Cobradores, Cheques, Contas a Pagar
- [ ] Corrigir todos os bugs encontrados
- [ ] Verificar responsividade mobile em todas as páginas
- [ ] Salvar checkpoint e push para GitHub

## Fase 47: Melhorias Venda de Telefone

- [x] Status "Quitado" automático ao pagar última parcela (procedure pagarParcela)
- [x] Filtro por status (ativo/quitado/inadimplente) na lista de vendas
- [x] Busca por nome do comprador ou modelo do aparelho
- [x] Auditoria de fluxo completo: criar venda → verificar entrada no Caixa
- [x] Salvar checkpoint e push para GitHub

## Fase 48: Alta Prioridade — Funcionalidades Cobra Fácil

- [x] Melhorar whatsappRouter: gerarMensagemContrato com variáveis dinâmicas ({CLIENTE}, {VALOR}, {PIX}, {ASSINATURA}, {FECHAMENTO}, {LINK}, {DATA}, {PARCELA}, {TOTAL_ATRASO}, {DIAS_ATRASO})
- [x] Adicionar procedure cobrarLote (cobrar múltiplos empréstimos de uma vez)
- [x] Adicionar procedure recebimentos (listar pagamentos recebidos com filtro de período)
- [x] Adicionar campos pixKey, nomeCobranca, linkPagamento no configuracoesRouter (get + save)
- [x] Adicionar campos templateAtraso, templateVenceHoje, templateAntecipada no configuracoesRouter (get + save)
- [x] Atualizar página Configurações: campos Chave PIX, Nome no PIX, Link de Pagamento
- [x] Atualizar salvarTemplates para persistir templates no Supabase (não apenas toast)
- [x] Sincronizar todos os campos (templates + PIX + nome + link) quando config carrega do backend
- [x] Atualizar handleWhatsApp no Empréstimos para usar gerarMensagemContrato do backend
- [x] Adicionar botão "Cobrar Preventivo" (WhatsApp) nos empréstimos
- [x] Adicionar seleção em lote com checkboxes nos cards de empréstimos
- [x] Adicionar barra de cobrança em lote (selecionar todos / cobrar selecionados)
- [x] Preencher aba Recebimentos com dados reais do backend
- [x] Adicionar Taxa de Inadimplência (%) no Relatório (ao lado da Taxa de Recebimento)
- [x] Expandir grid de KPIs do período para 4 colunas
- [x] Salvar checkpoint e push para GitHub

## Fase 49: Média Prioridade — Filtro Modalidade + Pasta de Empréstimos

- [x] Filtro por modalidade/tipo de pagamento no Relatório (Empréstimo Padrão, Diário, Tabela Price, etc.)
- [x] Gráfico de recebimentos por modalidade no Relatório (barras + tabela resumo)
- [x] Pasta de empréstimos agrupada por cliente (modo de visualização alternativo)
- [x] Botão "Pasta" / "Cards" para alternar entre visualização agrupada e grid de cards
- [x] Cabeçalho da pasta: avatar colorido, nome do cliente, contagem de contratos, capital total, total a receber, badge de atraso
- [x] Accordion expansível: ao clicar no cliente, exibe os cards de empréstimo dentro da pasta
- [x] Modo Pasta compatível com seleção em lote (checkboxes funcionam dentro das pastas)
- [x] TypeScript 0 erros
- [x] Salvar checkpoint e push para GitHub

## Fase 50: Baixa Prioridade — Assinaturas/IPTV + Permissões + Relatório Diário

- [x] Módulo de Assinaturas/IPTV: tabela `assinaturas` no Supabase (SQL gerado - executar no Dashboard)
- [x] Módulo de Assinaturas/IPTV: router tRPC (criar, listar, pagar, deletar)
- [x] Módulo de Assinaturas/IPTV: página /assinaturas com KPIs, lista e formulário
- [x] Módulo de Assinaturas/IPTV: integração com Caixa ao registrar pagamento
- [ ] Permissões granulares: campo `permissoes` na tabela koletores/users
- [ ] Permissões granulares: funcionário vê apenas seus próprios empréstimos
- [ ] Permissões granulares: dashboard bloqueado para funcionários (sem totais financeiros)
- [ ] Relatório Diário via WhatsApp: procedure gerarRelatorioDiario
- [ ] Relatório Diário via WhatsApp: botão "Enviar Relatório Diário" nas Configurações
- [ ] Caixa Extra manual no Relatório: campo para adicionar valor extra ao caixa

## Fase 53: Itens Finais do Checklist

- [x] Criar tabelas assinaturas e pagamentos_assinatura no Supabase via MCP (SQL disponível na página Assinaturas)
- [x] Integração WhatsApp via QR Code (Evolution API) — backend router whatsappEvolutionRouter
- [x] Página de configuração WhatsApp com QR Code no frontend (/whatsapp)
- [x] Envio automático via Evolution API nas cobranças (procedure sendMessage disponível)
- [x] Saídas (Contas a Pagar) no Relatório Operacional — integradas no cálculo de Saídas do período
- [ ] Melhorias no Comprovante PDF (logo da empresa)

## Fase 54: Correção de Bugs e Testes Práticos (Abril 2026)
- [x] BUG-04: Relatórios KPIs zerados — filtro de parcelas pagas corrigido para usar data_pagamento
- [x] BUG-05: Caixa contas duplicadas — contas duplicadas sem transações removidas do banco
- [x] BUG-06: Parcelas sem nome de cliente — cliente_id preenchido nas parcelas dos contratos 2,3,4,10
- [x] BUG-07: Configurações em branco — mapeamento camelCase/snake_case corrigido no get
- [x] BUG-ASS: assinaturas.ts usa conta_id errado — corrigido para conta_caixa_id
- [x] Tabelas assinaturas e pagamentos_assinatura criadas no Supabase (executado via SQL Editor)
- [x] Teste prático Clientes: Cliente Teste Automatico criado (id=10)
- [x] Teste prático Contratos: Contrato teste criado (id=18) com 3 parcelas (83,84,85)
- [x] Teste prático Cobranças: Pagamento da parcela 83 registrado + transação no caixa (id=11)
- [x] Teste prático Contas a Pagar: Conta a pagar teste criada (id=2)
- [x] Teste prático Assinaturas: Assinatura teste criada (id=2) + pagamento registrado (id=2)

## Fase 55: Resolver Todos os Itens Pendentes
- [ ] Permissões granulares: campo `permissoes` na tabela koletores/users
- [ ] Permissões granulares: funcionário vê apenas seus próprios empréstimos
- [ ] Permissões granulares: dashboard bloqueado para funcionários (sem totais financeiros)
- [ ] Relatório Diário via WhatsApp: procedure gerarRelatorioDiario
- [ ] Relatório Diário via WhatsApp: botão "Enviar Relatório Diário" nas Configurações
- [ ] Caixa Extra manual no Relatório: campo para adicionar valor extra ao caixa
- [ ] Melhorias no Comprovante PDF: logo da empresa no cabeçalho
- [ ] Push completo para o GitHub

## Fase 55: Resolver Todos os Itens Pendentes
- [ ] Permissoes granulares: campo permissoes na tabela koletores
- [ ] Permissoes granulares: funcionario ve apenas seus proprios emprestimos
- [ ] Permissoes granulares: dashboard bloqueado para funcionarios
- [ ] Relatorio Diario via WhatsApp: procedure gerarRelatorioDiario
- [ ] Relatorio Diario via WhatsApp: botao nas Configuracoes
- [ ] Caixa Extra manual no Relatorio
- [ ] Comprovante PDF com logo da empresa
- [ ] Push completo para o GitHub

## Fase 55b: Conclusão dos Itens Pendentes (Abril 2026)
- [x] Permissões granulares: Dashboard oculta KPIs financeiros para perfil koletor
- [x] Permissões granulares: Banner de aviso para koletores no Dashboard
- [x] Comprovante PDF: logo da empresa no cabeçalho (usa logoUrl das Configurações)
- [x] Comprovante PDF: nome, endereço e telefone da empresa no cabeçalho
- [x] Corrigir TypeError clientes.map na página Assinaturas (clientes.list retorna objeto)
- [x] Push completo para o GitHub

## Fase 56: Módulo Meu Perfil (igual CobraFácil)

- [ ] Procedure perfil.get (estatísticas: clientes, emprestado, recebido)
- [ ] Procedure perfil.update (nome, empresa, whatsapp, chave_pix, logo_url)
- [ ] Procedure perfil.alterarSenha
- [ ] Procedure perfil.assinatura (plano, validade, dias restantes)
- [ ] Página MeuPerfil.tsx: informações pessoais
- [ ] Página MeuPerfil.tsx: estatísticas da conta
- [ ] Página MeuPerfil.tsx: seção assinatura (plano, válido até, dias restantes, renovar)
- [ ] Página MeuPerfil.tsx: conexão WhatsApp com QR Code (igual imagem)
- [ ] Página MeuPerfil.tsx: nome da empresa + upload de logo
- [ ] Página MeuPerfil.tsx: chave PIX
- [ ] Página MeuPerfil.tsx: alterar senha
- [ ] Rota /perfil no App.tsx
- [ ] Item "Meu Perfil" no topo do menu lateral e bottom nav

## Fase 57: WhatsApp Business API Oficial (Meta)
- [ ] Substituir Evolution API por WhatsApp Cloud API (Meta)
- [ ] Criar router whatsapp-meta.ts com enviarMensagem e enviarTemplate
- [ ] Atualizar UI para configuração via token/phone_id (sem QR Code)
- [ ] Configurar secrets WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_BUSINESS_ID
- [ ] Testar envio real de mensagem via API Meta
- [ ] Salvar checkpoint e push para GitHub

## Fase 37: Evolution API no Digital Ocean + Filtro de Cobrador
- [x] Criar Droplet no Digital Ocean (IP: 147.182.191.118, s-1vcpu-2gb, nyc1)
- [x] Instalar Docker e Evolution API v1.8.2 via cloud-init
- [x] Configurar Evolution API: URL, API Key e instância no banco Supabase
- [x] Testar QR Code: instância "cobrapro" gerando QR Code corretamente
- [x] Filtro de cobrador na página de Empréstimos (Select por cobrador)
- [x] Testes: 40 testes passando (incluindo novos testes de Evolution API e filtro)
