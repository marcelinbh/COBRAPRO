export type DesembolsoContratoInput = {
  contaCaixaId: number;
  contratoId: number;
  userId: number;
  valorPrincipal: number;
  dataTransacao?: string;
};

/**
 * Define o lançamento financeiro do capital liberado. O saldo do Caixa é
 * calculado pelo livro de transações, portanto não atualizamos saldo-base aqui.
 */
export function criarDesembolsoContrato(input: DesembolsoContratoInput) {
  return {
    conta_caixa_id: input.contaCaixaId,
    tipo: "saida" as const,
    categoria: "emprestimo_liberado",
    valor: Number(input.valorPrincipal.toFixed(2)),
    descricao: `Empréstimo liberado - Contrato #${input.contratoId}`,
    contrato_id: input.contratoId,
    data_transacao: input.dataTransacao ?? new Date().toISOString(),
    user_id: input.userId,
  };
}

/** Um contrato pode ter somente um desembolso automático por conta de Caixa. */
export function deveRegistrarDesembolso(existeDesembolso: boolean): boolean {
  return !existeDesembolso;
}
