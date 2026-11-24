import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";

const h = vi.hoisted(() => ({
  user: { id: 901 } as any, auth: {} as any, queries: {} as Record<string, any>,
  aplicar: vi.fn(), receber: vi.fn(), renovar: vi.fn(), reconciliar: vi.fn(),
  disponibilidade: vi.fn(), cotar: vi.fn(), cotarRenovacao: vi.fn(),
  query: vi.fn(), authQuery: vi.fn(), invalidar: vi.fn(), callback: vi.fn(),
  success: vi.fn(), error: vi.fn(),
}));
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/components/ui/input", () => ({ Input: "input" }));
vi.mock("@/components/ui/label", () => ({ Label: "label" }));
vi.mock("@/components/ui/dialog", () => ({ Dialog: "dialog", DialogContent: "div", DialogHeader: "header", DialogTitle: "h2" }));
vi.mock("sonner", () => ({ toast: { success: h.success, error: h.error } }));
vi.mock("@trpc/client", () => ({ httpBatchLink: () => ({}), createTRPCProxyClient: () => ({
  // Os módulos reais importados também inicializam estes namespaces, sem usá-los.
  emprestimosProspectivos: {}, emprestimosMultimodal: {},
  multaManual: {
    aplicar: { mutate: h.aplicar }, receber: { mutate: h.receber },
    renovar: { mutate: h.renovar }, reconciliar: { mutate: h.reconciliar },
  },
}) }));
vi.mock("@/lib/trpc", () => {
  const utils = new Proxy({}, { get: () => new Proxy({}, { get: () => ({ invalidate: h.invalidar }) }) });
  const source = (name: string, input: any, options: any) => {
    h.query(name, input, options);
    return h.queries[name] ?? {
      data: name === "disponibilidade" ? capacidade : name === "cotar" ? receiptQuote : renewalQuote,
      isError: false, isLoading: false, isFetching: false,
      refetch: async () => ({ data: await (h as any)[name](input), isError: false }),
    };
  };
  return { trpc: {
    auth: { me: { useQuery: (input: any, options: any) => {
      h.authQuery(input, options);
      return { data: h.user, isError: false, isLoading: false, isFetching: false, ...h.auth };
    } } },
    multaManual: {
      disponibilidade: { useQuery: (i: any, o: any) => source("disponibilidade", i, o) },
      cotar: { useQuery: (i: any, o: any) => source("cotar", i, o) },
      cotarRenovacao: { useQuery: (i: any, o: any) => source("cotarRenovacao", i, o) },
    },
    useUtils: () => utils,
  } };
});

import { MultaManualAplicar, MultaManualFormulario, MultaManualReceber, MultaManualRenovar } from "./MultaManualOperacoes";
import { chaveMulta, useIntencaoMulta, type AcaoMulta } from "./MultaManualRpc";
import {
  aplicarMultaSchema, receberMultaSchema, renovarMultaSchema,
  normalizarAplicacaoMulta, normalizarCotacaoMulta, normalizarCotacaoRenovacaoMulta,
  normalizarRecebimentoMulta, normalizarRenovacaoMulta, normalizarRecuperacaoMulta,
} from "../../../shared/multaManual";

/** Renderer em memória, seguindo multimodal.ui.test.ts. React e os hooks de produção
 * NÃO são mockados. O dispatcher do renderer mantém slots por componente e executa
 * effects/cleanups em commit; elementos, handlers, validações e hooks financeiros são reais.
 * Componentes filhos (inclusive IntencaoMulta) são montados, não tratados como strings.
 */
