import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Pool, types } from "pg";
import { createAdapter } from "./adapter.mjs";

if (
  !process.env.PGHOST?.startsWith("/tmp/cobrapro-whatsapp-safe.") ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_URL
)
  throw Error("Somente socket privado sem credenciais remotas");
types.setTypeParser(1082, value => value);
const pool = new Pool({ max: 16 });
const sb = createAdapter(pool);
globalThis.__whatsappSafeDb = sb;
let gets = 0,
  posts = 0,
  mode = "ok",
  preGet = null;
globalThis.fetch = async (url, options = {}) => {
  assert.ok(
    String(url).startsWith("https://evolution.invalid/"),
    "Rede real proibida"
  );
  if (options.method === "GET") {
    gets++;
    if (preGet) await preGet();
    if (mode === "get-network") throw Error("Synthetic GET failure");
    if (String(url).includes("/instance/connect/"))
      return new Response(JSON.stringify({ base64: "synthetic-qr" }), {
        status: 200,
      });
    return new Response(
      JSON.stringify({
        instance: {
          state:
            mode === "connecting"
              ? "connecting"
              : mode === "disconnected"
                ? "close"
                : "open",
        },
      }),
      { status: 200 }
    );
  }
  assert.equal(options.method, "POST");
  assert.ok(
    String(url).includes("/message/sendText/"),
    "Nenhuma criação/reconfiguração/QR"
  );
  posts++;
  if (mode === "post-network") throw Error("Synthetic failure after POST");
  if (mode === "timeout") throw new DOMException("synthetic", "TimeoutError");
  if (mode === "http500")
    return new Response(
      JSON.stringify({ message: "synthetic PII MUST NOT PERSIST" }),
      { status: 500 }
    );
  if (mode === "missing-id")
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  return new Response(
    JSON.stringify({ key: { id: "synthetic-provider-" + posts } }),
    { status: 200 }
  );
};
const worker = await import("./.build/worker.mjs");
const helper = await import("./.build/helper.mjs");
const provider = await import("./.build/provider.mjs");
const webhook = await import("./.build/webhook.mjs");
const { notificacoesRouter } = await import("./.build/router.mjs");
const caller = notificacoesRouter.createCaller({
  user: { id: 42, role: "user" },
});
let passed = 0;
async function test(name, fn) {
  await reset();
  await fn();
  passed++;
  console.log(`OK ${passed}: ${name}`);
}
const today = worker.obterDataBrasilia();
const future = worker.calcularDataAlvoBrasilia(5);
const ref = (date = today) => date;
const uuid = "11111111-1111-4111-8111-111111111111";
async function query(sql, values = []) {
  return (await pool.query(sql, values)).rows;
}
async function row(table, id) {
  return (await query(`SELECT * FROM ${table} WHERE id=$1`, [id]))[0];
}
async function reset() {
  sb.before = null;
  sb.after = null;
  sb.calls = [];
  gets = 0;
  posts = 0;
  mode = "ok";
  preGet = null;
  await pool.query(
    "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO service_role,anon,authenticated; CREATE TABLE configuracoes(user_id integer NOT NULL, chave text NOT NULL, valor text, UNIQUE(chave,user_id));"
  );
  const schema = await readFile(
    "drizzle/0012_confiabilidade_operacional.sql",
    "utf8"
  );
  await pool.query(schema);
  await pool.query(`CREATE TABLE clientes(id integer PRIMARY KEY,user_id integer,nome text,whatsapp text,telefone text);
    CREATE TABLE contratos(id integer PRIMARY KEY,user_id integer,cliente_id integer,numero_parcelas integer,status text);
    CREATE TABLE parcelas(id integer PRIMARY KEY,user_id integer,cliente_id integer,contrato_id integer,valor_original numeric,numero_parcela integer,status text,data_vencimento date);
    CREATE TABLE contas_caixa(id integer PRIMARY KEY,user_id integer);
    CREATE TABLE transacoes_caixa(id integer PRIMARY KEY,user_id integer,parcela_id integer,contrato_id integer,conta_caixa_id integer,valor numeric(15,2),tipo text,categoria text,data_transacao date);
    ALTER TABLE transacoes_caixa ADD COLUMN operacao_financeira_id uuid; -- 0015 opcional, sem cliente_id
    CREATE TABLE ciclo_operacoes(id uuid PRIMARY KEY,user_id integer,contrato_id integer,parcela_id integer,payload jsonb,hash_payload text,resultado jsonb,auditoria jsonb,concluida_em timestamptz);
    CREATE TABLE legados_operacoes(id uuid PRIMARY KEY,user_id integer,contrato_id integer,parcela_id integer,conta_id integer,payload jsonb,hash_payload text,resultado jsonb,concluida_em timestamptz);
    CREATE TABLE legados_auditoria(operacao_id uuid PRIMARY KEY,user_id integer,transacao_id integer,hash_payload text,resultado jsonb,depois jsonb);
    CREATE TABLE ciclo_pernas(operacao_id uuid PRIMARY KEY,user_id integer,transacao_id integer,snapshot jsonb);
    CREATE TABLE whatsapp_eventos(id bigserial,eventO text,instancia text,payload text,criado_em timestamptz);
    INSERT INTO configuracoes VALUES(42,'notificacoes_auto_ativo','true'),(42,'notificacoes_auto_horario','09:00'),(42,'nomeEmpresa','Empresa Sintética'),(42,'relatorio_diario_ativo','true'),(42,'relatorio_diario_telefone','5555999990000');
    INSERT INTO notificacoes_automaticas(user_id,tipo,ativo,mensagem_template,dias_antes) VALUES(42,'antes_vencimento_5',true,'Olá {nome} valor {valor}',5),(42,'confirmacao_pagamento',true,'Recebemos {valor}',0);
    INSERT INTO clientes VALUES(3,42,'Pessoa sintética','5555999990000',null);
    INSERT INTO contratos VALUES(2,42,3,6,'ativo');
    INSERT INTO contas_caixa VALUES(8,42);`);
  const migration34 = await readFile("drizzle/0034_rpc_recebimento_legado_validado.sql", "utf8");
  const proofSql = migration34.match(/CREATE FUNCTION public\.legados_prova_pagamento[\s\S]*?GRANT EXECUTE ON FUNCTION public\.legados_prova_pagamento\(integer,text,uuid\) TO service_role;/)?.[0];
  assert(proofSql, "Leitor único deve existir em 0034");
  await pool.query(proofSql);
  await pool.query("REVOKE ALL ON ciclo_operacoes,ciclo_pernas,legados_operacoes,legados_auditoria FROM PUBLIC,service_role,anon,authenticated");
  await pool.query(
    "INSERT INTO parcelas VALUES(1,42,3,2,123.45,1,'pendente',$1)",
    [future]
  );
}
async function queue(overrides = {}) {
  const obj = {
    userId: 42,
    tipo: "antes_vencimento_5",
    telefone: "(55) 99999-0000",
    mensagem: "Synthetic body NOT IN LOG",
    chaveDeduplicacao: "synthetic-" + crypto.randomUUID(),
    dataReferencia: today,
    parcelaId: 1,
    clienteId: 3,
    ...overrides,
  };
  await worker.enfileirarMensagemWhatsApp(obj);
  return (
    await query("SELECT id FROM whatsapp_outbox WHERE chave_deduplicacao=$1", [
      obj.chaveDeduplicacao,
    ])
  )[0].id;
}
async function receipt(id, status = "READ", user = 42) {
  const item = await row("whatsapp_outbox", id);
  return webhook.processWebhookEvent({
    event: "MESSAGES_UPDATE",
    instance: "user-" + user,
    data: [
      {
        key: {
          id: item.provider_message_id,
          fromMe: true,
          remoteJid: "synthetic-secret",
        },
        update: { status, message: { conversation: "secret raw PII" } },
      },
    ],
  });
}
async function proof({
  status = "concluida", source = "operacoes_financeiras", complete = true, tenant = 42,
} = {}) {
  const regra = source === "legados_operacoes" ? "recebimento_legado_sem_recalculo_v1" : "recebimento_defaults_brt_v1";
  const r = { success: true, operationId: uuid, contratoId: 2, parcelaId: 1,
    contaCaixaId: 8, transacaoCaixaId: 7, valorRecebido: "123.45", status: "paga", dataPagamento: today, regra };
  const payload = { userId: tenant, contratoId: 2, parcelaId: 1, valorRecebido: "123.45", dataPagamento: today, regra };
  await pool.query("INSERT INTO transacoes_caixa(id,user_id,parcela_id,contrato_id,conta_caixa_id,valor,tipo,categoria,data_transacao,operacao_financeira_id) VALUES(7,$1,1,2,8,123.45,'entrada','pagamento_parcela',$2,$3)",
    [tenant, today, source === "operacoes_financeiras" ? uuid : null]);
  const tx = (await query("SELECT to_jsonb(t) r FROM transacoes_caixa t WHERE id=7"))[0].r;
  if (source === "operacoes_financeiras") {
    await pool.query("INSERT INTO operacoes_financeiras(id,user_id,tipo,chave_idempotencia,hash_requisicao,status,resultado,concluida_em) VALUES($1,$2,'recebimento_parcela',$1,'synthetic',$3,$4,$5)",
      [uuid, tenant, status, r, complete ? new Date() : null]);
    await pool.query("INSERT INTO auditoria_financeira(id,user_id,operacao_id,acao,entidade,entidade_id,detalhes) VALUES($1,$2,$3,'registrar_pagamento_parcela','parcelas','1',$4)",
      [crypto.randomUUID(), tenant, uuid, { valorPago: "123.45", dataPagamento: today, payload: { parcelaId: 1, contaCaixaId: 8, valorPago: "123.45", dataPagamento: today } }]);
  } else if (source === "ciclo_operacoes") {
    await pool.query("INSERT INTO ciclo_operacoes VALUES($1,$2,2,1,$3,'synthetic',$4,$5,$6)",
      [uuid, tenant, payload, r, { resultado: r, payload, hashPayload: "synthetic", pernaId: 7 }, complete ? new Date() : null]);
    await pool.query("INSERT INTO ciclo_pernas VALUES($1,$2,7,$3)", [uuid, tenant, tx]);
  } else {
    await pool.query("INSERT INTO legados_operacoes VALUES($1,$2,2,1,8,$3,'synthetic',$4,$5)", [uuid, tenant, payload, r, complete ? new Date() : null]);
    await pool.query("INSERT INTO legados_auditoria VALUES($1,$2,7,'synthetic',$3,$4)", [uuid, tenant, r, { ledger: [tx] }]);
  }
}

