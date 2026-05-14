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
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb, getSupabaseClientAsync, resetDb } from "./db";
import { TRPCError } from "@trpc/server";
import {
  clientes, contratos, parcelas, contasCaixa, transacoesCaixa, magicLinks, templatesWhatsapp,
  koletores, configuracoes, contasPagar, produtos, cheques, contratoHistorico
} from "../drizzle/schema";
import { eq, and, sql, desc, gte, lte, lt, isNull, or, inArray, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { calcularJurosMora, calcularParcelaPadrao, calcularParcelasPrice, calcularParcelaBullet, getDiasModalidade, calcularSaldoResidual } from "../shared/finance";

// ─── HELPER: REGISTRAR HISTÓRICO ───────────────────────────────────────────
async function registrarHistorico(params: {
  contratoId: number;
  userId: string;
  tipo: 'edicao_juros' | 'aplicacao_multa' | 'edicao_parcela' | 'edicao_contrato' | 'pagamento' | 'pagamento_juros' | 'reparcelamento' | 'criacao';
  descricao: string;
  valorAnterior?: string;
  valorNovo?: string;
}) {
  try {
    const sb = await getSupabaseClientAsync();
    if (!sb) return;
    await sb.from('contrato_historico').insert({
      contrato_id: params.contratoId,
      user_id: params.userId,
      tipo: params.tipo,
      descricao: params.descricao,
      valor_anterior: params.valorAnterior ?? null,
      valor_novo: params.valorNovo ?? null,
    });
  } catch (e) {
    console.warn('[registrarHistorico] Falha ao registrar histórico:', e);
  }
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
const dashboardRouter = router({
  kpis: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const supabase = await getSupabaseClientAsync();
    
    if (db) {
      // Use Drizzle ORM if available
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeStr = hoje.toISOString().split('T')[0];

      const contas = await db.select().from(contasCaixa).where(and(eq(contasCaixa.ativo, true), eq(contasCaixa.userId, ctx.user.id)));
      let saldoTotal = 0;
      for (const conta of contas) {
        const entradas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
          .from(transacoesCaixa)
          .where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, 'entrada')));
        const saidas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
          .from(transacoesCaixa)
          .where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, 'saida')));
        saldoTotal += parseFloat(conta.saldo) + parseFloat(entradas[0]?.total ?? '0') - parseFloat(saidas[0]?.total ?? '0');
      }

      const capitalResult = await db.select({ total: sql<string>`COALESCE(SUM(valor_principal), 0)` })
        .from(contratos).where(and(eq(contratos.status, 'ativo'), eq(contratos.userId, ctx.user.id)));
      const capitalCirculacao = parseFloat(capitalResult[0]?.total ?? '0');

      const receberResult = await db.select({ total: sql<string>`COALESCE(SUM(valor_original + COALESCE(saldo_residual, 0) + COALESCE(valor_multa, 0)), 0)` })
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
          gte(transacoesCaixa.dataTransacao, hoje),
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
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().split('T')[0];

    // Fetch data via Supabase REST (filtrado por user_id para isolamento entre contas)
    const userId = ctx.user.id;
    const [contasRes, contratosRes, parcelasRes, transRes] = await Promise.all([
      supabase.from('contas_caixa').select('id, saldo, ativo').eq('ativo', true).eq('user_id', userId),
      supabase.from('contratos').select('valor_principal').eq('status', 'ativo').eq('user_id', userId),
      supabase.from('parcelas').select('valor_original, valor_juros, valor_multa, status, data_vencimento, numero_parcela, cliente_id').eq('user_id', userId),
      supabase.from('transacoes_caixa').select('conta_caixa_id, valor, tipo, categoria, data_transacao').eq('user_id', userId)
    ]);

    let saldoTotal = 0;
    if (contasRes.data) {
      for (const conta of contasRes.data) {
        const transacoesConta = (transRes.data ?? []).filter((t: any) => t.conta_caixa_id === conta.id);
        const totalEntradas = transacoesConta.filter((t: any) => t.tipo === 'entrada').reduce((s: number, t: any) => s + parseFloat(t.valor ?? '0'), 0);
        const totalSaidas = transacoesConta.filter((t: any) => t.tipo === 'saida').reduce((s: number, t: any) => s + parseFloat(t.valor ?? '0'), 0);
        saldoTotal += parseFloat(conta.saldo ?? '0') + totalEntradas - totalSaidas;
      }
    }

    const capitalCirculacao = (contratosRes.data ?? []).reduce((s: number, c: any) => s + parseFloat(c.valor_principal ?? '0'), 0);
    
    const parcelasData = parcelasRes.data ?? [];
    const totalReceber = parcelasData.filter((p: any) => ['pendente', 'atrasada', 'vencendo_hoje', 'parcial'].includes(p.status)).reduce((s: number, p: any) => s + parseFloat(p.valor_original ?? '0') + parseFloat(p.valor_multa ?? '0') + parseFloat(p.saldo_residual ?? '0'), 0);
    
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
        const hoje = new Date().toISOString().split('T')[0];
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
    const hoje = new Date().toISOString().split('T')[0];
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
      if (input?.busca) {
        const b = input.busca.toLowerCase();
        rows = rows.filter((c: any) =>
          (c.nome ?? '').toLowerCase().includes(b) ||
          (c.cpfCnpj ?? c.cpf_cnpj ?? '').includes(b) ||
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
    return data;
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
          await db.update(clientes).set(data).where(eq(clientes.id, id));
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
    return data ?? [];
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
            const { data } = await supabase.from('parcelas').select('*').eq('cliente_id', cliente.id);
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
          if (parcela.status !== 'paga') totalReceber += valorOriginalParcela + saldoResidualParcela + valorMultaParcela;
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
          ...cliente,
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
            and(eq(contratos.clienteId, input.id), eq(contratos.status, 'ativo'))
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
        .select('id, contrato_id, numero_parcela, valor_original, valor_pago, valor_multa, data_vencimento, data_pagamento, status')
        .in('contrato_id', contratoIds)
        .order('data_vencimento');

      const hoje = new Date().toISOString().split('T')[0];

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

      // Buscar configuração de multa por dia de atraso
      let multaDiaria = 100; // padrão R$100/dia
      try {
        const { data: configRows } = await supabase.from('configuracoes').select('chave, valor').eq('user_id', ctx.user.id);
        if (configRows) {
          const configMap: Record<string, string> = {};
          for (const r of configRows) configMap[r.chave] = r.valor ?? '';
          if (configMap['multaDiaria']) multaDiaria = parseFloat(configMap['multaDiaria']) || 100;
          else if (configMap['jurosMoraDiario']) {
            // jurosMoraDiario é % ao dia, converter para R$/dia baseado no valor médio
            // mas mantemos multaDiaria como R$/dia absoluto
          }
        }
      } catch (_) { /* usa padrão */ }

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

        // Total a receber = soma das parcelas abertas (incluindo multas e saldo residual)
        const totalReceber = parcelasAbertas.reduce((s: number, p: any) => s + parseFloat(p.valor_original ?? '0') + parseFloat(p.valor_multa ?? '0') + parseFloat(p.saldo_residual ?? '0'), 0);
        // Total pago = soma das parcelas pagas
        const totalPago = parcelasPagas.reduce((s: number, p: any) => s + parseFloat(p.valor_pago ?? p.valor_original ?? '0'), 0);
        // Lucro previsto = juros × número de parcelas abertas
        const lucroPrevisto = valorJurosParcela * parcelasAbertas.length;
        // Lucro realizado = total pago - capital proporcional às parcelas pagas
        // Fórmula: totalPago - (valorPrincipal × parcelasPagas / numeroParcelas)
        // Isso captura tanto os juros do contrato quanto os juros de mora pagos
        const capitalProporcional = numeroParcelas > 0 ? valorPrincipal * (parcelasPagas.length / numeroParcelas) : 0;
        const lucroRealizado = Math.max(0, totalPago - capitalProporcional);

        // Próxima parcela em aberto
        const proximaParcela = parcelasAbertas.length > 0 ? parcelasAbertas[0] : null;

        // Calcular juros por atraso para parcelas atrasadas
        const parcelasComAtraso = parcelasAtrasadas.map((p: any) => {
          const venc = new Date(p.data_vencimento + 'T00:00:00');
          const diasAtraso = Math.max(0, Math.floor((new Date().getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));
          const jurosDiarios = multaDiaria; // R$/dia configurável em Configurações
          const jurosAtraso = diasAtraso * jurosDiarios;
          const multaAplicada = parseFloat(p.valor_multa ?? '0');
          return {
            ...p,
            diasAtraso,
            jurosAtraso,
            multaAplicada,
            totalComAtraso: parseFloat(p.valor_original ?? '0') + jurosAtraso + multaAplicada,
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
        .select('id, contrato_id, numero_parcela, valor_original, valor_pago, valor_multa, data_vencimento, data_pagamento, status')
        .eq('contrato_id', input.id)
        .order('data_vencimento');

      const hoje = new Date().toISOString().split('T')[0];
      const cliente = contratoData.clientes as any;
      const parcelas = (parcelasData ?? []).map((p: any) => {
        let statusAtual = p.status;
        if (statusAtual !== 'paga' && statusAtual !== 'parcial') {
          if (p.data_vencimento < hoje) statusAtual = 'atrasada';
          else if (p.data_vencimento === hoje) statusAtual = 'vencendo_hoje';
        }
        return { ...p, status: statusAtual };
      });

      // Buscar configuração de multa
      let multaDiaria = 100;
      try {
        const { data: configRows } = await supabase.from('configuracoes').select('chave, valor').eq('user_id', ctx.user.id);
        if (configRows) {
          const configMap: Record<string, string> = {};
          for (const r of configRows) configMap[r.chave] = r.valor ?? '';
          if (configMap['multaDiaria']) multaDiaria = parseFloat(configMap['multaDiaria']) || 100;
        }
      } catch (_) { /* usa padrão */ }

      // Calcular KPIs
      const parcelasAbertas = parcelas.filter((p: any) => !['paga'].includes(p.status));
      const parcelasPagas = parcelas.filter((p: any) => p.status === 'paga');
      const parcelasAtrasadas = parcelas.filter((p: any) => p.status === 'atrasada');

      const valorPrincipal = parseFloat(contratoData.valor_principal ?? '0');
      const valorParcela = parseFloat(contratoData.valor_parcela ?? '0');
      const taxaJuros = parseFloat(contratoData.taxa_juros ?? '0');
      const valorJurosParcela = Math.round(valorPrincipal * (taxaJuros / 100) * 100) / 100;

      const totalReceber = parcelasAbertas.reduce((s: number, p: any) => s + parseFloat(p.valor_original ?? '0') + parseFloat(p.valor_multa ?? '0') + parseFloat(p.saldo_residual ?? '0'), 0);
      const totalPago = parcelasPagas.reduce((s: number, p: any) => s + parseFloat(p.valor_pago ?? p.valor_original ?? '0'), 0);
      const lucroPrevisto = valorJurosParcela * parcelasAbertas.length;
      const lucroRealizado = parcelasPagas.reduce((s: number, p: any) => s + parseFloat(p.valor_juros ?? p.juros ?? '0'), 0);

      const parcelasComAtraso = parcelasAtrasadas.map((p: any) => {
        const venc = new Date(p.data_vencimento + 'T00:00:00');
        const diasAtraso = Math.max(0, Math.floor((new Date().getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));
        const jurosDiarios = multaDiaria;
        const jurosAtraso = diasAtraso * jurosDiarios;
        const multaAplicada = parseFloat(p.valor_multa ?? '0');
        return {
          ...p,
          diasAtraso,
          jurosAtraso,
          multaAplicada,
          totalComAtraso: parseFloat(p.valor_original ?? '0') + jurosAtraso + multaAplicada,
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
          .where(eq(contratos.id, input.id)).limit(1);
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
      contaCaixaId: z.number().optional(),
      multaAtraso: z.number().optional(),
      jurosMoraDiario: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Calcular valor da parcela
      let valorParcela: number;
      if (input.modalidade === 'tabela_price') {
        valorParcela = calcularParcelasPrice(input.valorPrincipal, input.taxaJuros, input.numeroParcelas);
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
      if (parcelasErr) console.error('[contratos.create] Erro ao criar parcelas via REST:', parcelasErr.message);

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
      const { error } = await supabase.from('contratos').update({ status: input.status }).eq('id', input.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
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
          .single();
        if (ctErr || !ctData) throw new TRPCError({ code: 'NOT_FOUND', message: 'Contrato não encontrado' });
        const { data: parcelasData2 } = await supabase.from('parcelas').select('*').eq('contrato_id', input.id).order('numero_parcela');
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
        const parcelasHTML2 = (parcelasData2 ?? []).slice(0, 24).map((p: any) => {
          const venc = p.data_vencimento ? new Date(p.data_vencimento).toLocaleDateString('pt-BR') : '-';
          const val = Number(p.valor_original).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          return `<tr><td>${p.numero_parcela}</td><td>${venc}</td><td>${val}</td><td>${p.status === 'paga' ? 'PAGA' : p.status === 'atrasada' ? 'ATRASADA' : 'PENDENTE'}</td></tr>`;
        }).join('');
        const html2 = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:0;padding:20px}h1{font-size:18px;text-align:center}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px}.header{text-align:center;margin-bottom:20px}.empresa{font-size:14px;font-weight:bold}.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px}.field{margin-bottom:4px}.label{font-weight:bold;color:#555}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#1a1a1a;color:white;padding:6px;text-align:left;font-size:10px}td{padding:5px 6px;border-bottom:1px solid #eee;font-size:10px}.assinatura{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.ass-box{border-top:1px solid #333;padding-top:6px;text-align:center}.rodape{margin-top:20px;font-size:9px;color:#888;text-align:center}</style></head><body><div class="header"><div class="empresa">${nomeEmpresa2}</div><h1>CONTRATO DE CRÉDITO</h1><div>Nº ${String(c2.id).padStart(6,'0')} &bull; ${dataInicio2}</div></div><h2>DADOS DO CONTRATANTE</h2><div class="grid"><div class="field"><span class="label">Nome:</span> ${cli2?.nome ?? ''}</div><div class="field"><span class="label">CPF/CNPJ:</span> ${cli2?.cpf_cnpj ?? '-'}</div><div class="field"><span class="label">Telefone:</span> ${cli2?.telefone ?? '-'}</div><div class="field"><span class="label">Chave PIX:</span> ${cli2?.chave_pix ?? '-'}</div></div><h2>CONDIÇÕES DO CONTRATO</h2><div class="grid"><div class="field"><span class="label">Modalidade:</span> ${c2.modalidade}</div><div class="field"><span class="label">Capital:</span> ${valorPrincipal2}</div><div class="field"><span class="label">Valor Total:</span> ${valorTotal2}</div><div class="field"><span class="label">Taxa:</span> ${taxaJuros2}</div><div class="field"><span class="label">Parcelas:</span> ${c2.numero_parcelas}x de ${valorParcela2}</div></div><h2>PLANO DE PAGAMENTO</h2><table><thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead><tbody>${parcelasHTML2}</tbody></table><div class="assinatura"><div class="ass-box"><div>${nomeEmpresa2}</div><div style="font-size:9px;color:#888">Credor</div></div><div class="ass-box"><div>${cli2?.nome ?? ''}</div><div style="font-size:9px;color:#888">Devedor</div></div></div><div class="rodape">Documento gerado em ${new Date().toLocaleString('pt-BR')} — CobraPro</div></body></html>`;
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
        .where(eq(contratos.id, input.id)).limit(1);
      const row = rows[0];
      if (!row) throw new Error("Contrato não encontrado");
      // Buscar parcelas
      const parcelasData = await db.select().from(parcelas)
        .where(eq(parcelas.contratoId, input.id))
        .orderBy(parcelas.numeroParcela);
      // Buscar configurações da empresa
      // Buscar configurações como mapa chave->valor
      const configRows = await db.select().from(configuracoes);
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
      const modalidadeLabel: Record<string, string> = {
        emprestimo_padrao: 'Empréstimo Padrão',
        emprestimo_diario: 'Empréstimo Diário',
        tabela_price: 'Parcela Fixa',
        venda_produto: 'Venda de Produto',
        desconto_cheque: 'Desconto de Cheque',
        reparcelamento: 'Reparcelamento',
      };
      // Gerar HTML do contrato
      const parcelasHTML = parcelasData.slice(0, 24).map(p => {
        const venc = p.dataVencimento ? new Date(p.dataVencimento).toLocaleDateString('pt-BR') : '-';
        const val = Number(p.valorOriginal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return `<tr><td>${p.numeroParcela}</td><td>${venc}</td><td>${val}</td><td>${p.status === 'paga' ? 'PAGA' : p.status === 'atrasada' ? 'ATRASADA' : 'PENDENTE'}</td></tr>`;
      }).join('');
      const html = `
        <!DOCTYPE html><html lang="pt-BR"><head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 20px; }
          h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
          h2 { font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
          .header { text-align: center; margin-bottom: 20px; }
          .empresa { font-size: 14px; font-weight: bold; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
          .field { margin-bottom: 4px; }
          .label { font-weight: bold; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #1a1a1a; color: white; padding: 6px; text-align: left; font-size: 10px; }
          td { padding: 5px 6px; border-bottom: 1px solid #eee; font-size: 10px; }
          tr:nth-child(even) td { background: #f9f9f9; }
          .assinatura { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
          .ass-box { border-top: 1px solid #333; padding-top: 6px; text-align: center; }
          .rodape { margin-top: 20px; font-size: 9px; color: #888; text-align: center; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; }
          .badge-ativo { background: #dcfce7; color: #166534; }
          .badge-quitado { background: #dbeafe; color: #1e40af; }
        </style></head><body>
        <div class="header">
          <div class="empresa">${nomeEmpresa}</div>
          ${cnpjEmpresa ? `<div>CNPJ: ${cnpjEmpresa}</div>` : ''}
          ${enderecoEmpresa ? `<div>${enderecoEmpresa}</div>` : ''}
          <h1>CONTRATO DE ${(modalidadeLabel[c.modalidade ?? ''] ?? 'CRÉDITO').toUpperCase()}</h1>
          <div>Nº ${String(c.id).padStart(6, '0')} &nbsp;&bull;&nbsp; ${dataInicio}</div>
        </div>
        <h2>DADOS DO CONTRATANTE</h2>
        <div class="grid">
          <div class="field"><span class="label">Nome:</span> ${row.clienteNome}</div>
          <div class="field"><span class="label">CPF/CNPJ:</span> ${row.clienteCpfCnpj ?? '-'}</div>
          <div class="field"><span class="label">Telefone:</span> ${row.clienteTelefone ?? '-'}</div>
          <div class="field"><span class="label">Chave PIX:</span> ${row.clienteChavePix ?? '-'}</div>
          ${row.clienteEndereco ? `<div class="field col-span-2"><span class="label">Endereço:</span> ${row.clienteEndereco}${row.clienteCidade ? ', ' + row.clienteCidade : ''}${row.clienteEstado ? '/' + row.clienteEstado : ''}</div>` : ''}
        </div>
        <h2>CONDIÇÕES DO CONTRATO</h2>
        <div class="grid">
          <div class="field"><span class="label">Modalidade:</span> ${modalidadeLabel[c.modalidade ?? ''] ?? c.modalidade}</div>
          <div class="field"><span class="label">Status:</span> <span class="badge badge-${c.status}">${c.status?.toUpperCase()}</span></div>
          <div class="field"><span class="label">Capital:</span> ${valorPrincipal}</div>
          <div class="field"><span class="label">Valor Total:</span> ${valorTotal}</div>
          <div class="field"><span class="label">Taxa de Juros:</span> ${taxaJuros}</div>
          <div class="field"><span class="label">Nº Parcelas:</span> ${c.numeroParcelas}x de ${valorParcela}</div>
          ${c.descricao ? `<div class="field" style="grid-column:span 2"><span class="label">Descrição:</span> ${c.descricao}</div>` : ''}
        </div>
        <h2>PLANO DE PAGAMENTO</h2>
        <table>
          <thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>${parcelasHTML}</tbody>
        </table>
        ${parcelasData.length > 24 ? `<p style="font-size:9px;color:#888">... e mais ${parcelasData.length - 24} parcelas</p>` : ''}
        <div class="assinatura">
          <div class="ass-box">
            <div>${nomeEmpresa}</div>
            <div style="font-size:9px;color:#888">Credor / Contratado</div>
          </div>
          <div class="ass-box">
            <div>${row.clienteNome}</div>
            <div style="font-size:9px;color:#888">Devedor / Contratante</div>
          </div>
        </div>
        <div class="rodape">
          Documento gerado em ${new Date().toLocaleString('pt-BR')} — CobraPro Sistema de Gestão Financeira
        </div>
        </body></html>`;
      return { html, contratoId: c.id, clienteNome: row.clienteNome };
    }),

  deletar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          // IMPORTANTE: deletar parcelas ANTES do contrato (foreign key constraint)
          // Verificar user_id para garantir isolamento entre usuários (segurança)
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
      // IMPORTANTE: deletar parcelas ANTES do contrato (foreign key constraint)
      await supabase.from('parcelas').delete().eq('contrato_id', input.id);
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
          await db.update(contratos).set({
            valorPrincipal: input.valorPrincipal.toString(),
            taxaJuros: input.taxaJuros,
            tipoTaxa: input.tipoTaxa as 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'anual',
            numeroParcelas: input.numeroParcelas,
          }).where(and(eq(contratos.id, input.id), eq(contratos.userId, ctx.user.id)));

          // Atualizar parcelas pendentes com nova data se fornecida
          if (input.datasParcelasCustom && input.datasParcelasCustom.length > 0) {
            const parcelasPendentes = await db.select().from(parcelas)
              .where(and(eq(parcelas.contratoId, input.id), inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje'])))
              .orderBy(parcelas.numeroParcela);
            for (let i = 0; i < parcelasPendentes.length; i++) {
              if (input.datasParcelasCustom[i]) {
                await db.update(parcelas).set({ dataVencimento: input.datasParcelasCustom[i] }).where(eq(parcelas.id, parcelasPendentes[i].id));
              }
            }
          }
          return { success: true };
        } catch (err) {
          console.warn('[contratos.editar] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { error } = await supabase.from('contratos').update({
        valor_principal: input.valorPrincipal,
        taxa_juros: input.taxaJuros,
        tipo_taxa: input.tipoTaxa,
        numero_parcelas: input.numeroParcelas,
      }).eq('id', input.id).eq('user_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      // Atualizar datas das parcelas pendentes via Supabase
      if (input.datasParcelasCustom && input.datasParcelasCustom.length > 0) {
        const { data: parcelasPendentes } = await supabase.from('parcelas')
          .select('id, numero_parcela')
          .eq('contrato_id', input.id)
          .in('status', ['pendente', 'atrasada', 'vencendo_hoje'])
          .order('numero_parcela', { ascending: true });
        for (let i = 0; i < (parcelasPendentes ?? []).length; i++) {
          if (input.datasParcelasCustom[i]) {
            await supabase.from('parcelas').update({ data_vencimento: input.datasParcelasCustom[i] }).eq('id', parcelasPendentes![i].id);
          }
        }
      }
      return { success: true };
    }),

  pagarTotal: protectedProcedure
    .input(z.object({ id: z.number(), valor: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          await db.update(contratos).set({ status: 'quitado' }).where(and(eq(contratos.id, input.id), eq(contratos.userId, ctx.user.id)));
          await db.update(parcelas).set({ status: 'paga', dataPagamento: new Date() }).where(eq(parcelas.contratoId, input.id));
          return { success: true };
        } catch (err) {
          console.warn('[contratos.pagarTotal] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('contratos').update({ status: 'quitado' }).eq('id', input.id).eq('user_id', ctx.user.id);
      await supabase.from('parcelas').update({ status: 'paga', data_pagamento: new Date().toISOString() }).eq('contrato_id', input.id);
      return { success: true };
    }),

  editarJuros: protectedProcedure
    .input(z.object({ id: z.number(), novaTaxa: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          await db.update(contratos).set({ taxaJuros: input.novaTaxa }).where(and(eq(contratos.id, input.id), eq(contratos.userId, ctx.user.id)));
          return { success: true };
        } catch (err) {
          console.warn('[contratos.editarJuros] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
       const { error } = await supabase.from('contratos').update({ taxa_juros: input.novaTaxa }).eq('id', input.id).eq('user_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
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
      const hoje = new Date().toISOString().split('T')[0];
      if (db) {
        try {
          const parcelasAtraso = await db.select().from(parcelas).where(and(
            eq(parcelas.contratoId, input.id),
            inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje']),
            lt(sql`DATE(${parcelas.dataVencimento})`, hoje)
          ));
          for (const parcela of parcelasAtraso) {
            const multaAtual = parcela.valorMulta ? parseFloat(parcela.valorMulta) : 0;
            await db.update(parcelas).set({ valorMulta: (multaAtual + parseFloat(input.multa)).toString() }).where(eq(parcelas.id, parcela.id));
          }
          return { success: true };
        } catch (err) {
          console.warn('[contratos.aplicarMulta] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      // Verificar que o contrato pertence ao usuário antes de aplicar multa
      const { data: pAtraso } = await supabase.from('parcelas').select('id, valor_multa').eq('contrato_id', input.id).in('status', ['pendente', 'atrasada', 'vencendo_hoje']).lt('data_vencimento', hoje);
      for (const parcela of (pAtraso ?? [])) {
        const multaAtual = parcela.valor_multa ? parseFloat(parcela.valor_multa) : 0;
        await supabase.from('parcelas').update({ valor_multa: (multaAtual + parseFloat(input.multa)).toString() }).eq('id', parcela.id);
      }
      await registrarHistorico({ contratoId: input.id, userId: String(ctx.user.id), tipo: 'aplicacao_multa', descricao: `Multa de R$ ${input.multa} aplicada nas parcelas em atraso`, valorNovo: input.multa });
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
      const hoje = new Date().toISOString().split('T')[0];

      if (db) {
        try {
          // Atualizar status das parcelas atrasadas
          await db.update(parcelas)
            .set({ status: 'atrasada' })
            .where(and(
              lt(sql`DATE(data_vencimento)`, hoje),
              inArray(parcelas.status, ['pendente', 'vencendo_hoje'])
            ));
          await db.update(parcelas)
            .set({ status: 'vencendo_hoje' })
            .where(and(
              eq(sql`DATE(data_vencimento)`, hoje),
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
        .lt('data_vencimento', hoje).in('status', ['pendente', 'vencendo_hoje']);
      await supabase.from('parcelas').update({ status: 'vencendo_hoje' })
        .eq('data_vencimento', hoje).eq('status', 'pendente');
      let pQuery = supabase.from('parcelas')
        .select('id, contrato_id, cliente_id, numero_parcela, valor_original, valor_pago, valor_juros, valor_multa, data_vencimento, data_pagamento, status, contratos(koletor_id)')
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
        const { data: cData } = await supabase.from('clientes').select('id, nome, whatsapp, chave_pix').in('id', clienteIds);
        (cData || []).forEach((c: any) => { clientesMap[c.id] = c; });
      }
      if (contratoIds.length > 0) {
        const { data: ctData } = await supabase.from('contratos').select('id, modalidade, numero_parcelas, taxa_juros, tipo_taxa, valor_principal').in('id', contratoIds);
        (ctData || []).forEach((c: any) => { contratosMap[c.id] = c; });
      }

      const resultData = input?.modalidade
        ? parcelasData.filter((r: any) => contratosMap[r.contrato_id]?.modalidade === input.modalidade)
        : parcelasData;

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
        dataVencimento: r.data_vencimento,
        dataPagamento: r.data_pagamento,
        status: r.status,
        modalidade: contratosMap[r.contrato_id]?.modalidade ?? null,
        numeroParcelas: contratosMap[r.contrato_id]?.numero_parcelas ?? null,
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
      desconto: z.number().default(0),
      valorJurosCustom: z.number().optional(),   // juros de atraso editado manualmente
      dataPagamento: z.string().optional(),       // data manual no formato YYYY-MM-DD
      transferirSaldoResidual: z.boolean().default(true), // transferir saldo para próxima parcela
    }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados indisponível' });

      // Buscar parcela
      const { data: parcelaData, error: parcelaErr } = await sb.from('parcelas').select('*').eq('id', input.parcelaId).single();
      if (parcelaErr || !parcelaData) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });

      // Buscar configuração de multa diária do usuário
      let multaDiariaReais = 0;
      try {
        const { data: configRows } = await sb.from('configuracoes').select('chave, valor').eq('user_id', ctx.user.id);
        if (configRows) {
          const configMap: Record<string, string> = {};
          for (const r of configRows) configMap[r.chave] = r.valor ?? '';
          if (configMap['multaDiaria']) multaDiariaReais = parseFloat(configMap['multaDiaria']) || 0;
        }
      } catch (_) { /* usa padrão 0 */ }

      const valorOriginal = parseFloat(parcelaData.valor_original);
      const saldoResidualAnterior = parseFloat(parcelaData.saldo_residual ?? '0');
      // Valor total que o cliente deve nesta parcela (original + saldo residual de parcelas anteriores)
      const valorTotalDevido = valorOriginal + saldoResidualAnterior;

      // Calcular juros de atraso usando multaDiaria em R$/dia (modelo CobraFácil)
      const dataPagamentoDate = input.dataPagamento
        ? new Date(input.dataPagamento + 'T12:00:00')
        : new Date();
      const { juros: jurosCalculado, multa } = calcularJurosMora(
        valorTotalDevido,
        new Date(parcelaData.data_vencimento + 'T00:00:00'),
        dataPagamentoDate,
        multaDiariaReais,
        0 // multa percentual não usada no modelo CobraFácil
      );

      // Usar juros customizado se fornecido pelo usuário, senão usar o calculado
      const juros = input.valorJurosCustom !== undefined ? input.valorJurosCustom : jurosCalculado;

      // Data de pagamento
      const dataPagamentoISO = input.dataPagamento
        ? new Date(input.dataPagamento + 'T12:00:00').toISOString()
        : new Date().toISOString();
      const dataPagamentoStr = input.dataPagamento ?? new Date().toISOString().split('T')[0];

      // Determinar status e saldo residual
      const valorTotalComJuros = valorTotalDevido + juros + multa - input.desconto;
      const isPago = input.valorPago >= valorTotalComJuros - 0.01; // tolerância de 1 centavo
      const novoStatus = isPago ? 'paga' : 'parcial';

      // Calcular saldo residual (quanto falta pagar)
      const saldoRestante = isPago ? 0 : calcularSaldoResidual(valorTotalComJuros, input.valorPago);

      // Atualizar parcela atual
      const { error: updateErr } = await sb.from('parcelas').update({
        valor_pago: input.valorPago.toFixed(2),
        valor_juros: juros.toFixed(2),
        valor_multa: multa.toFixed(2),
        valor_desconto: input.desconto.toFixed(2),
        multa_diaria_usada: multaDiariaReais.toFixed(2),
        data_pagamento: dataPagamentoISO,
        status: novoStatus,
        conta_caixa_id: input.contaCaixaId ?? null,
        observacoes: input.observacoes ?? null,
      }).eq('id', input.parcelaId);
      if (updateErr) console.error('[registrarPagamento] Update parcela error:', updateErr.message);

      // ─── SALDO RESIDUAL AUTOMÁTICO ─────────────────────────────────────────
      // Se pagamento parcial E transferirSaldoResidual=true, adicionar saldo à próxima parcela
      if (novoStatus === 'parcial' && saldoRestante > 0 && input.transferirSaldoResidual) {
        const { data: proximaParcela } = await sb.from('parcelas')
          .select('id, saldo_residual, valor_original')
          .eq('contrato_id', parcelaData.contrato_id)
          .in('status', ['pendente', 'atrasada', 'vencendo_hoje'])
          .order('numero_parcela', { ascending: true })
          .limit(1)
          .single();
        if (proximaParcela) {
          const saldoAtualProxima = parseFloat(proximaParcela.saldo_residual ?? '0');
          const novoSaldo = Math.round((saldoAtualProxima + saldoRestante) * 100) / 100;
          await sb.from('parcelas').update({ saldo_residual: novoSaldo.toFixed(2) }).eq('id', proximaParcela.id);
          console.log(`[registrarPagamento] Saldo residual R$ ${saldoRestante.toFixed(2)} transferido para parcela #${proximaParcela.id}`);
        }
      }

      // Registrar entrada no caixa (apenas se conta informada)
      if (input.contaCaixaId) {
        const { error: txErr } = await sb.from('transacoes_caixa').insert({
          conta_caixa_id: input.contaCaixaId,
          tipo: 'entrada',
          categoria: 'pagamento_parcela',
          valor: input.valorPago.toFixed(2),
          descricao: `Pagamento parcela #${parcelaData.numero_parcela} - Contrato #${parcelaData.contrato_id}${saldoRestante > 0 ? ` (parcial, falta R$ ${saldoRestante.toFixed(2)})` : ''}`,
          parcela_id: input.parcelaId,
          contrato_id: parcelaData.contrato_id,
          data_transacao: dataPagamentoStr,
        });
        if (txErr) console.error('[registrarPagamento] Insert transacao error:', txErr.message);
      }

      // Verificar se contrato foi quitado
      const { data: pendentes } = await sb.from('parcelas')
        .select('id')
        .eq('contrato_id', parcelaData.contrato_id)
        .in('status', ['pendente', 'atrasada', 'vencendo_hoje', 'parcial']);
      if ((pendentes?.length ?? 0) === 0) {
        await sb.from('contratos').update({ status: 'quitado' }).eq('id', parcelaData.contrato_id);
      }

      // Registrar histórico
      const descHistorico = novoStatus === 'paga'
        ? `Parcela #${parcelaData.numero_parcela} quitada - R$ ${input.valorPago.toFixed(2)}`
        : `Parcela #${parcelaData.numero_parcela} paga parcialmente - R$ ${input.valorPago.toFixed(2)} (falta R$ ${saldoRestante.toFixed(2)})${input.transferirSaldoResidual ? ' → transferido para próxima parcela' : ''}`;
      await registrarHistorico({
        contratoId: parcelaData.contrato_id,
        userId: String(parcelaData.user_id ?? parcelaData.koletor_id ?? ''),
        tipo: 'pagamento',
        descricao: descHistorico,
        valorNovo: input.valorPago.toFixed(2),
      });

      return { success: true, status: novoStatus, saldoResidual: saldoRestante };
    }),

  // Pagar apenas os juros do período e renovar a parcela por mais um período
  pagarJuros: protectedProcedure
    .input(z.object({
      parcelaId: z.number(),
      valorJurosPago: z.number().positive(),
      contaCaixaId: z.number().optional(),
      observacoes: z.string().optional(),
      novaDataVencimento: z.string().optional(), // YYYY-MM-DD — sobrescreve o cálculo automático
      novoValorParcela: z.number().positive().optional(), // sobrescreve o valor original da nova parcela
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      // Buscar parcela
      const fetchParcela = async () => {
        if (db) {
          const rows = await db.select().from(parcelas).where(eq(parcelas.id, input.parcelaId)).limit(1);
          return rows[0] ?? null;
        }
        const supabase = await getSupabaseClientAsync();
        if (!supabase) return null;
        const { data } = await supabase.from('parcelas').select('*').eq('id', input.parcelaId).single();
        return data ? {
          id: data.id, contratoId: data.contrato_id, clienteId: data.cliente_id,
          numeroParcela: data.numero_parcela, valorOriginal: data.valor_original,
          dataVencimento: data.data_vencimento, status: data.status,
          contaCaixaId: data.conta_caixa_id, koletorId: data.koletor_id,
        } : null;
      };

      const parcela = await fetchParcela();
      if (!parcela) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });

      // Buscar contrato para saber a modalidade e o intervalo
      const fetchContrato = async () => {
        if (db) {
          const rows = await db.select().from(contratos).where(eq(contratos.id, parcela.contratoId)).limit(1);
          return rows[0] ?? null;
        }
        const supabase = await getSupabaseClientAsync();
        if (!supabase) return null;
        const { data } = await supabase.from('contratos').select('*').eq('id', parcela.contratoId).single();
        return data ? {
          id: data.id, modalidade: data.modalidade, tipoTaxa: data.tipo_taxa,
          taxaJuros: data.taxa_juros, valorPrincipal: data.valor_principal,
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
        const dataVencAtual = new Date(String(parcela.dataVencimento) + 'T00:00:00');
        const novaDataVenc = new Date(dataVencAtual);
        novaDataVenc.setDate(novaDataVenc.getDate() + diasIntervalo);
        novaDataVencStr = novaDataVenc.toISOString().split('T')[0];
      }
      // Valor da nova parcela: usar o valor informado pelo usuário ou manter o original
      const valorNovaParcela = input.novoValorParcela
        ? String(input.novoValorParcela.toFixed(2))
        : String(parcela.valorOriginal);

      // Marcar parcela atual como "paga" (juros pagos = renovação)
      const hoje = new Date();
      if (db) {
        await db.update(parcelas).set({
          valorPago: input.valorJurosPago.toFixed(2),
          dataPagamento: hoje,
          status: 'paga' as const,
          observacoes: input.observacoes ?? 'Pagamento de juros - renovado',
          contaCaixaId: input.contaCaixaId ?? null,
        }).where(eq(parcelas.id, input.parcelaId));

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
          });
        }

        // Calcular valorJuros para a nova parcela (juros = valor pago, pois é só juros)
        const valorJurosNovaParcela = input.valorJurosPago.toFixed(2);
        // Buscar o maior numero_parcela existente para evitar duplicatas
        const maxParcelaRows = await db.select({ maxNum: sql<number>`MAX(numero_parcela)` })
          .from(parcelas).where(eq(parcelas.contratoId, parcela.contratoId as number));
        const maxNumeroParcela = maxParcelaRows[0]?.maxNum ?? (parcela.numeroParcela as number);
        // Criar nova parcela com o valor (possivelmente customizado) e nova data
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
          contagemRenovacoes: ((parcela as any).contagemRenovacoes as number) + 1 || 1,
        });

        // Atualizar numeroParcelas do contrato
        await db.update(contratos)
          .set({ numeroParcelas: sql`numero_parcelas + 1` })
          .where(eq(contratos.id, parcela.contratoId));

      } else {
        // Fallback REST
        const supabase = await getSupabaseClientAsync();
        if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

        await supabase.from('parcelas').update({
          valor_pago: parseFloat(input.valorJurosPago.toFixed(2)),
          data_pagamento: hoje.toISOString(),
          status: 'paga',
          observacoes: input.observacoes ?? 'Pagamento de juros - renovado',
          conta_caixa_id: input.contaCaixaId,
        }).eq('id', input.parcelaId);

        await supabase.from('transacoes_caixa').insert({
          conta_caixa_id: input.contaCaixaId,
          tipo: 'entrada',
          categoria: 'pagamento_parcela',
          valor: parseFloat(input.valorJurosPago.toFixed(2)),
          descricao: `Juros pagos - Parcela #${parcela.numeroParcela} renovada - Contrato #${parcela.contratoId}`,
          parcela_id: input.parcelaId,
          contrato_id: parcela.contratoId,
          data_transacao: new Date().toISOString().split('T')[0],
        });

        // Buscar o maior numero_parcela existente para evitar duplicatas no fallback REST
        const { data: maxParcelaRest } = await supabase.from('parcelas')
          .select('numero_parcela')
          .eq('contrato_id', parcela.contratoId)
          .order('numero_parcela', { ascending: false })
          .limit(1)
          .single();
        const novoNumero = ((maxParcelaRest?.numero_parcela as number) ?? (parcela.numeroParcela as number)) + 1;
        const novoValorRest = parseFloat(valorNovaParcela);
        const novaContagemRenovacoes = (((parcela as any).contagemRenovacoes as number) || 0) + 1;
        await supabase.from('parcelas').insert({
          user_id: ctx.user.id,
          cliente_id: parcela.clienteId,
          contrato_id: parcela.contratoId,
          koletor_id: parcela.koletorId ?? null,
          numero: novoNumero,
          numero_parcela: novoNumero,
          valor: novoValorRest,
          valor_original: novoValorRest,
          valor_juros: parseFloat(input.valorJurosPago.toFixed(2)),
          data_vencimento: novaDataVencStr,
          status: 'pendente',
          conta_caixa_id: input.contaCaixaId,
          contagem_renovacoes: novaContagemRenovacoes,
        });

        await supabase.from('contratos')
          .update({ numero_parcelas: (contrato.numeroParcelas as number) + 1 })
          .eq('id', parcela.contratoId);
      }

      // Registrar histórico
      await registrarHistorico({
        contratoId: parcela.contratoId as number,
        userId: String(ctx.user.id),
        tipo: 'pagamento_juros',
        descricao: `Juros da parcela #${parcela.numeroParcela} pagos - R$ ${input.valorJurosPago.toFixed(2)} - Nova parcela criada com venc. ${novaDataVencStr}`,
        valorNovo: input.valorJurosPago.toFixed(2),
      });

      return { success: true, novaDataVencimento: novaDataVencStr };
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
        const rows = await db.select().from(parcelas).where(eq(parcelas.id, input.parcelaId)).limit(1);
        const parcela = rows[0];
        if (!parcela) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });

        const updateData: Record<string, any> = {};
        if (input.novoValor) updateData.valorOriginal = input.novoValor.toFixed(2);
        if (input.novaDataVencimento) updateData.dataVencimento = input.novaDataVencimento;

        await db.update(parcelas).set(updateData).where(eq(parcelas.id, input.parcelaId));
      } else {
        const supabase = await getSupabaseClientAsync();
        if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

        const updateData: Record<string, any> = {};
        if (input.novoValor) updateData.valor_original = input.novoValor;
        if (input.novaDataVencimento) updateData.data_vencimento = input.novaDataVencimento;

        const { error } = await supabase.from('parcelas').update(updateData).eq('id', input.parcelaId);
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
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
      const { data: existentes } = await sb.from('parcelas').select('numero_parcela').eq('contrato_id', input.contratoId).order('numero_parcela', { ascending: false }).limit(1);
      const ultimoNum = existentes?.[0]?.numero_parcela ?? 0;
      const novaNumeroParcela = ultimoNum + 1;

      const hoje = new Date().toISOString().split('T')[0];
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
            .where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, 'entrada')));
          const saidas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
            .from(transacoesCaixa)
            .where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, 'saida')));
          const saldo = parseFloat(conta.saldo) + parseFloat(entradas[0]?.total ?? '0') - parseFloat(saidas[0]?.total ?? '0');
          result.push({ ...conta, saldoAtual: saldo });
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
    const { data: transData } = await supabase.from('transacoes_caixa').select('conta_caixa_id, tipo, valor').eq('user_id', ctx.user.id);
    const result2 = [];
    for (const conta of (contasData || [])) {
      const transacoesConta = (transData ?? []).filter((t: any) => t.conta_caixa_id === conta.id);
      const totalEntradas = transacoesConta.filter((t: any) => t.tipo === 'entrada').reduce((s: number, t: any) => s + parseFloat(t.valor ?? '0'), 0);
      const totalSaidas = transacoesConta.filter((t: any) => t.tipo === 'saida').reduce((s: number, t: any) => s + parseFloat(t.valor ?? '0'), 0);
      // Campo real é 'saldo' (não 'saldo_inicial')
      const saldoBase = parseFloat(conta.saldo ?? conta.saldo_inicial ?? '0');
      const saldoAtual = saldoBase + totalEntradas - totalSaidas;
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
        ? await supabase.from('contas_caixa').select('id, nome').in('id', contaIds)
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
          // Atualizar saldo da conta
          const delta = input.tipo === 'entrada' ? input.valor : -input.valor;
          await db.execute(sql`UPDATE contas_caixa SET saldo_inicial = COALESCE(saldo_inicial::numeric, 0) + ${delta} WHERE id = ${input.contaCaixaId}`);
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
      // Atualizar saldo da conta via RPC ou update direto
      const delta = input.tipo === 'entrada' ? input.valor : -input.valor;
      // Atualizar saldo da conta: buscar saldo atual e somar delta
      const { data: contaData } = await supabase
        .from('contas_caixa')
        .select('saldo')
        .eq('id', input.contaCaixaId)
        .single();
      if (contaData) {
        const novoSaldo = parseFloat(contaData.saldo ?? '0') + delta;
        await supabase.from('contas_caixa').update({ saldo: novoSaldo }).eq('id', input.contaCaixaId);
      }
      return { success: true };
    }),
});

// ─── PORTAL DO CLIENTE ───────────────────────────────────────────────────────
const portalRouter = router({
  gerarLink: protectedProcedure
    .input(z.object({ clienteId: z.number(), origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const token = nanoid(48);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      if (db) {
        try {
          await db.insert(magicLinks).values({ clienteId: input.clienteId, token, expiresAt });
          return { url: `${input.origin}/portal/${token}`, token };
        } catch (err) {
          console.warn('[portal.gerarLink] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { error } = await supabase.from('magic_links').insert({
        cliente_id: input.clienteId,
        token,
        expires_at: expiresAt.toISOString(),
      });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { url: `${input.origin}/portal/${token}`, token };
    }),

  acessar: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (db) {
        try {
          const links = await db.select().from(magicLinks).where(eq(magicLinks.token, input.token)).limit(1);
          const link = links[0];
          if (!link) throw new Error('Link inválido');
          if (link.usado) throw new Error('Link já utilizado');
          if (new Date() > link.expiresAt) throw new Error('Link expirado');
          const clienteRows = await db.select().from(clientes).where(eq(clientes.id, link.clienteId)).limit(1);
          const cliente = clienteRows[0];
          if (!cliente) throw new Error('Cliente não encontrado');
          const parcelasCliente = await db.select().from(parcelas)
            .where(and(eq(parcelas.clienteId, link.clienteId), inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje', 'parcial'])))
            .orderBy(parcelas.dataVencimento).limit(10);
          return { cliente: { nome: cliente.nome, chavePix: cliente.chavePix, tipoChavePix: cliente.tipoChavePix }, parcelas: parcelasCliente };
        } catch (err: any) {
          if (['Link inválido', 'Link já utilizado', 'Link expirado', 'Cliente não encontrado'].includes(err.message)) throw err;
          console.warn('[portal.acessar] Drizzle failed, trying REST:', err.message);
          resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new Error('DB unavailable');
      const { data: linkData } = await supabase.from('magic_links').select('*').eq('token', input.token).single();
      if (!linkData) throw new Error('Link inválido');
      if (linkData.usado) throw new Error('Link já utilizado');
      if (new Date() > new Date(linkData.expires_at)) throw new Error('Link expirado');
      const { data: cliData } = await supabase.from('clientes').select('nome, chave_pix, tipo_chave_pix').eq('id', linkData.cliente_id).single();
      if (!cliData) throw new Error('Cliente não encontrado');
      const { data: pData } = await supabase.from('parcelas').select('*').eq('cliente_id', linkData.cliente_id).in('status', ['pendente', 'atrasada', 'vencendo_hoje', 'parcial']).order('data_vencimento').limit(10);
      return { cliente: { nome: cliData.nome, chavePix: cliData.chave_pix, tipoChavePix: cliData.tipo_chave_pix }, parcelas: pData ?? [] };
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
    const { data } = await supabase.from('templates_whatsapp').select('*').eq('ativo', true);
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
      const { data: templates } = await supabase.from('templates_whatsapp').select('*').eq('ativo', true).eq('tipo', tipoTemplate).limit(1);
      const { data: contrato } = await supabase
        .from('contratos')
        .select('*, clientes(nome, whatsapp, telefone, chave_pix)')
        .eq('id', input.contratoId)
        .single();
      if (!contrato) throw new Error('Contrato não encontrado');
      const { data: parcelasArr } = await supabase
        .from('parcelas')
        .select('*')
        .eq('contrato_id', input.contratoId)
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
    .query(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new Error('DB unavailable');
      const { data: templateData } = await supabase.from('templates_whatsapp').select('*').eq('id', input.templateId).single();
      if (!templateData) throw new Error('Template não encontrado');
      const { data: parcelaData } = await supabase.from('parcelas').select('*, clientes(nome, whatsapp, chave_pix), contratos(numero_parcelas)').eq('id', input.parcelaId).single();
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
      const hoje = new Date().toISOString().split('T')[0];
      const { data: parcelasHoje } = await supabase
        .from('parcelas')
        .select('id, valor, valor_pago, status, data_vencimento, contratos(clientes(nome))')
        .eq('data_vencimento', hoje)
        .eq('user_id', ctx.user.id);
      const { data: pagamentosHoje } = await supabase
        .from('parcelas')
        .select('id, valor_pago, data_pagamento, contratos(clientes(nome))')
        .eq('data_pagamento', hoje)
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

    const { data: entradas } = await supabase.from('transacoes_caixa').select('valor').eq('tipo', 'entrada');
    const totalRecebido = (entradas ?? []).reduce((s: number, r: any) => s + parseFloat(r.valor ?? '0'), 0);

    const { data: liberados } = await supabase.from('transacoes_caixa').select('valor').eq('tipo', 'saida').eq('categoria', 'emprestimo_liberado');
    const totalLiberado = (liberados ?? []).reduce((s: number, r: any) => s + parseFloat(r.valor ?? '0'), 0);

    const { data: inadimplentesData } = await supabase.from('parcelas').select('valor_original').eq('status', 'atrasada');
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
      const hoje = new Date().toISOString().split('T')[0];
      const { data: parcelasAtrasadas } = await supabase
        .from('parcelas')
        .select('id, contrato_id, cliente_id, numero_parcela, valor_original, valor_multa, data_vencimento, clientes(nome, whatsapp, telefone)')
        .eq('status', 'atrasada')
        .eq('user_id', userId)
        .order('data_vencimento', { ascending: true });
      if (!parcelasAtrasadas || parcelasAtrasadas.length === 0) return [];
      // Agrupar por cliente
      const clienteMap = new Map<number, any>();
      for (const p of parcelasAtrasadas) {
        const cliente = p.clientes as any;
        const venc = new Date(p.data_vencimento + 'T00:00:00');
        const diasAtraso = Math.max(0, Math.floor((new Date().getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));
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
      multaDiaria: parseFloat(get('multaDiaria', 'multa_diaria', '100')),
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
    const { data } = await supabase.from('templates_whatsapp').select('*');
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
          await db.update(templatesWhatsapp).set(data).where(eq(templatesWhatsapp.id, id));
          return { success: true };
        } catch (err) { console.warn('[configuracoes.updateTemplate] Drizzle failed:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('templates_whatsapp').update(data).eq('id', id);
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
      const { data, error } = await supabase.from('koletores').insert({ nome: input.nome, email: input.email || null, telefone: input.telefone || null, whatsapp: input.whatsapp || null, perfil: input.perfil, limite_emprestimo: input.limiteEmprestimo, comissao_percentual: input.comissaoPercentual, observacoes: input.observacoes || null }).select('id').single();
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
          await db.update(koletores).set(updateData).where(eq(koletores.id, id));
          return { success: true };
        } catch (err) { console.warn('[koletores.update] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const updateData: any = { ...rest };
      if (limiteEmprestimo !== undefined) updateData.limite_emprestimo = limiteEmprestimo;
      if (comissaoPercentual !== undefined) updateData.comissao_percentual = comissaoPercentual;
      await supabase.from('koletores').update(updateData).eq('id', id);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try { await db.update(koletores).set({ ativo: false }).where(eq(koletores.id, input.id)); return { success: true }; }
        catch (err) { console.warn('[koletores.delete] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('koletores').update({ ativo: false }).eq('id', input.id);
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

      const { data: todosKoletores } = await supabase.from('koletores').select('*').eq('ativo', true);

      const resultado = await Promise.all((todosKoletores ?? []).map(async (k: any) => {
        const { data: contratosKoletor } = await supabase.from('contratos').select('valor_principal')
          .eq('koletor_id', k.id).gte('createdAt', inicioMes).lte('createdAt', fimMes);

        const { data: recebidoKoletor } = await supabase.from('parcelas').select('valor_pago')
          .eq('koletor_id', k.id).eq('status', 'paga').gte('data_pagamento', inicioMes).lte('data_pagamento', fimMes);

        const { data: inadimplentesKoletor } = await supabase.from('parcelas').select('valor_original')
          .eq('koletor_id', k.id).eq('status', 'atrasada');

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
    .query(async ({ input }) => {
      // Use Supabase REST to fetch open parcelas
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new Error('DB unavailable');

      const { data: parcelasAbertas, error: parcelasErr } = await supabase
        .from('parcelas')
        .select('*')
        .eq('contrato_id', input.contratoId)
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
        await supabase.from('parcelas').update({ status: 'paga', observacoes: 'Reparcelado' }).eq('id', p.id);
      }

      // Cancelar contrato original
      await supabase.from('contratos').update({ status: 'quitado' }).eq('id', input.contratoId);

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
      if (input?.status && input.status !== 'todos') q = q.eq('status', input.status);
      if (input?.categoria) q = q.eq('categoria', input.categoria);
      const { data, error } = await q;
      if (error) { console.error('[contasPagar.listar] REST error:', error.message); return []; }
      return (data ?? []).map((r: any) => ({ ...r, dataVencimento: r.data_vencimento, dataPagamento: r.data_pagamento, contaCaixaId: r.conta_caixa_id }));
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
      const { data, error } = await supabase.from('contas_pagar').insert({
        descricao: input.descricao, categoria: input.categoria, valor: input.valor,
        data_vencimento: input.dataVencimento, recorrente: input.recorrente ?? false,
        periodicidade: input.periodicidade ?? 'unica', observacoes: input.observacoes ?? null,
        conta_caixa_id: input.contaCaixaId ?? null, status: 'pendente',
        user_id: ctx.user.id,
      }).select('id').single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true, id: data.id };
    }),

  pagar: protectedProcedure
    .input(z.object({
      id: z.number(),
      contaCaixaId: z.number().optional(),
      dataPagamento: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const dataPag = input.dataPagamento ? new Date(input.dataPagamento) : new Date();
      if (db) {
        try {
          const conta = await db.select().from(contasPagar).where(eq(contasPagar.id, input.id)).limit(1);
          if (!conta[0]) throw new Error('Conta não encontrada');
          await db.update(contasPagar).set({ status: 'paga', dataPagamento: dataPag, contaCaixaId: input.contaCaixaId }).where(eq(contasPagar.id, input.id));
          if (input.contaCaixaId) {
            await db.insert(transacoesCaixa).values({ contaCaixaId: input.contaCaixaId, tipo: 'saida', categoria: 'despesa_operacional', valor: conta[0].valor, descricao: `Pagamento: ${conta[0].descricao}`, dataTransacao: dataPag });
          }
          return { success: true };
        } catch (err: any) {
          if (err.message === 'Conta não encontrada') throw err;
          console.warn('[contasPagar.pagar] Drizzle failed, trying REST:', err.message); resetDb();
        }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data: contaData } = await supabase.from('contas_pagar').select('valor, descricao').eq('id', input.id).single();
      if (!contaData) throw new Error('Conta não encontrada');
      await supabase.from('contas_pagar').update({ status: 'paga', data_pagamento: dataPag.toISOString(), conta_caixa_id: input.contaCaixaId ?? null }).eq('id', input.id);
      if (input.contaCaixaId) {
        await supabase.from('transacoes_caixa').insert({ conta_caixa_id: input.contaCaixaId, tipo: 'saida', categoria: 'despesa_operacional', valor: contaData.valor, descricao: `Pagamento: ${contaData.descricao}`, data_transacao: dataPag.toISOString() });
      }
      return { success: true };
    }),

  cancelar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try { await db.update(contasPagar).set({ status: 'cancelada' }).where(eq(contasPagar.id, input.id)); return { success: true }; }
        catch (err) { console.warn('[contasPagar.cancelar] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('contas_pagar').update({ status: 'cancelada' }).eq('id', input.id);
      return { success: true };
    }),

  excluir: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try { await db.delete(contasPagar).where(eq(contasPagar.id, input.id)); return { success: true }; }
        catch (err) { console.warn('[contasPagar.excluir] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('contas_pagar').delete().eq('id', input.id);
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
      const pagas = (all ?? []).filter((r: any) => r.status === 'paga');
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
    const { data } = await supabase.from('produtos').select('*').eq('ativo', true).order('createdAt', { ascending: false });
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
        try { await db.update(produtos).set({ estoque: input.estoque }).where(eq(produtos.id, input.id)); return { success: true }; }
        catch (err) { console.warn('[vendas.atualizarEstoque] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('produtos').update({ estoque: input.estoque }).eq('id', input.id);
      return { success: true };
    }),

  desativarProduto: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try { await db.update(produtos).set({ ativo: false }).where(eq(produtos.id, input.id)); return { success: true }; }
        catch (err) { console.warn('[vendas.desativarProduto] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('produtos').update({ ativo: false }).eq('id', input.id);
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
            contaCaixaId: input.contaCaixaId, observacoes: input.observacoes, status: 'aguardando',
          }).returning({ id: cheques.id });
          if (input.contaCaixaId) {
            await db.insert(transacoesCaixa).values({ contaCaixaId: input.contaCaixaId, tipo: 'saida', categoria: 'outros', valor: valorLiquido.toFixed(2), descricao: `Desconto de cheque - ${input.emitente}`, dataTransacao: new Date() });
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
        await supabase.from('transacoes_caixa').insert({ conta_caixa_id: input.contaCaixaId, tipo: 'saida', categoria: 'outros', valor: valorLiquido, descricao: `Desconto de cheque - ${input.emitente}`, data_transacao: new Date().toISOString() });
      }
      return { success: true, id: chqData.id, valorLiquido, valorDesconto };
    }),

  compensar: protectedProcedure
    .input(z.object({ id: z.number(), contaCaixaId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try {
          const cheque = await db.select().from(cheques).where(eq(cheques.id, input.id)).limit(1);
          if (!cheque[0]) throw new Error('Cheque não encontrado');
          const contaId = input.contaCaixaId ?? cheque[0].contaCaixaId;
          await db.update(cheques).set({ status: 'compensado', dataCompensacao: new Date(), contaCaixaId: contaId }).where(eq(cheques.id, input.id));
          if (contaId) await db.insert(transacoesCaixa).values({ contaCaixaId: contaId, tipo: 'entrada', categoria: 'outros', valor: cheque[0].valorNominal, descricao: `Cheque compensado - ${cheque[0].emitente}`, dataTransacao: new Date() });
          return { success: true };
        } catch (err: any) { if (err.message === 'Cheque não encontrado') throw err; console.warn('[cheques.compensar] Drizzle failed, trying REST:', err.message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data: chqData } = await supabase.from('cheques').select('valor_nominal, emitente, conta_caixa_id').eq('id', input.id).single();
      if (!chqData) throw new Error('Cheque não encontrado');
      const contaId = input.contaCaixaId ?? chqData.conta_caixa_id;
      await supabase.from('cheques').update({ status: 'compensado', data_compensacao: new Date().toISOString(), conta_caixa_id: contaId }).eq('id', input.id);
      if (contaId) await supabase.from('transacoes_caixa').insert({ conta_caixa_id: contaId, tipo: 'entrada', categoria: 'outros', valor: chqData.valor_nominal, descricao: `Cheque compensado - ${chqData.emitente}`, data_transacao: new Date().toISOString() });
      return { success: true };
    }),

  devolver: protectedProcedure
    .input(z.object({ id: z.number(), motivo: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try { await db.update(cheques).set({ status: 'devolvido', motivoDevolucao: input.motivo }).where(eq(cheques.id, input.id)); return { success: true }; }
        catch (err) { console.warn('[cheques.devolver] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('cheques').update({ status: 'devolvido', motivo_devolucao: input.motivo }).eq('id', input.id);
      return { success: true };
    }),

  cancelar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (db) {
        try { await db.update(cheques).set({ status: 'cancelado' }).where(eq(cheques.id, input.id)); return { success: true }; }
        catch (err) { console.warn('[cheques.cancelar] Drizzle failed, trying REST:', (err as Error).message); resetDb(); }
      }
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      await supabase.from('cheques').update({ status: 'cancelado' }).eq('id', input.id);
      return { success: true };
    }),

  resumo: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return { totalAguardando: 0, qtdAguardando: 0, totalCompensado: 0, qtdCompensado: 0, totalDevolvido: 0, qtdDevolvido: 0 };
      const { data: all } = await supabase.from('cheques').select('status, valor_nominal');
      const ag = (all ?? []).filter((r: any) => r.status === 'aguardando');
      const co = (all ?? []).filter((r: any) => r.status === 'compensado');
      const de = (all ?? []).filter((r: any) => r.status === 'devolvido');
      return {
        totalAguardando: ag.reduce((s: number, r: any) => s + parseFloat(r.valor_nominal ?? 0), 0), qtdAguardando: ag.length,
        totalCompensado: co.reduce((s: number, r: any) => s + parseFloat(r.valor_nominal ?? 0), 0), qtdCompensado: co.length,
        totalDevolvido: de.reduce((s: number, r: any) => s + parseFloat(r.valor_nominal ?? 0), 0), qtdDevolvido: de.length,
      };
    }
    const aguardando = await db.select({ total: sql<string>`COALESCE(SUM(valor_nominal), 0)`, qtd: sql<number>`COUNT(*)` }).from(cheques).where(eq(cheques.status, 'aguardando'));
    const compensados = await db.select({ total: sql<string>`COALESCE(SUM(valor_nominal), 0)`, qtd: sql<number>`COUNT(*)` }).from(cheques).where(eq(cheques.status, 'compensado'));
    const devolvidos = await db.select({ total: sql<string>`COALESCE(SUM(valor_nominal), 0)`, qtd: sql<number>`COUNT(*)` }).from(cheques).where(eq(cheques.status, 'devolvido'));
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
    .query(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return [];
      try {
        const { data, error } = await supabase
          .from('parcelas_venda_telefone')
          .select('*')
          .eq('venda_id', input.vendaId)
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
    }))
    .mutation(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

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
        };
      });

        await supabase.from('parcelas_venda_telefone').insert(parcelasData);

      // ── Integração com Caixa: registrar entrada da entrada (valor inicial) ──
      if (input.entradaValor > 0) {
        try {
          // Buscar a primeira conta ativa do caixa
          const { data: contas } = await supabase
            .from('contas_caixa')
            .select('id, nome, saldo')
            .order('id', { ascending: true })
            .limit(1);
          if (contas && contas.length > 0) {
            const conta = contas[0];
            // Registrar entrada no caixa
            await supabase.from('transacoes_caixa').insert({
              conta_caixa_id: conta.id,
              tipo: 'entrada',
              categoria: 'outros',
              valor: input.entradaValor,
              descricao: `Entrada venda ${input.marca} ${input.modelo} - ${input.compradorNome}`,
              data_transacao: new Date().toISOString(),
            });
            // Atualizar saldo da conta
            // Registrar transação de entrada (saldo calculado via transações)
            // Não atualizar campo saldo diretamente (campo inexistente, saldo é calculado)
          }
        } catch (caixaErr) {
          console.warn('[vendasTelefone.criar] Erro ao registrar no caixa:', caixaErr);
          // Não falhar a criação da venda por erro no caixa
        }
      }

      return venda;
    }),
   pagarParcela: protectedProcedure
    .input(z.object({
      parcelaId: z.number(),
      valorPago: z.number().positive(),
    }))
    .mutation(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      // Buscar dados da parcela para obter informações da venda
      const { data: parcela } = await supabase
        .from('parcelas_venda_telefone')
        .select('*, vendas_telefone(marca, modelo, comprador_nome)')
        .eq('id', input.parcelaId)
        .maybeSingle();
      const { error } = await supabase
        .from('parcelas_venda_telefone')
        .update({ status: 'paga', pago_em: new Date().toISOString(), valor_pago: input.valorPago })
        .eq('id', input.parcelaId);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      // ── Integração com Caixa: registrar pagamento da parcela ──
      try {
        const { data: contas } = await supabase
          .from('contas_caixa')
          .select('id, saldo')
          .order('id', { ascending: true })
          .limit(1);
        if (contas && contas.length > 0) {
          const conta = contas[0];
          const venda = (parcela as any)?.vendas_telefone;
          const descricao = venda
            ? `Parcela ${(parcela as any)?.numero} - ${venda.marca} ${venda.modelo} - ${venda.comprador_nome}`
            : `Parcela venda telefone #${input.parcelaId}`;
          await supabase.from('transacoes_caixa').insert({
            conta_caixa_id: conta.id,
            tipo: 'entrada',
            categoria: 'pagamento_parcela',
            valor: input.valorPago,
            descricao,
            data_transacao: new Date().toISOString(),
          });
          // Registrar transação de entrada (saldo calculado via transações)
          // Não atualizar campo saldo diretamente (campo inexistente, saldo é calculado)
        }
      } catch (caixaErr) {
        console.warn('[vendasTelefone.pagarParcela] Erro ao registrar no caixa:', caixaErr);
      }
      // ── Verificar se todas as parcelas foram pagas → marcar venda como quitada ──
      try {
        if (parcela) {
          const vendaId = (parcela as any).venda_id;
          const { data: todasParcelas } = await supabase
            .from('parcelas_venda_telefone')
            .select('id, status')
            .eq('venda_id', vendaId);
          if (todasParcelas && todasParcelas.length > 0) {
            const todasPagas = todasParcelas.every((p: any) =>
              p.id === input.parcelaId ? true : p.status === 'paga'
            );
            if (todasPagas) {
              await supabase
                .from('vendas_telefone')
                .update({ status: 'quitado' })
                .eq('id', vendaId);
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
    .mutation(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });

      const { error } = await supabase
        .from('vendas_telefone')
        .delete()
        .eq('id', input.id);

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
      const { error } = await sb.from('contratos').update({ etiquetas: JSON.stringify(input.etiquetas) }).eq('id', input.contratoId);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
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

// ─── APP ROUTER ──────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
});

export type AppRouter = typeof appRouter;
