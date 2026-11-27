import type { Projection51 } from '../../shared/obrigacoes51';
import type { ResumoParcelasLista63 } from '../../shared/emprestimosListaSegura';

/** Somente após os guards60/51 e apresentarEmprestimo: não consulta, recalcula dinheiro ou autoriza escrita. */
export function resumirParcelasLista63(
  state: Projection51,
  parcelas: readonly { id: number; data_vencimento: string }[],
  dataReferencia: string,
): ResumoParcelasLista63 {
  const resumo: ResumoParcelasLista63 = {
    total: state.parcelas.length, abertas: 0, pagas: 0, canceladas: 0,
    transferidas: 0, arquivadas: 0, proximoVencimento: null, dataReferencia,
  };
  const datas = new Map(parcelas.map(p => [p.id, p.data_vencimento]));
  for (const p of state.parcelas) {
    switch (p.statusObrigacao) {
      case 'aberta': resumo.abertas++; break;
      case 'paga': resumo.pagas++; break;
      case 'cancelada': resumo.canceladas++; break;
      case 'transferida': resumo.transferidas++; break;
    }
    if (p.arquivada) resumo.arquivadas++;
    // Arquivo não fecha a obrigação: só exclui o vencimento operacional.
    if (state.statusObrigacao === 'ativo' && !state.arquivado && p.statusObrigacao === 'aberta' && !p.arquivada) {
      const data = datas.get(p.parcelaId);
      // IDs e DATE já validados pelo chamador; ausência é divergência, não calendário vazio.
      if (data === undefined) throw new Error('Resumo63 exige o conjunto de parcelas validado.');
      if (resumo.proximoVencimento === null || data < resumo.proximoVencimento) resumo.proximoVencimento = data;
    }
  }
  return resumo;
}
