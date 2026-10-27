import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { veiculosRouter } from "./routers/veiculos";
import { assinaturasRouter } from "./routers/assinaturas";
import { backupRouter } from "./routers/backup";
import { whatsappEvolutionRouter } from "./routers/whatsappEvolution";
import { perfilRouter } from "./routers/perfil";
import { relatorioDiarioRouter } from "./routers/relatorioDiario";
import { notificacoesRouter } from "./routers/notificacoes";
import { blacklistRouter } from "./routers/blacklist";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb, getSupabaseClientAsync, resetDb } from "./db";
import { TRPCError } from "@trpc/server";
import {
  clientes, contratos, parcelas, contasCaixa, transacoesCaixa, magicLinks, templatesWhatsapp,
  koletores, configuracoes, contasPagar, produtos, cheques, contratoHistorico
} from "../drizzle/schema";
import { eq, and, sql, desc, gte, lte, lt, gt, isNull, or, inArray, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { calcularJurosMora, calcularParcelaPadrao, calcularParcelaDiario, calcularParcelasPrice, calcularParcelaBullet, getDiasModalidade, calcularSaldoResidual, calcularValorAbertoParcela } from "../shared/finance";
import { calcularSaldoAtual } from "../shared/caixa";
import { adicionarDiasData, dataCivilBrasiliaParaIso, dataHojeBrasilia, diferencaDiasData } from "./services/businessDate";
import { concluirOperacaoFinanceira, criarChaveIdempotencia, falharOperacaoFinanceira, registrarAuditoriaFinanceira, reservarOperacaoFinanceira, validarClienteDoUsuario, validarContaDoUsuario } from "./services/operacoesFinanceiras";
import { executarEfeitosPosConfirmacao } from "./services/efeitosPosConfirmacaoFinanceira";
import { compensarRenovacaoJuros } from "./services/renovacaoJurosCompensacao";
import { gerarConferenciaCaixa } from "./services/conferenciaCaixa";
import { criarDesembolsoContrato, deveRegistrarDesembolso } from "./caixaDesembolso";
import { deveRepetirSemPeriodicidade } from "./contasPagarSchemaFallback";
import { dataPagamentoParaBanco, statusPodeSerPago } from "./contasPagarPagamento";
import { idsDuplicadosParaRemocao } from "./caixaDuplicidades";
import { deveRepetirComStatusPagoLegado, normalizarStatusContaPagar, statusContaPaga } from "./contasPagarStatus";
import { podeRegistrarMovimento } from "./financeIdempotency";
import { montarHtmlContrato } from "./utils/contratoHtml";
import { candidatosTokenPortal, consumirLinkPortalNoSupabase, hashTokenPortal, normalizarParcelasPortal } from "./services/portalLinks";

function contaPagarPodeSerProcessada(status: string | null | undefined): boolean {
  return status === "pendente" || status === "atrasada";
}

function descricaoPagamentoConta(id: number, descricao: string): string {
  return `Pagamento da conta #${id}: ${descricao}`;
}

function descricaoEstornoConta(id: number, descricao: string): string {
  return `Estorno da conta #${id}: ${descricao}`;
}

async function marcarContaPagaComCompatibilidade(supabase: any, id: number, userId: number, dataPagamento: string, contaCaixaId: number) {
  const payload = { data_pagamento: dataPagamento, conta_caixa_id: contaCaixaId };
  let resultado = await supabase.from('contas_pagar').update({ ...payload, status: 'paga' })
    .eq('id', id).eq('user_id', userId).in('status', ['pendente', 'atrasada'])
    .select('id, status').maybeSingle();

  // Instalações antigas possuem um CHECK que aceita `pago`, não `paga`.
  // O primeiro UPDATE falha antes de alterar a linha; repetir é seguro e não duplica Caixa.
  if (resultado.error && deveRepetirComStatusPagoLegado(resultado.error)) {
    resultado = await supabase.from('contas_pagar').update({ ...payload, status: 'pago' })
      .eq('id', id).eq('user_id', userId).in('status', ['pendente', 'atrasada'])
      .select('id, status').maybeSingle();
  }
  return resultado;
}

async function listarTransacoesCaixaDoUsuario(supabase: any, userId: number): Promise<any[]> {
  const todas: any[] = [];
  const tamanhoPagina = 1000;
  for (let pagina = 0; pagina < 100; pagina++) {
    const inicio = pagina * tamanhoPagina;
    const { data, error } = await supabase.from('transacoes_caixa')
      .select('conta_caixa_id, tipo, valor')
      .eq('user_id', userId)
      .range(inicio, inicio + tamanhoPagina - 1);
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    const lote = data ?? [];
    todas.push(...lote);
    if (lote.length < tamanhoPagina) break;
  }
  return todas;
}

/** Limite intencional da conferência manual, para não sobrecarregar a API. */
async function listarRegistrosParaConferencia(
  supabase: any,
  tabela: string,
  colunas: string,
  userId: number,
  configurar?: (query: any) => any,
): Promise<{ registros: any[]; truncado: boolean }> {
  const registros: any[] = [];
  const tamanhoPagina = 1000;
  const maxPaginas = 20;
  let truncado = true;

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    let query = supabase.from(tabela).select(colunas).eq('user_id', userId)
      .range(pagina * tamanhoPagina, (pagina + 1) * tamanhoPagina - 1);
    if (configurar) query = configurar(query);
    const { data, error } = await query;
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    const lote = data ?? [];
    registros.push(...lote);
    if (lote.length < tamanhoPagina) {
      truncado = false;
      break;
    }
  }
  return { registros, truncado };
}

