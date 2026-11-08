import { TRPCError } from "@trpc/server";

export type ClienteDespesasRpc = {
  rpc(nome: string, parametros: Record<string, unknown>): PromiseLike<{
    data: unknown;
    error: { code?: string | null } | null;
  }>;
};
/** userId deve vir exclusivamente de ctx.user.id no servidor, nunca do input público. */
export type IntencaoDespesa = { userId: number; idempotencyKey: string };
export type EntradaCriarDespesa = IntencaoDespesa & {
  descricao: string;
  categoria?: CategoriaDespesa;
  /** String decimal é preferível; evita perda de precisão no transporte. */
  valor: string | number;
  dataVencimento: string;
  observacoes?: string;
};
export type EntradaPagarDespesa = IntencaoDespesa & {
  despesaId: number;
  contaCaixaId: number;
  dataPagamento: string;
};
export type EntradaEstornarDespesa = IntencaoDespesa & {
  despesaId: number;
  pagamentoOperationId: string;
  dataEstorno: string;
  motivo: string;
};
const categorias = ["aluguel", "energia", "agua", "internet", "telefone", "salario", "imposto", "fornecedor", "outros"] as const;
export type CategoriaDespesa = typeof categorias[number];
export type ResultadoDespesa = {
  success: true;
  acao: "criar" | "pagar" | "estornar";
  operationId: string;
  chaveIdempotencia: string;
  userId: number;
  despesaId: number;
  status: "pendente" | "pago" | "cancelado";
  valor: string;
  contaCaixaId: number | null;
  dataVencimento: string;
  dataPagamento: string | null;
  dataEstorno: string | null;
  pagamentoOperationId: string | null;
  transacaoSaidaId: string | null;
  transacaoEstornoId: string | null;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v <= 2147483647;
const uuidValido = (v: unknown): v is string => typeof v === "string" && uuid.test(v);
const ledgerId = (v: unknown): v is string => typeof v === "string" && /^[1-9]\d*$/.test(v) && BigInt(v) <= BigInt("9223372036854775807");
function erro(code: TRPCError["code"], message: string): never { throw new TRPCError({ code, message }); }
function dataCivil(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v.slice(0, 4) === "0000") return false;
  const date = new Date(`${v}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
}
function dinheiro(v: unknown): string | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  const s = String(v);
  if (!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(frac.padEnd(2, "0"));
  if (cents <= BigInt(0) || cents > BigInt("999999999999999")) return null;
  return `${whole}.${frac.padEnd(2, "0")}`;
}
function inicio(e: IntencaoDespesa): void {
  // Ausente, false, 1 ou TRUE não habilitam o fluxo. Sem fallback REST.
  if (process.env.ENABLE_RPC_DESPESAS_PROSPECTIVAS !== "true") {
    erro("PRECONDITION_FAILED", "Despesas prospectivas atômicas estão desabilitadas.");
  }
  if (!id(e.userId) || !uuidValido(e.idempotencyKey)) erro("BAD_REQUEST", "Owner do servidor e UUID idempotente são obrigatórios.");
}
function texto(v: unknown, max: number): v is string { return typeof v === "string" && v.trim().length > 0 && v.trim().length <= max; }
function respostaInvalida(): never {
  erro("INTERNAL_SERVER_ERROR", "Confirmação de despesa incompleta ou incompatível. Nenhum êxito foi informado; confira/reenvie a MESMA chave antes de nova intenção.");
}
/** Valida todos os campos e os vínculos com a intenção antes de confirmar sucesso. */
export function normalizarResultadoDespesa(valor: unknown, acao: ResultadoDespesa["acao"], entrada: EntradaCriarDespesa | EntradaPagarDespesa | EntradaEstornarDespesa): ResultadoDespesa {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) respostaInvalida();
  const r = valor as Record<string, unknown>;
  if (r.success !== true || r.acao !== acao || !uuidValido(r.operationId) || !uuidValido(r.chaveIdempotencia) ||
      r.chaveIdempotencia.toLowerCase() !== entrada.idempotencyKey.toLowerCase() || r.userId !== entrada.userId ||
      !id(r.despesaId) || typeof r.valor !== "string" || dinheiro(r.valor) !== r.valor || !dataCivil(r.dataVencimento)) respostaInvalida();
  if (acao === "criar") {
    const e = entrada as EntradaCriarDespesa;
    if (r.status !== "pendente" || r.contaCaixaId !== null || r.dataPagamento !== null || r.dataEstorno !== null ||
        r.pagamentoOperationId !== null || r.transacaoSaidaId !== null || r.transacaoEstornoId !== null ||
        r.valor !== dinheiro(e.valor) || r.dataVencimento !== e.dataVencimento) respostaInvalida();
  } else {
    if (r.despesaId !== (entrada as EntradaPagarDespesa).despesaId || !id(r.contaCaixaId) ||
        !dataCivil(r.dataPagamento) || !uuidValido(r.pagamentoOperationId) || !ledgerId(r.transacaoSaidaId)) respostaInvalida();
    if (acao === "pagar") {
      const e = entrada as EntradaPagarDespesa;
      if (r.status !== "pago" || r.contaCaixaId !== e.contaCaixaId || r.dataPagamento !== e.dataPagamento ||
          r.dataEstorno !== null || r.transacaoEstornoId !== null || r.pagamentoOperationId !== r.operationId) respostaInvalida();
    } else {
      const e = entrada as EntradaEstornarDespesa;
      if (r.status !== "cancelado" || r.dataEstorno !== e.dataEstorno || !ledgerId(r.transacaoEstornoId) ||
          r.transacaoEstornoId === r.transacaoSaidaId || r.pagamentoOperationId !== e.pagamentoOperationId.toLowerCase() ||
          r.dataEstorno < (r.dataPagamento as string)) respostaInvalida();
    }
  }
  // Não propaga propriedades adicionais não certificadas.
  return Object.fromEntries(["success", "acao", "operationId", "chaveIdempotencia", "userId", "despesaId", "status", "valor", "contaCaixaId", "dataVencimento", "dataPagamento", "dataEstorno", "pagamentoOperationId", "transacaoSaidaId", "transacaoEstornoId"].map(k => [k, r[k]])) as ResultadoDespesa;
}
async function executar(cliente: ClienteDespesasRpc, nome: string, params: Record<string, unknown>, acao: ResultadoDespesa["acao"], entrada: EntradaCriarDespesa | EntradaPagarDespesa | EntradaEstornarDespesa): Promise<ResultadoDespesa> {
  let resposta: Awaited<ReturnType<ClienteDespesasRpc["rpc"]>>;
  try { resposta = await cliente.rpc(nome, params); }
  catch { erro("INTERNAL_SERVER_ERROR", "Resposta da RPC desconhecida. Confira/reenvie a MESMA chave; não crie outra operação."); }
  if (resposta?.error) {
    const code = resposta.error.code;
    if (["22023", "22007", "22008", "22P02", "22003"].includes(code ?? "")) erro("BAD_REQUEST", "Dados da despesa inválidos.");
    if (["23505", "23514", "40001", "40P01"].includes(code ?? "")) erro("CONFLICT", "Operação conflitante ou proveniência inconsistente. Confira antes de repetir com a mesma chave.");
    if (code === "42501") erro("NOT_FOUND", "Despesa/conta indisponível para o owner.");
    if (["PGRST202", "42883", "42P01"].includes(code ?? "")) erro("PRECONDITION_FAILED", "RPC prospectiva indisponível; fluxo permanece bloqueado.");
    erro("INTERNAL_SERVER_ERROR", "Despesa não confirmada. Confira/reenvie a MESMA chave; não crie outra operação.");
  }
  return normalizarResultadoDespesa(resposta?.data, acao, entrada);
}
export async function criarDespesaAtomica(cliente: ClienteDespesasRpc, entrada: EntradaCriarDespesa): Promise<ResultadoDespesa> {
  inicio(entrada);
  const valor = dinheiro(entrada.valor);
  if (!texto(entrada.descricao, 255) || !valor || !dataCivil(entrada.dataVencimento) ||
      !categorias.includes(entrada.categoria ?? "outros") ||
      (entrada.observacoes !== undefined && (typeof entrada.observacoes !== "string" || entrada.observacoes.length > 10000))) erro("BAD_REQUEST", "Cadastro de despesa inválido.");
  return executar(cliente, "rpc_criar_despesa_prospectiva", {
    p_user_id: entrada.userId, p_descricao: entrada.descricao.trim(), p_categoria: entrada.categoria ?? "outros",
    p_valor: valor, p_data_vencimento: entrada.dataVencimento, p_observacoes: entrada.observacoes ?? null,
    p_chave_idempotencia: entrada.idempotencyKey,
  }, "criar", entrada);
}
export async function pagarDespesaAtomica(cliente: ClienteDespesasRpc, entrada: EntradaPagarDespesa): Promise<ResultadoDespesa> {
  inicio(entrada);
  if (!id(entrada.despesaId) || !id(entrada.contaCaixaId) || !dataCivil(entrada.dataPagamento)) erro("BAD_REQUEST", "Pagamento de despesa inválido.");
  return executar(cliente, "rpc_pagar_despesa_prospectiva", {
    p_user_id: entrada.userId, p_despesa_id: entrada.despesaId, p_conta_caixa_id: entrada.contaCaixaId,
    p_data_pagamento: entrada.dataPagamento, p_chave_idempotencia: entrada.idempotencyKey,
  }, "pagar", entrada);
}
export async function estornarDespesaAtomica(cliente: ClienteDespesasRpc, entrada: EntradaEstornarDespesa): Promise<ResultadoDespesa> {
  inicio(entrada);
  if (!id(entrada.despesaId) || !uuidValido(entrada.pagamentoOperationId) || !dataCivil(entrada.dataEstorno) || !texto(entrada.motivo, 2000)) erro("BAD_REQUEST", "Estorno de despesa inválido.");
  return executar(cliente, "rpc_estornar_despesa_prospectiva", {
    p_user_id: entrada.userId, p_despesa_id: entrada.despesaId, p_pagamento_operation_id: entrada.pagamentoOperationId,
    p_data_estorno: entrada.dataEstorno, p_motivo: entrada.motivo.trim(), p_chave_idempotencia: entrada.idempotencyKey,
  }, "estornar", entrada);
}
