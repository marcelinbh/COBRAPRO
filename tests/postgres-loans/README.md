# Criação prospectiva de empréstimos — PostgreSQL17 local

Execute da raiz do projeto:

```bash
bash tests/postgres-loans/run.sh
pnpm exec vitest run server/services/emprestimosRpc.test.ts server/migrations/emprestimosRpc.test.ts
pnpm check
```

O runner exige PostgreSQL17 em `/usr/lib/postgresql/17/bin` e usuário não root. Cria cluster descartável em `/tmp/cobrapro-loans-pg17-*`, somente UNIX socket privado, `listen_addresses=''`, executa cada processo PostgreSQL/validação com `env -i`, sem dotenv/URLs/segredos. O `trap EXIT` encerra e confirma status 3 (parado), inclusive na falha. Evidências e cluster parado são mantidos no diretório impresso. Não é serviço persistente e não requer conexão externa.

O fixture foi montado exclusivamente a partir da metadata `columns`, `constraints` e `indexes` autorizada do snapshot de 7/11/2026. Os nomes e linhas de teste são sintéticos; `users` e dependências exclusivas do preflight 0015 são stubs locais. Preserve `taxa_juros NUMERIC(5,2)`, `contrato_historico.valor_novo NUMERIC(12,2)`, `user_id TEXT`, datas `DATE`, defaults de multa 2.00 e mora 0.033, aliases obrigatórios e status VARCHAR CHECK (inclusive `atrasado`/`renegociado`). Caixa não tem `cliente_id`/`operacao_financeira_id`.

Há duplicata legada sintética com owner nulo e contas com lançamentos de owner externo/nulo. A criação usa conta limpa existente, nunca reescreve seu saldo-base. No final o teste compara as linhas legadas integralmente e roda 0013/0015 em transações abortadas: ambas devem recusar exatamente por preflight dos dados, não por dependência ausente. Não instala função de recebimento e não cria índice parcial para disfarçar legado.

A suíte SQL exercita a função real: criação completa, N=1/N=60, juros simples, arredondamento e soma em centavos, decomposição de juros/capital, replay canônico e conflito, tenants, koletor ausente/ativo/inativo/ambíguo, ledger/saldo, rollback induzido nas sete escritas (incluindo segunda parcela), desconexão antes do commit, oito chamadas concorrentes com mesma chave, conflito concorrente, contas serializadas, troca de owner enquanto o chamador espera lock, ACL, fusos extremos e preservação de legado.

## Recorte e integração

Somente modalidade `mensal`, `tipoTaxa='mensal'`, N de 1 a 60. Fórmula comprovada em `shared/finance.ts:calcularParcelaPadrao`: juros total = principal × taxa/100 × N. Política solicitada para esta entrega: arredondar juros totais em NUMERIC, parcela de referência arredondada, resíduos da soma total e dos juros colocados na última parcela. Rateio que gere parcela não positiva ou juros negativos/superiores à parcela é recusado, não ajustado silenciosamente.

`vencimentos` deve informar exatamente N DATEs mensais consecutivos. Para N>1, dia inicial entre 1 e 28, sem clamp/rollover de fim de mês. Para N=1, qualquer data civil válida, incluindo 29/2/2028. Desembolso coincide explicitamente com início. Principal e taxa têm até duas casas conforme catálogo; teto do total é 9.999.999.999,99 por causa do histórico NUMERIC(12,2). Multa e mora são omitidas para preservar defaults do catálogo; customização desses campos é recusada pelo adaptador.

`criarEmprestimoProspectivoAtomico(clienteRpc, ctx.user.id, input)` é o único transporte; flag `ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS=true` exigida explicitamente, off por padrão. O adaptador recebe a intenção estrita (`entradaEmprestimoProspectivoSchema`) e confere a confirmação SQL contra cálculo independente em centavos BigInt. Retorna dinheiro decimal em strings e ID de Caixa em string, sem perda de precisão. Em timeout, repetir exatamente a mesma chave; nenhum erro de rede comprova rollback.

Rotas/UI/guards não são alterados neste pacote. O integrador deve impedir todos os escritores legados no conjunto novo antes de habilitar o fluxo. A RPC não certifica saldo histórico, não impede por si só escrita direta arbitrária de outro serviço com credencial privilegiada e não oferece recebimento/renovação/edição/exclusão. Instalar 0021 ou passar testes sintéticos não autoriza rollout, nem 0013/0015 nem recebimento antigo.
