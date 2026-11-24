# Caixa 37 — plano implementável e priorizado

**Estado em 24/11/2026, 01h26 BRT: GO local restrito ao contrato37 exercitado; produção37 ainda pendente.** SQL final2acc: base em duas fresh aprovada, runtime56 grupos/zero achados (todos20 falseconfirmed anteriores recusados), convivência38 dedicadas+486 seleções/equivalentes originais/zero falhas,32 locks observados/14tryfail e stress. Hotfix36a independente instalado01h11BRT,98/98 fontes finais/75RLS/zeroLeaks/quatro snapshots financeiros antes/depois idênticos; SQL36 frozen e seis extensões37 preservados. Consolidação/limites e decisão do responsável estão em RESULT.md: não alegar suítes antigas inteiras no schema37 ou proteção universal dos consumidores antigos isolados. O gate completo2acc3688PASS/11SKIP/TSC/build será repetido antes do checkpoint37. Candidato79dd e20 aceitações inválidas continuam como histórico diagnóstico, não resultado final. Sem instalação/push/deploy37 até gate final/preflight.

O responsável reforçou o preflight de constraints/índices de clientes/koletores/contratos/parcelas/histórico por fonte fixture versionada pinada e CHECK31 conhecido; catálogo produtivo foi apenas confrontado read-only, não adotado como fonte. Rodada base repetida em dois freshPG17 com SQL37 SHA79dd86215045d967392b19f6ad0495cecdf4d84ca89d05d56f8389d81955cec2 e11 novos drifts físicos negativos passou às00h12. Integração de cinco envelopes SQL reais sintéticos com SDK/normalizadores passou23 testes; página real52 testes. Isso não substitui Q02/X01/X02/S02/S03/C02/L05 e regressões predecessoras completas pendentes. SQL36 SHA7194c1f... permanece intocado.

## 1. Prioridade e cortes de escopo

**P0 — contrato e predecessor congelados pelo responsável.** SQL36 SHA7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f instalado exatamente em23/11 às23h31BRT, verificadores34/35/36 e hashes financeiros preservados. Código36 commit2ce2f6cb enviado e deploy em andamento. Não adaptar silenciosamente o plano se36 mudar. Decisão técnica v1 mantida pelo responsável: transferência não impõe saldo suficiente; aceita saldo negativo com preview e confirmação explícita, em linha com a ausência dessa regra nos writers atuais. Isto não é exigência atribuída ao usuário. Dinheiro deve existir como evento declarado; cancelamento nunca o demonstra. Limite de valor novo37 é9999999999.99 e não limita o acumulado.

**P1 — três frentes paralelas com o mesmo CONTRACT.** Backend implementa schemas strict, normalizadores, cinco adapters tRPC e RPC mocks, isolando owner da sessão. UI implementa formulário/preview de aporte e transferência, intenção congelada, UUID estável, recovery e troca de empresa usando mocks. SQL/harness implementa nova0037 e target sintético novo, sem editar20..36 ou regenerar builders antigos. Backend/UI não precisam aguardar SQL para testar contratos, mas não devem expor execução real sem instalação certificada. Sem nova flag ou alteração da barreira global.

**P2 — juntar provas e validar convivência.** Integrar somente após testes P0/P1, executar suítes predecessoras originais sobre schema36+37 em PG17 isolado, acrescentar os cenários da matriz abaixo, provar ausência de efeitos extras e artefatos repetíveis. Isso é certificação local de37, não liberação de todo o financeiro.

**Fora do lote:** retirada avulsa, CRUD genérico financeiro, exclusão/estorno/cancelamento37, tarifas, transferência interempresa, mudança de owner/base, reparo/deduplicação de histórico, novo empréstimo, renovação/multa adicionais, cadastro de conta, alterações operacionais ou financeiras produtivas.

## 2. Fontes lidas e diferenças que realmente importam

