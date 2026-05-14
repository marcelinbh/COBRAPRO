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
- [x] 51 novas chaves adicionadas ao pt-BR.json e es.json
- [x] TypeScript: 0 erros
- [ ] Fazer push para GitHub
