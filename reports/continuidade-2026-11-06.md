# CobraPro — continuidade da auditoria em 6 de novembro de 2026

## Lote concluído e validado no código

Foi corrigido o erro TypeScript que impedia concluir a recuperação de senha: uma conta sem e-mail não chega ao envio Brevo. Entradas não textuais são rejeitadas, respostas de recuperação permanecem uniformes e nenhum link é enviado quando a persistência do token falha. O banco recebe apenas a hash SHA-256 do token individual.

O cliente Brevo foi centralizado com timeout de 10 segundos e resultado tipado: aceite técnico, configuração ausente, rejeição, limitação, falha transitória ou entrega indeterminada. Logs não recebem destinatário, conteúdo, token, chave parcial nem resposta do provedor. Não há retry implícito. Aceite técnico não comprova entrega final ao destinatário.

Convites Kiwify preservam o resultado indeterminado, registram o estado antes do POST e não reenviam automaticamente depois de timeout/rede. Retentativas elegíveis adquirem uma reserva condicional, impedindo duas reentregas de enviarem simultaneamente o mesmo convite. O destinatário é verificado contra a conta originalmente vinculada ao pedido; contas existentes não têm senha alterada. Estados incompletos por queda de processo exigem conferência, não reenvio cego. A garantia de unicidade de pedidos novos continua dependendo da migration 0017 em produção.

Nos templates de e-mail, nomes e datas são escapados como texto HTML. O lembrete de amanhã passou a mostrar **VENCE AMANHÃ**, não VENCE HOJE. O script diagnóstico Brevo não imprime segredos nem envia e-mail por padrão: envio exige `--send` e `BREVO_TEST_TO` explícitos.

Novos callbacks Evolution enviam o segredo em cabeçalho, sem token na URL. A compatibilidade com callbacks antigos permanece ligada durante a transição e pode ser retirada por `EVOLUTION_WEBHOOK_ALLOW_LEGACY_QUERY=false`, somente após verificar o cabeçalho nas instâncias reais. Não foi alterada a instância, o QR Code nem a configuração de produção nesta rodada. O tráfego até a Evolution ainda depende da configuração TLS da infraestrutura; não foi declarado resolvido.

## Validação

- `pnpm test`: **414 aprovados, 11 ignorados, 0 falhas**; 79 arquivos aprovados e 3 ignorados. Testes live previamente opt-in não comprovam produção.
- `pnpm check`: aprovado.
- `pnpm build`: aprovado. Há aviso de chunks grandes, não erro de compilação.
- `git diff --check`: aprovado.
- Não houve envio real de e-mail/WhatsApp nem alteração financeira de produção.

## Produção e limites desta rodada

Em 6/11, site, `/api/health` e Evolution responderam HTTP 200. Isso comprova disponibilidade dos endpoints, não reconciliação financeira nem versão do release.

A DigitalOcean abriu a tela de login: confirmar o commit ativo ou iniciar deploy exige retomar a sessão autenticada. Não se presume deploy concluído apenas pelo push ou HTTP 200.

O conector Supabase continua listando somente o projeto `vozmwdwpxacdsrzqevxg`, diferente da produção CobraPro (`oxvtmibrgjruldkouhhb`). Nenhuma consulta ou migration foi executada no projeto errado. As migrations 0013–0017 e a ativação financeira continuam dependentes de preflight na base correta.

## Próxima ação financeira

A RPC de recebimento 0015 está sendo validada em PostgreSQL local descartável com fixtures sintéticas. O objetivo é verificar execução SQL, reaplicação, baixa parcial, idempotência, isolamento, calendário de Brasília, rollback e concorrência. Mesmo um resultado local aprovado não autoriza afirmar compatibilidade com o schema produtivo sem inventário real.

As operações financeiras já contidas **não foram reativadas**. A flag `ENABLE_RPC_RECEBIMENTO_PARCELA` não foi habilitada. As seis divergências históricas registradas na auditoria de 28/10 não foram corrigidas por ajustes artificiais de Caixa.

## Resultado da validação PostgreSQL real

O PostgreSQL 16.15 local confirmou dois bloqueadores de instalação na migration 0015 original: igualdade de arrays com limites diferentes (`indkey` com limite inferior zero) rejeitava índice válido; e `%ROWTYPE` era usado em lista `INTO` de múltiplos destinos, impedindo compilar a função. Ambos foram corrigidos. A mesma comparação dimensional foi corrigida na 0013. A pré-auditoria agora usa extração de `to_jsonb` para consultar o vínculo operacional mesmo antes de a 0015 criar a coluna, sem DDL auxiliar.

O projeto ganhou runner finito reproduzível em `tests/postgres-receipt/run.sh`, fixture sintético e testes de integração com duas conexões reais. A versão **atual do repositório** executou integralmente 0013 e 0015 duas vezes, executou o preflight antes e depois e passou **17/17 grupos**: integral, parcial com encargos preservados, replay, payload conflitante, tenant/cliente/conta inativa, permissões, multa apenas no dia seguinte de Brasília, rollback injetado, FKs e quatro corridas com espera por lock observada. Ao final: zero parcelas divergentes do livro-caixa, zero operações sem Caixa ou auditoria, zero operações incompletas; PostgreSQL encerrado (`STOP_EXIT=0`, status final 3).

A suíte de aplicação passou a **417 testes aprovados e 11 ignorados**, sem falhas. Esses resultados validam SQL executável e as regras do fixture local; não verificam o schema, RLS/triggers, saldos históricos ou transporte PostgREST de produção. Migrations produtivas e liberação da flag continuam pendentes.

O lote anterior de comunicação foi publicado em `github/main` como `cb27976b3d97a0c5fc1e30e2b1f820a66f8dcdff`. O healthcheck de preview e produção respondeu JSON saudável; as três últimas execuções de lembretes consultadas (42261861187, 42200672145, 42153400242) terminaram com sucesso. Deploy do novo lote ainda exige confirmar a sessão e o commit no App Platform.