try {
  await pool.query("CREATE ROLE postgres NOLOGIN SUPERUSER; CREATE ROLE service_role NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;");
  const version = await query("SHOW server_version");
  assert.match(version[0].server_version, /^17\./);
  assert.equal((await query("SHOW listen_addresses"))[0].listen_addresses, "");
  console.log(
    "PostgreSQL " +
      version[0].server_version +
      "; listen_addresses vazio; socket privado 0700; fetch mock sem rede."
  );
  await test("NOT NULL e índice parcial reais são reproduzidos e helper evita 42P10", async () => {
    const id = await queue();
    await assert.rejects(
      pool.query(
        "UPDATE whatsapp_outbox SET proxima_tentativa_em=NULL WHERE id=$1",
        [id]
      ),
      e => e.code === "23502"
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO notificacoes_log(outbox_id,user_id,tipo,status) VALUES($1,42,'teste','lido') ON CONFLICT(outbox_id) DO UPDATE SET status='enviado'",
        [id]
      ),
      e => e.code === "42P10"
    );
    await helper.persistirHistoricoWhatsApp(
      sb,
      {
        id,
        user_id: 42,
        tipo: "antes_vencimento_5",
        parcela_id: 1,
        cliente_id: 3,
      },
      "aceito_evolution"
    );
    await helper.persistirHistoricoWhatsApp(
      sb,
      {
        id,
        user_id: 42,
        tipo: "antes_vencimento_5",
        parcela_id: 1,
        cliente_id: 3,
      },
      "lido"
    );
    assert.equal(
      (await query("SELECT status FROM notificacoes_log"))[0].status,
      "lido"
    );
    assert.ok(
      !sb.calls.some(c => c.table === "notificacoes_log" && c.op === "upsert")
    );
  });
  await test("aceite persiste timestamp terminal e apenas aceito_evolution no histórico, sem PII", async () => {
    const id = await queue();
    const r = await worker.processarFilaWhatsApp();
    assert.equal(r.enviadas, 1);
    assert.equal(posts, 1);
    const item = await row("whatsapp_outbox", id);
    assert.equal(item.status, "enviado");
    assert.ok(item.proxima_tentativa_em);
    assert.ok(item.provider_message_id);
    const log = (await query("SELECT * FROM notificacoes_log"))[0];
    assert.equal(log.status, "aceito_evolution");
    assert.equal(log.mensagem, null);
    assert.equal(log.telefone, null);
  });
  for (const failure of ["post-network", "timeout", "http500", "missing-id"])
    await test("pós-POST " + failure + " nunca autoriza reenvio", async () => {
      const id = await queue();
      mode = failure;
      let r = await worker.processarFilaWhatsApp();
      assert.equal(r.ambiguas, 1);
      assert.equal(r.enviadas, 0);
      assert.equal((await row("whatsapp_outbox", id)).status, "desconhecido");
      await worker.processarFilaWhatsApp();
      assert.equal(posts, 1);
      const logs = JSON.stringify(
        await query("SELECT * FROM notificacoes_log")
      );
      assert.ok(!logs.includes("PII"));
      assert.ok(!logs.includes("Synthetic body"));
    });
  await test("falha de UPDATE pós-aceite compensa como desconhecido preservando ID e aceita prova posterior lido", async () => {
    const id = await queue();
    sb.before = q =>
      q.table === "whatsapp_outbox" &&
      q.op === "update" &&
      q.values.status === "enviado"
        ? { code: "XX000", message: "synthetic" }
        : null;
    const r = await worker.processarFilaWhatsApp();
    assert.equal(r.enviadas, 0);
    assert.equal(r.ambiguas, 1);
    const item = await row("whatsapp_outbox", id);
    assert.equal(item.status, "desconhecido");
    assert.ok(item.provider_message_id);
    await receipt(id);
    assert.equal(
      (await query("SELECT status FROM notificacoes_log"))[0].status,
      "lido"
    );
    sb.before = null;
    await worker.processarFilaWhatsApp();
    assert.equal(posts, 1);
  });
  await test("falha persistência pós-POST e compensação também falha: lease expira para desconhecido sem segundo POST", async () => {
    const id = await queue();
    sb.before = q =>
      posts > 0 &&
      q.table === "whatsapp_outbox" &&
      q.op === "update" &&
      ["enviado", "desconhecido"].includes(q.values.status)
        ? { code: "XX000", message: "synthetic" }
        : null;
    let r = await worker.processarFilaWhatsApp();
    assert.equal(r.enviadas, 0);
    assert.equal(r.ambiguas, 1);
    assert.equal((await row("whatsapp_outbox", id)).status, "enviando");
    sb.before = null;
    await pool.query(
      "UPDATE whatsapp_outbox SET lease_expira_em=NOW()-INTERVAL '1 second' WHERE id=$1",
      [id]
    );
    r = await worker.processarFilaWhatsApp();
    assert.equal(r.ambiguas, 1);
    assert.equal((await row("whatsapp_outbox", id)).status, "desconhecido");
    assert.equal(posts, 1);
  });
  await test("falha do histórico não devolve outbox aceita à fila", async () => {
    const id = await queue();
    sb.before = q =>
      q.table === "notificacoes_log"
        ? { code: "XX000", message: "synthetic" }
        : null;
    await worker.processarFilaWhatsApp();
    sb.before = null;
    await worker.processarFilaWhatsApp();
    assert.equal(posts, 1);
    assert.equal((await row("whatsapp_outbox", id)).status, "enviado");
  });
  await test("GET sem rede é prova anterior ao POST e permite backoff seguro", async () => {
    const id = await queue();
    mode = "get-network";
    const r = await worker.processarFilaWhatsApp();
    assert.equal(r.aguardandoReconexao, 1);
    assert.equal(posts, 0);
    assert.equal((await row("whatsapp_outbox", id)).status, "pendente");
  });
  await test("dois workers concorrentes só fazem um POST", async () => {
    await queue();
    await Promise.all([
      worker.processarFilaWhatsApp(),
      worker.processarFilaWhatsApp(),
    ]);
    assert.equal(posts, 1);
    assert.equal(
      (await query("SELECT count(*)::int n FROM notificacoes_log"))[0].n,
      1
    );
  });
  await test("callback entre persistência outbox e histórico worker não regride lido", async () => {
    const id = await queue();
    let hit = false;
    sb.after = async q => {
      if (
        !hit &&
        q.table === "whatsapp_outbox" &&
        q.op === "update" &&
        q.values.status === "enviado"
      ) {
        hit = true;
        await receipt(id);
      }
    };
    await worker.processarFilaWhatsApp();
    assert.equal(
      (await query("SELECT status FROM notificacoes_log"))[0].status,
      "lido"
    );
  });
  await test("30 callbacks concorrentes e worker de aceite: um log, estado lido monotônico", async () => {
    const id = await queue();
    await pool.query(
      "UPDATE whatsapp_outbox SET provider_message_id='synthetic-bound' WHERE id=$1",
      [id]
    );
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        i % 3 === 0
          ? helper.persistirHistoricoWhatsApp(
              sb,
              {
                id,
                user_id: 42,
                tipo: "antes_vencimento_5",
                parcela_id: 1,
                cliente_id: 3,
              },
              "aceito_evolution"
            )
          : receipt(id, i % 3 === 1 ? "DELIVERY_ACK" : "READ")
      )
    );
    const logs = await query("SELECT * FROM notificacoes_log");
    assert.equal(logs.length, 1);
    assert.equal(logs[0].status, "lido");
    assert.equal(logs[0].tipo, "antes_vencimento_5");
  });
  await test("callback pré-vínculo pede retry; vínculo tenant incorreto nunca avança", async () => {
    const id = await queue();
    const payload = {
      event: "MESSAGES_UPDATE",
      instance: "user-42",
      data: {
        key: { id: "not-bound", fromMe: true },
        update: { status: "READ" },
      },
    };
    await assert.rejects(webhook.processWebhookEvent(payload), /Outbox/);
    await pool.query(
      "UPDATE whatsapp_outbox SET provider_message_id='not-bound' WHERE id=$1",
      [id]
    );
    await assert.rejects(
      webhook.processWebhookEvent({ ...payload, instance: "user-99" }),
      /Outbox/
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM notificacoes_log"))[0].n,
      0
    );
    await webhook.processWebhookEvent(payload);
    assert.equal(
      (await query("SELECT status FROM notificacoes_log"))[0].status,
      "lido"
    );
  });
  await test("handler HTTP autenticado recusa token, pede 503 antes do vínculo e retorna 200 após persistir recibo", async () => {
    let handler;
    webhook.registerWebhookRoutes({
      post(path, h) {
        handler = h;
      },
      get() {},
    });
    const id = await queue();
    const body = {
      event: "MESSAGES_UPDATE",
      instance: "user-42",
      data: {
        key: { id: "synthetic-http", fromMe: true },
        update: { status: "READ" },
      },
    };
    async function invoke(token) {
      const res = {
        code: 200,
        status(n) {
          this.code = n;
          return this;
        },
        json(body) {
          this.body = body;
          return this;
        },
      };
      await handler(
        {
          body,
          header() {
            return token;
          },
          query: {},
        },
        res
      );
      return res;
    }
    assert.equal((await invoke("wrong-token")).code, 401);
    assert.equal(
      (await query("SELECT count(*)::int n FROM whatsapp_eventos"))[0].n,
      0
    );
    const old = console.error;
    console.error = () => {};
    try {
      assert.equal((await invoke("synthetic-webhook-token")).code, 503);
    } finally {
      console.error = old;
    }
    await pool.query(
      "UPDATE whatsapp_outbox SET provider_message_id='synthetic-http' WHERE id=$1",
      [id]
    );
    assert.equal((await invoke("synthetic-webhook-token")).code, 200);
    assert.equal(
      (await query("SELECT status FROM notificacoes_log"))[0].status,
      "lido"
    );
  });
  await test("produtor por vencimento jamais gera confirmação pendente", async () => {
    await pool.query(
      "UPDATE notificacoes_automaticas SET ativo=false WHERE tipo<>'confirmacao_pagamento'"
    );
    await pool.query("UPDATE parcelas SET data_vencimento=$1", [today]);
    const r = await worker.enfileirarLembretesAutomaticos(
      new Date(today + "T12:05:00Z")
    );
    assert.equal(r.enfileiradas, 0);
    assert.equal(
      (await query("SELECT count(*)::int n FROM whatsapp_outbox"))[0].n,
      0
    );
    await assert.rejects(
      worker.enfileirarMensagemWhatsApp({
        userId: 42,
        tipo: "confirmacao_pagamento",
        telefone: "5555999990000",
        mensagem: "not proven",
        parcelaId: 1,
        clienteId: 3,
        dataReferencia: today,
        chaveDeduplicacao: "synthetic-invalid",
      }),
      /PROVA_DURAVEL/
    );
  });
  await test("produtor exclui antecessor renovada mesmo com saldo principal transferido", async () => {
    await pool.query("ALTER TABLE parcelas ADD COLUMN saldo_residual numeric");
    await pool.query(
      "UPDATE parcelas SET status='renovada', saldo_residual=123.45"
    );
    const r = await worker.enfileirarLembretesAutomaticos(
      new Date(today + "T12:05:00Z")
    );
    assert.equal(r.enfileiradas, 0);
    assert.equal(r.elegiveis, 0);
    assert.equal((await row("parcelas", 1)).status, "renovada");
    assert.equal(
      (await query("SELECT count(*)::int n FROM whatsapp_outbox"))[0].n,
      0
    );
    assert.ok(
      sb.calls
        .filter(c => c.table === "parcelas")
        .every(c =>
          c.filters.some(
            ([k, op, v]) =>
              k === "status" &&
              op === "in" &&
              JSON.stringify(v) === JSON.stringify(["pendente", "atrasada"])
          )
        )
    );
  });
  for (const state of ["processando", "falha"])
    await test(
      "pagamento " + state + " não enfileira confirmação",
      async () => {
        await proof({ status: state });
        await assert.rejects(
          worker.enfileirarConfirmacaoPagamento(
            42,
            "operacoes_financeiras",
            uuid
          ),
          /PROVA_DURAVEL/
        );
        assert.equal(posts, 0);
      }
    );
  await test("operação concluída sem timestamp/perna de Caixa válida não é prova", async () => {
    await proof({ complete: false });
    assert.equal(
      await helper.obterProvaPagamento(sb, 42, "operacoes_financeiras", uuid),
      null
    );
    await pool.query("UPDATE operacoes_financeiras SET concluida_em=NOW()");
    await pool.query("UPDATE transacoes_caixa SET user_id=99");
    assert.equal(
      await helper.obterProvaPagamento(sb, 42, "operacoes_financeiras", uuid),
      null
    );
    assert.equal(
      await helper.obterProvaPagamento(sb, 99, "operacoes_financeiras", uuid),
      null
    );
  });
  for (const source of ["operacoes_financeiras", "ciclo_operacoes", "legados_operacoes"])
    await test(
      "confirmação " + source + " somente prova concluída e chave idempotente",
      async () => {
        await proof({ source });
        await pool.query("UPDATE parcelas SET status='paga'");
        await pool.query("UPDATE contratos SET status='quitado'");
        await Promise.all([
          worker.enfileirarConfirmacaoPagamento(42, source, uuid),
          worker.enfileirarConfirmacaoPagamento(42, source, uuid),
        ]);
        assert.equal(
          (await query("SELECT count(*)::int n FROM whatsapp_outbox"))[0].n,
          1
        );
        const r = await worker.processarFilaWhatsApp();
        assert.equal(r.enviadas, 1);
        assert.equal(posts, 1);
      }
    );
  await test("tRPC de confirmação usa prova durável do tenant e não aceita referência sem prova", async () => {
    await assert.rejects(
      caller.confirmarPagamento({
        fonte: "operacoes_financeiras",
        operacaoId: uuid,
      }),
      /prova durável/
    );
    await proof();
    const result = await caller.confirmarPagamento({
      fonte: "operacoes_financeiras",
      operacaoId: uuid,
    });
    assert.equal(result.criada, true);
    const other = notificacoesRouter.createCaller({
      user: { id: 99, role: "user" },
    });
    await assert.rejects(
      other.confirmarPagamento({
        fonte: "operacoes_financeiras",
        operacaoId: uuid,
      }),
      /prova durável/
    );
    assert.equal(posts, 0);
  });
  for (const condition of [
    "paga",
    "renovada",
    "global-off",
    "rule-off",
    "tenant",
    "due-date",
    "expired",
  ])
    await test("revalidação cancela " + condition + " sem POST", async () => {
      const id = await queue(
        condition === "expired"
          ? { dataReferencia: worker.calcularDataAlvoBrasilia(-1) }
          : {}
      );
      if (condition === "paga")
        await pool.query("UPDATE parcelas SET status='paga'");
      if (condition === "renovada")
        await pool.query("UPDATE parcelas SET status='renovada'");
      if (condition === "global-off")
        await pool.query(
          "UPDATE configuracoes SET valor='false' WHERE chave='notificacoes_auto_ativo'"
        );
      if (condition === "rule-off")
        await pool.query("UPDATE notificacoes_automaticas SET ativo=false");
      if (condition === "tenant")
        await pool.query("UPDATE clientes SET user_id=99");
      if (condition === "due-date")
        await pool.query("UPDATE parcelas SET data_vencimento=$1", [today]);
      const r = await worker.processarFilaWhatsApp();
      assert.equal(r.canceladas, 1);
      assert.equal(posts, 0);
      assert.equal((await row("whatsapp_outbox", id)).status, "cancelado");
      assert.ok((await row("whatsapp_outbox", id)).proxima_tentativa_em);
      if (condition === "renovada")
        assert.equal((await row("parcelas", 1)).status, "renovada");
    });
  await test("baixa durante GET é revalidada imediatamente antes do POST", async () => {
    const id = await queue();
    preGet = async () => pool.query("UPDATE parcelas SET status='paga'");
    const r = await worker.processarFilaWhatsApp();
    assert.equal(posts, 0);
    assert.equal(r.canceladas, 1);
    assert.equal((await row("whatsapp_outbox", id)).status, "cancelado");
  });
  await test("lease tomado/expirado durante GET impede POST do worker antigo", async () => {
    const id = await queue();
    preGet = async () => {
      await pool.query(
        "UPDATE whatsapp_outbox SET lease_expira_em=NOW()-INTERVAL '1 second' WHERE id=$1",
        [id]
      );
      await worker.recuperarLeasesExpiradosWhatsApp();
    };
    await worker.processarFilaWhatsApp();
    assert.equal(posts, 0);
    assert.equal((await row("whatsapp_outbox", id)).status, "desconhecido");
  });
  await test("telefone inválido primeiro item não interrompe segundo; dry-run valida sem escrever", async () => {
    await pool.query(
      "INSERT INTO clientes VALUES(4,42,'Synthetic invalid','123',null); INSERT INTO contratos VALUES(5,42,4,6,'ativo');"
    );
    await pool.query(
      "INSERT INTO parcelas VALUES(0,42,4,5,10,1,'pendente',$1)",
      [future]
    );
    const delayed = new Date(today + "T12:05:00Z");
    const dry = await worker.enfileirarLembretesAutomaticos(delayed, true);
    assert.equal(dry.falhasItens, 1);
    assert.equal(dry.elegiveis, 2);
    assert.equal(
      (await query("SELECT count(*)::int n FROM whatsapp_outbox"))[0].n,
      0
    );
    const real = await worker.enfileirarLembretesAutomaticos(delayed);
    assert.equal(real.falhasItens, 1);
    assert.equal(real.enfileiradas, 1);
  });
  await test("telefone inválido em outbox falha por item e não interrompe próximo envio", async () => {
    const invalid = await queue();
    await pool.query("UPDATE whatsapp_outbox SET telefone='123' WHERE id=$1", [
      invalid,
    ]);
    const valid = await queue();
    const r = await worker.processarFilaWhatsApp();
    assert.equal(r.processadas, 2);
    assert.equal(r.falhas, 1);
    assert.equal(r.enviadas, 1);
    assert.equal(posts, 1);
    assert.equal((await row("whatsapp_outbox", invalid)).status, "falhou");
    assert.equal((await row("whatsapp_outbox", valid)).status, "enviado");
  });
  await test("09:05 e 23:59 recuperam horário diário com dedup; meia-noite BRT expira", async () => {
    assert.equal(
      helper.horarioDiarioVencido("09:00", new Date(today + "T12:05:00Z")),
      true
    );
    await worker.enfileirarLembretesAutomaticos(new Date(today + "T12:05:00Z"));
    await worker.enfileirarLembretesAutomaticos(
      new Date(today + "T23:59:00-03:00")
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM whatsapp_outbox"))[0].n,
      1
    );
    assert.equal(
      helper.referenciaVigente(today, new Date(today + "T23:59:59-03:00")),
      true
    );
    assert.equal(
      helper.referenciaVigente(
        today,
        new Date(helper.fimDeValidadeBrasilia(today))
      ),
      false
    );
  });
  await test("dry-run consumidor revalida/normaliza sem DML nem provider", async () => {
    await queue();
    await pool.query("UPDATE whatsapp_outbox SET telefone='123'");
    sb.calls = [];
    const r = await worker.processarFilaWhatsApp(25, true);
    assert.equal(r.processadas, 1);
    assert.equal(r.falhas, 1);
    assert.equal(posts, 0);
    assert.equal(gets, 0);
    assert.ok(sb.calls.every(c => c.op === "select"));
  });
  await test("normalização nacional/internacional DDD55 em 10/11/12/13 dígitos", async () => {
    for (const [number, normalized] of [
      ["(55) 3333-0000", "555533330000"],
      ["(55) 99999-0000", "5555999990000"],
      ["+55 (55) 3333-0000", "555533330000"],
      ["+55 (55) 99999-0000", "5555999990000"],
      ["(11) 99999-0000", "5511999990000"],
    ])
      assert.equal(provider.normalizarTelefoneWhatsApp(number), normalized);
    for (const number of [
      "123",
      "001234567890",
      "555555999990000",
      "+54 11 99999-0000",
    ])
      assert.throws(() => provider.normalizarTelefoneWhatsApp(number));
  });
  await test("QR connecting permanece consulta/renovação GET sem criar/logout/delete", async () => {
    mode = "connecting";
    const snapshot = await provider.ensureConnection(42);
    assert.equal(snapshot.qrCode, "synthetic-qr");
    assert.equal(gets, 2);
    assert.equal(posts, 0);
  });
  await test("teste tRPC manual grava um log sem PII e falha pós-POST mostra ambiguidade", async () => {
    const result = await caller.testar({
      tipo: "no_vencimento",
      mensagem_template: "Olá teste {valor}",
      telefone: "(55) 99999-0000",
    });
    assert.equal(result.etapa, "aceito_evolution");
    assert.equal(
      (await query("SELECT count(*)::int n FROM notificacoes_log"))[0].n,
      1
    );
    mode = "post-network";
    await assert.rejects(
      caller.testar({
        tipo: "no_vencimento",
        mensagem_template: "Olá teste",
        telefone: "(55) 99999-0000",
      }),
      /ambíguo/
    );
    const statuses = (
      await query("SELECT status FROM whatsapp_outbox ORDER BY created_at")
    ).map(r => r.status);
    assert.deepEqual(statuses, ["enviado", "desconhecido"]);
    await worker.processarFilaWhatsApp();
    assert.equal(posts, 2);
  });
  console.log(
    `SUCESSO: ${passed}/${passed} cenários integrados, PostgreSQL 17 privado; zero rede/produto/QR real.`
  );
} finally {
  await pool.end();
  delete globalThis.__whatsappSafeDb;
}
