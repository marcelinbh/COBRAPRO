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
- [x] Página MeuPerfil.tsx: seção assinatura (plano, válido até, dias restantes, renovar)
- [x] Página MeuPerfil.tsx: conexão WhatsApp com QR Code (igual imagem)
- [x] Página MeuPerfil.tsx: nome da empresa + upload de logo
- [x] Página MeuPerfil.tsx: chave PIX
- [x] Página MeuPerfil.tsx: alterar senha
- [x] Rota /perfil no App.tsx
- [x] Item "Meu Perfil" no topo do menu lateral e bottom nav

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

## Fase 38: Webhook Evolution API
- [ ] Endpoint POST /api/webhook/evolution no servidor CobraPro
- [ ] Salvar eventos de mensagem no banco (tabela whatsapp_eventos)
- [ ] Configurar webhook na instância Evolution API via API REST
- [ ] Testes do endpoint de webhook

## Fase 39: QR Code Modal + Logo Supabase + Relatórios Diários

- [x] Reformular modal de QR Code com timer 90s, instruções passo-a-passo e botão Conectar WhatsApp
- [x] Corrigir upload de logo usando Supabase Storage (bucket público)
- [x] Implementar relatórios diários de parcelas a vencer e vencidas via WhatsApp (formato CobraFácil)
- [x] Criar página /instalar com abas por dispositivo (iPhone/iPad, Android, Xiaomi/Redmi, Samsung) estilo CobraFácil com layout CobraPro
- [x] Registrar rota /relatorio-diario no App.tsx e menu lateral do DashboardLayout
- [x] Reformular página /whatsapp: remover config Evolution API, manter apenas QR Code + templates de mensagens

## Fase 40: Multi-tenant + Login Fix
- [x] Corrigir senha do usuário contato@vitalfinanceira.com (passwordHash ausente)
- [x] Melhorar mensagem de erro no login (mostrar mensagem correta em vez de "Erro de conexão")
- [x] Implementar isolamento multi-tenant: cada usuário tem userId em todas as tabelas e só vê seus próprios dados
- [x] Garantir que novos usuários registrados chegam com base limpa (sem dados de outros usuários)

## Fase 41: Permissões Granulares + Meu Perfil + Nova Conta

- [x] Criar conta wcemprestimorapido@gmail.com com senha 97556511
- [x] Permissões granulares: koletores só veem empréstimos que eles cadastraram (filtro koletor_id)
- [x] Permissões granulares: dashboard oculta KPIs financeiros para koletores
- [x] Módulo Meu Perfil: procedure perfil.get (estatísticas: clientes, emprestado, recebido)
- [x] Módulo Meu Perfil: procedure perfil.update (nome, empresa, whatsapp, chave_pix, logo_url)
- [x] Módulo Meu Perfil: procedure perfil.alterarSenha
- [x] Módulo Meu Perfil: procedure perfil.assinatura (plano, validade, dias restantes)
- [x] Página MeuPerfil.tsx: informações pessoais + estatísticas
- [x] Página MeuPerfil.tsx: seção assinatura (plano, válido até, dias restantes, renovar)
- [x] Página MeuPerfil.tsx: conexão WhatsApp com QR Code
- [x] Página MeuPerfil.tsx: nome da empresa + upload de logo
- [x] Página MeuPerfil.tsx: chave PIX
- [x] Página MeuPerfil.tsx: alterar senha
- [x] Rota /perfil no App.tsx
- [x] Item "Meu Perfil" no topo do menu lateral e bottom nav

## Fase 42: Notificações Automáticas WhatsApp Configuráveis

- [ ] Criar tabela notificacoes_automaticas no banco (user_id, tipo, ativo, mensagem_template, dias_antes)
- [ ] Migration SQL: criar tabela notificacoes_automaticas
- [ ] Procedure notificacoes.listar: listar regras do usuário
- [ ] Procedure notificacoes.salvar: criar/atualizar regra (mensagem + ativo/inativo)
- [ ] Procedure notificacoes.toggle: ligar/desligar regra individualmente
- [ ] Procedure notificacoes.disparar: buscar parcelas do dia e enviar WhatsApp
- [ ] Job cron diário (08h) que chama notificacoes.disparar para todos os usuários com WhatsApp conectado
- [ ] Registrar histórico de envios (tabela notificacoes_log)
- [ ] Variáveis suportadas: {nome}, {valor}, {data_vencimento}, {dias_atraso}, {empresa}
- [ ] Página NotificacoesAuto.tsx: lista de regras com toggle on/off por regra
- [ ] Página NotificacoesAuto.tsx: editor de mensagem com preview de variáveis
- [ ] Página NotificacoesAuto.tsx: botão "Testar Envio" (envia para o próprio WhatsApp)
- [ ] Página NotificacoesAuto.tsx: histórico de envios recentes
- [ ] Rota /notificacoes-auto no App.tsx
- [ ] Item "Notificações Auto" no menu lateral

## Fase 44: Correção de Bugs Críticos (Sessão Atual)
- [x] Bug: botão "Confirmar Pagamento" desabilitado sem conta de caixa — contaCaixaId tornado opcional no frontend e backend
- [x] Bug: double-submit no contratos.create — adicionado guard para não fazer fallback REST se contratoId já foi criado pelo Drizzle
- [x] Bug: em-dashes (—) em comentários JSX causando erro esbuild — substituídos por hífens em Configuracoes.tsx, Dashboard.tsx, MeuPerfil.tsx, Simulador.tsx
- [x] Limpeza: contrato duplicado (ID 19) removido do banco — mantido apenas contrato 20 com 12 parcelas
- [x] Correção: user_id null nos dados de teste — atualizado para 30084 (koletor3) em contratos, clientes e parcelas
- [x] Bug: Análise de Risco mostrando capitalTotal e totalReceber como R$ 0 — adicionados campos capitalTotal e totalReceber ao retorno da procedure listarComScore
- [x] Mover "Meu Perfil" para segunda posição no menu lateral (logo abaixo de Dashboard)

## Fase 45: Cálculos de Juros Corretos + Novas Modalidades

- [ ] Auditar cálculos de juros (Price, Simples, Composto, Bullet) para todas as modalidades
- [ ] Adicionar modalidade DIÁRIA (parcelas diárias) se não existir
- [ ] Adicionar modalidade SEMANAL (parcelas semanais) se não existir
- [ ] Adicionar modalidade QUINZENAL (parcelas quinzenais) se não existir
- [ ] Verificar e garantir MENSAL correto
- [ ] Testar cálculos no Simulador e NovoContrato

## Fase 50: Limpeza e Filtro de Modalidade
- [x] Excluir contratos de teste do "Cliente Teste Bateria" e o próprio cliente (banco de produção já estava limpo)
- [x] Adicionar filtro de modalidade na página de Parcelas (Diário, Semanal, Quinzenal, Mensal)

## Fase 51: Contador por Modalidade e Exportação
- [x] Adicionar cards de contador por modalidade no topo das Parcelas (Diário, Semanal, Quinzenal, Mensal)
- [x] Implementar exportação PDF e Excel das parcelas com filtros ativos

## Fase 52: Limpeza de Produção e Ambiente de Staging
- [x] Deletar dados de teste do banco de produção (Cliente Teste Bateria + contratos + parcelas)
- [x] Aplicar migração user_id em todas as tabelas do banco de produção
- [x] Limpar todos os dados de demonstração do banco (80 parcelas, 5 contratos, 5 clientes, etc.)
- [x] Criar conta dgfinanceira@gmail.com com base limpa

## Fase 53: Logout Mobile
- [x] Adicionar botão de logout no menu "Mais" do mobile (bottom navigation)

## Fase 54: Onboarding para Novos Assinantes
- [x] Criar campo onboardingCompleto na tabela users
- [x] Criar procedure onboarding.check e onboarding.complete no servidor
- [x] Criar página Onboarding.tsx com assistente multi-etapas (nome empresa, conta caixa, templates WhatsApp)
- [x] Redirecionar novos usuários para /onboarding ao fazer login pela primeira vez
- [x] Marcar usuários existentes como onboarding completo (contato@vitalfinanceira.com, koletor3@gmail.com, dgfinanceira@gmail.com)

## Fase 55: Correção Crítica - Isolamento por user_id
- [x] Diagnosticar por que user_id não está filtrando dados em produção
- [x] Corrigir queries no servidor para filtrar por userId em todas as procedures (11 queries do dashboard)
- [x] Limpar dados de teste do koletor3 que aparecem para outros usuários
- [x] Verificar isolamento completo entre contas

## Fase 56: Otimização de Performance
- [x] Pool de conexões MySQL no servidor (eliminar overhead de 100ms por requisição)
- [x] Lazy loading de xlsx e jspdf (remover 1.1MB do bundle inicial)
- [x] Adicionar índices no banco para user_id, status e data_vencimento (11 índices criados)
- [x] Analytics assíncrono (atributo async+defer no script de analytics)
- [x] Code splitting por rota no Vite (manualChunks para react, radix, tanstack, icons, charts)

## Fase 57: Integração Kiwify → Criação Automática de Conta

- [x] Endpoint POST /api/webhook/kiwify no servidor Express (fora do tRPC)
- [x] Validar payload: order_status === 'paid' e customer.email presente
- [x] Verificar idempotência: se usuário já existe, não duplicar (verificar por email)
- [x] Gerar senha aleatória segura (10 chars: letras + números, sem caracteres ambíguos)
- [x] Criar usuário na tabela users (email, nome, senha hash, role: user, loginMethod: kiwify)
- [x] Registrar log de webhook recebido (tabela kiwify_webhooks: order_id, email, status, payload, created_at)
- [x] Enviar e-mail de boas-vindas via Brevo com login + senha + link de acesso
- [x] Template de e-mail HTML profissional com credenciais em destaque e botão CTA
- [x] Retornar status 200 imediatamente (antes de processar, para evitar timeout da Kiwify)
- [x] KIWIFY_WEBHOOK_TOKEN configurado como variável de ambiente
- [x] 5 testes Vitest passando (token inválido, token header, token query, status ignorado, env)
- [ ] Configurar URL do webhook no painel da Kiwify (Apps > Webhooks) — aguardando usuário
- [ ] Testar e-mail de boas-vindas chegando corretamente (após configurar na Kiwify)

## Fase 58: Correção Tela Preta Mobile
- [x] Adicionar splash screen de loading no HTML (logo CobraPro + spinner verde)
- [x] Fade-out suave do splash quando o React monta (main.tsx)
- [x] Push para GitHub - deploy automático no Digital Ocean
- [ ] Confirmar que não aparece mais tela preta no iPhone (aguardando deploy)

## Fase 59: Otimização de Performance (Site Lento)
- [x] Medir tempo de resposta: TTFB 500-640ms, bundle 362KB sem cache
- [x] Cache-Control: max-age=1y + immutable para assets com hash (JS/CSS)
- [x] Cache-Control: no-cache para index.html
- [x] Compressão gzip via middleware compression no Express
- [x] Code splitting melhorado: @trpc+@tanstack, vendor-misc separado
- [x] Splash screen com logo + spinner verde (elimina tela preta no mobile)

## Fase 62: Persistência da Versão WA Web (Evolution API)
- [ ] Criar Dockerfile customizado para Evolution API com baileys-version.json [2,3000,1035194821] para persistir a versão WA Web correta mesmo se o container for recriado no Droplet

