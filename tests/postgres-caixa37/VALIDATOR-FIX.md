# Caixa37 — correção estática de `caixa37_validar_op`

## Escopo e status

Correção local do bloco `CREATE FUNCTION public.caixa37_validar_op(oid37 uuid)` em `tests/postgres-caixa37/template.sql`. Nenhum helper adicional foi criado. A assinatura, `SECURITY DEFINER`, `search_path` e `TimeZone` foram preservados. O conteúdo do template fora desse bloco foi comparado byte a byte com a leitura inicial desta frente e permanece igual.

**Não certificado e não executado em PostgreSQL.** Nesta frente não foram executados `certification-runtime.mjs`, build37, builders antigos, instalação, runner, Vitest, simulações de corrupção ou qualquer SQL. Não houve acesso Supabase/browser/rede/Git/prod. O SQL gerado `drizzle/0037_rpc_aporte_transferencia_caixa.sql` não foi regenerado: esse passo e os testes cabem ao responsável, após a atualização independente da baseline36.

## Causa dos achados preservados

`runtime-PROGRESS.md` e `runtime-findings-baseline79dd.json` registram a aceitação de cinco alterações na baseline SQL37 `79dd86215045d967392b19f6ad0495cecdf4d84ca89d05d56f8389d81955cec2`: saldos de resultado coerentes entre si, mas deslocados em +100; `saldoDestinoAntes` ausente; esse campo JSON null; `saldoTotalOwnerAntes` ausente; e `pin.primeira_op` trocado por uma segunda operação válida.

O validador anterior conferia principalmente equações internas, não a origem física dos saldos. Comparações com `<>` admitiam resultado SQL NULL quando uma propriedade faltava ou era JSON null. O pin conferia conta/owner/base, mas não a primeira utilização real.

## Correção aplicada

### 1. JSON estrito antes de casts

O validador declara schemas internos de chaves/tipos para auditoria, resultado, cotação, `ContaSaldo37`, pernas do resultado e rowtypes dos snapshots. Exige objeto, rejeita chaves extras e verifica cada chave obrigatória com tipo explícito. O teste de pertença ao conjunto de tipos usa `IS DISTINCT FROM true`: ausência SQL NULL não passa como JSON null.

Resultado tem as 18 chaves emitidas; cotação, as 15; auditoria, as 11; snapshot, somente `contas` e `ledger`; `ContaSaldo37`, as seis; perna de resultado, as cinco. `request` continua passando pelo helper original de sete chaves, sem mudança desse helper ou do contrato público.

Os rowtypes físicos previstos pela baseline são conta com oito chaves e transação com onze. IDs JSON numéricos têm gramática de inteiro positivo e faixa física de `integer` antes do cast. Bases/valores JSON numéricos são finitos, com até centavos e faixa de `numeric(15,2)`; ledger exige valor positivo e direção válida. Datas/timestamps são conferidos por ida e volta ao JSON SQL sob UTC, além de finitude. IDs duplicados, ordem incorreta e ledger apontando conta ausente/alheia no snapshot são recusados.

Decimais de resposta seguem a gramática assinada de `shared/caixa37.ts`: duas casas, sem expoente, zeros iniciais ou `-0.00`, sem impor o limite de dígitos da operação aos agregados. A comparação final contra objetos reconstruídos também exige bases corretas, entradas/saídas não negativas, IDs, nomes e todas as demais propriedades exatas. Aporte exige null explícito em origem e seus saldos; transferência exige origem e saldos presentes. Valores inválidos nos casts de provas são convertidos em recusa `23514` para os erros de formato/faixa cobertos no bloco de exceção.

### 2. Saldos históricos com fonte física congelada

Não se chama `caixa37_saldo`, `caixa37_snapshot`, `caixa37_cotacao`, `caixa37_provas` ou `caixa37_validar_livro` para obter saldo histórico. O cálculo usa exclusivamente `auditoria.antes.contas[*].saldo` e o ledger inteiro de `auditoria.antes`, com `NUMERIC` sem typmod nas somas.

Origem/destino são reconstruídos no mesmo formato de `caixa37_saldo`: ID/nome congelados, saldo-base, entradas, saídas e saldo efetivo. O total do owner inclui todas as contas congeladas, inclusive inativas, mais o ledger congelado uma única vez. O delta após é calculado das pernas comprovadas e comparadas às transações físicas; exige destino `+valor`, origem `-valor` na transferência e total `+valor` no aporte ou zero na transferência.

A função reconstrói a cotação inteira e o resultado inteiro, inclusive identidades, regras, descrição/data/request, ordem e conteúdo das pernas, saldos antes/depois e totais. Ambos são comparados com `IS DISTINCT FROM`. Equações monetárias explícitas também usam `IS DISTINCT FROM`. Assim, a consistência interna de saldos +100 não basta: a fonte `audit.antes` precisa produzir precisamente aqueles valores.

