import { describe, expect, it, vi } from 'vitest';
import {
  AVISO_LISTA_INCOMPLETA,
  type ListaSeguraEmprestimos,
} from '../../../shared/emprestimosListaSegura';
import {
  criarRelatorioLista66,
  type FiltrosLista66,
  type RelatorioLista66,
} from './relatorioLista66';

type Item = ListaSeguraEmprestimos['items'][number];
type Validado = Extract<Item, { kind: 'validated' }>;
const OWNER = 41;
const filtros = (patch: Partial<FiltrosLista66> = {}): FiltrosLista66 => ({
  arquivo: 'operacional', busca: '', modalidade: 'todos', statusObrigacao: 'todos', ...patch,
});
const validado = (id = 31, patch: Partial<Validado> = {}): Validado => ({
  kind: 'validated', id, clienteId: id + 100, clienteNome: 'Ana confirmada',
  modalidade: 'mensal', status: 'ativo', statusFinanceiroOriginal: 'ativo',
  statusObrigacao: 'ativo', arquivado: false, obrigacaoAtual: '10.01',
  obrigacaoAdicional: '0.00', capital: 100.123456789, totalReceber: 10.01, totalPago: 2.34,
  resumoParcelas: { total: 8, abertas: 2, pagas: 3, canceladas: 1, transferidas: 2,
    arquivadas: 5, proximoVencimento: '2024-02-29', dataReferencia: '2026-11-27' },
  ...patch,
});
const indisponivel = (id = 42): Item => ({
  kind: 'unavailable', id, message: 'Empréstimo indisponível: não foi possível confirmar seus vínculos.',
});
const lista = (
  items: Item[] = [validado()],
  values?: ListaSeguraEmprestimos['totals']['values'],
): ListaSeguraEmprestimos => {
  const validatedContracts = items.filter(item => item.kind === 'validated').length;
  const unavailableContracts = items.length - validatedContracts;
  return {
    version: 'loan_list_read_v1', userId: OWNER, items,
    coverage: { scopedContracts: items.length, validatedContracts, unavailableContracts,
      complete: unavailableContracts === 0, label: 'validados somente' },
    totals: { label: 'validados somente', values: values === undefined
      ? (items.length > 0 && validatedContracts === 0 ? null
        : { capital: 9101.123456789, totalReceber: 8202.34, totalPago: 7303.45 })
      : values },
    warning: unavailableContracts > 0 ? AVISO_LISTA_INCOMPLETA : null,
  };
};
const metadata = (report: RelatorioLista66, chave: string) =>
  report.metadados.find(([key]) => key === chave)?.[1];
function congelar<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) congelar(child);
    Object.freeze(value);
  }
  return value;
}

// Matriz da seleção que já veio filtrada e ordenada da UI. O relatório não
// repete a lógica de filtro; estes ids são referências exatas do mesmo DTO.
const casosFiltro: Array<{ nome: string; filtro: Partial<FiltrosLista66>; ids: number[] }> = [
  { nome: 'arquivo operacional', filtro: { arquivo: 'operacional' }, ids: [31, 32, 33, 42] },
  { nome: 'arquivo histórico', filtro: { arquivo: 'historico' }, ids: [34, 42] },
  { nome: 'arquivo todos', filtro: { arquivo: 'todos' }, ids: [31, 32, 33, 34, 42] },
  { nome: 'busca por nome', filtro: { busca: ' bruna ' }, ids: [32, 42] },
  { nome: 'busca sem resultado validado', filtro: { busca: 'inexistente' }, ids: [42] },
  { nome: 'modalidade mensal', filtro: { modalidade: 'mensal' }, ids: [31, 33, 42] },
  { nome: 'modalidade quinzenal', filtro: { modalidade: 'quinzenal' }, ids: [32, 42] },
  { nome: 'modalidade sem resultado', filtro: { modalidade: 'inexistente' }, ids: [42] },
  { nome: 'obrigação ativa', filtro: { statusObrigacao: 'ativo' }, ids: [31, 42] },
  { nome: 'obrigação quitada', filtro: { statusObrigacao: 'quitado' }, ids: [32, 42] },
  { nome: 'obrigação encerrada por cancelamento', filtro: { statusObrigacao: 'encerrado_por_cancelamento' }, ids: [33, 42] },
  { nome: 'combinação de todos os filtros', filtro: { arquivo: 'historico', busca: 'carla', modalidade: 'tabela_price', statusObrigacao: 'quitado' }, ids: [34, 42] },
];

