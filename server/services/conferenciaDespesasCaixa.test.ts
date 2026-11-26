import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { conferirDespesasCaixa } from './conferenciaDespesasCaixa';

type Consulta = { tabela: string; colunas: string; count?: string; filtros: [string, string, any][]; ordem?: string; inicio: number; fim: number };
const c = { id: 4, user_id: 41, nome: 'Própria', ativo: true, saldo: '100.00' };
const d = { id: 9, user_id: 41, descricao: 'Energia', valor: '10.01', status: 'pago', conta_caixa_id: 4, data_pagamento: '2026-11-26' };
const t = { id: 7, user_id: 41, conta_caixa_id: 4, tipo: 'saida', categoria: 'despesa_operacional', descricao: 'Pagamento: Energia', valor: '10.01', data_transacao: '2026-11-26', contrato_id: null, parcela_id: null };
const p = { despesa_id: 9, user_id: 41, operacao_id: '00000000-0000-4000-8000-000000000001', conta_caixa_id: 4, valor: '10.01', data_pagamento: '2026-11-26', saida_id: 7, estorno_id: null, operacao_estorno_id: null };
const base = (extra: Record<string, any[]> = {}) => ({ contas_caixa: [c], contas_pagar: [d], transacoes_caixa: [t], despesas_rpc_pagamentos: [p], ...extra });
function rest(rows: Record<string, any[]>, ajustar?: (q: Consulta, resposta: any, chamadas: Consulta[]) => any) {
  const chamadas: Consulta[] = [];
  const fonte: any = { rpc: () => { throw new Error('Write proibido: rpc'); }, from(tabela: string) {
    const q: Consulta = { tabela, colunas: '', filtros: [], inicio: 0, fim: 499 };
    const b: any = {
      select(colunas: string, options?: any) { q.colunas = colunas; q.count = options?.count; return b; },
      eq(k: string, v: any) { q.filtros.push(['eq', k, v]); return b; },
      in(k: string, v: any) { q.filtros.push(['in', k, v]); return b; },
      order(k: string) { q.ordem = k; return b; },
      range(a: number, z: number) { q.inicio = a; q.fim = z; return b; },
      then(ok: any, fail: any) {
        chamadas.push(q);
        const all = (rows[tabela] ?? []).filter(r => q.filtros.every(([m, k, v]) => m === 'eq' ? r[k] === v : v.includes(r[k]))).sort((a, z) => a[q.ordem!] - z[q.ordem!]);
        const data = all.slice(q.inicio, q.fim + 1).map(row => Object.fromEntries(q.colunas.split(',').map(col => col.trim()).map(col => { const k = col.replace(/::text$/, ''); return [k, row[k]]; })));
        const resposta = { data, count: all.length, error: null };
        return Promise.resolve(ajustar ? ajustar(q, resposta, chamadas) : resposta).then(ok, fail);
      },
    };
    for (const m of ['insert', 'update', 'delete', 'upsert']) b[m] = () => { throw new Error(`Write proibido: ${m}`); };
    return b;
  } };
  return { fonte, chamadas };
}
beforeEach(() => vi.stubGlobal('fetch', () => { throw new Error('Rede proibida neste teste'); }));
afterEach(() => vi.unstubAllGlobals());