### 3. `estadoHash` e provas armazenadas pré-operação

A emissão foi examinada: `caixa37_cotacao` inclui `provas37` no hash, porém `caixa37_mutar` não armazena esse objeto separadamente na auditoria. O audit guarda `antes`/`depois`, cotação/hash, resultado e um `predecessoresHash` de outro conjunto (módulos anteriores). Não é correto tratar `predecessoresHash` como snapshot de provas37 nem comparar com o conjunto atual inteiro depois de novos appends.

O novo validador reconstrói as provas37 pré-operação por pertencimento ao ledger congelado: seleciona operações cujas pernas estão em `antes.ledger`, exige operações concluídas do mesmo owner, hashes/vínculos consistentes, quantidade exata e presença integral das pernas desse conjunto. Rejeita inclusão da própria operação em `antes`.

A nova operação ainda não existe quando `caixa37_mutar` gera a cotação: seu INSERT ocorre depois da cotação e do snapshot `antes`. `caixa37_provas` inclui operações somente com `resultado IS NOT NULL`; a reconstrução também recusa predecessor sem resultado/auditoria/conclusão. Pernas/pins de operação pendente não são um estado pré-op legítimo de outra execução37 serializada pelos mesmos locks do owner/contas. Não se inclui a operação em validação, nem seus pins novos, no hash histórico.

Reproduz o objeto de `caixa37_provas` com os rowtypes armazenados: operações ordenadas por UUID **somente para reproduzir a serialização do hash emitido**, pernas por operação/papel e pins por conta, incluindo apenas pins cuja primeira utilização já pertence às operações anteriores. Recria o payload de `caixa37_cotacao` com regra, owner, intenção, dia BRT, contas/ledger congelados e esse conjunto. Exige igualdade do hash calculado com `cotacao.estadoHash` e request, além de `cotacaoHash` e `hash_auditoria` originais consistentes.

Não existe chamada recursiva a `caixa37_validar_op` nas provas. O conjunto usa dados imutáveis armazenados e é filtrado pelo snapshot, não por corte de UUID, horário ou saldo atual.

### 4. Proveniência causal de `primeira_op`

O pin precisa conservar conta/owner/base tanto frente à conta física atual quanto frente ao snapshot desta operação e ao snapshot da primeira operação. A operação apontada deve existir, estar concluída, pertencer ao owner, ter request/hash/audit/result vinculados, quantidade prevista de pernas e incluir a conta. Sua perna deve existir fisicamente e coincidir com snapshot/hash.

A ordem usada é **causal, serializada pelos locks já existentes do owner/contas**:

1. O ledger `antes` da primeira utilização não pode conter nenhuma perna37 daquela conta, identificada por IDs físicos e associações privadas armazenadas.
2. Se a operação validada não é a primeira, seu ledger `antes` deve conter a perna exata da primeira utilização da conta.

Uma segunda operação válida contém a primeira perna em `antes`, logo não pode ser promovida a `primeira_op`. Isso também recusa apontar uma utilização futura ou uma operação de outra conta. Não há ordenação lexicográfica de UUID como cronologia; tampouco dependência de monotonicidade do relógio ou de comportamento do cache de sequência. A ordenação de UUIDs empregada nos arrays do hash tem finalidade distinta, estritamente a reprodução do emissor.

### 5. Replay histórico preservado

A atividade exigida é a de origem/destino **no snapshot antes da operação**, não a atividade atual. A conta física atual só é usada para verificar identidade/owner/saldo-base do pin; não para retornar saldo efetivo ou nome histórico. Não se compara `depois` contra o ledger atual inteiro: mantém-se a conferência física das pernas e do prefixo das contas alvo. Novas pernas, operações e pins posteriores ficam fora das provas reconstruídas do hash histórico. Rename/inativação/append legítimos não mudam a fonte histórica de saldos.

## Verificações efetivamente realizadas

Somente leitura e verificações textuais locais:

- Comparação do template com a leitura inicial, substituindo o bloco do validador por um marcador: **todo o conteúdo fora do bloco permanece byte a byte igual**.
- Os nove literais JSON de schema do bloco foram decodificados pelo parser JSON do Python.
- Busca textual confirmou ausência de DML/DDL no corpo e ausência de chamada recursiva ou de helper financeiro de estado atual.
- O extrator local existente `functionsFromSQL` de `server/migrations/0033.preflight.sources.mjs` reconheceu uma função `caixa37_validar_op`, assinatura `uuid`. Esse extrator é textual, **não compila PL/pgSQL**.

