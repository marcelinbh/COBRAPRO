# Auditoria pós-deploy — CobraPro

- **Data de início:** 2026-10-28 (America/Sao_Paulo)
- **Ambiente:** produção — `https://cobrapro.online`
- **Commit validado:** `abe91a9889980ef58a2cfd54f68e4bcb12cd611c`
- **Conta autorizada:** `koletor3`
- **Identificador único:** `AUDITORIA-TESTE-20261028-1032`
- **Autorização:** usuário autorizou criar e movimentar dados de teste de baixo valor, com estorno/limpeza do que for reversível. Não enviar WhatsApp real, não alterar credenciais, não modificar dados de terceiros.

## Condições iniciais confirmadas

- CobraPro: HTTP 200
- API de saúde: HTTP 200
- Evolution API: HTTP 200
- App Platform DigitalOcean: deployment do commit `abe91a9` em produção, confirmado como ativo.

## Bloqueio financeiro encontrado antes das mutações de teste

Às 10:33 BRT, a ação **Conferir caixa** (somente leitura) retornou **1 conta, 2 movimentos, 6 divergências e 6 críticas**. As divergências são parcelas baixadas sem entrada correspondente no livro-caixa: `#146` (R$ 600,00), `#147` (R$ 600,00), `#148` (R$ 216,67), `#152` (R$ 133,33), `#205` (R$ 100,00) e `#246` (R$ 25,00). O valor total não conciliado é **R$ 1.675,00**. Esta condição é anterior a qualquer criação ou pagamento desta auditoria.

**Decisão operacional:** testes que criem movimentos financeiros, baixas, renovações, pagamentos, despesas, cheques, vendas ou assinaturas permanecem suspensos até a coleta completa da evidência e a investigação da origem. Os testes não financeiros, de leitura e de navegação podem continuar sem alterar os dados operacionais.

## Reparcelamento: confirmação visual ambígua e bloqueio reforçado

Às 10:40 BRT, a consulta somente leitura do contrato operacional `#379` em `/reparcelamento` exibiu uma simulação e o botão **"Confirmar Reparcelamento" habilitado**. A ação **não foi clicada**, pois se refere a um contrato operacional existente e não a um dado de auditoria. A revisão do código confirmou que o segundo clique mostrado na interface apenas exibia uma mensagem de suspensão, mas a cópia da tela era enganosa e o endpoint de execução ainda continha o fluxo REST inseguro atrás de uma variável de ambiente.

**Correção publicada e verificada:** removido o código de execução REST, o endpoint agora devolve incondicionalmente `PRECONDITION_FAILED` e a interface passou a mostrar a simulação como somente leitura, com o botão desativado. O deploy do commit `abe91a9` entrou em produção às 16:16:19 BRT. Às 16:19 BRT, a mesma consulta do contrato `#379` exibiu a cópia de suspensão e o botão desativado, sem possibilidade de confirmar a operação.

## Auditoria estática dos fluxos financeiros e contenção P0

Uma revisão paralela dos recebimentos de parcelas e renovações, despesas, cheques, vendas de telefone e assinaturas confirmou o mesmo defeito estrutural em todos os módulos: a entidade de negócio é alterada e o movimento de Caixa é inserido em chamadas REST independentes. Os rollbacks existentes são compensações de melhor esforço, não transações; em erros de rede, timeout ou falha da compensação, podem deixar baixa sem movimento, movimento órfão ou duplicidade. O risco é compatível com as seis divergências preexistentes de parcelas, mas a revisão não atribui causalidade individual sem uma reconciliação aprovada.

**Contenção implementada no código, aguardando deploy:** operações capazes de criar, baixar, renovar, estornar, compensar, devolver, cancelar ou excluir registros financeiros agora retornam `PRECONDITION_FAILED` antes de acessar o banco: recebimentos e renovações de parcelas, quitação manual, pagamentos e estornos de despesas, transições de cheque, vendas de telefone e recebimentos de assinatura. Consultas, conferência de Caixa, cadastros sem movimento e simulação continuam acessíveis. A reabertura deverá ocorrer somente após RPC PostgreSQL atômica, vínculo estrutural do evento ao movimento de Caixa e testes de falha e concorrência.

## Escopo de execução

1. Acesso, navegação e leitura de dashboard.
2. Caixa: conta dedicada e conferência somente leitura.
3. Cliente e empréstimo: criação, liberação, parcela parcial, quitação e renovação de juros.
4. Despesa: criação, baixa, tentativa repetida e estorno.
5. Cheque: criação, compensação e cancelamento/devolução em registros separados.
6. Venda de telefone: entrada, parcela, PDF e exclusão sem movimento.
7. Assinatura: criação, pagamento correto, duplicidade, status e cancelamento lógico.
8. Blacklist, portal, relatórios e configurações não destrutivas.
9. WhatsApp: apenas status e telas; sem envio de mensagem real.

## Regras de segurança durante os testes

- Toda criação deve conter o identificador único acima.
- Valores de testes devem ser mínimos e separados de dados operacionais.
- Após qualquer mutação financeira: validar status, lançamento no Caixa e usar **Conferir caixa** em modo leitura.
- Não testar estorno de parcela, pois não há operação de reversão rastreável disponível no produto.
- Não executar reparcelamento; a confirmação deve permanecer bloqueada por segurança.
- Isolamento entre empresas será verificado apenas por não exposição na sessão `koletor3`; não serão acessadas contas de terceiros.

## Registro de evidências

| Horário BRT | Módulo | Ação | Resultado | IDs / observações |
|---|---|---|---|---|
| 10:32 | Acesso | Confirmar sessão koletor3 | Aprovado | Sessão autenticada como administrador da conta autorizada |
| 10:33 | Caixa | Conferência inicial somente leitura | Reprovado: 6 críticas preexistentes | Parcelas baixadas sem entrada no livro-caixa; nenhuma mutação de auditoria feita |
| 10:36–10:39 | Clientes | Criar, editar, recarregar e excluir cliente sintético | Aprovado | Registro `AUDITORIA-TESTE-20261028-1032` removido após validação; sem efeito financeiro |
| 10:40 | Reparcelamento | Consultar contrato #379 sem confirmar | Falha de UX/risco identificado | Nenhuma mutação executada; botão induzia a uma confirmação apesar de a tela não concluir a ação |
| 16:16–16:19 | Deploy/Reparcelamento | Publicar `abe91a9` e revalidar contrato #379 sem confirmar | Aprovado | App Platform saudável; servidor bloqueia a execução e interface mostra simulação somente leitura com botão desativado |
| 16:20–16:25 | Auditoria financeira estática | Revisar parcelas, renovação, despesas, cheques, telefone e assinaturas | Reprovado: risco crítico | Escritas REST multi-etapa e compensações não atômicas; contenção P0 preparada e testada com 28 regressões |
| Pendente | Financeiro | Criar e testar contrato de auditoria | Pendente | |
| Pendente | Despesas | Baixar e estornar despesa de teste | Pendente | |
| Pendente | Cheques | Testar transições e conciliação | Pendente | |
| Pendente | Vendas | Testar contrato e parcelas | Pendente | |
| Pendente | Assinaturas | Testar pagamento e idempotência | Pendente | |
| Pendente | Portal/Blacklist/Relatórios | Validar privacidade e reconciliação | Pendente | |
| Pendente | WhatsApp | Inspeção sem envio | Pendente | |
