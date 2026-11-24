import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  contas: { data: [] as any, isLoading: false, isError: false, error: null as any, isFetching: false, refetch: vi.fn() },
  transacoes: { data: [] as any, isLoading: false, isError: false, error: null as any, isFetching: false, refetch: vi.fn() },
  queryTransacoes: vi.fn(), mutate: vi.fn(), invalidateContas: vi.fn(), invalidateTransacoes: vi.fn(),
  queryOptions: vi.fn(), queryContas: vi.fn(), queryConferencia: vi.fn(), queryMetadata: vi.fn(),
  metadata: { data: { empresaId: 1, contas: [{ id: 1, nome: "Conta própria", tipo: "caixa" }] } as any, isLoading: false, isError: false, error: null as any, isFetching: false, refetch: vi.fn() },
  auth: { data: { id: 1 } as any, isLoading: false, isError: false, error: null as any, isFetching: false },
  operations: [] as any[], mutationOptions: null as any, uuid: 0,
  buttons: [] as any[],
  state: null as null | { cursor: number; values: any[] },
}));

vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof React>();
  return { ...actual, useState: (initial: any) => {
    const state = mocks.state;
    if (!state) return actual.useState(initial);
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = typeof initial === "function" ? initial() : initial;
    return [state.values[index], (next: any) => {
      state.values[index] = typeof next === "function" ? next(state.values[index]) : next;
    }];
  }, useRef: (initial: any) => {
    if (!mocks.state) return actual.useRef(initial);
    const index = mocks.state.cursor++;
    if (!(index in mocks.state.values)) mocks.state.values[index] = { current: initial };
    return mocks.state.values[index];
  }, useEffect: (...args: any[]) => {
    if (!mocks.state) return (actual.useEffect as any)(...args);
  } };
});
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/ui/button", () => ({ Button: (props: any) => {
  mocks.buttons.push(props);
  const { variant, size, ...native } = props;
  return createElement("button", native);
} }));
vi.mock("@/components/Caixa37Operacoes", () => ({
  Caixa37Aporte: (props: any) => { mocks.operations.push({ action: "aporte", ...props }); return createElement("button", { disabled: !props.userId }, "Aportar / conferir aporte"); },
  Caixa37Transferencia: (props: any) => { mocks.operations.push({ action: "transferir", ...props }); return createElement("button", { disabled: !props.userId }, "Transferir / conferir transferência"); },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ caixa: {
    contas: { invalidate: mocks.invalidateContas }, transacoes: { invalidate: mocks.invalidateTransacoes }, contasParaOperacao37: { invalidate: vi.fn() }, conferencia: { invalidate: vi.fn() },
  } }),
  auth: { me: { useQuery: () => mocks.auth } },
  caixa: {
    consultarObservacao45: { useQuery: () => ({ data: undefined, isError: false, error: null, isFetching: false, refetch: vi.fn() }) },
    corrigirObservacao45: { useMutation: () => ({ mutateAsync: mocks.mutate, isPending: false }) },
    reconciliarObservacao45: { useMutation: () => ({ mutateAsync: mocks.mutate, isPending: false }) },
    contasParaOperacao37: { useQuery: (_input: any, options: any) => { mocks.queryMetadata(options); return mocks.metadata; } },
    contas: { useQuery: (input: any, options: any) => { mocks.queryContas(input); mocks.queryOptions('contas', options); return mocks.contas; } },
    transacoes: { useQuery: (input: any, options: any) => { mocks.queryTransacoes(input); mocks.queryOptions('transacoes', options); return mocks.transacoes; } },
    conferencia: { useQuery: (input: any) => { mocks.queryConferencia(input); return { data: undefined, isFetching: false, error: null, refetch: vi.fn() }; } },
    criarConta: { useMutation: (options: any) => { mocks.mutationOptions = options; return { mutate: mocks.mutate, isPending: false }; } },
    registrarTransacao: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) },
  },
} }));
import Caixa, { CaixaEmpresa } from "./Caixa";

