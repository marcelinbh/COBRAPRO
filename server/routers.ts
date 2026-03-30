import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb, getSupabaseClient, resetDb } from "./db";
import { TRPCError } from "@trpc/server";
import {
  clientes, contratos, parcelas, contasCaixa, transacoesCaixa, magicLinks, templatesWhatsapp,
  koletores, configuracoes, contasPagar, produtos, cheques
} from "../drizzle/schema";
import { eq, and, sql, desc, gte, lte, lt, isNull, or, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { calcularJurosMora, calcularParcelaPadrao, calcularParcelasPrice, calcularParcelaBullet, getDiasModalidade } from "../shared/finance";

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
const dashboardRouter = router({
  kpis: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const hojeStr = hoje.toISOString().split('T')[0];

    // Saldo total das contas
    const contas = await db.select().from(contasCaixa).where(eq(contasCaixa.ativa, true));
    let saldoTotal = 0;
    for (const conta of contas) {
      const entradas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
        .from(transacoesCaixa)
        .where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, 'entrada')));
      const saidas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
        .from(transacoesCaixa)
        .where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, 'saida')));
      saldoTotal += parseFloat(conta.saldoInicial) + parseFloat(entradas[0]?.total ?? '0') - parseFloat(saidas[0]?.total ?? '0');
    }

    // Capital em circulação (soma dos valores principais dos contratos ativos)
    const capitalResult = await db.select({ total: sql<string>`COALESCE(SUM(valor_principal), 0)` })
      .from(contratos).where(eq(contratos.status, 'ativo'));
    const capitalCirculacao = parseFloat(capitalResult[0]?.total ?? '0');

    // Total a receber (parcelas pendentes + atrasadas)
    const receberResult = await db.select({ total: sql<string>`COALESCE(SUM(valor_original), 0)` })
      .from(parcelas).where(inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje', 'parcial']));
    const totalReceber = parseFloat(receberResult[0]?.total ?? '0');

    // Inadimplência
    const inadResult = await db.select({ total: sql<string>`COALESCE(SUM(valor_original), 0)`, qtd: sql<number>`COUNT(DISTINCT cliente_id)` })
      .from(parcelas).where(eq(parcelas.status, 'atrasada'));
    const totalInadimplente = parseFloat(inadResult[0]?.total ?? '0');
    const qtdInadimplentes = inadResult[0]?.qtd ?? 0;

    // Juros pendentes acumulados
    const jurosResult = await db.select({ total: sql<string>`COALESCE(SUM(valor_juros), 0)` })
      .from(parcelas).where(inArray(parcelas.status, ['atrasada', 'parcial']));
    const jurosPendentes = parseFloat(jurosResult[0]?.total ?? '0');

    // Vence hoje
    const hojeResult = await db.select({ total: sql<string>`COALESCE(SUM(valor_original), 0)`, qtd: sql<number>`COUNT(*)` })
      .from(parcelas).where(and(
        eq(sql`DATE(data_vencimento)`, hojeStr),
        inArray(parcelas.status, ['pendente', 'vencendo_hoje'])
      ));
    const qtdVenceHoje = hojeResult[0]?.qtd ?? 0;
    const valorVenceHoje = parseFloat(hojeResult[0]?.total ?? '0');

    // Recebido hoje
    const recebidoResult = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
      .from(transacoesCaixa).where(and(
        eq(transacoesCaixa.tipo, 'entrada'),
        eq(transacoesCaixa.categoria, 'pagamento_parcela'),
        gte(transacoesCaixa.dataTransacao, hoje)
      ));
    const recebidoHoje = parseFloat(recebidoResult[0]?.total ?? '0');

    // Contratos ativos
    const contratosResult = await db.select({ qtd: sql<number>`COUNT(*)` })
      .from(contratos).where(eq(contratos.status, 'ativo'));
    const contratosAtivos = contratosResult[0]?.qtd ?? 0;

    return {
      saldoTotal, capitalCirculacao, totalReceber, totalInadimplente,
      qtdInadimplentes, jurosPendentes, qtdVenceHoje, valorVenceHoje,
      recebidoHoje, contratosAtivos
    };
  }),

  parcelasHoje: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const hoje = new Date().toISOString().split('T')[0];
    const rows = await db.select({
      id: parcelas.id,
      clienteId: parcelas.clienteId,
      clienteNome: clientes.nome,
      numeroParcela: parcelas.numeroParcela,
      valorOriginal: parcelas.valorOriginal,
      dataVencimento: parcelas.dataVencimento,
      status: parcelas.status,
      totalParcelas: sql<number>`(SELECT COUNT(*) FROM parcelas p2 WHERE p2.contrato_id = ${parcelas.contratoId})`,
    }).from(parcelas)
      .innerJoin(clientes, eq(parcelas.clienteId, clientes.id))
      .where(and(
        eq(sql`DATE(${parcelas.dataVencimento})`, hoje),
        inArray(parcelas.status, ['pendente', 'vencendo_hoje'])
      ))
      .orderBy(parcelas.dataVencimento).limit(20);
    return rows;
  }),

  parcelasAtrasadas: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const hoje = new Date().toISOString().split('T')[0];
    const rows = await db.select({
      id: parcelas.id,
      clienteId: parcelas.clienteId,
      clienteNome: clientes.nome,
      numeroParcela: parcelas.numeroParcela,
      valorOriginal: parcelas.valorOriginal,
      dataVencimento: parcelas.dataVencimento,
      status: parcelas.status,
    }).from(parcelas)
      .innerJoin(clientes, eq(parcelas.clienteId, clientes.id))
      .where(eq(parcelas.status, 'atrasada'))
      .orderBy(parcelas.dataVencimento).limit(20);

    return rows.map(r => {
      const { total, diasAtraso } = calcularJurosMora(
        parseFloat(r.valorOriginal), new Date(r.dataVencimento + 'T00:00:00'), new Date()
      );
      return { ...r, valorAtualizado: total, diasAtraso };
    });
  }),

  fluxoMensal: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const result = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
        .from(transacoesCaixa)
        .where(and(
          eq(transacoesCaixa.tipo, 'entrada'),
          eq(sql`DATE(data_transacao)`, dStr)
        ));
      dias.push({
        dia: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        valor: parseFloat(result[0]?.total ?? '0'),
      });
    }
    return dias;
  }),
});