| Fonte local | Consequência para37 |
|---|---|
| `shared/caixa.ts` | BigInt e saldo-base + movimentos; não duplicar por UPDATE saldo ou somar tabela de provas. |
| `server/routers.ts:96..117,2503..2766` | REST já lê ledger das contas sem esconder owner; caminho Drizzle dos saldos ainda filtra owner. CRUD manual não tem UUID/recovery e usa fallback multipartido. Novos37 nunca o reutilizam. Cotação RPC37 substitui qualquer cálculo de saldo do cliente para confirmar ação37. |
| `client/src/pages/Caixa.tsx` | `+`/`−` atuais são ajuste_manual e usam parseFloat; transferência manual é bloqueada no backend. Exige componentes novos e não apenas habilitar categoria. Saldo e extrato podem falhar com cache; preservar comportamento fail-closed. |
| `server/services/multaManualRpc.ts`, `shared/multaManual.ts` | Padrão útil de schema strict/envelope/UUID sem fallback;37 tem request/recovery próprios e não reutiliza family36. |
| migrations20/21/22/25 | Writes privados existentes, advisory22022, base imutável de cohorts; capability25 precisa ser capturada antes do consumo. Não falsificar categoria de empréstimo/recebimento para transferir. |
|31/33| Ponte de renovação e recovery com fence; manter protocolos e firmas originais. |
|34| `legados_validar` recusa entrada avulsa/sem vínculos mesmo com owner correto. É necessária exceção exclusiva para perna37 comprovada, não relaxar validação histórica. |
|35| Guard de ledger protege conta compartilhada; pontes privadas preservam21/22/25/31/34. Snapshots de contrato não incluem aporte sem contrato/parcela. |
|36| Corpos efetivos de ciclo/legados/multimodal já estendidos. `a0_multa36_ponte` executa antes dos guards e recusaria novo37; precisa slot próprio37. Provas36 continuam imutáveis e contratos36 não devem voltar aos writers anteriores. |

A referência anterior a revisão individual indisponível foi removida pelo responsável; não se presume conteúdo e não se exige produzir documento fictício. Este plano não afirma que contratos21/34 estejam admitidos36: o SQL36 instalado admite multa somente sobre origem35 íntegra.37 não amplia a admissão de multa.

## 3. Baseline local observada (SHA-256 de arquivo, não hash de função)

Hashes lidos localmente em 23/11/2026; o build37 futuro deve piná-los e construir inventário de funções efetivas com parser validado. Não usar catálogo runtime como fonte de verdade, não confundir SHA do arquivo com `digest(prosrc)`.

| Migration | SHA-256 |
|---|---|
|0020|`a6852e4160dcadf21f81029daf231af6d308fab7f8733b3e16769d03923bc452`|
|0021|`08b05165412c8f6259db98d70c8d220c6f99c7a3a6bc7866aa86cc00b0558a82`|
|0022|`abce663253f85eafe03d3c4f9a81d601941164bba7ef4d0d8024b892be88f64c`|
|0025|`63c5a3afbf86e7dbd67a726368d0dcac04a51c90200f797f1f9d35af10259199`|
|0031|`f0d0db2cafecd39c7f9ce0296683e66141ee8bbad4243b079b5994244f02db7f`|
|0033|`7ec52905fa260dc6d14af5fabcef74a2a1a7f0fa65874e15d3bd8358cadc5827`|
|0034|`615d0b81fb1a41b5dd205214ebddc7e32f0d75576022df66905bc90396959ad0`|
|0035|`6e5c11587d571e64a51585488c2fad7075f4d5dfeb9202a3a5dced795a9c0b03`|
|0036|`7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f`|

A instalação isolada também reproduz0016/0018 e demais dependências que o harness original exige; validar variante de proteção de senha conhecida, sem criar exceção genérica de trigger.23/24/26..30 não requerem alteração para este recorte. Não inventar migration32 inexistente na sequência local.

## 4. Expansão SQL mínima futura

Proposta de arquivo futuro: `drizzle/0037_rpc_aporte_transferencia_caixa.sql`, criado somente quando houver autorização de implementação. Sem coluna nova em `transacoes_caixa`, `contas_caixa`, contratos ou parcelas. Sem tabela de saldo atual.