// ─── HELPER: REGISTRAR HISTÓRICO ───────────────────────────────────────────
async function registrarHistorico(params: {
  contratoId: number;
  userId: string;
  tipo: 'edicao_juros' | 'aplicacao_multa' | 'edicao_parcela' | 'edicao_contrato' | 'pagamento' | 'pagamento_juros' | 'reparcelamento' | 'criacao';
  descricao: string;
  valorAnterior?: string;
  valorNovo?: string;
}): Promise<{ ok: boolean; erro?: string }> {
  try {
    const sb = await getSupabaseClientAsync();
    if (!sb) return { ok: false, erro: "Banco de dados indisponível" };
    const { error } = await sb.from('contrato_historico').insert({
      contrato_id: params.contratoId,
      user_id: params.userId,
      tipo: params.tipo,
      descricao: params.descricao,
      valor_anterior: params.valorAnterior ?? null,
      valor_novo: params.valorNovo ?? null,
    });
    if (error) {
      console.warn('[registrarHistorico] Falha ao registrar histórico:', error.message);
      return { ok: false, erro: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.warn('[registrarHistorico] Falha ao registrar histórico:', e);
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
const dashboardRouter = router({
  kpis: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const supabase = await getSupabaseClientAsync();
    
    if (db) {
      // Use Drizzle ORM if available
      const hojeStr = dataHojeBrasilia();
      const inicioHoje = new Date(dataCivilBrasiliaParaIso(hojeStr));
      const inicioAmanha = new Date(dataCivilBrasiliaParaIso(adicionarDiasData(hojeStr, 1)));

      const contas = await db.select().from(contasCaixa).where(and(eq(contasCaixa.ativo, true), eq(contasCaixa.userId, ctx.user.id)));
      let saldoTotal = 0;
      for (const conta of contas) {
        const entradas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
          .from(transacoesCaixa)
          .where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, 'entrada')));
        const saidas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
          .from(transacoesCaixa)
          .where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, 'saida')));
        saldoTotal += calcularSaldoAtual(conta.saldo, [
          { tipo: 'entrada', valor: entradas[0]?.total },
          { tipo: 'saida', valor: saidas[0]?.total },
        ]);
      }

      const capitalResult = await db.select({ total: sql<string>`COALESCE(SUM(valor_principal), 0)` })
        .from(contratos).where(and(eq(contratos.status, 'ativo'), eq(contratos.userId, ctx.user.id)));
      const capitalCirculacao = parseFloat(capitalResult[0]?.total ?? '0');

      const receberResult = await db.select({ total: sql<string>`COALESCE(SUM(CASE WHEN status = 'parcial' AND COALESCE(saldo_residual, 0) > 0 THEN saldo_residual ELSE valor_original + COALESCE(saldo_residual, 0) + COALESCE(valor_multa, 0) END), 0)` })
        .from(parcelas).where(and(inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje', 'parcial']), eq(parcelas.userId, ctx.user.id)));
      const totalReceber = parseFloat(receberResult[0]?.total ?? '0');

      const inadResult = await db.select({ total: sql<string>`COALESCE(SUM(valor_original), 0)`, qtd: sql<number>`COUNT(DISTINCT cliente_id)` })
        .from(parcelas).where(and(eq(parcelas.status, 'atrasada'), eq(parcelas.userId, ctx.user.id)));
      const totalInadimplente = parseFloat(inadResult[0]?.total ?? '0');
      const qtdInadimplentes = inadResult[0]?.qtd ?? 0;

      const jurosResult = await db.select({ total: sql<string>`COALESCE(SUM(valor_juros), 0)` })
        .from(parcelas).where(and(inArray(parcelas.status, ['atrasada', 'parcial']), eq(parcelas.userId, ctx.user.id)));
      const jurosPendentes = parseFloat(jurosResult[0]?.total ?? '0');

      const hojeResult = await db.select({ total: sql<string>`COALESCE(SUM(valor_original), 0)`, qtd: sql<number>`COUNT(*)` })
        .from(parcelas).where(and(
          eq(sql`DATE(data_vencimento)`, hojeStr),
          inArray(parcelas.status, ['pendente', 'vencendo_hoje']),
          eq(parcelas.userId, ctx.user.id)
        ));
      const qtdVenceHoje = hojeResult[0]?.qtd ?? 0;
      const valorVenceHoje = parseFloat(hojeResult[0]?.total ?? '0');

      const recebidoResult = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
        .from(transacoesCaixa).where(and(
          eq(transacoesCaixa.tipo, 'entrada'),
          eq(transacoesCaixa.categoria, 'pagamento_parcela'),
          gte(transacoesCaixa.dataTransacao, inicioHoje),
          lt(transacoesCaixa.dataTransacao, inicioAmanha),
          eq(transacoesCaixa.userId, ctx.user.id)
        ));
      const recebidoHoje = parseFloat(recebidoResult[0]?.total ?? '0');

      const contratosResult = await db.select({ qtd: sql<number>`COUNT(*)` })
        .from(contratos).where(and(eq(contratos.status, 'ativo'), eq(contratos.userId, ctx.user.id)));
      const contratosAtivos = contratosResult[0]?.qtd ?? 0;

      return {
        saldoTotal, capitalCirculacao, totalReceber, totalInadimplente,
        qtdInadimplentes, jurosPendentes, qtdVenceHoje, valorVenceHoje,
        recebidoHoje, contratosAtivos
      };
    }
    
    // Fallback to Supabase REST API
    if (!supabase) return { saldoTotal: 0, capitalCirculacao: 0, totalReceber: 0, totalInadimplente: 0, qtdInadimplentes: 0, jurosPendentes: 0, qtdVenceHoje: 0, valorVenceHoje: 0, recebidoHoje: 0, contratosAtivos: 0 };
    
    const hojeStr = dataHojeBrasilia();

    // Fetch data via Supabase REST (filtrado por user_id para isolamento entre contas)
    const userId = ctx.user.id;
    const [contasRes, contratosRes, parcelasRes, transRes] = await Promise.all([
      supabase.from('contas_caixa').select('id, saldo, ativo').eq('ativo', true).eq('user_id', userId),
      supabase.from('contratos').select('valor_principal').eq('status', 'ativo').eq('user_id', userId),
      supabase.from('parcelas').select('valor_original, valor_juros, valor_multa, saldo_residual, status, data_vencimento, numero_parcela, cliente_id').eq('user_id', userId),
      supabase.from('transacoes_caixa').select('conta_caixa_id, valor, tipo, categoria, data_transacao').eq('user_id', userId)
    ]);

    let saldoTotal = 0;
    if (contasRes.data) {
      for (const conta of contasRes.data) {
        const transacoesConta = (transRes.data ?? []).filter((t: any) => t.conta_caixa_id === conta.id);
        saldoTotal += calcularSaldoAtual(conta.saldo, transacoesConta);
      }
    }

    const capitalCirculacao = (contratosRes.data ?? []).reduce((s: number, c: any) => s + parseFloat(c.valor_principal ?? '0'), 0);
    
    const parcelasData = parcelasRes.data ?? [];
    const totalReceber = parcelasData.reduce((s: number, p: any) => s + calcularValorAbertoParcela({
      status: p.status,
      valorOriginal: p.valor_original,
      saldoResidual: p.saldo_residual,
      valorMulta: p.valor_multa,
    }), 0);
    
    const atrasadas = parcelasData.filter((p: any) => p.status === 'atrasada');
    const totalInadimplente = atrasadas.reduce((s: number, p: any) => s + parseFloat(p.valor_original ?? '0'), 0);
    const qtdInadimplentes = new Set(atrasadas.map((p: any) => p.cliente_id)).size;
    
    const jurosPendentes = parcelasData.filter((p: any) => ['atrasada', 'parcial'].includes(p.status)).reduce((s: number, p: any) => s + parseFloat(p.valor_juros ?? '0'), 0);
    
    const venceHoje = parcelasData.filter((p: any) => p.data_vencimento?.startsWith(hojeStr) && ['pendente', 'vencendo_hoje'].includes(p.status));
    const qtdVenceHoje = venceHoje.length;
    const valorVenceHoje = venceHoje.reduce((s: number, p: any) => s + parseFloat(p.valor_original ?? '0'), 0);
    
    const transacoes = transRes.data ?? [];
    const recebidoHoje = transacoes.filter((t: any) => t.tipo === 'entrada' && t.categoria === 'pagamento_parcela' && t.data_transacao?.startsWith(hojeStr)).reduce((s: number, t: any) => s + parseFloat(t.valor ?? '0'), 0);
    
    const contratosAtivos = (contratosRes.data ?? []).length;

    return {
      saldoTotal, capitalCirculacao, totalReceber, totalInadimplente,
      qtdInadimplentes, jurosPendentes, qtdVenceHoje, valorVenceHoje,
      recebidoHoje, contratosAtivos
    };
  }),

  parcelasHoje: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try {
        const hoje = dataHojeBrasilia();
        const rows = await db.select({
          id: parcelas.id, clienteId: parcelas.clienteId, clienteNome: clientes.nome,
          numeroParcela: parcelas.numeroParcela, valorOriginal: parcelas.valorOriginal,
          dataVencimento: parcelas.dataVencimento, status: parcelas.status,
          totalParcelas: sql<number>`(SELECT COUNT(*) FROM parcelas p2 WHERE p2.contrato_id = ${parcelas.contratoId})`,
        }).from(parcelas).innerJoin(clientes, eq(parcelas.clienteId, clientes.id))
          .where(and(eq(sql`DATE(${parcelas.dataVencimento})`, hoje), inArray(parcelas.status, ['pendente', 'vencendo_hoje']), eq(parcelas.userId, ctx.user.id)))
          .orderBy(parcelas.dataVencimento).limit(20);
        return rows;
      } catch (err) { console.warn('[dashboard.parcelasHoje] Drizzle failed:', (err as Error).message); resetDb(); }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const hoje = dataHojeBrasilia();
    const { data } = await supabase.from('parcelas').select('*, clientes(nome)').eq('data_vencimento', hoje).in('status', ['pendente', 'vencendo_hoje']).eq('user_id', ctx.user.id).order('data_vencimento').limit(20);
    return (data ?? []).map((r: any) => ({ id: r.id, clienteId: r.cliente_id, clienteNome: r.clientes?.nome ?? '', numeroParcela: r.numero, valorOriginal: r.valor_original, dataVencimento: r.data_vencimento, status: r.status, totalParcelas: 0 }));
  }),

  parcelasAtrasadas: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try {
        const rows = await db.select({
          id: parcelas.id, clienteId: parcelas.clienteId, clienteNome: clientes.nome,
          numeroParcela: parcelas.numeroParcela, valorOriginal: parcelas.valorOriginal,
          dataVencimento: parcelas.dataVencimento, status: parcelas.status,
        }).from(parcelas).innerJoin(clientes, eq(parcelas.clienteId, clientes.id))
          .where(and(eq(parcelas.status, 'atrasada'), eq(parcelas.userId, ctx.user.id))).orderBy(parcelas.dataVencimento).limit(20);
        return rows.map(r => {
          const { total, diasAtraso } = calcularJurosMora(parseFloat(r.valorOriginal), new Date(r.dataVencimento + 'T00:00:00'), new Date());
          return { ...r, valorAtualizado: total, diasAtraso };
        });
      } catch (err) { console.warn('[dashboard.parcelasAtrasadas] Drizzle failed:', (err as Error).message); resetDb(); }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const { data } = await supabase.from('parcelas').select('*, clientes(nome)').eq('status', 'atrasada').eq('user_id', ctx.user.id).order('data_vencimento').limit(20);
    return (data ?? []).map((r: any) => {
      const { total, diasAtraso } = calcularJurosMora(parseFloat(r.valor_original), new Date(r.data_vencimento + 'T00:00:00'), new Date());
      return { id: r.id, clienteId: r.cliente_id, clienteNome: r.clientes?.nome ?? '', numeroParcela: r.numero, valorOriginal: r.valor_original, dataVencimento: r.data_vencimento, status: r.status, valorAtualizado: total, diasAtraso };
    });
  }),

  scoreNegocio: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return { score: 0, taxaRecebimento: 0, inadimplencia: 0, totalRecebido: 0, emAtraso: 0 };
    const userId = ctx.user.id;
    const { data: all } = await supabase.from('parcelas').select('valor_original, status').eq('user_id', userId);
    const pagas = (all ?? []).filter((p: any) => p.status === 'paga');
    const atrasadasP = (all ?? []).filter((p: any) => p.status === 'atrasada');
    const totalRecebido = pagas.reduce((s: number, p: any) => s + parseFloat(p.valor_original ?? '0'), 0);
    const emAtraso = atrasadasP.reduce((s: number, p: any) => s + parseFloat(p.valor_original ?? '0'), 0);
    const totalGeral = (all ?? []).reduce((s: number, p: any) => s + parseFloat(p.valor_original ?? '0'), 0);
    const taxaRecebimento = totalGeral > 0 ? (totalRecebido / totalGeral) * 100 : 0;
    const inadimplencia = totalGeral > 0 ? (emAtraso / totalGeral) * 100 : 0;
    const score = Math.max(0, Math.min(100, Math.round(taxaRecebimento - inadimplencia * 0.5)));
    return { score, taxaRecebimento, inadimplencia, totalRecebido, emAtraso };
  }),

  precisaAtencao: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return { venceSemana: { qtd: 0, valor: 0 }, atrasados30: { qtd: 0, valor: 0 } };
    const userId = ctx.user.id;
    const hoje = new Date();
    const em7Dias = new Date(hoje); em7Dias.setDate(hoje.getDate() + 7);
    const ha30Dias = new Date(hoje); ha30Dias.setDate(hoje.getDate() - 30);
    const hojeStr = hoje.toISOString().split('T')[0];
    const em7Str = em7Dias.toISOString().split('T')[0];
    const ha30Str = ha30Dias.toISOString().split('T')[0];
    const [semanaRes, atrasadosRes] = await Promise.all([
      supabase.from('parcelas').select('valor_original, cliente_id').eq('user_id', userId)
        .in('status', ['pendente','vencendo_hoje']).gte('data_vencimento', hojeStr).lte('data_vencimento', em7Str),
      supabase.from('parcelas').select('valor_original, cliente_id').eq('user_id', userId)
        .eq('status', 'atrasada').lte('data_vencimento', ha30Str)
    ]);
    const semana = semanaRes.data ?? [];
    const atrasados = atrasadosRes.data ?? [];
    return {
      venceSemana: { qtd: semana.length, valor: semana.reduce((s: number, p: any) => s + parseFloat(p.valor_original ?? '0'), 0) },
      atrasados30: { qtd: new Set(atrasados.map((p: any) => p.cliente_id)).size, valor: atrasados.reduce((s: number, p: any) => s + parseFloat(p.valor_original ?? '0'), 0) }
    };
  }),

  tendenciaJuros: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const userId = ctx.user.id;
    const meses: { mes: string; valor: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const ano = d.getFullYear();
      const mes = d.getMonth() + 1;
      const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
      const fim = new Date(ano, mes, 0).toISOString().split('T')[0];
      const label = d.toLocaleString('pt-BR', { month: 'short' }).replace('.','');
      const { data } = await supabase.from('transacoes_caixa').select('valor').eq('user_id', userId)
        .eq('tipo', 'entrada').eq('categoria', 'pagamento_parcela').gte('data_transacao', inicio + 'T00:00:00').lte('data_transacao', fim + 'T23:59:59');
      const total = (data ?? []).reduce((s: number, r: any) => s + parseFloat(r.valor ?? '0'), 0);
      meses.push({ mes: label, valor: total });
    }
    return meses;
  }),

  fluxoMensal: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try {
        const dias: { dia: string; valor: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const now = new Date();
          now.setDate(now.getDate() - i);
          const dStr = now.toISOString().split('T')[0];
          const diaLabel = `${dStr.slice(8, 10)}/${dStr.slice(5, 7)}`;
          const result = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` }).from(transacoesCaixa)
            .where(and(eq(transacoesCaixa.tipo, 'entrada'), eq(sql`DATE(data_transacao)`, dStr), eq(transacoesCaixa.userId, ctx.user.id)));
          dias.push({ dia: diaLabel, valor: parseFloat(result[0]?.total ?? '0') });
        }
        return dias;
      } catch (err) { console.warn('[dashboard.fluxoMensal] Drizzle failed:', (err as Error).message); resetDb(); }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const dias: { dia: string; valor: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const now = new Date();
      now.setDate(now.getDate() - i);
      const dStr = now.toISOString().split('T')[0];
      const diaLabel = `${dStr.slice(8, 10)}/${dStr.slice(5, 7)}`;
      const { data } = await supabase.from('transacoes_caixa').select('valor').eq('tipo', 'entrada').eq('user_id', ctx.user.id).gte('data_transacao', dStr + 'T00:00:00').lte('data_transacao', dStr + 'T23:59:59');
      const total = (data ?? []).reduce((s: number, r: any) => s + parseFloat(r.valor ?? '0'), 0);
      dias.push({ dia: diaLabel, valor: total });
    }
    return dias;
  }),
});

// ─── CLIENTES ────────────────────────────────────────────────────────────────
// Normaliza campos snake_case do Supabase REST para camelCase esperado pelo frontend
function mapClienteFromRest(row: any): any {
  if (!row) return row;
  return {
    ...row,
    cpfCnpj: row.cpfCnpj ?? row.cpf_cnpj,
    fotoUrl: row.fotoUrl ?? row.foto_url,
    documentosUrls: row.documentosUrls ?? row.documentos_urls,
    tipoCliente: row.tipoCliente ?? row.tipo_cliente,
    isReferral: row.isReferral ?? row.is_referral,
    chavePix: row.chavePix ?? row.chave_pix,
    tipoChavePix: row.tipoChavePix ?? row.tipo_chave_pix,
    dataNascimento: row.dataNascimento ?? row.data_nascimento,
    estadoCivil: row.estadoCivil ?? row.estado_civil,
    nomeMae: row.nomeMae ?? row.nome_mae,
    nomePai: row.nomePai ?? row.nome_pai,
    numeroConta: row.numeroConta ?? row.numero_conta,
    userId: row.userId ?? row.user_id,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  };
}

const clientesRouter = router({
  list: protectedProcedure
    .input(z.object({ busca: z.string().optional(), ativo: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      let rows: any[];
      if (db) {
        try {
          rows = await db.select().from(clientes)
            .where(and(eq(clientes.userId, ctx.user.id), input?.ativo !== undefined ? eq(clientes.ativo, input.ativo) : undefined))
            .orderBy(desc(clientes.createdAt));
        } catch (err) {
          console.warn('[clientes.list] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
          rows = [];
        }
      } else {
        rows = [];
      }
      // Fallback: Supabase REST se Drizzle falhou
      if (rows.length === 0) {
        const supabase = await getSupabaseClientAsync();
        if (supabase) {
          let query = supabase.from('clientes').select('*').order('createdAt', { ascending: false }).eq('user_id', ctx.user.id);
          if (input?.ativo !== undefined) query = (query as any).eq('ativo', input.ativo);
          const { data, error } = await query;
          if (!error && data) rows = data;
        }
      }
      // Normalizar campos snake_case -> camelCase (Supabase REST retorna snake_case)
      rows = rows.map(mapClienteFromRest);
      if (input?.busca) {
        const b = input.busca.toLowerCase();
        rows = rows.filter((c: any) =>
          (c.nome ?? '').toLowerCase().includes(b) ||
          (c.cpfCnpj ?? '').includes(b) ||
          (c.telefone ?? '').includes(b)
        );
      }
      return { clientes: rows, total: rows.length };
    }),

  byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const rows = await db.select().from(clientes).where(and(eq(clientes.id, input.id), eq(clientes.userId, ctx.user.id))).limit(1);
        if (rows.length > 0) return rows[0];
      } catch (err) {
        console.warn('[clientes.byId] Drizzle failed, trying REST:', (err as Error).message);
        resetDb();
      }
    }
    // Fallback: Supabase REST — filtrar por user_id para isolamento multi-tenant
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return null;
    const { data, error } = await supabase.from('clientes').select('*').eq('id', input.id).eq('user_id', ctx.user.id).single();
    if (error) return null;
    return mapClienteFromRest(data);
  }),

  create: protectedProcedure
    .input(z.object({
      nome: z.string().min(2),
      cpfCnpj: z.string().optional(),
      cnpj: z.string().optional(),
      rg: z.string().optional(),
      telefone: z.string().optional(),
      whatsapp: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      chavePix: z.string().optional(),
      tipoChavePix: z.enum(['cpf', 'cnpj', 'email', 'telefone', 'aleatoria']).optional(),
      endereco: z.string().optional(),
      numero: z.string().optional(),
      complemento: z.string().optional(),
      bairro: z.string().optional(),
      cidade: z.string().optional(),
      estado: z.string().optional(),
      cep: z.string().optional(),
      observacoes: z.string().optional(),
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      profissao: z.string().optional(),
      dataNascimento: z.string().optional(),
      sexo: z.enum(['masculino', 'feminino', 'outro']).optional(),
      estadoCivil: z.enum(['solteiro', 'casado', 'divorciado', 'viuvo', 'outro']).optional(),
      nomeMae: z.string().optional(),
      nomePai: z.string().optional(),
      fotoUrl: z.string().optional(),
      documentosUrls: z.string().optional(),
      tipoCliente: z.string().optional(),
      isReferral: z.boolean().optional(),
      banco: z.string().optional(),
      agencia: z.string().optional(),
      numeroConta: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          const result = await db.insert(clientes).values({
            ...input,
            email: input.email || undefined,
            userId: ctx.user.id,
          }).returning({ id: clientes.id });
          return { id: result[0].id };
        } catch (err) {
          console.warn('[clientes.create] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      // Fallback: Supabase REST
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados indisponível' });
      const insertData: Record<string, unknown> = { nome: input.nome };
      if (input.cpfCnpj) insertData.cpf_cnpj = input.cpfCnpj;
      if (input.cnpj) insertData.cnpj = input.cnpj;
      if (input.rg) insertData.rg = input.rg;
      if (input.telefone) insertData.telefone = input.telefone;
      if (input.whatsapp) insertData.whatsapp = input.whatsapp;
      if (input.email) insertData.email = input.email;
      if (input.chavePix) insertData.chave_pix = input.chavePix;
      if (input.tipoChavePix) insertData.tipo_chave_pix = input.tipoChavePix;
      if (input.endereco) insertData.endereco = input.endereco;
      if (input.numero) insertData.numero = input.numero;
      if (input.complemento) insertData.complemento = input.complemento;
      if (input.bairro) insertData.bairro = input.bairro;
      if (input.cidade) insertData.cidade = input.cidade;
      if (input.estado) insertData.estado = input.estado;
      if (input.cep) insertData.cep = input.cep;
      if (input.observacoes) insertData.observacoes = input.observacoes;
      if (input.instagram) insertData.instagram = input.instagram;
      if (input.facebook) insertData.facebook = input.facebook;
      if (input.profissao) insertData.profissao = input.profissao;
      if (input.dataNascimento) insertData.data_nascimento = input.dataNascimento;
      if (input.sexo) insertData.sexo = input.sexo;
      if (input.estadoCivil) insertData.estado_civil = input.estadoCivil;
      if (input.nomeMae) insertData.nome_mae = input.nomeMae;
      if (input.nomePai) insertData.nome_pai = input.nomePai;
      if (input.fotoUrl) insertData.foto_url = input.fotoUrl;
      if (input.documentosUrls) insertData.documentos_urls = input.documentosUrls;
      if (input.tipoCliente) insertData.tipo_cliente = input.tipoCliente;
      if (input.isReferral !== undefined) insertData.is_referral = input.isReferral;
      if (input.banco) insertData.banco = input.banco;
      if (input.agencia) insertData.agencia = input.agencia;
      if (input.numeroConta) insertData.numero_conta = input.numeroConta;
      insertData.user_id = ctx.user.id;
      const { data, error } = await supabase.from('clientes').insert(insertData).select('id').single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { id: (data as any).id };
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().min(2).optional(),
      cpfCnpj: z.string().optional(),
      cnpj: z.string().optional(),
      rg: z.string().optional(),
      telefone: z.string().optional(),
      whatsapp: z.string().optional(),
      email: z.string().optional(),
      chavePix: z.string().optional(),
      tipoChavePix: z.enum(['cpf', 'cnpj', 'email', 'telefone', 'aleatoria']).optional(),
      endereco: z.string().optional(),
      numero: z.string().optional(),
      complemento: z.string().optional(),
      bairro: z.string().optional(),
      cidade: z.string().optional(),
      estado: z.string().optional(),
      cep: z.string().optional(),
      observacoes: z.string().optional(),
      score: z.number().min(0).max(1000).optional(),
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      profissao: z.string().optional(),
      dataNascimento: z.string().optional(),
      sexo: z.enum(['masculino', 'feminino', 'outro']).optional(),
      estadoCivil: z.enum(['solteiro', 'casado', 'divorciado', 'viuvo', 'outro']).optional(),
      nomeMae: z.string().optional(),
      nomePai: z.string().optional(),
      fotoUrl: z.string().optional(),
      documentosUrls: z.string().optional(),
      tipoCliente: z.string().optional(),
      isReferral: z.boolean().optional(),
      banco: z.string().optional(),
      agencia: z.string().optional(),
      numeroConta: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const { id, ...data } = input;
      if (db) {
        try {
          await db.update(clientes).set(data).where(and(
            eq(clientes.id, id),
            eq(clientes.userId, ctx.user.id),
          ));
          return { success: true };
        } catch (err) {
          console.warn('[clientes.update] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      // Fallback: Supabase REST
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const updateData: Record<string, unknown> = {};
      if (data.nome) updateData.nome = data.nome;
      if (data.cpfCnpj !== undefined) updateData.cpf_cnpj = data.cpfCnpj;
      if (data.cnpj !== undefined) updateData.cnpj = data.cnpj;
      if (data.rg !== undefined) updateData.rg = data.rg;
      if (data.telefone !== undefined) updateData.telefone = data.telefone;
      if (data.whatsapp !== undefined) updateData.whatsapp = data.whatsapp;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.chavePix !== undefined) updateData.chave_pix = data.chavePix;
      if (data.tipoChavePix !== undefined) updateData.tipo_chave_pix = data.tipoChavePix;
      if (data.endereco !== undefined) updateData.endereco = data.endereco;
      if (data.numero !== undefined) updateData.numero = data.numero;
      if (data.complemento !== undefined) updateData.complemento = data.complemento;
      if (data.bairro !== undefined) updateData.bairro = data.bairro;
      if (data.cidade !== undefined) updateData.cidade = data.cidade;
      if (data.estado !== undefined) updateData.estado = data.estado;
      if (data.cep !== undefined) updateData.cep = data.cep;
      if (data.observacoes !== undefined) updateData.observacoes = data.observacoes;
      if (data.score !== undefined) updateData.score = data.score;
      if (data.instagram !== undefined) updateData.instagram = data.instagram;
      if (data.facebook !== undefined) updateData.facebook = data.facebook;
      if (data.profissao !== undefined) updateData.profissao = data.profissao;
      if (data.dataNascimento !== undefined) updateData.data_nascimento = data.dataNascimento;
      if (data.sexo !== undefined) updateData.sexo = data.sexo;
      if (data.estadoCivil !== undefined) updateData.estado_civil = data.estadoCivil;
      if (data.nomeMae !== undefined) updateData.nome_mae = data.nomeMae;
      if (data.nomePai !== undefined) updateData.nome_pai = data.nomePai;
      if (data.fotoUrl !== undefined) updateData.foto_url = data.fotoUrl;
      if (data.documentosUrls !== undefined) updateData.documentos_urls = data.documentosUrls;
      if (data.tipoCliente !== undefined) updateData.tipo_cliente = data.tipoCliente;
      if (data.isReferral !== undefined) updateData.is_referral = data.isReferral;
      if (data.banco !== undefined) updateData.banco = data.banco;
      if (data.agencia !== undefined) updateData.agencia = data.agencia;
      if (data.numeroConta !== undefined) updateData.numero_conta = data.numeroConta;
      const { error } = await supabase.from('clientes').update(updateData).eq('id', id).eq('user_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  contratosByCliente: protectedProcedure.input(z.object({ clienteId: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try { return db.select().from(contratos).where(and(eq(contratos.clienteId, input.clienteId), eq(contratos.userId, ctx.user.id))).orderBy(desc(contratos.createdAt)); }
      catch (err) { console.warn('[clientes.contratosByCliente] Drizzle failed:', (err as Error).message); resetDb(); }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const { data } = await supabase.from('contratos').select('*').eq('cliente_id', input.clienteId).eq('user_id', ctx.user.id).order('createdAt', { ascending: false });
    return (data ?? []).map((c: any) => ({
      ...c,
      clienteId: c.cliente_id,
      valorPrincipal: c.valor_principal,
      valorParcela: c.valor_parcela,
      numeroParcelas: c.numero_parcelas,
      taxaJuros: c.taxa_juros,
      tipoTaxa: c.tipo_taxa,
      dataInicio: c.data_inicio,
      dataVencimentoPrimeira: c.data_vencimento_primeira,
      diaVencimento: c.dia_vencimento,
      multaAtraso: c.multa_atraso,
      jurosMoraDiario: c.juros_mora_diario,
      contaCaixaId: c.conta_caixa_id,
      koletorId: c.koletor_id,
      userId: c.user_id,
    }));
  }),
  importarCSV: protectedProcedure
    .input(z.object({
      registros: z.array(z.object({
        nome: z.string().min(1),
        cpfCnpj: z.string().optional(),
        telefone: z.string().optional(),
        whatsapp: z.string().optional(),
        email: z.string().optional(),
        chavePix: z.string().optional(),
        endereco: z.string().optional(),
        cidade: z.string().optional(),
        estado: z.string().optional(),
        observacoes: z.string().optional(),
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const supabaseImport = !db ? await getSupabaseClientAsync() : null;
      if (!db && !supabaseImport) throw new Error('DB unavailable');
      let importados = 0;
      let erros = 0;
      const detalhesErros: string[] = [];
      for (const reg of input.registros) {
        try {
          if (!reg.nome || reg.nome.trim().length < 2) {
            erros++;
            detalhesErros.push(`Linha ignorada: nome inválido ("${reg.nome}")`);
            continue;
          }
          if (db) {
            await db.insert(clientes).values({
              nome: reg.nome.trim(),
              cpfCnpj: reg.cpfCnpj?.trim() || undefined,
              telefone: reg.telefone?.trim() || undefined,
              whatsapp: reg.whatsapp?.trim() || reg.telefone?.trim() || undefined,
              email: reg.email?.trim() || undefined,
              chavePix: reg.chavePix?.trim() || undefined,
              endereco: reg.endereco?.trim() || undefined,
              cidade: reg.cidade?.trim() || undefined,
              estado: reg.estado?.trim() || undefined,
              observacoes: reg.observacoes?.trim() || undefined,
              userId: ctx.user.id,
            });
          } else if (supabaseImport) {
            const { error: impErr } = await supabaseImport.from('clientes').insert({
              nome: reg.nome.trim(),
              cpf_cnpj: reg.cpfCnpj?.trim() || null,
              telefone: reg.telefone?.trim() || null,
              whatsapp: reg.whatsapp?.trim() || reg.telefone?.trim() || null,
              email: reg.email?.trim() || null,
              chave_pix: reg.chavePix?.trim() || null,
              endereco: reg.endereco?.trim() || null,
              cidade: reg.cidade?.trim() || null,
              estado: reg.estado?.trim() || null,
              observacoes: reg.observacoes?.trim() || null,
              user_id: ctx.user.id,
            });
            if (impErr) throw new Error(impErr.message);
          }
          importados++;
        } catch (e: any) {
          erros++;
          detalhesErros.push(`Erro ao importar "${reg.nome}": ${e?.message ?? 'erro desconhecido'}`);
        }
      }
      return { importados, erros, detalhesErros };
    }),

  listarComScore: protectedProcedure
    .input(z.object({ ordenarPor: z.enum(['score', 'lucro', 'nome']).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      let rows: any[] = [];
      
      if (db) {
        try {
          rows = await db.select().from(clientes).where(and(eq(clientes.ativo, true), eq(clientes.userId, ctx.user.id)));
        } catch (err) {
          console.warn('[clientes.listarComScore] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      
      // Fallback: Supabase REST
      if (rows.length === 0) {
        const supabase = await getSupabaseClientAsync();
        if (supabase) {
          const { data, error } = await supabase.from('clientes').select('*').eq('ativo', true).eq('user_id', ctx.user.id);
          if (!error && data) rows = data;
        }
      }
      
      // Calcular score para cada cliente
      const clientesComScore = await Promise.all(rows.map(async (cliente: any) => {
        // Buscar parcelas do cliente
        let parcelas_data: any[] = [];
        if (db) {
          try {
            parcelas_data = await db.select().from(parcelas).where(eq(parcelas.clienteId, cliente.id));
          } catch (err) {
            resetDb();
          }
        }
        
        if (parcelas_data.length === 0) {
          const supabase = await getSupabaseClientAsync();
          if (supabase) {
            const { data } = await supabase.from('parcelas').select('*').eq('cliente_id', cliente.id).eq('user_id', ctx.user.id);
            if (data) parcelas_data = data;
          }
        }
        
        // Calcular score
        let score = 100; // Score inicial
        let lucroGerado = 0;
        let parcelasEmDia = 0;
        let parcelasAtrasadas = 0;
        let parcelasQuitadas = 0;
        let pontosRecuperacao = 0;
        let capitalTotal = 0;
        let totalReceber = 0;
        const totalParcelas = parcelas_data.length;
        
        for (const parcela of parcelas_data) {
          const valorOriginalParcela = parseFloat(parcela.valor_original ?? parcela.valorOriginal ?? '0');
          const saldoResidualParcela = parseFloat(parcela.saldo_residual ?? parcela.saldoResidual ?? '0');
          const valorMultaParcela = parseFloat(parcela.valor_multa ?? parcela.valorMulta ?? '0');
          capitalTotal += valorOriginalParcela;
          if (parcela.status !== 'paga') totalReceber += calcularValorAbertoParcela({
            status: parcela.status,
            valorOriginal: valorOriginalParcela,
            saldoResidual: saldoResidualParcela,
            valorMulta: valorMultaParcela,
          });
          if (parcela.status === 'paga') {
            parcelasQuitadas++;
            score += 10; // +10 por parcela paga
            lucroGerado += parseFloat(parcela.juros || parcela.valor_juros || 0);
            // Bônus de recuperação: pagou após atraso
            const dataPag = parcela.data_pagamento || parcela.dataPagamento;
            const dataVenc = parcela.data_vencimento || parcela.dataVencimento;
            if (dataPag && dataVenc && new Date(dataPag) > new Date(dataVenc)) {
              pontosRecuperacao += 3;
              score += 3;
            }
          } else if (parcela.status === 'pendente' || parcela.status === 'vencendo_hoje') {
            parcelasEmDia++;
            score += 5;
          } else if (parcela.status === 'atrasada') {
            parcelasAtrasadas++;
            score -= 5; // -5 por parcela atrasada
          }
        }
        
        // Bonus por lucro gerado
        score += Math.floor(lucroGerado / 100); // +1 ponto por R$100 de lucro
        
        // Bônus por alta taxa de adimplência
        if (totalParcelas > 0) {
          const taxaAdimplencia = (parcelasQuitadas + parcelasEmDia) / totalParcelas;
          if (taxaAdimplencia >= 0.9) score += 20;
          else if (taxaAdimplencia >= 0.8) score += 10;
        }
        
        // Limitar score entre 0 e 200
        score = Math.max(0, Math.min(200, score));
        
        // Determinar badge
        let badge = '⚠️ Ruim';
        if (score >= 100) badge = '⭐ Excelente';
        else if (score >= 70) badge = '👍 Bom';
        else if (score >= 40) badge = '👌 Regular';
        
        return {
          id: cliente.id,
          nome: cliente.nome || cliente.name || '',
          cpfCnpj: cliente.cpf_cnpj || cliente.cpfCnpj || null,
          telefone: cliente.telefone || null,
          email: cliente.email || null,
          score,
          badge,
          lucroGerado,
          parcelasEmDia,
          parcelasAtrasadas,
          parcelasQuitadas,
          pontosRecuperacao,
          totalParcelas,
          taxaAdimplencia: totalParcelas > 0 ? Math.round(((parcelasQuitadas + parcelasEmDia) / totalParcelas) * 100) : 0,
          capitalTotal,
          totalReceber,
        };
      }));
      
      // Ordenar conforme solicitado
      const ordenarPor = input?.ordenarPor || 'score';
      if (ordenarPor === 'score') {
        clientesComScore.sort((a, b) => b.score - a.score);
      } else if (ordenarPor === 'lucro') {
        clientesComScore.sort((a, b) => b.lucroGerado - a.lucroGerado);
      } else if (ordenarPor === 'nome') {
        clientesComScore.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      }
      
      return { clientes: clientesComScore, total: clientesComScore.length };
    }),

  deletar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          const contratosAtivos = await db.select().from(contratos).where(
            and(
              eq(contratos.clienteId, input.id),
              eq(contratos.status, 'ativo'),
              eq(contratos.userId, ctx.user.id),
            )
          );
          if (contratosAtivos.length > 0) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: `Nao eh possivel deletar cliente com ${contratosAtivos.length} contrato(s) ativo(s).`
            });
          }
          await db.delete(clientes).where(and(eq(clientes.id, input.id), eq(clientes.userId, ctx.user.id)));
          return { success: true };
        } catch (err: any) {
          if (err?.code === 'CONFLICT') throw err;
          console.warn('[clientes.deletar] Drizzle failed, trying REST:', err.message);
          resetDb();
        }
      }
      // Fallback: Supabase REST
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data: ctAtivos } = await supabase.from('contratos').select('id').eq('cliente_id', input.id).eq('status', 'ativo').eq('user_id', ctx.user.id);
      if (ctAtivos && ctAtivos.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: `Nao eh possivel deletar cliente com ${ctAtivos.length} contrato(s) ativo(s).` });
      }
      const { error } = await supabase.from('clientes').delete().eq('id', input.id).eq('user_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  // Atualiza apenas os documentos de um cliente (sem precisar enviar todos os campos)
  updateDocumentos: protectedProcedure
    .input(z.object({
      id: z.number(),
      documentosUrls: z.string(), // JSON serializado de DocumentoSalvo[]
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          await db.update(clientes).set({ documentosUrls: input.documentosUrls } as any).where(and(
            eq(clientes.id, input.id),
            eq(clientes.userId, ctx.user.id),
          ));
          return { success: true };
        } catch (err) {
          console.warn('[clientes.updateDocumentos] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { error } = await supabase
        .from('clientes')
        .update({ documentos_urls: input.documentosUrls })
        .eq('id', input.id)
        .eq('user_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),
});
// ─── CONTRATOS ────────────────────────────────────────────────────────────────
const contratosRouter = router({
  // Lista contratos com dados agregados das parcelas para os cards de Empréstimos
  listComParcelas: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      modalidade: z.string().optional(),
      busca: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return [];

      // Verificar se o usuário logado é um koletor (filtrar apenas seus contratos)
      let myKoletorIdForList: number | null = null;
      try {
        const { data: koletorMe } = await supabase.from('koletores').select('id, perfil').eq('user_id', ctx.user.id).eq('ativo', true).maybeSingle();
        if (koletorMe?.perfil === 'koletor') myKoletorIdForList = koletorMe.id;
      } catch (_) { /* não é koletor */ }

      // Buscar contratos
      let cQuery = supabase
        .from('contratos')
        .select('id, cliente_id, modalidade, status, valor_principal, valor_parcela, numero_parcelas, taxa_juros, tipo_taxa, data_inicio, data_vencimento_primeira, "createdAt", etiquetas, clientes!inner(id, nome, whatsapp, chave_pix, telefone)')
        .order('createdAt', { ascending: false })
        .eq('user_id', ctx.user.id);
      if (myKoletorIdForList !== null) cQuery = cQuery.eq('koletor_id', myKoletorIdForList);

      if (input?.status && input.status !== 'todos') cQuery = cQuery.eq('status', input.status);
      if (input?.modalidade) cQuery = cQuery.eq('modalidade', input.modalidade);

      const { data: contratosData, error: contratosErr } = await cQuery;
      if (contratosErr) { console.error('[contratos.listComParcelas] error:', contratosErr.message); return []; }

      const contratosList = contratosData ?? [];
      if (contratosList.length === 0) return [];

      // Filtrar por busca
      const filtrados = input?.busca
        ? contratosList.filter((c: any) => {
            const nome = (c.clientes as any)?.nome ?? '';
            return nome.toLowerCase().includes(input.busca!.toLowerCase());
          })
        : contratosList;

      // Buscar todas as parcelas dos contratos
      const contratoIds = filtrados.map((c: any) => c.id);
      const { data: parcelasData } = await supabase
        .from('parcelas')
        .select('id, contrato_id, numero_parcela, valor_original, valor_pago, valor_multa, saldo_residual, data_vencimento, data_pagamento, status')
        .in('contrato_id', contratoIds)
        .eq('user_id', ctx.user.id)
        .order('data_vencimento');

      const hoje = dataHojeBrasilia();

      // Agrupar parcelas por contrato
      const parcelasPorContrato: Record<number, any[]> = {};
      for (const p of (parcelasData ?? [])) {
        if (!parcelasPorContrato[p.contrato_id]) parcelasPorContrato[p.contrato_id] = [];
        // Atualizar status em memória
        let statusAtual = p.status;
        if (statusAtual !== 'paga' && statusAtual !== 'parcial') {
          if (p.data_vencimento < hoje) statusAtual = 'atrasada';
          else if (p.data_vencimento === hoje) statusAtual = 'vencendo_hoje';
        }
        parcelasPorContrato[p.contrato_id].push({ ...p, status: statusAtual });
      }

      // Uma configuração ausente ou cobrança automática desligada jamais pode
      // virar R$100/dia implicitamente. O cartão e o pagamento usam a mesma
      // regra: somente a taxa que o assinante ativou é exibida/cobrada.
      let multaDiaria = 0;
      let multaPercentual = 0;
      let jurosMultaAutomatico = false;
      try {
        const { data: configRows } = await supabase.from('configuracoes').select('chave, valor').eq('user_id', ctx.user.id);
        if (configRows) {
          const configMap: Record<string, string> = {};
          for (const r of configRows) configMap[r.chave] = r.valor ?? '';
          jurosMultaAutomatico = configMap['jurosMultaAutomatico'] === 'true' || configMap['juros_multa_automatico'] === 'true';
          if (jurosMultaAutomatico) {
            const diaria = Number.parseFloat(configMap['multaDiaria'] ?? configMap['multa_diaria'] ?? '0');
            const percentual = Number.parseFloat(configMap['multaPadrao'] ?? configMap['multa_padrao'] ?? '0');
            multaDiaria = Number.isFinite(diaria) && diaria > 0 ? diaria : 0;
            multaPercentual = Number.isFinite(percentual) && percentual > 0 ? percentual : 0;
          }
        }
      } catch (_) { /* sem configuração, não há cobrança automática */ }

      return filtrados.map((c: any) => {
        const cliente = c.clientes as any;
        const parcelasContrato = parcelasPorContrato[c.id] ?? [];
        const parcelasAbertas = parcelasContrato.filter((p: any) => !['paga'].includes(p.status));
        const parcelasPagas = parcelasContrato.filter((p: any) => p.status === 'paga');
        const parcelasAtrasadas = parcelasContrato.filter((p: any) => p.status === 'atrasada');

        // KPIs
        const valorPrincipal = parseFloat(c.valor_principal ?? '0');
        const valorParcela = parseFloat(c.valor_parcela ?? '0');
        const taxaJuros = parseFloat(c.taxa_juros ?? '0');
        const numeroParcelas = parseInt(c.numero_parcelas ?? '1') || 1;
        // Juros por parcela = capital × taxa%
        // Para contratos de juros simples (quinzenal, mensal, etc.): juros = principal × taxa / 100
        // Isso é sempre correto: R$500 × 50% = R$250 de juros por parcela
        const valorJurosParcela = Math.round(valorPrincipal * (taxaJuros / 100) * 100) / 100;

        // Total a receber = exatamente o saldo ainda aberto de cada parcela.
        const totalReceber = parcelasAbertas.reduce((s: number, p: any) => s + calcularValorAbertoParcela({
          status: p.status,
          valorOriginal: p.valor_original,
          saldoResidual: p.saldo_residual,
          valorMulta: p.valor_multa,
        }), 0);
        // Total pago = soma das parcelas pagas
        const totalPago = parcelasPagas.reduce((s: number, p: any) => s + parseFloat(p.valor_pago ?? p.valor_original ?? '0'), 0);
        // Lucro previsto = total a receber restante - capital ainda não recebido
        // Fórmula: totalReceber - (capital proporcional às parcelas abertas)
        const capitalRestante = numeroParcelas > 0 ? valorPrincipal * (parcelasAbertas.length / numeroParcelas) : 0;
        const lucroPrevisto = Math.max(0, totalReceber - capitalRestante);
        // Lucro realizado = total pago - capital emprestado
        // Fórmula: totalPago - valorPrincipal
        // Lógica: tudo que foi recebido além do capital emprestado é lucro
        // Ex: emprestou 500, recebeu 550 (2x só juros) → lucro = 550 - 500 = 50
        const lucroRealizado = Math.max(0, totalPago - valorPrincipal);

        // Próxima parcela em aberto
        const proximaParcela = parcelasAbertas.length > 0 ? parcelasAbertas[0] : null;

        // Calcular juros por atraso para parcelas atrasadas
        const parcelasComAtraso = parcelasAtrasadas.map((p: any) => {
          const calculoMora = calcularJurosMora(
            parseFloat(p.valor_original ?? '0') + parseFloat(p.saldo_residual ?? '0'),
            new Date(`${p.data_vencimento}T12:00:00-03:00`),
            new Date(),
            multaDiaria,
            multaPercentual,
          );
          const multaAplicada = parseFloat(p.valor_multa ?? '0');
          return {
            ...p,
            diasAtraso: calculoMora.diasAtraso,
            jurosAtraso: calculoMora.juros + calculoMora.multa,
            multaAplicada,
            totalComAtraso: parseFloat(p.valor_original ?? '0') + parseFloat(p.saldo_residual ?? '0') + calculoMora.juros + calculoMora.multa + multaAplicada,
          };
        });

        return {
          id: c.id,
          clienteId: cliente?.id ?? c.cliente_id,
          clienteNome: cliente?.nome ?? '',
          clienteWhatsapp: cliente?.whatsapp ?? null,
          clienteChavePix: cliente?.chave_pix ?? null,
          clienteTelefone: cliente?.telefone ?? null,
          modalidade: c.modalidade,
          status: c.status,
          valorPrincipal: c.valor_principal,
          valorParcela: c.valor_parcela,
          numeroParcelas: c.numero_parcelas,
          taxaJuros: c.taxa_juros,
          tipoTaxa: c.tipo_taxa,
          dataInicio: c.data_inicio,
          createdAt: c.createdAt,
          // KPIs calculados
          totalReceber,
          totalPago,
          lucroPrevisto,
          lucroRealizado,
          valorJurosParcela,
          // Parcelas
          parcelasAbertas: parcelasAbertas.length,
          parcelasAtrasadas: parcelasAtrasadas.length,
          parcelasPagas: parcelasPagas.length,
          proximaParcela,
          parcelasComAtraso,
          todasParcelas: parcelasContrato,
          etiquetas: (() => { try { return JSON.parse(c.etiquetas ?? '[]'); } catch { return []; } })(),
        };
      });
    }),
  obterDetalhes: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return null;

      // Buscar contrato
      const { data: contratoData, error: contratoErr } = await supabase
        .from('contratos')
        .select('id, cliente_id, modalidade, status, valor_principal, valor_parcela, numero_parcelas, taxa_juros, tipo_taxa, data_inicio, data_vencimento_primeira, "createdAt", etiquetas, clientes!inner(id, nome, whatsapp, chave_pix, telefone)')
        .eq('id', input.id)
        .eq('user_id', ctx.user.id)
        .single();

      if (contratoErr || !contratoData) return null;

      // Buscar parcelas
      const { data: parcelasData } = await supabase
        .from('parcelas')
        .select('id, contrato_id, numero_parcela, valor_original, valor_pago, valor_multa, saldo_residual, data_vencimento, data_pagamento, status')
        .eq('contrato_id', input.id)
        .eq('user_id', ctx.user.id)
        .order('data_vencimento');

      const hoje = dataHojeBrasilia();
      const cliente = contratoData.clientes as any;
      const parcelas = (parcelasData ?? []).map((p: any) => {
        let statusAtual = p.status;
        if (statusAtual !== 'paga' && statusAtual !== 'parcial') {
          if (p.data_vencimento < hoje) statusAtual = 'atrasada';
          else if (p.data_vencimento === hoje) statusAtual = 'vencendo_hoje';
        }
        return { ...p, status: statusAtual };
      });

      // Sem ativação explícita não há juros automáticos de mora.
      let multaDiaria = 0;
      let multaPercentual = 0;
      try {
        const { data: configRows } = await supabase.from('configuracoes').select('chave, valor').eq('user_id', ctx.user.id);
        if (configRows) {
          const configMap: Record<string, string> = {};
          for (const r of configRows) configMap[r.chave] = r.valor ?? '';
          const automatico = configMap['jurosMultaAutomatico'] === 'true' || configMap['juros_multa_automatico'] === 'true';
          if (automatico) {
            const diaria = Number.parseFloat(configMap['multaDiaria'] ?? configMap['multa_diaria'] ?? '0');
            const percentual = Number.parseFloat(configMap['multaPadrao'] ?? configMap['multa_padrao'] ?? '0');
            multaDiaria = Number.isFinite(diaria) && diaria > 0 ? diaria : 0;
            multaPercentual = Number.isFinite(percentual) && percentual > 0 ? percentual : 0;
          }
        }
      } catch (_) { /* sem configuração, não há cobrança automática */ }

      // Calcular KPIs
      const parcelasAbertas = parcelas.filter((p: any) => !['paga'].includes(p.status));
      const parcelasPagas = parcelas.filter((p: any) => p.status === 'paga');
      const parcelasAtrasadas = parcelas.filter((p: any) => p.status === 'atrasada');

      const valorPrincipal = parseFloat(contratoData.valor_principal ?? '0');
      const valorParcela = parseFloat(contratoData.valor_parcela ?? '0');
      const taxaJuros = parseFloat(contratoData.taxa_juros ?? '0');
      const valorJurosParcela = Math.round(valorPrincipal * (taxaJuros / 100) * 100) / 100;

      const totalReceber = parcelasAbertas.reduce((s: number, p: any) => s + calcularValorAbertoParcela({
        status: p.status,
        valorOriginal: p.valor_original,
        saldoResidual: p.saldo_residual,
        valorMulta: p.valor_multa,
      }), 0);
      const totalPago = parcelasPagas.reduce((s: number, p: any) => s + parseFloat(p.valor_pago ?? p.valor_original ?? '0'), 0);
      const lucroPrevisto = valorJurosParcela * parcelasAbertas.length;
      // Lucro realizado = total pago - capital emprestado
      // Tudo que foi recebido além do capital emprestado é lucro
      const lucroRealizado = Math.max(0, totalPago - valorPrincipal);

      const parcelasComAtraso = parcelasAtrasadas.map((p: any) => {
        const calculoMora = calcularJurosMora(
          parseFloat(p.valor_original ?? '0') + parseFloat(p.saldo_residual ?? '0'),
          new Date(`${p.data_vencimento}T12:00:00-03:00`),
          new Date(),
          multaDiaria,
          multaPercentual,
        );
        const multaAplicada = parseFloat(p.valor_multa ?? '0');
        return {
          ...p,
          diasAtraso: calculoMora.diasAtraso,
          jurosAtraso: calculoMora.juros + calculoMora.multa,
          multaAplicada,
          totalComAtraso: parseFloat(p.valor_original ?? '0') + parseFloat(p.saldo_residual ?? '0') + calculoMora.juros + calculoMora.multa + multaAplicada,
        };
      });

      return {
        id: contratoData.id,
        clienteId: cliente?.id ?? contratoData.cliente_id,
        clienteNome: cliente?.nome ?? '',
        clienteWhatsapp: cliente?.whatsapp ?? null,
        clienteChavePix: cliente?.chave_pix ?? null,
        clienteTelefone: cliente?.telefone ?? null,
        modalidade: contratoData.modalidade,
        status: contratoData.status,
        valorPrincipal: contratoData.valor_principal,
        valorParcela: contratoData.valor_parcela,
        numeroParcelas: contratoData.numero_parcelas,
        taxaJuros: contratoData.taxa_juros,
        tipoTaxa: contratoData.tipo_taxa,
        dataInicio: contratoData.data_inicio,
        dataVencimento: contratoData.data_vencimento_primeira,
        dataCriacao: contratoData.createdAt,
        totalReceber,
        totalPago,
        lucroPrevisto,
        lucroRealizado,
        valorJurosParcela,
        parcelasAbertas: parcelasAbertas.length,
        parcelasAtrasadas: parcelasAtrasadas.length,
        parcelasPagas: parcelasPagas.length,
        parcelasComAtraso,
        todasParcelas: parcelas,
      };
    }),

   list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      modalidade: z.string().optional(),
      clienteId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          const rows = await db.select({
            id: contratos.id,
            clienteId: contratos.clienteId,
            clienteNome: clientes.nome,
            modalidade: contratos.modalidade,
            status: contratos.status,
            valorPrincipal: contratos.valorPrincipal,
            valorParcela: contratos.valorParcela,
            numeroParcelas: contratos.numeroParcelas,
            taxaJuros: contratos.taxaJuros,
            tipoTaxa: contratos.tipoTaxa,
            dataInicio: contratos.dataInicio,
            createdAt: contratos.createdAt,
            koletorId: contratos.koletorId,
          }).from(contratos)
            .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
            .where(eq(contratos.userId, ctx.user.id))
            .orderBy(desc(contratos.createdAt));
          // Buscar perfil do cobrador (se for cobrador, filtrar apenas seus contratos)
          let myKoletorId: number | null = null;
          try {
            const supabaseForPerfil = await getSupabaseClientAsync();
            if (supabaseForPerfil) {
              const { data: koletorData } = await supabaseForPerfil.from('koletores').select('id, perfil').eq('user_id', ctx.user.id).single();
              if (koletorData?.perfil === 'koletor') myKoletorId = koletorData.id;
            }
          } catch (_) { /* não é cobrador */ }
          return rows.filter(r => {
            if (myKoletorId !== null && r.koletorId !== myKoletorId) return false;
            if (input?.status && r.status !== input.status) return false;
            if (input?.modalidade && r.modalidade !== input.modalidade) return false;
            if (input?.clienteId && r.clienteId !== input.clienteId) return false;
            return true;
          });
        } catch (err) {
          console.warn('[contratos.list] Drizzle failed, trying REST:', (err as Error).message);
        }
      }

      // Fallback: Supabase REST
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return [];
      // Buscar perfil do cobrador
      let myKoletorId: number | null = null;
      try {
        const { data: koletorData } = await supabase.from('koletores').select('id, perfil').eq('user_id', ctx.user.id).single();
        if (koletorData?.perfil === 'koletor') myKoletorId = koletorData.id;
      } catch (_) { /* não é cobrador */ }
      let query = supabase
        .from('contratos')
        .select('id, cliente_id, modalidade, status, valor_principal, valor_parcela, numero_parcelas, taxa_juros, tipo_taxa, data_inicio, koletor_id, "createdAt", clientes!inner(nome)')
        .order('createdAt', { ascending: false })
        .eq('user_id', ctx.user.id);
      if (input?.status) query = query.eq('status', input.status);
      if (input?.modalidade) query = query.eq('modalidade', input.modalidade);
      if (input?.clienteId) query = query.eq('cliente_id', input.clienteId);
      if (myKoletorId !== null) query = query.eq('koletor_id', myKoletorId);
      const { data, error } = await query;
      if (error) { console.error('[contratos.list] REST error:', error.message); return []; }
      return (data ?? []).map((r: any) => ({
        id: r.id,
        clienteId: r.cliente_id,
        clienteNome: r.clientes?.nome ?? '',
        modalidade: r.modalidade,
        status: r.status,
        valorPrincipal: r.valor_principal,
        valorParcela: r.valor_parcela,
        numeroParcelas: r.numero_parcelas,
        taxaJuros: r.taxa_juros,
        tipoTaxa: r.tipo_taxa,
        dataInicio: r.data_inicio,
        createdAt: r.createdAt,
      }));
    }),

  byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (db) {
      try {
        const rows = await db.select({
          contrato: contratos, clienteNome: clientes.nome,
          clienteWhatsapp: clientes.whatsapp, clienteChavePix: clientes.chavePix,
        }).from(contratos).innerJoin(clientes, eq(contratos.clienteId, clientes.id))
          .where(and(
            eq(contratos.id, input.id),
            eq(contratos.userId, ctx.user.id),
            eq(clientes.userId, ctx.user.id),
          )).limit(1);
        return rows[0] ?? null;
      } catch (err) { console.warn('[contratos.byId] Drizzle failed:', (err as Error).message); resetDb(); }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return null;
    const { data } = await supabase.from('contratos').select('*, clientes(nome, whatsapp, chave_pix)').eq('id', input.id).eq('user_id', ctx.user.id).single();
    if (!data) return null;
    return {
      contrato: { ...data, clienteId: data.cliente_id, valorPrincipal: data.valor_principal, taxaJuros: data.taxa_juros, tipoTaxa: data.tipo_taxa, numeroParcelas: data.numero_parcelas, dataInicio: data.data_inicio, dataVencimentoPrimeira: data.data_vencimento_primeira, diaVencimento: data.dia_vencimento, multaAtraso: data.multa_atraso, jurosMoraDiario: data.juros_mora_diario, contaCaixaId: data.conta_caixa_id, koletorId: data.koletor_id },
      clienteNome: data.clientes?.nome ?? '',
      clienteWhatsapp: data.clientes?.whatsapp ?? null,
      clienteChavePix: data.clientes?.chave_pix ?? null,
    };
  }),

  create: protectedProcedure
    .input(z.object({
      clienteId: z.number(),
      modalidade: z.enum(['mensal', 'diario', 'semanal', 'quinzenal', 'tabela_price', 'reparcelamento', 'venda', 'cheque']),
      valorPrincipal: z.number().positive(),
      taxaJuros: z.number().min(0),
      tipoTaxa: z.enum(['diaria', 'semanal', 'quinzenal', 'mensal', 'anual']).default('mensal'),
      numeroParcelas: z.number().int().positive(),
      dataInicio: z.string(),
      dataVencimentoPrimeira: z.string(),
      diaVencimento: z.number().int().min(1).max(31).optional(),
      descricao: z.string().optional(),
      observacoes: z.string().optional(),
      contaCaixaId: z.number().int().positive(),
      multaAtraso: z.number().optional(),
      jurosMoraDiario: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await validarClienteDoUsuario(ctx.user.id, input.clienteId);
      if (input.contaCaixaId) await validarContaDoUsuario(ctx.user.id, input.contaCaixaId);
      // Calcular valor da parcela
      let valorParcela: number;
      if (input.modalidade === 'tabela_price') {
        valorParcela = calcularParcelasPrice(input.valorPrincipal, input.taxaJuros, input.numeroParcelas);
      } else if (input.modalidade === 'diario') {
        // Empréstimo Diário: total = capital × (1 + taxa/100), parcela = total ÷ nParcelas
        // Ex: R$300 × 100% = R$600 ÷ 15 = R$40/parcela
        valorParcela = calcularParcelaDiario(input.valorPrincipal, input.taxaJuros, input.numeroParcelas);
      } else {
        valorParcela = calcularParcelaPadrao(input.valorPrincipal, input.taxaJuros, input.numeroParcelas);
      }

      // Buscar koletor_id pelo user_id (pode ser null se não encontrado)
      let koletorId: number | null = null;
      try {
        const supabaseForKoletor = await getSupabaseClientAsync();
        if (supabaseForKoletor) {
          const { data: koletorData } = await supabaseForKoletor
            .from('koletores')
            .select('id')
            .eq('user_id', ctx.user.id)
            .single();
          koletorId = koletorData?.id ?? null;
        }
      } catch (_) { /* koletor_id fica null */ }

      const db = await getDb();
      let contratoId: number | undefined;

      if (db) {
        try {
          const totalContrato = (valorParcela * input.numeroParcelas).toFixed(2);
          const result = await db.insert(contratos).values({
            clienteId: input.clienteId,
            koletorId: koletorId ?? undefined,
            userId: ctx.user.id,
            modalidade: input.modalidade as any,
            valorPrincipal: input.valorPrincipal.toFixed(2),
            taxaJuros: input.taxaJuros.toFixed(4),
            tipoTaxa: input.tipoTaxa as any,
            numeroParcelas: input.numeroParcelas,
            valorParcela: valorParcela.toFixed(2),
            totalContrato,
            multaAtraso: (input.multaAtraso ?? 0).toFixed(4),
            jurosMoraDiario: (input.jurosMoraDiario ?? 0).toFixed(4),
            dataInicio: input.dataInicio,
            dataVencimentoPrimeira: input.dataVencimentoPrimeira,
            diaVencimento: input.diaVencimento,
            descricao: input.descricao,
            observacoes: input.observacoes,
            contaCaixaId: input.contaCaixaId,
          }).returning({ id: contratos.id });
          contratoId = result[0].id;

          // Gerar parcelas via Drizzle
          // Para Tabela Price: juros decrescentes (saldo_devedor × taxa)
          // Para demais modalidades: juros simples = capital × taxa% (constante)
          const isPrice = input.modalidade === 'tabela_price';
          const taxaDecimal = input.taxaJuros / 100;
          let saldoDevedor = input.valorPrincipal;
          const primeiraData = new Date(input.dataVencimentoPrimeira + 'T00:00:00');
          const hoje2 = new Date(); hoje2.setHours(0, 0, 0, 0);
          for (let i = 0; i < input.numeroParcelas; i++) {
            // Calcular juros desta parcela
            let valorJurosParcela: number;
            if (isPrice) {
              valorJurosParcela = Math.round(saldoDevedor * taxaDecimal * 100) / 100;
              const amortizacao = Math.round((valorParcela - valorJurosParcela) * 100) / 100;
              saldoDevedor = Math.max(0, Math.round((saldoDevedor - amortizacao) * 100) / 100);
            } else {
              valorJurosParcela = Math.round(input.valorPrincipal * taxaDecimal * 100) / 100;
            }
            const dataVenc = new Date(primeiraData);
            if (i > 0) {
              if (input.tipoTaxa === 'diaria') dataVenc.setDate(dataVenc.getDate() + i);
              else if (input.tipoTaxa === 'semanal') dataVenc.setDate(dataVenc.getDate() + i * 7);
              else if (input.tipoTaxa === 'quinzenal') dataVenc.setDate(dataVenc.getDate() + i * 15);
              else dataVenc.setMonth(dataVenc.getMonth() + i);
            }
            dataVenc.setHours(0, 0, 0, 0);
            let status: 'pendente' | 'atrasada' | 'vencendo_hoje' = 'pendente';
            if (dataVenc.getTime() < hoje2.getTime()) status = 'atrasada';
            else if (dataVenc.getTime() === hoje2.getTime()) status = 'vencendo_hoje';
            await db.insert(parcelas).values({
              userId: ctx.user.id,
              contratoId,
              clienteId: input.clienteId,
              numeroParcela: i + 1,
              valorOriginal: valorParcela.toFixed(2),
              valorJuros: valorJurosParcela.toFixed(2),
              dataVencimento: dataVenc.toISOString().split('T')[0],
              status,
              contaCaixaId: input.contaCaixaId,
            });
          }
          if (input.contaCaixaId) {
            await db.insert(transacoesCaixa).values({
              userId: ctx.user.id,
              contaCaixaId: input.contaCaixaId,
              tipo: 'saida',
              categoria: 'emprestimo_liberado',
              valor: input.valorPrincipal.toFixed(2),
              descricao: `Empréstimo liberado - Contrato #${contratoId}`,
              contratoId,
              clienteId: input.clienteId,
            });
          }
          return { id: contratoId, valorParcela };
        } catch (err) {
          // Se o contrato já foi criado pelo Drizzle, não fazer fallback (evita double-submit)
          if (contratoId) {
            console.error('[contratos.create] Drizzle parcelas failed after contrato created:', (err as Error).message);
            return { id: contratoId, valorParcela };
          }
          console.error('[contratos.create] Drizzle failed, falling back to REST:', (err as Error).message);
          resetDb();
        }
      }

      // ── Fallback: Supabase REST API ──────────────────────────────────────────
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });

      const { data: contaLiberacao, error: contaLiberacaoErro } = await supabase
        .from('contas_caixa')
        .select('id')
        .eq('id', input.contaCaixaId)
        .eq('user_id', ctx.user.id)
        .maybeSingle();
      if (contaLiberacaoErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: contaLiberacaoErro.message });
      if (!contaLiberacao) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Selecione uma conta de Caixa válida para liberar o empréstimo' });
      }

      const totalContratoRest = parseFloat((valorParcela * input.numeroParcelas).toFixed(2));
      // Calcular data_vencimento = data da ultima parcela
      const _primeiraDataRest = new Date(input.dataVencimentoPrimeira + 'T00:00:00');
      const _ultimaDataRest = new Date(_primeiraDataRest);
      if (input.numeroParcelas > 1) {
        const _n = input.numeroParcelas - 1;
        if (input.tipoTaxa === 'diaria') _ultimaDataRest.setDate(_ultimaDataRest.getDate() + _n);
        else if (input.tipoTaxa === 'semanal') _ultimaDataRest.setDate(_ultimaDataRest.getDate() + _n * 7);
        else if (input.tipoTaxa === 'quinzenal') _ultimaDataRest.setDate(_ultimaDataRest.getDate() + _n * 15);
        else _ultimaDataRest.setMonth(_ultimaDataRest.getMonth() + _n);
      }
      const _dataVencFinal = _ultimaDataRest.toISOString().split('T')[0];
      const { data: contratoData, error: contratoErr } = await supabase
        .from('contratos')
        .insert({
          cliente_id: input.clienteId,
          koletor_id: koletorId,
          modalidade: input.modalidade,
          valor_principal: parseFloat(input.valorPrincipal.toFixed(2)),
          taxa_juros: parseFloat(input.taxaJuros.toFixed(4)),
          tipo_taxa: input.tipoTaxa,
          numero_parcelas: input.numeroParcelas,
          valor_parcela: parseFloat(valorParcela.toFixed(2)),
          total_contrato: totalContratoRest,
          multa_atraso: parseFloat((input.multaAtraso ?? 0).toFixed(4)),
          juros_mora_diario: parseFloat((input.jurosMoraDiario ?? 0).toFixed(4)),
          data_inicio: input.dataInicio,
          data_vencimento_primeira: input.dataVencimentoPrimeira,
          data_vencimento: _dataVencFinal,
          dia_vencimento: input.diaVencimento ?? null,
          descricao: input.descricao ?? null,
          observacoes: input.observacoes ?? null,
          conta_caixa_id: input.contaCaixaId ?? null,
          status: 'ativo',
          user_id: ctx.user.id,
        })
        .select('id')
        .single();
      if (contratoErr || !contratoData) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: contratoErr?.message ?? 'Erro ao criar contrato' });
      contratoId = contratoData.id;

      // Gerar parcelas via REST
      // Para Tabela Price: juros decrescentes (saldo_devedor × taxa)
      // Para demais modalidades: juros simples = capital × taxa% (constante)
      const isPrice2 = input.modalidade === 'tabela_price';
      const taxaDecimal2 = input.taxaJuros / 100;
      let saldoDevedor2 = input.valorPrincipal;
      const primeiraData = new Date(input.dataVencimentoPrimeira + 'T00:00:00');
      const hoje2 = new Date(); hoje2.setHours(0, 0, 0, 0);
      const parcelasPayload = [];
      for (let i = 0; i < input.numeroParcelas; i++) {
        let valorJurosRest: number;
        if (isPrice2) {
          valorJurosRest = Math.round(saldoDevedor2 * taxaDecimal2 * 100) / 100;
          const amortizacao2 = Math.round((valorParcela - valorJurosRest) * 100) / 100;
          saldoDevedor2 = Math.max(0, Math.round((saldoDevedor2 - amortizacao2) * 100) / 100);
        } else {
          valorJurosRest = Math.round(input.valorPrincipal * taxaDecimal2 * 100) / 100;
        }
        const dataVenc = new Date(primeiraData);
        if (i > 0) {
          if (input.tipoTaxa === 'diaria') dataVenc.setDate(dataVenc.getDate() + i);
          else if (input.tipoTaxa === 'semanal') dataVenc.setDate(dataVenc.getDate() + i * 7);
          else if (input.tipoTaxa === 'quinzenal') dataVenc.setDate(dataVenc.getDate() + i * 15);
          else dataVenc.setMonth(dataVenc.getMonth() + i);
        }
        dataVenc.setHours(0, 0, 0, 0);
        let status = 'pendente';
        if (dataVenc.getTime() < hoje2.getTime()) status = 'atrasada';
        else if (dataVenc.getTime() === hoje2.getTime()) status = 'vencendo_hoje';
        parcelasPayload.push({
          contrato_id: contratoId,
          cliente_id: input.clienteId,
          koletor_id: koletorId ?? null,
          numero: i + 1,
          numero_parcela: i + 1,
          valor: parseFloat(valorParcela.toFixed(2)),
          valor_original: parseFloat(valorParcela.toFixed(2)),
          valor_juros: parseFloat(valorJurosRest.toFixed(2)),
          data_vencimento: dataVenc.toISOString().split('T')[0],
          status,
          conta_caixa_id: input.contaCaixaId ?? null,
          user_id: ctx.user.id,
        });
      }
      const { error: parcelasErr } = await supabase.from('parcelas').insert(parcelasPayload);
      if (parcelasErr) {
        await supabase.from('contratos').delete().eq('id', contratoId).eq('user_id', ctx.user.id);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Erro ao criar parcelas: ${parcelasErr.message}` });
      }

      // O banco produtivo não possui `cliente_id` em transacoes_caixa. O helper
      // abaixo usa apenas o schema compatível e gera exatamente uma saída por
      // contrato/conta, sem duplicar o débito no Caixa.
      if (input.contaCaixaId) {
        const { data: desembolsoExistente, error: buscaDesembolsoError } = await supabase
          .from('transacoes_caixa')
          .select('id')
          .eq('contrato_id', contratoId)
          .eq('conta_caixa_id', input.contaCaixaId)
          .eq('tipo', 'saida')
          .eq('categoria', 'emprestimo_liberado')
          .eq('user_id', ctx.user.id)
          .limit(1);
        if (buscaDesembolsoError) {
          await supabase.from('parcelas').delete().eq('contrato_id', contratoId).eq('user_id', ctx.user.id);
          await supabase.from('contratos').delete().eq('id', contratoId).eq('user_id', ctx.user.id);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Não foi possível confirmar o desembolso: ${buscaDesembolsoError.message}` });
        }
        if (deveRegistrarDesembolso((desembolsoExistente?.length ?? 0) > 0)) {
          const { error: desembolsoError } = await supabase.from('transacoes_caixa').insert(
            criarDesembolsoContrato({
              contaCaixaId: input.contaCaixaId,
              contratoId: contratoId!,
              userId: ctx.user.id,
              valorPrincipal: input.valorPrincipal,
            })
          );
          if (desembolsoError) {
            await supabase.from('parcelas').delete().eq('contrato_id', contratoId).eq('user_id', ctx.user.id);
            await supabase.from('contratos').delete().eq('id', contratoId).eq('user_id', ctx.user.id);
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Empréstimo não criado: não foi possível registrar o desembolso no Caixa (${desembolsoError.message})` });
          }
        }
      }

      return { id: contratoId, valorParcela };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(['ativo', 'quitado', 'inadimplente', 'cancelado']) }))
     .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          await db.update(contratos).set({ status: input.status }).where(and(eq(contratos.id, input.id), eq(contratos.userId, ctx.user.id)));
          return { success: true };
        } catch (err) {
          console.warn('[contratos.updateStatus] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data, error } = await supabase.from('contratos').update({ status: input.status }).eq('id', input.id).eq('user_id', ctx.user.id).select('id').maybeSingle();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado' });
      return { success: true };
    }),
  gerarPDF: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      // Buscar dados completos do contrato
      if (!db) {
        // Fallback REST para gerarPDF
        const supabase = await getSupabaseClientAsync();
        if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
        const { data: ctData, error: ctErr } = await supabase
          .from('contratos')
          .select('*, clientes!inner(nome, cpf_cnpj, telefone, whatsapp, chave_pix, endereco, cidade, estado)')
          .eq('id', input.id)
          .eq('user_id', ctx.user.id)
          .single();
        if (ctErr || !ctData) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado' });
        const { data: parcelasData2 } = await supabase.from('parcelas').select('*').eq('contrato_id', input.id).eq('user_id', ctx.user.id).order('numero_parcela');
        const { data: configRows2 } = await supabase.from('configuracoes').select('chave, valor').eq('user_id', ctx.user.id);
        const configMap2: Record<string, string> = {};
        (configRows2 ?? []).forEach((r: any) => { if (r.chave && r.valor) configMap2[r.chave] = r.valor; });
        const c2 = ctData;
        const cli2 = ctData.clientes as any;
        const dataInicio2 = c2.data_inicio ? new Date(c2.data_inicio).toLocaleDateString('pt-BR') : '-';
        const valorPrincipal2 = Number(c2.valor_principal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const valorTotalNum2 = (parcelasData2 ?? []).reduce((sum: number, p: any) => sum + Number(p.valor_original), 0);
        const valorTotal2 = valorTotalNum2 > 0 ? valorTotalNum2.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : valorPrincipal2;
        const valorParcela2 = Number(c2.valor_parcela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const taxaJuros2 = `${c2.taxa_juros}% ${c2.tipo_taxa === 'mensal' ? 'ao mês' : 'ao dia'}`;
        const nomeEmpresa2 = configMap2['nomeEmpresa'] ?? 'CobraPro';
        const html2 = montarHtmlContrato({
          empresa: { nome: nomeEmpresa2 },
          cliente: {
            nome: cli2?.nome,
            cpfCnpj: cli2?.cpf_cnpj,
            telefone: cli2?.telefone,
            chavePix: cli2?.chave_pix,
            endereco: cli2?.endereco,
            cidade: cli2?.cidade,
            estado: cli2?.estado,
          },
          contrato: {
            id: c2.id,
            modalidade: c2.modalidade,
            status: c2.status,
            capital: valorPrincipal2,
            total: valorTotal2,
            taxa: taxaJuros2,
            numeroParcelas: c2.numero_parcelas,
            valorParcela: valorParcela2,
            dataInicio: dataInicio2,
          },
          parcelas: (parcelasData2 ?? []).map((p: any) => ({
            numero: p.numero_parcela,
            vencimento: p.data_vencimento ? new Date(p.data_vencimento).toLocaleDateString('pt-BR') : '-',
            valor: Number(p.valor_original).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            status: p.status,
          })),
          geradoEm: new Date().toLocaleString('pt-BR'),
        });
        return { html: html2, contratoId: c2.id, clienteNome: cli2?.nome ?? '' };
      }
      const rows = await db.select({
        contrato: contratos,
        clienteNome: clientes.nome,
        clienteCpfCnpj: clientes.cpfCnpj,
        clienteTelefone: clientes.telefone,
        clienteWhatsapp: clientes.whatsapp,
        clienteChavePix: clientes.chavePix,
        clienteEndereco: clientes.endereco,
        clienteCidade: clientes.cidade,
        clienteEstado: clientes.estado,
      }).from(contratos)
        .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
        .where(and(eq(contratos.id, input.id), eq(contratos.userId, ctx.user.id))).limit(1);
      const row = rows[0];
      if (!row) throw new Error("Contrato não encontrado");
      // Buscar parcelas
      const parcelasData = await db.select().from(parcelas)
        .where(and(eq(parcelas.contratoId, input.id), eq(parcelas.userId, ctx.user.id)))
        .orderBy(parcelas.numeroParcela);
      // Buscar configurações da empresa
      // Buscar configurações como mapa chave->valor
      const configRows = await db.select().from(configuracoes).where(eq(configuracoes.userId, ctx.user.id));
      const configMap: Record<string, string> = {};
      configRows.forEach(r => { if (r.chave && r.valor) configMap[r.chave] = r.valor; });
      const c = row.contrato;
      const dataInicio = c.dataInicio ? new Date(c.dataInicio).toLocaleDateString('pt-BR') : '-';
      const valorPrincipal = Number(c.valorPrincipal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      // Calcular valor total a partir das parcelas
      const valorTotalNum = parcelasData.reduce((sum, p) => sum + Number(p.valorOriginal), 0);
      const valorTotal = valorTotalNum > 0
        ? valorTotalNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : valorPrincipal;
      const valorParcela = Number(c.valorParcela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const taxaJuros = `${c.taxaJuros}% ${c.tipoTaxa === 'mensal' ? 'ao mês' : 'ao dia'}`;
      const nomeEmpresa = configMap['nome_empresa'] ?? configMap['nomeEmpresa'] ?? 'CobraPro';
      const cnpjEmpresa = configMap['cnpj'] ?? '';
      const enderecoEmpresa = configMap['endereco'] ?? '';
      const html = montarHtmlContrato({
        empresa: { nome: nomeEmpresa, cnpj: cnpjEmpresa, endereco: enderecoEmpresa },
        cliente: {
          nome: row.clienteNome,
          cpfCnpj: row.clienteCpfCnpj,
          telefone: row.clienteTelefone,
          chavePix: row.clienteChavePix,
          endereco: row.clienteEndereco,
          cidade: row.clienteCidade,
          estado: row.clienteEstado,
        },
        contrato: {
          id: c.id,
          modalidade: c.modalidade,
          status: c.status,
          capital: valorPrincipal,
          total: valorTotal,
          taxa: taxaJuros,
          numeroParcelas: c.numeroParcelas,
          valorParcela,
          descricao: c.descricao,
          dataInicio,
        },
        parcelas: parcelasData.map((p) => ({
          numero: p.numeroParcela,
          vencimento: p.dataVencimento ? new Date(p.dataVencimento).toLocaleDateString('pt-BR') : '-',
          valor: Number(p.valorOriginal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          status: p.status,
        })),
        geradoEm: new Date().toLocaleString('pt-BR'),
      });
      return { html, contratoId: c.id, clienteNome: row.clienteNome };
    }),

  deletar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          // IMPORTANTE: deletar na ordem correta para evitar FK constraints:
          // 1. transacoes_caixa (referencia parcelas)
          // 2. parcelas (referencia contratos)
          // 3. contratos
          await db.delete(transacoesCaixa).where(and(eq(transacoesCaixa.contratoId, input.id), eq(transacoesCaixa.userId, ctx.user.id)));
          await db.delete(parcelas).where(and(eq(parcelas.contratoId, input.id), eq(parcelas.userId, ctx.user.id)));
          await db.delete(contratos).where(and(eq(contratos.id, input.id), eq(contratos.userId, ctx.user.id)));
          return { success: true };
        } catch (err: any) {
          console.warn('[contratos.deletar] Drizzle failed, trying REST:', err.message);
          resetDb();
        }
      }
      // Fallback: Supabase REST
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      // IMPORTANTE: deletar na ordem correta para evitar FK constraints
      // 1. transacoes_caixa que referenciam parcelas deste contrato
      await supabase.from('transacoes_caixa').delete().eq('contrato_id', input.id).eq('user_id', ctx.user.id);
      // 2. parcelas do contrato
      await supabase.from('parcelas').delete().eq('contrato_id', input.id).eq('user_id', ctx.user.id);
      // 3. contrato
      const { error } = await supabase.from('contratos').delete().eq('id', input.id).eq('user_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  editar: protectedProcedure
    .input(z.object({
      id: z.number(),
      valorPrincipal: z.number().positive(),
      taxaJuros: z.string(),
      tipoTaxa: z.string(),
      numeroParcelas: z.number().int().positive(),
      dataInicio: z.string().optional(),
      dataPrimeiraParcela: z.string().optional(),
      datasParcelasCustom: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          const contratoAtualizado = await db.update(contratos).set({
            valorPrincipal: input.valorPrincipal.toString(),
            taxaJuros: input.taxaJuros,
            tipoTaxa: input.tipoTaxa as 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'anual',
            numeroParcelas: input.numeroParcelas,
          }).where(and(eq(contratos.id, input.id), eq(contratos.userId, ctx.user.id))).returning({ id: contratos.id });
          if (contratoAtualizado.length !== 1) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado para esta empresa' });

          // Atualizar parcelas pendentes com nova data se fornecida
          if (input.datasParcelasCustom && input.datasParcelasCustom.length > 0) {
            const parcelasPendentes = await db.select().from(parcelas)
              .where(and(eq(parcelas.contratoId, input.id), eq(parcelas.userId, ctx.user.id), inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje'])))
              .orderBy(parcelas.numeroParcela);
            for (let i = 0; i < parcelasPendentes.length; i++) {
              if (input.datasParcelasCustom[i]) {
                await db.update(parcelas).set({ dataVencimento: input.datasParcelasCustom[i] }).where(and(eq(parcelas.id, parcelasPendentes[i].id), eq(parcelas.userId, ctx.user.id)));
              }
            }
          } else if (input.dataPrimeiraParcela) {
            // Recalcular datas de todas as parcelas pendentes a partir da nova 1ª parcela
            const parcelasPendentes = await db.select().from(parcelas)
              .where(and(eq(parcelas.contratoId, input.id), eq(parcelas.userId, ctx.user.id), inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje'])))
              .orderBy(parcelas.numeroParcela);
            if (parcelasPendentes.length > 0) {
              const baseDate = new Date(input.dataPrimeiraParcela + 'T00:00:00');
              for (let i = 0; i < parcelasPendentes.length; i++) {
                const novaData = new Date(baseDate);
                if (input.tipoTaxa === 'diaria') novaData.setDate(novaData.getDate() + i);
                else if (input.tipoTaxa === 'semanal') novaData.setDate(novaData.getDate() + i * 7);
                else if (input.tipoTaxa === 'quinzenal') novaData.setDate(novaData.getDate() + i * 15);
                else if (input.tipoTaxa === 'anual') novaData.setFullYear(novaData.getFullYear() + i);
                else novaData.setMonth(novaData.getMonth() + i);
                await db.update(parcelas).set({ dataVencimento: novaData.toISOString() }).where(and(eq(parcelas.id, parcelasPendentes[i].id), eq(parcelas.userId, ctx.user.id)));
              }
            }
          }
          return { success: true };
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          console.warn('[contratos.editar] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data: contratoAtualizado, error } = await supabase.from('contratos').update({
        valor_principal: input.valorPrincipal,
        taxa_juros: input.taxaJuros,
        tipo_taxa: input.tipoTaxa,
        numero_parcelas: input.numeroParcelas,
      }).eq('id', input.id).eq('user_id', ctx.user.id).select('id').maybeSingle();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      if (!contratoAtualizado) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado para esta empresa' });

      // Atualizar datas das parcelas pendentes via Supabase
      if (input.datasParcelasCustom && input.datasParcelasCustom.length > 0) {
        const { data: parcelasPendentes } = await supabase.from('parcelas')
          .select('id, numero_parcela')
          .eq('contrato_id', input.id)
          .eq('user_id', ctx.user.id)
          .in('status', ['pendente', 'atrasada', 'vencendo_hoje'])
          .order('numero_parcela', { ascending: true });
        for (let i = 0; i < (parcelasPendentes ?? []).length; i++) {
          if (input.datasParcelasCustom[i]) {
            await supabase.from('parcelas').update({ data_vencimento: input.datasParcelasCustom[i] }).eq('id', parcelasPendentes![i].id).eq('user_id', ctx.user.id);
          }
        }
      } else if (input.dataPrimeiraParcela) {
        // Recalcular datas de todas as parcelas pendentes a partir da nova 1ª parcela
        const { data: parcelasPendentes } = await supabase.from('parcelas')
          .select('id, numero_parcela')
          .eq('contrato_id', input.id)
          .eq('user_id', ctx.user.id)
          .in('status', ['pendente', 'atrasada', 'vencendo_hoje'])
          .order('numero_parcela', { ascending: true });
        if (parcelasPendentes && parcelasPendentes.length > 0) {
          const baseDate = new Date(input.dataPrimeiraParcela + 'T00:00:00');
          for (let i = 0; i < parcelasPendentes.length; i++) {
            const novaData = new Date(baseDate);
            if (input.tipoTaxa === 'diaria') novaData.setDate(novaData.getDate() + i);
            else if (input.tipoTaxa === 'semanal') novaData.setDate(novaData.getDate() + i * 7);
            else if (input.tipoTaxa === 'quinzenal') novaData.setDate(novaData.getDate() + i * 15);
            else if (input.tipoTaxa === 'anual') novaData.setFullYear(novaData.getFullYear() + i);
            else novaData.setMonth(novaData.getMonth() + i);
            await supabase.from('parcelas').update({ data_vencimento: novaData.toISOString() }).eq('id', parcelasPendentes[i].id).eq('user_id', ctx.user.id);
          }
        }
      }
      return { success: true };
    }),

  pagarTotal: protectedProcedure
    .input(z.object({ id: z.number(), valor: z.number() }))
    .mutation(async () => {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'A quitação total legada foi desativada por segurança. Registre cada parcela pelo fluxo de recebimento, que garante o lançamento no Caixa.',
      });
    }),

  editarJuros: protectedProcedure
    .input(z.object({ id: z.number(), novaTaxa: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          const contratoAtualizado = await db.update(contratos).set({ taxaJuros: input.novaTaxa })
            .where(and(eq(contratos.id, input.id), eq(contratos.userId, ctx.user.id)))
            .returning({ id: contratos.id });
          if (contratoAtualizado.length !== 1) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado para esta empresa' });
          return { success: true };
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          console.warn('[contratos.editarJuros] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
       const { data: contratoAtualizado, error } = await supabase.from('contratos').update({ taxa_juros: input.novaTaxa }).eq('id', input.id).eq('user_id', ctx.user.id).select('id').maybeSingle();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      if (!contratoAtualizado) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado para esta empresa' });
      await registrarHistorico({ contratoId: input.id, userId: String(ctx.user.id), tipo: 'edicao_juros', descricao: `Taxa de juros alterada para ${input.novaTaxa}%`, valorNovo: input.novaTaxa });
      return { success: true };
    }),
  historico: protectedProcedure
    .input(z.object({ contratoId: z.number() }))
    .query(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) return [];
      const { data, error } = await sb
        .from('contrato_historico')
        .select('*')
        .eq('contrato_id', input.contratoId)
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) return [];
      return (data ?? []).map((h: any) => ({
        id: h.id,
        tipo: h.tipo as string,
        descricao: h.descricao as string,
        valorAnterior: h.valor_anterior as string | null,
        valorNovo: h.valor_novo as string | null,
        createdAt: h.created_at as string,
      }));
    }),

  aplicarMulta: protectedProcedure
    .input(z.object({ id: z.number(), multa: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const hoje = dataHojeBrasilia();
      if (db) {
        try {
          const contrato = await db.select({ id: contratos.id }).from(contratos).where(and(
            eq(contratos.id, input.id),
            eq(contratos.userId, ctx.user.id),
          )).limit(1);
          if (!contrato[0]) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado para esta empresa' });
          const parcelasAtraso = await db.select().from(parcelas).where(and(
            eq(parcelas.contratoId, input.id),
            eq(parcelas.userId, ctx.user.id),
            inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje']),
            lt(sql`DATE(${parcelas.dataVencimento})`, hoje)
          ));
          for (const parcela of parcelasAtraso) {
            const multaAtual = parcela.valorMulta ? parseFloat(parcela.valorMulta) : 0;
            await db.update(parcelas).set({ valorMulta: (multaAtual + parseFloat(input.multa)).toString() }).where(and(eq(parcelas.id, parcela.id), eq(parcelas.userId, ctx.user.id)));
          }
          return { success: true };
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          console.warn('[contratos.aplicarMulta] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      // Verificar que o contrato pertence ao usuário antes de aplicar multa
      const { data: contrato, error: contratoErro } = await supabase.from('contratos').select('id')
        .eq('id', input.id).eq('user_id', ctx.user.id).maybeSingle();
      if (contratoErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: contratoErro.message });
      if (!contrato) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado para esta empresa' });
      const { data: pAtraso } = await supabase.from('parcelas').select('id, valor_multa').eq('contrato_id', input.id).eq('user_id', ctx.user.id).in('status', ['pendente', 'atrasada', 'vencendo_hoje']).lt('data_vencimento', hoje);
      for (const parcela of (pAtraso ?? [])) {
        const multaAtual = parcela.valor_multa ? parseFloat(parcela.valor_multa) : 0;
        await supabase.from('parcelas').update({ valor_multa: (multaAtual + parseFloat(input.multa)).toString() }).eq('id', parcela.id).eq('user_id', ctx.user.id);
      }
      if ((pAtraso?.length ?? 0) > 0) {
        await registrarHistorico({ contratoId: input.id, userId: String(ctx.user.id), tipo: 'aplicacao_multa', descricao: `Multa de R$ ${input.multa} aplicada nas parcelas em atraso`, valorNovo: input.multa });
      }
      return { success: true };
    }),
});
// ─── PARCELAS ────────────────────────────────────────────────────────────────
const parcelasRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      clienteId: z.number().optional(),
      contratoId: z.number().optional(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
      modalidade: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const hoje = dataHojeBrasilia();

      if (db) {
        try {
          // Atualizar status das parcelas atrasadas
          await db.update(parcelas)
            .set({ status: 'atrasada' })
            .where(and(
              lt(sql`DATE(data_vencimento)`, hoje),
              eq(parcelas.userId, ctx.user.id),
              inArray(parcelas.status, ['pendente', 'vencendo_hoje'])
            ));
          await db.update(parcelas)
            .set({ status: 'vencendo_hoje' })
            .where(and(
              eq(sql`DATE(data_vencimento)`, hoje),
              eq(parcelas.userId, ctx.user.id),
              eq(parcelas.status, 'pendente')
            ));

          const rows = await db.select({
            id: parcelas.id,
            contratoId: parcelas.contratoId,
            clienteId: parcelas.clienteId,
            clienteNome: clientes.nome,
            clienteWhatsapp: clientes.whatsapp,
            clienteChavePix: clientes.chavePix,
            numeroParcela: parcelas.numeroParcela,
            valorOriginal: parcelas.valorOriginal,
            valorPago: parcelas.valorPago,
            valorJuros: parcelas.valorJuros,
            valorMulta: parcelas.valorMulta,
            saldoResidual: parcelas.saldoResidual,
            dataVencimento: parcelas.dataVencimento,
            dataPagamento: parcelas.dataPagamento,
            status: parcelas.status,
            modalidade: contratos.modalidade,
            numeroParcelas: contratos.numeroParcelas,
            taxaJuros: contratos.taxaJuros,
            tipoTaxa: contratos.tipoTaxa,
            valorPrincipal: contratos.valorPrincipal,
            koletorId: contratos.koletorId,
          }).from(parcelas)
            .innerJoin(clientes, eq(parcelas.clienteId, clientes.id))
            .innerJoin(contratos, eq(parcelas.contratoId, contratos.id))
            .where(eq(parcelas.userId, ctx.user.id))
            .orderBy(parcelas.dataVencimento);
          // Buscar perfil do cobrador (se for cobrador, filtrar apenas suas parcelas)
          let myKoletorId: number | null = null;
          try {
            const supabaseForPerfil = await getSupabaseClientAsync();
            if (supabaseForPerfil) {
              const { data: koletorData } = await supabaseForPerfil.from('koletores').select('id, perfil').eq('user_id', ctx.user.id).single();
              if (koletorData?.perfil === 'koletor') myKoletorId = koletorData.id;
            }
          } catch (_) { /* não é cobrador */ }
          return rows.filter(r => {
            if (myKoletorId !== null) {
              // Verificar se a parcela pertence ao cobrador via contrato
              const contratoDoKoletor = rows.some(row => row.contratoId === r.contratoId && row.koletorId === myKoletorId);
              if (!contratoDoKoletor) return false;
            }
            if (input?.status && r.status !== input.status) return false;
            if (input?.clienteId && r.clienteId !== input.clienteId) return false;
            if (input?.contratoId && r.contratoId !== input.contratoId) return false;
            if (input?.modalidade && r.modalidade !== input.modalidade) return false;
            return true;
          });
        } catch (err) {
          console.warn('[parcelas.list] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }

       // Fallback: Supabase REST
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return [];
      // Buscar perfil do cobrador
      let myKoletorId: number | null = null;
      try {
        const { data: koletorData } = await supabase.from('koletores').select('id, perfil').eq('user_id', ctx.user.id).single();
        if (koletorData?.perfil === 'koletor') myKoletorId = koletorData.id;
      } catch (_) { /* não é cobrador */ }
      // Atualizar status via REST
      await supabase.from('parcelas').update({ status: 'atrasada' })
        .lt('data_vencimento', hoje).eq('user_id', ctx.user.id).in('status', ['pendente', 'vencendo_hoje']);
      await supabase.from('parcelas').update({ status: 'vencendo_hoje' })
        .eq('data_vencimento', hoje).eq('user_id', ctx.user.id).eq('status', 'pendente');
      let pQuery = supabase.from('parcelas')
        .select('id, contrato_id, cliente_id, numero_parcela, valor_original, valor_pago, valor_juros, valor_multa, saldo_residual, data_vencimento, data_pagamento, status, contratos(koletor_id)')
        .order('data_vencimento')
        .eq('user_id', ctx.user.id);
      if (input?.status) pQuery = (pQuery as any).eq('status', input.status);
      if (input?.clienteId) pQuery = (pQuery as any).eq('cliente_id', input.clienteId);
      if (input?.contratoId) pQuery = (pQuery as any).eq('contrato_id', input.contratoId);
      if (myKoletorId !== null) pQuery = (pQuery as any).eq('contratos.koletor_id', myKoletorId);

      const { data: pData, error: pError } = await pQuery;
      if (pError) { console.error('[parcelas.list] REST error:', pError.message); return []; }
      const parcelasData = (pData || []).filter((p: any) => {
        if (myKoletorId !== null && p.contratos?.koletor_id !== myKoletorId) return false;
        return true;
      });
      // Filtro de modalidade no REST (aplicado após buscar contratos)
      // Será aplicado após montar contratosMap abaixo

      // Buscar clientes e contratos relacionados
      const clienteIds = Array.from(new Set(parcelasData.map((r: any) => r.cliente_id).filter(Boolean)));
      const contratoIds = Array.from(new Set(parcelasData.map((r: any) => r.contrato_id).filter(Boolean)));

      const clientesMap: Record<number, any> = {};
      const contratosMap: Record<number, any> = {};

      if (clienteIds.length > 0) {
        const { data: cData } = await supabase.from('clientes').select('id, nome, whatsapp, chave_pix').in('id', clienteIds).eq('user_id', ctx.user.id);
        (cData || []).forEach((c: any) => { clientesMap[c.id] = c; });
      }
      if (contratoIds.length > 0) {
        const { data: ctData } = await supabase.from('contratos').select('id, modalidade, numero_parcelas, taxa_juros, tipo_taxa, valor_principal').in('id', contratoIds).eq('user_id', ctx.user.id);
        (ctData || []).forEach((c: any) => { contratosMap[c.id] = c; });
      }

      const resultData = input?.modalidade
        ? parcelasData.filter((r: any) => contratosMap[r.contrato_id]?.modalidade === input.modalidade)
        : parcelasData;

      // Calcular o total real de parcelas por contrato (maior numero_parcela existente)
      const totalParcelasMap: Record<number, number> = {};
      parcelasData.forEach((r: any) => {
        const contratoId = r.contrato_id;
        const num = r.numero_parcela ?? 0;
        if (!totalParcelasMap[contratoId] || num > totalParcelasMap[contratoId]) {
          totalParcelasMap[contratoId] = num;
        }
      });

      return resultData.map((r: any) => ({
        id: r.id,
        contratoId: r.contrato_id,
        clienteId: r.cliente_id,
        clienteNome: clientesMap[r.cliente_id]?.nome ?? '',
        clienteWhatsapp: clientesMap[r.cliente_id]?.whatsapp ?? null,
        clienteChavePix: clientesMap[r.cliente_id]?.chave_pix ?? null,
        numeroParcela: r.numero_parcela,
        valorOriginal: r.valor_original,
        valorPago: r.valor_pago,
        valorJuros: r.valor_juros,
        valorMulta: r.valor_multa,
        saldoResidual: r.saldo_residual,
        dataVencimento: r.data_vencimento,
        dataPagamento: r.data_pagamento,
        status: r.status,
        modalidade: contratosMap[r.contrato_id]?.modalidade ?? null,
        numeroParcelas: totalParcelasMap[r.contrato_id] ?? contratosMap[r.contrato_id]?.numero_parcelas ?? null,
        taxaJuros: contratosMap[r.contrato_id]?.taxa_juros ?? null,
        tipoTaxa: contratosMap[r.contrato_id]?.tipo_taxa ?? null,
        valorPrincipal: contratosMap[r.contrato_id]?.valor_principal ?? null,
      }));
    }),

  registrarPagamento: protectedProcedure
    .input(z.object({
      parcelaId: z.number(),
      valorPago: z.number().positive(),
      contaCaixaId: z.number().optional(),
      observacoes: z.string().optional(),
      desconto: z.number().min(0).max(999_999_999).default(0),
      valorJurosCustom: z.number().min(0).max(999_999_999).optional(),   // juros de atraso editado manualmente
      dataPagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // data manual no formato YYYY-MM-DD
      // Mantido no contrato da API para clientes já abertos, porém ignorado.
      // O saldo de um pagamento parcial passa a permanecer na própria parcela.
      transferirSaldoResidual: z.boolean().default(false),
      idempotencyKey: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados indisponível' });
      if (!input.contaCaixaId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Selecione uma conta de caixa para registrar o recebimento' });
      await validarContaDoUsuario(ctx.user.id, input.contaCaixaId);
      // Autorizar a origem antes de gravar a reserva de idempotência. Um ID de
      // outra empresa não pode criar nenhum estado operacional no tenant atual.
      const { data: parcelaAutorizada, error: parcelaAutorizadaErro } = await sb.from('parcelas')
        .select('id').eq('id', input.parcelaId).eq('user_id', ctx.user.id).maybeSingle();
      if (parcelaAutorizadaErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: parcelaAutorizadaErro.message });
      if (!parcelaAutorizada) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });
      const chaveIdempotencia = input.idempotencyKey ?? criarChaveIdempotencia();
      const reserva = await reservarOperacaoFinanceira({
        userId: ctx.user.id,
        tipo: 'recebimento_parcela',
        chaveIdempotencia,
        payload: {
          parcelaId: input.parcelaId,
          valorPago: input.valorPago,
          contaCaixaId: input.contaCaixaId,
          desconto: input.desconto,
          valorJurosCustom: input.valorJurosCustom ?? null,
          dataPagamento: input.dataPagamento ?? dataHojeBrasilia(),
          observacoes: input.observacoes ?? null,
        },
      });
      if (reserva.repetida) return { success: true, repetida: true, ...(reserva.resultado ?? {}) } as any;

      let financeiroConfirmado = false;
      try {
      // Buscar parcela
      const { data: parcelaData, error: parcelaErr } = await sb.from('parcelas').select('*').eq('id', input.parcelaId).eq('user_id', ctx.user.id).single();
      if (parcelaErr || !parcelaData) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });
      if (parcelaData.status === 'paga') throw new TRPCError({ code: 'CONFLICT', message: 'Esta parcela já foi quitada' });

      // Buscar configuração de mora do usuário. Sem ativação explícita não há
      // juros automáticos no pagamento, para coincidir com a tela de Parcelas.
      let multaDiariaReais = 0;
      let multaAtrasoPercentual = 0;
      try {
        const { data: configRows } = await sb.from('configuracoes').select('chave, valor').eq('user_id', ctx.user.id);
        if (configRows) {
          const configMap: Record<string, string> = {};
          for (const r of configRows) configMap[r.chave] = r.valor ?? '';
          const automatico = configMap['jurosMultaAutomatico'] === 'true' || configMap['juros_multa_automatico'] === 'true';
          if (automatico) {
            const diaria = Number.parseFloat(configMap['multaDiaria'] ?? configMap['multa_diaria'] ?? '0');
            const percentual = Number.parseFloat(configMap['multaPadrao'] ?? configMap['multa_padrao'] ?? '0');
            multaDiariaReais = Number.isFinite(diaria) && diaria > 0 ? diaria : 0;
            multaAtrasoPercentual = Number.isFinite(percentual) && percentual > 0 ? percentual : 0;
          }
        }
      } catch (_) { /* usa padrão 0 */ }

      const valorOriginal = parseFloat(parcelaData.valor_original);
      const saldoResidualAnterior = parseFloat(parcelaData.saldo_residual ?? '0');
      const estadoParcelaAnterior = {
        valor_pago: parcelaData.valor_pago,
        valor_juros: parcelaData.valor_juros,
        valor_multa: parcelaData.valor_multa,
        valor_desconto: parcelaData.valor_desconto,
        multa_diaria_usada: parcelaData.multa_diaria_usada,
        data_pagamento: parcelaData.data_pagamento,
        status: parcelaData.status,
        saldo_residual: parcelaData.saldo_residual,
        conta_caixa_id: parcelaData.conta_caixa_id,
        observacoes: parcelaData.observacoes,
      };
      const parcelaJaParcial = parcelaData.status === 'parcial' && saldoResidualAnterior > 0;
      // Em pagamentos parciais, saldo_residual já é a dívida remanescente.
      // Somá-lo novamente ao principal duplicaria o valor cobrado.
      const valorTotalDevido = parcelaJaParcial ? saldoResidualAnterior : valorOriginal + saldoResidualAnterior;

      // Calcular juros de atraso usando multaDiaria em R$/dia (modelo CobraFácil)
      const dataReferencia = input.dataPagamento ?? dataHojeBrasilia();
      const dataPagamentoDate = new Date(`${dataReferencia}T12:00:00-03:00`);
      const { juros: jurosCalculado, multa } = parcelaJaParcial
        ? { juros: 0, multa: 0 }
        : calcularJurosMora(
            valorTotalDevido,
            new Date(parcelaData.data_vencimento + 'T12:00:00-03:00'),
            dataPagamentoDate,
            multaDiariaReais,
            multaAtrasoPercentual,
          );

      // Usar juros customizado se fornecido pelo usuário, senão usar o calculado
      const juros = input.valorJurosCustom !== undefined ? input.valorJurosCustom : jurosCalculado;

      // Data de pagamento
      const dataPagamentoISO = dataCivilBrasiliaParaIso(dataReferencia);
      const dataPagamentoStr = dataReferencia;

      // Determinar status e saldo residual
      const valorTotalComJuros = valorTotalDevido + juros + multa - input.desconto;
      if (valorTotalComJuros < 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'O desconto não pode superar o valor devido' });
      }
      if (input.valorPago > valorTotalComJuros + 0.000001) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'O valor informado supera o saldo devido; registre um ajuste separado se houver crédito' });
      }
      const isPago = input.valorPago >= valorTotalComJuros - 0.01; // tolerância de 1 centavo
      const novoStatus = isPago ? 'paga' : 'parcial';
      const valorPagoAnterior = Number.parseFloat(parcelaData.valor_pago ?? '0') || 0;
      const valorPagoAcumulado = Math.round((valorPagoAnterior + input.valorPago) * 100) / 100;

      // Calcular saldo residual (quanto falta pagar)
      const saldoRestante = isPago ? 0 : calcularSaldoResidual(valorTotalComJuros, input.valorPago);

      // Atualizar parcela atual
      // A condição de status torna a baixa atômica: uma segunda solicitação
      // concorrente não consegue registrar outro recebimento após a primeira
      // mudar a parcela para paga/parcial.
      const { data: parcelaAtualizada, error: updateErr } = await sb.from('parcelas').update({
        valor_pago: valorPagoAcumulado.toFixed(2),
        valor_juros: juros.toFixed(2),
        valor_multa: multa.toFixed(2),
        valor_desconto: input.desconto.toFixed(2),
        multa_diaria_usada: multaDiariaReais.toFixed(2),
        saldo_residual: saldoRestante.toFixed(2),
        data_pagamento: dataPagamentoISO,
        status: novoStatus,
        conta_caixa_id: input.contaCaixaId ?? null,
        observacoes: input.observacoes ?? null,
      }).eq('id', input.parcelaId).eq('user_id', ctx.user.id)
        .in('status', ['pendente', 'atrasada', 'vencendo_hoje', 'parcial'])
        .select('id').maybeSingle();
      if (updateErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updateErr.message });
      if (!parcelaAtualizada) throw new TRPCError({ code: 'CONFLICT', message: 'Esta parcela já foi processada ou não pertence a esta empresa' });

      // Registrar uma única entrada no caixa, vinculada à operação idempotente.
      {
        const { data: transacaoCriada, error: txErr } = await sb.from('transacoes_caixa').insert({
          conta_caixa_id: input.contaCaixaId,
          tipo: 'entrada',
          categoria: 'pagamento_parcela',
          valor: input.valorPago.toFixed(2),
          descricao: `Pagamento parcela #${parcelaData.numero_parcela} - Contrato #${parcelaData.contrato_id}${saldoRestante > 0 ? ` (parcial, falta R$ ${saldoRestante.toFixed(2)})` : ''}`,
          parcela_id: input.parcelaId,
          contrato_id: parcelaData.contrato_id,
          data_transacao: dataPagamentoStr,
          user_id: ctx.user.id,
        }).select('id').maybeSingle();
        if (txErr) {
          const { error: rollbackErr } = await sb.from('parcelas').update(estadoParcelaAnterior)
            .eq('id', input.parcelaId).eq('user_id', ctx.user.id);
          if (rollbackErr) {
            console.error('[Financeiro] Falha grave ao reverter parcela após erro no Caixa:', rollbackErr.message);
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: txErr.message });
        }
        if (!transacaoCriada?.id) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'O lançamento no Caixa não retornou confirmação' });
        financeiroConfirmado = true;
      }

      const resultado = {
        status: novoStatus,
        saldoResidual: saldoRestante,
        parcelaId: input.parcelaId,
        confirmadoFinanceiro: true,
      };
      const descHistorico = novoStatus === 'paga'
        ? `Parcela #${parcelaData.numero_parcela} quitada - R$ ${input.valorPago.toFixed(2)}`
        : `Parcela #${parcelaData.numero_parcela} paga parcialmente - R$ ${input.valorPago.toFixed(2)} (saldo pendente nesta parcela: R$ ${saldoRestante.toFixed(2)})`;

      const pendenciasPosConfirmacao = await executarEfeitosPosConfirmacao([
        {
          etapa: 'status do contrato', codigo: 'status_contrato', executar: async () => {
            const { data: pendentes, error: pendentesErr } = await sb.from('parcelas')
              .select('id')
              .eq('contrato_id', parcelaData.contrato_id)
              .eq('user_id', ctx.user.id)
              .in('status', ['pendente', 'atrasada', 'vencendo_hoje', 'parcial']);
            if (pendentesErr) throw new Error(pendentesErr.message);
            if ((pendentes?.length ?? 0) === 0) {
              const { data: contratoAtualizado, error: contratoStatusErr } = await sb.from('contratos')
                .update({ status: 'quitado' }).eq('id', parcelaData.contrato_id).eq('user_id', ctx.user.id)
                .select('id').maybeSingle();
              if (contratoStatusErr) throw new Error(contratoStatusErr.message);
              if (!contratoAtualizado) throw new Error('Contrato não encontrado ao concluir quitação');
            }
          },
        },
        {
          etapa: 'histórico do contrato', codigo: 'historico_contrato', executar: async () => {
            const historico = await registrarHistorico({
              contratoId: parcelaData.contrato_id,
              userId: String(parcelaData.user_id ?? parcelaData.koletor_id ?? ''),
              tipo: 'pagamento',
              descricao: descHistorico,
              valorNovo: input.valorPago.toFixed(2),
            });
            if (!historico.ok) throw new Error(historico.erro ?? 'Histórico não confirmado');
          },
        },
        {
          etapa: 'auditoria financeira', codigo: 'auditoria_financeira', executar: () => registrarAuditoriaFinanceira({
            userId: ctx.user.id, operacaoId: reserva.id, acao: 'registrar_pagamento_parcela', entidade: 'parcelas', entidadeId: input.parcelaId,
            detalhes: { valorPago: input.valorPago, contaCaixaId: input.contaCaixaId, status: novoStatus, saldoResidual: saldoRestante, dataPagamento: dataReferencia },
          }),
        },
      ]);
      const pendenciasIdempotencia = await executarEfeitosPosConfirmacao([{
        etapa: 'idempotência da operação',
        codigo: 'idempotencia_pendente',
        executar: () => concluirOperacaoFinanceira(reserva.id, { ...resultado, pendenciasPosConfirmacao }),
      }]);
      pendenciasPosConfirmacao.push(...pendenciasIdempotencia);
      return { success: true, repetida: false, operationId: reserva.id, ...resultado, pendenciasPosConfirmacao };
      } catch (error) {
        if (!financeiroConfirmado) {
          await falharOperacaoFinanceira(reserva.id, error);
        } else {
          console.error('[Financeiro] Erro inesperado após confirmação de pagamento:', error);
        }
        throw error;
      }
    }),

  // Pagar apenas os juros do período e renovar a parcela por mais um período
  pagarJuros: protectedProcedure
    .input(z.object({
      parcelaId: z.number(),
      valorJurosPago: z.number().positive(),
      contaCaixaId: z.number().optional(),
      observacoes: z.string().optional(),
      novaDataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD — sobrescreve o cálculo automático
      novoValorParcela: z.number().positive().optional(), // sobrescreve o valor original da nova parcela
      idempotencyKey: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.contaCaixaId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Selecione uma conta de caixa para registrar o recebimento' });
      await validarContaDoUsuario(ctx.user.id, input.contaCaixaId);
      // A reserva só é criada depois de confirmar que a parcela pertence à
      // empresa autenticada. Isso impede operações órfãs com IDs externos.
      const supabaseAutorizacao = await getSupabaseClientAsync();
      if (!supabaseAutorizacao) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data: parcelaAutorizada, error: parcelaAutorizadaErro } = await supabaseAutorizacao.from('parcelas')
        .select('id').eq('id', input.parcelaId).eq('user_id', ctx.user.id).maybeSingle();
      if (parcelaAutorizadaErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: parcelaAutorizadaErro.message });
      if (!parcelaAutorizada) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });
      const reserva = await reservarOperacaoFinanceira({
        userId: ctx.user.id,
        tipo: 'renovacao_juros',
        chaveIdempotencia: input.idempotencyKey ?? criarChaveIdempotencia(),
        payload: {
          parcelaId: input.parcelaId,
          valorJurosPago: input.valorJurosPago,
          contaCaixaId: input.contaCaixaId,
          novaDataVencimento: input.novaDataVencimento ?? null,
          novoValorParcela: input.novoValorParcela ?? null,
          observacoes: input.observacoes ?? null,
        },
      });
      if (reserva.repetida) return { success: true, repetida: true, ...(reserva.resultado ?? {}) } as any;
      try {
      const db = await getDb();

      // Buscar parcela
      const fetchParcela = async () => {
        if (db) {
          const rows = await db.select().from(parcelas).where(and(eq(parcelas.id, input.parcelaId), eq(parcelas.userId, ctx.user.id))).limit(1);
          return rows[0] ?? null;
        }
        const supabase = await getSupabaseClientAsync();
        if (!supabase) return null;
        const { data } = await supabase.from('parcelas').select('*').eq('id', input.parcelaId).eq('user_id', ctx.user.id).single();
        return data ? {
          id: data.id, contratoId: data.contrato_id, clienteId: data.cliente_id,
          numeroParcela: data.numero_parcela, valorOriginal: data.valor_original,
          dataVencimento: data.data_vencimento, status: data.status,
          contaCaixaId: data.conta_caixa_id, koletorId: data.koletor_id,
          contagemRenovacoes: data.contagem_renovacoes,
          valorPago: data.valor_pago, dataPagamento: data.data_pagamento, observacoes: data.observacoes,
        } : null;
      };

      const parcela = await fetchParcela();
      if (!parcela) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });
      if (!podeRegistrarMovimento(parcela.status, ['pendente', 'atrasada', 'vencendo_hoje'])) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Esta parcela já foi processada' });
      }

      // Buscar contrato para saber a modalidade e o intervalo
      const fetchContrato = async () => {
        if (db) {
          const rows = await db.select().from(contratos).where(and(eq(contratos.id, parcela.contratoId), eq(contratos.userId, ctx.user.id))).limit(1);
          return rows[0] ?? null;
        }
        const supabase = await getSupabaseClientAsync();
        if (!supabase) return null;
        const { data } = await supabase.from('contratos').select('*').eq('id', parcela.contratoId).eq('user_id', ctx.user.id).single();
        return data ? {
          id: data.id, modalidade: data.modalidade, tipoTaxa: data.tipo_taxa,
          taxaJuros: data.taxa_juros, valorPrincipal: data.valor_principal,
          valorParcela: data.valor_parcela,
          numeroParcelas: data.numero_parcelas, clienteId: data.cliente_id,
          koletorId: data.koletor_id, contaCaixaId: data.conta_caixa_id,
          multaAtraso: data.multa_atraso, jurosMoraDiario: data.juros_mora_diario,
        } : null;
      };

      const contrato = await fetchContrato();
      if (!contrato) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado' });

      // Calcular nova data de vencimento (vencimento atual + intervalo da modalidade)
      // Se o usuário informou uma data manual, usar ela; caso contrário calcular automaticamente
      let novaDataVencStr: string;
      if (input.novaDataVencimento) {
        novaDataVencStr = input.novaDataVencimento;
      } else {
        const diasIntervalo = getDiasModalidade(contrato.tipoTaxa ?? contrato.modalidade);
        novaDataVencStr = adicionarDiasData(String(parcela.dataVencimento).slice(0, 10), diasIntervalo);
      }
      // Valor da nova parcela: usar o valor informado pelo usuário, ou o valor_parcela do contrato
      // (capital + juros), nunca o valor_original da parcela atual (que pode ser só juros)
      const valorContratoStr = (contrato as any).valorParcela ?? String(parcela.valorOriginal);
      const valorNovaParcela = input.novoValorParcela
        ? String(input.novoValorParcela.toFixed(2))
        : String(valorContratoStr);

      // Marcar parcela atual como "paga" (juros pagos = renovação)
      const hoje = new Date();
      if (db) {
        const parcelaPaga = await db.update(parcelas).set({
          valorPago: input.valorJurosPago.toFixed(2),
          dataPagamento: hoje,
          status: 'paga' as const,
          observacoes: input.observacoes ?? 'Pagamento de juros - renovado',
          contaCaixaId: input.contaCaixaId ?? null,
        }).where(and(
          eq(parcelas.id, input.parcelaId),
          eq(parcelas.userId, ctx.user.id),
          inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje', 'parcial']),
        )).returning({ id: parcelas.id });
        if (parcelaPaga.length !== 1) throw new TRPCError({ code: 'CONFLICT', message: 'A parcela não pôde ser marcada como paga' });

        // Registrar entrada no caixa (apenas se conta informada)
        if (input.contaCaixaId) {
          await db.insert(transacoesCaixa).values({
            contaCaixaId: input.contaCaixaId,
            tipo: 'entrada',
            categoria: 'pagamento_parcela',
            valor: input.valorJurosPago.toFixed(2),
            descricao: `Juros pagos - Parcela #${parcela.numeroParcela} renovada - Contrato #${parcela.contratoId}`,
            parcelaId: input.parcelaId,
            contratoId: parcela.contratoId as number,
            clienteId: parcela.clienteId as number,
            userId: ctx.user.id,
          });
        }

        // Calcular valorJuros para a nova parcela (juros = valor pago, pois é só juros)
        const valorJurosNovaParcela = input.valorJurosPago.toFixed(2);
        // Buscar o maior numero_parcela existente para evitar duplicatas
        const maxParcelaRows = await db.select({ maxNum: sql<number>`MAX(numero_parcela)` })
          .from(parcelas).where(and(eq(parcelas.contratoId, parcela.contratoId as number), eq(parcelas.userId, ctx.user.id)));
        const maxNumeroParcela = maxParcelaRows[0]?.maxNum ?? (parcela.numeroParcela as number);
        // Criar nova parcela com o valor (possivelmente customizado) e nova data
        // Nota: não incluir campos que não existem no schema (ex: contagemRenovacoes)
        await db.insert(parcelas).values({
          userId: ctx.user.id,
          contratoId: parcela.contratoId as number,
          clienteId: parcela.clienteId as number,
          koletorId: parcela.koletorId ?? undefined,
          numeroParcela: maxNumeroParcela + 1,
          valorOriginal: valorNovaParcela,
          valorJuros: valorJurosNovaParcela,
          dataVencimento: novaDataVencStr,
          status: 'pendente' as const,
          contaCaixaId: input.contaCaixaId ?? null,
          contagemRenovacoes: (Number((parcela as any).contagemRenovacoes) || 0) + 1,
        });

        // Atualizar numeroParcelas do contrato
        await db.update(contratos)
          .set({ numeroParcelas: sql`numero_parcelas + 1` })
          .where(and(eq(contratos.id, parcela.contratoId as number), eq(contratos.userId, ctx.user.id)));

      } else {
        // Fallback REST
        const supabase = await getSupabaseClientAsync();
        if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

        const { data: parcelaAtualizada, error: parcelaUpdateErr } = await supabase.from('parcelas').update({
          valor_pago: parseFloat(input.valorJurosPago.toFixed(2)),
          data_pagamento: hoje.toISOString(),
          status: 'paga',
          observacoes: input.observacoes ?? 'Pagamento de juros - renovado',
          conta_caixa_id: input.contaCaixaId,
        }).eq('id', input.parcelaId).eq('user_id', ctx.user.id).in('status', ['pendente', 'atrasada', 'vencendo_hoje', 'parcial']).select('id').maybeSingle();
        if (parcelaUpdateErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: parcelaUpdateErr.message });
        if (!parcelaAtualizada) throw new TRPCError({ code: 'CONFLICT', message: 'A parcela já foi processada ou não pertence a esta empresa' });

        const { data: jurosTx, error: jurosTxErr } = await supabase.from('transacoes_caixa').insert({
          conta_caixa_id: input.contaCaixaId,
          tipo: 'entrada',
          categoria: 'pagamento_parcela',
          valor: parseFloat(input.valorJurosPago.toFixed(2)),
          descricao: `Juros pagos - Parcela #${parcela.numeroParcela} renovada - Contrato #${parcela.contratoId}`,
          parcela_id: input.parcelaId,
          contrato_id: parcela.contratoId,
          data_transacao: dataHojeBrasilia(),
          user_id: ctx.user.id,
        }).select('id').single();
        if (jurosTxErr) {
          await supabase.from('parcelas').update({ valor_pago: parcela.valorPago ?? null, data_pagamento: parcela.dataPagamento ?? null, status: parcela.status, observacoes: parcela.observacoes ?? null, conta_caixa_id: parcela.contaCaixaId ?? null })
            .eq('id', input.parcelaId).eq('user_id', ctx.user.id).eq('status', 'paga');
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: jurosTxErr.message });
        }

        // O Supabase REST não fornece transação entre estas escritas. Em cada
        // falha posterior, restaura-se a parcela original e remove-se somente
        // o lançamento criado nesta tentativa, identificado pelo seu próprio id.
        const desfazerRenovacaoParcial = async (novaParcelaId?: number) => compensarRenovacaoJuros({
          removerParcelaRenovada: novaParcelaId ? async () => {
            const { error } = await supabase.from('parcelas').delete()
              .eq('id', novaParcelaId).eq('user_id', ctx.user.id).eq('contrato_id', parcela.contratoId);
            if (error) throw new Error(error.message);
          } : undefined,
          removerLancamentoCaixa: async () => {
            if (!jurosTx?.id) return;
            const { error } = await supabase.from('transacoes_caixa').delete()
              .eq('id', jurosTx.id).eq('user_id', ctx.user.id);
            if (error) throw new Error(error.message);
          },
          restaurarParcelaOriginal: async () => {
            const { error } = await supabase.from('parcelas').update({
              valor_pago: parcela.valorPago ?? null,
              data_pagamento: parcela.dataPagamento ?? null,
              status: parcela.status,
              observacoes: parcela.observacoes ?? null,
              conta_caixa_id: parcela.contaCaixaId ?? null,
            }).eq('id', input.parcelaId).eq('user_id', ctx.user.id).eq('status', 'paga');
            if (error) throw new Error(error.message);
          },
        });

        // Buscar o maior numero_parcela existente para evitar duplicatas no fallback REST
        const { data: maxParcelaRest } = await supabase.from('parcelas')
          .select('numero_parcela')
          .eq('contrato_id', parcela.contratoId)
          .eq('user_id', ctx.user.id)
          .order('numero_parcela', { ascending: false })
          .limit(1)
          .single();
        const novoNumero = ((maxParcelaRest?.numero_parcela as number) ?? (parcela.numeroParcela as number)) + 1;
        const novoValorRest = parseFloat(valorNovaParcela);
        const { data: novaParcela, error: insertParcelaErr } = await supabase.from('parcelas').insert({
          user_id: ctx.user.id,
          cliente_id: parcela.clienteId,
          contrato_id: parcela.contratoId,
          koletor_id: parcela.koletorId ?? null,
          numero_parcela: novoNumero,
          valor_original: novoValorRest,
          valor_juros: parseFloat(input.valorJurosPago.toFixed(2)),
          contagem_renovacoes: (Number(parcela.contagemRenovacoes) || 0) + 1,
          data_vencimento: novaDataVencStr,
          status: 'pendente',
          conta_caixa_id: input.contaCaixaId ?? null,
        }).select('id').single();
        if (insertParcelaErr) {
          await desfazerRenovacaoParcial();
          console.error('[pagarJuros] ERRO ao criar nova parcela:', insertParcelaErr.message);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Erro ao criar nova parcela: ${insertParcelaErr.message}` });
        }

        const numeroParcelasAnterior = Number(contrato.numeroParcelas ?? 0);
        const { data: contratoAtualizado, error: contratoUpdateErr } = await supabase.from('contratos')
          .update({ numero_parcelas: numeroParcelasAnterior + 1 })
          .eq('id', parcela.contratoId)
          .eq('user_id', ctx.user.id)
          // Compare-and-set: apenas uma renovação concorrente pode avançar
          // este contador. A outra é compensada junto com sua parcela e caixa.
          .eq('numero_parcelas', numeroParcelasAnterior)
          .select('id').maybeSingle();
        if (contratoUpdateErr || !contratoAtualizado) {
          await desfazerRenovacaoParcial(novaParcela?.id);
          throw new TRPCError({
            code: contratoUpdateErr ? 'INTERNAL_SERVER_ERROR' : 'CONFLICT',
            message: contratoUpdateErr?.message ?? 'O contrato não pôde ser atualizado; a renovação foi desfeita',
          });
        }
      }

      // Registrar histórico
      await registrarHistorico({
        contratoId: parcela.contratoId as number,
        userId: String(ctx.user.id),
        tipo: 'pagamento_juros',
        descricao: `Juros da parcela #${parcela.numeroParcela} pagos - R$ ${input.valorJurosPago.toFixed(2)} - Nova parcela criada com venc. ${novaDataVencStr}`,
        valorNovo: input.valorJurosPago.toFixed(2),
      });

      const resultado = { parcelaId: input.parcelaId, novaDataVencimento: novaDataVencStr };
      await concluirOperacaoFinanceira(reserva.id, resultado);
      await registrarAuditoriaFinanceira({
        userId: ctx.user.id, operacaoId: reserva.id, acao: 'renovar_pagando_juros', entidade: 'parcelas', entidadeId: input.parcelaId,
        detalhes: { valorJurosPago: input.valorJurosPago, contaCaixaId: input.contaCaixaId, novaDataVencimento: novaDataVencStr },
      });
      return { success: true, repetida: false, operationId: reserva.id, ...resultado };
      } catch (error) {
        await falharOperacaoFinanceira(reserva.id, error);
        throw error;
      }
    }),

  editarParcela: protectedProcedure
    .input(z.object({
      parcelaId: z.number(),
      novoValor: z.number().positive().optional(),
      novaDataVencimento: z.string().optional(), // formato YYYY-MM-DD
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.novoValor && !input.novaDataVencimento) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe ao menos um campo para editar' });
      }

      const db = await getDb();
      if (db) {
        // Verificar que a parcela pertence ao usuário
        const rows = await db.select().from(parcelas).where(and(eq(parcelas.id, input.parcelaId), eq(parcelas.userId, ctx.user.id))).limit(1);
        const parcela = rows[0];
        if (!parcela) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });

        const updateData: Record<string, any> = {};
        if (input.novoValor) updateData.valorOriginal = input.novoValor.toFixed(2);
        if (input.novaDataVencimento) updateData.dataVencimento = input.novaDataVencimento;

        await db.update(parcelas).set(updateData).where(and(eq(parcelas.id, input.parcelaId), eq(parcelas.userId, ctx.user.id)));
      } else {
        const supabase = await getSupabaseClientAsync();
        if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

        const updateData: Record<string, any> = {};
        if (input.novoValor) updateData.valor_original = input.novoValor;
        if (input.novaDataVencimento) updateData.data_vencimento = input.novaDataVencimento;

        const { error } = await supabase.from('parcelas').update(updateData).eq('id', input.parcelaId).eq('user_id', ctx.user.id);
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }

      return { success: true };
    }),

  // Deletar uma parcela pendente/atrasada (não permite deletar parcelas pagas)
  deletarParcela: protectedProcedure
    .input(z.object({
      parcelaId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

      // Buscar a parcela garantindo que pertence ao usuário
      const { data: parcela, error: pErr } = await sb
        .from('parcelas')
        .select('*')
        .eq('id', input.parcelaId)
        .eq('user_id', ctx.user.id)
        .single();

      if (pErr || !parcela) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });

      // Não permitir deletar parcelas pagas
      if (parcela.status === 'paga') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não é possível deletar uma parcela já paga' });
      }

      // Deletar a parcela
      const { error: delErr } = await sb
        .from('parcelas')
        .delete()
        .eq('id', input.parcelaId)
        .eq('user_id', ctx.user.id);

      if (delErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: delErr.message });

      // Verificar se ainda há parcelas pendentes no contrato
      const { data: parcelasPendentes } = await sb
        .from('parcelas')
        .select('id')
        .eq('contrato_id', parcela.contrato_id)
        .eq('user_id', ctx.user.id)
        .neq('status', 'paga')
        .limit(1);

      // Se não há mais parcelas pendentes, marcar contrato como quitado
      if (!parcelasPendentes || parcelasPendentes.length === 0) {
        await sb.from('contratos').update({ status: 'quitado' }).eq('id', parcela.contrato_id).eq('user_id', ctx.user.id);
      }

      return { success: true };
    }),

  // Criar nova parcela manualmente em um contrato existente
  criarParcela: protectedProcedure
    .input(z.object({
      contratoId: z.number(),
      dataVencimento: z.string(), // YYYY-MM-DD
      valorOriginal: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

      // Buscar contrato para obter dados necessários
      const { data: contrato, error: cErr } = await sb.from('contratos').select('*').eq('id', input.contratoId).eq('user_id', ctx.user.id).single();
      if (cErr || !contrato) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado' });

      // Descobrir o próximo número de parcela
      const { data: existentes } = await sb.from('parcelas').select('numero_parcela').eq('contrato_id', input.contratoId).eq('user_id', ctx.user.id).order('numero_parcela', { ascending: false }).limit(1);
      const ultimoNum = existentes?.[0]?.numero_parcela ?? 0;
      const novaNumeroParcela = ultimoNum + 1;

      const hoje = dataHojeBrasilia();
      const dataVenc = input.dataVencimento;
      let status = 'pendente';
      if (dataVenc < hoje) status = 'atrasada';
      else if (dataVenc === hoje) status = 'vencendo_hoje';

      const { error } = await sb.from('parcelas').insert({
        contrato_id: input.contratoId,
        cliente_id: contrato.cliente_id,
        koletor_id: contrato.koletor_id ?? null,
        numero: novaNumeroParcela,
        numero_parcela: novaNumeroParcela,
        valor: parseFloat(input.valorOriginal.toFixed(2)),
        valor_original: input.valorOriginal.toFixed(2),
        data_vencimento: dataVenc,
        status,
        conta_caixa_id: contrato.conta_caixa_id ?? null,
        user_id: ctx.user.id,
      });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      return { success: true, numeroParcela: novaNumeroParcela };
    }),
});

