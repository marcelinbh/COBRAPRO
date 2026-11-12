import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { ClienteEmprestimosRpc } from "./emprestimosRpc";

export const REGRA_RECEBIMENTO_LEGADO = "recebimento_legado_sem_recalculo_v1" as const;
const id = z.number().int().positive().max(2147483647);
const uuid = z.string().uuid();
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const dinheiro = z.string().regex(/^(0|[1-9]\d{0,9})\.\d{2}$/);
const date = z.string().refine(v => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
});
export const consultaRecebimentoLegadoSchema = z.object({ contratoId: id, parcelaId: id, contaCaixaId: id }).strict();
export const entradaRecebimentoLegadoSchema = consultaRecebimentoLegadoSchema.extend({
  idempotencyKey: uuid, estadoHash: hash, regra: z.literal(REGRA_RECEBIMENTO_LEGADO),
  totalExigido: dinheiro, valorRecebido: dinheiro, dataPagamento: date,
  observacoes: z.string().max(1000).optional(),
}).strict().superRefine((v, ctx) => {
  if (v.totalExigido === "0.00" || v.valorRecebido !== v.totalExigido)
    ctx.addIssue({ code: "custom", message: "Somente integral exato e positivo, sem encargos novos." });
});
export type EntradaRecebimentoLegado = z.infer<typeof entradaRecebimentoLegadoSchema>;
const positiva = consultaRecebimentoLegadoSchema.extend({
  elegivel: z.literal(true), regra: z.literal(REGRA_RECEBIMENTO_LEGADO), totalExigido: dinheiro,
  estadoHash: hash, dataPagamento: date, validadeDataCivil: date,
}).strict();
const negativa = z.object({ elegivel: z.literal(false), motivos: z.array(z.enum([
  "TENANT_AUSENTE_OU_DIVERGENTE", "TRILHO_PROSPECTIVO", "ESTADO_NAO_SUPORTADO", "ALIAS_DIVERGENTE",
  "PRINCIPAL_INVALIDO", "ENCARGOS_AMBIGUOS", "LEDGER_DIVERGENTE_OU_AMBIGUO", "DESCENDENTE_INVALIDO",
  "CONTA_PROTEGIDA", "REGISTRO_INDISPONIVEL",
])).min(1).max(10) }).strict();
const cotacao = z.discriminatedUnion("elegivel", [positiva, negativa]);
export type CotacaoRecebimentoLegado = z.infer<typeof cotacao>;
const resultado = consultaRecebimentoLegadoSchema.extend({
  success: z.literal(true), repetida: z.boolean(), operationId: uuid,
  transacaoCaixaId: z.string().regex(/^[1-9]\d{0,9}$/),
  valorRecebido: dinheiro, totalExigido: dinheiro, valorPagoAcumulado: dinheiro,
  saldoResidual: z.literal("0.00"), status: z.literal("paga"),
  contratoStatus: z.enum(["ativo", "atrasado", "quitado"]), dataPagamento: date,
  regra: z.literal(REGRA_RECEBIMENTO_LEGADO),
}).strict();
export type ResultadoRecebimentoLegado = z.infer<typeof resultado>;
function fail(code: TRPCError["code"], message: string): never { throw new TRPCError({ code, message }); }
export function exigirRecebimentosLegados(): void {
  if (process.env.ENABLE_RPC_RECEBIMENTO_LEGADO_VALIDADO !== "true")
    fail("PRECONDITION_FAILED", "Recebimento legado validado desabilitado. Sem alternativa REST ou flags antigas.");
}
async function call(client: ClienteEmprestimosRpc, name: string, params: Record<string, unknown>) {
  let r: Awaited<ReturnType<ClienteEmprestimosRpc["rpc"]>>;
  try { r = await client.rpc(name, params); }
  catch { fail("INTERNAL_SERVER_ERROR", "Transporte sem confirmação. Preserve e repita o mesmo UUID/payload; não presuma rollback."); }
  if (r.error) {
    const c = r.error.code;
    if (["22023", "22007", "22008", "22P02"].includes(c ?? "")) fail("BAD_REQUEST", "Intenção inválida: integral exato, centavos e data SQL obrigatórios.");
    if (["23505", "23514", "40001", "40P01"].includes(c ?? "")) fail("CONFLICT", "Registro/cotação/UUID não elegível ou desatualizado. Confira a mesma intenção, sem gerar outra chave.");
    if (c === "42501") fail("NOT_FOUND", "Registro indisponível para recebimento desta empresa.");
    if (["PGRST202", "42883", "42P01", "55000"].includes(c ?? "")) fail("PRECONDITION_FAILED", "RPC ou metadados indisponíveis. Sem fallback.");
    fail("INTERNAL_SERVER_ERROR", "Sem confirmação financeira. Preserve UUID/payload e confira sem presumir rollback.");
  }
  return r.data;
}
function tenant(userId: number) { if (!id.safeParse(userId).success) fail("BAD_REQUEST", "Sessão inválida."); }
export async function cotarRecebimentoLegado(client: ClienteEmprestimosRpc, userId: number, value: z.infer<typeof consultaRecebimentoLegadoSchema>): Promise<CotacaoRecebimentoLegado> {
  exigirRecebimentosLegados(); tenant(userId);
  const i = consultaRecebimentoLegadoSchema.safeParse(value);
  if (!i.success) fail("BAD_REQUEST", "Consulta inválida.");
  const r = cotacao.safeParse(await call(client, "rpc_cotar_recebimento_legado", {
    p_user_id: userId, p_contrato_id: i.data.contratoId, p_parcela_id: i.data.parcelaId, p_conta_caixa_id: i.data.contaCaixaId,
  }));
  if (!r.success) fail("INTERNAL_SERVER_ERROR", "Cotação SQL inválida; não confirme recebimento.");
  if (r.data.elegivel && (r.data.contratoId !== i.data.contratoId || r.data.parcelaId !== i.data.parcelaId || r.data.contaCaixaId !== i.data.contaCaixaId || r.data.totalExigido === "0.00" || r.data.dataPagamento !== r.data.validadeDataCivil))
    fail("INTERNAL_SERVER_ERROR", "Cotação divergiu da consulta; não confirme recebimento.");
  return r.data;
}
export function normalizarRecebimentoLegado(value: unknown, i: EntradaRecebimentoLegado): ResultadoRecebimentoLegado {
  const parsed = resultado.safeParse(value);
  if (!parsed.success) fail("INTERNAL_SERVER_ERROR", "Confirmação SQL inválida; preserve UUID/payload para conferir.");
  const r = parsed.data;
  if (r.contratoId !== i.contratoId || r.parcelaId !== i.parcelaId || r.contaCaixaId !== i.contaCaixaId ||
    r.valorRecebido !== i.valorRecebido || r.totalExigido !== i.totalExigido || r.valorPagoAcumulado !== i.valorRecebido ||
    r.dataPagamento !== i.dataPagamento || BigInt(r.transacaoCaixaId) > BigInt(2147483647))
    fail("INTERNAL_SERVER_ERROR", "Confirmação divergiu da intenção; confira o mesmo UUID/payload antes de prosseguir.");
  return r;
}
export async function receberLegadoAtomico(client: ClienteEmprestimosRpc, userId: number, value: EntradaRecebimentoLegado): Promise<ResultadoRecebimentoLegado> {
  exigirRecebimentosLegados(); tenant(userId);
  const parsed = entradaRecebimentoLegadoSchema.safeParse(value);
  if (!parsed.success) fail("BAD_REQUEST", "Entrada inválida: somente integral, sem desconto/juros novos ou userId do navegador.");
  const i = parsed.data;
  return normalizarRecebimentoLegado(await call(client, "rpc_receber_legado", {
    p_user_id: userId, p_chave_idempotencia: i.idempotencyKey, p_contrato_id: i.contratoId, p_parcela_id: i.parcelaId,
    p_conta_caixa_id: i.contaCaixaId, p_valor_recebido: i.valorRecebido, p_total_exigido: i.totalExigido,
    p_data_pagamento: i.dataPagamento, p_estado_hash: i.estadoHash, p_regra: i.regra, p_observacoes: i.observacoes ?? null,
  }), i);
}
