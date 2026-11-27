import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ENV } from '../_core/env';
import {
  preparar64Schema, enviar64Schema, preview64Schema, tipo64Schema,
  type Preparar64, type Preview64, type PreviewItem64, type Resultado64, type Tipo64,
} from '../../shared/cobrancaLote64';
import { canonical51, date51, int32_51 } from '../../shared/obrigacoes51';
import { centavos51, exigivel51 } from '../../shared/obrigacoes51Projection';
import { listarEmprestimosSnapshot60, type Snapshot60 } from './snapshot60-reader';
import { listarRegistrosEmprestimos } from './emprestimosLeitura';
import { dataHojeBrasilia } from './businessDate';
import { enviarMensagemEvolution, normalizarTelefoneWhatsApp } from './evolutionClient';
import { persistirHistoricoWhatsApp, type BancoWhatsApp } from './notificacoes.operational.safe';

/** Nenhum writer financeiro, produtor automático, agenda ou recuperação de envio. */
export type Client64 = Pick<BancoWhatsApp, 'from' | 'rpc'>;
export type Options64 = {
  now?: Date | (() => Date);
  secret?: string;
  dependencies?: {
    enviarMensagemEvolution?: typeof enviarMensagemEvolution;
    persistirHistoricoWhatsApp?: typeof persistirHistoricoWhatsApp;
  };
};
const MANUAL = 'cobranca_manual64';
const TTL = 300_000, LEASE = 90_000;
const CONFIG_KEYS = ['nomeEmpresa', 'assinaturaWhatsapp', 'assinatura_whatsapp'];
const columns = 'id,user_id,tipo,chave_deduplicacao,data_referencia,parcela_id,cliente_id,status,tentativas,lease_expira_em,provider_message_id';
const outboxSchema = z.object({
  id: z.string().uuid(), user_id: int32_51, tipo: z.literal(MANUAL), chave_deduplicacao: z.string().max(160),
  data_referencia: date51, parcela_id: int32_51, cliente_id: int32_51,
  status: z.enum(['pendente', 'enviando', 'enviado', 'falhou', 'desconhecido', 'cancelado']),
  tentativas: z.number().int().min(0), lease_expira_em: z.string().datetime({ offset: true }).nullable(),
  provider_message_id: z.string().min(1).max(256).refine(s => s === s.trim()).nullable(),
}).strict();
type Outbox64 = z.infer<typeof outboxSchema>;
const tokenSchema = z.object({
  v: z.literal(64), owner: int32_51, session: z.string().regex(/^[a-f0-9]{64}$/), date: date51,
  exp: z.number().int().positive().safe(), contratoId: int32_51, tipo: tipo64Schema,
  hash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
type Token64 = z.infer<typeof tokenSchema>;
type Effective64 = { contratoId: number; clienteId: number; parcelaId: number; telefone: string; mensagem: string; hash: string };
const unavailable = () => new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Não foi possível confirmar esta cobrança. Reconsulte a lista.' });
const invalidToken = () => new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Prévia inválida ou expirada. Prepare novamente.' });
function context64(uid: number, session: string, options: Options64) {
  if (!int32_51.safeParse(uid).success || !/^[a-f0-9]{64}$/.test(session ?? ''))
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
  const secret = options.secret ?? ENV.cookieSecret;
  if (typeof secret !== 'string' || secret.length < 32) throw unavailable();
  const now = typeof options.now === 'function' ? options.now() : options.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw unavailable();
  return { now: new Date(now.getTime()), secret };
}
function currentNow(options: Options64): Date {
  const n = typeof options.now === 'function' ? options.now() : options.now ?? new Date();
  if (!(n instanceof Date) || !Number.isFinite(n.getTime())) throw unavailable();
  return new Date(n.getTime());
}

/** Cópia own-data antes do reader60 original. Sem getters/ciclos/protos/sparse. */
function copy64(value: unknown): unknown {
  let nodes = 0, characters = 0;
  const stack = new Set<object>();
  const visit = (v: unknown, depth: number): unknown => {
    if (++nodes > 2_000_000 || depth > 18) throw unavailable();
    if (typeof v === 'string') {
      characters += v.length;
      if (characters > 64_000_000) throw unavailable();
      return v;
    }
    if (v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return v;
    if (!v || typeof v !== 'object' || stack.has(v)) throw unavailable();
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw unavailable();
    const props = Object.getOwnPropertyDescriptors(v), keys = Reflect.ownKeys(props);
    if (keys.some(k => typeof k !== 'string')) throw unavailable();
    stack.add(v);
    let result: unknown;
    if (array) {
      const length = props.length?.value;
      if (!Number.isInteger(length) || length < 0 || length >= 20000 || keys.length !== length + 1) throw unavailable();
      result = Array.from({ length }, (_, i) => {
        const d = props[String(i)];
        if (!d?.enumerable || !('value' in d)) throw unavailable();
        return visit(d.value, depth + 1);
      });
    } else {
      const out: Record<string, unknown> = Object.create(null);
      for (const k of keys as string[]) {
        const d = props[k];
        if (!d.enumerable || !('value' in d)) throw unavailable();
        out[k] = visit(d.value, depth + 1);
      }
      result = out;
    }
    stack.delete(v);
    return result;
  };
  return visit(value, 0);
}
// Mantém o contrato do helper original de paginação/count/owner sem executar accessors REST.
function safeRead64(query: () => any, uid: number): Promise<any[]> {
  return listarRegistrosEmprestimos(() => ({
    range: async (start: number, end: number) => copy64(await query().range(start, end)),
  }), uid);
}
async function snapshot64(sb: Client64, uid: number) {
  let captured: unknown;
  const dto = await listarEmprestimosSnapshot60({
    rpc: async (name, args) => {
      // A facade não repete RPC. Somente o reader61 original pode repetir timeout nativo.
      captured = copy64(await sb.rpc(name, args));
      // O reader original recebe exatamente a cópia capturada, não um segundo estado mutável.
      return captured;
    },
  }, uid);
  // Só depois de sucesso integral do mapper original: envelope, TODOS os itens e projeções.
  const raw = (captured as { data: Snapshot60 }).data;
  return { dto, raw };
}
function dailyKey(uid: number, cid: number, tipo: Tipo64, date: string) {
  return `cobranca64:${uid}:${cid}:${tipo}:${date}`;
}
function sign64(payload: Token64, secret: string): string {
  const body = Buffer.from(canonical51(payload)).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(`cobranca64:${body}`).digest('base64url')}`;
}
function decode64(token: string, uid: number, session: string, options: Options64): Token64 {
  const { secret, now } = context64(uid, session, options);
  if (!enviar64Schema.safeParse({ token, confirmar: true }).success) throw invalidToken();
  const parts = token.split('.');
  if (parts.length !== 2 || parts.some(s => !/^[A-Za-z0-9_-]+$/.test(s))) throw invalidToken();
  const expected = createHmac('sha256', secret).update(`cobranca64:${parts[0]}`).digest();
  const received = Buffer.from(parts[1], 'base64url');
  if (received.toString('base64url') !== parts[1] || received.length !== expected.length || !timingSafeEqual(received, expected)) throw invalidToken();
  let payload: Token64;
  try {
    const buffer = Buffer.from(parts[0], 'base64url');
    if (buffer.toString('base64url') !== parts[0]) throw invalidToken();
    payload = tokenSchema.parse(JSON.parse(buffer.toString('utf8')));
  } catch { throw invalidToken(); }
  if (payload.owner !== uid || payload.session !== session || payload.date !== dataHojeBrasilia(now) ||
      payload.exp <= now.getTime() || payload.exp > now.getTime() + TTL) throw invalidToken();
  return payload;
}
const emptyItem = (id: number, motivo = 'Contrato não disponível para esta cobrança.'): PreviewItem64 => ({
  contratoId: id, clienteNome: null, contatoMascarado: null, mensagem: null, token: null, estado: 'ignorado', motivo,
});
const neutral = (cid: number, status: Resultado64['status'], motivo: string, outboxId: string | null = null): Resultado64 => ({
  contratoId: cid, status, motivo, providerMessageId: null, outboxId,
});
function parsedOutbox(raw: unknown, uid: number, keys: readonly string[]): Outbox64 {
  const row = outboxSchema.parse(copy64(raw));
  const key = /^cobranca64:(\d+):(\d+):(atraso|preventivo|vence_hoje):(\d{4}-\d{2}-\d{2})$/.exec(row.chave_deduplicacao);
  if (row.user_id !== uid || !keys.includes(row.chave_deduplicacao) || !key ||
      Number(key[1]) !== uid || key[4] !== row.data_referencia) throw unavailable();
  // PostgreSQL retorna +00:00 e JS retorna Z: o lease exato é o mesmo instante.
  if (row.lease_expira_em !== null) row.lease_expira_em = new Date(row.lease_expira_em).toISOString();
  return row;
}
async function readOutboxes(sb: Client64, uid: number, keys: string[]): Promise<Outbox64[]> {
  if (!keys.length) return [];
  if (keys.length > 20 || new Set(keys).size !== keys.length) throw unavailable();
  // UUID não é identidade aceita pelo helper financeiro antigo. Leitura própria64:
  // o lote inteiro cabe em uma página limitada, count exato confirma ausência/truncamento.
  const response = copy64(await sb.from('whatsapp_outbox')
    .select(columns, { count: 'exact' }).eq('user_id', uid).in('chave_deduplicacao', keys)
    .order('id', { ascending: true }).limit(keys.length).range(0, keys.length - 1));
  const page = z.object({ data: z.array(z.unknown()).max(20), error: z.null(),
    count: z.number().int().min(0).max(keys.length),
    status: z.number().int().min(200).max(299).optional(), statusText: z.string().optional(),
  }).strict().parse(response);
  if (page.data.length !== page.count) throw unavailable();
  const parsed = page.data.map(row => parsedOutbox(row, uid, keys));
  if (new Set(parsed.map(r => r.id)).size !== parsed.length ||
      new Set(parsed.map(r => r.chave_deduplicacao)).size !== parsed.length) throw unavailable();
  return parsed;
}
async function readOne(sb: Client64, uid: number, key: string): Promise<Outbox64 | null> {
  return (await readOutboxes(sb, uid, [key]))[0] ?? null;
}
async function results64(sb: Client64, uid: number, rows: Outbox64[], cids: Map<string, number>, now: Date) {
  const results = new Map<string, Resultado64>();
  const ids = rows.map(row => row.id);
  const byId = new Map(rows.map(row => [row.id, row]));
  const logs = ids.length ? await safeRead64(() => sb.from('notificacoes_log')
    .select('id,user_id,outbox_id,tipo,parcela_id,cliente_id,status', { count: 'exact' }).eq('user_id', uid).in('outbox_id', ids)
    .order('id', { ascending: true }).limit(ids.length), uid) : [];
  if (logs.length > ids.length) throw unavailable();
  const receipts = new Map<string, string>();
  for (const raw of logs) {
    const log = z.object({ id: z.number().int().positive().safe(), user_id: int32_51, outbox_id: z.string().uuid(),
      tipo: z.literal(MANUAL), parcela_id: int32_51, cliente_id: int32_51, status: z.string().max(100),
    }).strict().parse(copy64(raw));
    const owned = byId.get(log.outbox_id);
    if (log.user_id !== uid || !owned || owned.user_id !== uid ||
        log.parcela_id !== owned.parcela_id || log.cliente_id !== owned.cliente_id ||
        receipts.has(log.outbox_id)) throw unavailable();
    receipts.set(log.outbox_id, log.status);
  }
  for (const row of rows) {
    const cid = cids.get(row.chave_deduplicacao);
    if (!cid) throw unavailable();
    const receipt = receipts.get(row.id), pid = row.provider_message_id;
    let result: Resultado64;
    // Entrega/leitura apenas pelo log monotônico do webhook existente, vinculado ao owner/outbox/ID.
    if (pid && (receipt === 'entregue' || receipt === 'lido'))
      result = { contratoId: cid, status: receipt, motivo: 'Recibo registrado pelo provedor.', providerMessageId: pid, outboxId: row.id };
    else if (row.status === 'enviado' && pid)
      result = { contratoId: cid, status: 'aceito_evolution', motivo: 'Aceito pela Evolution; entrega não confirmada.', providerMessageId: pid, outboxId: row.id };
    else if (row.status === 'enviando' && row.lease_expira_em && Date.parse(row.lease_expira_em) > now.getTime())
      result = neutral(cid, 'em_processamento', 'Solicitação em processamento. Não reenvie.', row.id);
    else if (row.status === 'falhou' || row.status === 'cancelado')
      result = neutral(cid, 'nao_solicitado', 'Envio não solicitado. Sem repetição automática neste dia.', row.id);
    else result = neutral(cid, 'desconhecido', 'Resultado não confirmado. Requer conferência manual; não reenvie.', row.id);
    results.set(row.chave_deduplicacao, result);
  }
  return results;
}

async function prepare64(sb: Client64, uid: number, session: string, input: Preparar64, options: Options64, ignoreOutboxId?: string) {
  const { secret, now } = context64(uid, session, options);
  const { dto, raw } = await snapshot64(sb, uid);
  const date = dataHojeBrasilia(now);
  if (raw.dataCalculo !== date) throw unavailable();
  const selected = new Set(input.contratoIds);
  const scoped = raw.items.filter(item => item.kind === 'validated' && selected.has(item.id));
  const cids = new Map(scoped.map(item => [dailyKey(uid, item.id, input.tipo, date), item.id]));
  const rows = (await readOutboxes(sb, uid, [...cids.keys()])).filter(row => row.id !== ignoreOutboxId);
  const registered = await results64(sb, uid, rows, cids, now);
  const items = new Map<number, PreviewItem64>(input.contratoIds.map(id => [id, emptyItem(id)]));
  const candidates: { item: Extract<Snapshot60['items'][number], { kind: 'validated' }>; parcela: Extract<Snapshot60['items'][number], { kind: 'validated' }>['parcelas'][number] }[] = [];
  for (const item of scoped) {
    if (item.kind !== 'validated') continue;
    const key = dailyKey(uid, item.id, input.tipo, date), registro = registered.get(key);
    if (registro) {
      items.set(item.id, { ...emptyItem(item.id), estado: 'registrado', motivo: registro.motivo, registro });
      continue;
    }
    const shown = dto.items.find(row => row.id === item.id);
    if (!shown || shown.kind !== 'validated' || shown.statusObrigacao !== 'ativo' || shown.arquivado ||
        item.estado51.statusObrigacao !== 'ativo' || item.estado51.arquivado || !['ativo', 'inadimplente'].includes(item.contrato.status)) continue;
    const parcela = item.parcelas.filter(p => exigivel51(item.estado51, p.id) &&
      (input.tipo === 'atraso' ? p.data_vencimento < date : input.tipo === 'vence_hoje' ? p.data_vencimento === date : p.data_vencimento > date))
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento) || a.id - b.id)[0];
    if (parcela) candidates.push({ item, parcela });
  }
  const effective = new Map<number, Effective64>();
  if (candidates.length) {
    // Uma consulta batch restrita somente aos clientes selecionados depois do escopo/mapper original.
    const clientIds = [...new Set(candidates.map(c => c.item.cliente.id))];
    const contacts = await safeRead64(() => sb.from('clientes')
      .select('id,user_id,whatsapp,telefone', { count: 'exact' }).eq('user_id', uid).in('id', clientIds)
      .order('id', { ascending: true }).limit(clientIds.length), uid);
    if (contacts.length > clientIds.length) throw unavailable();
    const contactMap = new Map<number, { whatsapp: string | null; telefone: string | null }>();
    for (const rawContact of contacts) {
      const c = z.object({ id: int32_51, user_id: int32_51, whatsapp: z.string().max(80).nullable(), telefone: z.string().max(80).nullable() }).strict().parse(copy64(rawContact));
      if (c.user_id !== uid || !clientIds.includes(c.id) || contactMap.has(c.id)) throw unavailable();
      contactMap.set(c.id, c);
    }
    const configs = await safeRead64(() => sb.from('configuracoes')
      .select('user_id,chave,valor', { count: 'exact' }).eq('user_id', uid).in('chave', CONFIG_KEYS)
      .order('chave', { ascending: true }).limit(CONFIG_KEYS.length), uid);
    if (configs.length > CONFIG_KEYS.length) throw unavailable();
    const cfg: Record<string, string | null> = Object.create(null);
    for (const rawConfig of configs) {
      const c = z.object({ user_id: int32_51, chave: z.enum(['nomeEmpresa', 'assinaturaWhatsapp', 'assinatura_whatsapp']), valor: z.string().max(1000).nullable() }).strict().parse(copy64(rawConfig));
      if (c.user_id !== uid || Object.hasOwn(cfg, c.chave)) throw unavailable();
      cfg[c.chave] = c.valor;
    }
    // Aliases contraditórios não escolhem assinatura silenciosamente.
    if (cfg.assinaturaWhatsapp != null && cfg.assinatura_whatsapp != null && cfg.assinaturaWhatsapp !== cfg.assinatura_whatsapp) throw unavailable();
    for (const { item, parcela } of candidates) {
      const contact = contactMap.get(item.cliente.id);
      let telefone: string;
      try { telefone = normalizarTelefoneWhatsApp(contact?.whatsapp || contact?.telefone || ''); }
      catch { items.set(item.id, emptyItem(item.id, 'Contato não disponível para esta cobrança.')); continue; }
      const proof = item.estado51.parcelas.find(p => p.parcelaId === parcela.id)!;
      const valor = proof.obrigacaoAtual, cents = centavos51(valor).toString();
      const [whole, fraction] = valor.split('.');
      const shownValue = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}`;
      const [year, month, day] = parcela.data_vencimento.split('-');
      const description = input.tipo === 'atraso' ? 'vencida' : input.tipo === 'vence_hoje' ? 'com vencimento hoje' : 'com vencimento futuro';
      const assinatura = cfg.assinaturaWhatsapp ?? cfg.assinatura_whatsapp ?? '';
      // Sem template editável, PIX, juros novos nem cálculo de multa/mora.
      const mensagem = `Olá, ${item.cliente.nome}. ${cfg.nomeEmpresa || 'Empresa'} informa: parcela ${parcela.numero_parcela} do contrato ${item.id}, ${description} (${day}/${month}/${year}). Valor registrado: R$ ${shownValue}. Multa e mora devem ser conferidas na ficha do contrato.${assinatura ? `\n${assinatura}` : ''}`;
      if (mensagem.length > 4000) { items.set(item.id, emptyItem(item.id, 'Mensagem não disponível para esta cobrança.')); continue; }
      // Hash privado da seleção efetiva e estado canônico completo, incluindo todas as irmãs/eventos51.
      const hash = createHash('sha256').update(canonical51({
        uid, contratoId: item.id, tipo: input.tipo, date, contrato: item.contrato, cliente: item.cliente,
        parcelas: item.parcelas, estado51: item.estado51, cotacoes36: item.cotacoes36,
        configuracoesSnapshot: raw.configuracoes, configs: cfg, telefone, mensagem,
        parcelaId: parcela.id, dataVencimento: parcela.data_vencimento, valorRegistradoCentavos: cents,
      })).digest('hex');
      effective.set(item.id, { contratoId: item.id, clienteId: item.cliente.id, parcelaId: parcela.id, telefone, mensagem, hash });
      const token = sign64({ v: 64, owner: uid, session, date, exp: now.getTime() + TTL, contratoId: item.id, tipo: input.tipo, hash }, secret);
      items.set(item.id, { contratoId: item.id, clienteNome: item.cliente.nome, contatoMascarado: `+55 (***) *****-${telefone.slice(-4)}`, mensagem, token, estado: 'pronto', motivo: 'Prévia pronta. Envio depende de confirmação e revalidação.' });
    }
  }
  if (dataHojeBrasilia(currentNow(options)) !== date) throw unavailable();
  return { preview: preview64Schema.parse({ userId: uid, dataReferencia: date, items: input.contratoIds.map(id => items.get(id)!) }), effective };
}