// ─── CAIXA ───────────────────────────────────────────────────────────────────
const caixaRouter = router({
  contas: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try {
        const contas = await db.select().from(contasCaixa).where(and(eq(contasCaixa.ativo, true), eq(contasCaixa.userId, ctx.user.id)));
        const result = [];
        for (const conta of contas) {
          const entradas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
            .from(transacoesCaixa)
            .where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, 'entrada'), eq(transacoesCaixa.userId, ctx.user.id)));
          const saidas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
            .from(transacoesCaixa)
            .where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, 'saida'), eq(transacoesCaixa.userId, ctx.user.id)));
          const saldo = calcularSaldoAtual(conta.saldo, [
            { tipo: 'entrada', valor: entradas[0]?.total },
            { tipo: 'saida', valor: saidas[0]?.total },
          ]);
          result.push({
            id: conta.id,
            nome: conta.nome,
            tipo: conta.tipo,
            banco: conta.banco ?? null,
            saldoInicial: parseFloat(conta.saldo ?? '0'),
            saldoAtual: saldo,
            ativa: conta.ativo ?? true,
          });
        }
        return result;
      } catch (err) {
        console.warn('[caixa.contas] Drizzle failed:', (err as Error).message);
        resetDb();
      }
    }
    // Fallback REST
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    // Tabela usa 'ativo' (não 'ativa') e 'saldo' (não 'saldo_inicial')
    const { data: contasData, error: contasErr } = await supabase.from('contas_caixa').select('*').eq('ativo', true).eq('user_id', ctx.user.id);
    if (contasErr) { console.error('[caixa.contas] REST error:', contasErr.message); return []; }
    const transData = await listarTransacoesCaixaDoUsuario(supabase, ctx.user.id);
    const result2 = [];
    for (const conta of (contasData || [])) {
      const transacoesConta = transData.filter((t: any) => t.conta_caixa_id === conta.id);
      // Campo real é 'saldo' (não 'saldo_inicial')
      const saldoBase = parseFloat(conta.saldo ?? conta.saldo_inicial ?? '0');
      const saldoAtual = calcularSaldoAtual(saldoBase, transacoesConta);
      result2.push({
        id: conta.id,
        nome: conta.nome,
        tipo: conta.tipo,
        banco: conta.banco ?? null,
        saldoInicial: saldoBase,
        saldoAtual,
        ativa: conta.ativo ?? conta.ativa ?? true,
      });
    }
    return result2;
  }),

  transacoes: protectedProcedure
    .input(z.object({ contaCaixaId: z.number().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          const rows = await db.select({
            id: transacoesCaixa.id,
            contaCaixaId: transacoesCaixa.contaCaixaId,
            contaNome: contasCaixa.nome,
            tipo: transacoesCaixa.tipo,
            categoria: transacoesCaixa.categoria,
            valor: transacoesCaixa.valor,
            descricao: transacoesCaixa.descricao,
            clienteNome: clientes.nome,
            dataTransacao: transacoesCaixa.dataTransacao,
          }).from(transacoesCaixa)
            .innerJoin(contasCaixa, eq(transacoesCaixa.contaCaixaId, contasCaixa.id))
            .leftJoin(clientes, eq(transacoesCaixa.clienteId, clientes.id))
            .where(and(eq(transacoesCaixa.userId, ctx.user.id), input?.contaCaixaId ? eq(transacoesCaixa.contaCaixaId, input.contaCaixaId) : undefined))
            .orderBy(desc(transacoesCaixa.dataTransacao))
            .limit(input?.limit ?? 50);
          return rows;
        } catch (err) {
          console.warn('[caixa.transacoes] Drizzle failed:', (err as Error).message);
          resetDb();
        }
      }
      // Fallback REST
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return [];
      let txQuery = supabase
        .from('transacoes_caixa')
        .select('id, conta_caixa_id, tipo, categoria, valor, descricao, data_transacao')
        .order('data_transacao', { ascending: false })
        .limit(input?.limit ?? 50)
        .eq('user_id', ctx.user.id);
      if (input?.contaCaixaId) txQuery = txQuery.eq('conta_caixa_id', input.contaCaixaId);
      const { data: txData, error: txQueryErr } = await txQuery;
      if (txQueryErr) { console.error('[caixa.transacoes] REST error:', txQueryErr.message); return []; }
      // Buscar nomes das contas separadamente
      const contaIdsSet = new Set<number>((txData ?? []).map((t: any) => t.conta_caixa_id).filter(Boolean));
      const contaIds = Array.from(contaIdsSet);
      const { data: contasData } = contaIds.length > 0
        ? await supabase.from('contas_caixa').select('id, nome').in('id', contaIds).eq('user_id', ctx.user.id)
        : { data: [] };
      const contasMap = Object.fromEntries((contasData ?? []).map((c: any) => [c.id, c.nome]));
      return (txData ?? []).map((t: any) => ({
        id: t.id,
        contaCaixaId: t.conta_caixa_id,
        contaNome: contasMap[t.conta_caixa_id] ?? '',
        tipo: t.tipo,
        categoria: t.categoria,
        valor: t.valor,
        descricao: t.descricao,
        clienteNome: null,
        dataTransacao: t.data_transacao,
      }));
    }),

  conferencia: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados indisponível para conferência' });

    // Leitura separada de cada origem e análise em memória. Esta procedure não
    // chama insert, update ou delete: o operador recebe evidências antes de
    // decidir qualquer correção financeira.
    const [{ data: contas, error: contasErro }, transacoes, parcelasPagas, despesasPagas] = await Promise.all([
      supabase.from('contas_caixa').select('id, nome, saldo, ativo').eq('user_id', ctx.user.id).eq('ativo', true),
      listarRegistrosParaConferencia(
        supabase,
        'transacoes_caixa',
        'id, conta_caixa_id, tipo, categoria, valor, parcela_id, descricao',
        ctx.user.id,
      ),
      listarRegistrosParaConferencia(
        supabase,
        'parcelas',
        'id, conta_caixa_id, valor_pago, status',
        ctx.user.id,
        (query) => query.in('status', ['paga', 'parcial']),
      ),
      listarRegistrosParaConferencia(
        supabase,
        'contas_pagar',
        'id, conta_caixa_id, descricao, valor, status',
        ctx.user.id,
        (query) => query.eq('status', 'paga'),
      ),
    ]);
    if (contasErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: contasErro.message });

    const resultado = gerarConferenciaCaixa({
      contas: contas ?? [],
      transacoes: transacoes.registros,
      parcelas: parcelasPagas.registros,
      despesas: despesasPagas.registros,
    });
    return {
      ...resultado,
      truncado: transacoes.truncado || parcelasPagas.truncado || despesasPagas.truncado,
      limitePorOrigem: 20_000,
    };
  }),

  criarConta: protectedProcedure
    .input(z.object({
      nome: z.string().min(2),
      tipo: z.enum(['caixa', 'banco', 'digital']),
      banco: z.string().optional(),
      saldoInicial: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          const result = await db.insert(contasCaixa).values({
            nome: input.nome,
            tipo: input.tipo,
            banco: input.banco,
            saldo: input.saldoInicial.toFixed(2),
            ativo: true,
            userId: ctx.user.id,
          }).returning({ id: contasCaixa.id });
          return { id: result[0].id };
        } catch (err) {
          console.warn('[caixa.criarConta] Drizzle failed:', (err as Error).message);
          resetDb();
        }
      }
      // Fallback REST
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new Error('DB unavailable');
      const { data, error } = await supabase.from('contas_caixa').insert({
        nome: input.nome,
        tipo: input.tipo,
        saldo: input.saldoInicial,
        ativo: true,
        user_id: ctx.user.id,
      }).select('id').single();
      if (error) throw new Error(error.message);
      return { id: data.id };
    }),

  registrarTransacao: protectedProcedure
    .input(z.object({
      contaCaixaId: z.number(),
      tipo: z.enum(['entrada', 'saida']),
      categoria: z.enum(['pagamento_parcela', 'emprestimo_liberado', 'despesa_operacional', 'transferencia_conta', 'ajuste_manual', 'outros']),
      valor: z.number().positive(),
      descricao: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await validarContaDoUsuario(ctx.user.id, input.contaCaixaId);
      const db = await getDb();
      if (db) {
        try {
          await db.insert(transacoesCaixa).values({
            contaCaixaId: input.contaCaixaId,
            tipo: input.tipo,
            categoria: input.categoria,
            valor: input.valor.toFixed(2),
            descricao: input.descricao,
            userId: ctx.user.id,
          });
          // O saldo-base não é alterado: o livro de movimentações é a fonte de verdade.
          return { success: true };
        } catch (err) {
          console.warn('[caixa.registrarTransacao] Drizzle failed:', (err as Error).message);
          resetDb();
        }
      }
      // Fallback REST
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new Error('DB unavailable');
      const { error: txErr } = await supabase.from('transacoes_caixa').insert({
        conta_caixa_id: input.contaCaixaId,
        tipo: input.tipo,
        categoria: input.categoria,
        valor: input.valor,
        descricao: input.descricao ?? null,
        data_transacao: new Date().toISOString(),
        user_id: ctx.user.id,
      });
      if (txErr) throw new Error(txErr.message);
      // O saldo-base não é alterado: o livro de movimentações é a fonte de verdade.
      return { success: true };
    }),

  removerTransacoesDuplicadasDespesa: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1), manterId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const idsParaRemover = idsDuplicadosParaRemocao(input.ids, input.manterId);
      if (idsParaRemover.length === 0) return { success: true, removidas: 0 };

      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data, error } = await supabase
        .from('transacoes_caixa')
        .delete()
        .in('id', idsParaRemover)
        .eq('user_id', ctx.user.id)
        .eq('categoria', 'despesa_operacional')
        .select('id');
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true, removidas: data?.length ?? 0 };
    }),
});

