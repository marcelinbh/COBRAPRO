import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PostgrestClient } = require(require.resolve('@supabase/postgrest-js', { paths: [require.resolve('@supabase/supabase-js')] }));
const m = vi.hoisted(() => ({ client: vi.fn(), db: vi.fn(), compare: vi.fn(), sign: vi.fn(), log: vi.fn(), env: { enableSessionRevocation: true, appId: 'synthetic-app' } }));
vi.mock('./db', () => ({ getDb: m.db, getSupabaseClientAsync: m.client }));
vi.mock('./_core/env', () => ({ ENV: m.env }));
vi.mock('./_core/sdk', () => ({ sdk: { signSession: m.sign } }));
vi.mock('./loginLogger', () => ({ registrarLoginLog: m.log }));
vi.mock('./_core/email', () => ({ enviarEmail: vi.fn() }));
vi.mock('./storage', () => ({ storagePut: vi.fn() }));
vi.mock('bcryptjs', () => ({ default: { compare: m.compare, hash: vi.fn() } }));
import { registerAuthRoutes } from './authRoutes';
const unavailable = { error: 'Login temporariamente indisponível. Tente novamente.' };
const row = () => ({ id: 8, openId: 'local_synthetic', name: 'Synthetic', email: 'synthetic@example.test', role: 'admin', passwordHash: 'synthetic-hash', session_version: 4 });
function deferred<T>() { let resolve!: (v: T) => void, reject!: (e: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
function harness() {
  const read = vi.fn().mockResolvedValue({ data: row(), error: null });
  const write = vi.fn().mockResolvedValue({ error: null });
  const signals: { read?: AbortSignal; write?: AbortSignal } = {};
  const select = vi.fn(() => { const chain: any = { eq: () => chain, limit: () => chain, abortSignal: (s: AbortSignal) => { signals.read = s; return chain; }, maybeSingle: () => { const result = read(); const terminal: any = { abortSignal: (s: AbortSignal) => { signals.read = s; return terminal; }, then: (a: any, b: any) => Promise.resolve(result).then(a, b) }; return terminal; } }; return chain; });
  const update = vi.fn(() => { const chain: any = { eq: () => chain, abortSignal: (s: AbortSignal) => { signals.write = s; return chain; }, then: (a: any, b: any) => Promise.resolve(write()).then(a, b) }; return chain; });
  const from = vi.fn(() => ({ select, update })); m.client.mockResolvedValue({ from });
  const app = { post: vi.fn() }; registerAuthRoutes(app as any);
  const handlers = (path = '/api/auth/login') => app.post.mock.calls.find(c => c[0] === path)!.slice(1);
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), cookie: vi.fn(), setHeader: vi.fn() };
  const req = { body: { email: 'synthetic@example.test', password: 'synthetic-password' }, protocol: 'https', headers: {}, header: () => undefined, socket: { remoteAddress: randomUUID() } };
  const start = (path?: string, r = req) => handlers(path).at(-1)!(r, res);
  return { read, write, signals, select, update, from, res, req, start, handlers };
}
function noSession(h: ReturnType<typeof harness>) { expect(m.compare).not.toHaveBeenCalled(); expect(m.sign).not.toHaveBeenCalled(); expect(h.res.cookie).not.toHaveBeenCalled(); expect(h.update).not.toHaveBeenCalled(); }
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); m.db.mockResolvedValue(null); m.compare.mockResolvedValue(true); m.sign.mockResolvedValue('synthetic-jwt'); m.log.mockResolvedValue(undefined); m.env.enableSessionRevocation = true; vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('login read resilience and security', () => {
  it('hung REST read returns generic 503 by 8 seconds and aborts transport', async () => {
    const h = harness(); h.read.mockReturnValue(new Promise(() => {})); const work = h.start(); await flush(); await vi.advanceTimersByTimeAsync(8000); await flush();
    expect(h.res.status).toHaveBeenCalledWith(503); expect(h.res.json).toHaveBeenCalledWith(unavailable); expect(h.signals.read?.aborted).toBe(true); noSession(h); await work; expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['returned error', 'rejected transport', 'missing client'])('%s is 503, never wrong-password 401', async mode => {
    const h = harness(); if (mode === 'returned error') h.read.mockResolvedValue({ data: null, error: { message: 'private transport diagnostic' } });
    if (mode === 'rejected transport') h.read.mockRejectedValue(new Error('private transport diagnostic'));
    if (mode === 'missing client') m.client.mockResolvedValue(null);
    await h.start(); expect(h.res.status).toHaveBeenCalledWith(503); expect(h.res.json).toHaveBeenCalledWith(unavailable); noSession(h); expect(vi.getTimerCount()).toBe(0);
  });
  it('slow client initialization is bounded and cannot start a read after expiry', async () => {
    const h = harness(); const d = deferred<any>(); m.client.mockReturnValue(d.promise); const work = h.start(); await flush(); await vi.advanceTimersByTimeAsync(8000);
    expect(h.res.status).toHaveBeenCalledWith(503); noSession(h); d.resolve({ from: h.from }); await flush(); expect(h.from).not.toHaveBeenCalled(); await work;
  });
  it('a late read cannot authenticate after a deadline response', async () => {
    const h = harness(); const d = deferred<any>(); h.read.mockReturnValue(d.promise); const work = h.start(); await flush(); await vi.advanceTimersByTimeAsync(8000);
    expect(h.res.status).toHaveBeenCalledWith(503); d.resolve({ data: row(), error: null }); await flush(); noSession(h); expect(h.res.json).toHaveBeenCalledTimes(1); await work;
  });
  it('successful empty read is still 401', async () => { const h = harness(); h.read.mockResolvedValue({ data: null, error: null }); await h.start(); expect(h.res.status).toHaveBeenCalledWith(401); noSession(h); });
  it('wrong password is still 401 and never signs or writes', async () => { const h = harness(); m.compare.mockResolvedValue(false); await h.start(); expect(h.res.status).toHaveBeenCalledWith(401); expect(m.compare).toHaveBeenCalledWith('synthetic-password', 'synthetic-hash'); expect(m.sign).not.toHaveBeenCalled(); expect(h.update).not.toHaveBeenCalled(); });
  it.each([undefined, null, '4', -1, 1.5])('invalid session version %s remains fail-closed 500', async version => { const h = harness(); h.read.mockResolvedValue({ data: { ...row(), session_version: version }, error: null }); await h.start(); expect(h.res.status).toHaveBeenCalledWith(500); noSession(h); });
  it('bcrypt and signed session use the same read snapshot and retain role/cookie controls', async () => { const h = harness(); const user = row(); h.read.mockResolvedValue({ data: user, error: null }); m.compare.mockImplementation(async () => { user.session_version = 5; return true; }); await h.start(); expect(h.read).toHaveBeenCalledTimes(1); expect(m.sign).toHaveBeenCalledWith({ openId: 'local_synthetic', appId: 'synthetic-app', name: 'Synthetic', sessionVersion: 4 }, expect.anything()); expect(h.res.cookie).toHaveBeenCalledWith(expect.any(String), 'synthetic-jwt', expect.objectContaining({ secure: true, httpOnly: true, sameSite: 'lax', path: '/' })); expect(h.res.json).toHaveBeenCalledWith({ success: true, user: { id: 8, name: 'Synthetic', email: 'synthetic@example.test', role: 'admin' } }); });
  it('revocation flag off preserves unversioned signing', async () => { const h = harness(); m.env.enableSessionRevocation = false; await h.start(); expect(m.sign.mock.calls[0][0]).not.toHaveProperty('sessionVersion'); });
  it('origin guard rejects before reading', async () => { const h = harness(); const next = vi.fn(); h.handlers()[0]({ ...h.req, headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' } }, h.res, next); expect(h.res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled(); expect(h.read).not.toHaveBeenCalled(); });
  it('rate limit remains 8 attempts then 429 before read', async () => { const h = harness(); m.compare.mockResolvedValue(false); for (let i = 0; i < 9; i++) await h.start(); expect(h.read).toHaveBeenCalledTimes(8); expect(h.res.status).toHaveBeenLastCalledWith(429); expect(h.res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String)); });
  it('forgot-password transport failure retains original generic success, no login deadline', async () => { const h = harness(); h.read.mockResolvedValue({ data: null, error: { message: 'synthetic unavailable' } }); await h.start('/api/auth/forgot-password'); expect(h.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true })); expect(h.res.status).not.toHaveBeenCalled(); expect(h.signals.read).toBeUndefined(); });
});
describe('noncritical lastSignedIn', () => {
  it('hung write cannot delay response and its single attempt is aborted at 2 seconds', async () => {
    const h = harness(); h.write.mockReturnValue(new Promise(() => {})); const work = h.start(); await flush();
    expect(h.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true })); expect(h.res.cookie).toHaveBeenCalledTimes(1); await work; await flush(); expect(h.write).toHaveBeenCalledTimes(1); expect(h.signals.write?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2000); expect(h.signals.write?.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0); expect(h.write).toHaveBeenCalledTimes(1);
  });
  it('late write client initialization cannot start detached update', async () => {
    const h = harness(); const d = deferred<any>(); m.client.mockResolvedValueOnce({ from: h.from }).mockReturnValueOnce(d.promise); const work = h.start(); await flush();
    expect(h.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true })); await work; await vi.advanceTimersByTimeAsync(2000); d.resolve({ from: h.from }); await flush(); expect(h.update).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['returned error', 'rejection'])('write %s is swallowed without changing successful response', async mode => { const h = harness(); mode === 'rejection' ? h.write.mockRejectedValue(new Error('synthetic write error')) : h.write.mockResolvedValue({ error: { message: 'synthetic write error' } }); await h.start(); await flush(); expect(h.res.json).toHaveBeenCalledTimes(1); expect(h.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true })); expect(h.res.status).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0); });
});

