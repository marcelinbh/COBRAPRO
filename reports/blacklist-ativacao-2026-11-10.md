# Blacklist e Kiwify — ativação coordenada de 10/11/2026

## Regra autorizada

As contas atuais são manuais. Cadastro, papel de administrador, concessão manual ou compra única não comprovam assinatura vigente. O acesso compartilhado à Blacklist exige período pago vigente verificado na Kiwify, revalidado em cada consulta, alteração e download de foto. Não foi concedido acesso em lote nem alterada senha de usuário existente.

## Segurança estrutural instalada

A migration **0030** foi aplicada exclusivamente no Supabase COBRA PRO (`oxvtmibrgjruldkouhhb`) às 15h47 BRT. O catálogo anterior continha apenas PK/FK em `blacklist_fotos`. O novo CHECK validado `private_storage_path` limita a referência ao bucket privado e à chave UUIDv4/autor/pai.ext. Não altera linhas ou ACLs.

A migration **0029** foi aplicada às **16h09 BRT**, depois de confirmar o backend privado `d458e684d574b56aac3e6c7c73c88b133acaa29d` live e o smoke HMAC aprovado. Depende da 0030, do schema/ACLs exatos e do bucket privado de 2 MiB com JPEG/PNG/WebP. O ACK de revisão é uma declaração do operador; não prova vigência de um cliente.

O pós-DDL confirmou exatamente os privilégios necessários:

| Tabela | Backend (service_role) | anon / authenticated |
|---|---|---|
| blacklist | SELECT, INSERT, UPDATE, DELETE | Sem acesso direto |
| blacklist_fotos | SELECT, INSERT, DELETE; sem UPDATE | Sem acesso direto |

RLS permanece ativo; não foram criadas policies públicas ou concessões de assinatura. A execução da exclusão protegida foi liberada exclusivamente ao backend. Nenhum registro de Blacklist, foto, comprador ou assinatura foi criado na instalação.

A ordem de dependência é **0019 → 0023 → 0026 → 0027/0028 → 0030 → 0029**; não basta seguir a ordem numérica.

## Validação

- **58 checks PostgreSQL 17 aprovados**, TCP desabilitado e encerramento confirmado (`STOP_EXIT=0`).
- **260 testes em 8 arquivos** na configuração isolada aprovados, cobrindo primeira aplicação/reaplicação, drift e referências privadas.
- Suíte integral: **1.574 testes aprovados**, 11 testes de integração opt-in ignorados; 110 arquivos aprovados e 3 ignorados.
- TypeScript, build e `git diff --check` aprovados.

Fontes reproduzíveis e hashes finais constam no manifesto do runner. Logs, snapshots e credenciais permanecem fora do Git. Testes locais não substituem uma venda real nem comprovam entrega de e-mail.

## Integração externa confirmada

As credenciais de leitura de vendas Kiwify foram instaladas cifradas e exclusivamente no runtime do serviço web. Produto permitido limitado ao CobraPro identificado no painel. `ENABLE_KIWIFY_SUBSCRIPTIONS=true` foi salvo às 15h37.

O webhook CobraPro foi atualizado e reaberto para conferir a persistência: **Compra aprovada, Reembolso, Chargeback, Assinatura cancelada, Assinatura atrasada e Assinatura renovada** selecionadas. Produto, URL e token mantidos; demais integrações não alteradas.

O override `KIWIFY_WEBHOOK_TOKEN` foi alinhado ao token existente e salvo cifrado, somente no runtime, às 15h49. O teste público confirmou HMAC correto com corpo sem pedido → **400 (payload inválido)** e assinatura errada → **401**. Nenhuma compra foi submetida, conta criada ou mensagem enviada. A DigitalOcean confirmou esse rollout **live às 15h54min12s**.

A conta de comprador novo é provisionada transacionalmente no Supabase a partir do e-mail obtido da venda paga verificada. Credenciais de contas existentes são preservadas. O convite individual de definição de senha distingue aceite, falha, resposta desconhecida e revisão; não se usa uma senha padrão compartilhada.

## Etapa final de publicação

A flag `ENABLE_BLACKLIST_PRIVATE=true` será habilitada exclusivamente no runtime após esta reabertura e acompanhada até o rollout live. O smoke esperado é negar acesso a contas sem período Kiwify vigente e negar fotos a requisições sem sessão. O relatório final de execução deverá registrar essa conclusão sem confundir a preparação com vigência de clientes.

## Limites que permanecem

O produto inspecionado na Kiwify está configurado como **pagamento único**. A integração pode provisionar conta após venda paga verificada, mas não transforma pagamento único em assinatura recorrente ou acesso vitalício à Blacklist. A configuração comercial de recorrência requer decisão do proprietário; preços ou cobranças não foram alterados.

Há **zero assinaturas Kiwify registradas** no momento desta instalação. Portanto, as contas manuais atuais não recebem acesso automático à Blacklist. Para elas acessarem sob a regra autorizada, precisam ser vinculadas a uma assinatura paga vigente comprovada, sem concessões fictícias.

Os dados financeiros antigos não foram ajustados. Os caminhos inseguros continuam contidos; os fluxos prospectivos seguros de despesas e empréstimos já liberados permanecem preservados. Recebimentos de contratos antigos, renovação legada e saneamento por registro são fases separadas.

## Alerta de disponibilidade

O painel DigitalOcean mostra saldo em atraso de **US$ 36,00** e pede pagamento antes de **14/11/2026** para evitar suspensão. Nenhum pagamento foi efetuado automaticamente. O serviço continua marcado Healthy; o proprietário precisa regularizar a obrigação para manter a disponibilidade.