// ─── PORTAL DO CLIENTE ───────────────────────────────────────────────────────
const portalRouter = router({
  gerarLink: protectedProcedure
    .input(z.object({ clienteId: z.number(), origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      let originSeguro: string;
      try {
        const url = new URL(input.origin);
        const hostPermitido = url.hostname === 'cobrapro.online'
          || url.hostname === 'www.cobrapro.online'
          || url.hostname.endsWith('.manus.space')
          || url.hostname.endsWith('.manus.computer');
        if (url.protocol !== 'https:' || !hostPermitido) throw new Error('origin inválida');
        originSeguro = url.origin;
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Origem inválida para o link do portal' });
      }
      const db = await getDb();
      const token = nanoid(48);
      const tokenHash = hashTokenPortal(token);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      if (db) {
        try {
          const cliente = await db.select({ id: clientes.id }).from(clientes)
            .where(and(eq(clientes.id, input.clienteId), eq(clientes.userId, ctx.user.id))).limit(1);
          if (!cliente[0]) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
          await db.insert(magicLinks).values({ clienteId: input.clienteId, token: tokenHash, expiresAt });
          return { url: `${originSeguro}/portal/${token}`, token };
        } catch (err) {
          console.warn('[portal.gerarLink] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data: cliente, error: clienteErro } = await supabase.from('clientes').select('id')
        .eq('id', input.clienteId).eq('user_id', ctx.user.id).maybeSingle();
      if (clienteErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: clienteErro.message });
      if (!cliente) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
      const { error } = await supabase.from('magic_links').insert({
        cliente_id: input.clienteId,
        token: tokenHash,
        expires_at: expiresAt.toISOString(),
      });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { url: `${originSeguro}/portal/${token}`, token };
    }),

  acessar: publicProcedure
    .input(z.object({ token: z.string().min(32).max(128) }))
    .mutation(async ({ ctx, input }) => {
      // A resposta contém dados financeiros pessoais; não pode entrar em cache
      // de browser, proxy ou CDN após a primeira leitura do link de uso único.
      ctx.res.setHeader('Cache-Control', 'no-store, private, max-age=0');
      const linkIndisponivel = () => new TRPCError({
        code: 'NOT_FOUND',
        message: 'Link indisponível. Solicite um novo link ao seu credor.',
      });
      const agora = new Date();
      const tokensCandidatos = candidatosTokenPortal(input.token);
      const db = await getDb();
      if (db) {
        let linkConsumido = false;
        try {
          // Compare-and-set: uma única requisição consegue consumir o link.
          const linksConsumidos = await db.update(magicLinks).set({ usado: true })
            .where(and(
              or(...tokensCandidatos.map((token) => eq(magicLinks.token, token))),
              eq(magicLinks.usado, false),
              gt(magicLinks.expiresAt, agora),
            ))
            .returning({ clienteId: magicLinks.clienteId });
          const link = linksConsumidos[0];
          if (!link) throw linkIndisponivel();
          linkConsumido = true;
          const clienteRows = await db.select().from(clientes).where(eq(clientes.id, link.clienteId)).limit(1);
          const cliente = clienteRows[0];
          if (!cliente) throw linkIndisponivel();
          const parcelasCliente = await db.select({
            id: parcelas.id,
            numeroParcela: parcelas.numeroParcela,
            valorOriginal: parcelas.valorOriginal,
            valorPago: parcelas.valorPago,
            dataVencimento: parcelas.dataVencimento,
            dataPagamento: parcelas.dataPagamento,
            status: parcelas.status,
          }).from(parcelas)
            .where(and(eq(parcelas.clienteId, link.clienteId), inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje', 'parcial'])))
            .orderBy(parcelas.dataVencimento).limit(10);
          return {
            cliente: { nome: cliente.nome, chavePix: cliente.chavePix, tipoChavePix: cliente.tipoChavePix },
            parcelas: normalizarParcelasPortal(parcelasCliente),
          };
        } catch (err: any) {
          if (err instanceof TRPCError) throw err;
          // Depois de vencer o CAS, nunca tenta o REST: isso ocultaria uma
          // indisponibilidade posterior como se o link fosse inválido.
          if (linkConsumido) {
            console.error('[portal.acessar] falha após consumir link:', err);
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Não foi possível abrir o portal. Solicite um novo link.' });
          }
          console.warn('[portal.acessar] Drizzle failed, trying REST:', err.message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new Error('DB unavailable');
      try {
        const linkData = await consumirLinkPortalNoSupabase(supabase, input.token, agora);
        if (!linkData) throw linkIndisponivel();
        const { data: cliData, error: clienteErro } = await supabase.from('clientes')
          .select('nome, chave_pix, tipo_chave_pix')
          .eq('id', linkData.clienteId)
          .maybeSingle();
        if (clienteErro || !cliData) throw new Error(clienteErro?.message ?? 'Cliente do portal não encontrado');
        const { data: pData, error: parcelasErro } = await supabase.from('parcelas')
          .select('id, numero_parcela, valor_original, valor_pago, data_vencimento, data_pagamento, status')
          .eq('cliente_id', linkData.clienteId)
          .in('status', ['pendente', 'atrasada', 'vencendo_hoje', 'parcial'])
          .order('data_vencimento').limit(10);
        if (parcelasErro) throw new Error(parcelasErro.message);
        return {
          cliente: { nome: cliData.nome, chavePix: cliData.chave_pix, tipoChavePix: cliData.tipo_chave_pix },
          parcelas: normalizarParcelasPortal(pData ?? []),
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error('[portal.acessar] falha após consumir link:', err);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Não foi possível abrir o portal. Solicite um novo link.' });
      }
    }),
});

// ─── TEMPLATES WHATSAPP ───────────────────────────────────────────────────────
// Helper para substituir variáveis nos templates
function aplicarVariaveisTemplate(template: string, vars: Record<string, string>): string {
  let msg = template;
  for (const [key, val] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    msg = msg.replace(new RegExp(`\\{\\{${key.toLowerCase()}\\}\\}`, 'g'), val);
  }
  return msg;
}

const whatsappRouter = router({
  templates: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const { data } = await supabase.from('templates_whatsapp').select('*').eq('ativo', true).eq('user_id', ctx.user.id);
    return (data ?? []).map((r: any) => ({ ...r, ativo: r.ativo }));
  }),

  // Gerar mensagem a partir de contrato (para botão Cobrar no card de empréstimo)
  gerarMensagemContrato: protectedProcedure
    .input(z.object({
      contratoId: z.number(),
      tipo: z.enum(['atraso', 'preventivo', 'vence_hoje']).default('atraso'),
    }))
    .query(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new Error('DB unavailable');
      const { data: configRows } = await supabase.from('configuracoes').select('chave, valor').eq('user_id', ctx.user.id);
      const cfg: Record<string, string> = {};
      for (const r of (configRows ?? [])) cfg[r.chave] = r.valor ?? '';
      const pixEmpresa = cfg['pixKey'] ?? cfg['pix_key'] ?? cfg['chave_pix'] ?? '';
      const assinatura = cfg['assinaturaWhatsapp'] ?? cfg['assinatura_whatsapp'] ?? '';
      const fechamento = cfg['fechamentoWhatsapp'] ?? cfg['fechamento_whatsapp'] ?? '';
      const linkPagamento = cfg['linkPagamento'] ?? cfg['link_pagamento'] ?? '';
      const tipoTemplate = input.tipo === 'atraso' ? 'cobranca' : 'lembrete';
      const { data: templates } = await supabase.from('templates_whatsapp').select('*').eq('ativo', true).eq('tipo', tipoTemplate).eq('user_id', ctx.user.id).limit(1);
      const { data: contrato } = await supabase
        .from('contratos')
        .select('*, clientes(nome, whatsapp, telefone, chave_pix)')
        .eq('id', input.contratoId)
        .eq('user_id', ctx.user.id)
        .single();
      if (!contrato) throw new Error('Contrato não encontrado');
      const { data: parcelasArr } = await supabase
        .from('parcelas')
        .select('*')
        .eq('contrato_id', input.contratoId)
        .eq('user_id', ctx.user.id)
        .order('numero_parcela', { ascending: true });
      const hoje = new Date();
      const parcelasAtraso = (parcelasArr ?? []).filter((p: any) => {
        const venc = new Date(p.data_vencimento + 'T00:00:00');
        return p.status !== 'paga' && venc < hoje;
      });
      const proximaParcela = (parcelasArr ?? []).find((p: any) => p.status !== 'paga');
      const parcelaRef = parcelasAtraso[0] ?? proximaParcela;
      const diasAtraso = parcelaRef
        ? Math.max(0, Math.floor((hoje.getTime() - new Date(parcelaRef.data_vencimento + 'T00:00:00').getTime()) / 86400000))
        : 0;
      const diasParaVencer = parcelaRef && diasAtraso === 0
        ? Math.max(0, Math.floor((new Date(parcelaRef.data_vencimento + 'T00:00:00').getTime() - hoje.getTime()) / 86400000))
        : 0;
      const totalParcelas = contrato.numero_parcelas ?? (parcelasArr ?? []).length;
      const parcelaNum = parcelaRef?.numero_parcela ?? 1;
      const valorOriginal = parseFloat(parcelaRef?.valor_original ?? contrato.valor_parcela ?? '0');
      const { juros, multa, total } = calcularJurosMora(valorOriginal, parcelaRef ? new Date(parcelaRef.data_vencimento + 'T00:00:00') : hoje, hoje);
      const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const dataVenc = parcelaRef ? new Date(parcelaRef.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '';
      const clienteNome = contrato.clientes?.nome ?? '';
      const clienteWhatsapp = contrato.clientes?.whatsapp ?? contrato.clientes?.telefone ?? null;
      const clienteChavePix = contrato.clientes?.chave_pix ?? pixEmpresa;
      const pagas = (parcelasArr ?? []).filter((p: any) => p.status === 'paga').length;
      const progressoBar = `${pagas}/${totalParcelas} parcelas pagas`;
      const parcelasStatus = (parcelasArr ?? []).slice(0, 6).map((p: any) => {
        const v = new Date(p.data_vencimento + 'T00:00:00');
        const emoji = p.status === 'paga' ? '✅' : v < hoje ? '🔴' : '🟡';
        return `${emoji} Parcela ${p.numero_parcela}/${totalParcelas} — ${fmt(parseFloat(p.valor_original ?? '0'))} — ${new Date(p.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}`;
      }).join('\n');
      const blocoMulta = multa > 0 ? `💸 *Multa:* ${fmt(multa)}\n` : '';
      const blocoJuros = juros > 0 ? `📈 *Juros:* ${fmt(juros)}\n` : '';
      const blocoTotal = (multa > 0 || juros > 0) ? `💰 *Total com Juros:* ${fmt(total)}\n` : '';
      const blocoPix = clienteChavePix ? `\n💳 *PIX:* ${clienteChavePix}\n` : '';
      const blocoLink = linkPagamento ? `🔗 *Link:* ${linkPagamento}\n` : '';
      const templatePadrao = input.tipo === 'atraso'
        ? `⚠️ *Atenção {CLIENTE}* ━━━━━━━━━━━━━━━━\n🚨 *PARCELA EM ATRASO*\n💵 *Valor:* {VALOR}\n📊 *{PARCELA}*\n📅 *Vencimento:* {DATA}\n⏰ *Dias em Atraso:* {DIAS_ATRASO}\n{MULTA}{JUROS}{TOTAL}{PROGRESSO}\n{PIX}{LINK}{FECHAMENTO}\n{ASSINATURA}`
        : `🟢 *Olá {CLIENTE}!* ━━━━━━━━━━━━━━━━\n📋 *LEMBRETE DE PARCELA*\n💵 *Valor:* {VALOR}\n📊 *{PARCELA}*\n📅 *Vencimento:* {DATA}\n⏳ *Faltam:* {DIAS_PARA_VENCER} dias\n{PROGRESSO}\n{PIX}{LINK}{FECHAMENTO}\n{ASSINATURA}`;
      const templateMsg = templates?.[0]?.mensagem ?? templatePadrao;
      const vars: Record<string, string> = {
        CLIENTE: clienteNome, nome: clienteNome,
        VALOR: fmt(valorOriginal), valor: fmt(valorOriginal),
        PARCELA: `Parcela ${parcelaNum}/${totalParcelas}`,
        DATA: dataVenc, vencimento: dataVenc,
        DIAS_ATRASO: String(diasAtraso),
        DIAS_PARA_VENCER: String(diasParaVencer),
        JUROS_CONTRATO: `${contrato.taxa_juros}%`,
        MULTA: blocoMulta, JUROS: blocoJuros,
        JUROS_MULTA: multa + juros > 0 ? `💸 *Juros+Multa:* ${fmt(multa + juros)}\n` : '',
        TOTAL: blocoTotal,
        PROGRESSO: progressoBar,
        PARCELAS_STATUS: parcelasStatus,
        PIX: blocoPix, chave_pix: clienteChavePix ?? '',
        LINK: blocoLink,
        ASSINATURA: assinatura ? `\n${assinatura}` : '',
        FECHAMENTO: fechamento ? `${fechamento}\n` : '',
      };
      const mensagem = aplicarVariaveisTemplate(templateMsg, vars);
      const whatsappUrl = clienteWhatsapp
        ? `https://wa.me/55${clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`
        : null;
      return { mensagem, whatsappUrl, whatsapp: clienteWhatsapp, clienteNome };
    }),

  // Gerar mensagem por parcela (legado)
  gerarMensagem: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      parcelaId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new Error('DB unavailable');
      const { data: templateData } = await supabase.from('templates_whatsapp').select('*').eq('id', input.templateId).eq('user_id', ctx.user.id).single();
      if (!templateData) throw new Error('Template não encontrado');
      const { data: parcelaData } = await supabase.from('parcelas').select('*, clientes(nome, whatsapp, chave_pix), contratos(numero_parcelas)').eq('id', input.parcelaId).eq('user_id', ctx.user.id).single();
      if (!parcelaData) throw new Error('Parcela não encontrada');
      const { total, juros, multa } = calcularJurosMora(
        parseFloat(parcelaData.valor_original),
        new Date(parcelaData.data_vencimento + 'T00:00:00'),
        new Date()
      );
      const dataFormatada = new Date(parcelaData.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR');
      const fmt2 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const clienteNome = parcelaData.clientes?.nome ?? '';
      const clienteWhatsapp = parcelaData.clientes?.whatsapp ?? null;
      const clienteChavePix = parcelaData.clientes?.chave_pix ?? null;
      const vars2: Record<string, string> = {
        CLIENTE: clienteNome, nome: clienteNome,
        VALOR: fmt2(parseFloat(parcelaData.valor_original)), valor: fmt2(parseFloat(parcelaData.valor_original)),
        valor_atualizado: fmt2(total),
        DATA: dataFormatada, vencimento: dataFormatada, data_vencimento: dataFormatada,
        PIX: clienteChavePix ? `💳 *PIX:* ${clienteChavePix}\n` : '',
        chave_pix: clienteChavePix ?? 'Consulte o credor',
        MULTA: multa > 0 ? `💸 *Multa:* ${fmt2(multa)}\n` : '',
        JUROS: juros > 0 ? `📈 *Juros:* ${fmt2(juros)}\n` : '',
        TOTAL: (multa + juros) > 0 ? `💰 *Total:* ${fmt2(total)}\n` : '',
        numero_parcela: String(parcelaData.numero ?? parcelaData.numero_parcela ?? 1),
      };
      const mensagem = aplicarVariaveisTemplate(templateData.mensagem, vars2);
      const whatsappUrl = clienteWhatsapp
        ? `https://wa.me/55${clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`
        : null;
      return { mensagem, whatsappUrl, whatsapp: clienteWhatsapp };
    }),

  // Cobrança em lote
  cobrarLote: protectedProcedure
    .input(z.object({
      contratoIds: z.array(z.number()),
      tipo: z.enum(['atraso', 'preventivo']).default('atraso'),
    }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new Error('DB unavailable');
      const { data: configRows } = await supabase.from('configuracoes').select('chave, valor').eq('user_id', ctx.user.id);
      const cfg: Record<string, string> = {};
      for (const r of (configRows ?? [])) cfg[r.chave] = r.valor ?? '';
      const pixEmpresa = cfg['pixKey'] ?? cfg['pix_key'] ?? '';
      const assinatura = cfg['assinaturaWhatsapp'] ?? '';
      const resultados: Array<{ contratoId: number; clienteNome: string; whatsappUrl: string | null; sucesso: boolean }> = [];
      for (const contratoId of input.contratoIds) {
        try {
          const { data: contrato } = await supabase
            .from('contratos')
            .select('*, clientes(nome, whatsapp, telefone, chave_pix)')
            .eq('id', contratoId)
            .eq('user_id', ctx.user.id)
            .single();
          if (!contrato) { resultados.push({ contratoId, clienteNome: '', whatsappUrl: null, sucesso: false }); continue; }
          const clienteNome = contrato.clientes?.nome ?? '';
          const clienteWhatsapp = contrato.clientes?.whatsapp ?? contrato.clientes?.telefone ?? null;
          const clienteChavePix = contrato.clientes?.chave_pix ?? pixEmpresa;
          const valorParcela = parseFloat(contrato.valor_parcela ?? '0');
          const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const msg = input.tipo === 'atraso'
            ? `⚠️ *Atenção ${clienteNome}*\n🚨 Você possui parcela(s) em atraso no valor de *${fmt(valorParcela)}*.\nPor favor, regularize o quanto antes.${clienteChavePix ? `\n\n💳 *PIX:* ${clienteChavePix}` : ''}${assinatura ? `\n\n${assinatura}` : ''}`
            : `🟢 *Olá ${clienteNome}!*\n📋 Lembrete: você tem parcela vencendo em breve no valor de *${fmt(valorParcela)}*.\nFique em dia!${clienteChavePix ? `\n\n💳 *PIX:* ${clienteChavePix}` : ''}${assinatura ? `\n\n${assinatura}` : ''}`;
          const whatsappUrl = clienteWhatsapp
            ? `https://wa.me/55${clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
            : null;
          resultados.push({ contratoId, clienteNome, whatsappUrl, sucesso: true });
        } catch { resultados.push({ contratoId, clienteNome: '', whatsappUrl: null, sucesso: false }); }
      }
      return { resultados, total: resultados.length, sucesso: resultados.filter(r => r.sucesso).length };
    }),

  // Recebimentos (histórico de pagamentos)
  recebimentos: protectedProcedure
    .input(z.object({
      periodo: z.enum(['hoje', 'semana', 'mes', 'todos']).default('mes'),
    }))
    .query(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return { recebimentos: [], total: 0, totalValor: 0 };
      const hoje = new Date();
      let dataInicio: string | null = null;
      if (input.periodo === 'hoje') {
        dataInicio = hoje.toISOString().split('T')[0];
      } else if (input.periodo === 'semana') {
        const d = new Date(hoje); d.setDate(d.getDate() - 7);
        dataInicio = d.toISOString().split('T')[0];
      } else if (input.periodo === 'mes') {
        const d = new Date(hoje); d.setDate(1);
        dataInicio = d.toISOString().split('T')[0];
      }
      let query = supabase
        .from('transacoes_caixa')
        .select('*, contas_caixa(nome)')
        .eq('tipo', 'entrada')
        .in('categoria', ['pagamento_parcela', 'pagamento_juros', 'pagamento_total'])
        .eq('user_id', ctx.user.id)
        .order('data_transacao', { ascending: false })
        .limit(100);
      if (dataInicio) query = (query as any).gte('data_transacao', dataInicio);
      const { data } = await query;
      const recebimentos = (data ?? []).map((r: any) => ({
        id: r.id,
        descricao: r.descricao ?? 'Pagamento',
        valor: parseFloat(r.valor ?? '0'),
        dataTransacao: r.data_transacao,
        categoria: r.categoria,
        contaNome: r.contas_caixa?.nome ?? 'Caixa',
      }));
      const totalValor = recebimentos.reduce((s, r) => s + r.valor, 0);
      return { recebimentos, total: recebimentos.length, totalValor };
    }),

  relatorioDiario: protectedProcedure
    .input(z.object({ telefone: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const hoje = dataHojeBrasilia();
      const inicioHoje = dataCivilBrasiliaParaIso(hoje);
      const inicioAmanha = dataCivilBrasiliaParaIso(adicionarDiasData(hoje, 1));
      const { data: parcelasHoje } = await supabase
        .from('parcelas')
        .select('id, valor, valor_pago, status, data_vencimento, contratos(clientes(nome))')
        .eq('data_vencimento', hoje)
        .eq('user_id', ctx.user.id);
      const { data: pagamentosHoje } = await supabase
        .from('parcelas')
        .select('id, valor_pago, data_pagamento, contratos(clientes(nome))')
        .gte('data_pagamento', inicioHoje)
        .lt('data_pagamento', inicioAmanha)
        .eq('status', 'paga')
        .eq('user_id', ctx.user.id);
      const { data: atrasadas } = await supabase
        .from('parcelas')
        .select('id, valor, data_vencimento, contratos(clientes(nome))')
        .eq('status', 'atrasada')
        .eq('user_id', ctx.user.id)
        .order('data_vencimento', { ascending: true })
        .limit(10);
      const totalRecebidoHoje = (pagamentosHoje || []).reduce((s: number, p: any) => s + parseFloat(p.valor_pago || 0), 0);
      const totalVencendoHoje = (parcelasHoje || []).filter((p: any) => p.status !== 'paga').length;
      const totalAtrasadas = (atrasadas || []).length;
      const { data: cfgData } = await supabase.from('configuracoes').select('chave, valor').eq('user_id', ctx.user.id);
      const cfg: Record<string, string> = {};
      (cfgData || []).forEach((r: any) => { cfg[r.chave] = r.valor; });
      const nomeEmpresa = cfg['nomeEmpresa'] || 'CobraPro';
      const assinatura = cfg['assinaturaWhatsapp'] || nomeEmpresa;
      const dataFormatada = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
      let msg = `\uD83D\uDCCA *RELAT\u00D3RIO DO DIA \u2014 ${dataFormatada.toUpperCase()}*\n`;
      msg += `_${nomeEmpresa}_\n\n`;
      msg += `\uD83D\uDCB0 *RECEBIMENTOS HOJE*\n`;
      msg += `Total recebido: *R$ ${totalRecebidoHoje.toFixed(2).replace('.', ',')}*\n`;
      if ((pagamentosHoje || []).length > 0) {
        (pagamentosHoje || []).slice(0, 5).forEach((p: any) => {
          const nome = (p.contratos as any)?.clientes?.nome || 'Cliente';
          msg += `  \u2705 ${nome}: R$ ${parseFloat(p.valor_pago || 0).toFixed(2).replace('.', ',')}\n`;
        });
        if ((pagamentosHoje || []).length > 5) msg += `  ... e mais ${(pagamentosHoje || []).length - 5} pagamentos\n`;
      } else {
        msg += `  Nenhum pagamento registrado hoje\n`;
      }
      msg += `\n\uD83D\uDCC5 *VENCIMENTOS HOJE*\n`;
      if (totalVencendoHoje > 0) {
        msg += `${totalVencendoHoje} parcela(s) vencem hoje\n`;
        (parcelasHoje || []).filter((p: any) => p.status !== 'paga').slice(0, 5).forEach((p: any) => {
          const nome = (p.contratos as any)?.clientes?.nome || 'Cliente';
          msg += `  \u23F0 ${nome}: R$ ${parseFloat(p.valor || 0).toFixed(2).replace('.', ',')}\n`;
        });
      } else {
        msg += `  Nenhum vencimento hoje\n`;
      }
      if (totalAtrasadas > 0) {
        msg += `\n\uD83D\uDD34 *INADIMPLENTES (${totalAtrasadas})*\n`;
        (atrasadas || []).slice(0, 5).forEach((p: any) => {
          const nome = (p.contratos as any)?.clientes?.nome || 'Cliente';
          const venc = new Date(p.data_vencimento).toLocaleDateString('pt-BR');
          msg += `  \u274C ${nome} \u2014 venceu ${venc}\n`;
        });
        if (totalAtrasadas > 5) msg += `  ... e mais ${totalAtrasadas - 5} inadimplentes\n`;
      }
      msg += `\n_Enviado pelo ${assinatura}_`;
      const telefone = input?.telefone || cfg['telefoneEmpresa'] || '';
      const telefoneNumeros = telefone.replace(/\D/g, '');
      const whatsappUrl = telefoneNumeros
        ? `https://wa.me/55${telefoneNumeros}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      return { mensagem: msg, whatsappUrl, totalRecebidoHoje, totalVencendoHoje, totalAtrasadas, pagamentosCount: (pagamentosHoje || []).length };
    }),
});
// ─── RELATÓRIOS ────────────────────────────────────────────────────────────────
const relatoriosRouter = router({
  resumoGeral: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return null;

    const [{ count: totalContratos }, { count: contratosAtivos }, { count: totalClientes }] = await Promise.all([
      supabase.from('contratos').select('*', { count: 'exact', head: true }).eq('user_id', ctx.user.id),
      supabase.from('contratos').select('*', { count: 'exact', head: true }).eq('status', 'ativo').eq('user_id', ctx.user.id),
      supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('user_id', ctx.user.id),
    ]);

    const { data: entradas } = await supabase.from('transacoes_caixa').select('valor').eq('tipo', 'entrada').eq('user_id', ctx.user.id);
    const totalRecebido = (entradas ?? []).reduce((s: number, r: any) => s + parseFloat(r.valor ?? '0'), 0);

    const { data: liberados } = await supabase.from('transacoes_caixa').select('valor').eq('tipo', 'saida').eq('categoria', 'emprestimo_liberado').eq('user_id', ctx.user.id);
    const totalLiberado = (liberados ?? []).reduce((s: number, r: any) => s + parseFloat(r.valor ?? '0'), 0);

    const { data: inadimplentesData } = await supabase.from('parcelas').select('valor_original').eq('status', 'atrasada').eq('user_id', ctx.user.id);
    const totalInadimplente = (inadimplentesData ?? []).reduce((s: number, r: any) => s + parseFloat(r.valor_original ?? '0'), 0);

    return {
      totalContratos: totalContratos ?? 0,
      contratosAtivos: contratosAtivos ?? 0,
      totalClientes: totalClientes ?? 0,
      totalRecebido,
      totalLiberado,
      totalInadimplente,
      qtdInadimplentes: (inadimplentesData ?? []).length,
    };
  }),
  inadimplentes: protectedProcedure
    .input(z.object({
      diasMinimos: z.number().optional().default(1),
      ordenarPor: z.enum(['valor', 'dias', 'nome']).optional().default('dias'),
    }).optional())
    .query(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return [];
      const userId = ctx.user.id;
      const hoje = dataHojeBrasilia();
      // Buscar parcelas com status atrasada OU pendente com vencimento anterior a hoje
      const { data: parcelasAtrasadas } = await supabase
        .from('parcelas')
        .select('id, contrato_id, cliente_id, numero_parcela, valor_original, valor_multa, data_vencimento, status, clientes(nome, whatsapp, telefone)')
        .in('status', ['atrasada', 'pendente', 'vencendo_hoje'])
        .eq('user_id', userId)
        .lt('data_vencimento', hoje)
        .order('data_vencimento', { ascending: true });
      if (!parcelasAtrasadas || parcelasAtrasadas.length === 0) return [];
      // Agrupar por cliente
      const clienteMap = new Map<number, any>();
      for (const p of parcelasAtrasadas) {
        const cliente = p.clientes as any;
        const diasAtraso = Math.max(0, diferencaDiasData(String(p.data_vencimento).slice(0, 10), hoje));
        const valorOriginal = parseFloat(p.valor_original ?? '0');
        const valorMulta = parseFloat(p.valor_multa ?? '0');
        const totalParcela = valorOriginal + valorMulta;
        if (!clienteMap.has(p.cliente_id)) {
          clienteMap.set(p.cliente_id, {
            clienteId: p.cliente_id,
            clienteNome: cliente?.nome ?? 'Desconhecido',
            clienteWhatsapp: cliente?.whatsapp ?? null,
            clienteTelefone: cliente?.telefone ?? null,
            parcelas: [],
            totalDevido: 0,
            maiorDiasAtraso: 0,
          });
        }
        const entry = clienteMap.get(p.cliente_id)!;
        entry.parcelas.push({
          id: p.id,
          contratoId: p.contrato_id,
          numeroParcela: p.numero_parcela,
          valorOriginal,
          valorMulta,
          totalParcela,
          dataVencimento: p.data_vencimento,
          diasAtraso,
        });
        entry.totalDevido += totalParcela;
        entry.maiorDiasAtraso = Math.max(entry.maiorDiasAtraso, diasAtraso);
      }
      let result = Array.from(clienteMap.values());
      const ord = input?.ordenarPor ?? 'dias';
      if (ord === 'valor') result.sort((a, b) => b.totalDevido - a.totalDevido);
      else if (ord === 'dias') result.sort((a, b) => b.maiorDiasAtraso - a.maiorDiasAtraso);
      else result.sort((a, b) => a.clienteNome.localeCompare(b.clienteNome));
      return result;
    }),
});
// ─── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────
const configuracoesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    let rows: any[] = [];
    if (db) {
      try { rows = await db.select().from(configuracoes).where(eq(configuracoes.userId, ctx.user.id)); }
      catch (err) { console.warn('[configuracoes.get] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
    }
    if (rows.length === 0) {
      const supabase = await getSupabaseClientAsync();
      if (supabase) {
        const { data } = await supabase.from('configuracoes').select('chave, valor').eq('user_id', ctx.user.id);
        if (data) rows = data;
      }
    }
    const map: Record<string, string> = {};
    for (const r of rows) map[r.chave] = r.valor ?? '';
    // Helper: busca chave camelCase ou snake_case equivalente
    const get = (camel: string, snake: string, fallback = '') => map[camel] ?? map[snake] ?? fallback;
    return {
      nomeEmpresa: get('nomeEmpresa', 'nome_empresa'),
      cnpjEmpresa: get('cnpjEmpresa', 'cnpj_empresa'),
      telefoneEmpresa: get('telefoneEmpresa', 'telefone_empresa'),
      enderecoEmpresa: get('enderecoEmpresa', 'endereco_empresa'),
      assinaturaWhatsapp: get('assinaturaWhatsapp', 'assinatura_whatsapp'),
      fechamentoWhatsapp: get('fechamentoWhatsapp', 'fechamento_whatsapp'),
      multaPadrao: parseFloat(get('multaPadrao', 'multa_padrao', '2')),
      jurosMoraDiario: parseFloat(get('jurosMoraDiario', 'juros_mora_diario', '0.033')),
      diasLembrete: parseInt(get('diasLembrete', 'dias_lembrete', '3')),
      multaDiaria: parseFloat(get('multaDiaria', 'multa_diaria', '0')),
      pixKey: get('pixKey', 'pix_key'),
      nomeCobranca: get('nomeCobranca', 'nome_cobranca'),
      linkPagamento: get('linkPagamento', 'link_pagamento'),
      logoUrl: get('logoUrl', 'logo_url'),
      templateAtraso: get('templateAtraso', 'template_atraso'),
      templateVenceHoje: get('templateVenceHoje', 'template_vence_hoje'),
      templateAntecipada: get('templateAntecipada', 'template_antecipada'),
      jurosMultaAutomatico: (map['jurosMultaAutomatico'] ?? map['juros_multa_automatico'] ?? 'false') === 'true',
    };
  }),
  save: protectedProcedure
    .input(z.object({
      nomeEmpresa: z.string().optional(), cnpjEmpresa: z.string().optional(),
      telefoneEmpresa: z.string().optional(), enderecoEmpresa: z.string().optional(),
      assinaturaWhatsapp: z.string().optional(), fechamentoWhatsapp: z.string().optional(),
      multaPadrao: z.number().optional(), jurosMoraDiario: z.number().optional(),
      diasLembrete: z.number().optional(), multaDiaria: z.number().optional(),
      pixKey: z.string().optional(), nomeCobranca: z.string().optional(),
      linkPagamento: z.string().optional(), logoUrl: z.string().optional(),
      templateAtraso: z.string().optional(), templateVenceHoje: z.string().optional(),
      templateAntecipada: z.string().optional(),
      jurosMultaAutomatico: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const entries = Object.entries(input).filter(([, v]) => v !== undefined);
      if (db) {
        try {
          for (const [chave, valor] of entries) {
            await db.insert(configuracoes).values({ chave, valor: String(valor), userId: ctx.user.id }).onConflictDoUpdate({ target: [configuracoes.chave, configuracoes.userId], set: { valor: String(valor) } });
          }
          return { success: true };
        } catch (err) { console.warn('[configuracoes.save] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      for (const [chave, valor] of entries) {
        await supabase.from('configuracoes').upsert({ chave, valor: String(valor), user_id: ctx.user.id }, { onConflict: 'chave,user_id' });
      }
      return { success: true };
    }),
  templates: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try { return db.select().from(templatesWhatsapp).where(eq(templatesWhatsapp.userId, ctx.user.id)); }
      catch (err) { console.warn('[configuracoes.templates] Drizzle failed:', (err as Error).message); resetDb(); }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const { data } = await supabase.from('templates_whatsapp').select('*').eq('user_id', ctx.user.id);
    return data ?? [];
  }),

  updateTemplate: protectedProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().optional(),
      mensagem: z.string().optional(),
      ativo: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const db = await getDb();
      if (db) {
        try {
          await db.update(templatesWhatsapp).set(data).where(and(eq(templatesWhatsapp.id, id), eq(templatesWhatsapp.userId, ctx.user.id)));
          return { success: true };
        } catch (err) { console.warn('[configuracoes.updateTemplate] Drizzle failed:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('templates_whatsapp').update(data).eq('id', id).eq('user_id', ctx.user.id);
      return { success: true };
    }),

});

// ─── KOLETORES ──────────────────────────────────────────────────────────────
const cobradoresRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try { return db.select().from(koletores).where(eq(koletores.userId, ctx.user.id)).orderBy(desc(koletores.createdAt)); }
      catch (err) { console.warn('[koletores.list] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const { data } = await supabase.from('koletores').select('*').order('createdAt', { ascending: false }).eq('user_id', ctx.user.id);
    return data ?? [];
  }),
  me: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return null;
    try {
      const { data: koletor } = await supabase.from('koletores').select('*').eq('user_id', ctx.user.id).single();
      return koletor ?? null;
    } catch (_) { return null; }
  }),

  create: protectedProcedure
    .input(z.object({
      nome: z.string().min(2), email: z.string().email().optional().or(z.literal('')),
      telefone: z.string().optional(), whatsapp: z.string().optional(),
      perfil: z.enum(['admin', 'gerente', 'koletor']).default('koletor'),
      limiteEmprestimo: z.number().default(0), comissaoPercentual: z.number().default(0), observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          const result = await db.insert(koletores).values({ nome: input.nome, email: input.email || null, telefone: input.telefone || null, whatsapp: input.whatsapp || null, perfil: input.perfil, limiteEmprestimo: input.limiteEmprestimo.toString(), comissaoPercentual: input.comissaoPercentual.toString(), observacoes: input.observacoes || null, userId: ctx.user.id }).returning({ id: koletores.id });
          return { id: result[0].id, success: true };
        } catch (err) { console.warn('[koletores.create] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data, error } = await supabase.from('koletores').insert({ nome: input.nome, email: input.email || null, telefone: input.telefone || null, whatsapp: input.whatsapp || null, perfil: input.perfil, limite_emprestimo: input.limiteEmprestimo, comissao_percentual: input.comissaoPercentual, observacoes: input.observacoes || null, user_id: ctx.user.id }).select('id').single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { id: data.id, success: true };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), nome: z.string().optional(), email: z.string().optional(), telefone: z.string().optional(), whatsapp: z.string().optional(), perfil: z.enum(['admin', 'gerente', 'koletor']).optional(), limiteEmprestimo: z.number().optional(), comissaoPercentual: z.number().optional(), ativo: z.boolean().optional(), observacoes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const { id, limiteEmprestimo, comissaoPercentual, ...rest } = input;
      if (db) {
        try {
          const updateData: any = { ...rest };
          if (limiteEmprestimo !== undefined) updateData.limiteEmprestimo = limiteEmprestimo.toString();
          if (comissaoPercentual !== undefined) updateData.comissaoPercentual = comissaoPercentual.toString();
          const atualizados = await db.update(koletores).set(updateData)
            .where(and(eq(koletores.id, id), eq(koletores.userId, ctx.user.id)))
            .returning({ id: koletores.id });
          if (atualizados.length !== 1) throw new TRPCError({ code: 'NOT_FOUND', message: 'Koletor não encontrado' });
          return { success: true };
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          console.warn('[koletores.update] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const updateData: any = { ...rest };
      if (limiteEmprestimo !== undefined) updateData.limite_emprestimo = limiteEmprestimo;
      if (comissaoPercentual !== undefined) updateData.comissao_percentual = comissaoPercentual;
      const { data: atualizado, error: updateError } = await supabase.from('koletores').update(updateData).eq('id', id).eq('user_id', ctx.user.id).select('id').maybeSingle();
      if (updateError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updateError.message });
      if (!atualizado) throw new TRPCError({ code: 'NOT_FOUND', message: 'Koletor não encontrado' });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          const removidos = await db.update(koletores).set({ ativo: false })
            .where(and(eq(koletores.id, input.id), eq(koletores.userId, ctx.user.id)))
            .returning({ id: koletores.id });
          if (removidos.length !== 1) throw new TRPCError({ code: 'NOT_FOUND', message: 'Koletor não encontrado' });
          return { success: true };
        }
        catch (err) {
          if (err instanceof TRPCError) throw err;
          console.warn('[koletores.delete] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data: removido, error: deleteError } = await supabase.from('koletores').update({ ativo: false }).eq('id', input.id).eq('user_id', ctx.user.id).select('id').maybeSingle();
      if (deleteError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: deleteError.message });
      if (!removido) throw new TRPCError({ code: 'NOT_FOUND', message: 'Koletor não encontrado' });
      return { success: true };
    }),

  performance: protectedProcedure
    .input(z.object({ mes: z.number().optional(), ano: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return [];
      const ano = input.ano ?? new Date().getFullYear();
      const mes = input.mes ?? new Date().getMonth() + 1;
      const inicioMes = new Date(ano, mes - 1, 1).toISOString();
      const fimMes = new Date(ano, mes, 0, 23, 59, 59).toISOString();

      const { data: todosKoletores } = await supabase.from('koletores').select('*').eq('ativo', true).eq('user_id', ctx.user.id);

      const resultado = await Promise.all((todosKoletores ?? []).map(async (k: any) => {
        const { data: contratosKoletor } = await supabase.from('contratos').select('valor_principal')
          .eq('koletor_id', k.id).eq('user_id', ctx.user.id).gte('createdAt', inicioMes).lte('createdAt', fimMes);

        const { data: recebidoKoletor } = await supabase.from('parcelas').select('valor_pago')
          .eq('koletor_id', k.id).eq('user_id', ctx.user.id).eq('status', 'paga').gte('data_pagamento', inicioMes).lte('data_pagamento', fimMes);

        const { data: inadimplentesKoletor } = await supabase.from('parcelas').select('valor_original')
          .eq('koletor_id', k.id).eq('user_id', ctx.user.id).eq('status', 'atrasada');

        const totalEmprestado = (contratosKoletor ?? []).reduce((s: number, r: any) => s + parseFloat(r.valor_principal ?? '0'), 0);
        const totalRecebido = (recebidoKoletor ?? []).reduce((s: number, r: any) => s + parseFloat(r.valor_pago ?? '0'), 0);
        const totalInadimplente = (inadimplentesKoletor ?? []).reduce((s: number, r: any) => s + parseFloat(r.valor_original ?? '0'), 0);
        const comissao = totalRecebido * (parseFloat(k.comissao_percentual ?? '0') / 100);

        return {
          koletor: k,
          qtdContratos: (contratosKoletor ?? []).length,
          totalEmprestado,
          totalRecebido,
          totalInadimplente,
          qtdInadimplentes: (inadimplentesKoletor ?? []).length,
          comissao,
          taxaInadimplencia: totalEmprestado > 0 ? (totalInadimplente / totalEmprestado) * 100 : 0,
        };
      }));

      return resultado;
    }),
});

// ─── REPARCELAMENTO ───────────────────────────────────────────────────────────
const reparcelamentoRouter = router({
  preview: protectedProcedure
    .input(z.object({
      contratoId: z.number(),
      numeroParcelas: z.number().min(1),
      taxaJuros: z.number().min(0),
      tipoTaxa: z.enum(['diaria', 'semanal', 'quinzenal', 'mensal', 'anual']).default('mensal'),
      dataInicio: z.string(),
      incluirMultas: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      // Use Supabase REST to fetch open parcelas
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new Error('DB unavailable');

      const { data: parcelasAbertas, error: parcelasErr } = await supabase
        .from('parcelas')
        .select('*')
        .eq('contrato_id', input.contratoId)
        .eq('user_id', ctx.user.id)
        .in('status', ['pendente', 'atrasada', 'vencendo_hoje', 'parcial']);
      if (parcelasErr) throw new Error(parcelasErr.message);

      const hoje = new Date();
      let saldoDevedor = 0;
      for (const p of (parcelasAbertas ?? [])) {
        const valorBase = parseFloat(p.valor_original) - parseFloat(p.valor_pago ?? '0');
        let multa = 0;
        let juros = 0;
        if (input.incluirMultas && p.status === 'atrasada') {
          const vencDate = new Date(String(p.data_vencimento) + 'T00:00:00');
          const resultado = calcularJurosMora(valorBase, vencDate, hoje, 0.033, 2);
          multa = resultado.multa;
          juros = resultado.juros;
        }
        saldoDevedor += valorBase + multa + juros;
      }

      const valorNovaParcela = calcularParcelaPadrao(saldoDevedor, input.taxaJuros, input.numeroParcelas);
      const dataInicioDate = new Date(input.dataInicio);

      return {
        saldoDevedor,
        valorNovaParcela,
        totalNovo: valorNovaParcela * input.numeroParcelas,
        qtdParcelasAbertas: (parcelasAbertas ?? []).length,
        parcelas: Array.from({ length: input.numeroParcelas }, (_, i) => {
          const venc = new Date(dataInicioDate);
          venc.setMonth(venc.getMonth() + i);
          return {
            numero: i + 1,
            valor: valorNovaParcela,
            vencimento: venc.toISOString().split('T')[0],
          };
        }),
      };
    }),

  executar: protectedProcedure
    .input(z.object({
      contratoId: z.number(),
      numeroParcelas: z.number().min(1),
      taxaJuros: z.number().min(0),
      tipoTaxa: z.enum(['diaria', 'semanal', 'quinzenal', 'mensal', 'anual']).default('mensal'),
      dataInicio: z.string(),
      incluirMultas: z.boolean().default(true),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Este fluxo realiza várias escritas REST sem transação. Mantê-lo ativo
      // permitiria marcar o contrato original como quitado antes de criar todas
      // as novas parcelas. A operação volta quando for movida para RPC atômica.
      if (process.env.ENABLE_ATOMIC_REPARCELAMENTO !== 'true') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Reparcelamento temporariamente indisponível durante a atualização de segurança financeira.',
        });
      }

      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

      // Buscar contrato original
      const { data: contratoOriginalArr, error: contratoErr } = await supabase
        .from('contratos').select('*').eq('id', input.contratoId).eq('user_id', ctx.user.id).single();
      if (contratoErr || !contratoOriginalArr) throw new Error('Contrato não encontrado');
      const contratoOriginal = contratoOriginalArr;

      // Buscar parcelas em aberto
      const { data: parcelasAbertas } = await supabase
        .from('parcelas').select('*')
        .eq('contrato_id', input.contratoId)
        .eq('user_id', ctx.user.id)
        .in('status', ['pendente', 'atrasada', 'vencendo_hoje', 'parcial']);

      const hoje = new Date();
      let saldoDevedor = 0;
      for (const p of (parcelasAbertas ?? [])) {
        const valorBase = parseFloat(p.valor_original) - parseFloat(p.valor_pago ?? '0');
        let multa = 0;
        let juros = 0;
        if (input.incluirMultas && p.status === 'atrasada') {
          const vencDate = new Date(String(p.data_vencimento) + 'T00:00:00');
          const resultado = calcularJurosMora(valorBase, vencDate, hoje, 0.033, 2);
          multa = resultado.multa;
          juros = resultado.juros;
        }
        saldoDevedor += valorBase + multa + juros;
      }

      // Cancelar parcelas abertas do contrato original
      for (const p of (parcelasAbertas ?? [])) {
        await supabase.from('parcelas').update({ status: 'paga', observacoes: 'Reparcelado' }).eq('id', p.id).eq('user_id', ctx.user.id);
      }

      // Cancelar contrato original
      await supabase.from('contratos').update({ status: 'quitado' }).eq('id', input.contratoId).eq('user_id', ctx.user.id);

      // Criar novo contrato de reparcelamento
      const valorNovaParcela2 = calcularParcelaPadrao(saldoDevedor, input.taxaJuros, input.numeroParcelas);
      const dataInicioDate = new Date(input.dataInicio);

      const { data: novoContrato, error: novoContratoErr } = await supabase
        .from('contratos')
        .insert({
          cliente_id: contratoOriginal.cliente_id,
          koletor_id: contratoOriginal.koletor_id ?? null,
          modalidade: 'reparcelamento',
          status: 'ativo',
          valor_principal: saldoDevedor.toFixed(2),
          taxa_juros: input.taxaJuros.toFixed(4),
          tipo_taxa: input.tipoTaxa,
          numero_parcelas: input.numeroParcelas,
          valor_parcela: valorNovaParcela2.toFixed(2),
          total_contrato: (valorNovaParcela2 * input.numeroParcelas).toFixed(2),
          multa_atraso: contratoOriginal.multa_atraso ?? '2.00',
          juros_mora_diario: contratoOriginal.juros_mora_diario ?? '0.033',
          data_inicio: dataInicioDate.toISOString().split('T')[0],
          data_vencimento_primeira: dataInicioDate.toISOString().split('T')[0],
          contrato_origem_id: input.contratoId,
          observacoes: input.observacoes || `Reparcelamento do contrato #${input.contratoId}`,
          user_id: ctx.user.id,
        })
        .select('id')
        .single();
      if (novoContratoErr || !novoContrato) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: novoContratoErr?.message ?? 'Failed to create reparcelamento' });
      const novoContratoId = novoContrato.id;

      // Criar novas parcelas via REST
      for (let i = 0; i < input.numeroParcelas; i++) {
        const venc = new Date(dataInicioDate);
        venc.setMonth(venc.getMonth() + i);
        await supabase.from('parcelas').insert({
          contrato_id: novoContratoId,
          cliente_id: contratoOriginal.cliente_id,
          koletor_id: contratoOriginal.koletor_id ?? null,
          numero: i + 1,
          valor: valorNovaParcela2.toFixed(2),
          valor_original: valorNovaParcela2.toFixed(2),
          data_vencimento: venc.toISOString().split('T')[0],
          status: 'pendente',
          user_id: ctx.user.id,
        });
      }
      return { success: true, novoContratoId };
    }),
});

// ─── CONTAS A PAGAR ──────────────────────────────────────────────────────────
const contasPagarRouter = router({
  listar: protectedProcedure
    .input(z.object({
      status: z.enum(['pendente', 'paga', 'atrasada', 'cancelada', 'todos']).optional(),
      categoria: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          let query = db.select().from(contasPagar).$dynamic();
          const conditions = [eq(contasPagar.userId, ctx.user.id)];
          if (input?.status && input.status !== 'todos') conditions.push(eq(contasPagar.status, input.status as 'pendente' | 'paga' | 'atrasada' | 'cancelada'));
          if (input?.categoria) conditions.push(eq(contasPagar.categoria, input.categoria as 'aluguel' | 'salario' | 'servicos' | 'impostos' | 'fornecedores' | 'marketing' | 'tecnologia' | 'outros'));
          query = query.where(and(...conditions));
          return query.orderBy(desc(contasPagar.dataVencimento));
        } catch (err) {
          console.warn('[contasPagar.listar] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return [];
      let q = supabase.from('contas_pagar').select('*').order('data_vencimento', { ascending: false }).eq('user_id', ctx.user.id);
      if (input?.status && input.status !== 'todos') {
        q = input.status === 'paga' ? q.in('status', ['paga', 'pago']) : q.eq('status', input.status);
      }
      if (input?.categoria) q = q.eq('categoria', input.categoria);
      const { data, error } = await q;
      if (error) { console.error('[contasPagar.listar] REST error:', error.message); return []; }
      return (data ?? []).map((r: any) => ({ ...r, status: normalizarStatusContaPagar(r.status), dataVencimento: r.data_vencimento, dataPagamento: r.data_pagamento, contaCaixaId: r.conta_caixa_id }));
    }),

  criar: protectedProcedure
    .input(z.object({
      descricao: z.string().min(1),
      categoria: z.enum(['aluguel', 'salario', 'servicos', 'impostos', 'fornecedores', 'marketing', 'tecnologia', 'outros']),
      valor: z.number().positive(),
      dataVencimento: z.string(),
      recorrente: z.boolean().optional().default(false),
      periodicidade: z.enum(['mensal', 'semanal', 'anual', 'unica']).optional().default('unica'),
      observacoes: z.string().optional(),
      contaCaixaId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.contaCaixaId) await validarContaDoUsuario(ctx.user.id, input.contaCaixaId);
      const db = await getDb();
      if (db) {
        try {
          const result = await db.insert(contasPagar).values({
            descricao: input.descricao, categoria: input.categoria, valor: String(input.valor),
            dataVencimento: input.dataVencimento, recorrente: input.recorrente ?? false,
            periodicidade: input.periodicidade ?? 'unica', observacoes: input.observacoes,
            contaCaixaId: input.contaCaixaId, status: 'pendente',
            userId: ctx.user.id,
          }).returning({ id: contasPagar.id });
          return { success: true, id: result[0].id };
        } catch (err) { console.warn('[contasPagar.criar] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const payloadComPeriodicidade = {
        descricao: input.descricao, categoria: input.categoria, valor: input.valor,
        data_vencimento: input.dataVencimento, recorrente: input.recorrente ?? false,
        periodicidade: input.periodicidade ?? 'unica', observacoes: input.observacoes ?? null,
        conta_caixa_id: input.contaCaixaId ?? null, status: 'pendente',
        user_id: ctx.user.id,
      };
      let { data, error } = await supabase.from('contas_pagar').insert(payloadComPeriodicidade).select('id').single();

      // Compatibilidade temporária: algumas bases antigas ainda não possuem
      // a coluna periodicidade. Não bloquear o cadastro de uma despesa avulsa.
      if (deveRepetirSemPeriodicidade(error)) {
        console.warn('[contasPagar.criar] Coluna periodicidade ausente; cadastrando sem recorrência persistida.');
        const { periodicidade: _periodicidade, ...payloadLegado } = payloadComPeriodicidade;
        ({ data, error } = await supabase.from('contas_pagar').insert(payloadLegado).select('id').single());
      }
      if (error || !data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error?.message ?? 'Não foi possível criar a conta a pagar' });
      return { success: true, id: data.id };
    }),

  pagar: protectedProcedure
    .input(z.object({
      id: z.number(),
      contaCaixaId: z.number().int().positive(),
      dataPagamento: z.string().optional(),
      idempotencyKey: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await validarContaDoUsuario(ctx.user.id, input.contaCaixaId);
      const dataReferencia = input.dataPagamento ?? dataHojeBrasilia();
      // Não persistir uma reserva de operação antes de confirmar a origem da
      // despesa. O ID é controlado pelo cliente e precisa ser isolado por tenant.
      const supabaseAutorizacao = await getSupabaseClientAsync();
      if (!supabaseAutorizacao) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data: contaAutorizada, error: contaAutorizadaErro } = await supabaseAutorizacao.from('contas_pagar')
        .select('id').eq('id', input.id).eq('user_id', ctx.user.id).maybeSingle();
      if (contaAutorizadaErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: contaAutorizadaErro.message });
      if (!contaAutorizada) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conta não encontrada' });
      const reserva = await reservarOperacaoFinanceira({
        userId: ctx.user.id,
        tipo: 'pagamento_conta',
        chaveIdempotencia: input.idempotencyKey ?? criarChaveIdempotencia(),
        payload: { id: input.id, contaCaixaId: input.contaCaixaId, dataPagamento: dataReferencia },
      });
      if (reserva.repetida) return { success: true, repetida: true, ...(reserva.resultado ?? {}) } as any;
      const dataPag = new Date(dataCivilBrasiliaParaIso(dataReferencia));
      try {
      if (db) {
        let mutacaoIniciada = false;
        try {
          const conta = await db.select().from(contasPagar).where(and(eq(contasPagar.id, input.id), eq(contasPagar.userId, ctx.user.id))).limit(1);
          if (!conta[0]) throw new Error('Conta não encontrada');
          if (!contaPagarPodeSerProcessada(conta[0].status)) throw new TRPCError({ code: 'CONFLICT', message: 'Esta despesa já foi processada' });
          const atualizada = await db.update(contasPagar).set({ status: 'paga', dataPagamento: dataPag, contaCaixaId: input.contaCaixaId }).where(and(eq(contasPagar.id, input.id), eq(contasPagar.userId, ctx.user.id))).returning({ id: contasPagar.id });
          if (atualizada.length !== 1) throw new TRPCError({ code: 'CONFLICT', message: 'A despesa não pôde ser marcada como paga' });
          mutacaoIniciada = true;
          try {
            await db.insert(transacoesCaixa).values({ contaCaixaId: input.contaCaixaId, tipo: 'saida', categoria: 'despesa_operacional', valor: conta[0].valor, descricao: descricaoPagamentoConta(input.id, conta[0].descricao), dataTransacao: dataPag, userId: ctx.user.id });
          } catch (txError) {
            await db.update(contasPagar).set({ status: conta[0].status, dataPagamento: null, contaCaixaId: conta[0].contaCaixaId }).where(and(eq(contasPagar.id, input.id), eq(contasPagar.userId, ctx.user.id)));
            throw txError;
          }
          const resultado = { contaId: input.id, dataPagamento: dataReferencia };
          await concluirOperacaoFinanceira(reserva.id, resultado);
          await registrarAuditoriaFinanceira({ userId: ctx.user.id, operacaoId: reserva.id, acao: 'pagar_conta', entidade: 'contas_pagar', entidadeId: input.id, detalhes: { contaCaixaId: input.contaCaixaId, dataPagamento: dataReferencia, valor: conta[0].valor } });
          return { success: true, repetida: false, operationId: reserva.id, ...resultado };
        } catch (err: any) {
          if (err?.code === 'CONFLICT' || err.message === 'Conta não encontrada') throw err;
          if (mutacaoIniciada) throw err;
          console.warn('[contasPagar.pagar] Drizzle failed, trying REST:', err.message); resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data: contaData, error: contaError } = await supabase.from('contas_pagar').select('valor, descricao, status').eq('id', input.id).eq('user_id', ctx.user.id).single();
      if (contaError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: contaError.message });
      if (!contaData) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conta não encontrada' });
      if (!contaPagarPodeSerProcessada(contaData.status)) throw new TRPCError({ code: 'CONFLICT', message: 'Esta despesa já foi processada' });

      // A atualização condicional funciona como trava: apenas uma solicitação concorrente pode pagar a despesa.
      const { data: contaAtualizada, error: updateError } = await marcarContaPagaComCompatibilidade(
        supabase, input.id, ctx.user.id, dataPag.toISOString(), input.contaCaixaId,
      );
      if (updateError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updateError.message });
      if (!contaAtualizada) throw new TRPCError({ code: 'CONFLICT', message: 'Esta despesa já foi processada' });

      const descricao = descricaoPagamentoConta(input.id, contaData.descricao);
      const { error: transacaoErro } = await supabase.from('transacoes_caixa').insert({
        conta_caixa_id: input.contaCaixaId, tipo: 'saida', categoria: 'despesa_operacional', valor: contaData.valor,
        descricao, data_transacao: dataPag.toISOString(), user_id: ctx.user.id,
      });
      if (transacaoErro) {
        // Compensação: a despesa só permanece paga se a saída correspondente existir no livro de Caixa.
        await supabase.from('contas_pagar').update({ status: contaData.status, data_pagamento: null, conta_caixa_id: null })
          .eq('id', input.id).eq('user_id', ctx.user.id).eq('status', 'paga');
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: transacaoErro.message });
      }
      const resultado = { contaId: input.id, dataPagamento: dataReferencia };
      await concluirOperacaoFinanceira(reserva.id, resultado);
      await registrarAuditoriaFinanceira({
        userId: ctx.user.id, operacaoId: reserva.id, acao: 'pagar_conta', entidade: 'contas_pagar', entidadeId: input.id,
        detalhes: { contaCaixaId: input.contaCaixaId, dataPagamento: dataReferencia, valor: contaData.valor },
      });
      return { success: true, repetida: false, operationId: reserva.id, ...resultado };
      } catch (error) {
        await falharOperacaoFinanceira(reserva.id, error);
        throw error;
      }
    }),

  cancelar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try { await db.update(contasPagar).set({ status: 'cancelada' }).where(and(eq(contasPagar.id, input.id), eq(contasPagar.userId, ctx.user.id), inArray(contasPagar.status, ['pendente', 'atrasada']))); return { success: true }; }
        catch (err) { console.warn('[contasPagar.cancelar] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data, error } = await supabase.from('contas_pagar').update({ status: 'cancelada' })
        .eq('id', input.id).eq('user_id', ctx.user.id).in('status', ['pendente', 'atrasada']).select('id').maybeSingle();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      if (!data) throw new TRPCError({ code: 'CONFLICT', message: 'Uma despesa paga deve ser estornada, não cancelada' });
      return { success: true };
    }),

  estornar: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

      const { data: conta, error: contaErro } = await supabase.from('contas_pagar')
        .select('id, valor, descricao, status, conta_caixa_id, data_pagamento')
        .eq('id', input.id).eq('user_id', ctx.user.id).single();
      if (contaErro || !conta) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conta não encontrada' });
      if (!statusContaPaga(conta.status)) throw new TRPCError({ code: 'CONFLICT', message: 'Apenas despesas pagas podem ser estornadas' });

      const { data: contaEstornada, error: estornoErro } = await supabase.from('contas_pagar')
        .update({ status: 'cancelada' })
        .eq('id', input.id).eq('user_id', ctx.user.id).in('status', ['paga', 'pago'])
        .select('id').maybeSingle();
      if (estornoErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: estornoErro.message });
      if (!contaEstornada) throw new TRPCError({ code: 'CONFLICT', message: 'Esta despesa já foi estornada' });

      if (conta.conta_caixa_id) {
        const { error: transacaoErro } = await supabase.from('transacoes_caixa').insert({
          conta_caixa_id: conta.conta_caixa_id,
          tipo: 'entrada',
          categoria: 'despesa_operacional',
          valor: conta.valor,
          descricao: descricaoEstornoConta(input.id, conta.descricao),
          data_transacao: new Date().toISOString(),
          user_id: ctx.user.id,
        });
        if (transacaoErro) {
          // Compensação: se a devolução não entrou no Caixa, a despesa continua paga.
          await supabase.from('contas_pagar').update({ status: conta.status })
            .eq('id', input.id).eq('user_id', ctx.user.id).eq('status', 'cancelada');
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: transacaoErro.message });
        }
      }
      return { success: true };
    }),

  sincronizarCaixa: protectedProcedure.mutation(async ({ ctx }) => {
    // A antiga rotina criava saídas ao abrir telas e podia alterar o livro-caixa
    // sem revisão do operador. Ela permanece bloqueada até ser substituída por
    // uma reconciliação que apresente divergências antes de qualquer correção.
    if (process.env.ENABLE_LEGACY_CASH_SYNC === 'true') {
      // Mantido apenas para recuperação controlada de instalações legadas.
      // Não configurar em produção: o fluxo abaixo não apresenta prévia.
    } else {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'A sincronização automática do caixa foi desativada. Use apenas a conferência financeira revisada.',
      });
    }

    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
    const { data: pagas, error: contasErro } = await supabase.from('contas_pagar')
      .select('id, valor, descricao, conta_caixa_id, data_pagamento')
      .eq('user_id', ctx.user.id).in('status', ['paga', 'pago']).not('conta_caixa_id', 'is', null);
    if (contasErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: contasErro.message });

    let corrigidas = 0;
    for (const conta of pagas ?? []) {
      const descricao = descricaoPagamentoConta(conta.id, conta.descricao);
      const descricaoLegada = `Pagamento: ${conta.descricao}`;
      const { data: existente, error: existenteErro } = await supabase.from('transacoes_caixa')
        .select('id').eq('user_id', ctx.user.id).eq('conta_caixa_id', conta.conta_caixa_id)
        .eq('tipo', 'saida').eq('categoria', 'despesa_operacional').in('descricao', [descricao, descricaoLegada]).limit(1).maybeSingle();
      if (existenteErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: existenteErro.message });
      if (!existente) {
        const { error: inserirErro } = await supabase.from('transacoes_caixa').insert({
          conta_caixa_id: conta.conta_caixa_id, tipo: 'saida', categoria: 'despesa_operacional', valor: conta.valor,
          descricao, data_transacao: conta.data_pagamento ?? new Date().toISOString(), user_id: ctx.user.id,
        });
        if (inserirErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: inserirErro.message });
        corrigidas++;
      }
    }
    return { success: true, corrigidas };
  }),

  excluir: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try { await db.delete(contasPagar).where(and(eq(contasPagar.id, input.id), eq(contasPagar.userId, ctx.user.id), eq(contasPagar.status, 'cancelada'), isNull(contasPagar.dataPagamento))); return { success: true }; }
        catch (err) { console.warn('[contasPagar.excluir] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { error } = await supabase.from('contas_pagar').delete()
        .eq('id', input.id).eq('user_id', ctx.user.id).eq('status', 'cancelada').is('data_pagamento', null);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  resumo: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return { totalPendente: 0, qtdPendente: 0, totalAtrasado: 0, qtdAtrasado: 0, totalPago: 0, qtdPago: 0 };
      const { data: all } = await supabase.from('contas_pagar').select('status, valor').eq('user_id', ctx.user.id);
      const pendentes = (all ?? []).filter((r: any) => r.status === 'pendente');
      const atrasadas = (all ?? []).filter((r: any) => r.status === 'atrasada');
      const pagas = (all ?? []).filter((r: any) => statusContaPaga(r.status));
      return {
        totalPendente: pendentes.reduce((s: number, r: any) => s + parseFloat(r.valor ?? 0), 0), qtdPendente: pendentes.length,
        totalAtrasado: atrasadas.reduce((s: number, r: any) => s + parseFloat(r.valor ?? 0), 0), qtdAtrasado: atrasadas.length,
        totalPago: pagas.reduce((s: number, r: any) => s + parseFloat(r.valor ?? 0), 0), qtdPago: pagas.length,
      };
    }
    if (false) throw new Error(); // keep block structure
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];
    const pendentes = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)`, qtd: sql<number>`COUNT(*)` })
      .from(contasPagar).where(and(eq(contasPagar.status, 'pendente'), eq(contasPagar.userId, ctx.user.id)));
    const atrasadas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)`, qtd: sql<number>`COUNT(*)` })
      .from(contasPagar).where(and(eq(contasPagar.status, 'atrasada'), eq(contasPagar.userId, ctx.user.id)));
    const pagas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)`, qtd: sql<number>`COUNT(*)` })
      .from(contasPagar).where(and(eq(contasPagar.status, 'paga'), eq(contasPagar.userId, ctx.user.id)));
    return {
      totalPendente: parseFloat(pendentes[0]?.total ?? '0'),
      qtdPendente: pendentes[0]?.qtd ?? 0,
      totalAtrasado: parseFloat(atrasadas[0]?.total ?? '0'),
      qtdAtrasado: atrasadas[0]?.qtd ?? 0,
      totalPago: parseFloat(pagas[0]?.total ?? '0'),
      qtdPago: pagas[0]?.qtd ?? 0,
    };
  }),
});

// ─── VENDAS DE PRODUTOS ──────────────────────────────────────────────────────────
const vendasRouter = router({
  listarProdutos: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (db) {
      try { return db.select().from(produtos).where(and(eq(produtos.ativo, true), eq(produtos.userId, ctx.user.id))).orderBy(desc(produtos.createdAt)); }
      catch (err) { console.warn('[vendas.listarProdutos] Drizzle failed:', (err as Error).message); resetDb(); }
    }
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    const { data } = await supabase.from('produtos').select('*').eq('ativo', true).eq('user_id', ctx.user.id).order('createdAt', { ascending: false });
    return data ?? [];
  }),

  criarProduto: protectedProcedure
    .input(z.object({ nome: z.string().min(1), descricao: z.string().optional(), preco: z.number().positive(), estoque: z.number().int().min(0).default(0) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          const result = await db.insert(produtos).values({ nome: input.nome, descricao: input.descricao, preco: input.preco.toFixed(2), estoque: input.estoque, userId: ctx.user.id }).returning({ id: produtos.id });
          return { success: true, id: result[0].id };
        } catch (err) { console.warn('[vendas.criarProduto] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data, error } = await supabase.from('produtos').insert({ nome: input.nome, descricao: input.descricao ?? null, preco: input.preco, estoque: input.estoque, user_id: ctx.user.id }).select('id').single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true, id: data.id };
    }),

  atualizarEstoque: protectedProcedure
    .input(z.object({ id: z.number(), estoque: z.number().int().min(0) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try { await db.update(produtos).set({ estoque: input.estoque }).where(and(eq(produtos.id, input.id), eq(produtos.userId, ctx.user.id))); return { success: true }; }
        catch (err) { console.warn('[vendas.atualizarEstoque] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('produtos').update({ estoque: input.estoque }).eq('id', input.id).eq('user_id', ctx.user.id);
      return { success: true };
    }),

  desativarProduto: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try { await db.update(produtos).set({ ativo: false }).where(and(eq(produtos.id, input.id), eq(produtos.userId, ctx.user.id))); return { success: true }; }
        catch (err) { console.warn('[vendas.desativarProduto] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('produtos').update({ ativo: false }).eq('id', input.id).eq('user_id', ctx.user.id);
      return { success: true };
    }),
});

// ─── DESCONTO DE CHEQUES ──────────────────────────────────────────────────────────
const chequesRouter = router({
  listar: protectedProcedure
    .input(z.object({
      status: z.enum(['aguardando', 'compensado', 'devolvido', 'cancelado', 'todos']).optional(),
      clienteId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          const rows = await db.select({
            id: cheques.id, clienteId: cheques.clienteId, clienteNome: clientes.nome,
            numeroCheque: cheques.numeroCheque, banco: cheques.banco, emitente: cheques.emitente,
            cpfCnpjEmitente: cheques.cpfCnpjEmitente, valorNominal: cheques.valorNominal,
            dataVencimento: cheques.dataVencimento, taxaDesconto: cheques.taxaDesconto,
            tipoTaxa: cheques.tipoTaxa, valorDesconto: cheques.valorDesconto, valorLiquido: cheques.valorLiquido,
            status: cheques.status, contaCaixaId: cheques.contaCaixaId, dataCompensacao: cheques.dataCompensacao,
            motivoDevolucao: cheques.motivoDevolucao, observacoes: cheques.observacoes, createdAt: cheques.createdAt,
          }).from(cheques).leftJoin(clientes, eq(cheques.clienteId, clientes.id)).where(eq(cheques.userId, ctx.user.id)).orderBy(desc(cheques.createdAt));
          return rows.filter(r => {
            if (input?.status && input.status !== 'todos' && r.status !== input.status) return false;
            if (input?.clienteId && r.clienteId !== input.clienteId) return false;
            return true;
          });
        } catch (err) { console.warn('[cheques.listar] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return [];
      let q = supabase.from('cheques').select('*, clientes(nome)').order('createdAt', { ascending: false }).eq('user_id', ctx.user.id);
      if (input?.status && input.status !== 'todos') q = q.eq('status', input.status);
      if (input?.clienteId) q = q.eq('cliente_id', input.clienteId);
      const { data } = await q;
      return (data ?? []).map((r: any) => ({
        ...r, clienteId: r.cliente_id, clienteNome: r.clientes?.nome ?? null,
        numeroCheque: r.numero_cheque, valorNominal: r.valor_nominal, dataVencimento: r.data_vencimento,
        taxaDesconto: r.taxa_desconto, tipoTaxa: r.tipo_taxa, valorDesconto: r.valor_desconto,
        valorLiquido: r.valor_liquido, contaCaixaId: r.conta_caixa_id, dataCompensacao: r.data_compensacao,
        motivoDevolucao: r.motivo_devolucao,
      }));
    }),

  criar: protectedProcedure
    .input(z.object({
      clienteId: z.number(),
      numeroCheque: z.string().optional(),
      banco: z.string().optional(),
      agencia: z.string().optional(),
      conta: z.string().optional(),
      emitente: z.string().min(1),
      cpfCnpjEmitente: z.string().optional(),
      valorNominal: z.number().positive(),
      dataVencimento: z.string(),
      taxaDesconto: z.number().positive(),
      tipoTaxa: z.enum(['diaria', 'semanal', 'quinzenal', 'mensal', 'anual']).default('mensal'),
      contaCaixaId: z.number().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await validarClienteDoUsuario(ctx.user.id, input.clienteId);
      if (input.contaCaixaId) await validarContaDoUsuario(ctx.user.id, input.contaCaixaId);
      const db = await getDb();
      const dbAvailable = !!db;
      const dataVenc = new Date(input.dataVencimento + 'T00:00:00');
      const hoje = new Date();
      const diasAteVencimento = Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      // Calcular desconto baseado na taxa e tipo
      let taxaDiaria: number;
      if (input.tipoTaxa === 'diaria') {
        taxaDiaria = input.taxaDesconto / 100;
      } else if (input.tipoTaxa === 'mensal') {
        taxaDiaria = Math.pow(1 + input.taxaDesconto / 100, 1 / 30) - 1;
      } else { // anual
        taxaDiaria = Math.pow(1 + input.taxaDesconto / 100, 1 / 365) - 1;
      }
      const fatorDesconto = Math.pow(1 + taxaDiaria, diasAteVencimento);
      const valorLiquido = input.valorNominal / fatorDesconto;
      const valorDesconto = input.valorNominal - valorLiquido;
      if (dbAvailable && db) {
        try {
          const result = await db.insert(cheques).values({
            clienteId: input.clienteId, numeroCheque: input.numeroCheque, banco: input.banco,
            agencia: input.agencia, conta: input.conta, emitente: input.emitente,
            cpfCnpjEmitente: input.cpfCnpjEmitente, valorNominal: input.valorNominal.toFixed(2),
            dataVencimento: dataVenc.toISOString().split('T')[0], taxaDesconto: input.taxaDesconto.toFixed(4),
            tipoTaxa: input.tipoTaxa as 'diaria' | 'mensal' | 'anual',
            valorDesconto: valorDesconto.toFixed(2), valorLiquido: valorLiquido.toFixed(2),
            contaCaixaId: input.contaCaixaId, observacoes: input.observacoes, status: 'aguardando', userId: ctx.user.id,
          }).returning({ id: cheques.id });
          if (input.contaCaixaId) {
            await db.insert(transacoesCaixa).values({ contaCaixaId: input.contaCaixaId, tipo: 'saida', categoria: 'outros', valor: valorLiquido.toFixed(2), descricao: `Desconto de cheque - ${input.emitente}`, dataTransacao: new Date(), userId: ctx.user.id });
          }
          return { success: true, id: result[0].id, valorLiquido, valorDesconto };
        } catch (err) { console.warn('[cheques.criar] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data: chqData, error: chqErr } = await supabase.from('cheques').insert({ user_id: ctx.user.id,
        cliente_id: input.clienteId, numero_cheque: input.numeroCheque ?? null, banco: input.banco ?? null,
        agencia: input.agencia ?? null, conta: input.conta ?? null, emitente: input.emitente,
        cpf_cnpj_emitente: input.cpfCnpjEmitente ?? null, valor_nominal: input.valorNominal,
        data_vencimento: dataVenc.toISOString().split('T')[0], taxa_desconto: input.taxaDesconto,
        tipo_taxa: input.tipoTaxa, valor_desconto: valorDesconto, valor_liquido: valorLiquido,
        conta_caixa_id: input.contaCaixaId ?? null, observacoes: input.observacoes ?? null, status: 'aguardando',
      }).select('id').single();
      if (chqErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: chqErr.message });
      if (input.contaCaixaId) {
        await supabase.from('transacoes_caixa').insert({ conta_caixa_id: input.contaCaixaId, tipo: 'saida', categoria: 'outros', valor: valorLiquido, descricao: `Desconto de cheque - ${input.emitente}`, data_transacao: new Date().toISOString(), user_id: ctx.user.id });
      }
      return { success: true, id: chqData.id, valorLiquido, valorDesconto };
    }),

  compensar: protectedProcedure
    .input(z.object({ id: z.number(), contaCaixaId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          const cheque = await db.select().from(cheques).where(and(eq(cheques.id, input.id), eq(cheques.userId, ctx.user.id))).limit(1);
          if (!cheque[0]) throw new Error('Cheque não encontrado');
          const contaId = input.contaCaixaId ?? cheque[0].contaCaixaId;
          if (contaId) await validarContaDoUsuario(ctx.user.id, contaId);
          await db.update(cheques).set({ status: 'compensado', dataCompensacao: new Date(), contaCaixaId: contaId }).where(and(eq(cheques.id, input.id), eq(cheques.userId, ctx.user.id)));
          if (contaId) await db.insert(transacoesCaixa).values({ contaCaixaId: contaId, tipo: 'entrada', categoria: 'outros', valor: cheque[0].valorNominal, descricao: `Cheque compensado - ${cheque[0].emitente}`, dataTransacao: new Date(), userId: ctx.user.id });
          return { success: true };
        } catch (err: any) { if (err.message === 'Cheque não encontrado') throw err; console.warn('[cheques.compensar] Drizzle failed, trying REST:', err.message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data: chqData, error: chequeBuscaErro } = await supabase.from('cheques')
        .select('valor_nominal, emitente, conta_caixa_id, status').eq('id', input.id).eq('user_id', ctx.user.id).single();
      if (chequeBuscaErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: chequeBuscaErro.message });
      if (!chqData) throw new Error('Cheque não encontrado');
      if (!podeRegistrarMovimento(chqData.status, ['aguardando'])) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Este cheque já foi processado' });
      }
      const contaId = input.contaCaixaId ?? chqData.conta_caixa_id;
      if (contaId) await validarContaDoUsuario(ctx.user.id, contaId);
      const { data: chequeAtualizado, error: chequeAtualizarErro } = await supabase.from('cheques')
        .update({ status: 'compensado', data_compensacao: new Date().toISOString(), conta_caixa_id: contaId })
        .eq('id', input.id).eq('user_id', ctx.user.id).eq('status', 'aguardando').select('id').maybeSingle();
      if (chequeAtualizarErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: chequeAtualizarErro.message });
      if (!chequeAtualizado) throw new TRPCError({ code: 'CONFLICT', message: 'Este cheque já foi processado' });
      if (contaId) {
        const descricaoCheque = `Cheque compensado - ${chqData.emitente}`;
        const { data: entradaChequeExistente, error: buscaEntradaChequeErro } = await supabase.from('transacoes_caixa')
          .select('id').eq('conta_caixa_id', contaId).eq('tipo', 'entrada').eq('descricao', descricaoCheque)
          .eq('user_id', ctx.user.id).limit(1).maybeSingle();
        if (buscaEntradaChequeErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: buscaEntradaChequeErro.message });
        if (!entradaChequeExistente) {
          const { error: entradaChequeErro } = await supabase.from('transacoes_caixa').insert({
            conta_caixa_id: contaId, tipo: 'entrada', categoria: 'outros', valor: chqData.valor_nominal,
            descricao: descricaoCheque, data_transacao: new Date().toISOString(), user_id: ctx.user.id,
          });
          if (entradaChequeErro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: entradaChequeErro.message });
        }
      }
      return { success: true };
    }),

  devolver: protectedProcedure
    .input(z.object({ id: z.number(), motivo: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try { await db.update(cheques).set({ status: 'devolvido', motivoDevolucao: input.motivo }).where(and(eq(cheques.id, input.id), eq(cheques.userId, ctx.user.id))); return { success: true }; }
        catch (err) { console.warn('[cheques.devolver] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('cheques').update({ status: 'devolvido', motivo_devolucao: input.motivo }).eq('id', input.id).eq('user_id', ctx.user.id);
      return { success: true };
    }),

  cancelar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try { await db.update(cheques).set({ status: 'cancelado' }).where(and(eq(cheques.id, input.id), eq(cheques.userId, ctx.user.id))); return { success: true }; }
        catch (err) { console.warn('[cheques.cancelar] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('cheques').update({ status: 'cancelado' }).eq('id', input.id).eq('user_id', ctx.user.id);
      return { success: true };
    }),

  resumo: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return { totalAguardando: 0, qtdAguardando: 0, totalCompensado: 0, qtdCompensado: 0, totalDevolvido: 0, qtdDevolvido: 0 };
      const { data: all } = await supabase.from('cheques').select('status, valor_nominal').eq('user_id', ctx.user.id);
      const ag = (all ?? []).filter((r: any) => r.status === 'aguardando');
      const co = (all ?? []).filter((r: any) => r.status === 'compensado');
      const de = (all ?? []).filter((r: any) => r.status === 'devolvido');
      return {
        totalAguardando: ag.reduce((s: number, r: any) => s + parseFloat(r.valor_nominal ?? 0), 0), qtdAguardando: ag.length,
        totalCompensado: co.reduce((s: number, r: any) => s + parseFloat(r.valor_nominal ?? 0), 0), qtdCompensado: co.length,
        totalDevolvido: de.reduce((s: number, r: any) => s + parseFloat(r.valor_nominal ?? 0), 0), qtdDevolvido: de.length,
      };
    }
    const aguardando = await db.select({ total: sql<string>`COALESCE(SUM(valor_nominal), 0)`, qtd: sql<number>`COUNT(*)` }).from(cheques).where(and(eq(cheques.status, 'aguardando'), eq(cheques.userId, ctx.user.id)));
    const compensados = await db.select({ total: sql<string>`COALESCE(SUM(valor_nominal), 0)`, qtd: sql<number>`COUNT(*)` }).from(cheques).where(and(eq(cheques.status, 'compensado'), eq(cheques.userId, ctx.user.id)));
    const devolvidos = await db.select({ total: sql<string>`COALESCE(SUM(valor_nominal), 0)`, qtd: sql<number>`COUNT(*)` }).from(cheques).where(and(eq(cheques.status, 'devolvido'), eq(cheques.userId, ctx.user.id)));
    return {
      totalAguardando: parseFloat(aguardando[0]?.total ?? '0'),
      qtdAguardando: aguardando[0]?.qtd ?? 0,
      totalCompensado: parseFloat(compensados[0]?.total ?? '0'),
      qtdCompensado: compensados[0]?.qtd ?? 0,
      totalDevolvido: parseFloat(devolvidos[0]?.total ?? '0'),
      qtdDevolvido: devolvidos[0]?.qtd ?? 0,
    };
  }),

  simular: publicProcedure
    .input(z.object({
      valorNominal: z.number().positive(),
      dataVencimento: z.string(),
      taxaDesconto: z.number().positive(),
      tipoTaxa: z.enum(['diaria', 'semanal', 'quinzenal', 'mensal', 'anual']).default('mensal'),
    }))
    .query(({ input }) => {
      const dataVenc = new Date(input.dataVencimento + 'T00:00:00');
      const hoje = new Date();
      const diasAteVencimento = Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      let taxaDiaria: number;
      if (input.tipoTaxa === 'diaria') {
        taxaDiaria = input.taxaDesconto / 100;
      } else if (input.tipoTaxa === 'mensal') {
        taxaDiaria = Math.pow(1 + input.taxaDesconto / 100, 1 / 30) - 1;
      } else {
        taxaDiaria = Math.pow(1 + input.taxaDesconto / 100, 1 / 365) - 1;
      }
      const fatorDesconto = Math.pow(1 + taxaDiaria, diasAteVencimento);
      const valorLiquido = input.valorNominal / fatorDesconto;
      const valorDesconto = input.valorNominal - valorLiquido;
      const taxaEfetivaTotal = (valorDesconto / valorLiquido) * 100;
      return {
        diasAteVencimento,
        valorLiquido,
        valorDesconto,
        taxaEfetivaTotal,
      };
    }),
});

// ─── VENDAS DE TELEFONE ─────────────────────────────────────────────────────
const vendasTelefoneRouter = router({
  listar: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('vendas_telefone')
        .select('*')
        .order('createdAt', { ascending: false })
        .eq('user_id', ctx.user.id);
      if (error) { console.error('[vendasTelefone.listar]', error); return []; }
      return data ?? [];
    } catch (e) { console.error('[vendasTelefone.listar]', e); return []; }
  }),

  buscarPorId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return null;
      try {
        const { data, error } = await supabase
          .from('vendas_telefone')
          .select('*')
          .eq('id', input.id)
          .eq('user_id', ctx.user.id)
          .maybeSingle();
        if (error) return null;
        return data ?? null;
      } catch (e) { return null; }
    }),

  parcelas: protectedProcedure
    .input(z.object({ vendaId: z.number() }))
    .query(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return [];
      try {
        const { data: venda } = await supabase.from('vendas_telefone').select('id')
          .eq('id', input.vendaId).eq('user_id', ctx.user.id).maybeSingle();
        if (!venda) return [];
        const { data, error } = await supabase
          .from('parcelas_venda_telefone')
          .select('*')
          .eq('venda_id', input.vendaId)
          .eq('user_id', ctx.user.id)
          .order('numero', { ascending: true });
        if (error) return [];
        return data ?? [];
      } catch (e) { return []; }
    }),

  criar: protectedProcedure
    .input(z.object({
      marca: z.string().min(1),
      modelo: z.string().min(1),
      imei: z.string().optional(),
      cor: z.string().optional(),
      armazenamento: z.string().optional(),
      custo: z.number().positive(),
      precoVenda: z.number().positive(),
      entradaPercentual: z.number().min(0).max(100),
      entradaValor: z.number().min(0),
      numParcelas: z.number().int().min(1).max(60),
      jurosMensal: z.number().min(0),
      valorParcela: z.number().min(0),
      totalJuros: z.number().min(0),
      totalAReceber: z.number().min(0),
      lucroBruto: z.number(),
      roi: z.number().optional(),
      paybackMeses: z.number().optional(),
      compradorNome: z.string().min(1),
      compradorCpf: z.string().optional(),
      compradorRg: z.string().optional(),
      compradorTelefone: z.string().optional(),
      compradorEmail: z.string().optional(),
      compradorEstadoCivil: z.string().optional(),
      compradorProfissao: z.string().optional(),
      compradorInstagram: z.string().optional(),
      compradorCep: z.string().optional(),
      compradorCidade: z.string().optional(),
      compradorEstado: z.string().optional(),
      compradorEndereco: z.string().optional(),
      compradorLocalTrabalho: z.string().optional(),
      dataPrimeiraParcela: z.string().optional(),
      contaCaixaId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      if (input.entradaValor > 0) {
        if (!input.contaCaixaId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Selecione a conta de Caixa que receberá a entrada da venda' });
        }
        await validarContaDoUsuario(ctx.user.id, input.contaCaixaId);
      }

      const { data: venda, error } = await supabase
        .from('vendas_telefone')
        .insert({
          marca: input.marca,
          modelo: input.modelo,
          imei: input.imei ?? null,
          cor: input.cor ?? null,
          armazenamento: input.armazenamento ?? null,
          custo: input.custo,
          preco_venda: input.precoVenda,
          entrada_percentual: input.entradaPercentual,
          entrada_valor: input.entradaValor,
          num_parcelas: input.numParcelas,
          juros_mensal: input.jurosMensal,
          valor_parcela: input.valorParcela,
          total_juros: input.totalJuros,
          total_a_receber: input.totalAReceber,
          lucro_bruto: input.lucroBruto,
          roi: input.roi ?? null,
          payback_meses: input.paybackMeses ?? null,
          comprador_nome: input.compradorNome,
          comprador_cpf: input.compradorCpf ?? null,
          comprador_rg: input.compradorRg ?? null,
          comprador_telefone: input.compradorTelefone ?? null,
          comprador_email: input.compradorEmail ?? null,
          comprador_estado_civil: input.compradorEstadoCivil ?? null,
          comprador_profissao: input.compradorProfissao ?? null,
          comprador_instagram: input.compradorInstagram ?? null,
          comprador_cep: input.compradorCep ?? null,
          comprador_cidade: input.compradorCidade ?? null,
          comprador_estado: input.compradorEstado ?? null,
          comprador_endereco: input.compradorEndereco ?? null,
          comprador_local_trabalho: input.compradorLocalTrabalho ?? null,
          status: 'ativo',
          user_id: ctx.user.id,
        })
        .select()
        .single();

      if (error || !venda) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error?.message ?? 'Erro ao criar venda' });

      // Gerar parcelas
      const primeiraParcela = input.dataPrimeiraParcela ? new Date(input.dataPrimeiraParcela + 'T00:00:00') : (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; })();
      const parcelasData = Array.from({ length: input.numParcelas }, (_, i) => {
        const venc = new Date(primeiraParcela);
        venc.setMonth(venc.getMonth() + i);
        return {
          venda_id: venda.id,
          numero: i + 1,
          valor: input.valorParcela,
          vencimento: venc.toISOString(),
          status: 'pendente',
          user_id: ctx.user.id,
        };
      });

      const { error: parcelasErro } = await supabase.from('parcelas_venda_telefone').insert(parcelasData);
      if (parcelasErro) {
        await supabase.from('vendas_telefone').delete().eq('id', venda.id).eq('user_id', ctx.user.id);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Não foi possível gerar as parcelas da venda' });
      }

      // ── Integração com Caixa: registrar entrada da entrada (valor inicial) ──
      if (input.entradaValor > 0) {
        const { error: caixaErro } = await supabase.from('transacoes_caixa').insert({
          conta_caixa_id: input.contaCaixaId,
          tipo: 'entrada',
          categoria: 'outros',
          valor: input.entradaValor,
          descricao: `Entrada venda #${venda.id} - ${input.marca} ${input.modelo}`,
          data_transacao: new Date().toISOString(),
          user_id: ctx.user.id,
        });
        if (caixaErro) {
          // Não permitir contrato ativo sem a entrada que o operador informou.
          await supabase.from('parcelas_venda_telefone').delete().eq('venda_id', venda.id).eq('user_id', ctx.user.id);
          await supabase.from('vendas_telefone').delete().eq('id', venda.id).eq('user_id', ctx.user.id);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Não foi possível registrar a entrada no Caixa; a venda foi desfeita' });
        }
      }

      return venda;
    }),
   pagarParcela: protectedProcedure
   .input(z.object({
      parcelaId: z.number(),
      valorPago: z.number().positive(),
      contaCaixaId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await validarContaDoUsuario(ctx.user.id, input.contaCaixaId);
      // Buscar dados da parcela para obter informações da venda
      const { data: parcela } = await supabase
        .from('parcelas_venda_telefone')
        .select('*, vendas_telefone(marca, modelo, comprador_nome)')
        .eq('id', input.parcelaId)
        .eq('user_id', ctx.user.id)
        .maybeSingle();
      if (!parcela) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });
      if (!podeRegistrarMovimento((parcela as any).status, ['pendente', 'atrasada'])) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Esta parcela já foi processada' });
      }
      const valorEsperado = Number((parcela as any).valor);
      if (!Number.isFinite(valorEsperado) || Math.abs(input.valorPago - valorEsperado) > 0.000001) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'O pagamento deve corresponder ao valor integral da parcela de venda' });
      }
      const { data: parcelaAtualizada, error } = await supabase
        .from('parcelas_venda_telefone')
        .update({ status: 'paga', pago_em: new Date().toISOString(), valor_pago: input.valorPago })
        .eq('id', input.parcelaId).eq('user_id', ctx.user.id).in('status', ['pendente', 'atrasada']).select('id').maybeSingle();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      if (!parcelaAtualizada) throw new TRPCError({ code: 'CONFLICT', message: 'Esta parcela já foi processada' });
      // ── Integração com Caixa: uma baixa só é confirmada com sua entrada. ──
      const venda = (parcela as any)?.vendas_telefone;
      const descricao = venda
        ? `Parcela venda #${input.parcelaId} (${(parcela as any)?.numero}) - ${venda.marca} ${venda.modelo}`
        : `Parcela venda telefone #${input.parcelaId}`;
      const { error: entradaVendaErro } = await supabase.from('transacoes_caixa').insert({
        conta_caixa_id: input.contaCaixaId, tipo: 'entrada', categoria: 'pagamento_parcela', valor: input.valorPago,
        descricao, data_transacao: new Date().toISOString(), user_id: ctx.user.id,
      });
      if (entradaVendaErro) {
        const { error: rollbackErro } = await supabase.from('parcelas_venda_telefone')
          .update({ status: (parcela as any).status, pago_em: null, valor_pago: null })
          .eq('id', input.parcelaId).eq('user_id', ctx.user.id).eq('status', 'paga');
        if (rollbackErro) console.error('[vendasTelefone.pagarParcela] falha ao reverter baixa sem Caixa:', rollbackErro.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Não foi possível registrar o recebimento no Caixa; a baixa foi desfeita' });
      }
      // ── Verificar se todas as parcelas foram pagas → marcar venda como quitada ──
      try {
        if (parcela) {
          const vendaId = (parcela as any).venda_id;
          const { data: todasParcelas } = await supabase
            .from('parcelas_venda_telefone')
            .select('id, status')
            .eq('venda_id', vendaId)
            .eq('user_id', ctx.user.id);
          if (todasParcelas && todasParcelas.length > 0) {
            const todasPagas = todasParcelas.every((p: any) =>
              p.id === input.parcelaId ? true : p.status === 'paga'
            );
            if (todasPagas) {
              await supabase
                .from('vendas_telefone')
                .update({ status: 'quitado' })
                .eq('id', vendaId)
                .eq('user_id', ctx.user.id);
              console.log(`[vendasTelefone] Venda #${vendaId} marcada como QUITADA automaticamente`);
            }
          }
        }
      } catch (quitadoErr) {
        console.warn('[vendasTelefone.pagarParcela] Erro ao verificar quitado:', quitadoErr);
      }
      return { success: true };
    }),

  deletar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

      const { error } = await supabase
        .from('vendas_telefone')
        .delete()
        .eq('id', input.id)
        .eq('user_id', ctx.user.id);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  kpis: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return { totalVendas: 0, capitalInvestido: 0, totalAReceber: 0, lucroBruto: 0, vendasAtivas: 0, vendasQuitadas: 0 };
    const { data } = await supabase.from('vendas_telefone').select('status, custo, total_a_receber, lucro_bruto, entrada_valor').eq('user_id', ctx.user.id);
    const all = data ?? [];
    return {
      totalVendas: all.length,
      capitalInvestido: all.reduce((s: number, v: any) => s + parseFloat(v.custo ?? 0), 0),
      totalAReceber: all.filter((v: any) => v.status === 'ativo').reduce((s: number, v: any) => s + parseFloat(v.total_a_receber ?? 0), 0),
      lucroBruto: all.reduce((s: number, v: any) => s + parseFloat(v.lucro_bruto ?? 0), 0),
      vendasAtivas: all.filter((v: any) => v.status === 'ativo').length,
      vendasQuitadas: all.filter((v: any) => v.status === 'quitado').length,
    };
  }),
});

