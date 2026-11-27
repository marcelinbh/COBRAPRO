import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { listarEmprestimosSnapshot60, RPC60 } from './snapshot60-reader';

const OWNER = 41;
const healthy = () => ({ versao: 'lista_emprestimos60_v1', userId: OWNER,
  dataCalculo: '2026-11-27', items: [], configuracoes: [] });
const confirmed = () => ({ data: healthy(), error: null, status: 200, count: null, statusText: 'OK' });
const timeout = () => ({ data: null, error: { code: '57014',
  message: 'canceling statement due to statement timeout', details: null, hint: null },
  status: 500, count: null, statusText: 'Internal Server Error' });
const expectedDTO = { version: 'loan_list_read_v1', userId: OWNER, items: [],
  coverage: { scopedContracts: 0, validatedContracts: 0, unavailableContracts: 0, complete: true, label: 'validados somente' },
  totals: { label: 'validados somente', values: { capital: 0, totalReceber: 0, totalPago: 0 } }, warning: null };
const observe = (promise: ReturnType<typeof listarEmprestimosSnapshot60>) =>
  promise.then(data => ({ data, error: undefined }), error => ({ data: undefined, error }));

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

async function finishBackoff(rpc: ReturnType<typeof vi.fn>) {
  await vi.advanceTimersByTimeAsync(0);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(249);
  expect(rpc).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(rpc).toHaveBeenCalledTimes(2);
}

function sameRead(rpc: ReturnType<typeof vi.fn>, client: unknown) {
  expect(rpc.mock.calls).toEqual([[RPC60, { p_user_id: OWNER }], [RPC60, { p_user_id: OWNER }]]);
  expect(rpc.mock.contexts).toEqual([client, client]);
  expect(vi.getTimerCount()).toBe(0);
}

test('sucesso confirmado conserva DTO público, uma RPC e nenhum timer', async () => {
  const rpc = vi.fn().mockResolvedValue(confirmed());
  await expect(listarEmprestimosSnapshot60({ rpc }, OWNER)).resolves.toEqual(expectedDTO);
  expect(rpc.mock.calls).toEqual([[RPC60, { p_user_id: OWNER }]]);
  expect(vi.getTimerCount()).toBe(0);
});

const nativeTimeouts: [string, () => unknown][] = [
  ['campos nativos completos', timeout],
  ['details e hint strings', () => ({ ...timeout(), error: { ...timeout().error, details: 'statement', hint: 'retry read' } })],
  ['count/statusText opcionais ausentes', () => { const { count, statusText, ...rest } = timeout(); return rest; }],
  ['strings vazias válidas', () => ({ ...timeout(), statusText: '', error: { ...timeout().error, details: '', hint: '' } })],
  ['details string e hint null', () => ({ ...timeout(), error: { ...timeout().error, details: 'statement' } })],
  ['details null e hint string', () => ({ ...timeout(), error: { ...timeout().error, hint: 'read' } })],
];
test.each(nativeTimeouts)('timeout exato → snapshot fresh confirmado, 2 calls/250ms: %s', async (_name, factory) => {
  const first: any = factory();
  const rpc = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(confirmed());
  const client = { rpc };
  const outcome = observe(listarEmprestimosSnapshot60(client, OWNER));
  await finishBackoff(rpc);
  expect(await outcome).toEqual({ data: expectedDTO, error: undefined });
  sameRead(rpc, client);
  expect(first).toEqual(factory());
});

test('timeout persistente falha sem DTO/false empty e sem terceira tentativa', async () => {
  const rpc = vi.fn().mockResolvedValue(timeout());
  const client = { rpc };
  const outcome = observe(listarEmprestimosSnapshot60(client, OWNER));
  await finishBackoff(rpc);
  const result = await outcome;
  expect(result.data).toBeUndefined();
  expect(result.error).toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  await vi.advanceTimersByTimeAsync(2000);
  sameRead(rpc, client);
});

