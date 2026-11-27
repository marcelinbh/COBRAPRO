import assert from 'node:assert/strict';
import { test, expect, vi } from 'vitest';
import { mapearSnapshot60, listarEmprestimosSnapshot60, RPC60, LOCAL_REASONS60 } from './snapshot60-reader';
const UID = 41, CID = 1, PID = 3, DATE = '2026-11-27';
const fixture = () => ({ versao: 'lista_emprestimos60_v1', userId: UID, dataCalculo: DATE, configuracoes: [], items: [{
  kind: 'validated', id: CID,
  contrato: { id: CID, user_id: UID, cliente_id: 2, koletor_id: null, modalidade: 'mensal', status: 'ativo', valor_principal: '100.00' },
  cliente: { id: 2, user_id: UID, nome: 'Cliente sintético' },
  parcelas: [{ id: PID, user_id: UID, contrato_id: CID, cliente_id: 2, numero_parcela: 1,
    valor_original: '110.00', valor_juros: '10.00', valor_pago: '0.00', valor_multa: '0.00', multa_manual: '0.00', saldo_residual: '0.00', data_vencimento: '2027-01-10', data_pagamento: null, status: 'pendente' }],
  estado51: { versao: 'obrigacoes51_v1', userId: UID, contratoId: CID, statusObrigacao: 'ativo', arquivado: false, obrigacaoAdicional: '0.00', parcelas: [{ parcelaId: PID, statusFinanceiroOriginal: 'pendente', statusObrigacao: 'aberta', obrigacaoAtual: '110.00', componenteAdicional: '0.00', arquivada: false }] }, cotacoes36: null,
}] });
function refuse(fn: () => unknown) { assert.throws(fn); }
test('DTO saudável preserva nomes own, valores, totais e obrigação', () => {
  const r = mapearSnapshot60(fixture(), UID);
  assert.deepEqual(r.totals.values, { capital: 100, totalReceber: 110, totalPago: 0 });
  assert.equal(r.coverage.complete, true); assert.equal(r.items[0].kind, 'validated');
  assert.equal((r.items[0] as any).obrigacaoAtual, '110.00');
});
test('recusas allowlist são placeholders estritos, todos recusados => total null', () => {
  for (const reason of LOCAL_REASONS60) {
    const r = mapearSnapshot60({ ...fixture(), items: [{ kind: 'unavailable', id: CID, reason }] }, UID);
    assert.equal(r.totals.values, null); assert.equal(r.coverage.complete, false);
    assert.deepEqual(Object.keys(r.items[0]).sort(), ['id', 'kind', 'message']);
  }
});
test('carteira vazia confirmada => zeros verdadeiros', () => {
  const r = mapearSnapshot60({ ...fixture(), items: [] }, UID);
  assert.deepEqual(r.totals.values, { capital: 0, totalReceber: 0, totalPago: 0 }); assert.equal(r.coverage.complete, true);
});
test('placeholder parcial fica na enumeração e não entra nos totais', () => {
  const f: any = fixture(); f.items.push({ kind: 'unavailable', id: 9, reason: 'local_link_unconfirmed' });
  const r = mapearSnapshot60(f, UID); assert.equal(r.items.length, 2); assert.equal(r.coverage.complete, false); assert.equal(r.totals.values!.totalReceber, 110);
});
test('owner externo em root/contrato/cliente/parcela/projeção é fatal', () => {
  for (const change of [(f: any) => f.userId = 99, (f: any) => f.items[0].contrato.user_id = 99,
    (f: any) => f.items[0].cliente.user_id = 99, (f: any) => f.items[0].parcelas[0].user_id = 99,
    (f: any) => f.items[0].estado51.userId = 99]) { const f = fixture(); change(f); refuse(() => mapearSnapshot60(f, UID)); }
});
test('parent/customer/seleção de parcelas divergentes são fatais', () => {
  for (const change of [(f: any) => f.items[0].parcelas[0].contrato_id = 99,
    (f: any) => f.items[0].parcelas[0].cliente_id = 99, (f: any) => f.items[0].estado51.parcelas = [],
    (f: any) => f.items.push(f.items[0]), (f: any) => f.items[0].parcelas.push(f.items[0].parcelas[0])]) {
    const f = fixture(); change(f); refuse(() => mapearSnapshot60(f, UID));
  }
});
test('recusa genérica/network/57014 não vira placeholder', () => {
  for (const reason of ['57014', 'timeout', '42501', '51 evento sem closure exata']) {
    refuse(() => mapearSnapshot60({ ...fixture(), items: [{ kind: 'unavailable', id: CID, reason }] }, UID));
  }
});
test('fields extras em placeholder/contrato não podem vazar nomes/PII', () => {
  refuse(() => mapearSnapshot60({ ...fixture(), items: [{ kind: 'unavailable', id: CID, reason: LOCAL_REASONS60[0], clienteNome: 'Não exponha' }] }, UID));
  const f: any = fixture(); f.items[0].contrato.saldo_conta = '999.00'; refuse(() => mapearSnapshot60(f, UID));
});
test('getters não executados, arrays sparse/ciclos/protótipos rejeitados', () => {
  let invoked = 0; const f: any = fixture(); Object.defineProperty(f, 'userId', { enumerable: true, get() { invoked++; return UID; } });
  refuse(() => mapearSnapshot60(f, UID)); assert.equal(invoked, 0);
  const s: any = fixture(); delete s.items[0]; refuse(() => mapearSnapshot60(s, UID));
  const cyc: any = fixture(); cyc.extra = cyc; refuse(() => mapearSnapshot60(cyc, UID));
  const proto: any = fixture(); Object.setPrototypeOf(proto, { foo: 1 }); refuse(() => mapearSnapshot60(proto, UID));
});
test('config own alias e ausência preservam regra corrente', () => {
  const f: any = fixture(); f.configuracoes = [{ user_id: UID, chave: 'jurosMultaAutomatico', valor: 'true' }, { user_id: UID, chave: 'multaDiaria', valor: '0.5' }];
  mapearSnapshot60(f, UID);
  f.configuracoes.push(f.configuracoes[0]); refuse(() => mapearSnapshot60(f, UID));
  f.configuracoes = [{ user_id: 99, chave: 'multaDiaria', valor: '0.5' }]; refuse(() => mapearSnapshot60(f, UID));
});
test('paga conserva recebimento real, não dívida atual', () => {
  const f: any = fixture(), item = f.items[0], p = item.parcelas[0], proof = item.estado51.parcelas[0];
  p.status = 'paga'; p.valor_pago = '110.00'; p.data_pagamento = DATE;
  proof.statusFinanceiroOriginal = 'paga'; proof.statusObrigacao = 'paga'; proof.obrigacaoAtual = '0.00'; item.estado51.statusObrigacao = 'quitado';
  const r = mapearSnapshot60(f, UID); assert.deepEqual(r.totals.values, { capital: 100, totalReceber: 0, totalPago: 110 });
});
test('partial residual não soma original novamente', () => {
  const f: any = fixture(), item = f.items[0], p = item.parcelas[0], proof = item.estado51.parcelas[0];
  p.status = 'parcial'; p.valor_pago = '20.00'; p.saldo_residual = '90.00'; p.data_pagamento = DATE;
  proof.statusFinanceiroOriginal = 'parcial'; proof.obrigacaoAtual = '90.00';
  const r = mapearSnapshot60(f, UID); assert.equal(r.totals.values!.totalReceber, 90); assert.equal(r.totals.values!.totalPago, 20);
});
test('cancelamento não é pagamento; arquivo é atributo independente', () => {
  const f: any = fixture(), item = f.items[0], proof = item.estado51.parcelas[0];
  proof.statusObrigacao = 'cancelada'; proof.obrigacaoAtual = '0.00'; item.estado51.statusObrigacao = 'encerrado_por_cancelamento';
  const r = mapearSnapshot60(f, UID); assert.equal(r.totals.values!.totalPago, 0); assert.equal(r.totals.values!.totalReceber, 0);
  const a: any = fixture(); a.items[0].estado51.arquivado = true; a.items[0].estado51.parcelas[0].arquivada = true;
  const result = mapearSnapshot60(a, UID); assert.equal((result.items[0] as any).statusObrigacao, 'ativo'); assert.equal((result.items[0] as any).arquivado, true); assert.equal(result.totals.values!.totalReceber, 0);
});
test('A não é somada novamente ao principal ou obrigação', () => {
  const f: any = fixture(); f.items[0].estado51.obrigacaoAdicional = '110.00'; f.items[0].estado51.parcelas[0].componenteAdicional = '110.00';
  const r = mapearSnapshot60(f, UID); assert.equal(r.totals.values!.capital, 100); assert.equal(r.totals.values!.totalReceber, 110);
  f.items[0].estado51.obrigacaoAdicional = '120.00'; refuse(() => mapearSnapshot60(f, UID));
});
test('multas36 coverage e data/hash/conta strict', () => {
  const q = { elegivel: true, contratoId: CID, parcelaId: PID, contaCaixaId: 7, totalExigido: '120.00', multa: '10.00', mora: '0.00', jurosEmbutidos: '10.00', valorPagoAcumulado: '0.00', dataPagamento: DATE, vencimento: '2027-01-10', status: 'pendente', estadoHash: 'a'.repeat(64), regra: 'recebimento_multa36_brt_v1' };
  const f: any = fixture(); f.items[0].cotacoes36 = [q]; assert.equal(mapearSnapshot60(f, UID).totals.values!.totalReceber, 120);
  f.items[0].cotacoes36 = []; refuse(() => mapearSnapshot60(f, UID));
  f.items[0].cotacoes36 = [{ ...q, dataPagamento: '2026-11-28' }]; refuse(() => mapearSnapshot60(f, UID));
  f.items[0].cotacoes36 = [{ ...q, parcelaId: 99 }]; refuse(() => mapearSnapshot60(f, UID));
});
test('money inválido e estado contraditório não são zero nem recusa local', () => {
  for (const amount of ['NaN', '1.001', '-1.00', 110, null]) { const f: any = fixture(); f.items[0].contrato.valor_principal = amount; refuse(() => mapearSnapshot60(f, UID)); }
  const f: any = fixture(); f.items[0].estado51.statusObrigacao = 'quitado'; refuse(() => mapearSnapshot60(f, UID));
});
test('carteira >1000 não cai no budget JSON de2048 nós', () => {
  const f: any = fixture(); f.items = Array.from({ length: 1001 }, (_, i) => { const item: any = structuredClone(fixture().items[0]); const cid = i + 1, pid = i + 10001; item.id = item.contrato.id = item.estado51.contratoId = cid; item.parcelas[0].contrato_id = cid; item.parcelas[0].id = item.estado51.parcelas[0].parcelaId = pid; return item; });
  assert.equal(mapearSnapshot60(f, UID).items.length, 1001);
});

