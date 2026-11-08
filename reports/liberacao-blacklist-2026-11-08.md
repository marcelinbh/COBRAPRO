# Blacklist — integração segura de 8/11/2026

## Estado e escopo

Implementação local concluída e rota de fotos registrada no backend pelo agente principal. **Não instalada ou habilitada em produção neste ponto.** O compartilhamento é restrito à Blacklist; outros dados multiempresa não ganham acesso compartilhado. Nenhum seed de assinante, foto real, alteração Kiwify ou concessão automática foi executado.

A flag `ENABLE_BLACKLIST_PRIVATE` exige o valor exato `true`; desligada, o módulo falha fechado. Todas as operações verificam acesso atual em `blacklist_access_grants`: status ativo, intervalo vigente ou vitalício explicitamente concedido, concessor administrativo e evidência. As tabelas de assinaturas financeiras dos clientes não são usadas como prova de assinatura SaaS. A tabela de concessões vazia não concede acesso a nenhum usuário. Auditoria administrativa de acessos é distinta de consulta de fotos; administrador sem concessão não recebe fotos automaticamente.

## Fotos privadas

O backend usa Supabase Storage em `cobrapro-blacklist-private`. Confere `public === false` em toda utilização e não converte bucket público. Criação lazy só ocorre com ausência comprovada e metadata relida, inclusive em corrida. O bucket de logos, público, não é reutilizado. URLs no banco são referências `storage://`; DTOs apontam apenas para `/api/blacklist/photos/:id`. URLs públicas legadas ou externas não são servidas automaticamente.

Upload aceita somente PNG/JPEG/WEBP com assinatura binária verificada, base64 canônico e limite de 2 MB; a chave contém UUID, autor e registro. O teto de cinco fotos é estrutural/transacional na 0019, não apenas um contador de interface. O download exige sessão, concessão atual, vínculo pai/foto/autor e chave válida; revalida concessão depois do Storage. Responde bytes, sem URL assinada, redirecionamento ou endereço público permanente, com `private, no-store`, `nosniff` e política same-origin.

Quando o banco rejeita foto excedente ou falha, o upload é compensado no Storage. Resultado incerto de INSERT é conferido pela chave antes de remover objeto que possa ter sido confirmado. Exclusão de foto preserva cópia validada em memória e restaura o objeto se a exclusão no banco falhar. Exclusão de registro só ocorre sem fotos e com lock do pai, por RPC proprietária da 0023, evitando CASCADE silencioso e corrida upload/exclusão.

**Limite:** não existe transação distribuída nem outbox persistente entre banco e Storage. Crash entre etapas ou falha dupla de compensação exige reconciliação operacional. Não afirmar que nenhum objeto órfão poderá existir. A restrição de excluir o registro enquanto houver fotos deve aparecer nas telas de gestão.

## Concessões 0023

Migration backend-only com RLS sem policies, `user_id` PK/FK, status ativo/suspenso/revogado, timestamps finitos, vitalício explícito, concessor FK validado como administrador, evidência e motivo. Audit trail before/after append-only gerado no banco; `service_role` não insere/altera/apaga auditoria nem apaga concessões. Homônimos, constraints, policies, ACL herdada, overloads e sequências adulteradas falham fechado. Não existem concessões automáticas nem UI administrativa de provisionamento nesta entrega.

## Evidências locais

| Verificação | Resultado |
|---|---|
| Vitest dedicado, 9 arquivos | 124 aprovados |
| TypeScript | aprovado |
| 0019, PostgreSQL 17.11 privado | 21 verificações aprovadas; shutdown confirmado |
| 0023, PostgreSQL 17.11 privado | 14 verificações aprovadas; shutdown `STOP_EXIT=0` confirmado pelo agente principal |
| Concorrência de upload/limite e exclusão | coberta nos runners locais |
| Fotos PII reais ou comunicação a clientes | não utilizadas |

Logs: `/tmp/blacklist-unit-tests.log`, `/tmp/blacklist-typecheck.log`, `/tmp/blacklist-pg17-baseline.log`, `/tmp/blacklist-access-pg17.log`. Fixtures locais não comprovam implantação, Storage HTTP real, failover ou crash recovery.

## Gates de liberação

Antes da flag: ensaio da versão final no clone privado, aplicação de 0019/0023 no projeto correto, validação de ACL/RLS, confirmação de ausência de policies Storage públicas para o bucket, criação e comprovação do bucket privado, deploy exato e smoke autenticado. Concessões precisam da lista paga/vitalícia autorizada pelo usuário e evidência; silêncio não é aprovação. As páginas de gestão de registros/fotos precisam testar os estados de erro e a remoção de fotos antes de excluir pai. Kiwify permanece por último.
