import { TRPCError } from "@trpc/server";
import type { Projection51 } from "../../shared/obrigacoes51";
import { validarProjecao51, projetarParcela51, projetarContrato51, exigirProvaLinha51, centavos51 } from "../../shared/obrigacoes51Projection";
import { calcularJurosMora, calcularValorAbertoParcela } from "../../shared/finance";
import { normalizarCotacaoMulta, type CotacaoMulta } from "../../shared/multaManual";

type ParcelaApresentacao = {
  id?: number; contrato_id?: number; status: string; data_vencimento: string;
  valor_original: unknown; valor_pago?: unknown; valor_juros?: unknown;
  valor_multa?: unknown; saldo_residual?: unknown;
};
type CamposEfetivos51 = {
  statusFinanceiroOriginal?: string; statusObrigacao?: 'aberta' | 'paga' | 'cancelada' | 'transferida';
  obrigacaoAtual?: string; componenteAdicional?: string; arquivada?: boolean;
};
const ENCERRADOS = new Set(["paga", "pago", "cancelada", "cancelado", "renovada"]);
const ABERTOS = new Set(["pendente", "atrasada", "atrasado", "vencendo_hoje", "parcial"]);
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
  cotacoes36?: ReadonlyMap<number, CotacaoMulta> | null,
  estado51?: Projection51,
) {
  const principal = centavos(contrato.valor_principal);
  if (estado51) {
    try { validarProjecao51(estado51, estado51.userId, estado51.contratoId, registros.map(p => { if (!Number.isInteger(p.id)) return falha(); return p.id!; })); } catch { return falha(); }
    for (const p of registros) if (p.contrato_id !== estado51.contratoId) return falha();
  }
  if (cotacoes36 && cotacoes36.size !== registros.length) return falha();
  const todasParcelas = registros.map(p => {
    let efetiva: (P & CamposEfetivos51) | undefined;
    if (estado51) {
      try { efetiva = projetarParcela51({ ...p, id: p.id! }, estado51, hoje); } catch { return falha(); }
    }
    if (!ENCERRADOS.has(p.status) && !ABERTOS.has(p.status)) return falha();
    if (cotacoes36) {
      if (!Number.isSafeInteger(p.id) || !Number.isSafeInteger(p.contrato_id)) return falha();
      let q: CotacaoMulta;
      try { q = normalizarCotacaoMulta(cotacoes36.get(p.id!), { contratoId: p.contrato_id!, parcelaId: p.id! }); } catch { return falha(); }
      if (q.dataPagamento !== hoje) return falha();
      // A cotação é a apresentação do estado36, não um UPDATE no registro físico.
      return { ...p, ...efetiva, status: efetiva?.status ?? q.status, valor_pago: q.valorPagoAcumulado, valor_multa: q.multa,
        saldo_residual: q.status === "parcial" ? q.totalExigido : p.saldo_residual };
    }
    const status = ENCERRADOS.has(p.status) || p.status === "parcial" ? p.status
      : p.data_vencimento < hoje ? "atrasada" : p.data_vencimento === hoje ? "vencendo_hoje" : "pendente";
    return { ...p, ...efetiva, status: efetiva?.status ?? status };
  });
  // Encerradas conservam recebimentos/histórico, nunca obrigação corrente.
  const contratoEncerrado = estado51 ? estado51.statusObrigacao !== "ativo"
    : ["quitado", "cancelado", "cancelada", "encerrado"].includes(contrato.status);
  const parcelasAbertas = contratoEncerrado ? [] : todasParcelas.filter(p => ABERTOS.has(p.status) && !p.arquivada);
  const parcelasPagas = todasParcelas.filter(p => p.status === "paga" || p.status === "pago");
  const parcelasAtrasadas = parcelasAbertas.filter(p => p.data_vencimento < hoje);
  const valores = new Map<typeof todasParcelas[number], { original: number; pago: number; multa: number; residual: number; juros: number | null; aberto: number }>();
  let recebido = 0, receber = 0, previsto = 0, adicionalRecebido = 0, obrigacaoAtual = 0;
  for (const p of todasParcelas) {
    const original = centavos(p.valor_original);
    const pago = centavos(p.valor_pago, true), multa = centavos(p.valor_multa, true);
    const residual = centavos(p.saldo_residual, true);
    const juros = p.valor_juros == null ? null : centavos(p.valor_juros);
    if (juros !== null && juros > original) return falha();
    // Somente valor_pago registrado é recebimento; status pago sem valor não é prova.
    recebido = somar(recebido, pago);
    const base = p.status === "parcial" && residual > 0 ? residual : somar(somar(original, residual), multa);
    const q = cotacoes36?.get(p.id!);
    const proof = estado51 ? exigirProvaLinha51(estado51, p.id, p.statusFinanceiroOriginal!) : undefined;
    const adicional = proof ? Number(centavos51(proof.componenteAdicional)) : 0;
    // A vem exclusivamente da RPC51; não é principal nem juros. Pagos de A
    // permanecem no recebimento total, mas não no lucro derivado existente.
    adicionalRecebido = somar(adicionalRecebido, Math.min(pago, adicional));
    if (proof) obrigacaoAtual = somar(obrigacaoAtual, Number(centavos51(proof.obrigacaoAtual)));
    const aberto = proof && proof.statusObrigacao !== "aberta" ? 0 : q ? centavos(q.totalExigido) : proof ? Number(centavos51(proof.obrigacaoAtual)) : ENCERRADOS.has(p.status) ? 0 : centavosCalculados(calcularValorAbertoParcela({
      status: p.status, valorOriginal: original / 100, saldoResidual: residual / 100, valorMulta: multa / 100,
    }));
    if (!proof && !q && !ENCERRADOS.has(p.status) && aberto !== base) return falha();
    valores.set(p, { original, pago, multa, residual, juros, aberto });
    if (!contratoEncerrado && ABERTOS.has(p.status) && !p.arquivada) {
      receber = somar(receber, aberto);
      // Sem juros explícitos, zero é o fallback conservador: não reconstruir taxa/N.
      // Pendente íntegra: capital = original - juros (inclusive Price e bullet renovado).
      // Pagamento parcial não prova alocação. O limite inferior assume, somente para
      // esta estimativa, que todo recebimento pode ter reduzido juros primeiro.
      // Não é saldo certificado por componente; residual/encargos não geram juros novos.
      const jurosRestantes = adicional > 0 || juros === null ? 0 : Math.min(aberto, Math.max(0, juros - pago));
      previsto = somar(previsto, jurosRestantes);
    }
  }
  const proximaParcela = parcelasAbertas[0] ?? null;
  const valorJurosParcela = proximaParcela && Number(proximaParcela.componenteAdicional ?? 0) === 0 ? (valores.get(proximaParcela)!.juros ?? 0) / 100 : 0;
  const parcelasComAtraso = parcelasAtrasadas.map(p => {
    const v = valores.get(p)!;
    const q = cotacoes36?.get(p.id!);
    if (q) {
      const diasAtraso = calcularJurosMora(0, q.vencimento, new Date(`${hoje}T12:00:00-03:00`), 0, 0).diasAtraso;
      return { ...p, diasAtraso, jurosAtraso: centavos(q.mora) / 100, multaAplicada: centavos(q.multa) / 100,
        totalComAtraso: centavos(q.totalExigido) / 100 };
    }
    // Residual parcial já contém os encargos da baixa; não somar original/multa outra vez.
    const baseMora = p.status === "parcial" && v.residual > 0 ? v.aberto : v.aberto - v.multa;
    const calculo = calcularJurosMora(baseMora / 100, p.data_vencimento, new Date(`${hoje}T12:00:00-03:00`), multaDiaria, multaPercentual);
    const jurosAtraso = somar(centavosCalculados(calculo.juros), centavosCalculados(calculo.multa));
    return { ...p, diasAtraso: calculo.diasAtraso, jurosAtraso: jurosAtraso / 100,
      multaAplicada: v.multa / 100, totalComAtraso: somar(v.aberto, jurosAtraso) / 100 };
  });
  return {
    ...(estado51 ? { ...projetarContrato51(contrato.status, estado51),
      obrigacaoAtual: `${Math.floor(obrigacaoAtual / 100)}.${String(obrigacaoAtual % 100).padStart(2, "0")}`,
      adicionalRecebido: adicionalRecebido / 100 } : {}),
    totalReceber: receber / 100, totalPago: recebido / 100, lucroPrevisto: previsto / 100,
    // Estimativa conservadora, não lucro por componente comprovado. Inclui pagamentos
    // parciais e juros recebidos em encerradas, sem contar principal transferido como pago.
    lucroRealizado: Math.max(0, recebido - adicionalRecebido - principal) / 100,
    valorJurosParcela, parcelasAbertas: parcelasAbertas.length,
    parcelasPagas: parcelasPagas.length, parcelasAtrasadas: parcelasAtrasadas.length,
    proximaParcela, parcelasComAtraso, todasParcelas,
  };
}
