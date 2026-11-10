# Blacklist vinculada à assinatura Kiwify — 10/11/2026

## Regra autorizada

Todos os emails cadastrados são usuários do CobraPro, mas acesso à Blacklist requer assinatura CobraPro vigente e comprovada na Kiwify. Cadastro, papel admin, concessão manual e acesso vitalício não servem como comprovação. As tabelas `assinaturas` do módulo financeiro dos clientes não representam a assinatura SaaS.

## Implementação preparada e validada

- Migration `0027_kiwify_assinaturas_blacklist.sql`: allowlist explícita de produtos, estado de assinatura e ledger append-only de eventos; RPCs restritas ao backend, RLS e ACL sem acesso direto do frontend. Não adota nem modifica dados legados.
- OAuth HTTPS e GET /sales/{order_id} verificam pagamento, produto e comprador. Credencial real dedicada confirmou exclusivamente o scope `sales`, sem reembolso ou financeiro. A resposta real usa `scope: ["sales"]`; cliente e regressões reconhecem esse array e a string documentada sem admitir estruturas inválidas.
- Webhook integra o runtime somente depois do HMAC dos bytes crus, quando `ENABLE_KIWIFY_SUBSCRIPTIONS=true`. Nesse ramo não existe fallback para criação antiga, envio de convite ou tabela ausente `kiwify_webhooks`.
- Gate da Blacklist verifica a fonte Kiwify exata e período finito em cada operação, inclusive download de fotos. Sem elegibilidade confiável, falha fechado.
- Renovação válida estende o período; refund/chargeback revogam acesso. Reentrega, eventos atrasados e conflitos de identidade não concedem acesso indevido.

## Evidências

Suíte completa: **1.496 testes aprovados**, 11 testes opt-in ignorados; 108 arquivos aprovados e 3 ignorados. TypeScript e build aprovados. Runner PostgreSQL 17: **33 grupos aprovados**. Ensaio na cópia privada restaurada: **4.117 linhas legadas comparadas e intactas**, ACL/RLS preservadas; cluster local encerrado. Esse ensaio usa o snapshot preservado de aplicação e não substitui backup integral atual de Supabase Auth/Storage.

Consulta produtiva de catálogo confirmou o projeto `oxvtmibrgjruldkouhhb`, users INTEGER/VARCHAR(320), RLS e zero tabelas diretamente expostas ao frontend. As tabelas novas da 0027 **ainda não foram instaladas em produção**.

## Bloqueio real de ativação

Na conta Kiwify autenticada, a tela de Assinaturas apresenta **0 assinaturas ativas**. Consulta autenticada do produto principal Cobra Pro (`cbf32810-2ba3-11f1-a38c-f16a4fcb38b5`), período 2026-08-14 a 2026-11-10, trouxe HTTP 200 e zero vendas. Existe webhook CobraPro no destino correto, mas seus logs dos últimos 7 dias não apresentam entregas.

Essas respostas não autorizam classificar usuários existentes como assinantes. Precisamos confirmar se os pagamentos estão nessa conta/produto ou em outra conta/produto. OAuth válido e venda de teste fictícia não comprovam assinatura real.

## Próximos passos coordenados

1. Confirmar conta/produto que contém os compradores e a vigência atual, sem conceder acesso por inferência.
2. Instalar a 0027 aditiva, verificar RPCs/grants e habilitar apenas produtos aprovados.
3. Configurar credenciais secretas no backend e eventos Kiwify necessários, preservando integrações dos outros produtos.
4. Conferir publicação DigitalOcean e somente então ativar a integração e o módulo privado de Blacklist.
5. Validar um evento real autenticado de assinatura vigente e a revalidação por acesso, sem criar cobrança ou reembolso para teste.

Nenhuma senha, comprador, saldo, parcela, transação de Caixa, cobrança, refund ou chargeback foi alterado neste lote. As flags de processamento Kiwify e Blacklist não foram habilitadas. Os fluxos financeiros prospectivos já publicados anteriormente não foram modificados. A criação antiga de conta/convite via Kiwify continua pendência separada; a tabela antiga está ausente, e a integração nova não deve esconder esse fato.

## Fontes operacionais

- https://dashboard.kiwify.com.br/products/edit/cbf32810-2ba3-11f1-a38c-f16a4fcb38b5
- https://dashboard.kiwify.com.br/subscriptions
- https://dashboard.kiwify.com.br/apps/webhooks/integrations
- POST https://public-api.kiwify.com/v1/oauth/token e GET /v1/sales autenticados (respostas privadas fora do Git).