// ─── CLIENTES ────────────────────────────────────────────────────────────────
const clientesRouter = router({
  list: protectedProcedure
    .input(z.object({ busca: z.string().optional(), ativo: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      let rows: any[];
      if (db) {
        try {
          rows = await db.select().from(clientes)
            .where(input?.ativo !== undefined ? eq(clientes.ativo, input.ativo) : undefined)
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
        const supabase = getSupabaseClient();
        if (supabase) {
          let query = supabase.from('clientes').select('*').order('createdAt', { ascending: false });
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

  byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (db) {
      try {
        const rows = await db.select().from(clientes).where(eq(clientes.id, input.id)).limit(1);
        if (rows.length > 0) return rows[0];
      } catch (err) {
        console.warn('[clientes.byId] Drizzle failed, trying REST:', (err as Error).message);
        resetDb();
      }
    }
    // Fallback: Supabase REST
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase.from('clientes').select('*').eq('id', input.id).single();
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
      banco: z.string().optional(),
      agencia: z.string().optional(),
      numeroConta: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (db) {
        try {
          const result = await db.insert(clientes).values({
            ...input,
            email: input.email || undefined,
          }).returning({ id: clientes.id });
          return { id: result[0].id };
        } catch (err) {
          console.warn('[clientes.create] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }
      // Fallback: Supabase REST
      const supabase = getSupabaseClient();
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
      if (input.banco) insertData.banco = input.banco;
      if (input.agencia) insertData.agencia = input.agencia;
      if (input.numeroConta) insertData.numero_conta = input.numeroConta;
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
      banco: z.string().optional(),
      agencia: z.string().optional(),
      numeroConta: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...data } = input;
      await db.update(clientes).set(data).where(eq(clientes.id, id));
      return { success: true };
    }),

  contratosByCliente: protectedProcedure.input(z.object({ clienteId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(contratos).where(eq(contratos.clienteId, input.clienteId)).orderBy(desc(contratos.createdAt));
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
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
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
          });
          importados++;
        } catch (e: any) {
          erros++;
          detalhesErros.push(`Erro ao importar "${reg.nome}": ${e?.message ?? 'erro desconhecido'}`);
        }
      }
      return { importados, erros, detalhesErros };
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
    .query(async ({ input }) => {
      const supabase = getSupabaseClient();
      if (!supabase) return [];

      // Buscar contratos
      let cQuery = supabase
        .from('contratos')
        .select('id, cliente_id, modalidade, status, valor_principal, valor_parcela, numero_parcelas, taxa_juros, tipo_taxa, data_inicio, data_vencimento_primeira, "createdAt", clientes!inner(id, nome, whatsapp, chave_pix, telefone)')
        .order('createdAt', { ascending: false });

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
        .select('id, contrato_id, numero_parcela, valor_original, valor_pago, data_vencimento, data_pagamento, status')
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
        const valorJurosParcela = Math.round(valorPrincipal * (taxaJuros / 100) * 100) / 100;

        // Total a receber = soma das parcelas abertas
        const totalReceber = parcelasAbertas.reduce((s: number, p: any) => s + parseFloat(p.valor_original ?? '0'), 0);
        // Total pago = soma das parcelas pagas
        const totalPago = parcelasPagas.reduce((s: number, p: any) => s + parseFloat(p.valor_pago ?? p.valor_original ?? '0'), 0);
        // Lucro previsto = juros × número de parcelas abertas
        const lucroPrevisto = valorJurosParcela * parcelasAbertas.length;
        // Lucro realizado = total pago - capital (amortizações)
        const lucroRealizado = Math.max(0, totalPago - (parcelasPagas.length > 0 ? 0 : 0));

        // Próxima parcela em aberto
        const proximaParcela = parcelasAbertas.length > 0 ? parcelasAbertas[0] : null;

        // Calcular juros por atraso para parcelas atrasadas
        const parcelasComAtraso = parcelasAtrasadas.map((p: any) => {
          const venc = new Date(p.data_vencimento + 'T00:00:00');
          const diasAtraso = Math.max(0, Math.floor((new Date().getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));
          const jurosDiarios = 100; // R$100/dia conforme Cobra Fácil (configurável)
          const jurosAtraso = diasAtraso * jurosDiarios;
          return {
            ...p,
            diasAtraso,
            jurosAtraso,
            totalComAtraso: parseFloat(p.valor_original ?? '0') + jurosAtraso,
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
        };
      });
    }),

  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      modalidade: z.string().optional(),
      clienteId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
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
          }).from(contratos)
            .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
            .orderBy(desc(contratos.createdAt));

          return rows.filter(r => {
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
      const supabase = getSupabaseClient();
      if (!supabase) return [];
      let query = supabase
        .from('contratos')
        .select('id, cliente_id, modalidade, status, valor_principal, valor_parcela, numero_parcelas, taxa_juros, tipo_taxa, data_inicio, "createdAt", clientes!inner(nome)')
        .order('createdAt', { ascending: false });
      if (input?.status) query = query.eq('status', input.status);
      if (input?.modalidade) query = query.eq('modalidade', input.modalidade);
      if (input?.clienteId) query = query.eq('cliente_id', input.clienteId);
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

  byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select({
      contrato: contratos,
      clienteNome: clientes.nome,
      clienteWhatsapp: clientes.whatsapp,
      clienteChavePix: clientes.chavePix,
    }).from(contratos)
      .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
      .where(eq(contratos.id, input.id)).limit(1);
    return rows[0] ?? null;
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
      multaAtraso: z.number().default(2),
      jurosMoraDiario: z.number().default(0.033),
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
        const supabaseForKoletor = getSupabaseClient();
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
      let contratoId: number;

      if (db) {
        try {
          const totalContrato = (valorParcela * input.numeroParcelas).toFixed(2);
          const result = await db.insert(contratos).values({
            clienteId: input.clienteId,
            koletorId: koletorId ?? undefined,
            modalidade: input.modalidade as any,
            valorPrincipal: input.valorPrincipal.toFixed(2),
            taxaJuros: input.taxaJuros.toFixed(4),
            tipoTaxa: input.tipoTaxa as any,
            numeroParcelas: input.numeroParcelas,
            valorParcela: valorParcela.toFixed(2),
            totalContrato,
            multaAtraso: input.multaAtraso.toFixed(4),
            jurosMoraDiario: input.jurosMoraDiario.toFixed(4),
            dataInicio: input.dataInicio,
            dataVencimentoPrimeira: input.dataVencimentoPrimeira,
            diaVencimento: input.diaVencimento,
            descricao: input.descricao,
            observacoes: input.observacoes,
            contaCaixaId: input.contaCaixaId,
          }).returning({ id: contratos.id });
          contratoId = result[0].id;

          // Gerar parcelas via Drizzle
          const primeiraData = new Date(input.dataVencimentoPrimeira + 'T00:00:00');
          const hoje2 = new Date(); hoje2.setHours(0, 0, 0, 0);
          for (let i = 0; i < input.numeroParcelas; i++) {
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
          console.error('[contratos.create] Drizzle failed, falling back to REST:', (err as Error).message);
          resetDb();
        }
      }

      // ── Fallback: Supabase REST API ──────────────────────────────────────────
      const supabase = getSupabaseClient();
      if (!supabase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });

      const totalContratoRest = parseFloat((valorParcela * input.numeroParcelas).toFixed(2));
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
          multa_atraso: parseFloat(input.multaAtraso.toFixed(4)),
          juros_mora_diario: parseFloat(input.jurosMoraDiario.toFixed(4)),
          data_inicio: input.dataInicio,
          data_vencimento_primeira: input.dataVencimentoPrimeira,
          dia_vencimento: input.diaVencimento ?? null,
          descricao: input.descricao ?? null,
          observacoes: input.observacoes ?? null,
          conta_caixa_id: input.contaCaixaId ?? null,
          status: 'ativo',
        })
        .select('id')
        .single();
      if (contratoErr || !contratoData) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: contratoErr?.message ?? 'Erro ao criar contrato' });
      contratoId = contratoData.id;

      // Gerar parcelas via REST
      const primeiraData = new Date(input.dataVencimentoPrimeira + 'T00:00:00');
      const hoje2 = new Date(); hoje2.setHours(0, 0, 0, 0);
      const parcelasPayload = [];
      for (let i = 0; i < input.numeroParcelas; i++) {
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
          data_vencimento: dataVenc.toISOString().split('T')[0],
          status,
          conta_caixa_id: input.contaCaixaId ?? null,
        });
      }
      const { error: parcelasErr } = await supabase.from('parcelas').insert(parcelasPayload);
      if (parcelasErr) console.error('[contratos.create] Erro ao criar parcelas via REST:', parcelasErr.message);

      return { id: contratoId, valorParcela };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(['ativo', 'quitado', 'inadimplente', 'cancelado']) }))
     .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(contratos).set({ status: input.status }).where(eq(contratos.id, input.id));
      return { success: true };
    }),
  gerarPDF: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Buscar dados completos do contrato
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
        tabela_price: 'Tabela Price',
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
    }).optional())
    .query(async ({ input }) => {
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
          }).from(parcelas)
            .innerJoin(clientes, eq(parcelas.clienteId, clientes.id))
            .innerJoin(contratos, eq(parcelas.contratoId, contratos.id))
            .orderBy(parcelas.dataVencimento);

          return rows.filter(r => {
            if (input?.status && r.status !== input.status) return false;
            if (input?.clienteId && r.clienteId !== input.clienteId) return false;
            if (input?.contratoId && r.contratoId !== input.contratoId) return false;
            return true;
          });
        } catch (err) {
          console.warn('[parcelas.list] Drizzle failed, trying REST:', (err as Error).message);
          resetDb();
        }
      }

      // Fallback: Supabase REST
      const supabase = getSupabaseClient();
      if (!supabase) return [];

      // Atualizar status via REST
      await supabase.from('parcelas').update({ status: 'atrasada' })
        .lt('data_vencimento', hoje).in('status', ['pendente', 'vencendo_hoje']);
      await supabase.from('parcelas').update({ status: 'vencendo_hoje' })
        .eq('data_vencimento', hoje).eq('status', 'pendente');

      let pQuery = supabase.from('parcelas')
        .select('id, contrato_id, cliente_id, numero_parcela, valor_original, valor_pago, valor_juros, valor_multa, data_vencimento, data_pagamento, status')
        .order('data_vencimento');

      if (input?.status) pQuery = (pQuery as any).eq('status', input.status);
      if (input?.clienteId) pQuery = (pQuery as any).eq('cliente_id', input.clienteId);
      if (input?.contratoId) pQuery = (pQuery as any).eq('contrato_id', input.contratoId);

      const { data: pData, error: pError } = await pQuery;
      if (pError) { console.error('[parcelas.list] REST error:', pError.message); return []; }
      const parcelasData = pData || [];

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

      return parcelasData.map((r: any) => ({
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
      contaCaixaId: z.number(),
      observacoes: z.string().optional(),
      desconto: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const parcelaRows = await db.select().from(parcelas).where(eq(parcelas.id, input.parcelaId)).limit(1);
      const parcela = parcelaRows[0];
      if (!parcela) throw new Error("Parcela não encontrada");

      const { juros, multa } = calcularJurosMora(
        parseFloat(parcela.valorOriginal),
        new Date(parcela.dataVencimento + 'T00:00:00'),
        new Date()
      );

      const valorOriginal = parseFloat(parcela.valorOriginal);
      const novoStatus = input.valorPago >= valorOriginal ? 'paga' : 'parcial';

      await db.update(parcelas).set({
        valorPago: input.valorPago.toFixed(2),
        valorJuros: juros.toFixed(2),
        valorMulta: multa.toFixed(2),
        valorDesconto: input.desconto.toFixed(2),
        dataPagamento: new Date(),
        status: novoStatus,
        contaCaixaId: input.contaCaixaId,
        observacoes: input.observacoes,
      }).where(eq(parcelas.id, input.parcelaId));

      // Registrar entrada no caixa
      await db.insert(transacoesCaixa).values({
        contaCaixaId: input.contaCaixaId,
        tipo: 'entrada',
        categoria: 'pagamento_parcela',
        valor: input.valorPago.toFixed(2),
        descricao: `Pagamento parcela #${parcela.numeroParcela} - Contrato #${parcela.contratoId}`,
        parcelaId: input.parcelaId,
        contratoId: parcela.contratoId,
        clienteId: parcela.clienteId,
      });

      // Verificar se contrato foi quitado
      const parcelasPendentes = await db.select({ qtd: sql<number>`COUNT(*)` })
        .from(parcelas)
        .where(and(
          eq(parcelas.contratoId, parcela.contratoId),
          inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje', 'parcial'])
        ));
      if ((parcelasPendentes[0]?.qtd ?? 0) === 0) {
        await db.update(contratos).set({ status: 'quitado' }).where(eq(contratos.id, parcela.contratoId));
      }

      return { success: true, status: novoStatus };
    }),

  // Pagar apenas os juros do período e renovar a parcela por mais um período
  pagarJuros: protectedProcedure
    .input(z.object({
      parcelaId: z.number(),
      valorJurosPago: z.number().positive(),
      contaCaixaId: z.number(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();

      // Buscar parcela
      const fetchParcela = async () => {
        if (db) {
          const rows = await db.select().from(parcelas).where(eq(parcelas.id, input.parcelaId)).limit(1);
          return rows[0] ?? null;
        }
        const supabase = getSupabaseClient();
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
        const supabase = getSupabaseClient();
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
      const diasIntervalo = getDiasModalidade(contrato.tipoTaxa ?? contrato.modalidade);
      const dataVencAtual = new Date(String(parcela.dataVencimento) + 'T00:00:00');
      const novaDataVenc = new Date(dataVencAtual);
      novaDataVenc.setDate(novaDataVenc.getDate() + diasIntervalo);
      const novaDataVencStr = novaDataVenc.toISOString().split('T')[0];

      // Marcar parcela atual como "paga" (juros pagos = renovação)
      const hoje = new Date();
      if (db) {
        await db.update(parcelas).set({
          valorPago: input.valorJurosPago.toFixed(2),
          dataPagamento: hoje,
          status: 'paga' as const,
          observacoes: input.observacoes ?? 'Pagamento de juros - renovado',
          contaCaixaId: input.contaCaixaId,
        }).where(eq(parcelas.id, input.parcelaId));

        // Registrar entrada no caixa
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

        // Criar nova parcela com o mesmo valor original e nova data
        await db.insert(parcelas).values({
          contratoId: parcela.contratoId as number,
          clienteId: parcela.clienteId as number,
          koletorId: parcela.koletorId ?? undefined,
          numeroParcela: (parcela.numeroParcela as number) + 1,
          valorOriginal: String(parcela.valorOriginal),
          dataVencimento: novaDataVencStr,
          status: 'pendente' as const,
          contaCaixaId: input.contaCaixaId,
        });

        // Atualizar numeroParcelas do contrato
        await db.update(contratos)
          .set({ numeroParcelas: sql`numero_parcelas + 1` })
          .where(eq(contratos.id, parcela.contratoId));

      } else {
        // Fallback REST
        const supabase = getSupabaseClient();
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
          cliente_id: parcela.clienteId,
        });

        await supabase.from('parcelas').insert({
          contrato_id: parcela.contratoId,
          cliente_id: parcela.clienteId,
          koletor_id: parcela.koletorId ?? null,
          numero_parcela: (parcela.numeroParcela as number) + 1,
          valor_original: parseFloat(String(parcela.valorOriginal)),
          data_vencimento: novaDataVencStr,
          status: 'pendente',
          conta_caixa_id: input.contaCaixaId,
        });

        await supabase.from('contratos')
          .update({ numero_parcelas: (contrato.numeroParcelas as number) + 1 })
          .eq('id', parcela.contratoId);
      }

      return { success: true, novaDataVencimento: novaDataVencStr };
    }),
});

