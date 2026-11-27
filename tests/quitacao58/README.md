# Quitação58 — validação da conta-alvo

A migração `drizzle/0058_quitacao_conta_alvo.sql` foi instalada uma única vez no Supabase em 27/11/2026 às 09:41:43 BRT. SHA-256: `cf0e949d9628b6de51a1b9cd9c52272cfbda072ffc3e9a80ea89c4f975cd6b72`.

O helper fechado valida a conta e o contrato próprios, os locks e todos os lançamentos que atingem a conta, o contrato ou suas parcelas. Mantém a conferência de todos os saldos-base e das operações37 próprias. Não deixa uma divergência de outra conta bloquear indevidamente esta quitação e não repara o histórico divergente. Não altera os writers35/37/51, o verificador51 compilado54 ou as permissões de empresas. A Blacklist continua sendo o único compartilhamento autorizado.

## Provas

O SQL exato passou integralmente em PostgreSQL17, nos perfis privado e Supabase: 31 regressões51, seis inclusões52 genuínas, 11 cenários53, 14 adversários52, seis alvos inválidos, quatro corridas em conexões reais e falha na segunda baixa com rollback integral. Os instaladores tiveram 56/62 recusas e controles. As 54 sentinelas nativas e suas cinco tabelas privadas foram preservadas; o instalador ignorou um lock exclusivo de tabela nativa e nunca ganhou SELECT nela. Os 16 extras públicos reais não foram falsificados ou resealados no fixture.

A pós-conferência real confirmou 361 pinos completos, os 15 verificadores originais, 97 tabelas financeiras com todas as colunas/empresas idênticas antes/depois, 14 selos antigos exatos, somente a derivação51 planejada e todos os 70 extras não financeiros preservados. O runtime da aplicação não mudou.

## Reprodução local

Requer PostgreSQL17 em `/usr/lib/postgresql/17/bin` (ou `PG17_BIN`), dependências já instaladas e execução **somente em fixture privado**, sem credenciais de produção. A partir da raiz do repositório:

```bash
pnpm exec vitest run server/quitacao58.integrity.test.ts
NODE_ENV=test DOTENV_CONFIG_PATH=/dev/null R2_LOCAL_PG51=1 node tests/quitacao58/full31.mjs green private
NODE_ENV=test DOTENV_CONFIG_PATH=/dev/null R2_LOCAL_PG51=1 node tests/quitacao58/full31.mjs green supabase
```

O runner cria banco temporário exclusivo, escuta apenas em socket Unix0700, recusa usuário PostgreSQL superuser nas operações financeiras e encerra/remove seu próprio cluster ao terminar. Os módulos portados diferem das fontes certificadas apenas por caminhos; `certification.json` e o teste verificam a inversão byte-exata. `old30-rejected.fixture.sql` é um contrafactual deliberadamente incompatível, nunca um instalador de produção.

## Limites

Instalação e publicação não substituem o teste final da interface. Quitação/arquivo do contrato fictício463 ainda não foram enviados no momento deste certificado. A lista continua sem solução real aprovada: a candidata59 passou nos testes privados, mas falhou em produção tanto com quatro leituras quanto em serial. Não incluímos59,57, Kiwify, ofertas, mensagens, saneamento histórico ou novos cheques neste incremento. A plataforma não está certificada como100%.
