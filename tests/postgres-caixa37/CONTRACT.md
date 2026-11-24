# Caixa 37 — contrato de aporte e transferência

**Status: contrato v1 autorizado para implementação LOCAL pelo responsável; NÃO certificado, NÃO publicado.** O responsável congela as interfaces abaixo para três frentes de implementação local. Operações financeiras produtivas, saneamento, alteração de flags ou edição de migrations anteriores permanecem fora do escopo. O publish36 é independente.

Foram lidas fontes locais de Caixa/UI, os contratos35/36, guards e trechos pertinentes das migrations20/21/22/25/31/33/34/35/36; a matriz privada existente foi usada somente como contexto. A referência anterior a arquivo de revisão individual indisponível foi removida pelo responsável: não é requisito adicional nem evidência presumida. A implementação se baseia nos contratos e fontes versionados disponíveis.

## 1. Escopo e decisões financeiras

O aporte registra dinheiro novo **efetivamente recebido** em uma conta própria: exatamente uma entrada positiva. Não é saldo inicial, receita de parcela, cancelamento, devolução presumida nem ajuste para fechar divergência. A transferência move um valor entre **duas contas distintas do mesmo `user_id`**, em um commit, com uma saída e uma entrada de valor idêntico. Não cruza empresas, não permite tarifa implícita, câmbio, terceira perna, compensação por saldo líquido ou combinação com contrato/parcela.

O saldo efetivo de cada conta é `contas_caixa.saldo + SUM(entradas) - SUM(saidas)`. `saldo` é **saldo-base**, não cache do saldo efetivo. Nenhuma ação37 atualiza essa coluna, `updatedAt` da conta ou o principal de contrato. Auditoria37 guarda os efeitos, não cria uma segunda tabela de saldos nem soma suas pernas novamente ao ledger.

**Decisão v1 sobre saldo negativo:** não introduzir regra de saldo suficiente que os fluxos atuais não possuem. A transferência pode deixar saldo efetivo negativo; o preview mostra esse resultado e exige confirmação explícita. Não há limite artificial nem truncamento para zero. Aporte aceita base negativa válida. Isto não corrige validadores anteriores que tenham restrições próprias sobre base negativa e não promete reabrir contratos recusados por eles.

Não há cancelamento, exclusão, retirada avulsa ou estorno37 neste lote. Fechar modal não desfaz dinheiro. Desfazer uma transferência exigirá operação compensatória própria futura, com nova aprovação e nova prova; nunca excluir as pernas. `cancelada` em parcela35/36 não comprova dinheiro recuperado e jamais origina lançamento37.

## 2. Tipos e normalização compartilhados

Owner é sempre `ctx.user.id`, derivado da sessão autenticada no backend. Nenhum input de UI aceita owner/empresa, categoria física, tipo de perna, operationId, IDs de transação, flags, source ou saldo calculado pelo cliente. IDs de conta são inteiros positivos até `2147483647`. UUID é obrigatório, válido e normalizado para minúsculas **antes** de congelar a intenção. A chave é única por owner em todas as ações37, não apenas por família.

Dinheiro de operação: texto canônico `^(0|[1-9][0-9]{0,9})\.[0-9]{2}$`, maior que `0.00`, máximo `9999999999.99`, sem sinal, exponentes, vírgula ou arredondamento. Esse limite conservador coincide com a validação monetária35/36 nas contas compartilhadas. Bases existentes não são convertidas para esse limite: validar sua precisão física `numeric(15,2)` e aceitar sinal negativo. Totais/saldos agregados são texto decimal exato com duas casas, sinal negativo somente para valor negativo, sem `-0.00` e **sem limite de dígitos herdado da operação**. SQL usa NUMERIC sem typmod para somas; TS usa BigInt, nunca float, `parseFloat` ou `toFixed` como validação.

`descricao` no formulário é opcional, no request SQL é sempre `null|string`. Normalizar uma vez com trim; vazio vira null; string não vazia tem 1..500 caracteres. Congelar essa forma antes da cotação e não voltar a normalizar no replay. SQL verifica a forma canônica, não a altera silenciosamente. JSON deve ser objeto próprio, sem getters, protótipos especiais, chaves extras ou valores undefined. Datas são DATE real `YYYY-MM-DD`, faixa 1900..9999; não timestamp, Date JS ou dia UTC.

