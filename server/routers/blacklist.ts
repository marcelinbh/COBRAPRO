import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { requireBlacklistEnabled, requireBlacklistEntitlement } from "../services/blacklistEntitlement";
import {
  BLACKLIST_MAX_BASE64, blacklistPhotoUrl, validatedBlacklistPhotoKey,
  uploadPrivateBlacklistPhoto, removePrivateBlacklistPhoto, removePrivatePhotoReversibly,
} from "../services/blacklistPrivateStorage";
import { TRPCError } from "@trpc/server";
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
const subscriberProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  await requireBlacklistEntitlement(ctx.user);
  return next({ ctx });
});
const documentoInput = z.string().max(20)
  .refine(value => /^[\d.\-/\s]+$/.test(value) && documentoBlacklistValido(value), "Informe CPF ou CNPJ completo e válido");

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
    return normalizarTextoBlacklist(valor?.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/<[^>]*>/g, ""), limite);
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || (Number.isNaN(Date.parse(`${data}T12:00:00Z`)) || new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) !== data)) {
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
  // Auditoria administrativa separada não concede entitlement nem acesso a fotos.
  // Provisionamento de grants continua exclusivamente SQL humano aprovado.
  auditarAcessos: adminProcedure
    .input(z.object({ userId: z.number().int().positive(), offset: z.number().int().min(0).max(10_000).default(0) }))
    .query(async ({ input }) => {
      requireBlacklistEnabled();
      const supabase = await requireSupabase();
      const { data, error } = await supabase.from("blacklist_access_audit")
        .select("id, user_id, actor_id, action, before_data, after_data, occurred_at")
        .eq("user_id", input.userId).order("id", { ascending: false })
        .range(input.offset, input.offset + 49);
      if (error) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Auditoria indisponível; validar concessões backend-only." });
      return data ?? [];
    }),

  // A Blacklist é compartilhada por requisito do produto, mas cada inclusão
  // recebe somente dados validados e a consulta pública retorna um DTO mínimo.
  criar: subscriberProcedure
    .input(dadosComuns.extend({
      cpfCnpj: documentoInput,
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
  consultar: subscriberProcedure
    .input(z.object({ busca: documentoInput }))
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

  detalhe: subscriberProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const supabase = await requireSupabase();
      const { data: registro, error } = await supabase.from("blacklist")
        .select("id, cpf_cnpj, nome, cidade, estado, tipo_divida, status, cadastrado_por_user_id")
        .eq("id", input.id).limit(1).maybeSingle();
      if (error || !registro || (registro.cadastrado_por_user_id !== ctx.user.id
        && !["ativo", "em_negociacao"].includes(registro.status))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado" });
      }
      const { data: photos, error: photosError } = await supabase.from("blacklist_fotos")
        .select("id, blacklist_id, file_key, url").eq("blacklist_id", registro.id).limit(5);
      if (photosError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Fotos indisponíveis" });
      const fotos = (photos ?? []).flatMap(photo => {
        try {
          if (photo.blacklist_id !== registro.id) return [];
          validatedBlacklistPhotoKey(photo, { userId: registro.cadastrado_por_user_id, blacklistId: registro.id });
          return [{ id: photo.id, url: blacklistPhotoUrl(photo.id) }];
        } catch { return []; }
      });
      return { ...paraConsultaCompartilhada(registro), fotos };
    }),

  // Registros próprios conservam os dados necessários para o autor editar e
  // recebem somente rotas same-origin protegidas; referências privadas nunca vão ao cliente.
  listarMeus: subscriberProcedure.query(async ({ ctx }) => {
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
      : await supabase.from("blacklist_fotos").select("id, blacklist_id, file_key, url").in("blacklist_id", ids).limit(500);
    if (fotosErro) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível carregar suas fotos" });

    const urlsPorRegistro = new Map<number, Array<{ id: number; url: string }>>();
    for (const foto of fotos ?? []) {
      try {
        validatedBlacklistPhotoKey(foto, { userId: ctx.user.id, blacklistId: foto.blacklist_id });
        const url = blacklistPhotoUrl(foto.id);
        const lista = urlsPorRegistro.get(foto.blacklist_id) ?? [];
        lista.push({ id: foto.id, url });
        urlsPorRegistro.set(foto.blacklist_id, lista);
      } catch (erro) {
        console.warn("[Blacklist] foto legada não exibida; migração aprovada necessária", { fotoId: foto.id });
      }
    }
    return (registros ?? []).map((registro: any) => paraRegistroProprio(registro, urlsPorRegistro.get(registro.id) ?? []));
  }),

  atualizar: subscriberProcedure
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

  deletar: subscriberProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await requireSupabase();
      const { data: proprio, error: proprioErro } = await supabase.from("blacklist")
        .select("id").eq("id", input.id).eq("cadastrado_por_user_id", ctx.user.id).maybeSingle();
      if (proprioErro || !proprio) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado" });
      // RPC service_role da 0023 trava o pai e só exclui registro sem fotos.
      // Fotos devem ser removidas reversivelmente antes; impede CASCADE órfão
      // inclusive se um upload concorrente disputar o lock do pai na 0019.
      const { data, error } = await supabase.rpc("blacklist_delete_empty_owned", { target_id: input.id, owner_id: ctx.user.id });
      if (error?.code === "23514") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Remova primeiro as fotos do registro para preservar a exclusão segura." });
      if (error) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Exclusão segura indisponível. Validar migration 0023." });
      if (data !== true) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado" });
      return { sucesso: true };
    }),

  adicionarFoto: subscriberProcedure
    .input(z.object({
      blacklistId: z.number().int().positive(),
      fotoBase64: z.string().min(1).max(BLACKLIST_MAX_BASE64 + 32),
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

      const scope = { userId: ctx.user.id, blacklistId: input.blacklistId };
      const stored = await uploadPrivateBlacklistPhoto(scope, input.fotoBase64, input.mimeType);
      let foto: { id: number } | null = null;
      let dbError: { code?: string } | null = null;
      try {
        const result = await supabase.from("blacklist_fotos")
          .insert({ blacklist_id: input.blacklistId, url: stored.reference, file_key: stored.key })
          .select("id").maybeSingle();
        foto = result.data;
        dbError = result.error;
      } catch {
        dbError = {};
      }
      if (!foto) {
        // Timeout pode ter confirmado INSERT: verificar antes de remover objeto.
        const confirmed = await supabase.from("blacklist_fotos").select("id")
          .eq("blacklist_id", input.blacklistId).eq("file_key", stored.key).limit(1).maybeSingle();
        if (confirmed.error) {
          console.error("[Blacklist] upload com confirmação ambígua; reconciliar", { key: stored.key });
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirmação da foto pendente; contate o responsável antes de reenviar." });
        }
        if (confirmed.data) return { id: confirmed.data.id };
        await removePrivateBlacklistPhoto(stored.key, scope);
        throw new TRPCError({ code: dbError?.code === "23514" ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR", message: dbError?.code === "23514" ? "Limite de cinco fotos por registro atingido" : "Não foi possível registrar a foto; upload revertido." });
      }
      return { id: foto.id };
    }),

  removerFoto: subscriberProcedure
    .input(z.object({ fotoId: z.number().int().positive(), blacklistId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await requireSupabase();
      const { data: proprio, error: proprioErro } = await supabase.from("blacklist")
        .select("id").eq("id", input.blacklistId).eq("cadastrado_por_user_id", ctx.user.id).maybeSingle();
      if (proprioErro || !proprio) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado" });
      const { data: photo, error: photoError } = await supabase.from("blacklist_fotos")
        .select("id, blacklist_id, file_key, url").eq("id", input.fotoId).eq("blacklist_id", input.blacklistId).maybeSingle();
      if (photoError || !photo) throw new TRPCError({ code: "NOT_FOUND", message: "Foto não encontrada neste registro" });
      const scope = { userId: ctx.user.id, blacklistId: input.blacklistId };
      const key = validatedBlacklistPhotoKey(photo, scope);
      await removePrivatePhotoReversibly(key, scope, async () => {
        let result;
        try {
          result = await supabase.from("blacklist_fotos").delete().eq("id", input.fotoId)
            .eq("blacklist_id", input.blacklistId).eq("file_key", photo.file_key).select("id").maybeSingle();
        } catch { result = { error: true, data: null }; }
        if (!result.error && result.data) return;
        const confirmation = await supabase.from("blacklist_fotos").select("id")
          .eq("id", input.fotoId).eq("blacklist_id", input.blacklistId).maybeSingle();
        if (!confirmation.error && !confirmation.data) return;
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Exclusão não confirmada; foto restaurada para preservar os dados." });
      });
      return { sucesso: true };
    }),

  estatisticas: subscriberProcedure.query(async () => {
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
