# Onboarding transacional — validação local de liberação

**Data:** 08/11/2026. **Escopo:** correção pequena do primeiro uso em `/home/ubuntu/cobrapro`. **Status:** RPC e adaptador aprovados nos testes locais; **não liberado em produção e ainda sem integração em `appRouter.onboarding.complete`**. A edição de `server/routers.ts` foi expressamente excluída desta tarefa e deverá ser feita pelo pai, sob a autorização dele.

## Causa confirmada em leitura

O handler atual em `server/routers.ts:4929–4959` marca `users.onboarding_completo=true` antes da criação da conta, ignora os erros das duas escritas e tenta inserir `saldo_inicial`/`ativa`. Os campos de produção informados são `saldo`/`ativo`. Isso permite falso sucesso com conta ausente. Nenhuma edição desse arquivo foi feita nesta tarefa.

## Alteração entregue

`drizzle/0024_onboarding_transacional.sql` instala somente `public.rpc_concluir_onboarding(integer,text,text,text) RETURNS jsonb`. A migração não executa DML sobre dados da aplicação na instalação, não cria tabela de idempotência, não altera grants/RLS de tabelas e não exige flags adicionais. Usa `SECURITY DEFINER`, referências de tabelas qualificadas e `search_path=pg_catalog,pg_temp`. Somente `service_role` recebe `EXECUTE`; roles de formulário não recebem acesso. O `p_user_id` é capacidade do backend autenticado, não um owner obtido do input do usuário. A aplicação precisa manter a chave de serviço exclusivamente no servidor.

A RPC valida nomes após trim, de 1 a 255 caracteres Unicode, e tipo `caixa`, `banco` ou `digital`. Faz `FOR UPDATE` da linha do usuário e seleciona **a conta ativa do próprio owner com menor id**, também bloqueada. Quando houver conta ativa, o nome/tipo precisam coincidir com a intenção: caso contrário retorna conflito e não adota ou renomeia conta existente. Quando não houver conta ativa e onboarding ainda estiver incompleto, cria uma nova com `saldo=0`, `ativo=true` e apenas os campos reais informados. Contas inativas ficam integralmente preservadas; a resposta explicita `conta_id`, nome/tipo e `contaCriada=true`.

Para onboarding já concluído, o nome da empresa deve coincidir exatamente após normalização e a conta ativa determinística deve manter o preset nome/tipo solicitado. Replay confirmado não faz `UPDATE`, não troca empresa e não cria outra conta. Payload divergente, conta incompatível ou usuário já concluído sem conta ativa produz conflito explícito; **não há reativação silenciosa ou reparo automático de usuários antigos**. A regra conservadora pode exigir revisão explícita quando uma conta foi renomeada/inativada depois da conclusão. Sem tabela extra, não se promete recuperar uma intenção histórica que deixou de corresponder ao estado atual.

A confirmação da conta acontece antes de atualizar o usuário, com releituras que detectam inserts/updates suprimidos ou adulterados por triggers. O id devolvido precisa ser exatamente o solicitado. Não existe DML de alteração/exclusão de conta existente, saldo, cliente ou ledger. Somente o usuário ainda incompleto é atualizado; o timestamp é escrito explicitamente. Toda falha na chamada desfaz conjuntamente o insert e o update. Timeout de transporte, porém, não é prova de rollback: o adaptador manda conferir/repetir os mesmos dados.

A reaplicação faz `CREATE OR REPLACE` somente após comparar o corpo/hash, comentário de integridade, assinatura, nomes dos quatro parâmetros, owner, ACL, configuração segura, linguagem, volatilidade e demais metadados conhecidos. Homônimos, overloads e metadata adulterada são rejeitados sem sobrescrever o objeto. Default privileges desconhecidos também causam rollback da instalação. O fingerprint MD5 no catálogo é controle de alteração/reaplicação, não uma credencial nem assinatura de identidade; os artefatos e resultados têm SHA256 externo.

`server/services/onboardingRpc.ts` fornece `onboardingCompleteSchema`, `concluirOnboardingRpc` e `criarOnboardingCompleteHandler`. Executa uma única RPC, sem `.from`, SQL direto, REST ou fallback. Valida o envelope, `success === true`, conclusão booleana literal, ids JSON numéricos inteiros positivos limitados ao `integer` PG, id exatamente igual ao contexto e nomes/tipo exatamente iguais à intenção normalizada. Retornos strings/bigint, vazios, divergentes ou malformados nunca são aceitos como sucesso. RPC inexistente/ambígua retorna `PRECONDITION_FAILED`, mesmo se vier `data` de sucesso junto com erro. Erros de banco/transporte não expõem SQL, URLs, credenciais, detalhes ou `cause` externos.

## Integração obrigatória pelo pai

**Instalar a migração 0024 antes de fazer deploy do handler.** Não ligar esse código antes de verificar a assinatura e os grants no banco autorizado. Nenhuma migração foi aplicada em produção nesta tarefa.

No `server/routers.ts`, importar:

```ts
import {
  onboardingCompleteSchema,
  criarOnboardingCompleteHandler,
} from "./services/onboardingRpc";
```

Dentro do `onboardingRouter` existente, substituir **somente** `complete` por:

```ts
complete: protectedProcedure
  .input(onboardingCompleteSchema)
  .mutation(criarOnboardingCompleteHandler(getSupabaseClientAsync)),
```

Manter `check` e a montagem existente `appRouter.onboarding: onboardingRouter`. Não deixar as escritas REST antigas ou fallback. O handler recebe exclusivamente `ctx.user.id`; o schema rejeita owners e campos extras. A UI pode exibir a nova conta pelo `conta_id`/`nomeConta` e `contaCriada`, sobretudo se o usuário incompleto tinha apenas contas inativas. Não executar script de backfill ou DML de reparo de usuários/clientes/contas antigos para esta liberação.

