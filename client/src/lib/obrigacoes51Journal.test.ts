import { describe, it, expect, vi } from 'vitest';
import { canonical51, toRequest51, type Intent51 } from '../../../shared/obrigacoes51';
import {
  chaveJournal51, chaveLock51, lerJournal51, operarJournal51, encerrarJournal51, pendenciasLegadas48, pendenciasOutrasSessoes51,
  moedaUi51, contasPropriasUi51, validarCotacaoUi51, validarEstadoUi51,
  type Storage51, type Locks51,
} from './obrigacoes51Journal';
const scope = { ownerId: 11, sessionScope: 'a'.repeat(64), contratoId: 12 };
const uuid = '11111111-1111-4111-8111-111111111111';
const intent: Intent51 = { ...scope, idempotencyKey: uuid, proposta: { acao: 'editar', parcelaId: 13, novoValor: '100.00', novaDataVencimento: '2026-12-15' }, estadoHash: 'b'.repeat(64), dataCalculo: '2026-11-26', motivo: 'Correção individual combinada' };
const closure = (input = intent, status: 'confirmed' | 'fenced' = 'confirmed'): any => ({
  status, versao: 'obrigacoes51_v1', sameIntentOnly: true, userId: input.ownerId,
  idempotencyKey: input.idempotencyKey, request: toRequest51(input),
  ...(status === 'confirmed' ? { resultado: { operationId: '22222222-2222-4222-8222-222222222222', contratoId: input.contratoId,
    acao: input.proposta.acao, idsAfetados: [13], valorRecebido: input.proposta.acao === 'quitar' ? input.proposta.valorRecebido : '0.00',
    contaDestinoId: input.proposta.acao === 'quitar' ? input.proposta.contaCaixaId : null, caixaPreservado: input.proposta.acao !== 'quitar' } } : {}),
});
function memory() {
  const data = new Map<string, string>(), log: string[] = [];
  const storage: Storage51 = { getItem: k => { log.push(`read:${k}`); return data.get(k) ?? null; },
    setItem: (k, v) => { log.push(`write:${k}`); data.set(k, v); }, removeItem: k => { log.push(`remove:${k}`); data.delete(k); },
    get length() { return data.size; }, key: n => [...data.keys()][n] ?? null };
  let held = '';
  const locks: Locks51 = { request: async (name, fn) => { expect(held).toBe(''); held = name; log.push(`lock:${name}`); try { return await fn(); } finally { held = ''; log.push('unlock'); } } };
  return { data, log, storage, locks, held: () => held };
}
function start(m: ReturnType<typeof memory>, post: (i: Intent51) => Promise<unknown>, patch: any = {}) {
  return operarJournal51({ storage: m.storage, locks: m.locks, scope, expected: null, atual: () => true,
    mode: 'novo', nova: intent, autorizarNovo: () => true, post, ...patch });
}
function quote(input: Intent51 = intent): any {
  return { versao: 'obrigacoes51_v1', userId: input.ownerId, contratoId: input.contratoId, proposta: input.proposta,
    estadoHash: input.estadoHash, dataCalculo: input.dataCalculo, origem: 'legado', totalAntes: '90.00', totalDepois: '100.00',
    obrigacaoAdicional: '0.00', valorExigido: input.proposta.acao === 'quitar' ? input.proposta.valorRecebido : '0.00',
    contaDestinoId: input.proposta.acao === 'quitar' ? input.proposta.contaCaixaId : null,
    caixaPreservado: input.proposta.acao !== 'quitar', idsAfetados: [13] };
}
describe('Journal exclusivo de obrigações — sem rede/SQL/browser', () => {
  it('mantém lock, CAS e readback antes do POST; arquiva prova antes de encerrar e callback', async () => {
    const m = memory(), key = chaveJournal51(scope), callback = vi.fn();
    const result = await start(m, async exact => {
      expect(m.held()).toBe(chaveLock51(scope)); expect(JSON.parse(m.data.get(key)!)).toEqual(exact);
      const write = m.log.lastIndexOf(`write:${key}`), read = m.log.lastIndexOf(`read:${key}`); expect(read).toBeGreaterThan(write);
      return closure(exact);
    });
    expect(result.pending).toEqual(intent); expect(result.terminal?.status).toBe('confirmed'); expect(callback).not.toHaveBeenCalled();
    const archiveKey = `${key}:closed:${uuid}`; expect(m.data.has(archiveKey)).toBe(true); expect(m.data.has(key)).toBe(true);
    const closed = await encerrarJournal51(m.storage, m.locks, scope, result.raw!, () => true);
    callback(); expect(closed.pending).toBeNull(); expect(closed.terminal?.status).toBe('confirmed');
    expect(m.log.indexOf(`write:${archiveKey}`)).toBeLessThan(m.log.indexOf(`remove:${key}`));
    expect(m.log.indexOf(`read:${archiveKey}`)).toBeLessThan(m.log.indexOf(`remove:${key}`)); expect(callback).toHaveBeenCalledOnce();
  });
  it.each(['timeout', 'NOT_FOUND', 'CONFLICT', 'BAD_REQUEST', 'PRECONDITION_FAILED'])('%s jamais apaga pending ou prova rollback', async error => {
    const m = memory(), post = vi.fn().mockRejectedValue(Error(error)); await expect(start(m, post)).rejects.toThrow(error);
    const restored = lerJournal51(m.storage, scope); expect(restored.pending).toEqual(intent); expect(restored.terminal).toBeNull();
    await expect(start(m, post)).rejects.toThrow(/Journal mudou|pendente/); expect(post).toHaveBeenCalledOnce();
  });
  it('reload/repetição/conferência enviam o mesmo request e UUID sem capacidade genérica', async () => {
    const m = memory(); await expect(start(m, async () => { throw Error('timeout'); })).rejects.toThrow();
    const loaded = lerJournal51(m.storage, scope), requests: Intent51[] = [];
    const options = { storage: m.storage, locks: m.locks, scope, expected: loaded.raw, atual: () => true,
      autorizarNovo: () => false, post: async (exact: Intent51) => { requests.push(exact); throw Error('incerto'); } };
    await expect(operarJournal51({ ...options, mode: 'repetir' })).rejects.toThrow('incerto');
    await expect(operarJournal51({ ...options, mode: 'conferir', post: async exact => { requests.push(exact); return closure(exact, 'fenced'); } })).resolves.toMatchObject({ terminal: { status: 'fenced' } });
    expect(requests).toEqual([intent, intent]); expect(requests.map(canonical51)).toEqual([canonical51(intent), canonical51(intent)]);
  });
  it.each([null, {}, { status: 'fenced' }, { ...closure(), userId: 99 }, { ...closure(), idempotencyKey: '33333333-3333-4333-8333-333333333333' },
    { ...closure(), request: { ...toRequest51(intent), motivo: 'Outro motivo' } }])('não encerra prova incompleta/outra intenção %j', async value => {
    const m = memory(); await expect(start(m, async () => value)).rejects.toThrow(); expect(lerJournal51(m.storage, scope).pending).toEqual(intent);
    expect(m.data.has(`${chaveJournal51(scope)}:closed:${uuid}`)).toBe(false);
  });
  it('readback da intenção falho impede qualquer POST', async () => {
    const m = memory(), post = vi.fn(), key = chaveJournal51(scope);
    m.storage.setItem = (k, v) => { m.data.set(k, k === key ? v + ' ' : v); };
    await expect(start(m, post)).rejects.toThrow(/Journal mudou/); expect(post).not.toHaveBeenCalled();
  });
  it('storage indisponível e Web Locks ausentes impedem POST', async () => {
    const m = memory(), post = vi.fn(); await expect(start(m, post, { locks: undefined })).rejects.toThrow('Web Locks');
    m.storage.setItem = () => { throw Error('Quota exceeded'); }; await expect(start(m, post)).rejects.toThrow('Quota exceeded'); expect(post).not.toHaveBeenCalled();
  });
  it('falha de arquivo/readback mantém pending e não autoriza callback nem novo financeiro', async () => {
    const m = memory(), key = chaveJournal51(scope);
    const set = m.storage.setItem; m.storage.setItem = (k, v) => { if (!k.includes(':closed:')) set(k, v); };
    await expect(start(m, async () => closure())).rejects.toThrow('Prova não persistiu'); expect(m.data.has(key)).toBe(true);
    expect(lerJournal51(m.storage, scope).terminal).toBeNull();
  });
  it('crash depois de prova arquivada: reload tem terminal e jamais repete POST', async () => {
    const m = memory(); await start(m, async () => closure()); const restored = lerJournal51(m.storage, scope), post = vi.fn();
    await operarJournal51({ storage: m.storage, locks: m.locks, scope, expected: restored.raw, atual: () => true, mode: 'repetir', post });
    expect(post).not.toHaveBeenCalled(); expect(restored.terminal?.status).toBe('confirmed');
  });
  it('CAS concorrente durante POST não arquiva e não sobrescreve outra intenção', async () => {
    const m = memory(), key = chaveJournal51(scope), changed = JSON.stringify({ ...intent, motivo: 'Pedido concorrente' });
    await expect(start(m, async () => { m.data.set(key, changed); return closure(); })).rejects.toThrow('Journal mudou');
    expect(m.data.get(key)).toBe(changed); expect(m.data.has(`${key}:closed:${uuid}`)).toBe(false);
  });
  it('mudança de geração A→B→A ignora resposta antiga apesar de owner/hash iguais', async () => {
    const m = memory(); let generation = 1;
    await expect(start(m, async () => { generation = 3; return closure(); }, { atual: () => generation === 1 })).rejects.toThrow('Sessão anterior');
    expect(lerJournal51(m.storage, scope).terminal).toBeNull(); expect(lerJournal51(m.storage, scope).pending).toEqual(intent);
  });
  it('mesmo contrato em outra empresa/sessão não adota intenção ou arquivo', async () => {
    const m = memory(); await start(m, async () => closure());
    expect(lerJournal51(m.storage, { ...scope, ownerId: 99 }).pending).toBeNull();
    expect(lerJournal51(m.storage, { ...scope, sessionScope: 'c'.repeat(64) }).pending).toBeNull();
    m.data.set(chaveJournal51({ ...scope, ownerId: 99 }), JSON.stringify(intent));
    expect(() => lerJournal51(m.storage, { ...scope, ownerId: 99 })).toThrow(/outra empresa/);
  });
  it('pending de sessão anterior impede UUID nova sem adotar/resetar request anterior', async () => {
    const m = memory(), prior = { ...scope, sessionScope: 'c'.repeat(64) }, old = { ...intent, sessionScope: prior.sessionScope };
    m.data.set(chaveJournal51(prior), JSON.stringify(old));
    expect(pendenciasOutrasSessoes51(m.storage, scope)).toEqual([chaveJournal51(prior)]);
    const post = vi.fn(); await expect(start(m, post)).rejects.toThrow(/sessão anterior/);
    expect(post).not.toHaveBeenCalled(); expect(lerJournal51(m.storage, scope).pending).toBeNull();
    expect(lerJournal51(m.storage, prior).pending).toEqual(old);
    expect(pendenciasOutrasSessoes51(m.storage, { ...scope, ownerId: 99 })).toEqual([]);
  });
  it('48 em scope anterior bloqueia somente se existe; não adota, apaga ou escreve journal46/47/48', async () => {
    const m = memory(), name = `cobrapro:manutencao48:${scope.ownerId}:${'c'.repeat(64)}:${scope.contratoId}`;
    expect(pendenciasLegadas48(m.storage, scope)).toEqual([]); m.data.set(name, 'pending48');
    const post = vi.fn(); expect(pendenciasLegadas48(m.storage, scope)).toEqual([name]); await expect(start(m, post)).rejects.toThrow(/manutenção anterior/);
    expect(m.data.get(name)).toBe('pending48'); expect(post).not.toHaveBeenCalled();
    expect(pendenciasLegadas48(m.storage, { ...scope, ownerId: 99 })).toEqual([]);
    m.data.delete(name); await start(m, async () => closure());
    expect(m.log.filter(s => s.startsWith('write:')).every(s => s.includes('obrigacoes51'))).toBe(true);
  });
  it('48 presente não impede recuperar pending51 exato pré-existente', async () => {
    const m = memory(); await expect(start(m, async () => { throw Error('timeout'); })).rejects.toThrow();
    m.data.set(`cobrapro:juros48:${scope.ownerId}:${'c'.repeat(64)}:${scope.contratoId}`, 'old');
    const loaded = lerJournal51(m.storage, scope);
    await expect(operarJournal51({ storage: m.storage, locks: m.locks, scope, expected: loaded.raw, atual: () => true, mode: 'conferir', post: async x => closure(x, 'fenced') })).resolves.toMatchObject({ terminal: { status: 'fenced' } });
  });
  it('fence estrito arquivado libera apenas após encerrar com gesto, sem execução presumida', async () => {
    const m = memory(); const loaded = await start(m, async x => closure(x, 'fenced'));
    expect(loaded.pending).toEqual(intent); expect(loaded.terminal?.status).toBe('fenced');
    await expect(encerrarJournal51(m.storage, m.locks, scope, loaded.raw!, () => true)).resolves.toMatchObject({ pending: null, terminal: { status: 'fenced' } });
  });
});
describe('validação estrita de preview, estado e conta escolhida', () => {
  it.each(['0', '-1', '1.001', '1e2', '01.00', '1,2,3'])('não arredonda/aceita moeda inválida %s', text => expect(() => moedaUi51(text)).toThrow());
  it('normaliza moeda sem float', () => { expect(moedaUi51('10,2')).toBe('10.20'); expect(moedaUi51('9999999999.99')).toBe('9999999999.99'); });
  it('quote vincula owner, contrato, proposta exata e dia/datahash; erro não é origem ausente', () => {
    expect(validarCotacaoUi51(quote(), scope, intent.proposta, '2026-11-26')).toMatchObject({ estadoHash: intent.estadoHash });
    for (const patch of [{ userId: 99 }, { contratoId: 99 }, { dataCalculo: '2026-11-25' }, { estadoHash: 'x' }, { proposta: { ...intent.proposta, novoValor: '99.00' } }, { idsAfetados: [14] }, { idsAfetados: [13, 14] }])
      expect(() => validarCotacaoUi51({ ...quote(), ...patch }, scope, intent.proposta, '2026-11-26')).toThrow();
  });
  it('quitação vincula conta explícita, valor recebido e caixa real em quote e prova', async () => {
    const m = memory(), qIntent: Intent51 = { ...intent, proposta: { acao: 'quitar', contaCaixaId: 17, valorRecebido: '100.00', reconhecoDinheiroReal: true } };
    expect(validarCotacaoUi51(quote(qIntent), scope, qIntent.proposta, '2026-11-26').contaDestinoId).toBe(17);
    expect(() => validarCotacaoUi51({ ...quote(qIntent), contaDestinoId: 18 }, scope, qIntent.proposta, '2026-11-26')).toThrow();
    const wrong = closure(qIntent); wrong.resultado.contaDestinoId = 18;
    await expect(start(m, async () => wrong, { nova: qIntent })).rejects.toThrow(/divergente/);
    expect(lerJournal51(m.storage, scope).pending?.proposta).toEqual(qIntent.proposta);
  });
  it('metadata37 exige empresa, estrutura própria strict e não aceita getter/default', () => {
    expect(contasPropriasUi51({ empresaId: 11, contas: [{ id: 17, nome: 'Dinheiro', tipo: 'dinheiro' }] }, 11)).toHaveLength(1);
    for (const value of [{ empresaId: 99, contas: [] }, { empresaId: 11, contas: [], saldo: '0.00' }, { empresaId: 11, contas: [{ id: 17, nome: 'X', tipo: 'caixa', saldo: 1 }] }]) expect(() => contasPropriasUi51(value, 11)).toThrow();
    const getter = vi.fn(); expect(() => contasPropriasUi51({ get empresaId() { getter(); return 11; }, contas: [] }, 11)).toThrow(); expect(getter).not.toHaveBeenCalled();
  });
  it('estado obrigatório não vira zero/fallback; rejeita owner e duplicatas', () => {
    const state = { versao: 'obrigacoes51_v1', userId: 11, contratoId: 12, statusObrigacao: 'ativo', arquivado: false, obrigacaoAdicional: '10.00', parcelas: [{ parcelaId: 13, statusFinanceiroOriginal: 'pendente', statusObrigacao: 'aberta', obrigacaoAtual: '100.00', componenteAdicional: '10.00', arquivada: false }] };
    expect(validarEstadoUi51(state, scope).obrigacaoAdicional).toBe('10.00');
    for (const value of [null, {}, { ...state, userId: 99 }, { ...state, parcelas: [state.parcelas[0], state.parcelas[0]] }]) expect(() => validarEstadoUi51(value, scope)).toThrow();
  });
});
