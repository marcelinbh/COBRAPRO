import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import type {
  Acao37,
  Cotacao37,
  Request37,
  Result37,
  CotarCaixa37Input,
  Recovery37Input,
} from "../../../shared/caixa37";

type RefetchResult = {
  data?: unknown;
  isError?: boolean;
  isLoading?: boolean;
  isFetching?: boolean;
};
const h = vi.hoisted(() => ({
  user: { id: 901 } as { id: number } | undefined,
  auth: {} as Record<string, boolean>,
  query: vi.fn(),
  invalidar: vi.fn(),
  callback: vi.fn(),
  capacidade: vi.fn<() => Promise<RefetchResult>>(),
  cotar: vi.fn<(input: CotarCaixa37Input) => Promise<RefetchResult>>(),
  aportar: vi.fn<(input: Record<string, unknown>) => Promise<unknown>>(),
  transferir: vi.fn<(input: Record<string, unknown>) => Promise<unknown>>(),
  reconciliar: vi.fn<(input: Recovery37Input) => Promise<unknown>>(),
  link: null as null | {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  },
}));
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/components/ui/input", () => ({ Input: "input" }));
vi.mock("@/components/ui/label", () => ({ Label: "label" }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: "dialog",
  DialogContent: "div",
  DialogHeader: "header",
  DialogTitle: "h2",
}));
vi.mock("@trpc/client", () => ({
  httpBatchLink: (options: NonNullable<typeof h.link>) => {
    h.link = options;
    return {};
  },
  createTRPCProxyClient: () => ({
    caixa: {
      aportar37: { mutate: h.aportar },
      transferir37: { mutate: h.transferir },
      reconciliar37: { mutate: h.reconciliar },
    },
  }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      me: {
        useQuery: () => ({
          data: h.user,
          isError: false,
          isLoading: false,
          isFetching: false,
          ...h.auth,
        }),
      },
    },
    useUtils: () => ({ invalidate: h.invalidar }),
    caixa: {
      capacidades37: {
        useQuery: (i: unknown, o: unknown) => {
          h.query("capacidade", i, o);
          return { data: capacidade, refetch: h.capacidade };
        },
      },
      cotar37: {
        useQuery: (i: CotarCaixa37Input, o: unknown) => {
          h.query("cotacao", i, o);
          return { data: quote(i), refetch: () => h.cotar(i) };
        },
      },
    },
  },
}));
import { Caixa37Operacoes, Caixa37Aporte } from "./Caixa37Operacoes";
import {
  chaveCaixa37,
  dinheiro37,
  validarCotacao37,
  validarResultado37,
  validarRecovery37,
  qRequest,
  CAIXA37_RESPONSE_TIMEOUT_MS,
} from "./Caixa37Rpc";
import { decimalCaixa37, monetaryBigInt } from "../../../shared/caixa37";

