import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  contas: { data: [] as any, isLoading: false, isError: false, error: null as any, isFetching: false, refetch: vi.fn() },
  transacoes: { data: [] as any, isLoading: false, isError: false, error: null as any, isFetching: false, refetch: vi.fn() },
  queryTransacoes: vi.fn(), mutate: vi.fn(), invalidateContas: vi.fn(), invalidateTransacoes: vi.fn(),
  queryOptions: vi.fn(),
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
  } };
});
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/ui/button", () => ({ Button: (props: any) => {
  mocks.buttons.push(props);
  const { variant, size, ...native } = props;
  return createElement("button", native);
} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ caixa: {
    contas: { invalidate: mocks.invalidateContas }, transacoes: { invalidate: mocks.invalidateTransacoes },
  } }),
  caixa: {
    contas: { useQuery: (_input: any, options: any) => { mocks.queryOptions('contas', options); return mocks.contas; } },
    transacoes: { useQuery: (input: any, options: any) => { mocks.queryTransacoes(input); mocks.queryOptions('transacoes', options); return mocks.transacoes; } },
    conferencia: { useQuery: () => ({ data: undefined, isFetching: false, error: null, refetch: vi.fn() }) },
    criarConta: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) },
    registrarTransacao: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) },
  },
} }));
import Caixa from "./Caixa";

const conta = (id: number, saldoAtual: number | string = 123.45) => ({
  id, nome: `Conta sintética ${id}`, tipo: "caixa", banco: null, saldoAtual,
});
const transacao = (dataTransacao: string | Date = "2026-09-14") => ({
  id: 700, tipo: "entrada", valor: "0.01", categoria: "outros", descricao: "Movimento sintético",
  contaNome: "Conta do movimento", clienteNome: null, dataTransacao,
});
const markup = (tree = createElement(Caixa)) => {
  mocks.buttons = [];
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
  try { return Caixa(); } finally { mocks.state = null; }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React); // Transformação JSX clássica do Vitest local.
  mocks.state = null;
  for (const query of [mocks.contas, mocks.transacoes]) {
    Object.assign(query, { data: [], isLoading: false, isError: false, error: null, isFetching: false });
    query.refetch.mockResolvedValue({});
  }
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
    const financialButtons = mocks.buttons.filter(props => text(props.children).includes("cashbox.newTransaction"));
    expect(financialButtons).toHaveLength(2);
    expect(financialButtons.every(props => props.disabled)).toBe(true);
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
    expect(mocks.buttons.filter(props => text(props.children).includes("cashbox.newTransaction")).every(props => props.disabled)).toBe(true);
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
    const buttons = mocks.buttons.filter(props => text(props.children).includes("cashbox.newTransaction"));
    expect(buttons[0].disabled).toBe(false); // Nova conta preservada.
    expect(buttons[1].disabled).toBe(true); // Transação sem conta não é permitida.
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

  it("sucesso após retentativa libera apenas as ações já existentes", () => {
    mocks.contas.isError = true;
    markup();
    retry("contas").onClick();
    Object.assign(mocks.contas, { isError: false, error: null, data: [conta(1)] });
    mocks.transacoes.data = [transacao()];
    const html = markup();
    expect(html).not.toContain("Não foi possível carregar");
    expect(html).toContain("Conta sintética 1");
    expect(html).toContain("Movimento sintético");
    expect(mocks.buttons.filter(props => text(props.children).includes("cashbox.newTransaction")).every(props => !props.disabled)).toBe(true);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("erro só em transações não esconde contas válidas, mas bloqueia lançamentos rápidos", () => {
    mocks.contas.data = [conta(1)];
    Object.assign(mocks.transacoes, { isError: true, error: new Error("Falha movimentos"), data: [transacao()] });
    const html = markup();
    expect(html).toContain("Conta sintética 1");
    expect(html).toContain("R$ 123,45");
    expect(html).not.toContain("Movimento sintético");
    expect(html).not.toContain("common.noData");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="cashbox.addBalance"/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="cashbox.debitBalance"/);
  });

  it.each([
    { name: "NovaConta", values: [true, { nome: "Conta preenchida", tipo: "caixa", banco: "", saldoInicial: "10.00" }], action: "cashbox.createAccount" },
    { name: "NovaTransacao", values: [true, { contaCaixaId: "1", tipo: "entrada", categoria: "outros", valor: "10.00", descricao: "Preenchido" }], action: "common.save" },
    { name: "LancamentoRapido", values: [true, "10.00", "Preenchido"], action: "common.add" },
  ])("$name já preenchido bloqueia submit e seu handler ao perder disponibilidade", ({ name, values, action }) => {
    mocks.contas.data = [conta(1)];
    mocks.transacoes.isError = true;
    const page = pageWithState({ cursor: 0, values: [] });
    const component = nodes(page, node => node.type?.name === name)[0];
    expect(component).toBeDefined();
    expect(component.props.disabled).toBe(true);
    mocks.state = { cursor: 0, values };
    let dialog;
    try { dialog = component.type(component.props); } finally { mocks.state = null; }
    const submit = nodes(dialog, node => !!node.props?.onClick && node.props.disabled !== undefined && text(node).includes(action))[0];
    expect(submit).toBeDefined();
    markup(submit);
    expect(mocks.buttons[0].disabled).toBe(true);
    mocks.buttons[0].onClick(); // Invocação adversarial mesmo com disabled.
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("refetch saudável é identificado como atualização e bloqueia mutações até terminar", () => {
    mocks.contas.data = [conta(1)];
    mocks.transacoes.data = [transacao()];
    mocks.contas.isFetching = true;
    mocks.transacoes.isFetching = true;
    const html = markup();
    expect(html).toContain("Atualizando contas...");
    expect(html).toContain("Atualizando transações...");
    expect(html).toContain("Conta sintética 1");
    expect(html).not.toContain("Não foi possível carregar");
    expect(mocks.buttons.filter(props => text(props.children).includes("cashbox.newTransaction")).every(props => props.disabled)).toBe(true);
  });

  it("seleção existente persiste no erro e no retry sem nome antigo nem undefined", () => {
    const state = { cursor: 0, values: [] as any[] };
    mocks.contas.data = [conta(1), conta(2)];
    let tree = pageWithState(state);
    const cards = nodes(tree, node => !!node.props?.onClick && text(node).includes("Conta sintética 2"));
    expect(cards).toHaveLength(1);
    cards[0].props.onClick();
    tree = pageWithState(state);
    expect(mocks.queryTransacoes).toHaveBeenLastCalledWith({ contaCaixaId: 2 });
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
    expect(mocks.queryTransacoes).toHaveBeenLastCalledWith({ contaCaixaId: undefined });
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

  it.each(["1.001", "NaN", "Infinity"])("saldo inválido %s não vira total zero nem libera mutation", saldo => {
    mocks.contas.data = [conta(1, saldo)];
    const html = markup();
    expect(html).toContain("Não foi possível calcular o saldo total com segurança");
    expect(mocks.buttons.filter(props => text(props.children).includes("cashbox.newTransaction")).every(props => props.disabled)).toBe(true);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
