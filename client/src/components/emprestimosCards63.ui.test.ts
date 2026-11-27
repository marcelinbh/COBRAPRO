// @vitest-environment node
// Etapa63: SSR React real; o harness abaixo serve apenas à boundary local dos filtros.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { compile, Hooks, nodes, source, text, treeNodes } from '../lib/r1BoundaryHarness';
import { badgeContrato } from '../lib/statusEmprestimoBadge';
import { noArquivo51, referenciaMonetaria51, statusContrato51, REFERENCIA51 } from '../lib/obrigacoes51Apresentacao';
import { rotaAcaoListaEmprestimo62 } from '../lib/acoesListaEmprestimo62';
import { AVISO_LISTA_INCOMPLETA, type ListaSeguraEmprestimos } from '../../../shared/emprestimosListaSegura';
import { EmprestimosListaSegura } from './EmprestimosListaSegura';

// Fixture do contrato proposto, sem importar um helper/UI novo nem alterar o DTO legado.
type Resumo63 = {
  total: number; abertas: number; pagas: number; canceladas: number;
  transferidas: number; arquivadas: number;
  proximoVencimento: string | null; dataReferencia: string;
};
type Validated63 = Extract<ListaSeguraEmprestimos['items'][number], { kind: 'validated' }> & {
  resumoParcelas?: Resumo63;
};
const indisponivel: Extract<ListaSeguraEmprestimos['items'][number], { kind: 'unavailable' }> = {
  kind: 'unavailable', id: 42,
  message: 'Empréstimo indisponível: não foi possível confirmar seus vínculos.',
};
const resumo = (patch: Partial<Resumo63> = {}): Resumo63 => ({
  total: 11, abertas: 2, pagas: 3, canceladas: 4, transferidas: 2, arquivadas: 8,
  proximoVencimento: '2027-01-09', dataReferencia: '2026-11-27', ...patch,
});
const validado = (patch: Partial<Validated63> = {}): Validated63 => ({
  kind: 'validated', id: 31, clienteId: 7, clienteNome: 'Cliente confirmado',
  modalidade: 'mensal', status: 'ativo', statusFinanceiroOriginal: 'ativo',
  statusObrigacao: 'ativo', arquivado: false, obrigacaoAtual: '789.01', obrigacaoAdicional: '17.00',
  // Valores deliberadamente não dedutíveis das contagens ou uns dos outros.
  capital: 1234.56, totalReceber: 789.01, totalPago: 456.78,
  resumoParcelas: resumo(), ...patch,
});
const lista = (
  items: ListaSeguraEmprestimos['items'] = [validado()],
  values: ListaSeguraEmprestimos['totals']['values'] = { capital: 9101.23, totalReceber: 8202.34, totalPago: 7303.45 },
): ListaSeguraEmprestimos => {
  const validatedContracts = items.filter(item => item.kind === 'validated').length;
  const unavailableContracts = items.length - validatedContracts;
  return {
    version: 'loan_list_read_v1', userId: 41, items,
    coverage: { scopedContracts: items.length, validatedContracts, unavailableContracts, complete: unavailableContracts === 0, label: 'validados somente' },
    totals: { label: 'validados somente', values },
    warning: unavailableContracts > 0 ? AVISO_LISTA_INCOMPLETA : null,
  };
};
const render = (data = lista(), onRefresh = vi.fn()) =>
  renderToStaticMarkup(React.createElement(EmprestimosListaSegura, { data, onRefresh }));
const plain = (html: string) => html.replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();
const articles = (html: string) => [...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(match => match[0]);
const card = (html: string, id = 31) => {
  const result = articles(html).find(article => new RegExp(`Empréstimo #${id}(?!\\d)`).test(plain(article)));
  expect(result, `card de empréstimo ${id}`).toBeDefined();
  return result!;
};
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
const anchors = (html: string) => [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]);
const classTokens = (html: string) => [...html.matchAll(/\bclass="([^"]*)"/g)].map(match => match[1].split(/\s+/));
const moeda = (value: number) => plain(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value));
const count = (article: string, label: string, value: number) =>
  expect(plain(article)).toMatch(new RegExp(`${label}\\s*:?\\s*${value}(?!\\d)`));
