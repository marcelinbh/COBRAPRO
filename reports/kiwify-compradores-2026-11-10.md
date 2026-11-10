# Cadastro seguro de compradores Kiwify — 10/11/2026

## Regra e contexto confirmados

Às 14h55 BRT o usuário esclareceu que todos os clientes atuais foram cadastrados manualmente e que futuras vendas serão feitas pela Kiwify. Isso explica o painel sem assinaturas/vendas e elimina a necessidade de procurar outra conta para a base atual. A regra de Blacklist permanece: somente assinatura CobraPro vigente na Kiwify; cadastro, papel admin e usuário manual não equivalem a vigência. Não foram concedidos direitos manuais nem alteradas senhas de usuários existentes.

Produto principal verificado: Cobra Pro, `cbf32810-2ba3-11f1-a38c-f16a4fcb38b5`, com planos recorrentes. Outros produtos não foram incluídos por semelhança de nome. Preços/planos/cobranças foram preservados.

## Correções integradas

O webhook mantém HMAC-SHA1 sobre bytes crus e só processa pelo novo runtime quando `ENABLE_KIWIFY_SUBSCRIPTIONS=true`. Depois de GET /sales/{order_id} autenticado, valida email da API, produto permitido, status paid e período completo da assinatura antes da criação. Evento fictício do botão Testar Webhook, pix/boleto gerado, recusa, venda de outro produto, API indisponível/404 ou positivo malformado não criam conta nem acesso.

A migration 0028 cria vínculo imutável pedido/assinatura/produto/usuário/email e RPCs de provisionamento, claim e conclusão de convite. Criação de usuário, consumo de assinatura e intenção de convite ficam na mesma transação. Conta nova recebe role=user e hash bcrypt de senha aleatória; usa link individual de definição de senha, não senha comum. Conta manual de email único é associada preservando usuário inteiro, sem novo hash/reset/convite. Email ambíguo por case/trim falha fechado.

O claim CAS insere hash SHA256 em password_resets (`used=false`, prazo de uma hora) antes do POST de e-mail. `accepted` é aceite do provedor, não entrega na caixa postal. `sending`/`unknown`/`blocked` não provocam reenvio automático; somente rejeição comprovadamente retryable permite nova tentativa com token novo e mesmo usuário. Não existe worker novo, cron ou alegação de entrega real.

A instalação 0027 foi corrigida para revogar os defaults Supabase conhecidos somente das tabelas recém-criadas; reaplicação continua recusando drift, grants desconhecidos e catálogo incompatível, sem repará-los silenciosamente. Tabelas novas têm RLS sem policies e sem acesso direto de anon/authenticated/service_role. RPCs SECURITY DEFINER com search_path=pg_catalog e execute somente owner/service_role.

## Validação

| Verificação | Resultado comprovado |
|---|---|
| Vitest integrado completo | 1.574 aprovados, 11 opt-in ignorados; 110 arquivos aprovados e 3 ignorados |
| Vitest Kiwify conjunto | 446/446 aprovados em nove arquivos |
| PostgreSQL 17 — assinatura | 39 grupos aprovados em cada uma de duas execuções independentes |
| PostgreSQL 17 — compradores | 22 grupos aprovados; concorrência real same-order/email/claim e reaplicação 2x |
| TypeScript e build integrados | Aprovados, exit 0 |
| Ensaio 0027+0028 no snapshot real preservado | 4.117 linhas legadas comparadas e intactas após cada migration; defaults Supabase incluídos; ACL/RLS mantidos |
| Encerramento dos clusters locais | STOP_EXIT=0; sem TCP |
| git diff --check | Aprovado |

O snapshot usado no ensaio é o backup privado de aplicação capturado em 08/11 e restaurado em duas bases. Não é snapshot integral atual de Supabase Auth/Storage nem cópia dos bytes de objetos; retenção externa permanece pendente. O ensaio comprova compatibilidade lógica do schema preservado, não entrega de compra real.

## Instalação produtiva confirmada

Em 10/11, 15h19–15h20 BRT, foram instaladas **somente 0027 e 0028** via Supabase apply_migration, projeto `oxvtmibrgjruldkouhhb`, respostas success=true verificadas separadamente. 0013/0014/0015/0017 permaneceram não aplicadas; guards financeiros antigos e WhatsApp não foram alterados.

Hashes dos arquivos instalados:

- 0027: `b9ceace0f74b36a3bd661d27be01e90d9311adb11f7f9eccca94c949b55bfc30`.
- 0028: `c10aed0be145bbd210819ae604bb7d3a7847038f8485361766acfd992e8c9dec`.

Catálogo pré/pós: 14 usuários, 3 resets, 1.235 parcelas e 1.152 transações Caixa. Nenhum comprador, evento ou assinatura foi criado. Sete RPCs novas confirmadas com execute apenas service_role/owner; zero tabelas públicas sem RLS ou acessíveis por anon/authenticated. SELECT service_role de users(id,email) confirmado. Health público continuou HTTP200, ok=true. Nenhum token real foi usado para reset, nenhuma conta/assinatura fictícia ou comunicação externa foi disparada.

Às 15h21 BRT, apenas o produto principal confirmado foi inserido na allowlist de banco com enabled=true. A tabela era vazia; não foi alterado produto existente ou atribuído direito a qualquer usuário. A allowlist do backend deve conter o mesmo ID antes de habilitar o runtime. Instalação e allowlist sozinhas não ativam a integração.

## Bloqueios de ativação restantes

O webhook existente do produto CobraPro aponta ao destino correto, mas a inspeção do formulário mostrou apenas **Compra aprovada** selecionada. Renovação, atraso, cancelamento, reembolso e chargeback devem ser configurados para refletir a vigência. Inspeção não salvou alteração e não enviou teste. Os webhooks de outros produtos permanecem intocados.

Login DigitalOcean expirou. É necessário entrar no painel para conferir a revisão live, inserir credenciais Kiwify secretas somente no runtime backend e ativar o processamento após o deploy. Token webhook deve coincidir com a configuração real da Kiwify; API dedicada exige client_id/client_secret/account_id e allowlist JSON do produto, sem wildcard. Credenciais estão preservadas em diretório privado fora do Git; jamais anexar seus arquivos ou copiá-las para frontend/relatórios.

A Blacklist privada continua sem ativação; o freeze transitório 0026 precisa ser reaberto com grants mínimos somente depois de confirmar o backend privado e a validação Kiwify live. Nenhum usuário manual ganhou acesso por inferência.

Não declarar futuras vendas plenamente operacionais até: implantação correta, configuração runtime, gatilhos completos, teste de rejeição sem escrita e primeiro pedido real com GET paid, convite/entrega confirmados, reset consumido e vigência verificada. Comprar/reembolsar para teste ou reenviar evento real requer avaliação separada; não foi feito neste lote.

## Limites conhecidos

O lock curto serializa as RPCs e observa INSERT REST que já adquiriu lock, mas não fornece unicidade global a todo cadastro REST que pré-consultou email e insira depois uma variante case/trim. Essa corrida está reproduzida; replay/claim/gate LIMIT2 negam identidade ambígua. Não foi alterado authRoutes nem criado índice normalized unique/backfill global. Convite expirar após sending/unknown/accepted não reabre envio automaticamente e exige recuperação responsável.

A API pública da Kiwify consulta estado da venda, não fornece endpoint de assinatura atual. A vigência vem do webhook assinado, é avaliada pelo tempo em cada acesso e depende de entregas completas de cancelamento/atraso/renovação. O ramo legado com flag desligada continua pendente e usa kiwify_webhooks ausente; não contar com ele para entregar novas vendas.
