# Caixa: leitura completa e precisão em centavos

Status: implementação local em integração; ainda não publicada neste segundo lote operacional de 10/11.

O cálculo compartilhado passou a acumular centavos com `BigInt`. A versão decimal transporta o saldo como texto exato, inclusive quando os acumulados são grandes. A API numérica existente só retorna quando o valor final pode fazer round-trip em centavos; entradas inválidas e resultados não representáveis não são convertidos em zero nem arredondados silenciosamente. Despesas e estornos de igual valor conservam o saldo independentemente da ordem, sem alterar lançamentos.

A consulta `caixa.contas` não apresenta falha de banco como lista vazia. Seleciona apenas os campos utilizados das contas pertencentes ao usuário autenticado e confirma sua titularidade antes de consultar o livro. O livro é lido por IDs dessas contas, ordenado pelo ID e paginado; vínculos externos ou nulos são recusados, não omitidos para fabricar saldo. O endpoint recusa consulta incompleta, valor inválido ou leitura acima do limite de segurança. Não atualiza saldo-base, owner ou lançamento.

`caixa.transacoes` também propaga falhas de consulta e exige confirmação das contas dos lançamentos. O limite da listagem não é usado como base do saldo ou do relatório agregado.

## Evidências locais

- 4 arquivos e 24 testes de soma/estorno aprovados em `/tmp/cobrapro-nov10-caixa-exact-tests.log`.
- Endpoint real com Supabase simulado: 12 testes aprovados em `/tmp/cobrapro-nov10-caixa-queries-tests.log`, incluindo paginação, erro posterior, vazio confirmado, conta externa e valores inválidos.
- Não houve consulta de registros pessoais nestes testes ou DML financeiro em produção.

## Complemento do cadastro de clientes

O lote de clientes corrigiu limpeza explícita de opcionais, ativo/inativo, busca por documento/telefone sem dependência de máscara e confirmação de exatamente uma linha alterada no tenant. Novos documentos no campo CPF/CNPJ são normalizados e têm dígitos verificadores validados; dados antigos omitidos ou intocados não são revalidados nem reescritos. O importador CSV legado permanece fora deste recorte. Os testes do complemento (UI, router, documentos e isolamento) aprovaram 131 casos em 5 arquivos, em `/tmp/cobrapro-nov10-clientes-final-tests.log`.

O build, a suíte completa e o smoke de produção devem ser concluídos com todas as frentes integradas antes de declarar este lote entregue.
