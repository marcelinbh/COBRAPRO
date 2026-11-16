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