type Frame = { values: any[]; deps: any[][]; cleanups: Array<(() => void) | undefined>; cursor: number };
const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
class MemoryUI {
  frames = new Map<string, Frame>(); tree: any; writes = 0; mounted = true; dirty = true;
  private effects: Array<() => void> = [];
  constructor(private component: any, public props: any) { instances.push(this); }
  private expand(node: any, path: string, seen: Set<string>): any {
    if (Array.isArray(node)) return node.map((n, i) => this.expand(n, `${path}/${n?.key ?? i}`, seen));
    if (!React.isValidElement(node)) return node;
    const element = node as React.ReactElement<any>;
    if (typeof element.type === "function") {
      const id = `${path}:${element.type.name}:${element.key ?? ""}`;
      seen.add(id);
      let frame = this.frames.get(id);
      if (!frame) { frame = { values: [], deps: [], cleanups: [], cursor: 0 }; this.frames.set(id, frame); }
      frame.cursor = 0;
      const f = frame;
      const effect = (fn: any, deps?: any[]) => {
        const i = f.cursor++, changed = !deps || !f.deps[i] || deps.length !== f.deps[i].length || deps.some((v, n) => !Object.is(v, f.deps[i][n]));
        if (changed) {
          f.deps[i] = deps ? [...deps] : [];
          this.effects.push(() => { f.cleanups[i]?.(); f.cleanups[i] = fn(); });
        }
      };
      const memo = (fn: any, deps?: any[]) => {
        const i = f.cursor++;
        if (!deps || !f.deps[i] || deps.length !== f.deps[i].length || deps.some((v, n) => !Object.is(v, f.deps[i][n]))) {
          f.values[i] = fn(); f.deps[i] = deps ? [...deps] : [];
        }
        return f.values[i];
      };
      const previous = internals.H;
      internals.H = {
        useState: (initial: any) => {
          const i = f.cursor++;
          if (!(i in f.values)) f.values[i] = typeof initial === "function" ? initial() : initial;
          return [f.values[i], (next: any) => {
            this.writes++;
            f.values[i] = typeof next === "function" ? next(f.values[i]) : next;
            this.dirty = true;
          }];
        },
        useRef: (initial: any) => { const i = f.cursor++; return f.values[i] ?? (f.values[i] = { current: initial }); },
        useMemo: memo, useCallback: (fn: any, deps: any[]) => memo(() => fn, deps),
        useEffect: effect, useLayoutEffect: effect,
      };
      let child: any;
      try { child = (element.type as any)(element.props); }
      finally { internals.H = previous; }
      return this.expand(child, `${id}/child`, seen);
    }
    return { ...element, props: { ...element.props, children: this.expand(element.props.children, `${path}/children`, seen) } };
  }
  render() {
    if (!this.mounted) return this;
    let n = 0;
    do {
      this.dirty = false;
      const seen = new Set<string>();
      this.tree = this.expand(React.createElement(this.component, this.props), "root", seen);
      for (const [id, f] of this.frames) if (!seen.has(id)) { f.cleanups.forEach(fn => fn?.()); this.frames.delete(id); }
      this.effects.splice(0).forEach(fn => fn());
      if (++n > 40) throw Error("Loop de render");
    } while (this.dirty);
    return this;
  }
  async flush() { for (let i = 0; i < 40; i++) { await Promise.resolve(); if (this.dirty && this.mounted) this.render(); } return this; }
  unmount() { if (!this.mounted) return; this.frames.forEach(f => f.cleanups.forEach(fn => fn?.())); this.mounted = false; this.dirty = false; }
  nodes(type?: any) {
    const out: any[] = [];
    const walk = (n: any) => { if (!n) return; if (Array.isArray(n)) return n.forEach(walk); if (typeof n !== "object") return; if (!type || n.type === type) out.push(n); walk(n.props?.children); };
    walk(this.tree); return out;
  }
  text(node: any = this.tree): string {
    const walk = (n: any): string => n == null || typeof n === "boolean" ? "" : Array.isArray(n) ? n.map(walk).join(" ") : typeof n === "object" ? walk(n.props?.children) : String(n);
    return walk(node).replace(/\s+/g, " ");
  }
  button(fragment: string) { const n = this.nodes("button").find(n => this.text(n).includes(fragment)); if (!n) throw Error(`Botão ausente: ${fragment}\n${this.text()}`); return n; }
  async click(fragment: string) {
    const n = this.button(fragment); if (n.props.disabled) throw Error(`Botão desabilitado: ${fragment}`);
    const pending = n.props.onClick({ stopPropagation() {} });
    this.render(); await this.flush(); await pending; this.render(); await this.flush();
  }
  change(node: any, value: string) { if (node.props.disabled) throw Error("Campo desabilitado"); node.props.onChange({ target: { value } }); this.render(); }
}
const uuid = "11111111-1111-4111-8111-111111111111", uuidB = "22222222-2222-4222-8222-222222222222", operationId = "33333333-3333-4333-8333-333333333333";
const capacidade = { disponivel: true, regra: "multa36_v1", aplicacao: true, recebimento: true, renovacao: true };
const receiptQuote = { elegivel: true, contratoId: 1, parcelaId: 2, contaCaixaId: 3, totalExigido: "565.60", multa: "12.00", mora: "3.60", jurosEmbutidos: "50.00", valorPagoAcumulado: "0.00", dataPagamento: "2026-11-20", vencimento: "2026-11-10", status: "atrasada", estadoHash: "a".repeat(64), regra: "recebimento_multa36_brt_v1" };
const renewalQuote = { renovavel: true, contratoId: 1, parcelaId: 2, contaCaixaId: 3, totalExigido: "65.60", juros: "50.00", multa: "12.00", mora: "3.60", principalPreservado: "500.00", dataPagamento: "2026-11-20", novoVencimento: "2026-12-20", estadoHash: "a".repeat(64), regra: "renovacao_multa36_brt_v1" };
const application = (extra = {}) => ({ idempotencyKey: uuid, idcontrato: 1, multa: "12.00", ...extra });
const receipt = (extra = {}) => ({ idempotencyKey: uuid, contratoId: 1, parcelaId: 2, modo: "integral", valorRecebido: receiptQuote.totalExigido, totalExigido: receiptQuote.totalExigido, dataPagamento: receiptQuote.dataPagamento, estadoHash: receiptQuote.estadoHash, ...extra });
const renewal = (extra = {}) => ({ idempotencyKey: uuid, contratoId: 1, parcelaId: 2, novoVencimento: renewalQuote.novoVencimento, valorRecebido: renewalQuote.totalExigido, totalExigido: renewalQuote.totalExigido, dataPagamento: renewalQuote.dataPagamento, estadoHash: renewalQuote.estadoHash, ...extra });
const cents = (v: string) => BigInt(v.replace(".", ""));
const money = (n: bigint) => `${n / 100n}.${(n % 100n).toString().padStart(2, "0")}`;
const applied = (p: any = application()) => {
  const parcelasIds = p.parcelasIds ?? [2, 4];
  return { success: true, operationId, repetida: false, contratoId: p.idcontrato, contaCaixaId: 3, parcelasIds, quantidade: parcelasIds.length, valorFixoPorParcela: p.multa, valorMultaTotal: money(cents(p.multa) * BigInt(parcelasIds.length)), dataCivilBrt: "2026-11-20", estado: "exigivel_nao_recebida", trilho: "multa36" };
};
const received = (p: any = receipt()) => ({ success: true, operationId, repetida: false, contratoId: p.contratoId, parcelaId: p.parcelaId, transacaoCaixaId: "9223372036854775807", contaCaixaId: 3, valorRecebido: p.valorRecebido, totalExigido: p.totalExigido, saldoResidual: money(cents(p.totalExigido) - cents(p.valorRecebido)), valorPagoAcumulado: p.valorRecebido, dataPagamento: p.dataPagamento, status: p.modo === "integral" ? "paga" : "parcial", contratoStatus: "ativo", regra: "recebimento_multa36_brt_v1" });
const renewed = (p: any = renewal()) => ({ success: true, operationId, repetida: false, contratoId: p.contratoId, parcelaId: p.parcelaId, novaParcelaId: 4, transacaoCaixaId: "9223372036854775807", contaCaixaId: 3, valorRecebido: p.valorRecebido, dataPagamento: p.dataPagamento, novoVencimento: p.novoVencimento, contratoStatus: "ativo", status: "renovada", regra: "renovacao_multa36_brt_v1" });
const body = (acao: AcaoMulta) => acao === "multa" ? application() : acao === "receber" ? receipt() : renewal();
const result = (acao: AcaoMulta, p = body(acao)) => acao === "multa" ? applied(p) : acao === "receber" ? received(p) : renewed(p);
const mutation = (acao: AcaoMulta) => acao === "multa" ? h.aplicar : acao === "receber" ? h.receber : h.renovar;
const request = (acao: AcaoMulta, p: any) => { const { idempotencyKey, ...payload } = p; return { acao, idempotencyKey, payload }; };
const proof = (r: any, extra = {}) => ({ ...r, userId: 901, status: "not_executed", operationId: null, result: null, proof: "uuid_fenced36_v1", ...extra });
const key = (acao: AcaoMulta, userId = 901, contratoId = 1, parcelaId = 2) => chaveMulta(userId, acao, contratoId, acao === "multa" ? undefined : parcelaId);
function deferred<T = any>() { let resolve!: (v: T) => void, reject!: (e: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
let instances: MemoryUI[], data: Map<string, string>, storage: any, network: any;
function save(acao: AcaoMulta, p = body(acao), confirmacao?: any) { data.set(key(acao), JSON.stringify({ versao: 1, payload: p, ...(confirmacao === undefined ? {} : { confirmacao }) })); }
const props = (extra = {}) => ({ contratoId: 1, parcelaId: 2, origemUserId: 901, status: "atrasada", onSuccess: h.callback, ...extra });
const applyUI = async (extra = {}) => new MemoryUI(MultaManualFormulario, { contratoId: 1, onSuccess: h.callback, ...extra }).render().flush();
const receiveUI = async (extra = {}) => new MemoryUI(MultaManualReceber, props(extra)).render().flush();
const renewUI = async (extra = {}) => new MemoryUI(MultaManualRenovar, props(extra)).render().flush();
const ui = (acao: AcaoMulta) => acao === "multa" ? applyUI() : acao === "receber" ? receiveUI() : renewUI();
function fillApplication(r: MemoryUI, valor = "12", ids?: string) {
  r.change(r.nodes("input")[0], valor);
  if (ids !== undefined) { r.change(r.nodes("select")[0], "explicita"); r.change(r.nodes("input")[1], ids); }
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("React", React); instances = []; h.user = { id: 901 }; h.auth = {}; h.queries = {};
  data = new Map();
  storage = { getItem: vi.fn((k: string) => data.get(k) ?? null), setItem: vi.fn((k: string, v: string) => data.set(k, v)), removeItem: vi.fn((k: string) => data.delete(k)) };
  vi.stubGlobal("sessionStorage", storage); vi.stubGlobal("crypto", { randomUUID: vi.fn(() => uuid) });
  network = vi.fn(() => { throw Error("Rede fora da fronteira permitida"); }); vi.stubGlobal("fetch", network);
  h.invalidar.mockResolvedValue(undefined);
  h.aplicar.mockRejectedValue(Error("timeout")); h.receber.mockRejectedValue(Error("timeout")); h.renovar.mockRejectedValue(Error("timeout"));
  h.reconciliar.mockImplementation(async r => proof(r));
  h.disponibilidade.mockResolvedValue(capacidade);
  h.cotar.mockImplementation(async input => ({ ...receiptQuote, ...input }));
  h.cotarRenovacao.mockImplementation(async input => ({ ...renewalQuote, ...input }));
  // Fixtures válidas comprovadas pelos contratos reais, não por um hook substituto.
  aplicarMultaSchema.parse(application()); receberMultaSchema.parse(receipt()); renovarMultaSchema.parse(renewal());
  normalizarAplicacaoMulta(applied(), application()); normalizarRecebimentoMulta(received(), receipt()); normalizarRenovacaoMulta(renewed(), renewal());
  normalizarCotacaoMulta(receiptQuote, { contratoId: 1, parcelaId: 2 });
  normalizarCotacaoRenovacaoMulta(renewalQuote, { contratoId: 1, parcelaId: 2, novoVencimento: renewalQuote.novoVencimento });
  normalizarRecuperacaoMulta(proof(request("multa", application())), 901, request("multa", application()));
});
afterEach(() => {
  instances.forEach(r => r.unmount()); expect(network).not.toHaveBeenCalled();
  expect(h.query.mock.calls.every(c => c[2].enabled === false && c[2].retry === false && c[2].staleTime === 0)).toBe(true);
  vi.unstubAllGlobals();
});

describe("aplicação: decimal, seleção e snapshot durável", () => {
  it.each(["0", "0.00", "-1", "1,20", "1.234", "1e2", "NaN", "Infinity", " 12", "10000000000"])("multa inválida %s não cria UUID/storage/POST", async valor => {
    const r = await applyUI(); fillApplication(r, valor); await r.click("Confirmar multa fixa");
    expect(h.aplicar).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled(); expect(data.size).toBe(0); expect(h.error).toHaveBeenCalled();
  });
  it.each(["2, 2", "0, 2", "-2", "2,", "2.5", "2147483648", "2, x", ""])("seleção inválida %s não persiste nem envia", async ids => {
    const r = await applyUI(); fillApplication(r, "12", ids); await r.click("Confirmar multa fixa");
    expect(h.aplicar).not.toHaveBeenCalled(); expect(data.size).toBe(0); expect(crypto.randomUUID).not.toHaveBeenCalled();
  });
  it.each(["automatica", "explicita"])("%s congela corpo original e UUID em timeout/reload/retry", async mode => {
    let r = await applyUI(); fillApplication(r, "12.3", mode === "explicita" ? "4, 2" : undefined);
    await r.click("Confirmar multa fixa"); const p = h.aplicar.mock.calls[0][0];
    expect(p).toEqual({ idcontrato: 1, multa: "12.30", idempotencyKey: uuid, ...(mode === "explicita" ? { parcelasIds: [4, 2] } : {}) });
    expect(JSON.parse(data.get(key("multa"))!).payload).toEqual(p);
    r.unmount(); h.disponibilidade.mockRejectedValue(Error("não recotar a intenção")); r = await applyUI();
    h.aplicar.mockResolvedValue(applied(p)); await r.click("Repetir a mesma intenção");
    expect(h.aplicar.mock.calls.map(c => c[0])).toEqual([p, p]); expect(crypto.randomUUID).toHaveBeenCalledOnce();
    expect(h.callback).toHaveBeenCalledOnce(); expect(h.success).toHaveBeenCalledOnce();
    r.unmount(); r = await applyUI(); expect(r.text()).toContain("Operação confirmada"); expect(r.text()).not.toContain("Repetir a mesma");
    expect(h.aplicar).toHaveBeenCalledTimes(2); expect(h.disponibilidade).toHaveBeenCalledOnce();
  });
  it("confirmação encerra apenas por gesto e nova seleção gera novo UUID", async () => {
    h.aplicar.mockImplementation(async p => applied(p)); (crypto.randomUUID as any).mockReturnValueOnce(uuid).mockReturnValueOnce(uuidB);
    const r = await applyUI(); fillApplication(r); await r.click("Confirmar multa");
    expect(data.size).toBe(1); expect(storage.removeItem).not.toHaveBeenCalled();
    await r.click("Encerrar confirmação"); expect(data.size).toBe(0); fillApplication(r, "8", "2"); await r.click("Confirmar multa");
    expect(h.aplicar.mock.calls[1][0]).toEqual(application({ idempotencyKey: uuidB, multa: "8.00", parcelasIds: [2] }));
  });
  it.each([false, "wrong-family", "extra"])("capacidade %s falha fechado", async mode => {
    h.disponibilidade.mockResolvedValue(mode === false ? { ...capacidade, renovacao: false } : mode === "extra" ? { ...capacidade, owner: 901 } : { ...capacidade, regra: "multimodal_v1" });
    const r = await applyUI(); expect(r.button("Confirmar multa").props.disabled).toBe(true); expect(h.aplicar).not.toHaveBeenCalled(); expect(data.size).toBe(0);
  });
});

describe("storage: nenhuma intenção volátil nem sobrescrita concorrente", () => {
  it.each(["ausente", "read-error"])("storage %s bloqueia antes de UUID/POST", async mode => {
    if (mode === "ausente") vi.stubGlobal("sessionStorage", undefined); else storage.getItem.mockImplementation(() => { throw Error("storage indisponível"); });
    const r = await applyUI(); expect(r.button("Confirmar multa").props.disabled).toBe(true); expect(h.aplicar).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled();
  });
  it.each(["throw", "silent"])("persistência inicial %s bloqueia também o handler antigo", async mode => {
    const r = await applyUI(); fillApplication(r);
    storage.setItem.mockImplementation(() => { if (mode === "throw") throw Error("quota"); });
    const send = r.button("Confirmar multa").props.onClick; await send(); await r.flush(); await send(); await r.flush();
    expect(h.aplicar).not.toHaveBeenCalled(); expect(crypto.randomUUID).toHaveBeenCalledOnce(); expect(r.button("Repetir a mesma").props.disabled).toBe(true); expect(data.size).toBe(0);
  });
  it.each(["multa", "receber", "renovar"] as const)("storage %s surgido após render é lido, não substituído", async acao => {
    const r = await ui(acao); if (acao === "multa") fillApplication(r); if (acao === "renovar") { r.change(r.nodes("input")[0], renewalQuote.novoVencimento); await r.flush(); }
    const p = body(acao); p.idempotencyKey = uuidB; save(acao, p); const raw = data.get(key(acao));
    await r.click(acao === "multa" ? "Confirmar multa" : acao === "receber" ? "Confirmar recebimento" : "Confirmar juros");
    expect(mutation(acao)).toHaveBeenCalledWith(p); expect(data.get(key(acao))).toBe(raw); expect(storage.setItem).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled();
  });
  it.each(["removido", "outro-uuid", "corpo", "confirmacao"])("storage %s antes do POST bloqueia sem sobrescrever", async mode => {
    save("receber"); const r = await receiveUI();
    if (mode === "removido") data.delete(key("receber")); else save("receber", receipt(mode === "outro-uuid" ? { idempotencyKey: uuidB } : mode === "corpo" ? { estadoHash: "b".repeat(64) } : {}), mode === "confirmacao" ? received() : undefined);
    const raw = data.get(key("receber")); await r.click("Repetir a mesma");
    expect(h.receber).not.toHaveBeenCalled(); expect(data.get(key("receber"))).toBe(raw); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it.each(["multa", "receber", "renovar"] as const)("storage %s mudou durante POST: não grava confirmação/callback", async acao => {
    save(acao); const d = deferred(); mutation(acao).mockReturnValueOnce(d.promise); const r = await ui(acao), flight = r.click("Repetir a mesma"); await r.flush();
    const p = body(acao); p.idempotencyKey = uuidB; save(acao, p); const raw = data.get(key(acao)); d.resolve(result(acao)); await flight;
    expect(data.get(key(acao))).toBe(raw); expect(storage.setItem).not.toHaveBeenCalled(); expect(h.callback).not.toHaveBeenCalled(); expect(h.success).not.toHaveBeenCalled();
  });
  it.each(["multa", "receber", "renovar"] as const)("falha ao salvar confirmação %s conserva intenção e admite mesmo replay", async acao => {
    save(acao); const r = await ui(acao); mutation(acao).mockResolvedValue(result(acao));
    storage.setItem.mockImplementationOnce(() => { throw Error("quota confirmação"); }); await r.click("Repetir a mesma");
    expect(h.callback).not.toHaveBeenCalled(); expect(JSON.parse(data.get(key(acao))!).confirmacao).toBeUndefined();
    await r.click("Repetir a mesma"); expect(mutation(acao).mock.calls.map(c => c[0])).toEqual([body(acao), body(acao)]); expect(h.callback).toHaveBeenCalledOnce(); expect(crypto.randomUUID).not.toHaveBeenCalled();
  });
  it("duplo clique durante POST só envia uma vez", async () => {
    save("receber"); const d = deferred(); h.receber.mockReturnValueOnce(d.promise); const r = await receiveUI(), send = r.button("Repetir a mesma").props.onClick;
    const a = send(), b = send(); await r.flush(); expect(h.receber).toHaveBeenCalledOnce(); d.reject(Error("timeout")); await Promise.all([a, b]);
  });
});

describe("confirmação estrita e recovery autoritativo uuid_fenced36_v1", () => {
  it.each(["multa", "receber", "renovar"] as const)("timeout/reload %s usa mesmo UUID/body sem recotar", async acao => {
    save(acao); let r = await ui(acao); await r.click("Repetir a mesma"); r.unmount(); r = await ui(acao);
    mutation(acao).mockResolvedValue(result(acao)); await r.click("Repetir a mesma"); expect(mutation(acao).mock.calls.map(c => c[0])).toEqual([body(acao), body(acao)]);
    expect(crypto.randomUUID).not.toHaveBeenCalled(); expect(h.cotar).not.toHaveBeenCalled(); expect(h.cotarRenovacao).not.toHaveBeenCalled(); expect(h.disponibilidade).not.toHaveBeenCalled();
  });
  it.each(["multa", "receber", "renovar"] as const)("resposta parcial/extra/divergente %s nunca confirma", async acao => {
    for (const bad of [{ success: true }, { ...result(acao), owner: 901 }, { ...result(acao), contratoId: 9 }]) {
      save(acao); const raw = data.get(key(acao)); mutation(acao).mockResolvedValue(bad); const r = await ui(acao); await r.click("Repetir a mesma");
      expect(data.get(key(acao))).toBe(raw); expect(h.callback).not.toHaveBeenCalled(); expect(h.success).not.toHaveBeenCalled(); r.unmount();
    }
  });
  it("aplicação explícita não aceita ID omitido/extra nem produto incorreto", async () => {
    const p = application({ parcelasIds: [2, 4] }); save("multa", p); const raw = data.get(key("multa")); const r = await applyUI();
    for (const bad of [{ ...applied(p), parcelasIds: [2, 9] }, { ...applied(p), valorMultaTotal: "12.00" }]) {
      h.aplicar.mockResolvedValue(bad); await r.click("Repetir a mesma"); expect(data.get(key("multa"))).toBe(raw); expect(h.callback).not.toHaveBeenCalled();
    }
  });
  it.each(["multa", "receber", "renovar"] as const)("confirmação local inválida %s exige recovery validado, sem novo POST", async acao => {
    save(acao, body(acao), { success: true }); const r = await ui(acao); expect(r.button("Repetir a mesma").props.disabled).toBe(true); expect(r.text()).not.toContain("Operação confirmada");
    h.reconciliar.mockImplementation(async req => proof(req, { status: "confirmed", operationId, result: result(acao) }));
    await r.click("Conferir intenção"); expect(JSON.parse(data.get(key(acao))!).confirmacao).toEqual(result(acao)); expect(h.callback).toHaveBeenCalledOnce(); expect(mutation(acao)).not.toHaveBeenCalled();
  });
  it.each(["multa", "receber", "renovar"] as const)("somente fence %s + gesto autoriza correção e novo UUID", async acao => {
    save(acao); const r = await ui(acao); await r.click("Repetir a mesma");
    h.reconciliar.mockRejectedValueOnce(Error("NOT_FOUND")); await r.click("Conferir intenção"); expect(r.text()).not.toContain("Corrigir após"); expect(storage.removeItem).not.toHaveBeenCalled();
    await r.click("Conferir intenção"); expect(h.reconciliar).toHaveBeenLastCalledWith(request(acao, body(acao))); expect(data.size).toBe(1); expect(r.button("Repetir a mesma").props.disabled).toBe(true);
    await r.click("Corrigir após"); expect(data.size).toBe(0); (crypto.randomUUID as any).mockReturnValue(uuidB);
    if (acao === "multa") expect(r.nodes("input")[0].props.value).toBe("12.00");
    if (acao === "renovar") r.change(r.nodes("input")[0], renewalQuote.novoVencimento);
    await r.flush(); await r.click(acao === "multa" ? "Confirmar multa" : acao === "receber" ? "Confirmar recebimento" : "Confirmar juros");
    expect(mutation(acao).mock.calls[1][0]).toEqual({ ...body(acao), idempotencyKey: uuidB });
  });
  it.each(["proof", "userId", "acao", "uuid", "payload", "operationId", "result", "extra"])("fence malformado por %s não autoriza descartar", async field => {
    save("receber"); const raw = data.get(key("receber"));
    h.reconciliar.mockImplementation(async req => proof(req, field === "proof" ? { proof: "uuid_fenced_v1" } : field === "userId" ? { userId: 902 } : field === "acao" ? { acao: "renovar" } : field === "uuid" ? { idempotencyKey: uuidB } : field === "payload" ? { payload: {} } : field === "operationId" ? { operationId } : field === "result" ? { result: {} } : { extra: true }));
    const r = await receiveUI(); await r.click("Conferir intenção"); expect(r.text()).not.toContain("Corrigir após"); expect(data.get(key("receber"))).toBe(raw); expect(storage.removeItem).not.toHaveBeenCalled(); expect(h.callback).not.toHaveBeenCalled();
  });
  it.each(["multa", "receber", "renovar"] as const)("recovery confirmed %s malformado/divergente não grava", async acao => {
    for (const bad of [{ success: true }, { ...result(acao), operationId: uuidB }]) {
      save(acao); const raw = data.get(key(acao)); h.reconciliar.mockImplementation(async req => proof(req, { status: "confirmed", operationId, result: bad }));
      const r = await ui(acao); await r.click("Conferir intenção"); expect(data.get(key(acao))).toBe(raw); expect(h.callback).not.toHaveBeenCalled(); expect(r.text()).not.toContain("Operação confirmada"); r.unmount();
    }
  });
  it("storage trocado após fence não pode ser encerrado por prova antiga", async () => {
    save("multa"); const r = await applyUI(); await r.click("Conferir intenção"); save("multa", application({ idempotencyKey: uuidB })); const raw = data.get(key("multa"));
    await r.click("Corrigir após"); expect(data.get(key("multa"))).toBe(raw); expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it("storage mudou durante recovery: não grava confirmação ou habilita correção", async () => {
    save("receber"); const d = deferred(); h.reconciliar.mockReturnValueOnce(d.promise); const r = await receiveUI(), flight = r.click("Conferir intenção"); await r.flush();
    const req = h.reconciliar.mock.calls[0][0]; save("receber", receipt({ idempotencyKey: uuidB })); const raw = data.get(key("receber")); d.resolve(proof(req)); await flight;
    expect(data.get(key("receber"))).toBe(raw); expect(r.text()).not.toContain("Corrigir após"); expect(storage.setItem).not.toHaveBeenCalled(); expect(h.callback).not.toHaveBeenCalled();
  });
  it("falha na persistência de recovery confirmado mantém replay original", async () => {
    save("renovar"); const r = await renewUI(); h.reconciliar.mockImplementation(async req => proof(req, { status: "confirmed", operationId, result: renewed() }));
    storage.setItem.mockImplementationOnce(() => { throw Error("quota confirmação"); }); await r.click("Conferir intenção");
    expect(JSON.parse(data.get(key("renovar"))!).confirmacao).toBeUndefined(); expect(h.callback).not.toHaveBeenCalled(); await r.click("Repetir a mesma"); expect(h.renovar).toHaveBeenCalledWith(renewal());
  });
  it("callback falha após confirmação durável não autoriza outro POST", async () => {
    save("receber"); h.receber.mockResolvedValue(received()); h.callback.mockImplementationOnce(() => { throw Error("callback falhou"); });
    const r = await receiveUI(); await r.click("Repetir a mesma"); expect(JSON.parse(data.get(key("receber"))!).confirmacao).toEqual(received());
    r.unmount(); const reloaded = await receiveUI(); expect(reloaded.text()).toContain("Operação confirmada"); expect(h.receber).toHaveBeenCalledOnce();
  });
  it.each(["json", "versao", "uuid", "contrato", "parcela", "outra-acao", "extra-payload"])("intenção local inválida %s bloqueia envio/clear", async mode => {
    const p = mode === "outra-acao" ? renewal() : receipt(mode === "uuid" ? { idempotencyKey: "bad" } : mode === "contrato" ? { contratoId: 9 } : mode === "parcela" ? { parcelaId: 9 } : mode === "extra-payload" ? { owner: 901 } : {});
    data.set(key("receber"), mode === "json" ? "{" : JSON.stringify({ versao: mode === "versao" ? 2 : 1, payload: p }));
    const r = await receiveUI(); expect(r.button("Confirmar recebimento").props.disabled).toBe(true); expect(h.receber).not.toHaveBeenCalled(); expect(storage.removeItem).not.toHaveBeenCalled(); expect(data.size).toBe(1);
  });
});

describe("receber residual exato e renovar somente encargos bullet", () => {
  it.each(["0", "565.60", "565.61", "1.234", "-1"])("parcial %s inválido não gera intenção", async value => {
    const r = await receiveUI(); r.change(r.nodes("select")[0], "parcial"); r.change(r.nodes("input")[0], value); await r.click("Confirmar recebimento");
    expect(h.receber).not.toHaveBeenCalled(); expect(data.size).toBe(0); expect(crypto.randomUUID).not.toHaveBeenCalled();
  });
  it("parcial positivo conserva residual centavo exato e integral usa cotação, não campo livre", async () => {
    h.receber.mockImplementation(async p => received(p)); let r = await receiveUI(); r.change(r.nodes("select")[0], "parcial"); r.change(r.nodes("input")[0], "100.01"); await r.click("Confirmar recebimento");
    expect(h.receber.mock.calls[0][0]).toEqual(receipt({ modo: "parcial", valorRecebido: "100.01" }));
    expect(JSON.parse(data.get(key("receber"))!).confirmacao.saldoResidual).toBe("465.59");
    r.unmount(); data.delete(key("receber")); h.cotar.mockResolvedValue({ ...receiptQuote, totalExigido: "465.59", valorPagoAcumulado: "100.01", status: "parcial" });
    r = await receiveUI({ status: "parcial" }); expect(r.nodes("input")).toHaveLength(0); await r.click("Confirmar recebimento");
    expect(h.receber.mock.calls[1][0]).toEqual(receipt({ valorRecebido: "465.59", totalExigido: "465.59" }));
  });
  it("renovação cobra juros+multa+mora, preserva principal sem enviá-lo como campo", async () => {
    h.renovar.mockImplementation(async p => renewed(p)); const r = await renewUI(); expect(r.button("Confirmar juros").props.disabled).toBe(true);
    r.change(r.nodes("input")[0], renewalQuote.novoVencimento); await r.flush();
    expect(r.text()).toMatch(/Receber 65\.60\s*:\s*juros 50\.00\s*,\s*multa 12\.00\s*,\s*mora 3\.60\s*\./); expect(r.text()).toContain("Principal preservado 500.00");
    await r.click("Confirmar juros"); expect(h.renovar.mock.calls[0][0]).toEqual(renewal());
    expect(Object.keys(h.renovar.mock.calls[0][0]).some(k => /principal/i.test(k))).toBe(false);
    expect(JSON.parse(data.get(key("renovar"))!).confirmacao).toEqual(renewed());
  });
  it.each(["principal-na-soma", "data-divergente", "nao-renovavel", "extra"])("cotação de renovação %s não libera envio", async mode => {
    h.cotarRenovacao.mockImplementation(async input => ({ ...renewalQuote, ...input, ...(mode === "principal-na-soma" ? { totalExigido: "565.60" } : mode === "data-divergente" ? { novoVencimento: "2027-01-20" } : mode === "nao-renovavel" ? { renovavel: false } : { modalidade: "tabela_price" }) }));
    const r = await renewUI(); r.change(r.nodes("input")[0], renewalQuote.novoVencimento); await r.flush(); expect(r.button("Confirmar juros").props.disabled).toBe(true); expect(h.renovar).not.toHaveBeenCalled();
  });
  it.each(["paga", "pago", "renovada", "cancelada", "cancelado"])("%s sem intenção não cota, gera UUID ou envia", async status => {
    const a = await receiveUI({ status }), b = await renewUI({ status }); expect(a.nodes("button")).toHaveLength(0); expect(b.nodes("button")).toHaveLength(0);
    expect(h.cotar).not.toHaveBeenCalled(); expect(h.cotarRenovacao).not.toHaveBeenCalled(); expect(h.receber).not.toHaveBeenCalled(); expect(h.renovar).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled();
  });
  it("parcial não renova nem solicita cotação de renovação", async () => { const r = await renewUI({ status: "parcial" }); expect(r.nodes("button")).toHaveLength(0); expect(h.cotarRenovacao).not.toHaveBeenCalled(); });
  it.each(["receber", "renovar"] as const)("encerrada com intenção %s permite somente retry original", async acao => {
    save(acao); const r = acao === "receber" ? await receiveUI({ status: "paga" }) : await renewUI({ status: "renovada" }); await r.click("Repetir a mesma");
    expect(mutation(acao)).toHaveBeenCalledWith(body(acao)); expect(crypto.randomUUID).not.toHaveBeenCalled(); expect(h.cotar).not.toHaveBeenCalled(); expect(h.cotarRenovacao).not.toHaveBeenCalled();
  });
});

describe("sessão/origem/cotações: cache não é autorização", () => {
  it.each(["isError", "isLoading", "isFetching"])("auth cached com %s não acessa storage/cotação/POST", async flag => {
    h.auth = { [flag]: true }; save("multa"); save("receber"); save("renovar");
    const screens = await Promise.all([applyUI(), receiveUI(), renewUI()]); expect(screens.map(r => r.text()).join(" ")).not.toContain(uuid);
    expect(storage.getItem).not.toHaveBeenCalled(); expect(h.disponibilidade).not.toHaveBeenCalled(); expect(h.cotar).not.toHaveBeenCalled(); expect(h.cotarRenovacao).not.toHaveBeenCalled();
    expect(h.aplicar).not.toHaveBeenCalled(); expect(h.receber).not.toHaveBeenCalled(); expect(h.renovar).not.toHaveBeenCalled();
  });
  it("origem de outro owner não lê intenção nem cota", async () => {
    save("receber"); save("renovar"); const a = await receiveUI({ origemUserId: 902 }), b = await renewUI({ origemUserId: 902 });
    expect(a.nodes("button")).toHaveLength(0); expect(b.nodes("button")).toHaveLength(0); expect(storage.getItem).not.toHaveBeenCalled(); expect(h.cotar).not.toHaveBeenCalled(); expect(h.cotarRenovacao).not.toHaveBeenCalled();
  });
  it("cache tRPC não aparece antes do refetch próprio", async () => {
    const d = deferred(); h.cotar.mockReturnValueOnce(d.promise); const r = await receiveUI(); expect(r.text()).not.toContain("Total exigido 565.60"); expect(r.button("Confirmar recebimento").props.disabled).toBe(true);
    d.resolve(receiptQuote); await r.flush(); expect(r.text()).toContain("Total exigido 565.60");
  });
  it.each(["isError", "isLoading", "isFetching"])("resposta refetch %s com data antiga não libera", async flag => {
    h.queries.cotar = { data: receiptQuote, isError: false, isLoading: false, isFetching: false, [flag]: true, refetch: vi.fn().mockResolvedValue({ data: receiptQuote, [flag]: true }) };
    const r = await receiveUI(); expect(r.text()).not.toContain("Total exigido 565.60"); expect(r.button("Confirmar recebimento").props.disabled).toBe(true); expect(h.receber).not.toHaveBeenCalled();
  });
  it.each(["contratoId", "parcelaId", "regra", "extra"])("cotação divergente por %s não libera", async field => {
    h.cotar.mockResolvedValue({ ...receiptQuote, [field]: field === "regra" ? "recebimento_multimodal_brt_v1" : field === "extra" ? true : 9 });
    const r = await receiveUI(); expect(r.button("Confirmar recebimento").props.disabled).toBe(true); expect(h.receber).not.toHaveBeenCalled();
  });
});

function crossScope(r: MemoryUI, kind: string) {
  const original = { ...r.props }, user = h.user, auth = h.auth;
  if (kind === "sessao") h.user = { id: 902 };
  else if (kind === "authError") h.auth = { isError: true };
  else if (kind === "authFetching") h.auth = { isFetching: true };
  else r.props[kind === "contrato" ? "contratoId" : kind === "parcela" ? "parcelaId" : kind === "origem" ? "origemUserId" : "status"] = kind === "status" ? "paga" : kind === "origem" ? 902 : 9;
  r.render(); h.user = user; h.auth = auth; r.props = original; r.render();
}
describe("lifecycle: A→B→A não revalida geração antiga", () => {
  it.each(["sessao", "contrato", "parcela", "status", "origem", "authError", "authFetching"])("POST por %s ignora resultado antigo sem estado/storage/toast", async kind => {
    save("receber"); const raw = data.get(key("receber")), d = deferred(); h.receber.mockReturnValueOnce(d.promise); const r = await receiveUI(), flight = r.click("Repetir a mesma"); await r.flush();
    crossScope(r, kind); await r.flush(); const writes = r.writes; d.resolve(received()); await flight;
    expect(r.writes).toBe(writes); expect(data.get(key("receber"))).toBe(raw); expect(h.callback).not.toHaveBeenCalled(); expect(h.success).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it.each(["sessao", "contrato", "parcela", "status", "origem", "authError", "authFetching"])("recovery por %s ignora prova antiga", async kind => {
    save("receber"); const raw = data.get(key("receber")), d = deferred(); h.reconciliar.mockReturnValueOnce(d.promise); const r = await receiveUI(), flight = r.click("Conferir intenção"); await r.flush();
    const req = h.reconciliar.mock.calls[0][0]; crossScope(r, kind); await r.flush(); const writes = r.writes;
    d.resolve(proof(req, { status: "confirmed", operationId, result: received() })); await flight;
    expect(r.writes).toBe(writes); expect(data.get(key("receber"))).toBe(raw); expect(h.callback).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it.each(["sessao", "contrato", "parcela", "status", "origem", "authError", "authFetching"])("cotação por %s não repovoa nova geração", async kind => {
    const old = deferred(), fresh = deferred(); h.cotar.mockReturnValueOnce(old.promise).mockReturnValue(fresh.promise); const r = await receiveUI();
    crossScope(r, kind); await r.flush(); const writes = r.writes; old.resolve(receiptQuote); await r.flush();
    expect(r.writes).toBe(writes); expect(r.text()).not.toContain("Total exigido"); fresh.resolve(receiptQuote); await r.flush(); expect(r.text()).toContain("Total exigido 565.60");
  });
  it.each(["sessao", "contrato", "parcela", "status", "origem", "authError", "authFetching"])("handler antigo por %s não envia depois de A→B→A", async kind => {
    save("receber"); const r = await receiveUI(), send = r.button("Repetir a mesma").props.onClick; crossScope(r, kind); await r.flush(); await send(); await r.flush();
    expect(h.receber).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled();
  });
  it.each(["POST", "recovery", "quote"])("%s após unmount não escreve estado/storage/toast", async boundary => {
    const d = deferred(); if (boundary !== "quote") save("receber");
    if (boundary === "POST") h.receber.mockReturnValueOnce(d.promise); else if (boundary === "recovery") h.reconciliar.mockReturnValueOnce(d.promise); else h.cotar.mockReturnValueOnce(d.promise);
    const r = await receiveUI(); const raw = data.get(key("receber")); const flight = boundary === "quote" ? undefined : r.click(boundary === "POST" ? "Repetir a mesma" : "Conferir intenção"); await r.flush();
    const req = h.reconciliar.mock.calls[0]?.[0]; r.unmount(); const writes = r.writes;
    d.resolve(boundary === "POST" ? received() : boundary === "quote" ? receiptQuote : proof(req, { status: "confirmed", operationId, result: received() })); await flight; await r.flush();
    expect(r.writes).toBe(writes); expect(data.get(key("receber"))).toBe(raw); expect(h.callback).not.toHaveBeenCalled(); expect(h.error).not.toHaveBeenCalled(); expect(h.success).not.toHaveBeenCalled();
  });
  it.each(["POST", "recovery", "quote"])("rejeição %s após unmount é silenciosa", async boundary => {
    const d = deferred(); if (boundary !== "quote") save("receber");
    if (boundary === "POST") h.receber.mockReturnValueOnce(d.promise); else if (boundary === "recovery") h.reconciliar.mockReturnValueOnce(d.promise); else h.cotar.mockReturnValueOnce(d.promise);
    const r = await receiveUI(), flight = boundary === "quote" ? undefined : r.click(boundary === "POST" ? "Repetir a mesma" : "Conferir intenção"); await r.flush(); r.unmount(); const writes = r.writes;
    d.reject(Error("late")); await flight; await r.flush(); expect(r.writes).toBe(writes); expect(h.error).not.toHaveBeenCalled(); expect(h.callback).not.toHaveBeenCalled();
  });
  it("handler de parcela aberta não inicia operação após encerramento", async () => {
    const r = await receiveUI(), send = r.button("Confirmar recebimento").props.onClick; r.props.status = "paga"; r.render(); await r.flush(); await send(); await r.flush();
    expect(h.receber).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled(); expect(data.size).toBe(0);
  });
  it("novo vencimento A→B→A não aceita cotação da primeira seleção", async () => {
    const old = deferred(), fresh = deferred(); h.cotarRenovacao.mockReturnValueOnce(old.promise).mockReturnValue(fresh.promise);
    const r = await renewUI(); r.change(r.nodes("input")[0], "2026-12-20"); await r.flush(); r.change(r.nodes("input")[0], "2027-01-20"); r.change(r.nodes("input")[0], "2026-12-20"); await r.flush();
    const writes = r.writes; old.resolve(renewalQuote); await r.flush(); expect(r.writes).toBe(writes); expect(r.button("Confirmar juros").props.disabled).toBe(true);
    fresh.resolve(renewalQuote); await r.flush(); expect(r.button("Confirmar juros").props.disabled).toBe(false);
  });
  it("modal de aplicação não reabre automaticamente após contrato A→B→A", async () => {
    const r = new MemoryUI(MultaManualAplicar, { contratoId: 1, onSuccess: h.callback }).render(); await r.click("Aplicar / conferir"); expect(r.nodes("dialog")[0].props.open).toBe(true);
    r.props.contratoId = 9; r.render(); r.props.contratoId = 1; r.render(); await r.flush(); expect(r.nodes("dialog")[0].props.open).toBe(false);
  });
});

// Exercita o hook real quando nova() é assíncrona, sem alterar produção para criar o cenário.
function HookUI({ acao = "multa" }: { acao?: AcaoMulta }) {
  const intent = useIntencaoMulta<any>(h.user?.id, acao, 1, acao === "multa" ? undefined : 2, h.callback);
  return React.createElement("button", { onClick: () => intent.enviar(hookCandidate, p => mutation(acao)(p)) }, "Enviar hook");
}
let hookCandidate: () => Promise<any>;
describe("fronteira assíncrona do hook real", () => {
  it("storage mudou durante nova(): candidato não sobrescreve operação concorrente", async () => {
    const d = deferred(); hookCandidate = () => d.promise; const r = new MemoryUI(HookUI, {}).render(), flight = r.click("Enviar hook"); await r.flush();
    save("multa", application({ idempotencyKey: uuidB })); const raw = data.get(key("multa")); d.resolve(application()); await flight;
    expect(data.get(key("multa"))).toBe(raw); expect(storage.setItem).not.toHaveBeenCalled(); expect(h.aplicar).not.toHaveBeenCalled();
  });
  it("nova() atrasada após sessão A→B→A não persiste nem envia", async () => {
    const d = deferred(); hookCandidate = () => d.promise; const r = new MemoryUI(HookUI, {}).render(), flight = r.click("Enviar hook"); await r.flush();
    crossScope(r, "sessao"); await r.flush(); const writes = r.writes; d.resolve(application()); await flight;
    expect(r.writes).toBe(writes); expect(data.size).toBe(0); expect(h.aplicar).not.toHaveBeenCalled();
  });
  it("handler receber→renovar→receber não reutiliza geração antiga", async () => {
    save("receber"); save("renovar"); hookCandidate = async () => { throw Error("Não criar outra intenção"); };
    const r = new MemoryUI(HookUI, { acao: "receber" }).render(), send = r.button("Enviar hook").props.onClick;
    r.props.acao = "renovar"; r.render(); r.props.acao = "receber"; r.render(); await send(); await r.flush(); expect(h.receber).not.toHaveBeenCalled(); expect(h.renovar).not.toHaveBeenCalled();
  });
});
