export type CompensacaoRenovacaoJuros = {
  removerParcelaRenovada?: () => Promise<void>;
  removerLancamentoCaixa: () => Promise<void>;
  restaurarParcelaOriginal: () => Promise<void>;
};

/**
 * Tenta reverter todas as gravações de uma renovação REST incompleta. As
 * chamadas são independentes e executadas mesmo quando uma delas falha, para
 * não deixar a baixa, o caixa e a nova parcela em estados misturados.
 */
export async function compensarRenovacaoJuros({
  removerParcelaRenovada,
  removerLancamentoCaixa,
  restaurarParcelaOriginal,
}: CompensacaoRenovacaoJuros): Promise<void> {
  const etapas = [
    ...(removerParcelaRenovada ? [removerParcelaRenovada] : []),
    removerLancamentoCaixa,
    restaurarParcelaOriginal,
  ];
  const resultados = await Promise.allSettled(etapas.map((etapa) => etapa()));
  const falhas = resultados.filter((resultado): resultado is PromiseRejectedResult => resultado.status === "rejected");
  if (falhas.length > 0) {
    const detalhes = falhas
      .map((falha) => falha.reason instanceof Error ? falha.reason.message : String(falha.reason))
      .join("; ");
    throw new Error(`A compensação da renovação encontrou falha: ${detalhes}`);
  }
}
