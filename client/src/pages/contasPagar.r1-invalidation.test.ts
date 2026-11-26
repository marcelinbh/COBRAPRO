import { describe, expect, it, vi } from 'vitest';
import { code, compile, declaration, deferred, Hooks, source } from '../lib/r1BoundaryHarness';

const intent = { action: 'pagar', userId: 31, idempotencyKey: '00000000-0000-4000-8000-000000000031', payload: { id: 17, contaCaixaId: 8, dataPagamento: '2026-11-26' } };
const confirmed = { success: true, acao: 'pagar', userId: 31, chaveIdempotencia: intent.idempotencyKey, operationId: '00000000-0000-4000-8000-000000000032' };
function handlers() {
  let current = true;
  const user = { current: 31 }, flight = { current: false }, errors = vi.fn(), success = vi.fn(), setters = vi.fn(), sync = vi.fn();
  const s = { acquire: vi.fn(() => true), release: vi.fn(), confirmed: vi.fn() };
  const mutations = { criar: { mutateAsync: vi.fn() }, pagar: { mutateAsync: vi.fn().mockResolvedValue(confirmed) }, estornar: { mutateAsync: vi.fn() }, reconciliacao: { mutateAsync: vi.fn().mockResolvedValue({ status: 'confirmed' }) } };
  const invalidations: Record<string, ReturnType<typeof vi.fn>> = {};
  const utils: any = {};
  for (const [group, names] of Object.entries({ contasPagar: ['listar', 'resumo', 'conferirCaixa'], caixa: ['contasParaOperacao37', 'contas', 'transacoes', 'conferencia'], dashboard: ['kpis'] })) {
    utils[group] = {};
    for (const name of names) { const fn = vi.fn().mockResolvedValue(undefined); invalidations[`${group}.${name}`] = fn; utils[group][name] = { invalidate: fn }; }
  }
  const ast = source('pages/ContasPagar.tsx');
  const declarations = ['enviar', 'reconciliar'].map(n => declaration(ast, n).getText(ast)).join('\n');
  const bindings = { ...mutations, habilitado: true, recovery: {}, pertenceSessao: () => current, usuarioAtual: user, inFlight: flight,
    setBusy: setters, setNovo: setters, setPagarId: setters, setEstornarId: setters, setContaCaixaId: setters, setMotivo: setters, setForm: setters, setRecovery: setters,
    freshForm: () => ({}), toast: { error: errors, success }, sync, utils, expensesUtils: utils,
    // Evidence validator is confined: use checked statuses to exercise UI control flow,
    // not to recertify the untouched financial evidence implementation.
    assertRecoveryEvidence: (r: any) => { if (r.invalid) throw Error('invalid evidence fixture'); return r; },
  };
  const fns = compile(`${declarations}\nreturn {enviar,reconciliar};`, bindings);
  return { ...fns, s, mutations, invalidations, setters, errors, success, sync, flight, user, obsolete: () => { current = false; user.current = 42; } };
}
const targets = ['caixa.contas', 'caixa.conferencia', 'contasPagar.conferirCaixa'];
function none(h: ReturnType<typeof handlers>) { Object.values(h.invalidations).forEach(fn => expect(fn).not.toHaveBeenCalled()); }

