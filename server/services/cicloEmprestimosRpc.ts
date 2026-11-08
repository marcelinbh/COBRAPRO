import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { dataEmprestimoValida, type ClienteEmprestimosRpc } from "./emprestimosRpc";

const id = z.number().int().positive().max(2147483647);
const uuid = z.string().uuid();
const dinheiro = z.string().regex(/^(0|[1-9]\d{0,9})\.\d{2}$/);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const date = z.string().refine(dataEmprestimoValida);
const regra = z.literal("recebimento_defaults_brt_v1");
export const consultaCicloSchema = z.object({ contratoId: id, parcelaId: id }).strict();
export const entradaRecebimentoProspectivoSchema = consultaCicloSchema.extend({
  idempotencyKey: uuid, valorRecebido: dinheiro, totalExigido: dinheiro,
  dataPagamento: date, estadoHash: hash, modo: z.enum(["integral", "parcial"]),
  observacoes: z.string().max(1000).optional(),
}).strict().superRefine((v, ctx) => {
  if (!dinheiro.safeParse(v.valorRecebido).success || !dinheiro.safeParse(v.totalExigido).success) return;
  const pago = centavos(v.valorRecebido), total = centavos(v.totalExigido);
  if (pago <= BigInt(0) || total <= BigInt(0) ||
      (v.modo === "integral" ? pago !== total : pago >= total)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Integral exige valor exato; parcial deve ser positivo e menor. Descontos não suportados." });
  }
});
export type EntradaRecebimentoProspectivo = z.infer<typeof entradaRecebimentoProspectivoSchema>;
const cotacaoSchema = z.object({
  elegivel: z.boolean(), contratoId: id, parcelaId: id, contaCaixaId: id,
  totalExigido: dinheiro, multa: dinheiro, mora: dinheiro, jurosEmbutidos: dinheiro,
  valorPagoAcumulado: dinheiro, dataPagamento: date, vencimento: date,
  status: z.enum(["pendente", "atrasada", "vencendo_hoje", "parcial", "paga"]),
  estadoHash: hash, regra,
}).strict();
export type CotacaoEmprestimoProspectivo = z.infer<typeof cotacaoSchema>;
const resultadoSchema = z.object({
  success: z.literal(true), repetida: z.boolean(), operationId: uuid,
  contratoId: id, parcelaId: id, transacaoCaixaId: z.string().regex(/^[1-9]\d{0,18}$/),
  contaCaixaId: id, valorRecebido: dinheiro, totalExigido: dinheiro,
  saldoResidual: dinheiro, valorPagoAcumulado: dinheiro,
  status: z.enum(["paga", "parcial"]), contratoStatus: z.enum(["ativo", "quitado"]),
  dataPagamento: date, regra,
}).strict();
export type ResultadoRecebimentoProspectivo = z.infer<typeof resultadoSchema>;
function centavos(v: string): bigint { return BigInt(v.replace(".", "")); }
function falhar(code: TRPCError["code"], message: string): never { throw new TRPCError({ code, message }); }
export function exigirCicloEmprestimosProspectivos(): void {
  if (process.env.ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS !== "true" || process.env.ENABLE_RPC_CICLO_EMPRESTIMOS_PROSPECTIVOS !== "true") {
    falhar("PRECONDITION_FAILED", "Ciclo prospectivo indisponível: criação e recebimento devem estar habilitados juntos. Sem REST legado.");
  }
}
function validarTenant(userId: number) { if (!id.safeParse(userId).success) falhar("BAD_REQUEST", "Tenant do servidor inválido."); }
async function rpc(cliente: ClienteEmprestimosRpc, nome: string, params: Record<string, unknown>) {
  let response: Awaited<ReturnType<ClienteEmprestimosRpc["rpc"]>>;
  try { response = await cliente.rpc(nome, params); }
  catch { falhar("INTERNAL_SERVER_ERROR", "Transporte sem confirmação: preserve UUID e payload; não é prova de rollback."); }
  if (response.error) {
    const c = response.error.code;
    if (["22023", "22007", "22008", "22P02"].includes(c ?? "")) falhar("BAD_REQUEST", "Intenção inválida, desconto ou valor integral divergente.");
    if (["23505", "23514", "40001", "40P01"].includes(c ?? "")) falhar("CONFLICT", "Estado, cotação ou idempotência divergente. Confira a mesma intenção; não substitua o UUID automaticamente.");
    if (c === "42501") falhar("NOT_FOUND", "Proveniência 0021 íntegra, parcela ou conta não disponível para esta empresa.");
    if (["PGRST202", "42883", "42P01"].includes(c ?? "")) falhar("PRECONDITION_FAILED", "RPC/schema indisponível. Não há fallback.");
    falhar("INTERNAL_SERVER_ERROR", "Sem confirmação financeira: repita/conﬁra a mesma chave e payload, sem presumir rollback.");
  }
  return response.data;
}
export async function cotarEmprestimoProspectivo(cliente: ClienteEmprestimosRpc, userId: number, input: z.infer<typeof consultaCicloSchema>): Promise<CotacaoEmprestimoProspectivo> {
  exigirCicloEmprestimosProspectivos(); validarTenant(userId);
  const i = consultaCicloSchema.safeParse(input);
  if (!i.success) falhar("BAD_REQUEST", "Consulta inválida.");
  const value = await rpc(cliente, "rpc_cotar_emprestimo_prospectivo", { p_user_id: userId, p_contrato_id: i.data.contratoId, p_parcela_id: i.data.parcelaId });
  const r = cotacaoSchema.safeParse(value);
  if (!r.success || r.data.contratoId !== input.contratoId || r.data.parcelaId !== input.parcelaId ||
      r.data.elegivel !== (centavos(r.data.totalExigido) > BigInt(0)) || (r.data.status === "paga") !== !r.data.elegivel) {
    falhar("INTERNAL_SERVER_ERROR", "Cotação SQL inválida; não confirme recebimento.");
  }
  return r.data;
}
export function normalizarRecebimentoProspectivo(value: unknown, input: EntradaRecebimentoProspectivo): ResultadoRecebimentoProspectivo {
  const parsed = resultadoSchema.safeParse(value);
  if (!parsed.success) falhar("INTERNAL_SERVER_ERROR", "Confirmação inválida; preserve UUID/payload para conferir sem presumir rollback.");
  const r = parsed.data;
  if (r.contratoId !== input.contratoId || r.parcelaId !== input.parcelaId || r.dataPagamento !== input.dataPagamento ||
      r.valorRecebido !== input.valorRecebido || r.totalExigido !== input.totalExigido ||
      centavos(r.saldoResidual) !== centavos(input.totalExigido) - centavos(input.valorRecebido) ||
      (r.status === "paga") !== (centavos(r.saldoResidual) === BigInt(0)) ||
      (input.modo === "integral") !== (r.status === "paga") ||
      centavos(r.valorPagoAcumulado) < centavos(r.valorRecebido) ||
      (r.contratoStatus === "quitado" && r.status !== "paga") || BigInt(r.transacaoCaixaId) > BigInt("9223372036854775807")) {
    falhar("INTERNAL_SERVER_ERROR", "Confirmação divergiu da intenção; confira a operação com a mesma chave antes de prosseguir.");
  }
  return r;
}
export async function receberEmprestimoProspectivoAtomico(cliente: ClienteEmprestimosRpc, userId: number, input: EntradaRecebimentoProspectivo): Promise<ResultadoRecebimentoProspectivo> {
  exigirCicloEmprestimosProspectivos(); validarTenant(userId);
  const parsed = entradaRecebimentoProspectivoSchema.safeParse(input);
  if (!parsed.success) falhar("BAD_REQUEST", "Recebimento inválido: centavos exatos, UUID, DATE, modo e cotação SQL obrigatórios. Sem desconto.");
  const i = parsed.data;
  const value = await rpc(cliente, "rpc_receber_emprestimo_prospectivo", {
    p_user_id: userId, p_chave_idempotencia: i.idempotencyKey, p_contrato_id: i.contratoId, p_parcela_id: i.parcelaId,
    p_valor_recebido: i.valorRecebido, p_total_exigido: i.totalExigido, p_data_pagamento: i.dataPagamento,
    p_estado_hash: i.estadoHash, p_modo: i.modo, p_observacoes: i.observacoes?.trim() || null,
  });
  return normalizarRecebimentoProspectivo(value, i);
}