| Objeto novo37 | Campos/invariantes mínimos |
|---|---|
|`caixa37_operacoes`|id UUID PK; user/chave UNIQUE; acao; request JSONB; hash_request; resultado/auditoria/concluida_em todos nulos ou todos completos; identidade/request imutáveis. Reserva e conclusão no mesmo commit; commit pendente proibido.|
|`caixa37_pernas`|op FK, papel, user, transacao_id UNIQUE FK, snapshot inteiro, hash; PK(op,papel). Aporte1; transferência2 papéis opostos, valor/data iguais e contas diferentes; proof final/confirmação diferida, não só CHECK de linha.|
|`caixa37_contas`|conta PK/FK, user, saldo_base original exato, primeira_op FK; pin imutável de identidade/base, nunca saldo efetivo. FK/guard impede remoção/reparenting.|
|`caixa37_fences`|user/chave PK, request/hash, created_at; imutável, independente da existência de operação; nenhuma expiração.|
|`caixa37_capacidades`|xid/pid/op/slot_guard/papel, INSERT ledger, anterior NULL, posterior rowtype inteiro; uma por guard/perna, consumo one-shot, sem resíduos.|
|`caixa37_coexistencia`|xid/pid + posterior inteiro/identificador witness; cópia transitória exata dos writers originais, consumida pelo guard37; não é operação financeira nova.|
|`caixa37_manifesto`|singleton assinatura; source/ACL/config/overload/rowtypes/triggers/constraints/RLS e dependências seladas; não aprende drift.|

Helpers privados propostos: request/dinheiro, barreira, inventário/locking whole-owner, cotação, reservar, consumir capacidade, construir/escrever perna, validar operação/pernas, selar, metadata/verificar, imutabilidade, ponte/guard e constraint trigger diferido. Cinco RPCs estão definidas integralmente em CONTRACT. Nenhum helper publicado para service_role.

**Whitelist de seis funções predecessoras a estender em0037:** ciclo_guardar, legados_guardar, multimodal_guardar, multa36_guardar (ramo privado INSERT ledger37), multa36_ponte (consumo37 antes de buscar testemunhas antigas), legados_validar (somente exceção para pernas37 completas comprovadas). Não alterar outras funções/assinaturas/defaults/ACLs/tabelas/constraints antigas. Se código exigir sétima extensão, parar e justificar antes de implementar.

Adicionar apenas triggers37 novos, incluindo ponte `a1_caixa37_ponte`, guard final ledger `z_caixa37_ledger`, pin de contas e imutabilidade/commit-check nas tabelas37. Não renomear/desativar/remover triggers existentes, não usar replication_role/GUC/source forjado, não mudar status físico de parcela.

**Preflight/instalação:** PG17 + Read Committed + janela DDL cooperativa exclusiva; locks DDL das famílias anteriores na ordem conhecida; ausência de qualquer homônimo37; hash/versionamento de todos os corpos efetivos e ACLs/roles/owners/config/overloads/rowtypes/triggers/RLS. Verificar manifestos34/35/36 antes de tocar. Snapshot de metadata predecessor intocado, allowlist do delta em seis funções e triggers37. Postflight compara corpos finais esperados e inventário completo: nenhuma alteração fora da whitelist. Somente depois reseal metadata34/35/36 necessário, instalar selo37, executar verificadores, commit. Não reseal dados/auditorias/origens antigas. Runtime apenas verifica, nunca reassina. Falha reverte DDL inteiro.

**Coexistência é requisito, não opcional:** bridge37 reproduz witness específico de21/22/25/31/34/35/36 antes de outros guards consumirem-no. Preserve defaults exatos (originais usam transaction_timestamp; novo37 clock capturado), vínculos, desc/data/valor/owner, operação privada única em andamento quando disponível e prova por linha. Não chamar RPC antiga como superusuário, não aproveitar capability genérica e não exigir witness que a antiga implementação ainda não criou. Testes positivos abaixo são obrigatórios antes de pin de conta37 estar liberado.

## 5. Sequência do harness e integração

Criar harness37 próprio em etapa futura, com build/fixture/runner/validate novos, reaproveitando funções de parsing como leitura/import sem editar builders35/36. O build37 não executa build.mjs36, pois ele sobrescreve SQL36. Instalar fixtures sintéticos mínimos de duas empresas, cadeia original até36 e depois37 no PG17 descartável. Nenhuma ligação a Supabase, produção, backup real ou credenciais. Repetir em banco limpo para provar one-shot determinista e guardar source-hashes, catálogo normalizado antes/depois, contagens financeiras, logs de concorrência e resultados.

