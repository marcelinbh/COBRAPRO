import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  clientes, contratos, parcelas, contasCaixa, transacoesCaixa, magicLinks, templatesWhatsapp,
  koletores, configuracoes
} from "../drizzle/schema";
import { eq, and, sql, desc, gte, lte, lt, isNull, or, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { calcularJurosMora, calcularParcelaPadrao, calcularParcelasPrice } from "../shared/finance";

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
      if (!db) return [];
      const rows = await db.select().from(clientes)
        .where(input?.ativo !== undefined ? eq(clientes.ativo, input.ativo) : undefined)
        .orderBy(desc(clientes.createdAt));
      if (input?.busca) {
        const b = input.busca.toLowerCase();
        return rows.filter(c =>
          c.nome.toLowerCase().includes(b) ||
          (c.cpfCnpj ?? '').includes(b) ||
          (c.telefone ?? '').includes(b)
        );
      }
      return rows;
    }),

  byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(clientes).where(eq(clientes.id, input.id)).limit(1);
    return rows[0] ?? null;
  }),

  create: protectedProcedure
    .input(z.object({
      nome: z.string().min(2),
      cpfCnpj: z.string().optional(),
      telefone: z.string().optional(),
      whatsapp: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      chavePix: z.string().optional(),
      tipoChavePix: z.enum(['cpf', 'cnpj', 'email', 'telefone', 'aleatoria']).optional(),
      endereco: z.string().optional(),
      cidade: z.string().optional(),
      estado: z.string().optional(),
      cep: z.string().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const result = await db.insert(clientes).values({
        ...input,
        email: input.email || undefined,
      });
      return { id: Number((result as any).insertId) };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().min(2).optional(),
      cpfCnpj: z.string().optional(),
      telefone: z.string().optional(),
      whatsapp: z.string().optional(),
      email: z.string().optional(),
      chavePix: z.string().optional(),
      tipoChavePix: z.enum(['cpf', 'cnpj', 'email', 'telefone', 'aleatoria']).optional(),
      endereco: z.string().optional(),
      cidade: z.string().optional(),
      estado: z.string().optional(),
      cep: z.string().optional(),
      observacoes: z.string().optional(),
      score: z.number().min(0).max(1000).optional(),
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
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      modalidade: z.string().optional(),
      clienteId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
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
      modalidade: z.enum(['emprestimo_padrao', 'emprestimo_diario', 'tabela_price', 'venda_produto', 'desconto_cheque']),
      valorPrincipal: z.number().positive(),
      taxaJuros: z.number().min(0),
      tipoTaxa: z.enum(['mensal', 'diaria', 'anual']).default('mensal'),
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
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Calcular valor da parcela
      let valorParcela: number;
      if (input.modalidade === 'tabela_price') {
        valorParcela = calcularParcelasPrice(input.valorPrincipal, input.taxaJuros, input.numeroParcelas);
      } else {
        valorParcela = calcularParcelaPadrao(input.valorPrincipal, input.taxaJuros, input.numeroParcelas);
      }

      // Criar contrato
      const result = await db.insert(contratos).values({
        clienteId: input.clienteId,
        modalidade: input.modalidade,
        valorPrincipal: input.valorPrincipal.toFixed(2),
        taxaJuros: input.taxaJuros.toFixed(4),
        tipoTaxa: input.tipoTaxa,
        numeroParcelas: input.numeroParcelas,
        valorParcela: valorParcela.toFixed(2),
        multaAtraso: input.multaAtraso.toFixed(4),
        jurosMoraDiario: input.jurosMoraDiario.toFixed(4),
        dataInicio: new Date(input.dataInicio + 'T00:00:00'),
        dataVencimentoPrimeira: new Date(input.dataVencimentoPrimeira + 'T00:00:00'),
        diaVencimento: input.diaVencimento,
        descricao: input.descricao,
        observacoes: input.observacoes,
        contaCaixaId: input.contaCaixaId,
      });
      const contratoId = Number((result as any).insertId);

      // Gerar parcelas
      const primeiraData = new Date(input.dataVencimentoPrimeira + 'T00:00:00');
      const hoje2 = new Date();
      hoje2.setHours(0, 0, 0, 0);
      for (let i = 0; i < input.numeroParcelas; i++) {
        const dataVenc = new Date(primeiraData);
        if (i > 0) {
          if (input.tipoTaxa === 'diaria') {
            dataVenc.setDate(dataVenc.getDate() + i);
          } else {
            dataVenc.setMonth(dataVenc.getMonth() + i);
          }
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
          dataVencimento: dataVenc,
          status,
          contaCaixaId: input.contaCaixaId,
        });
      }

      // Registrar saída de caixa (capital liberado)
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
      if (!db) return [];

      // Atualizar status das parcelas atrasadas
      const hoje = new Date().toISOString().split('T')[0];
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
});

