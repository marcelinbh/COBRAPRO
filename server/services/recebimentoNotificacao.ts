import { enfileirarConfirmacaoPagamento } from "./notificacoesAutomaticas";

type FonteSegura = "ciclo_operacoes" | "legados_operacoes";
type RecebimentoConfirmado = { success: true; operationId: string };

/** Fora da transação financeira: consulta prova durável e deduplica pela operação.
 * Falha de fila não desfaz nem oculta o recebimento confirmado. Não envia ao provedor. */
export async function recebimentoComConfirmacao<T extends RecebimentoConfirmado>(
  userId: number,
  fonte: FonteSegura,
  receber: () => Promise<T>
): Promise<T> {
  const resultado = await receber(); // O adaptador já validou a confirmação SQL completa.
  if (resultado.success !== true || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resultado.operationId)) {
    throw new Error("Recebimento sem confirmação válida; aviso não solicitado.");
  }
  try {
    await enfileirarConfirmacaoPagamento(userId, fonte, resultado.operationId);
  } catch {
    // Sem PII, erro bruto ou alegação de entrega. Retry financeiro mantém o UUID
    // e retorna a mesma operação, permitindo nova tentativa idempotente da fila.
    console.warn("[WhatsApp] Confirmação não enfileirada; recebimento confirmado preservado.");
  }
  return resultado;
}
