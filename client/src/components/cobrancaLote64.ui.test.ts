import * as controles67 from '../lib/emprestimosListaControles67';
// @vitest-environment node
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { compile, deferred, Hooks, nodes, source, text, treeNodes } from '../lib/r1BoundaryHarness';
import { badgeContrato } from '../lib/statusEmprestimoBadge';
import { noArquivo51, referenciaMonetaria51, statusContrato51, REFERENCIA51 } from '../lib/obrigacoes51Apresentacao';
import { rotaAcaoListaEmprestimo62 } from '../lib/acoesListaEmprestimo62';
import type { ListaSeguraEmprestimos } from '../../../shared/emprestimosListaSegura';
import { preview64Schema, resultado64Schema, type Preview64, type Resultado64 } from '../../../shared/cobrancaLote64';
import { EmprestimosListaSegura, candidatoCobranca64 } from './EmprestimosListaSegura';
import { CobrancaLote64 } from './CobrancaLote64';
type Valid = Extract<ListaSeguraEmprestimos['items'][number], { kind: 'validated' }>;
const item = (id = 31, patch: Partial<Valid> = {}): Valid => ({ kind: 'validated', id, clienteId: id + 100, clienteNome: `Cliente ${id}`, modalidade: 'mensal', status: 'ativo', statusFinanceiroOriginal: 'ativo', statusObrigacao: 'ativo', arquivado: false, obrigacaoAtual: '10.01', obrigacaoAdicional: '0.00', capital: 10, totalReceber: 10.01, totalPago: 0, resumoParcelas: { total: 1, abertas: 1, pagas: 0, canceladas: 0, transferidas: 0, arquivadas: 0, proximoVencimento: '2026-11-26', dataReferencia: '2026-11-27' }, ...patch });
const unavailable: ListaSeguraEmprestimos['items'][number] = { kind: 'unavailable', id: 42, message: 'Vínculos indisponíveis.' };
const list = (items: ListaSeguraEmprestimos['items'] = [unavailable, item(), item(32, { clienteNome: 'Outro cliente', resumoParcelas: { ...item().resumoParcelas!, proximoVencimento: '2026-12-01' } }), item(33, { statusObrigacao: 'quitado' }), item(34, { arquivado: true })]): ListaSeguraEmprestimos => ({ version: 'loan_list_read_v1', userId: 41, items, coverage: { scopedContracts: items.length, validatedContracts: items.length - 1, unavailableContracts: 1, complete: false, label: 'validados somente' }, totals: { label: 'validados somente', values: { capital: 40, totalReceber: 40.04, totalPago: 0 } }, warning: null });
const body = (path: string) => { const ast = source(path); return ast.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(ast).replace(/^export\s+(?:default\s+)?/, '')).join('\n'); };
const button = (tree: any, label: string) => { const result = treeNodes(tree, n => n.type === 'button' && text(n) === label)[0]; expect(result, label).toBeDefined(); return result; };
const checks = (tree: any) => treeNodes(tree, n => n.type === 'input' && n.props.type === 'checkbox');
const selectionHarness = (data = list()) => {
  const hooks = new Hooks(), props = { data, onRefresh: vi.fn(), renderCobranca: vi.fn((p: any) => hooks.bindings().React.createElement('aside', { 'aria-label': 'Lote simulado' }, p.contratoIds.join(','))) };
  const component = compile(`${body('components/EmprestimosListaSegura.tsx')}\nreturn EmprestimosListaSegura;`, { ...hooks.bindings(), ...controles67, badgeContrato, noArquivo51, referenciaMonetaria51, statusContrato51, REFERENCIA51, rotaAcaoListaEmprestimo62, ExportarLista66: () => null });
  const render = () => hooks.render(component, props);
  const open = () => { button(render(), 'Selecionar para cobrar').props.onClick(); return render(); };
  const chosen = () => props.renderCobranca.mock.calls.at(-1)?.[0]?.contratoIds ?? [];
  return { hooks, props, render, open, chosen };
};
const result = (contratoId = 31, status: Resultado64['status'] = 'aceito_evolution'): Resultado64 => ({ contratoId, status, motivo: 'Resultado sanitizado.', providerMessageId: status === 'aceito_evolution' ? 'p-31' : null, outboxId: '0ce6b433-df3b-4a03-a39b-325d4716f541' });
const preview = (ids = [31]): Preview64 => ({ userId: 41, dataReferencia: '2026-11-27', items: ids.map(contratoId => ({ contratoId, clienteNome: '<script>Cliente</script>', contatoMascarado: '55 (31) *****-4376', mensagem: 'Olá Cliente. Valor registrado: R$ 10,01. Vencimento: 26/11/2026.', token: `signed-${contratoId}`, estado: 'pronto', motivo: 'Conferido, sem enviar.' })) });
const controllerHarness = (ids = [31]) => {
  const hooks = new Hooks(), api = { preparar: vi.fn(async () => preview(ids)), status: vi.fn(async () => ({ connected: true })), enviar: vi.fn(async (token: string) => result(Number(token.split('-')[1]))) };
  const props = { userId: 41, contratoIds: ids, api, onBusy: vi.fn() };
  const component = compile(`${body('components/CobrancaLote64.tsx')}\nreturn CobrancaLote64;`, { ...hooks.bindings(), ...controles67, preview64Schema, resultado64Schema });
  const render = () => hooks.render(component, props);
  const settle = () => { const tree = render(); hooks.flush(); return tree; };
  settle();
  const prepare = async () => { await button(render(), 'Conferir mensagens').props.onClick(); await Promise.resolve(); await Promise.resolve(); return render(); };
  // Os handlers DOM retornam void; execute a closure local de forma determinística por microtarefas.
  const drain = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
  const prepareAll = async () => { button(render(), 'Conferir mensagens').props.onClick(); await drain(); return render(); };
  const confirm = () => { checks(render()).find(n => text(n) === '')?.props.onChange({ target: { checked: true } }); return render(); };
  const send = async () => { confirm(); button(render(), `Confirmar envio de ${ids.length} ${ids.length === 1 ? 'mensagem' : 'mensagens'}`).props.onClick(); await drain(); return render(); };
  return { hooks, api, props, render, settle, prepare, prepareAll, confirm, send, drain };
};

