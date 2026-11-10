# Kiwify Blacklist — testes PostgreSQL 17 descartáveis

Execute do projeto, como usuário não-root:

```sh
bash tests/postgres-kiwify-subscriptions/run.sh
```

Requer `/usr/lib/postgresql/17/bin`, Python 3 e utilitários Ubuntu já disponíveis. Não instala dependências, não lê `.env`, não usa credenciais, MCP, navegador, TCP ou produção. `env -i` limpa configuração remota; `initdb` em `/tmp/cobrapro-kiwify-subscriptions-*`, socket Unix modo 0700, `listen_addresses=''`. Trap para SIGINT/SIGTERM/EXIT encerra PG17 e remove pgdata/socket; logs e resultados são copiados para `evidence/`. `STOP_EXIT=0` comprova shutdown.

A fixture possui `users(id integer PRIMARY KEY, role text, email text)` com RLS e usuários 1/2/3 sintéticos (email null incluído); candidatos duplicados de email em caixa/espaços distintos são fixtures de clones próprios. Grants legados vitalícios sintéticos comprovam que NÃO são usados. A migração é aplicada somente a esse banco descartável. Produtos sintéticos inseridos pelo owner são configuração de teste, nunca seed da migração.

`validate.py` cobre **33 grupos (22 originais + 11 novos)**: allowlist vazio; ACL table/column/RPC; RLS sem policies; idempotência 2 reaplicações preservando catálogo e todas as linhas tanto com ledger vazio como populado; pagamento/renovação; canceled com período pago vigente; dedup exact fingerprint; cancelamentos distintos; stale e same-order; revogação sticky mesmo sem customer_access ou com datas inválidas; venda API agora refunded em replay; novo subscription_id; gate multiuser; expiração sem cron; UTC sem Z com timezone divergente; no lifetime; DTO sem PII/secrets; conflitos; triggers append-only; concorrência replay/conflito/paid-versus-revoke/renovações em ambas as ordens; 18 variantes de catálogo adulterado e homônimos/type; role membership privilegiado.

Novos grupos: `access` com 12 campos/flags reais/UTC/last-paid e negativa inteira null; escolha determinística somente elegível; nenhum vazamento de evidência parcial closed/financial/review/expired; `order_binding` imutável/missing/isola pedido-user e permite refund sem Subscription IDs preexistentes, independente de disabled/expired/sticky; ledger hostil com pedido cruzado resulta null; `find_users` case/trim, duplicidades LIMIT2 ordenadas e null/controle/oversize negados; zero ACL anônima/sem SELECT users direto/sem email no ledger; 19 preflights extras email/readers (hash/owner/path/ACL/STRICT/overload/ausência); homônimos antes da instalação com rollback inteiro; owner sem SELECT ou com RLS ocultando candidatos negado; hashes byte-idênticos de consume/identity/immutable. Coluna email `varchar(320)` é aceita, sem alterar users na migração.

Cada cenário hostil usa seu próprio banco clonado e conserva os dados/catálogo adulterados após falha. Não há correção de tabela para fazer teste passar. O teste de role membership é cluster-global descartável e não é revertido artificialmente. As únicas atualizações owner de dados elegíveis fora da RPC são ligar/desligar o allowlist de produto (configuração); elas nunca concedem período por si. O cenário de ledger hostil apenas insere dados inconsistentes deliberados no clone para confirmar negação sem correção; não é trilho de produção.

`results-pg17.json` contém versão, grupos, SHA256 da migração e SHA256 dos corpos das funções. Os logs são sintéticos, podem incluir PII fictícia propositalmente rejeitada por validação; nenhum dado real foi acessado. `kiwify-persistencia.md` no diretório release-review contém contrato JSONB completo e limitações de integração.

Nenhuma suíte sintética comprova HMAC real, escopos OAuth, venda real, ID do produto CobraPro, validade de assinante ou ponta a ponta. Essas verificações permanecem bloqueios de rollout. O owner/superuser do banco é parte do domínio confiável: nenhum SQL pode impedir DBA de remover triggers/funções; o serviço da aplicação NÃO tem DML direto.

Idempotência só para esta versão exata, inclusive ledger populado. Um pacote 0027 anterior com access antigo/readers ausentes é rejeitado, não atualizado ou reparado. A migração não cria email, índice, policy ou grants em users para contornar preflight. Nenhuma flag/allowlist/grant manual/vitalício ativado fora das fixtures descartáveis; reader não inventa assinatura por email nem faz GET upstream.