// ─── ETIQUETAS ROUTER ───────────────────────────────────────────────────────
const etiquetasRouter = router({
  listar: protectedProcedure.query(async ({ ctx }) => {
    const sb = await getSupabaseClientAsync();
    if (!sb) return [];
    const { data } = await sb.from('etiquetas_contratos').select('*').order('nome').eq('user_id', ctx.user.id);
    return (data ?? []) as { id: number; nome: string; cor: string }[];
  }),
  criar: protectedProcedure
    .input(z.object({ nome: z.string().min(1), cor: z.string().default('#6366f1') }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data, error } = await sb.from('etiquetas_contratos').insert({ nome: input.nome, cor: input.cor, user_id: ctx.user.id }).select().single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),
  remover: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await sb.from('etiquetas_contratos').delete().eq('id', input.id).eq('user_id', ctx.user.id);
      return { success: true };
    }),
  aplicarContrato: protectedProcedure
    .input(z.object({ contratoId: z.number(), etiquetas: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data, error } = await sb.from('contratos').update({ etiquetas: JSON.stringify(input.etiquetas) })
        .eq('id', input.contratoId).eq('user_id', ctx.user.id).select('id').maybeSingle();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado' });
      return { success: true };
    }),
});

// ─── ONBOARDING ROUTER ─────────────────────────────────────────────────────
const onboardingRouter = router({
  check: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return { completo: false, nomeEmpresa: null as string | null };
    const { data: row, error } = await supabase
      .from('users')
      .select('onboarding_completo, nome_empresa')
      .eq('id', ctx.user.id)
      .single();
    if (error || !row) return { completo: false, nomeEmpresa: null as string | null };
    return { completo: !!row.onboarding_completo, nomeEmpresa: row.nome_empresa as string | null };
  }),
  complete: protectedProcedure
    .input(z.object({
      nomeEmpresa: z.string().min(1),
      nomeConta: z.string().min(1).optional().default('Caixa Principal'),
      tipoConta: z.enum(['caixa', 'banco', 'digital']).optional().default('caixa'),
    }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });
      // Atualizar onboarding do usuário
      await supabase
        .from('users')
        .update({ onboarding_completo: true, nome_empresa: input.nomeEmpresa })
        .eq('id', ctx.user.id);
      // Criar conta de caixa inicial se não existir
      const { data: contas } = await supabase
        .from('contas_caixa')
        .select('id')
        .eq('user_id', ctx.user.id)
        .limit(1);
      if (!contas || contas.length === 0) {
        await supabase.from('contas_caixa').insert({
          user_id: ctx.user.id,
          nome: input.nomeConta,
          tipo: input.tipoConta,
          saldo_inicial: 0,
          ativa: true,
        });
      }
      return { success: true };
    }),
});

