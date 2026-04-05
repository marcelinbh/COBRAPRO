# 📋 Checklist de Implementação - CobraPro vs Cobra Fácil

**Status Geral:** 40% Completo (10/25 funcionalidades)

---

## 🔴 FASE 1: Score de Clientes + Gráficos (CRÍTICA)

### Score de Clientes
- [ ] Nova página `/scores` com ranking de clientes
- [ ] Cálculo automático de score (0-131+)
- [ ] Algoritmo: parcelas em dia (+10), atrasadas (-5), lucro gerado (+1 por R$100)
- [ ] Badges: ⭐ Excelente (100+) | 👍 Bom (70-99) | 👌 Regular (40-69) | ⚠️ Ruim (<40)
- [ ] Filtro por score e por lucro
- [ ] Mostra: Principal, Lucro Quitados, Lucro Ativos, Lucro Extra
- [ ] Pontos de recuperação (+10 pts quando paga em dia)
- [ ] Atualização automática em tempo real
- [ ] Teste unitário do cálculo de score

### Gráficos no Dashboard
- [ ] Gráfico: Evolução Financeira (últimos 6 meses)
- [ ] Gráfico: Tendência de Juros Recebidos
- [ ] Gráfico: Distribuição por Modalidade (pizza)
- [ ] Integração com Chart.js ou Recharts
- [ ] Responsivo em mobile

---

## 🔴 FASE 2: Calendário + Relatório Operacional (CRÍTICA)

### Calendário de Cobranças
- [ ] Nova página `/calendar` com calendário mensal
- [ ] KPIs: A Vencer, Vencidos, Total no Mês
- [ ] Cores por tipo: 🟠 Empréstimo | 🔵 Veículo | 🟢 Produto | 🔴 Vencido
- [ ] Clique em data para ver detalhes dos vencimentos
- [ ] Navegação entre meses (anterior/próximo)
- [ ] Filtro por tipo de vencimento
- [ ] Exportação em PDF

### Relatório Operacional
- [ ] Nova página `/reports/operational` com dashboard completo
- [ ] **Fluxo de Caixa:**
  - [ ] Caixa Extra (entrada manual)
  - [ ] Saídas: Empréstimos concedidos, Contas a pagar, Custos extras
  - [ ] Entradas: Pagamentos recebidos
  - [ ] Resultado do período
- [ ] **KPIs:**
  - [ ] Capital na Rua
  - [ ] Juros a Receber (período)
  - [ ] Total Recebido (histórico)
  - [ ] Falta Receber
  - [ ] Em Atraso
  - [ ] Lucro Realizado
- [ ] **Gráficos:**
  - [ ] Evolução Mensal (últimos 6 meses)
  - [ ] Distribuição (pizza)
- [ ] **Filtros:** Data, Tipo de Pagamento
- [ ] **Exportação:** PDF
- [ ] Atualização em tempo real

---

## 🟠 FASE 3: Vendas de Produtos + Veículos (ALTA)

### Vendas de Produtos
- [ ] Nova página `/sales` com abas: Produtos | Contratos | Assinaturas
- [ ] **KPIs:** Total de Vendas, Total (R$), Recebido, A Receber
- [ ] **Filtros:** Todos | Em dia | Em atraso | Quitados
- [ ] **Novo Produto:** Formulário com:
  - [ ] Nome, Descrição, Cliente (busca ou manual)
  - [ ] Dados do cliente: Nome, Telefone, CPF, RG, Email, Endereço
  - [ ] Custo, Valor de Venda, Entrada
  - [ ] Nº de Parcelas, Frequência (Mensal, Quinzenal, etc.)
  - [ ] Primeiro Vencimento
  - [ ] Cálculo automático de margem de lucro
  - [ ] Notificação WhatsApp
- [ ] **Listagem:** Cards com status, cliente, valor, parcelas
- [ ] **Edição:** Editar dados do produto
- [ ] **Pagamento:** Registrar pagamento de parcela
- [ ] **Histórico:** Ver todas as parcelas
- [ ] **Exportação:** PDF

### Veículos Registrados
- [ ] Nova página `/vehicles` com gestão de vendas de veículos
- [ ] **KPIs:** Total, Quitados, Recebido, Lucro Total
- [ ] **Filtros:** Todos | Em dia | Em atraso | Quitados
- [ ] **Novo Veículo:** Formulário com:
  - [ ] Marca, Modelo, Comprador
  - [ ] Dados do comprador: Nome, Telefone, CPF, RG, Email, Endereço
  - [ ] Valor, Entrada, Parcelas
  - [ ] Placa, Renavam, Chassi
  - [ ] Alienação fiduciária (checkbox)
  - [ ] Documentação (upload)
- [ ] **Listagem:** Cards com status, comprador, valor, parcelas
- [ ] **Edição:** Editar dados do veículo
- [ ] **Pagamento:** Registrar pagamento de parcela
- [ ] **Histórico:** Ver todas as parcelas
- [ ] **Gerar Contrato:** PDF com dados do veículo
- [ ] **Exportação:** PDF

---

## 🟠 FASE 4: Contas a Pagar + Templates WhatsApp (ALTA)

