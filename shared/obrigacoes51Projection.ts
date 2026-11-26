import { projection51, type Projection51 } from './obrigacoes51';
import { statusCalendarioParcela } from './parcelasCalendar';

export type MetadadoParcela51 = { id: unknown; user_id: unknown; contrato_id: unknown; cliente_id: unknown };
const id51 = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 2147483647;
const invalid = (): never => { throw new Error('Projeção51 incompleta ou divergente; valores não confirmados.'); };
/** Aceita dados próprios JSON, sem executar accessors nem aceitar protótipos arbitrários. */
function jsonDados51(v: unknown, budget: { left: number; maxArray: number }): unknown {
  if (--budget.left < 0) return invalid();
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (!v || typeof v !== 'object') return invalid();
  if (Array.isArray(v)) {
    if (Object.getPrototypeOf(v) !== Array.prototype) return invalid();
    const props = Object.getOwnPropertyDescriptors(v), n = Object.getOwnPropertyDescriptor(v, 'length')?.value;
    if (!Number.isInteger(n) || n < 0 || n > budget.maxArray || Reflect.ownKeys(props).length !== n + 1) return invalid();
    return Array.from({ length: n }, (_, i) => {
      const d = props[String(i)];
      if (!d?.enumerable || !('value' in d)) return invalid();
      return jsonDados51(d.value, budget);
    });
  }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(v))) return invalid();
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(v)) {
    if (typeof key !== 'string') return invalid();
    const d = Object.getOwnPropertyDescriptor(v, key)!;
    if (!d.enumerable || !('value' in d)) return invalid();
    copy[key] = jsonDados51(d.value, budget);
  }
  return copy;
}
export function centavos51(text: string): bigint {
  if (!/^(0|[1-9][0-9]{0,12})\.[0-9]{2}$/.test(text)) return invalid();
  return BigInt(text.replace('.', ''));
}
export function validarMetadados51(rows: readonly MetadadoParcela51[], uid: number, cid: number): number[] {
  if (!id51(uid) || !id51(cid) || !Array.isArray(rows)) return invalid();
  const ids: number[] = [];
  for (const row of rows) {
    const values: unknown[] = [];
    for (const k of ['id', 'user_id', 'contrato_id', 'cliente_id']) {
      const d = row && Object.getOwnPropertyDescriptor(row, k);
      if (!d?.enumerable || !('value' in d)) return invalid();
      values.push(d.value);
    }
    const [id, owner, parent, customer] = values;
    if (!id51(id) || !id51(customer) || owner !== uid || parent !== cid || ids.includes(id)) return invalid();
    ids.push(id);
  }
  return ids;
}
/** A RPC prova owner/contrato; o conjunto original completo prova a seleção de parcelas. */
export function validarProjecao51(raw: unknown, uid: number, cid: number, ids: readonly number[]): Projection51 {
  if (!id51(uid) || !id51(cid) || ids.some(v => !id51(v)) || new Set(ids).size !== ids.length) return invalid();
  const p = projection51.parse(jsonDados51(raw, { left: 100 + ids.length * 10, maxArray: ids.length }));
  if (p.userId !== uid || p.contratoId !== cid || p.parcelas.length !== ids.length) return invalid();
  const expected = new Set(ids), found = new Set<number>();
  let additional = 0n;
  for (const row of p.parcelas) {
    if (!expected.has(row.parcelaId) || found.has(row.parcelaId)) return invalid();
    found.add(row.parcelaId);
    const due = centavos51(row.obrigacaoAtual), a = centavos51(row.componenteAdicional);
    additional += a;
    if (row.statusObrigacao !== 'aberta' && due !== 0n) return invalid();
    if (row.statusObrigacao === 'aberta' && (due === 0n || !['pendente', 'atrasada', 'atrasado', 'vencendo_hoje', 'parcial'].includes(row.statusFinanceiroOriginal))) return invalid();
    // Cancelamento de irmã/contrato jamais reclassifica recebimento já pago.
    if (['paga', 'pago'].includes(row.statusFinanceiroOriginal) && row.statusObrigacao !== 'paga') return invalid();
    if (row.statusObrigacao === 'paga' && !['paga', 'pago'].includes(row.statusFinanceiroOriginal)) return invalid();
    if (row.statusObrigacao === 'transferida' && row.statusFinanceiroOriginal !== 'renovada') return invalid();
    if (row.statusFinanceiroOriginal === 'renovada' && row.statusObrigacao !== 'transferida') return invalid();
    if (p.arquivado && !row.arquivada) return invalid();
  }
  if (additional !== centavos51(p.obrigacaoAdicional)) return invalid();
  const hasOpen = p.parcelas.some(row => row.statusObrigacao === 'aberta');
  if (hasOpen !== (p.statusObrigacao === 'ativo')) return invalid();
  if (p.statusObrigacao === 'quitado' && p.parcelas.some(row => row.statusObrigacao === 'cancelada')) return invalid();
  if (p.statusObrigacao === 'encerrado_por_cancelamento' && !p.parcelas.some(row => row.statusObrigacao === 'cancelada')) return invalid();
  return p;
}
export function exigirProvaLinha51(p: Projection51, id: unknown, status: string) {
  const row = p.parcelas.find(r => r.parcelaId === id);
  if (!row || row.statusFinanceiroOriginal !== status) return invalid();
  return row;
}
export function projetarContrato51(statusOriginal: string, p: Projection51) {
  // Arquivo é atributo, não quitação. Origens transferidas mantêm rótulo explícito.
  const status = p.statusObrigacao === 'encerrado_por_cancelamento' ? 'encerrado_por_cancelamento'
    : ['cancelado', 'cancelada', 'renegociado', 'encerrado'].includes(statusOriginal) ? statusOriginal : p.statusObrigacao;
  return { status, statusFinanceiroOriginal: statusOriginal, statusObrigacao: p.statusObrigacao,
    arquivado: p.arquivado, obrigacaoAdicional: p.obrigacaoAdicional };
}
export function projetarParcela51<P extends { id: unknown; status: string; data_vencimento: string }>(row: P, p: Projection51, hoje: string) {
  const proof = exigirProvaLinha51(p, row.id, row.status);
  const status = proof.statusObrigacao === 'cancelada' ? 'cancelada'
    : proof.statusObrigacao === 'transferida' ? 'renovada'
    : proof.statusObrigacao === 'paga' ? row.status : statusCalendarioParcela(row.status === 'atrasado' ? 'atrasada' : row.status, row.data_vencimento, hoje);
  return { ...row, status, statusFinanceiroOriginal: proof.statusFinanceiroOriginal,
    statusObrigacao: proof.statusObrigacao, obrigacaoAtual: proof.obrigacaoAtual,
    componenteAdicional: proof.componenteAdicional, arquivada: proof.arquivada };
}
export function exigivel51(p: Projection51, parcelaId: number): boolean {
  const row = p.parcelas.find(r => r.parcelaId === parcelaId);
  if (!row) return invalid();
  return p.statusObrigacao === 'ativo' && !p.arquivado && row.statusObrigacao === 'aberta' && !row.arquivada && centavos51(row.obrigacaoAtual) > 0n;
}