describe('substituto somente leitura da sincronização de caixa', () => {
  it.each(['pago', 'paga'])('status %s e vínculo por ID fecham saldo sem nova saída', async status => {
    const r = rest(base({ contas_pagar: [{ ...d, status }] }));
    const original = JSON.stringify(base());
    const out = await conferirDespesasCaixa(r.fonte, 41);
    expect(out).toMatchObject({ empresaId: 41, somenteLeitura: true, autorizaCorrecao: false, divergencias: [], contas: [{ saldoBase: '100.00', entradas: '0.00', saidas: '10.01', saldoLivro: '89.99' }] });
    expect(JSON.stringify(base())).toBe(original);
    expect(r.chamadas.every(q => q.count === 'exact' && !!q.ordem && !q.colunas.includes('*'))).toBe(true);
  });
  it('duas despesas iguais não adotam uma saída única por descrição', async () => {
    const r = rest(base({ despesas_rpc_pagamentos: [], contas_pagar: [d, { ...d, id: 10 }] }));
    const out = await conferirDespesasCaixa(r.fonte, 41);
    expect(out.divergencias.filter(v => v.tipo === 'legado_sem_vinculo')).toHaveLength(2);
    expect(out.divergencias.filter(v => v.tipo === 'movimento_sem_vinculo')).toHaveLength(1);
    expect(out.contas[0].saldoLivro).toBe('89.99');
  });
  it('estorno preserva saída e entrada, sem duplicar a baixa nem fabricar ajuste', async () => {
    const r = rest(base({ contas_pagar: [{ ...d, status: 'cancelado' }], despesas_rpc_pagamentos: [{ ...p, estorno_id: 8, operacao_estorno_id: '00000000-0000-4000-8000-000000000002' }], transacoes_caixa: [t, { ...t, id: 8, tipo: 'entrada', descricao: 'Estorno: Energia' }] }));
    const out = await conferirDespesasCaixa(r.fonte, 41);
    expect(out.divergencias).toEqual([]); expect(out.contas[0].saldoLivro).toBe('100.00');
  });
  it('perna vinculada ausente é apontamento, não valor criado', async () => {
    const out = await conferirDespesasCaixa(rest(base({ transacoes_caixa: [] })).fonte, 41);
    expect(out.divergencias).toContainEqual(expect.objectContaining({ tipo: 'movimento_ausente' }));
    expect(out.contas[0].saldoLivro).toBe('100.00');
  });
  it('inativa entra na conferência e conta alheia é recusada sem revelar saldo', async () => {
    const r = rest(base({ contas_caixa: [{ ...c, ativo: false }, { ...c, id: 88, user_id: 99, saldo: '999999.00' }] }));
    expect((await conferirDespesasCaixa(r.fonte, 41, 4)).contas[0].ativa).toBe(false);
    await expect(conferirDespesasCaixa(r.fonte, 41, 88)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('owner alheio na conta própria impede valores, sem expor dados alheios', async () => {
    const r = rest(base({ transacoes_caixa: [{ ...t, user_id: 99, valor: '918273.45' }] }));
    const erro = await conferirDespesasCaixa(r.fonte, 41).catch(e => e);
    expect(erro.code).toBe('PRECONDITION_FAILED'); expect(erro.message).not.toMatch(/918273|99/);
    expect(r.chamadas.filter(q => q.tabela === 'transacoes_caixa').every(q => !q.colunas.includes('valor'))).toBe(true);
  });
  it.each([null, 'NaN', '1.001', '-1.00'])('valor físico %s nunca vira zero', async valor => {
    await expect(conferirDespesasCaixa(rest(base({ transacoes_caixa: [{ ...t, valor }] })).fonte, 41)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it('acumulado decimal grande mantém centavos e não usa Number', async () => {
    const out = await conferirDespesasCaixa(rest(base({ contas_caixa: [{ ...c, saldo: '9999999999999.99' }], transacoes_caixa: [{ ...t, tipo: 'entrada', categoria: 'outros', valor: '0.02' }], contas_pagar: [], despesas_rpc_pagamentos: [] })).fonte, 41);
    expect(out.contas[0].saldoLivro).toBe('10000000000000.01');
  });
  it.each(['count-null', 'truncada', 'duplicada', 'erro'])('leitura %s indisponibiliza resultado sem subtotal', async caso => {
    const r = rest(base(), (q, resposta) => {
      if (q.tabela !== 'contas_caixa') return resposta;
      if (caso === 'count-null') return { ...resposta, count: null };
      if (caso === 'truncada') return { ...resposta, data: [] };
      if (caso === 'duplicada') return { ...resposta, count: 2, data: [resposta.data[0], resposta.data[0]] };
      return { data: null, count: null, error: { message: 'SEGREDO' } };
    });
    await expect(conferirDespesasCaixa(r.fonte, 41)).rejects.toThrow();
  });
  it('drift de mesmo count entre observações rejeita relatório', async () => {
    let vezes = 0;
    const r = rest(base(), (q, resposta) => {
      if (q.tabela === 'contas_caixa' && ++vezes === 2) return { ...resposta, data: [{ ...resposta.data[0], saldo: '100.01' }] };
      return resposta;
    });
    await expect(conferirDespesasCaixa(r.fonte, 41)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED', message: expect.stringContaining('mudaram') });
  });
  it('página final do ledger entra na soma e no guard de owner', async () => {
    const many = Array.from({ length: 1001 }, (_, i) => ({ ...t, id: i + 1, categoria: 'outros', valor: '0.01' }));
    const out = await conferirDespesasCaixa(rest(base({ transacoes_caixa: many, contas_pagar: [], despesas_rpc_pagamentos: [] })).fonte, 41);
    expect(out.contas[0].saldoLivro).toBe('89.99');
    await expect(conferirDespesasCaixa(rest(base({ transacoes_caixa: [...many.slice(0, 1000), { ...many[1000], user_id: 99 }] })).fonte, 41)).rejects.toThrow();
  });
  it('rota antiga foi removida em vez de trocar um bloqueio por falso sucesso', () => {
    const router = readFileSync(new URL('../routers/contasPagar.ts', import.meta.url), 'utf8');
    const legado = readFileSync(new URL('../routers.ts', import.meta.url), 'utf8');
    expect(router).not.toContain('sincronizarCaixa:'); expect(legado).not.toContain('sincronizarCaixa:');
    expect(router).toContain('conferirCaixa: protectedProcedure');
    expect(router).toContain('ctx.user.id, input.contaCaixaId');
  });
});
