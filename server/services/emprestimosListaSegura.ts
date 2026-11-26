// Endpoint novo, somente leitura. O endpoint estrito, fichas e writers não são alterados.
import { TRPCError } from "@trpc/server";
import { lerProjecaoVinculada51 } from "./obrigacoes51Leitura";
import { apresentarEmprestimo } from "./emprestimosApresentacao";
import { lerCotacoesApresentacaoMulta } from "./multaManualApresentacao";
import { dataHojeBrasilia } from "./businessDate";
import { dataMultimodalValida } from "../../shared/emprestimosMultimodalCalculo";
import { AVISO_LISTA_INCOMPLETA, type ListaSeguraEmprestimos, type EmprestimoValidadoLista, type EmprestimoIndisponivelLista } from "../../shared/emprestimosListaSegura";

type Row = Record<string, any>;
type Client = { from(table: string): any; rpc(name: string, params: Record<string, unknown>): PromiseLike<any> };
const PAGE = 1000, CAP = 20000;
const META_COLLECTOR = 'id, user_id, perfil, ativo';
const META_CONTRATO = 'id, user_id, cliente_id, koletor_id';
const META_CLIENTE = 'id, user_id';
const NOME_CLIENTE = 'id, user_id, nome';
const META_PARCELA = 'id, user_id, contrato_id, cliente_id';
const MONEY_CONTRATO = `${META_CONTRATO}, modalidade, status, valor_principal`;
const MONEY_PARCELA = `${META_PARCELA}, numero_parcela, valor_original, valor_juros, valor_pago, valor_multa, multa_manual, saldo_residual, data_vencimento, data_pagamento, status`;
const CONFIG = 'user_id, chave, valor';
const CONFIG_KEYS = ['jurosMultaAutomatico', 'juros_multa_automatico', 'multaDiaria', 'multa_diaria', 'multaPadrao', 'multa_padrao'];
const unavailable = (id: number): EmprestimoIndisponivelLista => ({ kind: "unavailable", id, message: "Empréstimo indisponível: não foi possível confirmar seus vínculos." });
const failRead = (): never => { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível confirmar a leitura dos empréstimos. Tente novamente." }); };
const failLink = (): never => { throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Não foi possível confirmar o escopo e a integridade desta consulta." }); };
const id = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 2147483647;

/** Copia dados próprios sem executar getters; não aceita colunas fora da projeção. */
function plain(value: unknown, fields: Set<string>): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return failLink();
  const result: Row = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !fields.has(key)) return failLink();
    const d = Object.getOwnPropertyDescriptor(value, key)!;
    if (!d.enumerable || !('value' in d)) return failLink();
    result[key] = d.value;
  }
  return result;
}

/** Nunca retorna páginas truncadas nem sucesso parcial por erro/cap/contagem. */
async function readAll(create: () => any, owner: number | null, projection: string, validate: (r: Row) => boolean): Promise<Row[]> {
  const rows: Row[] = [], seen = new Set<string>(); let total: number | undefined;
  const fields = new Set(projection.split(',').map(s => s.trim()));
  for (let page = 0; page < CAP / PAGE; page++) {
    let response: any;
    try { response = await create().range(page * PAGE, (page + 1) * PAGE - 1); } catch { return failRead(); }
    // SDK normalmente inclui status: capturar também envelopes contraditórios (503/error:null).
    if (!response || response.error !== null || !Array.isArray(response.data) || !Number.isInteger(response.count) || response.count < 0 || response.count >= CAP ||
      (response.status !== undefined && (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300)) ||
      (total !== undefined && response.count !== total) || response.data.length !== Math.min(PAGE, response.count - rows.length)) return failRead();
    total = response.count;
    for (const value of response.data) {
      const row = plain(value, fields);
      if (owner !== null && row.user_id !== owner) return failLink();
      const key = fields.has('id') ? id(row.id) ? `id:${row.id}` : null : typeof row.chave === 'string' ? `key:${row.chave}` : null;
      if (!key || seen.has(key) || !validate(row)) return failLink();
      seen.add(key); rows.push(row);
    }
    if (rows.length === total) return rows;
  }
  return failRead();
}
function sameMetadata(a: Row[], b: Row[], fields: string[]): boolean {
  if (a.length !== b.length) return false;
  const map = new Map(b.map(r => [r.id, r]));
  return a.every(r => { const s = map.get(r.id); return !!s && fields.every(k => Object.hasOwn(r, k) && Object.hasOwn(s, k) && r[k] === s[k]); });
}
function cents(v: unknown): number {
  if (typeof v !== 'number' && typeof v !== 'string') return failLink();
  const text = String(v);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return failLink();
  const [whole, part = ''] = text.split('.'), n = BigInt(whole) * 100n + BigInt(part.padEnd(2, '0'));
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) return failLink();
  return Number(n);
}
function sumSafe(a: number, b: number): number { const s = a + b; if (!Number.isSafeInteger(s) || s < 0) return failLink(); return s; }

