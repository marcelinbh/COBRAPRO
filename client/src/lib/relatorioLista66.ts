// Export66: apresentação local do snapshot já carregado; não autoriza ações financeiras.
import {
  AVISO_LISTA_INCOMPLETA,
  type ListaSeguraEmprestimos,
} from '../../../shared/emprestimosListaSegura';
import { statusContrato51 } from './obrigacoes51Apresentacao';
import { badgeContrato } from './statusEmprestimoBadge';

export type FiltrosLista66 = {
  arquivo: 'operacional' | 'historico' | 'todos';
  busca: string;
  modalidade: string;
  statusObrigacao: string;
};

export type RelatorioLista66 = {
  titulo: string;
  parcial: boolean;
  avisos: string[];
  metadados: Array<[string, string]>;
  cabecalho: string[];
  linhas: Array<Array<string | number | null>>;
};

type ItemLista66 = ListaSeguraEmprestimos['items'][number];
const ESCOPO_TOTAIS66 = 'Todos os empréstimos validados do escopo carregado, incluindo o histórico; não são totais das linhas filtradas.';

function invalido66(motivo: string): never {
  // Erros não interpolam nomes, objetos recebidos ou dados de outro proprietário.
  throw new Error(`Relatório de empréstimos indisponível: ${motivo}.`);
}

function id66(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= 2147483647;
}

