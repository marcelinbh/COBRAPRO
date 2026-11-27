import { describe, expect, it, vi } from 'vitest';
import * as protocol from '../../../shared/manutencaoFinanceira48';
import * as coordination53 from '../../../shared/financialCoordination53';
import { code, compile, declaration, deferred, Hooks, source } from '../lib/r1BoundaryHarness';

const userId = 31, contratoId = 462, scope = 'a'.repeat(64);
const intent = { ownerId: userId, sessionScope: scope, contratoId, idempotencyKey: '00000000-0000-4000-8000-000000000048', estadoHash: 'b'.repeat(64), alteracao: { acao: 'juros' as const, taxaJuros: '20.0000' }, motivo: 'fixture local confinada' };
const { ownerId, sessionScope, ...unscoped } = intent;
const confirmed = { status: 'confirmed' as const, sameIntentOnly: true as const, resultado: { ...unscoped, success: true as const, repetida: false, operationId: '00000000-0000-4000-8000-000000000049', regra: 'manutencao25_obrigacao_v1' as const, totalContrato: '120.00', jurosTotal: '20.00', obrigacaoCancelada: '0.00' } };
const fenced = { ...unscoped, status: 'fenced' as const, regra: 'manutencao48_fence_v1' as const };
const key = `cobrapro:manutencao48:${userId}:${scope}:${contratoId}`;
const archiveKey = `${key}:closed:${intent.idempotencyKey}`;
function setup(result: any = confirmed) {
  const hooks = new Hooks(), map = new Map<string, string>([[key, JSON.stringify(intent)]]), events: string[] = [];
  let failure = '', gate: ReturnType<typeof deferred> | undefined;
  const storage = {
    getItem: vi.fn((k: string) => { events.push(`read:${k}`); if (failure === 'readback' && k === archiveKey && map.has(k)) return 'wrong'; return map.get(k) ?? null; }),
    setItem: vi.fn((k: string, v: string) => { events.push(`write:${k}`); if (failure === 'write') throw Error('quota fixture'); map.set(k, v); if (failure === 'mid-cas' && k === archiveKey) map.set(key, 'journal mudou durante arquivo'); }),
    removeItem: vi.fn((k: string) => { events.push(`remove:${k}`); if (failure !== 'remove') map.delete(k); }),
  };
  const execute = vi.fn().mockResolvedValue(result), recover = vi.fn().mockResolvedValue(result), callback = vi.fn(() => {
    events.push('callback'); expect(storage.getItem(key)).toBeNull(); expect(JSON.parse(storage.getItem(archiveKey)!)).toEqual({ intent, closure: confirmed });
  });
  const lock = vi.fn(async (_key: string, fn: () => any) => { if (gate) await gate.promise; const r = await fn(); events.push('lock-released'); return r; });
  const trpc = { manutencaoFinanceira48: { cotar: { useQuery: () => ({ data: undefined, isFetching: false, isError: false }) }, executar: { useMutation: () => ({ mutateAsync: execute, isPending: false }) }, conferir: { useMutation: () => ({ mutateAsync: recover, isPending: false }) } } };
  const ast = source('components/ManutencaoJuros48.tsx'), fn = declaration(ast, 'JurosSessao48');
  const ret = fn.body!.statements.at(-1)!;
  // Only the terminal JSX return is instrumented; all handlers/effects are the real source.
  const instrumented = code(ast, 'JurosSessao48').replace(ret.getText(ast), 'return {send,close};');
  const component = compile(`${instrumented}\nreturn JurosSessao48;`, { ...hooks.bindings(), ...protocol, ...coordination53, trpc, navigator: { locks: { request: lock } }, localStorage: storage, crypto: { randomUUID: () => { throw Error('No new UUID allowed'); } } });
  const render = () => hooks.render(component, { contratoId, parcelasIds: [900], userId, scope, onSuccess: callback });
  render(); hooks.flush();
  return { hooks, map, storage, events, execute, recover, callback, lock, render, fail: (f: string) => { failure = f; }, wait: () => { gate = deferred(); return gate; } };
}

