# CobraPro — liberação operacional de 12/11/2026

## Escopo autorizado

Concluir confiabilidade do Caixa, cadastro/edição de clientes, relatórios, calendário de Brasília, recebimentos e renovação seguros, preservando Evolution/QR, lembretes WhatsApp e isolamento multiempresa. **Não alterar Kiwify, ofertas, preços ou permissões de Blacklist neste lote.** Não ajustar automaticamente os dados financeiros antigos.

## Resultados comprovados até 10h02 BRT

A suíte final passou com **2.218 testes aprovados**, 11 opt-in ignorados; 135 arquivos aprovados, 3 ignorados. TypeScript e build passaram. Os testes opt-in não foram executados contra credenciais de outro projeto. Nenhum cenário financeiro foi removido para obter aprovação.

O backup privado certificado foi restaurado em dois clusters independentes, preservando metadados, owners e ACLs. O ensaio final **0031 → 0033 → 0034** comparou todas as linhas da cópia antes/depois de cada migration. Todos os clusters usados foram encerrados. O pacote permanece restrito, fora do Git; não contém bytes de Storage nem toda a infraestrutura gerenciada e ainda não possui retenção offsite.

Foram aprovados 116 ataques de drift aos preflights, instalação simulada com PostgreSQL 17 sem superusuário, bloqueio de CREATE indevido, locks efetivos de relações, espera entre instaladores, snapshot renovado e rollback de alteração injetada. A renovação passou em 20 grupos PostgreSQL com/sem a barreira de recuperação. O legado passou em 40 grupos financeiros mais 40 grupos de prova privada. O worker WhatsApp passou em 40 grupos contra PostgreSQL isolado e provedor simulado.

## Instalação no Supabase correto

As três migrations foram aplicadas em `oxvtmibrgjruldkouhhb`, com respostas MCP `success: true`, entre 09h54 e 09h55 BRT:

| Migration | SHA-256 final |
|---|---|
| 0031 — renovação prospectiva | `f0d0db2cafecd39c7f9ce0296683e66141ee8bbad4243b079b5994244f02db7f` |
| 0033 — reconciliação autoritativa de intenções | `7ec52905fa260dc6d14af5fabcef74a2a1a7f0fa65874e15d3bd8358cadc5827` |
| 0034 — recebimento legado validado e prova privada | `615d0b81fb1a41b5dd205214ebddc7e32f0d75576022df66905bc90396959ad0` |

As tentativas anteriores recusadas foram revertidas: o operador Supabase não pode travar catálogos com modo forte. A instalação agora conserva os locks fortes das relações da aplicação, usa uma reserva advisory comum, exige Read Committed e verifica metadados/fontes conhecidos antes/depois, sem GRANT automático ou elevação de role. **Advisory é coordenação cooperativa, não proteção contra DDL privilegiada externa:** a janela de instalação excluiu outros instaladores, e mudanças futuras pertinentes devem respeitar a mesma reserva `(20261112,3133)`.

O CHECK de status mostrou representação equivalente no PostgreSQL produtivo 17.6. O preflight reconhece somente o modelo original ou a expressão literal comprovada com os mesmos nove estados/casts; não normaliza SQL arbitrário e continua recusando valores, CHECKs adicionais ou metadados desconhecidos. A 0034 passou a compartilhar a reserva de instalação e locks das relações requeridas, sem mudar fórmulas.

Pós-DDL: **56 tabelas públicas, todas com RLS; zero acessíveis diretamente por anon ou authenticated.** As RPCs necessárias têm EXECUTE para service_role, não para clientes públicos. Permaneceram 14 usuários, 1.235 parcelas e 1.152 transações de Caixa. As migrations não efetuaram recebimentos, renovação de clientes nem backfill.

## Smoke real segregado com rollback obrigatório

Às 10h01 BRT, um tenant sintético sem telefone foi usado somente dentro de uma transação revertida. Passaram onboarding, criação/replay mensal, baixa/replay de despesa, recebimento parcial/replay e integral, prova privada de pagamento prospectivo, estorno de despesa, renovação/replay com conservação de principal, legado íntegro/replay/prova privada e reconciliação `not_executed` com fence que impede executar o UUID encerrado.

