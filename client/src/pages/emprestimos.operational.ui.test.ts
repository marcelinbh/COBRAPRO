import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ query: {} as any, mutate: vi.fn(), navigate: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "pt" } }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/emprestimos", h.navigate], useParams: () => ({ id: '31' }) }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => new Proxy({}, { get: () => ({ invalidate: vi.fn() }) }),
  contratos: { listComParcelas: { useQuery: () => h.query }, obterDetalhes: { useQuery: () => h.query }, editarJuros: { useMutation: () => ({ mutate: h.mutate }) }, aplicarMulta: { useMutation: () => ({ mutate: h.mutate }) } },
  parcelas: new Proxy({}, { get: () => ({ useMutation: () => ({ mutate: h.mutate }) }) }),
  configuracoes: { get: { useQuery: () => ({ data: {} }) } },
  caixa: { contas: { useQuery: () => ({ data: [] }) } },
  cobradores: { list: { useQuery: () => ({ data: [] }) } },
  whatsapp: { recebimentos: { useQuery: () => ({ data: undefined }) }, cobrarLote: { useMutation: () => ({ mutate: h.mutate }) } },
} }));
import Emprestimos from "./Emprestimos";
import EmprestimoDetalhes from "./EmprestimoDetalhes";
const source = readFileSync(new URL("./Emprestimos.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("Emprestimos.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function nodesWhere(root: ts.Node, predicate: (n: ts.Node) => boolean) {
  const results: ts.Node[] = [];
  function walk(n: ts.Node) { if (predicate(n)) results.push(n); ts.forEachChild(n, walk); }
  walk(root); return results;
}
const card = nodesWhere(ast, n => ts.isFunctionDeclaration(n) && n.name?.getText(ast) === "EmprestimoCardCobra")[0];
function clickCardButton(fragment: string) {
  const button = nodesWhere(card, n => ts.isJsxElement(n) && n.openingElement.tagName.getText(ast) === "Button" && n.getText(ast).includes(fragment))[0] as ts.JsxElement;
  expect(button).toBeDefined();
  const attr = button.openingElement.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(ast) === "onClick") as ts.JsxAttribute;
  const expr = (attr.initializer as ts.JsxExpression).expression!.getText(ast);
  new Function("setLocation", "emp", `return (${expr})();`)(h.navigate, { id: 31 });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("React", React);
  h.query = { data: [], isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
});
afterEach(() => vi.unstubAllGlobals());
describe("Empréstimos: novo cadastro independente da leitura e entrada segura de pagamentos", () => {
  it.each([{ isError: true }, { isLoading: true }, { isLoading: true, isError: true }])("Novo permanece acessível durante falha/carregamento %j", flags => {
    Object.assign(h.query, flags);
    const html = renderToStaticMarkup(React.createElement(Emprestimos));
    expect(html).toContain("Novo empréstimo");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Novo empréstimo/);
    expect(html).not.toContain("Nenhum empréstimo encontrado"); expect(h.mutate).not.toHaveBeenCalled();
  });
  it("refetch em erro não apresenta cache, saldo zero ou sugestão de recriar dívida", () => {
    h.query.isError = true;
    h.query.data = [{ ...{ id: 1, clienteId: 2, clienteNome: "Cache antigo não apresentar", valorPrincipal: "999999.00", totalReceber: 999999, parcelasComAtraso: [], modalidade: "mensal" } }];
    const html = renderToStaticMarkup(React.createElement(Emprestimos));
    expect(html).toContain("Tentar novamente"); expect(html).toContain("Não cadastre novamente uma dívida já existente");
    expect(html).not.toContain("Cache antigo não apresentar"); expect(html).not.toContain("999.999");
  });
  it("vazio confirmado continua vazio sem erro inventado", () => {
    const html = renderToStaticMarkup(React.createElement(Emprestimos));
    expect(html).toContain("Nenhum empréstimo encontrado"); expect(html).not.toContain("Não foi possível carregar os empréstimos");
  });
  it.each(["t('loans.pay')", "Receber / renovar", "t('loans.details')", "t('loanDetails.editLoan')"])("handler real %s abre a ficha de origem e não faz pagamento antigo", fragment => {
    clickCardButton(fragment);
    expect(h.navigate).toHaveBeenCalledWith("/emprestimos/31"); expect(h.mutate).not.toHaveBeenCalled();
  });
  it("nenhum card monta PagamentoModal ou EditarEmprestimoModal mesmo em modo pasta", () => {
    const mounted = nodesWhere(card, n => (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && ["PagamentoModal", "EditarEmprestimoModal"].includes(n.tagName.getText(ast)));
    expect(mounted).toHaveLength(0);
    expect(source).toContain("{grupo.emprestimos.map(emp => (");
  });
});

describe('Ficha: falha não apaga contrato nem apresenta cache como certificado', () => {
  it.each([undefined, { id: 31, clienteNome: 'Nome do cache não mostrar' }])('erro de leitura com data %j é recuperável e não vira não encontrado', data => {
    Object.assign(h.query, { data, isError: true });
    const html = renderToStaticMarkup(React.createElement(EmprestimoDetalhes));
    expect(html).toContain('Não foi possível carregar a ficha'); expect(html).toContain('Tentar novamente');
    expect(html).not.toContain('loanDetails.loanNotFound'); expect(html).not.toContain('Nome do cache não mostrar'); expect(h.mutate).not.toHaveBeenCalled();
  });
  it('ausência confirmada mantém mensagem de não encontrado', () => {
    h.query.data = null;
    const html = renderToStaticMarkup(React.createElement(EmprestimoDetalhes));
    expect(html).toContain('loanDetails.loanNotFound'); expect(html).not.toContain('Não foi possível carregar a ficha');
  });
});
