import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: vi.fn(), enviar: vi.fn() }));
vi.mock("./db", () => ({ getSupabaseClientAsync: mocks.db }));
vi.mock("./services/evolutionClient", async importOriginal => ({
  ...(await importOriginal<typeof import("./services/evolutionClient")>()),
  enviarMensagemEvolution: mocks.enviar,
}));

import {
  enfileirarLembretesAutomaticos,
  processarFilaWhatsApp,
  recuperarLeasesExpiradosWhatsApp,
  sincronizarMarcadoresDeRelatorioDiario,
} from "./services/notificacoesAutomaticas";

type Row = Record<string, any>;
type Call = {
  table: string;
  method: string;
  params: URLSearchParams;
  body: Row | null;
  affected: Row[];
};
type Fault = (call: Call, returned: Row[]) => Row[];
const NOW = new Date("2026-11-16T15:00:00.000Z");
const DAY = "2026-11-16";
const TENANT = 41;
const OTHER = 82;
const phone = (userId: number) =>
  userId === TENANT ? "5511999990041" : "5511999990082";
const outboxId = (userId: number, index: number) =>
  `00000000-0000-4000-8000-${String(userId * 100 + index).padStart(12, "0")}`;

function splitColumns(select: string): string[] {
  const columns: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < select.length; i++) {
    if (select[i] === "(") depth++;
    if (select[i] === ")") depth--;
    if (select[i] === "," && depth === 0) {
      columns.push(select.slice(start, i));
      start = i + 1;
    }
  }
  columns.push(select.slice(start));
  return columns;
}

