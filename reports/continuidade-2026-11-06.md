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

## Confirmação após login DigitalOcean — 18h35 BRT

O App Platform confirmou **Success / Live Deployment** para `06c37eb`, deployment `6c01ca1a-fa38-4561-b8be-1b6e515c3f0b`. Esta evidência substitui a pendência de login descrita anteriormente. Site e healthcheck JSON responderam HTTP 200; Evolution também respondeu HTTP 200. Detalhes em `reports/evidencias-producao-2026-11-06.md`.

O painel mostra saldo em atraso de US$ 36,00 e prazo 14/11/2026 para pagamento, sujeito a suspensão. Nenhum pagamento foi executado.

## Novo lote de sessão — validado localmente, ativação ainda pendente

Todos os emissores passam a aceitar a versão capturada do usuário autenticado quando `ENABLE_SESSION_REVOCATION=true`. O JWT é comparado com a versão atual da conta antes do retorno do usuário; coluna ausente, token antigo sem versão, appId divergente, banco indisponível e prefixo cron não contornam o contrato. O login preserva o snapshot da mesma linha que forneceu a hash da senha, impedindo elevar uma autenticação com senha antiga durante um reset concorrente.

No modo ativado, o reset usa **somente** `consume_password_reset_and_revoke_sessions`: consumo do token, troca de senha e incremento de versão pertencem à mesma transação. Nenhum fallback REST/Drizzle é executado quando a RPC estiver ausente, rejeitada ou com resposta inválida. O modo legado continua compatível com flag ausente/desligada. A flag não foi habilitada em produção.

Validação deste lote: **471 testes aprovados, 11 ignorados**, 83 arquivos aprovados/3 ignorados; TypeScript, build e `git diff --check` aprovados. Os 11 testes ignorados continuam opt-in de ambiente, não evidência de banco produtivo.

Ainda falta validar/aplicar a 0016 na base correta e ativar coordenadamente todas as instâncias. Após ativação, não desligar a validação de versão como rollback: sessões revogadas poderiam voltar a valer. O SQL Editor ainda exibiu conteúdo sem sincronizar com o executor; o conector continua autorizado somente para a outra referência. Não houve DDL produtivo nem liberação de recebimentos.

## Migrations adicionais corrigidas e testadas — 18h50 BRT

A validação independente detectou o erro real `42710` ao reaplicar a 0014, além de controles condicionais incompletos em 0016/0017. As correções foram incorporadas: reaplicação transacional das quatro FKs/checks de assinatura; NOT NULL/default explícitos para versão de sessão legada; índice Kiwify validado pela tabela/coluna/validade/formato; bloqueio também de relação homônima de outro tipo; e impedimento físico de novos pedidos NULL/vazios.

O novo runner `tests/postgres-integrity/run.sh` executa **as migrations atuais do repositório**, não cópias candidatas. Resultado: **55/55 verificações aprovadas**, com 0014/0016/0017 executadas duas vezes em transação, rollback de catálogo/dados, ACL do reset, comparação de hash, expiração, camelCase/snake_case e duas corridas reais com espera por lock observada. Logs em `/tmp/cobrapro-integrity.9hvIvm/logs`; cluster encerrado com `STOP_EXIT=0`, `FINAL_STATUS=3`.

A suíte de aplicação final passou a **474 testes aprovados e 11 ignorados**, sem falhas. `pnpm drizzle-kit generate` foi tentado, mas denunciou snapshots legados 0000–0007 malformados, embora encerrasse sem erro de shell. Não foi declarado sucesso de geração nem usado `db:push`; migrations PostgreSQL manuais continuaram avaliadas diretamente nos testes reais. Este lote não modifica o schema TypeScript. O histórico de snapshots exige saneamento separado, sem tentar aplicar migrations MySQL legadas no Supabase.

Nenhuma dessas correções foi aplicada ao banco produtivo e nenhuma flag foi ligada. O sucesso do PostgreSQL sintético não equivale a pré-auditoria produtiva, saneamento dos saldos históricos ou autorização do projeto Supabase correto.
