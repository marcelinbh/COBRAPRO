import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DespesasRecorrencia68Journal } from './despesasRecorrencia68Journal';
const key = '10000000-0000-4000-8000-000000000001';
const request = { action: 'criar' as const, template: { descricao: 'Aluguel', categoria: 'aluguel' as const, valor: '100.01', observacoes: '' }, frequencia: 'mensal' as const, ancora: '2030-01-31', termino: null };
class Memory { m = new Map<string, string>();getItem(k: string) { return this.m.get(k) ?? null; }setItem(k: string, v: string) { this.m.set(k, v); }removeItem(k: string) { this.m.delete(k); } }
const locks = { request: async <T,>(_: string, fn: () => T | PromiseLike<T>) => fn() };
beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(crypto, 'randomUUID').mockReturnValue(key); });
describe('journal68 separate exact/fence/CAS/session', () => {
  it('valida antes deUUID; persistência obrigatória antes dePOST e sem limpar20/49', async () => {
    const s = new Memory();s.setItem('cobrapro:despesas49:7:pending', 'opaque49');const j = new DespesasRecorrencia68Journal(7, s, locks, () => true);
    await expect(j.prepare({ ...request, template: { ...request.template, valor: '0.00' } })).rejects.toThrow();expect(s.getItem(j.key)).toBeNull();
    const original = await j.prepare(request);expect(j.read()).toEqual(original);await expect(j.prepare(request)).rejects.toThrow('Original68');expect(s.getItem('cobrapro:despesas49:7:pending')).toBe('opaque49');
  });
  it('write-then-throw é descoberto porread sem novoUUID/POST', async () => {
    const s = new Memory();s.setItem = (k, v) => { s.m.set(k, v); throw Error('lost readback'); };const j = new DespesasRecorrencia68Journal(7, s, locks, () => true);
    await expect(j.prepare(request)).rejects.toThrow();expect(j.read()?.input.idempotencyKey).toBe(key);
  });
  it('recoveryterminal exige prova exacta; guarda receipt antes de removerCAS', async () => {
    const s = new Memory(), j = new DespesasRecorrencia68Journal(7, s, locks, () => true), original = await j.prepare(request);
    const proof = { contrato: 'despesas68_v1' as const, userId: 7, idempotencyKey: key, request, status: 'not_executed' as const, serieId: null, revision: null, effectiveOrdinal: null, fenceId: key, instante: '2026-11-27T12:00:00Z' };
    await expect(j.run(original, async () => j.closeInsideLock(original, { ...proof, userId: 8 }))).rejects.toThrow();expect(j.read()).not.toBeNull();
    expect(await j.run(original, async () => j.closeInsideLock(original, proof))).toBe(true);expect(j.read()).toBeNull();expect(s.getItem('cobrapro:despesas68:7:receipt:'+key)).toContain('not_executed');
  });
  it('ABA eCAS apósawait rejeitamclosure/efeitos mesmo ownerA novamente', async () => {
    const s = new Memory();let generation = 1;const j = new DespesasRecorrencia68Journal(7, s, locks, () => generation === 1), original = await j.prepare(request);
    generation = 3;await expect(j.run(original, async () => {})).rejects.toThrow('sessão');expect(s.getItem(j.key)).toBe(original.raw);
    generation = 1;await expect(j.run(original, async () => { s.setItem(j.key, original.raw+' '); j.assertCurrent(original); })).rejects.toThrow();
  });
  it('receipt terminal conhecido impede reenvio após reload comremoção silent', async () => {
    const s = new Memory(), j = new DespesasRecorrencia68Journal(7, s, locks, () => true), original = await j.prepare(request);
    const proof = { contrato: 'despesas68_v1' as const, userId: 7, idempotencyKey: key, request, status: 'not_executed' as const, serieId: null, revision: null, effectiveOrdinal: null, fenceId: key, instante: '2026-11-27T12:00:00Z' };
    s.removeItem = () => {};await expect(j.run(original, async () => j.closeInsideLock(original, proof))).rejects.toThrow('Remoção');
    const reload = new DespesasRecorrencia68Journal(7, s, locks, () => true);expect(reload.knownProof(reload.read()!)?.status).toBe('not_executed');
  });
  it('armazenamento/locks ausentes não fazem fallback, silentremove conserva receipt', async () => {
    await expect(new DespesasRecorrencia68Journal(7, null, locks, () => true).prepare(request)).rejects.toThrow();
    const s = new Memory(), j = new DespesasRecorrencia68Journal(7, s, undefined, () => true);await expect(j.prepare(request)).rejects.toThrow();
  });
});