// React, os componentes financeiros e seus hooks são reais. Somente primitives,
// sessão/tRPC/storage são fronteiras mockadas. Dispatcher conserva slots/effects/cleanup.
type Props = Record<string, unknown> & { children?: unknown };
type Node = { type: unknown; props: Props };
type Cleanup = void | (() => void);
type Frame = {
  values: unknown[];
  deps: Array<unknown[] | undefined>;
  cleanups: Cleanup[];
  cursor: number;
};
const internals = (
  React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
      H: unknown;
    };
  }
).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
function isNode(n: unknown): n is Node {
  return typeof n === "object" && n !== null && "props" in n;
}
class MemoryUI<P extends object = object> {
  frames = new Map<string, Frame>();
  tree: unknown;
  writes = 0;
  mounted = true;
  dirty = true;
  private effects: Array<() => void> = [];
  constructor(
    private component: React.ComponentType<P>,
    public props: P
  ) {
    instances.push(this);
  }
  private expand(node: unknown, path: string, seen: Set<string>): unknown {
    if (Array.isArray(node))
      return node.map((n: unknown, i) =>
        this.expand(
          n,
          `${path}/${React.isValidElement(n) ? (n.key ?? i) : i}`,
          seen
        )
      );
    if (!React.isValidElement<Props>(node)) return node;
    if (typeof node.type === "function") {
      const id = `${path}:${node.type.name}:${node.key ?? ""}`;
      seen.add(id);
      let frame = this.frames.get(id);
      if (!frame) {
        frame = { values: [], deps: [], cleanups: [], cursor: 0 };
        this.frames.set(id, frame);
      }
      frame.cursor = 0;
      const f = frame;
      const changed = (i: number, deps?: unknown[]) =>
        !deps ||
        !f.deps[i] ||
        deps.length !== f.deps[i]?.length ||
        deps.some((v, n) => !Object.is(v, f.deps[i]?.[n]));
      const effect = (fn: () => Cleanup, deps?: unknown[]) => {
        const i = f.cursor++;
        if (changed(i, deps)) {
          f.deps[i] = deps ? [...deps] : [];
          this.effects.push(() => {
            const cleanup = f.cleanups[i];
            if (cleanup) cleanup();
            f.cleanups[i] = fn();
          });
        }
      };
      const memo = (fn: () => unknown, deps?: unknown[]) => {
        const i = f.cursor++;
        if (changed(i, deps)) {
          f.values[i] = fn();
          f.deps[i] = deps ? [...deps] : [];
        }
        return f.values[i];
      };
      const previous = internals.H;
      internals.H = {
        useState: (initial: unknown) => {
          const i = f.cursor++;
          if (!(i in f.values))
            f.values[i] = typeof initial === "function" ? initial() : initial;
          return [
            f.values[i],
            (next: unknown) => {
              this.writes++;
              f.values[i] =
                typeof next === "function" ? next(f.values[i]) : next;
              this.dirty = true;
            },
          ];
        },
        useRef: (initial: unknown) => {
          const i = f.cursor++;
          return f.values[i] ?? (f.values[i] = { current: initial });
        },
        useMemo: memo,
        useCallback: (fn: () => unknown, deps: unknown[]) =>
          memo(() => fn, deps),
        useEffect: effect,
        useLayoutEffect: effect,
      };
      let child: unknown;
      try {
        child = (node.type as (p: Props) => unknown)(node.props);
      } finally {
        internals.H = previous;
      }
      return this.expand(child, `${id}/child`, seen);
    }
    return {
      type: node.type,
      props: {
        ...node.props,
        children: this.expand(node.props.children, `${path}/children`, seen),
      },
    };
  }
  render() {
    if (!this.mounted) return this;
    let n = 0;
    do {
      this.dirty = false;
      const seen = new Set<string>();
      this.tree = this.expand(
        React.createElement(this.component, this.props),
        "root",
        seen
      );
      for (const [id, f] of this.frames)
        if (!seen.has(id)) {
          f.cleanups.forEach(fn => {
            if (fn) fn();
          });
          this.frames.delete(id);
        }
      this.effects.splice(0).forEach(fn => fn());
      if (++n > 40) throw Error("Loop de render");
    } while (this.dirty);
    return this;
  }
  async flush() {
    for (let i = 0; i < 40; i++) {
      await Promise.resolve();
      if (this.dirty && this.mounted) this.render();
    }
    return this;
  }
  unmount() {
    if (!this.mounted) return;
    this.frames.forEach(f =>
      f.cleanups.forEach(fn => {
        if (fn) fn();
      })
    );
    this.mounted = false;
    this.dirty = false;
  }
  nodes(type?: string): Node[] {
    const out: Node[] = [];
    const walk = (n: unknown) => {
      if (Array.isArray(n)) n.forEach(walk);
      else if (isNode(n)) {
        if (!type || n.type === type) out.push(n);
        walk(n.props.children);
      }
    };
    walk(this.tree);
    return out;
  }
  text(node: unknown = this.tree): string {
    const walk = (n: unknown): string =>
      n == null || typeof n === "boolean"
        ? ""
        : Array.isArray(n)
          ? n.map(walk).join(" ")
          : isNode(n)
            ? walk(n.props.children)
            : String(n);
    return walk(node).replace(/\s+/g, " ");
  }
  button(fragment: string) {
    const n = this.nodes("button").find(n => this.text(n).includes(fragment));
    if (!n) throw Error(`Botão ausente ${fragment}: ${this.text()}`);
    return n;
  }
  async click(fragment: string) {
    const n = this.button(fragment);
    if (n.props.disabled) throw Error(`Botão desabilitado ${fragment}`);
    const pending = (n.props.onClick as () => unknown)();
    this.render();
    await this.flush();
    await pending;
    this.render();
    await this.flush();
  }
  change(label: string, value: string | boolean) {
    const node = this.nodes().find(n => n.props["aria-label"] === label);
    if (!node) throw Error(`Campo ausente ${label}`);
    (
      node.props.onChange as (e: {
        target: { value: string | boolean; checked: string | boolean };
      }) => void
    )({ target: { value, checked: value } });
    this.render();
  }
}
let instances: Array<{ unmount: () => void }> = [],
  data: Map<string, string>;
const storage = {
  getItem: vi.fn<(key: string) => string | null>(),
  setItem: vi.fn<(key: string, raw: string) => void>(),
  removeItem: vi.fn<(key: string) => void>(),
};
const network = vi.fn(),
  randomUUID = vi.fn();
const uuid = "11111111-1111-4111-8111-111111111111",
  uuidB = "22222222-2222-4222-8222-222222222222",
  op = "33333333-3333-4333-8333-333333333333";
const capacidade = {
  disponivel: true,
  regra: "caixa37_v1",
  aporte: true,
  transferencia: true,
  recovery: true,
};
function quote(i: CotarCaixa37Input): Cotacao37 {
  const transfer = i.acao === "transferir",
    amount = monetaryBigInt(i.valor);
  return {
    elegivel: true,
    regra: "caixa37_brt_v1",
    acao: i.acao,
    contaOrigemId: transfer ? i.contaOrigemId : null,
    contaDestinoId: i.contaDestinoId,
    valor: i.valor,
    descricao: i.descricao ?? null,
    dataTransacao: "2026-11-20",
    estadoHash: "a".repeat(64),
    origem: transfer
      ? {
          contaCaixaId: i.contaOrigemId,
          nome: "Banco",
          saldoBase: "10.00",
          entradas: "0.00",
          saidas: "0.00",
          saldoEfetivo: "10.00",
        }
      : null,
    destino: {
      contaCaixaId: i.contaDestinoId,
      nome: "Caixa",
      saldoBase: "-5.00",
      entradas: "5.00",
      saidas: "0.00",
      saldoEfetivo: "0.00",
    },
    saldoOrigemApos: transfer
      ? decimalCaixa37(monetaryBigInt("10.00") - amount)
      : null,
    saldoDestinoApos: i.valor,
    saldoTotalOwnerAntes: "10000000000000000.00",
    saldoTotalOwnerApos: decimalCaixa37(
      monetaryBigInt("10000000000000000.00") + (transfer ? BigInt(0) : amount)
    ),
  };
}
const input = (action: Acao37 = "aporte"): CotarCaixa37Input =>
  action === "aporte"
    ? { acao: action, contaDestinoId: 2, valor: "12.30" }
    : { acao: action, contaOrigemId: 1, contaDestinoId: 2, valor: "12.30" };