## Fase 63: Correção Crítica - Crash React Pagar + Melhorias
- [x] BUGFIX: Corrigir violação da Regra dos Hooks no PagamentoModal (Emprestimos.tsx)
- [x] Dockerfile customizado para Evolution API com patch baileys-version.json persistente
- [x] build_command no .do/app.yaml atualizado com pnpm build automático
- [x] Endpoint /api/scheduled/notificacoes criado para disparo automático

## Fase 64: Modal de Cadastro de Clientes Completo (igual CobraFácil)
- [ ] Modal com 3 abas: Dados Pessoais, Endereço, Documentos
- [ ] Avatar com upload de foto (salvo no S3)
- [ ] Campos: Nome*, CPF, CNPJ, RG, E-mail, Telefone, Instagram, Facebook, Profissão, Indicação, Tipo, Ativo, Observações
- [ ] Busca automática de CEP (ViaCEP) preenchendo Rua, Bairro, Cidade, Estado
- [ ] Aba Documentos: upload de RG, CNH, Comprovante de Residência (S3)
- [ ] Máscaras de CPF, CNPJ, RG, CEP, Telefone
- [ ] Endpoint tRPC para upload de avatar e documentos via S3
- [ ] Testar fluxo de pagamento completo em cobrapro.online

## Fase 64: Modal de Cadastro Completo de Clientes
- [x] Replicar modal de 3 abas do CobraFácil (Dados Pessoais, Endereço, Documentos)
- [x] Upload de foto/avatar para S3
- [x] Upload de documentos múltiplos para S3 com descrição
- [x] Busca automática de CEP via ViaCEP
- [x] Campos: CPF, CNPJ, RG, Instagram, Facebook, Profissão, Tipo Cliente, Indicação
- [x] Adicionar campos tipoCliente e isReferral no schema e migração
- [x] Corrigir bug fluxoMensal [Max Depth] no Dashboard
- [x] Corrigir filtro user_id no fluxoMensal Drizzle

## Fase 45: Melhorias Modal Contrato + Bugs Clientes
- [ ] Melhorar modal de novo contrato igual ao CobraFácil (campos completos)
- [ ] Adicionar opção de parcelas fixas no modal (valor fixo por parcela)
- [ ] Adicionar funcionalidade "Adicionar Parcela" em empréstimo existente (renegociação)
- [ ] Corrigir bug de upload de arquivos na aba de clientes
- [ ] Corrigir bug do botão "Editar Cliente" que não funciona
- [ ] Corrigir bug NaN em multaAtraso e jurosMoradiario (campos opcionais com valor vazio causam erro)
- [ ] Remover valor padrão 0.033% dos campos de juros mora diário
- [ ] Tornar campos "Multa por Atraso" e "Juros Mora Diário" opcionais (não obrigatórios)
- [ ] Adicionar botão de editar cliente na tabela de clientes
- [ ] Corrigir bug de upload de arquivos na aba documentos do cliente
- [ ] Adicionar funcionalidade de criar parcela com valor fixo em empréstimo existente
- [ ] Melhorar modal de novo contrato igual ao CobraFácil (parcelas fixas, pular fins de semana, etc.)
- [ ] Editar data de vencimento da parcela manualmente
- [ ] Editar data de recebimento do pagamento manualmente
- [ ] Editar valor de juros recebido manualmente
- [ ] Aplicar multa em valor fixo (não apenas percentual)
- [ ] Corrigir botões do modal de empréstimo (enviar cobrança, aplicar multa, editar não funcionam)
- [ ] Corrigir upload de arquivos em produção (BUILT_IN_FORGE vars não configuradas no DO)
- [ ] Corrigir NaN em campos multa/juros mora ao criar contrato
- [ ] Remover valores padrão 2% e 0.033% dos campos multa/juros mora
- [ ] Adicionar parcela com valor fixo em empréstimo existente

## Fase 40: Botões Funcionais + Novas Funcionalidades Formulário
- [x] Corrigir botões da página de detalhes (/emprestimos/:id): Pagar, Pagar Juros, Editar Juros, Aplicar Multa, Cobrar WhatsApp, Enviar Cobrança, Comprovante PDF, Deletar
- [x] Corrigir botões do modal EmprestimoDetalhesModal: todos os botões conectados às mutations tRPC
- [x] Novo Contrato: opção de parcela com valor fixo (toggle)
- [x] Novo Contrato: opção de datas de vencimento manuais por parcela (toggle)
- [x] Novo Contrato: multa por atraso em valor fixo (R$) além de percentual (%)
- [x] Novo Contrato: taxa de juros editável mesmo com parcela fixa (calculada automaticamente)

## Fase 41: Editar Parcela Individual
- [ ] Procedimento tRPC contratos.editarParcela (valor + data de vencimento)
- [ ] Botão de editar em cada linha da tabela de parcelas (página de detalhes e modal)
- [ ] Modal de edição com campos: Valor da Parcela e Data de Vencimento

## Fase 43: Relatório de Inadimplência + Histórico de Alterações

- [ ] Criar tabela contract_history no banco para registrar alterações
- [ ] Criar procedimento tRPC relatório de inadimplência
- [ ] Criar tela /relatorio/inadimplencia com lista de clientes em atraso e botão de cobrança
- [ ] Registrar histórico ao editar juros, aplicar multa, editar parcela
- [ ] Adicionar aba Histórico na página de detalhes do empréstimo

## Fase 44: Bugs Críticos - Multa e Histórico
- [ ] BUGFIX: Aplicar multa não atualiza o valor total exibido no card/lista do empréstimo (valor_multa salvo nas parcelas mas não refletido no valor total do contrato na tela)
- [ ] Aplicar migration SQL da tabela contrato_historico no banco de dados
- [ ] Criar procedimento tRPC contratos.historico (buscar histórico de alterações)
- [ ] Criar procedimento tRPC relatorio.inadimplencia (listar clientes em atraso)
- [ ] Registrar histórico ao editar juros, aplicar multa, editar parcela, editar contrato, pagar, pagar juros
- [ ] Criar tela /relatorio/inadimplencia com lista de clientes em atraso e botão de cobrança WhatsApp
- [ ] Adicionar aba Histórico na página de detalhes do empréstimo

## Fase 5: Melhorias no Modal de Pagamento e Parcelas
- [ ] Modal de pagamento: adicionar campo editável para valor dos juros manualmente
- [ ] Modal de pagamento: adicionar campo editável para data do pagamento manualmente
- [ ] Botão "Criar Parcela" no modal de editar empréstimo (para empréstimos já criados)
- [x] Bug: multa não atualizava o valor total do empréstimo (corrigido - valor_multa incluído no SELECT e totalReceber)
- [x] Modal de pagamento: adicionar campo editável para valor dos juros manualmente (CONCLUÍDO)
- [x] Modal de pagamento: adicionar campo editável para data do pagamento manualmente (CONCLUÍDO)
- [x] Botão "Criar Parcela" no modal de editar empréstimo (CONCLUÍDO)
- [x] Procedure criarParcela no backend (CONCLUÍDO)
- [x] Procedure relatorios.inadimplentes no backend (CONCLUÍDO)
- [x] Tela /inadimplencia com lista de clientes em atraso e botão WhatsApp (CONCLUÍDO)
- [x] Dashboard KPIs: corrigir totalReceber para incluir valor_multa (CONCLUÍDO)
- [x] Invalidações do dashboard após aplicarMulta, editarJuros, deletar (CONCLUÍDO)
- [x] Campo de data no modal de pagamento (date picker com color-scheme:dark)
- [x] Botão Adicionar Nova Parcela na aba de detalhes do empréstimo
- [x] Juros editável no modal de pagamento da página EmprestimoDetalhes

## Fase 40: Auditoria e Correção de Cálculos de Juros + Pagamento Parcial
- [ ] Corrigir calcularJurosMora: usar multaDiaria (R$/dia) do contrato/configurações, não % do capital
- [ ] Corrigir registrarPagamento: buscar multaDiaria do contrato antes de calcular juros de atraso
- [ ] Adicionar campo saldo_residual na tabela parcelas (migration SQL)
- [ ] Implementar saldo residual automático: ao pagar parcialmente, o saldo restante é adicionado à próxima parcela
- [ ] Implementar saldo residual manual: opção no modal de pagamento para definir manualmente o valor a transferir
- [ ] Atualizar modal de pagamento para mostrar saldo residual e opção de transferência
- [ ] Corrigir cálculo de juros por atraso nos cards: usar multaDiaria do usuário (já está correto, confirmar)
- [ ] Atualizar shared/finance.ts: função calcularJurosMoraAbsoluto (R$/dia) separada da % do capital
- [ ] Testes: verificar cálculos com exemplos reais

## Fase 41: Correção de Cálculo de Total Devido

- [ ] Auditar cálculo de valor total devido no dashboard
- [ ] Corrigir: somar apenas parcelas não pagas (status != 'paga')
- [ ] Testar pagamento de parcela e verificar se total diminui
- [ ] Deploy em produção


## Fase 66: Correção Crítica - Cálculos de Pagamentos Parciais (Maio 2026)
- [x] Identificar problema: totalReceber não incluía saldo_residual e valor_multa
- [x] Corrigir cálculo de totalReceber em 5 locais (dashboard, clientes, empréstimos, fallback Supabase)
- [x] Corrigir cálculo de lucroRealizado para somar valor_juros das parcelas pagas
- [x] Escrever 9 testes Vitest para validar cálculos (todos passando)
- [x] Verificar que pagamentos parciais agora reduzem corretamente o KPI "Total a Receber"
- [x] Deploy em produção e validação com usuário


## Fase 67: Correção de Renovação Automática de Parcelas ao Pagar Juros (Maio 2026)
- [x] Identificar bug: userId e cliente_id faltando na nova parcela ao renovar
- [x] Corrigir procedure pagarJuros para adicionar userId e cliente_id (Drizzle + Supabase REST)
- [x] Escrever 23 testes Vitest para validar renovação automática (todos passando)
- [x] Validar 5 cenários: Quinzenal 50% (R$ 1.000), Quinzenal 50% (R$ 500), Diário 10%, Semanal 20%, Mensal 5%
- [x] Verificar que valor total mantém-se igual ao renovar (capital + juros)
- [x] Verificar que número de parcelas incrementa corretamente
- [x] Verificar que data de vencimento respeita a periodicidade


## Fase 68: Implementar 3 Sugestões de Melhoria (Maio 2026)
- [x] Sugestão 1: Testar fluxo completo em produção (criar empréstimo quinzenal, pagar juros, verificar renovação)
- [x] Sugestão 2: Adicionar validação no frontend para mostrar "Parcela renovada" quando juros são pagos
- [x] Sugestão 3: Implementar histórico de renovações para rastreabilidade (quantas vezes foi renovada)


## Fase 69: Teste End-to-End do Fluxo Completo (Maio 2026)
- [x] Criar teste unitário do fluxo de pagamento de juros com renovação automática
- [x] Validar 6 cenários diferentes (Quinzenal, Semanal, Mensal, Múltiplas Renovações, Pagamento Parcial, Badge)
- [x] Todos os 16 testes passando
- [x] Validar cálculos de totalReceber com saldo_residual
- [x] Validar incremento de contador de renovações
- [x] Validar exibição de badge "Renovada" e contador no frontend


