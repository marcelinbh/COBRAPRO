# Revisão técnica rigorosa — CobraPro

**Data da revisão:** 20 de outubro de 2026  
**Base revisada:** commit `de937fb` (branch local `sync/confiabilidade-financeira`)  
**Escopo:** código-fonte versionado de backend Express/tRPC, React 19, integrações Supabase, Evolution API, Kiwify, uploads, rotinas agendadas, regras de caixa, contratos, parcelas, vendas, assinaturas, Blacklist e migrations. Não foram alterados arquivos durante esta revisão.

> **Conclusão executiva:** o CobraPro compila, mas **não está apto a receber novas funções financeiras ou ampliar o uso em produção sem uma rodada prioritária de correções**. Há riscos críticos de tomada de conta, adulteração de dados entre assinantes, inconsistência de caixa, pagamentos/renovações parcialmente gravados e uma confirmação de WhatsApp que hoje significa apenas “aceito pela Evolution”, não “entregue ao cliente”.
>
> Os problemas de caixa e renovação relatados são compatíveis com o código atual: operações financeiras são compostas por várias chamadas REST independentes ao Supabase, sem transação atômica no banco e com algumas falhas de lançamento propositalmente ignoradas.

---

## 1. Método e evidências de validação

Foi feita leitura estática dos módulos críticos, rastreamento de mutações Supabase, revisão de schema/migrations e execução local de validações.

| Verificação | Resultado |
|---|---|
| `pnpm check` | **Aprovado** — TypeScript sem erros |
| `pnpm build` | **Aprovado** — build de produção gerado |
| `pnpm test -- --run` | **Reprovado** — 6 arquivos de teste falharam; 8 testes falharam, 179 passaram e 7 foram ignorados |
| `pnpm audit --prod` | **Reprovado** — vulnerabilidades críticas e altas em dependências de produção |
| Integridade Git após a revisão | Árvore de trabalho limpa; artefatos de build removidos |

### Falhas observadas nos testes

1. O teste de rejeição de token Kiwify espera HTTP 401, mas a rota não valida token/assinatura. Isto confirma uma falha de segurança real, não apenas uma falha de teste.
2. Um teste fim a fim de renovação falha com `Cannot read properties of undefined (reading 'insert')`, sinalizando mocks/testes desatualizados para o fluxo financeiro.
3. Os testes de conectividade Supabase falham por chave de API não registrada no ambiente de teste.
4. O health check de automação retorna 503 em vez de 200, indicando que a dependência da outbox ainda não está saudável/configurada no ambiente que rodou a suíte.
5. Há duas falhas de i18n e duas falhas de exportação/backup; são menos graves que os itens financeiros e de segurança, mas impedem considerar a suíte como selo de qualidade.

---

## 2. Priorização geral

| Prioridade | Quantidade | Interpretação |
|---|---:|---|
| **Crítico** | 12 | Pode permitir invasão, vazamento/alteração entre contas, perda ou corrupção financeira, ou impedir a confirmação real de cobranças. Corrigir antes de novas funcionalidades. |
| **Moderado** | 13 | Pode causar dados errados, indisponibilidade, exposição limitada, falhas de escala ou regressões em cenários comuns. |
| **Baixo** | 5 | Afeta manutenção, diagnóstico, UX operacional ou robustez em volume. |

---

# 3. Achados críticos

## C-01 — Endpoint público cria/eleva administrador com segredo e senha fixos no código

**Gravidade:** Crítico  
**Evidência:** `server/authRoutes.ts:411-467`  
**Cenário exato:** uma pessoa que descubra o endpoint de bootstrap e a credencial estática armazenada no código consegue enviar um `POST` para a rota administrativa. O fluxo cria ou atualiza a conta administrativa pré-definida e substitui a senha. Não há sessão administrativa, rate limit, expiração, IP allowlist ou segredo externo.

**Impacto:** tomada total da aplicação e de todos os dados financeiros, clientes, documentos e Blacklist. O código contém a credencial e a senha de bootstrap; elas não devem permanecer versionadas nem ser reproduzidas neste relatório.

**Correção obrigatória:** remover completamente a rota da aplicação publicada. A criação inicial deve ser realizada apenas por migration/CLI administrativa de uso único, com segredo em variável de ambiente e expiração. Também revogar/alterar imediatamente a senha da conta administrativa atualmente vinculada a esse bootstrap.

```ts
// server/authRoutes.ts
// REMOVER integralmente a rota POST /api/auth/seed-admin da aplicação publicada.

// Em substituição, executar uma única vez em CLI protegida:
async function provisionarAdminInicial(email: string, senha: string) {
  if (process.env.ALLOW_BOOTSTRAP_ADMIN !== "true") {
    throw new Error("Bootstrap administrativo desabilitado");
  }
  if (!process.env.BOOTSTRAP_ADMIN_EMAIL || email !== process.env.BOOTSTRAP_ADMIN_EMAIL) {
    throw new Error("Administrador não autorizado");
  }

  const passwordHash = await bcrypt.hash(senha, 12);
  // upsert com email UNIQUE e execução fora do servidor HTTP
  await db.insert(users).values({ /* ... */ }).onConflictDoUpdate({ /* ... */ });
}
```

---

## C-02 — Webhook Kiwify aceita qualquer requisição e pode resetar senha de comprador existente

**Gravidade:** Crítico  
**Evidência:** `server/kiwifyWebhook.ts:61-65`, `246-259`, `339-385`  
**Cenário exato:** um atacante envia `POST /api/webhook/kiwify` com status `paid`/`approved`, e-mail de uma conta existente e um `order_id` novo. A rota apenas verifica campos do corpo e responde 200. Embora exista `KIWIFY_WEBHOOK_TOKEN`, ele é declarado e **não é usado**. Para usuário existente, o código substitui a senha pela senha temporária determinística e envia e-mail.

**Impacto:** takeover de conta por reset previsível de senha e criação fraudulenta de contas. A alegação de que uma URL “secreta” é suficiente não é um controle de autenticação.

**Correção obrigatória:** validar criptograficamente a assinatura usando o corpo bruto, rejeitar antes de qualquer efeito, não aceitar token em query string, usar senha temporária aleatória de uso único ou link de definição de senha e gravar a idempotência antes de enviar e-mail.

