// Lista60: uma única RPC de leitura; não autoriza operações financeiras.
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { projection51 } from '../../shared/obrigacoes51';
import { validarProjecao51 } from '../../shared/obrigacoes51Projection';
import { normalizarCotacaoMulta, type CotacaoMulta } from '../../shared/multaManual';
import { dataMultimodalValida } from '../../shared/emprestimosMultimodalCalculo';
import { apresentarEmprestimo } from './emprestimosApresentacao';
import { AVISO_LISTA_INCOMPLETA, type ListaSeguraEmprestimos } from '../../shared/emprestimosListaSegura';

export const RPC60 = 'rpc_lista_emprestimos60';
export const LOCAL_REASONS60 = [
  'local_link_unconfirmed',
  '51 vínculos próprios completos obrigatórios; sem saneamento',
  '51 obrigação registrada ambígua',
  '51 valores registrados inválidos',
  '51 residual parcial ambíguo',
  '51 aliases/baixa registrada ambíguos',
] as const;
export const CONFIG_KEYS60 = ['jurosMultaAutomatico', 'juros_multa_automatico', 'multaDiaria', 'multa_diaria', 'multaPadrao', 'multa_padrao'] as const;
const int32 = z.number().int().positive().max(2147483647);
const money = z.string().regex(/^(0|[1-9][0-9]{0,12})\.[0-9]{2}$/);
const day = z.string().refine(dataMultimodalValida);
const contrato = z.object({ id: int32, user_id: int32, cliente_id: int32, koletor_id: int32.nullable(), modalidade: z.string(), status: z.string(), valor_principal: money }).strict();
const cliente = z.object({ id: int32, user_id: int32, nome: z.string() }).strict();
const parcela = z.object({ id: int32, user_id: int32, contrato_id: int32, cliente_id: int32,
  numero_parcela: z.number().int().positive(), valor_original: money, valor_juros: money.nullable(),
  valor_pago: money.nullable(), valor_multa: money.nullable(), multa_manual: money.nullable(), saldo_residual: money.nullable(),
  data_vencimento: day, data_pagamento: day.nullable(), status: z.string(),
}).strict();
const valid = z.object({ kind: z.literal('validated'), id: int32, contrato, cliente, parcelas: z.array(parcela).max(19999), estado51: projection51,
  cotacoes36: z.array(z.unknown()).max(19999).nullable(),
}).strict();
const unavailable = z.object({ kind: z.literal('unavailable'), id: int32, reason: z.enum(LOCAL_REASONS60) }).strict();
const dto = z.object({ versao: z.literal('lista_emprestimos60_v1'), userId: int32, dataCalculo: day,
  items: z.array(z.discriminatedUnion('kind', [valid, unavailable])).max(19999),
  configuracoes: z.array(z.object({ user_id: int32, chave: z.enum(CONFIG_KEYS60), valor: z.string().nullable() }).strict()).max(6),
}).strict();
export type Snapshot60 = z.infer<typeof dto>;
export type Client60 = { rpc(name: string, args: Record<string, unknown>): PromiseLike<unknown> };
const linkFail = (): never => { throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Não foi possível confirmar o escopo e a integridade desta consulta.' }); };
const readFail = (): never => { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Não foi possível confirmar a leitura dos empréstimos. Tente novamente.' }); };

// Snapshot copiado antes de Zod/callbacks; não executa getters, não aceita ciclos/sparse/protos.
// Não reutiliza jsonMultimodalSeguro de 2048 nós: uma carteira completa excede esse teto.
function copyJson(value: unknown): unknown {
  const stack = new Set<object>(); let nodes = 0;
  function visit(v: unknown, depth: number): unknown {
    if (++nodes > 2000000 || depth > 16) return linkFail();
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (!v || typeof v !== 'object' || stack.has(v)) return linkFail();
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v);
    if (array ? proto !== Array.prototype : ![Object.prototype, null].includes(proto)) return linkFail();
    const props = Object.getOwnPropertyDescriptors(v), keys = Reflect.ownKeys(props);
    if (keys.some(k => typeof k !== 'string')) return linkFail();
    stack.add(v);
    let result: unknown;
    if (array) {
      const n = props.length?.value;
      if (!Number.isInteger(n) || n < 0 || n >= 20000 || keys.length !== n + 1) return linkFail();
      result = Array.from({ length: n }, (_, i) => {
        const p = props[String(i)]; if (!p?.enumerable || !('value' in p)) return linkFail();
        return visit(p.value, depth + 1);
      });
    } else {
      const out: Record<string, unknown> = Object.create(null);
      for (const k of keys as string[]) {
        const p = props[k]; if (!p.enumerable || !('value' in p)) return linkFail();
        out[k] = visit(p.value, depth + 1);
      }
      result = out;
    }
    stack.delete(v); return result;
  }
  try { return visit(value, 0); } catch { return linkFail(); }
}
function cents(value: string | number): number {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return linkFail();
  const [w, p = ''] = text.split('.'), n = BigInt(w) * 100n + BigInt(p.padEnd(2, '0'));
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) return linkFail(); return Number(n);
}
function sum(a: number, b: number): number { const n = a + b; if (!Number.isSafeInteger(n) || n < 0) return linkFail(); return n; }

