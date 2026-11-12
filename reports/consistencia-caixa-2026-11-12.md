# CobraPro — consistência de leitura e liberação condicional

## Escopo de 12/11/2026, a partir das 15h BRT

O usuário autorizou a liberação **desde que os bugs estejam corrigidos**. Isso não autoriza remover barreiras de integridade, atribuir titularidade por inferência, alterar valores antigos ou declarar a plataforma livre de todos os defeitos possíveis. Kiwify, ofertas, concessões de acesso, WhatsApp/QR, configurações de runtime e migrations financeiras permanecem fora deste hotfix.

## Falha corrigida neste lote

A tela de Caixa recusava o livro de uma conta com lançamentos de proprietário divergente, mas o resumo independente do dashboard e os relatórios filtravam os movimentos por usuário antes da conferência. Essa diferença permitia mostrar um saldo aparentemente validado, ignorando os lançamentos de outra titularidade na conta própria.

O saldo-base da conta não é prova de reconciliação. Agora `dashboard.resumoCaixa`, KPIs e gráficos passam pela mesma conferência de titularidade; relatórios, score e prévia diária também conferem o livro das contas próprias antes de aplicar filtros de período ou categoria. Nenhuma consulta de valor de outro proprietário é necessária: o teste de integridade projeta somente ID, usuário e conta, limitado aos IDs de contas previamente autorizadas. Metadados divergentes não são devolvidos ao cliente.

- Conferência inclui contas inativas e registros fora do período/categoria do relatório.
- Leitura ordenada, paginada e com contagem confirmada; páginas truncadas/repetidas não são aceitas como totais completos.
- Valores e saldo-base são somados em centavos exatos, inclusive entre contas, sem arredondar sucesso quando o transporte numérico perderia um centavo.
- REST e Drizzle têm regressões de titularidade, vínculo inverso, owner nulo, completude, vazio legítimo, terceira página e valores inválidos.
- A recusa produz erro explícito/indisponibilidade, não um saldo zero fictício. Carteira, clientes e navegação não equivalem a autorização para movimentar uma conta recusada.

## Validação do código

Certificação final realizada antes do checkpoint: **2.350 testes aprovados**, 11 testes opt-in ignorados; 137 arquivos aprovados, 3 ignorados. TypeScript e build aprovados. `git diff --check` limpo; arquivos privados e segredos conhecidos excluídos do lote.

A revisão independente em PostgreSQL 17 descartável confirmou recusa de criação, baixa, estorno, cotação, recebimento e renovação em conta contaminada, sem novas linhas financeiras. Contas limpas da mesma empresa e de outra empresa continuam funcionando isoladamente. Replay de confirmação histórica não produz nova perna. Onboarding cadastral não é certificado de integridade financeira e não remove essas barreiras.

## Estado produtivo revalidado às 15h10 e 15h20 BRT

Consulta agregada no Supabase autorizado `oxvtmibrgjruldkouhhb`, sem leitura de dados pessoais e sem qualquer escrita:

| Verificação | Resultado |
|---|---:|
| Lançamentos cujo usuário difere do titular da conta | 12 |
| Contas de Caixa atingidas | 2 |
| Parcelas com usuário ou cliente nulo | 6 |
| Tabelas públicas | 56 |
| Tabelas com RLS | 56 |
| Tabelas acessíveis diretamente por anon/authenticated | 0 |

Essas contagens **não saneiam** divergências de valor, residual ou duplicidade já documentadas. A ficha privada de revisão dos 12 vínculos contém campos de decisão e aprovação ainda vazios. Alterações financeiras dependem de comprovação e aprovação por registro; não há ajuste automático neste lote.

## Publicação e aceitação operacional

O hotfix foi commitado, salvo em checkpoint `126fa45b` e enviado ao GitHub por fast-forward. A revisão `126fa45b8e6384d8207163e2508d25857f051c03` foi confirmada **Success / Live Deployment** na DigitalOcean às 15h20 BRT, execução `31a21ea0-0170-4a6b-a304-7c92cf476f4f`, iniciada às 15h14min25. O checkout exato consta nos logs; o frontend publicado corresponde ao build certificado `index-mvy4YHx0.js`. Health CobraPro e raiz Evolution responderam HTTP 200.

O smoke autenticado confirmou `412/PRECONDITION_FAILED` em `caixa.contas`, `dashboard.resumoCaixa`, KPIs, fluxo, tendência e score da conta divergente, sem totais monetários nessas respostas. Caixa apresenta saldo indisponível e retentativa manual; relatórios recusam ledger/fluxo e bloqueiam PDF incompleto. A carteira que tem leitura própria válida pode continuar visível, sem certificar o Caixa. Clientes carregaram normalmente. As quatro capacidades financeiras existentes foram conferidas; cotações com IDs inexistentes foram recusadas, sem mutação. A tentativa com caminho incorreto de capacidade das despesas foi corrigida para `contasPagar.capacidades`; não era falha de aplicação.

**Ajuste visual adicional encontrado no pós-push:** quando o hook conclui sem dados e sem `isError`, parte do dashboard mantinha reticências ou gráfico vazio. Foi corrigido para indisponibilidade explícita, retentativa manual somente leitura e ausência de retry automático nas cinco consultas certificadoras. Dez testes React direcionados aprovados. Certificação completa às 15h29: **2.353 testes aprovados**, 11 opt-in ignorados, 137 arquivos aprovados/3 ignorados; TypeScript, build e diff check aprovados. A revisão `1484e5bf7d51e3e13a66a3ce9bdd51da093206f1`, salva em checkpoint e enviada por fast-forward, entrou **live às 15h35min43 BRT**, execução DO `43398ff0-6a67-447a-bbae-89f9106b8f0f`. Bundle certificado `index-CIBMXBFj.js` confirmado. Às 15h36 a interface autenticada mostrou banner de revisão, retentativa manual, todos os KPIs indisponíveis e mensagens de recusa dos gráficos, sem reticências permanentes ou falso sucesso. Regressões pós-push: 159 aprovadas em quatro arquivos. O registro documental posterior não muda esse código certificado; o status externo final informa o HEAD efetivamente publicado.

WhatsApp foi revalidado conectado às 15h28: três dos cinco avisos anteriores ativos, no vencimento ativo e agenda às 18h50 BRT. A fila consultada tem zero pendente/enviando/falha/ambígua e nenhum último envio; isso não prova entrega real. Workflow existente ativo e sua última execução agendada visível, iniciada às 09h36 BRT, teve sucesso. Nenhuma mensagem, disparo de workflow, QR ou configuração foi alterado neste smoke.

O critério de aceite é: contas íntegras mantêm os fluxos transacionais habilitados; contas divergentes não exibem números falsamente certificados nem recebem novas operações inseguras. **Liberação irrestrita de todas as contas não foi aprovada por este relatório.** Nenhum lançamento antigo foi corrigido ou apagado.

## Continuidade de hospedagem

O painel DigitalOcean relido às 15h35 BRT continua mostrando **US$ 36,00 em atraso**, com pagamento antes de **14/11/2026** para evitar suspensão. Nenhum pagamento, compra ou mudança de plano foi iniciado. A regularização é independente do hotfix e necessária para reduzir o risco de indisponibilidade futura.
