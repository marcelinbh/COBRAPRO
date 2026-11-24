import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
const m = vi.hoisted(() => ({ current: null as any, success: vi.fn(), error: vi.fn(), navigate: vi.fn() }));
vi.mock('react', async actual => ({ ...await actual<typeof React>(),
  useState: (initial: any) => { const r = m.current; const i = r.cursor++; if (!(i in r.values)) r.values[i] = initial; return [r.values[i], (value: any) => { r.values[i] = typeof value === 'function' ? value(r.values[i]) : value; }]; },
  useEffect: () => {},
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('wouter', () => ({ useLocation: () => ['/login', m.navigate] }));
vi.mock('@/_core/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, loading: false }) }));
vi.mock('@/components/ui/button', () => ({ Button: 'button' }));
vi.mock('@/components/ui/input', () => ({ Input: 'input' }));
vi.mock('@/components/ui/label', () => ({ Label: 'label' }));
vi.mock('sonner', () => ({ toast: { success: m.success, error: m.error } }));
import Login from './Login';
const unavailable = 'Login temporariamente indisponível. Tente novamente.';
const good = { success: true, user: { id: 8, name: 'Synthetic', email: 'synthetic@example.test', role: 'admin' } };
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(a => { resolve = a; }); return { promise, resolve }; }
async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
class MemoryLogin {
  values: any[] = []; cursor = 0; tree: any;
  render() { this.cursor = 0; m.current = this; this.tree = Login(); return this; }
  nodes(type: string) { const nodes: any[] = []; const walk = (n: any) => { if (!n) return; if (Array.isArray(n)) return n.forEach(walk); if (typeof n !== 'object') return; if (n.type === type) nodes.push(n); walk(n.props?.children); }; walk(this.tree); return nodes; }
  button() { return this.nodes('button').find(n => n.props.type === 'submit'); }
  start() { const result = this.nodes('form')[0].props.onSubmit({ preventDefault() {} }); this.render(); return result; }
}
let network: ReturnType<typeof vi.fn>;
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); network = vi.fn(); vi.stubGlobal('React', React); vi.stubGlobal('fetch', network); vi.stubGlobal('window', { location: { href: '/login' } }); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function noRedirect() { expect(m.success).not.toHaveBeenCalled(); expect(window.location.href).toBe('/login'); expect(m.navigate).not.toHaveBeenCalled(); }
describe('actual Login component bounded submit', () => {
  it('hung fetch releases busy UI by 15 seconds, aborts and reports retryable unavailable', async () => {
    network.mockReturnValue(new Promise(() => {})); const ui = new MemoryLogin().render(); const work = ui.start(); expect(ui.button().props.disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(15000); await flush(); ui.render(); expect(ui.button().props.disabled).toBe(false); expect(m.error).toHaveBeenCalledWith(unavailable); expect(network.mock.calls[0][1].signal.aborted).toBe(true); noRedirect(); await work; expect(vi.getTimerCount()).toBe(0);
  });
  it('hung response JSON has same overall deadline and releases busy UI', async () => {
    network.mockResolvedValue({ ok: true, status: 200, json: () => new Promise(() => {}) }); const ui = new MemoryLogin().render(); const work = ui.start(); await flush(); await vi.advanceTimersByTimeAsync(15000); ui.render();
    expect(ui.button().props.disabled).toBe(false); expect(m.error).toHaveBeenCalledWith(unavailable); expect(network.mock.calls[0][1].signal.aborted).toBe(true); noRedirect(); await work;
  });
  it('headers at 14 seconds do not reset body deadline', async () => {
    const d = deferred<any>(); network.mockReturnValue(d.promise); const ui = new MemoryLogin().render(); const work = ui.start(); await vi.advanceTimersByTimeAsync(14000); d.resolve({ ok: true, status: 200, json: () => new Promise(() => {}) }); await flush(); await vi.advanceTimersByTimeAsync(1000); ui.render(); expect(ui.button().props.disabled).toBe(false); noRedirect(); await work;
  });
  it('late body success after timeout cannot toast success or redirect', async () => {
    const d = deferred<any>(); network.mockResolvedValue({ ok: true, status: 200, json: () => d.promise }); const ui = new MemoryLogin().render(); const work = ui.start(); await flush(); await vi.advanceTimersByTimeAsync(15000); ui.render(); expect(ui.button().props.disabled).toBe(false);
    d.resolve(good); await flush(); noRedirect(); expect(m.error).toHaveBeenCalledTimes(1); await work;
  });
  it.each([null, {}, [], { success: false }, { success: true }, { success: 'true', user: good.user }, { success: true, user: { ...good.user, id: '8' } }, { success: true, user: { ...good.user, id: 0 } }, { success: true, user: { ...good.user, role: 'owner' } }, { success: true, user: { ...good.user, email: null } }])('unknown/bad HTTP200 payload %j never redirects', async payload => {
    network.mockResolvedValue({ ok: true, status: 200, json: async () => payload }); const ui = new MemoryLogin().render(); await ui.start(); ui.render(); noRedirect(); expect(m.error).toHaveBeenCalledWith(unavailable); expect(ui.button().props.disabled).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['network reject', 'bad JSON', 'HTTP503', 'HTTP500', 'empty HTTP401'])('%s is retryable unavailable, never success', async mode => {
    if (mode === 'network reject') network.mockRejectedValue(new Error('synthetic network'));
    else if (mode === 'bad JSON') network.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('synthetic JSON'); } });
    else network.mockResolvedValue({ ok: false, status: mode === 'HTTP503' ? 503 : mode === 'HTTP500' ? 500 : 401, json: async () => ({}) });
    const ui = new MemoryLogin().render(); await ui.start(); ui.render(); noRedirect(); expect(m.error).toHaveBeenCalledWith(unavailable); expect(ui.button().props.disabled).toBe(false);
  });
  it.each([401, 400, 403, 429])('known HTTP%s error remains its server message', async status => { network.mockResolvedValue({ ok: false, status, json: async () => ({ error: 'synthetic known error' }) }); const ui = new MemoryLogin().render(); await ui.start(); ui.render(); expect(m.error).toHaveBeenCalledWith('synthetic known error'); noRedirect(); expect(ui.button().props.disabled).toBe(false); });
  it('valid success alone redirects and keeps POST credentials include', async () => { network.mockResolvedValue({ ok: true, status: 200, json: async () => good }); const ui = new MemoryLogin().render(); ui.values[2] = { email: 'synthetic@example.test', password: 'synthetic-password' }; ui.render(); await ui.start(); ui.render(); expect(window.location.href).toBe('/dashboard'); expect(m.success).toHaveBeenCalledTimes(1); expect(m.error).not.toHaveBeenCalled(); expect(network).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'synthetic@example.test', password: 'synthetic-password' }) })); expect(vi.getTimerCount()).toBe(0); });
});
