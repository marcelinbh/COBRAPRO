# Coexistência de caixa — gate local 0025

**Data:** 2026-11-08. **Decisão final desta tarefa:** correção conhecida validada localmente; **GO somente para novo rehearsal controlado pelo pai. NO-GO para instalar/deploy/flags sem rehearsal aprovado do hash final.** Não constitui liberação universal de financeiro.

## Correção conhecida e causa do bloqueio

O pai informou falha do rehearsal anterior no clone restaurado em `/tmp/cobrapro-backup-restore-ikofyely/logs/rehearse_0025_integrar_rpc_despesas_ciclo.log`, linha 51: `0025: tabelas/defaults/CHECK/FK/índices incompatíveis`. O diagnóstico visual confirmado pelo pai mostrou `relrowsecurity=true` em produção/clone para `contas_caixa`, `contas_pagar` e `transacoes_caixa`, habilitado intencionalmente pela 0018 em 06/11. A baseline local incorretamente exigia false. Esta tarefa não abriu backup, log restaurado, dados produtivos, PII ou credenciais; usa o diagnóstico autorizado e fixtures sintéticas.

**A baseline foi corrigida exclusivamente em três bits `relrowsecurity false → true`.** Nenhum dos 15 corpos/hashes de função, colunas, types, defaults, nulabilidade, ordem, collation, identity/generation, CHECKs, FKs, índices, triggers ou outros metadados da baseline foi modificado. `relforcerowsecurity` permanece **false**. O teste estrutural reconstrói somente os três bits anteriores e verifica SHA-256 do JSON compacto integral original `4f3dc0483eee2f5d521b1bec5c6ae5bec0325ebca45123b3ceac6efd618129d6`. A prova de diferença preservada é `tests/postgres-financial-coexistence/evidence/known-correction.json`.

A fixture local habilita RLS nessas três bases e ajusta exclusivamente sua role sintética para `service_role NOSUPERUSER BYPASSRLS`, conforme propriedade produtiva confirmada pelo pai. Não concede membership de owner nem superuser. BYPASSRLS não contorna ACL/guardas. Os GRANTs DML sintéticos anteriores permanecem para provar que movimento manual é recusado pela guarda, e não pela falta de privilégio/RLS. **A migração 0025 não altera RLS, roles, owners ou ACL das bases.** Owner esperado continua `current_user`: ubuntu no clone/fixture, postgres em produção; não foi mudado para acomodar diferenças.

### Segundo gate conhecido: forma exata de CHECK PG17.6 versus PG17.11

Durante esta tarefa, o pai confirmou que o catálogo produtivo PG17.6 preserva cast do ARRAY inteiro para text[], enquanto o clone reconstruído PG17.11 emite cast text por elemento. Foram confirmadas exatamente estas cinco constraints e valores nesta ordem:

| Tabela / CHECK | Coluna | Valores exatos |
|---|---|---|
| `contas_caixa_tipo_check` | tipo | caixa, banco, digital |
| `contas_pagar_categoria_check` | categoria | aluguel, energia, agua, internet, telefone, salario, imposto, fornecedor, outros |
| `contas_pagar_frequencia_check` | frequencia | mensal, semanal, quinzenal, anual |
| `contas_pagar_status_check` | status | pendente, pago, atrasado, cancelado |
| `transacoes_caixa_tipo_check` | tipo | entrada, saida |

Exemplo das duas definições completas autorizadas:

```sql
CHECK (((status)::text = ANY ((ARRAY['pendente'::character varying, 'pago'::character varying, 'atrasado'::character varying, 'cancelado'::character varying])::text[])))
CHECK (((status)::text = ANY (ARRAY[('pendente'::character varying)::text, ('pago'::character varying)::text, ('atrasado'::character varying)::text, ('cancelado'::character varying)::text])))
```

A baseline CHECK **não foi regravada**. Somente o comparador de constraints CHECK das três bases usa whitelist por **tabela + nome + definição completa**, mapeando a primeira string comprovada para a segunda. Toda string desconhecida volta intacta para a comparação original. Não há regex, parser genérico, tolerância de whitespace, conjunto ampliado, mudança de ordem, coluna, operador ou cast. FKs, demais constraints, tabelas de trilha e todos os outros metadados mantêm igualdade exata. `IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION` permanece obrigatório. RLS true/false alternativo não é aceito; RLS OFF ou FORCE RLS é NO-GO.

O pai alterou separadamente apenas o preflight da 0020 para o mesmo CHECK conhecido; esta tarefa **não escreveu 0020/0021/0022**. O arquivo 0020 passou a ter hash diferente por essa alteração paralela autorizada do pai, mas seus corpos esperados continuam iguais. O manifest final registra a 0020 corrente realmente utilizada nos testes, sem apresentar o hash anterior como atual.

## Integração funcional preservada