// ─── ADMIN ROUTER ──────────────────────────────────────────────────────────────────────────────
const adminRouter = router({
  getLoginLogs: adminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(50),
      userId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });

      const offset = (input.page - 1) * input.pageSize;

      let query = supabase
        .from('login_logs')
        .select('*, users!login_logs_user_id_fkey(id, name, email, role)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + input.pageSize - 1);

      if (input.userId) {
        query = query.eq('user_id', input.userId);
      }

      const { data, error, count } = await query;
      if (error) {
        // Fallback: buscar sem join se FK não existir
        const { data: data2, error: err2, count: count2 } = await supabase
          .from('login_logs')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + input.pageSize - 1);
        if (err2) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err2.message });

        // Buscar nomes dos usuários separadamente
        const userIds = Array.from(new Set((data2 ?? []).map((l: Record<string, unknown>) => l.user_id as number)));
        const { data: usersData } = await supabase.from('users').select('id, name, email, role').in('id', userIds);
        const usersMap = Object.fromEntries((usersData ?? []).map((u: Record<string, unknown>) => [u.id, u]));

        return {
          logs: (data2 ?? []).map((l: Record<string, unknown>) => ({ ...l, user: usersMap[l.user_id as number] ?? null })),
          total: count2 ?? 0,
          page: input.page,
          pageSize: input.pageSize,
        };
      }

      return {
        logs: (data ?? []).map((l: Record<string, unknown>) => ({ ...l, user: (l as Record<string, unknown>).users ?? null })),
        total: count ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  deleteLoginLog: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });
      const { error } = await supabase.from('login_logs').delete().eq('id', input.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  clearLoginLogs: adminProcedure
    .input(z.object({ userId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });
      let query = supabase.from('login_logs').delete();
      if (input.userId) {
        query = query.eq('user_id', input.userId);
      } else {
        query = query.neq('id', 0); // delete all
      }
      const { error } = await query;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),
});

