# Recebimento legado validado — PostgreSQL17 local

Execute na raiz do projeto:

```sh
env -i PATH=/home/ubuntu/.nvm/versions/node/v22.13.0/bin:/usr/bin:/bin HOME=/home/ubuntu LANG=C.UTF-8 /bin/bash tests/postgres-legados/run.sh
```

O runner cria PostgreSQL17 em diretório temporário e Unix socket privado (TCP desabilitado), com ambiente sem dotenv/URLs remotas. Copia fixture sintético dos metadados físicos de `tests/postgres-loans/fixture.sql`; não contém registros produtivos. Instala 0021/0022 **somente no fixture**, depois 0034 duas vezes. Não instala 0013/0015. O trap encerra o cluster e imprime status de parada.

A suíte cobre prova before/after, original/pago NULL conservador, conta-base negativa intacta, valores strings exatos, ledger por vínculo, owners/aliases/descendentes, encargos não zero/NULL, idempotência, cotação stale, cohort, ACL, falhas em cada etapa e cada consumo/reserva de capability, adulteração silenciosa de trigger, contenção real em `pg_stat_activity`, inserts-fantasma, metadata fail-closed, instalação homônima e sem metadata. Logs e hashes ficam em `$ROOT/evidence`.

O recorte implementado é mensal/mensal, integral, sem recálculo e sem renovação. Todos os descendentes devem ser virgens ou pagos exatamente conciliados; histórico de pagamento anterior sem prova da nova operação é recusado. Livro de conta com lançamento avulso sem vínculo é recusado. Este recorte não certifica todos os legados nem autoriza deploy.

Novo gate do backend: `ENABLE_RPC_RECEBIMENTO_LEGADO_VALIDADO=true` somente após revisão e autorização específica. Pai registra `recebimentosLegadosRouter` em `appRouter` e integra `ParcelaLegadaReceber`, passando uma conta escolhida explicitamente. Não habilitar flags antigas ou chamar RPCs antigas como fallback.

O runner mantém intactos os 40 cenários de `validate.mjs` e executa depois a suíte adicional `prova.mjs`. Esta cria operações ciclo/legado pelas RPCs reais e consulta exclusivamente o leitor STABLE SECURITY DEFINER `legados_prova_pagamento(integer,text,uuid)` como `service_role` não-superuser, sem BYPASSRLS e sem SELECT privado. Seu owner é `postgres`, criado somente no cluster sintético; EXECUTE é reservado a owner/service e search_path é fixo.

Os testes adicionais validam cinco campos mínimos, decimal string exato, tenant/contrato/cliente/conta, operação/fonte/resultado, perna e auditoria duráveis, tipo/categoria Caixa e igualdade de valor/data, erro de banco fail-closed, rejeição de renovação e ausência da 0015. O schema principal não possui `transacoes_caixa.cliente_id` nem `operacao_financeira_id`; vínculo opcional 0015 é testado dentro de transação revertida com auditoria explícita, sem instalar 0015 ou inferir pagamentos. Corrupções adversariais são injetadas só no fixture dentro de transação revertida; constraints permanecem ativas e nenhum guard financeiro da migration é relaxado.
