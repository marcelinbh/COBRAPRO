# Blacklist — assinantes manuais vitalícios

## Autorização atual

Em 10/11/2026 às 17h32 BRT, o proprietário esclareceu que os assinantes atuais são manuais e vitalícios e autorizou acesso à Blacklist. Também determinou não alterar Kiwify nem ofertas comerciais. Essa autorização substitui a exigência anterior de fonte exclusivamente Kiwify para essas contas atuais; não autoriza abrir acesso a novos cadastros automaticamente.

## Implementação

A fonte manual lê exclusivamente a concessão auditada da tabela `blacklist_access_grants`, filtrada pelo ID da sessão e limitada a uma linha. Exige status ativo, data UTC real já iniciada, `lifetime=true`, fim nulo, concessor existente e evidência exata do proprietário. Não há inferência por cadastro, e-mail, role admin, loginMethod, campo do navegador ou variável pública.

Foram concedidos 14 acessos vitalícios às contas já existentes, por snapshot explícito dos IDs, com `granted_by` do administrador autorizado. A inserção gerou 14 registros automáticos na auditoria existente. Não foi criado trigger para dar acesso a usuários futuros e nenhum privilégio público foi ampliado.

A leitura é refeita a cada operação e após IO de Storage. Suspensão/revogação manual é autoritativa e não é contornada por fallback. Contas sem concessão continuam pelo gate já existente, sem alterações externas da Kiwify. Fotos continuam privadas, sem URLs públicas nem redirecionamentos.

## Evidência de banco

Consulta após a concessão: 14 grants ativos vitalícios; 14 auditorias de INSERT; 14 usuários; 1.235 parcelas. `anon` e `authenticated` continuam sem SELECT/INSERT/UPDATE/DELETE direto na Blacklist. Não houve alteração em saldo, Caixa, clientes, contratos ou parcelas.

## Validação

174 testes direcionados de gate, fonte manual, HTTP de fotos e ownership/storage aprovados. Suíte integrada: 1.629 testes aprovados e 11 testes live opt-in ignorados. TypeScript, build e diff íntegros. Implantação do backend segue na etapa de publicação; a concessão no banco por si não prova que o backend anterior já aceite os vitalícios.

## Fora do escopo

Não alterar API, credenciais, webhooks, preço, oferta, cobrança ou configuração externa da Kiwify. Não manipular dados financeiros legados. Não declarar que todos os fluxos estão 100% liberados: a auditoria operacional independente está em curso.
