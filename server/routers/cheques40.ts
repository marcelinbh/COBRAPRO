import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { cheque40IntentSchema } from "../../shared/cheques40";
import { executarCheque40 } from "../services/cheques40Rpc";
import { abandonarCheque40 } from "../services/cheques40Fence";
const executar = protectedProcedure.input(cheque40IntentSchema).mutation(async ({ ctx, input }) => {
  const client = await getSupabaseClientAsync();
  if (!client) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Fonte transacional de cheques indisponível; sem fallback." });
  return executarCheque40(client, ctx.user.id, input);
});
const abandonar = protectedProcedure.input(cheque40IntentSchema).mutation(async ({ ctx, input }) => {
  const client = await getSupabaseClientAsync();
  if (!client) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Fence indisponível. Intenção preservada." });
  return abandonarCheque40(client, ctx.user.id, input);
});
/** Reexecutar exatamente o mesmo UUID/request é recovery seguro após timeout, não uma nova intenção. */
export const cheques40Procedures = { executar40: executar, recuperar40: executar, abandonar40: abandonar };
