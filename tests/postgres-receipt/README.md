# Regressões PostgreSQL de recebimento

Execute somente em ambiente de desenvolvimento descartável, com PostgreSQL e `postgresql-contrib` instalados, como usuário não root:

```bash
bash tests/postgres-receipt/run.sh
```

O runner cria um diretório único `/tmp/cobrapro-pg-test-*`, inicia PostgreSQL **somente em socket Unix** (`listen_addresses=''`), limpa o ambiente de cada subprocesso e não carrega `.env`. Não recebe URL de banco, não conecta à rede, não usa Supabase nem dados reais. Não remove cluster existente. Ao terminar, inclusive em falha, o trap encerra seu próprio cluster; evidências ficam no diretório informado.

Executa o preflight antes da instalação, as migrations reais 0013 e 0015 duas vezes, 17 grupos de testes e o preflight final. Cobertura: recebimento integral/parcial, encargos preservados, replay de chave, payload conflitante, isolamento de empresa/cliente/Caixa, conta inativa, ACL `service_role` vs `anon/authenticated`, calendário civil de Brasília, rollback após falha injetada no lançamento, referências compostas e quatro cenários de concorrência com espera real por lock.

O fixture mínimo deriva do schema local e não é exportação nem verificação da base produtiva. Não cobre RLS/triggers particulares de produção, transporte PostgREST, UI, flag de ativação ou compatibilidade integral do schema CobraPro real. Valida invariantes do livro-caixa, não atualização externa da coluna `contas_caixa.saldo`. Aprovação local não substitui preflight da base correta nem autoriza reativação financeira.