```ts
type Acao37 = 'aporte' | 'transferir';
type CotarCaixa37Input =
  | { acao: 'aporte'; contaDestinoId: number; valor: string; descricao?: string }
  | { acao: 'transferir'; contaOrigemId: number; contaDestinoId: number;
      valor: string; descricao?: string };
type Aportar37Input = {
  contaDestinoId: number; valor: string; descricao?: string;
  dataTransacao: string; estadoHash: string; idempotencyKey: string;
};
type Transferir37Input = Aportar37Input & { contaOrigemId: number };
// Request normalizado, definitivo, usado também na recuperação:
type Request37 = {
  acao: Acao37; contaOrigemId: number | null; contaDestinoId: number;
  valor: string; descricao: string | null; dataTransacao: string; estadoHash: string;
};
type Recovery37Input = { idempotencyKey: string; request: Request37 };
```

`contaOrigemId=null` é obrigatório para aporte; para transferência é obrigatório um ID distinto do destino. UI/backend não convertem pedido de transferência em aporte. `estadoHash` é SHA-256 lowercase de 64 hex, emitido pelo SQL e opaco ao cliente.

## 3. Assinaturas SQL reservadas e adapters tRPC

Todas as RPCs retornam JSONB; somente `service_role` recebe EXECUTE. Helpers/tabelas37 não recebem SELECT/DML/EXECUTE público. São nomes novos; ausência não autoriza fallback.

| tRPC proposto | RPC e argumentos SQL/PostgREST, na ordem definitiva |
|---|---|
| `caixa.capacidades37` | `rpc_capacidades_caixa37()` |
| `caixa.cotar37` | `rpc_cotar_caixa37(p_user_id integer, p_acao text, p_conta_origem_id integer, p_conta_destino_id integer, p_valor text, p_descricao text DEFAULT NULL)` |
| `caixa.aportar37` | `rpc_aportar_caixa37(p_user_id integer, p_chave_idempotencia uuid, p_conta_destino_id integer, p_valor text, p_data_transacao date, p_estado_hash text, p_descricao text DEFAULT NULL)` |
| `caixa.transferir37` | `rpc_transferir_caixa37(p_user_id integer, p_chave_idempotencia uuid, p_conta_origem_id integer, p_conta_destino_id integer, p_valor text, p_data_transacao date, p_estado_hash text, p_descricao text DEFAULT NULL)` |
| `caixa.reconciliar37` | `rpc_reconciliar_caixa37(p_user_id integer, p_chave_idempotencia uuid, p_request jsonb)` |

Capacidade SQL exata: `{disponivel:true,regra:'caixa37_v1',aporte:true,transferencia:true,recovery:true}`. O adapter pode emitir a versão false somente se RPC realmente ausente (`PGRST202/42883`); drift, erro ou resposta inválida não viram capacidade comprovada nem lista vazia. Não criar/alterar feature flag. A recuperação fica alcançável para intenção já enviada mesmo quando uma nova ação está indisponível.

Cada mutation executa **uma RPC, uma vez**, sem retry automático, REST, Drizzle alternativo, chamar registrarTransacao ou atualizar saldo-base. O wrapper de aporte monta Request37 com acao=aporte/origem=null; o de transferência com acao=transferir. Owner não integra Request37 público, mas integra o hash de cotação e vínculo privado da operação.

## 4. Cotação autoritativa do livro inteiro do owner

A cotação não reserva UUID, não admite contrato, não grava saldo, operação ou fence. Pode adquirir locks transacionais para leitura consistente; não é STABLE se usar helpers de locking. Retorno estrito:

```ts
type ContaSaldo37 = {
  contaCaixaId: number; nome: string; saldoBase: string;
  entradas: string; saidas: string; saldoEfetivo: string;
};
type Cotacao37 = {
  elegivel: true; regra: 'caixa37_brt_v1'; acao: Acao37;
  contaOrigemId: number | null; contaDestinoId: number; valor: string;
  descricao: string | null; dataTransacao: string; estadoHash: string;
  origem: ContaSaldo37 | null; destino: ContaSaldo37;
  saldoOrigemApos: string | null; saldoDestinoApos: string;
  saldoTotalOwnerAntes: string; saldoTotalOwnerApos: string;
};
```

Falha de input, ownership, integridade ou consulta gera erro, nunca `{elegivel:false,saldo:0}`. `origem=null` e `saldoOrigemApos=null` somente em aporte. Transferência: origemApos=origemAntes−valor, destinoApos=destinoAntes+valor, totalOwnerApos=totalOwnerAntes. Aporte: destinoApos=destinoAntes+valor, totalOwnerApos=totalOwnerAntes+valor. Os totais incluem contas próprias ativas **e inativas**; somente as contas escolhidas precisam estar ativas para nova operação. Não há money numérico na resposta.

