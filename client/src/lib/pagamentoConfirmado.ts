type ResultadoComPendencias = {
  confirmadoFinanceiro?: unknown;
  pendenciasPosConfirmacao?: unknown;
};

/**
 * A mutation pode confirmar a parcela e o lançamento de caixa, mas informar
 * pendências de efeitos derivados (histórico, auditoria ou status do contrato).
 * Esta mensagem impede que a interface esconda essa condição do operador.
 */
export function avisoDePendenciasPosPagamento(resultado: unknown): string | null {
  const dados = resultado as ResultadoComPendencias | null;
  if (!dados?.confirmadoFinanceiro || !Array.isArray(dados.pendenciasPosConfirmacao) || dados.pendenciasPosConfirmacao.length === 0) {
    return null;
  }

  return "Pagamento confirmado no Caixa, mas há uma pendência de sincronização. Atualize a tela e confira o histórico.";
}
