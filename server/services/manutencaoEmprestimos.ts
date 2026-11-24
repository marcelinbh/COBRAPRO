import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { calendario44Schema, cotarCalendarioSchema, quoteSchema44, validarClosure44, type Calendario44 } from "../../shared/manutencaoEmprestimos";
export { calendario44Schema, cotarCalendarioSchema } from "../../shared/manutencaoEmprestimos";
const id = z.number().int().positive().max(2147483647);
const facades44 = { cotar: "rpc_cotar_calendario44", executar: "rpc_executar_calendario44", conferir: "rpc_conferir_calendario44" } as const;
export type ClienteCalendario44 = {
  // Public padrão do cliente de SERVIDOR. Namespace privado não é exposto nem selecionado.
  rpc(name: typeof facades44[keyof typeof facades44], args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
};
export function exigirCalendario44() {
  if (process.env.ENABLE_MANUTENCAO_EMPRESTIMOS_0044 !== "true") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Manutenção44 não habilitada/certificada. Sem fallback financeiro." });
}
function owner44(uid: number) {
  if (!id.safeParse(uid).success) throw new TRPCError({ code: "BAD_REQUEST", message: "Proprietário do servidor inválido." });
}
async function rpc44(client: ClienteCalendario44, name: "cotar" | "executar" | "conferir", args: Record<string, unknown>) {
  exigirCalendario44();
  let r: { data: unknown; error: { code?: string } | null };
  try { r = await client.rpc(facades44[name], args); }
  catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Sem confirmação: preserve a mesma intenção/UUID e confira ou repita. Não presuma rollback." }); }
  if (r.error) {
    const code = r.error.code;
    if (code === "42501") throw new TRPCError({ code: "NOT_FOUND", message: "Contrato indisponível para este proprietário." });
    if (["22023", "22007", "22008", "22P02"].includes(code ?? "")) throw new TRPCError({ code: "BAD_REQUEST", message: "Agenda/intenção inválida." });
    if (["23505", "23514", "40001", "40P01"].includes(code ?? "")) throw new TRPCError({ code: "CONFLICT", message: "Estado ou intenção divergente. Não troque a UUID da operação pendente." });
    if (["PGRST106", "PGRST202", "42883", "3F000", "55000"].includes(code ?? "")) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Schema44/RPC/catálogo não certificado ou indisponível. Sem fallback." });
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Operação sem confirmação. Confira a mesma intenção antes de prosseguir." });
  }
  return r.data;
}
export async function cotarCalendario44(client: ClienteCalendario44, uid: number, input: z.infer<typeof cotarCalendarioSchema>) {
  owner44(uid); const v = cotarCalendarioSchema.parse(input);
  const r = quoteSchema44.parse(await rpc44(client, "cotar", { p_user_id: uid, p_contrato_id: v.contratoId }));
  if (r.contratoId !== v.contratoId || r.parcelasIds.length !== r.vencimentos.length || new Set(r.parcelasIds).size !== r.parcelasIds.length) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Cotação de calendário inválida." });
  return r;
}
export async function manterCalendario44(client: ClienteCalendario44, uid: number, input: Calendario44, conferir = false) {
  owner44(uid); const v = calendario44Schema.parse(input);
  const data = await rpc44(client, conferir ? "conferir" : "executar", { p_user_id: uid, p_chave_idempotencia: v.idempotencyKey,
    p_contrato_id: v.contratoId, p_estado_hash: v.estadoHash, p_vencimentos: v.vencimentos, p_motivo: v.motivo });
  try { return validarClosure44(conferir ? data : { status: "confirmed", sameIntentOnly: true, resultado: data }, v); }
  catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Confirmação/fence diverge da intenção preservada; confira a mesma UUID. Sem encerramento local." }); }
}
