import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { ClienteEmprestimosRpc } from "./emprestimosRpc";
import {
  jsonMultimodalSeguro, validarEntradaCriacaoMultimodal, normalizarResultadoCriacaoMultimodal,
  consultaMultimodalSchema, recebimentoMultimodalSchema, consultaRenovacaoMultimodalSchema, renovacaoMultimodalSchema,
  normalizarCotacaoMultimodal, normalizarRecebimentoMultimodal, normalizarCotacaoRenovacaoMultimodal, normalizarRenovacaoMultimodal,
  validarRecuperacaoMultimodal, normalizarRecuperacaoMultimodal,
  type EntradaMultimodal, type ConsultaMultimodal, type EntradaRecebimentoMultimodal,
  type ConsultaRenovacaoMultimodal, type EntradaRenovacaoMultimodal, type RecuperacaoMultimodal,
} from "../../shared/emprestimosMultimodalCalculo";

// Mantém os nomes usados pelo router/pai; browser deve importar diretamente shared.
export * from "../../shared/emprestimosMultimodalCalculo";
const id = z.number().int().positive().max(2147483647);
function falhar(code: TRPCError["code"], message: string): never { throw new TRPCError({ code, message }); }
function tenant(userId: number): void {
  if (!id.safeParse(userId).success) falhar("UNAUTHORIZED", "Sessão financeira inválida.");
}
function adaptar<T>(code: "BAD_REQUEST" | "INTERNAL_SERVER_ERROR", executar: () => T): T {
  try { return executar(); }
  catch (error) { falhar(code, error instanceof Error ? error.message : "Intenção financeira não comprovada; preserve UUID/payload."); }
}
function entrada<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) falhar("BAD_REQUEST", "Intenção financeira inválida; nenhum RPC foi executado.");
  return parsed.data;
}
export function validarCriacaoMultimodal(userId: number, input: EntradaMultimodal) {
  tenant(userId);
  return adaptar("BAD_REQUEST", () => validarEntradaCriacaoMultimodal(input));
}
export function normalizarCriacaoMultimodal(value: unknown, userId: number, input: EntradaMultimodal) {
  const { entrada: i } = validarCriacaoMultimodal(userId, input);
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarResultadoCriacaoMultimodal(value, i));
}

