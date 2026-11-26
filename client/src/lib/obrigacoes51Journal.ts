import { z } from 'zod';
import {
  canonical51, intent51, quote51, projection51, int32_51, hash51, positiveMoney51,
  validarClosure51, type Intent51, type Quote51, type Projection51, type Proposta51, type Closure51,
} from '../../../shared/obrigacoes51';
import { copiarJsonCaixa37 } from '../../../shared/caixa37';

export type Scope51 = { ownerId: number; sessionScope: string; contratoId: number };
export type Storage51 = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & Partial<Pick<Storage, 'length' | 'key'>>;
export type Locks51 = { request<T>(name: string, callback: () => Promise<T>): Promise<T> };
export type Snapshot51 = { raw: string | null; pending: Intent51 | null; terminal: Closure51 | null; archivedIntent: Intent51 | null };
const scope51 = z.object({ ownerId: int32_51, sessionScope: hash51, contratoId: int32_51 }).strict();
const receipt51 = z.object({ versao: z.literal('journal_obrigacoes51_v1'), intent: intent51, closure: z.unknown() }).strict();
const pointer51 = z.object({ idempotencyKey: z.string().uuid() }).strict();
export const capacidadeUi51 = z.object({ versao: z.literal('obrigacoes51_v1'), disponivel: z.literal(true) }).strict();
const metadata37 = z.object({
  empresaId: int32_51,
  contas: z.array(z.object({ id: int32_51, nome: z.string(), tipo: z.string() }).strict()).max(10000),
}).strict().refine(m => m.contas.every((c, i) => i === 0 || c.id > m.contas[i - 1].id));