**Conjunto de leitura:** todas as contas cujo `user_id=uid`, inclusive inativas; ledger inteiro cuja conta pertença a esse conjunto **OU** cujo `user_id=uid`. A segunda condição detecta lançamento do owner em conta alheia; a primeira detecta owner externo/nulo dentro de conta própria. Não aplicar filtro owner ao ledger que esconda contaminação. Validar cada row: conta existente e própria, owner não nulo/exato, direção entrada/saida, valor finito positivo com centavos, DATE finita; vínculos opcionais de contrato/parcela/clientes/koletores pertencentes ao owner e coerentes pelos IDs físicos. Não exigir ativo das contas históricas não escolhidas nem reinterpretar situação contratual em dinheiro. Nenhum limite de extrato, período, truncamento ou soma de apenas últimas 50 linhas participa da cotação.

Lançamentos históricos estruturalmente válidos contam uma vez pelo ledger físico, sem inventar prova37. Provas37 existentes são conferidas integralmente. Duplicidade histórica suspeita não é removida, deduplicada nem compensada; registro estruturalmente inválido recusa operação. Esse gate whole-owner pode bloquear uma conta limpa do mesmo owner quando outra conta dele está contaminada: é decisão explícita do lote37, não globalização do gate dos módulos anteriores. Outro owner permanece independente.

`estadoHash` = SHA-256 do texto JSONB canônico de `{regra,userId,acao,contaOrigemId,contaDestinoId,valor,descricao,diaBrt,contas:[rowtypes inteiros ordenados por id],ledger:[rowtypes inteiros ordenados por id],provas37:[evidências completas ordenadas]}`. Incluir contas inativas e reverse-links descritos acima. Excluir instante variável da geração e o próprio hash. JSONB SQL, não `JSON.stringify`. Não expor snapshots/PII na resposta. A mutation recomputa a mesma cotação sob locks e exige igualdade do hash/dia/valores; qualquer alteração em outra conta do owner invalida a cotação.

## 5. Resultado definitivo e pernas físicas

```ts
type Perna37 = {
  papel: 'aporte' | 'origem' | 'destino'; transacaoCaixaId: string;
  contaCaixaId: number; tipo: 'entrada' | 'saida'; valor: string;
};
type Result37 = {
  success: true; regra: 'caixa37_v1'; acao: Acao37;
  operationId: string; idempotencyKey: string; repetida: boolean;
  contaOrigemId: number | null; contaDestinoId: number;
  valor: string; dataTransacao: string; descricao: string | null;
  pernas: Perna37[];
  saldoOrigemAntes: string | null; saldoOrigemApos: string | null;
  saldoDestinoAntes: string; saldoDestinoApos: string;
  saldoTotalOwnerAntes: string; saldoTotalOwnerApos: string;
};
```

OperationId é UUID gerado pelo banco no primeiro commit e imutável, distinto conceitualmente da chave fornecida. IDs de ledger são strings de inteiro positivo na resposta (nunca UUID inventado); banco v36 tem `id integer`, portanto validar faixa física até 2147483647. Não converter tipos em silêncio. `pernas` tem comprimento1 para aporte, papel aporte; comprimento2 para transferência, ordem **origem, destino**. Os IDs são distintos e pertencem à mesma operationId via tabela privada37. Cada valor igual ao request, não valores assinados. Todas as demais propriedades são estritamente conferidas pelo adapter contra a intenção; chaves extras/ausentes ou equações divergentes deixam resultado **não confirmado**.

Rowtype inteiro de `transacoes_caixa`, sem nova coluna em tabela antiga:

| Ação/perna | tipo | categoria física | descrição física definitiva |
|---|---|---|---|
| aporte | entrada | ajuste_manual | `Aporte37 <operationId>` |
| transferência/origem | saida | transferencia_conta | `Transferencia37 <operationId> origem` |
| transferência/destino | entrada | transferencia_conta | `Transferencia37 <operationId> destino` |

Ambas referências `contrato_id`/`parcela_id` são NULL, owner exato, conta exata, DATE BRT exata, `createdAt` igual ao instante capturado pelo SQL **depois dos locks**. Descrição do usuário fica na operação/auditoria/resultado, não substitui o identificador físico. Categoria `ajuste_manual` antiga não se torna aporte37 por inferência: somente associação privada + snapshot íntegro identifica aporte. Não ampliar CHECK/categorias, nem falsificar `pagamento_parcela`/`emprestimo_liberado` para passar guard. UUIDs/IDs aparecem na UI após confirmação, não como prova autogerada.

