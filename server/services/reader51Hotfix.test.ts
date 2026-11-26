import { describe, expect, it } from 'vitest';
import { listarEmprestimosSeguros } from './emprestimosListaSegura';
import { lerProjecaoVinculada51 } from './obrigacoes51Leitura';
import { source51Test, projection51Test, contract51Test, parcel51Test } from './projection51TestSource';
const today = '2026-11-26';
const refusal = (code = '42501', message = '51 vínculos próprios completos obrigatórios; sem saneamento') => ({ data: null, error: { code, message, details: null, hint: null }, status: code === '42501' ? 403 : 400 });
function fixture(response: unknown = refusal()) {
  const f = source51Test();
  f.tables.contratos.push({ ...contract51Test, id: 25, cliente_id: 16, conta_caixa_id: null, valor_principal: '987654.32' });
  f.tables.clientes.push({ id: 16, user_id: 41, nome: 'NOME OWN NÃO CONFIRMADO', whatsapp: 'CONTATO NÃO CONFIRMADO' });
  f.tables.parcelas.push({ ...parcel51Test, id: 149, contrato_id: 25, cliente_id: 16, valor_original: '216.67', valor_pago: null, conta_caixa_id: null, status: 'atrasada' });
  const rpc = async (name: string, args: Record<string, unknown>): Promise<any> => {
    f.events.push(`RPC:${name}`); f.rpcCalls.push({ name, args });
    if (args.p_contrato_id === 25) { if (typeof response === 'function') return (response as Function)(); return response; }
    return { data: projection51Test(), error: null, status: 200 };
  };
  return { ...f, rpc };
}
const sensitive = (f: ReturnType<typeof fixture>) => f.calls.filter(c => /valor_principal|valor_original|nome|whatsapp/.test(c.fields));
describe('HOTFIX lista51: recusa comprovada por contrato não derruba carteira válida', () => {
  it.each([
    refusal(),
    refusal('23514', '51 valores registrados inválidos'),
    refusal('23514', '51 aliases/baixa registrada ambíguos'),
  ])('SQL recusa OWN estrita gera apenas placeholder, sem consultas sensíveis para ele', async response => {
    const f = fixture(response), r = await listarEmprestimosSeguros(f, 41, today);
    expect(r.items.map(i => i.kind)).toEqual(['validated', 'unavailable']);
    expect(r.items[1]).toEqual({ kind: 'unavailable', id: 25, message: 'Empréstimo indisponível: não foi possível confirmar seus vínculos.' });
    expect(r.coverage).toEqual({ scopedContracts: 2, validatedContracts: 1, unavailableContracts: 1, complete: false, label: 'validados somente' });
    expect(r.totals.values).toEqual({ capital: 100, totalReceber: 110, totalPago: 0 });
    expect(r.warning).toContain('não representam toda a carteira');
    expect(JSON.stringify(r)).not.toMatch(/987654|216\.67|NOME OWN|CONTATO|149|16/);
    expect(sensitive(f).every(c => !c.filters.some(([, v]) => Array.isArray(v) ? v.includes(25) || v.includes(16) || v.includes(149) : v === 16))).toBe(true);
    expect(f.rpcCalls.every(c => c.name === 'rpc_estado_obrigacoes51')).toBe(true);
  });
  it('todos recusados mantêm totals null, nunca saldo zero', async () => {
    const f = fixture(); f.tables.contratos.shift(); f.tables.parcelas.shift();
    const r = await listarEmprestimosSeguros(f, 41, today);
    expect(r.items.map(i => i.kind)).toEqual(['unavailable']); expect(r.totals.values).toBeNull(); expect(sensitive(f)).toEqual([]);
  });
  it.each([
    () => { throw new Error('offline'); },
    { data: null, error: { code: '55000', message: '51 metadata incompatível; nunca reseal runtime' }, status: 400 },
    { data: null, error: { code: 'PGRST202' }, status: 404 },
    { data: null, error: { code: '42501', message: 'permission denied' }, status: 403 },
    { ...refusal(), status: 503 }, { ...refusal(), success: true }, { ...refusal(), data: projection51Test() },
    { ...refusal(), error: { ...refusal().error, arbitrary: true } },
    Object.assign(Object.create({ injected: true }), refusal()),
    { data: { ...projection51Test(), userId: 99 }, error: null, status: 200 },
    { data: { ...projection51Test(), contratoId: 25 }, error: null, status: 200 },
  ])('transporte/catalogo/envelope/prova inválidos continuam erro global %#', async response => {
    await expect(listarEmprestimosSeguros(fixture(response), 41, today)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it('getter em erro RPC não executa e não vira placeholder', async () => {
    let accessed = false; const error = { ...refusal().error };
    Object.defineProperty(error, 'code', { enumerable: true, get() { accessed = true; return '42501'; } });
    await expect(listarEmprestimosSeguros(fixture({ ...refusal(), error }), 41, today)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(accessed).toBe(false);
  });
  it('endpoint estrito e cobrança continuam recusando exatamente o mesmo erro SQL', async () => {
    const f = fixture();
    await expect(lerProjecaoVinculada51(f, 41, 25, [{ id: 149, user_id: 41, contrato_id: 25, cliente_id: 16 }], async () => [{ id: 149, user_id: 41, contrato_id: 25, cliente_id: 16 }])).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it('metadados OWN antes/depois da recusa não são dispensados', async () => {
    const f = fixture(() => { f.tables.parcelas[1].user_id = 99; return refusal(); });
    await expect(listarEmprestimosSeguros(f, 41, today)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it('parcela foreign não chama RPC nem consulta valor/nome do contrato recusado', async () => {
    const f = fixture(); f.tables.parcelas[1].user_id = 99;
    const r = await listarEmprestimosSeguros(f, 41, today);
    expect(r.items[1].kind).toBe('unavailable'); expect(f.rpcCalls.some(c => c.args.p_contrato_id === 25)).toBe(false);
  });
  it.each(['network', 'differentRefusal', 'becomesValid'])('segunda prova %s após recusa local continua falha global', async kind => {
    let n = 0;
    const p = projection51Test(); p.contratoId = 25; p.parcelas[0].parcelaId = 149;
    const f = fixture(() => {
      if (++n === 1) return refusal();
      if (kind === 'network') throw new Error('timeout');
      return kind === 'differentRefusal' ? refusal('23514', '51 valores registrados inválidos') : { data: p, error: null, status: 200 };
    });
    await expect(listarEmprestimosSeguros(f, 41, today)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it('estado aprovado que vira recusa depois de valores não é placeholder tardio', async () => {
    let n = 0;
    const p = projection51Test(); p.contratoId = 25; p.parcelas[0].parcelaId = 149;
    const f = fixture(() => ++n <= 2 ? { data: p, error: null, status: 200 } : refusal());
    await expect(listarEmprestimosSeguros(f, 41, today)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
});
