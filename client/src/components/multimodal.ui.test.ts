import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";

const h = vi.hoisted(() => ({
  current: null as any, user: { id: 901 } as any, auth: {} as any, search: "", queries: {} as Record<string, any>,
  invalidar: vi.fn(), validar: vi.fn(), criar: vi.fn(), receber: vi.fn(), renovar: vi.fn(), rec: vi.fn(),
  cotar: vi.fn(), cotarRenovacao: vi.fn(), query: vi.fn(), clientes: vi.fn(), contas: vi.fn(), saldo: vi.fn(),
  success: vi.fn(), error: vi.fn(), location: vi.fn(), oldMutation: vi.fn(),
}));
vi.mock("react", async original => {
  const actual = await original<typeof React>();
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
vi.mock("@/components/ui/card", () => ({ Card: "article", CardContent: "div", CardHeader: "header", CardTitle: "h2" }));
vi.mock("@/components/ui/badge", () => ({ Badge: "span" }));
vi.mock("@/components/ui/select", () => ({ Select: "select", SelectContent: "div", SelectItem: "option", SelectTrigger: "div", SelectValue: "span" }));
vi.mock("@/components/ui/popover", () => ({ Popover: "div", PopoverContent: "div", PopoverTrigger: "div" }));
vi.mock("@/components/ui/command", () => ({ Command: "div", CommandEmpty: "div", CommandGroup: "div", CommandInput: "input", CommandItem: "div", CommandList: "div" }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }));
vi.mock("sonner", () => ({ toast: { success: h.success, error: h.error } }));
vi.mock("wouter", () => ({ useLocation: () => ["/contratos/novo", h.location] }));
vi.mock("./EmprestimoSeguroCriar", () => ({ EmprestimoSeguroCriar: "cadastro-mensal-anterior" }));
vi.mock("@trpc/client", () => ({ httpBatchLink: () => ({}), createTRPCProxyClient: () => ({
  emprestimosProspectivos: {}, emprestimosMultimodal: {
    validarCriacao: { mutate: h.validar }, criar: { mutate: h.criar }, receber: { mutate: h.receber }, renovar: { mutate: h.renovar },
    reconciliar: { mutate: h.rec }, cotar: { query: h.cotar }, cotarRenovacao: { query: h.cotarRenovacao },
  },
}) }));
vi.mock("@/lib/trpc", () => {
  const utils = new Proxy({}, { get: () => new Proxy({}, { get: () => ({ invalidate: h.invalidar }) }) });
  const q = (data: any, extra = {}) => ({ data, isError: false, isLoading: false, isFetching: false, refetch: vi.fn().mockResolvedValue({ data, isError: false }), ...extra });
  return { trpc: {
    auth: { me: { useQuery: () => q(h.user, h.auth) } },
    clientes: { list: { useQuery: (input: any, options: any) => { h.clientes(input, options); return h.queries.clientes ?? q({ clientes: [{ id: 1, nome: "Cliente próprio", userId: h.user?.id }] }); } } },
    caixa: { contas: { useQuery: () => { h.saldo(); return q([]); } } },
    emprestimosMultimodal: {
      disponibilidade: { useQuery: () => h.queries.capacidade ?? q({ disponivel: true, regra: "multimodal_v1", modalidades: ["mensal", "semanal", "quinzenal", "diario", "tabela_price"], recebimento: true, renovacao: true }) },
      contasParaCadastro: { useQuery: (input: any, options: any) => { h.contas(input, options); return h.queries.contas ?? q({ empresaId: h.user?.id, contas: [{ id: 3, nome: "Conta própria" }] }); } },
      cotar: { useQuery: (input: any, options: any) => { h.query("receber", input, options); return h.queries.cotar ?? q(receiptQuote, { refetch: async () => ({ data: await h.cotar(input), isError: false }) }); } },
      cotarRenovacao: { useQuery: (input: any, options: any) => { h.query("renovar", input, options); return h.queries.renovar ?? q({ ...renewalQuote, novoVencimento: input.novoVencimento }, { refetch: async () => ({ data: await h.cotarRenovacao(input), isError: false }) }); } },
    },
    contratos: { create: { useMutation: () => ({ mutate: h.oldMutation }) } },
    useUtils: () => utils,
  } };
});
import { EmprestimoMultimodalCriar } from "./EmprestimoMultimodalCriar";
import { EmprestimoMultimodalReceber, EmprestimoMultimodalRenovar } from "./EmprestimoMultimodalOperacoes";
import { chaveMultimodal, useIntencaoMultimodal } from "./EmprestimoMultimodalRpc";
import NovoContrato from "../pages/NovoContrato";
import { calcularMultimodal, validarCriacaoMultimodal, type ModalidadeMultimodal } from "../../../server/services/emprestimosMultimodalRpc";

// Elementos e handlers React reais; hooks determinísticos executam effects/cleanups,
// sem DOM ou bibliotecas adicionais. Só as fronteiras de leitura/RPC são mockadas.
class MemoryUI {
  values: any[] = []; deps: any[] = []; cleanups: any[] = []; effects: any[] = [];
  cursor = 0; dirty = true; tree: any; writes = 0; mounted = true; frames: string[] = [];
  constructor(private component: any, public props: any) { instances.push(this); }
  render() { let n = 0; do { this.dirty = false; this.cursor = 0; h.current = this; this.tree = this.component(this.props); this.frames.push(this.text()); this.effects.splice(0).forEach(f => f()); if (++n > 30) throw Error("Loop de render"); } while (this.dirty); return this; }
  async flush() { for (let i = 0; i < 40; i++) { await Promise.resolve(); if (this.dirty && this.mounted) this.render(); } return this; }
  unmount() { if (!this.mounted) return; this.cleanups.forEach(f => f?.()); this.mounted = false; this.dirty = false; }
  nodes(type?: any) { const list: any[] = []; const walk = (n: any) => { if (!n) return; if (Array.isArray(n)) return n.forEach(walk); if (typeof n !== "object") return; if (!type || n.type === type) list.push(n); walk(n.props?.children); }; walk(this.tree); return list; }
  text(n: any = this.tree): string { const walk = (v: any): string => v == null || typeof v === "boolean" ? "" : Array.isArray(v) ? v.map(walk).join(" ") : typeof v === "object" ? walk(v.props?.children) : String(v); return walk(n).replace(/\s+/g, " "); }
  button(fragment: string) { const n = this.nodes("button").find(n => this.text(n).includes(fragment)); if (!n) throw Error(`Botão ausente: ${fragment}\n${this.text()}`); return n; }
  async click(fragment: string) { const n = this.button(fragment); if (n.props.disabled) throw Error(`Botão desabilitado: ${fragment}`); const p = n.props.onClick({ stopPropagation() {} }); if (this.mounted) this.render(); await this.flush(); await p; if (this.mounted) this.render(); await this.flush(); }
  change(n: any, value: string) { n.props.onChange({ target: { value } }); this.render(); }
}
const uuid = "11111111-1111-4111-8111-111111111111", uuidB = "22222222-2222-4222-8222-222222222222";
const receiptQuote = { elegivel: true, contratoId: 1, parcelaId: 2, contaCaixaId: 3, totalExigido: "550.00", multa: "0.00", mora: "0.00", jurosEmbutidos: "50.00", valorPagoAcumulado: "0.00", dataPagamento: "2026-11-10", vencimento: "2026-12-10", status: "pendente", estadoHash: "a".repeat(64), regra: "recebimento_multimodal_brt_v1" };
const renewalQuote = { renovavel: true, contratoId: 1, parcelaId: 2, contaCaixaId: 3, totalExigido: "55.60", juros: "50.00", multa: "2.00", mora: "3.60", principalPreservado: "500.00", dataPagamento: "2026-11-10", novoVencimento: "2026-12-10", estadoHash: "a".repeat(64), regra: "renovacao_multimodal_brt_v1" };
const body = (extra = {}) => ({ idempotencyKey: uuid, clienteId: 1, contaCaixaId: 3, modalidade: "mensal", tipoTaxa: "mensal", valorPrincipal: "500.00", taxaJuros: "10.00", numeroParcelas: 1, dataInicio: "2026-11-10", dataDesembolso: "2026-11-10", vencimentos: ["2026-12-10"], multaAtraso: "2.0000", jurosMoraDiario: "0.0330", ...extra });
const receipt = (extra = {}) => ({ idempotencyKey: uuid, contratoId: 1, parcelaId: 2, valorRecebido: "550.00", totalExigido: "550.00", dataPagamento: "2026-11-10", estadoHash: receiptQuote.estadoHash, modo: "integral", ...extra });
const renewal = (extra = {}) => ({ idempotencyKey: uuid, contratoId: 1, parcelaId: 2, novoVencimento: "2026-12-10", valorRecebido: "55.60", totalExigido: "55.60", dataPagamento: "2026-11-10", estadoHash: renewalQuote.estadoHash, ...extra });
const created = (p: any = body()) => { const v = validarCriacaoMultimodal(901, p), c = v.calculo; return { success: true, repetida: false, id: 31, operationId: uuidB, parcelasIds: p.vencimentos.map((_: any, i: number) => i + 2), transacaoCaixaId: "5", valorParcela: c.valorParcela, totalContrato: c.totalContrato, jurosTotal: c.jurosTotal, numeroParcelas: p.numeroParcelas, dataDesembolso: p.dataDesembolso, vencimentos: p.vencimentos, status: "ativo", regra: "multimodal_v1", modalidade: p.modalidade, tipoTaxa: p.tipoTaxa, multaAtraso: v.multaAtraso, jurosMoraDiario: v.jurosMoraDiario }; };
const received = (p: any = receipt()) => ({ success: true, repetida: false, operationId: uuidB, contratoId: p.contratoId, parcelaId: p.parcelaId, transacaoCaixaId: "5", contaCaixaId: 3, valorRecebido: p.valorRecebido, totalExigido: p.totalExigido, saldoResidual: p.modo === "integral" ? "0.00" : "450.00", valorPagoAcumulado: p.valorRecebido, status: p.modo === "integral" ? "paga" : "parcial", contratoStatus: "ativo", dataPagamento: p.dataPagamento, regra: "recebimento_multimodal_brt_v1" });
const renewed = (p: any = renewal()) => ({ success: true, repetida: false, operationId: uuidB, contratoId: p.contratoId, parcelaId: p.parcelaId, novaParcelaId: 4, transacaoCaixaId: "5", contaCaixaId: 3, valorRecebido: p.valorRecebido, dataPagamento: p.dataPagamento, novoVencimento: p.novoVencimento, contratoStatus: "ativo", status: "renovada", regra: "renovacao_multimodal_brt_v1" });
const props = (extra = {}) => ({ contratoId: 1, parcelaId: 2, origemUserId: 901, status: "pendente", onSuccess: h.success, ...extra });
const query = (data: any, extra = {}) => ({ data, isError: false, isLoading: false, isFetching: false, refetch: vi.fn().mockResolvedValue({ data, isError: false }), ...extra });
const key = (acao: "criar" | "receber" | "renovar", userId = 901, contratoId = 1, parcelaId = 2) => chaveMultimodal(userId, acao, acao === "criar" ? undefined : contratoId, acao === "criar" ? undefined : parcelaId);
const proof = (r: any, extra = {}) => ({ ...r, userId: 901, payloadHash: "b".repeat(64), proof: "uuid_fenced_v1", status: "not_executed", fenceId: uuidB, result: null, quote: null, ...extra });
function deferred<T>() { let resolve!: (v: T) => void, reject!: (e: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
let instances: MemoryUI[], data: Map<string, string>, storage: any, network: any;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("React", React); instances = []; h.user = { id: 901 }; h.auth = {}; h.search = ""; h.queries = {};
  data = new Map(); storage = { getItem: vi.fn((k: string) => data.get(k) ?? null), setItem: vi.fn((k: string, v: string) => data.set(k, v)), removeItem: vi.fn((k: string) => data.delete(k)) };
  vi.stubGlobal("sessionStorage", storage); vi.stubGlobal("window", { sessionStorage: storage, location: { get search() { return h.search; } } });
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => uuid) }); network = vi.fn(() => { throw Error("Rede proibida neste alvo"); }); vi.stubGlobal("fetch", network);
  h.invalidar.mockResolvedValue(undefined); h.validar.mockImplementation(async p => ({ validada: true, calculo: validarCriacaoMultimodal(h.user.id, p).calculo }));
  h.criar.mockRejectedValue(Error("timeout")); h.receber.mockRejectedValue(Error("timeout")); h.renovar.mockRejectedValue(Error("timeout")); h.rec.mockImplementation(async r => proof(r));
  h.cotar.mockResolvedValue(receiptQuote); h.cotarRenovacao.mockImplementation(async p => ({ ...renewalQuote, novoVencimento: p.novoVencimento }));
});
afterEach(() => { instances.forEach(r => r.unmount()); expect(network).not.toHaveBeenCalled(); expect(h.oldMutation).not.toHaveBeenCalled(); expect(h.saldo).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
const createUI = async () => { const r = new MemoryUI(EmprestimoMultimodalCriar, { onSuccess: h.success }).render(); return r.flush(); };
const receiveUI = async (extra = {}) => new MemoryUI(EmprestimoMultimodalReceber, props(extra)).render().flush();
const renewUI = async (extra = {}) => new MemoryUI(EmprestimoMultimodalRenovar, props(extra)).render().flush();
function fill(r: MemoryUI, modalidade: ModalidadeMultimodal = "mensal", extra = {}) {
  const f = { principal: "500.00", taxa: "10.00", n: "3", inicio: "2026-11-10", primeira: "2027-01-31", ...extra };
  r.change(r.nodes("select")[0], modalidade); r.change(r.nodes("select")[1], "1"); r.change(r.nodes("select")[2], "3");
  [f.principal, f.taxa, f.n, f.inicio, f.primeira].forEach((v, i) => r.change(r.nodes("input")[i], v));
}
function save(acao: "criar" | "receber" | "renovar", p: any, confirmacao?: any) { data.set(key(acao), JSON.stringify({ versao: 1, payload: p, ...(confirmacao === undefined ? {} : { confirmacao }) })); }

describe("modalidades e root real — sem fallback venda/cheque ou importação silenciosa", () => {
  it.each([
    ["mensal", ["2027-01-31", "2027-02-28", "2027-03-31"], "150.00"],
    ["semanal", ["2027-01-31", "2027-02-07", "2027-02-14"], "150.00"],
    ["quinzenal", ["2027-01-31", "2027-02-15", "2027-03-02"], "150.00"],
    ["diario", ["2027-01-31", "2027-02-01", "2027-02-02"], "50.00"],
    ["tabela_price", ["2027-01-31", "2027-02-28", "2027-03-31"], null],
  ] as const)("%s usa agenda e juros reais antes de salvar/POST", async (modalidade, datas, juros) => {
    const r = await createUI(); fill(r, modalidade); expect(r.text()).toContain(datas.join(", "));
    await r.click("Confirmar cadastro"); const p = h.criar.mock.calls[0][0]; expect(p.vencimentos).toEqual(datas); expect(p.modalidade).toBe(modalidade);
    const c = calcularMultimodal(p.valorPrincipal, p.taxaJuros, p.numeroParcelas, modalidade); if (juros) expect(c.jurosTotal).toBe(juros);
    else { expect(c.parcelas[0].valorJuros).toBe("50.00"); expect(Number(c.parcelas[1].valorJuros)).toBeLessThan(50); }
    expect(JSON.parse(data.get(key("criar"))!).payload).toEqual(p); expect(crypto.randomUUID).toHaveBeenCalledOnce();
  });
  it.each(["mensal", "semanal", "quinzenal", "diario", "tabela_price"])("root monta %s real com capacidades comprovadas", async modalidade => {
    h.search = `?modalidade=${modalidade}&valorPrincipal=900&clienteId=99`; const root = new MemoryUI(NovoContrato, {}).render(); const child = root.nodes(EmprestimoMultimodalCriar)[0];
    expect(child.props.modalidadeInicial).toBe(modalidade); const r = await new MemoryUI(child.type, child.props).render().flush(); expect(r.nodes("input")[0].props.value).toBe(""); expect(r.nodes("select")[1].props.value).toBe("");
    child.props.onSuccess(31); expect(h.location).toHaveBeenCalledWith("/emprestimos/31");
  });
  it.each(["venda", "cheque", "reparcelamento", "mensal&tipoTaxa=diaria"])("root não converte %s nem monta cadastro", modalidade => {
    h.search = `?modalidade=${modalidade}`; const r = new MemoryUI(NovoContrato, {}).render(); expect(r.nodes(EmprestimoMultimodalCriar)).toHaveLength(0); expect(r.nodes("cadastro-mensal-anterior")).toHaveLength(0); expect(r.text()).toContain("Não será convertido");
  });
  it.each(["isError", "isLoading", "desligada"])("capacidade %s não cria modalidade ampliada", mode => {
    h.search = "?modalidade=tabela_price"; h.queries.capacidade = query(mode === "isLoading" ? undefined : { disponivel: mode !== "desligada", modalidades: [] }, mode === "desligada" ? {} : { [mode]: true });
    const root = new MemoryUI(NovoContrato, {}).render(); expect(root.nodes(EmprestimoMultimodalCriar)).toHaveLength(0);
    expect(h.criar).not.toHaveBeenCalled();
  });
  it("capacidade loading com data herdada não libera POST pelo filho real", async () => {
    h.search = "?modalidade=tabela_price"; h.queries.capacidade = query({ disponivel: true, modalidades: ["tabela_price"] }, { isLoading: true });
    const root = new MemoryUI(NovoContrato, {}).render(), child = root.nodes(EmprestimoMultimodalCriar)[0];
    if (child) { const r = await new MemoryUI(child.type, child.props).render().flush(); expect(r.button("Confirmar cadastro").props.disabled).toBe(true); }
    expect(h.criar).not.toHaveBeenCalled();
  });
  it.each(["isError", "isLoading"])("root auth %s não monta cadastro com data antiga", flag => {
    h.auth = { [flag]: true }; const root = new MemoryUI(NovoContrato, {}).render(); expect(root.nodes(EmprestimoMultimodalCriar)).toHaveLength(0); expect(root.nodes("cadastro-mensal-anterior")).toHaveLength(0); expect(storage.getItem).not.toHaveBeenCalled();
  });
  it.each([{ principal: "0" }, { n: "61" }, { primeira: "2026-02-30" }, { primeira: "2026-11-01" }, { taxa: "1000" }])("entrada inválida %j não persiste nem envia", async extra => {
    const r = await createUI(); fill(r, "mensal", extra); await r.click("Confirmar cadastro"); expect(h.criar).not.toHaveBeenCalled(); expect(data.size).toBe(0); expect(r.nodes("input")).toHaveLength(7);
  });
});

describe("tenant, auth outage e cache de leitura", () => {
  it.each(["isError", "isLoading", "isFetching"])("auth.data em %s não libera storage, select, cotação ou POST", async flag => {
    h.auth = { [flag]: true }; save("criar", body()); save("receber", receipt()); save("renovar", renewal());
    const a = await createUI(), b = await receiveUI(), c = await renewUI(); expect([a.text(), b.text(), c.text()].join(" ")).not.toContain(uuid);
    expect(storage.getItem).not.toHaveBeenCalled(); expect(h.clientes.mock.calls.every(c => !c[1].enabled)).toBe(true); expect(h.contas.mock.calls.every(c => !c[1].enabled)).toBe(true);
    expect(h.query.mock.calls.every(c => !c[2].enabled)).toBe(true); expect(h.cotar).not.toHaveBeenCalled(); expect(h.cotarRenovacao).not.toHaveBeenCalled();
  });
  it("cache de cliente/conta de outra empresa e dados em erro/loading não viram seletores válidos", async () => {
    h.queries.clientes = query({ clientes: [{ id: 9, nome: "Cliente anterior", userId: 902 }] }); h.queries.contas = query({ empresaId: 902, contas: [{ id: 9, nome: "Conta anterior" }] });
    const r = await createUI(); expect(r.text()).not.toContain("anterior"); expect(r.button("Confirmar cadastro").props.disabled).toBe(true);
    h.queries.clientes = query({ clientes: [{ id: 1, nome: "Cache loading", userId: 901 }] }, { isLoading: true }); h.queries.contas = query({ empresaId: 901, contas: [{ id: 3, nome: "Cache erro" }] }, { isError: true }); r.render();
    expect(r.text()).not.toContain("Cache loading"); expect(r.text()).not.toContain("Cache erro"); expect(r.button("Confirmar cadastro").props.disabled).toBe(true);
  });
  it("cotação cache herdada não aparece nem permite envio antes de refetch próprio", async () => {
    const d = deferred<any>(); h.cotar.mockReturnValueOnce(d.promise); const r = await receiveUI(); expect(r.text()).not.toContain("Total exigido 550.00"); expect(r.button("Confirmar recebimento").props.disabled).toBe(true);
    d.resolve(receiptQuote); await r.flush(); expect(r.text()).toContain("Total exigido 550.00");
  });
  it.each(["isError", "isLoading", "isFetching"])("cotação de query %s com data velha não habilita", async flag => {
    h.queries.cotar = query(receiptQuote, { [flag]: true, refetch: vi.fn().mockResolvedValue({ data: receiptQuote, [flag]: true }) }); const r = await receiveUI(); expect(r.button("Confirmar recebimento").props.disabled).toBe(true); expect(r.text()).not.toContain("Total exigido 550.00");
  });
});

describe("intenção durável, timeout, reload, fence e storage", () => {
  it("timeout/reload repete exclusivamente UUID e payload original, confirma uma vez sem novo POST", async () => {
    let r = await createUI(); fill(r); await r.click("Confirmar cadastro"); const original = h.criar.mock.calls[0][0]; r.unmount(); r = await createUI(); h.criar.mockResolvedValue(created(original));
    await r.click("Conferir/repetir"); expect(h.criar.mock.calls.map(c => c[0])).toEqual([original, original]); expect(crypto.randomUUID).toHaveBeenCalledOnce(); expect(h.success).toHaveBeenCalled();
    r.unmount(); r = await createUI(); expect(r.text()).toContain("Confirmada"); expect(r.nodes("button").some(n => r.text(n).includes("Conferir/repetir"))).toBe(false); expect(h.criar).toHaveBeenCalledTimes(2);
  });
  it("duplo clique só envia uma vez em voo", async () => {
    save("receber", receipt()); const d = deferred<any>(); h.receber.mockReturnValueOnce(d.promise); const r = await receiveUI(); const send = r.button("Repetir a mesma").props.onClick; const a = send(), b = send(); await r.flush(); expect(h.receber).toHaveBeenCalledOnce(); d.reject(Error("timeout")); await Promise.all([a, b]);
  });
  it("falta de storage impede POST e não gera outra chave com handler antigo", async () => {
    const r = await createUI(); fill(r); storage.setItem.mockImplementation(() => { throw Error("quota"); }); const send = r.button("Confirmar cadastro").props.onClick;
    await send(); await r.flush(); await send(); await r.flush(); expect(h.criar).not.toHaveBeenCalled(); expect(crypto.randomUUID).toHaveBeenCalledOnce(); expect(r.button("Conferir/repetir").props.disabled).toBe(true);
  });
  it("storage surgido após render vence formulário e preserva UUID existente", async () => {
    const r = await createUI(); fill(r); const p = body({ idempotencyKey: uuidB }); save("criar", p); await r.click("Confirmar cadastro"); expect(h.criar).toHaveBeenCalledWith(p); expect(crypto.randomUUID).not.toHaveBeenCalled();
  });
  it.each(["removido", "outro-uuid", "payload-divergente", "confirmacao"])("storage %s após load bloqueia replay sem sobrescrever", async mode => {
    save("receber", receipt()); const r = await receiveUI(); if (mode === "removido") data.delete(key("receber")); else save("receber", receipt(mode === "outro-uuid" ? { idempotencyKey: uuidB } : mode === "payload-divergente" ? { totalExigido: "551.00" } : {}), mode === "confirmacao" ? received() : undefined);
    const saved = data.get(key("receber")); await r.click("Repetir a mesma"); expect(h.receber).not.toHaveBeenCalled(); expect(data.get(key("receber"))).toBe(saved); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("storage mudou durante POST: não sobrescreve confirmação de outra montagem", async () => {
    save("renovar", renewal()); const d = deferred<any>(); h.renovar.mockReturnValueOnce(d.promise); const r = await renewUI(); const p = r.click("Repetir a mesma"); await r.flush(); save("renovar", renewal({ idempotencyKey: uuidB })); const saved = data.get(key("renovar")); d.resolve(renewed()); await p;
    expect(data.get(key("renovar"))).toBe(saved); expect(h.success).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("falha só na persistência de confirmação mantém payload e admite replay mesmo UUID", async () => {
    save("renovar", renewal()); const r = await renewUI(); h.renovar.mockResolvedValue(renewed()); storage.setItem.mockImplementationOnce(() => { throw Error("quota confirmação"); }); await r.click("Repetir a mesma"); expect(h.success).not.toHaveBeenCalled(); expect(JSON.parse(data.get(key("renovar"))!).confirmacao).toBeUndefined();
    await r.click("Repetir a mesma"); expect(h.renovar.mock.calls.map(c => c[0])).toEqual([renewal(), renewal()]); expect(crypto.randomUUID).not.toHaveBeenCalled();
  });
  it("rejeição não libera correção; só fence e gesto explícito removem intenção", async () => {
    save("criar", body()); const r = await createUI(); await r.click("Conferir/repetir"); expect(r.text()).not.toContain("Corrigir após"); h.rec.mockRejectedValueOnce(Error("NOT_FOUND")); await r.click("Conferir intenção"); expect(r.text()).not.toContain("Corrigir após");
    await r.click("Conferir intenção"); expect(data.size).toBe(1); expect(r.button("Conferir/repetir").props.disabled).toBe(true); await r.click("Corrigir após"); expect(data.size).toBe(0); expect(r.nodes("input")[0].props.value).toBe("500.00"); expect(h.criar).toHaveBeenCalledOnce();
  });
  it("fence antigo não autoriza remover intenção substituída", async () => {
    save("criar", body()); const r = await createUI(); await r.click("Conferir intenção"); save("criar", body({ idempotencyKey: uuidB })); const saved = data.get(key("criar")); await r.click("Corrigir após"); expect(data.get(key("criar"))).toBe(saved); expect(storage.removeItem).not.toHaveBeenCalled();
  });
});

describe("confirmações e recovery malformados falham fechado", () => {
  it.each(["criar", "receber", "renovar"] as const)("storage %s com confirmação parcial não aceita nem libera clear", async acao => {
    save(acao, acao === "criar" ? body() : acao === "receber" ? receipt() : renewal(), acao === "criar" ? { id: 31 } : { success: true, contratoId: 1, parcelaId: 2 });
    const r = acao === "criar" ? await createUI() : acao === "receber" ? await receiveUI() : await renewUI(); expect(r.text()).not.toMatch(/Confirmada\.|Recebimento confirmado\.|Renovação confirmada\./); expect(h.success).not.toHaveBeenCalled(); expect(storage.removeItem).not.toHaveBeenCalled(); expect(data.size).toBe(1);
  });
  it.each(["criar", "receber", "renovar"] as const)("recovery %s confirmed malformado não muda storage/callback", async acao => {
    save(acao, acao === "criar" ? body() : acao === "receber" ? receipt() : renewal()); const saved = data.get(key(acao)); h.rec.mockImplementation(async r => proof(r, { status: "confirmed", fenceId: null, result: { success: true, id: 31, contratoId: 1, parcelaId: 2 } }));
    const ui = acao === "criar" ? await createUI() : acao === "receber" ? await receiveUI() : await renewUI(); await ui.click(acao === "criar" ? "Conferir intenção" : acao === "receber" ? "Conferir recebimento" : "Conferir renovação");
    expect(data.get(key(acao))).toBe(saved); expect(h.success).not.toHaveBeenCalled(); expect(ui.text()).not.toContain("confirmado."); expect(ui.text()).not.toContain("confirmada.");
  });
  it.each(["family", "userId", "payload", "fenceId"])("evidência divergente por %s não libera clear", async field => {
    save("receber", receipt()); const r = await receiveUI(); h.rec.mockImplementation(async req => proof(req, { [field]: field === "userId" ? 902 : field === "payload" ? {} : field === "family" ? "multimodal_renovar" : null }));
    await r.click("Conferir recebimento"); expect(r.text()).not.toContain("Corrigir após"); expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it.each(["criar", "receber", "renovar"] as const)("resposta direta %s divergente não confirma", async acao => {
    save(acao, acao === "criar" ? body() : acao === "receber" ? receipt() : renewal()); const saved = data.get(key(acao));
    const bad = acao === "criar" ? { ...created(), totalContrato: "999.00" } : acao === "receber" ? { ...received(), parcelaId: 9 } : { ...renewed(), novoVencimento: "2027-01-10" };
    (acao === "criar" ? h.criar : acao === "receber" ? h.receber : h.renovar).mockResolvedValue(bad); const r = acao === "criar" ? await createUI() : acao === "receber" ? await receiveUI() : await renewUI(); await r.click(acao === "criar" ? "Conferir/repetir" : "Repetir a mesma"); expect(data.get(key(acao))).toBe(saved); expect(h.success).not.toHaveBeenCalled();
  });
  it.each(["contratoId", "parcelaId", "acao"])("payload cruzado em %s não permite envio", async field => {
    save("receber", field === "acao" ? renewal() : receipt({ [field]: 9 })); const r = await receiveUI(); expect(r.button("Confirmar recebimento").props.disabled).toBe(true); expect(h.receber).not.toHaveBeenCalled();
  });
});

describe("lifecycle: handlers e respostas velhas, unmount e A→B→A", () => {
  it.each(["sessao", "contrato", "parcela", "status"])("POST A→B→A por %s não grava nem chama callback", async kind => {
    save("receber", receipt()); const saved = data.get(key("receber")); const d = deferred<any>(); h.receber.mockReturnValueOnce(d.promise); const r = await receiveUI(); const p = r.click("Repetir a mesma"); await r.flush(); const original = { ...r.props };
    if (kind === "sessao") h.user = { id: 902 }; else r.props[kind === "contrato" ? "contratoId" : kind === "parcela" ? "parcelaId" : "status"] = kind === "status" ? "paga" : 9; r.render(); h.user = { id: 901 }; r.props = original; r.render(); await r.flush(); const writes = r.writes;
    d.resolve(received()); await p; expect(r.writes).toBe(writes); expect(data.get(key("receber"))).toBe(saved); expect(h.success).not.toHaveBeenCalled();
  });
  it("validação atrasada A→B→A não persiste nem envia nova intenção", async () => {
    const d = deferred<any>(); h.validar.mockReturnValueOnce(d.promise); const r = await createUI(); fill(r); const p = r.click("Confirmar cadastro"); await r.flush(); h.user = { id: 902 }; r.render(); h.user = { id: 901 }; r.render(); await r.flush(); const writes = r.writes; d.resolve({ validada: true }); await p;
    expect(r.writes).toBe(writes); expect(data.size).toBe(0); expect(h.criar).not.toHaveBeenCalled();
  });
  it.each(["resolve", "reject"])("POST após unmount %s não escreve estado/storage/toast", async mode => {
    save("renovar", renewal()); const saved = data.get(key("renovar")); const d = deferred<any>(); h.renovar.mockReturnValueOnce(d.promise); const r = await renewUI(); const p = r.click("Repetir a mesma"); await r.flush(); r.unmount(); const writes = r.writes;
    mode === "resolve" ? d.resolve(renewed()) : d.reject(Error("late")); await p; expect(r.writes).toBe(writes); expect(data.get(key("renovar"))).toBe(saved); expect(h.success).not.toHaveBeenCalled(); expect(h.error).not.toHaveBeenCalled();
  });
  it("handler A antigo não volta a agir depois de A→B→A", async () => {
    save("receber", receipt()); const r = await receiveUI(); const send = r.button("Repetir a mesma").props.onClick; h.user = { id: 902 }; r.render(); h.user = { id: 901 }; r.render(); await r.flush(); await send(); await r.flush(); expect(h.receber).not.toHaveBeenCalled();
  });
  it("cotação tardia A→B→A não repovoa nova tela", async () => {
    const d = deferred<any>(), fresh = deferred<any>(); h.cotar.mockReturnValueOnce(d.promise).mockReturnValueOnce(fresh.promise); const r = await receiveUI(); h.user = { id: 902 }; r.render(); h.user = { id: 901 }; r.render(); await r.flush(); const writes = r.writes;
    d.resolve(receiptQuote); await r.flush(); expect(r.writes).toBe(writes); expect(r.text()).not.toContain("Total exigido"); fresh.resolve(receiptQuote); await r.flush(); expect(r.text()).toContain("Total exigido");
  });
});

describe("encerradas, parcial e bullet replicável", () => {
  it.each(["paga", "pago", "renovada", "cancelada", "cancelado"])("%s sem intenção somente consulta, nenhum UUID/cotação/POST", async status => {
    const a = await receiveUI({ status }), b = await renewUI({ status }); expect(a.nodes("button")).toHaveLength(0); expect(b.nodes("button")).toHaveLength(0); expect(crypto.randomUUID).not.toHaveBeenCalled(); expect(h.cotar).not.toHaveBeenCalled(); expect(h.cotarRenovacao).not.toHaveBeenCalled();
  });
  it.each(["receber", "renovar"] as const)("encerrada com intenção %s só replay UUID original sem recotar", async acao => {
    const p = acao === "receber" ? receipt() : renewal(); save(acao, p); const r = acao === "receber" ? await receiveUI({ status: "paga" }) : await renewUI({ status: "renovada" }); await r.click("Repetir a mesma"); expect(acao === "receber" ? h.receber : h.renovar).toHaveBeenCalledWith(p); expect(crypto.randomUUID).not.toHaveBeenCalled(); expect(h.cotar).not.toHaveBeenCalled(); expect(h.cotarRenovacao).not.toHaveBeenCalled();
  });
  it("origem de outro owner e ids divergentes de cotação bloqueiam", async () => {
    const a = await receiveUI({ origemUserId: 902 }); expect(a.nodes("button")).toHaveLength(0); expect(storage.getItem).not.toHaveBeenCalled();
    h.cotar.mockResolvedValue({ ...receiptQuote, parcelaId: 9 }); const b = await receiveUI(); expect(b.button("Confirmar recebimento").props.disabled).toBe(true);
  });
  it.each(["0", "550", "551"])("parcial inválido %s não persiste/enviada", async valor => {
    const r = await receiveUI(); r.change(r.nodes("select")[0], "parcial"); r.change(r.nodes("input")[0], valor); await r.click("Confirmar recebimento"); expect(h.receber).not.toHaveBeenCalled(); expect(data.size).toBe(0);
  });
  it("parcial positivo preserva residual e não é renovável", async () => {
    const r = await receiveUI({ status: "parcial" }); r.change(r.nodes("select")[0], "parcial"); r.change(r.nodes("input")[0], "100"); h.receber.mockImplementation(async p => received(p)); await r.click("Confirmar recebimento"); expect(h.receber.mock.calls[0][0].valorRecebido).toBe("100.00"); expect(JSON.parse(data.get(key("receber"))!).confirmacao.saldoResidual).toBe("450.00");
    const b = await renewUI({ status: "parcial" }); expect(b.nodes("button")).toHaveLength(0);
  });
  it("bullet cobra só soma juros/encargos e permite mesma regra na sucessora", async () => {
    let r = await renewUI(); r.change(r.nodes("input")[0], "2026-12-10"); await r.flush(); h.renovar.mockImplementation(async p => renewed(p)); await r.click("Confirmar juros"); const p = h.renovar.mock.calls[0][0]; expect(p.valorRecebido).toBe("55.60"); expect(p).not.toHaveProperty("valorPrincipal"); expect(p).not.toHaveProperty("principalPago");
    r.unmount(); h.cotarRenovacao.mockImplementation(async input => ({ ...renewalQuote, parcelaId: 4, novoVencimento: input.novoVencimento })); r = await renewUI({ parcelaId: 4 }); r.change(r.nodes("input")[0], "2027-01-10"); await r.flush(); await r.click("Confirmar juros"); expect(h.renovar.mock.calls[1][0]).toMatchObject({ parcelaId: 4, valorRecebido: "55.60" });
  });
  it("novo vencimento divergente e cotação contendo principal na soma bloqueiam", async () => {
    h.cotarRenovacao.mockResolvedValue({ ...renewalQuote, totalExigido: "555.60" }); const r = await renewUI(); r.change(r.nodes("input")[0], "2026-12-10"); await r.flush(); expect(r.button("Confirmar juros").props.disabled).toBe(true); expect(h.renovar).not.toHaveBeenCalled();
  });
  it("handler de parcela aberta não cria intenção após encerramento", async () => {
    const r = await receiveUI(); const send = r.button("Confirmar recebimento").props.onClick; r.props.status = "paga"; r.render(); await r.flush(); await send(); await r.flush(); expect(h.receber).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled(); expect(data.size).toBe(0);
  });
});

describe("recovery/lifecycle adicionais e confirmação autoritativa", () => {
  function HookUI({ acao }: { acao: "receber" | "renovar" }) {
    const intent = useIntencaoMultimodal<any>(901, acao, h.success, 1, 2);
    return React.createElement("button", { onClick: () => intent.enviar(async () => { throw Error("Não deve gerar payload"); }, p => (acao === "receber" ? h.receber : h.renovar)(p)) }, "Replay hook");
  }
  it("handler de receber não atravessa ação receber→renovar→receber", async () => {
    save("receber", receipt()); save("renovar", renewal()); const r = new MemoryUI(HookUI, { acao: "receber" }).render(); const send = r.button("Replay").props.onClick;
    r.props.acao = "renovar"; r.render(); r.props.acao = "receber"; r.render(); await send(); await r.flush(); expect(h.receber).not.toHaveBeenCalled(); expect(h.renovar).not.toHaveBeenCalled();
  });
  it.each(["sessao", "contrato", "parcela", "status"])("recovery A→B→A por %s não aceita confirmação antiga", async kind => {
    save("receber", receipt()); const saved = data.get(key("receber")), d = deferred<any>(); h.rec.mockReturnValueOnce(d.promise); const r = await receiveUI(); const p = r.click("Conferir recebimento"); await r.flush(); const req = h.rec.mock.calls[0][0], original = { ...r.props };
    if (kind === "sessao") h.user = { id: 902 }; else r.props[kind === "contrato" ? "contratoId" : kind === "parcela" ? "parcelaId" : "status"] = kind === "status" ? "paga" : 9;
    r.render(); h.user = { id: 901 }; r.props = original; r.render(); await r.flush(); const writes = r.writes; d.resolve(proof(req, { status: "confirmed", fenceId: null, result: received() })); await p;
    expect(r.writes).toBe(writes); expect(data.get(key("receber"))).toBe(saved); expect(h.success).not.toHaveBeenCalled();
  });
  it.each(["resolve", "reject"])("recovery após unmount %s não altera storage/estado", async mode => {
    save("renovar", renewal()); const saved = data.get(key("renovar")), d = deferred<any>(); h.rec.mockReturnValueOnce(d.promise); const r = await renewUI(); const p = r.click("Conferir renovação"); await r.flush(); const req = h.rec.mock.calls[0][0]; r.unmount(); const writes = r.writes;
    mode === "resolve" ? d.resolve(proof(req, { status: "confirmed", fenceId: null, result: renewed() })) : d.reject(Error("late")); await p;
    expect(r.writes).toBe(writes); expect(data.get(key("renovar"))).toBe(saved); expect(h.success).not.toHaveBeenCalled(); expect(h.error).not.toHaveBeenCalled();
  });
  it("cotação após unmount não escreve estado nem toast", async () => {
    const d = deferred<any>(); h.cotar.mockReturnValueOnce(d.promise); const r = await receiveUI(); r.unmount(); const writes = r.writes; d.resolve(receiptQuote); await r.flush(); expect(r.writes).toBe(writes); expect(h.error).not.toHaveBeenCalled();
  });
  it("storage mudou durante recovery: não marca fence nem sobrescreve", async () => {
    save("criar", body()); const d = deferred<any>(); h.rec.mockReturnValueOnce(d.promise); const r = await createUI(); const p = r.click("Conferir intenção"); await r.flush(); const req = h.rec.mock.calls[0][0]; save("criar", body({ idempotencyKey: uuidB })); const saved = data.get(key("criar")); d.resolve(proof(req)); await p;
    expect(r.text()).not.toContain("Corrigir após"); expect(data.get(key("criar"))).toBe(saved); expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it("confirmação local inválida só é substituída após recovery confirmado validado", async () => {
    save("renovar", renewal(), { success: true }); const r = await renewUI(); expect(r.button("Repetir a mesma").props.disabled).toBe(true); h.rec.mockImplementation(async req => proof(req, { status: "confirmed", fenceId: null, result: renewed() }));
    await r.click("Conferir renovação"); expect(r.text()).toContain("Renovação confirmada"); expect(JSON.parse(data.get(key("renovar"))!).confirmacao).toEqual(renewed()); expect(h.success).toHaveBeenCalledOnce(); expect(h.renovar).not.toHaveBeenCalled();
  });
  it("fence repetido admite consulta, não novo POST até escolha explícita", async () => {
    save("receber", receipt()); const r = await receiveUI(); const send = r.button("Repetir a mesma").props.onClick; await r.click("Conferir recebimento"); await send(); await r.flush(); expect(h.receber).not.toHaveBeenCalled(); expect(data.size).toBe(1);
    await r.click("Corrigir após"); expect(data.size).toBe(0); expect(crypto.randomUUID).not.toHaveBeenCalled(); expect(h.cotar).toHaveBeenCalledOnce();
  });
  it("iniciar outro cadastro só limpa formulário após confirmação e remoção válidas", async () => {
    const r = await createUI(); fill(r); h.criar.mockImplementation(async p => created(p)); await r.click("Confirmar cadastro"); expect(r.text()).toContain("Confirmada"); await r.click("Iniciar outro cadastro"); expect(data.size).toBe(0); expect(r.nodes("input")[0].props.value).toBe(""); expect(r.nodes("select")[1].props.value).toBe("");
  });
  it("falha ao remover intenção confirmada mantém histórico e impede outro POST", async () => {
    save("criar", body(), created()); const saved = data.get(key("criar")), r = await createUI(); storage.removeItem.mockImplementation(() => { throw Error("remove indisponível"); }); await r.click("Iniciar outro cadastro"); expect(data.get(key("criar"))).toBe(saved); expect(r.nodes("input")).toHaveLength(0); expect(h.criar).not.toHaveBeenCalled();
  });
  it("erro de cotação pode ser atualizado sem operação financeira implícita", async () => {
    h.cotar.mockRejectedValueOnce(Error("outage")); const r = await receiveUI(); expect(r.button("Confirmar recebimento").props.disabled).toBe(true); await r.click("Tentar novamente"); expect(r.text()).toContain("Total exigido"); expect(h.receber).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled();
  });
  it("alteração de vencimento A→B→A descarta resposta antiga de renovação", async () => {
    const a = deferred<any>(), b = deferred<any>(), c = deferred<any>(); h.cotarRenovacao.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise).mockReturnValueOnce(c.promise); const r = await renewUI();
    r.change(r.nodes("input")[0], "2026-12-10"); await r.flush(); r.change(r.nodes("input")[0], "2027-01-10"); await r.flush(); r.change(r.nodes("input")[0], "2026-12-10"); await r.flush(); const writes = r.writes;
    a.resolve(renewalQuote); b.resolve({ ...renewalQuote, novoVencimento: "2027-01-10" }); await r.flush(); expect(r.writes).toBe(writes); expect(r.button("Confirmar juros").props.disabled).toBe(true);
    c.resolve(renewalQuote); await r.flush(); expect(r.button("Confirmar juros").props.disabled).toBe(false);
  });
});

describe('entrada preserva a família da intenção, sem cadastro duplicado por troca de ciclo', () => {
  const mensalKey = (id = 901) => `cobrapro:ciclo:v1:${id}:criar:nova`;
  it('intenção mensal anterior continua acessível mesmo após instalar o ciclo ampliado', () => {
    sessionStorage.setItem(mensalKey(), JSON.stringify({ versao: 1, payload: body() }));
    const r = new MemoryUI(NovoContrato, {}).render();
    expect(r.nodes('cadastro-mensal-anterior')).toHaveLength(1); expect(r.nodes(EmprestimoMultimodalCriar)).toHaveLength(0);
    expect(data.has(mensalKey())).toBe(true); expect(h.criar).not.toHaveBeenCalled();
  });
  it.each(['isError', 'desligada', 'isLoading'])('intenção multimodal não muda para mensal durante %s', mode => {
    save('criar', body()); h.queries.capacidade = query({ disponivel: mode !== 'desligada', modalidades: [] }, mode === 'desligada' ? {} : { [mode]: true });
    const r = new MemoryUI(NovoContrato, {}).render(); expect(r.nodes(EmprestimoMultimodalCriar)).toHaveLength(1); expect(r.nodes('cadastro-mensal-anterior')).toHaveLength(0);
    expect(data.has(key('criar'))).toBe(true); expect(h.criar).not.toHaveBeenCalled();
  });
  it('erro de capacidade após a escolha não desmonta a recuperação multimodal', () => {
    const r = new MemoryUI(NovoContrato, {}).render(); expect(r.nodes(EmprestimoMultimodalCriar)).toHaveLength(1);
    h.queries.capacidade = query(undefined, { isError: true }); r.render();
    expect(r.nodes(EmprestimoMultimodalCriar)).toHaveLength(1); expect(r.nodes('cadastro-mensal-anterior')).toHaveLength(0);
  });
  it('capacidade nova não troca automaticamente um formulário mensal anterior já aberto', () => {
    h.queries.capacidade = query({ disponivel: false }); const r = new MemoryUI(NovoContrato, {}).render();
    h.queries.capacidade = query({ disponivel: true }); r.render();
    expect(r.nodes('cadastro-mensal-anterior')).toHaveLength(1); expect(r.nodes(EmprestimoMultimodalCriar)).toHaveLength(0);
  });
  it('duas intenções exigem escolher a consulta, sem limpar ou enviar uma delas', async () => {
    save('criar', body()); sessionStorage.setItem(mensalKey(), JSON.stringify({ versao: 1, payload: body({ idempotencyKey: uuidB }) }));
    const r = new MemoryUI(NovoContrato, {}).render(); expect(r.nodes(EmprestimoMultimodalCriar)).toHaveLength(0); expect(r.nodes('cadastro-mensal-anterior')).toHaveLength(0);
    await r.click('Conferir intenção multimodal'); expect(r.nodes(EmprestimoMultimodalCriar)).toHaveLength(1);
    expect(data.size).toBe(2); expect(h.criar).not.toHaveBeenCalled(); expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it('intenção de A não é consultada como intenção de B nem fixa seu formulário', () => {
    sessionStorage.setItem(mensalKey(), JSON.stringify({ versao: 1, payload: body() })); const r = new MemoryUI(NovoContrato, {}).render();
    storage.getItem.mockClear(); h.user = { id: 902 }; r.render();
    expect(r.nodes(EmprestimoMultimodalCriar)).toHaveLength(1); expect(r.nodes('cadastro-mensal-anterior')).toHaveLength(0);
    expect(storage.getItem.mock.calls.every(([k]) => k.includes(':902:'))).toBe(true);
  });
  it('falha de leitura do storage não assume que nenhuma intenção existe', () => {
    storage.getItem.mockImplementation(() => { throw Error('storage indisponível'); }); const r = new MemoryUI(NovoContrato, {}).render();
    expect(r.nodes(EmprestimoMultimodalCriar)).toHaveLength(0); expect(r.nodes('cadastro-mensal-anterior')).toHaveLength(0); expect(r.text()).toContain('Não foi possível conferir a intenção'); expect(h.criar).not.toHaveBeenCalled();
  });
  it('sessão em fetching não lê intenções nem monta formulário com identidade antiga', () => {
    h.auth = { isFetching: true }; const r = new MemoryUI(NovoContrato, {}).render();
    expect(storage.getItem).not.toHaveBeenCalled(); expect(r.nodes(EmprestimoMultimodalCriar)).toHaveLength(0); expect(r.nodes('cadastro-mensal-anterior')).toHaveLength(0);
  });
});