```ts
// server/_core/index.ts — esta rota precisa receber o corpo bruto ANTES do express.json()
app.post("/api/webhook/kiwify", express.raw({ type: "application/json", limit: "1mb" }), kiwifyHandler);

// server/kiwifyWebhook.ts
function assinaturaValida(raw: Buffer, assinatura: string | undefined): boolean {
  const secret = process.env.KIWIFY_WEBHOOK_SECRET;
  if (!secret || !assinatura) return false;
  const esperado = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const recebido = Buffer.from(assinatura, "hex");
  const esperadoBuffer = Buffer.from(esperado, "hex");
  return recebido.length === esperadoBuffer.length && crypto.timingSafeEqual(recebido, esperadoBuffer);
}

async function kiwifyHandler(req: Request, res: Response) {
  if (!Buffer.isBuffer(req.body) || !assinaturaValida(req.body, req.get("x-kiwify-signature"))) {
    return res.status(401).json({ error: "Assinatura inválida" });
  }

  const payload = JSON.parse(req.body.toString("utf8")) as KiwifyPayload;
  // validar schema com Zod; só então registrar e processar a compra.
  return res.status(202).json({ received: true });
}

function gerarSenhaTemporaria(): string {
  return crypto.randomBytes(24).toString("base64url");
}
```

> Antes de publicar, confirmar na documentação da Kiwify qual é o header e algoritmo de assinatura da conta. Não se deve assumir que `signature` no JSON é autenticável sem a especificação oficial.

---

## C-03 — Upload público de até 50 MB, sem autenticação, limite real, validação de tipo ou isolamento por usuário

**Gravidade:** Crítico  
**Evidência:** `server/_core/index.ts:41-43`; `server/authRoutes.ts:469-488`; `client/src/pages/ClienteDetalhe.tsx:71-86`  
**Cenário exato:** qualquer visitante, inclusive sem login, pode fazer `POST /api/upload` com um payload Base64 de até 50 MB. O backend aceita `contentType`, nome e pasta declarados pelo cliente, cria URL pública de storage e não associa o arquivo a uma empresa ou a um registro autorizado.

**Impacto:** custo/abuso de storage, negação de serviço por consumo de memória, hospedagem de arquivos maliciosos, gravação de conteúdo com MIME falso e cruzamento de arquivos entre assinantes. O Base64 ainda amplia o uso de memória acima do tamanho original.

**Correção obrigatória:** autenticar a requisição, limitar o JSON geral para um tamanho baixo e usar middleware específico de upload; limitar tamanho por arquivo e por lote; lista fechada de MIME; verificação de magic bytes; nomes gerados pelo servidor; prefixo por `userId`; arquivo privado ou URL assinada.

```ts
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

app.post("/api/upload", requireHttpUser, async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Upload inválido" });

  const { base64, contentType } = parsed.data;
  if (!ALLOWED_TYPES.has(contentType)) return res.status(415).json({ error: "Tipo não permitido" });

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    return res.status(413).json({ error: "Arquivo excede o limite permitido" });
  }
  if (!conteudoCompativelComMime(buffer, contentType)) {
    return res.status(415).json({ error: "Conteúdo não corresponde ao tipo declarado" });
  }

  const extensao = extensaoSegura(contentType);
  const key = `tenants/${req.user.id}/clientes/${crypto.randomUUID()}.${extensao}`;
  const result = await storagePut(key, buffer, contentType);
  return res.status(201).json({ url: result.url });
});
```

---

## C-04 — Autorização multi-tenant incompleta: IDs de outra empresa podem ser consultados, alterados ou apagados

**Gravidade:** Crítico  
**Evidência representativa:**

- `server/routers.ts:1586` — `contratos.updateStatus` atualiza só por `id`.
- `server/routers.ts:1600-1605` — geração de PDF busca contrato e parcelas só por `id`/`contrato_id`.
- `server/routers.ts:1772-1774` — exclusão apaga transações e parcelas por `contrato_id` antes de confirmar o proprietário do contrato.
- `server/routers.ts:1849-1875` — edição de datas de parcelas não filtra `user_id`.
- `server/routers.ts:2585` — edição de parcela atualiza só por `id`.
- `server/routers.ts:2992`, `3013-3024`, `3097-3099`, `3147-3151` — templates e contratos WhatsApp sem escopo do usuário.
- `server/routers.ts:3457-3479` — templates são listados/alterados sem `user_id`.
- `server/routers.ts:3525`, `3540-3563`, `3577-3587` — koletores criados sem `user_id`, atualizados/excluídos sem escopo e relatórios buscam registros globais.
- `server/routers.ts:4077-4122` — produtos são listados/alterados/desativados sem escopo na rota REST.
- `server/routers.ts:4293`, `4307`, `4316` — alteração e resumo de cheques sem escopo de empresa.
- `server/routers/assinaturas.ts:121-147`, `164-231`, `236-267` — assinatura, pagamentos e exclusão não validam `ctx.user.id` de ponta a ponta.
- `server/routers.ts:4631-4644` — exclusão de venda de telefone nem recebe `ctx`; apaga por ID.
- `server/routers.ts:4692` — etiquetas aplicadas a contrato sem `user_id`.

**Cenário exato:** um usuário autenticado chama uma procedure com o ID numérico de outra empresa. Como o cliente Supabase utiliza service role, o banco não aplica RLS ao servidor; portanto uma query sem `.eq('user_id', ctx.user.id)` atua sobre o registro de outra conta. IDs sequenciais tornam a enumeração simples.

**Impacto:** vazamento de CPF, PIX, telefone, contratos, parcelas e dados financeiros; alteração de status; exclusão/corrupção de registros entre assinantes. Este é o principal risco arquitetural do SaaS.

**Correção obrigatória:** centralizar o escopo de tenant e aplicar filtro em **toda** leitura e escrita. Antes de alterações encadeadas, buscar o recurso já escopado. No banco, tornar `user_id` obrigatório e criar FKs/índices. RLS é defesa adicional, mas não substitui filtros no backend quando service role é usado.

