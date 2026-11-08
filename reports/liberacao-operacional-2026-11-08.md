# CobraPro — liberação operacional de 8/11/2026

**Estado às 9h55 BRT:** DDL instalada e ciclo SQL sintético aprovado; checkpoint, push, deploy e habilitação ainda em conclusão. Não é certificação financeira global. Supabase autorizado `oxvtmibrgjruldkouhhb`, calendário `America/Sao_Paulo`. Nenhuma correção histórica automática foi executada.

## Preservação e testes

- [x] Snapshot privado consistente de 8/11 às 9h11min58s: 29 tabelas e 4.117 linhas da aplicação.
- [x] Duas restaurações locais PostgreSQL 17.11, uma SQL e outra dump custom, com comparação integral e preservação ACL/RLS.
- [x] Ensaio final das 0019/0020/0021/0022/0023/0024/0025 no snapshot restaurado: 4.117 linhas antigas idênticas após cada migration; cluster encerrado corretamente.
- [x] Vitest final: **1.091 testes aprovados**, 11 ignorados opt-in; 104 arquivos aprovados e 3 ignorados. Os ignorados não são certificados como integração live.
- [x] TypeScript e build final aprovados; diff sem erros de whitespace.
- [x] PostgreSQL específico: despesas 47 verificações; criação/ciclo 13 grupos cada; coexistência final 78 verificações; onboarding 46; Blacklist-base 21 e acesso 14. Testes sintéticos e clusters locais sem TCP, shutdown conferido.
- [ ] Cópia privada durável fora do sandbox e retenção.
- [ ] Backup completo dos schemas gerenciados Auth/Storage e bytes dos objetos. O backup de public não cobre esses componentes.

Arquivos privados de backup, smoke e respostas de integração ficam fora do Git. Não publicar dumps, tokens, hashes de senha ou dados de clientes.

## Instalação produtiva comprovada

Instaladas via Supabase: 0019 base Blacklist; 0020 despesas prospectivas; 0021 criação mensal simples; 0022 ciclo prospectivo; 0023 concessões Blacklist; 0024 onboarding; 0025 coexistência; 0026 congelamento transitório da Blacklist.

O primeiro preflight 0020 recusou uma representação equivalente dos CHECKs produtivos. A transação abortou, sem instalação parcial. O código foi corrigido para aceitar apenas a string do modelo ou a string completa comprovada do mesmo cast ARRAY varchar para text[], com as mesmas colunas/valores/operador; checks divergentes continuam recusados. A primeira 0025 no clone recusou RLS false do fixture: o baseline foi corrigido para **exigir true**, como a contenção produtiva 0018. Outras diferenças não foram aceitas automaticamente. Ensaio final e instalação real aprovaram a versão corrigida.

Hash 0025 instalado: `63c5a3afbf86e7dbd67a726368d0dcac04a51c90200f797f1f9d35af10259199`. Não reaplicar 0020 depois de 0025: isso restauraria o corpo anterior sem coexistência.

Pós-DDL: zero tabelas públicas sem RLS, zero acessíveis diretamente por anon/authenticated. Operações financeiras novas e capacidades privadas permaneciam vazias antes do smoke. `/api/health` e Evolution HTTP 200. Nenhum token ou senha foi alterado e a revogação de sessões não foi habilitada.

## Smoke SQL produtivo, segregado e revertido

Às 9h55, sob role service_role e transação explícita, foram exercitados usuário/cliente/conta sintéticos sem contato, onboarding e replay, criação mensal e replay, despesa/pagamento e replay, recebimento parcial e replay, quitação e estorno e replay na mesma conta. Asserções conferiram saldo-base intacto, saldo líquido calculado, cinco pernas sem duplicação, residual zero, contrato quitado e ausência de multa/mora antes da virada BRT.

**ROLLBACK obrigatório executado.** Resultado `SMOKE_SQL_ROLLBACK_OK`: zero usuários de teste persistidos, zero operações novas de despesa/criação/recebimento persistidas, zero capacidades privadas. Nenhuma comunicação externa. Isso comprova o trilho SQL e permissões produtivas; não substitui o smoke do backend HTTP e interface depois do deploy.

## Recorte de disponibilidade

**Despesas novas:** criar/pagar/estornar só por RPC, UUID e payload duráveis, dinheiro exato, calendário BRT, tenant do contexto e auditoria. Legado não é adotado automaticamente. Edição, exclusão, cancelamento, recorrência e sincronização livre ficam bloqueados.

**Empréstimos novos:** mensal simples de 1 a 60 parcelas, com agenda explícita, desembolso e recebimento na conta original, parcial sem desconto e quitação. Criação e ciclo precisam de flags conjuntas. Defaults SQL explicitamente exibidos: multa única 2% e mora simples 0,033% por dia após a virada BRT; não prometer configurabilidade adicional inexistente. Despesa legítima na mesma conta é autorizada pela 0025 por capacidade privada single-use da linha exata; INSERT manual e UPDATE/DELETE de ledger e saldo-base continuam protegidos.

**Legado/renovação:** consultas e conferência mantidas. Seis parcelas com vínculos incompletos, duplicidade latente 247/279, 12 lançamentos com proprietário divergente, 18 diferenças parcela/Caixa e três residuais inválidos precisam de proposta/aprovação individual. Renovação tem convenções conflitantes de capital/juros/agenda e permanece bloqueada. Não converter diferença líquida em ajuste de Caixa. Price, diário, semanal, quinzenal, bullet, vendas, cheques e reparcelamento não são liberados por este ciclo.

**Blacklist:** base e concessões instaladas, mas vazias. Enquanto o backend anterior está live, 0026 revoga escrita e exclusão da Blacklist/fotos para impedir uso do armazenamento público anterior. Reabertura somente com backend privado live, bucket privado confirmado, ausência de policies Storage públicas e lista paga/vitalícia autorizada. Não usar o módulo de assinaturas financeiras dos clientes como prova de assinatura SaaS. Nenhuma concessão automática; flag desligada.

## Gates de publicação ainda em conclusão

- [ ] Checkpoint e GitHub por push normal, sem force-push.
- [ ] Deploy DigitalOcean na revisão exata, smoke autenticado e casts PostgREST conferidos.
- [ ] Configurar apenas flags prospectivas comprovadas; legado e session revocation desligados.
- [ ] Revalidar capacidades e apresentação na interface, sem registrar dívida real para teste.
- [ ] Concessões e Storage Blacklist antes de abrir o módulo.

## Pendências externas

DigitalOcean informa US$ 36 em atraso e prazo de 14/11 para evitar suspensão; nenhum pagamento iniciado. Lista de assinantes para Blacklist solicitada, sem aprovação por silêncio. Kiwify permanece por último.