// ─── CAIXA ───────────────────────────────────────────────────────────────────
const caixaRouter = router({
  contas: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
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
  }),

  transacoes: protectedProcedure
    .input(z.object({ contaCaixaId: z.number().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
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
    }),

  criarConta: protectedProcedure
    .input(z.object({
      nome: z.string().min(2),
      tipo: z.enum(['caixa_fisico', 'banco', 'digital']),
      banco: z.string().optional(),
      saldoInicial: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const result = await db.insert(contasCaixa).values({
        nome: input.nome,
        tipo: input.tipo,
        banco: input.banco,
        saldoInicial: input.saldoInicial.toFixed(2),
      });
      return { id: Number((result as any).insertId) };
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
      if (!db) throw new Error("DB unavailable");
      await db.insert(transacoesCaixa).values({
        contaCaixaId: input.contaCaixaId,
        tipo: input.tipo,
        categoria: input.categoria,
        valor: input.valor.toFixed(2),
        descricao: input.descricao,
      });
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
          .onDuplicateKeyUpdate({ set: { valor: String(valor) } });
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
      });
      return { id: Number((result as any).insertId), success: true };
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
      tipoTaxa: z.enum(['mensal', 'diaria', 'anual']).default('mensal'),
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
          const vencDate = p.dataVencimento instanceof Date ? p.dataVencimento : new Date(String(p.dataVencimento) + 'T00:00:00');
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
      tipoTaxa: z.enum(['mensal', 'diaria', 'anual']).default('mensal'),
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
          const vencDate = p.dataVencimento instanceof Date ? p.dataVencimento : new Date(String(p.dataVencimento) + 'T00:00:00');
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

      const novoContrato = await db.insert(contratos).values({
        clienteId: contratoOriginal.clienteId,
        koletorId: contratoOriginal.koletorId ?? undefined,
        modalidade: 'reparcelamento',
        status: 'ativo',
        valorPrincipal: saldoDevedor.toFixed(2),
        taxaJuros: input.taxaJuros.toFixed(4),
        tipoTaxa: input.tipoTaxa,
        numeroParcelas: input.numeroParcelas,
        valorParcela: valorNovaParcela2.toFixed(2),
        multaAtraso: contratoOriginal.multaAtraso ?? undefined,
        jurosMoraDiario: contratoOriginal.jurosMoraDiario ?? undefined,
        dataInicio: dataInicioDate,
        dataVencimentoPrimeira: dataInicioDate,
        contratoOrigemId: input.contratoId,
        observacoes: input.observacoes || `Reparcelamento do contrato #${input.contratoId}`,
      });

      const novoContratoId = Number((novoContrato as any).insertId);

      // Criar novas parcelas
      for (let i = 0; i < input.numeroParcelas; i++) {
        const venc = new Date(dataInicioDate);
        venc.setMonth(venc.getMonth() + i);
        await db.insert(parcelas).values({
          contratoId: novoContratoId,
          clienteId: contratoOriginal.clienteId,
          koletorId: contratoOriginal.koletorId ?? undefined,
          numeroParcela: i + 1,
          valorOriginal: valorNovaParcela2.toFixed(2),
          dataVencimento: venc,
          status: 'pendente',
        });
      }

      return { success: true, novoContratoId };
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
});

export type AppRouter = typeof appRouter;