```ts
function tenant(sb: SupabaseClient, table: string, userId: number) {
  return sb.from(table).select().eq("user_id", userId);
}

// Exemplo: substituir contratos.updateStatus
updateStatus: protectedProcedure
  .input(z.object({ id: z.number().int().positive(), status: statusContratoSchema }))
  .mutation(async ({ ctx, input }) => {
    const sb = await requireSupabase();
    const { data, error } = await sb
      .from("contratos")
      .update({ status: input.status })
      .eq("id", input.id)
      .eq("user_id", ctx.user.id)
      .select("id")
      .maybeSingle();

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível atualizar o contrato" });
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato não encontrado" });
    return { success: true };
  });
```

```sql
-- Migration estrutural: adaptar depois de corrigir linhas legadas sem dono.
ALTER TABLE clientes          ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE contratos         ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE parcelas          ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE contas_caixa      ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE transacoes_caixa  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE produtos          ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE cheques           ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE koletores         ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE templates_whatsapp ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contratos_tenant_id ON contratos(user_id, id);
CREATE INDEX IF NOT EXISTS idx_parcelas_tenant_id ON parcelas(user_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_parcela_contrato_numero ON parcelas(user_id, contrato_id, numero_parcela);
```

---

## C-05 — Pagamento parcial pode duplicar a dívida e deixar saldo residual órfão

**Gravidade:** Crítico  
**Evidência:** `server/routers.ts:2204-2288`  
**Cenário exato:** parcela de R$ 100 recebe R$ 30 com `transferirSaldoResidual=true`. O código calcula saldo de R$ 70 e adiciona esse valor à próxima parcela (`2255-2268`), mas mantém a parcela atual como `parcial` e não persiste uma representação coerente do saldo transferido. Outros relatórios somam o valor original da parcela parcial como pendente e também passam a cobrar a próxima acrescida de R$ 70. Se a inserção no caixa falhar depois da atualização da próxima parcela, o rollback em `2286` restaura somente a parcela original, **não** a próxima; uma nova tentativa transfere R$ 70 novamente.

**Impacto:** saldo a receber superestimado, cliente cobrado duas vezes, divergência de caixa e necessidade de correção manual.

**Correção obrigatória:** definir uma única semântica para “pagamento parcial”: ou o saldo continua na mesma parcela, ou a parcela é efetivamente encerrada e o saldo é transferido uma única vez à próxima. Em ambos os casos, executar tudo em uma transação no banco. Não é seguro montar uma transação financeira com sequências REST independentes.

```sql
-- Exemplo de princípio: RPC transacional no PostgreSQL.
-- Deve ser implementada completa após definir a regra de negócio de saldo parcial.
CREATE OR REPLACE FUNCTION registrar_pagamento_parcela(
  p_user_id integer,
  p_parcela_id integer,
  p_conta_caixa_id integer,
  p_valor numeric,
  p_chave uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parcela parcelas%ROWTYPE;
  v_proxima parcelas%ROWTYPE;
  v_saldo numeric;
BEGIN
  SELECT * INTO v_parcela
  FROM parcelas
  WHERE id = p_parcela_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_parcela.status NOT IN ('pendente', 'atrasada', 'vencendo_hoje', 'parcial') THEN
    RAISE EXCEPTION 'Parcela indisponível para pagamento';
  END IF;

  -- Validar conta da mesma empresa e reservar a chave idempotente aqui.
  -- Calcular saldo a partir do valor devido de forma determinística.
  v_saldo := /* valor devido - p_valor */;

  IF v_saldo > 0 THEN
    SELECT * INTO v_proxima FROM parcelas
      WHERE contrato_id = v_parcela.contrato_id AND user_id = p_user_id
        AND numero_parcela > v_parcela.numero_parcela
        AND status IN ('pendente','atrasada','vencendo_hoje')
      ORDER BY numero_parcela LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pagamento parcial exige próxima parcela ou criação explícita de saldo';
    END IF;

    UPDATE parcelas SET
      status = 'paga',
      valor_pago = p_valor,
      observacoes = 'Pagamento parcial; saldo transferido para parcela seguinte'
    WHERE id = v_parcela.id;

    UPDATE parcelas SET saldo_residual = saldo_residual + v_saldo WHERE id = v_proxima.id;
  ELSE
    UPDATE parcelas SET status = 'paga', valor_pago = p_valor WHERE id = v_parcela.id;
  END IF;

  INSERT INTO transacoes_caixa (user_id, conta_caixa_id, tipo, categoria, valor, parcela_id, contrato_id)
  VALUES (p_user_id, p_conta_caixa_id, 'entrada', 'pagamento_parcela', p_valor, v_parcela.id, v_parcela.contrato_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;
```

O backend deve chamar somente essa RPC e tratar o resultado, em vez de atualizar parcela, próxima parcela e caixa em requisições REST separadas.

---

## C-06 — Renovação de juros e quitação total não são atômicas; quitação pode existir sem entrada no Caixa

**Gravidade:** Crítico  
**Evidência:** `server/routers.ts:1882-1900`; `2326-2551`  
**Cenários exatos:**

1. `contratos.pagarTotal` marca contrato e parcelas como pagos, mas não exige conta de caixa, não registra transação de entrada, não valida se o valor recebido é compatível e não confirma resultados das escritas.
2. Em `pagarJuros`, a parcela atual é marcada como paga; depois grava entrada de caixa, cria nova parcela e aumenta o número de parcelas. Se a criação da nova parcela ou a atualização do contrato falhar, a parcela antiga e a entrada de caixa já foram persistidas. A operação fica marcada como falha, mas os dados não voltam ao estado anterior.
3. Duas requisições concorrentes podem calcular o mesmo maior número de parcela antes da inserção. O schema não impõe unicidade para `(contrato_id, numero_parcela)`.

**Impacto:** exatamente o sintoma relatado: renovação aparentemente concluída em uma parte do sistema, mas contrato/parcela não aparece como pago ou não recebe a parcela renovada; caixa pode registrar recebimento sem a renovação correspondente.

