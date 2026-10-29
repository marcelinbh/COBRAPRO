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

**Contenção publicada em produção:** o commit `b6a9045` entrou em produção na DigitalOcean às 16:32:05 BRT. Operações capazes de criar, baixar, renovar, estornar, compensar, devolver, cancelar ou excluir registros financeiros agora retornam `PRECONDITION_FAILED` antes de acessar o banco: recebimentos e renovações de parcelas, quitação manual, pagamentos e estornos de despesas, transições de cheque, vendas de telefone e recebimentos de assinatura. Consultas, conferência de Caixa, cadastros sem movimento e simulação continuam acessíveis. A reabertura deverá ocorrer somente após RPC PostgreSQL atômica, vínculo estrutural do evento ao movimento de Caixa e testes de falha e concorrência.

**Pré-auditoria de banco:** a tentativa de executar o inventário somente leitura no SQL Editor do projeto correto retornou erro do editor (`query: Too small: expected string to have >=1 characters`) e nenhuma consulta foi enviada ao banco. O conector MCP ainda está autorizado apenas para outro projeto Supabase; por isso, nenhuma migration foi aplicada. A migration `0015_rpc_recebimento_parcela.sql` ficou preparada, testada estaticamente e pendente de pré-auditoria válida no projeto COBRA PRO. Ela inclui trava de tenant/linha, idempotência com hash, vínculo único do lançamento à operação, calendário civil de Brasília, histórico e auditoria na mesma transação.

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
| 16:32 | Deploy/Financeiro | Publicar contenção P0 `b6a9045` | Aprovado | Deployment da DigitalOcean concluído; nenhuma mutação financeira REST não atômica pode alcançar o banco |
| 16:34–16:37 | Banco/RPC | Tentar pré-auditoria e preparar `0015` | Parcial | SQL Editor não sincronizou consulta; nenhuma DDL executada. RPC versionada e validada localmente, aguardando inventário real |
| 16:38 | Blacklist | Validar tela compartilhada e documento incompleto sintético | Aprovado | Consulta exige CPF/CNPJ completo e informa o erro antes de qualquer busca; a tela declara retorno mascarado |
| 16:39 | Portal público | Abrir rota com token sintético inválido | Aprovado | Resposta uniforme “link indisponível, expirou ou já foi utilizado”, sem dado de cliente ou indicação de existência |
| 16:39 | WhatsApp | Inspecionar saúde e histórico sem disparo | Aprovado com histórico legado | Instância conectada, fila atual sem pendências/falhas e estados de aceite pela Evolution visíveis; histórico anterior contém falhas devidamente identificadas, sem mensagem disparada nesta auditoria |
| 16:45 | Disponibilidade | Verificar site, cabeçalhos e Evolution | Aprovado | Site público respondeu 200 com CSP, HSTS, anti-frame e políticas de permissões; Evolution respondeu 200. A rota `/api/health` é absorvida pelo fallback SPA e não fornece healthcheck JSON dedicado |
| 13:58 | Correções da auditoria | Healthcheck, sessão e backup | Corrigido localmente | Adicionado `GET /api/health` JSON de liveness; sessão agora falha fechada quando `JWT_SECRET` está ausente; exportação CSV neutraliza fórmulas de planilha e o backup remove `select *` de vendas/veículos. TypeScript, build e 11 testes aprovados; 2 testes de banco live ficaram opt-in porque as credenciais locais não são da base CobraPro |
| Pendente | Financeiro | Criar e testar contrato de auditoria | Pendente | |
| Pendente | Despesas | Baixar e estornar despesa de teste | Pendente | |
| Pendente | Cheques | Testar transições e conciliação | Pendente | |
| Pendente | Vendas | Testar contrato e parcelas | Pendente | |
| Pendente | Assinaturas | Testar pagamento e idempotência | Pendente | |
| Pendente | Portal/Blacklist/Relatórios | Validar privacidade e reconciliação | Pendente | |
| Pendente | WhatsApp | Inspeção sem envio | Pendente | |
