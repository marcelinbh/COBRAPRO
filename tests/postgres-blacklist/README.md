# Blacklist: migration-base e testes PostgreSQL descartáveis

**Status: apenas preparação local. Esta migration NÃO libera a funcionalidade em produção.** Nenhum DDL foi aplicado fora do cluster temporário criado por este runner. Não houve conexão Supabase, browser, alteração de backend/frontend/schema TypeScript, Git/checkpoint, pagamentos, e-mails ou Kiwify.

## Arquivos e execução

- `drizzle/0019_base_blacklist_backend_only.sql`: migration PostgreSQL manual, atômica em um único `DO` e reaplicável; não está registrada automaticamente em journal nem foi executada no banco da aplicação.
- `fixture.sql`: apenas `users(id INTEGER PRIMARY KEY)`, papéis sintéticos e `pgcrypto` em `extensions`.
- `validate.py`: asserções via `psql` e disputas entre processos/conexões reais; apenas biblioteca padrão Python.
- `run.sh`: cluster exclusivo em `/tmp/cobrapro-blacklist-*`, socket Unix privado, porta aleatória e `listen_addresses=''` (TCP desativado).
- `runner-result.log`: saída da última execução, incluindo resultado do encerramento.

Execute na raiz do projeto, como usuário não-root:

```bash
./tests/postgres-blacklist/run.sh
```

Requer PostgreSQL local com `initdb`, `pg_ctl` e `psql` em `/usr/lib/postgresql/*/bin`, Python 3 e extensão `pgcrypto` já instalada. O runner não instala dependências, não lê `.env` ou `DATABASE_URL`, não aceita URL externa e usa ambiente limpo nos subprocessos. `trap` encerra apenas seu próprio cluster em sucesso, falha ou interrupção; os arquivos do banco são removidos depois do encerramento. Logs sintéticos ficam na pasta `evidence` informada pela execução. Não utiliza cluster PostgreSQL previamente ativo.

## Contrato e proteção

A base corresponde aos campos físicos de `drizzle/schema.ts` (blacklist e blacklist_fotos) e ao contrato atual de `server/routers/blacklist.ts` e `server/storage.ts`, lidos e não modificados. `"createdAt"` e `"updatedAt"` são físicos, `timestamptz NOT NULL DEFAULT now()`; fotos têm `"createdAt"`. O contrato de fotos não possui `updatedAt`. IDs são `serial`/INTEGER com sequências próprias. A migration não precisa de `pgcrypto` nem move/cria a extensão.

Os enums `public.status_blacklist` e `public.tipo_divida_blacklist` são criados somente quando ausentes. Enums já existentes precisam coincidir exatamente em labels e ordem; um tipo homônimo não-enum também aborta. Relações comuns persistentes, colunas, tipos, nullability, defaults, PKs/FKs, sequências, índices, função e gatilho são validados estritamente. Objetos incompatíveis não são substituídos/corrigidos e a transação aborta. Essa rigidez pode rejeitar estruturas semanticamente equivalentes com nomes/defaults diferentes: exige revisão explícita, não conversão automática.

A autoria referencia `public.users(id INTEGER)` com `ON DELETE RESTRICT`; excluir usuário com autoria ainda existente é proibido. Fotos referenciam o pai com `ON DELETE CASCADE`: excluí-lo remove **metadados** de fotos sem órfãs. Há índices separados de autor, CPF/CNPJ, status e relação fotos→pai. Não existe unicidade global de CPF/CNPJ; autores diferentes podem cadastrar o mesmo documento. A base também não introduz unicidade por autor/documento.

RLS fica habilitada nas duas tabelas, sem nenhuma policy; policies/rules preexistentes abortam em vez de serem ignoradas. `service_role` deve ser não-superuser com `BYPASSRLS`: recebe somente `SELECT, INSERT, UPDATE, DELETE` nas tabelas, `USAGE` nas sequências e tipos/schema necessários. Não recebe `TRUNCATE`, `REFERENCES`, `TRIGGER`, `SELECT/UPDATE` de sequência ou `EXECUTE` da função interna. O gatilho é `SECURITY INVOKER`, não uma RPC nem função privilegiada. O owner administrativo continua responsável pelo DDL e superusers não são restringíveis por ACL/RLS.

Grants de tabela **e de coluna**, sequências e execução da função são revogados de `PUBLIC`, `anon` e `authenticated`; grants antigos excessivos de `service_role` são reduzidos. Acesso efetivo herdado de cliente, membership em `service_role` e ACL residual de outro papel nas tabelas/sequências abortam. Não cria DTO público, view compartilhada ou policy permissiva. A credencial `service_role` continua exclusiva do backend; RLS não implementa por si só autorização do usuário final quando o backend usa BYPASSRLS.

