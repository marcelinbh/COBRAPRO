import { TRPCError } from "@trpc/server";
import { dataHojeBrasilia } from "./businessDate";

export type EntradaRecebimentoParcelaAtomico = {
  userId: number;
  parcelaId: number;
  contaCaixaId: number;
  valorPago: number;
  desconto: number;
  valorJurosCustom?: number;
  dataPagamento?: string;
  observacoes?: string;
  idempotencyKey: string;
};

type ClienteRpc = {
  rpc: (nome: string, parametros: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { code?: string | null } | null;
  }>;
};

export type ResultadoRecebimentoParcelaAtomico = {
  success: true;
  repetida: boolean;
  operationId: string;
  parcelaId: number;
  status: "paga" | "parcial";
  saldoResidual: number;
  valorPagoAcumulado: number;
  dataPagamento: string;
  confirmadoFinanceiro: true;
  pendenciasPosConfirmacao: [];
};

function erro(codigo: TRPCError["code"], mensagem: string): never {
  throw new TRPCError({ code: codigo, message: mensagem });
}

function valorMonetarioValido(valor: number | undefined, permitirZero = false): boolean {
  if (valor === undefined) return true;
  if (!Number.isFinite(valor) || (permitirZero ? valor < 0 : valor <= 0)) return false;
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 0.000001;
}

export function dataCivilValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

function inteiroPositivo(valor: number): boolean {
  return Number.isSafeInteger(valor) && valor > 0;
}

function numeroMonetarioDoResultado(valor: unknown, campo: string): number {
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || Math.abs(numero * 100 - Math.round(numero * 100)) >= 0.000001) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Recebimento atômico retornou ${campo} inválido. Nenhuma confirmação foi exibida; confira a operação antes de tentar novamente.`,
    });
  }
  return numero;
}

/**
 * Confirma que a resposta JSONB da função PostgreSQL tem o contrato esperado
 * antes de informar êxito ao frontend. BIGINTs de Caixa não são propagados
 * porque podem exceder a precisão segura do JavaScript.
 */
export function normalizarResultadoRecebimentoParcelaAtomico(valor: unknown): ResultadoRecebimentoParcelaAtomico {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Recebimento atômico retornou uma confirmação inválida." });
  }

  const resultado = valor as Record<string, unknown>;
  const parcelaId = Number(resultado.parcelaId);
  const operationId = typeof resultado.operationId === "string" ? resultado.operationId : "";
  const status = resultado.status;
  const dataPagamento = typeof resultado.dataPagamento === "string" ? resultado.dataPagamento : "";

  if (resultado.success !== true || !inteiroPositivo(parcelaId) || !operationId ||
      (status !== "paga" && status !== "parcial") || !dataCivilValida(dataPagamento)) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Recebimento atômico retornou uma confirmação inválida." });
  }

  return {
    success: true,
    repetida: resultado.repetida === true,
    operationId,
    parcelaId,
    status,
    saldoResidual: numeroMonetarioDoResultado(resultado.saldoResidual, "saldo residual"),
    valorPagoAcumulado: numeroMonetarioDoResultado(resultado.valorPagoAcumulado, "valor pago acumulado"),
    dataPagamento,
    confirmadoFinanceiro: true,
    pendenciasPosConfirmacao: [],
  };
}

function mapearErroRpc(error: { code?: string | null }): never {
  const codigo = error.code ?? "";
  if (codigo === "22023") erro("BAD_REQUEST", "Dados do recebimento são inválidos.");
  if (codigo === "23505" || codigo === "23514" || codigo === "40001") {
    erro("CONFLICT", "Este recebimento já foi processado, está em processamento ou exige conferência antes de uma nova tentativa.");
  }
  if (codigo === "42501") erro("NOT_FOUND", "Parcela ou conta de Caixa não encontrada para esta empresa.");
  if (codigo === "PGRST202") {
    erro("PRECONDITION_FAILED", "O recebimento atômico ainda não está disponível. Nenhum lançamento foi criado.");
  }
  console.error("[Financeiro] RPC de recebimento falhou", { codigo: codigo || "desconhecido" });
  erro("INTERNAL_SERVER_ERROR", "Não foi possível confirmar o recebimento atômico. Nenhum êxito foi informado; confira antes de tentar novamente.");
}

/** Chama exclusivamente a função transacional após a flag de rollout ser habilitada. */
export async function registrarPagamentoParcelaAtomico(
  supabase: ClienteRpc,
  entrada: EntradaRecebimentoParcelaAtomico,
): Promise<ResultadoRecebimentoParcelaAtomico> {
  const dataPagamento = entrada.dataPagamento ?? dataHojeBrasilia();

  if (!inteiroPositivo(entrada.userId) || !inteiroPositivo(entrada.parcelaId) || !inteiroPositivo(entrada.contaCaixaId)) {
    erro("BAD_REQUEST", "Parcela e conta de Caixa válidas são obrigatórias.");
  }
  if (!valorMonetarioValido(entrada.valorPago) || !valorMonetarioValido(entrada.desconto, true) ||
      !valorMonetarioValido(entrada.valorJurosCustom, true)) {
    erro("BAD_REQUEST", "Valores monetários devem ter no máximo duas casas decimais.");
  }
  if (!dataCivilValida(dataPagamento)) erro("BAD_REQUEST", "A data de pagamento é inválida.");
  if (!entrada.idempotencyKey) erro("BAD_REQUEST", "A chave de idempotência é obrigatória para o recebimento atômico.");

  const { data, error } = await supabase.rpc("rpc_registrar_pagamento_parcela", {
    p_user_id: entrada.userId,
    p_parcela_id: entrada.parcelaId,
    p_conta_caixa_id: entrada.contaCaixaId,
    p_valor_pago: entrada.valorPago,
    p_desconto: entrada.desconto,
    p_valor_juros_custom: entrada.valorJurosCustom ?? null,
    p_data_pagamento: dataPagamento,
    p_observacoes: entrada.observacoes?.trim() || null,
    p_chave_idempotencia: entrada.idempotencyKey,
  });

  if (error) mapearErroRpc(error);
  return normalizarResultadoRecebimentoParcelaAtomico(data);
}