## Resultados executados

| Gate local | Resultado final |
|---|---:|
| PostgreSQL 17 isolado, fixture sintética | **46/46 PASS; 0 FAIL** |
| Vitest do adaptador e handler | **88/88 PASS; 0 FAIL** |
| TypeScript estrito apenas dos dois arquivos novos | **exit 0** |
| Shutdown do cluster privado | **STOP_EXIT=0; FINAL_STATUS=3 (parado)** |

Comando PG17: `bash tests/postgres-onboarding/run.sh`. O padrão de `tests/postgres-expenses/run.sh` foi lido em modo somente leitura. O novo runner fixa os binários locais PG17, usa `env -i`, `psql -X`, `ON_ERROR_STOP`, socket de diretório 0700, `listen_addresses=''`, sem TCP, dotenv, instalação automática, schema externo ou credencial. A fixture reproduz types, nullability, typmods, defaults informados e CHECK dos tipos. O default de `users.updatedAt` não foi informado: a fixture não o pressupõe e o seed preenche explicitamente o timestamp. PKs sintéticas garantem a identidade necessária. Não houve leitura de dump nem conexão de produção.

Os 46 grupos PG17 incluem primeira criação, trim Unicode/255 codepoints, três tipos, replay sem qualquer alteração de linha/timestamp, payload divergente, conta ativa determinística, owners alheios/NULL, contas inativas e concluídas, RLS/grants, shadowing `public`/`pg_temp`, assinatura/named parameters, homônimos/overloads, metadata/hash/ACL/owner/config adulterados e default privileges inseguros. **Doze testes de falha injetada** cobrem BEFORE/AFTER de cada `INSERT`/`UPDATE`, write suprimido e id/owner/saldo/empresa/conta adulterados. Todas as linhas de negócio são comparadas antes/depois para comprovar rollback.

Concorrência usa dois processos `psql` reais: um segura a transação e o outro é observado em `pg_stat_activity` com espera real de lock. Payload idêntico retorna a mesma conta `1001`, primeiro `contaCriada=true`, segundo `repetida=true/contaCriada=false`; total de uma conta. Payload divergente gera `23505` no segundo, preservando o vencedor e uma única conta. Sentinelas sintéticas de contas preexistentes, saldo/timestamps, cliente, ledger e usuário legado permanecem iguais. Os testes jamais executam DML no cliente ou ledger legado.

Vitest foi executado via `env -i ... ./node_modules/.bin/vitest run server/services/onboardingRpc.test.ts --reporter=verbose --reporter=json --outputFile=tests/postgres-onboarding/results-vitest.json`. TypeScript usa CLI explícita com `--noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler`, sem depender de editar a configuração global. Não foram executadas suites globais, build, deploy ou smoke em produção. Falhas iniciais exclusivamente do runner/mocks (CREATE DATABASE junto com comandos, nome reservado e default do mock undefined) foram corrigidas; os números acima pertencem à última execução completa aprovada.

## Evidências e assinaturas

- [Resultados PostgreSQL17](/home/ubuntu/cobrapro/tests/postgres-onboarding/results-pg17.json), [log da execução](/home/ubuntu/cobrapro/tests/postgres-onboarding/pg17-run.log) e [metadata da fixture](/home/ubuntu/cobrapro/tests/postgres-onboarding/metadata-producao-fixture.json).
- [Resultados Vitest](/home/ubuntu/cobrapro/tests/postgres-onboarding/results-vitest.json), [log Vitest](/home/ubuntu/cobrapro/tests/postgres-onboarding/vitest-run.log) e [TypeScript](/home/ubuntu/cobrapro/tests/postgres-onboarding/typescript-run.log).
- [Concorrência idêntica](/home/ubuntu/cobrapro/tests/postgres-onboarding/evidence/race_same-race.log), [concorrência divergente](/home/ubuntu/cobrapro/tests/postgres-onboarding/evidence/race_different-race.log) e [shutdown](/home/ubuntu/cobrapro/tests/postgres-onboarding/evidence/shutdown.log).
- [Manifesto SHA256](/home/ubuntu/cobrapro/tests/postgres-onboarding/signatures.json).

**Assinatura SHA256 do objeto de resultados PG17** (JSON canônico sem o próprio campo de assinatura): `03420729c19bec74855438a1f1cd4dfdc6860d93c0b748ab7415dd7bf3dc1406`.

**SHA256 do arquivo de resultados Vitest:** `5de34bc30b26f5e39a216699a8c85f7a17b3f33efc547773419f0ab7bfddf922`.

| Artefato | SHA256 |
|---|---|
| `drizzle/0024_onboarding_transacional.sql` | `a2c3b56da3522c9ecf71be350a1b27e2d7fe56d9560e4b8b9d3ce43e5004db24` |
| `server/services/onboardingRpc.ts` | `7cbe6cd86c2055bcefb70c21d8dc0f851f9bc779b7fdc39a9207183cd5df10dd` |
| `server/services/onboardingRpc.test.ts` | `eb788ff941fb6249a52f708b177df3da58cfa5ec9e6704dc5c5d4999203d8b1c` |

Esses hashes atestam integridade dos arquivos e resultados, não assinatura criptográfica de identidade. Escritas restritas aos paths autorizados nesta tarefa. Sem browser, produção, MCP, agentes adicionais, commits, ativação de flags ou alteração de `routers.ts`, env, db ou index. **Pendências de liberação:** integração mínima pelo pai, instalação autorizada da 0024 e smoke do primeiro uso via aplicação depois desses dois passos.
