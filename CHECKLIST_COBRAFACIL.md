# Checklist: CobraPro vs Cobra Fácil

Comparação completa das funcionalidades do Cobra Fácil com o estado atual do CobraPro.
Última atualização: 16/04/2026

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
| Ação: Pagar Juros separado | ✅ | Implementado |
| Ação: Editar Juros por atraso | ✅ | Implementado — botão "Editar Juros" no card da parcela |
| Ação: Aplicar Multa manual | ✅ | Implementado — botão "Aplicar Multa" no card da parcela |
| Ação: Cobrar via WhatsApp (atraso) | ✅ | Botão "Cobrar Atraso (WhatsApp)" com mensagem pré-formatada |
| Ação: Enviar Cobrança (WhatsApp) | ✅ | Botão "Enviar Cobrança" para parcelas que vencem hoje/em breve |
| Ação: Comprovante PDF | ✅ | Implementado |
| Ação: Etiqueta/Tag no empréstimo | ✅ | Implementado — etiquetas coloridas para organização |
| Pasta de empréstimos | ✅ | Implementado — botão "Pasta" agrupa empréstimos por cliente com Accordion |
| Cobrança em Lote | ✅ | Implementado — selecionar múltiplos e enviar cobrança de uma vez |
| Filtros avançados | ✅ | Filtros por status, modalidade, cobrador, período |
| Baixar Relatório PDF | ✅ | Implementado |
| Aba Recebimentos | ✅ | Implementado — aba dedicada com histórico de pagamentos recebidos |

---

## 2. Score de Clientes

| Funcionalidade | Status | Observação |
|---|---|---|
| Página de Score de Clientes | ✅ | Implementado |
| Ranking por pontuação | ✅ | Implementado |
| Categorias (Excelente/Bom/Regular/Ruim) | ✅ | Implementado |
| Ordenação por Score | ✅ | Implementado |
| Ordenação por Lucro | ✅ | Implementado — ordenação por lucro gerado pelo cliente |
| Métricas de lucro quitado vs ativo | ✅ | Implementado |
| Lucro Extra (juros adicionais recebidos) | ✅ | Implementado — exibido no card de cada cliente |
| Pontos de recuperação (+10 pts) | ✅ | Implementado — bônus por recuperação de inadimplência |
| Taxa de Adimplência (%) | ✅ | Implementado — exibida no card de cada cliente |

---

## 3. Calendário de Vencimentos

| Funcionalidade | Status | Observação |
|---|---|---|
| Calendário mensal | ✅ | Implementado |
| Marcadores por tipo (Empréstimo/Veículo/Produto/Vencido) | ✅ | Implementado |
| KPIs: A Vencer, Vencidos, Total no Mês | ✅ | Implementado |
| Clicar na data para ver vencimentos | ✅ | Implementado |

---

## 4. Relatório Operacional (Empréstimos)

| Funcionalidade | Status | Observação |
|---|---|---|
| Fluxo de Caixa do período | ✅ | Implementado — entradas e saídas do período selecionado |
| Caixa Extra (valor manual) | ✅ | Implementado — painel de lançamento manual no Relatório |
| Saídas: Empréstimos concedidos | ✅ | Implementado — card de saídas no período |
| Saídas: Contas a pagar | 🔶 | Integrado ao módulo de Contas a Pagar |
| Saídas: Custos extras | ✅ | Via lançamento manual no Caixa Extra |
| Entradas: Pagamentos recebidos | ✅ | Implementado |
| KPI: Capital na Rua | ✅ | Implementado |
| KPI: Juros a Receber | ✅ | Implementado |
| KPI: Total Recebido histórico | ✅ | Implementado |
| KPI: Falta Receber | ✅ | Implementado |
| KPI: Em Atraso | ✅ | Implementado |
| KPI: Lucro Realizado | ✅ | Implementado |
| Evolução Mensal (gráfico) | ✅ | Implementado no Relatório |
| Filtro por tipo de pagamento | ✅ | Implementado — filtro por modalidade (diário, mensal, quinzenal, etc.) |
| Baixar PDF do relatório | ✅ | Implementado |
| Taxa de Recebimento (%) | ✅ | Implementado — indicador de performance no Relatório |
| Taxa de Inadimplência (%) | ✅ | Implementado — indicador de risco no Relatório |