export function chaveJournal51(scope: Scope51): string {
  const s = scope51.parse(scope);
  return `cobrapro:obrigacoes51:v1:${s.ownerId}:${s.sessionScope}:${s.contratoId}`;
}
/** Todas as sessões/abas da mesma empresa disputam este lock; disco continua estritamente session-scoped. */
export function chaveLock51(scope: Scope51): string {
  const s = scope51.parse(scope);
  return `cobrapro:obrigacoes51:lock:${s.ownerId}:${s.contratoId}`;
}
function sameScope51(intent: Intent51, scope: Scope51) {
  if (intent.ownerId !== scope.ownerId || intent.sessionScope !== scope.sessionScope || intent.contratoId !== scope.contratoId)
    throw Error('Journal de outra empresa, sessão ou contrato. Preserve o armazenamento.');
}
function cas51(storage: Storage51, key: string, expected: string | null) {
  if (storage.getItem(key) !== expected) throw Error('Journal mudou em outra aba. Releia a intenção; nunca sobrescreva ou gere outra UUID.');
}
function readReceipt51(storage: Storage51, scope: Scope51, uuid: string) {
  const raw = storage.getItem(`${chaveJournal51(scope)}:closed:${uuid}`);
  if (raw === null) return null;
  const record = receipt51.parse(JSON.parse(raw));
  sameScope51(record.intent, scope);
  if (record.intent.idempotencyKey !== uuid) throw Error('Arquivo pertence a outra UUID.');
  return { intent: record.intent, closure: validarClosure51(record.closure, record.intent) };
}
/** Leitura não autoriza POST. Todos os writes e o POST usam o mesmo Web Lock. */
export function lerJournal51(storage: Storage51, scope: Scope51): Snapshot51 {
  const key = chaveJournal51(scope), raw = storage.getItem(key);
  if (raw !== null) {
    const pending = intent51.parse(JSON.parse(raw)); sameScope51(pending, scope);
    const receipt = readReceipt51(storage, scope, pending.idempotencyKey);
    if (receipt && canonical51(receipt.intent) !== canonical51(pending)) throw Error('Arquivo e pending divergem.');
    return { raw, pending, terminal: receipt?.closure ?? null, archivedIntent: receipt?.intent ?? null };
  }
  const pointerRaw = storage.getItem(`${key}:last-terminal`);
  if (pointerRaw === null) return { raw, pending: null, terminal: null, archivedIntent: null };
  const pointer = pointer51.parse(JSON.parse(pointerRaw));
  const receipt = readReceipt51(storage, scope, pointer.idempotencyKey);
  if (!receipt) throw Error('Arquivo terminal ausente. Não presumir confirmação.');
  return { raw, pending: null, terminal: receipt.closure, archivedIntent: receipt.intent };
}
/** Sem adoção/migração: somente nomes existentes da MESMA empresa/contrato. Inclui scopes48 antigos. */
export function pendenciasLegadas48(storage: Storage51, scope: Scope51): string[] {
  scope51.parse(scope);
  const names = new Set([
    `cobrapro:manutencao48:${scope.ownerId}:${scope.sessionScope}:${scope.contratoId}`,
    `cobrapro:juros48:${scope.ownerId}:${scope.sessionScope}:${scope.contratoId}`,
    `cobrapro:manutencao48:${scope.ownerId}:${scope.contratoId}`,
    `cobrapro:juros48:${scope.ownerId}:${scope.contratoId}`,
  ]);
  // sessionScope51 é hash distinto de sessionScope48: enumerar apenas chaves, não dados de outras empresas.
  if (typeof storage.key === 'function' && typeof storage.length === 'number') {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && new RegExp(`^cobrapro:(?:manutencao48|juros48):${scope.ownerId}:[a-f0-9]{64}:${scope.contratoId}$`).test(k)) names.add(k);
    }
  }
  return [...names].filter(k => storage.getItem(k) !== null);
}
/** Não reivindica outra sessão: uma intenção anterior incerta não pode ser contornada com UUID nova. */
export function pendenciasOutrasSessoes51(storage: Storage51, scope: Scope51): string[] {
  const current = chaveJournal51(scope), result: string[] = [];
  if (typeof storage.key !== 'function' || typeof storage.length !== 'number') return result;
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k !== current && new RegExp(`^cobrapro:obrigacoes51:v1:${scope.ownerId}:[a-f0-9]{64}:${scope.contratoId}$`).test(k) && storage.getItem(k) !== null) result.push(k);
  }
  return result;
}
function requireCurrent51(atual: () => boolean) {
  if (!atual()) throw Error('Sessão anterior. Intenção preservada, resposta ignorada.');
}
/** UUID gerada pelo chamador uma única vez. Persist/readback ocorre antes de qualquer POST. */
export async function operarJournal51(options: {
  storage: Storage51; locks: Locks51 | undefined; scope: Scope51; expected: string | null;
  atual: () => boolean; mode: 'novo' | 'repetir' | 'conferir'; nova?: Intent51;
  autorizarNovo?: () => boolean; onPersisted?: (snapshot: Snapshot51) => void; post: (intent: Intent51) => Promise<unknown>;
}): Promise<Snapshot51> {
  const { storage, locks, scope, expected, atual, mode } = options;
  if (!locks) throw Error('Este navegador não oferece Web Locks. Nenhum envio foi autorizado.');
  const key = chaveJournal51(scope);
  return locks.request(chaveLock51(scope), async () => {
    requireCurrent51(atual); cas51(storage, key, expected);
    let loaded = lerJournal51(storage, scope);
    // Prova arquivada vence elegibilidade/capacidade atual. Nunca repetir financeiro confirmado.
    if (loaded.pending && loaded.terminal) return loaded;
    let raw = expected, intent = loaded.pending;
    if (mode === 'novo') {
      if (intent || expected !== null) throw Error('Há intenção pendente. Confira a mesma UUID.');
      const legacy = pendenciasLegadas48(storage, scope);
      if (legacy.length) throw Error(`Há manutenção anterior pendente (${legacy.join(', ')}). Use Manutenção de juros e valores para conferir/arquivar a intenção original; ela não será migrada.`);
      const previous = pendenciasOutrasSessoes51(storage, scope);
      if (previous.length) throw Error(`Intenção deste contrato preservada em sessão anterior (${previous.join(', ')}). Nenhuma UUID nova autorizada. Retome a sessão original para conferir; não apague nem adote o journal.`);
      if (!options.autorizarNovo?.() || !options.nova) throw Error('Cotação, estado ou disponibilidade não comprovados.');
      intent = intent51.parse(options.nova); sameScope51(intent, scope);
      if (readReceipt51(storage, scope, intent.idempotencyKey)) throw Error('UUID já encerrada. Nenhum POST.');
      raw = JSON.stringify(intent);
      cas51(storage, key, null); storage.setItem(key, raw); cas51(storage, key, raw);
    } else if (!intent || raw === null) throw Error('Nenhuma intenção exata persistida para recuperar.');
    requireCurrent51(atual); cas51(storage, key, raw);
    const exact = intent51.parse(JSON.parse(raw!)); sameScope51(exact, scope);
    // Apenas estado local da UI: não é onSuccess/navegação e não afirma efeito financeiro.
    options.onPersisted?.(lerJournal51(storage, scope));
    requireCurrent51(atual); cas51(storage, key, raw);
    const response = await options.post(exact);
    requireCurrent51(atual); cas51(storage, key, raw);
    const closure = validarClosure51(copiarJsonCaixa37(response), exact);
    const archiveKey = `${key}:closed:${exact.idempotencyKey}`;
    const archive = JSON.stringify({ versao: 'journal_obrigacoes51_v1', intent: exact, closure });
    const old = storage.getItem(archiveKey);
    if (old !== null && old !== archive) throw Error('Prova arquivada divergente; preserve pending.');
    storage.setItem(archiveKey, archive);
    if (storage.getItem(archiveKey) !== archive) throw Error('Prova não persistiu. Preserve pedido e UUID; nenhum callback autorizado.');
    cas51(storage, key, raw); requireCurrent51(atual);
    // Pending permanece até gesto explícito de encerrar. Crash/reload encontra prova ANTES de POST.
    loaded = lerJournal51(storage, scope);
    return loaded;
  });
}
/** Arquivo+índice com readback ANTES de limpar pending, callback ou navegação. */
export async function encerrarJournal51(storage: Storage51, locks: Locks51 | undefined, scope: Scope51,
  expected: string, atual: () => boolean): Promise<Snapshot51> {
  if (!locks) throw Error('Web Locks obrigatório para encerrar confirmação.');
  const key = chaveJournal51(scope);
  return locks.request(chaveLock51(scope), async () => {
    requireCurrent51(atual); cas51(storage, key, expected);
    const loaded = lerJournal51(storage, scope);
    if (!loaded.pending || !loaded.terminal || !loaded.archivedIntent) throw Error('Prova terminal exata ainda não arquivada.');
    validarClosure51(loaded.terminal, loaded.pending);
    const pointer = JSON.stringify({ idempotencyKey: loaded.pending.idempotencyKey });
    storage.setItem(`${key}:last-terminal`, pointer);
    if (storage.getItem(`${key}:last-terminal`) !== pointer) throw Error('Índice terminal não persistiu; pending preservado.');
    cas51(storage, key, expected); requireCurrent51(atual);
    storage.removeItem(key); cas51(storage, key, null);
    return lerJournal51(storage, scope);
  });
}
export function moedaUi51(value: string): string {
  const s = value.trim().replace(',', '.');
  if (!/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/.test(s)) throw Error('Informe valor positivo, até duas casas, sem arredondamento.');
  const [a, b = ''] = s.split('.'); return positiveMoney51.parse(`${a}.${b.padEnd(2, '0')}`);
}
export function diaBrasilia51(now = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => p.find(v => v.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validarCotacaoUi51(value: unknown, scope: Scope51, proposta: Proposta51, dia = diaBrasilia51()): Quote51 {
  const q = quote51.parse(copiarJsonCaixa37(value));
  const singleTarget = proposta.acao === 'editar' ? proposta.parcelaId :
    (proposta.acao === 'cancelar' || proposta.acao === 'arquivar') && proposta.alvo.tipo === 'parcela' ? proposta.alvo.parcelaId : null;
  if (new Set(q.idsAfetados).size !== q.idsAfetados.length || (singleTarget !== null && (q.idsAfetados.length !== 1 || q.idsAfetados[0] !== singleTarget)))
    throw Error('Cotação afetaria outra parcela. Nenhum envio autorizado.');
  if (q.userId !== scope.ownerId || q.contratoId !== scope.contratoId || canonical51(q.proposta) !== canonical51(proposta) ||
    q.dataCalculo !== dia || q.caixaPreservado !== (proposta.acao !== 'quitar') ||
    q.contaDestinoId !== (proposta.acao === 'quitar' ? proposta.contaCaixaId : null) ||
    q.valorExigido !== (proposta.acao === 'quitar' ? proposta.valorRecebido : '0.00'))
    throw Error('Cotação não pertence à empresa, contrato, proposta, conta e dia atuais. Cote novamente; nada enviado.');
  return q;
}
export function validarEstadoUi51(value: unknown, scope: Scope51): Projection51 {
  const p = projection51.parse(copiarJsonCaixa37(value));
  if (p.userId !== scope.ownerId || p.contratoId !== scope.contratoId || new Set(p.parcelas.map(v => v.parcelaId)).size !== p.parcelas.length)
    throw Error('Estado da obrigação não pertence ao contrato/empresa atual.');
  return p;
}
export function contasPropriasUi51(value: unknown, ownerId: number) {
  const m = metadata37.parse(copiarJsonCaixa37(value));
  if (m.empresaId !== ownerId) throw Error('Metadados de conta de outra empresa.');
  return m.contas;
}