## Fase 70: Implementação de Múltiplas Linguagens (Maio 2026)
- [ ] Instalar dependências i18next e react-i18next
- [ ] Criar estrutura de i18n com arquivos de tradução (PT-BR, ES)
- [ ] Traduzir todo o conteúdo do dashboard para Espanhol
- [ ] Traduzir página inicial (Home.tsx) para Espanhol
- [ ] Criar componente LanguageSwitcher elegante (estilo imagem)
- [ ] Integrar LanguageSwitcher no DashboardLayout
- [ ] Integrar LanguageSwitcher na página Home
- [ ] Salvar preferência de linguagem do usuário no localStorage
- [ ] Testar fluxo completo de troca de linguagem
- [ ] Deploy em produção


## Fase 71: Implementação de Múltiplas Linguagens (PT-BR/Espanhol) - Maio 2026
- [x] Instalar dependências i18next e react-i18next
- [x] Criar estrutura de i18n com arquivo de inicialização
- [x] Criar arquivo de tradução PT-BR (246 linhas, 8 seções)
- [x] Criar arquivo de tradução Espanhol (246 linhas, 8 seções)
- [x] Criar componente LanguageSwitcher elegante com dropdown
- [x] Integrar i18n no main.tsx com Suspense
- [x] Adicionar LanguageSwitcher ao DashboardLayout (sidebar footer)
- [x] Adicionar LanguageSwitcher ao Home.tsx (header)
- [x] Criar 15 testes de integração para validar i18n
- [x] Todos os testes passando (15/15)

**Traduções Implementadas:**
- Common (30 termos): language, search, filter, add, edit, delete, save, cancel, etc.
- Navigation (15 itens): dashboard, clientes, empréstimos, contratos, parcelas, caixa, etc.
- Dashboard (15 campos): balance, capital, toReceive, delinquency, interest, etc.
- Clients (18 campos): name, cpf, cnpj, phone, whatsapp, email, address, etc.
- Loans (35 campos): amount, rate, modality, status, paid, interest, etc.
- Parcels (8 campos): number, value, interest, dueDate, status, renewed, etc.
- Cashbox (10 campos): account, balance, income, expense, transaction, etc.
- Reports (10 campos): loans, delinquency, cashFlow, performance, etc.
- Forms (20 campos): payment modal, methods, observations, receipt, etc.
- Home (25 campos): features, pricing, contact, about, privacy, terms, etc.
- Errors (12 campos): required, invalid, password, credentials, server, network, etc.
- Success (6 campos): saved, deleted, updated, created, paymentProcessed, etc.

**Seletor de Linguagem:**
- Botão elegante com ícone Globe
- Badge com código de idioma (PT, ES)
- Dropdown com opções de idioma
- Persistência em localStorage
- Suporta PT-BR e Espanhol (ES)

## Fase 45: Internacionalização PT-BR / Espanhol (i18n)
- [x] Instalar e configurar react-i18next com LanguageDetector
- [x] Criar arquivos de tradução pt-BR.json e es.json (1272 linhas cada)
- [x] Criar componente LanguageSwitcher com dropdown PT/ES
- [x] Integrar LanguageSwitcher na sidebar (DashboardLayout) e na Home
- [x] Aplicar t() em todas as páginas: Dashboard, Clientes, Contratos, Parcelas, Empréstimos
- [x] Aplicar t() em: Caixa, Veículos, Cheques, ContasPagar, MeuPerfil, Simulador
- [x] Aplicar t() em: Cobradores, Usuários, Backup, Relatorios, Configuracoes, NovoContrato
- [x] Corrigir t() em sub-componentes (NovaConta, NovaTransacao, LancamentoRapido, StatusBadge, ScoreCircle)
- [x] Corrigir t() em constantes de nível de módulo (STATUS_CONFIG, MODALIDADE_LABELS)
- [x] Zero erros TypeScript após todas as correções
- [x] Tradução testada e funcionando: Dashboard → Panel de Control, KPIs, Sidebar


## Fase 46: Tradução 100% Completa PT-BR / Espanhol
- [ ] Auditar todos os textos hardcoded (toasts, erros, labels, placeholders, menu)
- [ ] Expandir arquivos de tradução com mensagens de sucesso/erro
- [ ] Aplicar t() em todos os toasts (success, error, info)
- [ ] Aplicar t() em todos os labels de formulários
- [ ] Aplicar t() em todos os placeholders de input
- [ ] Traduzir menu lateral (itens de navegação)
- [ ] Traduzir botões e ações (Editar, Deletar, Salvar, Cancelar, etc)
- [ ] Traduzir diálogos de confirmação
- [ ] Traduzir textos de validação de formulários
- [ ] Testar experiência 100% em PT-BR
- [ ] Testar experiência 100% em Espanhol
- [ ] Zero textos em português quando em modo Espanhol

## Revisão Crítica - 09/05/2026

- [x] VERIFICAR/CORRIGIR: Lógica de pagamento de juros com renovação automática de prazo:
  - Regra: cliente pegou R$1.000 a 50% quinzenal → total R$1.500 em 15 dias
  - Se no vencimento pagar SOMENTE os juros (R$500):
    1. Registrar pagamento dos juros (R$500)
    2. Renovar automaticamente o prazo (+15 dias ou conforme modalidade: diário/semanal/quinzenal/mensal)
    3. Manter o valor total (R$1.500) para a próxima data
  - Regra: pagou só juros = renova o prazo, mantém o total
  - Regra: pagou o total = quita a parcela normalmente
  - Outro exemplo: R$500 a 50% quinzenal → total R$750 em 15 dias
    - Paga só juros (R$250) → ganha mais 15 dias, total continua R$750
- [x] CORRIGIDO: Exclusão de contratos com cascade delete (parcelas deletadas antes do contrato)
- [ ] Testar fluxo completo na conta koletor3 após deploy das correções

## Fase 47: Correções Simulador + Relatórios
- [x] Corrigir todos os textos hardcoded sem acentos no Simulador.tsx (53 substituições com t())
- [x] Adicionar chaves de tradução simulator.* ao pt-BR.json e es.json
- [x] Adicionar chaves common.daily/weekly/biweekly/monthly/annual/installment ao pt-BR.json e es.json
- [x] Corrigir bug Relatórios R$ 0.00: aumentar limit de transações para 1000
- [x] Corrigir parsing de datas no Relatorios.tsx (usar slice(0,10) para evitar timezone issues)

## Fase 48: 3 Sugestões de Melhoria i18n + Relatórios
- [x] Corrigir MODALIDADE_LABELS hardcoded no Simulador (convertido para função getModalidadeLabel com t())
- [x] Auditar e corrigir textos hardcoded em Inadimplência (Inadimplencia.tsx) - 15 substituições
- [x] Auditar e corrigir textos hardcoded em Score de Clientes (Scores.tsx) - 15 substituições
- [x] Auditar e corrigir textos hardcoded em Mensagens Automáticas (NotificacoesAutomaticas.tsx) - 22 substituições
- [x] Adicionar 43 chaves de tradução faltantes em pt-BR.json e es.json (common, inadimplencia, scores, notifications)
- [x] Verificar e corrigir Relatórios: limit de transações=1000 e parsing de datas com slice(0,10)

## Fase 49: 3 Melhorias (i18n Veículos/Venda, Juros, Simulador ES)
- [x] Auditar e corrigir textos hardcoded em Veículos (Veiculos.tsx) - reescrito com t()
- [x] Auditar e corrigir textos hardcoded em Venda de Telefone (VendaTelefone.tsx) - 48 substituições
- [x] Adicionar chaves de tradução faltantes para veiculos.* e vendaTelefone.* em pt-BR.json e es.json
- [x] Corrigir lógica de pagamento de juros: pagarJuros aceita novaDataVencimento e novoValorParcela opcionais
- [x] Verificar Simulador em Espanhol: MODALIDADE_LABELS convertido para função getModalidadeLabel(mod, t)

## Fase 50: Modal Só Juros - Campos de Próximo Vencimento
- [x] Adicionar campo "Data do Próximo Vencimento" no modal de pagamento Só Juros
- [x] Adicionar campo "Valor do Próximo Vencimento" no modal de pagamento Só Juros
- [x] Salvar esses valores no backend ao confirmar pagamento de juros (procedure pagarJuros atualizada)

## Fase 51: Mover Detalhes para dentro de Editar Empréstimo
- [x] Modal unificado EditarEmprestimoModal com 4 abas: Editar, Detalhes, Histórico, Comprovante
- [x] Botóes de ação (Pagar, Pagar Juros, Editar Juros, Multa, WhatsApp, Deletar) em ambas as abas
- [x] Botão "Detalhes" no card agora abre o modal unificado na aba Detalhes
- [x] Nome do cliente clicando abre o modal unificado na aba Detalhes
- [x] Botão "Editar" no card abre o modal unificado na aba Editar
- [x] Zero erros TypeScript após todas as mudanças

## Fase 52: Correção Badge Modalidade + Cálculo de Juros
- [x] Corrigir badge de modalidade no card: usar tipoTaxa (quinzenal/mensal/diario/semanal) em vez de modalidade
- [x] Auditar cálculo de valorJurosParcela: R$500 × 50% = R$250 (corrigido - era amortização errada)
- [x] Corrigir procedure listComParcelas: valorJurosParcela = capital × taxa / 100 (juros simples)

## Fase 53: Preview de Cálculo + Correção Modal Pagamento
- [x] Melhorar preview de cálculo no formulário de novo contrato: adicionado Juros por Parcela (taxa%) e Total em verde
- [x] Corrigir modal de pagamento: Juros mostra taxa%, Total = capital + juros corretamente
- [ ] Auditoria completa PT-BR e Espanhol de todas as funcionalidades

## Fase 54: Auditoria Completa PT-BR e Espanhol (09/05/2026)
- [x] Dashboard: 15 textos hardcoded corrigidos + 7 novas chaves (cashFlowWeek, receivingTrend, dueTodayTitle, overdueTitle, viewAll, daysOverdue, koletorBanner)
- [x] Emprestimos: 31 textos hardcoded corrigidos + 18 novas chaves emprestimos.* em pt-BR.json e es.json
- [x] Chaves comuns: 67 novas chaves common.* adicionadas (before, after, receipt, history, details, capital, interest, total, etc.)
- [x] Chaves clientes.*: 41 novas chaves adicionadas em pt-BR.json e es.json
- [x] Chaves parcelas.*: 29 novas chaves adicionadas em pt-BR.json e es.json
- [x] Chaves analiseRisco.*, calendario.*, cheques.*, cobradores.*, contratos.*, reparcelamento.*, relatorios.*: 187 novas chaves adicionadas
- [x] Zero erros TypeScript após todas as correções
- [ ] Pendente: aplicar t() nas páginas Clientes.tsx, Parcelas.tsx, EmprestimoDetalhes.tsx, MeuPerfil.tsx, Relatorios.tsx (chaves já adicionadas, falta substituir textos hardcoded)

## Fase 55: 3 Melhorias (i18n páginas, aba Etiquetas, menu ES)
- [x] Aplicar t() em Clientes.tsx, Parcelas.tsx, EmprestimoDetalhes.tsx, Relatorios.tsx (scripts de substituição em lote)
- [x] Adicionar aba "Etiquetas" ao modal unificado EditarEmprestimoModal (5ª aba com CRUD completo)
- [x] Corrigir menu lateral (DashboardLayout): "Meu Perfil" e "Sair" agora usam t() - traduzidos em ES
- [x] Adicionar chave common.logout em pt-BR.json (Sair) e es.json (Salir)

