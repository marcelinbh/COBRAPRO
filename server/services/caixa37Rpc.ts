import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { ClienteEmprestimosRpc } from "./emprestimosRpc";
import {
  copiarJsonCaixa37, capacidades37Schema, caixa37Indisponivel, cotarCaixa37Schema,
  congelarCotarCaixa37Input, congelarIntencaoAporte37, congelarIntencaoTransferencia37, congelarRecovery37,
  normalizarCotacao37, normalizarResultado37, normalizarRecovery37,
  type CotarCaixa37Input, type Aportar37Input, type Transferir37Input, type Recovery37Input,
} from "../../shared/caixa37";
export * from "../../shared/caixa37";
export type ClienteCaixa37Rpc = ClienteEmprestimosRpc;
const id = z.number().int().positive().max(2147483647);
function falhar(code: TRPCError["code"], message: string): never { throw new TRPCError({ code, message }); }
function tenant(userId: number): void {
  if (!id.safeParse(userId).success) falhar("UNAUTHORIZED", "Sessão financeira inválida.");
}
function validar<T>(code: "BAD_REQUEST" | "INTERNAL_SERVER_ERROR", callback: () => T): T {
  try { return callback(); }
  catch { falhar(code, "Intenção/prova caixa37 inválida; preserve o mesmo UUID/request. Erro não prova ausência de execução."); }
}
function envelope(value: unknown): { data: unknown; error: null | Record<string, unknown> } {
  const copy = validar("INTERNAL_SERVER_ERROR", () => copiarJsonCaixa37(value));
  if (copy === null || typeof copy !== "object" || Array.isArray(copy) || !Object.hasOwn(copy, "data") || !Object.hasOwn(copy, "error") ||
    Object.keys(copy).some(k => !["data", "error", "count", "status", "statusText", "success"].includes(k)))
    falhar("INTERNAL_SERVER_ERROR", "Envelope RPC inválido; resultado caixa37 não confirmado.");
  const r = copy as Record<string, unknown>;
  if ((Object.hasOwn(r, "success") && (typeof r.success !== "boolean" || r.success !== (r.error === null))) ||
    (Object.hasOwn(r, "status") && (typeof r.status !== "number" || !Number.isInteger(r.status) || r.status < 0 || r.status > 599)) ||
    (Object.hasOwn(r, "statusText") && typeof r.statusText !== "string") ||
    (Object.hasOwn(r, "count") && r.count !== null && (typeof r.count !== "number" || !Number.isSafeInteger(r.count) || r.count < 0)))
    falhar("INTERNAL_SERVER_ERROR", "Envelope RPC contraditório; resultado caixa37 não confirmado.");
  if (typeof r.status === "number" && (r.error === null ? r.status < 200 || r.status >= 300 : r.status !== 0 && r.status < 400))
    falhar("INTERNAL_SERVER_ERROR", "Status RPC contraditório; resultado caixa37 não confirmado.");
  if (r.error !== null) {
    if (r.error === undefined || typeof r.error !== "object" || Array.isArray(r.error) || r.data !== null ||
      Object.keys(r.error).some(k => !["code", "message", "details", "hint"].includes(k)))
      falhar("INTERNAL_SERVER_ERROR", "Erro RPC inválido; resultado caixa37 não confirmado.");
    const error = r.error as Record<string, unknown>;
    for (const k of ["code", "message", "details", "hint"]) {
      if (Object.hasOwn(error, k) && error[k] !== null && typeof error[k] !== "string")
        falhar("INTERNAL_SERVER_ERROR", "Erro RPC inválido; resultado caixa37 não confirmado.");
    }
    return { data: null, error };
  }
  return { data: r.data, error: null };
}
async function executar(cliente: ClienteCaixa37Rpc, nome: string, parametros: Record<string, unknown>) {
  let response: unknown;
  try { response = await cliente.rpc(nome, parametros); }
  catch { falhar("INTERNAL_SERVER_ERROR", "Transporte sem confirmação. Preserve o mesmo UUID/request; timeout não prova ausência de execução."); }
  return envelope(response);
}
function erroSql(error: Record<string, unknown>): never {
  const code = error.code;
  if (["22023", "22007", "22008", "22P02", "22003"].includes(code as string))
    falhar("BAD_REQUEST", "Intenção financeira inválida; preserve UUID/request até conferir execução.");
  if (code === "42501") falhar("NOT_FOUND", "Conta ou vínculo indisponível para esta empresa.");
  if (["23505", "40001", "40P01"].includes(code as string))
    falhar("CONFLICT", "UUID/request, cotação ou contenção divergente; preserve UUID/request. Erro não prova ausência de execução.");
  if (code === "23514") falhar("PRECONDITION_FAILED", "Livro ou prova caixa37 não comprovados; nenhum saneamento/fallback será executado.");
  if (code === "55000") {
    // Detalhe controlado informa o fence, mas não é evidência not_executed.
    if (error.details === "CAIXA37_UUID_FENCED")
      falhar("PRECONDITION_FAILED", "UUID caixa37 fechado por fence; preserve UUID/request e confira a evidência no endpoint de reconciliação.");
    falhar("PRECONDITION_FAILED", "Integridade ou disponibilidade caixa37 não comprovada; preserve UUID/request.");
  }
  if (["PGRST202", "42883", "42P01"].includes(code as string))
    falhar("PRECONDITION_FAILED", "Lote caixa37 indisponível; nenhum writer alternativo será executado.");
  falhar("INTERNAL_SERVER_ERROR", "Resultado caixa37 não confirmado; preserve o mesmo UUID/request.");
}
async function chamar(cliente: ClienteCaixa37Rpc, nome: string, parametros: Record<string, unknown>) {
  const response = await executar(cliente, nome, parametros);
  if (response.error !== null) erroSql(response.error);
  return response.data;
}
/** Uma RPC uma vez. Capacidade false somente em erro válido de RPC ausente. */
export async function capacidades37(cliente: ClienteCaixa37Rpc, userId: number) {
  tenant(userId);
  const r = await executar(cliente, "rpc_capacidades_caixa37", {});
  if (r.error !== null) {
    if (["PGRST202", "42883"].includes(r.error.code as string)) return caixa37Indisponivel;
    falhar("INTERNAL_SERVER_ERROR", "Capacidade caixa37 não comprovada; erro não demonstra RPC ausente.");
  }
  return validar("INTERNAL_SERVER_ERROR", () => capacidades37Schema.parse(r.data));
}
export async function cotar37(cliente: ClienteCaixa37Rpc, userId: number, input: CotarCaixa37Input) {
  tenant(userId);
  const i = validar("BAD_REQUEST", () => congelarCotarCaixa37Input(cotarCaixa37Schema.parse(input)));
  const value = await chamar(cliente, "rpc_cotar_caixa37", {
    p_user_id: userId, p_acao: i.acao, p_conta_origem_id: i.acao === "aporte" ? null : i.contaOrigemId,
    p_conta_destino_id: i.contaDestinoId, p_valor: i.valor, p_descricao: i.descricao ?? null,
  });
  return validar("INTERNAL_SERVER_ERROR", () => normalizarCotacao37(value, i));
}
export async function aportar37(cliente: ClienteCaixa37Rpc, userId: number, input: Aportar37Input) {
  tenant(userId);
  const i = validar("BAD_REQUEST", () => congelarIntencaoAporte37(input)), q = i.request;
  const value = await chamar(cliente, "rpc_aportar_caixa37", {
    p_user_id: userId, p_chave_idempotencia: i.idempotencyKey, p_conta_destino_id: q.contaDestinoId, p_valor: q.valor,
    p_data_transacao: q.dataTransacao, p_estado_hash: q.estadoHash, p_descricao: q.descricao,
  });
  return validar("INTERNAL_SERVER_ERROR", () => normalizarResultado37(value, i));
}
export async function transferir37(cliente: ClienteCaixa37Rpc, userId: number, input: Transferir37Input) {
  tenant(userId);
  const i = validar("BAD_REQUEST", () => congelarIntencaoTransferencia37(input)), q = i.request;
  const value = await chamar(cliente, "rpc_transferir_caixa37", {
    p_user_id: userId, p_chave_idempotencia: i.idempotencyKey, p_conta_origem_id: q.contaOrigemId, p_conta_destino_id: q.contaDestinoId,
    p_valor: q.valor, p_data_transacao: q.dataTransacao, p_estado_hash: q.estadoHash, p_descricao: q.descricao,
  });
  return validar("INTERNAL_SERVER_ERROR", () => normalizarResultado37(value, i));
}
/** Recovery não depende de consultar capacidade nem revalidar hoje/hash atual. */
export async function reconciliar37(cliente: ClienteCaixa37Rpc, userId: number, input: Recovery37Input) {
  tenant(userId);
  const i = validar("BAD_REQUEST", () => congelarRecovery37(input));
  const value = await chamar(cliente, "rpc_reconciliar_caixa37", {
    p_user_id: userId, p_chave_idempotencia: i.idempotencyKey, p_request: i.request,
  });
  return validar("INTERNAL_SERVER_ERROR", () => normalizarRecovery37(value, userId, i));
}