describe('Seleção64: candidatos locais, nunca autorização de envio', () => {
  it('montagem SSR com e sem adaptador não consulta nem envia e conserva totais', () => {
    const onRefresh = vi.fn(), renderCobranca = vi.fn();
    const html = renderToStaticMarkup(React.createElement(EmprestimosListaSegura, { data: list(), onRefresh, renderCobranca }));
    expect(html).toContain('Selecionar para cobrar'); expect(html).toContain('40,04'); expect(html).not.toContain('type="checkbox"'); expect(renderCobranca).not.toHaveBeenCalled(); expect(onRefresh).not.toHaveBeenCalled();
    const without = renderToStaticMarkup(React.createElement(EmprestimosListaSegura, { data: list(), onRefresh })); expect(without).not.toContain('Selecionar para cobrar');
  });
  it.each([{ statusObrigacao: 'quitado' }, { statusObrigacao: 'encerrado_por_cancelamento' }, { arquivado: true }, { statusFinanceiroOriginal: 'cancelado' }, { statusFinanceiroOriginal: 'renegociado' }, { resumoParcelas: undefined }, { resumoParcelas: { ...item().resumoParcelas!, abertas: 0 } }, { resumoParcelas: { ...item().resumoParcelas!, proximoVencimento: null } }])('não seleciona candidato inelegível %j', patch => expect(candidatoCobranca64(item(31, patch as Partial<Valid>))).toBe(false));
  it('placeholder não selecionável, sem checkbox mesmo no modo de seleção', () => {
    expect(candidatoCobranca64(unavailable)).toBe(false); const h = selectionHarness(); const tree = h.open(); expect(checks(tree).map(n => n.props['aria-label'])).toEqual(['Selecionar empréstimo 31', 'Selecionar empréstimo 32']);
    const unavailableCard = treeNodes(tree, n => n.type === 'article' && n.props['aria-label'] === 'Empréstimo 42 indisponível')[0]; expect(checks(unavailableCard)).toHaveLength(0);
  });
  it('seleciona visíveis, nunca fechado ou arquivado, e permite remover um contrato', () => {
    const h = selectionHarness(); h.open(); button(h.render(), 'Selecionar visíveis').props.onClick(); h.render(); expect(h.chosen()).toEqual([31, 32]); checks(h.render())[0].props.onChange(); h.render(); expect(h.chosen()).toEqual([32]);
  });
  it('vencidos usa DATE registrada estritamente menor que a referência, sem relógio cliente', () => {
    const h = selectionHarness(); h.open(); button(h.render(), 'Selecionar vencidos visíveis').props.onClick(); h.render(); expect(h.chosen()).toEqual([31]);
    const today = selectionHarness(list([unavailable, item(31, { resumoParcelas: { ...item().resumoParcelas!, proximoVencimento: '2026-11-27' } })])); today.open(); button(today.render(), 'Selecionar vencidos visíveis').props.onClick(); expect(text(today.render())).toContain('0 de 20 selecionados');
  });
  it('respeita busca nos candidatos, mas não oculta placeholder nem altera totais', () => {
    const h = selectionHarness(); h.open(); treeNodes(h.render(), n => n.type === 'input' && n.props.type === 'search')[0].props.onChange({ target: { value: 'Outro' } }); button(h.render(), 'Selecionar visíveis').props.onClick(); h.render(); expect(h.chosen()).toEqual([32]); expect(text(h.render())).toContain('40,04'); expect(text(h.render())).toMatch(/Empréstimo #\s*42/);
  });
  it.each(['busca', 'modalidade', 'status', 'arquivo', 'limpar', 'atualizar', 'sair'])('invalida seleção e prévia ao mudar %s', kind => {
    const h = selectionHarness(); h.open(); button(h.render(), 'Selecionar visíveis').props.onClick(); h.render(); expect(h.chosen()).toEqual([31, 32]); let tree = h.render();
    if (kind === 'busca') treeNodes(tree, n => n.type === 'input' && n.props.type === 'search')[0].props.onChange({ target: { value: 'Outro' } });
    if (kind === 'modalidade' || kind === 'status') treeNodes(tree, n => n.type === 'select')[kind === 'modalidade' ? 0 : 1].props.onChange({ target: { value: kind === 'modalidade' ? 'mensal' : 'ativo' } });
    if (kind === 'arquivo') button(tree, 'Todos').props.onClick(); if (kind === 'limpar') button(tree, 'Limpar filtros').props.onClick(); if (kind === 'atualizar') button(tree, 'Atualizar consulta segura').props.onClick(); if (kind === 'sair') button(tree, 'Sair da seleção').props.onClick();
    tree = h.render(); expect(treeNodes(tree, n => n.type === 'aside')).toHaveLength(0); expect(text(tree)).not.toContain('2 de 20 selecionados');
  });
  it('limita escolher visíveis e manual a 20 sem seleção silenciosa extra', () => {
    const h = selectionHarness(list([unavailable, ...Array.from({ length: 25 }, (_, i) => item(i + 100))])); h.open(); button(h.render(), 'Selecionar visíveis').props.onClick(); h.render(); expect(h.chosen()).toHaveLength(20); expect(text(h.render())).toContain('primeiros 20'); checks(h.render())[24].props.onChange(); h.render(); expect(h.chosen()).toHaveLength(20); expect(text(h.render())).toContain('O limite é de 20');
  });
  it('trava mudanças de filtro e refresh somente durante envio explícito', () => {
    const h = selectionHarness(); h.open(); button(h.render(), 'Selecionar visíveis').props.onClick(); h.render(); h.props.renderCobranca.mock.calls.at(-1)![0].onBusy(true); const tree = h.render(); expect(button(tree, 'Limpar filtros').props.disabled).toBe(true); button(tree, 'Limpar filtros').props.onClick(); button(tree, 'Atualizar consulta segura').props.onClick(); expect(h.props.onRefresh).not.toHaveBeenCalled(); h.render(); expect(h.chosen()).toEqual([31, 32]);
  });
  it('não muta snapshot congelado ao selecionar, ordenar ou limpar', () => {
    const data = list(); data.items.forEach(Object.freeze); Object.freeze(data.items); Object.freeze(data); const before = JSON.stringify(data), h = selectionHarness(data); h.open(); button(h.render(), 'Selecionar visíveis').props.onClick(); button(h.render(), 'Limpar seleção').props.onClick(); h.render(); expect(JSON.stringify(data)).toBe(before);
  });
  it('AST mantém componente puro e unavailable sem callbacks ou APIs', () => {
    const ast = source('components/EmprestimosListaSegura.tsx'); expect(ast.getText()).not.toMatch(/useMutation|useQuery|\.mutate|fetch\(|window\.open|wa\.me|cotar|randomUUID/);
    const branch = nodes(ast, n => ts.isConditionalExpression(n) && n.condition.getText(ast) === "item.kind === 'unavailable'")[0] as ts.ConditionalExpression;
    expect(branch).toBeDefined(); expect(nodes(branch.whenTrue, n => ts.isJsxSelfClosingElement(n) && n.tagName.getText(ast) === 'input')).toHaveLength(0);
  });
});

describe('Conferência64: prévia explícita, confirmação e nenhum reenvio automático', () => {
  it('SSR e mount/efeitos não consultam conexão, prévia ou envio', () => {
    const api = { preparar: vi.fn(), status: vi.fn(), enviar: vi.fn() };
    const html = renderToStaticMarkup(React.createElement(CobrancaLote64, { userId: 41, contratoIds: [31], api, onBusy: vi.fn() })); expect(html).toContain('Conferir mensagens'); Object.values(api).forEach(fn => expect(fn).not.toHaveBeenCalled());
    const h = controllerHarness(); h.settle(); expect(h.api.preparar).not.toHaveBeenCalled(); expect(h.api.status).not.toHaveBeenCalled(); expect(h.api.enviar).not.toHaveBeenCalled();
  });
  it('conferência traz texto e destino sem enviar, confirmação começa desmarcada', async () => {
    const h = controllerHarness(); const tree = await h.prepareAll(); expect(text(tree)).toContain('Valor registrado'); expect(text(tree)).toContain('55 (31)'); expect(h.api.preparar).toHaveBeenCalledWith({ contratoIds: [31], tipo: 'atraso' }); expect(h.api.status).toHaveBeenCalledOnce(); expect(h.api.enviar).not.toHaveBeenCalled(); expect(checks(tree)[0].props.checked).toBe(false); expect(button(tree, 'Confirmar envio de 1 mensagem').props.disabled).toBe(true);
  });
  it('sem conexão ou sem pronto não habilita envio', async () => {
    const h = controllerHarness(); h.api.status.mockResolvedValue({ connected: false }); let tree = await h.prepareAll(); expect(text(tree)).toContain('conexão não confirmada'); expect(button(tree, 'Confirmar envio de 1 mensagem').props.disabled).toBe(true); await h.send(); expect(h.api.enviar).not.toHaveBeenCalled();
    const h2 = controllerHarness(); h2.api.preparar.mockResolvedValue({ ...preview(), items: [{ contratoId: 31, clienteNome: null, contatoMascarado: null, mensagem: null, token: null, estado: 'ignorado', motivo: 'Sem contato válido.' }] }); tree = await h2.prepareAll(); expect(button(tree, 'Confirmar envio de 0 mensagens').props.disabled).toBe(true);
  });
  it.each(['owner', 'ids', 'duplicado', 'mensagem', 'token', 'malformed'])('recusa resposta de prévia %s sem publicar PII ou enviar', async kind => {
    const h = controllerHarness(); const raw: any = preview(); if (kind === 'owner') raw.userId = 99; if (kind === 'ids') raw.items[0].contratoId = 99; if (kind === 'duplicado') raw.items.push(raw.items[0]); if (kind === 'mensagem') raw.items[0].mensagem = null; if (kind === 'token') raw.items[0].token = null; if (kind === 'malformed') raw.unexpected = true; h.api.preparar.mockResolvedValue(raw); const tree = await h.prepareAll(); expect(text(tree)).toContain('Não foi possível confirmar'); expect(text(tree)).not.toContain('script'); expect(h.api.enviar).not.toHaveBeenCalled();
  });
  it('mudar tipo invalida prévia e autorização; não envia automaticamente', async () => {
    const h = controllerHarness(); await h.prepareAll(); h.confirm(); treeNodes(h.render(), n => n.type === 'select')[0].props.onChange({ target: { value: 'vence_hoje' } }); const tree = h.render(); expect(text(tree)).not.toContain('Confirmar envio'); expect(h.api.enviar).not.toHaveBeenCalled();
  });
  it('resposta de prévia depois de unmount não publica dados ou dispara envios', async () => {
    const h = controllerHarness(), pending = deferred<Preview64>(); h.api.preparar.mockReturnValue(pending.promise); button(h.render(), 'Conferir mensagens').props.onClick(); h.hooks.unmount(); pending.resolve(preview()); await h.drain(); expect(text(h.render())).not.toContain('Destino cadastrado'); expect(h.api.enviar).not.toHaveBeenCalled();
  });
  it('troca de owner invalida resposta pendente e dados da sessão anterior', async () => {
    const h = controllerHarness(), pending = deferred<Preview64>(); h.api.preparar.mockReturnValue(pending.promise); button(h.render(), 'Conferir mensagens').props.onClick(); h.props.userId = 99; h.settle(); pending.resolve(preview()); await h.drain(); expect(text(h.render())).not.toContain('Destino cadastrado'); expect(h.api.enviar).not.toHaveBeenCalled();
  });
  it('double click de preparar faz uma única conferência', async () => {
    const h = controllerHarness(), d = deferred<Preview64>(); h.api.preparar.mockReturnValue(d.promise); const buttonNode = button(h.render(), 'Conferir mensagens'); buttonNode.props.onClick(); buttonNode.props.onClick(); expect(h.api.preparar).toHaveBeenCalledOnce(); d.resolve(preview()); await h.drain();
  });
  it('double click confirma uma solicitação por item; somente tokens vão à API', async () => {
    const h = controllerHarness([31, 32]); await h.prepareAll(); h.confirm(); const node = button(h.render(), 'Confirmar envio de 2 mensagens'); node.props.onClick(); node.props.onClick(); await h.drain(); expect(h.api.enviar.mock.calls).toEqual([['signed-31'], ['signed-32']]); expect(h.props.onBusy.mock.calls).toEqual([[true], [false]]); expect(text(h.render())).toContain('Aceita pela Evolution'); expect(text(h.render())).not.toContain('Confirmar envio de');
  });
  it('falha de resposta interrompe lote e não transforma timeout em entrega', async () => {
    const h = controllerHarness([31, 32]); h.api.enviar.mockRejectedValueOnce(Error('timeout')); await h.prepareAll(); const tree = await h.send(); expect(h.api.enviar).toHaveBeenCalledOnce(); expect(text(tree)).toContain('Resultado desconhecido'); expect(text(tree)).toContain('contratos seguintes não foram solicitados'); expect(text(tree)).not.toContain('Entrega confirmada por recibo');
  });
  it('resultado com contrato divergente é incerto e interrompe a sequência', async () => {
    const h = controllerHarness([31, 32]); h.api.enviar.mockResolvedValueOnce(result(99)); await h.prepareAll(); const tree = await h.send(); expect(h.api.enviar).toHaveBeenCalledOnce(); expect(text(tree)).toContain('Resultado desconhecido');
  });
  it.each(['desconhecido', 'em_processamento', 'nao_solicitado', 'entregue', 'lido'] as const)('representa %s pelo resultado, sem inferir ou reenviar', async status => {
    const h = controllerHarness(); h.api.enviar.mockResolvedValue(result(31, status)); await h.prepareAll(); const tree = await h.send(); expect(text(tree)).toContain(status === 'entregue' ? 'Entrega confirmada por recibo' : status === 'lido' ? 'Leitura confirmada por recibo' : status === 'nao_solicitado' ? 'Não solicitada' : status === 'em_processamento' ? 'Em processamento' : 'Resultado desconhecido'); expect(h.api.enviar).toHaveBeenCalledOnce();
  });
  it('atualizar resultados é readonly; não autoriza enviar novamente', async () => {
    const h = controllerHarness(); await h.prepareAll(); await h.send(); const update = { ...preview(), items: [{ ...preview().items[0], estado: 'registrado' as const, token: null, registro: result(31, 'entregue') }] }; h.api.preparar.mockResolvedValue(update); button(h.render(), 'Atualizar resultados sem reenviar').props.onClick(); await h.drain(); const tree = h.render(); expect(h.api.enviar).toHaveBeenCalledOnce(); expect(text(tree)).toContain('Entrega confirmada por recibo'); expect(text(tree)).not.toContain('Confirmar envio de');
  });
  it('desmontar durante um envio não solicita os próximos contratos', async () => {
    const h = controllerHarness([31, 32]), d = deferred<Resultado64>(); h.api.enviar.mockReturnValueOnce(d.promise); await h.prepareAll(); h.confirm(); button(h.render(), 'Confirmar envio de 2 mensagens').props.onClick(); h.hooks.unmount(); d.resolve(result()); await h.drain(); expect(h.api.enviar).toHaveBeenCalledOnce();
  });
  it('AST: envio só no handler explícito, sem API antiga, popup, provisionamento ou fila geral', () => {
    const connected = source('components/EmprestimosLista64Conectada.tsx').getText(); expect(connected).toContain('useMutation({ retry: false })'); expect(connected).toContain('confirmar: true'); expect(connected).not.toMatch(/sendMessage|cobrarLote|dispararDoDia|processarFila|ensureConnection|createInstance|wa\.me|window\.open|fetch\(/);
    const controller = source('components/CobrancaLote64.tsx'); for (const effect of nodes(controller, n => ts.isCallExpression(n) && n.expression.getText(controller) === 'useEffect')) expect(effect.getText(controller)).not.toMatch(/api\.(?:preparar|enviar|status)/);
  });
});