export async function prepararLote64(sb: Client64, uid: number, sessionScope: string, input: Preparar64, options: Options64 = {}): Promise<Preview64> {
  context64(uid, sessionScope, options);
  const parsed = preparar64Schema.safeParse(input);
  if (!parsed.success) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seleção de cobrança inválida.' });
  try { return (await prepare64(sb, uid, sessionScope, parsed.data, options)).preview; }
  catch { throw unavailable(); }
}

async function ownedLease64(sb: Client64, uid: number, expected: Outbox64, now: Date): Promise<boolean> {
  const { data, error } = await sb.from('whatsapp_outbox').select(columns)
    .eq('id', expected.id).eq('user_id', uid).eq('chave_deduplicacao', expected.chave_deduplicacao)
    .eq('status', 'enviando').eq('lease_expira_em', expected.lease_expira_em)
    .gt('lease_expira_em', now.toISOString()).limit(1).maybeSingle();
  if (error || !data) return false;
  const row = parsedOutbox(data, uid, [expected.chave_deduplicacao]);
  return canonical51(row) === canonical51(expected) && row.lease_expira_em !== null && Date.parse(row.lease_expira_em) > now.getTime();
}
async function compensate64(sb: Client64, uid: number, expected: Outbox64, options: Options64) {
  try {
    await sb.from('whatsapp_outbox').update({ status: 'desconhecido', lease_expira_em: null, ultimo_erro: 'PERSISTENCIA_POS_ENVIO_AMBIGUA', updated_at: currentNow(options).toISOString() })
      .eq('id', expected.id).eq('user_id', uid).eq('chave_deduplicacao', expected.chave_deduplicacao)
      .eq('status', 'enviando').eq('lease_expira_em', expected.lease_expira_em);
  } catch { /* Lease expirado será desconhecido pelo cron existente, nunca pendente. */ }
}

