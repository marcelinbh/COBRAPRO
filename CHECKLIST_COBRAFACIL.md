# Checklist: CobraPro vs Cobra Fácil

Comparação completa das funcionalidades do Cobra Fácil com o estado atual do CobraPro.
Última atualização: 15/04/2026

---

## Legenda

- ✅ Implementado no CobraPro
- 🔶 Parcialmente implementado (precisa de melhorias)
- ❌ Ausente — precisa ser criado

---

## 1. Módulo de Empréstimos

| Funcionalidade | Status | Observação |
|---|---|---|
| Empréstimos quinzenais | ✅ | Implementado |
| Empréstimos mensais | ✅ | Implementado |
| Empréstimos diários | ✅ | Implementado |
| Tabela Price | ✅ | Implementado |
| Ação: Pagar parcela | ✅ | Implementado |
| Ação: Pagar Juros separado | 🔶 | Existe mas pode ser melhorado |
| Ação: Editar Juros por atraso | ❌ | Cobra Fácil permite editar o valor dos juros de atraso manualmente |
| Ação: Aplicar Multa manual | ❌ | Cobra Fácil tem botão dedicado para aplicar multa extra |
| Ação: Cobrar via WhatsApp (atraso) | ❌ | Botão "Cobrar Atraso (WhatsApp)" com mensagem pré-formatada |
| Ação: Enviar Cobrança (WhatsApp) | ❌ | Botão "Enviar Cobrança" para parcelas que vencem hoje/em breve |
| Ação: Comprovante PDF | 🔶 | Existe mas pode ser melhorado |
| Ação: Etiqueta/Tag no empréstimo | ❌ | Cobra Fácil permite adicionar etiquetas coloridas para organização |
| Pasta de empréstimos | ❌ | Agrupar múltiplos empréstimos de um mesmo cliente em uma "pasta" |
| Cobrança em Lote | ❌ | Selecionar múltiplos empréstimos e enviar cobrança de uma vez |
| Filtros avançados | 🔶 | CobraPro tem filtros básicos; Cobra Fácil tem mais opções |
| Baixar Relatório PDF | 🔶 | Existe no relatório geral, mas não diretamente na lista |
| Aba Recebimentos | ❌ | Aba dedicada mostrando histórico de todos os pagamentos recebidos |

---

## 2. Score de Clientes

| Funcionalidade | Status | Observação |
|---|---|---|
| Página de Score de Clientes | ✅ | Implementado |
| Ranking por pontuação | ✅ | Implementado |
| Categorias (Excelente/Bom/Regular/Ruim) | ✅ | Implementado |
| Ordenação por Score | ✅ | Implementado |
| Ordenação por Lucro | ❌ | Cobra Fácil permite ordenar por lucro gerado pelo cliente |
| Métricas de lucro quitado vs ativo | 🔶 | Parcialmente mostrado |
| Lucro Extra (juros adicionais recebidos) | ❌ | Cobra Fácil mostra "Lucro Extra" separado do lucro base |
| Pontos de recuperação (+10 pts) | ❌ | Sistema de pontos por recuperação de inadimplência |

---

## 3. Calendário de Vencimentos

| Funcionalidade | Status | Observação |
|---|---|---|
| Calendário mensal | ✅ | Implementado |
| Marcadores por tipo (Empréstimo/Veículo/Produto/Vencido) | 🔶 | CobraPro tem mas pode ter mais tipos |
| KPIs: A Vencer, Vencidos, Total no Mês | 🔶 | Parcialmente implementado |
| Clicar na data para ver vencimentos | ✅ | Implementado |

---

## 4. Relatório Operacional (Empréstimos)

| Funcionalidade | Status | Observação |
|---|---|---|
| Fluxo de Caixa do período | 🔶 | CobraPro tem Caixa mas não tem relatório de fluxo por período |
| Caixa Extra (valor manual) | ❌ | Cobra Fácil permite adicionar valor extra ao caixa manualmente |
| Saídas: Empréstimos concedidos | ❌ | Relatório mostra quanto foi emprestado no período |
| Saídas: Contas a pagar | ❌ | Integração de contas a pagar no relatório |
| Saídas: Custos extras | ❌ | Adicionar custos avulsos ao relatório |
| Entradas: Pagamentos recebidos | 🔶 | Parcialmente no Caixa |
| KPI: Capital na Rua | ✅ | Implementado |
| KPI: Juros a Receber | ✅ | Implementado |
| KPI: Total Recebido histórico | ✅ | Implementado |
| KPI: Falta Receber | ✅ | Implementado |
| KPI: Em Atraso | ✅ | Implementado |
| KPI: Lucro Realizado | ✅ | Implementado |
| Evolução Mensal (gráfico) | 🔶 | Existe no dashboard mas não no relatório operacional |
| Filtro por tipo de pagamento | ❌ | Cobra Fácil filtra por tipo (quinzenal, mensal, diário) |
| Baixar PDF do relatório | ✅ | Implementado |
| Taxa de Recebimento (%) | ❌ | Indicador de performance: % do capital que foi recebido |
| Taxa de Inadimplência (%) | ❌ | Indicador de risco: % de contratos em atraso |