**Correção obrigatória:** remover ou reimplementar `pagarTotal` em uma RPC transacional; adicionar índice único; usar `FOR UPDATE`/upsert idempotente no banco; não retornar sucesso quando qualquer etapa falhar.

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_parcelas_contrato_numero
  ON parcelas (user_id, contrato_id, numero_parcela);

-- O fluxo de renovação deve usar uma função PostgreSQL com uma única transação:
-- 1. trava parcela e contrato pelo user_id;
-- 2. registra pagamento de juros;
-- 3. insere a nova parcela usando número protegido pelo UNIQUE;
-- 4. incrementa numero_parcelas;
-- 5. registra transação de caixa;
-- 6. conclui idempotência;
-- rollback automático em qualquer erro.
```

Enquanto a RPC não existir, **não habilitar “quitar total” como caminho alternativo de baixa** e bloquear pagamento por juros em caso de erro de persistência até a reconciliação administrativa.

---

## C-07 — Venda de telefone cria registros sem `user_id` e engole falha do Caixa

**Gravidade:** Crítico  
**Evidência:** `server/routers.ts:4404-4418`, `4458-4512`, `4514-4544`, `4556-4603`, `4631-4644`  
**Cenário exato:** `vendasTelefone.criar` recebe `ctx`, mas o insert em `vendas_telefone` (`4459-4492`) não inclui `user_id`; as parcelas geradas também não incluem `user_id`. Em seguida, listagens e pagamentos filtram por `user_id`. A venda pode deixar de aparecer para quem a criou e uma parcela pode não ser encontrada para pagamento. Além disso, falhas de entrada no caixa são capturadas e apenas registradas em log (`4540-4543` e `4601-4603`), mas a venda/pagamento retorna sucesso.

**Impacto:** vendas invisíveis ou impossíveis de baixar, recebimentos sem reflexo no Caixa, e divergência financeira silenciosa.

**Correção obrigatória:** incluir `user_id` em venda e parcelas, validar a conta de caixa escolhida explicitamente, usar a mesma operação transacional da cobrança e nunca ocultar falha de caixa como sucesso.

```ts
const { data: venda, error } = await sb.from("vendas_telefone").insert({
  // ...campos validados...
  user_id: ctx.user.id,
}).select("id").single();
if (error || !venda) throw internalError("Não foi possível criar a venda");

const parcelas = Array.from({ length: input.numParcelas }, (_, index) => ({
  venda_id: venda.id,
  user_id: ctx.user.id,
  numero: index + 1,
  valor: input.valorParcela,
  vencimento: dataCivil,
  status: "pendente",
}));
const { error: parcelasError } = await sb.from("parcelas_venda_telefone").insert(parcelas);
if (parcelasError) throw internalError("Venda cancelada: parcelas não foram gravadas");

// A entrada precisa ser parte de RPC/transação, jamais de catch que ignora o erro.
```

---

## C-08 — Status, multa e datas continuam calculados em UTC em fluxos financeiros relevantes

**Gravidade:** Crítico  
**Evidência:** `server/routers.ts:962`, `1098`, `1949`, `1992`, `2073-2076`, `2661`, além de diversos cálculos por `toISOString().split('T')[0]`  
**Cenário exato:** entre 21:00 e 23:59 no horário de Brasília, a data UTC já é o dia seguinte. `parcelas.list` usa essa data e executa update global de status; uma parcela que vence hoje pode ser marcada como atrasada antes da meia-noite de Brasília. `aplicarMulta` usa o mesmo padrão. Isto reintroduz precisamente o erro de multa prematura relatado.

**Impacto:** cobrança indevida, telas em desacordo, mensagens de atraso antes da data correta e contestação financeira.

**Correção obrigatória:** proibir `toISOString().split('T')[0]` em regra de negócio brasileira. Usar somente `dataHojeBrasilia()` e helpers civis; aplicar filtro de tenant também na atualização de status.

```ts
import { dataHojeBrasilia } from "./services/businessDate";

const hoje = dataHojeBrasilia();

await sb.from("parcelas")
  .update({ status: "atrasada" })
  .eq("user_id", ctx.user.id)
  .lt("data_vencimento", hoje)
  .in("status", ["pendente", "vencendo_hoje"]);

await sb.from("parcelas")
  .update({ status: "vencendo_hoje" })
  .eq("user_id", ctx.user.id)
  .eq("data_vencimento", hoje)
  .eq("status", "pendente");
