import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clienteCreateInput, clienteUpdateInput, clienteTextoOpcional, clienteCorrespondeBusca } from "@shared/clientesInput";

const mocks = vi.hoisted(() => ({
  list: { data: { clientes: [], total: 0 } as any, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() },
  byId: { data: null as any, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() },
  mutate: vi.fn(), mutateAsync: vi.fn(),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/clientes", vi.fn()], useParams: () => ({ id: "900" }) }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ clientes: { list: { invalidate: vi.fn() }, byId: { invalidate: vi.fn() } } }),
  clientes: {
    list: { useQuery: () => mocks.list }, byId: { useQuery: () => mocks.byId },
    contratosByCliente: { useQuery: () => ({ data: [] }) },
    create: { useMutation: () => ({ mutate: mocks.mutate, mutateAsync: mocks.mutateAsync }) },
    update: { useMutation: () => ({ mutate: mocks.mutate }) },
    deletar: { useMutation: () => ({ mutate: mocks.mutate }) },
    updateDocumentos: { useMutation: () => ({ mutateAsync: mocks.mutateAsync }) },
  },
  parcelas: { list: { useQuery: () => ({ data: [] }) } },
} }));
import Clientes from "./Clientes";
import ClienteDetalhe from "./ClienteDetalhe";

const source = readFileSync(new URL("./Clientes.tsx", import.meta.url), "utf8");
// Executa o handler do arquivo real: não replica sua lógica nos testes.
function salvar(editar: boolean, overrides: Record<string, any> = {}) {
  const ast = ts.createSourceFile("Clientes.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "handleSalvar") handler = node.initializer!.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!handler) throw new Error("handleSalvar não localizado no arquivo real");
  const state: Record<string, any> = {
    isEdit: editar, nome: "Cliente Sintético", cpf: "", cnpj: "", rg: "", email: "", telefone: "",
    instagram: "", facebook: "", profissao: "", tipoCliente: "emprestimo", isReferral: false,
    ativo: false, observacoes: "", fotoUrl: "", documentos: [], cep: "", endereco: "", numero: "",
    complemento: "", bairro: "", cidade: "", estado: "", clienteEditar: { id: 900 },
    clienteCreateInput, clienteUpdateInput, clienteTextoOpcional, t: (key: string) => key,
    setAba: vi.fn(), toast: { error: vi.fn() },
    updateMutation: { mutate: vi.fn() }, createMutation: { mutate: vi.fn() }, ...overrides,
  };
  const js = ts.transpileModule(`const handler = ${handler};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function(...Object.keys(state), `${js}; handler();`)(...Object.values(state));
  return state;
}

const ast = ts.createSourceFile("Clientes.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function funcaoReal(nome: string) {
  let codigo = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === nome) codigo = node.getText(ast).replace(/^export default\s+/, "");
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!codigo) throw new Error(`${nome} não localizado no arquivo real`);
  return codigo;
}
function executarReal(codigo: string, contexto: Record<string, any>) {
  const js = ts.transpileModule(`const real = (${codigo});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  return new Function(...Object.keys(contexto), `${js}; return real;`)(...Object.values(contexto));
}
// Hooks persistentes por instância: executa o JSX e os effects reais sem browser.
function componenteReal(nome: string, contexto: Record<string, any> = {}) {
  const valores: any[] = [];
  const depsAnteriores: any[][] = [];
  let indice = 0;
  let efeitos: (() => void)[] = [];
  const componentes: Record<string, string> = {};
  function visit(node: ts.Node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) {
      componentes[node.tagName.text] = node.tagName.text;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const real = executarReal(funcaoReal(nome), {
    ...componentes, React,
    useState: (inicial: any) => {
      const slot = indice++;
      if (!(slot in valores)) valores[slot] = typeof inicial === "function" ? inicial() : inicial;
      return [valores[slot], (valor: any) => { valores[slot] = typeof valor === "function" ? valor(valores[slot]) : valor; }];
    },
    useRef: (inicial: any) => {
      const slot = indice++;
      if (!(slot in valores)) valores[slot] = { current: inicial };
      return valores[slot];
    },
    useEffect: (effect: () => void, deps: any[]) => {
      const slot = indice++;
      if (!depsAnteriores[slot] || deps.some((dep, i) => !Object.is(dep, depsAnteriores[slot][i]))) efeitos.push(effect);
      depsAnteriores[slot] = deps;
    },
    useTranslation: () => ({ t: (key: string) => key }), useLocation: () => ["/clientes", vi.fn()],
    trpc: {
      useUtils: () => ({ clientes: { list: { invalidate: vi.fn() } } }),
      clientes: {
        list: { useQuery: () => mocks.list },
        create: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
        update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        deletar: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
    },
    clienteCreateInput, clienteUpdateInput, clienteTextoOpcional, clienteCorrespondeBusca,
    getInitials: () => "CL", getAvatarColor: () => "bg-green-500", toast: { error: vi.fn(), success: vi.fn() },
    ...contexto,
  });
  return (props: Record<string, any> = {}) => {
    indice = 0; efeitos = [];
    const tree = real(props);
    efeitos.forEach(effect => effect());
    return tree;
  };
}
function elementos(tree: any): any[] {
  if (Array.isArray(tree)) return tree.flatMap(elementos);
  if (!React.isValidElement(tree)) return [];
  return [tree, ...elementos((tree.props as any).children)];
}
function elemento(tree: any, tipo: string, filtro: (props: any) => boolean = () => true) {
  const encontrado = elementos(tree).find(node => node.type === tipo && filtro(node.props));
  if (!encontrado) throw new Error(`Elemento ${tipo} não encontrado`);
  return encontrado;
}
function botaoHTML(html: string, texto: string) {
  const botao = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find(button => button.includes(texto));
  if (!botao) throw new Error(`Botão ${texto} não encontrado`);
  return botao;
}
function importador(overrides: Record<string, any> = {}) {
  const state = {
    isError: false, isLoading: false, importando: false, importandoRef: { current: false },
    setImportando: vi.fn(), setImportResultado: vi.fn(),
    t: (key: string) => key, toast: { error: vi.fn() },
    createClienteMutation: { mutateAsync: vi.fn().mockResolvedValue({ id: 901 }) }, ...overrides,
  };
  return { state, processar: executarReal(funcaoReal("processarCSV"), state) };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Vitest local usa transformação JSX clássica, diferente do plugin Vite da aplicação.
  vi.stubGlobal("React", React);
  Object.assign(mocks.list, { data: { clientes: [], total: 0 }, isLoading: false, isError: false, isFetching: false });
  Object.assign(mocks.byId, { data: null, isLoading: false, isError: false, isFetching: false });
});

describe("clientes operacional — formulário real", () => {
  it("edição envia opcionais vazios explicitamente e ativo=false", () => {
    const clienteEditar: Record<string, any> = { id: 900, nome: "Nome Anterior", ativo: true };
    for (const key of ["cpfCnpj", "cnpj", "rg", "email", "telefone", "instagram", "facebook", "profissao", "observacoes", "fotoUrl", "cep", "endereco", "numero", "complemento", "bairro", "cidade", "estado"]) clienteEditar[key] = "Valor Anterior";
    const state = salvar(true, { clienteEditar });
    const payload = state.updateMutation.mutate.mock.calls[0][0];
    expect(payload).toMatchObject({ id: 900, ativo: false, documentosUrls: "[]" });
    for (const field of ["cpfCnpj", "cnpj", "rg", "email", "telefone", "instagram", "facebook", "profissao", "observacoes", "fotoUrl", "cep", "endereco", "numero", "complemento", "bairro", "cidade", "estado"]) {
      expect(payload).toHaveProperty(field, "");
    }
    expect(state.createMutation.mutate).not.toHaveBeenCalled();
  });
  it("editar nome não exige limpar CPF, telefone e UF legados intocados", () => {
    const state = salvar(true, { cpf: "123", telefone: "11", estado: "ZZ", clienteEditar: { id: 900, nome: "Nome Anterior", cpfCnpj: "123", telefone: "11", estado: "ZZ" } });
    const payload = state.updateMutation.mutate.mock.calls[0][0];
    expect(payload.nome).toBe("Cliente Sintético");
    expect(payload).not.toHaveProperty("cpfCnpj");
    expect(payload).not.toHaveProperty("telefone");
    expect(payload).not.toHaveProperty("estado");
    expect(state.toast.error).not.toHaveBeenCalled();
  });
  it("campo legado alterado para tamanho inválido continua rejeitado", () => {
    const state = salvar(true, { cpf: "12", clienteEditar: { id: 900, cpfCnpj: "123" } });
    expect(state.updateMutation.mutate).not.toHaveBeenCalled();
    expect(state.toast.error).toHaveBeenCalled();
  });
  it.each([true, false])("novo cliente ativo=%s e CPF opcional", ativo => {
    const state = salvar(false, { ativo });
    expect(state.createMutation.mutate.mock.calls[0][0]).toMatchObject({ ativo, nome: "Cliente Sintético" });
    expect(state.createMutation.mutate.mock.calls[0][0].cpfCnpj).toBeUndefined();
    expect(state.updateMutation.mutate).not.toHaveBeenCalled();
  });
  it.each([
    { nome: "   " }, { nome: "X" }, { cpf: "123" }, { telefone: "11" }, { estado: "ZZ" },
    { cpf: "52998224724" }, { cpf: "11111111111" }, { cpf: "abc52998224725" },
  ])("não faz mutation para input inválido %j", invalid => {
    const state = salvar(false, invalid);
    expect(state.createMutation.mutate).not.toHaveBeenCalled();
    expect(state.updateMutation.mutate).not.toHaveBeenCalled();
    expect(state.toast.error).toHaveBeenCalled();
  });
  it("aceita CPF verificado com máscara e UF minúscula", () => {
    const state = salvar(false, { cpf: "529.982.247-25", telefone: "(11) 91234-5678", estado: "sp" });
    expect(state.createMutation.mutate).toHaveBeenCalledOnce();
  });
});

describe("clientes operacional — busca compartilhada usada na UI", () => {
  const masked = { nome: "Pessoa Sintética", cpfCnpj: "123.456.789-00", telefone: "(11) 91234-5678" };
  it.each(["12345678900", "123.456.789-00", "456789", "11912345678", "(11) 91234-5678", "91234-5678", " PESSOA ", ""])("encontra busca %s", busca => {
    expect(clienteCorrespondeBusca(masked, busca)).toBe(true);
  });
  it("máscara encontra registro sem máscara", () => {
    expect(clienteCorrespondeBusca({ cpfCnpj: "12345678900" }, "123.456.789-00")).toBe(true);
    expect(clienteCorrespondeBusca({ telefone: "11912345678" }, "(11) 91234-5678")).toBe(true);
  });
  it.each(["???", "999999", "Pessoa 123", "Inexistente"])("não retorna falso positivo %s", busca => {
    expect(clienteCorrespondeBusca(masked, busca)).toBe(false);
  });
  it("não altera registros existentes", () => {
    const snapshot = { ...masked }; clienteCorrespondeBusca(masked, "12345678900");
    expect(masked).toEqual(snapshot);
  });
});

describe("clientes operacional — criação independente da listagem", () => {
  it.each([
    { isLoading: true, isError: false },
    { isLoading: false, isError: true },
    { isLoading: true, isError: true },
  ])("handlers abrem cadastro e importação durante %j", status => {
    Object.assign(mocks.list, status);
    const render = componenteReal("Clientes");
    const tree = render();
    const novo = elemento(tree, "Button", props => elementos(props.children).some(node => node.type === "Plus"));
    const importar = elemento(tree, "Button", props => elementos(props.children).some(node => node.type === "Upload"));
    expect(novo.props.disabled).not.toBe(true);
    expect(importar.props.disabled).not.toBe(true);
    novo.props.onClick(); importar.props.onClick();
    const aberto = render();
    expect(elemento(aberto, "NovoClienteModal").props.open).toBe(true);
    expect(elemento(aberto, "Dialog", props => elementos(props.children).some(node => node.type === "DialogTitle" && node.props.children === "Importar Clientes via CSV")).props.open).toBe(true);
  });

  it("erro de refetch não fecha modais nem apaga rascunho já preenchido", () => {
    const pagina = componenteReal("Clientes");
    let tree = pagina();
    elemento(tree, "Button", props => elementos(props.children).some(node => node.type === "Plus")).props.onClick();
    elemento(tree, "Button", props => elementos(props.children).some(node => node.type === "Upload")).props.onClick();
    tree = pagina();
    const modal = componenteReal("NovoClienteModal");
    modal(elemento(tree, "NovoClienteModal").props);
    let form = modal(elemento(tree, "NovoClienteModal").props);
    elemento(form, "Input", props => props.placeholder === "Nome completo").props.onChange({ target: { value: "Rascunho Sintético" } });
    mocks.list.isError = true;
    mocks.list.data = { clientes: [{ id: 900, nome: "Cache Antigo" }], total: 1 };
    tree = pagina();
    const props = elemento(tree, "NovoClienteModal").props;
    expect(props.open).toBe(true);
    modal(props); form = modal(props); // Detecta também eventual reset por effect ao mudar open.
    expect(elemento(form, "Input", props => props.placeholder === "Nome completo").props.value).toBe("Rascunho Sintético");
    expect(elemento(tree, "Dialog", props => elementos(props.children).some(node => node.type === "DialogTitle" && node.props.children === "Importar Clientes via CSV")).props.open).toBe(true);
  });

  function cadastroComListaEmErro() {
    mocks.list.isError = true;
    const toast = { success: vi.fn(), error: vi.fn() };
    const invalidate = vi.fn();
    let callbacks: any;
    const create = { mutate: vi.fn(), isPending: false };
    const trpc = {
      useUtils: () => ({ clientes: { list: { invalidate } } }),
      clientes: {
        list: { useQuery: () => mocks.list },
        create: { useMutation: (options: any) => { if (options.onSuccess) callbacks = options; return create; } },
        update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        deletar: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
    };
    const pagina = componenteReal("Clientes", { trpc });
    const tree = pagina();
    elemento(tree, "Button", props => elementos(props.children).some(node => node.type === "Plus")).props.onClick();
    const props = elemento(pagina(), "NovoClienteModal").props;
    const modal = componenteReal("NovoClienteModal", { trpc, toast });
    modal(props);
    let form = modal(props);
    elemento(form, "Input", props => props.placeholder === "Nome completo").props.onChange({ target: { value: "Cadastro Sintético" } });
    for (let i = 0; i < 2; i++) {
      form = modal(props);
      elemento(form, "Button", props => props.children === "Próximo →").props.onClick();
    }
    form = modal(props);
    elemento(form, "Button", props => props.children === "clients.conclude").props.onClick();
    return { pagina, modal, props, toast, invalidate, create, callbacks: () => callbacks };
  }

  it("CREATE com lista em erro envia cadastro e só confirma após resposta de INSERT bem-sucedida", () => {
    const flow = cadastroComListaEmErro();
    expect(flow.create.mutate).toHaveBeenCalledOnce();
    expect(flow.create.mutate.mock.calls[0][0]).toMatchObject({ nome: "Cadastro Sintético" });
    expect(flow.toast.success).not.toHaveBeenCalled();
    expect(flow.invalidate).not.toHaveBeenCalled();
    expect(elemento(flow.pagina(), "NovoClienteModal").props.open).toBe(true);
    flow.callbacks().onSuccess({ id: 901 }); // Resposta simulada da mutation, sem DB/serviços.
    expect(flow.toast.success).toHaveBeenCalledWith("toast.clientCreated");
    expect(flow.invalidate).toHaveBeenCalledOnce();
    expect(elemento(flow.pagina(), "NovoClienteModal").props.open).toBe(false);
    expect(mocks.list.isError).toBe(true);
  });

  it("falha CREATE não confirma nem fecha cadastro e preserva o rascunho", () => {
    const flow = cadastroComListaEmErro();
    flow.callbacks().onError(new Error("INSERT recusado"));
    expect(flow.toast.error).toHaveBeenCalledWith("toast.errorPrefixINSERT recusado");
    expect(flow.toast.success).not.toHaveBeenCalled();
    expect(flow.invalidate).not.toHaveBeenCalled();
    const props = elemento(flow.pagina(), "NovoClienteModal").props;
    expect(props.open).toBe(true);
    const form = flow.modal(props);
    elemento(form, "Button", props => props.children === "← Voltar").props.onClick();
    elemento(flow.modal(props), "Button", props => props.children === "← Voltar").props.onClick();
    expect(elemento(flow.modal(props), "Input", props => props.placeholder === "Nome completo").props.value).toBe("Cadastro Sintético");
  });

  it("mutation própria pendente continua bloqueando concluir", () => {
    const flow = cadastroComListaEmErro();
    flow.create.isPending = true;
    expect(elemento(flow.modal(flow.props), "Button", props => props.children === "common.saving").props.disabled).toBe(true);
  });
});

describe("clientes operacional — importação independente da listagem", () => {
  it.each([
    { isLoading: true, isError: false },
    { isLoading: false, isError: true },
    { isLoading: true, isError: true },
  ])("processa CSV pelo handler real durante %j", status => {
    const { state, processar } = importador(status);
    return processar({ text: async () => "nome\nCliente CSV" }).then(() => {
      expect(state.createClienteMutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ nome: "Cliente CSV" }));
      expect(state.setImportResultado).toHaveBeenCalledWith({ ok: 1, erros: 0, mensagens: [] });
      expect(state.importandoRef.current).toBe(false);
      expect(state.setImportando).toHaveBeenLastCalledWith(false);
      expect(state.toast.error).not.toHaveBeenCalled();
    });
  });
  it("CREATE recusado na importação é erro, não falso sucesso", async () => {
    const { state, processar } = importador({ isError: true, createClienteMutation: { mutateAsync: vi.fn().mockRejectedValue(new Error("Cadastro recusado")) } });
    await processar({ text: async () => "nome\nCliente CSV" });
    expect(state.setImportResultado).toHaveBeenCalledWith({ ok: 0, erros: 1, mensagens: ["Linha 2 (Cliente CSV): Cadastro recusado"] });
    expect(state.importandoRef.current).toBe(false);
  });
  it("guard importando impede novo processamento", async () => {
    const { state, processar } = importador({ importando: true });
    const file = { text: vi.fn().mockResolvedValue("nome\nCliente CSV") };
    await processar(file);
    expect(file.text).not.toHaveBeenCalled();
    expect(state.createClienteMutation.mutateAsync).not.toHaveBeenCalled();
  });
  it("ref síncrono impede importação dupla antes do próximo render e libera ao terminar", async () => {
    let concluir!: (texto: string) => void;
    const file = { text: vi.fn(() => new Promise<string>(resolve => { concluir = resolve; })) };
    const { state, processar } = importador();
    const primeira = processar(file);
    await processar(file);
    expect(file.text).toHaveBeenCalledOnce();
    expect(state.importandoRef.current).toBe(true);
    concluir("nome\nCliente CSV");
    await primeira;
    expect(state.createClienteMutation.mutateAsync).toHaveBeenCalledOnce();
    expect(state.importandoRef.current).toBe(false);
    await processar({ text: async () => "nome\nOutro Cliente CSV" });
    expect(state.createClienteMutation.mutateAsync).toHaveBeenCalledTimes(2);
  });
  it.each(["nome", "telefone\n11912345678"])("CSV inválido continua rejeitado e libera o guard: %s", async texto => {
    const { state, processar } = importador({ isError: true });
    await processar({ text: async () => texto });
    expect(state.createClienteMutation.mutateAsync).not.toHaveBeenCalled();
    expect(state.toast.error).toHaveBeenCalledOnce();
    expect(state.importandoRef.current).toBe(false);
  });
});

describe("clientes operacional — SSR sem browser, sem serviços ou mutation", () => {
  it("lista em erro mostra retry, não base vazia nem convite de primeiro cadastro", () => {
    mocks.list.isError = true;
    const html = renderToStaticMarkup(createElement(Clientes));
    expect(html).toContain("Não foi possível carregar os clientes");
    expect(html).toContain("Tentar novamente");
    expect(html).not.toContain("clients.noClientsFound");
    expect(html).not.toContain("clients.registerFirstClient");
    expect(botaoHTML(html, "clients.newClient")).not.toContain('disabled=""');
    expect(botaoHTML(html, "clients.importCSV")).not.toContain('disabled=""');
    expect(botaoHTML(html, "clients.exportCSV")).toContain('disabled=""');
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });
  it("lista vazia bem-sucedida preserva convite de cadastro", () => {
    const html = renderToStaticMarkup(createElement(Clientes));
    expect(html).toContain("clients.noClientsFound");
    expect(html).toContain("clients.registerFirstClient");
    expect(html).not.toContain("Não foi possível carregar os clientes");
  });
  it("erro de refetch com cache não exibe registros como atuais", () => {
    mocks.list.isError = true;
    mocks.list.data = { clientes: [{ id: 900, nome: "Registro do Cache" }], total: 1 };
    const html = renderToStaticMarkup(createElement(Clientes));
    expect(html).not.toContain("Registro do Cache");
    expect(html).toContain("Consulta indisponível");
  });
  it("carregando não é vazio", () => {
    mocks.list.isLoading = true;
    const html = renderToStaticMarkup(createElement(Clientes));
    expect(html).toContain("clients.loadingClients");
    expect(html).not.toContain("clients.noClientsFound");
    expect(botaoHTML(html, "clients.newClient")).not.toContain('disabled=""');
    expect(botaoHTML(html, "clients.importCSV")).not.toContain('disabled=""');
    expect(botaoHTML(html, "clients.exportCSV")).toContain('disabled=""');
  });
  it("ficha em erro mostra retry, não não-encontrado, sem ações de criação", () => {
    mocks.byId.isError = true;
    const html = renderToStaticMarkup(createElement(ClienteDetalhe));
    expect(html).toContain("Não foi possível carregar o cliente");
    expect(html).toContain("Tentar novamente");
    expect(html).not.toContain("common.clientNotFound");
    expect(html).not.toContain("Novo Contrato");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("ausência legítima da ficha continua não-encontrado", () => {
    const html = renderToStaticMarkup(createElement(ClienteDetalhe));
    expect(html).toContain("common.clientNotFound");
    expect(html).not.toContain("Não foi possível carregar o cliente");
  });
  it("retry em andamento deixa o botão indisponível", () => {
    mocks.byId.isError = true; mocks.byId.isFetching = true;
    const html = renderToStaticMarkup(createElement(ClienteDetalhe));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Tentando novamente/);
  });
  it("retry está ligado apenas a refetch nas duas páginas", () => {
    const detalhe = readFileSync(new URL("./ClienteDetalhe.tsx", import.meta.url), "utf8");
    for (const text of [source, detalhe]) expect(text).toContain("onClick={() => void refetch()}");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
