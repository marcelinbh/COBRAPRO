import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { blacklist, blacklistFotos, type Blacklist, type BlacklistFoto } from "../../drizzle/schema";
import { eq, or, ilike, desc, and, sql } from "drizzle-orm";
import { storagePut } from "../storage";
import { TRPCError } from "@trpc/server";

function randomSuffix() {
  return Math.random().toString(36).substring(2, 10);
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
  return db;
}

export const blacklistRouter = router({
  // Criar novo registro na blacklist (qualquer assinante autenticado)
  criar: protectedProcedure
    .input(
      z.object({
        cpfCnpj: z.string().min(11, "CPF/CNPJ inválido").max(20),
        nome: z.string().min(2, "Nome obrigatório").max(255),
        telefone: z.string().max(20).optional(),
        email: z.string().optional(),
        endereco: z.string().max(300).optional(),
        numero: z.string().max(20).optional(),
        complemento: z.string().max(100).optional(),
        bairro: z.string().max(100).optional(),
        cidade: z.string().max(100).optional(),
        estado: z.string().max(2).optional(),
        cep: z.string().max(9).optional(),
        motivo: z.string().min(3, "Motivo obrigatório"),
        tipoDivida: z
          .enum(["emprestimo", "servico", "produto", "aluguel", "cheque", "outros"])
          .default("outros"),
        valorDivida: z.string().optional(),
        dataOcorrencia: z.string().optional(),
        observacoes: z.string().optional(),
        fotoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const empresa = ctx.user.nomeEmpresa ?? ctx.user.name ?? "Empresa não informada";

      const [registro] = await db
        .insert(blacklist)
        .values({
          cadastradoPorUserId: ctx.user.id,
          cadastradoPorEmpresa: empresa,
          cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
          nome: input.nome,
          telefone: input.telefone || null,
          email: input.email || null,
          endereco: input.endereco || null,
          numero: input.numero || null,
          complemento: input.complemento || null,
          bairro: input.bairro || null,
          cidade: input.cidade || null,
          estado: input.estado || null,
          cep: input.cep || null,
          motivo: input.motivo,
          tipoDivida: input.tipoDivida,
          valorDivida: input.valorDivida || null,
          dataOcorrencia: input.dataOcorrencia || null,
          observacoes: input.observacoes || null,
          fotoUrl: input.fotoUrl || null,
        })
        .returning();

      return registro;
    }),

  // Consultar por CPF/CNPJ ou nome (todos os assinantes podem ver)
  consultar: protectedProcedure
    .input(z.object({ busca: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const termo = input.busca.trim();
      const termoCpf = termo.replace(/\D/g, "");

      const registros = await db
        .select()
        .from(blacklist)
        .where(
          or(
            termoCpf.length >= 11 ? eq(blacklist.cpfCnpj, termoCpf) : undefined,
            ilike(blacklist.nome, `%${termo}%`),
            ilike(blacklist.cpfCnpj, `%${termoCpf}%`)
          )
        )
        .orderBy(desc(blacklist.createdAt))
        .limit(50);

      const ids = registros.map((r: Blacklist) => r.id);
      const fotos: BlacklistFoto[] =
        ids.length > 0
          ? await db
              .select()
              .from(blacklistFotos)
              .where(sql`${blacklistFotos.blacklistId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}])`)
          : [];

      return registros.map((r: Blacklist) => ({
        ...r,
        fotos: fotos.filter((f: BlacklistFoto) => f.blacklistId === r.id),
      }));
    }),

  // Listar todos os registros com paginação (todos os assinantes)
  listarTodos: protectedProcedure
    .input(
      z.object({
        pagina: z.number().min(1).default(1),
        porPagina: z.number().min(1).max(100).default(20),
        status: z.enum(["ativo", "resolvido", "em_negociacao", "todos"]).default("todos"),
        tipoDivida: z
          .enum(["emprestimo", "servico", "produto", "aluguel", "cheque", "outros", "todos"])
          .default("todos"),
      })
    )
    .query(async ({ input }) => {
      const db = await requireDb();
      const offset = (input.pagina - 1) * input.porPagina;

      const conditions = [];
      if (input.status !== "todos") {
        conditions.push(eq(blacklist.status, input.status as "ativo" | "resolvido" | "em_negociacao"));
      }
      if (input.tipoDivida !== "todos") {
        conditions.push(
          eq(
            blacklist.tipoDivida,
            input.tipoDivida as "emprestimo" | "servico" | "produto" | "aluguel" | "cheque" | "outros"
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [registros, totalResult] = await Promise.all([
        db
          .select()
          .from(blacklist)
          .where(whereClause)
          .orderBy(desc(blacklist.createdAt))
          .limit(input.porPagina)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(blacklist)
          .where(whereClause),
      ]);

      const total = totalResult[0]?.count ?? 0;

      return {
        registros,
        total,
        pagina: input.pagina,
        totalPaginas: Math.ceil(total / input.porPagina),
      };
    }),

  // Listar apenas os registros do usuário logado
  listarMeus: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();

    const registros = await db
      .select()
      .from(blacklist)
      .where(eq(blacklist.cadastradoPorUserId, ctx.user.id))
      .orderBy(desc(blacklist.createdAt));

    const ids = registros.map((r: Blacklist) => r.id);
    const fotos: BlacklistFoto[] =
      ids.length > 0
        ? await db
            .select()
            .from(blacklistFotos)
            .where(sql`${blacklistFotos.blacklistId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}])`)
        : [];

    return registros.map((r: Blacklist) => ({
      ...r,
      fotos: fotos.filter((f: BlacklistFoto) => f.blacklistId === r.id),
    }));
  }),

  // Buscar detalhe de um registro específico
  buscarPorId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();

      const [registro] = await db
        .select()
        .from(blacklist)
        .where(eq(blacklist.id, input.id))
        .limit(1);

      if (!registro) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado" });

      const fotos = await db
        .select()
        .from(blacklistFotos)
        .where(eq(blacklistFotos.blacklistId, input.id));

      return { ...registro, fotos };
    }),

  // Atualizar registro (somente quem cadastrou)
  atualizar: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        nome: z.string().min(2).max(255).optional(),
        telefone: z.string().max(20).optional(),
        email: z.string().optional(),
        endereco: z.string().max(300).optional(),
        numero: z.string().max(20).optional(),
        complemento: z.string().max(100).optional(),
        bairro: z.string().max(100).optional(),
        cidade: z.string().max(100).optional(),
        estado: z.string().max(2).optional(),
        cep: z.string().max(9).optional(),
        motivo: z.string().min(3).optional(),
        tipoDivida: z
          .enum(["emprestimo", "servico", "produto", "aluguel", "cheque", "outros"])
          .optional(),
        valorDivida: z.string().optional(),
        dataOcorrencia: z.string().optional(),
        status: z.enum(["ativo", "resolvido", "em_negociacao"]).optional(),
        observacoes: z.string().optional(),
        fotoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { id, ...dados } = input;

      const [existente] = await db
        .select({ cadastradoPorUserId: blacklist.cadastradoPorUserId })
        .from(blacklist)
        .where(eq(blacklist.id, id))
        .limit(1);

      if (!existente) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado" });
      if (existente.cadastradoPorUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem permissão para editar este registro" });
      }

      const [atualizado] = await db
        .update(blacklist)
        .set({ ...dados, updatedAt: new Date() })
        .where(eq(blacklist.id, id))
        .returning();

      return atualizado;
    }),

  // Deletar registro (somente quem cadastrou)
  deletar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      const [existente] = await db
        .select({ cadastradoPorUserId: blacklist.cadastradoPorUserId })
        .from(blacklist)
        .where(eq(blacklist.id, input.id))
        .limit(1);

      if (!existente) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado" });
      if (existente.cadastradoPorUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem permissão para deletar este registro" });
      }

      await db.delete(blacklist).where(eq(blacklist.id, input.id));
      return { sucesso: true };
    }),

  // Upload de foto adicional
  adicionarFoto: protectedProcedure
    .input(
      z.object({
        blacklistId: z.number(),
        fotoBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      const [existente] = await db
        .select({ cadastradoPorUserId: blacklist.cadastradoPorUserId })
        .from(blacklist)
        .where(eq(blacklist.id, input.blacklistId))
        .limit(1);

      if (!existente) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado" });
      if (existente.cadastradoPorUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão" });
      }

      const base64Data = input.fotoBase64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = input.mimeType.split("/")[1] || "jpg";
      const fileKey = `blacklist/${input.blacklistId}/foto-${randomSuffix()}.${ext}`;

      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      const [foto] = await db
        .insert(blacklistFotos)
        .values({ blacklistId: input.blacklistId, url, fileKey })
        .returning();

      return foto;
    }),

  // Remover foto
  removerFoto: protectedProcedure
    .input(z.object({ fotoId: z.number(), blacklistId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      const [existente] = await db
        .select({ cadastradoPorUserId: blacklist.cadastradoPorUserId })
        .from(blacklist)
        .where(eq(blacklist.id, input.blacklistId))
        .limit(1);

      if (!existente) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado" });
      if (existente.cadastradoPorUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão" });
      }

      await db.delete(blacklistFotos).where(eq(blacklistFotos.id, input.fotoId));
      return { sucesso: true };
    }),

  // Estatísticas gerais da blacklist
  estatisticas: protectedProcedure.query(async () => {
    const db = await requireDb();

    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        ativos: sql<number>`count(*) filter (where status = 'ativo')::int`,
        resolvidos: sql<number>`count(*) filter (where status = 'resolvido')::int`,
        emNegociacao: sql<number>`count(*) filter (where status = 'em_negociacao')::int`,
        valorTotal: sql<string>`coalesce(sum(valor_divida::numeric), 0)::text`,
      })
      .from(blacklist);

    return stats ?? { total: 0, ativos: 0, resolvidos: 0, emNegociacao: 0, valorTotal: "0" };
  }),
});
