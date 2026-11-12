# Renovação prospectiva v1 — somente ensaio local

O runner sobe **PostgreSQL 17** em diretório `/tmp/cobrapro-renewal-safe-pg17-*` privado (0700), sem TCP (`listen_addresses=''`), usando somente socket Unix e `env -i`. Não lê `.env`, não usa secrets, não acessa Supabase e não altera dados fora da fixture sintética. O `trap` encerra o cluster e imprime `FINAL_STATUS=3`.

```bash
cd /home/ubuntu/cobrapro
NODE=/home/ubuntu/.nvm/versions/node/v22.13.0/bin/node
env -i PATH="$(dirname "$NODE"):/usr/bin:/bin" LANG=C.UTF-8 bash tests/postgres-renewal-safe/run.sh
```

A migration já gerada em `drizzle/0031_rpc_renovacao_juros_prospectiva.sql` é o artefato revisável. `build.mjs` recompõe deterministicamente os corpos do guard e recebimento a partir de 0021/0022 e `template.sql`, calculando hashes dos predecessores. Não execute o gerador contra predecessores modificados sem revisão; regenerar hashes **não comprova** segurança de um novo predecessor.

## Contrato v1

A primeira renovação exige uma única parcela mensal inicial de criação 0021 sob 0022 com `origem_completa=true`, snapshot inicial igual e nenhuma operação anterior. 0021 sem snapshot completo, legado, parcial sem alocação, desconto/encargos manuais, amortização, múltiplas parcelas e segunda renovação são recusados. Nenhum backfill ou reparo ocorre.

Recebe juros embutidos + multa/mora cotados em BRT, **principal pago zero**. Registra status `renovada` e prova exclusiva vinculada à operação, predecessor, sucessor e entrada de Caixa. O `saldo_residual` antigo é principal transferido e não deve ser somado novamente à dívida corrente. O sucessor conserva principal e taxa, com juros do novo mês; seu vencimento é o maior entre vencimento anterior e dia BRT de recebimento + um mês civil, com clamp explícito para o último dia.

`num_parcelas` e `numero_parcelas` passam a 2 (linhas geradas); `total_contrato`/`valor_parcela` passam à obrigação corrente; `data_inicio`, `data_vencimento_primeira`, principal, defaults de encargos, desconto e valores históricos permanecem. Não há status paga fictício, segundo desembolso ou receita de principal na renovação.

A 0031 substitui o corpo de `ciclo_guardar` **apenas** para consumir capability privada de uso único com JSON old/new completos. Sem capacidade exata, executa o guard 0022 original integralmente. Não usa autorização genérica `receber` para a renovação. A única extensão de `rpc_receber_emprestimo_prospectivo` é o predicado de quitação para ignorar exclusivamente antecessor renovado com prova completa concluída; isso permite quitar o sucessor e o contrato sem reabrir/amortizar o predecessor.

## Evidências

A suíte usa conexões PG concorrentes reais, rollback injetado após cada escrita, ACLs/guards, valores e componentes exatos, exclusividade da prova, parcials anteriores recusados, baixa do sucessor e BRT. A virada durante espera no advisory lock é instrumentada com relógio de teste **somente no cluster sintético**, mantendo locks/SQL reais; a função real é restaurada imediatamente depois. Não aguarda a meia-noite física.

Limite conhecido: snapshots 0022 serializam timestamps segundo timezone da criação. A nova renovação fixa UTC, aceita proveniência UTC comprovada e recusa divergências de snapshots; não normaliza/adota dados de criação com outro timezone. Produção exige revisão e ensaio do catálogo real, inclusive quaisquer triggers/CHECKs adicionais; preflight falha fechado se desconhecidos.