// ─── CAIXA ───────────────────────────────────────────────────────────────────
const caixaRouter = router({
  contas: protectedProcedure.query(async () => {
    const db = await getDb();
    if (db) {
      try {
        const contas = await db.select().from(contasCaixa).where(eq(contasCaixa.ativa, true));
        const result = [];
        for (const conta of contas) {
          const entradas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
            .from(transacoesCaixa)
            .where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, 'entrada')));
          const saidas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
            .from(transacoesCaixa)
            .where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, 'saida')));
          const saldo = parseFloat(conta.saldoInicial) + parseFloat(entradas[0]?.total ?? '0') - parseFloat(saidas[0]?.total ?? '0');
          result.push({ ...conta, saldoAtual: saldo });
        }
        return result;
      } catch (err) {
        console.warn('[caixa.contas] Drizzle failed:', (err as Error).message);
        resetDb();
      }
    }
    // Fallback REST
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data: contasData } = await supabase.from('contas_caixa').select('*').eq('ativo', true);
    const result2 = [];
    for (const conta of (contasData || [])) {
      result2.push({
        id: conta.id,
        nome: conta.nome,
        tipo: conta.tipo,
        banco: conta.banco ?? null,
        saldoInicial: conta.saldo ?? 0,
        saldoAtual: parseFloat(conta.saldo ?? 0),
        ativa: conta.ativo,
      });
    }
    return result2;
  }),

  transacoes: protectedProcedure
    .input(z.object({ contaCaixaId: z.number().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
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
            .where(input?.contaCaixaId ? eq(transacoesCaixa.contaCaixaId, input.contaCaixaId) : undefined)
            .orderBy(desc(transacoesCaixa.dataTransacao))
            .limit(input?.limit ?? 50);
          return rows;
        } catch (err) {
          console.warn('[caixa.transacoes] Drizzle failed:', (err as Error).message);
          resetDb();
        }
      }
      // Fallback REST
      const supabase = getSupabaseClient();
      if (!supabase) return [];
      let txQuery = supabase
        .from('transacoes_caixa')
        .select('id, conta_caixa_id, tipo, categoria, valor, descricao, data_transacao')
        .order('data_transacao', { ascending: false })
        .limit(input?.limit ?? 50);
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
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (db) {
        try {
          const result = await db.insert(contasCaixa).values({
            nome: input.nome,
            tipo: input.tipo,
            banco: input.banco,
            saldoInicial: input.saldoInicial.toFixed(2),
          }).returning({ id: contasCaixa.id });
          return { id: result[0].id };
        } catch (err) {
          console.warn('[caixa.criarConta] Drizzle failed:', (err as Error).message);
          resetDb();
        }
      }
      // Fallback REST
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('DB unavailable');
      const { data, error } = await supabase.from('contas_caixa').insert({
        nome: input.nome,
        tipo: input.tipo,
        saldo: input.saldoInicial,
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
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (db) {
        try {
          await db.insert(transacoesCaixa).values({
            contaCaixaId: input.contaCaixaId,
            tipo: input.tipo,
            categoria: input.categoria,
            valor: input.valor.toFixed(2),
            descricao: input.descricao,
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
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('DB unavailable');
      const { error: txErr } = await supabase.from('transacoes_caixa').insert({
        conta_caixa_id: input.contaCaixaId,
        tipo: input.tipo,
        categoria: input.categoria,
        valor: input.valor,
        descricao: input.descricao ?? null,
        data_transacao: new Date().toISOString(),
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
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const token = nanoid(48);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await db.insert(magicLinks).values({
        clienteId: input.clienteId,
        token,
        expiresAt,
      });
      const url = `${input.origin}/portal/${token}`;
      return { url, token };
    }),

  acessar: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const links = await db.select().from(magicLinks).where(eq(magicLinks.token, input.token)).limit(1);
      const link = links[0];
      if (!link) throw new Error("Link inválido");
      if (link.usado) throw new Error("Link já utilizado");
      if (new Date() > link.expiresAt) throw new Error("Link expirado");

      const clienteRows = await db.select().from(clientes).where(eq(clientes.id, link.clienteId)).limit(1);
      const cliente = clienteRows[0];
      if (!cliente) throw new Error("Cliente não encontrado");

      const parcelasCliente = await db.select().from(parcelas)
        .where(and(
          eq(parcelas.clienteId, link.clienteId),
          inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje', 'parcial'])
        ))
        .orderBy(parcelas.dataVencimento).limit(10);

      return {
        cliente: { nome: cliente.nome, chavePix: cliente.chavePix, tipoChavePix: cliente.tipoChavePix },
        parcelas: parcelasCliente,
      };
    }),
});

// ─── TEMPLATES WHATSAPP ───────────────────────────────────────────────────────
const whatsappRouter = router({
  templates: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(templatesWhatsapp).where(eq(templatesWhatsapp.ativo, true));
  }),

  gerarMensagem: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      parcelaId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const templateRows = await db.select().from(templatesWhatsapp).where(eq(templatesWhatsapp.id, input.templateId)).limit(1);
      const template = templateRows[0];
      if (!template) throw new Error("Template não encontrado");

      const parcelaRows = await db.select({
        parcela: parcelas,
        clienteNome: clientes.nome,
        clienteWhatsapp: clientes.whatsapp,
        clienteChavePix: clientes.chavePix,
        numeroParcelas: contratos.numeroParcelas,
      }).from(parcelas)
        .innerJoin(clientes, eq(parcelas.clienteId, clientes.id))
        .innerJoin(contratos, eq(parcelas.contratoId, contratos.id))
        .where(eq(parcelas.id, input.parcelaId)).limit(1);
      const row = parcelaRows[0];
      if (!row) throw new Error("Parcela não encontrada");

      const { total } = calcularJurosMora(
        parseFloat(row.parcela.valorOriginal),
        new Date(row.parcela.dataVencimento + 'T00:00:00'),
        new Date()
      );

      const dataFormatada = new Date(row.parcela.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR');
      const valorFormatado = parseFloat(row.parcela.valorOriginal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const valorAtualizado = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      const mensagem = template.mensagem
        .replace(/\{\{nome\}\}/g, row.clienteNome)
        .replace(/\{\{valor\}\}/g, valorFormatado)
        .replace(/\{\{valor_atualizado\}\}/g, valorAtualizado)
        .replace(/\{\{data_vencimento\}\}/g, dataFormatada)
        .replace(/\{\{chave_pix\}\}/g, row.clienteChavePix ?? 'Consulte o credor')
        .replace(/\{\{numero_parcela\}\}/g, String(row.parcela.numeroParcela));

      const whatsappUrl = row.clienteWhatsapp
        ? `https://wa.me/55${row.clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`
        : null;

      return { mensagem, whatsappUrl, whatsapp: row.clienteWhatsapp };
    }),
});

// ─── RELATÓRIOS ───────────────────────────────────────────────────────────────
const relatoriosRouter = router({
  resumoGeral: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const totalContratos = await db.select({ qtd: sql<number>`COUNT(*)` }).from(contratos);
    const contratosAtivos = await db.select({ qtd: sql<number>`COUNT(*)` }).from(contratos).where(eq(contratos.status, 'ativo'));
    const totalClientes = await db.select({ qtd: sql<number>`COUNT(*)` }).from(clientes);
    const totalRecebido = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
      .from(transacoesCaixa).where(eq(transacoesCaixa.tipo, 'entrada'));
    const totalLiberado = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
      .from(transacoesCaixa).where(and(eq(transacoesCaixa.tipo, 'saida'), eq(transacoesCaixa.categoria, 'emprestimo_liberado')));
    const inadimplentes = await db.select({ total: sql<string>`COALESCE(SUM(valor_original), 0)`, qtd: sql<number>`COUNT(*)` })
      .from(parcelas).where(eq(parcelas.status, 'atrasada'));

    return {
      totalContratos: totalContratos[0]?.qtd ?? 0,
      contratosAtivos: contratosAtivos[0]?.qtd ?? 0,
      totalClientes: totalClientes[0]?.qtd ?? 0,
      totalRecebido: parseFloat(totalRecebido[0]?.total ?? '0'),
      totalLiberado: parseFloat(totalLiberado[0]?.total ?? '0'),
      totalInadimplente: parseFloat(inadimplentes[0]?.total ?? '0'),
      qtdInadimplentes: inadimplentes[0]?.qtd ?? 0,
    };
  }),
});

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────
const configuracoesRouter = router({
  get: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(configuracoes);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.chave] = r.valor ?? '';
    return {
      nomeEmpresa: map['nomeEmpresa'] ?? '',
      cnpjEmpresa: map['cnpjEmpresa'] ?? '',
      telefoneEmpresa: map['telefoneEmpresa'] ?? '',
      enderecoEmpresa: map['enderecoEmpresa'] ?? '',
      assinaturaWhatsapp: map['assinaturaWhatsapp'] ?? '',
      fechamentoWhatsapp: map['fechamentoWhatsapp'] ?? '',
      multaPadrao: parseFloat(map['multaPadrao'] ?? '2'),
      jurosMoraDiario: parseFloat(map['jurosMoraDiario'] ?? '0.033'),
      diasLembrete: parseInt(map['diasLembrete'] ?? '3'),
    };
  }),
  save: protectedProcedure
    .input(z.object({
      nomeEmpresa: z.string().optional(),
      cnpjEmpresa: z.string().optional(),
      telefoneEmpresa: z.string().optional(),
      enderecoEmpresa: z.string().optional(),
      assinaturaWhatsapp: z.string().optional(),
      fechamentoWhatsapp: z.string().optional(),
      multaPadrao: z.number().optional(),
      jurosMoraDiario: z.number().optional(),
      diasLembrete: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const entries = Object.entries(input).filter(([, v]) => v !== undefined);
      for (const [chave, valor] of entries) {
        await db.insert(configuracoes)
          .values({ chave, valor: String(valor) })
          .onConflictDoUpdate({ target: configuracoes.chave, set: { valor: String(valor) } });
      }
      return { success: true };
    }),
  templates: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(templatesWhatsapp);
  }),

  updateTemplate: protectedProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().optional(),
      mensagem: z.string().optional(),
      ativo: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...data } = input;
      await db.update(templatesWhatsapp).set(data).where(eq(templatesWhatsapp.id, id));
      return { success: true };
    }),
});

