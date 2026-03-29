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
