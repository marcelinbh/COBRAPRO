# Liberação prospectiva multimodal — CobraPro

**Data da certificação:** 16/11/2026, horário de Brasília. **Baseline produtivo conferido:** `68f5d5c`.

Este documento registra o escopo e a certificação do lote antes da publicação. A revisão efetivamente live, o resultado da instalação e o smoke de produção serão registrados no status operacional externo de 16/11/2026; edição local, teste ou checkpoint não provam deployment.

## Funcionalidades certificadas

O novo ciclo permite criar empréstimos mensais, semanais, quinzenais, diários e Tabela Price, com 1 a 60 parcelas. Mensal/semanal/quinzenal seguem juros simples por período; diário informa taxa única sobre o principal; Price calcula amortização sobre saldo. Valores são conservados em centavos, com ajuste explícito na última parcela e recusa de parcelas sem amortização positiva ou fora da precisão suportada. A interface exibe cronograma e prévia antes da confirmação.

O recebimento integral ou parcial preserva o residual sem somar novamente o principal ou cobrar multa repetida. Renovação sucessiva é permitida para empréstimo de parcela única elegível, com juros positivos, sem amortização/parcial anterior: recebe somente juros e encargos, preserva o principal e gera a sucessora sem novo desembolso. Não converte Price ou contrato multiparcelas em renovação de juros.

A agenda usa DATE civil e períodos explícitos. Mensal/Price recuperam o dia original depois do ajuste em fevereiro. A multa só incide após virar o dia em America/Sao_Paulo. O cadastro via aplicação valida calendário 2000–2100.

## Integridade e coexistência

A migration nova `0035_rpc_ciclo_emprestimos_multimodal.sql` acrescenta origem, operações, auditoria/snapshot, pernas, autorizações e fences privados. Não altera migrations aplicadas, atribui origem antiga, corrige owner, ajusta saldo-base ou exclui lançamentos. RPCs públicas só têm EXECUTE para o backend; helpers/tabelas permanecem privados com RLS e sem concessões diretas a anon/authenticated.

Criação, recebimento e renovação validam cliente, conta, parcelas e vínculos físicos próprios, livro completo da conta selecionada, snapshots e valores realmente gravados. Timeout não autoriza trocar UUID. Recuperação valida simultaneamente a prova autoritativa, a família, a empresa, o payload e o resultado financeiro. Fences são permanentes; corrigir uma intenção exige prova de não execução e gesto explícito.

Novos contratos coexistem com recebimentos mensais anteriores, despesas e recebimentos legados íntegros na mesma conta. A ponte legada exige capacidade privada atual, operação pendente única, owner/vínculos corretos e crédito exato consumido uma única vez; nunca autoriza a RPC legada a escrever um contrato multimodal.

A renovação multimodal preserva os guards antigos: o antecessor usa status físico cancelada com prova própria de transferência; o classificador retorna renovada. Não se considera o status físico isolado como prova, pagamento do principal ou nova parcela aberta.

## Interface e cálculos operacionais

Formulários ocultam caches de outra sessão, recusam handlers/respostas antigos inclusive A→B→A e após desmontagem, e preservam UUID/payload em falha de transporte ou storage. A entrada mantém o ciclo da intenção já existente após recarga ou mudança de capacidade, sem mudar automaticamente para outro trilho e gerar um segundo cadastro. Intenções em dois ciclos são conferidas separadamente sem remoção automática.

Lista e ficha excluem encerradas da próxima parcela; pagamentos parciais e juros efetivamente registrados são incluídos no total pago. Juros da próxima parcela vêm de sua composição física, inclusive Price/diário. Lucro é estimativa conservadora, não saldo certificado nem alocação de principal/juros presumida em pagamento parcial. Caixa certificado continua baseado exclusivamente no ledger íntegro.

## Evidências

- Suíte completa: **147 arquivos aprovados**, 3 opt-in ignorados; **2.754 testes aprovados**, 11 ignorados.
- `pnpm check`, `pnpm build` e `git diff --check`: aprovados.
- PG17 isolado: fórmulas independentes, centavos, calendário/BRT, integral/parcial, renovações sucessivas, concorrência real, UUID/fence, sabotagem de snapshots/owner/trigger, ACL/RLS, instalação sem mutação de legado e coexistência completa.
- UI multimodal: cobertura de capacidades reais, calendário, ciclo anterior, timeout/reload/storage, troca de empresa, resposta atrasada e parcelas encerradas.
- SHA-256 da migration certificada: `fc57048f3b04a1b931d8cd5663dce6a503a92c08da86a0a35567e95e0a4f6f7d`.
- Preflight produtivo read-only: PG17, owner instalador correto, zero divergências nas assinaturas/corpos/rowtypes requeridos e ausência da família nova antes da instalação.
- Contagens anteriores à instalação: 12 movimentos com ownership divergente em 2 contas, 6 parcelas com owner/cliente nulo; RLS 56/56 e zero tabelas com CRUD direto anon/authenticated. Essas inconsistências não foram saneadas.

## Restrições preservadas

Não há autorização para misturar empresas ou retirar validação de integridade. Clientes e cadastros normais não dependem da certificação global de saldo; operações monetárias validam a conta/contrato escolhido. Registros antigos divergentes continuam sujeitos à revisão humana por registro, não a ajuste automático.

Vendas, cheques e reparcelamentos não são convertidos em empréstimos por atalhos. Modalidades, recebimentos ou alterações financeiras sem ciclo comprovado não são liberados por simples retirada de um guard.

