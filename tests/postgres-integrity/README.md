# Regressão PostgreSQL real — integridade e revogação

Execute `bash tests/postgres-integrity/run.sh` com PostgreSQL 16 instalado e usuário não root. O runner usa somente um cluster descartável próprio em `/tmp`, socket Unix exclusivo com permissão 0700, TCP desativado, ambiente limpo e `trap` de encerramento. Não carrega dotenv, não usa DATABASE_URL nem Supabase, não envia e-mail/WhatsApp e não toca em contas reais.

As migrations lidas são **as atuais do repositório**: 0014, 0016 e 0017. Todas são executadas duas vezes, em transação. O fixture usa a definição histórica PostgreSQL 0009 de assinaturas e um contrato mínimo explícito para Kiwify, cuja tabela não está declarada no schema Drizzle atual. Não é um dump nem prova de compatibilidade produtiva.

A suíte cobre tenant, cliente e Caixa nas FKs, competências únicas, consumo e expiração de token, versão incrementada apenas com mudança real da hash, parâmetros, papéis sem privilégios, RPC service_role sem UPDATE direto, rollback de catálogo e dados, nomes camelCase/snake_case e duas corridas reais com espera por lock observada. Regressões específicas impedem o retorno de: erro 42710 na reaplicação da 0014; versão legada nullable; índice único Kiwify homônimo na coluna errada; relação de outro tipo com o nome do índice; e pedidos futuros NULL/vazios.

Os logs mostram SQLSTATE, resultados e encerramento, em diretório impresso pelo runner, fora do repositório. O teste não habilita flags da aplicação, não valida PostgREST, RLS/grants de produção, tráfego externo, saldos históricos ou carga prolongada. Complemente com inventário, backup e preflight no Supabase correto antes de qualquer rollout produtivo.