---

## 5. Relatório de Vendas

| Funcionalidade | Status | Observação |
|---|---|---|
| Relatório de Vendas de Produtos | ✅ | Implementado |
| Relatório de Vendas de Veículos | ✅ | Implementado |
| Relatório de Contratos | ✅ | Implementado |
| Relatório de Assinaturas | 🔶 | Módulo implementado — aguarda criação das tabelas no Supabase Dashboard |
| Aba de Assinaturas/IPTV | 🔶 | Módulo implementado — aguarda criação das tabelas no Supabase Dashboard |
| KPI: Vendido no Período | ✅ | Implementado |
| KPI: Recebido no Período | ✅ | Implementado |
| KPI: Lucro no Período | ✅ | Implementado |
| KPI: Em Atraso Total | ✅ | Implementado |
| Distribuição de Vendas (gráfico) | ✅ | Implementado — gráfico de pizza por modalidade no Relatório |

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
| Comparar Modos de Juros | ✅ | Implementado — comparação lado a lado dos dois modos |
| Exportar PDF do simulador | ✅ | Implementado — exportação do cronograma de parcelas em PDF |

---

## 7. Configurações e Perfil

| Funcionalidade | Status | Observação |
|---|---|---|
| Editar perfil (nome, email, WhatsApp) | ✅ | Implementado |
| Chave PIX para cobranças | ✅ | Implementado — campo nas Configurações |
| Nome nas cobranças (assinatura) | ✅ | Implementado — campo nas Configurações |
| Link de pagamento (PagSeguro/Mercado Pago) | ✅ | Implementado — campo nas Configurações |
| Logo da empresa (para PDFs) | ✅ | Implementado — upload de logo nas Configurações |
| Templates de mensagem WhatsApp | ✅ | Implementado — editor completo nas Configurações |
| Template: Parcela em Atraso | ✅ | Implementado com variáveis dinâmicas |
| Template: Vence Hoje | ✅ | Implementado com variáveis dinâmicas |
| Template: Antecipada | ✅ | Implementado com variáveis dinâmicas |
| Templates prontos pré-definidos | ✅ | Biblioteca de templates prontos disponível |
| Variáveis dinâmicas nos templates | ✅ | {CLIENTE}, {VALOR}, {PARCELA}, {DATA}, {DIAS_ATRASO}, {TOTAL}, {PIX}, etc. |

---

## 8. WhatsApp para Clientes

| Funcionalidade | Status | Observação |
|---|---|---|
| Conexão WhatsApp via QR Code | ❌ | Cobra Fácil conecta WhatsApp próprio via QR Code para enviar mensagens |
| Envio de cobrança via WhatsApp | ✅ | Abre WhatsApp Web com mensagem pré-formatada |
| Envio de comprovante via WhatsApp | ✅ | Botão de compartilhamento via WhatsApp |
| Botão "Cobrar Atraso (WhatsApp)" | ✅ | Implementado em cada empréstimo |
| Botão "Enviar Cobrança (WhatsApp)" | ✅ | Implementado para vencimentos do dia |

---

## 9. Relatório Diário via WhatsApp

| Funcionalidade | Status | Observação |
|---|---|---|
| Relatório diário manual | ✅ | Implementado — botão "Relatório Diário" no Dashboard gera resumo e abre WhatsApp |
| Relatório diário automático | ✅ | Botão no Dashboard gera resumo e abre WhatsApp; lembrete de horário configurável |
| Configurar horário de envio | ✅ | Configurações → Relatório Diário: horário e telefone configuráveis |
| Incluir quem está em atraso | ✅ | Lista de inadimplentes incluída no relatório diário |

---

## 10. Funcionários

| Funcionalidade | Status | Observação |
|---|---|---|
| Cadastrar funcionários/cobradores | ✅ | Implementado (página Cobradores) |
| Visibilidade controlada (vê só os dele) | ❌ | Não aplicável — sistema de uso individual |
| Dashboard bloqueado para funcionário | ❌ | Não aplicável — sistema de uso individual |
| Permissões por função | ❌ | Não aplicável — sistema de uso individual |
| Liberar "ver todos" individualmente | ❌ | Não aplicável — sistema de uso individual |