describe('R1 close48 — real handlers / real local archive protocol / zero RPC', () => {
  it.each([false, true])('terminal confirmada por conferir=%s não chama callback antes de close e journal removido', async check => {
    const h = setup(); await h.render().send(check);
    expect(h.callback).not.toHaveBeenCalled(); expect(h.map.has(key)).toBe(true); expect(h.map.has(archiveKey)).toBe(false);
    await h.render().close();
    expect(h.callback).toHaveBeenCalledTimes(1); expect(h.map.has(key)).toBe(false);
    const write = h.events.indexOf(`write:${archiveKey}`), remove = h.events.indexOf(`remove:${key}`), callback = h.events.indexOf('callback');
    expect(write).toBeGreaterThan(-1); expect(remove).toBeGreaterThan(write); expect(callback).toBeGreaterThan(remove);
    expect(h.events.slice(write + 1, remove)).toContain(`read:${archiveKey}`);
    expect(h.events.slice(remove + 1, callback)).toContain(`read:${key}`);
    expect(h.events.slice(remove + 1, callback)).toContain('lock-released');
  });
  it('fence arquiva sem chamar onSuccess', async () => {
    const h = setup(fenced); await h.render().send(true); await h.render().close();
    expect(h.callback).not.toHaveBeenCalled(); expect(h.map.has(key)).toBe(false); expect(JSON.parse(h.map.get(archiveKey)!).closure).toEqual(fenced);
  });
  it.each(['write', 'readback', 'remove', 'cas', 'mid-cas', 'archive-conflict'])('arquivo falha %s: não há callback nem descarte de pendência', async failure => {
    const h = setup(); await h.render().send(true);
    if (failure === 'cas') h.map.set(key, 'journal de outra aba');
    else if (failure === 'archive-conflict') h.map.set(archiveKey, 'arquivo conflitante');
    else h.fail(failure);
    await h.render().close();
    expect(h.callback).not.toHaveBeenCalled(); expect(h.map.has(key)).toBe(true);
    expect(h.execute).not.toHaveBeenCalled(); expect(h.recover).toHaveBeenCalledTimes(1);
  });
  it('close aguarda lock: unmount antes de aquisição preserva journal e suprime callback', async () => {
    const h = setup(); await h.render().send(true); const gate = h.wait();
    const closing = h.render().close(); h.hooks.unmount(); gate.resolve(undefined); await closing;
    expect(h.callback).not.toHaveBeenCalled(); expect(h.map.has(key)).toBe(true); expect(h.map.has(archiveKey)).toBe(false);
  });
  it('resposta de recovery após unmount não cria proof, não arquiva e não chama callback', async () => {
    const h = setup(), late = deferred(); h.recover.mockReturnValueOnce(late.promise);
    const sending = h.render().send(true); h.hooks.unmount(); late.resolve(confirmed); await sending; await h.render().close();
    expect(h.callback).not.toHaveBeenCalled(); expect(h.map.has(key)).toBe(true);
  });
  it('onSuccess rejeita depois do arquivo: pendência não é restaurada nem writer reexecutado', async () => {
    const h = setup(); h.callback.mockImplementationOnce(async () => { throw Error('refetch fixture'); });
    await h.render().send(false); const terminalHandlers = h.render(); await terminalHandlers.close();
    // Also exercise the stale closure double-click: disk.current=null prevents repeat callback.
    await terminalHandlers.close(); await h.render().close();
    expect(h.callback).toHaveBeenCalledTimes(1); expect(h.map.has(key)).toBe(false); expect(h.map.has(archiveKey)).toBe(true);
    expect(h.execute).toHaveBeenCalledTimes(1); expect(h.recover).not.toHaveBeenCalled();
  });
  it('close sem proof terminal é inerte', async () => {
    const h = setup(); await h.render().close(); expect(h.callback).not.toHaveBeenCalled(); expect(h.storage.removeItem).not.toHaveBeenCalled();
  });
});