### Minhas Contas a Pagar
- [ ] Nova página `/bills` com gestão de despesas
- [ ] **KPIs:** Total do Mês, Falta Pagar, Pendentes, Atrasadas, Pagas
- [ ] **Filtros:** Todas as categorias, Pessoais/Empresa
- [ ] **Status:** Todas | Vence Hoje | Pendentes | Atrasadas | Pagas
- [ ] **Nova Conta:** Formulário com:
  - [ ] Descrição, Categoria (Pessoal, Empresa, Fornecedor, etc.)
  - [ ] Valor, Data de Vencimento
  - [ ] Fornecedor, Observações
  - [ ] Recorrência (mensal, semanal, etc.)
- [ ] **Listagem:** Tabela com status, valor, vencimento
- [ ] **Edição:** Editar dados da conta
- [ ] **Marcar como Paga:** Registrar pagamento
- [ ] **Histórico:** Ver contas pagas
- [ ] **Exportação:** PDF
- [ ] **Notificações:** Lembrete 1 dia antes do vencimento

### Templates WhatsApp Avançados
- [ ] Adicionar abas: 🔴 Atraso | 🟡 Vence Hoje | 🟢 Antecipada
- [ ] **Variáveis dinâmicas:** {CLIENTE}, {VALOR}, {PARCELA}, {DATA}, {DIAS_ATRASO}, {DIAS_PARA_VENCER}, {JUROS_CONTRATO}, {MULTA}, {JUROS}, {JUROS_MULTA}, {TOTAL}, {PROGRESSO}, {PIX}, {ASSINATURA}, {FECHAMENTO}, {PARCELAS_STATUS}
- [ ] **Templates prontos:** Pré-configurados por tipo
- [ ] **Preview:** Mostrar mensagem com variáveis substituídas
- [ ] **Restaurar padrão:** Botão para voltar ao template original
- [ ] **Teste de envio:** Enviar para próprio WhatsApp
- [ ] **Histórico:** Ver templates usados

---

## 🟡 FASE 5: Comprovante PDF + Reparcelamento (MÉDIA)

### Comprovante em PDF
- [ ] Geração automática ao registrar pagamento
- [ ] **Dados no comprovante:**
  - [ ] Dados do empréstimo (cliente, valor, modalidade)
  - [ ] Valor pago, data, juros
  - [ ] Parcela (número, vencimento original)
  - [ ] Saldo restante
  - [ ] Assinatura digital (QR code com hash)
- [ ] **Envio automático:**
  - [ ] Email para cliente
  - [ ] WhatsApp com PDF anexo
  - [ ] Download no sistema
- [ ] **Armazenamento:** S3 com link permanente
- [ ] **Relatório:** Listar todos os comprovantes emitidos

### Reparcelamento
- [ ] Nova ação "Reparcelar" no card de empréstimo
- [ ] **Formulário:**
  - [ ] Nova data de vencimento
  - [ ] Novo número de parcelas
  - [ ] Recálculo de juros
  - [ ] Motivo do reparcelamento
- [ ] **Cálculo:** Juros simples sobre saldo restante
- [ ] **Histórico:** Ver todos os reparcelamentos
- [ ] **Comprovante:** Gerar PDF do reparcelamento
- [ ] **Notificação:** Enviar para cliente via WhatsApp

### Funcionalidades Complementares
- [ ] **Editar Juros:** Ajustar taxa após criação
- [ ] **Aplicar Multa:** Adicionar multa manual a parcela
- [ ] **Etiqueta:** Categorizar empréstimos com tags
- [ ] **Modo Claro/Escuro:** Toggle de tema
- [ ] **PWA:** Instalação como app nativo
- [ ] **Backup de Dados:** Exportação completa
- [ ] **Aulas do App:** Tutorial interativo

---

## 🟢 FASE 6: Testes + Deploy (FINAL)

- [ ] Testes unitários de todas as procedures
- [ ] Testes de integração (fluxos completos)
- [ ] Testes de performance (gráficos, relatórios)
- [ ] Testes de responsividade (mobile, tablet, desktop)
- [ ] Testes de segurança (validação de inputs)
- [ ] Checkpoint final
- [ ] Deploy no Digital Ocean
- [ ] Documentação atualizada
- [ ] Treinamento de usuários

---

## 📊 Estatísticas

| Fase | Funcionalidades | Status | ETA |
|---|---|---|---|
| 1 | 2 | 0% | 2 dias |
| 2 | 2 | 0% | 3 dias |
| 3 | 2 | 0% | 3 dias |
| 4 | 2 | 0% | 2 dias |
| 5 | 7 | 0% | 4 dias |
| 6 | - | 0% | 1 dia |
| **TOTAL** | **25+** | **0%** | **~15 dias** |

---

## 🎯 Próximos Passos

1. ✅ Auditoria completa do Cobra Fácil
2. ⏳ **AGORA:** Implementar Fase 1 (Score + Gráficos)
3. Implementar Fase 2 (Calendário + Relatório)
4. Implementar Fase 3 (Vendas + Veículos)
5. Implementar Fase 4 (Contas + Templates)
6. Implementar Fase 5 (Comprovante + Reparcelamento)
7. Testes e Deploy