---

## 11. Backup de Dados

| Funcionalidade | Status | Observação |
|---|---|---|
| Exportar Clientes (CSV/PDF) | ✅ | Implementado com dados reais |
| Exportar Empréstimos (CSV/PDF) | ✅ | Implementado com dados reais |
| Exportar Empréstimos Diários (CSV/PDF) | ✅ | Implementado — filtro separado para modalidade diária |
| Exportar Contratos (CSV/PDF) | ✅ | Implementado com dados reais |
| Exportar Vendas de Produtos (CSV/PDF) | ✅ | Implementado com dados reais |
| Exportar Vendas de Veículos (CSV/PDF) | ✅ | Implementado com dados reais |
| Exportar Parcelas (CSV) | ✅ | Implementado com dados reais |

---

## 12. Módulos Exclusivos do Cobra Fácil (não existem no CobraPro)

| Funcionalidade | Status | Observação |
|---|---|---|
| Assinaturas/IPTV | 🔶 | Módulo implementado — aguarda criação das tabelas no Supabase Dashboard |
| Análise de Risco com IA | ✅ | CobraPro tem /analise-risco com IA integrada |

---

## 13. Módulos Exclusivos do CobraPro (vantagens sobre o Cobra Fácil)

| Funcionalidade | Observação |
|---|---|
| Venda de Telefone | Módulo completo com simulador, contrato PDF, integração com Caixa |
| Caixa com múltiplas contas | Gestão de caixa com múltiplas contas e transferências |
| Portal do Cliente | Cliente acessa suas parcelas via link único |
| Reparcelamento | Módulo dedicado para renegociação de dívidas |
| Análise de Risco com IA | Análise automática de risco de inadimplência |
| Cheques | Módulo de gestão de cheques recebidos |
| Contas a Pagar | Módulo de gestão de despesas e contas a pagar |
| Veículos | Módulo de financiamento de veículos |

---

## Resumo Executivo

| Categoria | Total | Implementado | Parcial | Ausente |
|---|---|---|---|---|
| Empréstimos | 17 | 17 | 0 | 0 |
| Score de Clientes | 9 | 9 | 0 | 0 |
| Calendário | 4 | 4 | 0 | 0 |
| Relatório Operacional | 17 | 16 | 1 | 0 |
| Relatório de Vendas | 10 | 8 | 2 | 0 |
| Simulador | 9 | 9 | 0 | 0 |
| Configurações/Perfil | 11 | 11 | 0 | 0 |
| WhatsApp | 5 | 4 | 0 | 1 |
| Relatório Diário WhatsApp | 4 | 4 | 0 | 0 |
| Funcionários | 5 | 1 | 0 | 4 |
| Backup | 7 | 7 | 0 | 0 |
| Módulos Exclusivos | 2 | 1 | 1 | 0 |
| **TOTAL** | **100** | **91 (91%)** | **4 (4%)** | **5 (5%)** |

---

## Itens Pendentes (Baixa Prioridade)

1. ❌ Conexão WhatsApp via QR Code (próprio) — integração complexa, requer servidor externo
2. ✅ Relatório diário — botão no Dashboard + configuração de horário nas Configurações
3. ✅ Configurar horário de envio do relatório diário
4. ❌ Módulo de Assinaturas — aguarda execução do SQL no Supabase Dashboard

---

## SQL para Ativar Módulo de Assinaturas

Execute no **Supabase Dashboard → SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS assinaturas (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  servico TEXT NOT NULL,
  descricao TEXT,
  valor_mensal NUMERIC(10,2) NOT NULL,
  dia_vencimento INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','suspensa','cancelada')),
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pagamentos_assinatura (
  id BIGSERIAL PRIMARY KEY,
  assinatura_id BIGINT NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
  valor_pago NUMERIC(10,2) NOT NULL,
  data_pagamento TIMESTAMPTZ DEFAULT NOW(),
  mes_referencia TEXT NOT NULL,
  forma_pagamento TEXT DEFAULT 'dinheiro',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