## Teto de cinco fotos e concorrência

O gatilho `BEFORE INSERT OR UPDATE OR DELETE` bloqueia os pais com `FOR UPDATE`, em ordem de ID quando há movimento entre registros. Um `UPDATE` sem mudança de valor de `"updatedAt"` no pai cria conflito de escrita MVCC. Isso é necessário: apenas lock e contagem podem usar snapshot antigo em `REPEATABLE READ`. Os valores de negócio/timestamps do pai permanecem iguais, mas há escrita de linha/WAL e contenção por pai.

Em `READ COMMITTED`, o concorrente aguarda e a sexta foto falha com `23514`. Em `REPEATABLE READ`/`SERIALIZABLE`, um snapshot anterior à escrita concorrente falha com `40001` em vez de ultrapassar o teto. A aplicação deve tratar conflitos/falhas e, quando aplicável, repetir **a transação inteira**; esse tratamento não foi implementado nesta etapa. Deadlocks em operações multi-pai mais complexas também exigem retry transacional, nunca bypass do gatilho. O owner/superuser pode desabilitar gatilhos; é uma operação administrativa fora da garantia de DML normal.

Atualização de metadados de foto no teto é aceita; mover foto para pai cheio é negado; DELETE libera uma posição. Um lote de seis fotos aborta integralmente, sem persistir as primeiras cinco. Gaps de sequência após INSERT/transação abortada são comportamento normal PostgreSQL: **não** significam perda de linhas. A reaplicação da migration não consome IDs, não reinicia sequências e não modifica dados.

## Cobertura local

A suite verifica reaplicação com comparação integral de todas as colunas/linhas e estado das duas sequências; grants DML e negações reais sob `SET ROLE`; enums; camelCase obrigatório; órfãs; autoria; cascade; lote e movimento de fotos; divergências homônimas de tabela/enum/constraint/índice/sequência/função/gatilho; policies e ACLs incompatíveis; grants de coluna herdados; preservação após falhas. Todas as identidades/documentos são marcadores `SYNTH-*`, URLs usam `example.invalid` e nenhum CPF, e-mail, telefone ou outro dado pessoal real é usado.

As corridas abrem duas sessões reais, aguardam `pg_stat_activity.wait_event='transactionid'` para provar bloqueio, e verificam quem confirmou/abortou. Há disputa pelo quinto slot nos três níveis de isolamento e disputa de `DELETE` de pai com `INSERT` de foto: após commit do DELETE, o INSERT é rejeitado com `23503` e não fica órfã. A corrida é finita e usa `pg_sleep` curto apenas para manter o lock até a outra sessão chegar.

## Blockers de produção: permanecem separados e obrigatórios

1. **Privacidade real do storage:** emitir uma URL via proxy autenticado não comprova que o objeto é privado, que a URL expira, que não é acessível anonimamente, ou que a autorização é vinculada ao proprietário. `storagePut`/`storageGet` atuais não demonstram essas propriedades. É necessário implementar/verificar objetos privados e URLs temporárias autorizadas sem expor URL permanente pública, inclusive `foto_url`/`url` legados.
2. **Elegibilidade de assinantes:** a migration não valida assinatura/entitlement nem restringe consulta compartilhada por assinante. O backend atual usa `protectedProcedure`; login não comprova elegibilidade. O gate precisa ser implementado e testado separadamente, incluindo autorização de autoria em todas as operações.
3. **Remoção física do objeto:** cascade/DELETE só removem linhas de metadados. O storage atual não tem remoção de objetos; exclusão de foto/pai e falha do INSERT depois de upload podem deixar arquivos. É obrigatório tratamento separado, confiável e auditável da exclusão/compensação de uploads, inclusive quando a disputa pelo quinto slot aborta no banco.

Não foram testados storage real, autenticação Express/Supabase, PostgREST, cache de schema, assinaturas, autorização ponta a ponta ou integração financeira. A migration não corrige esses blockers, não é autorização de deploy e não substitui revisão de privilégios administrativos, papéis herdados, exposição por outros objetos e configuração de produção. A aplicação futura exige autorização explícita e validação do catálogo real em etapa própria.

## Resultado da última execução

Em 2026-11-06 (data local da solicitação), o runner terminou com **21 verificações PASS**, PostgreSQL **16.15**, porta aleatória **43127**, TCP desativado e **`STOP_EXIT=0`**. A segunda aplicação, a reaplicação após saneamento de grants e a reaplicação final preservaram dados/sequências integralmente. Os logs detalhados estão em `/tmp/cobrapro-blacklist-cnapw2/evidence`; o cluster foi encerrado e seus dados temporários apagados. `runner-result.log` e `result.json` nesta pasta preservam o resumo verificável. Não foi aplicado DDL fora do cluster local.
