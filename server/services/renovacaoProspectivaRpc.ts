import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { dataEmprestimoValida, type ClienteEmprestimosRpc } from "./emprestimosRpc";
import { exigirCicloEmprestimosProspectivos } from "./cicloEmprestimosRpc";

const id = z.number().int().positive().max(2147483647);
const uuid = z.string().uuid();
const dinheiro = z.string().regex(/^(0|[1-9]\d{0,9})\.\d{2}$/);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const date = z.string().refine(dataEmprestimoValida);
const regra = z.literal("renovacao_juros_mensal_brt_v1");
export const renovacaoProspectivaConsultaSchema = z.object({ contratoId: id, parcelaId: id }).strict();
export const renovacaoProspectivaEntradaSchema = renovacaoProspectivaConsultaSchema.extend({
  idempotencyKey: uuid, valorRecebido: dinheiro, totalExigido: dinheiro,
  dataPagamento: date, estadoHash: hash, cotacaoHash: hash,
}).strict().refine(v => dinheiro.safeParse(v.valorRecebido).success && centavos(v.valorRecebido) > BigInt(0) && v.valorRecebido === v.totalExigido,
  "Renovação exige exatamente a soma cotada de juros + multa + mora, sem principal.");
export type EntradaRenovacaoProspectiva = z.infer<typeof renovacaoProspectivaEntradaSchema>;
export const renovacaoProspectivaCotacaoSchema = z.object({
  elegivel: z.literal(true), contratoId: id, parcelaId: id, contaCaixaId: id,
  jurosEmbutidos: dinheiro, multa: dinheiro, mora: dinheiro, totalExigido: dinheiro,
  principalAntes: dinheiro, principalDepois: dinheiro, principalPago: z.literal("0.00"),
  novoJuros: dinheiro, novoTotal: dinheiro, novoVencimento: date, vencimento: date,
  dataPagamento: date, expiraEm: z.string().regex(/^\d{4}-\d{2}-\d{2}T00:00:00-03:00$/),
  estadoHash: hash, cotacaoHash: hash, regra,
}).strict();
export type CotacaoRenovacaoProspectiva = z.infer<typeof renovacaoProspectivaCotacaoSchema>;
const resultadoSchema = z.object({
  success: z.literal(true), repetida: z.boolean(), operationId: uuid,
  contratoId: id, parcelaId: id, sucessoraId: id, transacaoCaixaId: z.string().regex(/^[1-9]\d{0,9}$/), contaCaixaId: id,
  valorRecebido: dinheiro, totalExigido: dinheiro, jurosPagos: dinheiro, multaPaga: dinheiro, moraPaga: dinheiro,
  principalPago: z.literal("0.00"), principalAntes: dinheiro, principalDepois: dinheiro,
  status: z.literal("renovada"), contratoStatus: z.literal("ativo"), novoTotal: dinheiro,
  novoJuros: dinheiro, novoVencimento: date, dataPagamento: date, estadoHash: hash, cotacaoHash: hash, regra,
}).strict();
export type ResultadoRenovacaoProspectiva = z.infer<typeof resultadoSchema>;
function centavos(v: string) { return BigInt(v.replace(".", "")); }
function falhar(code: TRPCError["code"], message: string): never { throw new TRPCError({ code, message }); }
export function exigirRenovacaoProspectiva(): void {
  exigirCicloEmprestimosProspectivos();
  if (process.env.ENABLE_RPC_RENOVACAO_PROSPECTIVA !== "true")
    falhar("PRECONDITION_FAILED", "Renovação v1 indisponível. Requer 0031 revisada e flag dedicada; sem legado/REST.");
}
async function rpc(cliente: ClienteEmprestimosRpc, nome: string, params: Record<string, unknown>) {
  let response: Awaited<ReturnType<ClienteEmprestimosRpc["rpc"]>>;
  try { response = await cliente.rpc(nome, params); }
  catch { falhar("INTERNAL_SERVER_ERROR", "Transporte sem confirmação. Preserve UUID/payload e confira a mesma intenção; não presuma rollback."); }
  if (response.error) {
    const c = response.error.code ?? "";
    if (["22023", "22007", "22008", "22P02"].includes(c)) falhar("BAD_REQUEST", "Intenção inválida: DATE, centavos e soma cotada exata obrigatórios.");
    if (c === "42501") falhar("NOT_FOUND", "Contrato 0021/0022 comprovado, parcela ou conta não disponível para esta empresa.");
    if (["23505", "23514", "40001", "40P01"].includes(c)) falhar("CONFLICT", "Renovação não elegível, cotação expirada ou intenção divergente. Não gere nova chave após envio incerto; confira a intenção preservada.");
    if (["PGRST202", "42883", "42P01"].includes(c)) falhar("PRECONDITION_FAILED", "RPC/schema de renovação indisponível. Não há fallback.");
    falhar("INTERNAL_SERVER_ERROR", "Sem confirmação financeira. Preserve UUID/payload para conferir, sem promessa de rollback.");
  }
  return response.data;
}
function tenant(userId: number) { if (!id.safeParse(userId).success) falhar("BAD_REQUEST", "Tenant do servidor inválido."); }
export function renovacaoProspectivaNormalizarCotacao(value: unknown, input: { contratoId: number; parcelaId: number }): CotacaoRenovacaoProspectiva {
  const parsed = renovacaoProspectivaCotacaoSchema.safeParse(value);
  if (!parsed.success) falhar("INTERNAL_SERVER_ERROR", "Cotação SQL inválida; renovação bloqueada.");
  const q = parsed.data;
  const day = new Date(`${q.dataPagamento}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 1);
  if (q.contratoId !== input.contratoId || q.parcelaId !== input.parcelaId ||
    centavos(q.jurosEmbutidos) <= BigInt(0) || centavos(q.principalAntes) <= BigInt(0) ||
    centavos(q.totalExigido) !== centavos(q.jurosEmbutidos) + centavos(q.multa) + centavos(q.mora) ||
    q.principalAntes !== q.principalDepois || q.novoJuros !== q.jurosEmbutidos ||
    centavos(q.novoTotal) !== centavos(q.principalDepois) + centavos(q.novoJuros) ||
    q.novoVencimento <= q.dataPagamento || q.novoVencimento <= q.vencimento ||
    q.expiraEm !== `${day.toISOString().slice(0, 10)}T00:00:00-03:00`)
    falhar("INTERNAL_SERVER_ERROR", "Componentes/calendário SQL divergentes; renovação bloqueada.");
  return q;
}
export function renovacaoProspectivaNormalizarResultado(value: unknown, input: EntradaRenovacaoProspectiva): ResultadoRenovacaoProspectiva {
  const parsed = resultadoSchema.safeParse(value);
  if (!parsed.success) falhar("INTERNAL_SERVER_ERROR", "Confirmação inválida; preserve UUID/payload e confira, sem presumir rollback.");
  const r = parsed.data;
  if (r.contratoId !== input.contratoId || r.parcelaId !== input.parcelaId || r.sucessoraId === r.parcelaId ||
    r.valorRecebido !== input.valorRecebido || r.totalExigido !== input.totalExigido || r.dataPagamento !== input.dataPagamento ||
    r.estadoHash !== input.estadoHash || r.cotacaoHash !== input.cotacaoHash ||
    centavos(r.jurosPagos) <= BigInt(0) || centavos(r.principalAntes) <= BigInt(0) ||
    centavos(r.valorRecebido) !== centavos(r.jurosPagos) + centavos(r.multaPaga) + centavos(r.moraPaga) ||
    r.principalAntes !== r.principalDepois || r.novoJuros !== r.jurosPagos ||
    centavos(r.novoTotal) !== centavos(r.principalDepois) + centavos(r.novoJuros) ||
    r.novoVencimento <= r.dataPagamento || BigInt(r.transacaoCaixaId) > BigInt(2147483647))
    falhar("INTERNAL_SERVER_ERROR", "Prova/componentes divergem da intenção; confira a mesma chave antes de prosseguir.");
  return r;
}
export async function cotarRenovacaoProspectiva(cliente: ClienteEmprestimosRpc, userId: number, input: z.infer<typeof renovacaoProspectivaConsultaSchema>) {
  exigirRenovacaoProspectiva(); tenant(userId);
  const p = renovacaoProspectivaConsultaSchema.safeParse(input);
  if (!p.success) falhar("BAD_REQUEST", "Consulta de renovação inválida.");
  const value = await rpc(cliente, "rpc_cotar_renovacao_prospectiva", { p_user_id: userId, p_contrato_id: p.data.contratoId, p_parcela_id: p.data.parcelaId });
  return renovacaoProspectivaNormalizarCotacao(value, p.data);
}
export async function renovarProspectivoAtomico(cliente: ClienteEmprestimosRpc, userId: number, input: EntradaRenovacaoProspectiva) {
  exigirRenovacaoProspectiva(); tenant(userId);
  const p = renovacaoProspectivaEntradaSchema.safeParse(input);
  if (!p.success) falhar("BAD_REQUEST", "Intenção inválida: renovação somente pelo total exato cotado, com UUID e hashes.");
  const i = p.data;
  const value = await rpc(cliente, "rpc_renovar_emprestimo_prospectivo", { p_user_id: userId, p_chave_idempotencia: i.idempotencyKey,
    p_contrato_id: i.contratoId, p_parcela_id: i.parcelaId, p_valor_recebido: i.valorRecebido, p_total_exigido: i.totalExigido,
    p_data_pagamento: i.dataPagamento, p_estado_hash: i.estadoHash, p_cotacao_hash: i.cotacaoHash });
  return renovacaoProspectivaNormalizarResultado(value, i);
}
