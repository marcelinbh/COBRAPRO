# Auditoria de Bugs - CobraPro - 14/05/2026

## Bugs Encontrados

### BUG 1: Aba "Contratos" no detalhe do cliente mostra valores zerados
- **Onde:** /clientes/{id} → aba "Contratos"
- **Sintoma:** Mostra "x de R$ 0,00 · Início: -" e "R$ 0,00 Principal" para todos os contratos
- **Esperado:** Mostrar número de parcelas, valor da parcela, data de início e valor principal corretos

### BUG 2: Denominador de parcelas incorreto na página Cuotas
- **Onde:** /parcelas → lista de parcelas
- **Sintoma:** Mostra "Parcela 2/1", "Parcela 3/1" (denominador = num_parcelas original do contrato, não o total atual após renovações)
- **Esperado:** Mostrar o número total atual de parcelas (ex: "Parcela 3/3" ou "Parcela 3/4")
- **Causa:** O denominador usa `num_parcelas` do contrato original em vez de `numero_parcelas` (atualizado a cada renovação)

### BUG 3: Caixa - "Últimas Transações" sempre vazia
- **Onde:** /caixa → seção "Últimas Transações"
- **Sintoma:** Mostra "No hay datos disponibles" mesmo com transações registradas
- **Esperado:** Mostrar as transações de entrada/saída das contas

### BUG 4: Relatórios - "Fluxo de Caixa" vazio e "Status das Parcelas" sem barras de Pendente/Atrasada
- **Onde:** /relatorios → gráficos
- **Sintoma:** Fluxo de Caixa mostra apenas linha zerada; Status das Parcelas mostra apenas "Pagas" (sem Pendentes, Atrasadas)
- **Esperado:** Fluxo de Caixa mostrando entradas dos pagamentos recebidos; Status das Parcelas com todas as categorias

### BUG 5: Página "Reprogramação" retorna 404
- **Onde:** Menu lateral → "Reprogramación" → /reprogramacao
- **Sintoma:** Página 404 "Page Not Found"
- **Esperado:** Página de reprogramação de parcelas

- **Causa:** Menu lateral aponta para `/reprogramacao` mas a rota registrada é `/reparcelamento`