/** Retorna o DTO público existente; sem autorização/writer ou leitura adicional. */
export function mapearSnapshot60(raw: unknown, owner: number): ListaSeguraEmprestimos {
  if (!int32.safeParse(owner).success) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
  let s: Snapshot60;
  try { s = dto.parse(copyJson(raw)); } catch { return linkFail(); }
  if (s.userId !== owner) return linkFail();
  const ids = new Set<number>(), parcelIds = new Set<number>(), configSeen = new Set<string>();
  const cfg: Record<string, string> = Object.create(null);
  for (const row of s.configuracoes) {
    if (row.user_id !== owner || configSeen.has(row.chave)) return linkFail();
    configSeen.add(row.chave); cfg[row.chave] = row.valor ?? '';
  }
  let daily = 0, percentage = 0;
  if (cfg.jurosMultaAutomatico === 'true' || cfg.juros_multa_automatico === 'true') {
    const d = Number.parseFloat(cfg.multaDiaria ?? cfg.multa_diaria ?? '0');
    const p = Number.parseFloat(cfg.multaPadrao ?? cfg.multa_padrao ?? '0');
    daily = Number.isFinite(d) && d > 0 ? d : 0; percentage = Number.isFinite(p) && p > 0 ? p : 0;
  }
  let validated = 0, unavailableCount = 0, capital = 0, receive = 0, paid = 0;
  const items: ListaSeguraEmprestimos['items'] = [];
  for (const item of s.items) {
    if (ids.has(item.id)) return linkFail(); ids.add(item.id);
    if (item.kind === 'unavailable') {
      unavailableCount++;
      items.push({ kind: 'unavailable', id: item.id, message: 'Empréstimo indisponível: não foi possível confirmar seus vínculos.' });
      continue;
    }
    const c = item.contrato, cli = item.cliente, ps = item.parcelas;
    if (c.id !== item.id || c.user_id !== owner || cli.user_id !== owner || cli.id !== c.cliente_id) return linkFail();
    for (const p of ps) {
      if (p.user_id !== owner || p.contrato_id !== c.id || p.cliente_id !== c.cliente_id || parcelIds.has(p.id)) return linkFail();
      parcelIds.add(p.id); if (parcelIds.size >= 20000) return linkFail();
    }
    // Relações provadas pelo SQL; APP detecta divergência de mapeamento/seleção no mesmo DTO.
    let state;
    try { state = validarProjecao51(item.estado51, owner, c.id, ps.map(p => p.id)); } catch { return linkFail(); }
    let quotes: Map<number, CotacaoMulta> | null = null;
    if (item.cotacoes36 !== null) {
      if (!ps.length || item.cotacoes36.length !== ps.length) return linkFail();
      quotes = new Map(); let hash: string | undefined, account: number | undefined;
      const selection = new Set(ps.map(p => p.id));
      for (const rawQuote of item.cotacoes36) {
        // rawQuote já foi copiado, não tem accessor/proto; normalizer preserva invariantes36.
        const pid = (rawQuote as Record<string, unknown>)?.parcelaId;
        if (typeof pid !== 'number' || !selection.has(pid) || quotes.has(pid)) return linkFail();
        let q: CotacaoMulta;
        try { q = normalizarCotacaoMulta(rawQuote, { contratoId: c.id, parcelaId: pid }); } catch { return linkFail(); }
        if (q.dataPagamento !== s.dataCalculo || (hash !== undefined && hash !== q.estadoHash) || (account !== undefined && account !== q.contaCaixaId)) return linkFail();
        hash = q.estadoHash; account = q.contaCaixaId; quotes.set(pid, q);
      }
    }
    // Ordem de apresentação equivalente ao REST anterior (vencimento,id), sem mutar seleção.
    const ordered = [...ps].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento) || a.id - b.id);
    const shown = apresentarEmprestimo(c, ordered, s.dataCalculo, daily, percentage, quotes, state);
    const cCents = cents(c.valor_principal);
    capital = sum(capital, cCents); receive = sum(receive, cents(shown.totalReceber)); paid = sum(paid, cents(shown.totalPago));
    validated++;
    items.push({ kind: 'validated', id: c.id, clienteId: cli.id, clienteNome: cli.nome,
      modalidade: c.modalidade, status: shown.status!, statusFinanceiroOriginal: c.status,
      statusObrigacao: state.statusObrigacao, arquivado: state.arquivado, obrigacaoAdicional: state.obrigacaoAdicional,
      obrigacaoAtual: shown.obrigacaoAtual!, capital: cCents / 100, totalReceber: shown.totalReceber, totalPago: shown.totalPago });
  }
  const complete = unavailableCount === 0;
  return { version: 'loan_list_read_v1', userId: owner, items,
    coverage: { scopedContracts: items.length, validatedContracts: validated, unavailableContracts: unavailableCount, complete, label: 'validados somente' },
    totals: { label: 'validados somente', values: !validated && items.length ? null : { capital: capital / 100, totalReceber: receive / 100, totalPago: paid / 100 } },
    warning: complete ? null : AVISO_LISTA_INCOMPLETA };
}

/** Serviço de uma única RPC. Erro SQL/network nunca vira placeholder ou snapshot vazio. */
export async function listarEmprestimosSnapshot60(client: Client60 | null | undefined, owner: unknown): Promise<ListaSeguraEmprestimos> {
  if (!int32.safeParse(owner).success) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
  if (!client) return readFail();
  let response;
  try { response = await client.rpc(RPC60, { p_user_id: owner }); } catch { return readFail(); }
  let envelope: { data: unknown; error: unknown; status?: number; statusText?: string; count?: null; success?: boolean };
  try { envelope = z.object({ data: z.unknown(), error: z.unknown(), status: z.number().int().min(200).max(299).optional(), statusText: z.string().optional(), count: z.null().optional(), success: z.literal(true).optional() }).strict().parse(copyJson(response)); }
  catch { return readFail(); }
  if (!Object.hasOwn(envelope, 'data') || !Object.hasOwn(envelope, 'error') || envelope.error !== null || envelope.data === null) return readFail();
  return mapearSnapshot60(envelope.data, owner as number);
}
