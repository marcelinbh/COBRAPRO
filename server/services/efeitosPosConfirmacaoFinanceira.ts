export type PendenciaPosConfirmacao = {
  etapa: string;
  codigo: string;
};

export type EtapaPosConfirmacao = {
  etapa: string;
  codigo: string;
  executar: () => Promise<void>;
};

/**
 * Depois de uma baixa e do lançamento no livro-caixa, efeitos derivados não
 * podem fazer a interface informar falsamente que o pagamento falhou. Cada
 * erro é preservado como pendência operacional para reconciliação, sem expor
 * detalhes internos ao navegador.
 */
export async function executarEfeitosPosConfirmacao(
  etapas: readonly EtapaPosConfirmacao[],
): Promise<PendenciaPosConfirmacao[]> {
  const pendencias: PendenciaPosConfirmacao[] = [];

  for (const etapa of etapas) {
    try {
      await etapa.executar();
    } catch (error) {
      console.error(`[Financeiro] Pendência após confirmação (${etapa.etapa}):`, error);
      pendencias.push({ etapa: etapa.etapa, codigo: etapa.codigo });
    }
  }

  return pendencias;
}
