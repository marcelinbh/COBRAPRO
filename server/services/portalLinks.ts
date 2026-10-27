import crypto from "crypto";

export type LinkPortalConsumido = {
  clienteId: number;
};

/** O token bruto é enviado somente no link; novas linhas guardam exclusivamente SHA-256. */
export function hashTokenPortal(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Durante a transição, aceita links legados em texto puro até expirarem. Novos
 * links sempre são gravados com a hash. O conjunto é deduplicado por segurança.
 */
export function candidatosTokenPortal(token: string): string[] {
  return Array.from(new Set([hashTokenPortal(token), token]));
}

/**
 * Compare-and-set no REST do Supabase. Apenas a primeira requisição com token
 * ainda válido pode trocar `usado` de false para true e receber o cliente.
 */
export async function consumirLinkPortalNoSupabase(
  supabase: any,
  token: string,
  agora: Date,
): Promise<LinkPortalConsumido | null> {
  const { data, error } = await supabase
    .from("magic_links")
    .update({ usado: true })
    .in("token", candidatosTokenPortal(token))
    .eq("usado", false)
    .gt("expires_at", agora.toISOString())
    .select("cliente_id")
    .maybeSingle();

  if (error) throw new Error(`Não foi possível consumir o link do portal: ${error.message}`);
  const clienteId = data?.cliente_id ?? data?.clienteId;
  return typeof clienteId === "number" ? { clienteId } : null;
}

/** Reduz a resposta pública aos campos estritamente exibidos pela tela. */
export function normalizarParcelasPortal(parcelas: Array<Record<string, unknown>>) {
  const preferirSnakeCase = (parcela: Record<string, unknown>, snake: string, camel: string) => (
    Object.prototype.hasOwnProperty.call(parcela, snake) ? parcela[snake] : parcela[camel]
  );

  return parcelas.map((parcela) => ({
    id: parcela.id,
    numeroParcela: preferirSnakeCase(parcela, "numero_parcela", "numeroParcela"),
    numeroParcelas: preferirSnakeCase(parcela, "numero_parcelas", "numeroParcelas"),
    valorOriginal: preferirSnakeCase(parcela, "valor_original", "valorOriginal"),
    valorPago: preferirSnakeCase(parcela, "valor_pago", "valorPago"),
    dataVencimento: preferirSnakeCase(parcela, "data_vencimento", "dataVencimento"),
    dataPagamento: preferirSnakeCase(parcela, "data_pagamento", "dataPagamento"),
    status: parcela.status,
  }));
}
