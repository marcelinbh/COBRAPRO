/** Limites centralizados para impedir que endpoints comuns consumam memória de upload. */
// 3 MB suporta logos de até 2 MB codificados em base64 nas procedures tRPC.
export const LIMITE_CORPO_PADRAO = "3mb";
export const LIMITE_CORPO_UPLOAD = "15mb";
export const LIMITE_FORMULARIO = "256kb";