describe('R1 callbacks de despesa — real AST handlers, mocks confined', () => {
  it('confirmed invalida saldo e as duas conferências uma vez, sem soma otimista', async () => {
    const h = handlers(); await h.enviar(intent, h.s);
    expect(h.s.confirmed).toHaveBeenCalledWith('pagar', intent.idempotencyKey);
    targets.forEach(t => expect(h.invalidations[t]).toHaveBeenCalledTimes(1));
    expect(h.mutations.pagar.mutateAsync).toHaveBeenCalledWith({ ...intent.payload, idempotencyKey: intent.idempotencyKey });
    expect(h.mutations.criar.mutateAsync).not.toHaveBeenCalled(); expect(h.mutations.estornar.mutateAsync).not.toHaveBeenCalled();
  });
  it.each(['timeout', 'falseSuccess', 'wrongOwner', 'wrongUUID', 'noOperation'])('%s não confirma journal nem invalida saldo/conferência', async kind => {
    const h = handlers(); const result: any = { ...confirmed };
    if (kind === 'timeout') h.mutations.pagar.mutateAsync.mockRejectedValueOnce(Error('timeout fixture'));
    if (kind === 'falseSuccess') result.success = false;
    if (kind === 'wrongOwner') result.userId = 42;
    if (kind === 'wrongUUID') result.chaveIdempotencia = '00000000-0000-4000-8000-000000000042';
    if (kind === 'noOperation') result.operationId = '';
    if (kind !== 'timeout') h.mutations.pagar.mutateAsync.mockResolvedValueOnce(result);
    await h.enviar(intent, h.s); none(h); expect(h.s.confirmed).not.toHaveBeenCalled(); expect(h.s.release).toHaveBeenCalledWith('pagar'); expect(h.mutations.pagar.mutateAsync).toHaveBeenCalledTimes(1);
  });
  it.each(['confirmed', 'not_executed', 'unknown', 'invalid'])('recovery %s só invalida se confirmado e nunca envia pagamento novo', async status => {
    const h = handlers(); h.mutations.reconciliacao.mutateAsync.mockResolvedValueOnce(status === 'invalid' ? { invalid: true } : { status });
    await h.reconciliar(intent, h.s);
    if (status === 'confirmed') { targets.forEach(t => expect(h.invalidations[t]).toHaveBeenCalledTimes(1)); expect(h.s.confirmed).toHaveBeenCalledTimes(1); }
    else { none(h); expect(h.s.confirmed).not.toHaveBeenCalled(); }
    expect(h.mutations.pagar.mutateAsync).not.toHaveBeenCalled(); expect(h.mutations.criar.mutateAsync).not.toHaveBeenCalled(); expect(h.mutations.estornar.mutateAsync).not.toHaveBeenCalled();
  });
  it.each(['enviar', 'reconciliar'] as const)('%s callback tardio não invalida nem atualiza outra empresa', async name => {
    const h = handlers(), gate = deferred();
    (name === 'enviar' ? h.mutations.pagar : h.mutations.reconciliacao).mutateAsync.mockReturnValueOnce(gate.promise);
    const work = h[name](intent, h.s), before = h.setters.mock.calls.length;
    h.obsolete(); gate.resolve(name === 'enviar' ? confirmed : { status: 'confirmed' }); await work;
    none(h); expect(h.setters).toHaveBeenCalledTimes(before); expect(h.success).not.toHaveBeenCalled(); expect(h.errors).not.toHaveBeenCalled(); expect(h.sync).not.toHaveBeenCalled();
    // Completion of old intent is permitted in its own store; never in the current UI.
    expect(h.s.release).toHaveBeenCalledTimes(1);
  });
  it('falha na invalidação assíncrona não reenvia nem restaura intenção confirmada', async () => {
    const h = handlers(); h.invalidations['caixa.contas'].mockRejectedValueOnce(Error('read failed'));
    await h.enviar(intent, h.s); await Promise.resolve();
    expect(h.s.confirmed).toHaveBeenCalledTimes(1); expect(h.mutations.pagar.mutateAsync).toHaveBeenCalledTimes(1); expect(h.errors).not.toHaveBeenCalled();
  });
});

describe('R1 callback NovaConta real, montado por CaixaEmpresa', () => {
  it.each(['live', 'obsolete', 'unmounted'])('callback %s só invalida se pertence ao mount atual', state => {
    const hooks = new Hooks(); let current = true; const invalidations: string[] = [], mutate = vi.fn(); let options: any;
    const utils: any = { caixa: {}, contasPagar: {} };
    for (const name of ['contas', 'transacoes', 'contasParaOperacao37', 'conferencia']) utils.caixa[name] = { invalidate: () => { invalidations.push(`caixa.${name}`); } };
    utils.contasPagar.conferirCaixa = { invalidate: () => { invalidations.push('contasPagar.conferirCaixa'); } };
    const ast = source('pages/Caixa.tsx'), parent = declaration(ast, 'CaixaEmpresa');
    const variable = parent.body!.statements.find(n => n.getText(ast).startsWith('const invalidarTudo ='))!;
    const invalidate = compile(`${variable.getText(ast)}\nreturn invalidarTudo;`, { utils });
    const fn = compile(`${code(ast, 'NovaConta')}\nreturn NovaConta;`, { ...hooks.bindings(), trpc: { caixa: { criarConta: { useMutation: (o: any) => { options = o; return { mutate, isPending: false }; } } } }, useTranslation: () => ({ t: (s: string) => s }), toast: { success: vi.fn(), error: vi.fn() }, Dialog: 'Dialog', DialogTrigger: 'DialogTrigger', DialogContent: 'DialogContent', DialogHeader: 'DialogHeader', DialogTitle: 'DialogTitle', Button: 'Button', Input: 'Input', Label: 'Label', Select: 'Select', SelectTrigger: 'SelectTrigger', SelectValue: 'SelectValue', SelectContent: 'SelectContent', SelectItem: 'SelectItem', Plus: 'Plus' });
    hooks.render(fn, { onSuccess: invalidate, atual: () => current }); hooks.flush();
    expect(mutate).not.toHaveBeenCalled(); expect(invalidations).toEqual([]);
    if (state === 'obsolete') current = false;
    if (state === 'unmounted') hooks.unmount();
    options.onSuccess();
    if (state === 'live') expect(invalidations).toEqual(['caixa.contas', 'caixa.transacoes', 'caixa.contasParaOperacao37', 'caixa.conferencia', 'contasPagar.conferirCaixa']);
    else expect(invalidations).toEqual([]);
  });
});