function contagem66(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function numero66(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function linha66(item: ItemLista66): Array<string | number | null> {
  if (item.kind === 'unavailable') {
    // Nem message nem propriedades extras de um indisponível são lidas ou copiadas.
    return [item.id, null, null, 'Indisponível', null, null, null, null,
      null, null, null, null, null, null, null, null];
  }

  // Validação de escalares de apresentação, não uma nova prova financeira.
  if (typeof item.clienteNome !== 'string' || typeof item.modalidade !== 'string' ||
      typeof item.arquivado !== 'boolean' || !numero66(item.capital) ||
      !numero66(item.totalReceber) || !numero66(item.totalPago)) {
    invalido66('campos de apresentação inválidos');
  }
  const resumo = item.resumoParcelas;
  if (resumo !== undefined && (!resumo ||
      ![resumo.total, resumo.abertas, resumo.pagas, resumo.canceladas,
        resumo.transferidas, resumo.arquivadas].every(contagem66) ||
      typeof resumo.dataReferencia !== 'string' ||
      (resumo.proximoVencimento !== null && typeof resumo.proximoVencimento !== 'string'))) {
    invalido66('resumo de parcelas inválido');
  }
  const situacao = item.status === 'ativo' && item.statusObrigacao === 'ativo'
    ? 'ATIVO — conferir atrasos na ficha'
    : badgeContrato(statusContrato51(item)).label;

  // Números não são arredondados/coagidos. DATE civil é copiado literalmente,
  // sem Date, fuso horário ou cotação. Ausência de resumo não significa zero.
  // Texto (inclusive nomes iniciados por fórmula) permanece string; a proteção
  // própria de CSV/XLSX pertence ao writer, não ao modelo deste relatório.
  return [
    item.id, item.clienteNome, item.modalidade, situacao,
    item.arquivado ? 'Sim' : 'Não', item.capital, item.totalReceber, item.totalPago,
    resumo?.total ?? null, resumo?.abertas ?? null, resumo?.pagas ?? null,
    resumo?.canceladas ?? null, resumo?.transferidas ?? null, resumo?.arquivadas ?? null,
    resumo?.proximoVencimento ?? null, resumo?.dataReferencia ?? null,
  ];
}

export function criarRelatorioLista66(
  data: ListaSeguraEmprestimos,
  items: ListaSeguraEmprestimos['items'],
  filtros: FiltrosLista66,
  expectedUserId: number,
): RelatorioLista66 {
  if (!id66(expectedUserId) || !data || !id66(data.userId) || data.userId !== expectedUserId) {
    invalido66('proprietário do snapshot não confirmado');
  }
  if (data.version !== 'loan_list_read_v1' || !Array.isArray(data.items) ||
      !Array.isArray(items) || !data.coverage || !data.totals ||
      data.coverage.label !== 'validados somente' || data.totals.label !== 'validados somente') {
    invalido66('snapshot de lista segura inválido');
  }
  if (!filtros || !['operacional', 'historico', 'todos'].includes(filtros.arquivo) ||
      typeof filtros.busca !== 'string' || typeof filtros.modalidade !== 'string' ||
      typeof filtros.statusObrigacao !== 'string') {
    invalido66('descrição dos filtros inválida');
  }

  const porId = new Map<number, ItemLista66>();
  let validados = 0;
  let indisponiveis = 0;
  for (const item of data.items) {
    if (!item || !id66(item.id) || porId.has(item.id) ||
        (item.kind !== 'validated' && item.kind !== 'unavailable')) {
      invalido66('identidade do escopo inválida ou duplicada');
    }
    porId.set(item.id, item);
    if (item.kind === 'validated') validados += 1;
    else indisponiveis += 1;
  }
  const coverage = data.coverage;
  if (![coverage.scopedContracts, coverage.validatedContracts, coverage.unavailableContracts].every(contagem66) ||
      coverage.scopedContracts !== data.items.length || coverage.validatedContracts !== validados ||
      coverage.unavailableContracts !== indisponiveis || coverage.complete !== (indisponiveis === 0)) {
    invalido66('cobertura inconsistente com o escopo carregado');
  }
  const totals = data.totals.values;
  if (totals !== null && (!totals || !numero66(totals.capital) ||
      !numero66(totals.totalReceber) || !numero66(totals.totalPago))) {
    invalido66('totais do snapshot inválidos');
  }

  const idsVisiveis = new Set<number>();
  const visiveis: ItemLista66[] = [];
  for (const item of items) {
    // Igualdade de id não basta: rejeita cópia, item de outra query e PII injetada.
    if (!item || porId.get(item.id) !== item || idsVisiveis.has(item.id)) {
      invalido66('linhas não pertencem por referência ao snapshot ou estão duplicadas');
    }
    idsVisiveis.add(item.id);
    visiveis.push(item);
  }
  // Não refiltra nem reordena os itens da UI. Se um consumidor omitir um
  // indisponível, ele reaparece ao final, na ordem original do snapshot.
  for (const item of data.items) {
    if (item.kind === 'unavailable' && !idsVisiveis.has(item.id)) {
      idsVisiveis.add(item.id);
      visiveis.push(item);
    }
  }

  const linhas = visiveis.map(linha66);
  const parcial = !coverage.complete || totals === null;
  const avisos: string[] = [];
  if (!coverage.complete) avisos.push(AVISO_LISTA_INCOMPLETA);
  if (totals === null) avisos.push('Relatório parcial: totais indisponíveis nesta leitura; ausência de valor não significa zero.');
  avisos.push(ESCOPO_TOTAIS66);
  avisos.push('Somente leitura do snapshot carregado; não é cotação de baixa nem autorização de recebimento.');
  avisos.push('Arquivo é um atributo separado: não representa pagamento, cancelamento ou transferência.');
  if (indisponiveis > 0) avisos.push('Empréstimos indisponíveis permanecem no relatório em qualquer filtro, apenas com ID e situação.');
  if (visiveis.some(item => item.kind === 'validated' && item.resumoParcelas === undefined)) {
    avisos.push('Resumo de parcelas ausente: contagens e datas indisponíveis, não presumidas como zero.');
  }
  if (linhas.length === 0) {
    avisos.push(data.items.length === 0
      ? 'Nenhum empréstimo no escopo carregado.'
      : 'Nenhum empréstimo neste filtro; o escopo e seus totais foram preservados.');
  }

  const metadados: Array<[string, string]> = [
    ['Arquivo', filtros.arquivo],
    ['Busca por cliente', filtros.busca],
    ['Modalidade', filtros.modalidade],
    ['Estado da obrigação', filtros.statusObrigacao],
    ['Empréstimos no escopo carregado', String(coverage.scopedContracts)],
    ['Empréstimos validados no escopo', String(coverage.validatedContracts)],
    ['Empréstimos indisponíveis no escopo', String(coverage.unavailableContracts)],
    ['Cobertura do escopo', coverage.complete ? 'Validado integralmente no escopo carregado' : 'Parcial — validados somente'],
    ['Linhas visíveis', String(linhas.length)],
    ['Validados visíveis', String(visiveis.length - indisponiveis)],
    ['Indisponíveis visíveis', String(indisponiveis)],
    ['Escopo dos totais — validados somente', ESCOPO_TOTAIS66],
    ['Capital histórico do escopo validado (R$)', totals === null ? 'Indisponível' : String(totals.capital)],
    ['A receber do escopo validado (R$)', totals === null ? 'Indisponível' : String(totals.totalReceber)],
    ['Recebido do escopo validado (R$)', totals === null ? 'Indisponível' : String(totals.totalPago)],
  ];
  // Referências somente das linhas validadas selecionadas, sem incluir datas
  // de linhas ocultas. Deduplicação preserva a ordem recebida e o DATE exato.
  const referencias = new Set<string>();
  for (const linha of linhas) {
    const referencia = linha[15];
    if (typeof referencia === 'string') referencias.add(referencia);
  }
  for (const referencia of referencias) {
    metadados.push(['Data referência dos snapshots visíveis', referencia]);
  }

  return {
    titulo: parcial ? 'Relatório parcial — empréstimos' : 'Lista filtrada de empréstimos',
    parcial,
    avisos,
    metadados,
    cabecalho: [
      'ID', 'Cliente', 'Modalidade', 'Situação', 'Arquivado',
      'Capital histórico (R$)', 'A receber (R$)', 'Recebido (R$)',
      'Total parcelas', 'Em aberto', 'Pagas', 'Canceladas', 'Transferidas', 'Arquivadas',
      'Próximo vencimento', 'Data referência',
    ],
    linhas,
  };
}