const conta = (id: number, saldoAtual: number | string = 123.45) => ({
  id, nome: `Conta sintética ${id}`, tipo: "caixa", banco: null, saldoAtual,
});
const transacao = (dataTransacao: string | Date = "2026-09-14") => ({
  id: 700, tipo: "entrada", valor: "0.01", categoria: "outros", descricao: "Movimento sintético",
  contaNome: "Conta do movimento", clienteNome: null, dataTransacao,
});
const markup = (tree = createElement(CaixaEmpresa, { userId: 1, atual: () => true })) => {
  mocks.buttons = []; mocks.operations = [];
  return renderToStaticMarkup(tree).replace(/\u00a0/g, " ");
};
const retry = (origem: "contas" | "transações") => {
  const button = mocks.buttons.find(props => props["aria-label"] === `Tentar novamente: as ${origem} do caixa`);
  expect(button).toBeDefined();
  return button;
};
function nodes(tree: any, predicate: (node: any) => boolean): any[] {
  const found: any[] = [];
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    if (predicate(node)) found.push(node);
    walk(node.props?.children);
  };
  walk(tree);
  return found;
}
function text(node: any): string {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (!node || typeof node === "boolean") return "";
  return typeof node === "object" ? text(node.props?.children) : String(node);
}
function pageWithState(state: { cursor: number; values: any[] }) {
  state.cursor = 0;
  mocks.state = state;
  try { return CaixaEmpresa({ userId: 1, atual: () => true }); } finally { mocks.state = null; }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React); // Transformação JSX clássica do Vitest local.
  mocks.state = null;
  for (const query of [mocks.contas, mocks.transacoes]) {
    Object.assign(query, { data: [], isLoading: false, isError: false, error: null, isFetching: false });
    query.refetch.mockResolvedValue({});
  }
  Object.assign(mocks.metadata, { data: { empresaId: 1, contas: [{ id: 1, nome: "Conta própria", tipo: "caixa" }] }, isLoading: false, isError: false, error: null, isFetching: false });
  Object.assign(mocks.auth, { data: { id: 1 }, isLoading: false, isError: false, error: null, isFetching: false });
  mocks.uuid = 0; mocks.operations = []; mocks.mutationOptions = null;
  vi.stubGlobal("crypto", { randomUUID: () => `00000000-0000-4000-8000-${String(++mocks.uuid).padStart(12, "0")}` });
  mocks.buttons = [];
});
afterEach(() => { mocks.state = null; vi.unstubAllGlobals(); });

