# WhatsApp operacional — PostgreSQL 17 privado

Execute, sem serviços externos:

```bash
cd /home/ubuntu/cobrapro
bash tests/postgres-whatsapp-safe/run.sh
```

O executor cria um cluster descartável PostgreSQL 17.11 com `listen_addresses=''`, socket em diretório exclusivo com permissão 0700 e segredos remotos vazios. O trap encerra o cluster e remove dados, socket e bundles, inclusive em caso de falha. Nenhuma migration é aplicada ao banco produtivo. A migration local 0012 é usada somente para reproduzir a restrição NOT NULL e o índice parcial reais no cluster de teste.

Os módulos TypeScript reais do worker, provedor, helper, roteador tRPC e webhook são empacotados com esbuild. Somente a obtenção do cliente de banco é substituída por adapter de SQL parametrizado contra o socket privado; `fetch` é inteiramente simulado e rejeita qualquer URL fora de `https://evolution.invalid/`. Os dados e IDs são sintéticos.

Os 40 cenários cobrem: 23502 e 42P10 reproduzidos; terminais não nulos; falha de rede, timeout, HTTP 500 e resposta sem ID depois do POST; falha de persistência e compensação; não reenvio; prova durável de recebimento via RPC nas três fontes autorizadas; confirmação tRPC por tenant; dois workers; 30 callbacks concorrentes; callback durante histórico do worker; autenticação HTTP e retry 503; baixa/desativação/propriedade/data revalidadas; lease perdido durante GET; isolamento de telefone inválido no produtor/consumidor; dry-run sem DML nem provider; catch-up diário com dedup/fim BRT; normalização DDD 55; preservação de QR por GET.

O teste `server/services/notificacoes.operational.test.ts` complementa o adapter: usa **o Supabase SDK real**, com fetch simulado, para verificar os métodos e filtros PostgREST do insert + lookup 23505 + PATCH CAS. Não há `on_conflict` para o índice parcial; body de histórico não inclui telefone ou mensagem. O adapter privado não substitui validação de uma instância real de PostgREST nem contrato de entrega do provedor.

A referência `notificacoes.confirmarPagamento({ fonte, operacaoId })` é uma entrada autenticada disponível, mas o teste não acrescenta uma chamada nos fluxos financeiros da aplicação. Quem integrar confirmação pós-baixa deve invocar essa entrada ou `enfileirarConfirmacaoPagamento(userId, fonte, operacaoId)` somente após o retorno financeiro confirmado; a função reconsulta a prova durável e deduplica pela operação. Não derive o aviso da data de vencimento e não desbloqueie guards financeiros.

O fixture extrai exclusivamente `legados_prova_pagamento(integer,text,uuid)` da 0034, sem instalar os writers financeiros neste runner. O adapter executa essa RPC como `service_role` não-superuser e sem BYPASSRLS, e proíbe `.from()` de tabelas privadas de operação/pernas. O Caixa não possui `cliente_id`; o vínculo opcional `operacao_financeira_id` existe neste fixture exclusivamente para testar a fonte 0015 com auditoria explícita. A suíte `tests/postgres-legados/run.sh` também prova o schema de produção sem ambas as colunas e usa operações ciclo/legado criadas pelas RPCs financeiras reais.

O helper devolve `valor` como string decimal exata, cinco campos canônicos somente, `null` para ausência e erro sanitizado para indisponibilidade. `legados_operacoes` é suportada internamente pelo helper/chave/worker; este escopo não amplia o enum do roteador tRPC nem integra disparo automático pós-pagamento.
