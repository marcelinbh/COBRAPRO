import { beforeEach, describe, expect, it, vi } from 'vitest';
const dbMock = vi.hoisted(() => ({ getDb: vi.fn(), getSupabaseClientAsync: vi.fn(), resetDb: vi.fn() }));
vi.mock('./db', () => dbMock);
import { appRouter } from './routers';
import { listarEmprestimosSeguros } from './services/emprestimosListaSegura';
import { apresentarEmprestimo } from './services/emprestimosApresentacao';
import { dataHojeBrasilia } from './services/businessDate';
import { projection51Test } from './services/projection51TestSource';
const caller = (user: any = { id: 41 }) => appRouter.createCaller({ user, req: { headers: {} }, res: {} } as any).contratos;
const contract = { id: 1, user_id: 41, cliente_id: 2, koletor_id: null, modalidade: 'mensal', status: 'ativo', valor_principal: '100.00' };
const parcel = { id: 3, user_id: 41, contrato_id: 1, cliente_id: 2, numero_parcela: 1, valor_original: '100.00', valor_juros: '10.00', valor_pago: '0.00', valor_multa: '0.00', multa_manual: '0.00', saldo_residual: '0.00', data_vencimento: '2027-01-10', data_pagamento: null, status: 'pendente' };
type Call = { table: string; fields: string; filters: [string, any][]; start: number; end: number };
function source() {
  const tables: Record<string, any[]> = { contratos: [{ ...contract }], clientes: [{ id: 2, user_id: 41, nome: 'Cliente sintético' }], parcelas: [{ ...parcel }], koletores: [], configuracoes: [] };
  const calls: Call[] = [];
  let fault: ((call: Call, data: any[], result: any) => any) | undefined;
  const from = vi.fn((table: string) => {
    let fields = ''; const filters: [string, any][] = [], orders: string[] = [];
    const q: any = {
      select: (f: string, opts: any) => { expect(opts).toEqual({ count: 'exact' }); fields = f; return q; },
      eq: (k: string, v: any) => { filters.push([k, v]); return q; },
      in: (k: string, v: any[]) => { expect(v.length).toBeGreaterThan(0); filters.push([k, v]); return q; },
      order: (k: string) => { orders.push(k.replaceAll('"', '')); return q; },
      range: async (start: number, end: number) => {
        const call = { table, fields, filters, start, end }; calls.push(call);
        const data = tables[table].filter(r => filters.every(([k, v]) => Array.isArray(v) ? v.includes(r[k]) : r[k] === v)).sort((a, b) => {
          for (const k of orders) { const d = a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0; if (d) return d; } return 0;
        });
        const keys = fields.replaceAll('"', '').split(',').map(s => s.trim());
        const result = { data: data.slice(start, end + 1).map(r => Object.fromEntries(keys.filter(k => k in r).map(k => [k, r[k]]))), error: null, count: data.length, status: 200 };
        return fault?.(call, data, result) ?? result;
      },
    }; return q;
  });
  const rpc = vi.fn();
  const backend = { from, rpc: async (name: string, args: Record<string, unknown>) => {
    if (name === 'rpc_estado_obrigacoes51') {
      const p = projection51Test(); p.contratoId = Number(args.p_contrato_id); p.obrigacaoAdicional = '0.00';
      p.parcelas = tables.parcelas.filter(row => row.contrato_id === p.contratoId).map(row => ({
        parcelaId: row.id, statusFinanceiroOriginal: row.status,
        statusObrigacao: ['paga', 'pago'].includes(row.status) ? 'paga' : ['cancelada', 'cancelado'].includes(row.status) ? 'cancelada' : row.status === 'renovada' ? 'transferida' : 'aberta',
        obrigacaoAtual: ['paga', 'pago', 'cancelada', 'cancelado', 'renovada'].includes(row.status) ? '0.00' : row.status === 'parcial' ? String(row.saldo_residual) : String(row.valor_original),
        componenteAdicional: '0.00', arquivada: false,
      }));
      p.statusObrigacao = p.parcelas.some(row => row.statusObrigacao === 'aberta') ? 'ativo' : p.parcelas.some(row => row.statusObrigacao === 'cancelada') ? 'encerrado_por_cancelamento' : 'quitado';
      return { data: p, error: null };
    }
    return rpc(name, args);
  } };
  return { from, rpc, backend, tables, calls, setFault: (fn: typeof fault) => { fault = fn; } };
}
const moneyCalls = (f: ReturnType<typeof source>) => f.calls.filter(c => /valor_original|valor_principal/.test(c.fields));
const safe = async (f: ReturnType<typeof source>) => { dbMock.getSupabaseClientAsync.mockResolvedValue(f.backend); return caller().listLeituraSegura(); };
function addBadOwn(f: ReturnType<typeof source>) {
  f.tables.contratos.push({ ...contract, id: 42, cliente_id: 43, valor_principal: '987654.32' });
  f.tables.clientes.push({ id: 43, user_id: 41, nome: 'Nome próprio indisponível não exposto' });
  f.tables.parcelas.push({ ...parcel, id: 44, contrato_id: 42, cliente_id: 999, user_id: 99, valor_original: '876543.21' });
}
beforeEach(() => { vi.clearAllMocks(); dbMock.getDb.mockImplementation(() => { throw new Error('Drizzle proibido'); }); });
describe('Caller real: lista segura isolada', () => {
  it('autenticação antes do backend e nenhum scope fornecido pelo cliente', async () => {
    await expect(caller(null).listLeituraSegura()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller({ id: 0 }).listLeituraSegura()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect((caller().listLeituraSegura as any)({ userId: 99, contratoId: 1 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(dbMock.getSupabaseClientAsync).not.toHaveBeenCalled();
  });
  it('backend ausente/erro nunca é vazio nem sucesso parcial', async () => {
    dbMock.getSupabaseClientAsync.mockResolvedValue(null);
    await expect(caller().listLeituraSegura()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    dbMock.getSupabaseClientAsync.mockRejectedValue(new Error('offline'));
    await expect(caller().listLeituraSegura()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });
  it('saudável usa apresentação corrente e escopo próprio, sem caixa/writer', async () => {
    const f = source(), result = await safe(f), expected = apresentarEmprestimo(contract, [parcel], dataHojeBrasilia());
    expect(result.userId).toBe(41); expect(result.items).toMatchObject([{ kind: 'validated', id: 1, clienteId: 2, clienteNome: 'Cliente sintético', modalidade: 'mensal', status: 'ativo', capital: 100, totalReceber: expected.totalReceber, totalPago: expected.totalPago }]);
    expect(result.coverage).toMatchObject({ complete: true, validatedContracts: 1, unavailableContracts: 0 }); expect(result.warning).toBeNull();
    expect(f.calls[0]).toMatchObject({ table: 'koletores', filters: [['user_id', 41], ['ativo', true]] });
    expect(moneyCalls(f).every(c => c.filters.some(([k, v]) => k === 'user_id' && v === 41))).toBe(true);
    expect(f.calls.every(c => !/caixa|clientes!/.test(c.table + c.fields))).toBe(true); expect(f.rpc).not.toHaveBeenCalled(); expect(dbMock.getDb).not.toHaveBeenCalled();
  });
  it('contrato próprio problemático é SÓ placeholder e totais explicitamente parciais', async () => {
    const f = source(); addBadOwn(f); const r = await safe(f);
    expect(r.items[1]).toEqual({ kind: 'unavailable', id: 42, message: 'Empréstimo indisponível: não foi possível confirmar seus vínculos.' });
    expect(r.coverage).toEqual({ scopedContracts: 2, validatedContracts: 1, unavailableContracts: 1, complete: false, label: 'validados somente' });
    expect(r.totals).toEqual({ label: 'validados somente', values: { capital: 100, totalReceber: 100, totalPago: 0 } });
    expect(r.warning).toContain('não representam toda a carteira');
    expect(JSON.stringify(r)).not.toMatch(/987654|876543|indisponível não exposto|999/);
    for (const c of moneyCalls(f)) { expect(c.filters).toContainEqual(['user_id', 41]); expect(c.filters).toContainEqual(['cliente_id', 2]); expect(c.filters).toContainEqual([c.table === 'contratos' ? 'id' : 'contrato_id', [1]]); }
    expect(f.calls.find(c => c.fields.includes('nome'))!.filters).toContainEqual(['id', [2]]);
    const monetaryParcel = moneyCalls(f).find(c => c.table === 'parcelas')!; expect(monetaryParcel.filters).toContainEqual(['id', [3]]);
  });
  it('todos indisponíveis não produzem zeros inventados, nomes ou consultas monetárias', async () => {
    const f = source(); f.tables.parcelas[0].user_id = null; const r = await safe(f);
    expect(r.totals.values).toBeNull(); expect(r.coverage.complete).toBe(false); expect(moneyCalls(f)).toEqual([]); expect(f.calls.some(c => /nome/.test(c.fields))).toBe(false); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('base vazia confirmada é completa e zero verdadeiro; sem consultas monetárias', async () => {
    const f = source(); f.tables.contratos = []; const r = await safe(f);
    expect(r.items).toEqual([]); expect(r.coverage).toMatchObject({ complete: true, scopedContracts: 0 }); expect(r.totals.values).toEqual({ capital: 0, totalReceber: 0, totalPago: 0 }); expect(moneyCalls(f)).toEqual([]);
  });
  it.each(['foreign', 'missing', 'invalid'])('cliente próprio não confirmado %s: placeholder sem nome estrangeiro', async kind => {
    const f = source(); if (kind === 'foreign') f.tables.clientes[0].user_id = 99; if (kind === 'missing') f.tables.clientes = []; if (kind === 'invalid') f.tables.contratos[0].cliente_id = null;
    const r = await safe(f); expect(r.items[0].kind).toBe('unavailable'); expect(moneyCalls(f)).toEqual([]); expect(f.calls.some(c => /nome/.test(c.fields))).toBe(false);
  });
  it.each([99, null, undefined])('owner da parcela %s nunca é ignorado globalmente: placeholder OWN', async owner => {
    const f = source(); f.tables.parcelas[0].user_id = owner; const r = await safe(f); expect(r.items[0].kind).toBe('unavailable'); expect(moneyCalls(f)).toEqual([]);
  });
  it('cliente da parcela divergente torna SOMENTE seu pai OWN indisponível', async () => {
    const f = source(); f.tables.parcelas[0].cliente_id = 77; expect((await safe(f)).items[0].kind).toBe('unavailable'); expect(moneyCalls(f)).toEqual([]);
  });
  it('parcela metadada com contrato fora da seleção causa falha GLOBAL antes de dinheiro', async () => {
    const f = source(); f.setFault((c, _, r) => c.table === 'parcelas' ? { ...r, data: [{ ...r.data[0], contrato_id: 999 }] } : undefined);
    await expect(safe(f)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' }); expect(moneyCalls(f)).toEqual([]);
  });
  it.each(['contratos', 'clientes', 'koletores'])('owner estrangeiro retornado por fonte maliciosa %s causa falha GLOBAL', async table => {
    const f = source(); if (table === 'koletores') f.tables.koletores = [{ id: 7, user_id: 41, perfil: 'koletor', ativo: true }];
    f.setFault((c, _, r) => c.table === table && r.data.length ? { ...r, data: [{ ...r.data[0], user_id: 99 }] } : undefined);
    await expect(safe(f)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' }); expect(moneyCalls(f)).toEqual([]);
  });
  it('metadados não podem carregar coluna monetária/nome, getters ou pai ausente', async () => {
    for (const mode of ['extra', 'getter', 'missing']) {
      const f = source(); const getter = vi.fn(() => 41);
      f.setFault((c, _, r) => {
        if (c.table !== 'parcelas') return;
        const row = { ...r.data[0] }; if (mode === 'extra') row.valor_original = '999.00'; if (mode === 'missing') delete row.contrato_id;
        if (mode === 'getter') Object.defineProperty(row, 'user_id', { enumerable: true, get: getter }); return { ...r, data: [row] };
      });
      await expect(safe(f)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' }); expect(getter).not.toHaveBeenCalled(); expect(moneyCalls(f)).toEqual([]);
    }
  });
  it('koletor ativo mantém filtro EXATO em todas as consultas de contrato, admin não restringe', async () => {
    const f = source(); f.tables.koletores = [{ id: 7, user_id: 41, perfil: 'koletor', ativo: true }]; f.tables.contratos[0].koletor_id = 7;
    f.tables.contratos.push({ ...contract, id: 88, koletor_id: 8 }); expect((await safe(f)).items.map(r => r.id)).toEqual([1]);
    expect(f.calls.filter(c => c.table === 'contratos').every(c => c.filters.some(([k, v]) => k === 'koletor_id' && v === 7))).toBe(true);
    const a = source(); a.tables.koletores = [{ id: 7, user_id: 41, perfil: 'admin', ativo: true }]; await safe(a); expect(a.calls.filter(c => c.table === 'contratos').every(c => !c.filters.some(([k]) => k === 'koletor_id'))).toBe(true);
  });
  it.each(['multiple', 'inactive', 'unknown', 'wrongContract'])('escopo koletor inválido %s nunca degrada para owner-only', async mode => {
    const f = source(); f.tables.koletores = [{ id: 7, user_id: 41, perfil: 'koletor', ativo: true }];
    if (mode === 'multiple') f.tables.koletores.push({ id: 8, user_id: 41, perfil: 'admin', ativo: true });
    f.setFault((c, _, r) => {
      if (c.table === 'koletores' && mode === 'inactive') return { ...r, data: [{ ...r.data[0], ativo: false }] };
      if (c.table === 'koletores' && mode === 'unknown') return { ...r, data: [{ ...r.data[0], perfil: 'unexpected' }] };
      if (c.table === 'contratos' && mode === 'wrongContract') return { ...r, count: 1, data: [{ id: 1, user_id: 41, cliente_id: 2, koletor_id: 8 }] };
    });
    await expect(safe(f)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' }); expect(moneyCalls(f)).toEqual([]);
  });
  it.each(['koletores', 'contratos', 'clientes', 'parcelas', 'configuracoes'])('503/erro em %s invalida TUDO, não resposta parcial', async table => {
    const f = source(); addBadOwn(f); f.setFault(c => c.table === table ? { data: null, count: null, error: { message: '503' }, status: 503 } : undefined);
    await expect(safe(f)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });
  it.each(['missingCount', 'cap', 'truncated', 'overcount', 'duplicate', '503NoError', 'throw'])('paginação adversarial %s falha fechada', async kind => {
    const f = source(); f.setFault((c, _, r) => {
      if (c.table !== 'parcelas') return;
      if (kind === 'throw') throw new Error('503');
      if (kind === 'duplicate') return { ...r, data: [r.data[0], r.data[0]], count: 2 };
      if (kind === 'missingCount') return { ...r, count: null };
      if (kind === 'cap') return { ...r, count: 20000 };
      if (kind === 'truncated') return { ...r, count: 2 };
      if (kind === 'overcount') return { ...r, count: 0 };
      if (kind === '503NoError') return { ...r, status: 503 };
    });
    await expect(safe(f)).rejects.toMatchObject({ code: kind === 'duplicate' ? 'PRECONDITION_FAILED' : 'INTERNAL_SERVER_ERROR' }); expect(moneyCalls(f)).toEqual([]);
  });
  it('percorre 3 páginas completas; parcela inválida na terceira não é omitida', async () => {
    const f = source(); f.tables.parcelas = Array.from({ length: 2001 }, (_, i) => ({ ...parcel, id: i + 10 })); f.tables.parcelas[2000].user_id = 99;
    const r = await safe(f); expect(r.items[0].kind).toBe('unavailable'); expect(f.calls.filter(c => c.table === 'parcelas').slice(0, 3).map(c => c.start)).toEqual([0, 1000, 2000]); expect(moneyCalls(f)).toEqual([]);
  });
  it.each(['countChange', 'pageError', 'pageDuplicate'])('segunda página %s não é sucesso parcial', async kind => {
    const f = source(); f.tables.parcelas = Array.from({ length: 1001 }, (_, i) => ({ ...parcel, id: i + 10 }));
    f.setFault((c, _, r) => c.table === 'parcelas' && c.start === 1000 ? kind === 'countChange' ? { ...r, count: 1002 } : kind === 'pageError' ? { data: null, count: null, error: {}, status: 503 } : { ...r, data: [{ ...r.data[0], id: 10 }] } : undefined);
    await expect(safe(f)).rejects.toMatchObject({ code: kind === 'pageDuplicate' ? 'PRECONDITION_FAILED' : 'INTERNAL_SERVER_ERROR' }); expect(moneyCalls(f)).toEqual([]);
  });
  it.each(['id', 'owner', 'contract', 'customer', 'missing'])('crosscheck monetário %s não vira placeholder/sucesso', async kind => {
    const f = source(); f.setFault((c, _, r) => {
      if (!c.fields.includes('valor_original')) return;
      const row = { ...r.data[0] }; if (kind === 'id') row.id = 999; if (kind === 'owner') row.user_id = 99; if (kind === 'contract') row.contrato_id = 999; if (kind === 'customer') row.cliente_id = 999;
      return { ...r, data: kind === 'missing' ? [] : [row], count: kind === 'missing' ? 0 : r.count };
    }); await expect(safe(f)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it('nome estrangeiro injetado na query monetária validada é erro global e não é devolvido', async () => {
    const f = source(); f.setFault((c, _, r) => c.fields.includes('nome') ? { ...r, data: [{ id: 2, user_id: 99, nome: 'NOME ESTRANGEIRO' }] } : undefined);
    await expect(safe(f)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it('race observável antes de money ou na reconferência final invalida toda resposta', async () => {
    for (const late of [false, true]) {
      const f = source(); let metadataCalls = 0;
      f.setFault((c, _, r) => {
        if (c.table === 'parcelas' && !c.fields.includes('valor_original')) {
          metadataCalls++; if (metadataCalls === (late ? 3 : 2)) return { ...r, data: [{ ...r.data[0], user_id: 99 }] };
        }
      });
      await expect(safe(f)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' }); if (!late) expect(moneyCalls(f)).toEqual([]);
    }
  });
  it.each(['koletores', 'contratos', 'clientes'])('mudança de %s na reconferência não certifica parcial', async table => {
    const f = source(); let n = 0; if (table === 'koletores') f.tables.koletores = [{ id: 7, user_id: 41, perfil: 'admin', ativo: true }];
    f.setFault((c, _, r) => { if (c.table === table && !/valor_principal|nome/.test(c.fields)) { n++; if (n === (table === 'contratos' ? 3 : 2)) return { ...r, count: 0, data: [] }; } });
    await expect(safe(f)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it('erro de apresentação corrente não vira placeholder financeiro', async () => {
    const f = source(); f.tables.parcelas[0].valor_original = 'bad'; await expect(safe(f)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it('usa apenas RPC de leitura estrita com user/contrato/parcela validados; falha de quote não vira parcial', async () => {
    const f = source(); addBadOwn(f); f.tables.parcelas[0].multa_manual = '10.00';
    f.rpc.mockResolvedValue({ data: { userId: 41, contratoId: 1, parcelaId: 3, trilho: 'multa36', status: 'pendente' }, error: null });
    // Envelope de origem válido; envelope de quote deliberadamente inválido.
    await expect(safe(f)).rejects.toBeInstanceOf(Error);
    expect(f.rpc.mock.calls[0]).toEqual(['rpc_identificar_multa36', { p_user_id: 41, p_contrato_id: 1, p_parcela_id: 3 }]);
    expect(f.rpc.mock.calls.every(([name, p]) => /^(rpc_identificar_multa36|rpc_cotar_multa36)$/.test(name) && p.p_user_id === 41 && p.p_contrato_id === 1 && p.p_parcela_id === 3)).toBe(true);
  });
  it('máximo quatro leituras de contrato em voo; falha interrompe fanout e aguarda iniciadas', async () => {
    for (const fail of [false, true]) {
      const f = source(); f.tables.contratos = Array.from({ length: 12 }, (_, i) => ({ ...contract, id: i + 1 }));
      f.tables.parcelas = Array.from({ length: 12 }, (_, i) => ({ ...parcel, id: i + 100, contrato_id: i + 1 }));
      let active = 0, max = 0; const originalFrom = f.from.getMockImplementation()!;
      f.from.mockImplementation(table => {
        const q = originalFrom(table), range = q.range;
        q.range = async (...args: any[]) => {
          active++; max = Math.max(max, active);
          try { await new Promise(resolve => setTimeout(resolve, 1)); return await range(...args); }
          finally { active--; }
        }; return q;
      });
      if (fail) f.setFault(c => c.table === 'contratos' && c.fields.includes('valor_principal') ? { data: null, count: null, error: {}, status: 503 } : undefined);
      if (fail) await expect(safe(f)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' }); else expect((await safe(f)).items).toHaveLength(12);
      expect(max).toBeGreaterThan(1); expect(max).toBeLessThanOrEqual(4); expect(active).toBe(0);
      if (fail) expect(moneyCalls(f).filter(c => c.table === 'contratos').length).toBeLessThanOrEqual(4);
    }
  });
  it('cotação válida mantém apresentação corrente e só RPCs de leitura', async () => {
    const f = source(); f.tables.parcelas[0].multa_manual = '10.00';
    const quote = { elegivel: true, contratoId: 1, parcelaId: 3, contaCaixaId: 9, totalExigido: '110.00', multa: '10.00', mora: '0.00', jurosEmbutidos: '10.00', valorPagoAcumulado: '0.00', dataPagamento: dataHojeBrasilia(), vencimento: '2027-01-10', status: 'pendente', estadoHash: 'a'.repeat(64), regra: 'recebimento_multa36_brt_v1' };
    f.rpc.mockImplementation(async name => ({ data: name === 'rpc_identificar_multa36' ? { userId: 41, contratoId: 1, parcelaId: 3, trilho: 'multa36', status: 'pendente' } : quote, error: null }));
    const r = await safe(f); expect(r.items[0]).toMatchObject({ kind: 'validated', totalReceber: 110 });
    expect(f.rpc.mock.calls.map(([name]) => name)).toEqual(['rpc_identificar_multa36', 'rpc_cotar_multa36', 'rpc_cotar_multa36']);
  });
  it('data inválida recusa antes de qualquer query', async () => {
    const f = source(); await expect(listarEmprestimosSeguros(f, 41, '2026-99-99')).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' }); expect(f.from).not.toHaveBeenCalled();
  });
  it('endpoint estrito original CONTINUA recusando o mesmo vínculo, enquanto o novo mostra OWN placeholder', async () => {
    const f = source(); addBadOwn(f); dbMock.getSupabaseClientAsync.mockResolvedValue(f.backend);
    await expect(caller().listComParcelas()).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect((await caller().listLeituraSegura()).items.map(i => i.kind)).toEqual(['validated', 'unavailable']);
  });
});