A família37 usa sua barreira por owner/UUID e o protocolo de contas22022 antes de tenant34034/contratos34035/rowlocks. Ledger whole-owner inclui contas inativas e reverse-link por tx.user_id para detectar conta alheia. Descoberta sob leitura seguida de locks/releitura evita aceitar phantoms; writers após rowlocks usam try-lock e rollback. Não basta testar duas transfers37: os writers originais possuem outras barreiras e usuários podem renomear/criar/inativar contas. O gate exige corrida real observada, sem sleeps usados como prova de espera.

## 6. Matriz de testes priorizada

Todas as provas são sintéticas. Cada negativa compara ledger/base/contratos/provas antes/depois e exige zero dinheiro parcial; sequência pode avançar por rollback. Casos de segurança também exigem zero capability/witness residual.

| ID/Prioridade | Cenário | Prova exigida |
|---|---|---|
|F01 P0|Aporte0.01 e valor máximo; base negativa|Uma entrada37, base idêntica; delta exato+valor em conta e total owner.|
|F02 P0|Transferir origem→destino, depois inversa; ordem IDs invertida|Exatamente duas pernas/op; mesmos centavos/data/owner; total owner constante; base nunca muda.|
|F03 P0|Saldo insuficiente/negativo e destino inativo|Negativo permitido conforme contrato; conta escolhida inativa recusa. Conta inativa histórica entra no total e não bloqueia só por estar inativa.|
|F04 P0|Dinheiro0, negativo, vírgula, exponentes, três casas, overflow, number em vez de string; IDs/hash/date/JSON inválidos|22023/schema rejection, sem arredondamento ou coerção; sem mutation executada se rejeitado no adapter.|
|F05 P0|Mesmo ID origem/destino; destino empresaB/null-owner; tx.user_idA em contaB ou userB/null em contaA|42501/23514; nenhum lançamento; nunca omitir contaminação.|
|F06 P0|Contaminação em terceira conta ownerA, inclusive inativa|Quote/mutationA recusam whole-owner; ownerB independente segue normal.|
|F07 P0|Mais de50/1000 registros e acumulados acima MAX_SAFE_INTEGER|Saldo/hash lêem todo ledger com NUMERIC/BigInt e texto; extrato paginado não participa; erro de página não vira saldo parcial.|
|Q01 P0|Mudar outra conta/ledger do owner entre quote e execução|40001 por hash/conjunto; request antigo não é silenciosamente recotado.|
|Q02 P0|UTC/São Paulo/Tóquio e mudança BRT após espera longa ou durante escrita|Dia SQL após locks, rollback na virada; replay histórico funciona no dia seguinte.|
|I01 P0|Mesmo UUID/request sequencial e concorrente; mesmo UUID entre ações|Uma operação e1/2 pernas; replay histórico repetida=true; divergente23505.|
|I02 P0|Confirmar, append legítimo subsequente, replay/recovery da primeira|Saldo histórico no resultado; prova continua válida; não comparar antigo snapshot inteiro ao ledger atual e bloquear append legítimo.|
|R01 P0|Timeout antes/depois do commit; envelope quebrado ou resultado com equação/IDs errados|Estado ambíguo, UUID/request preservados; só recovery autoritativa fecha.|
|R02 P0|Corrida execução×recovery e recovery×recovery|Ou confirmed, ou fence permanente+execução tardia recusada; jamais not_executed seguido de commit.|
|R03 P0|Replay de fence request igual/divergente; tentativa de execução após fence|not_executed estável,23505 divergente/55000 fenced; nova ação exige novo UUID após confirmação.|
|R04 P0|Conta ficou inativa, dia/hash antigo expirou; owner foi adulterado|Recovery/replay confirmado aceita histórico próprio inativo; troca owner/prova inválida recusa e não fecha intenção.|
|C01 P0|TransfersA→B/B→A simultâneas, muitos37 e aporte concorrente|Locks ordenados; execução exata ou40001 seguro, nunca deadlock protocolar persistente ou perna solta.|
|C02 P0|37×writer21/22/25/31/34/35/36, e DML cadastral/create conta/reparenting|Espera/try-lock observados, releitura de conjunto, saldo final conservado; nenhum lock novo após rowlock com espera circular.|
|X01 P0|Fault injection antes/depois de cada perna, proof, seal e virada|Rollback total; nenhuma operação pendente commitada; retry mesmo UUID não duplica.|
|X02 P0|Trigger adulterador muda NEW/row após consumo; extra ledger/perna|Comparação esperado×real e commit-check recusam, mesmo se antigo guard deixou passar.|
|S01 P0|anon/authenticated/service_role direto em tabelas/helpers37; flag/GUC/source/stack falsa|Permissões negadas; role backend só executa RPC; nenhum bypass.|
|S02 P0|Capability37 em outra sessão/op/guard/perna/valor/owner/data/descrição/createdAt; double-consume|Sem autorização; one-shot exato; nenhuma capability37 permite UPDATE/DELETE ou outra tabela.|
|S03 P0|Tampering de request/hash/audit/result/pin/fence/perna concluídos|42501/23514; replay/recovery nunca confirmed corrupto; pending commit proibido.|
|D01 P0|Drift source/ACL/owner/config/default/overload/rowtype/trigger/RLS/homônimo e reaplicar37|55000 antes de expansão; DDL inteiro rollback; nenhuma adoção/correção automática.|
|D02 P0|Drift runtime após selo, inclusive nas seis funções ampliadas|Verificador37 e antigos recusam; runtime não reseal.|
|L01 P0|Conta compartilhada35+36 recebe aporte/transfer37; depois operação original35 e recebimento36|Fluxos originais intactos; snapshots/provas36 e origem35 não mudam por aporte37; nenhuma origem histórica criada37.|
|L02 P0|Conta protegida21/22 usa37; depois criação21/recebimento22 e despesa25/estorno25 legítimos|Cada writer original gera suas pernas/provas exatas, passa bridge37 e preserva base/provas37.|
|L03 P0|Conta historicamente elegível34 usa37; quote/receber34 original, replay e coexistência35 quando já suportada|Validador34 reconhece só prova37; entrada avulsa antiga continua recusada. Não reabrir conta21 já recusada34.|
|L04 P0|Renovação31 antes/depois de37 na conta e writers originais em ordem inversa|Prova principal/juros intacta, defaults originais e consumo das pontes corretos, nenhum novo desembolso37.|
|L05 P0|Witness antigo inexistente/ambíguo/commitado, hash incorreto ou físico cruzado com cohort novo|Bridge37 recusa; não concede writer antigo sobre contrato35/36 protegido.|
|H01 P0|Histórico estrutural válido, duplicidade aparente e parcela cancelada35/36|Histórico contado fisicamente uma vez por linha, não deduplicado/reparado; zero entrada por cancelamento; categoria antiga nunca vira prova37.|
|U01 P1|Double-click, fechar modal/page, reload, callback tardio e troca owner|Intenção congelada; sem submit automático; armazenamento/cache isolados e recovery disponível ao owner correto.|
|U02 P1|RPC ausente, cache stale, quote falha, resposta conflitante|Sem REST/Drizzle/CRUD fallback, zero falso/sucesso falso; erro visível.|
|U03 P1|Preview/result/recovery mocks estritos e refetch depois de confirmar|Equações/IDs/request conferidos; sem optimistic balance nem parseFloat; invalidar contas/extratos/quotes/conferência/agregados pertinentes.|

## 7. Critério de conclusão do futuro lote37

GO **somente local** quando todos P0 e contratos de adapter/UI passarem, migrations anteriores mantiverem hashes, delta de catálogo ficar exatamente na whitelist, suites originais não regredirem e saldo-base/histórico financeiro permanecerem intactos. Entrega deve diferenciar teste efetuado de desenho: fornecer hashes finais, resultados, falhas induzidas, corridas observadas e limites conhecidos. Produção/publish exigem autorização e fluxo próprios do pai; este plano não os executa nem recomenda desbloqueio indiscriminado.

Implementação local autorizada pelo responsável, com hash36 congelado e decisão negativa acima validada. Implementar e provar exceção34 e ramo da ponte36 antes de qualquer integração. Não substituir provas por flags, saneamento ou patch nos arquivos antigos. O gate whole-owner é restrição de integridade deste lote, não liberação financeira irrestrita de contas históricas contaminadas.