function result(intent: Recovery37Input): Result37 {
  const q = quote(input(intent.request.acao));
  const r = intent.request;
  return {
    success: true,
    regra: "caixa37_v1",
    acao: r.acao,
    operationId: op,
    idempotencyKey: intent.idempotencyKey,
    repetida: false,
    contaOrigemId: r.contaOrigemId,
    contaDestinoId: r.contaDestinoId,
    valor: r.valor,
    dataTransacao: r.dataTransacao,
    descricao: r.descricao,
    pernas:
      r.acao === "aporte"
        ? [
            {
              papel: "aporte",
              transacaoCaixaId: "101",
              contaCaixaId: r.contaDestinoId,
              tipo: "entrada",
              valor: r.valor,
            },
          ]
        : [
            {
              papel: "origem",
              transacaoCaixaId: "101",
              contaCaixaId: r.contaOrigemId!,
              tipo: "saida",
              valor: r.valor,
            },
            {
              papel: "destino",
              transacaoCaixaId: "102",
              contaCaixaId: r.contaDestinoId,
              tipo: "entrada",
              valor: r.valor,
            },
          ],
    saldoOrigemAntes: q.origem?.saldoEfetivo ?? null,
    saldoOrigemApos:
      r.acao === "aporte"
        ? null
        : decimalCaixa37(monetaryBigInt("10.00") - monetaryBigInt(r.valor)),
    saldoDestinoAntes: "0.00",
    saldoDestinoApos: r.valor,
    saldoTotalOwnerAntes: q.saldoTotalOwnerAntes,
    saldoTotalOwnerApos: decimalCaixa37(
      monetaryBigInt(q.saldoTotalOwnerAntes) +
        (r.acao === "aporte" ? monetaryBigInt(r.valor) : BigInt(0))
    ),
  };
}
const intent = (action: Acao37 = "aporte"): Recovery37Input => ({
  idempotencyKey: uuid,
  request: qRequest(quote(input(action))),
});
const fence = (i: Recovery37Input) => ({
  userId: 901,
  ...i,
  requestHash: "b".repeat(64),
  proof: "uuid_fenced37_v1",
  status: "not_executed",
  operationId: null,
  result: null,
});
function save(action: Acao37 = "aporte", extra: Record<string, unknown> = {}) {
  data.set(
    chaveCaixa37(901, action),
    JSON.stringify({ versao: 1, userId: 901, ...intent(action), ...extra })
  );
}
const props = (action: Acao37 = "aporte") => ({
  userId: 901,
  contas: [
    { id: 1, nome: "Banco" },
    { id: 2, nome: "Caixa" },
  ],
  acaoInicial: action,
  onSuccess: h.callback,
});
async function ui(action: Acao37 = "aporte") {
  return new MemoryUI(Caixa37Operacoes, props(action)).render().flush();
}
function fill(r: Awaited<ReturnType<typeof ui>>, action: Acao37 = "aporte") {
  if (action === "transferir") r.change("Conta de origem", "1");
  r.change("Conta de destino", "2");
  r.change("Valor", "12.3");
}
async function prepare(
  r: Awaited<ReturnType<typeof ui>>,
  action: Acao37 = "aporte"
) {
  fill(r, action);
  await r.click("Obter cotação");
  if (action === "transferir") r.change("Confirmar saldo negativo", true);
}
function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.resetAllMocks();
  instances = [];
  data = new Map();
  h.user = { id: 901 };
  h.auth = {};
  vi.stubGlobal("React", React);
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("crypto", { randomUUID });
  vi.stubGlobal("fetch", network);
  storage.getItem.mockImplementation(k => data.get(k) ?? null);
  storage.setItem.mockImplementation((k, v) => {
    data.set(k, v);
  });
  storage.removeItem.mockImplementation(k => {
    data.delete(k);
  });
  randomUUID.mockReturnValue(uuid.toUpperCase());
  h.invalidar.mockResolvedValue(undefined);
  h.capacidade.mockResolvedValue({ data: capacidade });
  h.cotar.mockImplementation(async i => ({ data: quote(i) }));
  h.aportar.mockRejectedValue(Error("timeout"));
  h.transferir.mockRejectedValue(Error("timeout"));
  h.reconciliar.mockImplementation(async i => fence(i));
});
afterEach(() => {
  instances.forEach(i => i.unmount());
  expect(
    h.query.mock.calls.every(
      c =>
        (c[2] as { enabled: boolean; retry: boolean; staleTime: number })
          .enabled === false &&
        (c[2] as { retry: boolean }).retry === false &&
        (c[2] as { staleTime: number }).staleTime === 0
    )
  ).toBe(true);
  vi.unstubAllGlobals();
});