Asserções SQL conferiram saldo-base e livro-caixa sem perda de centavos. Resultado: `SMOKE_OPERACIONAL_ROLLBACK_OK`, zero usuário de teste, renovação, recebimento legado ou fence persistido; contagens de parcelas e Caixa iguais ao baseline. Duas preparações do próprio smoke foram recusadas e revertidas por identificador sintético acima de 64 caracteres e falta de cast NUMERIC no SQL; a versão final usa os tipos físicos corretos. Não houve comunicação com compradores/clientes. Como em qualquer rollback PostgreSQL com SERIAL, sequências podem avançar; isso não representa lançamento financeiro persistido.

## Comportamento implementado

Caixa soma centavos exatos e recusa leitura incompleta/vínculo divergente, em vez de exibir zero fictício. Cadastro/edição de clientes confirma gravação e valida dígitos de CPF/CNPJ novos, preservando documentos legados omitidos. Relatórios usam a mesma base do Caixa, paginação determinística e erros explícitos. Listagens não gravam multas/status; calendário segue a virada do dia em America/Sao_Paulo.

O seletor de origem monta o recebimento adequado sem inferir tenant ou elegibilidade pelo ID. UUID/payload incertos são preservados; somente reconciliação autoritativa com fence permite encerrar intenção não executada. Comprovante sem pagamento comprovado não é inventado. Parcela renovada transfere principal, não o declara pago nem duplica a cobrança no sucessor.

A confirmação WhatsApp nasce apenas após resultado SQL normalizado. A prova é reconsultada por RPC privada e a deduplicação usa a operação durável. O endpoint financeiro apenas enfileira quando regra/automação do usuário estiverem ligadas; não chama a Evolution diretamente. Falha de mensagem não transforma pagamento confirmado em falha financeira. Cotação, timeout, resultado inválido ou renovação não disparam confirmação de quitação. **Não foi aplicada a 0032:** o worker final usa CAS já compatível com o schema, validado no runner real. Teste simulado não comprova entrega/leitura de mensagem a destinatário real.

## Limites que permanecem deliberados

Recebimento prospectivo: mensal comprovado, integral/parcial sem desconto, com cotação SQL. Renovação: primeira renovação de juros de contrato mensal com uma parcela intacta, conservando principal. Legado: somente integral, mensal, parcelas financeiramente virgens e vínculos/ledger/histórico reconciliados, sem encargos ambíguos. Conta protegida pelo trilho prospectivo não é reutilizada cegamente pelo legado.

Dados antigos divergentes continuam recusados com motivo; não foram corrigidos por suposição. Ajustes manuais, exclusão financeira, edição de juros/status fora das RPCs e estorno legado inseguro seguem bloqueados. Não declarar todos os dados antigos saneados nem todas as modalidades liberadas.

## Publicação e gates finais

Código integralmente validado pronto para checkpoint, commit/push sem force e deploy DigitalOcean. Preparar somente `ENABLE_RPC_RENOVACAO_PROSPECTIVA=true` e `ENABLE_RPC_RECEBIMENTO_LEGADO_VALIDADO=true`, no runtime, nomes reconfirmados no serviço. O salvamento das flags e o smoke autenticado da revisão publicada ainda são pendentes nesta edição. Não ativar flags antigas, revogação de sessões ou mudar integração comercial neste lote.

O último workflow WhatsApp consultado às 09h54 terminou `success`; a produção anterior continuou saudável durante o DDL. A evidência final de deploy/capacidades será registrada após chegar a nova revisão.

## Continuidade de hospedagem

O painel DigitalOcean mostra **US$ 36,00 em atraso**, pagamento até **14/11/2026** para evitar suspensão. Não foi iniciado pagamento, compra, alteração de plano ou reconfiguração de cobrança. Esse risco externo permanece separado da correção de código.