describe('relatório66 — snapshot local e seleção exata da lista segura', () => {
  it.each([0, -1, 1.5, 2147483648, NaN, Infinity, '41'])('rejeita expectedUserId inválido: %s', owner => {
    const data = lista();
    expect(() => criarRelatorioLista66(data, data.items, filtros(), owner as number)).toThrow(/proprietário/);
  });

  it.each([0, -1, 1.5, 2147483648, NaN, Infinity, '41', 99])('rejeita owner inválido ou diferente no DTO: %s', owner => {
    const data = lista();
    data.userId = owner as number;
    expect(() => criarRelatorioLista66(data, data.items, filtros(), OWNER)).toThrow(/proprietário/);
  });

  it('aceita o limite superior positivo int32 quando ambos os owners correspondem', () => {
    const data = lista();
    data.userId = 2147483647;
    expect(criarRelatorioLista66(data, data.items, filtros(), 2147483647).linhas).toHaveLength(1);
  });

  it.each(casosFiltro)('preserva os itens implicados por $nome', ({ filtro, ids }) => {
    const data = lista([
      validado(31),
      validado(32, { clienteNome: 'Bruna', modalidade: 'quinzenal', status: 'quitado', statusObrigacao: 'quitado' }),
      validado(33, { status: 'cancelado', statusObrigacao: 'encerrado_por_cancelamento' }),
      validado(34, { clienteNome: 'Carla', modalidade: 'tabela_price', status: 'quitado', statusObrigacao: 'quitado', arquivado: true }),
      indisponivel(),
    ]);
    const selected = ids.map(id => data.items.find(item => item.id === id)!);
    const applied = filtros(filtro);
    const report = criarRelatorioLista66(data, selected, applied, OWNER);
    expect(report.linhas.map(row => row[0])).toEqual(ids);
    expect(metadata(report, 'Arquivo')).toBe(applied.arquivo);
    expect(metadata(report, 'Busca por cliente')).toBe(applied.busca);
    expect(metadata(report, 'Modalidade')).toBe(applied.modalidade);
    expect(metadata(report, 'Estado da obrigação')).toBe(applied.statusObrigacao);
    expect(metadata(report, 'Linhas visíveis')).toBe(String(ids.length));
    expect(metadata(report, 'Validados visíveis')).toBe(String(ids.length - 1));
    expect(metadata(report, 'Indisponíveis visíveis')).toBe('1');
    expect(metadata(report, 'Empréstimos no escopo carregado')).toBe('5');
    expect(metadata(report, 'Empréstimos validados no escopo')).toBe('4');
    expect(metadata(report, 'Empréstimos indisponíveis no escopo')).toBe('1');
    expect(report.parcial).toBe(true);
  });

  it('não refiltra, não ordena e não expande validados a partir dos metadados de filtros', () => {
    const data = lista([validado(31), validado(32), validado(33, { arquivado: true }), indisponivel()]);
    const selected = [data.items[3], data.items[2], data.items[0]];
    const report = criarRelatorioLista66(data, selected, filtros({ busca: 'não corresponde', modalidade: 'outra', statusObrigacao: 'quitado' }), OWNER);
    expect(report.linhas.map(row => row[0])).toEqual([42, 33, 31]);
    expect(report.linhas.some(row => row[0] === 32)).toBe(false);
  });

  it('retém TODOS os ids indisponíveis omitidos ao final, sem duplicar os presentes', () => {
    const data = lista([indisponivel(42), validado(), indisponivel(43), indisponivel(44)]);
    const report = criarRelatorioLista66(data, [data.items[3], data.items[1]], filtros({ busca: 'nada' }), OWNER);
    expect(report.linhas.map(row => row[0])).toEqual([44, 31, 42, 43]);
    expect(metadata(report, 'Indisponíveis visíveis')).toBe('3');
    expect(metadata(report, 'Validados visíveis')).toBe('1');
  });

  it('não exporta PII extra, mensagem ou datas/valores de indisponível', () => {
    const unknown = { ...indisponivel(), clienteNome: 'NOME NÃO CONFIRMADO', modalidade: 'SEGREDO',
      cpf: 'CPF_SECRETO', telefone: 'TELEFONE_SECRETO', contato: 'CONTATO_SECRETO',
      message: 'MENSAGEM COM PII', capital: 99999, totalReceber: 88888, totalPago: 77777,
      resumoParcelas: validado().resumoParcelas } as Item;
    const data = lista([unknown]);
    const report = criarRelatorioLista66(data, data.items, filtros(), OWNER);
    expect(report.linhas).toEqual([[42, null, null, 'Indisponível', null, null, null, null,
      null, null, null, null, null, null, null, null]]);
    expect(JSON.stringify(report)).not.toMatch(/NOME NÃO CONFIRMADO|SEGREDO|SECRETO|MENSAGEM COM PII|99999|88888|77777|2024-02-29/);
    expect(report.metadados.some(([key]) => key.includes('Data referência'))).toBe(false);
  });

  it('exporta somente nome validado e os campos explícitos, não contato/CPF/telefone/clienteId', () => {
    const item = { ...validado(), cpf: 'CPF_SECRETO', telefone: 'TELEFONE_SECRETO',
      contato: 'CONTATO_SECRETO', clienteId: 987654, endereco: 'ENDERECO_SECRETO' };
    const data = lista([item]);
    const report = criarRelatorioLista66(data, data.items, filtros(), OWNER);
    expect(report.linhas[0][1]).toBe('Ana confirmada');
    expect(report.cabecalho).toHaveLength(16);
    expect(report.linhas[0]).toHaveLength(16);
    expect(JSON.stringify(report)).not.toMatch(/SECRETO|987654/);
  });

  it('mantém null como indisponível nos totais e nunca inventa zeros', () => {
    const data = lista([indisponivel()]);
    const report = criarRelatorioLista66(data, [], filtros(), OWNER);
    expect(report.parcial).toBe(true);
    expect(report.titulo).toBe('Relatório parcial — empréstimos');
    expect(metadata(report, 'Capital histórico do escopo validado (R$)')).toBe('Indisponível');
    expect(metadata(report, 'A receber do escopo validado (R$)')).toBe('Indisponível');
    expect(metadata(report, 'Recebido do escopo validado (R$)')).toBe('Indisponível');
    expect(report.avisos.join(' ')).toMatch(/ausência de valor não significa zero/);
    expect(report.linhas[0].filter(value => value === 0)).toHaveLength(0);
  });

  it('totais nulos mesmo sem indisponíveis não geram título de relatório completo', () => {
    const data = lista([validado()], null);
    const report = criarRelatorioLista66(data, data.items, filtros(), OWNER);
    expect(report.parcial).toBe(true);
    expect(report.titulo).toBe('Relatório parcial — empréstimos');
    expect(report.avisos.join(' ')).toMatch(/Relatório parcial: totais indisponíveis/);
  });

  it('resumo ausente tem contagens e datas null, sem simular parcela paga ou vencimento', () => {
    const data = lista([validado(31, { resumoParcelas: undefined })]);
    const report = criarRelatorioLista66(data, data.items, filtros(), OWNER);
    expect(report.linhas[0].slice(8)).toEqual([null, null, null, null, null, null, null, null]);
    expect(report.avisos.join(' ')).toMatch(/Resumo de parcelas ausente/);
    expect(report.metadados.some(([key]) => key.includes('Data referência'))).toBe(false);
  });

  it('lista completa filtrada não declara carteira inteira completa e tem zero linhas quando não há resultado', () => {
    const data = lista();
    const report = criarRelatorioLista66(data, [], filtros({ busca: 'ninguém' }), OWNER);
    expect(report.titulo).toBe('Lista filtrada de empréstimos');
    expect(report.parcial).toBe(false);
    expect(report.linhas).toEqual([]);
    expect(metadata(report, 'Linhas visíveis')).toBe('0');
    expect(metadata(report, 'Capital histórico do escopo validado (R$)')).toBe('9101.123456789');
    expect(report.avisos.join(' ')).toMatch(/Nenhum empréstimo neste filtro/);
    expect(report.titulo).not.toMatch(/completo|carteira/i);
  });

  it('escopo vazio preserva os zeros existentes do DTO, não confunde com null', () => {
    const data = lista([], { capital: 0, totalReceber: 0, totalPago: 0 });
    const report = criarRelatorioLista66(data, [], filtros(), OWNER);
    expect(report.parcial).toBe(false);
    expect(report.linhas).toEqual([]);
    expect(metadata(report, 'Capital histórico do escopo validado (R$)')).toBe('0');
    expect(report.avisos.join(' ')).toMatch(/Nenhum empréstimo no escopo carregado/);
    expect(report.avisos.join(' ')).not.toMatch(/Totais indisponíveis/);
  });

  it('parcialidade vem da cobertura mesmo se o warning do DTO estiver ausente', () => {
    const data = lista([validado(), indisponivel()]);
    data.warning = null;
    const report = criarRelatorioLista66(data, data.items, filtros(), OWNER);
    expect(report.parcial).toBe(true);
    expect(report.titulo).toBe('Relatório parcial — empréstimos');
    expect(report.avisos).toContain(AVISO_LISTA_INCOMPLETA);
  });

  it('preserva exatamente os números das linhas e os totais existentes de TODO o escopo incluindo histórico', () => {
    const data = lista([validado(31), validado(32, { arquivado: true, capital: 0.2 }), validado(33, { capital: 0.1 })],
      { capital: 0.3, totalReceber: 12345.678901234, totalPago: 98765.432109876 });
    const report = criarRelatorioLista66(data, [data.items[0]], filtros(), OWNER);
    expect(report.linhas[0].slice(5, 8)).toEqual([100.123456789, 10.01, 2.34]);
    expect(metadata(report, 'Capital histórico do escopo validado (R$)')).toBe('0.3');
    expect(metadata(report, 'A receber do escopo validado (R$)')).toBe('12345.678901234');
    expect(metadata(report, 'Recebido do escopo validado (R$)')).toBe('98765.432109876');
    expect(metadata(report, 'Escopo dos totais — validados somente')).toMatch(/incluindo o histórico; não são totais das linhas filtradas/);
  });

  it.each([
    { status: 'quitado', statusObrigacao: 'quitado', label: 'QUITADO' },
    { status: 'cancelado', statusObrigacao: 'quitado', label: 'CANCELADO' },
    { status: 'renegociado', statusObrigacao: 'quitado', label: 'REPARCELADO' },
    { status: 'encerrado', statusObrigacao: 'quitado', label: 'ENCERRADO' },
    { status: 'ativo', statusObrigacao: 'encerrado_por_cancelamento', label: 'ENCERRADO POR CANCELAMENTO' },
  ] as const)('preserva o rótulo fechado $label e arquivo separado de pagamento', ({ status, statusObrigacao, label }) => {
    const data = lista([validado(31, { status, statusObrigacao, arquivado: true, totalReceber: 0, totalPago: 12.34,
      resumoParcelas: { total: 3, abertas: 0, pagas: 1, canceladas: 1, transferidas: 1,
        arquivadas: 3, proximoVencimento: null, dataReferencia: '2026-11-27' } })]);
    const report = criarRelatorioLista66(data, data.items, filtros({ arquivo: 'historico' }), OWNER);
    expect(report.linhas[0][3]).toBe(label);
    expect(report.linhas[0][4]).toBe('Sim');
    expect(report.linhas[0].slice(5)).toEqual([100.123456789, 0, 12.34, 3, 0, 1, 1, 1, 3, null, '2026-11-27']);
    expect(report.avisos.join(' ')).toMatch(/Arquivo é um atributo separado/);
  });

  it('arquivo não transforma obrigação ativa em quitação e ativo não presume EM DIA', () => {
    const data = lista([validado(31, { arquivado: true })]);
    const report = criarRelatorioLista66(data, data.items, filtros({ arquivo: 'historico' }), OWNER);
    expect(report.linhas[0][3]).toBe('ATIVO — conferir atrasos na ficha');
    expect(report.linhas[0][4]).toBe('Sim');
    expect(report.linhas[0][10]).toBe(3);
    expect(report.linhas[0][13]).toBe(5);
    expect(report.linhas[0][3]).not.toMatch(/QUITADO|EM DIA/);
  });

  it('datas civis são literais inclusive ano bissexto, sem consultar Date/fuso/relógio', () => {
    const data = lista();
    const date = vi.spyOn(globalThis, 'Date').mockImplementation(() => { throw new Error('DATE civil não deve usar JSDate'); });
    try {
      const report = criarRelatorioLista66(data, data.items, filtros(), OWNER);
      expect(report.linhas[0][14]).toBe('2024-02-29');
      expect(report.linhas[0][15]).toBe('2026-11-27');
      expect(metadata(report, 'Data referência dos snapshots visíveis')).toBe('2026-11-27');
    } finally {
      date.mockRestore();
    }
  });

  it('metadados de datas vêm só dos snapshots selecionados, deduplicados na ordem recebida', () => {
    const data = lista([
      validado(31, { resumoParcelas: { ...validado().resumoParcelas!, dataReferencia: '2020-01-01' } }),
      validado(32), validado(33),
      validado(34, { resumoParcelas: { ...validado().resumoParcelas!, dataReferencia: '2024-02-29' } }),
      indisponivel(),
    ]);
    const report = criarRelatorioLista66(data, [data.items[3], data.items[1], data.items[2]], filtros(), OWNER);
    expect(report.metadados.filter(([key]) => key === 'Data referência dos snapshots visíveis'))
      .toEqual([['Data referência dos snapshots visíveis', '2024-02-29'], ['Data referência dos snapshots visíveis', '2026-11-27']]);
    expect(JSON.stringify(report)).not.toContain('2020-01-01');
  });

  it.each(['=1+1', '+SUM(A1:A2)', '-10+10', '@HYPERLINK("https://malicioso")', '\t=1+1'])('nome parecido com fórmula permanece texto exato: %s', nome => {
    const data = lista([validado(31, { clienteNome: nome })]);
    const report = criarRelatorioLista66(data, data.items, filtros(), OWNER);
    expect(report.linhas[0][1]).toBe(nome);
    expect(typeof report.linhas[0][1]).toBe('string');
  });

  it('aceita entrada profundamente congelada e retorna arrays/linhas/metadados novos sem alias', () => {
    const data = congelar(lista([validado(), indisponivel()]));
    const selected = congelar([data.items[0]]);
    const applied = congelar(filtros());
    const antes = JSON.stringify({ data, selected, applied });
    const report = criarRelatorioLista66(data, selected, applied, OWNER);
    const outro = criarRelatorioLista66(data, selected, applied, OWNER);
    expect(report).toEqual(outro);
    expect(report.linhas).not.toBe(outro.linhas);
    expect(report.linhas[0]).not.toBe(outro.linhas[0]);
    expect(report.cabecalho).not.toBe(outro.cabecalho);
    expect(report.avisos).not.toBe(outro.avisos);
    expect(report.metadados[0]).not.toBe(outro.metadados[0]);
    report.linhas[0][1] = 'Alterado no resultado';
    report.metadados[0][1] = 'Alterado';
    report.cabecalho[0] = 'Alterado';
    report.avisos.push('Alterado');
    expect(JSON.stringify({ data, selected, applied })).toBe(antes);
    expect(outro.linhas[0][1]).toBe('Ana confirmada');
    expect(outro.metadados[0][1]).toBe('operacional');
  });

  it('rejeita cópia do item mesmo com id e conteúdo iguais ao DTO', () => {
    const data = lista();
    const clone = { ...data.items[0] };
    expect(() => criarRelatorioLista66(data, [clone], filtros(), OWNER)).toThrow(/referência/);
  });

  it('rejeita objeto de outra query com mesmo owner e mesmo id', () => {
    const data = lista();
    const outraQuery = lista();
    expect(() => criarRelatorioLista66(data, outraQuery.items, filtros(), OWNER)).toThrow(/referência/);
  });

  it('rejeita item extra selecionado que não existe no escopo', () => {
    const data = lista();
    expect(() => criarRelatorioLista66(data, [data.items[0], validado(99)], filtros(), OWNER)).toThrow(/referência/);
  });

  it('rejeita selecionados duplicados mesmo quando são a mesma referência', () => {
    const data = lista();
    expect(() => criarRelatorioLista66(data, [data.items[0], data.items[0]], filtros(), OWNER)).toThrow(/duplicadas/);
  });

  it('rejeita ids duplicados no escopo mesmo quando um item duplicado está oculto', () => {
    const data = lista([validado(), indisponivel(31)]);
    expect(() => criarRelatorioLista66(data, [], filtros(), OWNER)).toThrow(/duplicada/);
  });

  it.each([0, -1, 1.5, 2147483648])('rejeita identidade de item fora do int32 positivo: %s', id => {
    const data = lista([validado(id)]);
    expect(() => criarRelatorioLista66(data, [], filtros(), OWNER)).toThrow(/identidade/);
  });

  it.each([
    { scopedContracts: 3 }, { validatedContracts: 2 }, { unavailableContracts: 0 },
    { complete: true }, { scopedContracts: -1 }, { validatedContracts: 0.5 },
    { unavailableContracts: NaN },
  ])('rejeita coverage inconsistente mesmo quando os itens visíveis parecem completos: %j', patch => {
    const data = lista([validado(), indisponivel()]);
    Object.assign(data.coverage, patch);
    expect(() => criarRelatorioLista66(data, [data.items[0]], filtros(), OWNER)).toThrow(/cobertura/);
  });

  it('rejeita false complete sem indisponíveis em vez de inventar empréstimos ocultos', () => {
    const data = lista();
    data.coverage.complete = false;
    expect(() => criarRelatorioLista66(data, data.items, filtros(), OWNER)).toThrow(/cobertura/);
  });

  it('rejeita versão não pertencente ao DTO da lista segura', () => {
    const data = lista();
    (data as { version: string }).version = 'lista_legada';
    expect(() => criarRelatorioLista66(data, data.items, filtros(), OWNER)).toThrow(/snapshot/);
  });

  it.each(['capital', 'totalReceber', 'totalPago'] as const)('rejeita total não escalar/finito em %s sem coerção monetária', field => {
    const data = lista();
    data.totals.values![field] = NaN;
    expect(() => criarRelatorioLista66(data, data.items, filtros(), OWNER)).toThrow(/totais/);
  });
});
