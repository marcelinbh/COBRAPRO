// @vitest-environment node
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nodes, source } from '../lib/r1BoundaryHarness';
import { HASHES_ACOES_LISTA62 } from '../lib/acoesListaEmprestimo62';
import type { ListaSeguraEmprestimos } from '../../../shared/emprestimosListaSegura';

const queries = vi.hoisted(() => ({ auth: vi.fn(), safe: vi.fn() }));
vi.mock('../lib/trpc', () => ({ trpc: { auth: { me: { useQuery: queries.auth } }, contratos: { listLeituraSegura: { useQuery: queries.safe } }, useUtils: () => ({ client: {} }), cobrancaLista64: { enviar: { useMutation: () => ({ mutateAsync: vi.fn() }) } } } }));
import { EmprestimosListaSegura } from './EmprestimosListaSegura';
import { EmprestimosListaSeguraFallback } from './EmprestimosListaSeguraFallback';
const data: ListaSeguraEmprestimos = {
  version: 'loan_list_read_v1', userId: 41,
  items: [{ kind: 'validated', id: 31, clienteId: 7, clienteNome: 'Cliente confirmado', modalidade: 'mensal', status: 'ativo', statusFinanceiroOriginal: 'ativo', statusObrigacao: 'ativo', arquivado: false, obrigacaoAtual: '120.00', obrigacaoAdicional: '0.00', capital: 100, totalReceber: 120, totalPago: 0 },
    { kind: 'unavailable', id: 42, message: 'Empréstimo indisponível: vínculos não confirmados.' }],
  coverage: { scopedContracts: 2, validatedContracts: 1, unavailableContracts: 1, complete: false, label: 'validados somente' },
  totals: { label: 'validados somente', values: { capital: 100, totalReceber: 120, totalPago: 0 } }, warning: null,
};
const settled = { isFetching: false, isPending: false, isLoading: false, isError: false };
const renderFallback = () => renderToStaticMarkup(React.createElement(EmprestimosListaSeguraFallback));
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
beforeEach(() => {
  vi.clearAllMocks();
  queries.auth.mockReturnValue({ ...settled, data: { id: 41 } });
  queries.safe.mockReturnValue({ ...settled, data, refetch: vi.fn() });
});

describe('Lista62: links reais SSR somente no snapshot validated', () => {
  it('mantém ficha simples e quatro destinos sem payload financeiro; usa estilo neutro/focus e wrap', () => {
    const onRefresh = vi.fn(), before = JSON.stringify(data);
    const html = renderToStaticMarkup(React.createElement(EmprestimosListaSegura, { data, onRefresh }));
    expect(hrefs(html)).toEqual(['/emprestimos/31', ...HASHES_ACOES_LISTA62.map(hash => `/emprestimos/31${hash}`)]);
    for (const label of ['Receber / conferir', 'Editar obrigação', 'Reparcelar', 'Cancelar / arquivar']) expect(html).toContain(label);
    const nav = html.split('<nav')[1].split('</nav>')[0];
    expect(nav).toContain('flex flex-wrap');
    expect(nav.match(/focus-visible:ring-2/g)).toHaveLength(4);
    expect(nav.match(/border-border/g)).toHaveLength(4);
    expect(nav.match(/bg-background/g)).toHaveLength(4);
    expect(nav).not.toMatch(/bg-(?:red|green|emerald)|\?|owner|parcelaId|contaCaixaId|UUID/);
    expect(html).toContain('Buscar por cliente'); expect(html).toContain('Estado da obrigação');
    expect(html).toContain('2 no escopo; 1 validados; 1 indisponíveis');
    expect(onRefresh).not.toHaveBeenCalled(); expect(JSON.stringify(data)).toBe(before);
  });
  it('placeholder não tem links, botão, nome ou valores e nunca ganha quatro ações', () => {
    const html = renderToStaticMarkup(React.createElement(EmprestimosListaSegura, { data, onRefresh: vi.fn() }));
    const placeholder = html.split('aria-label="Empréstimo 42 indisponível"')[1].split('</article>')[0];
    expect(placeholder).toContain('Empréstimo #42');
    expect(placeholder).not.toMatch(/href=|<nav|<button|Cliente confirmado|R\$|receber-conferir|editar-obrigacao|cancelar-arquivar/);
    expect(hrefs(html).some(href => href.startsWith('/emprestimos/42'))).toBe(false);
  });
  it.each([{ data: null }, { data: undefined }, { isFetching: true }, { isPending: true }, { isLoading: true }, { isError: true }])('auth não assentada %j oculta ações sem montar query segura', flags => {
    queries.auth.mockReturnValue({ ...settled, data: { id: 41 }, ...flags });
    const html = renderFallback();
    expect(hrefs(html)).toEqual(['/contratos/novo']);
    expect(html).not.toContain('Cliente confirmado'); expect(queries.safe).not.toHaveBeenCalled();
  });
  it.each([{ data: null }, { data: undefined }, { isFetching: true }, { isPending: true }, { isLoading: true }, { isError: true }, { data: { ...data, userId: 99 } }])('safe não assentada / owner divergente %j nunca publica destinos antigos', flags => {
    queries.safe.mockReturnValue({ ...settled, data, ...flags });
    expect(hrefs(renderFallback())).toEqual(['/contratos/novo']);
    expect(queries.safe).toHaveBeenLastCalledWith(undefined, { enabled: true, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always' });
  });
  it('fallback saudável usa auth/query existentes e expõe somente contrato nos links', () => {
    const html = renderFallback();
    expect(hrefs(html)).toEqual(['/contratos/novo', '/emprestimos/31', ...HASHES_ACOES_LISTA62.map(hash => `/emprestimos/31${hash}`)]);
    expect(queries.auth).toHaveBeenLastCalledWith(undefined, { retry: false, staleTime: 0 });
    expect(queries.safe).toHaveBeenCalledTimes(1);
  });
  it('AST: os quatro anchors pertencem exclusivamente ao ramo validated e não possuem handlers', () => {
    const ast = source('components/EmprestimosListaSegura.tsx');
    const conditional = nodes(ast, n => ts.isConditionalExpression(n) && n.condition.getText(ast) === "item.kind === 'unavailable'")[0] as ts.ConditionalExpression;
    expect(conditional).toBeDefined();
    const anchors = nodes(conditional.whenFalse, n => ts.isJsxElement(n) && n.openingElement.tagName.getText(ast) === 'a') as ts.JsxElement[];
    expect(anchors).toHaveLength(5);
    expect(nodes(conditional.whenTrue, n => ts.isJsxElement(n) && ['a', 'nav', 'button'].includes(n.openingElement.tagName.getText(ast)))).toHaveLength(0);
    for (const anchor of anchors) expect(anchor.openingElement.attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'onClick')).toBe(false);
    expect(ast.getText()).not.toMatch(/useMutation|\.click\(|mutate|storage|randomUUID|cotar|conferir\.query/);
  });
});
