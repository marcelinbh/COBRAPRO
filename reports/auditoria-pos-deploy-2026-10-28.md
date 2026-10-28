# Auditoria pós-deploy — CobraPro

- **Data de início:** 2026-10-28 (America/Sao_Paulo)
- **Ambiente:** produção — `https://cobrapro.online`
- **Commit validado:** `633757d1d2d4d18228d42e950c1e22a3b9a80068`
- **Conta autorizada:** `koletor3`
- **Identificador único:** `AUDITORIA-TESTE-20261028-1032`
- **Autorização:** usuário autorizou criar e movimentar dados de teste de baixo valor, com estorno/limpeza do que for reversível. Não enviar WhatsApp real, não alterar credenciais, não modificar dados de terceiros.

## Condições iniciais confirmadas

- CobraPro: HTTP 200
- API de saúde: HTTP 200
- Evolution API: HTTP 200
- App Platform DigitalOcean: deployment do commit `633757d` em produção, confirmado como ativo.

## Bloqueio financeiro encontrado antes das mutações de teste

Às 10:33 BRT, a ação **Conferir caixa** (somente leitura) retornou **1 conta, 2 movimentos, 6 divergências e 6 críticas**. As divergências são parcelas baixadas sem entrada correspondente no livro-caixa: `#146` (R$ 600,00), `#147` (R$ 600,00), `#148` (R$ 216,67), `#152` (R$ 133,33), `#205` (R$ 100,00) e `#246` (R$ 25,00). O valor total não conciliado é **R$ 1.675,00**. Esta condição é anterior a qualquer criação ou pagamento desta auditoria.

**Decisão operacional:** testes que criem movimentos financeiros, baixas, renovações, pagamentos, despesas, cheques, vendas ou assinaturas permanecem suspensos até a coleta completa da evidência e a investigação da origem. Os testes não financeiros, de leitura e de navegação podem continuar sem alterar os dados operacionais.

## Reparcelamento: confirmação visual ambígua e bloqueio reforçado

Às 10:40 BRT, a consulta somente leitura do contrato operacional `#379` em `/reparcelamento` exibiu uma simulação e o botão **"Confirmar Reparcelamento" habilitado**. A ação **não foi clicada**, pois se refere a um contrato operacional existente e não a um dado de auditoria. A revisão do código confirmou que o segundo clique mostrado na interface apenas exibia uma mensagem de suspensão, mas a cópia da tela era enganosa e o endpoint de execução ainda continha o fluxo REST inseguro atrás de uma variável de ambiente.

**Correção preparada:** removido o código de execução REST, o endpoint agora devolve incondicionalmente `PRECONDITION_FAILED` e a interface passou a mostrar a simulação como somente leitura, com o botão desativado. A correção foi coberta por regressão; aguarda publicação/deploy e nova checagem visual.

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
| 10:40 | Reparcelamento | Consultar contrato #379 sem confirmar | Correção preparada | Simulação correta; ação não executada. Endpoint REST inseguro removido e UI alterada, pendente de deploy |
| Pendente | Financeiro | Criar e testar contrato de auditoria | Pendente | |
| Pendente | Despesas | Baixar e estornar despesa de teste | Pendente | |
| Pendente | Cheques | Testar transições e conciliação | Pendente | |
| Pendente | Vendas | Testar contrato e parcelas | Pendente | |
| Pendente | Assinaturas | Testar pagamento e idempotência | Pendente | |
| Pendente | Portal/Blacklist/Relatórios | Validar privacidade e reconciliação | Pendente | |
| Pendente | WhatsApp | Inspeção sem envio | Pendente | |
