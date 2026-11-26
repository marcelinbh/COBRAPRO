// Fixture sintética, somente para testes; não é adapter financeiro de produção.
import type { Projection51 } from '../../shared/obrigacoes51';
export const uid51Test = 41, cid51Test = 1, customer51Test = 2;
export const contract51Test = { id: 1, user_id: 41, cliente_id: 2, koletor_id: null, modalidade: 'mensal', status: 'ativo', valor_principal: '100.00', numero_parcelas: 2 };
export const parcel51Test = { id: 3, user_id: 41, contrato_id: 1, cliente_id: 2, numero_parcela: 1, valor_original: '110.00', valor_juros: '10.00', valor_pago: '0.00', valor_multa: '0.00', multa_manual: '0.00', saldo_residual: '0.00', data_vencimento: '2026-11-26', data_pagamento: null, status: 'pendente' };
export function projection51Test(): Projection51 {
  return { versao: 'obrigacoes51_v1', userId: 41, contratoId: 1, statusObrigacao: 'ativo', arquivado: false, obrigacaoAdicional: '0.00',
    parcelas: [{ parcelaId: 3, statusFinanceiroOriginal: 'pendente', statusObrigacao: 'aberta', obrigacaoAtual: '110.00', componenteAdicional: '0.00', arquivada: false }] };
}
export function source51Test(projection = projection51Test()) {
  const tables: Record<string, Record<string, unknown>[]> = { contratos: [{ ...contract51Test }], clientes: [{ id: 2, user_id: 41, nome: 'Cliente sintético', whatsapp: '5531999999999', chave_pix: null }], parcelas: [{ ...parcel51Test }], koletores: [], configuracoes: [] };
  const calls: { table: string; fields: string; filters: [string, unknown][] }[] = [];
  const events: string[] = [];
  let response: unknown = projection;
  let onRpc: ((index: number) => void) | undefined;
  let rpcCount = 0;
  function from(table: string) {
    let fields = ''; const filters: [string, unknown][] = [], orders: string[] = [];
    const q = {
      select(f: string, _opts?: unknown) { fields = f; return q; },
      eq(k: string, v: unknown) { filters.push([k, v]); return q; },
      in(k: string, v: unknown[]) { filters.push([k, v]); return q; },
      order(k: string) { orders.push(k); return q; },
      async range(start: number, end: number) {
        events.push(`REST:${table}:${fields}`); calls.push({ table, fields, filters });
        const keys = fields.replaceAll('"', '').split(',').map(v => v.trim());
        const rows = tables[table].filter(row => filters.every(([k, v]) => Array.isArray(v) ? v.includes(row[k]) : row[k] === v))
          .sort((a, b) => { for (const k of orders) { const x = String(a[k]), y = String(b[k]); if (x !== y) return x < y ? -1 : 1; } return 0; });
        return { data: rows.slice(start, end + 1).map(row => Object.fromEntries(keys.filter(k => k in row).map(k => [k, row[k]]))), count: rows.length, error: null, status: 200 };
      },
    };
    return q;
  }
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  async function rpc(name: string, args: Record<string, unknown>) {
    events.push(`RPC:${name}`); rpcCalls.push({ name, args }); onRpc?.(++rpcCount);
    return { data: response, error: null };
  }
  return { from, rpc, tables, calls, events, rpcCalls, setResponse: (v: unknown) => { response = v; }, setOnRpc: (fn: typeof onRpc) => { onRpc = fn; } };
}
