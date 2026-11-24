import { z } from 'zod';
const id = z.number().int().positive().max(2147483647);
const moeda = z.string().regex(/^(0|[1-9][0-9]{0,9})\.[0-9]{2}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s && s >= '1900-01-01' && s <= '9990-12-31';
}, 'Data civil inválida');
export const reparcelamento43PreviewSchema = z.strictObject({
  contratoId: id,
  numeroParcelas: z.number().int().min(1).max(60),
  taxaJuros: z.string().regex(/^(0|[1-9][0-9]{0,2})\.[0-9]{2}$/),
  tipoTaxa: z.literal('mensal'),
  dataInicio: dia,
  incluirMultas: z.boolean(),
});
export const reparcelamento43ConfirmacaoSchema = reparcelamento43PreviewSchema.extend({ estadoHash: hash, cotacaoHash: hash });
export const reparcelamento43ExecucaoSchema = reparcelamento43ConfirmacaoSchema.extend({ idempotencyKey: z.string().uuid() });
export type Reparcelamento43Preview = z.infer<typeof reparcelamento43PreviewSchema>;
export type Reparcelamento43Execucao = z.infer<typeof reparcelamento43ExecucaoSchema>;
export const reparcelamento43CotacaoSchema = z.strictObject({
  regra: z.literal('reparcelamento43_v1'),userId: id,contratoId: id,contaCaixaId: id,
  dataCalculo: dia,estadoHash: hash,cotacaoHash: hash,request: reparcelamento43PreviewSchema,
  saldoDevedor: moeda,encargos: moeda,valorNovaParcela: moeda,totalNovo: moeda,jurosNovos: moeda,
  qtdParcelasAbertas: z.number().int().positive(),
  parcelas: z.array(z.strictObject({numero: id,valor: moeda,juros: moeda,principal: moeda,vencimento: dia})).min(1).max(60),
});
export const reparcelamento43ResultadoSchema = z.strictObject({
  success: z.literal(true),regra: z.literal('reparcelamento43_v1'),operationId: z.string().uuid(),idempotencyKey: z.string().uuid(),userId: id,
  contratoOrigemId: id,contratoId: id,raizId: id,parcelasIds: z.array(id).min(1).max(60),principalTransferido: moeda,totalNovo: moeda,
  desembolso: z.literal('0.00'),estadoHash: hash,cotacaoHash: hash,repetida: z.boolean(),
});
export type Reparcelamento43Cotacao = z.infer<typeof reparcelamento43CotacaoSchema>;
export type Reparcelamento43Resultado = z.infer<typeof reparcelamento43ResultadoSchema>;
const cents = (s: string) => BigInt(s.replace('.', ''));
const round = (value: bigint, divisor: bigint) => (value * 2n + divisor) / (divisor * 2n);
export function mesmaIntencao43(a: Reparcelamento43Preview, b: Reparcelamento43Preview) {
  return a.contratoId === b.contratoId && a.numeroParcelas === b.numeroParcelas && a.taxaJuros === b.taxaJuros &&
    a.tipoTaxa === b.tipoTaxa && a.dataInicio === b.dataInicio && a.incluirMultas === b.incluirMultas;
}
export function conferirCotacao43(value: unknown, owner: number, request: Reparcelamento43Preview): Reparcelamento43Cotacao {
  const q = reparcelamento43CotacaoSchema.parse(value);
  if (q.userId !== owner || q.contratoId !== request.contratoId || !mesmaIntencao43(q.request, request) || q.parcelas.length !== request.numeroParcelas)
    throw new Error('Cotação43 de outra intenção');
  const base = cents(q.saldoDevedor), total = cents(q.totalNovo), juros = cents(q.jurosNovos), n = BigInt(request.numeroParcelas);
  if (base <= 0n || juros !== round(base * cents(request.taxaJuros) * n, 10000n) || total !== base + juros || cents(q.valorNovaParcela) !== round(total,n))
    throw new Error('Cálculo43 não conservativo');
  let principal = 0n, valor = 0n, jtotal = 0n;
  const [year, month, day] = request.dataInicio.split('-').map(Number);
  const ref = round(total,n), jr = round(juros,n);
  q.parcelas.forEach((p,i) => {
    const target = new Date(Date.UTC(year,month - 1 + i,1));
    const last = new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
    const date = `${target.getUTCFullYear()}-${String(target.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(day,last)).padStart(2,'0')}`;
    const v = cents(p.valor), j = cents(p.juros), capital = cents(p.principal);
    if (p.numero !== i+1 || p.vencimento !== date || v !== (i+1 === q.parcelas.length ? total-ref*(n-1n) : ref) ||
      j !== (i+1 === q.parcelas.length ? juros-jr*(n-1n) : jr) || v <= 0n || j > v || capital !== v-j)
      throw new Error('Parcela43 diverge da simulação');
    principal += capital; valor += v; jtotal += j;
  });
  if (principal !== base || valor !== total || jtotal !== juros) throw new Error('Rateio43 não conserva centavos');
  return q;
}
export function conferirResultado43(value: unknown, owner: number, input: Reparcelamento43Execucao): Reparcelamento43Resultado {
  const r = reparcelamento43ResultadoSchema.parse(value);
  if (r.userId !== owner || r.contratoOrigemId !== input.contratoId || r.idempotencyKey !== input.idempotencyKey || r.estadoHash !== input.estadoHash ||
    r.cotacaoHash !== input.cotacaoHash || r.contratoId === r.contratoOrigemId || r.parcelasIds.length !== input.numeroParcelas ||
    new Set(r.parcelasIds).size !== r.parcelasIds.length || cents(r.principalTransferido) <= 0n ||
    cents(r.totalNovo) !== cents(r.principalTransferido) + round(cents(r.principalTransferido)*cents(input.taxaJuros)*BigInt(input.numeroParcelas),10000n))
    throw new Error('Confirmação43 diverge da intenção');
  return r;
}
/** Nunca criar outro UUID ao repetir após timeout: conservar este objeto inteiro em armazenamento privado por usuário. */
export function intencao43DaCotacao(q: Reparcelamento43Cotacao, idempotencyKey: string): Reparcelamento43Execucao {
  return reparcelamento43ExecucaoSchema.parse({...q.request,estadoHash:q.estadoHash,cotacaoHash:q.cotacaoHash,idempotencyKey});
}
