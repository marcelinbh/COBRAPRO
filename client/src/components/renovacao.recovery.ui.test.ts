import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";

const h = vi.hoisted(() => ({
  current: null as any, user: { id: 901 } as any, authExtra: {} as any, origem: {} as any,
  origemQuery: vi.fn(), contasQuery: vi.fn(), refetch: vi.fn(), success: vi.fn(),
  disponibilidade: vi.fn(), cotar: vi.fn(), renovar: vi.fn(), oldMutation: vi.fn(),
  parcelas: [] as any[],
}));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof React>();
  return { ...actual,
    useState: (initial: any) => { const r = h.current, i = r.cursor++; if (!(i in r.values)) r.values[i] = typeof initial === "function" ? initial() : initial; return [r.values[i], (next: any) => { r.writes++; r.values[i] = typeof next === "function" ? next(r.values[i]) : next; r.dirty = true; }]; },
    useRef: (initial: any) => { const r = h.current, i = r.cursor++; return r.values[i] ?? (r.values[i] = { current: initial }); },
    useMemo: (fn: any, deps: any[]) => { const r = h.current, i = r.cursor++; if (!r.deps[i] || deps.some((v, n) => !Object.is(v, r.deps[i][n]))) { r.values[i] = fn(); r.deps[i] = deps; } return r.values[i]; },
    useEffect: (fn: any, deps: any[]) => { const r = h.current, i = r.cursor++; if (!r.deps[i] || deps.some((v, n) => !Object.is(v, r.deps[i][n]))) { r.effects.push(() => { r.cleanups[i]?.(); r.cleanups[i] = fn(); }); r.deps[i] = deps; } },
  };
});
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/components/ui/input", () => ({ Input: "input" }));
vi.mock("@/components/ui/label", () => ({ Label: "label" }));
vi.mock("@/components/ui/dialog", () => ({ Dialog: "dialog", DialogContent: "div", DialogHeader: "header", DialogTitle: "h2" }));
vi.mock("@/components/ui/card", () => ({ Card: "article", CardContent: "div" }));
vi.mock("@/components/ui/select", () => ({ Select: "select", SelectContent: "div", SelectItem: "option", SelectTrigger: "div", SelectValue: "span" }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s, i18n: { language: "pt-BR" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
// Sentinelas dos caminhos fora do alvo: o gate deve NÃO montá-los na recuperação.
vi.mock("./EmprestimoSeguroReceber", () => ({ EmprestimoSeguroReceber: "prospectivo-receber" }));
vi.mock("./ParcelaLegadaReceber", () => ({ ParcelaLegadaReceber: "legado-receber" }));
vi.mock("@trpc/client", () => ({ httpBatchLink: vi.fn(() => ({})), createTRPCProxyClient: () => ({
  renovacaoProspectiva: { disponibilidade: { query: h.disponibilidade }, cotar: { query: h.cotar }, renovar: { mutate: h.renovar } },
}) }));
vi.mock("@/lib/trpc", () => {
  const q = (data: any, extra = {}) => ({ data, isError: false, isLoading: false, isFetching: false, refetch: h.refetch, ...extra });
  const mutation = { useMutation: () => ({ mutate: h.oldMutation }) };
  return { trpc: {
    auth: { me: { useQuery: () => q(h.user, h.authExtra) } },
    recebimentosLegados: { origem: { useQuery: (input: any, options: any) => { h.origemQuery(input, options); return h.origem; } } },
    caixa: { contas: { useQuery: (input: any, options: any) => { h.contasQuery(input, options); return q([{ id: 3, nome: "Conta sintética", ativo: true }]); } } },
    configuracoes: { get: { useQuery: () => q({}) } },
    parcelas: { list: { useQuery: () => q(h.parcelas) }, registrarPagamento: mutation, pagarJuros: mutation },
    useUtils: () => ({ dashboard: { kpis: { invalidate: h.refetch } } }),
  } };
});
import { RecebimentoValidado } from "./RecebimentoValidado";
import { EmprestimoSeguroRenovar } from "./EmprestimoSeguroRenovar";
import Parcelas from "../pages/Parcelas";
import { renovacaoProspectivaNovaIntencao } from "./renovacaoProspectivaIntencao";
import type { CotacaoRenovacaoProspectiva, ResultadoRenovacaoProspectiva } from "../../../server/services/renovacaoProspectivaRpc";

// Harness React determinístico sem DOM/rede: componentes reais produzem elementos React;
// hooks mantêm estado/ref/deps, executam effects e cleanups. Os handlers são invocados,
// não há regex de fonte nem substituição das decisões de negócio por mocks.
class MemoryUI {
  values: any[] = []; deps: any[] = []; cleanups: any[] = []; effects: any[] = [];
  cursor = 0; dirty = true; tree: any; writes = 0; mounted = true; frames: string[] = [];
  constructor(private component: any, public props: any) { instances.push(this); }
  render() { let n = 0; do { this.dirty = false; this.cursor = 0; h.current = this; this.tree = this.component(this.props); this.frames.push(this.text()); this.effects.splice(0).forEach(f => f()); if (++n > 30) throw new Error("Loop de render"); } while (this.dirty); return this; }
  async flush() { for (let i = 0; i < 24; i++) { await Promise.resolve(); if (this.dirty && this.mounted) this.render(); } return this; }
  unmount() { if (!this.mounted) return; this.cleanups.forEach(f => f?.()); this.mounted = false; this.dirty = false; }
  nodes(type?: any) { const list: any[] = []; const walk = (n: any) => { if (!n) return; if (Array.isArray(n)) return n.forEach(walk); if (typeof n !== "object") return; if (!type || n.type === type) list.push(n); walk(n.props?.children); }; walk(this.tree); return list; }
  text(n: any = this.tree): string { const walk = (v: any): string => v == null || typeof v === "boolean" ? "" : Array.isArray(v) ? v.map(walk).join(" ") : typeof v === "object" ? walk(v.props?.children) : String(v); return walk(n); }
  button(fragment: string) { const n = this.nodes("button").find(n => this.text(n).includes(fragment)); if (!n) throw new Error(`Botão ausente: ${fragment}\n${this.text()}`); return n; }
  async click(fragment: string) { const n = this.button(fragment); if (n.props.disabled) throw new Error(`Botão desabilitado: ${fragment}`); const p = n.props.onClick({ stopPropagation() {} }); if (this.mounted) this.render(); await this.flush(); await p; if (this.mounted) this.render(); await this.flush(); }
}
function deferred<T>() { let resolve!: (v: T) => void, reject!: (e: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const uuid = "11111111-1111-4111-8111-111111111111";
const uuidB = "22222222-2222-4222-8222-222222222222";
const quote: CotacaoRenovacaoProspectiva = {
  elegivel: true, contratoId: 1, parcelaId: 2, contaCaixaId: 3, jurosEmbutidos: "50.00", multa: "2.00", mora: "3.60", totalExigido: "55.60",
  principalAntes: "500.00", principalDepois: "500.00", principalPago: "0.00", novoJuros: "50.00", novoTotal: "550.00", novoVencimento: "2026-12-10", vencimento: "2026-11-10",
  dataPagamento: "2026-11-10", expiraEm: "2026-11-11T00:00:00-03:00", estadoHash: "a".repeat(64), cotacaoHash: "b".repeat(64), regra: "renovacao_juros_mensal_brt_v1",
};
const confirmed: ResultadoRenovacaoProspectiva = {
  success: true, repetida: false, operationId: uuidB, contratoId: 1, parcelaId: 2, sucessoraId: 4, transacaoCaixaId: "5", contaCaixaId: 3,
  valorRecebido: "55.60", totalExigido: "55.60", jurosPagos: "50.00", multaPaga: "2.00", moraPaga: "3.60", principalPago: "0.00", principalAntes: "500.00", principalDepois: "500.00",
  status: "renovada", contratoStatus: "ativo", novoTotal: "550.00", novoJuros: "50.00", novoVencimento: "2026-12-10", dataPagamento: "2026-11-10", estadoHash: quote.estadoHash, cotacaoHash: quote.cotacaoHash, regra: quote.regra,
};
const intent = () => renovacaoProspectivaNovaIntencao(quote, uuid);
const props = (extra = {}) => ({ contratoId: 1, parcelaId: 2, origemUserId: 901, onSuccess: h.success, ...extra });
const key = (id = h.user?.id ?? 901, contrato = 1, parcela = 2) => `cobrapro:renovacao:v1:${id}:${contrato}:${parcela}`;
const origem = (extra = {}) => ({ userId: 901, contratoId: 1, parcelaId: 2, trilho: "prospectivo", status: "pendente", ...extra });
const result = (data: any, extra = {}) => ({ data, isError: false, isLoading: false, isFetching: false, refetch: h.refetch, ...extra });
let instances: MemoryUI[], data: Map<string, string>, storage: any, network: any;
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-10T12:00:00-03:00")); vi.stubGlobal("React", React);
  instances = []; h.user = { id: 901 }; h.authExtra = {}; h.origem = result(origem());
  data = new Map(); storage = { getItem: vi.fn((k: string) => data.get(k) ?? null), setItem: vi.fn((k: string, v: string) => data.set(k, v)), removeItem: vi.fn((k: string) => data.delete(k)) };
  vi.stubGlobal("sessionStorage", storage); vi.stubGlobal("window", { sessionStorage: storage, location: { search: "" } });
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => uuid) }); network = vi.fn(() => { throw new Error("Rede proibida neste harness"); }); vi.stubGlobal("fetch", network);
  h.disponibilidade.mockResolvedValue({ disponivel: true, limitacao: "primeira mensal" }); h.cotar.mockResolvedValue(quote); h.renovar.mockRejectedValue(new Error("timeout"));
  h.parcelas = [{ id: 2, contratoId: 1, clienteNome: "Cliente sintético", clienteWhatsapp: null, clienteChavePix: null, numeroParcela: 1, numeroParcelas: 1, valorOriginal: "550.00", valorPago: null, valorJuros: "50.00", valorMulta: "0.00", dataVencimento: "2026-11-10", dataPagamento: null, status: "pendente", modalidade: "mensal" }];
});
afterEach(() => {
  instances.forEach(r => r.unmount()); expect(network).not.toHaveBeenCalled(); expect(h.oldMutation).not.toHaveBeenCalled(); expect(storage.removeItem).not.toHaveBeenCalled();
  vi.useRealTimers(); vi.unstubAllGlobals();
});
const renewalUI = (extra = {}) => new MemoryUI(EmprestimoSeguroRenovar, props(extra)).render();
const gateUI = () => new MemoryUI(RecebimentoValidado, { contratoId: 1, parcelaId: 2, permitirRenovacao: true, onSuccess: h.success }).render();
const recoveryUI = () => renewalUI({ somenteConferencia: true });
function childUI(gate: MemoryUI) { const node = gate.nodes(EmprestimoSeguroRenovar)[0]; expect(node).toBeTruthy(); return new MemoryUI(node.type, node.props).render(); }
function noReceipt(gate: MemoryUI) { expect(gate.nodes("prospectivo-receber")).toHaveLength(0); expect(gate.nodes("legado-receber")).toHaveLength(0); expect(gate.nodes("select")).toHaveLength(0); }
function noRPC() { expect(h.disponibilidade).not.toHaveBeenCalled(); expect(h.cotar).not.toHaveBeenCalled(); expect(h.renovar).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled(); }

 describe("entrada da listagem e origem autenticada", () => {
  it.each(["pendente", "parcial", "paga", "pago", "renovada", "cancelada", "cancelado"])("Parcelas %s passa permitirRenovacao sem montar diálogo legado de pagamento", async status => {
    h.parcelas[0].status = status; const page = new MemoryUI(Parcelas, {}).render(); const node = page.nodes(RecebimentoValidado)[0];
    expect(node.props).toMatchObject({ contratoId: 1, parcelaId: 2, permitirRenovacao: true });
    expect(page.nodes().some(n => typeof n.type === "function" && n.type.name === "PagamentoDialog")).toBe(false);
    h.origem = result(origem({ status })); const gate = new MemoryUI(node.type, node.props).render(); await gate.click("Receber / conferir");
    if (status === "renovada") { noReceipt(gate); expect(gate.nodes(EmprestimoSeguroRenovar)[0].props.somenteConferencia).toBe(true); }
    if (["paga", "pago", "cancelada", "cancelado"].includes(status)) { noReceipt(gate); expect(gate.nodes(EmprestimoSeguroRenovar)).toHaveLength(0); }
    noRPC();
  });
  it("gate passa owner comprovado; permitirRenovacao false não habilita entrada", async () => {
    const gate = gateUI(); expect(gate.nodes(EmprestimoSeguroRenovar)).toHaveLength(0);
    expect(h.origemQuery.mock.lastCall).toEqual([{ contratoId: 1, parcelaId: 2, escopoUserId: 901 }, { enabled: false, retry: false, staleTime: 0 }]);
    await gate.click("Receber / conferir"); expect(h.origemQuery.mock.lastCall[1].enabled).toBe(true);
    expect(gate.nodes(EmprestimoSeguroRenovar)[0].props).toMatchObject({ origemUserId: 901, somenteConferencia: false });
    gate.props.permitirRenovacao = false; gate.render(); expect(gate.nodes(EmprestimoSeguroRenovar)).toHaveLength(0); noRPC();
  });
  it.each(["pendente", "paga", "renovada", "cancelada"])("permitirRenovacao=true não libera renovação legada %s", async status => {
    h.origem = result(origem({ trilho: "legado", status })); const gate = gateUI(); await gate.click("Receber / conferir");
    expect(gate.nodes(EmprestimoSeguroRenovar)).toHaveLength(0); noRPC();
  });
  it.each([{ userId: 902 }, { contratoId: 9 }, { parcelaId: 9 }])("origem divergente %j não monta caminhos financeiros", async extra => {
    h.origem = result(origem({ status: "renovada", ...extra })); const gate = gateUI(); await gate.click("Receber / conferir"); noReceipt(gate); expect(gate.nodes(EmprestimoSeguroRenovar)).toHaveLength(0); noRPC();
  });
  it.each(["isError", "isLoading", "isFetching", "missing"])("origem %s não exibe intenção de cache", async mode => {
    data.set(key(), JSON.stringify(intent())); h.origem = mode === "missing" ? result(undefined) : result(origem({ status: "renovada" }), { [mode]: true });
    const gate = gateUI(); await gate.click("Receber / conferir"); noReceipt(gate); expect(gate.nodes(EmprestimoSeguroRenovar)).toHaveLength(0); expect(storage.getItem).not.toHaveBeenCalled(); noRPC();
  });
  it("troca A→B→A fecha diálogo, invalida callback e não reutiliza a conta anterior", async () => {
    h.origem = result(origem({ trilho: "legado" })); const gate = gateUI(); await gate.click("Receber / conferir");
    gate.nodes("select")[0].props.onChange({ target: { value: "3" } }); gate.render(); const callback = gate.nodes("legado-receber")[0].props.onSuccess;
    h.user = { id: 902 }; gate.render(); noReceipt(gate); expect(gate.nodes(EmprestimoSeguroRenovar)).toHaveLength(0);
    h.user = { id: 901 }; gate.render(); callback(); noReceipt(gate); expect(h.success).not.toHaveBeenCalled(); expect(h.refetch).not.toHaveBeenCalled();
    await gate.click("Receber / conferir"); expect(gate.nodes("select")[0].props.value).toBe(""); expect(gate.nodes("legado-receber")).toHaveLength(0);
  });
});