const counts = (article: string, value: Resumo63) => {
  count(article, 'Total de parcelas', value.total);
  count(article, 'Em aberto', value.abertas);
  count(article, 'Pagas', value.pagas);
  count(article, 'Canceladas', value.canceladas);
  count(article, 'Transferidas', value.transferidas);
  count(article, 'Arquivadas', value.arquivadas);
};
const freeze = <T,>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const noSummaryLabels = /Total de parcelas|Em aberto|Pagas|Canceladas|Transferidas|Arquivadas|Referência da consulta/;
const dateText = /\b\d{2}\/\d{2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/;
const hashes62 = ['#receber-conferir', '#editar-obrigacao', '#reparcelar', '#cancelar-arquivar'];
const labels62 = ['Receber / conferir', 'Editar obrigação', 'Reparcelar', 'Cancelar / arquivar'];

// Não imita SSR: compila somente o módulo local e mantém os handlers dos filtros
// numa instância explícita de Hooks. Helpers novos no mesmo arquivo são preservados.
const localBoundary = () => {
  const ast = source('components/EmprestimosListaSegura.tsx');
  const body = ast.statements.filter(node => !ts.isImportDeclaration(node))
    .map(node => node.getText(ast).replace(/^export\s+(?:default\s+)?/, '')).join('\n');
  const hooks = new Hooks();
  const component = compile(`${body}\nreturn EmprestimosListaSegura;`, {
    ...hooks.bindings(), badgeContrato, noArquivo51, referenciaMonetaria51,
    statusContrato51, REFERENCIA51, rotaAcaoListaEmprestimo62,
    ExportarLista66: () => null,
  });
  return { hooks, component };
};
const button = (tree: any, label: string) => {
  const found = treeNodes(tree, node => node.type === 'button' && text(node) === label)[0];
  expect(found, `botão ${label}`).toBeDefined();
  return found;
};
const cardIds = (tree: any) => treeNodes(tree, node => node.type === 'article')
  .map(node => Number(text(node).match(/Empréstimo\s*#\s*(\d+)/)?.[1]));
const unavailableBranch = (ast: ts.SourceFile) => {
  const found = nodes(ast, node => ts.isConditionalExpression(node) &&
    /\bitem\.kind\s*===?\s*['"]unavailable['"]/.test(node.condition.getText(ast)))[0];
  expect(found, 'boundary discriminada validated/unavailable').toBeDefined();
  return found as ts.ConditionalExpression;
};
const inputRoot = (node: ts.Node): boolean => {
  if (ts.isIdentifier(node)) return node.text === 'data' || node.text === 'item';
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isParenthesizedExpression(node)) return inputRoot(node.expression);
  return false;
};

describe('Cards63: snapshot validado em SSR React real', () => {
  it('primeiro RED: apresenta as seis contagens e as datas do resumo novo', () => {
    const article = card(render());
    // Esta é a primeira assertion: a UI anterior não apresenta resumoParcelas.
    count(article, 'Total de parcelas', 11);
    counts(article, resumo());
    expect(plain(article)).toContain('09/01/2027');
    expect(plain(article)).toContain('Referência da consulta: 27/11/2026');
    expect(article).not.toContain('Resumo de parcelas indisponível nesta leitura.');
  });

  it('DTO antigo sem resumo não inventa contagens zero nem uma data', () => {
    const { resumoParcelas: _summary, ...antigo } = validado();
    const article = card(render(lista([antigo])));
    expect(plain(article)).toContain('Resumo de parcelas indisponível nesta leitura.');
    expect(plain(article)).not.toMatch(noSummaryLabels);
    expect(plain(article)).not.toMatch(dateText);
    expect(article).not.toContain('Sem parcela em aberto para vencimento.');
    expect(plain(article)).toContain(moeda(antigo.capital));
  });

  it('próximo vencimento null é ausência explícita, não data fictícia', () => {
    const article = card(render(lista([validado({ resumoParcelas: resumo({ abertas: 0, proximoVencimento: null }) })])));
    expect(plain(article)).toContain('Sem parcela em aberto para vencimento.');
    expect(plain(article)).toContain('Referência da consulta: 27/11/2026');
    expect(article).not.toMatch(/01\/01\/1970|31\/12\/1969|Invalid Date|undefined|\bnull\b/);
    expect(article).not.toContain('09/01/2027');
    expect(article).not.toContain('Resumo de parcelas indisponível nesta leitura.');
  });

  it('arquivo é atributo independente: não soma oito arquivadas às onze classificadas', () => {
    const article = card(render());
    counts(article, resumo());
    count(article, 'Total de parcelas', 11);
    expect(plain(article)).not.toMatch(/Total de parcelas\s*:?\s*19(?!\d)/);
    // O contrato é operacional mesmo quando há parcelas arquivadas no resumo.
    expect(articles(render())).toHaveLength(1);
  });

  it('zero comprovado no resumo é exibido, sem confundir com DTO sem resumo', () => {
    const zero = resumo({ total: 0, abertas: 0, pagas: 0, canceladas: 0, transferidas: 0, arquivadas: 0, proximoVencimento: null });
    const article = card(render(lista([validado({ resumoParcelas: zero })])));
    counts(article, zero);
    expect(article).not.toContain('Resumo de parcelas indisponível nesta leitura.');
    expect(plain(article)).toContain('Sem parcela em aberto para vencimento.');
  });

  it('capital, a receber e recebido usam os três valores existentes sem recalcular', () => {
    const item = validado();
    const article = card(render(lista([item])));
    expect(plain(article)).toContain(`Capital histórico: ${moeda(item.capital)}`);
    expect(plain(article)).toContain(`A receber: ${moeda(item.totalReceber)}`);
    expect(plain(article)).toContain(`Recebido: ${moeda(item.totalPago)}`);
    expect(plain(article)).not.toContain(moeda(item.capital - item.totalPago));
    expect(plain(article)).not.toContain(moeda(item.totalReceber + item.totalPago));
  });

  it('DATE mantém dia e mês com zero à esquerda e referência separada', () => {
    const article = card(render(lista([validado({ resumoParcelas: resumo({ proximoVencimento: '2027-01-09', dataReferencia: '2027-01-01' }) })])));
    expect(plain(article)).toContain('09/01/2027');
    expect(plain(article)).toContain('Referência da consulta: 01/01/2027');
    expect(plain(article)).not.toMatch(/2027-01-09|2027-01-01|T00:00|GMT/);
  });

  it('DATE de ano bissexto é apresentado literalmente sem deslocar o dia', () => {
    const article = card(render(lista([validado({ resumoParcelas: resumo({ proximoVencimento: '2028-02-29', dataReferencia: '2028-03-01' }) })])));
    expect(plain(article)).toContain('29/02/2028');
    expect(plain(article)).toContain('Referência da consulta: 01/03/2028');
    expect(article).not.toContain('28/02/2028');
  });

  it('contrato quitado com parcelas pagas mantém histórico sem inventar recebimento', () => {
    const closed = resumo({ total: 5, abertas: 0, pagas: 5, canceladas: 0, transferidas: 0, arquivadas: 2, proximoVencimento: null });
    const article = card(render(lista([validado({ status: 'quitado', statusFinanceiroOriginal: 'quitado', statusObrigacao: 'quitado', obrigacaoAtual: '0.00', capital: 9999, totalReceber: 0, totalPago: 12.34, resumoParcelas: closed })])));
    counts(article, closed);
    expect(plain(article)).toContain('QUITADO');
    expect(plain(article)).toContain(`Recebido: ${moeda(12.34)}`);
    expect(plain(article)).toContain(`A receber: ${moeda(0)}`);
    expect(plain(article)).toContain('Sem parcela em aberto para vencimento.');
  });

  it('encerrado por cancelamento não transforma canceladas em pagas', () => {
    const closed = resumo({ total: 5, abertas: 0, pagas: 0, canceladas: 5, transferidas: 0, arquivadas: 3, proximoVencimento: null });
    const article = card(render(lista([validado({ status: 'cancelado', statusObrigacao: 'encerrado_por_cancelamento', obrigacaoAtual: '0.00', totalReceber: 0, totalPago: 0, resumoParcelas: closed })])));
    counts(article, closed);
    expect(plain(article)).toContain('ENCERRADO POR CANCELAMENTO');
    expect(plain(article)).toContain(`Recebido: ${moeda(0)}`);
    expect(plain(article)).toContain('Sem parcela em aberto para vencimento.');
  });

  it('origem reparcelada preserva transferidas separadas de pagas e canceladas', () => {
    const transferred = resumo({ total: 4, abertas: 0, pagas: 0, canceladas: 0, transferidas: 4, arquivadas: 4, proximoVencimento: null });
    const article = card(render(lista([validado({ status: 'renegociado', statusFinanceiroOriginal: 'renegociado', statusObrigacao: 'quitado', obrigacaoAtual: '0.00', capital: 1000000, totalReceber: 0, totalPago: 0, resumoParcelas: transferred })])));
    counts(article, transferred);
    expect(plain(article)).toContain('REPARCELADO');
    expect(plain(article)).toContain(`Recebido: ${moeda(0)}`);
    expect(plain(article)).toContain('Sem parcela em aberto para vencimento.');
  });

  it('modalidades genéricas são legíveis e não alteram valores ou classificação', () => {
    for (const modalidade of ['quinzenal', 'acordo livre', 'modalidade própria sem calendário']) {
      const article = card(render(lista([validado({ modalidade })])));
      expect(plain(article)).toContain(modalidade);
      expect(plain(article)).toContain('ATIVO — conferir atrasos na ficha');
      expect(plain(article)).not.toContain('EM DIA');
      counts(article, resumo());
      expect(plain(article)).toContain(`A receber: ${moeda(789.01)}`);
    }
  });

  it('nome e modalidade com XSS são texto escapado, não elementos ou destinos', () => {
    const clienteNome = 'Cliente <script>alert(1)</script> & <img src=x onerror=alert(2)>';
    const modalidade = '<svg onload=alert(3)> modalidade';
    const article = card(render(lista([validado({ clienteNome, modalidade })])));
    expect(article).toContain('&lt;script&gt;');
    expect(article).toContain('&lt;img');
    expect(article).toContain('&lt;svg');
    expect(article).not.toMatch(/<script\b|<img\b|<svg\b|href="javascript:/i);
    expect(plain(article)).toContain(clienteNome);
    expect(plain(article)).toContain(modalidade);
    expect(hrefs(article)).toEqual(['/emprestimos/31', ...hashes62.map(hash => `/emprestimos/31${hash}`)]);
  });

  it('nome longo permanece inteiro, legível e sem truncate ou line-clamp', () => {
    const clienteNome = `Ana ${'SobrenomeMuitoLongo'.repeat(30)} da Conceição`;
    const article = card(render(lista([validado({ clienteNome })])));
    expect(plain(article)).toContain(clienteNome);
    expect(article).toContain(`aria-label="Empréstimo 31 — ${clienteNome}"`);
    const tokens = classTokens(article).flat();
    expect(tokens).toContain('break-words');
    expect(tokens).not.toContain('truncate');
    expect(tokens.some(token => /(?:^|:)line-clamp-|(?:^|:)text-ellipsis$/.test(token))).toBe(false);
  });

  it('aria-label identifica exatamente o card validado pelo contrato e cliente', () => {
    const article = card(render());
    expect(article).toContain('aria-label="Empréstimo 31 — Cliente confirmado"');
    expect(plain(article)).toContain('Cliente confirmado');
    expect(plain(article)).toContain('mensal');
    expect(plain(article)).toContain('ATIVO — conferir atrasos na ficha');
  });

  it('mantém cinco âncoras e os quatro hashes62 exatos nos limites int32 positivos', () => {
    for (const id of [1, 31, 2147483647]) {
      const article = card(render(lista([validado({ id })])), id);
      expect(anchors(article)).toHaveLength(5);
      expect(hrefs(article)).toEqual([`/emprestimos/${id}`, ...hashes62.map(hash => `/emprestimos/${id}${hash}`)]);
      expect(hrefs(article).some(href => /\?|parcelaId|owner|contaCaixaId|UUID/.test(href))).toBe(false);
      for (const label of labels62) expect(plain(article)).toContain(label);
    }
  });

  it('quatro links62 ficam neutros, focáveis, com alvo móvel e agrupamento flex-wrap', () => {
    const article = card(render());
    const nav = article.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/)?.[0];
    expect(nav).toBeDefined();
    const navClasses = classTokens(nav!)[0];
    expect(navClasses).toEqual(expect.arrayContaining(['flex', 'flex-wrap']));
    expect(anchors(nav!)).toHaveLength(4);
    for (const anchor of anchors(nav!)) {
      const tokens = classTokens(anchor)[0];
      expect(tokens).toEqual(expect.arrayContaining(['border-border', 'bg-background', 'text-foreground', 'focus-visible:ring-2', 'min-h-11']));
      expect(tokens.some(token => /(?:^|:)(?:bg|text|border)-(?:red|green|emerald|destructive|success)(?:-|$)/.test(token))).toBe(false);
      expect(anchor).not.toMatch(/\bon(?:click|keydown|pointerdown)=/i);
    }
  });

  it('cards usam superfície do tema, largura mínima segura e grid responsivo sem cortar texto', () => {
    const html = render(lista([validado(), indisponivel]));
    for (const article of articles(html)) {
      const tokens = classTokens(article);
      expect(tokens[0]).toEqual(expect.arrayContaining(['bg-card', 'text-card-foreground', 'min-w-0']));
      expect(tokens.flat()).toContain('break-words');
      expect(tokens.flat().some(token => /(?:^|:)(?:truncate|line-clamp-\d+|text-ellipsis)$/.test(token))).toBe(false);
    }
    const valueGrids = classTokens(card(html)).filter(tokens => tokens.includes('grid'));
    expect(valueGrids.some(tokens => tokens.some(token => /^grid-cols-[12]$/.test(token)) &&
      tokens.some(token => /^(?:sm|md|lg):grid-cols-\d+$/.test(token)))).toBe(true);
  });

  it('indisponível continua neutro sem nome, valor, DATE, contagens, ficha ou ações', () => {
    const article = card(render(lista([validado(), indisponivel])), 42);
    expect(article).toContain('aria-label="Empréstimo 42 indisponível"');
    expect(plain(article)).toContain(indisponivel.message);
    expect(plain(article)).toContain('Não cadastre novamente.');
    expect(article).not.toMatch(/Cliente confirmado|R\$|<a\b|<nav\b|<button\b|href=|wa\.me|whatsapp|tel:|mailto:/i);
    expect(plain(article)).not.toMatch(noSummaryLabels);
    expect(plain(article)).not.toMatch(dateText);
    for (const label of labels62) expect(plain(article)).not.toContain(label);
  });

  it('campos estranhos em unavailable não vazam nem promovem o item a validated', () => {
    const polluted = {
      ...indisponivel, clienteNome: 'SEGREDO_CLIENTE', modalidade: 'SEGREDO_MODALIDADE',
      status: 'SEGREDO_STATUS', clienteId: 999999, parcelaId: 999998,
      capital: 888888.88, totalReceber: 777777.77, totalPago: 666666.66,
      contato: 'SEGREDO_CONTATO', telefone: '+5511999999999', email: 'segredo@example.invalid',
      whatsapp: 'https://wa.me/5511999999999', href: '/emprestimos/42#receber-conferir',
      resumoParcelas: resumo({ total: 999997, proximoVencimento: '2044-12-31', dataReferencia: '2044-12-30' }),
    };
    const article = card(render(lista([validado(), polluted])), 42);
    expect(plain(article)).toContain(indisponivel.message);
    expect(article).not.toMatch(/SEGREDO_|segredo@|99999|888888|777777|666666|2044|wa\.me|href=|<a\b|<nav\b|<button\b|R\$/);
    expect(plain(article)).not.toMatch(noSummaryLabels);
    expect(plain(article)).not.toMatch(dateText);
    expect(hrefs(article)).toEqual([]);
  });

  it('escopo só indisponível com totais null não produz dinheiro ou resumo zero', () => {
    const html = render(lista([indisponivel], null));
    expect(plain(html)).toContain('Valores indisponíveis: nenhum empréstimo deste escopo pôde ser validado.');
    expect(html).not.toContain('R$');
    expect(plain(card(html, 42))).not.toMatch(noSummaryLabels);
    expect(plain(card(html, 42))).not.toMatch(dateText);
    expect(hrefs(html)).toEqual([]);
    expect(plain(html)).toContain('1 no escopo; 0 validados; 1 indisponíveis');
  });

  it('input profundamente congelado permanece idêntico em SSR repetido e não chama refresh', () => {
    const data = freeze(lista([validado(), indisponivel]));
    const before = JSON.stringify(data), onRefresh = vi.fn();
    const first = render(data, onRefresh), second = render(data, onRefresh);
    expect(first).toBe(second);
    expect(JSON.stringify(data)).toBe(before);
    expect(Object.isFrozen(data.items[0])).toBe(true);
    expect(Object.isFrozen((data.items[0] as Validated63).resumoParcelas)).toBe(true);
    expect(Object.isFrozen(data.coverage)).toBe(true);
    expect(Object.isFrozen(data.totals.values)).toBe(true);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('coverage e totais integrais incluem histórico oculto e preservam aviso parcial', () => {
    const data = freeze(lista([validado(), validado({ id: 33, clienteNome: 'Cliente histórico', arquivado: true }), indisponivel]));
    const before = JSON.stringify(data), html = render(data);
    expect(articles(html)).toHaveLength(2);
    expect(html).not.toContain('Cliente histórico');
    expect(plain(html)).toContain('3 no escopo; 2 validados; 1 indisponíveis');
    expect(plain(html)).toContain(`Capital (validados somente): ${moeda(9101.23)}`);
    expect(plain(html)).toContain(`A receber (validados somente): ${moeda(8202.34)}`);
    expect(plain(html)).toContain(`Recebido (validados somente): ${moeda(7303.45)}`);
    expect(plain(html)).toContain(AVISO_LISTA_INCOMPLETA);
    expect(plain(html)).toContain('Relatório completo indisponível nesta consulta.');
    expect(JSON.stringify(data)).toBe(before);
  });
});

describe('Cards63: boundary local dos filtros e AST sem autoridade financeira', () => {
  it('filtros e limpar alteram só cards; unavailable, coverage, totais e input congelado permanecem', () => {
    const data = freeze(lista([
      validado({ clienteNome: 'Alice confirmada' }),
      validado({ id: 32, clienteNome: 'Bruna confirmada', modalidade: 'quinzenal', status: 'quitado', statusObrigacao: 'quitado' }),
      validado({ id: 33, clienteNome: 'Cliente histórico', modalidade: 'livre', arquivado: true }),
      indisponivel,
    ]));
    const before = JSON.stringify(data), onRefresh = vi.fn();
    const { hooks, component } = localBoundary();
    const current = () => hooks.render(component, { data, onRefresh });
    let tree = current();
    const coverageBefore = text(treeNodes(tree, node => node.type === 'h2')[0]);
    const totalsBefore = text(treeNodes(tree, node => node.props?.['aria-label'] === 'Totais validados somente')[0]);
    const check = (ids: number[]) => {
      tree = current();
      expect(cardIds(tree)).toEqual(ids);
      expect(text(treeNodes(tree, node => node.type === 'h2')[0])).toBe(coverageBefore);
      expect(text(treeNodes(tree, node => node.props?.['aria-label'] === 'Totais validados somente')[0])).toBe(totalsBefore);
      expect(JSON.stringify(data)).toBe(before);
    };
    const clear = () => { button(tree, 'Limpar filtros').props.onClick(); tree = current(); };
    check([31, 32, 42]);
    treeNodes(tree, node => node.type === 'input' && node.props.type === 'search')[0].props.onChange({ target: { value: 'cliente inexistente' } });
    check([42]);
    clear();
    const selects = () => treeNodes(tree, node => node.type === 'select');
    selects()[0].props.onChange({ target: { value: 'quinzenal' } });
    check([32, 42]);
    clear();
    selects()[1].props.onChange({ target: { value: 'quitado' } });
    check([32, 42]);
    clear();
    button(tree, 'Histórico').props.onClick();
    check([33, 42]);
    button(tree, 'Todos').props.onClick();
    check([31, 32, 33, 42]);
    clear();
    check([31, 32, 42]);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('AST: cinco anchors só no ramo validated, sem handlers/spread e sem dados privados no unavailable', () => {
    const ast = source('components/EmprestimosListaSegura.tsx');
    const branch = unavailableBranch(ast);
    const validatedAnchors = nodes(branch.whenFalse, node => ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'a') as ts.JsxElement[];
    expect(validatedAnchors).toHaveLength(5);
    for (const anchor of validatedAnchors) {
      expect(anchor.openingElement.attributes.properties.some(attribute => ts.isJsxSpreadAttribute(attribute) ||
        (ts.isJsxAttribute(attribute) && /^on[A-Z]/.test(attribute.name.getText(ast))))).toBe(false);
    }
    expect(nodes(branch.whenTrue, node =>
      (ts.isJsxElement(node) && ['a', 'nav', 'button'].includes(node.openingElement.tagName.getText(ast))) ||
      (ts.isJsxSelfClosingElement(node) && ['a', 'nav', 'button'].includes(node.tagName.getText(ast))))).toHaveLength(0);
    const privateReads = nodes(branch.whenTrue, node => ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) && node.expression.text === 'item' && !['kind', 'id', 'message'].includes(node.name.text));
    expect(privateReads).toHaveLength(0);
  });

  it('AST: apresentação local não importa query/escrita, contatos ou recovery nem chama efeitos financeiros', () => {
    for (const relative of ['components/EmprestimosListaSegura.tsx', 'lib/acoesListaEmprestimo62.ts']) {
      const ast = source(relative);
      const imports = nodes(ast, node => ts.isImportDeclaration(node)) as ts.ImportDeclaration[];
      for (const imported of imports) expect((imported.moduleSpecifier as ts.StringLiteral).text).not.toMatch(/trpc|server|query|mutation|recovery|recuper|whatsapp|contato/i);
      const forbiddenNames = nodes(ast, node => ts.isIdentifier(node) &&
        /^(?:query|useQuery|useMutation|mutate|mutateAsync|fetch|XMLHttpRequest|axios|localStorage|sessionStorage|randomUUID|cotar|recovery|recover|recuperar|onRetryStrict|retryStrict|parcelaId|contaCaixaId|telefone|whatsapp|contato|email)$/i.test(node.text));
      expect(forbiddenNames, relative).toHaveLength(0);
      const forbiddenCalls = nodes(ast, node => ts.isCallExpression(node) &&
        ((ts.isPropertyAccessExpression(node.expression) &&
          /^(?:click|query|useQuery|useMutation|mutate|mutateAsync|open|sendBeacon|cotar|recuperar|recover)$/i.test(node.expression.name.text)) ||
          /\b(?:window\.open|navigator\.sendBeacon)\b/.test(node.expression.getText(ast))));
      expect(forbiddenCalls, relative).toHaveLength(0);
      expect(nodes(ast, node => ts.isJsxAttribute(node) && node.name.getText(ast) === 'dangerouslySetInnerHTML')).toHaveLength(0);
    }
  });

  it('AST: DATE não usa new Date, Date(), parse/now/UTC ou conversão por timezone', () => {
    const ast = source('components/EmprestimosListaSegura.tsx');
    const dateConstruction = nodes(ast, node =>
      ((ts.isNewExpression(node) || ts.isCallExpression(node)) && ts.isIdentifier(node.expression) && node.expression.text === 'Date') ||
      (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Date') ||
      (ts.isPropertyAccessExpression(node) && /^(?:toLocaleDateString|toISOString|toUTCString|getUTCDate|getDate)$/.test(node.name.text)));
    expect(dateConstruction).toHaveLength(0);
  });

  it('AST: filtros não atribuem ao snapshot nem ordenam/apagam itens ou recalculam totais', () => {
    const ast = source('components/EmprestimosListaSegura.tsx');
    const assignments = nodes(ast, node =>
      (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment && inputRoot(node.left)) ||
      ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
        [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator) && inputRoot(node.operand)) ||
      (ts.isDeleteExpression(node) && inputRoot(node.expression)));
    expect(assignments).toHaveLength(0);
    const mutatingCalls = nodes(ast, node => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      /^(?:push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)$/.test(node.expression.name.text) && inputRoot(node.expression.expression));
    expect(mutatingCalls).toHaveLength(0);
    const totalsArithmetic = nodes(ast, node => ts.isBinaryExpression(node) &&
      [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.SlashToken].includes(node.operatorToken.kind) &&
      /\b(?:data\.totals|item\.(?:capital|totalReceber|totalPago))\b/.test(node.getText(ast)));
    expect(totalsArithmetic).toHaveLength(0);
  });
});