## 6. Protocolo de transação, clock e prova

Execução exige PostgreSQL17 e Read Committed. Ordem: gate metadata37; validação canônica; barreira de chave `hashtextextended('caixa37:'||uid||':'||uuid,37)`; descobrir todas as contas/links do conjunto; adquirir advisory `(22022,contaId)` em ordem crescente; `(34034,uid)`; `(34035,contratoId)` crescente para vínculos lidos; só depois locks de linhas em ordem `contas → clientes → koletores → contratos → parcelas → ledger`, IDs crescentes por tabela. Helpers de guard que já estejam após row-lock usam **try-lock** e abortam com40001, nunca espera que inverta essa ordem. Usar aquisição try/bounded também ao coordenar protocolos antigos: novos37 serializam/rejeitam contenção, não introduzem deadlock circular com as barreiras privadas antigas.

Reconsultar conjunto/ownership depois dos locks. Conta/link novo ou movido para fora do conjunto previamente travado causa40001, não continuar sem lock. O protocolo `a_legados_protocolo_*` já existente ajuda a serializar writers cadastrais pelo owner; preservá-lo. Locks só novos37 não substituem a cooperação dos writers originais. Não adquirir row-lock em users antes das contas, devido à inversão com writers financeiros antigos; conferir usuário sem produzir bloqueio circular. Corridas entre outro owner e tentativa de contaminação são resolvidas por IDs físicos e try-lock dos guards.

Após travar, capturar `clock_timestamp()` e derivar dia em `America/Sao_Paulo`. Nunca usar relógio UI, início da transação ou `new Date().toISOString()` para DATE. Revalidar o dia imediatamente antes de selar; virada BRT aborta tudo com40001. Replay confirmado e recovery não exigem que o dia antigo ainda seja hoje; não reexecutam a operação.

Uma operação privada pendente, com xmin in-progress visível somente à própria transação/subtransação, autoriza rowtypes37 exatos. Emitir capacidade **independente por guard e por perna**, incluindo xid/pid/op/guard/tabela/evento/papel/anterior NULL/posterior inteiro; consumo DELETE one-shot. Só INSERT ledger37; nunca autorização de UPDATE/DELETE/contrato/parcela/histórico. Prealocar ID pela sequência local dentro da transação, montar rowtype inteiro, inserir e conferir NEW efetivamente persistido. Lacunas de sequência após rollback são aceitáveis, dinheiro parcial não.

Auditoria imutável inclui request/hash SQL, cotação/hash, contas/livro owner antes, conjunto esperado depois=antes+perna(s), rowtypes reais das pernas, equações de saldo, instante/data BRT e resultado. Comparar real com **esperado**, não selar o estado observado arbitrariamente. Provar exatamente1/2 pernas, nenhum efeito extra, nenhuma conta-base/linha antiga/contrato/parcela/prova predecessora alterada e zero capacidades residuais. Finalizar operação uma única vez; constraint trigger diferido37 recusa commit de operação incompleta, pernas faltantes/extra ou capacidades restantes. Auditorias e fences nunca mutáveis.

## 7. Replay e recovery — resultados ambíguos

UUID único `(user_id,chave)` também entre aporte e transferência. Mesmo UUID + mesmo Request37 já confirmado retorna o **resultado histórico armazenado**, com apenas `repetida=true`. Não gera nova perna, não exige cotação atual, não devolve saldo atual como se fosse saldo da operação. Valida owner atual, manifesto, audit/hash e pernas físicas; contas hoje inativas podem ter confirmação histórica, mas mudança de owner é recusada. Não comparar snapshot histórico depois contra o ledger atual inteiro após append legítimo: comparar pernas37 e imutabilidade do prefixo protegido, não negar todas as operações subsequentes.

Mesmo UUID com request diferente, inclusive trocar ação, descrição, conta, valor, hash ou dia:23505. UUID fenced com mesmo request:55000 com detalhe `CAIXA37_UUID_FENCED`; fenced divergente:23505. Operação pendente commitada/incompleta ou prova adulterada:23514, nunca confirmed/not_executed.

```ts
type Recovery37Result = {
  userId: number; idempotencyKey: string; request: Request37;
  requestHash: string; proof: 'uuid_fenced37_v1';
  status: 'confirmed' | 'not_executed';
  operationId: string | null; result: Result37 | null;
};
```