describe("primeira renovação mensal elegível", () => {
  it("disponibilidade e cotação existentes são obrigatórias; só envia soma exata, sem principal", async () => {
    const gate = gateUI(); await gate.click("Receber / conferir"); const r = childUI(gate); await r.click("Renovar / conferir");
    expect(h.disponibilidade).toHaveBeenCalledOnce(); expect(h.cotar).toHaveBeenCalledWith({ contratoId: 1, parcelaId: 2 }); expect(crypto.randomUUID).not.toHaveBeenCalled();
    expect(r.text()).toContain("R$ 0,00"); expect(r.nodes("input")).toHaveLength(0);
    h.renovar.mockImplementation(async p => { expect(JSON.parse(data.get(key())!).payload).toEqual(p); throw Error("timeout"); });
    await r.click("Confirmar juros + encargos recebidos e renovar"); expect(h.renovar).toHaveBeenCalledWith(intent().payload); expect(Object.keys(h.renovar.mock.calls[0][0]).sort()).toEqual(Object.keys(intent().payload).sort());
    expect(r.text()).toContain("Não há reset automático"); expect(crypto.randomUUID).toHaveBeenCalledOnce();
  });
  it.each(["indisponivel", "cotacao-rejeitada", "outra-parcela", "principal-pago"])("gate servidor/cotação %s falha fechado", async mode => {
    if (mode === "indisponivel") h.disponibilidade.mockResolvedValue({ disponivel: false, limitacao: "flags" });
    if (mode === "cotacao-rejeitada") h.cotar.mockRejectedValue(Error("não elegível"));
    if (mode === "outra-parcela") h.cotar.mockResolvedValue({ ...quote, parcelaId: 9 });
    if (mode === "principal-pago") h.cotar.mockResolvedValue({ ...quote, principalPago: "500.00" });
    const r = renewalUI(); await r.click("Renovar / conferir"); expect(r.button("Confirmar juros").props.disabled).toBe(true); expect(h.renovar).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled(); expect(data.size).toBe(0);
  });
  it("cotação expirada não cria UUID nem envia", async () => {
    const r = renewalUI(); await r.click("Renovar / conferir"); await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000); await r.flush();
    expect(r.text()).toContain("Cotação expirou"); const send = r.button("Confirmar juros").props.onClick; await send(); await r.flush(); expect(h.renovar).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled();
  });
  it("storage setItem indisponível bloqueia antes do POST, sem reset ou nova chave em retry", async () => {
    const r = renewalUI(); await r.click("Renovar / conferir"); storage.setItem.mockImplementation(() => { throw Error("quota exceeded"); });
    const send = r.button("Confirmar juros").props.onClick; await send(); await r.flush(); await send(); await r.flush();
    expect(h.renovar).not.toHaveBeenCalled(); expect(crypto.randomUUID).toHaveBeenCalledOnce(); expect(r.text()).toContain("quota exceeded"); expect(r.button("Confirmar juros").props.disabled).toBe(true);
  });
  it("cache preenchido em segunda montagem vence cotação já aberta e envia SOMENTE UUID preservado", async () => {
    const r = renewalUI(); await r.click("Renovar / conferir"); const p = intent(); p.payload.idempotencyKey = uuidB; data.set(key(), JSON.stringify(p));
    await r.click("Confirmar juros"); expect(h.renovar).toHaveBeenCalledWith(p.payload); expect(crypto.randomUUID).not.toHaveBeenCalled(); expect(r.text()).toContain(uuidB);
  });
});

