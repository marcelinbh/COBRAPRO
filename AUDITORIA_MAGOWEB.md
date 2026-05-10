# Auditoria do Sistema Mago da Web
**URL**: https://vitalfinanceira.sge.magoweb.com.br
**Data**: 10/05/2026
**Objetivo**: Identificar funcionalidades do concorrente não implementadas no CobraPro

---

## MENU PRINCIPAL
- Painel
- Usuários
- Caixa
- Empréstimos
- Cobrança
- Financeiro
- WhatsApp
- Relatórios
- Configurações

---

## MÓDULO: SIMULAÇÃO DE EMPRÉSTIMO (Novo Empréstimo)

### Dados do Cliente
- [x] Campo de busca de cliente com limite de crédito exibido
- [ ] **LIMITE DE CRÉDITO POR CLIENTE** — exibe o limite disponível no dropdown de seleção (ex: "Diego Junio Almeida (Limite: R$ 500,00)")

### Vincular Investidor (OPCIONAL)
- [ ] **MÓDULO DE INVESTIDORES** — possibilidade de vincular um investidor ao empréstimo (capital de terceiros)
- [ ] Checkbox "Desejo vincular um investidor a este empréstimo"

### Caixa de Liberação
- [x] Seleção de caixa de liberação (CobraPro tem)
- [x] Exibe saldo do caixa no dropdown

### Tipo de Cobrança
- [x] Parcelada Comum (parcelas fixas com amortização)
- [x] Reparcelada com Juros (juros sobre valor total - 1 parcela)

### Modo de Cálculo de Juros
- [x] Juros Simples
- [x] Juros Compostos (Price)
- [ ] **EXPLICAÇÃO VISUAL** — exibe diferenças entre os modos de cálculo na tela

### Parcelamento
- [x] Valor do Empréstimo
- [x] Taxa de Juros
- [x] Número de Parcelas
- [x] Período de Pagamento (Diário, Semanal, Quinzenal, Mensal)
- [ ] **TRIMESTRAL** — período de pagamento trimestral (CobraPro não tem)
- [x] Data Inicial (permite datas retroativas)

### Nota Promissória (OPCIONAL)
- [ ] **GERAÇÃO DE NOTA PROMISSÓRIA** — documento legal separado do contrato