Recovery adquire **a mesma barreira** e os locks relevantes, confere identidade/owner/cadeia das provas e request canônico. Se operação confirmou, conferir auditoria, hash, 1/2 pernas exatas e retornar `confirmed`, operationId/result históricos; `result.repetida=false` é o original persistido. Se operação inexiste, inserir fence permanente `(owner,uuid,request,hash)` em transação e retornar `not_executed`, operationId/result NULL. Mesmo fence/request retorna a mesma evidência. Não revalidar cotação/dia expirados para fechar UUID ausente; targets precisam ainda ser próprios, não necessariamente ativos. Se integridade não pode ser comprovada, recovery erra e a intenção permanece aberta.

A barreira impede `not_executed` enquanto uma primeira execução ainda pode confirmar: execução ganha → confirmed; recovery ganha → fence e execução atrasada é recusada. Não há fila pós-resposta, commit assíncrono ou lease expirável. `not_executed` só libera criar **nova cotação + nova intenção + novo UUID** depois da confirmação explícita do usuário. Não repetir automaticamente. Timeout, resposta quebrada, HTTP500/409 ou erro SQL **não** são evidência de ausência. Guardar request/UUID congelados, mesmo ao fechar modal/trocar página; recovery perdida repete recovery com os mesmos dados.

Adapter confere envelope RPC não contraditório, schema strict, eco owner/request/chave/hash e equações; hash é opaco SQL e não recalculado com JSON.stringify. Evidência aceita somente deste endpoint. Troca de owner isola armazenamento/cache/recovery; callback atrasado do owner anterior não atualiza a empresa atual nem reenfileira operação nela.

## 8. Integração mínima dos guards selados (somente desenho)

Sem mudanças nos arquivos001x..0036, rowtypes, constraints, ACLs ou provas financeiras existentes. A migration **nova0037** poderá fazer CREATE OR REPLACE de uma whitelist estreita de funções de runtime, construída a partir dos corpos **efetivos após36**, nunca das versões originais substituídas:

1. `ciclo_guardar`, `legados_guardar`, `multimodal_guardar`, `multa36_guardar`: inserir um ramo de consumo privado37 **somente INSERT de ledger37 exato**. Manter byte a byte os demais ramos, incluindo consumo36, pontes25/31/34 e regras de conta. O early-return37 vem depois de o protocolo37 adquirir/revalidar os locks; não é bypass de segurança global.
2. `multa36_ponte`: ramo37 igualmente estrito antes de sua inferência de testemunhas antigas. Necessário: o trigger `a0_multa36_ponte` hoje recusaria aporte sem contrato em conta36 antes de chegar aos guards. Consome slot próprio37 e retorna; não fabrica operação/capacidade36. Caminhos originais21/22/25/31/34/35 continuam intocados.
3. `legados_validar`: alterar exclusivamente a recusa de entrada avulsa/sem vínculos para admitir **perna comprovada37** (op concluída, request/hash/audit/snapshot íntegros, owner e conta próprios, par completo quando transferência). Manter todas as outras validações34, incluindo recortes contratuais e rejeição de conta prospectiva21 quando já prevista. Isso permite34 continuar em suas contas historicamente elegíveis após37 sem aceitar avulso antigo por categoria. Não usar `continue` que pule validação de owner/data/valor. São **seis funções predecessoras** previstas; qualquer necessidade extra vira alteração de escopo revisada, não patch silencioso.

Novo guard37 de ledger protege, a partir do primeiro uso37 da conta, UPDATE/DELETE de ledger inteiro da conta e append manual não comprovado; não repara nem altera linhas antigas. Novo guard de conta fixa id/owner/saldo-base/exclusão das contas usadas37. Pode preservar rename/ativo pelas regras existentes; não permitir nova operação em conta inativa. Pin privado37 registra identidade/base e operationId de primeira utilização, não saldo efetivo.

Para não bloquear writers originais após esse pin, ponte37 BEFORE INSERT (`a1_caixa37_ponte`, após `a0_multa36_ponte` e antes dos guards consumidores) captura testemunha privada exata antes do consumo. Guard final `z_caixa37_ledger` consome sua cópia one-shot. Para nova37 usa capacidade própria; para writer anterior exige testemunha específica do trilho, não `current_user=service_role`, source, GUC ou stack. Reutilizar como referência os checks de `multa36_ponte`: capacidades exatas35/31/36 + operação própria pendente íntegra; capacidade25 do próprio xid/pid/xmin + despesa/origem/estado e row posterior exato;34 capacidade ledger + witness35 + operação34 única pendente;21/22 reconstrução exata do INSERT original (incluindo `createdAt=transaction_timestamp()`, defaults/nulls/descrição) + operação única pendente/hash/vínculos. Não exigir operation20 pendente que a implementação antiga não grava antes do INSERT. Snapshot copiado só autoriza essa perna daquele writer; não concede CRUD37 nem concede trilho anterior sobre cohort novo.