describe("parcela renovada — consulta/replay da mesma intenção", () => {
  it("timeout seguido de refresh/commit monta só conferência, sem recotar e sem cobrar principal", async () => {
    const gate = gateUI(); await gate.click("Receber / conferir"); let r = childUI(gate); await r.click("Renovar / conferir"); await r.click("Confirmar juros");
    const saved = data.get(key()); r.unmount(); h.origem = result(origem({ status: "renovada" })); gate.render(); noReceipt(gate);
    r = childUI(gate); await r.click("Conferir renovação preservada"); expect(r.text()).toContain(uuid); expect(r.nodes("dl")).toHaveLength(0); expect(r.nodes("input")).toHaveLength(0);
    h.renovar.mockResolvedValue({ ...confirmed, repetida: true }); await r.click("Conferir/repetir intenção preservada");
    expect(h.renovar.mock.calls.map(c => c[0])).toEqual([intent().payload, intent().payload]); expect(h.disponibilidade).toHaveBeenCalledOnce(); expect(h.cotar).toHaveBeenCalledOnce(); expect(crypto.randomUUID).toHaveBeenCalledOnce();
    expect(JSON.parse(saved!).payload).toEqual(JSON.parse(data.get(key())!).payload); expect(h.success).toHaveBeenCalledOnce(); expect(h.refetch).toHaveBeenCalledOnce();
  });
  it("confirmação persistida antes do callback e reabertura após commit repete mesmo payload", async () => {
    h.renovar.mockResolvedValue(confirmed); h.success.mockImplementation(() => expect(JSON.parse(data.get(key())!).confirmacao).toEqual(confirmed));
    let r = renewalUI(); await r.click("Renovar / conferir"); await r.click("Confirmar juros"); r.unmount(); r = recoveryUI();
    expect(r.text()).toContain("Renovação confirmada"); await r.click("Conferir renovação preservada"); await r.click("Conferir/repetir intenção preservada");
    expect(h.renovar.mock.calls.map(c => c[0])).toEqual([intent().payload, intent().payload]); expect(h.cotar).toHaveBeenCalledOnce(); expect(crypto.randomUUID).toHaveBeenCalledOnce();
  });
  it("transição para renovada sem intenção bloqueia handlers antigos de cotação e criação", async () => {
    const r = renewalUI(); await r.click("Renovar / conferir"); const send = r.button("Confirmar juros").props.onClick; const consult = r.button("Atualizar cotação").props.onClick;
    r.props.somenteConferencia = true; r.render(); await send(); await consult(); await r.flush();
    expect(r.nodes("button")).toHaveLength(0); expect(r.nodes("dl")).toHaveLength(0); expect(h.renovar).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled();
    expect(h.disponibilidade).toHaveBeenCalledOnce(); expect(h.cotar).toHaveBeenCalledOnce(); expect(data.size).toBe(0);
  });
  it("cache removido após timeout bloqueia replay sem gerar operação substituta", async () => {
    data.set(key(), JSON.stringify(intent())); const r = recoveryUI(); data.delete(key()); await r.click("Conferir/repetir intenção preservada");
    expect(r.text()).toContain("Intenção/cache mudou"); noRPC(); expect(storage.setItem).not.toHaveBeenCalled(); expect(data.size).toBe(0);
  });
  it("intenção antiga expirada faz leitura sem RPC até replay explícito; nenhuma disponibilidade/cotação", async () => {
    data.set(key(), JSON.stringify(intent())); vi.setSystemTime(new Date("2026-11-20T12:00:00-03:00")); const r = recoveryUI(); noRPC();
    await r.click("Conferir renovação preservada"); noRPC(); expect(r.text()).toContain("mesmo após expiração"); await r.click("Conferir/repetir intenção preservada");
    expect(h.renovar).toHaveBeenCalledWith(intent().payload); expect(h.cotar).not.toHaveBeenCalled(); expect(h.disponibilidade).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled();
  });
  it.each(["ausente", "storage", "corrompida", "outro-contrato", "outra-parcela", "confirmacao-divergente"])("renovada com intenção %s permanece consulta sem ação financeira", async mode => {
    if (mode === "storage") storage.getItem.mockImplementation(() => { throw Error("storage bloqueado"); });
    if (mode === "corrompida") data.set(key(), "{");
    if (mode === "outro-contrato" || mode === "outra-parcela") data.set(key(), JSON.stringify({ ...intent(), payload: { ...intent().payload, [mode === "outro-contrato" ? "contratoId" : "parcelaId"]: 9 } }));
    if (mode === "confirmacao-divergente") data.set(key(), JSON.stringify({ ...intent(), confirmacao: { ...confirmed, parcelaId: 9 } }));
    h.origem = result(origem({ status: "renovada" })); const gate = gateUI(); await gate.click("Receber / conferir"); noReceipt(gate); const r = childUI(gate);
    expect(r.text()).toContain("Somente consulta ao histórico"); expect(r.nodes("button")).toHaveLength(0); expect(r.text()).not.toContain(uuid); noRPC(); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("mudança de cache após load bloqueia retry e não sobrescreve intenção de outra montagem", async () => {
    data.set(key(), JSON.stringify(intent())); const r = recoveryUI(); const next = intent(); next.payload.idempotencyKey = uuidB; const saved = JSON.stringify(next); data.set(key(), saved);
    await r.click("Conferir/repetir intenção preservada"); expect(r.text()).toContain("Intenção/cache mudou"); noRPC(); expect(data.get(key())).toBe(saved); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("falha de persistência da confirmação mantém payload original para replay", async () => {
    data.set(key(), JSON.stringify(intent())); const saved = data.get(key()); const r = recoveryUI(); h.renovar.mockResolvedValue(confirmed); storage.setItem.mockImplementationOnce(() => { throw Error("quota confirmação"); });
    await r.click("Conferir/repetir intenção preservada"); expect(data.get(key())).toBe(saved); expect(h.success).not.toHaveBeenCalled(); await r.click("Conferir/repetir intenção preservada");
    expect(h.renovar.mock.calls.map(c => c[0])).toEqual([intent().payload, intent().payload]); expect(h.success).toHaveBeenCalledOnce(); expect(h.cotar).not.toHaveBeenCalled();
  });
  it("resposta divergente não confirma nem modifica intenção", async () => {
    data.set(key(), JSON.stringify(intent())); const saved = data.get(key()); h.renovar.mockResolvedValue({ ...confirmed, cotacaoHash: "c".repeat(64) }); const r = recoveryUI();
    await r.click("Conferir/repetir intenção preservada"); expect(r.text()).toContain("Confirmação divergiu"); expect(data.get(key())).toBe(saved); expect(h.success).not.toHaveBeenCalled();
  });
  it("duplo clique usa só um POST em voo e conserva a intenção após timeout", async () => {
    data.set(key(), JSON.stringify(intent())); const d = deferred<any>(); h.renovar.mockReturnValueOnce(d.promise); const r = recoveryUI(); const send = r.button("Conferir/repetir").props.onClick;
    const a = send(), b = send(); expect(h.renovar).toHaveBeenCalledOnce(); d.reject(Error("timeout")); await Promise.all([a, b]); await r.flush(); expect(JSON.parse(data.get(key())!)).toEqual(intent()); expect(crypto.randomUUID).not.toHaveBeenCalled();
  });
});

describe("owner, sessão, IDs, lifecycle e cache isolados", () => {
  it.each(["sem-origem", "outro-owner", "logout", "isError", "isLoading", "isFetching"])("%s não lê nem mostra intenção da sessão anterior", async mode => {
    data.set(key(), JSON.stringify(intent())); const p = props({ somenteConferencia: true });
    if (mode === "sem-origem") p.origemUserId = undefined as any;
    if (mode === "outro-owner") p.origemUserId = 902;
    if (mode === "logout") h.user = null;
    if (mode.startsWith("is")) h.authExtra = { [mode]: true };
    const r = new MemoryUI(EmprestimoSeguroRenovar, p).render(); expect(r.text()).not.toContain(uuid); expect(r.nodes("button")).toHaveLength(0); expect(storage.getItem).not.toHaveBeenCalled(); noRPC();
  });
  it("troca de empresa/sessão não mostra payload anterior nem deixa handler antigo agir", async () => {
    data.set(key(), JSON.stringify(intent())); const r = recoveryUI(); const sendA = r.button("Conferir/repetir").props.onClick; const frame = r.frames.length;
    h.user = { id: 902 }; r.render(); expect(r.frames.slice(frame).every(s => !s.includes(uuid))).toBe(true); await sendA(); noRPC();
    r.props.origemUserId = 902; r.render(); expect(r.nodes("button")).toHaveLength(0); expect(r.text()).toContain("Sem intenção"); await sendA(); noRPC();
    h.user = { id: 901 }; r.props.origemUserId = 901; r.render(); await sendA(); noRPC(); expect(r.text()).toContain(uuid);
  });
  it.each(["sessao", "contrato", "parcela", "modo"])("resposta de cotação A→B→A por %s não volta para nova tela", async kind => {
    const d = deferred<any>(); h.cotar.mockReturnValueOnce(d.promise); const r = renewalUI(); await r.click("Renovar / conferir");
    const original = { ...r.props }; if (kind === "sessao") h.user = { id: 902 }; else r.props[kind === "contrato" ? "contratoId" : kind === "parcela" ? "parcelaId" : "somenteConferencia"] = kind === "modo" ? true : 9; r.render();
    h.user = { id: 901 }; r.props = original; r.render(); const writes = r.writes; d.resolve(quote); await r.flush();
    expect(r.writes).toBe(writes); expect(r.nodes("dl")).toHaveLength(0); expect(data.size).toBe(0); expect(h.success).not.toHaveBeenCalled();
  });
  it.each(["sessao", "contrato", "parcela", "modo"])("POST tardio A→B→A por %s não confirma/cache/callback nova tela", async kind => {
    data.set(key(), JSON.stringify(intent())); const saved = data.get(key()); const d = deferred<any>(); h.renovar.mockReturnValueOnce(d.promise); const r = recoveryUI(); const sending = r.click("Conferir/repetir"); await r.flush();
    const original = { ...r.props }; if (kind === "sessao") h.user = { id: 902 }; else r.props[kind === "contrato" ? "contratoId" : kind === "parcela" ? "parcelaId" : "somenteConferencia"] = kind === "modo" ? false : 9; r.render();
    h.user = { id: 901 }; r.props = original; r.render(); const writes = r.writes; d.resolve(confirmed); await sending; await r.flush();
    expect(r.writes).toBe(writes); expect(data.get(key())).toBe(saved); expect(h.success).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it.each(["resolve", "reject"])("POST após unmount (%s) não escreve estado nem confirmação", async mode => {
    data.set(key(), JSON.stringify(intent())); const saved = data.get(key()); const d = deferred<any>(); h.renovar.mockReturnValueOnce(d.promise); const r = recoveryUI(); const sending = r.click("Conferir/repetir"); await r.flush(); r.unmount(); const writes = r.writes;
    mode === "resolve" ? d.resolve(confirmed) : d.reject(Error("erro tardio")); await sending; expect(r.writes).toBe(writes); expect(data.get(key())).toBe(saved); expect(h.success).not.toHaveBeenCalled();
  });
});