## Fase 56: 3 Sugestões + Testes Completos
- [x] Corrigir chave menu.dashboard: removido labelMap redundante, item.label já é t("menu.*") traduzido
- [x] Adicionar botão Etiquetas (roxo) na barra de ações do card - abre modal na aba Etiquetas
- [x] Validar lógica pagarJuros: CORRETA - cria nova parcela com mesmo valor e data+intervalo
- [ ] Testes completos no cobrapro.online (fluxo PT-BR e Espanhol) - aguardando deploy

## Fase 57: Simulador.tsx - i18n Completo (09/05/2026)
- [x] Substituir 6 descrições hardcoded das modalidades por t() (loanSimpleDesc, loanDailyDesc, loanWeeklyDesc, loanBiweeklyDesc, loanFixedDesc, checkDiscountDesc)
- [x] Converter getTaxaLabel() e getTaxaLabelCurto() para aceitar t como parâmetro (i18n completo)
- [x] Corrigir parcelasLabel: "Prazo (dias)", "Número de Semanas", "Número de Quinzenas", "Número de Parcelas"
- [x] Corrigir texto de periodicidade automática e modo comparação
- [x] Corrigir textos hardcoded no PDF: "Simulação de Empréstimo", "Parâmetros da Simulação", "Exportar PDF", etc.
- [x] Corrigir cabeçalhos das tabelas PDF (Parcela, Vencimento, Valor, Periodicidade, etc.)
- [x] Adicionar 30+ novas chaves em pt-BR.json e es.json (simulator.taxaLabel.*, simulator.taxaLabelCurto.*, etc.)
- [x] Zero erros TypeScript após todas as mudanças

## Fase 58: Auditoria Completa PT-BR e Espanhol (09/05/2026)
- [x] Botão LANGUAGE movido para o SidebarHeader (sempre visível, ao lado do logo)
- [x] LanguageSwitcher atualizado com prop compact (modo colapsado) e localStorage.setItem para persistência
- [ ] Testar fluxo completo PT-BR: Empréstimos, Clientes, Parcelas, Simulador, Caixa
- [ ] Testar fluxo completo ES: todas as páginas com tradução
- [ ] Corrigir bugs encontrados na auditoria

## Fase 59: Renovação Quinzenal + Relatórios + Juros Automáticos Configuráveis
- [x] Testar fluxo de renovação quinzenal no cobrapro.online (pagar só juros → nova parcela +15 dias)
- [x] Criar módulo de Relatórios: empréstimos ativos, projeção de recebimentos, extrato por cliente
- [x] Adicionar configuração de juros/multas automáticos no painel de Configurações (ativável manualmente)

## Fase 60: 3 Melhorias (11/05/2026)
- [x] Cálculo automático de juros/multas no modal de pagamento (quando toggle ativo nas Configurações)
- [x] Exportação PDF no Extrato por Cliente nos Relatórios
- [x] Filtros avançados nos Relatórios (faixa de valor de capital nos empréstimos ativos)

## Fase 61: Auditoria Completa de Código e Cálculos (11/05/2026)
- [x] Auditoria de segurança: contratos.deletar (Drizzle path) sem user_id → corrigido
- [x] Auditoria de segurança: clientes.deletar (Drizzle path) sem user_id → corrigido
- [x] Auditoria de segurança: contratos.updateStatus (Drizzle path) sem user_id → corrigido
- [x] Bug cálculo: valor_juros para Tabela Price era fixo (capital × taxa) → corrigido para juros decrescentes (saldo_devedor × taxa) em ambos os paths (Drizzle + REST)
- [x] Bug campo: Dashboard fallback REST usava 'saldo' e 'ativo' (campos inexistentes) → corrigido para 'saldo_inicial' e 'ativa'
- [x] Bug campo: caixa.contas fallback REST usava 'saldo' e 'ativo' → corrigido para 'saldo_inicial' e 'ativa'
- [x] Bug campo: vendasTelefone tentava atualizar campo 'saldo' inexistente → removido update desnecessário
- [x] Cálculos verificados como CORRETOS: calcularParcelaPadrao, calcularParcelaBullet, calcularJurosMora, saldoResidual, pagarJuros (renovação), lucroRealizado, lucroPrevisto

## Fase 62: Meta Pixel (11/05/2026)
- [x] Meta Pixel (ID 2507235503035747) adicionado no index.html (client-side)
- [x] API de Conversões (CAPI) server-side configurada: helper metaCapi.ts + endpoint /api/meta/event
- [x] Helper frontend metaEvents.ts: trackPageView, trackLead, trackMetaEvent, trackPurchase
- [x] Eventos disparados na landing page: PageView (carregamento), Lead (CTA principal), InitiateCheckout (botão assinar)
- [x] noscript do Pixel movido para o body (correção do warning parse5)
- [ ] Fazer push para GitHub

## Fase 63: Purchase CAPI via Webhook Kiwify (11/05/2026)
- [x] Integrar sendMetaEvent("Purchase") no webhook da Kiwify (order_approved)
- [x] Enviar valor, moeda, email e telefone hasheados para o Meta
- [ ] Fazer push para GitHub

## Fase 66: Tradução 100% — Corrigir textos PT hardcoded (14/05/2026)
- [x] Corrigir Contratos.tsx (status, modalidades via t())
- [x] Corrigir NovoContrato.tsx (labels do formulário via t())
- [x] Corrigir Parcelas.tsx (StatusBadge, modal de pagamento, placeholders via t())
- [x] Corrigir Caixa.tsx (labels de conta e operações via t())
- [x] Corrigir Cheques.tsx (STATUS_CONFIG, labels e placeholders via t())
- [x] Corrigir Clientes.tsx (botão Concluir via t())
- [x] Corrigir Configuracoes.tsx (botão Salvar Dados da Empresa via t())
- [x] Corrigir ClienteDetalhe.tsx (labels de contato, identificação, endereço e score via t())
- [x] 51 novas chaves adicionadas ao pt-BR.json e es.json (rodada 1)
- [x] Corrigir Relatorios.tsx (placeholders, labels, botões via t())
- [x] Corrigir Assinaturas.tsx (placeholders, mensagens de vazio, labels via t())
- [x] 13 novas chaves adicionadas (total: 2.299 chaves em pt-BR e es)
- [x] TypeScript: 0 erros
- [x] Fazer push para GitHub

## Fase 67: Teste Completo do Fluxo (14/05/2026)
- [ ] Dashboard: KPIs, gráficos, saúde da carteira
- [ ] Clientes: criar, editar, detalhe, score
- [ ] Empréstimos: criar todos os tipos, pagar parcela, pagar só juros, renovar
- [ ] Parcelas: filtros, modal de pagamento, comprovante PDF
- [ ] Caixa: contas, transações, saldo
- [ ] Cheques: criar, compensar, devolver
- [ ] Relatórios: empréstimos ativos, inadimplência, extrato PDF
- [ ] Assinaturas: criar, renovar
- [ ] Veículos: criar, pagar parcela
- [ ] Configurações: salvar dados da empresa
- [ ] Troca de idioma PT → ES: verificar todas as telas
- [ ] Corrigir todos os bugs encontrados

## Fase BUGS: Bugs Encontrados nos Testes (14/05/2026)
- [x] BUG: Caixa - conta criada não aparece na lista (corrigido: campo ativo em vez de ativa, saldo em vez de saldo_inicial)
- [x] BUG: Parcelas - página mostra "0 parcelas" mesmo com contratos ativos (era temporário, está funcionando)
- [x] BUG CRÍTICO: Criar parcela manual falha com erro "null value in column violates not-null constraint" (corrigido: campo numero NOT NULL agora preenchido no insert)
- [x] BUG: Tabs Diário/Parcela Fixa - contagem sempre 0 (corrigido: filtro por modalidade)
- [x] BUG: Lucro Realizado - sempre R$0 (corrigido: cálculo totalPago - capitalProporcional)
- [x] FEATURE: Adicionar campo de busca/pesquisa no dropdown de seleção de cliente no formulário de criação de empréstimo (implementado: Combobox com Popover + Command)
- [x] BUG CRÍTICO: Relatórios mostra todos os valores zerados (corrigido: dashboard.kpis fallback REST agora usa campo ativo e saldo corretos)
- [x] BUG: Textos hardcoded em espanhol (Etiqueta, Detalhes, Comprovante, Cobça preventiva) - corrigidos com chaves de tradução
- [x] BUG: Botão Fechar hardcoded - corrigido com t('common.close')
- [x] BUG CRÍTICO: Empréstimo Diário - cálculo errado (corrigido: Total = Capital × (1 + taxa/100), Parcela = Total ÷ nº parcelas)
- [x] FEATURE: Adicionar botão "Pagar" em cada linha de parcela pendente na tabela de detalhes do contrato (implementado: botão Pagar com modal de pagamento individual)
- [x] BUG CRÍTICO: Pagar Juros marca contrato como quitado incorretamente (corrigido: nova parcela agora usa valor_parcela do contrato, não apenas os juros pagos)
- [x] BUG CRÍTICO: Não é possível excluir empréstimo (corrigido: deletar transacoes_caixa antes das parcelas, e parcelas antes do contrato)
- [x] BUG CRÍTICO: Pagar juros não criava nova parcela (campo contagem_renovacoes inexistente causava insert silencioso) - corrigido: removido campo inválido, adicionado tratamento de erro, 6 contratos afetados restaurados
- [x] TESTE: Verificar fluxo "Pagar Juros" nos contratos restaurados (35, 36, 37, 39, 49, 62) - confirmado: nova parcela criada corretamente
- [x] FEATURE: Notificação de erro visível - backend agora lança TRPCError quando insert falha (toast de erro já funciona no frontend)
- [x] BUG: Contratos na aba do cliente mostravam valores zerados (snake_case vs camelCase na procedure contratosByCliente - corrigido com mapeamento)
- [x] BUG: Denominador de parcelas incorreto após renovação de juros (usava numero_parcelas do contrato em vez do maior numero_parcela real - corrigido com totalParcelasMap)
- [x] BUG: Caixa - transações não apareciam (user_id null em todos os inserts de transacoes_caixa - corrigido em 7 pontos do backend + 53 registros históricos corrigidos no banco)
- [x] BUG: Relatório - Fluxo de Caixa vazio (causado pelo mesmo bug de user_id nas transações - corrigido automaticamente)
- [x] MELHORIA: Relatório - gráfico "Status das Parcelas" agora tem toggle "Todas ativas" / "Período" com "Todas ativas" como padrão
- [x] VERIFICAR: Página Caixa - transações históricas aparecem corretamente após correção de user_id
- [x] BUG: Score de Clientes em branco (Max Depth na serialização tRPC - procedure listarComScore retornava spread de objeto Drizzle - corrigido com mapeamento explícito)
- [x] BUG: Backup mostrando "—" e "0 registros" (campo created_at inexistente na tabela clientes - corrigido para createdAt no backup router)
- [x] BUG: caixa.contas causando Max Depth (spread de objeto Drizzle com referências internas - corrigido com mapeamento explícito de campos)
- [x] SEGURANÇA: registrarPagamento e pagarJuros buscavam parcela por id sem filtrar por user_id (vulnerabilidade de acesso entre contas - corrigido adicionando .eq('user_id', ctx.user.id))
- [x] BUG: Lucro Previsto multiplicando incorretamente (estava multiplicando juros/parcela × parcelas abertas - corrigido para totalReceber - capitalRestante)
- [x] FEATURE: Botão deletar parcela na tabela de detalhes do contrato (parcelas pendentes)
- [x] BUG: Lucro Realizado com fórmula errada (capitalProporcional por parcelas pagas → corrigido para totalPago - valorPrincipal)
- [x] MELHORIA: Coluna "Pago" na tabela de parcelas do modal mostrando valor efetivamente pago (verde) ou traço para pendentes