describe('pinned real PostgREST builder with offline fetch only', () => {
  it('actual read abort settles fetch and creates no retry/timer work', async () => {
    const h = harness(); let active = 0; let signal: AbortSignal | undefined;
    const fakeFetch = vi.fn((_url: string, init: any) => new Promise((_resolve, reject) => {
      active++; signal = init.signal;
      signal?.addEventListener('abort', () => { active--; reject(new DOMException('Synthetic abort', 'AbortError')); }, { once: true });
    }));
    m.client.mockResolvedValue(new PostgrestClient('https://offline.invalid/rest/v1', { fetch: fakeFetch }));
    const work = h.start(); await flush(); expect(active).toBe(1); await vi.advanceTimersByTimeAsync(8000); await flush();
    expect(h.res.status).toHaveBeenCalledWith(503); expect(signal?.aborted).toBe(true); expect(active).toBe(0); expect(fakeFetch).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0); noSession(h); await work;
  });
  it('actual HTTP500 PostgREST response is 503, not invalid credentials', async () => {
    const h = harness(); const fakeFetch = vi.fn(async () => new Response(JSON.stringify({ message: 'synthetic transport error' }), { status: 500 }));
    m.client.mockResolvedValue(new PostgrestClient('https://offline.invalid/rest/v1', { fetch: fakeFetch }));
    await h.start(); expect(h.res.status).toHaveBeenCalledWith(503); expect(h.res.json).toHaveBeenCalledWith(unavailable); noSession(h);
  });
  it('actual successful empty array is mapped by maybeSingle to true absence 401', async () => {
    const h = harness(); const fakeFetch = vi.fn(async () => new Response('[]', { status: 200 }));
    m.client.mockResolvedValue(new PostgrestClient('https://offline.invalid/rest/v1', { fetch: fakeFetch }));
    await h.start(); expect(h.res.status).toHaveBeenCalledWith(401); noSession(h); expect(fakeFetch).toHaveBeenCalledTimes(1);
  });
  it('actual PATCH abort settles one background attempt without delaying authenticated response', async () => {
    const h = harness(); let active = 0; let signal: AbortSignal | undefined;
    const fakeFetch = vi.fn((_url: string, init: any) => {
      if (init.method === 'GET') return Promise.resolve(new Response(JSON.stringify([row()]), { status: 200 }));
      expect(init.method).toBe('PATCH'); expect(Object.keys(JSON.parse(init.body))).toEqual(['lastSignedIn']);
      return new Promise((_resolve, reject) => { active++; signal = init.signal; signal?.addEventListener('abort', () => { active--; reject(new DOMException('Synthetic abort', 'AbortError')); }, { once: true }); });
    });
    m.client.mockResolvedValue(new PostgrestClient('https://offline.invalid/rest/v1', { fetch: fakeFetch }));
    const work = h.start(); await flush(); expect(h.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true })); await work; await flush(); expect(active).toBe(1);
    await vi.advanceTimersByTimeAsync(2000); await flush(); expect(signal?.aborted).toBe(true); expect(active).toBe(0); expect(fakeFetch.mock.calls.filter(c => c[1].method === 'PATCH')).toHaveLength(1); expect(vi.getTimerCount()).toBe(0);
  });
});