test('serviço somente1RPC sem from/fanout/retry e com owner da sessão', async () => {
  const rpc = vi.fn(async () => ({ data: fixture(), error: null, status: 200, count: null, statusText: 'OK' }));
  const from = vi.fn(() => { throw new Error('REST proibido'); });
  const result = await listarEmprestimosSnapshot60({ rpc, from }, UID);
  expect(result.version).toBe('loan_list_read_v1');
  expect(rpc.mock.calls).toEqual([[RPC60, { p_user_id: UID }]]);
  expect(from).not.toHaveBeenCalled();
});

test('erros SDK/network/envelope fatais sem retry/placeholder', async () => {
  for (const response of [{ data: null, error: { code: '57014' }, status: 500 }, { data: fixture(), error: null, status: 503 }, { data: fixture(), error: null, success: false }, { data: null, error: null, status: 200 }, { data: fixture() }]) {
    const rpc = vi.fn(async () => response);
    await expect(listarEmprestimosSnapshot60({ rpc }, UID)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(rpc).toHaveBeenCalledTimes(1);
  }
  await expect(listarEmprestimosSnapshot60({ rpc: async () => { throw new Error('offline'); } }, UID)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
});

test('owner inválido recusa antes da única RPC, backend ausente não vira vazio', async () => {
  const rpc = vi.fn();
  for (const owner of [0, -1, 1.5, 2147483648, '41', null, undefined]) {
    await expect(listarEmprestimosSnapshot60({ rpc }, owner)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  }
  expect(rpc).not.toHaveBeenCalled();
  await expect(listarEmprestimosSnapshot60(null, UID)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
});