## Fase atual: Login permanente com e-mail/senha
- [x] FEATURE: Login permanente com e-mail/senha (ultracrediuc@gmail.com / 97556511) - usuário criado no Supabase
- [x] FEATURE: Página de login com e-mail/senha já existia e funciona
- [x] BUG: Parcelas.list sem filtro userId - corrigido
- [x] BUG: Inadimplência mostrando 0 - corrigido para buscar pendente+atrasada com vencimento < hoje
- [x] FEATURE: Endpoint heartbeat /api/scheduled/update-parcelas-status para atualizar status diariamente
- [x] FEATURE: Scheduled task diária para atualizar status de parcelas vencidas
- [x] FEATURE: Troca de idioma PT/ESP na página principal (landing page) - todos os textos traduzidos com react-i18next
- [ ] FEATURE: Tradução PT/ES na página de Login
- [ ] FEATURE: Persistência do idioma preferido no banco (coluna idioma na tabela users)
- [ ] FEATURE: Carregar idioma do usuário ao fazer login
- [ ] FEATURE: Salvar idioma ao trocar no LanguageSwitcher (usuário logado)

## Fase 50: Sistema de Rastreamento de Login (Admin)
- [ ] Criar tabela login_logs no Supabase (id, user_id, ip, cidade, regiao, pais, latitude, longitude, user_agent, dispositivo, navegador, os, created_at)
- [ ] Capturar IP + geolocalização via ip-api.com no endpoint de login e salvar em login_logs
- [ ] Criar procedure tRPC admin.getLoginLogs (somente role=admin)
- [ ] Criar página AdminLoginLogs.tsx com tabela de logs visível só para admin
- [ ] Adicionar rota /admin/login-logs no App.tsx e no menu lateral (só admin)


## Fase 60: Correção de Bug - Documentos não salvando
- [x] Corrigir mapeamento snake_case → camelCase no backend (mapClienteFromRest)
- [x] Aplicar mapClienteFromRest nas procedures list e byId de clientes
- [x] Corrigir layout do modal: adicionar min-h-0 ao conteúdo e shrink-0 ao footer
- [x] Corrigir handleSalvar: sempre enviar documentosUrls (mesmo quando vazio)
- [x] Desabilitar botão Concluir durante upload de documentos (uploadingDoc)
- [x] Aplicar min-h-0 ao modal de Empréstimos também
- [x] Testes vitest: 14 testes de clientes.documentos.test.ts passando

## Fase 61: Gerenciamento de Documentos na Página de Detalhes do Cliente
- [x] Adicionar botão "Adicionar Documento" na aba Docs da página ClienteDetalhe.tsx
- [x] Implementar upload de arquivo diretamente na aba Docs (sem abrir modal de edição)
- [x] Implementar remoção de documento diretamente na aba Docs
- [x] Criar procedure backend clientes.updateDocumentos para atualizar apenas documentos_urls
- [x] Exibir feedback visual durante upload (loading spinner)
- [x] Testes vitest para a nova procedure (18 testes passando)

## Fase 50: Blacklist Compartilhada entre Assinantes
- [x] Schema: tabela `blacklist` global (sem userId isolado) com campos completos
- [x] Schema: tabela `blacklist_fotos` para múltiplas fotos por registro
- [x] Migração SQL aplicada no Supabase
- [x] Enum: `status_blacklist` (ativo, resolvido, em_negociacao)
- [x] Enum: `tipo_divida_blacklist` (emprestimo, servico, produto, aluguel, cheque, outros)
- [x] Procedure `blacklist.criar`: qualquer assinante autenticado pode cadastrar
- [x] Procedure `blacklist.consultar`: busca por CPF/CNPJ ou nome (todos os assinantes)
- [x] Procedure `blacklist.listarTodos`: paginação, filtros por status/tipo
- [x] Procedure `blacklist.listarMeus`: apenas registros do usuário logado
- [x] Procedure `blacklist.atualizar`: somente quem cadastrou pode editar
- [x] Procedure `blacklist.deletar`: somente quem cadastrou pode deletar
- [x] Procedure `blacklist.uploadFoto`: upload S3 e salva URL na blacklist_fotos
- [x] Página /blacklist: consulta global com busca por CPF/CNPJ/nome
- [x] Página /blacklist/nova: formulário completo de cadastro
- [x] Página /blacklist/meus: meus registros com editar/deletar
- [x] Menu lateral: item "Blacklist" com ícone
- [x] Testes Vitest para procedures de blacklist (14 testes passando)
- [x] Checkpoint e deploy

## Fase 62: Criação Manual de Conta
- [x] Criar conta limpa para solucoesunicredi@gmail.com e validar o login

## Fase 63: Integridade do Caixa e Despesas
- [x] Auditar divergências entre saldo das contas e movimentações financeiras da Ultra Credi
- [x] Garantir atualização automática do Caixa, sem depender de ajustes manuais recorrentes
- [x] Corrigir o lançamento de despesas para refletir o débito exatamente uma vez no Caixa
- [x] Implementar estorno/exclusão segura de despesa com reversão financeira auditável
- [x] Adicionar testes de regressão para entradas, saídas, ajustes e estornos de Caixa
- [ ] Validar saldos existentes e corrigir inconsistências identificadas com trilha de auditoria

## Fase 64: Recuperação de Hospedagem
- [x] Reativar os recursos de hospedagem do CobraPro após a regularização do saldo no DigitalOcean
- [x] Confirmar o retorno de cobrapro.online antes de publicar a correção de Caixa

## Fase 65: Automação de WhatsApp para Vencimentos
- [x] Comparar Evolution API com a API oficial do WhatsApp e definir a integração do CobraPro
- [x] Mapear a conexão atual do WhatsApp e as regras de parcelas elegíveis
- [x] Criar configurações por assinante para ativar, desativar e personalizar os lembretes
- [x] Registrar cada envio e bloquear mensagens duplicadas por parcela e tipo de lembrete
- [x] Implementar lembrete automático três dias antes do vencimento
- [x] Implementar lembrete automático no dia do vencimento
- [x] Programar execução confiável a cada cinco minutos e criar testes de regressão
- [x] Configurar gatilho autenticado que execute a rotina no cobrapro.online, e não apenas no ambiente de desenvolvimento

## Fase 66: Relatório Diário Automático do Gestor
- [x] Enviar automaticamente o relatório diário para o próprio WhatsApp do assinante no horário configurado
- [x] Registrar o envio diário e impedir duplicidade por conta e data
- [x] Incluir o relatório diário na rotina autenticada de produção sem afetar os lembretes dos clientes
- [x] Validar o envio em modo seguro e publicar a automação

## Fase 67: Assinaturas Kiwify e cadastro transacional — 10/11/2026

> Estado de liberação desta fase prevalece sobre itens históricos marcados como completos. Usuários existentes são manuais; não há comprovação de assinatura Kiwify deles e não foi autorizada concessão manual de Blacklist.

- [x] Confirmar origem manual dos usuários e manter suas credenciais, papéis e saldos intactos.
- [x] Confirmar destino do webhook do produto CobraPro e API OAuth com leitura de vendas.
- [x] Preparar gate Kiwify sem inferir acesso por cadastro, papel admin ou concessão vitalícia.
- [x] Completar localmente a criação automática de comprador novo apenas por venda paga confirmada na API (1.574 testes integrados aprovados; ativação ainda pendente).
- [x] Persistir convite individual antes do envio, distinguir aceite de entrega e proteger reentrega concorrente.
- [x] Validar migration de identidade no schema produtivo preservado e sob defaults de ACL Supabase (4.117 linhas intactas).
- [x] Instalar migrations 0027/0028 aditivas sem criar compradores fictícios ou alterar contas existentes (10/11 15h19–15h20 BRT).
- [x] Renovar login DigitalOcean e configurar credenciais cifradas somente no runtime do backend.
- [x] Configurar e conferir a persistência de aprovação, renovação, atraso, cancelamento, reembolso e chargeback no webhook CobraPro.
- [ ] Confirmar o tipo de cobrança que fornece assinatura e data de acesso documentadas; compra única não comprova assinatura vigente.
- [x] Habilitar o processamento após deploy e validar HMAC real (400 para corpo sem pedido, 401 para assinatura incorreta; nenhuma compra ou mensagem).
- [x] Instalar 0030/0029 e comprovar referência privada, RLS e ACL mínima exclusiva do backend; nenhuma concessão a usuário.
- [ ] Liberar Blacklist e fotos privadas somente mediante vigência Kiwify comprovada.
- [ ] Confirmar um primeiro pedido real de ponta a ponta antes de declarar o fluxo integral testado em produção.

## Fase 68: Acesso manual previamente autorizado — estado de 10/11

> A decisão operacional posterior substitui o gate exclusivamente Kiwify da fase 67 para as 14 contas existentes com concessão vitalícia auditada. O lote 5dbf966 foi publicado e implantado. Não há concessão automática para cadastros futuros. Kiwify, ofertas e decisões comerciais ficam suspensas conforme a orientação mais recente; este lote não as altera.

## Fase 69: Confiabilidade e liberação operacional — 12/11/2026

> Esta fase prevalece sobre declarações históricas amplas de conclusão. Nenhum ajuste automático de Caixa, tenant ou parcela antiga é autorizado. Uso seguro não significa aceitar registros divergentes nem liberar mutações REST antigas.

- [x] Acumular o Caixa em centavos exatos; detectar leituras incompletas, duplicadas ou entre empresas.
- [x] Corrigir criação/edição de clientes, confirmar gravação e validar dígitos de novos documentos sem adulterar documentos antigos omitidos.
- [x] Unificar relatórios e PDFs com o ledger, datas civis de Brasília, paginação completa e erro explícito em vez de zero fictício.
- [x] Remover a escrita financeira global em timer e as escritas em consultas; preservar status renovada e a conservação de principal.
- [x] Integrar seletor de recebimento por proveniência, cotação segura, proteção contra troca de sessão e recuperação de intenção somente com prova de não execução.
- [x] Preparar 0031/0033/0034, compatibilizar somente o CHECK produtivo equivalente e a instalação gerenciada; preflights e fontes desconhecidas continuam recusados.
- [x] Corrigir worker WhatsApp e revalidar 40 cenários PostgreSQL/SDK; preservar QR e workflow existente, sem enviar mensagem real.
- [x] Ligar confirmação WhatsApp aos dois recebimentos validados, com prova durável/dedup e sem transformar falha de fila em falha financeira.
- [x] Tree final certificado às10h05:2.218 testes aprovados,11 opt-in ignorados,135 arquivos aprovados,TypeScript ebuild aprovados; sem credenciais ou snapshots no Git.
- [x] Compatibilizar instalação com postgres não-superuser do Supabase, preservar preflight estrito e repetir ensaio conjunto no snapshot certificado.
- [x] Instalar hashes finais 0031/0033/0034 em 12/11 às09h54–09h55;56 tabelas comRLS,0 acesso público direto e contagens de usuários/parcelas/Caixa preservadas.
- [x] Smoke financeiro real segregado com rollback: criação, parcial/integral, despesa/estorno, renovação/replay, legado/prova privada e fence contra execução do UUID encerrado. Zero registros de teste persistidos ou comunicações externas.
- [x] Checkpoint e push normal afceb023; rollout b1c9665c live, com apenas duas flags operacionais novas de runtime.
- [x] Smoke autenticado de capacidades, dashboard, clientes, despesas, parcelas, relatórios e recusas de cotação. WhatsApp conectado e agenda existente preservada; sem mensagens ou operações em contas reais.
- [ ] Concluir hotfix de caixa.contas: remover banco inexistente da projeção e mostrar erro/retentativa em vez de zero fictício na UI; preservar DATE civil e validar o novo deploy.
- [ ] Revisão humana dos dados antigos inconsistentes permanece independente e obrigatória; nenhum UPDATE financeiro automático.

