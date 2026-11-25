import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { cotarCalendarioSchema } from "../../shared/manutencaoEmprestimos";
const id = z.number().int().positive().max(2147483647);
export const origemCalendario46Schema = z.object({ empresaId: id, contratoId: id, origem: z.enum(["prospectivo21", "multimodal25", "nao_suportada"]), fluxo: z.enum(["calendario44", "calendario46", "bloqueado"]), codigo: z.enum(["cotar44", "cotar46", "origem_nao_suportada"]) }).strict();
interface ParcelaQuery46 extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: number): ParcelaQuery46;
  order(column: string, options: { ascending: boolean }): ParcelaQuery46;
  limit(n: number): ParcelaQuery46;
}
export type ClienteOrigemCalendario46 = {
  from(table: "parcelas"): { select(columns: "id"): ParcelaQuery46 };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
};
const registro = z.object({ userId: id, contratoId: id, parcelaId: id, trilho: z.enum(["multimodal", "prospectivo", "legado"]), status: z.string() }).strict();
function indisponivel(code: string | undefined): never {
  throw new TRPCError({ code: code === "42501" ? "NOT_FOUND" : "PRECONDITION_FAILED", message: "Origem de calendário indisponível. Não tentar outro writer ou fabricar criação21." });
}
/** Consulta de parcela apenas fornece vínculo. A origem é provada pela RPC; nunca modalidade/flag/URL do cliente. */
export async function identificarCalendario46(client: ClienteOrigemCalendario46, uid: number, input: z.infer<typeof cotarCalendarioSchema>) {
  if (!id.safeParse(uid).success) throw new TRPCError({ code: "BAD_REQUEST", message: "Sessão inválida." });
  const v = cotarCalendarioSchema.parse(input);
  const p = await client.from("parcelas").select("id").eq("user_id", uid).eq("contrato_id", v.contratoId).order("id", { ascending: true }).limit(1);
  if (p.error) indisponivel(undefined);
  const rows = z.array(z.object({ id }).strict()).max(1).safeParse(p.data);
  if (!rows.success || rows.data.length !== 1) indisponivel("42501");
  const args = { p_user_id: uid, p_contrato_id: v.contratoId, p_parcela_id: rows.data[0].id };
  let source: z.infer<typeof registro>;
  try {
    const multi = await client.rpc("rpc_identificar_emprestimo_multimodal", args);
    if (multi.error) indisponivel(multi.error.code);
    if (multi.data !== null) {
      source = registro.parse(multi.data);
      if (source.trilho !== "multimodal") indisponivel(undefined);
    } else {
      // NULL verificado significa ausência25; erro/timeout/schema indisponível NÃO permite fallback.
      const old = await client.rpc("legados_identificar_trilho", args);
      if (old.error) indisponivel(old.error.code);
      source = registro.parse(old.data);
      if (source.trilho === "multimodal") indisponivel(undefined);
    }
  } catch (e) {
    if (e instanceof TRPCError) throw e;
    indisponivel(undefined);
  }
  if (source.userId !== uid || source.contratoId !== v.contratoId || source.parcelaId !== rows.data[0].id) indisponivel(undefined);
  return origemCalendario46Schema.parse({ empresaId: uid, contratoId: v.contratoId,
    origem: source.trilho === "multimodal" ? "multimodal25" : source.trilho === "prospectivo" ? "prospectivo21" : "nao_suportada",
    fluxo: source.trilho === "prospectivo" ? "calendario44" : source.trilho === "multimodal" ? "calendario46" : "bloqueado",
    codigo: source.trilho === "prospectivo" ? "cotar44" : source.trilho === "multimodal" ? "cotar46" : "origem_nao_suportada" });
}