describe("Caixa operacional — componentes reais renderizados, sem browser/rede", () => {
  it('consultas recusadas não ficam em retry automático; cada origem conserva retry manual', () => {
    markup();
    expect(mocks.queryOptions).toHaveBeenCalledWith('contas', { retry: false });
    expect(mocks.queryOptions).toHaveBeenCalledWith('transacoes', { retry: false });
  });

  it.each([false, true])("erro nas duas consultas, cache=%s: alerta, sem zero fictício ou dados antigos", cache => {
    Object.assign(mocks.contas, { data: cache ? [conta(1)] : [], isError: true, error: new Error("Falha sintética contas") });
    Object.assign(mocks.transacoes, { data: cache ? [transacao()] : [], isError: true, error: new Error("Falha sintética transações") });
    const html = markup();
    expect(html).toContain("Não foi possível carregar as contas do caixa.");
    expect(html).toContain("Não foi possível carregar as transações do caixa.");
    expect(html).toContain("Falha sintética contas");
    expect(html).toContain("Falha sintética transações");
    expect(html.match(/role="alert"/g)).toHaveLength(2);
    expect(html).toContain("Saldo indisponível");
    expect(html).not.toContain("R$ 0,00");
    expect(html).not.toContain("R$ 123,45");
    expect(html).not.toContain("Conta sintética");
    expect(html).not.toContain("Movimento sintético");
    expect(html).not.toContain("common.noData");
    const cadastro = mocks.buttons.find(props => text(props.children).trim() === "Nova conta");
    expect(cadastro?.disabled).toBe(false);
    expect(mocks.operations).toHaveLength(2);
    expect(mocks.operations.every(props => props.userId === 1)).toBe(true);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("isError sem mensagem também é erro explícito e não vazio", () => {
    mocks.contas.isError = true;
    mocks.transacoes.isError = true;
    const html = markup();
    expect(html).toContain("Consulta indisponível.");
    expect(html).not.toContain("common.noData");
    expect(html).not.toContain("R$ 0,00");
  });

  it("error informado não pode ser ocultado por isError falso", () => {
    mocks.contas.error = new Error("Erro com flag transitória");
    mocks.contas.data = [conta(1)];
    expect(markup()).toContain("Erro com flag transitória");
    expect(markup()).not.toContain("Conta sintética 1");
  });

  it.each([false, true])("loading nas duas consultas, cache=%s: não mostra vazio, zero ou cache", cache => {
    Object.assign(mocks.contas, { data: cache ? [conta(1)] : undefined, isLoading: true, isFetching: true });
    Object.assign(mocks.transacoes, { data: cache ? [transacao()] : undefined, isLoading: true, isFetching: true });
    const html = markup();
    expect(html).toContain("Carregando saldo...");
    expect(html).toContain("Carregando contas...");
    expect(html).toContain("Carregando transações...");
    expect(html).not.toContain("common.noData");
    expect(html).not.toContain("R$ 0,00");
    expect(html).not.toContain("Conta sintética");
    expect(html).not.toContain("Movimento sintético");
    expect(mocks.buttons.find(props => text(props.children).trim() === "Nova conta")?.disabled).toBe(false);
  });

  it("consulta sem dados ainda não representa sucesso vazio", () => {
    mocks.contas.data = undefined;
    mocks.transacoes.data = undefined;
    const html = markup();
    expect(html).toContain("Carregando saldo");
    expect(html).toContain("Carregando transações");
    expect(html).not.toContain("common.noData");
    expect(html).not.toContain("R$ 0,00");
  });

  it("vazio legítimo mostra saldo zero e estados vazios, não erro", () => {
    const html = markup();
    expect(html).toContain("R$ 0,00");
    expect(html.match(/common.noData/g)).toHaveLength(2);
    expect(html).not.toContain("Não foi possível carregar");
    expect(html).not.toContain("Carregando");
    expect(mocks.buttons.find(props => text(props.children).trim() === "Nova conta")?.disabled).toBe(false);
    expect(mocks.operations).toHaveLength(2); // Recovery não depende de conta/saldo antigo.
  });

  it.each(["contas", "transações"] as const)("retentativa %s executa somente seu refetch, sem mutation ou invalidation", async origem => {
    const query = origem === "contas" ? mocks.contas : mocks.transacoes;
    const outra = origem === "contas" ? mocks.transacoes : mocks.contas;
    query.isError = true;
    markup();
    const button = retry(origem);
    expect(button.disabled).toBe(false);
    button.onClick();
    await Promise.resolve();
    expect(query.refetch).toHaveBeenCalledOnce();
    expect(outra.refetch).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.invalidateContas).not.toHaveBeenCalled();
    expect(mocks.invalidateTransacoes).not.toHaveBeenCalled();
  });

  it("erro tem precedência no retry em andamento, botão desabilitado, cache oculto", () => {
    Object.assign(mocks.contas, { data: [conta(1)], isError: true, isFetching: true });
    Object.assign(mocks.transacoes, { data: [transacao()], isError: true, isFetching: true });
    const html = markup();
    expect(retry("contas").disabled).toBe(true);
    expect(retry("transações").disabled).toBe(true);
    expect(html.match(/Tentando novamente\.\.\./g)).toHaveLength(2);
    expect(html).not.toContain("Conta sintética");
    expect(html).not.toContain("Movimento sintético");
    expect(html).not.toContain("common.noData");
    expect(html).not.toContain("R$ 0,00");
  });

  it("sucesso após retentativa restaura leituras sem executar writer financeiro", () => {
    mocks.contas.isError = true;
    markup();
    retry("contas").onClick();
    Object.assign(mocks.contas, { isError: false, error: null, data: [conta(1)] });
    mocks.transacoes.data = [transacao()];
    const html = markup();
    expect(html).not.toContain("Não foi possível carregar");
    expect(html).toContain("Conta sintética 1");
    expect(html).toContain("Movimento sintético");
    expect(mocks.buttons.find(props => text(props.children).trim() === "Nova conta")?.disabled).toBe(false);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("erro só em transações não esconde contas válidas nem acopla os controles37", () => {
    mocks.contas.data = [conta(1)];
    Object.assign(mocks.transacoes, { isError: true, error: new Error("Falha movimentos"), data: [transacao()] });
    const html = markup();
    expect(html).toContain("Conta sintética 1");
    expect(html).toContain("R$ 123,45");
    expect(html).not.toContain("Movimento sintético");
    expect(html).not.toContain("common.noData");
    expect(html).toContain("Aportar / conferir aporte");
    expect(html).toContain("Transferir / conferir transferência");
    expect(html).not.toContain("cashbox.debitBalance");
    expect(mocks.operations.every(o => o.contas[0].nome === "Conta própria")).toBe(true);
  });

  it("NovaConta preenchida preserva o bloqueio de sessão, não o erro financeiro", () => {
    mocks.transacoes.isError = true;
    const page = pageWithState({ cursor: 0, values: [] });
    const component = nodes(page, node => node.type?.name === "NovaConta")[0];
    expect(component.props.disabled).toBe(false);
    mocks.state = { cursor: 0, values: [true, { nome: "Conta preenchida", tipo: "caixa", banco: "", saldoInicial: "10.00" }] };
    let dialog;
    try { dialog = component.type({ ...component.props, disabled: true, atual: () => false }); } finally { mocks.state = null; }
    const submit = nodes(dialog, node => !!node.props?.onClick && node.props.disabled !== undefined && text(node).includes("cashbox.createAccount"))[0];
    markup(submit);
    expect(mocks.buttons[0].disabled).toBe(true);
    mocks.buttons[0].onClick();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("refetch saudável é identificado como atualização sem acoplar cadastro ao saldo", () => {
    mocks.contas.data = [conta(1)];
    mocks.transacoes.data = [transacao()];
    mocks.contas.isFetching = true;
    mocks.transacoes.isFetching = true;
    const html = markup();
    expect(html).toContain("Atualizando contas...");
    expect(html).toContain("Atualizando transações...");
    expect(html).toContain("Conta sintética 1");
    expect(html).not.toContain("Não foi possível carregar");
    expect(mocks.buttons.find(props => text(props.children).trim() === "Nova conta")?.disabled).toBe(false);
  });

  it("seleção existente persiste no erro e no retry sem nome antigo nem undefined", () => {
    const state = { cursor: 0, values: [] as any[] };
    mocks.contas.data = [conta(1), conta(2)];
    let tree = pageWithState(state);
    const cards = nodes(tree, node => !!node.props?.onClick && text(node).includes("Conta sintética 2"));
    expect(cards).toHaveLength(1);
    cards[0].props.onClick();
    tree = pageWithState(state);
    expect(mocks.queryTransacoes).toHaveBeenLastCalledWith({ contaCaixaId: 2, leituraId: expect.any(String) });
    expect(markup(tree)).toContain("Transações — Conta sintética 2");
    mocks.contas.isError = true;
    tree = pageWithState(state);
    const errorHtml = markup(tree);
    expect(errorHtml).toContain("Transações — conta #2");
    expect(errorHtml).not.toContain("Conta sintética 2");
    expect(errorHtml).not.toContain("undefined");
    retry("contas").onClick();
    mocks.contas.isError = false;
    tree = pageWithState(state);
    expect(markup(tree)).toContain("Transações — Conta sintética 2");
    nodes(tree, node => !!node.props?.onClick && text(node).includes("Conta sintética 2"))[0].props.onClick();
    pageWithState(state);
    expect(mocks.queryTransacoes).toHaveBeenLastCalledWith({ contaCaixaId: undefined, leituraId: expect.any(String) });
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("DATE mantém 14/09/2026 sem horário, e banco:null permanece compatível", () => {
    const account = conta(1, "0.10");
    mocks.contas.data = [account];
    mocks.transacoes.data = [transacao("2026-09-14")];
    const html = markup();
    expect(html).toContain("14/09/2026");
    expect(html).not.toContain("13/09");
    expect(html).not.toMatch(/\d{2}:\d{2}/);
    expect(html).toContain("+R$ 0,01");
    expect(account.banco).toBeNull();
  });

  it.each(["2026-09-14T00:00:00.000Z", new Date("2026-09-14T00:00:00.000Z")])("timestamp real %s mantém instante e horário de Brasília", value => {
    mocks.contas.data = [conta(1)];
    mocks.transacoes.data = [transacao(value)];
    const html = markup();
    expect(html).toContain("13/09/2026, 21:00");
    expect(html).not.toContain("14/09/2026");
  });

  it("data inválida não inventa data ou horário", () => {
    mocks.transacoes.data = [transacao("não é data")];
    expect(markup()).toContain("Data indisponível");
    expect(markup()).not.toContain("Invalid Date");
  });

  it.each([
    { saldos: [0.1, 0.2, -0.05], total: "R$ 0,25" },
    { saldos: ["0.10", "0.20", "-0.05"], total: "R$ 0,25" },
    { saldos: ["0.01", "-0.02"], total: "-R$ 0,01" },
    // Float reduce perde centavos mesmo que cada conta e o resultado caibam no transporte numérico.
    { saldos: [10000000000000.01, 0.01, -10000000000000], total: "R$ 0,02" },
  ])("saldoTotal soma centavos exatos com entradas e saldos negativos: $saldos", ({ saldos, total }) => {
    mocks.contas.data = saldos.map((saldo, index) => conta(index + 1, saldo));
    const html = markup();
    expect(html).toContain("Saldo total do Caixa");
    expect(html).not.toContain("cashbox.totalIncome");
    const totalCard = html.slice(html.indexOf("Saldo total do Caixa"), html.indexOf("cashbox.account"));
    expect(totalCard).toContain(total);
    expect(html).not.toContain("Não foi possível calcular");
  });

  it.each(["1.001", "NaN", "Infinity"])("saldo inválido %s não vira total zero nem autoriza writer financeiro", saldo => {
    mocks.contas.data = [conta(1, saldo)];
    const html = markup();
    expect(html).toContain("Não foi possível calcular o saldo total com segurança");
    expect(mocks.buttons.find(props => text(props.children).trim() === "Nova conta")?.disabled).toBe(false);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});


describe("Integração Caixa37 na página — fontes e isolamento de sessão", () => {
  it.each([
    { name: "owner alheio", data: { empresaId: 2, contas: [{ id: 9, nome: "Conta alheia", tipo: "caixa" }] } },
    { name: "formato incompleto", data: { empresaId: 1 } },
    { name: "row nulo", data: { empresaId: 1, contas: [null] } },
    { name: "ID inválido", data: { empresaId: 1, contas: [{ id: 0, nome: "Inválida", tipo: "caixa" }] } },
    { name: "ID repetido", data: { empresaId: 1, contas: [{ id: 1, nome: "A", tipo: "caixa" }, { id: 1, nome: "B", tipo: "caixa" }] } },
    { name: "saldo não é metadata", data: { empresaId: 1, contas: [{ id: 1, nome: "A", tipo: "caixa", saldo: "0.00" }] } },
    { name: "ordem inválida", data: { empresaId: 1, contas: [{ id: 2, nome: "A", tipo: "caixa" }, { id: 1, nome: "B", tipo: "caixa" }] } },
  ])("metadata $name: não cria opções mas mantém recovery acessível", ({ data }) => {
    mocks.metadata.data = data;
    const html = markup();
    expect(html).toContain("Aportar / conferir aporte");
    expect(html).toContain("Transferir / conferir transferência");
    expect(mocks.operations).toHaveLength(2);
    expect(mocks.operations.every(o => o.contas.length === 0 && o.userId === 1)).toBe(true);
    expect(html).toContain("intenção já enviada continua acessível");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it.each(["isError", "isLoading", "isFetching"] as const)("metadata com cache mas %s não entrega opções antigas", flag => {
    mocks.metadata[flag] = true;
    markup();
    expect(mocks.operations.every(o => o.contas.length === 0 && o.userId === 1)).toBe(true);
    expect(mocks.buttons.find(p => text(p.children).trim() === "Nova conta")?.disabled).toBe(false);
  });

  it("getter de metadata não é executado e não quebra a página", () => {
    let reads = 0;
    mocks.metadata.data = { empresaId: 1, get contas() { reads++; throw Error("Getter não executável"); } };
    expect(() => markup()).not.toThrow();
    expect(reads).toBe(0);
    expect(mocks.operations.every(o => o.contas.length === 0)).toBe(true);
  });

  it("metadata própria é independente do saldo/extrato e não herda contas antigas", () => {
    mocks.contas.data = [conta(99)];
    mocks.contas.isError = true;
    mocks.transacoes.isError = true;
    markup();
    expect(mocks.operations.map(o => o.contas)).toEqual([
      [{ id: 1, nome: "Conta própria" }], [{ id: 1, nome: "Conta própria" }],
    ]);
    expect(mocks.queryMetadata).toHaveBeenCalledWith({ retry: false, staleTime: 0 });
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("chave de leitura é estável na tela e distinta após nova montagem", () => {
    const state = { cursor: 0, values: [] as any[] };
    markup(pageWithState(state));
    const first = mocks.queryContas.mock.lastCall![0].leituraId;
    expect(mocks.queryTransacoes.mock.lastCall![0].leituraId).toBe(first);
    expect(mocks.queryConferencia.mock.lastCall![0].leituraId).toBe(first);
    markup(pageWithState(state));
    expect(mocks.queryContas.mock.lastCall![0].leituraId).toBe(first);
    markup(pageWithState({ cursor: 0, values: [] }));
    expect(mocks.queryContas.mock.lastCall![0].leituraId).not.toBe(first);
  });

  it("A→B→A invalida handlers antigos e remonta seleção/formulário em cada geração", () => {
    const state = { cursor: 0, values: [] as any[] };
    function root() {
      state.cursor = 0; mocks.state = state;
      try { return Caixa(); } finally { mocks.state = null; }
    }
    const a = root();
    expect(a.props.userId).toBe(1);
    expect(a.props.atual()).toBe(true);
    mocks.auth.data = { id: 2 };
    const b = root();
    expect(a.props.atual()).toBe(false);
    expect(b.props.userId).toBe(2);
    expect(b.key).not.toBe(a.key);
    mocks.auth.data = { id: 1 };
    const secondA = root();
    expect(a.props.atual()).toBe(false);
    expect(b.props.atual()).toBe(false);
    expect(secondA.props.atual()).toBe(true);
    expect(secondA.key).not.toBe(a.key);
    mocks.auth.isFetching = true;
    const pending = root();
    expect(text(pending)).toContain("Conferindo a sessão");
    expect(secondA.props.atual()).toBe(false);
  });

  it.each(["isError", "isLoading", "isFetching"] as const)("sessão %s não monta controles ou cache financeiro", flag => {
    mocks.auth[flag] = true;
    const html = markup(createElement(Caixa));
    expect(html).toContain("Conferindo a sessão atual da empresa");
    expect(mocks.operations).toHaveLength(0);
    expect(mocks.queryContas).not.toHaveBeenCalled();
  });

  it("callback de NovaConta do owner anterior não invalida a empresa atual", () => {
    const page = pageWithState({ cursor: 0, values: [] });
    const component = nodes(page, node => node.type?.name === "NovaConta")[0];
    let current = true;
    const onSuccess = vi.fn();
    mocks.state = { cursor: 0, values: [true, { nome: "Conta nova", tipo: "caixa", banco: "", saldoInicial: "1.00" }] };
    let dialog;
    try { dialog = component.type({ ...component.props, atual: () => current, onSuccess }); } finally { mocks.state = null; }
    const options = mocks.mutationOptions;
    const submit = nodes(dialog, n => !!n.props?.onClick && text(n).includes("cashbox.createAccount"))[0];
    current = false;
    submit.props.onClick();
    options.onSuccess();
    options.onError(new Error("Resposta antiga"));
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mocks.invalidateContas).not.toHaveBeenCalled();
  });

  it.each(["1.001", "1e2", "NaN", "Infinity", " 1.00", "1,00"])("NovaConta não arredonda saldo inicial inválido %s", saldoInicial => {
    const page = pageWithState({ cursor: 0, values: [] });
    const component = nodes(page, node => node.type?.name === "NovaConta")[0];
    mocks.state = { cursor: 0, values: [true, { nome: "Conta nova", tipo: "caixa", banco: "", saldoInicial }] };
    let dialog;
    try { dialog = component.type(component.props); } finally { mocks.state = null; }
    const submit = nodes(dialog, n => !!n.props?.onClick && text(n).includes("cashbox.createAccount"))[0];
    submit.props.onClick();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