**Infraestrutura:** painel de 12/11 informa US$ 36,00 em atraso e risco de suspensão após 14/11. Nenhum pagamento foi realizado.

## Fase 70: Smoke pós-hotfix do Caixa — 12/11/2026

- [x] Hotfix de projeção física b7a2f29 publicado e live às 10h38min29, sem DDL/DML ou mudança de flags.
- [x] Confirmar que o novo bloqueio é financeiro real (412): 12 transações com proprietário divergente em duas contas. Tipos INTEGER confirmados; nenhum ajuste feito.
- [x] Renovar ficha restrita de revisão fora do Git, com valores exatos e hashes; 0 decisões/aprovações preenchidas.
- [x] Desativar retry automático só nas leituras do Caixa, preservando retentativa manual; 2.280 testes, 11 opt-in ignorados, TypeScript e build aprovados.
- [ ] Publicar o ajuste de retry e comprovar a apresentação final da recusa sem zero fictício ou loading permanente.
- [ ] Resolver titularidade/divergências somente após análise e aprovação por registro; contas inconsistentes não estão liberadas para uso irrestrito.

## Fase 71: Consistência de leitura e liberação condicional — 12/11/2026, 15h BRT

- [x] Revalidar em contagens: 12 lançamentos com owner divergente em 2 contas; 6 parcelas com owner/cliente nulo. Nenhum UPDATE, backfill ou ajuste de saldo.
- [x] Corrigir o bypass de leitura: resumo, KPIs, gráficos, relatórios, score e prévia diária conferem o livro das contas próprias antes de filtros de período/owner/categoria.
- [x] Somar saldos e capital em centavos exatos, confirmar paginação e recusar dados ausentes/truncados/duplicados sem zero fictício.
- [x] Certificar 2.350 testes aprovados, 11 opt-in ignorados, TypeScript e build; revisar fronteiras e excluir segredos conhecidos/arquivos privados.
- [x] Publicar checkpoint/push normal `126fa45b`; execução DO `31a21ea0` live às 15h20. Backend autenticado recusa seis endpoints com 412; Caixa e relatórios bloqueiam certificado falso/PDF incompleto. Clientes/WhatsApp preservados; sem mutações.
- [x] Corrigir localmente o estado concluído sem dados no dashboard: indisponibilidade explícita, retry manual somente leitura e fim do retry automático das cinco consultas certificadoras. Dez testes React e TypeScript aprovados.
- [x] Certificar a suíte completa após o ajuste visual: 2.353 testes aprovados, 11 opt-in ignorados, TypeScript/build e diff check aprovados às 15h29.
- [x] Publicar checkpoint/push normal `1484e5bf`; DO `43398ff0` live às 15h35min43. Bundle exato e UI autenticada às 15h36: banner de revisão, retry manual, KPIs/score/gráficos indisponíveis sem reticências permanentes. 159 regressões pós-push aprovadas; 12/2/6 e RLS 56/56/0 preservados.
- [ ] Obter comprovação e aprovação por registro antes de sanear o legado ou anunciar liberação financeira irrestrita.

Kiwify/ofertas/WhatsApp/QR e flags existentes permanecem sem alterações. O alerta DigitalOcean de US$ 36,00 em atraso, com prazo antes de 14/11, continua presente; nenhum pagamento foi iniciado.

## Fase 72: Cadastro operacional sem gates indevidos — 13/11/2026
- [x] Retirar os gates de erro/carregamento da LISTAGEM sobre Novo Cliente/importação e manter rascunho aberto após erro de refetch; 51 testes específicos aprovados.
- [x] Separar metadados das contas do agregador de saldo no cadastro de empréstimo; manter validação da conta escolhida e cliente/tenant na RPC.
- [x] Corrigir disponibilidade presa por Promise única e a corrida de inicialização Supabase; seletores não apresentam cache de outra empresa.
- [x] Corrigir leituras de lista/ficha: falha não vira vazio/inexistência; cliente próprio sem embed e parcelas conferidas por metadados antes de valores.
- [x] Encaminhar pagamentos/detalhes dos cards à ficha com fluxo de origem validado; invalidar consultas após criação e abrir ID confirmado sem repetir mutation.
- [x] Certificação final às 22h51: 2.439 testes, TypeScript/build e diff check aprovados. Contagens produtivas read-only 12/2/6 e RLS 56/56/0 preservadas.
- [x] Checkpoint/push/rollout e smoke `68f5d5c` concluídos em 13/11 e reconfirmados live/Healthy em 16/11. Comprovação no status externo de 13/11.
- [ ] Revisão humana de registros históricos permanece separada. Nenhum UPDATE, saneamento, flag financeira, Kiwify/oferta ou WhatsApp foi alterado.

## Fase 73: Liberação prospectiva multimodal — 16/11/2026
- [x] Baseline anterior `68f5d5c` reconfirmado live/Healthy na DigitalOcean; aplicação HTTP 200.
- [x] Cinco modalidades com cálculo exato e agenda civil, recebimento integral/parcial e renovação sucessiva elegível sem novo desembolso.
- [x] Coexistência validada de mensal/despesa/recebimento legado na mesma conta sem autorizar escrita sobre cohort multimodal.
- [x] Isolamento de formulário/cache/UUID, recuperação autoritativa, storage e respostas/handlers antigos; ciclo da intenção anterior preservado na entrada.
- [x] Lista/ficha com parcela aberta real, juros por composição, pagamentos registrados e residual sem duplicação; lucro conservador não é saldo certificado.
- [x] Gate final ampliado: 2.759 testes, TypeScript/build/diff check; PG17 adversarial/concorrência, SDK e QueryObserver reais; SQL anterior intacto e fronteira sem segredos conhecidos.
- [x] Preflight produtivo read-only: PG17/owner, corpos/assinaturas/rowtypes compatíveis; 12/2/6 e RLS56/56/0 preservados antes da instalação.
- [x] Checkpoint, instalação prospectiva 0035 e push fast-forward; `533e131` live/Healthy às 18h25min48. RLS65/65/0, ACLs e 12/2/6 preservados; zero origens novas às 18h33. Proteção de senha 0016 comprovada e preservada.
- [x] Corrigir envelope booleano `success` do SDK sem aceitar confirmação falsa e refetch circular por montagem; 170 regressões direcionadas e gate completo aprovados.
- [x] Complemento `46238e2` live/Healthy às 18h41min26; bundle exato e cadastro de cinco modalidades pronto às 18h42. Cotação de ID inexistente NOT_FOUND e ficha null; RLS65/65/0 e 12/2/6 preservados, zero origens novas. Nenhum empréstimo/mensagem criado pelo smoke.
- [x] Recuperação da agenda nativa comprovada em 20/11: duas execuções novas success/HTTP200 às 21h36 e 21h37 BRT, sem CONFIGURACOES_INDISPONIVEIS. Enviados/elegíveis zero; comprova execução, não entrega nem frequência contínua.
- [ ] Revisão humana de dados antigos continua separada. Sem alterações de Kiwify/oferta/Blacklist/WhatsApp/flags e sem correções automáticas de saldos ou tenant.

## Fase 74: Correções do vídeo e controles WhatsApp — 16/11/2026

- [x] Preservar seleção própria no refetch e formulário multimodal durante reconferência de sessão; troca real de empresa continua segregada.
- [x] Datas iniciais/vencimento automáticos BRT, com preservação de datas manuais e de payload original; validação de campo faltante não é erro de transporte.
- [x] Validação WhatsApp sem envio, teste em número explícito e processamento confirmado da própria empresa, com histórico e callbacks segregados por geração.
- [x] Credencial backend Manus atualizada via formulário seguro e teste negativo HTTP200; nenhum segredo no Git.
- [x] Certificação final fechada: 2.933 testes aprovados, 11 opt-in ignorados, TypeScript/build/diff check aprovados. Sem DDL/DML produtivos, alteração de flags, Kiwify/oferta ou Blacklist neste lote.
- [x] Lote `b63a6d07` publicado DigitalOcean em 16/11 às 20h12min46 BRT, reconfirmado local/GitHub/live em 20/11. Controles próprios e Validar sem enviar concluídos no site oficial; nenhuma operação financeira ou mensagem produtiva criada.
- [x] Publicação Manus `b63a6d07` concluída; agenda existente executou novamente em 20/11 às 21h36 e 21h37 BRT com HTTP200, success e sem CONFIGURACOES_INDISPONIVEIS. Sem entrega nova comprovada.
- [ ] Implementar multa manual fixa RECEBÍVEL nas transições auditadas. Protótipo de registro lateral foi rejeitado e arquivado fora do Git; não instalado nem incluído neste lote. Não declarar multa liberada.
- [ ] Revisão humana por registro das divergências históricas, sem atribuição automática de empresa/valores.

## Fase 75: Multa manual fixa atômica — 23/11/2026

- [x] Implementar aplicação fixa sem movimento de Caixa, recebimento integral/parcial congelado, renovação elegível com principal único e sucessora limpa.
- [x] Schemas/SDK/backend/UI strict, UUID/recovery/fence e isolamento de intenção/cache por empresa; recorte apenas origem35 íntegra.
- [x] Cotação de renovada comprovada preserva pago=juros+multa+mora e total0; cancelada sem prova é recusada.
- [x] Corrigir corrida REST/cotação que omitia sucessora: reconferência completa dos IDs/vínculos e cotação final do snapshot, sem cálculo parcial ou retry financeiro.
- [x] Gate final: 3392 testes aprovados/11 opt-in ignorados; 158 arquivos aprovados/3 ignorados, TypeScript/build/diff check. PG17 independente:22 grupos aprovados, sem declarar teste dedicado0031.
- [x] Migration0036 SHA7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f, 71 predecessoras e3 extensões previstas; SQL anterior intocado.
- [x] Checkpoint904e614e e instalação produtiva exata às23h31 BRT: verifiers34/35/36 verdes, RLS75/75/0, ACL36 privadas e zero novas operações/origens36. Hashes integrais das quatro tabelas financeiras idênticos antes/depois;12/2/6 preservados.
- [x] Push fast-forward `2ce2f6cb`; DO159591e0 Live/Healthy às23h37; bundle oficial exato SHA2a12193e0a3304934b7546671dd36b7fbd8ccfb24f9258230c15dbadbe0e96c6. Regressões pós-push490/490; publicação Manus concluída.
- [x] Smoke oficial read-only: cinco modalidades/cadastro próprio, capacidade36 true, três consultas de IDs inexistentes NOT_FOUND e ficha sem crash. Sem ficha própria para teste financeiro real; nenhum submit ou mensagem. Postflight23h40 e hashes financeiros integrais idênticos ao antesDDL,12/2/6 preservados.
- [x] Reconfirmar produção24/11 às00h36 somente leitura: HTTP200, verifiers34/35/36PASS/cap36true, RLS75/75/CRUD0/sem resíduos36 e quatro hashes integrais idênticos. Nenhum impacto atual do bug de autovacuum observado em produção.
- [x] Certificar/instalar hotfix preventivo36a separado:61 checks locais/44 negativas/manutenção e autovacuum reais, SQLdf1abe... instalado24/11 às01h11BRT com selo ORIGINAL válido;98/98 fontes finais sem drift,75/75RLS/zeroLeaks e snapshots financeiros antes/depois idênticos. Somente seis campos voláteis excluídos; não ressela drift arbitrário nem toca dinheiro/provas/tenant. SQL0036 permanece SHA7194...; commits isoladosf02c6c3/checkpoint89f1668d sem37.
- [ ] Próximos lotes: manutenção de despesas38; reparcelamento e trilhos de vendas/veículos/cheques. Aporte/transferência37 publicado no contrato próprio abaixo; não afirmar liberação100% antes da certificação das frentes restantes.

