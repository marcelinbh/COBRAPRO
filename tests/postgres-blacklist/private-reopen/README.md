# Reabertura privada da Blacklist — regressão local

Execute na raiz do projeto:

```bash
bash tests/postgres-blacklist/private-reopen/run.sh
pnpm exec vitest run --config tests/postgres-blacklist/private-reopen/vitest.config.ts
pnpm check
```

O runner reaproveita `../fixture.sql` e usa PostgreSQL 17 em cluster descartável, socket exclusivo com permissão 0700, ambiente `env -i` e TCP desabilitado. Não lê `.env`, não conecta à produção e não utiliza dados reais. O trap encerra o cluster e remove os dados; o resultado final exige `STOP_EXIT=0`.

A ordem de dependência é **0019 → 0023 → 0026 → 0027/0028 → 0030 → 0029**. A ordem numérica não substitui esta dependência: 0030 instala um CHECK antes da reabertura de ACL na 0029.

O catálogo produtivo consultado pelo agente principal mostrou somente PK/FK em `blacklist_fotos`, sem proteção de URI. A migration 0030 adiciona explicitamente o CHECK `private_storage_path`: URL interna `storage://cobrapro-blacklist-private/` correspondente a `file_key`, com chave UUIDv4/autor/pai.ext. Requer freeze íntegro, bucket privado de 2 MiB com JPEG/PNG/WebP e schema conhecido. Não reescreve linhas nem muda ACLs; referências antigas inválidas ou CHECK divergente abortam atomicamente. O formato não prova autoria; a vinculação entre autor, pai e objeto continua obrigatória no backend.

A 0029 verifica esse CHECK, hashes/metadata das funções, ACLs, Storage e um ACK externo do backend privado live. Concede exclusivamente escrita necessária ao `service_role` e execução da exclusão protegida. Não concede direitos a usuários, não cria policies públicas nem altera concessões de assinatura.

Validação final: **58 checks PostgreSQL aprovados**, sem listeners TCP e com encerramento confirmado. Inclui primeira aplicação/reaplicação, 0029 recusada antes de 0030, seis recusas da 0030, drift e preservação de linhas/ACLs/sequências. A configuração isolada do Vitest executa **260 testes em 8 arquivos**, incluindo `regressionserver/migrations/blacklistPrivateReopen.test.ts`, que não está no include padrão.

As saídas `evidence/` e logs são temporárias e devem permanecer fora do Git. O ACK sintético do runner não comprova deploy, assinatura HMAC, venda, conta cadastrada, entrega de convite ou elegibilidade de assinante; esses critérios exigem validação externa pelo operador.
