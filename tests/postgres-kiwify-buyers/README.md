# Compradores Kiwify — validação PostgreSQL 17 local

Execute `bash tests/postgres-kiwify-buyers/run.sh` na raiz do projeto. O runner cria um cluster PG17 descartável com socket Unix, `listen_addresses=''`, ambiente limpo, dados exclusivamente sintéticos e encerramento obrigatório. Não lê `.env`, backups, PII ou credenciais e não usa banco remoto. Nenhuma instalação automática é feita.

O fixture reproduz os tipos e defaults do catálogo produtivo informados pelo responsável, inclusive `passwordHash VARCHAR(255)`, `session_version INTEGER`, `password_resets.used BOOLEAN`, timestamps com fuso, RLS e defaults ACL do Supabase PG17 (incluindo MAINTAIN). A execução aplica 0027 e 0028 apenas nesse cluster e reaplica 0028 sem reparação de drift.

Os 22 grupos de verificações cobrem transação user/ledger/vínculo, contas manuais inalteradas, email normalizado com LIMIT 2, estados de convite, tokens hash-only com TTL de uma hora, rollback, DTOs estritos, ACL/RLS, homônimos, drift e sessões PostgreSQL concorrentes. Há seis chamadas concorrentes para o mesmo pedido, quatro claims concorrentes, três pedidos para o mesmo email e casos de corrida com INSERT REST.

A concorrência é garantida entre as RPCs e diante de INSERT/UPDATE que já tenham obtido o lock de tabela. **Não há promessa de unicidade global contra cadastro REST com SELECT antigo:** esse cadastro pode inserir uma variante de email depois do commit da RPC. Nenhum índice normalized/global, backfill ou mudança no lifecycle público é criado. A verificação LIMIT 2 do runtime continua negando acesso diante dessa ambiguidade, e replay/claim também falham fechado.

Os logs sintéticos e `results.json` são preservados em `evidence/`; esses logs não contêm compradores reais. O cluster/socket são removidos após `STOP_EXIT=0`.
