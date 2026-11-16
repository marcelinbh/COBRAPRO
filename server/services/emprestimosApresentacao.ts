import { TRPCError } from "@trpc/server";
import { calcularJurosMora, calcularValorAbertoParcela } from "../../shared/finance";

type ParcelaApresentacao = {
  status: string; data_vencimento: string;
  valor_original: unknown; valor_pago?: unknown; valor_juros?: unknown;
  valor_multa?: unknown; saldo_residual?: unknown;
};
const ENCERRADOS = new Set(["paga", "pago", "cancelada", "cancelado", "renovada"]);
const ABERTOS = new Set(["pendente", "atrasada", "vencendo_hoje", "parcial"]);
const falha = (): never => { throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Não foi possível confirmar os valores das parcelas deste empréstimo." }); };

/** Decimais monetários explícitos, não negativos, sem arredondar dados inválidos. */
function centavos(valor: unknown, opcional = false): number {
  if (valor == null && opcional) return 0;
  if (typeof valor !== "string" && typeof valor !== "number") return falha();
  const texto = String(valor);
  if (!/^\d+(?:\.\d{1,2})?$/.test(texto)) return falha();
  const [inteiro, fracao = ""] = texto.split(".");
  const total = BigInt(inteiro) * BigInt(100) + BigInt(fracao.padEnd(2, "0"));
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) return falha();
  return Number(total);
}
function somar(a: number, b: number): number {
  const total = a + b;
  if (!Number.isSafeInteger(total) || total < 0) return falha();
  return total;
}
function centavosCalculados(valor: number): number {
  const total = Math.round(valor * 100);
  if (!Number.isFinite(valor) || !Number.isSafeInteger(total) || total < 0) return falha();
  return total;
}

/** Apenas apresentação: não certifica saldo por componente nem origem de renovação. */
export function apresentarEmprestimo<P extends ParcelaApresentacao>(
  contrato: { valor_principal: unknown; status: string },
  registros: P[], hoje: string, multaDiaria = 0, multaPercentual = 0,
) {
  const principal = centavos(contrato.valor_principal);
  const todasParcelas = registros.map(p => {
    if (!ENCERRADOS.has(p.status) && !ABERTOS.has(p.status)) return falha();
    const status = ENCERRADOS.has(p.status) || p.status === "parcial" ? p.status
      : p.data_vencimento < hoje ? "atrasada" : p.data_vencimento === hoje ? "vencendo_hoje" : "pendente";
    return { ...p, status };
  });
  // Encerradas conservam recebimentos/histórico, nunca obrigação corrente.
  const contratoEncerrado = ["quitado", "cancelado", "cancelada", "encerrado"].includes(contrato.status);
  const parcelasAbertas = contratoEncerrado ? [] : todasParcelas.filter(p => ABERTOS.has(p.status));
  const parcelasPagas = todasParcelas.filter(p => p.status === "paga" || p.status === "pago");
  const parcelasAtrasadas = parcelasAbertas.filter(p => p.data_vencimento < hoje);
  const valores = new Map<typeof todasParcelas[number], { original: number; pago: number; multa: number; residual: number; juros: number | null; aberto: number }>();
  let recebido = 0, receber = 0, previsto = 0;
  for (const p of todasParcelas) {
    const original = centavos(p.valor_original);
    const pago = centavos(p.valor_pago, true), multa = centavos(p.valor_multa, true);
    const residual = centavos(p.saldo_residual, true);
    const juros = p.valor_juros == null ? null : centavos(p.valor_juros);
    if (juros !== null && juros > original) return falha();
    // Somente valor_pago registrado é recebimento; status pago sem valor não é prova.
    recebido = somar(recebido, pago);
    const base = p.status === "parcial" && residual > 0 ? residual : somar(somar(original, residual), multa);
    const aberto = ENCERRADOS.has(p.status) ? 0 : centavosCalculados(calcularValorAbertoParcela({
      status: p.status, valorOriginal: original / 100, saldoResidual: residual / 100, valorMulta: multa / 100,
    }));
    if (!ENCERRADOS.has(p.status) && aberto !== base) return falha();
    valores.set(p, { original, pago, multa, residual, juros, aberto });
    if (!contratoEncerrado && ABERTOS.has(p.status)) {
      receber = somar(receber, aberto);
      // Sem juros explícitos, zero é o fallback conservador: não reconstruir taxa/N.
      // Pendente íntegra: capital = original - juros (inclusive Price e bullet renovado).
      // Pagamento parcial não prova alocação. O limite inferior assume, somente para
      // esta estimativa, que todo recebimento pode ter reduzido juros primeiro.
      // Não é saldo certificado por componente; residual/encargos não geram juros novos.
      const jurosRestantes = juros === null ? 0 : Math.min(aberto, Math.max(0, juros - pago));
      previsto = somar(previsto, jurosRestantes);
    }
  }
  const proximaParcela = parcelasAbertas[0] ?? null;
  const valorJurosParcela = proximaParcela ? (valores.get(proximaParcela)!.juros ?? 0) / 100 : 0;
  const parcelasComAtraso = parcelasAtrasadas.map(p => {
    const v = valores.get(p)!;
    // Residual parcial já contém os encargos da baixa; não somar original/multa outra vez.
    const baseMora = p.status === "parcial" && v.residual > 0 ? v.aberto : v.aberto - v.multa;
    const calculo = calcularJurosMora(baseMora / 100, p.data_vencimento, new Date(`${hoje}T12:00:00-03:00`), multaDiaria, multaPercentual);
    const jurosAtraso = somar(centavosCalculados(calculo.juros), centavosCalculados(calculo.multa));
    return { ...p, diasAtraso: calculo.diasAtraso, jurosAtraso: jurosAtraso / 100,
      multaAplicada: v.multa / 100, totalComAtraso: somar(v.aberto, jurosAtraso) / 100 };
  });
  return {
    totalReceber: receber / 100, totalPago: recebido / 100, lucroPrevisto: previsto / 100,
    // Estimativa conservadora, não lucro por componente comprovado. Inclui pagamentos
    // parciais e juros recebidos em encerradas, sem contar principal transferido como pago.
    lucroRealizado: Math.max(0, recebido - principal) / 100,
    valorJurosParcela, parcelasAbertas: parcelasAbertas.length,
    parcelasPagas: parcelasPagas.length, parcelasAtrasadas: parcelasAtrasadas.length,
    proximaParcela, parcelasComAtraso, todasParcelas,
  };
}
