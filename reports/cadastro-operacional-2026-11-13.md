# CobraPro — cadastro operacional e isolamento entre empresas

**Data:** 13/11/2026, horário de Brasília. **Base anterior live:** `191f55a`.

## Objetivo e fronteira

Retirar impedimentos indevidos do cadastro normal de clientes e empréstimos sem desativar autenticação, vínculo de empresa, consistência financeira ou idempotência. A Blacklist continua sendo a única funcionalidade compartilhada; seus arquivos, concessões e fotos não foram alterados. Kiwify, ofertas, WhatsApp/Evolution, QR, workflows, flags, schema e migrations ficam fora deste lote. Nenhum dado produtivo foi corrigido ou gravado por esta publicação.

## Correções implementadas

1. **Clientes:** erro ou carregamento da LISTAGEM não desabilita Novo Cliente nem importação, e um erro de refetch não fecha o formulário preenchido. A gravação continua dependendo da confirmação da própria mutation e de input válido. Importação ganhou exclusão mútua síncrona para impedir processos simultâneos; parser e anexos não foram reescritos. Exportação de lista indisponível continua contida.
2. **Empréstimos:** o seletor de contas usa somente metadados de contas próprias e ativas, paginados e conferidos; não chama o agregador de saldos. Assim, indisponibilidade do saldo global não impede escolher uma conta para novo cadastro. A RPC verifica a conta escolhida e o cliente da sessão antes de gravar: isto não autoriza operar sobre conta alheia ou financeiramente inconsistente.
3. **Disponibilidade:** consulta reativa após autenticação, com retentativa manual, substitui a Promise única que podia deixar o botão desabilitado até desmontar a tela. Cache de contas/clientes de outra sessão não preenche os seletores.
4. **Inicialização Supabase:** chamadas concorrentes aguardam a mesma Promise; não retornam indisponibilidade após apenas 100 ms. Erro de inicialização libera nova tentativa, sem cliente fictício ou fallback financeiro.
5. **Listagem e ficha:** falha de banco não retorna base vazia ou contrato inexistente. Cliente é consultado separadamente com owner da sessão, sem embed capaz de revelar cliente de outra empresa. Integridade das parcelas é conferida por metadados antes de ler valores com filtro de tenant. Paginação exige contagem consistente e ausência de duplicações. Erro na interface mostra retry e não apresenta cache como atual, mantendo Novo acessível.
6. **Navegação:** Pagar, recebimento/renovação e detalhes dos cards encaminham à ficha com o seletor de origem validado. Cards não montam mais os antigos modais de pagamento/edição. Depois de criação confirmada, consultas são invalidadas e a ficha do ID confirmado é aberta; falha de refetch não repete a mutation ou desfaz confirmação.

## Limites honestos

O trilho de criação atômica instalado suporta empréstimo **mensal simples, taxa mensal e 1 a 60 parcelas**, com desembolso único, centavos exatos e datas civis. Outras modalidades não foram habilitadas nem convertidas silenciosamente. Recebimento e renovação seguem as capacidades específicas da origem do contrato. Retirar um bloqueio artificial de cadastro não significa retirar validação de titularidade, confirmar saldo histórico inconsistente, liberar exclusões/edições financeiras inseguras ou criar uma exceção geral de empresa.

O saneamento das inconsistências históricas continua exigindo revisão humana por registro. Este lote não altera owners, clientes, parcelas, contas ou lançamentos financeiros. A evidência produtiva anterior de 12 lançamentos divergentes em 2 contas e 6 parcelas com owner/cliente nulo será reconferida em leitura após o rollout; não é atribuída à UltraCredi por suposição.

## Certificação e publicação

Certificação final concluída às 22h51: **2.439 testes aprovados, 11 opt-in ignorados; 141 arquivos aprovados e 3 ignorados. TypeScript, build e diff check aprovados.** Testes de clientes: 51 casos; primeiro alvo combinado: 106 testes; nova lista/navegação: 26 casos antes da extensão à ficha. Os testes não gravam dados reais e não enviam mensagens a clientes.

Leitura agregada do Supabase autorizado às 22h50 confirmou 12 lançamentos de owner divergente em 2 contas, 6 parcelas com owner/cliente nulo, RLS em 56/56 tabelas públicas e 0 acesso CRUD direto de anon/authenticated. Nenhum registro foi alterado. Workflow WhatsApp mais recente, às 22h46min40, terminou com success; isso confirma execução da automação, não entrega de toda mensagem a cada destinatário.

Checkpoint, push e rollout deste lote ainda não foram concluídos no momento deste registro; a produção anterior permanece `191f55a`.

A conclusão da publicação, hash live, smoke e resultado final dos testes serão registrados no status operacional externo depois de comprovados. Um arquivo local, um checkpoint ou um push não substitui confirmação do deployment em produção. Não foram enviados lembretes, cobranças, e-mails ou mensagens de teste a clientes.
