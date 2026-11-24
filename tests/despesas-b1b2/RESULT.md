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

Checkpoint24fafda2f2bc6ef311cd8b3b15b4cf7aae7d1906 salvo às02h18:49; seis arquivos exatos e workspace limpo. Push normal fast-forward4e→24fa às02h19:14, remoto confirmado pelo hash completo. DigitalOcean deployment867aed16-bb09-42d6-89b5-425f96246a2e, clone24fa exato em log, Success/Live/Healthy confirmado após refresh às02h25:04. Build2m42total/58sbillable. Bundle oficialBNaHUHxl.js,1289340bytes/SHA5ff1384d2f9c17bdea83cdc3b0961727e5b13b75cc3081f1fb21dbe6bf4672e1: rootHTTP200 e respostaJavascript preservada, comparação byte a byte igual ao build certificado às02h23:39. Regressões pós-push154PASS/4files/exit0/workspaceclean às02h21. Publicação Manus24fa também concluiu success.

Smoke oficial02h25–02h27 na sessão administrativa existente: página carregou, lista própria vazia e três cartões0.00/0; Nova despesa habilitada. Modal abriu com descrição/categoria/valor/data civil BRT/observações, depois foi fechado sem preenchimento ou submit. Não havia intenção salva própria para testar recovery; não criar UUID/fence fictício nem desligar flags em produção. CasosNULL/B2gateOFF continuam provas locais, não afirmar reprodução produtiva desses cenários. Nenhuma despesa, pagamento, mensagem, saneamento ou intenção de teste criada.

Reconferência pós-smoke02h26: fontes129/129zeroDrift/selos34–37 e postflight82RLS/ACL/cap37/zeroresíduos37/36 com JSON inteiro idêntico à baseline37. Snapshot45 hashes/contagens/contexto/ausência idêntico ao capturado antes deste smoke; quatro financeiros também idênticos à baseline original (12contas/1152lançamentos/316contratos/1235parcelas, divergências12/2/6 preservadas). As quatro tabelas já pertencem ao conjunto45, não49 tabelas distintas. Snapshot adicional específico de contas_pagar comparou todas as colunas:50 despesas/hash551a05de... antes02h25:31 e depois02h26:54 idênticos; não confundir50registros com50tabelas. O comparador privado assertou todas essas igualdades, SQLtracked frozen e workspaceclean às02h27:29.

Este complemento documental relata o deployment24fa efetivamente observado; não presume que o próximo commit de documentação estejaLive. Manutenção38 permanece candidata privada, não entregue por este hotfix.

Limites fora desta correção: badge/DTO de statusNULL da lista, política histórica de datas/valores cancelados, política de conta ativa no estorno e a manutenção38. Não plataforma100%, nem autorização de remover proteções financeiras para ocultar inconsistências.
