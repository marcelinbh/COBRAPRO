# Análise Cobra Fácil - Página de Empréstimos

## Layout Geral
- Cards em grid 3 colunas com gradient vermelho/azul
- Abas: Empréstimos (80), Diário (0), Tabela Price, Recebimentos
- Botões no topo: Tutorial, Baixar Relatório, Novo Diário, Novo Empréstimo
- Filtros: Filtros, Etiqueta
- Busca por cliente

## Estrutura do Card de Empréstimo

### Header
- Avatar com iniciais (colorido)
- Nome do cliente em MAIÚSCULA
- Badge de status (Atrasado/Em Dia)
- Badge de tipo (QUINZENAL, DIÁRIA, MENSAL, PRICE)

### Informações Principais
- **Valor em destaque (verde)**: R$ 10.700,00 "restante a receber"
- Subtítulo: "contém R$ 9.200,00 de juros por atraso" (se houver atraso)

### Grid 2x2
- Emprestado: R$ 1.000,00
- Total a Receber: R$ 10.700,00
- 💰 Lucro Previsto: R$ 500,00
- ✅ Lucro Realizado: R$ 0,00 0%

### Vencimento e Pagamento
- 📅 Venc: 08/01/2026
- 💵 Pago: R$ 0,00

### Juros por Parcela
- Só Juros (por parcela): R$ 500,00
- (em box roxo/destaque)

### Informação de Atraso (se houver)
- **Parcela 1/1 em atraso** (em vermelho)
- **92 dias** (dias em destaque)
- Vencimento: 08/01/2026
- Valor: R$ 1.500,00
- **% Juros (R$ 100,00/dia)** +R$ 9.200,00 (em vermelho)
- **Total com Atraso: R$ 10.700,00** (em vermelho, destaque)

### Botões de Ação (Rodapé)
1. **Editar Juros** (ícone de lápis)
2. **Aplicar Multa** (ícone de cifrão)
3. **Deletar** (ícone de lixeira)
4. **Cobrar Atraso (WhatsApp)** (botão grande em vermelho)
5. **Enviar Cobrança** (botão grande em vermelho)
6. **Pagar** (botão verde)
7. **Pagar Juros** (botão amarelo/âmbar)

### Ícones Adicionais
- Histórico (ícone de relógio)
- Detalhes (ícone de olho)
- Editar (ícone de lápis)
- Aplicar Multa (ícone de cifrão)
- Deletar (ícone de lixeira)

## Modal "Editar Empréstimo"
(Referência das imagens enviadas)

### Campos
1. **Cliente** (seletor com avatar, nome, telefone)
2. **Valor (R$)** (input numérico)
3. **Juros (%)** (input numérico)
4. **Tipo de Pagamento** (dropdown: Quinzenal, Mensal, etc)
5. **Parcelas** (input numérico)
6. **Juros Aplicado** (dropdown: Sobre o Total, etc)
7. **Juros Total (R$)** (calculado automaticamente)
8. **Valor da Parcela (R$)** (calculado automaticamente)
9. **Total a Receber** (calculado automaticamente)
10. **Data do Contrato** (date picker)
11. **1ª Parcela** (date picker)
12. **Datas das Parcelas** (lista de date pickers)

### Cálculos em Tempo Real
- Juros Total = Valor × (Juros % / 100)
- Valor da Parcela = (Valor + Juros Total) / Parcelas
- Total a Receber = Valor + Juros Total

## Observações Importantes
- Todos os valores em verde quando positivos
- Atraso em vermelho com destaque
- Cards com gradient vermelho/azul no background
- Botões de ação em cores distintas (verde para pagar, vermelho para atraso, amarelo para juros)
- Informações de atraso sempre em destaque no card
- Modal com cálculos em tempo real