// Projeta apenas as colunas solicitadas, inclusive os joins do produtor.
function project(row: Row, select: string): Row {
  if (select === "*") return structuredClone(row);
  return Object.fromEntries(
    splitColumns(select).map(column => {
      const nested = /^([^!(]+)(?:!inner)?\((.*)\)$/.exec(column);
      if (nested)
        return [
          nested[1],
          row[nested[1]] ? project(row[nested[1]], nested[2]) : null,
        ];
      return [column, row[column]];
    })
  );
}

function seed(): Record<string, Row[]> {
  const tables: Record<string, Row[]> = {
    configuracoes: [],
    notificacoes_automaticas: [],
    parcelas: [],
    contratos: [],
    clientes: [],
    whatsapp_outbox: [],
    whatsapp_tentativas: [],
    notificacoes_log: [],
  };
  for (const userId of [TENANT, OTHER]) {
    tables.configuracoes.push(
      ...Object.entries({
        notificacoes_auto_ativo: "true",
        notificacoes_auto_horario: "09:00",
        nomeEmpresa: `Empresa ${userId}`,
        relatorio_diario_ativo: "true",
        relatorio_diario_telefone: phone(userId),
      }).map(([chave, valor]) => ({ user_id: userId, chave, valor }))
    );
    tables.notificacoes_automaticas.push({
      user_id: userId,
      tipo: "no_vencimento",
      dias_antes: 0,
      ativo: true,
      mensagem_template: "Olá {nome}, {valor}, {empresa}",
    });
    const cliente = {
      id: userId * 10 + 1,
      user_id: userId,
      nome: `Cliente ${userId}`,
      whatsapp: phone(userId),
      telefone: "",
    };
    const contrato = {
      id: userId * 10 + 2,
      user_id: userId,
      cliente_id: cliente.id,
      status: "ativo",
      numero_parcelas: 3,
      clientes: cliente,
    };
    const parcela = {
      id: userId * 10 + 3,
      user_id: userId,
      cliente_id: cliente.id,
      contrato_id: contrato.id,
      status: "pendente",
      data_vencimento: DAY,
      valor_original: "150.00",
      numero_parcela: 1,
      contratos: contrato,
    };
    tables.clientes.push(cliente);
    tables.contratos.push(contrato);
    tables.parcelas.push(parcela);
    const base = {
      user_id: userId,
      telefone: phone(userId),
      mensagem: `Mensagem ${userId}`,
      parcela_id: parcela.id,
      cliente_id: cliente.id,
      data_referencia: DAY,
      tentativas: 0,
      proxima_tentativa_em: "2026-11-16T12:00:00.000Z",
      created_at: "2026-11-16T12:00:00.000Z",
      lease_expira_em: null,
    };
    tables.whatsapp_outbox.push(
      {
        ...base,
        id: outboxId(userId, 1),
        tipo: "no_vencimento",
        status: "pendente",
        chave_deduplicacao: `lembrete:${userId}:${parcela.id}:no_vencimento:${DAY}`,
      },
      {
        ...base,
        id: outboxId(userId, 2),
        tipo: "no_vencimento",
        status: "desconhecido",
        ultimo_erro: "ENVIO_AMBIGUO_RECONCILIACAO_MANUAL",
        chave_deduplicacao: `ambiguo:${userId}`,
      },
      {
        ...base,
        id: outboxId(userId, 3),
        tipo: "relatorio_diario",
        status: "enviado",
        provider_message_id: `sent-${userId}`,
        chave_deduplicacao: `relatorio-enviado:${userId}`,
      },
      {
        ...base,
        id: outboxId(userId, 4),
        tipo: "relatorio_diario",
        status: "enviando",
        lease_expira_em: "2026-11-16T12:01:00.000Z",
        chave_deduplicacao: `lease:${userId}`,
      }
    );
  }
  return tables;
}

// O SDK constrói URLs/verbos/CAS reais. O fetch local aplica filtros ANTES de ler
// ou escrever e retorna a projeção real, em vez de devolver respostas enlatadas.
function database() {
  const tables = seed();
  const calls: Call[] = [];
  const posts: { userId: number; telefone: string; mensagem: string }[] = [];
  let fault: Fault | undefined;
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://postgrest.invalid");
      const table = url.pathname.split("/").at(-1)!;
      expect(tables).toHaveProperty(table);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const params = url.searchParams;
      const matches = (row: Row) =>
        [...params.entries()].every(([column, expression]) => {
          if (["select", "order", "limit", "on_conflict"].includes(column))
            return true;
          const value = column.split(".").reduce((r, key) => r?.[key], row);
          const dot = expression.indexOf(".");
          const op = expression.slice(0, dot);
          const expected = expression.slice(dot + 1);
          if (op === "eq") return String(value) === expected;
          if (op === "in")
            return expected.slice(1, -1).split(",").includes(String(value));
          if (value == null) return false;
          if (op === "lt") return String(value) < expected;
          if (op === "lte") return String(value) <= expected;
          if (op === "gt") return String(value) > expected;
          throw new Error(`Filtro sintético não implementado: ${expression}`);
        });
      let affected: Row[] = [];
      if (method === "GET" || method === "PATCH") {
        affected = tables[table].filter(matches);
        const order = params.get("order");
        if (order) {
          const [column, direction] = order.split(".");
          affected.sort(
            (a, b) =>
              String(a[column]).localeCompare(String(b[column])) *
              (direction === "desc" ? -1 : 1)
          );
        }
        const limit = params.get("limit");
        if (limit) affected = affected.slice(0, Number(limit));
        if (method === "PATCH")
          affected.forEach(row => Object.assign(row, body));
      } else if (method === "POST") {
        const conflict = params.get("on_conflict")?.split(",") ?? [];
        const existing = conflict.length
          ? tables[table].find(row =>
              conflict.every(key => row[key] === body[key])
            )
          : undefined;
        const prefer = new Headers(init?.headers).get("prefer") ?? "";
        if (existing) {
          if (!prefer.includes("ignore-duplicates")) {
            Object.assign(existing, body);
            affected = [existing];
          }
        } else {
          const row = {
            id: `${table}-${tables[table].length + 1}`,
            createdAt: NOW.toISOString(),
            ...body,
          };
          tables[table].push(row);
          affected = [row];
        }
      } else throw new Error(`Verbo sintético não implementado: ${method}`);
      const call = {
        table,
        method,
        params: new URLSearchParams(params),
        body,
        affected: structuredClone(affected),
      };
      calls.push(call);
      const select = params.get("select");
      if (method !== "GET" && !select)
        return new Response(null, { status: 204 });
      let returned = affected.map(row => project(row, select ?? "*"));
      if (fault) returned = fault(call, returned);
      const accept = new Headers(init?.headers).get("accept");
      const payload = accept?.includes("vnd.pgrst.object")
        ? (returned[0] ?? null)
        : returned;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
  );
  const sb = createClient("https://postgrest.invalid", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchMock },
  });
  mocks.db.mockResolvedValue(sb);
  mocks.enviar.mockImplementation(
    async (
      userId: number,
      telefone: string,
      mensagem: string,
      guard: () => Promise<boolean>
    ) => {
      if (!(await guard()))
        return {
          ok: false,
          disposition: "nao_solicitado",
          erroCodigo: "GUARD",
        };
      posts.push({ userId, telefone, mensagem });
      return {
        ok: true,
        disposition: "aceito",
        providerMessageId: `synthetic-${userId}-${posts.length}`,
      };
    }
  );
  return {
    tables,
    calls,
    posts,
    fetchMock,
    setFault: (next: Fault) => {
      fault = next;
    },
  };
}