Blacklist permanece a única função compartilhada segundo as concessões existentes. Kiwify/ofertas, QR/Evolution, agenda e workflow WhatsApp, revogação de sessões e demais flags ficam fora do lote. A última execução WhatsApp conferida nesta retomada estava concluída com sucesso; isso não certifica a entrega de cada mensagem aos destinatários.

## Complemento de compatibilidade da instalação

A primeira tentativa foi recusada antes de DDL por um trigger de senha legítimo não previsto no inventário inicial. A leitura por metadados confirmou zero tabelas multimodais novas; o corpo da função é exatamente o gerado da fonte versionada 0016 para `passwordHash`. Não houve alteração de senha, versão de sessão, flag ou registro financeiro produtivo.

O inventário agora aceita somente essa proteção comprovada por source/assinatura/owner/configuração e binding completo, sem tolerância a nomes falsos, overload, condição, coluna ou desativação. Sua superfície entra apenas no manifesto novo, sem recalcular o antigo nem congelar valores de senha/perfil. O fixture reproduz a função da fonte local e comprova preservação, funcionamento e recusas adversariais.

Após esse complemento, a certificação completa voltou a aprovar **2.754 testes e 11 opt-in ignorados, TypeScript/build/diff check**. O mesmo gate de instalação executado em modo read-only na produção autorizada também aprovou todos os requisitos, com zero objetos multimodais preexistentes. O SQL final certificado tem SHA-256 `6e5c11587d571e64a51585488c2fad7075f4d5dfeb9202a3a5dced795a9c0b03`. Instalação, push e rollout serão comprovados no fechamento operacional externo, não por este registro pré-publicação.

## Instalação e smoke produtivo — 16/11, 18h20–18h34 BRT

A estrutura prospectiva foi instalada com sucesso às 18h20 no projeto autorizado. A conferência read-only aprovou capacidades das cinco modalidades, recebimento/renovação, 65/65 tabelas com RLS, zero acesso direto, zero grants divergentes e zero helpers privados acessíveis. As contagens antigas 12/2/6 permanecem iguais. A revisão `533e131` entrou live/Healthy às 18h25min48 e o bundle exato chegou às 18h25. Sem sessão, o endpoint novo recusa com 401. Não houve criação de empréstimos pelo smoke: a conferência das 18h33 manteve zero origens multimodais.

O smoke negativo revelou que a versão instalada do SDK retorna um campo de envelope `success`; o adaptador anterior recusava essa chave adicional antes de classificar a resposta. A compatibilidade agora aceita apenas booleano coerente com `error`. A flag não substitui validação monetária nem prova durável: criação, cotações, recebimento, renovação e recuperação continuam com seus parsers completos. Testes exercitam o SDK realmente instalado com fetch sintético, incluindo erros SQL, respostas contraditórias e reconciliação, sem rede/banco reais.

O formulário também revelou remontagem circular: um filho iniciava refetch de sessão, o pai removia o filho enquanto conferia identidade, e sua remontagem começava outra leitura. Os filhos financeiros agora usam `refetchOnMount:false`; o pai continua revalidando a sessão, e erro/carregamento/refetch real continuam impedindo operações no ciclo novo. Testes com QueryClient/QueryObserver reais comprovam ausência de leitura extra por montagem e a troca de identidade após invalidação explícita, além do harness de UI/tenant existente.

Certificação do complemento concluída às 18h34: **2.759 testes aprovados, 11 opt-in ignorados, TypeScript/build/diff check aprovados**, incluindo 170 regressões direcionadas. Não há DDL novo, correção financeira automática, novo UUID por timeout ou mudanças em WhatsApp/Kiwify/ofertas/flags. O rollout desse complemento e seu aceite visual serão registrados no status externo após confirmação real.

## Aceite final comprovado — 16/11/2026, 18h42 BRT

O complemento funcional `46238e273ee00730e09a2dc5c2042b246f7296a5` entrou live/Healthy na DigitalOcean às **18h41min26**. O bundle certificado `/assets/index-DDiKR3vm.js` e health 200 foram observados às 18h40min47. O cadastro real terminou o carregamento às 18h42 e apresentou as cinco modalidades e seletores próprios sem consultar saldo ou salvar formulário. O endpoint autenticado de cotação de IDs inexistentes passou a recusar com **NOT_FOUND**, sem detalhes SQL ou valores alheios; a ficha inexistente retorna null. Nenhuma operação de criação/recebimento/renovação foi executada pelo smoke.

A conferência agregada pós-rollout manteve capacidades das cinco modalidades/recebimento/renovação, RLS65/65/0, zero helpers privados ou grants RPC divergentes e contagens antigas 12/2/6. Zero origens multimodais novas: nenhum saneamento nem gravação financeira ocorreu durante estas verificações. A raiz Evolution real respondeu 200; conexão/QR, agenda, flags, Kiwify/oferta e Blacklist não foram alterados.

**Pendência WhatsApp distinta da liberação de cadastro:** o workflow está ativo em main, cron nominal `*/5`, mas os schedules recentes disponíveis são 01h08, 07h55 e 17h39 UTC. O último terminou success às 17h40 UTC (14h40 BRT); às 21h37 UTC a defasagem já era de aproximadamente quatro horas. Isso não comprova frequência adequada nem entrega aos destinatários. Causa raiz não determinada por metadados; atraso/throttling são hipóteses, não conclusões. Nenhum dispatch, mudança de agenda ou mensagem foi realizado.

A liberação é dos fluxos prospectivos comprovados para clientes/contas próprios e válidos. Não representa declaração de plataforma sem bugs, saneamento dos lançamentos antigos, eliminação das barreiras contra mistura de empresas nem certificação irrestrita dos disparos automáticos. O fechamento operacional externo registra a revisão live vigente; um eventual commit documental posterior não muda o código certificado.