Toda ampliação fica no SQL37 futuro com preflight de hashes conhecidos, owner, ACL/config/defaults/overloads/rowtypes/triggers/RLS e postflight do delta **exato**. Verificar todos os manifestos antigos antes de DDL; somente após prova de delta permitido, reseal de metadata34/35/36 necessário na instalação, na mesma transação. Funções de metadata/verificar antigas não são reescritas; novos triggers usam namespace37 e metadata37 sela todas as funções alteradas, incluindo ciclo/legados/multimodal, ponte36 e validador34. Runtime jamais aprende drift/recalcula manifestos. Provas/origens/auditorias financeiras anteriores não são reseal; alteração dos selos exclusivamente metadata de instalação é distinta de alteração de dinheiro/histórico.

## 9. Integração de UI e erros

Novos componentes Aporte/Transferência consomem os nomes/types acima sem depender do SQL pronto. Entrada rápida `+` futura chama aportar37; transferência exige origem/destino/preview. Não liberar `registrarTransacao` genérico nem converter retirada rápida `−` em operação37. Saldo inicial de NovaConta permanece outro fluxo; nenhuma migração automática de criação de conta para aporte.

Integração local da página: o seletor `caixa.contasParaOperacao37` reutiliza metadados ativos próprios, retorno `{empresaId,contas:[{id,nome,tipo}]}`, sem leitura de ledger ou saldo. A página valida JSON/schema/owner/IDs ordenados e mantém os controles de recovery acessíveis com `contas=[]` se essa consulta falhar. Saldo, extrato e conferência antigos não autorizam a operação37. Esses três leitores recebem um `leituraId` UUID opcional, somente para segmentar o cache por geração da tela; o servidor ignora esse nonce e mantém `ctx.user.id` como única autoridade de ownership. Ele não integra Request37 nem é prova financeira.

Troca de sessão remonta formulários/seleção com uma geração nova e revoga callbacks antigos, inclusive A→B→A. O cadastro preexistente de NovaConta não depende de falha de saldo/extrato; continua fluxo separado deste contrato financeiro. O writer genérico `registrarTransacao` deixa de executar qualquer categoria, e a página não conserva envio avulso/retirada rápida como fallback. Aporte e transferência só seguem as cinco procedures37 descritas acima.

Preview mostra ambas contas, valor exato, data BRT, saldos antes/depois e total invariável na transferência. Não usa extrato filtrado para saldo. Após envio, request/UUID ficam não editáveis; só Confirmar/Conferir intenção, nunca fechar como sucesso. Após confirmed/replay invalidar contas, todas as variações de extrato, cotação37, conferência e consultas financeiras agregadas pertinentes; **sem incremento otimista de saldo**. Saldo do resultado é histórico; refetch autoritativo atualiza tela. Leituras antigas numéricas não são fonte da cotação37 e eventual falha não autoriza zero.

| Código SQL | Adapter/UI |
|---|---|
|22023 e casts inválidos|BAD_REQUEST; input inválido; se já enviado preservar intenção até evidence|
|42501|NOT_FOUND; conta/vínculo indisponível para esta empresa, sem vazar owner alheio|
|23505|CONFLICT; UUID/request divergente, não gerar chave nova automaticamente|
|23514|PRECONDITION_FAILED; livro/prova não comprovados; sem saneamento/fallback|
|40001/40P01|CONFLICT; contenção/cotação/virada; preservar UUID e conferir execução|
|55000|PRECONDITION_FAILED; drift ou UUID fenced; distinguir detalhe privado controlado sem confiar no texto como evidence|
|PGRST202/42883/42P01|PRECONDITION_FAILED; lote indisponível, nenhum writer alternativo|
|transporte/envelope inválido/inesperado|INTERNAL_SERVER_ERROR; resultado ambíguo; recovery com request original|

**Critério de aceite:** uma perna por aporte, duas por transferência, base intocada, saldo físico contado uma vez, UUID durável/recovery sob corrida, ownership completo, writers anteriores preservados e zero reparo histórico. A matriz priorizada e a lista restrita de expansão SQL estão em `PLAN.md`.
