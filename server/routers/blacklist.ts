import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { storageGet, storagePut } from "../storage";
import { validarFotoBlacklist } from "../uploadSecurity";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import {
  documentoBlacklistValido,
  mascararDocumentoBlacklist,
  mascararNomeBlacklist,
  normalizarDocumentoBlacklist,
  normalizarTextoBlacklist,
  normalizarValorBlacklist,
} from "../services/blacklistPrivacy";

const TIPOS_DIVIDA = ["emprestimo", "servico", "produto", "aluguel", "cheque", "outros"] as const;
const STATUS_BLACKLIST = ["ativo", "resolvido", "em_negociacao"] as const;
const UFS = new Set(["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]);
const MAX_FOTOS_POR_REGISTRO = 5;

async function requireSupabase() {
  const supabase = await getSupabaseClientAsync();
  if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
  return supabase;
}

function erroValidacao(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

function textoSeguro(valor: string | undefined, limite: number, campo: string): string | null {
  try {
    return normalizarTextoBlacklist(valor, limite);
  } catch {
    return erroValidacao(`${campo} excede o limite permitido`);
  }
}

function valorSeguro(valor: string | undefined): string | null {
  try {
    return normalizarValorBlacklist(valor);
  } catch {
    return erroValidacao("Valor da dívida inválido");
  }
}

function emailSeguro(valor: string | undefined): string | null {
  const email = textoSeguro(valor, 320, "E-mail");
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erroValidacao("E-mail inválido");
  return email.toLowerCase();
}

function ufSegura(valor: string | undefined): string | null {
  const uf = textoSeguro(valor, 2, "UF");
  if (!uf) return null;
  const normalizada = uf.toUpperCase();
  if (!UFS.has(normalizada)) erroValidacao("UF inválida");
  return normalizada;
}

function dataSegura(valor: string | undefined): string | null {
  const data = textoSeguro(valor, 10, "Data da ocorrência");
  if (!data) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`))) {
    erroValidacao("Data da ocorrência inválida");
  }
  return data;
}

function dadosRegistro(input: {
  nome?: string; telefone?: string; email?: string; endereco?: string; numero?: string;
  complemento?: string; bairro?: string; cidade?: string; estado?: string; cep?: string;
  motivo?: string; tipoDivida?: typeof TIPOS_DIVIDA[number]; valorDivida?: string;
  dataOcorrencia?: string; observacoes?: string; status?: typeof STATUS_BLACKLIST[number];
}) {
  const dados: Record<string, unknown> = {};
  if (input.nome !== undefined) {
    const nome = textoSeguro(input.nome, 255, "Nome");
    if (!nome || nome.length < 2) erroValidacao("Nome obrigatório");
    dados.nome = nome;
  }
  if (input.telefone !== undefined) dados.telefone = textoSeguro(input.telefone, 20, "Telefone");
  if (input.email !== undefined) dados.email = emailSeguro(input.email);
  if (input.endereco !== undefined) dados.endereco = textoSeguro(input.endereco, 300, "Endereço");
  if (input.numero !== undefined) dados.numero = textoSeguro(input.numero, 20, "Número");
  if (input.complemento !== undefined) dados.complemento = textoSeguro(input.complemento, 100, "Complemento");
  if (input.bairro !== undefined) dados.bairro = textoSeguro(input.bairro, 100, "Bairro");
  if (input.cidade !== undefined) dados.cidade = textoSeguro(input.cidade, 100, "Cidade");
  if (input.estado !== undefined) dados.estado = ufSegura(input.estado);
  if (input.cep !== undefined) dados.cep = textoSeguro(input.cep, 9, "CEP");
  if (input.motivo !== undefined) {
    const motivo = textoSeguro(input.motivo, 2_000, "Motivo");
    if (!motivo || motivo.length < 3) erroValidacao("Motivo obrigatório");
    dados.motivo = motivo;
  }
  if (input.tipoDivida !== undefined) dados.tipo_divida = input.tipoDivida;
  if (input.valorDivida !== undefined) dados.valor_divida = valorSeguro(input.valorDivida);
  if (input.dataOcorrencia !== undefined) dados.data_ocorrencia = dataSegura(input.dataOcorrencia);
  if (input.observacoes !== undefined) dados.observacoes = textoSeguro(input.observacoes, 2_000, "Observações");
  if (input.status !== undefined) dados.status = input.status;
  return dados;
}

function paraConsultaCompartilhada(registro: any) {
  return {
    id: registro.id,
    nome: mascararNomeBlacklist(registro.nome),
    documentoMascarado: mascararDocumentoBlacklist(registro.cpf_cnpj),
    cidade: registro.cidade ?? null,
    estado: registro.estado ?? null,
    tipoDivida: registro.tipo_divida,
    status: registro.status,
  };
}

function paraRegistroProprio(registro: any, fotos: Array<{ id: number; url: string }> = []) {
  return {
    id: registro.id,
    cpfCnpj: registro.cpf_cnpj,
    nome: registro.nome,
    telefone: registro.telefone ?? null,
    email: registro.email ?? null,
    endereco: registro.endereco ?? null,
    numero: registro.numero ?? null,
    complemento: registro.complemento ?? null,
    bairro: registro.bairro ?? null,
    cidade: registro.cidade ?? null,
    estado: registro.estado ?? null,
    cep: registro.cep ?? null,
    motivo: registro.motivo,
    tipoDivida: registro.tipo_divida,
    valorDivida: registro.valor_divida ?? null,
    dataOcorrencia: registro.data_ocorrencia ?? null,
    status: registro.status,
    observacoes: registro.observacoes ?? null,
    createdAt: registro.createdAt ?? registro.created_at,
    updatedAt: registro.updatedAt ?? registro.updated_at,
    fotos,
  };
}

const dadosComuns = z.object({
  nome: z.string().max(255).optional(),
  telefone: z.string().max(20).optional(),
  email: z.string().max(320).optional(),
  endereco: z.string().max(300).optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().max(9).optional(),
  motivo: z.string().max(2_000).optional(),
  tipoDivida: z.enum(TIPOS_DIVIDA).optional(),
  valorDivida: z.string().max(30).optional(),
  dataOcorrencia: z.string().max(10).optional(),
  observacoes: z.string().max(2_000).optional(),
});

export const blacklistRouter = router({
  // A Blacklist é compartilhada por requisito do produto, mas cada inclusão
  // recebe somente dados validados e a consulta pública retorna um DTO mínimo.
  criar: protectedProcedure
    .input(dadosComuns.extend({
      cpfCnpj: z.string().max(20).refine(documentoBlacklistValido, "Informe CPF ou CNPJ completo e válido"),
      nome: z.string().max(255),
      motivo: z.string().max(2_000),
      tipoDivida: z.enum(TIPOS_DIVIDA).default("outros"),
    }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await requireSupabase();
      const empresa = textoSeguro(ctx.user.nomeEmpresa ?? ctx.user.name ?? "Empresa não informada", 255, "Empresa") ?? "Empresa não informada";
      const dados = dadosRegistro(input);
      const { data, error } = await supabase.from("blacklist").insert({
        ...dados,
        cpf_cnpj: normalizarDocumentoBlacklist(input.cpfCnpj),
        cadastrado_por_user_id: ctx.user.id,
        cadastrado_por_empresa: empresa,
      }).select("id").maybeSingle();
      if (error || !data) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar o registro" });
      return { id: data.id };
    }),

  // A busca compartilhada aceita somente documento completo; isso bloqueia
  // enumeração por nome, fragmentos de CPF/CNPJ e o antigo ILIKE '%%'.
  consultar: protectedProcedure
    .input(z.object({ busca: z.string().max(20).refine(documentoBlacklistValido, "Informe CPF ou CNPJ completo e válido") }))
    .query(async ({ input }) => {
      const supabase = await requireSupabase();
      const documento = normalizarDocumentoBlacklist(input.busca);
      const { data, error } = await supabase.from("blacklist")
        .select("id, cpf_cnpj, nome, cidade, estado, tipo_divida, status")
        .eq("cpf_cnpj", documento)
        .in("status", ["ativo", "em_negociacao"])
        .limit(3);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível consultar a Blacklist" });
      return (data ?? []).map(paraConsultaCompartilhada);
    }),

  // Registros próprios conservam os dados necessários para o autor editar e
  // recebem URLs de download emitidas sob demanda; file_key nunca vai ao cliente.
  listarMeus: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await requireSupabase();
    const { data: registros, error } = await supabase.from("blacklist")
      .select("id, cpf_cnpj, nome, telefone, email, endereco, numero, complemento, bairro, cidade, estado, cep, motivo, tipo_divida, valor_divida, data_ocorrencia, status, observacoes, createdAt, updatedAt")
      .eq("cadastrado_por_user_id", ctx.user.id)
      .order("createdAt", { ascending: false })
      .limit(100);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível listar seus registros" });

    const ids = (registros ?? []).map((registro: any) => registro.id);
    const { data: fotos, error: fotosErro } = ids.length === 0
      ? { data: [], error: null }
      : await supabase.from("blacklist_fotos").select("id, blacklist_id, file_key").in("blacklist_id", ids);
    if (fotosErro) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível carregar suas fotos" });

    const urlsPorRegistro = new Map<number, Array<{ id: number; url: string }>>();
    for (const foto of fotos ?? []) {
      try {
        const { url } = await storageGet(foto.file_key);
        const lista = urlsPorRegistro.get(foto.blacklist_id) ?? [];
        lista.push({ id: foto.id, url });
        urlsPorRegistro.set(foto.blacklist_id, lista);
      } catch (erro) {
        console.warn("[Blacklist] não foi possível emitir URL privada da foto", { fotoId: foto.id, erro: erro instanceof Error ? erro.message : "erro desconhecido" });
      }
    }
    return (registros ?? []).map((registro: any) => paraRegistroProprio(registro, urlsPorRegistro.get(registro.id) ?? []));
  }),

  atualizar: protectedProcedure
    .input(dadosComuns.extend({ id: z.number().int().positive(), status: z.enum(STATUS_BLACKLIST).optional() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await requireSupabase();
      const { id, ...campos } = input;
      const dados = dadosRegistro(campos);
      if (Object.keys(dados).length === 0) erroValidacao("Informe ao menos um campo para atualizar");
      const { data, error } = await supabase.from("blacklist")
        .update({ ...dados, updatedAt: new Date().toISOString() })
        .eq("id", id)
        .eq("cadastrado_por_user_id", ctx.user.id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado" });
      return { id: data.id };
    }),

  deletar: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await requireSupabase();
      const { data: proprio, error: proprioErro } = await supabase.from("blacklist")
        .select("id").eq("id", input.id).eq("cadastrado_por_user_id", ctx.user.id).maybeSingle();
      if (proprioErro || !proprio) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado" });
      const { error: fotosErro } = await supabase.from("blacklist_fotos").delete().eq("blacklist_id", input.id);
      if (fotosErro) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível remover as fotos do registro" });
      const { error } = await supabase.from("blacklist").delete().eq("id", input.id).eq("cadastrado_por_user_id", ctx.user.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível remover o registro" });
      return { sucesso: true };
    }),

  adicionarFoto: protectedProcedure
    .input(z.object({
      blacklistId: z.number().int().positive(),
      fotoBase64: z.string().min(1),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await requireSupabase();
      const { data: proprio, error: proprioErro } = await supabase.from("blacklist")
        .select("id").eq("id", input.blacklistId).eq("cadastrado_por_user_id", ctx.user.id).maybeSingle();
      if (proprioErro || !proprio) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado" });

      const { count, error: contagemErro } = await supabase.from("blacklist_fotos")
        .select("id", { count: "exact", head: true }).eq("blacklist_id", input.blacklistId);
      if (contagemErro) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível verificar as fotos" });
      if ((count ?? 0) >= MAX_FOTOS_POR_REGISTRO) erroValidacao(`Limite de ${MAX_FOTOS_POR_REGISTRO} fotos por registro atingido`);

      const base64Data = input.fotoBase64.replace(/^data:[^;]+;base64,/, "");
      let fotoValidada;
      try {
        fotoValidada = validarFotoBlacklist(base64Data, input.mimeType);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Foto inválida" });
      }
      const fileKey = `blacklist/${input.blacklistId}/foto-${randomUUID()}.${fotoValidada.extensao}`;
      const { url } = await storagePut(fileKey, fotoValidada.buffer, fotoValidada.contentType);
      const { data: foto, error } = await supabase.from("blacklist_fotos")
        .insert({ blacklist_id: input.blacklistId, url, file_key: fileKey })
        .select("id").maybeSingle();
      if (error || !foto) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível registrar a foto" });
      return { id: foto.id };
    }),

  removerFoto: protectedProcedure
    .input(z.object({ fotoId: z.number().int().positive(), blacklistId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await requireSupabase();
      const { data: proprio, error: proprioErro } = await supabase.from("blacklist")
        .select("id").eq("id", input.blacklistId).eq("cadastrado_por_user_id", ctx.user.id).maybeSingle();
      if (proprioErro || !proprio) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado" });
      const { data, error } = await supabase.from("blacklist_fotos").delete()
        .eq("id", input.fotoId).eq("blacklist_id", input.blacklistId).select("id").maybeSingle();
      if (error || !data) throw new TRPCError({ code: "NOT_FOUND", message: "Foto não encontrada neste registro" });
      return { sucesso: true };
    }),

  estatisticas: protectedProcedure.query(async () => {
    const supabase = await requireSupabase();
    const [total, ativos, resolvidos, emNegociacao] = await Promise.all([
      supabase.from("blacklist").select("id", { count: "exact", head: true }),
      supabase.from("blacklist").select("id", { count: "exact", head: true }).eq("status", "ativo"),
      supabase.from("blacklist").select("id", { count: "exact", head: true }).eq("status", "resolvido"),
      supabase.from("blacklist").select("id", { count: "exact", head: true }).eq("status", "em_negociacao"),
    ]);
    if (total.error || ativos.error || resolvidos.error || emNegociacao.error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível carregar estatísticas" });
    }
    return { total: total.count ?? 0, ativos: ativos.count ?? 0, resolvidos: resolvidos.count ?? 0, emNegociacao: emNegociacao.count ?? 0 };
  }),
});