## Fase 76: Aporte e transferência atômicos37 — instalado/publicado com limites, 24/11/2026

- [x] Implementar contratos strict, cinco RPC adapters protegidos e UI com quote SQL autoritativo, request/UUID congelados e recuperação sem retry financeiro/fallback.
- [x] Integrar à página Caixa com metadados próprios sem saldo, recuperação acessível durante falha de consultas e isolamento de cache/callbacks A→B→A; remover writers genéricos da UI/backend.
- [x] Preservar NovaConta como fluxo cadastral preexistente separado, sem declarar cadastro de conta certificado pela RPC37.
- [x] Corrigir snapshot predecessor global37 para escopo da empresa/vínculos e comprovar corrida A37/B35 independente sem falso erro de integridade.
- [x] Reforçar preflight físico37 por fontes versionadas pinadas, preservar seis extensões exatas e SQL20..36; duas bases freshPG17 da matriz inicial passaram com11 novos drifts físicos negativos em24/11 às00h12.
- [x] Validar cinco envelopes SQL reais sintéticos via SDK/shared/backend:23 testes, mais52 da página real; sem operação financeira ou mensagem produtiva.
- [x] Gate CANDIDATO79dd:3687PASS/11SKIP,164arquivosPASS/3SKIP, TypeScript/build/diff verdes às00h15. Não é certificação final: testes avançados posteriormente encontraram bugs reais.
- [x] Corrigir e revalidar20 confirmações inválidas de provas sintéticas37: schema exato e reconstrução de quote/resultado contra estado físico histórico congelado, pin causal primeira_op. Runtime2acc em duas freshDB rejeitou todos os casos23514, incluindo novas variantes missing_pernas e quote falso coerente; zero achados finais. Ainda local à época desta prova; instalação posterior registrada abaixo.
- [x] Completar P0 runtime de virada BRT pós-lock, falhas antes/depois de cada perna/proof/seal, adulteração NEW/extraefeito, capabilities37 adversariais, prova corrompida e restart PG17 real;56 grupos PASS/zero falhas em duas freshDB sobre SQL2acc, zero resíduos e replay histórico preservado. Não substitui convivência ou certificação global37.
- [x] Completar convivência contratual37:38 dedicadas/486 seleções e equivalentes originais,0 falhas,32 locks/14tryfail,sete writers em ambos sentidos,create/reparent,stress e manutenção real. Setup36 original9PASS/fresh pré37. Limites:36 omissões nominais/26 gaps shadow de alcance, não negativas descartadas; nenhuma seleção é suíte full antiga sobre37. Decisão GO local restrito e mapeamento das fronteiras reais documentados em RESULT.md/docs; não alegar cobertura integral/universal ausente.
- [x] Gate completo final SQL2acc/harness coex final concluído24/11 às01h29:55BRT:3688PASS/11SKIP,165arquivosPASS/3SKIP,SQLvalidate/TypeScript/build/diffPASS. RESULT37/README consolidam decisão e limites; apenas ajustes de formato/documentação depois, SQL e código congelados. Não é plataforma100%.
- [x] Checkpoint12ec76b1/fronteira42files certificado, preflight imediato98/98 e instalação37exata2acc às01h36:11BRT. Postsource129/129/zeroDrift/verifiers34–37PASS,RLS82/82/CRUD0,sete tabelas37privadas/zeroLeaks/helpersserviceEXEC0/cincoRPCservice/zeroresíduos37/36.45 hashes/contagens históricos-financeiros idênticos; assinatura de três manifestos legitimamente re-selada excluída; tabelaextra parcelas_renovacoes preexistente ausente preservada. Quatro financeiros/divergências12/2/6 intactos; zero saneamento/financeiro/mensagem de teste.
- [x] Push fast-forward89f→efe1 às01h39:14; DO f75e671c commit efe1 exato Success/Live/Healthy às01h46:40; bundleDniMPhp2 SHA0eea85bc... byte-exato após primeira coleta divergente inconclusiva. Regressões pós-push377PASS/8files. Smoke oficial modais/metadados/cap37: cotaçãoaporte0.01 recusada PRECONDITION_FAILED412 na conta administrativa com livro não comprovado; transferência mesma conta desabilitada. Não houve quote entre duas contas/preview negativo emprod, pois seletor só tinha uma conta própria ativa. Nenhuma confirmação/recovery/mensagem. Pós-smoke01h54:129fontes/82RLS/ACL/zero37resíduos e JSONinteiro45+4 snapshots/contexto/ausência/anomalias12/2/6 idênticos. Não positivo financeiro produtivo nem plataforma100%.

Kiwify, ofertas, planos, Blacklist e configurações WhatsApp não integram este lote. Registros históricos divergentes permanecem preservados para revisão humana; nenhum saneamento automático ou retirada avulsa genérica foi liberado.

## Fase 77: Manutenção de despesas38 — próximo recorte, ainda não publicado

- [x] HotfixAPP B1/B2 separado: statusNULL/desconhecido torna resumo inconclusivo em vez de falsezero; recovery33 acessível com novas escritasOFF, mas criar/pagar/estornar/resend continuam gateados. Reprodução57RED→GREEN, aplicação byte-exata, targeted238PASS/7files comPG17físico33 e fullgate3730PASS/11SKIP/166filesPASS/3SKIP/TSC/build/check37/validatePASS às02h16:39. SemDDL/flags/dinheiro/mensagens; evidências e limites em tests/despesas-b1b2/RESULT.md.
- [x] Publicar hotfixB1/B2: checkpoint24fafda2/pushFF02h19:14/DO867aed16 cloneexato Success/Live/Healthy02h25:04; bundleBNaHUHxl SHA5ff1384d...1289340bytes byte-exato, pós-push154PASS/4files. Smokeadminlista própria vazia/resumo0/modalNova aberto-fechado semsubmit; não testarNULL/gateOFF/recovery fictício emprod. Pós-smoke129fontes/82RLS-ACL/45históricos(incluem4financeiros)+snapshotextra50despesas inteiros iguais e12/2/6preservados. Não é manutenção38 entregue nem100%.
- [ ] Congelar contrato38 de retificação cadastral sobreposta/auditada, cancelamento prospectivo não pago e arquivamento reversível, zeroledger. Estorno20/25 já existe; edição física de valor/vencimento, exclusão física e adoção de legado não são funcionalidades desse recorte.
- [ ] Implementar e certificar manutenção/recuperação/concorrência/isolamento38 emPG17 pós37 e instalação com preflight/reseal restrito governado. Não tocar SQL20–37 congelados nem instalar DDL38 para destravar sem esse gate.

## Fase 78: Liberação incremental — prioridades atualizadas em 24/11/2026 às20h32 BRT

Esta fase complementa, sem apagar, as pendências históricas. O usuário determinou fazer calendário, reparcelamento, manutenção de empréstimos/parcelas e despesas e automação WhatsApp, deixando cheques por último. Isolamento entre empresas é obrigatório; apenas Blacklist compartilhada. Não há autorização para saneamento de históricos divergentes, reenvio da mensagem única, fila geral, novo reinício ou alterações de Kiwify/ofertas.

- [x] Base oficial159e178b72b19aec9c97a1dbae8deede52bfd1c0 publicada: GitHub SHA completo, DigitalOcean Success/Live/Healthy e bundleDUYGfo0T byte-exato. Gate4011PASS/11SKIP/0FAIL, TypeScript sem cache/build/validate0; não certifica plataforma inteira.
- [x] Incrementos42/41/40 publicados com E2E real delimitado: recebimento de assinatura3; cadastro/recebimento/cancelamento de venda3 com compensações; criação/cancelamento de cheque1. Não repetir essas operações. Compensar/devolver cheque somente offline até nova comprovação.
- [x] Incrementos43/44/38c/45 instalados uma vez;38c ativado uma vez. E2E38c despesa62 cancelada sem baixa/Caixa e45 observação auditada1428 sem alterar os onze campos originais. Catálogo233/72 preservado e78 financeiros com72 idênticos/6 deltas legítimos.
- [x] Smokes somente leitura41/42 e recusas seguras43/44 registrados.44 não atende cadastro atual25; origens21 próprias0/operações44 próprias0. Nenhum cadastro ou alteração adicional44 foi enviado para forçar o teste.
- [ ] Prioridade1 — calendário compatível com cadastro atual25: implementar, testar Vitest ePG17, conferir catálogo, instalar, publicar e validar pela interface com dados próprios fictícios.
- [ ] Prioridade2 — reparcelamento dos empréstimos atuais: conservação do saldo real/histórico, sucessora recebível e teste real sem fabricar legado.
- [ ] Prioridade3 — alteração de juros/valores/parcelas/descontos e cancelamento de contrato: substituir caminhos antigos por operações auditadas e compensatórias, nunca apagar livro financeiro.
- [ ] Prioridade4 — edição/cancelamento auditado de despesas e recorrência: controles por empresa, baixa/origem preservadas e geração deduplicada sem débito automático do Caixa.
- [ ] Prioridade5 — agenda e recibos WhatsApp: corrigir o que for reproduzível e comprovar execuções/retornos reais, sem novos disparos ou processamento da fila geral nesta autorização.
- [ ] Por último — teste produtivo de compensação e devolução de cheques, após as demais prioridades.

Cada correção só será marcada concluída após sua prova delimitada e publicação confirmada; não marcar globalmente tarefas históricas nem afirmar100%semtravas. Desenvolvimento paralelo usa cópias privadas da base159e, com integração e publicação exclusivas pelo pai.

**Interrupção registrada em24/11 às20h40 BRT:** workflow `a77454ee9340` terminou às20h37:28 com erro `creditNotEnough`; as cinco frentes foram interrompidas e não continuam em segundo plano. Nenhuma correção46–50 foi instalada ou publicada. Cópias privadas e ponto de retomada preservados; código oficial continua na versão159e. Somente este checklist foi alterado no repositório durante a preparação. Não tratar a abertura das frentes como correções concluídas.

**Retomada real24/11 às21h16–21h21 BRT:** mesmo workflow concluído às21h16:47, failures[]. Os cinco candidatos são PARCIAIS; nenhum46–50 integrado/instalado/publicado.46 sóidentificação/recusa,47 sócotação. Revisão parent confirmou48 usa `rpc_criar_emprestimo`21 e recusa `multimodal_origens`; rótulo NOVO25 do relatório privado incorreto, sem GO para cadastro atual25.49 sucessão20 funcional emhardening deconcorrência para publicação independente.50 código callback/painel testado, execução/recibo/cadência externa ainda não provados. Continuação delimitada46 writerreal25 e49 hardening emcópiasprivadas; arquivosDDL20–45 permanecem byte-exatos, novas migrações podem propor evolução estritamente testemunhada de funções, sem falsificar operações ou resselo arbitrário. Cheques continuam porúltimo.