test('network na segunda chamada é fatal, sem terceira tentativa', async () => {
  const rpc = vi.fn().mockResolvedValueOnce(timeout()).mockRejectedValueOnce(new Error('offline'));
  const client = { rpc };
  const outcome = observe(listarEmprestimosSnapshot60(client, OWNER));
  await finishBackoff(rpc);
  expect(await outcome).toMatchObject({ data: undefined, error: { code: 'INTERNAL_SERVER_ERROR' } });
  await vi.advanceTimersByTimeAsync(2000);
  sameRead(rpc, client);
});

const invalidSnapshots: [string, () => unknown][] = [
  ['owner estrangeiro', () => ({ ...healthy(), userId: 99 })],
  ['configuração estrangeira', () => ({ ...healthy(), configuracoes: [{ user_id: 99, chave: 'multaDiaria', valor: '1' }] })],
  ['campo extra', () => ({ ...healthy(), extra: true })],
  ['data inválida', () => ({ ...healthy(), dataCalculo: 'invalid' })],
  ['item malformado', () => ({ ...healthy(), items: [{ kind: 'validated', id: 1 }] })],
  ['recusa não permitida', () => ({ ...healthy(), items: [{ kind: 'unavailable', id: 1, reason: '57014' }] })],
];
test.each(invalidSnapshots)('snapshot inválido após retry não passa nem repete: %s', async (_name, factory) => {
  const rpc = vi.fn().mockResolvedValueOnce(timeout()).mockResolvedValueOnce({ ...confirmed(), data: factory() });
  const client = { rpc };
  const outcome = observe(listarEmprestimosSnapshot60(client, OWNER));
  await finishBackoff(rpc);
  expect(await outcome).toMatchObject({ data: undefined, error: { code: 'PRECONDITION_FAILED' } });
  await vi.advanceTimersByTimeAsync(2000);
  sameRead(rpc, client);
});
test.each(invalidSnapshots)('mapping/tamper na primeira resposta não dispara retry: %s', async (_name, factory) => {
  const rpc = vi.fn().mockResolvedValue({ ...confirmed(), data: factory() });
  await expect(listarEmprestimosSnapshot60({ rpc }, OWNER)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

// Apenas JSON own estrito pode alcançar o predicado; accessor algum deve executar.
type Attack = [string, (getter: () => never) => unknown];
const attacks: Attack[] = [
  ['payload prévio junto com error', () => ({ ...timeout(), data: healthy() })],
  ['data string não null', () => ({ ...timeout(), data: '' })],
  ['data array não null', () => ({ ...timeout(), data: [] })],
  ['data ausente', () => { const { data, ...rest } = timeout(); return rest; }],
  ['error ausente', () => { const { error, ...rest } = timeout(); return rest; }],
  ['error null', () => ({ ...timeout(), error: null })],
  ['error string', () => ({ ...timeout(), error: '57014' })],
  ['error incompleto', () => ({ ...timeout(), error: { code: '57014' } })],
  ['code ausente', () => { const { code, ...error } = timeout().error; return { ...timeout(), error }; }],
  ['code numérico', () => ({ ...timeout(), error: { ...timeout().error, code: 57014 } })],
  ['code 42501', () => ({ ...timeout(), error: { ...timeout().error, code: '42501' } })],
  ['code 57014 espaço', () => ({ ...timeout(), error: { ...timeout().error, code: '57014 ' } })],
  ['message ausente', () => { const { message, ...error } = timeout().error; return { ...timeout(), error }; }],
  ['message outro timeout', () => ({ ...timeout(), error: { ...timeout().error, message: 'statement timeout' } })],
  ['message user cancel', () => ({ ...timeout(), error: { ...timeout().error, message: 'canceling statement due to user request' } })],
  ['message sufixo', () => ({ ...timeout(), error: { ...timeout().error, message: timeout().error.message + ' ' } })],
  ['message null', () => ({ ...timeout(), error: { ...timeout().error, message: null } })],
  ['details ausente', () => { const { details, ...error } = timeout().error; return { ...timeout(), error }; }],
  ['hint ausente', () => { const { hint, ...error } = timeout().error; return { ...timeout(), error }; }],
  ['details objeto', () => ({ ...timeout(), error: { ...timeout().error, details: {} } })],
  ['hint boolean', () => ({ ...timeout(), error: { ...timeout().error, hint: false } })],
  ['status ausente', () => { const { status, ...rest } = timeout(); return rest; }],
  ['status string', () => ({ ...timeout(), status: '500' })],
  ['status 200', () => ({ ...timeout(), status: 200 })],
  ['status 403', () => ({ ...timeout(), status: 403 })],
  ['status 429', () => ({ ...timeout(), status: 429 })],
  ['status 502 genérico', () => ({ ...timeout(), status: 502 })],
  ['status 503 genérico', () => ({ ...timeout(), status: 503 })],
  ['count não null', () => ({ ...timeout(), count: 0 })],
  ['statusText não string', () => ({ ...timeout(), statusText: null })],
  ['success extra', () => ({ ...timeout(), success: true })],
  ['campo extra envelope', () => ({ ...timeout(), retry: true })],
  ['campo extra error', () => ({ ...timeout(), error: { ...timeout().error, retry: true } })],
  ['error getter', getter => Object.defineProperty(timeout(), 'error', { enumerable: true, get: getter })],
  ['code getter', getter => ({ ...timeout(), error: Object.defineProperty(timeout().error, 'code', { enumerable: true, get: getter }) })],
  ['message getter', getter => ({ ...timeout(), error: Object.defineProperty(timeout().error, 'message', { enumerable: true, get: getter }) })],
  ['details getter', getter => ({ ...timeout(), error: Object.defineProperty(timeout().error, 'details', { enumerable: true, get: getter }) })],
  ['data getter', getter => Object.defineProperty(timeout(), 'data', { enumerable: true, get: getter })],
  ['extra getter', getter => Object.defineProperty(timeout(), 'extra', { enumerable: true, get: getter })],
  ['error proto getter', getter => ({ ...timeout(), error: Object.setPrototypeOf(timeout().error, Object.defineProperty({}, 'extra', { get: getter })) })],
  ['envelope proto', getter => Object.setPrototypeOf(timeout(), Object.defineProperty({}, 'extra', { get: getter }))],
  ['error ciclo', () => { const value: any = timeout(); value.error.details = value.error; return value; }],
  ['envelope ciclo', () => { const value: any = timeout(); value.extra = value; return value; }],
  ['campo symbol', () => ({ ...timeout(), [Symbol('extra')]: true })],
  ['campo não enumerável', () => Object.defineProperty(timeout(), 'extra', { value: true })],
  ['details undefined', () => ({ ...timeout(), error: { ...timeout().error, details: undefined } })],
  ['envelope array', () => [timeout()]],
];
test.each(attacks)('envelope adversarial sem retry/getter: %s', async (_name, factory) => {
  const getter = vi.fn((): never => { throw new Error('getter proibido'); });
  const rpc = vi.fn().mockResolvedValueOnce(factory(getter)).mockResolvedValueOnce(confirmed());
  const result = await observe(listarEmprestimosSnapshot60({ rpc }, OWNER));
  expect(result.data).toBeUndefined();
  expect(result.error).toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(getter).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

test('network na primeira chamada nunca dispara retry', async () => {
  const rpc = vi.fn().mockRejectedValue(new Error('offline'));
  await expect(listarEmprestimosSnapshot60({ rpc }, OWNER)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

test.each([0, -1, 1.5, 2147483648, '41', null, undefined, NaN, Infinity, {}, true])(
  'owner inválido %s recusa antes da RPC e do backoff', async owner => {
    const rpc = vi.fn().mockResolvedValue(timeout());
    await expect(listarEmprestimosSnapshot60({ rpc }, owner)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(rpc).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

test('client ausente falha sem converter em lista vazia', async () => {
  await expect(listarEmprestimosSnapshot60(null, OWNER)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  expect(vi.getTimerCount()).toBe(0);
});
