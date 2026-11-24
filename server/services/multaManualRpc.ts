import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { ClienteEmprestimosRpc } from "./emprestimosRpc";
import { jsonMultimodalSeguro } from "../../shared/emprestimosMultimodalCalculo";
import {
  aplicarMultaSchema, consultaMultaSchema, receberMultaSchema, consultaRenovacaoMultaSchema, renovarMultaSchema,
  capacidadesMultaSchema, multaIndisponivel, normalizarOrigemMulta, normalizarAplicacaoMulta,
  normalizarCotacaoMulta, normalizarRecebimentoMulta, normalizarCotacaoRenovacaoMulta, normalizarRenovacaoMulta,
  validarRecuperacaoMulta, requestSqlRecuperacaoMulta, normalizarRespostaSqlRecuperacaoMulta,
  type EntradaAplicarMulta, type ConsultaMulta, type EntradaReceberMulta,
  type ConsultaRenovacaoMulta, type EntradaRenovarMulta, type RecoveryMultaRequest,
} from "../../shared/multaManual";
export * from "../../shared/multaManual";
const id = z.number().int().positive().max(2147483647);
function falhar(code: TRPCError["code"], message: string): never { throw new TRPCError({ code, message }); }
function tenant(userId: number) {
  if (!id.safeParse(userId).success) falhar("UNAUTHORIZED", "Sessão financeira inválida.");
}
function adaptar<T>(code: "BAD_REQUEST" | "INTERNAL_SERVER_ERROR", executar: () => T): T {
  try { return executar(); }
  catch { falhar(code, "Intenção/confirmação multa36 inválida; preserve UUID/payload sem presumir rollback."); }
}
function entrada<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  return adaptar("BAD_REQUEST", () => schema.parse(value));
}
function envelope(value: unknown): { data: unknown; error: null | Record<string, unknown> } {
  if (!jsonMultimodalSeguro(value) || value === null || typeof value !== "object" || Array.isArray(value) ||
    !Object.hasOwn(value, "data") || !Object.hasOwn(value, "error") ||
    Object.keys(value).some(k => !["data", "error", "count", "status", "statusText", "success"].includes(k)))
    falhar("INTERNAL_SERVER_ERROR", "Envelope RPC inválido; preserve UUID/payload sem presumir rollback.");
  const r = value as { data: unknown; error: unknown; success?: unknown; status?: unknown; statusText?: unknown; count?: unknown };
  if ((Object.hasOwn(r, "success") && (typeof r.success !== "boolean" || r.success !== (r.error === null))) ||
    (Object.hasOwn(r, "status") && (typeof r.status !== "number" || !Number.isInteger(r.status) || r.status < 0 || r.status > 599)) ||
    (Object.hasOwn(r, "statusText") && typeof r.statusText !== "string") ||
    (Object.hasOwn(r, "count") && r.count !== null && (typeof r.count !== "number" || !Number.isSafeInteger(r.count) || r.count < 0)))
    falhar("INTERNAL_SERVER_ERROR", "Envelope RPC contraditório; preserve UUID/payload sem presumir rollback.");
  if (typeof r.status === "number" && (r.error === null ? r.status < 200 || r.status >= 300 : r.status !== 0 && r.status < 400))
    falhar("INTERNAL_SERVER_ERROR", "Status RPC contraditório; preserve UUID/payload sem presumir rollback.");
  if (r.error !== null) {
    if (typeof r.error !== "object" || Array.isArray(r.error) || r.error === undefined || r.data !== null ||
      Object.keys(r.error).some(k => !["code", "message", "details", "hint"].includes(k)))
      falhar("INTERNAL_SERVER_ERROR", "Erro RPC inválido; resultado financeiro não confirmado.");
    const e = r.error as Record<string, unknown>;
    for (const k of ["code", "message", "details", "hint"]) {
      if (Object.hasOwn(e, k) && e[k] !== null && typeof e[k] !== "string")
        falhar("INTERNAL_SERVER_ERROR", "Erro RPC inválido; resultado financeiro não confirmado.");
    }
    return { data: null, error: e };
  }
  return { data: r.data, error: null };
}
async function executar(cliente: ClienteEmprestimosRpc, nome: string, parametros: Record<string, unknown>) {
  let response: unknown;
  try { response = await cliente.rpc(nome, parametros); }
  catch { falhar("INTERNAL_SERVER_ERROR", "Transporte sem confirmação. Preserve o mesmo UUID/payload; timeout não prova rollback."); }
  return envelope(response);
}
function erroSql(e: Record<string, unknown>): never {
  const code = e.code;
  if (["22023", "22007", "22008", "22P02", "22003"].includes(code as string)) falhar("BAD_REQUEST", "Intenção financeira inválida; preserve UUID/payload até conferir a execução.");
  if (["23505", "23514", "40001", "40P01", "55000"].includes(code as string)) falhar("CONFLICT", "Estado, cotação ou UUID divergente/fechado; preserve UUID/payload. Erro não prova rollback.");
  if (code === "42501") falhar("NOT_FOUND", "Contrato, parcela ou conta indisponível para esta empresa.");
  if (["PGRST202", "42883", "42P01"].includes(code as string)) falhar("PRECONDITION_FAILED", "Ciclo multa36 indisponível; nenhum fallback será executado.");
  falhar("INTERNAL_SERVER_ERROR", "Resultado financeiro não confirmado; preserve o mesmo UUID/payload.");
}
/** Uma chamada por intenção, sem retry automático, REST, adoção ou alteração de UUID. */
async function chamar(cliente: ClienteEmprestimosRpc, nome: string, parametros: Record<string, unknown>) {
  tenant(parametros.p_user_id as number);
  if (!jsonMultimodalSeguro(parametros)) falhar("BAD_REQUEST", "Parâmetros RPC inválidos.");
  const r = await executar(cliente, nome, parametros);
  if (r.error !== null) erroSql(r.error);
  return r.data;
}
export async function disponibilidadeMulta(cliente: ClienteEmprestimosRpc, userId: number) {
  tenant(userId);
  const r = await executar(cliente, "rpc_capacidades_multa36", {});
  if (r.error !== null) {
    if (["PGRST202", "42883"].includes(r.error.code as string)) return { ...multaIndisponivel };
    falhar("INTERNAL_SERVER_ERROR", "Capacidade multa36 não comprovada; nenhum fallback será executado.");
  }
  return adaptar("INTERNAL_SERVER_ERROR", () => capacidadesMultaSchema.parse(r.data));
}
export async function aplicarMulta(cliente: ClienteEmprestimosRpc, userId: number, input: EntradaAplicarMulta) {
  tenant(userId); const i = entrada(aplicarMultaSchema, input);
  const value = await chamar(cliente, "rpc_aplicar_multa36", {
    p_user_id: userId, p_chave_idempotencia: i.idempotencyKey, p_contrato_id: i.idcontrato,
    p_multa: i.multa, p_parcelas_ids: i.parcelasIds ?? null,
  });
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarAplicacaoMulta(value, i));
}
export async function identificarMulta(cliente: ClienteEmprestimosRpc, userId: number, input: ConsultaMulta) {
  tenant(userId); const i = entrada(consultaMultaSchema, input);
  const value = await chamar(cliente, "rpc_identificar_multa36", { p_user_id: userId, p_contrato_id: i.contratoId, p_parcela_id: i.parcelaId });
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarOrigemMulta(value, userId, i));
}
export async function cotarMulta(cliente: ClienteEmprestimosRpc, userId: number, input: ConsultaMulta) {
  tenant(userId); const i = entrada(consultaMultaSchema, input);
  const value = await chamar(cliente, "rpc_cotar_multa36", { p_user_id: userId, p_contrato_id: i.contratoId, p_parcela_id: i.parcelaId });
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarCotacaoMulta(value, i));
}
export async function receberMulta(cliente: ClienteEmprestimosRpc, userId: number, input: EntradaReceberMulta) {
  tenant(userId); const i = entrada(receberMultaSchema, input);
  const value = await chamar(cliente, "rpc_receber_multa36", {
    p_user_id: userId, p_chave_idempotencia: i.idempotencyKey, p_contrato_id: i.contratoId, p_parcela_id: i.parcelaId,
    p_valor_recebido: i.valorRecebido, p_total_exigido: i.totalExigido, p_data_pagamento: i.dataPagamento,
    p_estado_hash: i.estadoHash, p_modo: i.modo, p_observacoes: i.observacoes?.trim() || null,
  });
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarRecebimentoMulta(value, i));
}
export async function cotarRenovacaoMulta(cliente: ClienteEmprestimosRpc, userId: number, input: ConsultaRenovacaoMulta) {
  tenant(userId); const i = entrada(consultaRenovacaoMultaSchema, input);
  const value = await chamar(cliente, "rpc_cotar_renovacao_multa36", {
    p_user_id: userId, p_contrato_id: i.contratoId, p_parcela_id: i.parcelaId, p_novo_vencimento: i.novoVencimento,
  });
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarCotacaoRenovacaoMulta(value, i));
}
export async function renovarMulta(cliente: ClienteEmprestimosRpc, userId: number, input: EntradaRenovarMulta) {
  tenant(userId); const i = entrada(renovarMultaSchema, input);
  const value = await chamar(cliente, "rpc_renovar_multa36", {
    p_user_id: userId, p_chave_idempotencia: i.idempotencyKey, p_contrato_id: i.contratoId, p_parcela_id: i.parcelaId,
    p_valor_recebido: i.valorRecebido, p_total_exigido: i.totalExigido, p_data_pagamento: i.dataPagamento,
    p_estado_hash: i.estadoHash, p_novo_vencimento: i.novoVencimento, p_observacoes: i.observacoes?.trim() || null,
  });
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarRenovacaoMulta(value, i));
}
export async function reconciliarMulta(cliente: ClienteEmprestimosRpc, userId: number, input: RecoveryMultaRequest) {
  tenant(userId); const i = adaptar("BAD_REQUEST", () => validarRecuperacaoMulta(input));
  const p_request = adaptar("BAD_REQUEST", () => requestSqlRecuperacaoMulta(i));
  const value = await chamar(cliente, "rpc_reconciliar_multa36", { p_user_id: userId, p_chave_idempotencia: i.idempotencyKey, p_request });
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarRespostaSqlRecuperacaoMulta(value, userId, i));
}