// ─── KOLETORES ──────────────────────────────────────────────────────────────
const koletoresRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    return db.select().from(koletores).orderBy(desc(koletores.createdAt));
  }),

  create: protectedProcedure
    .input(z.object({
      nome: z.string().min(2),
      email: z.string().email().optional().or(z.literal('')),
      telefone: z.string().optional(),
      whatsapp: z.string().optional(),
      perfil: z.enum(['admin', 'gerente', 'koletor']).default('koletor'),
      limiteEmprestimo: z.number().default(0),
      comissaoPercentual: z.number().default(0),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const result = await db.insert(koletores).values({
        nome: input.nome,
        email: input.email || null,
        telefone: input.telefone || null,
        whatsapp: input.whatsapp || null,
        perfil: input.perfil,
        limiteEmprestimo: input.limiteEmprestimo.toString(),
        comissaoPercentual: input.comissaoPercentual.toString(),
        observacoes: input.observacoes || null,
      }).returning({ id: koletores.id });
      return { id: result[0].id, success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().optional(),
      email: z.string().optional(),
      telefone: z.string().optional(),
      whatsapp: z.string().optional(),
      perfil: z.enum(['admin', 'gerente', 'koletor']).optional(),
      limiteEmprestimo: z.number().optional(),
      comissaoPercentual: z.number().optional(),
      ativo: z.boolean().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, limiteEmprestimo, comissaoPercentual, ...rest } = input;
      const updateData: any = { ...rest };
      if (limiteEmprestimo !== undefined) updateData.limiteEmprestimo = limiteEmprestimo.toString();
      if (comissaoPercentual !== undefined) updateData.comissaoPercentual = comissaoPercentual.toString();
      await db.update(koletores).set(updateData).where(eq(koletores.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(koletores).set({ ativo: false }).where(eq(koletores.id, input.id));
      return { success: true };
    }),

  performance: protectedProcedure
    .input(z.object({
      mes: z.number().optional(),
      ano: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const ano = input.ano ?? new Date().getFullYear();
      const mes = input.mes ?? new Date().getMonth() + 1;
      const inicioMes = new Date(ano, mes - 1, 1);
      const fimMes = new Date(ano, mes, 0, 23, 59, 59);

      const todosKoletores = await db.select().from(koletores).where(eq(koletores.ativo, true));

      const resultado = await Promise.all(todosKoletores.map(async (k) => {
        const contratosKoletor = await db.select({ qtd: sql<number>`COUNT(*)`, total: sql<string>`COALESCE(SUM(valor_principal), 0)` })
          .from(contratos)
          .where(and(
            eq(contratos.koletorId, k.id),
            gte(contratos.createdAt, inicioMes),
            lte(contratos.createdAt, fimMes)
          ));

        const recebidoKoletor = await db.select({ total: sql<string>`COALESCE(SUM(valor_pago), 0)` })
          .from(parcelas)
          .where(and(
            eq(parcelas.koletorId, k.id),
            eq(parcelas.status, 'paga'),
            gte(parcelas.dataPagamento, inicioMes),
            lte(parcelas.dataPagamento, fimMes)
          ));

        const inadimplentesKoletor = await db.select({ qtd: sql<number>`COUNT(*)`, total: sql<string>`COALESCE(SUM(valor_original), 0)` })
          .from(parcelas)
          .where(and(
            eq(parcelas.koletorId, k.id),
            eq(parcelas.status, 'atrasada')
          ));

        const totalEmprestado = parseFloat(contratosKoletor[0]?.total ?? '0');
        const totalRecebido = parseFloat(recebidoKoletor[0]?.total ?? '0');
        const totalInadimplente = parseFloat(inadimplentesKoletor[0]?.total ?? '0');
        const comissao = totalRecebido * (parseFloat(k.comissaoPercentual ?? '0') / 100);

        return {
          koletor: k,
          qtdContratos: contratosKoletor[0]?.qtd ?? 0,
          totalEmprestado,
          totalRecebido,
          totalInadimplente,
          qtdInadimplentes: inadimplentesKoletor[0]?.qtd ?? 0,
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
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Buscar parcelas em aberto do contrato
      const parcelasAbertas = await db.select().from(parcelas)
        .where(and(
          eq(parcelas.contratoId, input.contratoId),
          inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje', 'parcial'])
        ));

      const hoje = new Date();
      let saldoDevedor = 0;
      for (const p of parcelasAbertas) {
        const valorBase = parseFloat(p.valorOriginal) - parseFloat(p.valorPago ?? '0');
        let multa = 0;
        let juros = 0;
        if (input.incluirMultas && p.status === 'atrasada') {
          const vencDate = new Date(String(p.dataVencimento) + 'T00:00:00');
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
        qtdParcelasAbertas: parcelasAbertas.length,
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
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Buscar contrato original
      const [contratoOriginal] = await db.select().from(contratos).where(eq(contratos.id, input.contratoId));
      if (!contratoOriginal) throw new Error("Contrato não encontrado");

      // Buscar parcelas em aberto
      const parcelasAbertas = await db.select().from(parcelas)
        .where(and(
          eq(parcelas.contratoId, input.contratoId),
          inArray(parcelas.status, ['pendente', 'atrasada', 'vencendo_hoje', 'parcial'])
        ));

      const hoje = new Date();
      let saldoDevedor = 0;
      for (const p of parcelasAbertas) {
        const valorBase = parseFloat(p.valorOriginal) - parseFloat(p.valorPago ?? '0');
        let multa = 0;
        let juros = 0;
        if (input.incluirMultas && p.status === 'atrasada') {
          const vencDate = new Date(String(p.dataVencimento) + 'T00:00:00');
          const resultado = calcularJurosMora(valorBase, vencDate, hoje, 0.033, 2);
          multa = resultado.multa;
          juros = resultado.juros;
        }
        saldoDevedor += valorBase + multa + juros;
      }

      // Cancelar parcelas abertas do contrato original
      for (const p of parcelasAbertas) {
        await db.update(parcelas).set({ status: 'paga', observacoes: 'Reparcelado' }).where(eq(parcelas.id, p.id));
      }

      // Cancelar contrato original
      await db.update(contratos).set({ status: 'quitado' }).where(eq(contratos.id, input.contratoId));

      // Criar novo contrato de reparcelamento
      const valorNovaParcela2 = calcularParcelaPadrao(saldoDevedor, input.taxaJuros, input.numeroParcelas);
      const dataInicioDate = new Date(input.dataInicio);
      const dataInicioStr = dataInicioDate.toISOString().split('T')[0];

      // Use REST fallback for reparcelamento to avoid Drizzle TS issues
      const supabaseRep = getSupabaseClient();
      if (!supabaseRep) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { data: novoContrato, error: novoContratoErr } = await supabaseRep
        .from('contratos')
        .insert({
          cliente_id: contratoOriginal.clienteId as number,
          koletor_id: contratoOriginal.koletorId ?? null,
          modalidade: 'reparcelamento',
          status: 'ativo',
          valor_principal: saldoDevedor.toFixed(2),
          taxa_juros: input.taxaJuros.toFixed(4),
          tipo_taxa: input.tipoTaxa,
          numero_parcelas: input.numeroParcelas,
          valor_parcela: valorNovaParcela2.toFixed(2),
          total_contrato: (valorNovaParcela2 * input.numeroParcelas).toFixed(2),
          multa_atraso: contratoOriginal.multaAtraso ?? '2.00',
          juros_mora_diario: contratoOriginal.jurosMoraDiario ?? '0.033',
          data_inicio: dataInicioDate.toISOString().split('T')[0],
          data_vencimento_primeira: dataInicioDate.toISOString().split('T')[0],
          contrato_origem_id: input.contratoId,
          observacoes: input.observacoes || `Reparcelamento do contrato #${input.contratoId}`,
        })
        .select('id')
        .single();
      if (novoContratoErr || !novoContrato) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: novoContratoErr?.message ?? 'Failed to create reparcelamento' });
      const novoContratoId = novoContrato.id;

      // Criar novas parcelas
      for (let i = 0; i < input.numeroParcelas; i++) {
        const venc = new Date(dataInicioDate);
        venc.setMonth(venc.getMonth() + i);
        await db.insert(parcelas).values({
          contratoId: novoContratoId,
          clienteId: contratoOriginal.clienteId as number,
          koletorId: contratoOriginal.koletorId ?? undefined,
          numeroParcela: i + 1,
          valorOriginal: valorNovaParcela2.toFixed(2),
          dataVencimento: venc.toISOString().split('T')[0],
          status: 'pendente' as const,
        });
      }
      return { success: true, novoContratoId };;
    }),
});

// ─── CONTAS A PAGAR ──────────────────────────────────────────────────────────
const contasPagarRouter = router({
  listar: protectedProcedure
    .input(z.object({
      status: z.enum(['pendente', 'paga', 'atrasada', 'cancelada', 'todos']).optional(),
      categoria: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      let query = db.select().from(contasPagar).$dynamic();
      const conditions = [];
      if (input?.status && input.status !== 'todos') {
        conditions.push(eq(contasPagar.status, input.status as 'pendente' | 'paga' | 'atrasada' | 'cancelada'));
      }
      if (input?.categoria) {
        conditions.push(eq(contasPagar.categoria, input.categoria as 'aluguel' | 'salario' | 'servicos' | 'impostos' | 'fornecedores' | 'marketing' | 'tecnologia' | 'outros'));
      }
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      return query.orderBy(desc(contasPagar.dataVencimento));
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
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const result = await db.insert(contasPagar).values({
        descricao: input.descricao,
        categoria: input.categoria,
        valor: String(input.valor),
        dataVencimento: input.dataVencimento,
        recorrente: input.recorrente ?? false,
        periodicidade: input.periodicidade ?? 'unica',
        observacoes: input.observacoes,
        contaCaixaId: input.contaCaixaId,
        status: 'pendente',
      }).returning({ id: contasPagar.id });
      return { success: true, id: result[0].id };
    }),

  pagar: protectedProcedure
    .input(z.object({
      id: z.number(),
      contaCaixaId: z.number().optional(),
      dataPagamento: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const conta = await db.select().from(contasPagar).where(eq(contasPagar.id, input.id)).limit(1);
      if (!conta[0]) throw new Error('Conta não encontrada');
      const dataPag = input.dataPagamento ? new Date(input.dataPagamento) : new Date();
      await db.update(contasPagar).set({
        status: 'paga',
        dataPagamento: dataPag,
        contaCaixaId: input.contaCaixaId,
      }).where(eq(contasPagar.id, input.id));
      // Registrar saída no caixa
      if (input.contaCaixaId) {
        await db.insert(transacoesCaixa).values({
          contaCaixaId: input.contaCaixaId,
          tipo: 'saida',
          categoria: 'despesa_operacional',
          valor: conta[0].valor,
          descricao: `Pagamento: ${conta[0].descricao}`,
          dataTransacao: dataPag,
        });
      }
      return { success: true };
    }),

  cancelar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.update(contasPagar).set({ status: 'cancelada' }).where(eq(contasPagar.id, input.id));
      return { success: true };
    }),

  excluir: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.delete(contasPagar).where(eq(contasPagar.id, input.id));
      return { success: true };
    }),

  resumo: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('DB unavailable');
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];
    const pendentes = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)`, qtd: sql<number>`COUNT(*)` })
      .from(contasPagar).where(eq(contasPagar.status, 'pendente'));
    const atrasadas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)`, qtd: sql<number>`COUNT(*)` })
      .from(contasPagar).where(eq(contasPagar.status, 'atrasada'));
    const pagas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)`, qtd: sql<number>`COUNT(*)` })
      .from(contasPagar).where(eq(contasPagar.status, 'paga'));
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
  listarProdutos: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(produtos).where(eq(produtos.ativo, true)).orderBy(desc(produtos.createdAt));
  }),

  criarProduto: protectedProcedure
    .input(z.object({
      nome: z.string().min(1),
      descricao: z.string().optional(),
      preco: z.number().positive(),
      estoque: z.number().int().min(0).default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const result = await db.insert(produtos).values({
        nome: input.nome,
        descricao: input.descricao,
        preco: input.preco.toFixed(2),
        estoque: input.estoque,
      }).returning({ id: produtos.id });
      return { success: true, id: result[0].id };
    }),

  atualizarEstoque: protectedProcedure
    .input(z.object({
      id: z.number(),
      estoque: z.number().int().min(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.update(produtos).set({ estoque: input.estoque }).where(eq(produtos.id, input.id));
      return { success: true };
    }),

  desativarProduto: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.update(produtos).set({ ativo: false }).where(eq(produtos.id, input.id));
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
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select({
        id: cheques.id,
        clienteId: cheques.clienteId,
        clienteNome: clientes.nome,
        numeroCheque: cheques.numeroCheque,
        banco: cheques.banco,
        emitente: cheques.emitente,
        cpfCnpjEmitente: cheques.cpfCnpjEmitente,
        valorNominal: cheques.valorNominal,
        dataVencimento: cheques.dataVencimento,
        taxaDesconto: cheques.taxaDesconto,
        tipoTaxa: cheques.tipoTaxa,
        valorDesconto: cheques.valorDesconto,
        valorLiquido: cheques.valorLiquido,
        status: cheques.status,
        contaCaixaId: cheques.contaCaixaId,
        dataCompensacao: cheques.dataCompensacao,
        motivoDevolucao: cheques.motivoDevolucao,
        observacoes: cheques.observacoes,
        createdAt: cheques.createdAt,
      })
        .from(cheques)
        .leftJoin(clientes, eq(cheques.clienteId, clientes.id))
        .orderBy(desc(cheques.createdAt));
      const conditions: any[] = [];
      if (input?.status && input.status !== 'todos') {
        conditions.push(eq(cheques.status, input.status as 'aguardando' | 'compensado' | 'devolvido' | 'cancelado'));
      }
      if (input?.clienteId) {
        conditions.push(eq(cheques.clienteId, input.clienteId));
      }
      if (conditions.length > 0) {
        return rows.filter(r => {
          if (input?.status && input.status !== 'todos' && r.status !== input.status) return false;
          if (input?.clienteId && r.clienteId !== input.clienteId) return false;
          return true;
        });
      }
      return rows;
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
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
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
      const result = await db.insert(cheques).values({
        clienteId: input.clienteId,
        numeroCheque: input.numeroCheque,
        banco: input.banco,
        agencia: input.agencia,
        conta: input.conta,
        emitente: input.emitente,
        cpfCnpjEmitente: input.cpfCnpjEmitente,
        valorNominal: input.valorNominal.toFixed(2),
        dataVencimento: dataVenc.toISOString().split('T')[0],
        taxaDesconto: input.taxaDesconto.toFixed(4),
        tipoTaxa: input.tipoTaxa as 'diaria' | 'mensal' | 'anual',
        valorDesconto: valorDesconto.toFixed(2),
        valorLiquido: valorLiquido.toFixed(2),
        contaCaixaId: input.contaCaixaId,
        observacoes: input.observacoes,
        status: 'aguardando',
      }).returning({ id: cheques.id });
      // Registrar saída no caixa (valor líquido liberado)
      if (input.contaCaixaId) {
        await db.insert(transacoesCaixa).values({
          contaCaixaId: input.contaCaixaId,
          tipo: 'saida',
          categoria: 'outros',
          valor: valorLiquido.toFixed(2),
          descricao: `Desconto de cheque - ${input.emitente} (vence ${input.dataVencimento})`,
          dataTransacao: new Date(),
        });
      }
      return { success: true, id: result[0].id, valorLiquido, valorDesconto };
    }),

  compensar: protectedProcedure
    .input(z.object({
      id: z.number(),
      contaCaixaId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const cheque = await db.select().from(cheques).where(eq(cheques.id, input.id)).limit(1);
      if (!cheque[0]) throw new Error('Cheque não encontrado');
      await db.update(cheques).set({
        status: 'compensado',
        dataCompensacao: new Date(),
        contaCaixaId: input.contaCaixaId ?? cheque[0].contaCaixaId,
      }).where(eq(cheques.id, input.id));
      // Registrar entrada no caixa (valor nominal recebido)
      const contaId = input.contaCaixaId ?? cheque[0].contaCaixaId;
      if (contaId) {
        await db.insert(transacoesCaixa).values({
          contaCaixaId: contaId,
          tipo: 'entrada',
          categoria: 'outros',
          valor: cheque[0].valorNominal,
          descricao: `Cheque compensado - ${cheque[0].emitente}`,
          dataTransacao: new Date(),
        });
      }
      return { success: true };
    }),

  devolver: protectedProcedure
    .input(z.object({
      id: z.number(),
      motivo: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.update(cheques).set({
        status: 'devolvido',
        motivoDevolucao: input.motivo,
      }).where(eq(cheques.id, input.id));
      return { success: true };
    }),

  cancelar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.update(cheques).set({ status: 'cancelado' }).where(eq(cheques.id, input.id));
      return { success: true };
    }),

  resumo: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('DB unavailable');
    const aguardando = await db.select({ total: sql<string>`COALESCE(SUM(valor_nominal), 0)`, qtd: sql<number>`COUNT(*)` })
      .from(cheques).where(eq(cheques.status, 'aguardando'));
    const compensados = await db.select({ total: sql<string>`COALESCE(SUM(valor_nominal), 0)`, qtd: sql<number>`COUNT(*)` })
      .from(cheques).where(eq(cheques.status, 'compensado'));
    const devolvidos = await db.select({ total: sql<string>`COALESCE(SUM(valor_nominal), 0)`, qtd: sql<number>`COUNT(*)` })
      .from(cheques).where(eq(cheques.status, 'devolvido'));
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
  koletores: koletoresRouter,
  reparcelamento: reparcelamentoRouter,
  contasPagar: contasPagarRouter,
  vendas: vendasRouter,
  cheques: chequesRouter,
});

export type AppRouter = typeof appRouter;