// ─── APP ROUTER ──────────────────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    salvarIdioma: protectedProcedure
      .input(z.object({ idioma: z.enum(['pt-BR', 'es']) }))
      .mutation(async ({ ctx, input }) => {
        const { getSupabaseClient } = await import('./db.js');
        const sb = getSupabaseClient();
        if (!sb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB indisponível' });
        const { error } = await sb.from('users').update({ idioma: input.idioma }).eq('id', ctx.user.id);
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        return { success: true };
      }),
    getIdioma: protectedProcedure.query(async ({ ctx }) => {
      const { getSupabaseClient } = await import('./db.js');
      const sb = getSupabaseClient();
      if (!sb) return { idioma: 'pt-BR' };
      const { data } = await sb.from('users').select('idioma').eq('id', ctx.user.id).single();
      return { idioma: (data?.idioma as string) || 'pt-BR' };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: dashboardRouter,
  clientes: clientesRouter,
  contratos: contratosRouter,
  parcelas: parcelasRouter,
  caixa: caixaRouter,
  portal: portalRouter,
  whatsapp: whatsappRouter,
  relatorios: relatoriosRouter,
  configuracoes: configuracoesRouter,
  cobradores: cobradoresRouter,
  reparcelamento: reparcelamentoRouter,
  contasPagar: contasPagarRouter,
  vendas: vendasRouter,
  cheques: chequesRouter,
  veiculos: veiculosRouter,
  vendasTelefone: vendasTelefoneRouter,
  etiquetas: etiquetasRouter,
  assinaturas: assinaturasRouter,
  backup: backupRouter,
  whatsappEvolution: whatsappEvolutionRouter,
  perfil: perfilRouter,
  relatorioDiario: relatorioDiarioRouter,
  notificacoes: notificacoesRouter,
    onboarding: onboardingRouter,
  admin: adminRouter,
  blacklist: blacklistRouter,
});
export type AppRouter = typeof appRouter;