A 0025 mantém `despesas_rpc_executar` pelo corpo exato da 0020, exceto uma aquisição do advisory lock `(22022,conta_id)` antes do lock de linha da conta e duas emissões privadas exatas antes dos INSERTs de pagamento/estorno, após validações de conta, livro e proveniência/snapshot original. Wrappers e ACLs são preservados. A ordem compartilhada entre despesas e ciclo é advisory de conta → conta FOR UPDATE → livro. Não foi acrescentado requisito funcional.

`ciclo_guardar` permanece a guarda 0022 salvo declaração e ramo INSERT que consome atomicamente uma capability exata. A capability privada liga xid/pid, ação, conta, owner, despesa com origem 0020 e operação UUID com FK deferred. Compara todos os campos do lançamento, excluindo apenas id gerado, exige categoria despesa e vínculos loan nulos, consome por DELETE na transação, e falhas revertem todas as escritas. Não existe ON CONFLICT para substituir intenção pendente. A overload privada de `ciclo_autorizar` não é executável por PUBLIC/anon/authenticated/service_role. Nenhum GUC, grant interno ou proxy genérico permite fabricar autorização.

**Todo o SQL após o preflight é byte-a-byte idêntico à 0025 anterior de hash `570669255d329d296251e52f6f923e5825b24350cfcfee93575d5f26f42e185c`.** Algoritmo, funções, capability, DDL e permissões não sofreram mudança nesta correção. Testes estruturais continuam comparando as diferenças mínimas com 0020/0022.

Snapshot do loan e cotação continuam válidos após despesa/estorno, pois o snapshot original inclui somente contrato e descendentes, e a despesa tem contrato/parcela nulos. DML manual em conta protegida, UPDATE/DELETE de ledger/loan/parcelas/trilha e mudanças em owner/saldo-base continuam recusados. Não há adoção/reconciliação de legado, regra de saldo suficiente, transferência, ajuste, desconto ou renovação.

## Teste final e evidências

Execução final em **PostgreSQL 17.11 (Ubuntu 17.11-1.pgdg24.04+2)**, usuário local ubuntu, ambiente mínimo `env -i`, binários `/usr/lib/postgresql/17/bin`, socket Unix exclusivo 0700, `listen_addresses=''`, exclusivamente fixtures sintéticas. Nenhum processo acessou produção ou o clone restaurado.

| Suíte final | Resultado | Evidência |
|---|---:|---|
| Coexistência 0020 → 0021 → 0022 → 0025 corrigida | **78 PASS / 0 FAIL** | `/tmp/cobrapro-financial-coexistence-pg17-aPh74i/evidence` |
| Vitest coexistência/despesas/loans/recebimento, 4 arquivos | **29 PASS / 0 FAIL** | `tests/postgres-financial-coexistence/evidence/vitest.log` |
| Encerramento cluster final | **STOP_EXIT=0 / FINAL_STATUS=3** | `tests/postgres-financial-coexistence/evidence/shutdown.log` |
| Baseline integral exceto três bits RLS | **PASS** | teste estrutural + `evidence/known-correction.json` |
| 15 corpos/hashes originais intactos; SQL pós-preflight intacto | **PASS** | teste estrutural + `evidence/known-correction.json` |

Os **68 grupos anteriores foram preservados** e acrescidos de dez: uma prova SQL da whitelist CHECK, três preflights RLS OFF, um FORCE RLS e cinco CHECKs incompatíveis (valores, ordem, operador, coluna, cast). Total: **31 preflights adversariais**, cada qual comprovando rollback DDL integral. O teste SQL de whitelist aceita **10 strings exatas** (duas por CHECK) e recusa **35 variantes desconhecidas**; o teste estrutural fixa a whitelist completa. A aceitação da forma PG17.6 foi exercitada como expressão SQL do mapeamento em PG17.11; **não foi executada instalação em servidor PG17.6 nesta tarefa**.

A suíte cobre fluxos loan-first/expense-first, replay exato e chaves conflitantes, isolamento tenant/conta inativa/livro divergente/legado, ACLs internas negadas, zero escrita parcial em 12 falhas induzidas de despesas/capabilities e sete de recebimento, retry do mesmo UUID, BRT em quatro fusos, quatro corridas com espera real observada, 16 sessões mistas com uma perna por intenção, nove adulterações recusadas, one-shot e caminho SECURITY DEFINER com owner NOSUPERUSER. Capabilities residuais finais: **zero**. Legado sintético e trilhos financeiros/auditoria legados: **inalterados**.

Evidências finais copiadas para `tests/postgres-financial-coexistence/evidence/`: resultados, resumo com versão/gate conhecido, testes, shutdown, manifest de fontes e prova de correção. As regressões históricas preservadas de despesas **47 PASS** e ciclo **13 grupos PASS** pertencem à execução anterior; não foram reexecutadas por esta tarefa. O pai anunciou execução independente da regressão despesas após sua correção 0020, sem resultado reivindicado aqui.

