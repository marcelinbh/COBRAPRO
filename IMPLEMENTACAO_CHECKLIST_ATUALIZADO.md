# 📋 Checklist Atualizado - CobraPro vs Cobra Fácil

**Status Geral:** ~85% Completo (21/25 funcionalidades) ✅

---

## ✅ JÁ IMPLEMENTADAS (21 funcionalidades)

### Core - Gestão de Empréstimos
- [x] Dashboard com KPIs (Capital, A Receber, Inadimplência, Juros)
- [x] Listagem de contratos com filtros
- [x] Novo contrato (Padrão, Diário, Price, Produto, Cheque)
- [x] Cálculo automático de parcelas e juros
- [x] Listagem de parcelas com status visual
- [x] Modal de pagamento (parcial, total, com desconto)
- [x] Cobrança via WhatsApp
- [x] Empréstimo Renovável (Bullet Loan)
- [x] Cálculo correto: valor_total = capital × (1 + taxa/100)
- [x] Pagamento só juros com renovação automática
- [x] Multa por atraso configurável (R$/dia)
- [x] Pasta do Cliente (agrupamento por cliente)
- [x] Cards estilo Cobra Fácil com KPIs

### Gestão de Clientes
- [x] Listagem de clientes com busca
- [x] Cadastro completo (3 abas: Dados, Endereço, Documentos)
- [x] Avatar com iniciais + upload de foto (S3)
- [x] Campos: CPF, CNPJ, RG, Instagram, Facebook, Profissão
- [x] Upload de documentos (S3)

### Gestão Financeira
- [x] Caixa com saldo em tempo real
- [x] Registro de transações (entradas/saídas)
- [x] Contas a Pagar (módulo completo)
- [x] Desconto de Cheques (módulo completo)
- [x] Vendas de Produtos (módulo completo)

### Relatórios e Análises
- [x] Calendário de Cobranças (mensal com cores)
- [x] Relatório de Empréstimos
- [x] Relatório de Inadimplência
- [x] Relatório de Fluxo de Caixa
- [x] Fechamento Diário

### Integrações
- [x] WhatsApp Business API (templates)
- [x] BREVO (Magic Links, lembretes, emails)
- [x] Recuperação de Senha
- [x] Portal do Cliente via Magic Link

### Gestão de Usuários
- [x] Koletores/Usuários com perfis (admin/gerente/koletor)
- [x] Relatório de performance por koletor
- [x] Reparcelamento com preview e execução

### Qualidade
- [x] TypeScript: 0 erros
- [x] Testes: 33 testes passando
- [x] Responsividade mobile
- [x] Dark Mode nativo

---

## ❌ FALTAM APENAS (4 funcionalidades)

### 1. Score de Clientes (ALTA PRIORIDADE)
**Descrição:** Ranking automático com pontuação de confiabilidade (0-131+)

**O que falta:**
- [ ] Nova página `/scores` com ranking visual
- [ ] Cálculo automático de score (0-131+)
- [ ] Algoritmo: parcelas em dia (+10), atrasadas (-5), lucro gerado (+1 por R$100)
- [ ] Badges: ⭐ Excelente (100+) | 👍 Bom (70-99) | 👌 Regular (40-69) | ⚠️ Ruim (<40)
- [ ] Filtro por score e por lucro
- [ ] Mostra: Principal, Lucro Quitados, Lucro Ativos, Lucro Extra
- [ ] Pontos de recuperação (+10 pts quando paga em dia)
- [ ] Atualização automática em tempo real

**Impacto:** CRÍTICO - Essencial para análise de risco de crédito

---

### 2. Veículos Registrados (ALTA PRIORIDADE)
**Descrição:** Gestão de vendas de veículos com alienação fiduciária

**O que falta:**
- [ ] Nova página `/vehicles` com gestão de vendas
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

**Impacto:** ALTO - Novo modelo de negócio

---

### 3. Comprovante em PDF (MÉDIA PRIORIDADE)
**Descrição:** Geração automática de comprovante de pagamento

**O que falta:**
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

**Impacto:** MÉDIO - Essencial para comprovação

---

### 4. Backup de Dados (BAIXA PRIORIDADE)
**Descrição:** Exportação completa dos dados do sistema

**O que falta:**
- [ ] Exportação em CSV (clientes, contratos, parcelas)
- [ ] Exportação em JSON (estrutura completa)
- [ ] Backup automático (diário/semanal/mensal)
- [ ] Download de backup
- [ ] Restauração de dados (upload)

**Impacto:** BAIXO - Funcionalidade de segurança

---

## 🎯 Plano de Implementação (Priorizado)

### Semana 1: Score de Clientes + Veículos
- **Dia 1-2:** Score de Clientes (algoritmo + página)
- **Dia 3-4:** Veículos Registrados (schema + router + página)
- **Dia 5:** Testes e ajustes

### Semana 2: Comprovante + Backup
- **Dia 1-2:** Comprovante em PDF (jsPDF + S3)
- **Dia 3-4:** Backup de Dados (CSV/JSON)
- **Dia 5:** Testes, checkpoint e deploy

---

## 📊 Comparativo Final

| Funcionalidade | Cobra Fácil | CobraPro | Status |
|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ Implementado |
| Clientes | ✅ | ✅ | ✅ Implementado |
| Empréstimos | ✅ | ✅ | ✅ Implementado |
| Score de Clientes | ✅ | ❌ | **FALTA** |
| Calendário | ✅ | ✅ | ✅ Implementado |
| Relatório Operacional | ✅ | ✅ | ✅ Implementado |
| Vendas de Produtos | ✅ | ✅ | ✅ Implementado |
| Veículos | ✅ | ❌ | **FALTA** |
| Gráficos | ✅ | ✅ | ✅ Implementado |
| Templates WhatsApp | ✅ | ✅ | ✅ Implementado |
| Comprovante PDF | ✅ | ❌ | **FALTA** |
| Funcionários | ✅ | ✅ | ✅ Implementado |
| Desconto de Cheque | ✅ | ✅ | ✅ Implementado |
| Minhas Contas a Pagar | ✅ | ✅ | ✅ Implementado |
| Backup | ✅ | ❌ | **FALTA** |
| PWA | ✅ | ❌ | Opcional |

**Cobertura:** CobraPro tem ~85% das funcionalidades do Cobra Fácil

---

## 🚀 Próximos Passos

1. **HOJE:** Implementar Score de Clientes
2. **AMANHÃ:** Implementar Veículos Registrados
3. **DIA 3:** Implementar Comprovante em PDF
4. **DIA 4:** Implementar Backup de Dados
5. **DIA 5:** Testes, checkpoint e deploy