describe("dinheiro, normalização e preview SQL", () => {
  it.each([
    "0",
    "0.00",
    "-1",
    "1,20",
    "1e2",
    "1.234",
    "NaN",
    "Infinity",
    " 12",
    "01",
    "10000000000",
  ])("%s nunca cria UUID/POST", async value => {
    const r = await ui();
    fill(r);
    r.change("Valor", value);
    expect(r.button("Obter cotação").props.disabled).toBe(true);
    expect(() => dinheiro37(value)).toThrow();
    expect(h.aportar).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();
    expect(data.size).toBe(0);
  });
  it.each(["aporte", "transferir"] as const)(
    "%s mostra equações exatas sem usar relógio UI/cache",
    async action => {
      const r = await ui(action);
      fill(r, action);
      expect(r.button("Confirmar").props.disabled).toBe(true);
      expect(h.cotar).not.toHaveBeenCalled();
      await r.click("Obter cotação");
      expect(r.text()).toContain("2026-11-20");
      expect(r.text()).toContain("10000000000000000.00");
      expect(r.text()).toContain("-5.00");
      expect(r.text()).toContain(
        action === "aporte" ? "10000000000000012.30" : "Total invariável"
      );
      if (action === "transferir") {
        expect(r.text()).toContain("-2.30");
        expect(r.button("Confirmar transferência").props.disabled).toBe(true);
        r.change("Confirmar saldo negativo", true);
      }
      await r.click(
        action === "aporte" ? "Confirmar aporte" : "Confirmar transferência"
      );
      const mutation = action === "aporte" ? h.aportar : h.transferir;
      expect(mutation).toHaveBeenCalledOnce();
      expect(mutation.mock.calls[0][0].valor).toBe("12.30");
      expect(mutation.mock.calls[0][0].dataTransacao).toBe("2026-11-20");
      expect(mutation.mock.calls[0][0].idempotencyKey).toBe(uuid);
      expect(h.invalidar).not.toHaveBeenCalled();
    }
  );
  it("descrição congelada trim/null não muda no recovery", async () => {
    const r = await ui();
    fill(r);
    r.change("Descrição opcional", "  dinheiro recebido  ");
    await r.click("Obter cotação");
    await r.click("Confirmar aporte");
    expect(h.aportar.mock.calls[0][0].descricao).toBe("dinheiro recebido");
    await r.click("Conferir intenção");
    expect(h.reconciliar.mock.calls[0][0].request.descricao).toBe(
      "dinheiro recebido"
    );
  });
  it("origem igual destino ou inativa não cota", async () => {
    const r = await ui("transferir");
    fill(r, "transferir");
    r.change("Conta de origem", "2");
    expect(r.button("Obter cotação").props.disabled).toBe(true);
    r.props = {
      ...r.props,
      contas: [
        { id: 1, nome: "Banco", ativo: false },
        { id: 2, nome: "Caixa" },
      ],
    };
    r.render();
    expect(h.cotar).not.toHaveBeenCalled();
  });
  it.each(["Valor", "Descrição opcional", "Conta de destino"])(
    "editar %s invalida preview e handler antigo",
    async field => {
      const r = await ui();
      await prepare(r);
      const handler = r.button("Confirmar aporte").props
        .onClick as () => unknown;
      r.change(
        field,
        field === "Valor" ? "13" : field === "Conta de destino" ? "1" : "nova"
      );
      await handler();
      await r.flush();
      expect(r.button("Confirmar aporte").props.disabled).toBe(true);
      expect(h.aportar).not.toHaveBeenCalled();
    }
  );
});

describe("intenção durável, apenas um envio e recovery explícito", () => {
  it("double-click envia uma única mutation e erro não libera replay", async () => {
    const d = deferred<unknown>();
    h.aportar.mockReturnValue(d.promise);
    const r = await ui();
    await prepare(r);
    const click = r.button("Confirmar aporte").props.onClick as () => unknown;
    const a = click(),
      b = click();
    await r.flush();
    expect(h.aportar).toHaveBeenCalledOnce();
    expect(data.size).toBe(1);
    d.reject(Error("timeout"));
    await Promise.all([a, b]);
    await r.flush();
    await click();
    expect(h.aportar).toHaveBeenCalledOnce();
    expect(r.text()).not.toContain("Repetir");
    expect(r.text()).toContain("Conferir intenção");
  });
  it.each(["aporte", "transferir"] as const)(
    "timeout/reload %s não recota nem reenvia; recovery funciona sem capacidade/metadados",
    async action => {
      let r = await ui(action);
      await prepare(r, action);
      await r.click(
        action === "aporte" ? "Confirmar aporte" : "Confirmar transferência"
      );
      r.unmount();
      h.capacidade.mockRejectedValue(Error("RPC ausente"));
      r = await new MemoryUI(Caixa37Operacoes, { ...props(action), contas: [] })
        .render()
        .flush();
      await r.click("Conferir intenção");
      expect(h.reconciliar).toHaveBeenCalledWith(intent(action));
      expect(h.capacidade).toHaveBeenCalledOnce();
      expect(h.cotar).toHaveBeenCalledOnce();
      expect(randomUUID).toHaveBeenCalledOnce();
      expect(
        action === "aporte" ? h.aportar : h.transferir
      ).toHaveBeenCalledOnce();
      expect(data.size).toBe(1);
    }
  );
  it("not_executed requer gesto, fresh quote e nova UUID sem envio automático", async () => {
    save();
    const r = await ui();
    await r.click("Conferir intenção");
    expect(data.size).toBe(1);
    expect(h.aportar).not.toHaveBeenCalled();
    await r.click("Preparar nova intenção");
    expect(data.size).toBe(0);
    expect(r.button("Confirmar aporte").props.disabled).toBe(true);
    randomUUID.mockReturnValue(uuidB);
    await r.click("Obter cotação");
    await r.click("Confirmar aporte");
    expect(h.aportar.mock.calls[0][0].idempotencyKey).toBe(uuidB);
  });
  it("fechar diálogo durante POST conserva intenção e callback tardio não invalida", async () => {
    const d = deferred<unknown>();
    h.aportar.mockReturnValue(d.promise);
    const r = await new MemoryUI(Caixa37Aporte, props()).render().flush();
    await r.click("Aportar /");
    fill(r);
    await r.click("Obter cotação");
    const click = r.button("Confirmar aporte").props.onClick as () => unknown;
    const pending = click();
    await r.flush();
    const raw = data.get(chaveCaixa37(901, "aporte"));
    (r.nodes("dialog")[0].props.onOpenChange as (v: boolean) => void)(false);
    r.render();
    const writes = r.writes;
    d.resolve(result(intent()));
    await pending;
    await r.flush();
    expect(r.writes).toBe(writes);
    expect(data.get(chaveCaixa37(901, "aporte"))).toBe(raw);
    expect(h.callback).not.toHaveBeenCalled();
    expect(h.invalidar).not.toHaveBeenCalled();
    await r.click("Aportar /");
    expect(r.text()).toContain(uuid);
    await r.click("Conferir intenção");
    expect(h.aportar).toHaveBeenCalledOnce();
  });
  it("recovery confirmado invalida uma vez sem aplicar saldo histórico", async () => {
    save();
    h.reconciliar.mockImplementation(async i => ({
      ...fence(i),
      status: "confirmed",
      operationId: op,
      result: result(i),
    }));
    let r = await ui();
    await r.click("Conferir intenção");
    expect(h.invalidar).toHaveBeenCalledOnce();
    expect(h.callback).toHaveBeenCalledOnce();
    expect(r.text()).toContain("IDs físicos");
    r.unmount();
    r = await ui();
    expect(r.text()).toContain("Operação confirmada");
    expect(h.invalidar).toHaveBeenCalledOnce();
    expect(h.aportar).not.toHaveBeenCalled();
  });
  it("mutation confirmada uma vez mantém prova até encerrar por gesto", async () => {
    h.aportar.mockImplementation(async p =>
      result({
        idempotencyKey: String(p.idempotencyKey),
        request: { ...intent().request, valor: String(p.valor) },
      })
    );
    const r = await ui();
    await prepare(r);
    await r.click("Confirmar aporte");
    expect(data.size).toBe(1);
    expect(h.invalidar).toHaveBeenCalledOnce();
    await r.click("Encerrar confirmação");
    expect(data.size).toBe(0);
    expect(r.button("Confirmar aporte").props.disabled).toBe(true);
    expect(h.aportar).toHaveBeenCalledOnce();
  });
});