**Hotfix incremental callback50 aprovado24/11 às21h31 BRT:** somente `server/webhookRoutes.ts` e `server/webhookRoutes.processing.test.ts`; parser plano Evolution1.8.6 `{keyId,status}`, contradições ID/status, instância canônica, `fromMe:false`, status/header estritos e outbox de outra empresa recusados. Seis regressões adicionais parent incluídas. Gate único fresh:39targeted +97PASS/5arquivos adicionais; FULL4026PASS/11SKIP/0FAIL,184arquivosPASS/3SKIP; TypeScript `--incremental false`, build, validate37, gate e restauração exit0;925fontes semdrift. FrontDUYGfo0T1342084bytes SHAa4a4b747… permanece igual159e; backend784062bytes SHAa15e8b3e38b17a951a5647b5b6cc70aa3d1a67aafc2d727dcfcfcb9b3af05755. Preflightprod21h26 catálogo233/72 exatamente igual pós-E2E,78financeiros capturados. NenhumDDL/flag/env/handler-agenda/painel50/envio/fila/financeiro integrado. Agenda nativa existente é de projeto e tem execuções naturais HTTP200 observadas; compatibilidade do handler50 em correção separada, sem criar cron duplicado. Checkpoint/push/deploy desta correção do parser a seguir; NÃO recibo real comprovado nem liberação geral das prioridades.

## Incremento50 — agenda WhatsApp isolada, 24/11/2026 22h45 BRT

- [x] Handler nativo autentica pelo SDK e taskUID durável; distingue projeto e tenant, sem adotar owner sintético ou ID fornecido no corpo.
- [x] Preservados callback Evolution d2, capacidade GitHub/HTTP global, configurações OFF e deduplicação existentes; nenhuma mensagem manual ou fila geral executada nesta validação.
- [x] Painel diferencia aceite Evolution, entrega e leitura; heartbeat é observação, não prova de entrega ou cadência. Resposta do backend antigo não quebra o painel nem inventa contadores.
- [x] Gate fresco schedule50-standalone-final-2211: PG17 12 cenários, RLS FORCED6/roles privadas NOSUPER/NOBYPASS/status3; targeted50 340 testes/15 arquivos; integração269/8; FULL4102 PASS/11SKIP/0FAIL; TSC --incremental false, build, validate37, restauração e gate exit0.925tracked/10untracked com drift[]/unexpected[].
- [x] Build frontend index-dqbLfVlf.js 1343623 bytes SHA256 deab2c90a764da7fe22ff2e47286bccb1b7fbad30f189a629dda3b403555ca0d; backend local788891 bytes SHA2567a88fb696ab66575e314109956f1a4bed5d5ef8af7e9cfdae0e7f9357b691791. Ainda não medidos em produção50.
- [ ] Registrar uma única linha de PROJETO NULL com UID existente cGt8wArds2oGUEpKbRJZo8, após checkpoint e guards. Sem criar, alterar ou executar cron.
- [ ] Publicar/checkpoint+GitHub, conferir versões Manus e DigitalOcean separadamente, frontend byte-exato e execuções NATURAIS; pós-integridade financeira78 e catálogo303.
- [x] Despesas49v3 preflight REALreadonly303=233finance+70pins estáticos PASS22h10; SQL6b44cc2b28565147605f4183154e42205953b1faee86f35fec9eec22975601bb. Ainda não instalado/habilitado/publicado.
- [x] Calendário46compat, reparcelamento47real e manutenção48real25 concluídos nas cópias privadas. Não liberados: precisam integração/gate físico/publicação/E2E.47/48 após46 estão em composição estrita, sem reseal de drift.
- [ ] Não alegar plataforma100%; cheques por último; sem Kiwify/ofertas, saneamento UltraCredi, mistura de empresas, novos envios WhatsApp ou reinício.

## Fechamento50 e incremento49v3 após50 —24/11/2026 22h58 BRT
- [x] Checkpoint50 f6757db4978d4d39eda64c08a094dc2c1d95c0e6 publicado Manus/GitHub; DO deployment4f688d73-71fd-4bee-b653-e537c0edabbd confirmado Sucesso/Implantação ao vivo/Saudável22h54. Frontend index-dqbLfVlf.js nos dois domínios1343623bytes/SHA256deab2c90a764da7fe22ff2e47286bccb1b7fbad30f189a629dda3b403555ca0d byte-exatos. Backend binário não medido em produção.
- [x] Registro50 COMMIT máximo1 confirmou row154/chave reservada de projeto/user_idNULL/UIDreal exato. Três execuções naturais22h53/54/55 manualfalse/HTTP200, correlacionadas por janelas únicas com três UUIDs internos, início/conclusão resultadook no projeto e owner4682. Recibos históricos amostrados inalterados; heartbeat não prova entrega/leitura nem cadência prolongada.
- [x] Pós50: catálogo303 e cinco digests estruturais iguais; financeiro78 inteiro/hash/count inalterado22h56 após execuções naturais. Sem envio manual/replay/saneamento/flags financeiras/roles/Kiwify/ofertas/reinício.
- [x] Integrados somente16arquivos49v3 após HEAD50 congelado:13originais+3deltas SQL/pre/post installer-only. SQL49 SHA2566b44cc2b28565147605f4183154e42205953b1faee86f35fec9eec22975601bb;15runtime originais byte-exatos. Preflight readonly303/233finance+70extras estáticos+verificadores reconfirmado22h56 sem DDL.
- [ ] Gate49 fresco oficial PG21/targeted/FULL/TSC sem cache/build/validate/restauração; checkpoint, instalação49 OFF, pós-integridade, push/publicação/habilitação mínima e E2E fictício koletor3 ainda pendentes. Candidato/cotação não é desbloqueio.
- [ ] Escopo49: descrição/categoria/vencimento/observações/motivo de despesa pendente prospectiva20 por sucessão auditada, valor preservado/Caixa zero. Recorrência, valor, legado e pós-baixa não liberados por este incremento.
- [ ] Calendário46 e composição reparcelamento47/manutenção48 separados; cheques por último. Não plataforma100%.

## Incremento49v3 — gate final aprovado24/11/2026 23h13 BRT

- [x] PG17 oficial21 cenários PASS; roles privadas NOSUPER/NOBYPASS, cluster parado/status3. As três tabelas49 usam RLS ENABLED, não FORCED; não confundir com tabelas50.
- [x] Direcionado115PASS/8arquivos e suplemento38c45PASS/1arquivo pela configuração própria; total160 testes direcionados. FULL4138PASS/11SKIP/0FAIL,190arquivosPASS/3SKIP/193total (contagem literal, não suites internas do JSON). TypeScript sem cache, build, validate37, gate e restauração exit0 às23h07:30.
- [x] 935tracked/14untracked íntegros, drift[]/unexpected[];16arquivos49 byte-exatos. Frontindex-pZlmWM__.js1356792bytes/SHA256d57eeccaca06a7ce0d5f101a92d65e06acb92021033170245b670d94b2d3a5fa; backend local795063bytes/SHA256f3fa2bfd491597cc1f11737ff9fc0f8c0f49789bf4b12fc8b166f11eac08c7f0. SQL49 6b44cc2b28565147605f4183154e42205953b1faee86f35fec9eec22975601bb congelado.
- [ ] Checkpoint49 antes do DDL; instalação OFF e pós-integridade; push e publicação Manus/DO, habilitação mínima única e E2E despesa fictícia NOVA koletor3. Ainda não entregue nem plataforma100%.
- [x] Calendário46 pacote privado pronto para integrar só após49 efetivamente liberado. Composição47/48 passou61cenários limitados mas revelou recusas de46 após repricing48 e47 após execução46/48; correção semântica privada em andamento, sem falsa ponte de criação ou remoção de isolamento.

## Fechamento real49 e gate46 — 24/11/2026 23h53 BRT

- [x] Incremento49v3 efetivamente concluído: checkpoint4b6ed6d0 completo, DDL49 instalada uma vez23h14, Manus publicado/GitHubFF e DO0046b61d Live/Healthy23h20, frontendpZlmWM__ byte-exato nos dois domínios. Habilitação49 mínima única23h20:30.
- [x] E2E49 real autorizado: despesa fictícia63 R$1 criada20, única edição49 por sucessão para64 pendente/energia/02-12-2026/dados editados; valor preservado, original alterada somente status+updatedAt, auditoria/origem20 intactas e sucessora20 genuína elegível. Zero pagamento/Caixa. Uma confirmação e recuperação/CAS terminal; não repetir63/64.
- [x] Histórico49: primeira comparação detectou fence novo esperado e foi preservada. Excluindo apenas63/64 owner4682, duas UUIDs20 exatas e fence49 UUID+owner+scope+family+requesthash exatos, 78 históricos tiveram counts/hash/columns idênticos; catálogo318 estrito pósE2E PASS. Não afirmar que quatro tabelas com novos registros do teste ficaram inteiras sem alteração.
- [x] Calendário46 integrado apenas após DEPLOY-PASS49:15arquivos restritos,3 existentes por hunks/12 novos;49/50 e demais fontes byte-exatos. Gate oficial23h45:41 PG17 NONSUPER/NOBYPASS14original+14after49strict, cleanup3;143 testes/9arquivos próprios +21/2 regressão49; FULL4138PASS/11SKIP/0FAIL,190arquivosPASS/3SKIP/193total. TSC --incremental false/build/validate37/gate/restauração exit0,949tracked/12untracked semdrift. SOURCEGUARD antes/após cada fase e parentprécheckpoint23h53 exatos.
- [x] Transporte46 equivalente aprovado em prova privada: SQL originalec67ec73246271771fcbe0e25fb9c235aaa437cba76e58330f4723ef739c0a0f/1100193bytes preservado; query executável de transporte0090adf4041ebfc7bf719baa419b17836f8d1a1e74526a85b6f0ee5f611191dd/985990bytes, uma representação JSON estática fatorada/oito objetos. Outras representações e todos11CREATE/corpos/pins byte-exatos; reconstrução independente parent exata,8/8JSONB iguais emPG17 eINSTALL-ONLY original vs transporte com funções/ACL/financeiro/todos10selos iguais, seis shutdown3. Não é identidade byte-a-byte do SQL inteiro nem prova produtiva.
- [x] Preflight46 real estrito readonly23h52:37 PASS e financeiro78 integral fresco23h52:40 capturado sem exclusões; rolesprod NONSUPER/BYPASStrue honestos, não alterados.
- [ ] Calendário46: checkpoint antesDDL, uma instalação atômica de transporte equivalente, postflight327/ACL/selos/78 integrais, GitHub/Manus/DO Live/frontend exato, ENABLE_CALENDARIO_0046 mínimo e E2E contratoNOVO25 autorizado ainda pendentes. Variável não vista emnenhum nívelDO; não habilitada nesta etapa. Não é liberação ainda.
- [ ] Reparcelamento47/manutenção48: pré-final privado63 cenários passou; dois PERFORM de integridade transitiva adicionados depois exigem nova prova dos hashes finais em andamento. Nunca usar PASSpré-final para bytes novos; nenhum47/48 oficial/produção. Cheques porúltimo; sem novos envios/cron/replay, Kiwify/ofertas, saneamento, mudança de roles ou reinícios. Não plataforma100%.