Não havia parser PostgreSQL/PLpgSQL estático independente disponível nas bibliotecas locais inspecionadas. Não se instalou dependência nem iniciou banco para suprir isso. Compilação SQL, execução, compatibilidade com os guards e regressão continuam pendentes.

SHA-256 do bloco final do validador, incluindo seu newline antes da função seguinte: `381d5d37b6f94a16e79e58c28b5e6fd512cc6603353817a50e3f03ecf6d3f281`.

SHA-256 do template nesta entrega: `8032e921a41bfd4ff47c52633f25de5746fc8197f9382a57da3053dddf82bc49`.

## Limitações e execução a cargo do responsável

Esta correção não constitui proteção contra um superuser que reescreva simultaneamente a história física inteira, associações, snapshots, requests e todos os hashes. Não há autenticação externa de hashes: a ancoragem continua sendo a imutabilidade das tabelas/guards e o manifesto já existentes. O hash reconstruído exige a mesma história imutável armazenada pelo emissor; não inventa um snapshot de provas37 que nunca foi persistido.

`predecessoresHash` é conferido como chave/string/hash canônico, mas seu conteúdo histórico não é recalculado: o emissor conserva apenas o digest, não o objeto predecessor congelado. A comparação com predecessores na mutação continua intacta. O validador não amplia o gate histórico de vínculos contratuais dos módulos antigos; ele mantém a validação de ledger congelado necessária aos cálculos e os controles existentes.

A reconstrução de provas e as inspeções de arrays têm custo proporcional ao histórico/provas, com alguns cruzamentos por conta. Não foi feito benchmark. A causalidade do pin depende do protocolo já existente de serialização, snapshot completo e append imutável; não introduz novo mecanismo de ordering ou locks. Novos rowtypes físicos fora da baseline devem passar por revisão de escopo, não são tolerados silenciosamente.

O responsável deve regenerar o target37 após seu hotfix36 e executar seus testes. Prioridades: positivos aporte/transferência/agregados grandes, primeira utilização e appends em mesma e outra conta, replay/recovery após dia seguinte/rename/inativação/restart; depois os cinco achados preservados e cotação com saldo físico falsificado. Também conferir commit checks diferidos e convivência dos writers anteriores. Esses são **testes recomendados, não executados nem aprovados por esta frente**.

## Fontes locais consultadas

- `tests/postgres-caixa37/runtime-PROGRESS.md`, especialmente achados S03 e proposta mínima.
- `tests/postgres-caixa37/runtime-findings-baseline79dd.json`, envelopes preservados dos cinco achados em replay/recovery nas duas bases.
- `tests/postgres-caixa37/template.sql`: `caixa37_snapshot`, `caixa37_provas`, `caixa37_saldo`, `caixa37_cotacao`, `caixa37_mutar`, pin/guards/commit check e o validador original.
- `shared/caixa37.ts`: schemas e normalização de request, ContaSaldo37, cotação, pernas e resultado.
- `tests/postgres-caixa37/CONTRACT.md`: saldos/base, hash, serialização, replay e primeira utilização.
- `tests/postgres-legados/fixture.sql`, `tests/postgres-caixa37/fixture.sql`, `drizzle/schema.ts` e `tests/postgres-caixa37/physical-relations.mjs`: referência física; prevalecem rowtypes da baseline PostgreSQL usada pelo template, não eventuais campos do schema aplicativo.
- `tests/postgres-caixa37/build.mjs` e `HANDOFF-SQL.md`: leitura somente para conhecer a emissão/substituições e preservar as seis extensões antigas. Nenhum builder foi executado ou editado.
## Complemento do responsável — 24/11/2026

O texto acima registra a entrega estática daquela frente, não o status final do lote. Na integração, o responsável corrigiu somente a sintaxe do CASE PL/pgSQL com parênteses na comparação antes do THEN, no validador. A tentativa6cc falhou42601 no setup antes de operações; foi preservada como tentativa inválida, não teste financeiro negativo aprovado. Build37 foi regenerado somente depois de36a independente.

SQL final `2acc5c0840e77a1131fa02d04f0b1faf85bbdb0430071b73477a276ded312334`,271244bytes: basePG17 em duas fresh aprovada; runtime56 grupos/zero falhas, todos20 achados antigos recusados23514 e variantes adicionais; convivência38 dedicadas/486 seleções-equivalentes originais sem falha. Gate completo3688PASS/11SKIP/TypeScript/build às01h08BRT; repetição final em andamento. Limites nominais das suites antigas/shadow são preservados em RESULT.md e docs/logcoexistence-FINAL.md. Estes resultados são posteriores e efetivamente executados pelo responsável e pelas frentes runtime/coex; não são retroativamente atribuídos ao agente da entrega estática. Não instalado/push/deploy37 neste complemento.