describe("proofs estritas e storage fail closed", () => {
  it.each([
    "proof",
    "userId",
    "requestHash",
    "idempotencyKey",
    "request",
    "operationId",
    "result",
    "extra",
  ])("recovery inválido por %s não apaga intenção", async field => {
    save();
    const raw = data.get(chaveCaixa37(901, "aporte"));
    h.reconciliar.mockImplementation(async i => ({
      ...fence(i),
      [field]:
        field === "proof"
          ? "uuid_fenced36_v1"
          : field === "userId"
            ? 902
            : field === "requestHash"
              ? "bad"
              : field === "idempotencyKey"
                ? uuidB
                : field === "request"
                  ? { ...i.request, estadoHash: "c".repeat(64) }
                  : field === "operationId"
                    ? op
                    : {},
    }));
    const r = await ui();
    await r.click("Conferir intenção");
    expect(r.text()).not.toContain("Preparar nova intenção");
    expect(data.get(chaveCaixa37(901, "aporte"))).toBe(raw);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it.each(["parcial", "extra", "equacao", "pernas", "uuid"])(
    "resultado %s ambíguo não confirma e recovery permanece executável",
    async kind => {
      const good = result(intent());
      h.aportar.mockResolvedValue(
        kind === "parcial"
          ? { success: true }
          : kind === "extra"
            ? { ...good, owner: 901 }
            : kind === "equacao"
              ? { ...good, saldoTotalOwnerApos: "0.00" }
              : kind === "pernas"
                ? { ...good, pernas: [] }
                : { ...good, idempotencyKey: uuidB }
      );
      const r = await ui();
      await prepare(r);
      await r.click("Confirmar aporte");
      expect(h.callback).not.toHaveBeenCalled();
      expect(h.invalidar).not.toHaveBeenCalled();
      await r.click("Conferir intenção");
      expect(h.aportar).toHaveBeenCalledOnce();
    }
  );
  it.each(["json", "versao", "owner", "acao", "uuid", "extra"])(
    "storage corrompido %s não autoriza substituição/clear",
    async kind => {
      const s = { versao: 1, userId: 901, ...intent() };
      data.set(
        chaveCaixa37(901, "aporte"),
        kind === "json"
          ? "{"
          : JSON.stringify(
              kind === "versao"
                ? { ...s, versao: 2 }
                : kind === "owner"
                  ? { ...s, userId: 902 }
                  : kind === "acao"
                    ? { ...s, request: intent("transferir").request }
                    : kind === "uuid"
                      ? { ...s, idempotencyKey: "bad" }
                      : { ...s, extra: true }
            )
      );
      const r = await ui();
      expect(r.text()).toContain("corrompida");
      expect(h.aportar).not.toHaveBeenCalled();
      expect(randomUUID).not.toHaveBeenCalled();
      expect(storage.removeItem).not.toHaveBeenCalled();
    }
  );
  it("confirmação local quebrada conserva request e permite somente recovery", async () => {
    save("aporte", { confirmacao: { success: true } });
    const r = await ui();
    expect(r.text()).not.toContain("Operação confirmada:");
    h.reconciliar.mockImplementation(async i => ({
      ...fence(i),
      status: "confirmed",
      operationId: op,
      result: result(i),
    }));
    await r.click("Conferir intenção");
    expect(r.text()).toContain("Operação confirmada:");
    expect(h.aportar).not.toHaveBeenCalled();
  });
  it.each(["throw", "silent"])(
    "storage persistência %s impede mutation e UUID substituta",
    async kind => {
      const r = await ui();
      await prepare(r);
      storage.setItem.mockImplementation(() => {
        if (kind === "throw") throw Error("quota");
      });
      const click = r.button("Confirmar aporte").props.onClick as () => unknown;
      await click();
      await r.flush();
      await click();
      expect(h.aportar).not.toHaveBeenCalled();
      expect(randomUUID).toHaveBeenCalledOnce();
    }
  );
  it("storage mudou durante POST não grava confirmação nem callback", async () => {
    const d = deferred<unknown>();
    h.aportar.mockReturnValue(d.promise);
    const r = await ui();
    await prepare(r);
    const pending = r.click("Confirmar aporte");
    await r.flush();
    const replacement = JSON.stringify({
      versao: 1,
      userId: 901,
      ...intent(),
      idempotencyKey: uuidB,
    });
    data.set(chaveCaixa37(901, "aporte"), replacement);
    d.resolve(result(intent()));
    await pending;
    expect(data.get(chaveCaixa37(901, "aporte"))).toBe(replacement);
    expect(h.callback).not.toHaveBeenCalled();
  });
  it("storage ausente não cota nem envia", async () => {
    vi.stubGlobal("sessionStorage", undefined);
    const r = await ui();
    expect(r.text()).toContain("indisponível");
    expect(h.cotar).not.toHaveBeenCalled();
    expect(h.aportar).not.toHaveBeenCalled();
  });
  it("erro de recovery pode ser conferido novamente sem repetir mutation", async () => {
    save();
    h.reconciliar.mockRejectedValueOnce(Error("transport failed"));
    const r = await ui();
    await r.click("Conferir intenção");
    expect(storage.removeItem).not.toHaveBeenCalled();
    await r.click("Conferir intenção");
    expect(h.reconciliar).toHaveBeenCalledTimes(2);
    expect(h.aportar).not.toHaveBeenCalled();
  });
});

describe("gerações, sessão, refetch manual e transporte", () => {
  it.each(["isError", "isLoading", "isFetching"])(
    "sessão %s ignora auth cached e não lê storage",
    async flag => {
      h.auth = { [flag]: true };
      save();
      const r = await ui();
      expect(r.text()).not.toContain(uuid);
      expect(storage.getItem).not.toHaveBeenCalled();
      expect(h.capacidade).not.toHaveBeenCalled();
    }
  );
  it.each(["POST", "recovery", "quote"])(
    "%s A→B→A não valida callback antigo",
    async kind => {
      const d = deferred<unknown>();
      let pending: unknown, r: Awaited<ReturnType<typeof ui>>;
      if (kind === "recovery") {
        save();
        h.reconciliar.mockReturnValue(d.promise);
        r = await ui();
        pending = r.click("Conferir intenção");
      } else {
        r = await ui();
        fill(r);
        if (kind === "quote") {
          h.cotar.mockImplementation(
            async () => (await d.promise) as RefetchResult
          );
          pending = r.click("Obter cotação");
        } else {
          await r.click("Obter cotação");
          h.aportar.mockReturnValue(d.promise);
          pending = r.click("Confirmar aporte");
        }
      }
      await r.flush();
      const raw = data.get(chaveCaixa37(901, "aporte"));
      h.user = { id: 902 };
      r.render();
      h.user = { id: 901 };
      r.render();
      await r.flush();
      const writes = r.writes;
      d.resolve(
        kind === "POST"
          ? result(intent())
          : kind === "quote"
            ? { data: quote(input()) }
            : {
                ...fence(intent()),
                status: "confirmed",
                operationId: op,
                result: result(intent()),
              }
      );
      await pending;
      await r.flush();
      expect(r.writes).toBe(writes);
      expect(data.get(chaveCaixa37(901, "aporte"))).toBe(raw);
      expect(h.callback).not.toHaveBeenCalled();
      expect(h.invalidar).not.toHaveBeenCalled();
    }
  );
  it("owner/action segregam storage e voltam apenas à própria intenção", async () => {
    save();
    const r = await ui();
    expect(r.text()).toContain(uuid);
    h.user = { id: 902 };
    r.props = { ...r.props, userId: 902 };
    r.render();
    await r.flush();
    expect(r.text()).not.toContain(uuid);
    h.user = { id: 901 };
    r.props = { ...r.props, userId: 901 };
    r.render();
    await r.flush();
    expect(r.text()).toContain(uuid);
    expect(chaveCaixa37(901, "aporte")).not.toBe(
      chaveCaixa37(901, "transferir")
    );
  });
  it("unmount enquanto recovery aguarda não escreve estado/cache/storage", async () => {
    save();
    const d = deferred<unknown>();
    h.reconciliar.mockReturnValue(d.promise);
    const r = await ui();
    const pending = r.click("Conferir intenção");
    await r.flush();
    r.unmount();
    const writes = r.writes;
    d.resolve({
      ...fence(intent()),
      status: "confirmed",
      operationId: op,
      result: result(intent()),
    });
    await pending;
    expect(r.writes).toBe(writes);
    expect(h.invalidar).not.toHaveBeenCalled();
  });
  it("cache de quote não aparece antes da resposta manual própria", async () => {
    const d = deferred<RefetchResult>();
    h.cotar.mockReturnValue(d.promise);
    const r = await ui();
    fill(r);
    const pending = r.click("Obter cotação");
    await r.flush();
    expect(r.text()).not.toContain("Data da operação");
    expect(r.button("Confirmar aporte").props.disabled).toBe(true);
    d.resolve({ data: quote(input()) });
    await pending;
    expect(r.text()).toContain("Data da operação");
  });
  it.each(["isError", "isLoading", "isFetching"])(
    "refetch %s não usa data stale",
    async flag => {
      h.cotar.mockResolvedValue({ data: quote(input()), [flag]: true });
      const r = await ui();
      fill(r);
      await r.click("Obter cotação");
      expect(r.button("Confirmar aporte").props.disabled).toBe(true);
      expect(r.text()).not.toContain("Data da operação");
    }
  );
  it.each(["origem", "total", "base", "extra"])(
    "quote inválida %s não libera confirmação",
    async kind => {
      h.cotar.mockImplementation(async i => ({
        data: {
          ...quote(i),
          ...(kind === "origem"
            ? { origem: quote(input("transferir")).origem }
            : kind === "total"
              ? { saldoTotalOwnerApos: "0.00" }
              : kind === "base"
                ? { destino: { ...quote(i).destino, saldoBase: "0.00" } }
                : { extra: true }),
        },
      }));
      const r = await ui();
      fill(r);
      await r.click("Obter cotação");
      expect(r.button("Confirmar aporte").props.disabled).toBe(true);
      expect(h.aportar).not.toHaveBeenCalled();
    }
  );
  it("late quote após editar e voltar ao valor original não repovoa preview", async () => {
    const d = deferred<RefetchResult>();
    h.cotar.mockReturnValue(d.promise);
    const r = await ui();
    fill(r);
    const pending = r.click("Obter cotação");
    await r.flush();
    r.change("Valor", "1");
    r.change("Valor", "12.3");
    d.resolve({ data: quote(input()) });
    await pending;
    expect(r.text()).not.toContain("Data da operação");
    expect(r.button("Confirmar aporte").props.disabled).toBe(true);
  });
  it.each(["missing", "fail", "malformed"])(
    "capability %s sem fallback ou capacidade cached",
    async mode => {
      if (mode === "fail") h.capacidade.mockRejectedValue(Error("500"));
      else
        h.capacidade.mockResolvedValue({
          data:
            mode === "missing"
              ? {
                  ...capacidade,
                  disponivel: false,
                  aporte: false,
                  transferencia: false,
                  recovery: false,
                }
              : { ...capacidade, regra: "wrong" },
        });
      const r = await ui();
      fill(r);
      expect(r.button("Obter cotação").props.disabled).toBe(true);
      expect(h.cotar).not.toHaveBeenCalled();
      expect(h.aportar).not.toHaveBeenCalled();
      h.capacidade.mockResolvedValue({ data: capacidade });
      await r.click("Conferir disponibilidade novamente");
      expect(r.button("Obter cotação").props.disabled).toBe(false);
    }
  );
  it("transporte tRPC utiliza /api/trpc e credentials include, sem writer alternativo", async () => {
    network.mockResolvedValue(new Response("{}"));
    await h.link!.fetch("/api/trpc", { method: "POST", credentials: "omit" });
    expect(network).toHaveBeenCalledWith("/api/trpc", {
      method: "POST",
      credentials: "include",
    });
    expect(h.aportar).not.toHaveBeenCalled();
  });
  it("schemas reais recusam getters sem executar accessor", () => {
    const getter = vi.fn(() => true);
    const bad = Object.defineProperty({}, "elegivel", {
      enumerable: true,
      get: getter,
    });
    expect(() => validarCotacao37(bad, intent().request)).toThrow();
    expect(() => validarResultado37(bad, intent())).toThrow();
    expect(() => validarRecovery37(bad, 901, intent())).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
});

describe("prazos e encerramento seguro sob falha", () => {
  it.each(["mutation", "recovery"])(
    "%s pendente por 30s vira ambíguo sem cancelar ou repetir writer",
    async kind => {
      vi.useFakeTimers();
      try {
        const d = deferred<unknown>();
        let r: Awaited<ReturnType<typeof ui>>, pending: unknown;
        if (kind === "mutation") {
          h.aportar.mockReturnValue(d.promise);
          r = await ui();
          await prepare(r);
          pending = r.click("Confirmar aporte");
        } else {
          save();
          h.reconciliar.mockReturnValue(d.promise);
          r = await ui();
          pending = r.click("Conferir intenção");
        }
        await r.flush();
        await vi.advanceTimersByTimeAsync(CAIXA37_RESPONSE_TIMEOUT_MS);
        await pending;
        await r.flush();
        expect(r.text()).toContain("Tempo de resposta esgotado");
        expect(r.button("Conferir intenção").props.disabled).toBe(false);
        const raw = data.get(chaveCaixa37(901, "aporte"));
        d.resolve(
          kind === "mutation"
            ? result(intent())
            : {
                ...fence(intent()),
                status: "confirmed",
                operationId: op,
                result: result(intent()),
              }
        );
        await r.flush();
        expect(data.get(chaveCaixa37(901, "aporte"))).toBe(raw);
        expect(h.invalidar).not.toHaveBeenCalled();
        h.reconciliar.mockImplementation(async i => ({
          ...fence(i),
          status: "confirmed",
          operationId: op,
          result: result(i),
        }));
        await r.click("Conferir intenção");
        expect(r.text()).toContain("Operação confirmada:");
        expect(h.aportar).toHaveBeenCalledTimes(kind === "mutation" ? 1 : 0);
      } finally {
        vi.useRealTimers();
      }
    }
  );
  it.each(["mutation", "recovery"])(
    "falha ao salvar confirmação de %s conserva intenção e recovery",
    async kind => {
      let r: Awaited<ReturnType<typeof ui>>;
      if (kind === "mutation") {
        r = await ui();
        await prepare(r);
        h.aportar.mockResolvedValue(result(intent()));
        storage.setItem
          .mockImplementationOnce((k, v) => {
            data.set(k, v);
          })
          .mockImplementationOnce(() => {
            throw Error("quota confirmação");
          });
        await r.click("Confirmar aporte");
      } else {
        save();
        r = await ui();
        h.reconciliar.mockImplementation(async i => ({
          ...fence(i),
          status: "confirmed",
          operationId: op,
          result: result(i),
        }));
        storage.setItem.mockImplementationOnce(() => {
          throw Error("quota confirmação");
        });
        await r.click("Conferir intenção");
      }
      expect(r.text()).not.toContain("Operação confirmada:");
      expect(h.callback).not.toHaveBeenCalled();
      h.reconciliar.mockImplementation(async i => ({
        ...fence(i),
        status: "confirmed",
        operationId: op,
        result: result(i),
      }));
      await r.click("Conferir intenção");
      expect(r.text()).toContain("Operação confirmada:");
      expect(h.callback).toHaveBeenCalledOnce();
    }
  );
  it("storage surgiu entre preview e gesto não é substituído e nenhuma UUID é gerada", async () => {
    const r = await ui();
    await prepare(r);
    save("aporte", { idempotencyKey: uuidB });
    const raw = data.get(chaveCaixa37(901, "aporte"));
    await r.click("Confirmar aporte");
    expect(h.aportar).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();
    expect(data.get(chaveCaixa37(901, "aporte"))).toBe(raw);
  });
  it("storage removido depois da prova fence não pode ser encerrado por evidence velha", async () => {
    save();
    const r = await ui();
    await r.click("Conferir intenção");
    save("aporte", { idempotencyKey: uuidB });
    const raw = data.get(chaveCaixa37(901, "aporte"));
    await r.click("Preparar nova intenção");
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(data.get(chaveCaixa37(901, "aporte"))).toBe(raw);
  });
  it("storage mudou durante recovery não grava proof nem libera gesto novo", async () => {
    save();
    const d = deferred<unknown>();
    h.reconciliar.mockReturnValue(d.promise);
    const r = await ui();
    const pending = r.click("Conferir intenção");
    await r.flush();
    save("aporte", { idempotencyKey: uuidB });
    d.resolve(fence(intent()));
    await pending;
    expect(r.text()).not.toContain("Preparar nova intenção");
    expect(h.callback).not.toHaveBeenCalled();
  });
  it("dupla montagem não reenvia intenção da primeira montagem", async () => {
    const d = deferred<unknown>();
    h.aportar.mockReturnValue(d.promise);
    const a = await ui(),
      b = await ui();
    await prepare(a);
    await prepare(b);
    const first = a.click("Confirmar aporte");
    await a.flush();
    await b.click("Confirmar aporte");
    expect(h.aportar).toHaveBeenCalledOnce();
    expect(randomUUID).toHaveBeenCalledOnce();
    d.reject(Error("timeout"));
    await first;
  });
  it.each(["uma-perna", "ordem", "duplicada", "valor", "total", "range"])(
    "transferência com proof %s nunca confirma",
    async kind => {
      const good = result(intent("transferir"));
      const bad =
        kind === "uma-perna"
          ? { ...good, pernas: good.pernas.slice(0, 1) }
          : kind === "ordem"
            ? { ...good, pernas: [...good.pernas].reverse() }
            : kind === "duplicada"
              ? {
                  ...good,
                  pernas: [
                    good.pernas[0],
                    { ...good.pernas[1], transacaoCaixaId: "101" },
                  ],
                }
              : kind === "valor"
                ? {
                    ...good,
                    pernas: [
                      good.pernas[0],
                      { ...good.pernas[1], valor: "12.31" },
                    ],
                  }
                : kind === "total"
                  ? { ...good, saldoTotalOwnerApos: "10000000000000012.30" }
                  : {
                      ...good,
                      pernas: [
                        good.pernas[0],
                        { ...good.pernas[1], transacaoCaixaId: "2147483648" },
                      ],
                    };
      h.transferir.mockResolvedValue(bad);
      const r = await ui("transferir");
      await prepare(r, "transferir");
      await r.click("Confirmar transferência");
      expect(h.callback).not.toHaveBeenCalled();
      expect(h.invalidar).not.toHaveBeenCalled();
      expect(r.text()).toContain("Conferir intenção");
      expect(h.transferir).toHaveBeenCalledOnce();
    }
  );
  it("capability tardia A→B→A não autoriza nova geração", async () => {
    const d = deferred<RefetchResult>();
    h.capacidade.mockReturnValueOnce(d.promise);
    const r = await ui();
    h.user = { id: 902 };
    r.render();
    h.user = { id: 901 };
    r.render();
    await r.flush();
    h.capacidade.mockResolvedValue({
      data: {
        ...capacidade,
        disponivel: false,
        aporte: false,
        transferencia: false,
        recovery: false,
      },
    });
    await r.click("Conferir disponibilidade novamente");
    d.resolve({ data: capacidade });
    await r.flush();
    fill(r);
    expect(r.button("Obter cotação").props.disabled).toBe(true);
  });
  it("callback falho após persistência não permite novo POST ou dupla invalidação", async () => {
    h.aportar.mockResolvedValue(result(intent()));
    h.callback.mockImplementationOnce(() => {
      throw Error("callback");
    });
    const r = await ui();
    await prepare(r);
    await r.click("Confirmar aporte");
    expect(r.text()).toContain("Operação confirmada:");
    expect(h.aportar).toHaveBeenCalledOnce();
    r.unmount();
    const reload = await ui();
    expect(reload.text()).toContain("Operação confirmada:");
    expect(h.invalidar).toHaveBeenCalledOnce();
  });
  it.each(["0.01", "9999999999.99"])(
    "valor extremo %s preservado sem arredondamento",
    async value => {
      const r = await ui();
      fill(r);
      r.change("Valor", value);
      await r.click("Obter cotação");
      await r.click("Confirmar aporte");
      expect(h.aportar.mock.calls[0][0].valor).toBe(value);
    }
  );
  it("descrição apenas espaços fica null congelado e não undefined na recuperação", async () => {
    const r = await ui();
    fill(r);
    r.change("Descrição opcional", "   ");
    await r.click("Obter cotação");
    await r.click("Confirmar aporte");
    expect(h.aportar.mock.calls[0][0]).not.toHaveProperty("descricao");
    await r.click("Conferir intenção");
    expect(h.reconciliar.mock.calls[0][0].request.descricao).toBeNull();
  });
});

describe("handlers anteriores não preservam autorização revogada", () => {
  it("handler confirmado antes de refetch de quote falho não envia", async () => {
    const r = await ui();
    await prepare(r);
    const old = r.button("Confirmar aporte").props.onClick as () => unknown;
    h.cotar.mockRejectedValueOnce(Error("quote fail"));
    await r.click("Obter cotação");
    await old();
    await r.flush();
    expect(h.aportar).not.toHaveBeenCalled();
  });
  it("handler confirmado antes de capacidade indisponível não envia", async () => {
    const r = await ui();
    await prepare(r);
    const old = r.button("Confirmar aporte").props.onClick as () => unknown;
    h.capacidade.mockResolvedValue({
      data: {
        ...capacidade,
        disponivel: false,
        aporte: false,
        transferencia: false,
        recovery: false,
      },
    });
    await r.click("Conferir disponibilidade novamente");
    await old();
    await r.flush();
    expect(h.aportar).not.toHaveBeenCalled();
    expect(r.text()).not.toContain("Data da operação");
  });
  it("checkbox revogado também recusa handler que antes aceitava negativo", async () => {
    const r = await ui("transferir");
    await prepare(r, "transferir");
    const old = r.button("Confirmar transferência").props
      .onClick as () => unknown;
    r.change("Confirmar saldo negativo", false);
    await old();
    await r.flush();
    expect(h.transferir).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();
  });
});