---

## 5. Relatório de Vendas

| Funcionalidade | Status | Observação |
|---|---|---|
| Relatório de Vendas de Produtos | 🔶 | Existe mas pode ser melhorado |
| Relatório de Vendas de Veículos | 🔶 | Existe mas pode ser melhorado |
| Relatório de Contratos | 🔶 | Existe mas pode ser melhorado |
| Relatório de Assinaturas | ❌ | Cobra Fácil tem módulo de assinaturas/IPTV |
| Aba de Assinaturas/IPTV | ❌ | Módulo completo de gestão de assinaturas recorrentes |
| KPI: Vendido no Período | ✅ | Implementado |
| KPI: Recebido no Período | ✅ | Implementado |
| KPI: Lucro no Período | ✅ | Implementado |
| KPI: Em Atraso Total | ✅ | Implementado |
| Distribuição de Vendas (gráfico) | ❌ | Gráfico de distribuição por tipo de venda |

---

## 6. Simulador de Empréstimo

| Funcionalidade | Status | Observação |
|---|---|---|
| Simulador básico | ✅ | Implementado |
| Tipo: Parcelado Mensal | ✅ | Implementado |
| Tipo: Quinzenal | ✅ | Implementado |
| Tipo: Diário | ✅ | Implementado |
| Tipo: Tabela Price | ✅ | Implementado |
| Modo: Por Parcela | ✅ | Implementado |
| Modo: Sobre Capital | ✅ | Implementado |
| Comparar Modos de Juros | ❌ | Cobra Fácil tem botão para comparar os dois modos lado a lado |
| Exportar PDF do simulador | ❌ | Cobra Fácil permite exportar o cronograma de parcelas em PDF |

---

## 7. Configurações e Perfil

| Funcionalidade | Status | Observação |
|---|---|---|
| Editar perfil (nome, email, WhatsApp) | ✅ | Implementado |
| Chave PIX para cobranças | ❌ | Campo para cadastrar chave PIX que é incluída nas mensagens |
| Nome nas cobranças (assinatura) | ❌ | Nome que aparece no final das mensagens de cobrança |
| Link de pagamento (PagSeguro/Mercado Pago) | ❌ | Link adicional incluído nas mensagens junto com PIX |
| Logo da empresa (para PDFs) | ❌ | Upload de logo que aparece nos comprovantes e contratos |
| Templates de mensagem WhatsApp | ❌ | Editor de templates com variáveis dinâmicas para cobranças |
| Template: Parcela em Atraso | ❌ | Template editável para cobranças de atraso |
| Template: Vence Hoje | ❌ | Template editável para cobranças do dia |
| Template: Antecipada | ❌ | Template editável para cobranças antecipadas |
| Templates prontos pré-definidos | ❌ | Biblioteca de templates prontos para escolher |
| Variáveis dinâmicas nos templates | ❌ | {CLIENTE}, {VALOR}, {PARCELA}, {DATA}, {DIAS_ATRASO}, {TOTAL}, {PIX}, etc. |

---

## 8. WhatsApp para Clientes

| Funcionalidade | Status | Observação |
|---|---|---|
| Conexão WhatsApp via QR Code | ❌ | Cobra Fácil conecta WhatsApp próprio via QR Code para enviar mensagens |
| Envio de cobrança via WhatsApp | ❌ | Enviar mensagem de cobrança diretamente pelo WhatsApp conectado |
| Envio de comprovante via WhatsApp | ❌ | Enviar comprovante de pagamento pelo WhatsApp |
| Botão "Cobrar Atraso (WhatsApp)" | ❌ | Botão rápido em cada empréstimo para cobrar via WhatsApp |
| Botão "Enviar Cobrança (WhatsApp)" | ❌ | Botão para enviar cobrança preventiva (vence hoje/em breve) |

---

## 9. Relatório Diário via WhatsApp

| Funcionalidade | Status | Observação |
|---|---|---|
| Relatório diário automático | ❌ | Receber lista de cobranças do dia via WhatsApp automaticamente |
| Configurar horário de envio | ❌ | Definir horário para receber o relatório |
| Incluir quem está em atraso | ❌ | Lista de inadimplentes no relatório diário |

---

## 10. Funcionários

