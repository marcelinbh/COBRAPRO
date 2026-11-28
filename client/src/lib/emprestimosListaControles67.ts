import type { ListaSeguraEmprestimos, EmprestimoValidadoLista } from '../../../shared/emprestimosListaSegura';
import { dataMultimodalValida } from '../../../shared/emprestimosMultimodalCalculo';
import { noArquivo51, type Arquivo51 } from './obrigacoes51Apresentacao';
export type Vencimento67 = 'todos' | 'atrasados' | 'emdia';
export type Filtros67 = { arquivo: Arquivo51; busca: string; modalidade: string; statusObrigacao: string; vencimento: Vencimento67; cobrador: string; etiqueta: string };
export function situacaoVencimento67(item: ListaSeguraEmprestimos['items'][number]) {
  if (item.kind === 'unavailable') return 'indisponivel';
  if (item.arquivado || item.statusObrigacao !== 'ativo') return 'historico';
  const r = item.resumoParcelas;
  if (!r || !dataMultimodalValida(r.dataReferencia) || (r.proximoVencimento !== null && !dataMultimodalValida(r.proximoVencimento))) return 'indisponivel';
  if (r.proximoVencimento === null) return 'sem_vencimento';
  return r.proximoVencimento < r.dataReferencia ? 'atrasados' : 'emdia';
}
export const rotuloVencimento67 = (item: ListaSeguraEmprestimos['items'][number]) => ({
  indisponivel: 'Situação de vencimento indisponível', historico: 'Histórico / arquivado — sem classificação de adimplência',
  sem_vencimento: 'Sem vencimento operacional — não presume pagamento', atrasados: 'Atrasado na data da consulta', emdia: 'Em dia na data da consulta',
})[situacaoVencimento67(item)];
export function metadataContrato67(data: ListaSeguraEmprestimos, id: number) {
  return data.organizacao67?.state === 'confirmed' ? data.organizacao67.contratos.find(c => c.id === id) : undefined;
}
export function filtrarLista67(data: ListaSeguraEmprestimos, f: Filtros67): ListaSeguraEmprestimos['items'] {
  const org = data.organizacao67;
  const metadados = new Map(org?.state === 'confirmed' ? org.contratos.map(c => [c.id, c] as const) : []);
  return data.items.filter(item => {
    if (item.kind === 'unavailable') return true;
    const m = metadados.get(item.id);
    return noArquivo51(item, f.arquivo) && item.clienteNome.toLocaleLowerCase('pt-BR').includes(f.busca.trim().toLocaleLowerCase('pt-BR')) &&
      (f.modalidade === 'todos' || item.modalidade === f.modalidade) && (f.statusObrigacao === 'todos' || item.statusObrigacao === f.statusObrigacao) &&
      (f.vencimento === 'todos' || situacaoVencimento67(item) === f.vencimento) &&
      (f.cobrador === 'todos' || (m?.cobrador.state === 'confirmed' && (f.cobrador === 'sem' ? m.cobrador.id === null : String(m.cobrador.id) === f.cobrador))) &&
      (f.etiqueta === 'todos' || (m?.etiquetas.state === 'confirmed' && (f.etiqueta === 'sem' ? m.etiquetas.nomes.length === 0 : m.etiquetas.nomes.includes(f.etiqueta.slice(5)))));
  }).sort((a, b) => Number(a.kind === 'unavailable') - Number(b.kind === 'unavailable'));
}
export function agruparClientes67(items: ListaSeguraEmprestimos['items']) {
  const grupos = new Map<number, { clienteId: number; nome: string; items: EmprestimoValidadoLista[] }>();
  for (const item of items) if (item.kind === 'validated') {
    let grupo = grupos.get(item.clienteId);
    if (!grupo) { grupo = { clienteId: item.clienteId, nome: item.clienteNome, items: [] }; grupos.set(item.clienteId, grupo); }
    grupo.items.push(item);
  }
  return [...grupos.values()];
}
