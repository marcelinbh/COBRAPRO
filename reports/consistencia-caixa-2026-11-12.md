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

## Estado produtivo revalidado às 15h10 BRT

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

O código está certificado para checkpoint e push normal. A conclusão do rollout e o smoke autenticado da revisão publicada são etapas posteriores à gravação deste relatório; o status final de entrega registra seus resultados externos. Não se deve confundir build local ou flags habilitadas com sucesso de operação financeira real.

O critério de aceite é: contas íntegras mantêm os fluxos transacionais habilitados; contas divergentes não exibem números falsamente certificados nem recebem novas operações inseguras. **Liberação irrestrita de todas as contas não foi aprovada por este relatório.** Nenhum lançamento antigo foi corrigido ou apagado.

## Continuidade de hospedagem

O painel DigitalOcean lido às 15h09 BRT continua mostrando **US$ 36,00 em atraso**, com pagamento antes de **14/11/2026** para evitar suspensão. Nenhum pagamento, compra ou mudança de plano foi iniciado. A regularização é independente do hotfix e necessária para reduzir o risco de indisponibilidade futura.
