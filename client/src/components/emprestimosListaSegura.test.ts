import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const query = vi.hoisted(() => ({ useQuery: vi.fn(), auth: vi.fn() }));
vi.mock('../lib/trpc', () => ({ trpc: { auth: { me: { useQuery: query.auth } }, contratos: { listLeituraSegura: query } } }));
import { EmprestimosListaSegura } from './EmprestimosListaSegura';
import { EmprestimosListaSeguraFallback } from './EmprestimosListaSeguraFallback';
import { AVISO_LISTA_INCOMPLETA, deveUsarListaSegura, type ListaSeguraEmprestimos } from '../../../shared/emprestimosListaSegura';
const partial: ListaSeguraEmprestimos = { version: 'loan_list_read_v1', userId: 41, items: [{ kind: 'validated', id: 1, clienteId: 2, clienteNome: 'Cliente próprio <script>alert(1)</script>', modalidade: 'mensal', status: 'ativo', capital: 100, totalReceber: 80, totalPago: 20 }, { kind: 'unavailable', id: 42, message: 'Empréstimo indisponível: não foi possível confirmar seus vínculos.' }], coverage: { scopedContracts: 2, validatedContracts: 1, unavailableContracts: 1, complete: false, label: 'validados somente' }, totals: { label: 'validados somente', values: { capital: 100, totalReceber: 80, totalPago: 20 } }, warning: AVISO_LISTA_INCOMPLETA };
const render = (data: ListaSeguraEmprestimos) => renderToStaticMarkup(React.createElement(EmprestimosListaSegura, { data, onRefresh: () => {} }));
beforeEach(() => { vi.clearAllMocks(); query.auth.mockReturnValue({ data: { id: 41 }, isFetching: false, isError: false, isPending: false, isLoading: false }); });
describe('Fallback local da lista, sem estado financeiro autorizado', () => {
  it.each([null, undefined, {}, { code: 'PRECONDITION_FAILED' }, { data: { code: 'INTERNAL_SERVER_ERROR' } }, { data: { code: 'UNAUTHORIZED' } }, { data: { code: 'NOT_FOUND' } }, { status: 412 }, { status: 207 }])('não ativa por objeto/status não tRPC %j', value => expect(deveUsarListaSegura(value)).toBe(false));
  it('ativa SOMENTE pelo código tRPC 412 mesmo em batch207', () => { expect(deveUsarListaSegura({ data: { code: 'PRECONDITION_FAILED', httpStatus: 412 }, status: 207 })).toBe(true); });
  it('partial explícito, placeholder sem nome/contato/valor/link/ações, nome validado escapado', () => {
    const html = render(partial); expect(html).toContain('validados somente'); expect(html).toContain('não representam toda a carteira'); expect(html).toContain('Relatórios desta consulta são incompletos'); expect(html).not.toContain('<script>');
    const placeholder = html.split('aria-label="Empréstimo 42 indisponível"')[1].split('</article>')[0]; expect(placeholder).toContain('Empréstimo #42'); expect(placeholder).not.toMatch(/Cliente próprio|R\$|href=|button|telefone|wa\.me/);
    expect(html).not.toMatch(/contratos\/novo|Pagar|useMutation|Baixar relatório/);
  });
  it('nenhum validado não mostra zeros fictícios', () => {
    const html = render({ ...partial, items: [partial.items[1]], coverage: { ...partial.coverage, scopedContracts: 1, validatedContracts: 0 }, totals: { label: 'validados somente', values: null } });
    expect(html).toContain('Valores indisponíveis'); expect(html).not.toContain('R$');
  });
  it('empty confirmado tem texto próprio e não aviso parcial', () => {
    const html = render({ ...partial, items: [], coverage: { ...partial.coverage, scopedContracts: 0, validatedContracts: 0, unavailableContracts: 0, complete: true }, totals: { label: 'validados somente', values: { capital: 0, totalReceber: 0, totalPago: 0 } }, warning: null });
    expect(html).toContain('Nenhum empréstimo no escopo confirmado.'); expect(html).not.toContain('Consulta parcial:');
  });
  it.each(['error', 'pending', 'fetching', 'absent'])('query segura %s não renderiza cache obsoleto nem zeros', state => {
    query.useQuery.mockReturnValue({ data: state === 'absent' ? undefined : partial, isError: state === 'error', isPending: state === 'pending', isFetching: state === 'fetching', refetch: vi.fn() });
    const html = renderToStaticMarkup(React.createElement(EmprestimosListaSeguraFallback, { onRetryStrict: () => {}, isRetryingStrict: false }));
    expect(html).not.toContain('Cliente próprio'); expect(html).not.toContain('R$'); expect(html).toContain('href="/contratos/novo"'); expect(html).toContain('Novo empréstimo');
    expect(query.useQuery).toHaveBeenLastCalledWith(undefined, { enabled: true, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always' });
  });
  it('query segura saudável renderiza readmodel em componente separado', () => {
    query.useQuery.mockReturnValue({ data: partial, isError: false, isPending: false, isFetching: false }); const html = renderToStaticMarkup(React.createElement(EmprestimosListaSeguraFallback, { onRetryStrict: () => {}, isRetryingStrict: false })); expect(html).toContain('Consulta parcial:'); expect(html).toContain('href="/contratos/novo"');
  });
  it.each(['fetching', 'error', 'loading', 'pending', 'null', 'invalid'])('auth %s oculta resposta antiga e não monta query segura', state => {
    query.auth.mockReturnValue({ data: state === 'null' ? null : { id: state === 'invalid' ? 0 : 41 }, isFetching: state === 'fetching', isError: state === 'error', isLoading: state === 'loading', isPending: state === 'pending' });
    query.useQuery.mockReturnValue({ data: partial });
    const html = renderToStaticMarkup(React.createElement(EmprestimosListaSeguraFallback, { onRetryStrict: () => {}, isRetryingStrict: false }));
    expect(html).not.toContain('Cliente próprio'); expect(html).not.toContain('R$'); expect(query.useQuery).not.toHaveBeenCalled(); expect(html).toContain('href="/contratos/novo"');
  });
  it('auth novo owner settled não pode renderizar cache do owner anterior', () => {
    query.auth.mockReturnValue({ data: { id: 99 }, isFetching: false, isError: false, isPending: false, isLoading: false });
    query.useQuery.mockReturnValue({ data: partial, isError: false, isPending: false, isFetching: false });
    const html = renderToStaticMarkup(React.createElement(EmprestimosListaSeguraFallback, { onRetryStrict: () => {}, isRetryingStrict: false }));
    expect(html).not.toContain('Cliente próprio'); expect(html).not.toContain('R$'); expect(html).toContain('indisponível para a sessão confirmada'); expect(html).toContain('href="/contratos/novo"');
  });
  it('somente card validado abre a ficha guardada existente', () => {
    const html = render(partial); expect(html).toContain('href="/emprestimos/1"'); expect(html).not.toContain('href="/emprestimos/42"');
  });
  it('hunk da página preserva badge e query estrita e só monta após PRECONDITION_FAILED', () => {
    const src = readFileSync(new URL('../pages/Emprestimos.tsx', import.meta.url), 'utf8');
    expect(src).toContain('import { badgeContrato }'); expect(src).toContain('if (isError && deveUsarListaSegura(erroLista)) return <EmprestimosListaSeguraFallback');
    expect(src).toContain('trpc.contratos.listComParcelas.useQuery(undefined, {');
    expect(src).toContain('retry: (failureCount, error) => !deveUsarListaSegura(error) && failureCount < 3,');
    expect(src).not.toContain('listLeituraSegura.useQuery');
    expect(src.indexOf('if (isError && deveUsarListaSegura')).toBeLessThan(src.indexOf('if (leituraEmAndamento || isError)'));
  });
});