```

A função compartilhada `calcularJurosMora` está no caminho correto, pois compara datas civis de Brasília. O problema é que muitos chamadores não a utilizam ou continuam alterando status por data UTC.

---

## C-09 — Webhook Evolution é público e o rastreio não confirma entrega de mensagens automáticas

**Gravidade:** Crítico  
**Evidência:** `server/webhookRoutes.ts:15-138`; `server/services/notificacoesAutomaticas.ts:135-186`; `server/routers/notificacoes.ts:118-168`; `drizzle/0010_whatsapp_eventos.sql`  
**Cenário exato:** qualquer origem pode postar em `/api/webhook/evolution`; não existe header de segredo, HMAC, allowlist ou validação de instância. O processador aceita o payload e altera status por `evolution_msg_id` em `whatsapp_mensagens`, mas a automação nova grava em `whatsapp_outbox`/`notificacoes_log`. O envio de teste retorna `aceito_evolution`, e o log nem armazena o `providerMessageId` devolvido para correlacionar o callback posterior.

**Impacto:** um atacante pode injetar eventos falsos; operador vê “enviado” quando a Evolution apenas aceitou a chamada; não é possível provar entrega ou leitura do teste/da régua automática. Portanto, o requisito “testar se as mensagens foram enviadas” está apenas parcialmente implementado.

**Correção obrigatória:** autenticar webhook, vincular instância a `user_id`, persistir `provider_message_id` em outbox/log, atualizar a outbox e o log quando chegar `MESSAGES_UPDATE`, e diferenciar as etapas **aceito**, **enviado**, **entregue**, **lido**, **falhou** e **desconhecido**.

```ts
// Validar antes de responder/processar.
function evolutionWebhookAutorizado(req: Request): boolean {
  const expected = process.env.EVOLUTION_WEBHOOK_SECRET;
  const received = req.get("x-evolution-webhook-secret");
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.post("/api/webhook/evolution", async (req, res) => {
  if (!evolutionWebhookAutorizado(req)) return res.sendStatus(401);
  await processWebhookEvent(req.body);
  return res.status(200).json({ received: true });
});

// Quando Evolution confirma um status:
await sb.from("whatsapp_outbox")
  .update({ status: mapProviderStatus(status), updated_at: new Date().toISOString() })
  .eq("provider_message_id", msgId);

await sb.from("notificacoes_log")
  .update({ status: mapProviderStatus(status) })
  .eq("provider_message_id", msgId);
```

A migration precisa adicionar coluna e índice no log:

```sql
ALTER TABLE notificacoes_log ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
CREATE INDEX IF NOT EXISTS idx_notificacoes_log_provider_message
  ON notificacoes_log(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
```

---

## C-10 — Mensagens em estado `enviando` nunca são recuperadas após queda; relatório diário pode ser marcado como enviado antes do envio

**Gravidade:** Crítico  
**Evidência:** `server/services/notificacoesAutomaticas.ts:139-186`; `server/_core/index.ts:137-156`  
**Cenários exatos:**

1. O worker reserva a mensagem e a marca `enviando` com lease de 90 segundos. Se a instância cair, processo reiniciar ou ocorrer timeout depois desse update, não há rotina que reponha `enviando` com `lease_expira_em` vencida para `pendente`. A mensagem fica presa indefinidamente.
2. O relatório diário grava `relatorio_diario_ultimo_envio` logo depois de enfileirar (`index.ts:143-156`), antes de a outbox ser efetivamente aceita/entregue. Caso WhatsApp esteja desconectado, o marcador impede nova tentativa naquele dia.

**Impacto:** lembretes e relatórios silenciosamente deixam de ser enviados, mesmo com a régua “ativa”.

**Correção obrigatória:** reaper de lease expirado antes de cada processamento; máximo de tentativas e alerta operacional; marcador de relatório somente após sucesso do worker ou com outbox pendente reutilizável.

```ts
async function recuperarLeasesExpirados(sb: SupabaseClient) {
  const agora = new Date().toISOString();
  const { error } = await sb.from("whatsapp_outbox")
    .update({
      status: "pendente",
      lease_expira_em: null,
      proxima_tentativa_em: agora,
      updated_at: agora,
      ultimo_erro: "Lease expirado; mensagem recuperada para nova tentativa",
    })
    .eq("status", "enviando")
    .lt("lease_expira_em", agora);
  if (error) throw new Error(error.message);
}

export async function processarFilaWhatsApp(limite = 25, dryRun = false) {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Banco indisponível");
  await recuperarLeasesExpirados(sb);
  // Buscar/reservar/processar as candidatas em seguida.
}
```

---

## C-11 — Endpoints de manutenção e atualização de parcelas estão públicos

**Gravidade:** Crítico  
**Evidência:** `server/_core/index.ts:182-335`  
**Cenário exato:** `POST /api/scheduled/atualizar-parcelas`, `/api/scheduled/supabase-keepalive`, `/api/admin/migration-historico`, `/api/admin/migration-saldo-residual` e `/api/admin/migration-login-logs` não passam por `autenticarDisparadorDeAutomacao` nem por sessão de admin. Qualquer pessoa pode disparar atualizações massivas ou rotinas de migration/informação.

**Impacto:** alteração operacional não autorizada e exposição de detalhes de erro/configuração. O endpoint de migration usa a chave de serviço/Management API dentro do servidor.

**Correção obrigatória:** remover endpoints temporários de migration após uso; exigir autenticação de automação para health/heartbeats; exigir `adminProcedure` para qualquer operação manual interna.

```ts
app.post("/api/scheduled/atualizar-parcelas", async (req, res) => {
  if (!(await autenticarDisparadorDeAutomacao(req))) {
    return res.status(403).json({ error: "Acesso exclusivo da automação" });
  }
  // atualização com dataHojeBrasilia()
});

// Não expor migrations por HTTP. Remover completamente as rotas /api/admin/migration-*.
```

---

## C-12 — Blacklist compartilhada expõe dados pessoais sensíveis sem controles de governança e permite apagar foto de outro registro

**Gravidade:** Crítico (privacidade/compliance) e Moderado (integridade de fotos)  
**Evidência:** `server/routers/blacklist.ts:19-361`  
**Cenário exato:** qualquer assinante autenticado pode consultar/listar todos os registros, que incluem CPF/CNPJ, nome, telefone, e-mail, endereço completo, cidade/estado, motivo, valor e fotos. Não existe moderação, evidência mínima, mecanismo de contestação, retenção, trilha de consulta, mascaramento por finalidade ou revisão de publicação. Na remoção de foto (`324-342`), verifica-se que o usuário é dono de `blacklistId`, mas o delete usa somente `fotoId`; quem possui um registro próprio pode apagar uma foto de outro registro se adivinhar o ID.

**Impacto:** alto risco de LGPD, publicação indevida/difamatória e vazamento de dados. Tecnicamente, o compartilhamento global foi implementado conforme a proposta do produto, porém a quantidade de dados expostos excede o mínimo necessário para consulta inicial.

**Correção obrigatória:** antes de escalar o módulo, criar política de uso e revisão jurídica de LGPD; publicar somente dados mascarados na busca; liberar detalhes mediante finalidade/auditoria; permitir contestação/retificação; guardar evidências e logs de acesso; definir retenção; validar arquivos. Corrigir a associação da foto no delete.

```ts
const { data, error } = await db
  .delete(blacklistFotos)
  .where(and(
    eq(blacklistFotos.id, input.fotoId),
    eq(blacklistFotos.blacklistId, input.blacklistId),
  ))
  .returning({ id: blacklistFotos.id });

if (!data.length) {
  throw new TRPCError({ code: "NOT_FOUND", message: "Foto não encontrada neste registro" });
}
```

> Isto é uma observação técnica de risco e privacidade, não parecer jurídico. Como o módulo trata inadimplência, CPF, endereço e fotos em rede de assinantes, a validação jurídica/LGPD é mandatória antes de promover a funcionalidade como diferencial público.

---

# 4. Achados moderados

## M-01 — `user_id` é anulável no schema e não há FKs que garantam isolamento

**Evidência:** `drizzle/schema.ts:68-340`. Diversas tabelas críticas usam `integer("user_id")` sem `.notNull()`, e relações como parcela→contrato, transação→conta e contrato→cliente não têm foreign keys declaradas.

**Cenário:** qualquer caminho que esqueça o `user_id` — como venda de telefone e koletores no fallback REST — cria registros órfãos ou invisíveis. Sem FKs, também é possível criar parcela para contrato/cliente inexistente ou de outro tenant.

**Correção:** migration de saneamento, preencher proprietários legados, aplicar `NOT NULL`, FKs e índices compostos por tenant. Fazer backup validado antes da migration.

---

## M-02 — Módulos de assinaturas não validam pertencimento do cliente, assinatura, pagamento e conta de caixa

**Evidência:** `server/routers/assinaturas.ts:72-267`.

**Cenários:** usuário informa `clienteId`/`assinaturaId` de outro tenant; update, delete, listagem de pagamentos e a busca de duplicidade não carregam/filtram a assinatura por `user_id`. O pagamento é inserido antes do lançamento de caixa; se o caixa falha, sobra pagamento sem receita. Não há idempotência de requisição nem validação de conta de caixa.

**Correção:** usar o mesmo padrão transacional e de `user_id` de parcelas. Criar `UNIQUE(assinatura_id, mes_referencia)` no banco e não confiar apenas em busca seguida de insert.

---

## M-03 — Fluxo de reparcelamento atualiza parcelas/contrato em loop sem transação e sem escopo completo

**Evidência:** `server/routers.ts:3611-3764`.

**Cenário:** depois de obter o contrato, cada parcela é marcada paga em chamadas separadas, o contrato é quitado e só depois o novo contrato/parcelas são criados. Falha de rede no meio deixa contrato original quitado e novo contrato incompleto. Preview ainda consulta parcelas sem `ctx`/`user_id`.

**Correção:** reimplementar por RPC PostgreSQL com trava de contrato, validação de tenant e rollback automático. Preview deve aceitar `ctx` e filtrar sempre por `user_id`.

---

## M-04 — Data de pagamento e relatórios continuam inconsistentes em Brasília

**Evidência:** `server/routers.ts:97-345`, `3178-3243`, `3325-3341`, `4049`; `server/routers/assinaturas.ts:133`, `219`.

**Cenário:** relatórios de “hoje”, tendências, inadimplência, valor recebido e assinatura usam UTC ou `new Date()` sem timezone de Brasília. Entre a noite de Brasília e a virada UTC, valores podem aparecer no dia errado.

**Correção:** criar regra de lint/review: toda data de negócio deve ser `dataHojeBrasilia`, `horarioBrasilia`, `adicionarDiasData` ou `dataCivilBrasiliaParaIso`. Persistir datas civis como `DATE` quando não houver hora de negócio.

---

## M-05 — Atualização de status global é disparada ao apenas listar parcelas

**Evidência:** `server/routers.ts:1990-2008` e `2073-2076`.

**Cenário:** abrir uma tela de parcelas executa escrita; no fallback REST a escrita não filtra usuário. Consultas deveriam ser sem efeito colateral. Em pico de acessos isso cria atualizações redundantes e disputa com o agendador.

**Correção:** remover writes da procedure `list`; o endpoint agendado autenticado deve ser o único responsável pela atualização de estado, por lotes e com data Brasília.

---

## M-06 — Portal do cliente permite gerar links de dados de cliente de outro tenant e o campo `usado` nunca é marcado

**Evidência:** `server/routers.ts:2911-2974`.

**Cenário:** `gerarLink` cria token para qualquer `clienteId` sem confirmar `user_id`; depois o endpoint público retorna nome, PIX e parcelas. Além disso, `acessar` verifica `link.usado`, mas não grava `usado=true`; o link pode ser reutilizado até expirar.

**Correção:** validar primeiro o cliente por `id + user_id`; guardar `user_id` na tabela de magic link; permitir domínio de origem somente por allowlist; se a intenção é uso único, consumir o token com update condicional (`usado=false`) no banco antes de retornar os dados.

---

## M-07 — Geração de contrato/comprovante injeta dados sem escape em HTML

**Evidência:** `server/routers.ts:1618-1745`; `client/src/lib/gerarComprovante.ts:23-126`.

**Cenário:** nome de cliente, empresa, endereço, descrição ou `logoUrl` contendo caracteres HTML/atributos é interpolado diretamente em template e colocado em `innerHTML`. Um cliente importado com `<img onerror=...>` pode executar código no navegador do operador ao gerar comprovante.

**Correção:** escapar conteúdo texto e permitir logo somente com URL HTTPS validada. Não usar `innerHTML` com dados não confiáveis quando JSX/DOM seguro for possível.

```ts
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const clienteNome = escapeHtml(dados.clienteNome);
const nomeEmpresa = escapeHtml(dados.nomeEmpresa ?? "CobraPro");
const logoUrl = isHttpsUrl(dados.logoUrl) ? dados.logoUrl : undefined;
```

---

## M-08 — Registro e reset de senha não possuem proteção de força bruta, unicidade robusta ou consumo atômico

**Evidência:** `server/authRoutes.ts:98-409`; `drizzle/schema.ts:48-62`, `345-353`.

**Cenários:** não há rate limiting em login, cadastro, esqueci-senha ou reset. Senhas de 6 caracteres são aceitas. `users.email` não tem `UNIQUE`; duas requisições simultâneas de registro podem passar na checagem e duplicar e-mail; se a base estivesse vazia, duas corridas poderiam obter papel admin. Reset token é armazenado em texto puro e duas chamadas concorrentes podem usar o mesmo token antes de `usado=true`.

**Correção:** rate limit por IP+conta, CAPTCHA após falhas, senha mínima mais forte, índice único case-insensitive para e-mail, hash de token de reset, consumo condicional em transação e expiração de sessões ao trocar senha.

---

## M-09 — URL de reset aceita origem fornecida pelo cabeçalho do cliente

**Evidência:** `server/authRoutes.ts:282-285`.

**Cenário:** atacante envia `Origin: https://dominio-malicioso.example`, solicita reset para vítima e o e-mail contém link para o domínio atacante com token. Se a vítima abrir, o token pode ser capturado.

**Correção:** usar URL canônica configurada em ambiente, não `req.headers.origin`.

```ts
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL;
if (!APP_PUBLIC_URL) throw new Error("APP_PUBLIC_URL não configurada");
const resetUrl = new URL(`/reset-senha?token=${encodeURIComponent(token)}`, APP_PUBLIC_URL).toString();
```

---

## M-10 — Relatórios e consultas de caixa têm limite silencioso e N+1 excessivo

**Evidência:** `server/routers.ts:45-59`, `89-208`, `299-349`, `713-844`, `2688-2745`.

**Cenários:** `listarTransacoesCaixaDoUsuario` para após 100 páginas de mil registros e passa a calcular saldo sem lançamentos mais antigos, sem avisar. Dashboard executa agregações por conta; score de clientes consulta parcelas cliente a cliente; tendência consulta seis períodos separadamente. Em uma base maior isso aumentará latência e poderá gerar saldo incompleto após 100 mil movimentos.

**Correção:** somas com SQL `GROUP BY`, paginação verdadeira/cursor, índice `(user_id, conta_caixa_id, data_transacao)` e endpoint de relatório agregado. Nunca truncar dados financeiros sem sinalizar erro.

---

## M-11 — Consultas de lista não limitadas e parâmetro de transações sem teto

**Evidência:** `server/routers.ts:377-417`, `713-844`, `2747-2805`.

**Cenário:** cliente busca todos os registros e filtra em memória; `caixa.transacoes` recebe `limit` sem máximo. Um usuário pode pedir um número muito alto e consumir memória/CPU/banco.

**Correção:** paginação obrigatória, `z.number().int().min(1).max(200).default(50)`, filtros por banco e índices adequados.

---

## M-12 — Worker de WhatsApp escala de forma linear e sem limite de tentativas/alerta por tenant

**Evidência:** `server/services/notificacoesAutomaticas.ts:74-127`, `130-186`.

**Cenário:** para cada assinante ativo, busca regras e configurações; para cada regra, busca parcelas; para cada parcela, faz upsert individual. Em volume, essa rotina pode exceder a janela de cinco minutos. Falhas de conexão repetem indefinidamente e não há limite/alerta de tentativas.

**Correção:** query set-based/RPC para elegíveis, lote de inserts, índice adequado, tentativas máximas, status terminal e alerta ao gestor da empresa quando a instância permanecer desconectada.

---

## M-13 — Drift entre schema Drizzle e produção e caminhos “Drizzle” mortos

**Evidência:** `server/db.ts:104-113`; `drizzle/schema.ts`; exceções/fallbacks em `server/routers.ts`.

**Cenário:** `getDb()` sempre retorna `null`; portanto a maior parte dos caminhos Drizzle presentes não executa em produção, mas permanece no código e em alguns lugares não tem os mesmos filtros de autorização. O schema usa nomes camelCase em vários mapeamentos enquanto o Supabase produtivo usa snake_case. O projeto já apresentou erros de schema cache/tabela ausente em produção.

**Correção:** escolher uma arquitetura: (a) Supabase REST como fonte única, com tipos gerados do banco e migrations aplicadas de forma controlada; ou (b) corrigir schema/mapeamentos e reativar Drizzle com conexão PostgreSQL. Não manter dois caminhos de escrita divergentes.

---

# 5. Achados baixos

## B-01 — Bundle de front-end grande para uso móvel

O build concluiu, mas gerou chunks grandes: `vendor-libs` com aproximadamente 1,35 MB (398 KB gzip), bundle principal com aproximadamente 1,25 MB (245 KB gzip) e vendor de XLSX com aproximadamente 429 KB. O Vite emitiu alerta de chunks acima de 600 KB. Isto prejudica primeiro carregamento em 4G e dispositivos simples.

**Correção:** `React.lazy`/import dinâmico para módulos de Blacklist, relatórios, gerador de PDF e XLSX; importar bibliotecas pesadas apenas quando o botão correspondente for usado.

## B-02 — Migração operacional não garante aplicação nem políticas

`drizzle/0012_confiabilidade_operacional.sql` cria tabelas úteis de outbox/idempotência, mas não inclui RLS, FKs de tenant para todos os IDs ou mecanismo de auditoria imutável. Há histórico de ambiente no qual tabelas operacionais não estavam disponíveis, o que mostra que a aplicação de migrations precisa ser bloqueante no deploy.

**Correção:** migrar via pipeline único, validar schema após deploy e manter tabela `schema_migrations`/health check que verifica as tabelas essenciais antes de liberar tráfego.

## B-03 — Webhook Evolution grava payload completo e dados pessoais sem retenção

`whatsapp_eventos` armazena JSON completo de eventos, inclusive texto recebido e JIDs, sem `user_id`, retenção ou mascaramento. Cresce continuamente e aumenta a superfície de privacidade.

**Correção:** associar tenant, reter apenas metadados necessários, mascarar conteúdo, expirar eventos antigos e restringir acesso.

## B-04 — `normalizarTelefoneWhatsApp` não valida DDD/regras de número brasileiro

Aceita apenas tamanho de 12–13 dígitos após prefixo. Números impossíveis ainda podem chegar à Evolution e virar falhas de fila.

**Correção:** validar DDD e estrutura de celular/fixo com biblioteca/regex mantida, conservando a normalização de JID que já foi corrigida.

## B-05 — `randomSuffix()` da Blacklist não é criptograficamente seguro

`Math.random()` é usado em chaves de foto. Não é a causa principal de vulnerabilidade porque storage usa caminho mais longo, mas deve ser substituído por `crypto.randomUUID()`.

---

# 6. Dependências vulneráveis observadas

O comando `pnpm audit --prod` reportou, entre outros:

| Gravidade | Dependência | Situação observada | Ação |
|---|---|---|---|
| Crítico | `fast-xml-parser` transitivo do AWS SDK | versão vulnerável a bypass/DoS de entidades XML | Atualizar AWS SDK/lockfile até versão corrigida de `fast-xml-parser` |
| Crítico | `proxy-addr` via Express 4.21.2 | spoofing de IP em condição IPv4-mapped IPv6 | Atualizar Express para versão que traga `proxy-addr >= 2.0.8` |
| Alto | `xlsx` 0.18.5 | prototype pollution e ReDoS; audit informa que não há versão corrigida disponível nesse pacote | Remover/substituir por biblioteca mantida, ou isolar processamento de arquivo fora do processo web |
| Alto | `@trpc/server` 11.6.0 | advisory de prototype pollution corrigido em 11.8.0 | Atualizar `@trpc/*` de forma coordenada para >= 11.8.0 |
| Alto | Rollup/Vite e `picomatch` | vulnerabilidades de path traversal/ReDoS em versões transitivas | Atualizar Vite/Rollup/lockfile |
| Alto | `lodash-es` transitivo | advisory de code injection | Atualizar a cadeia `streamdown`/Mermaid/Langium conforme versões compatíveis |

Antes do upgrade, fazer branch próprio, regenerar lockfile, rodar teste completo, build e smoke test de PDF/XLSX/WhatsApp.

---

# 7. Plano de correção recomendado

## Fase 0 — Contenção imediata (mesmo dia)

1. **Remover/publicar sem** `/api/auth/seed-admin` e as rotas `/api/admin/migration-*`.
2. Rotacionar senha administrativa ligada ao bootstrap e todos os segredos de webhook que possam ter sido expostos em histórico de código.
3. Desativar temporariamente o webhook Kiwify até validar assinatura real. Não aceitar compra aprovada por corpo não autenticado.
4. Proteger ou suspender `/api/upload` até autenticação, limites e MIME allowlist.
5. Impedir `pagarTotal` de marcar parcelas como pagas até existir lançamento financeiro transacional.
6. Restringir o uso da Blacklist para equipe administrativa até haver política de governança e minimização de dados.

## Fase 1 — Integridade de dinheiro e tenants (1–3 dias de engenharia)

1. Criar migration de saneamento de `user_id`, FKs, índices e `UNIQUE(user_id, contrato_id, numero_parcela)`.
2. Criar RPCs transacionais para: pagamento de parcela, pagamento parcial, renovação de juros, quitação, reparcelamento, despesa, cheque e venda de telefone.
3. Corrigir cada endpoint BOLA, sempre começando por obter o registro com `id + user_id`.
4. Tornar Caixa um livro razão imutável: estorno é novo lançamento inverso; nunca apagar/editar lançamento financeiro já conciliado.
5. Criar reconciliação que compare operações financeiras, parcelas e transações de caixa e liste divergências sem alterar dados automaticamente.

## Fase 2 — Automação WhatsApp confiável (1–2 dias)

1. Autenticar webhook Evolution e associar instância ao tenant.
2. Persistir `provider_message_id` em outbox e log, atualizar status por webhook.
3. Implementar recuperação de lease, limite de tentativas, status terminal e alertas.
4. Alterar UI: “Aceita pela Evolution” não é “Entregue”; mostrar linha do tempo com data/hora, ID do provedor e última falha.
5. Marcar relatório diário como concluído somente após confirmação do worker; manter deduplicação por dia.

## Fase 3 — Qualidade, testes e escala (contínua)

1. Fazer a suíte obrigatória passar antes de deploy: `pnpm check`, `pnpm test`, `pnpm build`, auditoria de dependências sem críticos.
2. Adicionar testes de autorização para cada rota: usuário A não lê/edita/exclui ID do usuário B.
3. Adicionar testes de data às 20:59, 21:00, 23:59 e 00:00 em `America/Sao_Paulo`.
4. Adicionar testes de falha em cada etapa de operação financeira e assegurar rollback completo.
5. Implementar paginação/agregação SQL e code splitting do front-end.

---

# 8. Critérios objetivos para liberar produção após as correções

A próxima versão só deve ser liberada quando todos os itens abaixo estiverem comprovados em staging:

- [ ] Nenhuma rota pública cria admin, executa migration ou aceita webhook sem autenticação verificável.
- [ ] Upload exige sessão, tamanho/tipo validado e armazenamento segregado por tenant.
- [ ] Toda mutation de dados de negócio contém validação de `user_id`; testes A/B confirmam que não há acesso cruzado.
- [ ] Pagamento, renovação, parcial, quitação, reparcelamento e venda realizam transação única no banco ou RPC transacional equivalente.
- [ ] Uma falha simulada de Caixa não deixa parcela, contrato, próxima parcela ou relatório em estado parcial.
- [ ] Uma parcela que vence hoje às 23:59 BRT continua sem multa; torna-se atrasada apenas depois de 00:00 BRT do dia seguinte.
- [ ] UI de WhatsApp separa “aceito”, “enviado”, “entregue” e “lido”; teste de mensagem possui correlação com o callback do provedor.
- [ ] Mensagem com lease expirado volta automaticamente à fila e falhas acima do limite ficam visíveis ao operador.
- [ ] `pnpm check`, `pnpm test` e `pnpm build` passam integralmente.
- [ ] `pnpm audit --prod` não aponta vulnerabilidades críticas; dependências de alto risco têm plano de mitigação aprovado.

---

## Anexo — Nota sobre o erro de Caixa e a renovação relatados

Os relatos de “o sistema não debita/adiciona corretamente no Caixa” e “renovação não consta como paga até recriar empréstimo” são coerentes com três padrões identificados:

1. **Falha engolida:** vendas de telefone retornam sucesso mesmo quando o lançamento no Caixa falha.
2. **Sequência sem transação:** renovação e pagamento parcial executam várias escritas independentes. Uma falha no meio deixa somente parte do fluxo persistida.
3. **Fonte de verdade divergente:** alguns caminhos calculam saldo pelo livro de transações, outros ainda manipulam status/parcelas sem garantir o lançamento; há caminhos Drizzle mortos e caminhos REST produtivos distintos.

A correção confiável não é adicionar mais `try/catch` ou novos ajustes manuais. É transferir as mutações financeiras compostas para uma transação no PostgreSQL, manter o livro-caixa imutável e aplicar reconciliação automática baseada nessa mesma transação.
