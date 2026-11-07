# Contenção de acesso direto às tabelas

Execute `bash tests/postgres-access/run.sh` como usuário não root com PostgreSQL instalado. O runner cria um cluster sintético temporário acessível apenas por socket local, sem ler dotenv ou usar qualquer URL produtiva.

A migration 0018 é executada duas vezes. As asserções comprovam RLS, revogação de ACLs públicas inclusive na presença de política permissiva, preservação de linhas e valores e leitura/escrita pelo backend service_role. O cluster é encerrado no trap de saída. Os logs ficam no diretório de evidências indicado pelo runner.

O teste não comprova rotação de segredos nem disponibilidade de todos os fluxos em produção; estes exigem verificação posterior própria.