function snapshotTenant(db: ReturnType<typeof database>, userId: number) {
  return Object.fromEntries(
    Object.entries(db.tables).map(([table, rows]) => [
      table,
      structuredClone(rows.filter(row => row.user_id === userId)),
    ])
  );
}

function expectOnlyTenant(
  db: ReturnType<typeof database>,
  otherBefore: unknown
) {
  expect(snapshotTenant(db, OTHER)).toEqual(otherBefore);
  expect(db.calls.length).toBeGreaterThan(0);
  for (const call of db.calls) {
    if (call.method === "GET" || call.method === "PATCH")
      expect(call.params.get("user_id"), `${call.method} ${call.table}`).toBe(
        `eq.${TENANT}`
      );
    if (call.body?.user_id !== undefined)
      expect(call.body.user_id).toBe(TENANT);
    for (const row of call.affected) {
      if (call.table === "whatsapp_tentativas")
        expect(row.outbox_id).toBe(outboxId(TENANT, 1));
      else expect(row.user_id, `${call.method} ${call.table}`).toBe(TENANT);
    }
  }
  expect(
    db.posts.every(
      post => post.userId === TENANT && post.telefone === phone(TENANT)
    )
  ).toBe(true);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mocks.db.mockReset();
  mocks.enviar.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("WhatsApp — escopo opcional por tenant com SDK real sem rede", () => {
  const operations = [
    {
      name: "produtor",
      run: (userId: number) =>
        enfileirarLembretesAutomaticos(NOW, false, userId),
    },
    {
      name: "worker",
      run: (userId: number) => processarFilaWhatsApp(25, false, userId),
    },
    {
      name: "leases",
      run: (userId: number) => recuperarLeasesExpiradosWhatsApp(userId),
    },
    {
      name: "marcadores",
      run: (userId: number) =>
        sincronizarMarcadoresDeRelatorioDiario(DAY, 200, userId),
    },
  ];
  for (const { name, run } of operations) {
    it.each([
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      "41",
      null,
      true,
    ])(
      `${name}: escopo inválido %s falha ANTES de obter banco`,
      async value => {
        await expect(run(value as number)).rejects.toThrow(
          "USUARIO_ESCOPO_INVALIDO"
        );
        expect(mocks.db).not.toHaveBeenCalled();
        expect(mocks.enviar).not.toHaveBeenCalled();
      }
    );
  }

  it("produtor filtra a primeira configuração, regras e joins, sem ler ou recriar itens de outro tenant", async () => {
    const db = database();
    const before = snapshotTenant(db, OTHER);
    // Remove apenas no banco sintético a pendente do tenant, para exercitar INSERT.
    db.tables.whatsapp_outbox = db.tables.whatsapp_outbox.filter(
      row => row.id !== outboxId(TENANT, 1)
    );
    const result = await enfileirarLembretesAutomaticos(NOW, false, TENANT);
    expect(result).toEqual({
      usuariosNoHorario: 1,
      elegiveis: 1,
      enfileiradas: 1,
      falhasItens: 0,
    });
    expectOnlyTenant(db, before);
    expect(db.calls[0].params.get("user_id")).toBe(`eq.${TENANT}`);
    const parcelas = db.calls.find(call => call.table === "parcelas")!;
    expect(parcelas.params.get("contratos.user_id")).toBe(`eq.${TENANT}`);
    expect(parcelas.params.get("contratos.clientes.user_id")).toBe(
      `eq.${TENANT}`
    );
    expect(mocks.enviar).not.toHaveBeenCalled();
  });

  it("worker escopado recupera lease, reconcilia marcador e reserva/envia/registra só o dono, incluindo o lease guard", async () => {
    const db = database();
    const before = snapshotTenant(db, OTHER);
    const result = await processarFilaWhatsApp(25, false, TENANT);
    expect(result).toEqual({
      processadas: 1,
      enviadas: 1,
      falhas: 0,
      aguardandoReconexao: 0,
      ambiguas: 1,
      relatoriosConcluidos: 0,
      canceladas: 0,
    });
    expectOnlyTenant(db, before);
    expect(db.posts).toHaveLength(1);
    const guard = db.calls.find(
      call =>
        call.table === "whatsapp_outbox" &&
        call.method === "GET" &&
        call.params.has("lease_expira_em")
    )!;
    expect(guard.params.get("user_id")).toBe(`eq.${TENANT}`);
    expect(guard.params.get("id")).toBe(`eq.${outboxId(TENANT, 1)}`);
    expect(guard.params.get("status")).toBe("eq.enviando");
    expect(
      db.tables.whatsapp_outbox.find(row => row.id === outboxId(TENANT, 4))
        ?.status
    ).toBe("desconhecido");
    expect(db.tables.notificacoes_log).toHaveLength(2);
    expect(
      db.tables.configuracoes.find(
        row =>
          row.user_id === TENANT &&
          row.chave === "relatorio_diario_ultimo_envio"
      )?.valor
    ).toBe(DAY);
  });

  it("recuperação escopada não toca lease alheio e nunca devolve desconhecido para pendente", async () => {
    const db = database();
    const before = snapshotTenant(db, OTHER);
    expect(await recuperarLeasesExpiradosWhatsApp(TENANT)).toBe(1);
    expect(await recuperarLeasesExpiradosWhatsApp(TENANT)).toBe(0);
    expectOnlyTenant(db, before);
    expect(db.tables.notificacoes_log).toHaveLength(1);
    expect(mocks.enviar).not.toHaveBeenCalled();
  });

  it("reconciliação escopada só lê relatórios enviados do dono e grava seu marcador", async () => {
    const db = database();
    const before = snapshotTenant(db, OTHER);
    expect(await sincronizarMarcadoresDeRelatorioDiario(DAY, 200, TENANT)).toBe(
      1
    );
    expectOnlyTenant(db, before);
    expect(db.calls[0].params.get("status")).toBe("eq.enviado");
    expect(db.calls[0].params.get("tipo")).toBe("eq.relatorio_diario");
    expect(mocks.enviar).not.toHaveBeenCalled();
  });

  it("relatório pendente autorizado atualiza marcador apenas após prova de envio persistida", async () => {
    const db = database();
    const before = snapshotTenant(db, OTHER);
    db.tables.whatsapp_outbox.find(
      row => row.id === outboxId(TENANT, 1)
    )!.tipo = "relatorio_diario";
    const result = await processarFilaWhatsApp(25, false, TENANT);
    expect(result.enviadas).toBe(1);
    expect(result.relatoriosConcluidos).toBe(1);
    expectOnlyTenant(db, before);
    expect(
      db.tables.notificacoes_log.find(
        row => row.outbox_id === outboxId(TENANT, 1)
      )?.status
    ).toBe("aceito_evolution");
  });

  it("dryRun escopado somente lê, sem recuperação, reserva, envio ou marcador", async () => {
    const db = database();
    const before = snapshotTenant(db, OTHER);
    const ownBefore = snapshotTenant(db, TENANT);
    const producer = await enfileirarLembretesAutomaticos(NOW, true, TENANT);
    const worker = await processarFilaWhatsApp(25, true, TENANT);
    expect(producer.elegiveis).toBe(1);
    expect(producer.enfileiradas).toBe(0);
    expect(worker.processadas).toBe(1);
    expect(worker.enviadas).toBe(0);
    expectOnlyTenant(db, before);
    expect(snapshotTenant(db, TENANT)).toEqual(ownBefore);
    expect(db.calls.every(call => call.method === "GET")).toBe(true);
    expect(mocks.enviar).not.toHaveBeenCalled();
  });

  it("omissão de scope mantém produtor global e deduplicação nos dois tenants", async () => {
    const db = database();
    const before = structuredClone(db.tables.whatsapp_outbox);
    const result = await enfileirarLembretesAutomaticos(NOW);
    expect(result).toEqual({
      usuariosNoHorario: 2,
      elegiveis: 2,
      enfileiradas: 0,
      falhasItens: 0,
    });
    expect(db.calls[0].params.has("user_id")).toBe(false);
    expect(db.tables.whatsapp_outbox).toEqual(before);
    expect(
      db.calls
        .filter(call => call.table === "parcelas")
        .map(call => call.params.get("user_id"))
    ).toEqual([`eq.${TENANT}`, `eq.${OTHER}`]);
  });

  it("scheduler sem scope mantém recuperação, marcadores e processamento globais", async () => {
    const db = database();
    const result = await processarFilaWhatsApp();
    expect(result.processadas).toBe(2);
    expect(result.enviadas).toBe(2);
    expect(result.ambiguas).toBe(2);
    expect(result.falhas).toBe(0);
    expect(db.posts.map(post => post.userId)).toEqual([TENANT, OTHER]);
    const initial = db.calls.filter(
      call =>
        call.table === "whatsapp_outbox" &&
        ((call.method === "PATCH" &&
          call.params.get("status") === "eq.enviando" &&
          !call.params.has("id")) ||
          (call.method === "GET" && !call.params.has("id")))
    );
    expect(initial).toHaveLength(3);
    expect(initial.every(call => !call.params.has("user_id"))).toBe(true);
    expect(db.tables.notificacoes_log).toHaveLength(4);
    expect(
      db.tables.configuracoes
        .filter(row => row.chave === "relatorio_diario_ultimo_envio")
        .map(row => row.user_id)
    ).toEqual([TENANT, OTHER]);
  });

  it("helpers sem scope permanecem globais quando chamados diretamente", async () => {
    const db = database();
    expect(await recuperarLeasesExpiradosWhatsApp()).toBe(2);
    expect(await sincronizarMarcadoresDeRelatorioDiario()).toBe(2);
    expect(db.tables.notificacoes_log.map(row => row.user_id)).toEqual([
      TENANT,
      OTHER,
    ]);
  });

  it("produtor não recria lembrete desconhecido ou enviado com a mesma chave diária", async () => {
    const db = database();
    const before = snapshotTenant(db, OTHER);
    const pending = db.tables.whatsapp_outbox.find(
      row => row.id === outboxId(TENANT, 1)
    )!;
    for (const status of ["desconhecido", "enviado", "teste_envio"]) {
      pending.status = status === "teste_envio" ? "pendente" : status;
      pending.tipo = status === "teste_envio" ? "teste_envio" : "no_vencimento";
      const count = db.tables.whatsapp_outbox.length;
      expect(
        (await enfileirarLembretesAutomaticos(NOW, false, TENANT)).enfileiradas
      ).toBe(0);
      expect(db.tables.whatsapp_outbox).toHaveLength(count);
      expect(pending.status).toBe(
        status === "teste_envio" ? "pendente" : status
      );
      expect(pending.tipo).toBe(
        status === "teste_envio" ? "teste_envio" : "no_vencimento"
      );
    }
    expectOnlyTenant(db, before);
    expect(mocks.enviar).not.toHaveBeenCalled();
  });

  it("worker não reenvia desconhecidos/enviados/testes, inclusive lease recuperado na execução anterior", async () => {
    const db = database();
    const before = snapshotTenant(db, OTHER);
    db.tables.whatsapp_outbox.find(
      row => row.id === outboxId(TENANT, 1)
    )!.tipo = "teste_envio";
    const first = await processarFilaWhatsApp(25, false, TENANT);
    const second = await processarFilaWhatsApp(25, false, TENANT);
    expect(first.canceladas).toBe(1);
    expect(first.ambiguas).toBe(1);
    expect(second.processadas).toBe(0);
    expect(second.ambiguas).toBe(0);
    expect(db.posts).toHaveLength(0);
    expect(mocks.enviar).not.toHaveBeenCalled();
    expectOnlyTenant(db, before);
  });

  it("resposta ambígua fica desconhecida, sem tentativa automática na execução seguinte", async () => {
    const db = database();
    mocks.enviar.mockImplementation(
      async (_userId, _telefone, _mensagem, guard) => {
        expect(await guard()).toBe(true);
        return { ok: false, disposition: "incerto", erroCodigo: "TIMEOUT" };
      }
    );
    const first = await processarFilaWhatsApp(25, false, TENANT);
    const second = await processarFilaWhatsApp(25, false, TENANT);
    expect(first.ambiguas).toBe(2);
    expect(first.enviadas).toBe(0);
    expect(second.processadas).toBe(0);
    expect(mocks.enviar).toHaveBeenCalledTimes(1);
    expect(
      db.tables.whatsapp_outbox.find(row => row.id === outboxId(TENANT, 1))
        ?.status
    ).toBe("desconhecido");
  });

  it.each(["horario", "opt-in", "regra-desconhecida"])(
    "produtor preserva a política de %s",
    async policy => {
      const db = database();
      if (policy === "horario")
        db.tables.configuracoes.find(
          row =>
            row.user_id === TENANT && row.chave === "notificacoes_auto_horario"
        )!.valor = "13:00";
      if (policy === "opt-in")
        db.tables.configuracoes.find(
          row =>
            row.user_id === TENANT && row.chave === "notificacoes_auto_ativo"
        )!.valor = "false";
      if (policy === "regra-desconhecida")
        db.tables.notificacoes_automaticas.find(
          row => row.user_id === TENANT
        )!.tipo = "nao_autorizado";
      const result = await enfileirarLembretesAutomaticos(NOW, false, TENANT);
      expect(result.elegiveis).toBe(0);
      expect(result.enfileiradas).toBe(0);
      expect(db.calls.every(call => call.method === "GET")).toBe(true);
    }
  );

  it.each(["opt-in", "parcela-paga", "validade"])(
    "worker revalida %s e cancela sem POST",
    async policy => {
      const db = database();
      if (policy === "opt-in")
        db.tables.configuracoes.find(
          row =>
            row.user_id === TENANT && row.chave === "notificacoes_auto_ativo"
        )!.valor = "false";
      if (policy === "parcela-paga")
        db.tables.parcelas.find(row => row.user_id === TENANT)!.status = "paga";
      if (policy === "validade")
        db.tables.whatsapp_outbox.find(
          row => row.id === outboxId(TENANT, 1)
        )!.data_referencia = "2026-11-15";
      const result = await processarFilaWhatsApp(25, false, TENANT);
      expect(result.canceladas).toBe(1);
      expect(result.enviadas).toBe(0);
      expect(mocks.enviar).not.toHaveBeenCalled();
      expect(db.posts).toHaveLength(0);
    }
  );
});

describe("WhatsApp — respostas de owner contraditórias falham fechado", () => {
  it("configuração inicial de outro owner não dispara leituras secundárias", async () => {
    const db = database();
    db.setFault((call, rows) =>
      call.table === "configuracoes" && call.params.get("select") === "user_id"
        ? [{ user_id: OTHER }]
        : rows
    );
    expect(await enfileirarLembretesAutomaticos(NOW, false, TENANT)).toEqual({
      usuariosNoHorario: 0,
      elegiveis: 0,
      enfileiradas: 0,
      falhasItens: 1,
    });
    expect(db.calls).toHaveLength(1);
    expect(mocks.enviar).not.toHaveBeenCalled();
  });

  it.each(["regras", "preferencias", "parcela", "contrato", "cliente"])(
    "produtor rejeita owner divergente em %s antes do enqueue",
    async source => {
      const db = database();
      db.setFault((call, rows) => {
        if (source === "regras" && call.table === "notificacoes_automaticas")
          return rows.map(row => ({ ...row, user_id: OTHER }));
        if (
          source === "preferencias" &&
          call.table === "configuracoes" &&
          call.params.has("chave") &&
          call.params.get("chave")!.startsWith("in.")
        )
          return rows.map(row => ({ ...row, user_id: OTHER }));
        if (call.table === "parcelas")
          return rows.map(row => {
            if (source === "parcela") return { ...row, user_id: OTHER };
            if (source === "contrato")
              return {
                ...row,
                contratos: { ...row.contratos, user_id: OTHER },
              };
            if (source === "cliente")
              return {
                ...row,
                contratos: {
                  ...row.contratos,
                  clientes: { ...row.contratos.clientes, user_id: OTHER },
                },
              };
            return row;
          });
        return rows;
      });
      const result = await enfileirarLembretesAutomaticos(NOW, false, TENANT);
      expect(result.falhasItens).toBe(1);
      expect(result.enfileiradas).toBe(0);
      expect(db.calls.every(call => call.method === "GET")).toBe(true);
    }
  );

  it.each([false, true])(
    "candidata contraditória não é reservada/revalidada nem enviada, dryRun=%s",
    async dryRun => {
      const db = database();
      db.setFault((call, rows) =>
        call.table === "whatsapp_outbox" &&
        call.method === "GET" &&
        call.params.get("status") === "eq.pendente"
          ? rows.map(row => ({ ...row, user_id: OTHER }))
          : rows
      );
      const result = await processarFilaWhatsApp(25, dryRun, TENANT);
      expect(result.processadas).toBe(0);
      expect(result.falhas).toBe(1);
      expect(
        db.calls.some(
          call => call.table === "whatsapp_outbox" && call.params.has("id")
        )
      ).toBe(false);
      expect(
        db.calls.every(
          call =>
            call.method !== "GET" ||
            call.params.get("user_id") === `eq.${TENANT}`
        )
      ).toBe(true);
      expect(mocks.enviar).not.toHaveBeenCalled();
    }
  );

  it.each(["owner", "id"])(
    "reserva com %s contraditório não permite envio ou histórico da candidata",
    async source => {
      const db = database();
      db.setFault((call, rows) =>
        call.method === "PATCH" && call.body?.status === "enviando"
          ? rows.map(row => ({
              ...row,
              ...(source === "owner"
                ? { user_id: OTHER }
                : { id: outboxId(OTHER, 1) }),
            }))
          : rows
      );
      const result = await processarFilaWhatsApp(25, false, TENANT);
      expect(result.processadas).toBe(0);
      expect(result.falhas).toBe(1);
      expect(mocks.enviar).not.toHaveBeenCalled();
      expect(
        db.tables.notificacoes_log.some(
          row => row.outbox_id === outboxId(TENANT, 1)
        )
      ).toBe(false);
      expect(db.tables.whatsapp_tentativas).toHaveLength(0);
    }
  );

  it.each([
    "configuracoes",
    "notificacoes_automaticas",
    "parcelas",
    "contratos",
    "clientes",
  ])("revalidação rejeita owner contraditório em %s", async table => {
    const db = database();
    db.setFault((call, rows) =>
      call.table === table && call.method === "GET"
        ? rows.map(row => ({ ...row, user_id: OTHER }))
        : rows
    );
    const result = await processarFilaWhatsApp(25, false, TENANT);
    expect(result.canceladas).toBe(1);
    expect(result.enviadas).toBe(0);
    expect(mocks.enviar).not.toHaveBeenCalled();
    expect(db.posts).toHaveLength(0);
    expect(
      db.tables.notificacoes_log.every(row => row.user_id === TENANT)
    ).toBe(true);
  });

  it("revalidação de relatório rejeita preferências com owner contraditório", async () => {
    const db = database();
    db.tables.whatsapp_outbox.find(
      row => row.id === outboxId(TENANT, 1)
    )!.tipo = "relatorio_diario";
    db.setFault((call, rows) =>
      call.table === "configuracoes" && call.method === "GET"
        ? rows.map(row => ({ ...row, user_id: OTHER }))
        : rows
    );
    const result = await processarFilaWhatsApp(25, false, TENANT);
    expect(result.canceladas).toBe(1);
    expect(mocks.enviar).not.toHaveBeenCalled();
    expect(result.relatoriosConcluidos).toBe(0);
  });

  it.each(["owner", "id", "ausente"])(
    "lease read guard bloqueia %s contraditório antes de POST",
    async source => {
      const db = database();
      db.setFault((call, rows) => {
        if (
          call.table !== "whatsapp_outbox" ||
          call.method !== "GET" ||
          !call.params.has("lease_expira_em")
        )
          return rows;
        if (source === "ausente") return [];
        return rows.map(row => ({
          ...row,
          ...(source === "owner"
            ? { user_id: OTHER }
            : { id: outboxId(OTHER, 1) }),
        }));
      });
      const result = await processarFilaWhatsApp(25, false, TENANT);
      expect(db.posts).toHaveLength(0);
      expect(result.enviadas).toBe(0);
      expect(result.canceladas).toBe(1);
      const guard = db.calls.find(
        call =>
          call.table === "whatsapp_outbox" &&
          call.method === "GET" &&
          call.params.has("lease_expira_em")
      )!;
      expect(guard.params.get("user_id")).toBe(`eq.${TENANT}`);
    }
  );

  it("segunda revalidação impede POST se opt-in mudar depois da reserva", async () => {
    const db = database();
    mocks.enviar.mockImplementation(
      async (_userId, _telefone, _mensagem, guard) => {
        db.tables.configuracoes.find(
          row =>
            row.user_id === TENANT && row.chave === "notificacoes_auto_ativo"
        )!.valor = "false";
        expect(await guard()).toBe(false);
        return {
          ok: false,
          disposition: "nao_solicitado",
          erroCodigo: "GUARD",
        };
      }
    );
    const result = await processarFilaWhatsApp(25, false, TENANT);
    expect(result.canceladas).toBe(1);
    expect(result.enviadas).toBe(0);
    expect(db.posts).toHaveLength(0);
  });

  it("recuperação com resposta contraditória não persiste histórico", async () => {
    const db = database();
    db.setFault((call, rows) =>
      call.method === "PATCH" &&
      call.body?.ultimo_erro === "LEASE_EXPIRADO_RECONCILIACAO_MANUAL"
        ? rows.map(row => ({ ...row, user_id: OTHER }))
        : rows
    );
    await expect(recuperarLeasesExpiradosWhatsApp(TENANT)).rejects.toThrow(
      "PROPRIEDADE_DIVERGENTE"
    );
    expect(db.tables.notificacoes_log).toHaveLength(0);
    expect(db.calls[0].params.get("user_id")).toBe(`eq.${TENANT}`);
  });

  it("marcador não é gravado para resposta contraditória de relatório enviado", async () => {
    const db = database();
    db.setFault((call, rows) =>
      call.table === "whatsapp_outbox" &&
      call.params.get("status") === "eq.enviado"
        ? rows.map(row => ({ ...row, user_id: OTHER }))
        : rows
    );
    await expect(
      sincronizarMarcadoresDeRelatorioDiario(DAY, 200, TENANT)
    ).rejects.toThrow("PROPRIEDADE_DIVERGENTE");
    expect(db.calls).toHaveLength(1);
    expect(
      db.tables.configuracoes.some(
        row => row.chave === "relatorio_diario_ultimo_envio"
      )
    ).toBe(false);
  });

  it.each(["owner", "id"])(
    "persistência pós-envio com %s divergente não prova envio para histórico/marcador",
    async source => {
      const db = database();
      db.tables.whatsapp_outbox.find(
        row => row.id === outboxId(TENANT, 1)
      )!.tipo = "relatorio_diario";
      db.setFault((call, rows) =>
        call.method === "PATCH" && call.body?.status === "enviado"
          ? rows.map(row => ({
              ...row,
              ...(source === "owner"
                ? { user_id: OTHER }
                : { id: outboxId(OTHER, 1) }),
            }))
          : rows
      );
      const result = await processarFilaWhatsApp(25, false, TENANT);
      expect(result.enviadas).toBe(0);
      expect(result.relatoriosConcluidos).toBe(0);
      expect(result.ambiguas).toBe(2);
      expect(result.falhas).toBe(1);
      expect(
        db.tables.notificacoes_log.some(
          row => row.outbox_id === outboxId(TENANT, 1)
        )
      ).toBe(false);
      expect(db.tables.whatsapp_tentativas).toHaveLength(0);
      expect(
        db.calls.filter(
          call => call.table === "configuracoes" && call.method === "POST"
        )
      ).toHaveLength(1); // somente reconciliação do relatório já enviado
      expect((await processarFilaWhatsApp(25, false, TENANT)).processadas).toBe(
        0
      );
      expect(mocks.enviar).toHaveBeenCalledTimes(1);
    }
  );
});
