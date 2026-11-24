import { TRPCError } from "@trpc/server";
import { cheque40IntentSchema, validarFenceCheque40, type Cheque40Intent, type Cheque40Fence } from "../../shared/cheques40";
import type { Cheques40RpcClient } from "./cheques40Rpc";
export async function abandonarCheque40(client: Cheques40RpcClient, owner: number, input: Cheque40Intent): Promise<Cheque40Fence> {
  const intent = cheque40IntentSchema.parse(input);
  if (!Number.isInteger(owner) || owner <= 0) throw new TRPCError({ code: "FORBIDDEN" });
  try {
    const envelope = await client.rpc("rpc_abandonar_cheques40", { p_user_id: owner, p_chave: intent.idempotencyKey, p_request: intent.request });
    if (!envelope || typeof envelope !== "object" || !("error" in envelope) || envelope.error !== null || !("data" in envelope)) throw new Error("Fence não confirmado");
    return validarFenceCheque40(envelope.data, intent);
  } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Abandono não confirmado. Intenção preservada; recupere ou tente confirmar o abandono novamente." }); }
}