/** Exatamente uma chamada, sem retry automático, REST, fallback ou substituição de UUID. */
export async function chamarMultimodal(cliente: ClienteEmprestimosRpc, nome: string, parametros: Record<string, unknown>): Promise<unknown> {
  tenant(parametros.p_user_id as number);
  if (!jsonMultimodalSeguro(parametros)) falhar("BAD_REQUEST", "Parâmetros RPC inválidos.");
  let response: unknown;
  try { response = await cliente.rpc(nome, parametros); }
  catch { falhar("INTERNAL_SERVER_ERROR", "Transporte sem confirmação. Preserve o mesmo UUID/payload; timeout não prova rollback."); }
  if (!jsonMultimodalSeguro(response) || response === null || typeof response !== "object" || Array.isArray(response) ||
      !Object.hasOwn(response, "data") || !Object.hasOwn(response, "error") ||
      Object.keys(response).some(k => !["data", "error", "count", "status", "statusText"].includes(k))) {
    falhar("INTERNAL_SERVER_ERROR", "Envelope RPC inválido; preserve UUID/payload sem presumir rollback.");
  }
  const r = response as { data: unknown; error: unknown };
  if (r.error !== null) {
    if (typeof r.error !== "object" || Array.isArray(r.error)) falhar("INTERNAL_SERVER_ERROR", "Erro RPC inválido; resultado financeiro não confirmado.");
    const code = (r.error as { code?: unknown }).code;
    if (typeof code !== "string" && code !== null && code !== undefined) falhar("INTERNAL_SERVER_ERROR", "Erro RPC inválido; resultado financeiro não confirmado.");
    if (["22023", "22007", "22008", "22P02", "22003"].includes(code as string)) falhar("BAD_REQUEST", "Intenção financeira inválida.");
    // 55000 também é usado pelo fence permanente; nunca prova não execução.
    if (["23505", "23514", "40001", "40P01", "55000"].includes(code as string)) falhar("CONFLICT", "Estado, cotação ou UUID divergente/encerrado. Confira a intenção original.");
    if (code === "42501") falhar("NOT_FOUND", "Contrato, cliente, parcela ou conta indisponível para esta empresa.");
    if (["PGRST202", "42883", "42P01"].includes(code as string)) falhar("PRECONDITION_FAILED", "Ciclo multimodal indisponível; nenhum fallback financeiro será executado.");
    falhar("INTERNAL_SERVER_ERROR", "Resultado financeiro não confirmado; preserve a mesma intenção.");
  }
  return r.data;
}
export async function criarMultimodal(cliente: ClienteEmprestimosRpc, userId: number, input: EntradaMultimodal) {
  const { entrada: i, calculo: c, multaAtraso, jurosMoraDiario } = validarCriacaoMultimodal(userId, input);
  const value = await chamarMultimodal(cliente, "rpc_criar_emprestimo_multimodal", {
    p_user_id: userId, p_chave_idempotencia: i.idempotencyKey, p_cliente_id: i.clienteId, p_conta_caixa_id: i.contaCaixaId,
    p_modalidade: i.modalidade, p_tipo_taxa: i.tipoTaxa, p_valor_principal: c.valorPrincipal, p_taxa_juros: c.taxaJuros,
    p_numero_parcelas: i.numeroParcelas, p_data_inicio: i.dataInicio, p_data_desembolso: i.dataDesembolso, p_vencimentos: i.vencimentos,
    p_descricao: i.descricao?.trim() || null, p_observacoes: i.observacoes?.trim() || null,
    p_multa_atraso: multaAtraso, p_juros_mora_diario: jurosMoraDiario,
  });
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarResultadoCriacaoMultimodal(value, i));
}
export async function cotarMultimodal(cliente: ClienteEmprestimosRpc, userId: number, input: ConsultaMultimodal) {
  tenant(userId); const i = entrada(consultaMultimodalSchema, input);
  const value = await chamarMultimodal(cliente, "rpc_cotar_emprestimo_multimodal", { p_user_id: userId, p_contrato_id: i.contratoId, p_parcela_id: i.parcelaId });
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarCotacaoMultimodal(value, i));
}
export async function receberMultimodal(cliente: ClienteEmprestimosRpc, userId: number, input: EntradaRecebimentoMultimodal) {
  tenant(userId); const i = entrada(recebimentoMultimodalSchema, input);
  const value = await chamarMultimodal(cliente, "rpc_receber_emprestimo_multimodal", {
    p_user_id: userId, p_chave_idempotencia: i.idempotencyKey, p_contrato_id: i.contratoId, p_parcela_id: i.parcelaId,
    p_valor_recebido: i.valorRecebido, p_total_exigido: i.totalExigido, p_data_pagamento: i.dataPagamento,
    p_estado_hash: i.estadoHash, p_modo: i.modo, p_observacoes: i.observacoes?.trim() || null,
  });
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarRecebimentoMultimodal(value, i));
}
export async function cotarRenovacaoMultimodal(cliente: ClienteEmprestimosRpc, userId: number, input: ConsultaRenovacaoMultimodal) {
  tenant(userId); const i = entrada(consultaRenovacaoMultimodalSchema, input);
  const value = await chamarMultimodal(cliente, "rpc_cotar_renovacao_multimodal", { p_user_id: userId, p_contrato_id: i.contratoId, p_parcela_id: i.parcelaId, p_novo_vencimento: i.novoVencimento });
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarCotacaoRenovacaoMultimodal(value, i));
}
export async function renovarMultimodal(cliente: ClienteEmprestimosRpc, userId: number, input: EntradaRenovacaoMultimodal) {
  tenant(userId); const i = entrada(renovacaoMultimodalSchema, input);
  const value = await chamarMultimodal(cliente, "rpc_renovar_emprestimo_multimodal", {
    p_user_id: userId, p_chave_idempotencia: i.idempotencyKey, p_contrato_id: i.contratoId, p_parcela_id: i.parcelaId,
    p_valor_recebido: i.valorRecebido, p_total_exigido: i.totalExigido, p_data_pagamento: i.dataPagamento,
    p_estado_hash: i.estadoHash, p_novo_vencimento: i.novoVencimento, p_observacoes: i.observacoes?.trim() || null,
  });
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarRenovacaoMultimodal(value, i));
}
/** Opcional para o router: evidence e resultado confirmado são ambos validados, sem cotação/segunda chamada. */
export async function reconciliarMultimodal(cliente: ClienteEmprestimosRpc, userId: number, input: RecuperacaoMultimodal) {
  tenant(userId); const i = adaptar("BAD_REQUEST", () => validarRecuperacaoMultimodal(input));
  const value = await chamarMultimodal(cliente, "rpc_reconciliar_multimodal", { p_user_id: userId, p_family: i.family, p_chave: i.idempotencyKey, p_request: i.payload });
  return adaptar("INTERNAL_SERVER_ERROR", () => normalizarRecuperacaoMultimodal(value, userId, i));
}