## Hashes finais SHA-256

Estes são os arquivos efetivamente usados no teste final, incluindo 0020 corrente alterada pelo pai:

```text
a6852e4160dcadf21f81029daf231af6d308fab7f8733b3e16769d03923bc452  drizzle/0020_rpc_despesas_prospectivas.sql
08b05165412c8f6259db98d70c8d220c6f99c7a3a6bc7866aa86cc00b0558a82  drizzle/0021_rpc_emprestimos_prospectivos.sql
abce663253f85eafe03d3c4f9a81d601941164bba7ef4d0d8024b892be88f64c  drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql
63c5a3afbf86e7dbd67a726368d0dcac04a51c90200f797f1f9d35af10259199  drizzle/0025_integrar_rpc_despesas_ciclo.sql
ff9481a86f8bafc865ddf9eeaa66ac6ade225cbc4d65b633fe1cfd2f536b5842  tests/postgres-financial-coexistence/baseline.json
2878b29193d439492622c878280546392164aee9bae84fd6f1cb559c8130d5ce  tests/postgres-financial-coexistence/build-migration.py
021e28f520360579794e05d3f40730f1c0f7d779c4a5873c883b786fe6709316  tests/postgres-financial-coexistence/fixture.sql
bcd76a7383d8c455d849bc3b0223db13efb5e3bc01e407ddca8736f8a385f046  tests/postgres-financial-coexistence/validate.mjs
1251f833c8a80e14be8506f3d125a1eba4e38a965f406d3f3e012e606fc37df0  tests/postgres-financial-coexistence/run.sh
4207a02f962a157d9e532f0a39ae899a93abe84e5ee07ebed07fd8e374759811  server/migrations/financialCoexistence.test.ts
```

Os 15 hashes de corpo exatos estão em `evidence/known-correction.json`; entre eles:

```text
2a66afef3714bc03d2e64e0ee338c42fe8eb9c9d6ec24da62df5b3e247f04e54  despesas_rpc_executar 0020
f120151dd3f4de11381b60a15402e05bdcb8187fed1cb40c536a8f1be8d7eb2e  ciclo_guardar 0022
4d0e4fab1cee716b3eca5dbb261f36e47383276b9982dbc2c4629b7917348729  ciclo_autorizar original 0022
5573383b340f3d434d9f68d1b450eddd1d32b1d236a705fc818a57f2ca6333bd  ciclo_snapshot 0022
d7c746affad83bf7200a5fe45577f746e2f16e662215efcdfa10e36915d67ea2  ciclo_validar 0022
da42793f843737e74b52111a9e1db50d15a11f7f5bb1fc23d3257cc4df245d38  rpc_criar_emprestimo 0021
59446e73faf55c1dce25c38d833182bd79f15551b1914550d588736773b6bf4f  rpc_receber_emprestimo_prospectivo 0022
```

## Release gate / bloqueios restantes

**Novo rehearsal no clone RESTAURADO de produção: PENDENTE, pelo pai.** Não se afirma que a correção local resolveu toda possível divergência produtiva. O pai deve ensaiar exatamente a 0025 `63c5a3af…259199` com migrations anteriores compatíveis, owner `current_user` existente, metadados/RLS/ACL reais, comprovar ausência de mutação de linhas existentes, e registrar differences exatas se qualquer novo metadata falhar. Não regenerar baseline para silenciar diferenças; não ampliar whitelist para metadado não demonstrado. Normalização owner ubuntu/postgres já está contemplada e não deve ser alterada.

NO-GO se ocorrer qualquer corpo/hash/assinatura/default/owner/ACL/trigger/schema/index/policy divergente, RLS base desligado ou forçado, CHECK fora das cinco strings autorizadas, role backend superuser/membro do owner, capability residual/homônima, writer concorrente fora do protocolo ou necessidade de adotar/mutar legado. Escritores monolíticos e financeiro legado devem continuar bloqueados/flag off; nenhuma configuração operacional foi alterada por esta tarefa.

0025 é one-shot; retentativa somente após rollback da instalação abortada. Reaplicar 0020 depois de 0025 é NO-GO: restauraria a função anterior. Aprovação DDL, deploy, UI e flags é separada do gate sintético. PostgREST/rede, failover/replicação, DDL concorrente e DBA/superuser malicioso estão fora desta certificação.

**Escopo de escrita desta tarefa:** somente 0025, `tests/postgres-financial-coexistence/*`, `server/migrations/financialCoexistence.test.ts` e este relatório. Nenhuma escrita em 0020/0021/0022, produção, clone restaurado, MCP, browser, env, UI, router, commit ou registros financeiros não sintéticos.