export async function enviarItem64(sb: Client64, uid: number, sessionScope: string, token: string, options: Options64 = {}): Promise<Resultado64> {
  const payload = decode64(token, uid, sessionScope, options);
  const cid = payload.contratoId, key = dailyKey(uid, cid, payload.tipo, payload.date);
  let effective: Effective64;
  try {
    const prepared = await prepare64(sb, uid, sessionScope, { contratoIds: [cid], tipo: payload.tipo }, options);
    const item = prepared.preview.items[0];
    if (item.registro) return item.registro; // Reconsulta/daily key, nunca POST por replay.
    const actual = prepared.effective.get(cid);
    if (!actual || actual.hash !== payload.hash) return neutral(cid, 'nao_solicitado', 'Dados alterados ou não confirmados. Prepare novamente.');
    effective = actual;
    decode64(token, uid, sessionScope, options);
  } catch { return neutral(cid, 'nao_solicitado', 'Revalidação indisponível. Nenhuma solicitação de envio.'); }
  const now = currentNow(options), lease = new Date(now.getTime() + LEASE).toISOString(), id = randomUUID();
  const expected: Outbox64 = {
    id, user_id: uid, tipo: MANUAL, chave_deduplicacao: key, data_referencia: payload.date,
    parcela_id: effective.parcelaId, cliente_id: effective.clienteId, status: 'enviando', tentativas: 1,
    lease_expira_em: lease, provider_message_id: null,
  };
  let reserved = false;
  try {
    const { data, error } = await sb.from('whatsapp_outbox').insert({
      ...expected, telefone: effective.telefone, mensagem: effective.mensagem,
      proxima_tentativa_em: now.toISOString(), updated_at: now.toISOString(),
    }).select(columns).limit(1).maybeSingle();
    if (error?.code === '23505') {
      const existing = await readOne(sb, uid, key);
      if (!existing) return neutral(cid, 'desconhecido', 'Conflito sem resultado confirmado. Não reenvie.');
      return (await results64(sb, uid, [existing], new Map([[key, cid]]), currentNow(options))).get(key)!;
    }
    reserved = !error && !!data && canonical51(parsedOutbox(data, uid, [key])) === canonical51(expected);
  } catch { /* Falha de insert não autoriza POST nem nova tentativa. */ }
  if (!reserved) return neutral(cid, 'desconhecido', 'Reserva não confirmada. Não reenvie; reconsulte o resultado.');

  const send = options.dependencies?.enviarMensagemEvolution ?? enviarMensagemEvolution;
  let authorized = false;
  let result: Awaited<ReturnType<typeof enviarMensagemEvolution>>;
  try {
    result = await send(uid, effective.telefone, effective.mensagem, async () => {
      try {
        decode64(token, uid, sessionScope, options);
        if (!(await ownedLease64(sb, uid, expected, currentNow(options)))) return false;
        const fresh = await prepare64(sb, uid, sessionScope, { contratoIds: [cid], tipo: payload.tipo }, options, id);
        if (fresh.effective.get(cid)?.hash !== payload.hash) return false;
        // Última leitura owned lease e validade logo antes do POST da implementação Evolution original.
        const owned = await ownedLease64(sb, uid, expected, currentNow(options));
        decode64(token, uid, sessionScope, options);
        authorized = owned;
        return owned;
      } catch { return false; }
    });
  } catch { result = { ok: false, disposition: authorized ? 'incerto' : 'nao_solicitado' }; }
  const pid = result?.providerMessageId;
  const accepted = authorized && result?.ok === true && result.disposition === 'aceito' &&
    typeof pid === 'string' && pid.length > 0 && pid.length <= 256 && pid === pid.trim();
  const notRequested = !accepted && result?.disposition === 'nao_solicitado';
  const status = accepted ? 'enviado' : notRequested ? 'falhou' : 'desconhecido';
  const code = accepted ? null : notRequested ? 'NAO_SOLICITADO_ANTES_POST' : 'ENVIO_AMBIGUO_RECONCILIACAO_MANUAL';
  const finished = currentNow(options).toISOString();
  let persisted: Outbox64 | null = null;
  try {
    const { data, error } = await sb.from('whatsapp_outbox').update({
      status, lease_expira_em: null, provider_message_id: accepted ? pid! : null,
      ultimo_erro: code, enviado_em: accepted ? finished : null, updated_at: finished,
    }).eq('id', id).eq('user_id', uid).eq('chave_deduplicacao', key).eq('status', 'enviando')
      .eq('lease_expira_em', lease).gt('lease_expira_em', finished).select(columns).limit(1).maybeSingle();
    const expectedFinal = { ...expected, status, lease_expira_em: null, provider_message_id: accepted ? pid! : null };
    if (!error && data && canonical51(parsedOutbox(data, uid, [key])) === canonical51(expectedFinal)) {
      const readback = await readOne(sb, uid, key);
      if (readback && canonical51(readback) === canonical51(expectedFinal)) persisted = readback;
    }
  } catch { /* Ausência de readback exato nunca é aceite fictício. */ }
  if (!persisted) {
    await compensate64(sb, uid, expected, options);
    return neutral(cid, 'desconhecido', 'Persistência não confirmada. Requer conferência manual; não reenvie.', id);
  }
  let historyOK = true;
  try {
    await (options.dependencies?.persistirHistoricoWhatsApp ?? persistirHistoricoWhatsApp)(
      sb as BancoWhatsApp, persisted, accepted ? 'aceito_evolution' : notRequested ? 'erro' : 'desconhecido', code,
    );
  } catch { historyOK = false; }
  if (accepted) return {
    contratoId: cid, status: 'aceito_evolution', providerMessageId: pid!, outboxId: id,
    motivo: historyOK ? 'Aceito pela Evolution; entrega não confirmada.' : 'Aceite registrado na outbox; histórico indisponível. Entrega não confirmada.',
  };
  return neutral(cid, notRequested ? 'nao_solicitado' : 'desconhecido', notRequested
    ? 'Envio não solicitado. Sem repetição automática neste dia.' : 'Resultado não confirmado. Requer conferência manual; não reenvie.', id);
}
