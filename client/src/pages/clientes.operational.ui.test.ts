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

describe("clientes operacional — SSR sem browser, sem serviços ou mutation", () => {
  it("lista em erro mostra retry, não base vazia nem convite de primeiro cadastro", () => {
    mocks.list.isError = true;
    const html = renderToStaticMarkup(createElement(Clientes));
    expect(html).toContain("Não foi possível carregar os clientes");
    expect(html).toContain("Tentar novamente");
    expect(html).not.toContain("clients.noClientsFound");
    expect(html).not.toContain("clients.registerFirstClient");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?clients.newClient/);
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
