# CobraPro — plano de saneamento financeiro controlado

**Data:** 6 de novembro de 2026, America/Sao_Paulo. **Projeto autorizado:** `oxvtmibrgjruldkouhhb`. Este documento é um plano; não executa UPDATE, DELETE, backfill, baixa ou crédito de ajuste. Fonte: pré-auditoria produtiva de 6/11 e testes locais registrados em `reports/pre-auditoria-produtiva-2026-11-06.md`.

## Regra de segurança

O backend continua bloqueando mutações financeiras REST não atômicas. As migrations 0013/0014/0015/0017 não estão aplicadas. A aprovação dos testes sintéticos não autoriza corrigir dados reais por inferência. A diferença líquida de R$ 2.510,47 entre parcelas e Caixa **não é um valor de ajuste**: inclui problemas de propriedade e não prova perda financeira.

A estrutura de reset de senha 0016 foi instalada separadamente, com a flag de validação de sessões ainda desligada. Ela não depende nem libera este saneamento.

## Ordem operacional e critérios de saída

| Etapa | Ação permitida nesta fase | Critério para avançar |
|---|---|---|
| 1. Preservação | Confirmar backup/snapshot recuperável do Supabase e definir responsáveis e janela de manutenção | Evidência de restauração e retenção; não apenas um arquivo sem teste |
| 2. Exportação restrita | Exportar registros afetados, vínculos e lançamentos relacionados em canal privado autorizado | IDs e valores antes da correção, hash do arquivo e armazenamento com acesso restrito |
| 3. Classificação | Comparar contratos, parcelas, clientes, contas, Caixa e evidência original de pagamento | Cada registro tem causa e proposta; não presumir que um dos saldos seja a verdade |
| 4. Aprovação | Aprovação explícita por ID/campo/valor anterior/valor proposto e justificativa | Dono dos dados e responsável operacional validam a proposta exata |
| 5. Ensaio | Reproduzir o caso em cópia descartável e testar correção com pré-condições | Nenhuma mutação entre empresas, duplicidade, perda de auditoria ou mudança indevida do residual |
| 6. Execução futura | Transação restrita com comparação dos valores antigos, auditoria e rollback | Quantidade exata de linhas, reconciliação antes/depois e zero surpresa no preflight |
| 7. Liberação | Reavaliar 0013/0015 no projeto correto e executar fluxo sintético autorizado | RPC, idempotência, concorrência, datas de Brasília e Caixa comprovados antes da flag |

Não fazer exportação pública de CPF, nomes, endereços, e-mails, fotos, tokens ou credenciais. O pacote restrito não deve ir para GitHub nem CDN pública. Nenhum backup/exportação dos dados reais foi realizado por este documento.

## Grupos de revisão obrigatória

### P0 — seis parcelas sem proprietário/cliente ou vínculo completo

A fonte correta precisa ser demonstrada com contrato, cliente e conta. Não atribuir todas ao dono do contrato em bloco. A simulação somente leitura já encontrou duplicidade latente: **IDs 247 e 279, contrato 42, parcela número 2**, para a mesma empresa projetada.

Os dois registros precisam ser classificados como dívida distinta, duplicação, substituição/renovação ou outro evento comprovado. Não apagar uma parcela por ter ID maior ou menor; não renumerar para fazer a constraint passar; não vincular o Caixa a uma delas por conveniência.

### P0 — 12 transações de Caixa com proprietário divergente

A pré-auditoria confirmou discordância do `user_id` gravado frente à conta, contrato e cliente vinculados. Mesmo que os três vínculos concordem, isso é candidato de correção, não autorização. Revisar também acesso histórico entre empresas e se houve reutilização indevida de IDs em importação.

Uma futura alteração de propriedade deve revisar ambos os tenants e todos os vínculos do lançamento. Não alterar conta e valor junto com o tenant para esconder a divergência. Reconciliar primeiro a propriedade, depois avaliar valores.

### P0 — 18 divergências de pagamento acumulado versus livro-caixa

Recalcular a conferência após a classificação de propriedade, sem criar ajustes. Comparar `valor_pago` com entradas `pagamento_parcela` da mesma parcela e empresa, incluindo a origem da baixa e comprovantes. Há caso com recebimento registrado de 500 frente a 1.500 em Caixa; somente o documento original e a trilha operacional podem decidir qual está correto.

Classificar falta de lançamento, excesso/duplicação, associação errada, pagamento parcial, desconto, juros/multa ou evento legado. Não preencher automaticamente o Caixa a partir de `valor_pago`, nem sobrescrever `valor_pago` pela soma do Caixa.

### P1 — parcelas parciais com residual inválido

**IDs 714, 867 e 931** foram identificados com status parcial e residual zero. Determinar o total devido na data civil do evento, valor pago, encargos aplicados e eventual desconto aprovado. Não mudar para paga somente porque o residual está zerado, nem recompor residual por uma fórmula que ignore pagamentos anteriores.

### P1 — duas operações de renovação de juros em falha

Verificar se a tentativa deixou parcela, lançamento, histórico ou operação parcial. Estado `falha` não significa renovação concluída. Não mudar o estado para concluída sem localizar os efeitos e comprovar que o Caixa e a parcela estão consistentes. Renovação continua aguardando RPC própria, não é liberada pela 0015 de recebimento.

### P1 — vínculo de cliente ausente em `transacoes_caixa`

A coluna não existe antes da 0015. A migration a adiciona nullable, sem backfill. Recebimentos históricos sem vínculo inequívoco bloqueiam a instalação; o candidato deve exigir concordância de parcela, contrato, cliente, conta e tenant, chave lógica não duplicada e evidência financeira. Criar a coluna não autoriza preenchê-la automaticamente. Não acrescentar a coluna isoladamente em produção para contornar o preflight.

## Modelo do pacote de aprovação por registro

| Campo | Conteúdo obrigatório |
|---|---|
| Referência | Tabela e ID do registro; IDs de todos os vínculos envolvidos |
| Estado anterior | Somente campos relevantes, valores numéricos e status originais |
| Evidência | Comprovante/evento de origem e conferência dos tenants |
| Proposta | Campo exato e novo valor; ausência de alteração também é decisão válida |
| Impacto | Diferença nos totais de ambas as empresas e nos vínculos |
| Pré-condição | Estado anterior deve ser idêntico no momento da transação |
| Reversão | Como restaurar e como preservar a trilha de auditoria |
| Aprovação | Responsável, data e aprovação explícita da proposta exata |
| Validação | Resultado esperado do preflight e reconciliação após a operação |

Não existe proposta aprovada de alteração por registro neste lote. Permanecem pendentes backup/exportação restritos, evidência original e revisão humana.

## Próximas frentes independentes

A Blacklist está sem tabelas-base PostgreSQL no inventário. Preparar migration aditiva idempotente, FKs/índices, RLS e ACL backend-only, grants das sequências e testes antes de aplicar. Preservar busca por documento completo e DTO compartilhado mascarado; dados completos/fotos apenas do autor. Resolver corrida de cinco fotos, exclusão não atômica e demonstrar privacidade real dos objetos antes de afirmar operação completa.

A Kiwify permanece por último. Sua tabela de eventos também está ausente; 0017 não cria a base por si só. Não reabrir provisionamento financeiro nem prometer funcionamento completo antes da base e do preflight específico.