/** Fanout fixo: aguarda chamadas iniciadas; nenhuma resposta parcial após falha. */
async function eachBounded(ids: number[], run: (cid: number) => Promise<void>): Promise<void> {
  let next = 0, failed = false, error: unknown;
  async function worker() {
    while (!failed && next < ids.length) {
      const cid = ids[next++];
      try { await run(cid); }
      catch (e) { if (!failed) { failed = true; error = e; } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, ids.length) }, () => worker()));
  if (failed) throw error;
}

/** Sem filtros/IDs fornecidos pelo caller: placeholders não podem ser escondidos por busca. */
export async function listarEmprestimosSeguros(client: Client | null | undefined, userId: unknown, hoje = dataHojeBrasilia()): Promise<ListaSeguraEmprestimos> {
  if (!id(userId)) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
  if (!dataMultimodalValida(hoje)) return failLink();
  if (!client) return failRead();
  const db = client;
  const own = (create: () => any, projection: string, validate: (r: Row) => boolean = () => true) => readAll(create, userId, projection, validate);
  const collectorQuery = () => db.from('koletores').select(META_COLLECTOR, { count: 'exact' }).eq('user_id', userId).eq('ativo', true).order('id');
  const collectorValid = (r: Row) => r.ativo === true && ['koletor', 'admin', 'gerente'].includes(r.perfil);
  // PRIMEIRA consulta: mesmo filtro de cadastro próprio ativo; >1 não remove o escopo.
  const collectors = await own(collectorQuery, META_COLLECTOR, collectorValid);
  if (collectors.length > 1) return failLink();
  const collectorId: number | null = collectors[0]?.perfil === 'koletor' ? collectors[0].id : null;
  const contractQuery = (projection: string, ids?: number[]) => {
    let q = db.from('contratos').select(projection, { count: 'exact' }).eq('user_id', userId);
    if (collectorId !== null) q = q.eq('koletor_id', collectorId);
    if (ids) q = q.in('id', ids);
    return q.order('id');
  };
  const contractValid = (r: Row) => Object.hasOwn(r, 'cliente_id') && Object.hasOwn(r, 'koletor_id') && (collectorId === null || r.koletor_id === collectorId);
  // Nenhum principal, nome, contato ou etiqueta antes da prova de vínculos.
  const contracts = await own(() => contractQuery(META_CONTRATO), META_CONTRATO, contractValid);
  const contractIds = contracts.map(c => c.id), byId = new Map(contracts.map(c => [c.id, c]));
  const customerIds = [...new Set(contracts.map(c => c.cliente_id).filter(id))], customerSet = new Set(customerIds);
  const customerQuery = (projection: string, ids: number[]) => db.from('clientes').select(projection, { count: 'exact' }).eq('user_id', userId).in('id', ids).order('id');
  const customers = customerIds.length ? await own(() => customerQuery(META_CLIENTE, customerIds), META_CLIENTE, r => customerSet.has(r.id)) : [];
  const customersById = new Map(customers.map(c => [c.id, c]));
  const parcelQuery = (ids: number[]) => db.from('parcelas').select(META_PARCELA, { count: 'exact' }).in('contrato_id', ids).order('id');
  // ÚNICA exceção ao owner: SÓ quatro metadados sob pais já próprios confirmados.
  // Owner desconhecido nunca é ignorado: torna o contrato OWN indisponível. Pai fora da seleção => falha GLOBAL.
  const metadataRead = (ids: number[]) => {
    const allowed = new Set(ids);
    return readAll(() => parcelQuery(ids), null, META_PARCELA, r => allowed.has(r.contrato_id) && byId.has(r.contrato_id) && Object.hasOwn(r, 'user_id') && Object.hasOwn(r, 'cliente_id'));
  };
  const parcelMeta = contractIds.length ? await metadataRead(contractIds) : [];
  const bad = new Set<number>();
  for (const c of contracts) if (!id(c.cliente_id) || !customersById.has(c.cliente_id)) bad.add(c.id);
  for (const p of parcelMeta) if (p.user_id !== userId || !id(p.cliente_id) || p.cliente_id !== byId.get(p.contrato_id)!.cliente_id) bad.add(p.contrato_id);
  const safeIds = contractIds.filter(cid => !bad.has(cid)), safeSet = new Set(safeIds);
  const safeCustomers = [...new Set(safeIds.map(cid => byId.get(cid)!.cliente_id))], safeCustomerSet = new Set(safeCustomers);
  const safeMeta = parcelMeta.filter(p => safeSet.has(p.contrato_id)), safeMetaById = new Map(safeMeta.map(p => [p.id, p]));
  const details: Row[] = [], parcels: Row[] = [];
  await eachBounded(safeIds, async cid => {
    const parent = byId.get(cid)!, expected = safeMeta.filter(p => p.contrato_id === cid), expectedIds = expected.map(p => p.id);
    // Reduz a janela antes da leitura, sem alegar snapshot ou lock transacional.
    const parentNow = await own(() => contractQuery(META_CONTRATO, [cid]).eq('cliente_id', parent.cliente_id), META_CONTRATO, r => r.id === cid && contractValid(r));
    if (!sameMetadata([parent], parentNow, ['id', 'user_id', 'cliente_id', 'koletor_id']) || !sameMetadata(expected, await metadataRead([cid]), ['id', 'user_id', 'contrato_id', 'cliente_id'])) return failLink();
    const money = await own(() => contractQuery(MONEY_CONTRATO, [cid]).eq('cliente_id', parent.cliente_id), MONEY_CONTRATO, r => r.id === cid && contractValid(r) && r.cliente_id === parent.cliente_id);
    if (!sameMetadata([parent], money, ['id', 'user_id', 'cliente_id', 'koletor_id'])) return failLink();
    details.push(...money);
    if (expectedIds.length) parcels.push(...await own(() => db.from('parcelas').select(MONEY_PARCELA, { count: 'exact' })
      .eq('user_id', userId).in('contrato_id', [cid]).eq('cliente_id', parent.cliente_id).in('id', expectedIds).order('data_vencimento').order('id'), MONEY_PARCELA,
      r => { const m = safeMetaById.get(r.id); return !!m && r.contrato_id === cid && r.cliente_id === parent.cliente_id && r.user_id === m.user_id && r.contrato_id === m.contrato_id && r.cliente_id === m.cliente_id; }));
  });
  if (parcels.length !== safeMeta.length) return failLink();
  const names = safeCustomers.length ? await own(() => customerQuery(NOME_CLIENTE, safeCustomers), NOME_CLIENTE, r => safeCustomerSet.has(r.id) && typeof r.nome === 'string') : [];
  if (names.length !== safeCustomers.length) return failLink();
  const namesById = new Map(names.map(c => [c.id, c]));
  const groups = new Map<number, Row[]>(); for (const p of parcels) { const group = groups.get(p.contrato_id) ?? []; group.push(p); groups.set(p.contrato_id, group); }
  let daily = 0, percentage = 0;
  if (safeIds.length) {
    const configs = await own(() => db.from('configuracoes').select(CONFIG, { count: 'exact' }).eq('user_id', userId).in('chave', CONFIG_KEYS).order('chave'), CONFIG, r => CONFIG_KEYS.includes(r.chave) && Object.hasOwn(r, 'valor'));
    const values = Object.fromEntries(configs.map(r => [r.chave, r.valor ?? '']));
    if (values.jurosMultaAutomatico === 'true' || values.juros_multa_automatico === 'true') {
      const d = Number.parseFloat(values.multaDiaria ?? values.multa_diaria ?? '0'), p = Number.parseFloat(values.multaPadrao ?? values.multa_padrao ?? '0');
      daily = Number.isFinite(d) && d > 0 ? d : 0; percentage = Number.isFinite(p) && p > 0 ? p : 0;
    }
  }
  const validatedById = new Map<number, EmprestimoValidadoLista>(); let capitalCents = 0, receiveCents = 0, paidCents = 0;
  for (const c of details) {
    if (typeof c.status !== 'string' || typeof c.modalidade !== 'string') return failLink();
    const ps = groups.get(c.id) ?? [];
    const quotes = await lerCotacoesApresentacaoMulta(db, userId, c.id, ps as any, hoje, async () => {
      const review = await metadataRead([c.id]);
      if (!sameMetadata(safeMeta.filter(p => p.contrato_id === c.id), review, ['id', 'user_id', 'contrato_id', 'cliente_id'])) return failLink();
      return review as any;
    });
    const estado51 = await lerProjecaoVinculada51(db, userId, c.id, safeMeta.filter(p => p.contrato_id === c.id).map(p => ({ id: p.id, user_id: p.user_id, contrato_id: p.contrato_id, cliente_id: p.cliente_id })), async () => {
      const review = await metadataRead([c.id]);
      if (!sameMetadata(safeMeta.filter(p => p.contrato_id === c.id), review, ['id', 'user_id', 'contrato_id', 'cliente_id'])) return failLink();
      return review.map(p => ({ id: p.id, user_id: p.user_id, contrato_id: p.contrato_id, cliente_id: p.cliente_id }));
    });
    // Reuso da apresentação corrente; não adota dívida nem reconstrói fórmula financeira.
    const presentation = apresentarEmprestimo(c as any, ps as any[], hoje, daily, percentage, quotes, estado51), capital = cents(c.valor_principal);
    capitalCents = sumSafe(capitalCents, capital); receiveCents = sumSafe(receiveCents, cents(presentation.totalReceber)); paidCents = sumSafe(paidCents, cents(presentation.totalPago));
    validatedById.set(c.id, { kind: 'validated', id: c.id, clienteId: c.cliente_id, clienteNome: namesById.get(c.cliente_id)!.nome,
      modalidade: c.modalidade, status: presentation.status!, statusFinanceiroOriginal: c.status, statusObrigacao: estado51.statusObrigacao,
      arquivado: estado51.arquivado, obrigacaoAdicional: estado51.obrigacaoAdicional, obrigacaoAtual: presentation.obrigacaoAtual!,
      capital: capital / 100, totalReceber: presentation.totalReceber, totalPago: presentation.totalPago });
  }
  // Mudanças observáveis invalidam TODA a resposta. Não elimina TOCTOU/ABA sem SQL transacional.
  const collectorsFinal = await own(collectorQuery, META_COLLECTOR, collectorValid);
  const contractsFinal = await own(() => contractQuery(META_CONTRATO), META_CONTRATO, contractValid);
  const customersFinal = customerIds.length ? await own(() => customerQuery(META_CLIENTE, customerIds), META_CLIENTE, r => customerSet.has(r.id)) : [];
  const parcelsFinal = contractIds.length ? await metadataRead(contractIds) : [];
  if (!sameMetadata(collectors, collectorsFinal, ['id', 'user_id', 'perfil', 'ativo']) || !sameMetadata(contracts, contractsFinal, ['id', 'user_id', 'cliente_id', 'koletor_id']) ||
    !sameMetadata(customers, customersFinal, ['id', 'user_id']) || !sameMetadata(parcelMeta, parcelsFinal, ['id', 'user_id', 'contrato_id', 'cliente_id'])) return failLink();
  const complete = bad.size === 0;
  return { version: 'loan_list_read_v1', userId, items: contracts.map(c => bad.has(c.id) ? unavailable(c.id) : validatedById.get(c.id)!),
    coverage: { scopedContracts: contracts.length, validatedContracts: safeIds.length, unavailableContracts: bad.size, complete, label: 'validados somente' },
    totals: { label: 'validados somente', values: !safeIds.length && contracts.length ? null : { capital: capitalCents / 100, totalReceber: receiveCents / 100, totalPago: paidCents / 100 } },
    warning: complete ? null : AVISO_LISTA_INCOMPLETA };
}
