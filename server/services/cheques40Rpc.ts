import { TRPCError } from "@trpc/server";
import { cheque40IntentSchema, cheque40ResultSchema, type Cheque40Intent, type Cheque40Result } from "../../shared/cheques40";
export interface Cheques40RpcClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<unknown> }
/** Nunca usa REST DML/ORM nem gera UUID server-side; retry = MESMA intenção persistida. */
export async function executarCheque40(client: Cheques40RpcClient, userId: number, input: Cheque40Intent): Promise<Cheque40Result> {
  const parsed = cheque40IntentSchema.safeParse(input);
  if (!parsed.success || !Number.isInteger(userId) || userId <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Intenção de cheque inválida." });
  const intent = parsed.data;
  let response: unknown;
  try { response = await client.rpc("rpc_cheques40", { p_user_id: userId, p_chave: intent.idempotencyKey, p_request: intent.request }); }
  catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Resultado não confirmado. Preserve e recupere a mesma intenção de cheque." }); }
  if (!response || typeof response !== "object" || !("data" in response) || !("error" in response)) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Envelope de cheque não confirmado; preserve a intenção." });
  const { data, error } = response as { data: unknown; error: unknown };
  if (error !== null) {
    if (data !== null || !error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Resposta de cheque contraditória; preserve a intenção." });
    const code = error.code;
    if (code === "22023" || code === "22007" || code === "22008") throw new TRPCError({ code: "BAD_REQUEST", message: "O PostgreSQL recusou esta intenção sem gravar. Revise os dados." });
    if (code === "23505") throw new TRPCError({ code: "CONFLICT", message: "UUID ou cheque já processado. Não substitua a intenção pendente por outro payload." });
    if (code === "42501") throw new TRPCError({ code: "FORBIDDEN", message: "Cheque, cliente ou conta indisponível para esta operação." });
    if (["55000", "PGRST202", "42883", "23514"].includes(code)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cheque não liberado: saldo, integridade, provas financeiras ou migração não comprovados. Nenhum fallback executado." });
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Resultado não confirmado ou concorrência. Recupere com o mesmo UUID e payload." });
  }
  const result = cheque40ResultSchema.safeParse(data);
  const status = { criar: "descontado", compensar: "compensado", devolver: "devolvido", cancelar: "cancelado" } as const;
  if (!result.success || result.data.idempotencyKey !== intent.idempotencyKey || result.data.status !== status[intent.request.acao]
    || (intent.request.acao !== "criar" && result.data.id !== intent.request.id)
    || result.data.estornadoNoCaixa !== ["devolver", "cancelar"].includes(intent.request.acao)) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Prova de cheque não corresponde à intenção. Preserve UUID e payload." });
  return result.data;
}
