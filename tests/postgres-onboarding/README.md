# Onboarding 0024 — testes locais PostgreSQL 17

Execute na raiz de `/home/ubuntu/cobrapro`:

```bash
bash tests/postgres-onboarding/run.sh
```

Requer os binários já instalados em `/usr/lib/postgresql/17/bin` e usuário não-root. Cria cluster efêmero com `env -i`, socket privado 0700 e TCP desabilitado, aplica apenas a fixture sintética e a migração 0024, encerra o cluster com `trap`. Não usa dotenv, conexão externa, dados/dump de produção ou DML de reparo.

`fixture.sql` contém o contrato informado de users/contas_caixa e sentinelas financeiras sintéticas. `validate.py` verifica 46 grupos: primeira criação, replay, conflitos, owners, inativas, rollback de cada write, concorrência real observada, grants/RLS, search path e rejeição de homônimos/overloads/metadata adulterada. `metadata-producao-fixture.json` documenta a fixture, não é introspecção de produção. O default de `users.updatedAt` não foi informado e não é presumido.

O runner grava `results-pg17.json` e logs em um diretório `/tmp/cobrapro-onboarding.*` informado na saída. As evidências finais desta tarefa foram copiadas para `evidence/`. Vitest: `./node_modules/.bin/vitest run server/services/onboardingRpc.test.ts`. `signatures.json` registra integridade SHA256 da execução entregue.

Leia `reports/onboarding-liberacao-2026-11-08.md` para os resultados, política conservadora de replay e integração obrigatória pelo pai. A migração deve ser instalada antes do deploy do handler; `routers.ts` não foi modificado nesta tarefa.
