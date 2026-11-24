# Hotfix de despesas B1/B2 — APP-only, separado da manutenção38

## Escopo e estado — 24/11/2026

Correções pontuais no router realmente exportado `server/routers/contasPagar.ts` e na página `client/src/pages/ContasPagar.tsx`. Sem DDL, alteração de flags, schema, ACL, origem financeira, dados históricos, Kiwify/ofertas ou WhatsApp. SQL20–37 permanece byte-exato. A manutenção38 ainda não está implementada/publicada por este lote.

### B1 — resumo não pode esconder status inválido

Reprodução offline contra router real: uma despesa de valor12.00 com statusNULL aparecia na lista, mas o resumo retornava falsamente0.00/0. O resumo agora valida os sete status históricos reconhecidos antes de agregar. NULL ou status desconhecido causa INTERNAL_SERVER_ERROR e mensagem de conferência. A UI existente apresenta erro de resumo em vez dos cartões; não classifica a linha como pendente nem retorna subtotal aparentemente definitivo. Status e registros históricos não são alterados.

### B2 — recuperar intenção não é autorizar nova despesa

Reprodução: com ENABLE_RPC_DESPESAS_PROSPECTIVAS diferente do literal `true`, o endpoint de reconciliação rejeitava antes da fonte/RPC e o botão de recovery ficava desativado. O endpoint passa a obter fonte autenticada sem exigir a flag de novas escritas. Somente o botão de reconciliação perde essa dependência. O guard de entrada de envio exige a flag; criar, pagar, estornar e reenviar continuam desativados no gateOFF.

Owner da sessão, família, request/UUID originais, prova de resultado, fence e isolamento de geração A→B→A permanecem obrigatórios. Recovery usa uma RPC `rpc_reconciliar_intencao_financeira`, sem REST/fallback/writer financeiro. Recovery NÃO é leitura pura: uma ausência comprovada pode registrar fence durável na evidência33. Não testar com UUID fictício em produção. Erro/timeout/resultado inválido não permite descartar ou trocar a intenção.

## Provas executadas

Proposta privada, antes de aplicar: mesma suíte57execuções, baselineexit1 com30failed/27passed; propostaexit0 com57PASS. Router34 e UI23, incluindo15 testesUI antigos e8 execuções novas. Regressões privadas178PASS/1SKIP em4files; PG17 explicitamente não executado nessa etapa. Checagem estáticaSQL33:11checks, não prova de concorrênciaPG.

Após aplicação byte-exata da proposta, o responsável executou targeted238PASS/7files/exit0 às02h13BRT. Incluiu router77 com testeNUMERIC/JSONB/ledger real, adapter75, recovery22, migração5, testesB1/B2router34, UI23 e dois perfisPG17 físicos33 (0025 e0025+0031). Esperas de lock/COMMIT/fence/POST atrasado reais, replay de resultado persistido, ACL e instalaçãoone-shot passaram. Clusters locais sem TCP/credenciais produtivas, stop0/status3. Isso não é matriz38 pós37.

Gate integral final às02h16:39BRT: **3730PASS/11SKIP,166filesPASS/3SKIP**, TypeScript/build/diff aprovados, build37--check e validate37 aprovados sem regenerar SQL. Warnings de chunks acima600kB são conhecidos, não falha de build. O Vitest completo também executou os harnesses locais36a e37; não substitui certificação financeira avançada de38 nem testes produtivos. Duas saídas não determinísticas dos harnesses (envelopesRPC sintéticos37 e RESULT36a) foram preservadas fora do Git e restauradas à versãoHEAD, sem alterar código/SQL certificados. Todos SQLtracked20–37 comparados byte a byte comHEAD4e.

## Publicação e limites

Este registro é pré-publicação do hotfix. Checkpoint/push/deploy exato e smoke no site oficial continuam no checklist; não presumir novoHEADLive. Último deploy documental37 confirmado pelo navegador após refresh completo:47242f4d,4e040ed3,Success/Live/Healthy às02h13; bundleDniMPhp2.js HTTP200/SHA0eea85bc.../1289337bytes reconfirmado02h14:49BRT.

O smoke do hotfix será somente leitura e abertura de modal sem submit; não desligar flags de produção, criar despesa/fence/pagamento/mensagem ou sanear histórico para produzir sucesso. GateOFF/recovery e NULL sintéticos são provas locais, não afirmar que foram reproduzidos com mutações produtivas.

Limites fora desta correção: badge/DTO de statusNULL da lista, política histórica de datas/valores cancelados, política de conta ativa no estorno e a manutenção38. Não plataforma100%, nem autorização de remover proteções financeiras para ocultar inconsistências.