| Funcionalidade | Status | Observação |
|---|---|---|
| Cadastrar funcionários/cobradores | ✅ | Implementado (página Cobradores) |
| Visibilidade controlada (vê só os dele) | ❌ | Cobra Fácil permite que funcionário veja apenas seus próprios empréstimos |
| Dashboard bloqueado para funcionário | ❌ | Ocultar totais financeiros do dashboard para funcionários |
| Permissões por função | ❌ | Definir quais módulos cada funcionário pode acessar |
| Liberar "ver todos" individualmente | ❌ | Permissão granular por funcionário |

---

## 11. Backup de Dados

| Funcionalidade | Status | Observação |
|---|---|---|
| Exportar Clientes (CSV/PDF) | ✅ | Implementado |
| Exportar Empréstimos (CSV/PDF) | ✅ | Implementado |
| Exportar Empréstimos Diários (CSV/PDF) | ❌ | Cobra Fácil exporta diários separado dos mensais |
| Exportar Contratos (CSV/PDF) | ✅ | Implementado |
| Exportar Vendas de Produtos (CSV/PDF) | ✅ | Implementado |
| Exportar Vendas de Veículos (CSV/PDF) | ✅ | Implementado |

---

## 12. Módulos Exclusivos do Cobra Fácil (não existem no CobraPro)

| Funcionalidade | Status | Observação |
|---|---|---|
| Assinaturas/IPTV | ❌ | Módulo completo para gestão de assinaturas recorrentes (IPTV, streaming, etc.) |
| Análise de Risco com IA | 🔶 | CobraPro tem /analise-risco mas pode ser expandido |

---

## 13. Módulos Exclusivos do CobraPro (vantagens sobre o Cobra Fácil)

| Funcionalidade | Observação |
|---|---|
| Venda de Telefone | Módulo completo com simulador, contrato PDF, integração com Caixa |
| Caixa com múltiplas contas | Gestão de caixa com múltiplas contas e transferências |
| Portal do Cliente | Cliente acessa suas parcelas via link único |
| Reparcelamento | Módulo dedicado para renegociação de dívidas |
| Análise de Risco com IA | Análise automática de risco de inadimplência |

---

## Resumo Executivo

| Categoria | Total | Implementado | Parcial | Ausente |
|---|---|---|---|---|
| Empréstimos | 17 | 5 | 4 | 8 |
| Score de Clientes | 8 | 4 | 1 | 3 |
| Calendário | 4 | 2 | 2 | 0 |
| Relatório Operacional | 17 | 7 | 3 | 7 |
| Relatório de Vendas | 10 | 4 | 3 | 3 |
| Simulador | 9 | 6 | 0 | 3 |
| Configurações/Perfil | 11 | 1 | 0 | 10 |
| WhatsApp | 5 | 0 | 0 | 5 |
| Relatório Diário WhatsApp | 3 | 0 | 0 | 3 |
| Funcionários | 5 | 1 | 0 | 4 |
| Backup | 6 | 5 | 0 | 1 |
| Módulos Exclusivos | 2 | 0 | 1 | 1 |
| **TOTAL** | **97** | **35 (36%)** | **14 (14%)** | **48 (50%)** |

---

## Prioridade de Implementação Sugerida

### Alta Prioridade (impacto direto no uso diário)
1. ❌ Templates de mensagem WhatsApp com variáveis dinâmicas
2. ❌ Chave PIX + Nome nas cobranças + Link de pagamento (perfil)
3. ❌ Botão "Cobrar via WhatsApp" em cada empréstimo
4. ❌ Ação: Aplicar Multa manual nos empréstimos
5. ❌ Ação: Editar Juros por atraso manualmente
6. ❌ Cobrança em Lote (selecionar múltiplos e cobrar de uma vez)
7. ❌ Aba Recebimentos na página de Empréstimos
8. ❌ Taxa de Recebimento e Taxa de Inadimplência no Relatório

### Média Prioridade (melhoria de experiência)
9. ❌ Logo da empresa nos PDFs
10. ❌ Ordenação por Lucro no Score de Clientes
11. ❌ Comparar Modos de Juros no Simulador
12. ❌ Exportar PDF do Simulador
13. ❌ Pasta de empréstimos (agrupar por cliente)
14. ❌ Etiquetas/Tags nos empréstimos
15. ❌ Filtro por tipo de pagamento no Relatório Operacional

### Baixa Prioridade (funcionalidades avançadas)
16. ❌ Módulo de Assinaturas/IPTV
17. ❌ Permissões granulares para funcionários
18. ❌ Relatório Diário automático via WhatsApp
19. ❌ Conexão WhatsApp via QR Code (próprio)
20. ❌ Caixa Extra manual no Relatório
